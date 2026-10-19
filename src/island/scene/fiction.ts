import * as THREE from 'three';
import type { Ground } from './beike';
import { Body, headingOf, orient, type Call } from './fauna';
import { toon } from './toon';
import type { Island } from './island';
import type { Particles } from './particles';
import { season, type SeasonName } from './season';
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
/** Round to a heading, a little at a time. */
const turn = (from: number, to: number, k: number, dt: number) =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * (1 - Math.exp(-k * dt));
/** The way you're looking from: the camera's to the south, so "at you" is south. */
const AT_YOU = headingOf(0, 1);

/**
 * Visitors out of the books on Vincent's shelf (tools/models/fiction.py): each very rarely, and
 * only in its own weather. `?animal=<name>` brings one along soon, whatever the weather.
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
    hippogriff: want('hippogriff') || odds(1 / 12, 1 / 10, 1 / 16, 1 / 24),
    hippogriffSoon: want('hippogriff'),
    // only on a misty night, and not every one of those
    mistborn: want('mistborn') || chance(1 / 3),
    mistbornSoon: want('mistborn'),
    // improbable, which is to say: hardly ever, and in any weather
    petunias: want('petunias') || want('spermwhale') || chance(1 / 30),
    petuniasSoon: want('petunias') || want('spermwhale'),
    // on a properly windy day, quite often
    windspren: want('windspren') || chance(1 / 3),
    windsprenSoon: want('windspren'),
    // only very late, and hardly ever: nobody wants them about
    chandrian: want('chandrian') || chance(1 / 10),
    chandrianSoon: want('chandrian'),
  };
})();

type Say = (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

// --- the hippogriff ------------------------------------------------------------------------

/** Where he comes down: the grass at the top of the beach, west of the pier. */
const PADDOCK = B(-8.5, -16);
/** His way in: from far out to the south-west, down to skim the sea past the end of the pier, up over the east of the island, round, and down. */
const ARRIVAL = [V(-95, 14, 70), V(-58, 3, 44), V(-36, -0.2, 33), V(-14, -0.25, 33.5), V(6, -0.1, 32.5), V(19, 4.5, 24), V(24, 10, 8), V(9, 12, -3), V(-10, 12, 1), V(-16, 5.5, 10)];
const FLY = 10;

/**
 * A hippogriff, out of Prisoner of Azkaban, on a fine day now and then. He comes in from far
 * out to sea, down to skim the water past the end of the pier with his talons trailing in it,
 * up over the east of the island and round, and down onto the grass at the top of the beach,
 * flaring, his front talons reaching. There he folds his wings and stands about the way they
 * do: looking round with that proud head, preening under a wing, pawing at the ground,
 * shaking his feathers out, his tail swishing. Bow to him (click) and, after a long look, he
 * bows back; the third time he lets you near and then he's off, running at the sea, up and away.
 */
