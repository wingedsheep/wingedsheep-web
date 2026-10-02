import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOOKS } from '../../data/books';
import { hash } from '../../data/subjects';
import { faceRoom, toonIndoors } from './interior';
import { Particles } from './particles';
import { Picker } from './picking';
import { drawProgramme } from './programmes';
import { RoomCamera } from './room-camera';
import { telly } from './companion';
import { Guests } from './guests';
import { ambush, coffee, indoors } from './shelter';
import { haloTexture } from './sky';
import { GRADIENT } from './toon';
import { type Outside, Windows } from './windows';
import { wardrobe } from './wardrobe';

/** One cat's trip to the bowls: hop down, walk over, eat for a while, walk back, hop up. */
interface Diner {
  state: 'idle' | 'down' | 'go' | 'eat' | 'back' | 'up' | 'stalk' | 'sit' | 'mew' | 'jump' | 'perch' | 'drop' | 'dash' | 'spring' | 'lap' | 'hop';
  /** What it does after hopping down from the sofa: off to the bowl, (Charlie) round to Vincent's chair, or a run for the tap. */
  then: 'go' | 'stalk' | 'dash';
  /** Off the sofa in a hurry (the tap's on): no stretch. */
  hurry: boolean;
  /** At the tap (drink()): where it stands on the counter, the floor below it, and how far it's into drinking (1) or sitting waiting its turn (-1). */
  spot: THREE.Vector3;
  foot: THREE.Vector3;
  sip: number;
  route: THREE.Vector3[];
  leg: number;
  hop: THREE.Vector3;
  land: THREE.Vector3;
  t: number;
  wait: number;
  dur: number;
  heading: number;
  stride: number;
  from: THREE.Vector3;
  start: THREE.Vector3;
  goal: THREE.Vector3;
  pos: THREE.Vector3;
  legs: THREE.Object3D[];
  head?: THREE.Object3D;
  tail?: THREE.Object3D;
  body?: THREE.Object3D;
  bodyY: number;
  burst: number;
  rest: Map<THREE.Object3D, THREE.Euler>;
}
/** Where each stands to eat (the bowls are at x = 1.1 and 1.5, z = -3.1, against the north wall; they stand a little apart so they don't overlap), and how fast it walks. */
const BOWLS: Record<string, { x: number; z: number }> = { charlie: { x: 1.03, z: -2.68 }, george: { x: 1.58, z: -2.58 } };
const TROT = 0.9;
/** How fast they run when they hear the tap, and how long it runs (sound.ts makes it as long). */
const DASH = 2.2;
const TAP_RUNS = 14;
/** From where a cat sleeps on the sofa (it faces the telly, west): the top of its back, and the floor behind it, which is the way they go. */
const RIDGE = new THREE.Vector3(0.4, 0.26, 0);
const BEHIND = 0.85;

const SKY_DAY = new THREE.Color('#a9dcff');
const SKY_NIGHT = new THREE.Color('#1c2852');
const GOLD = new THREE.Color('#e8b24a');
/** Cloth and paper colours for the spines: muted, like a real shelf, not a paint chart. */
const SPINES = ['#7a2c3a', '#2f5d8c', '#3d6a4a', '#b5562d', '#4a3b5a', '#c9a23f', '#2e4a4a', '#8c5a3a', '#5a2a3a', '#e6d4b8', '#23384f', '#6b7a3a'];

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** Seconds a sip takes, and the beats of making a coffee at the machine (coffee()). */
const SIP = 6;
const BREW = { down: [3, 6.5], hands: [6.5, 8], press: [8, 10.6], grind: 9, on: [12.5, 24.5], full: 19, up: [24, 25.5], back: [25.5, 28.5], end: 30 } as const;
/** 0 before `a`, 1 after `b`, smooth in between. */
const ease = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

interface Row {
  index: number; // 0 = the top shelf
  origin: THREE.Vector3; // front-left corner of the shelf board, world space
  width: number;
  depth: number;
  clear: number;
}

interface Spine {
  group: THREE.Group;
  home: THREE.Vector3;
  cover: THREE.MeshToonMaterial;
  color: THREE.Color;
  out: number;
}

type Ambush = 'wait' | 'walk' | 'sit' | 'mew' | 'up' | 'on' | 'down';

interface Lamp {
  light: THREE.PointLight;
  halo?: THREE.Sprite;
  base: number;
  flicker: number;
  seed: number;
}

/**
 * The lighthouse, inside (tools/models/quarters.py): the keeper's quarters. A stair winding up
 * to the lamp, a telly with a console that plays Vincent's own game, his favourite games on a
 * shelf above it, a kitchen with the coffee on, and a bookcase holding everything he's read
 * (src/data/reading.json, from his Goodreads shelf), newest at the top.
 */
export class QuartersRoom {
  readonly scene = new THREE.Scene();
  readonly picker: Picker;
  /** Things with an id, for highlighting. */
  readonly named = new Map<string, THREE.Object3D>();

