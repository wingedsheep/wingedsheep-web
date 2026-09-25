import * as THREE from 'three';
import type { Island } from './island';
import type { PixelRenderer } from './pixel-renderer';
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
}

const NIGHT: Mood = { sun: '#9fb2ff', sunI: 1.5, sky: '#6a7cc4', ground: '#34325a', hemiI: 1.25, fog: '#1a2244', lamps: 1, grade: [0.9, 1.05, 1.0] };
const DAWN: Mood = { sun: '#ffb38a', sunI: 1.3, sky: '#c29ac4', ground: '#5a4660', hemiI: 0.8, fog: '#d9a3b0', lamps: 0.45, grade: [1.0, 1.02, 1.0] };
const DAY: Mood = { sun: '#fff4dd', sunI: 2.4, sky: '#bfe0ff', ground: '#6b7a4a', hemiI: 0.95, fog: '#a8d4e6', lamps: 0, grade: [1.08, 1.02, 1.02] };
const GOLDEN: Mood = { sun: '#ffb366', sunI: 2.0, sky: '#f0b08a', ground: '#6a4a3a', hemiI: 0.8, fog: '#f2b184', lamps: 0.25, grade: [1.15, 1.04, 1.02] };
const DUSK: Mood = { sun: '#d86a8a', sunI: 0.9, sky: '#6a5a9a', ground: '#2f2440', hemiI: 0.75, fog: '#5a4a80', lamps: 0.8, grade: [1.0, 1.05, 0.98] };

// keyed by the sun's elevation in degrees; mornings and evenings get different colours
const RISING: [number, Mood][] = [[-10, NIGHT], [0, DAWN], [10, DAY]];
const SETTING: [number, Mood][] = [[-11, NIGHT], [-4, DUSK], [5, GOLDEN], [14, DAY]];

interface Blend {
  sun: THREE.Color;
  sunI: number;
  sky: THREE.Color;
  ground: THREE.Color;
  hemiI: number;
  fog: THREE.Color;
  lamps: number;
  grade: [number, number, number];
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
  halo: THREE.Sprite;
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
  readonly sun = new THREE.DirectionalLight();
  readonly hemi = new THREE.HemisphereLight();
  private where = visitorLocation();
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
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: halo, color: m.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
      }));
      sprite.position.copy(m.position);
      sprite.scale.setScalar(m.radius * 0.55);
      sprite.renderOrder = 2;
      scene.add(light, sprite);
      this.lampsList.push({ light, halo: sprite, base: m.intensity * 7, flicker: m.flicker, day: m.day, seed: Math.random() * 100 });
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

  update(dt: number) {
    this.clock += dt;
    const now = Date.now();
    const { lat, lon } = this.where;
    const { alt, az } = sunPosition(now, lat, lon);
    const climb = sunPosition(now + 6e5, lat, lon).alt - sunPosition(now - 6e5, lat, lon).alt;
    const m = moodFor(alt, climb);
    this.lamps = m.lamps;

    // the sun where it really is (south = +z, east = +x), kept lowish for long, readable shadows;
    // through twilight the same light slides over to play the moon
    const el = THREE.MathUtils.clamp(alt * (Math.PI / 180), 0.2, 0.9);
    const sunPos = new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(90);
    this.sun.position.copy(sunPos.lerp(MOON, THREE.MathUtils.smoothstep(-alt, 2, 8)));
    this.sun.color.copy(m.sun);
    this.sun.intensity = m.sunI;
    this.hemi.color.copy(m.sky);
    this.hemi.groundColor.copy(m.ground);
    this.hemi.intensity = m.hemiI;
    (this.scene.fog as THREE.Fog).color.copy(m.fog);
    this.scene.background = m.fog;
    this.pixels.uniforms.uGrade.value.set(...m.grade);

    for (const l of this.lampsList) {
      const f = l.flicker ? 1 - l.flicker * 0.25 * (Math.sin(this.clock * 13 + l.seed) * 0.5 + Math.sin(this.clock * 7.7 + l.seed * 3) * 0.5 + 0.5) : 1;
      const on = l.day ? Math.max(m.lamps, 0.35) : m.lamps;
      l.light.intensity = l.base * on * f;
      (l.halo.material as THREE.SpriteMaterial).opacity = on * f;
      l.halo.visible = on > 0.02;
    }
    for (const mat of glowMaterials()) mat.emissiveIntensity = 0.2 + m.lamps * 1.3;

    this.beam.rotation.y = this.clock * 0.6;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.1 * m.lamps;
    this.beam.visible = m.lamps > 0.05;

    // the sea takes the sky's colour, and darkens with the light
    this.water.uLight.value.copy(m.sky).lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(0.3 + m.sunI * 0.29);
    this.water.uNight.value = m.lamps;
  }
}

