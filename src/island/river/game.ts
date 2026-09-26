import * as THREE from 'three';
import { haloTexture } from '../scene/sky';
import { RiverAssets } from './assets';
import { Controls } from './controls';
import { Course, type Split, type Stretch } from './course';
import { BOOF_WINDOW, Kayak, LIP_AT } from './kayak';
import { Land, type Lamp, flicker, fogAt, highAt } from './land';
import { type Goal, RARE, RIVERS, type Rare, type RiverDef } from './rivers';
import { waterAt } from './flow';
import { MAX_HOLES, MAX_LIPS, MAX_RIPPLES, MAX_ROCKS, MAX_SHORE, MAX_TONGUES, MAX_TRAINS, riverWater } from './water';
import { type Cry, Wildlife } from './wildlife';

const ELEVATION = THREE.MathUtils.degToRad(48);
const DISTANCE = 140;
const FLOW_MAX = 5;
/** Speed pays: at or below SLOW m/s a metre's worth its flow, at FAST and over twice that. */
const SLOW = 3;
const FAST = 9;
/**
 * Par for a run (s) is its length over this: drifting down gets you there in about that. Every
 * second under it at the finish is worth TICK points, times the flow you finish on.
 */
const DRIFT = 4.5;
const TICK = 25;
/** Seconds of quiet between one teaching hint and the next, and before the first. */
const QUIET = 10;
const QUIET_START = 4;
/** What each gate and each ball is worth at the take-out (only if you make it), and what a capsize costs. */
export const GATE = 150;
export const BALL_POINTS = 100;
export const FLIP = 300;
/** Down to the take-out with a storm still blowing: this much on top of everything else. */
export const STORM_BONUS = 0.15;
/**
 * Off a drop at SEND_FROM m/s or more and landed clean (a boof, a tuck): a send, paid on the spot.
 * SEND a metre of drop, twice that going SEND_TOP and over, times the flow.
 */
const SEND_FROM = 7;
const SEND_TOP = 11;
const SEND = 60;
/**
 * Flat out: going FAST or more (a dip under it forgiven for HOT_GRACE s), every HOT_EVERY s of it
 * pays, each more than the last (HOT, then twice it, then three times…), times the flow.
 */
const HOT = 60;
const HOT_EVERY = 5;
const HOT_GRACE = 1;
const HOT_WORDS = ['Flat out', 'Flying', 'Rocket', 'Unstoppable'];

export type State = 'ready' | 'running' | 'over';

export interface Tally {
  metres: number;
  /** Seconds since you pushed off. */
  time: number;
  gates: number;
  flips: number;
  /** Made it to the take-out (rather than swimming), and what that was worth: the clock, the gates, the balls. */
  finished: boolean;
  bonus: { time: number; gates: number; balls: number; storm: number };
  balls: number;
  /** Drops gone off flat out, and what they paid. */
  sends: number;
  sent: number;
  /** The longest you held it flat out (s), and what going flat out paid. */
  longest: number;
  flatOut: number;
  /** The multiplier: built by doing things well, lost on a knock or a swim. */
  flow: number;
  bestFlow: number;
  score: number;
  speed: number;
  /** The speed bonus, ×1..×2: drifting earns the least, going like the clappers the most. */
  pace: number;
  /** The rare ones seen on the way down. */
  spotted: Rare[];
  /** Wave trains ridden without tipping, and what they paid. */
  trains: number;
  rode: number;
  /** For the goals: knocks, gates missed, ledges boofed, spins, waterfalls sent, trains pumped all the way. */
  knocks: number;
  missed: number;
  boofs: number;
  spins: number;
  fallsSent: number;
  pumpedTrains: number;
  /** The river's goals done this run (by their place in its list), and what they paid. */
  goals: number[];
  goalPoints: number;
}

/** What the game needs from the island outside: its light and weather. */
export interface Outside {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fog: THREE.Color;
  night: number;
  rain: number;
  snow: number;
  /** Fair weather, for the winged sheep to be out. */
  fair: boolean;
  /** 0..1: how stormy it is, a flash of the island's lightning, and how foggy a day it is. */
  storm?: number;
  flash?: number;
  haze?: number;
}

export type RiverSound = 'stroke' | 'bump' | 'hit' | 'splash' | 'plunge' | 'ball' | 'gate' | 'croak' | 'capsize' | 'brace' | 'boof' | 'roll' | 'whoosh' | 'hole' | 'best' | 'cleared' | 'dropin' | 'chime' | 'tier' | 'lost' | 'mile' | 'slap' | 'howl' | 'huff' | 'spotted' | Cry;
export type Hint = 'paddle' | 'steer' | 'lean' | 'brace' | 'boof' | 'falls' | 'hole' | 'roll' | 'tongue' | 'eddy' | 'peel' | 'sprint' | 'ball' | 'waves';

export interface GameEvents {
  /** Into a new stretch of river. */
  stretch?(s: Stretch, index: number): void;
  /** An island coming up, the river parting round it. */
  split?(s: Split): void;
  /** Something done well: a word to pop up over the kayak (big: the best kind). */
  praise?(text: string, big: boolean): void;
  /** The flow broke (and why, and what it cost in points if anything). */
  broke?(why: string, cost: number): void;
  /** The flow went up a whole notch (to ×2, ×3…). */
  tier?(flow: number): void;
  /** A ball fished out. */
  ball?(): void;
  /** The first time something comes up, how to deal with it. */
  hint?(kind: Hint): void;
  over?(tally: Tally): void;
  /** Someone reached for the controls while the kayak was waiting at the top. */
  start?(): void;
  say?(text: string): void;
  sound?(kind: RiverSound, volume?: number, step?: number): void;
  bark?(): void;
  baa?(): void;
  quack?(): void;
  /** One of the rare ones, seen (the first time this run). */
  spotted?(kind: Rare): void;
  /** One of the river's goals, done (its place in the river's list). */
  goal?(goal: Goal, index: number): void;
}

/**
 * The wild-water run: a mountain river made up ahead of you, a km or two down to the take-out, the
 * kayak, and a camera looking down the river from behind it. How far you get, times how well: the
 * flow builds with every boof, brace, gate and clean line, and a knock or a capsize breaks it (a
 * capsize costs points too). Make it to the take-out and it pays again: for every second under
 * par, every gate and every ball. Things
 * done right get a moment: a word, a beat of stillness, a thump in the pad.
 */
export class RiverGame {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  readonly controls: Controls;
  readonly kayak: Kayak;
  state: State = 'ready';
  paused = false;
  events: GameEvents = {};
  tally: Tally = fresh();
  /** Which river it is (rivers.ts): how long, how hard. */
  river: RiverDef = RIVERS[0];
  /** 0..1: a flash over the picture, for a knock (red) or a boof (warm white). */
  flash = { amount: 0, color: new THREE.Color() };
  /**
   * 0..1: going over a big waterfall. The view leans in as the lip comes up and all the way on
   * the way down, time stretches out, and the edges of the picture close in.
   */
  drama = 0;

