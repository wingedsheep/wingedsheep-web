/**
 * The river, made up as you go: a mountain river through thick forest, sampled every metre along
 * its centre line, with a width, a speed and a character that drift from one stretch to the next.
 * It really runs downhill: gently through the forest runs, steeply through the rapids, and in
 * steps down cascades of ledges and over the odd waterfall, with slow green pools in between.
 *
 * In the water: rocks in rows (always with a line through), logs reaching out from the banks,
 * ledges to boof, holes to punch, tongues of smooth fast water between the rocks, and tennis
 * balls. Everything comes from one seed, so the same seed is the same river.
 *
 * Coordinates are three's: x east, y up, z south. The river runs roughly north (-z), never
 * turning more than ~55° off it, so it never doubles back on itself.
 */

export type Kind = 'pool' | 'run' | 'rapids' | 'cascade' | 'gorge' | 'falls';

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
}

export interface Rock {
  kind: 'rock';
  x: number;
  z: number;
  r: number;
  s: number;
  variant: number;
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

/** A pair of slalom buoys: go between them. */
export interface Gate {
  a: { x: number; z: number };
  b: { x: number; z: number };
  s: number;
  passed: boolean;
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

export type Thing = Obstacle | Pickup | Gate | Ledge | Hole | Tongue;

export interface Stretch {
  kind: Kind;
  start: number;
  end: number;
  /** For white water: a name and a grade, for the banner. */
  name?: string;
  grade?: number;
}

const BASE: Record<Kind, Character> = {
  pool: { width: 19, speed: 2.4, rough: 0, rocks: 0.006, bend: 0.35, slope: 0, clear: 1, gorge: 0 },
  run: { width: 12, speed: 5.0, rough: 0.3, rocks: 0.045, bend: 0.8, slope: 0.015, clear: 0.3, gorge: 0 },
  rapids: { width: 9.5, speed: 6.8, rough: 0.9, rocks: 0.13, bend: 1, slope: 0.05, clear: 0, gorge: 0.15 },
  cascade: { width: 11, speed: 5.0, rough: 0.55, rocks: 0.03, bend: 0.3, slope: 0.01, clear: 0, gorge: 0.35 },
  gorge: { width: 8, speed: 6.4, rough: 0.65, rocks: 0.07, bend: 0.9, slope: 0.035, clear: 0, gorge: 1 },
  falls: { width: 12, speed: 4.6, rough: 0.3, rocks: 0.01, bend: 0.2, slope: 0.005, clear: 0.2, gorge: 0.5 },
};

/** White water gets a name; the river has seen a few paddlers before you. */
const RAPIDS = [
  'The Washing Machine', 'The Cheese Grater', 'Rock Garden', 'The Staircase', 'Pinball', 'Last Orders',
  'The Mangle', 'Sock Drawer', 'Big Wet', 'The Tumble Dryer', 'Second Thoughts', 'Hold My Coffee',
];

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
  readonly features: { kind: 'bridge' | 'tent' | 'cabin'; s: number; side: number }[] = [];
  private random: () => number;
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
  private placedTo = 0; // rocks and the rest are placed up to here
  private names: string[];
  /** The lips still to come, in order. */
  private lips: Ledge[] = [];

  constructor(readonly seed: number) {
    this.random = rng(seed);
    this.names = [...RAPIDS].sort(() => this.random() - 0.5);
    // a slow green pool to get the feel of it, then a forest run before the first white water
    this.stretches.push({ kind: 'pool', start: 0, end: 110 });
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

  /** The water's height at arc length s, interpolated (for the kayak riding over a lip). */
  heightAt(s: number) {
    const i = Math.max(0, Math.min(this.samples.length - 2, Math.floor(s / STEP)));
    const f = Math.max(0, Math.min(1, s / STEP - i));
    return this.samples[i].y * (1 - f) + this.samples[i + 1].y * f;
  }

  /** The stretch at arc length s. */
  stretchAt(s: number): Stretch {
    for (let i = this.stretches.length - 1; i >= 0; i--) if (this.stretches[i].start <= s) return this.stretches[i];
    return this.stretches[0];
  }

  /** Harder the further you get: 0 at the start, 1 by about 2.5 km. */
  difficulty(s: number) {
    return Math.min(1, s / 2500);
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
    // everything drifts towards the stretch it's in over ~20 m, so stretches blend into each other
    const k = 1 - Math.exp(-STEP / 20);
    const c = this.char;
    for (const key of Object.keys(c) as (keyof Character)[]) c[key] += (target[key] - c[key]) * k;

    // wind: noise sets the curvature, never tighter than the river can take, and a gentle pull
    // back towards north keeps it from wandering off sideways
    const tight = 1 / Math.max(22, c.width * 2.4);
    const curve = noise1(s / 38, this.seed) * 0.8 + noise1(s / 13, this.seed + 7) * 0.35 * c.bend;
    this.a += (curve * tight * (0.4 + c.bend) - this.a * 0.012) * STEP;
    this.a = Math.max(-MAX_TURN, Math.min(MAX_TURN, this.a));
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
    });
    const hk = key(Math.floor(this.x / CELL), Math.floor(this.z / CELL));
    (this.hash.get(hk) ?? this.hash.set(hk, []).get(hk)!).push(i);
  }

