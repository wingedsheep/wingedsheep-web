/**
 * Low Water's world: a tidal flat at blue hour, far out past the island. Mirror-still water a few
 * centimetres deep over the sand, low banks the slow tide covers and uncovers, and a line of
 * birch twigs (pricken) leading from one small thing to the next, out to where it gets deep.
 *
 * Its own scene and camera, drawn through the island's PixelRenderer. The sky is a band-stepped
 * backdrop that rides with the camera; the water shows it mirrored, so the horizon's warm band
 * comes back just under the horizon. Everything that stands in the water has a darker,
 * flat-coloured twin hung upside down under it, drawn over the water but never over anything in
 * front: the reflections.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { visitDate } from '../scene/calendar';
import { haloTexture } from '../scene/sky';
import { toon } from '../scene/toon';
import { Sand } from './sand';

export type StationId = 'post' | 'pricken' | 'pool' | 'ring' | 'table' | 'bench' | 'last' | 'wreck' | 'buoy' | 'stick';

/** What it's doing back on the island, as far as it carries out here. */
export interface Outside {
  rain: number;
  fog: number;
  /** 0 still … 1 a gale */
  wind: number;
  snow: number;
  /** In winter, a skin of ice where the banks meet the water. */
  winter: boolean;
}

export interface Hooks {
  /** A stone in the ring, sounded (its frequency, Hz). */
  note?(freq: number): void;
  step?(wet: boolean): void;
  /** The bell buoy, tolling: how near it is (1 beside it … 0 out of earshot) and which side (-1 … 1). */
  toll?(near: number, pan: number): void;
  /** The stick, scratching a letter into the sand. */
  scratch?(): void;
}

const ELEVATION = THREE.MathUtils.degToRad(24);
const DISTANCE = 100;
/** Walking pace (m/s). */
const PACE = 1.7;
/** And while writing in the sand, stepping along beside the line. */
const WRITING_PACE = 1.0;
/** Where the horizon sits, up from the middle of the picture (a share of its height). */
const HORIZON = 0.3;
/** The tide: how far it rises and falls (m) and how long it takes (s). */
const TIDE = 0.035;
const TIDE_PERIOD = 360;
/** Past this (going out, -z) it's deep water. */
const DEEP = -114.5;
const BASE_NOTE = 196;
/** How far short of the horizon things go under the haze for good (m). */
const SINK = 2.5;
const RATIOS = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];

// where everything is (x east, z south: the way out is -z, away from the camera)
const POST = new THREE.Vector2(-1.1, 0);
const POOL = new THREE.Vector2(-7.5, -22);
const RING = new THREE.Vector2(5.4, -46);
const RING_R = 2.6;
const TABLE = new THREE.Vector2(-4.4, -67);
const BENCH = new THREE.Vector2(4.2, -89.5);
const ROUTE = [
  [0.4, -1.5], [-2.5, -11], [-4.0, -20.5], [-1.5, -31], [1.6, -41], [1.4, -51], [-1.2, -60], [-1.5, -69],
  [0.4, -79], [1.6, -88], [0.2, -100], [-1.0, -111],
].map(([x, z]) => new THREE.Vector3(x, 0, z));
const LAST = new THREE.Vector2(-1.0, -111);
/** The wreck, off to the east of the way out, its bow swung round to the north-east (tools/models/lowwater.py). */
const WRECK = new THREE.Vector2(13, -76);
const WRECK_TURN = 0.6;
const WRECK_LENGTH = 10;
const WRECK_BEAM = 3.2;
/** The bell buoy, out in the deep water past the last twig, and where its bell and its light hang (tools/models/lowwater.py). */
const BUOY = new THREE.Vector2(7, -126);
const BUOY_LAMP = 2.48;
/** Its light: a long flash, two seconds in every ten (a safe-water mark's). */
const FLASH = 10;
const FLASH_ON = 2;

/** The broad bank west of the way out that takes writing, where the line goes (its middle, and its letters' tops), and where the stick's stuck in. */
const SAND = { x: -9.5, z: -51, rx: 11, rz: 2.6, h: 0.13 };
const LINE = new THREE.Vector2(-9.75, -51.77);
const STICK = new THREE.Vector2(-2.6, -50.4);

/** Low banks of sand: middle, half-sizes, height, and whether there's a pool in the top. */
const BANKS: { x: number; z: number; rx: number; rz: number; h: number; pool?: boolean }[] = [
  { x: POOL.x, z: POOL.y, rx: 4.2, rz: 2.3, h: 0.1, pool: true },
  { x: 4.5, z: -14, rx: 5, rz: 1.43, h: 0.07 },
  { x: 12, z: -30, rx: 4, rz: 1.04, h: 0.06 },
  { x: -9, z: -38, rx: 6, rz: 1.62, h: 0.065 },
  { x: 8.5, z: -60, rx: 6, rz: 1.69, h: 0.07 },
  { x: -2.5, z: -80, rx: 4.5, rz: 1.17, h: 0.06 },
  { x: -13, z: -95, rx: 7, rz: 1.95, h: 0.07 },
  { x: 10, z: -101, rx: 5, rz: 1.3, h: 0.06 },
  { x: -16, z: -12, rx: 6, rz: 1.56, h: 0.065 },
  { x: -18, z: -62, rx: 5, rz: 1.3, h: 0.06 },
  SAND,
];
const POOL_R = 0.42; // the pool's share of its bank
/** The pool's own water, held up in the bank whatever the tide's doing (m), and how far out it reaches. */
const POOL_Y = 0.055;
const POOL_EDGE = 0.37;

/** The bank's height at a point (m; below zero off its edges). */
function bankAt(x: number, z: number) {
  let h = -1;
  for (const [i, b] of BANKS.entries()) {
    const qx = (x - b.x) / b.rx;
    const qz = (z - b.z) / b.rz;
    const round = qx * qx + qz * qz;
    // (not quite an oval: lobed, each its own way)
    const a = Math.atan2(qz, qx);
    const k = 1 + 0.22 * Math.sin(3 * a + i * 1.7) + 0.12 * Math.sin(5 * a + i * 2.9);
    const r2 = round / (k * k);
    let y = b.h * (1 - r2);
    if (b.pool) y -= b.h * 1.2 * Math.max(0, 1 - round / (POOL_R * POOL_R));
    h = Math.max(h, y + Math.sin(x * 1.3) * Math.cos(z * 1.1) * 0.008);
  }
  return h;
}

// the palette, kept small: blue hour, and one warm band
const C = {
  coat: '#353352',
  skin: '#3a3348',
  scarf: '#efe2c6',
  boots: '#1b1a2a',
  wood: '#5d4c46',
  woodLight: '#7d6a5e',
  birch: '#aaa69f',
  birchDark: '#2f2a35',
  drift: '#9d968c',
  stone: ['#6a6f8e', '#7b809d'],
  page: '#ece6d6',
  sand: ['#5c5768', '#686274', '#757080'],
  lantern: '#ffd38a',
};
/** The water's own blue, which the reflections lean towards. */
const WATER = new THREE.Color('#3b4680');
const MIST = new THREE.Color('#a9adc6');
/** What the far things fade into on a clear evening: the horizon's own colour. */
const HORIZON_HAZE = new THREE.Color().setRGB(0.4, 0.37, 0.48, THREE.LinearSRGBColorSpace);
const PRINT = [new THREE.Color('#77708f'), new THREE.Color('#5a5a86'), new THREE.Color('#47508a')];

