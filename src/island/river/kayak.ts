import * as THREE from 'three';
import type { RiverAssets } from './assets';
import { type Course, type Gate, type Hole, type Ledge, type Obstacle, type Pickup, type Sample, type Thing, type Tongue, channel } from './course';
import { type Intent, NEUTRAL } from './controls';

const HULL = [1.45, 0, -1.45]; // collision circles along the hull, from the bow (m)
const HULL_R = 0.36;
const ENDS = 0.9; // where the water pushes on the hull: this far to the bow and the stern (m); it's a rockered boat
const GRAVITY = 20;

// the hull in the water: it slips along its length and grips sideways (the stern a bit more,
// so it tracks straight), per end: linear and quadratic drag
const ALONG = [0.2, 0.025];
const ACROSS = [1.5, 0.3];
const INERTIA = 1.1; // (the boat's mass is 1)
const SPIN_DAMP = 0.6;

// the paddle
const BLADE = 1.05; // how hard a blade bites
const BLADE_SPEED = 6.5; // how fast a blade moves through a stroke (m/s): you can't paddle faster than it
const RUDDER = 0.4; // a planted blade's drag

/** How far over it can go (radians of roll) before it wants to keep going. */
export const TIP = 0.95;
/** …and past this it's over, unless you brace. */
const OVER = 1.45;
/** A brace this far over (and still up) is a perfect one. */
const PERFECT = 1.0;
/** A boof: the stroke has to catch this close (s) before the lip. */
const BOOF_WINDOW = 0.45;
/** A reverse sweep tapped this long before the stroke in the water finishes still follows it. */
const BUFFER = 0.18;

export type Balance = 'up' | 'over' | 'rolling' | 'swimming';

/** What the paddle's doing: a forward stroke (or a sweep), a reverse sweep, planted, or nothing. */
interface Blade {
  kind: 'fwd' | 'rev' | 'plant' | 'none';
  side: -1 | 1;
  t: number; // 0..1 through the stroke
  dur: number;
  power: number;
  sweep: boolean; // wide, for turning
}

export interface KayakEvents {
  /** A knock on a rock or a log (strength ~1..6). */
  hit?(strength: number, at: THREE.Vector3): void;
  /** A bump that didn't do much. */
  bump?(strength: number, at: THREE.Vector3): void;
  /** Landing after a drop. */
  splash?(size: number, at: THREE.Vector3): void;
  pickup?(thing: Pickup): void;
  gate?(gate: Gate, through: boolean): void;
  /**
   * Off a drop. A ledge wants a boof (a stroke at the lip, not leaning forward): land flat and
   * fast, or go in nose first ('pencil'). A waterfall wants the opposite: tuck forward and knife
   * in, or land flat on your back ('flat'), which hurts.
   */
  ledge?(how: 'boof' | 'pencil' | 'tuck' | 'flat', height: number): void;
  /** A brace that saved it; perfect when it came right at the last moment. */
  brace?(perfect: boolean, side: number): void;
  /** Leaning past the point of no return: brace! */
  tipping?(): void;
  capsize?(): void;
  rolled?(): void;
  /** The roll failed: swimming. */
  swim?(): void;
  /** Into a hole (stuck: too slow to punch it), and out the other side. */
  hole?(stuck: boolean): void;
  punched?(): void;
  tongue?(): void;
  /** Past a rock with inches to spare. */
  shave?(): void;
  /** All the way round in a spin (1 = a 360, 2 = a 720…). */
  spin?(turns: number): void;
  /** A stroke went in: how hard, and forward or back. */
  stroke?(power: number, back: boolean): void;
}

/**
 * Vincent in his kayak: a small rigid body the river pushes on at the bow and the stern, and
 * the paddle pushes on wherever the blade is.
 *
 * The hull slips easily along its length and grips the water sideways, so the current carries
 * it, and where the bow and the stern sit in different water (across an eddy line) it spins.
 * One paddle: a forward stroke drives you on and turns you away from its side (a wide sweep, when
 * you only paddle on one side, turns you harder); a reverse sweep brakes and turns you towards
 * its side, whatever the current; a blade held planted is a rudder, and only bites as hard as the
 * boat is moving through the water. A stroke has to finish before the next one can start.
 *
 * It also rolls. Waves, holes, a hard turn at speed, a bad landing, and the water catching the
 * leading edge when the boat's carried sideways (lean away from it: lift that edge) all push it
 * over, and you push back by leaning. A boat being paddled is a steady boat. Past the tipping
 * point a brace can still save it; after that you're upside down, with one go at rolling up.
 */
export class Kayak {
  readonly model: THREE.Object3D;
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector2(); // x, z
  heading = 0; // like the river's: 0 = north
  /** Turning: radians a second, + is to the right. */
  yawRate = 0;
  /** Where it is along the river, and how far off the middle (+ is right). */
  s = 0;
  side = 0;
  /** Roll: + is over to the right. */
  tilt = 0;
  balance: Balance = 'up';
  /** 0..1: breath for paddling. */
  stamina = 1;
  /** The roll-up: where the needle is (0..1) and how wide the window (centred on 0.5). */
  roll = { needle: 0, window: 0.3, time: 0 };
  airborne = false;
  /** Stuck in a hole, and for how long. */
  holed = 0;
  events: KayakEvents = {};
  /** The river where the kayak is. */
  here!: Sample;
  /** When on a touch screen, the paddler balances himself (mostly). */
  assisted = false;
  /** How many times you've rolled up this run: each roll gets harder. */
  rolls = 0;

