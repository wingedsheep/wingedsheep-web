import * as THREE from 'three';
import type { Island } from './island';
import { windDir } from './grass';
import { Particles } from './particles';
import { season } from './season';
import type { Sky } from './sky';
import type { Weather } from './weather';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

const FALLING = ['#a0392c', '#c04e30', '#cc622c', '#e08a3a', '#d4ae40', '#e9cf66'];
const MOTES = ['#ffe6a8', '#ffd98a', '#fff1c8'];
const METEOR = 0.9; // seconds a shooting star takes to cross

/**
 * The small things in the air: leaves coming down in autumn, dandelion fluff on a summer day,
 * dust motes lit up at golden hour, and at night the sky in the sea: now and then a shooting
 * star, and on a rare cold, clear night the northern lights.
 */
export class Ambience {
  private motes = new Particles(700);
  private clock = 0;
  private nextMeteor = rand(8, 30);
  private meteor = -1; // seconds into the current one
  private aurora = 0;
  /** Whether tonight is an aurora night: rare, and only when it's cold. */
  private auroraNight: boolean;
  private sea: (x: number, y: number) => boolean;

  constructor(
    scene: THREE.Scene,
    private island: Island,
    private water: { [k: string]: THREE.IUniform },
    private reducedMotion: boolean,
  ) {
    scene.add(this.motes.points);
    this.sea = seaTest(island);
    const night = Math.floor((Date.now() - 12 * 3600e3) / 864e5); // changes at noon, so one night is one roll
    const cold = season.weights.winter + season.weights.autumn * 0.3;
    let forced = false;
    try {
      forced = new URLSearchParams(location.search).has('aurora');
    } catch {}
    this.auroraNight = forced || fract(Math.sin(night * 91.7) * 43758.5) < cold * 0.2;
  }

  /** `around`: where the camera looks; `view`: how much of the world it sees (units high). */
  update(dt: number, sky: Sky, weather: Weather, around: THREE.Vector3, view: number) {
    this.clock += dt;
    this.motes.update(dt);
    const w = weather.now;
    const wet = Math.min(1, w.rain + w.snow + w.hail);
    const clear = 1 - Math.min(1, w.cloud + w.fog + wet);
    const night = sky.lamps;
    const day = 1 - night;
    const size = Math.max(20, view * 1.1);
    const drift = Math.min(weather.wind, 14);
    const { x: dx, y: dz } = windDir.value;

    if (!this.reducedMotion) {
      // autumn: leaves let go of the trees near you, one by one
      const shedding = season.turn * (1 - season.fall) + season.fall * (1 - season.fall);
      this.spawn(dt, shedding * 5 * (1 + weather.gust * 2), () => {
        const c = pick(this.island.canopies);
        if (c.squash < 1 || c.position.distanceTo(around) > size) return;
        const top = c.position.clone().add(V(rand(-1, 1), rand(-0.3, 0.5), rand(-1, 1)).multiplyScalar(c.radius));
        this.motes.emit({
          position: top,
          velocity: V(drift * 0.15 * dx + rand(-0.3, 0.3), -rand(0.5, 0.8), drift * 0.15 * dz + rand(-0.3, 0.3)),
          color: dim(pick(FALLING), night),
          life: top.y / 0.65,
          size: Math.random() < 0.5 ? 2 : 1,
          wobble: 1.6,
        });
      });
      // summer: dandelion fluff and pollen floating over the grass
      this.spawn(dt, season.fluff * day * (1 - wet) * 6, () => this.motes.emit({
        position: around.clone().add(V(rand(-size, size), rand(0.4, 2.5), rand(-size, size) * 0.7)),
        velocity: V((drift * 0.12 + rand(0.1, 0.4)) * dx + rand(-0.2, 0.2), rand(0.02, 0.15), (drift * 0.12 + rand(0.1, 0.4)) * dz + rand(-0.2, 0.2)),
        color: Math.random() < 0.7 ? '#f7f4ea' : '#f2e08a',
        life: rand(6, 10),
        wobble: 0.9,
      }));
      // golden hour: dust hanging in the low sun
      const golden = sky.alt > -1 ? Math.max(0, 1 - Math.abs(night - 0.3) / 0.22) * clear : 0;
      this.spawn(dt, golden * 10, () => this.motes.emit({
        position: around.clone().add(V(rand(-size, size) * 0.7, rand(0.3, 3), rand(-size, size) * 0.6)),
        velocity: V(rand(-0.1, 0.1), rand(-0.05, 0.08), rand(-0.1, 0.1)),
        color: pick(MOTES),
        life: rand(4, 7),
        wobble: 0.5,
      }));
    }

    this.shootingStars(dt, night * clear, around, view);
    const goal = this.auroraNight && night > 0.85 ? clear : 0;
    this.aurora = THREE.MathUtils.damp(this.aurora, goal, 0.3, dt);
    this.water.uAurora.value = this.aurora;
  }

