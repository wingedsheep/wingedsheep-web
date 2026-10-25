import * as THREE from 'three';
import type { Ground } from './beike';
import { hourOf } from './bedtime';
import { occasions } from './calendar';
import type { Call } from './fauna';
import type { Island } from './island';
import { gather, littered, lying } from './litter';
import type { Particles } from './particles';
import { RobotBody, type Stance } from './robot';
import { season } from './season';
import { heightBetween, type Waypoint } from './shelter';
import type { Ways } from './ways';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const ease = THREE.MathUtils.smootherstep;

/**
 * The robot's odd jobs out on the island. Leaves into a sack, one at a time (there's no leaf
 * blower on this island); the plaza or the pier swept; a path dug through the snow from the
 * workshop down to the pier; the tideline walked with a litter picker and a bucket; the cherry
 * tree watered on a hot, dry day, first thing or of an evening; the grass cut with a push mower,
 * though never on a Sunday.
 */
export type Chore = 'leaves' | 'sweep' | 'shovel' | 'beach' | 'water' | 'mow'
  // and some time to itself: on the end of the pier with its feet over the water, skimming stones
  // off the beach on a calm day, or dancing by the fire while he plays
  | 'sea' | 'stones' | 'dance';
export const CHORES: Chore[] = ['leaves', 'sweep', 'shovel', 'beach', 'water', 'mow', 'sea', 'stones', 'dance'];
/** Which of them aren't work. */
export const LEISURE: Chore[] = ['sea', 'stones', 'dance'];

/** The workshop's door (Blender x, y: vincent.ts DOORS), where it comes out and goes back in. */
const DOOR: [number, number] = [11.5, -7.4];
const VIEW = THREE.MathUtils.degToRad(35); // the camera's angle above the horizon (camera-rig.ts)
const DECK = 0.84; // the pier's boards (layout.py SHELTER "deck")
const SPEED = 1.0; // m/s, about its business
const HURRY = 1.7; // m/s, back in out of the rain
const PUSH = 0.6; // m/s, behind the mower
/** Seconds indoors, between one job and the next (charging, tinkering). */
const BREAK: [number, number] = [50, 150];

// where each job is done (Blender x, y; "deck" is up on the pier's boards)
const PLAZA: [number, number][] = [[-1.6, -7.4], [1.3, -8.6], [-0.6, -9.7], [1.9, -7.1]];
const PIER: [number, number, 'deck'][] = [[0.2, -19.2, 'deck'], [0.2, -21.4, 'deck'], [0.3, -23.6, 'deck']];
/** The path from the workshop's door to the plaza and down to the pier, a shovel's width at a time. */
const DIG: [number, number][] = [[11, -7.3], [9.6, -7.1], [8.2, -7], [6.8, -7.2], [5.4, -7.4], [4, -7.6], [2.6, -7.9], [1.2, -8], [0, -9.2], [0, -10.6], [0, -12], [0, -13.4]];
/** Where it sits on the pier: on the east edge between two posts (props.py `pier`: 2.2 wide, posts every 2 m), looking out east. */
const PIER_EDGE: [number, number, 'deck'][] = [[0.3, -23.5, 'deck'], [1.24, -23.5, 'deck']];
/** On the way along the pier's middle (ways.ts PATHS), where it turns off for the edge. */
const ON_THE_PIER: [number, number, 'deck'] = [0.2, -21.5, 'deck'];
const SEAT = 0.42; // how far its hips come down to sit on the boards
/** By the fire, out of the way of the logs, where it dances when he's playing (layout.py CAMPFIRE is (27, -1)). */
const DANCEFLOOR: [number, number][] = [[23.4, -4.4], [24.8, -3.8], [26.2, -4.4], [27.6, -4], [22.6, -2.6], [25, -5.6]];
const BEAT = 2.1; // dance steps a second, near enough to his strumming
const SHORE_EAST: [number, number][] = [[3.8, -16.1], [6.4, -16.5], [9, -16.6], [11.6, -16.5]];
const SHORE_WEST: [number, number][] = [[-2.8, -15.7], [-5, -14.9], [-7.2, -14.2]];
/** By the well, to fill the can (layout.py WELL is its middle). */
const WELL: [number, number] = [18.7, -13.4];
/** The lawn it mows: Beike's meadow, below the bench, up and down in strips (clear of the trees and the bench). */
const LAWN: [number, number][][] = [
  [[-9.6, -13.2], [-15.4, -13.2]],
  [[-15.4, -13.9], [-9.6, -13.9]],
  [[-9.6, -14.6], [-15.4, -14.6]],
];

export interface ChoreWorld {
  time: number; // the island's time (sky.ts)
  night: number; // 0..1
  rain: number; // 0..1: rain or hail coming down
  snow: number; // 0..1: snow coming down
  lying: number; // 0..1: snow on the ground
  wind: number; // m/s
  temperature: number; // °C
  cloud: number; // 0..1
  /** Whether you're in the workshop: then it's in there too. */
  inside: boolean;
  /** Whether he's playing the guitar by the fire (and you can hear it). */
  music: boolean;
}

/** One stop on the round: walk there (`way`), then work there for `work` seconds. */
interface Stop {
  way: Waypoint[];
  work: number;
  face?: THREE.Vector3;
  /** Pushing the mower up a strip, cutting as it goes. */
  cutting?: boolean;
  /** At the well, filling the can rather than emptying it. */
  fill?: boolean;
  /** Straight there, not by the ways (across the pier's boards). */
  direct?: boolean;
}

