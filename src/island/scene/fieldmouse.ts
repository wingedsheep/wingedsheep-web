import * as THREE from 'three';
import type { Ground } from './beike';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const RUN = 2.7; // m/s: quicker than George, but it has to stop and think
const TURN = 18;

/** The meadow it keeps to, in the scene's x and z: it won't run out onto the sand or the flagstones. */
export type Patch = [minX: number, minZ: number, maxX: number, maxZ: number];

type State = 'hidden' | 'run' | 'pause' | 'cover' | 'held' | 'dazed';

/**
 * The wood mouse George goes after (shelter.ts): hidden till he pounces, then out from under his
 * paws and off across the grass in short zig-zag dashes, stopping dead between them, till it's in
 * cover and gone. Or he has it, in his mouth (`hold`), and it's carried home and put down in front
 * of the bench (`drop`), where it lies very still until he's dozed off, and then it's up and away.
 * Its root carries the id `mouse` (content.ts), for the sketchbook.
 */
export class FieldMouse {
  readonly root: THREE.Object3D;
  state: State = 'hidden';
  private legs: THREE.Vector3[] = [];
  private wait = 0;
  private t = 0;
  private heading = 0;
  private stride = 0;
  private clock = 0;
  private base: THREE.Vector3;
  private parts: { body?: THREE.Object3D; head?: THREE.Object3D; tail?: THREE.Object3D };
  private patch: Patch = [0, 0, 0, 0];

  constructor(template: THREE.Object3D, private parent: THREE.Object3D, private ground: Ground) {
    this.root = template.clone();
    this.root.visible = false;
    this.root.userData.id = 'mouse';
    this.root.rotation.order = 'YXZ';
    this.base = this.root.scale.clone();
    parent.add(this.root);
    const part = (n: string) => this.root.getObjectByName(`mouse_${n}`) ?? undefined;
    this.parts = { body: part('body'), head: part('head'), tail: part('tail') };
  }

  get position() {
    return this.root.position;
  }

  /** Stopped dead between dashes. */
  get still() {
    return this.state === 'pause';
  }

  /** Away into cover (or never out). */
  get gone() {
    return this.state === 'hidden' || this.state === 'cover';
  }

  /**
   * Out from under a pounce at `from` and off, roughly `away` from him: `dashes` short runs this
   * way and that inside `patch`, then into cover.
   */
  bolt(from: THREE.Vector3, away: THREE.Vector3, patch: Patch, dashes: number) {
    this.patch = patch;
    this.home(from);
    this.legs = this.zigzag(from, away, dashes);
    this.heading = Math.atan2(-away.z, away.x);
    this.state = 'run';
  }

  /** Off again now, before it means to: he's in the air. */
  dash() {
    if (this.state === 'pause') this.state = 'run';
  }

  /** Not going anywhere: he has it. */
  freeze() {
    if (this.state === 'pause') this.wait = 1e9;
  }

  /** In George's mouth, crosswise, hanging from the scruff: `head` is his walker's head. */
  hold(head: THREE.Object3D) {
    this.state = 'held';
    head.add(this.root);
    const s = head.getWorldScale(new THREE.Vector3());
    this.root.scale.set(this.base.x / s.x, this.base.y / s.y, this.base.z / s.z);
    this.root.position.set(0.17, -0.1, 0.02); // under his chin, just in front of it
    this.root.rotation.set(0.5, Math.PI / 2, 0); // across his mouth, sagging at both ends
    this.root.visible = true;
  }

  /** Put down at `at`, on its side, playing dead; when it's up it'll be off back to the grass it came from. */
  drop(at: THREE.Vector3) {
    const [x0, z0, x1, z1] = this.patch;
    this.heading = Math.atan2(-((z0 + z1) / 2 - at.z), (x0 + x1) / 2 - at.x);
    this.home(at);
    this.root.position.y = this.ground.at(at.x, at.z);
    this.state = 'dazed';
    this.wait = rand(5, 8);
    this.t = 0;
  }

  hide() {
    this.state = 'hidden';
    this.root.visible = false;
    if (this.root.parent !== this.parent) this.home(this.root.getWorldPosition(new THREE.Vector3()));
    this.root.visible = false;
  }

