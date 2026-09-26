import * as THREE from 'three';
import type { Ground } from './beike';
import { post } from './almanac';
import { daily, occasions, onTheDay } from './calendar';
import { Body } from './fauna';
import type { Island } from './island';
import type { Particles } from './particles';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** Blender's (east, north) to a point in the scene (east, up, south). */
const B = (x: number, y: number, up = 0) => V(x, up, -y);
const PARKED = V(0, -80, 0);
const DECK = 0.78; // the top of the pier's planks
const ease = THREE.MathUtils.smootherstep;

/** Hours since midnight on the visit's calendar, at island time `time` (ms). */
export const hourAt = (time: number) => {
  const d = onTheDay(time);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};


export interface WeekWorld {
  time: number; // island time (sky.ts)
  night: number; // 0..1
  rain: number; // 0..1
  wind: number; // m/s
  windDir: THREE.Vector2; // which way it blows (world x, z; unit)
  /** Vincent, when he's on the beach with the kite: whose hands the line runs from. */
  flyer: THREE.Object3D | null;
}

export type WeekSound = 'toot' | 'gull' | 'toll' | 'toll-low' | 'aroo';

/**
 * The island's week (scene/calendar.ts has the days): the washing out on a Monday, the post boat on
 * Tuesdays and Fridays, a trawler working offshore on a Wednesday with every gull on the island
 * after it, drinks by the fire on a Friday evening, a kite on a windy Sunday and the church bell
 * across the water before ten; and at noon on the first Monday of the month, the siren test.
 * Vincent's part in it (fetching the post, flying the kite, the Saturday at his workbench) is in
 * vincent.ts; the lie-ins are in bedtime.ts.
 */
export class Week {
  readonly laundry?: Laundry;
  readonly boat?: PostBoat;
  readonly trawler?: Trawler;
  readonly kite?: Kite;
  /** The siren test: how hard it's going right now (0 when it isn't). */
  siren = 0;
  private borrel: THREE.Object3D[] = [];
  private tolled = 0;
  private sirenSaid = false;
  /** When a preview (?siren) has the siren go off, island time (ms). */
  private sirenAt: number | null = null;
  private sirenSoon = false;
  /** A noise out on the island (`at` for where it comes from, if anywhere). */
  onSound?: (kind: WeekSound, at?: THREE.Vector3) => void;
  /** The siren's just started: a word, if you're about. */
  onSiren?: () => void;

  constructor(scene: THREE.Scene, island: Island, ground: Ground, gull: THREE.Object3D | undefined, particles: Particles) {
    if (occasions.has('washday')) this.laundry = new Laundry(island);
    if (occasions.has('postday')) this.boat = new PostBoat(island, particles);
    if (occasions.has('trawler')) this.trawler = new Trawler(scene, island, gull, particles);
    if (occasions.has('sunday')) this.kite = new Kite(island);
    for (const id of ['borrel', 'borrel_mug']) {
      const o = island.get(id);
      if (o) this.borrel.push(o);
    }
    if (this.boat) this.boat.onSound = (kind, at) => this.onSound?.(kind, at);
    if (this.trawler) this.trawler.onSound = (kind, at) => this.onSound?.(kind, at);
    void ground;
  }

  /** For previews: the siren goes off in a few seconds (?siren), the post boat comes in (?post). */
  soon(what: 'siren' | 'post') {
    if (what === 'siren') this.sirenSoon = true;
    else this.boat?.soon();
  }

  /** Whether the gulls are all off after the trawler (the wrap by the fire is safe). */
  get gullsAway() {
    return this.trawler?.working ?? false;
  }

  update(dt: number, w: WeekWorld) {
    const hour = hourAt(w.time);
    this.laundry?.update(dt, w, hour);
    this.boat?.update(dt, w);
    this.trawler?.update(dt, w, hour);
    this.kite?.update(dt, w);
    // Friday: the crate comes out towards the end of the afternoon
    for (const o of this.borrel) o.visible = hour >= 16 || hour < 4;
    // Sunday: the bell over the water, calling them in to the ten o'clock service
    if (occasions.has('sunday') && hour > 9.9 && hour < 10) {
      if ((this.tolled -= dt) < 0) {
        this.tolled = 2.4;
        this.onSound?.(Math.floor(hour * 3600 / 2.4) % 3 === 2 ? 'toll-low' : 'toll');
      }
    }
    // the first Monday of the month, at noon: a minute and 26 seconds of it
    if (this.sirenSoon) {
      this.sirenSoon = false;
      this.sirenAt = w.time + 4000;
    }
    const s = this.sirenAt !== null ? (w.time - this.sirenAt) / 1000 : (hour - 12) * 3600;
    const on = this.sirenAt !== null || occasions.has('sirentest');
    this.siren = on && s >= 0 && s < 86 ? Math.min(1, s / 6, (86 - s) / 4) : 0;
    if (this.siren > 0 && !this.sirenSaid) {
      this.sirenSaid = true;
      this.onSiren?.();
    }
  }
}