  private target(stretch: Stretch, s: number): Character {
    const d = this.difficulty(s);
    const t = { ...BASE[stretch.kind] };
    if (stretch.kind === 'rapids' || stretch.kind === 'gorge') {
      t.speed += d * 2.2 + (stretch.grade ?? 3) * 0.2;
      t.width -= d * 1.5;
      t.slope += d * 0.02;
    } else {
      t.speed += d * 0.8;
    }
    // every stretch widens and narrows a little on its own
    t.width *= 1 + noise1(s / 45, this.seed + 3) * 0.15;
    return t;
  }

  /**
   * What comes next: white water more often and harder the further you are, and after anything
   * hard, a breather. Cascades and waterfalls come once you've shown you can handle rapids.
   */
  private nextStretch(prev: Stretch): Stretch {
    const r = this.random;
    const s = prev.end;
    const d = this.difficulty(s);
    const hard = prev.kind !== 'pool' && prev.kind !== 'run';
    let kind: Kind;
    if (this.stretches.length === 1) kind = 'run';
    else if (this.stretches.length === 2) kind = 'rapids'; // the first white water: short and gentle
    // after white water, mostly a breather; further down, sometimes more of it straight away
    else if (hard) kind = pick(r, [['pool', 2], ['run', 2.5], ['rapids', d * 1.4], ['gorge', d * 0.8]]);
    else {
      kind = pick(r, [
        ['rapids', 2 + d * 2],
        ['cascade', s > 500 ? 1 + d : 0.3],
        ['gorge', 0.5 + d * 1.5],
        ['falls', s > 900 ? 0.5 + d : 0],
        ['run', prev.kind === 'run' ? 0.3 : 1],
        ['pool', prev.kind === 'pool' ? 0 : 0.5],
      ]);
    }
    const lengths: Record<Kind, [number, number]> = {
      pool: [50, 90], run: [110, 190], rapids: [190 + d * 120, 300 + d * 240], cascade: [130, 200],
      gorge: [180, 320], falls: [80, 100],
    };
    let [lo, hi] = lengths[kind];
    if (this.stretches.length === 1) [lo, hi] = [70, 90];
    if (this.stretches.length === 2) [lo, hi] = [160, 200];
    const next: Stretch = { kind, start: s, end: s + Math.round(lo + r() * (hi - lo)) };
    if (kind === 'rapids' || kind === 'gorge' || kind === 'cascade') {
      next.name = this.names[this.stretches.filter((x) => x.name).length % this.names.length];
      next.grade = Math.min(5, 2 + Math.round(d * 2.4 + r() * 1.2 + (kind === 'cascade' ? 0.5 : 0)));
    }
    if (kind === 'falls') next.grade = 4 + Math.round(d);

    // the ledges: a staircase down a cascade, a big one in the middle of a falls, and now and
    // then one in the rapids or the gorge
    const ledge = (at: number, height: number) => {
      const l: Ledge = { kind: 'ledge', s: Math.round(at), height, passed: false };
      this.ledges.push(l);
      this.lips.push(l);
      this.file(l);
    };
    if (kind === 'cascade') {
      let at = next.start + 22;
      for (let n = 3 + Math.floor(r() * (2 + d * 2)); n > 0 && at < next.end - 15; n--) {
        ledge(at, 1.1 + r() * 0.8 + d * 0.7);
        at += 13 + r() * 9;
      }
    } else if (kind === 'falls') {
      ledge(next.start + (next.end - next.start) * 0.5, 4 + r() * 1.5 + d);
    } else if (((kind === 'rapids' || kind === 'gorge') && r() < 0.5 + d * 0.3 || kind === 'run' && r() < 0.2) && this.stretches.length > 2) {
      ledge(next.start + 30 + r() * (next.end - next.start - 60), 1 + r() * 0.8);
    } else if (this.stretches.length === 2) {
      ledge(next.start + 55, 1.0); // the first one: small, to learn to boof
    }

    // things on the banks: a footbridge now and then, somebody's camp, a cabin by a pool
    if ((kind === 'run' || kind === 'pool') && r() < 0.4) this.features.push({ kind: 'bridge', s: next.start + (next.end - next.start) * r(), side: 0 });
    if (kind === 'run' && r() < 0.3) this.features.push({ kind: 'tent', s: next.start + 30 + r() * 40, side: r() < 0.5 ? -1 : 1 });
    if (kind === 'pool' && r() < 0.5) this.features.push({ kind: 'cabin', s: next.start + 25 + r() * 30, side: r() < 0.5 ? -1 : 1 });
    this.stretches.push(next);
    return next;
  }

