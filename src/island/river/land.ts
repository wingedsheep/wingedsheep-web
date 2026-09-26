import * as THREE from 'three';
import { createFoliage } from '../scene/foliage';
import { createGrass } from '../scene/grass';
import type { CanopyMarker } from '../scene/island';
import { leavesAt, season } from '../scene/season';
import { toon } from '../scene/toon';
import type { RiverAssets } from './assets';
import { type Course, type Obstacle, type Sample, type Split, rng } from './course';
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
/** Beike's tennis balls: bigger than life and a touch brighter, so you can spot one from upstream. */
const BALL = C('#e2ee3a');
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
  // (the batches share their geometry and materials with the templates: only the instances go)
  for (const b of chunk.batches) b.dispose();
  if (!chunk.foliage) return;
  const mat = chunk.foliage.material as THREE.MeshToonMaterial;
  mat.map?.dispose();
  mat.dispose();
  chunk.foliage.geometry.dispose();
  chunk.foliage.dispose();
}

/** One bit of the riverside that stands somewhere: an animal's spot, a tree, a heron's pool. */
export interface Spot {
  kind: 'heron' | 'ducks' | 'deer' | 'sheep' | 'fish';
  x: number;
  y: number;
  z: number;
  /** Which way is downstream there. */
  a: number;
  s: number;
  side: number;
}

