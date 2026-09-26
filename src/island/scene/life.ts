import * as THREE from 'three';
import { Beike } from './beike';
import { Bottle } from './bottle';
import { Companion } from './companion';
import { Days } from './days';
import { Fauna } from './fauna';
import { Floaters } from './floaters';
import type { Island } from './island';
import { Mischief } from './mischief';
import { Particles } from './particles';
import { Revel } from './revel';
import { Sightings } from './sightings';
import { petting } from './petting';
import { season } from './season';
import { Shelter, type Waypoint } from './shelter';
import type { Sky } from './sky';
import { Vincent } from './vincent';
import { windDir } from './grass';
import { Week } from './week';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export { ICONS } from './floaters';

/** A song's rhythm (src/data/beats.json): beat times in seconds, and [beat, chord] changes. */
export interface Rhythm {
  beats: number[];
  chords: number[][];
}

const SWING = 0.3; // how far (radians) the strumming forearm swings each way
const SLIDE = 0.05; // how far the fretting hand travels up or down the neck
const LIFT = 0.12; // how far (radians) it comes off the strings while it moves
const SHEEP_PASS = 30; // seconds for the winged sheep to cross the island
const q = new THREE.Quaternion();
const axis = new THREE.Vector3();
const MOUTH = new THREE.Vector3();
/** Beike's way over to the campfire from his meadow (Blender x, y: tools/models/layout.py), round the west log. */
const TO_THE_FIRE: [number, number][] = [[-8.5, -10.5], [-3, -9.8], [3.6, -9.5], [9, -11], [15, -10.5], [21, -6], [23.6, -2.4], [24.7, 1.5]];
const FACING = new THREE.Vector3();
const LOCAL = new THREE.Vector3();
const PARENT = new THREE.Quaternion();

/** The yaw (rotation.y) that turns `o`'s local +x along the world direction (x, z), whatever its parent's turned to. */
function yawAlong(o: THREE.Object3D, x: number, z: number) {
  o.parent?.getWorldQuaternion(PARENT) ?? PARENT.identity();
  LOCAL.set(x, 0, z).applyQuaternion(PARENT.invert());
  return Math.atan2(-LOCAL.z, LOCAL.x);
}

/** `a` eased towards the angle `b` the short way round. */
function dampAngle(a: number, b: number, k: number, dt: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-k * dt));
}

export type Burst = 'hearts' | 'notes' | 'chalk' | 'petals' | 'zzz' | 'silk';

/**
 * Everything that moves by itself: flames, flags, the weathervane, smoke and embers,
 * fireflies after dark, the winged sheep's flight, the occasional UFO, Beike and his ball, the
 * cats and Beike heading indoors when it rains (shelter.ts),
 * the wildlife (fauna.ts), and the clips keyframed in Blender (Charlie and George breathing,
 * twitching and dreaming on the bench).
 */