class Hippogriff {
  readonly body: Body;
  private state: 'away' | 'flying' | 'standing' | 'leaving' = 'away';
  private wait = LUCK.hippogriffSoon ? 3 : rand(30, 200);
  private path?: THREE.CatmullRomCurve3;
  private length = 1;
  private u = 0;
  private heading = 0;
  private bank = 0;
  private phase = 0;
  private beat = 0.5;
  private st = 0;
  private stay = 0;
  /** What he's doing on the ground, and for how much longer. */
  private act: { kind: 'look' | 'preen' | 'paw' | 'shake' | 'turn'; left: number; side: number } = { kind: 'look', left: 3, side: 1 };
  private look = { now: 0, goal: 0, next: 0, tilt: 0 };
  private bow = -1;
  private stare = 0;
  private pokes = 0;
  private fold = 0;
  private spray = 0;
  onCall?: Say;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.body = new Body('hippogriff', template, scene);
  }

  get here() {
    return this.state === 'standing';
  }

  /** How many times you've bowed to him this time. */
  get bows() {
    return this.pokes;
  }

  /** Bowed to: a long look back at you, and then a bow; the third time, he's had enough company. */
  poke() {
    if (this.state !== 'standing' || this.bow >= 0) return;
    this.pokes++;
    if (this.pokes === 1) {
      this.stare = 2.2;
      this.bow = 0;
    } else if (this.pokes === 2) this.stare = 4;
    else this.leave();
    this.act = { kind: 'look', left: 4, side: 1 };
  }

  private fly(points: THREE.Vector3[]) {
    this.path = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.length = this.path.getLength();
    this.u = 0;
    const t = this.path.getTangentAt(0);
    this.heading = headingOf(t.x, t.z);
  }

  private leave() {
    this.state = 'leaving';
    this.st = 0;
    // out at the sea, the long way round from where he's facing
    const p = this.body.root.position.clone();
    const away = V(rand(-0.4, 0.6), 0, 1).normalize();
    this.heading = turn(this.heading, headingOf(away.x, away.z), 50, 1);
    const fwd = V(Math.cos(this.heading), 0, -Math.sin(this.heading));
    this.fly([p.clone(), p.clone().addScaledVector(fwd, 4).setY(p.y + 0.3), p.clone().addScaledVector(fwd, 12).setY(p.y + 4), p.clone().addScaledVector(fwd, 40).setY(12), p.clone().addScaledVector(fwd, 110).setY(26)]);
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    const fine = LUCK.hippogriffSoon || (LUCK.hippogriff && o.night < 0.35 && o.wet < 0.15 && o.storm < 0.05 && o.wind < 12 && o.fog < 0.5);
    if (this.state === 'away') {
      if (!fine || (this.wait -= dt) > 0) return;
      const h = this.ground.at(PADDOCK.x, PADDOCK.z);
      this.fly([...ARRIVAL, PADDOCK.clone().setY(Number.isNaN(h) ? 0.4 : h)]);
      this.state = 'flying';
      this.pokes = 0;
      this.fold = 0;
      b.show(this.path!.getPointAt(0));
      this.onCall?.('eagle', b.root.position.clone(), true);
    }
    this.st += dt;
    b.relax();
    if (this.state === 'flying' || (this.state === 'leaving' && this.st > 1.1)) this.flight(dt, clock);
    else if (this.state === 'leaving') this.runUp(dt, clock);
    else this.stand(dt, clock);
    if (this.state === 'standing' && !fine && this.bow < 0) this.leave(); // rain coming: he's off
  }

  /** On the wing: beating, gliding, skimming, banking round, and flaring to land. */
  private flight(dt: number, clock: number) {
    const b = this.body;
    const path = this.path!;
    const landing = this.state === 'flying';
    const left = (1 - this.u) * this.length;
    // slowing right down over the last few metres, to land
    const speed = landing ? FLY * clamp(left / 14, 0.22, 1) : Math.min(FLY * 1.3, 4 + this.st * 3);
    this.u = Math.min(1, this.u + (speed * dt) / this.length);
    const at = path.getPointAt(this.u);
    const tan = path.getTangentAt(this.u);
    const heading = headingOf(tan.x, tan.z);
    const yaw = Math.atan2(Math.sin(heading - this.heading), Math.cos(heading - this.heading));
    this.heading = heading;
    this.bank = damp(this.bank, clamp((-yaw / Math.max(dt, 1e-3)) * 0.5, -0.7, 0.7), 3, dt);
    const flare = landing ? smooth(clamp((9 - left) / 7, 0, 1)) : 0;
    const climb = clamp(tan.y * 2, -1, 1);
    const skim = at.y < 0.6 && !flare ? 1 : 0;
    // beating when climbing or slowing, gliding (wings a little up) when coming down or skimming
    const wantBeat = flare ? 0.95 : skim ? 0.12 : climb > 0.05 ? 0.7 : climb < -0.08 ? 0.1 : 0.4;
    this.beat = damp(this.beat, wantBeat, 3, dt);
    this.phase += dt * Math.PI * 2 * (1.3 + this.beat * 1.2);
    const pitch = Math.asin(clamp(tan.y, -0.5, 0.5)) * 0.8 + flare * 0.65 + Math.sin(this.phase) * 0.03 * this.beat;
    b.root.position.copy(at).add(V(0, -Math.sin(this.phase) * 0.12 * this.beat, 0));
    orient(b.root, heading, pitch, this.bank);
    this.wings(Math.sin(this.phase) * (0.12 + 0.8 * this.beat) + 0.14 * (1 - this.beat), Math.sin(this.phase - 0.7) * 0.5 * this.beat, 0);
    // neck stretched out ahead, head level; legs tucked back, or reaching down into the water, or forward to land
    const neck = b.part('neck');
    const head = b.part('head');
    if (neck) neck.rotation.z -= 0.65 * (1 - flare) - 0.1 * flare;
    if (head) head.rotation.z += 0.45 * (1 - flare) - pitch * 0.5;
    const reach = Math.max(skim, flare);
    for (const s of ['l', 'r']) {
      const f = b.part(`leg_f${s}`);
      const sh = b.part(`shin_f${s}`);
      const h = b.part(`leg_b${s}`);
      const hk = b.part(`hock_b${s}`);
      if (f) f.rotation.z += -1.25 * (1 - reach) + 0.55 * reach;
      if (sh) sh.rotation.z += 1.1 * (1 - reach) - 0.35 * reach;
      if (h) h.rotation.z += -0.95 * (1 - flare) + 0.35 * flare;
      if (hk) hk.rotation.z += 0.5 * (1 - flare);
    }
    const tail = b.part('tail');
    if (tail) {
      tail.rotation.z -= 1.15 - flare * 0.5;
      tail.rotation.y += Math.sin(clock * 6) * 0.12;
    }
    // his talons in the water: spray thrown up behind
    if (skim && (this.spray -= dt) <= 0) {
      this.spray = 0.03;
      for (const s of ['l', 'r']) {
        const shin = b.part(`shin_f${s}`);
        if (!shin) continue;
        const foot = shin.localToWorld(V(0, -0.45, 0));
        if (foot.y > 0.35) continue;
        const back = V(-Math.cos(heading), 0, Math.sin(heading));
        this.particles.emit({
          position: foot.setY(0.05), velocity: back.multiplyScalar(rand(1, 3)).add(V(rand(-0.6, 0.6), rand(0.8, 2.2), rand(-0.6, 0.6))),
          color: pick(['#ffffff', '#e2f2fa', '#bfe3f0']), life: rand(0.4, 0.8), gravity: -8, fadeIn: 0,
        });
      }
    }
    if (this.u >= 1) {
      if (landing) {
        this.state = 'standing';
        this.st = 0;
        this.stay = rand(100, 170);
        this.onCall?.('thump', b.root.position.clone(), true);
      } else {
        b.hide();
        this.state = 'away';
        this.wait = rand(900, 1800); // once in a visit, mostly
      }
    }
  }

  /** Three or four galloping strides at the sea, wings going, and up. */
  private runUp(dt: number, clock: number) {
    const b = this.body;
    const path = this.path!;
    this.u = Math.min(1, this.u + (Math.min(FLY, 2 + this.st * 6) * dt) / this.length);
    const at = path.getPointAt(this.u);
    const h = this.ground.at(at.x, at.z);
    b.root.position.copy(at).setY(Number.isNaN(h) ? at.y : Math.max(h, at.y));
    this.phase += dt * Math.PI * 2 * 2.4;
    orient(b.root, this.heading, Math.sin(clock * 14) * 0.05 + this.st * 0.15);
    const open = smooth(clamp(this.st / 0.5, 0, 1));
    this.wings(Math.sin(this.phase) * 0.9 * open, Math.sin(this.phase - 0.7) * 0.5 * open, 1 - open);
    const g = clock * 11;
    for (const [s, k] of [['l', 0], ['r', Math.PI]] as const) {
      b.part(`leg_f${s}`)?.rotation.set(0, 0, Math.sin(g + k) * 0.6);
      b.part(`leg_b${s}`)?.rotation.set(0, 0, Math.sin(g + k + 1.6) * 0.55);
      b.part(`shin_f${s}`)?.rotation.set(0, 0, Math.max(0, Math.sin(g + k - 1)) * 0.9);
    }
  }

  /** Wings, as flap (up, about x), the hands bending after them, and how folded away (0 spread, 1 folded along his back). */
  private wings(flap: number, hand: number, fold: number) {
    const b = this.body;
    for (const [s, side] of [['l', 1], ['r', -1]] as const) {
      const w = b.part(`wing_${s}`);
      const h = b.part(`hand_${s}`);
      if (w) {
        w.rotation.x += side * (flap * (1 - fold) - 0.55 * fold);
        w.rotation.y += side * 1.45 * fold;
        w.rotation.z -= 0.18 * fold;
      }
      if (h) {
        h.rotation.x += side * hand * (1 - fold);
        h.rotation.y += side * 0.3 * fold;
      }
    }
  }

  private stand(dt: number, clock: number) {
    const b = this.body;
    const root = b.root;
    const h = this.ground.at(root.position.x, root.position.z);
    if (!Number.isNaN(h)) root.position.y = damp(root.position.y, h, 8, dt);
    // touching down: a hop, the wings settling
    const settle = smooth(clamp(this.st / 1.6, 0, 1));
    this.fold = settle;
    // what he's up to, one thing after another
    const a = this.act;
    if (this.bow < 0 && this.stare <= 0 && (a.left -= dt) <= 0) {
      const kinds: (typeof a.kind)[] = ['look', 'look', 'preen', 'paw', 'shake', 'turn'];
      const kind = this.st < 3 ? 'shake' : pick(kinds);
      this.act = { kind, left: kind === 'look' ? rand(3, 7) : kind === 'shake' ? 1.6 : kind === 'turn' ? 2.2 : rand(2.5, 4.5), side: chance(0.5) ? 1 : -1 };
    }
    let pitch = Math.sin(clock * 1.1) * 0.01;
    let drop = 0;
    let neckY = 0;
    let neckZ = 0;
    let headY = 0;
    let headZ = 0;
    let open = 0;
    const legs = { fl: 0, fr: 0, bl: 0, br: 0, shin: 0 };
    // looking about, now and then right at you
    const look = this.look;
    if (clock > look.next) {
      look.goal = chance(0.3) ? Math.atan2(Math.sin(AT_YOU - this.heading), Math.cos(AT_YOU - this.heading)) : rand(-1.1, 1.1);
      look.tilt = rand(-0.25, 0.25);
      look.next = clock + rand(1.2, 3.5);
    }
    if (this.stare > 0) {
      this.stare -= dt;
      look.goal = clamp(Math.atan2(Math.sin(AT_YOU - this.heading), Math.cos(AT_YOU - this.heading)), -1.5, 1.5);
      look.tilt = 0.15;
    }
    look.now = damp(look.now, look.goal, 6, dt);
    switch (this.stare > 0 || this.bow >= 0 ? 'look' : a.kind) {
      case 'look':
        neckY = look.now * 0.45;
        headY = look.now * 0.55;
        headZ = look.tilt;
        break;
      case 'preen': // head round and under a wing, nibbling, the wing lifted a little off his side
        neckY = a.side * 1.25;
        neckZ = -0.35;
        headY = a.side * 0.9;
        headZ = -0.7 + Math.sin(clock * 9) * 0.12;
        open = 0.3;
        break;
      case 'paw': { // a front talon raking at the ground, the way a horse paws
        const r = Math.sin(clock * 5);
        legs[a.side > 0 ? 'fl' : 'fr'] = 0.35 + r * 0.35;
        legs.shin = -0.4 - Math.max(0, r) * 0.4;
        neckZ = -0.25;
        headZ = -0.3;
        if (r < -0.9 && chance(dt * 20)) {
          const foot = b.part(a.side > 0 ? 'shin_fl' : 'shin_fr')?.localToWorld(V(0, -0.45, 0));
          if (foot) this.particles.emit({ position: foot, velocity: V(rand(-0.5, 0.5), rand(0.4, 1), rand(-0.5, 0.5)), color: '#a3713f', life: 0.5, gravity: -4 });
        }
        break;
      }
      case 'shake': { // a shiver from the neck back, every feather out, and smoothed down again
        const s = Math.sin(clamp(1 - a.left / 1.6, 0, 1) * Math.PI);
        root.rotation.x += Math.sin(clock * 38) * 0.06 * s;
        neckY = Math.sin(clock * 30) * 0.25 * s;
        open = 0.45 * s;
        b.part('body')?.scale.multiplyScalar(1 + 0.05 * s);
        break;
      }
      case 'turn': { // a few steps round to face somewhere else
        this.heading += a.side * 0.55 * dt;
        const g = clock * 7;
        legs.fl = Math.sin(g) * 0.3;
        legs.fr = -Math.sin(g) * 0.3;
        legs.bl = -Math.sin(g) * 0.25;
        legs.br = Math.sin(g) * 0.25;
        break;
      }
    }
    // the bow: front legs folding, chest down, head low; held a moment, and up
    if (this.bow >= 0 && this.stare <= 0) {
      this.bow += dt;
      const down = this.bow < 1 ? smooth(this.bow) : this.bow < 3 ? 1 : 1 - smooth((this.bow - 3) / 1.2);
      pitch -= 0.32 * down;
      drop = 0.32 * down;
      legs.fl = legs.fr = 0.75 * down;
      legs.shin = -1.5 * down;
      legs.bl = legs.br = -0.3 * down;
      neckY = 0;
      neckZ = -0.55 * down;
      headZ = -0.45 * down;
      if (this.bow > 4.2) this.bow = -1;
    }
    const n = b.part('neck');
    const hd = b.part('head');
    if (n) {
      n.rotation.y += neckY;
      n.rotation.z += neckZ;
    }
    if (hd) {
      hd.rotation.y += headY;
      hd.rotation.z += headZ;
    }
    const jaw = b.part('jaw');
    if (jaw && a.kind === 'preen' && this.bow < 0) jaw.rotation.z -= Math.max(0, Math.sin(clock * 9)) * 0.25;
    for (const s of ['fl', 'fr', 'bl', 'br'] as const) {
      const l = b.part(`leg_${s}`);
      if (l) l.rotation.z += legs[s];
    }
    for (const s of ['fl', 'fr'] as const) {
      const sh = b.part(`shin_${s}`);
      if (sh) sh.rotation.z += (legs[s] > 0.1 ? legs.shin : 0) + (1 - settle) * 0.3;
    }
    // breathing, and the tail swishing at flies
    b.part('body')?.scale.multiplyScalar(1 + Math.sin(clock * 1.6) * 0.012);
    const tail = b.part('tail');
    if (tail) {
      tail.rotation.x += Math.sin(clock * 2.3) * 0.25 + (chance(dt * 0.4) ? 0.4 : 0);
      tail.rotation.z -= 0.1;
    }
    this.wings(0, 0, this.fold * (1 - open));
    b.part('body')?.position.add(V(0, -drop - (1 - settle) * 0.15 * Math.sin(settle * Math.PI), 0));
    orient(root, this.heading, pitch);
    if (this.st > this.stay && this.bow < 0) this.leave();
  }
}

