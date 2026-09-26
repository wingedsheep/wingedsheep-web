import * as THREE from 'three';
import type { Course } from './course';
import { BACKFLOW, CORE, EDDY_BEND } from './flow';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
`;

/** How many rocks (and bits of log) near the kayak the water knows about, for foam and eddies. */
export const MAX_ROCKS = 40;
/** …and holes and tongues. */
export const MAX_HOLES = 10;
export const MAX_TONGUES = 10;
/** Rings spreading from the paddle's strokes, a landing, a knock, drifting off on the current. */
export const MAX_RIPPLES = 10;
const ACROSS = 24; // quads across the river: enough to draw the fast core and an eddy by the bank
const OVERLAP = 1.1; // the water reaches a little under the banks

/**
 * The river's water: one shared material over ribbons that follow the centre line, painted like
 * the island's sea (the same palette, in stepped bands on a world-space grid) and drawn so you can
 * read it the way a paddler does. The flow is worked out pixel by pixel just as the kayak feels
 * it (flow.ts), and the current shows as dashes riding it: long and quick down the fast core,
 * short and lazy in slow water, turning back upstream in an eddy, with a seam of froth along
 * every eddy line. Standing waves hold their place while the water runs through them, caustics
 * and pebbles show through slow clear water, a pillow of foam piles up on every rock, holes boil
 * back on themselves, and white water pours over the falls. The boat leaves a wake and every
 * stroke a ring.
 *
 * Everything that moves either drifts for a cycle and starts again or shimmers in place, so
 * nothing gets smeared out however long you paddle.
 */
export function riverWater() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uLight: { value: new THREE.Color(1, 1, 1) },
      uNight: { value: 0 },
      uRain: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() },
      uView: { value: new THREE.Vector3(0, -0.74, -0.67) },
      uSky: { value: new THREE.Color(0.7, 0.85, 0.95) },
      // ?flow in the address: the water coloured by its speed (red fast, blue back upstream)
      uDebug: { value: new URLSearchParams(location.search).has('flow') ? 1 : 0 },
      uBoat: { value: new THREE.Vector4(0, 0, 0, 0) },
      uRocks: { value: Array.from({ length: MAX_ROCKS }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uHoles: { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uTongues: { value: Array.from({ length: MAX_TONGUES }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0)) },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec4 aRiver; // across (-1..1), s, rough, speed
      attribute vec4 aMore; // clear, gorge, drop, heading
      attribute vec4 aSplit; // m across, the island's middle (m across), half its width (m), the hero channel's side
      attribute vec2 aBend; // the river's width (m) and how hard it bends (rad/m, + right)
      varying vec3 vWorld;
      varying vec4 vRiver;
      varying vec4 vMore;
      varying vec4 vSplit;
      varying vec2 vBend;
      #include <fog_pars_vertex>
      ${NOISE}
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        // standing waves in the rapids: humps that hold their place while the water runs through
        float wave = sin(aRiver.y * 1.3 + noise(w.xz * 0.3) * 4.0) * sin(aRiver.x * 5.0 + uTime * 1.5);
        w.y += wave * aRiver.z * 0.14 * (1.0 - aRiver.x * aRiver.x);
        vWorld = w.xyz;
        vRiver = aRiver;
        vMore = aMore;
        vSplit = aSplit;
        vBend = aBend;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uLight;
      uniform float uNight;
      uniform float uRain;
      uniform float uDebug;
      uniform vec3 uSunDir;
      uniform vec3 uView;
      uniform vec3 uSky;
      uniform vec4 uBoat; // x, z, the heading of its wake, how fast it's moving through the water
      uniform vec4 uRocks[${MAX_ROCKS}];
      uniform vec4 uHoles[${MAX_HOLES}];
      uniform vec4 uTongues[${MAX_TONGUES}];
      uniform vec4 uRipples[${MAX_RIPPLES}];
      varying vec3 vWorld;
      varying vec4 vRiver;
      varying vec4 vMore;
      varying vec4 vSplit;
      varying vec2 vBend;
      #include <fog_pars_fragment>
      ${NOISE}

      const float CYCLE = 1.6; // seconds a dash of current lives before the next lot take over

      // the current, drawn the way a pixel artist draws the sea: short light dashes (with a dark
      // pixel beside each), here carried along at the water's own speed. Long and quick down the
      // fast line, short and lazy in slow water, back upstream in an eddy. Each lot drifts for a
      // cycle and pops out dash by dash as the next lot pops in, so nothing smears.
      // lp: river space (m across, m along). Returns 1 on a dash, -1 on its shadow, 0 elsewhere.
      float dashes(vec2 lp, float along, float fast, float rough, float phase, float seed) {
        float t = fract(uTime / CYCLE + phase);
        vec2 size = vec2(0.7, mix(1.4, 3.6, fast));
        vec2 q = lp - vec2(0.0, along * t * CYCLE);
        q.y += hash(vec2(floor(q.x / size.x), seed)) * size.y; // stagger the columns
        vec2 cell = floor(q / size);
        vec2 l = q / size - cell;
        float h = hash(cell + seed);
        float life = 1.0 - abs(2.0 * t - 1.0);
        float on = step(h, mix(0.07, 0.22, fast) + rough * 0.1) * step(hash(cell + seed + 3.1), life * 1.6);
        float len = mix(0.18, 0.75, fast) * (0.6 + 0.4 * hash(cell + seed + 7.7)) + rough * 0.15;
        float x = (l.x - 0.5) * size.x;
        float inLen = step(abs(l.y - 0.5), len * 0.5);
        float thick = 0.09;
        return on * inLen * (step(abs(x), thick) - step(abs(x - 0.2), 0.08));
      }

      void main() {
        vec2 wp = vWorld.xz;
        vec2 p = floor(wp * 6.0) / 6.0; // one "art pixel" of water is ~16 cm
        float u = vRiver.x;
        float s = vRiver.y;
        float rough = vRiver.z;
        float speed = vRiver.w;
        float clear = vMore.x;
        float gorge = vMore.y;
        float drop = vMore.z;
        vec2 dir = vec2(sin(vMore.w), -cos(vMore.w)); // downstream (x, z)
        vec2 right = vec2(-dir.y, dir.x);
        float off = vSplit.x; // m across
        vec2 lp = vec2(off, s);
        float depth = 1.0 - u * u; // 0 at the banks … 1 mid-stream
        // the standing waves (as the vertices ride them), worked out per pixel so their bands
        // don't follow the triangles
        float wave = sin(s * 1.3 + noise(p * 0.3) * 4.0) * sin(u * 5.0 + uTime * 1.5);
        vec2 drift = vec2(uTime * 0.15, -uTime * 0.1); // for things that just shimmer in place

        // --- the flow, worked out here pixel by pixel just as flow.ts does for the kayak -----
        float bend = vBend.y;
        float uu = clamp(off / (vBend.x * 0.5), -1.0, 1.0);
        float core = clamp(-bend * ${CORE.toFixed(1)}, -0.5, 0.5);
        float d = min(1.0, abs(uu < core ? (uu - core) / (1.0 + core) : (uu - core) / (1.0 - core)));
        float along = speed * (1.0 - 0.62 * pow(d, 2.5));
        float isle = vSplit.z;
        float shore = abs(off - vSplit.y) - isle; // m out from the island's edge
        if (isle > 0.0) {
          float k = clamp(isle / 1.5, 0.0, 1.0);
          float hero = step(0.0, (off - vSplit.y) * vSplit.w);
          along *= mix(1.0 - 0.22 * k, 1.0 + 0.2 * k, hero) * (0.72 + 0.28 * clamp(shore / 2.0, 0.0, 1.0));
          depth = min(depth, clamp(shore / 3.0, 0.0, 1.0));
          rough = clamp(rough * mix(1.0, mix(0.4, 1.5, hero), k) + hero * k * 0.15, 0.0, 1.0);
        }
        float bendy = clamp((abs(bend) - ${EDDY_BEND.toFixed(3)}) * 45.0, 0.0, 1.0) * (1.0 - drop);
        float eddy = step(0.0, sign(bend) * uu) * smoothstep(0.5, 0.82, d) * bendy;

        // rocks: an eddy behind each, a pillow on its upstream face, foam hugging it
        float rockEddy = 0.0;
        float pillow = 0.0;
        float ring = 0.0;
        float wet = 0.0;
        for (int k = 0; k < ${MAX_ROCKS}; k++) {
          vec4 r = uRocks[k];
          if (r.z <= 0.0) continue;
          vec2 dd = wp - r.xy;
          float dist = length(dd) - r.z;
          if (dist > r.z * 9.0 + 2.0) continue;
          float a = dot(dd, dir);
          float c = dot(dd, right);
          float fringe = 0.12 + rough * 0.14 + 0.08 * noise(p * 2.0 + drift * 6.0);
          ring = max(ring, step(dist, fringe) * step(-0.25, dist));
          wet = max(wet, step(dist, 0.3) * step(-0.25, dist));
          if (a < 0.0) pillow = max(pillow, step(dist, 0.25 + speed * 0.05) * step(abs(c), r.z * 0.8) * step(-0.25, dist));
          if (r.w < 0.0) continue; // (a log along the current leaves no eddy to speak of)
          float len = r.z * (5.0 + min(4.0, abs(along) * 0.5));
          if (a > -r.z * 0.2 && a < len) {
            float t = max(a, 0.0) / len;
            float wd = r.z * (1.6 - t * 0.9);
            rockEddy = max(rockEddy, (1.0 - smoothstep(wd * 0.6, wd, abs(c))) * (1.0 - t * t * t) * smoothstep(-r.z * 0.2, r.z * 0.3, a));
          }
        }
        eddy = max(eddy, rockEddy);
        along = along * (1.0 - eddy) - speed * ${BACKFLOW.toFixed(2)} * eddy;

        // tongues: a smooth V of dark, glassy water through a gap, pointing downstream, and faster
        float calm = 0.0;
        for (int k = 0; k < ${MAX_TONGUES}; k++) {
          vec4 g = uTongues[k];
          if (g.z <= 0.0) continue;
          vec2 dd = wp - g.xy;
          float a = dot(dd, dir);
          // (its edges ragged, and fading out at either end, so it never shows as a hard triangle)
          float w = g.z * clamp((2.5 - a) / 5.5, 0.0, 1.0) + (noise(p * 2.0) - 0.5) * 0.35;
          float ends = smoothstep(-3.0, -1.8, a) * (1.0 - smoothstep(1.2, 2.5, a));
          calm = max(calm, step(abs(dot(dd, right)), w) * step(0.5, ends + (noise(p * 3.0) - 0.5) * 0.4));
        }
        along += calm * 2.2;
        rough *= (1.0 - calm) * (1.0 - eddy * 0.75);
        float fast = clamp(along / 8.0, 0.0, 1.0);

        // --- the colour: the island sea's palette. Turquoise in the shallows by the banks and over
        // the gravel of a slow pool, deepening to blue where it's deep and running hard
        vec3 shallow = mix(vec3(0.22, 0.78, 0.66), vec3(0.42, 0.72, 0.5), clear * 0.5);
        vec3 mid = vec3(0.05, 0.40, 0.52);
        vec3 deep = vec3(0.03, 0.17, 0.33);
        float t = clamp(depth * (0.7 - clear * 0.35) + fast * 0.35 + (noise(p * 0.12) - 0.5) * 0.1, 0.0, 1.0);
        vec3 col = mix(shallow, mid, smoothstep(0.0, 0.35, t));
        col = mix(col, deep, smoothstep(0.45, 1.0, t));
        // patches of darker and lighter water over the bed (they stay put: the current runs over them)
        float blot = noise(p * 0.07) + noise(p * 0.16) * 0.5;
        col *= 1.0 + (floor(blot * 3.0) / 3.0 - 0.5) * 0.12;
        col *= 1.0 - gorge * 0.2;
        // an eddy's still water, a shade darker and greener; the V of a tongue darker still
        col = mix(col, mix(mid, deep, 0.5) * vec3(0.9, 1.05, 0.95), smoothstep(0.3, 0.7, eddy) * 0.7);
        col = mix(col, deep, calm * 0.6);
        // the standing waves in stepped bands: lit backs, dark troughs
        float lit = floor(clamp(wave, -1.0, 1.0) * 2.5 + 0.5) / 2.5;
        col *= 1.0 + lit * rough * 0.16;

        // the surface catching the light, one art pixel at a time: ripples that shimmer in
        // place (choppier in white water, glassy in a tongue), lit from the sun, with a little of
        // the sky in them where they tilt away
        vec2 e = vec2(1.0 / 6.0, 0.0);
        float chop = 0.5 + rough * 0.8;
        float h0 = noise(p * 0.8 + drift * 3.0);
        float hx = noise((p + e.xy) * 0.8 + drift * 3.0);
        float hz = noise((p + e.yx) * 0.8 + drift * 3.0);
        vec3 n = normalize(vec3((h0 - hx) * chop * (1.0 - calm * 0.8), 1.0, (h0 - hz) * chop * (1.0 - calm * 0.8)));
        vec3 sun = normalize(uSunDir);
        float shade = floor((dot(n, sun) - dot(vec3(0.0, 1.0, 0.0), sun)) * 8.0 + 0.5) / 8.0;
        col *= 1.0 + clamp(shade, -0.06, 0.06);
        vec3 rf = reflect(normalize(uView), n);
        col = mix(col, uSky, step(0.12, 1.0 - rf.y) * 0.12 * (1.0 - uNight * 0.6) * (1.0 - calm));
        // stepped bands, like a hand-picked palette
        col = floor(col * 14.0 + 0.5) / 14.0;
        // and the sun glinting off the ripples, a pixel at a time
        float spec = pow(max(dot(rf, sun), 0.0), 60.0);
        col += vec3(1.0, 0.97, 0.88) * step(0.8, spec) * 0.4 * (1.0 - uNight * 0.9) * (1.0 - uRain * 0.8);

        // caustic squiggles and pebbles in clear, slow shallows
        float see = clamp(clear * 0.9 + (1.0 - depth) * 0.3 - fast * 1.0, 0.0, 1.0) * (1.0 - rough);
        float c = abs(noise(p * 0.9 + drift) - 0.5);
        col += vec3(0.10, 0.14, 0.10) * step(c, 0.03) * see;
        col = mix(col, col * 0.85, step(0.74, noise(p * 2.2)) * see * 0.6);

        // --- the current ------------------------------------------------------------------
        float dash = dashes(lp, along, fast, rough, 0.0, 0.0) + dashes(lp + vec2(0.35, 0.0), along, fast, rough, 0.5, 11.0);
        dash *= 1.0 - calm * 0.7;
        vec3 light = mix(vec3(0.55, 0.85, 0.95), vec3(0.9, 0.97, 0.97), rough);
        col = mix(col, mix(col, light, 0.5 + fast * 0.2), step(0.5, dash));
        col = mix(col, col * 0.84, step(dash, -0.5));

        // eddy lines: a seam of froth where the still water meets the current
        float seam = 1.0 - smoothstep(0.05, 0.12, abs(eddy - 0.4));
        col = mix(col, vec3(0.9, 0.96, 0.95), seam * step(0.4, noise(p * 2.2 + drift * 4.0)));

        // white water: foam spilling off the standing waves' crests, and churned froth
        float white = step(0.95 - rough * 0.12, wave) * step(0.5, noise(p * 2.0 + drift * 5.0));
        white = max(white, step(1.0 - rough * 0.18, noise(p * 1.4 + drift * 3.0)) * step(0.5, rough));
        col = mix(col, vec3(0.9, 0.96, 0.95), white * smoothstep(0.1, 0.4, rough));

        // rocks: wet and dark round the waterline, a pillow piling up on the upstream face, foam
        col = mix(col, col * 0.8, wet * 0.5);
        col = mix(col, vec3(0.92, 0.97, 0.94), max(ring, pillow * step(0.35, noise(p * 2.4 + drift * 8.0))));

        // holes: a dark trough, then a band of water boiling back on itself
        for (int k = 0; k < ${MAX_HOLES}; k++) {
          vec4 hl = uHoles[k];
          if (hl.z <= 0.0) continue;
          vec2 dd = wp - hl.xy;
          float a = dot(dd, dir);
          float inside = step(abs(dot(dd, right)), hl.z + noise(p * 1.5) * 0.4);
          float trough = step(-1.6, a) * step(a, -0.5) * inside;
          float boil = step(-0.6, a) * step(a, 0.9 + hl.w * 0.5) * inside;
          float churn = step(0.35, noise(p * 3.0 + drift * 12.0) * 0.6 + noise(p * 1.4 - drift * 7.0) * 0.6);
          col = mix(col, col * 0.62, trough);
          col = mix(col, mix(vec3(0.78, 0.9, 0.92), vec3(0.97, 1.0, 1.0), churn), boil);
        }

        // over a fall: all white, pouring
        float pour = step(0.35, noise(vec2(u * 12.0, s * 2.0 - uTime * 14.0)));
        col = mix(col, mix(vec3(0.82, 0.93, 0.95), vec3(1.0), pour), drop);

        // foam along the banks, as round the island: a line hugging the edge and a second one
        // breathing in and out
        float breathe = sin(uTime * 1.1 + s * 0.2) * 0.012;
        float foam = step(0.96 + breathe, abs(u));
        foam = max(foam, step(abs(abs(u) - (0.9 + breathe * 2.0)), 0.012) * step(0.45, noise(p * 1.2 + drift * 2.0)));
        if (isle > 0.0) {
          float lap = shore + sin(uTime * 1.1 + s * 0.4) * 0.1;
          foam = max(foam, step(lap, 0.3));
          foam = max(foam, step(abs(lap - 0.7), 0.08) * step(0.45, noise(p * 1.2 + drift * 2.0)));
        }
        col = mix(col, vec3(0.92, 0.97, 0.94), foam);

        // --- the boat: a V of wake behind it through the water, and rings from its strokes
        if (uBoat.w > 0.3) {
          vec2 wd = vec2(sin(uBoat.z), -cos(uBoat.z));
          vec2 dd = wp - uBoat.xy;
          float a = -dot(dd, wd) - 1.2; // behind the stern
          float cc = abs(dot(dd, vec2(-wd.y, wd.x)));
          float len = 0.8 + min(uBoat.w, 5.0) * 0.5;
          // a short V of broken foam spreading off the stern, thinning out as it goes
          float arm = abs(cc - 0.3 - max(a, 0.0) * 0.35);
          float fade = 1.0 - clamp(a / len, 0.0, 1.0);
          float speck = hash(p + floor(uTime * 6.0));
          float wake = step(0.0, a) * step(arm, 0.12) * step(speck, fade * fade * 0.9);
          col = mix(col, vec3(0.88, 0.96, 0.95), wake);
        }
        for (int k = 0; k < ${MAX_RIPPLES}; k++) {
          vec4 r = uRipples[k];
          if (r.w <= 0.0) continue;
          float rad = 0.2 + r.z * (0.9 + r.w * 0.6);
          float life = 1.0 - r.z / (0.7 + r.w * 0.5);
          if (life <= 0.0) continue;
          // a thin ring, breaking up as it spreads
          float on = step(abs(length(wp - r.xy) - rad), 0.06) * step(hash(p + r.xy), life);
          col = mix(col, vec3(0.84, 0.94, 0.95), on);
        }

        // rain: little rings spreading where drops land
        if (uRain > 0.0) {
          vec2 rc = floor(wp * 0.8);
          float phase = fract(uTime * 1.1 + hash(rc));
          vec2 centre = (rc + 0.2 + 0.6 * vec2(hash(rc + 1.7), hash(rc + 4.3))) / 0.8;
          float rr = step(abs(length(wp - centre) - phase * 0.5), 0.07) * step(hash(rc + floor(uTime * 1.1 + hash(rc)) * 0.13), uRain * 0.8);
          col = mix(col, vec3(0.78, 0.9, 0.92), rr * (1.0 - phase) * 0.7);
        }

        if (uDebug > 0.0) col = along > 0.0 ? mix(vec3(0.2), vec3(1.0, 0.2, 0.1), along / 10.0) : mix(vec3(0.2), vec3(0.1, 0.4, 1.0), -along / 3.0);
        col *= uLight;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  return { material, uniforms: material.uniforms };
}

/** The water for samples i0..i1 of the course (inclusive). */
export function waterRibbon(course: Course, i0: number, i1: number, material: THREE.Material) {
  const rows = i1 - i0 + 1;
  const cols = ACROSS + 1;
  const pos = new Float32Array(rows * cols * 3);
  const river = new Float32Array(rows * cols * 4);
  const more = new Float32Array(rows * cols * 4);
  const split = new Float32Array(rows * cols * 4);
  const bend = new Float32Array(rows * cols * 2);
  const dry = new Uint8Array(rows * cols); // well inside an island: no water to draw
  for (let r = 0; r < rows; r++) {
    const p = course.samples[i0 + r];
    const rx = Math.cos(p.a);
    const rz = Math.sin(p.a);
    for (let c = 0; c < cols; c++) {
      const u = (c / ACROSS) * 2 - 1;
      const k = r * cols + c;
      const off = u * (p.width / 2) * OVERLAP;
      pos.set([p.x + rx * off, p.y, p.z + rz * off], k * 3);
      river.set([u * OVERLAP, p.s, p.rough, p.speed], k * 4);
      more.set([p.clear, p.gorge, p.drop, p.a], k * 4);
      split.set([off, p.isleU, p.isle, p.hero], k * 4);
      bend.set([p.width, p.bend], k * 2);
      dry[k] = p.isle > 0 && Math.abs(off - p.isleU) < p.isle - 1.2 ? 1 : 0;
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      if (dry[a] && dry[a + 1] && dry[a + cols] && dry[a + cols + 1]) continue;
      index.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRiver', new THREE.BufferAttribute(river, 4));
  geo.setAttribute('aMore', new THREE.BufferAttribute(more, 4));
  geo.setAttribute('aSplit', new THREE.BufferAttribute(split, 4));
  geo.setAttribute('aBend', new THREE.BufferAttribute(bend, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  return mesh;
}
