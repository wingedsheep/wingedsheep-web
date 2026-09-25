import * as THREE from 'three';
import { haloTexture } from '../scene/sky';
import { RiverAssets } from './assets';
import { Controls } from './controls';
import { Course, type Stretch } from './course';
import { Kayak } from './kayak';
import { Land } from './land';
import { MAX_HOLES, MAX_ROCKS, MAX_TONGUES, riverWater } from './water';
import { Wildlife } from './wildlife';

const ELEVATION = THREE.MathUtils.degToRad(48);
const DISTANCE = 140;
const FLOW_MAX = 5;

export type State = 'ready' | 'running' | 'over';

export interface Tally {
  metres: number;
  balls: number;
  /** The multiplier: built by doing things well, lost on a knock or a swim. */
  flow: number;
  bestFlow: number;
  score: number;
  speed: number;
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

export type RiverSound = 'stroke' | 'bump' | 'hit' | 'splash' | 'ball' | 'gate' | 'croak' | 'capsize' | 'brace' | 'boof' | 'roll' | 'whoosh' | 'hole' | 'best';
export type Hint = 'paddle' | 'lean' | 'brace' | 'boof' | 'falls' | 'hole' | 'roll' | 'tongue';

export interface GameEvents {
  /** Into a new stretch of river. */
  stretch?(s: Stretch, index: number): void;
  /** Something done well: a word to pop up over the kayak (big: the best kind). */
  praise?(text: string, big: boolean): void;
  /** The flow broke (and why). */
  broke?(why: string): void;
  /** The first time something comes up, how to deal with it. */
  hint?(kind: Hint): void;
  over?(tally: Tally): void;
  /** Someone reached for the controls while the kayak was waiting at the top. */
  start?(): void;
  say?(text: string): void;
  sound?(kind: RiverSound, volume?: number): void;
  bark?(): void;
  baa?(): void;
  quack?(): void;
}

/**
 * The wild-water run: an endless mountain river made up ahead of you, Vincent in his kayak, and
 * a camera looking down the river from behind him. How far you get, times how well: the flow
 * builds with every boof, brace, gate and clean line, and a knock or a swim breaks it. Things
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
  tally: Tally = { metres: 0, balls: 0, flow: 1, bestFlow: 1, score: 0, speed: 0 };
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
  private overIn = 0;
  private clock = 0;
  private stop = 0; // hitstop: seconds of (almost) frozen time
  private hinted = new Set<Hint>();
  private rumbleAt = 0;
  private lastMetres = 0;
  /** Where the kayak goes in: far enough down that there's river behind you too. To try a harder
   * stretch straight away: ?downriver=1500 (metres further on). */
  private start = 50 + (Number(new URLSearchParams(location.search).get('downriver')) || 0);

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
    this.course = new Course(seed);
    this.course.extend(this.start + 400);
    this.land = new Land(this.course, this.assets, this.water.material, this.halo);
    this.land.onSpots = (spots) => this.wildlife.settle(spots);
    this.scene.add(this.land.group);
    this.wildlife.reset(this.course);
    this.wildlife.ground = (x, z) => this.land.heightAt(x, z);
    this.kayak.launch(this.course, this.start);
    this.kayak.assisted = this.controls.assisted;
    this.tally = { metres: 0, balls: 0, flow: 1, bestFlow: 1, score: 0, speed: 0 };
    this.state = 'ready';
    this.paused = false;
    this.stretch = -1;
    this.overIn = 0;
    this.lastMetres = 0;
    this.stop = 0;
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
    return this.kayak.here?.rough ?? 0;
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
    this.course.extend(k.s + 300);
    this.land.update(k.pos, this.reach, k.s - 40, k.s + 100);
    this.land.glow(outside.night, this.clock);
    this.wildlife.update(dt, k.pos, k.s, k.speed, outside.night, outside.rain, outside.snow, outside.fair);
    this.shade(dt);
    this.bob(dt);

    if (running) this.score();
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

  private score() {
    const k = this.kayak;
    const t = this.tally;
    const metres = Math.max(t.metres, Math.floor(k.s - this.start));
    if (metres > this.lastMetres) {
      t.score += (metres - this.lastMetres) * t.flow;
      this.lastMetres = metres;
    }
    t.metres = metres;
    t.speed = k.speed;
    const i = k.here.stretch;
    if (i !== this.stretch) {
      this.stretch = i;
      this.events.stretch?.(this.course.stretches[i], i);
    }
  }

