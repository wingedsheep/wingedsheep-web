import * as THREE from 'three';
import type { Call } from './fauna';
import { herNight } from './bedtime';
import type { Island } from './island';
import { Kneeling, type Pet, petting } from './petting';
import { indoors } from './shelter';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const damp = THREE.MathUtils.damp;

/** Where she can be (tools/models/companion.py): out on the island, or in the rooms. */
export type Spot = 'reading' | 'fireside' | 'workout' | 'podcast' | 'yoga' | 'petting' | 'baking' | 'watching' | 'bed';
/** Which room each indoor spot is in, and the group the room shows while she's there. */
const ROOMS: Partial<Record<Spot, { room: Room; group: string }>> = {
  baking: { room: 'hut', group: 'companion_hut' },
  watching: { room: 'lighthouse', group: 'companion_lighthouse' },
  bed: { room: 'hut', group: 'companion_bed_reading' }, // or companion_bed_asleep, once she's dropped off
};
const DAYTIME: Spot[] = ['reading', 'fireside', 'workout', 'podcast', 'petting', 'baking', 'watching'];
export type Room = 'hut' | 'lighthouse';

/** What's on the telly while she's watching it (quarters.ts draws it, content.ts says what it is). */
export type Show = 'murder' | 'location' | 'bnb' | 'rail';
export const SHOWS: Show[] = ['murder', 'location', 'bnb', 'rail'];
export const telly: { show: Show | null } = { show: null };

const STAY: [number, number] = [100, 220]; // seconds she spends at one spot
const RAIN_WAIT = 20; // seconds she'll wait out of sight before going in anyway, in the rain
const BEDTIME_WAIT = 90; // …and before going up to bed anyway, at half past ten
const JACK = 0.7; // seconds per jumping jack, once she's into her stride
const JACKS: [number, number] = [9, 15]; // in a set
const BREATHER: [number, number] = [3, 6]; // seconds, head down, getting her breath back
const STRETCH: [number, number] = [7, 10]; // seconds, over to one side and the other
const SHAKE: [number, number] = [1.5, 4]; // seconds, shaking it out before the next set

export interface CompanionWorld {
  time: number; // the island's time (sky.ts)
  night: number; // 0..1
  rain: number; // 0..1
  chill: number; // 0..1
  playing: boolean; // Vincent's song is audible
  camera: THREE.Camera; // the island camera
  room: Room | null; // the room on screen, if any
  yoga?: string | null; // the pose Vincent's in, if he's doing yoga and has asked her along (vincent.ts)
}
type When = Pick<CompanionWorld, 'time' | 'night' | 'rain' | 'chill' | 'yoga'>;

/**
 * She's always somewhere on the island: reading on a blanket under the blossom tree, by the
 * campfire with a mug while Vincent plays, working out on a mat above the beach, up in the hut
 * with tea while a pie bakes, in front of the telly in the lighthouse, or on her knees in the
 * grass giving the cats or Beike a fuss (petting.ts). Every few minutes she moves on, but only
 * while neither where she is nor where she's going is on screen, so nobody sees her vanish.
 * Rain, cold and the dark keep her off the blanket, rain and the dark off the mat and out of the
 * meadow; rain sends her indoors. At half past ten she goes up to bed in the hut with
 * a book, and a while later she's asleep (bedtime.ts), well before Vincent comes up. The rooms
 * (hut-room.ts, quarters.ts) show her while she's in them, via the same `indoors` set the
 * animals use.
 */
