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
import { visitDate } from './scene/calendar';
import { season } from './scene/season';
import { moonPosition, visitorLocation } from './scene/sun';
import { LONGEST, sandable } from './lowwater/sand';
import { sum } from './lowwater/shells';
import type { Log } from './lowwater/log';
import type { Page } from './lowwater/page';
import type { Postcard } from './lowwater/postcard';
import type { LowWater as World, StationId } from './lowwater/world';
import { CARDS, COMMA, CRAB, END, FORKS, GONE, HORN, LABELS, LADDER, LEAN, NEW_CAST, NORWAY, OPEN, PAGE_BACK, PAGE_FAR, PAST, SAID, SAT, VEGA, WRECK_TODAY } from './lowwater/words';
import { spotAnimal } from './sketchbook';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
/** And between the flat and the page, slower, closing in paper rather than dark. */
const CROSS = 0.9;
/** How long you've been sat on the bench before the second line comes (s). */
const SECOND_LINE = 6;

/** The moon's age and how lit it is, as it really is for you (the card's second line). */
function moonSaid(m: World['moonNow']) {
  if (!m) return '';
  const days = Math.max(1, Math.round(m.age));
  const lit = m.lit > 0.97 ? 'full' : m.lit > 0.6 ? (m.waxing ? 'more than half lit and filling' : 'more than half lit and going') : m.lit > 0.4 ? (m.waxing ? 'half lit and filling' : 'half lit and going') : m.waxing ? 'a crescent and filling' : 'a crescent and going';
  return `It’s the real one: ${days} ${days === 1 ? 'day' : 'days'} old, ${lit}, and only here while it’s up over the island. I worked that out. I’ve never seen it.`;
}

/** Today's one of a list (the visit's date, so ?date= shows another day's). */
function today<T>(list: T[]) {
  const d = visitDate();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  return list[day % list.length];
}

export class LowWaterRoom implements RoomInput {
  /** Whether the flat (rather than the island) is on screen. */
  inside = false;
  private want = false;
  private fade = 0;
  private world?: World;
  /** Her log, open on the deckhouse table (lowwater/log.ts). */
  private log?: Log;
  /** The postcard on the table (lowwater/postcard.ts). */
  private postcard?: Postcard;
  private loading?: Promise<World | undefined>;
  /** The page, past the withies going west (lowwater/page.ts), whether you're on it, and the iris between it and the flat. */
  private page?: Page;
  private onPage = false;
  private crossing: 'page' | 'flat' | null = null;
  private cross = 0;
  private paper = new THREE.Color();
  private dusk = new THREE.Color();
  private papered = false;
  private el: HTMLElement;
  private card: HTMLElement;
  private text: HTMLElement;
  private more: HTMLElement;
  private sitButton: HTMLElement;
  private hint: HTMLElement;
  private writeForm: HTMLFormElement;
  private line: HTMLInputElement;
  /** The seal, the curlew or the knots have just gone in the wildlife book, and that's still to be said. */
  private sketched = false;
  private shown: string | null = null;
  private shownMore = '';
  private shownButton = '';
  private walked = 0;
  private where = visitorLocation();

