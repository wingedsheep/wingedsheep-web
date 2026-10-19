import * as THREE from 'three';
import type { Ground } from './beike';
import { occasions } from './calendar';
import { Body, headingOf, orient, type Call } from './fauna';
import type { Particles } from './particles';
import type { Outlook } from './sightings';

/**
 * Halloween's monsters (tools/models/monsters.py), out only in the week before Halloween, after
 * dark: the Headless Horseman galloping a lap of the island now and then, and something very
 * tall wandering the eastern woods, now and then stepping out of them to look at you. And on
 * some nights, not all: a ghost ship out of the mist offshore, a witch on her broomstick, a
 * Nazgûl on its fell beast, and the Grimm Troupe's tent on the grass (each visit gets at least
 * one of those four). `?animal=horseman` (or `tallone`, `ghostship`, `witch`, `nazgul`, `grimm`)
 * brings one along soon, whatever the day.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const chance = (p: number) => Math.random() < p;
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
const smooth = (k: number) => THREE.MathUtils.smoothstep(k, 0, 1);

const ASKED = (() => {
  try {
    return new URLSearchParams(location.search).get('animal');
  } catch {
    return null;
  }
})();
/** Whether there are monsters about at all on this visit. */
export const haunted = occasions.has('halloween') || ['horseman', 'tallone', 'ghostship', 'witch', 'nazgul', 'grimm'].includes(ASKED ?? '');

/**
 * Which of the rarer ones are out on this visit: each a bit under one visit in two, and never
 * none of them, so a night's visit in Halloween week always meets one (and most of them, over the week).
 */
const ABOUT = (() => {
  const all = ['ghostship', 'witch', 'nazgul', 'grimm'] as const;
  const out = Object.fromEntries(all.map((k) => [k, chance(0.45)])) as Record<(typeof all)[number], boolean>;
  if (!all.some((k) => out[k])) out[pick([...all])] = true;
  return out;
})();

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

/**
 * A body made its own, so it can come and go through the mist in dithered steps, the way the
 * mist itself is drawn: `fade` 0 not there … 1 all there. A ghost casts no shadow, either.
 */
class Haze {
  readonly fade = { value: 0 };
  private pairs: [THREE.MeshToonMaterial, THREE.MeshToonMaterial][] = [];

  constructor(root: THREE.Object3D) {
    const own = new Map<THREE.Material, THREE.MeshToonMaterial>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      const src = mesh.material as THREE.MeshToonMaterial;
      let mat = own.get(src);
      if (!mat) {
        mat = src.clone();
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uFade = this.fade;
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uFade;\nconst float HAZE[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);')
            .replace(
              '#include <clipping_planes_fragment>',
              /* glsl */ `#include <clipping_planes_fragment>
              ivec2 hz = ivec2(gl_FragCoord.xy) & 3;
              if ((HAZE[hz.x + hz.y * 4] + 0.5) / 16.0 > uFade) discard;`,
            );
        };
        mat.customProgramCacheKey = () => 'haze';
        own.set(src, mat);
        this.pairs.push([src, mat]);
      }
      mesh.material = mat;
    });
  }

  /** Its lamps brighten after dark with everyone else's (the Sky turns up the shared ones). */
  sync() {
    for (const [src, own] of this.pairs) own.emissiveIntensity = src.emissiveIntensity;
  }
}

/** A puff of the evening mist, curling up round `at`. */
function mist(particles: Particles, at: THREE.Vector3, spread: number, n = 1) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(0, spread);
    particles.emit({
      position: at.clone().add(V(Math.cos(a) * r, rand(0, 0.5), Math.sin(a) * r)),
      velocity: V(rand(-0.2, 0.2), rand(0.1, 0.4), rand(-0.2, 0.2)),
      color: chance(0.5) ? '#c8d0dc' : '#a6aec0', life: rand(1.5, 3), gravity: -0.05, size: chance(0.4) ? 2 : 1,
    });
  }
}

/** Where the ghost ship sails: across the south, between the end of the pier and the ferry's lane. */
const GHOSTSHIP = { z: 35, size: 1.7, speed: 1.1 };
/** Her mastheads (monsters.py, in the model's own metres), where St Elmo's fire flickers. */
const MASTHEADS = [V(2.0, 6.0, 0), V(-0.1, 5.5, 0), V(-2.2, 5.4, 0)];

/**
 * A ghost ship, on some evenings (or any hour in a fog): she comes up out of the mist offshore, sails a way along the south of the island against the
 * wind, pitching and rolling in a gale nobody else has, her rags of sails flapping and her
 * lantern swinging, green fire at her mastheads and no wake behind her, and then she isn't
 * there. Look at her and the captain turns his head to you; look again and she's gone.
 */
