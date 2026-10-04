import * as THREE from 'three';
import type { Ground } from './beike';
import type { Island } from './island';
import { heightBetween, type Waypoint } from './shelter';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

const PACE = 0.95; // m/s: a stroll, not a march
const STRIDE = 1.0; // seconds a step each foot
const DECK = 0.84; // the pier's boards (layout.py SHELTER "deck")
const THIGH = 0.42; // hip to knee, knee to sole (outings.py)
const SHIN = 0.42;
const BESIDE = 0.74; // metres between them, walking side by side

/** What they stop to do. */
export type Act = 'gaze' | 'lookup' | 'crouch' | 'pick' | 'peer';
/** What a stop is about, for what they're thinking (content.ts). */
export type Topic = 'sea' | 'shore' | 'flowers' | 'woods' | 'tree' | 'well' | 'bench' | 'lighthouse' | 'pier' | 'sky';
export type Find = 'shell' | 'leaf' | 'pebble' | 'flower' | 'conker';

interface Stop {
  at: number; // index into the route's points
  act: Act;
  look: [number, number]; // Blender x, y of what they're looking at
  about: Topic;
  /** For `pick`: what they might find there. */
  finds?: Find[];
}

interface Route {
  points: [number, number, 'deck'?][]; // Blender x, y
  stops: Stop[];
}

/**
 * The strolls (Blender x, y, along the paths and the beach: layout.py PATHS, beike.ts ROUND). Each
 * starts and ends somewhere out of the way, with a few places on it worth stopping at.
 */
const ROUTES: Record<string, Route> = {
  // east along the beach, up past the blossom tree to the well, and back along the path
  east: {
    points: [[3.6, -10.2], [5, -14.8], [10.5, -15.4], [13, -16], [16.5, -16], [21, -16.4], [21.4, -13.6], [18.6, -12.6], [15, -10.5], [9, -11], [3.6, -10.2]],
    stops: [
      { at: 1, act: 'gaze', look: [5.5, -24], about: 'sea' },
      { at: 3, act: 'pick', look: [13.2, -17], about: 'shore', finds: ['shell', 'shell', 'pebble'] },
      { at: 6, act: 'lookup', look: [22.8, -12.2], about: 'tree' },
      { at: 7, act: 'peer', look: [20, -14], about: 'well' },
    ],
  },
  // west through the meadow, out to the lighthouse point, and back past the bench
  west: {
    points: [[-3, -9.8], [-8.5, -10.5], [-11, -10.6], [-14.8, -9.9], [-18.5, -9.9], [-21.8, -7.6], [-25.2, -5.2], [-28.4, -5.4],
      [-26.8, -6.8], [-23.5, -9.5], [-20.5, -12.2], [-16, -13.4], [-7, -13.4], [-1, -13.4]],
    stops: [
      { at: 2, act: 'crouch', look: [-11, -12], about: 'flowers' },
      { at: 7, act: 'gaze', look: [-36, -9], about: 'lighthouse' },
      { at: 10, act: 'gaze', look: [-17, -11], about: 'bench' },
      { at: 12, act: 'pick', look: [-7, -14.4], about: 'shore', finds: ['pebble', 'shell', 'leaf'] },
    ],
  },
  // out to the end of the pier and back, and along the sand west of it
  pier: {
    points: [[0.6, -12.5], [0.2, -15.8], [0.2, -18.4, 'deck'], [0.3, -25.2, 'deck'], [0.2, -18.4, 'deck'], [0.2, -15.8], [-3.4, -15.4], [-1, -13.4]],
    stops: [
      { at: 3, act: 'gaze', look: [0.4, -40], about: 'pier' },
      { at: 6, act: 'pick', look: [-3.6, -16.4], about: 'shore', finds: ['shell', 'pebble'] },
    ],
  },
  // through the woods behind the fire, out to the east shore, and back along the beach
  woods: {
    points: [[21, -6], [23.6, -2.4], [25, -4.5], [26.8, -6.2], [27.4, -9], [27.6, -12.2], [25.8, -14.9], [22, -16.3], [16.5, -16], [13, -16], [10.5, -15.4], [5, -14.8], [-1, -13.4]],
    stops: [
      { at: 1, act: 'lookup', look: [24, 0.5], about: 'woods' },
      { at: 3, act: 'crouch', look: [28, -5.4], about: 'woods' },
      { at: 5, act: 'gaze', look: [40, -16], about: 'sea' },
      { at: 9, act: 'pick', look: [13, -17], about: 'shore', finds: ['shell', 'pebble'] },
    ],
  },
};
export type RouteName = keyof typeof ROUTES;
export const ROUTE_NAMES = Object.keys(ROUTES) as RouteName[];

