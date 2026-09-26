import * as THREE from 'three';
import type { Particles } from './particles';

/** A spot on the robot's walking graph (see tools/models/workshop.py). */
export interface Waypoint {
  name: string;
  position: THREE.Vector3;
  links: string[];
}

/** What the robot needs from the room it lives in. */
export interface RobotRoom {
  particles: Particles;
  /** A little icon floating up (the zzz while it charges). */
  float(kind: 'zzz', at: THREE.Vector3): void;
  /** An exhibit's root, by project id. */
  exhibit(id: string): THREE.Object3D | undefined;
  /** One of its noises: servos setting off, the wrench, a snore on the pad, a clank, a beep. */
  sound?(name: 'robot-servo' | 'robot-tinker' | 'robot-snore' | 'robot-clank' | 'robot-beep', volume?: number): void;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const ease = THREE.MathUtils.smootherstep;

const SPEED = 1.1; // m/s, when it isn't falling over
const TURN = 5; // how quickly it swings round to face where it's going

type Mood =
  | { kind: 'idle'; until: number }
  | { kind: 'walk' }
  | { kind: 'tinker'; until: number }
  | { kind: 'present' }
  | { kind: 'charge'; until: number }
  | { kind: 'wave'; t: number; fall: boolean }
  | { kind: 'stumble'; t: number }
  | { kind: 'fall'; t: number }
  | { kind: 'bonk'; t: number }
  | { kind: 'install'; t: number }
  | { kind: 'reboot'; t: number };

const INSTALL = 55; // seconds, Patch Tuesday's updates (most of it spent on the last one per cent)
const GROGGY = 90; // seconds after, of not being quite itself

/**
 * The workshop robot. It potters between the exhibits along the waypoints baked into the room, tinkers with them, naps on its charging pad at night and, when a visitor
 * opens a project, trundles over to show it off. It is not very good at walking.
 */
export class Robot {
  private root?: THREE.Object3D;
  private hips?: THREE.Object3D;
  private head?: THREE.Object3D;
  private antenna?: THREE.Object3D;
  private arms: THREE.Object3D[] = []; // left, right
  private legs: THREE.Object3D[] = [];
  private rest = new Map<THREE.Object3D, THREE.Euler>();
  private hipsY = 0;

  private nodes = new Map<string, Waypoint>();
  private node = 'home'; // where it last arrived
  private route: string[] = [];
  private from = V();
  private heading = 0;
  private stride = 0;
  private mood: Mood = { kind: 'charge', until: 4 };
  private clock = 0;
  /** The exhibit it's been asked to show, if any. */
  private showing: string | null = null;
  // the antenna is a damped spring that every stumble sets wobbling
  private wobble = new THREE.Vector2();
  private wobbleV = new THREE.Vector2();
  /** The update's progress bar on its chest (workshop.py `robot_update`), and until when it's groggy after. */
  private screen?: THREE.Object3D;
  private bar?: THREE.Object3D;
  private groggy = 0;

  constructor(
    root: THREE.Object3D | undefined,
    waypoints: Waypoint[],
    private room: RobotRoom,
    private isNight: () => boolean,
  ) {
    this.root = root;
    if (!this.root) return;
    const part = (name: string) => this.root!.getObjectByName(name);
    this.hips = part('robot_hips');
    this.head = part('robot_head');
    this.antenna = part('antenna');
    this.arms = ['arm_l', 'arm_r'].map(part).filter(Boolean) as THREE.Object3D[];
    this.legs = ['leg_l', 'leg_r'].map(part).filter(Boolean) as THREE.Object3D[];
    for (const o of [this.hips, this.head, this.antenna, ...this.arms, ...this.legs]) if (o) this.rest.set(o, o.rotation.clone());
    this.hipsY = this.hips?.position.y ?? 0;
    this.screen = part('robot_update');
    this.bar = part('robot_bar');
    if (this.screen) this.screen.visible = false;

    for (const w of waypoints) this.nodes.set(w.name, { ...w, links: [...w.links] });
    for (const w of this.nodes.values()) {
      for (const l of w.links) {
        const other = this.nodes.get(l);
        if (other && !other.links.includes(w.name)) other.links.push(w.name);
      }
    }
    const home = this.nodes.get('home');
    if (home) this.root.position.copy(home.position);
    this.from.copy(this.root.position);
  }

