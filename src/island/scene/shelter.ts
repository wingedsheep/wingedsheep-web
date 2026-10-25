import * as THREE from 'three';
import { games } from './boardgames';
import type { Beike, Ground } from './beike';
import { FieldMouse, type Patch } from './fieldmouse';
import type { Island } from './island';
import { petting } from './petting';

const damp = THREE.MathUtils.damp;
const ease = THREE.MathUtils.smootherstep;

const GO_IN = 0.1; // rain (0..1) that sends them indoors…
const COME_OUT = 0.04; // …and how far it has to ease off before they come back out
const HOP = 1.05; // seconds to jump down off the bench (or back up): a crouch, the jump itself, and the landing
const step = (a: number, b: number, x: number) => THREE.MathUtils.smootherstep(x, a, b);
const TURN = 8;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Who's indoors right now, by id ("charlie", "george", "cat", "beike"): the rooms show them there. */
export const indoors = new Set<string>();

/** Which cats are flat out in the heat, by id (content.ts says so when you click them). */
export const flatOut = new Set<string>();

/** Which cats are back on the bench from the meadow with a mouse, by id (till they next get up). */
export const proud = new Set<string>();

/**
 * Charlie's ambush in the lighthouse (quarters.ts), while Vincent's at his desk: one tiny mew,
 * and then he's on Vincent's back, claws and all. `on` while he's up there.
 */
export const ambush = { on: false };

/** Vincent's coffee at his desk (quarters.ts): full, drunk, or on its way back from the machine. */
export const coffee = {
  at: 'table' as 'table' | 'full' | 'empty',
  /** What he's up to: at the desk, off for a refill, at the machine, or back with it. */
  trip: 'desk' as 'desk' | 'go' | 'brew' | 'back',
  /** Mid-sip. */
  sip: false,
};

/** A point on the way indoors (tools/models/layout.py SHELTER); `fixed` ones are up on the pier or a plinth. */
export interface Waypoint {
  at: THREE.Vector3;
  fixed: boolean;
}

