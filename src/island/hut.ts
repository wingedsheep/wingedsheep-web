/**
 * Stepping into the mountain hut: the island dithers shut and the room under the gable dithers
 * open. Like the lighthouse there's no side panel, just a banner: everything in here explains
 * itself when you point at it.
 */
import * as THREE from 'three';
import { type IslandContext, HUT_PLACES, labelFor } from './content';
import type { RoomInput } from './scene/camera-rig';
import { HutRoom } from './scene/hut-room';
import type { PixelRenderer } from './scene/pixel-renderer';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
const NO_SHIFT = new THREE.Vector2();
const BANNER = 'Nearly at the top. The stove\'s lit, the soup\'s on, and there\'s a bed made up in the corner.';
/** When it's raining and the dock cat has come all the way up to get out of it. */
const RAINY = 'Nearly at the top. Rain on the roof, the stove\'s lit, and someone has already taken the bed.';

export class Hut implements RoomInput {
  /** Whether the room (rather than the island) is on screen. */
  inside = false;
  private want = false;
  private fade = 0;
  private room?: HutRoom;
  private loading?: Promise<HutRoom | undefined>;

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
    this.loading ??= HutRoom.load()
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
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    // the banner along the top; the room gets the rest
    const free = w > 760 ? { x: 16, y: 84, w: w - 32, h: h - 110 } : { x: 8, y: 100, w: w - 16, h: h - 150 };
    this.room?.frame(w, h, free);
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
    const place = hit ? HUT_PLACES[hit.id] : undefined;
    room.picker.highlight(place && hit ? (room.named.get(hit.id) ?? null) : null);
    this.host.querySelector('canvas')!.style.cursor = place ? 'pointer' : '';
    this.ui.tooltip(place ? labelFor(place, this.ctx) : null, client.x, client.y);
  }

  click(ndc: THREE.Vector2) {
    const room = this.room;
    if (!room || !this.inside) return;
    const hit = room.picker.pick(ndc);
    const place = hit ? HUT_PLACES[hit.id] : undefined;
    if (!hit || !place) return;
    this.ui.tooltip(null);
    room.guests.pet(hit.id, hit.point);
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
    if (this.inside && this.room) this.room.update(this.reducedMotion ? 0 : dt, night, this.ctx.weather.now);
  }

  render() {
    const u = this.pixels.uniforms;
    u.uGrade.value.set(1.05, 1.03, 1.0); // indoors, whatever the weather is doing outside
    u.uTone.value = u.uVignette.value = 0; // the island's light stays outside
    u.uHeat.value = 0;
    this.pixels.render(this.room!.scene, this.room!.camera, NO_SHIFT);
  }

  private swap() {
    this.room?.picker.highlight(null);
    this.inside = this.want;
    this.ctx.sound.indoors = this.inside;
    if (this.inside) {
      const banner = document.querySelector('[data-panel="hut"] .workshop-banner p');
      if (banner) banner.textContent = this.room?.guests.anyone ? RAINY : BANNER;
      this.ctx.rig.room = this;
      this.room?.view.reset();
      this.resize();
    } else if (this.ctx.rig.room === this) {
      this.ctx.rig.room = null;
    }
  }
}
