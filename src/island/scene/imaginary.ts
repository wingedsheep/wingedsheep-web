import * as THREE from 'three';
import type { Ground } from './beike';
import { Body, headingOf, orient, splash, type Call } from './fauna';
import type { Island } from './island';
import type { Particles } from './particles';
import type { Outlook } from './sightings';
import { season, type SeasonName } from './season';
import { haloTexture } from './sky';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const chance = (p: number) => Math.random() < p;
const damp = THREE.MathUtils.damp;
const clamp = THREE.MathUtils.clamp;
const smooth = (k: number) => THREE.MathUtils.smoothstep(k, 0, 1);
/** Blender's (east, north) to a point in the scene (east, up, south). */
const B = (x: number, y: number) => V(x, 0, -y);

/**
 * The imaginary creatures, from the 2022 blog posts where GPT-3 wrote the field notes and DALL·E
 * painted them. Rarer than anything else on the island, and each only in its own weather. They
 * can turn up any time of year, but each has a season it likes best, when it's out on more
 * visits. Seen once, they get a page in the sketchbook like everyone else. `?animal=<name>`
 * brings one along soon, whatever the weather.
 */
const LUCK = (() => {
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const want = (k: string) => q.get('animal') === k;
  /** The chance of one on this visit, blended between the seasons' (spring, summer, autumn, winter). */
  const odds = (spring: number, summer: number, autumn: number, winter: number) => {
    const p: Record<SeasonName, number> = { spring, summer, autumn, winter };
    return chance((Object.keys(p) as SeasonName[]).reduce((sum, k) => sum + season.weights[k] * p[k], 0));
  };
  return {
    snorble: want('snorble') || odds(1 / 8, 1 / 8, 1 / 12, 1 / 18),
    snorbleSoon: want('snorble'),
    balloonbug: want('balloonbug') || odds(1 / 7, 1 / 7, 1 / 12, 1 / 20),
    balloonbugSoon: want('balloonbug'),
    fosha: want('fosha') || odds(1 / 12, 1 / 12, 1 / 9, 1 / 7), // the long, clear winter nights
    foshaSoon: want('fosha'),
    treestrider: want('treestrider') || odds(1 / 12, 1 / 16, 1 / 8, 1 / 12), // the misty autumn mornings
    treestriderSoon: want('treestrider'),
    mosslits: want('mosslits') || odds(1 / 7, 1 / 9, 1 / 5, 1 / 10),
    mosslitsSoon: want('mosslits'),
    tromb: want('tromb') || odds(1 / 11, 1 / 9, 1 / 11, 1 / 14),
    trombSoon: want('tromb'),
  };
})();

/** Ground it can stand on, between two heights (NaN is the sea). */
const firm = (ground: Ground, p: THREE.Vector3, lo: number, hi: number) => {
  const h = ground.at(p.x, p.z);
  return !Number.isNaN(h) && h >= lo && h <= hi;
};

// --- the snorble ---------------------------------------------------------------------------

/** Round to a heading, a little at a time. */
const turn = (from: number, to: number, k: number, dt: number) =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * (1 - Math.exp(-k * dt));
/** A heading's forward and left in the world, and a point that far ahead and to the left of p. */
const ahead = (p: THREE.Vector3, heading: number, fwd: number, left: number) =>
  p.clone().add(V(Math.cos(heading) * fwd - Math.sin(heading) * left, 0, -Math.sin(heading) * fwd - Math.cos(heading) * left));
/** Something a snorble goes round rather than through: a stone, a trunk, a lamp post, or another snorble. */
type Round = { at: THREE.Vector3; r: number };

/**
 * One snorble, grown or young: where it is, which way it faces, and how it holds itself. Its
 * poses ease in: lying down (legs folded under, chin on the grass), sitting up on its haunches,
 * its legs flung out in a leap. It walks on its four short legs in diagonal pairs.
 */
class Fluff {
  readonly pos = V();
  heading = rand(0, Math.PI * 2);
  height = 0;
  lieTo = 0;
  sitTo = 0;
  splayTo = 0;
  pitchTo = 0;
  yawTo = 0;
  sleepy = false;
  sniffing = false;
  chewing = false;
  /** A play bow: front down, rump up, ready to pounce. */
  bowTo = 0;
  /** Over onto its back and round, tumbling (set each frame, not eased). */
  roll = 0;
  private lie = 0;
  private bow = 0;
  private sit = 0;
  private splay = 0;
  private pitch = 0;
  private yaw = 0;
  private gait = 0;
  private pace = 0;
  private stride = 0;
  /** What it keeps out of: the stones and trunks about, and (a young one) its mother and sister. */
  avoid: Round[] = [];
  /** Itself, as a round for the others to keep out of. */
  readonly round: Round;

  constructor(readonly body: Body, readonly size: number, private ground: Ground) {
    this.round = { at: this.pos, r: this.r };
  }

  /** How far it reaches from its middle, fur, snout and all. */
  get r() {
    return 0.3 * this.size;
  }

  /**
   * A step toward somewhere, round whatever's in the way on the side it's already leaning to;
   * true once it's there, or as near as it can get (its spot's under a stone, or its sister's in it).
   */
  walk(to: THREE.Vector3, speed: number, dt: number) {
    const dir = to.clone().sub(this.pos).setY(0);
    const left = dir.length();
    if (left < 0.04) return true;
    dir.divideScalar(left);
    let rounding = false;
    for (const o of this.avoid) {
      const reach = o.r + this.r;
      if (Math.hypot(to.x - o.at.x, to.z - o.at.z) < reach + 0.05) continue; // it's going right up to it
      const off = V(o.at.x - this.pos.x, 0, o.at.z - this.pos.z);
      const along = off.dot(dir);
      const side = dir.x * off.z - dir.z * off.x;
      if (along <= 0 || along - reach > 0.6 || Math.abs(side) > reach) continue;
      const aside = V(-off.z, 0, off.x).multiplyScalar(side > 0 ? -1 : 1).normalize();
      dir.addScaledVector(aside, 2 * clamp(1 - (along - reach) / 0.6, 0, 1)).normalize();
      rounding = true;
    }
    this.heading = turn(this.heading, headingOf(dir.x, dir.z), 7, dt);
    const step = Math.min(left, speed * dt);
    const was = this.pos.clone();
    this.pos.addScaledVector(dir, step);
    this.keepOut();
    this.gait += Math.hypot(this.pos.x - was.x, this.pos.z - was.z);
    this.pace = speed;
    return !rounding && step > 1e-6 && Math.hypot(to.x - this.pos.x, to.z - this.pos.z) > left - step * 0.2;
  }

  /** Out of anything it's ended up in, or that's come up against it. */
  keepOut() {
    for (const o of this.avoid) {
      const off = V(this.pos.x - o.at.x, 0, this.pos.z - o.at.z);
      const gap = off.length();
      const reach = o.r + this.r;
      if (gap >= reach) continue;
      this.pos.addScaledVector(gap > 1e-4 ? off.divideScalar(gap) : V(Math.cos(this.heading), 0, -Math.sin(this.heading)), reach - gap);
    }
  }

  face(heading: number, dt: number) {
    this.heading = turn(this.heading, heading, 4, dt);
  }

  /** Straight into a pose (for one that's already there when you arrive). */
  settle() {
    this.lie = this.lieTo;
    this.sit = this.sitTo;
  }

  draw(dt: number, clock: number) {
    const b = this.body;
    b.relax();
    this.lie = damp(this.lie, this.lieTo, 3, dt);
    this.sit = damp(this.sit, this.sitTo, 4, dt);
    this.splay = damp(this.splay, this.splayTo, 10, dt);
    this.bow = damp(this.bow, this.bowTo, 8, dt);
    this.pitch = damp(this.pitch, this.pitchTo, 5, dt);
    this.yaw = damp(this.yaw, this.yawTo, 3, dt);
    this.stride = damp(this.stride, this.pace > 0 ? clamp(this.pace * 1.4, 0.35, 0.8) : 0, 8, dt);
    this.keepOut();
    const h = this.ground.at(this.pos.x, this.pos.z);
    if (!Number.isNaN(h)) this.pos.y = h;
    b.root.position.copy(this.pos).setY(this.pos.y + this.height);
    orient(b.root, this.heading, 0, this.roll);
    b.root.scale.setScalar(this.size);
    const body = b.part('body');
    const head = b.part('head');
    // the step: diagonal pairs, a stride every twelve centimetres or so
    const phase = (this.gait / (0.12 * this.size)) * Math.PI;
    const swing = Math.sin(phase) * this.stride;
    if (body) {
      body.position.y += Math.abs(Math.sin(phase)) * 0.012 * this.stride - 0.14 * this.lie;
      // sitting up: tipped back onto its haunches, about the bottom of its rump
      const a = 1.0 * this.sit;
      if (a > 0.001) {
        const px = -0.16;
        const py = -0.2;
        body.rotation.z += a;
        body.position.x += px - (Math.cos(a) * px - Math.sin(a) * py);
        body.position.y += py - (Math.sin(a) * px + Math.cos(a) * py);
      }
      // a play bow
      body.rotation.z -= 0.35 * this.bow;
      body.position.y -= 0.05 * this.bow;
      // slow breaths, curled up asleep
      body.scale.y *= 1 + Math.sin(clock * 1.2) * 0.04 * this.lie;
    }
    for (const [tag, front, pair] of [['fl', true, 1], ['fr', true, -1], ['bl', false, -1], ['br', false, 1]] as const) {
      const leg = b.part(`leg_${tag}`);
      if (!leg) continue;
      let r = swing * pair * 0.9;
      // folded under, lying down: front paws forward, back ones back
      r += (front ? 1.4 : -1.4) * this.lie;
      // sitting: the back legs stay planted, the front paws come up to hold what it's sniffing
      r += (front ? 0.7 : -1.0) * this.sit;
      // a leap: front legs flung forward, back legs out behind
      r += (front ? 0.9 : -1.0) * this.splay;
      // bowed: front legs out flat ahead
      if (front) r += 0.8 * this.bow;
      leg.rotation.z += r;
    }
    if (head) {
      head.rotation.z += this.pitch - 1.1 * this.sit;
      head.rotation.y += this.yaw;
      if (this.sniffing) head.rotation.z += Math.sin(clock * 16) * 0.04; // the snout going
      if (this.chewing) head.rotation.z += Math.max(0, Math.sin(clock * 9)) * 0.08; // a nibble, and another
    }
    const eyes = b.part('eyes');
    const lids = b.part('lids');
    if (eyes) eyes.visible = !this.sleepy;
    if (lids) lids.visible = this.sleepy;
    const flower = b.part('flower');
    if (flower) flower.visible = false; // the meadow's daisy is its own (see Snorble)
    this.pace = 0;
    this.roll = 0;
  }
}