// --- the Mistborn -------------------------------------------------------------------------

/** The plaza's lamp posts, the dock's, the library's and the campfire's (models.py), in Blender's (x, y): iron to Push on, and tops to stand on. */
const LAMPS = [[-5.2, -5], [5.2, -5], [-5, -11.6], [5, -11.6], [-1.6, -17.1], [-5, -7.9], [23, -4]].map(([x, y]) => B(x, y));
const LAMP_TOP = 2.88;
/** Roofs to land on: which building, and where on it (Blender x, y). */
const ROOFS: [string, number, number][] = [['lighthouse', -31.5, -3], ['library', -9.6, -4.5], ['workshop', 11.5, -4.5], ['well', 20, -14], ['hut', 14.2, 16.4]];
const STEEL = new THREE.MeshBasicMaterial({ color: '#9cc8ff', transparent: true, opacity: 0.85, depthWrite: false, fog: false });
const STEEL_LINE = new THREE.BoxGeometry(1, 0.05, 0.05).translate(0.5, 0, 0);
const COIN = new THREE.MeshBasicMaterial({ color: '#e8c060' });

/** One of the lines Steelsight shows her, from her chest to a bit of metal. */
class Line {
  readonly mesh = new THREE.Mesh(STEEL_LINE, STEEL.clone());
  life = 0;
  max = 1;
  to = V();
  constructor(scene: THREE.Scene) {
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  show(to: THREE.Vector3, life: number) {
    this.to.copy(to);
    this.life = this.max = life;
  }

  update(dt: number, from: THREE.Vector3) {
    this.life -= dt;
    this.mesh.visible = this.life > 0;
    if (this.life <= 0) return;
    const d = this.to.clone().sub(from);
    this.mesh.position.copy(from);
    this.mesh.quaternion.setFromUnitVectors(V(1, 0, 0), d.clone().normalize());
    this.mesh.scale.set(d.length(), 1, 1);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * clamp(this.life / Math.min(0.3, this.max), 0, 1);
  }
}

/** Somewhere she can land: on top of a roof or a lamp post, or on the ground (the summit). */
type Perch = { at: THREE.Vector3; lamp: boolean };

/**
 * A Mistborn, on a misty night: one coin tinks on a roof somewhere, and then she comes in out
 * of the mist in one long arc onto the top of the lighthouse, and goes across the island the way
 * they get about, roof to lamp post to roof: crouch, flick a coin down, and Push off it (a thin
 * blue line from her to the coin for as long as she's pushing), up in an arc with the ribbons of
 * her mistcloak streaming, now and then a flip, down into a crouch, and up to look about, the
 * cloak stirring; now and then the faint lines of all the iron around her flicker into sight.
 * At the far side, one last long Push away into the mist. Look at her and she's gone.
 */
class Mistborn {
  readonly body: Body;
  private perches: Perch[] = [];
  private route: Perch[] = [];
  private state: 'away' | 'perched' | 'crouch' | 'flying' = 'away';
  private wait = LUCK.mistbornSoon ? 3 : rand(40, 200);
  private st = 0;
  private stay = 0;
  private from = V();
  private to = V();
  private apex = 0;
  private time = 1;
  private heading = 0;
  private flip = 0;
  private leaving = false;
  private look = { now: 0, goal: 0, next: 0 };
  private squat = 0;
  private coin: THREE.Mesh;
  private coinAt = V();
  private coinFall = -1;
  private lines: Line[];
  private sight = rand(3, 8);
  onCall?: Say;