/** On a cold day he asks her out for a walk with a mug of glühwein (vincent.ts asks, companion.ts comes). */
export const together = { asked: false, joined: false };

export interface Pose {
  walk: number; // 0 standing … 1 walking
  phase: number; // where in the stride (radians)
  crouch: number; // 0..1
  lean: number; // 0..1: bent over (into the well)
  look: number; // head pitch: + down, - up
  turn: number; // head yaw
  behind: number; // 0..1: hands behind the back (him) or arms folded (her)
  reach: number; // 0..1: the left hand down to the ground
  hold: number; // 0..1: the left hand up in front, looking at what's in it
  mug: boolean;
  sip: number; // 0..1
}

const REST: Pose = { walk: 0, phase: 0, crouch: 0, lean: 0, look: 0, turn: 0, behind: 0, reach: 0, hold: 0, mug: false, sip: 0 };

/** Someone on their feet (outings.py `vincent_walker`, `companion_walker`), posed part by part. */
export class Walker {
  readonly root?: THREE.Object3D;
  private parts = new Map<string, THREE.Object3D>();
  /** Where they're standing and which way they face (world), before any crouching. */
  readonly at = V();
  heading = 0;
  find: Find | null = null;

  constructor(
    island: Island,
    id: string,
    private prefix: string,
    /** Hands behind the back (him), or arms folded (her). */
    private folded = false,
  ) {
    this.root = island.get(id);
    this.root?.traverse((o) => this.parts.set(o.name, o));
    if (this.root) this.root.visible = false;
  }

  set visible(on: boolean) {
    if (this.root) this.root.visible = on;
  }

  get visible() {
    return !!this.root?.visible;
  }

  get head() {
    return this.part('head');
  }

  get mug() {
    return this.part('mug');
  }

  private part(name: string) {
    return this.parts.get(`${this.prefix}_${name}`);
  }

  pose(p: Pose) {
    const root = this.root;
    if (!root) return;
    const s = Math.sin(p.phase) * 0.45 * p.walk;
    // a crouch: thighs forward, shins back, and the whole of them down and back so the feet stay put
    const a = -1.25 * p.crouch;
    const b = 2.0 * p.crouch;
    const drop = THIGH + SHIN - (Math.cos(a) * THIGH + Math.cos(a + b) * SHIN);
    const forward = -Math.sin(a) * THIGH - Math.sin(a + b) * SHIN;
    root.position.copy(this.at);
    root.position.y -= drop;
    root.position.x -= Math.sin(this.heading) * forward;
    root.position.z -= Math.cos(this.heading) * forward;
    root.rotation.set(0, this.heading, 0);
    for (const [side, k] of [['l', 1], ['r', -1]] as const) {
      this.part(`leg_${side}`)?.rotation.set(k * s + a, 0, 0);
      // the back foot's knee bends as it comes through
      this.part(`shin_${side}`)?.rotation.set(Math.max(0, k * Math.sin(p.phase + 0.9)) * 0.55 * p.walk + b, 0, 0);
    }
    this.part('torso')?.rotation.set(p.crouch * 0.4 + p.lean * 0.55, 0, 0);
    // arms: swinging, or behind the back / folded, the left reaching down or holding something
    // up, the right with the mug (kept upright in the hand) and up to the mouth for a sip
    const behind = p.behind * (1 - p.walk);
    const fold = this.folded ? -0.55 : 0.4;
    const inward = this.folded ? 0.45 : 0.25;
    const left = this.part('arm_l');
    if (left) {
      const free = -s * 0.8 * (1 - p.hold) * (1 - p.reach);
      left.rotation.set(free + behind * fold - p.reach * 0.7 - p.hold * 1.35 - p.crouch * 0.3, 0, -behind * inward - p.hold * 0.25);
    }
    const right = this.part('arm_r');
    if (right) {
      const carry = p.mug ? -0.75 - p.sip * 1.55 : s * 0.8 + behind * fold;
      right.rotation.set(carry, 0, (p.mug ? 0.12 + p.sip * 0.25 : behind * inward));
      const mug = this.part('mug');
      if (mug) {
        mug.visible = p.mug;
        mug.rotation.set(-carry - (this.part('torso')?.rotation.x ?? 0) + p.sip * 0.5, 0, 0); // tipped a little to drink
      }
    }
    this.part('head')?.rotation.set(p.look - p.sip * 0.25, p.turn, 0);
    for (const f of ['shell', 'leaf', 'pebble', 'flower', 'conker'] as const) {
      const o = this.part(`find_${f}`);
      if (o) o.visible = this.find === f && (p.hold > 0.3 || p.reach > 0.6);
    }
  }
}