/** Height to stand at between `a` and `b`: the ground, unless one end is up on the pier's deck or a plinth. */
export function heightBetween(a: Waypoint, b: Waypoint, p: THREE.Vector3, ground: Ground) {
  if (!a.fixed && !b.fixed) return ground.at(p.x, p.z);
  const dx = b.at.x - a.at.x;
  const dz = b.at.z - a.at.z;
  const k = THREE.MathUtils.clamp(((p.x - a.at.x) * dx + (p.z - a.at.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  const ya = a.fixed ? a.at.y : ground.at(a.at.x, a.at.z);
  const yb = b.fixed ? b.at.y : ground.at(b.at.x, b.at.z);
  return ya + (yb - ya) * k;
}

// 'cool' and 'warm': down off the bench onto the stones under it in the heat, and back up.
// The rest are a move to somewhere else to sleep (Shelter.roam): a stretch where it lay, the jump
// down, the walk over, the jump up, and round in a circle or two before it curls up.
// The hunt (Shelter.roam, now and then, George only): out into the meadow at a stroll, then
// 'stalk' (belly to the grass, a few steps at a time), 'freeze' (dead still, then the wiggle) and
// 'pounce'. The mouse (fieldmouse.ts) is out from under his paws, and it's a 'chase', bounding
// after it, with a 'spring' each time it stops dead, till he has it or it's gone ('lost'). Then
// 'pin' (nose in the grass), and 'proud' with it, carried home to be put down at the bench
// ('gift'), or 'groom', as if he'd meant to miss.
type Phase = 'asleep' | 'down' | 'in' | 'inside' | 'out' | 'up' | 'cool' | 'warm'
  | 'stretch' | 'leave' | 'roam' | 'arrive' | 'circle' | 'away'
  | 'stalk' | 'freeze' | 'pounce' | 'chase' | 'spring' | 'lost' | 'pin' | 'proud' | 'groom' | 'gift';

const HOT = 0.55; // heat (0..1) that has them down on the cool stones…
const COOLER = 0.4; // …and back up on the fleece once it's this much cooler
const STRETCH = 1.8; // seconds for the stretch before it sets off: front paws out, bottom up, then a yawn
const CIRCLE = 1.9; // seconds going round on the spot before it lies down
const STROLL = 0.75; // how fast it goes, moving house, against its trot in the rain
const CREEP = 0.22; // m/s, stalking
const SPRING = 1.1; // how far it pounces from (m)
const CHASE = 2.3; // m/s, bounding after it
const REACH = 0.9; // how close he has to be when it stops to spring at it (m)

/**
 * Where George listens for mice (Blender x, y): the long grass west of the bench, off the sand,
 * clear of the library's garden and away from Beike's end of the meadow. `patch` (min x, min y,
 * max x, max y) is the grass the mouse keeps to when it runs.
 */
const MEADOW: [number, number, number, number] = [-21.8, -13, -18.6, -10.2];
/** Round the bench's west end on the way out to the meadow and back, not through it. */
const ROUND: [number, number] = [-18.8, -12.3];
const MOUSE_HOLES: { at: [number, number]; patch: [number, number, number, number] }[] = [
  { at: [-21.2, -11.6], patch: MEADOW },
  { at: [-20.4, -12.6], patch: MEADOW },
  { at: [-20.8, -10.7], patch: MEADOW },
];

/** How the hunt goes: nothing there after all, the mouse gets away, or he has it. */
type Outcome = 'empty' | 'miss' | 'catch';

interface CatSpec {
  id: string;
  route: string;
  speed: number; // m/s
  delay: number; // seconds after the rain comes (or goes) before this one gets up
  curl?: number; // how much of its size it has just up from asleep, growing out of a curled-up ball (default 0.62)
  front?: number; // jumps down this far in front of where it sleeps (off the bench)
}

/**
 * Where Charlie or George sleeps besides the bench (Blender x, y): the library's front step,
 * across the game of Magic, in the warm by the fire of an evening, on the lighthouse doorstep,
 * or indoors: on the library's hearth, or in the hammock in the workshop. `on` is what they're
 * lying on (a named thing, or an object by name); `way` the path from there to the bench's route
 * in, which it joins at `join`. Its first point is where they land jumping down, unless they
 * sleep on the floor they walk on (`hop: false`). The ones in a `room` are a jump up onto the
 * doorstep and in; that room shows them asleep inside (`<cat>_<room>` in `indoors`).
 */
export type Nook = 'bench' | 'library' | 'cards' | 'fire' | 'doorstep' | 'hearth' | 'workshop';
interface NookSpec {
  at: [number, number];
  on: string;
  yaw: number;
  hop: boolean;
  way: [number, number][];
  join: number;
  evening?: boolean; // only of an evening, when the fire's worth sitting by
  room?: 'library' | 'workshop';
}
const NOOKS: Record<Exclude<Nook, 'bench'>, NookSpec> = {
  library: { at: [-11.2, -8.1], on: 'library', yaw: 0.2, hop: true, way: [[-11.2, -9.3], [-14.8, -9.9]], join: 1 },
  cards: {
    at: [6.3, -9.1], on: 'card_table', yaw: 0.5, hop: true,
    way: [[6.3, -10.3], [3.6, -10.2], [-3, -9.8], [-8.5, -10.5], [-14.8, -9.9]], join: 1,
  },
  fire: {
    at: [26.4, -2.6], on: 'terrain', yaw: 0.4, hop: false, evening: true,
    way: [[24.8, -4.3], [21, -6], [15, -10.5], [9, -11], [3.6, -10.2], [-3, -9.8], [-8.5, -10.5], [-14.8, -9.9]], join: 1,
  },
  doorstep: { at: [-30.9, -4.3], on: 'lighthouse', yaw: -0.2, hop: false, way: [], join: 6 },
  hearth: { at: [-10.6, -7.85], on: 'library', yaw: 1.6, hop: true, way: [[-10.6, -9.2], [-14.8, -9.9]], join: 1, room: 'library' },
  workshop: {
    at: [11.5, -7.7], on: 'workshop', yaw: 1.6, hop: true, room: 'workshop',
    way: [[11.5, -8.7], [8, -8.4], [4.6, -8.5], [3.6, -10.2], [-3, -9.8], [-8.5, -10.5], [-14.8, -9.9]], join: 1,
  },
};

/** Where Charlie and George are asleep right now (content.ts says so when you click them). */
export const beds: Record<'charlie' | 'george', Nook> = { charlie: 'bench', george: 'bench' };

/**
 * How much each would rather sleep there, at `hour`: the bench most of all; the library step in
 * the morning sun; the fire only of an evening; the library hearth on a cold day; and wherever
 * someone's in, for the company (him at the boat or her at her painting in the workshop, either
 * of them reading in the library).
 */
function liking(n: Nook, hour: number, hot: number): number {
  const evening = hour >= 18 || hour < 1;
  switch (n) {
    case 'bench': return 2.6;
    case 'library': return hour >= 7 && hour < 12 ? 1.4 : 0.6;
    case 'cards': return games.game && !games.indoors ? 0 : hour >= 12 && hour < 19 ? 1.1 : 0.5; // not with a game on it
    case 'fire': return evening ? 2 : 0;
    case 'doorstep': return 0.8;
    case 'hearth': return (0.5 + (1 - hot) * 0.6) * (indoors.has('companion_library') || indoors.has('vincent_library') ? 4 : 1);
    case 'workshop': return 0.5 * (indoors.has('vincent_workshop') || indoors.has('companion_workshop') ? 5 : 1);
  }
}

/**
 * Mostly the bench. Now and then one of them (once in a while both) has found somewhere else to
 * sleep today, and over the day they move on (Shelter.roam). To preview: ?charlie=cards,
 * ?george=workshop (any Nook).
 */
function chooseBeds(hour: number) {
  const q = new URLSearchParams(location.search);
  const open = (Object.keys(NOOKS) as Exclude<Nook, 'bench'>[]).filter((n) => !NOOKS[n].evening || hour >= 18);
  const pick = () => open.splice(Math.floor(Math.random() * open.length), 1)[0];
  const cats = (['charlie', 'george'] as const).slice();
  if (Math.random() < 0.3) {
    if (Math.random() < 0.5) cats.reverse();
    beds[cats[0]] = pick();
    if (Math.random() < 0.3) beds[cats[1]] = pick();
  }
  for (const id of cats) {
    const n = q.get(id) as Nook | null;
    if (n && (n === 'bench' || n in NOOKS)) beds[id] = n;
  }
  if (q.get('cats') === 'mouse') beds.george = 'bench'; // he goes mousing from the bench
}

/** A way to walk, and how far along it each point is. */
class Path {
  readonly lengths: number[] = [0];
  constructor(readonly points: Waypoint[]) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1].at;
      const b = points[i].at;
      this.lengths.push(this.lengths[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
  }

  get end() {
    return this.lengths[this.lengths.length - 1];
  }

  segment(s: number) {
    let i = 1;
    while (i < this.lengths.length - 1 && this.lengths[i] < s) i++;
    return i;
  }

  /** Where `s` metres along is, on the ground (or the deck). */
  place(s: number, out: THREE.Vector3, ground: Ground) {
    const i = this.segment(s);
    const a = this.points[i - 1];
    const b = this.points[i] ?? a;
    const k = (s - this.lengths[i - 1]) / (this.lengths[i] - this.lengths[i - 1] || 1);
    out.lerpVectors(a.at, b.at, THREE.MathUtils.clamp(k, 0, 1));
    out.y = heightBetween(a, b, out, ground);
  }

  /** Which way it's facing `s` metres along, going forwards (`dir` 1) or back. */
  heading(s: number, dir: number) {
    const i = this.segment(s);
    const a = this.points[i - 1].at;
    const b = (this.points[i] ?? this.points[i - 1]).at;
    return dir > 0 ? headingTo(a, b) : headingTo(b, a);
  }
}

function headingTo(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.atan2(-(b.z - a.z), b.x - a.x); // the model faces +x
}

/**
 * Somewhere a cat sleeps: where (`seat`, and how its sleeping model sits there, `position` and
 * `rotation` in its parent), and its way in to the lighthouse from there (`route`), which is
 * `lead` and then the bench's route from `join` on.
 */
interface Bed {
  nook: Nook;
  seat: THREE.Vector3;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  lead: Waypoint[];
  join: number;
  route: Waypoint[];
  hop: boolean;
  room?: 'library' | 'workshop';
  /** Under the bench, on the flagstones, for a hot day (the bench only). */
  cool: THREE.Vector3 | null;
}

/**
 * The bed in `n` for `sleeper` (null if the nook isn't on this island): found by dropping down
 * onto whatever's there, so as to land on the step and not the eaves over it.
 */
function nookBed(island: Island, sleeper: THREE.Object3D, nook: Exclude<Nook, 'bench'>, bench: Waypoint[], ground: Ground): Bed | null {
  const n = NOOKS[nook];
  const [x, y] = n.at;
  const spot = new THREE.Vector3(x, 0, -y);
  const on = island.get(n.on) ?? island.root.getObjectByName(n.on);
  if (!on || !sleeper.parent) return null;
  on.updateWorldMatrix(true, true);
  const from = spot.clone().setY(ground.at(spot.x, spot.z) + 1.5);
  const hit = new THREE.Raycaster(from, new THREE.Vector3(0, -1, 0)).intersectObject(on, true)[0];
  if (!hit) return null;
  const way = n.way.map(([x, y]) => ({ at: new THREE.Vector3(x, ground.at(x, -y), -y), fixed: false }));
  const lead = n.hop ? way : [{ at: hit.point.clone(), fixed: true }, ...way];
  return {
    nook, seat: hit.point.clone(), position: sleeper.parent.worldToLocal(hit.point.clone()), rotation: new THREE.Euler(0, n.yaw, 0),
    lead, join: n.join, route: [...lead, ...bench.slice(n.join)], hop: n.hop, room: n.room, cool: null,
  };
}

/** The bench, where `sleeper` was put in Blender: jumping down `front` in front of it. */
function benchBed(sleeper: THREE.Object3D, front: number | undefined, bench: Waypoint[], ground: Ground): Bed {
  const seat = sleeper.getWorldPosition(new THREE.Vector3());
  const lead: Waypoint[] = [];
  let cool: THREE.Vector3 | null = null;
  if (front) {
    // the cat's frame faces -y in Blender, which is +z here
    const ahead = new THREE.Vector3(0, 0, 1).applyQuaternion(sleeper.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
    const at = seat.clone().addScaledVector(ahead, front);
    lead.push({ at: at.setY(ground.at(at.x, at.z)), fixed: false });
    // half under the seat, on the stones the bench stands on (its foot is 0.56 below the fleece)
    cool = seat.clone().addScaledVector(ahead, 0.3);
    cool.y -= 0.56 - 0.045;
  }
  return {
    nook: 'bench', seat, position: sleeper.position.clone(), rotation: sleeper.rotation.clone(),
    lead, join: 0, route: [...lead, ...bench], hop: true, cool,
  };
}

/**
 * The way from bed `a` to bed `b`: out along `a`'s lead, along the bench's route as far as `b`'s
 * joins it (each lead joins between the route's points join − 1 and join), and in along `b`'s.
 */
function between(a: Bed, b: Bed, bench: Waypoint[]): Waypoint[] {
  const via: Waypoint[] = [];
  if (a.join > b.join) for (let i = a.join - 1; i >= b.join; i--) via.push(bench[i]);
  else for (let i = a.join; i < b.join; i++) via.push(bench[i]);
  return [...a.lead, ...via, ...[...b.lead].reverse()];
}

const CATS: CatSpec[] = [
  { id: 'charlie', route: 'bench', speed: 1.7, delay: 0.6, front: 0.8 }, // first to notice
  { id: 'george', route: 'bench', speed: 1.35, delay: 2.4, front: 0.8, curl: 0.94 }, // not in a hurry, ever; sleeps sprawled out, not curled up
  { id: 'cat', route: 'dock', speed: 2.4, delay: 1.2 }, // a long way up to the hut
];

/**
 * One of the cats: asleep where it always is, until the rain comes. Then the sleeping model
 * makes way for one up on its feet ("<id>_walk"), which jumps down, trots along its route and
 * slips in through a door. When the rain stops it comes back out the same way and settles down.
 * Charlie and George also move house over the day (`roam`): up, a stretch, and off at a stroll.
 */
class Cat {
  private phase: Phase = 'asleep';
  private wait = 0;
  private t = 0; // through a jump, a stretch or a circle, 0..1
  private s = 0; // metres along the route
  private heading = 0;
  private stride = 0;
  private route: Path;
  /** Moving house: the way over, and the bed at the end of it. */
  private trip: Path | null = null;
  private next: Bed | null = null;
  private turnFrom = 0;
  private parts: { body?: THREE.Object3D; head?: THREE.Object3D; tail?: THREE.Object3D; legs: THREE.Object3D[] };
  private rest = new Map<THREE.Object3D, THREE.Euler>();
  private bodyY = 0;
  /** On the flagstones under the bench, flat out (in the heat); the dock cat just flattens where it is. */
  private sprawled = false;
  private heatWait = 0;
  private restScale: THREE.Vector3;
  private baseScale: THREE.Vector3;
  /** How a jump looks, 0..1 each: gathered to spring, stretched in the air, squashed on landing, and how much of its size it has (it grows out of the curled-up cat). */
  private crouch = 0;
  private air = 0;
  private land = 0;
  private morph = 1;
  private wiggle = 0;
  /** A stretch (0..1: paws out and bottom up) and a yawn after it (0..1). */
  private reach = 0;
  private yawn = 0;
  /** Seconds it's been settled where it is, and how long it means to stay. */
  idle = 0;
  stay = rand(150, 420);
  /**
   * Out after a mouse: where it is, where the cat creeps to before it freezes, the grass it runs
   * in, how it goes, and the chase: springs so far, the one that gets it, where this one's from
   * and to, and whether he has it (and has given it to you).
   */
  private mouse: {
    at: THREE.Vector3; from: THREE.Vector3; patch: Patch; outcome: Outcome;
    springs: number; catchOn: number; start: THREE.Vector3; target: THREE.Vector3; caught: boolean; given: boolean;
  } | null = null;
  /** The mouse itself (George's), hidden till he pounces. */
  field?: FieldMouse;
  /** Down in the grass (0..1), the wiggle before a pounce, and licking a paw. */
  private low = 0;
  private bound = 0; // flat out after it, a gallop
  private shimmy = 0;
  private lick = 0;
  private chin = 0; // head up, pleased with itself
  private look = 0; // head turned, looking for it (radians)
  private clock = 0;
  /** A pounce lands, at: a few bits of grass go up (Life). */
  onPounce?: (at: THREE.Vector3) => void;

  constructor(
    private spec: CatSpec,
    private sleeper: THREE.Object3D,
    private walker: THREE.Object3D,
    public bed: Bed,
    private ground: Ground,
  ) {
    this.route = new Path(bed.route);
    this.restScale = sleeper.scale.clone();
    this.baseScale = walker.scale.clone();
    this.lieIn(bed);
    walker.visible = false;
    if (bed.room) {
      this.phase = 'away';
      sleeper.visible = false;
    }
    const part = (name: string) => {
      const o = walker.getObjectByName(`${spec.id}_walk_${name}`);
      if (o) this.rest.set(o, o.rotation.clone());
      return o;
    };
    this.parts = {
      body: part('body'),
      head: part('head'),
      tail: part('tail'),
      legs: ['fl', 'fr', 'bl', 'br'].map((n) => part(`leg_${n}`)).filter((o): o is THREE.Object3D => !!o),
    };
    this.bodyY = this.parts.body?.position.y ?? 0;
  }

  get id() {
    return this.spec.id;
  }

  private get curl() {
    return this.spec.curl ?? 0.62;
  }

  /** In the lighthouse (not another room). */
  get inside() {
    return this.phase === 'inside';
  }

  /** Asleep in another room (the library, the workshop), if it is. */
  get room() {
    return this.phase === 'away' ? this.bed.room : undefined;
  }

  get seat() {
    return this.bed.seat;
  }

  get onBench() {
    return this.bed.nook === 'bench';
  }

  /** Asleep in its usual spot (not down on the stones in the heat). */
  get asleep() {
    return this.phase === 'asleep' && !this.sprawled;
  }

  /** Settled where it sleeps (here or in another room), so it could get up and move house. */
  get settled() {
    return (this.phase === 'asleep' && !this.sprawled) || this.phase === 'away';
  }

  /** Put the sleeping model down in `bed`: it's there now. */
  private lieIn(bed: Bed) {
    this.bed = bed;
    this.route = new Path(bed.route);
    this.sleeper.position.copy(bed.position);
    this.sleeper.rotation.copy(bed.rotation);
    this.sleeper.scale.copy(this.restScale);
    if (this.spec.id in beds) beds[this.spec.id as keyof typeof beds] = bed.nook;
  }

  /** Straight to where the weather says it should be, no walking (on arrival, or with reduced motion). */
  snap(wantIn: boolean, hot = 0) {
    if (this.next) this.lieIn(this.next); // halfway across: it's there
    if (this.mouse) this.field?.hide();
    this.next = this.trip = this.mouse = null;
    const away = !!this.bed.room;
    this.phase = away ? 'away' : wantIn ? 'inside' : 'asleep';
    this.sprawl(this.phase === 'asleep' && hot > HOT);
    this.sleeper.visible = this.phase === 'asleep';
    this.walker.visible = false;
    this.wait = 0;
  }

  /** Flat out on the cool stones (or back on the fleece): the sleeping model, moved and squashed. */
  private sprawl(on: boolean) {
    this.sprawled = on;
    if (on) flatOut.add(this.spec.id);
    else flatOut.delete(this.spec.id);
    const s = this.sleeper;
    const cool = this.bed.cool;
    if (on && cool) s.position.copy(s.parent ? s.parent.worldToLocal(cool.clone()) : cool);
    else s.position.copy(this.bed.position);
    s.scale.copy(this.restScale);
    if (on) s.scale.multiply(new THREE.Vector3(1.15, 0.72, 1.1)); // stretched long and flat, belly to the stone
  }

  /** Up, and off to sleep in `bed` instead, along `way` (which starts where it lands jumping down). */
  roam(bed: Bed, way: Waypoint[]) {
    proud.delete(this.spec.id);
    this.next = bed;
    this.trip = new Path(way);
    this.idle = 0;
    this.stay = rand(150, 420);
    this.sprawl(false);
    this.sleeper.visible = false;
    this.walker.visible = true;
    this.t = 0;
    this.s = 0;
    if (this.phase === 'away') {
      // out of the door, onto the step, and down off it
      this.walker.position.copy(this.bed.seat);
      this.heading = headingTo(this.bed.seat, way[0].at);
      this.phase = 'leave';
    } else {
      this.walker.position.copy(this.bed.seat);
      this.heading = this.bed.hop ? headingTo(this.bed.seat, way[0].at) : this.trip.heading(0, 1); // stretching the way it's going
      this.phase = 'stretch';
    }
  }

  /**
   * Up off the bench and out into the meadow after a mouse at `hole`: a stroll to a few metres
   * off, then the stalk. Afterwards (`next`) it's back to the bench. Only from the bench.
   */
  hunt(hole: THREE.Vector3, patch: Patch, outcome: Outcome) {
    const start = this.bed.lead[0];
    if (!start) return;
    const round = this.corner();
    const dir = hole.clone().sub(round.at).setY(0).normalize();
    const from = hole.clone().addScaledVector(dir, -SPRING);
    const near = from.clone().addScaledVector(dir, -1.6);
    near.y = this.ground.at(near.x, near.z);
    this.roam(this.bed, [start, round, { at: near, fixed: false }]);
    this.next = null;
    this.mouse = {
      at: hole, from, patch, outcome: this.field ? outcome : 'empty',
      springs: 0, catchOn: outcome === 'catch' ? 3 + Math.floor(Math.random() * 2) : 99, // never first time
      start: new THREE.Vector3(), target: new THREE.Vector3(), caught: false, given: false,
    };
  }

  update(dt: number, wantIn: boolean, hot = 0) {
    const end = this.route.end;
    let moving = false;
    let pace = this.spec.speed;
    this.clock += dt;
    this.crouch = this.air = this.land = this.reach = this.yawn = 0;
    this.low = this.shimmy = this.lick = this.chin = this.bound = this.look = 0;
    this.morph = 1;
    if (this.phase === 'asleep' && !wantIn) {
      const want = this.sprawled ? hot > COOLER : hot > HOT;
      if (want !== this.sprawled) {
        if (!this.bed.cool) this.sprawl(want); // nowhere to go: it just flattens out where it is
        else if ((this.heatWait += dt) > this.spec.delay * 4) {
          this.heatWait = 0;
          this.sleeper.visible = false;
          this.walker.visible = true;
          this.phase = want ? 'cool' : 'warm';
          this.t = 0;
          this.sprawl(false);
        }
      } else this.heatWait = 0;
    }
    switch (this.phase) {
      case 'cool':
      case 'warm': {
        this.t += dt / HOP;
        const [from, to] = this.phase === 'cool' ? [this.seat, this.bed.cool!] : [this.bed.cool!, this.seat];
        const k = Math.min(1, this.t);
        this.leap(k, from, to, 0.25, this.phase === 'cool');
        this.turn(headingTo(this.seat, this.bed.cool!), dt);
        if (k < 1) break;
        this.walker.visible = false;
        this.sleeper.visible = true;
        this.sprawl(this.phase === 'cool');
        this.phase = 'asleep';
        break;
      }
      case 'away':
        return; // asleep in another room: dry in there, whatever the weather
      case 'asleep':
      case 'inside': {
        const settled = (this.phase === 'inside') === wantIn;
        this.wait = settled ? 0 : this.wait + dt;
        if (this.wait < this.spec.delay) return;
        this.wait = 0;
        this.sleeper.visible = false;
        this.walker.visible = true;
        const first = this.route.points[0].at;
        if (this.phase === 'asleep' && this.sprawled && this.bed.cool) {
          // off the stones, no jump: already on the ground
          this.sprawl(false);
          this.phase = 'in';
          this.s = 0;
          this.walker.position.copy(this.bed.cool);
          this.heading = headingTo(this.bed.cool, first);
        } else if (this.phase === 'asleep' && !this.bed.hop) {
          this.sprawl(false);
          this.phase = 'in';
          this.s = 0;
          this.heading = this.route.heading(0, 1);
        } else if (this.phase === 'asleep') {
          this.sprawl(false);
          this.phase = 'down';
          this.t = 0;
          this.heading = headingTo(this.seat, first);
        } else {
          this.phase = 'out';
          this.s = end;
          this.heading = this.route.heading(end, -1);
        }
        break;
      }
      case 'down':
      case 'up': {
        this.t += dt / HOP;
        const down = this.phase === 'down';
        const first = this.route.points[0].at;
        const [from, to] = down ? [this.seat, first] : [first, this.seat];
        const k = Math.min(1, this.t);
        this.leap(k, from, to, 0.3 + Math.max(0, to.y - from.y) * 0.6, down);
        this.turn(headingTo(from, to), dt);
        if (k < 1) break;
        if (down) {
          this.phase = wantIn ? 'in' : 'out';
          this.s = 0;
        } else {
          this.phase = 'asleep';
          this.walker.visible = false;
          this.sleeper.visible = true;
        }
        break;
      }
      case 'in':
      case 'out': {
        if (this.phase === 'in' && !wantIn) this.phase = 'out'; // turned round on the way: it's stopped
        else if (this.phase === 'out' && wantIn) this.phase = 'in';
        const dir = this.phase === 'in' ? 1 : -1;
        this.s = THREE.MathUtils.clamp(this.s + dir * this.spec.speed * dt, 0, end);
        this.route.place(this.s, this.walker.position, this.ground);
        this.turn(this.route.heading(this.s, dir), dt);
        this.stride += this.spec.speed * dt * 9;
        moving = true;
        if (dir > 0 && this.s >= end) {
          this.phase = 'inside';
          this.walker.visible = false;
        } else if (dir < 0 && this.s <= 0 && this.bed.hop) {
          this.phase = 'up';
          this.t = 0;
        } else if (dir < 0 && this.s <= 0) {
          this.phase = 'asleep';
          this.walker.visible = false;
          this.sleeper.visible = true;
        }
        break;
      }
      // --- moving house ---
      case 'stretch': {
        this.t += dt / STRETCH;
        const k = Math.min(1, this.t);
        this.morph = this.curl + (1 - this.curl) * step(0, 0.15, k); // up out of the curl
        this.reach = step(0.1, 0.35, k) * (1 - step(0.6, 0.8, k));
        this.yawn = step(0.62, 0.72, k) * (1 - step(0.86, 0.98, k));
        if (k < 1) break;
        this.t = 0;
        this.phase = this.bed.hop ? 'leave' : 'roam';
        break;
      }
      case 'leave': {
        // down off where it slept, onto the start of the way over
        this.t += dt / HOP;
        const to = this.trip!.points[0].at;
        const k = Math.min(1, this.t);
        this.leap(k, this.seat, to, 0.3, false);
        this.morph = 1;
        this.turn(headingTo(this.seat, to), dt);
        if (k < 1) break;
        this.phase = 'roam';
        this.s = 0;
        break;
      }
      case 'roam': {
        const trip = this.trip!;
        pace = this.spec.speed * STROLL;
        this.s = Math.min(this.s + pace * dt, trip.end);
        trip.place(this.s, this.walker.position, this.ground);
        this.turn(trip.heading(this.s, 1), dt);
        this.stride += pace * dt * 9;
        moving = true;
        if (this.mouse?.caught) this.chin = 0.7; // head up, with it
        if (this.s < trip.end) break;
        this.t = 0;
        if (!this.next) {
          this.phase = 'stalk'; // there: down into the grass
          break;
        }
        if (this.mouse?.caught && !this.mouse.given) {
          this.phase = 'gift'; // at the foot of the bench: put it down first
          break;
        }
        this.settleIn();
        break;
      }
      case 'arrive': {
        // up onto the step, the cards or the doorstep
        this.t += dt / HOP;
        const from = this.trip!.points[this.trip!.points.length - 1].at;
        const k = Math.min(1, this.t);
        this.leap(k, from, this.seat, 0.3 + Math.max(0, this.seat.y - from.y) * 0.6, false);
        this.morph = 1;
        this.turn(headingTo(from, this.seat), dt);
        if (k < 1) break;
        this.t = 0;
        this.turnFrom = this.heading;
        if (this.bed.room) {
          // and in through the door
          this.phase = 'away';
          this.walker.visible = false;
          this.next = this.trip = null;
        } else this.phase = 'circle';
        break;
      }
      case 'circle': {
        // round once and a bit, treading the spot down, and down it goes
        this.t += dt / CIRCLE;
        const k = Math.min(1, this.t);
        this.heading = this.turnFrom + Math.PI * 2.5 * step(0, 0.8, k);
        this.walker.position.copy(this.seat);
        this.stride += dt * 7 * (1 - step(0.7, 0.85, k));
        moving = k < 0.8;
        this.crouch = step(0.75, 0.95, k) * 0.6;
        this.morph = 1 - (1 - this.curl) * step(0.82, 1, k);
        if (k < 1) break;
        this.next = this.trip = null;
        this.phase = 'asleep';
        this.walker.visible = false;
        this.sleeper.visible = true;
        break;
      }
      // --- after a mouse ---
      case 'stalk': {
        // a few steps, belly low, then still; a few more
        const m = this.mouse!;
        this.t += dt;
        this.low = Math.min(1, this.t * 2);
        const go = Math.sin(this.t * 1.7) > -0.2;
        const p = this.walker.position;
        const left = Math.hypot(m.from.x - p.x, m.from.z - p.z);
        const d = Math.min(left, go ? CREEP * dt : 0);
        p.x += ((m.from.x - p.x) / (left || 1)) * d;
        p.z += ((m.from.z - p.z) / (left || 1)) * d;
        p.y = this.ground.at(p.x, p.z);
        this.turn(headingTo(p, m.at), dt);
        pace = CREEP;
        moving = go && left > 0.01;
        this.stride += d * 14;
        if (left > 0.01) break;
        this.phase = 'freeze';
        this.t = 0;
        this.wait = rand(2.5, 5.5);
        break;
      }
      case 'freeze': {
        // dead still, eyes on the spot; then the back end goes, side to side
        this.t += dt;
        this.low = 1;
        this.turn(headingTo(this.walker.position, this.mouse!.at), dt);
        this.shimmy = step(this.wait - 1.4, this.wait - 0.9, this.t);
        if (this.t < this.wait) break;
        this.phase = 'pounce';
        this.t = 0;
        this.turnFrom = this.heading;
        break;
      }
      case 'pounce': {
        const m = this.mouse!;
        this.t += dt / 0.8;
        const k = Math.min(1, this.t);
        this.leap(k, m.from, m.at, 0.4, false);
        this.morph = 1;
        this.low = 1 - this.air;
        if (k < 1) break;
        this.onPounce?.(m.at.clone());
        this.t = 0;
        if (m.outcome === 'empty' || !this.field) {
          this.phase = 'pin';
          break;
        }
        // out from under his paws, and away
        const away = m.at.clone().sub(m.from).setY(0).normalize();
        this.field.bolt(m.at, away, m.patch, m.outcome === 'catch' ? 12 : 7 + Math.floor(Math.random() * 2));
        this.phase = 'chase';
        this.wait = 0.35; // a beat, caught out, before he's after it
        break;
      }
      case 'chase': {
        // bounding after it; when it stops dead and he's near enough, he springs
        const m = this.mouse!;
        const f = this.field!;
        if (f.gone) {
          this.phase = 'lost';
          this.t = 0;
          break;
        }
        const p = this.walker.position;
        const to = f.position;
        const dx = to.x - p.x;
        const dz = to.z - p.z;
        const dist = Math.hypot(dx, dz);
        this.turn(Math.atan2(-dz, dx), dt);
        if ((this.wait -= dt) > 0) {
          this.low = 0.5;
          break;
        }
        pace = CHASE;
        const d = Math.min(Math.max(0, dist - 0.55), pace * dt);
        p.x += (dx / (dist || 1)) * d;
        p.z += (dz / (dist || 1)) * d;
        p.y = this.ground.at(p.x, p.z);
        this.stride += d * 11;
        moving = d > 0;
        this.bound = moving ? 1 : 0;
        this.low = moving ? 0.3 : 0.8;
        if (!(f.still && dist < REACH)) break;
        m.springs++;
        if (m.springs >= m.catchOn) f.freeze();
        m.start.copy(p);
        m.target.copy(to);
        this.phase = 'spring';
        this.t = 0;
        break;
      }
      case 'spring': {
        const m = this.mouse!;
        const f = this.field!;
        const catching = m.springs >= m.catchOn;
        this.t += dt / 0.6;
        const k = Math.min(1, this.t);
        this.leap(k, m.start, m.target, 0.3, false);
        this.morph = 1;
        this.low = 0.6 * (1 - this.air);
        this.turn(headingTo(m.start, m.target), dt);
        if (!catching && k > 0.3) f.dash(); // off again from under him
        if (k < 1) break;
        this.onPounce?.(m.target.clone());
        this.t = 0;
        if (catching && this.parts.head) {
          f.hold(this.parts.head);
          m.caught = true;
          this.phase = 'pin';
        } else {
          this.phase = 'chase';
          this.wait = 0.45; // missed: a look, and after it again
        }
        break;
      }
      case 'lost': {
        // gone into the grass: he stops, and looks for it, this way and that
        this.t += dt;
        this.low = 0.4 * (1 - step(0, 1, this.t));
        this.lick = 0;
        this.look = Math.sin(this.t * 2.6) * 0.7 * (1 - step(1.6, 2.2, this.t));
        if (this.t < 2.2) break;
        this.phase = 'groom';
        this.t = 0;
        break;
      }
      case 'pin': {
        // both front paws down on it, nose in after them
        this.t += dt;
        this.low = 1;
        if (this.t < (this.mouse!.caught ? 0.9 : 1.3)) break;
        this.phase = this.mouse!.caught ? 'proud' : 'groom';
        this.t = 0;
        break;
      }
      case 'proud':
      case 'groom': {
        // with it, a look round, head up; without it, a wash, as though that's what he came out for
        this.t += dt;
        const length = this.phase === 'proud' ? 1.8 : 4;
        if (this.phase === 'groom') this.lick = step(0.2, 0.6, this.t) * (1 - step(length - 0.5, length, this.t));
        else this.chin = step(0, 0.4, this.t);
        if (this.t < length) break;
        const here = this.walker.position.clone();
        const home = this.bed.lead[0];
        this.trip = new Path([{ at: here, fixed: false }, this.corner(), home]);
        this.next = this.bed;
        this.phase = 'roam';
        this.s = 0;
        break;
      }
      case 'gift': {
        // he turns, head down, and leaves it on the flagstones in front of the bench, for you
        const m = this.mouse!;
        const out = this.bed.lead[0].at.clone().sub(this.seat).setY(0).normalize();
        const spot = this.seat.clone().addScaledVector(out, 0.6);
        this.t += dt;
        this.turn(headingTo(this.walker.position, spot), dt);
        this.low = 0.5 * step(0.2, 0.5, this.t) * (1 - step(1, 1.3, this.t));
        if (this.t > 0.8 && !m.given) {
          m.given = true;
          this.field?.drop(spot.setY(this.ground.at(spot.x, spot.z)));
        }
        if (this.t < 1.4) break;
        this.t = 0;
        this.settleIn();
        break;
      }
    }
    this.walker.rotation.set(0, this.heading, 0);
    this.walker.scale.copy(this.baseScale).multiplyScalar(this.morph);
    this.pose(moving, pace);
  }

  /** The way round the end of the bench, between the front of it and the meadow (ROUND). */
  private corner(): Waypoint {
    const [x, y] = ROUND;
    return { at: new THREE.Vector3(x, this.ground.at(x, -y), -y), fixed: false };
  }

  /** Home from a move or a hunt: in its new bed, and up onto it (or straight round and down). */
  private settleIn() {
    this.lieIn(this.next!);
    if (this.mouse) {
      if (this.mouse.caught) proud.add(this.spec.id);
      this.mouse = null;
    }
    this.phase = this.bed.hop ? 'arrive' : 'circle';
    this.turnFrom = this.heading;
  }

  private turn(want: number, dt: number) {
    let d = want - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * (1 - Math.exp(-TURN * dt));
  }

  /**
   * A jump, `t` (0..1) through it, from `from` to `to`: it gathers itself for a moment (down low,
   * tail wiggling), springs, stretches out in the air, lands with a squash and straightens up.
   * `leaving`: it has just got up from curled-up asleep, so it grows into its full size as it
   * gathers; landing back on the bench it shrinks down again, ready to curl up.
   */
  private leap(t: number, from: THREE.Vector3, to: THREE.Vector3, height: number, leaving: boolean) {
    const flight = THREE.MathUtils.clamp((t - 0.22) / 0.56, 0, 1);
    this.crouch = step(0, 0.16, t) * (1 - step(0.19, 0.24, t));
    this.air = Math.sin(flight * Math.PI);
    this.land = t > 0.78 ? 1 - step(0.78, 1, t) : 0;
    if (leaving) this.morph = this.curl + (1 - this.curl) * step(0, 0.2, t);
    else this.morph = 1 - (1 - this.curl) * step(0.8, 1, t);
    const along = flight * 0.85 + step(0, 1, flight) * 0.15; // nearly steady across, easing a little at each end
    const p = this.walker.position.lerpVectors(from, to, along);
    p.y = THREE.MathUtils.lerp(from.y, to.y, along) + this.air * height;
  }

  // --- body language ---------------------------------------------------------------

  private pose(moving: boolean, pace: number) {
    const { body, head, tail, legs } = this.parts;
    for (const [o, r] of this.rest) o.rotation.copy(r);
    if (!body) return;
    const s = this.stride;
    const { air, crouch, land, reach, yawn, low, shimmy, lick, bound } = this;
    const amble = pace < this.spec.speed; // strolling, not trotting through the rain: a shorter step
    this.wiggle += crouch > 0 ? 0.5 : 0;
    // a trot: diagonal pairs swing together; in the air, front paws reach and back legs push off
    // (flat out, a gallop: front paws together, then back paws together, reaching further)
    legs.forEach((leg, i) => {
      const front = i < 2;
      const phase = bound ? (front ? 0 : Math.PI * 0.8) + (i % 2) * 0.3 : i === 0 || i === 3 ? 0 : Math.PI;
      leg.rotation.z += moving ? Math.sin(s + phase) * (bound ? 0.85 : amble ? 0.38 : 0.5) : 0;
      leg.rotation.z += air * (front ? 0.7 : -0.6);
      leg.rotation.z += reach * (front ? 0.95 : -0.15); // the stretch: front paws right out in front
    });
    body.position.y = this.bodyY + (moving ? Math.abs(Math.sin(s)) * (amble ? 0.015 : 0.025) : 0) - 0.09 * crouch - 0.08 * land - 0.05 * reach - 0.1 * low;
    const off = this.phase === 'down' || this.phase === 'cool' || this.phase === 'leave';
    body.rotation.z = air * (off ? -0.25 : 0.25) + (off ? 0.08 : -0.08) * crouch + 0.1 * land - 0.32 * reach; // nose down off the bench, up onto it; up a little to look at where it's going
    body.scale.set(1 + 0.1 * air + 0.04 * land + 0.08 * reach + 0.06 * low, 1 - 0.07 * land - 0.05 * crouch - 0.1 * low, 1); // stretched in the air, squashed down low
    body.rotation.z -= 0.06 * low; // stalking: shoulders down, back end up a touch
    body.rotation.y += Math.sin(this.clock * 22) * 0.12 * shimmy; // the wiggle before the pounce
    if (moving && bound) {
      body.rotation.z += Math.sin(s) * 0.16; // rocking, nose and tail, bound to bound
      body.position.y += Math.max(0, Math.sin(s)) * 0.05;
    }
    if (head) {
      head.rotation.z += (moving ? Math.sin(s * 2) * 0.05 : 0) + 0.25 * crouch + 0.3 * reach - 0.45 * yawn; // eyes on the landing; up, and back for a yawn
      // eyes level on the spot, stalking; nose in the grass; down at a paw, licking; chin up with it
      const nose = this.phase === 'pin' || (this.phase === 'gift' && this.t > 0.3 && this.t < 1.1) ? 0.5 : 0;
      head.rotation.z += -0.12 * low - nose - lick * (0.55 + Math.sin(this.clock * 11) * 0.12) + 0.3 * this.chin;
      head.rotation.y += lick * 0.6 + this.look;
      if (bound) head.rotation.z -= Math.sin(s) * 0.12; // eyes kept level on it
      head.scale.set(1, 1 + 0.12 * yawn, 1);
    }
    if (tail) {
      tail.rotation.x += Math.sin(s * 0.5) * 0.15 + crouch * Math.sin(this.wiggle) * 0.4 + reach * 0.5 + low * Math.sin(this.clock * 7) * 0.2; // tail up, the tip bobbing side to side (and a wiggle before a jump; a twitch, stalking)
      tail.rotation.z += 1.1 * Math.max(low, bound); // stalking (and after it), it goes down straight out behind
    }
  }
}

/**
 * When it rains, the animals go indoors: Charlie and George wake up, jump off the bench and
 * trot home to the lighthouse, Beike runs after them (with his ball), and the black cat on the
 * pier heads all the way up the trail to the hut, to sleep on Vincent's bed. They come back out
 * once it's dry, and the rooms (quarters.ts, hut-room.ts) show them asleep inside meanwhile.
 * Charlie and George aren't always on the bench to start with, though (chooseBeds()), and every
 * few minutes one of them gets up and goes to sleep somewhere else (roam): the library step of a
 * morning, the fire of an evening, the hearth in the library on a cold day, or the workshop's
 * hammock while Vincent's at his boat (the library and workshop show them in there:
 * `<cat>_library`, `<cat>_workshop` in `indoors`). From anywhere else, in the rain, they make
 * their way to the bench's route first.
 */
export class Shelter {
  private cats: Cat[] = [];
  private wantIn = false;
  private settling = false;
  /** Now and then, dry days too, Charlie and George spend a while in the lighthouse (and Beike stays out). */
  private visit = { on: false, wait: 60 + Math.random() * 90 };
  private bench: Waypoint[] = [];
  private beds = new Map<string, Partial<Record<Nook, Bed | null>>>();
  private clock = 0;
  /** Seconds till the next of them may get up and move (so they don't both go at once). */
  private lull = rand(40, 90);
  /** Put somewhere by hand (?charlie=, ?george=): they stay put. */
  private pinned = ['charlie', 'george'].some((id) => new URLSearchParams(location.search).has(id));
  /** A preview (?cats=roam): on the move every half a minute or so, rather than every few. */
  private restless = new URLSearchParams(location.search).get('cats') === 'roam';
  /** A preview (?cats=mouse): George off after a mouse every time he gets up, and soon. */
  private mousing = new URLSearchParams(location.search).get('cats') === 'mouse';
  /** A pounce lands, at (Life: the grass goes up). */
  onPounce?: (at: THREE.Vector3) => void;
  /** Somebody's sitting on the bench with them (routines.ts, set every frame): nobody gets up and goes. */
  company = false;
  /** She's sitting in Charlie's place (set every frame): if he's asleep there, he's on her lap instead. */
  lap = false;
  private onLap = false;

  /** `hour`: the time of day on the island when you arrive, for where the cats have gone to sleep. */
  /** The mouse George goes after (fieldmouse.ts), if there's a model of one. */
  private field?: FieldMouse;
  /** A preview: how the hunt goes (?cats=mouse&mouse=catch|miss|empty). */
  private outcome = new URLSearchParams(location.search).get('mouse') as Outcome | null;

  /** `mouse`: the wood mouse's model (fauna.py), for George to go after. */
  constructor(
    private island: Island,
    private beike: Beike,
    private hour: number,
    mouse?: THREE.Object3D,
  ) {
    chooseBeds(hour);
    for (const spec of CATS) {
      const sleeper = island.get(spec.id);
      const walker = island.root.getObjectByName(`${spec.id}_walk`);
      const route = island.routes.get(spec.route);
      if (!sleeper || !walker || !route?.length) continue;
      if (spec.route === 'bench') this.bench = route;
      const home = benchBed(sleeper, spec.front, route, beike.ground);
      this.beds.set(spec.id, { bench: home });
      const want = spec.id in beds ? beds[spec.id as keyof typeof beds] : 'bench';
      const bed = this.bedIn(spec.id, sleeper, want) ?? home;
      const cat = new Cat(spec, sleeper, walker, bed, beike.ground);
      cat.onPounce = (at) => this.onPounce?.(at);
      if (spec.id === 'george' && mouse && walker.parent) cat.field = this.field = new FieldMouse(mouse, walker.parent, beike.ground);
      if (this.mousing && spec.id === 'george') cat.stay = 4;
      this.cats.push(cat);
    }
    if (this.mousing) this.lull = 0;
    const route = island.routes.get('beike');
    if (route?.length) beike.shelterRoute = route;
  }

  /** The bed for cat `id` in `n`, worked out the first time it's wanted. */
  private bedIn(id: string, sleeper: THREE.Object3D, n: Nook): Bed | null {
    const known = this.beds.get(id)!;
    if (!(n in known)) known[n] = n === 'bench' ? null : nookBed(this.island, sleeper, n, this.bench, this.beike.ground);
    return known[n] ?? null;
  }

  /** Whether Charlie and George are both asleep on their bench. */
  get onTheBench() {
    return this.cats.filter((c) => c.id !== 'cat').every((c) => c.asleep && c.onBench);
  }

  /** Whatever the weather is on the next update, they're already where it would have put them. */
  settle() {
    this.settling = true;
  }

  /** Both cats in the lighthouse, for as long as you like (a preview: ?cats=in). */
  visitNow() {
    this.visit = { on: true, wait: 1e9 };
  }

  /** `rain` and `hot` are 0..1; `instant` skips the walking (reduced motion). */
  update(dt: number, rain: number, instant = false, hot = 0) {
    this.clock += dt;
    this.field?.update(dt);
    const was = this.wantIn;
    this.wantIn = rain > GO_IN || (this.wantIn && rain > COME_OUT);
    const v = this.visit;
    if (!this.wantIn && !instant && !this.settling && !this.company && (v.wait -= dt) <= 0) {
      v.on = !v.on;
      v.wait = v.on ? 150 + Math.random() * 150 : 150 + Math.random() * 210;
    }
    const catsIn = this.wantIn || v.on;
    if (this.settling || (instant && was !== this.wantIn)) {
      this.cats.forEach((c) => c.snap(catsIn, hot));
      this.beike.snap(this.wantIn);
      this.settling = false;
      this.onLap = false; // (the sleepers are all back where they sleep)
    } else if (!instant) {
      this.roam(dt, catsIn, hot);
      this.cats.forEach((c) => c.update(dt, catsIn, hot));
      this.beike.sheltering = this.wantIn;
    }
    for (const c of this.cats) {
      if (c.inside) indoors.add(c.id);
      else indoors.delete(c.id);
      for (const room of ['library', 'workshop']) {
        if (c.room === room) indoors.add(`${c.id}_${room}`);
        else indoors.delete(`${c.id}_${room}`);
      }
    }
    if (this.beike.inside) indoors.add('beike');
    else indoors.delete('beike');
    // Charlie, from the fleece to her lap and back
    const charlie = this.cats.find((c) => c.id === 'charlie');
    const lap = this.lap && !!charlie?.asleep && charlie.onBench;
    if (lap !== this.onLap) {
      this.onLap = lap;
      const sleeper = this.island.get('charlie');
      if (sleeper && charlie?.asleep) sleeper.visible = !lap;
    }
  }

  /** Whether Charlie's curled up on her lap on the bench. */
  get charlieOnLap() {
    return this.onLap;
  }

  /**
   * Every few minutes, out of the rain, Charlie or George gets up and goes to sleep somewhere
   * else: never where the other one is (outdoors: there's room for two indoors), and not while
   * somebody's kneeling at the bench giving them a fuss. Once in a while George, getting up off
   * the bench, goes out into the meadow after a mouse instead, likeliest at dusk and dawn.
   */
  private roam(dt: number, catsIn: boolean, hot: number) {
    if (catsIn || this.pinned || this.company) return;
    this.lull -= dt;
    const hour = (this.hour + this.clock / 3600) % 24;
    for (const c of this.cats) {
      if (c.id === 'cat' || !c.settled) continue;
      c.idle += dt;
      if (c.idle < (this.restless ? 20 : c.stay) || this.lull > 0 || (c.onBench && petting.by.cats)) continue;
      const sleeper = this.island.get(c.id);
      if (!sleeper) continue;
      const dusk = (hour >= 5 && hour < 8) || (hour >= 17 && hour < 21);
      if (c.id === 'george' && c.onBench && (this.mousing || Math.random() < (dusk ? 0.25 : 0.07))) {
        const { at: [x, y], patch: [x0, y0, x1, y1] } = MOUSE_HOLES[Math.floor(Math.random() * MOUSE_HOLES.length)];
        const r = Math.random();
        const outcome = this.outcome ?? (r < 0.15 ? 'empty' : r < 0.6 ? 'miss' : 'catch');
        c.hunt(new THREE.Vector3(x, this.beike.ground.at(x, -y), -y), [x0, -y1, x1, -y0], outcome);
        this.lull = this.mousing ? 6 : rand(60, 150);
        if (this.mousing) c.stay = 6;
        continue;
      }
      const taken = new Set(this.cats.filter((o) => o !== c).map((o) => o.bed.nook));
      const options = (['bench', ...Object.keys(NOOKS)] as Nook[])
        .filter((n) => n !== c.bed.nook && (n === 'bench' || NOOKS[n].room || !taken.has(n)))
        .map((n) => [n, liking(n, hour, hot)] as const)
        .filter(([, w]) => w > 0);
      let r = Math.random() * options.reduce((a, [, w]) => a + w, 0);
      const pick = options.find(([, w]) => (r -= w) <= 0)?.[0];
      const bed = pick && this.bedIn(c.id, sleeper, pick);
      c.idle = 0;
      if (!bed) continue;
      c.roam(bed, between(c.bed, bed, this.bench));
      this.lull = this.restless || this.mousing ? 8 : rand(60, 150);
    }
  }
}
