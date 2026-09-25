import * as THREE from 'three';
import type { Ground } from './beike';
import { late, vincentAsleep } from './bedtime';
import type { Room } from './companion';
import type { Island } from './island';
import { heightBetween, indoors, type Waypoint } from './shelter';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Where Vincent can be. The guitar is out at the campfire, the kayak off the pier, the yoga mat
 * on the grass by the beach, the climb up the mountain trail; the rest are indoors.
 */
export type Whereabouts = 'guitar' | 'kayak' | 'yoga' | 'climb' | 'podcast' | 'coding' | 'asleep';
/** The yoga poses he flows through (characters.py POSES), in order. */
export const POSES = ['lotus', 'tree', 'dog'] as const;
export type Pose = (typeof POSES)[number];
/** The room each indoor spot is in, and the group it shows while he's there (quarters.py, hut.py). */
const ROOMS: Partial<Record<Whereabouts, { room: Room; group: string }>> = {
  coding: { room: 'lighthouse', group: 'vincent_coding' },
  asleep: { room: 'hut', group: 'vincent_asleep' },
};
/** Seconds he spends at each: longest by far with the guitar. */
const STAY: Record<Whereabouts, [number, number]> = {
  guitar: [160, 340],
  kayak: [70, 150],
  yoga: [90, 180],
  climb: [1e9, 1e9], // until he's back down
  podcast: [90, 200], // an episode, or the first half of one: they're three hours long
  coding: [90, 200],
  asleep: [60, 60], // he gets up when it's morning, not before
};
/** Seconds he waits for nobody to be watching before going to bed anyway, or in off the water in the rain. */
const BEDTIME_WAIT = 90;
const SQUALL_WAIT = 20;
/** Zoomed out further than this (world units in view), a spot a minute's wait away doesn't count as watched. */
const FAR = 36;
const PATIENCE = 60;
const SPEED = 1.1; // m/s, paddling
const STROKE = 1.7; // seconds for a stroke each side
const HOLD = 9; // seconds in each yoga pose
const JOIN = 0.5; // how often she comes and does yoga with him
const WALK = 1.2; // m/s, up the trail
const STRIDE = 0.9; // seconds for a step with each foot
const SUMMIT: [number, number] = [30, 60]; // seconds he takes in the view
const PACE = 0.9; // m/s, up and down with a podcast on
const POINT = 3; // seconds he stops to make a point to nobody

export interface VincentWorld {
  time: number; // the island's time (sky.ts)
  night: number; // 0..1
  rain: number; // 0..1
  storm: number; // 0..1
  wind: number; // m/s
  camera: THREE.Camera; // the island camera
  view: number; // world units in view
  room: Room | null; // the room on screen, if any
  playing: boolean; // his song is audible
}

/**
 * Vincent is mostly at the campfire with his guitar, but now and then he takes the kayak out
 * for a paddle round off the pier, does some yoga on the grass by the beach (she sometimes
 * joins him), climbs the mountain to the summit and back, or goes in to the lighthouse to work
 * on his game (late in the evening, mostly that), and from somewhere between half past ten and half past two until
 * seven or eight he's asleep up in the hut. Like her
 * (companion.ts) he only goes while nobody's watching where he is or where he's off to, and he
 * never gets up in the middle of a song. The kayak waits for daylight and fair weather.
 */
