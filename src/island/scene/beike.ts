import * as THREE from 'three';
import type { Island } from './island';
import { heightBetween, type Waypoint } from './shelter';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ease = THREE.MathUtils.smootherstep;
const damp = THREE.MathUtils.damp;

const TROT = 1.4; // m/s, pottering about
const RUN = 5.5; // m/s, after the ball
const TURN = 7; // how quickly he swings round to face where he's going
const GRAVITY = 9.8;
const BALL_R = 0.07; // the dog (and his ball) are scaled up 1.25× in Blender
const GREET = 4.2; // seconds: two jumps at you, flop, roll right over, bounce back up
const ROAM = 3; // m he wanders from his spot when nobody's playing
const CIRCLE = 1.1; // seconds: round once on the spot before he lies down

type Mood =
  | { kind: 'idle'; until: number }
  | { kind: 'wander'; to: THREE.Vector3 }
  | { kind: 'greet'; t: number }
  | { kind: 'offer'; t: number } // ball at your feet, play bow, waiting for a throw
  | { kind: 'chase' }
  | { kind: 'pickup'; t: number }
  | { kind: 'return' }
  // in out of the rain, or back out; over to the campfire with his ball (`fire`), or back home from it (`home`)
  | { kind: 'trip'; path: Waypoint[]; leg: number; indoors: boolean; fire?: boolean; home?: boolean }
  | { kind: 'inside' }
  // by the fire once Vincent's done kicking: a few mad laps round it, then a turn on the spot and down
  | { kind: 'zoomies'; path: THREE.Vector3[]; leg: number }
  | { kind: 'settle'; t: number; up?: number };

export type Poke = 'greet' | 'offer' | 'throw' | 'busy';

/** Heights straight off the terrain grid's vertices, bilinearly blended between them. */
export class Ground {
  private heights = new Map<number, number>();
  private cell: number;

  constructor(terrain: THREE.Mesh, cell: number) {
    this.cell = cell;
    const pos = terrain.geometry.getAttribute('position');
    const p = V();
    terrain.updateMatrixWorld(true);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(terrain.matrixWorld);
      this.heights.set(this.key(Math.round(p.x / cell), Math.round(p.z / cell)), p.y);
    }
  }

  private key(ix: number, iz: number) {
    return (ix + 1000) * 4000 + (iz + 1000);
  }

  /** Ground height at (x, z); NaN over open sea. */
  at(x: number, z: number) {
    const fx = x / this.cell;
    const fz = z / this.cell;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const h = (dx: number, dz: number) => this.heights.get(this.key(ix + dx, iz + dz)) ?? NaN;
    const u = fx - ix;
    const v = fz - iz;
    return (h(0, 0) * (1 - u) + h(1, 0) * u) * (1 - v) + (h(0, 1) * (1 - u) + h(1, 1) * u) * v;
  }
}

/**
 * Beike, Vincent's dad's dog. He potters about his patch of meadow wagging his tail; when a
 * visitor clicks him he jumps up at them, flops down and rolls right over, then drops his ball
 * at their feet and waits. Click again and the ball flies; he tears after it and brings it back.
 * He never gets tired of this.
 */
export class Beike {
  private root?: THREE.Object3D;
  private body?: THREE.Object3D;
  private head?: THREE.Object3D;
  private tail?: THREE.Object3D;
  private tongue?: THREE.Object3D;
  private ball?: THREE.Object3D;
  private ears: THREE.Object3D[] = [];
  private legs: THREE.Object3D[] = []; // front left, front right, back left, back right
  private rest = new Map<THREE.Object3D, { p: THREE.Vector3; r: THREE.Euler }>();
  readonly ground: Ground;
  private obstacles: { at: THREE.Vector3; r: number }[] = [];
  /** What he runs round rather than through at the campfire: the fire itself, the logs, Vincent. */
  private keepClear: { at: THREE.Vector3; r: number }[] = [];
  private fire?: THREE.Vector3;

