import * as THREE from 'three';
import type { Ground } from './beike';
import { occasions } from './calendar';
import type { Call } from './fauna';
import type { Island } from './island';
import { GRADIENT } from './toon';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const chance = (p: number) => Math.random() < p;
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
const smooth = (k: number) => THREE.MathUtils.smoothstep(k, 0, 1);
/** Blender's (east, north) to a point in the scene (east, up, south). */
const B = (x: number, y: number) => V(x, 0, -y);

/** The lead plane's track (world z), how high, how far out it comes from, and how fast (m/s). */
const LANE = 9;
const HEIGHT = 26;
const REACH = 150;
const SPEED = 9;
/** Where the wingmen of a vee fly, off the lead: back, out to the side, up. */
const WINGMEN = [V(0, 0, 0), V(-12, 1.5, -7), V(-12, 1.2, 7)];
/** How many jump from each plane, and how far apart in time they go out of the door. */
const STICK = { single: 9, vee: 6 };
const EXIT = 0.6;
/** Under the canopy: how fast they come down (m/s), and how much of the wind they drift with. */
const DESCENT = 2.0;
const DRIFT = 0.6;
/** How fast they swing under the canopy (rad/s, squared: a pendulum of about 3.4 s). */
const SWAY = (2 * Math.PI / 3.4) ** 2;
/** How big the canopies are drawn (the island is small, and the sky still has to show between them). */
const CANOPY = 0.82;
/** How far the canopy's middle is above his feet (airborne.py: the risers meet 2 m up, and the dome's middle is 4.4 m above that). */
const HANG = 2 + 4.4 * CANOPY;
/** Never more of them about than this (the pool). */
const POOL = 36;
/** The drop zone: let go over x0..x1, and aiming to land on the beach and the meadows just above it. */
const ZONE = { x0: -22, x1: 25, z0: 12, z1: 18.5 };
/** Where nobody lands (Blender x, y, and how far to stay off): the pier's foot, the signpost, the well, the bench, Beike's spot, the blanket, the mats. */
const CLEAR: [number, number, number][] = [[0, -17.5, 2.4], [-2.6, -15.5, 1.6], [20, -14, 2.6], [-17, -11, 2.6], [-12.5, -12.5, 2.2], [22.9, -14, 2.6], [9, -14.2, 2.2], [-4.4, -12.6, 2.2]];
/** Off the drop zone, all of them the same way: along the south of the island to the beach's east end, and into the woods by the sett. */
const WAY_OFF = [B(-22, -14), B(-12, -16.3), B(-4, -16.2), B(4, -16.2), B(10, -17.4), B(17, -18.8), B(24, -17.3), B(28.5, -12.8), B(30, -7)];
const WALK = 1.25;
/** The cargo door (airborne.py, port side), in the plane's own frame. */
const DOOR = V(-1.05, 0.0, -0.84);

const WANTED = (() => {
  try {
    return new URLSearchParams(location.search).has('airborne');
  } catch {
    return false;
  }
})();

const LINE_GEOMETRY = new THREE.BoxGeometry(1, 0.04, 0.04).translate(0.5, 0, 0);
const LINE_MATERIAL = new THREE.MeshToonMaterial({ color: '#a39c84', gradientMap: GRADIENT });
const POUCH_GEOMETRY = new THREE.BoxGeometry(0.42, 0.26, 0.26);
const POUCH_MATERIAL = new THREE.MeshToonMaterial({ color: '#55583a', gradientMap: GRADIENT });

/** One static line, hooked up inside the door: taut to a jumper as he goes, then streaming back off the plane with its empty bag. */
interface Static {
  line: THREE.Mesh;
  pouch: THREE.Mesh;
  /** Who's on the end of it, till it pulls his canopy out. */
  jumper: Jumper | null;
  age: number;
}

class Plane {
  readonly root: THREE.Object3D;
  private props: THREE.Object3D[];
  lines: Static[] = [];
  flying = false;
  dir = 1;
  x = 0;
  /** Where in the formation (WINGMEN), and how many still to jump. */
  slot = V();
  left = 0;
  next = 0;
  heard = false;