type Doing = 'in' | 'walk' | 'work' | 'stumble' | 'wave';
/** A skimmed stone's next bounce: when (the clock), and where. */
interface Skip { at: THREE.Vector3; when: number; last: boolean }

/**
 * The workshop robot out on the island (chores.py `robot_about`). By day, in fair weather, it
 * comes out of the workshop now and then for a job that suits the season: the leaves in autumn,
 * the snow when there's snow, the grass in summer. At dusk, in the rain or when it gets blowy it
 * goes back in to its charger, and when you go into the workshop it's in there with you.
 */
export class Chores {
  readonly root?: THREE.Object3D;
  private body?: RobotBody;
  private tools = new Map<string, THREE.Object3D>();
  private reel?: THREE.Object3D;
  private canRest = 0;
  private spout?: THREE.Object3D;
  /** The leaves lying under the trees (ambience.ts), for picking up. */
  fallen?: THREE.InstancedMesh;
  /** Its noises: setting off, a beep, a clank when it trips. */
  onSound?: (call: Call, at: THREE.Vector3) => void;

  chore: Chore | null = null;
  doing: Doing = 'in';
  /** Whether it's on its way back in (the job's done, or the weather's turned). */
  homeward = false;
  private stops: Stop[] = [];
  private stop?: Stop;
  private i = 1;
  private along = 0;
  private t = 0;
  private clock = 0;
  private heading = 0;
  private speed = SPEED;
  private wait = rand(15, 60);
  private pinned: Chore | null = null;
  private first = true;
  /** How full the leaf sack is, 0..1, and the cycles in a row with nothing to pick up. */
  private sack = 0;
  private empty = 0;
  private cycle = -1;
  private caught = -1;
  private bucket = false;
  private skips: Skip[] = [];
  private hour = 12;
  /** How many times the last stone went, and whether it's pleased about it. */
  private bounces = 0;
  /** Seconds left of looking round at you (sat on the pier, it doesn't get up to wave). */
  private noticed = 0;
  private door = V();
  private trees: { at: THREE.Vector3; radius: number; owner?: string }[] = [];
  private ray = new THREE.Raycaster(V(), V(), 0.3, 40);

  constructor(
    private island: Island,
    private ground: Ground,
    private ways: Ways,
    private particles: Particles,
  ) {
    this.root = island.get('robot_about');
    if (!this.root) return;
    this.body = new RobotBody(this.root, 'bot_');
    for (const name of ['sack', 'sack_leaves', 'broom', 'shovel', 'snowload', 'grabber', 'grabbed_0', 'grabbed_1', 'grabbed_2', 'bucket', 'bucket_fill', 'can', 'mower', 'scarf']) {
      const o = this.root.getObjectByName(`bot_${name}`);
      if (o) this.tools.set(name, o);
    }
    this.reel = this.root.getObjectByName('bot_reel');
    this.canRest = this.tools.get('can')?.rotation.x ?? 0;
    this.spout = this.root.getObjectByName('bot_spout');
    this.root.visible = false;
    this.door = this.on(DOOR).at;
    for (const c of island.canopies) if (c.squash >= 1) this.trees.push({ at: c.position.clone(), radius: c.radius, owner: c.owner });
  }

  /** Straight out to a job, and at it till you look away (and then again): ?robot=leaves etc. */
  put(chore: Chore) {
    this.pinned = chore;
    this.first = false;
    this.begin(chore, true);
  }

  get out() {
    return this.doing !== 'in';
  }

  get position() {
    return this.root?.position ?? this.door;
  }

  /** At the well, filling the watering can. */
  get filling() {
    return this.doing === 'work' && !!this.stop?.fill;
  }

  /** Clicked: a wave (with whatever it's holding), or, mid-stride, a stumble. */
  poke(): 'wave' | 'trip' {
    if (this.doing === 'walk') {
      this.trip();
      return 'trip';
    }
    if (this.doing === 'work' && (this.chore === 'sea' || this.chore === 'dance')) {
      this.noticed = 2.5; // a look round, and a beep; it carries on
      this.onSound?.('robot-beep', this.position);
    } else if (this.doing === 'work') {
      this.doing = 'wave';
      this.t = 0;
      this.onSound?.('robot-beep', this.position);
    }
    return 'wave';
  }

  update(dt: number, w: ChoreWorld) {
    if (!this.root || !this.body?.ok) return;
    this.clock += dt;
    const allowed = this.allowed(w);
    if (this.first) {
      // arriving to find it already out at something, as often as not
      this.first = false;
      if (allowed.length && Math.random() < 0.5) this.begin(this.choose(allowed), true);
    }
    if (w.inside && this.out && !this.pinned) return this.inside(); // it's come in after you
    if (this.doing === 'in') {
      this.root.visible = false;
      if (w.inside || (this.wait -= dt) > 0) return;
      if (this.pinned) this.begin(this.pinned);
      else if (allowed.length) this.begin(this.choose(allowed));
      else this.wait = rand(20, 40);
      return;
    }
    // rain, the dark, a gale: it packs up and goes in, the rain at a trot
    if (!this.pinned && !this.homeward && this.chore && !allowed.includes(this.chore)) this.home(w.rain > 0.08 || w.snow > 0.3);
    this.root.visible = true;
    const scarf = this.tools.get('scarf');
    if (scarf) scarf.visible = w.temperature < 6;
    this.act(dt);
  }

  // --- what it does, and when ------------------------------------------------------

