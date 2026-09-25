import * as THREE from 'three';
import { Ground } from './beike';
import type { Beike } from './beike';
import type { Island } from './island';
import type { Particles } from './particles';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const chance = (p: number) => Math.random() < p;
const damp = THREE.MathUtils.damp;
const clamp = THREE.MathUtils.clamp;
/** Blender's (east, north) to a point in the scene (east, up, south). */
const B = (x: number, y: number) => V(x, 0, -y);
const PARKED = V(0, -80, 0);
const DECK = 0.78; // the top of the dock's planks
const SKY = B(2, -5); // the middle of the Super Sheep's playground

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** What the island is like right now, as far as the animals care. */
export interface Env {
  night: number; // 0 day … 1 night (the Sky's lamps)
  season: Season;
  wet: number; // 0 dry … 1 pouring
  storm: number; // 0 … 1 a thunderstorm
}
const dusky = (e: Env) => e.night > 0.12 && e.night < 0.9;
const dark = (e: Env) => e.night > 0.55;
const daylit = (e: Env) => e.night < 0.35;

/** Sounds the animals make (the island plays them; silent while sound is off). */
export type Call = 'chirp' | 'gull' | 'hoot' | 'quack' | 'honk' | 'blow' | 'baa' | 'chatter' | 'splash' | 'chord' | 'boom' | 'firework' | 'roar' | 'mew' | 'tap';

/** Who's out on this visit: some animals only turn up now and then. */
const LUCK = (() => {
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const want = (k: string) => q.get('animal') === k;
  return {
    stag: want('stag') || chance(0.25),
    blacksheep: want('blacksheep') || chance(0.2),
    fox: want('fox') || chance(0.55),
    deerByDay: want('deer') || chance(0.3),
    wanderer: want('wanderer') || chance(1 / 14),
    // the very rare ones
    starsheep: want('starsheep') || chance(1 / 20),
    rocky: want('rocky') || chance(1 / 25),
    gandalf: want('gandalf') || chance(1 / 30),
    gandalfSoon: want('gandalf'),
    supersheep: want('supersheep') || chance(1 / 30),
    supersheepSoon: want('supersheep'),
    whaleSoon: want('whale'),
    serpentSoon: want('serpent'),
    dolphinsSoon: want('dolphins'),
    geeseSoon: want('geese'),
    /** `?animal=badger` wakes the badger at any hour. */
    badger: want('badger'),
    owl: want('owl'),
  };
})();

/** One animal: a clone of its Blender template, with the rest pose of each part remembered. */
class Body {
  readonly root: THREE.Object3D;
  private rest = new Map<THREE.Object3D, { p: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3 }>();
  private found = new Map<string, THREE.Object3D | undefined>();

  constructor(
    readonly species: string,
    template: THREE.Object3D,
    scene: THREE.Scene,
  ) {
    this.root = template.clone(true);
    this.root.userData = { id: species };
    this.root.traverse((o) => {
      if (o !== this.root) this.rest.set(o, { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() });
    });
    this.hide();
    scene.add(this.root);
  }

  /** A part by name: "head" finds "<species>_head" (or the "_head001" the exporter makes of a clash). */
  part(name: string): THREE.Object3D | undefined {
    if (this.found.has(name)) return this.found.get(name);
    const want = `${this.species}_${name}`;
    let found: THREE.Object3D | undefined;
    this.root.traverse((o) => {
      if (!found && (o.name === want || (o.name.startsWith(want) && /^\d+$/.test(o.name.slice(want.length))))) found = o;
    });
    this.found.set(name, found);
    return found;
  }

  parts(...names: string[]) {
    return names.map((n) => this.part(n)).filter((o): o is THREE.Object3D => !!o);
  }

  /** Put every part back in its rest pose, ready for this frame's offsets. */
  relax() {
    for (const [o, r] of this.rest) {
      o.position.copy(r.p);
      o.rotation.copy(r.r);
      o.scale.copy(r.s);
    }
  }

  show(at: THREE.Vector3) {
    this.root.visible = true;
    this.root.position.copy(at);
  }

  hide() {
    this.root.visible = false;
    this.root.position.copy(PARKED);
  }

  get shown() {
    return this.root.visible;
  }
}

/** Flap a pair of wings (+1 is the left wing), or fold them away. */
function wings(l: THREE.Object3D | undefined, r: THREE.Object3D | undefined, flap: number, fold: number) {
  for (const [w, side] of [[l, 1], [r, -1]] as const) {
    if (!w) continue;
    w.rotation.x += side * flap;
    w.visible = fold < 0.5; // folded away: the body alone reads as a bird at rest
  }
}

/** Face along a direction: yaw from the ground heading, then pitch and roll (models face +x). */
function orient(o: THREE.Object3D, heading: number, pitch = 0, roll = 0) {
  o.rotation.set(roll, heading, pitch, 'YZX');
}
const headingOf = (dx: number, dz: number) => Math.atan2(-dz, dx);
const turnTo = (from: number, to: number, k: number, dt: number) => {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + d * (1 - Math.exp(-k * dt));
};

// --- ground animals ------------------------------------------------------------------------

interface WalkSpec {
  home: THREE.Vector3;
  roam: number;
  /** Where it comes out and goes home to. None: it sinks into the ground where it stands (burrows). */
  den?: THREE.Vector3;
  speed: number;
  run: number;
  gait: 'legs' | 'hop' | 'scuttle' | 'shuffle';
  /** Ground heights it will walk on. */
  band: [number, number];
  /** How often, when it stops, it puts its head down to graze or sniff (0..1). */
  graze: number;
  present(e: Env): boolean;
  /** How long it stays hidden after being startled, seconds. */
  shy?: [number, number];
}

type WalkState =
  | { kind: 'away'; until: number }
  | { kind: 'enter'; t: number }
  | { kind: 'idle'; until: number; graze: boolean }
  | { kind: 'walk'; to: THREE.Vector3; run: boolean; then?: 'leave' | 'hide' }
  | { kind: 'leave'; t: number }
  | { kind: 'act'; name: string; t: number; length: number };

/**
 * Anything that walks, hops, shuffles or scuttles: it comes out of its den (or up out of its
 * burrow) when it's its time of day, potters about its patch, grazes, and goes home again.
 * Startled, it bolts. Species add their own touches through `pose` and `act`.
 */
class Walker {
  readonly body: Body;
  state: WalkState = { kind: 'away', until: 0 };
  pos = V();
  heading = rand(0, Math.PI * 2);
  protected speed = 0;
  protected stride = 0;
  protected grazing = 0;
  protected clock = rand(0, 100);
  protected seed = Math.random() * 100;
  /** Sunk below the ground, 0 … 1 (burrowing animals). */
  protected sunk = 1;

  constructor(
    species: string,
    template: THREE.Object3D,
    scene: THREE.Scene,
    protected ground: Ground,
    protected obstacles: { at: THREE.Vector3; r: number }[],
    readonly spec: WalkSpec,
  ) {
    this.body = new Body(species, template, scene);
    this.state = { kind: 'away', until: rand(0, 4) };
  }

  /** Whether the camera can't see a spot (behind a tree); animals prefer to be seen. */
  hidden = (_p: THREE.Vector3) => false;

  walkable(p: THREE.Vector3) {
    const h = this.ground.at(p.x, p.z);
    if (Number.isNaN(h) || h < this.spec.band[0] || h > this.spec.band[1] || this.hidden(p)) return false;
    return this.obstacles.every((o) => Math.hypot(o.at.x - p.x, o.at.z - p.z) > o.r);
  }

  protected somewhere(around = this.spec.home, radius = this.spec.roam): THREE.Vector3 | null {
    for (let i = 0; i < 30; i++) {
      const a = rand(0, Math.PI * 2);
      const d = radius * Math.sqrt(Math.random());
      const p = around.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d));
      if (this.walkable(p)) return p;
    }
    return null;
  }

  /** Clicked: bolt from where the visitor is looking. */
  startle(from: THREE.Vector3) {
    const s = this.state.kind;
    if (s === 'away' || s === 'leave' || (s === 'walk' && this.state.run)) return;
    if (this.spec.den) {
      this.state = { kind: 'walk', to: this.spec.den.clone(), run: true, then: 'hide' };
      return;
    }
    const away = V(this.pos.x - from.x, 0, this.pos.z - from.z).normalize();
    let to = this.pos.clone().addScaledVector(away, 3);
    if (!this.walkable(to)) to = this.somewhere(this.pos, 3) ?? this.pos.clone();
    this.state = { kind: 'walk', to, run: true, then: 'hide' };
  }

  update(dt: number, e: Env) {
    this.clock += dt;
    const s = this.state;
    const b = this.body;
    let target: THREE.Vector3 | null = null;
    let pace = 0;
    const here = this.spec.present(e);

    switch (s.kind) {
      case 'away':
        if (here && this.clock > s.until) {
          const start = this.spec.den ?? this.somewhere();
          if (!start) break;
          this.pos.copy(start);
          this.sunk = this.spec.den ? 0 : 1;
          this.state = { kind: 'enter', t: 0 };
          b.show(this.pos);
        } else if (b.shown) b.hide();
        break;
      case 'enter':
        s.t += dt;
        this.sunk = Math.max(0, this.sunk - dt * 1.5);
        if (this.sunk <= 0) this.state = { kind: 'idle', until: this.clock + rand(1, 3), graze: false };
        break;
      case 'idle':
        if (!here) this.goHome();
        else if (this.clock > s.until) this.next();
        break;
      case 'walk': {
        target = s.to;
        pace = s.run ? this.spec.run : this.spec.speed;
        if (Math.hypot(s.to.x - this.pos.x, s.to.z - this.pos.z) < 0.15) {
          if (s.then === 'leave' || s.then === 'hide') this.state = { kind: 'leave', t: 0 };
          else this.state = { kind: 'idle', until: this.clock + rand(2, 7), graze: chance(this.spec.graze) };
        }
        break;
      }
      case 'leave':
        s.t += dt;
        if (!this.spec.den) this.sunk = Math.min(1, this.sunk + dt * 2.5);
        if (this.spec.den || this.sunk >= 1) {
          const [lo, hi] = this.spec.shy ?? [20, 45];
          this.state = { kind: 'away', until: this.clock + rand(lo, hi) };
          b.hide();
        }
        break;
      case 'act':
        s.t += dt;
        if (s.t >= s.length) this.state = { kind: 'idle', until: this.clock + rand(1, 3), graze: false };
        break;
    }
    if (this.state.kind === 'away') return;

    // walk
    this.speed = damp(this.speed, pace, 6, dt);
    if (target) {
      const dx = target.x - this.pos.x;
      const dz = target.z - this.pos.z;
      const want = headingOf(dx, dz);
      this.heading = turnTo(this.heading, want, 8, dt);
      const step = Math.min(this.speed * dt, Math.hypot(dx, dz));
      // scuttlers go sideways; everyone else goes where they face
      const dir = this.spec.gait === 'scuttle' ? want : this.heading;
      this.pos.x += Math.cos(dir) * step;
      this.pos.z -= Math.sin(dir) * step;
      this.stride += step;
    }
    const h = this.ground.at(this.pos.x, this.pos.z);
    if (!Number.isNaN(h)) this.pos.y = h;
    const still = this.state.kind === 'idle' && this.state.graze;
    this.grazing = damp(this.grazing, still ? 1 : 0, 3, dt);

    b.relax();
    b.root.position.copy(this.pos);
    b.root.position.y -= this.sunk * 0.6;
    orient(b.root, this.spec.gait === 'scuttle' ? this.heading + Math.PI / 2 : this.heading);
    this.pose(dt);
  }

  /** Stopped: go somewhere else in the patch, or just stand a while longer. */
  protected next() {
    const to = chance(0.7) ? this.somewhere() : null;
    this.state = to
      ? { kind: 'walk', to, run: false }
      : { kind: 'idle', until: this.clock + rand(3, 8), graze: chance(this.spec.graze) };
  }

  protected goHome() {
    this.state = this.spec.den
      ? { kind: 'walk', to: this.spec.den.clone(), run: false, then: 'leave' }
      : { kind: 'leave', t: 0 };
  }

  /** How far along the current gait cycle, and how much of a gait there is (0 standing). */
  protected get gait() {
    return { phase: this.stride * (this.spec.gait === 'hop' ? 2.2 : 5.5), moving: clamp(this.speed / Math.max(this.spec.speed, 0.01), 0, 1.6) };
  }

  /** Legs, head and tail, for animals built with them. Species override for extras. */
  protected pose(_dt: number) {
    const b = this.body;
    const { phase, moving } = this.gait;
    const t = this.clock;
    const legs = b.parts('leg_fl', 'leg_fr', 'leg_bl', 'leg_br');
    const swing = Math.min(moving, 1.4) * 0.5;
    legs.forEach((leg, i) => (leg.rotation.z += Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * swing));
    const trunk = b.part('body');
    if (trunk && this.spec.gait === 'legs') trunk.position.y += Math.abs(Math.sin(phase)) * 0.03 * moving;
    if (trunk && this.spec.gait === 'shuffle') trunk.rotation.x += Math.sin(phase * 1.2) * 0.12 * moving;
    if (trunk && this.spec.gait === 'hop') {
      const hop = Math.abs(Math.sin(phase * 0.5));
      trunk.position.y += hop * 0.16 * Math.min(moving, 1.2);
      trunk.rotation.z += Math.cos(phase * 0.5) * 0.25 * Math.min(moving, 1);
    }
    const head = b.part('neck') ?? b.part('head');
    if (head) {
      head.rotation.z -= this.grazing * 0.95;
      head.rotation.y += Math.sin(t * 0.35 + this.seed) * 0.45 * (1 - this.grazing) * Math.max(0, Math.sin(t * 0.17 + this.seed));
      head.rotation.z -= this.grazing * Math.max(0, Math.sin(t * 7)) * 0.08; // chewing, nibbling, sniffing
    }
    const tail = b.part('tail');
    if (tail) tail.rotation.y += Math.sin(t * 3 + this.seed) * 0.15;
  }
}

