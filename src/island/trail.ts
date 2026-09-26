/**
 * The mountain trail: the career, one chapter per cairn. A chapter whose diorama is built opens
 * like the lighthouse, through the iris, as a little scene floating in the sky; the others keep
 * the camera on their cairn on the island. Either way a card tells the story, and ← → walk the
 * trail up and down.
 */
import * as THREE from 'three';
import { type Chapter, type Thing, chapters } from '../data/career';
import type { IslandContext } from './content';
import type { RoomInput } from './scene/camera-rig';
import { Diorama } from './scene/diorama';
import type { PixelRenderer } from './scene/pixel-renderer';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
const NO_SHIFT = new THREE.Vector2();

export class Trail implements RoomInput {
  /** Whether a diorama (rather than the island) is on screen. */
  inside = false;
  private want = false;
  private open = false;
  private fade = 0;
  /** The chapter on the card, and the one whose diorama is on screen (or on its way). */
  private index = 0;
  private showing = -1;
  private rooms = new Map<string, Diorama>();
  private loading = new Map<string, Promise<Diorama | undefined>>();
  /** Which line of a many-lined thing is next. */
  private turns = new Map<string, number>();
  private el: HTMLElement;

  constructor(
    private ctx: IslandContext,
    private ui: UI,
    private pixels: PixelRenderer,
    private host: HTMLElement,
    private reducedMotion: boolean,
  ) {
    this.el = document.querySelector<HTMLElement>('[data-panel="trail"]')!;
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-chapter-step]')) {
      b.addEventListener('click', () => this.go(this.index + Number(b.dataset.chapterStep)));
    }
    // the pack stays open (or shut) as you walk the trail
    const pack = this.el.querySelector<HTMLElement>('.pack-card');
    const toggle = this.el.querySelector<HTMLElement>('.pack-toggle');
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-pack-toggle]')) {
      b.addEventListener('click', () => {
        if (!pack || !toggle) return;
        pack.hidden = !pack.hidden;
        toggle.setAttribute('aria-expanded', String(!pack.hidden));
        if (!pack.hidden) pack.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
        else toggle.focus({ preventScroll: true });
      });
    }
    window.addEventListener('keydown', (e) => {
      if (!this.open || (e.target as HTMLElement).closest('input, textarea, summary')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.go(this.index + (e.key === 'ArrowRight' ? 1 : -1));
      }
    });
  }

  /** Whether the pointer should drive a diorama rather than the island. */
  get wanted() {
    return this.want;
  }

  private get chapter(): Chapter {
    return chapters[this.index];
  }

  private get room(): Diorama | undefined {
    return this.showing < 0 ? undefined : this.rooms.get(chapters[this.showing].id);
  }

  /** Fetch a chapter's diorama ahead of time. */
  load(index = this.index) {
    const c = chapters[index];
    if (!c?.scene) return Promise.resolve(undefined);
    let p = this.loading.get(c.id);
    if (!p) {
      p = Diorama.load(c.id)
        .then((room) => {
          room.onSound = (name) => this.showingId === c.id && this.ctx.sound.here(name);
          this.rooms.set(c.id, room);
          this.resize();
          return room;
        })
        .catch((err) => {
          console.error(err);
          if (this.chapter === c) this.want = false; // it won't load: back out to the cairn
          return undefined;
        });
      this.loading.set(c.id, p);
    }
    return p;
  }

  /** The trail panel opened (or closed). `instant` skips the iris closing. */
  enter(open: boolean, instant = false) {
    this.open = open;
    this.show(instant);
  }

  /** Walk to a chapter (clamped to the trail); the card changes at once, the scene through the iris. */
  go(index: number, instant = false) {
    const next = Math.min(Math.max(index, 0), chapters.length - 1);
    if (next === this.index && this.open) return;
    this.index = next;
    if (this.open) history.replaceState(null, '', `/#trail/${this.chapter.id}`);
    this.show(instant);
  }

  /** Jump to a chapter by its id (from a link); unknown ids stay where they are. */
  goTo(id: string | undefined) {
    const i = chapters.findIndex((c) => c.id === id);
    if (i >= 0) this.index = i;
  }

  get chapterId() {
    return this.chapter.id;
  }

  private show(instant: boolean) {
    const c = this.chapter;
    for (const a of this.el.querySelectorAll<HTMLElement>('[data-chapter]')) a.hidden = a.dataset.chapter !== c.id;
    const count = this.el.querySelector('[data-chapter-count]');
    if (count) count.textContent = `${this.index + 1} / ${chapters.length}`;
    for (const b of this.el.querySelectorAll<HTMLButtonElement>('[data-chapter-step]')) {
      b.disabled = this.index + Number(b.dataset.chapterStep) < 0 || this.index + Number(b.dataset.chapterStep) >= chapters.length;
    }
    this.ui.tooltip(null);
    this.want = this.open && !!c.scene;
    if (this.want) {
      void this.load();
      void this.load(this.index + 1); // the next thing anyone does is walk on up
    }
    if (instant) this.fade = this.want === this.inside && !this.switching ? 0 : 1;
    if (this.open && !c.scene) {
      // no diorama yet: the camera finds this chapter's cairn on the island
      const pos = this.ctx.island.positionOf(`cairn_${this.index}`) ?? this.ctx.island.positionOf('summit');
      const wide = innerWidth > 900;
      if (pos) this.ctx.rig.focus(pos, 16, wide ? -Math.min(420, innerWidth * 0.35) / 2 : 0, this.reducedMotion);
    }
  }

  /** On the way from one diorama to another, behind the iris. */
  private get switching() {
    return this.want && this.inside && this.showing !== this.index;
  }

  /** The chapter whose diorama you're in, if you're in one (the island plays its place). */
  get showingId(): string | null {
    return this.inside && this.showing >= 0 ? chapters[this.showing].id : null;
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    // the banner along the top, the card down the left (or along the bottom on a phone)
    const free = w > 760
      ? { x: Math.min(420, w * 0.4), y: 84, w: w - Math.min(420, w * 0.4) - 16, h: h - 100 }
      : { x: 8, y: 100, w: w - 16, h: h * 0.5 - 100 };
    for (const room of this.rooms.values()) room.frame(w, h, free);
  }

  zoom(factor: number, ndc: THREE.Vector2) {
    this.room?.view.zoomBy(factor, ndc);
  }

  pan(dxPx: number, dyPx: number) {
    this.room?.view.pan(dxPx, dyPx);
  }

  private thingAt(ndc: THREE.Vector2 | null) {
    const room = this.room;
    if (!room || !this.inside || this.switching || !ndc) return null;
    const hit = room.picker.pick(ndc);
    const thing = hit && chapters[this.showing].things?.[hit.id];
    return hit && thing ? { id: hit.id, point: hit.point, thing } : null;
  }

  hover(ndc: THREE.Vector2 | null, client: { x: number; y: number }) {
    const hit = this.thingAt(ndc);
    this.room?.picker.highlight(hit ? (this.room.named.get(hit.id) ?? null) : null);
    this.host.querySelector('canvas')!.style.cursor = hit ? 'pointer' : '';
    this.ui.tooltip(hit?.thing.label ?? null, client.x, client.y);
  }

  click(ndc: THREE.Vector2) {
    const hit = this.thingAt(ndc);
    if (!hit) return;
    this.ui.tooltip(null);
    if (hit.thing.zoom) this.room?.view.focus(hit.point, hit.thing.zoom, this.reducedMotion);
    const sound = hit.thing.sound;
    if (sound === 'baa') this.ctx.sound.baa();
    else if (sound) this.ctx.sound.here(sound);
    this.say(hit.id, hit.thing);
  }

  private say(id: string, thing: Thing) {
    let text = thing.text;
    if (Array.isArray(text)) {
      const turn = this.turns.get(id) ?? 0;
      this.turns.set(id, (turn + 1) % text.length);
      text = text[turn];
    }
    const read = thing.read;
    if (read) this.ctx.ask(text, [{ label: read.label, pick: () => this.ctx.openArticle(read.slug) }, { label: 'Later' }]);
    else this.ctx.toast(text);
  }

  /** Run the iris and, once inside, the diorama. `night` is 0 (day) … 1 (night) outside. */
  update(dt: number, night: number) {
    const step = this.reducedMotion ? 1 : dt / FADE;
    if (this.want !== this.inside || this.switching) {
      this.fade = Math.min(1, this.fade + step);
      // wait behind the closed iris until the diorama has loaded (or turned out not to)
      const ready = !this.want || this.rooms.has(this.chapter.id);
      if (this.fade >= 1 && ready) this.swap();
    } else {
      this.fade = Math.max(0, this.fade - step);
    }
    this.pixels.uniforms.uFade.value = this.fade;
    if (this.inside && this.room) {
      this.room.view.step(dt); // gliding in to something (the laptop's screen)
      this.room.update(this.reducedMotion ? 0 : dt, night);
    }
  }

  render() {
    const u = this.pixels.uniforms;
    u.uGrade.value.set(1.02, 1.0, 1.0);
    u.uTone.value = u.uVignette.value = 0; // the island's light stays outside
    u.uHeat.value = 0;
    this.pixels.render(this.room!.scene, this.room!.camera, NO_SHIFT);
  }

  private swap() {
    this.room?.picker.highlight(null);
    this.inside = this.want;
    this.ctx.sound.indoors = false;
    if (this.inside) {
      this.ctx.sound.chime('cairn');
      this.showing = this.index;
      this.ctx.rig.room = this;
      this.room?.view.reset();
      this.resize();
    } else {
      this.showing = -1;
      if (this.ctx.rig.room === this) this.ctx.rig.room = null;
    }
  }
}