class GhostShip {
  readonly body: Body;
  private haze: Haze;
  private x = 0;
  private dir = 1;
  /** Where she started to show, and where she'll be gone. */
  private end = 0;
  private on = false;
  private leaving = false;
  private wait = ASKED === 'ghostship' ? 3 : rand(25, 120);
  private glow = new THREE.PointLight('#7dffb0', 0, 14, 1.4);
  private look = 0;
  private looked = 0;
  private fire = 0;
  onCall?: Say;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private particles: Particles) {
    this.body = new Body('ghostship', template, scene);
    this.body.root.scale.setScalar(GHOSTSHIP.size);
    this.haze = new Haze(this.body.root);
    scene.add(this.glow);
  }

  /** Clicked: the captain turns his head to look at you; the second time, she's gone. */
  poke() {
    if (!this.on || this.leaving) return;
    this.onCall?.('shipbell', this.body.root.position.clone());
    if (++this.looked >= 2) this.leaving = true;
    this.look = 6;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    const fine = ASKED === 'ghostship' || (ABOUT.ghostship && occasions.has('halloween') && (o.night > 0.3 || o.fog > 0.35));
    this.glow.intensity = 0;
    if (!this.on) {
      if (!fine || (this.wait -= dt) > 0) return;
      // up out of the mist somewhere off to one side, and gone again somewhere along
      this.dir = chance(0.5) ? 1 : -1;
      this.x = -this.dir * rand(26, 40);
      this.end = this.dir * rand(8, 34);
      this.on = true;
      this.leaving = false;
      this.looked = 0;
      this.haze.fade.value = 0;
      b.show(V(this.x, 0, GHOSTSHIP.z));
      this.onCall?.('ghostship', b.root.position.clone(), true);
    }
    if (!fine || this.dir * (this.x - this.end) > 0) this.leaving = true;
    const fade = this.haze.fade;
    fade.value = clamp(fade.value + (this.leaving ? -dt / 5 : dt / 6), 0, 1);
    if (this.leaving && fade.value <= 0) {
      this.on = false;
      b.hide();
      this.wait = ASKED === 'ghostship' ? 20 : rand(240, 540);
      return;
    }
    this.haze.sync();
    this.x += this.dir * GHOSTSHIP.speed * dt;
    b.relax();
    // pitching and rolling in a gale of her own, whatever the sea's doing
    const heave = Math.sin(clock * 0.8) * 0.18 + Math.sin(clock * 1.9) * 0.05;
    const roll = Math.sin(clock * 0.62) * 0.11 + Math.sin(clock * 1.37 + 1) * 0.04;
    const pitch = Math.sin(clock * 0.8 - 0.9) * 0.05;
    b.root.position.set(this.x, heave, GHOSTSHIP.z);
    orient(b.root, this.dir > 0 ? 0 : Math.PI, pitch, roll);
    for (let k = 0; k < 3; k++) {
      const sail = b.part(`sail_${k}`);
      if (sail) sail.rotation.y += Math.sin(clock * 0.45 + k * 1.7) * 0.07; // yards working on their masts
      const rag = b.part(`rag_${k}`);
      if (rag) {
        rag.rotation.x += 0.45 + Math.sin(clock * 5.3 + k * 2) * 0.2 + Math.sin(clock * 8.1 + k) * 0.08; // streaming out, cracking
        rag.rotation.z += Math.sin(clock * 3.7 + k) * 0.18;
      }
    }
    const lantern = b.part('lantern');
    if (lantern) {
      // hanging straight down whatever she does, a beat late
      lantern.rotation.x -= roll * 1.2 + Math.sin(clock * 0.62 - 0.6) * 0.05;
      lantern.rotation.z -= pitch * 1.2 + Math.sin(clock * 1.1) * 0.06;
    }
    const captain = b.part('captain');
    if (captain) {
      this.look = Math.max(0, this.look - dt);
      const toYou = Math.atan2(Math.sin(-Math.PI / 2 - (this.dir > 0 ? 0 : Math.PI)), Math.cos(-Math.PI / 2 - (this.dir > 0 ? 0 : Math.PI)));
      const k = this.look > 0 ? smooth(Math.min(1, (6 - this.look) / 1.5)) * smooth(Math.min(1, this.look / 1.5)) : 0;
      captain.rotation.y += Math.sin(clock * 0.3) * 0.15 * (1 - k) + toYou * k;
    }
    // her lamps, green on the water about her; St Elmo's fire at the mastheads
    this.glow.position.copy(b.root.position).add(V(-this.dir * 5, 3, 0));
    this.glow.intensity = 7 * fade.value * (0.85 + Math.sin(clock * 2.3) * 0.15);
    if ((this.fire -= dt) <= 0) {
      this.fire = rand(0.05, 0.25);
      const at = b.root.localToWorld(pick(MASTHEADS).clone());
      if (fade.value > 0.6) {
        this.particles.emit({
          position: at.add(V(rand(-0.2, 0.2), rand(0, 0.3), rand(-0.2, 0.2))),
          velocity: V(rand(-0.2, 0.2), rand(0.2, 0.6), rand(-0.2, 0.2)), color: chance(0.5) ? '#7dffb0' : '#c8ffe0', life: rand(0.4, 0.9), gravity: -0.2, fadeIn: 0,
        });
      }
    }
    // no wake: she doesn't touch the water. Only the mist, coming off her as she comes and goes
    if (fade.value < 0.95 || chance(dt * 3)) mist(this.particles, b.root.position.clone().add(V(rand(-6, 6), 0, 0)), 2.5, fade.value < 0.95 ? 2 : 1);
  }
}

