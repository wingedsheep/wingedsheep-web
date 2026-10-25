import * as THREE from 'three';
import type { Beike } from './beike';
import type { Island } from './island';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const damp = THREE.MathUtils.damp;
const ease = THREE.MathUtils.smootherstep;

/** Coffee on the bench of a morning: he goes out with his and would like her along (vincent.ts asks, companion.ts comes). */
export const coffee = { asked: false, joined: false };
/** Whether Beike's about in his meadow with nothing better to do (Life, every frame): only then does Vincent go out to throw for him. */
export const fetching = { open: false };

/**
 * Someone sat with a mug (routines.py): the forearm (`arm`, from the elbow) brings it up to the
 * mouth every so often and the head tips back a little with it; clicked on, it's raised to you.
 */
export class Sipper {
  private sip = { t: 0, next: rand(3, 8) };
  private rest = new Map<THREE.Object3D, THREE.Euler>();

  constructor(
    private arm: THREE.Object3D | undefined,
    private head: THREE.Object3D | undefined,
    /** How far up the forearm comes, radians. */
    private lift: number,
  ) {
    for (const o of [arm, head]) if (o) this.rest.set(o, o.rotation.clone());
  }

  update(dt: number, noticed = 0) {
    const s = this.sip;
    if ((s.next -= dt) < 0) {
      s.t = Math.min(1, s.t + dt / 2.6);
      if (s.t >= 1) Object.assign(s, { t: 0, next: rand(7, 16) });
    }
    const up = Math.max(Math.sin(s.t * Math.PI), noticed);
    if (this.arm) this.arm.rotation.x = this.rest.get(this.arm)!.x - up * this.lift;
    if (this.head) this.head.rotation.x = this.rest.get(this.head)!.x - up * 0.15;
  }
}

/**
 * Vincent drawing the robin (routines.py `drawing`): head down over the page, the pencil going in
 * short strokes; then up to have a look at the bird, and back down. Now and then he holds the
 * page out at arm's length, the pencil still, to see how it's coming. The robin turns its head
 * this way and that, flicks its tail, and every so often shuffles round on its stick.
 */
export class Drawing {
  readonly root?: THREE.Object3D;
  private parts = new Map<string, { o: THREE.Object3D; rest: THREE.Euler }>();
  private phase: 'draw' | 'look' | 'back' = 'draw';
  private t = 0;
  private length = rand(4, 8);
  private up = 0; // 0 head down at the page … 1 looking at the bird
  private glance = 0; // the robin's head, side to side
  private glanceTo = 0;
  private turn = 0; // the robin, on its stick
  private turnTo = 0;
  private clock = 0;
  /** Clicked on: he looks up (1 easing to 0). */
  noticed = 0;

  constructor(island: Island) {
    this.root = island.get('vincent_drawing');
    for (const name of ['vincent_drawing_head', 'vincent_drawing_stroke', 'vincent_drawing_book', 'vincent_drawing_robin', 'drawing_robin_head']) {
      const o = this.root?.getObjectByName(name);
      if (o) this.parts.set(name, { o, rest: o.rotation.clone() });
    }
  }

  set visible(on: boolean) {
    if (this.root) this.root.visible = on;
  }

  get head() {
    return this.parts.get('vincent_drawing_head')?.o;
  }

  private part(name: string) {
    const p = this.parts.get(name);
    p?.o.rotation.copy(p.rest);
    return p?.o;
  }

  update(dt: number) {
    if (!this.root?.visible) return;
    const t = (this.clock += dt);
    this.noticed = Math.max(0, this.noticed - dt / 2.5);
    if ((this.t += dt) > this.length) {
      this.t = 0;
      this.phase = this.phase === 'draw' ? (Math.random() < 0.2 ? 'back' : 'look') : 'draw';
      this.length = this.phase === 'draw' ? rand(4, 9) : this.phase === 'look' ? rand(1.5, 3.5) : rand(2.5, 4);
    }
    const drawing = this.phase === 'draw' && this.noticed < 0.2;
    this.up = damp(this.up, this.phase === 'look' ? 1 : this.noticed, 4, dt);
    const head = this.part('vincent_drawing_head');
    if (head) {
      head.rotation.x -= this.up * 0.5 + (this.phase === 'back' ? 0.2 : 0);
      head.rotation.y -= this.up * 0.6 * (1 - this.noticed) - (drawing ? Math.sin(t * 0.7) * 0.05 : 0); // over to the bird, on his right
    }
    // the pencil, a few strokes at a time; held off the page while he looks
    const stroke = this.part('vincent_drawing_stroke');
    if (stroke) {
      const go = drawing ? 1 : 0;
      const burst = Math.max(0, Math.sin(t * 0.9)) ** 0.5; // a few strokes, then a pause
      stroke.rotation.x += go * burst * Math.sin(t * 13) * 0.05 + (1 - go) * 0.12;
      stroke.rotation.z += go * burst * Math.sin(t * 6.5) * 0.04;
    }
    const book = this.part('vincent_drawing_book');
    if (book && this.phase === 'back') book.rotation.x += Math.sin(Math.min(1, this.t / this.length) * Math.PI) * 0.35;
    // the robin
    if (Math.random() < dt * 0.6) this.glanceTo = rand(-0.9, 0.9);
    if (Math.random() < dt * 0.05) this.turnTo = rand(-0.6, 0.6);
    this.glance = damp(this.glance, this.glanceTo, 18, dt); // birds look about in jerks
    this.turn = damp(this.turn, this.turnTo, 10, dt);
    const robin = this.part('vincent_drawing_robin');
    if (robin) robin.rotation.y += this.turn;
    const rh = this.part('drawing_robin_head');
    if (rh) rh.rotation.y += this.glance;
  }
}

