/**
 * Stepping into the library: the island dithers shut, the room inside dithers open, and the
 * card catalogue sits beside it. This owns the room while you're in it: framing it next to the
 * panel, the year plates on the shelves, and what happens when you point at things.
 */
import * as THREE from 'three';
import type { BookInfo } from '../data/subjects';
import { Catalogue } from './catalogue';
import { type IslandContext, labelFor, libraryPlaceFor, togglePiano } from './content';
import { Interior } from './scene/interior';
import type { RoomInput } from './scene/camera-rig';
import type { PixelRenderer } from './scene/pixel-renderer';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
const PEEK = 84; // px of the catalogue sheet left showing when it's folded down (small screens)
const narrow = () => innerWidth <= 760;
const NO_SHIFT = new THREE.Vector2();
const month = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

export class Library implements RoomInput {
  /** Whether the room (rather than the island) is on screen. */
  inside = false;
  private want = false;
  private fade = 0;
  private interior?: Interior;
  private loading?: Promise<Interior | undefined>;
  private books: BookInfo[];
  private catalogue: Catalogue;
  private plates = document.getElementById('plates')!;
  private filter: Set<string> | null = null;
  private panel: HTMLElement;
  private sheetHeight = 0; // the sheet's height when the room was last framed

  constructor(
    private ctx: IslandContext,
    private ui: UI,
    private pixels: PixelRenderer,
    private host: HTMLElement,
    private reducedMotion: boolean,
  ) {
    this.books = JSON.parse(document.getElementById('library-books')?.textContent ?? '[]');
    const panel = (this.panel = document.querySelector<HTMLElement>('[data-panel="library"]')!);
    this.grip(panel.querySelector<HTMLElement>('[data-grip]')!);
    this.catalogue = new Catalogue(panel, {
      hot: (slug) => this.interior?.setHot(slug),
      filter: (slugs) => {
        this.filter = slugs;
        this.interior?.setFilter(slugs);
      },
      piano: (id) => togglePiano(ctx, id),
    });
    ctx.sound.onPiano = (piece) => this.catalogue.setPlaying(piece?.id ?? null);
  }

  /** Whether the pointer should drive the room rather than the island. */
  get wanted() {
    return this.want;
  }

  /** Fetch the room ahead of time, so the door opens without a wait. */
  load() {
    this.loading ??= Interior.load(this.books)
      .then((interior) => {
        this.interior = interior;
        this.ctx.interior = interior;
        interior.setFilter(this.filter);
        this.makePlates();
        this.resize();
        return interior;
      })
      .catch((err) => {
        console.error(err);
        return undefined;
      });
    return this.loading;
  }

  /** Go in (or out). `instant` skips the iris, e.g. when the page loads on a post. */
  enter(inside: boolean, instant = false) {
    if (inside) void this.load();
    this.want = inside;
    if (instant) this.fade = inside === this.inside ? 0 : 1;
    this.ui.tooltip(null);
  }

