import * as THREE from 'three';
import type { Beike, Ground } from './beike';
import type { Island } from './island';

const damp = THREE.MathUtils.damp;
const ease = THREE.MathUtils.smootherstep;

const GO_IN = 0.1; // rain (0..1) that sends them indoors…
const COME_OUT = 0.04; // …and how far it has to ease off before they come back out
const HOP = 0.55; // seconds to jump down off the bench (or back up)
const TURN = 8;

/** Who's indoors right now, by id ("charlie", "george", "cat", "beike"): the rooms show them there. */
export const indoors = new Set<string>();

/**
 * Charlie's ambush in the lighthouse (quarters.ts), while Vincent's at his desk: one tiny mew,
 * and then he's on Vincent's back, claws and all. `on` while he's up there.
 */
export const ambush = { on: false };

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

type Phase = 'asleep' | 'down' | 'in' | 'inside' | 'out' | 'up';

interface CatSpec {
  id: string;
  route: string;
  speed: number; // m/s
  delay: number; // seconds after the rain comes (or goes) before this one gets up
  front?: number; // jumps down this far in front of where it sleeps (off the bench)
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

  constructor(
    private spec: CatSpec,
    private sleeper: THREE.Object3D,
    private walker: THREE.Object3D,
    route: Waypoint[],
    private ground: Ground,
  ) {
    this.seat = sleeper.getWorldPosition(new THREE.Vector3());
    this.points = [...route];
    if (spec.front) {
      // the cat's frame faces -y in Blender, which is +z here
      const ahead = new THREE.Vector3(0, 0, 1).applyQuaternion(sleeper.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
      const at = this.seat.clone().addScaledVector(ahead, spec.front);
      this.points.unshift({ at: at.setY(ground.at(at.x, at.z)), fixed: false });
    }
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

  get asleep() {
    return this.phase === 'asleep';
  }

  /** Straight to where the weather says it should be, no walking (on arrival, or with reduced motion). */
  snap(wantIn: boolean) {
    this.phase = wantIn ? 'inside' : 'asleep';
    this.sleeper.visible = !wantIn;
    this.walker.visible = false;
    this.wait = 0;
  }

  update(dt: number, wantIn: boolean) {
    const end = this.lengths[this.lengths.length - 1];
    let moving = false;
    switch (this.phase) {
      case 'asleep':
      case 'inside': {
        const settled = (this.phase === 'inside') === wantIn;
        this.wait = settled ? 0 : this.wait + dt;
        if (this.wait < this.spec.delay) return;
        this.wait = 0;
        this.sleeper.visible = false;
        this.walker.visible = true;
        if (this.phase === 'asleep') {
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
        const p = this.walker.position.lerpVectors(from, to, ease(k, 0, 1));
        p.y += Math.sin(k * Math.PI) * (0.3 + Math.max(0, to.y - from.y) * 0.6);
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
        } else if (dir < 0 && this.s <= 0) {
          this.phase = 'up';
          this.t = 0;
        }
        break;
      }
    }
    this.walker.rotation.set(0, this.heading, 0);
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

  // --- body language ---------------------------------------------------------------

  private pose(moving: boolean) {
    const { body, head, tail, legs } = this.parts;
    for (const [o, r] of this.rest) o.rotation.copy(r);
    if (!body) return;
    const s = this.stride;
    const jumping = this.phase === 'down' || this.phase === 'up';
    const air = jumping ? Math.sin(Math.min(1, this.t) * Math.PI) : 0;
    // a trot: diagonal pairs swing together; in the air, front paws reach and back legs push off
    legs.forEach((leg, i) => {
      const front = i < 2;
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      leg.rotation.z += moving ? Math.sin(s + phase) * 0.5 : 0;
      leg.rotation.z += air * (front ? 0.7 : -0.6);
    });
    body.position.y = this.bodyY + (moving ? Math.abs(Math.sin(s)) * 0.025 : 0);
    body.rotation.z = air * (this.phase === 'down' ? -0.25 : 0.25); // nose down off the bench, up onto it
    if (head) head.rotation.z += moving ? Math.sin(s * 2) * 0.05 : 0;
    if (tail) tail.rotation.x += Math.sin(s * 0.5) * 0.15; // tail up, the tip bobbing side to side
  }
}

/**
 * When it rains, the animals go indoors: Charlie and George wake up, jump off the bench and
 * trot home to the lighthouse, Beike runs after them (with his ball), and the black cat on the
 * pier heads all the way up the trail to the hut, to sleep on Vincent's bed. They come back out
 * once it's dry, and the rooms (quarters.ts, hut-room.ts) show them asleep inside meanwhile.
 */
export class Shelter {
  private cats: Cat[] = [];
  private wantIn = false;
  private settling = false;

  constructor(
    island: Island,
    private beike: Beike,
  ) {
    for (const spec of CATS) {
      const sleeper = island.get(spec.id);
      const walker = island.root.getObjectByName(`${spec.id}_walk`);
      const route = island.routes.get(spec.route);
      if (sleeper && walker && route?.length) this.cats.push(new Cat(spec, sleeper, walker, route, beike.ground));
    }
    const route = island.routes.get('beike');
    if (route?.length) beike.shelterRoute = route;
  }

  /** Whether Charlie and George are both asleep on their bench. */
  get onTheBench() {
    return this.cats.filter((c) => c.id !== 'cat').every((c) => c.asleep);
  }

  /** Whatever the weather is on the next update, they're already where it would have put them. */
  settle() {
    this.settling = true;
  }

  /** `rain` is 0..1; `instant` skips the walking (reduced motion). */
  update(dt: number, rain: number, instant = false) {
    const was = this.wantIn;
    this.wantIn = rain > GO_IN || (this.wantIn && rain > COME_OUT);
    if (this.settling || (instant && was !== this.wantIn)) {
      this.cats.forEach((c) => c.snap(this.wantIn));
      this.beike.snap(this.wantIn);
      this.settling = false;
    } else if (!instant) {
      this.cats.forEach((c) => c.update(dt, this.wantIn));
      this.beike.sheltering = this.wantIn;
    }
    for (const [id, inside] of [...this.cats.map((c) => [c.id, c.inside] as const), ['beike', this.beike.inside] as const]) {
      if (inside) indoors.add(id);
      else indoors.delete(id);
    }
  }
}
