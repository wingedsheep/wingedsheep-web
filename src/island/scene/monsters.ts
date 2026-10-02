import * as THREE from 'three';
import type { Ground } from './beike';
import { occasions } from './calendar';
import { Body, headingOf, orient, type Call } from './fauna';
import type { Particles } from './particles';
import type { Outlook } from './sightings';

/**
 * Halloween's monsters (tools/models/monsters.py), out only in the week before Halloween, after
 * dark: the Headless Horseman galloping a lap of the island now and then, and something very
 * tall wandering the eastern woods, now and then stepping out of them to look at you. `?animal=horseman` or `?animal=tallone` brings one along soon, whatever the day.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const chance = (p: number) => Math.random() < p;
const smooth = (k: number) => THREE.MathUtils.smoothstep(k, 0, 1);

const ASKED = (() => {
  try {
    return new URLSearchParams(location.search).get('animal');
  } catch {
    return null;
  }
})();
/** Whether there are monsters about at all on this visit. */
export const haunted = occasions.has('halloween') || ASKED === 'horseman' || ASKED === 'tallone';

type Say = (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

/** The lighthouse and its keeper's house (layout.py LIGHTHOUSE, buildings.py), and how wide a berth they get. */
const LIGHTHOUSE = V(-30.6, 0, 2.6);
const LIGHTHOUSE_CLEAR = 4.0;
/** The peak (layout.py PEAK): on the far side of it, his hooves are only just heard. */
const PEAK = V(5, 0, -18.6);

/**
 * The Headless Horseman: now and then after dark, one lap of the island at a gallop, out from
 * behind the mountain and back round to it, his lantern held high, embers behind.
 */
class Horseman {
  readonly body: Body;
  private path: THREE.Vector3[] = [];
  private length = 0;
  private s = -1;
  private wait = ASKED === 'horseman' ? 3 : rand(30, 120);
  private stride = 0;
  private rear = 0;
  private laughAt = 0;
  private galloping = false;
  /** Where on the lap is right behind the mountain, out of sight: he starts and ends each lap there. */
  private behind = 0;
  onCall?: Say;

  constructor(template: THREE.Object3D, scene: THREE.Scene, ground: Ground, private particles: Particles) {
    this.body = new Body('horseman', template, scene);
    // a lap of the whole island along the top of the beach: in from the sea on every bearing to
    // the first dry land, and a little further, then smoothed so he takes the corners in a curve
    const ring: THREE.Vector3[] = [];
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      for (let r = 60; r > 3; r -= 0.25) {
        const h = ground.at(dx * r, 1 + dz * r);
        if (!Number.isNaN(h) && h > 0.06) {
          ring.push(V(dx * (r - 1.4), 0, 1 + dz * (r - 1.4)));
          break;
        }
      }
    }
    for (let pass = 0; pass < 3; pass++) {
      const n = ring.length;
      const smoothed = ring.map((p, i) => p.clone().add(ring[(i + n - 1) % n]).add(ring[(i + 1) % n]).multiplyScalar(1 / 3));
      ring.splice(0, n, ...smoothed);
    }
    // past the lighthouse on its landward side, not through it and its keeper's house (and not
    // round the seaward side of the rock, where there's nothing but water)
    for (const p of ring) {
      const dz = p.z - LIGHTHOUSE.z;
      if (Math.hypot(p.x - LIGHTHOUSE.x, dz) < LIGHTHOUSE_CLEAR) p.x = LIGHTHOUSE.x + Math.sqrt(LIGHTHOUSE_CLEAR ** 2 - dz ** 2);
    }
    for (const p of ring) {
      const h = ground.at(p.x, p.z);
      p.y = Number.isNaN(h) ? 0.1 : Math.max(h, 0.1);
    }
    this.path = ring;
    let north = 0;
    for (let i = 0; i < ring.length; i++) {
      if (ring[i].z < ring[north].z) north = i;
      this.length += ring[i].distanceTo(ring[(i + 1) % ring.length]);
    }
    for (let i = 0; i < north; i++) this.behind += ring[i].distanceTo(ring[i + 1]);
  }

  /**
   * How loud his hooves are, 0..1, for someone looking at `target` across `view` metres: louder
   * the nearer the middle of the view he is, and muffled to a faint drumming once he's round the
   * back of the mountain. It changes smoothly as he goes, so the sound swells and dies away.
   */
  hooves(target: THREE.Vector3, view: number) {
    if (!this.galloping || this.s < 0) return 0;
    const p = this.body.root.position;
    const near = THREE.MathUtils.clamp(1.15 - (p.distanceTo(target) / view) * 1.1, 0, 1);
    const north = THREE.MathUtils.smoothstep(PEAK.z + 10 - p.z, 0, 12);        // how far round the back
    const across = 1 - THREE.MathUtils.smoothstep(Math.abs(p.x - PEAK.x), 14, 26);  // …and behind the peak, not off to one side
    return near * (1 - 0.8 * north * across);
  }

  /** Clicked: the horse rears, and he laughs. */
  poke() {
    if (this.s < 0 || this.rear > 0) return;
    this.rear = 1.6;
    this.onCall?.('neigh', this.body.root.position.clone());
    setTimeout(() => this.onCall?.('headless', this.body.root.position.clone()), 500);
  }

  private at(s: number, out: THREE.Vector3) {
    const n = this.path.length;
    let d = ((s % this.length) + this.length) % this.length;
    for (let i = 0; i < n; i++) {
      const a = this.path[i];
      const b = this.path[(i + 1) % n];
      const seg = a.distanceTo(b);
      if (d <= seg) return out.lerpVectors(a, b, d / seg);
      d -= seg;
    }
    return out.copy(this.path[0]);
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (this.path.length < 3) return;
    const fine = ASKED === 'horseman' || (occasions.has('halloween') && o.night > 0.7);
    if (this.s < 0) {
      if (!fine || (this.wait -= dt) > 0) return;
      this.s = this.behind;
      this.laughAt = this.s + rand(this.length * 0.3, this.length * 0.7);
      b.show(this.at(this.s, V()));
      this.onCall?.('neigh', b.root.position.clone(), true);
    }
    if (!fine) {
      // dawn: he's gone, until tomorrow night
      this.galloping = false;
      b.hide();
      this.s = -1;
      this.wait = rand(30, 120);
      return;
    }
    b.relax();
    const rearing = this.rear > 0;
    if (rearing) this.rear -= dt;
    else this.s += dt * 7;
    if (this.s >= this.behind + this.length) {
      // one lap, and back behind the mountain he's gone, until the next time
      this.galloping = false;
      b.hide();
      this.s = -1;
      this.wait = ASKED === 'horseman' ? 15 : rand(150, 420);
      return;
    }
    const p = this.at(this.s, V());
    const ahead = this.at(this.s + 1.5, V());
    const heading = headingOf(ahead.x - p.x, ahead.z - p.z) || 0;
    this.stride += dt * (rearing ? 5 : 13);
    const g = this.stride;
    const up = rearing ? Math.sin(Math.min(1, (1.6 - this.rear) / 0.4) * Math.PI / 2) * (this.rear < 0.4 ? this.rear / 0.4 : 1) : 0;
    p.y += rearing ? up * 0.35 : Math.abs(Math.sin(g)) * 0.18;
    b.root.position.copy(p);
    orient(b.root, heading, rearing ? up * 0.6 : Math.sin(g) * 0.06);
    const swing = (name: string, phase: number, k = 0.65) => {
      const leg = b.part(name);
      if (leg) leg.rotation.z += rearing && name.startsWith('leg_f') ? 0.9 + Math.sin(g * 2 + phase) * 0.4 : Math.sin(g + phase) * k;
    };
    swing('leg_fl', 0);
    swing('leg_fr', -0.5);
    swing('leg_bl', 2.6);
    swing('leg_br', 2.1);
    const tail = b.part('tail');
    if (tail) tail.rotation.z += Math.sin(clock * 9) * 0.2 + 0.2;
    const cape = b.part('cape');
    if (cape) {
      cape.rotation.z += 0.3 + Math.sin(clock * 15) * 0.12;
      cape.rotation.x += Math.sin(clock * 11) * 0.15;
    }
    const arm = b.part('arm');
    if (arm) arm.rotation.x += Math.sin(clock * 3) * 0.1 + (rearing ? -0.3 * up : 0);
    // embers off the lantern, streaming behind him
    const lantern = b.part('lantern');
    if (lantern && chance(0.8)) {
      const at = lantern.getWorldPosition(V());
      this.particles.emit({ position: at, velocity: V(rand(-0.5, 0.5), rand(0.3, 1.2), rand(-0.5, 0.5)), color: chance(0.5) ? '#ffb040' : '#ff6020', life: rand(0.5, 1.1), gravity: 0.5, fadeIn: 0 });
    }
    this.galloping = !rearing;
    if (this.s > this.laughAt) {
      this.laughAt = Infinity;
      this.onCall?.('headless', p.clone(), true);
    }
  }
}