type Phase = 'walk' | 'stop' | 'done';

/**
 * A stroll along one of the ROUTES: walking at an easy pace, stopping now and then to look at
 * something (out to sea, up into a tree, down a well), crouch over the flowers, or pick something
 * up off the sand and turn it over; a thought now and then. `beside`, if given, walks with them,
 * on their right.
 */
export class Stroll {
  private route: Route = ROUTES.east;
  private way: Waypoint[] = [];
  private leg = 1;
  private along = 0;
  private phase: Phase = 'done';
  private stop: Stop | null = null;
  private t = 0;
  private length = 0;
  private clock = 0;
  private stride = 0;
  private nextThought = rand(6, 14);
  private sinceStop = 0;
  private nextSip = rand(3, 8);
  private sip = 0;
  /** What they're thinking about: the last place they stopped, or the walk itself. */
  topic: Topic | 'walk' = 'walk';
  /** What they've got in their hand, if they've just picked something up. */
  found: Find | null = null;
  /** A mug of glühwein each. */
  mugs = false;
  /** A thought rising from over their head. */
  onThought?: (at: THREE.Vector3) => void;
  private poses = [{ ...REST }, { ...REST }];

  constructor(
    private ground: Ground,
    private walker: Walker,
    readonly beside?: Walker,
  ) {}

  get done() {
    return this.phase === 'done';
  }

  /** Which walk it is. */
  name: RouteName = 'east';

  /** Where the walk starts: for checking whether anyone's looking before they turn up there. */
  static start(name: RouteName, ground: Ground) {
    const [x, y] = ROUTES[name].points[0];
    return V(x, ground.at(x, -y), -y);
  }

  begin(name: RouteName = pick(ROUTE_NAMES)) {
    this.name = name;
    this.route = ROUTES[name];
    this.way = this.route.points.map(([x, y, on]) => (on === 'deck' ? { at: V(x, DECK, -y), fixed: true } : { at: V(x, this.ground.at(x, -y), -y), fixed: false }));
    // some days round the other way
    if (Math.random() < 0.5 && !this.route.points.some((p) => p[2])) {
      this.way.reverse();
      this.route = { ...this.route, stops: this.route.stops.map((s) => ({ ...s, at: this.way.length - 1 - s.at })) };
    }
    Object.assign(this, { leg: 1, along: 0, phase: 'walk', stop: null, topic: 'walk', found: null });
    this.walker.find = null;
    this.update(0);
  }

  /** One frame of it (0 holds them where they are). */
  update(dt: number) {
    const w = this.way;
    if (w.length < 2) return;
    this.clock += dt;
    if (this.phase === 'walk') {
      // a while after the last stop, their mind's on the walk again
      if ((this.sinceStop += dt) > 15) this.topic = 'walk';
      this.along += PACE * dt;
      this.stride += (dt / STRIDE) * Math.PI;
      for (;;) {
        const len = w[this.leg - 1].at.distanceTo(w[this.leg].at);
        if (this.along < len) break;
        this.along -= len;
        // at a stop: turn to whatever it is and take it in
        const stop = this.route.stops.find((s) => s.at === this.leg);
        if (++this.leg >= w.length) {
          this.leg = w.length - 1;
          this.along = w[this.leg - 1].at.distanceTo(w[this.leg].at);
          this.phase = 'done';
          break;
        }
        if (stop) {
          this.leg--;
          this.along = len;
          this.halt(stop);
          break;
        }
      }
    } else if (this.phase === 'stop') {
      this.t += dt;
      if (this.t > this.length) {
        this.phase = 'walk';
        this.leg++;
        this.along = 0;
        this.stop = null;
        if (this.found) this.found = null; // into a pocket
        this.walker.find = null;
      }
    }
    this.place(dt);
  }

  private halt(stop: Stop) {
    this.phase = 'stop';
    this.stop = stop;
    this.t = 0;
    this.topic = stop.about;
    this.sinceStop = 0;
    this.length = stop.act === 'pick' ? rand(6, 8) : stop.act === 'crouch' ? rand(5, 8) : rand(6, 11);
    if (stop.act === 'pick' && stop.finds) this.found = this.walker.find = pick(stop.finds);
    if (stop.act !== 'pick' && Math.random() < 0.6) this.nextThought = rand(1.5, 3);
  }

