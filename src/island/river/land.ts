import * as THREE from 'three';
import { createFoliage } from '../scene/foliage';
import { createGrass } from '../scene/grass';
import type { CanopyMarker } from '../scene/island';
import { leavesAt, season } from '../scene/season';
import { toon } from '../scene/toon';
import type { RiverAssets } from './assets';
import { type Course, type Obstacle, type Sample, type Split, rng } from './course';
import type { Look } from './rivers';
import { waterRibbon } from './water';

export const CHUNK = 32; // metres of river per chunk of water and furniture
const TILE = 24; // metres per side of a tile of ground
const RES = 1; // metres between the ground's vertices

const C = (hex: string) => new THREE.Color(hex);
const MOSS = ['#3a7a3a', '#467f3c', '#4f8a40', '#5f9a48', '#6fa84e'].map(C);
const FOREST_FLOOR = ['#2a5436', '#33603a', '#3f6e3c', '#5a6436'].map(C);
const SAND = ['#dcbd83', '#ecd29d', '#cfae74'].map(C);
const WET = C('#a88457');
const PEBBLES = ['#8c7f86', '#7d7483', '#a09aa2'].map(C);
const CLIFF = ['#6a5d6e', '#827485', '#9a8d9c', '#5d5063'].map(C);
const BED = C('#6a5a44');
const SNOW = C('#e9f0f7');
/** Beike's tennis balls: bigger than life and fluorescent yellow, so you can spot one from upstream. */
const BALL = C('#d8f03a');
const BALL_SIZE = 1.6;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash2(x: number, z: number) {
  const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
function noise2(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
/** Smooth noise along the river (0..1), a new wave every `every` metres or so. */
const along = (s: number, seed: number, every: number) => noise2(s / every, seed * 0.013 % 97);

/**
 * 0..1: how high up in the mountains the river is at arc length s. On a river that climbs at
 * all, a stretch here and there where the valley's sides rise to bare rock and snow; and the
 * harder the river, the higher it runs all the way down (Hold My Coffee never leaves the peaks).
 */
export function highAt(look: Look, seed: number, s: number) {
  if (look.alpine <= 0) return 0;
  const base = look.alpine * look.alpine * 0.6;
  return look.alpine * (base + (1 - base) * smooth(0.62, 0.8, along(s, seed + 3, 300)));
}

/** 0..1: how thick the fog is at s: banks of it lying in the valley here and there, thinning between. */
export function fogAt(look: Look, seed: number, s: number) {
  return look.mood.mist * smooth(0.7, 0.86, along(s, seed + 11, 200));
}

const fbm = (x: number, z: number) => noise2(x * 0.045, z * 0.045) * 0.65 + noise2(x * 0.13, z * 0.13) * 0.35;

/** Let go of a tile of ground and its grass. */
function dropTile(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  for (const grass of mesh.children as THREE.InstancedMesh[]) {
    grass.geometry.dispose();
    (grass.material as THREE.Material).dispose();
    grass.dispose();
  }
}

/** …and of a chunk's water and leaves (every chunk grows its own). */
function dropChunk(chunk: Chunk) {
  chunk.water.geometry.dispose();
  for (const m of chunk.springs) m.geometry.dispose();
  // (the batches share their geometry and materials with the templates: only the instances go)
  for (const b of chunk.batches) b.dispose();
  for (const g of chunk.glows) g.material.dispose();
  if (!chunk.foliage) return;
  const mat = chunk.foliage.material as THREE.MeshToonMaterial;
  mat.map?.dispose();
  mat.dispose();
  chunk.foliage.geometry.dispose();
  chunk.foliage.dispose();
}

/** One bit of the riverside that stands somewhere: an animal's spot, a tree, a heron's pool. */
export interface Spot {
  kind: 'heron' | 'ducks' | 'deer' | 'sheep' | 'fish' | 'swans';
  x: number;
  y: number;
  z: number;
  /** Which way is downstream there. */
  a: number;
  s: number;
  side: number;
}

/**
 * A light by the river (see Land.glowAt): its colour, how far it reaches (m), how bright, how
 * much it flickers (0 steady … 1 a fire), and its halo's size. A far one (a window across the
 * valley) is only a spark to see, too far off to light anything.
 */
export interface Lamp {
  color: string;
  radius: number;
  intensity: number;
  flicker: number;
  size: number;
  seed: number;
  far?: boolean;
  /** How faint its halo is (1, or less for a glow on the forest floor). */
  dim?: number;
  /** How high it hangs over the river's water (m), for its reflection. */
  over?: number;
  /** Somebody's out here after dark: their fire on the bank, or their lantern by a fishing line. */
  camp?: 'fire' | 'angler';
}

/** How bright a light is right now (1, or less as it flickers): a fire's dance, a lantern's waver. */
export function flicker(l: Pick<Lamp, 'flicker' | 'seed'>, time: number) {
  if (!l.flicker) return 1;
  return 1 - l.flicker * 0.25 * (Math.sin(time * 13 + l.seed) * 0.5 + Math.sin(time * 7.7 + l.seed * 3) * 0.5 + 0.5);
}

const WINDOW = ['#ffc46b', '#ffd88a', '#ffb35a'];
/** Foxfire: the cold green-blue glow of the fungus in rotting wood. */
const FOXFIRE = ['#9cffc8', '#7fe8e0', '#b4ff9a'];

/**
 * One seed out of several numbers, well mixed (a river's seed times a big prime runs past what a
 * double holds exactly, and every chunk would draw the same).
 */
function mix(...ns: number[]) {
  let h = 0x811c9dc5;
  for (const n of ns) {
    h = Math.imul(h ^ (n >>> 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** How far a boulder on the bank may reach out into the river (m, from the edge of the water to its collision edge). */
const REACH = 1;

interface Chunk {
  index: number;
  group: THREE.Group;
  water: THREE.Mesh;
  /** The things in it you can hit or pick up, and their meshes. */
  things: Map<object, THREE.Object3D>;
  /** The lights' halos (a lantern, a window, a fire; see Land.glowAt), and the fires' flames. */
  glows: THREE.Sprite[];
  flames: THREE.Object3D[];
  /** Where the fires' sparks go up from. */
  embers: THREE.Vector3[];
  spots: Spot[];
  /** Where its trees' leaves go, and the leaf cards grown there (as on the island). */
  canopies: CanopyMarker[];
  foliage?: THREE.InstancedMesh;
  /** Its scenery, folded into one instanced mesh per part (see Land.batch). */
  batches: THREE.InstancedMesh[];
  /** The side streams spilling down its walls: their ribbons, and where each lands in the river. */
  springs: THREE.Mesh[];
  feet: THREE.Vector3[];
  /** A rainbow in the mist under a waterfall. */
  rainbows: THREE.Sprite[];
  /** The cottages' chimneys, for their smoke; and banks of mist lying on the water. */
  chimneys: THREE.Vector3[];
  mists: THREE.Sprite[];
  /** Ground kept clear round a cottage or a picnic, for the trees to stay off. */
  clearings: { x: number; z: number; r: number }[];
  /** What it added to the course to be run into (a jetty's end, a bridge's trestles, its boulders), taken out again with it. */
  solids: Obstacle[];
}

/**
 * The land either side of the river, and the furniture. The ground is a heightfield on a world
 * grid of tiles, shaped by how far each point is from the river (so bends never fold it over
 * itself): a mossy bank, a pebbly beach or a gorge wall, with the valley climbing away behind, as the river's
 * character changes. The water and everything in or beside it come in chunks along the river.
 */
export class Land {
  readonly group = new THREE.Group();
  private tiles = new Map<string, THREE.Mesh>();
  private chunks = new Map<number, Chunk>();
  private ground = toon(new THREE.Color(1, 1, 1), { vertexColors: true });
  private crowns: THREE.Material[] | null;
  private halo: THREE.Texture;
  /** What every ball shares: a soft glow round it, and a ring spreading out on the water under it. */
  private ballGlow: THREE.SpriteMaterial;
  private ballRing = new THREE.MeshBasicMaterial({ color: C('#f4ffd0'), transparent: true, depthWrite: false, fog: false });
  private ringShape = new THREE.RingGeometry(0.62, 0.78, 20).rotateX(-Math.PI / 2);
  /** The side streams' pouring water (in time with the river's), and the rainbows' arcs. */
  private spring: THREE.ShaderMaterial;
  private rainbow = new THREE.SpriteMaterial({ map: rainbowTexture(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  /** Mist lying on the water of the darker rivers. */
  private mist: THREE.SpriteMaterial;
  /** What this river looks like (rivers.ts). */
  private look: Look;
  /** Every chunk's animal spots, for the wildlife to take up. */
  onSpots?: (spots: Spot[]) => void;
  onDrop?: (chunk: number) => void;

  constructor(
    private course: Course,
    private assets: RiverAssets,
    private water: THREE.Material,
    halo: THREE.Texture,
  ) {
    this.halo = halo;
    this.crowns = crownMaterials();
    this.look = course.profile.look;
    this.spring = springMaterial((water as THREE.ShaderMaterial).uniforms);
    this.ballGlow = new THREE.SpriteMaterial({ map: halo, color: C('#eaff7a'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    this.mist = new THREE.SpriteMaterial({ map: halo, color: C('#dfe8ea'), depthWrite: false, transparent: true, opacity: 0.3 });
  }

  /**
   * The balls' beacon, all of them in time: the glow breathing, and every second and a half a ring
   * spreading out from each. Returns how big the rings are now.
   */
  beacon(time: number) {
    this.ballGlow.opacity = 0.45 + Math.sin(time * 4) * 0.15;
    const t = (time / 1.5) % 1;
    this.ballRing.opacity = 0.75 * (1 - t) * Math.min(1, t * 6);
    return 0.7 + t * 1.3;
  }

  /**
   * Make sure the ground covers the view and the chunks run from `from` to `to` (arc length),
   * building at most `budget` tiles and chunks between them: each takes a good few milliseconds,
   * so one a frame keeps the frame rate steady (there's margin enough round the view for that).
   */
  update(centre: THREE.Vector3, radius: number, from: number, to: number, budget = 1) {
    let built = 0;
    // chunks first: they hold what you can hit
    const c0 = Math.max(0, Math.floor(from / CHUNK));
    const c1 = Math.floor(to / CHUNK);
    for (let c = c0; c <= c1 && built < budget; c++) {
      if (this.chunks.has(c)) continue;
      this.chunk(c);
      built++;
    }
    for (const [c, chunk] of this.chunks) {
      if (c >= c0 && c <= c1) continue;
      dropChunk(chunk);
      for (const o of chunk.solids) this.course.removeObstacle(o);
      chunk.group.removeFromParent();
      this.chunks.delete(c);
      this.onDrop?.(c);
    }

    // tiles, the nearest first
    const want = new Set<string>();
    const t0x = Math.floor((centre.x - radius) / TILE);
    const t1x = Math.floor((centre.x + radius) / TILE);
    const t0z = Math.floor((centre.z - radius) / TILE);
    const t1z = Math.floor((centre.z + radius) / TILE);
    const missing: { tx: number; tz: number; k: string; d: number }[] = [];
    for (let tx = t0x; tx <= t1x; tx++) {
      for (let tz = t0z; tz <= t1z; tz++) {
        const cx = (tx + 0.5) * TILE - centre.x;
        const cz = (tz + 0.5) * TILE - centre.z;
        const d = Math.hypot(cx, cz);
        if (d > radius + TILE * 0.71) continue;
        const k = `${tx},${tz}`;
        want.add(k);
        if (!this.tiles.has(k)) missing.push({ tx, tz, k, d });
      }
    }
    missing.sort((a, b) => a.d - b.d);
    for (const { tx, tz, k } of missing) {
      if (built >= budget) break;
      const mesh = this.tile(tx, tz);
      this.tiles.set(k, mesh);
      this.group.add(mesh);
      built++;
    }
    for (const [k, mesh] of this.tiles) {
      if (want.has(k)) continue;
      dropTile(mesh);
      mesh.removeFromParent();
      this.tiles.delete(k);
    }
  }

  /** Where the side streams in view land in the river, for their spray. */
  *feet() {
    for (const chunk of this.chunks.values()) yield* chunk.feet;
  }

  /** The chimneys in view, for their smoke. */
  *chimneys() {
    for (const chunk of this.chunks.values()) yield* chunk.chimneys;
  }

  /** The mesh standing for a rock, log or ball, if its chunk is built. */
  meshOf(thing: object) {
    for (const chunk of this.chunks.values()) {
      const m = chunk.things.get(thing);
      if (m) return m;
    }
    return undefined;
  }

  /**
   * How dark it is (0 by day … 1 at night), and how far the lanterns, windows and fires are lit
   * (0 … 1): the fires flicker, the lanterns barely, and a fire's only a ring of cold ash by day.
   */
  glow(night: number, lit: number, time: number, sunny = 1) {
    this.rainbow.opacity = (1 - night) * sunny * (0.4 + Math.sin(time * 0.7) * 0.08);
    this.mist.opacity = (0.26 + Math.sin(time * 0.4) * 0.05) * (1 - night * 0.6);
    for (const chunk of this.chunks.values()) {
      for (const m of chunk.mists) m.position.x = m.userData.x + Math.sin(time * 0.15 + m.id) * 2;
      for (const g of chunk.glows) {
        const l = g.userData as Lamp;
        const f = flicker(l, time);
        g.material.opacity = Math.min(1, lit * f * (l.dim ?? 1));
        g.scale.setScalar(l.size * (0.92 + f * 0.08));
        g.visible = lit > 0.03;
      }
      for (const f of chunk.flames) {
        f.visible = lit > 0.05;
        if (!f.visible) continue;
        const k = flicker(f.userData as Lamp, time * 1.3);
        f.scale.set(1 - (1 - k) * 0.3, 1 - (1 - k) * 0.3, (0.5 + lit * 0.5) * (0.75 + k * 0.35));
      }
    }
  }

  /** The lights in view that light up what's round them (not the far-off windows), for the game's lamps. */
  *lamps() {
    for (const chunk of this.chunks.values()) for (const g of chunk.glows) if (!g.userData.far) yield g;
  }

  /** Where the fires in view send their sparks up. */
  *embers() {
    for (const chunk of this.chunks.values()) yield* chunk.embers;
  }

  clear() {
    for (const mesh of this.tiles.values()) dropTile(mesh);
    for (const chunk of this.chunks.values()) dropChunk(chunk);
    this.tiles.clear();
    this.chunks.clear();
    this.group.clear();
  }

  // --- the ground -------------------------------------------------------------------------

  /** Height and colour of the ground at (x, z). */
  heightAt(x: number, z: number, color?: THREE.Color) {
    const { sample: p, d, side } = this.course.nearest(x, z);
    const h = shape(p, d - p.width / 2, x, z, color, this.look, highAt(this.look, this.course.seed, p.s));
    if (p.isle <= 0 || h > p.y) return h;
    return island(p, this.course.splitAt(p.s)?.kind ?? 'isle', p.isle - Math.abs(side - p.isleU), h, x, z, color);
  }

  private tile(tx: number, tz: number) {
    const n = TILE / RES + 1;
    const m = n + 2; // an apron of one vertex all round, so normals match across tiles
    const heights = new Float32Array(m * m);
    const colors = new Float32Array(n * n * 3);
    const col = new THREE.Color();
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const x = tx * TILE + (i - 1) * RES;
        const z = tz * TILE + (j - 1) * RES;
        const inner = i > 0 && j > 0 && i <= n && j <= n;
        heights[j * m + i] = this.heightAt(x, z, inner ? col : undefined);
        if (inner) colors.set([col.r, col.g, col.b], ((j - 1) * n + (i - 1)) * 3);
      }
    }
    const pos = new Float32Array(n * n * 3);
    const nor = new Float32Array(n * n * 3);
    const v = new THREE.Vector3();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const h = (a: number, b: number) => heights[(j + 1 + b) * m + (i + 1 + a)];
        pos.set([tx * TILE + i * RES, h(0, 0), tz * TILE + j * RES], (j * n + i) * 3);
        v.set(h(-1, 0) - h(1, 0), 2 * RES, h(0, -1) - h(0, 1)).normalize();
        nor.set([v.x, v.y, v.z], (j * n + i) * 3);
      }
    }
    const index: number[] = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        index.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(index);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.ground);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.raycast = () => {};
    // the island's grass, blade by blade, on the green of the banks
    mesh.updateMatrixWorld();
    const grass = createGrass(mesh);
    // (the island's one field of grass is always in view; a tile's often isn't)
    grass.frustumCulled = true;
    grass.computeBoundingSphere();
    mesh.add(grass);
    return mesh;
  }

  // --- the water and the furniture ------------------------------------------------------------

  private chunk(c: number) {
    const course = this.course;
    const s0 = c * CHUNK;
    const s1 = s0 + CHUNK;
    course.extend(s1 + 60);
    const group = new THREE.Group();
    const water = waterRibbon(course, s0, Math.min(course.samples.length - 1, s1 + 1), this.water);
    group.add(water);
    const chunk: Chunk = { index: c, group, water, things: new Map(), glows: [], flames: [], embers: [], spots: [], canopies: [], batches: [], springs: [], feet: [], rainbows: [], chimneys: [], mists: [], clearings: [], solids: [] };
    const r = rng(course.seed * 7919 + c);

    for (const thing of course.near(s0, s1)) {
      if (thing.s < s0 || thing.s >= s1) continue;
      if (!('kind' in thing)) {
        // a gate: a buoy either side, or in a chute two poles hung from a wire across the river
        const p = course.at(thing.s);
        for (const b of [thing.a, thing.b]) {
          const m = this.assets.clone(thing.hung ? 'gate_pole' : 'buoy');
          m.position.set(b.x, p.y, b.z);
          group.add(m);
          chunk.things.set(b, m);
        }
        if (thing.hung && this.assets.has('gate_wire')) {
          const span = this.assets.extras.get('gate_wire')?.span ?? 20;
          const m = this.assets.clone('gate_wire');
          // the wire runs through both poles, its board over the middle of the gate
          const mid = { x: (thing.a.x + thing.b.x) / 2, z: (thing.a.z + thing.b.z) / 2 };
          const off = (mid.x - p.x) * Math.cos(p.a) + (mid.z - p.z) * Math.sin(p.a);
          m.position.set(p.x + Math.cos(p.a) * off, p.y, p.z + Math.sin(p.a) * off);
          m.rotation.y = -p.a;
          m.scale.x = (p.width + 3 + Math.abs(off) * 2) / span;
          group.add(m);
        }
      } else if ((thing.kind === 'rock' && !thing.scenery) || thing.kind === 'log') this.obstacle(chunk, thing, r);
      else if (thing.kind === 'ball' && !thing.taken) {
        const m = new THREE.Group();
        const ball = this.assets.clone('ball');
        ball.scale.setScalar(BALL_SIZE);
        ball.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = toon(BALL, { glow: true });
        });
        const glow = new THREE.Sprite(this.ballGlow);
        glow.scale.setScalar(1.5);
        glow.position.y = 0.3;
        glow.renderOrder = 2;
        const ring = new THREE.Mesh(this.ringShape, this.ballRing);
        ring.name = 'ring';
        ring.position.y = 0.03;
        ring.renderOrder = 2;
        m.add(ball, glow, ring);
        m.position.set(thing.x, course.at(thing.s).y, thing.z);
        group.add(m);
        chunk.things.set(thing, m);
      } else if (thing.kind === 'ledge') this.lip(chunk, thing.s, thing.height, r);
    }
    for (const f of course.features) if (f.s >= s0 && f.s < s1) this.feature(chunk, f.kind, f.s, f.side, r);
    // a distance post on the bank every 250 m
    for (let s = Math.ceil(s0 / 250) * 250; s < s1; s += 250) if (s > 0 && s < course.finish - 30) this.post(chunk, s, r);
    // and the finish, on both banks by the bridge
    if (course.finish >= s0 && course.finish < s1) for (const side of [-1, 1]) this.post(chunk, course.finish - 4, r, 'FINISH', side);
    // (the homes first, so the forest grows round them)
    this.homes(chunk, s0, rng(course.seed * 15485863 + c));
    this.camps(chunk, s0, rng(mix(course.seed, c, 1)));
    this.distant(chunk, s0, rng(mix(course.seed, c, 2)));
    this.foxfire(chunk, s0, rng(mix(course.seed, c, 3)));
    this.banks(chunk, s0, s1, r);
    this.springs(chunk, s0, s1, rng(course.seed * 104729 + c));
    this.islands(chunk, s0, s1, r);
    this.forsaken(chunk, s0, s1, rng(course.seed * 32452843 + c));
    if (chunk.canopies.length) {
      chunk.foliage = createFoliage(chunk.canopies, group);
      group.add(chunk.foliage);
    }
    this.batch(chunk);

    this.group.add(group);
    this.chunks.set(c, chunk);
    if (chunk.spots.length) this.onSpots?.(chunk.spots);
  }

  /**
   * Fold everything in a chunk that just stands there (the trees, ferns, flowers, boulders, the
   * bridge, the signs) into one instanced mesh per part and material: a few dozen draws a chunk
   * rather than one for every part of every tree, which is what slowed a big screen down. What
   * moves or gets looked up (the balls and gates, the glows, the leaves, the water) is left as it
   * is; the rocks and logs only ever get run into, so they go in with the rest.
   */
  private batch(chunk: Chunk) {
    const { group } = chunk;
    const keep = new Set<THREE.Object3D>([chunk.water, ...chunk.glows, ...chunk.flames, ...chunk.springs, ...chunk.rainbows, ...chunk.mists]);
    for (const [thing, m] of chunk.things) {
      const kind = (thing as Partial<Obstacle>).kind;
      if (kind !== 'rock' && kind !== 'log') keep.add(m);
    }
    if (chunk.foliage) keep.add(chunk.foliage);
    group.updateMatrixWorld(true);
    const parts = new Map<string, { mesh: THREE.Mesh; at: THREE.Matrix4[] }>();
    for (const o of [...group.children]) {
      if (keep.has(o)) continue;
      // only plain meshes: anything else (a sprite, a light, an instanced mesh) keeps the lot as it is
      let plain = true;
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh ? (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) : c.type !== 'Group' && c.type !== 'Object3D') plain = false;
      });
      if (!plain) continue;
      o.traverseVisible((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.Material;
        const key = `${m.geometry.uuid}|${mat.uuid}|${+m.castShadow}${+m.receiveShadow}|${m.renderOrder}`;
        let part = parts.get(key);
        if (!part) parts.set(key, (part = { mesh: m, at: [] }));
        part.at.push(m.matrixWorld.clone());
      });
      o.removeFromParent();
    }
    for (const { mesh, at } of parts.values()) {
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, at.length);
      at.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.castShadow = mesh.castShadow;
      inst.receiveShadow = mesh.receiveShadow;
      inst.renderOrder = mesh.renderOrder;
      // (the chunk never moves: no need to work its matrices out again every frame)
      inst.matrixAutoUpdate = false;
      inst.computeBoundingSphere();
      group.add(inst);
      chunk.batches.push(inst);
    }
  }

  private obstacle(chunk: Chunk, o: Obstacle, r: () => number) {
    const y = this.course.at(o.s).y;
    if (o.kind === 'rock') {
      const kind = o.post ? `post_${o.variant % 3}` : `rock_${o.variant}`;
      const m = this.assets.clone(this.assets.has(kind) ? kind : `rock_${o.variant % 5}`);
      const radius = this.assets.extras.get(kind)?.radius ?? 1;
      m.scale.setScalar(o.r / radius);
      m.scale.y *= o.post ? 0.9 + r() * 0.3 : 0.8 + r() * 0.5;
      m.position.set(o.x, y, o.z);
      m.rotation.y = r() * Math.PI * 2;
      chunk.group.add(m);
      chunk.things.set(o, m);
      // a boulder the size of a house has something growing on top
      if (o.r > 1.7 && !o.post) {
        const top = new THREE.Box3().setFromObject(m).max.y;
        this.put(chunk, r() < 0.5 ? 'fern' : `bush_${Math.floor(r() * 2)}`, { x: o.x + (r() - 0.5) * o.r * 0.4, y: top - 0.25, z: o.z + (r() - 0.5) * o.r * 0.4 }, r() * 6.3, 0.7 + r() * 0.3);
      }
    } else {
      const kind = `log_${o.variant}`;
      const m = this.assets.clone(kind);
      const length = this.assets.extras.get(kind)?.length ?? 7;
      const dx = o.x1 - o.x0;
      const dz = o.z1 - o.z0;
      const len = Math.hypot(dx, dz);
      // the model lies along its +x; stretch it to reach, and turn it to point at the tip
      m.scale.set((len + 0.6) / length, 1, 1);
      m.position.set(o.x0, y, o.z0);
      m.rotation.y = Math.atan2(-dz, dx);
      chunk.group.add(m);
      chunk.things.set(o, m);
    }
  }

  /** A ledge: big boulders shoulder to shoulder on both banks at the lip, so you see it coming. */
  private lip(chunk: Chunk, s: number, height: number, r: () => number) {
    const p = this.course.at(s);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const kind = `rock_${Math.floor(r() * 5)}`;
        const m = this.assets.clone(kind);
        const scale = 0.9 + height * 0.35 + r() * 0.3;
        m.scale.setScalar(scale);
        // (a big one set back, so it doesn't close the edge of the lip)
        const rad = (this.assets.extras.get(kind)?.radius ?? 1) * scale;
        const u = side * (p.width / 2 + Math.max(0.3, rad * 0.9 - REACH) + k * 1.4);
        m.position.set(p.x + Math.cos(p.a) * u, p.y - 0.4, p.z + Math.sin(p.a) * u);
        m.rotation.y = r() * 6.3;
        chunk.group.add(m);
        this.boulder(chunk, s, m.position.x, m.position.z, rad);
      }
    }
    // a waterfall throws up a mist, and on a sunny day a rainbow hangs in it
    if (height >= 3) {
      const foot = this.course.at(s + 7);
      const bow = new THREE.Sprite(this.rainbow);
      bow.position.set(foot.x, foot.y + 2.5, foot.z);
      bow.scale.set(foot.width * 1.1, foot.width * 0.55, 1);
      bow.renderOrder = 2;
      chunk.group.add(bow);
      chunk.rainbows.push(bow);
    }
  }

  /** Where a point `e` metres past the edge on one side of sample s is, or null if that's water. */
  private beside(s: number, side: number, e: number) {
    const p = this.course.at(s);
    const off = side * (p.width / 2 + e);
    const x = p.x + Math.cos(p.a) * off;
    const z = p.z + Math.sin(p.a) * off;
    const near = this.course.nearest(x, z);
    if (near.d - near.sample.width / 2 < Math.min(e * 0.7, e - 0.2)) return null; // another bend of the river
    return { x, z, y: this.heightAt(x, z), p };
  }

  /** Something the land stands in the water, for the kayak to run into. */
  private solid(chunk: Chunk, o: Obstacle) {
    this.course.addObstacle(o);
    chunk.solids.push(o);
  }

  /** A boulder of the land's at the water's edge (its mesh already placed), made solid if you can reach it. */
  private boulder(chunk: Chunk, s: number, x: number, z: number, radius: number) {
    const near = this.course.nearest(x, z, s);
    // (the boat can't get closer to the bank than this, so one set further back can't be hit)
    if (radius * 0.9 < Math.abs(near.side) - near.sample.width / 2 + 0.1) return;
    this.solid(chunk, { kind: 'rock', x, z, r: radius, s: near.sample.s, variant: 0, scenery: true });
  }

  private put(chunk: Chunk, kind: string, at: { x: number; y: number; z: number }, turn: number, scale = 1) {
    if (!this.assets.has(kind)) return null;
    const m = this.assets.clone(kind);
    m.position.set(at.x, at.y, at.z);
    m.rotation.y = turn;
    if (scale !== 1) m.scale.multiplyScalar(scale);
    chunk.group.add(m);
    this.dress(m, chunk);
    return m;
  }

  /**
   * Colour the crowns for the season (or take them off, in winter), and note where the leafy
   * trees want their leaf cards (the chunk grows them all at once, like the island's foliage).
   */
  private dress(m: THREE.Object3D, chunk: Chunk) {
    m.updateMatrixWorld(true);
    const tree = hash2(m.position.x, m.position.z) * 1e4;
    m.traverse((o) => {
      if (o.userData.canopy) {
        const scale = m.scale.x;
        chunk.canopies.push({
          position: o.getWorldPosition(new THREE.Vector3()), radius: o.userData.canopy * scale,
          palette: this.look.dark ? 'pine' : (o.userData.palette ?? 'leaf'), squash: o.userData.squash ?? 1, tree,
        });
      }
      if (o.name.startsWith('crown') && (o as THREE.Mesh).isMesh) {
        if (!this.crowns) o.visible = false;
        else (o as THREE.Mesh).material = this.crowns[Math.floor(hash2(m.position.x, m.position.z) * this.crowns.length)];
      }
    });
  }

  /**
   * Light up a model's lights after dark: a halo round each (knowing its colour, reach and flicker,
   * for the game to light what's round it too), its flames taken out to flicker on their own, and
   * where its sparks go up.
   */
  private glowAt(chunk: Chunk, m: THREE.Object3D) {
    m.updateMatrixWorld(true);
    const flames: THREE.Object3D[] = [];
    m.traverse((o) => {
      if (o.userData.flame) flames.push(o);
      if (o.userData.ember) chunk.embers.push(o.getWorldPosition(new THREE.Vector3()));
      if (!o.userData.light) return;
      const d = o.userData;
      this.lightAt(chunk, o.getWorldPosition(new THREE.Vector3()), {
        color: d.color, radius: d.radius, intensity: d.intensity ?? 1, flicker: d.flicker ?? 0, size: d.radius * 0.55, seed: Math.random() * 100,
      });
    });
    for (const f of flames) {
      chunk.group.attach(f);
      f.userData = { flicker: 1, seed: Math.random() * 100 };
      f.visible = false;
      chunk.flames.push(f);
    }
  }

  private lightAt(chunk: Chunk, at: THREE.Vector3, lamp: Lamp) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.halo, color: new THREE.Color(lamp.color), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, fog: false,
    }));
    sprite.position.copy(at);
    sprite.scale.setScalar(lamp.size);
    sprite.renderOrder = 2;
    sprite.visible = false;
    sprite.userData = lamp;
    lamp.over = Math.max(0, at.y - this.course.nearest(at.x, at.z).sample.y);
    chunk.group.add(sprite);
    chunk.glows.push(sprite);
    return sprite;
  }

  private feature(chunk: Chunk, kind: 'bridge' | 'tent' | 'cabin' | 'swing', s: number, side: number, r: () => number) {
    const p = this.course.at(s);
    if (kind === 'swing') {
      // an old tree on the bank, its long branch (the model's +x) reaching out over the water
      const at = this.beside(s, side, 0.9);
      if (at) this.put(chunk, 'swing', at, toRiver(side, p.a));
      return;
    }
    if (kind === 'bridge') {
      const span = this.assets.extras.get('bridge')?.span ?? 20;
      const m = this.assets.clone('bridge');
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = -p.a; // the model's x runs across the river
      m.scale.x = (p.width + 3) / span;
      chunk.group.add(m);
      this.glowAt(chunk, m);
      // the take-out's bridge is dressed for it
      if (Math.abs(s - this.course.finish) < 1 && this.assets.has('bunting')) {
        const b = this.assets.clone('bunting');
        b.position.copy(m.position);
        b.rotation.y = m.rotation.y;
        b.scale.x = m.scale.x;
        chunk.group.add(b);
      }
      // the trestles stand in the water: things to steer between
      for (const u of [-5, 5]) {
        const off = (u / span) * (p.width + 3);
        for (const dz of [-1, 1]) {
          const rock: Obstacle = {
            kind: 'rock', x: p.x + Math.cos(p.a) * off - Math.sin(p.a) * dz, z: p.z + Math.sin(p.a) * off + Math.cos(p.a) * dz,
            r: 0.25, s, variant: 0,
          };
          this.solid(chunk, rock); // collisions only: it has no mesh of its own
        }
      }
      return;
    }
    const at = this.beside(s, side, kind === 'cabin' ? 2.2 : 6 + r() * 3);
    if (!at) return;
    const m = this.put(chunk, kind, at, facing(-side * Math.cos(p.a), -side * Math.sin(p.a)));
    if (m) this.glowAt(chunk, m);
  }

  private post(chunk: Chunk, s: number, r: () => number, text?: string, side = r() < 0.5 ? -1 : 1, danger = false) {
    const at = this.beside(s, side, 1.6);
    if (!at) return;
    // turned to the river, and a little upstream, so you can read it coming
    const a = at.p.a;
    const m = this.put(chunk, 'sign', at, facing(-side * Math.cos(a) - Math.sin(a) * 0.8, -side * Math.sin(a) + Math.cos(a) * 0.8));
    if (!m) return;
    // the model's boxes have no UVs: the painted face is a plane just in front of the board
    const face = new THREE.Mesh(BOARD, signMaterial(text ?? (s >= 1000 ? `${(s / 1000).toFixed(s % 1000 ? 2 : 0)} km` : `${s} m`), danger));
    face.position.set(0, 1.45, 0.125);
    m.add(face);
  }

  /**
   * The islands the river parts round: a wooded one, with a jam of bleached driftwood piled on its
   * head and a gravel tail, or a low gravel bar in a pool with reeds at its ends and, likely as
   * not, a heron on it.
   */
  private islands(chunk: Chunk, s0: number, s1: number, r: () => number) {
    const course = this.course;
    for (const split of course.splits) {
      if (split.s1 < s0 || split.s0 >= s1) continue;
      const len = split.s1 - split.s0;
      const onIsle = (s: number, v: number) => {
        const p = course.at(s);
        const m = p.isleU + v;
        const x = p.x + Math.cos(p.a) * m;
        const z = p.z + Math.sin(p.a) * m;
        return { x, z, y: this.heightAt(x, z), p };
      };
      const head = Math.round(split.s0 + len * 0.05);
      if (head >= s0 && head < s1) {
        const p = course.at(head);
        const up = facing(-Math.sin(p.a), Math.cos(p.a));
        if (split.kind === 'isle' || r() < 0.4) this.put(chunk, 'driftwood', { ...onIsle(head, 0), y: p.y }, up, Math.min(1.3, 0.5 + split.half * 0.14));
      }
      const tail = Math.round(split.s0 + len * 0.85);
      if (tail >= s0 && tail < s1 && split.kind === 'bar' && r() < 0.7) {
        const at = onIsle(tail, 0);
        chunk.spots.push({ kind: 'heron', x: at.x, y: at.y, z: at.z, a: at.p.a, s: tail, side: 1 });
      }
      for (let s = Math.max(s0, Math.ceil(split.s0)); s < Math.min(s1, split.s1); s++) {
        const p = course.at(s);
        if (p.isle < 0.8) continue;
        const inner = (margin: number) => (r() * 2 - 1) * Math.max(0, p.isle - margin);
        if (split.kind === 'bar') {
          if (r() < 0.14) this.put(chunk, 'gravel', { ...onIsle(s, inner(0.8)), y: p.y }, r() * 6.3, 0.6 + r() * 0.5);
          if (r() < 0.06 * p.clear) this.put(chunk, `reeds_${Math.floor(r() * 2)}`, { ...onIsle(s, (r() < 0.5 ? -1 : 1) * p.isle * 0.9), y: p.y }, r() * 6.3);
          if (r() < 0.012) this.put(chunk, 'cairn', onIsle(s, inner(0.6)), r() * 6.3, 0.8);
          continue;
        }
        const t = (s - split.s0) / len;
        if (t > 0.78 && r() < 0.1) this.put(chunk, 'gravel', { ...onIsle(s, inner(0.5)), y: p.y }, r() * 6.3, 0.7 + r() * 0.5);
        if (p.isle > 2.2 && r() < 0.22) {
          const kind = r() < 0.5 ? `pine_${Math.floor(r() * 3)}` : r() < 0.3 ? `birch_${Math.floor(r() * 2)}` : `tree_${Math.floor(r() * 3)}`;
          this.put(chunk, kind, onIsle(s, inner(1.6)), r() * 6.3, 0.75 + r() * 0.4);
        }
        if (r() < 0.3) this.put(chunk, r() < 0.5 ? 'fern' : `bush_${Math.floor(r() * 2)}`, onIsle(s, inner(0.7)), r() * 6.3, 0.7 + r() * 0.5);
        if (r() < 0.12) this.put(chunk, `flowers_${Math.floor(r() * 3)}`, onIsle(s, inner(0.9)), r() * 6.3, 0.8 + r() * 0.4);
        if (r() < 0.03 && p.isle > 1.5) this.put(chunk, `rock_${Math.floor(r() * 5)}`, { ...onIsle(s, (r() < 0.5 ? -1 : 1) * (p.isle - 0.2)), y: p.y - 0.2 }, r() * 6.3, 0.8 + r() * 0.6);
      }
    }
  }

  /**
   * Now and then in a gorge, a side stream finds the edge and spills down the wall into the river:
   * a ribbon of white water following the rock down, with a fern or two at the top where it comes
   * out of the forest, and spray where it lands.
   */
  private springs(chunk: Chunk, s0: number, s1: number, r: () => number) {
    for (let s = s0; s < s1; s += 2) {
      const p = this.course.at(s);
      if (p.gorge < 0.55 || p.drop > 0 || r() > 0.012 * this.look.springs) continue;
      const side = r() < 0.5 ? -1 : 1;
      const width = 1.3 + r() * 0.9;
      // down the face, from the top of the wall to just under the water
      const path: THREE.Vector3[] = [];
      for (let e = 3.4; e >= -0.5; e -= 0.3) {
        const at = this.beside(s, side, Math.max(0.05, e));
        if (!at) break;
        const out = e < 0.05 ? (0.05 - e) : 0;
        const x = at.x - Math.cos(p.a) * side * out;
        const z = at.z - Math.sin(p.a) * side * out;
        // (lifted clear of the rock, and leaning out over the water a little as it falls)
        path.push(new THREE.Vector3(x - Math.cos(p.a) * side * 0.3, Math.max(p.y - 0.05, at.y) + 0.2, z - Math.sin(p.a) * side * 0.3));
      }
      if (path.length < 10 || path[0].y - p.y < 2.2) continue;
      const mesh = springRibbon(path, p.a, width, this.spring);
      chunk.group.add(mesh);
      chunk.springs.push(mesh);
      chunk.feet.push(path[path.length - 1].clone().setY(p.y));
      const top = path[0];
      this.put(chunk, 'fern', { x: top.x + Math.sin(p.a) * width, y: top.y - 0.1, z: top.z - Math.cos(p.a) * width }, r() * 6.3, 0.8);
      this.put(chunk, r() < 0.5 ? 'fern' : `bush_${Math.floor(r() * 2)}`, { x: top.x - Math.sin(p.a) * width, y: top.y - 0.1, z: top.z + Math.cos(p.a) * width }, r() * 6.3, 0.7);
      s += 14; // (not two side by side)
    }
  }

  /**
   * On the gentle rivers, somebody lives here: now and then a cottage by an open bank (smoke from
   * the chimney, the windows lit at night), a jetty with a rowing boat tied up, a picnic left on
   * the grass, and fences and hay out in the meadows.
   */
  private homes(chunk: Chunk, s0: number, r: () => number) {
    const home = this.look.homely;
    if (home <= 0) return;
    const course = this.course;
    const open = (s: number) => {
      const p = course.at(s);
      return p.gorge < 0.25 && p.isle <= 0 && Math.abs(s - course.finish) > 30;
    };
    const s = s0 + 4 + r() * (CHUNK - 8);
    const p = course.at(s);
    const side = r() < 0.5 ? -1 : 1;
    const inland = facing(-side * Math.cos(p.a), -side * Math.sin(p.a)); // (a model's front, -y in Blender, to the river)
    const pick = r();
    if (!open(s)) return;
    if (pick < home * 0.22) {
      const at = this.beside(s, side, 4.5 + r() * 2);
      const m = at && this.put(chunk, 'cottage', at, inland + (r() - 0.5) * 0.3);
      if (m) {
        chunk.clearings.push({ x: at.x, z: at.z, r: 6 });
        this.glowAt(chunk, m);
        m.updateMatrixWorld(true);
        m.traverse((o) => {
          if (o.userData.chimney) chunk.chimneys.push(o.getWorldPosition(new THREE.Vector3()));
        });
      }
    } else if (pick < home * 0.4 && p.speed < 5) {
      // (standing on the bank at the waterline, reaching out over the water)
      const at = this.beside(s, side, 0.8);
      const m = at && this.put(chunk, 'jetty', { ...at, y: p.y }, inland);
      if (at && m) {
        this.glowAt(chunk, m);
        // (its end post and the boat stand in the water: things to steer round, not through)
        const out = -side * 3.2;
        this.solid(chunk, { kind: 'rock', x: at.x + Math.cos(p.a) * out, z: at.z + Math.sin(p.a) * out, r: 0.8, s, variant: 0 });
      }
    } else if (pick < home * 0.52) {
      const at = this.beside(s, side, 3 + r() * 3);
      if (at && this.put(chunk, 'picnic', at, r() * 6.3)) chunk.clearings.push({ x: at.x, z: at.z, r: 2.5 });
    }
    // the meadows behind: a fence running along the valley, and hay
    for (let k = 0; k < 3; k++) {
      const s = s0 + r() * CHUNK;
      if (!open(s)) continue;
      const p = course.at(s);
      const side = r() < 0.5 ? -1 : 1;
      if (r() < home * 0.35) {
        const at = this.beside(s, side, 3 + r() * 6);
        // (the model runs along its x: turned to run with the river)
        if (at && !this.cleared(chunk, at)) this.put(chunk, 'fence', { ...at, y: at.y - 0.05 }, -p.a + Math.PI / 2 + (r() - 0.5) * 0.3);
      }
      if (r() < home * 0.3) {
        const at = this.beside(s, side, 3.5 + r() * 9);
        if (at && !this.cleared(chunk, at)) this.put(chunk, `hay_${Math.floor(r() * 2)}`, { ...at, y: at.y - 0.05 }, r() * 6.3, 0.9 + r() * 0.2);
      }
    }
  }

  /**
   * Now and then somebody's out by the river after dark, on any river but down in a gorge: a fire
   * on the bank with logs pulled up round it, or somebody's night fishing, their lantern on the
   * ground by the water. By day the fire's a ring of cold ash and the lantern's out.
   */
  private camps(chunk: Chunk, s0: number, r: () => number) {
    const course = this.course;
    const fire = 0.04 + this.look.homely * 0.03;
    const angler = 0.05 + this.look.homely * 0.05;
    const pick = r();
    if (pick > fire + angler) return;
    const s = s0 + 4 + r() * (CHUNK - 8);
    const p = course.at(s);
    if (p.gorge > 0.25 || p.isle > 0 || Math.abs(s - course.finish) < 40) return;
    if (course.features.some((f) => Math.abs(f.s - s) < 20)) return; // (not by a tent's fire, or under a bridge)
    const side = r() < 0.5 ? -1 : 1;
    if (pick < fire) {
      const at = this.beside(s, side, 2.4 + r() * 1.4);
      if (!at || this.cleared(chunk, at)) return;
      const m = this.put(chunk, 'campfire', { ...at, y: at.y - 0.03 }, r() * 6.3);
      if (!m) return;
      chunk.clearings.push({ x: at.x, z: at.z, r: 5 }); // (room under the sky: no crowns over the fire)
      this.camped(chunk, m, 'fire');
      return;
    }
    // (in quiet water: nobody fishes the white water)
    if (p.speed > 6 || p.rough > 0.3) return;
    const at = this.beside(s, side, 0.7);
    if (!at || this.cleared(chunk, at)) return;
    const m = this.put(chunk, 'angler', { ...at, y: at.y - 0.02 }, toRiver(side, p.a));
    if (!m) return;
    chunk.clearings.push({ x: at.x, z: at.z, r: 2.5 });
    this.camped(chunk, m, 'angler');
  }

  /** A camp's lights, marked as somebody's (for the little something paddling past one after dark). */
  private camped(chunk: Chunk, m: THREE.Object3D, camp: 'fire' | 'angler') {
    const from = chunk.glows.length;
    this.glowAt(chunk, m);
    for (const g of chunk.glows.slice(from)) (g.userData as Lamp).camp = camp;
  }

  /**
   * On the forest floor after dark, in autumn and on the dark rivers any time: foxfire, a faint
   * green glow in the rotting wood, a few specks together and a soft light round them. They light
   * nothing, but they're there when your eyes get used to the dark.
   */
  private foxfire(chunk: Chunk, s0: number, r: () => number) {
    const look = this.look;
    const chance = look.dark ? 0.55 : season.weights.autumn * season.turn * 0.35 * (1 - look.homely * 0.4);
    if (r() > chance) return;
    const s = s0 + r() * CHUNK;
    if (this.course.at(s).gorge > 0.4) return;
    const at = this.beside(s, r() < 0.5 ? -1 : 1, 3 + r() * 8);
    if (!at || this.cleared(chunk, at)) return;
    const color = FOXFIRE[Math.floor(r() * FOXFIRE.length)];
    this.lightAt(chunk, new THREE.Vector3(at.x, at.y + 0.1, at.z), { color, radius: 0, intensity: 0, flicker: 0, size: 2.4, seed: 0, far: true, dim: 0.22 });
    for (let k = 3 + Math.floor(r() * 5); k > 0; k--) {
      const a = r() * Math.PI * 2;
      const d = r() * 0.9;
      const x = at.x + Math.cos(a) * d;
      const z = at.z + Math.sin(a) * d;
      this.lightAt(chunk, new THREE.Vector3(x, this.heightAt(x, z) + 0.06, z), { color, radius: 0, intensity: 0, flicker: 0.15, size: 0.28 + r() * 0.2, seed: r() * 100, far: true, dim: 0.9 });
    }
  }

  /**
   * Far off up the valley side after dark, somebody's windows: a warm spark or two where the
   * river's lived by, and now and then a hut's light high up in the mountains. Only something to
   * see; they're too far off to light anything.
   */
  private distant(chunk: Chunk, s0: number, r: () => number) {
    const look = this.look;
    if (r() > look.homely * 0.45 + look.alpine * 0.12) return;
    const s = s0 + r() * CHUNK;
    const p = this.course.at(s);
    if (p.gorge > 0.3) return;
    const at = this.beside(s, r() < 0.5 ? -1 : 1, 22 + r() * 24);
    if (!at) return;
    const color = WINDOW[Math.floor(r() * WINDOW.length)];
    const panes = look.homely > 0 && r() < 0.5 ? 2 : 1;
    // (side by side, along the valley)
    for (let k = 0; k < panes; k++) {
      const off = (k - (panes - 1) / 2) * 0.9;
      const lamp: Lamp = { color, radius: 0, intensity: 0, flicker: 0.05, size: 1.3, seed: r() * 100, far: true };
      this.lightAt(chunk, new THREE.Vector3(at.x - Math.sin(p.a) * off, at.y + 1.3, at.z + Math.cos(p.a) * off), lamp);
    }
  }

  /** Whether `at` is in a clearing (round a cottage, a picnic) that the trees stay off. */
  private cleared(chunk: Chunk, at: { x: number; z: number }) {
    return chunk.clearings.some((c) => (at.x - c.x) ** 2 + (at.z - c.z) ** 2 < c.r * c.r);
  }

  /**
   * On the hard rivers, nobody does: what's left of somebody's boat on the rocks by the white
   * water, banks of mist lying on the water, and a board by the bank before every big fall.
   */
  private forsaken(chunk: Chunk, s0: number, s1: number, r: () => number) {
    const course = this.course;
    // (in a bank of fog, lying thick on the water)
    const mist = fogAt(this.look, course.seed, s0 + CHUNK / 2);
    for (let n = mist * 4 + r(); n >= 1; n--) {
      const p = course.at(s0 + r() * CHUNK);
      const u = (r() - 0.5) * p.width;
      const m = new THREE.Sprite(this.mist);
      m.position.set(p.x + Math.cos(p.a) * u, p.y + 0.6 + r() * 0.8, p.z + Math.sin(p.a) * u);
      m.userData.x = m.position.x;
      m.scale.set(12 + r() * 10, 4 + r() * 3, 1);
      m.renderOrder = 3;
      chunk.group.add(m);
      chunk.mists.push(m);
    }
    // a warning, well before the big drops (a cascade's steps only get the one, at its top)
    for (const t of course.near(s0 + 50, s1 + 50)) {
      if (!('kind' in t) || t.kind !== 'ledge' || t.height < 2.5) continue;
      const at = t.s - 50;
      if (at < s0 || at >= s1) continue;
      const above = course.near(t.s - 70, t.s - 1).some((o) => 'kind' in o && o.kind === 'ledge');
      if (!above) this.post(chunk, at, r, t.height >= 3 ? 'FALLS' : 'DANGER', r() < 0.5 ? -1 : 1, true);
    }
    const grim = this.look.grim;
    if (grim <= 0) return;
    const s = s0 + r() * CHUNK;
    const p = course.at(s);
    if (p.rough > 0.3 && p.isle <= 0 && r() < grim * 0.22) {
      const side = r() < 0.5 ? -1 : 1;
      const at = this.beside(s, side, 0.3 + r() * 0.8);
      if (at) this.put(chunk, 'wreck', { ...at, y: Math.max(at.y - 0.2, p.y - 0.1) }, r() * 6.3);
    }
  }

  /**
   * Thick mixed forest down to the water on both banks: pines and broadleaves, ferns and bushes
   * underneath, mossy boulders, reeds at the edges of the slow pools and lily pads on them, and
   * crags along the tops of the gorges. And the places animals will be.
   */
  private banks(chunk: Chunk, s0: number, s1: number, r: () => number) {
    for (let s = s0; s < s1; s++) {
      const p = this.course.at(s);
      const high = highAt(this.look, this.course.seed, s);
      for (const side of [-1, 1]) {
        // trees: two rows of chances, the near one sparser so the water stays in view
        for (const [chance, e0, e1] of [[0.22, 1.6, 6], [0.75, 6, 34]] as const) {
          if (r() >= chance * (1 - p.gorge * 0.4) * (1 - high * 0.4)) continue;
          const e = e0 + p.gorge * 2.5 + r() * (e1 - e0);
          const at = this.beside(s, side, e);
          if (!at || this.cleared(chunk, at)) continue;
          const pine = r() < this.look.pines + p.gorge * 0.3 + Math.min(0.3, e / 100) + high * 0.6;
          // (on the hard rivers, the storms have had a good few of them: dead and silver)
          const dead = r() < this.look.grim * (0.16 + p.rough * 0.2);
          const kind = dead ? `snag_${Math.floor(r() * 2)}` : pine ? `pine_${Math.floor(r() * 3)}` : r() < this.look.birch ? `birch_${Math.floor(r() * 2)}` : `tree_${Math.floor(r() * 3)}`;
          this.put(chunk, kind, at, r() * Math.PI * 2, (0.85 + r() * 0.5) * (e < 6 ? 0.85 : 1));
        }
        // the undergrowth: ferns and bushes, thickest near the water
        if (r() < 0.32) {
          const at = this.beside(s, side, 0.6 + Math.pow(r(), 1.5) * 16);
          if (at && !this.cleared(chunk, at)) this.put(chunk, r() < 0.55 ? 'fern' : `bush_${Math.floor(r() * 2)}`, at, r() * 6.3, 0.8 + r() * 0.7);
        }
        // mossy boulders at the water's edge, and crags along the top of a gorge
        if (r() < 0.05 + p.rough * 0.05) {
          const e = -0.4 + r() * 1.2;
          let at = this.beside(s, side, e);
          if (at) {
            const kind = `rock_${Math.floor(r() * 5)}`;
            const turn = r() * 6.3;
            const scale = 0.9 + r() * 0.8;
            // (a big one set back, so it doesn't close the edge of the river)
            const rad = (this.assets.extras.get(kind)?.radius ?? 1) * scale;
            if (rad * 0.9 - e > REACH) at = this.beside(s, side, rad * 0.9 - REACH);
            if (at && this.put(chunk, kind, { ...at, y: Math.max(at.y - 0.3, p.y - 0.3) }, turn, scale)) this.boulder(chunk, s, at.x, at.z, rad);
          }
        }
        if (r() < p.gorge * 0.2) {
          const at = this.beside(s, side, 2.2 + r() * 4);
          const spire = r() < this.look.grim * 0.5;
          if (at) this.put(chunk, spire ? `spire_${Math.floor(r() * 2)}` : `crag_${Math.floor(r() * 2)}`, at, r() * 6.3, spire ? 0.7 + r() * 0.5 : 0.6 + r() * 0.6);
        }
        // and needles of black rock standing about the banks, even out of the gorges, and up on
        // the mountainsides high up, big ones, splintering out of the scree
        if (r() < (this.look.grim * 0.02 + high * 0.035) * (1 - p.gorge * 0.5)) {
          const at = this.beside(s, side, 1.5 + r() * 12);
          if (at) this.put(chunk, `spire_${Math.floor(r() * 2)}`, { ...at, y: at.y - 0.3 }, r() * 6.3, 0.6 + r() * 0.7);
        }
        if (r() < high * 0.05) {
          const at = this.beside(s, side, 5 + r() * 14);
          if (at) this.put(chunk, `spire_${Math.floor(r() * 2)}`, { ...at, y: at.y - 0.5 }, r() * 6.3, 1.1 + r() * 1.2);
        }
        // wildflowers in the clearings, toadstools and old stumps under the trees, a fallen trunk
        // gone green with moss, and somebody's cairn on a beach
        const open = 1 - p.gorge * 0.7;
        if (r() < 0.1 * open * this.look.meadow) {
          const at = this.beside(s, side, 0.8 + Math.pow(r(), 1.3) * 10);
          if (at) this.put(chunk, `flowers_${Math.floor(r() * 3)}`, at, r() * 6.3, 0.8 + r() * 0.5);
        }
        if (r() < 0.025) {
          const at = this.beside(s, side, 3 + r() * 12);
          if (at) this.put(chunk, `mushroom_${Math.floor(r() * 2)}`, at, r() * 6.3, 0.9 + r() * 0.4);
        }
        if (r() < 0.012 * open) {
          const at = this.beside(s, side, 2 + r() * 10);
          if (at) this.put(chunk, 'stump', at, r() * 6.3, 0.8 + r() * 0.5);
        }
        if (r() < 0.008 * open) {
          const at = this.beside(s, side, 4 + r() * 12);
          if (at) this.put(chunk, 'trunk', { ...at, y: at.y - 0.1 }, r() * 6.3, 0.8 + r() * 0.4);
        }
        if (r() < 0.008 * p.clear) {
          const at = this.beside(s, side, 0.6 + r() * 1.5);
          if (at) this.put(chunk, 'cairn', at, r() * 6.3, 0.8 + r() * 0.4);
        }
        // reeds at the edges of the slow water, lily pads on it, a willow trailing its hair in it
        const slow = Math.max(0, 1 - p.speed / 4.5);
        if (r() < 0.025 * p.clear * (0.3 + slow) * Math.min(2, this.look.meadow)) {
          const at = this.beside(s, side, 0.4 + r() * 1.2);
          if (at) this.put(chunk, 'willow', at, toRiver(side, p.a) + (r() - 0.5) * 0.6, 0.85 + r() * 0.3);
        }
        if (r() < p.clear * 0.07 * (0.4 + slow)) {
          const at = this.beside(s, side, -0.2 + r() * 0.8);
          if (at) this.put(chunk, `reeds_${Math.floor(r() * 2)}`, { ...at, y: Math.max(at.y, p.y) }, r() * 6.3);
        }
        if (r() < slow * p.clear * 0.06 * Math.min(2, this.look.meadow)) {
          const u = side * (0.62 + r() * 0.3) * (p.width / 2);
          const m = this.assets.clone(`lily_${Math.floor(r() * 2)}`);
          m.position.set(p.x + Math.cos(p.a) * u, p.y + 0.01, p.z + Math.sin(p.a) * u);
          m.rotation.y = r() * 6.3;
          chunk.group.add(m);
        }
      }
      // somewhere for the animals: a heron in the shallows, ducks by the reeds, deer coming down
      // to drink, fish in the slow water
      if (s % 8 === 0) {
        const side = r() < 0.5 ? -1 : 1;
        const pick = r();
        const slow = p.speed < 4.2 && p.rough < 0.3;
        const add = (kind: Spot['kind'], e: number) => {
          const at = this.beside(s, side, e);
          if (at) chunk.spots.push({ kind, x: at.x, y: kind === 'ducks' || kind === 'fish' ? p.y : at.y, z: at.z, a: p.a, s, side });
        };
        if (slow && pick < 0.06) add('heron', -0.6);
        else if (slow && pick < 0.12) add('ducks', -1.8);
        else if (slow && this.look.homely > 0.5 && p.clear > 0.3 && pick < 0.15) add('swans', -p.width * 0.25);
        else if (p.gorge < 0.5 && pick < 0.16) add('deer', 0.8);
        else if (slow && pick < 0.24) add('fish', -p.width * 0.3);
        // on a meadow river, sheep grazing the open banks
        else if (this.look.meadow > 1 && p.gorge < 0.3 && pick < 0.2 + this.look.meadow * 0.07) add('sheep', 4 + r() * 6);
      }
    }
  }
}

