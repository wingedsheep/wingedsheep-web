import * as THREE from 'three';
import type { Ground } from './beike';
import type { Call } from './fauna';
import type { Island } from './island';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const damp = THREE.MathUtils.damp;
const smooth = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;

const HIP = 0.84; // hips over the soles (outings.py)
const WALK = 0.9; // m/s, barefoot over hot sand
const WADE = 0.5; // m/s, pushing through the water
const SWIM = 0.42; // m/s, breaststroke
const STROKE = 1.7; // seconds a stroke
const DEEP = -0.95; // where the sea's this deep, they stop wading and swim
const SURFACE = -0.3; // the hips' height, swimming: chin just clear of the water
/**
 * How far apart two of them keep in the water (m): across the screen, and up it. The camera looks
 * north and down, so a gap up the screen reads at about half its size, and one of them swimming
 * just beyond the other is drawn half over them. Lying back with their arms out, more room still.
 */
const APART = { x: 1.7, z: 3.0, float: 1.4 };
/** Where they swim about (Blender x, y of the middle, and the radii): off the beach west of the pier, clear of it and of the kayak. */
const SEA = { x: -8.5, y: -20.6, rx: 3.2, ry: 1.0 };

type Phase = 'sit' | 'lie' | 'in' | 'wade' | 'swim' | 'float' | 'back' | 'out' | 'up' | 'dry';
/** What they're up to, for what's said when you click them (content.ts). */
export type Doing = 'sitting' | 'sunbathing' | 'wading' | 'swimming' | 'floating' | 'drying';
const DOING: Record<Phase, Doing> = {
  sit: 'sitting', lie: 'sunbathing', in: 'wading', wade: 'wading', swim: 'swimming', float: 'floating', back: 'swimming', out: 'wading', up: 'wading', dry: 'drying',
};

/** How they hold themselves, eased from one moment to the next. */
interface Shape {
  pitch: number; // the body tipped forward (+, swimming) or back (−, lying)
  hip: number; // the hips' height (world)
  legX: [number, number];
  legZ: [number, number];
  shin: [number, number];
  armX: [number, number];
  armZ: [number, number];
  headX: number;
  headY: number;
}
const shape = (): Shape => ({ pitch: 0, hip: HIP, legX: [0, 0], legZ: [0, 0], shin: [0, 0], armX: [0, 0], armZ: [0, 0], headX: 0, headY: 0 });

/**
 * A swim on a hot day (outings.py `vincent_bather`, `companion_bather`, and their towels on the
 * beach west of the pier). They sit on the towel a moment, walk down into the sea, wade out till
 * it's deep enough and swim: breaststroke, chin up, to and fro off the beach, now and then
 * turning over to float on their back. Then back in, a shake to get the water off, and a lie in
 * the sun on the towel, a knee up, before going in again. With the other one in the water too
 * they swim side by side, and float together.
 *
 * Asked to `finish`, they make for the beach, and once they're back on the towel they're
 * `ashore`: the owner (vincent.ts, companion.ts) can take them off somewhere else, out of sight.
 */
export class Bather {
  readonly root?: THREE.Object3D;
  private core?: THREE.Object3D;
  private parts = new Map<string, THREE.Object3D>();
  private towel?: THREE.Object3D;
  /** The towel's middle, the water's edge straight down the beach from it, and where it's deep enough to swim. */
  private spot = V();
  private edge = V();
  private deep = V();
  private slope = 0;
  private phase: Phase = 'sit';
  private t = 0;
  private length = 0;
  private clock = 0;
  private stroke = 0;
  private swum = 0;
  private step = 0;
  private floated = false;
  private finishing = false;
  private target = V();
  private now = shape();
  private want = shape();
  /** Where they are (world x, z; y unused) and which way they face. */
  readonly at = V();
  heading = 0;
  /** Swimming alongside the other one (who leads). */
  private following = false;
  /** The other one, if they're in for a swim too. */
  other?: Bather;
  /** Water thrown up: a stroke (small), or going right in (big). */
  onSplash?: (at: THREE.Vector3, big: boolean) => void;
  /** Their own sounds: a slosh at every step wading, going under (and a gasp at the cold), each stroke, shaking off. */
  onSound?: (call: Call, at: THREE.Vector3, loud?: number) => void;