  private course?: Course;
  private blade: Blade = { kind: 'none', side: 1, t: 1, dur: 0.5, power: 0, sweep: false };
  private lastSide: -1 | 1 = 1;
  /** Paddling straight on: the heading he's holding. */
  private line: number | null = null;
  private queued: { side: -1 | 1; at: number } | null = null;
  private tiltV = 0;
  private vy = 0;
  private pitch = 0;
  private idle = 0;
  private clock = 0;
  private lastCatch = -9;
  private boofing = false;
  private dropHeight = 0; // the drop being flown off, as built
  private pitchNow = 0; // leaning forward (+) or back (-)
  private leanNow = 0;
  private punchedHoles = new WeakSet<Hole>();
  private lastHole: Hole | null = null;
  private braceAnim = 0;
  private braceSide = 0;
  private tipped = false;
  private flip = 0; // 0 upright … 1 upside down (the model)
  private inTongue: Tongue | null = null;
  private skipHole: Hole | null = null;
  private shaved = new WeakSet<Obstacle>();
  private paddle?: THREE.Object3D;
  private head?: THREE.Object3D;
  /** 0..1: how hard you've been paddling lately (a paddled boat is a steady boat). */
  private effort = 0;
  /** The sideways water on the hull (m/s, + from the right), for tripping over the leading edge. */
  private crossflow = 0;
  /** A spin: how far round it's gone without stopping, and the strokes that drove it. */
  private spun = 0;
  private spins = 0;
  /** Which way (+1 right, -1 left) the last forward stroke and the last reverse sweep turned you. */
  private spinFwd = 0;
  private spinRev = 0;
  private difficulty = 0;

  constructor(assets: RiverAssets) {
    this.model = assets.clone('kayak');
    this.paddle = this.model.getObjectByName('paddle');
    this.head = this.model.getObjectByName('head');
  }

  /** Put it in at the top of the river, pointing downstream. */
  launch(course: Course, s: number) {
    const p = course.at(s);
    this.course = course;
    this.pos.set(p.x, p.y, p.z);
    this.vel.set(Math.sin(p.a), -Math.cos(p.a)).multiplyScalar(p.speed * 0.6);
    this.heading = p.a;
    this.yawRate = 0;
    this.s = s;
    this.side = 0;
    this.here = p;
    this.tilt = this.tiltV = 0;
    this.balance = 'up';
    this.stamina = 1;
    this.effort = 0;
    this.rolls = 0;
    this.flip = 0;
    this.airborne = false;
    this.boofing = false;
    this.holed = 0;
    this.skipHole = null;
    this.queued = null;
    this.blade = { kind: 'none', side: 1, t: 1, dur: 0.5, power: 0, sweep: false };
    this.pitchNow = this.leanNow = 0;
    this.spun = this.spins = this.spinFwd = this.spinRev = 0;
    this.vy = this.pitch = 0;
    this.model.visible = true;
    this.place();
  }

  /** Back on the river at the last good spot, still and upright. */
  private recover(course: Course) {
    const p = course.at(Number.isFinite(this.s) ? this.s : 0);
    this.s = p.s;
    this.pos.set(p.x, p.y, p.z);
    this.vel.set(0, 0);
    this.heading = p.a;
    this.yawRate = this.tilt = this.tiltV = this.vy = 0;
    this.airborne = false;
  }

  /** How white the water is right where the kayak is (round an island, the channel it's in). */
  get rough() {
    return this.here ? Math.min(1, this.here.rough * channel(this.here, this.side).rough) : 0;
  }

  /** Speed over the ground (m/s). */
  get speed() {
    return this.vel.length();
  }

  update(dt: number, intent: Intent, course: Course, running: boolean) {
    this.clock += dt;
    this.course = course;
    this.difficulty = course.difficulty(this.s);
    const live = running && (this.balance === 'up' || this.balance === 'over');
    if (running) this.upsideDown(dt, intent.brace || intent.tapLeft || intent.tapRight);
    const i = live ? intent : NEUTRAL;
    this.brace(i);
    this.paddling(dt, i);
    // small steps, so fast water never carries it through a rock
    const n = Math.ceil(dt / (1 / 120));
    for (let k = 0; k < n; k++) this.step(dt / n, i, course, running);
    // if the numbers ever go bad, put it back on the water where it last was
    if (![this.pos.x, this.pos.y, this.pos.z, this.vel.x, this.vel.y, this.heading, this.yawRate, this.tilt].every(Number.isFinite)) this.recover(course);
    this.spinning(dt);
    this.animate(dt);
  }

  // --- the paddle -----------------------------------------------------------------------------

