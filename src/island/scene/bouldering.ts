import * as THREE from 'three';
import type { Ground } from './beike';
import { pressGrass } from './grass';
import type { Island } from './island';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ease = (k: number) => THREE.MathUtils.smootherstep(THREE.MathUtils.clamp(k, 0, 1), 0, 1);

/** His limbs (pastimes.py `climber`): joint in the body's frame, and the lengths to the elbow and the hand (or knee and sole). */
const ARM = { at: (s: number) => V(s * 0.34, 0.48, 0), a: 0.3, b: 0.34 };
const LEG = { at: (s: number) => V(s * 0.13, 0, 0), a: 0.42, b: 0.45 };
const HIP = 0.84; // standing, hips above the soles
const OFF = 0.36; // hips out from the rock, on it
const MOVE = 1.0; // seconds to reach for the next hold

type Limb = 'lh' | 'rh' | 'lf' | 'rf';
type Hold = 'h0' | 'h1' | 'h2' | 'h3' | 'h4' | 'f0' | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 't0' | 't1';
/** The problem, a stance at a time: which hold each hand and foot is on (pastimes.py PROBLEM). */
const STANCES: Record<Limb, Hold>[] = [
  { lh: 'h0', rh: 'h1', lf: 'f0', rf: 'f1' },
  { lh: 'h0', rh: 'h2', lf: 'f0', rf: 'f1' },
  { lh: 'h0', rh: 'h2', lf: 'f0', rf: 'f3' },
  { lh: 'h3', rh: 'h2', lf: 'f0', rf: 'f3' },
  { lh: 'h3', rh: 'h2', lf: 'f2', rf: 'f3' },
  { lh: 'h3', rh: 'h4', lf: 'f2', rf: 'f3' },
  { lh: 'h3', rh: 'h4', lf: 'f2', rf: 'f5' },
  { lh: 'h3', rh: 'h4', lf: 'f4', rf: 'f5' },
  { lh: 't0', rh: 'h4', lf: 'f4', rf: 'f5' },
  { lh: 't0', rh: 't1', lf: 'f4', rf: 'f5' },
];

/** Where everything is, in the boulder's frame: the hips and which way the body faces, and the hands and feet. */
interface Pose {
  hips: THREE.Vector3;
  forward: THREE.Vector3; // the way the chest faces
  up: THREE.Vector3; // up the spine
  lh: THREE.Vector3;
  rh: THREE.Vector3;
  lf: THREE.Vector3;
  rf: THREE.Vector3;
  look: number; // head pitch: + up
  turn: number; // head yaw
  knees: number; // 0 knees forward … 1 frogged out to the sides (on the rock)
}

const blank = (): Pose => ({ hips: V(), forward: V(0, 0, 1), up: V(0, 1, 0), lh: V(), rh: V(), lf: V(), rf: V(), look: 0, turn: 0, knees: 0 });
function copy(to: Pose, p: Pose) {
  for (const k of ['hips', 'forward', 'up', 'lh', 'rh', 'lf', 'rf'] as const) to[k].copy(p[k]);
  to.look = p.look;
  to.turn = p.turn;
  to.knees = p.knees;
  return to;
}
function mix(to: Pose, a: Pose, b: Pose, k: number) {
  for (const key of ['hips', 'lh', 'rh', 'lf', 'rf'] as const) to[key].lerpVectors(a[key], b[key], k);
  to.forward.lerpVectors(a.forward, b.forward, k).normalize();
  to.up.lerpVectors(a.up, b.up, k).normalize();
  to.look = a.look + (b.look - a.look) * k;
  to.turn = a.turn + (b.turn - a.turn) * k;
  to.knees = a.knees + (b.knees - a.knees) * k;
  return to;
}

type Phase =
  | 'arrive' | 'sit' | 'chalk' | 'rise' | 'start' | 'climb' | 'rest'
  | 'slip' | 'hang' | 'fall' | 'land' | 'flop' | 'lie' | 'situp'
  | 'mantle' | 'top' | 'turn' | 'jump' | 'touch' | 'off';
/** Which way he faces, stood up: 0 to the rock (north, -z), π away from it. */
const facing = (yaw: number) => V(Math.sin(yaw), 0, -Math.cos(yaw));

/**
 * Vincent on the boulder up on the north-west cliffs (pastimes.py `bouldering`): sat on his pad
 * looking up at the problem, working it out; chalking up; then up it a move at a time, a hand or a
 * foot onto the next hold, the body following, now and then a hand off to shake out. Most tries
 * he comes off somewhere: a foot skates and he hangs off his hands a moment, or a hand pops; down
 * onto the pad, sometimes flat on his back on it, and he sits back down to think about it. Some
 * he tops out: presses up over the lip, a foot up, stood, arms up; then he turns round and jumps
 * off onto the pad (or climbs off the back and walks round).
 *
 * His body is posed every frame from where its hands and feet are (two-bone IK for each limb).
 */