/**
 * The shape of the land `e` metres past the river's edge (negative: under the water), for the
 * character of the river at sample p. Far from the water it all settles into the same rolling
 * country, so neighbouring stretches meet without a seam.
 */
function shape(p: Sample, e: number, x: number, z: number, color?: THREE.Color, look?: Look, high = 0) {
  const n = fbm(x, z);
  const { clear, gorge } = p;
  // the bank shelves steadily through the waterline rather than stepping up out of it, so the
  // water's edge follows the bank and not the ground's triangles
  const shelf = p.y + 0.04 + e * 0.6;
  if (e < 0) {
    color?.copy(BED);
    return Math.max(p.y - 0.45 - Math.min(1.4, -e * 0.35), shelf);
  }
  // a mossy bank, a pebbly beach by the pools, or a gorge's walls; and beyond, the valley's
  // sides climbing away into the mountains, lumpy with hills
  const far = smooth(4, 22, e);
  // (higher up, the valley's a deep one, its sides climbing steep to jagged ridges)
  // (the climb starting closer in, so from the river you see the mountain go up)
  const ridge = high > 0 ? (1 - Math.abs(noise2(x * 0.07, z * 0.07) * 2 - 1)) ** 2 * smooth(8, 30, e) * high * 12 : 0;
  // (but never so steep that a ridge between two bends hides the water from the camera: no
  // steeper than the camera looks down)
  const valley = Math.min((smooth(6 - high * 3, 60 - high * 30, e) * 16 + smooth(25 - high * 12, 70 - high * 25, e) * 10) * (1 + high) + ridge, Math.max(0, e - 4));
  const hills = (n - 0.5) * 4.5 * far + far * 1.2 + valley;
  const bank = p.y + 0.35 + smooth(0, 2.2, e) * 0.9 + hills;
  const beach = p.y + 0.06 + Math.min(0.6, e * 0.1) + hills * 0.85;
  const wall = p.y + 0.2 + smooth(0.2, 2.4, e) * (6 + n * 2.5) * (1 + high * 0.5) + hills;
  const soft = bank + (beach - bank) * smooth(0.4, 0.9, clear);
  const land = soft + (wall - soft) * gorge;
  const h = land + (Math.min(shelf, land) - land) * (1 - smooth(0.4, 1.2, e));

  if (color) {
    const k = hash2(Math.floor(x), Math.floor(z));
    const moss = MOSS[Math.max(0, Math.min(4, Math.floor(n * 4.99 + (k - 0.5) * 0.9)))];
    const floor = FOREST_FLOOR[Math.max(0, Math.min(3, Math.floor(n * 3.99 + (k - 0.5) * 0.9)))];
    if (e < 0.5) color.copy(clear > 0.5 ? WET : PEBBLES[0]);
    else if (e < 1.4 + clear * 2) color.copy(clear > 0.5 && k > 0.3 ? SAND[Math.floor(k * 3)] : PEBBLES[Math.floor(k * 3)]);
    else color.copy(e < 5 ? moss : floor);
    // the gorge's walls: stripes of rock where it's steep
    if (gorge > 0.3 && e > 0.3 && e < 3.2) {
      const band = Math.floor((h - p.y) * 1.3 + n * 2) % 4;
      color.lerp(CLIFF[(band + 4) % 4], smooth(0.3, 0.6, gorge));
    }
    // the river's own green: lush and sunny, or dark and cold
    if (look && look.earth[1] > 0 && e > 1.4 + clear * 2) color.lerp(earthOf(look), look.earth[1]);
    // bare rock showing through high on the valley's sides (on a hard river, everywhere)
    const crags = Math.min(1, (look?.crags ?? 0) + high * 0.6);
    if (e > 30 - crags * 22 && n > 0.62 - crags * 0.14) color.lerp(CLIFF[Math.floor(k * 4)], 0.7);
    // and up there, on a cold river, snow
    // (and high up in the mountains, old snow lying on the tops whatever the river)
    const snow = Math.max(look?.snow ?? 0, high * 0.9);
    const line = 15 + high * 6;
    if (snow > 0) color.lerp(SNOW, snow * smooth(line - n * 6, line + 4 - n * 6, h - p.y + (k - 0.5) * 1.5));
  }
  return h;
}