  /** Something done well: more flow, and a moment to feel it. */
  private well(text: string, gain: number, juice: { stop?: number; flash?: number; sound?: RiverSound; rumble?: number; kick?: number } = {}) {
    if (this.state !== 'running') return;
    const t = this.tally;
    t.flow = Math.min(FLOW_MAX, Math.round((t.flow + gain) * 100) / 100);
    t.bestFlow = Math.max(t.bestFlow, t.flow);
    this.events.praise?.(text, gain >= 0.5);
    if (juice.stop) this.stop = Math.max(this.stop, juice.stop);
    if (juice.flash) {
      this.flash.amount = juice.flash;
      this.flash.color.set('#fff6d8');
    }
    if (juice.sound) this.events.sound?.(juice.sound);
    if (juice.rumble) this.controls.rumble(juice.rumble, juice.rumble * 0.7, 140);
    if (juice.kick) this.kick = juice.kick;
  }

  /** Something gone wrong: the flow's gone. */
  private broke(why: string) {
    if (this.state !== 'running') return;
    if (this.tally.flow > 1.2) this.events.broke?.(why);
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
    }
  }

  private wire() {
    const k = this.kayak;
    k.events = {
      hit: (strength, at) => {
        this.shake = Math.min(1, strength / 4);
        this.wildlife.spray(at, 18, 1);
        this.events.sound?.('hit', Math.min(1, strength / 4));
        this.controls.rumble(0.9, 0.6, 260);
        this.flash.amount = 0.35;
        this.flash.color.set('#ff5a3c');
        this.broke('Knocked');
      },
      bump: (strength, at) => {
        if (strength < 0.6) return;
        this.wildlife.spray(at, 5, 0.6);
        this.events.sound?.('bump', Math.min(1, strength / 3));
        this.controls.rumble(0.25, 0.2, 80);
      },
      splash: (size, at) => {
        if (size < 2) return;
        this.shake = Math.max(this.shake, Math.min(1, size / 10));
        this.wildlife.spray(at, Math.min(50, size * 5), Math.min(1.8, size / 5));
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
        this.broke('Upside down');
        if (!this.hinted.has('roll')) {
          this.hinted.add('roll');
          this.events.hint?.('roll');
        }
      },
      rolled: () => {
        this.events.sound?.('roll');
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
      tongue: () => this.well('On the tongue', 0.2, { sound: 'whoosh' }),
      shave: () => this.well('Close!', 0.15, { sound: 'whoosh' }),
      spin: (turns) => this.well(`${turns * 360}!`, 0.6 + turns * 0.2, { stop: 0.08, flash: 0.3, sound: 'boof', rumble: 0.7, kick: 0.3 }),
      stroke: (q, back) => {
        this.events.sound?.('stroke', 0.4 + q * 0.6);
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
      },
      gate: (_, through) => {
        if (through) this.well('Clean gate', 0.25, { sound: 'gate', rumble: 0.3 });
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
    const rough = k.here.rough;
    if (Math.random() < dt * (rough * 30 + k.speed * 0.8)) {
      const bow = k.pos.clone().add(new THREE.Vector3(hx * 1.8, 0.1, hz * 1.8));
      this.wildlife.spray(bow, 1 + Math.floor(rough * 3 + k.speed / 6), 0.4 + rough * 0.5);
    }
    // a wake that gets longer the faster you go
    if (Math.random() < dt * (6 + k.speed * 2)) {
      this.wildlife.froth(k.pos.clone().add(new THREE.Vector3(-hx * 2.1 + (Math.random() - 0.5) * 0.5, 0, -hz * 2.1)));
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
  }

  /**
   * Follow the kayak from behind and above, looking down the river: further ahead and pulled
   * back a little the faster you go, shaking in big water and on a knock, and kicking down a
   * touch on a boof.
   */
  private frame(dt: number) {
    const k = this.kayak;
    const ahead = this.course.at(k.s + 12);
    this.yaw += (ahead.a - this.yaw) * (dt ? 1 - Math.exp(-dt * 1.2) : 1);
    const fast = THREE.MathUtils.clamp((k.speed - 4) / 8, 0, 1);
    this.zoom += (1 + fast * 0.22 - this.zoom) * (dt ? 1 - Math.exp(-dt * 1.5) : 1);
    const view = this.view * this.zoom;
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    const fx = Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    // the kayak sits in the lower part of the screen, so you can see what's coming
    const lead = (view * (0.2 + fast * 0.06)) / Math.sin(ELEVATION);
    const target = new THREE.Vector3(k.pos.x + fx * lead, this.course.heightAt(k.s) - this.kick * 0.6, k.pos.z + fz * lead);
    const rumble = k.balance === 'up' ? (k.here?.rough ?? 0) * 0.1 : 0;
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