  constructor(
    island: Island,
    private ground: Ground,
    id: string,
    private prefix: string,
    towel: string,
    /** Their gasp as the water reaches their chest: his, or hers. */
    private gasp: 'gasp' | 'gasp-e' = 'gasp',
  ) {
    this.root = island.get(id);
    this.root?.traverse((o) => this.parts.set(o.name, o));
    this.core = this.part('core');
    this.towel = island.get(towel);
    if (this.towel) {
      this.towel.getWorldPosition(this.spot);
      this.slope = Math.atan2(this.groundAt(this.spot.x, this.spot.z - 0.8) - this.groundAt(this.spot.x, this.spot.z + 0.8), 1.6);
      // straight down the beach (+z is south, out to sea) to the water, and on till it's deep enough
      this.edge.copy(this.spot);
      while (this.edge.z < 40 && this.groundAt(this.edge.x, this.edge.z) > 0.02) this.edge.z += 0.1;
      this.deep.copy(this.edge);
      while (this.deep.z < 40 && this.groundAt(this.deep.x, this.deep.z) > DEEP) this.deep.z += 0.1;
    }
    this.visible = false;
  }

  set visible(on: boolean) {
    if (this.root) this.root.visible = on;
    if (this.towel) this.towel.visible = on;
  }

  get visible() {
    return !!this.root?.visible;
  }

  /** Where their towel is (for whether anyone's looking before they turn up on it). */
  get towelAt() {
    return this.spot;
  }

  /** Where the sea starts, straight down the beach from their towel. */
  get waterline() {
    return this.edge;
  }

  /** Back on the towel, done for now (or not yet in). */
  get ashore() {
    return this.phase === 'sit' || this.phase === 'lie';
  }

  /** Out in the sea, swimming or floating. */
  get swimming() {
    return this.visible && (this.phase === 'swim' || this.phase === 'float' || this.phase === 'back');
  }

  get doing(): Doing {
    return DOING[this.phase];
  }

  get head() {
    return this.part('head');
  }

  /** Down to the towel: a moment sitting on it, then in. */
  begin() {
    this.finishing = false;
    this.floated = false;
    this.at.set(this.spot.x, 0, this.spot.z - 0.35);
    this.heading = 0;
    this.go('sit', rand(4, 10));
    this.target.copy(this.deep);
    this.update(0);
  }

  /** Time to go: out of the water (if they're in it) and back to the towel. */
  finish() {
    this.finishing = true;
  }