  constructor(template: THREE.Object3D, scene: THREE.Scene, island: Island, ground: Ground, private particles: Particles) {
    this.body = new Body('mistborn', template, scene);
    this.coin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 8), COIN);
    this.coin.visible = false;
    scene.add(this.coin);
    this.lines = Array.from({ length: 4 }, () => new Line(scene));
    // the tops of the roofs she can land on: drop a ray onto each building
    const ray = new THREE.Raycaster();
    for (const [id, x, y] of ROOFS) {
      const o = island.get(id);
      if (!o) continue;
      o.updateMatrixWorld(true);
      ray.set(V(x, 80, -y), V(0, -1, 0));
      const hit = ray.intersectObject(o, true)[0];
      if (hit) this.perches.push({ at: hit.point.clone(), lamp: false });
    }
    for (const l of LAMPS) {
      const h = ground.at(l.x, l.z);
      if (!Number.isNaN(h)) this.perches.push({ at: l.clone().setY(h + LAMP_TOP), lamp: true });
    }
    const summit = island.positionOf('summit');
    if (summit) this.perches.push({ at: summit.clone().add(V(0.8, 0, 0.6)), lamp: false });
  }

  get here() {
    return this.state !== 'away';
  }

  /** Looked at: she's gone, the long way, into the mist. */
  poke() {
    if (this.state === 'away' || this.leaving) return;
    this.route = [];
    if (this.state === 'perched') this.stay = 0;
  }

  /** A night's crossing: in onto the lighthouse, then four to seven perches east, one after another not too far apart. */
  private plan() {
    const west = [...this.perches].sort((a, b) => a.at.x - b.at.x);
    const route = [west[0]];
    const rest = west.slice(1).filter(() => chance(0.7));
    for (const p of rest) if (p.at.distanceTo(route[route.length - 1].at) < 26 && route.length < 8) route.push(p);
    if (chance(0.5)) route.reverse();
    return route;
  }

  private jump(to: THREE.Vector3, leaving = false) {
    this.state = 'crouch';
    this.st = 0;
    this.from.copy(this.body.root.position);
    this.to.copy(to);
    const d = Math.hypot(to.x - this.from.x, to.z - this.from.z);
    this.time = clamp(d / 11, 0.8, leaving ? 6 : 2.4);
    this.apex = Math.max(this.from.y, to.y) + 1.4 + d * 0.16;
    this.flip = !leaving && d > 9 && chance(0.35) ? 1 : 0;
    this.leaving = leaving;
    // a coin, flicked down at her feet, to Push off
    this.coinAt.copy(this.from).add(V(rand(-0.3, 0.3), 0.03, rand(-0.3, 0.3)));
    this.coin.position.copy(this.from).add(V(0.15, 0.9, 0));
    this.coin.visible = true;
    this.coinFall = 0;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    const fine = LUCK.mistbornSoon || (LUCK.mistborn && o.night > 0.55 && o.fog > 0.3 && o.storm < 0.3);
    const chest = b.root.position.clone().add(V(0, 1.3, 0));
    for (const l of this.lines) l.update(dt, chest);
    // the coin, falling to the roof, and lying there a while
    if (this.coinFall >= 0) {
      this.coinFall += dt;
      const k = smooth(Math.min(1, this.coinFall / 0.18));
      this.coin.position.lerp(this.coinAt, k);
      this.coin.rotation.x += dt * 20 * (1 - k);
      if (this.coinFall > 0.18 && this.coinFall - dt <= 0.18) this.onCall?.('tink', this.coinAt.clone(), true);
      if (this.coinFall > 8) [this.coinFall, this.coin.visible] = [-1, false];
    }
    if (this.state === 'away') {
      if (!fine || (this.wait -= dt) > 0) return;
      this.route = this.plan();
      if (this.route.length < 3) return;
      // in out of the mist, a long way off over the sea, high
      const first = this.route.shift()!;
      const off = first.at.clone().add(V(first.at.x < 0 ? -70 : 70, 22, rand(10, 40)));
      b.show(off);
      this.jump(first.at);
      this.state = 'flying';
      this.time = 4.5;
      this.apex = off.y + 2;
      this.coin.visible = false;
      this.coinFall = -1;
      this.onCall?.('tink', first.at.clone(), true);
    }
    this.st += dt;
    b.relax();
    const root = b.root;
    let crouch = 0;
    let tuck = 0;
    let lean = 0;
    let stream = 0.1 + Math.min(o.wind, 12) * 0.02;
    let pitch = 0;
    let arms = 0;
    if (this.state === 'perched') {
      // standing tall, looking out; now and then down on her heels at the edge
      if (clock > this.look.next) {
        this.look.goal = chance(0.3) ? Math.atan2(Math.sin(AT_YOU - this.heading), Math.cos(AT_YOU - this.heading)) : rand(-1.2, 1.2);
        this.look.next = clock + rand(0.8, 2.5);
      }
      this.look.now = damp(this.look.now, this.look.goal, 7, dt);
      this.squat = damp(this.squat, this.stay > 3.5 && this.st > 1.2 ? 0.75 : 0, 3, dt);
      crouch = Math.max(this.squat, this.st < 0.4 ? 1 - this.st / 0.4 : 0);
      root.position.copy(this.to);
      // Steelsight: the faint lines of all the iron near her, for a moment
      if ((this.sight -= dt) <= 0) {
        this.sight = rand(3, 7);
        const near = this.perches.filter((p) => p.lamp).map((p) => p.at.clone().add(V(0, -0.2, 0)))
          .sort((a, c) => a.distanceToSquared(root.position) - c.distanceToSquared(root.position)).slice(0, 3);
        near.forEach((p, i) => this.lines[i + 1].show(p, rand(0.6, 1.2)));
      }
      if (this.st > this.stay || !fine) {
        const next = this.route.shift();
        if (next && fine) this.jump(next.at);
        else {
          // the last long Push, out over the sea into the mist
          const away = root.position.clone().add(V(root.position.x < 0 ? -80 : 80, 18, rand(-30, 30)));
          this.jump(away, true);
        }
      }
    } else if (this.state === 'crouch') {
      crouch = smooth(Math.min(1, this.st / 0.3));
      arms = -0.6 * crouch;
      root.position.copy(this.from);
      this.heading = turn(this.heading, headingOf(this.to.x - this.from.x, this.to.z - this.from.z), 14, dt);
      if (this.st > 0.32) {
        this.state = 'flying';
        this.st = 0;
        this.lines[0].show(this.coinAt, this.leaving ? 1.2 : 0.55);
        this.mistPuff(this.from, 3);
      }
    } else {
      // in the air: up in a long arc, tucked, the ribbons streaming
      const k = Math.min(1, this.st / this.time);
      const p = this.from.clone().lerp(this.to, k);
      const lift = this.apex - Math.max(this.from.y, this.to.y);
      p.y += lift * 4 * k * (1 - k);
      root.position.copy(p);
      this.heading = turn(this.heading, headingOf(this.to.x - this.from.x, this.to.z - this.from.z), 10, dt);
      tuck = Math.sin(k * Math.PI);
      stream = 1.3 * Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (1 - smooth(clamp((k - 0.85) / 0.15, 0, 1)) * 0.7);
      pitch = -0.35 * tuck + this.flip * smooth(clamp((k - 0.25) / 0.5, 0, 1)) * -Math.PI * 2;
      arms = 0.6 * tuck;
      if (this.leaving && k > 0.4) {
        // gone into the mist
        root.visible = k < 0.97;
      }
      if (k >= 1) {
        if (this.leaving) {
          b.hide();
          this.state = 'away';
          this.wait = rand(300, 700);
          return;
        }
        this.state = 'perched';
        this.st = 0;
        this.stay = rand(1.6, 5.5);
        this.squat = 0;
        this.mistPuff(this.to, 4);
      }
    }
    orient(root, this.heading, pitch + lean);
    // her legs: crouched (thigh forward, shin back), or tucked up in the air
    const bend = Math.max(crouch * 1.15, tuck * 1.4);
    for (const s of ['l', 'r'] as const) {
      const th = b.part(`thigh_${s}`);
      const sh = b.part(`shin_${s}`);
      if (th) th.rotation.z += bend;
      if (sh) sh.rotation.z -= bend * 1.7;
    }
    const bodyPart = b.part('body');
    if (bodyPart) {
      bodyPart.position.y -= crouch * 0.38 + tuck * 0.25;
      bodyPart.rotation.z -= crouch * 0.35;
    }
    for (const [s, side] of [['l', 1], ['r', -1]] as const) {
      const a = b.part(`arm_${s}`);
      if (a) {
        a.rotation.z += arms + crouch * 0.5;
        a.rotation.x += side * -(0.15 + tuck * 0.3);
      }
    }
    const head = b.part('head');
    if (head) {
      head.rotation.y += this.state === 'perched' ? clamp(this.look.now, -1.2, 1.2) : 0;
      head.rotation.z += crouch * 0.3 + tuck * 0.25;
    }
    // the mistcloak: streaming out behind her when she flies, stirring on its own when she stands
    for (let i = 0; i < 9; i++) {
      const t = b.part(`tassel_${i}`);
      if (!t) continue;
      const flutter = Math.sin(clock * (6 + stream * 6) + i * 1.3) * (0.08 + stream * 0.14) + Math.sin(clock * 1.7 + i) * 0.05;
      t.rotation.z -= stream + flutter + crouch * 0.25;
      t.rotation.x += Math.sin(clock * 3.1 + i * 0.7) * 0.06 * (1 + stream);
    }
  }

  private mistPuff(at: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      this.particles.emit({
        position: at.clone().add(V(Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3)),
        velocity: V(Math.cos(a) * rand(0.4, 1), rand(0.05, 0.3), Math.sin(a) * rand(0.4, 1)),
        color: chance(0.5) ? '#c8d0dc' : '#a6aec0', life: rand(0.8, 1.6), gravity: 0, size: 1,
      });
    }
  }
}