export class Companion {
  static readonly SPOTS: Spot[] = [...DAYTIME, 'yoga', 'bed'];
  private spot: Spot = 'fireside';
  private next: Spot | null = null;
  private stay = rand(...STAY);
  private waiting = 0;
  private settling = true;
  /** Put somewhere by hand (a preview): she stays there, whatever the weather. */
  private pinned = false;
  /** In bed: dropped off yet? */
  private asleep = false;
  private clock = 0;
  /** Her feet landing on the mat, when she's doing jumping jacks (the island plays it). */
  onSound?: (call: Call, at: THREE.Vector3, loud?: number) => void;
  private groups = new Map<Spot, THREE.Object3D>();
  /** The parts she moves, by name, with the pose they were built in. */
  private parts = new Map<string, { o: THREE.Object3D; rest: THREE.Euler }>();
  private frustum = new THREE.Frustum();
  private sphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
  private matrix = new THREE.Matrix4();
  private vincent?: THREE.Vector3;
  private page = { t: 0, next: rand(4, 9) };
  private sip = { t: 0, next: rand(6, 14) };
  private look = 0;
  /** Clicked on: she looks up (or raises her mug) for a moment, 1 easing back to 0. */
  private noticed = 0;
  /** Her workout: arms up (0..1), legs out (0..1), leaning (radians), eased between moves. */
  private gym = { arms: 0, legs: 0, lean: 0 };
  /** Where she is in her routine: which move, how far into it, and how this set is going. */
  private routine = {
    move: 'jacks' as 'jacks' | 'breather' | 'stretch' | 'shake',
    t: 0, // seconds into the move
    length: 0, // seconds the move lasts (not the jacks: they go by count)
    p: 0, // how far through this jack, 0..1
    beat: JACK * 1.15, // seconds this jack takes
    height: 1, // how big this jack is
    done: 0,
    count: Math.round(rand(...JACKS)),
    side: 1, // which way she leans first
  };
  private jumpY = 0;
  private kneel: Kneeling;

  constructor(island: Island) {
    for (const spot of ['reading', 'fireside', 'workout', 'podcast', 'yoga'] as const) {
      const g = island.root.getObjectByName(`companion_${spot}`);
      if (g) this.groups.set(spot, g);
    }
    for (const name of [
      'companion_read_head', 'companion_shin_l', 'companion_shin_r', 'companion_page', 'companion_fire_head', 'companion_mug',
      'companion_jump', 'companion_torso', 'companion_arm_l', 'companion_arm_r', 'companion_leg_l', 'companion_leg_r',
      'companion_gym_head', 'companion_gym_head_ponytail',
      'companion_pod_head', 'companion_pod_arm', 'companion_pod_shin_l', 'companion_pod_shin_r',
    ]) {
      const o = island.root.getObjectByName(name);
      if (o) this.parts.set(name, { o, rest: o.rotation.clone() });
    }
    this.kneel = new Kneeling(island, 'companion');
    this.vincent = island.positionOf('vincent');
    this.jumpY = this.parts.get('companion_jump')?.o.position.y ?? 0;
    this.move(this.choose(null, { time: 0, night: 0, rain: 0, chill: 0 }));
  }

  /** Straight to a spot (and, on the sofa, a programme, or on her knees, who to pet), to stay: for previews. */
  put(spot: Spot, show?: Show, pet?: Pet) {
    this.move(spot, pet);
    if (show && spot === 'watching') telly.show = show;
    this.pinned = true;
  }

  /** Someone clicked on her: she notices. */
  notice() {
    this.noticed = 1;
  }

  /** Whatever the weather is on the next update, she's already somewhere it allows. */
  settle() {
    this.settling = true;
  }

  update(dt: number, w: CompanionWorld, still = false) {
    this.clock += dt;
    if (this.pinned) {
      this.posing(w);
      if (!still) this.animate(dt, w);
      return;
    }
    const allowed = this.allowed(w);
    if (this.settling) {
      this.settling = false;
      if (!allowed.includes(this.spot)) this.move(this.choose(this.spot, w));
      if (this.spot === 'bed') this.drop(herNight(w.time) === 'asleep');
    }
    this.stay -= dt;
    const asked = allowed.includes('yoga') && this.spot !== 'yoga'; // he's on his mat and would like company
    if (asked || !allowed.includes(this.spot) || (this.stay < 0 && this.spot !== 'bed' && this.spot !== 'yoga')) {
      if (!this.next || !allowed.includes(this.next)) this.next = this.choose(this.spot, w);
      this.waiting += dt;
      const forced = (w.rain > 0.1 && this.waiting > RAIN_WAIT && !ROOMS[this.spot])
        || (this.next === 'bed' && this.waiting > BEDTIME_WAIT);
      if (forced || (!this.seen(this.spot, w) && !this.seen(this.next, w))) this.move(this.next);
    }
    // the light goes out while you're not looking in
    if (this.spot === 'bed' && !this.asleep && herNight(w.time) === 'asleep' && !this.seen('bed', w)) this.drop(true);
    this.posing(w);
    if (!still) this.animate(dt, w);
  }

