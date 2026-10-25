import * as THREE from 'three';
import type { Ground } from './beike';
import type { Call } from './fauna';
import type { Island } from './island';
import { BREAK, SET, rollRate, roller, shoreDistance } from './water';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const damp = THREE.MathUtils.damp;
const smooth = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const TAU = Math.PI * 2;
/** `a` brought into 0..2π. */
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
/** …and into the length of a set: how far (radians of the roller) till the good one's crest. */
const SET_LENGTH = TAU * SET;
const tillGood = (phase: number) => ((((Math.PI / 2 - phase) % SET_LENGTH) + SET_LENGTH) % SET_LENGTH);
/** The shortest turn from `a` to `b`. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

const HIP = 0.84; // hips over the soles (surf.py)
const THIGH = 0.42; // hip to knee
const SHIN = 0.415; // knee to sole
const DECK = 0.08; // the board's thickness
const SINK = -0.01; // how far the board floats under the surface (just over it: the sea's drawn in steps)
const WALK = 0.9; // m/s, down the beach with the board
const WADE = 0.5; // m/s, pushing it out through the shallows
const PADDLE = 0.7; // m/s, lying on it, out to where the waves stand up
const DASH = 0.5; // m/s, paddling hard for one (slower than the rollers come in, or they'd never catch him)
const STROKE = 1.1; // seconds a stroke, each arm
const DEEP = -0.45; // where the sea's this deep, he gets on and paddles
const LINEUP = 0.4; // where he sits waiting (shore distance, the sea's 0..1)
const FACE = 0.45; // how far ahead of the crest he rides, on its face (radians of the roller)
const RIDE = 1.5; // m/s along the wave, when he's up
/** How far off the good one is when he turns for it (radians of the roller: about two and a half metres; he's slower than it, but not by much). */
const GO = 4.5;
/** Where he comes down to the water with his board (Blender x, y): the top of the beach east of the pier. */
const START = { x: 10.6, y: -17.3 };
/** Of every go he has: how often he misses it, nosedives, gets up and straight off, gets up and wobbles off, or rides it. */
const ODDS: [Go, number][] = [['miss', 0.2], ['nose', 0.17], ['flop', 0.2], ['wobble', 0.18], ['ride', 0.25]];

type Go = 'miss' | 'nose' | 'flop' | 'wobble' | 'ride';
type Phase =
  | 'stand' | 'down' | 'wade' | 'out' | 'sit' | 'turn' | 'paddle' | 'missed' | 'pop' | 'wobble' | 'ride' | 'glide' | 'hop'
  | 'fall' | 'under' | 'up' | 'swim' | 'climb' | 'in' | 'ashore' | 'home';
/** What he's up to, for what's said when you click him (content.ts). */
export type Doing = 'carrying' | 'paddling' | 'waiting' | 'going' | 'riding' | 'falling' | 'missed';
const DOING: Record<Phase, Doing> = {
  stand: 'carrying', down: 'carrying', wade: 'carrying', out: 'paddling', sit: 'waiting', turn: 'going', paddle: 'going', missed: 'missed',
  pop: 'going', wobble: 'riding', ride: 'riding', glide: 'riding', hop: 'riding', fall: 'falling', under: 'falling', up: 'falling',
  swim: 'falling', climb: 'falling', in: 'paddling', ashore: 'carrying', home: 'carrying',
};

/** How he holds himself, eased from one moment to the next. */
interface Shape {
  pitch: number; // tipped forward (+, lying on the board) or back (−)
  yaw: number; // turned on the board: −π/2 side-on, his left foot to the nose
  roll: number; // leaning to his left (+) or right
  hip: number; // the hips' height (world)
  legX: [number, number];
  legZ: [number, number];
  shin: [number, number];
  armX: [number, number];
  armZ: [number, number];
  headX: number;
  headY: number;
}
const shape = (): Shape => ({ pitch: 0, yaw: 0, roll: 0, hip: HIP, legX: [0, 0], legZ: [0, 0], shin: [0, 0], armX: [0, 0], armZ: [0, 0], headX: 0, headY: 0 });

/** The board, under him, under his arm, or off on its own after a wipeout. */
interface Board {
  at: THREE.Vector3; // world; y the bottom of it
  heading: number;
  pitch: number; // nose down (+)
  roll: number;
  loose: boolean;
  v: THREE.Vector3;
  spin: THREE.Vector3; // pitch, heading, roll: radians a second
}

const E = new THREE.Euler();
const C = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Vincent surfing (surf.py `vincent_surf`, `surfboard`), on a day with a swell running: he
 * carries his soft-top down the beach east of the pier, pushes it out through the shallows and
 * paddles out to where the waves stand up over the sandbar (water.ts BREAK, where they come in
 * clean). There he sits astride it, facing out to sea, letting a few go by; then he turns, lies
 * down and paddles hard for one. He's not very good. Sometimes the wave goes on without him;
 * more often he gets halfway up, or all the way up, and comes straight off, or the nose goes
 * under and he goes over the front, the board flying; he comes up, gets back on and paddles out
 * again. But now and then he's up, knees bent and arms out, riding it along and in, and he
 * punches the air at the end of it.
 *
 * Asked to `finish`, he paddles in, and once he's back up the beach he's `ashore`.
 */