  /**
   * One paddle, one stroke at a time. A reverse sweep tapped (or tapped just before the stroke in
   * the water finishes) goes next; otherwise forward strokes on whichever sides are held, taking
   * turns; otherwise a blade held planted. Nothing held: the paddle comes out of the water.
   */
  private paddling(dt: number, i: Intent) {
    const b = this.blade;
    if (i.tapLeft) this.queued = { side: -1, at: this.clock };
    if (i.tapRight) this.queued = { side: 1, at: this.clock };
    if (this.queued && this.clock - this.queued.at > BUFFER + 0.1) this.queued = null;
    if (b.kind === 'fwd' || b.kind === 'rev') {
      b.t += dt / b.dur;
      if (b.t < 1) return;
    }
    const puffed = this.stamina < 0.05 ? 0.45 : 1;
    const start = (kind: 'fwd' | 'rev', side: -1 | 1, power: number, sweep: boolean) => {
      this.blade = { kind, side, t: 0, dur: kind === 'rev' ? 0.55 : 0.62 - power * 0.16, power: power * puffed, sweep };
      this.lastSide = side;
      this.stamina = Math.max(0, this.stamina - 0.035 * power);
      this.effort = Math.min(1, this.effort + 0.3 * power);
      if (kind === 'fwd') this.lastCatch = this.clock;
      // a forward stroke turns you away from its side, a reverse sweep towards it
      if (kind === 'fwd') this.spinFwd = -side;
      else this.spinRev = side;
      this.events.stroke?.(power, kind === 'rev');
    };
    if (this.queued) {
      start('rev', this.queued.side, 1, true);
      this.queued = null;
      return;
    }
    const l = i.left;
    const r = i.right;
    if (l > 0.05 || r > 0.05) {
      const both = l > 0.05 && r > 0.05;
      // both sides: he takes turns, but (as any paddler does) holds the line he started on,
      // stroking on the side the bow is wandering towards
      if (!both) this.line = null;
      else this.line ??= this.heading;
      const off = this.line === null ? 0 : angle(this.heading - this.line) + this.yawRate * 0.3;
      const drift = off > 0.06 ? 1 : off < -0.06 ? -1 : 0;
      const side: -1 | 1 = both ? (drift ? (drift as -1 | 1) : this.lastSide > 0 ? -1 : 1) : l > r ? -1 : 1;
      start('fwd', side, side < 0 ? l : r, !both);
      return;
    }
    if (i.backLeft || i.backRight) {
      this.blade = { kind: 'plant', side: i.backLeft ? -1 : 1, t: 1, dur: 1, power: 1, sweep: false };
      return;
    }
    this.line = null;
    this.blade = { ...b, kind: 'none' };
  }

  /** The blade's push on the boat right now: along the hull, across it, and the turn (boat frame). */
  private bladeForce(relAlong: number, relAcross: number) {
    const b = this.blade;
    if (b.kind === 'none') return null;
    if (b.kind === 'plant') {
      // held still back by the hip: a brake and a rudder, as strong as the water rushing past it
      const a = -1.3;
      const l = b.side * 0.9;
      const va = relAlong;
      const vl = relAcross + this.yawRate * a;
      const fa = -RUDDER * va * Math.abs(va);
      const fl = -RUDDER * 0.5 * vl * Math.abs(vl);
      return { fa, fl, tau: a * fl - l * fa };
    }
    // a stroke: the blade goes in near the feet and comes out by the hip (a sweep reaches wide
    // and round to the stern), pushing the boat the other way from how it moves through the water
    const env = Math.sin(b.t * Math.PI);
    const fwd = b.kind === 'fwd';
    const a = fwd ? 1.1 - b.t * 1.8 : -0.7 + b.t * 1.8;
    const l = b.side * (b.sweep ? 1.6 : 0.7);
    const u = BLADE_SPEED * (0.6 + 0.4 * b.power);
    const bite = fwd ? Math.max(0, u - relAlong) : Math.max(0, u + relAlong);
    let fa = BLADE * bite * env * (fwd ? 1 : -1) * (b.sweep ? 0.75 : 1) * (0.5 + 0.5 * b.power);
    // a sweep also pushes the ends out sideways: the bow away at the start, the stern at the end
    const fl = b.sweep ? -b.side * BLADE * 2.4 * env * (fwd ? 1 : -1) * Math.sign(a) * (0.5 + 0.5 * b.power) : 0;
    if (!fwd) fa *= 1.3;
    let tau = a * fl - l * fa;
    // forward strokes can't wind you up past a brisk turn on their own: the blade's only going
    // round as fast as the boat already is. A reverse sweep bites into the water and whips you
    // round, which is what a spin needs.
    if (fwd && tau * this.yawRate > 0) tau *= THREE.MathUtils.clamp(1 - (Math.abs(this.yawRate) - 1.3) / 0.9, 0, 1);
    return { fa, fl, tau };
  }

  // --- the river pushing it along ---------------------------------------------------------

