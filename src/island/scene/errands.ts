import * as THREE from 'three';
import type { Ground } from './beike';
import type { Island } from './island';
import { heightBetween, type Waypoint } from './shelter';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const WALK = 1.25; // m/s
const STRIDE = 0.9; // seconds a step each foot
const DECK = 0.84; // where feet go on the pier's boards (layout.py SHELTER "deck")

/** From his log by the fire, along the paths, down to the pier (Blender x, y; "deck" is on the boards). */
const TO_THE_PIER: [number, number, string?][] = [
  [26.4, 0.6], [25, -2.5], [21, -6], [15, -10.5], [9, -11], [3.6, -9.5], [0.6, -12.5], [0.2, -15.8],
  [0.2, -18.4, 'deck'], [0.3, -25.4, 'deck'], [-0.05, -26.35, 'deck'],
];
/** Where he flies the kite on a windy Sunday: on the sand just east of the pier. */
const KITE_AT: [number, number] = [6.2, -16.4];

type Leg = 'down' | 'pick' | 'up' | 'done';

/**
 * Vincent's errands on his feet (week.py `vincent_about`): on a post day, down from the fire to the
 * end of the pier for the parcel the post boat left there, and all the way up the trail with it to
 * the hut; on a windy Sunday, out on the beach flying the kite (week.ts flies the kite itself).
 */
export class Errands {
  private me?: THREE.Object3D;
  private down: Waypoint[] = [];
  private up: Waypoint[] = [];
  private leg: Leg = 'done';
  private i = 1;
  private along = 0;
  private t = 0;
  private clock = 0;
  private parcel?: THREE.Object3D;
  /** The post boat's parcel, off the pier (week.ts): handed over when he gets to it. */
  onTake?: () => THREE.Object3D | undefined;
  /** In at the hut's door with it. */
  onDeliver?: () => void;

  constructor(
    island: Island,
    private ground: Ground,
  ) {
    this.me = island.get('vincent_about');
    const point = ([x, y, on]: [number, number, string?]): Waypoint =>
      on === 'deck' ? { at: V(x, DECK, -y), fixed: true } : { at: V(x, ground.at(x, -y), -y), fixed: false };
    this.down = TO_THE_PIER.map(point);
    // back up: off the pier the way the dock cat goes, all the way to the hut's door
    const dock = island.routes.get('dock') ?? [];
    this.up = [...this.down.slice(-3).reverse(), ...dock.slice(2)];
    if (this.me) this.me.visible = false;
  }

  set visible(on: boolean) {
    if (this.me) this.me.visible = on;
  }

  get body() {
    return this.me;
  }

  get head() {
    return this.me?.getObjectByName('about_head');
  }

  /** Whether he's still on his way with the post (he doesn't drop it for anything). */
  get busy() {
    return this.leg !== 'done';
  }

  /** Whether he's got the parcel in his arms. */
  get carrying() {
    return !!this.parcel;
  }

  /** Where the post round starts: by his log, for checking whether anyone's watching. */
  get start() {
    return this.down[0]?.at;
  }

  /** Off to fetch the post. */
  fetch() {
    Object.assign(this, { leg: 'down', i: 1, along: 0, t: 0 });
    this.step(0);
  }

  /** One frame of the round: walking, picking it up, carrying it up the mountain. */
  post(dt: number) {
    this.clock += dt;
    if (this.leg === 'pick') {
      this.t += dt;
      if (this.t > 1.2 && !this.parcel) this.parcel = this.onTake?.();
      if (this.t > 2) Object.assign(this, { leg: 'up', i: 1, along: 0 });
    } else if (this.leg !== 'done') this.step(dt);
    this.pose(this.leg === 'down' || this.leg === 'up', this.leg === 'pick' ? Math.min(1, this.t / 0.8) : this.parcel ? 1 : 0, 0);
    if (this.parcel && this.me) {
      this.parcel.position.set(0, 1.12, 0.36); // in both arms, in front of him
      this.parcel.rotation.set(0, 0, 0);
      if (this.parcel.parent !== this.me) this.me.add(this.parcel);
    }
  }

  private step(dt: number) {
    const me = this.me;
    const r = this.leg === 'down' ? this.down : this.up;
    if (!me || r.length < 2) {
      this.leg = 'done';
      return;
    }
    this.along += WALK * dt;
    for (;;) {
      const len = r[this.i - 1].at.distanceTo(r[this.i].at);
      if (this.along < len) break;
      this.along -= len;
      if (++this.i < r.length) continue;
      // at the end: the pier's head (the parcel), or the hut's door (in he goes)
      if (this.leg === 'down') Object.assign(this, { leg: 'pick', t: 0, i: r.length - 1, along: 0 });
      else {
        this.leg = 'done';
        this.parcel?.removeFromParent();
        this.parcel = undefined;
        this.onDeliver?.();
        me.visible = false;
      }
      break;
    }
    const i = Math.min(this.i, r.length - 1);
    const a = r[i - 1];
    const b = r[i];
    const k = this.leg === 'pick' ? 1 : Math.min(1, this.along / Math.max(1e-3, a.at.distanceTo(b.at)));
    me.position.lerpVectors(a.at, b.at, k);
    const h = heightBetween(a, b, me.position, this.ground);
    if (!Number.isNaN(h)) me.position.y = h;
    me.rotation.y = Math.atan2(b.at.x - a.at.x, b.at.z - a.at.z);
  }

  /** On the sand with the kite: facing downwind, where it is, both hands up on the line. */
  fly(dt: number, downwind: THREE.Vector2) {
    const me = this.me;
    if (!me) return;
    this.clock += dt;
    const [x, y] = KITE_AT;
    me.position.set(x, this.ground.at(x, -y), -y);
    me.rotation.y = Math.atan2(downwind.x, downwind.y);
    // a tug on the line now and then, and a step to keep it up
    const tug = Math.max(0, Math.sin(this.clock * 1.7)) ** 4;
    this.pose(false, 0, 1, tug);
  }

  /** Legs walking (or not), arms carrying (0..1) or up on the kite's line (0..1, with a tug). */
  private pose(walking: boolean, carry: number, kite: number, tug = 0) {
    const me = this.me;
    if (!me) return;
    const t = this.clock;
    const swing = walking ? Math.sin((t / STRIDE) * Math.PI) * 0.5 : 0;
    const part = (name: string) => me.getObjectByName(`about_${name}`);
    part('leg_l')?.rotation.set(swing, 0, 0);
    part('leg_r')?.rotation.set(-swing, 0, 0);
    const free = 1 - Math.max(carry, kite);
    const reach = -carry * 1.15 - kite * (2.3 + tug * 0.35);
    part('arm_l')?.rotation.set(-swing * 0.8 * free + reach, 0, kite * -0.15);
    part('arm_r')?.rotation.set(swing * 0.8 * free + reach, 0, kite * 0.15);
    part('head')?.rotation.set(-kite * 0.45, walking ? Math.sin(t * 0.5) * 0.15 : Math.sin(t * 0.3) * 0.2 * (1 - kite), 0);
  }
}