/**
 * A way through the sky, flown at an even speed: where along it, which way it's heading, and
 * how far it's banked into the turn it's making (leaning into it, as anything with wings does).
 */
class Flight {
  private path?: THREE.CatmullRomCurve3;
  private length = 1;
  /** How far along, 0..1; -1 when not flying. */
  u = -1;
  heading = 0;
  bank = 0;

  start(points: THREE.Vector3[]) {
    this.path = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.length = this.path.getLength();
    this.u = 0;
    const t = this.path.getTangentAt(0);
    this.heading = headingOf(t.x, t.z);
    this.bank = 0;
    return this.path.getPointAt(0);
  }

  get flying() {
    return this.u >= 0;
  }

  /** On by `metres`: where it is now, the way it's going, and its pitch (nose up into a climb). */
  advance(metres: number, dt: number, steep = 4) {
    const path = this.path!;
    this.u = Math.min(1, this.u + metres / this.length);
    const at = path.getPointAt(this.u);
    const tangent = path.getTangentAt(this.u);
    const heading = headingOf(tangent.x, tangent.z);
    const yaw = Math.atan2(Math.sin(heading - this.heading), Math.cos(heading - this.heading));
    this.heading = heading;
    this.bank = damp(this.bank, clamp((-yaw / Math.max(dt, 1e-3)) * 0.55, -0.8, 0.8), steep, dt);
    return { at, tangent, pitch: Math.asin(clamp(tangent.y, -0.6, 0.6)) * 0.8, done: this.u >= 1 };
  }

  land() {
    this.u = -1;
  }
}

/** The lighthouse's lamp (layout.py, buildings.py): she goes round it once and a half. */
const LAMP = V(LIGHTHOUSE.x, 15, LIGHTHOUSE.z);
const CAMPFIRE = V(27, 0, 1);
/** How fast she flies, m/s. */
const BROOMSTICK = 7;

/**
 * A witch on her broomstick, now and then on a dark night: in from off the island at one end,
 * low over the campfire's green flames, across the middle, round the lighthouse lamp once and a
 * half (through the bats), and away out to sea. She banks into the turns, her cloak and hair
 * streaming, the cat on the back hanging on and the little pumpkin lantern on the front swinging
 * back; sparks off the bristles. Wave at her and she loops the loop, cackling.
 */
