import * as THREE from 'three';
import type { Course } from './course';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
`;

/** How many rocks (and bits of log) near the kayak the water knows about, for foam and wakes. */
export const MAX_ROCKS = 40;
/** …and holes and tongues. */
export const MAX_HOLES = 10;
export const MAX_TONGUES = 10;
const ACROSS = 12; // quads across the river
const OVERLAP = 1.1; // the water reaches a little under the banks

/**
 * The river's water: one shared material over ribbons that follow the centre line. Like the
 * island's sea it's drawn in stepped bands on a world-space grid, so it pixelates cleanly: clear
 * and sandy in the slow stretches, teal to deep blue in the middle, streaks of current running
 * downstream, standing waves and froth in the rapids, a pillow of foam on every rock with a wake
 * trailing behind it, and white water pouring over a fall.
 */
export function riverWater() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uLight: { value: new THREE.Color(1, 1, 1) },
      uNight: { value: 0 },
      uRain: { value: 0 },
      uRocks: { value: Array.from({ length: MAX_ROCKS }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uHoles: { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uTongues: { value: Array.from({ length: MAX_TONGUES }, () => new THREE.Vector4(0, 0, 0, 0)) },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec4 aRiver; // across (-1..1), s, rough, speed
      attribute vec4 aMore; // clear, gorge, drop, heading
      varying vec3 vWorld;
      varying vec4 vRiver;
      varying vec4 vMore;
      #include <fog_pars_vertex>
      ${NOISE}
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float rough = aRiver.z;
        // standing waves in the rapids: humps that hold their place while the water runs through
        float wave = sin(aRiver.y * 1.3 + noise(w.xz * 0.3) * 4.0) * sin(aRiver.x * 5.0 + uTime * 1.5);
        w.y += wave * rough * 0.14 * (1.0 - aRiver.x * aRiver.x);
        vWorld = w.xyz;
        vRiver = aRiver;
        vMore = aMore;
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
      uniform vec4 uRocks[${MAX_ROCKS}];
      uniform vec4 uHoles[${MAX_HOLES}];
      uniform vec4 uTongues[${MAX_TONGUES}];
      varying vec3 vWorld;
      varying vec4 vRiver;
      varying vec4 vMore;
      #include <fog_pars_fragment>
      ${NOISE}

      void main() {
        vec2 p = floor(vWorld.xz * 6.0) / 6.0; // one "art pixel" of water is ~16 cm
        float u = vRiver.x;
        float s = vRiver.y;
        float rough = vRiver.z;
        float speed = vRiver.w;
        float clear = vMore.x;
        float gorge = vMore.y;
        float drop = vMore.z;
        vec2 dir = vec2(sin(vMore.w), -cos(vMore.w)); // downstream (x, z)
        float depth = 1.0 - u * u; // 0 at the banks … 1 mid-stream

        // colour by depth: a pool is clear and green over pebbles; running water is teal to deep
        // blue, darker still between the gorge walls
        vec3 shallow = mix(vec3(0.24, 0.62, 0.56), vec3(0.5, 0.62, 0.42), clear * 0.8);
        vec3 mid = mix(vec3(0.1, 0.44, 0.5), vec3(0.2, 0.5, 0.4), clear * 0.7);
        vec3 deep = mix(vec3(0.05, 0.26, 0.38), vec3(0.1, 0.34, 0.34), clear * 0.6);
        float wob = (noise(p * 0.4 + dir * uTime * 0.2) - 0.5) * 0.2;
        float t = clamp(depth + wob, 0.0, 1.0);
        vec3 col = mix(shallow, mid, smoothstep(0.1, 0.45, t));
        col = mix(col, deep, smoothstep(0.5, 0.95, t) * (1.0 - clear * 0.3));
        col *= 1.0 - gorge * 0.25;
        col = floor(col * 14.0 + 0.5) / 14.0;

        // the pebbly bed, seen through clear water, and dappled caustics
        float ripple = step(0.82, fract(dot(p, vec2(dir.y, -dir.x)) * 0.9 + noise(p * 0.5) * 1.4));
        float pebble = step(0.72, noise(p * 2.2)) * clear * (1.0 - t * 0.7);
        col = mix(col, col * 0.86, pebble * 0.7);
        col = mix(col, col * 0.93, ripple * clear * 0.4);
        float c = abs(noise(p * 1.1 + vec2(uTime * 0.25, -uTime * 0.18)) - 0.5);
        col += vec3(0.12, 0.12, 0.08) * step(c, 0.035) * (0.35 + clear * 0.65) * (1.0 - rough);

        // the current: pale streaks running downstream, faster where the river is
        vec2 q = vec2(u * 16.0, s * 0.3 - uTime * speed * 0.3);
        float streak = step(0.8 - rough * 0.1, noise(q + vec2(0.0, noise(q * 0.3) * 2.0)));
        col = mix(col, mix(col, vec3(0.75, 0.92, 0.95), 0.45), streak * (0.4 + depth * 0.4));

        // tongues: a smooth V of dark, glassy water through a gap, pointing downstream
        float calm = 0.0;
        for (int k = 0; k < ${MAX_TONGUES}; k++) {
          vec4 g = uTongues[k];
          if (g.z <= 0.0) continue;
          vec2 d = vWorld.xz - g.xy;
          float along = dot(d, dir);
          float across = abs(dot(d, vec2(-dir.y, dir.x)));
          float w = g.z * clamp((2.5 - along) / 5.5, 0.0, 1.0);
          calm = max(calm, step(-3.0, along) * step(along, 2.5) * step(across, w));
        }
        col = mix(col, deep * 0.9, calm * 0.55);
        col = mix(col, vec3(0.6, 0.85, 0.9), calm * step(0.86, noise(vec2(dot(vWorld.xz, vec2(-dir.y, dir.x)) * 6.0, s * 0.5 - uTime * speed * 0.5))) * 0.5);
        rough *= 1.0 - calm;

        // white water: standing waves across the rapids, and churning froth between them
        float crest = sin(s * 1.3 + noise(vWorld.xz * 0.3) * 4.0) * sin(u * 5.0 + uTime * 1.5);
        float froth = noise(vec2(u * 14.0, s * 1.4 - uTime * speed * 1.4)) + noise(p * 2.6 - dir * uTime * speed * 0.5) * 0.6;
        float white = step(1.0 - rough * 0.3, crest) * step(0.45, noise(p * 1.3)) + step(1.78 - rough * 0.5, froth);
        col = mix(col, vec3(0.9, 0.96, 0.96), min(1.0, white) * smoothstep(0.1, 0.4, rough));

        // over a fall: all white, pouring
        float pour = step(0.35, noise(vec2(u * 12.0, s * 2.0 - uTime * 14.0)));
        col = mix(col, mix(vec3(0.82, 0.93, 0.95), vec3(1.0), pour), drop);

        // foam where the river meets the banks, breathing in and out
        float edge = abs(u) + sin(uTime * 1.3 + s * 0.4) * 0.015;
        col = mix(col, vec3(0.88, 0.95, 0.93), step(0.955, edge) * step(0.4, noise(p * 1.4 + uTime * 0.3)));

        // rocks: a pillow of foam piling up on the upstream side, and a wake trailing behind
        for (int k = 0; k < ${MAX_ROCKS}; k++) {
          vec4 r = uRocks[k];
          if (r.z <= 0.0) continue;
          vec2 d = vWorld.xz - r.xy;
          float along = dot(d, dir);
          float across = dot(d, vec2(-dir.y, dir.x));
          float dist = length(d) - r.z;
          float foamy = 0.3 + rough * 0.5 + r.w;
          float ring = step(dist, 0.18 + foamy * 0.35 * (0.6 + 0.4 * noise(p * 2.0 + uTime))) * step(-0.2, dist);
          float len = r.z * (2.5 + foamy * 5.0);
          float wake = step(0.0, along) * step(along, len) * step(abs(across), r.z * (1.1 - along / len * 0.6));
          float streaks = step(0.55, noise(vec2(across * 3.0, along * 1.2 - uTime * speed * 1.2)));
          col = mix(col, col * 0.78, wake * (1.0 - streaks) * 0.6); // the eddy behind it, darker
          col = mix(col, vec3(0.9, 0.96, 0.96), max(ring, wake * streaks * (1.0 - along / len)));
        }

        // holes: a dark trough, then a band of water boiling back on itself
        for (int k = 0; k < ${MAX_HOLES}; k++) {
          vec4 h = uHoles[k];
          if (h.z <= 0.0) continue;
          vec2 d = vWorld.xz - h.xy;
          float along = dot(d, dir);
          float across = abs(dot(d, vec2(-dir.y, dir.x)));
          float inside = step(across, h.z + noise(p * 1.5) * 0.4);
          float trough = step(-1.6, along) * step(along, -0.5) * inside;
          float boil = step(-0.6, along) * step(along, 0.9 + h.w * 0.5) * inside;
          float churn = step(0.35, noise(vec2(across * 3.0, along * 3.0 + uTime * 5.0)) + noise(p * 3.0 - uTime * 2.0) * 0.4);
          col = mix(col, col * 0.62, trough);
          col = mix(col, mix(vec3(0.78, 0.9, 0.92), vec3(0.97, 1.0, 1.0), churn), boil);
        }

        // sparkles in the sun, and raindrop rings
        vec2 cell = floor(vWorld.xz * 2.0);
        float glint = step(0.996, hash(cell + floor(uTime * 2.0 + s * 0.0)));
        col += vec3(0.6) * glint * (1.0 - uNight * 0.6) * (1.0 - uRain);
        if (uRain > 0.0) {
          vec2 rc = floor(vWorld.xz * 0.8);
          float phase = fract(uTime * 1.1 + hash(rc));
          vec2 centre = (rc + 0.2 + 0.6 * vec2(hash(rc + 1.7), hash(rc + 4.3))) / 0.8;
          float ring = step(abs(length(vWorld.xz - centre) - phase * 0.5), 0.07) * step(hash(rc + floor(uTime * 1.1 + hash(rc)) * 0.13), uRain * 0.8);
          col = mix(col, vec3(0.78, 0.9, 0.92), ring * (1.0 - phase) * 0.7);
        }

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
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      index.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRiver', new THREE.BufferAttribute(river, 4));
  geo.setAttribute('aMore', new THREE.BufferAttribute(more, 4));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  return mesh;
}
