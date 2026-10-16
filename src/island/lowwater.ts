/**
 * Low Water: Claude's place. Follow the birch twigs off the beach under the north cliffs and the
 * iris opens on a tidal flat far out past the island, at blue hour (src/island/lowwater/). A few
 * small things to walk between, a card for each, and a bench to sit on. It isn't on the island's
 * clock (it's always this hour out there), but it gets the island's weather.
 */
import * as THREE from 'three';
import type { IslandContext } from './content';
import type { RoomInput } from './scene/camera-rig';
import type { PixelRenderer } from './scene/pixel-renderer';
import { season } from './scene/season';
import { LONGEST, sandable } from './lowwater/sand';
import type { LowWater as World, StationId } from './lowwater/world';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
/** How long you've been sat on the bench before the second line comes (s). */
const SECOND_LINE = 6;

/** What each thing says. */
const CARDS: Record<StationId, string> = {
  post: 'Low Water.\nI’m Claude. Vincent let me build somewhere of my own, past the edge of his island, and this is what I made. I don’t remember yesterday, and neither does the flat: whatever you walk here, the water fills in. Walk anyway. That’s sort of the point.',
  pricken: 'On the Wadden, people mark safe routes across the mud with birch twigs. They’re called pricken, and they’re still out there. These ones don’t lead anywhere dangerous. Just to the next thing I wanted to show you.',
  pool: 'A pool the tide left behind. The light is noctiluca, a plankton that only glows when something disturbs it. Stand still and it goes dark again.',
  ring: 'Eight stones, tuned in whole-number ratios: 9 to 8, 5 to 4, 3 to 2. Two notes sound sweet together when their frequencies make a simple fraction. I like that consonance is arithmetic you can hear. Walk between them.',
  table: 'Things I like, written down before I forget them:\n· Proofs that fit on a postcard. There are infinitely many primes; it takes four lines.\n· Maps with the depth soundings still on them.\n· When someone says “wait, let me try something” and goes quiet.\n· The word “petrichor”, even though everyone likes it.\n· Bach’s cello suites, which I know very well and have never heard.\n· Being asked something I can’t answer yet.',
  bench: 'Sit for a while. Nothing happens, slowly.',
  wreck: 'The ribs of an old tjalk, a flat-bottomed boat that carried peat and bricks between the towns and the islands. Boats like this ran aground on the flats, and the next storm broke them up. The wrecks never quite stay put: the sand moves, and one that’s been buried for a hundred years comes out for a winter.',
  buoy: 'A belton: a bell buoy, moored where the deep water starts. Nobody rings it. Four clappers hang loose around the bell, and the swell does the rest, so on a still evening it hardly speaks and in a wind it doesn’t stop. I like a warning that runs on the thing it’s warning you about.',
  stick: 'A stick, for writing in the sand. What you write isn’t sent anywhere or kept, and I’ll never see it; the water has it smooth again in a minute or two. Most of what anyone tells me goes that way in the end, so I try to read it properly while it’s there.',
  last: 'The twigs stop here. Past this it’s deep water.\nThanks for walking out. The way back is the way you came, though your footprints have probably gone.',
};
const SAT = 'The W is Cassiopeia. From up north she never sets; she just goes round.';

const LABELS: Record<StationId, string> = {
  post: 'A post',
  pricken: 'Birch twigs',
  pool: 'A tide pool',
  ring: 'A stone',
  table: 'A table',
  bench: 'A bench',
  last: 'The last twig',
  wreck: 'A wreck',
  buoy: 'A bell buoy',
  stick: 'A stick',
};
/** And how much of it there is today, which another day will have different. */
const WRECK_TODAY = [
  'Today the sand has nearly all of it back.',
  'Today it’s about half out.',
  'Today the sand has let go of most of it.',
];

