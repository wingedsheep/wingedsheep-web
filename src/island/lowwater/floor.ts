/**
 * The old floor: follow the prints east off the scour and you come out where the sea has taken
 * all the sand off, down to a floor of grey silt laid down seven thousand years ago, when this was
 * marsh at the edge of the land. Its mud was soft then, and people and animals walked on it; the
 * sea came up over it and laid sand on top, and now a storm's taken the sand off again. The sea
 * takes a layer a tide, so who walked here changes with the island's tide (`CASTS`): two people
 * barefoot, a grown one walking west and a child running rings round them, and a red deer that
 * came by after; or one person alone, who stopped; a grown one and a dog; a crowd; a few aurochs
 * and a person following them. Sometimes a crane fed by a pool. Your boots leave nothing: it set
 * too long ago. The flat is about my tide; this is about how I know anyone at all.
 *
 * Its own scene and camera, drawn through the island's PixelRenderer like the page, looking north
 * but steeper and nearer, down at your feet, because here what there is to see is on the ground.
 * The sand's edge is behind you (south), and the sea in front (north). Walk back south up onto the
 * sand for the flat.
 */
import * as THREE from 'three';
import { toon } from '../scene/toon';
import { makeFigure, type Figure } from './figure';
import { Curlew } from './curlew';

const ELEVATION = THREE.MathUtils.degToRad(48);
const DISTANCE = 90;
const PACE = 1.6;
/** How far the floor goes east and west (m). */
const SPAN = 44;
/** Stood this long (s), the card for where you are comes back, or the one that only comes standing still. */
const STILL = 7;
/**
 * The prints are drawn half as big again as they'd really be, or a child's would be a texel or
 * two from up here; they keep their sizes to each other.
 */
export const BIG = 1.5;

/** Where the sand starts again, to the south (z, by x): you came over it, and it's the way back. */
export function sandZ(x: number) {
  return 4 + 0.8 * Math.sin(x * 0.21) + 0.4 * Math.sin(x * 0.57 + 1);
}
/** Where the sea is, to the north. */
export function seaZ(x: number) {
  return -24 + 1.5 * Math.sin(x * 0.13 + 2) + 0.6 * Math.sin(x * 0.41);
}

/** A grown one's way across: in from the east, out to the west, not hurrying and not stopping (`ph` shifts it, `z` is where it runs). */
function wayZ(ph: number, z = -7) {
  return (x: number) => z + 1.2 * Math.sin((x + ph) * 0.05) + 0.4 * Math.sin((x + ph) * 0.17 + 0.5);
}
/** A child's, round a grown one's: out to the side and back, out and back, ahead and behind. */
function roundZ(way: (x: number) => number, ph: number) {
  return (x: number) => way(x) + 2.6 * Math.sin((x + ph) * 0.38 + 0.6 * Math.sin((x + ph) * 0.11)) + 0.5 * Math.sin((x + ph) * 1.1);
}
const POOL_R = 2.4;

/** Who walked the floor this tide. */
export const CASTS = ['two', 'alone', 'dog', 'many', 'aurochs'] as const;
export type Cast = (typeof CASTS)[number];
/** The sea takes a layer a tide: a tide's 12 h 25 min, so two a day and a bit. */
const TIDE = 12.4206 * 3600e3;
export function tideOf(d: Date) {
  return Math.floor(d.getTime() / TIDE);
}
/**
 * Whose floor's up this tide: each five tides all five in a shuffled order, so never the same
 * two running (where one five's last is the next one's first, the next's first two swap).
 */
export function castFor(tide: number): Cast {
  const order = (block: number) => {
    const rand = mulberry(block * 7919 + 13);
    const o = [...CASTS];
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }
    return o;
  };
  const n = CASTS.length;
  const block = Math.floor(tide / n);
  const o = order(block);
  if (o[0] === order(block - 1)[n - 1]) [o[0], o[1]] = [o[1], o[0]];
  return o[tide - block * n];
}

const CLAY = ['#4d4f66', '#45465e', '#3c3d55'].map((c) => new THREE.Color(c));
export const HOLLOW = new THREE.Color('#29283d');
/** What a print's water gives back: the sky. */
export const SKY = new THREE.Color('#8a8fb7');
const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

/** `who` is the floor's walkers', `mark` the one place where their prints say a little more (both by the cast, in words.ts). */
export type FloorCard = 'floor' | 'who' | 'mark' | 'crane' | 'known' | 'back';

type Print = { x: number; z: number; heading: number; side: number };

/** A bare foot, heel at the back, its length along +x: the sole, narrow at the arch, and five toes in front of it. */
export function footShape(length: number, toes = true) {
  const sole = soleShape(length * 0.8, length * 0.1);
  if (!toes) return sole;
  const l = length;
  // (the big toe on the inside, +y, the rest smaller and further back round the ball)
  const dots = [[0.55, 0.11, 0.075], [0.52, -0.01, 0.05], [0.47, -0.09, 0.045], [0.41, -0.16, 0.04], [0.34, -0.21, 0.037]];
  return [...sole, ...dots.map(([x, y, r]) => new THREE.Shape().absarc(x * l, y * l, r * l, 0, Math.PI * 2, false))];
}