// --- Monday: the washing -------------------------------------------------------------------------

interface Garment {
  root: THREE.Object3D;
  swing: THREE.Object3D;
  last: boolean;
  seed: number;
  on: boolean;
}

/**
 * The washing on the line by the hut (week.py `washday`), billowing in the real wind. When the rain
 * comes it's in, a thing at a time and quickly, except for one sock at the far end that nobody gets
 * to for a while. Back out once it's been dry a few minutes (and it's day).
 */
class Laundry {
  private things: Garment[] = [];
  private normal = V();
  private next = 0;
  private dry = 999; // seconds since it last rained
  private wetFor = 0;
  private settled = false;

  constructor(island: Island) {
    const line = island.get('laundry');
    if (!line) return;
    line.updateMatrixWorld(true);
    for (const o of line.children) {
      const swing = o.getObjectByName(`${o.name}_swing`);
      if (!swing || !o.name.startsWith('laundry_')) continue;
      this.things.push({ root: o, swing, last: Boolean(o.userData.last), seed: Math.random() * 10, on: true });
    }
    // across the line, horizontal: the way the wind has to blow to lift the washing
    const along = V(1, 0, 0).transformDirection(this.things[0]?.root.matrixWorld ?? new THREE.Matrix4());
    this.normal.set(-along.z, 0, along.x).normalize();
  }

  /** Whether any of it's still out. */
  get out() {
    return this.things.some((g) => g.on);
  }

  /** Whether all that's left out is the one sock nobody got to. */
  get straggler() {
    const out = this.things.filter((g) => g.on);
    return out.length === 1 && out[0].last;
  }

  update(dt: number, w: WeekWorld, hour: number) {
    const raining = w.rain > 0.08;
    this.dry = raining ? 0 : this.dry + dt;
    this.wetFor = raining ? this.wetFor + dt : 0;
    const wanted = !raining && this.dry > 150 && hour >= 7.5 && hour < 20.5 && w.night < 0.6;
    if (!this.settled) {
      // arriving in the rain (or after dark), it's already in
      this.settled = true;
      const out = !raining && hour >= 7.5 && hour < 20.5 && w.night < 0.6;
      for (const g of this.things) g.on = out;
    }
    if ((this.next -= dt) < 0) {
      if (raining) {
        // in, fast, from the hut end; the last sock only once it's properly wet
        const g = this.things.find((x) => x.on && (!x.last || this.wetFor > 50));
        if (g) {
          g.on = false;
          this.next = 0.6;
        }
      } else if (wanted) {
        const g = this.things.find((x) => !x.on);
        if (g) {
          g.on = true;
          this.next = 0.8;
        }
      } else if (hour >= 20.5 || hour < 7.5 || w.night > 0.7) {
        const g = this.things.find((x) => x.on);
        if (g) {
          g.on = false;
          this.next = 1;
        }
      }
    }
    // how much of the wind blows across the line, and so how far out it lifts the washing
    const across = w.windDir.x * this.normal.x + w.windDir.y * this.normal.z;
    const push = Math.min(1, w.wind / 9) * Math.sign(across || 1) * (0.35 + Math.abs(across) * 0.65);
    const t = performance.now() / 1000;
    for (const g of this.things) {
      g.root.visible = g.on;
      const flap = Math.sin(t * (3 + Math.abs(push) * 7) + g.seed) * (0.05 + Math.abs(push) * 0.2) + Math.sin(t * 1.3 + g.seed * 2) * 0.04;
      g.swing.rotation.x = push * 0.9 + flap;
      g.swing.rotation.z = Math.sin(t * 0.8 + g.seed) * 0.05 * (0.3 + Math.abs(push));
    }
  }
}