/**
 * Snorbles, on a sunny day out of the wind: a grown one and its two young, out of the trees to
 * the sunny grass above the beach. They potter about, sniffing at the ground, and now and then
 * set off across the meadow to forage, nibbling as they go (and snapping at the odd insect). The
 * young ones play when they get the chance: round and round after each other, or one creeping
 * up to pounce and the two of them tumbling over. Now and then the grown one sits up on its
 * haunches to sniff the daisy there, and when it's had enough it lies down in the sunbeam, curls
 * up and sleeps, the young ones (once they've played themselves out) tucked in beside it. Startle it and it
 * leaps two metres straight up (the field notes say it can), the young ones after it, half as
 * high; the third time, the whole family bounds off into the trees for good. A cloud over the sun
 * and they wander home. (If it's sunny when you arrive, they're already out.)
 */
class Snorble {
  readonly body: Body;
  private mum: Fluff;
  private young: Fluff[] = [];
  private state: 'away' | 'coming' | 'pottering' | 'foraging' | 'flower' | 'napping' | 'leaping' | 'leaving' | 'fleeing' = 'away';
  /** What it was doing before a fright, to go back to. */
  private was: 'pottering' | 'napping' = 'pottering';
  private wait = LUCK.snorbleSoon ? 0 : rand(20, 120);
  private arriving = true;
  private spot = V();
  private den = V();
  private target = V();
  private daisy?: THREE.Object3D;
  private daisyAt = V();
  /** The stones, trunks, lamp posts and log seats round the sunny patch. */
  private blocks: Round[] = [];
  private t = 0;
  /** In a potter: walking to somewhere, or nose down sniffing there. */
  private sniffFor = 0;
  private rounds = 0;
  /** Whether it's been to the daisy since its last nap. */
  private daisied = false;
  private napFor = 0;
  /** A foraging trip: the stops still to come (the last one back home), and how long it's nibbling at this one. */
  private route: THREE.Vector3[] = [];
  private browse = 0;
  private snap = 0;
  /** The young ones' game, if they're playing one. */
  private play: { kind: 'chase' | 'pounce'; t: number; length: number; centre: THREE.Vector3; angle: number; way: number; first: number } | null = null;
  private playWait = rand(4, 12);
  private pokes = 0;
  private startled = false;
  private landed = false;
  /** Till its next snore, or sniff at the daisy. */
  private hum = 0;
  private gone = false;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, private scene: THREE.Scene, private ground: Ground, island: Island) {
    this.body = new Body('snorble', template, scene);
    const size = this.body.root.scale.x;
    this.mum = new Fluff(this.body, size, ground);
    for (let i = 0; i < 2; i++) this.young.push(new Fluff(new Body('snorble', template, scene), size * 0.55, ground));
    // a sunny patch of grass above the beach, either side of the pier, out in the open
    for (const at of [B(-8, -13.6), B(11.2, -15.6)].sort(() => Math.random() - 0.5)) {
      if (firm(ground, at, 0.3, 4)) {
        this.spot.copy(at).setY(ground.at(at.x, at.z));
        break;
      }
    }
    // what's in the way about it, as rounds: a stone or a bush all of it, a tree just its trunk
    const box = new THREE.Box3();
    for (const o of island.root.children) {
      if (!/^(tree|lamp|log|bench)/.test(o.name)) continue;
      box.setFromObject(o.children.find((c) => /^trunk/.test(c.name)) ?? o);
      if (box.isEmpty()) continue;
      const at = box.getCenter(V()).setY(0);
      if (Math.hypot(at.x - this.spot.x, at.z - this.spot.z) > 22) continue;
      this.blocks.push({ at, r: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 });
    }
    this.mum.avoid = this.blocks;
    this.young.forEach((y, i) => (y.avoid = [...this.blocks, this.mum.round, this.young[1 - i].round]));
    // a daisy in the grass near it, there whether they come or not
    const flower = this.body.part('flower');
    if (flower && this.spot.lengthSq()) {
      for (let i = 0; i < 8; i++) {
        const at = ahead(this.spot, rand(0, Math.PI * 2), rand(1.2, 1.8), 0);
        if (!firm(ground, at, 0.3, 4) || !this.clear(at, 2 * this.mum.r)) continue;
        this.daisy = flower.clone();
        this.daisy.visible = true;
        this.daisy.position.copy(at).setY(ground.at(at.x, at.z));
        this.daisy.rotation.set(0, rand(0, Math.PI * 2), 0);
        this.daisy.scale.setScalar(size);
        this.daisyAt.copy(this.daisy.position);
        scene.add(this.daisy);
        break;
      }
    }
  }

  /** Everyone's bodies, for the picker: clicking a young one startles the family the same. */
  get bodies() {
    return [this.body, ...this.young.map((y) => y.body)];
  }

  get here() {
    return this.state !== 'away';
  }

  /** How many times it's been startled (its third is its last), or 0 if the last click found it already in the air. */
  get woken() {
    return this.startled ? this.pokes : 0;
  }

  /** Room for a snorble there: clear of the stones and trunks, with that much to spare. */
  private clear(p: THREE.Vector3, room: number) {
    return this.blocks.every((o) => Math.hypot(o.at.x - p.x, o.at.z - p.z) > o.r + room);
  }

  /** Home, in the trees: the nearest one a little way off the sunny patch, or uphill from it. */
  private findDen() {
    let best = Infinity;
    const p = V();
    this.scene.traverse((o) => {
      if (!/^tree\d+$/.test(o.name)) return;
      o.getWorldPosition(p);
      const d = p.distanceTo(this.spot);
      if (d > 4 && d < 14 && d < best && firm(this.ground, p, 0.2, 8)) {
        best = d;
        this.den.copy(p);
      }
    });
    if (best === Infinity) this.den.copy(this.spot).add(V(-this.spot.x, 0, -this.spot.z).setLength(7));
  }

  poke() {
    this.startled = ['coming', 'pottering', 'foraging', 'flower', 'napping', 'leaving'].includes(this.state);
    if (!this.startled) return;
    this.pokes++;
    this.onCall?.('squeak', this.mum.pos.clone());
    this.landed = false;
    this.was = this.state === 'napping' ? 'napping' : 'pottering';
    this.state = 'leaping';
    this.t = 0;
    this.play = null;
  }

  /** Off across the meadow: a few stops along it, never far uphill toward the houses, and home again. */
  private trip() {
    this.route = [];
    let from = this.spot;
    for (let i = 0, stops = 2 + Math.floor(rand(0, 3)); i < 20 && this.route.length < stops; i++) {
      const at = this.spot.clone().add(V(rand(-6, 6), 0, rand(-1.5, 1.5)));
      // clear grass all the way there, not the beach or the water, and room at the stop to stand
      const clear = [0.25, 0.5, 0.75, 1].every((k) => firm(this.ground, from.clone().lerp(at, k), 0.3, 5));
      if (!clear || !this.clear(at, this.mum.r + 0.15) || at.distanceTo(from) < 1.2) continue;
      this.route.push(at);
      from = at;
    }
    if (!this.route.length) return false;
    this.route.push(this.spot.clone());
    this.state = 'foraging';
    this.browse = 0;
    return true;
  }

  /** The young ones start a game, somewhere clear just beside their mother (the ring they run round clear of her too). */
  private startPlay() {
    const m = this.mum;
    const room = 0.45 + this.young[0].r;
    const centre = ahead(m.pos, m.heading, rand(0.3, 0.8), (chance(0.5) ? 1 : -1) * (room + m.r + rand(0.1, 0.35)));
    if (!firm(this.ground, centre, 0.3, 5) || !this.clear(centre, room + 0.1)) {
      this.playWait = 3;
      return;
    }
    this.play = { kind: chance(0.5) ? 'chase' : 'pounce', t: 0, length: rand(6, 14), centre, angle: rand(0, Math.PI * 2), way: chance(0.5) ? 1 : -1, first: chance(0.5) ? 1 : 0 };
  }

  /** Somewhere to potter over to: a step or two off across the sunny grass. */
  private wander() {
    for (let i = 0; i < 6; i++) {
      const at = ahead(this.spot, rand(0, Math.PI * 2), rand(0.4, 2.2), 0);
      if (firm(this.ground, at, 0.3, 4) && this.clear(at, this.mum.r + 0.15)) return this.target.copy(at);
    }
    return this.target.copy(this.spot);
  }

  private show(at: THREE.Vector3, settled: boolean) {
    const m = this.mum;
    m.pos.copy(at);
    m.body.show(at);
    this.young.forEach((y, i) => {
      y.pos.copy(ahead(at, m.heading, -0.6, i ? 0.45 : -0.45));
      y.heading = m.heading;
      y.body.show(y.pos);
    });
    if (!settled) return;
    // already out: pottering, or (half the time) asleep in the sun
    if (chance(0.5)) {
      this.state = 'napping';
      this.napFor = rand(20, 50);
      this.t = 3;
      for (const f of [m, ...this.young]) {
        f.lieTo = 1;
        f.sleepy = true;
        f.yawTo = 0.9;
        f.pitchTo = -0.3;
        f.settle();
      }
      this.young.forEach((y, i) => {
        y.pos.copy(ahead(m.pos, m.heading, -0.05, (i ? 1 : -1) * (m.r + y.r + 0.02)));
        y.heading = m.heading + (i ? 0.6 : -0.6);
      });
    } else {
      this.state = 'pottering';
      this.wander();
    }
  }

  update(dt: number, o: Outlook, clock: number) {
    if (this.daisy) this.daisy.visible = o.season !== 'winter';
    if (!this.spot.lengthSq() || this.gone) return;
    const m = this.mum;
    const fine = LUCK.snorbleSoon || (LUCK.snorble && o.night < 0.3 && o.hour >= 9 && o.hour < 17.5
      && o.cloud < 0.5 && o.wet < 0.05 && o.wind < 9);
    if (this.state === 'away') {
      const already = this.arriving && fine;
      this.arriving = false;
      if (!fine || (!already && (this.wait -= dt) > 0)) return;
      this.findDen();
      if (already) this.show(this.spot, true);
      else {
        // out from under the trees, and over to the sunny grass
        m.heading = headingOf(this.spot.x - this.den.x, this.spot.z - this.den.z);
        this.show(this.den, false);
        this.state = 'coming';
        this.target.copy(this.spot);
      }
    }
    if (!fine && ['coming', 'pottering', 'foraging', 'flower', 'napping'].includes(this.state)) this.state = 'leaving';
    this.t += dt;
    m.sniffing = false;
    m.chewing = false;
    m.splayTo = 0;
    m.height = 0;
    m.sitTo = 0;
    if (this.state !== 'napping') {
      m.lieTo = 0;
      m.sleepy = false;
    }
    m.yawTo = 0;
    m.pitchTo = 0;
    switch (this.state) {
      case 'coming':
        if (m.walk(this.target, 0.55, dt)) {
          this.state = 'pottering';
          this.sniffFor = rand(2, 4);
        }
        break;
      case 'pottering':
        if (this.sniffFor > 0) {
          // nose down in the clover
          this.sniffFor -= dt;
          m.sniffing = true;
          m.pitchTo = -0.7;
          m.yawTo = Math.sin(this.t * 0.9) * 0.3;
          if (this.sniffFor <= 0) {
            this.rounds++;
            if (this.rounds >= 4 && chance(0.5)) {
              // that'll do: a nap in the sun
              this.state = 'napping';
              this.napFor = rand(25, 60);
              this.t = 0;
              this.target.copy(this.spot);
              this.daisied = false;
            } else if (this.rounds >= 2 && chance(0.25)) {
              if (!this.trip()) this.wander();
            } else if (!this.daisied && this.daisy?.visible && chance(0.4)) {
              this.state = 'flower';
              this.daisied = true;
              this.t = 0;
              const back = this.daisyAt.clone().sub(this.spot).setY(0).setLength(0.5 * m.size);
              this.target.copy(this.daisyAt).sub(back);
            } else this.wander();
          }
        } else if (m.walk(this.target, 0.45, dt)) {
          this.sniffFor = rand(2, 5);
          if (chance(0.5)) this.onCall?.('sniff', m.pos.clone(), true);
        }
        break;
      case 'foraging':
        if (this.browse > 0) {
          // a nibble at the clover and the leaves, and now and then a snap at something flying past
          this.browse -= dt;
          m.chewing = true;
          m.pitchTo = -0.75;
          m.yawTo = Math.sin(this.t * 0.7) * 0.25;
          if (this.snap > 0) {
            this.snap -= dt;
            m.chewing = false;
            m.pitchTo = 0.5;
            m.height = Math.sin((1 - Math.max(0, this.snap) / 0.4) * Math.PI) * 0.12;
          } else if (chance(dt / 7)) this.snap = 0.4;
          if (this.browse <= 0) this.route.shift();
        } else if (!this.route.length) {
          this.state = 'pottering';
          this.rounds = 1;
          this.sniffFor = rand(1, 3);
        } else if (m.walk(this.route[0], 0.5, dt)) {
          if (this.route.length === 1) this.route.shift();
          else {
            this.browse = rand(3, 7);
            if (chance(0.4)) this.onCall?.('sniff', m.pos.clone(), true);
          }
        }
        break;
      case 'flower':
        if (!m.walk(this.target, 0.45, dt)) {
          this.t = 0;
          break;
        }
        // up on its haunches, eyes shut, nose in the daisy
        m.face(headingOf(this.daisyAt.x - m.pos.x, this.daisyAt.z - m.pos.z), dt);
        m.sitTo = 1;
        m.sleepy = this.t > 1;
        m.sniffing = this.t > 1;
        if (this.t > 1 && (this.hum -= dt) <= 0) {
          this.hum = 2.5;
          this.onCall?.('sniff', m.pos.clone(), true);
        }
        if (this.t > 6) {
          this.state = 'pottering';
          this.wander();
        }
        break;
      case 'napping':
        if (m.lieTo < 1) {
          // over to the sunbeam, a turn about, and down
          if (!m.walk(this.target, 0.45, dt)) {
            this.t = 0;
            break;
          }
          m.face(m.heading + 2, dt);
          if (this.t > 1.2) {
            m.lieTo = 1;
            this.t = 0;
            if (chance(0.5)) this.playWait = 0; // the young ones aren't tired yet
          }
          break;
        }
        if (this.t > 1.5) {
          m.sleepy = true;
          m.yawTo = 0.9;
          m.pitchTo = -0.3;
          // little snores, in the sun
          if ((this.hum -= dt) <= 0) {
            this.hum = rand(5, 10);
            this.onCall?.('snooze', m.pos.clone(), true);
          }
        }
        if ((this.napFor -= dt) <= 0) {
          // awake, a stretch, and back to pottering
          m.lieTo = 0;
          m.sleepy = false;
          this.state = 'pottering';
          this.rounds = 0;
          this.sniffFor = 0;
          this.wander();
          if (chance(0.4)) this.trip(); // up, and hungry
        }
        break;
      case 'leaping': {
        // a crouch, two metres straight up with its legs flung out, and a squashy landing
        const k = (this.t - 0.2) / 1.3;
        if (this.t < 0.2) m.lieTo = 0.3;
        else if (k < 1) {
          m.lieTo = 0;
          m.height = Math.sin(k * Math.PI) * 2.0;
          m.splayTo = 1;
          m.pitchTo = 0.4;
        } else if (this.t < 2.9) {
          if (!this.landed) {
            this.landed = true;
            this.onCall?.('bounce', m.pos.clone());
          }
          // landed: what was that?
          m.yawTo = Math.sin((this.t - 1.5) * 4) * 0.6;
          m.pitchTo = 0.25;
        } else if (this.pokes >= 3) {
          this.state = 'fleeing';
          this.t = 0;
          this.onCall?.('squeak', m.pos.clone());
        } else {
          this.state = this.was;
          this.t = 0;
          if (this.was === 'napping') m.lieTo = 1;
          else this.wander();
        }
        break;
      }
      case 'leaving':
      case 'fleeing': {
        const fleeing = this.state === 'fleeing';
        if (m.walk(this.den, fleeing ? 3 : 0.55, dt)) {
          for (const f of [m, ...this.young]) f.body.hide();
          if (fleeing) this.gone = true;
          else {
            this.state = 'away';
            this.wait = rand(30, 120);
          }
          return;
        }
        if (fleeing) {
          // big springy bounds, off into the trees
          const k = (this.t % 0.55) / 0.55;
          m.height = Math.sin(k * Math.PI) * 0.9;
          m.splayTo = Math.sin(k * Math.PI);
        }
        break;
      }
    }
    m.draw(dt, clock);
    // the young ones' games: while she sniffs about, browses, or is just dozing off
    const free = this.state === 'pottering' || this.state === 'flower' || (this.state === 'foraging' && this.browse > 0)
      || (this.state === 'napping' && m.lieTo >= 1 && this.t < 12);
    if (!free) this.play = null;
    else if (!this.play && (this.playWait -= dt) <= 0) this.startPlay();
    if (this.play && (this.play.t += dt) > this.play.length) {
      this.play = null;
      this.playWait = rand(10, 30);
    }
    if (this.play?.kind === 'chase') this.play.angle += this.play.way * (2.2 + Math.sin(this.play.t * 1.3) * 0.6) * dt;
    this.young.forEach((y, i) => (this.play ? this.frolic(y, i, dt, clock) : this.youngster(y, i, dt, clock)));
  }

  /** A young one at play: round and round after the other, or creeping up to pounce, and a tumble. */
  private frolic(y: Fluff, i: number, dt: number, clock: number) {
    const p = this.play!;
    const other = this.young[1 - i];
    y.lieTo = 0;
    y.sleepy = false;
    y.sniffing = false;
    y.chewing = false;
    y.sitTo = 0;
    y.splayTo = 0;
    y.bowTo = 0;
    y.height = 0;
    y.yawTo = 0;
    y.pitchTo = 0.1;
    if (p.kind === 'chase') {
      const r = 0.45;
      const a = p.angle - (i ? 1.25 * p.way : 0);
      y.walk(p.centre.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)), 1.4, dt);
      y.height = Math.abs(Math.sin(clock * 10 + i * 1.3)) * 0.05;
      if (chance(dt / 5)) this.onCall?.('chirrup', y.pos.clone(), true);
    } else {
      // pounce: one creeps up and crouches with its rump in the air, springs, and over they both go
      const cycle = 2.4;
      const k = p.t % cycle;
      const pouncer = (Math.floor(p.t / cycle) + p.first) % 2 === i;
      const toward = headingOf(other.pos.x - y.pos.x, other.pos.z - y.pos.z);
      if (k < 1.2) {
        if (pouncer) {
          if (y.pos.distanceTo(other.pos) > 0.6) y.walk(other.pos, 0.35, dt);
          else y.face(toward, dt);
          y.bowTo = 1;
          y.roll = Math.sin(clock * 22) * 0.1 * Math.min(1, k * 2); // the wiggle
          y.pitchTo = 0.2;
        } else {
          y.sniffing = true; // none the wiser
          y.pitchTo = -0.5;
        }
      } else if (k < 1.7) {
        const s = (k - 1.2) / 0.5;
        if (pouncer) {
          y.walk(other.pos.clone().lerp(y.pos, Math.min(1, (y.r + other.r) / Math.max(0.01, y.pos.distanceTo(other.pos)))), 1.8, dt);
          y.height = Math.sin(s * Math.PI) * 0.25;
          y.splayTo = 1;
          y.pitchTo = 0.3;
        } else {
          y.height = Math.sin(s * Math.PI) * 0.12;
          y.splayTo = 0.6;
          y.pitchTo = 0.4;
          if (k - dt < 1.2) this.onCall?.('chirrup', y.pos.clone(), true);
        }
      } else if (k < 2.2) {
        // over and over together
        const s = (k - 1.7) / 0.5;
        y.roll = (pouncer ? 1 : -1) * s * Math.PI * 2;
        y.height = Math.sin(s * Math.PI) * 0.1;
        y.splayTo = 0.5;
      }
    }
    // never wandering off far from its mother while it plays
    if (y.pos.distanceTo(this.mum.pos) > 2.2) y.walk(this.mum.pos, 1.2, dt);
    y.draw(dt, clock);
  }

  /** A young one: never far behind, copying whatever it's doing, a bit late and a bit smaller. */
  private youngster(y: Fluff, i: number, dt: number, clock: number) {
    const m = this.mum;
    const side = i ? 1 : -1;
    y.sniffing = false;
    y.splayTo = 0;
    y.height = 0;
    y.sitTo = 0;
    y.yawTo = 0;
    y.pitchTo = 0;
    if (this.state === 'napping' && m.lieTo >= 1) {
      // tucked in against its side, asleep too
      if (y.walk(ahead(m.pos, m.heading, -0.05, side * (m.r + y.r + 0.02)), 0.5, dt)) {
        y.face(m.heading + side * 0.6, dt);
        y.lieTo = 1;
        if (m.sleepy) {
          y.sleepy = true;
          y.yawTo = -side * 0.8;
          y.pitchTo = -0.3;
        }
      }
    } else {
      y.lieTo = 0;
      y.sleepy = false;
      if (this.state === 'leaping') {
        // after it, half as high
        const k = (this.t - 0.35 - i * 0.12) / 0.9;
        if (k > 0 && k < 1) {
          y.height = Math.sin(k * Math.PI) * 1.0;
          y.splayTo = 1;
          y.pitchTo = 0.4;
        } else if (k >= 1) y.yawTo = Math.sin((this.t + i) * 5) * 0.5;
      } else {
        const fleeing = this.state === 'fleeing';
        const spot = ahead(m.pos, m.heading, -0.6, side * 0.45);
        const far = y.pos.distanceTo(spot);
        if (far > 0.25 || fleeing) y.walk(spot, fleeing ? 3.2 : Math.min(0.9, 0.3 + far), dt);
        else {
          // having a sniff about too, while it waits
          y.face(m.heading + side * 0.4, dt);
          y.sniffing = Math.sin(clock * 0.7 + i * 2) > 0;
          y.pitchTo = y.sniffing ? -0.6 : 0.1;
          // a chirrup to its mother now and then
          if (chance(dt / 12)) this.onCall?.('chirrup', y.pos.clone(), true);
        }
        if (fleeing) {
          const k = ((this.t + i * 0.2) % 0.45) / 0.45;
          y.height = Math.sin(k * Math.PI) * 0.5;
          y.splayTo = Math.sin(k * Math.PI);
        }
      }
    }
    y.draw(dt, clock);
  }
}

