import * as THREE from 'three';
import { hourOf } from './bedtime';
import { Games } from './boardgames';
import { visitDate } from './calendar';
import { Camp, type CampWorld } from './camping';
import type { Island } from './island';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** The weather, as far as lying about outside goes. */
export interface Outdoors {
  night: number; // 0..1
  rain: number; // 0..1
  storm?: number; // 0..1
  wind: number; // m/s
  warm: number; // 0..1: 20 °C … 28 °C (weather.ts)
  cloud: number; // 0..1
  fog: number; // 0..1
  temperature: number; // °C
  hour: number; // 0..24
}

/** Their world (vincent.ts, companion.ts), as far as lying about outside goes. */
export function outdoors(w: {
  time: number; night: number; rain: number; storm?: number; wind?: number; warm?: number; cloud?: number; fog?: number; temperature?: number;
}): Outdoors {
  return {
    night: w.night, rain: w.rain, storm: w.storm, wind: w.wind ?? 0, warm: w.warm ?? 0, cloud: w.cloud ?? 0, fog: w.fog ?? 0,
    temperature: w.temperature ?? 15, hour: hourOf(w.time),
  };
}

/** Warm enough to lie about in a hammock: a dry, still, warm day (21 °C and up). */
export const hammockWeather = (w: Outdoors) =>
  w.warm > 0.15 && w.rain < 0.05 && (w.storm ?? 0) < 0.1 && w.wind < 9 && w.night < 0.3 && w.hour >= 11 && w.hour < 19.5;

/**
 * The hammock between the two oaks north of the lighthouse path (pastimes.py), and whoever's in
 * it: her with a book, pushing off the grass with a foot now and then to keep it going, or him
 * asleep under his. It swings about the line between the ties, a slow pendulum that a push sets
 * going and the air settles.
 */
export class Hammock {
  readonly root?: THREE.Object3D;
  private swing?: THREE.Object3D;
  private her?: THREE.Object3D;
  private him?: THREE.Object3D;
  private parts = new Map<string, { o: THREE.Object3D; rest: THREE.Euler; scale: THREE.Vector3 }>();
  /** Who's in it, if anyone (one at a time: it's a hammock for one). */
  who: 'vincent' | 'companion' | null = null;
  private angle = 0;
  private speed = 0;
  private clock = 0;
  /** Her foot to the grass: when the next push comes, and how far through one she is (0..1). */
  private push = { next: rand(2, 5), t: -1 };
  private page = { next: rand(6, 12), t: -1 };
  private snore = rand(3, 6);
  /** Clicked on: she lowers the book to see who's there (1 easing to 0). */
  noticed = 0;
  /** A zzz from him. */
  onSnore?: (at: THREE.Vector3) => void;

  constructor(island: Island) {
    this.root = island.get('hammock');
    this.swing = this.root?.getObjectByName('hammock_swing');
    this.her = island.get('companion_hammock');
    this.him = island.get('vincent_hammock');
    for (const name of ['companion_hammock_shin', 'companion_hammock_book', 'companion_hammock_head', 'vincent_hammock_chest', 'vincent_hammock_head']) {
      const o = this.root?.getObjectByName(name);
      if (o) this.parts.set(name, { o, rest: o.rotation.clone(), scale: o.scale.clone() });
    }
    this.show();
  }

  set(who: 'vincent' | 'companion', on: boolean) {
    if (on) this.who = who;
    else if (this.who === who) this.who = null;
    this.show();
  }

  private show() {
    if (this.her) this.her.visible = this.who === 'companion';
    if (this.him) this.him.visible = this.who === 'vincent';
    // it comes down for the winter: up from May to September (or whenever someone's in it)
    const month = visitDate().getMonth();
    if (this.root) this.root.visible = !!this.who || (month >= 4 && month <= 8);
  }

  /** The head to breathe out of (never, in this weather) or to aim a click's hearts at. */
  get head() {
    return this.parts.get(this.who === 'vincent' ? 'vincent_hammock_head' : 'companion_hammock_head')?.o;
  }

  private part(name: string) {
    const p = this.parts.get(name);
    if (!p) return undefined;
    p.o.rotation.copy(p.rest);
    p.o.scale.copy(p.scale);
    return p.o;
  }

  update(dt: number) {
    this.clock += dt;
    const t = this.clock;
    this.noticed = Math.max(0, this.noticed - dt / 2.5);
    // a pendulum about the ties, about two seconds a swing, dying away
    let kick = 0;
    if (this.who === 'companion') {
      const p = this.push;
      if (p.t < 0 && (p.next -= dt) < 0 && Math.abs(this.angle) < 0.03 && this.speed <= 0) p.t = 0;
      if (p.t >= 0) {
        p.t += dt / 1.1;
        // the foot goes down and back: the push is in the middle of it
        if (p.t > 0.35 && p.t < 0.6) kick = 0.55;
        if (p.t >= 1) Object.assign(p, { t: -1, next: rand(5, 11) });
      }
    }
    this.speed += (-9.0 * this.angle - 0.35 * this.speed + kick) * dt;
    this.angle += this.speed * dt;
    if (this.swing) this.swing.rotation.x = this.angle;
    if (this.who === 'companion') {
      const shin = this.part('companion_hammock_shin');
      const p = this.push;
      if (shin) shin.rotation.z += p.t >= 0 ? Math.sin(p.t * Math.PI) * 0.45 : Math.sin(t * 0.7) * 0.05;
      // a page turned now and then; the book lowered when someone's come
      const g = this.page;
      if (g.t < 0 && (g.next -= dt) < 0) g.t = 0;
      if (g.t >= 0 && (g.t += dt / 0.7) >= 1) Object.assign(g, { t: -1, next: rand(7, 15) });
      const book = this.part('companion_hammock_book');
      if (book) {
        book.rotation.z += g.t >= 0 ? Math.sin(g.t * Math.PI) * 0.12 : 0;
        book.rotation.y -= this.noticed * 0.5;
      }
      const head = this.part('companion_hammock_head');
      if (head) head.rotation.y += Math.sin(t * 0.3) * 0.05;
    } else if (this.who === 'vincent') {
      // asleep: slow, deep breaths, and a zzz now and then
      const chest = this.part('vincent_hammock_chest');
      if (chest) chest.scale.y *= 1 + Math.max(0, Math.sin(t * 0.9)) * 0.08;
      const head = this.part('vincent_hammock_head');
      if (head) head.rotation.x += Math.sin(t * 0.9) * 0.025;
      if (head && dt && (this.snore -= dt) < 0) {
        this.snore = rand(3.5, 7);
        this.onSnore?.(head.getWorldPosition(new THREE.Vector3()));
      }
    }
  }
}

/** The pastimes they share the places for (life.ts makes them, vincent.ts and companion.ts use them, main.ts runs them). */
export class Pastimes {
  readonly hammock: Hammock;
  /** The tent on the headland, for a night out (camping.ts). */
  readonly camp: Camp;
  /** A board game, at the card table or up at the hut (boardgames.ts). */
  readonly games: Games;

  constructor(island: Island) {
    this.hammock = new Hammock(island);
    this.camp = new Camp(island);
    this.games = new Games(island);
  }

  update(dt: number, w: CampWorld) {
    this.hammock.update(dt);
    this.camp.update(dt, w);
    this.games.update(dt, w);
  }
}