class Rabbit extends Walker {
  /** Beike is the one thing a rabbit keeps an eye on. */
  beike?: Beike;
  protected pose(dt: number) {
    super.pose(dt);
    const t = this.clock;
    const twitch = Math.max(0, Math.sin(t * 1.3 + this.seed) - 0.9) * 8;
    this.body.parts('ear_l', 'ear_r').forEach((e, i) => {
      e.rotation.x += (i ? -1 : 1) * twitch * 0.2;
      e.rotation.y += this.gait.moving * 0.35; // flat back when running
    });
    const head = this.body.part('head');
    if (head) head.rotation.x += Math.sin(t * 25) * 0.02 * (1 - this.gait.moving); // nose going
  }

  update(dt: number, e: Env) {
    super.update(dt, e);
    const dog = this.beike?.position;
    if (dog && this.body.shown && this.pos.distanceTo(dog) < 3.2) this.startle(dog);
  }
}

class Sheep extends Walker {
  private looking = 0;
  poke() {
    this.looking = 3;
    if (this.state.kind === 'walk' && !this.state.run) this.state = { kind: 'idle', until: this.clock + 3, graze: false };
    this.grazing = 0;
  }

  protected pose(dt: number) {
    this.looking = Math.max(0, this.looking - dt);
    super.pose(dt);
    const head = this.body.part('head');
    if (head && this.looking > 0) head.rotation.z += 0.2;
  }
}

class Badger extends Walker {
  private dug = 0;
  /** Digging for worms: nose in the ground, backside wiggling, earth flying. */
  protected next() {
    if (chance(0.35)) this.state = { kind: 'act', name: 'dig', t: 0, length: rand(3, 6) };
    else super.next();
  }

  poke() {
    this.state = { kind: 'act', name: 'sniff', t: 0, length: 3 };
  }

  get digging() {
    return this.state.kind === 'act' && this.state.name === 'dig';
  }

  update(dt: number, e: Env, particles?: Particles) {
    super.update(dt, e);
    if (this.digging && particles && (this.dug -= dt) < 0) {
      this.dug = 0.12;
      const nose = V(Math.cos(this.heading) * 0.45, 0.05, -Math.sin(this.heading) * 0.45).add(this.pos);
      particles.emit({ position: nose, velocity: V(rand(-0.6, 0.6) - Math.cos(this.heading) * 1.2, rand(1, 2), rand(-0.6, 0.6) + Math.sin(this.heading) * 1.2), color: pick(['#6a4a30', '#8a6440', '#4a3424']), life: 0.7, gravity: -7, size: 1 });
    }
  }

  protected pose(dt: number) {
    super.pose(dt);
    const s = this.state;
    const b = this.body;
    const head = b.part('head');
    const trunk = b.part('body');
    if (s.kind === 'act' && s.name === 'dig') {
      if (head) head.rotation.z -= 0.7;
      if (trunk) {
        trunk.rotation.z -= 0.15;
        trunk.rotation.x += Math.sin(this.clock * 14) * 0.12;
      }
      b.parts('leg_fl', 'leg_fr').forEach((l, i) => (l.rotation.z += Math.sin(this.clock * 16 + i * Math.PI) * 0.6));
    }
    if (s.kind === 'act' && s.name === 'sniff' && head) {
      head.rotation.z += 0.25;
      head.rotation.x += Math.sin(this.clock * 20) * 0.05;
    }
  }
}

class Hedgehog extends Walker {
  poke() {
    this.state = { kind: 'act', name: 'curl', t: 0, length: 6 };
  }

  protected pose(dt: number) {
    super.pose(dt);
    const s = this.state;
    const b = this.body;
    const trunk = b.part('body');
    if (trunk && this.gait.moving > 0.1) trunk.rotation.x += Math.sin(this.clock * 12) * 0.08;
    if (s.kind === 'act' && s.name === 'curl') {
      const k = Math.min(1, s.t * 4, (s.length - s.t) * 1.5);
      const head = b.part('head');
      if (head) head.scale.multiplyScalar(1 - k * 0.9);
      if (trunk) {
        trunk.scale.set(1 - k * 0.2, 1 + k * 0.1, 1 + k * 0.25);
        trunk.rotation.x += Math.sin(this.clock * 30) * 0.02 * k; // trembling a little
      }
    }
  }
}

class Fox extends Walker {
  /** Now and then it stops, listens, and pounces on a mouse in the grass. */
  protected next() {
    if (chance(0.3)) this.state = { kind: 'act', name: 'pounce', t: 0, length: 2.2 };
    else super.next();
  }

  protected pose(dt: number) {
    super.pose(dt);
    const s = this.state;
    if (s.kind !== 'act') return;
    const trunk = this.body.part('body');
    const head = this.body.part('head');
    if (s.t < 1) {
      if (head) head.rotation.z -= 0.35 * Math.min(1, s.t * 3); // listening
      return;
    }
    const k = Math.min(1, (s.t - 1) / 0.7);
    const arc = Math.sin(k * Math.PI);
    if (trunk) {
      trunk.position.y += arc * 0.55;
      trunk.rotation.z += 0.9 - k * 1.8; // up and over, nose first into the grass
    }
    if (k < 1) this.pos.addScaledVector(V(Math.cos(this.heading), 0, -Math.sin(this.heading)), dt * 1.3);
  }
}

class Deer extends Walker {
  private alert = 0;
  herd: Deer[] = [];

  startle(from: THREE.Vector3) {
    for (const d of this.herd) if (d !== this) setTimeout(() => d.bolt(from), rand(150, 500));
    this.bolt(from);
  }

  private bolt(from: THREE.Vector3) {
    super.startle(from);
  }

  protected pose(dt: number) {
    super.pose(dt);
    const t = this.clock;
    // every so often the head comes up sharply, ears forward, listening
    this.alert = damp(this.alert, Math.sin(t * 0.21 + this.seed) > 0.8 ? 1 : 0, 4, dt);
    const neck = this.body.part('neck');
    if (neck) neck.rotation.z += this.alert * this.grazing * 0.95;
    const tail = this.body.part('tail');
    if (tail) tail.rotation.z += this.gait.moving > 1 ? 1.1 : 0; // the white flag when they run
    const { phase, moving } = this.gait;
    const trunk = this.body.part('body');
    if (trunk && moving > 1.2) trunk.position.y += Math.abs(Math.sin(phase * 0.5)) * 0.35; // bounding
  }
}

class Crab extends Walker {
  protected pose(dt: number) {
    const t = this.clock;
    this.body.parts('claw_l', 'claw_r').forEach((c, i) => {
      c.rotation.y += Math.sin(t * 3 + i * 2 + this.seed) * 0.3;
      c.rotation.x += (i ? -1 : 1) * Math.max(0, Math.sin(t * 0.8 + this.seed)) * 0.4;
    });
    const trunk = this.body.part('body');
    if (trunk) trunk.position.y += Math.abs(Math.sin(this.stride * 18)) * 0.02 * this.gait.moving;
  }
}

class Squirrel extends Walker {
  private trees: THREE.Vector3[] = [];
  private climb = 0; // 0 on the ground … 1 up in the crown
  private tree?: THREE.Vector3;

  setTrees(trees: THREE.Vector3[]) {
    this.trees = trees;
  }

  protected next() {
    const tree = this.trees.length ? pick(this.trees) : null;
    if (tree && chance(0.6)) {
      this.tree = tree;
      const foot = tree.clone().add(V(0.35, 0, 0));
      this.state = { kind: 'walk', to: foot, run: true };
    } else super.next();
  }

  startle(_from: THREE.Vector3) {
    const near = this.trees.slice().sort((a, b) => a.distanceTo(this.pos) - b.distanceTo(this.pos))[0];
    if (!near) return;
    this.tree = near;
    this.state = { kind: 'walk', to: near.clone().add(V(0.35, 0, 0)), run: true };
  }

  update(dt: number, e: Env) {
    const s = this.state;
    // at the foot of its tree: up it goes, sits in the crown a while, and comes back down
    if (s.kind === 'walk' && this.tree && Math.hypot(this.pos.x - this.tree.x - 0.35, this.pos.z - this.tree.z) < 0.2) {
      this.state = { kind: 'act', name: 'climb', t: 0, length: rand(6, 12) };
    }
    super.update(dt, e);
    const a = this.state;
    const up = a.kind === 'act' && a.name === 'climb' ? (a.t < 1.2 ? a.t / 1.2 : a.t > a.length - 1.2 ? (a.length - a.t) / 1.2 : 1) : 0;
    this.climb = up;
    if (a.kind === 'act' && a.name === 'climb' && a.t > a.length - 0.05) this.tree = undefined;
    const b = this.body.root;
    b.position.y += up * 2.6;
    if (up > 0.02) {
      b.rotation.set(0, headingOf(-1, 0), up < 1 ? Math.PI / 2 * (a.kind === 'act' && a.t > 1.2 ? -1 : 1) : 0, 'YZX');
      b.visible = up < 0.95; // in among the leaves
    } else if (this.state.kind !== 'away') b.visible = true;
  }

