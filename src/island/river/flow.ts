import { type Course, type Rock, type Sample, type Thing, channel } from './course';

/**
 * How the water moves: one model for the kayak to feel, the water to draw and the specks to
 * float on, so what you see is what pushes you about. It's what a paddler reads off the surface:
 *
 * - The fast water (the core) runs down the middle on a straight, and swings out towards the
 *   outside bank through a bend. By the banks it drags, slower.
 * - On the inside of a sharp bend the river leaves some water behind: an eddy, turning back
 *   upstream along the bank. A good place to stop, and a bad place to cross without edging.
 * - Behind every rock is an eddy too (water curling in and running back up to the rock), and on
 *   its upstream face a pillow of water piling up that shoves you off to one side.
 *
 * Where an eddy meets the main current is the eddy line: a sharp change in speed that spins a
 * boat whose bow and stern are in different water, and trips it if it isn't edged into the turn.
 */

/** The fast core is pushed this far out (as a fraction of the half-width) per unit of bend. */
export const CORE = 16;
/** A bend sharper than this (rad/m) leaves an eddy on its inside. */
export const EDDY_BEND = 0.011;
/** How fast an eddy runs back upstream, against the river's speed. */
export const BACKFLOW = 0.4;
/** How hard an eddy draws water (and boats) in across its line, against the river's speed. */
const DRAW = 0.35;

export interface Stream {
  /** The water's speed down the river here (m/s, negative upstream: an eddy). */
  along: number;
  /** 0..1: how far into an eddy (bend or island) this is. */
  eddy: number;
  /** 0..1: how near the fast core. */
  core: number;
  /** Sideways (m/s, + to river right): water drawn in across an eddy line. */
  lat: number;
}

/** Where the fast core runs across the river at sample p (-1 river left … 1 river right). */
export function coreAt(p: Sample) {
  return Math.max(-0.5, Math.min(0.5, -p.bend * CORE));
}

/** The river's own water at `side` metres across sample p (+ is river right): no rocks. */
export function stream(p: Sample, side: number, out: Stream = { along: 0, eddy: 0, core: 0, lat: 0 }): Stream {
  const half = p.width / 2;
  const u = Math.max(-1, Math.min(1, side / half));
  const c = coreAt(p);
  // across, measured from the core: 0 in it, ±1 at either bank
  const d = Math.min(1, Math.abs(u < c ? (u - c) / (1 + c) : (u - c) / (1 - c)));
  // a flat-topped profile: fast across most of it, dragging at the banks
  const shape = 1 - 0.62 * d ** 2.5;
  const ch = channel(p, side);
  let along = p.speed * ch.speed * shape;
  let eddy = 0;
  // slack water along an island's shore, and an eddy off its tail
  if (p.isle > 0) {
    const off = Math.abs(side - p.isleU) - p.isle;
    along *= 0.72 + 0.28 * Math.min(1, Math.max(0, off / 2));
  }
  // the inside of a sharp bend: water left behind, running back upstream along the bank
  const inside = Math.sign(p.bend);
  const bendy = Math.max(0, Math.min(1, (Math.abs(p.bend) - EDDY_BEND) * 45)) * (1 - p.drop);
  if (bendy > 0 && inside * u > 0) {
    const edge = smooth(0.5, 0.82, d) * bendy;
    eddy = Math.max(eddy, edge);
  }
  along = along * (1 - eddy) - p.speed * BACKFLOW * eddy;
  out.along = along;
  out.eddy = eddy;
  out.core = 1 - d;
  // along the eddy line the water's drawn in towards the bank
  out.lat = inside * p.speed * DRAW * eddy * (1 - eddy) * 4;
  return out;
}

/**
 * A rock's effect on the water at (x, z), with the river running along (fx, fz) at `v` m/s:
 * how deep in its eddy (0..1, behind it) and a push away from its upstream face (m/s).
 */
export function rockWater(o: Rock, x: number, z: number, fx: number, fz: number, v: number) {
  const dx = x - o.x;
  const dz = z - o.z;
  const along = dx * fx + dz * fz; // + downstream of it
  const across = dz * fx - dx * fz; // + to river right (for fx = sin a, fz = -cos a)
  let eddy = 0;
  let px = 0;
  let pz = 0;
  const len = eddyLength(o.r, v);
  if (along > -o.r * 0.2 && along < len) {
    // widest just behind the rock, closing to a point
    const t = Math.max(0, along) / len;
    const w = o.r * (1.6 - t * 0.9);
    const a = Math.abs(across);
    eddy = (1 - smooth(w * 0.6, w, a)) * (1 - t * t * t) * smooth(-o.r * 0.2, o.r * 0.3, along);
    // the eddy line draws water in towards the middle of it
    const draw = -Math.sign(across) * Math.abs(v) * DRAW * eddy * (1 - eddy) * 4;
    px += -fz * draw;
    pz += fx * draw;
  }
  // the pillow: water banking up on the upstream face and pouring off round the sides
  const dist = Math.hypot(dx, dz);
  const reach = o.r + 0.9;
  if (along < 0 && dist < reach && dist > 0.01) {
    const k = (1 - (dist - o.r) / 0.9) * Math.min(1, v / 4) * 1.6;
    px = (dx / dist) * k;
    pz = (dz / dist) * k;
  }
  return { eddy, px, pz };
}

export interface Water {
  /** The river's heading here, as a unit vector (x, z) downstream. */
  fx: number;
  fz: number;
  /** Speed down the river (m/s, negative: back upstream in an eddy). */
  along: number;
  /** 0..1: how deep in an eddy (a bend's, an island's or a rock's). */
  eddy: number;
  /** Pushed off a rock's upstream face (m/s, world x and z). */
  px: number;
  pz: number;
  sample: Sample;
  side: number;
}

/** All of it at (x, z): the river's own water and the rocks in `things` (searching near arc length `hint`). */
export function waterAt(course: Course, x: number, z: number, hint: number | undefined, things: readonly Thing[]): Water {
  const near = course.nearest(x, z, hint);
  const q = near.sample;
  const fx = Math.sin(q.a);
  const fz = -Math.cos(q.a);
  const st = stream(q, near.side, scratch);
  let rock = 0;
  let px = 0;
  let pz = 0;
  for (const t of things) {
    if (!('kind' in t) || t.kind !== 'rock' || t.scenery) continue;
    const w = rockWater(t, x, z, fx, fz, st.along);
    rock = Math.max(rock, w.eddy);
    px += w.px;
    pz += w.pz;
  }
  const along = st.along * (1 - rock) - q.speed * BACKFLOW * rock;
  px += -fz * st.lat;
  pz += fx * st.lat;
  return { fx, fz, along, eddy: Math.max(st.eddy, rock), px, pz, sample: q, side: near.side };
}

const scratch: Stream = { along: 0, eddy: 0, core: 0, lat: 0 };

/** How far downstream a rock's eddy reaches: further behind a big rock in fast water. */
export function eddyLength(r: number, v: number) {
  return r * (5 + Math.min(4, Math.abs(v) * 0.5));
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