  /** Where it is (for the camera, particles and clicking). */
  get position() {
    return this.root?.getWorldPosition(V()) ?? V();
  }

  /** Patch Tuesday: stand still and install its updates, then start up again, not quite itself. */
  install() {
    this.route = [];
    this.mood = { kind: 'install', t: 0 };
    if (this.screen) this.screen.visible = true;
  }

  /** How far through its updates it is (0..1), or null if it isn't updating. */
  get updating() {
    return this.mood.kind === 'install' ? this.progress(this.mood.t) : null;
  }

  /** Quick to begin with, then slower, and stuck on 99 per cent for a good while. */
  private progress(t: number) {
    const k = t / INSTALL;
    return k < 0.3 ? (k / 0.3) * 0.6 : k < 0.7 ? 0.6 + ((k - 0.3) / 0.4) * 0.39 : k < 0.97 ? 0.99 : 1;
  }

  /** Walk over to an exhibit and show it off until dismissed. */
  present(id: string) {
    if (!this.nodes.has(id) || this.mood.kind === 'install' || this.mood.kind === 'reboot') return;
    this.showing = id;
    if (this.node === id && !this.route.length && this.upright) {
      this.mood = { kind: 'present' };
      this.room.sound?.('robot-beep');
      return;
    }
    this.walkTo(id);
  }

  /** The visitor closed the card: potter off again after a moment. */
  dismiss() {
    this.showing = null;
    if (this.mood.kind === 'present') this.mood = { kind: 'idle', until: this.clock + rand(1.5, 3) };
  }

  /** Someone clicked it. Returns what happened, so the island can say something about it. */
  poke(): 'trip' | 'wave' | 'fall' | 'busy' {
    if (this.mood.kind === 'install' || this.mood.kind === 'reboot') return 'busy';
    if (this.mood.kind === 'walk') {
      this.mood = { kind: 'stumble', t: 0 };
      this.kick(2.5);
      return 'trip';
    }
    if (!this.upright) return 'trip';
    const fall = Math.random() < 0.3;
    this.mood = { kind: 'wave', t: 0, fall };
    this.room.sound?.('robot-beep');
    return fall ? 'fall' : 'wave';
  }

