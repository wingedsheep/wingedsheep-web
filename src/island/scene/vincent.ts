import * as THREE from 'three';
import type { Ground } from './beike';
import { fridayEvening, hourOf, late, vincentAsleep } from './bedtime';
import { diveAt, silenceNear } from './calendar';
import type { Room } from './companion';
import { Diver } from './dive';
import { Errands } from './errands';
import type { Call } from './fauna';
import type { Island } from './island';
import { Kneeling, type Pet, petting } from './petting';
import { windDir } from './grass';
import { heightBetween, indoors, type Waypoint } from './shelter';
import { occasions } from './calendar';
import { post } from './almanac';
import { herNight } from './bedtime';
import { Eater, courseAt, sitDown, table, tick } from './meals';
import { ROUTE_NAMES, Stroll, Walker, together } from './outings';
import { Bather } from './swim';
import { SnowPlay, play } from './snowplay';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Where Vincent can be. The guitar is out at the campfire, the kayak off the pier, the yoga mat
 * on the grass by the beach, the climb up the mountain trail, the cats' bench or Beike's meadow
 * for a fuss (petting.ts), and on New Year's Day the sea (dive.ts); on a post day down the pier for
 * the parcel and up to the hut with it, on a windy Sunday the beach with a kite (errands.ts); the
 * rest are indoors: the guitar comes up to the hut's stove when it's wet out, and the workshop's
 * bench is mostly a Saturday's. He goes for a stroll round the island now and then, on a cold day
 * with her and a mug of glühwein each (outings.ts), and sits down to breakfast and dinner with her,
 * by the fire or up at the hut (meals.ts). On a hot day he goes for a swim off the beach (swim.ts),
 * and with snow on the ground, by day, the two of them build a snowman and have a snowball fight
 * (snowplay.ts).
 */
export type Whereabouts = 'guitar' | 'hut' | 'kayak' | 'yoga' | 'climb' | 'podcast' | 'petting' | 'coding' | 'asleep' | 'dive' | 'post' | 'kite' | 'workshop'
  | 'stroll' | 'meal' | 'gluhwein'
  | 'swim'
  | 'snow';
/** The yoga poses he flows through (characters.py POSES), in order. */
export const POSES = ['lotus', 'tree', 'dog'] as const;
export type Pose = (typeof POSES)[number];
/** The room each indoor spot is in, and the group it shows while he's there (quarters.py, hut.py). */
const ROOMS: Partial<Record<Whereabouts, { room: Room; group: string }>> = {
  coding: { room: 'lighthouse', group: 'vincent_coding' },
  asleep: { room: 'hut', group: 'vincent_asleep' },
  hut: { room: 'hut', group: 'vincent_guitar' },
  workshop: { room: 'workshop', group: 'vincent_workshop' },
};
/** Seconds he spends at each: longest by far with the guitar. */
const STAY: Record<Whereabouts, [number, number]> = {
  guitar: [160, 340],
  hut: [160, 340],
  kayak: [70, 150],
  yoga: [90, 180],
  climb: [1e9, 1e9], // until he's back down
  podcast: [90, 200], // an episode, or the first half of one: they're three hours long
  petting: [60, 150],
  coding: [240, 420], // long enough for a coffee, or two: drinking one, and making the next, take minutes
  asleep: [60, 60], // he gets up when it's morning, not before
  dive: [60, 60], // till half past twelve, when he's dressed again
  post: [1e9, 1e9], // until it's up at the hut
  kite: [150, 300],
  workshop: [220, 420], // a long stint, on a Saturday
  stroll: [1e9, 1e9], // till he's round
  meal: [1e9, 1e9], // till they've eaten
  gluhwein: [1e9, 1e9], // till they're round, or she can't come
  swim: [180, 360], // and then out, and dry
  snow: [1e9, 1e9], // till they've had enough, or she can't come
};
/** Seconds he waits at the start of a glühwein walk for her to come before he gives up on it. */
const COMPANY_WAIT = 90;
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
  rain: number; // 0..1: rain, hail or snow
  storm: number; // 0..1
  rough?: number; // 0..1: a blizzard, and he's in by the stove with his game
  wind: number; // m/s
  camera: THREE.Camera; // the island camera
  view: number; // world units in view
  room: Room | null; // the room on screen, if any
  playing: boolean; // his song is audible
  chill?: number; // 0..1: how cold it is (weather.ts)
  warm?: number; // 0..1: how warm it is (weather.ts)
  lying?: number; // 0..1: snow on the ground (weather.ts)
  raining?: number; // 0..1: rain or hail, not snow
}