const SKY_GLSL = /* glsl */ `
  const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  uniform float uTexel; // one texel, in view heights
  uniform float uFog;
  uniform float uGloom;
  uniform vec3 uMist;
  float bayer() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    return (BAYER[(p.x & 3) + (p.y & 3) * 4] + 0.5) / 16.0;
  }
  // a: how far above the horizon (view heights); x: across the picture (-0.5 left … 0.5 right)
  vec3 skyAt(float a, float x) {
    float d = bayer();
    float j = (d - 0.5) * uTexel * 5.0; // each band's edge dithered over a few texels
    float warm = 1.0 - smoothstep(-0.55, 0.7, x); // the warm band, broad on the left, thinning out
    float w1 = 0.006 + 0.016 * warm;
    float w2 = w1 + 0.012 + 0.02 * warm;
    vec3 col = vec3(0.56, 0.50, 0.58);                                   // the horizon, pale
    // (where the warm band gives out, it does so in a dither, not a cut)
    if (a + j > 0.003) col = mix(vec3(0.44, 0.36, 0.48), vec3(0.92, 0.50, 0.29), step(d * 0.5 + 0.1, warm)); // apricot
    if (a + j > w1) col = mix(vec3(0.30, 0.28, 0.46), vec3(0.46, 0.32, 0.44), step(d * 0.5 + 0.2, warm));   // rose
    if (a + j > w2) col = vec3(0.22, 0.23, 0.43);
    if (a + j > 0.09) col = vec3(0.14, 0.155, 0.34);
    if (a + j > 0.17) col = vec3(0.085, 0.098, 0.25);
    if (a + j > 0.3) col = vec3(0.053, 0.062, 0.18);
    if (a + j > 0.5) col = vec3(0.034, 0.04, 0.135);
    if (a + j > 0.75) col = vec3(0.022, 0.026, 0.1);
    // rain: greyer and lower; fog: the low sky gone to mist
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(l) * vec3(0.92, 0.95, 1.08), uGloom * 0.6) * (1.0 - uGloom * 0.2);
    float mist = uFog * (1.0 - smoothstep(0.02, 0.45, a));
    col = mix(col, uMist, floor(mist * 4.0 + d) / 4.0 * 0.85);
    return col;
  }
`;

interface Mirrored {
  src: THREE.Object3D;
  copy: THREE.Object3D;
  /** Pairs of nodes whose own movement the reflection follows (the walker's legs, say). */
  parts?: [THREE.Object3D, THREE.Object3D][];
}

interface Print {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  age: number;
}

interface Ring {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
  life: number;
  size: number;
}

export class LowWater {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  /** Told about the stones and footsteps, for the sound. */
  hooks: Hooks = {};
  /** The card that wants showing (the closest thing you're at, or the one you clicked). */
  card: StationId | null = null;
  /** Sat on the bench, looking up (0 standing … 1 all the way back), and since when (s). */
  sitting = false;
  lean = 0;
  satFor = 0;
  /** How much of the wreck the sand has given back today (0 nearly none … 1 most of it). */
  readonly wreckOut = wreckOut(visitDate());

  private view = 30;
  private zoomed = 1;
  private aspect = 1;
  private time = Math.random() * TIDE_PERIOD; // (somewhere in the tide when you come)
  private level = 0;
  private walker = new THREE.Group();
  private legs: THREE.Object3D[] = [];
  private arms: THREE.Object3D[] = [];
  private scarfTail = new THREE.Group();
  private pos = new THREE.Vector3(0.6, 0, 2.4);
  private heading = Math.PI; // facing out, away from the camera
  private speed = 0;
  private goal: THREE.Vector3 | null = null;
  private goalStop = 0;
  private keys = new Set<string>();
  private stride = 0;
  private lastPrint = 0;
  private footSide = 1;
  private target = new THREE.Vector3();
  private pan = new THREE.Vector2();
  private clicked: { id: StationId; at: THREE.Vector2 } | null = null;
  private twigsSeen = false;
  private ground: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private sky: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private stars: THREE.Group;
  private starMat: THREE.ShaderMaterial;
  private lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private mirror = new THREE.Group();
  private waters: THREE.ShaderMaterial[] = [];
  private mirrored: Mirrored[] = [];
  private mirrorMats = new Map<THREE.Material, THREE.Material>();
  private pickables: THREE.Object3D[] = [];
  private obstacles: { x: number; z: number; r: number }[] = [];
  private twigs: THREE.Vector2[] = [];
  private stones: { at: THREE.Vector2; mesh: THREE.Mesh; mat: THREE.MeshToonMaterial; lit: number; armed: boolean; freq: number }[] = [];
  private specks: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private speckHome: Float32Array;
  private stir = 0;
  private prints: Print[] = [];
  private rings: Ring[] = [];
  private rainFor = 0;
  private clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  /** (and the other way, for the reflections of the wreck and the buoy) */
  private under = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private buoy?: { root: THREE.Object3D; bell?: THREE.Object3D; lamps: THREE.Object3D[]; lean: number; rising: boolean; quiet: number };
  private ice: THREE.MeshToonMaterial[] = [];
  private sand = new Sand(bankAt);
  /** The stick (where it's stuck in, and the one in your hand while you write), and the line being written. */
  private stick = { at: STICK.clone(), standing: new THREE.Group(), held: new THREE.Group() };
  private writing: { x0: number; middles: number[]; next: number; going: boolean } | null = null;
  /** Just written: the stick's card keeps quiet till you've walked off, so you can read what you wrote. */
  private justWrote = false;
  private pace = PACE;
  private outside: Outside = { rain: 0, fog: 0, wind: 0, snow: 0, winter: false };
  private hemi = new THREE.HemisphereLight('#8d9ad6', '#2a2944', 1.7);
  private sun = new THREE.DirectionalLight('#ffbf94', 1.25);
  private fill = new THREE.DirectionalLight('#7f8cc4', 0.55);
  private lamp = new THREE.PointLight(C.lantern, 2, 5, 1.5);
  private ray = new THREE.Raycaster();

  constructor(renderer: THREE.WebGLRenderer, private texels: () => number) {
    renderer.localClippingEnabled = true; // (the banks: only what's above the water)
    this.scene.background = new THREE.Color('#1c2048');
    this.scene.fog = new THREE.Fog(HORIZON_HAZE.clone(), DISTANCE + 8, DISTANCE + 22);
    this.sun.position.set(-30, 22, -60);
    this.fill.position.set(10, 30, 60);
    this.scene.add(this.hemi, this.sun, this.fill, this.camera, this.mirror);
    this.ground = this.makeGround();
    this.sky = this.makeSky();
    const { group, mat, lines } = this.makeStars();
    this.stars = group;
    this.starMat = mat;
    this.lines = lines;
    this.makeBanks();
    this.makeWalker();
    this.makeStations();
    this.makeStick();
    this.specks = this.makePool();
    this.speckHome = (this.specks.geometry.attributes.position.array as Float32Array).slice();
    this.makePrints();
    this.makeRings();
    void this.makeModels();
    this.resize(innerWidth, innerHeight);
    this.frame(0);
  }

  // --- building it ------------------------------------------------------------------------

