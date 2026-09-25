import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { type BookInfo, hash, spineColor } from '../../data/subjects';
import { ICONS } from './life';
import { Particles } from './particles';
import { Picker } from './picking';
import { haloTexture } from './sky';
import { GRADIENT } from './toon';

const ELEVATION = THREE.MathUtils.degToRad(35); // the same angle as the island camera
const YAW = THREE.MathUtils.degToRad(-22); // looking in from the south-east
const DISTANCE = 60;
/** Every row starts with room for its year plate; the books stand to the right of it. */
const PLATE_SPACE = 0.62;
const GOLD = new THREE.Color('#e8b24a');
const DUSK = new THREE.Color('#1b1422');
const SKY_DAY = new THREE.Color('#a9dcff');
const SKY_NIGHT = new THREE.Color('#1c2852');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A seeded random stream, so the shelves are dressed the same way on every visit. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mats = new Map<string, THREE.MeshToonMaterial>();
/** Toon materials for indoors: no snow, and glowing things stay lit whatever the hour. */
export function toonIndoors(color: THREE.ColorRepresentation, glow = false) {
  const c = new THREE.Color(color);
  const key = `${c.getHexString()}:${glow ? 1 : 0}`;
  let mat = mats.get(key);
  if (!mat) {
    mat = new THREE.MeshToonMaterial({ color: c, gradientMap: GRADIENT });
    if (glow) {
      mat.emissive = c.clone();
      mat.emissiveIntensity = 1;
    }
    mats.set(key, mat);
  }
  return mat;
}

function box(w: number, h: number, d: number, mat: THREE.Material, at = V()) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.copy(at);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

interface Row {
  index: number; // 0 = the top shelf
  origin: THREE.Vector3; // front-left corner of the shelf board, world space
  width: number;
  depth: number;
  clear: number; // height up to the next board
}

interface Book {
  info: BookInfo;
  group: THREE.Group;
  home: THREE.Vector3;
  cover: THREE.MeshToonMaterial;
  trim: THREE.MeshToonMaterial;
  color: THREE.Color;
  out: number;
}

interface Lamp {
  light: THREE.PointLight;
  halo?: THREE.Sprite;
  base: number;
  flicker: number;
  seed: number;
}

interface Floater {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  age: number;
}

/**
 * The library, inside (tools/models/interior.py): a cutaway room lit by the hearth, with one
 * shelf per year of posts. The books are made here from the posts, so a new post gets a new
 * book without touching Blender. It has its own scene and a fixed camera; the island hands the
 * renderer over when you step through the door.
 */