  /** On the mat: the same pose as him (or the first one, in a preview). */
  private posing(w: CompanionWorld) {
    if (this.spot !== 'yoga') return;
    const pose = `companion_yoga_${w.yoga ?? 'lotus'}`;
    for (const o of this.groups.get('yoga')?.children ?? []) {
      if (o.name.startsWith('companion_yoga_') && !o.name.endsWith('_mat')) o.visible = o.name === pose;
    }
  }

  // --- where she is ------------------------------------------------------------------

  private allowed(w: When): Spot[] {
    if (w.time && herNight(w.time)) return ['bed'];
    if (w.yoga) return ['yoga']; // with him, for as long as he's at it
    if (w.rain > 0.1) return ['baking', 'watching'];
    if (w.night > 0.5) return ['fireside', 'podcast', 'baking', 'watching']; // the pier's lit
    const out = w.chill > 0.4 ? DAYTIME.filter((s) => s !== 'reading') : DAYTIME; // a cold day's no excuse
    // on her knees only while there's someone to pet (and the one she's petting is still there)
    const pets = petting.open('companion');
    const pet = this.spot === 'petting' ? this.kneel.pet : null;
    return (pet ? pets.includes(pet) : pets.length) ? out : out.filter((s) => s !== 'petting');
  }

  private choose(from: Spot | null, w: When): Spot {
    const options = this.allowed(w).filter((s) => s !== from);
    return options[Math.floor(Math.random() * options.length)] ?? from ?? 'fireside';
  }

  private move(to: Spot, pet?: Pet) {
    if (to === 'watching') telly.show = SHOWS[Math.floor(Math.random() * SHOWS.length)];
    const pets = petting.open('companion');
    this.kneel.set(to === 'petting' ? (pet ?? pets[Math.floor(Math.random() * pets.length)] ?? 'cats') : null);
    this.spot = to;
    this.next = null;
    this.waiting = 0;
    this.stay = rand(...STAY);
    this.asleep = false;
    this.show();
  }

  /** In bed: reading, or (`asleep`) the book shut and the light out. */
  private drop(asleep: boolean) {
    this.asleep = asleep;
    this.show();
  }

  private show() {
    for (const [spot, g] of this.groups) g.visible = spot === this.spot;
    if (this.spot !== 'watching') telly.show = null;
    for (const [spot, r] of Object.entries(ROOMS)) {
      if (spot === this.spot) indoors.add(r.group);
      else indoors.delete(r.group);
    }
    if (this.spot === 'bed' && this.asleep) {
      indoors.delete('companion_bed_reading');
      indoors.add('companion_bed_asleep');
    } else {
      indoors.delete('companion_bed_asleep');
    }
  }

