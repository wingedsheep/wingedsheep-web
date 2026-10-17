/**
 * The island's weather, up on the hailstones: you're above the cloud, so its rain stays under you,
 * but hail and snow come down out of the cloud over you, past the stones. Hail is quick and
 * bounces where it hits a stone's top, twice, a little less each time, before it lies; snow
 * drifts down and lies where it lands. Whatever lies on a stone whitens its top. Both go on down
 * into the cloud if they miss. A texel each, as the island's are.
 */
import * as THREE from 'three';

const MOST = 640;
/** How far in front of the stones and behind them it falls (m): the stones are at 0, a radius deep. */
const NEAR = 5;
const FAR = -9;
const HAIL = new THREE.Color('#e9eef8');
const SNOW = new THREE.Color('#d8def2');

/** What a grain can land on: a stone's top under it (m) and which stone, or nothing. */
export type Under = (x: number, z: number) => { top: number; i: number } | null;

export class Squall {
  readonly points: THREE.Points;
  private pos = new Float32Array(MOST * 3);
  private col = new Float32Array(MOST * 3);
  private vel = new Float32Array(MOST * 3);
  /** −1 not falling; 0 falling; then the hops it's made; a snowflake's lying is its last. */
  private hops = new Int8Array(MOST).fill(-1);
  private snow = new Uint8Array(MOST);
  private wob = new Float32Array(MOST);
  private time = 0;
  /** Just come up, or just begun: the first ones anywhere in the picture, not all at its top. */
  private fresh = true;

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          // (one texel, and the ones not falling off screen)
          gl_PointSize = 1.0;
          if (color.r < 0.01) gl_Position = vec4(9.0, 9.0, 9.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() { gl_FragColor = vec4(vColor, 1.0); }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** None in the air (going up, or a new number). */
  clear() {
    this.hops.fill(-1);
    this.col.fill(0);
    this.fresh = true;
  }

  /**
   * On: how much hail and snow (0..1), the wind (0..1, from the west), the picture's box in the
   * world (left, right, top, and the cloud's top), what's under a grain, and each hailstone's hop
   * on a stone (the stone, and how hard: 1 for the first, less after) and each grain that comes to
   * lie on one.
   */
  update(
    dt: number,
    o: { hail: number; snow: number; wind: number; left: number; right: number; top: number; cloud: number },
    under: Under,
    onHop: (i: number, hard: number) => void,
    onLie: (i: number) => void,
  ) {
    this.time += dt;
    const want = Math.round(MOST * Math.min(1, o.hail + o.snow * 0.8));
    const share = o.hail / Math.max(0.001, o.hail + o.snow);
    const blow = 0.6 + o.wind * 3.5;
    let falling = 0;
    for (let k = 0; k < MOST; k++) if (this.hops[k] >= 0) falling++;
    const span = o.right - o.left;
    for (let k = 0; k < MOST; k++) {
      const p = k * 3;
      if (this.hops[k] < 0) {
        // (a new one, at the top of the picture or anywhere in it at first, a few a frame so they don't come in a sheet)
        if (falling >= want || (!this.fresh && Math.random() > 0.08 + dt * 4)) continue;
        falling++;
        const snow = Math.random() > share;
        this.snow[k] = snow ? 1 : 0;
        this.hops[k] = 0;
        this.wob[k] = Math.random() * 6.28;
        this.pos[p] = o.left - span * 0.15 + Math.random() * span * 1.3;
        this.pos[p + 1] = this.fresh ? o.cloud + Math.random() * (o.top - o.cloud) : o.top + Math.random() * (snow ? 4 : 10);
        this.pos[p + 2] = FAR + Math.random() * (NEAR - FAR);
        this.vel[p] = blow * (snow ? 0.8 : 0.5) * (0.8 + Math.random() * 0.4);
        this.vel[p + 1] = snow ? -(0.9 + Math.random() * 0.5) : -(9 + Math.random() * 4);
        this.vel[p + 2] = 0;
        const c = snow ? SNOW : HAIL;
        const dim = 0.75 + Math.random() * 0.25;
        this.col[p] = c.r * dim;
        this.col[p + 1] = c.g * dim;
        this.col[p + 2] = c.b * dim;
        continue;
      }
      const was = this.pos[p + 1];
      if (this.snow[k]) {
        // (a flake wanders as it comes down)
        this.pos[p] += (this.vel[p] + Math.sin(this.time * 1.7 + this.wob[k]) * 0.5) * dt;
        this.pos[p + 1] += this.vel[p + 1] * dt;
      } else {
        this.vel[p + 1] -= 30 * dt;
        this.pos[p] += this.vel[p] * dt;
        this.pos[p + 1] += this.vel[p + 1] * dt;
        this.pos[p + 2] += this.vel[p + 2] * dt;
      }
      const now = this.pos[p + 1];
      // landing on a stone's top
      if (this.vel[p + 1] < 0) {
        const on = under(this.pos[p], this.pos[p + 2]);
        if (on && was >= on.top && now < on.top) {
          this.pos[p + 1] = on.top;
          const hops = this.hops[k];
          if (this.snow[k] || hops >= 2) {
            onLie(on.i);
            this.gone(k);
            continue;
          }
          onHop(on.i, hops ? 0.4 : 1);
          this.hops[k] = hops + 1;
          // (up again, less each time, and off at an angle)
          this.vel[p + 1] = -this.vel[p + 1] * (hops ? 0.2 : 0.32);
          this.vel[p] = this.vel[p] * 0.5 + (Math.random() - 0.5) * 2.4;
          this.vel[p + 2] = (Math.random() - 0.5) * 2.4;
          continue;
        }
      }
      // into the cloud, or blown out of the picture: gone
      if (now < o.cloud - 0.3 || this.pos[p] > o.right + span * 0.3) this.gone(k);
    }
    if (want) this.fresh = false;
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }

  private gone(k: number) {
    this.hops[k] = -1;
    this.col[k * 3] = 0;
  }
}