/** The tall one's legs (monsters.py): hip to knee, knee to ankle, and the ankle's height off the ground. */
const THIGH = 1.7;
const SHIN = 1.7;
const HIP = 3.48;
const ANKLE = 0.08;
/** Its walk: how fast it goes at full stride, how long a stride takes, and how much of it a foot is down. */
const PACE = 0.8;
const CYCLE = 3.0;
const DUTY = 0.62;
/** So how far a foot travels back under it while down, and how high it's lifted on the way forward. */
const STRIDE = PACE * DUTY * CYCLE;
const LIFT = 0.32;

/**
 * Where a foot is, a fraction `p` of the way through its stride: how far ahead of the hip, how
 * high off the ground, and how its toe tips (down as it pushes off, up as it reaches to land).
 */
function footAt(p: number) {
  p -= Math.floor(p);
  if (p < DUTY) {
    const u = p / DUTY;
    return { x: STRIDE * (0.5 - u), up: 0, toe: u < 0.15 ? 0.2 * (1 - u / 0.15) : u > 0.8 ? -0.35 * ((u - 0.8) / 0.2) : 0 };
  }
  const u = (p - DUTY) / (1 - DUTY);
  return { x: STRIDE * (smooth(u) - 0.5), up: Math.sin(Math.PI * Math.pow(u, 0.8)) * LIFT, toe: -0.35 * (1 - smooth(u * 1.6)) + 0.2 * smooth((u - 0.6) / 0.4) };
}