// --- Tuesday and Friday: the post boat ---------------------------------------------------------

const IN = 70; // seconds, in from the sea to the pier
const MOORED = 100;
const OUT = 80;

/**
 * The post boat (week.py `postboat`): mid-morning it comes in round the point, ties up at the end of
 * the pier with a toot, and the skipper hands a parcel up onto the boards. Then off again. The
 * parcel waits there for Vincent (vincent.ts `post`), who takes it up to the hut.
 */
class PostBoat {
  private boat?: THREE.Object3D;
  private cargo?: THREE.Object3D;
  private parcel?: THREE.Object3D;
  /** When it ties up (ms, island time). */
  private at: number;
  private from = V();
  private via = V();
  private moor = V();
  private away = V();
  private away2 = V();
  private heading = 0;
  private tooted = false;
  private handed = false;
  private wake = 0;
  private hurry = false;
  onSound?: (kind: WeekSound, at: THREE.Vector3) => void;

  /** In it comes, now: for previews (?post). */
  soon() {
    this.hurry = true;
  }

  constructor(island: Island, private particles: Particles) {
    this.boat = island.get('postboat');
    this.cargo = this.boat?.getObjectByName('postboat_parcel');
    this.parcel = island.get('parcel');
    const d = onTheDay(Date.now());
    d.setHours(10, 0, 0, 0);
    this.at = d.getTime() + daily(7) * 75 * 60e3; // between ten and a quarter past eleven
    const dx = Date.now() - onTheDay(Date.now()).getTime(); // the preview's shift from the visit's day
    this.at += dx;
    // across the end of the pier, bow east; on Sinterklaas's day his steamboat has that spot, so
    // alongside on the west instead, bow north
    const sint = occasions.has('sinterklaas');
    this.moor.copy(sint ? B(-1.85, -24.8) : B(0.2, -28.4));
    this.heading = sint ? Math.PI / 2 : 0;
    const fwd = V(Math.cos(this.heading), 0, -Math.sin(this.heading));
    this.from.copy(this.moor).add(V(-55, 0, 14));
    this.via.copy(this.moor).addScaledVector(fwd, -9).add(V(0, 0, 2));
    this.away.copy(this.moor).addScaledVector(fwd, 8).add(V(0, 0, 3));
    this.away2.copy(this.moor).add(V(60, 0, 12));
    if (this.parcel) this.parcel.visible = false;
  }

  update(dt: number, w: WeekWorld) {
    const boat = this.boat;
    if (!boat) return;
    if (this.hurry) {
      this.hurry = false;
      this.at = w.time + (IN - 5) * 1000;
    }
    const s = (w.time - this.at) / 1000; // seconds since it tied up
    // past it: the parcel went up to the hut long ago (unless it's still sat on the pier this visit)
    if (s > MOORED + 5 * 60 && !post.waiting && !this.handed) post.delivered = true;
    if (s > MOORED - 80 && s < MOORED + 5 * 60 && !this.handed && !post.delivered) this.hand();
    if (s < -IN || s > MOORED + OUT) {
      boat.visible = false;
      boat.position.copy(PARKED);
      return;
    }
    boat.visible = true;
    const p = V();
    const ahead = V();
    const bez = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, k: number, out: THREE.Vector3) =>
      out.copy(a).multiplyScalar((1 - k) ** 2).addScaledVector(b, 2 * (1 - k) * k).addScaledVector(c, k * k);
    let speed = 0;
    if (s < 0) {
      const k = ease(1 + s / IN, 0, 1) * 0.7 + (1 + s / IN) * 0.3;
      bez(this.from, this.via, this.moor, k, p);
      bez(this.from, this.via, this.moor, Math.min(1, k + 0.01), ahead);
      speed = 1 - k;
      if (s > -9 && !this.tooted) {
        this.tooted = true;
        this.onSound?.('toot', p.clone());
      }
    } else if (s < MOORED) {
      p.copy(this.moor);
      ahead.copy(p).add(V(Math.cos(this.heading), 0, -Math.sin(this.heading)));
      if (s > 18 && !this.handed) this.hand();
    } else {
      const k = ease((s - MOORED) / OUT, 0, 1);
      bez(this.moor, this.away, this.away2, k, p);
      bez(this.moor, this.away, this.away2, Math.min(1, k + 0.01), ahead);
      speed = k;
    }
    const t = performance.now() / 1000;
    boat.position.copy(p).setY(Math.sin(t * 1.3) * 0.04);
    const d = ahead.sub(p);
    const heading = d.lengthSq() > 1e-8 ? Math.atan2(-d.z, d.x) : this.heading;
    boat.rotation.set(Math.sin(t * 1.1) * 0.025, heading, Math.sin(t * 0.9) * 0.02, 'YXZ');
    if (this.cargo) this.cargo.visible = !this.handed;
    // a little wake behind it, while it's under way
    if (speed > 0.05 && (this.wake -= dt) < 0) {
      this.wake = 0.12;
      const back = V(-Math.cos(heading) * 1.6, 0.05, Math.sin(heading) * 1.6).add(boat.position);
      this.particles.emit({ position: back.add(V(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), velocity: V(rand(-0.2, 0.2), rand(0.1, 0.3), rand(-0.2, 0.2)), color: '#f4fbff', life: rand(0.8, 1.4), size: 1 });
    }
  }