export class Surfer {
  readonly root?: THREE.Object3D;
  private boardObj?: THREE.Object3D;
  private core?: THREE.Object3D;
  private parts = new Map<string, THREE.Object3D>();
  /** The sea's uniforms (water.ts), for where its rollers are: main.ts hands them over. */
  sea?: Record<string, THREE.IUniform>;
  private distance: (x: number, y: number) => number;
  private phase: Phase = 'ashore';
  private t = 0;
  private length = 0;
  private clock = 0;
  private stroke = 0;
  private dt = 0;
  /** Paddling for one: whether its crest has come close yet (if it then goes by, he's missed it). */
  private closing = false;
  private step = 0;
  private finishing = false;
  /** How many more rollers he lets go by, and the one going under him last. */
  private letGo = 0;
  private lastPhase = 0;
  /** This go: how it'll turn out, the crest he's on (its phase), which way along it, and how long he lasts up. */
  private go: Go = 'miss';
  private crest = 0;
  private along = 1;
  private lasts = 0;
  private fallKind: 'nose' | 'back' | 'side' = 'back';
  private target = V();
  private now = shape();
  private want = shape();
  readonly at = V();
  heading = 0;
  private start = V();
  private velocity = V();
  readonly board: Board = { at: V(), heading: 0, pitch: 0, roll: 0, loose: false, v: V(), spin: V() };
  /** Water thrown up: a stroke (small), or going right in (big). */
  onSplash?: (at: THREE.Vector3, big: boolean) => void;
  /** His sounds: sloshing in, going under, a stroke, a laugh as he comes up. */
  onSound?: (call: Call, at: THREE.Vector3, loud?: number) => void;

  constructor(
    island: Island,
    private ground: Ground,
  ) {
    this.root = island.get('vincent_surf');
    this.root?.traverse((o) => this.parts.set(o.name, o));
    this.core = this.part('core');
    this.boardObj = island.root.getObjectByName('surfboard'); // (clicking it is clicking him: it has his id)
    if (this.boardObj) this.boardObj.rotation.order = 'YXZ';
    this.distance = shoreDistance(island.shore, island.info);
    this.start.set(START.x, 0, -START.y);
    this.visible = false;
  }

  set visible(on: boolean) {
    if (this.root) this.root.visible = on;
    if (this.boardObj) this.boardObj.visible = on;
  }

  get visible() {
    return !!this.root?.visible;
  }

  /** Where he comes down to the beach with his board. */
  get startAt() {
    return this.start;
  }

  /** Back up the beach with his board, done (or not yet down to the water). */
  get ashore() {
    return this.phase === 'ashore';
  }

  get doing(): Doing {
    return DOING[this.phase];
  }

  get head() {
    return this.part('head');
  }

  /** At the top of the beach with his board under his arm, about to go in. */
  begin() {
    this.finishing = false;
    this.at.copy(this.start);
    this.heading = Math.PI * 0.05; // looking out to sea (south, +z)
    this.board.loose = false;
    this.goTo('stand', rand(2, 4));
    this.update(0);
  }

  /** Straight out on the water, sitting waiting: for previews. */
  midway() {
    this.begin();
    this.lineup();
    this.at.copy(this.target);
    this.heading = this.seaward(this.at);
    this.goTo('sit');
    this.update(0);
  }

  /** Time to go: he paddles in, and up the beach. */
  finish() {
    this.finishing = true;
  }