  /** After the sky and the weather: the northern lights cast a faint green over the night. */
  shade(sky: Sky) {
    if (this.aurora > 0.01) sky.hemi.color.lerp(AURORA_LIGHT, this.aurora * 0.12);
  }

  private spawn(dt: number, rate: number, make: () => void) {
    const count = rate * dt;
    const whole = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0);
    for (let i = 0; i < whole; i++) make();
  }

  /** Every minute or so on a clear night, a streak crosses a patch of sea you're looking at. */
  private shootingStars(dt: number, dark: number, around: THREE.Vector3, view: number) {
    const u = this.water;
    if (this.meteor >= 0) {
      this.meteor += dt;
      const k = this.meteor / METEOR;
      const m = u.uMeteor.value as THREE.Vector4;
      const tail = Math.max(0.1, Math.min(1, k * 3)) * view * 0.12;
      const dir = V(m.z, m.w).normalize();
      m.x += (-dir.x * view * 0.35 * dt) / METEOR;
      m.y += (-dir.y * view * 0.35 * dt) / METEOR;
      m.z = dir.x * tail;
      m.w = dir.y * tail;
      u.uMeteorA.value = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      if (k >= 1) {
        this.meteor = -1;
        u.uMeteorA.value = 0;
      }
      return;
    }
    if (this.reducedMotion || dark < 0.75) return;
    this.nextMeteor -= dt;
    if (this.nextMeteor > 0) return;
    this.nextMeteor = rand(25, 80);
    // somewhere on open water within view (blender coordinates: y = -z)
    for (let i = 0; i < 12; i++) {
      const x = around.x + rand(-0.8, 0.8) * view;
      const y = -around.z + rand(-0.4, 0.5) * view;
      if (!this.sea(x, y)) continue;
      const a = rand(-0.6, 0.6) + (Math.random() < 0.5 ? 0 : Math.PI); // mostly sideways
      (u.uMeteor.value as THREE.Vector4).set(x, y, Math.cos(a), Math.sin(a) * 0.5);
      this.meteor = 0;
      return;
    }
  }
}

const AURORA_LIGHT = new THREE.Color('#7fe0b0');
const fract = (x: number) => x - Math.floor(x);
const DIM = new THREE.Color();
const dim = (hex: string, night: number) => DIM.set(hex).multiplyScalar(1 - night * 0.55).clone();

/** Is (x, y) open water? Read off the same distance-to-shore map the sea shader uses. */
function seaTest(island: Island) {
  const [x0, y0, x1, y1] = island.info.extent;
  const img = island.shore.image as CanvasImageSource & { width: number; height: number };
  let data: Uint8ClampedArray | null = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    data = ctx.getImageData(0, 0, img.width, img.height).data;
  } catch {}
  return (x: number, y: number) => {
    const u = (x - x0) / (x1 - x0);
    const v = (y - y0) / (y1 - y0);
    if (u < 0 || u > 1 || v < 0 || v > 1) return true;
    if (!data) return false;
    const px = Math.min(img.width - 1, Math.floor(u * img.width));
    const py = Math.min(img.height - 1, Math.floor((1 - v) * img.height));
    const i = (py * img.width + px) * 4;
    return data[i + 1] < 128 && data[i] > 20; // not land, and clear of the coast and its foam
  };
}