  private makeGround() {
    const mat = this.water();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    // and the pool on top of its bank, never drained: it has its own level
    const b = BANKS[0];
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), this.water(POOL_Y));
    pool.scale.set(b.rx * POOL_EDGE, 1, b.rz * POOL_EDGE);
    pool.position.set(b.x, POOL_Y, b.z);
    pool.renderOrder = -10;
    this.scene.add(pool);
    return mesh;
  }

  /** Water that shows the sky mirrored (at the tide's level, or at its own). */
  private water(level?: number) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTexel: { value: 0.003 },
        uFog: { value: 0 },
        uGloom: { value: 0 },
        uMist: { value: MIST.clone() },
        uHorizon: { value: 0 },
        uView: { value: 30 },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uLevel: { value: 0 },
        uWind: { value: 0 },
        uDeep: { value: DEEP },
        uSolid: { value: 0 },
        uAhead: { value: new THREE.Vector2() },
        uBanks: { value: BANKS.map((b) => new THREE.Vector4(b.x, b.z, b.rx, b.rz)) },
        uBankH: { value: BANKS.map((b) => new THREE.Vector2(b.h, b.pool ? 1 : 0)) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec2 vView;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vec4 v = viewMatrix * w;
          vView = v.xy;
          gl_Position = projectionMatrix * v;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${SKY_GLSL}
        uniform float uHorizon;
        uniform float uView;
        uniform float uAspect;
        uniform float uTime;
        uniform float uLevel;
        uniform float uWind;
        uniform float uDeep;
        uniform float uSolid; // (the pool, seen from far off: just more of its bank)
        uniform vec2 uAhead; // where the camera's looking from (z), and how far ahead the mist starts
        uniform vec4 uBanks[${BANKS.length}];
        uniform vec2 uBankH[${BANKS.length}];
        varying vec3 vWorld;
        varying vec2 vView;
        float bank(vec2 p) {
          float h = -1.0;
          for (int i = 0; i < ${BANKS.length}; i++) {
            vec2 q = (p - uBanks[i].xy) / uBanks[i].zw;
            float round = dot(q, q);
            float a = atan(q.y, q.x);
            float k = 1.0 + 0.22 * sin(3.0 * a + float(i) * 1.7) + 0.12 * sin(5.0 * a + float(i) * 2.9);
            float y = uBankH[i].x * (1.0 - round / (k * k));
            if (uBankH[i].y > 0.5) y -= uBankH[i].x * 1.2 * max(0.0, 1.0 - round / ${(POOL_R * POOL_R).toFixed(4)});
            h = max(h, y);
          }
          return h;
        }
        void main() {
          vec2 p = vWorld.xz;
          float d = bayer();
          // the sky, mirrored: as far below the horizon as it is above it
          float a = (uHorizon - vView.y) / uView;
          float x = vView.x / (uView * uAspect);
          // the water barely moving: long low glints and darker swells, more of both in a wind
          float r = sin(p.x * 0.55 + uTime * 0.5 + sin(p.y * 1.6 + uTime * 0.7) * 1.4) * sin(p.y * 3.3 - uTime * 0.9 + p.x * 0.15);
          float calm = 1.0 - uWind;
          a -= step(0.9 + calm * 0.08, r) * 0.025;
          a += step(r, -0.93 - calm * 0.06) * 0.04;
          vec3 col = skyAt(max(a, 0.0) * 0.8, x) * 0.86 + vec3(0.0, 0.004, 0.012);
          // a few centimetres over the sand: the sand shows through, wetter and darker
          float over = uLevel - bank(p);
          vec3 wet = vec3(0.16, 0.15, 0.22);
          col = mix(col, wet, step(over, 0.022 + (d - 0.5) * 0.008) * 0.35 + step(over, 0.009) * 0.25);
          // past the last twig the bottom drops away: dark, cold water
          float deep = step(p.y, uDeep + sin(p.x * 0.7) * 0.6 + (d - 0.5) * 0.5);
          col = mix(col, col * vec3(0.48, 0.52, 0.66), deep);
          // fog: the far water goes to mist, in dithered steps
          float ahead = uAhead.x - p.y;
          float f = clamp((ahead - uAhead.y) / 10.0, 0.0, 1.0) * uFog;
          col = mix(col, uMist, floor(f * 4.0 + d) / 4.0 * 0.9);
          gl_FragColor = vec4(mix(col, vec3(0.1, 0.09, 0.13), uSolid), 1.0);
        }
      `,
    });
    mat.userData.level = level;
    this.waters.push(mat);
    return mat;
  }

  private makeSky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTexel: { value: 0.003 },
        uFog: { value: 0 },
        uGloom: { value: 0 },
        uMist: { value: MIST.clone() },
        uHorizon: { value: 0 },
        uView: { value: 30 },
        uAspect: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vView;
        void main() {
          vec4 v = modelViewMatrix * vec4(position, 1.0);
          vView = v.xy;
          gl_Position = projectionMatrix * v;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${SKY_GLSL}
        uniform float uHorizon;
        uniform float uView;
        uniform float uAspect;
        varying vec2 vView;
        void main() {
          gl_FragColor = vec4(skyAt((vView.y - uHorizon) / uView, vView.x / (uView * uAspect)), 1.0);
        }
      `,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.renderOrder = -20;
    mesh.frustumCulled = false;
    this.camera.add(mesh);
    return mesh;
  }

  /**
   * The stars, a scatter of them, and two shapes everyone from up north knows: the Plough and
   * Cassiopeia's W, high enough that you have to sit back to see them. In sky units: across, and
   * up from the horizon, both in view heights.
   */
  private makeStars() {
    const rand = mulberry(7);
    const pos: number[] = [];
    const bright: number[] = [];
    for (let i = 0; i < 170; i++) {
      pos.push((rand() - 0.5) * 3, 0.12 + rand() ** 0.8 * 1.0, 0);
      bright.push(rand() < 0.12 ? 1 : rand() < 0.5 ? 0.6 : 0.35);
    }
    // the Plough (the seven of the Big Dipper), handle up to the left; Cassiopeia's W, higher, to the right
    const plough = [[-0.42, 0.42], [-0.34, 0.47], [-0.27, 0.49], [-0.19, 0.47], [-0.17, 0.39], [-0.06, 0.4], [-0.06, 0.5]];
    const cas = [[0.06, 0.74], [0.12, 0.66], [0.18, 0.71], [0.24, 0.64], [0.31, 0.69]];
    for (const [x, y] of [...plough, ...cas]) {
      pos.push(x, y, 0);
      bright.push(1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('bright', new THREE.Float32BufferAttribute(bright, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uShow: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float bright;
        uniform float uShow;
        uniform float uTime;
        varying float vLevel;
        void main() {
          vec4 v = modelViewMatrix * vec4(position, 1.0);
          // a slow, stepped twinkle
          float tw = step(0.93, fract(sin(dot(position.xy, vec2(91.7, 37.3)) + floor(uTime * 1.5 + position.x * 9.0)) * 4375.85));
          vLevel = bright * uShow * clamp(position.y * 3.0 - 0.3, 0.0, 1.0) * (1.0 - tw * 0.5);
          gl_PointSize = bright > 0.9 ? 2.0 : 1.0;
          gl_Position = projectionMatrix * v;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLevel;
        void main() {
          if (vLevel < 0.12) discard;
          // three steps of brightness, no more
          float l = vLevel > 0.7 ? 1.0 : vLevel > 0.35 ? 0.72 : 0.5;
          gl_FragColor = vec4(mix(vec3(0.35, 0.4, 0.65), vec3(0.96, 0.95, 1.0), l), 1.0);
        }
      `,
      depthWrite: false,
      fog: false,
    });
    const group = new THREE.Group();
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    group.add(points);
    // the shapes drawn between them, faintly, only when you're sat looking up
    const seg: number[] = [];
    const join = (list: number[][], pairs: number[][]) => {
      for (const [a, b] of pairs) seg.push(list[a][0], list[a][1], 0, list[b][0], list[b][1], 0);
    };
    join(plough, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]);
    join(cas, [[0, 1], [1, 2], [2, 3], [3, 4]]);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#141a40', depthWrite: false, fog: false }));
    lines.frustumCulled = false;
    lines.visible = false;
    group.add(lines);
    this.camera.add(group);
    return { group, mat, lines };
  }

  /** The banks, each a low mound cut off at the water (wherever the tide has it). */
  private makeBanks() {
    const sand = C.sand.map((c) => new THREE.Color(c));
    for (const b of BANKS) {
      const geo = new THREE.PlaneGeometry(b.rx * 3.6, b.rz * 3.6, 44, 22).rotateX(-Math.PI / 2).toNonIndexed();
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, bankAt(p.getX(i) + b.x, p.getZ(i) + b.z));
      // per face, by how high it stands: wet at the edges, drier and paler on top
      const colors = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i += 3) {
        const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
        const c = sand[y > 0.055 ? 2 : y > 0.025 ? 1 : 0];
        for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mat = paint(new THREE.Color('#ffffff'), { vertexColors: true });
      mat.clippingPlanes = [this.clip];
      mat.fog = false; // (far off they stay low dark slivers on the water, never pale haze)
      this.ice.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.x, 0, b.z);
      this.scene.add(mesh);
    }
  }

  /** You: a small dark figure in a long coat, with a pale scarf that the wind gets at. */
  private makeWalker() {
    const w = this.walker;
    const coat = paint(new THREE.Color(C.coat));
    const boots = paint(new THREE.Color(C.boots));
    const scarf = paint(new THREE.Color(C.scarf));
    const head = paint(new THREE.Color(C.skin));
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.1, 0.82, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.82, 0.15), boots);
      leg.position.y = -0.41;
      hip.add(leg);
      w.add(hip);
      this.legs.push(hip);
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.25, 1.42, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.12), coat);
      arm.position.y = -0.3;
      shoulder.add(arm);
      w.add(shoulder);
      this.arms.push(shoulder);
    }
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.78, 6), coat);
    body.position.y = 1.1;
    w.add(body);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 6), scarf);
    ring.position.y = 1.52;
    w.add(ring);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.04), scarf);
    tail.position.set(0, -0.18, 0);
    this.scarfTail.position.set(0.08, 1.52, -0.17);
    this.scarfTail.add(tail);
    w.add(this.scarfTail);
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), head);
    skull.position.y = 1.7;
    w.add(skull, this.heldStick());
    w.position.copy(this.pos);
    this.scene.add(w);
    const parts: [THREE.Object3D, THREE.Object3D][] = [];
    const copy = this.reflect(w);
    const a: THREE.Object3D[] = [];
    const b: THREE.Object3D[] = [];
    w.traverse((o) => a.push(o));
    copy.traverse((o) => b.push(o));
    a.forEach((o, i) => parts.push([o, b[i]]));
    this.mirrored[this.mirrored.length - 1].parts = parts;
  }

  private makeStations() {
    const wood = paint(new THREE.Color(C.wood));
    const light = paint(new THREE.Color(C.woodLight));
    // the post, at the start, with a plank nailed on for a sign
    const post = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.55, 6), wood);
    pole.position.y = 0.72;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.05), light);
    plank.position.set(0.04, 1.2, 0.07);
    plank.rotation.z = -0.06;
    post.add(pole, plank);
    this.put(post, POST, 'post', 0.3);

    // the twigs, every few metres along the way out
    const curve = new THREE.CatmullRomCurve3(ROUTE, false, 'centripetal');
    const length = curve.getLength();
    const birch = paint(new THREE.Color(C.birch), { glow: true }); // (pale grey bark, even with the light behind them)
    const mark = paint(new THREE.Color(C.birchDark));
    const rand = mulberry(3);
    const n = Math.floor(length / 4.2);
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n);
      const last = i === n;
      const twig = new THREE.Group();
      const h = last ? 1.7 : 1.25 + rand() * 0.3;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, h, 5), birch);
      stem.position.y = h / 2 - 0.05;
      twig.add(stem);
      // a dark mark or two on the bark, and the twiglets left on at the top
      for (const at of [0.3 + rand() * 0.15, 0.6 + rand() * 0.2]) {
        const node = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.1), mark);
        node.position.y = h * at;
        twig.add(node);
      }
      for (let k = 0; k < 3; k++) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.32, 0.025), mark);
        const a = rand() * Math.PI * 2;
        g.position.set(Math.cos(a) * 0.06, h - 0.02, Math.sin(a) * 0.06);
        g.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
        twig.add(g);
      }
      twig.rotation.set((rand() - 0.5) * 0.12, rand() * 6, (rand() - 0.5) * 0.12);
      if (last) {
        // a lantern hung on the last one, out where it gets deep
        const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), paint(new THREE.Color(C.lantern), { glow: true }));
        (lantern.material as THREE.MeshToonMaterial).emissiveIntensity = 1.2;
        lantern.position.set(0.12, h - 0.25, 0);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), mark);
        cap.position.set(0.12, h - 0.14, 0);
        twig.add(lantern, cap);
        this.lamp.position.set(p.x + 0.12, h - 0.2, p.z);
        this.scene.add(this.lamp);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: C.lantern, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
        halo.scale.setScalar(1.3);
        halo.position.set(p.x + 0.12, h - 0.25, p.z);
        halo.renderOrder = 6;
        this.scene.add(halo);
      }
      this.put(twig, new THREE.Vector2(p.x, p.z), last ? 'last' : 'pricken', 0.12);
      this.twigs.push(new THREE.Vector2(p.x, p.z));
    }

    // the stone ring: eight low stones, each its own note
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const at = new THREE.Vector2(RING.x + Math.cos(a) * RING_R, RING.y + Math.sin(a) * RING_R);
      const mat = paint(new THREE.Color(C.stone[i % 2]));
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat);
      stone.scale.set(1, 0.55, 0.85);
      stone.rotation.y = a * 1.7;
      stone.position.y = 0.08;
      const g = new THREE.Group();
      g.add(stone);
      this.put(g, at, 'ring', 0.4, `stone:${i}`);
      this.stones.push({ at, mesh: stone, mat, lit: 0, armed: true, freq: BASE_NOTE * RATIOS[i] });
    }

    // the table, standing in the water, a page held down by a stone
    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), light);
    top.position.y = 0.74;
    table.add(top);
    for (const [x, z] of [[-0.38, -0.24], [0.38, -0.24], [-0.38, 0.24], [0.38, 0.24]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.05), wood);
      leg.position.set(x, 0.37, z);
      table.add(leg);
    }
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.4), paint(new THREE.Color(C.page)));
    page.position.set(0.05, 0.77, 0.02);
    page.rotation.y = 0.15;
    const weight = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), paint(new THREE.Color(C.stone[0])));
    weight.scale.set(1, 0.6, 1);
    weight.position.set(0.1, 0.8, -0.08);
    table.add(page, weight);
    table.rotation.y = 0.3;
    this.put(table, TABLE, 'table', 0.6);

    // the bench, facing the last of the light
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.4), light);
    seat.position.y = 0.46;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.05), light);
    back.position.set(0, 0.78, 0.2);
    bench.add(seat, back);
    for (const x of [-0.62, 0.62]) {
      for (const z of [-0.15, 0.18]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, z > 0 ? 0.9 : 0.46, 0.06), wood);
        leg.position.set(x, z > 0 ? 0.45 : 0.23, z);
        bench.add(leg);
      }
    }
    this.put(bench, BENCH, 'bench', 0.85);
  }

  /** A stick of driftwood stuck in the bank that takes writing, and its twin for your hand. */
  private makeStick() {
    const wood = paint(new THREE.Color(C.drift), { glow: true }); // (bleached, like the twigs, so it shows against the sand)
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.05, 5), wood);
    shaft.position.y = 0.45;
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.22, 4), wood);
    fork.position.set(0.05, 0.9, 0);
    fork.rotation.z = -0.6;
    const g = this.stick.standing;
    g.add(shaft, fork);
    g.rotation.set(0.12, 0.4, -0.18);
    this.put(g, STICK, 'stick', 0);
    this.scene.add(this.sand.mesh);
  }

  /** The stick again, for your hand while you write (hidden till then). */
  private heldStick() {
    const wood = paint(new THREE.Color(C.drift), { glow: true });
    // in your hand: from the left hand (the side the line's on) down to the sand beside you
    const hand = new THREE.Vector3(-0.45, 0.88, 0.17);
    const tip = new THREE.Vector3(-0.78, 0.0, 0.42);
    const held = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, hand.distanceTo(tip), 5), wood);
    held.position.copy(hand).add(tip).multiplyScalar(0.5);
    held.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hand.clone().sub(tip).normalize());
    this.stick.held.add(held);
    this.stick.held.scale.setScalar(0);
    return this.stick.held;
  }

  /** The tide pool's noctiluca: specks that light up when you walk through and go dark when you're still. */
  private makePool() {
    const rand = mulberry(11);
    const b = BANKS[0];
    const pos: number[] = [];
    for (let i = 0; i < 140; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * POOL_EDGE * 0.9;
      pos.push(b.x + Math.cos(a) * r * b.rx, 0.06, b.z + Math.sin(a) * r * b.rz);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.Float32BufferAttribute(Array.from({ length: pos.length / 3 }, rand), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uStir: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float uStir;
        uniform float uTime;
        varying float vLevel;
        void main() {
          // each lights up at its own threshold, and flickers as it's jostled
          float on = uStir * (0.6 + 0.6 * sin(uTime * (3.0 + seed * 5.0) + seed * 40.0));
          vLevel = step(seed * 0.8 + 0.1, on) + step(seed * 0.5 + 0.5, on);
          gl_PointSize = vLevel > 1.5 && seed > 0.7 ? 2.0 : 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLevel;
        void main() {
          if (vLevel < 0.5) discard;
          gl_FragColor = vec4(vLevel > 1.5 ? vec3(0.72, 0.98, 1.0) : vec3(0.3, 0.72, 0.86), 1.0);
        }
      `,
      depthWrite: false,
      fog: false,
    });
    const points = new THREE.Points(geo, mat);
    points.renderOrder = 4;
    points.frustumCulled = false;
    this.scene.add(points);
    // what you click is the pool itself, a disc of water on the bank's top
    const hit = new THREE.Mesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
    hit.scale.set(b.rx * POOL_R, 1, b.rz * POOL_R);
    hit.position.set(b.x, 0.05, b.z);
    hit.userData.id = 'pool';
    this.scene.add(hit);
    this.pickables.push(hit);
    return points;
  }

  private makePrints() {
    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.22).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PRINT[0], depthWrite: false, transparent: true, fog: false }));
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.prints.push({ mesh, age: 99 });
    }
  }

  /** What's modelled in Blender (tools/models/lowwater.py), loaded once you're out here. */
  private async makeModels() {
    const gltf = await new GLTFLoader().loadAsync(`/models/lowwater.glb?v=${__MODELS__}`);
    const find = (kind: string) => {
      const o = gltf.scene.children.find((c) => c.userData.lowwater === kind);
      o?.removeFromParent();
      return o;
    };
    const wreck = find('wreck');
    if (wreck) this.makeWreck(wreck);
    const buoy = find('buoy');
    if (buoy) this.makeBuoy(buoy);
  }

  /**
   * The wreck. The sand over it moves from day to day (not with the tide: that's too small out
   * here to cover it), so it sits deeper on some days than on others, and what's under the
   * waterline is cut away, reflection and all.
   */
  private makeWreck(wreck: THREE.Object3D) {
    const under = this.under;
    wreck.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = paint((mesh.material as THREE.MeshStandardMaterial).color);
      mat.clippingPlanes = [this.clip];
      mesh.material = mat;
    });
    const g = new THREE.Group();
    wreck.position.set(0, 0, 0);
    g.add(wreck);
    this.put(g, WRECK, 'wreck', 0);
    g.rotation.y = WRECK_TURN;
    g.position.y -= 0.05 + (1 - this.wreckOut) * 0.7;
    // its reflection, cut the other way: only what's above the water shows in it
    const copy = this.mirrored[this.mirrored.length - 1].copy;
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshBasicMaterial).clone();
      mat.clippingPlanes = [under];
      mesh.material = mat;
    });
    // its sides are in the way; the stern's broken open, so you can walk in along the keel
    const along = new THREE.Vector2(Math.cos(WRECK_TURN), -Math.sin(WRECK_TURN));
    const across = new THREE.Vector2(-along.y, along.x);
    for (let i = 0; i <= 14; i++) {
      const t = -0.9 + (1.8 * i) / 14;
      const half = wreckHalfBeam(t);
      for (const side of [-1, 1]) {
        const p = WRECK.clone().addScaledVector(along, (t * WRECK_LENGTH) / 2).addScaledVector(across, half * side);
        this.obstacles.push({ x: p.x, z: p.y, r: 0.2 });
      }
    }
    const stem = WRECK.clone().addScaledVector(along, WRECK_LENGTH / 2 + 0.2);
    this.obstacles.push({ x: stem.x, z: stem.y, r: 0.3 });
  }

  /**
   * The bell buoy, out where it's too deep to walk. It rocks on the swell, more in a wind, and
   * when it leans far enough a clapper swings into the bell; at the top of its cage, a long white
   * flash every ten seconds. Only what's above the water shows, and in the water.
   */
  private makeBuoy(model: THREE.Object3D) {
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = paint((mesh.material as THREE.MeshStandardMaterial).color);
      mat.clippingPlanes = [this.clip];
      mesh.material = mat;
    });
    model.position.set(0, 0, 0);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.13), paint(new THREE.Color('#f4f1e6'), { glow: true }));
    (lamp.material as THREE.MeshToonMaterial).emissiveIntensity = 1.3;
    lamp.name = 'lamp';
    lamp.position.y = BUOY_LAMP;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: '#e8ecff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    halo.scale.setScalar(1.4);
    halo.position.y = BUOY_LAMP;
    halo.renderOrder = 6;
    const g = new THREE.Group();
    g.add(model, lamp, halo);
    this.put(g, BUOY, 'buoy', 0);
    const copy = this.mirrored[this.mirrored.length - 1].copy;
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshBasicMaterial).clone();
      mat.clippingPlanes = [this.under];
      // (its paint is pale, and unlit it would come back brighter than it is)
      if (mesh.name !== 'lamp') mat.color.lerp(WATER, 0.4).multiplyScalar(0.5);
      mesh.material = mat;
    });
    // the reflection follows the bell's swing, and flashes with the light
    const a: THREE.Object3D[] = [];
    const b: THREE.Object3D[] = [];
    g.traverse((o) => a.push(o));
    copy.traverse((o) => b.push(o));
    this.mirrored[this.mirrored.length - 1].parts = a.map((o, i) => [o, b[i]]);
    const lamps = [lamp, halo, b[a.indexOf(lamp)], b[a.indexOf(halo)]];
    this.buoy = { root: g, bell: model.getObjectByName('buoy_bell'), lamps, lean: 0, rising: false, quiet: 0 };
  }

  private makeRings() {
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#9aa6d4', depthWrite: false, transparent: true, fog: false }));
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      this.rings.push({ mesh, age: 99, life: 1, size: 0.3 });
    }
  }

  /** Stand something on the flat (with its reflection), clickable as `id`, and in the way. */
  private put(obj: THREE.Object3D, at: THREE.Vector2, id: StationId, r: number, name: string = id) {
    obj.position.set(at.x, Math.max(0, bankAt(at.x, at.y)) - 0.02, at.y);
    obj.userData.id = name;
    this.scene.add(obj);
    this.pickables.push(obj);
    if (r > 0) this.obstacles.push({ x: at.x, z: at.y, r });
    this.reflect(obj);
  }

  /** Its twin under the water: the same shapes upside down, in flat colours leaning to the water's blue. */
  private reflect(obj: THREE.Object3D) {
    const copy = obj.clone(true);
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshToonMaterial;
      let mat = this.mirrorMats.get(src);
      if (!mat) {
        const glow = src.userData.glow;
        const c = src.color.clone();
        if (!glow) c.lerp(WATER, 0.45).multiplyScalar(0.72);
        mat = steppedFog(new THREE.MeshBasicMaterial({ color: c, depthTest: false, depthWrite: false, fog: true }));
        this.mirrorMats.set(src, mat);
      }
      mesh.material = mat;
      mesh.renderOrder = -5;
    });
    copy.matrixAutoUpdate = false;
    delete copy.userData.id;
    this.mirror.add(copy);
    this.mirrored.push({ src: obj, copy });
    return copy;
  }

  // --- input ----------------------------------------------------------------------------

  key(code: string, down: boolean) {
    const k = KEYS[code];
    if (!k) return false;
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    if (down) (this.goal = null), this.stopWriting();
    return true;
  }

  releaseKeys() {
    this.keys.clear();
  }

  /** What's under the pointer, if it's anything. */
  pick(ndc: THREE.Vector2): string | null {
    this.ray.setFromCamera(ndc, this.camera);
    for (const hit of this.ray.intersectObjects(this.pickables, true)) {
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (o.userData.id) return o.userData.id;
    }
    return null;
  }

  /** A click on the flat: walk there, or up to the thing clicked and show its card (a stone sounds). */
  click(ndc: THREE.Vector2) {
    this.stopWriting();
    const id = this.pick(ndc);
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (id) {
      const obj = this.pickables.find((o) => o.userData.id === id)!;
      const at = obj.getWorldPosition(new THREE.Vector3());
      const station = (id.startsWith('stone:') ? 'ring' : id) as StationId;
      if (id.startsWith('stone:')) this.sound(Number(id.slice(6)));
      if (station === 'pool') this.stir = Math.max(this.stir, 0.7);
      this.clicked = { id: station, at: new THREE.Vector2(at.x, at.z) };
      this.walkTo(at, station === 'ring' ? 0.75 : station === 'pool' ? 2.2 : station === 'wreck' ? 4.5 : station === 'stick' ? 0.8 : station === 'pricken' || station === 'last' ? 0.6 : 1.1);
      return;
    }
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.level), p)) this.walkTo(p, 0);
  }

  private walkTo(p: THREE.Vector3, stop: number) {
    // (only as far as the edge of the deep water: anything past it, you look at from there)
    if (p.z < DEEP + 0.6) {
      const k = (DEEP + 0.6 - this.pos.z) / (p.z - this.pos.z);
      p = new THREE.Vector3(this.pos.x + (p.x - this.pos.x) * k, 0, DEEP + 0.6);
      stop = 0;
    }
    this.goal = new THREE.Vector3(p.x, 0, p.z);
    this.goalStop = stop;
  }

  /** Whether you're off writing in the sand. */
  get scratching() {
    return !!this.writing;
  }

  /**
   * Write a line in the sand (one that sandable() has made writable): you take the stick, walk
   * to where the line starts, and step along it, cutting each letter as the stick gets there.
   */
  write(line: string) {
    if (!line || this.sitting) return;
    this.stopWriting();
    const x0 = LINE.x - Sand.width(line) / 2;
    this.sand.lay(line, x0, LINE.y);
    this.writing = { x0, middles: Sand.middles(line), next: 0, going: true };
    this.clicked = null;
    this.keys.clear();
    this.walkTo(new THREE.Vector3(x0 - 0.5, 0, LINE.y - 0.45), 0);
    this.stick.standing.scale.setScalar(0);
    this.stick.held.scale.setScalar(1);
  }

  /** Done, or called away: the stick goes back in the sand, just past where you got to. */
  private stopWriting(done = false) {
    const w = this.writing;
    if (!w) return;
    this.writing = null;
    this.sand.abandon();
    this.pace = PACE;
    const at = this.stick.at.set(this.pos.x + Math.sin(this.heading) * 0.5, this.pos.z + Math.cos(this.heading) * 0.5 + 0.2);
    if (done) {
      // after the last letter, and the view drifts back to take in the whole line
      at.set(this.pos.x + 0.5, LINE.y + 0.9);
      this.pan.set(THREE.MathUtils.clamp(LINE.x - this.pos.x, -12, 12), 0);
      this.justWrote = true;
    }
    this.stick.standing.position.set(at.x, Math.max(0, bankAt(at.x, at.y)) - 0.02, at.y);
    this.stick.standing.scale.setScalar(1);
    this.stick.held.scale.setScalar(0);
  }

  /** Writing: first to the line's start, then along it at a writer's pace. */
  private writeAlong() {
    const w = this.writing!;
    if (w.going) {
      if (this.goal) return;
      w.going = false;
      this.pace = WRITING_PACE;
      this.goal = new THREE.Vector3(w.x0 + w.middles[w.middles.length - 1] + 0.1, 0, LINE.y - 0.45);
      this.goalStop = 0;
      return;
    }
    // (the stick's tip is a little ahead of you)
    while (w.next < w.middles.length && this.pos.x + 0.42 >= w.x0 + w.middles[w.next]) {
      this.sand.cut(w.next++, this.level);
      this.hooks.scratch?.();
    }
    if (!this.goal) this.stopWriting(true);
  }

  sit() {
    if (this.sitting) return;
    this.sitting = true;
    this.satFor = 0;
    this.goal = null;
    this.keys.clear();
    // onto the bench, facing the way it does
    this.pos.set(BENCH.x, 0, BENCH.y + 0.02);
    this.heading = Math.PI;
  }

  stand() {
    if (!this.sitting) return;
    this.sitting = false;
    this.pos.set(BENCH.x, 0, BENCH.y + 0.85);
  }

  zoom(factor: number) {
    if (this.sitting) return;
    this.zoomed = THREE.MathUtils.clamp(this.zoomed * factor, 0.6, 1.5);
  }

  /** A drag looks around a little; walking brings the view back to you. */
  drag(dx: number, dy: number, height: number) {
    if (this.sitting) return;
    const per = (this.view * this.zoomed) / height;
    this.pan.x = THREE.MathUtils.clamp(this.pan.x - dx * per, -12, 12);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y - (dy * per) / Math.sin(ELEVATION), -14, 14);
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
    // enough of the flat either side on a narrow phone
    this.view = Math.max(24, Math.min(32, 22 / this.aspect + 12));
  }

  /** Where something is on screen, in CSS px. */
  onScreen(at: THREE.Vector3, width: number, height: number) {
    const p = at.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height };
  }

  // --- each frame -------------------------------------------------------------------------

  update(dt: number, outside: Outside, still: boolean) {
    this.outside = outside;
    this.time += dt;
    // the tide, breathing in and out over six minutes
    this.level = Math.sin((this.time / TIDE_PERIOD) * Math.PI * 2) * TIDE;
    this.clip.constant = -this.level;
    this.under.constant = this.level;
    this.walk(dt);
    this.animateWalker(still);
    this.near();
    this.ring(dt);
    this.rock(dt);
    this.glow(dt);
    this.footprints(dt);
    this.sand.update(dt, this.level);
    this.rain(dt, still);
    this.weather();
    this.frame(dt);
  }

  private walk(dt: number) {
    if (this.writing) this.writeAlong();
    if (this.sitting) {
      this.speed = 0;
      this.satFor += dt;
      this.lean = Math.min(1, this.lean + dt / 5);
      return;
    }
    this.lean = Math.max(0, this.lean - dt / 1.6);
    const move = new THREE.Vector2();
    if (this.keys.has('up')) move.y -= 1;
    if (this.keys.has('down')) move.y += 1;
    if (this.keys.has('left')) move.x -= 1;
    if (this.keys.has('right')) move.x += 1;
    let want = 0;
    if (move.lengthSq()) {
      move.normalize();
      want = PACE;
    } else if (this.goal) {
      const dx = this.goal.x - this.pos.x;
      const dz = this.goal.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d <= Math.max(0.08, this.goalStop)) {
        this.goal = null;
      } else {
        move.set(dx / d, dz / d);
        want = this.pace * Math.min(1, (d - this.goalStop) / 0.4 + 0.3);
      }
    }
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * 8));
    if (this.speed < 0.02 && !want) {
      this.speed = 0;
      return;
    }
    if (move.lengthSq()) {
      const face = Math.atan2(move.x, move.y);
      let turn = face - this.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      this.heading += turn * (1 - Math.exp(-dt * 10));
    }
    const step = this.speed * dt;
    const nx = this.pos.x + Math.sin(this.heading) * step;
    const nz = this.pos.z + Math.cos(this.heading) * step;
    this.pos.x = THREE.MathUtils.clamp(nx, -40, 40);
    this.pos.z = THREE.MathUtils.clamp(nz, DEEP + 0.6, 14);
    // round things, not through them
    for (const o of this.obstacles) {
      const dx = this.pos.x - o.x;
      const dz = this.pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const r = o.r + 0.22;
      if (d < r && d > 1e-4) {
        this.pos.x = o.x + (dx / d) * r;
        this.pos.z = o.z + (dz / d) * r;
      }
    }
    if (this.pan.lengthSq()) this.pan.multiplyScalar(Math.exp(-dt * 1.5));
    this.stride += step;
    if (this.stride - this.lastPrint > 0.42) {
      this.lastPrint = this.stride;
      this.print();
    }
  }

  private animateWalker(still: boolean) {
    const w = this.walker;
    const ground = Math.max(this.level, bankAt(this.pos.x, this.pos.z));
    w.position.set(this.pos.x, this.sitting ? Math.max(0, bankAt(BENCH.x, BENCH.y)) - 0.36 : ground, this.pos.z);
    w.rotation.y = this.heading;
    const swing = this.sitting ? 0 : Math.sin(this.stride * 7.4) * Math.min(1, this.speed / PACE) * 0.5;
    this.legs[0].rotation.x = this.sitting ? -1.45 : swing;
    this.legs[1].rotation.x = this.sitting ? -1.45 : -swing;
    this.arms[0].rotation.x = this.sitting ? -0.5 : -swing * 0.8;
    this.arms[1].rotation.x = this.sitting ? -0.5 : swing * 0.8;
    // writing: the left arm out and down to the stick, the tip working at the letters
    const cutting = this.writing && !this.writing.going;
    if (cutting) this.arms[0].rotation.x = -0.3 + Math.sin(this.time * 9) * 0.05;
    this.arms[0].rotation.z = cutting ? -0.35 : 0;
    this.stick.held.rotation.y = cutting && !still ? Math.sin(this.time * 11) * 0.06 : 0;
    // the scarf's end, lifting and flapping in the wind
    const wind = this.outside.wind;
    const flap = still ? 0 : Math.sin(this.time * (3 + wind * 9)) * (0.08 + wind * 0.25);
    this.scarfTail.rotation.x = 0.15 + wind * 0.9 + flap + this.speed * 0.15;
  }

  /** Which card wants showing: the thing you clicked (until you wander off), or what you're at. */
  private near() {
    const at = new THREE.Vector2(this.pos.x, this.pos.z);
    if (this.writing) {
      this.card = null;
      return;
    }
    if (this.clicked) {
      if (at.distanceTo(this.clicked.at) < (this.clicked.id === 'ring' ? RING_R + 3 : this.clicked.id === 'wreck' ? 6.5 : this.clicked.id === 'buoy' ? 19 : 4.5) || this.goal) {
        this.card = this.clicked.id;
        return;
      }
      this.clicked = null;
    }
    const twig = this.twigs.slice(0, -1).some((t) => t.distanceTo(at) < 1.3);
    if (twig && !this.twigsSeen && at.distanceTo(POST) > 3) {
      this.twigsSeen = true;
      this.clicked = { id: 'pricken', at: at.clone() };
      this.card = 'pricken';
      return;
    }
    const places: [StationId, THREE.Vector2, number][] = [
      ['post', POST, 3.2], ['pool', POOL, 4.2], ['ring', RING, RING_R + 1.8], ['table', TABLE, 2.8], ['bench', BENCH, 2.8], ['last', LAST, 3.2], ['wreck', WRECK, 6.2], ['buoy', BUOY, 15], ['stick', this.stick.at, 2.2],
    ];
    let best: StationId | null = null;
    let bestD = Infinity;
    if (this.justWrote && at.distanceTo(this.stick.at) > 3.5) this.justWrote = false;
    for (const [id, p, r] of places) {
      if (id === 'stick' && this.justWrote) continue;
      const d = at.distanceTo(p);
      if (d < r && d < bestD) (best = id), (bestD = d);
    }
    this.card = this.sitting ? 'bench' : best;
  }

  /** The stones: step up beside one and it sounds; it'll sound again once you've stepped away. */
  private ring(dt: number) {
    const at = new THREE.Vector2(this.pos.x, this.pos.z);
    this.stones.forEach((s, i) => {
      const d = s.at.distanceTo(at);
      if (d < 0.95 && s.armed && !this.sitting) this.sound(i);
      if (d > 1.35) s.armed = true;
      s.lit = Math.max(0, s.lit - dt / 1.4);
      // lit up when it sounds, in two steps back down
      const step = s.lit > 0.55 ? 0.55 : s.lit > 0.15 ? 0.25 : 0;
      s.mat.emissive.setRGB(step * 0.8, step * 0.85, step);
    });
  }

  /**
   * The buoy on the swell: two slow rolls that drift in and out of step, so it leans furthest
   * only now and then on a still evening, and over and over in a wind. When it swings back from
   * a lean far enough over, a clapper carries on into the bell, heard from wherever you are.
   */
  private rock(dt: number) {
    const b = this.buoy;
    if (!b) return;
    const t = this.time;
    const sway = 0.045 + this.outside.wind * 0.17;
    const surge = 0.8 + 0.2 * Math.sin((t / 41) * Math.PI * 2);
    const roll = sway * surge * (Math.sin((t / 4.7) * Math.PI * 2) + 0.6 * Math.sin((t / 3.1) * Math.PI * 2 + 1.3));
    const pitch = sway * surge * 0.7 * Math.sin((t / 5.9) * Math.PI * 2 + 0.4);
    b.root.rotation.set(pitch, 0, roll);
    b.root.position.y = this.level - 0.02 + Math.sin((t / 4.7) * Math.PI * 2 + 1.2) * (0.03 + this.outside.wind * 0.06);
    // the bell hangs a moment behind the cage
    if (b.bell) b.bell.rotation.set(-pitch * 0.5, 0, -roll * 0.5);
    const lean = Math.hypot(roll, pitch);
    b.quiet += dt;
    if (lean < b.lean && b.rising && b.lean > 0.065 && b.quiet > 0.9) {
      b.quiet = 0;
      const dx = BUOY.x - this.pos.x;
      const d = Math.hypot(dx, BUOY.y - this.pos.z);
      const near = 1 / (1 + (Math.max(0, d - 8) / 20) ** 2);
      this.hooks.toll?.(near, (dx / Math.max(d, 1)) * 0.9);
      if (b.root.visible) this.ripple(BUOY.x, BUOY.y, 2.4, 2.6);
    }
    b.rising = lean > b.lean;
    b.lean = lean;
    const on = t % FLASH < FLASH_ON;
    for (const l of b.lamps) if (l) l.visible = on;
  }

  private sound(i: number) {
    const s = this.stones[i];
    s.armed = false;
    s.lit = 1;
    this.hooks.note?.(s.freq);
    // and a ring goes out across the water from it
    this.ripple(s.at.x, s.at.y, 1.6, 2.2);
  }

  private glow(dt: number) {
    const b = BANKS[0];
    const dx = (this.pos.x - b.x) / b.rx;
    const dz = (this.pos.z - b.z) / b.rz;
    const inside = Math.hypot(dx, dz) < POOL_EDGE + 0.12;
    if (inside && this.speed > 0.2) this.stir = Math.min(1, this.stir + dt * 1.5);
    else this.stir = Math.max(0, this.stir - dt / 3.5);
    const u = this.specks.material.uniforms;
    u.uStir.value = this.stir;
    u.uTime.value = this.time;
    // stirred up, they scatter a little from your feet
    const pos = this.specks.geometry.attributes.position;
    const home = this.speckHome;
    for (let i = 0; i < pos.count; i++) {
      const hx = home[i * 3];
      const hz = home[i * 3 + 2];
      const ax = hx - this.pos.x;
      const az = hz - this.pos.z;
      const d = Math.hypot(ax, az) + 0.2;
      const push = (this.stir * 0.35) / d;
      pos.setX(i, hx + (ax / d) * push);
      pos.setZ(i, hz + (az / d) * push);
      pos.setY(i, POOL_Y + 0.004);
    }
    pos.needsUpdate = true;
  }

  private print() {
    const p = this.prints.find((x) => x.age > 18) ?? this.prints.reduce((a, b) => (a.age > b.age ? a : b));
    this.footSide = -this.footSide;
    const sx = Math.cos(this.heading) * 0.1 * this.footSide;
    const sz = -Math.sin(this.heading) * 0.1 * this.footSide;
    const x = this.pos.x + sx;
    const z = this.pos.z + sz;
    p.mesh.position.set(x, Math.max(this.level, bankAt(x, z)) + 0.004, z);
    p.mesh.rotation.y = this.heading;
    p.mesh.visible = true;
    p.age = 0;
    this.hooks.step?.(bankAt(x, z) < this.level);
  }

  /** Each print fills with water and fades: dark, then the water's blue, then gone. */
  private footprints(dt: number) {
    for (const p of this.prints) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      const m = p.mesh.material;
      const wet = bankAt(p.mesh.position.x, p.mesh.position.z) < this.level;
      const a = p.age * (wet ? 1.15 : 0.9); // in the water they go quicker
      m.color.copy(PRINT[a < 3 ? 0 : a < 8 ? 1 : 2]);
      m.opacity = a < 11 ? 0.9 : a < 15 ? 0.55 : 0.25;
      if (a > 18) p.mesh.visible = false;
    }
  }

  private ripple(x: number, z: number, size: number, life: number) {
    const r = this.rings.find((x) => x.age >= x.life);
    if (!r) return;
    r.age = 0;
    r.life = life;
    r.size = size;
    r.mesh.position.set(x, this.level + 0.003, z);
    r.mesh.visible = true;
  }

  /** Rain on the water: rings everywhere, opening out and gone. */
  private rain(dt: number, still: boolean) {
    const rain = still ? 0 : this.outside.rain;
    this.rainFor += dt * rain * 26;
    while (this.rainFor > 1) {
      this.rainFor -= 1;
      const x = this.target.x + (Math.random() - 0.5) * this.view * this.aspect * 1.2;
      const z = this.target.z + (Math.random() - 0.7) * 30;
      if (bankAt(x, z) < this.level) this.ripple(x, z, 0.18 + Math.random() * 0.14, 0.7);
    }
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) {
        r.mesh.visible = false;
        continue;
      }
      // grows in whole steps, and fades in three
      const s = r.size * (0.25 + Math.floor(k * 6) / 6);
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = k < 0.4 ? 0.8 : k < 0.75 ? 0.5 : 0.25;
    }
  }

  /** Its own light (always blue hour), with the island's weather over it. */
  private weather() {
    const o = this.outside;
    const gloom = Math.min(1, o.rain * 0.9 + o.snow * 0.5);
    const fog = o.fog;
    for (const mat of [...this.waters, this.sky.material]) {
      mat.uniforms.uFog.value = fog;
      mat.uniforms.uGloom.value = gloom;
    }
    for (const mat of this.waters) {
      const g = mat.uniforms;
      g.uTime.value = this.time;
      g.uLevel.value = mat.userData.level ?? this.level;
      g.uWind.value = Math.min(1, o.wind * 1.2);
    }
    const fogged = this.scene.fog as THREE.Fog;
    const reach = this.horizonReach();
    // the far things go to mist in a fog; on a clear evening only right at the horizon
    fogged.near = DISTANCE + reach * Math.cos(ELEVATION) * (0.45 - fog * 0.38);
    fogged.far = DISTANCE + reach * Math.cos(ELEVATION) * (0.88 - fog * 0.45);
    fogged.color.copy(HORIZON_HAZE).lerp(MIST, fog);
    this.hemi.intensity = 1.7 * (1 - gloom * 0.25);
    this.sun.intensity = 1.25 * (1 - gloom * 0.6) * (1 - fog * 0.5);
    // stars: a few at first, more as you look up, gone behind rain or fog
    const clear = (1 - Math.min(1, o.rain * 1.5 + o.snow)) * (1 - fog * 0.85);
    this.starMat.uniforms.uShow.value = (0.45 + this.lean * 0.55) * clear;
    this.starMat.uniforms.uTime.value = this.time;
    // the shapes drawn in, faintly, once you've been looking a while
    const lines = this.sitting ? THREE.MathUtils.clamp((this.satFor - 3) / 3, 0, 1) * clear : 0;
    this.lines.visible = lines > 0.3;
    this.lines.material.color.set(lines > 0.8 ? '#4a5590' : '#333d78');
    // winter: a skin of ice on the banks' wet edges
    for (const m of this.ice) m.emissive.setRGB(o.winter ? 0.05 : 0, o.winter ? 0.06 : 0, o.winter ? 0.09 : 0);
    this.lamp.intensity = 2.2 * (1 - fog * 0.4);
  }

  /** How far ahead of the middle of the view the flat ends (m), with the horizon where it should be. */
  private horizonReach() {
    return (HORIZON * this.view * this.zoomed) / Math.sin(ELEVATION);
  }

  /** Follow you from behind and above, looking out; sat on the bench, look up into the sky. */
  private frame(dt: number) {
    const view = this.view * this.zoomed;
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    // you in the lower part of the picture, more of the flat ahead
    const lead = (view * 0.16) / Math.sin(ELEVATION);
    const want = new THREE.Vector3(this.pos.x + this.pan.x, 0, this.pos.z - lead + this.pan.y);
    if (dt) this.target.lerp(want, 1 - Math.exp(-dt * 2.2));
    else this.target.copy(want);
    // looking up: an ease from the flat into the sky
    const ease = this.lean * this.lean * (3 - 2 * this.lean);
    const lift = ease * view * 0.78;
    cam.position.set(this.target.x, Math.sin(ELEVATION) * DISTANCE + lift * Math.cos(ELEVATION), this.target.z + Math.cos(ELEVATION) * DISTANCE - lift * Math.sin(ELEVATION));
    cam.up.set(0, 1, 0);
    cam.lookAt(this.target.x, lift * Math.cos(ELEVATION), this.target.z - lift * Math.sin(ELEVATION));
    cam.updateMatrixWorld();
    // snap to the texel grid, and hand the remainder to the renderer (as the island does)
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

    // the flat runs out at the horizon, square on to the view
    const reach = this.horizonReach();
    const far = new THREE.Vector3(this.target.x, 0, this.target.z - reach);
    const back = 60;
    this.ground.position.set(this.target.x, this.level, this.target.z + (back - reach) / 2);
    this.ground.scale.set(view * this.aspect * 2.4 + 40, 1, reach + back);
    const horizon = far.clone().applyMatrix4(cam.matrixWorldInverse);
    // the sky stands just behind it, filling the picture
    this.sky.position.set(0, 0, horizon.z - 0.3);
    this.sky.scale.set(w * 2 + 4, h * 2 + 4, 1);
    this.stars.position.set(0, horizon.y, horizon.z - 0.25);
    // (narrow screens get the constellations squeezed in a little, so both still fit)
    const squeeze = Math.min(1, this.aspect / 0.8);
    this.stars.scale.set(view * squeeze, view, 1);
    for (const mat of [...this.waters, this.sky.material]) {
      const uni = mat.uniforms;
      uni.uHorizon.value = horizon.y;
      uni.uView.value = view;
      uni.uAspect.value = this.aspect;
      uni.uTexel.value = 1 / this.texels();
      uni.uAhead?.value.set(this.target.z, reach * 0.35);
    }
    // from far off, the pool in its bank is lost in it: no hole in the sand
    const pool = this.waters[1];
    if (pool) pool.uniforms.uSolid.value = POOL.y < this.target.z - reach * 0.55 ? 1 : 0;
    // the reflections: everything hung upside down under the water's surface
    const flip = new THREE.Matrix4().makeScale(1, -1, 1).premultiply(new THREE.Matrix4().makeTranslation(0, this.level * 2, 0));
    this.scene.updateMatrixWorld();
    for (const m of this.mirrored) {
      // (nothing past the horizon, nor its reflection: they'd stand up into the sky; by
      // then the haze has them anyway)
      const near = m.src.position.z > far.z + SINK;
      m.src.visible = near;
      m.copy.visible = near;
      if (m.parts) for (const [a, b] of m.parts) if (a !== m.src) (b.position.copy(a.position), b.quaternion.copy(a.quaternion), b.scale.copy(a.scale));
      m.copy.matrix.multiplyMatrices(flip, m.src.matrixWorld);
      m.copy.updateMatrixWorld(true);
    }
  }
}

