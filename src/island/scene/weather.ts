import * as THREE from 'three';
import { WEATHER_KINDS, type WeatherKind } from '../forecast';
import { Particles } from './particles';
import type { PixelRenderer } from './pixel-renderer';
import type { Sky } from './sky';
import { drought, windDir, windGust } from './grass';
import { frostCover, snowCover } from './toon';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

const DROPS = 1400;
const CLOUDS = 9;
const GREY = new THREE.Color();
const MIST = new THREE.Color('#c3ccd4');
const FLASH = new THREE.Color(0.9, 0.92, 1);
const LEAVES = ['#7fae4a', '#a7c35a', '#d9a441', '#c9713d', '#8c5a3c'];
const GOLD = new THREE.Color('#ffd9a0');
const HAZE = new THREE.Color('#efdcbc');
const ICE = new THREE.Color('#d6e6ff');
const BUTTERFLIES = ['#f7f3ea', '#f2d25c', '#f29a4a', '#9fc4f0'];
const RAINBOW = ['#9b6bd6', '#5b7fe0', '#5fb8e0', '#7cc96a', '#f2d25c', '#f29a4a', '#e4604e'];

/** Pull a colour towards its own grey. */
function mute(col: THREE.Color, k: number) {
  const l = col.r * 0.3 + col.g * 0.59 + col.b * 0.11;
  col.lerp(GREY.setRGB(l, l, l * 1.06), k);
}

type Blend = { cloud: number; shadows: number; fog: number; rain: number; fine: number; snow: number; hail: number; storm: number };
const NONE: Blend = { cloud: 0, shadows: 0, fog: 0, rain: 0, fine: 0, snow: 0, hail: 0, storm: 0 };

/**
 * What each kind of weather does at full intensity. cloud mutes the light (and, as it closes over,
 * softens every shadow), shadows are drifting cloud shadows, fine turns rain into drizzle, and
 * storm brings lightning. Under a full lid of cloud nothing drifts: it's all one even grey.
 */
const LOOKS: Record<WeatherKind, Partial<Blend>> = {
  clear: {},
  partly: { cloud: 0.15, shadows: 1 },
  cloudy: { cloud: 1 },
  windy: { cloud: 0.1, shadows: 0.7 },
  warm: {},
  hot: {},
  fog: { cloud: 0.5, fog: 1 },
  drizzle: { cloud: 0.8, fog: 0.3, rain: 0.6, fine: 1 },
  rain: { cloud: 1, fog: 0.15, rain: 1 },
  showers: { cloud: 0.35, shadows: 0.8, rain: 0.8 },
  sleet: { cloud: 0.9, fog: 0.2, rain: 0.6, snow: 0.45 },
  snow: { cloud: 0.7, fog: 0.3, snow: 1 },
  hail: { cloud: 1, fog: 0.15, rain: 0.5, hail: 1, storm: 1 },
  storm: { cloud: 1, fog: 0.2, rain: 1, storm: 1 },
};
/**
 * Each kind's colour: a hue the light leans towards (brightness is kept, so it works by night
 * too), how far it leans, and a grade (saturation, contrast, brightness multipliers).
 */
const MOODS: Record<WeatherKind, { tint: string; k: number; grade: [number, number, number] }> = {
  clear: { tint: '#ffffff', k: 0, grade: [1, 1, 1] },
  partly: { tint: '#fff0d4', k: 0.12, grade: [1.03, 1, 1] },
  cloudy: { tint: '#a9b4c2', k: 0.25, grade: [0.92, 0.97, 0.97] },
  windy: { tint: '#e2f2ff', k: 0.15, grade: [1.06, 1.05, 1.01] },
  warm: { tint: '#ffffff', k: 0, grade: [1, 1, 1] }, // warmth has its own look, see heat
  hot: { tint: '#ffffff', k: 0, grade: [1, 1, 1] },
  fog: { tint: '#dde5ea', k: 0.35, grade: [0.8, 0.9, 1.03] },
  drizzle: { tint: '#9db0b6', k: 0.3, grade: [0.86, 0.95, 0.98] },
  rain: { tint: '#7c93ad', k: 0.35, grade: [0.85, 1.02, 0.94] },
  showers: { tint: '#d6f0cc', k: 0.2, grade: [1.12, 1.04, 1.03] },
  sleet: { tint: '#a6b6c6', k: 0.35, grade: [0.8, 0.97, 0.96] },
  snow: { tint: '#d9e6ff', k: 0.4, grade: [0.82, 0.95, 1.06] },
  hail: { tint: '#8797a6', k: 0.4, grade: [0.76, 1.08, 0.9] },
  storm: { tint: '#5d7266', k: 0.45, grade: [0.72, 1.1, 0.86] },
};