  private allowed(w: ChoreWorld): Chore[] {
    const hour = (this.hour = hourOf(w.time));
    if (w.rain > 0.08 || w.snow > 0.5 || w.wind > 12 || occasions.has('patchday')) return []; // (on Patch Tuesday it's installing its updates)
    const jobs: Chore[] = [];
    // the guitar going by the fire, into the evening; the sea of a fine evening, into the dusk
    if (w.music && w.night < 0.9 && hour >= 8.5 && hour < 22.5) jobs.push('dance');
    if (w.night < 0.55 && hour >= 8.5 && hour < 21 && w.wind < 10) jobs.push('sea');
    if (w.night > 0.3 || hour < 8.5 || hour >= 19.5) return jobs;
    if (w.lying > 0.3) return [...jobs, 'shovel'];
    jobs.push('sweep');
    if (w.wind < 6 && w.snow < 0.05) jobs.push('stones');
    if (littered() > 0.15 && w.wind < 9 && w.snow < 0.05) jobs.push('leaves');
    if (w.wind < 10 && w.snow < 0.05) jobs.push('beach');
    const summer = season.leafOut > 0.8 && season.fall < 0.1;
    if (summer && w.temperature >= 18 && w.cloud < 0.8 && (hour < 11 || hour >= 17)) jobs.push('water');
    if (season.leafOut > 0.7 && season.turn < 0.3 && w.temperature > 8 && hour >= 10 && hour < 18 && !occasions.has('sunday')) jobs.push('mow');
    return jobs;
  }

  private choose(jobs: Chore[]): Chore {
    // the season's own job most of all: the leaves while they're down, the watering in a dry spell
    // and some of its own time: the guitar's hard to resist, and the sea most of all of an evening
    const evening = this.hour >= 17;
    const weight: Record<Chore, number> = { leaves: 3, sweep: 0.8, shovel: 1, beach: 1, water: 2, mow: 1.4, sea: evening ? 1.6 : 0.5, stones: 0.7, dance: 5 };
    let r = Math.random() * jobs.reduce((s, j) => s + weight[j], 0);
    for (const j of jobs) if ((r -= weight[j]) < 0) return j;
    return jobs[0];
  }

  /** Out of the door to a job (or, `there`, already at it; or from where it is, `from`). */
  private begin(chore: Chore, there = false, from: Waypoint = { at: this.door.clone(), fixed: false }) {
    const spots = this.plan(chore);
    if (!spots.length) {
      this.wait = this.pinned ? 1 : rand(...BREAK); // (nothing to do there yet: the leaves aren't down)
      return;
    }
    this.chore = chore;
    this.homeward = false;
    this.sack = 0;
    this.empty = 0;
    this.bucket = false;
    this.speed = SPEED;
    const stops: Stop[] = [];
    for (const s of spots) {
      const way = s.cutting || s.direct ? [from, s.at] : this.ways.between(from, s.at);
      if (!way) continue;
      stops.push({ way, work: s.work, face: s.face, cutting: s.cutting, fill: s.fill, direct: s.direct });
      from = s.at;
    }
    if (!stops.length) return;
    this.stops = stops;
    this.show();
    if (there) {
      // straight to the first stop's work
      const first = this.stops.shift()!;
      this.stop = first;
      const end = first.way[first.way.length - 1];
      this.root!.position.copy(end.at);
      this.heading = first.face ? this.facing(first.face) : 0;
      this.root!.rotation.y = this.heading;
      this.startWork();
    } else {
      this.next();
      this.onSound?.('robot-servo', from.at);
    }
  }