  private course!: Course;
  private land!: Land;
  private wildlife: Wildlife;
  /** For the wildlife: whether the camera can see a spot on the bank. */
  private sight = new THREE.Raycaster(undefined, undefined, 0, 80);
  private sightDir = new THREE.Vector3();
  private water = riverWater();
  private sun = new THREE.DirectionalLight();
  private hemi = new THREE.HemisphereLight();
  private halo = haloTexture();
  /** How stormy it is right now (for the bonus at the take-out). */
  private storm = 0;
  /** Lightning: the island's last flash (to catch a new strike), and the bolt it brings down. */
  private lastFlash = 0;
  private bolt: THREE.Mesh;
  /** The paddler's headlamp, for a run at night: a beam ahead and a spark on the helmet. */
  private lamp = new THREE.SpotLight('#fff0cc', 0, 36, 0.5, 0.7, 0);
  private lampGlow: THREE.Sprite;
  /**
   * The lights on the banks after dark (a campfire, a lantern on a jetty, a cottage's windows):
   * a few real lights, handed each frame to the ones nearest the boat, so the ground and the
   * trees round each are lit by it. `lit` is how far they're on (0 by day … 1).
   */
  private shoreLights = Array.from({ length: MAX_SHORE }, () => new THREE.PointLight('#ffc46b', 0, 10, 1.4));
  private lit = 0;
  /** How dark it is out (0 by day … 1), for the edges of the picture. */
  night = 0;
  private headAt = new THREE.Vector3();
  private yaw = 0;
  private view = 26;
  private zoom = 1;
  private aspect = 1;
  private shake = 0;
  private kick = 0;
  /** How fast time's going (1 is real time): slowed right down off a big drop. */
  private slow = 1;
  /** Time all but stopped for a beat as you hit the water at the foot of a waterfall (s, real time). */
  private hitstop = 0;
  /** The waterfall being flown off (m), for the plunge at its foot. */
  private plunging = 0;
  private stretch = -1;
  /** Nothing's gone wrong since this stretch began. */
  private clean = true;
  /** The island coming up or being paddled round, the channel taken (-1 left, 1 right), and whether it's gone cleanly. */
  private split: Split | null = null;
  private took = 0;
  private splitClean = true;
  private overIn = 0;
  private clock = 0;
  /** Things done well one after another: each chimes a note higher. */
  private streak = 0;
  private streakFor = 0;
  /** Squash and stretch: + squashed flat (a landing, a knock), - stretched long (a stroke). */
  private squish = 0;
  private squishV = 0;
  private size: THREE.Vector3;
  private hinted = new Set<Hint>();
  /**
   * No teaching hint before this (s into the run): one at a time, with a quiet stretch after
   * each, and none while the river's name is still up.
   */
  private quiet = 0;
  /** Whether you've paddled at all, and on one side only (then there's no telling you how). */
  private paddled = false;
  private steered = false;
  private rumbleAt = 0;
  /** A lip's lit up for the stroke. */
  private cued = false;
  private lastMetres = 0;
  /** Rings on the water (from a stroke, a landing, a knock), drifting off on the current. */
  private ripples: { x: number; z: number; age: number; size: number }[] = [];
  /** Where the last eddy was caught: the next one has to be further down to count. */
  private eddyS = -99;
  /** How long you've been flat out (s), how many times it's paid, and how long a dip you've left. */
  private hotFor = 0;
  private hotPaid = 0;
  private hotLeft = 0;
  /** Where the kayak goes in: far enough down that there's river behind you too. To try a harder
   * stretch straight away: ?downriver=1500 (metres further on; you still push off in calm water,
   * see calm()). */
  private start = 50;
  private downriver = Number(new URLSearchParams(location.search).get('downriver')) || 0;
  /** How far down in a gorge the light is (0 open … 1 deep between the walls), how high up in the
   * mountains, and how thick the fog (see land.ts highAt, fogAt), eased as you go. */
  private walls = 0;
  private high = 0;
  private fogged = 0;
  private air = new THREE.Color();
  private tint = new THREE.Color();
  private mist = new THREE.Color();