  /** Whether a spot is on screen: in view of the island camera, or in the room you're in. */
  private seen(spot: Spot, w: CompanionWorld) {
    const room = ROOMS[spot]?.room;
    if (room) return w.room === room;
    if (w.room) return false;
    this.matrix.multiplyMatrices(w.camera.projectionMatrix, w.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    const inView = (g?: THREE.Object3D) => {
      if (!g) return false;
      g.getWorldPosition(this.sphere.center).y += 0.6;
      return this.frustum.intersectsSphere(this.sphere);
    };
    // on her knees: wherever she is, or anywhere she might go
    if (spot === 'petting') {
      const pets = this.spot === 'petting' && this.kneel.pet ? [this.kneel.pet] : petting.open('companion');
      return pets.some((p) => inView(this.kneel.at(p)));
    }
    return inView(this.groups.get(spot));
  }

  // --- what she's doing --------------------------------------------------------------

  /** A part, back in its built pose, for this frame's movements to add to. */
  private part(name: string) {
    const p = this.parts.get(name);
    p?.o.rotation.copy(p.rest);
    return p?.o;
  }

  private animate(dt: number, w: CompanionWorld) {
    const t = this.clock;
    this.noticed = Math.max(0, this.noticed - dt / 2.5);
    if (this.spot === 'reading') {
      // feet kicking lazily, crossing and uncrossing; a page turned now and then
      const l = this.part('companion_shin_l');
      const r = this.part('companion_shin_r');
      if (l) l.rotation.x += Math.sin(t * 1.3) * 0.35;
      if (r) r.rotation.x += Math.sin(t * 1.3 + 2.2) * 0.35;
      const p = this.page;
      p.next -= dt;
      if (p.next < 0) {
        p.t = Math.min(1, p.t + dt / 0.8);
        if (p.t >= 1) Object.assign(p, { t: 0, next: rand(5, 12) });
      }
      const page = this.part('companion_page');
      if (page) page.rotation.z += THREE.MathUtils.smootherstep(p.t, 0, 1) * Math.PI;
      const head = this.part('companion_read_head');
      if (head) {
        head.rotation.z += Math.sin(t * 0.5) * 0.06;
        head.rotation.y += Math.sin(t * 0.23) * 0.08;
        head.rotation.x -= this.noticed * 0.4; // up from the page to see who's there
      }
    } else if (this.spot === 'fireside') {
      // she looks over at Vincent while he plays and sways along; otherwise into the fire,
      // with a sip of tea now and then
      const g = this.groups.get('fireside');
      const head = this.part('companion_fire_head');
      if (g && head && this.vincent) {
        const local = g.worldToLocal(this.vincent.clone());
        const at = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
        this.look = damp(this.look, w.playing ? at : Math.sin(t * 0.17) * 0.25, 2, dt);
        head.rotation.y += this.look;
        head.rotation.z += w.playing ? Math.sin(t * 2.4) * 0.12 : 0;
      }
      const s = this.sip;
      s.next -= dt;
      if (s.next < 0) {
        s.t = Math.min(1, s.t + dt / 2.4);
        if (s.t >= 1) Object.assign(s, { t: 0, next: rand(8, 18) });
      }
      const lift = Math.max(Math.sin(s.t * Math.PI), this.noticed); // or raised to you: cheers
      const mug = this.part('companion_mug');
      if (mug) mug.rotation.x -= lift * 0.55;
      if (head) head.rotation.x -= lift * 0.15;
    } else if (this.spot === 'podcast') {
      // legs swinging over the water; every so often something is said that she can't let
      // pass: a slow shake of the head, or a hand thrown up at the sea
      const l = this.part('companion_pod_shin_l');
      const r = this.part('companion_pod_shin_r');
      if (l) l.rotation.x += Math.sin(t * 1.1) * 0.25;
      if (r) r.rotation.x += Math.sin(t * 1.1 + 2.6) * 0.25;
      const k = t % 13;
      const shake = k > 4 && k < 6 ? Math.sin(((k - 4) / 2) * Math.PI) : 0; // no. No.
      const throwUp = k > 10 && k < 12 ? Math.sin(((k - 10) / 2) * Math.PI) : 0; // oh, come ON
      const head = this.part('companion_pod_head');
      if (head) {
        head.rotation.y += shake * Math.sin(t * 9) * 0.3 + Math.sin(t * 0.2) * 0.1;
        head.rotation.x -= throwUp * 0.2 + this.noticed * 0.3;
      }
      const arm = this.part('companion_pod_arm');
      if (arm) arm.rotation.x -= Math.max(throwUp, this.noticed) * 1.3;
    } else if (this.spot === 'workout') {
      this.workout(dt, t);
    } else if (this.spot === 'petting') {
      this.kneel.animate(t, this.noticed);
    }
  }

  /**
   * Her routine, round and round but never quite the same twice: a set of jumping jacks (arms up
   * over her head and feet out, hopping) that takes a few to find its rhythm and flags towards
   * the end, a breather with her head down, both arms up and a slow lean to one side and the
   * other, then a moment shaking it out before the next set.
   */
  private workout(dt: number, t: number) {
    const r = this.routine;
    const g = this.gym;
    let arms = 0;
    let legs = 0;
    let lean = 0;
    let hop = 0;
    let bowed = 0;
    const next = (move: typeof r.move, length = 0) => Object.assign(r, { move, t: 0, length });
    r.t += dt;
    if (r.move === 'jacks') {
      r.p += dt / r.beat;
      if (r.p >= 1) {
        // feet back together on the mat: some landings heavier than others, the tired ones softest
        r.p -= 1;
        r.done++;
        const tired = r.done > r.count - 3;
        const mat = this.groups.get('workout');
        if (mat) this.onSound?.('jump', mat.getWorldPosition(new THREE.Vector3()), rand(0.45, 0.85) * (tired ? 0.8 : 1));
        if (r.done >= r.count) {
          next('breather', rand(...BREATHER));
        } else {
          // finding her stride, then flagging
          r.beat = JACK * (r.done < 2 ? 1.15 : tired ? 1.12 : 1) * rand(0.95, 1.06);
          r.height = (tired ? 0.85 : 1) * rand(0.9, 1);
        }
      }
      if (r.move === 'jacks') {
        // the arms lead the legs a little, and are up a moment before the feet are out
        arms = Math.sin(Math.min(1, r.p * 1.12) * Math.PI) * r.height;
        legs = Math.sin(r.p * Math.PI) * r.height;
        hop = Math.abs(Math.sin(r.p * Math.PI * 2)) * 0.08 * r.height;
      }
    } else if (r.move === 'breather') {
      bowed = 1;
      if (r.t >= r.length) {
        next('stretch', rand(...STRETCH));
        r.side = Math.random() < 0.5 ? 1 : -1;
      }
    } else if (r.move === 'stretch') {
      const q = r.t / r.length;
      arms = 1.05 * Math.min(1, q * 8, (1 - q) * 8);
      lean = r.side * Math.sin(q * Math.PI * 2) * 0.28;
      if (q >= 1) next('shake', rand(...SHAKE));
    } else if (r.t >= r.length) {
      Object.assign(r, { p: 0, done: 0, count: Math.round(rand(...JACKS)), beat: JACK * 1.15, height: 1 });
      next('jacks');
    } else {
      // loosening up: arms swinging a little, weight going from foot to foot
      arms = 0.08 + Math.abs(Math.sin(t * 5)) * 0.1;
      lean = Math.sin(t * 2.3) * 0.04;
    }
    const fast = r.move === 'jacks' ? 18 : 4; // the jacks are brisk, the stretches ease
    g.arms = damp(g.arms, arms, fast, dt);
    g.legs = damp(g.legs, legs, fast, dt);
    g.lean = damp(g.lean, lean, 3, dt);
    const jump = this.part('companion_jump');
    if (jump) jump.position.y = this.jumpY + hop;
    // her left side is +x, which in three.js is a turn about +z
    for (const [side, sign] of [['l', 1], ['r', -1]] as const) {
      const arm = this.part(`companion_arm_${side}`);
      if (arm) arm.rotation.z += sign * (0.08 + g.arms * 2.7);
      const leg = this.part(`companion_leg_${side}`);
      if (leg) leg.rotation.z += sign * g.legs * 0.28;
    }
    const torso = this.part('companion_torso');
    if (torso) torso.rotation.z += g.lean;
    const head = this.part('companion_gym_head');
    if (head) head.rotation.x += bowed * (0.12 + Math.sin(t * 3) * 0.03); // catching her breath
    const tail = this.part('companion_gym_head_ponytail');
    if (tail) tail.rotation.x += hop * 4 + Math.sin(t * 2) * 0.05;
  }
}