  update(dt: number) {
    this.clock += dt;
    this.t += dt;
    const w = this.want;
    Object.assign(w, shape());
    // called back on the way in: they turn round
    if (this.finishing && (this.phase === 'in' || this.phase === 'wade')) this.go(this.phase === 'in' ? 'up' : 'out');
    switch (this.phase) {
      case 'sit':
        this.sitting(w);
        if (this.t > this.length && !this.finishing) this.go('in');
        break;
      case 'lie':
        this.lying(w);
        if (this.t > this.length && !this.finishing) this.go('sit', rand(3, 7));
        break;
      case 'in':
      case 'up': {
        // down the sand to the water, or back up it to the towel
        const to = this.phase === 'in' ? this.edge : V(this.spot.x, 0, this.spot.z + 0.25);
        const there = this.walk(to, WALK, dt);
        this.walking(w, 0.45);
        if (there && this.phase === 'up') this.onSound?.('shake', this.at.clone().setY(1.6));
        if (there) this.go(this.phase === 'in' ? 'wade' : 'dry', rand(3, 5));
        break;
      }
      case 'wade':
      case 'out': {
        const there = this.walk(this.phase === 'wade' ? this.deep : this.edge, WADE, dt);
        this.walking(w, 0.25);
        // hands held up out of it, going in; trailing in it, coming out
        const up = this.phase === 'wade' ? 1 : 0.4;
        w.armX = [-0.35 * up, -0.35 * up];
        w.armZ = [0.5 * up, -0.5 * up];
        if (!there) break;
        if (this.phase === 'out') this.go('up');
        else {
          this.onSplash?.(this.at.clone().setY(0), true);
          this.onSound?.('duck', this.at.clone().setY(0));
          if (Math.random() < 0.7) this.onSound?.(this.gasp, this.at.clone().setY(0.4));
          this.go('swim');
          this.swum = rand(45, 90);
          this.pick();
        }
        break;
      }
      case 'swim':
      case 'back': {
        // with the other one in too, one of them keeps alongside the other
        const o = this.other?.swimming && !this.other.following ? this.other : null;
        this.following = !!o && this.phase === 'swim';
        if (this.phase === 'swim') {
          if (o) this.alongside(o);
          if ((this.swum -= dt) < 0 || this.finishing) {
            // over on their back for a while first, some swims, or along with the other one
            if (!this.floated && !this.finishing && Math.random() < 0.4) this.go('float', rand(8, 14));
            else {
              this.go('back');
              this.target.copy(this.deep);
            }
            break;
          }
          if (o?.phase === 'float' && this.at.distanceTo(o.at) < 3.5 && !this.floated) {
            this.go('float', rand(8, 12));
            break;
          }
        }
        const c = this.stroke % 1;
        const speed = SWIM * (0.55 + 0.9 * Math.max(0, Math.sin((c - 0.7) * Math.PI * 2)));
        const there = this.walk(this.target, speed, dt, 1.2);
        const before = this.stroke;
        this.stroke += dt / STROKE;
        if (Math.floor(before + 0.85) !== Math.floor(this.stroke + 0.85)) {
          // the pull: a little water over the hands
          const ahead = this.at.clone().add(V(Math.sin(this.heading) * 0.5, 0, Math.cos(this.heading) * 0.5));
          this.onSplash?.(ahead, false);
          this.onSound?.('swimstroke', ahead, 0.8 + Math.random() * 0.4);
        }
        this.breaststroke(w);
        if (there && this.phase === 'back') this.go('out');
        else if (there && !o) this.pick();
        break;
      }
      case 'float':
        this.floating(w);
        if (this.t > this.length) {
          this.floated = true;
          this.go('swim');
          this.swum = this.finishing ? 0 : rand(15, 35);
          this.pick();
        }
        break;
      case 'dry':
        // shaking the water off: the head, then the arms
        this.standing(w);
        w.headY = Math.sin(this.t * 16) * 0.35 * Math.max(0, 1 - this.t / 1.2);
        w.armX = [-0.3 + Math.sin(this.t * 12) * 0.25, -0.3 - Math.sin(this.t * 12) * 0.25];
        w.armZ = [0.35, -0.35];
        if (this.t > this.length) this.go('lie', rand(25, 50));
        break;
    }
    this.apart(dt);
    this.pose(dt);
  }

  private go(phase: Phase, length = 0) {
    this.phase = phase;
    if (phase !== 'swim') this.following = false;
    this.t = 0;
    this.length = length;
    if (phase === 'sit') this.at.set(this.spot.x, 0, this.spot.z - 0.35);
    if (phase === 'lie') this.at.set(this.spot.x, 0, this.spot.z - 0.1);
    if (phase === 'sit' || phase === 'lie') this.heading = 0; // feet to the sea
  }