export class Life {
  readonly particles = new Particles();
  private clock = 0;
  private timers = new Map<string, number>();
  private floaters: Floaters;
  private sheep?: THREE.Object3D;
  private flock: THREE.Object3D[] = [];
  private stunt = 0;
  /** The winged sheep's current flight over the island, if it's up. */
  private pass?: { t: number; from: THREE.Vector3; via: THREE.Vector3; to: THREE.Vector3 };
  private nextPass = rand(8, 20);
  private ufo?: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private idles = new Map<string, THREE.AnimationAction>();
  readonly beike: Beike;
  /** The wildlife: see fauna.ts. */
  readonly fauna: Fauna;
  /** The cats and Beike going indoors when it rains: see shelter.ts. */
  readonly shelter: Shelter;
  /** Who's reading, baking, watching telly or by the fire: see companion.ts (main.ts drives it). */
  readonly companion: Companion;
  /** Where Vincent is: the guitar, the kayak, his game or bed. See vincent.ts (main.ts drives it). */
  readonly vincent: Vincent;
  /** The gull with its eye on Vincent's dinner: see mischief.ts. */
  readonly mischief: Mischief;
  /** A message in a bottle, now and then: see bottle.ts. */
  readonly bottle: Bottle;
  /** The fair folk's revel, on some nights: see revel.ts. */
  readonly revel: Revel;
  /** Easter eggs, the fourth of May, Sint Maarten's lanterns, the Airborne jump: see days.ts (main.ts drives it). */
  readonly days: Days;
  /** The balloon, the starlings, the seal, the ships and the fisherman: see sightings.ts. */
  readonly sightings: Sightings;
  /** The days of the week: the washing, the post boat, the trawler, the kite, the siren test. See week.ts. */
  readonly week: Week;
  /** Beike's way over to the fire, and where he drops his ball (at Vincent's feet). */
  private fireRoute: Waypoint[] = [];
  private fireSpot = V();
  /** Seconds till Vincent kicks the ball Beike's dropped at his feet, and his foot flicking it. */
  private kickIn = 0;
  /** Seconds since the music stopped (or Vincent left the fire), so Beike can get up and go. */
  private quiet = 0;
  private kick = 0;
  /** Where Beike lies down for a fuss, and his head's way (in front of whoever's kneeling in his meadow). */
  private lap?: { at: THREE.Vector3; face: THREE.Vector3 };
  /** How hard it's raining (or hailing), 0..1 (set every frame). */
  rain = 0;
  /** How wet the weather is, 0..1 (set every frame): rabbits and robins shelter from the rain. */
  wet = 0;
  /** How stormy it is, 0..1 (set every frame): something in the sea likes a thunderstorm. */
  storm = 0;
  /** How cold it is, 0..1 (set every frame): breath shows, and the chimneys smoke harder. */
  chill = 0;
  /** Which way the wind blows (world x, z), for breath drifting off. */
  readonly drift = new THREE.Vector2();
  /** The wind, m/s, and how hard it's gusting right now, 0..1 (set every frame): the flags and the vane go by them. */
  wind = 3;
  gust = 0;
  /** How hot it is, 0..1 (set every frame): Beike off into the shade, the cats flat out on the cool stones. */
  heat = 0;
  /** The weathervane's heading, eased: it swings round into the wind. */
  private vaneYaw: number | null = null;
  /** Whether Vincent's song is audible; he eases into and out of playing. */
  playing = false;
  /** The beats and chord changes of the song he's playing... */
  rhythm: Rhythm | null = null;
  /** ...and how far into it you're hearing, set every frame. */
  songTime = 0;
  private groove = 0;
  /** The song time he strums to: runs on the frame clock, pulled gently towards `songTime`. */
  private heard = 0;
  private beatIndex = 0;
  private chordIndex = 0;
  /** Where his fretting hand is along the neck, -1..1, easing towards the chord's place. */
  private fretPos = 0;

  constructor(
    private scene: THREE.Scene,
    private island: Island,
    private sky: Sky,
  ) {
    scene.add(this.particles.points);
    this.floaters = new Floaters(scene);
    this.sheep = island.get('sheep');
    if (this.sheep) this.sheep.visible = false; // until its first pass
    this.ufo = island.get('ufo');
    if (this.ufo) this.ufo.visible = false;
    this.beike = new Beike(island);
    this.fauna = new Fauna(scene, island, this.particles, this.beike);
    this.shelter = new Shelter(island, this.beike);
    this.companion = new Companion(island);
    this.vincent = new Vincent(island, this.beike.ground);
    this.mischief = new Mischief(scene, island, this.fauna.template('gull'));
    this.mischief.onSnatch = (at) => {
      this.fauna.onCall?.('gull', at);
      this.fauna.onCall?.('flurry', at); // the plate, and wings going like mad
    };
    this.revel = new Revel(scene, (s) => this.fauna.template(s), this.beike.ground, this.particles);
    this.revel.onCall = (call, at, ambient, loud) => this.fauna.onCall?.(call, at, ambient, loud);
    this.sightings = new Sightings(scene, island, (s) => this.fauna.template(s), this.beike.ground, this.particles);
    this.sightings.onCall = (call, at, ambient) => this.fauna.onCall?.(call, at, ambient);
    this.days = new Days(scene, island, this);
    this.week = new Week(scene, island, this.beike.ground, this.fauna.template('gull'), this.particles);
    this.vincent.errands.onTake = () => this.week.boat?.take();
    this.vincent.errands.onDeliver = () => this.week.boat?.deliver();
    this.bottle = new Bottle(island, this.beike.ground);
    this.bottle.onLand = (at) => this.fauna.onCall?.('clink', at, true);
    this.vincent.onSound = (call, at) => this.fauna.onCall?.(call, at, true);
    this.companion.onSound = (call, at, loud) => this.fauna.onCall?.(call, at, true, loud);
    this.bottle.onGlint = (at) => {
      if (this.sky.lamps > 0.6) return; // no sun to catch at night
      for (let i = 0; i < 3; i++) {
        this.particles.emit({ position: at.clone().add(V(rand(-0.1, 0.1), rand(0, 0.15), rand(-0.1, 0.1))), velocity: V(0, rand(0.2, 0.5), 0), color: '#fffbe8', life: rand(0.4, 0.7), size: 2 });
      }
    };
    const ground = this.beike.ground;
    const seat = island.positionOf('vincent');
    const fire = island.positionOf('campfire');
    if (seat && fire) {
      // just in front of him, on the fire side, a little to his left
      this.fireSpot.copy(seat).lerp(fire, 0.4).add(V(-0.35, 0, 0));
      this.fireSpot.y = ground.at(this.fireSpot.x, this.fireSpot.z);
      this.fireRoute = TO_THE_FIRE.map(([x, y]) => ({ at: V(x, ground.at(x, -y), -y), fixed: false }));
    }

    const kneel = island.get('companion_petting_beike');
    if (kneel) {
      // in front of them (their -y in Blender, +z here), head to their left (+x)
      kneel.updateMatrixWorld(true);
      const at = kneel.localToWorld(V(0.05, 0, 0.62));
      at.y = ground.at(at.x, at.z);
      this.lap = { at, face: kneel.localToWorld(V(2, 0, 0.62)) };
    }

    this.mixer = new THREE.AnimationMixer(island.root);
    for (const clip of island.clips.filter((c) => c.name.endsWith('_idle'))) {
      const idle = this.mixer.clipAction(clip).play();
      idle.time = Math.random() * clip.duration; // so the cats don't breathe in step
      this.idles.set(clip.name.slice(0, -'_idle'.length), idle);
    }
    // a reaction clip hands back to the idle loop when it's done
    this.mixer.addEventListener('finished', (e) => {
      const id = e.action.getClip().name.split('_')[0];
      this.idles.get(id)?.reset().fadeIn(0.5).play();
    });
  }