  update(dt: number) {
    this.dt = dt;
    this.clock += dt;
    this.t += dt;
    const w = this.want;
    Object.assign(w, shape());
    const surface = this.surface(this.at.x, this.at.z);
    switch (this.phase) {
      case 'ashore':
        this.standing(w);
        this.carry();
        break;
      case 'stand':
        // a look at the sea first
        this.standing(w);
        w.headY = Math.sin(this.t * 0.8) * 0.4;
        this.carry();
        if (this.t > this.length) this.goTo('down');
        break;
      case 'down':
      case 'home': {
        // down the sand to the water, or back up it to where he came from
        const to = this.phase === 'down' ? this.edge(this.at.x) : this.start;
        const there = this.walk(to, WALK, dt);
        this.walking(w, 0.45);
        this.carry();
        if (there) {
          if (this.phase === 'home') this.goTo('ashore');
          else {
            this.target.copy(this.deepFrom(this.at));
            this.goTo('wade');
          }
        }
        break;
      }
      case 'wade': {
        // out through the shallows, pushing the board ahead of him over the little waves
        const there = this.walk(this.target, WADE, dt);
        this.walking(w, 0.25);
        w.armX = [-1.1, -1.1];
        w.armZ = [0.15, -0.15];
        this.push();
        if (there) {
          this.onSound?.('slosh', this.at.clone().setY(0));
          this.lineup();
          this.goTo('out');
        }
        break;
      }
      case 'in': {
        // back to where he can stand
        const there = this.paddleTo(this.target, PADDLE, dt);
        this.prone(w, 1);
        this.onBoard(w);
        if (there) this.goTo('home'); // where he can stand: off, and up the beach with it
        break;
      }
      case 'out': {
        if (this.finishing) {
          this.target.copy(this.deepFrom(this.at));
          this.goTo('in');
          break;
        }
        const there = this.paddleTo(this.target, PADDLE, dt);
        this.prone(w, 1);
        // a roller coming at him: up on his arms, and it goes under
        const r = this.rollerAt(this.at);
        const over = Math.cos(wrap(r.phase) - Math.PI / 2);
        if (over > 0.6 && r.height > 0.08) {
          w.pitch = 1.05;
          w.armX = [-0.9, -0.9];
          w.armZ = [0.25, -0.25];
          w.headX = -0.3;
        }
        this.onBoard(w);
        if (there) {
          this.goTo('sit');
          this.letGo = Math.floor(rand(0, 2.5));
        }
        break;
      }
      case 'sit': {
        // astride the board, facing out, watching them come
        this.drift(dt);
        this.heading += clamp(turn(this.heading, this.seaward(this.at)), -1.2 * dt, 1.2 * dt);
        this.sitting(w);
        this.onBoard(w);
        const r = this.rollerAt(this.at);
        // a good one gone under him (the little ones between don't count)
        const past = tillGood(r.phase) > tillGood(this.lastPhase) + Math.PI;
        this.lastPhase = r.phase;
        if (past && this.t > 1) this.letGo--;
        if (this.finishing) {
          this.target.copy(this.deepFrom(this.at));
          this.goTo('in');
        } else if (this.letGo <= 0 && this.t > 2 && tillGood(r.phase) < GO) {
          // the next good one's a few seconds off, and it's his: round, and go
          this.go = pick(ODDS);
          this.goTo('turn');
        }
        break;
      }
      case 'turn':
        // round to face the beach, and down on his front
        this.heading += clamp(turn(this.heading, this.shoreward(this.at)), -2.6 * dt, 2.6 * dt);
        if (this.t < 0.9) this.sitting(w);
        else this.prone(w, 1.6);
        this.onBoard(w);
        if (this.t > 1.3) {
          this.closing = false;
          this.goTo('paddle');
        }
        break;
      case 'paddle': {
        // paddling hard, looking back over his shoulder now and then
        this.heading += clamp(turn(this.heading, this.shoreward(this.at)), -1.5 * dt, 1.5 * dt);
        this.forward(DASH * (0.7 + 0.3 * Math.min(1, this.t)), dt);
        this.prone(w, 1.8);
        this.onBoard(w);
        const r = this.rollerAt(this.at);
        const ahead = tillGood(r.phase); // till the good one's crest is under him
        if (ahead < 1) this.closing = true;
        if (this.go === 'miss') {
          if (this.closing && ahead > Math.PI && ahead < SET_LENGTH - 0.5) this.goTo('missed', rand(1.4, 2)); // gone by
        } else if (ahead < FACE && this.t > 0.6 && r.shoal > 0.25) {
          // the crest's just behind him: he's on the face
          this.crest = r.phase + ahead;
          this.along = this.at.x < BREAK.x + 1.5 ? (Math.random() < 0.85 ? 1 : -1) : -1;
          this.lasts = this.go === 'ride' ? Infinity : this.go === 'wobble' ? rand(0.9, 1.8) : 0;
          this.goTo('pop');
        } else if (this.t > SET_LENGTH / rollRate((this.sea?.uSea.value as number) ?? 0) + 2) this.goTo('missed', 1.5);
        break;
      }
      case 'missed':
        // it went on without him: up on his arms, a slap at the water, and round again
        this.drift(dt);
        this.prone(w, 0);
        w.pitch = 1.0;
        w.armX = [-0.9, this.t < 0.6 ? -1.8 + this.t * 2 : -0.9];
        w.armZ = [0.25, -0.5];
        w.headX = -0.4;
        if (this.t > 0.55 && this.t - dt <= 0.55) this.onSplash?.(this.hand('r'), false);
        this.onBoard(w);
        if (this.t > this.length) {
          this.lineup();
          this.goTo('out');
        }
        break;
      case 'pop':
      case 'wobble':
      case 'ride':
        this.onTheFace(dt, w);
        break;
      case 'glide': {
        // the wave's gone to nothing on the sand: still up, slowing, a fist in the air
        const slow = Math.max(0, 1 - this.t / this.length);
        this.at.addScaledVector(this.velocity, slow * dt);
        this.stance(w, 0.2);
        w.armX[0] = -2.9;
        w.armZ[0] = 0.25;
        this.onBoard(w);
        if (this.t > this.length) this.goTo('hop');
        break;
      }
      case 'hop':
        // off into the shallows, and the board back in hand
        this.standing(w);
        this.push();
        w.armX = [-1.0, -1.0];
        w.armZ = [0.15, -0.15];
        if (this.t < 0.35) w.hip += Math.sin((this.t / 0.35) * Math.PI) * 0.3;
        if (this.t > 0.35 && this.t - dt <= 0.35) {
          this.onSplash?.(this.at.clone().setY(0), false);
          this.onSound?.('slosh', this.at.clone().setY(0));
        }
        if (this.t > 1.2) {
          if (this.finishing) this.goTo('home');
          else {
            this.target.copy(this.deepFrom(this.at));
            this.goTo('wade');
          }
        }
        break;
      case 'fall':
        this.falling(dt, w, surface);
        break;
      case 'under':
        // under, and the board off on its own
        this.drift(dt);
        w.hip = surface - 1.4;
        w.pitch = 0.3;
        if (this.t > this.length) {
          this.goTo('up');
          this.onSplash?.(this.at.clone().setY(surface), false);
          if (Math.random() < 0.4) this.onSound?.('laugh', this.at.clone().setY(1));
        }
        break;
      case 'up':
        // head out, shaking the water off it
        this.drift(dt);
        this.treading(w, surface);
        w.headY = Math.sin(this.t * 14) * 0.3 * Math.max(0, 1 - this.t / 0.9);
        if (this.t > 1.1) this.goTo('swim');
        break;
      case 'swim': {
        // after the board
        const b = this.board.at;
        this.heading += turn(this.heading, Math.atan2(b.x - this.at.x, b.z - this.at.z)) * (1 - Math.exp(-6 * dt));
        const d = Math.hypot(b.x - this.at.x, b.z - this.at.z);
        if (d > 0.7) this.forward(0.6, dt);
        this.treading(w, surface);
        w.armX = [-2.0 + Math.sin(this.clock * 5) * 0.6, -2.0 - Math.sin(this.clock * 5) * 0.6];
        w.armZ = [0.4, -0.4];
        if (d <= 0.8 || this.t > 6) this.goTo('climb');
        break;
      }
      case 'climb': {
        // the board righted, and back on, lying down
        const k = smooth(this.t, 0, 0.5);
        const b = this.board;
        b.loose = false;
        b.roll = damp(b.roll, Math.round(b.roll / TAU) * TAU, 10, dt);
        b.pitch = damp(b.pitch, 0, 8, dt);
        b.at.y = this.surface(b.at.x, b.at.z) - SINK;
        this.heading = b.heading;
        this.at.lerp(V(b.at.x, 0, b.at.z), Math.min(1, dt * 6));
        this.prone(w, 0);
        w.hip = THREE.MathUtils.lerp(surface - 0.6, w.hip + b.at.y + DECK, k);
        if (this.t > 0.8) {
          b.roll = Math.round(b.roll / TAU) * TAU;
          this.lineup();
          this.goTo('out');
        }
        break;
      }
    }
    this.pose(dt);
  }

