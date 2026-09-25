/**
 * Stepping into the lighthouse: the island dithers shut and the keeper's quarters dither open.
 * Like the workshop there's no side panel, just a banner: everything in here explains itself
 * when you point at it.
 */
import * as THREE from 'three';
import { type IslandContext, labelFor, lighthousePlaceFor } from './content';
import type { RoomInput } from './scene/camera-rig';
import type { PixelRenderer } from './scene/pixel-renderer';
import { QuartersRoom } from './scene/quarters';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
const NO_SHIFT = new THREE.Vector2();

export class Lighthouse implements RoomInput {
  /** Whether the room (rather than the island) is on screen. */
  inside = false;
  private want = false;
  private fade = 0;
  private room?: QuartersRoom;
  private loading?: Promise<QuartersRoom | undefined>;

  constructor(
    private ctx: IslandContext,
    private ui: UI,
    private pixels: PixelRenderer,
    private host: HTMLElement,
    private reducedMotion: boolean,
  ) {}

  /** Whether the pointer should drive the room rather than the island. */
  get wanted() {
    return this.want;
  }

  /** Fetch the room ahead of time, so the door opens without a wait. */
  load() {
    this.loading ??= QuartersRoom.load()
      .then((room) => {
        this.room = room;
        this.resize();
        return room;
      })
      .catch((err) => {
        console.error(err);
        return undefined;
      });
    return this.loading;
  }

  /** Go in (or out). `instant` skips the iris closing, e.g. coming straight from another room. */
  enter(inside: boolean, instant = false) {
    if (inside) void this.load();
    this.want = inside;
    if (instant) this.fade = inside === this.inside ? 0 : 1;
    this.ui.tooltip(null);
  }

  resize() {
    if (!this.room) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    // the banner along the top; the room gets the rest
    this.room.frame(w, h, w > 760 ? { x: 16, y: 84, w: w - 32, h: h - 110 } : { x: 8, y: 100, w: w - 16, h: h - 150 });
  }

  zoom(factor: number, ndc: THREE.Vector2) {
    this.room?.view.zoomBy(factor, ndc);
  }

  pan(dxPx: number, dyPx: number) {
    this.room?.view.pan(dxPx, dyPx);
  }

  hover(ndc: THREE.Vector2 | null, client: { x: number; y: number }) {
    const room = this.room;
    if (!room || !this.inside) return;
    const hit = ndc && room.picker.pick(ndc);
    const place = hit ? lighthousePlaceFor(hit.id) : undefined;
    const book = hit?.id.startsWith('read:') ? hit.id : null;
    room.setHot(book);
    room.picker.highlight(place && hit && !book ? (room.named.get(hit.id) ?? null) : null);
    this.host.querySelector('canvas')!.style.cursor = place ? 'pointer' : '';
    this.ui.tooltip(place ? labelFor(place, this.ctx) : null, client.x, client.y);
  }

  click(ndc: THREE.Vector2) {
    const room = this.room;
    if (!room || !this.inside) return;
    const hit = room.picker.pick(ndc);
    const place = hit ? lighthousePlaceFor(hit.id) : undefined;
    if (!hit || !place) return;
    this.ui.tooltip(null);
    place.activate?.(this.ctx, hit.point);
  }

  /** Run the iris and, once inside, the room. `night` is 0 (day) … 1 (night) outside. */
  update(dt: number, night: number) {
    const step = this.reducedMotion ? 1 : dt / FADE;
    if (this.want !== this.inside) {
      this.fade = Math.min(1, this.fade + step);
      // wait behind the closed iris until the room has loaded
      if (this.fade >= 1 && (!this.want || this.room)) this.swap();
    } else {
      this.fade = Math.max(0, this.fade - step);
    }
    this.pixels.uniforms.uFade.value = this.fade;
    if (this.inside && this.room) this.room.update(this.reducedMotion ? 0 : dt, night);
  }

  render() {
    const u = this.pixels.uniforms;
    u.uGrade.value.set(1.05, 1.03, 1.0); // indoors, whatever the weather is doing outside
    u.uHeat.value = 0;
    this.pixels.render(this.room!.scene, this.room!.camera, NO_SHIFT);
  }

  private swap() {
    this.inside = this.want;
    this.ctx.sound.indoors = this.inside;
    if (this.inside) {
      this.ctx.rig.room = this;
      this.room?.view.reset();
      this.resize();
    } else {
      if (this.ctx.rig.room === this) this.ctx.rig.room = null;
      this.room?.setHot(null);
      this.room?.picker.highlight(null);
    }
  }
}
