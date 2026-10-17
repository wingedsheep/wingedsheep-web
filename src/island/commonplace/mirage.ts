/**
 * An island twenty kilometres east, under the horizon, and what the air over the cold water does
 * with it. Most evenings only the top of its lighthouse shows. Now and then a warmer layer of air
 * settles over the water, the light from the island bends down along it, and the whole island
 * comes up into the sky: an upright copy lifted over an upside-down one, quivering. A fata
 * morgana.
 *
 * It isn't drawn, it's worked out: every row of the sky near the horizon is traced back from your
 * eye through the layered air, over the curve of the Earth, to the island, and the sky shader
 * (world.ts, skyAt) paints whatever that row's light left from: the island, its lamp, the sea, or
 * nothing. The layer's height and strength drift over minutes, so the shape does too.
 */
import * as THREE from 'three';

const EARTH = 6371000;
/** How far off the island is (m), and the height of its lighthouse, with its lamp (m). */
const FAR = 20000;
const TOWER = 40;
const LAMP: [number, number] = [34, 38.5];
/** The rows traced: from this far below the level to this far above it (degrees), so many. */
const LOW = -0.06;
const HIGH = 0.17;
const ROWS = 96;
/**
 * View heights to a degree of sky. The eye's own would be a few times smaller: the island's whole
 * height is a few minutes of arc, and people who see one usually see it through binoculars.
 */
const SCALE = 0.3;
/** How much air's refractive index falls for each degree warmer, near enough, at sea level. */
const DN_DT = -1.04e-6;
/** An ordinary evening's bending, as a share of the Earth's curve. */
const STANDARD = 0.13;
const STEP = 100;

/** Where the island sits (a share of the picture's width, from the middle) and how wide it is (view heights). */
export const MIRAGE_X = 0.3;
export const MIRAGE_W = 0.17;
const TOWER_AT = 0.68;

/** Shared by the sky and every water that mirrors it. */
export const MIRAGE = {
  rows: { value: new Float32Array(ROWS).fill(-1) },
  /** The picture's aspect (stretched on a narrow screen, so the island is narrower there), the first row's height above the horizon (view heights), the step between rows, and how far it's lifted (0 … 1). */
  at: { value: new THREE.Vector4(1, 0, 0.001, 0) },
};

/** For SKY_GLSL: needs uTexel, and `d`, the dither, from the caller. */
export const MIRAGE_GLSL = /* glsl */ `
  uniform float uMir[${ROWS}];
  uniform vec4 uMirage;
  // the island's skyline (m), west (0) to east (1): low dunes, highest in the middle
  float skyline(float u) {
    float e = smoothstep(0.0, 0.14, u) * smoothstep(1.0, 0.82, u);
    return e * (8.0 + 3.5 * sin(u * 17.0 + 0.6) + 2.0 * sin(u * 41.0 + 2.0)) - (1.0 - e);
  }
  vec3 mirage(vec3 col, float a, float x, float d) {
    float xv = (x - ${MIRAGE_X.toFixed(3)}) * uMirage.x; // across from its middle, in view heights
    float u = xv / ${MIRAGE_W.toFixed(3)} + 0.5;
    if (u < -0.9 || u > 1.9) return col;
    float i = floor((a - uMirage.y) / uMirage.z + 0.5);
    if (i < 0.0 || i > ${ROWS - 1}.0) return col;
    float y = uMir[int(i)];
    if (y < 0.0) {
      // this row's light came off the sea: when the layer's in, the far water's lifted with the
      // island, a pale band that thins out either side of it
      float edge = 1.0 - smoothstep(0.0, 0.25, max(-u, u - 1.0));
      return a > 0.004 && d < edge * min(1.0, uMirage.w * 3.0) ? vec3(0.36, 0.34, 0.5) : col;
    }
    if (u < 0.0 || u > 1.0) return col;
    float tower = step(abs(xv - ${((TOWER_AT - 0.5) * MIRAGE_W).toFixed(4)}), uTexel);
    if (y >= max(skyline(u), tower * ${TOWER.toFixed(1)})) return col;
    if (tower > 0.5 && y > ${LAMP[0].toFixed(1)} && y < ${LAMP[1].toFixed(1)}) return vec3(0.98, 0.72, 0.46);
    return vec3(0.17, 0.165, 0.3);
  }
`;

const cycle = (t: number, period: number) => Math.sin((t / period) * Math.PI * 2);

export class Mirage {
  /** How far the layer's in: 0, just the lighthouse's top … 1, the whole island lifted and doubled. */
  lift = 0;
  /** The rows' heights above the horizon (view heights) where the island shows, for picking it out. */
  private span: [number, number] = [0, 0];

  /**
   * The layer coming and going (on a still, clear evening only: a wind mixes it away), and every
   * row traced again from an eye this high above the water (m).
   */
  update(time: number, dt: number, calm: number, eye: number, aspect: number) {
    // (in a little under half the time and well up a fifth of it, starting down: now and then)
    const want = THREE.MathUtils.clamp(-0.4 - 1.2 * Math.cos((time / 300) * Math.PI * 2) + 0.2 * cycle(time, 97), 0, 1) * calm;
    this.lift += (want - this.lift) * (1 - Math.exp(-dt / 8));
    // the warm layer: how high, how sharp its bottom edge, and how much warmer than the water
    const height = 12.5 + 1.2 * cycle(time, 170);
    const width = 2.5;
    const warmer = 3.6 * this.lift;
    const bend = (y: number) => {
      const s = 1 / (1 + Math.exp(-(y - height) / width));
      return DN_DT * (warmer / width) * s * (1 - s) - STANDARD / EARTH;
    };
    // the sea's edge, from up here, is where the level is
    const dip = Math.sqrt((2 * eye * (1 - STANDARD)) / EARTH) * (180 / Math.PI);
    const rows = MIRAGE.rows.value;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < ROWS; i++) {
      const deg = LOW + ((HIGH - LOW) * i) / (ROWS - 1);
      let y = eye;
      let slope = (deg * Math.PI) / 180;
      for (let x = 0; x < FAR && y >= 0; x += STEP) {
        slope += (1 / EARTH + bend(y)) * STEP;
        y += slope * STEP;
      }
      // (and the layer never quite still: each row quivers on its own)
      if (y >= 0) y = Math.max(0, y + this.lift * (0.5 * Math.sin(i * 1.9 + time * 1.7) + 0.3 * Math.sin(i * 0.53 - time * 0.9)));
      rows[i] = y < 0 ? -1 : y;
      if (y >= 0 && y < TOWER) (lo = Math.min(lo, i)), (hi = Math.max(hi, i));
    }
    const step = ((HIGH - LOW) / (ROWS - 1)) * SCALE;
    // (narrow screens get it narrower, so it doesn't fill the side of the picture)
    MIRAGE.at.value.set(aspect / Math.min(1, aspect / 0.9), (LOW + dip) * SCALE, step, this.lift);
    this.span = lo <= hi ? [(LOW + dip) * SCALE + (lo - 1) * step, (LOW + dip) * SCALE + (hi + 1) * step] : [0, 0];
  }

  /** Whether this point of the sky (height above the horizon in view heights, and across as a share of the width) is on the island, give or take a little. */
  at(a: number, across: number) {
    const u = ((across - MIRAGE_X) * MIRAGE.at.value.x) / MIRAGE_W + 0.5;
    return u > -0.08 && u < 1.08 && a > Math.max(0.002, this.span[0] - 0.006) && a < this.span[1] + 0.008;
  }
}