  /** Where the job takes it, stop by stop. */
  private plan(chore: Chore): { at: Waypoint; work: number; face?: THREE.Vector3; cutting?: boolean; fill?: boolean; direct?: boolean }[] {
    const sea = (w: Waypoint) => w.at.clone().add(V(0, 0, 5));
    switch (chore) {
      case 'leaves': {
        // under one of the trees by the paths with the most leaves lying (not off in the woods),
        // just out from under its crown on the side you look at it from
        const fallen = this.fallen;
        if (!fallen) return [];
        const near = this.trees.filter((t) => t.at.distanceTo(this.door) < 26 && t.at.x < 19 && t.at.z > 3) // (in front of the buildings, not behind them)
          .map((t) => ({ t, n: lying(fallen, t.at.x, t.at.z, t.radius * 1.5) }))
          .filter((x) => x.n > 12)
          .sort((a, b) => b.n - a.n)
          .slice(0, 5);
        if (!near.length) return [];
        // (side on to you, so you see it bend for each one)
        const around = (t: (typeof near)[number]['t']) => [-0.6, 0, 0.6].map((x) => x + rand(-0.15, 0.15)).map((a) => {
          const p = t.at.clone().addScaledVector(V(Math.sin(a), 0, Math.cos(a)), t.radius * rand(1.1, 1.35));
          const at = this.on([p.x, -p.z]);
          return { at, work: 22, face: at.at.clone().add(V(a < 0 ? -1 : 1, 0, 0.45)) };
        }).filter((s) => !Number.isNaN(s.at.at.y) && s.at.at.y > 0.2 && this.inView(s.at.at));
        const choices = near.map(({ t }) => around(t)).filter((spots) => spots.length >= 2);
        return choices.length ? pick(choices) : [];
      }
      case 'sweep': {
        const pier = Math.random() < 0.35;
        const pts = pier ? PIER.map((p) => this.on(p)) : PLAZA.map((p) => this.on(p));
        return pts.map((at) => ({ at, work: rand(10, 16), face: at.at.clone().add(V(rand(-1, 1), 0, rand(-1, 1))) }));
      }
      case 'shovel':
        return DIG.map((p, i) => {
          const at = this.on(p);
          const ahead = this.on(DIG[Math.min(DIG.length - 1, i + 1)]).at;
          return { at, work: 7, face: i < DIG.length - 1 ? ahead : at.at.clone().add(V(0, 0, 1)) };
        });
      case 'beach': {
        const shore = Math.random() < 0.6 ? SHORE_EAST : SHORE_WEST;
        return (Math.random() < 0.5 ? shore : [...shore].reverse()).map((p) => this.on(p))
          .filter((w) => !Number.isNaN(w.at.y) && w.at.y > 0.15)
          .map((at) => ({ at, work: rand(4, 8), face: sea(at) }));
      }
      case 'water': {
        // fill up at the well; then the cherry tree, and a tree or two near it
        const well = this.on(WELL);
        const blossom = this.trees.find((t) => t.owner === 'blossom');
        const others = this.trees.filter((t) => t !== blossom && t.at.distanceTo(well.at) < 12).sort(() => Math.random() - 0.5).slice(0, 2);
        const spots: ReturnType<Chores['plan']> = [{ at: well, work: 4, face: this.on([20, -14]).at, fill: true }];
        for (const t of [blossom, ...others]) {
          if (!t) continue;
          // at the drip line, where the roots that drink are, on the side you can see
          const at = this.on([t.at.x, -(t.at.z + Math.max(1, t.radius * 1.05))]);
          if (!Number.isNaN(at.at.y) && this.inView(at.at)) spots.push({ at, work: 7, face: t.at.clone().setY(at.at.y) });
        }
        return spots;
      }
      case 'sea': {
        // out along the boards, and across to the edge between two posts (straight there: the ways
        // only come onto the pier along its middle)
        const [along, walkOn, edge] = [ON_THE_PIER, ...PIER_EDGE].map((p) => this.on(p));
        return [{ at: along, work: 0.3 }, { at: walkOn, work: 0.3, direct: true }, { at: edge, work: rand(70, 160), face: edge.at.clone().add(V(5, 0, 0)), direct: true }];
      }
      case 'stones': {
        // somewhere along the beach with the water just in front of it
        const shore = [...SHORE_EAST, ...SHORE_WEST].map((p) => this.on(p)).filter((w) => !Number.isNaN(w.at.y) && w.at.y > 0.15 && this.seaAhead(w.at, V(0, 0, 1)) > 0);
        if (!shore.length) return [];
        const at = pick(shore);
        return [{ at, work: rand(20, 36), face: at.at.clone().add(V(0, 0, 5)) }];
      }
      case 'dance': {
        const floor = DANCEFLOOR.map((p) => this.on(p)).filter((w) => !Number.isNaN(w.at.y));
        const seen = floor.filter((w) => this.inView(w.at));
        const at = seen[0] ?? floor[0];
        return at ? [{ at, work: rand(60, 120), face: at.at.clone().add(V(0.4, 0, 1)) }] : [];
      }
      case 'mow': {
        const spots: ReturnType<Chores['plan']> = [];
        for (const [a, b] of LAWN) {
          spots.push({ at: this.on(a), work: 0.6 });
          spots.push({ at: this.on(b), work: 0.6, cutting: true });
        }
        return spots;
      }
    }
  }

  /** Done, or the weather's turned: back to the workshop's door (`hurry`: at a trot). */
  private home(hurry = false) {
    if (!this.root) return;
    this.homeward = true;
    const from = this.here();
    const door: Waypoint = { at: this.door.clone(), fixed: false };
    // off the edge of the pier, back onto its middle first
    const pier = from.fixed && from.at.distanceTo(this.on(ON_THE_PIER).at) > 1 ? [from, this.on([0.3, -from.at.z, 'deck']), this.on(ON_THE_PIER)] : null;
    const way = pier ? [...pier, ...(this.ways.between(pier[2], door) ?? [door]).slice(1)] : this.ways.between(from, door) ?? [from, door];
    this.stops = [{ way, work: 0 }];
    if (hurry) this.speed = HURRY;
    this.next();
  }

  /** Where it's standing, as somewhere to walk from (up on the pier, or on the ground). */
  private here(): Waypoint {
    const p = this.root?.position ?? this.door;
    return { at: p.clone(), fixed: p.y > DECK - 0.05 && Math.abs(p.x) < 1.4 && p.z > 18 };
  }

  /** In at the door: it's on its charger again till the next job. */
  private inside() {
    this.doing = 'in';
    this.chore = null;
    this.homeward = false;
    this.stops = [];
    this.wait = rand(...BREAK);
    if (this.root) this.root.visible = false;
  }

  /** Onto the next stop's walk, or, if that's the last, home. */
  private next() {
    const s = this.stops.shift();
    if (!s) {
      if (this.homeward) return this.inside();
      if (this.pinned) return this.begin(this.pinned, false, this.here());
      return this.home();
    }
    this.stop = s;
    this.tilt(0);
    this.i = 1;
    this.along = 0;
    this.doing = 'walk';
    if (s.cutting) this.speed = PUSH;
    else if (!this.homeward || this.speed !== HURRY) this.speed = this.chore === 'mow' ? PUSH * 1.4 : this.chore && LEISURE.includes(this.chore) ? SPEED * 0.85 : SPEED;
  }

  private startWork() {
    this.doing = 'work';
    this.t = 0;
    this.cycle = -1;
  }

  private trip() {
    this.doing = 'stumble';
    this.t = 0;
    this.body?.kick(2.5);
    this.onSound?.('robot-clank', this.position);
  }