export class Interior {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2);
  readonly picker: Picker;
  /** Things with an id (the piano, the door…), for highlighting. */
  readonly named = new Map<string, THREE.Object3D>();
  /** Where each row's year plate goes; the page pins an HTML label on each. */
  readonly plates: { label: string; year: number; at: THREE.Vector3 }[] = [];
  /** Whether the piano is playing (the lid opens and notes rise). */
  playing = false;

  private root: THREE.Group;
  private bounds = new THREE.Box3();
  private books = new Map<string, Book>();
  private hot: string | null = null;
  private matches: Set<string> | null = null;
  private lamps: Lamp[] = [];
  private flames: THREE.Object3D[] = [];
  private lid?: THREE.Object3D;
  private lidOpen = 0;
  private globe?: THREE.Object3D;
  private spin = 0;
  private glass = new THREE.MeshBasicMaterial({ color: SKY_DAY.clone() });
  private hemi = new THREE.HemisphereLight('#c9b3d6', '#4a3226', 1.2);
  private key = new THREE.DirectionalLight('#ffe9cc', 1);
  private beam?: THREE.Mesh;
  private patch?: THREE.Mesh;
  private particles = new Particles(400);
  private floaters: Floater[] = [];
  private clock = 0;
  private timers = new Map<string, number>();
  private hearth = V();
  private pianoTop = V();
  private beamFrom = V();
  private beamFall = (y: number) => y;

  static async load(books: BookInfo[], base = '/models/'): Promise<Interior> {
    const gltf = await new GLTFLoader().loadAsync(`${base}library.glb`);
    return new Interior(gltf.scene, books);
  }

  private constructor(root: THREE.Group, books: BookInfo[]) {
    this.root = root;
    this.scene.add(root);
    this.scene.background = new THREE.Color('#15111c');
    root.updateMatrixWorld(true);

    const rows: Row[] = [];
    const named: THREE.Object3D[] = [];
    let sunbeam: THREE.Vector3 | undefined;
    const halo = haloTexture();
    root.traverse((o) => {
      const x = o.userData;
      if (x.id) {
        named.push(o);
        this.named.set(x.id, o);
      }
      if (x.shelf !== undefined) {
        rows.push({ index: x.shelf, origin: o.getWorldPosition(V()), width: x.width, depth: x.depth, clear: x.clear });
      }
      if (x.sunbeam) sunbeam = o.getWorldPosition(V());
      if (x.light) this.addLamp(o.getWorldPosition(V()), x, halo);
      if (o.name.startsWith('flame')) this.flames.push(o);
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glass = o.name.startsWith('window_glass') || o.parent?.name.startsWith('window_glass');
        mesh.material = glass ? this.glass : toonIndoors(src.color, src.name.startsWith('glow_'));
        mesh.castShadow = !glass && !src.name.startsWith('glow_');
        mesh.receiveShadow = true;
      }
    });
    this.lid = root.getObjectByName('piano_lid');
    this.globe = root.getObjectByName('globe_ball');
    const room = root.getObjectByName('room');
    if (room) this.bounds.setFromObject(room);
    root.getObjectByName('fireplace')?.getWorldPosition(this.hearth);
    this.hearth.add(V(0.75, 0.9, -0.7));
    const piano = root.getObjectByName('piano_body');
    if (piano) this.pianoTop.copy(new THREE.Box3().setFromObject(piano).getCenter(V())).setY(2.1);

    // light from the open side of the dollhouse, as if someone held a lamp up to it
    this.key.position.set(9, 16, 11);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.key, this.key.target, this.particles.points);
    if (sunbeam) this.addSunbeam(sunbeam);

    this.shelve(rows, books);
    this.picker = new Picker(this.camera);
    this.picker.add(...named, ...[...this.books.values()].map((b) => b.group));
  }

  // --- what the page asks of it ----------------------------------------------------

  /**
   * Fit the room into the part of the canvas that isn't under a panel. `free` is in CSS pixels
   * relative to the canvas.
   */
  frame(width: number, height: number, free: { x: number; y: number; w: number; h: number }) {
    const cam = this.camera;
    const centre = this.bounds.getCenter(V());
    const dir = V(-Math.sin(YAW) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(YAW) * Math.cos(ELEVATION));
    cam.position.copy(centre).addScaledVector(dir, DISTANCE);
    cam.lookAt(centre);
    cam.updateMatrixWorld();

    const box = new THREE.Box2();
    const { min, max } = this.bounds;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      const p = V(x, y, z).applyMatrix4(cam.matrixWorldInverse);
      box.expandByPoint(new THREE.Vector2(p.x, p.y));
    }
    const size = box.getSize(new THREE.Vector2());
    const mid = box.getCenter(new THREE.Vector2());
    const perPx = Math.max(size.x / free.w, size.y / free.h) * 1.04;
    const fx = free.x + free.w / 2 - width / 2;
    const fy = free.y + free.h / 2 - height / 2;
    const right = V().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = V().setFromMatrixColumn(cam.matrixWorld, 1);
    cam.position.addScaledVector(right, mid.x - fx * perPx).addScaledVector(up, mid.y + fy * perPx);
    const h = (perPx * height) / 2;
    Object.assign(cam, { left: -h * (width / height), right: h * (width / height), top: h, bottom: -h });
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** Where a world point lands on the canvas, in CSS pixels. */
  project(p: THREE.Vector3, width: number, height: number) {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  }

  /** The book being pointed at (here or in the catalogue) slides out and catches the light. */
  setHot(slug: string | null) {
    this.hot = slug;
  }

  /** Books that match the catalogue's filter stand out; the rest fall into shadow. */
  setFilter(slugs: Set<string> | null) {
    this.matches = slugs;
    for (const b of this.books.values()) {
      const dim = slugs && !slugs.has(b.info.slug) ? 0.85 : 0;
      b.cover.color.copy(b.color).lerp(DUSK, dim);
      b.trim.color.copy(GOLD).lerp(DUSK, dim);
    }
  }

  spinGlobe() {
    this.spin = 9;
  }

  sparks() {
    for (let i = 0; i < 24; i++) {
      this.particles.emit({
        position: this.hearth.clone().add(V(rand(-0.2, 0.2), rand(-0.4, 0), rand(-0.4, 0.4))),
        velocity: V(rand(0.2, 1.2), rand(1, 2.6), rand(-0.6, 0.6)),
        color: Math.random() < 0.5 ? '#ffd070' : '#ff9a3c',
        life: rand(0.5, 1.2),
        gravity: -1.5,
        size: 1,
      });
    }
  }

  update(dt: number, night: number) {
    this.clock += dt;
    const t = this.clock;

    for (const [i, f] of this.flames.entries()) {
      f.scale.set(1, 0.8 + Math.sin(t * (9 + i * 3) + i) * 0.15 + Math.sin(t * 23 + i) * 0.08, 1);
    }
    for (const l of this.lamps) {
      const f = l.flicker ? 1 - l.flicker * 0.25 * (Math.sin(t * 13 + l.seed) * 0.5 + Math.sin(t * 7.7 + l.seed * 3) * 0.5 + 0.5) : 1;
      l.light.intensity = l.base * (0.75 + night * 0.25) * f;
      if (l.halo) (l.halo.material as THREE.SpriteMaterial).opacity = (0.35 + night * 0.35) * f;
    }

    // the day outside: sky in the window, a slanting sunbeam, dust turning in it
    const day = 1 - night;
    this.glass.color.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    this.hemi.intensity = 0.9 + day * 0.5;
    this.key.intensity = 0.35 + day * 0.75;
    this.key.color.set(day > 0.5 ? '#ffe9cc' : '#aab8ff');
    if (this.beam && this.patch) {
      (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.09 * day;
      (this.patch.material as THREE.MeshBasicMaterial).opacity = 0.14 * day;
      this.beam.visible = this.patch.visible = day > 0.05;
      if (day > 0.3 && this.every('dust', 0.25, dt)) this.dust();
    }
    if (this.every('ember', 0.5, dt)) {
      this.particles.emit({
        position: this.hearth.clone().add(V(rand(-0.1, 0.1), rand(-0.3, 0), rand(-0.4, 0.4))),
        velocity: V(rand(0, 0.3), rand(0.8, 1.4), rand(-0.1, 0.1)),
        color: '#ffb050', life: rand(0.4, 0.8), wobble: 0.3,
      });
    }

    // the piano opens its lid while it plays, and notes drift up from it
    this.lidOpen = THREE.MathUtils.damp(this.lidOpen, this.playing ? 1 : 0, 4, dt);
    if (this.lid) this.lid.rotation.x = -1.72 * this.lidOpen;
    if (this.playing && this.every('note', 0.8, dt)) this.note();

    this.spin = THREE.MathUtils.damp(this.spin, 0, 1.2, dt);
    if (this.globe) this.globe.rotation.y += dt * (0.15 + this.spin);

    for (const b of this.books.values()) {
      const goal = b.info.slug === this.hot ? 1 : this.matches?.has(b.info.slug) ? 0.4 : 0;
      b.out = THREE.MathUtils.damp(b.out, goal, 12, dt);
      b.group.position.set(b.home.x, b.home.y + b.out * 0.03, b.home.z + b.out * 0.24);
      const lit = b.info.slug === this.hot ? 0.45 : this.matches?.has(b.info.slug) ? 0.25 : 0;
      b.cover.emissive.copy(b.color).multiplyScalar(lit);
    }

    this.particles.update(dt);
    this.updateFloaters(dt);
  }

  // --- building ----------------------------------------------------------------------

  /** One year per row, newest at the top; if there are more years than rows the oldest share the bottom one. */
  private shelve(rows: Row[], books: BookInfo[]) {
    rows.sort((a, b) => a.index - b.index);
    const yearOf = (b: BookInfo) => Number(b.date.slice(0, 4));
    const years = [...new Set(books.map(yearOf))].sort((a, b) => b - a);
    rows.forEach((row, i) => {
      const rng = seeded(1000 + row.index);
      const ys = i < rows.length - 1 ? years.slice(i, i + 1) : years.slice(i);
      if (!ys.length) {
        this.dress(row, 0.1, rng, true);
        return;
      }
      const label = ys.length > 1 ? `${ys[ys.length - 1]}–${ys[0]}` : String(ys[0]);
      this.plates.push({ label, year: ys[0], at: row.origin.clone().add(V(PLATE_SPACE / 2 - 0.04, row.clear * 0.42, -0.08)) });

      // each book stands at its month: January at the left of the shelf, December at the right
      const onRow = books.filter((b) => ys.includes(yearOf(b))).sort((a, b) => a.date.localeCompare(b.date));
      const span = row.width - PLATE_SPACE - 0.5;
      let x = PLATE_SPACE;
      let prev = PLATE_SPACE;
      for (const info of onRow) {
        const h = hash(info.slug);
        const w = 0.26 + (h % 4) * 0.04;
        const height = row.clear * (0.74 + ((h >> 3) % 4) * 0.05);
        const d = row.depth * (0.8 + ((h >> 6) % 3) * 0.06);
        const day = (Number(info.date.slice(5, 7)) - 1) * 30.5 + Number(info.date.slice(8, 10));
        const at = Math.max(x, Math.min(PLATE_SPACE + (day / 366) * span, row.width - 0.5 - w));
        this.tomes(row, prev, at - 0.04, rng);
        this.addBook(info, w, height, d, row.origin.clone().add(V(at + w / 2, height / 2, -0.05 - d / 2)));
        x = at + w + 0.02;
        prev = x + 0.02;
      }
      this.dress(row, prev, rng, false);
    });
  }

  private addBook(info: BookInfo, w: number, h: number, d: number, home: THREE.Vector3) {
    const color = new THREE.Color(spineColor(info.slug, info.subject));
    const cover = new THREE.MeshToonMaterial({ color: color.clone(), gradientMap: GRADIENT });
    const trim = new THREE.MeshToonMaterial({ color: GOLD.clone(), gradientMap: GRADIENT });
    const group = new THREE.Group();
    group.add(box(w, h, d, cover));
    for (const y of [h / 2 - 0.05, -h / 2 + 0.06]) group.add(box(w + 0.006, 0.024, 0.012, trim, V(0, y, d / 2)));
    if (hash(info.slug) % 3 !== 0) group.add(box(w * 0.55, 0.08, 0.012, trim, V(0, h * 0.14, d / 2)));
    group.position.copy(home);
    group.userData.id = `book:${info.slug}`;
    this.root.add(group);
    this.books.set(info.slug, { info, group, home, cover, trim, color, out: 0 });
  }

  /** Old, unlabelled tomes filling some of the gap between two posts (they aren't posts). */
  private tomes(row: Row, from: number, to: number, rng: () => number) {
    const colors = ['#2e2420', '#2a2530', '#35291f', '#212a2a', '#3a2226', '#2c2a22'];
    let x = from + 0.05 + rng() * 0.3;
    const end = to - 0.05 - rng() * 0.3;
    const g = new THREE.Group();
    while (x < end - 0.14) {
      if (rng() < 0.18) {
        x += 0.2 + rng() * 0.3; // a gap
        continue;
      }
      const w = Math.min(0.1 + rng() * 0.1, end - x);
      const h = row.clear * (0.45 + rng() * 0.2);
      const b = box(w, h, row.depth * 0.75, toonIndoors(colors[Math.floor(rng() * colors.length)]), row.origin.clone().add(V(x + w / 2, h / 2, -row.depth * 0.45)));
      if (rng() < 0.12) b.rotation.z = -0.12; // leaning on its neighbour
      g.add(b);
      x += w + 0.008;
    }
    g.traverse((o) => (o.raycast = () => {}));
    this.root.add(g);
  }

  /** The rest of a row: a bookend, and whatever collects on library shelves. */
  private dress(row: Row, from: number, rng: () => number, spare: boolean) {
    const at = (x: number, y: number, z = -row.depth / 2) => row.origin.clone().add(V(x, y, z));
    const g = new THREE.Group();
    const brass = toonIndoors('#c9a23f');
    let x = from + 0.02;
    if (!spare) {
      g.add(box(0.04, 0.26, 0.24, brass, at(x + 0.02, 0.13)));
      g.add(box(0.16, 0.02, 0.24, brass, at(x + 0.08, 0.01)));
      x += 0.3;
    }
    const tomes = ['#4a3b35', '#3b3444', '#5a4a3a', '#2e3a3a', '#553038', '#3f4a36'];
    const end = row.width - 0.1;
    const items = spare ? 3 : 1 + Math.floor(rng() * 2);
    for (let k = 0; k < items && x < end - 0.4; k++) {
      x += 0.15 + rng() * Math.max(0, (end - x) / (items - k) - 0.5);
      const kind = spare && k === 0 ? 0 : Math.floor(rng() * 5);
      if (kind === 0) {
        // a run of old, unlabelled tomes
        const n = 3 + Math.floor(rng() * 5);
        for (let i = 0; i < n && x < end - 0.2; i++) {
          const w = 0.14 + rng() * 0.14;
          const h = row.clear * (0.5 + rng() * 0.3);
          g.add(box(w, h, row.depth * 0.8, toonIndoors(tomes[Math.floor(rng() * tomes.length)]), at(x + w / 2, h / 2)));
          x += w + 0.01;
        }
      } else if (kind === 1) {
        // a stack lying flat
        for (let i = 0; i < 3; i++) {
          const b = box(0.46 - i * 0.05, 0.08, 0.32, toonIndoors(tomes[(i + k) % tomes.length]), at(x + 0.24, 0.04 + i * 0.08));
          b.rotation.y = (rng() - 0.5) * 0.4;
          g.add(b);
        }
        x += 0.5;
      } else if (kind === 2) {
        // a little potted plant
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.16, 6), toonIndoors('#b0512f'));
        pot.position.copy(at(x + 0.1, 0.08));
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), toonIndoors('#3f8043'));
        leaves.position.copy(at(x + 0.1, 0.27));
        g.add(pot, leaves);
        x += 0.3;
      } else if (kind === 3) {
        // an hourglass
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.13, 6), toonIndoors('#dcbd83'));
        top.position.copy(at(x + 0.08, 0.2));
        top.rotation.x = Math.PI;
        const bottom = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.13, 6), toonIndoors('#dcbd83'));
        bottom.position.copy(at(x + 0.08, 0.08));
        g.add(top, bottom, box(0.18, 0.02, 0.18, brass, at(x + 0.08, 0.01)), box(0.18, 0.02, 0.18, brass, at(x + 0.08, 0.28)));
        x += 0.25;
      } else {
        // a stub of candle
        g.add(box(0.1, 0.03, 0.1, brass, at(x + 0.06, 0.015)));
        g.add(box(0.05, 0.14, 0.05, toonIndoors('#f2ece2'), at(x + 0.06, 0.1)));
        g.add(box(0.03, 0.05, 0.03, toonIndoors('#ffd070', true), at(x + 0.06, 0.2)));
        x += 0.2;
      }
    }
    g.traverse((o) => (o.raycast = () => {}));
    this.root.add(g);
  }

  private addLamp(position: THREE.Vector3, x: Record<string, number | string>, halo: THREE.Texture) {
    const radius = Number(x.radius);
    const light = new THREE.PointLight(new THREE.Color(String(x.color)), 0, radius * 1.8, 1.4);
    light.position.copy(position);
    this.scene.add(light);
    this.lamps.push({ light, base: Number(x.intensity) * 7, flicker: Number(x.flicker), seed: Math.random() * 100 });
    if (x.halo === 0) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: halo, color: new THREE.Color(String(x.color)), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    sprite.position.copy(position);
    sprite.scale.setScalar(radius * 0.22);
    sprite.renderOrder = 2;
    sprite.raycast = () => {};
    this.scene.add(sprite);
    this.lamps[this.lamps.length - 1].halo = sprite;
  }

  /** A pale shaft of daylight from the window down to a warm patch on the floor. */
  private addSunbeam(window: THREE.Vector3) {
    const top = window.y + 1.3;
    const bottom = window.y - 1.3;
    const fall = (y: number) => window.z + 0.1 + y * 1.1; // where the light from height y lands
    const geo = new THREE.BufferGeometry();
    const w = 0.9;
    const shift = -0.5;
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      window.x - w, top, window.z + 0.05, window.x + w, top, window.z + 0.05, window.x + w + shift, 0.03, fall(top),
      window.x - w, top, window.z + 0.05, window.x + w + shift, 0.03, fall(top), window.x - w + shift, 0.03, fall(top),
    ], 3));
    const mat = () => new THREE.MeshBasicMaterial({ color: '#fff0c4', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(geo, mat());
    this.beam.renderOrder = 3;
    this.beam.raycast = () => {};
    const patch = new THREE.PlaneGeometry(w * 2, fall(top) - fall(bottom)).rotateX(-Math.PI / 2);
    this.patch = new THREE.Mesh(patch, mat());
    this.patch.position.set(window.x + shift, 0.02, (fall(top) + fall(bottom)) / 2);
    this.patch.renderOrder = 3;
    this.patch.raycast = () => {};
    this.scene.add(this.beam, this.patch);
    this.beamFrom = window.clone();
    this.beamFall = fall;
  }

  private dust() {
    const y = rand(0.4, this.beamFrom.y + 1);
    const z = THREE.MathUtils.lerp(this.beamFrom.z, this.beamFall(this.beamFrom.y + 1.3), 1 - y / (this.beamFrom.y + 1.3));
    this.particles.emit({
      position: V(this.beamFrom.x + rand(-0.9, 0.6), y, z + rand(-0.3, 0.3)),
      velocity: V(rand(-0.05, 0.05), rand(-0.03, 0.05), rand(-0.05, 0.05)),
      color: '#fff3d0', life: rand(3, 6), wobble: 0.15,
    });
  }

  private note() {
    const tex = ICONS.note;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const img = tex.image as HTMLCanvasElement;
    sprite.scale.set(img.width * 0.045, img.height * 0.045, 1);
    sprite.position.copy(this.pianoTop).add(V(rand(-0.6, 0.6), 0, rand(-0.1, 0.2)));
    sprite.renderOrder = 5;
    sprite.raycast = () => {};
    this.scene.add(sprite);
    this.floaters.push({ sprite, velocity: V(rand(-0.15, 0.15), rand(0.35, 0.55), rand(0, 0.1)), age: 0 });
  }

  private updateFloaters(dt: number) {
    this.floaters = this.floaters.filter((f) => {
      f.age += dt;
      f.sprite.position.addScaledVector(f.velocity, dt);
      f.sprite.position.x += Math.sin(f.age * 3 + f.velocity.x * 20) * dt * 0.1;
      f.sprite.material.opacity = 1 - Math.max(0, f.age / 2.6 - 0.6) / 0.4;
      if (f.age < 2.6) return true;
      this.scene.remove(f.sprite);
      f.sprite.material.dispose();
      return false;
    });
  }

  private every(key: string, seconds: number, dt: number) {
    const left = (this.timers.get(key) ?? Math.random() * seconds) - dt;
    this.timers.set(key, left <= 0 ? left + seconds : left);
    return left <= 0;
  }
}