  protected pose(dt: number) {
    super.pose(dt);
    const tail = this.body.part('tail');
    if (tail) tail.rotation.z += Math.sin(this.clock * 4) * 0.12 + (this.gait.moving > 0.2 ? -0.5 : 0);
  }
}

// --- flying ---------------------------------------------------------------------------

/** Gulls wheeling over the shore: long glides, a few flaps, banking into the turn. */
class Gull {
  readonly body: Body;
  private a = rand(0, Math.PI * 2);
  private w = rand(0.12, 0.2) * (chance(0.5) ? 1 : -1);
  private r = rand(6, 11);
  private alt = rand(7, 11);
  private seed = Math.random() * 100;
  private loop = 0;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private centre: THREE.Vector3) {
    this.body = new Body('gull', template, scene);
    this.body.show(centre);
  }

  poke() {
    this.loop = 2;
  }

  update(dt: number, t: number, present: boolean) {
    if (!present) return this.body.shown && this.body.hide(); // roosting somewhere for the night
    if (!this.body.shown) this.body.show(this.centre);
    this.a += this.w * dt * (1 + this.loop * 0.6);
    this.loop = Math.max(0, this.loop - dt);
    const r = this.r + Math.sin(t * 0.05 + this.seed) * 3;
    const p = this.centre.clone().add(V(Math.cos(this.a) * r, this.alt + Math.sin(t * 0.3 + this.seed) * 0.8 + Math.sin(this.loop * Math.PI / 2) * 3, Math.sin(this.a) * r));
    const tangent = V(-Math.sin(this.a), 0, Math.cos(this.a)).multiplyScalar(Math.sign(this.w));
    const b = this.body;
    b.relax();
    b.root.position.copy(p);
    orient(b.root, headingOf(tangent.x, tangent.z), 0, Math.sign(this.w) * 0.4);
    const flapping = Math.sin(t * 0.5 + this.seed) > 0.4 || this.loop > 0;
    wings(b.part('wing_l'), b.part('wing_r'), flapping ? Math.sin(t * 9 + this.seed) * 0.6 : 0.12, 0);
  }
}

/** A few robins hopping about the grass, pecking, and flitting off together when disturbed. */
class Robin {
  readonly body: Body;
  pos = V();
  private from = V();
  private to = V();
  private t = 0;
  private length = 1;
  private flying = false;
  private heading = rand(0, Math.PI * 2);
  private pause = rand(0.3, 1.5);
  private peck = 0;
  private seed = Math.random() * 100;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private spots: THREE.Vector3[], start: THREE.Vector3) {
    this.body = new Body('songbird', template, scene);
    this.pos.copy(start);
  }

  private landOn(p: THREE.Vector3) {
    const h = this.ground.at(p.x, p.z);
    return p.setY(Number.isNaN(h) ? 0 : h);
  }

  /** Off to somewhere else: another spot, or `to`. */
  fly(to?: THREE.Vector3) {
    this.from.copy(this.pos);
    this.to.copy(to ?? pick(this.spots).clone().add(V(rand(-2, 2), 0, rand(-2, 2))));
    this.landOn(this.to);
    this.length = Math.max(0.8, this.from.distanceTo(this.to) / 6);
    this.t = 0;
    this.flying = true;
  }

  update(dt: number, present: boolean) {
    const b = this.body;
    if (!present) {
      if (b.shown) b.hide();
      return;
    }
    if (!b.shown) {
      b.show(this.landOn(this.pos));
      this.fly();
    }
    this.pause -= dt;
    let lift = 0;
    let flap = 0;
    if (this.flying) {
      this.t += dt / this.length;
      const k = Math.min(1, this.t);
      this.pos.lerpVectors(this.from, this.to, k);
      lift = Math.sin(k * Math.PI) * Math.min(3, this.length * 2);
      this.heading = headingOf(this.to.x - this.from.x, this.to.z - this.from.z);
      flap = Math.sin(this.t * 90) * 0.9;
      if (k >= 1) {
        this.flying = false;
        this.pause = rand(0.4, 1.5);
      }
    } else if (this.pause < 0) {
      // a little hop, or a peck, or a longer flight
      if (chance(0.06)) this.fly();
      else if (chance(0.5)) {
        this.heading += rand(-1.2, 1.2);
        this.from.copy(this.pos);
        this.to.copy(this.pos).add(V(Math.cos(this.heading) * 0.3, 0, -Math.sin(this.heading) * 0.3));
        this.landOn(this.to);
        this.t = 0;
        this.length = 0.18;
        this.flying = true;
      } else this.peck = 0.35;
      this.pause = rand(0.3, 1.2);
    }
    this.peck = Math.max(0, this.peck - dt);
    b.relax();
    b.root.position.copy(this.pos).setY(this.pos.y + lift + (this.flying && this.length < 0.3 ? Math.sin(Math.min(1, this.t) * Math.PI) * 0.12 : 0));
    orient(b.root, this.heading, this.flying && this.length > 0.3 ? 0.15 : 0);
    const big = this.flying && this.length > 0.3;
    wings(b.part('wing_l'), b.part('wing_r'), big ? flap : 0, big ? 0 : 1);
    const head = b.part('head');
    if (head) {
      head.rotation.z -= Math.sin((this.peck / 0.35) * Math.PI) * 0.9;
      head.rotation.y += Math.sin(this.pause * 7 + this.seed) * 0.3;
    }
  }
}

/** The owl: after dark, on top of a tree, turning its head, blinking now and then. */
class Owl {
  readonly body: Body;
  private swivel = 0;
  private clock = 0;
  private blink = 0;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private perch: THREE.Vector3) {
    this.body = new Body('owl', template, scene);
  }

  poke() {
    this.swivel = 2.4;
  }

  update(dt: number, present: boolean) {
    const b = this.body;
    if (!present) {
      if (b.shown) b.hide();
      return;
    }
    if (!b.shown) b.show(this.perch);
    this.clock += dt;
    const t = this.clock;
    b.relax();
    b.root.position.copy(this.perch);
    orient(b.root, -Math.PI / 2); // facing the camera (south)
    wings(b.part('wing_l'), b.part('wing_r'), 0, 1);
    const head = b.part('head');
    this.swivel = Math.max(0, this.swivel - dt);
    if (head) {
      // long stares one way, then a quick turn to another
      const look = Math.round(Math.sin(t * 0.23) * 1.5 + Math.sin(t * 0.61)) * 0.5;
      head.rotation.y += look + Math.sin((this.swivel / 2.4) * Math.PI) * 2.6;
      head.rotation.x += Math.sin(t * 0.4) * 0.1;
    }
    this.blink = (t % 4.3) < 0.15 ? 1 : 0;
    const lids = b.part('lids');
    if (lids) lids.scale.setScalar(this.blink ? 1 : 0.01);
  }
}

/** Bats at dusk: jinking about the trees, never flying straight for long. */
class Bat {
  readonly body: Body;
  private seed = Math.random() * 100;
  private clock = 0;
  private last = V();

  constructor(template: THREE.Object3D, scene: THREE.Scene, private centre: THREE.Vector3) {
    this.body = new Body('bat', template, scene);
  }

  update(dt: number, present: boolean) {
    const b = this.body;
    if (!present) {
      if (b.shown) b.hide();
      return;
    }
    this.clock += dt;
    const t = this.clock + this.seed;
    const p = this.centre.clone().add(V(
      Math.sin(t * 0.9) * 5 + Math.sin(t * 2.7) * 1.5,
      3 + Math.sin(t * 1.9) * 1 + Math.sin(t * 5.3) * 0.3,
      Math.cos(t * 0.7) * 4 + Math.sin(t * 3.1) * 1.4,
    ));
    if (!b.shown) b.show(p);
    const v = p.clone().sub(this.last);
    this.last.copy(p);
    b.relax();
    b.root.position.copy(p);
    orient(b.root, headingOf(v.x, v.z), 0, Math.sin(t * 3) * 0.5);
    wings(b.part('wing_l'), b.part('wing_r'), Math.sin(t * 24) * 0.9, 0);
  }
}

/** A skein of geese in a V, passing high over the island: south in autumn, north in spring. */
class Skein {
  private birds: Body[] = [];
  private t = -1;
  private from = V();
  private dir = V();
  private next = LUCK.geeseSoon ? 5 : rand(60, 180);
  onHonk?: () => void;
  honked = false;

  constructor(template: THREE.Object3D, scene: THREE.Scene, count = 9) {
    for (let i = 0; i < count; i++) this.birds.push(new Body('goose', template, scene));
  }

  get bodies() {
    return this.birds;
  }

  get south() {
    return this.dir.z > 0;
  }

  update(dt: number, e: Env, clock: number) {
    const season = e.season === 'autumn' || e.season === 'spring' || LUCK.geeseSoon;
    if (this.t < 0) {
      this.next -= dt;
      if (this.next > 0 || !season || e.night > 0.8) return;
      this.t = 0;
      this.honked = false;
      // autumn: from the north-east, off to the south-west; spring: back again
      const southward = e.season !== 'spring';
      this.from.copy(southward ? V(60, 17, -55) : V(-60, 17, 55));
      this.dir.copy(southward ? V(-1, 0, 1.05) : V(1, 0, -1.05)).normalize();
      this.birds.forEach((g) => g.show(this.from));
    }
    this.t += dt;
    const lead = this.from.clone().addScaledVector(this.dir, this.t * 7);
    const side = V(-this.dir.z, 0, this.dir.x);
    this.birds.forEach((g, i) => {
      const rank = Math.ceil(i / 2);
      const s = i === 0 ? 0 : i % 2 ? 1 : -1;
      g.relax();
      g.root.position.copy(lead).addScaledVector(this.dir, -rank * 1.6).addScaledVector(side, s * rank * 1.4);
      g.root.position.y += Math.sin(clock * 0.8 + i) * 0.25;
      orient(g.root, headingOf(this.dir.x, this.dir.z));
      wings(g.part('wing_l'), g.part('wing_r'), Math.sin(clock * 5 + i * 0.7) * 0.5, 0);
    });
    if (!this.honked && this.t > 7) {
      this.honked = true;
      this.onHonk?.();
    }
    if (this.t > 22) {
      this.birds.forEach((g) => g.hide());
      this.t = -1;
      this.next = rand(150, 400);
    }
  }
}

// --- in and on the water -----------------------------------------------------------------

/** A splash: a ring of white and pale-blue pixels thrown up and falling back. */
function splash(p: Particles, at: THREE.Vector3, size = 1) {
  for (let i = 0; i < 10 * size; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(0.6, 1.6) * Math.sqrt(size);
    p.emit({ position: at.clone().setY(0.05), velocity: V(Math.cos(a) * s, rand(1.5, 3.5) * Math.sqrt(size), Math.sin(a) * s), color: pick(['#ffffff', '#e2f2fa', '#bfe3f0']), life: rand(0.5, 0.9), gravity: -9, size: size > 2 ? 2 : 1 });
  }
}