interface Chunk {
  index: number;
  group: THREE.Group;
  water: THREE.Mesh;
  /** The things in it you can hit or pick up, and their meshes. */
  things: Map<object, THREE.Object3D>;
  glows: THREE.Sprite[];
  spots: Spot[];
  /** Where its trees' leaves go, and the leaf cards grown there (as on the island). */
  canopies: CanopyMarker[];
  foliage?: THREE.InstancedMesh;
  /** Its scenery, folded into one instanced mesh per part (see Land.batch). */
  batches: THREE.InstancedMesh[];
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
  private ballRing = new THREE.MeshBasicMaterial({ color: C('#fdfbe0'), transparent: true, depthWrite: false, fog: false });
  private ringShape = new THREE.RingGeometry(0.62, 0.78, 20).rotateX(-Math.PI / 2);
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
    this.ballGlow = new THREE.SpriteMaterial({ map: halo, color: C('#f2ff5a'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
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

  /** The mesh standing for a rock, log or ball, if its chunk is built. */
  meshOf(thing: object) {
    for (const chunk of this.chunks.values()) {
      const m = chunk.things.get(thing);
      if (m) return m;
    }
    return undefined;
  }

  /** How bright the lanterns and windows are (0 by day … 1 at night). */
  glow(night: number, time: number) {
    for (const chunk of this.chunks.values()) {
      for (const g of chunk.glows) {
        (g.material as THREE.SpriteMaterial).opacity = night * (0.85 + Math.sin(time * 9 + g.id) * 0.08);
        g.visible = night > 0.05;
      }
    }
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
    const h = shape(p, d - p.width / 2, x, z, color);
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
    const chunk: Chunk = { index: c, group, water, things: new Map(), glows: [], spots: [], canopies: [], batches: [] };
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
      } else if (thing.kind === 'rock' || thing.kind === 'log') this.obstacle(chunk, thing, r);
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
    this.banks(chunk, s0, s1, r);
    this.islands(chunk, s0, s1, r);
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
    const keep = new Set<THREE.Object3D>([chunk.water, ...chunk.glows]);
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
        const u = side * (p.width / 2 + 0.3 + k * 1.4);
        const m = this.assets.clone(`rock_${Math.floor(r() * 5)}`);
        m.scale.setScalar(0.9 + height * 0.35 + r() * 0.3);
        m.position.set(p.x + Math.cos(p.a) * u, p.y - 0.4, p.z + Math.sin(p.a) * u);
        m.rotation.y = r() * 6.3;
        chunk.group.add(m);
      }
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
          palette: o.userData.palette ?? 'leaf', squash: o.userData.squash ?? 1, tree,
        });
      }
      if (o.name.startsWith('crown') && (o as THREE.Mesh).isMesh) {
        if (!this.crowns) o.visible = false;
        else (o as THREE.Mesh).material = this.crowns[Math.floor(hash2(m.position.x, m.position.z) * this.crowns.length)];
      }
    });
  }

  private glowAt(chunk: Chunk, m: THREE.Object3D) {
    m.updateMatrixWorld(true);
    m.traverse((o) => {
      if (!o.userData.light) return;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.halo, color: new THREE.Color(o.userData.color), blending: THREE.AdditiveBlending,
        depthWrite: false, transparent: true, fog: false,
      }));
      o.getWorldPosition(sprite.position);
      sprite.scale.setScalar(o.userData.radius * 0.55);
      sprite.renderOrder = 2;
      sprite.visible = false;
      chunk.group.add(sprite);
      chunk.glows.push(sprite);
    });
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
      // the trestles stand in the water: things to steer between
      for (const u of [-5, 5]) {
        const off = (u / span) * (p.width + 3);
        for (const dz of [-1, 1]) {
          const rock: Obstacle = {
            kind: 'rock', x: p.x + Math.cos(p.a) * off - Math.sin(p.a) * dz, z: p.z + Math.sin(p.a) * off + Math.cos(p.a) * dz,
            r: 0.25, s, variant: 0,
          };
          this.course.addObstacle(rock); // collisions only: it has no mesh of its own
        }
      }
      return;
    }
    const at = this.beside(s, side, kind === 'cabin' ? 2.2 : 6 + r() * 3);
    if (!at) return;
    const m = this.put(chunk, kind, at, facing(-side * Math.cos(p.a), -side * Math.sin(p.a)));
    if (m) this.glowAt(chunk, m);
  }

  private post(chunk: Chunk, s: number, r: () => number, text?: string, side = r() < 0.5 ? -1 : 1) {
    const at = this.beside(s, side, 1.6);
    if (!at) return;
    // turned to the river, and a little upstream, so you can read it coming
    const a = at.p.a;
    const m = this.put(chunk, 'sign', at, facing(-side * Math.cos(a) - Math.sin(a) * 0.8, -side * Math.sin(a) + Math.cos(a) * 0.8));
    if (!m) return;
    // the model's boxes have no UVs: the painted face is a plane just in front of the board
    const face = new THREE.Mesh(BOARD, signMaterial(text ?? (s >= 1000 ? `${(s / 1000).toFixed(s % 1000 ? 2 : 0)} km` : `${s} m`)));
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
   * Thick mixed forest down to the water on both banks: pines and broadleaves, ferns and bushes
   * underneath, mossy boulders, reeds at the edges of the slow pools and lily pads on them, and
   * crags along the tops of the gorges. And the places animals will be.
   */
  private banks(chunk: Chunk, s0: number, s1: number, r: () => number) {
    for (let s = s0; s < s1; s++) {
      const p = this.course.at(s);
      for (const side of [-1, 1]) {
        // trees: two rows of chances, the near one sparser so the water stays in view
        for (const [chance, e0, e1] of [[0.22, 1.6, 6], [0.75, 6, 34]] as const) {
          if (r() >= chance * (1 - p.gorge * 0.4)) continue;
          const e = e0 + p.gorge * 2.5 + r() * (e1 - e0);
          const at = this.beside(s, side, e);
          if (!at) continue;
          const pine = r() < 0.45 + p.gorge * 0.3 + Math.min(0.3, e / 100);
          const kind = pine ? `pine_${Math.floor(r() * 3)}` : r() < 0.15 ? `birch_${Math.floor(r() * 2)}` : `tree_${Math.floor(r() * 3)}`;
          this.put(chunk, kind, at, r() * Math.PI * 2, (0.85 + r() * 0.5) * (e < 6 ? 0.85 : 1));
        }
        // the undergrowth: ferns and bushes, thickest near the water
        if (r() < 0.32) {
          const at = this.beside(s, side, 0.6 + Math.pow(r(), 1.5) * 16);
          if (at) this.put(chunk, r() < 0.55 ? 'fern' : `bush_${Math.floor(r() * 2)}`, at, r() * 6.3, 0.8 + r() * 0.7);
        }
        // mossy boulders at the water's edge, and crags along the top of a gorge
        if (r() < 0.05 + p.rough * 0.05) {
          const at = this.beside(s, side, -0.4 + r() * 1.2);
          if (at) this.put(chunk, `rock_${Math.floor(r() * 5)}`, { ...at, y: Math.max(at.y - 0.3, p.y - 0.3) }, r() * 6.3, 0.9 + r() * 0.8);
        }
        if (r() < p.gorge * 0.2) {
          const at = this.beside(s, side, 2.2 + r() * 4);
          if (at) this.put(chunk, `crag_${Math.floor(r() * 2)}`, at, r() * 6.3, 0.6 + r() * 0.6);
        }
        // wildflowers in the clearings, toadstools and old stumps under the trees, a fallen trunk
        // gone green with moss, and somebody's cairn on a beach
        const open = 1 - p.gorge * 0.7;
        if (r() < 0.1 * open) {
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
        if (r() < 0.025 * p.clear * (0.3 + slow)) {
          const at = this.beside(s, side, 0.4 + r() * 1.2);
          if (at) this.put(chunk, 'willow', at, toRiver(side, p.a) + (r() - 0.5) * 0.6, 0.85 + r() * 0.3);
        }
        if (r() < p.clear * 0.07 * (0.4 + slow)) {
          const at = this.beside(s, side, -0.2 + r() * 0.8);
          if (at) this.put(chunk, `reeds_${Math.floor(r() * 2)}`, { ...at, y: Math.max(at.y, p.y) }, r() * 6.3);
        }
        if (r() < slow * p.clear * 0.06) {
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
        else if (p.gorge < 0.5 && pick < 0.16) add('deer', 0.8);
        else if (slow && pick < 0.24) add('fish', -p.width * 0.3);
      }
    }
  }
}

/**
 * The shape of the land `e` metres past the river's edge (negative: under the water), for the
 * character of the river at sample p. Far from the water it all settles into the same rolling
 * country, so neighbouring stretches meet without a seam.
 */
function shape(p: Sample, e: number, x: number, z: number, color?: THREE.Color) {
  const n = fbm(x, z);
  const { clear, gorge } = p;
  if (e < 0) {
    color?.copy(BED);
    return p.y - 0.45 - Math.min(1.4, -e * 0.35);
  }
  // a mossy bank, a pebbly beach by the pools, or a gorge's walls; and beyond, the valley's
  // sides climbing away into the mountains, lumpy with hills
  const far = smooth(4, 22, e);
  const valley = smooth(6, 60, e) * 16 + smooth(25, 70, e) * 10;
  const hills = (n - 0.5) * 4.5 * far + far * 1.2 + valley;
  const bank = p.y + 0.35 + smooth(0, 2.2, e) * 0.9 + hills;
  const beach = p.y + 0.06 + Math.min(0.6, e * 0.1) + hills * 0.85;
  const wall = p.y + 0.2 + smooth(0.2, 2.4, e) * (6 + n * 2.5) + hills;
  const soft = bank + (beach - bank) * smooth(0.4, 0.9, clear);
  const h = soft + (wall - soft) * gorge;

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
    // bare rock showing through high on the valley's sides
    if (e > 30 && n > 0.62) color.lerp(CLIFF[Math.floor(k * 4)], 0.7);
  }
  return h;
}

/**
 * An island, `e` metres in from its edge (negative: in the water beside it), where the rest of the
 * river would have `h`: shelving up out of the water to a pebbly shore, then moss and forest floor
 * on a wooded island; a gravel bar only just clears the water.
 */
function island(p: Sample, kind: Split['kind'], e: number, h: number, x: number, z: number, color?: THREE.Color) {
  if (e < 0) return Math.max(h, p.y - 0.4 - Math.min(1.4, -e * 0.45));
  const n = fbm(x, z);
  const k = hash2(Math.floor(x), Math.floor(z));
  if (kind === 'bar') {
    color?.copy(e < 0.4 ? WET : PEBBLES[Math.floor(k * 3)]).lerp(SAND[1], p.clear * 0.3 * k);
    return p.y + 0.14 + Math.min(0.22, e * 0.1) + (n - 0.5) * 0.08;
  }
  if (color) {
    if (e < 0.25) color.copy(WET);
    else if (e < 1.4 || p.isle < 2) color.copy(PEBBLES[Math.floor(k * 3)]);
    else color.copy(e < 2.6 ? MOSS[Math.max(0, Math.min(4, Math.floor(n * 4.99)))] : FOREST_FLOOR[Math.max(0, Math.min(3, Math.floor(n * 3.99 + (k - 0.5))))]);
  }
  return p.y + 0.2 + smooth(0.3, 2.2, e) * 0.9 + smooth(1.5, 4, e) * (n - 0.3) * 1.2;
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
function signMaterial(text: string) {
  let mat = signs.get(text);
  if (mat) return mat;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b27a48';
  g.fillRect(0, 0, 64, 32);
  g.fillStyle = '#8a5a36';
  g.fillRect(0, 26, 64, 6);
  g.fillStyle = '#2a1a12';
  g.font = 'bold 15px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 32, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  mat = new THREE.MeshToonMaterial({ map: tex });
  signs.set(text, mat);
  return mat;
}