export class Vincent {
  static readonly SPOTS: Whereabouts[] = ['guitar', 'kayak', 'yoga', 'climb', 'podcast', 'coding', 'asleep'];
  spot: Whereabouts = 'guitar';
  private next: Whereabouts | null = null;
  private stay = rand(...STAY.guitar);
  private waiting = 0;
  private settling = true;
  /** Put somewhere by hand (a preview): he stays there, whatever the time or weather. */
  private pinned = false;
  /** On the mat: whether he's asked her along (companion.ts comes when she can), and which pose. */
  company = false;
  pose: Pose = 'lotus';
  private clock = 0;
  private seated?: THREE.Object3D;
  private moored?: THREE.Object3D;
  private boat?: THREE.Object3D;
  private paddle?: THREE.Object3D;
  private loop = { center: new THREE.Vector3(), rx: 6, rz: 3.5, at: rand(0, Math.PI * 2) };
  private mat?: THREE.Object3D;
  private hiker?: THREE.Object3D;
  private route: Waypoint[] = [];
  /** Up the mountain: which leg of the route he's on, how far along it, and which way he's going. */
  private hike = { leg: 1, along: 0, phase: 'up' as 'up' | 'top' | 'down' | 'done', rest: 0, up: 0 };
  private pacer?: THREE.Object3D;
  private walk: Waypoint[] = [];
  /** With a podcast: metres along the path, which way, and when he next stops to make a point. */
  private pace = { along: 0, dir: 1, point: 0, next: rand(6, 14) };
  private frustum = new THREE.Frustum();
  private sphere = new THREE.Sphere();
  private matrix = new THREE.Matrix4();

  constructor(
    island: Island,
    private ground: Ground,
  ) {
    this.seated = island.get('vincent');
    this.mat = island.get('vincent_yoga');
    this.hiker = island.get('vincent_hiking');
    this.route = island.routes.get('climb') ?? [];
    this.pacer = island.get('vincent_podcast');
    this.walk = island.routes.get('podcast') ?? [];
    this.moored = island.get('kayak');
    this.boat = island.get('vincent_kayak');
    this.paddle = this.boat?.getObjectByName('paddle');
    if (this.boat) {
      const x = this.boat.userData;
      this.loop.center.copy(this.boat.position);
      this.loop.rx = x.loop_rx ?? 6;
      this.loop.rz = x.loop_ry ?? 3.5;
    }
    this.show();
  }

  /** Whether he's at the campfire, where the guitar is. */
  get atTheFire() {
    return this.spot === 'guitar';
  }

  /** Straight to a spot, to stay: for previews. */
  put(spot: Whereabouts) {
    this.move(spot);
    this.company = spot === 'yoga'; // so a preview shows the two of them
    this.pinned = true;
  }

  /** Wherever the hour and the weather say he is on the next update, he's already there. */
  settle() {
    this.settling = true;
  }

  update(dt: number, w: VincentWorld, still = false) {
    this.clock += dt;
    if (!this.pinned) this.decide(dt, w);
    if (this.spot === 'kayak') this.paddling(still ? 0 : dt);
    if (this.spot === 'yoga') this.flowing();
    if (this.spot === 'climb') this.hiking(still ? 0 : dt);
    if (this.spot === 'podcast') this.pacing(still ? 0 : dt);
  }

  /** The head to breathe out of on a cold day, if he's outdoors and upright. */
  get head() {
    if (this.spot === 'guitar') return this.seated?.getObjectByName('head');
    if (this.spot === 'kayak') return this.boat?.getObjectByName('head');
    if (this.spot === 'climb') return this.hiker?.getObjectByName('hike_head');
    if (this.spot === 'podcast') return this.pacer?.getObjectByName('pod_head');
    if (this.spot === 'yoga') return this.mat?.getObjectByName(`vincent_yoga_${this.pose}_head`);
    return undefined;
  }

  // --- where he is -------------------------------------------------------------------

  private decide(dt: number, w: VincentWorld) {
    const allowed = this.allowed(w);
    if (this.settling) {
      this.settling = false;
      if (!allowed.includes(this.spot)) this.move(this.choose(this.spot, w));
    }
    this.stay -= dt;
    const due = !allowed.includes(this.spot) || this.stay < 0;
    if (!due || (this.spot === 'guitar' && w.playing && allowed.includes('guitar'))) {
      this.waiting = 0;
      return;
    }
    if (!this.next || !allowed.includes(this.next)) this.next = this.choose(this.spot, w);
    if (this.next === this.spot) {
      this.move(this.spot); // just one more thing
      return;
    }
    this.waiting += dt;
    const forced = (this.next === 'asleep' && this.waiting > BEDTIME_WAIT)
      || (this.spot === 'kayak' && !allowed.includes('kayak') && this.waiting > SQUALL_WAIT);
    if (forced || (!this.seen(this.spot, w) && !this.seen(this.next, w))) this.move(this.next);
  }

