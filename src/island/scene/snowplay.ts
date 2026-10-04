import * as THREE from 'three';
import type { Ground } from './beike';
import type { Call } from './fauna';
import type { Island } from './island';
import type { Pose, Walker } from './outings';
import { toon } from './toon';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ease = THREE.MathUtils.smoothstep;
const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);
const UP = V(0, 1, 0);
/** Whether `at` (seconds) went by in the last `dt`. */
const passed = (t: number, dt: number, at: number) => t >= at && t - dt < at;

/** On a snowy day he asks her out to play in it (vincent.ts asks, companion.ts comes). */
export const play = { asked: false, joined: false };

// where it all happens (Blender x, y: tools/models/snowplay.py SNOWMAN), and the fight's two ends
const SNOWMAN: [number, number] = [-2.5, -10.7];
const ENDS: Record<'v' | 'e', [number, number]> = { v: [1.5, -12.0], e: [-4.0, -12.7] };
// the balls stacked (snowplay.py BASE, MIDDLE, HEAD): heights of their centres
const STACK = { base: 0.36, middle: 0.936, head: 1.3615 };
const PUSH = 0.42; // m/s, rolling a ball that's getting heavier
const WALK = 1.0; // m/s, about the place
const THROW = 7.5; // m/s, a snowball across the plaza
const THROWS: [number, number] = [10, 15]; // each, before they've had enough
export const BARE = 0.08; // snow on the ground (0..1) below which there's none to build with, or throw

const STILL: Pose = { walk: 0, phase: 0, crouch: 0, lean: 0, look: 0, turn: 0, behind: 0, reach: 0, hold: 0, mug: false, sip: 0 };
const at = (x: number, y: number) => V(x, 0, -y);

type Act = 'stand' | 'scoop' | 'pack' | 'windup' | 'throw' | 'recover' | 'shuffle';

/**
 * One of them: the walker, and what's posed over what Walker does: the arms, the twist of the
 * body, the legs stepping sideways, a hop; the snowball in hand.
 */
interface Player {
  who: 'v' | 'e';
  w: Walker;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  torso?: THREE.Object3D;
  head?: THREE.Object3D;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  ball?: THREE.Object3D;
  pose: Pose;
  /** The arms, radians about their shoulders (negative is forward and up), when not left to the pose. */
  arms: [number, number] | null;
  /** …and how far each comes in across the body (negative: out to the side). */
  inward: [number, number];
  /** The body turned at the waist (positive brings the right shoulder forward). */
  twist: number;
  /** Stepping sideways: how far the legs are apart (radians each), and a bob with it. */
  splay: number;
  hop: number;
  /** Knocked back a step by a snowball (world), easing back to nothing. */
  shove: THREE.Vector3;
  stride: number;
  act: Act;
  t: number;
  len: number;
  to: THREE.Vector3;
  thrown: number;
  /** How many they'll throw before they've had enough. */
  quota: number;
  /** Ducking (1 easing to 0), and caught by one (1 easing to 0). */
  duck: number;
  hit: number;
  /** After a hit: brushing the snow off (1 easing to 0); after landing one: arms up (1 easing to 0); a laugh. */
  brush: number;
  cheer: number;
  laugh: number;
  /** A snowball on its way to them, to keep an eye on. */
  incoming: THREE.Object3D | null;
}

/** A snowball in the air: from the hand to wherever it lands, in an arc. */
interface Flight {
  o: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  len: number;
  arc: number;
  target: Player;
  thrower: Player;
  /** On the target (a hit), or past them into the snow. */
  hits: boolean;
  ducks: boolean;
}

/** Rolling a ball for the snowman: along a spiral in towards where it's going, growing as it goes. */
interface Roll {
  o: THREE.Object3D;
  path: THREE.Vector3[];
  along: number;
  r0: number;
  r1: number;
  r: number;
  /** Seconds till the next crunch of it packing down. */
  noise: number;
}

type Phase = 'roll' | 'lift' | 'head' | 'dress' | 'admire' | 'gather' | 'fight' | 'end' | 'done';

/**
 * Out in the snow, the two of them, by day: first a snowman on the plaza (he rolls the bottom,
 * she rolls the middle; they lift it on together, she packs the head, and they give it stick
 * arms, buttons, coal for a face, a carrot and a scarf), then a snowball fight across the plaza
 * till they've had enough. The snowman stays as long as the snow does, slumping as it thaws.
 * The walkers are the strolling ones (outings.py), posed here.
 */
export class SnowPlay {
  /** The snowman (for the camera's view, and for clicking). */
  readonly yard?: THREE.Object3D;
  private parts = new Map<string, THREE.Object3D>();
  private v: Player;
  private e: Player;
  private flights: Flight[] = [];
  private phase: Phase = 'done';
  private t = 0;
  private rolls: Roll[] = [];
  /** Where they meet once they've had enough. */
  private meet = V();
  /** What their clothes are usually made of (see `unsnow`). */
  private dressed = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  /** The snowballs in the air, one each. */
  private flying: (THREE.Object3D | undefined)[];
  /** Built, and still standing (it goes once the snow does). */
  built = false;
  /** A burst of snow where a snowball lands (`size` 1), or a little kicked up (less). */
  onSplat?: (at: THREE.Vector3, size?: number) => void;
  /** Hearts over the two of them: the snowman's done, or the fight is. */
  onCheer?: (at: THREE.Vector3) => void;
  /** What it all sounds like: the snow underfoot and underhand, a snowball landing, a laugh (sound.ts plays it). */
  onSound?: (call: Call, at: THREE.Vector3, loud?: number) => void;
  /** When each last laughed (seconds, this.clock), so it isn't every snowball. */
  private laughed = { v: -9, e: -9 };
  private clock = 0;
  /** The snow on the ground, as of the last frame (0..1). */
  private lying = 0;