export class Bouldering {
  readonly root?: THREE.Object3D;
  private body?: THREE.Object3D;
  private head?: THREE.Object3D;
  private bones = new Map<string, THREE.Object3D>();
  private holds = new Map<Hold, { at: THREE.Vector3; out: THREE.Vector3 }>();
  private seat = V();
  private bag = V();
  private phase: Phase = 'arrive';
  private t = 0;
  private length = 0;
  private clock = 0;
  /** On the problem: the stance he's in, the one he's moving to, and the move he'll come off at (or never). */
  private stance = 0;
  private fallAt = Infinity;
  private shake: Limb | null = null;
  private pose = blank();
  private from = blank();
  private goal = blank();
  private path: THREE.Vector3[] = [];
  /** Turning on the spot: where he stands, from and to which way, and what comes after. */
  private spin = { at: V(), from: 0, to: 0, then: () => {} };
  private slipped: 'lf' | 'rf' = 'lf';
  /** Tries since he got here, and how many he's sent. */
  tries = 0;
  sent = 0;
  /** Chalk off his hands (life.ts puffs it), and his landing on the pad. */
  onChalk?: (at: THREE.Vector3) => void;
  onLand?: (at: THREE.Vector3) => void;

  constructor(
    island: Island,
    private ground: Ground,
  ) {
    this.root = island.get('vincent_boulder');
    const climber = this.root?.getObjectByName('boulder_climber');
    // the climber's own frame is the boulder's: everything below is posed in it
    climber?.position.set(0, 0, 0);
    climber?.rotation.set(0, 0, 0);
    this.body = this.root?.getObjectByName('boulder_body');
    this.head = this.root?.getObjectByName('boulder_head');
    for (const side of ['l', 'r']) {
      for (const b of ['upper', 'fore', 'thigh', 'shin']) {
        const o = this.root?.getObjectByName(`boulder_${b}_${side}`);
        if (o) this.bones.set(`${b}_${side}`, o);
      }
    }
    for (const name of ['h0', 'h1', 'h2', 'h3', 'h4', 'f0', 'f1', 'f2', 'f3', 'f4', 'f5', 't0', 't1'] as Hold[]) {
      const at = this.root?.getObjectByName(`boulder_hold_${name}`)?.position;
      const out = this.root?.getObjectByName(`boulder_hold_${name}_out`)?.position;
      if (at && out) this.holds.set(name, { at: at.clone(), out: out.clone().sub(at).normalize() });
    }
    const seat = this.root?.getObjectByName('boulder_pad_seat');
    const bag = this.root?.getObjectByName('boulder_bag');
    if (seat) this.seat.copy(seat.position);
    if (bag) this.bag.copy(bag.position);
    if (this.root) this.root.visible = false;
  }

  set visible(on: boolean) {
    if (!this.root) return;
    if (on && !this.root.visible) this.begin();
    this.root.visible = on;
    this.press(on);
  }

  /** The pad flattens the grass it lies on (grass.ts). */
  private press(on: boolean) {
    if (!on || !this.root) return pressGrass('boulder_pad', null);
    this.root.updateWorldMatrix(true, false);
    const box = new THREE.Box3();
    for (const [x, z] of [[-0.8, -0.95], [0.8, -0.95], [-0.8, 0.6], [0.8, 0.6]]) box.expandByPoint(this.root.localToWorld(this.seat.clone().add(V(x, 0, z))));
    const mid = box.getCenter(V());
    const half = box.getSize(V()).multiplyScalar(0.5);
    pressGrass('boulder_pad', mid, new THREE.Vector2(half.x, half.z));
  }

  /** Where he sits on his pad, facing the rock: to walk to, and to get up from. */
  get pad() {
    return this.root?.getObjectByName('boulder_pad_seat');
  }

  /** His head (breath on a cold day). */
  get face() {
    return this.head;
  }

  /** What he's doing, for the clicks: 'sit' working it out, 'climb' on it, 'fall' coming off, 'top' up on top. */
  get doing(): 'thinking' | 'climbing' | 'falling' | 'topped' {
    if (this.phase === 'climb' || this.phase === 'rest' || this.phase === 'start') return 'climbing';
    if (['slip', 'hang', 'fall', 'land', 'flop', 'lie', 'situp'].includes(this.phase)) return 'falling';
    if (['mantle', 'top', 'turn', 'jump', 'touch', 'off'].includes(this.phase)) return 'topped';
    return 'thinking';
  }

