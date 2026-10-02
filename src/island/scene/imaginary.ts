import * as THREE from 'three';
import type { Ground } from './beike';
import { Body, headingOf, orient, splash, type Call } from './fauna';
import type { Island } from './island';
import type { Particles } from './particles';
import type { Outlook } from './sightings';
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
 * painted them. Rarer than anything else on the island, and each only in its own weather. Seen
 * once, they get a page in the sketchbook like everyone else. `?animal=<name>` brings one along
 * soon, whatever the weather.
 */
const LUCK = (() => {
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const want = (k: string) => q.get('animal') === k;
  return {
    snorble: want('snorble') || chance(1 / 15),
    snorbleSoon: want('snorble'),
    balloonbug: want('balloonbug') || chance(1 / 12),
    balloonbugSoon: want('balloonbug'),
    fosha: want('fosha') || chance(1 / 12),
    foshaSoon: want('fosha'),
    treestrider: want('treestrider') || chance(1 / 18),
    treestriderSoon: want('treestrider'),
    mosslits: want('mosslits') || chance(1 / 8),
    mosslitsSoon: want('mosslits'),
    tromb: want('tromb') || chance(1 / 12),
    trombSoon: want('tromb'),
  };
})();

/** Ground it can stand on, between two heights (NaN is the sea). */
const firm = (ground: Ground, p: THREE.Vector3, lo: number, hi: number) => {
  const h = ground.at(p.x, p.z);
  return !Number.isNaN(h) && h >= lo && h <= hi;
};

// --- the snorble ---------------------------------------------------------------------------

/**
 * A snorble, on a sunny day out of the wind: a heap of fluff napping in the grass, breathing,
 * lifting its long snout now and then to sniff the air. Bother it and it leaps two metres
 * straight up (the field notes say it can), lands, and settles down again. The third time it
 * bounds off for good.
 */