  update(dt: number) {
    if (!this.root || !this.hips) return;
    this.clock += dt;
    const m = this.mood;
    let walking = 0;
    let lean = 0; // forward pitch of the whole body
    let arm = [0, 0]; // extra forward raise per arm
    let armOut = [0, 0]; // sideways, flailing
    let look = 0;
    let crouch = 0;

    switch (m.kind) {
      case 'idle':
        look = Math.sin(this.clock * 0.7) * 0.6;
        if (this.clock > m.until) this.wander();
        break;
      case 'tinker': {
        // bent over the exhibit, the wrench going round
        lean = 0.25;
        arm = [0.9, 1.2 + Math.sin(this.clock * 9) * 0.35];
        look = Math.sin(this.clock * 1.3) * 0.15;
        if (Math.random() < dt * 0.5) this.spark(0.6);
        if (this.clock > m.until) this.mood = { kind: 'idle', until: this.clock + rand(1, 3) };
        break;
      }
      case 'present': {
        // ta-da: one arm out towards the exhibit, a proud little bounce
        const beat = Math.max(0, Math.sin(this.clock * 3));
        arm = [1.5, 0.2];
        armOut = [0.5, 0];
        crouch = -beat * 0.03;
        look = 0.3;
        this.faceExhibit(dt);
        break;
      }
      case 'charge':
        crouch = 0.06;
        lean = -0.05;
        look = Math.sin(this.clock * 0.3) * 0.1;
        if (Math.random() < dt * 0.15) {
          this.room.float('zzz', this.position.add(V(0, 1.4, 0)));
          this.room.sound?.('robot-snore', 0.8);
        }
        if (this.clock > m.until && !(this.isNight() && Math.random() < 0.9)) this.wander();
        else if (this.clock > m.until) m.until = this.clock + 20;
        break;
      case 'wave': {
        m.t += dt;
        arm = [0, 2.6];
        armOut = [0, -0.4 - Math.sin(m.t * 12) * 0.35];
        look = 0;
        if (m.fall && m.t > 1.1) {
          this.mood = { kind: 'fall', t: 0 };
          this.kick(3);
        } else if (m.t > 1.8) this.mood = { kind: 'idle', until: this.clock + 2 };
        break;
      }
      case 'stumble': {
        // catches a toe, pitches forward, windmills, and just about stays up
        m.t += dt;
        const k = m.t / 1.3;
        lean = Math.sin(Math.min(1, k * 3) * Math.PI) * 0.45 * (1 - k) + Math.sin(m.t * 14) * 0.08 * (1 - k);
        arm = [2.2 + Math.sin(m.t * 20) * 0.8, 2.2 + Math.cos(m.t * 20) * 0.8].map((a) => a * (1 - k));
        armOut = [0.6 * (1 - k), -0.6 * (1 - k)];
        look = Math.sin(m.t * 18) * 0.3 * (1 - k);
        if (m.t > 1.3) {
          this.mood = this.route.length ? { kind: 'walk' } : { kind: 'idle', until: this.clock + 1 };
          this.kick(1);
        }
        break;
      }
      case 'fall': {
        // flat on its face, a puff of dust, a pause for dignity, then up again
        m.t += dt;
        const down = ease(m.t, 0, 0.35);
        const up = ease(m.t, 1.9, 2.6);
        lean = (down - up) * 1.35;
        crouch = (down - up) * 0.3;
        arm = [2.8 * (down - up), 2.8 * (down - up)];
        if (m.t > 0.35 && m.t - dt <= 0.35) {
          this.room.sound?.('robot-clank');
          this.dust();
          this.kick(4);
        }
        if (m.t > 2.8) {
          this.mood = this.route.length ? { kind: 'walk' } : { kind: 'idle', until: this.clock + 1.5 };
          this.kick(1.5);
        }
        break;
      }
      case 'bonk': {
        // walked straight into the exhibit: rocks back, sees stars, shuffles back a step
        m.t += dt;
        lean = -Math.sin(Math.min(1, m.t / 0.5) * Math.PI) * 0.3;
        look = Math.sin(m.t * 16) * 0.2 * Math.max(0, 1 - m.t);
        if (m.t > 0.15 && m.t < 0.9 && Math.random() < dt * 20) this.stars();
        // a step too far, then a shuffle back to where it meant to stop
        const f = V(Math.sin(this.heading), 0, Math.cos(this.heading));
        if (m.t < 0.15) this.root.position.addScaledVector(f, 0.3 * dt / 0.15);
        else if (m.t > 0.5 && m.t < 1.1) {
          this.root.position.addScaledVector(f, -0.3 * dt / 0.6);
          walking = 0.5;
        }
        if (m.t > 1.4) this.arrive();
        break;
      }
      case 'walk':
        walking = this.walk(dt);
        look = Math.sin(this.clock * 0.9) * 0.2;
        if (this.clock < this.groggy) look += Math.sin(this.clock * 7) * 0.25; // shaking its head clear
        break;
      case 'install': {
        // stock still, head bowed over its own chest, the bar creeping along
        m.t += dt;
        crouch = 0.03;
        lean = 0.12;
        look = 0;
        if (this.bar) this.bar.scale.x = Math.max(0.02, this.progress(m.t));
        if (m.t > INSTALL) {
          this.mood = { kind: 'reboot', t: 0 };
          if (this.screen) this.screen.visible = false;
          this.room.sound?.('robot-beep');
        }
        break;
      }
      case 'reboot': {
        // everything off for a moment, slumped; then a jolt, and up
        m.t += dt;
        const off = 1 - ease(m.t, 1.6, 2.1);
        crouch = 0.12 * off;
        lean = 0.35 * off;
        arm = [-0.2 * off, -0.2 * off];
        if (m.t > 1.6 && m.t - dt <= 1.6) {
          this.room.sound?.('robot-servo');
          this.kick(4);
        }
        if (m.t > 2.6) {
          this.groggy = this.clock + GROGGY;
          this.mood = { kind: 'idle', until: this.clock + 1 };
        }
        break;
      }
    }

    this.pose(dt, walking, lean, arm, armOut, look, crouch);
  }

