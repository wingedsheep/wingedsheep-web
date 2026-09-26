/**
 * A rock's outline at the water, for everything that has to know where it is: the boat hitting it,
 * the water it moves (its eddy, its pillow) and the water drawn round it, the line through a rapid.
 * An ellipse, fitted to the model's own waterline (footprints.ts, written by `just models`), so a
 * long blade of slate lying with the current is long and narrow to steer past and leaves a narrow
 * eddy, and a round boulder is round. Without one (a post, a boulder of the land's) it's a circle.
 */

import type { Rock } from './course';
import { FOOTPRINTS } from './footprints';

/** An ellipse: its long half-axis a along the unit (ux, uz), its short half-axis b across that. */
export interface Outline {
  a: number;
  b: number;
  ux: number;
  uz: number;
}

/** How much of the rock you can hit: a shade inside what you see, as the round ones always were. */
export const HIT = 0.9;

/**
 * Where a model's outline falls, set down at the origin turned by `spin` (three's rotation.y) and
 * scaled so its radius is `r`: its middle (ox, oz, from the model's origin) and the ellipse.
 */
export function footprint(kind: string, r: number, spin: number): { ox: number; oz: number; outline: Outline } {
  const f = FOOTPRINTS[kind];
  if (!f) return { ox: 0, oz: 0, outline: { a: r, b: r, ux: 1, uz: 0 } };
  // (three turns (x, z) by θ to (x cos θ + z sin θ, -x sin θ + z cos θ): an angle β goes to β - θ)
  const c = Math.cos(spin);
  const s = Math.sin(spin);
  return {
    ox: (f.x * c + f.z * s) * r,
    oz: (-f.x * s + f.z * c) * r,
    outline: { a: f.a * r, b: f.b * r, ux: Math.cos(f.lie - spin), uz: Math.sin(f.lie - spin) },
  };
}

/** The spin that lays a model's long axis along the world angle `angle` (radians from +x towards +z). */
export function lying(kind: string, angle: number) {
  return (FOOTPRINTS[kind]?.lie ?? 0) - angle;
}

export function outlineOf(o: Rock): Outline {
  return o.outline ?? { a: o.r, b: o.r, ux: 1, uz: 0 };
}

/** How far a rock reaches from its middle along the unit (ex, ez), all of it (not just what you can hit). */
export function reach(o: Rock, ex: number, ez: number) {
  const e = outlineOf(o);
  const along = ex * e.ux + ez * e.uz;
  const across = -ex * e.uz + ez * e.ux;
  return Math.hypot(e.a * along, e.b * across);
}

const out = { d: 0, nx: 0, nz: 0 };

/**
 * How far (x, z) is outside a rock (m, negative inside it), and the way straight out from it there:
 * outside what you can hit, or with `scale` 1, outside all of it. Close to the rock it's near
 * enough exact; further off it's only roughly the distance, which is all anything wants there. The
 * result is reused: read it before asking again.
 */
export function gap(o: Rock, x: number, z: number, scale = HIT) {
  const e = outlineOf(o);
  const a = e.a * scale;
  const b = e.b * scale;
  const dx = x - o.x;
  const dz = z - o.z;
  const u = dx * e.ux + dz * e.uz;
  const v = -dx * e.uz + dz * e.ux;
  const k = Math.hypot(u / a, v / b);
  // (the gradient of k, over k: which way is out, and how fast k grows that way)
  const gu = u / (a * a);
  const gv = v / (b * b);
  const g = Math.hypot(gu, gv);
  if (g < 1e-9) {
    out.d = -Math.min(a, b);
    out.nx = 1;
    out.nz = 0;
    return out;
  }
  out.d = ((k - 1) * k) / g;
  out.nx = (gu * e.ux - gv * e.uz) / g;
  out.nz = (gu * e.uz + gv * e.ux) / g;
  return out;
}