const BLOW = new THREE.Vector2();
const lum = (c: THREE.Color) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
const HUE = new THREE.Color();

/** Lean a colour towards a hue without changing how bright it is. */
function tintTo(col: THREE.Color, tint: THREE.Color, k: number) {
  const l = lum(col);
  if (k <= 0 || l <= 0) return;
  col.lerp(HUE.copy(tint).multiplyScalar(l / Math.max(lum(tint), 0.01)), k);
}

const WET: WeatherKind[] = ['drizzle', 'rain', 'showers', 'sleet', 'hail', 'storm'];

/**
 * Weather over the island: cloud cover and fog laid over the Sky's light, drifting cloud
 * shadows, rain and drizzle as short pixel streaks that follow the camera, snow, sleet and
 * hail, leaves on a windy day, lightning in a storm, a rainbow when the sun comes out through
 * the rain, snow that settles on the island and melts again, and in the cold, frost overnight
 * and ice along the shore.
 * Everything eases in and out, so switching weather looks like the weather turning.
 */
export class Weather {
  kind: WeatherKind = 'clear';
  intensity = 0;
  wind = 3; // m/s
  gusts = 5; // m/s
  /** Where the wind comes from, in degrees as weather reports give it (270: a westerly). */
  direction = 250;
  temperature = 15; // °C
  /** Snow already on the ground according to the forecast, 0..1; settled snow melts back to this. */
  lying = 0;
  /** Current blend, 0..1 each. */
  readonly now = { ...NONE, flash: 0, rainbow: 0 };
  /** Called a moment after each lightning strike, for the thunder. */
  onThunder?: (distance: number) => void;

  private drops: THREE.LineSegments;
  private offsets = new Float32Array(DROPS * 3); // each drop's place in a unit box around the camera
  private speeds = new Float32Array(DROPS);
  private flakes = new Particles(2600); // snow, hail and blown leaves
  private clouds: THREE.Group[] = [];
  private rainbow: THREE.Mesh;
  /** The colour mood, eased towards the current kind's. */
  private mood = { tint: new THREE.Color(1, 1, 1), k: 0, grade: new THREE.Vector3(1, 1, 1) };
  private afterRain = 0; // seconds of rainbow left once the rain stops
  private nextStrike = 8;
  private strike = -1;