  // --- on the wave --------------------------------------------------------------------

  /** Up on it (or getting up, or about to come off): kept on the face of the roller, and along it. */
  private onTheFace(dt: number, w: Shape) {
    const u = this.sea;
    const rollT = (u?.uRollT.value as number) ?? 0;
    // where the face is, just ahead of the crest, as the crest comes in
    const want = (this.crest - FACE - rollT) / 24;
    const n = this.downhill(this.at);
    const d = this.distance(this.at.x, -this.at.z);
    const g = Math.max(0.01, n.length());
    n.normalize();
    const along = V(-n.z, 0, n.x).multiplyScalar(this.along);
    // the wave's pace, in, and his along it
    const speed = rollRate((u?.uSea.value as number) ?? 0) / 24 / g;
    const sideways = this.phase === 'pop' ? 0.4 : this.phase === 'wobble' ? 0.8 : RIDE * (0.8 + 0.2 * Math.sin(this.t * 1.7));
    const before = this.at.clone();
    this.at.addScaledVector(along, sideways * dt);
    this.at.addScaledVector(n, ((d - want) / g) * Math.min(1, dt * 8));
    this.velocity.subVectors(this.at, before).divideScalar(Math.max(dt, 1e-3));
    const going = Math.atan2(n.x * speed + along.x * sideways, n.z * speed + along.z * sideways);
    // carving: the board swings up the face and back down it
    const carve = this.phase === 'ride' ? Math.sin(this.t * 1.7) * 0.25 : 0;
    this.heading += turn(this.heading, going + carve * this.along) * (1 - Math.exp(-5 * dt));
    if (this.phase === 'pop') {
      // a push up on his hands, and his feet under him
      const k = this.t / 0.5;
      if (k < 0.45) {
        this.prone(w, 0);
        w.pitch = 1.57 - k * 1.2;
        w.armX = [-0.9, -0.9];
        w.armZ = [0.2, -0.2];
        w.headX = -0.6;
      } else this.stance(w, 0.9);
      this.onBoard(w);
      if (this.go === 'nose' && this.t > 0.32) return this.fall('nose');
      if (this.go === 'flop' && this.t > 0.6) return this.fall(Math.random() < 0.5 ? 'back' : 'side');
      if (this.t > 0.5 && (this.go === 'wobble' || this.go === 'ride')) this.goTo(this.go === 'ride' ? 'ride' : 'wobble');
      return;
    }
    if (this.phase === 'wobble') {
      // arms going round, and more so, till he's off
      const k = this.t / this.lasts;
      this.stance(w, 0.6);
      const s = Math.sin(this.t * 9) * (0.3 + k * 0.9);
      w.roll = s * 0.35;
      w.pitch += Math.sin(this.t * 6.5) * 0.2 * k;
      w.armX = [-0.3 + Math.sin(this.t * 11) * 1.4 * k, -0.3 - Math.sin(this.t * 11 + 1) * 1.4 * k];
      w.armZ = [1.1 + s, -1.1 + s];
      this.onBoard(w);
      if (this.t > this.lasts) this.fall(Math.random() < 0.6 ? 'side' : 'back');
      return;
    }
    // riding it
    this.stance(w, 0.6 + Math.sin(this.t * 1.7) * 0.25);
    w.roll = Math.sin(this.t * 1.7 + 0.6) * 0.15 * this.along;
    this.onBoard(w);
    if (Math.floor((this.t - dt) * 3) !== Math.floor(this.t * 3)) this.onSplash?.(this.alongBoard(-0.9), false); // spray off the tail
    if (want < 0.05 || this.depth(this.at) > -0.2) {
      this.velocity.multiplyScalar(0.8);
      this.goTo('glide', 1.4);
      this.onSound?.('laugh', this.at.clone().setY(1));
    }
  }