/**
 * Vincent out in Beike's meadow (routines.py `ball`), throwing the ball for him: he watches Beike
 * go, and when the ball's at his feet he bends for it, winds up over his shoulder and lets fly.
 * Beike (beike.ts `playWith`) does the rest.
 */
export class Thrower {
  readonly root?: THREE.Object3D;
  private parts = new Map<string, THREE.Object3D>();
  private phase: 'watch' | 'stoop' | 'wind' | 'throw' = 'watch';
  private t = 0;
  private heading = 0;
  private clock = 0;
  private home = V();

  constructor(island: Island) {
    this.root = island.get('vincent_ball');
    this.root?.traverse((o) => this.parts.set(o.name, o));
    if (this.root) {
      this.heading = this.root.rotation.y;
      this.home.copy(this.root.position);
    }
  }

  set visible(on: boolean) {
    if (this.root) this.root.visible = on;
    if (!on) this.phase = 'watch';
  }

  get visible() {
    return !!this.root?.visible;
  }

  /** Where he's standing. */
  get at() {
    return this.home;
  }

  get head() {
    return this.parts.get('ball_head');
  }

  update(dt: number, beike: Beike) {
    const root = this.root;
    if (!root?.visible) return;
    const t = (this.clock += dt);
    this.t += dt;
    const dog = beike.position;
    // face the dog (the model faces +z)
    const want = Math.atan2(dog.x - root.position.x, dog.z - root.position.z);
    let d = want - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (this.phase === 'watch') this.heading += d * (1 - Math.exp(-3 * dt));
    root.rotation.set(0, this.heading, 0);
    let arm = 0; // the right arm: + forward and up, round past straight up to behind his head
    let other = 0;
    let bow = 0;
    switch (this.phase) {
      case 'watch':
        if (beike.ballAtFeet && this.t > 0.8) Object.assign(this, { phase: 'stoop', t: 0 });
        break;
      case 'stoop': {
        const k = Math.min(1, this.t / 0.7);
        arm = Math.sin(k * Math.PI) * 0.7;
        bow = Math.sin(k * Math.PI);
        if (k > 0.5 && beike.ballAtFeet) {
          const hand = this.parts.get('ball_arm_r');
          if (hand) beike.hand(hand);
        }
        if (k >= 1) Object.assign(this, { phase: beike.inHand ? 'wind' : 'watch', t: 0 });
        break;
      }
      case 'wind': {
        const k = ease(Math.min(1, this.t / 0.6), 0, 1);
        arm = k * 3.5;
        other = k * 0.9; // the left out in front, at where it's going
        if (this.t > 0.75) Object.assign(this, { phase: 'throw', t: 0 });
        break;
      }
      case 'throw': {
        const k = Math.min(1, this.t / 0.3);
        arm = 3.5 - ease(k, 0, 1) * 2.6;
        other = 0.9 * (1 - k);
        if (k > 0.45 && beike.inHand) beike.throwFrom();
        if (this.t > 0.9) Object.assign(this, { phase: 'watch', t: 0 });
        break;
      }
    }
    const part = (name: string) => this.parts.get(name);
    part('ball_arm_r')?.rotation.set(-arm, 0, 0);
    part('ball_arm_l')?.rotation.set(-other + Math.sin(t * 0.8) * 0.03, 0, 0);
    part('ball_head')?.rotation.set(bow * 0.45 - (this.phase === 'watch' && beike.position.distanceTo(root.position) > 4 ? 0.05 : 0), 0, 0);
    part('ball_leg_l')?.rotation.set(-bow * 0.15, 0, 0);
    part('ball_leg_r')?.rotation.set(bow * 0.2 + (this.phase === 'throw' ? 0.25 : 0), 0, 0);
  }
}