  /** Just got here: standing on the pad, about to sit down to look at it. */
  begin() {
    this.tries = 0;
    this.standing(this.pose);
    this.go('arrive', 1.2);
  }

  // --- the poses -------------------------------------------------------------------

  private hold(name: Hold, out: number) {
    const h = this.holds.get(name);
    return h ? h.at.clone().addScaledVector(h.out, out) : V();
  }

  private groundAt(x: number, z: number) {
    const root = this.root;
    if (!root) return 0;
    const w = root.localToWorld(V(x, 0, z));
    const y = this.ground.at(w.x, w.z);
    return Number.isNaN(y) ? 0 : root.worldToLocal(w.setY(y)).y;
  }

  /** Stood on the pad, facing the rock, arms by his sides. */
  private standing(p: Pose, at = this.seat) {
    p.hips.copy(at).add(V(0, HIP, 0.1));
    p.forward.set(0, 0, -1);
    p.up.set(0, 1, 0);
    // facing the rock (north, -z), his left is -x
    p.lf.copy(at).add(V(-0.15, 0, 0.12));
    p.rf.copy(at).add(V(0.15, 0, 0.12));
    p.lh.copy(p.hips).add(V(-0.36, -0.12, 0.08));
    p.rh.copy(p.hips).add(V(0.36, -0.12, 0.08));
    p.look = 0.15;
    p.turn = 0;
    p.knees = 0;
    return p;
  }

  /** Sat on the pad, knees up, forearms on them, looking up at the problem. */
  private sitting(p: Pose) {
    p.hips.copy(this.seat).add(V(0, 0.13, 0.3));
    p.forward.set(0, 0.25, -1).normalize();
    p.up.set(0, 1, 0.12).normalize();
    p.lf.copy(this.seat).add(V(-0.2, 0.02, -0.4));
    p.rf.copy(this.seat).add(V(0.2, 0.02, -0.4));
    p.lh.copy(this.seat).add(V(-0.24, 0.5, -0.24));
    p.rh.copy(this.seat).add(V(0.24, 0.5, -0.24));
    p.look = 0.55;
    p.turn = 0;
    p.knees = 0;
    return p;
  }

  /** On the rock, in a stance: hips out from it and low, under the hands, reaching where he must. */
  private onRock(p: Pose, st: Record<Limb, Hold>) {
    p.lh.copy(this.hold(st.lh, 0.07));
    p.rh.copy(this.hold(st.rh, 0.07));
    p.lf.copy(this.hold(st.lf, 0.05));
    p.rf.copy(this.hold(st.rf, 0.05));
    const hands = V().addVectors(p.lh, p.rh).multiplyScalar(0.5);
    const feet = V().addVectors(p.lf, p.rf).multiplyScalar(0.5);
    const out = V();
    for (const h of Object.values(st)) out.add(this.holds.get(h)?.out ?? V(0, 0, 1));
    out.y *= 0.4; // stay upright, mostly: it's the rock that tilts
    out.normalize();
    p.up.subVectors(hands, feet).normalize();
    p.forward.copy(out).negate();
    p.forward.addScaledVector(p.up, -p.forward.dot(p.up)).normalize();
    p.hips.lerpVectors(feet, hands, 0.38).addScaledVector(out, OFF);
    // close enough for every hand and foot to reach, with the arms near straight
    for (let i = 0; i < 4; i++) {
      for (const [limb, side, spec, reach] of [['lh', 1, ARM, 0.62], ['rh', -1, ARM, 0.62], ['lf', 1, LEG, 0.84], ['rf', -1, LEG, 0.84]] as const) {
        const joint = this.joint(p, spec.at(side));
        const d = joint.distanceTo(p[limb]);
        if (d > reach) p.hips.addScaledVector(V().subVectors(p[limb], joint).normalize(), (d - reach) * 0.6);
      }
    }
    p.look = 0.35;
    p.turn = 0;
    p.knees = 1;
    return p;
  }

  /** Up on top, standing, the rock under his feet, still facing the way he came up (north). */
  private onTop(p: Pose) {
    const a = this.hold('t0', 0);
    const b = this.hold('t1', 0);
    const mid = V().addVectors(a, b).multiplyScalar(0.5);
    p.lf.copy(a).add(V(-0.05, 0, 0));
    p.rf.copy(b).add(V(0.05, 0, 0));
    p.hips.copy(mid).add(V(0, HIP, 0));
    p.forward.set(0, 0, -1);
    p.up.set(0, 1, 0);
    p.lh.copy(p.hips).add(V(-0.36, -0.1, -0.05));
    p.rh.copy(p.hips).add(V(0.36, -0.1, -0.05));
    p.look = 0.1;
    p.turn = 0;
    p.knees = 0;
    return p;
  }