  // --- moving about -------------------------------------------------------------------------

  private get upright() {
    return !['stumble', 'fall', 'bonk'].includes(this.mood.kind);
  }

  private wander() {
    if (this.isNight() && this.node !== 'home' && Math.random() < 0.7) return this.walkTo('home');
    const stands = [...this.nodes.keys()].filter((n) => n !== this.node && (this.room.exhibit(n) || n === 'home'));
    this.walkTo(Math.random() < 0.15 ? 'home' : pick(stands));
  }

  private walkTo(goal: string) {
    // mid-stride, it finishes the leg it's on before turning round
    const start = this.mood.kind === 'walk' && this.route.length ? this.route[0] : this.node;
    const path = this.bfs(start, goal);
    if (!path) return;
    this.route = this.mood.kind === 'walk' && this.route.length ? [start, ...path.slice(1)] : path.slice(1);
    if (!this.route.length) return this.arrive();
    if (this.upright && this.mood.kind !== 'walk') this.room.sound?.('robot-servo', 0.8); // off it clanks
    if (this.upright) this.mood = { kind: 'walk' };
    this.from.copy(this.root!.position);
  }

  private bfs(start: string, goal: string): string[] | null {
    const prev = new Map<string, string>([[start, '']]);
    const queue = [start];
    while (queue.length) {
      const n = queue.shift()!;
      if (n === goal) {
        const path = [n];
        for (let p = prev.get(n); p; p = prev.get(p)) path.unshift(p);
        return path;
      }
      for (const l of this.nodes.get(n)?.links ?? []) {
        if (!prev.has(l) && this.nodes.has(l)) {
          prev.set(l, n);
          queue.push(l);
        }
      }
    }
    return null;
  }

  /** One frame of walking along the route; returns how much it's striding (0..1). */
  private walk(dt: number): number {
    const root = this.root!;
    const next = this.nodes.get(this.route[0]);
    if (!next) {
      this.route = [];
      this.arrive();
      return 0;
    }
    const target = next.position;
    const to = target.clone().sub(root.position).setY(0);
    const dist = to.length();
    const want = Math.atan2(to.x, to.z);
    const turn = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += turn * Math.min(1, TURN * dt);
    // it has to more or less face the way it's going before it sets off
    const facing = Math.max(0, Math.cos(turn));
    const step = Math.min(dist, SPEED * dt * facing ** 3);
    if (dist > 1e-3) root.position.addScaledVector(to.normalize(), step);
    // height: blend between the last waypoint and the next
    const span = target.clone().sub(this.from).setY(0).length();
    const k = span > 0 ? 1 - root.position.clone().sub(target).setY(0).length() / span : 1;
    root.position.y = THREE.MathUtils.lerp(this.from.y, target.y, THREE.MathUtils.clamp(k, 0, 1));
    root.rotation.y = this.heading;

    // clumsy: every so often a toe catches on nothing at all
    if (Math.random() < dt / (this.showing ? 40 : this.clock < this.groggy ? 6 : 22)) {
      this.mood = Math.random() < 0.3 ? { kind: 'fall', t: 0 } : { kind: 'stumble', t: 0 };
      this.kick(2.5);
      return 0;
    }
    if (dist < 0.05) {
      this.node = this.route.shift()!;
      this.from.copy(root.position);
      if (!this.route.length) {
        // arriving at an exhibit, it sometimes doesn't stop quite in time
        if (this.room.exhibit(this.node) && Math.random() < 0.3) {
          this.mood = { kind: 'bonk', t: 0 };
          this.room.sound?.('robot-clank', 0.5);
          this.kick(3);
        } else this.arrive();
      }
    }
    return 0.25 + facing * 0.75;
  }

  private arrive() {
    if (this.showing === this.node) this.mood = { kind: 'present' };
    else if (this.showing) this.walkTo(this.showing);
    else if (this.node === 'home') this.mood = { kind: 'charge', until: this.clock + rand(8, 20) };
    else if (this.room.exhibit(this.node)) {
      this.mood = { kind: 'tinker', until: this.clock + rand(3, 7) };
      this.room.sound?.('robot-tinker', 0.8);
    } else this.mood = { kind: 'idle', until: this.clock + rand(1, 4) };
  }