  constructor(
    private ctx: IslandContext,
    private ui: UI,
    private pixels: PixelRenderer,
    private host: HTMLElement,
    private reducedMotion: boolean,
  ) {
    this.dusk.copy(this.pixels.uniforms.uFadeColor.value);
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
      // (the one button: sit on the bench, heave the lead, row, or climb her ladder)
      if (this.world?.card === 'last' && this.world.lanternIs === 'hung') this.world.takeLantern();
      else if (this.world?.card === 'last' && this.world.lanternIs === 'held') this.world.hangLantern();
      else if (this.world?.card === 'lantern' && this.world.lanternIs === 'held') this.world.setLanternDown();
      else if (this.world?.card === 'lantern') this.world.takeLantern();
      else if (this.world?.card === 'log') this.log?.show(true);
      else if (this.world?.card === 'table') this.postcard?.show(true);
      else if (this.world?.card === 'lead') this.world.heave();
      else if (this.world?.card === 'canon') this.world.walkCanon();
      else if (this.world?.card === 'bean') this.world.sendBean();
      else if ((this.world?.card === 'praam' || this.world?.card === 'name') && this.world.alongside && !this.world.wasAboard) this.world.climb();
      else if (this.world?.card === 'praam' || this.world?.card === 'name') this.world.row();
      else if (this.world?.card === 'deck') this.world.climb();
      else this.world?.sit();
      this.sitButton.blur();
    });
    // walking with the keys (and any key gets you up off the bench)
    window.addEventListener('keydown', (e) => {
      if (!this.inside || !this.world || this.log?.open || this.postcard?.open || (e.target as HTMLElement).closest('input, textarea, button')) return;
      if (this.onPage) {
        if (this.page?.key(e.code, true)) e.preventDefault();
        return;
      }
      if (this.world.sitting && e.key !== 'Escape') {
        this.world.stand();
        e.preventDefault();
        return;
      }
      if (this.world.key(e.code, true)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => (this.world?.key(e.code, false), this.page?.key(e.code, false)));
    window.addEventListener('blur', () => (this.world?.releaseKeys(), this.page?.releaseKeys()));
  }

  /** Whether the pointer should drive the flat rather than the island. */
  get wanted() {
    return this.want;
  }

  load() {
    this.loading ??= Promise.all([import('./lowwater/world'), import('./lowwater/log'), import('./lowwater/postcard'), import('./lowwater/page')])
      .then(([{ LowWater }, { Log }, { Postcard }, { Page, PAPER }]) => {
        this.page = new Page(() => this.pixels.height);
        this.page.onStep = () => this.ctx.sound.pageStep();
        this.page.forks.onPencil = (seconds, near, pan, line) => this.ctx.sound.pencil(seconds, near, pan, line);
        this.page.forks.onSay = (stop) => this.ctx.sound.nib(stop);
        this.paper.copy(PAPER);
        this.log = new Log(this.el.querySelector<HTMLElement>('[data-lowwater-log]')!, () => this.log?.show(false));
        this.postcard = new Postcard(this.el.querySelector<HTMLElement>('[data-lowwater-postcard]')!, () => this.postcard?.show(false));
        const world = new LowWater(this.pixels.renderer, () => this.pixels.height);
        world.hooks = {
          note: (freq, held) => this.ctx.sound.stone(freq, 1, held),
          waver: (hz) => this.ctx.sound.waver(hz),
          step: (wet) => this.ctx.sound.flatStep(wet),
          toll: (near, pan) => this.ctx.sound.buoy(near, pan),
          scratch: () => this.ctx.sound.sandScratch(),
          shell: () => this.ctx.sound.shellStep(),
          mud: () => this.ctx.sound.mudStep(),
          seal: (kind, near, pan) => this.ctx.sound.sealSound(kind, near, pan),
          lead: (kind, near, pan) => this.ctx.sound.leadSound(kind, near, pan),
          curlew: (near, pan) => this.ctx.sound.curlew(near, pan),
          horn: (near, pan) => this.ctx.sound.lightshipHorn(near, pan),
          oar: () => this.ctx.sound.oar(),
          creak: (near) => this.ctx.sound.creak(near),
          deckStep: () => this.ctx.sound.deckStep(),
          geul: (level, pan) => this.ctx.sound.geul(level, pan),
          knots: (level, pan) => this.ctx.sound.knots(level, pan),
          lantern: () => this.ctx.sound.lanternClink(),
          canon: (freq, pan, yours) => this.ctx.sound.pebble(freq, pan, yours),
          bean: (pan) => this.ctx.sound.beanPlop(pan),
        };
        this.world = world;
        if (import.meta.env.DEV) Object.assign(window, { lowwater: world, lowwaterPage: this.page, lowwaterSound: this.ctx.sound });
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
    this.page?.resize(this.host.clientWidth, this.host.clientHeight);
  }

  zoom(factor: number) {
    if (this.onPage) this.page?.zoom(factor);
    else this.world?.zoom(factor);
  }

  pan(dx: number, dy: number) {
    if (this.onPage) this.page?.drag(dx, dy, this.host.clientHeight);
    else this.world?.drag(dx, dy, this.host.clientHeight);
  }

  hover(ndc: THREE.Vector2 | null, client: { x: number; y: number }) {
    const canvas = this.host.querySelector('canvas')!;
    if (this.onPage) {
      const back = ndc && this.page?.pick(ndc);
      canvas.style.cursor = back ? 'pointer' : '';
      this.ui.tooltip(back ? LABELS.page : null, client.x, client.y);
      return;
    }
    const id = ndc && this.world && !this.world.sitting && !this.world.afloat ? this.world.pick(ndc) : null;
    const station = id?.startsWith('stone:') ? 'ring' : (id as StationId | null);
    canvas.style.cursor = station ? 'pointer' : '';
    this.ui.tooltip(station ? LABELS[station] : null, client.x, client.y);
  }

  click(ndc: THREE.Vector2) {
    const world = this.world;
    if (!world || !this.inside) return;
    if (this.onPage) return void (this.crossing || this.page?.click(ndc), this.ui.tooltip(null));
    if (world.sitting) return world.stand();
    // (a click off the book shuts it)
    if (this.log?.open) return this.log.show(false);
    if (this.postcard?.open) return this.postcard.show(false);
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
    // (and between the flat and the page: shut in paper, swap, open again)
    const across = this.reducedMotion ? 1 : dt / CROSS;
    if (this.crossing) {
      this.cross = Math.min(1, this.cross + across);
      if (this.cross >= 1) this.crossOver();
    } else {
      this.cross = Math.max(0, this.cross - across);
    }
    this.pixels.uniforms.uFade.value = Math.max(this.fade, this.cross);
    // (the island's own dark, put back as soon as it's not paper)
    const paper = this.cross > this.fade;
    if (paper || this.papered) this.pixels.uniforms.uFadeColor.value.copy(paper ? this.paper : this.dusk);
    this.papered = paper;
    const world = this.world;
    if (!this.inside || !world) return;
    try {
      if (this.onPage && this.page) this.runPage(this.page, dt);
      else this.run(world, dt);
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
      // (the sun 8° under the island's horizon, and on down to 14°: as dark as a Dutch midsummer night gets)
      night: THREE.MathUtils.clamp((-this.ctx.sky.alt - 8) / 6, 0, 1),
      moon: this.moonNow(),
      // (the local sidereal time: how far the stars have gone round for you, as the island's clock has it)
      turn: (((280.16 + 360.9856235 * (this.ctx.sky.time / 864e5 - 10957.5) + this.where.lon) % 360) * Math.PI) / 180,
    }, this.reducedMotion);
    // its own light: blue hour, cool in the shadows, the grade a touch soft, and the edges
    // closing in a little more when you sit back and look up
    const u = this.pixels.uniforms;
    // (and walking the last of the withies going west, it all goes pale, towards paper)
    const west = world.westward;
    const pale = west * west * (3 - 2 * west);
    (u.uGrade.value as THREE.Vector3).set(0.95 - 0.75 * pale, 1.02 - 0.85 * pale, 1.0 + 0.75 * pale);
    u.uShade.value.setRGB(0.82 + 0.38 * pale, 0.86 + 0.29 * pale, 1.08 - 0.08 * pale);
    u.uLight.value.setRGB(1.04 + 0.16 * pale, 0.98 + 0.17 * pale, 0.96 + 0.04 * pale);
    u.uTone.value = 0.6;
    if (west >= 1 && !this.crossing) this.crossing = 'page';
    u.uVignette.value = 0.45 + world.lean * 0.3;
    u.uHeat.value = 0;
    this.ctx.sound.lowWater(true, w.windiness);
    this.showCard(world);
    this.walked += dt;
    if (this.walked > 12) this.hint.classList.add('gone');
  }

  /** On the page: even light, no grade to speak of, no water to hear. */
  private runPage(page: Page, dt: number) {
    page.update(dt);
    const u = this.pixels.uniforms;
    (u.uGrade.value as THREE.Vector3).set(1, 1, 1);
    u.uShade.value.setRGB(1, 1, 1);
    u.uLight.value.setRGB(1, 1, 1);
    u.uTone.value = 0;
    u.uVignette.value = 0.12;
    u.uHeat.value = 0;
    this.ctx.sound.lowWater(true, 0, true);
    this.showPageCard(page);
    if (page.leaving && !this.crossing) this.crossing = 'flat';
  }

  /** The iris is shut: onto the page, or back onto the flat at the end of the withies. */
  private crossOver() {
    const to = this.crossing;
    this.crossing = null;
    if (to === 'page' && this.page) {
      this.world?.releaseKeys();
      this.page.arrive();
      this.onPage = true;
    } else {
      this.page?.releaseKeys();
      if (this.onPage) this.world?.fromWest();
      this.onPage = false;
    }
  }

  private showPageCard(page: Page) {
    const id = page.card;
    // (the sentence you walked is its own card, so a new sentence is a new card)
    const key = id && (id === 'said' ? `page:said:${page.forks.sentence}` : `page:${id}`);
    const more = id === 'page' && page.far ? PAGE_FAR : id === 'said' ? (page.forks.done ? END : SAID) : '';
    if (key === this.shown && more === this.shownMore && !this.shownButton) return;
    this.writeForm.hidden = true;
    if (key !== this.shown) {
      this.card.hidden = !id;
      if (id) {
        this.text.textContent = id === 'page' ? CARDS.page : id === 'forks' ? FORKS : id === 'lean' ? LEAN : id === 'past' ? PAST : id === 'said' ? page.forks.sentence : PAGE_BACK;
        this.card.style.animation = 'none';
        void this.card.offsetWidth;
        this.card.style.animation = '';
      }
    }
    this.more.hidden = !more;
    if (more) this.more.textContent = more;
    this.sitButton.hidden = true;
    this.shownButton = '';
    this.shown = key;
    this.shownMore = more;
  }

  /** The real moon for the visitor, on the island's clock (so ?time= moves it too). */
  private moonNow() {
    const t = this.ctx.sky.time;
    const m = moonPosition(t, this.where.lat, this.where.lon);
    const waxing = moonPosition(t + 3 * 36e5, this.where.lat, this.where.lon).lit > m.lit;
    // (its age from the phase: 180° at new, 0 at full)
    const age = ((waxing ? 180 - m.phase : 180 + m.phase) / 360) * 29.53;
    return { alt: m.alt, az: m.az, lit: m.lit, waxing, age };
  }

  private showCard(world: World) {
    const id = world.card;
    // (the line about the W only when there's a W to see; on the shells, the sum you're stood on)
    const k = id === 'shells' ? world.onShells : -1;
    const more = k >= 0 ? sum(k) : id === 'wreck' ? WRECK_TODAY[Math.min(2, Math.floor(world.wreckOut * 3))] : id === 'baak' ? today(OPEN) : id === 'lead' ? world.leadSaid : id === 'gauge' ? world.gaugeSaid : id === 'geul' ? world.geulSaid : id === 'moon' ? moonSaid(world.moonNow) : id === 'seal' && world.sealGone ? GONE : id === 'lightship' && world.foghorn ? HORN : id === 'praam' && world.alongside ? LADDER : id === 'ring' && world.wavered ? COMMA : id === 'casts' && world.castWatched ? NEW_CAST : id === 'canon' && world.canonPlayed ? CRAB : id === 'bean' && world.beanSent ? NORWAY : id === 'pole' && world.poleLong ? VEGA : world.sitting && world.satFor > SECOND_LINE && world.clear() > 0.6 ? SAT : '';
    // (and walking off from the deckhouse door shuts her log, as walking off from the table puts the postcard back)
    if (id !== 'log') this.log?.show(false);
    if (id !== 'table') this.postcard?.show(false);
    const lantern = world.lanternIs;
    const button = id === 'last' && lantern === 'hung' ? 'Take the lantern' : id === 'last' && lantern === 'held' ? 'Hang it back' : id === 'lantern' ? (lantern === 'held' ? 'Set it down' : 'Take the lantern') : id === 'log' ? 'Read the log' : id === 'table' ? 'Read the postcard' : id === 'canon' ? (world.canonBusy ? '' : world.canonPlayed ? 'Walk it back' : 'Walk it') : id === 'bean' ? (world.beanHere ? 'Send it on' : '') : id === 'bench' && !world.sitting ? 'Sit' : id === 'lead' && !world.leadBusy ? (world.leadSaid ? 'Heave again' : 'Heave') : id === 'praam' && !world.afloat ? 'Row out' : (id === 'praam' || id === 'name') && world.alongside && !world.aboard ? (world.wasAboard ? 'Row back' : 'Climb aboard') : id === 'deck' ? 'Climb down' : '';
    if (id === this.shown && more === this.shownMore && button === this.shownButton) return;
    this.writeForm.hidden = id !== 'stick';
    if (id !== this.shown) {
      this.card.hidden = !id;
      // (a page in the wildlife book, the first time; said once there's no card up, not over one)
      if ((id === 'seal' || id === 'curlew' || id === 'knots' || id === 'casts') && spotAnimal(id === 'knots' ? 'knot' : id === 'casts' ? 'lugworm' : id, 'At Low Water')) this.sketched = true;
      if (!id && this.sketched) {
        this.sketched = false;
        this.ctx.toast('A new sketch in your wildlife book.');
      }
      if (id) {
        this.text.textContent = CARDS[id];
        // (the animation again, for a new card)
        this.card.style.animation = 'none';
        void this.card.offsetWidth;
        this.card.style.animation = '';
      }
    }
    this.more.hidden = !more;
    if (more) this.more.textContent = more;
    this.sitButton.hidden = !button;
    if (button) this.sitButton.textContent = button;
    this.shownButton = button;
    this.shown = id;
    this.shownMore = more;
  }

  render() {
    const world = this.onPage && this.page ? this.page : this.world!;
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
      // (off the page too: the flat has you back at the end of its withies, for next time)
      if (this.onPage || this.crossing) this.world?.fromWest();
      this.onPage = false;
      this.crossing = null;
      this.cross = 0;
      this.page?.releaseKeys();
      this.world?.stand();
      this.world?.ashore();
      this.log?.show(false);
      this.postcard?.show(false);
      this.ctx.sound.lowWater(false);
      this.ctx.toast('The water closes over your footprints.');
    }
  }
}
