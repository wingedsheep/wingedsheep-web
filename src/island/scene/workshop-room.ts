import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Exhibits } from './exhibits';
import { toonIndoors } from './interior';
import { ICONS } from './life';
import { Particles } from './particles';
import { Picker } from './picking';
import { RoomCamera } from './room-camera';
import { Robot, type Waypoint } from './robot';
import { haloTexture } from './sky';
import { hourOf } from './bedtime';
import { BOAT_STAGES as STAGES, boatStage } from './almanac';
import { occasions } from './calendar';
import { indoors } from './shelter';
import { wardrobe } from './wardrobe';
import { Haunts, undress } from './dressing';
import { Guests } from './guests';


const SKY_DAY = new THREE.Color('#a9dcff');
const SKY_NIGHT = new THREE.Color('#1c2852');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

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
 * The workshop, inside (tools/models/workshop.py): a cutaway room with every project set out
 * as a thing you can walk up to, all quietly running, and the robot that looks after them.
 * Like the library it has its own scene and a fixed camera; the island hands the renderer
 * over when you step through the door.
 */
export class WorkshopRoom {
  readonly scene = new THREE.Scene();
  readonly picker: Picker;
  readonly robot: Robot;
  /** Things with an id (the exhibits, the robot, the door), for highlighting. */
  readonly named = new Map<string, THREE.Object3D>();
  /** Just above each exhibit, where the page pins its sign (by project id). */
  readonly anchors = new Map<string, THREE.Vector3>();
  /** Whether a record is on the gramophone. */
  playing = false;
  /** A noise from the room: its machines or the robot (the island plays it). */
  onSound?: (name: string, volume?: number) => void;
  /** Something running in the room, 0..1 (the island keeps it looping while it's up). */
  onHum?: (name: string, level: number) => void;

  private bounds = new THREE.Box3();
  /** Frames the room; you can zoom and look around it. */
  readonly view = new RoomCamera(this.bounds);
  private exhibits: Exhibits;
  private lamps: Lamp[] = [];
  private glass = new THREE.MeshBasicMaterial({ color: SKY_DAY.clone() });
  private hemi = new THREE.HemisphereLight('#d9c3a6', '#4a3226', 1.2);
  private key = new THREE.DirectionalLight('#ffe9cc', 1);
  private particles = new Particles(400);
  private emitters: { kind: string; position: THREE.Vector3 }[] = [];
  private floaters: Floater[] = [];
  private clock = 0;
  private night = 0;
  /** Vincent at his boat (workshop.py `vincent_workshop`), when he's in (vincent.ts), and his plane's stroke. */
  private bench?: THREE.Object3D;
  private strokes = 0;
  /** Her at her paint by numbers (workshop.py `companion_workshop`), when she's in (companion.ts), and her brush. */
  private painter?: THREE.Object3D;
  private brush?: { o: THREE.Object3D; rest: THREE.Euler };
  private paintHead?: { o: THREE.Object3D; rest: THREE.Euler };
  private dip = { t: -1, next: rand(6, 12) };

  /** Today's dressing (dressing.ts): what moves in it, and Halloween's gloom and mist. */
  private haunts: Haunts;
  /** Charlie or George, in for a nap in the hammock (shelter.ts): shown only while they're in. */
  readonly guests: Guests;

  static async load(base = '/models/'): Promise<WorkshopRoom> {
    const gltf = await new GLTFLoader().loadAsync(`${base}workshop.glb?v=${__MODELS__}`);
    return new WorkshopRoom(gltf.scene);
  }

