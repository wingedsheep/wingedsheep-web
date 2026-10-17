/**
 * The old floor: follow the prints east off the scour and you come out where the sea has taken
 * all the sand off, down to a floor of grey silt laid down seven thousand years ago, when this was
 * marsh at the edge of the land. Its mud was soft then, and people and animals walked on it; the
 * sea came up over it and laid sand on top, and now a storm's taken the sand off again. Two people
 * barefoot, a grown one walking west and a child running rings round them; a red deer that came by
 * after them and stepped in one of the child's prints; a crane feeding by a pool. Your boots leave
 * nothing: it set too long ago. The flat is about my tide; this is about how I know anyone at all.
 *
 * Its own scene and camera, drawn through the island's PixelRenderer like the page, looking north
 * but steeper and nearer, down at your feet, because here what there is to see is on the ground.
 * The sand's edge is behind you (south), and the sea in front (north). Walk back south up onto the
 * sand for the flat.
 */
import * as THREE from 'three';
import { toon } from '../scene/toon';
import { makeFigure, type Figure } from './figure';

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

/** The grown one's way: in from the east, out to the west, not hurrying and not stopping. */
function adultZ(x: number) {
  return -7 + 1.2 * Math.sin(x * 0.05) + 0.4 * Math.sin(x * 0.17 + 0.5);
}
/** The child's, round it: out to the side and back, out and back, ahead and behind. */
function childZ(x: number) {
  return adultZ(x) + 2.6 * Math.sin(x * 0.38 + 0.6 * Math.sin(x * 0.11)) + 0.5 * Math.sin(x * 1.1);
}
/** Where the crane fed, by a pool. */
const CRANE = new THREE.Vector2(-15, -14.5);
const POOL_R = 2.4;

const CLAY = ['#4d4f66', '#45465e', '#3c3d55'].map((c) => new THREE.Color(c));
export const HOLLOW = new THREE.Color('#29283d');
/** What a print's water gives back: the sky. */
export const SKY = new THREE.Color('#8a8fb7');
const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

export type FloorCard = 'floor' | 'two' | 'deer' | 'crane' | 'known' | 'back';

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

export function flat(shapes: THREE.Shape[], scale = 1, shift = 0) {
  const g = new THREE.ShapeGeometry(shapes, 6);
  g.scale(scale, scale, 1);
  g.translate(shift, 0, 0);
  // (lying on the ground, its length along x, its left along -z)
  return g.rotateX(-Math.PI / 2);
}

/** A seeded rand, so the floor is the same floor every visit (for now). */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Prints along a way (z by x), going west from `from` to `to`, a step every `stride` metres along it. */
function along(way: (x: number) => number, from: number, to: number, stride: number, wide: number, rand: () => number, jitter = 0.05) {
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
    if (carry >= stride * (1 + (rand() - 0.5) * jitter * 2)) {
      carry = 0;
      side = -side;
      out.push({ x: x + Math.cos(heading) * wide * side, z: z - Math.sin(heading) * wide * side, heading: heading + (rand() - 0.5) * 0.16, side });
    }
    x += dx;
  }
  return out;
}

export class Floor {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  card: FloorCard | null = null;
  /** Walked back up onto the sand: time for the flat again. */
  leaving = false;
  /** Each step, for the sound. */
  onStep?: () => void;
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
  private deer: Print[] = [];
  private crane: Print[] = [];
  /** Read the two people's card, so standing still can say the rest. */
  private metThem = false;
  /** Where the deer stepped in the child's print. */
  private met = new THREE.Vector2();
  private arrivedAt = new THREE.Vector2();