  /** Play a named thing's "<id>_pet" clip once, if Blender gave it one. */
  pet(id: string) {
    const clip = this.island.clips.find((c) => c.name === `${id}_pet`);
    if (!clip) return;
    const action = this.mixer.clipAction(clip);
    if (action.isRunning()) return;
    this.idles.get(id)?.fadeOut(0.3);
    action.setLoop(THREE.LoopOnce, 1).reset().fadeIn(0.3).play();
  }

  /** Where the sheep is right now (for the camera and for clicking). */
  get sheepPosition() {
    return this.sheep?.getWorldPosition(V()) ?? V();
  }

  loop() {
    this.stunt = 1.6;
  }

  burst(kind: Burst, at: THREE.Vector3) {
    const p = this.particles;
    for (let i = 0; i < 8; i++) {
      switch (kind) {
        case 'hearts':
        case 'notes':
        case 'zzz':
          if (i < (kind === 'zzz' ? 2 : 4)) this.floaters.add(kind === 'hearts' ? 'heart' : kind === 'notes' ? 'note' : 'zzz', at, i);
          break;
        case 'chalk':
          p.emit({ position: at.clone().add(V(rand(-0.6, 0.6), rand(0, 1.5), rand(-0.6, 0.6))), velocity: V(rand(-1, 1), rand(0, 1), rand(-1, 1)), color: '#f7f3ea', life: 1.2, size: 2 });
          break;
        case 'petals':
          p.emit({ position: at.clone().add(V(rand(-1.5, 1.5), rand(2, 4), rand(-1.5, 1.5))), velocity: V(rand(0.3, 1), -rand(0.4, 0.8), rand(-0.3, 0.3)), color: '#f6cfdc', life: 4, wobble: 0.8 });
          break;
        case 'silk':
          p.emit({ position: at.clone().add(V(rand(-1, 1), rand(0.4, 1.4), rand(-0.4, 0.4))), velocity: V(0, rand(0.3, 0.8), 0), color: '#fff6e0', life: 1.5, size: 1 });
          break;
      }
    }
  }

  releaseFlock() {
    if (!this.sheep || this.flock.length) return;
    for (let i = 0; i < 9; i++) {
      const s = this.sheep.clone();
      s.visible = true; // the flock comes whether or not the sheep is up
      s.userData = { flockIndex: i, lane: rand(-18, 14), delay: i * 0.35 };
      this.scene.add(s);
      this.flock.push(s);
    }
  }