  constructor(template: THREE.Object3D, scene: THREE.Scene) {
    this.root = template.clone(true);
    this.root.visible = false;
    scene.add(this.root);
    this.props = ['dakota_prop_l', 'dakota_prop_r'].map((n) => this.root.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
  }

  /** In the door, the way the plane faces. */
  get door() {
    return this.root.localToWorld(DOOR.clone());
  }

  get velocity() {
    return V(this.dir * SPEED, 0, 0);
  }

  hook(jumper: Jumper) {
    const line = new THREE.Mesh(LINE_GEOMETRY, LINE_MATERIAL);
    const pouch = new THREE.Mesh(POUCH_GEOMETRY, POUCH_MATERIAL);
    line.castShadow = pouch.castShadow = true;
    this.root.add(line, pouch);
    this.lines.push({ line, pouch, jumper, age: 0 });
  }

  update(dt: number, clock: number) {
    const r = this.root;
    this.x += this.dir * SPEED * dt;
    const along = this.x + this.dir * this.slot.x;
    r.position.set(along, HEIGHT + this.slot.y + Math.sin(clock * 0.7 + this.slot.z) * 0.25, LANE + this.slot.z);
    // holding her course, rocking a little in the air; the model's nose is +x
    r.rotation.set(Math.sin(clock * 0.9 + this.slot.z) * 0.035, this.dir > 0 ? 0 : Math.PI, Math.sin(clock * 0.6) * 0.02);
    for (const p of this.props) p.rotation.x += 28 * dt;
    // the static lines: taut to the man going out, then streaming back in the slipstream, flogging
    const door = DOOR.clone();
    const to = V();
    this.lines.forEach((s, i) => {
      s.age += dt;
      if (s.jumper) to.copy(r.worldToLocal(s.jumper.back()));
      else {
        const k = smooth(Math.min(1, s.age / 0.5));
        to.set(-3.6 * k - 0.4, -0.7 * k + Math.sin(clock * 9 + i * 1.7) * 0.12, -0.5 - 0.35 * k + Math.sin(clock * 13 + i) * 0.18);
      }
      const d = to.clone().sub(door);
      s.line.position.copy(door).add(V(0, 0.25 - i * 0.03, 0));
      s.line.quaternion.setFromUnitVectors(V(1, 0, 0), d.clone().normalize());
      s.line.scale.set(d.length(), 1, 1);
      s.pouch.visible = !s.jumper;
      s.pouch.position.copy(door).add(d);
      s.pouch.quaternion.copy(s.line.quaternion);
    });
  }

  land() {
    for (const s of this.lines) this.root.remove(s.line, s.pouch);
    this.lines = [];
    this.flying = false;
    this.root.visible = false;
  }
}

type Phase = 'idle' | 'falling' | 'down' | 'walking';

/**
 * One parachutist, from the door to the edge of the woods: out on the static line, the canopy
 * streaming and then blossoming open, swinging under it, lowering his kit bag, steering for a
 * clear bit of grass or beach; a roll as he lands while the canopy goes over and collapses; up,
 * hauling it in hand over hand into a bundle; and off with the others along the beach.
 */
class Jumper {
  readonly root: THREE.Object3D;
  private canopies: THREE.Object3D[];
  private bundles: THREE.Object3D[];
  private body: THREE.Object3D;
  private arms: THREE.Object3D[];
  private legs: THREE.Object3D[];
  private bag: THREE.Object3D;
  private bagline: THREE.Object3D;
  private fade = { value: 1 };
  private colour = 0;
  phase: Phase = 'idle';
  /** Since he went out of the door, and since this phase began. */
  private t = 0;
  private st = 0;
  /** The canopy's middle, how fast it's going, and how it swings (radians about world x and z, and how fast). */
  private centre = V();
  private vel = V();
  private swing = { x: 0, z: 0, vx: 0, vz: 0 };
  private yaw = 0;
  private spin = 0;
  private target = V();
  private way: THREE.Vector3[] = [];
  private side = 1;
  private hang = 0;
  private wave = 0;
  /** He's let go of the static line (the plane lets the line stream back). */
  free = false;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground) {
    this.root = template.clone(true);
    this.root.visible = false;
    scene.add(this.root);
    const part = (n: string) => this.root.getObjectByName(n)!;
    this.canopies = [0, 1, 2].map((n) => part(`chute_canopy_${n}`));
    this.bundles = [0, 1, 2].map((n) => part(`chute_bundle_${n}`));
    this.body = part('chute_jumper');
    this.arms = [part('chute_arm_l'), part('chute_arm_r')];
    this.legs = [part('chute_leg_l'), part('chute_leg_r')];
    this.bag = part('chute_bag');
    this.bagline = part('chute_bagline');
    // his own materials, so he alone can fade into the trees, the way the mist is drawn: dithered
    const own = new Map<THREE.Material, THREE.Material>();
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshToonMaterial;
      let mat = own.get(src) as THREE.MeshToonMaterial | undefined;
      if (!mat) {
        mat = src.clone();
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uFade = this.fade;
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uFade;\nconst float DITHER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);')
            .replace(
              '#include <clipping_planes_fragment>',
              /* glsl */ `#include <clipping_planes_fragment>
              ivec2 dq = ivec2(gl_FragCoord.xy) & 3;
              if ((DITHER[dq.x + dq.y * 4] + 0.5) / 16.0 > uFade) discard;`,
            );
        };
        mat.customProgramCacheKey = () => 'airborne-fade';
        own.set(src, mat);
      }
      mesh.material = mat;
    });
  }

  /** Between his shoulders, where the static line pulls the canopy out. */
  back() {
    return this.root.localToWorld(V(-0.2, 1.3, 0));
  }

  get position() {
    return this.root.position;
  }

  /** Out of the door at `at`, going `vel`, for a spot round `target`. */
  jump(at: THREE.Vector3, vel: THREE.Vector3, target: THREE.Vector3, colour: number) {
    this.phase = 'falling';
    this.t = this.st = 0;
    this.free = false;
    this.centre.copy(at).add(V(0, HANG, 0));
    this.vel.copy(vel);
    this.target.copy(target);
    this.yaw = vel.x > 0 ? 0 : Math.PI;
    this.spin = rand(-0.12, 0.12);
    this.swing = { x: 0, z: 0, vx: 0, vz: 0 };
    this.hang = 0;
    this.colour = colour;
    this.fade.value = 1;
    this.canopies.forEach((c, i) => (c.visible = i === colour));
    this.bundles.forEach((b) => (b.visible = false));
    this.bag.visible = true;
    this.root.visible = true;
  }

  /** Clicked: if he's down and on his feet, a wave. */
  poke() {
    if (this.phase === 'down' || this.phase === 'walking') this.wave = 2.2;
  }

  /** The rest pose of every part, before this frame's. */
  private relax() {
    for (const o of [this.body, ...this.arms, ...this.legs, this.bag, this.bagline, ...this.canopies]) {
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
    }
    this.canopies[this.colour].position.set(0, 2, 0);
    this.body.position.set(0, 0, 0);
  }

  /** Arms: up to the risers (1), down at his sides (0), or out in front holding the bundle (`hold`). */
  private armsUp(k: number, clock: number, pull = 0) {
    this.arms.forEach((a, i) => {
      a.rotation.z = 2.85 * k + (i === 0 ? pull : -pull) * 0.25;
      a.rotation.x = (i === 0 ? 0.12 : -0.12) * k + Math.sin(clock * 1.3 + i) * 0.03;
    });
  }

  update(dt: number, clock: number, drift: THREE.Vector2) {
    if (this.phase === 'idle') return;
    this.t += dt;
    this.st += dt;
    this.relax();
    if (this.phase === 'falling') this.fall(dt, clock, drift);
    else if (this.phase === 'down') this.gather(dt, clock);
    else this.walk(dt, clock);
    if (this.wave > 0) {
      this.wave -= dt;
      this.arms[1].rotation.z = 2.9;
      this.arms[1].rotation.x = 0.35 + Math.sin(this.wave * 12) * 0.35;
    }
  }

  private fall(dt: number, clock: number, drift: THREE.Vector2) {
    const t = this.t;
    const canopy = this.canopies[this.colour];
    const wind = V(drift.x * DRIFT, 0, drift.y * DRIFT);
    // free fall off the end of the line, falling behind the plane, till the canopy bites
    const open = smooth(clamp((t - 0.95) / 0.9, 0, 1));
    if (t > 0.6) this.free = true;
    const sink = t < 0.95 ? Math.min(9, 1 + t * 9.8) : damp(-this.vel.y, DESCENT, 2.2, dt);
    // steering for his spot: where he'd land if he let the wind have him, and the difference made up by the time he's down
    const feet = this.centre.y - HANG;
    const g = this.ground.at(this.target.x, this.target.z);
    const left = Math.max(1, (feet - (Number.isNaN(g) ? 0 : g)) / DESCENT);
    const steer = this.target.clone().sub(this.centre).addScaledVector(wind, -left).setY(0).divideScalar(left);
    if (steer.length() > 1.3) steer.setLength(1.3);
    const want = wind.clone().addScaledVector(steer, open);
    const before = this.vel.clone();
    this.vel.x = damp(this.vel.x, want.x, t < 0.95 ? 1.2 : 1.6, dt);
    this.vel.z = damp(this.vel.z, want.z, t < 0.95 ? 1.2 : 1.6, dt);
    this.vel.y = -sink;
    this.centre.addScaledVector(this.vel, dt);
    // the swing: a pendulum under the canopy, kicked as it opens and he's yanked back, and by the wind's gusts
    const s = this.swing;
    const kick = before.sub(this.vel).multiplyScalar(open > 0 && open < 1 ? 0.06 : 0.01);
    s.vx += (-SWAY * s.x - 0.35 * s.vx) * dt + kick.z * 0.5 + (chance(dt * 0.3) ? rand(-0.08, 0.08) : 0);
    s.vz += (-SWAY * s.z - 0.35 * s.vz) * dt - kick.x * 0.5 + (chance(dt * 0.3) ? rand(-0.08, 0.08) : 0);
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    // turning slowly under the canopy as he goes; facing the way he's steering, near the end
    this.yaw += this.spin * dt * open;
    if (left < 6 && steer.lengthSq() > 0.01) {
      const face = Math.atan2(-want.z, want.x);
      this.yaw += Math.atan2(Math.sin(face - this.yaw), Math.cos(face - this.yaw)) * (1 - Math.exp(-1.2 * dt));
    }
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(s.x * open, 0, s.z * open));
    const turn = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), this.yaw);
    this.root.quaternion.copy(tilt).multiply(turn);
    this.root.position.copy(this.centre).add(V(0, -HANG, 0).applyQuaternion(tilt));
    // the canopy: nothing, then streaming out above and back towards the plane, then blossoming
    canopy.visible = t > 0.35;
    if (t < 0.95) {
      const k = smooth(clamp((t - 0.35) / 0.6, 0, 1));
      canopy.scale.set(0.12 * CANOPY, (0.25 + k * 0.95) * CANOPY, 0.12 * CANOPY);
      canopy.rotation.z = -1.1 * (1 - k);
      this.body.rotation.z = -0.35;                        // tucked, chin down, as they teach you
    } else {
      const k = clamp((t - 0.95) / 0.9, 0, 1);
      const bloom = 0.12 + 0.88 * smooth(k) + Math.sin(k * Math.PI * 2.2) * 0.14 * (1 - k);
      const breathe = Math.sin(clock * 2.1 + this.yaw) * 0.025;
      canopy.scale.set((bloom + breathe) * CANOPY, (1.2 - 0.2 * smooth(k) - breathe) * CANOPY, (bloom + breathe) * CANOPY);
      this.body.rotation.z = -0.35 * (1 - smooth(k));
    }
    // hands on the risers, pulling one down to steer; legs dangling, together for the landing
    this.armsUp(smooth(clamp((t - 1) / 0.6, 0, 1)), clock, clamp(steer.z, -1, 1) * open);
    const ready = left < 3 ? 1 : 0;
    this.legs.forEach((l, i) => {
      l.rotation.z = (1 - ready) * Math.sin(clock * 1.6 + i * 2.1) * 0.12 + ready * 0.25;
      l.rotation.x = (i === 0 ? -1 : 1) * (1 - ready) * 0.06;
    });
    if (t < 0.95) this.legs.forEach((l) => (l.rotation.z = 0.5));
    // the kit bag, let down on its line once he's open, so it lands first
    if (t > 3.5) this.hang = Math.min(3, this.hang + dt * 2);
    const under = this.ground.at(this.root.position.x, this.root.position.z);
    const hang = Math.max(0, Math.min(this.hang, feet + 0.3 - (Number.isNaN(under) ? -0.4 : under)));
    this.bag.position.set(0.1, 0.85 - hang, 0);
    this.bagline.scale.set(1, Math.max(0.01, hang), 1);
    this.bagline.visible = hang > 0.15;
    // down
    const here = this.ground.at(this.root.position.x, this.root.position.z);
    const floor = Number.isNaN(here) ? -0.4 : here;
    if (this.root.position.y <= floor) {
      this.phase = 'down';
      this.st = 0;
      this.root.position.y = floor;
      // turned to face downwind, where the canopy goes over
      if (drift.lengthSq() > 0.01) this.yaw = Math.atan2(-drift.y, drift.x);
      this.root.quaternion.setFromAxisAngle(V(0, 1, 0), this.yaw);
      this.side = chance(0.5) ? 1 : -1;
      if (chance(0.4)) this.onCall?.('thump', this.root.position.clone(), true);
    }
  }

  private gather(dt: number, clock: number) {
    const st = this.st;
    const canopy = this.canopies[this.colour];
    // a roll as he lands (feet, calf, thigh, hip, shoulder), on his side a moment, and up
    const roll = st < 0.5 ? smooth(st / 0.5) : st < 1.7 ? 1 : 1 - smooth((st - 1.7) / 0.9);
    this.body.rotation.x = this.side * 1.45 * roll;
    this.legs.forEach((l) => (l.rotation.z = 0.5 * roll));
    // the canopy: over and down in front of him, breathing in the wind, then hauled in hand over hand
    const over = smooth(clamp(st / 2.4, 0, 1));
    const haul = smooth(clamp((st - 3.5) / 4.5, 0, 1));
    const flap = Math.sin(clock * 3.1) * 0.06 * (1 - haul);
    // (over on its side, its dome's axis along the ground ahead of him, then flattened against the ground: across it is the canopy's x)
    canopy.rotation.z = -Math.PI / 2 * over;
    canopy.position.set(0.6 * over * (1 - haul) + 0.45 * haul, (2 - 1.75 * over) * (1 - haul) + 1.0 * haul, 0);
    const keep = (1 - 0.92 * haul) * CANOPY;
    canopy.scale.set((1 - 0.85 * over + flap) * keep, (1 + 0.1 * over) * keep, (1 - 0.15 * over) * keep);
    canopy.visible = haul < 1;
    this.bundles[this.colour].visible = haul >= 1;
    // up on his feet, and hauling: arms going hand over hand
    if (st > 2.6) {
      const k = haul > 0 && haul < 1 ? 1 : 0;
      this.arms.forEach((a, i) => {
        a.rotation.z = 0.9 + k * Math.sin(clock * 7 + i * Math.PI) * 0.5 + (haul >= 1 ? 0.1 : 0);
        a.rotation.x = i === 0 ? -0.15 : 0.15;
      });
      this.body.rotation.z = -0.15 * k;
    }
    // the bag beside him where it landed, picked up with the rest
    this.bag.position.set(0.5, 0.55, 0.35);
    this.bag.visible = haul < 1;
    this.bagline.visible = false;
    if (st > 9.5) this.setOff();
  }

  private setOff() {
    // onto the way off at the nearest point ahead of him, and along it
    let best = 0;
    let bestD = Infinity;
    WAY_OFF.forEach((p, i) => {
      const d = p.distanceToSquared(this.root.position.clone().setY(0));
      if (d < bestD) [best, bestD] = [i, d];
    });
    this.way = WAY_OFF.slice(Math.min(best + 1, WAY_OFF.length - 1)).map((p) => p.clone().add(V(rand(-0.6, 0.6), 0, rand(-0.6, 0.6))));
    this.phase = 'walking';
    this.st = 0;
  }

  private walk(dt: number, clock: number) {
    const p = this.root.position;
    const goal = this.way[0];
    const d = goal.clone().sub(p).setY(0);
    const pace = WALK * (this.wave > 0 ? 0 : 1);
    if (d.length() < 0.4) {
      this.way.shift();
    } else {
      d.setLength(Math.min(d.length(), pace * dt));
      p.add(d);
      const face = Math.atan2(-d.z, d.x);
      const now = new THREE.Euler().setFromQuaternion(this.root.quaternion, 'YXZ').y;
      this.root.quaternion.setFromAxisAngle(V(0, 1, 0), now + Math.atan2(Math.sin(face - now), Math.cos(face - now)) * (1 - Math.exp(-6 * dt)));
    }
    const h = this.ground.at(p.x, p.z);
    if (!Number.isNaN(h)) p.y = damp(p.y, h, 12, dt);
    // the bundle in his arms, a steady march
    const stride = Math.sin(clock * 6.2 + p.x);
    this.legs.forEach((l, i) => (l.rotation.z = (i === 0 ? 1 : -1) * stride * 0.45 * (pace ? 1 : 0)));
    this.arms.forEach((a, i) => {
      a.rotation.z = 1.0;
      a.rotation.x = i === 0 ? -0.15 : 0.15;
    });
    this.body.position.y = Math.abs(stride) * 0.04;
    this.bundles[this.colour].visible = true;
    // and into the trees: gone in a few steps
    const end = WAY_OFF[WAY_OFF.length - 1];
    const near = p.clone().setY(0).distanceTo(end);
    if (this.way.length <= 1 && near < 4) this.fade.value = clamp(near / 4, 0, 1);
    if (!this.way.length || this.fade.value <= 0.02) {
      this.phase = 'idle';
      this.root.visible = false;
    }
  }
}