  /** Stood on the spot at `at` (between his feet), facing `yaw`, a foot up off it (`lift`: + left, - right). */
  private stood(p: Pose, at: THREE.Vector3, yaw: number, lift = 0) {
    p.forward.copy(facing(yaw));
    p.up.set(0, 1, 0);
    const side = V().crossVectors(p.up, p.forward).normalize(); // his left
    p.hips.copy(at).add(V(0, HIP - Math.abs(lift) * 0.04, 0));
    p.lf.copy(at).addScaledVector(side, 0.15).add(V(0, Math.max(0, lift) * 0.12, 0));
    p.rf.copy(at).addScaledVector(side, -0.15).add(V(0, Math.max(0, -lift) * 0.12, 0));
    p.lh.copy(p.hips).addScaledVector(side, 0.36).addScaledVector(p.forward, 0.06).add(V(0, -0.12, 0));
    p.rh.copy(p.hips).addScaledVector(side, -0.36).addScaledVector(p.forward, 0.06).add(V(0, -0.12, 0));
    p.look = 0.05;
    p.turn = 0;
    p.knees = 0;
    return p;
  }

  /** Flat on his back on the pad, head away from the rock, knees up, arms out: that one hurt his pride. */
  private lying(p: Pose) {
    p.hips.copy(this.seat).add(V(0, 0.12, -0.05));
    p.up.set(0, 0.12, 1).normalize();
    p.forward.set(0, 1, -0.12).normalize();
    p.lf.copy(this.seat).add(V(-0.22, 0.02, -0.6));
    p.rf.copy(this.seat).add(V(0.26, 0.02, -0.55));
    p.lh.copy(this.seat).add(V(-0.62, 0.03, 0.42));
    p.rh.copy(this.seat).add(V(0.6, 0.03, 0.5));
    p.look = -0.25;
    p.turn = 0;
    p.knees = 0.15;
    return p;
  }

  /** Over the top of the rock: the lip's way from up there, towards the pad. */
  private get lip() {
    const mid = V().addVectors(this.hold('t0', 0), this.hold('t1', 0)).multiplyScalar(0.5);
    return { mid, out: V().subVectors(this.seat, mid).setY(0).normalize() };
  }

  /** Where a joint is, for a pose (its offset in the body's frame). */
  private joint(p: Pose, offset: THREE.Vector3) {
    const side = V().crossVectors(p.up, p.forward).normalize();
    return p.hips.clone().addScaledVector(side, offset.x).addScaledVector(p.up, offset.y).addScaledVector(p.forward, offset.z);
  }

  // --- the climbing ----------------------------------------------------------------

  /** Off the rock, onto the pad: further to fall, the longer it takes. */
  private drop() {
    this.go('fall', 0.45 + Math.sqrt(Math.max(0, this.pose.hips.y - this.seat.y - HIP)) * 0.3);
  }

  private turnRound(at: THREE.Vector3, from: number, to: number, then: () => void) {
    this.spin = { at: at.clone(), from, to, then };
    this.go('turn', 0.5 * Math.abs(to - from));
  }

  private go(phase: Phase, length: number) {
    copy(this.from, this.pose);
    this.phase = phase;
    this.t = 0;
    this.length = length;
  }