  update(dt: number) {
    this.clock += dt;
    const t = this.clock;
    const night = this.sky.lamps;

    // campfire flames, flag, weathervane, a sleeping cat's breath
    for (let i = 0; i < 3; i++) {
      const f = this.island.part('campfire', `flame${i}`);
      if (f) f.scale.set(1, 0.8 + Math.sin(t * (9 + i * 3) + i) * 0.15 + Math.sin(t * 23 + i) * 0.08, 1);
    }
    this.flags(dt);
    const cat = this.island.part('cat', 'cat_body');
    if (cat) cat.scale.set(1, 1 + Math.sin(t * 1.8) * 0.04, 1);

    this.mixer.update(dt);
    this.flinch();
    this.hutFlag();
    this.strum(dt);
    this.flySheep(dt);
    this.flyFlock();
    this.shelter.update(dt, this.rain, false, this.heat);
    this.beike.hot = this.heat;
    this.beike.sun.copy(this.sky.sun.position);
    this.fuss(dt);
    this.beike.update(dt);
    this.fetchAtTheFire(dt);
    this.week.update(dt, {
      time: this.sky.time, night, rain: this.rain, wind: this.wind, windDir: windDir.value,
      flyer: this.vincent.spot === 'kite' ? (this.vincent.errands.body ?? null) : null,
    });
    this.beike.siren = this.week.siren;
    // on a Wednesday every gull on the island is out after the trawler, and the wrap is safe
    this.mischief.update(dt, night < 0.8 && !this.week.gullsAway, this.vincent.atTheFire);
    this.bottle.update(dt);
    this.revel.update(dt, night, this.wet, new Date(this.sky.time).getHours() + new Date(this.sky.time).getMinutes() / 60);
    this.fauna.update(dt, { night, season: season.name, wet: this.wet, storm: this.storm });
    const now = new Date(this.sky.time);
    this.sightings.update(dt, {
      night, season: season.name, wet: this.wet, storm: this.storm, hour: now.getHours() + now.getMinutes() / 60,
      time: this.sky.time, wind: this.wind, drift: this.drift,
    });
    this.visitors(dt, night);
    this.emitters(dt, night);
    this.breath(dt, night);
    this.floaters.update(dt);
    this.particles.update(dt);
  }

  /**
   * The flags fly downwind: limp and lazily turning on a still day, straight out and snapping in
   * a gale. King's Day's pennant flies with the summit flag, the birthday balloons lean away
   * from the wind on their strings, and the weathervane's sheep swings round to face into it.
   */
  private flags(dt: number) {
    const t = this.clock;
    const { x: dx, y: dz } = this.drift.lengthSq() > 1e-6 ? this.drift.clone().normalize() : new THREE.Vector2(1, 0);
    const out = THREE.MathUtils.clamp(this.wind / 9, 0, 1); // how far out the flag stands
    const snap = 2.2 + this.wind * 0.7 + this.gust * 4; // how fast it flaps
    const fly = (o: THREE.Object3D | undefined, phase: number, long = 1) => {
      if (!o) return;
      const loose = 0.4 * (1 - out) + 0.06; // a slack flag wanders; a taut one only flutters
      o.rotation.y = yawAlong(o, dx, dz) + Math.sin(t * snap * 0.45 + phase) * loose + Math.sin(t * snap + phase * 2) * 0.07 * long * (0.4 + out);
      o.rotation.z = -(1 - out) * 0.9 * (1 - this.gust * 0.5) + Math.sin(t * snap * 0.8 + phase) * 0.04 * out; // hanging down the pole when it's calm
    };
    fly(this.island.part('summit', 'flag'), 0);
    // on the special days: King's Day's pennant over it, and birthday balloons tugging at their strings
    fly(this.island.get('wimpel'), -0.5, 1.6);
    const lean = Math.min(0.7, this.wind * 0.045) * (1 + this.gust * 0.3);
    for (const id of ['balloons', 'bench_balloons']) {
      const bunch = this.island.get(id);
      if (!bunch) continue;
      bunch.getWorldQuaternion(PARENT);
      LOCAL.set(dx, 0, dz).applyQuaternion(PARENT.invert());
      bunch.children.forEach((b, i) => {
        const bob = 1 + this.gust * 2;
        b.rotation.x = LOCAL.z * lean + Math.sin(t * (0.9 + this.gust) + i * 1.7) * 0.06 * bob;
        b.rotation.z = -LOCAL.x * lean + Math.sin(t * (1.1 + this.gust) + i * 2.9) * 0.04 * bob;
        b.rotation.y = Math.sin(t * 0.7 + i * 2.3) * 0.08;
      });
    }
    const vane = this.island.get('library')?.getObjectByName('weathervane');
    if (vane) {
      // into the wind (its head is +x), hunting a little either side of it, more in the gusts
      const want = yawAlong(vane, -dx, -dz) + Math.sin(t * 0.9) * 0.08 * (1 + this.gust * 2) + Math.sin(t * 2.3) * 0.04 * this.gust;
      this.vaneYaw = this.vaneYaw === null ? want : dampAngle(this.vaneYaw, want, 0.8 + this.gust * 2, dt);
      vane.rotation.y = this.vaneYaw;
    }
  }