// --- the balloonbug ------------------------------------------------------------------------

/**
 * A balloonbug, on a still, dry afternoon (likeliest in spring and summer): blown up like a
 * hot-air balloon, drifting over the island with what wind there is, legs dangling. Some days it
 * has eaten its fill of midges halfway across: it lets itself down and flutters into the grass.
 * Clicked, it puffs itself up and bobs higher.
 */
class Balloonbug {
  readonly body: Body;
  private t = -1;
  private wait = LUCK.balloonbugSoon ? 3 : rand(30, 150);
  private from = V();
  private dir = V();
  private speed = 0.6;
  private y = 5;
  private lift = 0;
  private puff = 0;
  /** Where along its way it lets itself down (or never). */
  private full = Infinity;
  private falling = -1;
  private fallFrom = V();
  private trips = 0;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground) {
    this.body = new Body('balloonbug', template, scene);
  }

  get here() {
    return this.t >= 0;
  }

  poke() {
    if (this.t < 0 || this.falling >= 0) return;
    this.puff = 1.6;
    this.lift = 1.4;
    this.onCall?.('fizz', this.body.root.position.clone());
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (this.t < 0) {
      const fine = LUCK.balloonbugSoon || (LUCK.balloonbug
        && o.hour >= 11 && o.hour < 18.5 && o.night < 0.3 && o.wind < 4.5 && o.wet < 0.03 && o.storm < 0.05);
      if (!fine || this.trips >= 2 || (this.wait -= dt) > 0) return;
      // in from upwind, across the near side of the island
      const d = o.drift.lengthSq() > 0.01 ? o.drift : new THREE.Vector2(1, 0.2);
      this.dir.set(d.x, 0, d.y).normalize();
      const side = V(-this.dir.z, 0, this.dir.x);
      const mid = V(rand(-10, 10), 0, rand(2, 10)).addScaledVector(side, rand(-4, 4));
      this.from.copy(mid).addScaledVector(this.dir, -45);
      this.y = rand(3.5, 5.5);
      this.speed = clamp(0.5 + o.wind * 0.3, 0.6, 1.6);
      this.full = chance(0.6) ? rand(38, 52) : Infinity;
      this.falling = -1;
      this.t = 0;
      this.trips++;
      b.show(this.from);
    }
    b.relax();
    this.t += dt;
    const along = this.t * this.speed;
    const balloon = b.part('balloon');
    let size = 1;
    let p: THREE.Vector3;
    if (this.falling < 0 && along > this.full) {
      const here = this.from.clone().addScaledVector(this.dir, along);
      if (firm(this.ground, here, 0.45, 9)) {
        this.falling = 0;
        this.fallFrom.copy(here).setY(this.y);
      } else this.full += 2; // not over the sea: a little further on
    }
    if (this.falling >= 0) {
      // full of midges: the balloon goes down, and so does the bug, fluttering into the grass
      this.falling += dt;
      const k = Math.min(1, this.falling / 4);
      size = 1 - smooth(k) * 0.7;
      p = this.fallFrom.clone().addScaledVector(this.dir, smooth(k) * 2);
      const g = this.ground.at(p.x, p.z);
      p.y = THREE.MathUtils.lerp(this.fallFrom.y, (Number.isNaN(g) ? 0 : g) + 0.05, k * k) + Math.sin(this.falling * 7) * 0.08 * (1 - k);
      b.root.rotation.set(Math.sin(this.falling * 5) * 0.3 * (1 - k), headingOf(this.dir.x, this.dir.z), Math.sin(this.falling * 4) * 0.2 * (1 - k));
      // a while in the grass, then it crawls home (out of sight, into the grass)
      if (this.falling > 4) p.y -= Math.max(0, this.falling - 10) * 0.08;
      if (this.falling > 16) {
        b.hide();
        this.t = -1;
        this.wait = rand(200, 500);
        return;
      }
    } else {
      // drifting: bobbing on the air, sinking slowly, a puff now and then to keep up
      this.puff = Math.max(0, this.puff - dt * 0.8);
      this.lift = damp(this.lift, Math.sin(clock * 0.4) * 0.15, 0.6, dt);
      this.y = clamp(this.y + this.lift * dt, 3, 9);
      size = 1 + Math.sin(Math.min(1, this.puff) * Math.PI) * 0.25 + Math.sin(clock * 1.7) * 0.03;
      p = this.from.clone().addScaledVector(this.dir, along).setY(this.y + Math.sin(clock * 0.9) * 0.2);
      b.root.rotation.set(Math.sin(clock * 0.8) * 0.08, headingOf(this.dir.x, this.dir.z) + Math.sin(clock * 0.3) * 0.4, Math.sin(clock * 0.6 + 1) * 0.08);
      if (along > 90) {
        b.hide();
        this.t = -1;
        this.wait = rand(200, 500);
        return;
      }
    }
    b.root.position.copy(p);
    if (balloon) balloon.scale.multiplyScalar(size);
    const legs = b.part('legs');
    if (legs) legs.rotation.x += Math.sin(clock * 2.3) * 0.25;
  }
}

