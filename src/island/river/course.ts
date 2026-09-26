/**
 * The river, made up as you go: a mountain river through thick forest, sampled every metre along
 * its centre line, with a width, a speed and a character that drift from one stretch to the next.
 * It really runs downhill: gently through the forest runs, steeply through the rapids, and in
 * steps down cascades of ledges and over the odd waterfall, with slow green pools in between.
 *
 * In the water: rocks in rows (always with a line through), logs reaching out from the banks,
 * ledges to boof, holes to punch, tongues of smooth fast water between the rocks, and tennis
 * balls. The chutes, and now and then a run or a rapid, are laid out instead as set pieces (see
 * piece()): a slalom, a row of doors, an old weir, a boulder to pick a side of. Everything comes
 * from one seed, so the same seed is the same river. How hard it gets, and what's allowed in it, is
 * the river's Profile (rivers.ts): the Dawdle never gets past grade 2; Hold My Coffee starts hot.
 *
 * Coordinates are three's: x east, y up, z south. The river runs roughly north (-z), never
 * turning more than ~55° off it, so it never doubles back on itself.
 */

import { DEFAULT_PROFILE, type Profile } from './rivers';

export type Kind = 'pool' | 'run' | 'chute' | 'rapids' | 'cascade' | 'gorge' | 'falls';

/** What a stretch is like; each sample drifts towards its stretch's values. */
interface Character {
  width: number;
  speed: number; // m/s at the middle
  rough: number; // 0..1: white water
  rocks: number; // rocks per metre (before difficulty)
  bend: number; // how hard it winds, 0..1
  slope: number; // metres down per metre along
  clear: number; // slow, clear water over pebbles, ferns and reeds at the edge
  gorge: number; // rock walls
  heat: number; // 0..1: how hard the stretch is (see Stretch.heat)
}

export interface Sample {
  s: number;
  x: number;
  z: number;
  /** The water's height. */
  y: number;
  /** Heading: 0 = north (-z), positive turns east. */
  a: number;
  width: number;
  speed: number;
  rough: number;
  clear: number;
  gorge: number;
  /** 0..1: the water pouring over a ledge here. */
  drop: number;
  /** The stretch this sample belongs to. */
  stretch: number;
  /** 0..1: how hard the river is here, drifting between stretches like everything else. */
  heat: number;
  /** An island splitting the river here: half its width (m, 0: none) and its middle (m across, + is river right). */
  isle: number;
  isleU: number;
  /** Which channel round the island is the fast, white one: -1 river left, 1 right (0: no island). */
  hero: number;
  /**
   * How hard it's bending (rad/m, + to the right), smoothed and lagging a little behind the bank,
   * as the water does: the fast core swings out after the bend's apex (see flow.ts).
   */
  bend: number;
}

/**
 * The river parting round an island and joining again below it: a wooded island with a jam of
 * driftwood at its head, or a low gravel bar in the slow water. One channel is the hero line, fast
 * and white with rocks and balls in it; the other is the sneak, slower and easier.
 */
export interface Split {
  kind: 'isle' | 'bar';
  s0: number;
  s1: number;
  /** Half the island's width at its widest (m), and its middle across the river (m). */
  half: number;
  u: number;
  hero: -1 | 1;
}

/** How the water runs in a channel round an island, against the river's own. */
export function channel(p: Sample, side: number) {
  if (p.isle <= 0) return { speed: 1, rough: 1 };
  const k = Math.min(1, p.isle / 1.5);
  const hero = Math.sign(side - p.isleU) === p.hero;
  return hero ? { speed: 1 + 0.2 * k, rough: 1 + 0.5 * k } : { speed: 1 - 0.22 * k, rough: 1 - 0.6 * k };
}

/** The island's shape along its length (0..1): a blunt head, a long tapering tail. */
function lens(t: number) {
  if (t <= 0 || t >= 1) return 0;
  const head = Math.sqrt(Math.min(1, t / 0.22));
  const tail = 1 - Math.pow(Math.max(0, (t - 0.45) / 0.55), 1.6);
  return head * tail;
}

export interface Rock {
  kind: 'rock';
  x: number;
  z: number;
  r: number;
  s: number;
  variant: number;
  /** Not a rock but a timber post of an old weir: it knocks you about just the same. */
  post?: boolean;
  /** One of the land's boulders at the water's edge: solid, but it has its own mesh and moves no water. */
  scenery?: boolean;
}

