/**
 * Stepping into the lighthouse: the island dithers shut and the keeper's quarters dither open.
 * Like the workshop there's no side panel, just a banner: everything in here explains itself
 * when you point at it. The stairs climb (through the same iris) to the lamp room at the top.
 */
import * as THREE from 'three';
import { type IslandContext, labelFor, lighthousePlaceFor } from './content';
import type { RoomInput } from './scene/camera-rig';
import type { PixelRenderer } from './scene/pixel-renderer';
import { LampRoom } from './scene/lamp-room';
import { QuartersRoom } from './scene/quarters';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
const NO_SHIFT = new THREE.Vector2();
const BANNER = {
  quarters: 'The keeper\'s quarters. The coffee\'s on and the console\'s plugged in.',
  lamp: 'The lamp room, at the top of the tower. Mind the lens.',
};

/** The quarters when it's raining and the animals have come in. */
const RAINY = 'The keeper\'s quarters. Rain on the windows, the cats on the sofa, a damp dog on the rug.';

export type Floor = keyof typeof BANNER;
type Room = QuartersRoom | LampRoom;

export class Lighthouse implements RoomInput {
  /** Whether the room (rather than the island) is on screen. */
  inside = false;
  private want = false;
  private fade = 0;
  /** Which floor is on screen, and which one the iris is heading for. */
  private floor: Floor = 'quarters';
  private wantFloor: Floor = 'quarters';
  private rooms: { quarters?: QuartersRoom; lamp?: LampRoom } = {};
  private loading: { quarters?: Promise<Room | undefined>; lamp?: Promise<Room | undefined> } = {};

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

  private get room(): Room | undefined {
    return this.rooms[this.floor];
  }

  /** Fetch a floor ahead of time, so the door (or the hatch) opens without a wait. */
  load(floor: Floor = 'quarters') {
    this.loading[floor] ??= (floor === 'lamp' ? LampRoom.load() : QuartersRoom.load())
      .then((room) => {
        (this.rooms as Record<Floor, Room>)[floor] = room;
        if (room instanceof QuartersRoom) room.onMew = () => this.ctx.sound.call('mew');
        this.resize();
        return room;
      })
      .catch((err) => {
        console.error(err);
        return undefined;
      });
    return this.loading[floor];
  }

  /** Go in (or out). `instant` skips the iris closing, e.g. coming straight from another room. */
  enter(inside: boolean, instant = false) {
    if (inside) void this.load();
    if (inside && !this.inside) this.wantFloor = 'quarters'; // in through the front door, at the bottom
    this.want = inside;
    if (instant) this.fade = inside === this.inside ? 0 : 1;
    this.ui.tooltip(null);
  }

  /** Halfway up (or down) the stair, behind the iris: nothing to point at. */
  private get climbing() {
    return this.wantFloor !== this.floor;
  }

  /** Up (or down) the spiral stair: the iris closes on one floor and opens on the other. */
  climb(to: Floor) {
    // if the floor won't load, the iris opens again on the one you're on
    void this.load(to).then((room) => {
      if (!room) this.wantFloor = this.floor;
    });
    this.wantFloor = to;
    this.ui.tooltip(null);
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    // the banner along the top; the room gets the rest
    const free = w > 760 ? { x: 16, y: 84, w: w - 32, h: h - 110 } : { x: 8, y: 100, w: w - 16, h: h - 150 };
    for (const room of Object.values(this.rooms)) room?.frame(w, h, free);
  }

  zoom(factor: number, ndc: THREE.Vector2) {
    this.room?.view.zoomBy(factor, ndc);
  }

  pan(dxPx: number, dyPx: number) {
    this.room?.view.pan(dxPx, dyPx);
  }

  hover(ndc: THREE.Vector2 | null, client: { x: number; y: number }) {
    const room = this.room;
    if (!room || !this.inside || this.climbing) return;
    const hit = ndc && room.picker.pick(ndc);
    const place = hit ? lighthousePlaceFor(hit.id, this.floor) : undefined;
    const book = hit?.id.startsWith('read:') ? hit.id : null;
    room.setHot(book);
    room.picker.highlight(place && hit && !book ? (room.named.get(hit.id) ?? null) : null);
    this.host.querySelector('canvas')!.style.cursor = place ? 'pointer' : '';
    this.ui.tooltip(place ? labelFor(place, this.ctx) : null, client.x, client.y);
  }

  click(ndc: THREE.Vector2) {
    const room = this.room;
    if (!room || !this.inside || this.climbing) return;
    const hit = room.picker.pick(ndc);
    const place = hit ? lighthousePlaceFor(hit.id, this.floor) : undefined;
    if (!hit || !place) return;
    this.ui.tooltip(null);
    if (hit.id === 'stairs') return this.climb(this.floor === 'lamp' ? 'quarters' : 'lamp');
    if (room instanceof QuartersRoom) room.guests.pet(hit.id, hit.point);
    if (room instanceof QuartersRoom && hit.id === 'tap') room.tap();
    place.activate?.(this.ctx, hit.point);
  }

  /** Run the iris and, once inside, the room. `night` is 0 (day) … 1 (night) outside. */
  update(dt: number, night: number) {
    const step = this.reducedMotion ? 1 : dt / FADE;
    if (this.want !== this.inside || (this.inside && this.climbing)) {
      this.fade = Math.min(1, this.fade + step);
      // wait behind the closed iris until the room has loaded
      if (this.fade >= 1 && (!this.want || this.rooms[this.wantFloor])) this.swap();
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
    if (this.inside) this.leaveFloor();
    this.inside = this.want;
    this.ctx.sound.indoors = this.inside;
    if (this.inside) {
      this.floor = this.wantFloor;
      const banner = document.querySelector('[data-panel="lighthouse"] .workshop-banner p');
      const rainy = this.room instanceof QuartersRoom && this.room.guests.anyone;
      if (banner) banner.textContent = rainy ? RAINY : BANNER[this.floor];
      if (this.floor === 'quarters') void this.load('lamp'); // the next thing anyone does is climb
      this.ctx.rig.room = this;
      this.room?.view.reset();
      this.resize();
    } else if (this.ctx.rig.room === this) {
      this.ctx.rig.room = null;
    }
  }

  private leaveFloor() {
    this.room?.setHot(null);
    this.room?.picker.highlight(null);
  }
}