  /** Back to the ground in the scene, at `at`, its own size. */
  private home(at: THREE.Vector3) {
    this.parent.add(this.root);
    this.root.scale.copy(this.base);
    this.root.position.copy(at);
    this.root.rotation.set(0, this.heading, 0);
    this.root.visible = true;
  }

  private zigzag(from: THREE.Vector3, away: THREE.Vector3, dashes: number) {
    const [x0, z0, x1, z1] = this.patch;
    const inside = (p: THREE.Vector3) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1;
    const legs: THREE.Vector3[] = [];
    let dir = Math.atan2(away.z, away.x);
    let at = from.clone();
    let side = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < dashes; i++) {
      // this way and that across its run; at the edge of the grass, back in towards the middle of it
      let next: THREE.Vector3 | null = null;
      for (let tries = 0; tries < 8 && !next; tries++) {
        const inward = Math.atan2((z0 + z1) / 2 - at.z, (x0 + x1) / 2 - at.x);
        const a = tries < 3 ? dir + side * rand(0.5, 1.1) : inward + rand(-0.7, 0.7);
        const len = rand(1.0, 1.8) * (tries < 6 ? 1 : 0.5);
        const p = new THREE.Vector3(at.x + Math.cos(a) * len, 0, at.z + Math.sin(a) * len);
        if (inside(p)) {
          next = p;
          dir = a;
        }
      }
      at = next ?? new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
      legs.push(at.clone());
      side = -side;
    }
    return legs;
  }

  update(dt: number) {
    this.clock += dt;
    const r = this.root;
    const { body, head, tail } = this.parts;
    let moving = false;
    switch (this.state) {
      case 'hidden':
      case 'held':
        break;
      case 'run': {
        const to = this.legs[0];
        const dx = to.x - r.position.x;
        const dz = to.z - r.position.z;
        const left = Math.hypot(dx, dz);
        const d = Math.min(left, RUN * dt);
        r.position.x += (dx / (left || 1)) * d;
        r.position.z += (dz / (left || 1)) * d;
        r.position.y = this.ground.at(r.position.x, r.position.z);
        this.turn(Math.atan2(-dz, dx), dt);
        this.stride += d * 60;
        moving = true;
        if (left - d > 0.01) break;
        this.legs.shift();
        if (this.legs.length) {
          this.state = 'pause';
          this.wait = rand(0.35, 0.8);
        } else {
          this.state = 'cover';
          this.t = 0;
        }
        break;
      }
      case 'pause':
        if ((this.wait -= dt) <= 0) this.state = 'run';
        break;
      case 'cover': {
        // down into the grass, and gone
        this.t += dt / 0.35;
        r.scale.copy(this.base).multiplyScalar(Math.max(0, 1 - this.t));
        if (this.t >= 1) this.hide();
        break;
      }
      case 'dazed': {
        // on its side, quite still; then a twitch, back on its feet, and off into the grass
        this.wait -= dt;
        const up = THREE.MathUtils.smoothstep(-this.wait, 0, 0.25);
        r.rotation.set((1 - up) * 1.45, this.heading, 0);
        if (this.wait > 0.6 && this.wait < 1.1 && tail) tail.rotation.z = Math.sin(this.clock * 30) * 0.3;
        if (this.wait > -0.3) break;
        // back to its own grass, a dash or two at a time, and into cover there
        const [x0, z0, x1, z1] = this.patch;
        const home = new THREE.Vector3(THREE.MathUtils.clamp(r.position.x, x0, x1), 0, THREE.MathUtils.clamp(r.position.z, z0, z1));
        const away = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
        this.legs = [home, ...this.zigzag(home, away, 2)];
        this.state = 'run';
        break;
      }
    }
    // a scurry: quick, low and bobbing, the tail streaming out behind; stopped, the nose twitches
    if (body) body.position.y = moving ? Math.abs(Math.sin(this.stride)) * 0.012 : 0;
    if (head) head.rotation.z = this.state === 'pause' ? Math.sin(this.clock * 40) * 0.08 + 0.15 : 0;
    if (tail && this.state !== 'dazed') tail.rotation.y = moving ? Math.sin(this.stride * 0.5) * 0.35 : this.state === 'held' ? 0.6 : 0;
  }

  private turn(want: number, dt: number) {
    let d = want - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * (1 - Math.exp(-TURN * dt));
    this.root.rotation.set(0, this.heading, 0);
  }
}