class Witch {
  readonly body: Body;
  private flight = new Flight();
  private wait = ASKED === 'witch' ? 3 : rand(30, 120);
  private loop = -1;
  private cackled = false;
  private spark = 0;
  private lamp = new THREE.PointLight('#ffb347', 0, 7, 1.5);
  private glance = { now: 0, goal: 0, next: 0 };
  onCall?: Say;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.body = new Body('witch', template, scene);
    scene.add(this.lamp);
  }

  /** Waved at: a loop-the-loop, and a cackle. */
  poke() {
    if (!this.flight.flying || this.loop >= 0) return;
    this.loop = 0;
    this.onCall?.('flyby', this.body.root.position.clone());
  }

  private route() {
    const h = this.ground.at(CAMPFIRE.x, CAMPFIRE.z);
    const fire = V(CAMPFIRE.x - 1, (Number.isNaN(h) ? 1 : h) + 3.4, CAMPFIRE.z + 1.5);
    const pts = [V(80, 20, rand(-25, 0)), V(42, 10, rand(-6, 6)), fire, V(12, 9.5, rand(-1, 7)), V(-12, 12, rand(-7, 3))];
    // round the lamp, from its east side, once and a half
    const turn = chance(0.5) ? 1 : -1;
    for (let k = 0; k <= 9; k++) {
      const a = turn * k * (Math.PI / 3);
      pts.push(V(LAMP.x + Math.cos(a) * 8, LAMP.y + Math.sin(k * 1.3) * 0.8, LAMP.z + Math.sin(a) * 8));
    }
    pts.push(V(-62, 19, rand(8, 26)), V(-95, 24, rand(20, 40)));
    return chance(0.5) ? pts.reverse() : pts;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    const fine = ASKED === 'witch' || (ABOUT.witch && occasions.has('halloween') && o.night > 0.55 && o.storm < 0.3 && o.wind < 16 && o.wet < 0.6);
    this.lamp.intensity = 0;
    if (!this.flight.flying) {
      if (!fine || (this.wait -= dt) > 0) return;
      b.show(this.flight.start(this.route()));
      this.cackled = false;
      this.loop = -1;
    }
    // slowing right down at the top of a loop, so it looks like one
    const looping = this.loop >= 0;
    if (looping) this.loop += dt / 1.9;
    const k = looping ? Math.min(1, this.loop) : 0;
    if (this.loop >= 1) this.loop = -1;
    const step = this.flight.advance(BROOMSTICK * (1 - 0.8 * Math.sin(Math.PI * k)) * dt, dt);
    if (step.done) {
      b.hide();
      this.flight.land();
      this.wait = ASKED === 'witch' ? 15 : rand(200, 480);
      return;
    }
    const { at, tangent } = step;
    const heading = this.flight.heading;
    let pitch = step.pitch;
    // the loop: up and over, all the way round, and on
    const theta = Math.PI * 2 * smooth(k);
    if (looping) {
      at.addScaledVector(V(tangent.x, 0, tangent.z).normalize(), Math.sin(theta) * 1.6);
      at.y += (1 - Math.cos(theta)) * 1.6;
      pitch += theta;
    }
    at.y += Math.sin(clock * 2.1) * 0.15 + Math.sin(clock * 0.9) * 0.1;
    b.relax();
    b.root.position.copy(at);
    const bank = this.flight.bank;
    orient(b.root, heading, pitch, bank + Math.sin(clock * 1.7) * 0.04);
    // everything loose on her streaming back, flapping
    const cloak = b.part('cloak');
    if (cloak) cloak.rotation.z += Math.sin(clock * 9) * 0.12 - 0.05;
    const tail = b.part('cloak_tail');
    if (tail) {
      tail.rotation.z += Math.sin(clock * 9 - 1.3) * 0.3;
      tail.rotation.x += Math.sin(clock * 6.3) * 0.12;
    }
    const hair = b.part('hair');
    if (hair) {
      hair.rotation.z += Math.sin(clock * 11) * 0.12;
      hair.rotation.x += Math.sin(clock * 7.3) * 0.1;
    }
    const tip = b.part('hat_tip');
    if (tip) tip.rotation.z += Math.sin(clock * 5.2) * 0.3;
    // her head turning to look about, and down at you as she goes over
    const g = this.glance;
    if (clock > g.next) {
      g.goal = chance(0.4) ? clamp(Math.atan2(Math.sin(-Math.PI / 2 - heading), Math.cos(-Math.PI / 2 - heading)), -1.1, 1.1) : rand(-0.6, 0.6);
      g.next = clock + rand(1, 3);
    }
    g.now = damp(g.now, g.goal, 5, dt);
    const head = b.part('head');
    if (head) {
      head.rotation.y += g.now;
      head.rotation.z -= Math.max(0, -pitch) * 0.5 + (looping ? Math.sin(theta) * 0.3 : 0);
    }
    // the cat: hanging on through the turns, tail lashing
    const cat = b.part('cat');
    if (cat) {
      cat.rotation.x -= bank * 0.6;
      cat.rotation.z -= looping ? Math.sin(theta) * 0.4 : 0;
    }
    const catTail = b.part('cat_tail');
    if (catTail) catTail.rotation.x += Math.sin(clock * 3.3) * 0.5;
    // the lantern, swinging back in the rush of air and hanging plumb through the banking
    const lantern = b.part('lantern');
    if (lantern) {
      lantern.rotation.x -= bank + Math.sin(clock * 2.4) * 0.12;
      lantern.rotation.z += 0.45 - (looping ? 0 : pitch) + Math.sin(clock * 3.1) * 0.15;
    }
    this.lamp.position.copy(at).add(V(0, -0.2, 0));
    this.lamp.intensity = 5 * (0.85 + Math.sin(clock * 13) * 0.1 + Math.sin(clock * 7) * 0.05);
    // sparks off the bristles, falling behind her
    if ((this.spark -= dt) <= 0) {
      this.spark = rand(0.02, 0.08);
      this.particles.emit({
        position: b.root.localToWorld(V(-1.6, 0, 0)), velocity: V(rand(-0.4, 0.4), rand(-0.3, 0.3), rand(-0.4, 0.4)),
        color: pick(['#ffb347', '#ffe08a', '#c890ff']), life: rand(0.4, 1), gravity: 0.6, fadeIn: 0,
      });
    }
    // and a cackle, once, as she comes over
    if (!this.cackled && Math.abs(at.x) < 14 && at.z > -16) {
      this.cackled = true;
      this.onCall?.('flyby', at.clone(), true);
    }
  }
}