class Snorble {
  readonly body: Body;
  private state: 'away' | 'waking' | 'napping' | 'leaping' | 'bounding' = 'away';
  private wait = LUCK.snorbleSoon ? 2 : rand(20, 120);
  private spot = V();
  private heading = rand(0, Math.PI * 2);
  private t = 0;
  private sniff = 0;
  private nextSniff = rand(4, 10);
  private alert = 0;
  private pokes = 0;
  private gone = false;
  private hop = V();
  /** The template's own scale, which the squash and stretch goes on top of. */
  private size = 1;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground) {
    this.body = new Body('snorble', template, scene);
    this.size = this.body.root.scale.x;
    // a sunny patch of grass above the beach, either side of the pier, out in the open
    for (const at of [B(-8, -13.6), B(11.2, -15.6)].sort(() => Math.random() - 0.5)) {
      if (firm(ground, at, 0.3, 4)) {
        this.spot.copy(at).setY(ground.at(at.x, at.z));
        break;
      }
    }
  }

  get here() {
    return this.state !== 'away';
  }

  /** How many times it's been woken (its third is its last). */
  get woken() {
    return this.pokes;
  }

  poke() {
    if (this.state !== 'napping') return;
    if (++this.pokes >= 3) {
      // that's enough: off it goes, in bounds, away from the camera
      this.state = 'bounding';
      this.t = 0;
      this.hop.set(rand(-1, 1), 0, -1).normalize();
      this.heading = headingOf(this.hop.x, this.hop.z);
      this.onCall?.('bounce', this.body.root.position.clone());
      return;
    }
    this.state = 'leaping';
    this.t = 0;
    this.onCall?.('bounce', this.body.root.position.clone());
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (!this.spot.lengthSq() || this.gone) return;
    const fine = LUCK.snorbleSoon || (LUCK.snorble && o.night < 0.3 && o.hour >= 9 && o.hour < 17.5
      && o.cloud < 0.35 && o.wet < 0.05 && o.wind < 9 && o.season !== 'winter');
    if (this.state === 'away') {
      if (!fine || (this.wait -= dt) > 0) return;
      // there in the long grass all along: it comes up out of it, still asleep
      this.state = 'waking';
      this.t = 0;
      b.show(this.spot);
    }
    if (this.state === 'napping' && !fine) {
      // a cloud over the sun: it wanders off to find another sunbeam
      this.pokes = 2;
      this.poke();
    }
    b.relax();
    this.t += dt;
    let y = this.spot.y;
    let stretch = 1;
    let head = 0;
    const p = this.spot.clone();
    if (this.state === 'waking') {
      y -= (1 - smooth(Math.min(1, this.t / 2.5))) * 0.6;
      if (this.t > 2.5) this.state = 'napping';
    } else if (this.state === 'leaping') {
      // a crouch, then two metres straight up, a stretch out at the top, and a squashy landing
      const crouch = 0.25;
      const air = 1.3;
      if (this.t < crouch) stretch = 1 - Math.sin((this.t / crouch) * Math.PI) * 0.3;
      else if (this.t < crouch + air) {
        const k = (this.t - crouch) / air;
        y += Math.sin(k * Math.PI) * 2.0;
        stretch = 1 + Math.sin(k * Math.PI) * 0.25;
        head = 0.5;
      } else if (this.t < crouch + air + 0.3) stretch = 1 - Math.sin(((this.t - crouch - air) / 0.3) * Math.PI) * 0.35;
      else {
        this.state = 'napping';
        this.alert = 4;
      }
    } else if (this.state === 'bounding') {
      // big springy bounds, two metres high, off out of sight
      const bound = 0.9;
      const k = (this.t % bound) / bound;
      y += Math.sin(k * Math.PI) * 1.6;
      stretch = 1 + Math.sin(k * Math.PI) * 0.2;
      head = 0.4;
      p.addScaledVector(this.hop, this.t * 3.2);
      const h = this.ground.at(p.x, p.z);
      y = (Number.isNaN(h) ? this.spot.y : h) + Math.sin(k * Math.PI) * 1.6;
      if (this.t > 5) {
        b.hide();
        this.gone = true;
        return;
      }
    } else {
      // napping: slow breaths, and a sniff of the air now and then
      if ((this.nextSniff -= dt) <= 0) {
        this.sniff = 2.5;
        this.nextSniff = rand(6, 14);
      }
      this.sniff -= dt;
      this.alert -= dt;
      const up = this.sniff > 0 ? Math.sin(Math.min(1, (2.5 - this.sniff) / 2.5) * Math.PI) : 0;
      head = up * 0.35 + (this.alert > 0 ? 0.3 : 0);
    }
    p.y = y;
    b.root.position.copy(p);
    orient(b.root, this.heading);
    b.root.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch)).multiplyScalar(this.size);
    const body = b.part('body');
    if (body && this.state === 'napping') body.scale.y *= 1 + Math.sin(clock * 1.1) * 0.05;
    const hd = b.part('head');
    if (hd) {
      hd.rotation.z += head;
      // a twitch of the snout while it sniffs
      if (this.sniff > 0) hd.rotation.y += Math.sin(clock * 14) * 0.05;
    }
  }
}

// --- the balloonbug ------------------------------------------------------------------------

/**
 * A balloonbug, on a still, warm afternoon in spring or summer: blown up like a hot-air balloon,
 * drifting over the island with what wind there is, legs dangling. Some days it has eaten its
 * fill of midges halfway across: it lets itself down and flutters into the grass. Clicked, it
 * puffs itself up and bobs higher.
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
      const fine = LUCK.balloonbugSoon || (LUCK.balloonbug && (o.season === 'spring' || o.season === 'summer')
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
    const fine = LUCK.foshaSoon || (LUCK.fosha && o.night > 0.75 && o.cloud < 0.25 && o.fog < 0.2 && o.wet < 0.03);
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

/**
 * A treestrider, on a misty morning: five metres of stilt legs under a leaf-green back, wading through
 * the shallows off the island on its way to somewhere else, the mist round its knees. It walks
 * like a harvestman, two legs at a time. Clicked, it stops, turns its head to look at you,
 * and walks on.
 */