// --- the fosha -----------------------------------------------------------------------------

/**
 * A fosha, on a clear night: a small blue fox with long ears, come out of the starlight onto the
 * high meadow to sit and look up at the stars. Its ears turn, its tail stirs, and every so often
 * it follows something across the sky. Clicked, it looks round at you for a moment, then back up.
 * It doesn't run; it just isn't there any more when the sky clouds over.
 */
class Fosha {
  readonly body: Body;
  private state: 'away' | 'coming' | 'watching' | 'going' = 'away';
  private wait = LUCK.foshaSoon ? 2 : rand(20, 120);
  private k = 0;
  private spot = V();
  private heading = 0;
  private gaze = 0;
  private gazeTo = 0;
  private nextGaze = rand(3, 7);
  private look = 0;
  private size = 1;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, ground: Ground, private particles: Particles) {
    this.body = new Body('fosha', template, scene);
    this.size = this.body.root.scale.x;
    // on the high meadow below the peak, facing out over the island and the sea
    for (const at of [B(-1.5, 13.5), B(10.5, 14.5), B(-4.5, 12.5)]) {
      if (firm(ground, at, 4, 9)) {
        this.spot.copy(at).setY(ground.at(at.x, at.z));
        this.heading = headingOf(0.3, 1) + rand(-0.4, 0.4); // mostly towards you, a little to one side
        return;
      }
    }
  }

  get here() {
    return this.state !== 'away';
  }

  poke() {
    if (this.state !== 'watching') return;
    this.look = 3;
  }

  private twinkle(n: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      this.particles.emit({
        position: this.spot.clone().add(V(Math.cos(a) * rand(0.1, 0.5), rand(0.1, 0.9), Math.sin(a) * rand(0.1, 0.5))),
        velocity: V(0, rand(0.1, 0.4), 0), color: pick(['#bfe8ff', '#ffffff', '#9cc0f0']), life: rand(0.6, 1.4), size: 1,
      });
    }
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (!this.spot.lengthSq()) return;
    const fine = LUCK.foshaSoon || (LUCK.fosha && o.night > 0.75 && o.cloud < 0.3 && o.fog < 0.2 && o.wet < 0.03);
    if (this.state === 'away') {
      if (!fine || (this.wait -= dt) > 0) return;
      this.state = 'coming';
      this.k = 0;
      b.show(this.spot);
    }
    if (this.state === 'watching' && !fine) {
      this.state = 'going';
      this.k = 0;
    }
    b.relax();
    let size = 1;
    if (this.state === 'coming' || this.state === 'going') {
      // in (and out) of a little swirl of starlight
      this.k = Math.min(1, this.k + dt / 1.6);
      size = this.state === 'coming' ? smooth(this.k) : 1 - smooth(this.k);
      if (chance(dt * 30)) this.twinkle(1);
      if (this.k >= 1) {
        if (this.state === 'coming') this.state = 'watching';
        else {
          b.hide();
          this.state = 'away';
          this.wait = rand(60, 200);
          return;
        }
      }
    }
    // its gaze wanders across the sky, and now and then follows something over
    if ((this.nextGaze -= dt) <= 0) {
      this.gazeTo = chance(0.3) ? rand(-0.9, 0.9) : rand(-0.35, 0.35);
      this.nextGaze = rand(3, 9);
    }
    this.gaze = damp(this.gaze, this.gazeTo, 1.2, dt);
    this.look -= dt;
    const looking = this.look > 0;
    b.root.position.copy(this.spot);
    orient(b.root, this.heading);
    b.root.scale.setScalar(size * this.size);
    const head = b.part('head');
    if (head) {
      // tipped right back to the sky, or round to look at you
      head.rotation.z += looking ? 0.05 : 0.75;
      head.rotation.y += looking ? 0.6 : this.gaze;
    }
    for (const [ear, side] of [[b.part('ear_l'), 1], [b.part('ear_r'), -1]] as const) {
      if (ear) ear.rotation.y += Math.max(0, Math.sin(clock * 0.7 + side * 2)) ** 8 * 0.4 * side;
    }
    const tail = b.part('tail');
    if (tail) tail.rotation.z += Math.sin(clock * 0.9) * 0.12;
  }
}

// --- the treestrider -----------------------------------------------------------------------

/** How it walks: a stride (metres between one footfall and the next of the same foot), the share of it a foot spends in the air, its pace, how hard it slows and sets off, and how high a foot comes out of the water. */
const STRIDE = 2.2;
const SWING = 0.4;
const CRUISE = 0.9;
const BRAKE = 0.6;
const LIFT = 0.9;
/** How far beyond the bay it comes from and goes on to: out past where the camera can see, like the ships. */
const OFFSTAGE = 85;

/** One of its legs: a thigh from the hip, a shin from the knee, and where its foot is planted. */
interface StriderLeg {
  thigh: THREE.Object3D;
  shin: THREE.Object3D;
  /** Where the leg is in its stride: diagonal pairs half a stride apart. */
  phase: number;
  /** At rest, in the body's frame: the hip, the knee from the hip, the foot from the hip. */
  hip: THREE.Vector3;
  knee: THREE.Vector3;
  foot: THREE.Vector3;
  /** The thigh's and shin's lengths, the way its knee points, and the shin at rest from the knee. */
  thighLength: number;
  shinLength: number;
  pole: THREE.Vector3;
  shinRest: THREE.Vector3;
  /** The thigh's frame at rest (along it, across, and out of the leg's plane), transposed. */
  rest: THREE.Matrix4;
  /** Where its foot stands from the creature, in the world, for this walk. */
  reach: THREE.Vector3;
  air: boolean;
}