  /** Which of its tools are out, for the job in hand. */
  private show() {
    const c = this.chore;
    const on: Record<string, boolean> = {
      sack: c === 'leaves', broom: c === 'sweep', shovel: c === 'shovel', grabber: c === 'beach', bucket: c === 'beach', can: c === 'water', mower: c === 'mow',
    };
    for (const [name, o] of this.tools) if (name in on) o.visible = on[name];
    for (const name of ['sack_leaves', 'snowload', 'bucket_fill', 'grabbed_0', 'grabbed_1', 'grabbed_2']) {
      const o = this.tools.get(name);
      if (o) o.visible = false;
    }
    this.tools.get('sack')?.scale.set(0.75, 0.75, 1);
  }

  // --- moving about -----------------------------------------------------------------

  private act(dt: number) {
    const root = this.root!;
    let stance: Stance = {};
    this.t += dt;
    switch (this.doing) {
      case 'walk': {
        const w = this.walk(dt);
        stance = this.carrying({ walking: w, look: Math.sin(this.clock * 0.9) * 0.2 });
        if (this.chore === 'mow') this.turnReel(dt * this.speed);
        if (this.stop?.cutting && this.doing === 'walk') this.clippings(dt);
        // clumsy, outdoors as in: every so often a toe catches on nothing at all
        if (this.doing === 'walk' && this.chore !== 'mow' && Math.random() < dt / 30) this.trip();
        break;
      }
      case 'work':
        if (this.chore !== 'dance') this.turnTo(this.stop?.face, dt);
        stance = { plant: 1, ...this.work(dt) };
        break;
      case 'stumble': {
        // catches a toe, pitches forward, windmills, and just about stays up
        const k = Math.min(1, this.t / 1.3);
        const lean = Math.sin(Math.min(1, k * 3) * Math.PI) * 0.45 * (1 - k) + Math.sin(this.t * 14) * 0.08 * (1 - k);
        stance = { lean, arm: [2.2 + Math.sin(this.t * 20) * 0.8, 2.2 + Math.cos(this.t * 20) * 0.8].map((a) => a * (1 - k)), armOut: [0.6 * (1 - k), -0.6 * (1 - k)], look: Math.sin(this.t * 18) * 0.3 * (1 - k) };
        if (this.t > 1.3) {
          this.doing = 'walk';
          this.body?.kick(1);
        }
        break;
      }
      case 'wave': {
        stance = { arm: [0, 2.6], armOut: [0, -0.4 - Math.sin(this.t * 12) * 0.35] };
        if (this.t > 1.8) {
          this.doing = 'work';
          this.cycle = -1;
        }
        break;
      }
    }
    this.splashes();
    root.rotation.y = this.heading;
    this.body!.pose(dt, stance);
  }

