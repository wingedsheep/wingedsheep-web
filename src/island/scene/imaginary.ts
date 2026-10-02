import * as THREE from 'three';
import type { Ground } from './beike';
import { Body, headingOf, orient, splash, type Call } from './fauna';
import type { Particles } from './particles';
import type { Outlook } from './sightings';

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
    for (const at of [B(-8, -13.6), B(13, -15.2)].sort(() => Math.random() - 0.5)) {
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
 * A treestrider, on a misty morning: five metres of stilt legs and a leafy back, wading through
 * the shallows off the island on its way to somewhere else, the mist round its knees. It walks
 * like a harvestman, two legs at a time. Clicked, it stops, turns its long head to look at you,
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

/**
 * Mosslits, on a damp night: three little snails in the moss at the edge of the woods, glowing so
 * they can find each other, their tail-lights pulsing. They creep along, very slowly. Clicked,
 * they dim one after the other, and then, one by one, light up again.
 */
class Mosslits {
  readonly body: Body;
  private on = 0;
  private wait = LUCK.mosslitsSoon ? 1 : rand(10, 60);
  private spot = V();
  private heading = rand(0, Math.PI * 2);
  private dim = -1;
  private crawl = 0;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.body = new Body('mosslits', template, scene);
    // out from under the trees (whose crowns would hide them), where the moss runs onto the grass
    const at = pick([B(-13.6, -8.8), B(23.5, -9.5)]);
    if (firm(ground, at, 0.3, 4)) this.spot.copy(at).setY(ground.at(at.x, at.z));
  }

  get here() {
    return this.body.shown;
  }

  poke() {
    if (this.body.shown && this.dim < 0) this.dim = 0;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (!this.spot.lengthSq()) return;
    const fine = LUCK.mosslitsSoon || (LUCK.mosslits && o.night > 0.6 && (o.wet > 0.02 || o.fog > 0.2 || o.season === 'autumn') && o.season !== 'winter');
    if (!b.shown) {
      if (!fine || (this.wait -= dt) > 0) return;
      b.show(this.spot);
      this.on = 0;
    }
    // they light up as the dark comes on, and go out with it
    this.on = damp(this.on, fine ? 1 : 0, 0.5, dt);
    if (!fine && this.on < 0.02) {
      b.hide();
      this.wait = rand(30, 90);
      return;
    }
    b.relax();
    // at a snail's pace, about a hand's width a minute
    this.crawl = Math.min(0.6, this.crawl + dt * 0.002);
    const p = this.spot.clone().add(V(Math.cos(this.heading) * this.crawl, 0, -Math.sin(this.heading) * this.crawl));
    const h = this.ground.at(p.x, p.z);
    if (!Number.isNaN(h)) p.y = h;
    b.root.position.copy(p);
    orient(b.root, this.heading);
    if (this.dim >= 0) this.dim += dt;
    if (this.dim > 7) this.dim = -1;
    for (let i = 0; i < 3; i++) {
      const snail = b.part(`snail_${i}`);
      const light = b.part(`light_${i}`);
      // dimmed one after the other, then back on one by one
      const d = this.dim < 0 ? 0 : clamp(Math.min((this.dim - i * 0.4) * 3, (5 - this.dim + i * 0.5) * 1.5), 0, 1);
      const glow = this.on * (1 - d);
      if (snail) snail.position.x += Math.sin(clock * 0.3 + i * 2) * 0.01;
      if (!light) continue;
      light.scale.multiplyScalar(Math.max(0.01, glow * (0.8 + Math.sin(clock * (1.4 + i * 0.3) + i) * 0.35)));
      // and a mote of their light drifting up off the tip now and then, which is what you see first
      if (glow > 0.5 && chance(dt * 2.5)) {
        this.particles.emit({
          position: light.getWorldPosition(V()), velocity: V(rand(-0.05, 0.05), rand(0.15, 0.35), rand(-0.05, 0.05)),
          color: pick(['#7cffc8', '#d8fff0']), life: rand(1.2, 2.2), size: 1, wobble: 0.3, fadeIn: 0.3,
        });
      }
    }
  }
}

/** The imaginary creatures, run alongside the rare sightings. */
export class Imaginary {
  private snorble?: Snorble;
  private balloonbug?: Balloonbug;
  private fosha?: Fosha;
  private treestrider?: Treestrider;
  private mosslits?: Mosslits;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(scene: THREE.Scene, template: (species: string) => THREE.Object3D | undefined, ground: Ground, particles: Particles) {
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
    if (mosslits && LUCK.mosslits) this.mosslits = new Mosslits(mosslits, scene, ground, particles);
  }

  get bodies() {
    return [this.snorble, this.balloonbug, this.fosha, this.treestrider, this.mosslits].filter((c) => !!c).map((c) => c.body);
  }

  /** How many times the snorble's been woken, for its lines. */
  get snorbleWoken() {
    return this.snorble?.woken ?? 0;
  }

  poke(id: string) {
    if (id === 'snorble') this.snorble?.poke();
    if (id === 'balloonbug') this.balloonbug?.poke();
    if (id === 'fosha') this.fosha?.poke();
    if (id === 'treestrider') this.treestrider?.poke();
    if (id === 'mosslits') this.mosslits?.poke();
  }

  update(dt: number, o: Outlook, clock: number) {
    this.snorble?.update(dt, o, clock);
    this.balloonbug?.update(dt, o, clock);
    this.fosha?.update(dt, o, clock);
    this.treestrider?.update(dt, o, clock);
    this.mosslits?.update(dt, o, clock);
  }
}