  private constructor(root: THREE.Group) {
    this.scene.add(root);
    undress(root); // what's put out for a special day, only on the day
    this.scene.background = new THREE.Color('#15111c');
    root.updateMatrixWorld(true);

    const waypoints: Waypoint[] = [];
    const guests: THREE.Object3D[] = [];
    const halo = haloTexture();
    root.traverse((o) => {
      const x = o.userData;
      if (x.id) this.named.set(x.id, o);
      if (x.guest) guests.push(o);
      if (x.wear && !(o as THREE.Mesh).isMesh) wardrobe.adopt(o, true);
      if (x.waypoint) waypoints.push({ name: x.waypoint, position: o.getWorldPosition(V()), links: String(x.links ?? '').split(' ').filter(Boolean) });
      if (x.emit) this.emitters.push({ kind: x.emit, position: o.getWorldPosition(V()) });
      if (x.light) this.addLamp(o.getWorldPosition(V()), x, halo);
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glass = o.name.startsWith('window_glass');
        const glow = src.name.startsWith('glow_');
        mesh.material = wardrobe.adopt(o, true) ?? (glass ? this.glass : toonIndoors(src.color, glow));
        mesh.castShadow = !glass && !glow;
        mesh.receiveShadow = true;
      }
    });
    const room = root.getObjectByName('room');
    if (room) this.bounds.setFromObject(room);
    for (const [id, o] of this.named) {
      if (!id.startsWith('project_')) continue;
      const box = new THREE.Box3().setFromObject(o);
      // the sign hangs well clear of the top, so it never hides what the exhibit is doing
      this.anchors.set(id.slice('project_'.length), V(box.getCenter(V()).x, box.max.y + 0.75, box.getCenter(V()).z));
    }