  resize() {
    if (!this.interior) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!narrow()) this.panel.style.height = ''; // the sheet's handle only exists on small screens
    this.sheetHeight = this.panel.offsetHeight;
    this.interior.frame(w, h, this.freeArea(w, h));
    this.pinPlates();
  }

  /** Pinch, scroll or drag: look closer at the shelves. */
  zoom(factor: number, ndc: THREE.Vector2) {
    this.interior?.view.zoomBy(factor, ndc);
    this.pinPlates();
  }

  pan(dxPx: number, dyPx: number) {
    this.interior?.view.pan(dxPx, dyPx);
    this.pinPlates();
  }

  /** Keep each year plate on the end of its shelf. */
  private pinPlates() {
    if (!this.interior) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    for (const [i, plate] of this.interior.plates.entries()) {
      const el = this.plates.children[i] as HTMLElement;
      const { x, y } = this.interior.project(plate.at, w, h);
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
    }
  }

  hover(ndc: THREE.Vector2 | null, client: { x: number; y: number }) {
    const room = this.interior;
    if (!room || !this.inside) return;
    const hit = ndc && room.picker.pick(ndc);
    const canvas = this.host.querySelector('canvas')!;
    const slug = hit?.id.startsWith('book:') ? hit.id.slice(5) : null;
    const place = hit && !slug ? libraryPlaceFor(hit.id) : undefined;
    room.setHot(slug);
    room.setHotPin(hit?.id.startsWith('pin:') ? hit.id : null);
    this.catalogue.markHot(slug);
    room.picker.highlight(place && hit ? (room.named.get(hit.id) ?? null) : null);
    canvas.style.cursor = slug || place ? 'pointer' : '';
    const book = slug && this.books.find((b) => b.slug === slug);
    this.ui.tooltip(book ? `${book.title} · ${month(book.date)}` : place ? labelFor(place, this.ctx) : null, client.x, client.y);
  }

  click(ndc: THREE.Vector2) {
    const room = this.interior;
    if (!room || !this.inside) return;
    const hit = room.picker.pick(ndc);
    if (!hit) return;
    this.ui.tooltip(null);
    if (hit.id.startsWith('book:')) this.ctx.openArticle(hit.id.slice(5));
    else libraryPlaceFor(hit.id)?.activate?.(this.ctx, hit.point);
  }

  /** Run the iris and, once inside, the room. `night` is 0 (day) … 1 (night) outside. */
  update(dt: number, night: number) {
    const step = this.reducedMotion ? 1 : dt / FADE;
    if (this.want !== this.inside) {
      this.fade = Math.min(1, this.fade + step);
      // wait behind the closed iris until the room has loaded
      if (this.fade >= 1 && (!this.want || this.interior)) this.swap();
    } else {
      this.fade = Math.max(0, this.fade - step);
    }
    this.pixels.uniforms.uFade.value = this.fade;
    this.plates.hidden = !this.inside || this.fade > 0.3;
    // the sheet was dragged or snapped: the room fills whatever it leaves free
    if (this.inside && narrow() && this.panel.offsetHeight !== this.sheetHeight) this.resize();
    if (this.inside && this.interior) {
      if (this.interior.view.step(dt)) this.pinPlates(); // gliding in to something (the globe)
      this.interior.playing = this.ctx.sound.pianoPiece !== null;
      this.interior.update(dt, night);
    }
  }

  render() {
    const u = this.pixels.uniforms;
    u.uGrade.value.set(1.06, 1.04, 1.0); // indoors, whatever the weather is doing outside
    u.uTone.value = u.uVignette.value = 0; // the island's light stays outside
    u.uHeat.value = 0;
    this.pixels.render(this.interior!.scene, this.interior!.camera, NO_SHIFT);
  }

  private swap() {
    this.inside = this.want;
    this.ctx.sound.indoors = this.inside;
    if (this.inside) {
      this.ctx.rig.room = this;
      this.interior?.view.reset();
      this.resize();
    } else {
      if (this.ctx.rig.room === this) this.ctx.rig.room = null;
      this.ctx.sound.stopPiano();
      this.interior?.setHot(null);
      this.interior?.picker.highlight(null);
    }
  }

  /** The part of the canvas the panel leaves free for the room (CSS pixels). */
  private freeArea(w: number, h: number) {
    if (w > 760) {
      const panel = Math.min(540, w * 0.44) + 16;
      return { x: 12, y: 56, w: w - panel - 36, h: h - 70 };
    }
    // small screens: the catalogue is a sheet over the bottom of the screen
    const sheet = this.panel.hidden ? 0 : this.panel.offsetHeight + 8;
    return { x: 8, y: 52, w: w - 16, h: Math.max(80, h - sheet - 60) };
  }

  /**
   * On small screens the catalogue sheet has a handle: drag it down to see more of the room or
   * up to read more; let go and it settles on the nearest of folded, half and tall. A tap folds
   * it down or brings it back.
   */
  private grip(handle: HTMLElement) {
    const panel = this.panel;
    const stops = () => [PEEK, innerHeight * 0.58, this.host.clientHeight - 60];
    let start: { y: number; height: number } | null = null;
    let moved = 0;
    handle.addEventListener('pointerdown', (e) => {
      handle.setPointerCapture(e.pointerId);
      start = { y: e.clientY, height: panel.offsetHeight };
      moved = 0;
      panel.classList.add('dragging');
    });
    handle.addEventListener('pointermove', (e) => {
      if (!start) return;
      moved = Math.max(moved, Math.abs(e.clientY - start.y));
      const [low, , high] = stops();
      panel.style.height = `${THREE.MathUtils.clamp(start.height - (e.clientY - start.y), low, high)}px`;
    });
    const settle = () => {
      if (!start) return;
      const height = panel.offsetHeight;
      const [low, half] = stops();
      const to = moved < 6
        ? (height > low + 1 ? low : half)
        : stops().reduce((best, s) => (Math.abs(s - height) < Math.abs(best - height) ? s : best));
      panel.style.height = `${Math.round(to)}px`;
      if (to === low) panel.scrollTop = 0;
      panel.classList.remove('dragging');
      start = null;
    };
    handle.addEventListener('pointerup', settle);
    handle.addEventListener('pointercancel', settle);
    // tapping handles itself; keep the keyboard working too
    handle.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      const [low, half] = stops();
      panel.style.height = `${Math.round(panel.offsetHeight > low + 1 ? low : half)}px`;
    });
  }

  /** A brass plate with the year on the end of every shelf; clicking it opens that drawer. */
  private makePlates() {
    this.plates.replaceChildren(
      ...this.interior!.plates.map((p) => {
        const el = document.createElement('button');
        el.className = 'plate';
        el.textContent = p.label;
        el.tabIndex = -1;
        el.addEventListener('click', () => {
          const drawer = document.querySelector(`[data-year="${p.year}"]`);
          drawer?.scrollIntoView({ block: 'start', behavior: this.reducedMotion ? 'auto' : 'smooth' });
        });
        return el;
      }),
    );
  }
}