// --- windspren ---------------------------------------------------------------------------

/** What they play round: the lighthouse, the library, the workshop, the well, the hut (Blender x, y). */
const GUSTS = ROOFS.map(([, x, y]) => B(x, y));
/** How many ride together, how long a trail each leaves (points), and how wide it is. */
const SPREN = 3;
const TRAIL = 36;
const RIBBON = 0.6;
/** How far apart the points along a trail are (m): a long, lazy ribbon whatever the frame rate. */
const STEP = 0.3;

/** One windspren: a ribbon of light, and where its head has been. */
class Ribbon {
  readonly geometry = new THREE.BufferGeometry();
  private points: THREE.Vector3[] = [];
  private spin = rand(0, Math.PI * 2);
  private place = new Float32Array(TRAIL * 2 * 3);
  private colour = new Float32Array(TRAIL * 2 * 4);
  constructor() {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.place, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colour, 4).setUsage(THREE.DynamicDrawUsage));
    const index: number[] = [];
    for (let i = 0; i < TRAIL - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    this.geometry.setIndex(index);
  }

  /** Whether the whole trail has caught up and gone. */
  get empty() {
    return this.points.length === 0;
  }

  /** Where its head is now (or nowhere, while the tail catches up), and how bright, 0..1. */
  update(dt: number, head: THREE.Vector3 | null, bright: number) {
    if (!head) this.points.pop();
    else if (!this.points.length || this.points[0].distanceTo(head) >= STEP) this.points.unshift(head.clone());
    else this.points[0].copy(head);
    if (this.points.length > TRAIL) this.points.length = TRAIL;
    this.spin += dt * 5;
    const n = this.points.length;
    const side = V();
    const along = V();
    for (let i = 0; i < TRAIL; i++) {
      const p = this.points[Math.min(i, n - 1)] ?? V(0, -50, 0);
      const q = this.points[Math.min(i + 1, n - 1)] ?? p;
      along.copy(i + 1 < n ? p.clone().sub(q) : V(1, 0, 0)).normalize();
      // a ribbon: flat across its way, and twisting along it
      const t = this.spin - i * 0.25;
      side.set(-along.z, 0, along.x).normalize().multiplyScalar(Math.cos(t)).addScaledVector(V(0, 1, 0), Math.sin(t) * 0.6);
      const k = i / (TRAIL - 1);
      const w = RIBBON * (i < 3 ? 0.4 + i * 0.2 : 1 - k * 0.7) * 0.5;
      for (const e of [0, 1]) {
        const v = (i * 2 + e) * 3;
        this.place[v] = p.x + side.x * w * (e ? 1 : -1);
        this.place[v + 1] = p.y + side.y * w * (e ? 1 : -1);
        this.place[v + 2] = p.z + side.z * w * (e ? 1 : -1);
        const c = (i * 2 + e) * 4;
        // white at the head, going the palest blue down the tail
        this.colour[c] = 1 - 0.35 * k;
        this.colour[c + 1] = 1 - 0.12 * k;
        this.colour[c + 2] = 1;
        this.colour[c + 3] = i < n ? bright * (1 - k ** 2) * 0.95 : 0;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}

/**
 * Windspren, out of the Stormlight Archive, on a properly windy day: little ribbons of light
 * that ride the gusts. Three of them come in on the wind past one of the buildings, chasing
 * each other, swooping and corkscrewing and every so often going right round in a loop, and
 * are gone downwind; a while later, there they are again past another one. Look at them and
 * they come round in a loop, just for you.
 */
class Windspren {
  readonly body: Body;
  private ribbons: Ribbon[] = [];
  private wait = LUCK.windsprenSoon ? 2 : rand(20, 90);
  private run = -1;
  private length = 0;
  private at = V();
  private yaw = 0;
  private pitch = 0;
  /** The path the lead one takes (each one after follows a moment behind), sampled. */
  private path: THREE.Vector3[] = [];
  private loops: number[] = [];
  private speed = 6;
  private bright = 0;

  constructor(scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (let i = 0; i < SPREN; i++) {
      const r = new Ribbon();
      this.ribbons.push(r);
      const m = new THREE.Mesh(r.geometry, material);
      m.frustumCulled = false;
      m.renderOrder = 3;
      group.add(m);
    }
    this.body = new Body('windspren', group, scene);
  }

  /** Off past another building, upwind of it, and away downwind. */
  private start(o: Outlook) {
    const down = o.drift.lengthSq() > 0.01 ? Math.atan2(-o.drift.y, o.drift.x) : rand(0, Math.PI * 2);
    const past = pick(GUSTS);
    const h = this.ground.at(past.x, past.z);
    const up = V(-Math.cos(down), 0, Math.sin(down));
    this.at.copy(past).setY((Number.isNaN(h) ? 0 : h) + rand(4, 8)).addScaledVector(up, rand(18, 24)).add(V(rand(-4, 4), 0, rand(-4, 4)));
    this.yaw = down + rand(-0.3, 0.3);
    this.pitch = 0;
    this.speed = clamp(o.wind * 0.6, 5, 9);
    this.length = rand(7, 10);
    this.loops = [rand(1.5, 3.5), rand(5, 7)].filter(() => chance(0.75));
    this.path = [this.at.clone()];
    this.run = 0;
  }

  poke() {
    if (this.run >= 0) this.loops.push(this.run + 0.15);
  }

  update(dt: number, o: Outlook, clock: number) {
    const fine = LUCK.windsprenSoon || (o.wind >= 7 && o.night < 0.4 && o.wet < 0.5);
    if (this.run < 0) {
      for (const r of this.ribbons) r.update(dt, null, this.bright);
      if (!fine || (this.wait -= dt) > 0) {
        if (this.body.shown && this.ribbons.every((r) => r.empty)) this.body.hide();
        return;
      }
      this.body.show(V());
      this.start(o);
    }
    this.run += dt;
    // the lead one: along the wind, swaying and bobbing, and now and then right round in a loop
    const looping = this.loops.find((l) => this.run > l && this.run < l + 1.1);
    if (looping !== undefined) this.pitch += dt * (Math.PI * 2) / 1.1;
    else this.pitch = damp(this.pitch % (Math.PI * 2), Math.sin(this.run * 2.3) * 0.4, 3, dt);
    const yaw = this.yaw + Math.sin(this.run * 1.7) * 0.75 + Math.sin(this.run * 3.1) * 0.25;
    const dir = V(Math.cos(this.pitch) * Math.cos(yaw), Math.sin(this.pitch), -Math.cos(this.pitch) * Math.sin(yaw));
    this.at.addScaledVector(dir, this.speed * dt);
    const floor = this.ground.at(this.at.x, this.at.z);
    this.at.y = Math.max(this.at.y, (Number.isNaN(floor) ? 0 : floor) + 1.2);
    this.path.unshift(this.at.clone());
    if (this.path.length > 60) this.path.length = 60;
    this.bright = damp(this.bright, this.run < this.length - 1 ? 1 : 0, 3, dt);
    const gone = this.run > this.length;
    // the others a moment behind, each corkscrewing round the way the lead one went
    this.ribbons.forEach((r, i) => {
      const back = this.path[Math.min(this.path.length - 1, i * 7)];
      const a = clock * 10 + i * 2.1;
      const head = i === 0 ? back : back.clone().add(V(0, Math.sin(a) * 1.3, Math.cos(a) * 1.3).applyAxisAngle(V(0, 1, 0), yaw));
      r.update(dt, gone ? null : head, this.bright);
      // and a glint or two off each of them as they go
      if (!gone && chance(dt * 5)) {
        this.particles.emit({ position: head.clone(), velocity: V(rand(-0.3, 0.3), rand(-0.2, 0.3), rand(-0.3, 0.3)), color: pick(['#ffffff', '#d8f0ff']), life: rand(0.4, 0.8), size: 2, fadeIn: 0 });
      }
    });
    if (gone) {
      this.run = -1;
      this.wait = LUCK.windsprenSoon ? rand(3, 8) : rand(25, 120);
    }
  }
}

// --- the Chandrian's fire -------------------------------------------------------------------

const BLUE = { core: new THREE.Color('#e4f0ff'), flame: new THREE.Color('#4f7dff'), embers: ['#bcd4ff', '#5a86ff'] };
/** How long it burns blue, in seconds. */
const COLD = 26;

/**
 * Very late, on a dry night, hardly ever: the campfire gutters, nearly out, and comes back
 * blue. A cold, still blue, every flame standing up straight, the light it throws gone blue
 * too and the embers with it, and everything goes quiet. Half a minute, and it gutters again
 * and comes back the ordinary colour, as if nothing had happened. The Kingkiller books have a
 * rhyme for when the fire goes blue. It doesn't say stay and look.
 */
class BlueFire {
  private flames: { mesh: THREE.Mesh; was: THREE.Material | THREE.Material[]; blue: THREE.Material; part: THREE.Object3D }[] = [];
  private wait = LUCK.chandrianSoon ? 5 : rand(60, 900);
  private t = -1;
  private done = false;
  readonly at = V();
  /** How blue it is, 0..1 (the light it throws, and the embers: life.ts). */
  blue = 0;
  onCall?: Say;

  constructor(island: Island, private particles: Particles) {
    const at = island.positionOf('campfire');
    if (at) this.at.copy(at);
    for (let i = 0; i < 3; i++) {
      const part = island.part('campfire', `flame${i}`);
      part?.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh) this.flames.push({ mesh, was: mesh.material, blue: toon(i ? BLUE.flame : BLUE.core, { glow: true }), part });
      });
    }
  }

  /** Whether it's burning blue right now. */
  get burning() {
    return this.t >= 0 && this.blue > 0.5;
  }

  /** Each frame after life.ts has flickered the flames: gutter, blue, still, gutter, back. */
  update(dt: number, o: Outlook, clock: number) {
    if (this.done || !this.flames.length) return;
    if (this.t < 0) {
      const late = o.hour >= 23 || o.hour < 4;
      const fine = LUCK.chandrianSoon || (o.night > 0.8 && late && o.wet < 0.2 && o.storm < 0.1);
      if (!fine || (this.wait -= dt) > 0) return;
      this.t = 0;
    }
    const was = this.t;
    this.t += dt;
    const t = this.t;
    // guttering down to nearly nothing on the way in and out, and the colour turns while it's low
    const low = Math.max(1 - smooth(clamp(t / 0.6, 0, 1)) + smooth(clamp((t - 0.6) / 0.8, 0, 1)) - 1, 0)
      + Math.max(smooth(clamp((t - COLD) / 0.6, 0, 1)) - smooth(clamp((t - COLD - 0.6) / 0.8, 0, 1)), 0);
    const cold = t > 0.6 && t < COLD + 0.6;
    if ((was <= 0.6 && t > 0.6) || (was <= COLD + 0.6 && t > COLD + 0.6)) {
      for (const f of this.flames) f.mesh.material = cold ? f.blue : f.was;
      if (cold) this.onCall?.('hush', this.at.clone(), false);
    }
    this.blue = cold ? smooth(clamp((t - 0.6) / 0.6, 0, 1)) * (1 - smooth(clamp((t - COLD) / 0.6, 0, 1))) : 0;
    const parts = new Set(this.flames.map((f) => f.part));
    let i = 0;
    for (const p of parts) {
      // blue, it hardly flickers: taller, and standing very straight and still
      const still = 1 + Math.sin(clock * 2.1 + i * 1.7) * 0.03;
      const y = cold ? THREE.MathUtils.lerp(p.scale.y, 1.3 * still, this.blue) : p.scale.y;
      p.scale.set(1 - low * 0.5, Math.max(0.08, y * (1 - low * 0.9)), 1 - low * 0.5);
      i++;
    }
    if (cold && chance(dt * 6)) {
      this.particles.emit({
        position: this.at.clone().add(V(rand(-0.25, 0.25), 0.5, rand(-0.25, 0.25))), velocity: V(0, rand(0.8, 1.6), 0),
        color: pick(BLUE.embers), life: rand(0.8, 1.6), size: 1,
      });
    }
    if (t > COLD + 1.6) {
      this.done = true;
      this.blue = 0;
    }
  }
}

