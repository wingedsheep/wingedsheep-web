import * as THREE from 'three';
import type { Island } from './island';

export type Pet = 'cats' | 'beike';
export const PETS: Pet[] = ['cats', 'beike'];
type Who = 'vincent' | 'companion';

/**
 * Now and then Vincent or she kneels in the grass to pet the cats on their bench, or Beike in
 * his meadow (vincent.ts, companion.ts): one of them at each at a time. `there` is whether each
 * is there to be petted (life.ts sets it): the cats asleep on the bench, Beike out of the rain.
 */
export const petting = {
  by: { cats: null, beike: null } as Record<Pet, Who | null>,
  there: { cats: true, beike: true } as Record<Pet, boolean>,
  /** The ones `who` could be petting now: there, and nobody else at them. */
  open(who: Who): Pet[] {
    return PETS.filter((p) => this.there[p] && (this.by[p] ?? who) === who);
  },
};

/**
 * One of them on their knees (characters.py PETTING): at the bench or in the meadow, or neither.
 * Long slow strokes, head to tail, the hand lifting on the way back; now and then a look up.
 */
export class Kneeling {
  pet: Pet | null = null;
  private groups = new Map<Pet, THREE.Object3D>();
  private parts = new Map<string, { o: THREE.Object3D; rest: THREE.Euler }>();

  constructor(
    island: Island,
    private who: Who,
  ) {
    for (const pet of PETS) {
      const g = island.get(`${who}_petting_${pet}`);
      if (!g) continue;
      this.groups.set(pet, g);
      for (const part of ['stroke', 'head']) {
        const o = g.getObjectByName(`${who}_petting_${pet}_${part}`);
        if (o) this.parts.set(`${pet}_${part}`, { o, rest: o.rotation.clone() });
      }
    }
    this.set(null);
  }

  /** Down by `pet`, or (null) up and off somewhere else. */
  set(pet: Pet | null) {
    if (this.pet && petting.by[this.pet] === this.who) petting.by[this.pet] = null;
    this.pet = pet;
    if (pet) petting.by[pet] = this.who;
    for (const [p, g] of this.groups) g.visible = p === pet;
  }

  /** Where they kneel to pet `pet`. */
  at(pet: Pet) {
    return this.groups.get(pet);
  }

  /** The head, for breath on a cold day. */
  get head() {
    return this.pet ? this.parts.get(`${this.pet}_head`)?.o : undefined;
  }

  /** `noticed` (0..1): looking up at whoever clicked. */
  animate(t: number, noticed = 0) {
    if (!this.pet) return;
    const arm = this.part('stroke');
    const head = this.part('head');
    // George's head is to their right, Beike's to their left: stroke away from it
    const way = this.pet === 'cats' ? 1 : -1;
    const p = t * 1.3;
    if (arm) {
      arm.rotation.y += way * -Math.cos(p) * 0.3;
      arm.rotation.x -= Math.max(0, -Math.sin(p)) * 0.14;
    }
    if (head) {
      head.rotation.y += Math.sin(t * 0.4) * 0.12;
      head.rotation.z += Math.sin(t * 0.7) * 0.08; // aww
      head.rotation.x -= noticed * 0.45 + Math.max(0, Math.sin(t * 0.15 - 1) - 0.8) * 1.5;
    }
  }

  private part(name: string) {
    const p = this.parts.get(`${this.pet}_${name}`);
    p?.o.rotation.copy(p.rest);
    return p?.o;
  }
}