/**
 * The Airborne commemoration, the weekend of the third Saturday of September: every year the
 * old Dakotas come over the heath above Arnhem again, and they jump, in memory of September
 * 1944. On the island, now and then through the day, one comes over high along the south of the
 * island, or three in a vee, the drone of their engines heard a while before they are, and a
 * stick of parachutists goes out of each door one after another, and comes down over the
 * meadows and the beach, the sky full of canopies. They land, roll, haul their canopies in and
 * walk off along the beach in ones and twos into the woods.
 */
export class Airborne {
  private planes: Plane[] = [];
  private jumpers: Jumper[] = [];
  private wait = WANTED ? 3 : rand(20, 90);
  private sorties = 0;
  private clock = 0;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(
    scene: THREE.Scene,
    island: Island,
    private ground: Ground,
    private drift: THREE.Vector2,
  ) {
    const plane = island.get('dakota');
    const chute = island.get('parachute');
    if (plane) plane.visible = false;
    if (chute) chute.visible = false;
    if (!occasions.has('airborne') || !plane || !chute) return;
    for (let i = 0; i < WINGMEN.length; i++) this.planes.push(new Plane(plane, scene));
    for (let i = 0; i < POOL; i++) {
      const j = new Jumper(chute, scene, ground);
      j.onCall = (c, at, ambient) => this.onCall?.(c, at, ambient);
      this.jumpers.push(j);
    }
  }

