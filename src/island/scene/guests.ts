import * as THREE from 'three';
import { Floaters } from './floaters';
import { indoors } from './shelter';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** How each of them sleeps: breaths a minute (well, per second, ×2π), and whether they're a cat. */
const SLEEPERS: Record<string, { breath: number; cat: boolean }> = {
  charlie: { breath: 1.9, cat: true },
  george: { breath: 1.4, cat: true },
  cat: { breath: 1.7, cat: true },
  beike: { breath: 1.6, cat: false },
  // and the two of them, in the hut's bed at night (vincent.ts, companion.ts)
  vincent_asleep: { breath: 1.1, cat: false },
  companion_bed_asleep: { breath: 1.2, cat: false },
};

/** The ones who aren't animals: they sleep here every night, rain or not. */
const PEOPLE = new Set(['vincent_asleep', 'companion_bed_asleep']);

interface Sleeper {
  root: THREE.Object3D;
  body?: THREE.Object3D;
  head?: THREE.Object3D;
  tail?: THREE.Object3D;
  rest: Map<THREE.Object3D, { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }>;
  breath: number;
  cat: boolean;
  seed: number;
  /** 1 just after you pet them, easing back to 0 as they drift off again. */
  awake: number;
  /** The dog's tail, thumping on the rug. */
  wag: number;
  zzz: number;
}

/**
 * The animals in out of the rain (shelter.ts), asleep in the rooms (quarters.py, hut.py). Each is
 * shown only while it's indoors; they breathe, a tail tip twitches now and then, a zzz drifts up,
 * and you can pet them: a head comes up, hearts, a purr (or a tail thumping the rug), and back
 * to sleep.
 */
export class Guests {
  private sleepers = new Map<string, Sleeper>();
  private floaters: Floaters;
  private clock = 0;

  /** `groups` are the children of a room's `guests` marker; the ones that are animals get an id. */
  constructor(
    scene: THREE.Scene,
    private groups: THREE.Object3D[],
  ) {
    this.floaters = new Floaters(scene, 0.035);
    for (const root of groups) {
      const spec = SLEEPERS[root.name];
      if (!spec) continue;
      root.userData.id = root.name;
      const part = (name: string) => root.getObjectByName(`${root.name}_${name}`);
      const s: Sleeper = {
        root, body: part('body'), head: part('head'), tail: part('tail'), rest: new Map(), ...spec,
        seed: Math.random() * 10, awake: 0, wag: 0, zzz: rand(2, 6),
      };
      for (const o of [s.body, s.head, s.tail]) {
        if (o) s.rest.set(o, { position: o.position.clone(), rotation: o.rotation.clone(), scale: o.scale.clone() });
      }
      this.sleepers.set(root.name, s);
    }
  }

  /** The animals, for the picker (and the highlight). */
  get animals() {
    return [...this.sleepers.values()].map((s) => s.root);
  }

  /** Whether any of the animals is in here right now (in out of the rain: the people don't count). */
  get anyone() {
    return [...this.sleepers.keys()].some((id) => !PEOPLE.has(id) && indoors.has(id));
  }

  /** Pet one (a no-op for anything else): they stir, and hearts float up. */
  pet(id: string, at: THREE.Vector3) {
    const s = this.sleepers.get(id);
    if (!s) return;
    s.awake = 1;
    if (!s.cat) s.wag = 1;
    s.zzz = 4.5; // they're asleep again by then
    for (let i = 0; i < 3; i++) this.floaters.add('heart', at, i);
  }

  /** Wake one just enough to lift its head (no hearts: nobody petted it). */
  stir(id: string) {
    const s = this.sleepers.get(id);
    if (!s) return;
    s.awake = 1;
    s.zzz = 4.5;
  }

  update(dt: number) {
    this.clock += dt;
    for (const g of this.groups) g.visible = indoors.has(g.name);
    for (const s of this.sleepers.values()) {
      if (!s.root.visible) continue;
      for (const [o, r] of s.rest) {
        o.position.copy(r.position);
        o.rotation.copy(r.rotation);
        o.scale.copy(r.scale);
      }
      s.awake = Math.max(0, s.awake - dt / 3.5);
      s.wag = Math.max(0, s.wag - dt / 2.5);
      const up = THREE.MathUtils.smoothstep(s.awake, 0, 0.35); // up quickly, settles back slowly
      const t = this.clock + s.seed;
      // breathing: slow and deep asleep, quicker (a purr, or a happy dog) when you've just petted them
      const breath = Math.sin(t * s.breath * (1 + up * 0.8));
      if (s.body) s.body.scale.multiply(V(1 - breath * 0.012, 1 + breath * 0.03, 1 - breath * 0.012));
      else s.root.scale.setScalar(1).multiply(V(1, 1 + breath * 0.025, 1)); // the dock cat is all one piece
      if (s.head) {
        s.head.position.y += up * 0.05 + breath * 0.004;
        s.head.rotation.y += up * Math.sin(t * 0.9) * 0.15; // a sleepy look round
      }
      if (s.tail) {
        // a twitch of the tip now and then (a cat), or thump-thump on the rug (the dog)
        const twitch = Math.max(0, Math.sin(t * 0.7) - 0.85) * 3;
        s.tail.rotation.y += s.cat
          ? (twitch + up * 0.6) * Math.sin(t * 6) * 0.25
          : s.wag * Math.sin(t * 14) * 0.45 + twitch * 0.1;
      }
      if ((s.zzz -= dt) <= 0) {
        s.zzz = rand(4, 8);
        const at = s.root.getWorldPosition(V()).add(V(0, 0.05, 0));
        for (let i = 0; i < 2; i++) this.floaters.add('zzz', at, i);
      }
    }
    this.floaters.update(dt);
  }
}