    // light from the open side of the dollhouse, as if someone held a lamp up to it
    this.key.position.set(9, 16, 11);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.key, this.key.target, this.particles.points);

    const exhibit = (id: string) => this.named.get(`project_${id}`);
    const sound = (name: string, volume?: number) => this.onSound?.(name, volume);
    const hum = (name: string, level: number) => this.onHum?.(name, level);
    this.exhibits = new Exhibits({ particles: this.particles, notes: (at) => this.notes(at), exhibit, emitters: this.emitters, sound, hum });
    this.robot = new Robot(this.named.get('robot'), waypoints, { particles: this.particles, float: (_, at) => this.float(ICONS.zzz, at, V(0, 0.4, 0)), exhibit, sound }, () => this.night > 0.6);
    this.haunts = new Haunts(root, this.scene, this.bounds);
    this.guests = new Guests(this.scene, guests);
    for (const a of this.guests.animals) this.named.set(a.userData.id, a);
    this.picker = new Picker(this.camera);
    this.picker.add(...this.named.values());

    // the boat as far as the Saturdays have got it, and a Saturday's fresh shavings
    for (let n = 0; n < STAGES; n++) {
      const st = root.getObjectByName(`boat_stage_${n}`);
      if (st) st.visible = n === boatStage;
    }
    const fresh = root.getObjectByName('sawdust_fresh');
    if (fresh) fresh.visible = occasions.has('saturday');
    this.bench = this.named.get('vincent_workshop');
    this.painter = this.named.get('companion_workshop');
    const part = (name: string) => {
      const o = root.getObjectByName(name);
      return o && { o, rest: o.rotation.clone() };
    };
    this.brush = part('companion_brush');
    this.paintHead = part('companion_paint_head');
    // Patch Tuesday: it's installing its updates when you come in (in the daytime, at least)
    const hour = hourOf(Date.now());
    if (occasions.has('patchday') && hour >= 8 && hour < 22) this.robot.install();
  }

  get camera() {
    return this.view.camera;
  }

  /** Fit the room into the part of the canvas a panel leaves free (CSS pixels). */
  frame(width: number, height: number, free: { x: number; y: number; w: number; h: number }) {
    this.view.frame(width, height, free);
  }

  /** Where a world point lands on the canvas, in CSS pixels. */
  project(p: THREE.Vector3, width: number, height: number) {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  }

  update(dt: number, night: number) {
    this.clock += dt;
    this.haunts.update(dt, night);
    this.night = night;
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
    this.haunts.gloom(this.hemi, this.key, night);

    this.exhibits.playing = this.playing;
    this.exhibits.update(dt);
    this.robot.update(dt);
    this.guests.update(dt);
    this.painting(dt);
    this.planing(dt);
    this.particles.update(dt);
    this.updateFloaters(dt);
  }

  // --- building ----------------------------------------------------------------------

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

  // --- floating icons ------------------------------------------------------------------

  private notes(at: THREE.Vector3) {
    for (let i = 0; i < 3; i++) this.float(ICONS.note, at.clone().add(V(rand(-0.3, 0.3), i * 0.25, rand(-0.1, 0.1))), V(rand(-0.15, 0.15), rand(0.35, 0.55), rand(0, 0.1)), -i * 0.35);
  }

  private float(tex: THREE.Texture, at: THREE.Vector3, velocity = V(0, 0.45, 0), age = 0) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const img = tex.image as HTMLCanvasElement;
    sprite.scale.set(img.width * 0.045, img.height * 0.045, 1);
    sprite.position.copy(at);
    sprite.renderOrder = 5;
    sprite.raycast = () => {};
    sprite.visible = age >= 0;
    this.scene.add(sprite);
    this.floaters.push({ sprite, velocity, age });
  }

  /**
   * Her, if she's in (companion.ts `painting`): small dabs at the board, filling in one number at
   * a time, her head bent over it; every so often the brush goes over to a pot for more paint (or
   * into the jar to rinse), and she sits back for a look at how it's coming on.
   */
  private painting(dt: number) {
    const me = this.painter;
    if (!me) return;
    me.visible = indoors.has('companion_workshop');
    if (!me.visible || !this.brush || !this.paintHead) return;
    const t = this.clock;
    const d = this.dip;
    if (d.t < 0 && (d.next -= dt) <= 0) d.t = 0;
    let reach = 0;
    if (d.t >= 0) {
      d.t += dt / 1.8;
      reach = Math.sin(Math.min(1, d.t) * Math.PI);
      if (d.t >= 1) Object.assign(d, { t: -1, next: rand(6, 14) });
    }
    const dab = (1 - reach) * Math.max(0, Math.sin(t * 7)) ** 2 * 0.12; // little strokes, filling a shape in
    const b = this.brush;
    b.o.rotation.set(b.rest.x - dab + reach * 0.35, b.rest.y, b.rest.z - reach * 0.55);
    const back = Math.max(0, Math.sin(t * 0.13)) ** 8; // sitting back to look at it
    const h = this.paintHead;
    h.o.rotation.set(h.rest.x - back * 0.35 - reach * 0.1, h.rest.y + Math.sin(t * 0.4) * 0.06 + reach * 0.25, h.rest.z);
  }

  /**
   * Vincent, if he's in (vincent.ts `workshop`): planing the boat's planks, long strokes along the
   * gunwale, a curl of shaving off each one, and a look along the line of it now and then.
   */
  private planing(dt: number) {
    const me = this.bench;
    if (!me) return;
    me.visible = indoors.has('vincent_workshop');
    if (!me.visible) return;
    const t = this.clock;
    const k = (t % 2.2) / 2.2;
    const push = k < 0.6 ? Math.sin((k / 0.6) * Math.PI * 0.5) : 1 - THREE.MathUtils.smootherstep((k - 0.6) / 0.4, 0, 1);
    const sight = Math.max(0, Math.sin(t * 0.21)) ** 6; // stopping to sight along the plank
    const part = (name: string) => me.getObjectByName(`bench_${name}`);
    const reach = -0.75 - push * 0.55;
    part('arm_r')?.rotation.set(reach * (1 - sight), 0, 0.1);
    part('arm_l')?.rotation.set((reach + 0.15) * (1 - sight) - sight * 0.3, 0, -0.1);
    part('head')?.rotation.set(0.35 * (1 - sight), sight * 0.6, 0);
    const turn = Math.floor(t / 2.2);
    if (turn !== this.strokes) {
      this.strokes = turn;
      if (sight < 0.2) {
        this.onSound?.('plane', 0.6);
        const at = me.localToWorld(V(0, 1.05, 0.85));
        for (let i = 0; i < 3; i++) {
          this.particles.emit({ position: at.clone().add(V(rand(-0.1, 0.1), 0, rand(-0.1, 0.1))), velocity: V(rand(-0.3, 0.3), rand(0.2, 0.5), rand(-0.3, 0.3)), color: '#e8c890', life: 0.9, gravity: -3, size: 1 });
        }
      }
    }
  }

  private updateFloaters(dt: number) {
    this.floaters = this.floaters.filter((f) => {
      f.age += dt;
      if (f.age < 0) return true;
      f.sprite.visible = true;
      f.sprite.position.addScaledVector(f.velocity, dt);
      f.sprite.position.x += Math.sin(f.age * 3 + f.velocity.x * 20) * dt * 0.1;
      f.sprite.material.opacity = 1 - Math.max(0, f.age / 2.6 - 0.6) / 0.4;
      if (f.age < 2.6) return true;
      this.scene.remove(f.sprite);
      f.sprite.material.dispose();
      return false;
    });
  }
}