  /** Up onto the boards it goes, for Vincent to fetch. */
  private hand() {
    this.handed = true;
    post.waiting = true;
    if (!this.parcel) return;
    this.parcel.visible = true;
    this.parcel.position.copy(B(-0.25, -26.75, DECK));
    this.parcel.rotation.set(0, 0.3, 0);
  }

  /** Vincent's picked it up (vincent.ts carries it): it's his now. */
  take() {
    post.waiting = false;
    return this.parcel;
  }

  /** Up at the hut: in through the door with it. */
  deliver() {
    post.waiting = false;
    post.delivered = true;
    if (this.parcel) {
      this.parcel.removeFromParent();
    }
  }
}

// --- Wednesday: the trawler -------------------------------------------------------------------------

const LANE = 31; // how far north (Blender y) it works: out beyond the mountain, on the horizon from the plaza
const SWEEP = 58; // east-west, either side of the middle: its turns are well off screen
const KNOTS = 0.75; // m/s, trawling

/**
 * A trawler (week.py `trawler`), outriggers down, working slowly back and forth offshore all day,
 * and a cloud of gulls wheeling over its stern: every gull on the island has gone out after it, so
 * nobody's after the wrap by the fire (mischief.ts). In at dusk.
 */
class Trawler {
  private boat?: THREE.Object3D;
  private gulls: Body[] = [];
  private x = rand(-SWEEP, SWEEP);
  private dir = Math.random() < 0.5 ? 1 : -1;
  private seeds: number[] = [];
  private calls = rand(4, 10);
  private wake = 0;
  working = false;
  onSound?: (kind: WeekSound, at: THREE.Vector3) => void;

  constructor(scene: THREE.Scene, island: Island, gull: THREE.Object3D | undefined, private particles: Particles) {
    this.boat = island.get('trawler');
    if (gull) {
      for (let i = 0; i < 9; i++) {
        this.gulls.push(new Body('gull', gull, scene));
        this.seeds.push(Math.random() * 100);
      }
    }
  }

  /** Where it is, for the camera and for clicking. */
  get position() {
    return this.boat?.position ?? PARKED;
  }