  /** The hut's pennant is keyframed in Blender (hut_idle); it flies downwind like the others. */
  private hutFlag() {
    const flag = this.island.get('hut')?.getObjectByName('hut_flag');
    if (!flag) return;
    const { x: dx, y: dz } = this.drift.lengthSq() > 1e-6 ? this.drift.clone().normalize() : new THREE.Vector2(1, 0);
    const out = THREE.MathUtils.clamp(this.wind / 9, 0, 1);
    const snap = 2.2 + this.wind * 0.7 + this.gust * 4;
    flag.rotation.set(0, yawAlong(flag, dx, dz) + Math.sin(this.clock * snap * 0.5 + 1) * (0.4 * (1 - out) + 0.08), -(1 - out) * 0.8);
  }

  /**
   * Mid-song, now and then, Beike trots all the way over from his meadow and drops his ball at
   * Vincent's feet. Vincent flicks it away with his foot without missing a chord; a couple of
   * those, a few mad laps round the fire, and he lies down at Vincent's feet for the rest of the
   * song. He goes home when the playing stops.
   */
  private fetchAtTheFire(dt: number) {
    const beike = this.beike;
    if (!this.fireRoute.length) return;
    const atFire = this.vincent.atTheFire;
    // settled down by the fire: up and home once there's been no music a few seconds (not between songs)
    this.quiet = this.playing && atFire ? 0 : this.quiet + dt;
    if (beike.settled && this.quiet > 4) beike.wakeUp();
    if (atFire && this.playing && !beike.visiting && this.every('beike:visit', 70, dt) && Math.random() < 0.6) {
      beike.visit(this.fireRoute, this.fireSpot, this.island.positionOf('vincent')!);
    }
    if (!beike.atFire || !atFire) {
      this.kickIn = rand(1.5, 3);
      return;
    }
    if ((this.kickIn -= dt) > 0) return;
    if (this.kick === 0) this.kick = 1; // the foot comes up…
    if (this.kick < 0.5) beike.kicked(); // …and the ball goes at the top of the flick
  }

  /**
   * Someone on their knees by the bench or in the meadow (petting.ts): George stretches out into
   * it now and then, and Beike comes over and lies down in front of them. Neither's there to be
   * petted while they're in out of the rain.
   */
  private fuss(dt: number) {
    petting.there.cats = this.shelter.onTheBench;
    petting.there.beike = !this.beike.sheltering && !this.beike.inside;
    this.beike.lap = petting.by.beike ? (this.lap ?? null) : null;
    if (petting.by.cats && this.every('george:fuss', 9, dt)) this.pet('george');
  }

  /** Beike, over to the fire with his ball as soon as he can: for previews (?beike=fire). */
  beikeToTheFire() {
    const go = () => {
      if (!this.beike.visit(this.fireRoute, this.fireSpot, this.island.positionOf('vincent')!)) setTimeout(go, 500);
    };
    setTimeout(go, 2000); // once he's been put where the weather says he is
  }

  // --- internals -------------------------------------------------------------------

  private every(key: string, seconds: number, dt: number) {
    const left = (this.timers.get(key) ?? Math.random() * seconds) - dt;
    this.timers.set(key, left <= 0 ? left + seconds : left);
    return left <= 0;
  }

