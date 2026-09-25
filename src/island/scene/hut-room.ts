import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toonIndoors } from './interior';
import { Particles } from './particles';
import { Picker } from './picking';
import { RoomCamera } from './room-camera';
import { Guests } from './guests';
import { haloTexture } from './sky';
import { type Outside, Windows } from './windows';

const SKY_DAY = new THREE.Color('#a9dcff');
const SKY_NIGHT = new THREE.Color('#1c2852');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Whether an object and everything it hangs from is showing. */
const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Lamp {
  light: THREE.PointLight;
  halo?: THREE.Sprite;
  base: number;
  flicker: number;
  seed: number;
}

/**
 * The mountain hut, inside (tools/models/hut.py): one pine room under the gable. The stove is
 * lit, with the kettle and the soup steaming on it, the long table is laid, and Vincent's bed is
 * made up in the corner with a candle burning beside it.
 */
export class HutRoom {
  readonly scene = new THREE.Scene();
  readonly picker: Picker;
  /** Things with an id, for highlighting. */
  readonly named = new Map<string, THREE.Object3D>();

  private bounds = new THREE.Box3();
  /** Frames the room; you can zoom and look around it. */
  readonly view = new RoomCamera(this.bounds);
  private lamps: Lamp[] = [];
  private glass = new THREE.MeshBasicMaterial({ color: SKY_DAY.clone() });
  private hemi = new THREE.HemisphereLight('#e0d6e6', '#4a3226', 1.2);
  private key = new THREE.DirectionalLight('#ffe9cc', 1);
  private particles = new Particles(200);
  /** Where steam rises, and the thing it rises from (the pie only steams while she's here). */
  private steam: { at: THREE.Vector3; from: THREE.Object3D }[] = [];
  private clock = 0;
  /** Who's in out of the rain (shelter.ts): shown only while they're indoors. */
  readonly guests: Guests;
  /** Rain on the glass and lightning in the panes. */
  private windows: Windows;
  private timers = new Map<string, number>();
  /** Her page in bed: how far over (0..1), and how long until she turns the next. */
  private page = { t: 0, next: rand(4, 9) };

  static async load(base = '/models/'): Promise<HutRoom> {
    const gltf = await new GLTFLoader().loadAsync(`${base}hut.glb?v=${__MODELS__}`);
    return new HutRoom(gltf.scene);
  }

  private constructor(root: THREE.Group) {
    this.scene.add(root);
    this.scene.background = new THREE.Color('#15111c');
    root.updateMatrixWorld(true);

    const halo = haloTexture();
    const guests: THREE.Object3D[] = [];
    const panes: THREE.Mesh[] = [];
    root.traverse((o) => {
      const x = o.userData;
      if (x.id) this.named.set(x.id, o);
      if (x.guests) guests.push(...o.children);
      if (x.emit === 'steam') this.steam.push({ at: o.getWorldPosition(V()), from: o });
      if (x.light) this.addLamp(o.getWorldPosition(V()), x, halo);
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glass = o.name.startsWith('window_glass') || o.parent?.name.startsWith('window_glass');
        const glow = src.name.startsWith('glow_');
        if (glass) panes.push(mesh);
        mesh.material = glass ? this.glass : toonIndoors(src.color, glow);
        mesh.castShadow = !glass && !glow;
        mesh.receiveShadow = true;
      }
    });
    const room = root.getObjectByName('room');
    if (room) this.bounds.setFromObject(room);
    this.guests = new Guests(this.scene, guests);
    for (const a of this.guests.animals) this.named.set(a.userData.id, a);
    this.windows = new Windows(this.scene, panes, this.glass, this.bounds);