const earths = new Map<string, THREE.Color>();
const earthOf = (look: Look) => {
  let c = earths.get(look.earth[0]);
  if (!c) earths.set(look.earth[0], (c = C(look.earth[0])));
  return c;
};

/**
 * An island, `e` metres in from its edge (negative: in the water beside it), where the rest of the
 * river would have `h`: shelving up out of the water to a pebbly shore, then moss and forest floor
 * on a wooded island; a gravel bar only just clears the water.
 */
function island(p: Sample, kind: Split['kind'], e: number, h: number, x: number, z: number, color?: THREE.Color) {
  const shelf = p.y + 0.04 + e * 0.6;
  if (e < 0) return Math.max(h, p.y - 0.4 - Math.min(1.4, -e * 0.45), shelf);
  const n = fbm(x, z);
  const k = hash2(Math.floor(x), Math.floor(z));
  if (kind === 'bar') {
    color?.copy(e < 0.4 ? WET : PEBBLES[Math.floor(k * 3)]).lerp(SAND[1], p.clear * 0.3 * k);
    return Math.min(shelf, p.y + 0.14 + Math.min(0.22, e * 0.1) + (n - 0.5) * 0.08);
  }
  if (color) {
    if (e < 0.25) color.copy(WET);
    else if (e < 1.4 || p.isle < 2) color.copy(PEBBLES[Math.floor(k * 3)]);
    else color.copy(e < 2.6 ? MOSS[Math.max(0, Math.min(4, Math.floor(n * 4.99)))] : FOREST_FLOOR[Math.max(0, Math.min(3, Math.floor(n * 3.99 + (k - 0.5))))]);
  }
  return Math.min(shelf, p.y + 0.2 + smooth(0.3, 2.2, e) * 0.9 + smooth(1.5, 4, e) * (n - 0.3) * 1.2);
}

