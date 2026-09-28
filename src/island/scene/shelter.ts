import * as THREE from 'three';
import type { Beike, Ground } from './beike';
import type { Island } from './island';

const damp = THREE.MathUtils.damp;
const ease = THREE.MathUtils.smootherstep;

const GO_IN = 0.1; // rain (0..1) that sends them indoors…
const COME_OUT = 0.04; // …and how far it has to ease off before they come back out
const HOP = 1.05; // seconds to jump down off the bench (or back up): a crouch, the jump itself, and the landing
const step = (a: number, b: number, x: number) => THREE.MathUtils.smootherstep(x, a, b);
const TURN = 8;

/** Who's indoors right now, by id ("charlie", "george", "cat", "beike"): the rooms show them there. */
export const indoors = new Set<string>();

/** Which cats are flat out in the heat, by id (content.ts says so when you click them). */
export const flatOut = new Set<string>();

/**
 * Charlie's ambush in the lighthouse (quarters.ts), while Vincent's at his desk: one tiny mew,
 * and then he's on Vincent's back, claws and all. `on` while he's up there.
 */
export const ambush = { on: false };

/** Vincent's coffee at his desk (quarters.ts): full, drunk, or on its way back from the machine. */
export const coffee = {
  at: 'table' as 'table' | 'full' | 'empty',
  /** What he's up to: at the desk, off for a refill, at the machine, or back with it. */
  trip: 'desk' as 'desk' | 'go' | 'brew' | 'back',
  /** Mid-sip. */
  sip: false,
};

/** A point on the way indoors (tools/models/layout.py SHELTER); `fixed` ones are up on the pier or a plinth. */
export interface Waypoint {
  at: THREE.Vector3;
  fixed: boolean;
}