/** How big the fell beast flies (it's built at about four metres nose to tail), and how fast. */
const FELL = { size: 1.35, speed: 9 };

/**
 * A Nazgûl on its fell beast, now and then on a dark night: it comes in high from off the
 * island and circles, wide and slow, once and a half round, searching, on great slow wingbeats
 * and long glides, its tail snaking behind and the rider's cloak streaming; then it drops,
 * screaming, low over the middle of the island, and climbs away into the dark. Look up at it and
 * it screams again, the beast's jaws wide.
 */
class Nazgul {
  readonly body: Body;
  private flight = new Flight();
  private wait = ASKED === 'nazgul' ? 3 : rand(40, 140);
  private screamed = false;
  private scream = 0;
  /** Its wings: a few slow beats, then a long glide. */
  private beat = 0;
  private beats = 0;
  private glide = 0;
  onCall?: Say;

  constructor(template: THREE.Object3D, scene: THREE.Scene) {
    this.body = new Body('nazgul', template, scene);
    this.body.root.scale.setScalar(FELL.size);
  }

  poke() {
    if (!this.flight.flying || this.scream > 0) return;
    this.scream = 2.5;
    this.onCall?.('screech', this.body.root.position.clone());
  }

  private route() {
    const pts = [V(95, 34, rand(-45, -25)), V(55, 26, -18)];
    const centre = V(rand(-4, 4), 0, rand(-6, 0));
    const turn = chance(0.5) ? 1 : -1;
    const from = Math.atan2(-18 - centre.z, 55 - centre.x);
    for (let k = 1; k <= 12; k++) {
      const a = from + turn * k * (Math.PI / 4);
      pts.push(V(centre.x + Math.cos(a) * 28, 22 + Math.sin(k * 0.9) * 2.5, centre.z + Math.sin(a) * 24));
    }
    const last = pts[pts.length - 1];
    // and down, across the middle, low enough to set the dog barking, and away
    const across = V(-last.x, 0, -last.z).normalize();
    pts.push(V(last.x * 0.4, 9, last.z * 0.4), V(across.x * 6, 7.5, across.z * 6 - 4), V(across.x * 40, 18, across.z * 30), V(across.x * 95, 34, across.z * 70));
    return chance(0.5) ? pts.reverse() : pts;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    const fine = ASKED === 'nazgul' || (ABOUT.nazgul && occasions.has('halloween') && o.night > 0.6 && o.storm < 0.6);
    if (!this.flight.flying) {
      if (!fine || (this.wait -= dt) > 0) return;
      b.show(this.flight.start(this.route()));
      this.screamed = false;
      this.beats = 3;
      this.glide = 0;
    }
    // glides are fast, beats are slower going; and quicker again, diving
    const step = this.flight.advance(FELL.speed * dt, dt, 2);
    if (step.done) {
      b.hide();
      this.flight.land();
      this.wait = ASKED === 'nazgul' ? 20 : rand(300, 600);
      return;
    }
    const { at } = step;
    if (!this.screamed && at.y < 12) { // down out of its circling, screaming
      this.screamed = true;
      this.scream = 2.5;
      this.onCall?.('screech', at.clone(), true);
    }
    this.scream = Math.max(0, this.scream - dt);
    // a few great slow beats of its wings, then a long glide with them held out
    let flap = 0;
    let tip = 0;
    if (this.beats > 0) {
      this.beat += dt / 1.7;
      if (this.beat >= 1) {
        this.beat -= 1;
        if (--this.beats <= 0) this.glide = rand(4, 9);
      }
      flap = Math.sin(this.beat * Math.PI * 2);
      tip = Math.sin(this.beat * Math.PI * 2 - 0.9);
      at.y -= Math.cos(this.beat * Math.PI * 2) * 0.25; // lifting on each downstroke
    } else if ((this.glide -= dt) <= 0) {
      this.beats = Math.floor(rand(2, 5));
      this.beat = 0;
      if (b.root.position.distanceTo(V(0, 0, 0)) < 45) this.onCall?.('wingbeat', at.clone(), true);
    }
    b.relax();
    b.root.position.copy(at);
    const bank = this.flight.bank;
    orient(b.root, this.flight.heading, step.pitch - flap * 0.04, bank);
    for (const [side, s] of [['l', 1], ['r', -1]] as const) {
      const wing = b.part(`wing_${side}`);
      const wingtip = b.part(`wingtip_${side}`);
      // held out with a little lift in the glide; the tips flexing a beat behind the arm
      if (wing) wing.rotation.x += s * (0.12 + flap * 0.55);
      if (wingtip) wingtip.rotation.x += s * (tip * 0.45 - 0.05 + Math.sin(clock * 1.3 + s) * 0.03);
    }
    const neck = b.part('neck');
    if (neck) {
      neck.rotation.y += Math.sin(clock * 0.7) * 0.15 - bank * 0.3; // into the turn, looking where it's going
      neck.rotation.z += Math.sin(clock * 0.5) * 0.05 - (this.scream > 0 ? 0.15 : 0);
    }
    const head = b.part('head');
    if (head) {
      head.rotation.z -= 0.2 + Math.sin(clock * 0.9) * 0.08; // looking down, searching
      head.rotation.y += Math.sin(clock * 0.43) * 0.4;
    }
    const jaw = b.part('jaw');
    if (jaw) jaw.rotation.z -= this.scream > 0 ? Math.sin(Math.min(1, this.scream / 2.5) * Math.PI) * 0.7 : 0;
    const tail = b.part('tail');
    if (tail) {
      tail.rotation.y += Math.sin(clock * 1.2) * 0.18 + bank * 0.3;
      tail.rotation.z += Math.sin(clock * 0.9) * 0.06 + flap * 0.05;
    }
    const tail2 = b.part('tail_2');
    if (tail2) tail2.rotation.y += Math.sin(clock * 1.2 - 1) * 0.3;
    const cloak = b.part('cloak');
    if (cloak) {
      cloak.rotation.z += Math.sin(clock * 10) * 0.12 - 0.1;
      cloak.rotation.x += Math.sin(clock * 6.7) * 0.15;
    }
  }
}