  private allowed(w: VincentWorld): Whereabouts[] {
    if (vincentAsleep(w.time)) return ['asleep'];
    const fair = w.night < 0.5 && w.rain < 0.1 && w.storm < 0.2 && w.wind < 11;
    if (fair) return ['guitar', 'kayak', 'yoga', 'climb', 'podcast', 'coding'];
    return w.rain < 0.1 ? ['guitar', 'podcast', 'coding'] : ['guitar', 'coding']; // a podcast works in the dark
  }

  /**
   * Back to the guitar after anything else; from the guitar, off to the game more often than the
   * water. Late in the evening the game has him: he's mostly at it, sometimes till bedtime.
   */
  private choose(from: Whereabouts, w: VincentWorld): Whereabouts {
    const allowed = this.allowed(w);
    if (allowed.length === 1) return allowed[0];
    if (late(w.time)) return from === 'coding' && Math.random() < 0.35 ? 'guitar' : 'coding';
    if (from !== 'guitar') return 'guitar';
    const odds: [Whereabouts, number][] = [['coding', 0.35], ['kayak', 0.2], ['yoga', 0.25], ['climb', 0.2], ['podcast', 0.25]];
    const open = odds.filter(([spot]) => allowed.includes(spot));
    let r = Math.random() * open.reduce((sum, [, p]) => sum + p, 0);
    for (const [spot, p] of open) if ((r -= p) < 0) return spot;
    return 'coding';
  }

  private move(to: Whereabouts) {
    this.spot = to;
    this.next = null;
    this.waiting = 0;
    this.stay = rand(...STAY[to]);
    if (to === 'kayak') this.loop.at = rand(0, Math.PI * 2);
    this.company = to === 'yoga' && Math.random() < JOIN;
    if (to === 'climb') {
      Object.assign(this.hike, { leg: 1, along: 0, phase: 'up', rest: rand(...SUMMIT), up: 0 });
      this.hiking(0);
    }
    if (to === 'podcast') {
      Object.assign(this.pace, { along: 0, dir: 1, point: 0, next: rand(6, 14) });
      this.pacing(0);
    }
    this.show();
  }

  private show() {
    if (this.seated) this.seated.visible = this.spot === 'guitar';
    if (this.moored) this.moored.visible = this.spot !== 'kayak';
    if (this.boat) this.boat.visible = this.spot === 'kayak';
    if (this.mat) this.mat.visible = this.spot === 'yoga';
    if (this.hiker) this.hiker.visible = this.spot === 'climb';
    if (this.pacer) this.pacer.visible = this.spot === 'podcast';
    for (const [spot, r] of Object.entries(ROOMS)) {
      if (spot === this.spot) indoors.add(r.group);
      else indoors.delete(r.group);
    }
  }