function soleShape(length: number, back: number) {
  const l = length;
  const b = back;
  const s = new THREE.Shape();
  s.moveTo(-l * 0.5 - b, 0);
  s.bezierCurveTo(-l * 0.5 - b, l * 0.19, -l * 0.25, l * 0.17, 0, l * 0.13);
  s.bezierCurveTo(l * 0.2, l * 0.12, l * 0.32, l * 0.25, l * 0.44, l * 0.2);
  s.bezierCurveTo(l * 0.55, l * 0.15, l * 0.55, -l * 0.05, l * 0.42, -l * 0.15);
  s.bezierCurveTo(l * 0.25, -l * 0.25, l * 0.05, -l * 0.19, -l * 0.15, -l * 0.19);
  s.bezierCurveTo(-l * 0.4 - b, -l * 0.19, -l * 0.5 - b, -l * 0.15, -l * 0.5 - b, 0);
  return [s];
}

/** A deer's slot: two halves of a cloven hoof, pointed forward. */
function slotShape(length: number) {
  const l = length;
  const half = (side: number) => {
    const s = new THREE.Shape();
    s.moveTo(-l * 0.5, side * l * 0.06);
    s.bezierCurveTo(-l * 0.5, side * l * 0.42, l * 0.1, side * l * 0.4, l * 0.5, side * l * 0.06);
    s.lineTo(-l * 0.5, side * l * 0.06);
    return s;
  };
  return [half(1), half(-1)];
}

/** A crane's: three long toes forward and spread, a short one back. */
function craneShape(length: number) {
  const toe = (angle: number, long: number) => {
    const w = 0.028 * BIG;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const pts = [[0, -w], [long, -w * 0.5], [long, w * 0.5], [0, w]].map(([x, y]) => new THREE.Vector2(x * c - y * s, x * s + y * c));
    return new THREE.Shape(pts);
  };
  return [toe(0, length), toe(0.65, length * 0.85), toe(-0.65, length * 0.85), toe(Math.PI, length * 0.3)];
}

/** A dog's: four oval toes in an arc round a pad. */
function dogShape(length: number) {
  const l = length;
  const dot = (x: number, y: number, rx: number, ry: number) => new THREE.Shape().absellipse(x * l, y * l, rx * l, ry * l, 0, Math.PI * 2, false, 0);
  return [dot(-0.18, 0, 0.26, 0.3), dot(0.3, 0.12, 0.13, 0.1), dot(0.3, -0.12, 0.13, 0.1), dot(0.14, 0.32, 0.11, 0.09), dot(0.14, -0.32, 0.11, 0.09)];
}

/** An aurochs': a cloven hoof like the deer's, but round and broad, with a gap down the middle. */
function hoofShape(length: number) {
  const l = length;
  const half = (side: number) => {
    const s = new THREE.Shape();
    s.moveTo(-l * 0.45, side * l * 0.05);
    s.bezierCurveTo(-l * 0.6, side * l * 0.55, l * 0.35, side * l * 0.6, l * 0.5, side * l * 0.05);
    s.lineTo(-l * 0.45, side * l * 0.05);
    return s;
  };
  return [half(1), half(-1)];
}

export function flat(shapes: THREE.Shape[], scale = 1, shift = 0) {
  const g = new THREE.ShapeGeometry(shapes, 6);
  g.scale(scale, scale, 1);
  g.translate(shift, 0, 0);
  // (lying on the ground, its length along x, its left along -z)
  return g.rotateX(-Math.PI / 2);
}

/** A seeded rand, so a tide's floor is the same floor all that tide. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Prints along a way (z by x), going west from `from` to `to`, a step every `stride` metres along it (or as long as it is there). */
function along(way: (x: number) => number, from: number, to: number, stride: number | ((x: number) => number), wide: number, rand: () => number, jitter = 0.05) {
  const out: Print[] = [];
  let side = 1;
  let x = from;
  let carry = 0;
  while (x > to) {
    const dx = -0.05;
    const nz = way(x + dx);
    const z = way(x);
    const seg = Math.hypot(dx, nz - z);
    carry += seg;
    const heading = Math.atan2(dx, nz - z);
    if (carry >= (typeof stride === 'number' ? stride : stride(x)) * (1 + (rand() - 0.5) * jitter * 2)) {
      carry = 0;
      side = -side;
      out.push({ x: x + Math.cos(heading) * wide * side, z: z - Math.sin(heading) * wide * side, heading: heading + (rand() - 0.5) * 0.16, side });
    }
    x += dx;
  }
  return out;
}

/** The same, walked the other way (east): each print turned round, and so the other foot. */
function east(prints: Print[]) {
  return prints.map((p) => ({ ...p, heading: p.heading + Math.PI, side: -p.side })).reverse();
}