  private home = V();
  private heading = 0;
  private stride = 0;
  private speed = 0;
  private joy = 0.2; // 0 calm … 1 beside himself; drives the wag and the panting
  private clock = 0;
  private mood: Mood = { kind: 'idle', until: 2 };
  private greeted = -Infinity;
  private face = V(); // where the visitor is standing (the camera, on the ground)
  private dropAt = V(); // where he brings the ball back to
  private mouthScale = V(1, 1, 1); // the ball's scale in his mouth: attach() bakes his scale in when he drops it
  /** Over at the campfire, dropping his ball at Vincent's feet mid-song (visit()). */
  private away: { spot: THREE.Vector3; vincent: THREE.Vector3; back: Waypoint[]; rounds: number } | null = null;

  private inMouth = true;
  private ballVel = V();
  private ballFlying = false;
  private mouth = V();
  /** How many times he's brought the ball back this visit. */
  fetched = 0;
  /** Called when he barks (the island plays the sound). */
  onBark?: () => void;
  /** His way in to the lighthouse when it rains, from his meadow to just inside the door (shelter.ts). */
  shelterRoute?: Waypoint[];
  /** Whether it's raining hard enough to go in (set every frame). */
  sheltering = false;

  constructor(island: Island) {
    this.ground = new Ground(island.terrain, island.info.cell);
    const root = island.get('beike');
    if (!root) return;
    this.root = root;
    this.home.copy(root.position);
    // read the heading off the direction he faces: a turn past 90° comes out of the glTF as
    // Euler (π, π − θ, π), and keeping those two flips would have him running backwards
    const ahead = V(1, 0, 0).applyQuaternion(root.quaternion);
    this.heading = Math.atan2(-ahead.z, ahead.x);
    root.rotation.set(0, this.heading, 0);
    const part = (name: string) => {
      const o = root.getObjectByName(name);
      if (o) this.rest.set(o, { p: o.position.clone(), r: o.rotation.clone() });
      return o;
    };
    this.body = part('beike_body');
    this.head = part('beike_head');
    this.tail = part('beike_tail');
    this.tongue = part('beike_tongue');
    this.ball = part('beike_ball');
    this.ears = ['beike_ear_l', 'beike_ear_r'].map(part).filter((o): o is THREE.Object3D => !!o);
    this.legs = ['fl', 'fr', 'bl', 'br'].map((n) => part(`beike_leg_${n}`)).filter((o): o is THREE.Object3D => !!o);
    if (this.ball) {
      this.mouth.copy(this.ball.position);
      this.mouthScale.copy(this.ball.scale);
      this.ball.userData.id = 'beike'; // clicking the ball counts as clicking him, even once he's dropped it
    }

    // don't throw the ball into buildings, the bench or the cats
    const big: Record<string, number> = { library: 7.5, workshop: 7, lighthouse: 4.5 };
    for (const [id, o] of island.named) {
      if (id === 'beike') continue;
      this.obstacles.push({ at: o.getWorldPosition(V()), r: big[id] ?? 1.8 });
    }
    // …or into the trees, bushes, rocks, lamps and log seats
    for (const o of island.root.children) {
      if (/^(tree|lamp|log)/.test(o.name)) this.obstacles.push({ at: o.getWorldPosition(V()), r: 1.2 });
      if (/^log/.test(o.name)) this.keepClear.push({ at: o.getWorldPosition(V()), r: 0.9 });
    }
    this.fire = island.positionOf('campfire');
    if (this.fire) this.keepClear.push({ at: this.fire.clone(), r: 1.25 }); // the ring of stones is ~1 m across
    const vincent = island.positionOf('vincent');
    if (vincent) this.keepClear.push({ at: vincent, r: 0.6 });
  }

  /** His tennis ball: the island registers it for clicks, since it doesn't always stay in his mouth. */
  get tennisBall() {
    return this.ball;
  }

  /** Whether the ball is lying at the visitor's feet, waiting to be thrown. */
  get waiting() {
    return this.mood.kind === 'offer';
  }

  /** Whether his ball is lying at Vincent's feet by the fire, waiting for a kick. */
  get atFire() {
    return !!this.away && this.mood.kind === 'offer' && !this.inMouth;
  }

  /** Whether he's lying down by the fire, done with the ball for now. */
  get settled() {
    return this.mood.kind === 'settle' && this.mood.up === undefined;
  }

  /** Up from his spot by the fire (the song's over, or Vincent's gone) and off home. */
  wakeUp() {
    if (this.mood.kind === 'settle' && this.mood.up === undefined) this.mood.up = 0;
  }

