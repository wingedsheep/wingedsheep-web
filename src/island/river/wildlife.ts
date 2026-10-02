import * as THREE from 'three';
import { spotAnimal, type Animal } from '../sketchbook';
import { occasions } from '../scene/calendar';
import { GREEN_FIRE } from '../scene/island';
import { season } from '../scene/season';
import { haloTexture } from '../scene/sky';
import type { RiverAssets } from './assets';
import type { Course, Thing } from './course';
import { waterAt } from './flow';
import type { Spot } from './land';
import type { Rare } from './rivers';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** The turn that points a model's front (+x, as the animals are built) along (dx, dz). */
const face = (dx: number, dz: number) => Math.atan2(-dz, dx);
/** The ring that pulses round a rare one as it's spotted (see Wildlife.pulse). */
const RING = new THREE.RingGeometry(0.9, 1.1, 28).rotateX(-Math.PI / 2);
const PULSE = new THREE.Color('#fff2c4');
/** The motes that drift up off a rare one before it's spotted: warm, to stand out from the white of the water. */
const MOTE = new THREE.Color('#ffd98a');
/** An angle eased a share `k` of the way to another, the short way round. */
const turn = (from: number, to: number, k: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * Math.min(1, k);
/** A value eased towards another at `rate` per second, however long the frame. */
const ease = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-dt * rate));

export type Cry = 'heron' | 'kingfisher' | 'otter' | 'grunt' | 'yeti' | 'raven' | 'lynx' | 'eagle' | 'boar' | 'moo';

export interface WildlifeEvents {
  /** Something happened worth a line on screen. */
  say?(text: string): void;
  croak?(): void;
  quack?(): void;
  baa?(): void;
  bark?(): void;
  /** One of the rare ones, seen for the first time this run, and where. */
  spotted?(kind: Rare, at: THREE.Vector3): void;
  /** A heron put up off the shallows, a kingfisher going by, an otter, a moose, and whatever that was. */
  cry?(kind: Cry): void;
  /** A beaver's tail smacked on the water; wolves howling; a bear's roar. */
  slap?(): void;
  howl?(): void;
  growl?(): void;
}


interface Actor {
  species?: Animal;
  sketched?: boolean;
  s: number;
  root: THREE.Object3D;
  /** Returns false once it's done and can go. */
  update(dt: number, kayak: THREE.Vector3): boolean;
}

// --- particles --------------------------------------------------------------------------------

const MAX = 900;
/** A second, finer set for the froth afloat on the water: many of them, and small. */
const FROTH_MAX = 500;

/**
 * Little square specks, one texel each (or two): spray off the bow and the rocks, drips off the
 * paddle, mist at the foot of a fall, leaves drifting on the current, rain and snow, dragonflies
 * over slow water by day and fireflies along the banks at night.
 */
class Specks {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private kind: Uint8Array; // 0 falls with gravity, 1 floats on the current, 2 drifts, 3 flits
  private next = 0;

  constructor(private max = MAX, size = 2) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.kind = new Uint8Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(V(), 1e6);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, fog: true }));
    this.points.frustumCulled = false;
    this.life.fill(0);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -1e4;
  }

  emit(at: THREE.Vector3, v: THREE.Vector3, color: THREE.Color, life: number, kind = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([at.x, at.y, at.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.life[i] = life;
    this.kind[i] = kind;
  }

  /** `flow` gives the current at a point (for things floating on it). */
  update(dt: number, t: number, flow: (x: number, z: number, out: THREE.Vector3) => THREE.Vector3) {
    const f = V();
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) {
        this.pos[k + 1] = -1e4;
        continue;
      }
      switch (this.kind[i]) {
        case 0:
          this.vel[k + 1] -= 9.8 * dt;
          break;
        case 1:
          flow(this.pos[k], this.pos[k + 2], f);
          this.vel[k] = f.x;
          this.vel[k + 2] = f.z;
          break;
        case 3: // flitting: a dragonfly's darts, a firefly's wander
          if (Math.random() < dt * 1.5) this.vel.set([rand(-2, 2), rand(-0.3, 0.3), rand(-2, 2)], k);
          this.pos[k + 1] += Math.sin(t * 3 + i) * 0.005;
          break;
      }
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -1e4;
  }
}

/**
 * Fireflies along the banks on a summer's night: each a soft spark that wanders, flashes for a
 * moment every few seconds and goes dark again, out of step with the rest.
 */
class Fireflies {
  readonly group = new THREE.Group();
  private flies: { sprite: THREE.Sprite; v: THREE.Vector3; life: number; age: number; every: number; phase: number }[] = [];
  private next = 0;

  constructor(max = 40) {
    const halo = haloTexture();
    for (let i = 0; i < max; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: halo, color: FIREFLY, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
      }));
      sprite.visible = false;
      sprite.renderOrder = 3;
      this.group.add(sprite);
      this.flies.push({ sprite, v: V(), life: 0, age: 0, every: 3, phase: 0 });
    }
  }

  emit(at: THREE.Vector3) {
    const f = this.flies[this.next];
    this.next = (this.next + 1) % this.flies.length;
    f.sprite.position.copy(at);
    f.v.set(rand(-0.4, 0.4), rand(-0.1, 0.1), rand(-0.4, 0.4));
    f.life = rand(8, 14);
    f.age = 0;
    f.every = rand(1.8, 4);
    f.phase = Math.random();
  }

  update(dt: number) {
    for (const f of this.flies) {
      if (f.age >= f.life) {
        f.sprite.visible = false;
        continue;
      }
      f.age += dt;
      if (Math.random() < dt * 0.8) f.v.set(rand(-0.5, 0.5), rand(-0.15, 0.15), rand(-0.5, 0.5));
      f.sprite.position.addScaledVector(f.v, dt);
      // a flash: up quickly, a slow fade, then dark till the next
      const t = (f.age / f.every + f.phase) % 1;
      const flash = t < 0.08 ? t / 0.08 : Math.max(0, 1 - (t - 0.08) / 0.3);
      const fade = Math.min(1, f.age, f.life - f.age);
      f.sprite.material.opacity = (0.08 + flash * 0.92) * fade;
      f.sprite.scale.setScalar(0.25 + flash * 0.3);
      f.sprite.visible = f.sprite.material.opacity > 0.02;
    }
  }

  clear() {
    for (const f of this.flies) {
      f.age = f.life = 0;
      f.sprite.visible = false;
    }
  }
}

const WHITE = new THREE.Color('#f2f7f6');
/** Earth flicked up off a boar's snout. */
const EARTH = new THREE.Color('#5a4432');
const FOAM = new THREE.Color('#d6ecea');
const DRIP = new THREE.Color('#a8d8e0');
const GOLD = new THREE.Color('#ffd35a');
const EMBER = new THREE.Color('#ff9a3c');
const FIREFLY = new THREE.Color('#fff38a');
const DRAGONFLY = new THREE.Color('#3fa8d8');
const RAIN = new THREE.Color('#b8cde0');
const LEAVES_GREEN = ['#4a8c45', '#72b04c'].map((c) => new THREE.Color(c));
const LEAVES_AUTUMN = ['#cc622c', '#d4ae40', '#a0392c', '#e08a3a'].map((c) => new THREE.Color(c));
const CONFETTI = ['#ffd35a', '#e2ee3a', '#ff7a5a', '#f2c3d6', '#7ad0e6', '#f2f7f6'].map((c) => new THREE.Color(c));
const BLOSSOM = ['#f2c3d6', '#fbe0ea'].map((c) => new THREE.Color(c));
/** Butterflies over the meadows (cabbage whites, brimstones, a peacock, a blue), and thistledown. */
const BUTTERFLIES = ['#f4f0e6', '#f2dc5a', '#d8602a', '#6a9ae8'].map((c) => new THREE.Color(c));
const DOWN = new THREE.Color('#f6f2e8');
// (over Halloween the fires burn green, and so do their sparks: see land.ts)
const EMBERS = (GREEN_FIRE?.embers ?? ['#ffd35a', '#ff9a3c', '#ffb35a']).map((c) => new THREE.Color(c));
/** Halloween week's bats, out over the water at dusk. */
const BATS = occasions.has('halloween');
const BAT = new THREE.Color('#1d1a24');
const SMOKE = ['#c9c4c8', '#b3aeb6', '#dcd8da'].map((c) => new THREE.Color(c));

/**
 * Life along the river: the animals the land left room for (a heron fishing, ducks, deer
 * drinking, fish jumping), a kingfisher flashing past, Beike running the bank for
 * a while, now and then the winged sheep overhead, and all the specks.
 */
export class Wildlife {
  readonly group = new THREE.Group();
  readonly specks = new Specks();
  readonly froths = new Specks(FROTH_MAX, 1);
  private fireflies = new Fireflies();
  events: WildlifeEvents = {};
  /** The ground's height at (x, z), for animals on the bank. */
  ground: (x: number, z: number) => number = () => 0;
  /** Whether something (a tree, a rock, the land itself) stands between a point and the camera. */
  hidden: (at: THREE.Vector3) => boolean = () => false;
  /** Whether `at` is on screen (within `margin` of the middle, 1 being the edge). */
  inView: (at: THREE.Vector3, margin?: number) => boolean = () => true;
  private actors: Actor[] = [];
  /** Ones started while the others were being updated, to join them after. */
  private born: Actor[] = [];
  private clock = 0;
  /** Everything in the water round the kayak, for the specks floating on it to go round. */
  private things: Thing[] = [];
  private kingfisherIn = rand(12, 30);
  private frogIn = rand(4, 10);
  private sheepIn = rand(90, 200);
  private ravensIn = rand(6, 14);
  /** 0..1: how stormy it is on the island (the rain comes in sideways on the wind). */
  storm = 0;
  /** The storm's wind across the river right now (x, z; the kayak's gust), for the rain to ride. */
  readonly blow = new THREE.Vector2();
  private beikeDone = false;
  /** ?beike: out he comes as soon as you're this far down, wherever that is. */
  private beikeFrom = Infinity;
  private waiting = false; // Beike's waiting at the take-out
  /** The rare ones already in your log (the ones you haven't seen come up more often). */
  seen: ReadonlySet<Rare> = new Set();
  /** Who's out this run, and from where down the river we start looking for somewhere for them. */
  private rare?: { kind: Rare; from: number };
  private rareIn = 0;

  constructor(private assets: RiverAssets, private course: Course) {
    this.group.add(this.specks.points, this.froths.points, this.fireflies.group);
  }

  reset(course: Course) {
    this.course = course;
    for (const a of this.actors) a.root.removeFromParent();
    this.actors = [];
    this.born = [];
    this.specks.clear();
    this.froths.clear();
    this.fireflies.clear();
    this.kingfisherIn = rand(12, 30);
    this.frogIn = rand(4, 10);
    this.sheepIn = rand(90, 200);
    this.ravensIn = rand(6, 14);
    this.storm = 0;
    this.beikeDone = false;
    this.beikeFrom = Infinity;
    this.waiting = false;
    this.rare = undefined;
    const { chance, who } = course.profile.rare;
    if (Math.random() < chance) {
      // the ones not in your log yet come up more often (all but the yeti: that stays a rumour)
      const pool = (Object.entries(who) as [Rare, number][]).map(([k, w]) => [k, this.seen.has(k) || k === 'yeti' ? w : w * 2.5] as const);
      let pick = Math.random() * pool.reduce((a, [, w]) => a + w, 0);
      const kind = pool.find(([, w]) => (pick -= w) < 0)?.[0] ?? pool[0][0];
      const length = Number.isFinite(course.finish) ? course.finish : 1000;
      this.rare = { kind, from: rand(150, Math.max(200, length * 0.6)) };
    }
  }

  /** Whichever rare one's out this run (for ?rare=bear to go looking for one). */
  force(kind: Rare) {
    this.rare = { kind, from: 60 };
  }

  /** Beike, as soon as you're past `from` (for ?beike, to watch him run and go). */
  forceBeike(from: number) {
    this.beikeFrom = from;
  }

  /** A chunk of river came into view with places for animals. */
  settle(spots: Spot[]) {
    for (const spot of spots) {
      const a = this.spawn(spot);
      if (a) {
        const species = { heron: 'heron', ducks: 'duck', deer: 'deer', sheep: 'sheep', fish: 'fish', swans: 'swan' } as const;
        a.species = species[spot.kind];
        this.actors.push(a);
      }
    }
  }