  // --- what's in it ---------------------------------------------------------------------

  /**
   * Rocks come in rows across the river, each row leaving a gap wide enough to get through, and
   * the gap never jumps further from the last one than you can steer in time. A gap between two
   * rocks is a tongue. Holes sit at the foot of every ledge, and here and there in the rapids.
   * Logs reach out from a bank. Tennis balls follow the lines between the rocks.
   */
  private place(to: number) {
    const r = this.random;
    let gap = 0; // where the last gap was, across the river (-1..1)
    while (this.placedTo < to) {
      const s = this.placedTo;
      const p = this.at(s);
      const stretch = this.stretchAt(s);
      const d = this.difficulty(s);
      const density = BASE[stretch.kind].rocks * (1 + d * 1.2);
      const spacing = Math.max(7, Math.min(40, 1.4 / Math.max(density, 0.01) / 3.2));
      const step = spacing * (0.8 + r() * 0.4);
      this.placedTo += step;
      if (s < 120) continue; // a clear start
      // nothing near a lip, except the hole at its foot
      const lip = this.ledges.find((l) => s > l.s - 8 && s < l.s + 10);
      if (lip) continue;

      const half = p.width / 2;
      const rx = Math.cos(p.a);
      const rz = Math.sin(p.a);
      const across = (u: number) => ({ x: p.x + rx * u * half, z: p.z + rz * u * half });

      // the row's gap: somewhere new, but reachable
      const reach = Math.min(0.9, (step / Math.max(p.speed, 2)) * 2.6 / half);
      gap = Math.max(-0.7, Math.min(0.7, gap + (r() * 2 - 1) * reach * 0.7));
      // half the gap, in units of half the river's width: a few metres, a bit less the further you get
      const gapHalf = Math.max(1.15, 1.9 - d * 0.75) / half;

      const perRow = stretch.kind === 'rapids' ? 2 + Math.floor(r() * (2 + d * 2))
        : stretch.kind === 'gorge' ? 1 + Math.floor(r() * (2 + d))
          : stretch.kind === 'run' || stretch.kind === 'cascade' ? 1 + Math.floor(r() * 1.6) : 1;
      const inRow = r() < density * spacing * 1.6 ? perRow : 0;
      let left = false;
      let right = false;
      for (let k = 0; k < inRow; k++) {
        let u = r() * 2 - 1;
        if (Math.abs(u - gap) < gapHalf) u = gap + Math.sign(u - gap || 1) * (gapHalf + r() * 0.35);
        if (Math.abs(u) > 1.05) continue;
        if (u < gap) left = true;
        else right = true;
        const rad = 0.55 + r() * (0.5 + p.rough * 0.5);
        const at = across(u);
        this.addObstacle({ kind: 'rock', x: at.x, z: at.z, r: rad, s: s + (r() - 0.5) * 2, variant: Math.floor(r() * 5) });
      }
      // rocks on both sides of the gap make a tongue
      if (left && right) {
        const t: Tongue = { kind: 'tongue', s, u: gap * half, half: gapHalf * half * 0.8, taken: false };
        this.file(t);
      }

      // a hole in the white water, off the line: something to steer round, or punch
      if (((stretch.kind === 'rapids' || stretch.kind === 'gorge') && r() < 0.45 + d * 0.35 || stretch.kind === 'run' && r() < 0.12) && inRow === 0) {
        const u = (gap + (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.3)) * half;
        this.file({ kind: 'hole', s: s + 3, u, half: 1.2 + r() * 1.2, strength: 0.5 + d * 0.4 });
      }

      // a fallen tree, reaching out from one bank but never past the gap
      if ((stretch.kind === 'run' || stretch.kind === 'gorge') && r() < 0.12 + d * 0.08 && inRow === 0) {
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
    // the hole at the foot of every ledge: all the way across, stronger the bigger the drop
    for (const l of this.ledges) {
      if ((l as Ledge & { holed?: boolean }).holed || l.s > to) continue;
      (l as Ledge & { holed?: boolean }).holed = true;
      const foot = this.at(l.s + LIP + 1.5);
      this.file({ kind: 'hole', s: foot.s, u: 0, half: foot.width / 2, strength: Math.min(1, 0.35 + l.height * 0.15) });
    }
  }
}

function key(cx: number, cz: number) {
  return cx * 100003 + cz;
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