  /** Everyone up there and down here who can be clicked, for the Picker. */
  get pickables() {
    return [...this.planes.map((p) => p.root), ...this.jumpers.map((j) => j.root)];
  }

  /** Someone clicked a jumper: the nearest one on his feet to `at` waves. */
  poke(at: THREE.Vector3) {
    let best: Jumper | null = null;
    for (const j of this.jumpers) if (j.phase !== 'idle' && (!best || j.position.distanceTo(at) < best.position.distanceTo(at))) best = j;
    best?.poke();
  }

  /** A spot to land on: clear ground on the beach or in the meadows, not too near anyone else's. */
  private spot(x: number) {
    const taken = this.jumpers.filter((j) => j.phase === 'falling' || j.phase === 'down').map((j) => j.position);
    let at = V();
    for (let tries = 0; tries < 12; tries++) {
      at = V(clamp(x + rand(-3, 3), ZONE.x0, ZONE.x1), 0, rand(ZONE.z0, ZONE.z1));
      const h = this.ground.at(at.x, at.z);
      if (Number.isNaN(h) || h < 0.05 || h > 1.6) continue;
      if (CLEAR.some(([cx, cy, r]) => Math.hypot(at.x - cx, at.z + cy) < r)) continue;
      if (taken.some((p) => Math.hypot(p.x - at.x, p.z - at.z) < 2.2)) continue;
      break;
    }
    return at;
  }