/** Now and then a fish jumps clear of the water. */
class Leaper {
  readonly body: Body;
  private t = -1;
  private wait = rand(2, 6);
  private from = V();
  private dir = 0;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private seaSpot: () => THREE.Vector3 | null, private particles: Particles) {
    this.body = new Body('fish', template, scene);
  }

  update(dt: number) {
    const b = this.body;
    if (this.t < 0) {
      this.wait -= dt;
      if (this.wait > 0) return;
      const at = this.seaSpot();
      if (!at) return;
      this.from.copy(at);
      this.dir = rand(0, Math.PI * 2);
      this.t = 0;
      b.show(at);
      splash(this.particles, at, 0.6);
    }
    this.t += dt / 0.85;
    const k = Math.min(1, this.t);
    const along = V(Math.cos(this.dir), 0, -Math.sin(this.dir));
    b.relax();
    b.root.position.copy(this.from).addScaledVector(along, k * 1.6).setY(Math.sin(k * Math.PI) * 1.1 - 0.1);
    orient(b.root, this.dir, Math.cos(k * Math.PI) * 1.1);
    const tail = b.part('tail');
    if (tail) tail.rotation.y += Math.sin(this.t * 40) * 0.5;
    if (k >= 1) {
      splash(this.particles, b.root.position, 0.8);
      b.hide();
      this.t = -1;
      this.wait = rand(2.5, 8);
    }
  }
}

/** A pod of dolphins passing along the south of the island, arcing in and out of the water. */
class Pod {
  private members: { body: Body; lag: number; lane: number; phase: number; up: boolean }[] = [];
  private t = -1;
  private wait = LUCK.dolphinsSoon ? 3 : rand(50, 200);
  private from = V();
  private dir = 1;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private particles: Particles) {
    for (let i = 0; i < 4; i++) this.members.push({ body: new Body('dolphin', template, scene), lag: i * 2.2 + rand(0, 1), lane: rand(-2.5, 2.5), phase: rand(0, Math.PI * 2), up: false });
  }

  get bodies() {
    return this.members.map((m) => m.body);
  }

  update(dt: number, e: Env) {
    if (this.t < 0) {
      this.wait -= dt;
      if (this.wait > 0 || (e.night > 0.6 && !LUCK.dolphinsSoon)) return;
      this.t = 0;
      this.dir = chance(0.5) ? 1 : -1;
      this.from.set(-60 * this.dir, 0, rand(32, 35)); // clear of the end of the dock
    }
    this.t += dt;
    for (const m of this.members) {
      const x = this.from.x + this.dir * (this.t - m.lag) * 5.5;
      const cycle = (this.t * 0.45 + m.phase / (Math.PI * 2)) % 1;
      // out of the water for the first third of each cycle
      const k = cycle / 0.34;
      const y = cycle < 0.34 ? Math.sin(k * Math.PI) * 1.2 - 0.3 : -2;
      const b = m.body;
      const out = cycle < 0.34 && Math.abs(x) < 60;
      if (out && !m.up) splash(this.particles, V(x, 0, this.from.z + m.lane), 1);
      if (!out && m.up && Math.abs(x) < 60) splash(this.particles, V(x + this.dir * 1.5, 0, this.from.z + m.lane), 0.7);
      m.up = out;
      if (!out) {
        if (b.shown) b.hide();
        continue;
      }
      if (!b.shown) b.show(V(x, y, this.from.z + m.lane));
      b.relax();
      b.root.position.set(x, y, this.from.z + m.lane);
      orient(b.root, this.dir > 0 ? 0 : Math.PI, Math.cos(k * Math.PI) * 0.7);
      const tail = b.part('tail');
      if (tail) tail.rotation.z += Math.sin(this.t * 8) * 0.3;
    }
    if (this.t > 150 / 5.5 + 12) {
      this.t = -1;
      this.wait = rand(150, 420);
      this.members.forEach((m) => m.body.hide());
    }
  }
}

/**
 * The whale, rarely: it surfaces offshore, blows, rolls along the surface and blows again,
 * then arches its back and dives, lifting its flukes. Once in a while it breaches instead.
 */
class Whale {
  readonly body: Body;
  private t = -1;
  private wait = LUCK.whaleSoon ? 3 : rand(120, 420);
  private at = V();
  private heading = 0;
  private breach = false;
  private blown = 0;
  onBlow?: (at: THREE.Vector3) => void;
  onSplash?: () => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private spots: THREE.Vector3[], private particles: Particles) {
    this.body = new Body('whale', template, scene);
  }

  get surfacing() {
    return this.t >= 0;
  }

  update(dt: number) {
    const b = this.body;
    if (this.t < 0) {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.t = 0;
      this.blown = 0;
      this.at.copy(pick(this.spots));
      // swimming along the coast, not away from it
      this.heading = headingOf(-this.at.z, this.at.x) + (chance(0.5) ? Math.PI : 0) + rand(-0.3, 0.3);
      this.breach = chance(0.3);
      b.show(this.at);
    }
    this.t += dt;
    const t = this.t;
    const fwd = V(Math.cos(this.heading), 0, -Math.sin(this.heading));
    let y = -0.5;
    let pitch = 0;
    let roll = Math.sin(t * 0.4) * 0.05;
    let fluke = 0;
    if (t < 3) y = -3.5 + (t / 3) * 3;
    const blowAt = [3, 9];
    if (this.blown < blowAt.length && t > blowAt[this.blown]) {
      this.blown++;
      this.blow();
    }
    if (this.breach && t > 11 && t < 16) {
      // up out of the sea, twisting, and down on its side with an almighty splash
      const k = (t - 11) / 5;
      y = -3 + Math.sin(Math.min(1, k * 1.25) * Math.PI) * 7 * (k < 0.8 ? 1 : 1);
      pitch = 1.3 - k * 1.6;
      roll = k * 1.6;
      if (k > 0.72 && k - dt / 5 <= 0.72) {
        splash(this.particles, this.body.root.position.clone(), 6);
        this.onSplash?.();
      }
    } else if (t > 11) {
      // the dive: back arching over, then the flukes lifted clear
      const k = Math.min(1, (t - 11) / 5);
      pitch = -k * 0.9;
      y = -0.5 - k * 1.4;
      fluke = Math.sin(k * Math.PI) * 1.1;
    }
    const moveK = this.breach && t > 11 ? 0.3 : 1;
    b.relax();
    b.root.position.copy(this.at).addScaledVector(fwd, t * 1.1 * moveK).setY(y);
    orient(b.root, this.heading, pitch, roll);
    const tail = b.part('tail');
    if (tail) tail.rotation.z -= fluke + Math.sin(t * 0.8) * 0.08; // negative lifts it (the tail points along -x)
    if (t > 17.5) {
      b.hide();
      this.t = -1;
      this.wait = rand(300, 600);
    }
  }

  private blow() {
    const head = this.body.root.position.clone().add(V(Math.cos(this.heading) * 2.4, 0.3, -Math.sin(this.heading) * 2.4));
    for (let i = 0; i < 45; i++) {
      this.particles.emit({ position: head.clone().add(V(rand(-0.2, 0.2), 0, rand(-0.2, 0.2))), velocity: V(rand(-0.5, 0.5), rand(4, 7.5), rand(-0.5, 0.5)), color: pick(['#ffffff', '#eef6fa', '#d8e8f0']), life: rand(1, 1.8), gravity: -4.5, wobble: 0.4, size: chance(0.4) ? 2 : 1 });
    }
    this.onBlow?.(head);
  }
}

const SERPENT_SEGS = 16; // as tools/models/fauna.py builds it
const SERPENT_STEP = 1.3;

/**
 * The sea serpent. Hardly ever in fair weather, now and then in the rain, and in a thunderstorm
 * every few minutes: its humps roll through the waves offshore, then it rears up out of the sea,
 * turns to look at the island and roars, and dives back under, its tail last, with a slap.
 *
 * The model is a head and a string of segments; the spine is a curve worked out every frame
 * (in the serpent's own frame: x ahead, y up): a neck from the head down to where it meets the
 * water, then humps travelling back along the body. The segments are strung along it evenly.
 */