/** The turn for a model whose +x should point out from the bank on `side` across the river. */
const toRiver = (side: number, a: number) => Math.atan2(side * Math.sin(a), -side * Math.cos(a));

/** The crown colours for today: fresh green in spring, turning in autumn, none in winter. */
function crownMaterials(): THREE.Material[] | null {
  const { leafOut, fresh, turn, fall } = leavesAt(season.leafYear);
  if (leafOut < 0.3 || fall > 0.8) return null;
  const green = ['#2f6a3c', '#3a7a40', '#4a8c45'];
  const spring = ['#3f8038', '#56993f', '#72b04c'];
  const autumn = ['#a0392c', '#cc622c', '#d4ae40', '#e08a3a'];
  let pal = fresh > 0.5 ? spring : green;
  if (turn > 0.4) pal = turn > 0.8 ? autumn : [...green.slice(0, 2), ...autumn.slice(1, 3)];
  return pal.map((c) => toon(new THREE.Color(c)));
}

/** The angle to turn a model by so that its front (+z) faces along (dx, dz). */
const facing = (dx: number, dz: number) => Math.atan2(dx, dz);

const BOARD = new THREE.PlaneGeometry(1.26, 0.56);
const signs = new Map<string, THREE.Material>();
/** A distance board, painted. */
function signMaterial(text: string, danger = false) {
  let mat = signs.get(text + danger);
  if (mat) return mat;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d')!;
  // a warning's red on white, and ringed in red; a distance post's painted on the bare wood
  g.fillStyle = danger ? '#c8403a' : '#b27a48';
  g.fillRect(0, 0, 64, 32);
  g.fillStyle = danger ? '#f2ece2' : '#8a5a36';
  if (danger) g.fillRect(3, 3, 58, 26);
  else g.fillRect(0, 26, 64, 6);
  g.fillStyle = danger ? '#b0302a' : '#2a1a12';
  g.font = 'bold 15px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 32, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  mat = new THREE.MeshToonMaterial({ map: tex });
  signs.set(text + danger, mat);
  return mat;
}