  constructor(
    island: Island,
    private ground: Ground,
    him: Walker,
    her: Walker,
  ) {
    this.yard = island.get('snowman');
    this.yard?.traverse((o) => {
      this.parts.set(o.name, o);
      // coal, carrot, sticks and scarf stay their colours: only the snow itself gets snowed on
      const m = o as THREE.Mesh;
      if (m.isMesh && o.name !== 'snowman_base' && o.name !== 'snowman_middle' && o.name !== 'snowman_head') {
        m.material = toon((m.material as THREE.MeshToonMaterial).color, { bare: true });
      }
    });
    const player = (who: 'v' | 'e', w: Walker, prefix: string): Player => {
      const part = (name: string) => w.root?.getObjectByName(`${prefix}_${name}`);
      const ball = part('snowball');
      if (ball) ball.visible = false;
      return {
        who, w, ball,
        armL: part('arm_l'), armR: part('arm_r'), torso: part('torso'), head: part('head'), legL: part('leg_l'), legR: part('leg_r'),
        pose: { ...STILL }, arms: null, inward: [0.15, 0.15], twist: 0, splay: 0, hop: 0, shove: V(), stride: 0,
        act: 'stand', t: 0, len: 0, to: V(), thrown: 0, quota: 0, duck: 0, hit: 0, brush: 0, cheer: 0, laugh: 0, incoming: null,
      };
    };
    this.v = player('v', him, 'stroll');
    this.e = player('e', her, 'companion_stroll');
    for (const who of ['v', 'e']) {
      const o = island.root.getObjectByName(`snowball_${who}`);
      if (o) o.visible = false;
    }
    this.flying = [island.root.getObjectByName('snowball_v'), island.root.getObjectByName('snowball_e')];
    this.show();
  }

  get done() {
    return this.phase === 'done';
  }

  /** Building the snowman, or throwing snowballs. */
  get doing(): 'building' | 'fighting' {
    return this.phase === 'gather' || this.phase === 'fight' || this.phase === 'end' ? 'fighting' : 'building';
  }

  /** There's been snow lying since before you came: of course there's a snowman already. */
  standing() {
    this.built = true;
    this.stack(true);
    this.show();
  }

  /** Out they come: the snowman first, unless there's one standing already (and not at all on bare ground). */
  begin() {
    if (this.lying < BARE) return;
    for (const p of [this.v, this.e]) {
      Object.assign(p, { thrown: 0, duck: 0, hit: 0, brush: 0, cheer: 0, laugh: 0, act: 'stand', arms: null, incoming: null });
      p.shove.set(0, 0, 0);
    }
    this.clearFlights();
    if (this.built) {
      this.v.w.at.copy(this.end('v'));
      this.e.w.at.copy(this.end('e'));
      this.go('gather');
    } else {
      this.startRolls();
      this.go('roll');
    }
    this.v.w.visible = this.e.w.visible = true;
    this.unsnow(true);
    this.update(0, this.lying);
  }

  /** Called off (or in for the day): the snowballs put away; a half-built snowman goes too. */
  stop() {
    this.clearFlights();
    for (const p of [this.v, this.e]) if (p.ball) p.ball.visible = false;
    this.unsnow(false);
    if (this.phase !== 'done' && this.doing === 'building') this.built = false;
    this.phase = 'done';
    this.show();
  }

  /**
   * One frame. `lying`: the snow on the ground (0..1); the snowman slumps as it thaws, and goes
   * with the last of it, and so does the fun: nothing to roll or throw on bare grass.
   */
  update(dt: number, lying: number) {
    this.lying = lying;
    if (lying < BARE) {
      if (this.phase !== 'done') this.go('done');
      if (this.built) {
        this.built = false; // gone with the snow
        this.show();
      }
    }
    this.thaw(lying);
    if (this.phase === 'done') return;
    this.t += dt;
    this.clock += dt;
    const v = this.v;
    const e = this.e;
    for (const p of [v, e]) {
      Object.assign(p.pose, STILL);
      Object.assign(p, { arms: null, twist: 0, splay: 0, hop: 0 });
      p.inward[0] = p.inward[1] = 0.15;
      // a duck, a hit and what comes after, a cheer, a laugh: all wearing off
      p.duck = Math.max(0, p.duck - dt / 0.9);
      p.hit = Math.max(0, p.hit - dt / 0.9);
      p.brush = p.hit ? p.brush : Math.max(0, p.brush - dt / 1.1);
      p.cheer = Math.max(0, p.cheer - dt / 1.1);
      p.laugh = Math.max(0, p.laugh - dt / 1.6);
      p.shove.multiplyScalar(Math.exp(-2.2 * dt));
    }
    switch (this.phase) {
      case 'roll': this.rolling(dt); break;
      case 'lift': this.lifting(dt); break;
      case 'head': this.heading(dt); break;
      case 'dress': this.dressing(dt); break;
      case 'admire': this.admiring(dt); break;
      case 'gather': {
        const his = this.walkTo(v, this.end('v'), WALK, dt);
        const hers = this.walkTo(e, this.end('e'), WALK, dt);
        if (his && hers) {
          for (const p of [v, e]) Object.assign(p, { thrown: 0, quota: Math.round(rand(...THROWS)) });
          this.go('fight');
          this.next(v, 'scoop');
          this.next(e, 'scoop');
          e.t = -rand(0.8, 1.6); // not quite together
        }
        break;
      }
      case 'fight': this.fighting(dt); break;
      case 'end':
        this.ending(dt);
        break;
    }
    this.fly(dt);
    for (const p of [v, e]) this.pose(p);
  }