  private bounds = new THREE.Box3();
  /** Frames the room; you can zoom and look around it. */
  readonly view = new RoomCamera(this.bounds);
  private spines = new Map<string, Spine>();
  private hot: string | null = null;
  private lamps: Lamp[] = [];
  private glass = new THREE.MeshBasicMaterial({ color: SKY_DAY.clone() });
  private hemi = new THREE.HemisphereLight('#d6d0e6', '#4a3226', 1.25);
  private key = new THREE.DirectionalLight('#ffe9cc', 1);
  private particles = new Particles(300);
  private steam: THREE.Vector3[] = [];
  /** The mug of coffee (coffee()): where it stands on the kitchen table, and how far it's moved to Vincent's desk. */
  private mug?: {
    obj: THREE.Object3D; base: THREE.Vector3; at: THREE.Vector3; black?: THREE.Object3D;
    seated?: THREE.Object3D; stand?: Record<'body' | 'll' | 'lr' | 'al' | 'ar' | 'head', THREE.Object3D | undefined>;
    machine: THREE.Vector3; cup: THREE.Vector3; head: THREE.Vector3; shell?: THREE.Object3D;
  };
  private mugMoved = new THREE.Vector3();
  private mugTurn = new THREE.Quaternion();
  /** How far through a sip he is, or -1 (so the typing stops while he drinks). */
  private sipK = -1;
  /** Vincent's coffee run (coffee()): sips while he types, then up for a refill, and back. */
  private run = { phase: 'sit' as 'sit' | 'go' | 'brew' | 'back', t: 0, along: 0, yaw: Math.PI, step: 0 };
  private screen?: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; next: number; mesh: THREE.Mesh };
  /** A film's on (lighthouse.ts lays the player over the screen): the screen behind it goes dark. */
  film = false;
  private clock = 0;
  /** Whether Vincent's at his desk and typing right now (the lighthouse plays the keys). */
  typing = false;
  /** Who's in out of the rain (shelter.ts): each shown only while they're indoors. */
  readonly guests: Guests;
  /** Rain on the glass and lightning in the panes. */
  private windows: Windows;
  private timers = new Map<string, number>();
  /** Her on the sofa, and Charlie's cushion (watcher()), looked up once. */
  private sofa?: Record<'her' | 'snack' | 'head' | 'bowl' | 'lap' | 'charlie', THREE.Object3D | undefined> & { home?: THREE.Vector3 };
  private desk?: Record<'him' | 'left' | 'right' | 'head' | 'hero', THREE.Object3D | undefined>;
  /** Charlie's ambush (pounce()): what he's up to, how long he's been at it, and how long it lasts. */
  private stalk = { phase: 'wait' as Ambush, t: 0, next: rand(20, 45), stay: 0, flinch: 0 };
  /** Seconds left of the tap running (tap()); where the water comes out and lands, where each cat stands on the counter, and whose turn it is at the stream. */
  private drinking = 0;
  private sink?: { spout: THREE.Vector3; basin: number; spots: Record<string, THREE.Vector3> };
  private queue = { who: '', t: 0, lap: 0 };
  /** Charlie gives his one small warning (lighthouse.ts makes the sound). */
  onMew?: () => void;
  /** Vincent takes a sip of his coffee (lighthouse.ts makes the sound). */
  onSip?: () => void;
  private sipHeard = false;
  /** Charlie and George, off the sofa for a bite from the bowls now and then (dine()). */
  private diners = new Map<string, Diner>();
  /** A cat at its bowl starts on a run of bites (lighthouse.ts makes the crunching). */
  onCrunch?: () => void;
  /** A cat at the stream laps away (lighthouse.ts makes the sound). */
  onLap?: () => void;
  /** The machine grinds and then brews (lighthouse.ts makes the sounds). */
  onMachine?: (what: 'grind' | 'brew') => void;
  private machineHeard = { grind: false, brew: false };

  static async load(base = '/models/'): Promise<QuartersRoom> {
    const gltf = await new GLTFLoader().loadAsync(`${base}lighthouse.glb?v=${__MODELS__}`);
    return new QuartersRoom(gltf.scene);
  }

  private constructor(root: THREE.Group) {
    this.scene.add(root);
    this.scene.background = new THREE.Color('#15111c');
    root.updateMatrixWorld(true);

    const rows: Row[] = [];
    const halo = haloTexture();
    const guests: THREE.Object3D[] = [];
    const panes: THREE.Mesh[] = [];
    let screen: THREE.Mesh | undefined;
    root.traverse((o) => {
      const x = o.userData;
      if (x.id) this.named.set(x.id, o);
      if (x.wear && !(o as THREE.Mesh).isMesh) wardrobe.adopt(o, true);
      if (x.shelf !== undefined) {
        rows.push({ index: x.shelf, origin: o.getWorldPosition(V()), width: x.width, depth: x.depth, clear: x.clear });
      }
      if (x.guests) guests.push(...o.children);
      if (x.emit === 'steam') this.steam.push(o.getWorldPosition(V()));
      if (x.light) this.addLamp(o.getWorldPosition(V()), x, halo);
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glass = o.name.startsWith('window_glass') || o.parent?.name.startsWith('window_glass');
        if (o.name.startsWith('tv_screen') || o.parent?.name.startsWith('tv_screen')) screen = mesh;
        const glow = src.name.startsWith('glow_');
        if (glass) panes.push(mesh);
        mesh.material = wardrobe.adopt(o, true) ?? (glass ? this.glass : toonIndoors(src.color, glow));
        mesh.castShadow = !glass && !glow;
        mesh.receiveShadow = true;
      }
    });
    const room = root.getObjectByName('room');
    if (room) this.bounds.setFromObject(room);
    this.guests = new Guests(this.scene, guests);
    for (const a of this.guests.animals) this.named.set(a.userData.id, a);
    this.windows = new Windows(this.scene, panes, this.glass, this.bounds);
    if (screen) this.tv(screen);

    this.key.position.set(9, 16, 11);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.key, this.key.target, this.particles.points);

    this.shelve(root, rows);
    this.picker = new Picker(this.camera);
    this.picker.add(...this.named.values(), ...[...this.spines.values()].map((s) => s.group));
  }

  get camera() {
    return this.view.camera;
  }

  frame(width: number, height: number, free: { x: number; y: number; w: number; h: number }) {
    this.view.frame(width, height, free);
  }

  /** The book being pointed at slides out and catches the light ("read:<index>", or null). */
  setHot(id: string | null) {
    this.hot = id;
  }

  /** `out` is the weather outside (weather.ts `now`): rain on the windows, lightning, a greyer day. */
  update(dt: number, night: number, out?: Outside) {
    this.clock += dt;
    this.guests.update(dt);
    const t = this.clock;
    for (const l of this.lamps) {
      const f = l.flicker ? 1 - l.flicker * 0.25 * (Math.sin(t * 13 + l.seed) * 0.5 + Math.sin(t * 7.7 + l.seed * 3) * 0.5 + 0.5) : 1;
      l.light.intensity = l.base * (0.75 + night * 0.25) * f;
      if (l.halo) (l.halo.material as THREE.SpriteMaterial).opacity = (0.35 + night * 0.35) * f;
    }
    const day = 1 - night;
    this.glass.color.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    this.hemi.intensity = 0.9 + day * 0.5;
    this.key.intensity = 0.35 + day * 0.75;
    if (out) {
      this.windows.tint(this.glass.color, out);
      this.key.intensity *= 1 - out.cloud * 0.35; // a dull day comes in through the windows…
      this.key.intensity += out.flash * 2.5; // …and lightning lights up the whole room for a moment
      this.hemi.intensity += out.flash * 1.2;
    }
    this.key.color.set(day > 0.5 ? '#ffe9cc' : '#aab8ff');

    // the coffee steams while it's still hot, which is to say during the day
    for (const [i, at] of this.steam.entries()) {
      const hot = coffee.at === 'full' || (coffee.at === 'table' && day > 0.3); // at his desk it's never cold: he's quick
      if (hot && this.every(`steam${i}`, 0.35, dt)) {
        this.particles.emit({
          position: at.clone().applyQuaternion(this.mugTurn).add(this.mugMoved).add(V(rand(-0.03, 0.03), 0, rand(-0.03, 0.03))),
          velocity: V(rand(-0.03, 0.03), rand(0.18, 0.3), rand(-0.03, 0.03)),
          color: '#f4efe6', life: rand(1.6, 2.4), wobble: 0.12, size: 1,
        });
      }
    }
    this.drawScreen();
    this.watcher(t);
    this.pounce(dt);
    this.drink(dt);
    this.dine(dt);
    this.coder(t);
    this.coffee(dt);

    for (const [id, s] of this.spines) {
      s.out = THREE.MathUtils.damp(s.out, id === this.hot ? 1 : 0, 12, dt);
      s.group.position.set(s.home.x, s.home.y + s.out * 0.02, s.home.z + s.out * 0.16);
      s.cover.emissive.copy(s.color).multiplyScalar(id === this.hot ? 0.45 : 0);
    }
    this.particles.update(dt);
    if (out) this.windows.update(dt, out);
  }

  /**
   * Her on the sofa, if she's in (companion.ts): a handful of popcorn now and then, and a laugh.
   * If the cats are in out of the rain too, Charlie has her lap instead of the popcorn, and she
   * strokes him.
   */
  private watcher(t: number) {
    const w = (this.sofa ??= {
      her: this.scene.getObjectByName('companion_lighthouse'),
      snack: this.scene.getObjectByName('companion_snack'),
      head: this.scene.getObjectByName('companion_tv_head'),
      bowl: this.scene.getObjectByName('companion_bowl'),
      lap: this.scene.getObjectByName('companion_lap'),
      charlie: this.scene.getObjectByName('charlie'),
    });
    const { her, snack, head, bowl, lap, charlie } = w;
    const cat = !!(her?.visible && charlie?.visible && lap);
    if (charlie) {
      w.home ??= charlie.position.clone();
      if (cat) charlie.position.copy(charlie.parent!.worldToLocal(lap!.getWorldPosition(new THREE.Vector3())));
      else charlie.position.copy(w.home);
    }
    if (!her?.visible) return;
    if (bowl) bowl.visible = !cat;
    let eat = 0;
    if (cat) {
      snack?.rotation.set(-0.35 + Math.sin(t * 1.8) * 0.12, 0, 0.25); // slow strokes, head to tail
    } else {
      const k = t % 5.5;
      eat = k < 1.6 ? Math.sin((k / 1.6) * Math.PI) : 0; // up to her mouth and back to the bowl
      snack?.rotation.set(-eat * 1.4, 0, eat * 0.5);
    }
    const laugh = t % 17 < 1.4 ? Math.abs(Math.sin(t * 9)) * 0.1 : 0;
    // with the cat, she looks down at him every so often
    const fond = cat && t % 11 < 3 ? 0.25 : 0;
    head?.rotation.set(-laugh - eat * 0.08 + fond, Math.sin(t * 0.21) * 0.08, 0);
  }

  /**
   * The mug of coffee: on the kitchen table, unless Vincent's at his desk. There it's beside the
   * mouse, and he drinks it down in three quick sips (the steam goes with it), gets up with the
   * empty mug, walks round the table to the machine, and comes back with a full one.
   */
  private coffee(dt: number) {
    const obj = this.named.get('coffee');
    const desk = this.named.get('desk');
    if (!obj || !desk) return;
    if (!this.mug) {
      const box = new THREE.Box3().setFromObject(obj);
      const base = box.getCenter(V()).setY(box.min.y);
      const at = desk.getWorldPosition(V()).add(V(0.62, 0.74, 0.2)); // the desk's top, east of the mouse
      const part = (n: string) => this.scene.getObjectByName(n);
      const shell = this.named.get('coffee_machine');
      const mbox = new THREE.Box3().setFromObject(shell ?? obj);
      const machine = mbox.getCenter(V());
      const cup = V(machine.x, mbox.min.y + 0.11, mbox.max.z - 0.25); // on the drip tray, under the group head
      const head = V(machine.x, mbox.min.y + 0.45, mbox.max.z - 0.3);
      this.mug = {
        obj, base, at, machine, cup, head, shell, black: part('coffee_black'), seated: part('vincent_at_desk'),
        stand: { body: part('vincent_fetching'), ll: part('fetch_leg_l'), lr: part('fetch_leg_r'), al: part('fetch_arm_l'), ar: part('fetch_arm_r'), head: part('fetch_head') },
      };
    }
    const { base, at, black, seated, stand } = this.mug;
    const him = this.scene.getObjectByName('vincent_coding');
    const run = this.run;
    const show = (up: boolean) => {
      if (seated) seated.visible = !up;
      if (stand?.body) stand.body.visible = up;
    };
    if (!him?.visible) {
      Object.assign(run, { phase: 'sit', t: 0, along: 0, yaw: Math.PI });
      coffee.at = 'table';
      coffee.trip = 'desk';
      coffee.sip = false;
      this.machineHeard.grind = this.machineHeard.brew = false;
      show(false);
      if (black) { black.visible = true; black.position.y = 0; }
      this.sipK = -1;
      this.mugMoved.set(0, 0, 0);
      this.mugTurn.identity();
      obj.position.set(0, 0, 0);
      obj.quaternion.identity();
      return;
    }

    // the way to the machine: from the chair east along the south, north past the easel's west leg,
    // over to the counter side of the table's far chair, and up to the machine
    const { machine } = this.mug;
    const chair = seated!.getWorldPosition(V()).setY(0);
    const front = machine.z + 0.75;
    const route = [chair, chair.clone().setX(3.1), V(3.1, 0, 0.9), V(3.55, 0, 0.9), V(3.55, 0, front), V(machine.x, 0, front)];
    const lengths = route.slice(1).map((p, i) => p.distanceTo(route[i]));
    const total = lengths.reduce((x, y) => x + y, 0);
    const at1 = (d: number) => {
      for (const [i, len] of lengths.entries()) {
        if (d <= len || i === lengths.length - 1) {
          const k = Math.min(1, d / len);
          return { pos: route[i].clone().lerp(route[i + 1], k), dir: route[i + 1].clone().sub(route[i]).normalize() };
        }
        d -= len;
      }
      return { pos: route[0].clone(), dir: V(0, 0, 1) };
    };

    run.t += dt;
    let sip = -1; // how far through a sip he is, 0..1, or -1
    let full = true;
    let holding = false;
    let walking = false;
    switch (run.phase) {
      case 'sit':
        for (const from of [15, 40, 65]) if (run.t >= from && run.t < from + SIP) sip = (run.t - from) / SIP;
        full = run.t < 65 + SIP * 0.55; // the last sip empties it
        coffee.at = full ? 'full' : 'empty';
        if (run.t > 90 && this.stalk.phase === 'wait') Object.assign(run, { phase: 'go', t: 0, along: 0, step: 0 });
        break;
      case 'go':
      case 'back': {
        const going = run.phase === 'go';
        holding = true;
        walking = true;
        full = !going;
        coffee.at = going ? 'empty' : 'full';
        run.along += (going ? 1 : -1) * 0.85 * dt;
        run.step += dt * 4.6;
        if (going && run.along >= total) Object.assign(run, { phase: 'brew', t: 0, along: total });
        else if (!going && run.along <= 0) Object.assign(run, { phase: 'sit', t: 0, along: 0 });
        break;
      }
      case 'brew':
        holding = true;
        full = run.t > BREW.full;
        coffee.at = full ? 'full' : 'empty';
        if (run.t > BREW.end) Object.assign(run, { phase: 'back', t: 0, along: total });
        break;
    }
    this.sipK = sip;
    coffee.trip = run.phase === 'sit' ? 'desk' : run.phase;
    coffee.sip = sip >= 0;
    if (sip >= 0.42 && !this.sipHeard) this.onSip?.(); // as the mug tips
    this.sipHeard = sip >= 0.42;
    // how full the mug is: down a third with each sip, and filling as the machine runs
    const fill = run.phase === 'sit' ? 1 - [15, 40, 65].reduce((n, from) => n + ease(0.3, 0.6, (run.t - from) / SIP) / 3, 0)
      : run.phase === 'go' ? 0
      : run.phase === 'brew' ? ease(BREW.on[0] + 0.5, BREW.full, run.t)
      : 1;
    const on = run.phase !== 'sit';
    show(on);
    if (black) {
      black.visible = fill > 0.03;
      black.position.y = -(1 - fill) * 0.125; // the surface sinks towards the floor of the mug
    }
    if (on && stand?.body) {
      const { pos, dir } = at1(run.along);
      const heading = run.phase === 'brew' ? V(0, 0, -1) : run.phase === 'back' ? dir.clone().negate() : dir;
      let turn = Math.atan2(heading.x, heading.z) - run.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      run.yaw += turn * Math.min(1, dt * 8);
      stand.body.position.copy(him.worldToLocal(pos.clone()));
      stand.body.rotation.y = run.yaw;
      const swing = walking ? Math.sin(run.step) * 0.5 : 0;
      let raise = holding ? -1.1 : swing * 0.8; // the mug arm is out in front of him
      let press = 0;
      let placed = 0;
      const hand = V(-0.34, 1.0, 0.55).applyAxisAngle(V(0, 1, 0), run.yaw).add(pos);
      if (run.phase === 'brew') {
        const t = run.t;
        placed = ease(BREW.down[0], BREW.down[1], t) * (1 - ease(BREW.back[0], BREW.back[1], t));
        const free = ease(BREW.hands[0], BREW.hands[1], t) * (1 - ease(BREW.up[0], BREW.up[1], t));
        raise = (-1.1 - 0.25 * placed) * (1 - free) + 0.1 * free; // reaching down to the tray, then hanging while it runs
        press = ease(BREW.press[0], BREW.press[0] + 0.8, t) * (1 - ease(BREW.press[1] - 0.8, BREW.press[1], t));
        hand.lerp(this.mug.cup, placed);
        this.brewing(t, this.mug, dt);
      } else {
        this.mug.shell?.position.set(0, 0, 0);
        this.machineHeard.grind = this.machineHeard.brew = false;
      }
      if (stand.ll) stand.ll.rotation.x = swing;
      if (stand.lr) stand.lr.rotation.x = -swing;
      if (stand.al) stand.al.rotation.x = press > 0 ? -1.2 * press : -swing * 0.8; // the left hand presses the button
      if (stand.ar) stand.ar.rotation.x = raise;
      if (stand.head) stand.head.rotation.x = run.phase === 'brew' ? 0.22 * ease(2, 4, run.t) : 0; // eyes on the cup
      this.mugMoved.copy(hand.sub(base));
      this.mugTurn.identity();
    } else {
      this.sipping(sip, at, base);
    }
    obj.quaternion.copy(this.mugTurn);
    // (a turned mug turns about its base, so the position makes up for where the origin is)
    obj.position.copy(this.mugMoved).sub(base.clone().applyQuaternion(this.mugTurn).sub(base));
  }

  /**
   * At the machine, `t` seconds in: it shudders and steams while it runs, and the coffee runs down
   * into the mug on the drip tray (the mug is his to set down and take back; coffee()).
   */
  private brewing(t: number, m: NonNullable<typeof this.mug>, dt: number) {
    const on = t > BREW.on[0] && t < BREW.on[1];
    const shake = on || (t > BREW.grind && t < BREW.on[0]); // it shudders while it grinds, too
    m.shell?.position.set(shake ? rand(-0.004, 0.004) : 0, 0, shake ? rand(-0.004, 0.004) : 0);
    for (const [what, at] of [['grind', BREW.grind], ['brew', BREW.on[0]]] as const) {
      if (t >= at && !this.machineHeard[what]) {
        this.machineHeard[what] = true;
        this.onMachine?.(what);
      }
    }
    if (on && this.every('brewsteam', 0.3, dt)) {
      this.particles.emit({
        position: m.head.clone().add(V(rand(-0.05, 0.05), 0, rand(-0.03, 0.03))),
        velocity: V(rand(-0.04, 0.04), rand(0.2, 0.32), rand(-0.05, 0)),
        color: '#f4efe6', life: rand(1.4, 2), wobble: 0.14, size: 1,
      });
    }
    if (t > BREW.on[0] + 1 && t < BREW.full + 2) {
      this.particles.emit({ // the coffee itself, a thin dark thread from the group head
        position: m.cup.clone().add(V(rand(-0.01, 0.01), 0.22, rand(-0.01, 0.01))),
        velocity: V(0, -0.5, 0), color: '#3a2314', life: 0.35, wobble: 0, size: 1,
      });
    }
  }

  /**
   * One sip, `k` through it (0..1; -1 for none): his right arm reaches for the mug beside the
   * mouse, brings it up to his mouth, tips it, and puts it back where it was. `mugMoved` (where the
   * mug's base is, less where it started) and `mugTurn` (its tilt) say where the mug is.
   */
  private sipping(k: number, at: THREE.Vector3, base: THREE.Vector3) {
    const lift = k < 0 ? 0 : ease(0.15, 0.4, k) * (1 - ease(0.7, 0.9, k));
    const tip = k >= 0.4 && k <= 0.7 ? Math.sin(((k - 0.4) / 0.3) * Math.PI) * 1.0 : 0;
    const head = this.scene.getObjectByName('code_head');
    const mouth = (head?.getWorldPosition(V()) ?? at.clone()).add(V(0.02, -0.26, -0.32)); // rim height, in front of his face
    this.mugTurn.setFromAxisAngle(V(1, 0, 0), tip);
    this.mugMoved.copy(at).lerp(mouth, lift).sub(base);
    // the hand goes to the mug: the forearm points from the shoulder at the mug's side
    const arm = this.scene.getObjectByName('type_r');
    if (!arm?.parent || k < 0) return;
    const rest = (arm.userData.rest ??= arm.rotation.clone()) as THREE.Euler;
    const weight = ease(0, 0.15, k) * (1 - ease(0.85, 1, k));
    const parentQ = arm.parent.getWorldQuaternion(new THREE.Quaternion());
    const restQ = parentQ.clone().multiply(new THREE.Quaternion().setFromEuler(rest));
    const shoulder = arm.getWorldPosition(V());
    const grip = base.clone().add(this.mugMoved).add(V(0.09, 0.1, 0)); // the mug's side, the near one
    const forearm = V(0.1, -0.13, 0.4).normalize().applyQuaternion(restQ);
    const aim = new THREE.Quaternion().setFromUnitVectors(forearm, grip.sub(shoulder).normalize()).multiply(restQ);
    arm.quaternion.copy(parentQ.clone().invert().multiply(restQ.clone().slerp(aim, weight)));
    // once he has hold of it the mug rides in his hand (the wrist end of the forearm), so it can't float
    arm.updateWorldMatrix(true, false);
    const hand = arm.localToWorld(V(0.12, -0.15, 0.46)); // Blender (0.12, -0.46, -0.15), from vincent_coding
    const held = hand.sub(V(0.09, 0.1, 0));
    this.mugMoved.lerp(held.sub(base), Math.min(1, lift * 4));
    const lean = (this.scene.getObjectByName('code_head'));
    if (lean) lean.rotation.x -= tip * 0.3; // head back for the last of it
  }

  /**
   * Vincent at his desk, if he's in (vincent.ts): typing in bursts, a look at the game now and
   * then, and on the screen his little hero running along the grass and hopping up onto a
   * platform and back, over and over, the way you test a jump.
   */
  private coder(t: number) {
    const at = (this.desk ??= {
      him: this.scene.getObjectByName('vincent_coding'),
      left: this.scene.getObjectByName('type_l'),
      right: this.scene.getObjectByName('type_r'),
      head: this.scene.getObjectByName('code_head'),
      hero: this.scene.getObjectByName('desk_hero'),
    });
    const { him, left, right, head, hero } = at;
    this.typing = false;
    if (!him?.visible) return;
    const flinch = this.stalk.flinch;
    const burst = this.run.phase === 'sit' && this.sipK < 0 && Math.sin(t * 0.6) > -0.3 && flinch < 0.2; // typing, then a pause to think
    this.typing = burst;
    for (const [arm, k] of [[left, 0], [right, 1.7]] as const) {
      if (!arm) continue;
      const rest = (arm.userData.rest ??= arm.rotation.clone()) as THREE.Euler;
      arm.rotation.set(rest.x + (burst ? Math.max(0, Math.sin(t * 17 + k)) * 0.08 : 0), rest.y, rest.z);
    }
    if (head) {
      const rest = (head.userData.rest ??= head.rotation.clone()) as THREE.Euler;
      head.rotation.set(rest.x + (burst ? 0.08 : 0) - flinch * 0.35, rest.y + (burst ? 0 : Math.sin(t * 0.8) * 0.15), rest.z);
    }
    if (hero) {
      const home = (hero.userData.home ??= hero.position.clone()) as THREE.Vector3;
      const k = (t % 4) / 4; // run right, jump, run back
      const x = k < 0.5 ? k * 2 : 2 - k * 2;
      const hop = Math.max(0, Math.sin(((k - 0.35) / 0.3) * Math.PI)) * (k > 0.35 && k < 0.65 ? 1 : 0);
      hero.position.set(home.x + x * 0.3, home.y + hop * 0.1, home.z);
    }
  }

  /**
   * Charlie's ambush, when Vincent's at his desk and she isn't on the sofa: he hops down, walks
   * round to Vincent's chair and sits beside it, gives one short mew, and jumps up onto his
   * shoulders, legs spread and every claw out. Vincent jerks upright, then types on, very
   * carefully, until Charlie's had enough: he jumps down and trots off to his bowl (dine() does
   * the cat, this only decides when).
   */
  private pounce(dt: number) {
    const a = this.stalk;
    a.flinch = Math.max(0, a.flinch - dt / 1.2);
    const d = this.diners.get('charlie');
    const him = this.scene.getObjectByName('vincent_coding');
    const seated = this.run.phase === 'sit' && !!him?.visible;
    if (!d) return;
    if (a.phase !== 'wait') {
      if (!seated || !indoors.has('charlie')) { // he's gone, or so has Charlie: it's off
        Object.assign(a, { phase: 'wait', next: rand(20, 45) });
        Object.assign(d, { state: 'idle', wait: rand(30, 60) });
        ambush.on = false;
      }
      return;
    }
    ambush.on = false;
    if (!seated || d.state !== 'idle' || !indoors.has('charlie') || indoors.has('companion_lighthouse') || this.drinking > 0) return;
    if ((a.next -= dt) > 0) return;
    const sleeper = this.scene.getObjectByName('charlie');
    const chair = this.mug?.seated?.getWorldPosition(V());
    if (!sleeper || !chair) return;
    sleeper.getWorldPosition(d.from);
    d.start.copy(d.from).setY(0).add(V(BEHIND, 0, 0));
    // round the east end of the desk: along, down to the chair's row, and in beside it
    d.route = [V(1.05, 0, d.start.z), V(1.05, 0, chair.z + 0.05), V(chair.x + 0.7, 0, chair.z + 0.05)];
    d.land = V(1.0, 0, chair.z + 0.15);
    Object.assign(d, { state: 'down', then: 'stalk', hurry: false, leg: 0, t: 0 });
    a.phase = 'walk';
  }

  /**
   * Whichever of Charlie and George is in: every so often it hops off the sofa, walks over to its
   * bowl by the bookcase, has a good long eat (head down, the odd lift to chew), and walks back.
   * Charlie stays put while he's ambushing Vincent or sitting on her lap, and the tap comes first.
   */
  private dine(dt: number) {
    for (const [id, bowl] of Object.entries(BOWLS)) {
      const sleeper = this.scene.getObjectByName(id);
      const walker = this.scene.getObjectByName(`${id}_eat`);
      if (!sleeper || !walker?.parent) continue;
      let d = this.diners.get(id);
      if (!d) {
        const part = (n: string) => this.scene.getObjectByName(`${id}_walk_${n}`);
        const legs = ['fl', 'fr', 'bl', 'br'].map((n) => part(`leg_${n}`)).filter((o): o is THREE.Object3D => !!o);
        const rest = new Map<THREE.Object3D, THREE.Euler>();
        for (const o of [...legs, part('head'), part('tail')]) if (o) rest.set(o, o.rotation.clone());
        d = {
          state: 'idle', then: 'go', hurry: false, spot: V(), foot: V(), sip: 0, route: [], leg: 0, hop: V(), land: V(), t: 0, wait: rand(15, 40), dur: 0, heading: Math.PI / 2, stride: 0,
          from: V(), start: V(), goal: V(bowl.x, 0, bowl.z), pos: V(), legs, head: part('head'), tail: part('tail'), body: part('body'), bodyY: part('body')?.position.y ?? 0, burst: -1, rest,
        };
        this.diners.set(id, d);
      }
      if (!indoors.has(id)) {
        walker.visible = false;
        this.guests.up.delete(id);
        Object.assign(d, { state: 'idle', wait: rand(15, 40) });
        continue;
      }
      const st = this.stalk;
      const home = id === 'charlie' && (indoors.has('companion_lighthouse') || st.phase !== 'wait');
      d.t += dt;
      if (d.state === 'idle') {
        walker.visible = false;
        this.guests.up.delete(id); // (back on the sofa)
        if ((d.wait -= dt) > 0 || home || this.drinking > 0) continue;
        sleeper.getWorldPosition(d.from);
        d.start.copy(d.from).setY(0).add(V(BEHIND, 0, 0));
        Object.assign(d, { state: 'down', then: 'go', hurry: false, t: 0 });
      }
      walker.visible = true;
      sleeper.visible = false; // (it's the standing one now)
      this.guests.up.add(id);
      const turn = (to: number) => {
        const diff = Math.atan2(Math.sin(to - d.heading), Math.cos(to - d.heading));
        d.heading += diff * Math.min(1, dt * 8);
      };
      const face = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(-(to.z - from.z), to.x - from.x); // it faces +x
      let moving = false;
      let bite = 0;
      let chew = 0;
      let look = 0;
      let sit = 0;
      let air = 0;
      let perch = 0;
      let nod = 0;
      // hopping on and off the sofa: crouched, nose up or down, legs reaching forward and back, the head, the rump's wiggle
      let crouch = 0;
      let pitch = 0;
      let fore = 0;
      let hind = 0;
      let peer = 0;
      let sway = 0;
      /** A spring from a to b: straight across, and a parabola up and down (h is how far it bows above the straight line). */
      const leap = (a: THREE.Vector3, b: THREE.Vector3, k: number, h: number) => {
        d.pos.lerpVectors(a, b, k).y = a.y + (b.y - a.y) * k + 4 * h * k * (1 - k);
      };
      // across Vincent's shoulders, behind his neck (he sits facing north)
      const shoulders = () => (this.scene.getObjectByName('code_head')?.getWorldPosition(V()) ?? d.pos.clone()).add(V(0, -0.34, 0.24));
      switch (d.state) {
        case 'down': { // up from a nap: a long stretch, a spring onto the back of the sofa, a look over, and down
          const t = d.hurry ? (d.t < 0.4 ? d.t * 1.5 : d.t + 1.4) : d.t; // (in a hurry, it skips the stretch)
          const ridge = d.from.clone().add(RIDGE);
          d.pos.copy(d.from);
          if (t < 0.6) d.heading = 0; // (the sofa's back is east)
          crouch = 1 - ease(0, 0.6, t); // gets up
          const bow = ease(0.6, 1.0, t) * (1 - ease(1.4, 1.8, t)); // front paws out, chest down, rump up
          fore += bow * 0.9;
          hind += bow * 0.3;
          pitch -= bow * 0.3;
          crouch += ease(1.8, 2.1, t) * (1 - ease(2.15, 2.2, t)) * 0.7; // gathers itself, eyes on the top
          peer += ease(1.8, 2.0, t) * (1 - ease(2.2, 2.4, t)) * 0.35;
          if (t >= 2.2 && t < 2.55) {
            const k = (t - 2.2) / 0.35;
            leap(d.from, ridge, k, 0.3);
            pitch += 0.5 * (1 - k) - 0.15 * ease(0.7, 1, k);
            fore += 1.1 * (1 - k) + 0.2;
            hind -= 0.9 * ease(0, 0.3, k) * (1 - ease(0.6, 1, k));
          } else if (t >= 2.55 && t < 3.2) {
            d.pos.copy(ridge);
            crouch += 0.5 * (1 - ease(2.55, 2.85, t)); // lands, and steadies
            peer -= 0.5 * ease(2.75, 3.0, t); // and has a look over
            pitch -= 0.15 * ease(2.75, 3.0, t);
          } else if (t >= 3.2 && t < 3.62) {
            const k = (t - 3.2) / 0.42;
            leap(ridge, d.start, k, 0.24);
            pitch -= 0.15 + 0.35 * ease(0, 0.7, k); // nose first, front paws reaching for the floor
            fore += 0.6;
            hind -= 0.5 * (1 - ease(0.7, 1, k));
            peer -= 0.3;
          } else if (t >= 3.62) {
            d.pos.copy(d.start);
            pitch -= 0.3 * (1 - ease(3.62, 3.87, t)); // front paws down first, then the back ones
            crouch += 0.6 * (1 - ease(3.62, 3.95, t));
          }
          if (t >= 3.62) turn(face(d.start, d.then === 'go' ? d.goal : d.route[0]));
          if (t >= 3.95) Object.assign(d, { state: d.then, t: 0 });
          break;
        }
        case 'up': { // back from the bowl: sizes up the sofa, a wiggle, a spring, down onto the cushion, round once and settles
          const t = d.t;
          const ridge = d.from.clone().add(RIDGE);
          d.pos.copy(d.start);
          turn(Math.PI);
          peer += ease(0, 0.4, t) * (1 - ease(1.3, 1.5, t)) * 0.4;
          crouch += ease(0.5, 0.8, t) * (1 - ease(1.25, 1.3, t)) * 0.8;
          sway = Math.sin((t - 0.5) * 22) * 0.1 * ease(0.7, 0.85, t) * (1 - ease(1.15, 1.3, t)); // the wiggle
          if (t >= 1.3 && t < 1.68) {
            const k = (t - 1.3) / 0.38;
            leap(d.start, ridge, k, 0.32);
            pitch += 0.6 * (1 - k) - 0.1 * ease(0.7, 1, k);
            fore += 1.2 * (1 - k) + 0.3;
            hind -= 1.0 * ease(0, 0.25, k) * (1 - ease(0.6, 1, k));
          } else if (t >= 1.68 && t < 2.3) {
            d.pos.copy(ridge);
            crouch += 0.6 * (1 - ease(1.68, 1.95, t));
            peer -= 0.4 * ease(1.9, 2.1, t);
          } else if (t >= 2.3 && t < 2.6) {
            const k = (t - 2.3) / 0.3;
            leap(ridge, d.from, k, 0.06);
            pitch -= 0.3 * Math.sin(k * Math.PI);
            fore += 0.4;
            peer -= 0.4 * (1 - k);
          } else if (t >= 2.6) {
            d.pos.copy(d.from);
            crouch += 0.4 * (1 - ease(2.6, 2.85, t));
            if (t >= 2.85 && t < 4.25) { // round once, treading the cushion
              d.heading = Math.PI + Math.PI * 2 * ease(2.85, 4.25, t);
              moving = true;
              d.stride += dt * 9;
            }
            crouch += 2 * ease(4.25, 5.0, t); // and down, paws tucked
          }
          if (t >= 5.0) {
            walker.visible = false;
            sleeper.visible = true;
            this.guests.up.delete(id);
            Object.assign(d, { state: 'idle', wait: rand(45, 110) });
          }
          break;
        }
        case 'dash': { // the tap's on: a run for the counter
          const step = d.foot.clone().sub(d.pos).setY(0);
          const left = step.length();
          moving = true;
          turn(face(d.pos, d.foot));
          d.pos.y = 0;
          const pace = DASH * (id === 'george' ? 0.88 : 1); // George is the bigger one
          if (left <= pace * dt) {
            d.pos.copy(d.foot);
            Object.assign(d, { state: 'spring', t: 0 });
          } else d.pos.addScaledVector(step, (pace * dt) / left);
          d.stride += dt * 15;
          break;
        }
        case 'spring': { // a crouch at the foot of the counter, eyes on the top, and up
          const t = d.t;
          d.pos.copy(d.foot);
          turn(face(d.foot, d.spot));
          crouch += ease(0, 0.2, t) * (1 - ease(0.3, 0.35, t)) * 0.8;
          peer += ease(0, 0.2, t) * (1 - ease(0.35, 0.6, t)) * 0.4;
          if (t >= 0.35 && t < 0.73) {
            const k = (t - 0.35) / 0.38;
            leap(d.foot, d.spot, k, 0.3);
            pitch += 0.6 * (1 - k) - 0.1 * ease(0.7, 1, k);
            fore += 1.2 * (1 - k) + 0.3;
            hind -= 1.0 * ease(0, 0.25, k) * (1 - ease(0.6, 1, k));
          } else if (t >= 0.73) {
            d.pos.copy(d.spot);
            crouch += 0.5 * (1 - ease(0.73, 0.95, t));
          }
          if (t >= 0.95) Object.assign(d, { state: 'lap', t: 0, wait: rand(0.4, 1.4), sip: 0 });
          break;
        }
        case 'lap': { // at the tap: lapping from the stream, or sitting beside it waiting its turn
          d.pos.copy(d.spot);
          const running = this.drinking > 0;
          turn(face(d.spot, this.sink?.spout ?? d.spot));
          const want = !running ? 0 : this.queue.who === id ? 1 : -1;
          d.sip += (want - d.sip) * Math.min(1, dt * 4);
          const drinking = Math.max(0, d.sip);
          sit = Math.max(0, -d.sip);
          bite = drinking * (0.5 + Math.sin(this.clock * 14) * 0.07); // head into the stream, tongue going
          nod -= sit * 0.25; // and the one waiting watches the water
          if (!running) {
            peer += 0.3 * ease(0, 0.4, d.t); // a look up at the tap: is that it?
            if ((d.wait -= dt) <= 0) Object.assign(d, { state: 'hop', t: 0 });
          } else d.t = 0;
          break;
        }
        case 'hop': { // the water's off: down off the counter, and back to the sofa
          const t = d.t;
          d.pos.copy(d.spot);
          turn(face(d.spot, d.foot));
          crouch += ease(0, 0.25, t) * (1 - ease(0.3, 0.35, t)) * 0.4;
          peer -= 0.4 * ease(0, 0.25, t) * (1 - ease(0.35, 0.6, t));
          if (t >= 0.35 && t < 0.75) {
            const k = (t - 0.35) / 0.4;
            leap(d.spot, d.foot, k, 0.12);
            pitch -= 0.15 + 0.3 * ease(0, 0.7, k);
            fore += 0.6;
            hind -= 0.5 * (1 - ease(0.7, 1, k));
          } else if (t >= 0.75) {
            d.pos.copy(d.foot);
            pitch -= 0.3 * (1 - ease(0.75, 1.0, t));
            crouch += 0.5 * (1 - ease(0.75, 1.05, t));
          }
          if (t >= 1.05) Object.assign(d, { state: 'back', t: 0 });
          break;
        }
        case 'stalk': { // round to his chair, unhurried
          const to = d.route[d.leg];
          const step = to.clone().sub(d.pos).setY(0);
          const left = step.length();
          moving = true;
          turn(face(d.pos, to));
          d.pos.y = 0;
          if (left <= TROT * dt) {
            d.pos.copy(to);
            if (++d.leg >= d.route.length) {
              Object.assign(d, { state: 'sit', t: 0 });
              st.phase = 'sit';
            }
          } else d.pos.addScaledVector(step, (TROT * dt) / left);
          d.stride += dt * 9;
          break;
        }
        case 'sit': // sits down beside him, and looks up
          sit = ease(0, 0.6, d.t);
          turn(Math.PI);
          if (d.t >= 1.6) {
            Object.assign(d, { state: 'mew', t: 0 });
            st.phase = 'mew';
            this.onMew?.();
          }
          break;
        case 'mew': // one short mew, head up
          sit = 1;
          turn(Math.PI);
          nod = ease(0, 0.15, d.t) * (1 - ease(0.5, 0.7, d.t)) * 0.45;
          if (d.t >= 1.4) {
            d.hop.copy(d.pos);
            Object.assign(d, { state: 'jump', t: 0 });
            st.phase = 'up';
          }
          break;
        case 'jump': { // up onto his shoulders, all four legs out
          const k = Math.min(1, d.t / 0.7);
          const to = shoulders();
          d.pos.lerpVectors(d.hop, to, k).y = THREE.MathUtils.lerp(d.hop.y, to.y, k) + Math.sin(k * Math.PI) * 0.4;
          turn(0);
          air = Math.sin(Math.min(1, k * 1.1) * Math.PI * 0.5 + 0.2) ;
          sit = 1 - ease(0, 0.35, k);
          if (k >= 1) {
            Object.assign(d, { state: 'perch', t: 0, dur: rand(12, 20) });
            Object.assign(st, { phase: 'on', flinch: 1 });
            ambush.on = true;
            const top = this.scene.getObjectByName('code_head')?.getWorldPosition(V());
            if (top) this.guests.alert(top.add(V(0, 0.55, 0))); // claws in: he's startled!
          }
          break;
        }
        case 'perch': // sits there, gripping
          d.pos.copy(shoulders());
          turn(0);
          perch = ease(0, 0.3, d.t);
          if (d.t >= d.dur) {
            d.hop.copy(d.pos);
            Object.assign(d, { state: 'drop', t: 0 });
            st.phase = 'down';
            ambush.on = false;
          }
          break;
        case 'drop': { // and down again, and off to the bowl
          const k = Math.min(1, d.t / 0.7);
          d.pos.lerpVectors(d.hop, d.land, k).y = THREE.MathUtils.lerp(d.hop.y, 0, k) + Math.sin(k * Math.PI) * 0.3;
          turn(face(d.land, d.goal));
          air = 1 - k;
          perch = 1 - k;
          if (k >= 1) {
            Object.assign(d, { state: 'go', t: 0 });
            Object.assign(st, { phase: 'wait', next: rand(90, 180) });
          }
          break;
        }
        case 'go':
        case 'back': {
          const to = d.state === 'go' ? d.goal : d.start;
          const step = to.clone().sub(d.pos).setY(0);
          const left = step.length();
          moving = true;
          turn(face(d.pos, to));
          d.pos.y = 0;
          if (left <= TROT * dt) {
            d.pos.copy(to);
            if (d.state === 'go') Object.assign(d, { state: 'eat', t: 0, dur: rand(8, 13) });
            else Object.assign(d, { state: 'up', t: 0 });
          } else d.pos.addScaledVector(step, (TROT * dt) / left);
          d.stride += dt * 9;
          break;
        }
        case 'eat': {
          turn(Math.PI / 2); // nose to the wall, which is where the bowl is
          const t = d.t;
          const away = ease(0, 0.9, t) * (1 - ease(d.dur - 0.9, d.dur, t)); // lowers its head to the bowl, and lifts it again at the end
          const u = (t - 1) % 4.2; // after a sniff, bursts of bites (2.4 s) with a lift of the head to chew (1.8 s)
          const burst = t < 1 ? -1 : Math.floor((t - 1) / 4.2);
          if (burst > d.burst && burst >= 0) this.onCrunch?.();
          d.burst = burst;
          const biting = t < 1 ? 0 : u < 2.4 ? ease(0, 0.2, u) * (1 - ease(2.2, 2.4, u)) : 0;
          const snuff = t < 1 ? 0.45 + Math.sin(t * 9) * 0.06 : 0; // a sniff first
          const dip = t < 1 ? snuff : biting * (0.82 + 0.18 * Math.sin(u * 10.5)) + (1 - biting) * (0.3 + 0.04 * Math.sin(u * 3));
          bite = dip * away;
          chew = t < 1 || biting > 0.5 ? 0 : away * Math.sin(u * 17) * 0.05; // jaw going while its head's up
          look = t < 1 || biting > 0.2 ? 0 : away * Math.sin(u * 1.3) * 0.35; // and a glance about
          if (d.t >= d.dur) Object.assign(d, { state: 'back', t: 0, burst: -1 });
          break;
        }
      }
      walker.position.copy(walker.parent.worldToLocal(d.pos.clone()));
      walker.rotation.set(0, d.heading, 0);
      for (const [o, r] of d.rest) o.rotation.copy(r);
      d.legs.forEach((leg, i) => {
        const front = i < 2;
        leg.rotation.z += moving ? Math.sin(d.stride + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 : 0;
        // sitting: back legs folded under, front ones straight down; in the air and on his shoulders: reaching, gripping
        leg.rotation.z += front ? 0.9 * air + 1.0 * perch - 0.75 * sit : -0.6 * air + 0.6 * perch + 1.3 * sit;
        leg.rotation.z += front ? fore + 0.7 * crouch : hind - 0.7 * crouch; // crouched: paws forward, hocks back
      });
      if (d.head) {
        d.head.rotation.z += -bite * 1.0 + chew + nod + peer + 0.2 * sit + (moving ? Math.sin(d.stride * 2) * 0.05 : 0);
        d.head.rotation.y += look + perch * Math.sin(this.clock * 0.8) * 0.3;
      }
      if (d.body) {
        d.body.rotation.z = -bite * 0.22 + 0.75 * sit + 0.3 * air + pitch; // the front dips with the head; sitting, it tips up
        d.body.rotation.y = sway;
        d.body.position.y = d.bodyY - bite * 0.03 - 0.09 * sit - 0.05 * perch - 0.065 * crouch + (moving ? Math.abs(Math.sin(d.stride)) * 0.025 : 0);
      }
      if (d.tail) d.tail.rotation.x += Math.sin(this.clock * 0.9) * 0.15 + bite * Math.sin(this.clock * 3.2) * 0.25 + (sit + perch) * Math.sin(this.clock * 4) * 0.25; // and it wags a little, pleased (or keyed up)
    }
  }

  /**
   * The tap's on: whichever cats are in come running, from the sofa or the bowl or wherever
   * they are, jump up onto the counter either side of the sink and take turns at the stream.
   * The water bowl by the door is right there. It doesn't count.
   */
  tap() {
    this.drinking = this.drinking > 0 ? 0 : TAP_RUNS;
    return this.drinking > 0;
  }

  private drink(dt: number) {
    const tap = this.named.get('tap');
    if (!tap) return;
    if (!this.sink) {
      const box = new THREE.Box3().setFromObject(tap);
      const x = box.getCenter(V()).x;
      const top = box.min.y + 0.025; // the counter
      const z = box.max.z - 0.17; // in from the front edge, level with the spout
      this.sink = {
        spout: V(x, box.max.y - 0.11, box.max.z - 0.205), basin: box.min.y + 0.065,
        spots: { charlie: V(x - 0.4, top, z), george: V(x + 0.45, top, z) },
      };
    }
    const s = this.sink;
    this.drinking = Math.max(0, this.drinking - dt);
    if (this.drinking <= 0) {
      this.queue.who = '';
      return;
    }
    // the water: a thin thread from the spout into the basin, and the odd splash
    const fall = s.spout.y - s.basin;
    for (let i = 0; i < 6; i++) {
      const drop = rand(0, fall);
      this.particles.emit({
        position: s.spout.clone().add(V(rand(-0.012, 0.012), -drop, rand(-0.012, 0.012))),
        velocity: V(0, -1.4, 0), color: i % 3 ? '#bfe3f4' : '#f4fbff', life: (fall - drop) / 1.4, wobble: 0, size: 2, fadeIn: 0, hold: 1,
      });
    }
    if (this.every('splash', 0.12, dt)) {
      this.particles.emit({
        position: V(s.spout.x, s.basin, s.spout.z), velocity: V(rand(-0.25, 0.25), rand(0.3, 0.5), rand(-0.25, 0.25)),
        color: '#e6f4fa', life: 0.3, gravity: 3, size: 1, fadeIn: 0,
      });
    }
    // whose turn: whoever's up there first, and they swap every few seconds
    const up = [...this.diners].filter(([, d]) => d.state === 'lap').map(([id]) => id);
    const q = this.queue;
    if (!up.includes(q.who)) Object.assign(q, { who: up[0] ?? '', t: 0, lap: 0.3 });
    else if ((q.t += dt) > 3.5 && up.length > 1) Object.assign(q, { who: up.find((id) => id !== q.who)!, t: 0, lap: 0.3 });
    // and the lapping, once its head's in the stream (a take lasts about as long as a turn)
    const drinker = this.diners.get(q.who);
    if (drinker && drinker.sip > 0.6 && (q.lap -= dt) <= 0) {
      this.onLap?.();
      q.lap = 3.2;
    }
    // and everyone in comes running
    for (const [id, d] of this.diners) {
      if (!indoors.has(id) || (id === 'charlie' && indoors.has('companion_lighthouse'))) continue; // (on her lap, Charlie stays put)
      d.spot.copy(s.spots[id]);
      d.foot.copy(d.spot).setY(0).add(V(0, 0, 0.5));
      if (d.state === 'idle') {
        const sleeper = this.scene.getObjectByName(id);
        if (!sleeper) continue;
        sleeper.getWorldPosition(d.from);
        d.start.copy(d.from).setY(0).add(V(BEHIND, 0, 0));
        Object.assign(d, { state: 'down', then: 'dash', hurry: true, route: [d.foot], t: -rand(0, 0.8) }); // (not quite together: one's a heavier sleeper)
      } else if (d.state === 'down') {
        Object.assign(d, { then: 'dash', route: [d.foot] });
      } else if (['go', 'eat', 'back', 'stalk', 'sit', 'mew'].includes(d.state)) {
        Object.assign(d, { state: 'dash', t: 0, burst: -1 });
        if (id === 'charlie' && this.stalk.phase !== 'wait') Object.assign(this.stalk, { phase: 'wait', next: rand(90, 180) });
      }
    }
  }

  // --- the telly -------------------------------------------------------------------------

  /** A little attract screen: a road into the distance, the white lines rushing past. */
  private tv(mesh: THREE.Mesh) {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 36;
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    faceRoom(mesh, 'west');
    mesh.material = new THREE.MeshBasicMaterial({ map: texture });
    this.screen = { canvas, texture, next: 0, mesh };
  }

  /**
   * The telly's screen, in the world: its top-left, top-right and bottom-left corners, its middle,
   * and the way it faces (into the room, +x).
   */
  get tellyScreen() {
    const mesh = this.screen?.mesh;
    if (!mesh) return null;
    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox!;
    const x = max.x; // its front
    const at = (y: number, z: number) => V(x, y, z).applyMatrix4(mesh.matrixWorld);
    // (faceRoom: the picture runs from +z on the left to -z on the right)
    const corners = { tl: at(max.y, max.z), tr: at(max.y, min.z), bl: at(min.y, max.z) };
    const middle = corners.tr.clone().add(corners.bl).multiplyScalar(0.5);
    return { ...corners, middle, normal: V(1, 0, 0).transformDirection(mesh.matrixWorld) };
  }

  /** A point in the room, in CSS pixels on a canvas this size. */
  project(p: THREE.Vector3, width: number, height: number) {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  }

  private drawScreen() {
    const s = this.screen;
    if (!s || this.clock < s.next) return;
    s.next = this.clock + 1 / 12; // a jerky twelve frames a second, like it should be
    const ctx = s.canvas.getContext('2d')!;
    if (this.film) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, s.canvas.width, s.canvas.height);
      s.texture.needsUpdate = true;
      return;
    }
    // with her on the sofa, it's her programme on (companion.ts), not the game
    if (telly.show && indoors.has('companion_lighthouse')) {
      drawProgramme(ctx, telly.show, this.clock);
      s.texture.needsUpdate = true;
      return;
    }
    const { width: w, height: h } = s.canvas;
    const horizon = 13;
    ctx.fillStyle = '#7fc8f0';
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = '#4a8a45';
    ctx.fillRect(0, horizon, w, h - horizon);
    // a few city blocks on the horizon (it is Arnhem, after all)
    ctx.fillStyle = '#6a6275';
    for (const [x, bh] of [[2, 5], [7, 8], [12, 4], [33, 6], [38, 9], [43, 5]]) ctx.fillRect(x, horizon - bh, 4, bh);
    ctx.fillStyle = '#e8b24a';
    ctx.fillRect(24, horizon - 11, 1, 11); // the Eusebius tower, more or less
    for (let y = horizon; y < h; y++) {
      const k = (y - horizon) / (h - horizon);
      const half = 2 + k * 20;
      ctx.fillStyle = '#3b3a42';
      ctx.fillRect(Math.round(w / 2 - half), y, Math.round(half * 2), 1);
      // dashes rush towards you: their phase runs on 1/depth
      if (Math.floor(1 / (k + 0.08) * 2 - this.clock * 6) % 2 === 0) {
        ctx.fillStyle = '#f2ece2';
        ctx.fillRect(Math.round(w / 2 - Math.max(0.5, k * 1.2)), y, Math.max(1, Math.round(k * 2.4)), 1);
      }
    }
    // the car, bouncing gently
    const bob = Math.round(Math.sin(this.clock * 9));
    ctx.fillStyle = '#c8403a';
    ctx.fillRect(20, 27 + bob, 8, 4);
    ctx.fillRect(22, 25 + bob, 4, 2);
    ctx.fillStyle = '#1d1a24';
    ctx.fillRect(20, 31 + bob, 2, 1);
    ctx.fillRect(26, 31 + bob, 2, 1);
    if (Math.floor(this.clock * 1.5) % 2 === 0) {
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(15, 2, 18, 1); // "press start"
    }
    s.texture.needsUpdate = true;
  }

  // --- the bookcase --------------------------------------------------------------------

  /** Everything he's read, newest at the top left, spines in cloth colours, five-star books banded in gold. */
  private shelve(root: THREE.Object3D, rows: Row[]) {
    rows.sort((a, b) => a.index - b.index);
    let r = 0;
    let x = 0.04;
    BOOKS.forEach((book, i) => {
      const h0 = hash(`${book.title}|${book.author}`);
      const w = 0.075 + (h0 % 5) * 0.012;
      if (r < rows.length && x + w > rows[r].width) {
        r++;
        x = 0.04;
      }
      const row = rows[r];
      if (!row) return; // more books than shelf: the oldest wait in a box somewhere
      const height = row.clear * (0.72 + ((h0 >> 4) % 5) * 0.05);
      const d = row.depth * (0.78 + ((h0 >> 8) % 3) * 0.07);
      const color = new THREE.Color(SPINES[(h0 >> 11) % SPINES.length]);
      const cover = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT });
      const group = new THREE.Group();
      const spine = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), cover);
      spine.castShadow = spine.receiveShadow = true;
      group.add(spine);
      if (book.stars === 5) {
        const gold = toonIndoors(GOLD);
        for (const y of [height / 2 - 0.05, -height / 2 + 0.05]) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 0.02, 0.01), gold);
          band.position.set(0, y, d / 2);
          group.add(band);
        }
      }
      const home = row.origin.clone().add(V(x + w / 2, height / 2, -0.04 - d / 2));
      group.position.copy(home);
      group.rotation.z = (h0 >> 14) % 9 === 0 ? -0.05 : 0; // the odd one leaning
      const id = `read:${i}`;
      group.userData.id = id;
      root.add(group);
      this.spines.set(id, { group, home, cover, color: color.clone(), out: 0 });
      x += w + 0.006;
    });
  }

  private addLamp(position: THREE.Vector3, x: Record<string, number | string>, halo: THREE.Texture) {
    const radius = Number(x.radius);
    const light = new THREE.PointLight(new THREE.Color(String(x.color)), 0, radius * 1.8, 1.4);
    light.position.copy(position);
    this.scene.add(light);
    this.lamps.push({ light, base: Number(x.intensity) * 7, flicker: Number(x.flicker), seed: Math.random() * 100 });
    if (x.halo === 0) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: halo, color: new THREE.Color(String(x.color)), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    sprite.position.copy(position);
    sprite.scale.setScalar(radius * 0.22);
    sprite.renderOrder = 2;
    sprite.raycast = () => {};
    this.scene.add(sprite);
    this.lamps[this.lamps.length - 1].halo = sprite;
  }

  private every(key: string, seconds: number, dt: number) {
    const left = (this.timers.get(key) ?? Math.random() * seconds) - dt;
    this.timers.set(key, left <= 0 ? left + seconds : left);
    return left <= 0;
  }
}