  /** Put them where they are on the route, facing the way they're going (or what they've stopped for). */
  private place(dt: number) {
    const w = this.way;
    const a = w[this.leg - 1];
    const b = w[this.leg];
    const len = Math.max(1e-3, a.at.distanceTo(b.at));
    const at = V().lerpVectors(a.at, b.at, Math.min(1, this.along / len));
    const h = heightBetween(a, b, at, this.ground);
    if (!Number.isNaN(h)) at.y = h;
    const walking = this.phase === 'walk';
    let heading = Math.atan2(b.at.x - a.at.x, b.at.z - a.at.z);
    const stop = this.stop;
    if (stop) {
      const [lx, ly] = stop.look;
      heading = Math.atan2(lx - at.x, -ly - at.z);
    }
    const ease = 1 - Math.exp(-4 * dt);
    const turn = Math.atan2(Math.sin(heading - this.walker.heading), Math.cos(heading - this.walker.heading));
    this.walker.heading += dt ? turn * ease : turn;
    // the mugs: a sip now and then, more often standing
    if (this.mugs) {
      if (this.sip > 0 || (this.nextSip -= dt) < 0) {
        this.sip = Math.min(1, this.sip + dt / 2.6);
        if (this.sip >= 1) {
          this.sip = 0;
          this.nextSip = rand(walking ? 6 : 3, walking ? 14 : 7);
        }
      }
    }
    const q = this.stop && this.phase === 'stop' ? Math.min(1, this.t / 0.8, (this.length - this.t) / 0.8) : 0; // into it and out of it
    const k = THREE.MathUtils.smoothstep(q, 0, 1);
    const act = this.stop?.act;
    const t = this.clock;
    const p = this.poses[0];
    Object.assign(p, REST, {
      walk: walking ? 1 : 0,
      phase: this.stride,
      mug: this.mugs,
      sip: Math.sin(this.sip * Math.PI),
      turn: walking ? Math.sin(t * 0.5) * 0.25 : Math.sin(t * 0.35) * 0.35 * (act === 'gaze' || act === 'lookup' ? 1 : 0.3),
      look: walking ? 0.05 : 0,
    });
    if (act === 'gaze') {
      p.behind = this.mugs ? 0 : k;
      p.look = -0.05 * k;
    } else if (act === 'lookup') {
      p.look = -0.6 * k;
      p.behind = this.mugs ? 0 : k * 0.6;
    } else if (act === 'peer') {
      p.lean = k;
      p.look = 0.5 * k;
    } else if (act === 'crouch') {
      p.crouch = this.mugs ? 0 : k;
      p.look = 0.55 * k;
      p.reach = this.mugs ? 0 : k * Math.max(0, Math.sin(this.t * 0.9)) * 0.8; // a touch of a petal
    } else if (act === 'pick') {
      // down for it, and up again turning it over in the hand
      const down = THREE.MathUtils.smoothstep(Math.min(this.t / 1.2, (3.2 - this.t) / 0.8), 0, 1) * k;
      p.crouch = this.mugs ? 0 : down;
      p.reach = this.mugs ? 0 : down;
      p.hold = this.mugs ? 0 : Math.max(0, k - down) * (this.t > 2.4 ? 1 : 0);
      p.look = 0.5 * k;
      p.turn = Math.sin(t * 1.3) * 0.12 * p.hold;
    }
    this.walker.at.copy(at);
    this.walker.pose(p);
    const b2 = this.beside;
    if (b2) {
      // on his right, keeping step half a stride behind; turned to the same thing when they stop
      const right = V(-Math.cos(this.walker.heading), 0, Math.sin(this.walker.heading));
      b2.at.copy(at).addScaledVector(right, BESIDE);
      const g = this.ground.at(b2.at.x, b2.at.z);
      if (!a.fixed && !b.fixed && !Number.isNaN(g)) b2.at.y = g;
      b2.heading = this.walker.heading + (walking ? 0 : -0.12);
      const p2 = this.poses[1];
      Object.assign(p2, p, {
        phase: this.stride + Math.PI * 0.85,
        sip: Math.sin(((this.sip + 0.5) % 1) * Math.PI) * (this.sip > 0 ? 1 : 0),
        turn: walking ? Math.sin(t * 0.4 + 2) * 0.3 - 0.2 : p.turn * 0.7 - 0.3, // and a look at him now and then
        crouch: 0, reach: 0, hold: 0,
      });
      b2.pose(p2);
    }
    if (dt && (this.nextThought -= dt) < 0) {
      this.nextThought = rand(10, 22);
      const head = this.walker.head;
      if (head) this.onThought?.(head.getWorldPosition(V()).add(V(0, 0.35, 0)));
    }
  }

  /** Where they are now (for the camera's view, and for clicking). */
  get position() {
    return this.walker.at;
  }
}
