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

  static async load(base = '/models/'): Promise<WorkshopRoom> {
    const gltf = await new GLTFLoader().loadAsync(`${base}workshop.glb?v=${__MODELS__}`);
    return new WorkshopRoom(gltf.scene);
  }

  private constructor(root: THREE.Group) {
    this.scene.add(root);
    this.scene.background = new THREE.Color('#15111c');
    root.updateMatrixWorld(true);

    const waypoints: Waypoint[] = [];
    const halo = haloTexture();
    root.traverse((o) => {
      const x = o.userData;
      if (x.id) this.named.set(x.id, o);
      if (x.waypoint) waypoints.push({ name: x.waypoint, position: o.getWorldPosition(V()), links: String(x.links ?? '').split(' ').filter(Boolean) });
      if (x.emit) this.emitters.push({ kind: x.emit, position: o.getWorldPosition(V()) });
      if (x.light) this.addLamp(o.getWorldPosition(V()), x, halo);
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glass = o.name.startsWith('window_glass');
        const glow = src.name.startsWith('glow_');
        mesh.material = glass ? this.glass : toonIndoors(src.color, glow);
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
    this.picker = new Picker(this.camera);
    this.picker.add(...this.named.values());
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

    this.exhibits.playing = this.playing;
    this.exhibits.update(dt);
    this.robot.update(dt);
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