/** Prints in a straight line, from `at` along `dir` (x, z), a step every `stride`, `wide` either side of it. */
function line(at: THREE.Vector2, dir: THREE.Vector2, from: number, to: number, stride: number, wide: number, rand: () => number) {
  const d = dir.clone().normalize();
  const out: Print[] = [];
  for (let k = from; k <= to; k++) {
    const side = k % 2 ? 1 : -1;
    const s = k * stride + (rand() - 0.5) * stride * 0.1;
    out.push({ x: at.x + d.x * s + d.y * wide * side, z: at.y + d.y * s - d.x * wide * side, heading: Math.atan2(d.x, d.y) + (rand() - 0.5) * 0.12, side });
  }
  return out;
}

/** Two feet side by side, facing `heading`, `apart` between them. */
function stood(x: number, z: number, heading: number, apart: number): Print[] {
  // (the left foot's to the left of the way you face)
  const lx = Math.cos(heading) * apart * 0.5;
  const lz = -Math.sin(heading) * apart * 0.5;
  return [
    { x: x + lx, z: z + lz, heading, side: 1 },
    { x: x - lx, z: z - lz, heading, side: -1 },
  ];
}

export class Floor {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  card: FloorCard | null = null;
  /** Walked back up onto the sand: time for the flat again. */
  leaving = false;
  /** Each step, for the sound, and what it's on. */
  onStep?: (on: 'clay' | 'sand' | 'wash') => void;
  /** The sea in front, every frame: how loud (near the edge, and as the wash comes in), and from which side. */
  onSea?: (level: number, pan: number) => void;
  /** Water ticking in a print by you: how near, which side. */
  onTick?: (near: number, pan: number) => void;
  /** A curlew, far off over the marsh (as there'd have been then too): says whether it was heard. */
  onCurlew?: (near: number, pan: number) => boolean;
  /** The island's weather, for the curlew (it keeps quieter in a wind or rain). */
  readonly weather = { wind: 0, rain: 0 };
  /** The island's moment, as on the flat: how far into the night (0..1), and its fog (0..1). Rain is `weather.rain`. */
  readonly moment = { night: 0, fog: 0 };
  private hemi = new THREE.HemisphereLight('#8f95c8', '#3e3655', 1.3);
  private sun = new THREE.DirectionalLight('#ffbf92', 2.2);
  private lit = new THREE.Color('#6d5f72');
  private curlew = new Curlew();
  private tickIn = 1;
  private you: Figure;
  private pos = new THREE.Vector3();
  private heading = Math.PI;
  private speed = 0;
  private goal: THREE.Vector3 | null = null;
  private keys = new Set<string>();
  private stride = 0;
  private lastStep = 0;
  private walked = 0;
  private stillFor = 0;
  private time = 0;
  private ground: THREE.Mesh;
  private groundU: Record<string, THREE.IUniform>;
  private target = new THREE.Vector3();
  private pan = new THREE.Vector2();
  private view = 12;
  private aspect = 1;
  private zoomed = 1;
  private ray = new THREE.Raycaster();
  /** Every print, by whose, for knowing where you're stood. */
  private people: Print[] = [];
  private crane: Print[] = [];
  /** This tide's, and whose floor it is. */
  private tide = NaN;
  cast: Cast = 'two';
  private prints = new THREE.Group();
  /** Where the crane fed (or would have), by a pool. */
  private pool = new THREE.Vector2(-15, -14.5);
  /** Read the walkers' card, so standing still can say the rest. */
  private metThem = false;
  /** The one place their prints say more: where the deer stepped in the child's print, where one stood, crouched, followed. */
  private mark = new THREE.Vector2();
  private arrivedAt = new THREE.Vector2();

  constructor(private texels: () => number) {
    this.scene.background = CLAY[2].clone();
    // the warm band's light, low from the west; the sky's blue on the rest
    this.scene.add(this.hemi, this.camera);
    const sun = this.sun;
    sun.position.set(-40, 14, 10);
    this.scene.add(sun, sun.target);
    const skin = toon(new THREE.Color('#3a3348'), { own: true, bare: true });
    this.you = makeFigure({ coat: toon(new THREE.Color('#353352'), { own: true, bare: true }), boots: toon(new THREE.Color('#1b1a2a'), { own: true, bare: true }), scarf: toon(new THREE.Color('#efe2c6'), { own: true, bare: true }), skin });
    this.scene.add(this.you.root);
    const ground = this.makeGround();
    this.ground = ground.mesh;
    this.groundU = ground.uniforms;
    this.scene.add(this.prints);
    this.resize(innerWidth, innerHeight);
  }