  update(dt: number) {
    if (!this.root?.visible || !this.body) return;
    this.clock += dt;
    this.t += dt;
    const k = this.length ? this.t / this.length : 1;
    const p = this.pose;
    const g = this.goal;
    switch (this.phase) {
      case 'arrive': // stood on the pad: down onto it
        mix(p, this.from, this.sitting(g), ease(k));
        if (k >= 1) this.go('sit', rand(6, 14));
        break;
      case 'sit': {
        // looking up the line, now and then a hand up miming the moves
        this.sitting(p);
        p.turn = Math.sin(this.clock * 0.4) * 0.15;
        const mime = Math.max(0, Math.sin(this.t * 1.3)) * (this.t % 9 > 5 ? 1 : 0);
        p.rh.add(V(0.1, 0.35 * mime, -0.15 * mime));
        p.look = 0.55 + mime * 0.15;
        if (k >= 1) this.go('chalk', 3);
        break;
      }
      case 'chalk': {
        // a hand in the bag beside him, then a rub of the two together
        this.sitting(p);
        const dip = this.bag.clone().add(V(0, 0.02, 0));
        const rub = p.hips.clone().add(V(Math.sin(this.t * 14) * 0.05, 0.38, -0.3));
        if (k < 0.5) p.rh.lerp(dip, Math.sin(Math.min(1, k * 2) * Math.PI));
        else {
          const m = Math.min(1, (k - 0.5) * 6, (1 - k) * 6);
          p.rh.lerp(rub.clone().add(V(0.05, 0, 0)), m);
          p.lh.lerp(rub.clone().add(V(-0.05, Math.sin(this.t * 14) * 0.03, 0)), m);
        }
        p.look = k < 0.5 ? -0.2 : 0.2;
        if (k > 0.55 && k < 0.9 && Math.floor((this.t - dt) * 2) !== Math.floor(this.t * 2)) this.onChalk?.(this.root.localToWorld(rub.clone()));
        if (k >= 1) this.go('rise', 1.1);
        break;
      }
      case 'rise': // up off the pad
        mix(p, this.from, this.standing(g), ease(k));
        if (k >= 1) {
          this.tries++;
          // where he comes off this time, if he does: further up the more he's tried
          const send = Math.random() < Math.min(0.55, 0.12 + this.tries * 0.1);
          this.fallAt = send ? Infinity : Math.floor(rand(2, Math.min(STANCES.length - 1, 3 + this.tries * 1.5)));
          this.stance = 0;
          this.go('start', 1.6);
        }
        break;
      case 'start': // a step to the wall, hands on the start holds, and off the ground
        mix(p, this.from, this.onRock(g, STANCES[0]), ease(k));
        if (k >= 1) this.go('rest', rand(0.8, 1.6));
        break;
      case 'rest': {
        // between moves: settled on the holds, maybe a hand off to shake out
        this.onRock(p, STANCES[this.stance]);
        const shake = this.shake;
        if (shake) {
          const off = Math.sin(Math.min(1, k) * Math.PI);
          const hip = p.hips.clone().addScaledVector(p.forward, -0.1).add(V(0, -0.15, 0));
          p[shake].lerp(hip.add(V(Math.sin(this.t * 16) * 0.06, 0, 0)), off);
          p.turn = (shake === 'lh' ? 0.4 : -0.4) * off;
        }
        if (k >= 1) {
          this.shake = null;
          if (this.stance >= STANCES.length - 1) this.go('mantle', 3.4);
          else if (this.stance + 1 >= this.fallAt) {
            // a foot goes, and he hangs a moment; or a hand pops and he's straight off
            if (Math.random() < 0.6) {
              this.slipped = Math.random() < 0.5 ? 'lf' : 'rf';
              this.go('slip', 0.35);
            } else this.drop();
          } else this.go('climb', MOVE * rand(0.85, 1.3));
        }
        break;
      }
      case 'climb': {
        // one hand or foot to the next hold, out from the rock and in, the body following
        const a = STANCES[this.stance];
        const b = STANCES[this.stance + 1];
        const limb = (Object.keys(a) as Limb[]).find((l) => a[l] !== b[l]) ?? 'rh';
        this.onRock(this.from, a);
        this.onRock(g, b);
        const bodyK = ease(k * 1.2 - 0.1);
        mix(p, this.from, g, bodyK);
        const reach = ease(k * 1.4 - 0.25);
        p[limb].lerpVectors(this.from[limb], g[limb], reach);
        const out = this.holds.get(b[limb])?.out ?? V(0, 0, 1);
        p[limb].addScaledVector(out, Math.sin(reach * Math.PI) * 0.14);
        p.look = 0.35 + (limb[1] === 'h' ? 0.25 : -0.5) * Math.sin(k * Math.PI);
        p.turn = (limb[0] === 'l' ? 0.25 : -0.25) * Math.sin(k * Math.PI);
        if (k >= 1) {
          this.stance++;
          this.shake = this.stance > 2 && this.stance < STANCES.length - 2 && Math.random() < 0.3 ? (Math.random() < 0.5 ? 'lh' : 'rh') : null;
          this.go('rest', this.shake ? rand(2, 3) : rand(0.4, 1.3));
        }
        break;
      }
      case 'slip': {
        // a foot skates off its hold: the leg swings out and the hips sag off the rock
        this.onRock(p, STANCES[this.stance]);
        const f = this.slipped;
        const out = V().copy(p.forward).negate();
        const kk = ease(k);
        p[f].addScaledVector(out, 0.18 * kk).add(V(f === 'lf' ? -0.12 : 0.12, -0.35 * kk, 0));
        p.hips.addScaledVector(out, 0.08 * kk).add(V(0, -0.06 * kk, 0));
        p.look = 0.35 - 0.6 * kk; // down at it
        if (k >= 1) this.go('hang', rand(0.6, 1.1));
        break;
      }
      case 'hang': {
        // off his feet, hanging off his hands, swinging, then they go too
        this.onRock(g, STANCES[this.stance]);
        const out = V().copy(g.forward).negate();
        const hands = V().addVectors(g.lh, g.rh).multiplyScalar(0.5);
        const hang = copy(this.goal, g);
        hang.hips.copy(hands).addScaledVector(out, 0.28).add(V(Math.sin(this.t * 5) * 0.07 * (1 - k), -1.0, 0));
        hang.up.subVectors(hands, hang.hips).normalize();
        hang.lf.copy(hang.hips).addScaledVector(out, 0.12).add(V(-0.12, -0.84, 0));
        hang.rf.copy(hang.hips).addScaledVector(out, 0.18).add(V(0.14, -0.8, 0));
        hang.knees = 0;
        hang.look = 0.6;
        mix(p, this.from, hang, ease(Math.min(1, k * 3)));
        if (k >= 1) this.drop();
        break;
      }
      case 'fall': {
        // off: the hands come away, flung up, and down onto the pad
        const land = this.standing(g);
        land.hips.y -= 0.35; // knees bent on landing
        land.lh.add(V(0.1, 0.5, 0.1));
        land.rh.add(V(-0.1, 0.5, 0.1));
        const drop = k * k;
        mix(p, this.from, land, ease(k * 1.5));
        p.hips.y = this.from.hips.y + (land.hips.y - this.from.hips.y) * drop;
        const fling = Math.sin(Math.min(1, k * 1.4) * Math.PI);
        p.lh.add(V(-0.15 * fling, 0.3 + 0.3 * fling, 0.2 * fling));
        p.rh.add(V(0.15 * fling, 0.3 + 0.3 * fling, 0.2 * fling));
        p.look = 0.4 * (1 - k);
        if (k >= 1) {
          this.onLand?.(this.root.localToWorld(this.seat.clone()));
          // from high up, or just now and then, he goes over backwards onto the pad
          const high = this.from.hips.y - this.seat.y - HIP;
          if (Math.random() < 0.2 + high * 0.25) this.go('flop', 0.9);
          else this.go('land', 1.6);
        }
        break;
      }
      case 'land': // a moment crouched, then down to sit and look at where it went wrong
        mix(p, this.from, this.sitting(g), ease((k - 0.35) / 0.65));
        if (k >= 1) this.go('sit', rand(8, 16));
        break;
      case 'flop': // over backwards, flat out on the pad
        mix(p, this.from, this.lying(g), ease(k));
        if (k >= 1) this.go('lie', rand(2.5, 4.5));
        break;
      case 'lie': // a while staring up at the sky, a hand over his face
        this.lying(p);
        p.rh.lerp(this.head ? p.hips.clone().addScaledVector(p.up, 0.62).addScaledVector(p.forward, 0.18) : p.rh, Math.sin(Math.min(1, k * 1.3) * Math.PI));
        if (k >= 1) this.go('situp', 1.6);
        break;
      case 'situp':
        mix(p, this.from, this.sitting(g), ease(k));
        if (k >= 1) this.go('sit', rand(8, 16));
        break;
      case 'mantle': {
        // hands pressed down on the top, up over them, a foot up onto it, and stood up
        const { mid, out } = this.lip;
        const press = copy(this.goal, this.from);
        press.lh.copy(this.hold('t0', 0.02));
        press.rh.copy(this.hold('t1', 0.02));
        press.hips.copy(mid).addScaledVector(out, 0.42).add(V(0, -0.1, 0));
        press.forward.copy(out).negate().add(V(0, -0.5, 0)).normalize();
        press.up.set(0, 1, 0);
        press.lf.copy(this.from.lf).add(V(0, 0.25, 0));
        press.rf.copy(this.from.rf).add(V(0, 0.45, 0)).addScaledVector(out, 0.12);
        press.look = -0.1;
        press.knees = 0.6;
        const foot = copy(blank(), press);
        foot.hips.copy(mid).addScaledVector(out, 0.2).add(V(0, 0.45, 0));
        foot.forward.copy(out).negate().add(V(0, -0.7, 0)).normalize();
        foot.rf.copy(this.hold('t1', 0)).addScaledVector(out, 0.2);
        foot.lf.copy(press.lf).add(V(0, 0.15, 0)).addScaledVector(out, 0.1);
        foot.knees = 0.3;
        const stand = this.onTop(blank());
        if (k < 0.4) mix(p, this.from, press, ease(k / 0.4));
        else if (k < 0.7) mix(p, press, foot, ease((k - 0.4) / 0.3));
        else mix(p, foot, stand, ease((k - 0.7) / 0.3));
        if (k >= 1) this.go('top', 3.2);
        break;
      }
      case 'top': {
        // stood up on top: both arms up a moment, a look round
        copy(p, this.onTop(g));
        const cheer = Math.sin(Math.min(1, (k - 0.1) / 0.45) * Math.PI) * (k > 0.1 ? 1 : 0);
        p.lh.lerp(p.hips.clone().add(V(-0.3, 1.25, 0)), cheer);
        p.rh.lerp(p.hips.clone().add(V(0.3, 1.25, 0)), cheer);
        p.look = 0.1 + cheer * 0.3;
        p.turn = k > 0.6 ? Math.sin((k - 0.6) / 0.4 * Math.PI * 2) * 0.5 : 0;
        if (k >= 1) {
          this.sent++;
          const { mid } = this.lip;
          if (Math.random() < 0.75) this.turnRound(mid, 0, Math.PI, () => this.go('jump', 1.7));
          else {
            this.path = [V(-0.3, 0, -1.2), V(-1.2, 0, -2.4), V(-2.6, 0, -1.6), V(-2.6, 0, 0.8), V(-1.2, 0, 2.3), this.seat.clone().add(V(0, 0, 0.1))];
            this.go('off', 9);
          }
        }
        break;
      }
      case 'turn': {
        // round on the spot, a step at a time
        const { at, from, to } = this.spin;
        const kk = ease(k);
        const steps = Math.max(2, Math.round(Math.abs(to - from) / 0.8));
        const lift = Math.sin(k * steps * Math.PI) * (Math.floor(k * steps) % 2 ? -1 : 1);
        this.stood(p, at, from + (to - from) * kk, lift);
        if (k >= 1) this.spin.then();
        break;
      }
      case 'jump': {
        // a step to the edge, crouch, arms back, and off: down onto the pad, landing in a crouch
        const { mid, out } = this.lip;
        const edge = mid.clone().addScaledVector(out, 0.3);
        const top = this.stood(blank(), edge, Math.PI);
        const crouch = copy(blank(), top);
        crouch.hips.y -= 0.32;
        crouch.hips.addScaledVector(out, 0.08);
        crouch.lh.addScaledVector(out, -0.3).add(V(0, 0.05, 0));
        crouch.rh.addScaledVector(out, -0.3).add(V(0, 0.05, 0));
        crouch.look = -0.4;
        const land = this.stood(g, this.seat.clone().add(V(0, 0, 0.1)), Math.PI);
        land.hips.y -= 0.36;
        land.lh.addScaledVector(out, 0.25).add(V(0, 0.2, 0));
        land.rh.addScaledVector(out, 0.25).add(V(0, 0.2, 0));
        land.look = -0.3;
        if (k < 0.2) mix(p, this.from, top, ease(k / 0.2));
        else if (k < 0.45) mix(p, top, crouch, ease((k - 0.2) / 0.25));
        else {
          // in the air: the hips on an arc, legs tucked under, arms up and out for balance
          const a = Math.min(1, (k - 0.45) / 0.35);
          mix(p, crouch, land, a);
          const y0 = crouch.hips.y + 0.3;
          const y1 = land.hips.y;
          const peak = Math.max(y0, y1) + 0.25;
          // a parabola through the take-off, the top of it, and the landing
          const s = Math.sqrt(peak - y0) / (Math.sqrt(peak - y0) + Math.sqrt(peak - y1));
          p.hips.y = a < s ? peak - (peak - y0) * ((s - a) / s) ** 2 : peak - (peak - y1) * ((a - s) / (1 - s)) ** 2;
          if (a < 1) {
            const air = Math.sin(a * Math.PI);
            const side = V().crossVectors(V(0, 1, 0), p.forward).normalize();
            p.lf.copy(p.hips).addScaledVector(side, 0.15).add(V(0, -0.72 + air * 0.12, 0)).addScaledVector(out, 0.05);
            p.rf.copy(p.hips).addScaledVector(side, -0.15).add(V(0, -0.72 + air * 0.12, 0)).addScaledVector(out, 0.05);
            p.lh.copy(p.hips).addScaledVector(side, 0.5).add(V(0, 0.5 * air + 0.1, 0));
            p.rh.copy(p.hips).addScaledVector(side, -0.5).add(V(0, 0.5 * air + 0.1, 0));
            p.look = 0.1 - a * 0.4;
          }
        }
        if (k >= 0.8 && this.t - dt < this.length * 0.8) this.onLand?.(this.root.localToWorld(this.seat.clone()));
        if (k >= 1) this.go('touch', 0.9);
        break;
      }
      case 'touch': // up out of the crouch, and round to face the rock again
        mix(p, this.from, this.stood(g, this.seat.clone().add(V(0, 0, 0.1)), Math.PI), ease(k));
        if (k >= 1) this.turnRound(this.seat.clone().add(V(0, 0, 0.1)), Math.PI, 2 * Math.PI, () => this.go('arrive', 1.2));
        break;
      case 'off': {
        // off the back and round to the pad: a walk, mostly out of sight behind the rock
        const path = [this.from.hips.clone().setY(this.from.hips.y - HIP), ...this.path];
        const lengths = path.slice(1).map((q, i) => q.distanceTo(path[i]));
        const total = lengths.reduce((s, l) => s + l, 0);
        let d = ease(k) * total;
        let i = 0;
        while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
        const at = V().lerpVectors(path[i], path[i + 1], Math.min(1, d / lengths[i]));
        if (i > 0) at.y = Math.max(this.groundAt(at.x, at.z), at.distanceTo(this.seat) < 0.9 ? this.seat.y : -Infinity);
        const dir = V().subVectors(path[i + 1], path[i]).setY(0).normalize();
        const final = k > 0.92;
        this.walking(p, at, final ? V(0, 0, -1) : dir, ease(k) * total);
        if (k >= 1) this.go('arrive', 1.2);
        break;
      }
    }
    this.apply(p);
  }