  private faceExhibit(dt: number) {
    const at = this.room.exhibit(this.node)?.getWorldPosition(V());
    if (!at || !this.root) return;
    const to = at.sub(this.root.position);
    const want = Math.atan2(to.x, to.z) - 0.6; // stand a little side-on, so the visitor can see too
    this.heading += Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)) * Math.min(1, 4 * dt);
    this.root.rotation.y = this.heading;
  }

  // --- animation -----------------------------------------------------------------------------

  private pose(dt: number, walking: number, lean: number, arm: number[], armOut: number[], look: number, crouch: number) {
    const r = (o: THREE.Object3D | undefined) => (o ? this.rest.get(o)! : new THREE.Euler());
    const hips = this.hips!;
    this.stride += dt * 9 * walking;
    const s = Math.sin(this.stride) * walking;
    const bob = Math.abs(Math.cos(this.stride)) * 0.05 * walking;

    hips.position.y = this.hipsY + bob - crouch;
    hips.rotation.x = r(hips).x + lean + walking * 0.06;
    hips.rotation.z = r(hips).z + s * 0.1; // a waddle
    this.legs.forEach((leg, i) => {
      leg.rotation.x = r(leg).x + (i ? -s : s) * 0.6 - lean * 0.6;
    });
    this.arms.forEach((a, i) => {
      a.rotation.x = r(a).x + (i ? s : -s) * 0.45 - arm[i];
      a.rotation.z = r(a).z + armOut[i] + (i ? -0.08 : 0.08);
    });
    if (this.head) {
      this.head.rotation.y = THREE.MathUtils.damp(this.head.rotation.y, r(this.head).y + look, 4, dt);
      this.head.rotation.x = r(this.head).x + Math.sin(this.stride * 2) * 0.05 * walking;
    }

    // antenna: a spring, shoved about by steps and stumbles
    const kick = V(s * walking * 0.8, 0);
    this.wobbleV.x += (-40 * this.wobble.x - 3 * this.wobbleV.x + kick.x * 6) * dt;
    this.wobbleV.y += (-40 * this.wobble.y - 3 * this.wobbleV.y + walking * 2 + lean * 8) * dt;
    this.wobble.addScaledVector(this.wobbleV, dt);
    if (this.antenna) {
      this.antenna.rotation.z = r(this.antenna).z + this.wobble.x * 0.5;
      this.antenna.rotation.x = r(this.antenna).x + this.wobble.y * 0.5;
    }
  }

  private kick(amount: number) {
    this.wobbleV.x += rand(-1, 1) * amount;
    this.wobbleV.y += amount;
  }

  // --- little effects --------------------------------------------------------------------------

  private stars() {
    const head = this.position.add(V(0, 1.4, 0));
    const a = this.clock * 8;
    this.room.particles.emit({ position: head.add(V(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35)), velocity: V(0, 0.3, 0), color: pick(['#ffe38a', '#fff6c4']), life: 0.5 });
  }

  private spark(height: number) {
    const f = V(Math.sin(this.heading), 0, Math.cos(this.heading));
    const at = this.position.add(V(0, height, 0)).addScaledVector(f, 0.6);
    for (let i = 0; i < 4; i++) {
      this.room.particles.emit({ position: at.clone(), velocity: V(rand(-1, 1), rand(0.5, 1.5), rand(-1, 1)), color: pick(['#ffd070', '#fff6a0', '#ff9a3c']), life: rand(0.2, 0.5), gravity: 4 });
    }
  }

  private dust() {
    const f = V(Math.sin(this.heading), 0, Math.cos(this.heading));
    const at = this.position.addScaledVector(f, 0.8).add(V(0, 0.1, 0));
    for (let i = 0; i < 14; i++) {
      this.room.particles.emit({ position: at.clone().add(V(rand(-0.4, 0.4), 0, rand(-0.4, 0.4))), velocity: V(rand(-0.8, 0.8), rand(0.2, 0.8), rand(-0.8, 0.8)), color: pick(['#c9b48a', '#b89a6a', '#d8cdb0']), life: rand(0.5, 1.1), size: 2 });
    }
  }
}
