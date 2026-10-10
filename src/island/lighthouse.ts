/**
 * Stepping into the lighthouse: the island dithers shut and the keeper's quarters dither open.
 * Like the workshop there's no side panel, just a banner: everything in here explains itself
 * when you point at it. The stairs climb (through the same iris) to the lamp room at the top.
 */
import * as THREE from 'three';
import { type IslandContext, labelFor, lighthousePlaceFor, placeFor } from './content';
import type { RoomInput } from './scene/camera-rig';
import type { Picker } from './scene/picking';
import type { PixelRenderer } from './scene/pixel-renderer';
import { LampRoom } from './scene/lamp-room';
import { type Show, telly } from './scene/companion';
import { QuartersRoom } from './scene/quarters';
import { indoors } from './scene/shelter';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
const NO_SHIFT = new THREE.Vector2();
/**
 * Tails of Power, the cat fantasy trailer, on the telly: no controls (a click on the screen, or
 * space, pauses it), and the API on so it can say when it's paused or finished.
 */
const FILM_ORIGIN = 'https://www.youtube-nocookie.com';
const FILM = `${FILM_ORIGIN}/embed/nbV7pH5wCPI?autoplay=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&rel=0&playsinline=1&enablejsapi=1`;
const FILM_ASPECT = 16 / 9;
/**
 * The telescope: the eye at the lamp, about ten metres up the tower, and how much of the world
 * it takes in (metres top to bottom; the wheel zooms it). It looks at Radio Alles, a few metres
 * up her mast, and the camera stands well back along that line, seeing from the lamp on (the
 * tower itself is out of the picture while you look). Zoomed out, the bottom of the view keeps
 * `floor` metres above the tower's foot where it passes the lamp, or it would look up through
 * the rock.
 */
const EYE = 10.2;
const SPY = { view: 13, min: 5, max: 34, aim: 3.2, back: 80, low: -0.6, high: 0.15, floor: 2 };
const BANNER = {
  quarters: 'The keeper\'s quarters. The coffee\'s on and the console\'s plugged in.',
  lamp: 'The lamp room, at the top of the tower. Mind the lens.',
};

/** The quarters when it's raining and the animals have come in. */
const RAINY = 'The keeper\'s quarters. Rain on the windows, the cats on the sofa, a damp dog on the rug.';