  /** Whether he's off at the campfire (or on his way there or back). */
  get visiting() {
    return !!this.away || (this.mood.kind === 'trip' && !!this.mood.home);
  }

  /**
   * Off to the campfire with his ball, along `route` (from his meadow), to drop it at Vincent's
   * feet (`spot`) and wait. Only if he's pottering about with his ball, and it isn't raining.
   */
  visit(route: Waypoint[], spot: THREE.Vector3, vincent: THREE.Vector3) {
    const kind = this.mood.kind;
    if (!this.root || this.sheltering || !this.inMouth || (kind !== 'idle' && kind !== 'wander')) return false;
    const here: Waypoint = { at: this.root.position.clone(), fixed: false };
    const at: Waypoint = { at: spot.clone(), fixed: false };
    this.away = {
      spot: spot.clone(),
      vincent: vincent.clone(),
      back: [...route].reverse().concat({ at: this.home.clone(), fixed: false }),
      rounds: 2 + Math.floor(Math.random() * 2),
    };
    this.mood = { kind: 'trip', path: [here, ...route, at], leg: 1, indoors: false, fire: true };
    this.joy = 1;
    return true;
  }

  /** Vincent flicks the ball away with his foot, without missing a chord. */
  kicked() {
    if (this.atFire) this.throwBall();
  }

  /** Back to his meadow from the fire. */
  private goHome() {
    if (!this.root || !this.away) return;
    const here: Waypoint = { at: this.root.position.clone(), fixed: false };
    this.mood = { kind: 'trip', path: [here, ...this.away.back], leg: 1, indoors: false, home: true };
    this.away = null;
  }