/**
 * Vincent is mostly at the campfire with his guitar, but now and then he takes the kayak out
 * for a paddle round off the pier, does some yoga on the grass by the beach (she sometimes
 * joins him), climbs the mountain to the summit and back, gives the cats or Beike a fuss, or
 * goes in to the lighthouse to work on his game (late in the evening, mostly that), and from somewhere between half past ten and half past two until
 * seven or eight he's asleep up in the hut. Like her
 * (companion.ts) he only goes while nobody's watching where he is or where he's off to, and he
 * never gets up in the middle of a song. The kayak waits for daylight and fair weather.
 */
export class Vincent {
  static readonly SPOTS: Whereabouts[] = ['guitar', 'hut', 'kayak', 'yoga', 'climb', 'podcast', 'petting', 'coding', 'asleep', 'stroll', 'meal', 'gluhwein', 'swim', 'snow'];
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
  /** His paddle in the water, when he's out in the kayak (the island plays it). */
  onSound?: (call: Call, at: THREE.Vector3) => void;
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
  private kneel: Kneeling;
  /** Into the sea at noon on New Year's Day (dive.ts). */
  readonly diver: Diver;
  /** Down the pier for the post, and up the mountain with it; out on the beach with a kite (errands.ts). */
  readonly errands: Errands;
  /** On his feet for a stroll, on his own (`solo`) or with her (`pair`): see outings.ts. */
  readonly walker: Walker;
  readonly solo: Stroll;
  readonly pair: Stroll;
  /** Waiting for her to come along with the glühwein (seconds), or -1 once they're off. */
  private waitingForHer = -1;
  /** Out in the snow with her: a snowman, and a snowball fight (snowplay.ts). */
  readonly snow: SnowPlay;
  /** Waiting for her to come out in the snow (seconds), or -1 once they're out; and when they last were (his clock). */
  private waitingToPlay = -1;
  private played = -Infinity;
  /** Just arrived: if snow's been lying all morning, there's a snowman up already. */
  private looking = true;
  /** Eating by the fire (the hut's own is hut-room.ts's). */
  private eater?: Eater;
  private meal?: THREE.Object3D;
  /** In the sea on a hot day, or on his towel (swim.ts). */
  readonly bather: Bather;
  /** A thought, over his head, while he's out walking. */
  onThought?: (at: THREE.Vector3) => void;
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
    this.kneel = new Kneeling(island, 'vincent');
    this.diver = new Diver(island, ground);
    this.errands = new Errands(island, ground);
    this.walker = new Walker(island, 'vincent_stroll', 'stroll');
    this.solo = new Stroll(ground, this.walker);
    this.pair = new Stroll(ground, this.walker, new Walker(island, 'companion_stroll', 'companion_stroll', true));
    this.pair.mugs = true;
    this.snow = new SnowPlay(island, ground, this.walker, this.pair.beside!);
    for (const s of [this.solo, this.pair]) s.onThought = (at) => this.onThought?.(at);
    this.meal = island.get('vincent_meal');
    if (this.meal) this.eater = new Eater(this.meal, 'meal_v', 'v');
    this.bather = new Bather(island, ground, 'vincent_swim', 'swim', 'towel_vincent');
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

  /** Whether he's playing up in the hut, by the stove, out of the rain. */
  get inTheHut() {
    return this.spot === 'hut';
  }

  /** The walk he's on, if he's out on one. */
  get stroll(): Stroll | null {
    return this.spot === 'stroll' ? this.solo : this.spot === 'gluhwein' && this.waitingForHer < 0 ? this.pair : null;
  }

  /** Clicked on while he's eating: he looks up. */
  notice() {
    if (this.eater) this.eater.noticed = 1;
  }