/**
 * A treestrider, on a misty morning: five metres of stilt legs under a leaf-green back, wading through
 * the shallows off the island on its way to somewhere else, the mist round its knees. It comes in
 * from out of sight over the sea and goes on out of sight the other way (if it's about when you
 * arrive, it's already partway across). It walks
 * like a harvestman, two legs at a time, each foot set down and left where it is while the body
 * goes on over it, then lifted out of the water and swung on ahead. Clicked, it slows to a stop
 * with all four feet down, turns its head to look at you, and walks on.
 */
class Treestrider {
  readonly body: Body;
  private t = -1;
  private wait = LUCK.treestriderSoon ? 2 : rand(20, 100);
  private from = V();
  private dir = V();
  private walked = 0;
  private speed = 0;
  /** Where it's coming to a stop, with all four feet down (-1: it isn't). */
  private haltAt = -1;
  private look = 0;
  private done = false;
  /** How far it walks, from out of sight to out of sight. */
  private route = 0;
  /** Whether it's still the first look: if it's about then, it's already there. */
  private arriving = true;
  private legs: StriderLeg[] = [];
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.body = new Body('treestrider', template, scene);
    // front-left with back-right, then the other two
    for (const [tag, phase] of [['fl', 0], ['br', 0], ['fr', 0.5], ['bl', 0.5]] as const) {
      const thigh = this.body.part(`leg_${tag}`);
      const shin = this.body.part(`shin_${tag}`);
      const foot = this.body.part(`foot_${tag}`);
      if (!thigh || !shin || !foot) continue;
      const knee = shin.position.clone();
      const toFoot = knee.clone().add(foot.position);
      const along = toFoot.clone().normalize();
      const pole = knee.clone().addScaledVector(along, -knee.dot(along)).normalize();
      const u = knee.clone().normalize();
      const n = knee.clone().cross(toFoot).normalize();
      this.legs.push({
        thigh, shin, phase, knee, foot: toFoot, hip: thigh.position.clone(),
        thighLength: knee.length(), shinLength: foot.position.length(), pole,
        shinRest: foot.position.clone().normalize(),
        rest: new THREE.Matrix4().makeBasis(u, n.clone().cross(u), n).transpose(),
        reach: V(), air: false,
      });
    }
  }

  get here() {
    return this.t >= 0;
  }

  poke() {
    if (this.t < 0 || this.haltAt >= 0 || this.look > 0) return;
    // come to a stop where all four feet are down (pairs mid-stride, both planted), as soon as it can slow down for
    const soonest = (this.walked + (this.speed * this.speed) / (2 * BRAKE)) / STRIDE;
    const settled = [SWING / 2 + 0.25, SWING / 2 + 0.75].map((c) => Math.floor(soonest) + c);
    this.haltAt = Math.min(...[...settled, ...settled.map((c) => c + 1)].filter((c) => c >= soonest)) * STRIDE;
  }

  /** Whether the water's deep enough to wade in here (and not so deep it would swim). */
  private wading(p: THREE.Vector3) {
    const h = this.ground.at(p.x, p.z);
    return Number.isNaN(h) || h < -0.4;
  }

  /** Where a leg's foot stands for its k-th step: placed so it's right under the hip halfway through standing on it. */
  private plant(leg: StriderLeg, k: number) {
    const mid = (k + (SWING + 1) / 2 - leg.phase) * STRIDE;
    return this.from.clone().addScaledVector(this.dir, mid).add(leg.reach);
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (this.t < 0) {
      const fine = LUCK.treestriderSoon || (LUCK.treestrider && o.fog > 0.25 && o.night < 0.5 && o.storm < 0.1 && o.wind < 8);
      const already = this.arriving && fine;
      this.arriving = false;
      if (this.done || !fine || (!already && (this.wait -= dt) > 0)) return;
      // across the bay to the south-east, in front of the island, one way or the other, wading in
      // from out of sight over the sea and on out of sight beyond
      const east = chance(0.5);
      const a = east ? B(46, -24) : B(-8, -34);
      const z = east ? B(-8, -34) : B(46, -24);
      this.dir.copy(z).sub(a).setY(0).normalize();
      this.from.copy(a).addScaledVector(this.dir, -OFFSTAGE);
      this.route = a.distanceTo(z) + 2 * OFFSTAGE;
      // there when you arrive: somewhere in the bay already, partway across
      this.walked = already ? OFFSTAGE + rand(0, a.distanceTo(z)) : 0;
      this.speed = CRUISE;
      this.t = 0;
      b.show(this.from.clone().addScaledVector(this.dir, this.walked));
      // how far out each foot stands from it, on this heading
      b.relax();
      orient(b.root, headingOf(this.dir.x, this.dir.z));
      b.root.updateMatrixWorld(true);
      const body = b.part('body');
      for (const leg of this.legs) {
        if (body) leg.reach.copy(body.localToWorld(leg.hip.clone().add(leg.foot))).sub(b.root.position);
        leg.air = (this.walked / STRIDE + leg.phase) % 1 < SWING;
      }
    }
    b.relax();
    this.t += dt;
    // slowing to a stop, standing a while, and setting off again
    if (this.haltAt >= 0) {
      const left = this.haltAt - this.walked;
      this.speed = Math.min(this.speed, Math.sqrt(2 * BRAKE * Math.max(0, left)));
      if (left < 0.01) {
        this.walked = this.haltAt;
        this.speed = 0;
        this.haltAt = -1;
        this.look = 4;
        this.onCall?.('strider', b.root.position.clone());
      }
    } else if (this.look > 0) this.look -= dt;
    else this.speed = Math.min(CRUISE, this.speed + BRAKE * dt);
    this.walked = Math.min(this.haltAt >= 0 ? this.haltAt : Infinity, this.walked + this.speed * dt);
    // the body rides highest as each pair stands straight under it, and rolls a little from pair to pair
    const u = this.walked / STRIDE;
    const p = this.from.clone().addScaledVector(this.dir, this.walked);
    p.y = 0.08 * Math.cos(4 * Math.PI * (u - (SWING + 1) / 2));
    b.root.position.copy(p);
    orient(b.root, headingOf(this.dir.x, this.dir.z), 0.015 * Math.sin(4 * Math.PI * u), 0.03 * Math.sin(2 * Math.PI * u));
    b.root.updateMatrixWorld(true);
    const body = b.part('body');
    if (body) for (const leg of this.legs) this.step(leg, body, u);
    const head = b.part('head');
    if (head) {
      if (this.look > 0) {
        // round to look at you, and down a little
        const k = Math.sin(Math.min(1, (4 - this.look) / 1.2) * Math.PI / 2) * Math.min(1, this.look);
        head.rotation.y += -0.9 * k;
        head.rotation.z -= 0.25 * k;
      } else head.rotation.y += Math.sin(clock * 0.25) * 0.2;
      head.rotation.z += 0.03 * Math.sin(4 * Math.PI * u + 1); // nodding along with its stride
    }
    if (this.walked > this.route) {
      b.hide();
      this.t = -1;
      this.done = true; // once a visit is plenty
    }
  }

  /** One leg: where its foot is in the world this frame, and the thigh and shin turned to reach it. */
  private step(leg: StriderLeg, body: THREE.Object3D, u: number) {
    const at = u + leg.phase;
    const k = Math.floor(at);
    const f = at - k;
    const air = f < SWING;
    const foot = this.plant(leg, k);
    if (air) {
      // lifted out of the water and swung on ahead to where it'll stand next
      const s = f / SWING;
      foot.lerpVectors(this.plant(leg, k - 1), foot, smooth(s));
      foot.y += Math.sin(Math.PI * s) * LIFT;
    }
    if (air !== leg.air) {
      leg.air = air;
      const water = (air ? this.plant(leg, k - 1) : foot).setY(0);
      if (this.wading(water)) {
        splash(this.particles, water, air ? 0.2 : 0.5);
        if (!air) this.onCall?.('wade', water, true);
      }
      if (air && chance(0.3)) this.onCall?.('creak', body.localToWorld(leg.hip.clone().add(leg.knee)), true);
    }
    // two bones to reach it: the knee goes where the triangle of thigh, shin and reach puts it, on the side it bends
    const reach = body.worldToLocal(foot).sub(leg.hip);
    const a = leg.thighLength;
    const c = leg.shinLength;
    const d = clamp(reach.length(), Math.abs(a - c) + 1e-3, a + c - 1e-3);
    const along = reach.clone().normalize();
    const out = leg.pole.clone().addScaledVector(along, -leg.pole.dot(along)).normalize();
    const cos = clamp((a * a + d * d - c * c) / (2 * a * d), -1, 1);
    const knee = along.clone().multiplyScalar(a * cos).addScaledVector(out, a * Math.sqrt(1 - cos * cos));
    const u1 = knee.clone().normalize();
    const n1 = knee.clone().cross(reach).normalize();
    const turn = new THREE.Matrix4().makeBasis(u1, n1.clone().cross(u1), n1).multiply(leg.rest);
    leg.thigh.quaternion.setFromRotationMatrix(turn);
    const shin = reach.sub(knee).applyQuaternion(leg.thigh.quaternion.clone().invert()).normalize();
    leg.shin.quaternion.setFromUnitVectors(leg.shinRest, shin);
  }
}

// --- the mosslits --------------------------------------------------------------------------

const MOSSLIT_TAIL = 12; // the tail's segments (MOSSLIT_SEGS in imaginary.py)
const COLONY = 72;
const LIGHTS = 8; // soft lights shared between them (each one costs every lit surface)
const MOSSLIT_GREEN = '#5effb4';
const MOSSLIT_TEAL = '#4fe8ff';

/** One of the colony, and what it's up to. */
interface Mosslit {
  body: Body;
  halo: THREE.Sprite;
  pos: THREE.Vector3;
  /** Where it lives: it wanders, but not far from here. */
  home: THREE.Vector3;
  heading: number;
  size: number;
  /** Which of the forest's lights is its. */
  light: number;
  /** Its own time, so they don't move in step. */
  seed: number;
  /** How lit it is, 0..1, and how long into the night before it lights (it goes from the middle out). */
  glow: number;
  delay: number;
  /** How far from the middle of the colony (for the ripple when it's clicked). */
  ring: number;
  mode: 'rest' | 'creep' | 'reach' | 'lie';
  until: number;
  /** Leaning forward (and right over, lying down), eased; and how tight the tail's rolled. */
  lean: number;
  curl: number;
  /** How far it's stretched out mid-creep. */
  inch: number;
}