/** Height to stand at between `a` and `b`: the ground, unless one end is up on the pier's deck or a plinth. */
export function heightBetween(a: Waypoint, b: Waypoint, p: THREE.Vector3, ground: Ground) {
  if (!a.fixed && !b.fixed) return ground.at(p.x, p.z);
  const dx = b.at.x - a.at.x;
  const dz = b.at.z - a.at.z;
  const k = THREE.MathUtils.clamp(((p.x - a.at.x) * dx + (p.z - a.at.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  const ya = a.fixed ? a.at.y : ground.at(a.at.x, a.at.z);
  const yb = b.fixed ? b.at.y : ground.at(b.at.x, b.at.z);
  return ya + (yb - ya) * k;
}

// 'cool' and 'warm': down off the bench onto the stones under it in the heat, and back up
type Phase = 'asleep' | 'down' | 'in' | 'inside' | 'out' | 'up' | 'cool' | 'warm';

const HOT = 0.55; // heat (0..1) that has them down on the cool stones…
const COOLER = 0.4; // …and back up on the fleece once it's this much cooler

interface CatSpec {
  id: string;
  route: string;
  speed: number; // m/s
  delay: number; // seconds after the rain comes (or goes) before this one gets up
  front?: number; // jumps down this far in front of where it sleeps (off the bench)
}

/**
 * Where Charlie or George now and then sleeps instead of the bench (Blender x, y): the library's
 * front step, across the game of Magic, in the warm by the fire of an evening, or on the
 * lighthouse doorstep. `on` is what they're lying on (a named thing, or an object by name);
 * `way` the path from there to the bench's route in, which it joins at `join`. Its first point
 * is where they land jumping down, unless they sleep on the floor they walk on (`hop: false`).
 */
export type Nook = 'bench' | 'library' | 'cards' | 'fire' | 'doorstep';
interface NookSpec {
  at: [number, number];
  on: string;
  yaw: number;
  hop: boolean;
  way: [number, number][];
  join: number;
  evening?: boolean; // only of an evening, when the fire's worth sitting by
}
const NOOKS: Record<Exclude<Nook, 'bench'>, NookSpec> = {
  library: { at: [-11.2, -8.1], on: 'library', yaw: 0.2, hop: true, way: [[-11.2, -9.3], [-14.8, -9.9]], join: 1 },
  cards: {
    at: [6.3, -9.1], on: 'card_table', yaw: 0.5, hop: true,
    way: [[6.3, -10.3], [3.6, -10.2], [-3, -9.8], [-8.5, -10.5], [-14.8, -9.9]], join: 1,
  },
  fire: {
    at: [26.4, -2.6], on: 'terrain', yaw: 0.4, hop: false, evening: true,
    way: [[24.8, -4.3], [21, -6], [15, -10.5], [9, -11], [3.6, -10.2], [-3, -9.8], [-8.5, -10.5], [-14.8, -9.9]], join: 1,
  },
  doorstep: { at: [-30.9, -4.3], on: 'lighthouse', yaw: -0.2, hop: false, way: [], join: 6 },
};

/** Where Charlie and George are asleep on this visit (content.ts says so when you click them). */
export const beds: Record<'charlie' | 'george', Nook> = { charlie: 'bench', george: 'bench' };

/**
 * Mostly the bench. Now and then one of them (once in a while both) has found somewhere else to
 * sleep today. To preview: ?charlie=cards, ?george=fire (any Nook).
 */
function chooseBeds(hour: number) {
  const q = new URLSearchParams(location.search);
  const open = (Object.keys(NOOKS) as Exclude<Nook, 'bench'>[]).filter((n) => !NOOKS[n].evening || hour >= 18);
  const pick = () => open.splice(Math.floor(Math.random() * open.length), 1)[0];
  const cats = (['charlie', 'george'] as const).slice();
  if (Math.random() < 0.3) {
    if (Math.random() < 0.5) cats.reverse();
    beds[cats[0]] = pick();
    if (Math.random() < 0.3) beds[cats[1]] = pick();
  }
  for (const id of cats) {
    const n = q.get(id) as Nook | null;
    if (n && (n === 'bench' || n in NOOKS)) beds[id] = n;
  }
}

/**
 * Put `sleeper` down in its nook, on top of whatever's there, and give back its way in from
 * there as far as the bench route (null if the nook isn't on this island).
 */
function tuckIn(island: Island, sleeper: THREE.Object3D, n: NookSpec, ground: Ground): Waypoint[] | null {
  const [x, y] = n.at;
  const spot = new THREE.Vector3(x, 0, -y);
  const on = island.get(n.on) ?? island.root.getObjectByName(n.on);
  if (!on || !sleeper.parent) return null;
  on.updateWorldMatrix(true, true);
  // down from not far above the ground, so as to land on the step and not the eaves over it
  const from = spot.clone().setY(ground.at(spot.x, spot.z) + 1.5);
  const hit = new THREE.Raycaster(from, new THREE.Vector3(0, -1, 0)).intersectObject(on, true)[0];
  if (!hit) return null;
  sleeper.position.copy(sleeper.parent.worldToLocal(hit.point.clone()));
  sleeper.rotation.set(0, n.yaw, 0);
  const way = n.way.map(([x, y]) => ({ at: new THREE.Vector3(x, ground.at(x, -y), -y), fixed: false }));
  return n.hop ? way : [{ at: hit.point.clone(), fixed: true }, ...way];
}

const CATS: CatSpec[] = [
  { id: 'charlie', route: 'bench', speed: 1.7, delay: 0.6, front: 0.8 }, // first to notice
  { id: 'george', route: 'bench', speed: 1.35, delay: 2.4, front: 0.8 }, // not in a hurry, ever
  { id: 'cat', route: 'dock', speed: 2.4, delay: 1.2 }, // a long way up to the hut
];

/**
 * One of the cats: asleep where it always is, until the rain comes. Then the sleeping model
 * makes way for one up on its feet ("<id>_walk"), which jumps down, trots along its route and
 * slips in through a door. When the rain stops it comes back out the same way and settles down.
 */
class Cat {
  private phase: Phase = 'asleep';
  private wait = 0;
  private t = 0; // through a jump, 0..1
  private s = 0; // metres along the route
  private heading = 0;
  private stride = 0;
  private points: Waypoint[];
  private lengths: number[] = [0];
  private seat: THREE.Vector3;
  private parts: { body?: THREE.Object3D; head?: THREE.Object3D; tail?: THREE.Object3D; legs: THREE.Object3D[] };
  private rest = new Map<THREE.Object3D, THREE.Euler>();
  private bodyY = 0;
  /** On the flagstones under the bench, flat out (in the heat); the dock cat just flattens where it is. */
  private sprawled = false;
  private heatWait = 0;
  private cool: THREE.Vector3 | null = null;
  private restPos: THREE.Vector3;
  private restScale: THREE.Vector3;
  private baseScale: THREE.Vector3;
  /** How a jump looks, 0..1 each: gathered to spring, stretched in the air, squashed on landing, and how much of its size it has (it grows out of the curled-up cat). */
  private crouch = 0;
  private air = 0;
  private land = 0;
  private morph = 1;
  private wiggle = 0;

  constructor(
    private spec: CatSpec,
    private sleeper: THREE.Object3D,
    private walker: THREE.Object3D,
    route: Waypoint[],
    private ground: Ground,
    /** Whether it's asleep on the bench, rather than somewhere else today. */
    readonly onBench = true,
    /** Whether it jumps down from where it sleeps (and back up): not if that's floor it walks on. */
    private hop = true,
  ) {
    this.seat = sleeper.getWorldPosition(new THREE.Vector3());
    this.points = [...route];
    if (spec.front && onBench) {
      // the cat's frame faces -y in Blender, which is +z here
      const ahead = new THREE.Vector3(0, 0, 1).applyQuaternion(sleeper.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
      const at = this.seat.clone().addScaledVector(ahead, spec.front);
      this.points.unshift({ at: at.setY(ground.at(at.x, at.z)), fixed: false });
      // half under the seat, on the stones the bench stands on (its foot is 0.56 below the fleece)
      this.cool = this.seat.clone().addScaledVector(ahead, 0.3);
      this.cool.y -= 0.56 - 0.045;
    }
    this.restPos = sleeper.position.clone();
    this.restScale = sleeper.scale.clone();
    this.baseScale = walker.scale.clone();
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1].at;
      const b = this.points[i].at;
      this.lengths.push(this.lengths[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    walker.visible = false;
    const part = (name: string) => {
      const o = walker.getObjectByName(`${spec.id}_walk_${name}`);
      if (o) this.rest.set(o, o.rotation.clone());
      return o;
    };
    this.parts = {
      body: part('body'),
      head: part('head'),
      tail: part('tail'),
      legs: ['fl', 'fr', 'bl', 'br'].map((n) => part(`leg_${n}`)).filter((o): o is THREE.Object3D => !!o),
    };
    this.bodyY = this.parts.body?.position.y ?? 0;
  }

  get id() {
    return this.spec.id;
  }

  get inside() {
    return this.phase === 'inside';
  }

  /** Asleep in its usual spot (not down on the stones in the heat). */
  get asleep() {
    return this.phase === 'asleep' && !this.sprawled;
  }

  /** Straight to where the weather says it should be, no walking (on arrival, or with reduced motion). */
  snap(wantIn: boolean, hot = 0) {
    this.phase = wantIn ? 'inside' : 'asleep';
    this.sprawl(!wantIn && hot > HOT);
    this.sleeper.visible = !wantIn;
    this.walker.visible = false;
    this.wait = 0;
  }

  /** Flat out on the cool stones (or back on the fleece): the sleeping model, moved and squashed. */
  private sprawl(on: boolean) {
    this.sprawled = on;
    if (on) flatOut.add(this.spec.id);
    else flatOut.delete(this.spec.id);
    const s = this.sleeper;
    if (on && this.cool) s.position.copy(s.parent ? s.parent.worldToLocal(this.cool.clone()) : this.cool);
    else s.position.copy(this.restPos);
    s.scale.copy(this.restScale);
    if (on) s.scale.multiply(new THREE.Vector3(1.15, 0.72, 1.1)); // stretched long and flat, belly to the stone
  }

  update(dt: number, wantIn: boolean, hot = 0) {
    const end = this.lengths[this.lengths.length - 1];
    let moving = false;
    this.crouch = this.air = this.land = 0;
    this.morph = 1;
    if (this.phase === 'asleep' && !wantIn) {
      const want = this.sprawled ? hot > COOLER : hot > HOT;
      if (want !== this.sprawled) {
        if (!this.cool) this.sprawl(want); // nowhere to go: it just flattens out where it is
        else if ((this.heatWait += dt) > this.spec.delay * 4) {
          this.heatWait = 0;
          this.sleeper.visible = false;
          this.walker.visible = true;
          this.phase = want ? 'cool' : 'warm';
          this.t = 0;
          this.sprawl(false);
        }
      } else this.heatWait = 0;
    }
    switch (this.phase) {
      case 'cool':
      case 'warm': {
        this.t += dt / HOP;
        const [from, to] = this.phase === 'cool' ? [this.seat, this.cool!] : [this.cool!, this.seat];
        const k = Math.min(1, this.t);
        this.leap(k, from, to, 0.25, this.phase === 'cool');
        this.turn(this.headingTo(this.seat, this.cool!), dt);
        if (k < 1) break;
        this.walker.visible = false;
        this.sleeper.visible = true;
        this.sprawl(this.phase === 'cool');
        this.phase = 'asleep';
        break;
      }
      case 'asleep':
      case 'inside': {
        const settled = (this.phase === 'inside') === wantIn;
        this.wait = settled ? 0 : this.wait + dt;
        if (this.wait < this.spec.delay) return;
        this.wait = 0;
        this.sleeper.visible = false;
        this.walker.visible = true;
        if (this.phase === 'asleep' && this.sprawled && this.cool) {
          // off the stones, no jump: already on the ground
          this.sprawl(false);
          this.phase = 'in';
          this.s = 0;
          this.walker.position.copy(this.cool);
          this.heading = this.headingTo(this.cool, this.points[0].at);
        } else if (this.phase === 'asleep' && !this.hop) {
          this.sprawl(false);
          this.phase = 'in';
          this.s = 0;
          this.heading = this.headingAlong(0, 1);
        } else if (this.phase === 'asleep') {
          this.sprawl(false);
          this.phase = 'down';
          this.t = 0;
          this.heading = this.headingTo(this.seat, this.points[0].at);
        } else {
          this.phase = 'out';
          this.s = end;
          this.heading = this.headingAlong(end, -1);
        }
        break;
      }
      case 'down':
      case 'up': {
        this.t += dt / HOP;
        const down = this.phase === 'down';
        const [from, to] = down ? [this.seat, this.points[0].at] : [this.points[0].at, this.seat];
        const k = Math.min(1, this.t);
        this.leap(k, from, to, 0.3 + Math.max(0, to.y - from.y) * 0.6, down);
        this.turn(this.headingTo(from, to), dt);
        if (k < 1) break;
        if (down) {
          this.phase = wantIn ? 'in' : 'out';
          this.s = 0;
        } else {
          this.phase = 'asleep';
          this.walker.visible = false;
          this.sleeper.visible = true;
        }
        break;
      }
      case 'in':
      case 'out': {
        if (this.phase === 'in' && !wantIn) this.phase = 'out'; // turned round on the way: it's stopped
        else if (this.phase === 'out' && wantIn) this.phase = 'in';
        const dir = this.phase === 'in' ? 1 : -1;
        this.s = THREE.MathUtils.clamp(this.s + dir * this.spec.speed * dt, 0, end);
        this.place(this.s);
        this.turn(this.headingAlong(this.s, dir), dt);
        this.stride += this.spec.speed * dt * 9;
        moving = true;
        if (dir > 0 && this.s >= end) {
          this.phase = 'inside';
          this.walker.visible = false;
        } else if (dir < 0 && this.s <= 0 && this.hop) {
          this.phase = 'up';
          this.t = 0;
        } else if (dir < 0 && this.s <= 0) {
          this.phase = 'asleep';
          this.walker.visible = false;
          this.sleeper.visible = true;
        }
        break;
      }
    }
    this.walker.rotation.set(0, this.heading, 0);
    this.walker.scale.copy(this.baseScale).multiplyScalar(this.morph);
    this.pose(moving);
  }

  // --- along the route -------------------------------------------------------------

  private segment(s: number) {
    let i = 1;
    while (i < this.lengths.length - 1 && this.lengths[i] < s) i++;
    return i;
  }

  private place(s: number) {
    const i = this.segment(s);
    const a = this.points[i - 1];
    const b = this.points[i];
    const k = (s - this.lengths[i - 1]) / (this.lengths[i] - this.lengths[i - 1] || 1);
    const p = this.walker.position.lerpVectors(a.at, b.at, k);
    p.y = heightBetween(a, b, p, this.ground);
  }

  private headingAlong(s: number, dir: number) {
    const i = this.segment(s);
    const [a, b] = dir > 0 ? [this.points[i - 1].at, this.points[i].at] : [this.points[i].at, this.points[i - 1].at];
    return this.headingTo(a, b);
  }

  private headingTo(a: THREE.Vector3, b: THREE.Vector3) {
    return Math.atan2(-(b.z - a.z), b.x - a.x); // the model faces +x
  }

  private turn(want: number, dt: number) {
    let d = want - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * (1 - Math.exp(-TURN * dt));
  }

  /**
   * A jump, `t` (0..1) through it, from `from` to `to`: it gathers itself for a moment (down low,
   * tail wiggling), springs, stretches out in the air, lands with a squash and straightens up.
   * `leaving`: it has just got up from curled-up asleep, so it grows into its full size as it
   * gathers; landing back on the bench it shrinks down again, ready to curl up.
   */
  private leap(t: number, from: THREE.Vector3, to: THREE.Vector3, height: number, leaving: boolean) {
    const flight = THREE.MathUtils.clamp((t - 0.22) / 0.56, 0, 1);
    this.crouch = step(0, 0.16, t) * (1 - step(0.19, 0.24, t));
    this.air = Math.sin(flight * Math.PI);
    this.land = t > 0.78 ? 1 - step(0.78, 1, t) : 0;
    if (leaving) this.morph = 0.62 + 0.38 * step(0, 0.2, t);
    else this.morph = 1 - 0.38 * step(0.8, 1, t);
    const along = flight * 0.85 + step(0, 1, flight) * 0.15; // nearly steady across, easing a little at each end
    const p = this.walker.position.lerpVectors(from, to, along);
    p.y = THREE.MathUtils.lerp(from.y, to.y, along) + this.air * height;
  }

  // --- body language ---------------------------------------------------------------

  private pose(moving: boolean) {
    const { body, head, tail, legs } = this.parts;
    for (const [o, r] of this.rest) o.rotation.copy(r);
    if (!body) return;
    const s = this.stride;
    const { air, crouch, land } = this;
    this.wiggle += crouch > 0 ? 0.5 : 0;
    // a trot: diagonal pairs swing together; in the air, front paws reach and back legs push off
    legs.forEach((leg, i) => {
      const front = i < 2;
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      leg.rotation.z += moving ? Math.sin(s + phase) * 0.5 : 0;
      leg.rotation.z += air * (front ? 0.7 : -0.6);
    });
    body.position.y = this.bodyY + (moving ? Math.abs(Math.sin(s)) * 0.025 : 0) - 0.09 * crouch - 0.08 * land;
    const off = this.phase === 'down' || this.phase === 'cool';
    body.rotation.z = air * (off ? -0.25 : 0.25) + (off ? 0.08 : -0.08) * crouch + 0.1 * land; // nose down off the bench, up onto it; up a little to look at where it's going
    body.scale.set(1 + 0.1 * air + 0.04 * land, 1 - 0.07 * land - 0.05 * crouch, 1); // stretched in the air, squashed down low
    if (head) head.rotation.z += (moving ? Math.sin(s * 2) * 0.05 : 0) + 0.25 * crouch; // eyes on the landing
    if (tail) tail.rotation.x += Math.sin(s * 0.5) * 0.15 + crouch * Math.sin(this.wiggle) * 0.4; // tail up, the tip bobbing side to side (and a wiggle before a jump)
  }
}

/**
 * When it rains, the animals go indoors: Charlie and George wake up, jump off the bench and
 * trot home to the lighthouse, Beike runs after them (with his ball), and the black cat on the
 * pier heads all the way up the trail to the hut, to sleep on Vincent's bed. They come back out
 * once it's dry, and the rooms (quarters.ts, hut-room.ts) show them asleep inside meanwhile.
 * Charlie and George aren't always on the bench to start with, though (chooseBeds()): from
 * anywhere else they make their way to the bench's route first.
 */
export class Shelter {
  private cats: Cat[] = [];
  private wantIn = false;
  private settling = false;
  /** Now and then, dry days too, Charlie and George spend a while in the lighthouse (and Beike stays out). */
  private visit = { on: false, wait: 60 + Math.random() * 90 };

  /** `hour`: the time of day on the island when you arrive, for where the cats have gone to sleep. */
  constructor(
    island: Island,
    private beike: Beike,
    hour: number,
  ) {
    chooseBeds(hour);
    for (const spec of CATS) {
      const sleeper = island.get(spec.id);
      const walker = island.root.getObjectByName(`${spec.id}_walk`);
      let route = island.routes.get(spec.route);
      if (!sleeper || !walker || !route?.length) continue;
      const bed = spec.id in beds ? beds[spec.id as keyof typeof beds] : 'bench';
      const nook = bed === 'bench' ? null : NOOKS[bed];
      const way = nook && tuckIn(island, sleeper, nook, beike.ground);
      if (way) route = [...way, ...route.slice(nook.join)];
      else if (spec.id in beds) beds[spec.id as keyof typeof beds] = 'bench';
      this.cats.push(new Cat(spec, sleeper, walker, route, beike.ground, !way, !way || nook!.hop));
    }
    const route = island.routes.get('beike');
    if (route?.length) beike.shelterRoute = route;
  }

  /** Whether Charlie and George are both asleep on their bench. */
  get onTheBench() {
    return this.cats.filter((c) => c.id !== 'cat').every((c) => c.asleep && c.onBench);
  }

  /** Whatever the weather is on the next update, they're already where it would have put them. */
  settle() {
    this.settling = true;
  }

  /** Both cats in the lighthouse, for as long as you like (a preview: ?cats=in). */
  visitNow() {
    this.visit = { on: true, wait: 1e9 };
  }

  /** `rain` and `hot` are 0..1; `instant` skips the walking (reduced motion). */
  update(dt: number, rain: number, instant = false, hot = 0) {
    const was = this.wantIn;
    this.wantIn = rain > GO_IN || (this.wantIn && rain > COME_OUT);
    const v = this.visit;
    if (!this.wantIn && !instant && !this.settling && (v.wait -= dt) <= 0) {
      v.on = !v.on;
      v.wait = v.on ? 150 + Math.random() * 150 : 150 + Math.random() * 210;
    }
    const catsIn = this.wantIn || v.on;
    if (this.settling || (instant && was !== this.wantIn)) {
      this.cats.forEach((c) => c.snap(catsIn, hot));
      this.beike.snap(this.wantIn);
      this.settling = false;
    } else if (!instant) {
      this.cats.forEach((c) => c.update(dt, catsIn, hot));
      this.beike.sheltering = this.wantIn;
    }
    for (const [id, inside] of [...this.cats.map((c) => [c.id, c.inside] as const), ['beike', this.beike.inside] as const]) {
      if (inside) indoors.add(id);
      else indoors.delete(id);
    }
  }
}