  /**
   * The floor, the sand behind it and the sea in front, all in one: the silt worn down in
   * shallow steps, each a few of its layers lower than the last, with the layers' edges showing as
   * fine lines where it's worn across them; the deepest hollows holding water; wet everywhere, so
   * a speck of sky here and there. All stepped and dithered, a texel at a time.
   */
  private makeGround() {
    const uniforms = {
      uTime: { value: 0 },
      uClay0: { value: CLAY[0] },
      uClay1: { value: CLAY[1] },
      uClay2: { value: CLAY[2] },
      uLit: { value: this.lit.clone() },
      uDark: { value: new THREE.Color('#2e2d43') },
      uSand: { value: new THREE.Color('#686274') },
      uSandLit: { value: new THREE.Color('#757080') },
      uWater: { value: new THREE.Color('#4a5288') },
      uSky: { value: SKY },
      uWash: { value: new THREE.Color('#a9adc6') },
      uCrane: { value: this.pool },
      uShift: { value: new THREE.Vector2() },
      uRain: { value: 0 },
      uNight: { value: 0 },
      uFog: { value: 0 },
      uMist: { value: new THREE.Color('#8d90ac') },
      uNear: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vAt;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vAt = w.xz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
        uniform float uTime;
        uniform vec3 uClay0, uClay1, uClay2, uLit, uDark, uSand, uSandLit, uWater, uSky, uWash;
        uniform vec2 uCrane, uShift;
        uniform float uRain, uNight, uFog, uNear;
        uniform vec3 uMist;
        varying vec2 vAt;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        // how far down it's worn, 0 (the top that's left) .. 1
        float worn(vec2 p) {
          // (a different layer each tide, so worn differently)
          vec2 q = p + uShift;
          float n = noise(q * 0.09) * 0.6 + noise(q * 0.23 + 7.0) * 0.28 + noise(q * 0.7 + 3.0) * 0.12;
          // (and by the crane's pool, down to where the water stands)
          return n + 0.5 * max(0.0, 1.0 - length(p - uCrane) / ${(POOL_R * 1.6).toFixed(2)});
        }
        float sandZ(float x) { return 4.0 + 0.8 * sin(x * 0.21) + 0.4 * sin(x * 0.57 + 1.0); }
        float seaZ(float x) { return -24.0 + 1.5 * sin(x * 0.13 + 2.0) + 0.6 * sin(x * 0.41); }
        // a raindrop's ring spreading on standing water, somewhere in each cell of it, now and then
        vec3 rings(vec2 p, vec3 col, float d) {
          vec2 q = p * 1.4;
          vec2 cell = floor(q);
          float h = hash(cell + 17.0);
          if (h > uRain * 0.9) return col;
          float age = fract(uTime * (0.7 + 0.4 * h) + hash(cell + 5.0));
          vec2 c = cell + 0.25 + 0.5 * vec2(hash(cell + 2.0), hash(cell + 9.0));
          float r = length(q - c);
          return abs(r - age * 0.5) < 0.06 && 1.0 - age > d ? mix(col, uWash, 0.55) : col;
        }
        void main() {
          vec2 p = vAt;
          ivec2 px = ivec2(gl_FragCoord.xy);
          float d = (BAYER[(px.x & 3) + (px.y & 3) * 4] + 0.5) / 16.0;
          vec3 col;
          // the sea, coming in and going out a little over the floor's far edge, a wash of foam at its lip
          float sea = seaZ(p.x) + 0.35 * sin(uTime * 0.5 + p.x * 0.15);
          float sand = sandZ(p.x);
          if (p.y < sea) {
            col = uWater;
            if (hash(floor(vec2(p.x * 2.2 + uTime * 0.12, p.y * 9.0))) > 0.95) col = mix(uWater, uSky, 0.5);
            if (p.y > sea - 0.25 - 0.25 * d) col = uWash;
            else col = rings(p, col, d);
          } else if (p.y > sand) {
            // the sand you came over, in ripples, with its lip dark against the clay
            col = sin((p.y + 0.3 * sin(p.x * 0.7)) * 9.0) > 0.55 - d * 0.3 ? uSandLit : uSand;
            if (p.y < sand + 0.12) col = uDark;
          } else {
            float w = worn(p);
            float step = w < 0.5 ? 0.0 : w < 0.66 ? 1.0 : 2.0;
            col = step < 0.5 ? uClay0 : step < 1.5 ? uClay1 : uClay2;
            // where it's worn across its layers, their edges, fine as a contour
            if (fract(w * 9.0) < 0.1 && d < 0.4) col = mix(col, uDark, 0.35);
            // each step's edge: lit where it faces the low light from the west, dark where it's turned away
            float e = 0.18;
            float east = worn(p + vec2(e, 0.0));
            float west = worn(p - vec2(e, 0.0));
            float north = worn(p - vec2(0.0, e));
            float stepE = east < 0.5 ? 0.0 : east < 0.66 ? 1.0 : 2.0;
            float stepW = west < 0.5 ? 0.0 : west < 0.66 ? 1.0 : 2.0;
            float stepN = north < 0.5 ? 0.0 : north < 0.66 ? 1.0 : 2.0;
            if (stepE < step) col = uLit;
            else if (stepW < step || stepN < step) col = uDark;
            // the crane's pool, and the deepest hollows, hold water, and give back the sky
            vec2 c = p - uCrane;
            float pool = length(c * vec2(1.0, 1.25)) - ${POOL_R.toFixed(2)} * (1.0 + 0.12 * sin(atan(c.y, c.x) * 3.0 + 1.0));
            if (pool < 0.0) col = rings(p, pool < -0.2 || d < 0.5 ? mix(uSky, uWater, 0.35) : uDark, d);
            else if (w > 0.84) col = (w > 0.87 || d < 0.5) ? rings(p, mix(uSky, uClay2, 0.25), d) : uClay2;
            // and it's all wet: a speck of sky here and there
            else if (hash(floor(p * 9.0)) > 0.9975) col = mix(col, uSky, 0.45);
          }
          // deep in the night, everything a step further down (the water too: it holds the night sky)
          col *= 1.0 - 0.3 * uNight;
          // in a fog, the floor further off goes to mist, in dithered steps
          float far = clamp((uNear - 3.0 - p.y) / 9.0, 0.0, 1.0) * uFog;
          if (far > 0.0) col = mix(col, uMist, floor(far * 3.0 + d) / 3.0 * 0.8);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return { mesh, uniforms };
  }

  /**
   * This tide's floor: whose prints are up, laid out by the tide's own seed, and the silt worn
   * differently under them (it's a different layer). Nothing changes while you're on it.
   */
  private build(tide: number, cast: Cast) {
    if (tide === this.tide && cast === this.cast) return;
    this.tide = tide;
    this.cast = cast;
    for (const m of this.prints.children as THREE.InstancedMesh[]) m.geometry.dispose(), (m.material as THREE.Material).dispose();
    this.prints.clear();
    const rand = mulberry(tide * 31 + CASTS.indexOf(cast));
    this.groundU.uShift.value.set(rand() * 400, rand() * 400);
    // the pool, off to one side or the other, and only some tides a crane by it
    const sideOf = rand() < 0.5 ? -1 : 1;
    this.pool.set(sideOf * (11 + rand() * 6), -13.8 - rand() * 1.4);
    const near = (rand() - 0.5) * 7;
    const onFloor = (p: Print) => p.z < sandZ(p.x) - 0.15 && p.z > seaZ(p.x) + 0.3;
    const wet = footShape(0.26 * BIG, false);
    const adultFoot = footShape(0.26 * BIG);
    const way = wayZ(rand() * 60);
    const people: Print[][] = [];
    let crane = true;
    if (cast === 'two') {
      // the grown one: a steady stride, straight on; the child: running, so longer strides for its
      // size, and now and then a stop, both feet together
      const adult = along(way, SPAN, -SPAN, 0.74, 0.1, rand, 0.03);
      const child: Print[] = [];
      for (const p of along(roundZ(way, rand() * 30), SPAN - 2, -SPAN, 0.82, 0.07, rand, 0.12)) {
        child.push(p);
        if (rand() < 0.035) {
          const h = p.heading + (rand() - 0.5) * 2.4;
          p.heading = h;
          child.push({ x: p.x - Math.cos(h) * 0.14 * p.side, z: p.z + Math.sin(h) * 0.14 * p.side, heading: h, side: -p.side });
        }
      }
      // the deer came after: its line goes through one of the child's prints near where you come in, and it stepped in it
      const met = child.filter(onFloor).reduce((a, b) => (Math.abs(b.x - near) < Math.abs(a.x - near) ? b : a));
      const deer = line(new THREE.Vector2(met.x, met.z), new THREE.Vector2(0.42 * (rand() < 0.5 ? 1 : -1), -1), -12, 30, 0.78, 0.08, rand);
      const into = deer.reduce((a, b) => (Math.hypot(b.x - met.x, b.z - met.z) < Math.hypot(a.x - met.x, a.z - met.z) ? b : a));
      Object.assign(into, { x: met.x + 0.03, z: met.z });
      this.mark.set(met.x, met.z);
      people.push(adult, child);
      this.lay(adult.filter(onFloor), adultFoot, 0.03, wet);
      this.lay(child.filter(onFloor), footShape(0.165 * BIG), 0.03, footShape(0.165 * BIG, false));
      this.lay(deer.filter(onFloor), slotShape(0.12 * BIG), 0.05, null);
    } else if (cast === 'alone') {
      // one grown one, walking east: slowing, stopped a while, both feet turned to the sea, and then on, faster
      const stop = near + (near < 0 ? -2 : 2);
      const stride = (x: number) => (x > stop ? 0.92 : 0.74 - 0.2 * Math.max(0, 1 - (stop - x) / 3));
      const walked = east(along(way, SPAN, -SPAN, stride, 0.1, rand, 0.03)).filter((p) => Math.abs(p.x - stop) > 0.45);
      const at = stood(stop, way(stop), Math.PI, 0.26);
      this.mark.set(stop, way(stop));
      people.push(walked, at);
      this.lay(walked.filter(onFloor), adultFoot, 0.03, wet);
      // (stood on longer, so pressed in deeper, more water in them)
      this.lay(at, adultFoot, 0.03, wet, 0.8);
    } else if (cast === 'dog') {
      // a grown one walking west, and a dog going out wide and coming back, until the grown one
      // crouches, turned to face back east, and it comes straight in
      const crouch = near;
      const walked = along(way, SPAN, -SPAN, 0.74, 0.1, rand, 0.03).filter((p) => Math.abs(p.x - crouch) > 0.4);
      const at = stood(crouch, way(crouch), Math.PI / 2, 0.3);
      const ph = rand() * 20;
      const dogZ = (x: number) => way(x) + Math.min(1, Math.abs(x - crouch) / 5) * (3 * Math.sin((x + ph) * 0.45) + 0.8 * Math.sin((x + ph) * 1.3));
      const dog = along(dogZ, SPAN - 1, -SPAN, 0.5, 0.06, rand, 0.15);
      this.mark.set(crouch, way(crouch));
      people.push(walked, at, dog);
      crane = false;
      this.lay(walked.filter(onFloor), adultFoot, 0.03, wet);
      this.lay(at, adultFoot, 0.03, wet, 0.8);
      this.lay(dog.filter(onFloor), dogShape(0.1 * BIG), 0.04, null);
    } else if (cast === 'many') {
      // seven, going west together: grown ones and three small ones, each in their own lane, so close
      // their prints go over each other
      const sizes = [0.27, 0.25, 0.26, 0.24, 0.17, 0.15, 0.19];
      sizes.forEach((size, i) => {
        const lane = (rand() - 0.5) * 2.6;
        const small = size < 0.2;
        const ph = rand() * 10;
        const z = (x: number) => way(x) + lane + (small ? 0.35 : 0.12) * Math.sin((x + ph) * (small ? 0.9 : 0.4));
        const walked = along(z, SPAN - rand() * 2, -SPAN, size * 2.8, size * 0.38, rand, small ? 0.1 : 0.04);
        people.push(walked);
        this.lay(walked.filter(onFloor), footShape(size * BIG), 0.03 + i * 0.002, footShape(size * BIG, false));
      });
      this.mark.set(1e4, 1e4);
    } else {
      // aurochs, five, walking north toward where the sea is now; and after them a person, the same way,
      // a little to one side, who stepped in one of their prints
      const dir = new THREE.Vector2(-0.35 * (rand() < 0.5 ? 1 : -1), -1);
      const across = new THREE.Vector2(-dir.y, dir.x).normalize();
      const herd: Print[] = [];
      for (let i = 0; i < 5; i++) {
        const at = new THREE.Vector2(near, 1).addScaledVector(across, (i - 2) * 1.5 + (rand() - 0.5) * 0.9);
        herd.push(...line(at, dir, -8, 30, 0.85 + rand() * 0.1, 0.22, rand));
      }
      const onIt = herd.filter((p) => onFloor(p) && p.z < -3 && p.z > -9 && Math.abs(p.x - near) < 2.5);
      const step = onIt.length ? onIt[Math.floor(rand() * onIt.length)] : herd[0];
      const person = line(new THREE.Vector2(step.x, step.z).addScaledVector(across, 0.1), dir, -14, 30, 0.74, 0.1, rand);
      const into = person.reduce((a, b) => (Math.hypot(b.x - step.x, b.z - step.z) < Math.hypot(a.x - step.x, a.z - step.z) ? b : a));
      Object.assign(into, { x: step.x + 0.04, z: step.z });
      this.mark.set(step.x, step.z);
      people.push(herd, person);
      crane = false;
      this.lay(herd.filter(onFloor), hoofShape(0.16 * BIG), 0.03, null);
      this.lay(person.filter(onFloor), adultFoot, 0.05, wet);
    }
    this.people = people.flat().filter(onFloor);
    this.crane = [];
    if (crane) {
      // the crane, feeding round its pool: a step, a stop, a step, turning this way and that
      const pool = this.pool;
      let at = pool.clone().add(new THREE.Vector2(-sideOf * (POOL_R + 1.2), 1.5));
      let h = 0.4;
      for (let i = 0; i < 46; i++) {
        h += (rand() - 0.5) * 1.3;
        // (round the pool's edge, not into it)
        const off = at.clone().sub(pool);
        const r = off.length();
        const round = Math.atan2(off.x, off.y) + Math.PI / 2;
        h += Math.atan2(Math.sin(round - h), Math.cos(round - h)) * 0.35 + (r < POOL_R + 0.6 ? 0.5 : r > POOL_R + 2.5 ? -0.5 : 0);
        at = at.add(new THREE.Vector2(Math.sin(h), Math.cos(h)).multiplyScalar(0.36 * BIG));
        this.crane.push({ x: at.x, z: at.y, heading: h, side: i % 2 ? 1 : -1 });
      }
      this.crane = this.crane.filter(onFloor);
      this.lay(this.crane, craneShape(0.2 * BIG), 0.03, null);
    }
  }

  /** A kind of print, all of them at once: the hollow, and the water standing in it, a little in from its east wall. */
  private lay(prints: Print[], shapes: THREE.Shape[], y: number, wet: THREE.Shape[] | null, deep = 0.55) {
    // (each a little proud of the floor, or the depth buffer can't tell them apart from it)
    const layers: [THREE.BufferGeometry, THREE.Color, number][] = [[flat(shapes), HOLLOW, y]];
    if (wet) layers.push([flat(wet, deep, -0.02), SKY, y + 0.01]);
    for (const [geo, color, lift] of layers) {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }), prints.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      prints.forEach((p, i) => {
        // (its length along the way it was going, its big toe on the inside: a left foot's the right one mirrored)
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.heading - Math.PI / 2);
        s.set(1, 1, -p.side);
        mesh.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, lift, p.z), q, s));
      });
      mesh.frustumCulled = false;
      this.prints.add(mesh);
    }
  }

  /** Come down onto the floor from the flat, on this tide's floor (or the one `asked` for): over the sand's edge, a few steps on. */
  arrive(when: Date, asked?: string | null) {
    const tide = tideOf(when);
    this.build(tide, CASTS.find((c) => c === asked) ?? castFor(tide));
    this.leaving = false;
    this.walked = 0;
    this.stillFor = 0;
    this.metThem = false;
    this.keys.clear();
    this.pan.set(0, 0);
    this.pos.set(0, 0, sandZ(0) + 0.6);
    this.arrivedAt.set(0, sandZ(0) - 1.6);
    this.heading = Math.PI;
    this.speed = PACE;
    this.goal = new THREE.Vector3(0, 0, sandZ(0) - 1.6);
    this.frame(0);
  }

  key(code: string, down: boolean) {
    const k = KEYS[code];
    if (!k) return false;
    if (down) this.keys.add(k), (this.goal = null);
    else this.keys.delete(k);
    return true;
  }

  releaseKeys() {
    this.keys.clear();
  }

  /** What's under the pointer: the sand, which is the way back. */
  pick(ndc: THREE.Vector2): 'back' | null {
    const p = this.onGround(ndc);
    return p && p.z > sandZ(p.x) ? 'back' : null;
  }

  private onGround(ndc: THREE.Vector2) {
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p.setY(0) : null;
  }

  /** A click: walk there (the sea stops you at its edge; the sand takes you back up). */
  click(ndc: THREE.Vector2) {
    const p = this.onGround(ndc);
    if (!p) return;
    if (p.z > sandZ(p.x)) p.z = sandZ(p.x) + 2;
    this.goal = p;
  }

  zoom(factor: number) {
    this.zoomed = THREE.MathUtils.clamp(this.zoomed * factor, 0.6, 1.5);
  }

  drag(dx: number, dy: number, height: number) {
    const per = this.seen / height;
    this.pan.x = THREE.MathUtils.clamp(this.pan.x - dx * per, -10, 10);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y - (dy * per) / Math.sin(ELEVATION), -10, 10);
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
    // (a phone gets a little more of the floor, so the trail's in it)
    this.view = Math.max(11, Math.min(14, 9 / this.aspect + 7));
  }

  update(dt: number) {
    this.time += dt;
    this.groundU.uTime.value = this.time;
    this.light();
    this.walk(dt);
    this.animate();
    this.listen(dt);
    const at = new THREE.Vector2(this.pos.x, this.pos.z);
    const near = (list: Print[]) => list.reduce((m, p) => Math.min(m, Math.hypot(p.x - at.x, p.z - at.y)), Infinity);
    const people = near(this.people);
    const back = this.pos.z > sandZ(this.pos.x) - 1.2 && this.walked > 5;
    // as you come on, the floor's (whoever's prints are by you); at the sand's edge, the way back; at
    // the mark and by the crane's, theirs; by the walkers', theirs, and stood still a while once you've read it, the rest
    const arriving = at.distanceTo(this.arrivedAt) < 3.5;
    this.card =
      back ? 'back'
      : this.metThem && this.stillFor > STILL ? 'known'
      : at.distanceTo(this.mark) < 2 ? 'mark'
      : arriving && this.walked < 4 ? 'floor'
      : people < 2.4 ? 'who'
      : this.crane.length && at.distanceTo(this.pool) < POOL_R + 3.2 ? 'crane'
      : arriving || this.stillFor > STILL ? 'floor'
      : null;
    if (this.card === 'who') this.metThem = true;
    if (this.pos.z > sandZ(this.pos.x) + 1.2) this.leaving = true;
    this.frame(dt);
  }

  /**
   * The island's moment, as the flat has it: deep in the night the light goes a step down and the
   * warm edges go with it; rain dims it and rings what water's standing; a fog takes the far floor.
   */
  private light() {
    const { night, fog } = this.moment;
    const gloom = Math.min(1, this.weather.rain * 0.9);
    this.hemi.intensity = 1.3 * (1 - gloom * 0.25) * (1 - night * 0.3);
    this.sun.intensity = 2.2 * (1 - gloom * 0.6) * (1 - fog * 0.5) * (1 - night * 0.6);
    this.groundU.uLit.value.copy(this.lit).lerp(CLAY[0], Math.max(night * 0.8, gloom * 0.6, fog * 0.5));
    this.groundU.uRain.value = this.weather.rain;
    this.groundU.uNight.value = night;
    this.groundU.uFog.value = fog;
    this.groundU.uNear.value = this.pos.z;
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
      if (d <= 0.08) this.goal = null;
      else (move.set(dx / d, dz / d), (want = PACE * Math.min(1, d / 0.4 + 0.3)));
    }
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * 8));
    if (this.speed < 0.02 && !want) {
      this.speed = 0;
      this.stillFor += dt;
      return;
    }
    this.stillFor = 0;
    if (move.lengthSq()) {
      let turn = Math.atan2(move.x, move.y) - this.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      this.heading += turn * (1 - Math.exp(-dt * 10));
    }
    const step = this.speed * dt;
    const x = THREE.MathUtils.clamp(this.pos.x + Math.sin(this.heading) * step, -SPAN, SPAN);
    // (into the sea only to your boots' depth: it's deep past the wash)
    const z = Math.max(seaZ(x) + 0.2, this.pos.z + Math.cos(this.heading) * step);
    // (stopped at the edge only if it's the sea you were walking to, not when you're turning away from it)
    if (z <= seaZ(x) + 0.21 && this.goal && this.goal.z < seaZ(this.goal.x) + 0.21) this.goal = null;
    this.pos.x = x;
    this.pos.z = Math.min(z, sandZ(x) + 2);
    this.walked += step;
    if (this.pan.lengthSq()) this.pan.multiplyScalar(Math.exp(-dt * 1.5));
    this.stride += step;
    if (this.stride - this.lastStep > 0.72) {
      this.lastStep = this.stride;
      this.onStep?.(this.pos.z > sandZ(this.pos.x) ? 'sand' : this.pos.z < this.washZ(this.pos.x) + 0.4 ? 'wash' : 'clay');
    }
  }

  /** How far the wash has come in over the floor at `x`, now (as the ground's shader draws it). */
  private washZ(x: number) {
    return seaZ(x) + 0.35 * Math.sin(this.time * 0.5 + x * 0.15);
  }

  /**
   * What you hear down here: the sea in front, louder the nearer its edge and as its wash comes in
   * (from the side it's nearer); now and then water ticking in one of the prints by you, more
   * often the more of them there are; and a curlew, far off.
   */
  private listen(dt: number) {
    const x = this.pos.x;
    const off = Math.max(0, this.pos.z - this.washZ(x));
    const coming = 0.5 + 0.5 * Math.sin(this.time * 0.5 + x * 0.15);
    const lean = THREE.MathUtils.clamp((seaZ(x + 6) - seaZ(x - 6)) / 4, -0.5, 0.5);
    this.onSea?.((0.6 + 0.4 * coming) / (1 + (off / 9) ** 2), lean / (1 + off / 6));
    this.curlew.update(dt, new THREE.Vector2(x, this.pos.z), this.weather, (near, pan) => this.onCurlew?.(near * 0.6, pan) ?? false);
    this.tickIn -= dt;
    if (this.tickIn > 0) return;
    const by = [...this.people, ...this.crane].filter((p) => Math.abs(p.x - x) < 6 && Math.abs(p.z - this.pos.z) < 6);
    this.tickIn = 0.4 + Math.random() * (by.length ? 14 / Math.min(by.length, 20) : 3);
    // (the nearer of two, so it's mostly the prints round your feet)
    const [a, b] = [0, 1].map(() => by[Math.floor(Math.random() * by.length)]);
    if (!a) return;
    const p = Math.hypot(a.x - x, a.z - this.pos.z) < Math.hypot(b.x - x, b.z - this.pos.z) ? a : b;
    const d = Math.hypot(p.x - x, p.z - this.pos.z);
    this.onTick?.(1 / (1 + (d / 2.5) ** 2), THREE.MathUtils.clamp((p.x - x) / 5, -0.8, 0.8));
  }

  private animate() {
    const w = this.you;
    // (up on the sand you're a hand's breadth higher than on the clay)
    const up = this.pos.z > sandZ(this.pos.x) ? 0.1 : 0;
    w.root.position.set(this.pos.x, up, this.pos.z);
    w.root.rotation.set(0, this.heading, 0);
    const swing = Math.sin(this.stride * 7.4) * Math.min(1, this.speed / PACE) * 0.5;
    w.legs[0].rotation.x = swing;
    w.legs[1].rotation.x = -swing;
    w.arms[0].rotation.x = -swing * 0.8;
    w.arms[1].rotation.x = swing * 0.8;
    w.scarfTail.rotation.x = 0.2 + this.speed * 0.15 + Math.sin(this.time * 1.7) * 0.05;
  }

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
    // (you a little below the middle, more floor in front of you than behind)
    const lead = (view * 0.12) / Math.sin(ELEVATION);
    const want = new THREE.Vector3(this.pos.x + this.pan.x, 0, this.pos.z - lead + this.pan.y);
    if (dt) this.target.lerp(want, 1 - Math.exp(-dt * 2.2));
    else this.target.copy(want);
    cam.position.set(this.target.x, Math.sin(ELEVATION) * DISTANCE, this.target.z + Math.cos(ELEVATION) * DISTANCE);
    cam.lookAt(this.target);
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
    // the floor goes on under wherever you look
    this.ground.position.set(this.target.x, 0, this.target.z);
    this.ground.scale.set(view * this.aspect * 2 + 20, 1, view * 3 + 20);
  }
}