/**
 * Where the Grimm Troupe pitches its tent (scene x, z): the bits of open grass in sight with room
 * for it (not much: it's a small tent), on the meadow west of the pier and below the lighthouse.
 * And how big it's all put up, against how it was built.
 */
const FAIRGROUNDS = [V(-16, 0, 15), V(-23.2, 0, 10.8)];
const TROUPE_SIZE = 1;
/** The Troupe Master's marks round the front of the tent (the template's own metres, scene axes). */
const MARKS = [V(1.95, 0, -0.7), V(2.6, 0, -1.7), V(0.9, 0, -1.9), V(2.8, 0, 0.3)];
/** How far out the Grimmkin go round. */
const ORBIT = 2.1;

/**
 * The Grimm Troupe (Hollow Knight), on some nights: somebody's lit the lantern, and their tent,
 * scarlet and black, comes up out of the mist on a bit of open grass. Brumm plays his accordion
 * by the door, swaying in three-four time; three Grimmkin go round and round the tent, their
 * flames flickering; the Troupe Master stands out front, the spikes of his cloak stirring, and
 * now and then he's gone in a burst of red fire and stands somewhere else. Look at him, and he
 * bows. After a couple of minutes it all goes back into the mist.
 */
class Troupe {
  readonly body: Body;
  private haze: Haze;
  private on = false;
  private leaving = false;
  private wait = ASKED === 'grimm' ? 3 : rand(30, 110);
  private stay = 0;
  private at = V();
  private mark = 0;
  /** Gone in a burst of fire: how long until he's back (and where). */
  private away = 0;
  private hop = rand(12, 20);
  private bow = 0;
  private tune = 0;
  private spark = 0;
  private light = new THREE.PointLight('#ff3040', 0, 7, 1.6);
  onCall?: Say;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.body = new Body('grimm', template, scene);
    this.body.root.scale.setScalar(TROUPE_SIZE);
    (window as any).__troupe = this; // DEBUG
    this.haze = new Haze(this.body.root);
    scene.add(this.light);
  }

  /** Clicked: the Troupe Master bows. */
  poke() {
    if (!this.on || this.leaving || this.away > 0 || this.bow > 0) return;
    this.bow = 2.6;
    this.onCall?.('grimm', this.at.clone());
  }

  /** A burst of red fire, at a point in the template. */
  private burst(local: THREE.Vector3) {
    const p = this.body.root.localToWorld(local.clone().add(V(0, 1.2, 0)));
    for (let i = 0; i < 26; i++) {
      this.particles.emit({
        position: p.clone().add(V(rand(-0.3, 0.3), rand(-1, 1), rand(-0.3, 0.3))),
        velocity: V(rand(-1.5, 1.5), rand(0, 2.5), rand(-1.5, 1.5)), color: pick(['#ff3a3a', '#ff7060', '#7a1020', '#ffb0a0']),
        life: rand(0.4, 1.1), gravity: -0.3, fadeIn: 0, size: chance(0.3) ? 2 : 1,
      });
    }
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    const fine = ASKED === 'grimm' || (ABOUT.grimm && occasions.has('halloween') && o.night > 0.35 && o.storm < 0.4 && o.wind < 15);
    this.light.intensity = 0;
    if (!this.on) {
      if (!fine || (this.wait -= dt) > 0) return;
      const grounds = FAIRGROUNDS.filter((p) => !Number.isNaN(this.ground.at(p.x, p.z)));
      this.at = pick(grounds.length ? grounds : FAIRGROUNDS).clone();
      const h = this.ground.at(this.at.x, this.at.z);
      this.at.y = Number.isNaN(h) ? 0 : h;
      this.on = true;
      this.leaving = false;
      this.stay = rand(110, 170);
      this.mark = 0;
      this.away = 0;
      this.tune = 2;
      this.haze.fade.value = 0;
      b.show(this.at);
    }
    if (!fine || (this.stay -= dt) <= 0) this.leaving = true;
    const fade = this.haze.fade;
    fade.value = clamp(fade.value + (this.leaving ? -dt / 4 : dt / 5), 0, 1);
    if (this.leaving && fade.value <= 0) {
      this.on = false;
      b.hide();
      this.wait = ASKED === 'grimm' ? 20 : rand(240, 540);
      return;
    }
    this.haze.sync();
    b.relax();
    b.root.position.copy(this.at);
    orient(b.root, headingOf(0, 1) + 0.25); // its door to you, near enough
    if (fade.value < 0.95) mist(this.particles, this.at, 3, 2);

    // the Troupe Master: there, then gone in a burst of fire, and there again somewhere else
    const master = b.part('master');
    if (master) {
      if (this.away > 0) {
        this.away -= dt;
        if (this.away <= 0) this.burst(MARKS[this.mark]);
      } else if (!this.leaving && this.bow <= 0 && (this.hop -= dt) <= 0) {
        this.hop = rand(12, 22);
        this.burst(MARKS[this.mark]);
        this.mark = (this.mark + 1 + Math.floor(rand(0, MARKS.length - 1))) % MARKS.length;
        this.away = rand(0.6, 1.2);
        this.onCall?.('grimm', this.at.clone(), true);
      }
      master.visible = this.away <= 0;
      master.position.copy(MARKS[this.mark]);
      master.rotation.y += Math.sin(clock * 0.35) * 0.25;
      // a bow: down from the waist, one arm sweeping out and across, then slowly up again
      this.bow = Math.max(0, this.bow - dt);
      const k = this.bow > 0 ? Math.sin(Math.min(1, (2.6 - this.bow) / 2.6) * Math.PI) : 0;
      const torso = b.part('torso');
      if (torso) {
        torso.rotation.z -= k * 0.85;
        torso.rotation.x += Math.sin(clock * 0.8) * 0.05;
      }
      const head = b.part('head');
      if (head) {
        head.rotation.z -= k * 0.3 - Math.sin(clock * 0.6) * 0.05;
        head.rotation.x += Math.sin(clock * 0.45) * 0.12;
      }
      const armR = b.part('arm_r');
      if (armR) {
        armR.rotation.x -= k * 1.1 + 0.15;
        armR.rotation.z += k * 0.9 + Math.sin(clock * 0.9) * 0.08;
      }
      const armL = b.part('arm_l');
      if (armL) {
        armL.rotation.x += 0.15 + k * 0.3;
        armL.rotation.z -= k * 0.6 - Math.sin(clock * 0.9 + 1) * 0.08;
      }
      const cape = b.part('cape');
      if (cape) {
        cape.rotation.x += Math.sin(clock * 1.3) * 0.06;
        cape.rotation.z += Math.sin(clock * 1.1) * 0.05 + k * 0.4; // flaring out behind as he bows
        cape.scale.y *= 1 + Math.sin(clock * 2.1) * 0.04;
      }
    }

    // Brumm at his accordion: squeezing it in and out, swaying in three-four time
    const waltz = clock * (Math.PI * 2) / 1.5; // one bar every second and a half
    const bellows = b.part('brumm_bellows');
    const squeeze = Math.sin(waltz / 2);
    if (bellows) bellows.scale.z *= 1 + squeeze * 0.28;
    for (const [side, s] of [['l', 1], ['r', -1]] as const) {
      const arm = b.part(`brumm_arm_${side}`);
      if (arm) arm.rotation.x += s * squeeze * 0.12;
    }
    const brumm = b.part('brumm');
    if (brumm) {
      brumm.rotation.x += Math.sin(waltz / 2) * 0.09;
      brumm.position.y += Math.abs(Math.sin(waltz * 1.5)) * 0.03; // a little bob on every beat
    }
    const brummHead = b.part('brumm_head');
    if (brummHead) brummHead.rotation.x += Math.sin(waltz / 2 + 0.5) * 0.15;

    // the Grimmkin, round and round the tent, bobbing, flames flickering
    for (let i = 0; i < 3; i++) {
      const kin = b.part(`kin_${i}`);
      if (!kin) continue;
      const a = clock * 0.5 + (i * Math.PI * 2) / 3;
      kin.position.set(Math.cos(a) * ORBIT, 1.3 + Math.sin(clock * 2.3 + i * 2) * 0.2, Math.sin(a) * ORBIT);
      kin.rotation.y = -a - Math.PI; // facing the way they're going (round anticlockwise from above)
      kin.rotation.z += Math.sin(clock * 3 + i) * 0.15;
      const flame = b.part(`kin_${i}_flame`);
      if (flame) flame.scale.set(1, 1 + Math.sin(clock * 13 + i * 3) * 0.2 + Math.sin(clock * 21 + i) * 0.1, 1);
    }
    const lanternFlame = b.part('lantern_flame');
    if (lanternFlame) lanternFlame.scale.set(1 + Math.sin(clock * 17) * 0.08, 1 + Math.sin(clock * 11) * 0.2 + Math.sin(clock * 23) * 0.1, 1);
    const flag = b.part('flag');
    if (flag) {
      flag.rotation.y += Math.sin(clock * 1.7) * 0.4;
      flag.rotation.x += Math.sin(clock * 5.3) * 0.15;
    }
    if (fade.value > 0.6 && (this.spark -= dt) <= 0) {
      this.spark = rand(0.08, 0.25);
      const kin = b.part(`kin_${Math.floor(rand(0, 3))}`);
      if (kin) {
        this.particles.emit({
          position: kin.getWorldPosition(V()).add(V(0, 0.4, 0)), velocity: V(rand(-0.2, 0.2), rand(0.4, 0.9), rand(-0.2, 0.2)),
          color: chance(0.5) ? '#ff5060' : '#ffb0a0', life: rand(0.3, 0.7), gravity: -0.2, fadeIn: 0,
        });
      }
    }
    this.light.position.copy(this.at).add(V(0, 1.4, 1.5));
    this.light.intensity = 3.5 * fade.value * (0.85 + Math.sin(clock * 9) * 0.08 + Math.sin(clock * 15) * 0.05);
    // and the waltz, on the accordion, now and again
    if (!this.leaving && (this.tune -= dt) <= 0) {
      this.tune = rand(50, 80);
      this.onCall?.('troupe', this.at.clone(), true);
    }
  }
}