/**
 * Mosslits, on a damp night: a colony of a dozen in the eastern woods, glowing so they can find each
 * other in the dark (and lighting the trees round them a soft, sea-glass green). As the night comes
 * on they light up one by one, from the middle out, unrolling their tails like fern fronds. Then
 * they breathe, sway, creep along a little way in slow inching heaves, stretch their tails up to
 * feel the air, or lie down flat; motes of their light drift up and hang. Clicked, a ripple goes out
 * through the colony: each one dims and rolls its tail up tight, and then, ring by ring, they light
 * up again.
 */
class Mosslits {
  private colony: Mosslit[] = [];
  private centre = V();
  private lights: THREE.PointLight[] = [];
  private hazes: THREE.Sprite[] = [];
  /** The rising: seconds into it (or -1), where it starts from, and when the next one comes. */
  private rising = -1;
  private riseFrom = V();
  private nextRise = LUCK.mosslitsSoon ? 25 : rand(50, 90);
  /** Where you're looking, and how close (from the sound's question each frame). */
  private eye = V();
  private view = 100;
  /** Whether tonight's first light has gone up (with a shimmer you can hear). */
  private woke = false;
  private tint = new THREE.Color();
  private on = 0;
  private dark = 0; // seconds into its night
  private wait = LUCK.mosslitsSoon ? 1 : rand(10, 60);
  private ripple = -1;
  private relit = false;
  private shown = false;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, private scene: THREE.Scene, island: Island, private ground: Ground, private particles: Particles) {
    // the woods east of the workshop: a patch of floor between the trunks that the crowns don't hide
    const trees: THREE.Vector3[] = [];
    for (const o of island.root.children) if (/^tree/.test(o.name)) trees.push(o.getWorldPosition(V()));
    const cover = island.canopies.filter((c) => c.position.y > 1.5);
    // the buildings hide the ground behind them too, like a tall, wide crown
    for (const [id, r, h] of [['workshop', 5, 6], ['library', 6, 7], ['lighthouse', 3.5, 9]] as const) {
      const at = island.positionOf(id);
      if (at) cover.push({ position: at.clone().setY(h), radius: r, palette: '', squash: 1, tree: -1 });
    }
    const hidden = (p: THREE.Vector3) => cover.some((c) => {
      const north = c.position.z - p.z;
      return Math.abs(p.x - c.position.x) < c.radius * 0.9 && north > -c.radius * 0.8 && north < c.position.y * 1.3 + c.radius * 0.3;
    });
    // (and away from the campfire and the lamps, whose light would drown theirs out)
    const glare = [B(27, -1), ...island.lights.filter((l) => l.radius > 3 && !l.day).map((l) => l.position)];
    const open = (p: THREE.Vector3) => firm(ground, p, 0.45, 6) && !hidden(p) && trees.every((t) => Math.hypot(t.x - p.x, t.z - p.z) > 0.7);
    const dark = (p: THREE.Vector3) => glare.every((g, i) => Math.hypot(g.x - p.x, g.z - p.z) > (i ? 4.5 : 7.5));
    // the forest: wherever the trees stand close together
    const woods = trees.filter((t) => trees.filter((u) => Math.hypot(u.x - t.x, u.z - t.z) < 4.5).length >= 4);
    const spots: THREE.Vector3[] = [];
    for (const t of woods) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        for (const d of [1.1, 1.7, 2.3, 3.0]) {
          const p = t.clone().add(V(Math.cos(a) * d, 0, Math.sin(a) * d));
          if (open(p) && dark(p)) spots.push(p.setY(ground.at(p.x, p.z)));
        }
      }
    }
    // scattered all through it, in ones and twos and little huddles, never on top of each other
    spots.sort(() => Math.random() - 0.5);
    const halo = haloTexture();
    for (const p of spots) {
      if (this.colony.length >= COLONY) break;
      if (this.colony.some((m) => Math.hypot(m.home.x - p.x, m.home.z - p.z) < (chance(0.6) ? 0.4 : 0.8))) continue;
      const body = new Body('mosslits', template, scene);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: halo, color: new THREE.Color(MOSSLIT_GREEN), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
      }));
      sprite.renderOrder = 2;
      sprite.raycast = () => {};
      sprite.visible = false;
      scene.add(sprite);
      const size = chance(0.3) ? rand(0.45, 0.65) : rand(0.7, 1.1); // a few little ones
      this.colony.push({
        body, halo: sprite, pos: p.clone(), home: p.clone(), heading: rand(0, Math.PI * 2), size: size * body.root.scale.x, seed: rand(0, 100),
        glow: 0, delay: 0, ring: 0, light: 0, mode: 'rest', until: rand(2, 8), lean: 0, curl: 1.8, inch: 0,
      });
    }
    if (!this.colony.length) return;
    // a few soft lights over the forest floor where they are, spread out (each lights the ones round it)
    const centres: THREE.Vector3[] = [this.colony[0].home.clone()];
    while (centres.length < LIGHTS && centres.length < this.colony.length) {
      let far = this.colony[0].home;
      let farD = -1;
      for (const m of this.colony) {
        const d = Math.min(...centres.map((c) => c.distanceTo(m.home)));
        if (d > farD) [far, farD] = [m.home, d];
      }
      centres.push(far.clone());
    }
    for (const m of this.colony) {
      m.light = centres.reduce((best, c, i) => (c.distanceTo(m.home) < centres[best].distanceTo(m.home) ? i : best), 0);
      m.ring = centres[m.light].distanceTo(m.home);
      m.delay = m.ring * 0.8 + rand(0, 4); // lit one by one, from each light's middle out
    }
    for (const c of centres) {
      const light = new THREE.PointLight(MOSSLIT_GREEN, 0, 11, 1.1);
      light.position.copy(c).add(V(0, 1.3, 0.3));
      scene.add(light);
      this.lights.push(light);
      // and a wide, faint haze of their light hanging over the glade
      const haze = new THREE.Sprite(new THREE.SpriteMaterial({
        map: halo, color: new THREE.Color(MOSSLIT_GREEN), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
      }));
      haze.renderOrder = 2;
      haze.raycast = () => {};
      haze.position.copy(c).add(V(0, 0.7, 0));
      haze.scale.setScalar(9.5);
      haze.visible = false;
      scene.add(haze);
      this.hazes.push(haze);
    }
    this.centre.copy(centres[0]);
  }

  get bodies() {
    return this.colony.map((m) => m.body);
  }

  get here() {
    return this.shown;
  }

  /** A ripple out through the colony: each dims and furls, then they relight, ring by ring. */
  poke() {
    if (!this.shown || this.ripple >= 0) return;
    this.ripple = 0;
    this.relit = false;
    this.onCall?.('hush', this.centre.clone());
  }

  private next(m: Mosslit, t: number) {
    const r = Math.random();
    m.mode = r < 0.55 ? 'creep' : r < 0.75 ? 'reach' : r < 0.85 ? 'lie' : 'rest';
    m.until = t + (m.mode === 'creep' ? rand(8, 20) : m.mode === 'lie' ? rand(6, 14) : rand(3, 7));
    if (m.mode === 'creep') {
      // off somewhere, but never far from the others
      const home = headingOf(m.home.x - m.pos.x, m.home.z - m.pos.z);
      const far = Math.hypot(m.home.x - m.pos.x, m.home.z - m.pos.z) > 2;
      m.heading = far ? home + rand(-0.5, 0.5) : m.heading + rand(-1.2, 1.2);
    }
  }

  /** A slow swell of brightness rolling east to west through the woods, 0.7..1.15. */
  private swell(at: THREE.Vector3, clock: number) {
    return 0.92 + Math.sin(clock * 0.45 + at.x * 0.18 + at.z * 0.07) * 0.23;
  }

  /** Their light, drifting slowly between green and teal from place to place. */
  private tinted(at: THREE.Vector3, clock: number) {
    const k = 0.5 + Math.sin(clock * 0.12 + at.x * 0.09 - at.z * 0.11) * 0.5;
    return this.tint.set(MOSSLIT_GREEN).lerp(new THREE.Color(MOSSLIT_TEAL), k * 0.6);
  }

  /** How near the camera's looking to the lit ones, 0..1 (for their sound). */
  near(at: THREE.Vector3, view: number) {
    this.eye.copy(at);
    this.view = view;
    let best = 0;
    for (const m of this.colony) {
      if (m.glow < 0.1) continue;
      const d = Math.hypot(m.pos.x - at.x, m.pos.z - at.z);
      best = Math.max(best, m.glow * clamp(1 - d / (6 + view * 0.35), 0, 1));
    }
    return best * this.on;
  }

  update(dt: number, o: Outlook, clock: number) {
    if (!this.colony.length) return;
    const fine = LUCK.mosslitsSoon || (LUCK.mosslits && o.night > 0.6 && (o.wet > 0.02 || o.fog > 0.2 || o.season === 'autumn'));
    if (!this.shown) {
      if (!fine || (this.wait -= dt) > 0) return;
      this.shown = true;
      this.dark = 0;
    }
    this.dark = fine ? this.dark + dt : Math.max(0, this.dark - dt * 1.5);
    this.on = damp(this.on, fine ? 1 : 0, 0.4, dt);
    if (!fine && this.colony.every((m) => m.glow < 0.02)) {
      this.shown = false;
      this.wait = rand(30, 90);
      for (const light of this.lights) light.intensity = 0;
      for (const haze of this.hazes) haze.visible = false;
      this.woke = false;
      for (const m of this.colony) {
        m.body.hide();
        m.halo.visible = false;
        m.glow = 0;
      }
      return;
    }
    if (this.ripple >= 0) {
      this.ripple += dt;
      if (!this.relit && this.ripple > 2.4) {
        this.relit = true;
        this.onCall?.('shimmer', this.centre.clone());
      }
      if (this.ripple > 6) this.ripple = -1;
    }
    // now and then, the rising: a slow wave through the forest, each one reaching up in turn and
    // letting go of its light, which drifts away up into the night
    if (this.rising < 0 && fine && this.dark > 20 && this.ripple < 0 && (this.nextRise -= dt) <= 0) {
      this.rising = 0;
      this.riseFrom.copy(pick(this.colony).home);
      this.nextRise = rand(100, 170);
      this.onCall?.('shimmer', this.riseFrom.clone());
    }
    if (this.rising >= 0 && (this.rising += dt) > 16) this.rising = -1;
    // close up, the ones near where you're looking notice you
    const close = this.view < 22;
    for (const m of this.colony) {
      const b = m.body;
      const t = clock + m.seed;
      // lit as its turn comes (from the middle out), and out again in the same order at the end
      let want = this.dark > m.delay ? 1 : 0;
      if (this.ripple >= 0) {
        const k = this.ripple - m.ring * 0.35;
        if (k > 0 && k < 2.6) want = 0.12;
      }
      const was = m.glow;
      m.glow = damp(m.glow, want, want > m.glow ? 1.4 : 2.2, dt);
      if (was < 0.5 && m.glow >= 0.5 && !this.woke) {
        this.woke = true;
        this.onCall?.('shimmer', m.pos.clone());
      }
      if (was < 0.5 && m.glow >= 0.5) {
        // a little burst of light as it comes on
        for (let i = 0; i < 6; i++) {
          this.particles.emit({
            position: m.pos.clone().add(V(rand(-0.2, 0.2), rand(0.1, 0.6) * m.size, rand(-0.2, 0.2))),
            velocity: V(rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3)), color: pick(['#a8ffd4', '#e4fff2', MOSSLIT_GREEN]),
            life: rand(0.8, 1.6), size: 1, drag: 1.5, fadeIn: 0,
          });
        }
      }
      if (m.glow < 0.02 && want === 0) {
        if (b.shown) b.hide();
        m.halo.visible = false;
        continue;
      }
      if (!b.shown) b.show(m.pos);

      // what it's doing
      if (t - m.seed > 0 && clock > m.until) this.next(m, clock);
      // its moment in the rising: the wave reaches it a while after it starts, depending how far off it is
      const k = this.rising < 0 ? -1 : this.rising - Math.hypot(m.home.x - this.riseFrom.x, m.home.z - this.riseFrom.z) * 0.35;
      const lifted = k > 0 && k < 4 ? Math.sin((k / 4) * Math.PI) : 0;
      const seen = close ? clamp(1 - Math.hypot(m.pos.x - this.eye.x, m.pos.z - this.eye.z) / 3.5, 0, 1) * m.glow : 0;
      let lean = 0.15;
      let curl = 1.0;
      if (m.mode === 'creep') {
        // inching: a heave forward, the body stretching out low, then the back end drawn up after
        const heave = Math.max(0, Math.sin(t * 2.2));
        m.inch = heave;
        lean = 0.45 + heave * 0.25;
        curl = 1.15;
        const step = heave * heave * 0.4 * m.size * dt;
        // wandering as it goes, and turning back if it strays too far from home or off the ground
        m.heading += Math.sin(t * 0.37) * 0.25 * dt;
        const to = m.pos.clone().add(V(Math.cos(m.heading) * step, 0, -Math.sin(m.heading) * step));
        const h = this.ground.at(to.x, to.z);
        if (Number.isNaN(h) || h < 0.45 || Math.hypot(m.home.x - to.x, m.home.z - to.z) > 3) m.heading += Math.PI * 0.6 * dt * 3;
        else m.pos.copy(to).setY(h);
      } else if (m.mode === 'reach') {
        // stood up tall, the tail unrolled to feel the air, turning this way and that
        lean = -0.05;
        curl = 0.55 + Math.sin(t * 0.6) * 0.15;
        m.inch = 0;
      } else if (m.mode === 'lie') {
        lean = 1.2; // right over, flat along the moss, like the one in the painting
        curl = 1.5;
        m.inch = 0;
      } else m.inch = 0;
      // rising, or noticing you, it stands tall and unrolls its tail
      const up = Math.max(lifted, seen * 0.8);
      lean = THREE.MathUtils.lerp(lean, -0.1, up);
      curl = THREE.MathUtils.lerp(curl, 0.35, up);
      // dim, it furls up tight and hunkers down
      curl += (1 - m.glow) * 1.0;
      lean = THREE.MathUtils.lerp(lean, 0.6, 1 - m.glow);
      m.lean = damp(m.lean, lean, 1.5, dt);
      m.curl = damp(m.curl, curl, 1.2, dt);

      b.relax();
      b.root.position.copy(m.pos);
      const breathe = 1 + Math.sin(t * 1.3) * 0.04;
      const grow = 0.3 + 0.7 * smooth(Math.min(1, m.glow * 1.5)); // they swell as they light
      b.root.scale.setScalar(m.size * grow);
      // (turned round to face you, if it's noticed you: you're looking from the south)
      const facing = m.heading + (m.mode === 'reach' ? Math.sin(t * 0.4) * 0.4 : 0);
      const toYou = headingOf(0, 1);
      orient(b.root, facing + Math.atan2(Math.sin(toYou - facing), Math.cos(toYou - facing)) * smooth(seen), -m.lean);
      const body = b.part('body');
      if (body) body.scale.set(breathe * (1 + m.inch * 0.12), 1 / breathe, breathe);
      // the tail: a slight lean back off the body, then rolled up tighter towards the tip, swaying
      for (let i = 0; i < MOSSLIT_TAIL; i++) {
        const seg = b.part(`tail_${i}`);
        if (!seg) continue;
        const k = i / (MOSSLIT_TAIL - 1);
        const roll = (k < 0.3 ? -0.14 : 0) + m.curl * (0.04 + 2.1 * k ** 2.4);
        seg.rotation.z -= roll + Math.sin(t * 0.9 - i * 0.45) * 0.05 + m.lean * (k < 0.25 ? 0.35 : 0);
        seg.rotation.x += Math.sin(t * 0.7 - i * 0.35) * 0.06;
      }
      // the tip's light, and the halo round the whole of it
      const tip = b.part('light');
      // its own flicker, on a slow swell of brightness that rolls through the whole forest
      const pulse = (0.85 + Math.sin(t * (1.6 + (m.seed % 1))) * 0.15) * this.swell(m.home, clock) * (1 + lifted * 0.6 + seen * 0.3);
      if (tip) tip.scale.setScalar(0.5 + m.glow * 1.3 * pulse);
      m.halo.visible = true;
      m.halo.position.copy(m.pos).add(V(0, 0.45 * m.size, 0));
      m.halo.scale.setScalar(1.7 * m.size * (0.8 + m.glow * 0.4));
      const halo = m.halo.material as THREE.SpriteMaterial;
      halo.opacity = 0.4 * m.glow * pulse * this.on;
      halo.color.copy(this.tinted(m.home, clock));
      // at the top of its reach in the rising, it lets go of its light, and the motes float up high
      if (lifted > 0.4 && m.glow > 0.5 && chance(dt * 9 * lifted)) {
        const from = tip ? tip.getWorldPosition(V()) : m.pos.clone();
        this.particles.emit({
          position: from, velocity: V(rand(-0.12, 0.12), rand(0.6, 1.2), rand(-0.12, 0.12)),
          color: pick(['#e4fff2', '#a8ffd4', '#b8f4ff', '#ffffff']), life: rand(5, 8), size: chance(0.3) ? 2 : 1,
          wobble: 0.6, drag: 0.08, fadeIn: 0.15, hold: 0.35,
        });
      }
      // and motes of light drifting up off it and hanging in the air
      if (m.glow > 0.6 && chance(dt * 2.4)) {
        const from = tip ? tip.getWorldPosition(V()) : m.pos.clone();
        this.particles.emit({
          position: from.add(V(rand(-0.15, 0.15), 0, rand(-0.15, 0.15))), velocity: V(rand(-0.06, 0.06), rand(0.08, 0.25), rand(-0.06, 0.06)),
          color: pick(['#5effb4', '#a8ffd4', '#e4fff2']), life: rand(2, 3.5), size: chance(0.2) ? 2 : 1, wobble: 0.5, fadeIn: 0.3, hold: 0.3,
        });
      }
    }
    // each light glows with the ones round it, breathing with the swell, drifting between green and teal
    this.lights.forEach((light, i) => {
      const near = this.colony.filter((m) => m.light === i);
      const glow = near.reduce((sum, m) => sum + m.glow, 0) / Math.max(1, near.length);
      const swell = this.swell(light.position, clock);
      light.intensity = glow * 5.5 * swell * this.on;
      light.color.copy(this.tinted(light.position, clock));
      const haze = this.hazes[i];
      haze.visible = glow > 0.02;
      (haze.material as THREE.SpriteMaterial).opacity = 0.28 * glow * swell * this.on;
      (haze.material as THREE.SpriteMaterial).color.copy(light.color);
    });
    // and now and then a spark of their light loose in the air, drifting from one to the next
    const lit = this.colony.filter((m) => m.glow > 0.6);
    if (lit.length && chance(dt * 3)) {
      const m = pick(lit);
      this.particles.emit({
        position: m.pos.clone().add(V(rand(-0.4, 0.4), rand(0.4, 1.4), rand(-0.4, 0.4))),
        velocity: V(rand(-0.25, 0.25), rand(-0.05, 0.12), rand(-0.25, 0.25)),
        color: pick(['#e4fff2', '#a8ffd4', '#b8f4ff']), life: rand(4, 7), size: 1, wobble: 1.2, fadeIn: 0.25, hold: 0.4,
      });
    }
  }
}