class Serpent {
  readonly body: Body;
  private t = -1;
  private wait = LUCK.serpentSoon ? 3 : 60; // never in the first minute
  private heading = 0;
  private hx = 0; // how far the head has come
  private look = 0; // the head turned towards the island
  private toIsland = 0;
  private cues = new Set<string>();
  private segs: THREE.Object3D[];
  private curve: THREE.Vector2[] = [];
  private lengths: number[] = [];
  onCall?: (call: Call, at: THREE.Vector3) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private deep: (x: number, z: number) => boolean, private particles: Particles) {
    this.body = new Body('serpent', template, scene);
    this.segs = Array.from({ length: SERPENT_SEGS }, (_, i) => this.body.part(`seg_${String(i).padStart(2, '0')}`)!);
  }

  /** Clicked: if it's only swimming, it rears up at you. */
  poke() {
    if (this.t > 4 && this.t < 11) this.t = 11;
  }

  update(dt: number, e: Env) {
    if (this.t < 0) {
      this.wait -= dt;
      if (this.wait > 0) return;
      // chances per second: once in an hour and a half when it's fine, every twenty minutes of
      // rain, every six of a thunderstorm (and they add up)
      const rate = 1 / 5400 + e.wet / 1200 + e.storm / 360;
      if (!LUCK.serpentSoon && !chance(rate * dt)) return;
      if (!this.start()) {
        this.wait = 20;
        return;
      }
    }
    this.t += dt;
    this.swim(dt);
    if (this.t > 30) {
      this.body.hide();
      this.t = -1;
      this.wait = LUCK.serpentSoon ? 60 : rand(600, 900);
    }
  }

  /** Somewhere offshore, in deep water the whole length of its swim, mostly off the south shore. */
  private start() {
    for (let i = 0; i < 30; i++) {
      const a = chance(0.7) ? rand(0.15, 0.85) * Math.PI : rand(0, Math.PI * 2);
      const at = V(Math.cos(a) * rand(40, 48), 0, Math.sin(a) * rand(31, 37));
      const heading = headingOf(-at.z, at.x) + (chance(0.5) ? Math.PI : 0) + rand(-0.2, 0.2);
      const fwd = V(Math.cos(heading), 0, -Math.sin(heading));
      // deep water all along its swim, and well to either side: its head turns and its body sways
      let ok = true;
      for (let d = -48; d <= 36 && ok; d += 3) {
        for (const side of [-10, 0, 10]) ok &&= this.deep(at.x + fwd.x * d + fwd.z * side, at.z + fwd.z * d - fwd.x * side);
      }
      if (!ok) continue;
      this.heading = heading;
      this.hx = 0;
      this.t = 0;
      this.cues.clear();
      // which way it will turn its head to face the island (round to the nearer side)
      const home = headingOf(-at.x, -at.z);
      this.toIsland = clamp(Math.atan2(Math.sin(home - heading), Math.cos(home - heading)), -1.3, 1.3);
      this.body.show(at);
      orient(this.body.root, heading);
      return true;
    }
    return false;
  }

  /** True the first time it's asked about a moment in this appearance. */
  private once(cue: string) {
    if (this.cues.has(cue)) return false;
    this.cues.add(cue);
    return true;
  }

  private swim(dt: number) {
    const t = this.t;
    const b = this.body;
    const ss = THREE.MathUtils.smoothstep;
    const rise = ss(t, 0, 4); // up from the deep
    const rear = ss(t, 11, 14) * (1 - ss(t, 19, 21.5)); // neck up out of the sea
    const dive = Math.max(0, t - 19); // seconds since it went back under
    const roar = ss(t, 15, 15.4) * (1 - ss(t, 17.8, 18.6));
    const speed = t < 11 ? 1.1 : t < 19 ? 1.1 * (1 - ss(t, 11, 13)) : 2.2;
    this.hx += speed * dt;

    // the head: bobbing along above the waves, then high, then down into the sea
    const sink = (1 - rise) * 4;
    const plunge = ss(dive, 0, 2.5);
    const hy = (1.2 + Math.sin(t * 1.3) * 0.25) * (1 - rear) + 7.5 * rear - sink - plunge * 5;
    const head = new THREE.Vector2(this.hx + plunge * 3, hy);
    const joint = new THREE.Vector2(this.hx - 2.8 + rear * 0.9, -0.4 - sink);

    // the neck, a curve from the water up to the head…
    const lift = head.y - joint.y;
    const p1 = joint.clone().add(new THREE.Vector2(0.9, lift * 0.45));
    const p2 = head.clone().sub(new THREE.Vector2(1.1 - rear * 0.5, lift * 0.2 - plunge * 1.5));
    this.curve.length = 0;
    const bez = new THREE.CubicBezierCurve(joint, p1, p2, head);
    for (let i = 16; i >= 0; i--) this.curve.push(bez.getPoint(i / 16));
    // …then the body, humps rolling back along it, sinking front first once it dives
    for (let u = 0.5; u <= 40; u += 0.5) {
      const humps = -0.9 + 1.5 * Math.sin(u * 0.95 - t * 1.6) * ss(u, 0, 3);
      const under = sink + ss(dive * 5 - u, 0, 4) * 6 + Math.max(0, u - 17) * 0.35;
      this.curve.push(new THREE.Vector2(joint.x - u, THREE.MathUtils.lerp(joint.y, humps - under, ss(u, 0, 2))));
    }
    this.lengths.length = 0;
    let run = 0;
    this.curve.forEach((p, i) => this.lengths.push((run += i ? p.distanceTo(this.curve[i - 1]) : 0)));

    b.relax();
    const h = b.part('head');
    if (h) {
      h.position.set(head.x, head.y, 0);
      this.look = damp(this.look, rear > 0.5 && dive < 1 ? this.toIsland : Math.sin(t * 0.5) * 0.3, 1.5, dt);
      const shake = roar * Math.sin(t * 18) * 0.06;
      const pitch = 0.1 + Math.sin(t * 1.3 + 1) * 0.08 - rear * 0.45 + roar * 0.7 - plunge * 1.3;
      h.rotation.set(shake, this.look, pitch, 'YZX');
    }
    const jaw = b.part('jaw');
    if (jaw) jaw.rotation.z -= roar * (0.75 + Math.sin(t * 9) * 0.08) + (rear > 0.5 ? 0 : Math.max(0, Math.sin(t * 0.7)) * 0.15);
    const at = new THREE.Vector2();
    const ahead = new THREE.Vector2();
    this.segs.forEach((seg, i) => {
      const d = (i + 0.8) * SERPENT_STEP;
      this.along(d, at);
      this.along(d - 0.4, ahead);
      const sway = Math.sin(d * 0.35 - t * 1.2) * 0.4 * (1 - rear * 0.6);
      seg.position.set(at.x, at.y, sway);
      seg.rotation.set(0, 0, Math.atan2(ahead.y - at.y, ahead.x - at.x), 'YZX');
    });
    const tail = b.part('tail');
    if (tail) {
      // it goes under last, lifting its fin clear of the water and slapping it down
      const k = clamp((dive - 5) / 2, 0, 1);
      const flick = Math.sin(k * Math.PI);
      this.along((SERPENT_SEGS + 0.6) * SERPENT_STEP, at);
      tail.position.set(at.x, at.y * (1 - flick) - flick * 0.3, 0);
      tail.rotation.set(0, 0, -flick * 1.2, 'YZX');
      if (k >= 1 && this.once('slap')) this.splashAt(tail, 3.5, true);
    }

    // the sea around it: a splash as it comes up, water streaming off its neck, a wake where
    // the humps cut the surface, and a great splash as it dives
    if (h) {
      if (t > 2.2 && this.once('surface')) this.splashAt(h, 2.5, true);
      if (rear > 0.2 && rear < 0.95 && dive === 0 && chance(dt * 30)) this.drip(h);
      if (t > 15 && this.once('roar')) this.onCall?.('roar', h.getWorldPosition(V()));
      if (dive > 0 && head.y < 0.3 && this.once('dive')) this.splashAt(h, 6, true);
    }
    if (chance(dt * 12)) this.wake();
  }

  /** The point `d` along the spine from the head (and so where each segment goes). */
  private along(d: number, out: THREE.Vector2) {
    const L = this.lengths;
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const k = clamp((d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]), 0, 1);
    return out.lerpVectors(this.curve[i - 1], this.curve[i], k);
  }

  private splashAt(part: THREE.Object3D, size: number, loud: boolean) {
    const at = part.getWorldPosition(V()).setY(0);
    splash(this.particles, at, size);
    if (loud) this.onCall?.('splash', at);
  }

  /** Sea water pouring off the head and neck as it rears. */
  private drip(head: THREE.Object3D) {
    const at = head.getWorldPosition(V()).add(V(rand(-1, 1), rand(-3, 0), rand(-1, 1)));
    this.particles.emit({ position: at, velocity: V(rand(-0.3, 0.3), rand(-1, 0), rand(-0.3, 0.3)), color: pick(['#e2f2fa', '#bfe3f0', '#ffffff']), life: rand(0.6, 1.2), gravity: -9 });
  }

  /** White water where a hump breaks the surface. */
  private wake() {
    const c = this.curve;
    const crossings = c.filter((p, i) => i > 0 && p.y > -0.2 !== c[i - 1].y > -0.2);
    if (!crossings.length) return;
    const p = pick(crossings);
    const local = V(p.x, 0.05, rand(-0.6, 0.6));
    const at = this.body.root.localToWorld(local).setY(0.05);
    this.particles.emit({ position: at, velocity: V(rand(-0.4, 0.4), rand(0.6, 1.4), rand(-0.4, 0.4)), color: pick(['#ffffff', '#e2f2fa']), life: rand(0.4, 0.8), gravity: -6, size: chance(0.3) ? 2 : 1 });
  }
}

/** A mallard paddling round the bay, with a line of ducklings in spring and early summer. */
class Ducks {
  private drake: Body;
  private young: Body[] = [];
  private trail: THREE.Vector3[] = [];
  private a = rand(0, Math.PI * 2);
  private hurry = 0;
  private upend = 0;
  private clock = 0;

  constructor(duck: THREE.Object3D, duckling: THREE.Object3D, scene: THREE.Scene, private centre: THREE.Vector3) {
    this.drake = new Body('duck', duck, scene);
    for (let i = 0; i < 5; i++) this.young.push(new Body('duckling', duckling, scene));
  }

  get bodies() {
    return [this.drake, ...this.young];
  }

  poke() {
    this.hurry = 4;
  }

  update(dt: number, e: Env) {
    const present = e.night < 0.6;
    const babies = present && (e.season === 'spring' || e.season === 'summer');
    if (!present) {
      this.bodies.forEach((b) => b.shown && b.hide());
      return;
    }
    this.clock += dt;
    this.hurry = Math.max(0, this.hurry - dt);
    this.a += dt * (0.09 + this.hurry * 0.06);
    const p = this.centre.clone().add(V(Math.cos(this.a) * 5 + Math.sin(this.a * 2.3) * 1.2, 0, Math.sin(this.a) * 2.6));
    const ahead = this.centre.clone().add(V(Math.cos(this.a + 0.05) * 5 + Math.sin((this.a + 0.05) * 2.3) * 1.2, 0, Math.sin(this.a + 0.05) * 2.6));
    this.trail.unshift(p.clone());
    if (this.trail.length > 400) this.trail.pop();
    // now and then the drake tips up, tail in the air, to feed
    if (this.upend <= 0 && chance(dt * 0.05) && !this.hurry) this.upend = 2.5;
    this.upend = Math.max(0, this.upend - dt);
    const tip = Math.sin(Math.min(1, (2.5 - this.upend) / 2.5) * Math.PI) * (this.upend > 0 ? 1 : 0);
    const d = this.drake;
    if (!d.shown) d.show(p);
    d.relax();
    d.root.position.copy(p).setY(Math.sin(this.clock * 2) * 0.02 - tip * 0.12);
    orient(d.root, headingOf(ahead.x - p.x, ahead.z - p.z), -tip * 1.25);
    // the ducklings follow in a line, a little behind one another
    this.young.forEach((b, i) => {
      if (!babies) return b.shown && b.hide();
      const k = Math.min(this.trail.length - 1, Math.round((i + 1) * (18 - this.hurry * 2)));
      const q = this.trail[k];
      const r = this.trail[Math.max(0, k - 3)];
      if (!b.shown) b.show(q);
      b.relax();
      b.root.position.copy(q).setY(Math.sin(this.clock * 3 + i) * 0.015);
      orient(b.root, headingOf(r.x - q.x, r.z - q.z));
      const head = b.part('head');
      if (head) head.rotation.y += Math.sin(this.clock * 2 + i * 1.7) * 0.4;
    });
  }
}

/** The heron, standing in the shallows by the cove. Clicked, it lifts off and flaps away, and comes back later. */
class Heron {
  readonly body: Body;
  private t = 0;
  private flight = -1; // seconds into a flight away and back; -1 standing
  private clock = 0;
  private strike = 0;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private spot: THREE.Vector3, private particles: Particles) {
    this.body = new Body('heron', template, scene);
  }

  poke() {
    if (this.flight < 0) this.flight = 0;
  }

  update(dt: number, e: Env) {
    const b = this.body;
    const present = e.night < 0.5;
    if (!present && this.flight < 0) {
      if (b.shown) b.hide();
      return;
    }
    if (!b.shown) b.show(this.spot);
    this.clock += dt;
    const t = this.clock;
    b.relax();
    const heading = headingOf(this.spot.x, this.spot.z); // looking out to sea, away from the island
    let pos = this.spot.clone().setY(-0.28);
    let fly = 0;
    if (this.flight >= 0) {
      this.flight += dt;
      const out = 14; // seconds out; it stays away a while, then lands again
      const away = 70;
      const f = this.flight;
      const k = f < out ? f / out : f < away ? 1 : Math.max(0, 1 - (f - away) / out);
      const dir = V(Math.cos(heading), 0, -Math.sin(heading));
      pos = this.spot.clone().addScaledVector(dir, k * k * 70).setY(-0.28 + Math.min(1, k * 6) * (3 + k * 8));
      fly = Math.min(1, k * 8);
      b.root.visible = k < 0.98;
      if (f > away + out) this.flight = -1;
      orient(b.root, f < away ? heading : heading + Math.PI, -0.1 * fly);
      if (f >= away) {
        b.root.position.copy(pos);
      }
    } else {
      orient(b.root, heading);
      // every so often: freeze, lean, and stab at a fish
      if (this.strike <= 0 && chance(dt * 0.06)) this.strike = 1.2;
    }
    b.root.position.copy(pos);
    this.strike = Math.max(0, this.strike - dt);
    const neck = b.part('neck');
    const s = this.strike > 0 ? Math.sin(((1.2 - this.strike) / 1.2) * Math.PI) : 0;
    if (neck) {
      neck.rotation.z -= s * 1.1 + fly * 0.6;
      neck.rotation.y += Math.sin(t * 0.2) * 0.2 * (1 - fly);
    }
    if (this.strike > 0 && this.strike - dt <= 0.6 && this.strike > 0.6 - dt * 2) splash(this.particles, pos.clone().add(V(Math.cos(heading) * 0.8, 0, -Math.sin(heading) * 0.8)), 0.4);
    wings(b.part('wing_l'), b.part('wing_r'), fly ? Math.sin(t * 5) * 0.8 : 0, 1 - fly);
    // legs trail straight out behind the tail in flight, like a real heron's
    b.parts('leg_l', 'leg_r').forEach((l) => (l.rotation.z -= fly * 1.5));
    const trunk = b.part('body');
    if (trunk && !fly) trunk.position.y -= 0.02;
  }
}

