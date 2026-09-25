import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOOKS } from '../../data/books';
import { hash } from '../../data/subjects';
import { toonIndoors } from './interior';
import { Particles } from './particles';
import { Picker } from './picking';
import { RoomCamera } from './room-camera';
import { haloTexture } from './sky';
import { GRADIENT } from './toon';

const SKY_DAY = new THREE.Color('#a9dcff');
const SKY_NIGHT = new THREE.Color('#1c2852');
const GOLD = new THREE.Color('#e8b24a');
/** Cloth and paper colours for the spines: muted, like a real shelf, not a paint chart. */
const SPINES = ['#7a2c3a', '#2f5d8c', '#3d6a4a', '#b5562d', '#4a3b5a', '#c9a23f', '#2e4a4a', '#8c5a3a', '#5a2a3a', '#e6d4b8', '#23384f', '#6b7a3a'];

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Row {
  index: number; // 0 = the top shelf
  origin: THREE.Vector3; // front-left corner of the shelf board, world space
  width: number;
  depth: number;
  clear: number;
}

interface Spine {
  group: THREE.Group;
  home: THREE.Vector3;
  cover: THREE.MeshToonMaterial;
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

/**
 * The lighthouse, inside (tools/models/quarters.py): the keeper's quarters. A stair winding up
 * to the lamp, a telly with a console that plays Vincent's own game, his favourite games on a
 * shelf above it, a kitchen with the coffee on, and a bookcase holding everything he's read
 * (src/data/reading.json, from his Goodreads shelf), newest at the top.
 */
export class QuartersRoom {
  readonly scene = new THREE.Scene();
  readonly picker: Picker;
  /** Things with an id, for highlighting. */
  readonly named = new Map<string, THREE.Object3D>();

  private bounds = new THREE.Box3();
  /** Frames the room; you can zoom and look around it. */
  readonly view = new RoomCamera(this.bounds);
  private spines = new Map<string, Spine>();
  private hot: string | null = null;
  private lamps: Lamp[] = [];
  private glass = new THREE.MeshBasicMaterial({ color: SKY_DAY.clone() });
  private hemi = new THREE.HemisphereLight('#d6d0e6', '#4a3226', 1.25);
  private key = new THREE.DirectionalLight('#ffe9cc', 1);
  private particles = new Particles(300);
  private steam: THREE.Vector3[] = [];
  private screen?: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; next: number };
  private clock = 0;
  private timers = new Map<string, number>();

  static async load(base = '/models/'): Promise<QuartersRoom> {
    const gltf = await new GLTFLoader().loadAsync(`${base}lighthouse.glb`);
    return new QuartersRoom(gltf.scene);
  }

  private constructor(root: THREE.Group) {
    this.scene.add(root);
    this.scene.background = new THREE.Color('#15111c');
    root.updateMatrixWorld(true);

    const rows: Row[] = [];
    const halo = haloTexture();
    let screen: THREE.Mesh | undefined;
    root.traverse((o) => {
      const x = o.userData;
      if (x.id) this.named.set(x.id, o);
      if (x.shelf !== undefined) {
        rows.push({ index: x.shelf, origin: o.getWorldPosition(V()), width: x.width, depth: x.depth, clear: x.clear });
      }
      if (x.emit === 'steam') this.steam.push(o.getWorldPosition(V()));
      if (x.light) this.addLamp(o.getWorldPosition(V()), x, halo);
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glass = o.name.startsWith('window_glass') || o.parent?.name.startsWith('window_glass');
        if (o.name.startsWith('tv_screen') || o.parent?.name.startsWith('tv_screen')) screen = mesh;
        const glow = src.name.startsWith('glow_');
        mesh.material = glass ? this.glass : toonIndoors(src.color, glow);
        mesh.castShadow = !glass && !glow;
        mesh.receiveShadow = true;
      }
    });
    const room = root.getObjectByName('room');
    if (room) this.bounds.setFromObject(room);
    if (screen) this.tv(screen);