/** The quarters when the cats are only in for a visit, and it's dry out. */
const VISIT = 'The keeper\'s quarters. The cats are in for a visit, and keeping an eye on the bowls.';

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
  /** The film's player (IslandShell.astro), laid over the telly's screen while it's on. */
  private film = document.querySelector<HTMLElement>('[data-film]');
  private screen?: NonNullable<QuartersRoom['tellyScreen']>;
  /** The film's player state, as YouTube last reported it (2 paused, 0 ended). */
  private playerState = -1;
  /** Looking through the telescope: its brass ring (IslandShell.astro), and its view of the island. */
  private spyglass = document.querySelector<HTMLElement>('[data-spyglass]');
  /**
   * `yaw` and `pitch` are where it's pointing (radians: round from +x, and up from level); it
   * follows the boat until you take hold of it and swing it round yourself.
   */
  private spy?: { camera: THREE.OrthographicCamera; view: number; clock: number; yaw: number; pitch: number; follow: boolean };

  constructor(
    private ctx: IslandContext,
    private ui: UI,
    private pixels: PixelRenderer,
    private host: HTMLElement,
    private reducedMotion: boolean,
    private island: THREE.Scene,
    /** The island's own picker: through the telescope you can spot things out there. */
    private outdoors: Picker,
  ) {
    this.spyglass?.querySelector('[data-spyglass-off]')?.addEventListener('click', () => this.stepBack());
    window.addEventListener('keydown', (e) => {
      if (!this.spy) return;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [0.06, 0], ArrowRight: [-0.06, 0], ArrowUp: [0, 0.04], ArrowDown: [0, -0.04] };
      if (e.key !== 'Escape' && !arrows[e.key]) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === 'Escape') return this.stepBack();
      const [yaw, pitch] = arrows[e.key];
      this.swing(yaw * (this.spy.view / SPY.view), pitch * (this.spy.view / SPY.view));
    }, true);
    this.film?.querySelector('[data-film-off]')?.addEventListener('click', () => this.switchOff());
    this.film?.querySelector('[data-film-screen]')?.addEventListener('click', () => this.pause());
    // Escape turns the telly off first, and only then leaves; space pauses
    window.addEventListener('keydown', (e) => {
      if (!telly.film || (e.key !== 'Escape' && e.key !== ' ')) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === ' ') this.pause();
      else this.switchOff();
    }, true);
    // the player says how it's getting on; when the film's over, the telly goes off by itself
    window.addEventListener('message', (e) => {
      if (e.origin !== FILM_ORIGIN || !telly.film || typeof e.data !== 'string') return;
      let msg: { event?: string; info?: unknown };
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      const state = msg.event === 'onStateChange' ? msg.info
        : msg.event === 'infoDelivery' ? (msg.info as { playerState?: number } | null)?.playerState : undefined;
      if (typeof state !== 'number') return;
      this.playerState = state;
      if (state === 0) this.switchOff();
    });
  }

  /** Whether the pointer should drive the room rather than the island. */
  get wanted() {
    return this.want;
  }

  /** The floor you're on, 'quarters' or 'lamp' (the sound of each is its own). */
  get storey(): Floor {
    return this.floor;
  }

  /** Whether you're in with Vincent while he's typing away at his desk. */
  get typing() {
    return this.inside && this.floor === 'quarters' && !!this.rooms.quarters?.typing;
  }

  /** What's on the telly, if you're in the room with it and she's in watching it. */
  get programme(): Show | null {
    return this.inside && this.floor === 'quarters' && indoors.has('companion_lighthouse') && !telly.film ? telly.show : null;
  }

  /** Put the film on: the view turns to face the telly, with the room still round it. */
  watch() {
    const room = this.rooms.quarters;
    const screen = room?.tellyScreen;
    const el = this.film;
    if (!room || !screen || !el || !this.inside || this.floor !== 'quarters') return;
    this.screen = screen;
    telly.film = room.film = true;
    const size = new THREE.Vector2(screen.tl.distanceTo(screen.tr), screen.tl.distanceTo(screen.bl));
    // aimed a little above the screen's middle: the telly's top shows more than its knobs do
    const aim = screen.middle.clone().addScaledVector(screen.tl.clone().sub(screen.bl), 0.2);
    room.view.sit(aim, screen.normal, size, this.reducedMotion);
    const player = document.createElement('iframe');
    player.src = FILM;
    player.title = 'Tails of Power';
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.tabIndex = -1;
    this.playerState = -1;
    player.addEventListener('load', () => this.tellPlayer({ event: 'listening' }));
    el.querySelector('[data-film-screen]')!.replaceChildren(player);
    el.hidden = false;
    this.pinFilm();
    this.ctx.sound.film = true;
    this.ctx.sound.stopAlbum(); // the Walkman pauses for the film
    this.ui.tooltip(null);
  }

  /** Eye to the telescope: the lamp room gives way to the island, out over the water. */
  lookThrough() {
    if (!this.inside || this.floor !== 'lamp' || !this.spyglass) return;
    this.spy ??= { camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200), view: SPY.view, clock: 0, yaw: 0, pitch: 0, follow: true };
    Object.assign(this.spy, { view: SPY.view, follow: true });
    this.spyglass.hidden = false;
    this.ui.tooltip(null);
    this.host.querySelector('canvas')!.style.cursor = '';
    this.resize();
  }

  /** And back from it, into the room. */
  stepBack() {
    if (!this.spy) return;
    this.spy = undefined;
    if (this.spyglass) this.spyglass.hidden = true;
    this.outdoors.highlight(null);
    this.ui.tooltip(null);
    this.host.querySelector('canvas')!.style.cursor = '';
  }

  /** Swing the telescope round (drag, or the arrow keys): it lets go of the boat and stays where you put it. */
  private swing(dYaw: number, dPitch: number) {
    const spy = this.spy!;
    spy.follow = false;
    spy.yaw += dYaw;
    spy.pitch = THREE.MathUtils.clamp(spy.pitch + dPitch, SPY.low, SPY.high);
  }

  /**
   * Point the telescope: on her as she rides at anchor until you've swung it yourself, focused
   * as far off as she is, with a little shake from the hand on it.
   */
  private aim() {
    const spy = this.spy!;
    const ship = this.ctx.life.sightings.radioShip;
    const foot = this.ctx.island.positionOf('lighthouse');
    if (!ship || !foot) return false;
    const eye = foot.clone().add(new THREE.Vector3(0, EYE, 0));
    const boat = ship.clone().add(new THREE.Vector3(0, SPY.aim, 0)).sub(eye);
    const reach = boat.length();
    if (spy.follow) {
      spy.yaw = Math.atan2(-boat.z, boat.x);
      spy.pitch = Math.asin(boat.y / reach);
    }
    const c = spy.clock;
    const along = new THREE.Vector3(Math.cos(spy.pitch) * Math.cos(spy.yaw), Math.sin(spy.pitch), -Math.cos(spy.pitch) * Math.sin(spy.yaw));
    const target = eye.clone().addScaledVector(along, reach)
      .add(new THREE.Vector3(Math.sin(c * 1.3) * 0.06, Math.sin(c * 0.9) * 0.05, Math.cos(c * 1.1) * 0.06));
    const cam = spy.camera;
    cam.position.copy(target).addScaledVector(along, -SPY.back);
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
    cam.near = SPY.back - reach + 0.5; // from the lamp on
    // wide, it lifts so that the bottom edge clears the ground where it passes the lamp
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const low = eye.y + Math.sin(spy.pitch) * 0.5 - (up.y * spy.view) / 2;
    const floor = foot.y + SPY.floor;
    if (low < floor) cam.position.addScaledVector(up, (floor - low) / up.y);
    const aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight);
    Object.assign(cam, { top: spy.view / 2, bottom: -spy.view / 2, left: (-spy.view / 2) * aspect, right: (spy.view / 2) * aspect });
    cam.updateProjectionMatrix();
    return true;
  }

  /**
   * Something out there, through the telescope: what it is, and whatever it does when you click
   * it from close by (the places you'd walk into stay where they are). A click off the lens, on
   * the brass and the dark round it, takes your eye away.
   */
  private spot(ndc: THREE.Vector2) {
    if (!this.inLens(ndc)) return this.stepBack();
    const hit = this.pickOut(ndc);
    const place = hit ? placeFor(hit.id) : undefined;
    if (!hit || !place?.activate) return;
    this.ui.tooltip(null);
    place.activate(this.ctx, hit.point);
  }

  /** The named thing out there under the pointer, if it's in the lens. */
  private pickOut(ndc: THREE.Vector2) {
    const camera = this.spy?.camera;
    if (!camera || !this.inLens(ndc)) return null;
    return this.withoutTower(() => this.outdoors.pick(ndc, camera));
  }

  /** Whether a point on the canvas is inside the brass ring (.spyglass in global.css: min(40vh, 40vw) round 50%, 52%). */
  private inLens(ndc: THREE.Vector2) {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const r = 0.4 * Math.min(innerWidth, innerHeight);
    return Math.hypot((ndc.x * w) / 2, ((ndc.y + 0.04) * h) / 2) < r;
  }

  /** The telescope looks out from inside the lantern: the tower's out of the way while it does. */
  private withoutTower<T>(look: () => T): T {
    const tower = this.ctx.island.get('lighthouse');
    if (tower) tower.visible = false;
    try {
      return look();
    } finally {
      if (tower) tower.visible = true;
    }
  }

  /** Off goes the telly (the player with it), and the view turns back to the room. */
  switchOff(instant = false) {
    if (!telly.film) return;
    telly.film = false;
    const room = this.rooms.quarters;
    if (room) {
      room.film = false;
      room.view.stand(instant || this.reducedMotion);
    }
    if (this.film) {
      this.film.hidden = true;
      this.film.querySelector('[data-film-screen]')!.replaceChildren();
    }
    this.ctx.sound.film = false;
  }

  /** Pause the film, or carry on with it. */
  private pause() {
    this.tellPlayer({ event: 'command', func: this.playerState === 2 ? 'playVideo' : 'pauseVideo', args: [] });
  }

  private tellPlayer(msg: object) {
    this.film?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify(msg), FILM_ORIGIN);
  }

  /** Keep the player on the telly's screen: its corners, wherever they are on the canvas. */
  private pinFilm() {
    const room = this.rooms.quarters;
    const el = this.film?.querySelector<HTMLElement>('[data-film-screen]');
    if (!room || !el || !this.screen) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const tl = room.project(this.screen.tl, w, h);
    const tr = room.project(this.screen.tr, w, h);
    const bl = room.project(this.screen.bl, w, h);
    const across = Math.max(1, Math.hypot(tr.x - tl.x, tr.y - tl.y));
    const down = Math.max(1, Math.hypot(bl.x - tl.x, bl.y - tl.y));
    // sized in real pixels, then turned and sheared onto the screen
    el.style.width = `${across}px`;
    el.style.height = `${down}px`;
    // the picture fills the whole screen (a little off the sides, like an old telly), and the
    // player stands taller than it, so its title and logo are clipped off above and below
    const player = el.querySelector('iframe');
    if (player) {
      const w = Math.max(across, down * FILM_ASPECT);
      const h = w / FILM_ASPECT;
      const spare = 80 + h * 0.15;
      Object.assign(player.style, {
        width: `${w}px`,
        height: `${h + 2 * spare}px`,
        left: `${(across - w) / 2}px`,
        top: `${(down - h) / 2 - spare}px`,
      });
    }
    const m = [(tr.x - tl.x) / across, (tr.y - tl.y) / across, (bl.x - tl.x) / down, (bl.y - tl.y) / down, tl.x, tl.y];
    el.style.transform = `matrix(${m.map((v) => v.toFixed(4)).join(',')})`;
  }

  private get room(): Room | undefined {
    return this.rooms[this.floor];
  }

  /** Fetch a floor ahead of time, so the door (or the hatch) opens without a wait. */
  load(floor: Floor = 'quarters') {
    this.loading[floor] ??= (floor === 'lamp' ? LampRoom.load() : QuartersRoom.load())
      .then((room) => this.pixels.warm(room.scene, room.camera).then(() => room))
      .then((room) => {
        (this.rooms as Record<Floor, Room>)[floor] = room;
        if (room instanceof QuartersRoom) {
          room.onMew = () => this.ctx.sound.call('mew');
          room.onSip = () => this.ctx.sound.call('sip');
          room.onMachine = (what) => this.ctx.sound.call(what);
          room.onCrunch = () => this.ctx.sound.call('crunch');
          room.onLap = () => this.ctx.sound.call('lap');
        }
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
    if (!inside) {
      this.switchOff(true);
      this.stepBack();
    }
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
    this.switchOff(true);
    this.stepBack();
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
    if (telly.film) this.pinFilm();
  }

  // sat in front of the telly, the view stays put
  zoom(factor: number, ndc: THREE.Vector2) {
    if (this.spy) return void (this.spy.view = THREE.MathUtils.clamp(this.spy.view * factor, SPY.min, SPY.max));
    if (!this.room?.view.seated) this.room?.view.zoomBy(factor, ndc);
  }

  pan(dxPx: number, dyPx: number) {
    // through the telescope, a drag swings it round: as much as the view is wide, at the distance it's focused
    if (this.spy) {
      const turn = this.spy.view / Math.max(1, this.host.clientHeight) / 40;
      return this.swing(dxPx * turn, dyPx * turn);
    }
    if (!this.room?.view.seated) this.room?.view.pan(dxPx, dyPx);
  }

  hover(ndc: THREE.Vector2 | null, client: { x: number; y: number }) {
    const room = this.room;
    if (!room || !this.inside || this.climbing) return;
    if (this.spy) {
      const hit = ndc && this.pickOut(ndc);
      const place = hit ? placeFor(hit.id) : undefined;
      this.outdoors.highlight(place && hit ? (this.ctx.island.get(hit.id) ?? null) : null);
      this.host.querySelector('canvas')!.style.cursor = place ? 'pointer' : '';
      this.ui.tooltip(place ? labelFor(place, this.ctx) : null, client.x, client.y);
      return;
    }
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
    if (this.spy) return this.spot(ndc);
    const hit = room.picker.pick(ndc);
    const place = hit ? lighthousePlaceFor(hit.id, this.floor) : undefined;
    if (!hit || !place) return;
    this.ui.tooltip(null);
    if (hit.id === 'stairs') return this.climb(this.floor === 'lamp' ? 'quarters' : 'lamp');
    if (room instanceof QuartersRoom) room.guests.pet(hit.id, hit.point);
    if (room instanceof QuartersRoom && hit.id === 'tap' && !room.tap()) {
      this.ctx.sound.stopTap();
      this.ctx.toast('You turn off the tap.');
      return;
    }
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
    if (this.spy && !this.reducedMotion) this.spy.clock += dt;
    if (this.inside && this.room) {
      if (this.room.view.step(this.reducedMotion ? Infinity : dt) && telly.film) this.pinFilm(); // turning to face the telly
      if (this.room instanceof LampRoom) this.room.onAir = this.ctx.radio.on;
      this.room.update(this.reducedMotion ? 0 : dt, night, this.ctx.weather.now);
    }
  }

  render() {
    const u = this.pixels.uniforms;
    // through the telescope it's the island, in its own light and weather, ringed in the dark
    if (this.spy && this.aim()) {
      u.uVignette.value = 1;
      const camera = this.spy.camera;
      this.withoutTower(() => this.pixels.render(this.island, camera, NO_SHIFT));
      return;
    }
    u.uGrade.value.set(1.05, 1.03, 1.0); // indoors, whatever the weather is doing outside
    u.uTone.value = u.uVignette.value = 0; // the island's light stays outside
    u.uHeat.value = 0;
    this.pixels.render(this.room!.scene, this.room!.camera, NO_SHIFT);
  }

  private swap() {
    this.ctx.sound.door(this.inside && this.want ? 'hatch' : 'lighthouse'); // up or down the stairs, or the front door
    if (this.inside) this.leaveFloor();
    this.inside = this.want;
    this.ctx.sound.indoors = this.inside;
    if (this.inside) {
      this.floor = this.wantFloor;
      const banner = document.querySelector('[data-panel="lighthouse"] .workshop-banner p');
      const rainy = this.room instanceof QuartersRoom && this.room.guests.anyone;
      const w = this.ctx.weather.now;
      const wet = w.rain + w.hail + w.snow > 0.1;
      if (banner) banner.textContent = rainy ? (wet ? RAINY : VISIT) : BANNER[this.floor];
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
