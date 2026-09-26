import * as THREE from 'three';
import { occasions, remembranceAt } from './calendar';
import type { Island } from './island';

const DROP = 0.35; // how far down the pole the flag comes for half-mast
const LOWER = 0.25; // metres a second, hauling it down

/**
 * The fourth of May, Dodenherdenking. From six in the evening the summit flag flies at half-mast,
 * as it does from every flagpole in the country; at eight the island keeps two minutes' silence:
 * the sound fades right away (main.ts turns `silence` into a hush on everything), and Vincent,
 * who stays at the fire for it (vincent.ts), stops playing, stands his guitar against the log
 * beside him and bows his head. After the two minutes the sound comes back. The flag stays down
 * till the end of the day; on the fifth it's back up, with bunting (holidays.py `liberation`).
 */
export class Remembrance {
  private flag?: THREE.Object3D;
  private flagY = 0;
  private lowered = 0;
  private guitar?: THREE.Object3D;
  private head?: THREE.Object3D;
  private rest?: { p: THREE.Vector3; r: THREE.Euler };
  /** 0 normally, 1 in the silence (eased at either end). */
  silence = 0;
  /** Whether it's the day at all (nothing else to do otherwise). */
  readonly on: boolean;
  private settled = false;

  constructor(island: Island) {
    this.on = occasions.has('remembrance');
    this.flag = island.part('summit', 'flag');
    if (this.flag) this.flagY = this.flag.position.y;
    this.guitar = island.part('vincent', 'guitar');
    this.head = island.part('vincent', 'head');
    if (this.guitar) this.rest = { p: this.guitar.position.clone(), r: this.guitar.rotation.clone() };
  }

  /** Call after Life has posed Vincent for this frame. `time`: island time (ms). */
  update(dt: number, time: number) {
    if (!this.on) return;
    const { halfMast, silence } = remembranceAt(time);
    this.silence = silence;
    // hauled down slowly the first time you see it happen; already down if you arrive after six
    const want = halfMast ? 1 : 0;
    if (!this.settled) {
      this.lowered = want;
      this.settled = true;
    }
    this.lowered = want > this.lowered ? Math.min(want, this.lowered + (dt * LOWER) / DROP) : want;
    if (this.flag) this.flag.position.y = this.flagY - this.lowered * DROP;

    const g = this.guitar;
    const rest = this.rest;
    if (!g || !rest) return;
    const k = THREE.MathUtils.smoothstep(silence, 0, 1);
    if (k <= 0) {
      if (!g.position.equals(rest.p)) {
        g.position.copy(rest.p);
        g.rotation.copy(rest.r);
      }
      return;
    }
    // stood on its end against the log at his left, the neck leaning in towards him
    g.position.lerpVectors(rest.p, new THREE.Vector3(0.62, 0.45, 0.1), k);
    g.rotation.set(rest.r.x * (1 - k), rest.r.y * (1 - k), THREE.MathUtils.lerp(rest.r.z, Math.PI / 2 + 0.2, k));
    if (this.head) {
      this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0.4, k);
      this.head.rotation.z *= 1 - k;
    }
  }
}