  /** On his feet, walking from `at` towards `dir`: a step each 0.6 m, arms swinging. */
  private walking(p: Pose, at: THREE.Vector3, dir: THREE.Vector3, gone: number) {
    const phase = (gone / 0.6) * Math.PI;
    p.forward.lerp(dir, 0.15).normalize();
    p.up.set(0, 1, 0);
    p.hips.copy(at).add(V(0, HIP - 0.03 + Math.abs(Math.cos(phase)) * 0.03, 0));
    const side = V().crossVectors(p.up, p.forward).normalize();
    for (const [limb, s, off] of [['lf', 1, 0], ['rf', -1, Math.PI]] as const) {
      const swing = Math.sin(phase + off);
      p[limb].copy(at).addScaledVector(side, s * 0.14).addScaledVector(p.forward, swing * 0.22).add(V(0, Math.max(0, Math.cos(phase + off)) * 0.1, 0));
    }
    for (const [limb, s, off] of [['lh', 1, Math.PI], ['rh', -1, 0]] as const) {
      p[limb].copy(p.hips).addScaledVector(side, s * 0.38).addScaledVector(p.forward, Math.sin(phase + off) * 0.18).add(V(0, -0.12, 0));
    }
    p.look = 0;
    p.knees = 0;
  }

  // --- the body, from the pose -----------------------------------------------------