// --- a sperm whale and a bowl of petunias ----------------------------------------------------

/** Where the bowl comes down: the grass between the library's lamp and the beach, by the plaza. */
const FLOWERBED = B(-7, -10.8);
/** How high up they're called into being, and how fast they're falling by the time they hit (m/s). */
const IMPROBABLE = 44;
const TERMINAL = 11;

/** Something falling: from where, how far it's come, how fast it's going. */
type Faller = { at: THREE.Vector3; v: number };

/**
 * Out of a clear sky, hardly ever: a little burst of light very high up over the sea, and a
 * sperm whale is suddenly there, a long way above the water, and falling. It has a great many
 * new ideas very quickly on the way down: its flippers going, its jaw dropping open, its flukes
 * beating at nothing. It hits the sea with an enormous splash; a little later it comes up a
 * way off, blows, and goes down again, rather relieved. Beside it, a bowl of petunias falls
 * onto the grass by the plaza, lands the right way up, and stays for the rest of the visit.
 */
class Improbable {
  readonly whale: Body;
  readonly bowl: Body;
  private state: 'waiting' | 'falling' | 'under' | 'surfacing' | 'done' = 'waiting';
  private wait = LUCK.petuniasSoon ? 4 : rand(60, 600);
  private st = 0;
  private w: Faller = { at: V(), v: 0 };
  private p: Faller = { at: V(), v: 0 };
  private bowlDown = -1;
  private spin = rand(-0.5, 0.5);
  private heading = rand(0, Math.PI * 2);
  private flowerbed = V();
  onCall?: Say;