  /** Straight to a spot (and, on his knees, who to pet), to stay: for previews. */
  put(spot: Whereabouts, pet?: Pet) {
    this.move(spot, pet);
    this.company = spot === 'yoga'; // so a preview shows the two of them
    this.pinned = true;
  }

  /** Wherever the hour and the weather say he is on the next update, he's already there. */
  settle() {
    this.settling = true;
    this.looking = true;
  }

  update(dt: number, w: VincentWorld, still = false) {
    this.clock += dt;
    if (!this.pinned) this.decide(dt, w);
    if (this.spot === 'kayak') this.paddling(still ? 0 : dt);
    if (this.spot === 'yoga') this.flowing();
    if (this.spot === 'climb') this.hiking(still ? 0 : dt);
    if (this.spot === 'podcast') this.pacing(still ? 0 : dt);
    if (this.spot === 'petting' && !still) this.kneel.animate(this.clock);
    if (this.spot === 'dive') this.diver.update(still ? 0 : dt, diveAt(w.time) ?? 0);
    if (this.spot === 'post') {
      this.errands.post(still ? 0 : dt);
      if (!this.errands.busy) this.stay = -1; // in at the hut with it: back to the fire, once nobody's watching
    }
    if (this.spot === 'kite') this.errands.fly(still ? 0 : dt, windDir.value);
    if (this.spot === 'stroll') {
      this.solo.update(still ? 0 : dt);
      if (this.solo.done && !this.pinned) this.stay = -1; // round: back to the fire, once nobody's watching
      else if (this.solo.done) this.solo.begin();
    }
    if (this.spot === 'gluhwein') this.outing(still ? 0 : dt);
    if (this.spot === 'meal') this.dine(still ? 0 : dt, w);
    if (this.spot === 'swim') this.bather.update(still ? 0 : dt);
    if (this.looking && !this.pinned) {
      this.looking = false;
      if ((w.lying ?? 0) > 0.4 && hourOf(w.time) >= 11) this.snow.standing();
    }
    if (this.spot === 'snow') this.playing(still ? 0 : dt, w.lying ?? 0);
    else this.snow.update(0, w.lying ?? 0); // the snowman, thawing
  }

  /** Out in the snow with her once she's come (till then he's nowhere to be seen): a snowman, then snowballs. */
  private playing(dt: number, lying: number) {
    if (this.waitingToPlay >= 0) {
      this.waitingToPlay += dt;
      if (play.joined || this.pinned) {
        this.waitingToPlay = -1;
        this.snow.begin();
      } else if (this.waitingToPlay > COMPANY_WAIT) this.stay = -1; // she's busy: another time
      return;
    }
    this.snow.update(dt, lying);
    if (this.snow.done && this.pinned) this.snow.begin();
    else if (this.snow.done) this.stay = -1;
  }

  /** Off with her and the glühwein once she's come out (till then he's nowhere to be seen), and round. */
  private outing(dt: number) {
    if (this.waitingForHer >= 0) {
      this.waitingForHer += dt;
      if (together.joined || this.pinned) {
        this.waitingForHer = -1;
        this.pair.begin();
        this.walker.visible = true;
        this.herWalker(true);
      } else if (this.waitingForHer > COMPANY_WAIT) this.stay = -1; // she's busy: another time
      return;
    }
    this.pair.update(dt);
    this.herWalker(together.joined || this.pinned);
    if (this.pair.done && this.pinned) this.pair.begin();
    else if (this.pair.done) this.stay = -1;
  }

  private herWalker(on: boolean) {
    if (this.pair.beside) this.pair.beside.visible = on;
  }

  /** At the table: by the fire, or (if it's no weather for it, or it starts raining) up at the hut. */
  private dine(dt: number, w: VincentWorld) {
    const c = table.course ?? courseAt(w.time);
    if (c) sitDown(c, w.time, this.tableWeather(w));
    if (!this.pinned) tick(w.time, this.tableWeather(w));
    if (!table.course) this.stay = -1;
    this.show();
    this.eater?.update(dt, table.course);
  }

  private tableWeather(w: VincentWorld) {
    return { rain: w.rain, chill: w.chill ?? 0, wind: w.wind, night: w.night };
  }