    this.key.position.set(9, 16, 11);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.key, this.key.target, this.particles.points);

    this.picker = new Picker(this.camera);
    this.picker.add(...this.named.values());
  }

  get camera() {
    return this.view.camera;
  }

  frame(width: number, height: number, free: { x: number; y: number; w: number; h: number }) {
    this.view.frame(width, height, free);
  }

  /** `out` is the weather outside (weather.ts `now`): rain on the windows, lightning, a greyer day. */
  update(dt: number, night: number, out?: Outside) {
    this.clock += dt;
    this.guests.update(dt);
    const t = this.clock;
    for (const l of this.lamps) {
      const f = l.flicker ? 1 - l.flicker * 0.25 * (Math.sin(t * 13 + l.seed) * 0.5 + Math.sin(t * 7.7 + l.seed * 3) * 0.5 + 0.5) : 1;
      l.light.intensity = l.base * (0.75 + night * 0.25) * f;
      if (l.halo) (l.halo.material as THREE.SpriteMaterial).opacity = (0.35 + night * 0.35) * f;
    }
    const day = 1 - night;
    this.glass.color.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    this.hemi.intensity = 0.85 + day * 0.5;
    this.key.intensity = 0.3 + day * 0.75;
    if (out) {
      this.windows.tint(this.glass.color, out);
      this.key.intensity *= 1 - out.cloud * 0.35; // a dull day comes in through the windows…
      this.key.intensity += out.flash * 2.5; // …and lightning lights up the whole room for a moment
      this.hemi.intensity += out.flash * 1.2;
    }
    this.key.color.set(day > 0.5 ? '#ffe9cc' : '#aab8ff');

    // the kettle and the soup never come off the stove up here
    for (const [i, { at, from }] of this.steam.entries()) {
      if (shown(from) && this.every(`steam${i}`, 0.3, dt)) {
        this.particles.emit({
          position: at.clone().add(V(rand(-0.04, 0.04), 0, rand(-0.04, 0.04))),
          velocity: V(rand(-0.03, 0.03), rand(0.2, 0.32), rand(-0.03, 0.03)),
          color: '#f4efe6', life: rand(1.6, 2.4), wobble: 0.12, size: 1,
        });
      }
    }
    this.particles.update(dt);
    if (out) this.windows.update(dt, out);
    this.waiting(t);
    this.reader(t, dt);
  }

  /**
   * Her, if she's up here (companion.ts): at the table with her tea while the pie bakes, a sip
   * now and then, and every so often a look over her right shoulder at the oven.
   */
  private waiting(t: number) {
    const mug = this.scene.getObjectByName('companion_hut_mug');
    const head = this.scene.getObjectByName('companion_bake_head');
    if (!mug?.parent?.parent?.visible) return;
    const k = t % 9;
    const sip = k > 5 && k < 7 ? Math.sin(((k - 5) / 2) * Math.PI) : 0;
    mug.rotation.x = -sip * 0.55;
    const g = t % 14;
    const glance = g < 2.5 ? Math.sin((g / 2.5) * Math.PI) : 0; // is it done yet?
    head?.rotation.set(-sip * 0.15, -glance * 1.0 + Math.sin(t * 0.3) * 0.1, 0);
  }

  /** Her, reading in bed (companion.ts): a page turned now and then, her head following the lines. */
  private reader(t: number, dt: number) {
    const page = this.scene.getObjectByName('companion_bed_page');
    const head = this.scene.getObjectByName('companion_bed_head');
    if (!page || !shown(page)) return;
    const p = this.page;
    if ((p.next -= dt) < 0) {
      p.t = Math.min(1, p.t + dt / 0.8);
      if (p.t >= 1) Object.assign(p, { t: 0, next: rand(6, 14) });
    }
    page.rotation.z = THREE.MathUtils.smootherstep(p.t, 0, 1) * Math.PI;
    if (head) {
      const rest = (head.userData.rest ??= head.rotation.clone()) as THREE.Euler;
      head.rotation.set(rest.x + Math.sin(t * 0.7) * 0.03, rest.y + Math.sin(t * 0.35) * 0.1, rest.z + Math.sin(t * 0.5) * 0.04);
    }
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
