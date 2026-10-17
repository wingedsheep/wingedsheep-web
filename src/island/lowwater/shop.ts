/**
 * The bookshop behind the page: Antiquariaat De Ezelsoor, a secondhand bookshop in a Dutch town,
 * through the door that stands on its own on the page (page.ts). Everything the flat isn't: warm,
 * close, crowded, daylit. Books floor to ceiling on the back wall, a long table of them in the
 * middle, the shop window and the street door on the west side, and on the east, behind the
 * counter, Tine, who has kept it since 1979, reading.
 *
 * It keeps the island's hour and weather (`moment`, set from lowwater.ts each frame): the sun comes
 * in at the window and lies on the boards in the shape of its panes, warmer and longer towards
 * evening; at night the street goes dark blue and the lamps are on; in rain the glass runs.
 *
 * Its own scene and camera, drawn through the island's PixelRenderer like the page: a dollhouse,
 * the south wall (and the east) cut away, looked into from above and a little east of south.
 */
import * as THREE from 'three';
import { toon } from '../scene/toon';
import { makeFigure, type Figure } from './figure';
import { Customer, CUSTOMERS } from './customer';

/** The room (m): x west to east, z north (back wall) to south (cut away); TALL to the ceiling. */
const WEST = -4.5;
const EAST = 4.5;
const BACK = -3;
const FRONT = 3;
const TALL = 3.1;
/** The window in the west wall (z along it, y from its sill to its top), and its panes: four across, three down. */
const WIN = { z0: -2.6, z1: 0.4, y0: 0.55, y1: 2.5, across: 4, down: 3 };
/** The street door, in the west wall south of the window. */
const DOOR = { z0: 0.9, z1: 2.0, y1: 2.2 };
/** The bookcases along the back wall (x), how deep they are, and their shelves' heights. */
const CASE = { x0: -4.4, x1: 1.9, deep: 0.38, unit: 0.9 };
const SHELVES = [0.1, 0.47, 0.84, 1.21, 1.58, 1.95, 2.32, 2.69];
const CASE_TOP = 3.02;
/** The table in the middle, and the counter: an L, its long side facing west and its short side south, Tine in the corner behind. */
const TABLE = { x0: -1.9, x1: 0.9, z0: -0.5, z1: 0.5, h: 0.78 };
const COUNTER = { x0: 2.1, x1: 2.7, z0: -2.3, z1: 0.9, x2: 3.9, z2: 0.3, h: 0.95 };
const TINE_AT = new THREE.Vector3(3.45, 0, -0.75);
const TINE_FACING = -0.85;
/** Where you come in, the step you take in, and where clicking a thing walks you to. */
const IN = new THREE.Vector3(-4.05, 0, 1.45);
const STEP_IN = new THREE.Vector3(-2.9, 0, 1.45);
const GOALS = {
  tine: new THREE.Vector3(1.75, 0, -0.5),
  shelves: new THREE.Vector3(-1.2, 0, -2.15),
  window: new THREE.Vector3(-3.55, 0, -0.9),
  door: new THREE.Vector3(-3.9, 0, 1.45),
  clock: new THREE.Vector3(1.7, 0, -1.75),
};
/** The clock on the back wall, behind the north end of the counter: its dial's centre. */
const CLOCK = { x: 2.38, z: BACK + 0.13, dial: 2.2 };

const ELEVATION = THREE.MathUtils.degToRad(36);
/** The camera stands a little east of south, so the west wall (the window) is seen. */
const YAW = THREE.MathUtils.degToRad(26);
const DISTANCE = 40;
/** The sun's way in through the window: how far south it carries the patch for each metre it comes in (the sun's not seen, so it's chosen to keep the patch on open boards). */
const SUN_ALONG = -0.3;
const PACE = 1.6;
/** Stood still this long in the open middle, the shop's card again (s). */
const STILL = 8;
/** How long after you've come in (and left her counter) someone comes in after a book (s). */
const CUSTOMER_IN = 7;
/** Near the counter, Tine looks up (m); nearer, she talks. */
const LOOK_UP = 2.5;
const TALK = 1.5;

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

export type ShopCard = 'shop' | 'tine' | 'shelves' | 'window' | 'door' | 'clock' | 'customer';
type Thing = 'tine' | 'shelves' | 'window' | 'door' | 'clock';

/** The worn book-cloth of a secondhand shop: oxblood, bottle green, navy, mustard, tan, cream, grey-blue, and some browns. */
const CLOTH = ['#6e2229', '#24493a', '#25304f', '#c4962e', '#b08a5c', '#e3d8bc', '#6c7f91', '#4a3020', '#9a4a3a', '#6f6a3a', '#2c2824', '#8a6a48', '#3d5a5a', '#a8b0a0'];
const PENGUIN = '#e0762c';
const PENGUIN_BAND = '#efe6cf';

const mat = (hex: string) => toon(new THREE.Color(hex), { bare: true });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
}

/** A seeded random, so the shop's the same every visit. */
function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** In a pane of the window, not on a bar between them (the window's own metres, along the wall and up). */
const PANE_GLSL = /* glsl */ `
  bool inPane(float z, float y) {
    if (z < ${WIN.z0.toFixed(3)} || z > ${WIN.z1.toFixed(3)} || y < ${WIN.y0.toFixed(3)} || y > ${WIN.y1.toFixed(3)}) return false;
    float u = (z - ${WIN.z0.toFixed(3)}) / ${(WIN.z1 - WIN.z0).toFixed(3)} * ${WIN.across.toFixed(1)};
    float v = (y - ${WIN.y0.toFixed(3)}) / ${(WIN.y1 - WIN.y0).toFixed(3)} * ${WIN.down.toFixed(1)};
    return min(fract(u), 1.0 - fract(u)) > 0.045 && min(fract(v), 1.0 - fract(v)) > 0.05 && u > 0.06 && u < ${(WIN.across - 0.06).toFixed(2)} && v > 0.06 && v < ${(WIN.down - 0.06).toFixed(2)};
  }`;
const BAYER_GLSL = /* glsl */ `
  float bayer4(vec2 p) {
    ivec2 q = ivec2(mod(floor(p), 4.0));
    int i = q.x + q.y * 4;
    float b[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    return (b[i] + 0.5) / 16.0;
  }`;

export interface Tine {
  root: THREE.Group;
  head: THREE.Group;
  /** Her right arm, that turns the pages, and the page it turns. */
  arm: THREE.Group;
  page: THREE.Group;
}

/** Tine, sat on her stool with a book open in her hands: grey hair in a bun, a mustard cardigan over a dark dress, reading glasses. */
function makeTine(): Tine {
  const root = new THREE.Group();
  const wood = mat('#3e2618');
  const dress = mat('#2b2838');
  const cardigan = mat('#c4932c');
  const skin = mat('#e0b49a');
  const hair = mat('#c9c4bb');
  const shoes = mat('#1e1a1a');
  const stocking = mat('#4a3a3a');
  // her stool
  root.add(box(0.36, 0.05, 0.36, wood, 0, 0.7, 0));
  for (const [x, z] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) root.add(box(0.04, 0.7, 0.04, wood, x, 0.35, z));
  root.add(box(0.32, 0.03, 0.03, wood, 0, 0.3, 0.14));
  // sat: her lap and her knees forward, shins down to the rung, feet on it
  for (const s of [-1, 1]) {
    root.add(box(0.15, 0.14, 0.44, dress, s * 0.1, 0.8, 0.16));
    root.add(box(0.12, 0.42, 0.13, stocking, s * 0.1, 0.55, 0.36));
    root.add(box(0.13, 0.08, 0.2, shoes, s * 0.1, 0.32, 0.4));
  }
  // the dress's skirt over her knees
  root.add(box(0.36, 0.1, 0.26, dress, 0, 0.85, 0.3));
  // the cardigan, a little bent over her book
  const body = new THREE.Group();
  body.position.set(0, 0.86, -0.02);
  body.rotation.x = 0.12;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.56, 6), cardigan);
  torso.position.y = 0.28;
  body.add(torso);
  // (the dress, a V at her neck)
  body.add(box(0.12, 0.12, 0.04, dress, 0, 0.5, 0.15));
  root.add(body);
  // her head, on its neck: looks down at the book, or up at you
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0.05);
  head.add(box(0.08, 0.1, 0.08, skin, 0, 0.0, 0));
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.115, 1), skin);
  skull.position.set(0, 0.13, 0.01);
  head.add(skull);
  // grey hair, back from her face, and the bun
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.122, 1), hair);
  cap.scale.set(1.04, 0.92, 1);
  cap.position.set(0, 0.165, -0.035);
  head.add(cap);
  const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.065, 0), hair);
  bun.position.set(0, 0.25, -0.1);
  head.add(bun);
  // reading glasses: two pale glints
  const glass = new THREE.MeshBasicMaterial({ color: '#f2f0e6' });
  for (const s of [-1, 1]) head.add(box(0.045, 0.025, 0.01, glass, s * 0.045, 0.13, 0.118));
  root.add(head);
  // the book, open in her hands at her lap
  const book = new THREE.Group();
  book.position.set(0, 1.0, 0.32);
  book.rotation.x = -0.75;
  const paper = mat('#efe6cf');
  const cover = mat('#5a2a2a');
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    half.rotation.z = s * 0.18;
    half.add(box(0.15, 0.02, 0.22, paper, s * 0.075, 0.012, 0));
    half.add(box(0.16, 0.008, 0.23, cover, s * 0.08, -0.004, 0));
    book.add(half);
  }
  // the page she turns: hinged at the spine, lying right, and over to the left
  const page = new THREE.Group();
  page.position.y = 0.026;
  page.add(box(0.145, 0.006, 0.21, paper, 0.0725, 0, 0));
  book.add(page);
  root.add(book);
  // her arms: from the shoulders down and forward to the book's edges; the right one crosses to turn the page
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.2, 1.33, 0.0);
    const upper = box(0.09, 0.3, 0.1, cardigan, 0, -0.15, 0);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    elbow.rotation.x = -1.25;
    elbow.add(box(0.08, 0.26, 0.09, cardigan, 0, -0.13, 0));
    elbow.add(box(0.06, 0.06, 0.07, skin, 0, -0.29, 0));
    shoulder.add(elbow);
    shoulder.rotation.x = -0.35;
    shoulder.rotation.z = s * 0.12;
    root.add(shoulder);
    arms.push(shoulder);
  }
  root.userData.id = 'tine';
  return { root, head, arm: arms[1], page };
}

