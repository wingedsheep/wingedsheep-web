/**
 * The geul: the channel the flat drains through, east of the way out. It starts as a rill
 * between the ring and the table and winds north, wider and deeper, to the deep water past the
 * seal's bank. It runs with the flat's tide: out to the deep while the water's falling, in while
 * it's rising, and stands still at the turns. Its water is darker than the flat's, and its
 * ripples break the sky's mirror where the current is. You can wade it; it slows you, and
 * the current takes your prints before they're made.
 */
import * as THREE from 'three';

/** Where it starts (z), and where it meets the deep (the flat's own edge). */
const HEAD = -50;
const MOUTH = -114.5;
/** How fast it runs at its fastest (m/s), and how deep it is at the mouth (m). */
const RUN = 0.45;
const DEPTH = 0.5;

/** Shared by every water: how far the current has carried the ripples (m), and how hard it's running (-1 in … 1 out). */
export const GEUL = {
  flow: { value: 0 },
  current: { value: 0 },
};

/** How far down it is (0 its head … 1 the deep). */
function along(z: number) {
  return THREE.MathUtils.clamp((HEAD - z) / (HEAD - MOUTH), 0, 1);
}

/** Its middle, across (x), at a point along it. */
export function geulX(z: number) {
  const t = along(z);
  return 23 + 6.5 * t + 2.4 * Math.sin(z * 0.09 + 1.1) * (0.4 + 0.6 * t) + 0.9 * Math.sin(z * 0.23 + 0.3);
}

/** Its half width there (m). */
function geulW(z: number) {
  return z > HEAD ? 0 : 0.18 + 2.1 * along(z) ** 0.7;
}

/** How deep its water is at a point (m; 0 off it). */
export function geulDepth(x: number, z: number) {
  const w = geulW(z);
  if (!w) return 0;
  const n = (x - geulX(z)) / w;
  return n * n < 1 ? (1 - n * n) * (0.08 + (DEPTH - 0.08) * along(z)) : 0;
}

/** The nearest point of its banks to a point, and how far that is (0 in it). */
export function geulNear(x: number, z: number) {
  const zz = THREE.MathUtils.clamp(z, MOUTH - 2, HEAD);
  const mid = geulX(zz);
  const w = geulW(zz);
  const side = x < mid ? -1 : 1;
  const edge = new THREE.Vector2(mid + side * w, zz);
  const off = Math.abs(x - mid) - w;
  return { edge, mid: new THREE.Vector2(mid, zz), d: Math.max(0, Math.hypot(Math.max(0, off), z - zz)) };
}

/** Moves its current on with the tide (`going`, the tide's rise, -1 falling … 1 rising). */
export function runGeul(dt: number, going: number) {
  // (falling, it runs out to the deep, north; rising, in)
  GEUL.current.value = -going;
  GEUL.flow.value += -going * RUN * dt;
}

/** What it's doing, for its card. */
export function geulSaid(going: number) {
  if (Math.abs(going) < 0.3) return 'Just now it’s slack: the tide’s turning, and the water in it stands still.';
  return going < 0 ? 'Just now it’s running out to the deep.' : 'Just now it’s running in: the tide’s coming.';
}

/** A strip over it, unseen, for picking. */
export function geulStrip() {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const z = HEAD - ((HEAD - MOUTH) * i) / n;
    const x = geulX(z);
    const w = Math.max(0.6, geulW(z) + 0.3);
    pos.push(x - w, 0.01, z, x + w, 0.01, z);
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  mesh.userData.id = 'geul';
  return mesh;
}

/**
 * For the waters, after the dither (`bayer`). `geulN` is where a point is across it (-1 … 1 in
 * it, past that out of it); `geulBreak` how much its ripples break the mirror there; `geulTint`
 * its colour: darker water, two steps, with pale glints running in chevrons with the current.
 */
export const GEUL_GLSL = /* glsl */ `
  uniform float uFlow;
  uniform float uCurrent;
  float geulAlong(float z) { return clamp((${HEAD.toFixed(1)} - z) / ${(HEAD - MOUTH).toFixed(1)}, 0.0, 1.0); }
  float geulN(vec2 p) {
    if (p.y > ${HEAD.toFixed(1)}) return 9.0;
    float t = geulAlong(p.y);
    float x = 23.0 + 6.5 * t + 2.4 * sin(p.y * 0.09 + 1.1) * (0.4 + 0.6 * t) + 0.9 * sin(p.y * 0.23 + 0.3);
    float w = 0.18 + 2.1 * pow(t, 0.7);
    return (p.x - x) / w;
  }
  // the ripples: chevrons pointing downstream (the middle runs fastest), carried by the current
  float geulRipple(float n, vec2 p) {
    float s = (p.y + uFlow) * 2.4 - abs(n) * 1.3 * sign(uCurrent) + sin(p.y * 0.7 + n * 2.0) * 0.6;
    // (broken across, so they're short dashes, staggered, not bars)
    return sin(s) * (0.55 + 0.45 * sin(n * 5.0 + s * 0.37 + 1.7));
  }
  float geulBreak(float n, vec2 p) {
    float dep = 1.0 - n * n;
    if (dep <= 0.0) return 0.0;
    return geulRipple(n, p) * dep * (0.003 + 0.012 * abs(uCurrent));
  }
  vec3 geulTint(vec3 col, float n, vec2 p, float d) {
    float dep = 1.0 - n * n + (d - 0.5) * 0.12;
    // (out past the deep's edge it's just the deep)
    float fade = step(${(MOUTH - 3).toFixed(1)}, p.y + (d - 0.5) * 2.0);
    if (dep <= 0.0 || fade < 0.5) return col;
    col *= dep > 0.4 ? vec3(0.58, 0.63, 0.8) : vec3(0.8, 0.83, 0.92);
    float run = abs(uCurrent);
    float rip = geulRipple(n, p);
    // glints where the current's moving (fewer and fewer towards the turn), and troughs
    float glint = step(0.96 - run * 0.14, rip) * step(0.25, dep);
    col = mix(col, col * 1.35 + vec3(0.04, 0.05, 0.08), glint);
    col *= 1.0 - step(rip, -0.8 + (1.0 - run) * 0.15) * step(0.3, dep) * 0.14;
    return col;
  }
`;