  /** One frame along the way to the next stop; returns how much it's striding (0..1). */
  private walk(dt: number) {
    const s = this.stop;
    const root = this.root!;
    if (!s || s.way.length < 2) {
      if (s) this.arrive();
      return 0;
    }
    this.along += this.speed * dt;
    let a = s.way[this.i - 1];
    let b = s.way[this.i];
    for (;;) {
      const len = a.at.distanceTo(b.at);
      if (this.along < len) break;
      this.along -= len;
      if (++this.i >= s.way.length) {
        root.position.copy(b.at);
        this.arrive();
        return 0;
      }
      a = s.way[this.i - 1];
      b = s.way[this.i];
    }
    const len = Math.max(1e-3, a.at.distanceTo(b.at));
    const at = V().lerpVectors(a.at, b.at, this.along / len);
    const h = heightBetween(a, b, at, this.ground);
    if (!Number.isNaN(h)) at.y = h;
    root.position.copy(at);
    const want = Math.atan2(b.at.x - a.at.x, b.at.z - a.at.z);
    this.heading += Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)) * (1 - Math.exp(-6 * dt));
    return Math.min(1, this.speed / SPEED);
  }

  private arrive() {
    const s = this.stop;
    if (this.homeward && !this.stops.length) return this.inside();
    if (s && s.work > 0) this.startWork();
    else this.next();
  }

  private facing(to: THREE.Vector3) {
    const p = this.root!.position;
    return Math.atan2(to.x - p.x, to.z - p.z);
  }

  private turnTo(to: THREE.Vector3 | undefined, dt: number) {
    if (!to) return;
    const want = this.facing(to);
    this.heading += Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)) * (1 - Math.exp(-4 * dt));
  }

  /** Walking with the job's things: the mower's handle in both hands, the sack and the bucket held still. */
  private carrying(s: Stance): Stance {
    if (this.chore === 'mow') return { ...s, arm: [0.98, 0.98], lean: 0.08, swing: 0 };
    if (this.chore === 'shovel' || this.chore === 'sweep') return { ...s, arm: [0, 0.25], swing: 0.3 };
    if (this.chore === 'water' || this.chore === 'beach') return { ...s, arm: [0, 0.1], swing: 0.4 };
    if (this.chore === 'leaves') return { ...s, swing: 0.5 };
    return s;
  }

  // --- the work itself ---------------------------------------------------------------

  private work(dt: number): Stance {
    const t = this.t;
    const s = this.stop!;
    const done = t > s.work;
    const front = (d: number) => this.position.clone().add(V(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(d));
    switch (this.chore) {
      case 'leaves': {
        // bend, pick, up, into the sack: a leaf or two at a time, the sack filling
        const T = 1.9;
        const n = Math.floor(t / T);
        const k = (t % T) / T;
        if (n !== this.cycle) {
          this.cycle = n;
          if (done || this.empty >= 2 || this.sack >= 1) {
            this.next();
            if (this.sack >= 1) this.home();
            return {};
          }
        }
        const down = ease(k, 0.05, 0.3) * (1 - ease(k, 0.42, 0.62));
        const over = ease(k, 0.5, 0.7) * (1 - ease(k, 0.82, 1));
        if (k > 0.33 && k - dt / T <= 0.33 && this.fallen) {
          const p = front(0.55);
          const got = gather(this.fallen, p.x, p.z, 0.75, 2);
          this.empty = got ? 0 : this.empty + 1;
          this.sack = Math.min(1, this.sack + got / 36);
        }
        if (k > 0.75 && k - dt / T <= 0.75) {
          const sack = this.tools.get('sack');
          sack?.scale.set(0.75 + this.sack * 0.3, 0.75 + this.sack * 0.3, 1);
          const leaves = this.tools.get('sack_leaves');
          if (leaves) leaves.visible = this.sack > 0.2;
        }
        // (its arms are short: right down to the grass means the arm hanging straight under a deep bow;
        // then the sack comes up in front and the leaves go in)
        // (arms swing from the leaning hips, so `lean` more is straight down)
        const lean = down * 0.7;
        return { lean, crouch: down * 0.07, arm: [lean + over * 0.45, lean + down * 0.15 + over * 0.65], armOut: [-over * 0.35, over * 0.5], look: over * 0.3 };
      }
      case 'sweep': {
        if (done) {
          this.next();
          return {};
        }
        const sw = Math.sin(t * 2.6);
        if (Math.abs(sw) > 0.97 && Math.random() < dt * 30) this.dust(front(0.6));
        return { lean: 0.15, arm: [0.35, 0.2], armOut: [-0.1 - sw * 0.2, sw * 0.35], look: sw * 0.2 };
      }
      case 'shovel': {
        // in under it, up, and over to the side, a shovelful at a time
        const T = 2.3;
        const n = Math.floor(t / T);
        const k = (t % T) / T;
        if (n !== this.cycle) {
          this.cycle = n;
          if (done) {
            this.next();
            return {};
          }
        }
        const push = ease(k, 0, 0.3) * (1 - ease(k, 0.35, 0.5));
        const lift = ease(k, 0.35, 0.55) * (1 - ease(k, 0.75, 0.95));
        const toss = ease(k, 0.55, 0.68) * (1 - ease(k, 0.8, 0.95));
        const load = this.tools.get('snowload');
        if (load) load.visible = k > 0.3 && k < 0.66;
        if (k > 0.66 && k - dt / T <= 0.66) this.throwSnow(front(0.3));
        const lean = 0.1 + 0.3 * push; // (and the arms make up for it, so the blade stays on the ground)
        return { lean, crouch: 0.05 * push, arm: [lean + 0.3 + lift * 0.6, lean + 0.05 + lift * 0.9], armOut: [-0.25 - toss * 0.3, -toss * 0.7], look: -toss * 0.5 };
      }
      case 'beach': {
        // bend with the picker, and something into the bucket: a bottle top, some rope, a crisp packet
        const T = 2.8;
        const n = Math.floor(t / T);
        const k = (t % T) / T;
        if (n !== this.cycle) {
          this.cycle = n;
          if (done) {
            this.next();
            return {};
          }
          this.caught = Math.random() < 0.75 ? Math.floor(Math.random() * 3) : -1; // and sometimes it's only a shell, and it leaves it
        }
        const down = ease(k, 0.1, 0.3) * (1 - ease(k, 0.42, 0.6));
        const over = ease(k, 0.5, 0.68) * (1 - ease(k, 0.85, 1));
        for (let i = 0; i < 3; i++) {
          const o = this.tools.get(`grabbed_${i}`);
          if (o) o.visible = i === this.caught && k > 0.33 && k < 0.78;
        }
        if (k > 0.78 && this.caught >= 0) this.bucket = true;
        const fill = this.tools.get('bucket_fill');
        if (fill) fill.visible = this.bucket;
        return { lean: down * 0.35, crouch: down * 0.05, arm: [down * 0.35 + over * 0.2, down * 0.5 + over * 0.7], armOut: [0, over * 0.5], look: down * -0.1 + over * 0.35 };
      }
      case 'water': {
        if (done) {
          this.next();
          return {};
        }
        if (s.fill) {
          // the can down by the well's bucket, and it fills
          this.tilt(0);
          if (t > 1 && t - dt <= 1) this.onSound?.('plop', this.position);
          return { lean: 0.2, crouch: 0.05, arm: [0.3, 0.3], look: 0.1 };
        }
        // held out in front, and the can tipped forward in its grip till the rose points down
        const tip = ease(t, 0, 1) * (1 - ease(t, s.work - 1, s.work));
        const arm = 0.25 + tip * 0.55;
        this.tilt(arm + tip * 0.75);
        if (tip > 0.6 && this.spout) this.pour(dt);
        return { lean: 0.08, arm: [0.2, arm], look: Math.sin(t * 0.8) * 0.15 };
      }
      case 'mow':
        if (done) this.next();
        return { arm: [0.98, 0.98], lean: 0.08, swing: 0 };
      case 'sea': {
        if (s.work < 1) {
          this.next();
          return {};
        }
        // sits down on the edge, legs over, feet going; looks about; gets up again at the end
        const sit = ease(t, 0.2, 1.4) * (1 - ease(t, s.work - 1.4, s.work - 0.2));
        if (done) {
          this.next();
          return {};
        }
        this.noticed = Math.max(0, this.noticed - dt);
        const swing = sit * 0.35;
        const gaze = Math.sin(t * 0.23) * 0.5 + Math.sin(t * 0.61) * 0.2;
        return {
          crouch: SEAT * sit, legs: [sit * 0.6 + Math.sin(t * 2.1) * swing, sit * 0.6 + Math.sin(t * 2.1 + 2.2) * swing],
          arm: [-0.1 * sit, -0.1 * sit], armOut: [0.25 * sit, -0.25 * sit], lean: -0.05 * sit,
          look: this.noticed > 0 ? 1.3 : gaze, plant: 1 - sit, swing: 0,
        };
      }
      case 'stones':
        return this.skimming(dt, done);
      case 'dance':
        return this.dancing(dt, done);
    }
    return {};
  }

  /** The watering can tipped forward in its clamp, radians (0: hanging level). */
  private tilt(a: number) {
    const can = this.tools.get('can');
    if (can) can.rotation.x = this.canRest + a;
  }

  /**
   * Skimming stones: a stone off the sand, a look at the water, the arm back and a flick side-arm,
   * and it goes skipping off (each bounce shorter than the last). A good one, five or more, and
   * its arms go up.
   */
  private skimming(dt: number, done: boolean): Stance {
    const T = 4.6;
    const t = this.t;
    const n = Math.floor(t / T);
    const k = (t % T) / T;
    if (n !== this.cycle) {
      this.cycle = n;
      if (done) {
        this.next();
        return {};
      }
    }
    const bend = ease(k, 0, 0.08) * (1 - ease(k, 0.12, 0.2));
    const back = ease(k, 0.24, 0.36) * (1 - ease(k, 0.38, 0.42));
    const flick = ease(k, 0.38, 0.42) * (1 - ease(k, 0.5, 0.6));
    if (k > 0.41 && k - dt / T <= 0.41) this.throwStone();
    const cheer = this.bounces >= 5 ? ease(k, 0.66, 0.72) * (1 - ease(k, 0.9, 0.97)) : 0;
    const shrug = this.bounces < 5 ? ease(k, 0.68, 0.74) * (1 - ease(k, 0.86, 0.94)) : 0;
    if (cheer > 0.9 && Math.random() < dt * 3) this.body?.kick(1.2);
    const hop = cheer * Math.abs(Math.sin(t * 9)) * 0.07;
    return {
      lean: bend * 0.6 + back * 0.12 - cheer * 0.08, crouch: bend * 0.06 + back * 0.05 - hop,
      arm: [bend * 0.6 + cheer * 2.6 + shrug * 0.4, bend * 0.75 + back * 0.4 + flick * 1.2 + cheer * 2.6 + shrug * 0.4],
      armOut: [cheer * 0.3 + shrug * 0.5, -back * 1.2 + flick * 0.9 - cheer * 0.3 - shrug * 0.5],
      look: -back * 0.5 + flick * 0.2 + (k > 0.45 && k < 0.7 ? 0.15 : 0), plant: 1, swing: 0,
    };
  }

  /** Off it goes: two to eight bounces out over the water, each shorter than the one before. */
  private throwStone() {
    const out = V(Math.sin(this.heading), 0, Math.cos(this.heading));
    const d0 = this.seaAhead(this.position);
    if (d0 <= 0) return;
    this.bounces = 2 + Math.floor(Math.random() ** 0.8 * 7);
    let d = d0 + rand(0.5, 1.2);
    let gap = rand(1.6, 2.2);
    let when = this.clock + 0.25;
    for (let i = 0; i < this.bounces; i++) {
      const at = this.position.clone().addScaledVector(out, d);
      at.y = 0.05;
      this.skips.push({ at, when, last: i === this.bounces - 1 });
      d += gap;
      when += 0.12 + gap * 0.09;
      gap *= 0.78;
    }
  }

  /** The stone's bounces as they come, each a little splash (and the last a plop as it goes in). */
  private splashes() {
    this.skips = this.skips.filter((s) => {
      if (s.when > this.clock) return true;
      for (let i = 0; i < (s.last ? 8 : 4); i++) {
        this.particles.emit({ position: s.at.clone(), velocity: V(rand(-0.4, 0.4), rand(0.5, s.last ? 1.4 : 0.9), rand(-0.4, 0.4)), color: pick(['#e6f5ff', '#ffffff', '#bfe3ff']), life: rand(0.3, 0.55), size: 1, gravity: -6 });
      }
      if (s.last) this.onSound?.('plop', s.at);
      return false;
    });
  }

  /** How far in front of it the sea starts (0 if there's no water within a few metres). */
  private seaAhead(at: THREE.Vector3, dir = V(Math.sin(this.heading), 0, Math.cos(this.heading))) {
    for (let d = 0.5; d < 6; d += 0.25) {
      const p = at.clone().addScaledVector(dir, d);
      const y = this.ground.at(p.x, p.z);
      if (Number.isNaN(y) || y < 0.1) return d;
    }
    return 0;
  }

  /**
   * Dancing by the fire while he plays: a bob on every beat with the arms going in turn, a bit of
   * the robot (of course), and now and then a spin.
   */
  private dancing(dt: number, done: boolean): Stance {
    if (done) {
      this.next();
      return {};
    }
    this.noticed = Math.max(0, this.noticed - dt);
    const b = this.t * BEAT;
    const move = Math.floor(b / 8) % 4;
    const step = Math.abs(Math.sin(b * Math.PI));
    if (Math.floor(b) !== Math.floor(b - dt * BEAT)) this.body?.kick(0.7); // the antenna, on the beat
    const look = this.noticed > 0 ? 1.1 : 0;
    switch (move) {
      case 1: {
        // the robot: arms at right angles, set from one pose to the next on the beat
        const pose = Math.floor(b) % 4;
        const arms = [[1.5, 0], [0, 1.5], [1.5, 1.5], [0.6, 2.4]][pose];
        return { arm: arms, armOut: [0.15, -0.15], look: look || [0.4, -0.4, 0, 0.2][pose], crouch: 0.02, swing: 0, plant: 1 };
      }
      case 3: {
        // round on the spot, a beat or two of it
        if (b % 8 < 2) this.heading += dt * Math.PI * BEAT;
        return { arm: [2.4, 2.4], armOut: [0.3, -0.3], crouch: step * 0.04, swing: 0, plant: 1 };
      }
      default: {
        // a bob on every beat, and the arms up in turn
        const side = Math.floor(b) % 2;
        return {
          crouch: step * 0.06, lean: Math.sin(b * Math.PI) * 0.05, legs: [side ? 0.2 * step : 0, side ? 0 : 0.2 * step],
          arm: [side ? 2.9 : 0.3, side ? 0.3 : 2.9], armOut: [side ? 0.4 : 0, side ? 0 : -0.4], look: look || (side ? 0.3 : -0.3), swing: 0, plant: 1,
        };
      }
    }
  }

  private turnReel(d: number) {
    if (this.reel) this.reel.rotation.x -= d * 8;
  }

  // --- what flies about ----------------------------------------------------------------

  /** Off the broom: dust and grit on the plaza, sand on the pier, petals in the blossom. */
  private dust(at: THREE.Vector3) {
    const colours = season.blossom > 0.3 ? ['#f6c9d6', '#fbe3ea', '#e9a9bd'] : at.y > DECK - 0.1 && at.z > 17 ? ['#dcbd83', '#ecd29d'] : ['#c9b48a', '#b89a6a', '#d8cdb0'];
    for (let i = 0; i < 4; i++) {
      this.particles.emit({ position: at.clone().add(V(rand(-0.2, 0.2), 0.05, rand(-0.2, 0.2))), velocity: V(rand(-0.6, 0.6), rand(0.1, 0.5), rand(-0.6, 0.6)), color: pick(colours), life: rand(0.4, 0.8), size: 1, gravity: -2 });
    }
  }

  /** A shovelful, off to its right. */
  private throwSnow(at: THREE.Vector3) {
    const right = V(-Math.cos(this.heading), 0, Math.sin(this.heading));
    for (let i = 0; i < 12; i++) {
      const v = right.clone().multiplyScalar(rand(1.2, 2.2)).add(V(rand(-0.4, 0.4), rand(1, 2), rand(-0.4, 0.4)));
      this.particles.emit({ position: at.clone().add(V(0, 0.6, 0)), velocity: v, color: pick(['#eef3fa', '#e9f0f7', '#c9d6e6']), life: rand(0.5, 0.9), size: Math.random() < 0.4 ? 2 : 1, gravity: -7 });
    }
    this.onSound?.('crunch', at);
  }

  /** Water out of the rose, in a fan of drops onto the roots. */
  private pour(dt: number) {
    const at = this.spout!.getWorldPosition(V());
    const out = V(Math.sin(this.heading), 0, Math.cos(this.heading));
    for (let n = Math.round(dt * 40 + Math.random()); n > 0; n--) {
      this.particles.emit({ position: at.clone(), velocity: out.clone().multiplyScalar(rand(0.3, 0.7)).add(V(rand(-0.15, 0.15), rand(-0.3, 0.1), rand(-0.15, 0.15))), color: pick(['#bfe3ff', '#e6f5ff', '#9dd0f5']), life: rand(0.3, 0.5), size: 1, gravity: -9 });
    }
  }

  /** Grass cuttings off the front of the mower as it goes. */
  private clippings(dt: number) {
    if (Math.random() > dt * 14) return;
    const out = V(Math.sin(this.heading), 0, Math.cos(this.heading));
    const at = this.position.clone().addScaledVector(out, 0.85).add(V(0, 0.15, 0));
    this.particles.emit({ position: at, velocity: out.multiplyScalar(rand(0.4, 0.9)).add(V(rand(-0.4, 0.4), rand(0.6, 1.2), rand(-0.4, 0.4))), color: pick(['#6fa847', '#8cc05a', '#5a9a3e']), life: rand(0.4, 0.7), size: 1, gravity: -6 });
  }

  /** Whether you'd see it standing at `at` from the island's camera (camera-rig.ts, looking north): no tree, wall or hill in between. */
  private inView(at: THREE.Vector3) {
    const back = V(0, Math.sin(VIEW), Math.cos(VIEW));
    for (const h of [0.4, 1.1]) {
      this.ray.set(at.clone().add(V(0, h, 0)), back);
      const hit = this.ray.intersectObject(this.island.root, true).find((x) => (x.object as THREE.Mesh).isMesh && !this.isMine(x.object));
      if (hit) return false;
      // (the leaves on the trees are drawn by foliage.ts, not in the model: their crowns, then)
      for (let d = 0.5; d < 16; d += 0.5) {
        const p = this.ray.ray.origin.clone().addScaledVector(back, d);
        if (this.island.canopies.some((c) => c.position.distanceTo(p) < c.radius * 1.05)) return false;
      }
    }
    return true;
  }

  private isMine(o: THREE.Object3D | null): boolean {
    return !!o && (o === this.root || this.isMine(o.parent));
  }

  /** A spot on the ground (Blender x, y), or up on the pier's boards ("deck"). */
  private on([x, y, deck]: [number, number, string?]): Waypoint {
    return deck === 'deck' ? { at: V(x, DECK, -y), fixed: true } : { at: V(x, this.ground.at(x, -y), -y), fixed: false };
  }
}