/**
 * Bend a leg to reach a point (x forward of the hip, y up from it): the hip's swing and the knee's
 * bend, the knee bending forward, as a person's does. Too far to reach, and it just points there.
 */
function reach(x: number, y: number) {
  const d = Math.min(Math.hypot(x, y), THIGH + SHIN - 1e-4);
  const towards = Math.atan2(x, -y);
  const hip = Math.acos(THREE.MathUtils.clamp((THIGH ** 2 + d ** 2 - SHIN ** 2) / (2 * THIGH * d), -1, 1));
  const knee = Math.PI - Math.acos(THREE.MathUtils.clamp((THIGH ** 2 + SHIN ** 2 - d ** 2) / (2 * THIGH * SHIN), -1, 1));
  return { hip: towards + hip, knee };
}

/**
 * Something very tall in the eastern woods, all night: it rises out of the forest floor at
 * nightfall (and sinks back into it at dawn), and wanders between the trees, stopping to
 * stand and listen, and now and then it steps out of them (to the edge of the campfire's
 * clearing, the grass by the path, the beach) and stands there looking at you before it goes back in.
 */
class TallOne {
  readonly body: Body;
  private out = false;
  private walking = false;
  private at = V();
  private to = V();
  private heading = 0;
  private stay = 0;
  private turn = 0;
  /** How far through its stride, in strides, and how much of a stride it's taking (it eases into a walk, and slows to a stop). */
  private step = 0;
  private gait = 0;
  private wait = ASKED === 'tallone' ? 2 : rand(20, 90);
  private outside = false;
  /** How far up out of the ground it has come, 0..1: it rises out of the forest floor at nightfall, and sinks back into it at dawn. */
  private risen = 0;
  /** Till its next cry: a long, wavering wail out of the woods every minute or so. */
  private cry = rand(15, 40);
  /** A cold light about its face, so it can be made out in the dark (its own, in the scene: never added or taken away). */
  private glow = new THREE.PointLight('#cfdcff', 0, 9, 1.2);
  onCall?: Say;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.body = new Body('tallone', template, scene);
    scene.add(this.glow);
  }

  /** Somewhere among the trees of the eastern woods (layout.py: round (24, 2), clear of the campfire). */
  private inTheWoods() {
    for (let i = 0; i < 40; i++) {
      const p = V(rand(19, 34), 0, rand(-11, 4));
      if (Math.hypot(p.x - 27, p.z - 1) > 6 && !Number.isNaN(this.ground.at(p.x, p.z))) return this.onGround(p);
    }
    return this.onGround(V(28, 0, -7));
  }

  /** One of the places just out of the trees where it comes to stand and look. */
  private outOfTheWoods() {
    const spots = [V(30.6, 0, -2.6), V(22.5, 0, 6), V(19, 0, -5.5), V(33.5, 0, 3.5), V(24, 0, -11)];
    return this.onGround(spots[Math.floor(Math.random() * spots.length)].clone());
  }

  private onGround(p: THREE.Vector3) {
    const h = this.ground.at(p.x, p.z);
    p.y = Number.isNaN(h) ? 0 : h;
    return p;
  }

  private next() {
    this.outside = !this.outside && chance(0.3);
    this.to = this.outside ? this.outOfTheWoods() : this.inTheWoods();
    this.walking = true;
  }

  /** Clicked: it turns to look straight at you, and then goes back into the trees. */
  poke() {
    if (!this.out) return;
    this.turn = 1;
    this.onCall?.('giant', this.body.root.position.clone());
    this.outside = true; // so the next place is in the woods
    this.stay = 1.5;
    this.walking = false;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    const fine = ASKED === 'tallone' || (occasions.has('halloween') && o.night > 0.8);
    this.glow.intensity = 0;
    if (!this.out) {
      if (!fine || (this.wait -= dt) > 0) return;
      this.out = true;
      this.at = this.inTheWoods();
      this.heading = rand(0, Math.PI * 2);
      this.stay = rand(4, 8);
      this.walking = false;
      this.risen = 0;
      b.show(this.at);
      this.onCall?.('giant', this.at.clone(), true);
    }
    // up out of the forest floor at nightfall, a mist curling off it; back down into it at dawn
    const was = this.risen;
    this.risen = THREE.MathUtils.clamp(this.risen + (fine ? dt : -dt) / 6, 0, 1);
    if (!fine && this.risen <= 0) {
      this.out = false;
      this.wait = rand(20, 90);
      b.hide();
      return;
    }
    const rising = this.risen < 1;
    if (rising) {
      if (fine && was === 0) this.walking = false;
      for (let i = 0; i < 3; i++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(0.3, 1.4);
        this.particles.emit({
          position: this.at.clone().add(V(Math.cos(a) * r, rand(0, 0.4), Math.sin(a) * r)),
          velocity: V(Math.cos(a) * 0.3, rand(0.4, 1.2), Math.sin(a) * 0.3),
          color: chance(0.5) ? '#9aa0b8' : '#6e6680', life: rand(1.2, 2.4), gravity: -0.1, size: chance(0.3) ? 2 : 1,
        });
      }
    }
    b.relax();
    if (this.walking && !rising) {
      const d = V(this.to.x - this.at.x, 0, this.to.z - this.at.z);
      const left = d.length();
      const want = headingOf(d.x, d.z);
      this.heading += Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)) * (1 - Math.exp(-1.5 * dt));
      this.at.addScaledVector(d.normalize(), Math.min(left, dt * PACE * this.gait));
      this.onGround(this.at);
      this.turn = Math.max(0, this.turn - dt * 0.5);
      if (left < 0.1) {
        this.walking = false;
        this.stay = this.outside ? rand(8, 14) : rand(3, 8);
        if (this.outside) this.onCall?.('giant', this.at.clone(), true);
      }
    } else if (!rising) {
      this.stay -= dt;
      // out of the trees, ever so slowly, it turns its head round to look at you
      if (this.outside) this.turn = Math.min(1, this.turn + dt * 0.25);
      if (this.stay <= 0) this.next();
    }
    // into its stride as it sets off, slowing as it nears where it's going: its feet keep pace
    // with the ground, so a shorter stride for a slower walk, and none at all standing still
    const striding = this.walking && !rising;
    const left = Math.hypot(this.to.x - this.at.x, this.to.z - this.at.z);
    const want = striding ? THREE.MathUtils.clamp(left / 1.5, 0.2, 1) : 0;
    this.gait += (want - this.gait) * (1 - Math.exp(-(want > this.gait ? 1.2 : 3) * dt));
    if (this.gait < 0.01 && !striding) this.gait = 0;
    const g = this.gait;
    if (g > 0) {
      const before = this.step;
      this.step += dt / CYCLE;
      // a heavy footfall each time a foot comes down
      if (g > 0.3 && Math.floor(before * 2) !== Math.floor(this.step * 2)) this.onCall?.('stomp', this.at.clone(), true);
    }
    const p = this.at;
    const sunk = (1 - THREE.MathUtils.smoothstep(this.risen, 0, 1)) * 7.8; // its antlers come up first
    b.root.position.copy(p).add(V(0, -sunk, 0));
    const lean = rising ? 0.2 * (1 - this.risen) : 0.12 - 0.07 * g;
    orient(b.root, this.heading, lean);
    this.glow.position.copy(b.root.position).add(V(0, 5.6, 0));
    this.glow.intensity = 9 * this.risen * (0.85 + Math.sin(clock * 1.7) * 0.15);
    if (!rising && (this.cry -= dt) <= 0) {
      this.cry = rand(45, 100);
      this.onCall?.('wail', b.root.position.clone().add(V(0, 6, 0)), true);
      this.turn = Math.max(this.turn, 0.4);
    }
    // its hips: lowest as a foot comes down, highest as it passes over the other, and swaying
    // over whichever foot is down
    const s = this.step;
    const drop = g * (0.08 + 0.05 * -Math.cos(4 * Math.PI * (s - DUTY / 2)));
    const body = b.part('body');
    if (body) {
      body.position.y -= drop;
      body.rotation.x -= g * 0.025 * Math.cos(2 * Math.PI * (s - DUTY / 2));
    }
    for (const [side, phase] of [['l', 0], ['r', 0.5]] as const) {
      const f = footAt(s + phase);
      const x = f.x * g;
      const y = -(HIP - ANKLE) + drop + f.up * g - x * lean; // the ground, under a body leaning
      const { hip, knee } = reach(x, y);
      const leg = b.part(`leg_${side}`);
      const shin = b.part(`shin_${side}`);
      const foot = b.part(`foot_${side}`);
      if (leg) leg.rotation.z += hip;
      if (shin) shin.rotation.z -= knee;
      if (foot) foot.rotation.z += -(hip - knee) - lean + f.toe * g;
      // the arm on this side swings against this leg, a beat behind, the forearm dangling after it
      const arm = b.part(`arm_${side}`);
      const forearm = b.part(`forearm_${side}`);
      if (arm) arm.rotation.z += -g * 0.22 * Math.cos(2 * Math.PI * (s + phase - 0.08)) + (side === 'l' ? -Math.sin(clock * 0.7) * 0.05 : !this.walking && this.outside ? 0.25 * this.turn : 0);
      if (forearm) forearm.rotation.z += g * (0.14 + 0.1 * Math.sin(2 * Math.PI * (s + phase - 0.2)));
    }
    const head = b.part('head');
    if (head) {
      // round towards you (the camera's always off to the south), as far as a neck will go
      const toYou = headingOf(0, 1);
      const d = Math.atan2(Math.sin(toYou - this.heading), Math.cos(toYou - this.heading));
      head.rotation.y += THREE.MathUtils.clamp(d, -1.3, 1.3) * this.turn;
      head.rotation.z += Math.sin(clock * 0.9) * 0.05 - 0.15 * this.turn + g * 0.05 * Math.cos(4 * Math.PI * (s - DUTY / 2)); // a nod with each footfall
    }
  }
}

