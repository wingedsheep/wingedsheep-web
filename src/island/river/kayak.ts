import * as THREE from 'three';
import type { RiverAssets } from './assets';
import { CREST_LEAN, type Course, type Gate, type Hole, type Ledge, type Obstacle, type Pickup, type Sample, type Thing, type Tongue, type Train, channel, waveAt } from './course';
import { type Intent, NEUTRAL } from './controls';
import { waterAt } from './flow';

const HULL = [1.45, 0, -1.45]; // collision circles along the hull, from the bow (m)
const HULL_R = 0.36;
const ENDS = 0.9; // where the water pushes on the hull: this far to the bow and the stern (m); it's a rockered boat
const GRAVITY = 20;

// the hull in the water: it slips along its length and grips sideways (the stern a bit more,
// so it tracks straight), per end: linear and quadratic drag
const ALONG = [0.2, 0.025];
const ACROSS = [1.5, 0.3];
const INERTIA = 1.1; // (the boat's mass is 1)
/** Leaning carves: on its edge and moving through the water, the boat turns the way it leans. */
const CARVE = 0.22;
const SPIN_DAMP = 0.6;

// the paddle
const BLADE = 1.05; // how hard a blade bites
const BLADE_SPEED = 6.5; // how fast a blade moves through a stroke (m/s): you can't paddle faster than it
const RUDDER = 0.2; // a planted blade's drag
const BACKING = 0.55; // backing up, the blade moves this much slower than it does going forward

/** Sprinting: you've breath for this long (s) of quicker, harder strokes, and it takes this long (s) to come back. */
const SPRINT = 3;
const RECOVER = 7;

/** How far over it can go (radians of roll) before it wants to keep going. */
export const TIP = 0.95;
/** …and past this it's over, unless you brace. */
const OVER = 1.45;
/** A brace this far over (and still up) is a perfect one. */
const PERFECT = 1.0;
/** A boof: the stroke has to catch this close (s) before the lip. */
export const BOOF_WINDOW = 0.45;
/** The lip: this far (m) above a ledge's arc length the river starts to pour over it. */
export const LIP_AT = 1;
/** A reverse sweep tapped this long before the stroke in the water finishes still follows it. */
const BUFFER = 0.18;