  /**
   * Vincent: idle he rests his hands and looks around; playing he strums down on every beat of
   * the song and up in between, moves his fretting hand along the neck when the chord changes,
   * nods on the beat and taps his right foot. `groove` blends between the two, so he also rests
   * before the first beat and after the last.
   */
  private strum(dt: number) {
    const t = this.clock;
    const beat = this.beatAt(dt); // beats into the song, fractional; -1 outside of it
    const g = (this.groove = THREE.MathUtils.damp(this.groove, this.playing && beat >= 0 ? 1 : 0, 3, dt));
    const swing = Math.max(0, beat) * Math.PI * 2;
    const nod = Math.max(0, Math.cos(swing)) ** 3; // deepest right on the beat
    const tap = Math.max(0, -Math.sin(swing)); // toes up in the second half of the beat, down on it
    // quick through the strings, lingering a moment at the top and bottom of each stroke
    const stroke = Math.sign(Math.sin(swing)) * Math.abs(Math.sin(swing)) ** 0.7;
    const arm = this.island.part('vincent', 'arm_strum');
    if (arm?.userData.swing) arm.quaternion.setFromAxisAngle(axis.fromArray(arm.userData.swing), stroke * SWING * g);

    // the fretting hand gets to each new chord a touch early, lifting off the strings to move
    const place = beat < 0 ? 0 : this.chordPlace(beat + 0.2) * g;
    this.fretPos = THREE.MathUtils.damp(this.fretPos, place, 14, dt);
    const fret = this.island.part('vincent', 'arm_fret');
    if (fret?.userData.slide) {
      const rest = (fret.userData.rest ??= fret.position.clone()) as THREE.Vector3;
      fret.position.copy(rest).addScaledVector(axis.fromArray(fret.userData.slide), this.fretPos * SLIDE);
      fret.quaternion.setFromAxisAngle(axis.fromArray(fret.userData.lift), Math.min(1, Math.abs(place - this.fretPos) * 3) * LIFT);
    }

    const head = this.island.part('vincent', 'head');
    if (head) {
      head.rotation.x = nod * 0.12 * g - 0.05 * (1 - g);
      head.rotation.z = Math.sin(t * 0.4) * 0.25 * (1 - g) + Math.sin(swing / 4) * 0.06 * g;
    }
    const foot = this.island.part('vincent', 'foot_tap');
    this.kick = Math.max(0, this.kick - dt / 0.6);
    const flick = Math.sin(this.kick * Math.PI); // toes up and through the ball, and back
    if (foot) foot.rotation.x = -tap * 0.4 * g - flick * 0.9;
  }

  /**
   * Where along the neck (-1..1) his hand sits for the chord playing at `beat`. Chords with
   * different roots sit in different places; minor ones a little further up.
   */
  private chordPlace(beat: number): number {
    const c = this.rhythm?.chords;
    if (!c?.length) return 0;
    let i = this.chordIndex;
    if (i >= c.length || c[i][0] > beat) i = 0;
    while (i < c.length - 1 && c[i + 1][0] <= beat) i++;
    this.chordIndex = i;
    const chord = c[i][1];
    return (((chord % 12) * 5) % 12) / 11 * 1.6 - 0.8 + (chord >= 12 ? 0.2 : 0);
  }

  /**
   * Where in the song's beats he is: 2.25 is a quarter of the way from the third beat to the
   * fourth, -1 is before the first or after the last. Audio clocks tick coarsely, so he keeps
   * his own time and only drifts towards what you hear (or jumps, for a new song).
   */
  private beatAt(dt: number): number {
    const b = this.rhythm?.beats ?? [];
    if (!this.playing || b.length < 2) return -1;
    this.heard += dt;
    const off = this.songTime - this.heard;
    this.heard = Math.abs(off) > 0.25 ? this.songTime : this.heard + off * Math.min(1, dt * 4);
    const now = this.heard;
    let i = this.beatIndex;
    if (i >= b.length - 1 || b[i] > now) i = 0; // a new song, or started over
    while (i < b.length - 2 && b[i + 1] <= now) i++;
    this.beatIndex = i;
    if (now < b[0] || now >= b[b.length - 1]) return -1;
    return i + (now - b[i]) / (b[i + 1] - b[i]);
  }

  /**
   * Now and then the sheep flies over: in from somewhere off the edge of the world, a lazy
   * curve across the island, and out the other side. The first pass comes soon after you
   * arrive; after that it's a minute or two between them, so the sky never gets busy.
   */
  private startPass() {
    const a = rand(0, Math.PI * 2);
    const b = a + Math.PI + rand(-0.7, 0.7);
    this.pass = {
      t: 0,
      from: V(Math.cos(a) * 75, rand(11, 15), Math.sin(a) * 55),
      via: V(rand(-14, 14), rand(12, 15), rand(-12, 8)),
      to: V(Math.cos(b) * 75, rand(11, 15), Math.sin(b) * 55),
    };
  }

  /** Where the sheep is `k` (0..1) of the way through its pass; y is altitude. */
  private sheepPath(k: number) {
    const { from, via, to } = this.pass!;
    const u = 1 - k;
    const p = from.clone().multiplyScalar(u * u).addScaledVector(via, 2 * u * k).addScaledVector(to, k * k);
    p.y += Math.sin(k * Math.PI * 6) * 0.8; // rising and dipping with the wingbeats
    return p;
  }

