/**
 * A curlew somewhere out on the far banks: never seen, only heard. It calls now and then, from
 * well off the route, and sometimes twice; between calls it may have flown to another bank. In a
 * wind or rain it keeps quieter. Where it is only matters for how it sounds: which side, how far.
 */
import * as THREE from 'three';

/** Banks well off the way out, where it might be (x east, z south, like the rest of the flat). */
const BANKS = [
  new THREE.Vector2(-62, -38), new THREE.Vector2(58, -58), new THREE.Vector2(-74, -92),
  new THREE.Vector2(64, -112), new THREE.Vector2(34, -156), new THREE.Vector2(-44, -164),
];
/** How long before the first call after you come out (s), and between calls on a still evening. */
const FIRST: [number, number] = [18, 34];
const BETWEEN: [number, number] = [45, 110];

const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);

export class Curlew {
  private at = BANKS[Math.floor(Math.random() * BANKS.length)];
  private wait = between(FIRST);
  /** Seconds since it was last actually heard (it isn't, with the sound off). */
  heardAgo = Infinity;

  /**
   * Counting down to the next call. `call` is given how near it is (1 … 0) and which side
   * (-1 … 1), and says whether it was heard.
   */
  update(dt: number, you: THREE.Vector2, weather: { wind: number; rain: number }, call: (near: number, pan: number) => boolean) {
    this.heardAgo += dt;
    this.wait -= dt;
    if (this.wait > 0) return;
    const dx = this.at.x - you.x;
    const d = Math.hypot(dx, this.at.y - you.y);
    if (call(1 / (1 + (d / 70) ** 2), (dx / Math.max(d, 1)) * 0.9)) this.heardAgo = 0;
    // now and then it calls again straight away; otherwise it may move on before the next
    if (Math.random() < 0.3) this.wait = 5 + Math.random() * 3;
    else {
      this.wait = between(BETWEEN) * (1 + weather.wind * 2 + weather.rain * 2);
      if (Math.random() < 0.5) this.at = BANKS[Math.floor(Math.random() * BANKS.length)];
    }
  }
}