  update(dt: number, w: WeekWorld, hour: number) {
    const boat = this.boat;
    if (!boat) return;
    this.working = w.night < 0.5 && hour >= 6 && hour < 20;
    if (!this.working) {
      boat.visible = false;
      this.gulls.forEach((g) => g.hide());
      return;
    }
    this.x += this.dir * KNOTS * dt;
    if (Math.abs(this.x) > SWEEP) {
      this.x = Math.sign(this.x) * SWEEP;
      this.dir = -this.dir; // round she comes, out of sight
    }
    const t = performance.now() / 1000;
    boat.visible = true;
    boat.position.copy(B(this.x, LANE + Math.sin(t * 0.02) * 1.5)).setY(Math.sin(t * 0.9) * 0.08);
    const heading = this.dir > 0 ? 0 : Math.PI;
    boat.rotation.set(Math.sin(t * 0.7) * 0.04, heading, Math.sin(t * 0.55) * 0.02, 'YXZ');
    const fwd = V(Math.cos(heading), 0, -Math.sin(heading));
    // the gulls, over the stern where the catch comes up
    const stern = boat.position.clone().addScaledVector(fwd, -3.5);
    this.gulls.forEach((g, i) => {
      const s = this.seeds[i];
      const a = t * (0.35 + (i % 3) * 0.12) * (i % 2 ? 1 : -1) + s;
      const r = 2 + (i % 4) * 1.1 + Math.sin(t * 0.3 + s) * 0.8;
      const p = stern.clone().add(V(Math.cos(a) * r, 3 + (i % 3) * 1.4 + Math.sin(t * 0.8 + s) * 0.9, Math.sin(a) * r));
      if (!g.shown) g.show(p);
      g.relax();
      g.root.position.copy(p);
      const tangent = V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(i % 2 ? 1 : -1);
      g.root.rotation.set(Math.sign(i % 2 - 0.5) * 0.4, Math.atan2(-tangent.z, tangent.x), 0, 'YZX');
      const flap = Math.sin(t * 0.7 + s) > 0.2 ? Math.sin(t * 10 + s) * 0.6 : 0.1;
      const l = g.part('wing_l');
      const rr = g.part('wing_r');
      if (l) l.rotation.x += flap;
      if (rr) rr.rotation.x -= flap;
    });
    if ((this.calls -= dt) < 0) {
      this.calls = rand(5, 12);
      this.onSound?.('gull', stern.clone().setY(1));
    }
    if ((this.wake -= dt) < 0) {
      this.wake = 0.2;
      this.particles.emit({ position: stern.clone().add(V(rand(-0.8, 0.8), 0.1, rand(-0.8, 0.8))), velocity: V(rand(-0.2, 0.2), rand(0.1, 0.25), rand(-0.2, 0.2)), color: '#eef7fb', life: rand(1, 1.8), size: 1 });
    }
  }
}

// --- Sunday: the kite ---------------------------------------------------------------------------------

const HAND = V(0, 1.95, 0.25); // a little in front of his raised hands, in the flyer's own frame
const REACH = 11; // metres of line out

/**
 * The kite (week.py `kite`), when Vincent's out on the beach with it on a windy Sunday: up
 * downwind of him on its line, ducking and climbing in the gusts, its tail snaking about under it.
 */
class Kite {
  private kite?: THREE.Object3D;
  private line?: THREE.Object3D;
  private tail?: THREE.Object3D;
  private up = 0;

  constructor(island: Island) {
    this.kite = island.get('kite');
    this.line = island.get('kite_line');
    this.tail = this.kite?.getObjectByName('kite_tail');
  }

  update(dt: number, w: WeekWorld) {
    const kite = this.kite;
    const line = this.line;
    if (!kite || !line) return;
    const flying = !!w.flyer?.visible;
    this.up = flying ? Math.min(1, this.up + dt / 6) : 0;
    kite.visible = line.visible = flying;
    if (!flying || !w.flyer) {
      kite.position.copy(PARKED);
      line.position.copy(PARKED);
      return;
    }
    const t = performance.now() / 1000;
    const hand = w.flyer.localToWorld(HAND.clone());
    // downwind of him, up at an angle that climbs as it goes up and the wind holds it
    const down = V(w.windDir.x, 0, w.windDir.y).normalize();
    const lift = 0.35 + this.up * 0.5 + Math.min(0.2, w.wind / 60) + Math.sin(t * 0.7) * 0.06 + Math.sin(t * 2.3) * 0.03;
    const across = V(-down.z, 0, down.x).multiplyScalar(Math.sin(t * 0.4) * 2.5 + Math.sin(t * 1.7) * 0.6);
    const reach = REACH * (0.3 + this.up * 0.7);
    const at = hand.clone().addScaledVector(down, Math.cos(lift) * reach).add(across);
    at.y += Math.sin(lift) * reach;
    kite.position.copy(at);
    kite.scale.setScalar(1.8); // big enough to make out from the plaza
    kite.lookAt(hand);
    kite.rotateZ(Math.sin(t * 1.3) * 0.35);
    if (this.tail) {
      this.tail.rotation.x = Math.sin(t * 2.1) * 0.3;
      this.tail.rotation.z = Math.sin(t * 1.6 + 1) * 0.4;
    }
    // the line: a thread from his hands to the kite
    const d = at.clone().sub(hand);
    line.position.copy(hand);
    line.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    line.scale.set(3, d.length(), 3); // thick enough to show up at all, in pixels this size
  }
}