  private flySheep(dt: number) {
    if (!this.sheep) return;
    if (!this.pass) {
      this.nextPass -= dt;
      if (this.nextPass > 0) return;
      this.startPass();
      this.sheep.visible = true;
    }
    const pass = this.pass!;
    pass.t += dt / SHEEP_PASS;
    if (pass.t >= 1) {
      this.pass = undefined;
      this.nextPass = rand(70, 160);
      this.sheep.visible = false;
      this.sheep.position.set(0, -80, 0); // parked well out of reach of the pointer
      return;
    }
    const p = this.sheepPath(pass.t);
    const ahead = this.sheepPath(Math.min(1, pass.t + 0.005));
    if (this.stunt > 0) {
      this.stunt -= dt;
      const a = (1 - this.stunt / 1.6) * Math.PI * 2;
      p.y += Math.sin(a) * 2.5;
      p.addScaledVector(ahead.clone().sub(p).normalize(), (1 - Math.cos(a)) * 1.5);
    }
    this.sheep.position.copy(p);
    this.sheep.lookAt(ahead.x, p.y, ahead.z);
    this.sheep.rotateY(-Math.PI / 2); // the model faces +x
    this.flap(this.sheep, this.clock);
  }

  private flyFlock() {
    for (const s of this.flock) {
      const { lane, delay, flockIndex } = s.userData;
      const k = Math.max(0, this.clock - (s.userData.start ??= this.clock) - delay);
      s.position.set(-50 + k * 9, 11 + flockIndex * 0.6 + Math.sin(k * 1.5 + flockIndex) * 0.6, lane);
      s.rotation.set(0, 0, 0);
      this.flap(s, this.clock + flockIndex);
    }
    if (this.flock.length && this.flock.every((s) => s.position.x > 60)) {
      this.flock.forEach((s) => this.scene.remove(s));
      this.flock = [];
    }
  }

  private flap(sheep: THREE.Object3D, t: number) {
    const a = Math.sin(t * 9) * 0.7;
    const l = sheep.getObjectByName('wing_l');
    const r = sheep.getObjectByName('wing_r');
    if (l) l.rotation.x = -a;
    if (r) r.rotation.x = a;
  }

  /** At night, now and then, something unexplained hops across the sky. */
  private visitors(dt: number, night: number) {
    if (!this.ufo) return;
    const cycle = 50;
    const t = this.clock % cycle;
    const active = night > 0.7 && t < 12;
    this.ufo.visible = active;
    if (!active) return;
    const k = t / 12;
    const hop = Math.floor(k * 4);
    const local = k * 4 - hop;
    const ease = local < 0.75 ? 0 : THREE.MathUtils.smootherstep(local, 0.75, 1);
    // a warble as it sets off on each hop
    const was = (Math.max(0, t - dt) / 12) * 4;
    if (local >= 0.75 && (was < hop || was - hop < 0.75)) this.fauna.onCall?.('ufo', this.ufo.position.clone(), true);
    const pts = [V(-30, 18, 10), V(-10, 20, -14), V(12, 17, 4), V(28, 21, -18), V(50, 24, -10)];
    this.ufo.position.lerpVectors(pts[hop], pts[hop + 1], ease);
    this.ufo.position.y += Math.sin(this.clock * 2) * 0.2;
    this.ufo.rotation.y += dt * 2;
  }

  /** The siren test (week.ts): the cats on the bench flatten their ears till it's over. */
  private flinch() {
    const k = this.week.siren;
    for (const cat of ['george', 'charlie']) {
      for (const [side, s] of [['l', 1], ['r', -1]] as const) {
        const ear = this.island.part(cat, `${cat}_ear_${side}`);
        if (!ear) continue;
        // an ear the idle clip moves is put back every frame; one it doesn't, we put back ourselves
        const x = ear.userData;
        x.clipped ??= this.island.clips.some((c) => c.tracks.some((t) => t.name.startsWith(`${ear.name}.`)));
        if (!x.clipped) ear.quaternion.copy((x.rest ??= ear.quaternion.clone()) as THREE.Quaternion);
        if (k > 0) ear.quaternion.premultiply(q.setFromAxisAngle(axis.set(0, 0, 1), -s * 1.1 * Math.min(1, k * 2)));
      }
    }
  }

