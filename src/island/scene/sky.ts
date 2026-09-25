import * as THREE from 'three';
import type { Island } from './island';
import type { PixelRenderer } from './pixel-renderer';
import { season } from './season';
import { sunPosition, visitorLocation } from './sun';
import { glowMaterials } from './toon';

const MOON = new THREE.Vector3(35, 63, 52); // high in the south

/** How the island looks under a given sun. Between keys, moods are interpolated. */
interface Mood {
  sun: string; // direct light colour
  sunI: number;
  sky: string; // hemisphere: light from above
  ground: string; // …and bounced from below
  hemiI: number;
  fog: string;
  lamps: number; // 0 = off … 1 = full night glow
  grade: [number, number, number]; // saturation, contrast, brightness
  shade: string; // split tone: the hue shadows lean towards…
  light: string; // …and the lit parts (both multipliers around white)
}

const NIGHT: Mood = { sun: '#9fb2ff', sunI: 1.5, sky: '#6a7cc4', ground: '#34325a', hemiI: 1.25, fog: '#1a2244', lamps: 1, grade: [0.9, 1.05, 1.0], shade: '#c8d4ff', light: '#ffe6c0' };
const DAWN: Mood = { sun: '#ffb38a', sunI: 1.3, sky: '#c29ac4', ground: '#5a4660', hemiI: 0.8, fog: '#d9a3b0', lamps: 0.45, grade: [1.0, 1.02, 1.0], shade: '#d2c8ff', light: '#fff0e0' };
const DAY: Mood = { sun: '#fff4e2', sunI: 2.45, sky: '#cad9f2', ground: '#838a68', hemiI: 1.15, fog: '#b4dcee', lamps: 0, grade: [0.97, 1.02, 1.02], shade: '#d4dcff', light: '#fff4e2' };
const GOLDEN: Mood = { sun: '#ffaa5c', sunI: 3.1, sky: '#aaa8e0', ground: '#7a5a64', hemiI: 1.1, fog: '#f2b184', lamps: 0.25, grade: [1.05, 1.06, 1.03], shade: '#bcb8ff', light: '#ffe4bc' };
const DUSK: Mood = { sun: '#e07a9a', sunI: 1.1, sky: '#7a6ab4', ground: '#3a2c50', hemiI: 0.95, fog: '#5a4a80', lamps: 0.8, grade: [1.0, 1.05, 1.0], shade: '#b4bcff', light: '#ffe4dc' };

// keyed by the sun's elevation in degrees; mornings and evenings get different colours
const RISING: [number, Mood][] = [[-10, NIGHT], [0, DAWN], [10, DAY]];
const SETTING: [number, Mood][] = [[-11, NIGHT], [-4, DUSK], [6, GOLDEN], [20, DAY]];

interface Blend {
  sun: THREE.Color;
  sunI: number;
  sky: THREE.Color;
  ground: THREE.Color;
  hemiI: number;
  fog: THREE.Color;
  lamps: number;
  grade: [number, number, number];
  shade: THREE.Color;
  light: THREE.Color;
}

const blend = (a: Mood | Blend, b: Mood | Blend, t: number): Blend => {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const col = (x: string | THREE.Color, y: string | THREE.Color) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return {
    sun: col(a.sun, b.sun),
    sunI: lerp(a.sunI, b.sunI),
    sky: col(a.sky, b.sky),
    ground: col(a.ground, b.ground),
    hemiI: lerp(a.hemiI, b.hemiI),
    fog: col(a.fog, b.fog),
    lamps: lerp(a.lamps, b.lamps),
    grade: a.grade.map((v, k) => lerp(v, b.grade[k])) as [number, number, number],
    shade: col(a.shade, b.shade),
    light: col(a.light, b.light),
  };
};

function moodAt(keys: [number, Mood][], alt: number) {
  const i = keys.findIndex(([k]) => alt < k);
  if (i === 0) return blend(keys[0][1], keys[0][1], 0);
  if (i < 0) return blend(keys[keys.length - 1][1], keys[keys.length - 1][1], 0);
  const [a0, a] = keys[i - 1];
  const [a1, b] = keys[i];
  return blend(a, b, (alt - a0) / (a1 - a0));
}

/** The mood for the sun's elevation, leaning on the morning or evening palette by where it's heading. */
function moodFor(alt: number, climb: number) {
  const rising = THREE.MathUtils.clamp(0.5 + climb, 0, 1); // climb: degrees gained over 20 minutes
  return blend(moodAt(SETTING, alt), moodAt(RISING, alt), rising);
}

/**
 * The year's colour on top of the day's: a fresh, bright spring, a warm autumn light, a cool,
 * pale winter. Each is a hue the sunlight leans towards and a grade (saturation, contrast, brightness).
 */
const SEASON_LIGHT = {
  spring: { sun: '#fff8e0', k: 0.1, grade: [1.06, 1.0, 1.02] },
  summer: { sun: '#ffffff', k: 0, grade: [1.0, 1.0, 1.0] },
  autumn: { sun: '#ffc890', k: 0.16, grade: [1.04, 1.03, 0.99] },
  winter: { sun: '#dbe6ff', k: 0.2, grade: [0.86, 1.02, 1.01] },
} as const;

const seasonLight = (() => {
  const sun = new THREE.Color(0, 0, 0);
  const grade = new THREE.Vector3();
  let k = 0;
  for (const [name, w] of Object.entries(season.weights) as [keyof typeof SEASON_LIGHT, number][]) {
    const l = SEASON_LIGHT[name];
    sun.add(new THREE.Color(l.sun).multiplyScalar(w));
    grade.add(new THREE.Vector3(...l.grade).multiplyScalar(w));
    k += l.k * w;
  }
  return { sun, grade, k };
})();