/**
 * Someone small, masked and cloaked in red, who very occasionally comes ashore at the dock,
 * walks up to the campfire to listen for a while, and goes again.
 */
class Wanderer {
  readonly body: Body;
  private route: THREE.Vector3[];
  private t = 0;
  private leg = 0;
  private phase: 'waiting' | 'in' | 'sit' | 'out' | 'gone' = 'waiting';
  private wait = rand(20, 90);
  private pos = V();
  private heading = Math.PI / 2;
  private clock = 0;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, route: THREE.Vector3[], private particles: Particles) {
    this.body = new Body('wanderer', template, scene);
    this.route = route;
  }

  /** Clicked: a quick dash forward, leaving a streak of silk behind. */
  dash() {
    if (this.phase === 'waiting' || this.phase === 'gone') return;
    for (let i = 0; i < 12; i++) {
      this.particles.emit({ position: this.pos.clone().add(V(rand(-0.2, 0.2), rand(0.1, 0.5), rand(-0.2, 0.2))), velocity: V(rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3)), color: pick(['#fff6e0', '#f4f0e8', '#b8303a']), life: 0.8 });
    }
    if (this.phase === 'sit') this.phase = 'out';
    this.t += 2; // a few metres further along in the blink of an eye
  }

  update(dt: number, enabled: boolean) {
    const b = this.body;
    this.clock += dt;
    if (this.phase === 'waiting') {
      if (!enabled || (this.wait -= dt) > 0) return;
      this.phase = 'in';
      this.leg = 0;
      this.t = 0;
      this.pos.copy(this.route[0]);
      b.show(this.pos);
    }
    if (this.phase === 'gone') return;
    const walk = this.phase === 'in' || this.phase === 'out';
    if (walk) {
      const path = this.phase === 'in' ? this.route : [...this.route].reverse();
      this.t += dt * 1.1;
      // walk the polyline by distance
      let d = this.t;
      let i = 0;
      while (i < path.length - 1 && d > path[i].distanceTo(path[i + 1])) {
        d -= path[i].distanceTo(path[i + 1]);
        i++;
      }
      if (i >= path.length - 1) {
        if (this.phase === 'in') {
          this.phase = 'sit';
          this.t = 0;
          this.wait = rand(60, 120);
        } else {
          this.phase = 'gone';
          b.hide();
          return;
        }
      } else {
        const a = path[i];
        const c = path[i + 1];
        this.pos.lerpVectors(a, c, d / a.distanceTo(c));
        this.heading = turnTo(this.heading, headingOf(c.x - a.x, c.z - a.z), 6, dt);
      }
    } else if (this.phase === 'sit' && (this.wait -= dt) < 0) {
      this.phase = 'out';
      this.t = 0;
    }
    const h = this.ground.at(this.pos.x, this.pos.z);
    b.relax();
    const onDock = this.pos.z > 16.8 && Math.abs(this.pos.x) < 1.2;
    b.root.position.copy(this.pos).setY(onDock || Number.isNaN(h) ? Math.max(DECK, h || 0) : h);
    orient(b.root, this.phase === 'sit' ? headingOf(0.35, -1) : this.heading); // facing the fire and Vincent
    const trunk = b.part('body');
    const head = b.part('head');
    if (walk && trunk) {
      trunk.position.y += Math.abs(Math.sin(this.clock * 9)) * 0.03;
      trunk.rotation.x += Math.sin(this.clock * 9) * 0.06;
    }
    if (this.phase === 'sit' && head) head.rotation.z += Math.sin(this.clock * 2.2) * 0.08; // nodding along
  }
}

/**
 * Gandalf the Grey. Very rarely he comes up from the dock, staff tapping, to stand by the fire and
 * blow smoke rings for a while. He is never late, nor is he early: he steps onto the dock exactly
 * on the minute, by the visitor's own clock. Clicked, he sends a firework up from his staff.
 */
class Gandalf {
  readonly body: Body;
  private route: THREE.Vector3[];
  private t = 0;
  private phase: 'waiting' | 'in' | 'stand' | 'out' | 'gone' = 'waiting';
  private wait = LUCK.gandalfSoon ? 0 : rand(40, 160);
  private pos = V();
  private heading = Math.PI / 2;
  private clock = 0;
  private puff = 3;
  private rocket = -1; // seconds since a firework went up, or -1
  private due = 0;
  onCall?: (call: Call, at: THREE.Vector3) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, route: THREE.Vector3[], private particles: Particles) {
    this.body = new Body('gandalf', template, scene);
    this.route = route;
  }

  /** Clicked: a firework whistles up from the end of his staff. */
  firework() {
    if (this.phase === 'waiting' || this.phase === 'gone' || this.rocket >= 0) return;
    this.rocket = 0;
    this.onCall?.('firework', this.pos);
  }

  private get pipe() {
    const h = this.phase === 'stand' ? headingOf(3.4, -2.4) : this.heading;
    return this.body.root.position.clone().add(V(Math.cos(h) * 0.52, 1.6, -Math.sin(h) * 0.52));
  }

  update(dt: number, enabled: boolean) {
    const b = this.body;
    this.clock += dt;
    if (this.phase === 'waiting') {
      if (!enabled || (this.wait -= dt) > 0) return;
      this.due ||= Math.ceil(Date.now() / 60000) * 60000; // precisely when he means to: on the minute
      if (Date.now() < this.due) return;
      this.phase = 'in';
      this.t = 0;
      this.pos.copy(this.route[0]);
      b.show(this.pos);
    }
    if (this.phase === 'gone') return;
    const walk = this.phase === 'in' || this.phase === 'out';
    if (walk) {
      const path = this.phase === 'in' ? this.route : [...this.route].reverse();
      this.t += dt * 0.9;
      let d = this.t;
      let i = 0;
      while (i < path.length - 1 && d > path[i].distanceTo(path[i + 1])) {
        d -= path[i].distanceTo(path[i + 1]);
        i++;
      }
      if (i >= path.length - 1) {
        if (this.phase === 'in') {
          this.phase = 'stand';
          this.wait = rand(100, 180);
        } else {
          this.phase = 'gone';
          b.hide();
          return;
        }
      } else {
        const a = path[i];
        const c = path[i + 1];
        this.pos.lerpVectors(a, c, d / a.distanceTo(c));
        this.heading = turnTo(this.heading, headingOf(c.x - a.x, c.z - a.z), 4, dt);
      }
    } else if (this.phase === 'stand' && (this.wait -= dt) < 0 && this.rocket < 0) {
      this.phase = 'out';
      this.t = 0;
    }
    const h = this.ground.at(this.pos.x, this.pos.z);
    b.relax();
    const onDock = this.pos.z > 16.8 && Math.abs(this.pos.x) < 1.2;
    b.root.position.copy(this.pos).setY(onDock || Number.isNaN(h) ? Math.max(DECK, h || 0) : h);
    orient(b.root, this.phase === 'stand' ? headingOf(3.4, -2.4) : this.heading); // facing the fire
    const trunk = b.part('body');
    const head = b.part('head');
    const staff = b.part('staff');
    if (walk) {
      // an old man's unhurried stride, planting the staff every other step
      if (trunk) trunk.position.y += Math.abs(Math.sin(this.clock * 5)) * 0.03;
      if (staff) staff.rotation.z += Math.sin(this.clock * 2.5) * 0.25;
    }
    if (this.phase === 'stand') {
      if (head) head.rotation.z += Math.sin(this.clock * 0.7) * 0.05;
      // now and then, a smoke ring
      if ((this.puff -= dt) < 0 && this.rocket < 0) {
        this.puff = rand(5, 9);
        const at = this.pipe.add(V(0, 0.15, 0));
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          const out = V(Math.cos(a), Math.sin(a) * 0.5, Math.sin(a) * 0.8).multiplyScalar(0.08);
          this.particles.emit({ position: at.clone().add(out), velocity: out.clone().multiplyScalar(2.5).add(V(0, 0.45, 0)), color: '#d8d4cc', life: 3.2, wobble: 0.05 });
        }
      }
    }
    if (this.rocket >= 0) {
      const r = this.rocket;
      this.rocket += dt;
      if (staff) staff.position.y += 0.25 * Math.min(1, r * 6) * (r < 2 ? 1 : Math.max(0, 1 - (r - 2) * 3));
      const top = b.root.position.clone().add(V(0, 1.85, 0));
      const up = 7;
      if (r < 0.7) {
        // the rocket climbs, trailing sparks
        this.particles.emit({ position: top.clone().add(V(0, r * up, 0)), velocity: V(rand(-0.2, 0.2), -0.5, rand(-0.2, 0.2)), color: pick(['#ffd070', '#ff9a3c']), life: 0.5 });
      } else if (r - dt < 0.7) {
        const burst = top.clone().add(V(0, 0.7 * up, 0));
        const colors = pick([['#6ee06a', '#f4d35e', '#ffffff'], ['#ff5a4e', '#ffd070', '#ffffff'], ['#6ab0ff', '#e8f0ff', '#f4d35e']]);
        for (let k = 0; k < 70; k++) {
          const v = V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(2.5, 4));
          this.particles.emit({ position: burst.clone(), velocity: v, color: pick(colors), life: rand(1, 1.8), gravity: -2, size: chance(0.3) ? 2 : 1 });
        }
      }
      if (r > 2.4) this.rocket = -1;
    }
  }
}

/**
 * Rocky, from 40 Eridani (Project Hail Mary): five legs round a rocky carapace, no face. He comes
 * out of the workshop, potters about tapping at things, and talks back in chords when clicked.
 */
class Rocky extends Walker {
  poke() {
    this.state = { kind: 'act', name: 'happy', t: 0, length: 2.4 };
  }

  /** Now and then he stops to tap at something with one hand, the engineer's way. */
  protected next() {
    if (chance(0.3)) this.state = { kind: 'act', name: 'tap', t: 0, length: rand(2, 4) };
    else super.next();
  }

  protected pose(_dt: number) {
    const s = this.state;
    const { phase, moving } = this.gait;
    const happy = s.kind === 'act' && s.name === 'happy';
    const tap = s.kind === 'act' && s.name === 'tap';
    const legs = this.body.parts('leg_0', 'leg_1', 'leg_2', 'leg_3', 'leg_4');
    const step = Math.min(moving, 1.4);
    legs.forEach((leg, i) => {
      // two sets of legs take turns, like a spider's
      const p = phase * 1.4 + (i % 2) * Math.PI + i * 0.3;
      leg.rotation.z += Math.max(0, Math.sin(p)) * 0.35 * step;
      leg.rotation.y += Math.cos(p) * 0.22 * step;
      if (happy) leg.rotation.z += Math.max(0, Math.sin(this.clock * 14 + i * 1.3)) * 0.35; // a little dance
      if (tap && i === 0) leg.rotation.z += 0.5 + Math.max(0, Math.sin(this.clock * 12)) * 0.25;
    });
    const trunk = this.body.part('body');
    if (trunk) {
      trunk.position.y += Math.abs(Math.sin(phase * 1.4)) * 0.02 * step;
      if (happy) trunk.position.y += Math.abs(Math.sin(this.clock * 9)) * 0.12;
      if (tap) trunk.rotation.z -= 0.08;
    }
  }
}