  constructor(whale: THREE.Object3D, bowl: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.whale = new Body('spermwhale', whale, scene);
    this.bowl = new Body('petunias', bowl, scene);
    const h = ground.at(FLOWERBED.x, FLOWERBED.z);
    this.flowerbed.copy(FLOWERBED).setY(Number.isNaN(h) ? 0.4 : h);
  }

  /** Whether the whale's still on its way down (for what clicking it says). */
  get falling() {
    return this.state === 'falling';
  }

  /** A burst of light where something has just been, very improbably, called into being. */
  private pop(at: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const e = rand(-1, 1);
      const s = rand(2, 5);
      this.particles.emit({
        position: at.clone(), velocity: V(Math.cos(a) * s * Math.sqrt(1 - e * e), e * s, Math.sin(a) * s * Math.sqrt(1 - e * e)),
        color: pick(['#ffffff', '#ffe08a', '#9cd8ff', '#ff9ad0', '#b6ffb0']), life: rand(0.4, 0.9), drag: 3, fadeIn: 0, size: chance(0.3) ? 2 : 1,
      });
    }
  }

  update(dt: number, o: Outlook, clock: number) {
    if (this.state === 'done') {
      this.rest(dt, clock);
      return;
    }
    if (this.state === 'waiting') {
      const fine = LUCK.petuniasSoon || (LUCK.petunias && o.night < 0.6);
      if (!fine || (this.wait -= dt) > 0) return;
      this.state = 'falling';
      this.st = 0;
      this.w = { at: V(rand(5, 14), IMPROBABLE + 4, rand(25, 28)), v: 0 };
      this.p = { at: this.flowerbed.clone().add(V(rand(-1, 1), IMPROBABLE - 2, rand(-1, 1))), v: 0 };
      this.whale.show(this.w.at);
      this.bowl.show(this.p.at);
      this.pop(this.w.at, 40);
      this.pop(this.p.at, 16);
      this.onCall?.('twinkle', this.w.at.clone().setY(8), true);
    }
    this.st += dt;
    const b = this.whale;
    if (this.state === 'falling') {
      const w = this.w;
      w.v = Math.min(TERMINAL, w.v + 9.8 * dt * 0.8);
      w.at.y -= w.v * dt;
      b.relax();
      b.root.position.copy(w.at);
      // tipping nose down as it goes, turning slowly over, every fin going
      this.heading += this.spin * dt;
      const nose = -smooth(clamp(this.st / 4, 0, 1)) * 0.9;
      orient(b.root, this.heading, nose + Math.sin(this.st * 1.3) * 0.12, Math.sin(this.st * 0.9) * 0.3);
      for (const [s, side] of [['l', 1], ['r', -1]] as const) {
        const f = b.part(`flipper_${s}`);
        if (f) f.rotation.x += side * Math.sin(clock * 11 + side) * 0.7;
      }
      const fluke = b.part('fluke');
      if (fluke) fluke.rotation.z += Math.sin(clock * 5) * 0.55;
      const jaw = b.part('jaw');
      if (jaw) jaw.rotation.z -= smooth(clamp((this.st - 1) / 0.6, 0, 1)) * (0.45 + Math.sin(clock * 2.3) * 0.12);
      if (w.at.y < 1) {
        this.state = 'under';
        this.st = 0;
        b.hide();
        const at = w.at.clone().setY(0);
        this.onCall?.('splash', at, true);
        // a whale's worth of sea, straight up, and a ring of it out across the water
        for (let i = 0; i < 5; i++) {
          for (let k = 0; k < 40; k++) {
            const a = rand(0, Math.PI * 2);
            const s = rand(1.5, 6);
            this.particles.emit({
              position: at.clone().add(V(Math.cos(a) * rand(0, 4), 0.1, Math.sin(a) * rand(0, 4))),
              velocity: V(Math.cos(a) * s, rand(6, 18) * (1 - i * 0.16), Math.sin(a) * s),
              color: pick(['#ffffff', '#e2f2fa', '#bfe3f0']), life: rand(1.4, 2.6), gravity: -9, size: chance(0.6) ? 3 : 2,
            });
          }
        }
      }
    } else if (this.state === 'under') {
      if (this.st > 7) {
        // up again a way off, and none the worse
        this.state = 'surfacing';
        this.st = 0;
        this.w.at.add(V(rand(4, 12), 0, rand(3, 6)));
        b.show(this.w.at.clone().setY(-1.4));
      }
    } else if (this.state === 'surfacing') {
      b.relax();
      const up = smooth(clamp(this.st / 2, 0, 1));
      const down = smooth(clamp((this.st - 7) / 3, 0, 1));
      b.root.position.copy(this.w.at).setY(-1.4 + up * 1.1 - down * 2.2);
      orient(b.root, this.heading, -down * 0.5, Math.sin(clock * 0.6) * 0.05);
      const fluke = b.part('fluke');
      if (fluke) fluke.rotation.z += down * 0.9;
      if (this.st > 2.4 && this.st - dt <= 2.4) {
        // a blow, from the front of its head, off to the left the way theirs goes
        const spout = b.root.localToWorld(V(3.6, 1.0, -0.4));
        this.onCall?.('blow', spout, true);
        for (let i = 0; i < 30; i++) {
          this.particles.emit({
            position: spout.clone(), velocity: V(rand(-0.6, 0.6) - 0.6, rand(3, 6), rand(-0.6, 0.6)),
            color: pick(['#ffffff', '#e8f4ff']), life: rand(0.8, 1.5), gravity: -2, drag: 0.6, size: chance(0.4) ? 2 : 1,
          });
        }
      }
      if (this.st > 10) {
        b.hide();
        this.state = 'done';
      }
    }
    if (this.bowlDown < 0) this.fallBowl(dt);
    else this.rest(dt, clock);
  }

  private fallBowl(dt: number) {
    const p = this.p;
    p.v = Math.min(TERMINAL, p.v + 9.8 * dt * 0.8);
    p.at.y -= p.v * dt;
    const floor = this.ground.at(p.at.x, p.at.z);
    const r = this.bowl.root;
    r.position.copy(p.at);
    r.rotation.set(Math.sin(this.st * 2) * 0.2, this.st * 0.7, Math.cos(this.st * 1.6) * 0.2);
    if (p.at.y <= (Number.isNaN(floor) ? 0 : floor)) {
      p.at.y = Number.isNaN(floor) ? 0 : floor;
      r.position.copy(p.at);
      r.rotation.set(0, r.rotation.y, 0);
      this.bowlDown = 0;
      this.onCall?.('thump', p.at.clone(), true);
      for (let i = 0; i < 8; i++) {
        const a = rand(0, Math.PI * 2);
        this.particles.emit({ position: p.at.clone().add(V(0, 0.5, 0)), velocity: V(Math.cos(a) * rand(0.5, 1.5), rand(1, 2.5), Math.sin(a) * rand(0.5, 1.5)), color: pick(PETALS), life: rand(0.8, 1.4), gravity: -5, wobble: 2 });
      }
    }
  }

  /** The bowl, down, the right way up: a quiver, settling, and now and then in the breeze. */
  private rest(dt: number, clock: number) {
    if (this.bowlDown < 0) return;
    this.bowlDown += dt;
    const flowers = this.bowl.part('flowers');
    if (!flowers) return;
    this.bowl.relax();
    const q = Math.exp(-this.bowlDown * 2.5);
    flowers.scale.y *= 1 + Math.sin(this.bowlDown * 18) * 0.25 * q;
    flowers.rotation.x += Math.sin(clock * 1.7) * 0.02;
  }
}