  /** The head to breathe out of on a cold day, if he's outdoors and upright. */
  get head() {
    if (this.spot === 'guitar') return this.seated?.getObjectByName('head');
    if (this.spot === 'kayak') return this.boat?.getObjectByName('head');
    if (this.spot === 'climb') return this.hiker?.getObjectByName('hike_head');
    if (this.spot === 'podcast') return this.pacer?.getObjectByName('pod_head');
    if (this.spot === 'yoga') return this.mat?.getObjectByName(`vincent_yoga_${this.pose}_head`);
    if (this.spot === 'petting') return this.kneel.head;
    if (this.spot === 'dive') return this.diver.head;
    if (this.spot === 'post' || this.spot === 'kite') return this.errands.head;
    if ((this.spot === 'stroll' || this.spot === 'gluhwein' || this.spot === 'snow') && this.walker.visible) return this.walker.head;
    if (this.spot === 'meal' && !table.indoors) return this.eater?.face;
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
    // the one he's petting has run off: up off his knees and away, rather than kneeling there on his own
    if (this.spot === 'petting' && this.kneel.pet && !petting.there[this.kneel.pet] && this.seen('petting', w)) {
      this.getUp();
      return;
    }
    // the post's come: off to fetch it (after the song he's in the middle of)
    const errand = post.waiting && this.spot !== 'post' && allowed.includes('post');
    const mealtime = !errand && allowed.includes('meal') && this.spot !== 'meal';
    const due = !allowed.includes(this.spot) || this.stay < 0 || errand || mealtime;
    if (errand) this.next = 'post';
    if (mealtime) this.next = 'meal';
    // in the sea: out first, and dry, before he's off anywhere
    if (due && this.spot === 'swim' && !this.bather.ashore) {
      this.bather.finish();
      this.waiting = 0;
      return;
    }
    if (!due || ((this.spot === 'guitar' || this.spot === 'hut') && w.playing && allowed.includes(this.spot)) || (this.spot === 'dive' && this.diver.busy)
      || (this.spot === 'post' && this.errands.busy)) {
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
      // in off the water, or in from the fire when it rains, even mid-song: nobody plays on in a downpour
      || ((this.spot === 'kayak' || this.spot === 'guitar' || (w.rough ?? 0) > 0.4) && !allowed.includes(this.spot) && this.waiting > SQUALL_WAIT)
      // nobody misses the dive at noon, or the silence at eight on the fourth of May
      || ((this.next === 'dive' || silenceNear(w.time)) && this.waiting > SQUALL_WAIT)
      // nor leaves a parcel out on the pier for long
      || (this.next === 'post' && this.waiting > PATIENCE)
      // nor lets dinner go cold
      || (this.next === 'meal' && this.waiting > PATIENCE);
    if (forced || (!this.seen(this.spot, w) && !this.seen(this.next, w))) this.move(this.next);
  }

  /** Up from where he's kneeling and off round the nearest walk. */
  private getUp() {
    const knees = this.kneel.pet && this.kneel.at(this.kneel.pet);
    this.move('stroll');
    if (knees) this.solo.getUp(knees);
  }

  private allowed(w: VincentWorld): Whereabouts[] {
    if (vincentAsleep(w.time)) return ['asleep'];
    if (this.diver.ready && diveAt(w.time) !== null) return ['dive'];
    if (silenceNear(w.time)) return ['guitar'];
    if (this.spot === 'post' && this.errands.busy) return ['post'];
    // breakfast and dinner, with her (by the fire or up at the hut, whatever the weather)
    const meal: Whereabouts[] = courseAt(w.time) || (this.spot === 'meal' && table.course) ? ['meal'] : [];
    if ((w.rough ?? 0) > 0.4) return ['coding', 'hut', ...meal];
    const fair = w.night < 0.5 && w.rain < 0.1 && w.storm < 0.2 && w.wind < 11;
    const hour = hourOf(w.time);
    // the week's own: the post when it's come, a kite on a windy Sunday, the bench by day
    const week: Whereabouts[] = [
      ...(post.waiting ? ['post' as const] : []),
      ...(occasions.has('sunday') && hour >= 10 && hour < 17.5 && w.night < 0.4 && w.rain < 0.1 && w.wind >= 4 && w.wind < 14 ? ['kite' as const] : []),
      ...(hour >= 8 && hour < 21 ? ['workshop' as const] : []),
    ];
    // on his knees only while there's someone to pet (and the one he's petting is still there)
    const pets = petting.open('vincent');
    const pet = this.spot === 'petting' ? this.kneel.pet : null;
    const fuss = w.night < 0.5 && w.rain < 0.1 && (pet ? pets.includes(pet) : pets.length > 0);
    // a cold, dry afternoon or evening: a walk with her and a mug of glühwein (while she's up)
    const cold = (w.chill ?? 0) > 0.1 && w.rain < 0.1 && w.storm < 0.2 && w.wind < 12 && hour >= 13 && hour < 21.5 && !herNight(w.time);
    const walks: Whereabouts[] = [...(fair ? ['stroll' as const] : []), ...(cold || this.spot === 'gluhwein' ? ['gluhwein' as const] : [])];
    // a hot, still, dry day: a swim off the beach
    const hot = fair && (w.warm ?? 0) > 0.55 && w.rain < 0.05 && w.storm < 0.1 && w.wind < 9 && hour >= 10 && hour < 19.5;
    const swim: Whereabouts[] = hot ? ['swim'] : [];
    // snow lying, by day, and not raining on it or blowing a blizzard: out in it with her (now and then)
    const snowy = (w.lying ?? 0) > 0.35 && (w.raining ?? 0) < 0.1 && w.storm < 0.2 && (w.rough ?? 0) < 0.2 && w.wind < 12
      && w.night < 0.35 && hour >= 9.5 && hour < 16.5 && !herNight(w.time);
    const snow: Whereabouts[] = (snowy && this.clock - this.played > 1800) || (this.spot === 'snow' && (w.raining ?? 0) < 0.1) ? ['snow'] : [];
    if (fair) return ['guitar', 'kayak', 'yoga', 'climb', 'podcast', 'coding', ...(fuss ? ['petting' as const] : []), ...week, ...walks, ...meal, ...swim, ...snow];
    // a podcast works in the dark; in the wet the guitar comes in to the hut
    return [...(w.rain < 0.1 ? ['guitar', 'podcast', 'coding'] as Whereabouts[] : ['hut', 'coding'] as Whereabouts[]), ...week, ...walks, ...meal, ...snow];
  }

  /**
   * Back to the guitar after anything else (at the fire, or by the hut's stove when it's wet);
   * from the guitar, off to the game more often than the water. Late in the evening the game has
   * him: he's mostly at it, sometimes till bedtime.
   */
  private choose(from: Whereabouts, w: VincentWorld): Whereabouts {
    const allowed = this.allowed(w);
    if (allowed.length === 1) return allowed[0];
    if (allowed.includes('post') && from !== 'post') return 'post';
    if (allowed.includes('meal') && from !== 'meal') return 'meal';
    const guitar: Whereabouts = allowed.includes('hut') ? 'hut' : 'guitar';
    // Friday evening, it's drinks by the fire (or the stove): nowhere else he'd rather be
    if (fridayEvening(w.time) && allowed.includes(guitar)) return guitar;
    if (late(w.time)) return from === 'coding' && Math.random() < 0.35 && allowed.includes(guitar) ? guitar : 'coding';
    if (from !== guitar) return guitar;
    const saturday = occasions.has('saturday');
    const odds: [Whereabouts, number][] = [['coding', saturday ? 0.15 : 0.35], ['kayak', 0.2], ['yoga', 0.25], ['climb', 0.2], ['podcast', 0.25], ['petting', 0.2],
      ['kite', 1.1], ['workshop', saturday ? 1.4 : 0.06], ['stroll', 0.4], ['gluhwein', 0.6],
      ['swim', this.bather.other?.swimming ? 3 : 0.9], ['snow', 2.5]]; // all the more if she's in
    const open = odds.filter(([spot]) => allowed.includes(spot));
    let r = Math.random() * open.reduce((sum, [, p]) => sum + p, 0);
    for (const [spot, p] of open) if ((r -= p) < 0) return spot;
    return 'coding';
  }

  private move(to: Whereabouts, pet?: Pet) {
    this.spot = to;
    const pets = petting.open('vincent');
    this.kneel.set(to === 'petting' ? (pet ?? pets[Math.floor(Math.random() * pets.length)] ?? 'cats') : null);
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
    if (to === 'post') this.errands.fetch();
    if (to === 'stroll') this.solo.begin();
    if (to === 'swim') this.bather.begin();
    together.asked = to === 'gluhwein';
    play.asked = to === 'snow';
    if (to === 'snow') {
      play.joined = false;
      this.waitingToPlay = 0;
      this.played = this.clock;
    }
    if (to === 'gluhwein') {
      together.joined = false;
      this.waitingForHer = 0;
    }
    if (to === 'workshop' && !occasions.has('saturday')) this.stay *= 0.5; // just a quick job, on a weekday
    this.show();
  }

  private show() {
    if (this.seated) this.seated.visible = this.spot === 'guitar';
    if (this.moored) this.moored.visible = this.spot !== 'kayak';
    if (this.boat) this.boat.visible = this.spot === 'kayak';
    if (this.mat) this.mat.visible = this.spot === 'yoga';
    if (this.hiker) this.hiker.visible = this.spot === 'climb';
    if (this.pacer) this.pacer.visible = this.spot === 'podcast';
    this.diver.visible = this.spot === 'dive';
    this.errands.visible = (this.spot === 'post' && this.errands.busy) || this.spot === 'kite';
    const playing = this.spot === 'snow' && this.waitingToPlay < 0;
    this.walker.visible = this.spot === 'stroll' || (this.spot === 'gluhwein' && this.waitingForHer < 0) || playing;
    if (this.spot !== 'gluhwein' && !playing) this.herWalker(false);
    if (this.spot !== 'snow') this.snow.stop();
    this.bather.visible = this.spot === 'swim';
    const eating = this.spot === 'meal' && !!table.course;
    if (this.meal) this.meal.visible = eating && !table.indoors;
    if (eating && table.indoors) indoors.add('vincent_meal_hut');
    else indoors.delete('vincent_meal_hut');
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
    if (spot === 'meal') return w.room === 'hut' || at(this.meal, 2);
    if ((spot === 'stroll' || spot === 'gluhwein') && this.spot === spot && this.walker.visible) return at(this.walker.root, 2.2);
    if (spot === 'stroll' || spot === 'gluhwein') return ROUTE_NAMES.some((r) => this.near(Stroll.start(r, this.ground), 2));
    if (spot === 'dive') return at(this.diver.body, 3);
    if (spot === 'snow') return at(this.snow.yard, 5);
    if (spot === 'swim') return (this.spot === 'swim' && at(this.bather.root, 2.2)) || this.near(this.bather.towelAt, 1.8);
    if (spot === 'post') return this.spot === 'post' ? at(this.errands.body, 1.5) : !!this.errands.start && this.near(this.errands.start, 1.5);
    if (spot === 'kite') return at(this.errands.body, 3) || this.near(new THREE.Vector3(6.2, 1, 16.4), 3);
    if (spot === 'yoga') return at(this.mat, 2);
    if (spot === 'podcast') return this.spot === 'podcast' ? at(this.pacer, 1.5) : this.walk.some((p) => this.near(p.at, 1.5));
    if (spot === 'petting') {
      const pets = this.spot === 'petting' && this.kneel.pet ? [this.kneel.pet] : petting.open('vincent');
      return pets.some((p) => at(this.kneel.at(p), 1.6));
    }
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
    // a blade in the water each half stroke
    if (dt > 0 && Math.floor(p / Math.PI) !== Math.floor((((t - dt) / STROKE) * Math.PI * 2) / Math.PI)) this.onSound?.('stroke', boat.position.clone());
    // it faces its local +z (the model's bow is Blender's -y)
    const heading = Math.atan2(-l.rx * sin, -l.rz * cos);
    boat.rotation.set(Math.sin(t * 0.9) * 0.02, heading + Math.sin(p) * 0.06, Math.sin(t * 1.1) * 0.04);
    // right blade in near the bow and pulled back to the hip, then the left: the paddle rolls
    // about the boat's length (right end down first) while it sweeps from bow to stern
    this.paddle?.rotation.set(0, Math.cos(p) * 0.4, Math.sin(p) * 0.6);
  }
}