// --- the tromb ----------------------------------------------------------------------------

const SNOUT = 9; // segments (TROMB_SEGS in imaginary.py)

/**
 * A tromb, at dusk and into the night: a striped lizard with two long horns, perched on the edge
 * of the lighthouse rock over the sea, its long snout curled up in a loop. Now and then it
 * uncurls the snout, rolls its tongue out like a frog's down to the water, and comes up with a
 * fish (or doesn't). Now and then it sings, a slow sliding call you can hear all over the island.
 * It's shy: click it and it slips back round the lighthouse, and only comes out again
 * once you've left it alone a while.
 */
class Tromb {
  readonly body: Body;
  private state: 'away' | 'coming' | 'perched' | 'going' = 'away';
  private wait = LUCK.trombSoon ? 2 : rand(20, 120);
  private k = 0;
  private edge = V();
  /** The way round the tower from behind it (out of sight) to the edge: the lighthouse's middle,
   * how far out to keep, and the angles (Blender's, anticlockwise from east) it goes between. */
  private centre = B(-31.5, -3);
  private radius = 0;
  private from = 0;
  private to = 0;
  /** A spot of open water below the lip, where it fishes. */
  private water = V();
  private heading = 0;
  private size = 1;
  /** Where it is in a catch, seconds (or -1); and whether this one comes up with a fish. */
  private fishing = -1;
  private nextFish = rand(12, 25);
  private caught = false;
  private splashed = false;
  private singing = -1;
  private nextSong = LUCK.trombSoon ? 6 : rand(15, 35);
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.body = new Body('tromb', template, scene);
    this.size = this.body.root.scale.x;
    // out from the lighthouse towards the sea, to the last bit of rock before the drop
    const centre = B(-31.5, -3);
    for (const a of [-2.3, -2.0, -2.6]) { // south-west-ish, so it's side on to you, looking out
      const dir = V(Math.cos(a), 0, -Math.sin(a));
      let last: THREE.Vector3 | null = null;
      for (let d = 2.5; d < 8; d += 0.1) {
        const p = centre.clone().addScaledVector(dir, d);
        const h = ground.at(p.x, p.z);
        if (Number.isNaN(h) || h < 0.9) break;
        last = p.setY(h);
      }
      if (!last) continue;
      // its front feet on the lip, its snout out over the drop
      this.edge.copy(last).addScaledVector(dir, -0.35);
      this.edge.y = ground.at(this.edge.x, this.edge.z);
      // it comes round the rock from the far side of the tower, keeping a little in from the lip
      this.radius = Math.hypot(this.edge.x - centre.x, this.edge.z - centre.z) - 0.15;
      this.to = a;
      this.from = a - 1.8; // round by the west, from the north side
      this.heading = headingOf(dir.x, dir.z);
      // and the nearest open water out in front of it, below the rock
      for (let d = 0.8; d < 6; d += 0.1) {
        const p = this.edge.clone().addScaledVector(dir, d);
        const h = ground.at(p.x, p.z);
        if (Number.isNaN(h) || h < -0.3) {
          this.water.copy(p).addScaledVector(dir, 0.3).setY(-0.05);
          break;
        }
      }
      return;
    }
  }

  get here() {
    return this.state !== 'away';
  }

  /** A point on its way round the tower, on the rock (an angle as in `from` and `to`). */
  private round(angle: number) {
    let r = this.radius;
    let p = V();
    // in a little wherever the rock's lip comes closer, never into the tower
    for (; r > 2.4; r -= 0.1) {
      p = this.centre.clone().add(V(Math.cos(angle) * r, 0, -Math.sin(angle) * r));
      const h = this.ground.at(p.x, p.z);
      if (!Number.isNaN(h) && h > 1.0) break;
    }
    const h = this.ground.at(p.x, p.z);
    return p.setY(Number.isNaN(h) ? this.edge.y : h);
  }

  /** Shy: back round the tower it goes. */
  poke() {
    if (this.state !== 'perched' && this.state !== 'coming') return;
    this.state = 'going';
    this.k = 0;
    this.fishing = -1;
    this.singing = -1;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (!this.edge.lengthSq()) return;
    const fine = LUCK.trombSoon || (LUCK.tromb && o.night > 0.25 && o.night < 0.97 && o.storm < 0.3 && o.wet < 0.5);
    if (this.state === 'away') {
      if (!fine || (this.wait -= dt) > 0) return;
      this.state = 'coming';
      this.k = 0;
      b.show(this.round(this.from));
    }
    if (this.state === 'perched' && !fine && this.fishing < 0) this.poke();
    b.relax();
    let at = this.edge.clone();
    let heading = this.heading;
    let size = 1;
    let crawl = 0;
    if (this.state === 'coming' || this.state === 'going') {
      // creeping round the tower from its far side to the edge (or back), low to the rock
      this.k = Math.min(1, this.k + dt / (this.state === 'coming' ? 5 : 2.5));
      const k = this.state === 'coming' ? smooth(this.k) : 1 - smooth(this.k);
      const angle = THREE.MathUtils.lerp(this.from, this.to, k);
      at = this.round(angle);
      // facing the way it's going, and at the end turned out to the sea
      const way = this.state === 'coming' ? 1 : -1;
      const along = headingOf(-Math.sin(angle) * way, -Math.cos(angle) * way);
      const settle = smooth(clamp((k - 0.8) / 0.2, 0, 1));
      heading = along + Math.atan2(Math.sin(this.heading - along), Math.cos(this.heading - along)) * settle;
      // (out of sight behind the tower at the far end, where it fades in and out)
      size = this.state === 'coming' ? Math.min(1, this.k * 4) : 1 - Math.max(0, this.k - 0.75) / 0.25;
      crawl = 1;
      if (this.k >= 1) {
        if (this.state === 'coming') this.state = 'perched';
        else {
          b.hide();
          this.state = 'away';
          this.wait = rand(60, 150);
          return;
        }
      }
    }
    b.root.position.copy(at);
    orient(b.root, heading, 0, crawl ? Math.sin(clock * 9) * 0.04 : 0);
    b.root.scale.setScalar(Math.max(0.001, size) * this.size);

    // the catch: uncurl, look down, tongue out to the water and back, curl up again
    let curl = 1; // 1: rolled up in its loop; 0: straight out
    let reach = 0; // how far the tongue is out, 0..1
    let look = 0; // the head bowed over the water
    let lift = 0; // the head up, singing
    if (this.state === 'perched') {
      if (this.fishing < 0 && this.singing < 0 && (this.nextFish -= dt) <= 0) {
        this.fishing = 0;
        this.caught = chance(0.55);
        this.splashed = false;
        this.nextFish = rand(25, 55);
      }
      if (this.fishing < 0 && this.singing < 0 && (this.nextSong -= dt) <= 0) {
        this.singing = 0;
        this.nextSong = rand(30, 70);
        this.onCall?.('tromb', b.root.position.clone());
      }
    }
    if (this.fishing >= 0) {
      const f = (this.fishing += dt);
      // a long look down at the water, the snout unrolling; then the strike (fast), a moment
      // under, and back up with whatever it got, rolling the snout up again
      curl = 1 - smooth(clamp(f / 1.4, 0, 1)) + smooth(clamp((f - 4.2) / 1.2, 0, 1));
      look = smooth(clamp(f / 1.2, 0, 1)) - smooth(clamp((f - 4.4) / 1, 0, 1));
      reach = clamp((f - 1.8) / 0.18, 0, 1) - smooth(clamp((f - 2.6) / 0.9, 0, 1));
      if (f > 6) this.fishing = -1;
    }
    if (this.singing >= 0) {
      const t = (this.singing += dt);
      lift = Math.sin(clamp(t / 5, 0, 1) * Math.PI);
      if (t > 5) this.singing = -1;
    }
    const head = b.part('head');
    if (head) {
      head.rotation.z += -0.15 - look * 0.55 + lift * 0.6;
      if (this.state === 'perched' && this.fishing < 0) head.rotation.y += Math.sin(clock * 0.31) * 0.25;
    }
    // the snout: drooping out of the head, then rolled up into a loop at the tip
    // (as it fishes, the whole snout straightens out along one line, down to the water)
    const straight = this.fishing >= 0 ? 1 - curl : 0;
    for (let i = 0; i < SNOUT; i++) {
      const seg = b.part(`snout_${i}`);
      if (!seg) continue;
      const droop = i === 0 ? -0.45 : i < 4 ? -0.04 : 0;
      const roll = i >= 4 ? 1.15 * curl : 0;
      seg.rotation.z += droop * (i === 0 ? 1 : 1 - straight) + roll + (lift ? Math.sin(clock * 3 + i) * 0.03 * lift : 0);
    }
    // its root turned to point at the water, so snout and tongue are one straight line
    const root = b.part('snout_0');
    if (root?.parent && straight > 0 && this.water.lengthSq()) {
      b.root.updateMatrixWorld(true);
      const to = root.parent.worldToLocal(this.water.clone()).sub(root.position).normalize();
      const aim = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), to);
      root.quaternion.slerp(aim, smooth(straight));
    }
    const tongue = b.part('tongue');
    const fish = b.part('fish');
    if (tongue?.parent) {
      tongue.visible = reach > 0.01 && this.water.lengthSq() > 0;
      let length = 0.01;
      if (tongue.visible) {
        // rolled out from the snout's tip straight at the water, however the snout lies
        b.root.updateMatrixWorld(true);
        const to = tongue.parent.worldToLocal(this.water.clone()).sub(tongue.position);
        length = Math.max(0.01, to.length() * reach);
        tongue.quaternion.setFromUnitVectors(V(1, 0, 0), to.normalize());
        // a wriggle while it's under
        if (reach > 0.99) tongue.rotateY(Math.sin(clock * 30) * 0.03);
      }
      tongue.scale.set(length, 1, 1);
      if (reach > 0.99 && !this.splashed) {
        this.splashed = true;
        splash(this.particles, this.water, 0.6);
        this.onCall?.('plop', this.water.clone(), true);
      }
      if (fish) {
        fish.visible = this.caught && this.splashed && this.fishing >= 0 && this.fishing < 4.3;
        fish.scale.x = 1 / Math.max(0.01, length);
        fish.rotation.x += Math.sin(clock * 20) * 0.5;
      }
    }
    const tail = b.part('tail');
    if (tail) tail.rotation.y += Math.sin(clock * 0.8) * 0.15 + crawl * Math.sin(clock * 9) * 0.2;
  }
}