const PETALS = ['#8a3fa8', '#c8408a', '#f2ece2'];

/**
 * The visitors out of Vincent's books, each rarely and only in its own weather: a hippogriff
 * on a fine day, a Mistborn on a misty night, and (improbably) a sperm whale and a bowl of
 * petunias, falling out of a clear sky.
 */
export class Fiction {
  private hippogriff?: Hippogriff;
  private mistborn?: Mistborn;
  private improbable?: Improbable;
  private windspren?: Windspren;
  private fire?: BlueFire;
  onCall?: Say;

  constructor(scene: THREE.Scene, template: (species: string) => THREE.Object3D | undefined, ground: Ground, particles: Particles, island: Island) {
    const call: Say = (c, at, ambient) => this.onCall?.(c, at, ambient);
    if (LUCK.windspren) this.windspren = new Windspren(scene, ground, particles);
    if (LUCK.chandrian) {
      this.fire = new BlueFire(island, particles);
      this.fire.onCall = call;
    }
    const whale = template('spermwhale');
    const bowl = template('petunias');
    if (whale && bowl && LUCK.petunias) {
      this.improbable = new Improbable(whale, bowl, scene, ground, particles);
      this.improbable.onCall = call;
    }
    const mistborn = template('mistborn');
    if (mistborn && LUCK.mistborn) {
      this.mistborn = new Mistborn(mistborn, scene, island, ground, particles);
      this.mistborn.onCall = call;
    }
    const hippogriff = template('hippogriff');
    if (hippogriff && LUCK.hippogriff) {
      this.hippogriff = new Hippogriff(hippogriff, scene, ground, particles);
      this.hippogriff.onCall = call;
    }
  }

  get bodies() {
    return [this.hippogriff, this.mistborn, this.windspren].filter((c) => !!c).map((c) => c.body).concat(this.improbable ? [this.improbable.whale, this.improbable.bowl] : []);
  }

  poke(id: string) {
    if (id === 'hippogriff') this.hippogriff?.poke();
    if (id === 'mistborn') this.mistborn?.poke();
    if (id === 'windspren') this.windspren?.poke();
  }

  /** How it's going with the hippogriff, for his lines: up in the air, or down and bowed to so many times. */
  get buckbeak() {
    return { down: this.hippogriff?.here ?? false, bows: this.hippogriff?.bows ?? 0 };
  }

  /** Whether the sperm whale is still on its way down. */
  get whaleFalling() {
    return this.improbable?.falling ?? false;
  }

  /** The campfire, if it's burning blue: how blue, and where (life.ts tints its light and embers). */
  get blueFire() {
    return { blue: this.fire?.blue ?? 0, at: this.fire?.at, burning: this.fire?.burning ?? false };
  }

  update(dt: number, o: Outlook, clock: number) {
    this.hippogriff?.update(dt, o, clock);
    this.mistborn?.update(dt, o, clock);
    this.improbable?.update(dt, o, clock);
    this.windspren?.update(dt, o, clock);
    this.fire?.update(dt, o, clock);
  }
}
