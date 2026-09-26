import * as THREE from 'three';
import type { Island } from './island';
import { visitDate } from './calendar';
import { visitorLocation } from './sun';

/**
 * The time of year where the visitor is (the seasons flip south of the equator). Everything is
 * worked out from a "leaf year" that starts on 1 March, so spring, summer, autumn and winter blend
 * into each other: late March still has bare twigs, late September is only starting to turn.
 *
 * To preview: ?season=spring|summer|autumn|winter, or ?date=2026-10-20 (or ?holiday=, calendar.ts).
 */

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

// day of the (northern) year each season is at its most itself, and what ?season= jumps to
const CENTRES: [SeasonName, number][] = [['winter', 15], ['spring', 106], ['summer', 197], ['autumn', 288]];
const PREVIEW: Record<SeasonName, number> = { spring: 110, summer: 195, autumn: 296, winter: 20 };

const smooth = THREE.MathUtils.smoothstep;
/** 0 before day a of the leaf year, 1 after day b, eased in between. */
export const ramp = (y: number, a: number, b: number) => smooth(y, a, b);

export interface Season {
  /** Day of the year, as if the visitor lived in the north (0 = 1 January). */
  day: number;
  /** Days since 1 March. */
  leafYear: number;
  name: SeasonName;
  /** How much of each season it is; they add up to 1. */
  weights: Record<SeasonName, number>;
  /** 0..1: the trees coming into leaf. */
  leafOut: number;
  /** 0..1: the light, new green of spring leaves. */
  fresh: number;
  /** 0..1: the cherry tree in flower (and shedding petals). */
  blossom: number;
  /** 0..1: leaves turning red and gold. */
  turn: number;
  /** 0..1: leaves fallen. */
  fall: number;
  /** 0..1: wild flowers in the grass. */
  flowers: number;
  /** 0..1: dandelion fluff and pollen drifting in the sun. */
  fluff: number;
}

function dayOfYear(d: Date) {
  return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 864e5;
}

/** Where a tree's leaves are on day y of the leaf year (a tree can run a few days ahead or behind). */
export function leavesAt(y: number) {
  return {
    leafOut: ramp(y, 20, 62), // late March … early May
    fresh: ramp(y, 20, 50) * (1 - ramp(y, 90, 125)),
    turn: ramp(y, 190, 240), // September … late October
    fall: ramp(y, 225, 275), // mid October … the end of November
  };
}

export function seasonFor(day: number): Season {
  const y = (day - 59 + 365) % 365; // 1 March = 0
  const weights = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  for (let i = 0; i < CENTRES.length; i++) {
    const [a, da] = CENTRES[i];
    const [b, db] = CENTRES[(i + 1) % CENTRES.length];
    const span = (db - da + 365) % 365;
    const f = (day - da + 365) % 365;
    if (f > span) continue;
    const t = smooth(f / span, 0.25, 0.75);
    weights[a] = 1 - t;
    weights[b] = t;
    break;
  }
  const name = (Object.keys(weights) as SeasonName[]).reduce((m, k) => (weights[k] > weights[m] ? k : m), 'winter');
  return {
    day,
    leafYear: y,
    name,
    weights,
    ...leavesAt(y),
    blossom: ramp(y, 22, 36) * (1 - ramp(y, 62, 78)), // most of April
    flowers: ramp(y, 15, 55) * (1 - ramp(y, 200, 255)),
    fluff: ramp(y, 75, 100) * (1 - ramp(y, 165, 195)),
  };
}

function today(): Season {
  let day = dayOfYear(visitDate());
  let flip = true;
  try {
    const s = new URLSearchParams(location.search).get('season') as SeasonName | null;
    if (s && s in PREVIEW) [day, flip] = [PREVIEW[s], false];
  } catch {}
  if (flip && visitorLocation().lat < 0) day = (day + 182) % 365;
  return seasonFor(day);
}

/** The season for this visit. */
export const season = today();

const HSL = { h: 0, s: 0, l: 0 };
const TMP = new THREE.Color();
const SUM = new THREE.Color();
const OLIVE = new THREE.Color('#9a8f45');
const FROST = new THREE.Color('#7f8d86');

/** Is this ground colour grass (rather than sand, dirt or rock)? */
export const isGrass = (c: THREE.Color) => c.g > c.r * 1.15 && c.g > c.b * 1.1;

/** Recolour a grass colour for the season: vivid in spring, golden-olive in autumn, muted in winter. */
export function tintGround(c: THREE.Color, s = season) {
  const { spring, summer, autumn, winter } = s.weights;
  c.getHSL(HSL);
  SUM.copy(c).multiplyScalar(summer);
  SUM.add(TMP.setHSL(HSL.h - 0.02, Math.min(1, HSL.s * 1.15), HSL.l * 1.12).multiplyScalar(spring));
  const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  SUM.add(TMP.copy(c).lerp(OLIVE.clone().multiplyScalar(l / 0.14), 0.5).multiplyScalar(autumn));
  SUM.add(TMP.copy(c).lerp(FROST.clone().multiplyScalar(l / 0.2), 0.55).multiplyScalar(winter));
  return c.copy(SUM);
}

// the flower heads (and last, the stems) that stay out longest as the year turns
const FLOWER_HOLD: [string, number][] = [
  ['#b6a4f0', 0.85], ['#e98aa8', 0.65], ['#f4efe6', 0.4], ['#f2d15a', 0.2], ['#f08c5a', 0.12], ['#3f7d43', 0.06],
];

/** The ground and the wild flowers take on the season (once, at load). */
export function dressIsland(island: Island, s = season) {
  const col = island.terrain.geometry.getAttribute('color') as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (let i = 0; i < col.count; i++) {
    c.fromBufferAttribute(col, i);
    if (isGrass(c)) {
      tintGround(c, s);
      col.setXYZ(i, c.r, c.g, c.b);
    }
  }
  col.needsUpdate = true;

  const flowers = island.root.getObjectByName('flowers');
  flowers?.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshToonMaterial;
    let best = FLOWER_HOLD[0];
    let dist = Infinity;
    for (const f of FLOWER_HOLD) {
      const d = TMP.set(f[0]).sub(mat.color).toArray().reduce((a, v) => a + v * v, 0);
      if (d < dist) [best, dist] = [f, d];
    }
    mesh.visible = s.flowers > best[1];
  });
}
