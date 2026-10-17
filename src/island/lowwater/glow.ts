/**
 * The water at night. When it's deep night on the island, the flat's shallows are full of
 * noctiluca, not just the tide pool: every step you take in the water lights a scatter of specks
 * round your foot, and the oars light it where the blades go in. Each speck flares, dims, and goes
 * out in a few seconds, so the only light on the water is the last few steps of the way you came.
 */
import * as THREE from 'three';

/** How many specks there can be lit at once. */
const MANY = 260;
/** A speck's life (s): bright this long, then dim, then out, each a little different. */
const BRIGHT = 0.7;
const LIFE: [number, number] = [2.2, 4.2];

export class Glow {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private age = new Float32Array(MANY).fill(99);
  private life = new Float32Array(MANY).fill(1);
  private level: THREE.BufferAttribute;
  private next = 0;
  /** When something last lit the water (s ago). */
  litAgo = 99;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MANY * 3), 3));
    this.level = new THREE.Float32BufferAttribute(new Float32Array(MANY), 1);
    geo.setAttribute('level', this.level);
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float level;
        varying float vLevel;
        void main() {
          vLevel = level;
          gl_PointSize = level > 2.5 ? 2.0 : 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      // (the pool's two colours, and a deeper one for the last of it)
      fragmentShader: /* glsl */ `
        varying float vLevel;
        void main() {
          if (vLevel < 0.5) discard;
          gl_FragColor = vec4(vLevel > 1.5 ? vec3(0.72, 0.98, 1.0) : vLevel > 0.9 ? vec3(0.3, 0.72, 0.86) : vec3(0.2, 0.46, 0.64), 1.0);
        }
      `,
      depthWrite: false,
      fog: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.renderOrder = 4;
    this.points.frustumCulled = false;
  }

  /** Something's gone into the water at (x, z) at height y: light `n` specks within `r` of it. */
  light(x: number, y: number, z: number, n: number, r: number) {
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MANY;
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      pos.setXYZ(i, x + Math.cos(a) * d, y, z + Math.sin(a) * d * 0.8);
      // (the ones nearest the foot flare longest)
      this.age[i] = (d / r) * BRIGHT * 0.6;
      this.life[i] = LIFE[0] + Math.random() * (LIFE[1] - LIFE[0]);
    }
    pos.needsUpdate = true;
    this.litAgo = 0;
  }

  update(dt: number) {
    this.litAgo += dt;
    let any = false;
    for (let i = 0; i < MANY; i++) {
      const age = (this.age[i] += dt);
      const k = age / this.life[i];
      // flare, dim, the last of it, out: in steps, and the dim ones flicker on and off as they go
      const flick = Math.random() < k * 0.5 ? 1 : 0;
      const level = age < BRIGHT ? 3 : k < 0.45 ? 2 : k < 0.8 ? 1 - flick : k < 1 ? (flick ? 0 : 0.6) : 0;
      if (level) any = true;
      this.level.setX(i, level);
    }
    this.level.needsUpdate = true;
    this.points.visible = any;
  }
}