  private step(dt: number, i: Intent, course: Course, running: boolean) {
    const near = course.nearest(this.pos.x, this.pos.z, this.s);
    const p = near.sample;
    this.here = p;
    this.side = near.side;
    const fx = Math.sin(p.a);
    const fz = -Math.cos(p.a);
    const rx = Math.cos(p.a);
    const rz = Math.sin(p.a);
    // between samples: how far past this one along the river
    this.s = p.s + (Math.max(-0.5, Math.min(0.5, (this.pos.x - p.x) * fx + (this.pos.z - p.z) * fz)) || 0);
    const half = p.width / 2;
    const up = this.balance === 'up' || this.balance === 'over';

    this.stamina = Math.min(1, this.stamina + (this.blade.kind === 'fwd' ? 0 : 0.14) * dt);
    this.effort *= Math.exp(-dt * 0.8);
    this.leanNow += (i.lean - this.leanNow) * (1 - Math.exp(-dt * 10));
    this.pitchNow += (i.pitch - this.pitchNow) * (1 - Math.exp(-dt * 10));

    // what's in the water here: holes, tongues, ledges, and the rest
    let hole: Hole | null = null;
    let tongue: Tongue | null = null;
    const things = course.near(this.s - 8, this.s + 8);
    for (const t of things) {
      if (!('kind' in t)) {
        this.gateCheck(t, p);
        continue;
      }
      switch (t.kind) {
        case 'ball':
          this.pickupCheck(t);
          break;
        case 'hole':
          if (t !== this.skipHole && this.inside(t.s, t.u, t.half, -0.6, 1.0)) hole = t;
          break;
        case 'tongue':
          if (this.inside(t.s, t.u, t.half, -3, 2.5)) tongue = t;
          break;
        case 'ledge':
          this.lipCheck(t, running);
          break;
      }
    }

    // the hull: the water pushes on each end, by how that end moves through the water there
    const hx = Math.sin(this.heading);
    const hz = -Math.cos(this.heading);
    const ex = Math.cos(this.heading); // the boat's right
    const ez = Math.sin(this.heading);
    const edging = 1 - Math.min(1, Math.abs(this.leanNow)) * 0.45; // on its edge, it slides and turns
    let fx0 = 0;
    let fz0 = 0;
    let tau = 0;
    let cross = 0;
    let relAlongMid = 0;
    let relAcrossMid = 0;
    for (const a of [ENDS, -ENDS]) {
      const px = this.pos.x + hx * a;
      const pz = this.pos.z + hz * a;
      const w = this.current(px, pz, p, things, hole, tongue);
      // the end's own velocity: the boat's, plus its swing as it turns
      const vx = this.vel.x + ex * this.yawRate * a - w.x;
      const vz = this.vel.y + ez * this.yawRate * a - w.z;
      const va = vx * hx + vz * hz;
      const vl = vx * ex + vz * ez;
      const grip = a < 0 ? 1.25 : 0.8;
      const fa = -(ALONG[0] * va + ALONG[1] * va * Math.abs(va)) * 0.5;
      const fl = -(ACROSS[0] * vl + ACROSS[1] * vl * Math.abs(vl)) * 0.5 * grip * edging;
      fx0 += hx * fa + ex * fl;
      fz0 += hz * fa + ez * fl;
      tau += a * fl;
      cross += vl * 0.5;
      relAlongMid += va * 0.5;
      relAcrossMid += vl * 0.5;
    }
    this.crossflow = cross;
    const blade = up ? this.bladeForce(relAlongMid, relAcrossMid) : null;
    if (blade) {
      fx0 += hx * blade.fa + ex * blade.fl;
      fz0 += hz * blade.fa + ez * blade.fl;
      tau += blade.tau;
    }
    // leaning forward drives the boat on a little; a hole pours back and turns you sideways
    fx0 += hx * this.pitchNow * 0.3 * (up ? 1 : 0);
    fz0 += hz * this.pitchNow * 0.3 * (up ? 1 : 0);
    if (hole) tau += Math.sin(this.clock * 2.7) * 2.4 * hole.strength;
    this.vel.x += fx0 * dt;
    this.vel.y += fz0 * dt;
    this.yawRate += (tau / INERTIA - this.yawRate * SPIN_DAMP) * dt;
    this.heading += this.yawRate * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;

    // rocks and logs knock it about
    if (this.balance !== 'swimming') {
      for (const t of things) if ('kind' in t && (t.kind === 'rock' || t.kind === 'log')) this.collide(t, running);
    }

    // the banks shove you back into the stream (a gorge's walls do it hard)
    const limit = half - 0.55;
    if (Math.abs(this.side) > limit) {
      const out = Math.sign(this.side);
      const over = Math.abs(this.side) - limit;
      this.pos.x -= rx * out * over;
      this.pos.z -= rz * out * over;
      const vn = (this.vel.x * rx + this.vel.y * rz) * out;
      if (vn > 0) {
        this.vel.x -= rx * out * vn * 1.4;
        this.vel.y -= rz * out * vn * 1.4;
        this.vel.multiplyScalar(0.97);
        this.yawRate -= out * vn * 0.4;
        if (up) this.tiltV -= out * vn * (0.3 + p.gorge * 0.5);
        const at = this.pos.clone().addScaledVector(new THREE.Vector3(rx, 0, rz), out * 0.4);
        if (vn > 1.5) this.events.bump?.(vn, at);
      }
    }

    // an island shoves you off into one channel or the other: its head hard, as you'd expect
    if (p.isle > 0) {
      const d = this.side - p.isleU;
      const reach = p.isle + 0.55;
      if (Math.abs(d) < reach) {
        const out = Math.sign(d) || 1;
        const over = reach - Math.abs(d);
        this.pos.x += rx * out * over;
        this.pos.z += rz * out * over;
        const vn = -(this.vel.x * rx + this.vel.y * rz) * out;
        if (vn > 0) {
          this.vel.x += rx * out * vn * 1.4;
          this.vel.y += rz * out * vn * 1.4;
          this.vel.multiplyScalar(0.96);
          this.yawRate += out * vn * 0.4;
          if (up) this.tiltV += out * vn * 0.3;
          const at = this.pos.clone().addScaledVector(new THREE.Vector3(rx, 0, rz), -out * 0.4);
          if (vn > 1.5) this.events.bump?.(vn, at);
        }
      }
    }

    // into and out of the special water
    if (hole && !this.holed) this.events.hole?.(this.vel.x * fx + this.vel.y * fz < 2.5);
    if (hole) {
      this.holed += dt;
      this.lastHole = hole;
      // held too long, a hole spits you out at one end
      if (this.holed > 1.2) {
        const out = Math.sign(this.side - hole.u) || 1;
        this.pos.x += rx * out * dt * (1 + this.holed);
        this.pos.z += rz * out * dt * (1 + this.holed);
      }
    } else if (this.holed) {
      // out the bottom (not squirted back upstream, not out the side): punched it
      const h = this.lastHole;
      if (up && h && this.s > h.s + 0.8 && !this.punchedHoles.has(h)) {
        this.punchedHoles.add(h);
        this.events.punched?.();
      }
      this.holed = 0;
    }
    if (tongue && tongue !== this.inTongue && !tongue.taken && up && Math.abs(angle(this.heading - p.a)) < 0.4) {
      tongue.taken = true;
      this.events.tongue?.();
    }
    this.inTongue = tongue;

    if (up) this.rollPhysics(dt, p, hole, running);

    // up and down: riding the water, or flying off a ledge
    const bob = Math.sin(this.clock * 2.1) * 0.03 + Math.sin(this.clock * 5.3 + p.s) * this.rough * 0.08;
    const water = course.heightAt(this.s) + bob + this.flip * 0.12; // upside down, the hull rides high
    if (!this.airborne && water < this.pos.y - 0.3) {
      this.airborne = true;
      this.vy = this.boofing ? 2.8 : 0;
      if (this.boofing) this.vel.multiplyScalar(1.12);
    }
    if (this.airborne) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= water) this.land(-this.vy, water);
    } else {
      this.pos.y = water;
    }
  }

  /**
   * The water's velocity at a point: fastest mid-stream, slower by the banks, restless in white
   * water, slack and turning back on itself behind a rock, faster down a tongue, pouring back
   * into a hole.
   */
  private current(x: number, z: number, p: Sample, things: Thing[], hole: Hole | null, tongue: Tongue | null) {
    const near = this.course!.nearest(x, z, p.s);
    const q = near.sample;
    const fx = Math.sin(q.a);
    const fz = -Math.cos(q.a);
    const across = Math.max(-1, Math.min(1, near.side / (q.width / 2)));
    const ch = channel(q, near.side);
    let flow = q.speed * ch.speed * (1 - 0.32 * across * across);
    // slack water along an island's shore
    if (q.isle > 0) flow *= 0.72 + 0.28 * Math.min(1, Math.max(0, (Math.abs(near.side - q.isleU) - q.isle) / 2));
    if (tongue) flow += 2.2;
    let eddy = 0;
    for (const t of things) if ('kind' in t && t.kind === 'rock') eddy = Math.max(eddy, inEddy(t, x, z, fx, fz));
    flow *= 1 - Math.min(1, eddy) * 1.25;
    const fwd = Math.max(0, this.pitchNow);
    const back = Math.max(0, -this.pitchNow);
    if (hole) flow *= 1 - hole.strength * (1.5 + back * 0.8 - fwd * 0.6) * Math.max(0.3, 1 - Math.max(0, this.holed - 1.5) * 0.3);
    const churn = Math.min(1, q.rough * ch.rough) * 1.4 * (Math.sin(this.clock * 1.7 + q.s * 0.21) + Math.sin(this.clock * 3.1 + q.s * 0.07) * 0.5);
    return { x: fx * flow + Math.cos(q.a) * churn, z: fz * flow + Math.sin(q.a) * churn };
  }

  /** Whether the kayak is in a patch of water (a hole, a tongue) at arc length ts, u across, `half` wide. */
  private inside(ts: number, u: number, half: number, from: number, to: number) {
    const along = this.s - ts;
    return along > from && along < to && Math.abs(this.side - u) < half + 0.3;
  }

  /**
   * All the way round without stopping: a 360 (and on). Only the real thing counts: a forward
   * sweep to get it going, a reverse sweep on the other side to whip it round, and paddling on.
   * Holding one side down just turns you.
   */
  private spinning(dt: number) {
    const sense = Math.sign(this.yawRate);
    if (Math.abs(this.yawRate) < 0.8 || this.balance !== 'up' || this.spun * this.yawRate < 0) {
      this.spun = this.spins = 0;
      // strokes turning the other way don't count towards this one
      if (this.spinFwd !== sense) this.spinFwd = 0;
      if (this.spinRev !== sense) this.spinRev = 0;
      if (Math.abs(this.yawRate) < 0.8 || this.balance !== 'up') return;
    }
    this.spun += this.yawRate * dt;
    if (this.spinFwd !== sense || this.spinRev !== sense) return;
    if (Math.abs(this.spun) >= (this.spins + 1) * Math.PI * 2) this.events.spin?.(++this.spins);
  }

  // --- the roll ---------------------------------------------------------------------------------

  private rollPhysics(dt: number, p: Sample, hole: Hole | null, running: boolean) {
    const t = this.clock;
    // the water: waves and boils in white water, a hole trying to flip you, a hard turn at speed,
    // and water piling onto the leading edge when the boat is carried sideways (it trips you
    // towards the water: lift that edge by leaning away). Leaning forward into the waves steadies
    // you; sitting back lets them push you about.
    const stance = 1 - Math.max(0, this.pitchNow) * 0.35 + Math.max(0, -this.pitchNow) * 0.4;
    let torque = this.rough * (3.2 + this.difficulty * 2) * stance * (Math.sin(t * 2.3 + p.s * 0.3) * 0.6 + Math.sin(t * 3.7 + p.s * 0.11) * 0.4);
    if (Math.random() < dt * this.rough * 2.2) this.tiltV += (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 1.1) * this.rough * stance;
    if (hole) torque += Math.sin(t * 5) * 5.5 * hole.strength * stance * (1 + Math.min(2, this.holed));
    torque += Math.max(-6, Math.min(6, this.crossflow * Math.abs(this.crossflow) * 0.9));
    torque += this.yawRate * Math.max(0, this.speed - 3) * 0.25;
    // the paddler: leaning shifts his weight, and a boat being paddled sits steadier
    let lean = this.leanNow;
    if (this.assisted) lean = Math.max(-1, Math.min(1, lean - this.tilt * 1.4 - this.tiltV * 0.35));
    torque += lean * 4.5;
    const planted = this.blade.kind === 'plant' ? 0.4 : 0; // a blade in the water is something to lean on
    const steady = 2.2 + this.effort * 3.5 + planted * 3;
    const over = Math.abs(this.tilt) - TIP;
    // upright, it wants to stay that way; past the tipping point it wants to go on over
    torque += over < 0 ? -steady * this.tilt : Math.sign(this.tilt) * (2 + over * 10);
    this.tiltV += (torque - this.tiltV * (2.2 + this.effort * 1.5)) * dt;
    this.tilt += this.tiltV * dt;
    if (!running) {
      this.tilt = Math.max(-TIP * 0.8, Math.min(TIP * 0.8, this.tilt));
      return;
    }
    // past the tipping point: brace, or go over
    if (Math.abs(this.tilt) > TIP && !this.tipped) {
      this.tipped = true;
      this.balance = 'over';
      this.events.tipping?.();
    }
    if (Math.abs(this.tilt) < TIP * 0.8) {
      this.tipped = false;
      if (this.balance === 'over') this.balance = 'up';
    }
    if (Math.abs(this.tilt) > OVER) this.capsize();
  }

  /**
   * A brace: the back of the blade slapped flat on the water on the side you're falling to. The
   * bumper on that side does it (instead of a reverse sweep), and so does the brace button.
   */
  private brace(i: Intent) {
    const falling = Math.sign(this.tilt) as -1 | 1;
    const leaning = Math.abs(this.tilt) > TIP * 0.55;
    const asked = i.brace || (leaning && ((falling < 0 && i.tapLeft) || (falling > 0 && i.tapRight)));
    if (!asked || this.braceAnim > 0 || this.balance === 'rolling' || this.balance === 'swimming') return;
    if (falling < 0 && i.tapLeft) i.tapLeft = false; // it's a brace, not a sweep
    if (falling > 0 && i.tapRight) i.tapRight = false;
    const side = falling || 1;
    this.braceSide = side;
    this.braceAnim = 0.45;
    if (leaning) {
      const perfect = Math.abs(this.tilt) > PERFECT;
      this.tiltV = -side * (perfect ? 3.4 : 2.6);
      this.tilt *= 0.75;
      this.vel.multiplyScalar(perfect ? 0.97 : 0.9);
      this.events.brace?.(perfect, side);
    } else {
      this.vel.multiplyScalar(0.94); // a brace for nothing: the blade drags
    }
  }

  private capsize() {
    this.balance = 'rolling';
    this.tiltV = 0;
    this.roll = { needle: 0, window: Math.max(0.12, 0.36 - this.rolls * 0.06 - this.difficulty * 0.08), time: 0 };
    this.vel.multiplyScalar(0.5);
    this.holed = 0;
    this.events.capsize?.();
  }

  /** Upside down: a needle swings, and a brace (or a stroke) in the window rolls you back up. */
  private upsideDown(dt: number, pressed: boolean) {
    if (this.balance !== 'rolling') return;
    const r = this.roll;
    r.time += dt;
    if (r.time < 0.45) return; // still going over
    r.needle = 0.5 - Math.cos((r.time - 0.45) * Math.PI * 1.6) * 0.5;
    if (pressed && r.time > 0.6) {
      if (Math.abs(r.needle - 0.5) < r.window / 2) {
        this.balance = 'up';
        this.tilt = -Math.sign(this.tilt || 1) * 0.3;
        this.tiltV = 0;
        this.tipped = false;
        this.rolls++;
        this.events.rolled?.();
      } else this.drown();
      return;
    }
    if (r.time > 0.45 + 2.5) this.drown();
  }

  private drown() {
    if (this.balance === 'swimming') return;
    this.balance = 'swimming';
    this.events.swim?.();
  }

  // --- things in the water --------------------------------------------------------------------

  private lipCheck(l: Ledge, running: boolean) {
    if (l.passed || this.s < l.s - 0.3) return;
    l.passed = true;
    this.dropHeight = l.height;
    // a boof: a stroke catching right at the lip, not leaning forward (leaning back lifts the bow more)
    this.boofing = running && this.balance === 'up' && this.clock - this.lastCatch < BOOF_WINDOW && this.pitchNow < 0.3;
  }

  private land(fall: number, water: number) {
    this.airborne = false;
    this.pos.y = water;
    this.vy = 0;
    const height = (fall * fall) / (2 * GRAVITY);
    const upright = this.balance === 'up' || this.balance === 'over';
    const kick = (k: number) => (this.tiltV += (Math.random() < 0.5 ? -1 : 1) * k);
    if (height > 0.6 && upright && this.dropHeight >= 3) {
      // a waterfall: tuck forward and knife in, or land flat and feel it
      if (this.pitchNow > 0.35) {
        this.pitch = 0.3;
        this.vel.multiplyScalar(0.9);
        this.jumpHole();
        this.events.ledge?.('tuck', height);
      } else {
        this.pitch = -0.1;
        this.vel.multiplyScalar(0.5);
        kick(2.4 + height * 0.3);
        this.events.ledge?.('flat', height);
      }
    } else if (height > 0.6 && upright) {
      if (this.boofing) {
        // flat and fast: over the hole at the foot and away
        this.pitch = 0.08;
        this.jumpHole();
        this.events.ledge?.('boof', height);
      } else {
        // nose first: deep, slow, and something to balance
        this.pitch = Math.min(0.6, fall * 0.07);
        this.vel.multiplyScalar(0.55);
        kick(1.4 + height * 0.5);
        this.events.ledge?.('pencil', height);
      }
    }
    this.dropHeight = 0;
    this.events.splash?.(fall, this.pos.clone());
    this.boofing = false;
  }

  /** After a boof, the hole at the foot of the ledge can't hold you. */
  private jumpHole() {
    for (const t of this.course?.near(this.s - 2, this.s + 6) ?? []) {
      if ('kind' in t && t.kind === 'hole' && t.s > this.s - 2) {
        this.skipHole = t;
        return;
      }
    }
  }

  private collide(o: Obstacle, running: boolean) {
    const hx = Math.sin(this.heading);
    const hz = -Math.cos(this.heading);
    let closest = Infinity;
    for (const along of HULL) {
      const cx = this.pos.x + hx * along;
      const cz = this.pos.z + hz * along;
      let ox: number;
      let oz: number;
      let r: number;
      if (o.kind === 'rock') {
        ox = o.x;
        oz = o.z;
        r = o.r * 0.9;
      } else {
        // the nearest point on the log
        const dx = o.x1 - o.x0;
        const dz = o.z1 - o.z0;
        const t = Math.max(0, Math.min(1, ((cx - o.x0) * dx + (cz - o.z0) * dz) / (dx * dx + dz * dz || 1)));
        ox = o.x0 + dx * t;
        oz = o.z0 + dz * t;
        r = o.r;
      }
      const dx = cx - ox;
      const dz = cz - oz;
      const d = Math.hypot(dx, dz) || 0.001;
      const pen = HULL_R + r - d;
      closest = Math.min(closest, -pen);
      if (pen <= 0) continue;
      const nx = dx / d;
      const nz = dz / d;
      this.pos.x += nx * pen;
      this.pos.z += nz * pen;
      const vn = this.vel.x * nx + this.vel.y * nz;
      if (vn >= 0) continue;
      this.vel.x -= nx * vn * 1.5;
      this.vel.y -= nz * vn * 1.5;
      // a knock off the bow or the stern turns the boat, and any knock rocks it
      this.yawRate += (hx * nz - hz * nx) * Math.sign(along) * -vn * 0.5;
      const across = nx * Math.cos(this.heading) + nz * Math.sin(this.heading);
      if (this.balance === 'up' || this.balance === 'over') this.tiltV += Math.sign(across || 1) * vn * 0.45;
      this.shaved.add(o); // no credit for a shave you hit
      const at = new THREE.Vector3(ox + nx * r, this.pos.y, oz + nz * r);
      if (this.balance === 'rolling' && -vn > 1.2 && running) {
        this.events.hit?.(-vn, at);
        this.drown(); // upside down on a rock: out you come
        return;
      }
      if (-vn > 1.4) this.events.hit?.(-vn, at);
      else this.events.bump?.(-vn, at);
    }
    // inches to spare, going fast: a close shave
    if (running && closest > 0 && closest < 0.35 && this.speed > 4 && this.balance === 'up' && !this.shaved.has(o)) {
      this.shaved.add(o);
      this.events.shave?.();
    }
  }

  private pickupCheck(thing: Pickup) {
    if (thing.taken || this.balance !== 'up') return;
    const hx = Math.sin(this.heading);
    const hz = -Math.cos(this.heading);
    for (const along of [1.2, 0]) {
      if (Math.hypot(this.pos.x + hx * along - thing.x, this.pos.z + hz * along - thing.z) < 1.1) {
        thing.taken = true;
        this.events.pickup?.(thing);
        return;
      }
    }
  }

  private gateCheck(gate: Gate, p: Sample) {
    if (gate.passed || this.s < gate.s) return;
    gate.passed = true;
    const rx = Math.cos(p.a);
    const rz = Math.sin(p.a);
    const ua = (gate.a.x - p.x) * rx + (gate.a.z - p.z) * rz;
    const ub = (gate.b.x - p.x) * rx + (gate.b.z - p.z) * rz;
    this.events.gate?.(gate, this.balance === 'up' && this.side > Math.min(ua, ub) && this.side < Math.max(ua, ub));
  }

  // --- how it looks -----------------------------------------------------------------------

  private animate(dt: number) {
    const paddling = this.balance === 'up' || this.balance === 'over';
    this.idle += dt;
    this.pitch += (0 - this.pitch) * (1 - Math.exp(-dt * 3));
    this.braceAnim -= dt;
    const flipTo = paddling ? 0 : 1;
    this.flip += (flipTo - this.flip) * (1 - Math.exp(-dt * (flipTo ? 7 : 5)));
    this.place();
    // the paddle's right end is the model's -x: rolling it +z dips the right blade; turning it +y
    // swings the right blade towards the bow
    const b = this.blade;
    if (this.braceAnim > 0) {
      // the low brace: the blade flat on the water on the side it's falling to
      this.paddle?.rotation.set(0, 0, this.braceSide * 0.6);
    } else if (b.kind === 'plant' && paddling) {
      // planted back by the hip on that side, like a rudder
      this.paddle?.rotation.set(0, -b.side * 0.75, b.side * 0.5);
    } else if ((b.kind === 'fwd' || b.kind === 'rev') && paddling) {
      // a stroke: that blade dips in and moves from the bow to the stern (or back again); a
      // sweep swings wider
      const t = Math.min(1, b.t);
      const sweep = b.kind === 'rev' ? t - 0.5 : 0.5 - t;
      const dip = Math.sin(t * Math.PI);
      this.paddle?.rotation.set(0, b.side * sweep * (b.sweep ? 1.5 : 1.1), b.side * (0.2 + dip * (b.sweep ? 0.3 : 0.45)));
    } else {
      // between strokes: held level, ready
      this.paddle?.rotation.set(0, 0, Math.sin(this.idle * 1.3) * 0.05);
    }
    if (this.head) this.head.rotation.y = Math.max(-0.5, Math.min(0.5, -this.yawRate * 0.3));
  }

  private place() {
    const m = this.model;
    m.position.copy(this.pos);
    const dive = this.airborne ? Math.max(-0.2, Math.min(0.7, -this.vy * 0.06 - (this.boofing ? 0.15 : 0))) : 0;
    // the model's bow is its +z; heading 0 is north (-z). Rolled by the tilt, or all the way over.
    m.rotation.order = 'YXZ';
    m.rotation.y = Math.PI - this.heading;
    m.rotation.x = dive + this.pitch + this.pitchNow * 0.18; // leaning forward dips the bow
    const side = Math.sign(this.tilt) || 1;
    m.rotation.z = this.tilt * (1 - this.flip) + side * Math.PI * this.flip; // + rolls the right side down
  }
}

/** How deep in the eddy behind a rock (x, z) is (0 not at all … ~1.4 right behind it). */
function inEddy(o: { x: number; z: number; r: number }, x: number, z: number, fx: number, fz: number) {
  const dx = x - o.x;
  const dz = z - o.z;
  const along = dx * fx + dz * fz;
  const across = Math.abs(-dx * fz + dz * fx);
  const len = o.r * 4;
  if (along < o.r * 0.5 || along > len || across > o.r * 1.1) return 0;
  return (1 - along / len) * (1 - across / (o.r * 1.1)) * 1.4;
}

/** An angle wrapped to -π..π. */
function angle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
