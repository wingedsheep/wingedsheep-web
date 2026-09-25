import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toonIndoors } from './interior';
import { Picker } from './picking';
import { RoomCamera } from './room-camera';
import { haloTexture } from './sky';

const SKY_DAY = new THREE.Color('#a9dcff');
const SKY_NIGHT = new THREE.Color('#1c2852');
const LANTERN = 0xfff1b0;
const TURN = 0.4; // radians a second: the lens is heavy, and floats on its clockwork

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

interface Lamp {
  light: THREE.PointLight;
  halo?: THREE.Sprite;
  base: number;
  flicker: number;
  seed: number;
  /** The lamp inside the lens: lit at dusk, turned down by day. */
  lens: boolean;
}

/**
 * The top of the lighthouse (tools/models/lamproom.py): the lamp room. The great lens turns
 * round its lamp on a clockwork pedestal, and at night two beams sweep out over the gallery into
 * the dark. The stair comes up through a hatch from the keeper's quarters below.
 */
export class LampRoom {
  readonly scene = new THREE.Scene();
  readonly picker: Picker;
  /** Things with an id, for highlighting. */
  readonly named = new Map<string, THREE.Object3D>();

  private bounds = new THREE.Box3();
  /** Frames the room; you can zoom and look around it. */
  readonly view = new RoomCamera(this.bounds);
  private lamps: Lamp[] = [];
  private glass = new THREE.MeshBasicMaterial({ color: SKY_DAY.clone() });
  private hemi = new THREE.HemisphereLight('#d6d0e6', '#3a3246', 1.25);
  private key = new THREE.DirectionalLight('#ffe9cc', 1);
  private turn?: THREE.Object3D;
  private core?: THREE.MeshToonMaterial;
  private beams: THREE.MeshBasicMaterial;
  private beamGroup = new THREE.Group();
  private clock = 0;

  static async load(base = '/models/'): Promise<LampRoom> {
    const gltf = await new GLTFLoader().loadAsync(`${base}lamproom.glb`);
    return new LampRoom(gltf.scene);
  }

  private constructor(root: THREE.Group) {
    this.scene.add(root);
    this.scene.background = new THREE.Color('#15111c');
    root.updateMatrixWorld(true);

    const halo = haloTexture();
    const beam = root.getObjectByName('beam')?.getWorldPosition(V());
    root.traverse((o) => {
      const x = o.userData;
      if (x.id) this.named.set(x.id, o);
      if (o.name === 'lens_turn') this.turn = o;
      if (x.light) {
        const at = o.getWorldPosition(V());
        this.addLamp(at, x, halo, !!beam && at.distanceTo(beam) < 0.01);
      }
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glass = o.name.startsWith('window_glass') || o.parent?.name.startsWith('window_glass');
        const glow = src.name.startsWith('glow_');
        mesh.material = glass ? this.glass : toonIndoors(src.color, glow);
        if (glow && (o.name.startsWith('lamp_core') || o.parent?.name.startsWith('lamp_core'))) {
          // its own material, so dimming it by day leaves every other lantern alone
          this.core = (mesh.material as THREE.MeshToonMaterial).clone();
          mesh.material = this.core;
        }
        mesh.castShadow = !glass && !glow;
        mesh.receiveShadow = true;
      }
    });
    const room = root.getObjectByName('room');
    if (room) this.bounds.setFromObject(room);

    // two beams, out of opposite bullseyes, turning with the lens; each fades to nothing as it
    // leaves the glass (additive, so a black tail is no tail)
    this.beams = new THREE.MeshBasicMaterial({
      color: LANTERN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, vertexColors: true,
    });
    const geo = new THREE.ConeGeometry(1.4, 12, 12, 6, true).rotateZ(Math.PI / 2).translate(6.3, 0, 0);
    const pos = geo.getAttribute('position');
    const fade = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) fade.fill((1 - THREE.MathUtils.clamp((pos.getX(i) - 0.3) / 12, 0, 1)) ** 2, i * 3, i * 3 + 3);
    geo.setAttribute('color', new THREE.BufferAttribute(fade, 3));
    for (const a of [Math.PI / 8, Math.PI / 8 + Math.PI]) {
      const b = new THREE.Mesh(geo, this.beams);
      b.rotation.y = a;
      b.renderOrder = 3;
      b.raycast = () => {};
      this.beamGroup.add(b);
    }
    if (beam) this.beamGroup.position.copy(beam);
    this.scene.add(this.beamGroup);

    this.key.position.set(9, 16, 11);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.key, this.key.target);

    this.picker = new Picker(this.camera);
    this.picker.add(...this.named.values());
  }

  get camera() {
    return this.view.camera;
  }

  frame(width: number, height: number, free: { x: number; y: number; w: number; h: number }) {
    this.view.frame(width, height, free);
  }

  /** Nothing up here slides out when pointed at (the quarters' books do). */
  setHot(_id: string | null) {}

  update(dt: number, night: number) {
    this.clock += dt;
    const t = this.clock;
    const day = 1 - night;
    const lit = 0.25 + night * 0.75;
    for (const l of this.lamps) {
      const f = l.flicker ? 1 - l.flicker * 0.25 * (Math.sin(t * 13 + l.seed) * 0.5 + Math.sin(t * 7.7 + l.seed * 3) * 0.5 + 0.5) : 1;
      l.light.intensity = l.base * (l.lens ? lit : 0.75 + night * 0.25) * f;
      if (l.halo) (l.halo.material as THREE.SpriteMaterial).opacity = (l.lens ? lit * 0.8 : 0.35 + night * 0.35) * f;
    }
    if (this.core) this.core.emissiveIntensity = 0.3 + night * 1.2;

    // the lens turns day and night (the clockwork doesn't know the difference); the beams only show in the dark
    const angle = t * TURN;
    if (this.turn) this.turn.rotation.y = angle;
    this.beamGroup.rotation.y = angle;
    this.beams.opacity = 0.22 * night;
    this.beamGroup.visible = night > 0.05;

    this.glass.color.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    this.hemi.intensity = 0.9 + day * 0.5;
    this.key.intensity = 0.35 + day * 0.75;
    this.key.color.set(day > 0.5 ? '#ffe9cc' : '#aab8ff');
  }

  private addLamp(position: THREE.Vector3, x: Record<string, number | string>, halo: THREE.Texture, lens: boolean) {
    const radius = Number(x.radius);
    const light = new THREE.PointLight(new THREE.Color(String(x.color)), 0, radius * 1.8, 1.4);
    light.position.copy(position);
    this.scene.add(light);
    const lamp: Lamp = { light, base: Number(x.intensity) * 7, flicker: Number(x.flicker), seed: Math.random() * 100, lens };
    this.lamps.push(lamp);
    if (x.halo === 0) return;
    lamp.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: halo, color: new THREE.Color(String(x.color)), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    lamp.halo.position.copy(position);
    lamp.halo.scale.setScalar(radius * 0.22);
    lamp.halo.renderOrder = 2;
    lamp.halo.raycast = () => {};
    this.scene.add(lamp.halo);
  }
}
