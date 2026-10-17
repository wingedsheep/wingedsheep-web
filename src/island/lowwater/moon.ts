/**
 * The moon: the real one, when it's really up where you are, as lit as it really is tonight. The
 * flat keeps its own hour and faces north, so it can't be where the moon really is; it rises on
 * the right (east), crosses, and sets on the left, low when it's low and higher when it's high
 * (squeezed, so it stays in the picture). Its lit side faces the way the sun is.
 *
 * Its light on the water is a road: a column of glints under it that comes down the water to
 * wherever you are, and walks with you, since the moon's too far off for walking to change where
 * it is (the sky's fixed to the view here, as the stars are).
 */
import * as THREE from 'three';

/** Its radius, in texels (sky things keep their size as you zoom, as the stars do). */
const RADIUS = 5.5;

/** Shared by the sky, the stars and every water. */
export const MOON = {
  /** Across (a share of the picture's width, from the middle), how high (view heights over the horizon), its radius (view heights), and how much it shows (0 … 1). */
  at: { value: new THREE.Vector4(0, 0.1, 0.02, 0) },
  /** How much of it is lit (0 … 1), which side (1 the right, -1 the left), and the picture's aspect. */
  lit: { value: new THREE.Vector3(0.5, 1, 1) },
  /** Where you are in the picture: across (a share of the width) and down from the horizon (view heights), which is where its road comes to. */
  you: { value: new THREE.Vector2(0, 0.3) },
};

/**
 * For the sky and the waters, after uTexel and the dither: the disc (`moonSky`) and its road on
 * the water (`moonRoad`). Picture coordinates as skyAt has them: `a` up from the horizon (or, on
 * the water, down from it) in view heights, `x` across as a share of the width.
 */
export const MOON_GLSL = /* glsl */ `
  uniform vec4 uMoon;
  uniform vec3 uMoonLit;
  uniform vec2 uMoonYou;
  // the seas, as dark patches on the disc (the flat faces north, so the face is the other way up)
  float maria(vec2 q) {
    float m = 0.0;
    m += step(length((q - vec2(0.32, -0.38)) / vec2(0.36, 0.3)), 1.0);  // Imbrium
    m += step(length((q - vec2(-0.2, -0.3)) / vec2(0.24, 0.22)), 1.0);  // Serenitatis
    m += step(length((q - vec2(-0.3, 0.05)) / vec2(0.28, 0.2)), 1.0);   // Tranquillitatis
    m += step(length((q - vec2(0.55, 0.05)) / vec2(0.2, 0.42)), 1.0);   // Procellarum
    m += step(length((q - vec2(-0.7, -0.15)) / vec2(0.13, 0.12)), 1.0); // Crisium
    return min(m, 1.0);
  }
  vec3 moonSky(vec3 col, float a, float x, float d) {
    if (uMoon.w <= 0.0) return col;
    vec2 off = vec2((x - uMoon.x) * uMoonLit.z, a - uMoon.y);
    vec2 q = off / uMoon.z;
    float r2 = dot(q, q);
    // a faint ring of brighter sky round it, dithered: no glow, just the next step up
    if (r2 > 1.0) {
      float near = 1.0 - smoothstep(1.0, 2.6, sqrt(r2));
      return d < near * 0.6 * uMoon.w ? col + vec3(0.03, 0.034, 0.05) : col;
    }
    // lit where the terminator says: an ellipse across it, by how much is lit
    float t = 1.0 - 2.0 * uMoonLit.x;
    float lit = step(t * sqrt(max(0.0, 1.0 - q.y * q.y)), q.x * uMoonLit.y);
    vec3 bright = mix(vec3(0.95, 0.93, 0.84), vec3(0.74, 0.74, 0.74), maria(q) * 0.8);
    // (the limb a step down, so it's round rather than a blot)
    bright *= r2 > 0.72 ? 0.9 : 1.0;
    // the dark part hides the stars behind it, and holds a little earthshine when it's thin
    vec3 dark = col * 0.7 + vec3(0.02, 0.025, 0.05) * step(uMoonLit.x, 0.4);
    return mix(col, mix(dark, bright, lit), uMoon.w);
  }
  // its road on the water: glints from under it on the horizon down to your feet, broadest in
  // between, more broken in a wind; r is the water's own ripple there (-1 … 1), so the road moves
  // as the water does
  vec3 moonRoad(vec3 col, float a, float x, float r, float wind, float d) {
    if (uMoon.w <= 0.0 || a < 0.0) return col;
    float t = a / max(uMoonYou.y, 0.02);
    if (t > 1.04) return col;
    float dx = abs(x - mix(uMoon.x, uMoonYou.x, t)) * uMoonLit.z;
    // where the moon itself would be in a still mirror (the water shows the sky at 0.8 of the depth)
    float under = uMoon.y / 0.8;
    float half_ = (uMoon.z * (0.7 + wind * 0.8) + a * (0.12 + wind * 0.2)) * (1.0 - 0.8 * smoothstep(0.5, 1.0, t));
    if (dx > half_) return col;
    float k = dx / half_;
    // bright under the moon, thinning out towards you and to the sides
    float along = 1.0 - smoothstep(under * 0.6, under * 2.6 + 0.12, a);
    float pull = 0.4 + 0.6 * uMoonLit.x;
    float glint = r + 0.35 * (d - 0.5) - 0.55 * k * k + 0.45 * along * pull - 0.25 * wind;
    // in a still mirror, round the moon's own image, the light all but unbroken
    float still = (1.0 - wind) * (1.0 - smoothstep(uMoon.z * 0.5, uMoon.z * 1.2, abs(a - under))) * step(dx, uMoon.z * 0.7);
    glint += still * 0.45;
    float show = uMoon.w;
    // near you the water looks down at itself more than at the sky, so it gives back less of
    // the moon: the bright glints thin out over the last half of the way, dithered
    float near = smoothstep(0.35, 0.9, t);
    if (glint > 1.22 - 0.3 * show && d > near) return mix(col, vec3(0.92, 0.9, 0.8), show);
    if (glint > 0.78 - 0.2 * show) return mix(col, vec3(0.5, 0.54, 0.74), show);
    return col;
  }
`;