/** The wreck's half-width at t (-1 stern … 1 bow), as tools/models/lowwater.py shapes it. */
function wreckHalfBeam(t: number) {
  const end = t > 0 ? 0.55 : 0.7;
  const k = Math.max(0, Math.abs(t) - (1 - end)) / end;
  return (WRECK_BEAM / 2) * Math.sqrt(Math.max(0, 1 - k * k * (t > 0 ? 0.92 : 0.75)));
}

/** How much of the wreck is out of the sand on a day: two slow swells of sand, a month and a bit and ten days. */
function wreckOut(d: Date) {
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  return 0.5 + 0.34 * Math.sin((day / 37) * Math.PI * 2) + 0.16 * Math.sin((day / 11) * Math.PI * 2 + 1);
}

/** A toon material of its own (never the island's shared one), its fog stepped (see steppedFog). */
function paint(color: THREE.Color, opts: { glow?: boolean; vertexColors?: boolean } = {}) {
  return steppedFog(toon(color, { ...opts, own: true, bare: true }));
}

/**
 * Fog in four dithered steps rather than a smooth fade, so what's far off goes to haze the way
 * the rest of the picture does: in texels.
 */
function steppedFog<T extends THREE.Material>(mat: T): T {
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    before?.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      /* glsl */ `#ifdef USE_FOG
        const float FOG_BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
        ivec2 fogAt = ivec2(gl_FragCoord.xy);
        float fogStep = (FOG_BAYER[(fogAt.x & 3) + (fogAt.y & 3) * 4] + 0.5) / 16.0;
        float fogF = floor(smoothstep(fogNear, fogFar, vFogDepth) * 4.0 + fogStep) / 4.0;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogF);
      #endif`,
    );
  };
  return mat;
}

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

/** A small seeded random, so the stars and the twigs come out the same every time. */
function mulberry(seed: number) {
  let a = seed * 2654435761;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