export class Shop {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  card: ShopCard | null = null;
  /** Out through the street door: back to the page. */
  leaving = false;
  /** Each step on the boards, for the sound. */
  onStep?: () => void;
  /** The shop's own sounds, each from where it is across the picture (-1 … 1) and how near (0–1): the door's bell on its spring, the clock's tick (and tock), and Tine's page. */
  onBell?: (side: number) => void;
  onTick?: (tock: boolean, side: number, near: number) => void;
  onTurn?: (side: number, near: number) => void;
  /** A customer's step on the boards. */
  onTheirStep?: (side: number, near: number) => void;
  /** The island's hour and weather, from lowwater.ts: sun up, a low sun, rain, fog, snow (each 0–1), and the clock (hours since midnight, and its seconds). */
  readonly moment = { day: 1, warm: 0, rain: 0, fog: 0, snow: 0, hours: 14, seconds: 0 };
  /** Reduced motion: no drifting dust, no running rain. */
  still = false;
  /** How many times you've come to the counter this visit (Tine's first line, then the others in turn). */
  visits = 0;
  /** Someone in after a book they half remember (customer.ts), once a visit. */
  customer: Customer | null = null;
  private customerIn = CUSTOMER_IN;
  private served = false;
  private rungOut = false;
  private arrivals = 0;
  private you: Figure;
  private tine: Tine;
  private pos = new THREE.Vector3();
  private heading = Math.PI / 2;
  private speed = 0;
  private goal: THREE.Vector3 | null = null;
  private keys = new Set<string>();
  private stride = 0;
  private lastStep = 0;
  private stillFor = 0;
  private time = 0;
  private fresh = true;
  private out = false;
  private atCounter = false;
  private pickables: THREE.Object3D[] = [];
  private ray = new THREE.Raycaster();
  private aspect = 1;
  private zoomed = 1;
  private centre = new THREE.Vector2();
  /** The camera's axes, and the room's extent along them (for fitting it on any screen). */
  private right = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
  private back = new THREE.Vector3(Math.sin(YAW) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(YAW) * Math.cos(ELEVATION));
  private up = new THREE.Vector3().crossVectors(this.back, this.right);
  private extent = { r0: 0, r1: 0, u0: 0, u1: 0 };
  // light
  private hemi = new THREE.HemisphereLight('#fff0d8', '#6a4630', 2);
  private sun = new THREE.DirectionalLight('#fff1d6', 1);
  private desk = new THREE.PointLight('#ffc070', 2, 4, 1.2);
  private standard = new THREE.PointLight('#ffc884', 2, 6, 1.2);
  private bulbs: THREE.MeshBasicMaterial[] = [];
  private pool: THREE.MeshBasicMaterial;
  private glassU = { uDay: { value: 1 }, uWarm: { value: 0 }, uRain: { value: 0 }, uFog: { value: 0 }, uSnow: { value: 0 }, uTime: { value: 0 } };
  private sunU = { uStrength: { value: 1 }, uSlope: { value: 1 }, uAlong: { value: 0.15 }, uColor: { value: new THREE.Color() } };
  private motes: THREE.Points;
  private moteAt: { x: number; y: number; z: number; p: number }[] = [];
  private bell = new THREE.Group();
  private ring = 0;
  /** The clock's hands, and the second it last ticked. */
  private hands = { hour: new THREE.Group(), minute: new THREE.Group() };
  private ticked = -1;
  // Tine
  private turnIn = 6;
  private turning = -1;
  /** How much longer Tine's line has to go (s). */
  private talking = 0;
  private look = new THREE.Vector2(0, 0.4);

  constructor(private texels: () => number) {
    this.scene.background = new THREE.Color('#231813');
    this.scene.add(this.camera, this.hemi, this.sun, this.sun.target, this.desk, this.standard);
    this.makeRoom();
    this.makeWindow();
    this.makeDoor();
    this.makeShelves();
    this.makeTable();
    this.makeCounter();
    this.makeClock();
    this.makeCorner();
    this.pool = this.makeLamps();
    this.makeSunlight();
    this.motes = this.makeMotes();
    this.tine = makeTine();
    this.tine.root.position.copy(TINE_AT);
    this.tine.root.rotation.y = TINE_FACING;
    this.scene.add(this.tine.root);
    this.pickables.push(this.tine.root);
    this.you = makeFigure({
      coat: toon(new THREE.Color('#353352'), { own: true, bare: true }),
      boots: toon(new THREE.Color('#1b1a2a'), { own: true, bare: true }),
      scarf: toon(new THREE.Color('#efe2c6'), { own: true, bare: true }),
      skin: toon(new THREE.Color('#3a3348'), { own: true, bare: true }),
    });
    this.scene.add(this.you.root);
    this.measure();
    this.resize(innerWidth, innerHeight);
  }