  constructor(private texels: () => number) {
    this.scene.background = CLAY[2].clone();
    // the warm band's light, low from the west; the sky's blue on the rest
    this.scene.add(new THREE.HemisphereLight('#8f95c8', '#3e3655', 1.3), this.camera);
    const sun = new THREE.DirectionalLight('#ffbf92', 2.2);
    sun.position.set(-40, 14, 10);
    this.scene.add(sun, sun.target);
    const skin = toon(new THREE.Color('#3a3348'), { own: true, bare: true });
    this.you = makeFigure({ coat: toon(new THREE.Color('#353352'), { own: true, bare: true }), boots: toon(new THREE.Color('#1b1a2a'), { own: true, bare: true }), scarf: toon(new THREE.Color('#efe2c6'), { own: true, bare: true }), skin });
    this.scene.add(this.you.root);
    const ground = this.makeGround();
    this.ground = ground.mesh;
    this.groundU = ground.uniforms;
    this.makePrints();
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
      uLit: { value: new THREE.Color('#6d5f72') },
      uDark: { value: new THREE.Color('#2e2d43') },
      uSand: { value: new THREE.Color('#686274') },
      uSandLit: { value: new THREE.Color('#757080') },
      uWater: { value: new THREE.Color('#4a5288') },
      uSky: { value: SKY },
      uWash: { value: new THREE.Color('#a9adc6') },
      uCrane: { value: CRANE },
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
        uniform vec2 uCrane;
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
          float n = noise(p * 0.09) * 0.6 + noise(p * 0.23 + 7.0) * 0.28 + noise(p * 0.7 + 3.0) * 0.12;
          // (and by the crane's pool, down to where the water stands)
          return n + 0.5 * max(0.0, 1.0 - length(p - uCrane) / ${(POOL_R * 1.6).toFixed(2)});
        }
        float sandZ(float x) { return 4.0 + 0.8 * sin(x * 0.21) + 0.4 * sin(x * 0.57 + 1.0); }
        float seaZ(float x) { return -24.0 + 1.5 * sin(x * 0.13 + 2.0) + 0.6 * sin(x * 0.41); }
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
            if (pool < 0.0) col = pool < -0.2 || d < 0.5 ? mix(uSky, uWater, 0.35) : uDark;
            else if (w > 0.84) col = (w > 0.87 || d < 0.5) ? mix(uSky, uClay2, 0.25) : uClay2;
            // and it's all wet: a speck of sky here and there
            else if (hash(floor(p * 9.0)) > 0.9975) col = mix(col, uSky, 0.45);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return { mesh, uniforms };
  }

  /** Every print on the floor: theirs, the deer's and the crane's, each dark, the deeper ones with water in. */
  private makePrints() {
    const rand = mulberry(7000);
    // the grown one: a steady stride, straight on
    const adult = along(adultZ, SPAN, -SPAN, 0.74, 0.1, rand, 0.03);
    // the child: running, so longer strides for its size, and now and then a stop, both feet together
    const child: Print[] = [];
    for (const p of along(childZ, SPAN - 2, -SPAN, 0.82, 0.07, rand, 0.12)) {
      child.push(p);
      if (rand() < 0.035) {
        const h = p.heading + (rand() - 0.5) * 2.4;
        p.heading = h;
        child.push({ x: p.x - Math.cos(h) * 0.14 * p.side, z: p.z + Math.sin(h) * 0.14 * p.side, heading: h, side: -p.side });
      }
    }
    // the deer came after: its line goes through one of the child's prints near where you come in, and it stepped in it
    const met = child.reduce((a, b) => (Math.abs(b.x - 1.5) < Math.abs(a.x - 1.5) ? b : a));
    const dir = new THREE.Vector2(0.42, -1).normalize();
    for (let k = -12; k <= 30; k++) {
      const x = met.x + dir.x * k * 0.78;
      const z = met.z + dir.y * k * 0.78;
      if (z > sandZ(x) - 0.2 || z < seaZ(x) + 0.4) continue;
      const side = k % 2 ? 1 : -1;
      this.deer.push({ x: x + dir.y * 0.08 * side, z: z - dir.x * 0.08 * side, heading: Math.atan2(dir.x, dir.y), side });
    }
    // (the one in the child's print, right in it)
    const into = this.deer.find((d) => Math.hypot(d.x - met.x, d.z - met.z) < 0.2);
    if (into) Object.assign(into, { x: met.x + 0.03, z: met.z });
    this.met.set(met.x, met.z);
    // the crane, feeding round its pool: a step, a stop, a step, turning this way and that
    let at = CRANE.clone().add(new THREE.Vector2(-POOL_R - 1.2, 1.5));
    let h = 0.4;
    for (let i = 0; i < 46; i++) {
      h += (rand() - 0.5) * 1.3;
      // (round the pool's edge, not into it)
      const off = at.clone().sub(CRANE);
      const r = off.length();
      const round = Math.atan2(off.x, off.y) + Math.PI / 2;
      h += (Math.atan2(Math.sin(round - h), Math.cos(round - h))) * 0.35 + (r < POOL_R + 0.6 ? 0.5 : r > POOL_R + 2.5 ? -0.5 : 0);
      at = at.add(new THREE.Vector2(Math.sin(h), Math.cos(h)).multiplyScalar(0.36 * BIG));
      this.crane.push({ x: at.x, z: at.y, heading: h, side: i % 2 ? 1 : -1 });
    }
    // (each a little proud of the floor, or the depth buffer can't tell them apart from it)
    // under the sand to the south and the sea to the north, none
    const onFloor = (p: Print) => p.z < sandZ(p.x) - 0.15 && p.z > seaZ(p.x) + 0.3;
    this.people = [...adult, ...child].filter(onFloor);
    this.crane = this.crane.filter(onFloor);
    this.lay(adult.filter(onFloor), footShape(0.26 * BIG), 0.03, footShape(0.26 * BIG, false));
    this.lay(child.filter(onFloor), footShape(0.165 * BIG), 0.03, footShape(0.165 * BIG, false));
    this.lay(this.deer, slotShape(0.12 * BIG), 0.05, null);
    this.lay(this.crane, craneShape(0.2 * BIG), 0.03, null);
  }

  /** A kind of print, all of them at once: the hollow, and the water standing in it, a little in from its east wall. */
  private lay(prints: Print[], shapes: THREE.Shape[], y: number, wet: THREE.Shape[] | null) {
    const layers: [THREE.BufferGeometry, THREE.Color, number][] = [[flat(shapes), HOLLOW, y]];
    if (wet) layers.push([flat(wet, 0.55, -0.02), SKY, y + 0.01]);
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
      this.scene.add(mesh);
    }
  }

  /** Come down onto the floor from the flat: over the sand's edge, a few steps on. */
  arrive() {
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
    this.walk(dt);
    this.animate();
    const at = new THREE.Vector2(this.pos.x, this.pos.z);
    const near = (list: Print[]) => list.reduce((m, p) => Math.min(m, Math.hypot(p.x - at.x, p.z - at.y)), Infinity);
    const people = near(this.people);
    const back = this.pos.z > sandZ(this.pos.x) - 1.2 && this.walked > 5;
    // as you come on, the floor's; at the sand's edge, the way back; by the deer's and the crane's,
    // theirs; by the two people's, theirs, and stood still a while once you've read it, the rest
    this.card =
      back ? 'back'
      : this.metThem && this.stillFor > STILL ? 'known'
      : at.distanceTo(this.met) < 1.4 ? 'deer'
      : people < 2.4 ? 'two'
      : at.distanceTo(CRANE) < POOL_R + 3.2 ? 'crane'
      : at.distanceTo(this.arrivedAt) < 3.5 || this.stillFor > STILL ? 'floor'
      : null;
    if (this.card === 'two') this.metThem = true;
    if (this.pos.z > sandZ(this.pos.x) + 1.2) this.leaving = true;
    this.frame(dt);
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
    if (z <= seaZ(x) + 0.21 && this.goal) this.goal = null;
    this.pos.x = x;
    this.pos.z = Math.min(z, sandZ(x) + 2);
    this.walked += step;
    if (this.pan.lengthSq()) this.pan.multiplyScalar(Math.exp(-dt * 1.5));
    this.stride += step;
    if (this.stride - this.lastStep > 0.72) {
      this.lastStep = this.stride;
      this.onStep?.();
    }
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