/**
 * The Super Sheep, from Worms (it's where wingedsheep got its name): once in a long while one of
 * the flock pulls on a cape, rockets up off the high meadow and flies about the island in wild
 * swoops, trailing smoke, until it dives into the ground and goes off in a burst of wool. Clicked,
 * it goes off at once, as it would at a press of the space bar.
 */
class SuperSheep {
  readonly body: Body;
  private phase: 'waiting' | 'launch' | 'fly' | 'dive' | 'gone' = 'waiting';
  private wait = LUCK.supersheepSoon ? 4 : rand(90, 300);
  private t = 0;
  private flight = rand(18, 26);
  private pos = V();
  private heading = rand(0, Math.PI * 2);
  private pitch = 0;
  private roll = 0;
  private smoke = 0;
  private seed = Math.random() * 100;
  onCall?: (call: Call, at: THREE.Vector3) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private meadow: THREE.Vector3, private particles: Particles) {
    this.body = new Body('supersheep', template, scene);
  }

  /** Off it goes: a flash, a puff of smoke, and wool everywhere. */
  boom() {
    if (this.phase === 'waiting' || this.phase === 'gone') return;
    const at = this.pos.clone();
    for (let i = 0; i < 50; i++) {
      const v = V(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize().multiplyScalar(rand(2, 7));
      this.particles.emit({ position: at.clone(), velocity: v, color: pick(['#ffffff', '#f4f2ee', '#f4f2ee', '#ffd070', '#ff9a3c', '#8a8290']), life: rand(0.6, 1.6), gravity: -3, wobble: 0.6, size: chance(0.4) ? 2 : 1 });
    }
    this.onCall?.('boom', at);
    this.phase = 'gone';
    this.body.hide();
  }

  update(dt: number, enabled: boolean) {
    const b = this.body;
    if (this.phase === 'gone') return;
    if (this.phase === 'waiting') {
      if (!enabled || (this.wait -= dt) > 0) return;
      const h = this.ground.at(this.meadow.x, this.meadow.z);
      this.pos.copy(this.meadow).setY(Number.isNaN(h) ? 6.4 : h);
      this.phase = 'launch';
      this.t = 0;
      this.pitch = 0;
      b.show(this.pos);
      this.onCall?.('baa', this.pos);
    }
    this.t += dt;
    const fwd = () => V(Math.cos(this.heading) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.sin(this.heading) * Math.cos(this.pitch));
    let speed = 7;
    if (this.phase === 'launch') {
      // straight up off the grass, then tipping over into level flight
      this.pitch = damp(this.pitch, Math.PI / 2 * 0.85, 4, dt);
      speed = Math.min(7, this.t * 6);
      if (this.t > 1.8) {
        this.phase = 'fly';
        this.t = 0;
      }
    } else if (this.phase === 'fly') {
      const t = this.t + this.seed;
      let turn = Math.sin(t * 0.55) * 0.9 + Math.sin(t * 1.7) * 0.4;
      // swooping about, but always back over the island's near side, in front of the peak
      const away = Math.hypot(this.pos.x - SKY.x, this.pos.z - SKY.z);
      if (away > 18) {
        const home = headingOf(SKY.x - this.pos.x, SKY.z - this.pos.z);
        turn = Math.atan2(Math.sin(home - this.heading), Math.cos(home - this.heading)) * 1.5;
      }
      this.heading += turn * dt;
      this.roll = damp(this.roll, -turn * 0.6, 3, dt);
      const height = 16 + Math.sin(t * 0.4) * 2.5; // clear of the peak
      this.pitch = damp(this.pitch, clamp((height - this.pos.y) * 0.15, -0.5, 0.5) + Math.sin(t * 2.3) * 0.15, 2, dt);
      if (this.t > this.flight) {
        this.phase = 'dive';
        this.t = 0;
      }
    } else if (this.phase === 'dive') {
      this.pitch = damp(this.pitch, -1.2, 2.5, dt);
      this.roll = damp(this.roll, Math.sin(this.t * 6) * 0.4, 3, dt);
      speed = 9;
    }
    this.pos.addScaledVector(fwd(), speed * dt);
    const floor = this.ground.at(this.pos.x, this.pos.z);
    if (this.phase === 'dive' && this.pos.y <= (Number.isNaN(floor) ? 0 : Math.max(floor, 0))) return this.boom();

    // smoke from the back, and the cape streaming out behind
    if ((this.smoke -= dt) < 0) {
      this.smoke = 0.04;
      const tail = this.pos.clone().addScaledVector(fwd(), -0.7);
      this.particles.emit({ position: tail, velocity: V(rand(-0.3, 0.3), rand(0, 0.4), rand(-0.3, 0.3)), color: pick(['#d8d4dc', '#b8b2c0', '#ffffff']), life: rand(0.8, 1.4), wobble: 0.3, size: chance(0.3) ? 2 : 1 });
    }
    b.relax();
    b.root.position.copy(this.pos);
    orient(b.root, this.heading, this.pitch, this.roll);
    const clock = this.t + this.seed;
    b.parts('leg_fl', 'leg_fr').forEach((l) => (l.rotation.z += 1.3)); // front legs out ahead, like a superhero
    b.parts('leg_bl', 'leg_br').forEach((l) => (l.rotation.z -= 1.3));
    const cape = b.part('cape');
    if (cape) {
      cape.rotation.z += 0.1 + Math.sin(clock * 16) * 0.12;
      cape.rotation.x += Math.sin(clock * 11) * 0.1;
    }
    const head = b.part('head');
    if (head) head.rotation.z += 0.25; // chin up
  }
}

// --- the lot --------------------------------------------------------------------------

/** What can be clicked, for the Picker. Each clone carries its species as its id. */
export interface Critter {
  species: string;
  body: Body;
}

/**
 * The island's wildlife. Common: gulls, robins, rabbits, crabs, sheep, jumping fish, ducks.
 * Around at the right time of day: deer at dusk, bats, the owl, the hedgehog, the badger
 * and its sett, the fox. Rare: dolphins passing, a whale, geese in a V in autumn and spring,
 * the stag, the black sheep, and one very small, very occasional visitor. Very rare: a sheep
 * with a star on its back, Rocky from Project Hail Mary, a Super Sheep, Gandalf, and (likelier in
 * a storm) the sea serpent.
 */
export class Fauna {
  private walkers: Walker[] = [];
  private gulls: Gull[] = [];
  private robins: Robin[] = [];
  private owl?: Owl;
  private bats: Bat[] = [];
  private skein?: Skein;
  private leapers: Leaper[] = [];
  private pod?: Pod;
  private whale?: Whale;
  private serpent?: Serpent;
  private ducks?: Ducks;
  private heron?: Heron;
  private wanderer?: Wanderer;
  private gandalf?: Gandalf;
  private superSheep?: SuperSheep;
  private clock = 0;
  private ground: Ground;
  /** Every clone, so clicks can find the nearest of a species. */
  private all: Critter[] = [];
  onCall?: (call: Call, at: THREE.Vector3) => void;