  /**
   * Done with the ball: a lap or two round the fire flat out, then back to Vincent's feet to lie
   * down. Not enough open grass for a lap, and he just lies down.
   */
  private zoomies() {
    if (!this.root || !this.away) return;
    const spot = this.away.spot;
    const path: THREE.Vector3[] = [];
    if (this.fire) {
      const c = this.fire;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const start = Math.atan2(this.root.position.z - c.z, this.root.position.x - c.x);
      const steps = Math.round(rand(10, 18)); // 8 to a lap
      for (let i = 1; i <= steps; i++) {
        const a = start + (dir * i * Math.PI * 2) / 8;
        const r = rand(3.4, 4.4);
        const p = V(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
        p.y = this.ground.at(p.x, p.z);
        if (this.walkable(p)) path.push(p);
      }
    }
    if (path.length < 4) path.length = 0;
    path.push(spot.clone());
    this.mood = { kind: 'zoomies', path, leg: 0 };
  }

  /** Whether he's indoors, out of the rain. */
  get inside() {
    return this.mood.kind === 'inside';
  }

  /** Straight in (or out) with his ball, no running: on arrival, or with reduced motion. */
  snap(inside: boolean) {
    if (!this.root || !this.shelterRoute) return;
    if (!this.inMouth) this.pickUp();
    this.root.position.copy(inside ? this.shelterRoute[this.shelterRoute.length - 1].at : this.home);
    this.root.visible = !inside;
    this.sheltering = inside;
    this.away = null;
    this.mood = inside ? { kind: 'inside' } : { kind: 'idle', until: this.clock + 2 };
  }

  /** Where he is right now (for the camera and the hover label). */
  get position() {
    return this.root?.position.clone() ?? V();
  }

  /** The tip of his nose and the way it points, in world space (for his breath on a cold day). False if he isn't there. */
  muzzle(at: THREE.Vector3, facing: THREE.Vector3) {
    if (!this.head || !this.root?.visible) return false;
    this.head.localToWorld(at.set(0.32, 0, -0.01));
    facing.set(1, 0, 0).transformDirection(this.head.matrixWorld);
    return true;
  }

  /** How hard he's panting, 0..1. */
  get panting() {
    return this.joy;
  }

  /**
   * Someone clicked him. `visitor` is where they're looking from (the camera).
   * First click (or after a while): a greeting. Ball at their feet: a throw.
   */
  poke(visitor: THREE.Vector3): Poke {
    if (!this.root) return 'busy';
    const kind = this.mood.kind;
    if (kind === 'offer') {
      this.throwBall();
      return 'throw';
    }
    if (kind !== 'idle' && kind !== 'wander') return 'busy';
    // stand in front of him, a step towards whoever's watching
    const toward = V(visitor.x - this.root.position.x, 0, visitor.z - this.root.position.z).normalize();
    this.face.copy(this.root.position).addScaledVector(toward, 4);
    this.dropAt.copy(this.root.position);
    this.joy = 1;
    if (this.clock - this.greeted > 90) {
      this.greeted = this.clock;
      this.mood = { kind: 'greet', t: 0 };
      return 'greet';
    }
    this.mood = { kind: 'offer', t: 0 };
    return 'offer';
  }

  update(dt: number) {
    if (!this.root) return;
    this.clock += dt;
    this.weather();
    const m = this.mood;
    let target: THREE.Vector3 | null = null;
    let pace = 0;

    switch (m.kind) {
      case 'idle':
        if (this.clock > m.until) {
          const a = rand(0, Math.PI * 2);
          const to = this.home.clone().add(V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(rand(0.5, ROAM)));
          this.mood = this.walkable(to) ? { kind: 'wander', to } : { kind: 'idle', until: this.clock + 2 };
        }
        break;
      case 'wander':
        target = m.to;
        pace = TROT;
        if (this.flatDistance(m.to) < 0.2) this.mood = { kind: 'idle', until: this.clock + rand(4, 10) };
        break;
      case 'greet':
        m.t += dt;
        this.turnTo(this.face, dt);
        if (m.t >= GREET) this.mood = { kind: 'offer', t: 0 };
        break;
      case 'offer':
        m.t += dt;
        this.turnTo(this.face, dt);
        if (m.t > 0.35 && this.inMouth) this.dropBall();
        if (m.t > 30) {
          // nobody's throwing: he picks it up and wanders off with it
          this.pickUp();
          if (this.away) this.goHome();
          else this.mood = { kind: 'idle', until: this.clock + 3 };
        }
        break;
      case 'chase':
        if (this.ball && !this.ballFlying) {
          target = this.ball.getWorldPosition(V());
          pace = RUN;
          if (this.flatDistance(target) < 0.45 && this.ballVel.length() < 1.5) this.mood = { kind: 'pickup', t: 0 };
        } else if (this.ball) {
          // run to where it's going to land
          target = this.ball.getWorldPosition(V()).addScaledVector(this.ballVel, 0.3);
          pace = RUN;
        }
        break;
      case 'pickup':
        m.t += dt;
        if (m.t > 0.25 && !this.inMouth) this.pickUp();
        if (m.t > 0.45) this.mood = { kind: 'return' };
        break;
      case 'return':
        target = this.dropAt;
        pace = RUN * 0.8;
        if (this.flatDistance(this.dropAt) < 0.3) {
          this.fetched++;
          if (this.away && --this.away.rounds <= 0) this.zoomies();
          else this.mood = { kind: 'offer', t: 0 };
        }
        break;
      case 'trip': {
        target = m.path[m.leg].at;
        pace = RUN * 0.7;
        if (this.flatDistance(target) > 0.3) break;
        if (m.leg < m.path.length - 1) m.leg++;
        else if (m.fire && this.away) {
          // at Vincent's feet: face him, drop the ball, wait
          this.face.copy(this.away.vincent);
          this.dropAt.copy(this.away.spot);
          this.mood = { kind: 'offer', t: 0 };
        } else if (m.indoors) {
          this.mood = { kind: 'inside' };
          this.root.visible = false;
        } else this.mood = { kind: 'idle', until: this.clock + rand(2, 5) };
        break;
      }
      case 'inside':
        break;
      case 'zoomies':
        target = m.path[m.leg];
        pace = m.leg < m.path.length - 1 ? RUN : TROT; // the last leg, to his spot, at a trot
        if (this.flatDistance(target) > 0.4) break;
        if (m.leg < m.path.length - 1) m.leg++;
        else this.mood = { kind: 'settle', t: 0 };
        break;
      case 'settle':
        m.t += dt;
        if (m.t < CIRCLE) {
          // round once on the spot before lying down, like they do
          this.heading += (Math.PI * 2 * dt) / CIRCLE;
          this.stride += dt * 5;
          pace = TROT * 0.5;
        } else if (this.fire) this.turnTo(this.fire, dt); // and down facing the fire
        if (m.up !== undefined && (m.up += dt) > 0.7) this.goHome();
        break;
    }

    this.speed = damp(this.speed, pace, 6, dt);
    if (target) this.moveTo(target, dt);
    const p = this.root.position;
    const on = this.mood.kind === 'trip' ? this.mood : null;
    p.y = (on ? heightBetween(on.path[on.leg - 1], on.path[on.leg], p, this.ground) : this.ground.at(p.x, p.z)) || p.y;
    this.root.rotation.y = this.heading;

    const excited = m.kind !== 'idle' && m.kind !== 'wander' && m.kind !== 'settle';
    this.joy = damp(this.joy, excited ? 1 : 0.25, 0.8, dt);
    this.updateBall(dt);
    this.pose();
  }

  /**
   * Rain: he fetches his ball if it's lying about, then runs in to the lighthouse after the cats.
   * Dry again: back out to his meadow. Change of weather halfway: he turns round.
   */
  private weather() {
    const route = this.shelterRoute;
    if (!route || !this.root) return;
    const m = this.mood;
    const here: Waypoint = { at: this.root.position.clone(), fixed: false };
    const turnRound = (trip: Extract<Mood, { kind: 'trip' }>) =>
      ({ kind: 'trip', path: [here, ...trip.path.slice(0, trip.leg).reverse()], leg: 1, indoors: !trip.indoors }) as Mood;
    if (this.sheltering) {
      if (m.kind === 'inside' || (m.kind === 'trip' && m.indoors)) return;
      // rained off at the campfire: his ball first, then home by way of the meadow
      if (this.away || (m.kind === 'trip' && m.home)) {
        if (!this.inMouth) {
          if (m.kind !== 'chase' && m.kind !== 'pickup') this.mood = { kind: 'chase' };
          return;
        }
        if (m.kind === 'pickup') return;
        const back = this.away ? this.away.back : m.kind === 'trip' ? m.path.slice(m.leg) : [];
        this.mood = { kind: 'trip', path: [here, ...back, ...route], leg: 1, indoors: true };
        this.away = null;
        return;
      }
      if (m.kind === 'trip') this.mood = turnRound(m);
      else if (!this.inMouth) {
        if (m.kind !== 'chase' && m.kind !== 'pickup') this.mood = { kind: 'chase' }; // not without his ball
      } else if (m.kind !== 'pickup') this.mood = { kind: 'trip', path: [here, ...route], leg: 1, indoors: true };
    } else if (m.kind === 'inside') {
      this.root.visible = true;
      this.mood = { kind: 'trip', path: [...route].reverse().concat({ at: this.home.clone(), fixed: false }), leg: 1, indoors: false };
    } else if (m.kind === 'trip' && m.indoors) {
      this.mood = turnRound(m);
    }
  }

  // --- moving about ---------------------------------------------------------------

  private flatDistance(p: THREE.Vector3) {
    return Math.hypot(p.x - this.root!.position.x, p.z - this.root!.position.z);
  }

  private turnTo(p: THREE.Vector3, dt: number) {
    const dx = p.x - this.root!.position.x;
    const dz = p.z - this.root!.position.z;
    if (Math.hypot(dx, dz) < 0.05) return;
    const want = Math.atan2(-dz, dx); // the model faces +x
    let d = want - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * (1 - Math.exp(-TURN * dt));
  }

  private moveTo(p: THREE.Vector3, dt: number) {
    this.turnTo(this.visiting ? this.around(p) : p, dt);
    const dist = this.flatDistance(p);
    // only run the way he's facing, so he swings round before setting off
    const step = Math.min(dist, this.speed * dt);
    this.root!.position.x += Math.cos(this.heading) * step;
    this.root!.position.z -= Math.sin(this.heading) * step;
    this.stride += step * (this.speed > 3 ? 2.2 : 3.2);
  }

  /**
   * Where to head for on the way to `p` so as not to go through the fire, a log or Vincent: if
   * one's in the way, a point just off its edge, on whichever side he's already passing.
   */
  private around(p: THREE.Vector3) {
    const at = this.root!.position;
    const dx = p.x - at.x;
    const dz = p.z - at.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return p;
    const ux = dx / len;
    const uz = dz / len;
    let best: THREE.Vector3 | null = null;
    let nearest = Infinity;
    for (const c of this.keepClear) {
      // not the one he's standing in, or the one he's headed for
      if (Math.hypot(c.at.x - at.x, c.at.z - at.z) < c.r || Math.hypot(c.at.x - p.x, c.at.z - p.z) < c.r) continue;
      const along = (c.at.x - at.x) * ux + (c.at.z - at.z) * uz;
      if (along < 0 || along > len || along > nearest) continue;
      const side = (c.at.x - at.x) * -uz + (c.at.z - at.z) * ux; // how far off his line it is, and which way
      if (Math.abs(side) > c.r) continue;
      const s = side > 0 ? -1 : 1; // go round the side it isn't on
      nearest = along;
      best = V(c.at.x - uz * s * (c.r + 0.5), p.y, c.at.z + ux * s * (c.r + 0.5));
    }
    return best ?? p;
  }

  /** Flat grass, on land, not inside anything. */
  private walkable(p: THREE.Vector3) {
    const h = this.ground.at(p.x, p.z);
    const base = this.away?.spot ?? this.home;
    if (!(h > 0.35) || Math.abs(h - base.y) > 1.2) return false;
    const slope = Math.max(
      Math.abs(this.ground.at(p.x + 0.5, p.z) - h),
      Math.abs(this.ground.at(p.x, p.z + 0.5) - h),
    );
    if (!(slope < 0.3)) return false;
    return this.obstacles.every((o) => Math.hypot(o.at.x - p.x, o.at.z - p.z) > o.r);
  }

  // --- the ball ------------------------------------------------------------------

  private throwBall() {
    if (!this.ball || !this.root) return;
    if (this.inMouth) this.dropBall(); // clicked before he'd even let go of it
    const from = this.ball.getWorldPosition(V());
    // somewhere out in the meadow, away from the visitor, on open grass all the way
    let to: THREE.Vector3 | null = null;
    const away = Math.atan2(this.root.position.z - this.face.z, this.root.position.x - this.face.x);
    for (let i = 0; i < 40 && !to; i++) {
      // Vincent's facing the fire, so he flicks it off to one side or the other, not into the flames
      const a = this.away ? away + (Math.random() < 0.5 ? -1 : 1) * rand(1.1, 1.9) : away + rand(-1.4, 1.4) * (1 + i / 20);
      const d = (this.away ? rand(3, 5.5) : rand(6, 10)) * (1 - i / 60); // a kick doesn't go as far
      const p = this.root.position.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d));
      let clear = true;
      // at the fire he starts out among the logs, so only the far end of the kick has to be open grass
      for (let k = this.away ? 0.75 : 0.25; k <= 1 && clear; k += 0.25) clear = this.walkable(this.root.position.clone().lerp(p, k));
      if (clear) to = p;
    }
    // no luck: just past his spot, on the side away from the fire
    to ??= this.away && this.fire
      ? this.away.spot.clone().add(this.away.spot.clone().sub(this.fire).setY(0).normalize().applyAxisAngle(V(0, 1, 0), rand(-1, 1)))
      : this.home.clone().add(V(rand(-1, 1), 0, rand(-1, 1)));
    to.y = this.ground.at(to.x, to.z);