/** Where the island's sky has the moon, as `moonPosition` gives it, and whether it's growing. */
export interface MoonNow {
  /** Degrees over the visitor's horizon. */
  alt: number;
  /** Radians from south, towards the west. */
  az: number;
  /** How much of it's lit, 0 … 1. */
  lit: number;
  waxing: boolean;
  /** Days since it was new. */
  age: number;
}

export class Moon {
  /** How much it shows: 0 set, or behind weather … 1. */
  show = 0;
  /** As it was last given. */
  now: MoonNow | null = null;

  /** Place it for the moon as it is, how clear the sky is (0 … 1), and the picture's aspect. */
  update(dt: number, moon: MoonNow | undefined, clear: number, night: number, aspect: number, texel: number, you: THREE.Vector2) {
    MOON.you.value.copy(you);
    this.now = moon ?? null;
    // (too thin a sliver to draw, or set, or only just over the haze: not there)
    const up = moon && moon.lit > 0.06 ? THREE.MathUtils.smoothstep(moon.alt, 1, 4) : 0;
    const want = up * clear * (0.85 + night * 0.15);
    this.show += (want - this.show) * (1 - Math.exp(-dt / 1.5));
    if (!moon) return void (MOON.at.value.w = 0);
    // east on the right, west on the left; low when it's low, and higher the higher it is, but
    // never up out of the picture, so it's always there to find
    const across = THREE.MathUtils.clamp((-moon.az / Math.PI) * 0.8, -0.44, 0.44);
    // (and on a phone, under the buttons at the top)
    const top = aspect < 0.8 ? 0.13 : 0.17;
    const high = 0.065 + (top - 0.065) * (1 - Math.exp(-moon.alt / 20));
    MOON.at.value.set(across, high, RADIUS * texel, this.show < 0.05 ? 0 : this.show);
    // lit on the side the sun's on: growing, it's east of the sun (the sun's to its left, facing north)
    MOON.lit.value.set(moon.lit, moon.waxing ? -1 : 1, aspect);
  }

  /** Whether this point of the sky (height over the horizon, view heights; across, a share of the width) is on it, give or take. */
  at(a: number, across: number) {
    const m = MOON.at.value;
    if (m.w < 0.3) return false;
    return Math.hypot((across - m.x) * MOON.lit.value.z, a - m.y) < m.z * 2.2;
  }
}