  constructor(
    scene: THREE.Scene,
    private island: Island,
    private particles: Particles,
    beike?: Beike,
  ) {
    this.ground = new Ground(island.terrain, island.info.cell);
    const templates = new Map<string, THREE.Object3D>();
    island.root.traverse((o) => {
      if (o.userData.fauna) templates.set(o.userData.fauna, o);
    });
    for (const t of templates.values()) t.removeFromParent();
    const T = (s: string) => templates.get(s);
    if (!templates.size) return;

    const obstacles: { at: THREE.Vector3; r: number }[] = [];
    const big: Record<string, number> = { library: 7.5, workshop: 7, lighthouse: 4.5, sett: 0.1 };
    for (const [id, o] of island.named) obstacles.push({ at: o.getWorldPosition(V()), r: big[id] ?? 1.5 });
    const trees: THREE.Vector3[] = [];
    for (const o of island.root.children) {
      if (/^(tree|lamp|log)/.test(o.name)) obstacles.push({ at: o.getWorldPosition(V()), r: 1.1 });
      if (/^tree/.test(o.name)) trees.push(o.getWorldPosition(V()));
    }
    // …and out from behind the treetops: the camera looks down from the south at 35°, so a crown
    // hides the ground under it and a few metres north of it
    const cover = island.canopies.filter((c) => c.position.y > 1.5);
    const hidden = (p: THREE.Vector3) =>
      cover.some((c) => {
        const north = c.position.z - p.z;
        return Math.abs(p.x - c.position.x) < c.radius * 0.9 && north > -c.radius * 0.8 && north < c.position.y * 1.3 + c.radius * 0.3;
      });
    const walker = <W extends Walker>(Kind: new (...a: ConstructorParameters<typeof Walker>) => W, species: string, spec: WalkSpec, template = species) => {
      const tpl = T(template);
      if (!tpl) return undefined;
      const w = new Kind(species, tpl, scene, this.ground, obstacles, spec);
      if (!['squirrel', 'crab'].includes(species)) w.hidden = hidden;
      this.walkers.push(w);
      this.all.push({ species, body: w.body });
      return w;
    };
    const grass: [number, number] = [0.45, 9];
    const sett = island.positionOf('sett');

    // sheep up on the high meadow round the peak, day and night; sometimes one of them is black,
    // and very rarely one has a star on its back
    const flock = ['sheep', 'sheep', 'sheep', 'sheep', ...(LUCK.blacksheep ? ['blacksheep'] : []), ...(LUCK.starsheep ? ['starsheep'] : [])];
    flock.forEach((species, i) => {
      const home = i % 2 ? B(-3, 15) : B(12, 16);
      const s = walker(Sheep, species, { home, roam: 2.5, speed: 0.35, run: 1.5, gait: 'legs', band: [6, 7.2], graze: 0.8, present: () => true });
      if (!s) return;
      s.state = { kind: 'away', until: 0 };
      // clicked as "ewe": "sheep" is the winged one's id
      if (species === 'sheep') s.body.root.userData.id = 'ewe';
    });
    // rabbits in the meadows, by day and at dusk
    const rabbitTime = (e: Env) => e.night < 0.75 && e.wet < 0.6 && e.season !== 'winter' || (e.season === 'winter' && daylit(e) && e.wet < 0.3);
    for (const [home, n] of [[B(-22, -8), 3], [B(13, -14), 2], [B(-25, -5), 1]] as const) {
      for (let i = 0; i < n; i++) {
        const r = walker(Rabbit, 'rabbit', { home, roam: 3.5, speed: 1.2, run: 4.5, gait: 'hop', band: [0.45, 3], graze: 0.7, present: rabbitTime, shy: [15, 35] });
        if (r) r.beike = beike;
      }
    }
    // deer come out of the woods at dusk and dawn (and on some visits, by day)
    const herd: Deer[] = [];
    const deerTime = (e: Env) => dusky(e) || (LUCK.deerByDay && daylit(e) && e.wet < 0.5);
    for (const [species, template] of [['deer', 'deer'], ['deer', 'deer'], ...(LUCK.stag ? [['stag', 'stag']] : [])] as const) {
      const d = walker(Deer, species, { home: B(10.5, -13), roam: 3.5, den: B(21.5, -9), speed: 0.6, run: 6, gait: 'legs', band: grass, graze: 0.85, present: deerTime, shy: [60, 120] }, template);
      if (d) herd.push(d);
    }
    herd.forEach((d) => (d.herd = herd));
    // the badger, out of its sett from dusk (at any hour with ?animal=badger)
    if (sett) {
      const bx = sett.clone().add(V(-0.35, 0, 1.05)); // the doorway faces south
      const badgerTime = (e: Env) => LUCK.badger || e.night > 0.45;
      walker(Badger, 'badger', { home: sett.clone().add(V(-2.5, 0, 1)), roam: 4, den: bx, speed: 0.55, run: 1.6, gait: 'legs', band: grass, graze: 0.9, present: badgerTime, shy: [30, 60] });
    }
    // the hedgehog snuffles about near the bench at night, but sleeps the winter through
    walker(Hedgehog, 'hedgehog', { home: B(-18, -14), roam: 2.5, speed: 0.3, run: 0.6, gait: 'shuffle', band: grass, graze: 0.9, present: (e) => (dark(e) && e.season !== 'winter') || LUCK.owl, shy: [60, 90] });
    // the fox, on some nights, hunting the meadows
    if (LUCK.fox) walker(Fox, 'fox', { home: B(-3, -1), roam: 7, den: B(-19, 3), speed: 1.1, run: 5.5, gait: 'legs', band: grass, graze: 0.4, present: dark, shy: [60, 120] });
    // crabs on the south beach
    for (const home of [B(-12, -17), B(7, -17.5), B(20, -17.5)]) {
      walker(Crab, 'crab', { home, roam: 2.5, speed: 0.5, run: 2.2, gait: 'scuttle', band: [0.05, 0.42], graze: 0, present: (e) => e.season !== 'winter' || daylit(e), shy: [10, 25] });
    }
    // a squirrel in the eastern woods
    const forest = trees.filter((p) => Math.hypot(p.x - 27, p.z + 4) < 9);
    // very rarely, an engineer from 40 Eridani pops out of the workshop to look round
    if (LUCK.rocky) walker(Rocky, 'rocky', { home: B(15, -12), roam: 3, den: B(11.5, -7.6), speed: 0.7, run: 1.6, gait: 'legs', band: grass, graze: 0.5, present: () => true, shy: [40, 80] });
    const sq = walker(Squirrel, 'squirrel', { home: B(27, 4), roam: 6, speed: 1.4, run: 4, gait: 'hop', band: grass, graze: 0.5, present: daylit, shy: [20, 40] });
    sq?.setTrees(forest);

    // birds
    const gull = T('gull');
    if (gull) for (const c of [B(-30, -8), B(8, -24), B(36, -8)]) this.gulls.push(new Gull(gull, scene, c));
    this.gulls.forEach((g) => this.all.push({ species: 'gull', body: g.body }));
    const robin = T('songbird');
    const spots = [B(-4, -11), B(5, -12), B(-8, -6.5), B(8, -1.5)];
    if (robin) for (let i = 0; i < 4; i++) this.robins.push(new Robin(robin, scene, this.ground, spots, pick(spots).clone()));
    this.robins.forEach((r) => this.all.push({ species: 'songbird', body: r.body }));
    // the owl keeps watch from the top of the signpost, where everyone arriving has to pass
    const owl = T('owl');
    const post = island.get('signpost');
    if (owl && post) {
      const top = new THREE.Box3().setFromObject(post);
      this.owl = new Owl(owl, scene, V((top.min.x + top.max.x) / 2, top.max.y - 0.02, (top.min.z + top.max.z) / 2));
      this.all.push({ species: 'owl', body: this.owl.body });
    }
    const bat = T('bat');
    if (bat) for (const c of [B(-24, 1), B(-24, 1), B(26, 5), B(26, 5)]) this.bats.push(new Bat(bat, scene, c));
    this.bats.forEach((b) => this.all.push({ species: 'bat', body: b.body }));
    const goose = T('goose');
    if (goose) {
      this.skein = new Skein(goose, scene);
      this.skein.onHonk = () => this.onCall?.('honk', V(0, 17, 0));
      this.skein.bodies.forEach((body) => this.all.push({ species: 'goose', body }));
    }

    // water
    const fish = T('fish');
    if (fish) for (let i = 0; i < 2; i++) this.leapers.push(new Leaper(fish, scene, () => this.seaSpot(), particles));
    const dolphin = T('dolphin');
    if (dolphin) {
      this.pod = new Pod(dolphin, scene, particles);
      this.pod.bodies.forEach((body) => this.all.push({ species: 'dolphin', body }));
    }
    const whale = T('whale');
    if (whale) {
      this.whale = new Whale(whale, scene, [B(-28, -25), B(26, -26), B(-42, 8), B(42, 4), B(-6, -29)], particles);
      this.whale.onBlow = (at) => this.onCall?.('blow', at);
      this.whale.onSplash = () => this.onCall?.('splash', this.whale!.body.root.position);
      this.all.push({ species: 'whale', body: this.whale.body });
    }
    const serpent = T('serpent');
    if (serpent) {
      this.serpent = new Serpent(serpent, scene, (x, z) => {
        const h = this.ground.at(x, z);
        return Number.isNaN(h) || h < -1.5;
      }, particles);
      this.serpent.onCall = (call, at) => this.onCall?.(call, at);
      this.all.push({ species: 'serpent', body: this.serpent.body });
    }
    const duck = T('duck');
    const duckling = T('duckling');
    if (duck && duckling) {
      this.ducks = new Ducks(duck, duckling, scene, B(-8, -22));
      this.ducks.bodies.forEach((body, i) => this.all.push({ species: i ? 'duckling' : 'duck', body }));
    }
    const heron = T('heron');
    const shallows = this.shallows(B(29, -13));
    if (heron && shallows) {
      this.heron = new Heron(heron, scene, shallows, particles);
      this.all.push({ species: 'heron', body: this.heron.body });
    }
    const wanderer = T('wanderer');
    const dock = island.positionOf('dock');
    if (wanderer && dock && LUCK.wanderer) {
      const route = [B(-0.5, -26.5), B(-0.3, -17), B(0, -12.5), B(3.6, -9.5), B(9, -11), B(15, -10.5), B(21, -6), B(24.8, -3.6), B(26.9, -3.3)]; // ends by the fire, on the near side
      this.wanderer = new Wanderer(wanderer, scene, this.ground, route, particles);
      this.all.push({ species: 'wanderer', body: this.wanderer.body });
    }
    const gandalf = T('gandalf');
    if (gandalf && dock && LUCK.gandalf) {
      const route = [B(-0.5, -26.5), B(-0.3, -17), B(0, -12.5), B(3.6, -9.5), B(9, -11), B(15, -10.5), B(21, -6), B(23.6, -3.4)]; // ends by the fire, west of it
      this.gandalf = new Gandalf(gandalf, scene, this.ground, route, particles);
      this.gandalf.onCall = (call, at) => this.onCall?.(call, at);
      this.all.push({ species: 'gandalf', body: this.gandalf.body });
    }
    const supersheep = T('supersheep');
    if (supersheep && LUCK.supersheep) {
      this.superSheep = new SuperSheep(supersheep, scene, this.ground, B(12, 16), particles);
      this.superSheep.onCall = (call, at) => this.onCall?.(call, at);
      this.all.push({ species: 'supersheep', body: this.superSheep.body });
    }
  }

  /** Every animal's root, for the Picker. */
  get pickables() {
    return this.all.map((c) => c.body.root);
  }

  /** The visible animal of a species nearest to a point (where a click landed). */
  nearest(species: string, at: THREE.Vector3) {
    let best: Critter | undefined;
    let d = Infinity;
    for (const c of this.all) {
      if (c.species !== species || !c.body.shown) continue;
      const k = c.body.root.position.distanceTo(at);
      if (k < d) [best, d] = [c, k];
    }
    return best;
  }

  /** Someone clicked an animal; it reacts. `from` is where they're looking from. */
  poke(species: string, at: THREE.Vector3, from: THREE.Vector3) {
    const c = this.nearest(species, at);
    const w = this.walkers.find((x) => x.body === c?.body);
    if (w instanceof Sheep) {
      w.poke();
      this.onCall?.('baa', at);
    } else if (w instanceof Badger) w.poke();
    else if (w instanceof Hedgehog) w.poke();
    else if (w instanceof Rocky) {
      w.poke();
      this.onCall?.('chord', at);
    }
    else if (w instanceof Squirrel) {
      w.startle(from);
      this.onCall?.('chatter', at);
    } else if (w) w.startle(from);
    if (species === 'gull') {
      this.gulls.find((g) => g.body === c?.body)?.poke();
      this.onCall?.('gull', at);
    }
    if (species === 'songbird') {
      this.onCall?.('chirp', at);
      this.robins.forEach((r) => r.fly());
    }
    if (species === 'owl') {
      this.owl?.poke();
      this.onCall?.('hoot', at);
    }
    if (species === 'duck' || species === 'duckling') {
      this.ducks?.poke();
      this.onCall?.('quack', at);
    }
    if (species === 'heron') this.heron?.poke();
    if (species === 'serpent') this.serpent?.poke();
    if (species === 'wanderer') this.wanderer?.dash();
    if (species === 'gandalf') this.gandalf?.firework();
    if (species === 'supersheep') this.superSheep?.boom();
  }

  /** Whether the geese overhead are flying south (autumn) or north (spring). */
  get geeseSouth() {
    return this.skein?.south ?? true;
  }

  /** A patch of open sea near enough the island to be seen. */
  private seaSpot(): THREE.Vector3 | null {
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      const p = V(Math.cos(a) * rand(28, 40), 0, Math.sin(a) * rand(20, 28));
      const h = this.ground.at(p.x, p.z);
      if (Number.isNaN(h) || h < -0.9) return p;
    }
    return null;
  }

  /** The nearest ankle-deep water to a point. */
  private shallows(near: THREE.Vector3): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let d = Infinity;
    for (let x = -6; x <= 6; x += 0.2) {
      for (let z = -6; z <= 6; z += 0.2) {
        const p = near.clone().add(V(x, 0, z));
        const h = this.ground.at(p.x, p.z);
        if (h > -0.45 && h < -0.15 && p.distanceTo(near) < d) [best, d] = [p, p.distanceTo(near)];
      }
    }
    return best;
  }

  update(dt: number, e: Env) {
    this.clock += dt;
    const t = this.clock;
    for (const w of this.walkers) {
      if (w instanceof Badger) w.update(dt, e, this.particles);
      else w.update(dt, e);
    }
    this.gulls.forEach((g) => g.update(dt, t, e.night < 0.8));
    const robinTime = daylit(e) && e.wet < 0.5;
    this.robins.forEach((r) => r.update(dt, robinTime));
    this.owl?.update(dt, dark(e) || LUCK.owl);
    const batTime = dusky(e) && e.night > 0.3 && e.season !== 'winter' && e.wet < 0.4;
    this.bats.forEach((b) => b.update(dt, batTime));
    this.skein?.update(dt, e, t);
    this.leapers.forEach((l) => l.update(dt));
    this.pod?.update(dt, e);
    this.whale?.update(dt);
    this.serpent?.update(dt, e);
    this.ducks?.update(dt, e);
    this.heron?.update(dt, e);
    this.wanderer?.update(dt, e.night < 0.9);
    this.gandalf?.update(dt, true);
    this.superSheep?.update(dt, (e.night < 0.6 && e.wet < 0.7) || LUCK.supersheepSoon);
  }
}