  /** Walls, floorboards, the rug: the room's shell, cut away to the south and east like a dollhouse. */
  private makeRoom() {
    const plaster = mat('#e3cf9f');
    const section = mat('#4a3426');
    const skirting = mat('#5a3a26');
    // the floor's cut edge, and the boards on it: running north–south, a stripe each, in three tones
    this.scene.add(box(EAST - WEST + 0.25, 0.3, FRONT - BACK + 0.25, section, (EAST + WEST - 0.25) / 2, -0.17, (FRONT + BACK - 0.25) / 2));
    const BOARD = 0.2;
    const n = Math.ceil((EAST - WEST) / BOARD);
    const boards = new THREE.InstancedMesh(new THREE.BoxGeometry(BOARD, 0.02, FRONT - BACK), toon(new THREE.Color('#ffffff'), { own: true, bare: true }), n);
    const tones = ['#a2714a', '#94653f', '#ab7b52', '#9a6a44'].map((c) => new THREE.Color(c));
    const rand = seeded(11);
    for (let i = 0; i < n; i++) {
      boards.setMatrixAt(i, new THREE.Matrix4().makeTranslation(WEST + (i + 0.5) * BOARD, -0.01, (FRONT + BACK) / 2));
      boards.setColorAt(i, tones[Math.floor(rand() * tones.length)]);
    }
    this.scene.add(boards);
    // the back wall, and the west wall around the window and the door
    const T = 0.25;
    this.scene.add(box(EAST - WEST + T, TALL, T, plaster, (EAST + WEST - T) / 2, TALL / 2, BACK - T / 2));
    const x = WEST - T / 2;
    const wall = (z0: number, z1: number, y0: number, y1: number) => this.scene.add(box(T, y1 - y0, z1 - z0, plaster, x, (y0 + y1) / 2, (z0 + z1) / 2));
    wall(BACK - T, WIN.z0, 0, TALL);
    wall(WIN.z0, WIN.z1, 0, WIN.y0);
    wall(WIN.z0, WIN.z1, WIN.y1, TALL);
    wall(WIN.z1, DOOR.z0, 0, TALL);
    wall(DOOR.z0, DOOR.z1, DOOR.y1, TALL);
    wall(DOOR.z1, FRONT, 0, TALL);
    // skirting along the west wall
    this.scene.add(box(0.03, 0.12, WIN.z1 - BACK, skirting, WEST + 0.015, 0.06, (WIN.z1 + BACK) / 2));
    this.scene.add(box(0.03, 0.12, FRONT - DOOR.z1, skirting, WEST + 0.015, 0.06, (FRONT + DOOR.z1) / 2));
    // the rug, worn, under the table: a border, a field, a field inside that
    const rug = [['#b88a46', 4.4, 2.7], ['#7a2a24', 4.1, 2.4], ['#93402f', 3.2, 1.6], ['#6a2420', 1.2, 0.5]] as const;
    rug.forEach(([c, w, d], i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), toon(new THREE.Color(c), { bare: true }));
      m.position.set(-0.5, 0.004 + i * 0.002, 0.05);
      this.scene.add(m);
    });
  }

  /** The shop window: small panes in a green frame, the street through them, the shop's name on the glass in gold, backwards. */
  private makeWindow() {
    const g = new THREE.Group();
    const W = WIN.z1 - WIN.z0;
    const H = WIN.y1 - WIN.y0;
    const glass = new THREE.ShaderMaterial({
      uniforms: this.glassU,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uDay;
        uniform float uWarm;
        uniform float uRain;
        uniform float uFog;
        uniform float uSnow;
        uniform float uTime;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          // the street across, in metres along the glass and up from the sill
          vec2 m = vec2(vUv.x * ${W.toFixed(2)}, vUv.y * ${H.toFixed(2)});
          float house = floor((m.x + 0.35) / 0.95);
          float hx = fract((m.x + 0.35) / 0.95);
          float hh = hash(vec2(house, 3.0));
          float roof = 1.35 + hh * 0.35 - (hh > 0.5 ? max(0.0, abs(hx - 0.5) - 0.3) * 1.6 : 0.0);
          vec3 sky = mix(vec3(0.80, 0.88, 0.93), vec3(0.98, 0.78, 0.52), uWarm);
          vec3 col;
          bool lit = false;
          if (m.y > roof) {
            col = sky;
          } else if (m.y < 0.28) {
            // the street and the pavement
            col = m.y < 0.1 ? vec3(0.62, 0.6, 0.56) : vec3(0.42, 0.4, 0.38) * (0.92 + 0.08 * step(0.5, hash(floor(m * vec2(14.0, 30.0)))));
          } else {
            // brick, three kinds of house, mortar every course
            float kind = floor(hh * 3.0);
            vec3 brick = kind < 1.0 ? vec3(0.55, 0.27, 0.2) : kind < 2.0 ? vec3(0.4, 0.22, 0.17) : vec3(0.68, 0.38, 0.26);
            col = fract(m.y / 0.075) < 0.2 ? brick * 0.75 : brick;
            // a window each, upstairs, and the shop's opposite downstairs
            vec2 w = vec2(abs(hx - 0.5), m.y);
            if (w.x < 0.17 && w.y > 0.82 && w.y < 1.2) {
              col = (w.x > 0.14 || w.y < 0.85 || w.y > 1.17 || abs(w.y - 1.01) < 0.015) ? vec3(0.9, 0.88, 0.82) : vec3(0.18, 0.2, 0.24);
              lit = hash(vec2(house, 9.0)) > 0.55 && w.x <= 0.14 && w.y >= 0.85 && w.y <= 1.17;
            }
            if (w.x < 0.3 && w.y < 0.62) col = (w.x > 0.27 || w.y > 0.59) ? vec3(0.16, 0.25, 0.2) : vec3(0.15, 0.17, 0.2);
          }
          // the hour: daylight, a low sun warming it, or night, dark blue, with one lamp and some windows lit
          vec3 night = col * vec3(0.12, 0.15, 0.3);
          if (m.y > roof) night = vec3(0.07, 0.09, 0.2);
          if (lit) night = vec3(0.95, 0.72, 0.36);
          col = mix(night, col * mix(vec3(1.0), vec3(1.1, 0.88, 0.7), uWarm), uDay);
          float lampX = ${(W * 0.78).toFixed(2)};
          if (abs(m.x - lampX) < 0.025 && m.y > 0.12 && m.y < 1.15) col = mix(vec3(0.05, 0.05, 0.08), vec3(0.15, 0.15, 0.17), uDay);
          if (abs(m.x - lampX) < 0.07 && abs(m.y - 1.2) < 0.06) col = mix(vec3(1.0, 0.85, 0.5), vec3(0.2, 0.2, 0.22), uDay);
          else if (length((m - vec2(lampX, 1.2)) * vec2(1.0, 1.4)) < 0.4) col += vec3(0.25, 0.17, 0.06) * (1.0 - uDay) * step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.5));
          // rain: duller, and drops running down the glass
          col *= 1.0 - uRain * 0.4;
          col = mix(col, col * vec3(0.78, 0.86, 1.0), uRain * 0.6);
          if (m.y > roof) col = mix(col, vec3(0.62, 0.66, 0.7) * (0.15 + 0.85 * uDay), uRain * 0.8);
          float c = floor(gl_FragCoord.x);
          float h = hash(vec2(c, 1.0));
          if (uRain > 0.0 && h > 1.0 - uRain * 0.3) {
            float s = 1.0 - fract(h * 7.0 + uTime * (0.2 + h * 0.3));
            float d = vUv.y - s;
            if (d > 0.0 && d < 0.12) col = mix(col, vec3(0.8, 0.85, 0.9) * (0.35 + uDay * 0.65), 0.55 - d * 3.0);
          }
          // fog: flat and pale, and the far side gone
          col = mix(col, vec3(0.78, 0.79, 0.76) * (0.25 + 0.75 * uDay), uFog * (m.y > 0.28 ? 0.85 : 0.6));
          // snow: a few flakes going past
          if (uSnow > 0.0) {
            vec2 f = floor(vec2(gl_FragCoord.x * 0.5, gl_FragCoord.y * 0.5 + uTime * 3.0));
            float k = hash(f + vec2(floor(uTime * 0.0), 0.0));
            if (k > 1.0 - uSnow * 0.05) col = mix(col, vec3(0.96, 0.97, 1.0), 0.9);
          }
          // (worked out as you'd pick colours, in sRGB; the picture's drawn in linear light)
          gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(2.2)), 1.0);
        }`,
    });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glass);
    pane.rotation.y = Math.PI / 2;
    pane.position.set(WEST - 0.14, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2);
    g.add(pane);
    // the frame and its bars, painted the green of a Dutch shopfront
    const green = mat('#2f4a3c');
    const x = WEST - 0.08;
    g.add(box(0.1, 0.08, W + 0.1, green, x, WIN.y0, (WIN.z0 + WIN.z1) / 2), box(0.1, 0.08, W + 0.1, green, x, WIN.y1, (WIN.z0 + WIN.z1) / 2));
    g.add(box(0.1, H, 0.08, green, x, (WIN.y0 + WIN.y1) / 2, WIN.z0), box(0.1, H, 0.08, green, x, (WIN.y0 + WIN.y1) / 2, WIN.z1));
    for (let i = 1; i < WIN.across; i++) g.add(box(0.06, H, 0.045, green, x, (WIN.y0 + WIN.y1) / 2, WIN.z0 + (W * i) / WIN.across));
    for (let j = 1; j < WIN.down; j++) g.add(box(0.06, 0.05, W, green, x, WIN.y0 + (H * j) / WIN.down, (WIN.z0 + WIN.z1) / 2));
    // the sill, deep and low, with a few books lying on it and a plant
    const sill = mat('#6b4528');
    g.add(box(0.36, 0.05, W + 0.2, sill, WEST + 0.1, WIN.y0 - 0.02, (WIN.z0 + WIN.z1) / 2));
    const rand = seeded(5);
    for (const z of [-2.2, -1.0, 0.05]) {
      let y = WIN.y0 + 0.005;
      for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) {
        const t = 0.035 + rand() * 0.03;
        const b = box(0.2 + rand() * 0.06, t, 0.28 + rand() * 0.08, mat(CLOTH[Math.floor(rand() * CLOTH.length)]), WEST + 0.12, y + t / 2, z + (rand() - 0.5) * 0.06);
        b.rotation.y = (rand() - 0.5) * 0.4;
        g.add(b);
        y += t;
      }
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.13, 6), mat('#a65a3a'));
    pot.position.set(WEST + 0.12, WIN.y0 + 0.07, -1.55);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat('#4f7a3e'));
    leaves.position.set(WEST + 0.12, WIN.y0 + 0.24, -1.55);
    g.add(pot, leaves);
    // the shop's name, on the glass in gold, backwards from in here
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 28;
    const c = canvas.getContext('2d')!;
    c.translate(160, 0);
    c.scale(-1, 1);
    c.fillStyle = '#d6a842';
    c.textAlign = 'center';
    c.font = 'bold 15px Georgia, serif';
    c.fillText('ANTIQUARIAAT', 80, 13);
    c.font = 'bold 11px Georgia, serif';
    c.fillText('DE EZELSOOR', 80, 26);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    const name = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, W * 0.86 * (28 / 160)), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45, transparent: false }));
    name.rotation.y = Math.PI / 2;
    name.position.set(WEST - 0.12, WIN.y0 + H * 0.66, (WIN.z0 + WIN.z1) / 2);
    g.add(name);
    g.userData.id = 'window';
    this.scene.add(g);
    this.pickables.push(g);
    this.windowGlass = glass;
  }

  private windowGlass?: THREE.ShaderMaterial;

  /** The street door, green like the window, a pane in its top half, and the bell on its spring above it. */
  private makeDoor() {
    const g = new THREE.Group();
    const W = DOOR.z1 - DOOR.z0;
    const green = mat('#2f4a3c');
    const zc = (DOOR.z0 + DOOR.z1) / 2;
    g.add(box(0.06, DOOR.y1 - 0.04, W - 0.04, green, WEST - 0.1, (DOOR.y1 - 0.04) / 2, zc));
    // its pane, the same street as the window
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.34, 0.8), this.windowGlass);
    pane.rotation.y = Math.PI / 2;
    pane.position.set(WEST - 0.065, 1.55, zc);
    g.add(pane);
    // panels below, a brass handle, the frame
    const panel = mat('#26402f');
    g.add(box(0.02, 0.6, W - 0.36, panel, WEST - 0.065, 0.5, zc));
    g.add(box(0.05, 0.05, 0.12, mat('#c9a040'), WEST - 0.04, 1.0, DOOR.z1 - 0.15));
    const trim = mat('#5a3a26');
    g.add(box(0.06, DOOR.y1 + 0.08, 0.07, trim, WEST + 0.01, (DOOR.y1 + 0.08) / 2, DOOR.z0 - 0.03), box(0.06, DOOR.y1 + 0.08, 0.07, trim, WEST + 0.01, (DOOR.y1 + 0.08) / 2, DOOR.z1 + 0.03));
    g.add(box(0.06, 0.08, W + 0.14, trim, WEST + 0.01, DOOR.y1 + 0.04, zc));
    // the bell: a curl of spring out from the wall, and the bell hanging off it
    const brass = mat('#c9a040');
    this.bell.position.set(WEST + 0.24, DOOR.y1 + 0.18, DOOR.z0 + 0.2);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.08, 6), brass);
    bell.position.y = -0.08;
    this.bell.add(bell, box(0.01, 0.06, 0.01, brass, 0, -0.03, 0));
    g.add(this.bell, box(0.24, 0.015, 0.015, mat('#3a3a3a'), WEST + 0.12, DOOR.y1 + 0.18, DOOR.z0 + 0.2));
    g.userData.id = 'door';
    this.scene.add(g);
    this.pickables.push(g);
  }

  /**
   * The back wall: bookcases floor to ceiling, packed. One spine a box (a few lying flat, a few
   * leaning), in worn cloth colours, and on one shelf at eye height a run of old Penguins.
   */
  private makeShelves() {
    const g = new THREE.Group();
    const wood = mat('#5e3b22');
    const backing = mat('#2e1d14');
    const front = BACK + CASE.deep;
    const width = CASE.x1 - CASE.x0;
    g.add(box(width, CASE_TOP, 0.03, backing, (CASE.x0 + CASE.x1) / 2, CASE_TOP / 2, BACK + 0.015));
    const units = Math.round(width / CASE.unit);
    const unit = width / units;
    for (let i = 0; i <= units; i++) g.add(box(0.04, CASE_TOP, CASE.deep, wood, CASE.x0 + i * unit, CASE_TOP / 2, BACK + CASE.deep / 2));
    for (const y of SHELVES) g.add(box(width + 0.04, 0.03, CASE.deep, wood, (CASE.x0 + CASE.x1) / 2, y - 0.015, BACK + CASE.deep / 2));
    g.add(box(width + 0.12, 0.08, CASE.deep + 0.06, wood, (CASE.x0 + CASE.x1) / 2, CASE_TOP, BACK + CASE.deep / 2 + 0.01));
    g.add(box(width + 0.04, 0.1, 0.02, mat('#3e2618'), (CASE.x0 + CASE.x1) / 2, 0.05, front));
    // the spines
    const rand = seeded(1935);
    const spines: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const tint = new THREE.Color();
    const add = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, lean = 0, flat = false) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, lean)), flat ? new THREE.Vector3(h, w, d) : new THREE.Vector3(w, h, d));
      // (faded, each a little differently)
      const c = tint.set(color).clone().multiplyScalar(0.82 + rand() * 0.26);
      spines.push({ m, c });
    };
    const penguins = { row: 4, x0: CASE.x0 + unit * 2 + 0.02, x1: CASE.x0 + unit * 3 - 0.02 };
    SHELVES.forEach((y, row) => {
      const room = (row < SHELVES.length - 1 ? SHELVES[row + 1] : CASE_TOP - 0.04) - y - 0.03;
      for (let u = 0; u < units; u++) {
        const x1 = CASE.x0 + (u + 1) * unit - 0.025;
        let x = CASE.x0 + u * unit + 0.025;
        // (the bottom shelf behind the ladder's feet, and here and there a shelf's end, left half empty)
        if (rand() < 0.08) x += 0.15 + rand() * 0.3;
        while (x < x1 - 0.03) {
          const penguin = row === penguins.row && x > penguins.x0 && x < penguins.x1;
          const w = penguin ? 0.022 + rand() * 0.025 : 0.03 + rand() * 0.04;
          const h = Math.min(room, penguin ? 0.18 + rand() * 0.012 : 0.18 + rand() * 0.14);
          const d = 0.16 + rand() * 0.07;
          const z = front - 0.03 - d / 2 - rand() * 0.025;
          if (x + w > x1) break;
          const r = rand();
          if (!penguin && r < 0.035 && x + 0.3 < x1) {
            // a few lying flat, one on another
            const n = 2 + Math.floor(rand() * 3);
            const len = 0.2 + rand() * 0.06;
            let yy = y;
            for (let k = 0; k < n && yy + 0.05 < y + room; k++) {
              const t = 0.03 + rand() * 0.025;
              add(x + len / 2 + (rand() - 0.5) * 0.02, yy + t / 2, z, t, len, d, CLOTH[Math.floor(rand() * CLOTH.length)], 0, true);
              yy += t;
            }
            x += len + 0.015;
            continue;
          }
          if (!penguin && r < 0.07 && x + 0.15 < x1) {
            // a gap, and one leant over into it
            const lean = 0.25 + rand() * 0.15;
            const gap = w + h * Math.sin(lean) * 0.8;
            const cx = x + gap - (w / 2) * Math.cos(lean) - (h / 2) * Math.sin(lean);
            const cy = y - (w / 2) * Math.sin(lean) + (h / 2) * Math.cos(lean) + w * Math.sin(lean);
            add(cx, cy, z, w, h, d, CLOTH[Math.floor(rand() * CLOTH.length)], lean);
            x += gap + 0.005;
            continue;
          }
          add(x + w / 2, y + h / 2, z, w, h, d, penguin ? (rand() < 0.5 ? PENGUIN : '#c8602a') : CLOTH[Math.floor(rand() * CLOTH.length)]);
          // (a Penguin's cream band across the middle of its spine)
          if (penguin) add(x + w / 2, y + h / 2, z + 0.003, w + 0.002, h * 0.34, d, PENGUIN_BAND);
          x += w + (rand() < (penguin ? 0.4 : 0.15) ? 0.006 : 0);
        }
      }
    });
    const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toon(new THREE.Color('#ffffff'), { own: true, bare: true }), spines.length);
    spines.forEach((s, i) => (books.setMatrixAt(i, s.m), books.setColorAt(i, s.c)));
    g.add(books);
    // the brass rail along the top, and the library ladder hooked on it
    const brass = mat('#b8923e');
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, width, 5), brass);
    rail.rotation.z = Math.PI / 2;
    rail.position.set((CASE.x0 + CASE.x1) / 2, 2.82, front + 0.06);
    g.add(rail);
    const ladder = new THREE.Group();
    const foot = 0.75;
    const len = Math.hypot(2.82, foot);
    const tilt = Math.atan2(foot, 2.82);
    const ladderWood = mat('#7a5232');
    for (const s of [-1, 1]) ladder.add(box(0.045, len, 0.05, ladderWood, s * 0.23, len / 2, 0));
    for (let k = 1; k * 0.3 < len - 0.1; k++) ladder.add(box(0.46, 0.03, 0.04, ladderWood, 0, k * 0.3, 0));
    ladder.position.set(-0.4, 0, front + 0.06 + foot);
    ladder.rotation.x = -tilt;
    g.add(ladder);
    g.userData.id = 'shelves';
    this.scene.add(g);
    this.pickables.push(g);
  }

  /** The long table in the middle: books in stacks lying flat, and a row standing between two bookends. */
  private makeTable() {
    const wood = mat('#6b4a30');
    const cx = (TABLE.x0 + TABLE.x1) / 2;
    const cz = (TABLE.z0 + TABLE.z1) / 2;
    const w = TABLE.x1 - TABLE.x0;
    const d = TABLE.z1 - TABLE.z0;
    this.scene.add(box(w, 0.05, d, wood, cx, TABLE.h - 0.025, cz));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.scene.add(box(0.07, TABLE.h - 0.05, 0.07, wood, cx + sx * (w / 2 - 0.08), (TABLE.h - 0.05) / 2, cz + sz * (d / 2 - 0.08)));
    const rand = seeded(42);
    // stacks
    for (let x = TABLE.x0 + 0.22; x < TABLE.x1 - 0.2; x += 0.34 + rand() * 0.12) {
      if (x > -0.75 && x < -0.05) continue;
      for (const z of [-0.22, 0.2]) {
        if (rand() < 0.2) continue;
        let y = TABLE.h;
        const n = 2 + Math.floor(rand() * 5);
        for (let k = 0; k < n; k++) {
          const t = 0.03 + rand() * 0.035;
          const b = box(0.2 + rand() * 0.08, t, 0.26 + rand() * 0.1, mat(CLOTH[Math.floor(rand() * CLOTH.length)]), x + (rand() - 0.5) * 0.04, y + t / 2, z + (rand() - 0.5) * 0.04);
          b.rotation.y = (rand() - 0.5) * 0.3;
          this.scene.add(b);
          y += t;
        }
      }
    }
    // a row standing up, facing south, between two iron bookends
    const iron = mat('#2a2622');
    let x = -0.7;
    this.scene.add(box(0.02, 0.2, 0.14, iron, x - 0.02, TABLE.h + 0.1, 0));
    while (x < -0.12) {
      const bw = 0.03 + rand() * 0.035;
      const h = 0.18 + rand() * 0.08;
      this.scene.add(box(bw, h, 0.2, mat(CLOTH[Math.floor(rand() * CLOTH.length)]), x + bw / 2, TABLE.h + h / 2, 0));
      x += bw;
    }
    this.scene.add(box(0.02, 0.2, 0.14, iron, x + 0.02, TABLE.h + 0.1, 0));
  }

  /** The counter, an L of dark wood; on it the till, a stack of books, and her green lamp. Behind her, a high shelf of her own. */
  private makeCounter() {
    const wood = mat('#3e2618');
    const top = mat('#5a3a24');
    const H = COUNTER.h;
    this.scene.add(box(COUNTER.x1 - COUNTER.x0, H - 0.04, COUNTER.z1 - COUNTER.z0, wood, (COUNTER.x0 + COUNTER.x1) / 2, (H - 0.04) / 2, (COUNTER.z0 + COUNTER.z1) / 2));
    this.scene.add(box(COUNTER.x1 - COUNTER.x0 + 0.06, 0.04, COUNTER.z1 - COUNTER.z0 + 0.06, top, (COUNTER.x0 + COUNTER.x1) / 2, H - 0.02, (COUNTER.z0 + COUNTER.z1) / 2));
    this.scene.add(box(COUNTER.x2 - COUNTER.x1, H - 0.04, COUNTER.z1 - COUNTER.z2, wood, (COUNTER.x1 + COUNTER.x2) / 2, (H - 0.04) / 2, (COUNTER.z1 + COUNTER.z2) / 2));
    this.scene.add(box(COUNTER.x2 - COUNTER.x1 + 0.03, 0.04, COUNTER.z1 - COUNTER.z2 + 0.06, top, (COUNTER.x1 + COUNTER.x2) / 2 + 0.015, H - 0.02, (COUNTER.z1 + COUNTER.z2) / 2));
    // (its panelled front)
    const panel = mat('#4a3020');
    for (let z = COUNTER.z0 + 0.35; z < COUNTER.z1 - 0.2; z += 0.6) this.scene.add(box(0.02, H - 0.3, 0.48, panel, COUNTER.x0 - 0.005, H / 2, z + 0.24));
    // the till: brass, a sloped bank of keys, its little window on top
    const till = new THREE.Group();
    const brass = mat('#a8823a');
    till.add(box(0.36, 0.2, 0.34, brass, 0, 0.1, 0));
    const keys = box(0.34, 0.06, 0.2, mat('#2a2622'), -0.06, 0.24, 0);
    keys.rotation.z = 0.5;
    till.add(keys, box(0.1, 0.16, 0.26, brass, 0.1, 0.32, 0), box(0.02, 0.06, 0.16, mat('#efe6cf'), 0.04, 0.36, 0));
    till.position.set(2.4, H, -1.75);
    this.scene.add(till);
    // a stack waiting to be priced
    const rand = seeded(79);
    let y = H;
    for (let k = 0; k < 5; k++) {
      const t = 0.035 + rand() * 0.03;
      const b = box(0.22 + rand() * 0.05, t, 0.28 + rand() * 0.06, mat(CLOTH[Math.floor(rand() * CLOTH.length)]), 2.4, y + t / 2, -0.85);
      b.rotation.y = (rand() - 0.5) * 0.4;
      this.scene.add(b);
      y += t;
    }
    // behind her: a low cupboard, and up on the wall a short shelf of a dozen of her own
    this.scene.add(box(1.6, 0.85, 0.42, wood, 3.65, 0.425, BACK + 0.21), box(1.66, 0.03, 0.46, top, 3.65, 0.865, BACK + 0.23));
    this.scene.add(box(1.3, 0.03, 0.24, mat('#5e3b22'), 3.6, 2.0, BACK + 0.12));
    for (const s of [-1, 1]) this.scene.add(box(0.03, 0.18, 0.03, mat('#2a2622'), 3.6 + s * 0.55, 1.92, BACK + 0.05));
    let bx = 3.0;
    for (let k = 0; k < 12; k++) {
      const w = 0.04 + rand() * 0.03;
      const h = 0.2 + rand() * 0.1;
      this.scene.add(box(w, h, 0.18, mat(CLOTH[Math.floor(rand() * CLOTH.length)]), bx + w / 2, 2.015 + h / 2, BACK + 0.13));
      bx += w + 0.005;
    }
  }

  /**
   * A plain round clock on the back wall behind the counter's north end, in a dark wooden rim. Its
   * hands keep the island's time, and it ticks loud enough to hear in a quiet shop.
   */
  private makeClock() {
    const g = new THREE.Group();
    g.position.set(CLOCK.x, CLOCK.dial, CLOCK.z);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 14), mat('#3a2618'));
    rim.rotation.x = Math.PI / 2;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.18, 14), mat('#efe2c0'));
    face.position.z = 0.032;
    g.add(rim, face);
    // the hands, from the dial's middle: they're laid along +y and turned round it
    const ink = mat('#1c1814');
    this.hands.hour.add(box(0.03, 0.1, 0.008, ink, 0, 0.05, 0));
    this.hands.minute.add(box(0.02, 0.15, 0.008, ink, 0, 0.075, 0));
    this.hands.hour.position.z = 0.038;
    this.hands.minute.position.z = 0.044;
    g.add(this.hands.hour, this.hands.minute);
    g.userData.id = 'clock';
    this.scene.add(g);
    this.pickables.push(g);
  }

  /** The window corner: an old armchair for reading in, a standard lamp beside it, and piles on the floor where the shelves ran out. */
  private makeCorner() {
    const leather = mat('#5a2e22');
    const chair = new THREE.Group();
    chair.add(box(0.7, 0.42, 0.66, leather, 0, 0.21, 0), box(0.7, 0.62, 0.16, leather, 0, 0.62, -0.28), box(0.14, 0.24, 0.62, leather, -0.31, 0.52, 0), box(0.14, 0.24, 0.62, leather, 0.31, 0.52, 0));
    chair.add(box(0.5, 0.08, 0.44, mat('#6e3a2a'), 0, 0.46, 0.04));
    chair.position.set(-3.75, 0, -1.95);
    chair.rotation.y = 0.65;
    this.scene.add(chair);
    const rand = seeded(1979);
    const pile = (px: number, pz: number, n: number) => {
      let y = 0;
      for (let k = 0; k < n; k++) {
        const t = 0.035 + rand() * 0.035;
        const b = box(0.22 + rand() * 0.08, t, 0.28 + rand() * 0.08, mat(CLOTH[Math.floor(rand() * CLOTH.length)]), px + (rand() - 0.5) * 0.04, y + t / 2, pz);
        b.rotation.y = (rand() - 0.5) * 0.5;
        this.scene.add(b);
        y += t;
      }
    };
    pile(1.45, -2.3, 11);
    pile(1.05, -2.35, 6);
    pile(-2.9, -2.35, 8);
    pile(4.15, 1.4, 9);
    pile(3.7, 1.55, 5);
  }

  /** Her green desk lamp on the counter, and the standard lamp by the chair; both on when it's dim out. */
  private makeLamps() {
    const green = mat('#2e6a48');
    const brass = mat('#b8923e');
    const lamp = new THREE.Group();
    lamp.add(box(0.16, 0.03, 0.12, brass, 0, 0.015, 0), box(0.025, 0.3, 0.025, brass, 0, 0.16, 0));
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8, 1, false, 0, Math.PI), green);
    shade.rotation.z = Math.PI / 2;
    shade.position.y = 0.32;
    lamp.add(shade);
    const bulb = new THREE.MeshBasicMaterial({ color: '#fff0c0' });
    lamp.add(box(0.26, 0.015, 0.1, bulb, 0, 0.3, 0));
    lamp.position.set(3.05, COUNTER.h, 0.6);
    lamp.rotation.y = 0.5;
    this.scene.add(lamp);
    this.desk.position.set(3.05, COUNTER.h + 0.25, 0.5);
    // (its pool on the counter)
    const pool = new THREE.MeshBasicMaterial({ color: '#ffd890', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 8).rotateX(-Math.PI / 2), pool);
    disc.scale.set(1.4, 1, 0.8);
    disc.position.set(2.95, COUNTER.h + 0.002, 0.6);
    this.scene.add(disc);
    // the standard lamp, a fringed shade
    const std = new THREE.Group();
    std.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 6), brass), box(0.03, 1.5, 0.03, brass, 0, 0.75, 0));
    const fringe = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.27, 0.28, 8), mat('#d8b878'));
    fringe.position.y = 1.55;
    std.add(fringe);
    const lit = new THREE.MeshBasicMaterial({ color: '#fff0c0' });
    const under = new THREE.Mesh(new THREE.CircleGeometry(0.24, 8).rotateX(Math.PI / 2), lit);
    under.position.y = 1.41;
    std.add(under);
    std.position.set(-4.15, 0, -2.65);
    this.scene.add(std);
    this.standard.position.set(-4.0, 1.4, -2.4);
    this.bulbs.push(bulb, lit);
    return pool;
  }

  /** The sun through the window, laid on the boards in the shape of its panes: a stepped, dithered patch. */
  private makeSunlight() {
    const m = new THREE.ShaderMaterial({
      uniforms: this.sunU,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vAt;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vAt = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        uniform float uSlope;
        uniform float uAlong;
        uniform vec3 uColor;
        varying vec3 vAt;
        ${PANE_GLSL}
        ${BAYER_GLSL}
        void main() {
          // back along the sun's way to the window: is it a pane there?
          float t = vAt.x - ${(WEST - 0.14).toFixed(3)};
          float y = vAt.y + t * uSlope;
          float z = vAt.z + t * uAlong;
          if (!inPane(z, y)) discard;
          // stepped, and dithered between steps; fading a little the further it reaches into the room
          float s = uStrength * (1.0 - smoothstep(1.0, 6.0, t) * 0.5);
          float level = floor(s * 3.0 + bayer4(gl_FragCoord.xy) * 0.999) / 3.0;
          if (level <= 0.0) discard;
          gl_FragColor = vec4(uColor * level, 1.0);
        }`,
    });
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(EAST - WEST, FRONT - BACK).rotateX(-Math.PI / 2), m);
    patch.position.set(0, 0.012, 0);
    patch.renderOrder = 2;
    this.scene.add(patch);
  }

  /** Dust, a texel each, turning over slowly in the sun. */
  private makeMotes() {
    const rand = seeded(23);
    const n = 110;
    for (let i = 0; i < n; i++) this.moteAt.push({ x: -4.2 + rand() * 4.4, y: 0.3 + rand() * 2.2, z: -2.6 + rand() * 3.2, p: rand() * 100 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff4d6', size: 1, sizeAttenuation: false }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    return pts;
  }

  /** Whether a point's in the sun through the window (as the floor's patch has it). */
  private sunlit(x: number, y: number, z: number) {
    const t = x - (WEST - 0.14);
    const wy = y + t * this.sunU.uSlope.value;
    const wz = z + t * this.sunU.uAlong.value;
    if (wz < WIN.z0 || wz > WIN.z1 || wy < WIN.y0 || wy > WIN.y1) return false;
    const u = ((wz - WIN.z0) / (WIN.z1 - WIN.z0)) * WIN.across;
    const v = ((wy - WIN.y0) / (WIN.y1 - WIN.y0)) * WIN.down;
    return Math.min(u % 1, 1 - (u % 1)) > 0.045 && Math.min(v % 1, 1 - (v % 1)) > 0.05;
  }

  /** In at the street door, the bell going, a step into the shop. */
  arrive() {
    this.leaving = false;
    this.out = false;
    this.fresh = true;
    this.atCounter = false;
    this.visits = 0;
    this.stillFor = 0;
    this.keys.clear();
    this.pos.copy(IN);
    this.heading = Math.PI / 2;
    this.speed = PACE * 0.6;
    this.goal = STEP_IN.clone();
    this.zoomed = 1;
    this.ringBell();
    this.ticked = -1;
    // (a new visit, a new customer: whoever was in has gone)
    this.customer?.remove();
    this.customer = null;
    this.customerIn = CUSTOMER_IN;
    this.served = false;
    this.arrivals++;
    this.frame(0);
  }

  /** Back out of the street door. */
  goOut() {
    this.out = true;
    this.goal = new THREE.Vector3(WEST + 0.1, 0, (DOOR.z0 + DOOR.z1) / 2);
  }

  key(code: string, down: boolean) {
    const k = KEYS[code];
    if (!k) return false;
    if (down) this.keys.add(k), (this.goal = null), (this.out = false);
    else this.keys.delete(k);
    return true;
  }

  releaseKeys() {
    this.keys.clear();
  }

  pick(ndc: THREE.Vector2): Thing | null {
    this.ray.setFromCamera(ndc, this.camera);
    let o: THREE.Object3D | null = this.ray.intersectObjects(this.pickables, true)[0]?.object ?? null;
    while (o && !o.userData.id) o = o.parent;
    return (o?.userData.id as Thing | undefined) ?? null;
  }

  /** A click: on a thing, walk to it (on the door, out); anywhere on the floor, walk there. */
  click(ndc: THREE.Vector2) {
    const at = this.pick(ndc);
    this.out = false;
    if (at) return void (this.goal = GOALS[at].clone());
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) this.goal = p.set(THREE.MathUtils.clamp(p.x, WEST + 0.3, EAST - 0.3), 0, THREE.MathUtils.clamp(p.z, BACK + CASE.deep + 0.25, FRONT - 0.3));
  }

  zoom(factor: number) {
    this.zoomed = THREE.MathUtils.clamp(this.zoomed * factor, 0.6, 1.5);
  }

  drag() {}

  resize(width: number, height: number) {
    this.aspect = width / height;
  }

  /** How far it is to the counter (or behind it) from where you stand. */
  private toCounter(p = this.pos) {
    const dx = Math.max(0, COUNTER.x0 - p.x);
    const dz = Math.max(0, p.z - COUNTER.z1, COUNTER.z0 - 0.7 - p.z);
    return Math.hypot(dx, dz);
  }

  update(dt: number) {
    this.time += dt;
    this.walk(dt);
    this.animate(dt);
    this.light(dt);
    this.tineLives(dt);
    this.keepTime();
    // the bell, ringing out on its spring and dying away
    this.ring = Math.max(0, this.ring - dt * 0.45);
    this.bell.rotation.x = Math.sin(this.time * 14) * this.ring * this.ring * 0.6;
    if (this.fresh && this.pos.distanceTo(STEP_IN) > 1.2 && !this.goal) this.fresh = false;
    if (this.fresh && this.pos.distanceTo(STEP_IN) > 2.2) this.fresh = false;
    // its cards, by where you stand
    const counter = this.toCounter();
    // (at the counter's north end, under the clock, you're looking at the clock, not at her)
    const byClock = this.pos.x > 1.4 && this.pos.z < -1.45;
    const atCounter = counter < TALK && !byClock;
    if (atCounter && !this.atCounter) this.visits++;
    this.atCounter = atCounter;
    const west = this.pos.x < WEST + 1.5;
    this.serve(dt);
    const p = this.customer?.phase;
    const byDoor = west && this.pos.z > DOOR.z0 - 0.4 && this.pos.z < FRONT;
    this.card =
      this.fresh ? 'shop'
      : (p === 'ask' || p === 'wait' || p === 'found' || p === 'pay') && !byDoor ? 'customer'
      : atCounter ? 'tine'
      : byClock ? 'clock'
      : this.atShelves ? 'shelves'
      : west && this.pos.z > WIN.z0 && this.pos.z < WIN.z1 ? 'window'
      : west && this.pos.z > DOOR.z0 - 0.4 && this.pos.z < FRONT ? 'door'
      : this.stillFor > STILL ? 'shop'
      : null;
    if (this.out && !this.goal) this.leaving = true;
    if (this.out && this.pos.x < WEST + 0.35) this.leaving = true;
    if (this.leaving && this.ring < 0.5) this.ringBell();
    this.frame(dt);
  }

  /** By the back wall's shelves. */
  get atShelves() {
    return this.pos.z < BACK + CASE.deep + 1.5 && this.pos.x > -3.2 && this.pos.x < 1.4;
  }

  /**
   * Someone comes in after a book, a while after you've come in yourself (not while Tine's talking
   * to you), in turn by the hour and the visit; the bell as they come and go.
   */
  private serve(dt: number) {
    if (!this.customer && !this.served && !this.fresh && !this.atCounter && this.talking <= 0) {
      this.customerIn -= dt;
      if (this.customerIn <= 0) {
        // (`?customer=<id>` brings that one in, for a look)
        const asked = CUSTOMERS.find((p) => p.id === new URLSearchParams(location.search).get('customer'));
        const who = asked ?? CUSTOMERS[(Math.floor(this.moment.hours) + this.arrivals) % CUSTOMERS.length];
        this.customer = new Customer(who, this.scene);
        this.customer.onStep = (x, z) => this.onTheirStep?.(this.sideOf(x, z), this.nearness(x, z));
        this.served = true;
        this.rungOut = false;
        this.ringBell();
      }
    }
    const c = this.customer;
    if (!c) return;
    c.update(dt);
    // (the bell again as they go out of the door)
    if (c.phase === 'out' && c.x < WEST + 0.6 && !this.rungOut) (this.rungOut = true), this.ringBell();
    if (c.phase === 'gone') (c.remove(), (this.customer = null));
  }

  /** Where the customer is from you, across the picture, and how near (for their voice). */
  customerSide() {
    const c = this.customer;
    return c ? { side: this.sideOf(c.x, c.z), near: this.nearness(c.x, c.z) } : { side: 0, near: 0 };
  }

  /** The shop's light for the moment: the sun at the window, the lamps when it's dim, the street. */
  private light(dt: number) {
    const { day, warm, rain, fog, snow } = this.moment;
    const overcast = THREE.MathUtils.clamp(rain * 1.2 + fog * 0.9 + snow * 0.5, 0, 1);
    // (no sun to speak of through rain or fog: the patch goes, rather than lingering in a few stray texels)
    const sun = day * Math.max(0, 1 - overcast * 1.15) ** 1.5;
    this.hemi.intensity = 1.55 + 0.6 * day;
    this.hemi.color.set('#fff0d8').lerp(new THREE.Color('#ffd9a0'), warm * 0.5 + (1 - day) * 0.4);
    this.sun.color.set('#fff1d6').lerp(new THREE.Color('#ffb070'), warm);
    this.sun.intensity = 1.6 * sun;
    const slope = THREE.MathUtils.lerp(1.15, 0.42, warm);
    this.sun.position.set(-10, 10 * slope, 10 * SUN_ALONG);
    this.sun.target.position.set(0, 0, 0);
    this.sunU.uSlope.value = slope;
    this.sunU.uAlong.value = SUN_ALONG;
    this.sunU.uStrength.value = sun;
    this.sunU.uColor.value.set('#8c6c40').lerp(new THREE.Color('#a05a22'), warm);
    // the lamps: on as it dims (hers always, she's reading)
    const dim = THREE.MathUtils.clamp(1 - day + warm * 0.7 + overcast * 0.4, 0, 1);
    this.desk.intensity = 1.2 + 4 * dim;
    this.standard.intensity = 5 * dim;
    this.bulbs[1].color.set(dim > 0.25 ? '#fff0c0' : '#8a7c62');
    this.pool.color.set('#3a2a10').multiplyScalar(0.3 + dim);
    const g = this.glassU;
    g.uDay.value = day;
    g.uWarm.value = warm;
    g.uRain.value = rain;
    g.uFog.value = fog;
    g.uSnow.value = snow;
    if (!this.still) g.uTime.value += dt;
    // the dust in the sun
    const pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const t = this.still ? 0 : this.time;
    this.moteAt.forEach((m, i) => {
      const x = m.x + Math.sin(t * 0.07 + m.p) * 0.25;
      const y = m.y + Math.sin(t * 0.05 + m.p * 1.7) * 0.2;
      const z = m.z + Math.cos(t * 0.06 + m.p * 0.6) * 0.25;
      const seen = sun > 0.3 && this.sunlit(x, y, z) && (i / this.moteAt.length) < sun;
      pos.setXYZ(i, x, seen ? y : -50, z);
    });
    pos.needsUpdate = true;
  }

  /** Where Tine is from you, across the picture: -1 (left) … 1 (right), for her voice. */
  tineSide() {
    return this.sideOf(TINE_AT.x, TINE_AT.z);
  }

  /** Where a thing in the shop is from you, across the picture: -1 (left) … 1 (right). */
  private sideOf(x: number, z: number) {
    return THREE.MathUtils.clamp((x - this.pos.x) * this.right.x + (z - this.pos.z) * this.right.z, -3, 3) / 3;
  }

  /** How near a thing in the shop is (1 beside it, about 0.3 across the room). */
  private nearness(x: number, z: number) {
    return 1 / (1 + Math.hypot(x - this.pos.x, z - this.pos.z) * 0.28);
  }

  /** The bell over the street door, set ringing on its spring. */
  private ringBell() {
    this.ring = 1;
    this.onBell?.(this.sideOf(WEST, DOOR.z0 + 0.2));
  }

  /**
   * The street outside, through the window, as you'd hear it from where you stand: busy by day,
   * quieter in the evening, nearly nothing at night, and fewer people out in the rain; louder the
   * nearer the glass you are. Its level (0–1), and its side.
   */
  street() {
    const h = this.moment.hours;
    const busy = h >= 8 && h < 18 ? 1 : h >= 7 && h < 21 ? 0.5 : h >= 6 && h < 23 ? 0.2 : 0.06;
    const out = busy * (1 - this.moment.rain * 0.6) * (1 - this.moment.snow * 0.5);
    const glass = 0.45 + 0.55 * THREE.MathUtils.clamp(1 - (this.pos.x - WEST) / 6, 0, 1);
    return { level: out * glass, side: this.sideOf(WEST, (WIN.z0 + WIN.z1) / 2) };
  }

  /** The clock keeping the island's time: its hands, and a tick each second (tick and tock a little apart). */
  private keepTime() {
    const { hours, seconds } = this.moment;
    this.hands.hour.rotation.z = -((hours % 12) / 12) * Math.PI * 2;
    this.hands.minute.rotation.z = -((hours % 1) * Math.PI * 2);
    const second = Math.floor(seconds);
    if (second !== this.ticked) {
      if (this.ticked >= 0) this.onTick?.(second % 2 === 1, this.sideOf(CLOCK.x, CLOCK.z), this.nearness(CLOCK.x, CLOCK.z));
      this.ticked = second;
    }
  }

  /** Tine says a line out loud, about this long (s): her head goes with the words while she does. */
  tineSays(seconds: number) {
    this.talking = seconds;
  }

  /** Tine reads, turning a page every so often; come to the counter and she looks up at you, and goes back to it when you go. */
  private tineLives(dt: number) {
    const t = this.tine;
    const near = this.toCounter() < LOOK_UP && !this.fresh && !(this.customer?.phase === 'ask');
    // where she looks: at you (her head turned, and up), or down at the book
    const want = new THREE.Vector2(0, 0.42);
    const c = this.customer;
    const them = c && c.phase === 'pay' && c.speaker === 'tine' && c.talking > 0;
    if (near || them) {
      const dx = (them ? c.x : this.pos.x) - TINE_AT.x;
      const dz = (them ? c.z : this.pos.z) - TINE_AT.z;
      const turn = Math.atan2(dx, dz) - TINE_FACING;
      want.set(THREE.MathUtils.clamp(Math.atan2(Math.sin(turn), Math.cos(turn)), -1.1, 1.1), -0.08);
    }
    const k = 1 - Math.exp(-dt * (near ? 4 : 2));
    this.look.lerp(want, k);
    // (talking, her head dips a little on the stresses, and stills between phrases)
    this.talking = Math.max(0, this.talking - dt);
    const phrase = Math.max(0, Math.sin(this.time * 1.3) + 0.35);
    const nod = this.talking > 0.2 ? Math.abs(Math.sin(this.time * 6.5)) * Math.min(1, phrase) * 0.09 : 0;
    t.head.rotation.set(this.look.y + nod, this.look.x, 0, 'YXZ');
    // the page: every fifteen to twenty-five seconds, over (not while she's looking at you)
    if (this.turning < 0) {
      this.turnIn -= dt;
      if (this.turnIn <= 0 && !near) {
        this.turning = 0;
        this.turnIn = 15 + Math.random() * 10;
        this.onTurn?.(this.tineSide(), this.nearness(TINE_AT.x, TINE_AT.z));
      }
    } else {
      this.turning += dt / 1.1;
      if (this.turning >= 1) this.turning = -1;
    }
    const f = this.turning < 0 ? 0 : this.turning;
    const over = THREE.MathUtils.smoothstep(f, 0.15, 0.75);
    t.page.rotation.z = over * Math.PI * 0.95;
    t.page.visible = f > 0;
    // (her right hand goes across with it, and back)
    const reach = Math.sin(Math.min(1, f) * Math.PI);
    t.arm.rotation.z = 0.12 - reach * 0.45;
    t.arm.rotation.x = -0.35 - reach * 0.25;
  }

  private walk(dt: number) {
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
      if (d <= 0.06) this.goal = null;
      else (move.set(dx / d, dz / d), (want = PACE * Math.min(1, d / 0.3 + 0.3)));
    }
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * 8));
    if (this.speed < 0.02 && !want) {
      this.speed = 0;
      this.stillFor += dt;
      // stood at the counter, you face her; at the shelves, them; at the window, out
      const face = this.card === 'tine' ? Math.atan2(TINE_AT.x - this.pos.x, TINE_AT.z - this.pos.z) : this.card === 'shelves' ? Math.PI : this.card === 'window' ? -Math.PI / 2 : this.card === 'clock' ? Math.atan2(CLOCK.x - this.pos.x, CLOCK.z - this.pos.z) : null;
      if (face !== null) {
        let turn = face - this.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        this.heading += turn * (1 - Math.exp(-dt * 3));
      }
      return;
    }
    this.stillFor = 0;
    if (move.lengthSq()) {
      let turn = Math.atan2(move.x, move.y) - this.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      this.heading += turn * (1 - Math.exp(-dt * 10));
    }
    const step = this.speed * dt;
    const nx = this.pos.x + Math.sin(this.heading) * step;
    const nz = this.pos.z + Math.cos(this.heading) * step;
    // (round the table, the counter, the chair and the piles, sliding along them)
    const was = this.pos.clone();
    if (this.free(nx, this.pos.z)) this.pos.x = nx;
    if (this.free(this.pos.x, nz)) this.pos.z = nz;
    // (stuck against something on the way to a click: give up on it)
    if (this.goal && this.speed > 0.3 && this.pos.distanceTo(was) < step * 0.15) this.goal = null;
    this.stride += step;
    if (this.stride - this.lastStep > 0.62) {
      this.lastStep = this.stride;
      this.onStep?.();
    }
  }

  /** Whether you fit there. */
  private free(x: number, z: number) {
    const r = 0.22;
    const out = this.out && z > DOOR.z0 + 0.15 && z < DOOR.z1 - 0.15;
    if (x < (out ? WEST - 0.05 : WEST + r) || x > EAST - r || z < BACK + CASE.deep + r || z > FRONT - 0.25) return false;
    const inside = (x0: number, x1: number, z0: number, z1: number) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r;
    return !(
      inside(TABLE.x0, TABLE.x1, TABLE.z0, TABLE.z1) ||
      inside(COUNTER.x0, EAST, BACK, COUNTER.z1) ||
      inside(-4.15, -3.35, -2.4, -1.5) ||
      inside(0.9, 1.65, BACK, -2.1) ||
      inside(-3.1, -2.7, BACK, -2.15) ||
      inside(3.45, EAST, 1.2, 1.75) ||
      inside(-4.35, -3.95, BACK, -2.45)
    );
  }

  private animate(dt: number) {
    void dt;
    const w = this.you;
    w.root.position.copy(this.pos);
    w.root.rotation.set(0, this.heading, 0);
    const swing = Math.sin(this.stride * 9) * Math.min(1, this.speed / PACE) * 0.45;
    w.legs[0].rotation.x = swing;
    w.legs[1].rotation.x = -swing;
    w.arms[0].rotation.x = -swing * 0.8;
    w.arms[1].rotation.x = swing * 0.8;
    w.scarfTail.rotation.x = 0.1 + this.speed * 0.1;
  }

  /** The room's extent across and up the screen (the camera's axes don't change, so once). */
  private measure() {
    const e = { r0: Infinity, r1: -Infinity, u0: Infinity, u1: -Infinity };
    for (const x of [WEST - 0.3, EAST + 0.05]) {
      for (const y of [-0.3, TALL + 0.05]) {
        for (const z of [BACK - 0.3, FRONT + 0.05]) {
          const p = new THREE.Vector3(x, y, z);
          const r = p.dot(this.right);
          const u = p.dot(this.up);
          e.r0 = Math.min(e.r0, r);
          e.r1 = Math.max(e.r1, r);
          e.u0 = Math.min(e.u0, u);
          e.u1 = Math.max(e.u1, u);
        }
      }
    }
    this.extent = e;
  }

  /**
   * The whole shop on any screen: as wide as it needs to be across, or as tall; where there's room to
   * spare above and below (a phone), the shop sits high, out of the card's way. Zoomed in, the view
   * follows you, but never off the shop's edges.
   */
  private frame(dt: number) {
    const e = this.extent;
    const wide = e.r1 - e.r0;
    const tall = e.u1 - e.u0;
    const fit = Math.max(tall, wide / this.aspect) * 1.04;
    const view = fit * this.zoomed;
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    const at = this.pos.clone().setY(1);
    const youR = at.dot(this.right);
    const youU = at.dot(this.up);
    const spare = view - tall;
    // (a phone's spare height: the shop a little above the middle, the card under it)
    const lift = spare > 0 ? Math.min(spare * 0.3, view * 0.12) : 0;
    const want = new THREE.Vector2(
      wide <= 2 * w ? (e.r0 + e.r1) / 2 : THREE.MathUtils.clamp(youR, e.r0 + w, e.r1 - w),
      tall <= 2 * h ? (e.u0 + e.u1) / 2 - lift : THREE.MathUtils.clamp(youU, e.u0 + h, e.u1 - h),
    );
    if (dt) this.centre.lerp(want, 1 - Math.exp(-dt * 2.5));
    else this.centre.copy(want);
    const p = new THREE.Vector3().addScaledVector(this.right, this.centre.x).addScaledVector(this.up, this.centre.y);
    cam.position.copy(p).addScaledVector(this.back, DISTANCE);
    cam.lookAt(p);
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
  }
}
