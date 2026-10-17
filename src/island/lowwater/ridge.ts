/**
 * The hailstones: up the baak, and out above a sea of cloud at the same blue hour, one of the
 * baak's open questions laid out as stones you walk. Take a whole number; halve it if it's even,
 * treble it and add one if it's odd; again. These are 27's: a stone for each number, its top as
 * high as the number is big (a doubling a metre, so halving is always the same step down and
 * trebling a step and a half up), running east. The next stone isn't there until you stand on
 * this one, then it comes up out of the cloud: nobody knows a shortcut, so to find out where a
 * number goes you walk it. Behind you the ones you've walked stay up, a range of your own. It
 * climbs to 9,232 and comes down to 1, where it only goes round: the rule says 4 next, so the 4
 * behind you goes down into the cloud and comes up in front, then the 2, then the 1, three stones
 * walking with you round the only loop anyone has found, for as long as you like.
 *
 * Its own scene and camera, drawn through the island's PixelRenderer like the page. Looking north
 * at a low slant, so the stones stand against the sky, with the cloud's far edge cut where the
 * horizon is (an orthographic camera has none of its own). Walk back west off 27 onto the baak's
 * top for the flat; or come down off 1.
 */
import * as THREE from 'three';
import { toon } from '../scene/toon';
import { makeFigure, type Figure } from './figure';

const ELEVATION = THREE.MathUtils.degToRad(16);
const DISTANCE = 120;
const PACE = 1.8;
/** Where it starts. 27 is the famous one: small, and a hundred and eleven steps to 1. */
export const FROM = 27;
/**
 * A doubling, in metres of height; a stone's spacing, and its radius (m). The stones are basalt,
 * which cools in six-sided columns, set with a face to you: so each face is a radius wide, and the
 * columns all but touch, corner to corner, like a causeway.
 */
const RISE = 1;
const GAP = 2.3;
const R = 1.1;
const WIDE = 2 * R;
/** The cloud's top, under the lowest stone (1, whose top is at 0). */
const CLOUD = -2.8;
/** How long a stone takes to come up out of the cloud (s); and, going round at the end, to go back down into it. */
const RISING = 0.9;
const SINKING = 0.6;
/** Off 27 to the west, the baak's top, and past it the way down. */
const BAAK_X = -2.4;
const WAY_DOWN = -1.5;
/** Stood this long anywhere (s), the card for that stretch comes back. */
const STILL = 7;
/**
 * The note every stone is a harmonic of (C3, Hz). A stone rings its own number: n times this,
 * brought down by octaves (eighths, three at a time) until it's under three octaves above it. So
 * halving is the same note an octave lower, trebling and adding one is a twelfth and a little up
 * (a fifth, give or take the octaves), and every way ends 4, 2, 1 on this note and its octaves.
 */
const HOME = 130.81;
export function ringOf(n: number) {
  let f = n;
  while (f >= 8) f /= 8;
  return HOME * f;
}

const STONES = ['#5d5f7c', '#666884', '#5a5873', '#636379'].map((c) => new THREE.Color(c));
const CUT = new THREE.Color('#d6cbb4');
const CLOUDS = { lit: new THREE.Color('#c2a9ae'), pale: new THREE.Color('#9893b2'), mid: new THREE.Color('#7a7aa0'), deep: new THREE.Color('#5d6189') };

const KEYS: Record<string, 'east' | 'west'> = {
  KeyD: 'east', ArrowRight: 'east', KeyW: 'east', ArrowUp: 'east', KeyA: 'west', ArrowLeft: 'west', KeyS: 'west', ArrowDown: 'west',
};

export type RidgeCard = 'hail' | 'tune' | 'peak' | 'one' | 'loop' | 'laps' | 'down';
export type RidgePick = { stone: number } | 'down';

/** A number's way to 1. */
export function hailstones(n: number) {
  const out = [n];
  while (n !== 1) out.push((n = n % 2 ? 3 * n + 1 : n / 2));
  return out;
}

