import * as THREE from 'three';
import type { IslandInfo } from './island';

/**
 * The sea: one big plane. Colour comes from a baked distance-to-shore map (turquoise shallows
 * fading to deep blue), plus animated foam bands, caustic squiggles and sparkles. Everything
 * is evaluated on a world-space grid so it pixelates cleanly.
 */
export function createWater(shore: THREE.Texture, info: IslandInfo) {
  const [x0, y0, x1, y1] = info.extent;
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      tShore: { value: shore },
      uExtent: { value: new THREE.Vector4(x0, y0, x1 - x0, y1 - y0) },
      uLight: { value: new THREE.Color(1, 1, 1) }, // ambient multiplier from the day cycle
      uNight: { value: 0 },
      uMoon: { value: new THREE.Vector2(12, -28) }, // where moonlight glitters (blender x, y: south-east sea)
      uSecondMoon: { value: 0 },
    },
  ]);
  uniforms.tShore.value = shore;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D tShore;
      uniform vec4 uExtent;
      uniform vec3 uLight;
      uniform float uNight;
      uniform vec2 uMoon;
      uniform float uSecondMoon;
      varying vec3 vWorld;
      #include <fog_pars_fragment>

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }

      void main() {
        // blender coords: x east, y north = -z
        vec2 p = vec2(vWorld.x, -vWorld.z);
        vec2 uv = (p - uExtent.xy) / uExtent.zw;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float d = mix(1.0, texture2D(tShore, uv).r, inside);   // 0 at the coast … 1 far out

        vec3 shallow = vec3(0.30, 0.75, 0.70);
        vec3 mid = vec3(0.12, 0.50, 0.62);
        vec3 deep = vec3(0.07, 0.25, 0.42);
        float wob = (noise(p * 0.35 + uTime * 0.05) - 0.5) * 0.08;
        float t = clamp(d + wob, 0.0, 1.0);
        vec3 col = mix(shallow, mid, smoothstep(0.0, 0.25, t));
        col = mix(col, deep, smoothstep(0.2, 0.8, t));
        // stepped bands, like a hand-picked palette
        col = floor(col * 14.0 + 0.5) / 14.0;

        // caustic squiggles in the shallows
        float c = abs(noise(p * 0.9 + vec2(uTime * 0.15, -uTime * 0.1)) - 0.5);
        col += vec3(0.10, 0.14, 0.10) * step(c, 0.03) * (1.0 - smoothstep(0.05, 0.3, d));

        // foam: a line hugging the coast and a second one breathing in and out
        float breathe = sin(uTime * 0.9) * 0.012;
        float foam = step(d, 0.012 + breathe * 0.5);
        foam = max(foam, step(abs(d - (0.045 + breathe)), 0.006) * step(0.45, noise(p * 1.2 + uTime * 0.2)));
        col = mix(col, vec3(0.92, 0.97, 0.94), foam * inside);

        // sparkles: sun glints by day, moonlight by night
        vec2 cell = floor(p * 2.0);
        float glint = step(0.9975, hash(cell + floor(uTime * 1.5)));
        col += vec3(1.0) * glint * (1.0 - uNight * 0.6) * 0.6;
        col *= uLight;

        // moon reflections: a shimmering column on the water (sometimes two)
        for (int k = 0; k < 2; k++) {
          vec2 m = uMoon + vec2(float(k) * 5.0, float(k) * 1.5);
          float on = k == 0 ? 1.0 : uSecondMoon;
          float row = floor((p.y - m.y) * 2.0);
          float wiggle = (hash(vec2(row, floor(uTime * 3.0))) - 0.5) * 1.2;
          float width = max(0.0, 1.0 - abs(p.y - m.y) / 7.0) * 0.45;
          float band = step(abs(p.x - m.x - wiggle * 0.6), width) * step(0.5, hash(vec2(row, 7.0)));
          col = mix(col, vec3(0.95, 0.93, 0.82), band * uNight * on * 0.6 * step(abs(p.y - m.y), 7.0));
        }

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  return { mesh, uniforms: mat.uniforms };
}