  /** `hour`: island time, 0..24; `rain`, `wind` (m/s): nobody jumps in a storm. */
  update(dt: number, hour: number, rain: number, wind: number) {
    if (!this.planes.length) return;
    this.clock += dt;
    const flyable = (hour >= 10 && hour < 17.5 && rain < 0.3 && wind < 13) || WANTED;
    const busy = this.planes.some((p) => p.flying);
    if (!busy && flyable && (this.wait -= dt) < 0) this.sortie();
    for (const p of this.planes) {
      if (!p.flying) continue;
      p.update(dt, this.clock);
      // the engines' drone, a while before they're overhead
      if (!p.heard && p.slot.lengthSq() === 0 && Math.abs(p.root.position.x) < 45) {
        p.heard = true;
        this.onCall?.('dakota', p.root.position.clone());
      }
      // over the drop zone: green light, and out they go, one after another
      const zone = p.dir > 0 ? ZONE.x0 : ZONE.x1;
      if (p.left > 0 && (p.root.position.x - zone + p.dir * 4) * p.dir > 0 && (p.next -= dt) <= 0) {
        const j = this.jumpers.find((x) => x.phase === 'idle');
        if (j) {
          const lead = this.drift.x * DRIFT * 10;
          j.jump(p.door, p.velocity.add(V(0, -0.5, p.dir * -1.4)), this.spot(p.root.position.x + p.dir * 8 + lead), chance(0.75) ? 0 : chance(0.85) ? 1 : 2);
          p.hook(j);
        }
        p.left--;
        p.next = EXIT;
      }
      if (Math.abs(p.root.position.x) > REACH + 15 && p.root.position.x * p.dir > 0) p.land();
    }
    for (const j of this.jumpers) {
      j.update(dt, this.clock, this.drift);
      if (j.free) for (const p of this.planes) for (const s of p.lines) if (s.jumper === j) s.jumper = null;
    }
  }

  /** One plane, or now and then three in a vee (always three, the first time with ?airborne). */
  private sortie() {
    const vee = (WANTED && this.sorties === 0) || chance(0.4);
    const dir = chance(0.65) ? -1 : 1; // more often westwards, so the door's this side
    const n = vee ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const p = this.planes[i];
      p.flying = true;
      p.root.visible = true;
      p.dir = dir;
      p.x = -dir * REACH;
      p.slot.copy(vee ? WINGMEN[i] : WINGMEN[0]);
      p.left = vee ? STICK.vee : STICK.single;
      p.next = 0;
      p.heard = false;
    }
    this.sorties++;
    this.wait = WANTED ? 50 : rand(200, 420);
  }
}