    const flight = 1.1;
    this.ballVel.set((to.x - from.x) / flight, 0, (to.z - from.z) / flight);
    this.ballVel.y = (to.y + BALL_R - from.y + 0.5 * GRAVITY * flight * flight) / flight;
    this.ballFlying = true;
    this.onBark?.();
    this.mood = { kind: 'chase' };
    this.speed = 0;
  }

  private dropBall() {
    if (!this.ball || !this.root?.parent) return;
    this.root.parent.attach(this.ball);
    this.ball.rotation.set(0, 0, 0);
    this.inMouth = false;
    if (Math.random() < 0.5) this.onBark?.(); // "throw it!"
    // it plops out and rolls a little towards the visitor
    const toward = this.face.clone().sub(this.root.position).setY(0).normalize();
    this.ballVel.copy(toward).multiplyScalar(0.8).setY(0.6);
    this.ballFlying = true;
  }

  private pickUp() {
    if (!this.ball || !this.head) return;
    this.head.add(this.ball);
    this.ball.position.copy(this.mouth);
    this.ball.rotation.set(0, 0, 0);
    this.ball.scale.copy(this.mouthScale);
    this.ballVel.set(0, 0, 0);
    this.ballFlying = false;
    this.inMouth = true;
  }

  /** Arc, bounce, roll, stop. */
  private updateBall(dt: number) {
    if (!this.ball || this.inMouth) return;
    const b = this.ball;
    const floor = this.ground.at(b.position.x, b.position.z);
    if (this.ballFlying) {
      this.ballVel.y -= GRAVITY * dt;
      b.position.addScaledVector(this.ballVel, dt);
      if (!Number.isNaN(floor) && b.position.y < floor + BALL_R && this.ballVel.y < 0) {
        b.position.y = floor + BALL_R;
        this.ballVel.y *= -0.45;
        this.ballVel.x *= 0.7;
        this.ballVel.z *= 0.7;
        if (this.ballVel.y < 0.7) {
          this.ballVel.y = 0;
          this.ballFlying = false;
        }
      }
    } else {
      const k = Math.exp(-2.2 * dt);
      this.ballVel.x *= k;
      this.ballVel.z *= k;
      b.position.x += this.ballVel.x * dt;
      b.position.z += this.ballVel.z * dt;
      b.position.y = (this.ground.at(b.position.x, b.position.z) || floor) + BALL_R;
    }
    const roll = Math.hypot(this.ballVel.x, this.ballVel.z) * dt / BALL_R;
    b.rotation.z -= roll;
  }

  // --- body language ---------------------------------------------------------------

  private reset(o?: THREE.Object3D) {
    const r = o && this.rest.get(o);
    if (!o || !r) return;
    o.position.copy(r.p);
    o.rotation.copy(r.r);
  }

  private pose() {
    const t = this.clock;
    const { body, head, tail, tongue, legs, ears } = this;
    [body, head, tail, tongue, ...legs, ...ears].forEach((o) => this.reset(o));
    if (!body || !head) return;

    const running = this.speed > 3;
    const moving = this.speed > 0.2;
    const s = this.stride;
    const gait = Math.min(1, this.speed / TROT);

    // legs: a trot swings diagonal pairs; a gallop swings the fronts together, then the backs
    const swing = running ? 0.75 : 0.45 * gait;
    legs.forEach((leg, i) => {
      const phase = running ? (i < 2 ? 0 : Math.PI * 0.8) + (i % 2) * 0.3 : i === 0 || i === 3 ? 0 : Math.PI;
      leg.rotation.z += Math.sin(s + phase) * swing;
    });
    if (moving) {
      body.position.y += Math.abs(Math.sin(s)) * (running ? 0.08 : 0.03);
      body.rotation.z += running ? Math.sin(s + 0.5) * 0.12 : 0;
    }

    // idle: breathing, a look round now and then, a sniff at the grass
    const mood = this.mood.kind;
    if (mood === 'idle') {
      body.scale.setScalar(1 + Math.sin(t * 2.4) * 0.012);
      head.rotation.y += Math.sin(t * 0.45) * 0.35 * Math.max(0, Math.sin(t * 0.21));
      const sniff = Math.max(0, Math.sin(t * 0.33 + 1.3) - 0.7) / 0.3;
      head.rotation.z -= sniff * 0.55;
    } else {
      body.scale.setScalar(1);
    }

    if (this.mood.kind === 'greet') this.greetPose(this.mood.t);
    if (this.mood.kind === 'offer' || this.mood.kind === 'pickup') {
      // play bow when the ball's out, and the classic head tilt
      const k = this.mood.kind === 'offer' ? ease(this.mood.t, 0.3, 0.8) : 0;
      body.rotation.z -= 0.22 * k;
      body.position.y -= 0.06 * k;
      legs.slice(0, 2).forEach((l) => (l.rotation.z += 0.5 * k));
      legs.slice(2).forEach((l) => (l.rotation.z += 0.22 * k));
      const tilt = Math.max(0, Math.sin(t * 0.9)) ** 3;
      head.rotation.x += 0.35 * tilt * k;
      head.rotation.z += 0.25 * k;
    }
    if (this.mood.kind === 'pickup') head.rotation.z -= 0.9 * Math.sin(Math.min(1, this.mood.t / 0.45) * Math.PI);
    if (this.mood.kind === 'settle') this.liePose(this.mood.t, this.mood.up);

    // tail: a lazy sway when calm, a blur when he's excited
    if (tail) {
      const j = this.joy;
      tail.rotation.y += Math.sin(t * (5 + 13 * j)) * (0.18 + 0.45 * j);
      tail.rotation.x += Math.sin(t * (5 + 13 * j) + 0.6) * 0.12 * j;
    }
    // ears bounce as he runs and fly back at a gallop
    ears.forEach((e, i) => {
      const side = i === 0 ? 1 : -1;
      e.rotation.z -= running ? 0.7 : 0;
      e.rotation.x += side * (Math.sin(s * 2) * 0.15 * gait + (running ? 0.25 : 0));
    });
    // panting after a run, or when he's pleased to see you
    if (tongue) {
      tongue.visible = !this.inMouth;
      tongue.scale.set(1, 1, 1);
      tongue.position.y -= Math.abs(Math.sin(t * 9)) * 0.012 * this.joy;
    }
  }

  /**
   * Down by the fire, front paws out, back legs tucked under: breathing slow, head up watching
   * the flames, now and then resting it on his paws a while. `up`: getting back up.
   */
  private liePose(t: number, up?: number) {
    const { body, head, legs } = this;
    if (!body || !head) return;
    const [fl, fr, bl, br] = legs;
    const down = ease(t, CIRCLE, CIRCLE + 0.7) * (1 - ease(up ?? 0, 0, 0.5));
    body.position.y -= down * 0.2;
    body.scale.setScalar(1 + Math.sin(t * 1.6) * 0.015 * down);
    [fl, fr].forEach((l) => l && (l.rotation.z += down * 1.35));
    [bl, br].forEach((l) => l && (l.rotation.z -= down * 1.25));
    const rest = ease(Math.sin(t * 0.12 - 1.2), 0.3, 0.6); // chin on his paws, then up again for a look
    head.rotation.z -= down * rest * 0.45;
    head.rotation.y += down * (1 - rest) * Math.sin(t * 0.3) * 0.25;
  }

  /** Jump up at you, jump again, flop down, roll right over, bounce back up. */
  private greetPose(t: number) {
    const { body, head, legs } = this;
    if (!body || !head) return;
    const [fl, fr, bl, br] = legs;
    const up = (a: number, b: number) => ease(t, a, a + (b - a) / 2) * (1 - ease(t, a + (b - a) / 2, b));

    // two jumps: rear up, front paws out towards you
    const jump = t < 1.5 ? Math.sin(Math.min(1, (t % 0.75) / 0.75) * Math.PI) : 0;
    body.rotation.z += jump * 0.75;
    body.position.y += jump * 0.28;
    body.position.x -= jump * 0.12;
    head.rotation.z -= jump * 0.5; // keeps looking at you
    [fl, fr].forEach((l) => l && (l.rotation.z += jump * 1.1));
    [bl, br].forEach((l) => l && (l.rotation.z -= jump * 0.5));

    // flop down (1.5–1.9), roll right over (1.9–3.3), wiggle on his back in the middle, spring up
    const down = ease(t, 1.5, 1.9) * (1 - ease(t, 3.5, 3.9));
    body.position.y -= down * 0.2;
    const roll = ease(t, 1.9, 2.5) * Math.PI + ease(t, 2.9, 3.4) * Math.PI;
    const wiggle = t > 2.4 && t < 3.0 ? Math.sin(t * 22) * 0.2 * up(2.4, 3.0) : 0;
    body.rotation.x += roll + wiggle;
    const tucked = down * (1 - up(2.0, 3.3));
    [fl, fr].forEach((l) => l && (l.rotation.z += tucked * 1.2));
    [bl, br].forEach((l) => l && (l.rotation.z -= tucked * 1.2));
    // legs in the air, paddling
    const paddle = up(2.1, 3.2);
    legs.forEach((l, i) => l && (l.rotation.z += Math.sin(t * 16 + i * 1.7) * 0.5 * paddle));
    head.rotation.x += Math.sin(t * 7) * 0.3 * paddle;
  }
}