  /** Off, one way or another: in he goes, and the board goes off on its own. */
  private fall(kind: 'nose' | 'back' | 'side') {
    this.fallKind = kind;
    const b = this.board;
    b.loose = true;
    const h = this.heading;
    const fwd = V(Math.sin(h), 0, Math.cos(h));
    b.v.copy(this.velocity).multiplyScalar(0.6);
    if (kind === 'nose') {
      b.v.addScaledVector(fwd, -0.6).setY(2.6);
      b.spin.set(-7, rand(-1, 1), rand(-2, 2)); // tail over nose, up it goes
    } else if (kind === 'back') {
      b.v.addScaledVector(fwd, 1.8).setY(1.4);
      b.spin.set(2, rand(-2, 2), rand(-4, 4)); // it shoots out from under him
    } else {
      b.v.addScaledVector(fwd, 0.6).setY(1.8);
      b.spin.set(rand(-2, 2), rand(-1.5, 1.5), rand(-8, -5) * this.along);
    }
    this.goTo('fall', 0.6);
  }

  private falling(dt: number, w: Shape, surface: number) {
    const k = clamp(this.t / this.length, 0, 1);
    const n = this.now;
    this.at.addScaledVector(this.velocity, dt * (1 - k * 0.7));
    Object.assign(w, { ...n, legX: [...n.legX], legZ: [...n.legZ], shin: [...n.shin], armX: [...n.armX], armZ: [...n.armZ] });
    // flung: forward over the nose, back off the tail, or off the side, arms flying, and in
    if (this.fallKind === 'nose') {
      w.pitch = 0.4 + k * 1.9;
      w.armX = [-2.6, -2.4];
      w.armZ = [0.4, -0.4];
      w.legX = [0.5, 0.2];
    } else if (this.fallKind === 'back') {
      w.pitch = 0.2 - k * 1.8;
      w.armX = [-2.4 - k, -2.2 - k];
      w.armZ = [0.7, -0.7];
      w.legX = [-0.9, -0.5];
      w.shin = [0.3, 0.6];
    } else {
      w.roll = (0.3 + k * 1.3) * this.along;
      w.armX = [-1.5 - Math.sin(this.t * 14) * 0.8, -1.5 + Math.sin(this.t * 14) * 0.8];
      w.armZ = [1.6, -1.6];
    }
    w.hip = THREE.MathUtils.lerp(this.now.hip, surface - 0.9, k * k);
    this.drift(dt);
    if (this.t > 0.32 && this.t - dt <= 0.32) {
      this.onSplash?.(this.at.clone().setY(surface), true);
      this.onSound?.('duck', this.at.clone().setY(0));
    }
    if (this.t > this.length) this.goTo('under', rand(0.9, 1.5));
  }

  // --- the board ----------------------------------------------------------------------

  /** Under his right arm, on its edge, the nose ahead. */
  private carry() {
    const b = this.board;
    const h = this.heading;
    b.loose = false;
    b.at.set(this.at.x - Math.cos(h) * 0.4, this.groundAt(this.at.x, this.at.z) + 0.95, this.at.z + Math.sin(h) * 0.4);
    b.heading = h;
    b.pitch = 0;
    b.roll = -Math.PI / 2;
    this.want.armZ[1] = -0.22;
    this.want.armX[1] = -0.15;
  }

  /** On the water ahead of him, his hands on the rails. */
  private push() {
    const b = this.board;
    const h = this.heading;
    b.loose = false;
    b.at.set(this.at.x + Math.sin(h) * 1.0, 0, this.at.z + Math.cos(h) * 1.0);
    b.at.y = this.surface(b.at.x, b.at.z) - SINK;
    b.heading = h;
    this.tilt(b);
    b.roll = 0;
  }

