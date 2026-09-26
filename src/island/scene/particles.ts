import * as THREE from 'three';

export interface ParticleSpec {
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  color: THREE.ColorRepresentation;
  life: number; // seconds
  size?: number; // in art pixels (render-target texels)
  gravity?: number;
  wobble?: number;
  /** How quickly it slows in the air (1/s): a firework's stars bloom out and hang. */
  drag?: number;
  /** How much of its life it takes to come up to full brightness (default 0.15; 0 for a spark that's there at once). */
  fadeIn?: number;
  /** How much of its life it stays at full brightness before it starts to fade (default 0). */
  hold?: number;
}

/**
 * Single-texel particles: GL points sized in render-target pixels, so every ember and firefly
 * is one crisp art pixel.
 */
export class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private grav: Float32Array;
  private wob: Float32Array;
  private drag: Float32Array;
  private rise: Float32Array;
  private keep: Float32Array;
  private next = 0;
  private clock = 0;

  constructor(private max = 1200) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.wob = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.rise = new Float32Array(max);
    this.keep = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec4 color;
        varying vec4 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        void main() {
          if (vColor.a < 0.02) discard;
          gl_FragColor = vColor;
          #include <colorspace_fragment>
        }
      `,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.raycast = () => {};
  }

  emit(s: ParticleSpec) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([s.position.x, s.position.y, s.position.z], i * 3);
    const v = s.velocity ?? new THREE.Vector3();
    this.vel.set([v.x, v.y, v.z], i * 3);
    const c = new THREE.Color(s.color);
    this.col.set([c.r, c.g, c.b, 0], i * 4);
    this.size[i] = s.size ?? 1;
    this.age[i] = 0;
    this.life[i] = s.life;
    this.grav[i] = s.gravity ?? 0;
    this.wob[i] = s.wobble ?? 0;
    this.drag[i] = s.drag ?? 0;
    this.rise[i] = s.fadeIn ?? 0.15;
    this.keep[i] = s.hold ?? 0;
  }

  update(dt: number) {
    this.clock += dt;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.life[i] = 0;
        this.col[i * 4 + 3] = 0;
        continue;
      }
      if (this.drag[i]) {
        const k = Math.exp(-this.drag[i] * dt);
        this.vel[i * 3] *= k;
        this.vel[i * 3 + 1] *= k;
        this.vel[i * 3 + 2] *= k;
      }
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      const w = this.wob[i] ? Math.sin(this.clock * 2.3 + i) * this.wob[i] * dt : 0;
      this.pos[i * 3] += this.vel[i * 3] * dt + w;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const r = this.rise[i];
      const k = Math.max(r, this.keep[i]);
      this.col[i * 4 + 3] = t < r ? t / r : t < k ? 1 : 1 - (t - k) / (1 - k);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
  }
}