/** The imaginary creatures, run alongside the rare sightings. */
export class Imaginary {
  private snorble?: Snorble;
  private balloonbug?: Balloonbug;
  private fosha?: Fosha;
  private treestrider?: Treestrider;
  private mosslits?: Mosslits;
  private tromb?: Tromb;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(scene: THREE.Scene, template: (species: string) => THREE.Object3D | undefined, ground: Ground, particles: Particles, island: Island) {
    const call = (c: Call, at: THREE.Vector3, ambient?: boolean) => this.onCall?.(c, at, ambient);
    const T = template;
    const snorble = T('snorble');
    if (snorble && LUCK.snorble) {
      this.snorble = new Snorble(snorble, scene, ground, island);
      this.snorble.onCall = call;
    }
    const balloonbug = T('balloonbug');
    if (balloonbug && LUCK.balloonbug) {
      this.balloonbug = new Balloonbug(balloonbug, scene, ground);
      this.balloonbug.onCall = call;
    }
    const fosha = T('fosha');
    if (fosha && LUCK.fosha) {
      this.fosha = new Fosha(fosha, scene, ground, particles);
      this.fosha.onCall = call;
    }
    const treestrider = T('treestrider');
    if (treestrider && LUCK.treestrider) {
      this.treestrider = new Treestrider(treestrider, scene, ground, particles);
      this.treestrider.onCall = call;
    }
    const mosslits = T('mosslits');
    if (mosslits && LUCK.mosslits) {
      this.mosslits = new Mosslits(mosslits, scene, island, ground, particles);
      this.mosslits.onCall = call;
    }
    const tromb = T('tromb');
    if (tromb && LUCK.tromb) {
      this.tromb = new Tromb(tromb, scene, ground, particles);
      this.tromb.onCall = call;
    }
  }

  get bodies() {
    return [...(this.snorble?.bodies ?? []), ...(this.mosslits?.bodies ?? []), ...[this.balloonbug, this.fosha, this.treestrider, this.tromb].filter((c) => !!c).map((c) => c.body)];
  }

  /** How many times the snorble's been woken, for its lines. */
  get snorbleWoken() {
    return this.snorble?.woken ?? 0;
  }

  /** How near the camera is to the lit mosslits, 0..1, for the sound of them. */
  mosslitsNear(at: THREE.Vector3, view: number) {
    return this.mosslits?.near(at, view) ?? 0;
  }

  poke(id: string) {
    if (id === 'snorble') this.snorble?.poke();
    if (id === 'balloonbug') this.balloonbug?.poke();
    if (id === 'fosha') this.fosha?.poke();
    if (id === 'treestrider') this.treestrider?.poke();
    if (id === 'mosslits') this.mosslits?.poke();
    if (id === 'tromb') this.tromb?.poke();
  }

  update(dt: number, o: Outlook, clock: number) {
    this.snorble?.update(dt, o, clock);
    this.balloonbug?.update(dt, o, clock);
    this.fosha?.update(dt, o, clock);
    this.treestrider?.update(dt, o, clock);
    this.mosslits?.update(dt, o, clock);
    this.tromb?.update(dt, o, clock);
  }
}