// a wave train: how hard a crest meeting the hull at an angle rolls it, how hard a wave's slope
// pulls you down its back (and holds you on its face), and how hard a stroke down its back pumps
const WAVE_ROLL = 8.5;
const WAVE_PULL = 5;
const PUMP = 0.55;
/** Over a crest faster than this (m/s), a big wave throws you off it. */
const HOP_FROM = 6.8;
/** A storm's wind across the river at its strongest (m/s²): enough to drift you, not to pin you. */
const GUST = 1.6;

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
   * in straight, or land flat on your back ('flat') or skewed across it ('skew'), which hurts.
   */
  ledge?(how: 'boof' | 'pencil' | 'tuck' | 'flat' | 'skew', height: number): void;
  /** A brace that saved it; perfect when it came right at the last moment. */
  brace?(perfect: boolean, side: number): void;
  /** Leaning past the point of no return: brace! */
  tipping?(): void;
  capsize?(): void;
  rolled?(): void;
  /** Out of the current into an eddy, stopped in the slack water behind a rock or a bend. */
  eddy?(): void;
  /** Out of a caught eddy and back into the current, upright. */
  peel?(): void;
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
  /** Digging in for a sprint. */
  sprint?(): void;
  /** A stroke down the back of a wave that pumped you on: how many waves in a row now. */
  pump?(chain: number): void;
  /** Off a crest and down again: level (clean), or crooked and fighting it. */
  air?(clean: boolean): void;
  /** Out the bottom of a wave train: how many waves, how many pumped, and whether it never tipped you. */
  rode?(count: number, pumped: number, steady: boolean): void;
  /** A stroke went in: how hard, forward or back, and on which side. */
  stroke?(power: number, back: boolean, side: -1 | 1): void;
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
  /** Its velocity through the water (x, z): what makes a wake. */
  readonly through = new THREE.Vector2();
  heading = 0; // like the river's: 0 = north
  /** Turning: radians a second, + is to the right. */
  yawRate = 0;
  /** Where it is along the river, and how far off the middle (+ is right). */
  s = 0;
  side = 0;
  /** Roll: + is over to the right. */
  tilt = 0;
  balance: Balance = 'up';
  /** The roll-up: where the needle is (0..1) and how wide the window (centred on 0.5). */
  roll = { needle: 0, window: 0.3, time: 0 };
  airborne = false;
  /** How high (m, as built) the drop it's flying off right now is: 0 on the water, or off a wave. */
  get flying() {
    return this.airborne && !this.hopping ? this.dropHeight : 0;
  }
  /** Stuck in a hole, and for how long. */
  holed = 0;
  events: KayakEvents = {};
  /** The river where the kayak is. */
  here!: Sample;
  /** 0..1: how deep in an eddy the boat is (its bow and stern together). */
  eddy = 0;
  /** When on a touch screen, the paddler balances himself (mostly). */
  assisted = false;
  /** Digging in: quicker, harder strokes. */
  sprinting = false;
  /** 0..1: breath for sprinting, draining while you do and coming back when you stop. */
  wind = 1;
  /** Out of breath: let go of sprint (and wait a moment) before you can go again. */
  private puffed = false;
  /** How many times you've rolled up this run: each roll gets harder. */
  rolls = 0;
  /** 0..1: how stormy it is (set by the game): a chop on even the flattest water, and a wind across it. */
  storm = 0;
  /** The wind across the river right now (m/s², + towards its right bank), gusting. */
  gust = 0;
  private gustTo = 0;
  private gustIn = 0;
  private gustSide: -1 | 1 = 1;
  /** The wave train you're in (or coming up to), and the water of it right under you. */
  train: Train | null = null;
  wave = { h: 0, slope: 0, k: -1, d: 0, lean: 0, amp: 0 };
  /** Off a wave's crest (not a ledge). */
  hopping = false;
  private pumpK = -1;
  private pumpChain = 0;
  private pumps = 0;
  /** Which of the train's waves have been under you (a bit each). */
  private waves = 0;
  private rocked = false;

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
  private bed = 0; // the river's height under it, a step ago
  /** How fast you were going over the last lip (m/s). */
  lipSpeed = 0;
  private lipSkew = 0; // how far off the river's line the bow pointed going over the lip
  private pitchNow = 0; // leaning forward (+) or back (-)
  private leanNow = 0;
  private punchedHoles = new WeakSet<Hole>();
  private lastHole: Hole | null = null;
  private braceAnim = 0;
  private braceSide = 0;
  private tipped = false;
  private slam = 0; // a bad landing off a waterfall still rolling you over (torque, fading)
  private flip = 0; // 0 upright … 1 upside down (the model)
  private inTongue: Tongue | null = null;
  private skipHole: Hole | null = null;
  private shaved = new WeakSet<Obstacle>(); // hit, or already credited: no (more) shave for these
  private skimmed = new WeakSet<Obstacle>(); // inches to spare, but not past it yet
  /** Up against a rock or a log (this step), and how long it's been held there, going nowhere. */
  private touching = false;
  private pinned = 0;
  /** Along a log the boat's up against, towards its free end (x, z). */
  private slide = new THREE.Vector2();
  private paddle?: THREE.Object3D;
  /** The paddler's head (for the headlamp). */
  readonly head?: THREE.Object3D;
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
  /** Being summed up this step: the eddy under the bow and the stern. */
  private eddyAt = 0;
  /** In an eddy you caught (until you peel out), and when you were last out in the current. */
  private caught = false;
  private inCurrent = -9;

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
    this.bed = p.y;
    this.vel.set(Math.sin(p.a), -Math.cos(p.a)).multiplyScalar(p.speed * 0.6);
    this.heading = p.a;
    this.yawRate = 0;
    this.s = s;
    this.side = 0;
    this.here = p;
    this.tilt = this.tiltV = this.slam = 0;
    this.balance = 'up';
    this.effort = 0;
    this.rolls = 0;
    this.gust = this.gustTo = this.gustIn = 0;
    this.sprinting = this.puffed = false;
    this.wind = 1;
    this.flip = 0;
    this.airborne = false;
    this.boofing = false;
    this.holed = 0;
    this.skipHole = null;
    this.queued = null;
    this.line = null;
    this.caught = false;
    this.blade = { kind: 'none', side: 1, t: 1, dur: 0.5, power: 0, sweep: false };
    this.pitchNow = this.leanNow = 0;
    this.spun = this.spins = this.spinFwd = this.spinRev = 0;
    this.vy = this.pitch = 0;
    this.train = null;
    this.wave = { h: 0, slope: 0, k: -1, d: 0, lean: 0, amp: 0 };
    this.hopping = false;
    this.model.visible = true;
    this.place();
  }

  /** Back on the river at the last good spot, still and upright. */
  private recover(course: Course) {
    const p = course.at(Number.isFinite(this.s) ? this.s : 0);
    this.s = p.s;
    this.pos.set(p.x, p.y, p.z);
    this.bed = p.y;
    this.vel.set(0, 0);
    this.heading = p.a;
    this.yawRate = this.tilt = this.tiltV = this.slam = this.vy = 0;
    this.airborne = false;
  }

  /** How white the water is right where the kayak is (round an island, the channel it's in). */
  get rough() {
    const r = this.here ? Math.min(1, this.here.rough * channel(this.here, this.side).rough) : 0;
    return r + this.storm * 0.3 * (1 - r); // (a storm chops up even the flat water)
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
    if (running) this.upsideDown(dt, intent.brace || intent.tipBrace || intent.tapLeft || intent.tapRight);
    const i = live ? intent : NEUTRAL;
    this.brace(i);
    this.sprint(dt, i);
    this.trains(course, running);
    this.paddling(dt, i);
    this.blow(dt);
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
   * One paddle, one stroke at a time. Both brakes held, back strokes on either side, taking
   * turns: a hard stop, and then backing up (slowly, and only against slow water). Otherwise a
   * reverse sweep tapped (or tapped just before the stroke in the water finishes) goes next;
   * otherwise forward strokes on whichever sides are held, taking turns; otherwise a blade held
   * planted. Nothing held: the paddle comes out of the water.
   */
  private paddling(dt: number, i: Intent) {
    const b = this.blade;
    const backing = i.backLeft && i.backRight;
    if (i.tapLeft) this.queued = { side: -1, at: this.clock };
    if (i.tapRight) this.queued = { side: 1, at: this.clock };
    if (this.queued && this.clock - this.queued.at > BUFFER + 0.1) this.queued = null;
    if (backing) {
      // (the second brake a moment after the first: the sweep that just started straightens out)
      this.queued = null;
      if (b.kind === 'rev' && b.sweep && b.t < 0.35) b.sweep = false;
    }
    if (b.kind === 'fwd' || b.kind === 'rev') {
      b.t += dt / b.dur;
      if (b.t < 1) return;
    }
    const start = (kind: 'fwd' | 'rev', side: -1 | 1, power: number, sweep: boolean) => {
      const quick = kind === 'fwd' && this.sprinting ? 0.66 : 1;
      this.blade = { kind, side, t: 0, dur: (kind === 'rev' ? 0.55 : 0.62 - power * 0.16) * quick, power, sweep };
      this.lastSide = side;
      this.effort = Math.min(1, this.effort + 0.3 * power);
      if (kind === 'fwd') this.lastCatch = this.clock;
      if (kind === 'fwd') this.pumped(power);
      // a forward stroke turns you away from its side, a reverse sweep towards it
      if (kind === 'fwd') this.spinFwd = -side;
      else this.spinRev = side;
      this.events.stroke?.(power, kind === 'rev', side);
    };
    if (this.queued) {
      start('rev', this.queued.side, 1, true);
      this.queued = null;
      return;
    }
    if (backing) {
      // holding the line he started on, as going forward, but a back stroke pulls the bow
      // towards its side, so it goes on the side the bow is wandering away from
      this.line ??= this.heading;
      const off = angle(this.heading - this.line) + this.yawRate * 0.3;
      const drift = off > 0.06 ? 1 : off < -0.06 ? -1 : 0;
      const side: -1 | 1 = drift ? (-drift as -1 | 1) : this.lastSide > 0 ? -1 : 1;
      start('rev', side, 1, false);
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

  /**
   * Sprinting: while sprint's held and you're paddling (one side or both), every stroke is
   * quicker and harder, for as long as your breath lasts. Run out and you have to let go, and get
   * a bit of it back, before you can go again.
   */
  private sprint(dt: number, i: Intent) {
    const paddling = i.left > 0.05 || i.right > 0.05;
    if (!i.sprint) this.puffed = false;
    const want = i.sprint && paddling && !this.puffed;
    if (this.sprinting && want && this.wind > 0) {
      this.wind = Math.max(0, this.wind - dt / SPRINT);
      this.effort = 1; // digging in: a steady boat
      if (this.wind <= 0) this.puffed = true;
      return;
    }
    this.sprinting = false;
    this.wind = Math.min(1, this.wind + dt / RECOVER);
    if (want && this.wind > 0.2) {
      this.sprinting = true;
      this.events.sprint?.();
    }
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
      const fl = -RUDDER * 0.35 * vl * Math.abs(vl);
      return { fa, fl, tau: a * fl - l * fa };
    }
    // a stroke: the blade goes in near the feet and comes out by the hip (a sweep reaches wide
    // and round to the stern), pushing the boat the other way from how it moves through the water
    const env = Math.sin(b.t * Math.PI);
    const fwd = b.kind === 'fwd';
    const a = fwd ? 1.1 - b.t * 1.8 : -0.7 + b.t * 1.8;
    const l = b.side * (b.sweep ? 1.6 : 0.7);
    const u = BLADE_SPEED * (0.6 + 0.4 * b.power) * (fwd && this.sprinting ? 1.45 : 1);
    // (going forward, a reverse blade bites harder, but only so much; backing up, it's slower)
    const back = fwd || b.sweep ? u : u * BACKING;
    const bite = fwd ? Math.max(0, u - relAlong) : Math.max(0, Math.min(u * 1.25, back + relAlong));
    let fa = BLADE * bite * env * (fwd ? 1 : -1) * (b.sweep ? 0.75 : 1) * (0.5 + 0.5 * b.power);
    // a sweep also pushes the ends out sideways: the bow away at the start, the stern at the end
    // (a reverse sweep checks you and swings you round: a firm correction, not a handbrake turn)
    const fl = b.sweep ? -b.side * BLADE * 2.4 * env * (fwd ? 1 : -0.4) * Math.sign(a) * (0.5 + 0.5 * b.power) : 0;
    if (!fwd) fa *= 0.6;
    else if (this.sprinting) fa *= 1.25;
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
    const was = this.wave;
    this.wave = this.train ? waveAt(this.train, this.s - this.train.s, this.side - this.train.u) : { h: 0, slope: 0, k: -1, d: 0, lean: 0, amp: 0 };
    const wave = this.wave;
    if (wave.k >= 0 && up) this.waves |= 1 << wave.k;
    // over a crest fast: off it, for a moment
    if (up && running && !this.airborne && wave.k >= 0 && wave.k === was.k && was.d < 0 && wave.d >= 0 && wave.amp > 0.5 && this.speed > HOP_FROM) {
      const vy = Math.min(3.4, wave.amp * (this.speed - 5) * 1.2);
      if (vy > 1) {
        this.airborne = this.hopping = true;
        this.vy = vy;
      }
    }

    this.effort *= Math.exp(-dt * 0.8);
    this.leanNow += (i.lean - this.leanNow) * (1 - Math.exp(-dt * 10));
    this.pitchNow += (i.pitch - this.pitchNow) * (1 - Math.exp(-dt * 10));

    // what's in the water here: holes, tongues, ledges, and the rest
    let hole: Hole | null = null;
    let tongue: Tongue | null = null;
    const things = course.near(this.s - 14, this.s + 8); // (a big rock's eddy reaches a long way down)
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
    this.eddyAt = 0;
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
    this.through.set(hx * relAlongMid + ex * relAcrossMid, hz * relAlongMid + ez * relAcrossMid);
    const blade = up ? this.bladeForce(relAlongMid, relAcrossMid) : null;
    if (blade) {
      fx0 += hx * blade.fa + ex * blade.fl;
      fz0 += hz * blade.fa + ez * blade.fl;
      tau += blade.tau;
    }
    // on its edge, moving through the water, it carves round the way it's leaning
    if (up) tau += this.leanNow * Math.max(-1, Math.min(4, relAlongMid)) * CARVE;
    // leaning forward drives the boat on a little; a hole pours back and turns you sideways
    fx0 += hx * this.pitchNow * 0.3 * (up ? 1 : 0);
    fz0 += hz * this.pitchNow * 0.3 * (up ? 1 : 0);
    // down the back of a wave the water carries you on; up its face it holds you back
    if (!this.airborne) {
      fx0 -= fx * wave.slope * WAVE_PULL;
      fz0 -= fz * wave.slope * WAVE_PULL;
    }
    if (hole) tau += Math.sin(this.clock * 2.7) * 2.4 * hole.strength;
    // in a storm, the wind shoves you across the river (paddle into it, or ride it)
    if (up && running && !this.airborne) {
      fx0 += rx * this.gust;
      fz0 += rz * this.gust;
    }
    this.vel.x += fx0 * dt;
    this.vel.y += fz0 * dt;
    this.yawRate += (tau / INERTIA - this.yawRate * SPIN_DAMP) * dt;
    this.heading += this.yawRate * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;

    // rocks and logs knock it about
    this.touching = false;
    this.slide.set(0, 0);
    if (this.balance !== 'swimming') {
      for (const t of things) if ('kind' in t && (t.kind === 'rock' || t.kind === 'log')) this.collide(t, running);
    }
    // pinned broadside on a rock or across two, going nowhere: the current swings the boat round
    // until it points down the river (or back up it), and it slides off or slips through
    this.pinned = this.touching && this.speed < 1.5 ? this.pinned + dt : Math.max(0, this.pinned - dt * 0.5);
    if (this.pinned > 0.35) {
      const down = angle(p.a - this.heading);
      const back = angle(p.a + Math.PI - this.heading);
      const to = Math.abs(down) < Math.abs(back) ? down : back;
      this.yawRate += Math.sign(to) * Math.min(1, Math.abs(to) * 2) * 6 * dt;
      // along a log, it's washed off the end
      this.vel.x += this.slide.x * 4 * dt;
      this.vel.y += this.slide.y * 4 * dt;
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

    this.eddy = this.eddyAt;
    if (running) this.eddying(up);
    if (up) this.rollPhysics(dt, p, hole, running);
    if (this.balance === 'over') this.rocked = true;

    // up and down: riding the water, or flying off a ledge
    const bob = Math.sin(this.clock * 2.1) * 0.03 + Math.sin(this.clock * 5.3 + p.s) * this.rough * 0.08;
    const bed = course.heightAt(this.s);
    const water = bed + bob + this.flip * 0.12 + wave.h; // upside down, the hull rides high
    // off a lip: the river falling away under it faster than it can follow (a small step at a
    // time it only drops a few centimetres, so it's how fast that tells)
    const away = (this.bed - bed) / dt;
    this.bed = bed;
    if (!this.airborne && (water < this.pos.y - 0.3 || away > 2)) {
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
    const w = waterAt(this.course!, x, z, p.s, things);
    const q = w.sample;
    let flow = w.along;
    if (tongue) flow += 2.2 * (1 - w.eddy);
    const fwd = Math.max(0, this.pitchNow);
    const back = Math.max(0, -this.pitchNow);
    if (hole) flow *= 1 - hole.strength * (1.5 + back * 0.8 - fwd * 0.6) * Math.max(0.3, 1 - Math.max(0, this.holed - 1.5) * 0.3);
    // white water jostles you sideways: quick little shoves, never so long or so hard that you
    // can't paddle out of them (an eddy's water is calmer)
    const churn = Math.min(1, q.rough * channel(q, w.side).rough) * 0.6 * (1 - w.eddy * 0.7)
      * (Math.sin(this.clock * 2.3 + q.s * 0.45) + Math.sin(this.clock * 4.1 + q.s * 0.17 + w.side) * 0.5)
      + q.boil * 0.9 * (1 - w.eddy * 0.7) * Math.sin(this.clock * 0.8 + q.s * 0.09) // (the boil below a fall, shoving you about)
      + this.storm * 0.4 * (1 - w.eddy * 0.7) * Math.sin(this.clock * 1.7 + q.s * 0.3); // (and a storm's chop)
    this.eddyAt += w.eddy * 0.5;
    return { x: w.fx * flow - w.fz * churn + w.px, z: w.fz * flow + w.fx * churn + w.pz };
  }

  /**
   * Catching an eddy: in from the current (it has to be a real move, not drifting into it) and
   * brought to a stop in the slack water. Out again into the current, upright: peeled out.
   */
  private eddying(up: boolean) {
    const moving = this.speed;
    if (this.eddy < 0.15 && moving > 3) {
      if (this.caught && up) this.events.peel?.();
      this.caught = false;
      this.inCurrent = this.clock;
    }
    if (!this.caught && up && this.eddy > 0.5 && moving < 3 && this.clock - this.inCurrent < 4) {
      this.caught = true;
      this.events.eddy?.();
    }
    if (!up) this.caught = false;
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

  // --- wave trains ------------------------------------------------------------------------------

  /** The wave train you're in or coming up to; out the bottom of it, how it went. */
  private trains(course: Course, running: boolean) {
    const t = this.train;
    if (t && this.s > t.s + t.length * (t.count + 0.5)) {
      // (it has to have been ridden: most of its waves under you, not paddled round)
      if (running && bits(this.waves) >= Math.ceil(t.count * 0.6)) this.events.rode?.(t.count, this.pumps, !this.rocked);
      this.train = null;
    }
    if (this.train) return;
    for (const x of course.near(this.s - 64, this.s + 4)) {
      if (!('kind' in x) || x.kind !== 'train') continue;
      if (this.s > x.s - 3 && this.s < x.s + x.length * (x.count + 0.5)) {
        this.train = x;
        this.pumpK = -1;
        this.pumpChain = this.pumps = 0;
        this.waves = 0;
        this.rocked = false;
        return;
      }
    }
  }

  /**
   * A forward stroke going in on the back of a wave, as it drops away under you: it pumps you on,
   * once a wave. One every wave down the train is a chain.
   */
  private pumped(power: number) {
    const w = this.wave;
    if (w.k < 0 || this.airborne || w.d < 0.02 || w.d > 0.45 || w.k === this.pumpK) return;
    this.pumpChain = this.pumpK === w.k - 1 ? this.pumpChain + 1 : 1;
    this.pumpK = w.k;
    this.pumps++;
    const push = PUMP * (0.5 + w.amp) * (0.6 + power * 0.4);
    this.vel.x += Math.sin(this.heading) * push;
    this.vel.y -= Math.cos(this.heading) * push;
    this.events.pump?.(this.pumpChain);
  }

  // --- the roll ---------------------------------------------------------------------------------

  /**
   * The wind in a storm: a gust from one bank that builds, holds a few seconds and eases, and now
   * and then swings round to come from the other side. Nothing at all on a calm day.
   */
  private blow(dt: number) {
    if ((this.gustIn -= dt) < 0) {
      this.gustIn = 3 + Math.random() * 5;
      if (Math.random() < 0.35) this.gustSide = this.gustSide > 0 ? -1 : 1;
      // a lull between gusts, now and then
      this.gustTo = this.storm < 0.3 || Math.random() < 0.25 ? 0 : this.gustSide * (0.5 + Math.random() * 0.5) * GUST * this.storm;
    }
    const flutter = 1 + Math.sin(this.clock * 3.1) * 0.15 + Math.sin(this.clock * 7.3) * 0.08;
    this.gust += (this.gustTo * flutter - this.gust) * (1 - Math.exp(-dt * 1.2));
  }

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
    // below a big waterfall the water boils: long slow heaves one way and then the other, and
    // every so often a boil bursting up under one edge. Lean against it and keep paddling.
    const boil = p.boil * (1 - this.eddy * 0.6);
    if (boil > 0 && !this.airborne) {
      torque += boil * (3.6 + this.difficulty * 1.5) * stance * (Math.sin(t * 1.6 + p.s * 0.13) * 0.75 + Math.sin(t * 0.9 + p.s * 0.05) * 0.25);
      if (Math.random() < dt * boil * 1.4) this.tiltV += (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.3) * boil * stance;
    }
    torque += Math.max(-5, Math.min(5, this.crossflow * Math.abs(this.crossflow) * 0.75));
    torque += this.gust * 0.6; // a gust heels you over: lean into the wind
    // climbing a wave's face: a crest that meets the hull at an angle (it leans across the river,
    // or the boat's not square to it) lifts the side it meets first and rolls you away from it.
    // Square up to it, or lean into it.
    const w = this.wave;
    if (w.k >= 0 && !this.airborne) {
      const face = Math.max(0, 1 - Math.abs(w.d + 0.15) / 0.22);
      const square = angle(this.heading - p.a + Math.atan(CREST_LEAN * w.lean));
      torque += WAVE_ROLL * Math.sin(square) * w.amp * face * stance * THREE.MathUtils.clamp(p.speed / 6, 0.5, 1.2);
    }
    // a hard turn at speed throws you to the outside of it: lean into the turn
    torque -= this.yawRate * Math.max(0, this.speed - 3) * 0.25;
    // the paddler: leaning shifts his weight, and a boat being paddled sits steadier
    let lean = this.leanNow;
    if (this.assisted) lean = Math.max(-1, Math.min(1, lean - this.tilt * 1.4 - this.tiltV * 0.35));
    torque += lean * 4.5;
    torque += this.slam;
    this.slam *= Math.exp(-dt * 2.2);
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
    const asked = i.brace || (leaning && (i.tipBrace || (falling < 0 && i.tapLeft) || (falling > 0 && i.tapRight)));
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
    this.tiltV = this.slam = 0;
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
    if (l.passed || this.s < l.s - LIP_AT) return;
    l.passed = true;
    this.dropHeight = l.height;
    this.lipSpeed = this.speed;
    this.lipSkew = this.here ? angle(this.heading - this.here.a) : 0;
    // a boof: a stroke catching right at the lip, not leaning forward (leaning back lifts the bow more)
    this.boofing = running && this.balance === 'up' && this.clock - this.lastCatch < BOOF_WINDOW && this.pitchNow < 0.3;
  }

  private land(fall: number, water: number) {
    this.airborne = false;
    this.pos.y = water;
    this.vy = 0;
    if (this.hopping) {
      // off a wave: land level and ride on, or land on an edge and it throws you further over
      this.hopping = false;
      if (this.balance !== 'up' && this.balance !== 'over') return;
      const off = Math.abs(this.tilt);
      if (off < 0.35) this.events.air?.(true);
      else {
        this.tiltV += Math.sign(this.tilt) * off * 4.5;
        this.events.air?.(false);
      }
      this.pitch = 0.1;
      this.events.splash?.(fall, this.pos.clone());
      return;
    }
    const height = (fall * fall) / (2 * GRAVITY);
    const upright = this.balance === 'up' || this.balance === 'over';
    const kick = (k: number) => (this.tiltV += (Math.random() < 0.5 ? -1 : 1) * k);
    if (height > 0.6 && upright && this.dropHeight >= 3) {
      // a waterfall: tuck forward and knife in straight, or land flat or skewed and feel it. A
      // little one forgives a half-hearted tuck and a line a bit off; a big one wants you right
      // forward and pointing straight down it. (On a touch screen he tucks for himself.)
      const big = Math.max(0, Math.min(1, (this.dropHeight - 3.5) / 3));
      const tuck = this.assisted ? 1 : Math.max(0, Math.min(1, (this.pitchNow - 0.1) / (0.4 + big * 0.5)));
      const straight = Math.max(0, 1 - Math.max(0, Math.abs(this.lipSkew) - 0.05) / (0.5 - big * 0.3))
        * Math.max(0, 1 - Math.abs(this.tilt) / TIP);
      const miss = 1 - tuck * straight;
      this.pitch = 0.3 - miss * 0.4;
      this.vel.multiplyScalar(0.9 - miss * 0.4);
      if (miss < 0.35) this.jumpHole();
      if (miss < 0.15) {
        this.events.ledge?.('tuck', height);
      } else {
        // thrown over the way the bow was skewed, if it was, and the water keeps on rolling you
        // that way for a moment after: a brace alone won't do, lean against it too
        const k = miss * (1.6 + this.dropHeight * 0.75);
        const side = Math.abs(this.lipSkew) > 0.1 ? Math.sign(this.lipSkew) : Math.random() < 0.5 ? -1 : 1;
        this.tiltV += side * k;
        this.slam = side * miss * (2 + this.dropHeight * 0.7);
        this.events.ledge?.(tuck < straight ? 'flat' : 'skew', height);
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
      this.touching = true;
      this.shaved.add(o); // no credit for a shave you hit, however softly
      if (o.kind === 'log') {
        const len = Math.hypot(o.x1 - o.x0, o.z1 - o.z0) || 1;
        this.slide.set((o.x1 - o.x0) / len, (o.z1 - o.z0) / len);
      }
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
      const at = new THREE.Vector3(ox + nx * r, this.pos.y, oz + nz * r);
      if (this.balance === 'rolling' && -vn > 1.2 && running) {
        this.events.hit?.(-vn, at);
        this.drown(); // upside down on a rock: out you come
        return;
      }
      if (-vn > 1.4) this.events.hit?.(-vn, at);
      else this.events.bump?.(-vn, at);
    }
    // inches to spare, going fast: a close shave, but only once you're clear of it without touching
    if (this.shaved.has(o)) return;
    if (running && closest > 0 && closest < 0.35 && this.speed > 4 && this.balance === 'up') this.skimmed.add(o);
    else if (this.skimmed.has(o) && closest > 0.7) {
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
    // (and up the face of a wave the bow lifts, down its back it dips)
    const ride = this.airborne ? 0 : -Math.atan(this.wave.slope) * 0.9;
    m.rotation.x = dive + this.pitch + this.pitchNow * 0.18 + ride; // leaning forward dips the bow
    const side = Math.sign(this.tilt) || 1;
    m.rotation.z = this.tilt * (1 - this.flip) + side * Math.PI * this.flip; // + rolls the right side down
  }
}

/** How many bits are set. */
function bits(n: number) {
  let c = 0;
  for (; n; n &= n - 1) c++;
  return c;
}

/** An angle wrapped to -π..π. */
function angle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
