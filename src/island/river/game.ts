import * as THREE from 'three';
import { haloTexture } from '../scene/sky';
import { RiverAssets } from './assets';
import { Controls } from './controls';
import { Course, type Split, type Stretch } from './course';
import { Kayak } from './kayak';
import { Land } from './land';
import { waterAt } from './flow';
import { MAX_HOLES, MAX_RIPPLES, MAX_ROCKS, MAX_TONGUES, riverWater } from './water';
import { Wildlife } from './wildlife';

const ELEVATION = THREE.MathUtils.degToRad(48);
const DISTANCE = 140;
const FLOW_MAX = 5;
/** Speed pays: at or below SLOW m/s a metre's worth its flow, at FAST and over twice that. */
const SLOW = 3;
const FAST = 9;
/** How far it is from where you push off to the take-out (m): about five minutes' paddling. */
export const LENGTH = 1800;
/**
 * Par for the run (s): drifting down gets you there in about that. Every second under it at the
 * finish is worth TICK points, times the flow you finish on.
 */
export const PAR = LENGTH / 4.5;
const TICK = 25;
/** What each gate and each ball is worth at the take-out (only if you make it), and what a capsize costs. */
export const GATE = 150;
export const BALL_POINTS = 100;
export const FLIP = 300;

export type State = 'ready' | 'running' | 'over';

export interface Tally {
  metres: number;
  /** Seconds since you pushed off. */
  time: number;
  gates: number;
  flips: number;
  /** Made it to the take-out (rather than swimming), and what that was worth: the clock, the gates, the balls. */
  finished: boolean;
  bonus: { time: number; gates: number; balls: number };
  balls: number;
  /** The multiplier: built by doing things well, lost on a knock or a swim. */
  flow: number;
  bestFlow: number;
  score: number;
  speed: number;
  /** The speed bonus, ×1..×2: drifting earns the least, going like the clappers the most. */
  pace: number;
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
}

export type RiverSound = 'stroke' | 'bump' | 'hit' | 'splash' | 'ball' | 'gate' | 'croak' | 'capsize' | 'brace' | 'boof' | 'roll' | 'whoosh' | 'hole' | 'best' | 'cleared' | 'dropin' | 'chime' | 'tier' | 'lost' | 'mile';
export type Hint = 'paddle' | 'lean' | 'brace' | 'boof' | 'falls' | 'hole' | 'roll' | 'tongue' | 'eddy' | 'peel';

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
}

