import * as THREE from 'three';
import type { IslandInfo } from './island';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
`;

/**
 * The sea: one big plane. Colour comes from a baked distance-to-shore map (turquoise shallows
 * fading to deep blue), plus animated foam bands, caustic squiggles and sparkles. Everything
 * is evaluated on a world-space grid so it pixelates cleanly. When the wind gets up, real waves
 * roll through it downwind: a gentle swell on a breezy day, big breaking rollers in a storm,
 * calming down in the shallows so the island stays dry. In a hard freeze, a shelf of ice creeps
 * out from the shore, with the swell stilled under it.
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
      uRain: { value: 0 }, // 0..1: raindrop rings on the sea, and no sun glints
      uWind: { value: 0 }, // 0 calm … 1 gale: whitecaps and a restless shore
      uSea: { value: 0 }, // 0 a millpond … 1 a storm: how high the waves are
      uWindDir: { value: new THREE.Vector2(1, 0) }, // which way the waves roll (blender x, y; unit)
      uAurora: { value: 0 }, // 0..1: the northern lights, reflected
      uMeteor: { value: new THREE.Vector4() }, // a shooting star's reflection: head (x, y) and tail (dx, dy)
      uMeteorA: { value: 0 }, // …and how bright it is
      uIce: { value: 0 }, // 0..1: how far ice reaches out from the shore
    },
  ]);
  uniforms.tShore.value = shore;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D tShore;
      uniform vec4 uExtent;
      uniform float uSea;
      uniform vec2 uWindDir;
      uniform float uIce;
      varying vec3 vWorld;
      varying float vWave; // -1 trough … 1 crest
      varying float vFace; // the wave's slope towards the wind: >0 on the back, <0 on the face
      varying float vRoll; // 0..1: a roller standing up in the shallows
      varying float vRun; // 0..1: the sea running up over the beach
      #include <fog_pars_vertex>
      ${NOISE}

      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec2 p = vec2(w.x, -w.z);
        vec2 uv = (p - uExtent.xy) / uExtent.zw;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float d = mix(1.0, texture2D(tShore, uv).r, inside);

        // out at sea: three wave trains, a long swell straight downwind and two shorter ones a
        // little off it, lifted into sets by a slow noise so the crests break up
        vec2 dir = uWindDir;
        vec2 dirL = vec2(dir.x * 0.88 - dir.y * 0.47, dir.x * 0.47 + dir.y * 0.88);
        vec2 dirR = vec2(dir.x * 0.9 + dir.y * 0.43, -dir.x * 0.43 + dir.y * 0.9);
        float amp = (0.04 + uSea * uSea * 1.5) * (0.55 + 0.9 * noise(p * 0.025 - dir * uTime * 0.12));
        float speed = 1.2 + uSea * 2.2;
        float a1 = dot(p, dir) * 0.42 - uTime * speed * 0.42 + noise(p * 0.04) * 3.0;
        float a2 = dot(p, dirL) * 0.8 - uTime * speed * 0.62;
        float a3 = dot(p, dirR) * 1.3 - uTime * speed * 0.85;
        float crest = sin(a1 + 0.9 * cos(a1) * uSea); // sharp crests, long flat troughs
        float h = sin(a1) * 0.7 + sin(a2) * 0.22 + sin(a3) * 0.08 + crest * crest * crest * 0.25 * uSea;
        float face = cos(a1) * 0.7 + cos(a2) * 0.35;

        // nearer in, the waves turn to come straight at the beach, and the shallows make them
        // stand up taller and steeper until they break
        float open = smoothstep(0.2, 0.55, d);
        float rp = d * 24.0 + uTime * (1.3 + uSea * 0.9) + noise(p * 0.07) * 3.0;
        float roller = pow(0.5 + 0.5 * sin(rp), 3.0);
        float shoal = (1.0 - open) * smoothstep(0.0, 0.04, d) * (1.4 - d * 1.5);
        vRoll = roller * shoal * step(0.2, uSea);
        h = mix(h * 0.35, h, open);
        face = mix(-cos(rp), face, open);

        // and then the sea surges up the sand, and drains back: a quick rise and a slow retreat,
        // each stretch of beach in its own time. The terrain hides it wherever it stands higher.
        float s = fract(uTime * (0.1 + uSea * 0.06) + noise(p * 0.05) * 0.8);
        float surge = smoothstep(0.0, 0.18, s) * (1.0 - smoothstep(0.18, 1.0, s));
        float run = uSea * uSea * surge * (1.0 - smoothstep(0.0, 0.1, d));
        // under the ice the sea lies still
        float still = 1.0 - step(d, uIce * (0.055 + 0.045 * noise(p * 0.18)) + 0.01) * step(0.001, uIce);
        run *= still;
        vRun = run;

        vWave = mix(roller * 2.0 - 1.0, h, open);
        vFace = face;
        vRoll *= still;
        w.y += (h * amp + roller * shoal * uSea * 1.1) * still + run * 0.45;
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
      uniform float uRain;
      uniform float uWind;
      uniform float uSea;
      uniform vec2 uWindDir;
      uniform float uAurora;
      uniform vec4 uMeteor;
      uniform float uMeteorA;
      uniform float uIce;
      varying vec3 vWorld;
      varying float vWave;
      varying float vFace;
      varying float vRoll;
      varying float vRun;
      #include <fog_pars_fragment>
      ${NOISE}

      void main() {
        // blender coords: x east, y north = -z
        vec2 p = vec2(vWorld.x, -vWorld.z);
        vec2 uv = (p - uExtent.xy) / uExtent.zw;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float d = mix(1.0, texture2D(tShore, uv).r, inside);   // 0 at the coast … 1 far out

        vec3 shallow = vec3(0.22, 0.78, 0.66);
        vec3 mid = vec3(0.05, 0.40, 0.52);
        vec3 deep = vec3(0.03, 0.17, 0.33);
        float wob = (noise(p * 0.35 + uTime * (0.05 + uWind * 0.2)) - 0.5) * (0.08 + uWind * 0.1);
        float t = clamp(d + wob, 0.0, 1.0);
        vec3 col = mix(shallow, mid, smoothstep(0.0, 0.25, t));
        col = mix(col, deep, smoothstep(0.2, 0.8, t));
        // out in the open, slow patches of darker and lighter water so the deep isn't one flat blue
        float blot = noise(p * 0.045 + vec2(uTime * 0.012, -uTime * 0.008)) + noise(p * 0.11 - uTime * 0.02) * 0.5;
        col *= 1.0 + (floor(blot * 3.0) / 3.0 - 0.5) * 0.22 * smoothstep(0.3, 0.9, t);
        // stepped bands, like a hand-picked palette
        col = floor(col * 14.0 + 0.5) / 14.0;

        // caustic squiggles in the shallows
        float c = abs(noise(p * 0.9 + vec2(uTime * 0.15, -uTime * 0.1)) - 0.5);
        col += vec3(0.10, 0.14, 0.10) * step(c, 0.03) * (1.0 - smoothstep(0.05, 0.3, d));

        // little wave dashes, the way a pixel artist draws the sea: a light crest over a dark
        // trough, each one swelling and fading in its own time
        vec2 wsize = vec2(3.2, 1.3);
        vec2 wp = p / wsize;
        wp.x += hash(vec2(floor(wp.y), 5.0)) * 3.0; // stagger the rows so no grid shows
        vec2 wcell = floor(wp);
        vec2 wl = wp - wcell;
        float wh = hash(wcell);
        float wphase = fract(uTime * (0.18 + wh * 0.1) + wh * 7.0);
        float wlen = sin(wphase * 3.14159) * (0.12 + 0.16 * hash(wcell + 3.1));
        float wAlong = step(abs(wl.x - 0.5), wlen);
        float wy = wl.y * wsize.y;
        float open = step(0.62, wh) * smoothstep(0.12, 0.3, d) * (1.0 - uRain * 0.7) * (1.0 - uSea * 0.8);
        col = mix(col, col * 0.84, wAlong * step(abs(wy - 0.42), 0.13) * open);
        col = mix(col, mix(col, vec3(0.55, 0.85, 0.95), 0.4), wAlong * step(abs(wy - 0.68), 0.13) * open);

        // the waves: in stepped bands, lit on their backs and crests, dark in the troughs and on
        // the steep faces; the rougher the sea, the greyer and darker it gets
        vec2 dir = uWindDir;
        float along = dot(p, dir);
        float across = dot(p, vec2(-dir.y, dir.x));
        float rough = smoothstep(0.1, 0.3, d) * uSea;
        float lit = floor(clamp(vWave * 0.6 + vFace * 0.25, -1.0, 1.0) * 2.5 + 0.5) / 2.5;
        col *= 1.0 + lit * (0.06 + uSea * 0.14) * smoothstep(0.02, 0.2, d);
        col = mix(col, vec3(0.13, 0.22, 0.27) * (1.0 + lit * 0.25), rough * 0.45);
        // whitecaps: foam spilling off the tops of the crests, more of it the harder it blows
        float breaking = step(0.9 - uSea * 0.2, vWave) * step(0.76 - uSea * 0.22, noise(p * 1.6 + dir * uTime * 0.6));
        col = mix(col, vec3(0.9, 0.96, 0.95), breaking * smoothstep(0.08, 0.3, d) * min(1.0, max(uWind, uSea) * 1.6));
        // in a gale, long streaks of foam blown out along the wind
        float streak = step(0.8 - uSea * 0.12, noise(vec2(across * 1.6, along * 0.06 - uTime * 0.4)));
        streak *= step(0.35, noise(vec2(along * 0.3 - uTime * 1.5, across * 0.5)));
        col = mix(col, vec3(0.82, 0.9, 0.9), streak * smoothstep(0.55, 0.9, uSea) * smoothstep(0.1, 0.3, d) * 0.6);

        // foam: a line hugging the coast and a second one breathing in and out (surging in a gale)
        float breathe = sin(uTime * (0.9 + uWind * 0.9)) * (0.012 + uWind * 0.02);
        float foam = step(d, 0.012 + uSea * 0.03 + breathe * 0.5);
        foam = max(foam, step(abs(d - (0.045 + breathe)), 0.006) * step(0.45, noise(p * 1.2 + uTime * 0.2)));
        // rough seas: rollers marching in to the beach one after another and breaking into
        // a churned white band along the coast
        for (int k = 0; k < 3; k++) {
          float roll = fract(uTime * 0.16 + float(k) / 3.0 + noise(p * 0.05) * 0.4);
          float at = (1.0 - roll) * 0.14;
          foam = max(foam, step(abs(d - at), 0.004 + roll * 0.006) * step(0.3 + roll * 0.4, noise(p * 0.9 + float(k) * 7.0)) * step(0.25, uSea));
        }
        // rollers: dark green-blue as they stand up, then white where they tip over and break
        col = mix(col, vec3(0.16, 0.42, 0.44), smoothstep(0.2, 0.5, vRoll) * 0.35);
        foam = max(foam, step(0.85, vRoll) * step(0.4, noise(p * 1.3 + vec2(uTime * 0.7))));
        // the wash on the beach: churned white water with the sand-coloured sea showing through
        float wash = step(0.02, vRun) * step(0.62 - vRun * 0.25, noise(p * 1.6 - uTime * vec2(0.9, 0.4)));
        col = mix(col, vec3(0.45, 0.72, 0.66), step(0.02, vRun));
        foam = mix(max(foam, wash), wash, step(0.02, vRun) * step(d, 0.004)); // over the sand, only the wash
        col = mix(col, vec3(0.92, 0.97, 0.94), foam * inside);

        // ice: a pale shelf along the coast with a ragged edge, darker patches and cracks, a
        // white rim where it meets open water, and a few loose floes just beyond
        float iced = 0.0;
        if (uIce > 0.001) {
          float edge = uIce * (0.055 + 0.045 * noise(p * 0.18));
          float shelf = step(d, edge);
          float floe = step(d, edge + 0.025 * uIce) * step(0.74, noise(floor(p * 1.5) / 1.5 * 0.9 + 3.7));
          iced = max(shelf, floe) * inside;
          vec3 ice = mix(vec3(0.7, 0.82, 0.9), vec3(0.8, 0.9, 0.95), step(0.5, noise(p * 0.45)));
          ice = mix(ice, vec3(0.55, 0.68, 0.8), step(abs(noise(p * 0.7 + 11.0) - 0.5), 0.02));
          ice = mix(ice, vec3(0.94, 0.97, 1.0), step(edge - 0.004, d) * shelf);
          col = mix(col, ice, iced);
        }

        // sparkles: sun glints by day, moonlight by night
        vec2 cell = floor(p * 2.0);
        float glint = step(0.9975, hash(cell + floor(uTime * 1.5)));
        col += vec3(1.0) * glint * (1.0 - uNight * 0.6) * 0.6 * (1.0 - uRain) * (1.0 - iced * 0.5);

        // rain: little rings spreading where drops land, one per cell now and then
        if (uRain > 0.0) {
          vec2 rc = floor(p * 0.6);
          float phase = fract(uTime * 0.9 + hash(rc));
          vec2 centre = (rc + 0.2 + 0.6 * vec2(hash(rc + 1.7), hash(rc + 4.3))) / 0.6;
          float ring = step(abs(length(p - centre) - phase * 0.7), 0.09) * step(hash(rc + floor(uTime * 0.9 + hash(rc)) * 0.13), uRain * 0.8);
          col = mix(col, vec3(0.75, 0.88, 0.9), ring * (1.0 - phase) * 0.7 * (1.0 - iced));
        }
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

        // the northern lights: green curtains, violet at their hems, stretched into long
        // shimmering columns by the water; strongest out to the north
        if (uAurora > 0.0) {
          float row = floor(p.y * 2.0);
          float sway = (hash(vec2(row, floor(uTime * 2.0))) - 0.5) * 0.8;
          float x = p.x + sway;
          // folds: the ridges of a slow noise, drawn out into long columns by the water
          float fold = 1.0 - abs(noise(vec2(x * 0.22 + uTime * 0.05, p.y * 0.02 - uTime * 0.02)) - 0.5) * 2.0;
          fold *= 0.8 + 0.2 * noise(vec2(x * 0.9, uTime * 0.3));
          float north = smoothstep(-35.0, 25.0, p.y);
          float glow = floor(smoothstep(0.72, 0.95, fold) * north * 3.0 + 0.3) / 3.0;
          vec3 hue = mix(vec3(0.35, 1.0, 0.62), vec3(0.72, 0.45, 1.0), smoothstep(0.55, 0.85, noise(vec2(x * 0.05, p.y * 0.03 + 9.0))));
          col = mix(col, hue * 0.7, glow * uAurora * 0.45);
        }

        // a shooting star, reflected: a bright head and a tail that fades behind it
        if (uMeteorA > 0.0) {
          vec2 tail = uMeteor.zw;
          float len = length(tail);
          vec2 dir = tail / len;
          vec2 d = p - uMeteor.xy;
          float along = dot(d, dir) / len;
          float across = abs(d.x * dir.y - d.y * dir.x);
          float on = step(0.0, along) * step(along, 1.0) * step(across, 0.22 - along * 0.14);
          col = mix(col, vec3(1.0, 0.97, 0.86), on * (1.0 - along) * uMeteorA);
        }

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });

  // dense enough for the waves to have shape: the vertices crowd in around the island (half a
  // metre apart) and spread out towards the horizon
  const geo = new THREE.PlaneGeometry(2, 2, 400, 400);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const warp = (u: number) => (300 * Math.sinh(3 * u)) / Math.sinh(3);
  for (let i = 0; i < pos.count; i++) pos.setXY(i, warp(pos.getX(i)), warp(pos.getY(i)));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  return { mesh, uniforms: mat.uniforms };
}