/** A stepped radial halo: fake bloom that stays pixel-crisp. */
export function haloTexture(): THREE.Texture {
  const s = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - s / 2, y + 0.5 - s / 2) / (s / 2);
      const a = d >= 1 ? 0 : [0.55, 0.3, 0.16, 0.07][Math.floor(d * 4)];
      img.data.set([255, 255, 255, a * 255], (y * s + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  return tex;
}

interface Lamp {
  light: THREE.PointLight;
  halo?: THREE.Sprite;
  base: number;
  flicker: number;
  day: boolean;
  seed: number;
}

/**
 * Sun, moon, sky and every lamp on the island, following the real sun where the visitor is.
 */
export class Sky {
  lamps = 0;
  /** The sun's elevation in degrees. */
  alt = 0;
  /** Whether the sun is climbing: morning rather than evening. */
  rising = true;
  readonly sun = new THREE.DirectionalLight();
  readonly hemi = new THREE.HemisphereLight();
  private where = visitorLocation();
  /** To preview another time of day: ?time=22:30 (the visitor's local time, today). */
  private shift = (() => {
    try {
      const m = new URLSearchParams(location.search).get('time')?.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return 0;
      const at = new Date();
      at.setHours(Number(m[1]), Number(m[2]), 0, 0);
      return at.getTime() - Date.now();
    } catch {
      return 0;
    }
  })();
  private clock = 0;
  private lampsList: Lamp[] = [];
  private beam: THREE.Mesh;

  constructor(
    private scene: THREE.Scene,
    island: Island,
    private pixels: PixelRenderer,
    private water: { [k: string]: THREE.IUniform },
  ) {
    scene.fog = new THREE.Fog(0xa8d4e6, 150, 260);
    const s = this.sun;
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    Object.assign(s.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 220 });
    s.shadow.bias = -0.0008;
    s.shadow.normalBias = 0.03;
    scene.add(s, s.target, this.hemi);

    const halo = haloTexture();
    for (const m of island.lights) {
      const light = new THREE.PointLight(m.color, 0, m.radius * 1.8, 1.4);
      light.position.copy(m.position);
      scene.add(light);
      const lamp: Lamp = { light, base: m.intensity * 7, flicker: m.flicker, day: m.day, seed: Math.random() * 100 };
      this.lampsList.push(lamp);
      if (!m.halo) continue;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: halo, color: m.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
      }));
      sprite.position.copy(m.position);
      sprite.scale.setScalar(m.radius * 0.55);
      sprite.renderOrder = 2;
      scene.add(sprite);
      lamp.halo = sprite;
    }

    // the lighthouse sweeps a pale beam over the sea at night
    const lantern = island.part('lighthouse', 'beam');
    const beamGeo = new THREE.ConeGeometry(4, 40, 12, 1, true).rotateZ(Math.PI / 2).translate(20, 0, 0);
    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xfff1b0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    this.beam.renderOrder = 3;
    this.beam.raycast = () => {};
    lantern?.getWorldPosition(this.beam.position);
    scene.add(this.beam);
  }

  /** The time it is on the island: now, or the hour ?time= asked for. */
  get time() {
    return Date.now() + this.shift;
  }

  update(dt: number) {
    this.clock += dt;
    const now = this.time;
    const { lat, lon } = this.where;
    const { alt, az } = sunPosition(now, lat, lon);
    const climb = sunPosition(now + 6e5, lat, lon).alt - sunPosition(now - 6e5, lat, lon).alt;
    const m = moodFor(alt, climb);
    this.lamps = m.lamps;
    this.alt = alt;
    this.rising = climb > 0;

    // the sun where it really is (south = +z, east = +x), kept lowish for long, readable shadows;
    // through twilight the same light slides over to play the moon
    const el = THREE.MathUtils.clamp(alt * (Math.PI / 180), 0.16, 0.9);
    const sunPos = new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(90);
    this.sun.position.copy(sunPos.lerp(MOON, THREE.MathUtils.smoothstep(-alt, 2, 8)));
    this.sun.color.copy(m.sun);
    this.sun.intensity = m.sunI;
    this.hemi.color.copy(m.sky);
    this.hemi.groundColor.copy(m.ground);
    this.hemi.intensity = m.hemiI;
    (this.scene.fog as THREE.Fog).color.copy(m.fog);
    this.scene.background = m.fog;
    const u = this.pixels.uniforms;
    u.uGrade.value.set(...m.grade).multiply(seasonLight.grade);
    u.uShade.value.copy(m.shade);
    u.uLight.value.copy(m.light);
    u.uTone.value = 1;
    u.uVignette.value = 0.7;
    this.sun.color.lerp(seasonLight.sun, seasonLight.k * (1 - m.lamps));

    for (const l of this.lampsList) {
      const f = l.flicker ? 1 - l.flicker * 0.25 * (Math.sin(this.clock * 13 + l.seed) * 0.5 + Math.sin(this.clock * 7.7 + l.seed * 3) * 0.5 + 0.5) : 1;
      const on = l.day ? Math.max(m.lamps, 0.35) : m.lamps;
      l.light.intensity = l.base * on * f;
      if (!l.halo) continue;
      (l.halo.material as THREE.SpriteMaterial).opacity = on * f;
      l.halo.visible = on > 0.02;
    }
    for (const mat of glowMaterials()) mat.emissiveIntensity = 0.2 + m.lamps * 1.3;

    this.beam.rotation.y = this.clock * 0.6;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.1 * m.lamps;
    this.beam.visible = m.lamps > 0.05;

    // the sea takes the sky's colour, and darkens with the light
    this.water.uLight.value.copy(m.sky).lerp(m.sun, 0.3).lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(0.3 + Math.min(m.sunI, 2.5) * 0.29);
    this.water.uNight.value = m.lamps;
  }
}

