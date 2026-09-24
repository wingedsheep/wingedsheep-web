import * as THREE from 'three';
import type { Island } from './island';
import type { PixelRenderer } from './pixel-renderer';
import { glowMaterials } from './toon';

/** How the island looks at an hour of the day. In-between hours are interpolated. */
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

const KEYS: [number, Mood][] = [
  [0, { sun: '#9fb2ff', sunI: 1.5, sky: '#6a7cc4', ground: '#34325a', hemiI: 1.25, fog: '#1a2244', lamps: 1, grade: [0.9, 1.05, 1.0] }],
  [5, { sun: '#9fb2ff', sunI: 1.5, sky: '#6a7cc4', ground: '#34325a', hemiI: 1.25, fog: '#1a2244', lamps: 1, grade: [0.9, 1.05, 1.0] }],
  [6.4, { sun: '#ffb38a', sunI: 1.3, sky: '#c29ac4', ground: '#5a4660', hemiI: 0.8, fog: '#d9a3b0', lamps: 0.45, grade: [1.0, 1.02, 1.0] }],
  [8, { sun: '#fff1d6', sunI: 2.3, sky: '#bfe0ff', ground: '#6b7a4a', hemiI: 0.95, fog: '#a8d4e6', lamps: 0, grade: [1.08, 1.02, 1.02] }],
  [16.5, { sun: '#fff4dd', sunI: 2.4, sky: '#bfe0ff', ground: '#6b7a4a', hemiI: 0.95, fog: '#a8d4e6', lamps: 0, grade: [1.08, 1.02, 1.02] }],
  [18.3, { sun: '#ffb366', sunI: 2.0, sky: '#f0b08a', ground: '#6a4a3a', hemiI: 0.8, fog: '#f2b184', lamps: 0.25, grade: [1.15, 1.04, 1.02] }],
  [19.6, { sun: '#d86a8a', sunI: 0.9, sky: '#6a5a9a', ground: '#2f2440', hemiI: 0.75, fog: '#5a4a80', lamps: 0.8, grade: [1.0, 1.05, 0.98] }],
  [21, { sun: '#9fb2ff', sunI: 1.5, sky: '#6a7cc4', ground: '#34325a', hemiI: 1.25, fog: '#1a2244', lamps: 1, grade: [0.9, 1.05, 1.0] }],
  [24, { sun: '#9fb2ff', sunI: 1.5, sky: '#6a7cc4', ground: '#34325a', hemiI: 1.25, fog: '#1a2244', lamps: 1, grade: [0.9, 1.05, 1.0] }],
];

export const PHASES = [
  { name: 'dawn', hour: 6.5 },
  { name: 'day', hour: 12 },
  { name: 'golden hour', hour: 18.2 },
  { name: 'dusk', hour: 19.8 },
  { name: 'night', hour: 23.5 },
] as const;

const c = (hex: string) => new THREE.Color(hex);

function moodAt(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const i = KEYS.findIndex(([k], j) => h >= k && h <= KEYS[j + 1]?.[0]);
  const [h0, a] = KEYS[Math.max(0, i)];
  const [h1, b] = KEYS[Math.max(0, i) + 1];
  const t = (h - h0) / (h1 - h0);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    sun: c(a.sun).lerp(c(b.sun), t),
    sunI: lerp(a.sunI, b.sunI),
    sky: c(a.sky).lerp(c(b.sky), t),
    ground: c(a.ground).lerp(c(b.ground), t),
    hemiI: lerp(a.hemiI, b.hemiI),
    fog: c(a.fog).lerp(c(b.fog), t),
    lamps: lerp(a.lamps, b.lamps),
    grade: a.grade.map((v, k) => lerp(v, b.grade[k])) as [number, number, number],
  };
}

/** A stepped radial halo: fake bloom that stays pixel-crisp. */
function haloTexture(): THREE.Texture {
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
 * Sun, moon, sky and every lamp on the island, driven by the visitor's local time
 * (or by the time dial).
 */
export class Sky {
  hour = localHour();
  lamps = 0;
  readonly sun = new THREE.DirectionalLight();
  readonly hemi = new THREE.HemisphereLight();
  private target: number | null = null;
  private manual = false;
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

  /** Sweep to an hour (animated), or back to the visitor's own clock with null. */
  setHour(hour: number | null) {
    this.manual = hour !== null;
    this.target = hour ?? localHour();
  }

  get isNight() {
    return this.lamps > 0.6;
  }

  update(dt: number) {
    this.clock += dt;
    if (this.target !== null) {
      const diff = (((this.target - this.hour) % 24) + 24) % 24; // always forward: sunsets are the fun part
      this.hour = (this.hour + Math.min(diff, dt * 5)) % 24;
      if (diff < 0.01) this.target = null;
    } else if (!this.manual) {
      this.hour = localHour();
    }
    const m = moodAt(this.hour);
    this.lamps = m.lamps;

    // the sun arcs east → west; at night the same light plays the moon, high in the south
    const day = this.hour > 5.5 && this.hour < 20.5;
    const t = day ? (this.hour - 5.5) / 15 : 0.5;
    const az = day ? Math.PI * t : Math.PI * 0.3; // 0 = east (+x), π = west
    const el = day ? Math.max(0.2, Math.sin(t * Math.PI) * 0.8) : 0.9; // a lowish sun: long, readable shadows
    this.sun.position.set(Math.cos(az) * 60, Math.sin(el) * 80, 40 + Math.cos(el) * 20);
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

function localHour() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}