  /**
   * Swimming alongside `o`: level with them, on whichever side we're already on, far enough out
   * that the two of them don't overlap on screen whichever way they're going.
   */
  private alongside(o: Bather) {
    const px = Math.cos(o.heading);
    const pz = -Math.sin(o.heading);
    const side = Math.sign((this.at.x - o.at.x) * px + (this.at.z - o.at.z) * pz) || 1;
    const gap = 1 / Math.hypot(px / APART.x, pz / APART.z);
    this.target.copy(o.at).add(V(px * side * gap, 0, pz * side * gap));
  }

  /** In the water with the other one: whatever they're each doing, they ease apart if they're too close. */
  private apart(dt: number) {
    const o = this.other;
    if (!dt || !o?.swimming || !this.swimming) return;
    let dx = this.at.x - o.at.x;
    let dz = this.at.z - o.at.z;
    if (Math.hypot(dx, dz) < 1e-3) [dx, dz] = [this.prefix < o.prefix ? -0.01 : 0.01, 0];
    const k = this.phase === 'float' || o.phase === 'float' ? APART.float : 1;
    const e = Math.hypot(dx / (APART.x * k), dz / (APART.z * k)); // under 1: too close
    if (e >= 1) return;
    // each moves half the way out to the edge of the other's room, over a second or so
    const push = (1 / Math.max(e, 0.05) - 1) * 0.5 * Math.min(1, dt * 2);
    this.at.x += dx * push;
    this.at.z += dz * push;
  }