export class Monsters {
  private horseman?: Horseman;
  private tallone?: TallOne;
  onCall?: Say;

  constructor(scene: THREE.Scene, template: (species: string) => THREE.Object3D | undefined, ground: Ground, particles: Particles) {
    if (!haunted) return;
    const say: Say = (c, at, ambient) => this.onCall?.(c, at, ambient);
    const h = template('horseman');
    if (h) {
      this.horseman = new Horseman(h, scene, ground, particles);
      this.horseman.onCall = say;
    }
    const t = template('tallone');
    if (t) {
      this.tallone = new TallOne(t, scene, ground, particles);
      this.tallone.onCall = say;
    }
  }

  /** The Horseman's hooves, 0..1 (see Horseman.hooves). */
  hooves(target: THREE.Vector3, view: number) {
    return this.horseman?.hooves(target, view) ?? 0;
  }

  get bodies() {
    return [this.horseman?.body, this.tallone?.body].filter((b): b is Body => !!b);
  }

  poke(id: string) {
    if (id === 'horseman') this.horseman?.poke();
    if (id === 'tallone') this.tallone?.poke();
  }

  update(dt: number, o: Outlook, clock: number) {
    this.horseman?.update(dt, o, clock);
    this.tallone?.update(dt, o, clock);
  }
}