  /** Him on the board: it's under him, where he is, and he goes up and down with it. */
  private onBoard(w: Shape) {
    const b = this.board;
    b.loose = false;
    b.heading = this.heading;
    b.at.set(this.at.x, 0, this.at.z);
    b.at.y = this.surface(b.at.x, b.at.z) - SINK;
    this.tilt(b);
    b.roll = this.phase === 'ride' || this.phase === 'wobble' ? w.roll * 0.4 : 0;
    // lying on it, he's tipped with it
    if (w.pitch > 0.9) w.pitch += b.pitch;
    w.hip += b.at.y + DECK;
  }

  /** The board's nose up or down the slope of the water under it. */
  private tilt(b: Board) {
    const fx = Math.sin(b.heading) * 0.6;
    const fz = Math.cos(b.heading) * 0.6;
    const ahead = this.surface(b.at.x + fx, b.at.z + fz);
    const behind = this.surface(b.at.x - fx, b.at.z - fz);
    b.pitch = Math.atan2(behind - ahead, 1.2) * 0.8;
  }

  /** On its own: up in the air, down with a slap, then lying on the water, on its leash. */
  private drift(dt: number) {
    const b = this.board;
    if (!b.loose || !dt) return;
    const surface = this.surface(b.at.x, b.at.z) - SINK;
    b.at.addScaledVector(b.v, dt);
    if (b.at.y > surface + 0.01 || b.v.y > 0) {
      b.v.y -= 9.8 * dt;
      b.pitch += b.spin.x * dt;
      b.heading += b.spin.y * dt;
      b.roll += b.spin.z * dt;
      if (b.at.y <= surface && b.v.y < 0) {
        b.at.y = surface;
        b.v.set(b.v.x * 0.4, 0, b.v.z * 0.4);
        this.onSplash?.(b.at.clone().setY(surface), false);
      }
    } else {
      // flat on the water, right way up or upside down, the white water pushing it in a little
      b.at.y = surface;
      b.pitch = damp(b.pitch, Math.round(b.pitch / Math.PI) * Math.PI, 6, dt);
      b.roll = damp(b.roll, Math.round(b.roll / Math.PI) * Math.PI, 6, dt);
      b.v.multiplyScalar(Math.exp(-1.5 * dt));
      b.at.addScaledVector(this.downhill(b.at).normalize(), 0.15 * dt);
      // the leash
      const dx = b.at.x - this.at.x;
      const dz = b.at.z - this.at.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.4) {
        b.at.x = this.at.x + (dx / d) * 2.4;
        b.at.z = this.at.z + (dz / d) * 2.4;
      }
    }
  }

  private placeBoard(dt: number) {
    const o = this.boardObj;
    if (!o) return;
    const b = this.board;
    o.position.copy(b.at);
    o.rotation.set(b.pitch, b.heading, b.roll, 'YXZ');
    if (!dt) o.updateMatrix();
  }

  // --- the sea ------------------------------------------------------------------------

  /** The roller at a place (world x, z), as the sea draws it. */
  private rollerAt(p: THREE.Vector3) {
    const u = this.sea;
    return roller(this.distance(p.x, -p.z), (u?.uRollT.value as number) ?? 0, (u?.uSea.value as number) ?? 0);
  }

  /** The water's height (world) at x, z: the roller, and a little swell on top. */
  private surface(x: number, z: number) {
    const u = this.sea;
    const sea = (u?.uSea.value as number) ?? 0;
    const r = roller(this.distance(x, -z), (u?.uRollT.value as number) ?? 0, sea);
    const swell = (0.04 + sea * sea * 1.5) * 0.12 * (1 - r.shoal * 0.6) * Math.sin(this.clock * 1.3 + x * 0.4 - z * 0.3);
    return r.height + swell;
  }

  /** Towards the beach, down the shore-distance map (world x, z; its length how fast it falls per metre). */
  private downhill(p: THREE.Vector3) {
    const e = 0.5;
    const dx = this.distance(p.x + e, -p.z) - this.distance(p.x - e, -p.z);
    const dz = this.distance(p.x, -(p.z + e)) - this.distance(p.x, -(p.z - e));
    return V(-dx / (2 * e), 0, -dz / (2 * e));
  }

  private shoreward(p: THREE.Vector3) {
    const n = this.downhill(p);
    return Math.atan2(n.x, n.z);
  }

  private seaward(p: THREE.Vector3) {
    return this.shoreward(p) + Math.PI;
  }

  /** Somewhere to sit and wait, out where they stand up: over the sandbar, west of the middle so there's room to ride it east. */
  private lineup() {
    const x = BREAK.x + rand(-3.5, -0.5);
    let z = this.edge(x).z;
    while (z < 40 && this.distance(x, -z) < LINEUP) z += 0.1;
    this.target.set(x, 0, z);
  }

  /** Where the sand meets the sea, straight down the beach (south, +z) from x. */
  private edge(x: number) {
    const p = V(x, 0, this.start.z);
    while (p.z < 40 && this.groundAt(p.x, p.z) > 0.02) p.z += 0.1;
    return p;
  }

  /** Out from `p` (south) till it's deep enough to paddle. */
  private deepFrom(p: THREE.Vector3) {
    const q = this.edge(p.x);
    while (q.z < 40 && this.groundAt(q.x, q.z) > DEEP) q.z += 0.1;
    return q;
  }

  private depth(p: THREE.Vector3) {
    return this.groundAt(p.x, p.z);
  }

  private groundAt(x: number, z: number) {
    const h = this.ground.at(x, z);
    return Number.isNaN(h) ? -2 : h;
  }

  // --- getting about ------------------------------------------------------------------

  /** On towards `to` on foot. Whether he's there. */
  private walk(to: THREE.Vector3, speed: number, dt: number) {
    const dx = to.x - this.at.x;
    const dz = to.z - this.at.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) this.heading += turn(this.heading, Math.atan2(dx, dz)) * (1 - Math.exp(-8 * dt));
    if (d <= Math.max(speed * dt, 0.15)) {
      this.at.x = to.x;
      this.at.z = to.z;
      return true;
    }
    this.at.x += (dx / d) * speed * dt;
    this.at.z += (dz / d) * speed * dt;
    return false;
  }

  /** Lying on the board, paddling towards `to`, coming round to it. Whether he's there. */
  private paddleTo(to: THREE.Vector3, speed: number, dt: number) {
    const dx = to.x - this.at.x;
    const dz = to.z - this.at.z;
    const d = Math.hypot(dx, dz);
    const off = turn(this.heading, Math.atan2(dx, dz));
    if (d > 0.1) this.heading += clamp(off, -1.4 * dt, 1.4 * dt);
    if (d < 0.3) return true;
    // a surge with each pull; facing the wrong way, he mostly turns on the spot first
    const c = (this.stroke * 2) % 1;
    this.forward(speed * (0.7 + 0.6 * Math.max(0, Math.sin(c * Math.PI))) * Math.max(0.15, Math.cos(off)), dt);
    return false;
  }

  private forward(speed: number, dt: number) {
    this.at.x += Math.sin(this.heading) * speed * dt;
    this.at.z += Math.cos(this.heading) * speed * dt;
  }

  /** A point along the board from its middle (+ to the nose), on the water. */
  private alongBoard(k: number) {
    const b = this.board;
    return V(b.at.x + Math.sin(b.heading) * k, b.at.y + DECK, b.at.z + Math.cos(b.heading) * k);
  }

  private hand(side: 'l' | 'r') {
    const h = this.heading;
    const s = side === 'l' ? 1 : -1;
    return V(this.at.x + Math.cos(h) * 0.45 * s, this.surface(this.at.x, this.at.z), this.at.z - Math.sin(h) * 0.45 * s);
  }

  private goTo(phase: Phase, length = 0) {
    this.phase = phase;
    this.t = 0;
    this.length = length;
  }

  // --- how he holds himself -----------------------------------------------------------

  private standing(w: Shape) {
    w.hip = this.groundAt(this.at.x, this.at.z) + HIP;
  }

  private walking(w: Shape, swing: number) {
    this.standing(w);
    const p = this.clock * Math.PI * (swing > 0.3 ? 2 : 1.4);
    if (Math.floor(p / Math.PI) !== this.step) {
      this.step = Math.floor(p / Math.PI);
      if (this.phase === 'wade' && this.groundAt(this.at.x, this.at.z) < -0.05) this.onSound?.('slosh', this.at.clone().setY(0), 0.7 + Math.random() * 0.4);
    }
    const s = Math.sin(p) * swing;
    w.hip += Math.abs(Math.cos(p)) * 0.03;
    w.legX = [s, -s];
    w.shin = [Math.max(0, Math.sin(p + 0.9)) * swing * 1.2, Math.max(0, -Math.sin(p + 0.9)) * swing * 1.2];
    w.armX = [-s * 0.9, s * 0.4];
  }

  /**
   * Flat on the board, head up, arms going round in turn: `pace` strokes a second-and-a-bit
   * (0 lying still). His hips (w.hip, over the deck) are a little back from the middle.
   */
  private prone(w: Shape, pace: number) {
    const before = this.stroke;
    this.stroke += (pace * this.dt) / STROKE;
    const p = this.stroke * TAU;
    w.pitch = Math.PI / 2;
    w.hip = 0.14;
    w.legX = [0.05, 0.05];
    w.legZ = [0.08, -0.08];
    w.shin = [0.35, 0.25];
    const a = pace ? 1.1 : 0.2;
    w.armX = [-Math.PI / 2 + Math.sin(p) * a, -Math.PI / 2 - Math.sin(p) * a];
    w.armZ = [0.38, -0.38];
    w.headX = -0.95;
    if (pace && Math.floor(before * 2) !== Math.floor(this.stroke * 2)) {
      const side = Math.floor(this.stroke * 2) % 2 ? 'l' : 'r';
      this.onSplash?.(this.hand(side), false);
      this.onSound?.('swimstroke', this.hand(side), 0.5 + Math.random() * 0.3);
    }
  }

  /** Sitting up on it, legs either side in the water, hands on his thighs, looking about. */
  private sitting(w: Shape) {
    w.pitch = -0.08 + Math.sin(this.clock * 0.9) * 0.03;
    w.hip = 0.1;
    w.legX = [-1.1, -1.15];
    w.legZ = [0.5, -0.5];
    w.shin = [1.25, 1.3];
    w.armX = [-0.55, -0.5];
    w.armZ = [0.18, -0.18];
    // watching the sea, and now and then a look back at the beach
    w.headY = Math.sin(this.clock * 0.35) * 0.5;
    w.headX = 0.05;
  }

  /** On his feet on it, side-on, his left foot to the nose: crouched by `bend` (0..1), arms out. */
  private stance(w: Shape, bend: number) {
    w.yaw = -Math.PI / 2;
    w.pitch = 0.15 + bend * 0.25;
    w.legX = [-0.35 * bend, -0.45 * bend];
    w.legZ = [0.42, -0.42];
    w.shin = [0.8 * bend, 0.9 * bend];
    w.armX = [-0.35, -0.2];
    w.armZ = [1.15, -0.95];
    w.headY = 0.75; // looking where he's going, over his left shoulder
    w.headX = 0.1;
    w.hip = sole(w);
  }

  /** In the water up to his chin, keeping himself up. */
  private treading(w: Shape, surface: number) {
    w.hip = Math.max(surface - 0.78, this.groundAt(this.at.x, this.at.z) + 0.3) + Math.sin(this.clock * 3) * 0.03;
    w.legX = [Math.sin(this.clock * 3) * 0.3, -Math.sin(this.clock * 3) * 0.3];
    w.armX = [-1.4, -1.4];
    w.armZ = [0.7 + Math.sin(this.clock * 4) * 0.3, -0.7 - Math.sin(this.clock * 4) * 0.3];
    w.headX = -0.15;
  }

  private pose(dt: number) {
    const root = this.root;
    if (!root) return;
    // into a new way of holding himself quickly (he's on a moving board), then keeping up with it
    const quick = this.phase === 'pop' || this.phase === 'fall' || this.phase === 'wobble';
    const k = !dt ? Infinity : quick ? 18 : this.t < 0.6 ? 7 : 16;
    const n = this.now;
    const w = this.want;
    const e = (a: number, b: number) => (k === Infinity ? b : damp(a, b, k, dt));
    n.pitch = e(n.pitch, w.pitch);
    n.yaw = n.yaw + (k === Infinity ? turn(n.yaw, w.yaw) : turn(n.yaw, w.yaw) * (1 - Math.exp(-k * dt)));
    n.roll = e(n.roll, w.roll);
    n.hip = this.phase === 'fall' ? w.hip : e(n.hip, w.hip);
    n.headX = e(n.headX, w.headX);
    n.headY = e(n.headY, w.headY);
    for (const i of [0, 1]) {
      n.legX[i] = e(n.legX[i], w.legX[i]);
      n.legZ[i] = e(n.legZ[i], w.legZ[i]);
      n.shin[i] = e(n.shin[i], w.shin[i]);
      n.armX[i] = e(n.armX[i], w.armX[i]);
      n.armZ[i] = e(n.armZ[i], w.armZ[i]);
    }
    // lying on the board, his hips are back towards the tail
    const lying = smooth(n.pitch, 0.9, 1.4);
    const back = 0.35 * lying;
    root.position.set(this.at.x - Math.sin(this.heading) * back, 0, this.at.z - Math.cos(this.heading) * back);
    root.rotation.set(0, this.heading, 0);
    if (this.core) {
      this.core.visible = this.phase !== 'under'; // (all of him, not a foot left sticking out)
      this.core.position.y = n.hip;
      this.core.rotation.set(n.pitch, n.yaw, n.roll, 'YXZ');
    }
    for (const [i, side] of [[0, 'l'], [1, 'r']] as const) {
      this.part(`leg_${side}`)?.rotation.set(n.legX[i], 0, n.legZ[i]);
      this.part(`shin_${side}`)?.rotation.set(n.shin[i], 0, 0);
      this.part(`arm_${side}`)?.rotation.set(n.armX[i], 0, n.armZ[i]);
    }
    this.part('head')?.rotation.set(n.headX, n.headY, 0);
    this.placeBoard(dt);
  }

  private part(name: string) {
    return this.parts.get(`surf_${name}`);
  }
}

/** How high his hips are over his soles, the way he's holding his legs (and himself): so his feet are on the deck. */
function sole(w: Shape) {
  let low = 0;
  for (const [i, x] of [[0, 0.13], [1, -0.13]] as const) {
    const foot = V(0, -SHIN, 0).applyEuler(E.set(w.shin[i], 0, 0)).add(V(0, -THIGH, 0)).applyEuler(E.set(w.legX[i], 0, w.legZ[i]));
    foot.x += x;
    foot.applyEuler(C.set(w.pitch, 0, w.roll, 'YXZ'));
    low = Math.min(low, foot.y);
  }
  return -low + 0.01;
}

function pick<T>(odds: [T, number][]): T {
  let r = Math.random() * odds.reduce((s, [, p]) => s + p, 0);
  for (const [v, p] of odds) if ((r -= p) < 0) return v;
  return odds[0][0];
}