class Treestrider {
  readonly body: Body;
  private t = -1;
  private wait = LUCK.treestriderSoon ? 2 : rand(20, 100);
  private from = V();
  private dir = V();
  private walked = 0;
  private stride = 0;
  private stop = 0;
  private done = false;
  private lastStep = 0;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.body = new Body('treestrider', template, scene);
  }

  get here() {
    return this.t >= 0;
  }

  poke() {
    if (this.t >= 0) this.stop = 4;
  }

  /** Whether the water's deep enough to wade in here (and not so deep it would swim). */
  private wading(p: THREE.Vector3) {
    const h = this.ground.at(p.x, p.z);
    return Number.isNaN(h) || h < -0.4;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (this.t < 0) {
      const fine = LUCK.treestriderSoon || (LUCK.treestrider && o.fog > 0.3 && o.night < 0.5 && o.storm < 0.1 && o.wind < 8);
      if (this.done || !fine || (this.wait -= dt) > 0) return;
      // across the bay to the south-east, in front of the island, one way or the other
      const east = chance(0.5);
      this.from.copy(east ? B(46, -24) : B(-8, -34));
      this.dir.copy(east ? B(-8, -34) : B(46, -24)).sub(this.from).setY(0).normalize();
      this.walked = 0;
      this.t = 0;
      b.show(this.from);
    }
    b.relax();
    this.t += dt;
    this.stop -= dt;
    const pace = this.stop > 0 ? 0 : 0.9;
    this.walked += pace * dt;
    this.stride += pace * dt * 1.1;
    const p = this.from.clone().addScaledVector(this.dir, this.walked);
    // a sway as the weight goes from one pair of legs to the other
    p.y = Math.abs(Math.sin(this.stride * Math.PI)) * 0.12;
    b.root.position.copy(p);
    orient(b.root, headingOf(this.dir.x, this.dir.z), 0, Math.sin(this.stride * Math.PI) * 0.04);
    // legs in diagonal pairs: front-left with back-right, then the others
    for (const [tag, phase] of [['leg_fl', 0], ['leg_br', 0], ['leg_fr', 1], ['leg_bl', 1]] as const) {
      const leg = b.part(tag);
      if (!leg) continue;
      const swing = Math.sin((this.stride + phase) * Math.PI);
      leg.rotation.y += swing * 0.12;
      leg.rotation.x += Math.max(0, swing) * 0.04 * (tag.endsWith('l') ? 1 : -1);
    }
    // a splash where a foot comes down
    const step = Math.floor(this.stride * 2);
    if (step !== this.lastStep && pace > 0) {
      this.lastStep = step;
      const side = V(-this.dir.z, 0, this.dir.x).multiplyScalar(step % 2 ? 1.3 : -1.3);
      const foot = p.clone().add(side).addScaledVector(this.dir, 1.7).setY(0);
      if (this.wading(foot)) splash(this.particles, foot, 0.5);
    }
    const head = b.part('head');
    if (head) {
      if (this.stop > 0) {
        // round to look at you, and down a little
        const k = Math.sin(Math.min(1, (4 - this.stop) / 1.2) * Math.PI / 2) * Math.min(1, this.stop);
        head.rotation.y += -0.9 * k;
        head.rotation.z -= 0.25 * k;
      } else head.rotation.y += Math.sin(clock * 0.25) * 0.2;
    }
    if (this.walked > 60) {
      b.hide();
      this.t = -1;
      this.done = true; // once a visit is plenty
    }
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
      orient(b.root, m.heading + (m.mode === 'reach' ? Math.sin(t * 0.4) * 0.4 : 0), -m.lean);
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
      const pulse = (0.85 + Math.sin(t * (1.6 + (m.seed % 1))) * 0.15) * this.swell(m.home, clock);
      if (tip) tip.scale.setScalar(0.5 + m.glow * 1.3 * pulse);
      m.halo.visible = true;
      m.halo.position.copy(m.pos).add(V(0, 0.45 * m.size, 0));
      m.halo.scale.setScalar(1.7 * m.size * (0.8 + m.glow * 0.4));
      const halo = m.halo.material as THREE.SpriteMaterial;
      halo.opacity = 0.4 * m.glow * pulse * this.on;
      halo.color.copy(this.tinted(m.home, clock));
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
      this.snorble = new Snorble(snorble, scene, ground);
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
    return [...(this.mosslits?.bodies ?? []), ...[this.snorble, this.balloonbug, this.fosha, this.treestrider, this.tromb].filter((c) => !!c).map((c) => c.body)];
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