  constructor(private assets: RiverAssets, el: HTMLElement, private texels: () => number) {
    this.controls = new Controls(el);
    this.scene.fog = new THREE.Fog(0xa8d4e6, 170, 300);
    const s = this.sun;
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    Object.assign(s.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 220 });
    s.shadow.bias = -0.0008;
    s.shadow.normalBias = 0.03;
    this.scene.add(s, s.target, this.hemi);
    this.scene.add(this.lamp, this.lamp.target, ...this.shoreLights);
    this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.halo, color: '#fff0cc', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    this.lampGlow.scale.setScalar(0.9);
    this.lampGlow.renderOrder = 3;
    this.scene.add(this.lampGlow);
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#f4f6ff', transparent: true, fog: false, depthWrite: false, side: THREE.DoubleSide }));
    this.bolt.visible = false;
    this.bolt.frustumCulled = false;
    this.bolt.renderOrder = 4;
    this.scene.add(this.bolt);
    this.kayak = new Kayak(assets);
    this.scene.add(this.kayak.model);
    this.size = this.kayak.model.scale.clone();
    this.wildlife = new Wildlife(assets, new Course(1));
    this.scene.add(this.wildlife.group);
    this.wire();
    this.reset();
  }

  static async load(el: HTMLElement, texels: () => number) {
    return new RiverGame(await RiverAssets.load(), el, texels);
  }

  /** How far it is from where you push off to the take-out (m). */
  get length() {
    return this.river.length;
  }

  /** Par for the run (s). */
  get par() {
    return this.river.length / DRIFT;
  }

  /** A fresh river (this one again, or `river`), the kayak at the top of it, waiting for you to push off. */
  /** The rare ones already in your log (set before reset: the ones not in it come up more). */
  set logged(seen: ReadonlySet<Rare>) {
    this.wildlife.seen = seen;
  }

  reset(river = this.river) {
    this.river = river;
    // its own water
    const u = this.water.uniforms;
    u.uShallow.value.fromArray(river.look.water.shallow);
    u.uMid.value.fromArray(river.look.water.mid);
    u.uDeep.value.fromArray(river.look.water.deep);
    this.land?.clear();
    this.land?.group.removeFromParent();
    // the same seed is the same river: ?seed=1234 to paddle one again
    const seed = Number(new URLSearchParams(location.search).get('seed')) || (Math.random() * 2 ** 31) | 0;
    this.start = calm(seed, 50 + this.downriver, river);
    this.course = new Course(seed, this.start + river.length, river);
    this.course.extend(this.start + 400);
    this.land = new Land(this.course, this.assets, this.water.material, this.halo);
    this.land.onSpots = (spots) => this.wildlife.settle(spots);
    this.scene.add(this.land.group);
    this.wildlife.reset(this.course);
    // ?rare=bear to go and look for one
    const rare = new URLSearchParams(location.search).get('rare') as Rare | null;
    if (rare && RARE.some((r) => r.id === rare)) this.wildlife.force(rare);
    this.wildlife.ground = (x, z) => this.land.heightAt(x, z);
    const projected = new THREE.Vector3();
    this.wildlife.inView = (at) => {
      projected.copy(at).project(this.camera);
      return Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95 && projected.z > -1 && projected.z < 1;
    };
    this.wildlife.hidden = (at) => {
      this.sight.camera = this.camera; // (the glows are sprites, which need it)
      this.sight.set(at, this.camera.getWorldDirection(this.sightDir).negate());
      return this.sight.intersectObject(this.land.group, true).length > 0;
    };
    this.kayak.launch(this.course, this.start);
    this.kayak.assisted = this.controls.assisted;
    this.tally = fresh();
    this.state = 'ready';
    this.paused = false;
    this.stretch = -1;
    this.clean = true;
    this.split = null;
    this.overIn = 0;
    this.lastMetres = 0;
    this.streak = this.streakFor = 0;
    this.squish = this.squishV = 0;
    this.ripples = [];
    this.eddyS = -99;
    this.hotFor = this.hotPaid = this.hotLeft = 0;
    this.quiet = QUIET_START;
    this.high = highAt(river.look, seed, this.start);
    this.fogged = fogAt(river.look, seed, this.start);
    this.zoom = 1;
    this.yaw = this.course.at(this.start + 10).a;
    this.frame(0);
    // everything round the start, all at once, so the first frame isn't bare
    this.land.update(this.kayak.pos, this.reach, this.kayak.s - 40, this.kayak.s + 100, 999);
  }

  go() {
    if (this.state !== 'ready') return;
    this.state = 'running';
  }

  /** Whether the kayak is pointing back towards the camera (its left is then the screen's right). */
  get facingCamera() {
    return Math.cos(this.kayak.heading - this.yaw) < 0;
  }

  /** How white the water is where the kayak is. */
  get rough() {
    return this.kayak.rough;
  }

  /**
   * The falls ahead, heard before they're seen: `level` 0..1, how loud they are, and `near` 0..1,
   * how close the loudest one is (far off it's a low, muffled rumble). A little ledge only carries
   * a few boat lengths; a big waterfall a couple of hundred metres, and a cascade's steps add up.
   */
  get roar() {
    const s = this.kayak.s;
    let level = 0;
    let near = 0;
    let loudest = 0;
    for (const o of this.course.near(s - 40, s + 240)) {
      if (!('kind' in o) || o.kind !== 'ledge') continue;
      const size = THREE.MathUtils.clamp((o.height - 0.6) / 5, 0, 1);
      const reach = 30 + size * 200;
      const d = o.s - s;
      // it swells as you come up to it, and dies away behind you
      const close = d >= 0 ? Math.max(0, 1 - d / reach) : Math.max(0, 1 + d / 35);
      const loud = (0.15 + size * 0.85) * close * close;
      level += loud;
      if (loud > loudest) (loudest = loud), (near = close);
    }
    return { level: Math.min(1, level), near };
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
    // enough river either side on a narrow phone, and not a postage stamp on a wide screen
    this.view = Math.max(22, Math.min(32, 20 / this.aspect + 9));
  }

  /** Where something is on screen, in CSS px. */
  onScreen(at: THREE.Vector3, width: number, height: number) {
    const p = at.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height };
  }

  update(realDt: number, outside: Outside) {
    this.light(outside);
    if (this.paused) {
      // still listening, so a pad can get round the pause card (nothing it does moves the kayak)
      this.controls.read();
      this.frame(0);
      return;
    }
    const dt = this.pace(realDt);
    this.clock += dt;
    const intent = this.controls.read();
    this.kayak.assisted = this.controls.assisted;
    // paddling or steering at the top is as good as saying go
    if (this.state === 'ready' && (intent.left > 0.3 || intent.right > 0.3 || intent.tapLeft || intent.tapRight)) this.events.start?.();
    const running = this.state === 'running';
    if (this.state !== 'ready') this.kayak.update(dt, intent, this.course, running);
    this.overTheLip(running);
    if (running && (intent.left > 0.3 || intent.right > 0.3)) this.paddled = true;
    if (running && (intent.left > 0.3) !== (intent.right > 0.3)) this.steered = true;
    const k = this.kayak;
    this.wobble(dt);
    if ((this.streakFor -= realDt) < 0) this.streak = 0;
    this.course.extend(k.s + 300);
    this.land.update(k.pos, this.reach, k.s - 40, k.s + 100);
    // the lamps come on as the light goes, well before it's properly dark
    this.lit = THREE.MathUtils.smoothstep(outside.night, 0.12, 0.42);
    this.land.glow(outside.night, this.lit, this.clock, outside.fair ? 1 : 0.15);
    this.shore();
    this.wildlife.storm = this.storm = outside.storm ?? 0;
    this.kayak.storm = this.storm;
    const across = k.here?.a ?? 0;
    this.wildlife.blow.set(Math.cos(across), Math.sin(across)).multiplyScalar(k.gust);
    this.lightning(outside.flash ?? 0);
    this.headlamp(outside.night);
    this.wildlife.update(dt, k.pos, k.s, k.speed, outside.night, outside.rain, outside.snow, outside.fair);
    this.shade(dt);
    this.bob(dt);

    if (running) this.score(dt);
    if (running) this.coach();
    if (this.overIn > 0 && (this.overIn -= realDt) <= 0) this.events.over?.(this.tally);

    this.effects(dt, realDt);
    this.frame(realDt);
    this.flash.amount = Math.max(0, this.flash.amount - realDt * 3);
  }

  /**
   * How much time passes this frame. Off a big drop it slows right down, and off a waterfall
   * slower still; then, hitting the water at its foot, it all but stops for a beat before picking
   * up again. And as a waterfall's lip comes up, the view starts to lean in.
   */
  private pace(realDt: number) {
    const k = this.kayak;
    const running = this.state === 'running';
    const high = k.airborne ? k.pos.y - this.course.heightAt(k.s) : 0;
    const falls = running && k.flying >= 3;
    let want = falls && high > 0.4 ? 0.33 : running && high > 1.4 ? 0.45 : 1;
    if (this.hitstop > 0) {
      this.hitstop -= realDt;
      this.slow = want = 0.06;
    }
    // (quickly into it, easing back out)
    this.slow += (want - this.slow) * (1 - Math.exp(-realDt * (want < this.slow ? 14 : 4)));
    let lean = falls ? 1 : 0;
    if (running && !k.airborne) {
      for (const l of this.course.near(k.s, k.s + 20)) {
        if (!('kind' in l) || l.kind !== 'ledge' || l.height < 3 || l.passed) continue;
        const t = (l.s - k.s) / Math.max(1, k.speed);
        lean = Math.max(lean, 0.35 * Math.max(0, 1 - t / 1.5));
      }
    }
    this.drama += (lean - this.drama) * (1 - Math.exp(-realDt * (lean > this.drama ? 6 : 1.8)));
    return realDt * this.slow;
  }

  /** Over the lip of a waterfall: a rush of air, the boat stretched long, the lip pouring away all the way across. */
  private overTheLip(running: boolean) {
    const k = this.kayak;
    const big = running ? k.flying : 0;
    if (big >= 3 && !this.plunging) {
      this.plunging = big;
      this.events.sound?.('whoosh', 1);
      this.squash(-0.18);
      this.controls.rumble(0.3, 0.9, 300);
      const p = this.course.at(k.s - 0.5);
      for (let u = -p.width / 2; u < p.width / 2; u += 0.7) {
        this.wildlife.spray(new THREE.Vector3(p.x + Math.cos(p.a) * u, p.y + 0.1, p.z + Math.sin(p.a) * u), 1, 0.8);
      }
    }
    if (!k.airborne) this.plunging = 0;
  }

  /**
   * Into the foot of a waterfall: a column of white water thrown up, a ring of it out across the
   * pool, mist hanging in the air after, and time stopping dead for a beat.
   */
  private plunge(height: number, at: THREE.Vector3) {
    this.plunging = 0;
    const big = Math.min(1.4, height / 4.5);
    this.wildlife.plume(at, Math.round(60 * big), 0.8 + big * 0.4);
    this.wildlife.ring(at, 50, 1.6 + big * 0.8);
    this.wildlife.mist(at, Math.round(45 * big), 4 + height * 0.6);
    this.ripple(at.x, at.z, 2);
    this.hitstop = 0.09 + big * 0.05;
    this.shake = 1;
    this.events.sound?.('plunge', Math.min(1, 0.6 + big * 0.3));
    this.controls.rumble(1, 1, 500);
  }

  /** How far the ground has to reach round the kayak to fill the view. */
  private get reach() {
    const view = this.view * this.zoom;
    const h = view / Math.sin(ELEVATION);
    return Math.hypot(view * this.aspect * 0.5, h * 0.75) + 10;
  }

  // --- the flow -------------------------------------------------------------------------

  private score(dt: number) {
    const k = this.kayak;
    const t = this.tally;
    t.time += dt;
    const metres = Math.min(this.length, Math.max(t.metres, Math.floor(k.s - this.start)));
    if (metres > this.lastMetres) {
      t.score += (metres - this.lastMetres) * t.flow * t.pace;
      this.lastMetres = metres;
    }
    t.metres = metres;
    t.speed = k.speed;
    // eased, so the readout doesn't flicker with every stroke
    const pace = 1 + THREE.MathUtils.clamp((k.speed - SLOW) / (FAST - SLOW), 0, 1);
    t.pace += (pace - t.pace) * (1 - Math.exp(-dt * 3));
    const i = k.here.stretch;
    if (i !== this.stretch) {
      const was = this.course.stretches[this.stretch];
      const now = this.course.stretches[i];
      this.stretch = i;
      this.events.stretch?.(now, i);
      // out the bottom of white water without a knock or a swim: that's worth something
      if (was && white(was) && this.clean) {
        const grade = was.grade ?? 3;
        this.well(`${was.name ?? 'The falls'} · clean!`, 0.3 + grade * 0.1, { flash: 0.45, sound: 'cleared', rumble: 0.6, kick: 0.5 });
      }
      // dropping into it: the water grabs you
      if (white(now) && (!was || !white(was))) {
        this.shake = Math.max(this.shake, 0.25 + now.heat * 0.35);
        this.events.sound?.('dropin', 0.5 + now.heat * 0.5);
        this.controls.rumble(0.3 + now.heat * 0.4, 0.6, 260);
      }
      this.clean = true;
    }
    this.round();
    this.flatOut(dt);
    this.goals(false);
    if (metres >= this.length) this.finish();
  }

  /**
   * The river's goals: the ones that can come any time as they happen, and at the take-out the
   * ones that only count once you're down (no knocks, every gate). Each pays once a run.
   */
  private goals(down: boolean) {
    const t = this.tally;
    this.river.goals.forEach((g, i) => {
      if (t.goals.includes(i) || !this.met(g, down)) return;
      t.goals.push(i);
      t.goalPoints += g.points;
      t.score += g.points;
      this.events.goal?.(g, i);
      if (down) return; // (the take-out has its own moment)
      this.well(`${g.text} · +${g.points}`, 0.4, { flash: 0.4, sound: 'best', rumble: 0.7, kick: 0.5 });
      this.wildlife.sparkle(this.kayak.pos, 30, undefined, 1.2);
    });
  }

  private met(g: Goal, down: boolean) {
    const t = this.tally;
    const n = g.n ?? 1;
    switch (g.kind) {
      case 'balls': return t.balls >= n;
      case 'flow': return t.bestFlow >= n;
      case 'spin': return t.spins >= n;
      case 'sends': return t.sends >= n;
      case 'falls': return t.fallsSent >= n;
      case 'train': return t.pumpedTrains >= n;
      case 'flat': return t.longest >= n;
      case 'time': return down && t.time < n;
      case 'clean': return down && t.knocks === 0;
      case 'upright': return down && t.flips === 0;
      case 'gates': return down && t.gates > 0 && t.missed === 0;
      case 'boofs': {
        const lips = this.course.ledges.filter((l) => l.height < 3 && l.s > this.start && l.s < this.start + this.length).length;
        return down && lips > 0 && t.boofs >= lips;
      }
    }
  }

  /** Holding it flat out: every HOT_EVERY s pays, and more the longer it goes on. */
  private flatOut(dt: number) {
    const k = this.kayak;
    const t = this.tally;
    if (k.speed >= FAST && k.balance === 'up') this.hotLeft = HOT_GRACE;
    else if ((this.hotLeft -= dt) <= 0) {
      this.hotFor = this.hotPaid = 0;
      return;
    }
    this.hotFor += dt;
    t.longest = Math.max(t.longest, this.hotFor);
    const n = Math.floor(this.hotFor / HOT_EVERY);
    if (n <= this.hotPaid) return;
    this.hotPaid = n;
    const points = Math.round(HOT * n * t.flow);
    t.score += points;
    t.flatOut += points;
    const word = HOT_WORDS[Math.min(n, HOT_WORDS.length) - 1];
    this.well(`${word} ${n * HOT_EVERY}s · +${points}`, 0.15 + Math.min(n, 4) * 0.05, { sound: 'whoosh', rumble: 0.3 + Math.min(n, 4) * 0.1, kick: 0.2 + Math.min(n, 4) * 0.1 });
    this.wildlife.sparkle(k.pos, 8 + n * 4, undefined, 0.7);
  }

  /** Off a drop and landed clean: if you went over it flat out, what that's worth (0 if not). */
  private send(height: number) {
    const fast = (this.kayak.lipSpeed - SEND_FROM) / (SEND_TOP - SEND_FROM);
    if (fast < 0 || this.state !== 'running') return 0;
    const t = this.tally;
    const points = Math.round(SEND * Math.max(1, height) * (1 + Math.min(1, fast)) * t.flow);
    t.score += points;
    t.sends++;
    t.sent += points;
    return points;
  }

  /** Under the bridge: the clock stops, every second under par pays, and so does every gate and ball. */
  private finish() {
    const t = this.tally;
    t.finished = true;
    t.bonus = { time: Math.round(Math.max(0, this.par - t.time) * TICK * t.flow), gates: t.gates * GATE, balls: t.balls * BALL_POINTS, storm: 0 };
    t.score += t.bonus.time + t.bonus.gates + t.bonus.balls;
    // and all of it out in a storm
    if (this.storm >= 0.5) t.score += t.bonus.storm = Math.round(t.score * STORM_BONUS);
    this.goals(true);
    this.state = 'over';
    this.overIn = 1.4;
    this.kick = 1;
    this.flash.amount = 0.5;
    this.flash.color.set('#fff6d8');
    this.events.praise?.('The take-out!', true);
    this.events.sound?.('cleared');
    this.wildlife.sparkle(this.kayak.pos, 40, undefined, 1.4);
    this.wildlife.confetti(this.kayak.pos, 70);
    this.ripple(this.kayak.pos.x, this.kayak.pos.z, 3.5);
    this.controls.rumble(0.8, 0.8, 300);
  }

  /**
   * An island coming up: which way's the fast line. Round it, which channel you took; out the
   * bottom of the hero line without a knock, a reward.
   */
  private round() {
    const k = this.kayak;
    const next = this.course.splits.find((x) => k.s > x.s0 - 30 && k.s < x.s0);
    if (next && next !== this.split) {
      this.split = next;
      this.splitClean = true;
      this.took = 0;
      this.events.split?.(next);
    }
    const sp = this.split;
    if (!sp) return;
    if (k.here.isle > 1) this.took = Math.sign(k.side - k.here.isleU);
    if (k.s > sp.s1) {
      if (this.took === sp.hero && this.splitClean) this.well('Hero line!', 0.4, { flash: 0.35, sound: 'cleared', rumble: 0.5, kick: 0.4 });
      this.split = null;
    }
  }

  /** Something done well: more flow, and a flash to feel it (the river never stops for it). */
  private well(text: string, gain: number, juice: { flash?: number; sound?: RiverSound; rumble?: number; kick?: number } = {}) {
    if (this.state !== 'running') return;
    const t = this.tally;
    const was = Math.floor(t.flow);
    t.flow = Math.min(FLOW_MAX, Math.round((t.flow + gain) * 100) / 100);
    t.bestFlow = Math.max(t.bestFlow, t.flow);
    this.events.praise?.(text, gain >= 0.5);
    // one after another, each a note higher
    this.events.sound?.('chime', 1, this.streak++);
    this.streakFor = 3;
    this.squash(-0.12);
    if (Math.floor(t.flow) > was) {
      const now = Math.floor(t.flow);
      this.events.tier?.(now);
      this.events.sound?.('tier', 1, now - 2);
      this.wildlife.sparkle(this.kayak.pos, 16 + now * 6, undefined, 0.8 + now * 0.15);
      // and a ring spreading out across the water from the boat
      this.ripple(this.kayak.pos.x, this.kayak.pos.z, 2.5 + now * 0.4);
      this.wildlife.ring(this.kayak.pos, 20 + now * 4, 0.9);
      this.kick = Math.max(this.kick, 0.7);
      this.controls.rumble(0.6, 0.9, 220);
    }
    if (juice.flash) {
      this.flash.amount = juice.flash;
      this.flash.color.set('#fff6d8');
    }
    if (juice.sound) this.events.sound?.(juice.sound);
    if (juice.rumble) this.controls.rumble(juice.rumble, juice.rumble * 0.7, 140);
    if (juice.kick) this.kick = juice.kick;
  }

  /** Something gone wrong: the flow's gone (and, `cost`ing points, say so even if there wasn't much flow to lose). */
  private broke(why: string, cost = 0) {
    if (this.state !== 'running') return;
    this.clean = false;
    this.splitClean = false;
    this.streak = 0;
    this.hotFor = this.hotPaid = this.hotLeft = 0;
    if (cost) {
      this.tally.score = Math.max(0, this.tally.score - cost);
      this.events.broke?.(why, cost);
      this.events.sound?.('lost', 0.6);
    } else if (this.tally.flow > 1.2) {
      this.events.broke?.(why, 0);
      this.events.sound?.('lost', Math.min(1, this.tally.flow / 3));
    }
    this.tally.flow = 1;
  }

  /**
   * The first time each thing comes up, a word on how to deal with it: straight away if it's
   * happening now (tipping, a ledge coming up), otherwise only once it's been quiet a while.
   */
  private tell(h: Hint, now = false) {
    const t = this.tally.time;
    if (this.hinted.has(h) || (!now && t < this.quiet)) return;
    this.hinted.add(h);
    this.events.hint?.(h);
    this.quiet = Math.max(this.quiet, t + (now ? QUIET / 2 : QUIET));
  }

  private coach() {
    const k = this.kayak;
    const t = this.tally.time;
    if (Math.abs(k.tilt) > 0.45 && !this.controls.assisted) this.tell('lean', true);
    // the basics, only if you've not found them yourself
    if (!this.paddled && t > 3) this.tell('paddle');
    if (!this.steered && t > 12) this.tell('steer');
    if (t > 30 && k.speed > 5) this.tell('sprint');
    for (const o of this.course.near(k.s + 8, k.s + 40)) {
      if (!('kind' in o)) continue;
      if (o.kind === 'ledge' && o.s > k.s + 10 && o.s < k.s + 35) this.tell(o.height >= 3 ? 'falls' : 'boof', true);
      if (o.kind === 'tongue' && o.s > k.s + 12 && this.hinted.has('boof')) this.tell('tongue');
      if (o.kind === 'rock' && !o.scenery && o.s > k.s + 14 && t > 50) this.tell('eddy');
      if (o.kind === 'ball' && !o.taken && o.s > k.s + 12) this.tell('ball');
      if (o.kind === 'train' && o.s > k.s + 6 && o.s < k.s + 30) this.tell('waves', true);
    }
  }

  private wire() {
    const k = this.kayak;
    k.events = {
      hit: (strength, at) => {
        this.shake = Math.min(1, strength / 4);
        this.squash(Math.min(0.3, strength * 0.07));
        this.wildlife.spray(at, 18, 1);
        this.ripple(at.x, at.z, 0.8);
        this.events.sound?.('hit', Math.min(1, strength / 4));
        this.controls.rumble(0.9, 0.6, 260);
        this.flash.amount = 0.35;
        this.flash.color.set('#ff5a3c');
        if (this.state === 'running') this.tally.knocks++;
        this.broke('Knocked');
      },
      bump: (strength, at) => {
        if (strength < 0.6) return;
        this.wildlife.spray(at, 5, 0.6);
        this.squash(Math.min(0.1, strength * 0.03));
        this.events.sound?.('bump', Math.min(1, strength / 3));
        this.controls.rumble(0.25, 0.2, 80);
      },
      splash: (size, at) => {
        if (size < 2) return;
        this.shake = Math.max(this.shake, Math.min(1, size / 10));
        this.wildlife.spray(at, Math.min(50, size * 5), Math.min(1.8, size / 5));
        this.wildlife.ring(at, Math.min(40, 12 + size * 3), Math.min(1.6, 0.6 + size / 10));
        this.ripple(at.x, at.z, Math.min(2, size / 4));
        this.squash(Math.min(0.4, size * 0.05));
        this.events.sound?.('splash', Math.min(1, size / 8));
        this.controls.rumble(Math.min(1, size / 9), 0.4, 200);
        if (this.plunging) this.plunge(this.plunging, at);
      },
      ledge: (how, height) => {
        const sent = how === 'boof' || how === 'tuck' ? this.send(height) : 0;
        if (this.state === 'running' && how === 'boof') this.tally.boofs++;
        if (this.state === 'running' && how === 'tuck' && sent) this.tally.fallsSent++;
        if (sent) {
          this.well(`Full send! +${sent}`, 0.9, { flash: 0.5, sound: 'boof', rumble: 1, kick: 1 });
          this.wildlife.sparkle(k.pos, 30, undefined, 1.2);
        } else if (how === 'boof') this.well(height > 2 ? 'BOOF!' : 'Boof!', height > 2 ? 0.7 : 0.5, { flash: 0.35, sound: 'boof', rumble: 0.8, kick: 0.6 });
        else if (how === 'tuck') this.well('Tucked it!', 0.8, { flash: 0.4, sound: 'boof', rumble: 1, kick: 0.8 });
        else if (how === 'flat' || how === 'skew') {
          this.shake = 1;
          this.controls.rumble(1, 1, 350);
          this.flash.amount = 0.4;
          this.flash.color.set('#ff5a3c');
          this.broke(how === 'flat' ? 'Landed flat' : 'Landed sideways');
        } else this.broke('Nose first');
      },
      brace: (perfect) => {
        if (perfect) this.well('Perfect brace!', 0.5, { flash: 0.25, sound: 'brace', rumble: 0.7, kick: 0.3 });
        else this.well('Brace', 0.2, { sound: 'brace', rumble: 0.4 });
      },
      tipping: () => {
        this.controls.rumble(0.2, 0.8, 120);
        this.tell('brace', true);
      },
      capsize: () => {
        this.events.sound?.('capsize');
        this.wildlife.spray(k.pos, 30, 1.2);
        this.controls.rumble(1, 1, 400);
        if (this.state === 'running') this.tally.flips++;
        this.broke('Upside down', FLIP);
        this.tell('roll', true);
      },
      rolled: () => {
        this.events.sound?.('roll');
        this.wildlife.spray(k.pos, 20, 0.8);
        this.squash(-0.2);
        this.events.praise?.('Rolled up!', true);
        this.controls.rumble(0.5, 0.5, 180);
      },
      swim: () => {
        if (this.state !== 'running') return;
        this.state = 'over';
        this.overIn = 1.8;
        this.events.sound?.('capsize', 0.7);
      },
      hole: (stuck) => {
        this.events.sound?.('hole', stuck ? 1 : 0.5);
        if (stuck) this.tell('hole', true);
      },
      punched: () => this.well('Punched it!', 0.3, { sound: 'whoosh', rumble: 0.5 }),
      // reading the water: out of the current into the slack behind a rock or a bend, and out again
      eddy: () => {
        if (k.s < this.eddyS + 12) return;
        this.eddyS = k.s;
        this.well('Eddy!', 0.3, { sound: 'gate', rumble: 0.35 });
        this.tell('peel', true);
      },
      peel: () => this.well('Peeled out', 0.15, { sound: 'whoosh' }),
      sprint: () => {
        this.events.sound?.('whoosh', 1);
        this.controls.rumble(0.5, 0.8, 220);
        this.kick = Math.max(this.kick, 0.35);
        this.squash(-0.16);
        const hx = Math.sin(k.heading);
        const hz = -Math.cos(k.heading);
        this.wildlife.spray(k.pos.clone().add(new THREE.Vector3(hx * 1.6, 0.1, hz * 1.6)), 10, 0.9);
      },
      tongue: () => this.well('On the tongue', 0.2, { sound: 'whoosh' }),
      // a wave train: pumping down the backs of the waves, off the crests, and out the bottom still upright
      pump: (chain) => {
        this.squash(-0.1 - Math.min(4, chain) * 0.02);
        this.controls.rumble(0.2 + Math.min(4, chain) * 0.06, 0.3, 90);
        const hx = Math.sin(k.heading);
        const hz = -Math.cos(k.heading);
        this.wildlife.spray(k.pos.clone().add(new THREE.Vector3(hx * 1.7, 0.1, hz * 1.7)), 4 + chain * 2, 0.7);
        if (chain >= 2) this.well(`Pump ×${chain}`, 0.04 + Math.min(5, chain) * 0.03, { sound: 'whoosh', kick: 0.1 + Math.min(5, chain) * 0.04 });
        else this.events.sound?.('whoosh', 0.5);
      },
      air: (clean) => {
        if (clean) this.well('Stomped it!', 0.15, { sound: 'boof', rumble: 0.5, kick: 0.3 });
        else {
          this.shake = Math.max(this.shake, 0.4);
          this.squash(0.15);
          this.controls.rumble(0.6, 0.8, 160);
          this.events.sound?.('splash', 0.5);
        }
      },
      rode: (count, pumped, steady) => {
        if (!steady || this.state !== 'running') return;
        const t = this.tally;
        const points = Math.round((count * 20 + pumped * 30) * t.flow);
        t.score += points;
        t.trains++;
        t.rode += points;
        const all = pumped >= count - 1;
        if (all) t.pumpedTrains++;
        this.well(all ? `Rode the train! +${points}` : `Wave train · +${points}`, all ? 0.6 : 0.3, { flash: all ? 0.3 : 0, sound: 'cleared', rumble: 0.5, kick: all ? 0.5 : 0.2 });
        if (all) this.wildlife.sparkle(k.pos, 20, undefined, 1);
      },
      shave: () => this.well('Close!', 0.15, { sound: 'whoosh' }),
      spin: (turns) => (this.state === 'running' && this.tally.spins++, this.well(`${turns * 360}!`, 0.6 + turns * 0.2, { flash: 0.3, sound: 'boof', rumble: 0.7, kick: 0.3 })),
      stroke: (q, back, side) => {
        this.events.sound?.('stroke', 0.25 + q * 0.35);
        // a ring where the blade goes in
        const ex = Math.cos(k.heading);
        const ez = Math.sin(k.heading);
        const fwd = back ? -0.5 : 0.6;
        this.ripple(k.pos.x + ex * side * 1.2 + Math.sin(k.heading) * fwd, k.pos.z + ez * side * 1.2 - Math.cos(k.heading) * fwd, 0.3 + q * 0.4);
        // a little lunge on each stroke
        if (!back) this.squash(-0.04 - q * 0.04);
        // drips off the blade coming out of the water
        const hx = Math.sin(k.heading);
        const hz = -Math.cos(k.heading);
        for (let i = 0; i < 3 + q * 4; i++) {
          const side = Math.random() < 0.5 ? -1 : 1;
          this.wildlife.drip(k.pos.clone().add(new THREE.Vector3(-hz * side * 1.2, 0.8, hx * side * 1.2)));
        }
        if (back) this.wildlife.froth(k.pos.clone());
      },
      pickup: () => {
        if (this.state !== 'running') return;
        this.tally.balls++;
        this.events.sound?.('ball');
        this.events.ball?.();
        this.wildlife.sparkle(k.pos, 14, BALL);
        this.squash(0.08);
      },
      gate: (_, through) => {
        if (this.state !== 'running') return;
        if (!through) {
          this.tally.missed++;
          return;
        }
        this.tally.gates++;
        this.well('Clean gate', 0.25, { sound: 'gate', rumble: 0.3 });
      },
    };
    this.wildlife.events = {
      say: (text) => this.events.say?.(text),
      croak: () => this.events.sound?.('croak'),
      bark: () => this.events.bark?.(),
      baa: () => this.events.baa?.(),
      quack: () => this.events.quack?.(),
      spotted: (kind) => {
        if (this.tally.spotted.includes(kind)) return;
        this.tally.spotted.push(kind);
        this.events.sound?.('spotted');
        this.events.spotted?.(kind);
      },
      slap: () => this.events.sound?.('slap'),
      howl: () => this.events.sound?.('howl'),
      huff: () => this.events.sound?.('huff'),
      cry: (kind) => this.events.sound?.(kind),
    };
  }

  // --- what you see ---------------------------------------------------------------------------

  /** The rocks, holes and tongues nearest the kayak, for the water to draw. */
  private shade(dt: number) {
    const k = this.kayak;
    const u = this.water.uniforms;
    const rocks = u.uRocks.value as THREE.Vector4[];
    const holes = u.uHoles.value as THREE.Vector4[];
    const tongues = u.uTongues.value as THREE.Vector4[];
    let nr = 0;
    let nh = 0;
    let nt = 0;
    for (const o of this.course.near(k.s - 20, k.s + 80)) {
      if (!('kind' in o)) continue;
      if (o.kind === 'rock' && !o.scenery && nr < MAX_ROCKS) rocks[nr++].set(o.x, o.z, o.r * 0.9, 0);
      else if (o.kind === 'log') {
        for (let t = 0.15; t < 1 && nr < MAX_ROCKS; t += 0.25) rocks[nr++].set(o.x0 + (o.x1 - o.x0) * t, o.z0 + (o.z1 - o.z0) * t, o.r, -0.2);
      } else if (o.kind === 'hole' && nh < MAX_HOLES) {
        const p = this.course.at(o.s);
        holes[nh++].set(p.x + Math.cos(p.a) * o.u, p.z + Math.sin(p.a) * o.u, o.half, o.strength);
      } else if (o.kind === 'tongue' && nt < MAX_TONGUES) {
        const p = this.course.at(o.s);
        tongues[nt++].set(p.x + Math.cos(p.a) * o.u, p.z + Math.sin(p.a) * o.u, o.half, 0);
      }
    }
    // the lips coming up, and whether now's the moment: a stroke in the next BOOF_WINDOW seconds
    // boofs it (lit a beat early, for the time it takes to see it and pull)
    const lips = u.uLips.value as THREE.Vector4[];
    let nl = 0;
    let cue = 0;
    for (const l of this.course.ledges) {
      if (l.s < k.s - 4 || l.s > k.s + 70 || nl >= MAX_LIPS) continue;
      const p = this.course.at(l.s - LIP_AT); // (the last of the flat water)
      const t = l.passed ? 9 : (l.s - LIP_AT - k.s) / Math.max(1, k.speed);
      const lead = BOOF_WINDOW + 0.2;
      const glow = this.state !== 'running' || t < 0 ? 0 : l.height >= 3 ? (t < 1.4 ? 1 : 0) : t < lead ? 1 : t < lead + 0.6 ? 0.3 : 0;
      cue = Math.max(cue, glow >= 1 ? 1 : 0);
      lips[nl++].set(p.x, p.z, l.height, glow);
    }
    for (; nl < MAX_LIPS; nl++) lips[nl].set(0, 0, 0, 0);
    // the wave trains in sight (a long one started a way back)
    const ta = u.uTrains.value as THREE.Vector4[];
    const tb = u.uTrainsB.value as THREE.Vector4[];
    let nw = 0;
    for (const o of this.course.near(k.s - 80, k.s + 90)) {
      if (!('kind' in o) || o.kind !== 'train' || nw >= MAX_TRAINS) continue;
      if (o.s + o.length * (o.count + 0.5) < k.s - 25) continue;
      ta[nw].set(o.s, o.u, o.half, o.amp);
      tb[nw++].set(o.length, o.count, o.skew, o.seed);
    }
    for (; nw < MAX_TRAINS; nw++) ta[nw].set(0, 0, 0, 0);
    // (a tick in the hands as the moment comes)
    if (cue && !this.cued) this.controls.rumble(0.25, 0.1, 50);
    this.cued = cue > 0;
    u.uHeat.value = THREE.MathUtils.clamp((this.tally.flow - 2) / 2, 0, 1);
    // froth where the side streams land (drawn as a rock's foam, with no eddy behind it)
    for (const f of this.land.feet()) if (nr < MAX_ROCKS && f.distanceToSquared(k.pos) < 70 * 70) rocks[nr++].set(f.x, f.z, 0.5, -1);
    for (; nr < MAX_ROCKS; nr++) rocks[nr].set(0, 0, 0, 0);
    for (; nh < MAX_HOLES; nh++) holes[nh].set(0, 0, 0, 0);
    for (; nt < MAX_TONGUES; nt++) tongues[nt].set(0, 0, 0, 0);
    u.uTime.value += dt;
    // the wake: it trails the way the boat's going through the water, not over the ground
    const through = k.balance === 'swimming' || k.airborne ? 0 : k.through.length();
    u.uBoat.value.set(k.pos.x, k.pos.z, Math.atan2(k.through.x, -k.through.y), through);
    // the rings drift off on the current, spreading as they go
    const things = this.course.near(k.s - 20, k.s + 30);
    this.ripples = this.ripples.filter((r) => (r.age += dt) < 0.9 + r.size * 0.6);
    for (const r of this.ripples) {
      const w = waterAt(this.course, r.x, r.z, k.s, things);
      r.x += (w.fx * w.along + w.px) * dt;
      r.z += (w.fz * w.along + w.pz) * dt;
    }
    const rings = u.uRipples.value as THREE.Vector4[];
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = this.ripples[this.ripples.length - 1 - i];
      if (r) rings[i].set(r.x, r.z, r.age, r.size);
      else rings[i].set(0, 0, 0, 0);
    }
  }

  /** Floating things bob and turn on the current, and the balls keep calling out to be fetched. */
  private bob(dt: number) {
    const k = this.kayak;
    const ring = this.land.beacon(this.clock);
    for (const o of this.course.near(k.s - 10, k.s + 80)) {
      if (!('kind' in o) || o.kind !== 'ball') continue;
      const m = this.land.meshOf(o);
      if (!m) continue;
      m.visible = !o.taken;
      m.position.y = this.course.heightAt(o.s) + Math.sin(this.clock * 2.5 + o.s) * 0.07;
      m.rotation.y += dt * 0.8;
      m.getObjectByName('ring')?.scale.setScalar(ring);
    }
  }

  /** Spray off the bow in white water, drips off the paddle, froth trailing off the stern. */
  private effects(dt: number, realDt: number) {
    const k = this.kayak;
    if (this.state === 'ready') return;
    const hx = Math.sin(k.heading);
    const hz = -Math.cos(k.heading);
    const rough = k.rough;
    if (Math.random() < dt * (rough * 30 + k.speed * 0.8 + (k.sprinting ? 20 : 0))) {
      const bow = k.pos.clone().add(new THREE.Vector3(hx * 1.8, 0.1, hz * 1.8));
      this.wildlife.spray(bow, 1 + Math.floor(rough * 3 + k.speed / 6), 0.4 + rough * 0.5);
    }
    // a wake that gets longer the faster you go
    if (Math.random() < dt * (6 + k.speed * 2)) {
      this.wildlife.froth(k.pos.clone().add(new THREE.Vector3(-hx * 2.1 + (Math.random() - 0.5) * 0.5, 0, -hz * 2.1)));
    }
    // running hot: the wake glints gold, more of it the higher the flow
    const hot = this.tally.flow - 2;
    if (hot > 0 && k.balance === 'up' && Math.random() < dt * hot * 14) {
      this.wildlife.glint(k.pos.clone().add(new THREE.Vector3(-hx * 2 + (Math.random() - 0.5) * 0.8, 0, -hz * 2 + (Math.random() - 0.5) * 0.8)));
    }
    // bits of froth afloat on the water ahead, going where the water goes: racing down the core,
    // slack by the banks, round and back up in an eddy
    for (let n = Math.random() < dt * 10 ? 1 : 0; n > 0; n--) {
      const at = this.course.at(k.s + 2 + Math.random() * 26);
      const off = (Math.random() * 2 - 1) * at.width * 0.48;
      this.wildlife.froth(new THREE.Vector3(at.x + Math.cos(at.a) * off, at.y + 0.02, at.z + Math.sin(at.a) * off), 3 + Math.random() * 2);
    }
    // over a waterfall: spray off the curtain streaming up past you on the way down
    if (this.plunging && k.airborne) {
      const rx = Math.cos(k.heading);
      const rz = Math.sin(k.heading);
      for (let n = Math.floor(realDt * 70 + Math.random()); n > 0; n--) {
        const u = (Math.random() - 0.5) * 4;
        const f = (Math.random() - 0.3) * 2;
        this.wildlife.spray(k.pos.clone().add(new THREE.Vector3(rx * u + hx * f, (Math.random() - 0.5) * 1.5, rz * u + hz * f)), 1, 1.6);
      }
    }
    // mist at the foot of a drop
    for (const t of this.course.near(k.s, k.s + 30)) {
      if (!('kind' in t) || t.kind !== 'ledge' || t.s < k.s) continue;
      if (Math.random() < dt * (6 + t.height * 6)) {
        const p = this.course.at(t.s + 3);
        const u = (Math.random() - 0.5) * p.width;
        this.wildlife.spray(new THREE.Vector3(p.x + Math.cos(p.a) * u, p.y + 0.2, p.z + Math.sin(p.a) * u), 1, 0.5 + t.height * 0.2);
      }
    }
    // smoke from the cottages' chimneys
    for (const c of this.land.chimneys()) {
      if (Math.random() < dt * 5 && c.distanceToSquared(k.pos) < 70 * 70) this.wildlife.smoke(c);
    }
    // and after dark, sparks going up off the fires, and a thread of smoke
    if (this.lit > 0.1) {
      for (const e of this.land.embers()) {
        if (e.distanceToSquared(k.pos) > 60 * 60) continue;
        if (Math.random() < dt * 7 * this.lit) this.wildlife.ember(e);
        if (Math.random() < dt * 1.5) this.wildlife.smoke(e);
      }
    }
    // spray where a side stream lands
    for (const f of this.land.feet()) {
      if (Math.random() < dt * 8 && f.distanceToSquared(k.pos) < 60 * 60) this.wildlife.spray(f, 1, 0.6);
    }
    // the pad hums in big water, and trembles deep down as a big fall comes up
    const roar = this.roar.level;
    const dread = roar * roar;
    if ((this.rumbleAt -= realDt) < 0 && (rough > 0.35 || dread > 0.08) && k.balance === 'up') {
      this.rumbleAt = 0.18;
      this.controls.rumble(Math.max(rough * 0.15, dread * 0.55), Math.max(rough * 0.35, dread * 0.2), 200);
    }
  }

  /** A ring on the water at (x, z), `size` 0..2. */
  private ripple(x: number, z: number, size: number) {
    this.ripples.push({ x, z, age: 0, size });
    if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
  }

  /** Give the boat a squash (+) or a stretch (-), for the spring to shake out. */
  private squash(amount: number) {
    this.squishV += amount * 18;
  }

  /** The squash-and-stretch spring: quick, and a little bouncy. */
  private wobble(dt: number) {
    const step = Math.min(dt, 1 / 30);
    this.squishV += (-this.squish * 320 - this.squishV * 16) * step;
    this.squish = THREE.MathUtils.clamp(this.squish + this.squishV * step, -0.3, 0.4);
    const q = this.squish;
    // flatter and wider when squashed, longer and thinner when stretched (bow is the model's z)
    this.kayak.model.scale.set(this.size.x * (1 + q * 0.5), this.size.y * (1 - q), this.size.z * (1 - q * 0.4));
  }

  /**
   * The island's lightning, out here too: the picture goes white for a blink, and a bolt comes
   * down behind the trees off one bank ahead, flickering out with the flash.
   */
  private lightning(flash: number) {
    if (flash > this.lastFlash + 0.5 && flash > 0.9) {
      this.flash.amount = Math.max(this.flash.amount, 0.55);
      this.flash.color.set('#e8eeff');
      this.strike();
    }
    this.lastFlash = flash;
    const m = this.bolt.material as THREE.MeshBasicMaterial;
    m.opacity = Math.min(1, flash * 1.6);
    this.bolt.visible = flash > 0.15 && this.bolt.visible;
  }

  /** A fresh bolt: jagged, forking once or twice, from high up down to the ground by the river. */
  private strike() {
    const k = this.kayak;
    const p = this.course.at(k.s + 4 + Math.random() * 12); // (in view: the camera doesn't see far ahead)
    const side = Math.random() < 0.5 ? -1 : 1;
    const off = side * (p.width / 2 + Math.random() * 3);
    const gx = p.x + Math.cos(p.a) * off;
    const gz = p.z + Math.sin(p.a) * off;
    const ground = this.land.heightAt(gx, gz);
    const pts: number[] = [];
    // each step a flat ribbon square on to the camera, thick enough to read as a pixel line or two
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const bar = (x: number, y: number, z: number, nx: number, ny: number, nz: number, w: number) => {
      const ox = right.x * w;
      const oz = right.z * w;
      pts.push(x - ox, y, z - oz, x + ox, y, z + oz, nx + ox, ny, nz + oz, x - ox, y, z - oz, nx + ox, ny, nz + oz, nx - ox, ny, nz - oz);
    };
    const zag = (x: number, y: number, z: number, to: number, spread: number, forks: number, w = 0.22) => {
      const steps = Math.max(3, Math.round((y - to) / 4));
      const dy = (y - to) / steps;
      for (let i = 0; i < steps; i++) {
        const nx = x + (Math.random() - 0.5) * spread;
        const nz = z + (Math.random() - 0.5) * spread;
        const ny = y - dy;
        bar(x, y, z, nx, ny, nz, w);
        if (forks > 0 && i > 1 && Math.random() < 0.25) zag(nx, ny, nz, ny - dy * (2 + Math.random() * 3), spread * 0.8, forks - 1, w * 0.6);
        x = nx;
        y = ny;
        z = nz;
      }
    };
    zag(gx + (Math.random() - 0.5) * 6, ground + 30, gz + (Math.random() - 0.5) * 6, ground, 3, 2);
    this.bolt.geometry.dispose();
    this.bolt.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.bolt.visible = true;
  }

  /**
   * At night, the paddler's headlamp: a warm beam down the water ahead, lighting the rocks and the
   * banks as you come to them (and a little spark on the helmet, so you can see where you are).
   */
  private headlamp(night: number) {
    const k = this.kayak;
    // (on at dusk, once the banks are going dim, not only once it's black)
    const on = THREE.MathUtils.smoothstep(night, 0.15, 0.5) * (k.balance === 'swimming' ? 0.3 : 1);
    const u = this.water.uniforms;
    this.lamp.visible = this.lampGlow.visible = on > 0.01;
    if (!this.lamp.visible) {
      (u.uLamp.value as THREE.Vector4).w = 0;
      return;
    }
    const hx = Math.sin(k.heading);
    const hz = -Math.cos(k.heading);
    const head = k.head ? k.head.getWorldPosition(this.headAt) : this.headAt.copy(k.pos).setY(k.pos.y + 1.1);
    this.lamp.intensity = on * 4;
    this.lamp.position.copy(head);
    this.lamp.target.position.set(k.pos.x + hx * 14, k.pos.y, k.pos.z + hz * 14);
    this.lampGlow.position.copy(head).add(new THREE.Vector3(hx * 0.2, 0.1, hz * 0.2));
    (this.lampGlow.material as THREE.SpriteMaterial).opacity = on * (0.8 + Math.random() * 0.1);
    (u.uLamp.value as THREE.Vector4).set(k.pos.x, k.pos.z, k.heading, on);
  }

  /**
   * Hand the shore's real lights to the lamps nearest the boat, fading each out towards the edge
   * of its reach so none pops as it's handed on, and tell the water where they are.
   */
  private shore() {
    const k = this.kayak.pos;
    const u = this.water.uniforms;
    const pool = u.uShore.value as THREE.Vector4[];
    const colors = u.uShoreColor.value as THREE.Vector4[];
    const near: { g: THREE.Sprite; d: number }[] = [];
    if (this.lit > 0.01) {
      for (const g of this.land.lamps()) {
        const d = g.position.distanceToSquared(k);
        if (d < FAR_LAMP * FAR_LAMP) near.push({ g, d: Math.sqrt(d) });
      }
      near.sort((a, b) => a.d - b.d);
    }
    for (let i = 0; i < MAX_SHORE; i++) {
      const light = this.shoreLights[i];
      const n = near[i];
      if (!n) {
        light.intensity = 0;
        pool[i].w = 0;
        continue;
      }
      const l = n.g.userData as Lamp;
      const on = this.lit * flicker(l, this.clock) * (1 - THREE.MathUtils.smoothstep(n.d, FAR_LAMP * 0.6, FAR_LAMP));
      light.position.copy(n.g.position);
      light.color.set(l.color);
      light.distance = l.radius * 1.8;
      light.intensity = l.intensity * 7 * on;
      pool[i].set(n.g.position.x, n.g.position.z, l.radius * 0.9, Math.min(1, l.intensity) * on);
      colors[i].set(light.color.r, light.color.g, light.color.b, l.over ?? 0);
    }
  }

  /**
   * Light the river as the island is lit, right now (its time of day, its weather), in the air
   * this river's run in: a warmer or a greyer light, darker down in a gorge, thinner and bluer
   * high up in the mountains, and muffled in a bank of fog.
   */
  private light(o: Outside) {
    const mood = this.river.look.mood;
    const course = this.course;
    const s = this.kayak.s;
    const ease = this.paused ? 0 : 0.02;
    this.walls += (course.at(s).gorge - this.walls) * ease * 1.5;
    this.high += (highAt(this.river.look, course.seed, s) - this.high) * ease;
    this.fogged += (fogAt(this.river.look, course.seed, s) - this.fogged) * ease;
    const day = 1 - o.night;
    this.night = o.night;
    const flash = o.flash ?? 0;
    // the harder rivers are lifted a little after dark (see Mood.night)
    const lift = o.night * mood.night;
    // (the river's own tint is for the daylight: at night the moon's the moon)
    const tint = this.tint.set(mood.tint[0]).lerp(ICE, this.high * 0.5);
    const lean = (mood.tint[1] + this.high * 0.15) * day;
    this.sun.color.copy(o.sun.color).lerp(tint, lean);
    // (at night on the river there are few lamps but your own: it's darker than on the island,
    // but never so dark you can't make out the banks)
    const dark = 1 - o.night * 0.48;
    this.sun.intensity = o.sun.intensity * dark * (1 + (mood.sun - 1) * day) * (1 + lift) * (1 - this.walls * 0.22 * (1 - o.night * 0.4)) * (1 - this.fogged * 0.25) * (1 + this.high * 0.08);
    // and in the lightning, everything stands out stark for a moment
    this.sun.color.lerp(WHITE, flash * 0.7);
    this.sun.intensity += flash * 3;
    this.hemi.color.copy(o.hemi.color).lerp(tint, lean * 0.6);
    this.hemi.groundColor.copy(o.hemi.groundColor);
    this.hemi.intensity = o.hemi.intensity * (1 - o.night * 0.35) * (1 + (mood.sun - 1) * 0.6 * day) * (1 + lift * 1.3) * (1 - this.walls * 0.1) * (1 + this.fogged * 0.1); // (the island's lightning's already in its light)
    // the same sun, but never so low that a pine's shadow reaches across the river
    const dir = o.sun.position.clone().normalize();
    dir.y = Math.max(dir.y, 0.62);
    dir.normalize();
    this.sun.target.position.copy(this.kayak.pos);
    this.sun.position.copy(this.kayak.pos).addScaledVector(dir, 100);
    // the air: the island's, leaning a little to the river's own (and dark at night, whatever it
    // leans to); pale in a fog bank, clearer high up, and white for a moment in the island's lightning
    const fog = this.scene.fog as THREE.Fog;
    this.air.set(mood.air[0]).multiplyScalar(1 - o.night * 0.85);
    this.mist.copy(MIST).multiplyScalar(0.25 + day * 0.75);
    fog.color.copy(o.fog).multiplyScalar(1 - o.night * 0.5).lerp(this.air, mood.air[1]).lerp(this.mist, this.fogged * 0.6).lerp(WHITE, flash * 0.45);
    const sight = mood.sight * (1 - this.fogged * 0.35) * (1 + this.high * 0.1) * (1 - (o.haze ?? 0) * 0.4);
    fog.near = DISTANCE + 30 * sight * sight;
    fog.far = DISTANCE + 160 * sight;
    this.scene.background = fog.color;
    const u = this.water.uniforms;
    u.uLight.value.copy(this.hemi.color).lerp(this.sun.color, 0.3).lerp(WHITE, 0.35).multiplyScalar(0.3 + Math.min(this.sun.intensity, 2.5) * 0.29);
    u.uNight.value = o.night;
    u.uRain.value = o.rain;
    u.uSunDir.value.copy(dir);
    u.uSky.value.copy(this.hemi.color).lerp(fog.color, 0.5);
    // the camera looks down the river from behind, ELEVATION above the horizon
    u.uView.value.set(Math.sin(this.yaw) * Math.cos(ELEVATION), -Math.sin(ELEVATION), -Math.cos(this.yaw) * Math.cos(ELEVATION));
  }

  /**
   * Follow the kayak from behind and above, looking down the river: further ahead and pulled
   * back a little the faster you go, shaking in big water and on a knock, and kicking down a
   * touch on a boof.
   */
  private frame(dt: number) {
    const k = this.kayak;
    // looking down the river where you'll be in a second or two, so a bend doesn't hide what's round it
    const ahead = this.course.at(k.s + 10 + Math.min(12, k.speed * 1.2));
    this.yaw += (ahead.a - this.yaw) * (dt ? 1 - Math.exp(-dt * 1.4) : 1);
    // the faster it goes, the more river you see ahead: about three seconds of it
    const fast = THREE.MathUtils.clamp((k.speed - 3) / 7, 0, 1);
    this.zoom += (1 + fast * 0.32 - this.zoom) * (dt ? 1 - Math.exp(-dt * 1.2) : 1);
    // a kick (a boof, a tier) punches the view in a touch as well as down, and going over a
    // waterfall it leans right in
    const view = this.view * this.zoom * (1 - this.kick * 0.06) * (1 - this.drama * 0.22);
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    const fx = Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    // the kayak sits in the lower part of the screen, so you can see what's coming
    // (and over a waterfall it looks down at the foot, to watch you drop all the way into it)
    const lead = (view * (0.22 + fast * 0.08) * (1 - this.drama * 0.55)) / Math.sin(ELEVATION);
    const target = new THREE.Vector3(k.pos.x + fx * lead, this.course.heightAt(k.s) - this.kick * 0.6, k.pos.z + fz * lead);
    // the view trembles in white water, and in the last stretch before a big fall
    const roar = this.state === 'running' ? this.roar.level : 0;
    const rumble = k.balance === 'up' ? k.rough * 0.1 + roar ** 3 * 0.12 : 0;
    const shake = this.shake + rumble;
    if (shake > 0) {
      target.x += (Math.random() - 0.5) * shake * 0.6;
      target.z += (Math.random() - 0.5) * shake * 0.6;
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.kick = Math.max(0, this.kick - dt * 3);
    cam.position.set(
      target.x - fx * Math.cos(ELEVATION) * DISTANCE,
      target.y + Math.sin(ELEVATION) * DISTANCE,
      target.z - fz * Math.cos(ELEVATION) * DISTANCE,
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    // snap to the texel grid, and hand the remainder to the renderer (as the island does)
    const texel = view / this.texels();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const r = cam.position.dot(right) / texel;
    const u = cam.position.dot(up) / texel;
    const dr = Math.round(r) - r;
    const du = Math.round(u) - u;
    cam.position.addScaledVector(right, dr * texel).addScaledVector(up, du * texel);
    cam.updateMatrixWorld();
    this.subTexel.set(-dr, -du);
  }
}

const BALL = new THREE.Color('#d8f03a');
/** How far off a light on the bank can be and still light what's round it (m). */
const FAR_LAMP = 55;
const WHITE = new THREE.Color(1, 1, 1);
const ICE = new THREE.Color('#dce8ff');
const MIST = new THREE.Color('#d8e0e2');

function fresh(): Tally {
  return { metres: 0, time: 0, gates: 0, flips: 0, finished: false, bonus: { time: 0, gates: 0, balls: 0, storm: 0 }, balls: 0, sends: 0, sent: 0, longest: 0, flatOut: 0, flow: 1, bestFlow: 1, score: 0, speed: 0, pace: 1, spotted: [], trains: 0, rode: 0,
    knocks: 0, missed: 0, boofs: 0, spins: 0, fallsSent: 0, pumpedTrains: 0, goals: [], goalPoints: 0 };
}

/**
 * Where to push off, at or after arc length `from`: always in calm water (a pool, or an easy
 * forest run), with a good stretch of it ahead to get settled before anything happens.
 */
function calm(seed: number, from: number, river: RiverDef) {
  const probe = new Course(seed, Infinity, river);
  for (let s = from; s < from + 3000; s += 5) {
    probe.extend(s + 60);
    const st = probe.stretchAt(s);
    const easy = st.kind === 'pool' || st.kind === 'run';
    const at = Math.max(s, st.start + 15);
    // (and not on top of a gravel bar or an island: the kayak goes in mid-river)
    const clear = !probe.splits.some((x) => at > x.s0 - 45 && at < x.s1 + 10);
    if (easy && clear && st.end - at >= 50) return at;
  }
  return 50;
}

function white(s: Stretch) {
  return s.kind !== 'pool' && s.kind !== 'run';
}