/**
 * The wild-water run: a mountain river made up ahead of you, 1.8 km down to the take-out, the
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
  /** 0..1: a flash over the picture, for a knock (red) or a boof (warm white). */
  flash = { amount: 0, color: new THREE.Color() };

  private course!: Course;
  private land!: Land;
  private wildlife: Wildlife;
  private water = riverWater();
  private sun = new THREE.DirectionalLight();
  private hemi = new THREE.HemisphereLight();
  private halo = haloTexture();
  private yaw = 0;
  private view = 26;
  private zoom = 1;
  private aspect = 1;
  private shake = 0;
  private kick = 0;
  private stretch = -1;
  /** Nothing's gone wrong since this stretch began. */
  private clean = true;
  /** The island coming up or being paddled round, the channel taken (-1 left, 1 right), and whether it's gone cleanly. */
  private split: Split | null = null;
  private took = 0;
  private splitClean = true;
  private overIn = 0;
  private clock = 0;
  private stop = 0; // hitstop: seconds of (almost) frozen time
  /** Things done well one after another: each chimes a note higher. */
  private streak = 0;
  private streakFor = 0;
  /** Squash and stretch: + squashed flat (a landing, a knock), - stretched long (a stroke). */
  private squish = 0;
  private squishV = 0;
  private size: THREE.Vector3;
  private hinted = new Set<Hint>();
  private rumbleAt = 0;
  private lastMetres = 0;
  /** Rings on the water (from a stroke, a landing, a knock), drifting off on the current. */
  private ripples: { x: number; z: number; age: number; size: number }[] = [];
  /** Where the last eddy was caught: the next one has to be further down to count. */
  private eddyS = -99;
  /** Where the kayak goes in: far enough down that there's river behind you too. To try a harder
   * stretch straight away: ?downriver=1500 (metres further on; you still push off in calm water,
   * see calm()). */
  private start = 50;
  private downriver = Number(new URLSearchParams(location.search).get('downriver')) || 0;

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

  /** A fresh river, the kayak at the top of it, waiting for you to push off. */
  reset() {
    this.land?.clear();
    this.land?.group.removeFromParent();
    // the same seed is the same river: ?seed=1234 to paddle one again
    const seed = Number(new URLSearchParams(location.search).get('seed')) || (Math.random() * 2 ** 31) | 0;
    this.start = calm(seed, 50 + this.downriver);
    this.course = new Course(seed, this.start + LENGTH);
    this.course.extend(this.start + 400);
    this.land = new Land(this.course, this.assets, this.water.material, this.halo);
    this.land.onSpots = (spots) => this.wildlife.settle(spots);
    this.scene.add(this.land.group);
    this.wildlife.reset(this.course);
    this.wildlife.ground = (x, z) => this.land.heightAt(x, z);
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
    this.stop = 0;
    this.streak = this.streakFor = 0;
    this.squish = this.squishV = 0;
    this.ripples = [];
    this.eddyS = -99;
    this.zoom = 1;
    this.yaw = this.course.at(this.start + 10).a;
    this.frame(0);
    // everything round the start, all at once, so the first frame isn't bare
    this.land.update(this.kayak.pos, this.reach, this.kayak.s - 40, this.kayak.s + 100, 999);
  }

  go() {
    if (this.state !== 'ready') return;
    this.state = 'running';
    if (!this.hinted.has('paddle')) {
      this.hinted.add('paddle');
      this.events.hint?.('paddle');
    }
  }

  /** Whether the kayak is pointing back towards the camera (its left is then the screen's right). */
  get facingCamera() {
    return Math.cos(this.kayak.heading - this.yaw) < 0;
  }

  /** How white the water is where the kayak is. */
  get rough() {
    return this.kayak.rough;
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
      this.frame(0);
      return;
    }
    // hitstop, and a slow-motion moment off a big drop
    let dt = realDt;
    if (this.stop > 0) {
      this.stop -= realDt;
      dt *= 0.06;
    } else if (this.kayak.airborne && this.state === 'running' && this.kayak.pos.y - this.course.heightAt(this.kayak.s) > 1.4) {
      dt *= 0.45;
    }
    this.clock += dt;
    const intent = this.controls.read();
    this.kayak.assisted = this.controls.assisted;
    // paddling or steering at the top is as good as saying go
    if (this.state === 'ready' && (intent.left > 0.3 || intent.right > 0.3 || intent.tapLeft || intent.tapRight)) this.events.start?.();
    const running = this.state === 'running';
    if (this.state !== 'ready') this.kayak.update(dt, intent, this.course, running);
    const k = this.kayak;
    this.wobble(dt);
    if ((this.streakFor -= realDt) < 0) this.streak = 0;
    this.course.extend(k.s + 300);
    this.land.update(k.pos, this.reach, k.s - 40, k.s + 100);
    this.land.glow(outside.night, this.clock);
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
    const metres = Math.min(LENGTH, Math.max(t.metres, Math.floor(k.s - this.start)));
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
        this.well(`${was.name ?? 'The falls'} · clean!`, 0.3 + grade * 0.1, { stop: 0.14, flash: 0.45, sound: 'cleared', rumble: 0.6, kick: 0.5 });
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
    if (metres >= LENGTH) this.finish();
  }

  /** Under the bridge: the clock stops, every second under par pays, and so does every gate and ball. */
  private finish() {
    const t = this.tally;
    t.finished = true;
    t.bonus = { time: Math.round(Math.max(0, PAR - t.time) * TICK * t.flow), gates: t.gates * GATE, balls: t.balls * BALL_POINTS };
    t.score += t.bonus.time + t.bonus.gates + t.bonus.balls;
    this.state = 'over';
    this.overIn = 1.4;
    this.stop = Math.max(this.stop, 0.2);
    this.kick = 1;
    this.flash.amount = 0.5;
    this.flash.color.set('#fff6d8');
    this.events.praise?.('The take-out!', true);
    this.events.sound?.('cleared');
    this.wildlife.sparkle(this.kayak.pos, 40, undefined, 1.4);
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
      if (this.took === sp.hero && this.splitClean) this.well('Hero line!', 0.4, { stop: 0.1, flash: 0.35, sound: 'cleared', rumble: 0.5, kick: 0.4 });
      this.split = null;
    }
  }

  /** Something done well: more flow, and a moment to feel it. */
  private well(text: string, gain: number, juice: { stop?: number; flash?: number; sound?: RiverSound; rumble?: number; kick?: number } = {}) {
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
      this.stop = Math.max(this.stop, 0.12);
      this.kick = Math.max(this.kick, 0.7);
      this.controls.rumble(0.6, 0.9, 220);
    }
    if (juice.stop) this.stop = Math.max(this.stop, juice.stop);
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

  /** The first time each thing comes up, a word on how to deal with it. */
  private coach() {
    const k = this.kayak;
    const ask = (h: Hint) => {
      if (this.hinted.has(h)) return;
      this.hinted.add(h);
      this.events.hint?.(h);
    };
    if (Math.abs(k.tilt) > 0.45 && !this.controls.assisted) ask('lean');
    for (const t of this.course.near(k.s + 8, k.s + 40)) {
      if (!('kind' in t)) continue;
      if (t.kind === 'ledge' && t.s > k.s + 10 && t.s < k.s + 35) ask(t.height >= 3 ? 'falls' : 'boof');
      if (t.kind === 'tongue' && t.s > k.s + 12 && this.hinted.has('boof')) ask('tongue');
      if (t.kind === 'rock' && t.s > k.s + 14 && this.tally.time > 10) ask('eddy');
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
      },
      ledge: (how, height) => {
        if (how === 'boof') this.well(height > 2 ? 'BOOF!' : 'Boof!', height > 2 ? 0.7 : 0.5, { stop: 0.09, flash: 0.35, sound: 'boof', rumble: 0.8, kick: 0.6 });
        else if (how === 'tuck') this.well('Tucked it!', 0.8, { stop: 0.12, flash: 0.4, sound: 'boof', rumble: 1, kick: 0.8 });
        else if (how === 'flat') {
          this.shake = 1;
          this.controls.rumble(1, 1, 350);
          this.flash.amount = 0.4;
          this.flash.color.set('#ff5a3c');
          this.broke('Landed flat');
        } else this.broke('Nose first');
      },
      brace: (perfect) => {
        if (perfect) this.well('Perfect brace!', 0.5, { stop: 0.1, flash: 0.25, sound: 'brace', rumble: 0.7, kick: 0.3 });
        else this.well('Brace', 0.2, { sound: 'brace', rumble: 0.4 });
      },
      tipping: () => {
        this.controls.rumble(0.2, 0.8, 120);
        if (!this.hinted.has('brace')) {
          this.hinted.add('brace');
          this.events.hint?.('brace');
        }
      },
      capsize: () => {
        this.events.sound?.('capsize');
        this.wildlife.spray(k.pos, 30, 1.2);
        this.controls.rumble(1, 1, 400);
        if (this.state === 'running') this.tally.flips++;
        this.broke('Upside down', FLIP);
        if (!this.hinted.has('roll')) {
          this.hinted.add('roll');
          this.events.hint?.('roll');
        }
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
        if (stuck && !this.hinted.has('hole')) {
          this.hinted.add('hole');
          this.events.hint?.('hole');
        }
      },
      punched: () => this.well('Punched it!', 0.3, { stop: 0.05, sound: 'whoosh', rumble: 0.5 }),
      // reading the water: out of the current into the slack behind a rock or a bend, and out again
      eddy: () => {
        if (k.s < this.eddyS + 12) return;
        this.eddyS = k.s;
        this.well('Eddy!', 0.3, { sound: 'gate', rumble: 0.35 });
        if (!this.hinted.has('peel')) {
          this.hinted.add('peel');
          this.events.hint?.('peel');
        }
      },
      peel: () => this.well('Peeled out', 0.15, { sound: 'whoosh' }),
      tongue: () => this.well('On the tongue', 0.2, { sound: 'whoosh' }),
      shave: () => this.well('Close!', 0.15, { sound: 'whoosh' }),
      spin: (turns) => this.well(`${turns * 360}!`, 0.6 + turns * 0.2, { stop: 0.08, flash: 0.3, sound: 'boof', rumble: 0.7, kick: 0.3 }),
      stroke: (q, back, side) => {
        this.events.sound?.('stroke', 0.4 + q * 0.6);
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
        if (!through || this.state !== 'running') return;
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
      if (o.kind === 'rock' && nr < MAX_ROCKS) rocks[nr++].set(o.x, o.z, o.r * 0.9, 0);
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

  /** Floating things bob and turn on the current. */
  private bob(dt: number) {
    const k = this.kayak;
    for (const o of this.course.near(k.s - 10, k.s + 80)) {
      if (!('kind' in o) || o.kind !== 'ball') continue;
      const m = this.land.meshOf(o);
      if (!m) continue;
      m.visible = !o.taken;
      m.position.y = this.course.heightAt(o.s) + Math.sin(this.clock * 2.5 + o.s) * 0.05;
      m.rotation.y += dt * 0.8;
    }
  }

  /** Spray off the bow in white water, drips off the paddle, froth trailing off the stern. */
  private effects(dt: number, realDt: number) {
    const k = this.kayak;
    if (this.state === 'ready') return;
    const hx = Math.sin(k.heading);
    const hz = -Math.cos(k.heading);
    const rough = k.rough;
    if (Math.random() < dt * (rough * 30 + k.speed * 0.8)) {
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
    // mist at the foot of a drop
    for (const t of this.course.near(k.s, k.s + 30)) {
      if (!('kind' in t) || t.kind !== 'ledge' || t.s < k.s) continue;
      if (Math.random() < dt * (6 + t.height * 6)) {
        const p = this.course.at(t.s + 3);
        const u = (Math.random() - 0.5) * p.width;
        this.wildlife.spray(new THREE.Vector3(p.x + Math.cos(p.a) * u, p.y + 0.2, p.z + Math.sin(p.a) * u), 1, 0.5 + t.height * 0.2);
      }
    }
    // the pad hums in big water
    if ((this.rumbleAt -= realDt) < 0 && rough > 0.35 && k.balance === 'up') {
      this.rumbleAt = 0.18;
      this.controls.rumble(rough * 0.15, rough * 0.35, 120);
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

  /** Light the river as the island is lit, right now. */
  private light(o: Outside) {
    this.sun.color.copy(o.sun.color);
    this.sun.intensity = o.sun.intensity;
    this.hemi.color.copy(o.hemi.color);
    this.hemi.groundColor.copy(o.hemi.groundColor);
    this.hemi.intensity = o.hemi.intensity;
    // the same sun, but never so low that a pine's shadow reaches across the river
    const dir = o.sun.position.clone().normalize();
    dir.y = Math.max(dir.y, 0.62);
    dir.normalize();
    this.sun.target.position.copy(this.kayak.pos);
    this.sun.position.copy(this.kayak.pos).addScaledVector(dir, 100);
    (this.scene.fog as THREE.Fog).color.copy(o.fog);
    this.scene.background = o.fog;
    const u = this.water.uniforms;
    u.uLight.value.copy(o.hemi.color).lerp(o.sun.color, 0.3).lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(0.3 + Math.min(o.sun.intensity, 2.5) * 0.29);
    u.uNight.value = o.night;
    u.uRain.value = o.rain;
    u.uSunDir.value.copy(dir);
    u.uSky.value.copy(o.hemi.color).lerp(o.fog, 0.5);
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
    // a kick (a boof, a tier) punches the view in a touch as well as down
    const view = this.view * this.zoom * (1 - this.kick * 0.06);
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    const fx = Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    // the kayak sits in the lower part of the screen, so you can see what's coming
    const lead = (view * (0.22 + fast * 0.08)) / Math.sin(ELEVATION);
    const target = new THREE.Vector3(k.pos.x + fx * lead, this.course.heightAt(k.s) - this.kick * 0.6, k.pos.z + fz * lead);
    const rumble = k.balance === 'up' ? k.rough * 0.1 : 0;
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

const BALL = new THREE.Color('#d4dc3c');

function fresh(): Tally {
  return { metres: 0, time: 0, gates: 0, flips: 0, finished: false, bonus: { time: 0, gates: 0, balls: 0 }, balls: 0, flow: 1, bestFlow: 1, score: 0, speed: 0, pace: 1 };
}

/**
 * Where to push off, at or after arc length `from`: always in calm water (a pool, or an easy
 * forest run), with a good stretch of it ahead to get settled before anything happens.
 */
function calm(seed: number, from: number) {
  const probe = new Course(seed);
  for (let s = from; s < from + 3000; s += 5) {
    probe.extend(s + 60);
    const st = probe.stretchAt(s);
    const easy = st.kind === 'pool' || (st.kind === 'run' && !st.fast);
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