  /** Somewhere else to swim to, off the beach. */
  private pick() {
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random());
    this.target.set(SEA.x + Math.cos(a) * SEA.rx * r, 0, -(SEA.y + Math.sin(a) * SEA.ry * r));
  }

  /** On towards `to` at `speed`, turning to face it (at `turn` radians a second, or straight away). Whether they're there. */
  private walk(to: THREE.Vector3, speed: number, dt: number, turn = 0) {
    const dx = to.x - this.at.x;
    const dz = to.z - this.at.z;
    const d = Math.hypot(dx, dz);
    const step = speed * dt;
    const face = Math.atan2(dx, dz);
    if (d > 0.05) {
      const off = Math.atan2(Math.sin(face - this.heading), Math.cos(face - this.heading));
      this.heading += turn ? clamp(off, -turn * dt, turn * dt) : off * (1 - Math.exp(-8 * dt));
    }
    if (d <= Math.max(step, 0.3)) {
      this.at.x = to.x;
      this.at.z = to.z;
      return true;
    }
    // swimming, they go the way they're facing (and come round to it)
    const hx = turn ? Math.sin(this.heading) : dx / d;
    const hz = turn ? Math.cos(this.heading) : dz / d;
    this.at.x += hx * step;
    this.at.z += hz * step;
    return false;
  }

  private groundAt(x: number, z: number) {
    const h = this.ground.at(x, z);
    return Number.isNaN(h) ? -2 : h;
  }

  // --- how they hold themselves -------------------------------------------------------

  private standing(w: Shape) {
    w.hip = this.groundAt(this.at.x, this.at.z) + HIP;
  }

  private walking(w: Shape, swing: number) {
    this.standing(w);
    const p = this.clock * Math.PI * (swing > 0.3 ? 2 : 1.4);
    // a foot down: in the water, a slosh
    if (Math.floor(p / Math.PI) !== this.step) {
      this.step = Math.floor(p / Math.PI);
      if (this.phase === 'wade' || this.phase === 'out') this.onSound?.('slosh', this.at.clone().setY(0), 0.7 + Math.random() * 0.4);
    }
    const s = Math.sin(p) * swing;
    w.hip += Math.abs(Math.cos(p)) * 0.03;
    w.legX = [s, -s];
    w.shin = [Math.max(0, Math.sin(p + 0.9)) * swing * 1.2, Math.max(0, -Math.sin(p + 0.9)) * swing * 1.2];
    w.armX = [-s * 0.9, s * 0.9];
  }

  /** On the towel, leaning back on their hands, a knee up, looking out to sea. */
  private sitting(w: Shape) {
    w.pitch = -0.25 + this.slope;
    w.hip = this.groundAt(this.at.x, this.at.z) + 0.12;
    w.legX = [-1.32, -2.1];
    w.shin = [0, 1.7];
    w.armX = [0.55, 0.55];
    w.armZ = [0.2, -0.2];
    w.headX = 0.25 + Math.sin(this.clock * 0.3) * 0.05;
    w.headY = Math.sin(this.clock * 0.25) * 0.35;
  }

  /** Flat on their back in the sun, a hand behind the head and a knee up. */
  private lying(w: Shape) {
    w.pitch = -Math.PI / 2 + this.slope;
    w.hip = this.groundAt(this.at.x, this.at.z) + 0.13;
    w.legX = [0, -0.8];
    w.shin = [0, 1.6];
    w.armX = [-2.9, 0];
    w.armZ = [-0.35, -0.12];
    w.headY = Math.sin(this.clock * 0.1) * 0.2;
  }

  /** Breaststroke: reach, pull round and in, kick, glide; the head up out of it all the while. */
  private breaststroke(w: Shape) {
    const c = this.stroke % 1;
    const pull = c < 0.55 ? smooth(c, 0.1, 0.5) : 1 - smooth(c, 0.55, 0.85);
    const kick = Math.sin(clamp((c - 0.45) / 0.4, 0, 1) * Math.PI);
    w.pitch = 1.2;
    w.hip = SURFACE + pull * 0.07;
    w.armX = [-3.0 + pull * 1.5, -3.0 + pull * 1.5];
    w.armZ = [Math.sin(pull * Math.PI) * 0.6, -Math.sin(pull * Math.PI) * 0.6];
    w.legZ = [kick * 0.45, -kick * 0.45];
    w.shin = [kick * 1.5, kick * 1.5];
    w.headX = -1.05 - pull * 0.1;
  }

  /** On their back, arms out, ears in the water, looking at the sky. */
  private floating(w: Shape) {
    w.pitch = -1.45;
    w.hip = -0.06 + Math.sin(this.clock * 1.3) * 0.025;
    w.armZ = [1.3, -1.3];
    w.legZ = [0.2, -0.2];
    w.headX = 0.15;
    w.headY = Math.sin(this.clock * 0.2) * 0.15;
  }

  private pose(dt: number) {
    const root = this.root;
    if (!root) return;
    // into a new way of holding themselves gently, then keeping up with it
    const k = !dt ? Infinity : this.t < 0.8 ? 5 : 16;
    const n = this.now;
    const w = this.want;
    const e = (a: number, b: number) => (k === Infinity ? b : damp(a, b, k, dt));
    n.pitch = e(n.pitch, w.pitch);
    n.hip = e(n.hip, w.hip);
    n.headX = e(n.headX, w.headX);
    n.headY = e(n.headY, w.headY);
    for (const i of [0, 1]) {
      n.legX[i] = e(n.legX[i], w.legX[i]);
      n.legZ[i] = e(n.legZ[i], w.legZ[i]);
      n.shin[i] = e(n.shin[i], w.shin[i]);
      n.armX[i] = e(n.armX[i], w.armX[i]);
      n.armZ[i] = e(n.armZ[i], w.armZ[i]);
    }
    root.position.set(this.at.x, 0, this.at.z);
    root.rotation.set(0, this.heading, 0);
    if (this.core) {
      this.core.position.y = n.hip;
      this.core.rotation.set(n.pitch, 0, 0);
    }
    for (const [i, side] of [[0, 'l'], [1, 'r']] as const) {
      this.part(`leg_${side}`)?.rotation.set(n.legX[i], 0, n.legZ[i]);
      this.part(`shin_${side}`)?.rotation.set(n.shin[i], 0, 0);
      this.part(`arm_${side}`)?.rotation.set(n.armX[i], 0, n.armZ[i]);
    }
    this.part('head')?.rotation.set(n.headX, n.headY, 0);
  }

  private part(name: string) {
    return this.parts.get(`${this.prefix}_${name}`);
  }
}