  private emitters(dt: number, night: number) {
    const p = this.particles;
    // the hut's stove is banked for the night once they're both in bed, and lit again when one's up
    const banked = this.vincent.spot === 'asleep' && this.companion.inBed;
    for (const e of this.island.emitters) {
      if (banked && e.owner === 'hut') continue;
      const key = `${e.kind}:${e.position.x.toFixed(1)}`;
      if (e.kind === 'smoke' && this.every(key, 0.35 / (1 + this.chill * 1.5), dt)) {
        // on a cold day the fires are well stoked: thicker, whiter smoke, rising higher; it drifts
        // off downwind, and in a gale it's blown flat and torn away
        const c = this.chill;
        const blown = THREE.MathUtils.clamp(this.wind / 14, 0, 1);
        const push = 0.25 + this.wind * 0.18 * (1 + this.gust * 0.4);
        const along = this.drift.lengthSq() > 1e-6 ? this.drift.clone().normalize() : new THREE.Vector2(1, 0);
        p.emit({
          position: e.position.clone(),
          velocity: V(along.x * push + rand(-0.1, 0.1), rand(0.7, 1.0) * (1 + c * 0.4) * (1 - blown * 0.75), along.y * push + rand(-0.1, 0.1)),
          color: c > 0.3 ? '#eceaf0' : '#d8d4dc',
          life: 4.5 * (1 + c * 0.6) * (1 - blown * 0.5),
          size: 2,
          wobble: 0.3 + blown * 0.4,
        });
      } else if (e.kind === 'embers' && this.every(key, 0.12, dt)) {
        p.emit({ position: e.position.clone().add(V(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), velocity: V(rand(-0.2, 0.2), rand(1.2, 2.2), rand(-0.2, 0.2)), color: rand(0, 1) < 0.5 ? '#ffd070' : '#ff9a3c', life: rand(0.8, 1.6), wobble: 0.4 });
      } else if (e.kind === 'sparkle' && this.every(key, 0.3, dt)) {
        // the cairns on the trail: a few golden motes rise round each token, so they catch the eye
        p.emit({ position: e.position.clone().add(V(rand(-0.6, 0.6), rand(-0.2, 0.4), rand(-0.6, 0.6))), velocity: V(rand(-0.1, 0.1), rand(0.4, 0.7), rand(-0.1, 0.1)), color: rand(0, 1) < 0.7 ? '#ffe28a' : '#fffbe6', life: rand(1.4, 2.2), wobble: 0.3 });
      } else if (e.kind === 'petals' && season.blossom > 0.05 && this.every(key, 0.8 / season.blossom, dt)) {
        p.emit({ position: e.position.clone().add(V(rand(-1.5, 1.5), rand(0, 1), rand(-1.5, 1.5))), velocity: V(rand(0.2, 0.6), -rand(0.3, 0.6), rand(-0.2, 0.2)), color: '#f6cfdc', life: 5, wobble: 0.6 });
      }
    }
    // fireflies drift through the eastern woods after dusk
    if (night > 0.6 && this.every('firefly', 0.15, dt)) {
      const camp = this.island.positionOf('campfire') ?? V(27, 0, 1);
      p.emit({
        position: camp.clone().add(V(rand(-12, 8), rand(0.5, 3), rand(-10, 8))),
        velocity: V(rand(-0.3, 0.3), rand(-0.1, 0.2), rand(-0.3, 0.3)),
        color: '#e8ff8a', life: rand(2.5, 5), wobble: 0.8,
      });
    }
  }

  /**
   * On a cold day Vincent's breath shows between strums, a little puff every few seconds, and
   * Beike's comes quicker the harder he pants.
   */
  private breath(dt: number, night: number) {
    const c = this.chill;
    if (c < 0.05) return;
    const color = new THREE.Color('#eef3f8').multiplyScalar(1 - night * 0.35);
    const puff = (at: THREE.Vector3, facing: THREE.Vector3, count: number) => {
      for (let i = 0; i < count; i++) {
        this.particles.emit({
          position: at.clone().add(V(rand(-0.03, 0.03), rand(-0.02, 0.02), rand(-0.03, 0.03))),
          velocity: facing.clone().multiplyScalar(rand(0.25, 0.45)).add(V(this.drift.x * 0.25 + rand(-0.05, 0.05), rand(0.06, 0.16), this.drift.y * 0.25 + rand(-0.05, 0.05))),
          color,
          life: rand(0.9, 1.5) * (0.6 + c * 0.6),
          size: Math.random() < 0.3 ? 2 : 1,
          wobble: 0.1,
        });
      }
    };
    const head = this.vincent.head;
    if (head && this.every('breath:vincent', 3.2, dt)) {
      head.localToWorld(MOUTH.set(0, 0.12, 0.24));
      FACING.set(0, 0, 1).transformDirection(head.matrixWorld);
      puff(MOUTH, FACING, 2 + Math.round(c * 4));
    }
    if (this.beike.muzzle(MOUTH, FACING) && this.every('breath:beike', 2.2 - this.beike.panting * 1.6, dt)) {
      puff(MOUTH, FACING, 1 + Math.round(c * 3));
    }
  }
}