export interface Log {
  kind: 'log';
  /** From the bank end to the tip, in the river. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  r: number;
  s: number;
  variant: number;
}

export type Obstacle = Rock | Log;

export interface Pickup {
  kind: 'ball';
  x: number;
  z: number;
  s: number;
  taken: boolean;
}

/** A pair of slalom buoys (or, in a chute, two poles hung from a wire over the river): go between them. */
export interface Gate {
  a: { x: number; z: number };
  b: { x: number; z: number };
  s: number;
  passed: boolean;
  hung?: boolean;
}

/** A step down across the whole river: boof it (a hard stroke at the lip) to land flat. */
export interface Ledge {
  kind: 'ledge';
  s: number; // the lip
  height: number;
  passed: boolean;
}

/**
 * A hole (a stopper): water pouring back on itself, at the foot of a ledge or behind a hidden
 * rock. Hit it slowly and it holds you and tries to flip you; paddle hard and you punch through.
 */
export interface Hole {
  kind: 'hole';
  s: number;
  /** Across the river: its middle and half its width (m, + is river right). */
  u: number;
  half: number;
  strength: number; // 0..1
}

/** A tongue: a smooth V of fast water through a gap. Line up in it and it carries you. */
export interface Tongue {
  kind: 'tongue';
  s: number;
  u: number; // m across, + is river right
  half: number;
  taken: boolean;
}

/**
 * A wave train: a row of standing waves down a straight, where the water's squeezed and running
 * hard. Each crest leans a little across the river one way or the other (a diagonal), and a crest
 * that meets the hull at an angle rolls the boat: square up to it, or lean into it. Stroke on the
 * back of a wave and it pumps you on; hit a big crest fast and you're off it.
 *
 * All in river space: `s` is where it starts, `u` its middle across (m, + is river right).
 */
export interface Train {
  kind: 'train';
  s: number;
  u: number;
  half: number;
  /** How far apart the crests are (m), how many, and how high the biggest (m, crest to mean). */
  length: number;
  count: number;
  amp: number;
  /** How hard the crests lean (0..1), and the train's own random number for which way each does. */
  skew: number;
  seed: number;
}

/**
 * Crest k of a train: how far it leans (+: its right end further downstream, so it meets the
 * boat's left side first and rolls it to the right) and how high it is (the first and the last
 * lower than the middle). The water's shader works these out the same way.
 */
export function crest(t: Train, k: number) {
  const lean = t.skew * Math.sin(k * 2.4 + t.seed * 6.283);
  const amp = t.amp * (0.55 + 0.45 * Math.sin((Math.PI * (k + 0.5)) / t.count));
  return { lean, amp };
}

/** How far across the river a crest's lean moves it along (m along per m across, at lean 1). */
export const CREST_LEAN = 0.5;

/**
 * The water in a train at `along` metres past its start and `c` metres off its middle: its height
 * over the river's own, the slope along (+ rising downstream), the nearest crest, and how far
 * from that crest (in wavelengths: - still climbing its face, + sliding down its back).
 */
export function waveAt(t: Train, along: number, c: number) {
  const out = { h: 0, slope: 0, k: -1, d: 0, lean: 0, amp: 0 };
  if (along < -t.length * 0.5 || along > t.length * (t.count + 0.5)) return out;
  const side = 1 - smoothstep(0.55, 1, Math.abs(c) / t.half);
  if (side <= 0) return out;
  let best = Infinity;
  const k0 = Math.floor(along / t.length);
  for (let k = Math.max(0, k0 - 1); k <= Math.min(t.count - 1, k0 + 1); k++) {
    const w = crest(t, k);
    const d = along - ((k + 0.5) * t.length + w.lean * CREST_LEAN * c);
    if (Math.abs(d) < Math.abs(best)) {
      best = d;
      out.k = k;
      out.lean = w.lean;
      out.amp = w.amp * side;
    }
  }
  if (out.k < 0 || Math.abs(best) > t.length * 0.75) return { ...out, k: -1 };
  // (fading out past the first and the last crests, back to the river's own water)
  const x = best / t.length;
  const fade = Math.abs(x) > 0.5 ? Math.max(0, 1 - (Math.abs(x) - 0.5) * 4) : 1;
  const edge = (out.k === 0 && x < -0.5) || (out.k === t.count - 1 && x > 0.5) ? fade : 1;
  out.h = out.amp * Math.cos(2 * Math.PI * x) * edge;
  out.slope = (-out.amp * 2 * Math.PI * Math.sin(2 * Math.PI * x) * edge) / t.length;
  out.d = x;
  return out;
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export type Thing = Obstacle | Pickup | Gate | Ledge | Hole | Tongue | Train;

export interface Stretch {
  kind: Kind;
  start: number;
  end: number;
  /** For white water: a name and a grade, for the banner. */
  name?: string;
  grade?: number;
  /**
   * 0..1: how hard it is: how many rocks, how tight the gaps, how fast, how many holes. It climbs
   * the further you get, and white water takes turns being harder and a bit less hard.
   */
  heat: number;
  /** A chute between rock walls, rather than trees. */
  slot?: boolean;
  /** Where a run or a rapid has a set piece laid out in it (see Course.piece). */
  pieceAt?: number;
  /** The last pool, with the finish in it. */
  takeout?: boolean;
}

const BASE: Record<Kind, Character> = {
  pool: { width: 19, speed: 2.4, rough: 0, rocks: 0.006, bend: 0.35, slope: 0, clear: 1, gorge: 0, heat: 0 },
  run: { width: 13, speed: 5.4, rough: 0.3, rocks: 0.045, bend: 0.8, slope: 0.015, clear: 0.3, gorge: 0, heat: 0 },
  // fast, smooth water with its rocks laid out in set pieces: going like the clappers, with time to dodge
  chute: { width: 13.5, speed: 7.6, rough: 0.35, rocks: 0, bend: 0.5, slope: 0.035, clear: 0, gorge: 0.2, heat: 0 },
  rapids: { width: 13.5, speed: 7.4, rough: 0.9, rocks: 0.13, bend: 1, slope: 0.05, clear: 0, gorge: 0.15, heat: 0 },
  cascade: { width: 11, speed: 5.0, rough: 0.55, rocks: 0.03, bend: 0.3, slope: 0.01, clear: 0, gorge: 0.35, heat: 0 },
  gorge: { width: 11, speed: 6.9, rough: 0.65, rocks: 0.07, bend: 0.9, slope: 0.035, clear: 0, gorge: 1, heat: 0 },
  falls: { width: 12, speed: 4.6, rough: 0.3, rocks: 0.01, bend: 0.2, slope: 0.005, clear: 0.2, gorge: 0.5, heat: 0 },
};

/** White water gets a name; the river has seen a few paddlers before you. */
const RAPIDS = [
  'The Washing Machine', 'The Cheese Grater', 'Rock Garden', 'The Staircase', 'Pinball', 'Last Orders',
  'The Mangle', 'Sock Drawer', 'Big Wet', 'The Tumble Dryer', 'Second Thoughts', 'Pardon My French',
];
/** And so do the chutes: the first is always the Flume. */
const CHUTES = ['The Luge', 'Greased Lightning', 'The Waterslide', 'Express Lane', 'The Bobsleigh', 'Slip Road', 'Hold Onto Your Hat'];

/** The set pieces (see Course.piece). */
export type Piece = 'slalom' | 'strainers' | 'doors' | 'funnel' | 'weir' | 'fork' | 'balls' | 'waves';

/** How fast a boat can ferry across the current (m/s): no piece asks the line to move faster. */
const FERRY = 1.25;

/** A small seeded random number generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise, -1..1. */
function noise1(x: number, seed: number) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

const STEP = 1; // metres between samples
const MAX_TURN = 0.95; // radians off north
const CELL = 12; // the spatial hash's cell size (m)
const BUCKET = 16;
const LIP = 2; // metres a ledge's water takes to fall
/** The river starts high up: it has a long way to go down. */
export const SOURCE = 300;

export class Course {
  readonly samples: Sample[] = [];
  readonly stretches: Stretch[] = [];
  readonly obstacles: Obstacle[] = [];
  readonly ledges: Ledge[] = [];
  /** Things for the banks: a footbridge, somebody's camp, a cabin by a pool. */
  readonly features: { kind: 'bridge' | 'tent' | 'cabin' | 'swing'; s: number; side: number }[] = [];
  readonly splits: Split[] = [];
  private random: () => number;
  /**
   * The rocks, balls and the rest have their own random numbers, so however far ahead they've
   * been placed, the river's own shape comes out the same for the same seed.
   */
  private scatter: () => number;
  private hash = new Map<number, number[]>();
  /** Everything in the water by the 16 m of river it's in, to find the things nearby. */
  private buckets = new Map<number, Thing[]>();
  private char: Character = { ...BASE.pool };
  private a = 0; // heading
  private x = 0;
  private z = 0;
  private y = SOURCE;
  private falling: { from: number; height: number } | null = null;
  private churn = 0; // white water at the foot of a ledge, settling downstream
  private bend = 0;
  private placedTo = 0; // rocks and the rest are placed up to here
  private names: string[];
  private chuteNames: string[];
  /** Where the line through the set pieces is (m across, + is river right), and the last piece laid. */
  private lane = 0;
  /** Where the last row of rocks left its gap, across the river (-1..1), from one place() to the next. */
  private gap = 0;
  private lastPiece: Piece | null = null;
  /** The line the set pieces were laid round, beat by beat (for the tests to paddle). */
  readonly line: { s: number; u: number; piece: Piece | 'rest' }[] = [];
  /** The lips still to come, in order. */
  private lips: Ledge[] = [];
  /** The wave trains, and where the last one ended (and it itself, just laid). */
  readonly trains: Train[] = [];
  private lastTrain = -999;
  private lastTrainAt: Train | null = null;

  /**
   * `finish`: the take-out, where the run ends (a bridge over a last slow pool). Past it the river
   * only pools on, for the kayak to drift in.
   */
  constructor(readonly seed: number, readonly finish = Infinity, readonly profile: Profile = DEFAULT_PROFILE) {
    this.random = rng(seed);
    this.scatter = rng(seed ^ 0x5bd1e995);
    this.names = shuffle(RAPIDS, this.random);
    this.chuteNames = shuffle(CHUTES, this.random);
    // a slow green pool to get the feel of it, an easy forest run, a fast chute to learn to
    // dodge in, and then the first white water
    this.stretches.push({ kind: 'pool', start: 0, end: 110, heat: 0 });
  }

  /** The river as far as `s` (and its furniture a little short of that). */
  extend(s: number) {
    while (this.length < s) this.grow();
    this.place(Math.max(0, s - 40));
  }

  get length() {
    return this.samples.length * STEP;
  }

  /** The sample at arc length s (clamped), without interpolation. */
  at(s: number): Sample {
    const i = Math.max(0, Math.min(this.samples.length - 1, Math.round(s / STEP)));
    return this.samples[i];
  }

  /**
   * Where the river is at arc length s, interpolated between samples: for anything travelling
   * along it (a bird, a dog on the bank), which would otherwise hop a metre at a time.
   */
  along(s: number): Pick<Sample, 'x' | 'y' | 'z' | 'a' | 'width'> {
    const i = Math.max(0, Math.min(this.samples.length - 2, Math.floor(s / STEP)));
    const f = Math.max(0, Math.min(1, s / STEP - i));
    const p = this.samples[i];
    const q = this.samples[i + 1] ?? p;
    const mix = (u: number, v: number) => u + (v - u) * f;
    return { x: mix(p.x, q.x), y: mix(p.y, q.y), z: mix(p.z, q.z), a: mix(p.a, q.a), width: mix(p.width, q.width) };
  }

  /** The water's height at arc length s, interpolated (for the kayak riding over a lip). */
  heightAt(s: number) {
    const i = Math.max(0, Math.min(this.samples.length - 2, Math.floor(s / STEP)));
    const f = Math.max(0, Math.min(1, s / STEP - i));
    return this.samples[i].y * (1 - f) + this.samples[i + 1].y * f;
  }

  /** The island the river is parting round at arc length s, if any. */
  splitAt(s: number): Split | undefined {
    return this.splits.find((x) => s >= x.s0 && s <= x.s1);
  }

  /** The stretch at arc length s. */
  stretchAt(s: number): Stretch {
    for (let i = this.stretches.length - 1; i >= 0; i--) if (this.stretches[i].start <= s) return this.stretches[i];
    return this.stretches[0];
  }

  /** How hard the river is at arc length s, 0..1. */
  difficulty(s: number) {
    return this.at(s)?.heat ?? 0;
  }

  /**
   * Harder the further you get: the river's starting heat through the opening, then easing up to
   * its top heat by the take-out. (By the river's length, not the finish, so a probe for where to
   * push off makes the same river.)
   */
  private ramp(s: number) {
    const [lo, hi] = this.profile.heat;
    const t = Math.max(0, Math.min(1, (s - 550) / Math.max(400, this.profile.length - 500)));
    return lo + (hi - lo) * (t * t * (3 - 2 * t) * 0.6 + t * 0.4);
  }

  /**
   * The nearest point on the centre line to (x, z), searching near arc length `hint` when given
   * (which is how the kayak keeps track of itself) or through the spatial hash otherwise.
   */
  nearest(x: number, z: number, hint?: number): { sample: Sample; d: number; side: number } {
    let best = -1;
    let bestD = Infinity;
    const test = (i: number) => {
      const p = this.samples[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    };
    if (hint !== undefined && Number.isFinite(hint)) {
      const c = Math.max(0, Math.min(this.samples.length - 1, Math.round(hint / STEP)));
      for (let i = Math.max(0, c - 12); i <= Math.min(this.samples.length - 1, c + 12); i++) test(i);
    } else {
      const cx = Math.floor(x / CELL);
      const cz = Math.floor(z / CELL);
      for (let ring = 0; ring < 7; ring++) {
        for (let dx = -ring; dx <= ring; dx++) {
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            for (const i of this.hash.get(key(cx + dx, cz + dz)) ?? []) test(i);
          }
        }
        // anything in a further ring is at least `ring` cells away
        if (best >= 0 && Math.sqrt(bestD) < ring * CELL) break;
      }
    }
    if (best < 0) for (let i = 0; i < this.samples.length; i += 4) test(i);
    if (best < 0) best = 0; // (x, z) isn't a number: the start will do
    const p = this.samples[best];
    // which side of the centre line: + is the river's right (east when heading north)
    const side = (x - p.x) * Math.cos(p.a) + (z - p.z) * Math.sin(p.a);
    return { sample: p, d: Math.sqrt(bestD), side };
  }

  /** Add a rock or a log (the land adds a bridge's trestles). */
  addObstacle(o: Obstacle) {
    this.obstacles.push(o);
    this.file(o);
  }

  /** Take one back out (the land's, when its stretch of river is dropped). */
  removeObstacle(o: Obstacle) {
    const i = this.obstacles.indexOf(o);
    if (i >= 0) this.obstacles.splice(i, 1);
    const list = this.buckets.get(Math.floor(o.s / BUCKET));
    const j = list?.indexOf(o) ?? -1;
    if (j >= 0) list!.splice(j, 1);
  }

  /** Everything in the water between arc lengths s0 and s1 (give or take a bucket). */
  near(s0: number, s1: number): Thing[] {
    const out: Thing[] = [];
    for (let b = Math.floor(s0 / BUCKET); b <= Math.floor(s1 / BUCKET); b++) {
      const list = this.buckets.get(b);
      if (list) out.push(...list);
    }
    return out;
  }

  private file(thing: Thing) {
    const b = Math.floor(thing.s / BUCKET);
    (this.buckets.get(b) ?? this.buckets.set(b, []).get(b)!).push(thing);
  }

  // --- growing it ---------------------------------------------------------------------

  private grow() {
    const s = this.samples.length * STEP;
    let stretch = this.stretches[this.stretches.length - 1];
    if (s >= stretch.end) stretch = this.nextStretch(stretch);
    const target = this.target(stretch, s);
    // round an island the river widens (starting a little before it, so there's room by its head)
    const split = this.splits.find((x) => s > x.s0 - 40 && s < x.s1 + 30);
    if (split) {
      const open = Math.min(1, (s - (split.s0 - 40)) / 30, (split.s1 + 30 - s) / 30);
      target.width += (split.half + Math.abs(split.u)) * 2 * Math.max(0, open);
    }
    // everything drifts towards the stretch it's in over ~20 m, so stretches blend into each other
    const k = 1 - Math.exp(-STEP / 20);
    const c = this.char;
    for (const key of Object.keys(c) as (keyof Character)[]) c[key] += (target[key] - c[key]) * k;

    // wind: noise sets the curvature, never tighter than the river can take, and a gentle pull
    // back towards north keeps it from wandering off sideways
    const tight = 1 / Math.max(26, c.width * 2.6);
    const curve = noise1(s / 38, this.seed) * 0.8 + noise1(s / 13, this.seed + 7) * 0.35 * c.bend;
    const was = this.a;
    this.a += (curve * tight * (0.4 + c.bend) - this.a * 0.012) * STEP;
    this.a = Math.max(-MAX_TURN, Math.min(MAX_TURN, this.a));
    this.bend += ((this.a - was) / STEP - this.bend) * (1 - Math.exp(-STEP / 7));
    this.x += Math.sin(this.a) * STEP;
    this.z -= Math.cos(this.a) * STEP;

    // downhill: steadily, and in steps over the ledges
    let drop = 0;
    const lip = this.lips[0];
    if (lip && s >= lip.s && !this.falling) {
      this.falling = { from: s, height: lip.height };
      this.lips.shift();
    }
    if (this.falling) {
      drop = 1;
      this.y -= this.falling.height / LIP;
      if (s - this.falling.from >= LIP - 1) {
        this.falling = null;
        this.churn = 1;
      }
    } else {
      this.y -= c.slope * STEP;
      this.churn = Math.max(0, this.churn - STEP / 12);
    }

    const i = this.samples.length;
    this.samples.push({
      s,
      x: this.x,
      z: this.z,
      y: this.y,
      a: this.a,
      width: c.width,
      speed: c.speed + this.churn * 1.5,
      rough: Math.max(c.rough, drop, this.churn * 0.9),
      clear: c.clear,
      gorge: c.gorge,
      drop,
      stretch: this.stretches.length - 1,
      heat: c.heat,
      isle: 0,
      isleU: 0,
      hero: 0,
      bend: this.bend,
    });
    if (split && s > split.s0 && s < split.s1) {
      // never so wide that either channel's too narrow to get down
      const q = this.samples[i];
      const room = q.width / 2 - Math.abs(split.u) - 4.4;
      q.isle = Math.max(0, Math.min(split.half * lens((s - split.s0) / (split.s1 - split.s0)), room));
      if (q.isle > 0) {
        q.isleU = split.u;
        q.hero = split.hero;
      }
    }
    const hk = key(Math.floor(this.x / CELL), Math.floor(this.z / CELL));
    (this.hash.get(hk) ?? this.hash.set(hk, []).get(hk)!).push(i);
  }

  private target(stretch: Stretch, s: number): Character {
    const h = stretch.heat;
    const t = { ...BASE[stretch.kind], heat: h };
    if (stretch.kind === 'rapids' || stretch.kind === 'gorge') {
      // the first rapid is a friendly one: a bit slower, wider and less white than the rest
      t.speed += -0.9 + h * 3;
      t.width += 1 - h * 1.5;
      t.slope += h * 0.02;
      t.rough *= 0.65 + h * 0.35;
    } else if (stretch.kind === 'chute') {
      // hotter: faster and a bit narrower; a slot is narrower still, between walls
      t.speed += h * 2.2;
      t.width += 0.5 - h * 1.2 - (stretch.slot ? 1 : 0);
      if (stretch.slot) t.gorge = 0.95;
    } else {
      t.speed += h * 0.8;
    }
    // the forest run at the start dawdles
    if (stretch.kind === 'run' && this.stretches.indexOf(stretch) === 1) t.speed -= 1;
    // a gentle river goes a bit gentler all the way down
    t.speed *= this.profile.speed;
    // every stretch widens and narrows a little on its own
    t.width *= 1 + noise1(s / 45, this.seed + 3) * 0.15;
    return t;
  }

  /**
   * What comes next. The opening is set: the pool, an easy run, a first chute and a gentle first
   * rapid. After that it's mostly white water and chutes, taking turns being harder and a bit less
   * hard, with short breathers in between that still have rocks in them, and fewer and shorter the
   * further you get. Cascades and waterfalls come once you've shown you can handle rapids.
   */
  private nextStretch(prev: Stretch): Stretch {
    const r = this.random;
    const s = prev.end;
    const d = this.ramp(s);
    const n = this.stretches.length;
    const pr = this.profile;
    const easy = (k: Kind) => k === 'pool' || k === 'run';
    let kind: Kind;
    let [lo, hi] = [0, 0];
    let heat: number;
    if (s > this.finish - 180) {
      // the take-out: one last slow pool, the bridge over it the finish line
      const next: Stretch = { kind: 'pool', start: s, end: s + 400, heat: 0, takeout: true };
      if (this.finish >= s && this.finish < next.end) {
        this.features.push({ kind: 'bridge', s: this.finish, side: 0 });
        this.features.push({ kind: 'cabin', s: this.finish + 40, side: r() < 0.5 ? -1 : 1 });
      }
      this.stretches.push(next);
      return next;
    }
    if (n === 1) {
      kind = 'run';
      [lo, hi] = [110, 130];
      heat = 0;
    } else if (n === 2) {
      kind = 'chute';
      [lo, hi] = [210, 240];
      heat = 0.1 + this.profile.heat[0] * 0.5;
    } else if (n === 3) {
      kind = 'rapids'; // the first white water: short and gentle (for the river it's on)
      [lo, hi] = [130, 150];
      heat = Math.min(this.profile.cap, 0.2 + this.profile.heat[0] * 0.5);
    } else {
      const whites = this.stretches.filter((x) => !easy(x.kind)).length;
      const prev2 = this.stretches[n - 2];
      if (!easy(prev.kind)) {
        // after white water, mostly a short breather; further down, more often more of it (but
        // three in a row only once you're well down)
        const more = !easy(prev2.kind) && d < 0.6 ? 0 : 1;
        // (a chute straight out of a rapid: a fast run-out)
        kind = pick(r, [['pool', 1.2 * (1 - d) + 0.2], ['run', 2.5], ['rapids', (0.4 + d * 1.6) * more], ['gorge', d * 0.9 * more * pr.gorges],
          ['chute', prev.kind === 'chute' ? 0 : 0.6 * more]]);
      } else {
        // never two breathers in a row
        kind = pick(r, [
          ['rapids', 3],
          ['chute', 1.6 + d * 0.4],
          ['cascade', (s > pr.cascades ? 1 + d : pr.cascades < Infinity ? 0.3 : 0) * pr.stairs],
          ['gorge', (0.6 + d * 1.5) * pr.gorges],
          ['falls', s > pr.falls ? 0.5 + d : 0],
        ]);
      }
      // what the river's known for, if it's not come up yet: now and then after a breather, and
      // for certain once the take-out's getting close
      const owed = pr.signature.find((k) => s > (k === 'falls' ? pr.falls : pr.cascades) && !this.stretches.some((x) => x.kind === k));
      if (owed && s > pr.length - 900) kind = owed;
      if (easy(kind)) {
        heat = 0.15 + d * 0.4;
        [lo, hi] = kind === 'pool' ? [40, 60] : [70 + (1 - d) * 40, 100 + (1 - d) * 50];
      } else {
        // every other bit of white water is a notch up; the one after lets you breathe a little
        const wave = whites % 2 === 0 ? 0.2 : -0.05;
        heat = Math.max(Math.min(0.3, pr.cap), Math.min(pr.cap, 0.3 + d * 0.6 + wave + (r() - 0.5) * 0.12));
        const lengths: Record<Kind, [number, number]> = {
          pool: [0, 0], run: [0, 0], rapids: [170 + heat * 120, 240 + heat * 200], cascade: [130, 200],
          gorge: [180, 300], falls: [80, 100], chute: [200 + heat * 80, 260 + heat * 140],
        };
        [lo, hi] = lengths[kind];
      }
    }
    // nothing runs on into the take-out: it's always the pool
    const next: Stretch = { kind, start: s, end: Math.min(this.finish - 60, s + Math.round(lo + r() * (hi - lo))), heat };
    if (kind === 'rapids' || kind === 'gorge' || kind === 'cascade') {
      next.name = this.names[this.stretches.filter((x) => x.name && x.kind !== 'chute').length % this.names.length];
      next.grade = Math.max(2, Math.min(5, 2 + Math.round((heat - 0.2) * 3.4 + (kind === 'cascade' ? 0.4 : 0))));
    }
    if (kind === 'chute') {
      const i = this.stretches.filter((x) => x.kind === 'chute').length;
      next.name = i === 0 ? 'The Flume' : this.chuteNames[(i - 1) % this.chuteNames.length];
      next.grade = Math.max(2, Math.min(4, 2 + Math.round(heat * 2.5)));
      next.slot = i > 0 && r() < 0.4;
    }
    // now and then a run or a rapid has a set piece in it too
    if ((kind === 'run' && n > 1 && r() < 0.4) || (kind === 'rapids' && n > 3 && r() < 0.3)) {
      next.pieceAt = next.start + 40 + r() * Math.max(0, next.end - next.start - 130);
    }
    if (kind === 'falls') next.grade = 4 + Math.round(d);
    if (next.grade) next.grade = Math.min(next.grade, pr.grade);

    // the ledges: a staircase down a cascade, a big one in the middle of a falls, and now and
    // then one in the rapids or the gorge
    const ledge = (at: number, height: number) => {
      const l: Ledge = { kind: 'ledge', s: Math.round(at), height, passed: false };
      this.ledges.push(l);
      this.lips.push(l);
      this.file(l);
    };
    if (!pr.ledges) {
      // (a gentle river has none: nothing to boof, nothing to fall off)
    } else if (kind === 'cascade') {
      let at = next.start + 22;
      for (let steps = 3 + Math.floor(r() * (2 + d * 2)); steps > 0 && at < next.end - 15; steps--) {
        ledge(at, 1.1 + r() * 0.8 + heat * 0.7);
        at += 13 + r() * 9;
      }
    } else if (kind === 'falls') {
      ledge(next.start + (next.end - next.start) * 0.5, 4 + r() * 1.5 + d);
    } else if (n === 3) {
      ledge(next.start + 70, 0.9); // the first one: small, to learn to boof
    } else if (((kind === 'rapids' || kind === 'gorge') && r() < 0.5 + heat * 0.3 || kind === 'run' && r() < 0.2) && n > 3) {
      ledge(next.start + 30 + r() * (next.end - next.start - 60), 1 + r() * 0.8);
    } else if (kind === 'chute' && heat > 0.3 && r() < 0.45) {
      // a ledge in a hot chute: a boof at full tilt
      ledge(next.start + 60 + r() * (next.end - next.start - 110), 0.9 + r() * 0.6);
    }

    // now and then the river parts round an island: in the forest runs and the rapids, and a
    // gravel bar in a pool
    const splitChance = n < 4 ? 0 : kind === 'run' ? 0.75 : kind === 'rapids' ? 0.6 : kind === 'pool' ? 0.6 : 0;
    let split: Split | null = null;
    if (r() < splitChance) {
      const bar = kind === 'pool';
      const len = bar ? 45 + r() * 20 : 90 + r() * 70;
      const s0 = next.start + (bar ? 12 : 30);
      const s1 = Math.min(next.end - 5, s0 + len);
      const clear = this.ledges.every((l) => l.s < s0 - 25 || l.s > s1 + 15);
      if (s1 - s0 > (bar ? 30 : 60) && clear) {
        split = {
          kind: bar ? 'bar' : 'isle', s0, s1, half: bar ? 1.8 + r() * 1.4 : 3.2 + r() * 3.2,
          u: (r() - 0.5) * 3, hero: r() < 0.5 ? -1 : 1,
        };
        this.splits.push(split);
        next.pieceAt = undefined; // (an island is enough going on)
      }
    }

    // things on the banks: a footbridge now and then, somebody's camp, a cabin by a pool
    if ((kind === 'run' || kind === 'pool') && !split && r() < 0.4) this.features.push({ kind: 'bridge', s: next.start + (next.end - next.start) * r(), side: 0 });
    if (kind === 'run' && r() < 0.3) this.features.push({ kind: 'tent', s: next.start + 30 + r() * 40, side: r() < 0.5 ? -1 : 1 });
    if (kind === 'pool' && r() < 0.5) this.features.push({ kind: 'cabin', s: next.start + 25 + r() * 30, side: r() < 0.5 ? -1 : 1 });
    // a rope swing over a pool, for a summer's afternoon
    if (kind === 'pool' && r() < 0.35) this.features.push({ kind: 'swing', s: next.start + 15 + r() * 25, side: r() < 0.5 ? -1 : 1 });
    this.stretches.push(next);
    return next;
  }

  // --- what's in it ---------------------------------------------------------------------

  /**
   * One row's worth round an island: in the hero channel a rock or two to weave between and the
   * balls along the line through them; in the sneak, now and then a rock, and a tree fallen in
   * from the outside bank.
   */
  private channels(s: number, p: Sample, split: Split, h: number) {
    const r = this.scatter;
    if (p.isle < 1) return;
    const half = p.width / 2;
    const rx = Math.cos(p.a);
    const rz = Math.sin(p.a);
    const across = (m: number) => ({ x: p.x + rx * m, z: p.z + rz * m });
    for (const side of [-1, 1] as const) {
      // the channel runs from the island's edge (in) to the bank (out), in metres across
      const inner = p.isleU + side * p.isle;
      const outer = side * half;
      const w = Math.abs(outer - inner);
      const at = (f: number) => inner + (outer - inner) * f; // 0 by the island … 1 by the bank
      if (side === split.hero) {
        const line = 0.25 + r() * 0.5;
        if (r() < 0.55 + h * 0.4) {
          // a rock one side of the line, sometimes both
          const f = line + (r() < 0.5 ? -1 : 1) * (1.5 + r() * 0.4) / w;
          if (f > 0.05 && f < 0.95) {
            const m = at(f);
            this.addObstacle({ kind: 'rock', ...across(m), r: 0.55 + r() * 0.45, s: s + (r() - 0.5) * 2, variant: Math.floor(r() * 5) });
          }
        }
        if (r() < 0.6) this.file({ kind: 'ball', ...across(at(line)), s, taken: false } satisfies Pickup);
      } else {
        if (r() < 0.12) {
          const m = at(r() < 0.5 ? 0.15 : 0.85);
          this.addObstacle({ kind: 'rock', ...across(m), r: 0.5 + r() * 0.3, s, variant: Math.floor(r() * 5) });
        } else if (split.kind === 'isle' && r() < 0.08 * this.profile.snags && w > 5) {
          const base = across(outer + side * 1.2);
          const tip = across(at(0.55));
          this.addObstacle({ kind: 'log', x0: base.x, z0: base.z, x1: tip.x, z1: tip.z, r: 0.38, s, variant: Math.floor(r() * 2) });
        }
      }
    }
  }

  /**
   * Rocks come in rows across the river, each row leaving a gap wide enough to get through, and
   * the gap never jumps further from the last one than you can steer in time. A gap between two
   * rocks is a tongue. Holes sit at the foot of every ledge, and here and there in the rapids.
   * Logs reach out from a bank. Tennis balls follow the lines between the rocks.
   */
  private place(to: number) {
    const r = this.scatter;
    let gap = this.gap;
    while (this.placedTo < to) {
      const s = this.placedTo;
      const p = this.at(s);
      const stretch = this.stretchAt(s);
      const h = p.heat;
      // a chute is set pieces all the way down, with a breather between each; a run or a rapid
      // might have one in it
      if (stretch.kind === 'chute' && s >= 120) {
        this.placedTo += this.breather(s, stretch);
        if (this.placedTo < stretch.end - 30) this.placedTo += this.piece(this.placedTo, stretch);
        continue;
      }
      if (stretch.pieceAt !== undefined && s >= stretch.pieceAt) {
        const at = stretch.pieceAt;
        stretch.pieceAt = undefined;
        this.lane = gap * p.width / 2;
        this.placedTo = at + this.piece(at, stretch) + 6;
        gap = this.lane / (p.width / 2);
        continue;
      }
      const white = stretch.kind === 'rapids' || stretch.kind === 'gorge';
      const density = BASE[stretch.kind].rocks * (0.55 + h * 1.6);
      // rows of rocks come closer together the hotter it gets: a couple of seconds apart in the
      // first rapid, not much less in the big stuff (in seconds, whatever the speed): fast water
      // with room to pick a line
      const spacing = Math.max(white ? Math.max(6, p.speed) * (2.1 - h * 0.5) : 7, Math.min(40, 1.4 / Math.max(density, 0.01) / 3.2));
      const step = spacing * (0.8 + r() * 0.4);
      this.placedTo += step;
      if (s < 120) continue; // a clear start
      // nothing near a lip, except the hole at its foot
      const lip = this.ledges.find((l) => s > l.s - 8 && s < l.s + 10);
      if (lip) continue;
      // round an island, each channel has its own water
      const split = this.splits.find((x) => s > x.s0 - 12 && s < x.s1 + 8);
      if (split) {
        this.channels(s, p, split, h);
        continue;
      }

      const half = p.width / 2;
      const rx = Math.cos(p.a);
      const rz = Math.sin(p.a);
      const across = (u: number) => ({ x: p.x + rx * u * half, z: p.z + rz * u * half });

      // now and then down a straight, a wave train where the rocks' gap would be: a V of smooth
      // water between two rocks, and the waves standing below it
      if ((white || stretch.kind === 'run') && s > this.lastTrain + 60 && r() < (stretch.kind === 'run' ? 0.18 : 0.32)) {
        const len = this.trainAt(s + 3, stretch, gap * half);
        if (len) {
          this.placedTo = s + 3 + len + 4;
          const t = this.lastTrainAt!;
          const flank = t.half + 0.55 + r() * 0.3;
          for (const side of [-1, 1]) {
            const u = t.u + side * (flank + 0.5);
            if (Math.abs(u) < half - 0.4) {
              const at = this.across(this.at(s))(u);
              this.addObstacle({ kind: 'rock', ...at, r: 0.55 + r() * 0.25, s, variant: Math.floor(r() * 5) });
            }
          }
          this.file({ kind: 'tongue', s, u: t.u, half: t.half * 0.7, taken: false } satisfies Tongue);
          continue;
        }
      }

      // the row's gap: somewhere new, but reachable
      const reach = Math.min(0.9, (step / Math.max(p.speed, 2)) * 2.6 / half);
      gap = Math.max(-0.7, Math.min(0.7, gap + (r() * 2 - 1) * reach * (0.3 + h * 0.5)));
      // half the gap, in units of half the river's width: a boat-length and more to start with,
      // not much more than the boat's width in the big stuff
      const gapHalf = Math.max(1.15, 2.6 - h * 1.45) / half;

      const perRow = stretch.kind === 'rapids' ? 1 + Math.floor(r() * (1.3 + h * 2))
        : stretch.kind === 'gorge' ? 1 + Math.floor(r() * (1.3 + h * 1.2))
          : stretch.kind === 'run' || stretch.kind === 'cascade' ? 1 + Math.floor(r() * (1.2 + h)) : 1;
      // (a wider river has room for more of them)
      const inRow = r() < density * spacing * 1.6 ? Math.max(1, Math.round(perRow * Math.min(1.5, half / 5.5))) : 0;
      let left = false;
      let right = false;
      for (let k = 0; k < inRow; k++) {
        let u = r() * 2 - 1;
        const rad = 0.55 + r() * (0.5 + p.rough * 0.5);
        // the whole rock clear of the gap, not just its middle: a big one could all but close it
        const clear = gapHalf + (rad * 0.9) / half;
        if (Math.abs(u - gap) < clear) u = gap + Math.sign(u - gap || 1) * (clear + r() * 0.35);
        if (Math.abs(u) > 1.05) continue;
        if (u < gap) left = true;
        else right = true;
        const at = across(u);
        this.addObstacle({ kind: 'rock', x: at.x, z: at.z, r: rad, s: s + (r() - 0.5) * 2, variant: Math.floor(r() * 5) });
      }
      // rocks on both sides of the gap make a tongue
      if (left && right) {
        const t: Tongue = { kind: 'tongue', s, u: gap * half, half: gapHalf * half * 0.8, taken: false };
        this.file(t);
      }

      // a hole in the white water, off the line: something to steer round, or punch
      if ((white && r() < (0.1 + h * 0.65) * this.profile.snags || stretch.kind === 'run' && r() < 0.12 * this.profile.snags) && inRow === 0) {
        const u = (gap + (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.3)) * half;
        this.file({ kind: 'hole', s: s + 3, u, half: 1.2 + r() * 1.2, strength: 0.4 + h * 0.5 });
      }

      // a fallen tree, reaching out from one bank but never past the gap
      if ((stretch.kind === 'run' || stretch.kind === 'gorge') && r() < (0.12 + h * 0.08) * this.profile.snags && inRow === 0) {
        const side = gap > 0 ? -1 : 1;
        const tipU = side < 0 ? Math.min(gap - gapHalf - 0.1, 0.1) : Math.max(gap + gapHalf + 0.1, -0.1);
        const base = across(side * 1.25);
        const tip = across(tipU);
        if (Math.hypot(tip.x - base.x, tip.z - base.z) < 1) continue;
        this.addObstacle({ kind: 'log', x0: base.x, z0: base.z, x1: tip.x, z1: tip.z, r: 0.38, s, variant: Math.floor(r() * 2) });
      }

      // a tennis ball along the good line
      if (r() < (stretch.kind === 'pool' ? 0.8 : 0.35)) {
        const through = across(gap);
        this.file({ kind: 'ball', x: through.x, z: through.z, s, taken: false } satisfies Pickup);
      }

      // slalom buoys on the easier water: a gate to thread
      if ((stretch.kind === 'pool' || stretch.kind === 'run') && inRow === 0 && r() < 0.25) {
        const g = gap * 0.6;
        const w = Math.min(0.5, 2.6 / half);
        this.file({ a: across(g - w), b: across(g + w), s, passed: false } satisfies Gate);
      }
    }
    // (the game lays the river a little at a time as you go: the next row carries on from here)
    this.gap = gap;
    // the hole at the foot of every ledge: all the way across, stronger the bigger the drop
    for (const l of this.ledges) {
      if ((l as Ledge & { holed?: boolean }).holed || l.s > to) continue;
      (l as Ledge & { holed?: boolean }).holed = true;
      const foot = this.at(l.s + LIP + 1.5);
      this.file({ kind: 'hole', s: foot.s, u: 0, half: foot.width / 2, strength: Math.min(1, 0.35 + l.height * 0.15) });
    }
  }
  /**
   * A wave train from s0, round `u` across, if the river's straight and clear enough for one there
   * (no lip, no island, no bend worth the name, and room before the stretch ends). Returns how
   * much river it takes (0: none). Bigger and leaning harder the hotter the water.
   */
  private trainAt(s0: number, stretch: Stretch, u: number, most = 8): number {
    const r = this.scatter;
    const h = stretch.heat;
    const p = this.at(s0);
    const length = 4.5 + p.speed * 0.3;
    const count = Math.min(most, 4 + Math.floor(r() * 3 + h * 2));
    const len = length * count;
    if (s0 + len > stretch.end - 10) return 0;
    while (this.length < s0 + len + 2) this.grow();
    if (this.ledges.some((l) => l.s > s0 - 12 && l.s < s0 + len + 12)) return 0;
    if (this.splits.some((x) => x.s1 > s0 - 15 && x.s0 < s0 + len + 15)) return 0;
    // (nor over where a run or a rapid has its own set piece coming)
    if (stretch.pieceAt !== undefined && stretch.pieceAt > s0 - 60 && stretch.pieceAt < s0 + len + 10) return 0;
    let narrow = p.width;
    for (let s = s0; s <= s0 + len; s += 2) {
      const q = this.at(s);
      if (Math.abs(q.bend) > 0.013) return 0; // (a straight: nothing that bends enough for an eddy on its inside)
      narrow = Math.min(narrow, q.width);
    }
    const half = Math.min(narrow / 2 - 1.6, 2.2 + h * 1.2 + r() * 0.6);
    if (half < 1.6) return 0;
    const room = narrow / 2 - half - 1;
    const t: Train = {
      kind: 'train', s: s0, u: Math.max(-room, Math.min(room, u)), half, length, count,
      amp: 0.2 + h * 0.65 + r() * 0.1, skew: 0.25 + h * 0.7, seed: r(),
    };
    this.file(t);
    this.trains.push(t);
    this.lastTrain = s0 + len;
    this.lastTrainAt = t;
    return len;
  }

  // --- set pieces ------------------------------------------------------------------------

  /** How long a beat of a set piece is (m) at arc length s: about a second and a half of water, less when it's hot. */
  private beat(s: number, h: number) {
    return (1.75 - h * 0.45) * (this.at(s).speed + 2.5); // (you'll be paddling too)
  }

  /**
   * Open water between set pieces in a chute: a beat or so to breathe, a ball on the line, and now
   * and then a slalom gate hung over it to thread.
   */
  private breather(s: number, stretch: Stretch) {
    const r = this.scatter;
    const h = stretch.heat;
    const len = this.beat(s, h) * (0.8 + (1 - h) * 0.7);
    while (this.length < s + len + 2) this.grow();
    const p = this.at(s + len * 0.5);
    this.lane = this.clampLane(this.lane * 0.6, p, 1.6);
    const at = this.across(p);
    if (this.lastPiece !== 'balls' && r() < 0.35 + h * 0.2) {
      this.file({ a: at(this.lane - 1.6), b: at(this.lane + 1.6), s: p.s, passed: false, hung: true } satisfies Gate);
    } else if (r() < 0.7) {
      this.file({ kind: 'ball', ...at(this.lane), s: p.s, taken: false } satisfies Pickup);
    }
    this.line.push({ s: p.s, u: this.lane, piece: 'rest' });
    return len;
  }

  private across(p: Sample) {
    return (u: number) => ({ x: p.x + Math.cos(p.a) * u, z: p.z + Math.sin(p.a) * u });
  }

  /** Keep a line far enough off the banks for a gap `gh` either side of it. */
  private clampLane(u: number, p: Sample, gh: number) {
    const room = Math.max(0, p.width / 2 - gh - 0.6);
    return Math.max(-room, Math.min(room, u));
  }

  /**
   * A set piece: something laid out on purpose, a beat at a time, so it reads from upstream and
   * rewards a line. Each beat is about a second and a half of water, and the line never moves
   * further across in one than a boat can ferry (FERRY), with a gap either side of it wider than
   * the boat. Returns how much river it took.
   *
   * - slalom: walls of boulders from alternate banks, the line weaving between their ends
   * - strainers: the same with fallen trees
   * - doors: rows right across the river with one gap in each (a tongue), never where the last was
   * - funnel: rows closing in to a slot between two big boulders
   * - weir: the posts of an old timber weir in staggered rows, to thread
   * - fork: a house-sized boulder in the middle: pick a side (the balls are down one of them)
   * - balls: an S of tennis balls to carve through, a rock or two on the outside of it
   */
  private piece(s0: number, stretch: Stretch): number {
    const r = this.scatter;
    const h = stretch.heat;
    const chute = stretch.kind === 'chute';
    const B = this.beat(s0, h);
    const T = 1.75 - h * 0.45;
    const shift = FERRY * T; // the furthest the line can move in a beat
    const gh = 2.2 - h * 0.7; // half the gap left round the line (roomy low down, as tight as ever at the top)
    const all: [Piece, number][] = chute
      ? [['slalom', 1], ['strainers', 0.8], ['doors', 1], ['funnel', 0.6], ['weir', 0.8], ['fork', 0.8], ['balls', 0.5 + (1 - h) * 0.6], ['waves', 0.9]]
      : stretch.kind === 'run' ? [['strainers', 1], ['weir', 1], ['fork', 0.8], ['balls', 0.8]] : [['doors', 1], ['fork', 1], ['funnel', 0.6]];
    // only the pieces this river has (and on a gentle one, that can be just the balls)
    const allowed = all.filter(([k]) => this.profile.pieces.includes(k));
    const options: [Piece, number][] = allowed.length ? allowed : [['balls', 1]];
    let kind = pick(r, options.map(([k, w]) => [k, k === this.lastPiece ? 0 : w] as [Piece, number]));
    this.lastPiece = kind;
    if (kind === 'waves') {
      // a wave train down the line (and if the chute bends too much here for one, the balls)
      const got = this.trainAt(s0 + 2, stretch, this.lane, 7);
      if (got) {
        const t = this.lastTrainAt!;
        this.lane = t.u;
        for (let k = 0; k < t.count; k++) this.line.push({ s: s0 + 2 + (k + 0.5) * t.length, u: t.u, piece: 'waves' });
        return got + 4;
      }
      kind = 'balls';
    }
    const beats = kind === 'fork' || kind === 'funnel' ? 3 : kind === 'balls' ? 6 + Math.floor(r() * 3) : 3 + Math.floor(r() * (1.5 + h * 2.5));
    const wide = kind === 'slalom' || kind === 'strainers' ? 1.3 - h * 0.3 : 1; // (see the slalom's walls)
    const len = B * (kind === 'weir' ? beats * 0.7 + 0.5 : kind === 'balls' ? beats * 0.55 + 0.8 : beats * wide + (kind === 'fork' ? 0.5 : 0));
    while (this.length < s0 + len + 20) this.grow();
    // nothing near a lip, and nothing past the end of the stretch
    const ok = (s: number) => s < stretch.end - 8 && !this.ledges.some((l) => s > l.s - 8 && s < l.s + 10);
    const rock = (p: Sample, u: number, rad: number, post = false) => {
      const at = this.across(p)(u);
      this.addObstacle({ kind: 'rock', ...at, r: rad, s: p.s + (post ? 0 : (r() - 0.5) * 1.2), variant: Math.floor(r() * (post ? 3 : 5)), post });
    };
    // boulders from the edge of a gap (at u, the wall running `dir`-wards) to the bank, with a slot
    // between each that a boat can only slip through dead straight (and never be pinned across)
    const wall = (p: Sample, edge: number, dir: number, first = 0.8 + r() * 0.25) => {
      const bank = p.width / 2 - 0.2;
      let rad = first;
      let u = edge + dir * rad * 0.9;
      while (u * dir < bank + 0.5) {
        rock(p, u, rad);
        const next = 0.75 + r() * 0.3;
        u += dir * (rad * 0.9 + next * 0.9 + 1.0 + r() * 0.25);
        rad = next;
      }
    };
    const ball = (p: Sample, u: number) => this.file({ kind: 'ball', ...this.across(p)(u), s: p.s, taken: false } satisfies Pickup);
    const mark = (p: Sample, u: number) => this.line.push({ s: p.s, u, piece: kind });

    switch (kind) {
      case 'slalom':
      case 'strainers': {
        // the line swings from one side to the other, each wall reaching past the middle to meet it
        const p0 = this.at(s0);
        const A = Math.max(0.6, Math.min(this.clampLane(99, p0, gh), shift * 0.5));
        let side = this.lane > 0 ? -1 : this.lane < 0 ? 1 : r() < 0.5 ? -1 : 1; // the bank this beat's wall comes from
        // the walls further apart than a beat, except in the very hardest water: time to swing round each
        const W = B * wide;
        for (let i = 0; i < beats; i++) {
          const at = s0 + W * (i + 0.5);
          if (!ok(at)) continue;
          const p = this.at(at);
          const L = this.clampLane(-side * A, p, gh);
          if (kind === 'slalom') wall(p, L + side * gh, side, 1.0 + r() * 0.3);
          else {
            const base = this.across(p)(side * (p.width / 2 + 1.2));
            const tip = this.across(p)(L + side * (gh + 0.38));
            this.addObstacle({ kind: 'log', x0: base.x, z0: base.z, x1: tip.x, z1: tip.z, r: 0.38, s: p.s, variant: Math.floor(r() * 2) });
          }
          if (i % 2 === 1 || kind === 'strainers') ball(p, L);
          mark(p, L);
          this.lane = L;
          side = -side;
        }
        break;
      }
      case 'doors':
      case 'funnel': {
        for (let i = 0; i < beats; i++) {
          const at = s0 + B * (i + 0.5);
          if (!ok(at)) continue;
          const p = this.at(at);
          let L: number;
          let g = gh;
          if (kind === 'doors') {
            // somewhere new every time, but reachable: at least half a beat's ferry away
            const room = this.clampLane(99, p, gh);
            const dir = Math.abs(this.lane) > room * 0.4 ? -Math.sign(this.lane) : r() < 0.5 ? -1 : 1;
            L = this.clampLane(this.lane + dir * shift * (0.5 + r() * 0.4), p, gh);
          } else {
            // closing in: wide, narrower, and a slot between two big boulders
            g = gh * [1.9, 1.4, 1.05][i];
            L = this.clampLane(this.lane + (r() - 0.5) * shift * 0.5, p, g);
          }
          const big = kind === 'funnel' && i === 2 ? 1.25 + r() * 0.2 : undefined;
          wall(p, L - g, -1, big);
          wall(p, L + g, 1, big);
          this.file({ kind: 'tongue', s: p.s, u: L, half: g * 0.8, taken: false } satisfies Tongue);
          if (i === beats - 1 || r() < 0.4) ball(p, L);
          mark(p, L);
          this.lane = L;
        }
        break;
      }
      case 'weir': {
        // posts in rows across the river, each row's gaps halfway between the last's
        const gap = 3.6 - h * 0.3; // (room enough between them even in the hardest water)
        const phase = r() * gap;
        for (let i = 0; i < beats; i++) {
          const at = s0 + B * (0.5 + i * 0.7);
          if (!ok(at)) continue;
          const p = this.at(at);
          const half = p.width / 2;
          const off = phase + (i % 2) * gap * 0.5;
          let best = this.lane;
          let bestD = Infinity;
          for (let u = -half - gap + (off % gap); u < half; u += gap) {
            if (Math.abs(u) < half - 0.25) rock(p, u, 0.28 + r() * 0.05, true);
            const mid = u + gap / 2; // a gap: the one nearest the line is the line
            if (Math.abs(mid) < half - 1 && Math.abs(mid - this.lane) < bestD) {
              bestD = Math.abs(mid - this.lane);
              best = mid;
            }
          }
          if (i % 2 === 0) ball(p, best);
          mark(p, best);
          this.lane = best;
        }
        break;
      }
      case 'fork': {
        const at = s0 + B * 1.5;
        if (!ok(at)) break;
        const p = this.at(at);
        const half = p.width / 2;
        const R = 1.9 + h * 0.5 + r() * 0.3;
        // room for a boat and some either side of it
        const room = Math.max(0, half - 0.55 - R * 0.9 - gh * 1.7);
        const u0 = Math.max(-room, Math.min(room, -this.lane * 0.3 + (r() - 0.5) * 0.8));
        rock(p, u0, R);
        // the balls go down the side you're already on, if you're on one
        const side = this.lane > u0 + 0.3 ? 1 : this.lane < u0 - 0.3 ? -1 : r() < 0.5 ? -1 : 1;
        const L = (u0 + side * R * 0.9 + side * (half - 0.55)) / 2;
        for (const f of [-0.35, 0, 0.35]) ball(this.at(at + f * B), L);
        mark(this.at(s0 + B * 0.5), (this.lane + L) / 2);
        mark(p, L);
        this.lane = L;
        break;
      }
      case 'balls': {
        // an S to carve: each ball no further across from the last than you can ferry in time
        const step = 0.55;
        const p0 = this.at(s0);
        const A = Math.min(this.clampLane(99, p0, 1.4), (FERRY * T * step * 0.85) / 0.8);
        const c = this.lane * 0.5;
        const phi = Math.asin(Math.max(-1, Math.min(1, (this.lane - c) / (A || 1))));
        for (let i = 0; i < beats; i++) {
          const at = s0 + B * (0.5 + i * step);
          if (!ok(at)) continue;
          const p = this.at(at);
          const L = this.clampLane(c + A * Math.sin(phi + i * 0.8), p, 1.4);
          ball(p, L);
          // on the outside of a curve, a rock, to keep you honest
          const out = Math.sign(L - c);
          if (Math.abs(Math.sin(phi + i * 0.8)) > 0.9 && Math.abs(L + out * 3) < p.width / 2 - 0.5) rock(p, L + out * (2.4 + r() * 0.3), 0.6 + r() * 0.3);
          mark(p, L);
          this.lane = L;
        }
        break;
      }
    }
    return len;
  }
}

function key(cx: number, cz: number) {
  return cx * 100003 + cz;
}

/**
 * A copy of `list` in a random order (Fisher–Yates). Not sort() with a random comparator: how often
 * that calls it differs from one JavaScript engine to the next, and so would the river after it.
 */
function shuffle<T>(list: readonly T[], r: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick<T>(r: () => number, options: [T, number][]): T {
  const total = options.reduce((t, [, w]) => t + Math.max(0, w), 0);
  let x = r() * total;
  for (const [v, w] of options) {
    x -= Math.max(0, w);
    if (x <= 0) return v;
  }
  return options[0][0];
}