    this.key.position.set(9, 16, 11);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.key, this.key.target, this.particles.points);

    this.shelve(root, rows);
    this.picker = new Picker(this.camera);
    this.picker.add(...this.named.values(), ...[...this.spines.values()].map((s) => s.group));
  }

  get camera() {
    return this.view.camera;
  }

  frame(width: number, height: number, free: { x: number; y: number; w: number; h: number }) {
    this.view.frame(width, height, free);
  }

  /** The book being pointed at slides out and catches the light ("read:<index>", or null). */
  setHot(id: string | null) {
    this.hot = id;
  }

  update(dt: number, night: number) {
    this.clock += dt;
    const t = this.clock;
    for (const l of this.lamps) {
      const f = l.flicker ? 1 - l.flicker * 0.25 * (Math.sin(t * 13 + l.seed) * 0.5 + Math.sin(t * 7.7 + l.seed * 3) * 0.5 + 0.5) : 1;
      l.light.intensity = l.base * (0.75 + night * 0.25) * f;
      if (l.halo) (l.halo.material as THREE.SpriteMaterial).opacity = (0.35 + night * 0.35) * f;
    }
    const day = 1 - night;
    this.glass.color.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    this.hemi.intensity = 0.9 + day * 0.5;
    this.key.intensity = 0.35 + day * 0.75;
    this.key.color.set(day > 0.5 ? '#ffe9cc' : '#aab8ff');

    // the coffee steams while it's still hot, which is to say during the day
    for (const [i, at] of this.steam.entries()) {
      if (day > 0.3 && this.every(`steam${i}`, 0.35, dt)) {
        this.particles.emit({
          position: at.clone().add(V(rand(-0.03, 0.03), 0, rand(-0.03, 0.03))),
          velocity: V(rand(-0.03, 0.03), rand(0.18, 0.3), rand(-0.03, 0.03)),
          color: '#f4efe6', life: rand(1.6, 2.4), wobble: 0.12, size: 1,
        });
      }
    }
    this.drawScreen();

    for (const [id, s] of this.spines) {
      s.out = THREE.MathUtils.damp(s.out, id === this.hot ? 1 : 0, 12, dt);
      s.group.position.set(s.home.x, s.home.y + s.out * 0.02, s.home.z + s.out * 0.16);
      s.cover.emissive.copy(s.color).multiplyScalar(id === this.hot ? 0.45 : 0);
    }
    this.particles.update(dt);
  }

  // --- the telly -------------------------------------------------------------------------

  /** A little attract screen: a road into the distance, the white lines rushing past. */
  private tv(mesh: THREE.Mesh) {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 36;
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    // the screen box faces +x: map the canvas across it, not round it
    const geo = mesh.geometry.clone();
    const pos = geo.getAttribute('position');
    const box = new THREE.Box3().setFromBufferAttribute(pos as THREE.BufferAttribute);
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = 1 - (pos.getZ(i) - box.min.z) / (box.max.z - box.min.z || 1);
      uv[i * 2 + 1] = (pos.getY(i) - box.min.y) / (box.max.y - box.min.y || 1);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mesh.geometry = geo;
    mesh.material = new THREE.MeshBasicMaterial({ map: texture });
    this.screen = { canvas, texture, next: 0 };
  }

  private drawScreen() {
    const s = this.screen;
    if (!s || this.clock < s.next) return;
    s.next = this.clock + 1 / 12; // a jerky twelve frames a second, like it should be
    const ctx = s.canvas.getContext('2d')!;
    const { width: w, height: h } = s.canvas;
    const horizon = 13;
    ctx.fillStyle = '#7fc8f0';
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = '#4a8a45';
    ctx.fillRect(0, horizon, w, h - horizon);
    // a few city blocks on the horizon (it is Arnhem, after all)
    ctx.fillStyle = '#6a6275';
    for (const [x, bh] of [[2, 5], [7, 8], [12, 4], [33, 6], [38, 9], [43, 5]]) ctx.fillRect(x, horizon - bh, 4, bh);
    ctx.fillStyle = '#e8b24a';
    ctx.fillRect(24, horizon - 11, 1, 11); // the Eusebius tower, more or less
    for (let y = horizon; y < h; y++) {
      const k = (y - horizon) / (h - horizon);
      const half = 2 + k * 20;
      ctx.fillStyle = '#3b3a42';
      ctx.fillRect(Math.round(w / 2 - half), y, Math.round(half * 2), 1);
      // dashes rush towards you: their phase runs on 1/depth
      if (Math.floor(1 / (k + 0.08) * 2 - this.clock * 6) % 2 === 0) {
        ctx.fillStyle = '#f2ece2';
        ctx.fillRect(Math.round(w / 2 - Math.max(0.5, k * 1.2)), y, Math.max(1, Math.round(k * 2.4)), 1);
      }
    }
    // the car, bouncing gently
    const bob = Math.round(Math.sin(this.clock * 9));
    ctx.fillStyle = '#c8403a';
    ctx.fillRect(20, 27 + bob, 8, 4);
    ctx.fillRect(22, 25 + bob, 4, 2);
    ctx.fillStyle = '#1d1a24';
    ctx.fillRect(20, 31 + bob, 2, 1);
    ctx.fillRect(26, 31 + bob, 2, 1);
    if (Math.floor(this.clock * 1.5) % 2 === 0) {
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(15, 2, 18, 1); // "press start"
    }
    s.texture.needsUpdate = true;
  }

  // --- the bookcase --------------------------------------------------------------------

  /** Everything he's read, newest at the top left, spines in cloth colours, five-star books banded in gold. */
  private shelve(root: THREE.Object3D, rows: Row[]) {
    rows.sort((a, b) => a.index - b.index);
    let r = 0;
    let x = 0.04;
    BOOKS.forEach((book, i) => {
      const h0 = hash(`${book.title}|${book.author}`);
      const w = 0.075 + (h0 % 5) * 0.012;
      if (r < rows.length && x + w > rows[r].width) {
        r++;
        x = 0.04;
      }
      const row = rows[r];
      if (!row) return; // more books than shelf: the oldest wait in a box somewhere
      const height = row.clear * (0.72 + ((h0 >> 4) % 5) * 0.05);
      const d = row.depth * (0.78 + ((h0 >> 8) % 3) * 0.07);
      const color = new THREE.Color(SPINES[(h0 >> 11) % SPINES.length]);
      const cover = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT });
      const group = new THREE.Group();
      const spine = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), cover);
      spine.castShadow = spine.receiveShadow = true;
      group.add(spine);
      if (book.stars === 5) {
        const gold = toonIndoors(GOLD);
        for (const y of [height / 2 - 0.05, -height / 2 + 0.05]) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 0.02, 0.01), gold);
          band.position.set(0, y, d / 2);
          group.add(band);
        }
      }
      const home = row.origin.clone().add(V(x + w / 2, height / 2, -0.04 - d / 2));
      group.position.copy(home);
      group.rotation.z = (h0 >> 14) % 9 === 0 ? -0.05 : 0; // the odd one leaning
      const id = `read:${i}`;
      group.userData.id = id;
      root.add(group);
      this.spines.set(id, { group, home, cover, color: color.clone(), out: 0 });
      x += w + 0.006;
    });
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

  private every(key: string, seconds: number, dt: number) {
    const left = (this.timers.get(key) ?? Math.random() * seconds) - dt;
    this.timers.set(key, left <= 0 ? left + seconds : left);
    return left <= 0;
  }
}
