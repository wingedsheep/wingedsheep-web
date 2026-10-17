/**
 * Other lanterns. Take the lantern off the last twig and carry it, and after a while lights come
 * up far out on the flat, one at a time: other people walking back with lanterns of their own,
 * each a warm texel low over the water with its reflection under it. They never come nearer, and
 * they keep their places in the picture as you walk, since they're kilometres off. Hang yours back
 * and they go, one at a time, the way they came.
 *
 * They're drawn by the water shader (world.ts), as the moon's road is: each one a texel of light
 * a little way down from the horizon, a darker texel over it for whoever's carrying it, and a
 * short broken streak of its reflection under it.
 */
import * as THREE from 'three';

/** Across (a share of the picture's width, from the middle), how far below the horizon (texels), and how long it takes to walk its stretch and back (s). */
const WALKERS: [number, number, number][] = [
  [-0.41, 12, 340],
  [-0.27, 17, 410],
  [-0.12, 10, 290],
  [0.04, 14, 380],
  [0.15, 21, 450],
  [0.42, 11, 310],
  [-0.03, 26, 520],
];
/** On a narrow screen, only these (the picture's too narrow for all of them to have room). */
const NARROW = [0, 2, 4, 5];
/** Carrying it this long (s) before the first comes up, then one every so often. */
const FIRST = 7;
const EACH = 5;

/** Shared with every water: per light, across, down (view heights), how much it shows (0 … 1), and its flicker. */
export const OTHERS = {
  at: { value: WALKERS.map(() => new THREE.Vector4(0, 0, 0, 1)) },
};

/** For the waters, after uTexel, uAspect and the dither. `a` is down from the horizon (view heights), `x` across. */
export const OTHERS_GLSL = /* glsl */ `
  uniform vec4 uOthers[${WALKERS.length}];
  vec3 others(vec3 col, float a, float x, float r, float wind, float d) {
    for (int i = 0; i < ${WALKERS.length}; i++) {
      vec4 o = uOthers[i];
      if (o.z <= 0.0 || d > o.z) continue;
      float dx = abs(x - o.x) * uAspect / uTexel;
      if (dx > 1.5) continue;
      float dy = (a - o.y) / uTexel;
      if (dx <= 0.5) {
        // the lantern, a texel over the water, and whoever's carrying it over that
        if (dy > -2.0 && dy <= -1.0) return mix(col, vec3(1.0, 0.84, 0.52), o.w);
        if (dy > -3.0 && dy <= -2.0) return mix(col, vec3(0.09, 0.08, 0.13), 0.6);
        // its reflection: a short streak under it, broken by the water, shorter in a wind
        float len = 5.0 - wind * 2.5;
        if (dy > 0.0 && dy < len && r + (d - 0.5) * 0.9 > -0.2 + dy / len * 0.8) return mix(col, vec3(0.86, 0.6, 0.34), (1.0 - dy / (len + 1.0)) * o.w);
      } else if (dy > -2.0 && dy <= -1.0 && d < 0.6 * o.w) {
        // and either side of it, a dithered step of warmer water: no glow, just the next step up
        return col + vec3(0.2, 0.12, 0.03);
      }
    }
    return col;
  }
`;

export class Others {
  /** How long you've carried it (s), and how far each light's come up (0 … 1). */
  private held = 0;
  private shows = WALKERS.map(() => 0);
  private across = WALKERS.map((w) => w[0]);

  /** All the ones the picture has room for, up. */
  get up() {
    return OTHERS.at.value.filter((u) => u.z > 0.9).length >= 3;
  }

  /**
   * Each frame: whether your lantern's out on the flat (held or set down), how clear it is (fog
   * and rain hide them), and the picture.
   */
  update(dt: number, time: number, out: boolean, clear: number, night: number, aspect: number, texel: number) {
    this.held = out ? this.held + dt : Math.max(0, Math.min(this.held, FIRST + EACH * WALKERS.length) - dt * 2);
    const narrow = aspect < 0.8;
    WALKERS.forEach(([x0, down, period], i) => {
      const order = narrow ? NARROW.indexOf(i) : i;
      const want = order < 0 ? 0 : THREE.MathUtils.clamp((this.held - FIRST - order * EACH) / 3, 0, 1);
      this.shows[i] += (want - this.shows[i]) * Math.min(1, dt * 2);
      // walking, slowly, back and forth across a stretch of their own
      this.across[i] = x0 + Math.sin((time / period) * Math.PI * 2 + i * 1.9) * 0.025;
      const u = OTHERS.at.value[i];
      const fade = this.shows[i] * clear;
      // (a lantern carried flickers as the one carrying it walks: now and then a leg's in front of it)
      const step = Math.sin(time * (3.1 + i * 0.37) + i * 4.1);
      u.set(this.across[i], down * texel, fade < 0.04 ? 0 : fade, (0.9 + night * 0.1) * (step > 0.96 ? 0.55 : 1));
    });
  }

  /** Whether this point of the picture (height over the horizon, view heights; across, a share of the width) is on one of them, give or take. */
  at(a: number, across: number, aspect: number, texel: number) {
    return OTHERS.at.value.some((u) => u.z > 0.5 && Math.abs((across - u.x) * aspect) < texel * 4 && Math.abs(-a - u.y + texel * 1.5) < texel * 4);
  }
}