  constructor(
    scene: THREE.Scene,
    private reducedMotion: boolean,
  ) {
    for (let i = 0; i < DROPS; i++) {
      this.offsets.set([rand(-1, 1), Math.random(), rand(-1, 1)], i * 3);
      this.speeds[i] = rand(0.85, 1.15);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DROPS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.drops = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8dc, transparent: true, opacity: 0.6, depthWrite: false }));
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 4;
    this.drops.raycast = () => {};

    this.rainbow = rainbowArc();
    scene.add(this.drops, this.flakes.points, this.rainbow, ...this.makeClouds());
  }

  set(
    kind: WeatherKind,
    intensity: number,
    opts: { wind?: number; gusts?: number; direction?: number; lying?: number; temperature?: number; instant?: boolean } = {},
  ) {
    if (!WEATHER_KINDS.includes(kind)) return;
    if (WET.includes(this.kind) && !WET.includes(kind)) this.afterRain = 90;
    this.kind = kind;
    this.intensity = kind === 'clear' ? 0 : THREE.MathUtils.clamp(intensity, 0.2, 1);
    this.wind = opts.wind ?? this.wind;
    this.gusts = Math.max(opts.gusts ?? this.wind * 1.5, this.wind);
    this.direction = opts.direction ?? this.direction;
    // a storm always brings a gale with it, even if the nearest station reads it calm
    const floor = { windy: [14, 20], storm: [15, 24], hail: [12, 20] }[kind as string];
    if (floor) {
      this.wind = Math.max(this.wind, floor[0]);
      this.gusts = Math.max(this.gusts, floor[1]);
    }
    this.lying = opts.lying ?? this.lying;
    this.temperature = kind === 'warm' ? 27 : kind === 'hot' ? 36 : (opts.temperature ?? this.temperature);
    if (opts.instant) {
      // the weather was already like this before the visitor arrived
      Object.assign(this.now, this.goal());
      const mood = MOODS[kind];
      const strength = 0.5 + this.intensity * 0.5;
      this.mood.tint.set(mood.tint);
      this.mood.k = mood.k * strength;
      this.mood.grade.set(...mood.grade).lerp(new THREE.Vector3(1, 1, 1), 1 - strength);
      this.gust = windGust.value = this.windiness;
      this.swell = this.sea;
      windDir.value.copy(this.blowing());
      this.heat.warm = this.warmth;
      this.heat.scorch = this.scorch;
      this.heat.chill = this.chill;
      this.frostSnap = 1;
      snowCover.value = Math.max(this.lying, this.now.snow * 0.8);
    }
  }

  /** 0 on a calm day … 1 in a gale. */
  get windiness() {
    return THREE.MathUtils.clamp((this.wind - 6) / 9, 0, 1);
  }

  /** Windiness, eased, with the gusts coming through now and then: for the trees, grass and sound. */
  gust = 0;

  /** How rough the sea is: 0 a millpond … 1 a gale, with the gusts counting for a bit. */
  get sea() {
    const wind = this.wind + (this.gusts - this.wind) * 0.3;
    return THREE.MathUtils.clamp((wind - 3) / 15, 0, 1);
  }

  /** The sea, eased: waves take a while to build and to die down. */
  swell = 0;

  /** The way the wind blows, as a unit vector on the ground (world x, z). */
  blowing(out = new THREE.Vector2()) {
    const a = THREE.MathUtils.degToRad(this.direction);
    // from the north (0°) it blows south, which is +z
    return out.set(-Math.sin(a), Math.cos(a));
  }

  private gustLeft = 0; // seconds left in the current gust
  private gustWait = 4; // …or until the next one

  /** 0 below 20 °C … 1 from 28 °C: golden light, richer colour, butterflies. */
  get warmth() {
    return THREE.MathUtils.clamp((this.temperature - 20) / 8, 0, 1);
  }

  /** 0 below 29 °C … 1 from 36 °C: bleached colour, haze, shimmer, straw-dry grass, cicadas. */
  get scorch() {
    return THREE.MathUtils.clamp((this.temperature - 29) / 7, 0, 1);
  }

  /** 0 above 6 °C … 1 from -6 °C: breath showing, frost, icicles, ice along the shore, a crisp blue light. */
  get chill() {
    return THREE.MathUtils.clamp((6 - this.temperature) / 12, 0, 1);
  }

  /** Warmth and scorch, eased; rain and cloud take the edge off. Chill, eased (nothing takes the edge off that). */
  readonly heat = { warm: 0, scorch: 0, chill: 0 };
  private clock = 0;
  /** Seconds left in which frost jumps straight to what it should be (on arrival, before the sky has settled). */
  private frostSnap = 1;

  private goal(): Blend {
    const look = { ...NONE, ...LOOKS[this.kind] };
    const k = this.intensity;
    return {
      ...look,
      // cloud cover scales gently with intensity; precipitation fully
      cloud: look.cloud * (0.5 + k * 0.5),
      // a mostly clear sky has the odd cloud going over; a broken one, most of them
      shadows: look.shadows * k,
      rain: look.rain * k,
      snow: look.snow * k,
      hail: look.hail * k,
    };
  }

  /** `night` (0..1) dims the rain and snow and keeps the rainbow away. */
  update(dt: number, camera: THREE.Camera, around: THREE.Vector3, view: number, night: number) {
    const n = this.now;
    const goal = this.goal();
    for (const k of Object.keys(goal) as (keyof Blend)[]) n[k] = THREE.MathUtils.damp(n[k], goal[k], 0.6, dt);

    this.clock += dt;
    // gusts: every so often the wind picks up towards its gust speed for a few seconds
    if ((this.gustLeft -= dt) < 0 && (this.gustWait -= dt) < 0) {
      this.gustLeft = rand(1.5, 4);
      this.gustWait = rand(3, 12) * (1.2 - this.windiness * 0.6);
    }
    const gusting = THREE.MathUtils.clamp((this.gusts - 6) / 9, 0, 1);
    const target = this.gustLeft > 0 ? Math.max(this.windiness, gusting) : this.windiness;
    this.gust = windGust.value = THREE.MathUtils.damp(this.gust, target, this.gustLeft > 0 ? 1.2 : 0.5, dt);
    this.swell = THREE.MathUtils.damp(this.swell, this.sea, 0.08, dt);
    const dir = windDir.value;
    const goalDir = this.blowing(BLOW);
    dir.lerp(goalDir, 1 - Math.exp(-0.3 * dt)).normalize();
    const muffle = 1 - Math.min(1, n.rain + n.snow + n.cloud * 0.5);
    this.heat.warm = THREE.MathUtils.damp(this.heat.warm, this.warmth * muffle, 0.4, dt);
    this.heat.scorch = THREE.MathUtils.damp(this.heat.scorch, this.scorch * muffle, 0.4, dt);
    drought.value = this.heat.scorch;
    this.heat.chill = THREE.MathUtils.damp(this.heat.chill, this.chill, 0.4, dt);

    const size = Math.max(24, view * 1.3);
    const slant = Math.min(this.wind, 14) * 0.05; // sideways per unit fallen
    this.rain(dt, around, size, slant, night);
    this.flurries(dt, around, size, night);
    this.settle(dt);
    this.freeze(dt, night);
    this.driftClouds(dt);
    this.lightning(dt);

    const mood = MOODS[this.kind];
    const ease = 1 - Math.exp(-0.6 * dt);
    const strength = 0.5 + this.intensity * 0.5;
    this.mood.tint.lerp(HUE.set(mood.tint), ease);
    this.mood.k += (mood.k * strength - this.mood.k) * ease;
    this.mood.grade.lerp(new THREE.Vector3(...mood.grade).lerp(new THREE.Vector3(1, 1, 1), 1 - strength), ease);

    this.afterRain = Math.max(0, this.afterRain - dt);
    const bow = night < 0.3 && (this.kind === 'showers' || this.afterRain > 0) ? 1 : 0;
    n.rainbow = THREE.MathUtils.damp(n.rainbow, bow, 0.4, dt);
    this.placeRainbow(camera, around, view);
  }

  /**
   * Called after the Sky has lit the frame: clouds mute the sun and wash colour out, fog closes
   * in and pales the horizon, lightning floods everything white for a moment.
   */
  shade(sky: Sky, scene: THREE.Scene, pixels: PixelRenderer, water: { [k: string]: THREE.IUniform }) {
    const { cloud, fog, flash } = this.now;
    const { tint, k, grade } = this.mood;
    water.uRain.value = this.now.rain;
    water.uWind.value = this.gust;
    water.uSea.value = this.swell;
    // the sea works in blender coordinates (y north = -z)
    (water.uWindDir.value as THREE.Vector2).set(windDir.value.x, -windDir.value.y);
    const day = 1 - sky.lamps;
    // overcast light comes from the whole sky rather than the sun: shadows go soft and faint
    sky.sun.intensity *= 1 - cloud * 0.65;
    sky.sun.shadow.intensity = 1 - cloud * 0.8;
    mute(sky.sun.color, cloud * 0.7);
    tintTo(sky.sun.color, tint, k * 0.7);
    sky.hemi.intensity *= 1 + cloud * 0.25 + flash * 2.5;
    mute(sky.hemi.color, cloud * 0.6);
    tintTo(sky.hemi.color, tint, k);

    const f = scene.fog as THREE.Fog;
    mute(f.color, Math.max(cloud, fog) * 0.75);
    tintTo(f.color, tint, k);
    f.color.lerp(MIST, fog * day * 0.5).lerp(FLASH, flash * 0.6);
    // the low mist (see Mist) does most of the work; this just softens the distance
    f.near = 150 - fog * 70;
    f.far = 260 - fog * 45;
    scene.background = f.color;

    // heat: golden light when warm; when scorching, a pale haze and a shimmer
    const { warm, scorch } = this.heat;
    tintTo(sky.sun.color, GOLD, warm * 0.3);
    tintTo(sky.hemi.color, GOLD, warm * 0.2);
    f.color.lerp(HAZE, scorch * day * 0.45);
    f.near -= scorch * 50;
    pixels.uniforms.uHeat.value = this.reducedMotion ? 0 : scorch * day;
    // cold: a thin, clear, blue-white light
    const { chill } = this.heat;
    tintTo(sky.sun.color, ICE, chill * 0.25);
    tintTo(sky.hemi.color, ICE, chill * 0.3);
    tintTo(f.color, ICE, chill * 0.15);
    water.uIce.value = this.ice;
    pixels.uniforms.uTime.value = this.clock;

    const g = pixels.uniforms.uGrade.value as THREE.Vector3;
    g.multiply(grade);
    g.x *= (1 + warm * 0.08) * (1 - scorch * 0.18);
    g.z *= 1 + scorch * 0.06;
    g.x *= 1 - chill * 0.12;
    g.y *= 1 + chill * 0.05;
    g.x *= 1 - cloud * 0.25;
    g.z *= 1 - cloud * 0.06;
    pixels.uniforms.uTone.value *= 1 - cloud * 0.6; // overcast light is flat: no warm and cool
    const light = water.uLight.value as THREE.Color;
    tintTo(light, tint, k * 0.6);
    light.multiplyScalar(1 - cloud * 0.2 + flash * 0.5);
  }

  private rain(dt: number, around: THREE.Vector3, size: number, slant: number, night: number) {
    const active = Math.floor(DROPS * this.now.rain);
    this.drops.visible = active > 0;
    if (!active) return;
    const fine = this.now.fine;
    const pos = this.drops.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const height = size * 0.8;
    const len = size * 0.012 * (1 - fine * 0.6); // drizzle: short and slow
    const fall = this.reducedMotion ? 0 : (dt * (24 - fine * 14)) / height;
    const o = this.offsets;
    const dir = windDir.value;
    for (let i = 0; i < DROPS; i++) {
      if (i >= active) {
        arr.fill(0, i * 6, i * 6 + 6);
        continue;
      }
      o[i * 3 + 1] -= fall * this.speeds[i];
      if (o[i * 3 + 1] < 0) {
        o[i * 3 + 1] += 1;
        o[i * 3] = rand(-1, 1);
        o[i * 3 + 2] = rand(-1, 1);
      }
      const y = around.y - 4 + o[i * 3 + 1] * height;
      const up = y - around.y;
      const x = around.x + o[i * 3] * size - up * slant * dir.x;
      const z = around.z + o[i * 3 + 2] * size - up * slant * dir.y;
      arr.set([x, y, z, x - len * slant * dir.x, y + len, z - len * slant * dir.y], i * 6);
    }
    pos.needsUpdate = true;
    const mat = this.drops.material as THREE.LineBasicMaterial;
    mat.color.setRGB(0.72, 0.78, 0.86).multiplyScalar(1 - night * 0.45).addScalar(this.now.flash * 0.3);
    mat.opacity = (0.35 + this.now.rain * 0.3) * (1 - fine * 0.35);
  }

  /** Snow, hail and blown leaves, all single-pixel particles. */
  private flurries(dt: number, around: THREE.Vector3, size: number, night: number) {
    this.flakes.update(dt);
    if (this.reducedMotion) return;
    const n = this.now;
    const drift = Math.min(this.wind, 14) * (1 + this.gust * 0.3);
    const { x: dx, y: dz } = windDir.value;
    const dim = 1 - night * 0.35;
    const spawn = (rate: number, make: () => void) => {
      const count = rate * dt;
      const whole = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0);
      for (let i = 0; i < whole; i++) make();
    };
    const white = new THREE.Color(0xf4f6fb).multiplyScalar(dim);

    spawn(n.snow * 260, () => this.flakes.emit({
      position: around.clone().add(V(rand(-size, size), rand(2, size * 0.6), rand(-size, size))),
      velocity: V(drift * 0.12 * dx + rand(-0.2, 0.2), -rand(1.6, 2.6), drift * 0.12 * dz + rand(-0.2, 0.2)),
      color: white,
      life: rand(5, 8),
      size: Math.random() < 0.2 ? 2 : 1,
      wobble: 1.2,
    }));
    spawn(n.hail * 160, () => {
      const top = rand(3, size * 0.6);
      this.flakes.emit({
        position: around.clone().add(V(rand(-size, size), top, rand(-size, size))),
        velocity: V(drift * 0.3 * dx, -rand(15, 19), drift * 0.3 * dz),
        color: white,
        life: (top + 3) / 17,
        size: 2,
      });
    });
    // butterflies on a warm, still day
    spawn(this.heat.warm * (1 - night) * (1 - this.gust) * 1.5, () => this.flakes.emit({
      position: around.clone().add(V(rand(-size, size) * 0.6, rand(0.8, 2.5), rand(-size, size) * 0.6)),
      velocity: V(rand(-0.6, 0.6), rand(-0.1, 0.25), rand(-0.6, 0.6)),
      color: pick(BUTTERFLIES),
      life: rand(6, 10),
      size: 2,
      wobble: 3,
    }));
    // leaves tumbling across the island on a windy day, in from the upwind side
    spawn(this.windiness * 22 * (1 + this.gust), () => {
      const upwind = size * rand(0.6, 1);
      const across = rand(-size, size) * 0.7;
      const speed = drift * rand(0.8, 1.3);
      this.flakes.emit({
        position: around.clone().add(V(-upwind * dx - across * dz, rand(1, 7), -upwind * dz + across * dx)),
        velocity: V(speed * dx + rand(-0.6, 0.6), rand(-0.3, 0.6), speed * dz + rand(-0.6, 0.6)),
        color: new THREE.Color(pick(LEAVES)).multiplyScalar(dim),
        life: rand(3, 5),
        size: Math.random() < 0.5 ? 2 : 1,
        wobble: 2.5,
      });
    });
  }

  /** Snow (and some hail) builds up while it falls, then melts back to what the forecast says is lying. */
  private settle(dt: number) {
    const falling = this.now.snow + this.now.hail * 0.3;
    snowCover.value = falling > 0.05
      ? Math.min(1, snowCover.value + (dt * falling) / 45)
      : Math.max(this.lying, snowCover.value - dt / 80);
  }

  /** Frost when it's cold enough: at its thickest overnight and at dawn, and only the hard freezes last through the day. */
  private frostGoal(night: number) {
    const c = this.chill;
    const lasting = THREE.MathUtils.smoothstep(c, 0.6, 1);
    return THREE.MathUtils.smoothstep(c, 0.2, 0.6) * Math.max(Math.min(1, night * 1.3), lasting * 0.6) * (1 - this.now.rain);
  }

  /** How far ice has crept out from the shore, 0..1: it takes a proper freeze, and calm water. */
  get ice() {
    return THREE.MathUtils.smoothstep(this.heat.chill, 0.45, 1) * (1 - this.swell * 0.8);
  }

  /** Frost forms slowly through the night and burns off once the sun's been up a while. */
  private freeze(dt: number, night: number) {
    const goal = this.frostGoal(night);
    // already frosty (or not) when the visitor arrives
    frostCover.value = this.frostSnap > 0 ? goal : THREE.MathUtils.damp(frostCover.value, goal, goal > frostCover.value ? 0.02 : 0.04, dt);
    this.frostSnap -= dt;
  }

  /** Invisible puffs high above the island: all you see of them is their shadows drifting over it. */
  private makeClouds() {
    const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const blob = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < CLOUDS; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Mesh(blob, mat);
        m.position.set(rand(-5, 5), rand(-0.5, 0.5), rand(-3, 3));
        m.scale.set(rand(3, 6), rand(0.8, 1.5), rand(2.5, 4.5));
        m.castShadow = true;
        m.raycast = () => {};
        g.add(m);
      }
      g.position.set(rand(-70, 70), rand(26, 32), rand(-50, 50));
      g.userData.size = rand(0.7, 1.3);
      this.clouds.push(g);
    }
    return this.clouds;
  }

  private driftClouds(dt: number) {
    const speed = this.reducedMotion ? 0 : 0.6 + Math.min(this.wind, 15) * 0.25;
    const dir = windDir.value;
    const angle = Math.atan2(-dir.y, dir.x); // turns a cloud's long (x) side along the wind
    this.clouds.forEach((c, i) => {
      const s = THREE.MathUtils.clamp(this.now.shadows * CLOUDS - i, 0, 1) * c.userData.size;
      c.visible = s > 0.02;
      c.scale.setScalar(Math.max(s, 0.001));
      c.rotation.y = angle;
      c.position.x += speed * dt * dir.x;
      c.position.z += speed * dt * dir.y;
      // blown off one side of the island: come back in on the other, somewhere along it
      if (c.position.x * dir.x + c.position.z * dir.y > 75) {
        const across = rand(-50, 50);
        c.position.x = -75 * dir.x - across * dir.y;
        c.position.z = -75 * dir.y + across * dir.x;
      }
    });
  }

  /** The rainbow hangs behind the island, facing the camera like a painted backdrop. */
  private placeRainbow(camera: THREE.Camera, around: THREE.Vector3, view: number) {
    const a = this.now.rainbow;
    this.rainbow.visible = a > 0.02;
    if (!this.rainbow.visible) return;
    const forward = camera.getWorldDirection(V());
    const up = V(0, 1, 0).applyQuaternion(camera.quaternion);
    this.rainbow.position.copy(around).addScaledVector(forward, 100).addScaledVector(up, -view * 0.3);
    this.rainbow.quaternion.copy(camera.quaternion);
    this.rainbow.scale.setScalar(view * 0.6);
    (this.rainbow.material as THREE.MeshBasicMaterial).opacity = a * 0.4;
  }

  /** Lightning right now (if there's a storm to bring it); the next strike waits its turn. */
  bolt() {
    if (this.reducedMotion || this.now.storm < 0.5) return;
    this.nextStrike = 0;
  }

  /** A bright double-flicker now and then, then thunder rolling in a little later. */
  private lightning(dt: number) {
    const n = this.now;
    n.flash = Math.max(0, n.flash - dt * 4);
    if (this.reducedMotion || n.storm < 0.5) return;
    this.nextStrike -= dt;
    if (this.strike >= 0) {
      this.strike += dt;
      if (this.strike > 0.18 && this.strike - dt <= 0.18) n.flash = 0.8; // the second flicker
      if (this.strike > 0.3) this.strike = -1;
    }
    if (this.nextStrike > 0) return;
    this.nextStrike = rand(7, 20);
    this.strike = 0;
    n.flash = 1;
    const distance = Math.random();
    setTimeout(() => this.onThunder?.(distance), 400 + distance * 2500);
  }
}

/** A half ring of seven flat colour bands (unit radius), so the bands stay crisp when pixelated. */
function rainbowArc() {
  const pos: number[] = [];
  const col: number[] = [];
  const segs = 40;
  const at = (r: number, a: number) => [Math.cos(a) * r, Math.sin(a) * r, 0];
  RAINBOW.forEach((hex, b) => {
    const c = new THREE.Color(hex);
    const r0 = 0.72 + b * 0.04;
    const r1 = r0 + 0.04;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI;
      const a1 = ((s + 1) / segs) * Math.PI;
      pos.push(...at(r0, a0), ...at(r1, a0), ...at(r1, a1), ...at(r0, a0), ...at(r1, a1), ...at(r0, a1));
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.raycast = () => {};
  return mesh;
}
