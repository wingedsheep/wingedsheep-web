/**
 * The river as the game makes it, and which bits of it a boat could be in: shared by the validator
 * (validate.ts) and the autopilot (autopilot.ts).
 */

import { Course, type Log, type Sample } from '../../src/island/river/course';
import type { RiverDef } from '../../src/island/river/rivers';

// the boat, as kayak.ts has it
export const HULL_R = 0.36; // its collision circles (a rock's only counts at 0.9 of its radius)
export const BANK = 0.55; // how close its middle gets to a bank or an island before it's shoved off
const HOLE_REACH = 0.3; // how far past a hole's side it still holds you
const HOLE_ALONG: [number, number] = [-0.6, 1.0];
/** The bridge's trestles (land.ts puts them in the water; the course doesn't know about them). */
const BRIDGE_SPAN = 20;

export const DS = 0.5; // metres between slices
export const DU = 0.025; // metres between the places across a slice
export const U_MAX = 30; // the widest a river gets, either side of the middle
export const CELLS = Math.round((2 * U_MAX) / DU) + 1;
export const cell = (u: number) => Math.round((u + U_MAX) / DU);
export const uOf = (j: number) => j * DU - U_MAX;

export function make(seed: number, river: RiverDef) {
  const start = calm(seed, 50, river);
  const finish = start + river.length;
  const course = new Course(seed, finish, river);
  course.extend(finish + 60);
  // the bridges' trestles, as land.ts stands them in the water
  for (const f of course.features) {
    if (f.kind !== 'bridge') continue;
    const p = course.at(f.s);
    for (const u of [-5, 5]) {
      const off = (u / BRIDGE_SPAN) * (p.width + 3);
      for (const dz of [-1, 1]) {
        course.addObstacle({
          kind: 'rock', x: p.x + Math.cos(p.a) * off - Math.sin(p.a) * dz, z: p.z + Math.sin(p.a) * off + Math.cos(p.a) * dz,
          r: 0.25, s: f.s, variant: 0,
        });
      }
    }
  }
  return { course, start, finish };
}

/** Where the game pushes off (game.ts's calm(), kept in step with it by hand). */
export function calm(seed: number, from: number, river: RiverDef) {
  const probe = new Course(seed, Infinity, river);
  for (let s = from; s < from + 3000; s += 5) {
    probe.extend(s + 60);
    const st = probe.stretchAt(s);
    const easy = st.kind === 'pool' || st.kind === 'run';
    const at = Math.max(s, st.start + 15);
    const clear = !probe.splits.some((x) => at > x.s0 - 45 && at < x.s1 + 10);
    if (easy && clear && st.end - at >= 50) return at;
  }
  return 50;
}

/** Spread what's reachable up to k cells either way, but not through anything in the way. */
export function dilate(reach: Uint8Array, free: Uint8Array, k: number) {
  const out = new Uint8Array(CELLS);
  let run = -1; // cells since the last reachable one, going right
  for (let j = 0; j < CELLS; j++) {
    if (!free[j]) run = -1;
    else if (reach[j]) run = 0;
    else if (run >= 0) run++;
    if (run >= 0 && run <= k) out[j] = 1;
  }
  run = -1;
  for (let j = CELLS - 1; j >= 0; j--) {
    if (!free[j]) run = -1;
    else if (reach[j]) run = 0;
    else if (run >= 0) run++;
    if (run >= 0 && run <= k) out[j] = 1;
  }
  return out;
}

/** Which places across the slice at arc length s the boat's middle could be without touching anything. */
export function clear(course: Course, s: number, holes: boolean, margin: number): Uint8Array {
  const p = sampleAt(course, s);
  const free = new Uint8Array(CELLS);
  const half = p.width / 2 - BANK;
  for (let j = cell(-half); j <= cell(half); j++) if (Math.abs(uOf(j)) <= half) free[j] = 1;
  const block = (u0: number, u1: number) => {
    for (let j = Math.max(0, Math.ceil((u0 + U_MAX) / DU)); j <= Math.min(CELLS - 1, Math.floor((u1 + U_MAX) / DU)); j++) free[j] = 0;
  };
  // an island (kayak.ts: its middle can't get within the island's half-width and a bit)
  const isle = course.at(s);
  if (isle.isle > 0) block(isle.isleU - isle.isle - BANK, isle.isleU + isle.isle + BANK);
  const cos = Math.cos(p.a);
  const sin = Math.sin(p.a);
  for (const t of course.near(s - 20, s + 20)) {
    if (!('kind' in t)) continue;
    if (t.kind === 'rock') {
      const R = t.r * 0.9 + HULL_R + margin;
      // the rock against this slice's line across the river
      const u0 = (t.x - p.x) * cos + (t.z - p.z) * sin;
      const d = (t.x - p.x) * sin - (t.z - p.z) * cos; // along the river (+ is downstream)
      if (Math.abs(d) < R) {
        const w = Math.sqrt(R * R - d * d);
        block(u0 - w, u0 + w);
      }
    } else if (t.kind === 'log') {
      blockLog(t, p, block, margin);
    } else if (t.kind === 'hole' && holes) {
      if (t.half >= course.at(t.s).width / 2 - 0.01) continue; // a ledge's: all the way across
      const along = s - t.s;
      if (along > HOLE_ALONG[0] && along < HOLE_ALONG[1]) block(t.u - t.half - HOLE_REACH, t.u + t.half + HOLE_REACH);
    }
  }
  return free;
}

/** A log against the slice's line: wherever along it the line comes within reach of it. */
function blockLog(o: Log, p: Sample, block: (u0: number, u1: number) => void, margin: number) {
  const R = o.r + HULL_R + margin;
  const cos = Math.cos(p.a);
  const sin = Math.sin(p.a);
  const lo = -p.width / 2 - 1;
  let from = NaN;
  for (let u = lo; u <= -lo + DU; u += DU) {
    const x = p.x + cos * u;
    const z = p.z + sin * u;
    const hit = segment(x, z, o) < R;
    if (hit && Number.isNaN(from)) from = u;
    if (!hit && !Number.isNaN(from)) block(from, u - DU), from = NaN;
  }
  if (!Number.isNaN(from)) block(from, -lo);
}

function segment(x: number, z: number, o: Log) {
  const dx = o.x1 - o.x0;
  const dz = o.z1 - o.z0;
  const t = Math.max(0, Math.min(1, ((x - o.x0) * dx + (z - o.z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - o.x0 - dx * t, z - o.z0 - dz * t);
}

/** The river at arc length s, between its samples. */
export function sampleAt(course: Course, s: number) {
  const a = course.at(Math.floor(s));
  const b = course.at(Math.floor(s) + 1);
  const f = s - Math.floor(s);
  const mix = (m: number, n: number) => m + (n - m) * f;
  return { x: mix(a.x, b.x), z: mix(a.z, b.z), a: mix(a.a, b.a), width: mix(a.width, b.width), speed: mix(a.speed, b.speed) } as Sample;
}

export function widest(row: Uint8Array) {
  let best = 0;
  let run = 0;
  for (let j = 0; j < CELLS; j++) {
    run = row[j] ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best * DU;
}