// prettier-ignore
const DIGITS: string[][] = [
  ['###', '#.#', '#.#', '#.#', '###'], ['.#.', '##.', '.#.', '.#.', '###'], ['###', '..#', '###', '#..', '###'], ['###', '..#', '.##', '..#', '###'], ['#.#', '#.#', '###', '..#', '..#'],
  ['###', '#..', '###', '..#', '###'], ['###', '#..', '###', '#.#', '###'], ['###', '..#', '.#.', '.#.', '.#.'], ['###', '#.#', '###', '#.#', '###'], ['###', '#.#', '###', '..#', '###'],
];

/** A number cut in a stone's face: one mark a texel, centred across, hanging down from 0, in texels. */
function cutNumber(n: number): [THREE.BufferGeometry, number] {
  const pos: number[] = [];
  const idx: number[] = [];
  const digits = String(n).split('').map(Number);
  let x = -Math.round((digits.length * 4 - 1) / 2);
  for (const d of digits) {
    DIGITS[d].forEach((row, r) => {
      for (let c = 0; c < 3; c++) {
        if (row[c] !== '#') continue;
        const k = pos.length / 3;
        pos.push(x + c, -r, 0, x + c + 1, -r, 0, x + c + 1, -r - 1, 0, x + c, -r - 1, 0);
        idx.push(k, k + 2, k + 1, k, k + 3, k + 2);
      }
    });
    x += 4;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  return [geometry, String(n).length * 4 - 1];
}

/** A basalt column, a face to you, a little narrower at the top: faceted, so each face takes the light as one. */
function column(tall: number) {
  const g = new THREE.CylinderGeometry(R * 0.97, R, tall, 6, 1).toNonIndexed();
  g.rotateY(Math.PI / 6);
  g.computeVertexNormals();
  return g;
}

interface Stone {
  n: number;
  top: number;
  /** Made when it's first called up (a long walk is hundreds of them). */
  root?: THREE.Group;
  cut?: THREE.Mesh;
  /** Its number's width, in texels. */
  wide: number;
  /** 0 under the cloud … 1 up; −1 not yet called up. */
  up: number;
  /** When it last rang (the ridge's own clock, s). */
  rang: number;
  /** Where along it stands (a stone's place); and where it's going, which only the last three, 4, 2 and 1, ever do. */
  at: number;
  to: number;
}

export class Ridge {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  card: RidgeCard | null = null;
  /** Walked back onto the baak, or come down off 1: time for the flat again. */
  leaving = false;
  /** Each footstep on stone; and a stone coming up out of the cloud, from so far across the picture (−1 … 1). */
  onStep?: () => void;
  onRise?: (pan: number) => void;
  /** A stone ringing its number: as it lands, loud; as you land on it again, softer; and the last, held. */
  onRing?: (freq: number, pan: number, loud: boolean, held: boolean) => void;
  /** Whether you can hear them (the site's sound on), so the card can speak of it. */
  rings = false;
  /** How many have rung this walk. */
  private rung = 0;
  private wasOn = -1;
  /** The number you're walking, its way to 1, and where that's highest (for 27, 9,232, seventy-seven steps along). */
  from = FROM;
  numbers = hailstones(FROM);
  peak = 0;
  /** The first number on your way that's on 27's. */
  joined: number | null = null;
  private stones: Stone[] = [];
  private face = new THREE.MeshBasicMaterial({ color: CUT });
  private you: Figure;
  private pos = new THREE.Vector3();
  private heading = Math.PI / 2;
  private speed = 0;
  private goal: number | null = null;
  private keys = new Set<string>();
  private stride = 0;
  private lastStep = 0;
  private stillFor = 0;
  /** The furthest stone you've stood on. */
  private furthest = 0;
  private downClicked = false;
  private target = new THREE.Vector3();
  private pan = new THREE.Vector2();
  private view = 28;
  private aspect = 1;
  private zoomed = 1;
  private time = 0;
  private ray = new THREE.Raycaster();
  private cloud: THREE.Mesh;
  private cloudU: Record<string, THREE.IUniform>;
  private skyU: Record<string, THREE.IUniform>;
  private baak = new THREE.Group();
  private pickables: THREE.Object3D[] = [];

  constructor(private texels: () => number) {
    this.scene.background = new THREE.Color('#0f1233');
    // the warm band's light, low from the west, on the stones' near sides; the sky's blue on the rest
    this.scene.add(new THREE.HemisphereLight('#8f95c8', '#3e3655', 1.3), this.camera);
    const sun = new THREE.DirectionalLight('#ffbf92', 2.4);
    sun.position.set(-40, 12, 16);
    this.scene.add(sun, sun.target);
    const skin = toon(new THREE.Color('#3a3348'), { own: true, bare: true });
    this.you = makeFigure({ coat: toon(new THREE.Color('#353352'), { own: true, bare: true }), boots: toon(new THREE.Color('#1b1a2a'), { own: true, bare: true }), scarf: toon(new THREE.Color('#efe2c6'), { own: true, bare: true }), skin });
    this.scene.add(this.you.root);
    const sky = this.makeSky();
    this.skyU = sky;
    const cloud = this.makeCloud();
    this.cloud = cloud.mesh;
    this.cloudU = cloud.uniforms;
    this.makeStones();
    this.resize(innerWidth, innerHeight);
  }

  /** The sky, behind everything: the flat's own bands, the warm one at the horizon broad on the left, and a few stars. */
  private makeSky() {
    const uniforms = { uHorizon: { value: 0 }, uTexel: { value: 0.003 }, uAspect: { value: 1 }, uDrift: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec2 vAt;
        void main() {
          vAt = position.xy;
          gl_Position = vec4(position.xy * 2.0, 0.9999, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
        uniform float uHorizon; // the horizon's height on screen (view heights, from the middle)
        uniform float uTexel;
        uniform float uAspect;
        uniform float uDrift;
        varying vec2 vAt;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          ivec2 p = ivec2(gl_FragCoord.xy);
          float d = (BAYER[(p.x & 3) + (p.y & 3) * 4] + 0.5) / 16.0;
          float a = vAt.y - uHorizon;
          float x = vAt.x;
          float j = (d - 0.5) * uTexel * 5.0;
          float warm = 1.0 - smoothstep(-0.45, 0.45, x);
          float w1 = 0.008 + 0.02 * warm;
          float w2 = w1 + 0.016 + 0.024 * warm;
          vec3 col = vec3(0.60, 0.52, 0.58);
          if (a + j > 0.004) col = mix(vec3(0.46, 0.37, 0.48), vec3(0.95, 0.55, 0.32), step(d * 0.5 + 0.1, warm));
          if (a + j > w1) col = mix(vec3(0.31, 0.29, 0.47), vec3(0.50, 0.34, 0.45), step(d * 0.5 + 0.2, warm));
          if (a + j > w2) col = vec3(0.22, 0.23, 0.43);
          if (a + j > 0.1) col = vec3(0.14, 0.155, 0.34);
          if (a + j > 0.19) col = vec3(0.085, 0.098, 0.25);
          if (a + j > 0.32) col = vec3(0.053, 0.062, 0.18);
          if (a + j > 0.52) col = vec3(0.034, 0.04, 0.135);
          // a few stars, high up, where the sky's dark enough: fixed in the sky, so they don't walk with you
          vec2 cell = floor(vec2((x * uAspect + uDrift) / uTexel, a / uTexel));
          float s = hash(cell);
          if (a > 0.26 && s > 0.9993) col = mix(col, vec3(0.78, 0.8, 0.95), 0.35 + 0.65 * step(0.99985, s));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    quad.frustumCulled = false;
    quad.renderOrder = -20;
    this.scene.add(quad);
    return uniforms;
  }

  /**
   * The cloud, a floor of it, in stepped and dithered tones: lit warm on its tops towards the west,
   * deep in its hollows, drifting east very slowly, and going to the horizon's colour at its far
   * edge, which is cut where the horizon is.
   */
  private makeCloud() {
    const uniforms = {
      uTime: { value: 0 },
      uNear: { value: 0 },
      uFar: { value: -100 },
      uHaze: { value: new THREE.Color(0.6, 0.52, 0.58) },
      uLit: { value: CLOUDS.lit },
      uPale: { value: CLOUDS.pale },
      uMid: { value: CLOUDS.mid },
      uDeep: { value: CLOUDS.deep },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vAt;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vAt = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
        uniform float uTime;
        uniform float uNear;
        uniform float uFar;
        uniform vec3 uHaze;
        uniform vec3 uLit;
        uniform vec3 uPale;
        uniform vec3 uMid;
        uniform vec3 uDeep;
        varying vec3 vAt;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        float billow(vec2 p) {
          float v = 0.0;
          float a = 0.55;
          for (int k = 0; k < 4; k++) {
            v += a * abs(noise(p) * 2.0 - 1.0);
            p = p * 2.03 + vec2(13.1, 7.7);
            a *= 0.5;
          }
          return 1.0 - v;
        }
        void main() {
          ivec2 q = ivec2(gl_FragCoord.xy);
          float d = (BAYER[(q.x & 3) + (q.y & 3) * 4] + 0.5) / 16.0;
          // squashed across, as cloud seen this low is: long rolls
          vec2 p = vec2(vAt.x * 0.05 + uTime * 0.004, vAt.z * 0.11);
          float b = billow(p);
          // and its tops catch the west's warm light
          float west = billow(p + vec2(0.04, 0.0)) - b;
          float v = b + d * 0.12 - 0.06;
          vec3 col = v > 0.72 ? (west < -0.004 ? uLit : uPale) : v > 0.55 ? uPale : v > 0.38 ? uMid : uDeep;
          float far = clamp((uNear - vAt.z) / (uNear - uFar), 0.0, 1.0);
          float haze = floor(smoothstep(0.25, 0.95, far) * 4.0 + d) / 4.0;
          gl_FragColor = vec4(mix(col, uHaze, haze), 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5), mat);
    mesh.frustumCulled = false;
    mesh.position.y = CLOUD;
    mesh.renderOrder = -10;
    this.scene.add(mesh);
    return { mesh, uniforms };
  }

  /** A stone for every number on the way down, each made and called up only when you reach the one before. */
  private makeStones() {
    for (const s of this.stones) {
      if (!s.root) continue;
      this.scene.remove(s.root);
      // (the stones' materials are the shared toon ones: only their shapes go)
      for (const m of s.root.children as THREE.Mesh[]) m.geometry.dispose();
    }
    this.pickables = [];
    this.numbers = hailstones(this.from);
    this.peak = this.numbers.indexOf(Math.max(...this.numbers));
    // (where it meets 27's way, if it's a good way before the shared last stretch that every number ends on)
    const ours = new Set(hailstones(FROM));
    const at = this.numbers.findIndex((n) => ours.has(n));
    this.joined = this.from !== FROM && this.numbers.length - at > 20 ? this.numbers[at] : null;
    this.stones = this.numbers.map((n, i) => ({ n, top: Math.log2(n) * RISE, wide: String(n).length * 4 - 1, up: -1, rang: -9, at: i, to: i }));
    this.makeBaak();
  }

  private makeStone(i: number) {
    const s = this.stones[i];
    const tall = s.top - CLOUD + 6;
    const root = new THREE.Group();
    const body = new THREE.Mesh(column(tall), toon(STONES[(i * 7 + (s.n % 5)) % STONES.length], { bare: true }));
    body.position.y = s.top - tall / 2;
    body.userData.stone = s;
    root.add(body);
    const [geometry] = cutNumber(s.n);
    const cut = new THREE.Mesh(geometry, this.face);
    cut.position.set(0, s.top - 0.16, R * 0.97 * Math.cos(Math.PI / 6) + 0.02);
    root.add(cut);
    root.position.x = i * GAP;
    this.scene.add(root);
    this.pickables.push(body);
    s.root = root;
    s.cut = cut;
  }

  /** The baak's top, just west of the first stone and as high: its mast and black ball, up out of the cloud, the way you came. */
  private makeBaak() {
    this.scene.remove(this.baak);
    this.baak.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
    this.baak = new THREE.Group();
    const tar = toon(new THREE.Color('#2f2a35'), { own: true, bare: true });
    const top = this.stones[0].top;
    const tall = top + 1.2 - CLOUD;
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.22, tall, 0.22), tar);
    mast.position.y = CLOUD + tall / 2;
    this.baak.add(mast);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4, 0.16), tar);
      leg.position.set(s * 0.55, top - 2.2, 0);
      leg.rotation.z = s * 0.14;
      this.baak.add(leg);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.12), tar);
      brace.position.set(0, top - 1.6 - (s + 1) * 0.9, 0);
      brace.rotation.z = s * 0.5;
      this.baak.add(brace);
    }
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), toon(new THREE.Color('#2a2530'), { glow: true, own: true }));
    (ball.material as THREE.MeshToonMaterial).emissive.set('#d0805a');
    (ball.material as THREE.MeshToonMaterial).emissiveIntensity = 0.3;
    ball.position.y = top + 1.5;
    this.baak.add(ball);
    // what you click is the whole of it
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.6, tall + 1, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = CLOUD + tall / 2;
    hit.userData.down = true;
    this.baak.add(hit);
    this.baak.position.set(BAAK_X, 0, -0.2);
    this.scene.add(this.baak);
    this.pickables.push(hit);
  }

  /** Up off the baak: onto 27 (or your own number), with the next coming up out of the cloud beside you. */
  arrive(from = FROM) {
    if (from !== this.from || !this.stones.length) (this.from = from), this.makeStones();
    this.leaving = false;
    this.downClicked = false;
    this.keys.clear();
    this.pan.set(0, 0);
    this.furthest = 0;
    this.stillFor = 0;
    this.rung = 0;
    // (so 27 rings as you step out onto it)
    this.wasOn = -1;
    this.stones.forEach((s, i) => ((s.up = -1), (s.rang = -9), (s.at = s.to = i), s.root && ((s.root.visible = false), (s.root.position.x = i * GAP))));
    this.call(0);
    this.stones[0].up = 1;
    this.pos.set(-0.5, this.stones[0].top, 0);
    this.heading = Math.PI / 2;
    this.speed = 0;
    this.goal = 0;
    this.call(1);
    this.frame(0);
  }

  /** Call a stone up out of the cloud. */
  private call(i: number) {
    const s = this.stones[i];
    if (!s || s.up >= 0) return;
    s.up = 0;
    if (!s.root) this.makeStone(i);
    s.root!.visible = true;
    this.onRise?.(this.panOf(s.at));
  }

  /** How far across the picture a stone's place is (−1 … 1), for its sound. */
  private panOf(at: number) {
    return THREE.MathUtils.clamp((at * GAP - this.target.x) / (this.view * this.aspect * 0.5), -1, 1);
  }

  /** A stone ringing its number, from where it is across the picture. */
  private ring(i: number, loud: boolean) {
    const s = this.stones[i];
    s.rang = this.time;
    this.rung++;
    this.onRing?.(ringOf(s.n), this.panOf(s.at), loud, loud && i === this.stones.length - 1);
  }

  /** The last three stones, 4, 2 and 1, which go round (none, for a number whose way is shorter). */
  private get loop() {
    return this.stones.length >= 3 ? this.stones.slice(-3) : [];
  }

  /** The stone standing at a place along it, if one is (round at the end, there are only ever three). */
  standing(at: number): Stone | undefined {
    const last = this.stones.length - 1;
    if (at < 0) return undefined;
    if (at < last - 2 || (at <= last && !this.loop.length)) return this.stones[at];
    return this.loop.find((s) => s.at === at);
  }

  /**
   * Once you've stood on 1, the three places the loop's stones are wanted: the one you're on and
   * one either side. Each place is 4's, 2's or 1's by where it falls in the round, so as you walk
   * on, the stone behind you is the one that's due in front, and it goes down and comes up there.
   */
  private goRound() {
    const loop = this.loop;
    if (!loop.length) return;
    const home = this.stones.length - 3;
    const start = Math.max(home, this.wasOn - 1);
    for (let j = start; j < start + 3; j++) loop[(j - home) % 3].to = j;
  }

  key(code: string, down: boolean) {
    const k = KEYS[code];
    if (!k) return false;
    if (down) (this.keys.add(k), (this.goal = null), (this.downClicked = false));
    else this.keys.delete(k);
    return true;
  }

  releaseKeys() {
    this.keys.clear();
  }

  pick(ndc: THREE.Vector2): RidgePick | null {
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObjects(this.pickables.filter((o) => o.userData.down || (o.userData.stone.up >= 0.95 && o.userData.stone.to === o.userData.stone.at)), false)[0];
    if (!hit) return null;
    return hit.object.userData.down ? 'down' : { stone: (hit.object.userData.stone as Stone).at };
  }

  /** The number cut in the stone at a place. */
  stoneAt(i: number) {
    return this.standing(i)?.n;
  }

  /** A click: along the ridge to that stone (or as near it as the stones go); on the baak, back down. */
  click(ndc: THREE.Vector2) {
    const at = this.pick(ndc);
    if (at === 'down') return void ((this.goal = WAY_DOWN - 1), (this.downClicked = true));
    this.downClicked = false;
    if (at) return void (this.goal = at.stone * GAP);
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), p)) this.goal = THREE.MathUtils.clamp(p.x, Math.max(-0.5, this.back), this.reach);
  }

  /** Come down off 1, as hail does. */
  comeDown() {
    this.leaving = true;
  }

  zoom(factor: number) {
    this.zoomed = THREE.MathUtils.clamp(this.zoomed * factor, 0.6, 1.5);
  }

  drag(dx: number, dy: number, height: number) {
    const per = this.seen / height;
    this.pan.x = THREE.MathUtils.clamp(this.pan.x - dx * per, -24, 24);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y + dy * per, -10, 10);
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
    this.view = Math.max(22, Math.min(30, 20 / this.aspect + 10));
  }

  /** The place you're on (or nearest): past 1, round the loop, it goes on as far as you walk. */
  get on() {
    return Math.max(0, Math.round(this.pos.x / GAP));
  }

  /** Whether there's a stone at a place, all but up, to step onto. */
  private firm(at: number) {
    const s = this.standing(at);
    return !!s && s.up >= 0.85 && s.to === s.at;
  }

  /** How far east you can go: onto the last stone that's up. */
  private get reach() {
    let i = Math.max(0, this.wasOn);
    while (this.firm(i + 1)) i++;
    return i * GAP + 0.3;
  }

  /** And west: back to the baak, unless you've gone round and the stones behind you are under the cloud. */
  private get back() {
    let i = Math.max(0, this.wasOn);
    while (i > 0 && this.firm(i - 1)) i--;
    return i ? i * GAP - 0.3 : WAY_DOWN - 1.2;
  }

  update(dt: number) {
    this.time += dt;
    this.goRound();
    this.stones.forEach((s, i) => {
      if (s.up < 0) return;
      // (round at the end, one that's due somewhere else goes down into the cloud first, and comes up there)
      if (s.to !== s.at) {
        s.up = Math.max(0, s.up - dt / SINKING);
        if (s.up === 0) (s.at = s.to), (s.root!.position.x = s.at * GAP), this.onRise?.(this.panOf(s.at));
        return;
      }
      if (s.up >= 1) return;
      s.up = Math.min(1, s.up + dt / RISING);
      // (it rings as it lands)
      if (s.up === 1 && i) this.ring(i, true);
    });
    this.walk(dt);
    // a stone you're stood on calls up the next; and one you come back onto rings again, softer
    const on = this.on;
    const here = this.standing(on);
    if (here && Math.abs(this.pos.x - on * GAP) < WIDE / 2) {
      if (on > this.furthest) this.furthest = on;
      if (on !== this.wasOn && here.up === 1 && this.time - here.rang > 2.5) this.ring(this.stones.indexOf(here), false);
      this.wasOn = on;
      if (on + 1 < this.stones.length) this.call(on + 1);
    }
    this.animate(dt);
    // (a number that's highest where it starts, a power of two, has no peak to come to)
    const peak = this.peak < 3 ? -9 : this.peak;
    const last = this.stones.length - 1;
    // (round the loop: its card for the first time round, and again when you stand)
    const round = on - last;
    this.card =
      this.pos.x < -0.2 || this.downClicked ? 'down'
      : on === last ? 'one'
      : round > 0 ? (this.stillFor > STILL ? (this.rings && round > 6 ? 'laps' : 'loop') : round <= 3 ? 'loop' : null)
      : Math.abs(on - peak) <= 2 ? 'peak'
      : on <= 2 ? 'hail'
      : this.stillFor > STILL ? (peak >= 0 && on > peak ? 'peak' : this.rings && this.rung >= 6 ? 'tune' : 'hail')
      : null;
    if (this.pos.x < WAY_DOWN) this.leaving = true;
    this.frame(dt);
  }

  private walk(dt: number) {
    let dir = 0;
    if (this.keys.has('east')) dir += 1;
    if (this.keys.has('west')) dir -= 1;
    let want = 0;
    if (dir) want = PACE;
    else if (this.goal !== null) {
      const dx = this.goal - this.pos.x;
      if (Math.abs(dx) <= 0.06) this.goal = null;
      else (dir = Math.sign(dx)), (want = PACE * Math.min(1, Math.abs(dx) / 0.4 + 0.3));
    }
    // (going up a step and a half is a scramble: slower, for a moment)
    const climbing = this.ground(this.pos.x + dir * 0.5) - this.pos.y;
    if (climbing > 0.3) want *= 0.55;
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * 8));
    if (this.speed < 0.02 && !want) {
      this.speed = 0;
      this.stillFor += dt;
      this.pos.y += (this.ground(this.pos.x) - this.pos.y) * (1 - Math.exp(-dt * 12));
      return;
    }
    this.stillFor = 0;
    if (dir) this.heading += ((dir > 0 ? Math.PI / 2 : -Math.PI / 2) - this.heading) * (1 - Math.exp(-dt * 10));
    const facing = Math.sign(Math.sin(this.heading)) || 1;
    const step = this.speed * dt;
    // (not past the last stone that's up, and back west only as far as the baak)
    const x = THREE.MathUtils.clamp(this.pos.x + (dir || facing) * step, Math.min(this.back, this.pos.x), Math.max(this.reach, this.pos.x));
    this.stride += Math.abs(x - this.pos.x);
    this.pos.x = x;
    this.pos.y += (this.ground(this.pos.x) - this.pos.y) * (1 - Math.exp(-dt * 12));
    if (this.pan.lengthSq()) this.pan.multiplyScalar(Math.exp(-dt * 1.5));
    if (this.stride - this.lastStep > 0.5) {
      this.lastStep = this.stride;
      if (this.pos.x > -0.6) this.onStep?.();
    }
  }

  /** The height underfoot: the nearest stone's top (and over the gap, the one you're stepping from); west of 27, the baak's. */
  private ground(x: number) {
    if (x < -0.6) return this.stones[0].top;
    const i = Math.max(0, Math.round(x / GAP));
    if (this.firm(i)) return this.standing(i)!.top;
    return this.standing(this.wasOn)?.top ?? this.pos.y;
  }

  private animate(dt: number) {
    const w = this.you;
    w.root.position.copy(this.pos);
    w.root.rotation.set(0, this.heading, 0);
    const swing = Math.sin(this.stride * 7.4) * Math.min(1, this.speed / PACE) * 0.5;
    w.legs[0].rotation.x = swing;
    w.legs[1].rotation.x = -swing;
    w.arms[0].rotation.x = -swing * 0.8;
    w.arms[1].rotation.x = swing * 0.8;
    // (a little wind up here, from the west)
    w.scarfTail.rotation.x = 0.35 + Math.sin(this.time * 2.3) * 0.12;
    // the stones coming up out of the cloud
    for (const s of this.stones) {
      if (s.up < 0) continue;
      // (up eases in as it lands; going back down, it slips off slowly and then drops)
      const e = s.to === s.at ? 1 - Math.pow(1 - s.up, 3) : s.up * s.up * (3 - 2 * s.up);
      s.root!.position.y = (1 - e) * (CLOUD - s.top - 0.4);
    }
    this.cloudU.uTime.value += dt;
  }

  /** The view's height (m), zoom and all. */
  private get seen() {
    return this.view * this.zoomed;
  }

  private frame(dt: number) {
    const view = this.seen;
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    const want = new THREE.Vector3(this.pos.x + this.pan.x, this.pos.y + 0.6 + this.pan.y, 0);
    if (dt) this.target.lerp(want, 1 - Math.exp(-dt * 2.2));
    else this.target.copy(want);
    const t = this.target;
    cam.position.set(t.x, t.y + Math.sin(ELEVATION) * DISTANCE, t.z + Math.cos(ELEVATION) * DISTANCE);
    cam.lookAt(t);
    cam.updateMatrixWorld();
    // snap to the texel grid, and hand the remainder to the renderer
    const texel = view / this.texels();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const r = cam.position.dot(right) / texel;
    const u = cam.position.dot(up) / texel;
    const dr = Math.round(r) - r;
    const du = Math.round(u) - u;
    cam.position.addScaledVector(right, dr * texel).addScaledVector(up, du * texel);
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    this.subTexel.set(-dr, -du);
    // the horizon's at eye level, so in the same place on screen however high you climb: a little under the middle
    const horizon = -0.06;
    // the cloud runs out to wherever its far edge meets that line on screen
    const sin = Math.sin(ELEVATION);
    const cos = Math.cos(ELEVATION);
    const far = t.z - (horizon * view - (CLOUD - t.y) * cos) / sin;
    const near = t.z + 60;
    this.cloud.position.set(t.x, CLOUD, near);
    this.cloud.scale.set(view * this.aspect * 1.2 + 40, 1, near - far);
    this.cloudU.uNear.value = t.z + 10;
    this.cloudU.uFar.value = far;
    this.skyU.uHorizon.value = horizon;
    this.skyU.uTexel.value = 1 / this.texels();
    this.skyU.uAspect.value = this.aspect;
    this.skyU.uDrift.value = (t.x / view) * 0.02;
    // the numbers, a texel a mark, however near you've zoomed; and zoomed out, where one won't fit its face, none
    for (const s of this.stones) {
      if (!s.root?.visible) continue;
      s.cut!.scale.set(texel, texel / cos, 1);
      s.cut!.visible = s.wide * texel <= R * 1.02;
    }
  }
}