  /** Whether a spot is on screen: in view of the island camera (and close enough to notice), or the room you're in. */
  private seen(spot: Whereabouts, w: VincentWorld) {
    const room = ROOMS[spot]?.room;
    if (room) return w.room === room;
    if (w.room || (w.view > FAR && this.waiting > PATIENCE)) return false;
    this.matrix.multiplyMatrices(w.camera.projectionMatrix, w.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    const at = (o: THREE.Object3D | undefined, r: number) => {
      if (!o) return false;
      this.sphere.radius = r;
      o.getWorldPosition(this.sphere.center).y += 0.6;
      return this.frustum.intersectsSphere(this.sphere);
    };
    if (spot === 'guitar') return at(this.seated, 1.6);
    if (spot === 'yoga') return at(this.mat, 2);
    if (spot === 'podcast') return this.spot === 'podcast' ? at(this.pacer, 1.5) : this.walk.some((p) => this.near(p.at, 1.5));
    if (spot === 'climb') return this.spot === 'climb' ? at(this.hiker, 1.5) : this.route[0] ? this.near(this.route[0].at, 1.5) : false;
    return at(this.boat, 2.5) || at(this.moored, 2.5); // going, the moored one vanishes too
  }

  private near(p: THREE.Vector3, r: number) {
    this.sphere.radius = r;
    this.sphere.center.copy(p).y += 0.6;
    return this.frustum.intersectsSphere(this.sphere);
  }

  // --- what he's doing ---------------------------------------------------------------

  /** A pose at a time, held for a few breaths, round and round (she follows along, companion.ts). */
  private flowing() {
    this.pose = POSES[Math.floor(this.clock / HOLD) % POSES.length];
    for (const pose of POSES) {
      const g = this.mat?.getObjectByName(`vincent_yoga_${pose}`);
      if (g) g.visible = pose === this.pose;
    }
  }

  /**
   * Up the trail at a steady walk, arms swinging, to the summit flag; a while there taking in
   * the view (both arms up when he gets there); then back down the same way. At the bottom he's
   * done, and heads back to the guitar as soon as nobody's looking.
   */
  private hiking(dt: number) {
    const me = this.hiker;
    const r = this.route;
    if (!me || r.length < 2) return;
    const h = this.hike;
    const t = this.clock;
    let walking = h.phase === 'up' || h.phase === 'down';
    if (walking) {
      h.along += WALK * dt;
      for (;;) {
        const [a, b] = h.phase === 'up' ? [r[h.leg - 1], r[h.leg]] : [r[h.leg], r[h.leg - 1]];
        const length = a.at.distanceTo(b.at);
        if (h.along < length) break;
        h.along -= length;
        if (h.phase === 'up' && ++h.leg >= r.length) Object.assign(h, { leg: r.length - 1, along: 0, phase: 'top' });
        else if (h.phase === 'down' && --h.leg < 1) Object.assign(h, { leg: 1, along: 0, phase: 'done' });
        if (h.phase === 'top' || h.phase === 'done') break;
      }
    } else if (h.phase === 'top') {
      h.up += dt;
      if (h.up > h.rest) h.phase = 'down';
    }
    walking = h.phase === 'up' || h.phase === 'down';
    if (h.phase === 'done') this.stay = -1; // back to the fire, once nobody's watching
    const [a, b] = h.phase === 'up' || h.phase === 'top' ? [r[h.leg - 1], r[h.leg]] : [r[h.leg], r[h.leg - 1]];
    const length = Math.max(1e-3, a.at.distanceTo(b.at));
    const k = h.phase === 'top' ? 1 : h.phase === 'done' ? 1 : Math.min(1, h.along / length);
    me.position.lerpVectors(a.at, b.at, k);
    me.position.y = heightBetween(a, b, me.position, this.ground) || me.position.y;
    if (walking) me.rotation.y = Math.atan2(b.at.x - a.at.x, b.at.z - a.at.z);
    const swing = walking ? Math.sin((t / STRIDE) * Math.PI) * 0.5 : 0;
    const cheer = h.phase === 'top' ? Math.max(0, Math.min(1, h.up * 2, (4 - h.up) * 2)) : 0; // arms up, the first few seconds
    const part = (name: string) => me.getObjectByName(name);
    part('hike_leg_l')?.rotation.set(swing, 0, 0);
    part('hike_leg_r')?.rotation.set(-swing, 0, 0);
    part('hike_arm_l')?.rotation.set(-swing * 0.8 - cheer * 2.8, 0, cheer * 0.25);
    part('hike_arm_r')?.rotation.set(swing * 0.8 - cheer * 2.8, 0, -cheer * 0.25);
    part('hike_head')?.rotation.set(0, h.phase === 'top' ? Math.sin(t * 0.3) * 0.7 : Math.sin(t * 0.5) * 0.15, 0);
  }

  /**
   * Up and down the path with his headphones on, turning at each end, and every so often
   * stopping dead to make a point, right hand up, to nobody at all (the head nods: he agrees
   * with himself). Then on again.
   */
  private pacing(dt: number) {
    const me = this.pacer;
    const r = this.walk;
    if (!me || r.length < 2) return;
    const p = this.pace;
    const t = this.clock;
    const lengths = r.slice(1).map((b, i) => r[i].at.distanceTo(b.at));
    const total = lengths.reduce((a, b) => a + b, 0);
    if (p.point > 0) p.point = Math.max(0, p.point - dt);
    else {
      p.along += p.dir * PACE * dt;
      if (p.along > total || p.along < 0) {
        p.along = THREE.MathUtils.clamp(p.along, 0, total);
        p.dir = -p.dir; // and back the other way
      }
      p.next -= dt;
      if (p.next < 0) Object.assign(p, { point: POINT, next: rand(8, 18) });
    }
    let leg = 0;
    let k = p.along;
    while (leg < lengths.length - 1 && k > lengths[leg]) k -= lengths[leg++];
    const a = r[leg];
    const b = r[leg + 1];
    me.position.lerpVectors(a.at, b.at, Math.min(1, k / Math.max(1e-3, lengths[leg])));
    me.position.y = heightBetween(a, b, me.position, this.ground) || me.position.y;
    const ahead = p.dir > 0 ? b.at : a.at;
    const from = p.dir > 0 ? a.at : b.at;
    me.rotation.y = Math.atan2(ahead.x - from.x, ahead.z - from.z);
    const walking = p.point === 0;
    const swing = walking ? Math.sin((t / STRIDE) * Math.PI) * 0.4 : 0;
    const making = walking ? 0 : Math.sin((1 - p.point / POINT) * Math.PI); // up, jab, and down again
    const part = (name: string) => me.getObjectByName(name);
    part('pod_leg_l')?.rotation.set(swing, 0, 0);
    part('pod_leg_r')?.rotation.set(-swing, 0, 0);
    part('pod_arm_l')?.rotation.set(-swing * 0.6, 0, 0);
    part('pod_arm_r')?.rotation.set(swing * 0.6 - making * (1.5 + Math.sin(t * 9) * 0.12), 0, -making * 0.2);
    part('pod_head')?.rotation.set(walking ? Math.sin(t * 2.2) * 0.04 : Math.abs(Math.sin(t * 5)) * 0.15 * making, 0, 0);
  }

  /** Round and round the loop off the pier, a stroke each side, bobbing on the swell. */
  private paddling(dt: number) {
    const boat = this.boat;
    if (!boat) return;
    const l = this.loop;
    const t = this.clock;
    const sin = Math.sin(l.at);
    const cos = Math.cos(l.at);
    l.at += (SPEED / Math.hypot(l.rx * sin, l.rz * cos)) * dt;
    // anticlockwise seen from above: in three's x/z (z is south), the angle runs the other way
    boat.position.set(l.center.x + l.rx * cos, l.center.y + Math.sin(t * 1.4) * 0.03, l.center.z - l.rz * sin);
    const p = (t / STROKE) * Math.PI * 2;
    // it faces its local +z (the model's bow is Blender's -y)
    const heading = Math.atan2(-l.rx * sin, -l.rz * cos);
    boat.rotation.set(Math.sin(t * 0.9) * 0.02, heading + Math.sin(p) * 0.06, Math.sin(t * 1.1) * 0.04);
    // right blade in near the bow and pulled back to the hip, then the left: the paddle rolls
    // about the boat's length (right end down first) while it sweeps from bow to stern
    this.paddle?.rotation.set(0, Math.cos(p) * 0.4, Math.sin(p) * 0.6);
  }
}