  update(dt: number, kayak: THREE.Vector3, s: number, speed: number, night: number, rain: number, snow: number, fair: boolean) {
    this.clock += dt;
    this.actors = this.actors.filter((a) => {
      const keep = a.s > s - 45 && a.update(dt, kayak);
      if (keep && a.species && !a.sketched && a.root.visible && a.root.position.distanceToSquared(kayak) < 32 * 32 && this.inView(a.root.position) && !this.hidden(a.root.position)) {
        a.sketched = true;
        if (spotAnimal(a.species, 'Along the river')) this.events.say?.('A new sketch in your wildlife book.');
      }
      if (!keep) a.root.removeFromParent();
      return keep;
    });
    if (this.born.length) this.actors.push(...this.born.splice(0));

    // a kingfisher, straight up the river past you, low over the water
    if ((this.kingfisherIn -= dt) < 0 && night < 0.3) {
      this.kingfisherIn = rand(25, 60);
      this.actors.push({ ...this.kingfisher(s), species: 'kingfisher' });
    }
    // frogs in the slack water along the edges, from dusk, in the warm half of the year
    if ((this.frogIn -= dt) < 0) {
      this.frogIn = rand(6, 18);
      if (night > 0.25 && snow < 0.1 && season.name !== 'winter' && this.course.at(s).rough < 0.25) this.events.croak?.();
    }
    // on the hard rivers, ravens wheeling overhead, waiting to see how it goes
    const look = this.course.profile.look;
    if (look.grim > 0 && (this.ravensIn -= dt) < 0 && night < 0.7) {
      this.ravensIn = rand(25, 50) / look.grim;
      for (let n = 1 + Math.floor(Math.random() * 3); n > 0; n--) this.actors.push(Object.assign(this.raven(s), { species: 'raven' as const }));
      this.events.cry?.('raven');
    }
    // the winged sheep, crossing high over the river
    if ((this.sheepIn -= dt) < 0 && fair) {
      this.sheepIn = rand(180, 360);
      this.actors.push({ ...this.wingedSheep(s), species: 'wingedsheep' });
    }
    // Beike, once a trip: somewhere open, a few hundred metres down
    const p = this.course.at(s);
    if (!this.beikeDone && (s > this.beikeFrom || (s > 200 && s < this.course.finish - 250 && p.clear > 0.6 && p.gorge < 0.3 && night < 0.5))) {
      const beike = this.beike(s);
      if (beike) {
        this.beikeDone = true;
        this.actors.push(beike);
      }
    }

    // …and at the take-out, there he is again, having gone round by the path
    if (!this.waiting && Number.isFinite(this.course.finish) && s > this.course.finish - 80) {
      this.waiting = true;
      this.actors.push(this.waiter(this.course.finish + 9));
    }

    // the rare one, if there's one out today: at the first place along that suits it
    if (this.rare && s > this.rare.from && s < this.course.finish - 120 && (this.rareIn -= dt) < 0) {
      this.rareIn = 0.3;
      const a = this.spawnRare(this.rare.kind, s + 34, night);
      if (a) {
        this.rare = undefined;
        this.actors.push(a);
      }
    }

    this.ambient(dt, kayak, s, night, rain, snow);
    this.things = this.course.near(s - 20, s + 60);
    this.specks.update(dt, this.clock, (x, z, out) => this.flow(x, z, out));
    this.fireflies.update(dt);
    this.froths.update(dt, this.clock, (x, z, out) => this.flow(x, z, out));
  }

  /** The current at (x, z): for leaves and foam floating on it (round and back up in an eddy). */
  private flow(x: number, z: number, out: THREE.Vector3) {
    const w = waterAt(this.course, x, z, undefined, this.things);
    return out.set(w.fx * w.along + w.px, 0, w.fz * w.along + w.pz);
  }

  // --- specks ---------------------------------------------------------------------------------

  /** A burst of spray: off a rock, a knock, a landing. */
  spray(at: THREE.Vector3, count: number, power = 1) {
    for (let i = 0; i < count; i++) {
      const v = V(rand(-1, 1), rand(1.5, 3.5) * power, rand(-1, 1)).multiplyScalar(power);
      this.specks.emit(at.clone().add(V(rand(-0.3, 0.3), 0.1, rand(-0.3, 0.3))), v, i % 3 ? WHITE : FOAM, rand(0.4, 0.9));
    }
  }