  private go(phase: Phase) {
    this.phase = phase;
    this.t = 0;
    this.v.t = this.e.t = 0;
    if (phase === 'admire') this.onCheer?.(this.middle(this.v.w.at, this.e.w.at).add(V(0, 2, 0)));
    if (phase === 'done') this.stop();
    this.show();
  }

  // --- the snowman -----------------------------------------------------------------------

  private part(name: string) {
    return this.parts.get(name);
  }

  /** Its place, on the ground (world). */
  private get spot() {
    return this.yard?.getWorldPosition(V()) ?? at(...SNOWMAN);
  }

  private end(who: 'v' | 'e') {
    return this.onGround(at(...ENDS[who]));
  }

  private onGround(p: THREE.Vector3) {
    const h = this.ground.at(p.x, p.z);
    p.y = Number.isNaN(h) ? this.spot.y : h;
    return p;
  }

  /** A spiral in to `to` (world), starting `r` metres off at `from` radians (Blender's, anticlockwise from east) and turning through `sweep`. */
  private spiral(to: THREE.Vector3, r: number, from: number, sweep: number) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const a = from + sweep * u;
      const d = r * Math.pow(1 - u, 0.85);
      pts.push(this.onGround(V(to.x + Math.cos(a) * d, 0, to.z - Math.sin(a) * d)));
    }
    return pts;
  }

  private startRolls() {
    const s = this.spot;
    const base = this.part('snowman_base');
    const middle = this.part('snowman_middle');
    this.rolls = [];
    // he rolls the bottom in from the south-east, round to the spot; she the middle, to just behind it
    if (base) this.rolls.push({ o: base, path: this.spiral(s, 2.8, -0.6, -1.9), along: 0, r0: 0.1, r1: 0.42, r: 0.1, noise: 0.5 });
    if (middle) this.rolls.push({ o: middle, path: this.spiral(V(s.x + 0.3, 0, s.z - 1.25), 2.4, 0.5, 1.7), along: 0, r0: 0.08, r1: 0.3, r: 0.08, noise: 1 });
    for (const r of this.rolls) r.o.quaternion.identity();
    for (const n of ['snowman_arms', 'snowman_buttons', 'snowman_scarf', 'snowman_face', 'snowman_nose']) {
      const o = this.part(n);
      if (o) o.visible = false;
    }
    const head = this.part('snowman_head');
    if (head) head.visible = false;
  }

  private placeBall(o: THREE.Object3D, world: THREE.Vector3, r: number) {
    o.scale.setScalar(r / (o.userData.snow_r ?? r));
    if (this.yard) o.position.copy(this.yard.worldToLocal(world.clone()));
  }

  /** Each pushing a ball, bent over it, arms out; a ball done, they stand back and wait for the other. */
  private rolling(dt: number) {
    const players = [this.v, this.e];
    let rolling = 0;
    this.rolls.forEach((r, i) => {
      const p = players[i];
      const total = r.path.slice(1).reduce((sum, b, k) => sum + b.distanceTo(r.path[k]), 0);
      const going = r.along < total;
      const heavy = (r.r - r.r0) / (r.r1 - r.r0); // slower going, the bigger it gets
      const step = going ? Math.min(PUSH * (1.25 - heavy * 0.55) * dt, total - r.along) : 0;
      r.along += step;
      r.r = r.r0 + (r.r1 - r.r0) * Math.pow(r.along / total, 0.7);
      // where along the path, and which way
      let k = r.along;
      let seg = 1;
      while (seg < r.path.length - 1 && k > r.path[seg].distanceTo(r.path[seg - 1])) k -= r.path[seg].distanceTo(r.path[seg++ - 1]);
      const a = r.path[seg - 1];
      const b = r.path[seg];
      const dir = b.clone().sub(a).setY(0).normalize();
      const c = a.clone().lerp(b, Math.min(1, k / Math.max(1e-3, a.distanceTo(b))));
      this.onGround(c);
      const centre = c.clone().add(V(0, r.r * 0.86, 0));
      this.placeBall(r.o, centre, r.r);
      // rolled along the snow: about the axis across the way it's going
      if (step) r.o.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(V(dir.z, 0, -dir.x), step / r.r));
      if (going) {
        rolling++;
        p.w.at.copy(this.onGround(c.clone().addScaledVector(dir, -(r.r + 0.4))));
        p.w.heading = Math.atan2(dir.x, dir.z);
        p.stride += (dt / (1.1 + heavy * 0.5)) * Math.PI;
        Object.assign(p.pose, { walk: 0.55 + heavy * 0.2, phase: p.stride, lean: 0.35 + heavy * 0.45, look: 0.35 + heavy * 0.15 });
        // a shove with each step, the shoulders into it
        const shove = Math.sin(p.stride * 2) * 0.07;
        p.arms = [-1.0 - r.r * 0.7 + shove, -1.0 - r.r * 0.7 - shove];
        p.inward = [0.25, 0.25];
        p.twist = Math.sin(p.stride) * 0.12;
        if (Math.random() < dt * 3) this.onSplat?.(c.clone().addScaledVector(dir, r.r * 0.7), 0.3); // snow coming up off the front
        if ((r.noise -= dt) < 0) {
          r.noise = rand(1, 1.5);
          this.say('snowroll', centre, 0.6 + heavy * 0.6);
        }
      } else {
        // done: hands on hips (or folded), and a look at how the other's getting on
        p.pose.behind = 1;
        p.pose.turn = Math.sin(this.t * 0.7) * 0.2;
        this.face(p, players[1 - i].w.at, dt);
      }
    });
    if (!rolling && this.t > 1) this.go('lift');
  }

  /** Both to the middle ball, down for it, and up onto the bottom one with it. */
  private lifting(dt: number) {
    const middle = this.part('snowman_middle');
    if (!middle || !this.yard) return this.go('head');
    const path = this.rolls[1]?.path;
    const from = path ? path[path.length - 1] : this.spot;
    const s = this.spot;
    const across = V(-(s.z - from.z), 0, s.x - from.x).normalize(); // square to the way it's going
    const mid = from.clone().lerp(s, 0.5);
    const spots: [Player, THREE.Vector3][] = [[this.v, mid.clone().addScaledVector(across, 0.62)], [this.e, mid.clone().addScaledVector(across, -0.62)]];
    if (this.t < 100) {
      let there = 0;
      for (const [p, to] of spots) there += this.walkTo(p, this.onGround(to), WALK, dt) ? 1 : 0;
      if (there === 2 && this.t < 100) this.t = 100; // both there: lift
      return;
    }
    const t = this.t - 100;
    // up, over and down onto the bottom one, turned face to the front as it goes
    const k = ease(t, 1.4, 3.2);
    for (const [p, to] of spots) {
      // in step with it, from either side of where it was to either side of the bottom one
      const going = to.clone().add(s.clone().sub(mid).multiplyScalar(k));
      if (k > 0 && k < 1) {
        p.stride += (dt / 0.8) * Math.PI;
        Object.assign(p.pose, { walk: 0.5, phase: p.stride });
      }
      p.w.at.copy(this.onGround(going));
      this.face(p, middle.getWorldPosition(V()), dt);
      const down = ease(t, 0, 0.8) * (1 - ease(t, 1.4, 2.2));
      const up = (1 - down) * ease(t, 1.4, 2.2) * (1 - ease(t, 3.2, 3.8));
      p.pose.crouch = down * 0.75;
      p.pose.lean = -0.25 * up; // leaning back with the weight of it
      p.pose.look = 0.4 - up * 0.5;
      p.arms = [-0.55 - down * 0.25 - up * 1.0, -0.55 - down * 0.25 - up * 1.0];
      p.inward = [0.35, 0.35];
    }
    const top = this.yard.localToWorld(V(0, STACK.middle, 0));
    const lying = from.clone().add(V(0, 0.3 * 0.86, 0));
    const c = lying.clone().lerp(top, k).add(V(0, Math.sin(k * Math.PI) * 0.35, 0));
    this.placeBall(middle, c, 0.3);
    middle.quaternion.slerp(new THREE.Quaternion(), Math.min(1, dt * 3 + k * k));
    if (passed(t, dt, 3.2)) this.say('pack', top, 0.9); // and down onto it, with a crunch
    if (t > 3.8) this.go('head');
  }

  /** She packs the head between her hands and puts it on; he's off for sticks, and back. */
  private heading(dt: number) {
    const s = this.spot;
    const head = this.part('snowman_head');
    const e = this.e;
    const front = this.onGround(V(s.x + 0.75, 0, s.z + 0.55));
    if (this.walkTo(e, front, WALK, dt)) {
      const t = (e.t += dt);
      this.face(e, s, dt);
      const scoop = ease(t, 0, 0.5) * (1 - ease(t, 1.3, 1.7));
      e.pose.crouch = scoop * 0.8;
      e.pose.reach = scoop;
      e.pose.look = 0.4;
      const packing = t > 1.5 && t < 3.6;
      const putting = ease(t, 3.6, 5.2);
      if (packing) this.packing(e, t, 0.55);
      if (passed(t, dt, 0.35)) this.say('scoop', e.w.at);
      if (passed(t, dt, 1.6) || passed(t, dt, 2.6)) this.say('pack', e.w.at.clone().add(V(0, 1, 0)));
      if (passed(t, dt, 5)) this.say('pack', e.w.at.clone().add(V(0, 1.3, 0)), 0.6);
      if (t > 3.6) {
        e.arms = [-1.1 - putting * 1.2, -1.1 - putting * 1.2];
        e.inward = [0.35, 0.35];
        e.pose.look = 0.1 - putting * 0.3;
      }
      if (head && t > 1.5) {
        head.visible = true;
        const hands = e.w.at.clone().add(V(Math.sin(e.w.heading) * 0.42, 1.0, Math.cos(e.w.heading) * 0.42));
        const top = this.yard ? this.yard.localToWorld(V(0, STACK.head, 0)) : hands;
        this.placeBall(head, hands.lerp(top, putting), 0.21 * (0.45 + 0.55 * ease(t, 1.5, 3.4)));
        head.quaternion.identity();
      }
    } else e.t = 0;
    // him: off across the plaza for a couple of sticks, and back to the snowman
    const v = this.v;
    const sticks = this.onGround(V(s.x + 1.6, 0, s.z - 2.2));
    const back = this.onGround(V(s.x - 0.75, 0, s.z + 0.55));
    if (this.t < 100) {
      if (this.walkTo(v, sticks, WALK, dt)) this.t = 100;
    } else if (this.t < 102.4) {
      // two goes at it: a stick, and another
      if (passed(this.t, dt, 100.45) || passed(this.t, dt, 101.65)) this.say('twig', v.w.at);
      const k = Math.sin(((this.t - 100) / 1.2) * Math.PI);
      v.pose.crouch = Math.abs(k) * 0.8;
      v.pose.reach = Math.abs(k);
      v.pose.look = 0.5;
      if (this.t > 101.2) {
        v.pose.hold = 1 - Math.abs(k); // and a look at what he's got
        v.pose.turn = Math.sin(this.t * 3) * 0.15;
      }
    } else if (this.walkTo(v, back, WALK, dt) && e.t > 5.4) {
      this.go('dress');
    }
  }

  /** The finishing touches, one by one: arms, buttons, the face, a carrot, and her scarf round its neck. */
  private dressing(dt: number) {
    const s = this.spot;
    const steps: [number, Player, string, number][] = [
      [0.4, this.v, 'snowman_arms', -1.35],
      [1.9, this.e, 'snowman_buttons', -1.25],
      [3.4, this.e, 'snowman_face', -1.95],
      [4.9, this.v, 'snowman_nose', -2.0],
      [6.4, this.e, 'snowman_scarf', -1.7],
    ];
    for (const p of [this.v, this.e]) {
      this.face(p, s, dt);
      p.pose.look = 0.1;
    }
    for (const [when, p, name, reach] of steps) {
      const k = this.t - when;
      if (k < 0 || k > 1.1) continue;
      const out = Math.sin((k / 1.1) * Math.PI);
      p.arms = name === 'snowman_scarf' ? [reach * out, reach * out] : [0, reach * out];
      if (name === 'snowman_scarf') p.inward = [0.45 * out, 0.45 * out]; // round its neck
      p.pose.lean = 0.25 * out;
      p.pose.look = name === 'snowman_buttons' || name === 'snowman_arms' ? 0.35 * out : -0.2 * out;
      if (k > 0.55) {
        const o = this.part(name);
        if (o && !o.visible) this.say(name === 'snowman_arms' ? 'twig' : 'pack', o.getWorldPosition(V()), 0.4);
        if (o) o.visible = true;
      }
    }
    if (this.t > 8) this.go('admire');
  }

  /** A step back to look at it. */
  private admiring(dt: number) {
    const s = this.spot;
    for (const [p, dx] of [[this.v, -1.1], [this.e, 1.1]] as const) {
      const to = this.onGround(V(s.x + dx, 0, s.z + 1.6));
      if (this.walkTo(p, to, 0.6, dt)) {
        this.face(p, s, dt);
        p.pose.look = -0.15;
        if (p === this.e && passed(this.t, dt, 2)) this.say('clap', p.w.at.clone().add(V(0, 1.2, 0)));
        if (p === this.v && passed(this.t, dt, 2.8)) this.laugh(p, 0.7);
        if (p === this.e && this.t > 2 && this.t < 4.2) {
          // a round of applause
          p.arms = [-1.15, -1.15];
          const clap = Math.abs(Math.sin(this.t * 11));
          p.inward = [0.2 + clap * 0.35, 0.2 + clap * 0.35];
        } else {
          p.pose.behind = 1;
          if (p === this.v) p.pose.look = -0.15 + Math.max(0, Math.sin(this.t * 4)) * 0.15 * (this.t > 2 && this.t < 3.6 ? 1 : 0); // nodding: not bad
        }
      }
    }
    if (this.t > 5.5) {
      this.built = true;
      this.go('gather');
    }
  }

  /** Everything stacked where it goes, and (`dressed`) all its finishing touches on. */
  private stack(dressed: boolean) {
    for (const [n, h, r] of [['snowman_base', STACK.base, 0.42], ['snowman_middle', STACK.middle, 0.3], ['snowman_head', STACK.head, 0.21]] as const) {
      const o = this.part(n);
      if (!o) continue;
      o.visible = true;
      o.position.set(0, h, 0);
      o.quaternion.identity();
      o.scale.setScalar(r / (o.userData.snow_r ?? r));
    }
    for (const n of ['snowman_arms', 'snowman_buttons', 'snowman_scarf', 'snowman_face', 'snowman_nose']) {
      const o = this.part(n);
      if (o) o.visible = dressed;
    }
  }

  /** Slumping as the snow goes: shorter, a bit wider, its head lower. */
  private thaw(lying: number) {
    if (!this.yard) return;
    const k = this.built && this.phase === 'done' ? ease(lying, BARE, 0.3) : 1;
    this.yard.scale.set(1 + (1 - k) * 0.15, 0.55 + 0.45 * k, 1 + (1 - k) * 0.15);
  }

  private show() {
    if (this.yard) this.yard.visible = this.built || (this.phase !== 'done' && this.doing === 'building');
  }

  // --- the fight ---------------------------------------------------------------------------

  private other(p: Player) {
    return p === this.v ? this.e : this.v;
  }

  private next(p: Player, act: Act) {
    p.act = act;
    p.t = 0;
    p.len = { stand: 0.6, scoop: rand(1, 1.4), pack: rand(0.7, 1.1), windup: rand(0.55, 0.8), throw: 0.18, recover: 0.5, shuffle: rand(0.8, 2) }[act];
    if (act === 'shuffle') {
      // a few steps to one side or the other (across the line between them), not too far from their end
      const home = this.end(p.who);
      const at = this.other(p).w.at.clone().sub(home).setY(0).normalize();
      const across = V(-at.z, 0, at.x);
      const now = p.w.at.clone().sub(home).dot(across);
      const to = THREE.MathUtils.clamp(now + (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.3), -1.4, 1.4);
      p.to.copy(home).addScaledVector(across, to).addScaledVector(at, rand(-0.3, 0.3));
      this.onGround(p.to);
    }
    if (p.ball) p.ball.visible = act === 'pack' || act === 'windup' || act === 'throw';
  }

  /**
   * Each of them round and round: down for a handful of snow, packing it, winding up (the other
   * hand out to aim), the throw with the whole body behind it, and a few steps to one side. Caught
   * by one, they stagger, then brush it off; landing one, arms up. Then a laugh.
   */
  private fighting(dt: number) {
    for (const p of [this.v, this.e]) {
      const them = this.other(p);
      // a moment to take it in, caught or cheering: the next one can wait
      const busy = p.hit > 0 || p.brush > 0 || p.cheer > 0;
      if (!busy) p.t += dt;
      const k = clamp01(p.t / p.len);
      if (p.act !== 'shuffle') this.face(p, them.w.at, dt);
      // ready for anything: knees a little bent, arms a little out
      p.pose.crouch = 0.12;
      switch (p.act) {
        case 'stand': {
          // had enough: hands on knees, getting their breath back
          const tired = ease(p.t, 0, 0.6);
          p.pose.crouch = 0.25 * tired;
          p.pose.lean = 0.55 * tired;
          p.arms = [-0.45 * tired, -0.45 * tired];
          p.hop = Math.sin(this.t * 7) * 0.012 * tired;
          break;
        }
        case 'scoop': {
          const down = ease(k, 0, 0.3) * (1 - ease(k, 0.7, 1));
          p.pose.crouch = 0.12 + down * 0.75;
          p.pose.reach = down;
          p.pose.look = 0.55 * down;
          const scrape = Math.sin(p.t * 12) * 0.12 * down; // scraping it together
          p.arms = [-0.2 - down * 0.45 + scrape, -0.3 - down * 0.5 - scrape];
          p.inward = [0.3, 0.3];
          if (!busy && passed(p.t, dt, p.len * 0.3)) this.say('scoop', p.w.at);
          break;
        }
        case 'pack':
          this.packing(p, p.t, 0.45);
          if (!busy && passed(p.t, dt, 0.05)) this.say('pack', p.w.at.clone().add(V(0, 1, 0)));
          break;
        case 'windup': {
          // up and back over the shoulder, the other hand out at them; held a moment, aiming
          const up = ease(k, 0, 0.6);
          p.arms = [-0.8 - up * 0.75, -0.8 - up * 2.75];
          p.inward = [0.1, 0.15 - up * 0.35];
          p.twist = -0.6 * up;
          p.pose.lean = -0.15 * up;
          break;
        }
        case 'throw': {
          // all of it at once: the arm over, the body round, the weight forward
          const go = ease(k, 0, 1);
          p.arms = [-1.55 + go * 1.4, -3.55 + go * 3.0];
          p.inward = [0.1 - go * 0.3, -0.2 + go * 0.55];
          p.twist = -0.6 + go * 1.1;
          p.pose.lean = -0.15 + go * 0.6;
          break;
        }
        case 'recover': {
          const back = 1 - ease(k, 0, 1);
          p.arms = [-0.15 * back, -0.55 * back];
          p.inward = [-0.2 * back, 0.4 * back];
          p.twist = 0.5 * back;
          p.pose.lean = 0.45 * back;
          break;
        }
        case 'shuffle':
          if (this.sidestep(p, p.to, 1.4, dt)) p.t = p.len;
          else p.t = Math.min(p.t, p.len - 0.01);
          break;
      }
      // keeping an eye on one that's coming at them
      if (p.incoming) {
        const b = p.incoming.position;
        const yaw = Math.atan2(b.x - p.w.at.x, b.z - p.w.at.z) - p.w.heading;
        p.pose.turn = THREE.MathUtils.clamp(Math.atan2(Math.sin(yaw), Math.cos(yaw)), -1, 1);
      }
      if (p.t < p.len || busy) continue;
      // on to the next thing
      if (p.act === 'throw') this.launch(p);
      const order: Partial<Record<Act, Act>> = { scoop: 'pack', pack: 'windup', windup: 'throw', throw: 'recover' };
      const after = order[p.act] ?? (p.act === 'recover' ? (Math.random() < 0.6 ? 'shuffle' : 'scoop') : 'scoop');
      if (p.act === 'stand') p.t = p.len; // had enough: waiting for the other to be done
      else if (p.act === 'recover' && p.thrown >= p.quota) this.next(p, 'stand');
      else this.next(p, after);
    }
    const tired = (p: Player) => p.act === 'stand' && !p.hit && !p.brush;
    if (!this.flights.length && ((tired(this.v) && tired(this.e)) || this.t > 110)) this.go('end');
  }

  /** Packing snow between their hands, patting it round, eyes on it; `low` how far down in front. */
  private packing(p: Player, t: number, low: number) {
    const pat = Math.sin(t * 13);
    p.arms = [-0.55 - low * 0.6 + pat * 0.14, -0.55 - low * 0.6 - pat * 0.14];
    p.inward = [0.5, 0.5];
    p.pose.look = 0.45;
    p.pose.lean = 0.1;
    p.twist = Math.sin(t * 6.5) * 0.08;
  }

  /** Off it goes: at them, or a little wide; some they duck. */
  private launch(p: Player) {
    const o = this.flying[p.who === 'v' ? 0 : 1];
    const them = this.other(p);
    if (!o) return;
    p.thrown++;
    if (p.ball) p.ball.visible = false;
    const from = p.ball?.getWorldPosition(V()) ?? p.w.at.clone().add(V(0, 1.6, 0));
    const r = Math.random();
    const hits = r < 0.5;
    // ducking's only possible when you're not in the middle of throwing one yourself
    const ducks = !hits && r < 0.75 && them.act !== 'windup' && them.act !== 'throw';
    const dir = them.w.at.clone().sub(p.w.at).setY(0).normalize();
    const side = V(-dir.z, 0, dir.x);
    const to = hits
      ? them.w.at.clone().add(V(0, 1.15, 0)).addScaledVector(side, rand(-0.12, 0.12))
      : this.onGround(them.w.at.clone().addScaledVector(dir, rand(1, 2.2)).addScaledVector(side, ducks ? rand(-0.3, 0.3) : (Math.random() < 0.5 ? -1 : 1) * rand(0.7, 1.3)));
    o.visible = true;
    o.position.copy(from);
    const len = from.distanceTo(to) / THROW;
    this.flights.push({ o, from, to, t: 0, len, arc: hits ? 0.5 : 0.9, target: them, thrower: p, hits, ducks });
    this.say('toss', from, 0.8);
    them.incoming = o;
  }

  private fly(dt: number) {
    for (const f of [...this.flights]) {
      f.t += dt;
      const k = clamp01(f.t / f.len);
      f.o.position.lerpVectors(f.from, f.to, k).addScaledVector(UP, Math.sin(k * Math.PI) * f.arc);
      if (f.ducks && f.len - f.t < 0.45 && !f.target.duck) {
        f.target.duck = 1;
        // down, and a little to one side
        f.target.shove.add(f.to.clone().sub(f.from).setY(0).normalize().cross(UP).multiplyScalar(rand(-0.25, 0.25)));
      }
      if (k < 1) continue;
      f.o.visible = false;
      this.flights.splice(this.flights.indexOf(f), 1);
      if (f.target.incoming === f.o) f.target.incoming = null;
      this.onSplat?.(f.to.clone());
      this.say(f.hits ? 'snowhit' : 'snowsplat', f.to);
      if (f.hits) {
        // a gasp at the cold of it, or straight to laughing
        if (Math.random() < 0.5) this.say(f.target.who === 'v' ? 'gasp' : 'gasp-e', f.to, 0.8);
        else this.laugh(f.target, 0.6);
        // knocked back a step, a shout, and then the snow brushed off; the other one's delighted
        Object.assign(f.target, { hit: 1, brush: 1, laugh: 1 });
        f.target.shove.add(f.to.clone().sub(f.from).setY(0).normalize().multiplyScalar(0.2));
        if (f.thrower.act !== 'windup' && f.thrower.act !== 'throw') {
          Object.assign(f.thrower, { cheer: 1, laugh: 1 });
          this.laugh(f.thrower, 0.7);
        }
      } else if (f.ducks) {
        f.target.laugh = 1; // missed!
        this.laugh(f.target, 0.5);
      }
    }
  }

  private clearFlights() {
    for (const f of this.flights) f.o.visible = false;
    this.flights = [];
  }

  // --- moving them -------------------------------------------------------------------------

  private middle(a: THREE.Vector3, b: THREE.Vector3) {
    return a.clone().lerp(b, 0.5);
  }

  /** A step towards `to` (on the ground); true once they're there. */
  private walkTo(p: Player, to: THREE.Vector3, speed: number, dt: number) {
    const d = to.clone().sub(p.w.at).setY(0);
    const far = d.length();
    if (far < 0.05) return true;
    const step = Math.min(far, speed * dt);
    p.w.at.addScaledVector(d.normalize(), step);
    this.onGround(p.w.at);
    this.turn(p, Math.atan2(d.x, d.z), dt);
    p.stride += (dt / (speed > 1.2 ? 0.7 : 1)) * Math.PI;
    p.pose.walk = 1;
    p.pose.phase = p.stride;
    return far - step < 0.05;
  }

  private face(p: Player, to: THREE.Vector3, dt: number) {
    this.turn(p, Math.atan2(to.x - p.w.at.x, to.z - p.w.at.z), dt);
  }

  private turn(p: Player, heading: number, dt: number) {
    const d = Math.atan2(Math.sin(heading - p.w.heading), Math.cos(heading - p.w.heading));
    p.w.heading += dt ? d * (1 - Math.exp(-6 * dt)) : d;
  }

  private say(call: Call, at: THREE.Vector3, loud = 1) {
    this.onSound?.(call, at.clone(), loud);
  }

  /** A laugh out of one of them, now and then (`chance`), or now (`sure`). */
  private laugh(p: Player, chance = 1, sure = false) {
    if (!sure && (this.clock - this.laughed[p.who] < 3 || Math.random() > chance)) return;
    this.laughed[p.who] = this.clock;
    this.say(p.who === 'v' ? 'laugh' : 'laugh-e', p.w.at.clone().add(V(0, 1.5, 0)));
  }

  /**
   * Their clothes without the snow that settles on everything's upper side: bent over a ball or
   * crouched for a handful, they'd go white all over. Back as they were (`on` false) afterwards.
   */
  private unsnow(on: boolean) {
    if (!on) {
      for (const [m, mat] of this.dressed) m.material = mat;
      this.dressed.clear();
      return;
    }
    for (const p of [this.v, this.e]) {
      p.w.root?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || this.dressed.has(m) || Array.isArray(m.material)) return;
        this.dressed.set(m, m.material);
        m.material = toon((m.material as THREE.MeshToonMaterial).color, { bare: true });
      });
    }
  }

  /**
   * Over to `to` sideways, still facing the other: feet apart and together, with a bob; true once
   * there. (Further than a couple of steps, or behind them, they just walk.)
   */
  private sidestep(p: Player, to: THREE.Vector3, speed: number, dt: number) {
    const d = to.clone().sub(p.w.at).setY(0);
    const facing = V(Math.sin(p.w.heading), 0, Math.cos(p.w.heading));
    if (Math.abs(d.clone().normalize().dot(facing)) > 0.75) return this.walkTo(p, to, speed, dt);
    const far = d.length();
    if (far < 0.05) return true;
    const step = Math.min(far, speed * dt);
    p.w.at.addScaledVector(d.normalize(), step);
    this.onGround(p.w.at);
    p.stride += (dt / 0.32) * Math.PI;
    p.splay = Math.abs(Math.sin(p.stride)) * 0.28;
    p.hop = Math.abs(Math.sin(p.stride)) * 0.04;
    p.arms = [-0.35, -0.35];
    p.inward = [-0.25, -0.25]; // arms out for balance
    return far - step < 0.05;
  }

  /** Enough: over to each other, and a laugh about it; she brushes the snow off his shoulder. */
  private ending(dt: number) {
    const v = this.v;
    const e = this.e;
    // they meet halfway, and halfway to the snowman (out from behind the signpost)
    if (this.t - dt <= 0) this.meet.copy(this.middle(v.w.at, e.w.at).lerp(this.spot, 0.3));
    const mid = this.meet;
    const apart = v.w.at.distanceTo(e.w.at);
    if (this.t < 100) {
      const dir = e.w.at.clone().sub(v.w.at).setY(0).normalize();
      const his = this.walkTo(v, mid.clone().addScaledVector(dir, -0.45), 0.8, dt);
      const hers = this.walkTo(e, mid.clone().addScaledVector(dir, 0.45), 0.8, dt);
      if ((his && hers) || apart < 0.95) {
        this.t = 100;
        this.onCheer?.(mid.clone().add(V(0, 2, 0)));
        this.laugh(v, 1, true);
      }
      if (this.t > 12) this.t = 100; // (never stuck walking)
      return;
    }
    const t = this.t - 100;
    if (passed(t, dt, 0.5)) this.laugh(e, 1, true); // and her, at him
    for (const p of [v, e]) {
      this.face(p, this.other(p).w.at, dt);
      p.laugh = Math.max(p.laugh, t < 2 ? 1 : 0);
    }
    // her right hand up to his shoulder, a couple of brushes
    if (t > 0.6 && t < 2.4) {
      const k = Math.sin(((t - 0.6) / 1.8) * Math.PI);
      e.arms = [0, -1.45 * k + Math.sin(t * 14) * 0.1 * k];
      e.inward = [0.15, 0.25 * k];
      e.pose.lean = 0.1 * k;
    }
    v.pose.behind = ease(t, 2.4, 3.2);
    e.pose.behind = ease(t, 2.6, 3.4);
    if (t > 4) this.go('done');
  }

  /**
   * The pose (with a duck or a flinch over it), then the arms, the twist, the legs and the root
   * over what Walker makes of it.
   */
  private pose(p: Player) {
    const q = p.pose;
    if (p.duck) {
      const k = Math.sin(p.duck * Math.PI);
      q.crouch = Math.max(q.crouch, k * 0.9);
      q.look = 0.6 * k;
      p.arms = [-2.4 * k, -2.4 * k]; // arms over the head
      p.inward = [0.35 * k, 0.35 * k];
    }
    let hit = 0;
    if (p.hit) {
      hit = Math.sin(Math.min(1, (1 - p.hit) * 2.2) * Math.PI * 0.5) * p.hit; // all at once, and slowly back
      q.lean = -0.55 * hit;
      q.look = -0.35 * hit;
      q.crouch = 0;
      p.twist = 0.35 * hit;
      p.arms = [-0.7 * hit, -0.7 * hit];
      p.inward = [-0.85 * hit, -0.85 * hit]; // thrown out wide
    } else if (p.brush) {
      // patting the snow off their front, a glance down at it
      const k = Math.sin(p.brush * Math.PI);
      q.look = 0.45 * k;
      p.arms = [-1.05 * k + Math.sin(p.brush * 30) * 0.12 * k, (p.arms?.[1] ?? 0) * (1 - k)];
      p.inward = [0.55 * k, p.inward[1]];
    } else if (p.cheer) {
      // that one landed: arms up, and a little jump
      const k = Math.sin(p.cheer * Math.PI);
      p.arms = [-2.8 * k, -2.8 * k];
      p.inward = [-0.3 * k, -0.3 * k];
      p.hop = Math.max(p.hop, Math.abs(Math.sin(p.cheer * Math.PI * 2)) * 0.1 * k);
      q.look = -0.2 * k;
    }
    if (p.laugh) {
      // a laugh: the shoulders going, the head back
      const k = p.laugh;
      q.look -= 0.2 * k;
      p.hop += Math.abs(Math.sin(this.t * 16)) * 0.018 * k;
    }
    q.mug = false;
    p.w.pose(q);
    if (p.arms) {
      p.armL?.rotation.set(p.arms[0], 0, -p.inward[0]);
      p.armR?.rotation.set(p.arms[1], 0, p.inward[1]);
    }
    if (p.torso) p.torso.rotation.y = p.twist;
    if (p.head) p.head.rotation.y -= p.twist * 0.8; // eyes kept on what they're looking at
    if (p.splay) {
      p.legL?.rotation.set(p.legL.rotation.x, 0, p.splay);
      p.legR?.rotation.set(p.legR.rotation.x, 0, -p.splay);
    }
    if (p.w.root && (p.hop || p.shove.lengthSq() > 1e-6)) {
      p.w.root.position.y += p.hop;
      p.w.root.position.x += p.shove.x;
      p.w.root.position.z += p.shove.z;
    }
  }
}
