import * as THREE from 'three';
import { spotAnimal, type Animal } from '../sketchbook';
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
/** An angle eased a share `k` of the way to another, the short way round. */
const turn = (from: number, to: number, k: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * Math.min(1, k);
/** A value eased towards another at `rate` per second, however long the frame. */
const ease = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-dt * rate));

export type Cry = 'heron' | 'kingfisher' | 'otter' | 'grunt' | 'yeti' | 'raven';

export interface WildlifeEvents {
  /** Something happened worth a line on screen. */
  say?(text: string): void;
  croak?(): void;
  quack?(): void;
  baa?(): void;
  bark?(): void;
  /** One of the rare ones, seen for the first time this run. */
  spotted?(kind: Rare): void;
  /** A heron put up off the shallows, a kingfisher going by, an otter, a moose, and whatever that was. */
  cry?(kind: Cry): void;
  /** A beaver's tail smacked on the water; wolves howling; a bear's huff. */
  slap?(): void;
  howl?(): void;
  huff?(): void;
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
const EMBERS = ['#ffd35a', '#ff9a3c', '#ffb35a'].map((c) => new THREE.Color(c));
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
  inView: (at: THREE.Vector3) => boolean = () => true;
  private actors: Actor[] = [];
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
    this.specks.clear();
    this.froths.clear();
    this.fireflies.clear();
    this.kingfisherIn = rand(12, 30);
    this.frogIn = rand(4, 10);
    this.sheepIn = rand(90, 200);
    this.ravensIn = rand(6, 14);
    this.storm = 0;
    this.beikeDone = false;
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
    if (!this.beikeDone && s > 200 && s < this.course.finish - 250 && p.clear > 0.6 && p.gorge < 0.3 && night < 0.5) {
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
    const brood = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, i) => {
      const d = this.assets.clone('duckling');
      d.position.set(-0.5 - i * 0.38, 0, rand(-0.12, 0.12));
      root.add(d);
      return d;
    });
    root.position.set(spot.x, spot.y, spot.z);
    const up = face(-Math.sin(spot.a), Math.cos(spot.a)); // paddling upstream
    root.rotation.y = up;
    this.group.add(root);
    let fled = false;
    const bank = V(Math.cos(spot.a) * spot.side, 0, Math.sin(spot.a) * spot.side);
    return {
      s: spot.s,
      root,
      update: (dt, kayak) => {
        const t = this.clock;
        mum.position.y = Math.sin(t * 2.2) * 0.02;
        brood.forEach((d, i) => (d.position.y = Math.sin(t * 3 + i) * 0.015));
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
   * After a while something smells more interesting, and he stops to sit and watch you go.
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
    return {
      s,
      root,
      update: (dt, kayak) => {
        t += dt;
        const running = t < run;
        const q = this.course.along(at);
        if (running) {
          // keep level with the kayak, a boat's length ahead
          const target = this.course.nearest(kayak.x, kayak.z).sample.s + 4;
          at += Math.max(0, Math.min(9, (target - at) * 2 + 3)) * dt;
          const g = Math.sin(t * 16);
          legs.forEach((l, i) => l && (l.rotation.z = (i % 2 ? 1 : -1) * g * 0.8));
          root.rotation.y = turn(root.rotation.y, face(Math.sin(q.a), -Math.cos(q.a)), dt * 8);
          if ((barkIn -= dt) < 0) {
            barkIn = rand(2.5, 5);
            this.events.bark?.();
          }
        } else {
          legs.forEach((l) => l && (l.rotation.z = ease(l.rotation.z, 0, 6, dt)));
          root.rotation.y = turn(root.rotation.y, face(-Math.cos(q.a) * side, -Math.sin(q.a) * side), dt * 3);
        }
        if (tail) tail.rotation.x = Math.sin(t * 12) * 0.3;
        place(at, dt);
        if (running) root.position.y += Math.abs(Math.sin(t * 16)) * 0.08;
        return !running ? t < run + 20 : true;
      },
    };
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
      case 'yeti': return q.gorge < 0.7 ? this.yeti(at) : null;
    }
  }

  /** Once it's in sight of the kayak (on screen: the view reaches ~20 m ahead), say so, the once. */
  private spotter(kind: Rare, range = 17) {
    let seen = false;
    return (at: THREE.Vector3, kayak: THREE.Vector3) => {
      if (seen || at.distanceTo(kayak) > range || !this.inView(at) || this.hidden(at)) return;
      seen = true;
      spotAnimal(kind, 'Along the river');
      this.events.spotted?.(kind);
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
   * coming up somewhere else. Come close and it's under; it comes up behind, head up, to look.
   */
  private otter(at: number): Actor {
    const q0 = this.course.at(at);
    const o = this.assets.clone('otter');
    o.scale.setScalar(1.8);
    o.rotation.order = 'YXZ'; // so it rolls over about its own length, whichever way it's heading
    this.group.add(o);
    const u = rand(-0.5, 0.5) * q0.width / 2;
    o.position.set(q0.x + Math.cos(q0.a) * u, q0.y, q0.z + Math.sin(q0.a) * u);
    let heading = face(-Math.sin(q0.a), Math.cos(q0.a)) + rand(-1, 1);
    let mode: 'swim' | 'back' | 'under' | 'watch' = 'swim';
    let timer = rand(1.5, 3);
    let wary = false;
    let gone = 0;
    const spot = this.spotter('otter');
    const water = () => this.course.nearest(o.position.x, o.position.z);
    const under = () => {
      mode = 'under';
      this.spray(o.position, 6, 0.5);
      o.visible = false;
    };
    return {
      s: at,
      root: o,
      update: (dt, kayak) => {
        spot(o.position, kayak);
        const t = this.clock;
        timer -= dt;
        const near = water();
        const y = near.sample.y;
        if (!wary && mode !== 'under' && o.position.distanceTo(kayak) < 8) {
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
              const r = Math.random();
              if (r < 0.45) mode = 'back';
              else if (r < 0.8) under();
              else heading += rand(-2, 2);
              timer = rand(2, 4);
            }
            break;
          case 'back': // over on its back, idling on the current
            o.rotation.x += (Math.PI - o.rotation.x) * Math.min(1, dt * 3);
            o.position.y = y + 0.06;
            if (timer < 0) {
              mode = 'swim';
              timer = rand(2, 4);
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
              timer = rand(2, 4);
            }
            break;
          case 'watch': // head up out of the water, turned to watch you go
            heading = turn(heading, face(kayak.x - o.position.x, kayak.z - o.position.z), dt * 3);
            o.rotation.z += (0.45 - o.rotation.z) * Math.min(1, dt * 4);
            o.position.y = y + 0.12 + Math.sin(t * 2.5) * 0.02;
            gone += dt;
            if (gone > 6 && Math.random() < dt) {
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
    const u = side * (q.width / 2 - 1.6);
    const m = this.assets.clone('moose');
    m.position.set(q.x + Math.cos(q.a) * u, q.y - 0.55, q.z + Math.sin(q.a) * u);
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
        if (!noticed && d < 16) {
          noticed = true;
          this.events.cry?.('grunt');
        }
        if (off < 0 && noticed && this.kayakS(kayak) > at + 10) off = 0;
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
        m.position.y = Math.max(q.y - 0.55, Math.min(this.ground(m.position.x, m.position.z), m.position.y + dt * 0.4));
        const g = Math.sin(off * 5);
        legs.forEach((l, i) => l && (l.rotation.z = (i === 0 || i === 3 ? 1 : -1) * g * 0.35));
        return off < 14;
      },
    };
  }

  /**
   * A brown bear on a rock at the edge of the rapids, fishing: the salmon leap and now and then
   * one doesn't get past. It rears up to look at you, huffs, and goes back to its fishing.
   */
  private bear(at: number): Actor | null {
    const spot0 = this.open(at, 0.2, 0.8, 1.6);
    if (!spot0) return null;
    const { q, side } = spot0;
    at = spot0.s;
    const root = new THREE.Group();
    const b = this.assets.clone('bear');
    b.scale.setScalar(1.2);
    b.position.set(spot0.x, Math.max(spot0.y, q.y - 0.3), spot0.z);
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
        if (rear < 0 && d < 15) {
          rear = 0;
          this.events.huff?.();
        }
        let lift = 0;
        if (rear >= 0) {
          rear += dt;
          lift = rear < 0.6 ? rear / 0.6 : rear < 3.4 ? 1 : Math.max(0, 1 - (rear - 3.4) / 0.6);
          if (lift > 0.9) this.look(head, b, kayak, 0.7, dt);
        }
        // the salmon going up past it: now and then, one is supper
        if (leap < 0 && caught < 0 && rear < 0 && (leapIn -= dt) < 0) {
          leap = 0;
          leapIn = rand(2.5, 5);
          const mouth = b.position.clone().addScaledVector(toWater, 1.7);
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
        if (off < 0 && rear > 4 && this.kayakS(kayak) > at + 6) off = 0;
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
    const spot0 = this.open(at, 1, 2.2, 1);
    if (!spot0) return null;
    const side = spot0.side;
    at = spot0.s;
    const root = new THREE.Group();
    this.group.add(root);
    const pack = Array.from({ length: 3 + Math.floor(Math.random() * 2) }, (_, i) => {
      const w = this.assets.clone('wolf');
      w.scale.setScalar(1.25);
      root.add(w);
      return {
        w,
        e: 1 + (i % 2) * 1.2 + rand(0, 0.6),
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
    let howl = night > 0.3 || Math.random() < 0.6 ? 0.4 : -1;
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
    for (const f of pack) {
      const q = place(f);
      f.w.rotation.y = face(-Math.cos(q.a) * side, -Math.sin(q.a) * side) + rand(-0.6, 0.6);
    }
    return {
      s: at,
      root,
      update: (dt, kayak) => {
        t += dt;
        const lead = pack[0].w;
        spot(lead.position, kayak);
        if (mode === 'watch') {
          if (howl >= 0 && (howl -= dt) < 0) {
            howl = -2; // howling: the lead's head goes back
            this.events.howl?.();
          }
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
          if (lead.position.distanceTo(kayak) < 15) mode = 'run';
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
   * A lynx on the bank, dead still, watching you come with its head turning to follow; once
   * you're past, it's away into the trees as if it had never been.
   */
  private lynx(at: number): Actor | null {
    const spot0 = this.open(at, 0.5, 2, 0.9);
    if (!spot0) return null;
    const { q, side } = spot0;
    at = spot0.s;
    const l = this.assets.clone('lynx');
    l.scale.setScalar(1.5);
    l.position.set(spot0.x, spot0.y, spot0.z);
    const toWater = V(-Math.cos(q.a) * side, 0, -Math.sin(q.a) * side);
    l.rotation.y = face(toWater.x - Math.sin(q.a) * 0.5, toWater.z + Math.cos(q.a) * 0.5);
    this.group.add(l);
    const head = l.getObjectByName('lynx_head');
    const legs = ['fl', 'fr', 'bl', 'br'].map((k) => l.getObjectByName(`lynx_leg_${k}`));
    const spot = this.spotter('lynx');
    let off = -1;
    return {
      s: at,
      root: l,
      update: (dt, kayak) => {
        spot(l.position, kayak);
        if (off < 0) {
          this.look(head, l, kayak, 1.3, dt);
          if (l.position.distanceTo(kayak) < 7 || this.kayakS(kayak) > at + 3) off = 0;
          return true;
        }
        off += dt;
        if (head) head.rotation.y = ease(head.rotation.y, 0, 6, dt);
        l.rotation.y = turn(l.rotation.y, face(-toWater.x, -toWater.z), dt * 5);
        if (off > 0.3) l.position.add(V(Math.cos(l.rotation.y) * dt * 2.2, 0, -Math.sin(l.rotation.y) * dt * 2.2));
        l.position.y = this.ground(l.position.x, l.position.z);
        const g = Math.sin(off * 10);
        legs.forEach((k, i) => k && (k.rotation.z = (i === 0 || i === 3 ? 1 : -1) * g * 0.5));
        return off < 6;
      },
    };
  }

  /**
   * The yeti, if it is one: far back at the edge of the trees, standing there looking at you. By
   * the time you've looked twice it's turned and gone into the snow, and nobody will believe you.
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
    let off = -1;
    let t = 0;
    return {
      s: at,
      root: y,
      update: (dt, kayak) => {
        t += dt;
        spot(y.position, kayak);
        if (off < 0) {
          this.look(head, y, kayak, 0.8, dt);
          arms.forEach((a, i) => a && (a.rotation.z = Math.sin(t * 1.2 + i) * 0.05));
          if (y.position.distanceTo(kayak) < 13) {
            off = 0;
            this.events.cry?.('yeti'); // one call off the cliffs as it turns, and gone
          }
          return true;
        }
        off += dt;
        if (head) head.rotation.y = ease(head.rotation.y, 0, 3, dt);
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
