import * as THREE from 'three';
import { windDir } from './grass';
import { season } from './season';
import type { Sky } from './sky';
import type { Weather } from './weather';

/** Heights of the mist layers over the sea: stacked low, so hills rise out of them and it pools in the dips. */
const LAYERS = [0.2, 0.55, 1.0, 1.5];
const WHITE = new THREE.Color(1, 1, 1);
const MOONLIT = new THREE.Color('#6d7ca8');

/**
 * Mist lying low over the sea and the island: a few flat sheets of drifting noise at different
 * heights, so it thins out up the hillsides and hangs in the low ground. It comes with foggy
 * (and a little with drizzly) weather, and on some calm, cool mornings it's there at sunrise
 * and burns off as the sun climbs. In a hard freeze the sea smokes: the water is warmer than
 * the air, and wisps of vapour lift off it all day while it's calm. In a blizzard it's blown snow. Faded out in steps with an ordered dither, so it stays pixel art.
 */
export class Mist {
  /** How much mist there is now, 0..1. */
  amount = 0;
  /** How much of that is sea smoke, which is whiter than fog. */
  private smoke = 0;
  private sheets: THREE.Mesh[] = [];
  private started = false;
  private uniforms = {
    uAmount: { value: 0 },
    uColor: { value: new THREE.Color() },
  };
  /** Whether this morning is a misty one: a daily roll, likelier in autumn. */
  private mistyMorning: boolean;

  constructor(
    scene: THREE.Scene,
    private reducedMotion: boolean,
  ) {
    const day = Math.floor(Date.now() / 864e5);
    const chance = 0.25 + season.weights.autumn * 0.35 + season.weights.spring * 0.1;
    let forced = false;
    try {
      forced = new URLSearchParams(location.search).has('mist');
    } catch {}
    this.mistyMorning = forced || fract(Math.sin(day * 57.3) * 43758.5) < chance;

    const plane = new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2);
    LAYERS.forEach((y, i) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          { uLayer: { value: i / (LAYERS.length - 1) }, uDrift: { value: new THREE.Vector2(i * 17.3, i * -9.1) } },
        ]),
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        fog: true,
      });
      // share the amount and colour across the layers
      mat.uniforms.uAmount = this.uniforms.uAmount;
      mat.uniforms.uColor = this.uniforms.uColor;
      const m = new THREE.Mesh(plane, mat);
      m.position.y = y;
      m.renderOrder = 2;
      m.frustumCulled = false;
      m.visible = false;
      m.raycast = () => {};
      this.sheets.push(m);
    });
    scene.add(...this.sheets);
  }

  update(dt: number, sky: Sky, weather: Weather) {
    const w = weather.now;
    const wet = Math.min(1, w.rain + w.snow + w.hail);
    // morning mist: around sunrise, burning off once the sun is ~10° up, on a calm, cool, dry morning
    const dawn = this.mistyMorning && sky.rising ? THREE.MathUtils.clamp(1 - Math.abs(sky.alt - 2) / 9, 0, 1) : 0;
    const calm = THREE.MathUtils.clamp((6 - weather.wind) / 4, 0, 1);
    const cool = THREE.MathUtils.clamp((22 - weather.temperature) / 6, 0, 1);
    const morning = dawn * calm * cool * (1 - wet) * 0.7;
    // wind tears fog apart
    const fog = w.fog * (1 - weather.windiness * 0.7);
    // sea smoke: bitter cold air over the (warmer) sea, on a still day
    const smoke = THREE.MathUtils.smoothstep(weather.heat.chill, 0.6, 1) * calm * (1 - wet) * 0.3;
    // a blizzard: blown snow hanging low over everything, whiter still
    const whiteout = weather.blizzard * 0.4;
    const goal = Math.max(fog, morning, smoke, whiteout);
    this.smoke = goal > 0 ? Math.max(smoke, whiteout) / goal : 0;
    // already misty when the visitor arrives; after that it rolls in and lifts slowly
    this.amount = this.started ? THREE.MathUtils.damp(this.amount, goal, 0.15, dt) : goal;
    this.started = true;
    this.uniforms.uAmount.value = this.amount;

    const visible = this.amount > 0.02;
    const speed = this.reducedMotion ? 0 : 0.3 + Math.min(weather.wind, 12) * 0.12;
    const { x: dx, y: dz } = windDir.value;
    this.sheets.forEach((s, i) => {
      s.visible = visible;
      // the higher sheets move a little faster, so the layers slide over each other
      const drift = (s.material as THREE.ShaderMaterial).uniforms.uDrift.value as THREE.Vector2;
      const k = speed * (0.7 + i * 0.2) * dt;
      drift.x -= dx * k;
      drift.y -= dz * k;
    });
  }

  /** After the sky and the weather have set the fog colour: the mist takes it on, a little paler by day and moonlit by night. */
  shade(sky: Sky, scene: THREE.Scene) {
    const fog = (scene.fog as THREE.Fog).color;
    this.uniforms.uColor.value.copy(fog).lerp(WHITE, 0.3 * (1 - sky.lamps)).lerp(MOONLIT, 0.45 * sky.lamps).lerp(WHITE, this.smoke * 0.6 * (1 - sky.lamps * 0.6));
  }
}

const fract = (x: number) => x - Math.floor(x);

const VERTEX = /* glsl */ `
  varying vec2 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uAmount;
  uniform float uLayer; // 0 the lowest sheet … 1 the highest
  uniform vec2 uDrift;
  uniform vec3 uColor;
  varying vec2 vWorld;
  #include <fog_pars_fragment>

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    return noise(p) * 0.55 + noise(p * 2.1 + 5.2) * 0.3 + noise(p * 4.3 - 3.1) * 0.15;
  }
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    vec2 p = (vWorld + uDrift) * 0.05;
    // two samples drifting against each other, so the banks change shape as they go
    float n = fbm(p) * 0.7 + fbm(p * 1.7 - uDrift * 0.03) * 0.3;
    // more mist fills in more of the sheet; the higher sheets are thinner and patchier
    float edge = 0.66 - uAmount * 0.3 + uLayer * 0.08;
    float a = smoothstep(edge, edge + 0.22, n) * (0.5 - uLayer * 0.22) * min(1.0, uAmount * 1.6);
    // four steps of opacity, dithered between
    a = floor(a * 4.0 + bayer4(gl_FragCoord.xy)) / 4.0;
    if (a <= 0.0) discard;
    gl_FragColor = vec4(uColor, a);
    #include <fog_fragment>
  }
`;