  private basis = new THREE.Matrix4();
  private q = new THREE.Quaternion();

  private apply(p: Pose) {
    const body = this.body!;
    body.position.copy(p.hips);
    const side = V().crossVectors(p.up, p.forward).normalize();
    const up = V().crossVectors(p.forward, side).normalize();
    this.basis.makeBasis(side, up, p.forward);
    body.quaternion.setFromRotationMatrix(this.basis);
    body.updateMatrixWorld(true);
    this.head?.rotation.set(-p.look, p.turn, 0);
    this.reach('l', 'upper', 'fore', ARM, p.lh, V(1.2, -1, -0.6));
    this.reach('r', 'upper', 'fore', ARM, p.rh, V(-1.2, -1, -0.6));
    this.reach('l', 'thigh', 'shin', LEG, p.lf, V(0.3 + p.knees * 1.4, 0.8, 1));
    this.reach('r', 'thigh', 'shin', LEG, p.rf, V(-0.3 - p.knees * 1.4, 0.8, 1));
  }

  /** Two bones, from the joint to `target` (in the boulder's frame), bending towards `pole` (in the body's frame). */
  private reach(side: 'l' | 'r', a: string, b: string, spec: typeof ARM, target: THREE.Vector3, pole: THREE.Vector3) {
    const upper = this.bones.get(`${a}_${side}`);
    const lower = this.bones.get(`${b}_${side}`);
    const parent = upper?.parent;
    if (!upper || !lower || !parent || !this.root) return;
    const t = parent.worldToLocal(this.root.localToWorld(target.clone()));
    const s = upper.position;
    const to = V().subVectors(t, s);
    const d = THREE.MathUtils.clamp(to.length(), Math.abs(spec.a - spec.b) + 0.02, spec.a + spec.b - 0.002);
    const u = to.normalize();
    // the pole's in the body's frame; the arms hang off the torso, which turns with it
    const bend = pole.clone().normalize();
    bend.addScaledVector(u, -bend.dot(u)).normalize();
    const x = (spec.a * spec.a - spec.b * spec.b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, spec.a * spec.a - x * x));
    const elbow = s.clone().addScaledVector(u, x).addScaledVector(bend, h);
    upper.quaternion.setFromUnitVectors(DOWN, V().subVectors(elbow, s).normalize());
    const hand = s.clone().addScaledVector(u, d);
    const local = V().subVectors(hand, elbow).applyQuaternion(this.q.copy(upper.quaternion).invert()).normalize();
    lower.quaternion.setFromUnitVectors(DOWN, local);
  }
}

const DOWN = new THREE.Vector3(0, -1, 0);
