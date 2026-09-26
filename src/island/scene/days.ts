import * as THREE from 'three';
import { Airborne } from './airborne';
import { Easter } from './easter';
import type { Island } from './island';
import { Lanterns } from './lanterns';
import type { Life } from './life';
import { Remembrance } from './remembrance';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * What happens on the special days that isn't just a thing put out (holidays.py does those):
 * the Easter egg hunt, the fourth of May's half-mast and silence, the fair folk's Sint
 * Maarten lanterns, and the Airborne commemoration's parachutes. (The New Year's dive is one of
 * Vincent's spots: dive.ts.) Each does nothing on any other day.
 */
export class Days {
  readonly easter: Easter;
  readonly remembrance: Remembrance;
  readonly lanterns: Lanterns;
  readonly airborne: Airborne;

  constructor(
    scene: THREE.Scene,
    island: Island,
    life: Life,
  ) {
    const { beike, particles, fauna } = life;
    this.easter = new Easter(island, beike, particles);
    this.easter.onBark = () => beike.onBark?.();
    this.remembrance = new Remembrance(island);
    this.lanterns = new Lanterns(scene, island, (s) => fauna.template(s), beike.ground, particles);
    this.lanterns.onCall = (call, at, ambient, loud) => fauna.onCall?.(call, at, ambient, loud);
    this.airborne = new Airborne(scene, island);
    // the New Year's dive: a splash going in, and another coming up
    life.vincent.diver.onSplash = (at) => {
      fauna.onCall?.('splash', at, true);
      for (let i = 0; i < 26; i++) {
        const a = rand(0, Math.PI * 2);
        const v = V(Math.cos(a) * rand(0.4, 1.4), rand(1.5, 3.2), Math.sin(a) * rand(0.4, 1.4));
        particles.emit({ position: at.clone().add(V(0, 0.2, 0)), velocity: v, color: i % 3 ? '#e8f4ff' : '#ffffff', life: rand(0.5, 0.9), gravity: 7, fadeIn: 0, size: i % 4 ? 1 : 2 });
      }
    };
  }

  /** Every frame, after Life's own update (Vincent's pose, for the silence). `time`: island time (ms). */
  update(dt: number, time: number, o: { night: number; wet: number; rain: number; wind: number }, still = false) {
    const d = new Date(time);
    const hour = d.getHours() + d.getMinutes() / 60;
    this.remembrance.update(dt, time);
    if (still) return; // reduced motion: the flag still comes down, but nobody runs about
    this.lanterns.update(dt, o.night, o.wet, hour);
    this.airborne.update(dt, hour, o.rain, o.wind);
  }

  /** Everyone out and about who can be clicked, for the Picker. */
  get pickables() {
    return this.lanterns.pickables;
  }
}