  /** A ring of spray thrown out flat across the water: a landing, a big smack. */
  ring(at: THREE.Vector3, count: number, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.1, 0.1);
      const v = V(Math.cos(a) * rand(2.5, 4) * power, rand(0.8, 1.6) * power, Math.sin(a) * rand(2.5, 4) * power);
      this.specks.emit(at.clone().add(V(Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8)), v, i % 2 ? WHITE : FOAM, rand(0.35, 0.6));
    }
  }

  /** A column of white water thrown straight up: the kayak plunging into the foot of a waterfall. */
  plume(at: THREE.Vector3, count: number, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const out = rand(0, 1.4) * power;
      const v = V(Math.cos(a) * out, rand(5, 10) * power, Math.sin(a) * out);
      this.specks.emit(at.clone().add(V(Math.cos(a) * rand(0, 0.6), 0.1, Math.sin(a) * rand(0, 0.6))), v, i % 3 ? WHITE : FOAM, rand(0.9, 1.6));
    }
  }

  /** Mist hanging in the air and drifting off slowly, `wide` metres across. */
  mist(at: THREE.Vector3, count: number, wide = 3) {
    for (let i = 0; i < count; i++) {
      const v = V(rand(-0.6, 0.6), rand(0.2, 0.9), rand(-0.6, 0.6));
      this.specks.emit(at.clone().add(V(rand(-wide, wide) / 2, rand(0.2, 1.8), rand(-wide, wide) / 2)), v, i % 2 ? WHITE : FOAM, rand(1.5, 3.2), 2);
    }
  }

  /** Glints thrown up round the kayak: a ball fished out, the flow going up a notch. */
  sparkle(at: THREE.Vector3, count: number, color: THREE.Color = GOLD, power = 1) {
    for (let i = 0; i < count; i++) {
      const v = V(rand(-1.5, 1.5), rand(2, 4.5), rand(-1.5, 1.5)).multiplyScalar(power);
      this.specks.emit(at.clone().add(V(rand(-0.6, 0.6), 0.6, rand(-0.6, 0.6))), v, color, rand(0.5, 1));
    }
  }

  /** Leaves and petals thrown up in every colour: the take-out. */
  confetti(at: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const v = V(rand(-3, 3), rand(4, 8), rand(-3, 3));
      this.specks.emit(at.clone().add(V(rand(-1, 1), 0.8, rand(-1, 1))), v, CONFETTI[i % CONFETTI.length], rand(1.2, 2));
    }
  }

  /** A glint left floating in the wake, when the flow's running hot. */
  glint(at: THREE.Vector3) {
    this.specks.emit(at.clone().setY(at.y + 0.08), V(), Math.random() < 0.5 ? GOLD : EMBER, rand(0.4, 0.9), 1);
  }

  /** Drips off the paddle's blade. */
  drip(at: THREE.Vector3) {
    this.specks.emit(at, V(rand(-0.3, 0.3), rand(0, 0.6), rand(-0.3, 0.3)), DRIP, 0.5);
  }

  /** A puff of smoke from a cottage's chimney, rising and drifting off. */
  smoke(at: THREE.Vector3) {
    this.specks.emit(at.clone().add(V(rand(-0.15, 0.15), 0, rand(-0.15, 0.15))), V(rand(0.2, 0.5), rand(0.6, 1), rand(-0.1, 0.2)), SMOKE[Math.floor(Math.random() * SMOKE.length)], rand(2.5, 4), 2);
  }

  /** A spark flying up off a fire, drifting on the air and gone in a moment. */
  ember(at: THREE.Vector3) {
    const c = EMBERS[Math.floor(Math.random() * EMBERS.length)];
    this.specks.emit(at.clone().add(V(rand(-0.12, 0.12), 0, rand(-0.12, 0.12))), V(rand(-0.3, 0.3), rand(1, 2.2), rand(-0.3, 0.3)), c, rand(0.5, 1.3), 2);
  }

  /** Froth left behind on the water, floating off downstream. */
  froth(at: THREE.Vector3, life = rand(0.8, 1.6)) {
    this.froths.emit(at.clone().setY(at.y + 0.05), V(), FOAM, life, 1);
  }

  private ambient(dt: number, kayak: THREE.Vector3, s: number, night: number, rain: number, snow: number) {
    const p = this.course.at(s + 12);
    const half = p.width / 2;
    const rx = Math.cos(p.a);
    const rz = Math.sin(p.a);
    // leaves and petals on the water, drifting down with you
    const leafy = season.turn > 0.3 ? LEAVES_AUTUMN : season.blossom > 0.3 ? BLOSSOM : LEAVES_GREEN;
    if (Math.random() < dt * (0.25 + season.turn * 0.8 + season.blossom * 0.8)) {
      const q = this.course.at(s + rand(10, 35));
      const u = rand(-0.9, 0.9) * q.width / 2;
      this.specks.emit(V(q.x + Math.cos(q.a) * u, q.y + 0.04, q.z + Math.sin(q.a) * u), V(), leafy[Math.floor(Math.random() * leafy.length)], 10, 1);
    }
    // over slow water on a summer's day: dragonflies. Along the banks at night: fireflies
    const warm = season.weights.summer + season.weights.spring * 0.4;
    if (p.speed < 4.5 && night < 0.3 && Math.random() < dt * warm * 1.5) {
      const u = rand(-1, 1) * half;
      this.specks.emit(V(p.x + rx * u, p.y + rand(0.5, 1.2), p.z + rz * u), V(), DRAGONFLY, rand(4, 8), 3);
    }
    // (out as it gets dark, not in the rain, and more of them over the quiet water)
    const glow = THREE.MathUtils.smoothstep(night, 0.25, 0.5) * THREE.MathUtils.smoothstep(warm, 0.3, 0.7) * (1 - rain) * (1 - snow);
    if (glow > 0 && Math.random() < dt * 5 * glow * (p.speed < 4.5 ? 1.5 : 0.6)) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const u = side * (half + rand(-0.5, 7));
      const q = this.course.at(s + rand(-10, 35));
      this.fireflies.emit(V(q.x + Math.cos(q.a) * u, Math.max(q.y, this.ground(q.x + Math.cos(q.a) * u, q.z + Math.sin(q.a) * u)) + rand(0.4, 2), q.z + Math.sin(q.a) * u));
    }
    // Halloween week: bats out over the water as the light goes, flitting after the midges
    const bats = BATS ? THREE.MathUtils.smoothstep(night, 0.1, 0.35) * (1 - THREE.MathUtils.smoothstep(night, 0.75, 0.95)) * (1 - rain) * (1 - snow) : 0;
    if (bats > 0 && Math.random() < dt * 3 * bats) {
      const q = this.course.at(s + rand(0, 30));
      const u = rand(-1.2, 1.2) * q.width / 2;
      this.specks.emit(V(q.x + Math.cos(q.a) * u, q.y + rand(1.5, 4.5), q.z + Math.sin(q.a) * u), V(), BAT, rand(5, 9), 3);
    }
    // on a gentle river on a fine day, butterflies over the banks and thistledown drifting across
    const flutter = this.course.profile.look.flutter * (1 - night) * (0.3 + warm) * (1 - rain);
    if (flutter > 0 && Math.random() < dt * flutter * 2.5) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const u = side * (half * rand(0.3, 1) + rand(0, 5));
      const q = this.course.at(s + rand(-5, 30));
      this.specks.emit(V(q.x + Math.cos(q.a) * u, q.y + rand(0.5, 1.6), q.z + Math.sin(q.a) * u), V(), BUTTERFLIES[Math.floor(Math.random() * BUTTERFLIES.length)], rand(5, 9), 3);
    }
    if (flutter > 0 && Math.random() < dt * flutter * 1.5) {
      const q = this.course.at(s + rand(0, 35));
      const u = rand(-1.4, 1.4) * q.width / 2;
      this.specks.emit(V(q.x + Math.cos(q.a) * u, q.y + rand(1, 3), q.z + Math.sin(q.a) * u), V(rand(0.4, 0.9) * rx, rand(-0.05, 0.1), rand(0.4, 0.9) * rz), DOWN, rand(6, 10), 2);
    }
    // rain, and snow, falling round you: in a storm, driven in sideways on the wind
    const fall = (rain + snow) * 60 * (1 + this.storm);
    // (the way the gusts are blowing, or on a still day just a touch)
    const sx = 0.4 + this.storm * 2 + this.blow.x * 3.5;
    const sz = this.blow.y * 3.5;
    for (let n = Math.floor(fall * dt + Math.random()); n > 0; n--) {
      const at = kayak.clone().add(V(rand(-22, 22) - sx * 0.6, rand(8, 14), rand(-30, 12) - sz * 0.6));
      if (Math.random() < snow / Math.max(rain + snow, 0.01)) this.specks.emit(at, V(rand(-0.5, 0.5) + sx * 0.3, -1.2, rand(-0.5, 0.5) + sz * 0.3), WHITE, 10, 2);
      else this.specks.emit(at, V(sx, -16 - this.storm * 6, sz), RAIN, 1, 2);
    }
  }

  // --- the animals ----------------------------------------------------------------------------

  private spawn(spot: Spot): Actor | null {
    switch (spot.kind) {
      case 'heron': return this.heron(spot);
      case 'ducks': return this.ducks(spot);
      case 'deer': return this.deer(spot);
      case 'sheep': return this.sheep(spot);
      case 'fish': return this.fish(spot);
      case 'swans': return this.swans(spot);
    }
  }

  /** A heron fishing the shallows, dead still, until you come too close: then off, complaining. */
  private heron(spot: Spot): Actor {
    const root = this.assets.clone('heron');
    root.position.set(spot.x, spot.y - 0.35, spot.z);
    root.rotation.y = face(Math.sin(spot.a) * -1, Math.cos(spot.a)) + rand(-0.8, 0.8); // looking upstream, mostly
    this.group.add(root);
    const wings = [root.getObjectByName('heron_wing_l'), root.getObjectByName('heron_wing_r')];
    const neck = root.getObjectByName('heron_neck');
    let flying = -1;
    const away = V(Math.cos(spot.a) * spot.side, 0, Math.sin(spot.a) * spot.side);
    return {
      s: spot.s,
      root,
      update: (dt, kayak) => {
        if (flying < 0 && root.position.distanceTo(kayak) < 11) {
          flying = 0;
          this.events.cry?.('heron');
        }
        if (flying < 0) {
          // now and then, a strike: quick down, slower back up
          if (neck) neck.rotation.z = ease(neck.rotation.z, Math.sin(this.clock * 0.4 + spot.s) > 0.97 ? -0.6 : 0, 14, dt);
          return true;
        }
        flying += dt;
        root.rotation.y = turn(root.rotation.y, face(away.x + Math.sin(spot.a) * 0.6, away.z - Math.cos(spot.a) * 0.6), dt * 5);
        // (a few heavy beats to get off the water, winding up as it goes)
        const lift = Math.min(1, flying * 1.5);
        const beat = Math.sin(flying * 9);
        wings.forEach((w, i) => w && (w.rotation.x = (i ? -1 : 1) * beat * 0.9 * lift));
        root.position.addScaledVector(away, dt * 4 * lift).add(V(Math.sin(spot.a) * dt * 3 * lift, dt * Math.min(3, 1 + flying) * lift, -Math.cos(spot.a) * dt * 3 * lift));
        if (neck) neck.rotation.z = ease(neck.rotation.z, 0.5, 4, dt);
        return flying < 7;
      },
    };
  }

  /** A mallard and her ducklings, paddling along the edge; they make for the bank when you come by. */
  private ducks(spot: Spot): Actor {
    const root = new THREE.Group();
    const mum = this.assets.clone('duck');
    root.add(mum);
    root.position.set(spot.x, spot.y, spot.z);
    const up = face(-Math.sin(spot.a), Math.cos(spot.a)); // paddling upstream
    root.rotation.y = up;
    this.group.add(root);
    // Each duckling paddles after the one in front on its own (worked out on the water, beside the
    // group rather than in it), so a turn ripples down the line instead of swinging it like a stick.
    const brood = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, i) => {
      const d = this.assets.clone('duckling');
      root.add(d);
      const back = 0.5 + i * 0.38;
      return {
        d,
        x: spot.x - Math.cos(up) * back,
        z: spot.z + Math.sin(up) * back,
        h: up,
        gap: i ? rand(0.32, 0.46) : rand(0.45, 0.55),
        keen: rand(2.2, 3.6), // how smartly it keeps up
        phase: rand(0, Math.PI * 2),
        drift: rand(0.4, 0.9), // how much it wanders off the line
      };
    });
    let fled = false;
    const bank = V(Math.cos(spot.a) * spot.side, 0, Math.sin(spot.a) * spot.side);
    return {
      s: spot.s,
      root,
      update: (dt, kayak) => {
        const t = this.clock;
        mum.position.y = Math.sin(t * 2.2) * 0.02;
        if (!fled && root.position.distanceTo(kayak) < 9) {
          fled = true;
          this.events.quack?.();
        }
        if (fled) {
          root.rotation.y = turn(root.rotation.y, face(bank.x, bank.z), dt * 2);
          root.position.addScaledVector(bank, dt * 0.8);
        } else {
          root.position.add(V(-Math.sin(spot.a) * dt * 0.25, 0, Math.cos(spot.a) * dt * 0.25));
        }
        let lx = root.position.x;
        let lz = root.position.z;
        const c = Math.cos(root.rotation.y);
        const s = Math.sin(root.rotation.y);
        brood.forEach((b, i) => {
          // keep a little way behind the one ahead, on whatever side it happens to be, wandering a bit
          let dx = b.x - lx;
          let dz = b.z - lz;
          const far = Math.hypot(dx, dz) || 1;
          dx /= far;
          dz /= far;
          const wander = Math.sin(t * b.drift * 1.3 + b.phase) * 0.09 + Math.sin(t * 0.37 + b.phase * 2) * 0.05;
          const tx = lx + dx * b.gap - dz * wander;
          const tz = lz + dz * b.gap + dx * wander;
          const k = 1 - Math.exp(-dt * (fled ? b.keen * 1.6 : b.keen));
          const mx = (tx - b.x) * k;
          const mz = (tz - b.z) * k;
          b.x += mx;
          b.z += mz;
          // face where it's going, or the one ahead when it's barely moving
          const moving = Math.hypot(mx, mz) > dt * 0.05;
          b.h = turn(b.h, moving ? face(mx, mz) : face(-dx, -dz), dt * (moving ? 6 : 2));
          // back into the mother's frame
          const ox = b.x - root.position.x;
          const oz = b.z - root.position.z;
          b.d.position.set(ox * c - oz * s, Math.sin(t * 3 + i) * 0.015, ox * s + oz * c);
          b.d.rotation.y = b.h - root.rotation.y;
          lx = b.x;
          lz = b.z;
        });
        return true;
      },
    };
  }

  /** Red deer come down to drink. Heads up as you come round the bend; gone as you pass. */
  private deer(spot: Spot): Actor {
    const root = this.assets.clone('deer');
    root.position.set(spot.x, spot.y, spot.z);
    const toWater = V(-Math.cos(spot.a) * spot.side, 0, -Math.sin(spot.a) * spot.side);
    root.rotation.y = face(toWater.x, toWater.z);
    this.group.add(root);
    const neck = root.getObjectByName('deer_neck');
    const legs = ['fl', 'fr', 'bl', 'br'].map((k) => root.getObjectByName(`deer_leg_${k}`));
    let bolt = -1;
    let flee = 0;
    return {
      s: spot.s,
      root,
      update: (dt, kayak) => {
        const d = root.position.distanceTo(kayak);
        const wary = d < 20;
        if (bolt < 0 && d < 11) {
          bolt = 0;
          flee = face(-toWater.x + rand(-0.3, 0.3), -toWater.z);
        }
        if (bolt < 0) {
          // drinking, and looking up when something's coming
          if (neck) neck.rotation.z += ((wary ? 0.1 : -0.95) - neck.rotation.z) * Math.min(1, dt * 4);
          return true;
        }
        bolt += dt;
        // wheeling round, and away up the bank, picking up speed
        root.rotation.y = turn(root.rotation.y, flee, dt * 9);
        const pace = Math.min(1, bolt * 2.5);
        const run = Math.sin(bolt * 14);
        legs.forEach((l, i) => l && (l.rotation.z = (i < 2 ? 1 : -1) * run * 0.7 * pace));
        root.position.add(V(Math.cos(root.rotation.y) * dt * 6 * pace, 0, -Math.sin(root.rotation.y) * dt * 6 * pace));
        root.position.y = Math.max(spot.y, this.ground(root.position.x, root.position.z)) + Math.abs(run) * 0.12 * pace;
        if (neck) neck.rotation.z = ease(neck.rotation.z, 0.2, 8, dt);
        return bolt < 4;
      },
    };
  }

  /** Sheep on the meadow, heads down, now and then one says so. */
  private sheep(spot: Spot): Actor {
    const root = new THREE.Group();
    const flock = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
      const s = this.assets.clone('sheep');
      s.position.set(rand(-2, 2), 0, rand(-2, 2));
      s.rotation.y = rand(0, Math.PI * 2);
      root.add(s);
      return { s, head: s.getObjectByName('sheep_head'), seed: Math.random() * 10 };
    });
    root.position.set(spot.x, spot.y, spot.z);
    this.group.add(root);
    let said = false;
    return {
      s: spot.s,
      root,
      update: (dt, kayak) => {
        for (const f of flock) if (f.head) f.head.rotation.z = ease(f.head.rotation.z, Math.sin(this.clock * 0.7 + f.seed) > 0 ? -0.7 : 0, 3, dt);
        if (!said && root.position.distanceTo(kayak) < 10) {
          said = true;
          if (Math.random() < 0.5) this.events.baa?.();
        }
        return true;
      },
    };
  }

  /** In the slow water, a fish jumps now and then. */
  private fish(spot: Spot): Actor {
    const root = this.assets.clone('fish');
    root.visible = false;
    root.scale.setScalar(1.6);
    this.group.add(root);
    let wait = rand(0.5, 5);
    let jump = -1;
    const dir = rand(0, Math.PI * 2);
    return {
      s: spot.s,
      root,
      update: (dt) => {
        if (jump < 0) {
          if ((wait -= dt) < 0) {
            jump = 0;
            root.visible = true;
            this.spray(V(spot.x, spot.y, spot.z), 6, 0.5);
          }
          return true;
        }
        jump += dt;
        const t = jump / 0.7;
        root.position.set(spot.x + Math.cos(dir) * t * 1.2, spot.y + Math.sin(Math.PI * t) * 0.9, spot.z + Math.sin(dir) * t * 1.2);
        root.rotation.set(0, -dir, Math.cos(Math.PI * t) * 0.9);
        if (t >= 1) {
          this.spray(root.position, 8, 0.6);
          root.visible = false;
          jump = -1;
          wait = rand(4, 12);
        }
        return true;
      },
    };
  }

  /** A pair of swans and their cygnets, gliding about the slow water, in no hurry for anybody. */
  private swans(spot: Spot): Actor {
    const root = new THREE.Group();
    const pair = [0, 1].map((i) => {
      const w = this.assets.clone('swan');
      w.scale.setScalar(1.3);
      w.position.set(-i * 1.4, 0, i * 0.7);
      root.add(w);
      return w;
    });
    const brood = Array.from({ length: Math.floor(Math.random() * 4) }, (_, i) => {
      const c = this.assets.clone('cygnet');
      c.position.set(-0.6 - i * 0.45, 0, 0.35 + rand(-0.15, 0.15));
      root.add(c);
      return c;
    });
    root.position.set(spot.x, spot.y, spot.z);
    let heading = face(-Math.sin(spot.a), Math.cos(spot.a)) + rand(-0.5, 0.5);
    root.rotation.y = heading;
    this.group.add(root);
    const bank = V(Math.cos(spot.a) * spot.side, 0, Math.sin(spot.a) * spot.side);
    return {
      s: spot.s,
      root,
      update: (dt, kayak) => {
        const t = this.clock;
        pair.forEach((w, i) => (w.position.y = Math.sin(t * 1.4 + i) * 0.015));
        brood.forEach((c, i) => (c.position.y = Math.sin(t * 2.5 + i) * 0.012));
        // (turning, unhurried, to the bank as you come by)
        if (root.position.distanceTo(kayak) < 10) heading = turn(heading, face(bank.x, bank.z), dt * 0.8);
        root.rotation.y = heading;
        root.position.add(V(Math.cos(heading) * dt * 0.3, 0, -Math.sin(heading) * dt * 0.3));
        return true;
      },
    };
  }

  /**
   * A raven, flying in from off over one bank to wheel high over the river ahead, keeping pace
   * with you for a while; then it's seen enough, and beats off up and away over the trees.
   */
  private raven(s: number): Actor {
    const root = this.assets.clone('raven');
    root.scale.setScalar(2);
    const wings = [root.getObjectByName('raven_wing_l'), root.getObjectByName('raven_wing_r')];
    const radius = rand(5, 10);
    const height = rand(9, 14);
    const spin = (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.6);
    const lead = rand(10, 20); // how far ahead of you its circle stays
    const out = Math.random() < 0.5 ? -1 : 1; // which bank it leaves over
    const from = Math.random() < 0.5 ? -1 : 1; // and which it comes in over
    let come = rand(5.5, 7); // (how far off it still is: coming in, it's the way out played backwards)
    let a = rand(0, Math.PI * 2);
    let at = s + lead + rand(0, 10);
    let life = rand(18, 30);
    let away = 0;
    let flap = 0;
    let beat = 0;
    const last = V();
    this.group.add(root);
    const place = () => {
      const p = this.course.along(at);
      const off = (away + come) ** 2;
      const r = radius + off * 1.2;
      const side = off * 1.5 * (away > 0 ? out : from);
      root.position.set(
        p.x + Math.cos(a) * r + Math.cos(p.a) * side,
        p.y + height + off * 0.8,
        p.z + Math.sin(a) * r + Math.sin(p.a) * side,
      );
    };
    place();
    last.copy(root.position);
    const p = this.course.along(at);
    root.rotation.y = face(-Math.cos(p.a) * from, -Math.sin(p.a) * from); // (headed in over the river)
    const actor: Actor = {
      s: at,
      root,
      update: (dt, kayak) => {
        life -= dt;
        if (life < 0) away += dt;
        come = Math.max(0, come - dt);
        // circling, while the circle drifts along to stay ahead of you (and, leaving, winds out wide)
        a += spin * dt * (1 - Math.min(0.8, away * 0.3));
        at = ease(at, this.kayakS(kayak) + lead + away * 6, 0.6, dt) + dt * away * 4;
        actor.s = at;
        place();
        // facing the way it's actually going
        const dx = root.position.x - last.x;
        const dz = root.position.z - last.z;
        if (dx * dx + dz * dz > 1e-8) root.rotation.y = turn(root.rotation.y, face(dx, dz), dt * 4);
        last.copy(root.position);
        const straight = away > 0 || come > 1;
        root.rotation.z = ease(root.rotation.z, straight ? 0 : -spin * 0.5, 2, dt); // banked into the turn
        // gliding mostly, with a few lazy beats now and then; beating hard to come in and to climb away
        if ((flap -= dt) < -rand(2, 4)) flap = 0.8;
        const want = straight || flap > 0 ? 0.7 : 0;
        beat = ease(beat, want, 5, dt);
        const w = 0.12 + Math.sin(this.clock * (away > 0 ? 14 : 12)) * beat;
        wings.forEach((g, i) => g && (g.rotation.x = (i ? -1 : 1) * w));
        return away < 7;
      },
    };
    return actor;
  }

  private kingfisher(s: number): Actor {
    const root = this.assets.clone('kingfisher');
    root.scale.setScalar(2.2); // a speck otherwise: the river's own flash of blue
    const side = rand(-0.6, 0.6);
    let at = s + 40;
    const wings = [root.getObjectByName('kingfisher_wing_l'), root.getObjectByName('kingfisher_wing_r')];
    this.group.add(root);
    let called = false;
    return {
      s,
      root,
      update: (dt) => {
        at -= dt * 14;
        // its piping call as it comes level with you
        if (!called && at < s + 8) {
          called = true;
          this.events.cry?.('kingfisher');
        }
        const p = this.course.along(at);
        const u = side * p.width / 2;
        root.position.set(p.x + Math.cos(p.a) * u, p.y + 0.9 + Math.sin(at * 0.5) * 0.2, p.z + Math.sin(p.a) * u);
        root.rotation.y = face(-Math.sin(p.a), Math.cos(p.a));
        const beat = Math.sin(this.clock * 40);
        wings.forEach((w, i) => w && (w.rotation.x = (i ? -1 : 1) * beat));
        return at > s - 40;
      },
    };
  }

  private wingedSheep(s: number): Actor {
    const root = this.assets.clone('wingedsheep');
    const p = this.course.at(s + 18);
    const rx = Math.cos(p.a);
    const rz = Math.sin(p.a);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const from = V(p.x - rx * dir * 40, p.y + 9, p.z - rz * dir * 40);
    root.position.copy(from);
    root.rotation.y = face(rx * dir, rz * dir);
    this.group.add(root);
    const wings = [root.getObjectByName('wing_l'), root.getObjectByName('wing_r')];
    let t = 0;
    return {
      s: s + 18,
      root,
      update: (dt) => {
        t += dt;
        root.position.set(from.x + rx * dir * t * 6, from.y + Math.sin(t * 1.3) * 0.6, from.z + rz * dir * t * 6);
        const beat = Math.sin(t * 5);
        wings.forEach((w, i) => w && (w.rotation.x = (i ? -1 : 1) * beat * 0.7));
        if (t > 6 && t - dt <= 6) this.events.baa?.();
        return t < 14;
      },
    };
  }

  /**
   * Beike, running the bank alongside you with his ball in his mouth, barking now and then.
   * After a while something smells more interesting, and he's off up the bank after it, out of
   * sight (never just gone from where he stood).
   */
  private beike(s: number): Actor | null {
    const p = this.course.at(s + 10);
    const side = Math.random() < 0.5 ? -1 : 1;
    const root = this.assets.clone('beike');
    root.scale.multiplyScalar(1.5); // a dog, from this high up, is a speck otherwise
    this.group.add(root);
    const legs = ['fl', 'fr', 'bl', 'br'].map((k) => root.getObjectByName(`beike_leg_${k}`));
    const tail = root.getObjectByName('beike_tail');
    let at = s + 10;
    let t = 0;
    let barkIn = 1.5;
    const run = rand(16, 24);
    this.events.say?.('Beike has spotted you. He’ll keep pace along the bank for a bit.');
    let e = 3;
    let want = 3; // (easing out to it, not hopping, where the water comes close)
    const place = (sPos: number, dt: number) => {
      const q = this.course.along(sPos);
      e = dt ? ease(e, want, 3, dt) : want;
      const u = side * (q.width / 2 + e);
      const x = q.x + Math.cos(q.a) * u;
      const z = q.z + Math.sin(q.a) * u;
      const near = this.course.nearest(x, z);
      if (near.d - near.sample.width / 2 < 1) want = Math.min(Math.max(want, e) + 0.5, 8);
      root.position.set(x, this.ground(x, z), z);
      return q;
    };
    place(at, 0);
    // once he's had enough: off inland and a little downstream, until he's off the screen
    let off: { x: number; z: number; dx: number; dz: number } | null = null;
    let gone = 0;
    const actor: Actor = {
      s,
      root,
      update: (dt, kayak) => {
        t += dt;
        const g = Math.sin(t * 16);
        legs.forEach((l, i) => l && (l.rotation.z = (i % 2 ? 1 : -1) * g * 0.8));
        if (tail) tail.rotation.x = Math.sin(t * 12) * 0.3;
        if (t < run) {
          // keep level with the kayak, a boat's length ahead
          const target = this.course.nearest(kayak.x, kayak.z).sample.s + 4;
          at += Math.max(0, Math.min(9, (target - at) * 2 + 3)) * dt;
          actor.s = at; // (so he isn't tidied away behind you while he's still running)
          const q = this.course.along(at);
          root.rotation.y = turn(root.rotation.y, face(Math.sin(q.a), -Math.cos(q.a)), dt * 8);
          if ((barkIn -= dt) < 0) {
            barkIn = rand(2.5, 5);
            this.events.bark?.();
          }
          place(at, dt);
        } else {
          if (!off) {
            const q = this.course.along(at);
            const ax = Math.cos(q.a) * side;
            const az = Math.sin(q.a) * side;
            const n = Math.hypot(ax + Math.sin(q.a) * 0.6, az - Math.cos(q.a) * 0.6);
            off = { x: root.position.x, z: root.position.z, dx: (ax + Math.sin(q.a) * 0.6) / n, dz: (az - Math.cos(q.a) * 0.6) / n };
          }
          const pace = Math.min(8, 3 + (t - run) * 4);
          off.x += off.dx * pace * dt;
          off.z += off.dz * pace * dt;
          root.position.set(off.x, this.ground(off.x, off.z), off.z);
          root.rotation.y = turn(root.rotation.y, face(off.dx, off.dz), dt * 6);
          actor.s = this.course.nearest(kayak.x, kayak.z).sample.s;
          gone = this.inView(root.position, 1.15) ? 0 : gone + dt;
        }
        root.position.y += Math.abs(g) * 0.08;
        return gone < 0.5 && t < run + 15;
      },
    };
    return actor;
  }

  /**
   * Beike at the take-out, sitting on the bank by the bridge. When he sees you coming he's up,
   * bouncing and barking, and he doesn't stop until you're in.
   */
  private waiter(at: number): Actor {
    const root = this.assets.clone('beike');
    root.scale.multiplyScalar(1.5);
    this.group.add(root);
    const legs = ['fl', 'fr', 'bl', 'br'].map((k) => root.getObjectByName(`beike_leg_${k}`));
    const tail = root.getObjectByName('beike_tail');
    const q = this.course.at(at);
    // whichever bank has room for him
    let x = q.x;
    let z = q.z;
    let side = 1;
    for (const e of [3, 4.5, 6]) {
      const found = [1, -1].find((sd) => {
        const u = sd * (q.width / 2 + e);
        const near = this.course.nearest(q.x + Math.cos(q.a) * u, q.z + Math.sin(q.a) * u);
        return near.d - near.sample.width / 2 > 1.2;
      });
      if (found) {
        side = found;
        const u = side * (q.width / 2 + e);
        x = q.x + Math.cos(q.a) * u;
        z = q.z + Math.sin(q.a) * u;
        break;
      }
    }
    const y = this.ground(x, z);
    root.position.set(x, y, z);
    let t = 0;
    let barkIn = 0;
    return {
      s: at,
      root,
      update: (dt, kayak) => {
        t += dt;
        const d = Math.hypot(kayak.x - x, kayak.z - z);
        const excited = d < 26;
        // looking at you
        root.rotation.y = face(kayak.x - x, kayak.z - z);
        if (excited) {
          const hop = Math.abs(Math.sin(t * 9));
          root.position.y = y + hop * 0.35;
          legs.forEach((l, i) => l && (l.rotation.z = (i % 2 ? 1 : -1) * hop * 0.6));
          if (tail) tail.rotation.x = Math.sin(t * 22) * 0.5;
          if ((barkIn -= dt) < 0) {
            barkIn = rand(0.8, 1.6);
            this.events.bark?.();
          }
        } else {
          root.position.y = y;
          if (tail) tail.rotation.x = Math.sin(t * 5) * 0.2;
        }
        return true;
      },
    };
  }

  // --- the rare ones ----------------------------------------------------------------------------

  /** Somewhere for the rare one at `at`, if the river there suits it (null: try further down). */
  private spawnRare(kind: Rare, at: number, night: number): Actor | null {
    const q = this.course.at(at);
    switch (kind) {
      case 'beaver': return q.speed < 5 && q.rough < 0.35 && q.gorge < 0.4 ? this.beaver(at) : null;
      case 'otter': return q.rough < 0.5 ? this.otter(at) : null;
      case 'moose': return q.speed < 5.5 && q.rough < 0.4 && q.gorge < 0.35 ? this.moose(at) : null;
      case 'bear': return q.gorge < 0.6 ? this.bear(at) : null;
      case 'wolves': return q.gorge < 0.45 ? this.wolves(at, night) : null;
      case 'lynx': return this.lynx(at);
      // (by day, over open water calm enough to see a fish in)
      case 'boar': return q.gorge < 0.45 ? this.boar(at) : null;
      case 'highland': return q.speed < 5 && q.rough < 0.35 && q.gorge < 0.3 ? this.highland(at) : null;
      case 'eagle': return night < 0.4 && q.rough < 0.45 && q.gorge < 0.5 ? this.eagle(at) : null;
      case 'yeti': return q.gorge < 0.7 ? this.yeti(at) : null;
    }
  }

  /**
   * Once it's properly in sight of the kayak, say so, the once: near enough (the view reaches
   * ~20 m ahead), well on screen rather than at its edge, its body not behind a tree or a rock,
   * and for long enough to have seen it (so it's never 'spotted' in a glimpse you couldn't have
   * caught). Any one of a pack will do. Then a ring pulses on the ground round it, so your eye goes
   * there as the word comes up. Until then, as it comes up ahead, now and then a mote or two of
   * light drifts up off it: something at the edge of your eye, catching the light, before you've
   * quite seen what. Returns true the moment it's spotted.
   */
  private spotter(kind: Rare, range = 16) {
    let seen = false;
    let since = -1;
    let glintAt = 0;
    const body = V();
    return (at: THREE.Vector3 | THREE.Vector3[], kayak: THREE.Vector3) => {
      if (seen) return false;
      const all = Array.isArray(at) ? at : [at];
      if (this.clock > glintAt) {
        glintAt = this.clock + rand(0.35, 0.6);
        const near = all.find((p) => p.distanceTo(kayak) < range * 1.8 && this.inView(p));
        if (near) this.motes(near);
      }
      const one = all.find((p) =>
        p.distanceTo(kayak) < range && this.inView(p, 0.8) && !this.hidden(body.set(p.x, p.y + 0.6, p.z)));
      if (!one) {
        since = -1;
        return false;
      }
      if (since < 0) since = this.clock;
      if (this.clock - since < 0.5) return false;
      seen = true;
      spotAnimal(kind, 'Along the river');
      this.events.spotted?.(kind, one.clone());
      this.born.push(this.pulse(one));
      return true;
    };
  }

  /** A mote or two of light drifting slowly up off something, and going out. */
  private motes(at: THREE.Vector3) {
    for (let n = 2 + Math.floor(Math.random() * 2); n > 0; n--)
      this.specks.emit(V(at.x + rand(-0.6, 0.6), at.y + rand(0.3, 1.1), at.z + rand(-0.6, 0.6)), V(rand(-0.1, 0.1), rand(0.35, 0.6), rand(-0.1, 0.1)), MOTE, rand(1.1, 1.6), 2);
  }

  /** A ring of light spreading out on the ground round `at` and fading: here, look. */
  private pulse(at: THREE.Vector3): Actor {
    const mat = new THREE.MeshBasicMaterial({ color: PULSE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const root = new THREE.Group();
    const rings = [0, 0.35].map((delay) => {
      const m = new THREE.Mesh(RING, delay ? mat.clone() : mat);
      m.renderOrder = 4;
      root.add(m);
      return { m, delay };
    });
    // (on the water, for one that's in it: the ground there is the riverbed)
    root.position.set(at.x, Math.max(this.ground(at.x, at.z), at.y) + 0.08, at.z);
    this.group.add(root);
    let t = 0;
    return {
      s: this.kayakS(at),
      root,
      update: (dt) => {
        t += dt;
        for (const { m, delay } of rings) {
          const k = Math.max(0, Math.min(1, (t - delay) / 1.6));
          m.scale.setScalar(1 + k * 2.6);
          (m.material as THREE.MeshBasicMaterial).opacity = k > 0 && k < 1 ? 0.8 * (1 - k) * Math.min(1, k * 8) : 0;
        }
        if (t > 2.1) {
          for (const { m } of rings) (m.material as THREE.Material).dispose();
          return false;
        }
        return true;
      },
    };
  }

  /** A spot on the bank `e` metres back from the water at s, if it isn't another bend of the river. */
  private bank(s: number, side: number, e: number) {
    const q = this.course.at(s);
    const u = side * (q.width / 2 + e);
    const x = q.x + Math.cos(q.a) * u;
    const z = q.z + Math.sin(q.a) * u;
    const near = this.course.nearest(x, z);
    if (e > 0 && near.d - near.sample.width / 2 < e * 0.6) return null;
    return { q, x, z, y: this.ground(x, z) };
  }

  /**
   * Somewhere on the bank near `at`, between `e0` and `e1` metres back from the water, that the
   * camera can see: not under a tree, behind a boulder or round the side of a crag. (The land's
   * scenery gets in the way of anything much past the water's edge.)
   */
  private open(at: number, e0: number, e1: number, height: number) {
    const first = Math.random() < 0.5 ? -1 : 1;
    const up = V();
    for (const ds of [0, 3, -3, 6])
      for (const side of [first, -first])
        for (const e of [e0, (e0 + e1) / 2, e1]) {
          const b = this.bank(at + ds, side, e);
          if (!b) continue;
          if (this.hidden(up.set(b.x, b.y + 0.3, b.z)) || this.hidden(up.set(b.x, b.y + height, b.z))) continue;
          return { ...b, side, s: at + ds };
        }
    return null;
  }

  /** Somewhere in the water near `at`, `e` metres in from the edge, that the camera can see. */
  private shallows(at: number, e: number, height: number) {
    const first = Math.random() < 0.5 ? -1 : 1;
    const up = V();
    for (const ds of [0, 3, -3, 6])
      for (const side of [first, -first]) {
        const q = this.course.at(at + ds);
        const u = side * (q.width / 2 - e);
        const x = q.x + Math.cos(q.a) * u;
        const z = q.z + Math.sin(q.a) * u;
        if (this.hidden(up.set(x, q.y + 0.3, z)) || this.hidden(up.set(x, q.y + height, z))) continue;
        return { q, x, z, side, s: at + ds };
      }
    return null;
  }

  /** How far down the river the kayak is. */
  private kayakS(kayak: THREE.Vector3) {
    return this.course.nearest(kayak.x, kayak.z).sample.s;
  }

  /** A head turned (about its own neck) towards something, as far as a neck goes. */
  private look(head: THREE.Object3D | undefined, root: THREE.Object3D, at: THREE.Vector3, reach = 1, dt = 1) {
    if (!head) return;
    let d = face(at.x - root.position.x, at.z - root.position.z) - root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const want = Math.max(-reach, Math.min(reach, d));
    head.rotation.y += (want - head.rotation.y) * Math.min(1, dt * 3);
  }

  /**
   * A beaver swimming across with a leafy stick in its teeth, from its lodge on the bank. Come too
   * close and it smacks its tail on the water, loud as a shot, and it's gone.
   */
  private beaver(at: number): Actor {
    const q = this.course.at(at);
    const side = Math.random() < 0.5 ? -1 : 1;
    const half = q.width / 2;
    const rx = Math.cos(q.a);
    const rz = Math.sin(q.a);
    const root = new THREE.Group();
    const home = this.assets.clone('lodge');
    home.position.set(q.x + rx * side * (half + 0.6), q.y, q.z + rz * side * (half + 0.6));
    home.rotation.y = rand(0, Math.PI * 2);
    const b = this.assets.clone('beaver');
    b.scale.setScalar(1.6);
    b.position.set(q.x + rx * side * (half - 1.8), q.y, q.z + rz * side * (half - 1.8));
    // across, and a little upstream against the current
    const heading = V(-rx * side, 0, -rz * side).add(V(-Math.sin(q.a) * 0.35, 0, Math.cos(q.a) * 0.35)).normalize();
    b.rotation.y = face(heading.x, heading.z);
    root.add(home, b);
    this.group.add(root);
    const tail = b.getObjectByName('beaver_tail');
    const spot = this.spotter('beaver');
    let swum = 0;
    let slap = -1;
    return {
      s: at,
      root,
      update: (dt, kayak) => {
        spot(b.position, kayak);
        const t = this.clock;
        if (slap < 0) {
          // (stopping short of the far bank, to sit in the shallows and eat)
          if (swum < half * 1.6) {
            b.position.addScaledVector(heading, dt * 0.6);
            swum += dt * 0.6;
            // a V of ripples spreading out behind
            if (Math.random() < dt * 5) this.froth(b.position.clone().addScaledVector(heading, -0.5), rand(1, 2));
          }
          b.position.y = q.y + Math.sin(t * 2) * 0.02;
          if (tail) tail.rotation.z = Math.sin(t * 3) * 0.12;
          if (b.position.distanceTo(kayak) < 9) slap = 0;
          return true;
        }
        slap += dt;
        // the tail up, and down, smack; then under
        if (tail) tail.rotation.z = slap < 0.3 ? -1.4 * (slap / 0.3) : Math.min(0.2, -1.4 + (slap - 0.3) * 20);
        if (slap >= 0.37 && slap - dt < 0.37) {
          const at2 = b.position.clone().addScaledVector(heading, -0.8);
          this.ring(at2, 24, 0.9);
          this.spray(at2, 16, 1.1);
          this.events.slap?.();
        }
        if (slap > 0.4) {
          b.position.y -= dt * 0.9;
          b.rotation.z = Math.max(-0.7, b.rotation.z - dt * 2); // nose down
        }
        b.visible = slap < 1.3;
        return true;
      },
    };
  }

  /**
   * An otter, fooling about in the river: swimming, floating on its back, ducking under and
   * coming up somewhere else. As you come up the river it's porpoising, arcing out of the water
   * and back in with a splash, the thing that catches your eye; seen, it pops its head up, looks
   * right at you and chirps. Come close after that and it's under; it comes up behind, to look.
   */
  private otter(at: number): Actor {
    const q0 = this.course.at(at);
    const o = this.assets.clone('otter');
    o.scale.setScalar(2.3); // (small, otherwise, and low in the water: a dark smudge you'd go right past)
    o.rotation.order = 'YXZ'; // so it rolls over about its own length, whichever way it's heading
    this.group.add(o);
    const u = rand(-0.5, 0.5) * q0.width / 2;
    o.position.set(q0.x + Math.cos(q0.a) * u, q0.y, q0.z + Math.sin(q0.a) * u);
    let heading = face(-Math.sin(q0.a), Math.cos(q0.a)) + rand(-1, 1);
    let mode: 'swim' | 'back' | 'under' | 'watch' | 'leap' = 'swim';
    let timer = rand(1.5, 3);
    let wary = false;
    let gone = 0;
    let seenAt = -1;
    let leap = 0;
    const from = V();
    const spot = this.spotter('otter');
    const water = () => this.course.nearest(o.position.x, o.position.z);
    const under = () => {
      mode = 'under';
      this.spray(o.position, 6, 0.5);
      o.visible = false;
    };
    const jump = () => {
      mode = 'leap';
      leap = 0;
      from.copy(o.position);
      // (out towards the middle, if it's near the edge: never up onto the bank)
      const n = water();
      if (n.d > n.sample.width / 2 - 3) heading = face(n.sample.x - o.position.x, n.sample.z - o.position.z);
      this.spray(o.position, 7, 0.5);
    };
    // (coming into view and not seen yet: showing off, till you look)
    const showing = (d: number) => seenAt < 0 && d < 30 && this.inView(o.position);
    const look = (kayak: THREE.Vector3) => {
      mode = 'watch';
      timer = rand(2.5, 3.5);
      this.spray(o.position, 4, 0.35);
      this.events.cry?.('otter');
      heading = face(kayak.x - o.position.x, kayak.z - o.position.z);
    };
    return {
      s: at,
      root: o,
      update: (dt, kayak) => {
        const t = this.clock;
        timer -= dt;
        const d = o.position.distanceTo(kayak);
        // (only once it's up where you could see it: never 'spotted' while it's under)
        if (o.visible && mode !== 'under' && spot(o.position, kayak)) {
          seenAt = t;
          if (mode !== 'leap') look(kayak);
        }
        const near = water();
        const y = near.sample.y;
        // (it lets you have a good look first)
        if (!wary && seenAt >= 0 && t - seenAt > 2.8 && mode !== 'under' && mode !== 'leap' && d < 8) {
          wary = true;
          under();
          timer = rand(2, 3);
        }
        // turning back from the bank
        if (near.d > near.sample.width / 2 - 1.2) {
          const c = near.sample;
          heading = turn(heading, face(c.x - o.position.x, c.z - o.position.z), dt * 2);
        }
        switch (mode) {
          case 'swim':
            heading += Math.sin(t * 0.7) * dt * 0.6;
            o.position.add(V(Math.cos(heading) * dt * 0.9, 0, -Math.sin(heading) * dt * 0.9));
            o.position.y = y + Math.sin(t * 3) * 0.02;
            o.rotation.x = ease(o.rotation.x, 0, 6, dt);
            o.rotation.z = ease(o.rotation.z, 0, 6, dt);
            if (timer < 0) {
              // coming into view and not seen yet: out of the water, and again, till you look
              const show = showing(d);
              const r = Math.random();
              if (show) jump();
              else if (r < 0.3) mode = 'back';
              else if (r < 0.55) under();
              else if (r < 0.8) jump();
              else heading += rand(-2, 2);
              timer = show ? rand(0.8, 1.6) : rand(2, 4);
            }
            break;
          case 'leap': { // an arc out of the water and back in, nose first
            leap += dt / 0.8;
            const k = Math.min(1, leap);
            o.position.set(from.x + Math.cos(heading) * k * 2.2, y + Math.sin(Math.PI * k) * 0.75, from.z - Math.sin(heading) * k * 2.2);
            o.rotation.x = 0;
            o.rotation.z = Math.cos(Math.PI * k) * 0.8;
            if (k >= 1) {
              this.spray(o.position, 8, 0.55);
              o.rotation.z = 0;
              if (seenAt >= 0 && t - seenAt < 1) look(kayak);
              else {
                mode = 'swim';
                timer = showing(d) ? rand(0.5, 1.2) : rand(2, 4);
              }
            }
            break;
          }
          case 'back': // over on its back, idling on the current
            o.rotation.x += (Math.PI - o.rotation.x) * Math.min(1, dt * 3);
            o.position.y = y + 0.06;
            if (timer < 0 || showing(d)) {
              mode = 'swim';
              timer = rand(0.3, 1);
            }
            break;
          case 'under':
            if (timer < 0) {
              // up again a few metres off, or, if you've gone by, behind you to have a look
              const off = wary ? 6 : rand(2, 4);
              const a = wary ? Math.atan2(o.position.z - kayak.z, o.position.x - kayak.x) : rand(0, Math.PI * 2);
              o.position.add(V(Math.cos(a) * off, 0, Math.sin(a) * off));
              const n = water();
              if (n.d > n.sample.width / 2 - 1) o.position.set(n.sample.x, n.sample.y, n.sample.z);
              o.visible = true;
              o.rotation.x = 0;
              this.spray(o.position, 5, 0.4);
              if (wary) this.events.cry?.('otter'); // up behind you, whistling
              mode = wary ? 'watch' : 'swim';
              timer = wary ? Infinity : rand(0.5, 1.5);
            }
            break;
          case 'watch': // head up out of the water, turned to watch you
            heading = turn(heading, face(kayak.x - o.position.x, kayak.z - o.position.z), dt * 3);
            o.rotation.x = ease(o.rotation.x, 0, 8, dt);
            o.rotation.z += (0.55 - o.rotation.z) * Math.min(1, dt * 5);
            o.position.y = y + 0.14 + Math.sin(t * 2.5) * 0.02;
            if (!wary && timer < 0) {
              mode = 'swim';
              timer = rand(1, 2);
            }
            if (wary && (gone += dt) > 6 && Math.random() < dt) {
              under();
              timer = Infinity;
            }
            break;
        }
        o.rotation.y = heading;
        return true;
      },
    };
  }

  /**
   * A bull moose, knee-deep in the shallows with his head in the water for weed, coming up
   * dripping. He looks at you as you go by, and carries on; then wades off into the trees.
   */
  private moose(at: number): Actor | null {
    const side = Math.random() < 0.5 ? -1 : 1;
    const q = this.course.at(at);
    const u = side * (q.width / 2 - 2.4);
    const m = this.assets.clone('moose');
    m.scale.setScalar(1.8);
    m.position.set(q.x + Math.cos(q.a) * u, q.y - 0.9, q.z + Math.sin(q.a) * u);
    // side on to you, more or less, a little turned to the bank
    const across = V(-Math.cos(q.a) * side, 0, -Math.sin(q.a) * side);
    m.rotation.y = face(-Math.sin(q.a) + across.x * 0.8, Math.cos(q.a) + across.z * 0.8) + Math.PI * (Math.random() < 0.5 ? 0 : 1);
    this.group.add(m);
    const neck = m.getObjectByName('moose_neck');
    const legs = ['fl', 'fr', 'bl', 'br'].map((k) => m.getObjectByName(`moose_leg_${k}`));
    const spot = this.spotter('moose');
    let feeding = rand(1, 3);
    let noticed = false;
    let off = -1;
    const nose = V();
    return {
      s: at,
      root: m,
      update: (dt, kayak) => {
        spot(m.position, kayak);
        const t = this.clock;
        const d = m.position.distanceTo(kayak);
        if (!noticed && d < 20) {
          noticed = true;
          this.events.cry?.('grunt');
        }
        if (off < 0 && noticed && this.kayakS(kayak) > at + 12) off = 0;
        if (neck) {
          feeding -= dt;
          if (feeding < -3.5) feeding = rand(3, 5);
          const down = feeding > 0 && !noticed && off < 0;
          neck.rotation.z += ((down ? -1.15 : 0.05) - neck.rotation.z) * Math.min(1, dt * 1.5);
          if (noticed && off < 0) this.look(neck, m, kayak, 0.8, dt);
          // up out of the water, dripping weed
          if (!down && neck.rotation.z < -0.4 && Math.random() < dt * 30) {
            neck.localToWorld(nose.set(0.85, 0, 0));
            this.drip(nose);
          }
        }
        if (off < 0) return true;
        // off to the trees, unhurried
        off += dt;
        if (neck) neck.rotation.y = ease(neck.rotation.y, 0, 3, dt);
        m.rotation.y = turn(m.rotation.y, face(-across.x, -across.z), dt * 0.8);
        m.position.add(V(Math.cos(m.rotation.y) * dt * 1.2, 0, -Math.sin(m.rotation.y) * dt * 1.2));
        m.position.y = Math.max(q.y - 0.9, Math.min(this.ground(m.position.x, m.position.z), m.position.y + dt * 0.4));
        const g = Math.sin(off * 5);
        legs.forEach((l, i) => l && (l.rotation.z = (i === 0 || i === 3 ? 1 : -1) * g * 0.35));
        return off < 14;
      },
    };
  }

  /**
   * A brown bear knee-deep at the edge of the rapids, fishing: the salmon leap and now and then
   * one doesn't get past. It rears up to look at you, roars, and goes back to its fishing. (Out in
   * the water, not up on the bank: brown on brown, under the trees, it was easy to go right past.)
   */
  private bear(at: number): Actor | null {
    const spot0 = this.shallows(at, 1.3, 2);
    if (!spot0) return null;
    const { q, side } = spot0;
    at = spot0.s;
    const root = new THREE.Group();
    const b = this.assets.clone('bear');
    b.scale.setScalar(1.85);
    b.position.set(spot0.x, q.y - 0.35, spot0.z);
    const toWater = V(-Math.cos(q.a) * side, 0, -Math.sin(q.a) * side);
    const up = V(-Math.sin(q.a), 0, Math.cos(q.a));
    b.rotation.y = face(toWater.x + up.x * 0.5, toWater.z + up.z * 0.5);
    const fish = this.assets.clone('salmon');
    fish.scale.setScalar(1.5);
    fish.visible = false;
    root.add(b, fish);
    this.group.add(root);
    const body = b.getObjectByName('bear_body');
    const head = b.getObjectByName('bear_head');
    const legs = ['fl', 'fr', 'bl', 'br'].map((k) => b.getObjectByName(`bear_leg_${k}`));
    const spot = this.spotter('bear');
    let leapIn = rand(1, 3);
    let leap = -1;
    let caught = -1;
    let rear = -1;
    let off = -1;
    const from = V();
    const to = V();
    return {
      s: at,
      root,
      update: (dt, kayak) => {
        spot(b.position, kayak);
        const d = b.position.distanceTo(kayak);
        // up on its hind legs, to see what you are
        if (rear < 0 && d < 15) rear = 0;
        let lift = 0;
        if (rear >= 0) {
          // (and roars, once it's all the way up)
          if (rear < 0.5 && rear + dt >= 0.5) this.events.growl?.();
          rear += dt;
          lift = rear < 0.6 ? rear / 0.6 : rear < 4.2 ? 1 : Math.max(0, 1 - (rear - 4.2) / 0.6);
          if (lift > 0.9) this.look(head, b, kayak, 0.7, dt);
        }
        // the salmon going up past it: now and then, one is supper
        if (leap < 0 && caught < 0 && rear < 0 && (leapIn -= dt) < 0) {
          leap = 0;
          leapIn = rand(2.5, 5);
          const mouth = b.position.clone().addScaledVector(toWater, 1.95);
          from.copy(mouth).addScaledVector(up, -1.6).setY(q.y);
          to.copy(mouth).addScaledVector(up, 1.6).setY(q.y);
          fish.visible = true;
          this.spray(from, 6, 0.6);
        }
        let lunge = 0;
        if (leap >= 0) {
          leap += dt;
          const k = leap / 0.8;
          fish.position.lerpVectors(from, to, k).setY(q.y + Math.sin(Math.PI * Math.min(1, k)) * 1.3);
          fish.rotation.set(0, face(up.x, up.z), Math.cos(Math.PI * k) * 0.9);
          lunge = Math.sin(Math.PI * Math.min(1, k / 0.6)) * (k < 0.6 ? 1 : 0);
          if (k >= 0.5 && k - dt / 0.8 < 0.5 && head && Math.random() < 0.5) {
            // got it
            head.attach(fish);
            fish.position.set(0.42, -0.08, 0);
            fish.rotation.set(Math.PI / 2, 0, 0);
            leap = -1;
            caught = 0;
            this.spray(to.clone().lerp(from, 0.5), 8, 0.6);
          } else if (k >= 1) {
            this.spray(to, 6, 0.5);
            fish.visible = false;
            leap = -1;
          }
        }
        if (caught >= 0 && (caught += dt) > 3) {
          root.attach(fish);
          fish.visible = false;
          caught = -1;
        }
        if (body) body.rotation.z = lift * 1.05 - lunge * 0.2;
        if (head && lift < 0.5) head.rotation.z = -0.25 - lunge * 0.3;
        // once you're by, it's had enough of the company
        if (off < 0 && rear > 4.8 && this.kayakS(kayak) > at + 6) off = 0;
        if (off < 0) return true;
        off += dt;
        b.rotation.y = turn(b.rotation.y, face(-toWater.x, -toWater.z), dt * 1.5);
        if (off > 1) b.position.add(V(Math.cos(b.rotation.y) * dt * 2, 0, -Math.sin(b.rotation.y) * dt * 2));
        b.position.y = Math.max(q.y - 0.3, this.ground(b.position.x, b.position.z));
        const g = Math.sin(off * 8);
        legs.forEach((l, i) => l && (l.rotation.z = (i === 0 || i === 3 ? 1 : -1) * g * 0.5));
        return off < 10;
      },
    };
  }

  /**
   * A wolf pack on the bank, watching the river; one of them lifts its head and howls. They lope
   * along beside you for a while, and then they're off into the trees.
   */
  private wolves(at: number, night: number): Actor | null {
    // (out on the open edge between the water and the trees, where you'd see them)
    const spot0 = this.open(at, 0.4, 1.6, 1);
    if (!spot0) return null;
    const side = spot0.side;
    at = spot0.s;
    const root = new THREE.Group();
    this.group.add(root);
    const pack = Array.from({ length: 3 + Math.floor(Math.random() * 2) }, (_, i) => {
      const w = this.assets.clone('wolf');
      w.scale.setScalar(1.55);
      root.add(w);
      return {
        w,
        e: 0.4 + (i % 2) * 0.9 + rand(0, 0.4),
        ds: (i - 1.5) * 2.2 + rand(-0.5, 0.5),
        head: w.getObjectByName('wolf_head'),
        tail: w.getObjectByName('wolf_tail'),
        legs: ['fl', 'fr', 'bl', 'br'].map((k) => w.getObjectByName(`wolf_leg_${k}`)),
        seed: Math.random() * 10,
        out: 0,
      };
    });
    let along = at;
    let mode: 'watch' | 'run' | 'away' = 'watch';
    let t = 0;
    let runFor = rand(7, 11);
    // (the lead howls the moment they've seen you and you them: not before you could have)
    let howl = -1;
    const spot = this.spotter('wolves');
    const place = (f: (typeof pack)[number]) => {
      const q = this.course.along(along + f.ds);
      let e = f.e + f.out;
      let x = 0;
      let z = 0;
      // (further back from the water where another bend of the river comes close)
      for (let n = 0; n < 6; n++, e += 1.5) {
        const u = side * (q.width / 2 + e);
        x = q.x + Math.cos(q.a) * u;
        z = q.z + Math.sin(q.a) * u;
        const near = this.course.nearest(x, z);
        if (near.d - near.sample.width / 2 > e * 0.6) break;
      }
      f.w.position.set(x, this.ground(x, z), z);
      return q;
    };
    const up = V();
    for (const f of pack) {
      let q = place(f);
      // (one that's stood under a tree or behind a rock comes down to the open edge of the water)
      if (this.hidden(up.copy(f.w.position).setY(f.w.position.y + 0.6))) {
        f.e = 0.3;
        q = place(f);
      }
      f.w.rotation.y = face(-Math.cos(q.a) * side, -Math.sin(q.a) * side) + rand(-0.6, 0.6);
    }
    const where = pack.map((f) => f.w.position);
    return {
      s: at,
      root,
      update: (dt, kayak) => {
        t += dt;
        const lead = pack[0].w;
        if (spot(where, kayak)) howl = 0.25;
        if (howl >= 0 && (howl -= dt) < 0) {
          howl = -2; // howling: the lead's head goes back
          this.events.howl?.();
        }
        const howling = howl < -1 && howl > -5.5;
        if (mode === 'watch') {
          pack.forEach((f, i) => {
            if (i === 0 && howl < -1 && howl > -5.5) {
              howl -= dt;
              if (f.head) f.head.rotation.z += (1.0 - f.head.rotation.z) * Math.min(1, dt * 4);
            } else {
              if (f.head) f.head.rotation.z = ease(f.head.rotation.z, 0, 6, dt);
              this.look(f.head, f.w, kayak, 0.9, dt);
            }
            if (f.tail) f.tail.rotation.y = Math.sin(t * 2 + f.seed) * 0.15;
          });
          // (off after you once you're close, but not in the middle of a howl)
          if (lead.position.distanceTo(kayak) < 15 && !howling && howl < 0) mode = 'run';
          return true;
        }
        if (mode === 'run') {
          runFor -= dt;
          const target = this.kayakS(kayak) + 3;
          along += Math.max(0, Math.min(9, (target - along) * 2 + 3)) * dt;
          if (runFor < 0) mode = 'away';
        } else {
          for (const f of pack) f.out += dt * 5;
          along += dt * 2;
        }
        for (const f of pack) {
          const q = place(f);
          const run = Math.sin(t * 13 + f.seed);
          f.legs.forEach((l, i) => l && (l.rotation.z = (i < 2 ? 1 : -1) * run * 0.7));
          f.w.position.y += Math.abs(run) * 0.06;
          const dx = Math.sin(q.a) + (mode === 'away' ? Math.cos(q.a) * side * 2 : 0);
          const dz = -Math.cos(q.a) + (mode === 'away' ? Math.sin(q.a) * side * 2 : 0);
          f.w.rotation.y = turn(f.w.rotation.y, face(dx, dz), dt * 4);
          if (f.head) {
            f.head.rotation.z = ease(f.head.rotation.z, 0, 6, dt);
            f.head.rotation.y = ease(f.head.rotation.y, 0, 6, dt);
          }
          if (f.tail) f.tail.rotation.y = Math.sin(t * 6 + f.seed) * 0.2;
        }
        return pack[0].out < 30;
      },
    };
  }

  /**
   * A lynx on the bank, pacing slowly along the water's edge (the movement's what catches your
   * eye: stock still, it's just a tawny stone). Seen, it freezes, head round to stare you out, and
   * spits; then it's away into the trees in great bounds, as if it had never been.
   */
  private lynx(at: number): Actor | null {
    const spot0 = this.open(at, 0.5, 2, 1.2);
    if (!spot0) return null;
    const { q, side } = spot0;
    at = spot0.s;
    const l = this.assets.clone('lynx');
    l.scale.setScalar(2); // (as big as a lynx is, it's all leg: at 1:1 it's gone in the grass)
    l.position.set(spot0.x, spot0.y, spot0.z);
    const toWater = V(-Math.cos(q.a) * side, 0, -Math.sin(q.a) * side);
    const up = V(-Math.sin(q.a), 0, Math.cos(q.a));
    this.group.add(l);
    const head = l.getObjectByName('lynx_head');
    const legs = ['fl', 'fr', 'bl', 'br'].map((k) => l.getObjectByName(`lynx_leg_${k}`));
    const spot = this.spotter('lynx');
    const home = V(spot0.x, spot0.y, spot0.z);
    let pace = rand(-1.5, 1.5); // along the bank from where it was put (m)
    let dir = Math.random() < 0.5 ? -1 : 1;
    let stop = rand(1, 2.5);
    let seenAt = -1;
    let off = -1;
    let walk = 0;
    return {
      s: at,
      root: l,
      update: (dt, kayak) => {
        const t = this.clock;
        if (spot(l.position, kayak)) {
          seenAt = t;
          this.events.cry?.('lynx');
        }
        const d = l.position.distanceTo(kayak);
        if (off < 0) {
          const seen = seenAt >= 0;
          if (!seen) {
            // up and down the edge of the water, stopping now and then to look
            stop -= dt;
            const moving = stop < 0;
            if (stop < -rand(2, 3.5)) stop = rand(0.8, 1.8);
            if (moving) {
              pace += dir * dt * 0.8;
              if (Math.abs(pace) > 2) dir = -Math.sign(pace);
              walk += dt * 6;
            }
            const x = home.x + up.x * pace;
            const z = home.z + up.z * pace;
            l.position.set(x, this.ground(x, z), z);
            const want = moving ? face(up.x * dir + toWater.x * 0.2, up.z * dir + toWater.z * 0.2) : face(toWater.x - up.x * 0.4, toWater.z - up.z * 0.4);
            l.rotation.y = turn(l.rotation.y, want, dt * 4);
            legs.forEach((k, i) => k && (k.rotation.z = moving ? (i === 0 || i === 3 ? 1 : -1) * Math.sin(walk) * 0.35 : ease(k.rotation.z, 0, 8, dt)));
            this.look(head, l, kayak, 1.3, dt);
          } else {
            // stock still, and staring you out
            legs.forEach((k) => k && (k.rotation.z = ease(k.rotation.z, 0, 10, dt)));
            l.rotation.y = turn(l.rotation.y, face(kayak.x - l.position.x, kayak.z - l.position.z), dt * 2);
            this.look(head, l, kayak, 1.3, dt * 3);
          }
          if ((seen && t - seenAt > 2) || d < 5 || this.kayakS(kayak) > at + 4) off = 0;
          return true;
        }
        // away, in great bounds
        off += dt;
        if (head) head.rotation.y = ease(head.rotation.y, 0, 6, dt);
        l.rotation.y = turn(l.rotation.y, face(-toWater.x, -toWater.z), dt * 6);
        const b = (off * 2.2) % 1; // one bound in each 0.45 s
        if (off > 0.2) l.position.add(V(Math.cos(l.rotation.y) * dt * 5, 0, -Math.sin(l.rotation.y) * dt * 5));
        l.position.y = this.ground(l.position.x, l.position.z) + (off > 0.2 ? Math.sin(Math.PI * b) * 0.7 : 0);
        const g = Math.cos(Math.PI * b);
        // (front legs reaching out on the way up, the back ones kicking off)
        legs.forEach((k, i) => k && (k.rotation.z = (i < 2 ? 1 : -1) * g * 0.7));
        return off < 5;
      },
    };
  }

  /**
   * A white-tailed eagle, sat on top of a dead tree at the water's edge, watching you come (a
   * pale head turning to follow you). Seen, it calls, drops off the tree on wings like barn doors,
   * glides down over the river ahead of you and takes a fish off the top of the water with a
   * splash, then labours away low over the far bank with it, and up.
   */
  private eagle(at: number): Actor | null {
    const spot0 = this.open(at, 0.4, 1.4, 6);
    if (!spot0) return null;
    const { q, side } = spot0;
    at = spot0.s;
    const root = new THREE.Group();
    const snag = this.assets.clone('snag_0');
    snag.position.set(spot0.x, spot0.y - 0.1, spot0.z);
    snag.rotation.y = rand(0, Math.PI * 2);
    const e = this.assets.clone('eagle');
    e.scale.setScalar(1.8); // (a big bird, but still only a speck on top of a tree from up here at 1:1)
    const fish = this.assets.clone('fish');
    fish.scale.setScalar(1.6);
    fish.position.set(0.08, 0.02, 0);
    fish.visible = false;
    e.add(fish);
    root.add(snag, e);
    this.group.add(root);
    snag.updateMatrixWorld(true);
    const x = this.assets.extras.get('snag_0') ?? {};
    const perch = snag.localToWorld(V(x.top_x ?? 0, (x.top_z ?? 5) + 0.25, -(x.top_y ?? 0)));
    e.position.copy(perch);
    const toWater = V(-Math.cos(q.a) * side, 0, -Math.sin(q.a) * side);
    const down = V(Math.sin(q.a), 0, -Math.cos(q.a));
    e.rotation.y = face(toWater.x - down.x * 0.6, toWater.z - down.z * 0.6); // out over the water, and up it
    const head = e.getObjectByName('eagle_head');
    const wings = [e.getObjectByName('eagle_wing_l'), e.getObjectByName('eagle_wing_r')];
    const legs = [e.getObjectByName('eagle_leg_l'), e.getObjectByName('eagle_leg_r')];
    /** Wings folded along its back (1) or spread (0). */
    const fold = (k: number, raise = 0) => wings.forEach((w, i) => {
      if (!w) return;
      const s = i ? -1 : 1;
      w.rotation.set(-s * 0.15 * k + s * raise, s * 1.5 * k, 0);
      w.scale.z = 1 - k * 0.5;
    });
    fold(1);
    const spot = this.spotter('eagle');
    let seenAt = -1;
    let fly = -1; // how long since it dropped off the tree
    let caught = false;
    const from = V();
    const bend = V();
    const to = V();
    const was = V();
    let dive = 1.8; // how long the glide down takes (s)
    let lastK = -1;
    let pace = 0; // how fast you're coming down the river (m/s), to meet you rather than end up behind you
    return {
      s: at,
      root,
      update: (dt, kayak) => {
        const t = this.clock;
        if (spot(e.position, kayak)) {
          seenAt = t;
          this.events.cry?.('eagle');
        }
        const d = e.position.distanceTo(kayak);
        if (fly < 0) {
          const k = this.kayakS(kayak);
          if (lastK >= 0 && dt > 0) pace = ease(pace, Math.max(0, (k - lastK) / dt), 4, dt);
          lastK = k;
          this.look(head, e, kayak, 1.4, dt);
          // (and now and then a shrug of the wings, settling them)
          const shrug = Math.max(0, Math.sin(t * 1.3 + at) - 0.93) * 6;
          fold(1, shrug * 0.3);
          if (!((seenAt >= 0 && t - seenAt > 1) || d < 9 || k > at)) return true;
          // off it goes: down to the water a little ahead of you, on the tree's side of the river
          fly = 0;
          from.copy(e.position);
          // (where you'll be by the time it's down, and a little on: the glide takes a second or two)
          dive = 1.6;
          const w = this.course.at(Math.max(k + 8 + pace * dive, at + 3));
          const u = side * w.width * rand(0.05, 0.2);
          to.set(w.x + Math.cos(w.a) * u, w.y + 0.1, w.z + Math.sin(w.a) * u);
          bend.lerpVectors(from, to, 0.35).setY(to.y + 1.6);
          dive = Math.max(1.2, Math.min(2, from.distanceTo(to) / 9));
          if (seenAt < 0) this.events.cry?.('eagle');
        }
        fly += dt;
        was.copy(e.position);
        if (fly < dive) {
          // the glide down: wings out in the first moment, then held, then up and back as the
          // talons swing forward for the fish
          const k = fly / dive;
          const a = 1 - k;
          e.position.set(0, 0, 0).addScaledVector(from, a * a).addScaledVector(bend, 2 * a * k).addScaledVector(to, k * k);
          const late = Math.max(0, (k - 0.7) / 0.3);
          fold(Math.max(0, 1 - fly / 0.35), 0.12 + late * 0.8);
          legs.forEach((l) => l && (l.rotation.z = late * 1.1));
          if (head) head.rotation.y = ease(head.rotation.y, 0, 6, dt);
        } else {
          if (!caught) {
            caught = true;
            fish.visible = true;
            this.spray(to, 14, 0.9);
          }
          // and away with it: heavy beats, low over the water and the far bank, climbing
          const c = fly - dive;
          const beat = Math.sin(c * 7.5);
          fold(0);
          wings.forEach((w, i) => w && (w.rotation.x = (i ? -1 : 1) * beat * 0.85));
          legs.forEach((l) => l && (l.rotation.z = ease(l.rotation.z, 0.2, 3, dt)));
          const heading = V(toWater.x * 0.8 + down.x, 0, toWater.z * 0.8 + down.z).normalize(); // (across, and on down the river)
          e.position.addScaledVector(heading, dt * Math.min(6, 2.5 + c * 1.5));
          e.position.y += dt * (0.5 + Math.min(2, c * 0.6)) + beat * dt * 0.4;
          if (c < 0.4 && Math.random() < dt * 20) this.specks.emit(e.position.clone(), V(rand(-0.5, 0.5), rand(-0.5, 0.2), rand(-0.5, 0.5)), WHITE, rand(0.4, 0.7)); // drips off the fish
          if (c > 9) e.visible = false; // (the tree stays: it was only ever a tree)
        }
        // facing the way it's going, the nose down on the glide and up on the climb
        const dx = e.position.x - was.x;
        const dz = e.position.z - was.z;
        const h = Math.hypot(dx, dz);
        if (h > 1e-4) {
          e.rotation.y = turn(e.rotation.y, face(dx, dz), dt * 8);
          e.rotation.z = ease(e.rotation.z, Math.max(-0.6, Math.min(0.5, Math.atan2(e.position.y - was.y, h))), 6, dt);
        }
        return true;
      },
    };
  }

  /**
   * Wild boar at the edge of the trees, rooting up the bank: in spring and summer a sow with her
   * piglets (striped like humbugs, milling round her feet), the rest of the year two or three
   * grown ones. Seen, the sow's head comes up and she snorts, and they all stand stock still; come
   * any nearer and they're off into the trees at a trot, the piglets strung out behind.
   */
  private boar(at: number): Actor | null {
    const spot0 = this.open(at, 0.8, 2.2, 1.2);
    if (!spot0) return null;
    const { q, side } = spot0;
    at = spot0.s;
    const root = new THREE.Group();
    this.group.add(root);
    const toWater = V(-Math.cos(q.a) * side, 0, -Math.sin(q.a) * side);
    const up = V(-Math.sin(q.a), 0, Math.cos(q.a));
    const young = season.name === 'spring' || season.name === 'summer';
    // (at 1:1 they're lost in the grass, like the lynx)
    const herd = Array.from({ length: young ? 1 + 3 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 2) }, (_, i) => {
      const piglet = young && i > 0;
      const o = this.assets.clone(piglet ? 'piglet' : 'boar');
      o.scale.setScalar(piglet ? 1.7 : i ? rand(1.3, 1.5) : 1.6);
      const along = i ? rand(-1.6, 1.6) : 0;
      const back = i ? rand(-0.4, 0.8) : 0;
      const x = spot0.x + up.x * along - toWater.x * back;
      const z = spot0.z + up.z * along - toWater.z * back;
      o.position.set(x, this.ground(x, z), z);
      o.rotation.y = face(toWater.x + up.x * rand(-1.5, 1.5), toWater.z + up.z * rand(-1.5, 1.5));
      root.add(o);
      const name = piglet ? 'piglet' : 'boar';
      return {
        o,
        piglet,
        head: o.getObjectByName('boar_head'),
        legs: ['fl', 'fr', 'bl', 'br'].map((k) => o.getObjectByName(`${name}_leg_${k}`)),
        seed: rand(0, 10),
        mill: rand(0, 2), // (a piglet's next scamper)
        dir: V(),
      };
    });
    const spot = this.spotter('boar');
    const at3 = herd.map((h) => h.o.position);
    let seenAt = -1;
    let off = -1;
    return {
      s: at,
      root,
      update: (dt, kayak) => {
        const t = this.clock;
        if (spot(at3, kayak)) {
          seenAt = t;
          this.events.cry?.('boar');
        }
        const lead = herd[0];
        const d = lead.o.position.distanceTo(kayak);
        if (off < 0 && ((seenAt >= 0 && t - seenAt > 2.2) || d < 8 || this.kayakS(kayak) > at + 3)) off = 0;
        if (off < 0) {
          const still = seenAt >= 0;
          for (const h of herd) {
            if (h.head) {
              // rooting: snout down and shoving, and a clod flicked up now and then; up, when you're seen
              const want = still ? 0.15 : -0.55 + Math.sin(t * 7 + h.seed) * 0.12;
              h.head.rotation.z = ease(h.head.rotation.z, want, still ? 8 : 5, dt);
              if (still) this.look(h.head, h.o, kayak, 0.6, dt);
              else if (Math.random() < dt * 1.5) {
                const nose = h.head.localToWorld(V(0.45, -0.2, 0));
                this.specks.emit(nose, V(rand(-0.4, 0.4), rand(0.8, 1.4), rand(-0.4, 0.4)), EARTH, rand(0.4, 0.7));
              }
            }
            if (h.piglet && !still) {
              // piglets never stand still for long: a scamper round her feet, and a stop
              if ((h.mill -= dt) < 0) {
                h.mill = rand(0.6, 1.8);
                h.dir.set(lead.o.position.x - h.o.position.x + rand(-1.4, 1.4), 0, lead.o.position.z - h.o.position.z + rand(-1.4, 1.4));
                if (Math.random() < 0.35) h.dir.set(0, 0, 0);
              }
              const moving = h.dir.lengthSq() > 0.01 && h.mill > 0.3;
              if (moving) {
                h.o.rotation.y = turn(h.o.rotation.y, face(h.dir.x, h.dir.z), dt * 8);
                h.o.position.add(V(Math.cos(h.o.rotation.y) * dt * 1.2, 0, -Math.sin(h.o.rotation.y) * dt * 1.2));
                h.o.position.y = this.ground(h.o.position.x, h.o.position.z);
              }
              const g = moving ? Math.sin(t * 22 + h.seed) : 0;
              h.legs.forEach((l, i) => l && (l.rotation.z = (i === 0 || i === 3 ? 1 : -1) * g * 0.6));
            } else h.legs.forEach((l) => l && (l.rotation.z = ease(l.rotation.z, 0, 10, dt)));
          }
          return true;
        }
        // off into the trees at a trot, the others following on
        off += dt;
        const away = V(-toWater.x + up.x * 0.3, 0, -toWater.z + up.z * 0.3);
        herd.forEach((h, i) => {
          const go = off > i * 0.12;
          if (h.head) h.head.rotation.z = ease(h.head.rotation.z, 0.05, 6, dt);
          if (!go) return;
          const ahead = i ? herd[i - 1].o.position : null;
          const dx = ahead ? ahead.x - h.o.position.x : away.x;
          const dz = ahead ? ahead.z - h.o.position.z : away.z;
          h.o.rotation.y = turn(h.o.rotation.y, face(dx, dz), dt * 6);
          const speed = h.piglet ? 3.4 : 3;
          h.o.position.add(V(Math.cos(h.o.rotation.y) * dt * speed, 0, -Math.sin(h.o.rotation.y) * dt * speed));
          const g = Math.sin(off * (h.piglet ? 24 : 14) + h.seed);
          h.o.position.y = this.ground(h.o.position.x, h.o.position.z) + Math.abs(g) * (h.piglet ? 0.05 : 0.07);
          h.legs.forEach((l, k) => l && (l.rotation.z = (k === 0 || k === 3 ? 1 : -1) * g * 0.55));
        });
        return off < 7;
      },
    };
  }

  /**
   * A Highland cow, ginger and shaggy: grazing the bank, or in the warm months stood knee-deep
   * in the river to cool off. It lifts its head as you come by, has a long look at you through
   * its fringe, and moos; then goes back to what it was doing. It isn't going anywhere.
   */
  private highland(at: number): Actor | null {
    const wading = (season.name === 'summer' || season.name === 'spring') && Math.random() < 0.6;
    const spot0 = wading ? this.shallows(at, 1.6, 1.8) : this.open(at, 0.4, 1.6, 1.8);
    if (!spot0) return null;
    const { q, side } = spot0;
    at = spot0.s;
    const c = this.assets.clone('highland');
    c.scale.setScalar(1.35);
    const y0 = wading ? q.y - 0.45 : this.ground(spot0.x, spot0.z);
    c.position.set(spot0.x, y0, spot0.z);
    // side on to the river, more or less, whichever way
    const along = V(-Math.sin(q.a), 0, Math.cos(q.a)).multiplyScalar(Math.random() < 0.5 ? -1 : 1);
    const toWater = V(-Math.cos(q.a) * side, 0, -Math.sin(q.a) * side);
    c.rotation.y = face(along.x + toWater.x * 0.4, along.z + toWater.z * 0.4);
    this.group.add(c);
    const head = c.getObjectByName('highland_head');
    const tail = c.getObjectByName('highland_tail');
    const spot = this.spotter('highland');
    let lookAt = -1; // when it lifted its head to you
    let chew = 0;
    const seed = rand(0, 10);
    const nose = V();
    return {
      s: at,
      root: c,
      update: (dt, kayak) => {
        const t = this.clock;
        spot(c.position, kayak);
        const d = c.position.distanceTo(kayak);
        if (lookAt < 0 && d < 17) {
          lookAt = t;
          this.events.cry?.('moo');
        }
        // tail going all the while, for the flies
        if (tail) tail.rotation.x = Math.sin(t * 2.3 + seed) * 0.35 + Math.sin(t * 5.1) * 0.08;
        if (!head) return true;
        const looking = lookAt >= 0 && t - lookAt < 7;
        if (looking) {
          head.rotation.z = ease(head.rotation.z, 0.1, 3, dt);
          this.look(head, c, kayak, 0.9, dt * 0.6);
          // chewing on it, slowly
          chew += dt;
          head.rotation.x = Math.sin(chew * 4) * 0.04;
        } else {
          // head down to the grass (or the water), a mouthful at a time
          head.rotation.y = ease(head.rotation.y, 0, 2, dt);
          const bite = Math.sin(t * 0.9 + seed) > -0.6;
          head.rotation.z = ease(head.rotation.z, bite ? (wading ? -0.75 : -0.95) : -0.2, 2, dt);
          head.rotation.x = ease(head.rotation.x, 0, 4, dt);
          if (wading && !bite && head.rotation.z < -0.5 && Math.random() < dt * 20) {
            head.localToWorld(nose.set(0.5, -0.2, 0));
            this.drip(nose);
          }
        }
        return true;
      },
    };
  }

  /**
   * The yeti, if it is one: far back at the edge of the trees, standing there looking at you. As you
   * come into sight it draws itself up, throws both arms over its head and calls out across the
   * water. By the time you've looked twice it's turned and gone into the snow, and nobody will
   * believe you.
   */
  private yeti(at: number): Actor | null {
    // at the edge of the trees, where you can just see it, and then gone into them
    const spot0 = this.open(at, 2, 4.5, 2.6);
    if (!spot0) return null;
    const { q, side } = spot0;
    at = spot0.s;
    const y = this.assets.clone('yeti');
    y.scale.setScalar(1.25); // (seen from up here, just the top of a head and a pair of shoulders otherwise)
    y.position.set(spot0.x, spot0.y, spot0.z);
    const toWater = V(-Math.cos(q.a) * side, 0, -Math.sin(q.a) * side);
    y.rotation.y = face(toWater.x, toWater.z);
    this.group.add(y);
    const head = y.getObjectByName('yeti_head');
    const arms = [y.getObjectByName('yeti_arm_l'), y.getObjectByName('yeti_arm_r')];
    const legs = [y.getObjectByName('yeti_leg_l'), y.getObjectByName('yeti_leg_r')];
    const spot = this.spotter('yeti');
    const base = spot0.y;
    let off = -1;
    let hail = -1; // how long since it put its arms up and called (-1: it hasn't yet)
    let t = 0;
    return {
      s: at,
      root: y,
      update: (dt, kayak) => {
        t += dt;
        spot(y.position, kayak);
        const d = y.position.distanceTo(kayak);
        if (off < 0) {
          this.look(head, y, kayak, 0.8, dt);
          // as soon as you could see it, up go both arms over its head and it calls across the water
          if (hail < 0 && ((d < 30 && this.inView(y.position)) || d < 13)) {
            hail = 0;
            this.events.cry?.('yeti');
          }
          const up = hail >= 0 && hail < 3.2 ? 1 : 0;
          if (hail >= 0) hail += dt;
          arms.forEach((a, i) => {
            if (!a) return;
            // overhead and waving side to side, or hanging and swaying a little
            a.rotation.z = ease(a.rotation.z, up ? 2.7 + Math.sin(t * 7 + i * Math.PI) * 0.25 : Math.sin(t * 1.2 + i) * 0.05, up ? 7 : 3, dt);
            a.rotation.x = ease(a.rotation.x, up * (i ? 1 : -1) * 0.35, 5, dt);
          });
          if (head) head.rotation.z = ease(head.rotation.z, up * 0.35, 5, dt); // (head back for the call)
          // up on its toes with each wave, and a stamp of snow off its feet
          y.position.y = base + up * Math.abs(Math.sin(t * 3.5)) * 0.12;
          if (up && Math.random() < dt * 5) this.specks.emit(y.position.clone().add(V(rand(-0.4, 0.4), 0.1, rand(-0.4, 0.4))), V(rand(-0.3, 0.3), rand(0.4, 1), rand(-0.3, 0.3)), WHITE, rand(0.8, 1.5), 2);
          // it lets you get this close, once it's had its say, and no closer
          if (d < 13 && hail > 3.8) off = 0;
          return true;
        }
        off += dt;
        if (head) head.rotation.y = ease(head.rotation.y, 0, 3, dt);
        if (head) head.rotation.z = ease(head.rotation.z, 0, 3, dt);
        arms.forEach((a) => a && (a.rotation.x = ease(a.rotation.x, 0, 5, dt)));
        y.rotation.y = turn(y.rotation.y, face(-toWater.x + Math.sin(q.a) * 0.4, -toWater.z - Math.cos(q.a) * 0.4), dt * 2);
        if (off > 0.6) y.position.add(V(Math.cos(y.rotation.y) * dt * 2.6, 0, -Math.sin(y.rotation.y) * dt * 2.6));
        const g = Math.sin(off * 4.5);
        y.position.y = this.ground(y.position.x, y.position.z) + Math.abs(g) * 0.08;
        legs.forEach((l, i) => l && (l.rotation.z = (i ? 1 : -1) * g * 0.5));
        arms.forEach((a, i) => a && (a.rotation.z = (i ? -1 : 1) * g * 0.45));
        // (and a puff of snow off its feet, the last you'll see of it)
        if (Math.random() < dt * 6) this.specks.emit(y.position.clone().add(V(rand(-0.4, 0.4), 0.1, rand(-0.4, 0.4))), V(rand(-0.3, 0.3), rand(0.4, 1), rand(-0.3, 0.3)), WHITE, rand(0.8, 1.5), 2);
        return off < 9;
      },
    };
  }
}