/**
 * A side stream's water, pouring down a gorge wall: bright broken stripes running down it, glassy
 * where it comes over the top, its edges ragged. It keeps time and light with the river's water.
 */
function springMaterial(river: Record<string, THREE.IUniform>) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLight: { value: new THREE.Color() } }]);
  uniforms.uTime = river.uTime;
  uniforms.uLight = river.uLight;
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uLight;
      varying vec2 vUv; // across (0..1), metres down from the top
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 p = floor(vec2(vUv.x * 7.0, vUv.y * 6.0));
        float across = abs(vUv.x - 0.5) * 2.0;
        float edge = 0.78 + 0.22 * noise(vec2(p.y * 0.6 - uTime * 7.0, p.x * 0.3 + 3.0));
        if (across > edge) discard;
        float pour = noise(vec2(p.x * 1.4, p.y * 0.4 - uTime * 10.0));
        vec3 col = mix(vec3(0.55, 0.8, 0.88), vec3(0.95, 1.0, 1.0), step(0.42, pour));
        col = mix(vec3(0.2, 0.48, 0.58), col, smoothstep(0.1, 0.9, vUv.y));
        gl_FragColor = vec4(col * uLight, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

/** The ribbon a side stream pours down: along `path` (top to bottom), `width` across the river's line (heading a). */
function springRibbon(path: THREE.Vector3[], a: number, width: number, material: THREE.Material) {
  const tx = Math.sin(a);
  const tz = -Math.cos(a);
  const pos = new Float32Array(path.length * 6);
  const uv = new Float32Array(path.length * 4);
  let down = 0;
  path.forEach((q, i) => {
    if (i) down += q.distanceTo(path[i - 1]);
    // (spreading out a little as it falls)
    const w = (width / 2) * (1 + (i / path.length) * 0.5);
    pos.set([q.x - tx * w, q.y, q.z - tz * w, q.x + tx * w, q.y, q.z + tz * w], i * 6);
    uv.set([0, down, 1, down], i * 4);
  });
  const index: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const k = i * 2;
    index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.raycast = () => {};
  return mesh;
}

/** A rainbow's arc, a pixel wide per colour, for the mist under a waterfall. */
function rainbowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d')!;
  const bands = ['#ff5a4a', '#ff9a3c', '#ffe25a', '#6fd06a', '#5ab0ff', '#8a6aff'];
  const img = g.createImageData(64, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const band = Math.floor(30.5 - Math.hypot(x + 0.5 - 32, 32 - y));
      if (band < 0 || band >= bands.length) continue;
      const col = new THREE.Color(bands[band]);
      // fading out towards the ends of the arc, where it meets the mist
      const fade = Math.min(1, (32 - y) / 14);
      img.data.set([col.r * 255, col.g * 255, col.b * 255, 255 * fade * 0.7], (y * 64 + x) * 4);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