export class Monsters {
  private horseman?: Horseman;
  private tallone?: TallOne;
  private ghostship?: GhostShip;
  private witch?: Witch;
  private nazgul?: Nazgul;
  private troupe?: Troupe;
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
    const d = template('ghostship');
    if (d) {
      this.ghostship = new GhostShip(d, scene, particles);
      this.ghostship.onCall = say;
    }
    const w = template('witch');
    if (w) {
      this.witch = new Witch(w, scene, ground, particles);
      this.witch.onCall = say;
    }
    const n = template('nazgul');
    if (n) {
      this.nazgul = new Nazgul(n, scene);
      this.nazgul.onCall = say;
    }
    const g = template('grimm');
    if (g) {
      this.troupe = new Troupe(g, scene, ground, particles);
      this.troupe.onCall = say;
    }
  }

  /** The Horseman's hooves, 0..1 (see Horseman.hooves). */
  hooves(target: THREE.Vector3, view: number) {
    return this.horseman?.hooves(target, view) ?? 0;
  }

  get bodies() {
    return [this.horseman?.body, this.tallone?.body, this.ghostship?.body, this.witch?.body, this.nazgul?.body, this.troupe?.body].filter((b): b is Body => !!b);
  }

  poke(id: string) {
    if (id === 'horseman') this.horseman?.poke();
    if (id === 'tallone') this.tallone?.poke();
    if (id === 'ghostship') this.ghostship?.poke();
    if (id === 'witch') this.witch?.poke();
    if (id === 'nazgul') this.nazgul?.poke();
    if (id === 'grimm') this.troupe?.poke();
  }

  update(dt: number, o: Outlook, clock: number) {
    this.horseman?.update(dt, o, clock);
    this.tallone?.update(dt, o, clock);
    this.ghostship?.update(dt, o, clock);
    this.witch?.update(dt, o, clock);
    this.nazgul?.update(dt, o, clock);
    this.troupe?.update(dt, o, clock);
  }
}
