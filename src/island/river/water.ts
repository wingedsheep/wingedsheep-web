import * as THREE from 'three';
import type { Course } from './course';
import { BACKFLOW, stream } from './flow';

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
 * The river's water: one shared material over ribbons that follow the centre line, drawn so you
 * can read it the way a paddler does. The surface moves at the water's own speed (flow.ts, the
 * same model the kayak feels): long bright streaks racing down the fast core, lazy flecks
 * turning back upstream in an eddy, a frothy seam along every eddy line. Standing waves hold
 * their place while the water runs through them, the pebbly bed shows through slow clear water,
 * and the sun glints off the moving surface. A pillow of foam piles up on every rock with its
 * eddy behind it, holes boil back on themselves, and white water pours over the falls. The boat
 * leaves a wake and every stroke a ring.
 *
 * It's all lit with a normal and a sky to reflect, then stepped into bands and dithered, so it
 * still pixelates cleanly like the island's sea.
 */
export function riverWater() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uLight: { value: new THREE.Color(1, 1, 1) },
      uSky: { value: new THREE.Color(0.7, 0.85, 0.95) },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() },
      uView: { value: new THREE.Vector3(0, -0.74, -0.67) },
      uNight: { value: 0 },
      uRain: { value: 0 },
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
      attribute vec4 aFlow; // the water's speed down the river here (m/s), eddy (0..1), core (0..1)
      varying vec3 vWorld;
      varying vec4 vRiver;
      varying vec4 vMore;
      varying vec4 vSplit;
      varying vec4 vFlow;
      #include <fog_pars_vertex>
      ${NOISE}
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float rough = aRiver.z * (1.0 - aFlow.y * 0.7);
        // standing waves in the rapids: humps that hold their place while the water runs through
        float wave = sin(aRiver.y * 1.3 + noise(w.xz * 0.3) * 4.0) * sin(aRiver.x * 5.0 + uTime * 1.5);
        w.y += wave * rough * 0.16 * (1.0 - aRiver.x * aRiver.x);
        vWorld = w.xyz;
        vRiver = aRiver;
        vMore = aMore;
        vSplit = aSplit;
        vFlow = aFlow;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uLight;
      uniform vec3 uSky;
      uniform vec3 uSunDir;
      uniform vec3 uView;
      uniform float uNight;
      uniform float uRain;
      uniform float uDebug;
      uniform vec4 uBoat; // x, z, the heading of its wake, how fast it's moving through the water
      uniform vec4 uRocks[${MAX_ROCKS}];
      uniform vec4 uHoles[${MAX_HOLES}];
      uniform vec4 uTongues[${MAX_TONGUES}];
      uniform vec4 uRipples[${MAX_RIPPLES}];
      varying vec3 vWorld;
      varying vec4 vRiver;
      varying vec4 vMore;
      varying vec4 vSplit;
      varying vec4 vFlow;
      #include <fog_pars_fragment>
      ${NOISE}

      const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
      const float CYCLE = 1.4; // seconds each layer of the surface drifts before it's faded out for the other

      // the surface moves with the water: two layers of pattern sliding downstream at the
      // water's speed, each faded out and reset as the other takes over (a flow map, in river
      // space: x metres across, y metres along). 'stretch' draws it out into streaks.
      float drift(vec2 lp, float along, float scale, float stretch, float seed) {
        float t0 = fract(uTime / CYCLE);
        float t1 = fract(uTime / CYCLE + 0.5);
        vec2 k = vec2(scale, scale / stretch);
        float a = noise((lp - vec2(0.0, along * t0 * CYCLE)) * k + seed);
        float b = noise((lp - vec2(0.0, along * t1 * CYCLE)) * k + seed + 17.3);
        float w = 1.0 - abs(2.0 * t0 - 1.0);
        float n = mix(b, a, w);
        // keep the contrast while the two layers are both half there
        return (n - 0.5) / sqrt(w * w + (1.0 - w) * (1.0 - w)) + 0.5;
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
        vec2 lp = vec2(vSplit.x, s); // river space: m across, m along
        float along = vFlow.x;
        float eddy = vFlow.y;
        float core = vFlow.z;
        float depth = 1.0 - u * u; // 0 at the banks … 1 mid-stream

        // round an island: shallows along its shore, and one channel white, the other calm
        float isle = vSplit.z;
        float shore = abs(vSplit.x - vSplit.y) - isle; // m out from the island's edge
        if (isle > 0.0) {
          depth = min(depth, clamp(shore / 3.0, 0.0, 1.0));
          float k = clamp(isle / 1.5, 0.0, 1.0);
          float hero = step(0.0, (vSplit.x - vSplit.y) * vSplit.w);
          rough = clamp(rough * mix(1.0, mix(0.4, 1.5, hero), k) + hero * k * 0.15, 0.0, 1.0);
        }

        // --- the rocks: an eddy behind each, a pillow on its upstream face, foam round it -----
        float rockEddy = 0.0;
        float pillow = 0.0;
        float ring = 0.0;
        float shadow = 0.0;
        for (int k = 0; k < ${MAX_ROCKS}; k++) {
          vec4 r = uRocks[k];
          if (r.z <= 0.0) continue;
          vec2 d = wp - r.xy;
          float a = dot(d, dir);
          float c = dot(d, right);
          float dist = length(d) - r.z;
          if (dist > r.z * 9.0 + 2.0) continue;
          float foamy = 0.3 + rough * 0.5;
          float wob = 0.6 + 0.4 * noise(p * 2.0 - dir * uTime * (0.5 + speed * 0.2));
          ring = max(ring, step(dist, 0.1 + foamy * 0.22 * wob) * step(-0.25, dist));
          shadow = max(shadow, (1.0 - smoothstep(0.0, 0.35, dist)) * step(-0.25, dist));
          if (a < 0.0) pillow = max(pillow, (1.0 - smoothstep(0.0, 0.5 + speed * 0.07, dist)) * smoothstep(-r.z - 0.3, -r.z * 0.2, -abs(c)) * step(-0.25, dist));
          if (r.w < 0.0) continue; // (a log lying along the current leaves no eddy to speak of)
          float len = r.z * (5.0 + min(4.0, abs(along) * 0.5));
          if (a > -r.z * 0.2 && a < len) {
            float t = max(a, 0.0) / len;
            float wd = r.z * (1.6 - t * 0.9);
            float e = (1.0 - smoothstep(wd * 0.6, wd, abs(c))) * (1.0 - t * t * t) * smoothstep(-r.z * 0.2, r.z * 0.3, a);
            rockEddy = max(rockEddy, e);
          }
        }
        along = along * (1.0 - rockEddy) - speed * ${BACKFLOW.toFixed(2)} * rockEddy;
        eddy = max(eddy, rockEddy);

        // tongues: a smooth V of dark, glassy water through a gap, pointing downstream, and faster
        float calm = 0.0;
        for (int k = 0; k < ${MAX_TONGUES}; k++) {
          vec4 g = uTongues[k];
          if (g.z <= 0.0) continue;
          vec2 d = wp - g.xy;
          float a = dot(d, dir);
          float c = abs(dot(d, right));
          float w = g.z * clamp((2.5 - a) / 5.5, 0.0, 1.0);
          calm = max(calm, step(-3.0, a) * step(a, 2.5) * (1.0 - smoothstep(w * 0.7, w, c)));
        }
        along += calm * 2.2;
        rough *= (1.0 - calm) * (1.0 - eddy * 0.75);
        float fast = clamp(along / 8.0, 0.0, 1.0);

        // --- the colour of the water: clear and green over pebbles when slow and shallow, teal to
        // deep blue where it's running, darker still between gorge walls and in the glassy V
        vec3 shallow = mix(vec3(0.24, 0.62, 0.56), vec3(0.5, 0.62, 0.42), clear * 0.8);
        vec3 mid = mix(vec3(0.1, 0.44, 0.5), vec3(0.2, 0.5, 0.4), clear * 0.7);
        vec3 deep = mix(vec3(0.05, 0.26, 0.38), vec3(0.1, 0.34, 0.34), clear * 0.6);
        float wob = (noise(p * 0.4 - dir * uTime * (0.1 + speed * 0.05)) - 0.5) * 0.2;
        float t = clamp(depth + wob + fast * 0.25, 0.0, 1.0);
        vec3 col = mix(shallow, mid, smoothstep(0.1, 0.45, t));
        col = mix(col, deep, smoothstep(0.5, 0.95, t) * (1.0 - clear * 0.3));
        col *= 1.0 - gorge * 0.22;
        // an eddy's water is still and a shade darker; the V of a tongue darker and glassier
        col = mix(col, mix(deep, mid, 0.3) * vec3(0.85, 1.0, 0.92), smoothstep(0.25, 0.65, eddy) * 0.8);
        col = mix(col, deep * 0.85, calm * 0.55);

        // the bed, seen through the water where it's slow (it holds still while the surface moves:
        // that's how you see how fast the water's going over it), and caustics dancing on it
        float see = clamp(clear * 0.8 + (1.0 - t) * 0.6 - fast * 0.6, 0.0, 1.0) * (1.0 - rough);
        float pebble = step(0.7, noise(p * 2.2)) + step(0.8, noise(p * 0.9 + 3.1)) * 0.6;
        col = mix(col, col * 0.84, min(1.0, pebble) * see * 0.7);
        float c = abs(drift(lp, along * 0.25, 1.3, 1.0, 5.0) - 0.5);
        col += vec3(0.12, 0.13, 0.08) * step(c, 0.04) * see;

        // --- the surface: waves that ride the current, chop in the white water, standing
        // waves that hold still, and a normal to light them with
        float stretch = 1.0 + abs(along) * 0.45;
        float amp = 0.12 + rough * 0.55 + fast * 0.2;
        vec2 e = vec2(0.18, 0.0);
        float h0 = drift(lp, along, 1.6, stretch, 0.0) + drift(lp, along, 4.0, stretch * 0.6, 9.0) * 0.5;
        float hx = drift(lp + e.xy, along, 1.6, stretch, 0.0) + drift(lp + e.xy, along, 4.0, stretch * 0.6, 9.0) * 0.5;
        float hz = drift(lp + e.yx, along, 1.6, stretch, 0.0) + drift(lp + e.yx, along, 4.0, stretch * 0.6, 9.0) * 0.5;
        // standing waves: ridges across the rapids that stay where they are
        float crest = sin(s * 1.3 + noise(wp * 0.3) * 4.0) * sin(u * 5.0 + uTime * 1.5);
        float crestZ = cos(s * 1.3 + noise(wp * 0.3) * 4.0) * sin(u * 5.0 + uTime * 1.5) * 1.3;
        vec2 grad = vec2(hx - h0, hz - h0) / e.x * amp * 0.35 + vec2(0.0, crestZ * rough * 0.5);
        grad *= 1.0 - calm * 0.8;
        // (grad is in river space: across, along; turn it into the world's x and z)
        vec2 gw = right * grad.x + dir * grad.y;
        vec3 n = normalize(vec3(-gw.x, 1.0, -gw.y));

        // lit: a little diffuse, the sky reflected at a glancing angle, and the sun glinting
        vec3 view = normalize(uView);
        float lit = dot(n, normalize(uSunDir));
        col *= 0.86 + 0.24 * lit;
        vec3 rf = reflect(view, n);
        float fres = pow(1.0 - max(dot(n, -view), 0.0), 3.0);
        vec3 sky = mix(uSky * 1.1, vec3(1.0), 0.2);
        col = mix(col, sky, clamp(fres * 1.2 + max(0.0, rf.y - 0.9) * 1.0, 0.0, 0.25) * (1.0 - uNight * 0.5));
        float spec = pow(max(dot(rf, normalize(uSunDir)), 0.0), 90.0);
        col += vec3(1.0, 0.97, 0.88) * step(0.55, spec) * 0.55 * (1.0 - uNight * 0.85) * (1.0 - uRain * 0.8);

        // --- the water's own foam, all carried by it --------------------------------------

        // the current: pale flecks and streaks, stretched long and racing where it's fast, a few
        // lazy bubbles where it's slow, turning back upstream in an eddy
        float fleck = drift(lp, along, 3.2, stretch * 1.6, 21.0);
        float fine = drift(lp, along, 7.0, 1.0 + stretch * 0.5, 33.0);
        float many = mix(0.93, 0.79, fast) - rough * 0.04;
        float streak = step(many, fleck) * (1.0 - calm * 0.6) * (1.0 - smoothstep(0.3, 0.6, eddy));
        col = mix(col, vec3(0.8, 0.94, 0.96), streak * (0.3 + fast * 0.5));
        // slow water, and eddies: a scatter of little bubbles, drifting lazily (or back upstream)
        float bubbles = step(mix(0.93, 0.86, eddy), fine) * (1.0 - fast) * max(0.3, eddy);
        col = mix(col, vec3(0.78, 0.9, 0.9), bubbles * 0.55);
        // bright glassy lines down the edges of a tongue
        col = mix(col, vec3(0.62, 0.86, 0.92), calm * step(0.84, drift(lp, along, 6.0, stretch * 2.0, 40.0)) * 0.55);

        // eddy lines: where still water meets the current, a seam of froth and little
        // whirlpools slipping along it
        float seam = 1.0 - smoothstep(0.1, 0.3, abs(eddy - 0.4));
        float whirl = drift(lp, along * 0.5, 3.4, 1.0, 60.0);
        col = mix(col, col * 0.6, seam * step(0.74, whirl));
        col = mix(col, vec3(0.9, 0.97, 0.97), seam * step(whirl, 0.58));

        // white water: standing waves breaking at their crests, and churning froth between them
        float froth = drift(lp, along, 2.4, 1.0 + stretch * 0.3, 70.0) + noise(p * 2.6 - dir * uTime * speed * 0.5) * 0.5;
        float white = step(1.0 - rough * 0.14, crest) * step(0.5, noise(p * 2.6 - dir * uTime * 0.6)) + step(1.66 - rough * 0.5, froth);
        col = mix(col, vec3(0.9, 0.96, 0.96), min(1.0, white) * smoothstep(0.1, 0.4, rough));

        // rocks: the pillow of water piling up on the upstream face, foam hugging the waterline,
        // the wet dark ring the water leaves on them
        col = mix(col, col * 0.75, shadow * 0.4);
        col = mix(col, vec3(0.88, 0.96, 0.96), max(ring, pillow * step(0.35, noise(p * 2.4 - dir * uTime * 3.0))));

        // holes: a dark trough, then a band of water boiling back on itself (running upstream)
        for (int k = 0; k < ${MAX_HOLES}; k++) {
          vec4 hl = uHoles[k];
          if (hl.z <= 0.0) continue;
          vec2 d = wp - hl.xy;
          float a = dot(d, dir);
          float c = abs(dot(d, right));
          float inside = step(c, hl.z + noise(p * 1.5) * 0.4);
          float trough = step(-1.6, a) * step(a, -0.5) * inside;
          float boil = step(-0.6, a) * step(a, 0.9 + hl.w * 0.5) * inside;
          float churn = step(0.35, drift(lp, -3.0 - hl.w * 2.0, 3.0, 1.0, 80.0) + noise(p * 3.0 + dir * uTime * 2.0) * 0.4);
          col = mix(col, col * 0.6, trough);
          col = mix(col, mix(vec3(0.78, 0.9, 0.92), vec3(0.97, 1.0, 1.0), churn), boil);
        }

        // over a fall: all white, pouring
        float pour = step(0.35, noise(vec2(u * 12.0, s * 2.0 - uTime * 14.0)));
        col = mix(col, mix(vec3(0.82, 0.93, 0.95), vec3(1.0), pour), drop);

        // foam where the river meets the banks, breathing in and out
        float edge = abs(u) + sin(uTime * 1.3 + s * 0.4) * 0.015;
        col = mix(col, vec3(0.88, 0.95, 0.93), step(0.955, edge) * step(0.4, noise(p * 1.4 - dir * uTime * (0.3 + speed * 0.1))));
        if (isle > 0.0) {
          float lap = shore + sin(uTime * 1.3 + s * 0.4) * 0.12;
          col = mix(col, vec3(0.88, 0.95, 0.93), step(lap, 0.35) * step(0.35, noise(p * 1.4 - dir * uTime * (0.3 + speed * 0.1))));
        }

        // --- the boat: a V of wake behind it through the water, and rings from its strokes
        if (uBoat.w > 0.3) {
          vec2 wd = vec2(sin(uBoat.z), -cos(uBoat.z));
          vec2 d = wp - uBoat.xy;
          float a = -dot(d, wd); // behind it
          float c = abs(dot(d, vec2(-wd.y, wd.x)));
          float len = 2.0 + uBoat.w * 2.2;
          float arm = abs(c - 0.36 - a * 0.36);
          float wake = step(0.0, a) * step(a, len) * step(arm, 0.1 + a * 0.03) * step(0.3, noise(p * 3.0 + uTime));
          col = mix(col, vec3(0.86, 0.95, 0.96), wake * (1.0 - a / len) * min(1.0, uBoat.w / 2.0));
          // the churned water straight behind the stern
          float trail = step(1.3, a) * step(a, len * 0.8) * step(c, 0.3) * step(0.55, noise(p * 2.5 - wd * uTime * 2.0));
          col = mix(col, vec3(0.82, 0.93, 0.95), trail * (1.0 - a / len) * 0.8);
        }
        for (int k = 0; k < ${MAX_RIPPLES}; k++) {
          vec4 r = uRipples[k];
          if (r.w <= 0.0) continue;
          float rad = r.z * (1.4 + r.w * 0.8);
          float life = 1.0 - r.z / (0.9 + r.w * 0.6);
          if (life <= 0.0) continue;
          float band = abs(length(wp - r.xy) - rad);
          col = mix(col, vec3(0.84, 0.94, 0.95), step(band, 0.07 + r.w * 0.04) * life * 0.8);
        }

        // sparkles in the sun, and raindrop rings
        vec2 cell = floor(wp * 2.0);
        float glint = step(0.997, hash(cell + floor(uTime * 2.0)));
        col += vec3(0.55) * glint * (1.0 - uNight * 0.6) * (1.0 - uRain);
        if (uRain > 0.0) {
          vec2 rc = floor(wp * 0.8);
          float phase = fract(uTime * 1.1 + hash(rc));
          vec2 centre = (rc + 0.2 + 0.6 * vec2(hash(rc + 1.7), hash(rc + 4.3))) / 0.8;
          float rr = step(abs(length(wp - centre) - phase * 0.5), 0.07) * step(hash(rc + floor(uTime * 1.1 + hash(rc)) * 0.13), uRain * 0.8);
          col = mix(col, vec3(0.78, 0.9, 0.92), rr * (1.0 - phase) * 0.7);
        }

        if (uDebug > 0.0) col = along > 0.0 ? mix(vec3(0.2), vec3(1.0, 0.2, 0.1), along / 10.0) : mix(vec3(0.2), vec3(0.1, 0.4, 1.0), -along / 3.0);
        col *= uLight;
        // stepped into bands, dithered between them, like the rest of the pixel art
        ivec2 q = ivec2(gl_FragCoord.xy);
        float bayer = (BAYER[(q.x & 3) + (q.y & 3) * 4] + 0.5) / 16.0 - 0.5;
        col = floor(col * 20.0 + 0.5 + bayer * 0.55) / 20.0;
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
  const flow = new Float32Array(rows * cols * 4);
  const dry = new Uint8Array(rows * cols); // well inside an island: no water to draw
  const st = { along: 0, eddy: 0, core: 0, lat: 0 };
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
      stream(p, off, st);
      flow.set([st.along, st.eddy, st.core, 0], k * 4);
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
  geo.setAttribute('aFlow', new THREE.BufferAttribute(flow, 4));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  return mesh;
}