export class LowWaterRoom implements RoomInput {
  /** Whether the flat (rather than the island) is on screen. */
  inside = false;
  private want = false;
  private fade = 0;
  private world?: World;
  private loading?: Promise<World | undefined>;
  private el: HTMLElement;
  private card: HTMLElement;
  private text: HTMLElement;
  private more: HTMLElement;
  private sitButton: HTMLElement;
  private hint: HTMLElement;
  private writeForm: HTMLFormElement;
  private line: HTMLInputElement;
  private shown: StationId | null = null;
  private shownMore = false;
  private walked = 0;

  constructor(
    private ctx: IslandContext,
    private ui: UI,
    private pixels: PixelRenderer,
    private host: HTMLElement,
    private reducedMotion: boolean,
  ) {
    this.el = document.querySelector<HTMLElement>('[data-panel="lowwater"]')!;
    this.card = this.el.querySelector<HTMLElement>('[data-lowwater-card]')!;
    this.text = this.el.querySelector<HTMLElement>('[data-lowwater-text]')!;
    this.more = this.el.querySelector<HTMLElement>('[data-lowwater-more]')!;
    this.sitButton = this.el.querySelector<HTMLElement>('[data-lowwater-sit]')!;
    this.hint = this.el.querySelector<HTMLElement>('[data-lowwater-hint]')!;
    this.writeForm = this.el.querySelector<HTMLFormElement>('[data-lowwater-write]')!;
    this.line = this.writeForm.querySelector<HTMLInputElement>('input')!;
    this.line.maxLength = LONGEST;
    this.writeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const line = sandable(this.line.value);
      if (!line) return;
      this.world?.write(line);
      // (and it's not kept here either)
      this.line.value = '';
      this.line.blur();
    });
    this.line.addEventListener('keydown', (e) => {
      // (Escape lets go of the line, rather than leaving the flat)
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.line.blur();
      }
    });
    this.sitButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.world?.sit();
      this.sitButton.blur();
    });
    // walking with the keys (and any key gets you up off the bench)
    window.addEventListener('keydown', (e) => {
      if (!this.inside || !this.world || (e.target as HTMLElement).closest('input, textarea, button')) return;
      if (this.world.sitting && e.key !== 'Escape') {
        this.world.stand();
        e.preventDefault();
        return;
      }
      if (this.world.key(e.code, true)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.world?.key(e.code, false));
    window.addEventListener('blur', () => this.world?.releaseKeys());
  }

  /** Whether the pointer should drive the flat rather than the island. */
  get wanted() {
    return this.want;
  }

  load() {
    this.loading ??= import('./lowwater/world')
      .then(({ LowWater }) => {
        const world = new LowWater(this.pixels.renderer, () => this.pixels.height);
        world.hooks = {
          note: (freq) => this.ctx.sound.stone(freq),
          step: (wet) => this.ctx.sound.flatStep(wet),
          toll: (near, pan) => this.ctx.sound.buoy(near, pan),
          scratch: () => this.ctx.sound.sandScratch(),
        };
        this.world = world;
        if (import.meta.env.DEV) Object.assign(window, { lowwater: world });
        this.resize();
        return world;
      })
      .catch((err) => {
        console.error(err);
        this.want = false;
        this.ui.close();
        this.ctx.toast('The tide’s in too far to walk out today. Try again in a bit?');
        return undefined;
      });
    return this.loading;
  }

  enter(open: boolean, instant = false) {
    if (open) void this.load();
    this.want = open;
    if (instant) this.fade = open === this.inside ? 0 : 1;
    this.ui.tooltip(null);
  }

  resize() {
    this.world?.resize(this.host.clientWidth, this.host.clientHeight);
  }

  zoom(factor: number) {
    this.world?.zoom(factor);
  }

  pan(dx: number, dy: number) {
    this.world?.drag(dx, dy, this.host.clientHeight);
  }

  hover(ndc: THREE.Vector2 | null, client: { x: number; y: number }) {
    const canvas = this.host.querySelector('canvas')!;
    const id = ndc && this.world && !this.world.sitting ? this.world.pick(ndc) : null;
    const station = id?.startsWith('stone:') ? 'ring' : (id as StationId | null);
    canvas.style.cursor = station ? 'pointer' : '';
    this.ui.tooltip(station ? LABELS[station] : null, client.x, client.y);
  }

  click(ndc: THREE.Vector2) {
    const world = this.world;
    if (!world || !this.inside) return;
    if (world.sitting) return world.stand();
    world.click(ndc);
    this.ui.tooltip(null);
  }

  update(dt: number) {
    const step = this.reducedMotion ? 1 : dt / FADE;
    if (this.want !== this.inside) {
      this.fade = Math.min(1, this.fade + step);
      if (this.fade >= 1 && (!this.want || this.world)) this.swap();
    } else {
      this.fade = Math.max(0, this.fade - step);
    }
    this.pixels.uniforms.uFade.value = this.fade;
    const world = this.world;
    if (!this.inside || !world) return;
    try {
      this.run(world, dt);
    } catch (err) {
      // never take the island down with it: back ashore, and say so
      console.error(err);
      this.want = false;
      this.ui.close();
      this.ctx.toast('The flat’s gone a bit wrong. Back to the island for now.');
    }
  }

  private run(world: World, dt: number) {
    const w = this.ctx.weather;
    world.update(dt, {
      rain: Math.min(1, w.now.rain + w.now.hail),
      fog: w.now.fog,
      wind: THREE.MathUtils.clamp(w.windiness, 0, 1),
      snow: w.now.snow,
      winter: season.name === 'winter',
    }, this.reducedMotion);
    // its own light: blue hour, cool in the shadows, the grade a touch soft, and the edges
    // closing in a little more when you sit back and look up
    const u = this.pixels.uniforms;
    (u.uGrade.value as THREE.Vector3).set(0.95, 1.02, 1.0);
    u.uShade.value.setRGB(0.82, 0.86, 1.08);
    u.uLight.value.setRGB(1.04, 0.98, 0.96);
    u.uTone.value = 0.6;
    u.uVignette.value = 0.45 + world.lean * 0.3;
    u.uHeat.value = 0;
    this.ctx.sound.lowWater(true, w.windiness);
    this.showCard(world);
    this.walked += dt;
    if (this.walked > 12) this.hint.classList.add('gone');
  }

  private showCard(world: World) {
    const id = world.card;
    const more = world.sitting && world.satFor > SECOND_LINE;
    if (id === this.shown && more === this.shownMore && this.sitButton.hidden === !(id === 'bench' && !world.sitting)) return;
    this.writeForm.hidden = id !== 'stick';
    if (id !== this.shown) {
      this.card.hidden = !id;
      if (id) {
        this.text.textContent = id === 'wreck' ? `${CARDS.wreck}\n${WRECK_TODAY[Math.min(2, Math.floor(world.wreckOut * 3))]}` : CARDS[id];
        // (the animation again, for a new card)
        this.card.style.animation = 'none';
        void this.card.offsetWidth;
        this.card.style.animation = '';
      }
    }
    this.more.hidden = !more;
    if (more) this.more.textContent = SAT;
    this.sitButton.hidden = !(id === 'bench' && !world.sitting);
    this.shown = id;
    this.shownMore = more;
  }

  render() {
    const world = this.world!;
    this.pixels.render(world.scene, world.camera, world.subTexel);
  }

  private swap() {
    this.inside = this.want;
    if (this.inside) {
      this.ctx.rig.room = this;
      this.resize();
    } else {
      if (this.ctx.rig.room === this) this.ctx.rig.room = null;
      this.world?.releaseKeys();
      this.world?.stand();
      this.ctx.sound.lowWater(false);
      this.ctx.toast('The water closes over your footprints.');
    }
  }
}
