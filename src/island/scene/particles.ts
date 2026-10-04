import * as THREE from 'three';

export interface ParticleSpec {
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  color: THREE.ColorRepresentation;
  life: number; // seconds
  size?: number; // in art pixels (render-target texels)
  /** Its size in the world (m), for one that should grow as you zoom in, like a leaf; `size` is then the least it shows as. */
  span?: number;
  gravity?: number;
  wobble?: number;
  /** How quickly it slows in the air (1/s): a firework's stars bloom out and hang. */
  drag?: number;
  /** How much of its life it takes to come up to full brightness (default 0.15; 0 for a spark that's there at once). */
  fadeIn?: number;
  /** How much of its life it stays at full brightness before it starts to fade (default 0). */
  hold?: number;
  /**
   * How readily it goes with the wind (1/s; default 0, it keeps its own velocity): a leaf eases
   * towards the Particles' `wind` sideways, and towards sinking at `sink` (plus the wind's lift)
   * with a seesaw in it, so it answers every gust while it's in the air.
   */
  windy?: number;
  /** For a windy one: how fast it sinks in still air (m/s). */
  sink?: number;
  /**
   * A leaf, given how hard it's blowing (0..1): drawn leaf-shaped, and coming down like one,
   * swinging from side to side (dropping through the middle of each swing, hanging at the ends)
   * and rocking as it goes, or tumbling over and over, as more of them do in a wind.
   */
  leaf?: number;
  /** The height it's down at (m): there it's gone in a moment, rather than on through the ground. */
  floor?: number;
}

/**
 * Keep a points material's `texelsPerMetre` uniform up to date: how many texels a metre is, from
 * the (orthographic) camera and the target it's drawn into, for points sized in the world.
 */
export function measureTexels(points: THREE.Points, mat: THREE.ShaderMaterial) {
  points.onBeforeRender = (renderer, _scene, camera) => {
    const cam = camera as THREE.OrthographicCamera;
    const height = renderer.getRenderTarget()?.height ?? renderer.domElement.height;
    if (cam.isOrthographicCamera) mat.uniforms.texelsPerMetre.value = (height * cam.zoom) / (cam.top - cam.bottom);
  };
}

/**
 * Single-texel particles: GL points sized in render-target pixels, so every ember and firefly
 * is one crisp art pixel. A leaf is the exception: as big as a leaf, and shaped like one.
 */
export class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private span: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private grav: Float32Array;
  private wob: Float32Array;
  private drag: Float32Array;
  private rise: Float32Array;
  private keep: Float32Array;
  private windy: Float32Array;
  private sink: Float32Array;
  private floor: Float32Array;
  // a leaf's: whether it is one, how it swings (how far, how fast, which way), how fast it
  // tumbles (0 for one that glides), the way it points, and where it is in its swing
  private leaf: Float32Array;
  private swing: Float32Array;
  private pace: Float32Array;
  private axis: Float32Array;
  private spin: Float32Array;
  private turn: Float32Array;
  private phase: Float32Array;
  /** Drawn: the way a leaf points on screen, and how much of its face shows (negative, its underside). */
  private angle: Float32Array;
  private face: Float32Array;
  /** The air the windy ones go with (m/s): sideways the wind, upwards a gust's lift. Set it each frame. */
  readonly wind = new THREE.Vector3();
  private next = 0;
  private clock = 0;

  constructor(private max = 1200) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.span = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.wob = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.rise = new Float32Array(max);
    this.keep = new Float32Array(max);
    this.windy = new Float32Array(max);
    this.sink = new Float32Array(max);
    this.floor = new Float32Array(max);
    this.leaf = new Float32Array(max);
    this.swing = new Float32Array(max);
    this.pace = new Float32Array(max);
    this.axis = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.turn = new Float32Array(max);
    this.phase = new Float32Array(max);
    this.angle = new Float32Array(max);
    this.face = new Float32Array(max).fill(1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('span', new THREE.BufferAttribute(this.span, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('leaf', new THREE.BufferAttribute(this.leaf, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('angle', new THREE.BufferAttribute(this.angle, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('face', new THREE.BufferAttribute(this.face, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { texelsPerMetre: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float texelsPerMetre;
        attribute float size;
        attribute float span;
        attribute float leaf;
        attribute float angle;
        attribute float face;
        attribute vec4 color;
        varying vec4 vColor;
        varying vec3 vLeaf; // is it one, the way it points, how much of its face shows
        varying float vSize;
        void main() {
          vColor = color;
          vLeaf = vec3(leaf, angle, face);
          vSize = max(size, floor(span * texelsPerMetre + 0.5));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = vSize;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        varying vec3 vLeaf;
        varying float vSize;
        void main() {
          if (vColor.a < 0.02) discard;
          vec4 c = vColor;
          if (vLeaf.x > 0.5) {
            // pointed at both ends, as wide as it's turned towards you; the middle texel or four
            // always stay, so edge-on it's a sliver rather than gone
            vec2 p = gl_PointCoord - 0.5;
            float u = cos(vLeaf.y) * p.x + sin(vLeaf.y) * p.y;
            float v = -sin(vLeaf.y) * p.x + cos(vLeaf.y) * p.y;
            float w = 0.3 * max(abs(vLeaf.z), 0.15) * (1.0 - 4.0 * u * u);
            bool middle = max(abs(p.x), abs(p.y)) <= 0.5 / vSize + 0.001;
            if (!middle && (abs(u) > 0.5 || abs(v) > w)) discard;
            if (vLeaf.z < 0.0) c.rgb *= 0.75; // the paler, duller underside
          }
          gl_FragColor = c;
          #include <colorspace_fragment>
        }
      `,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.raycast = () => {};
    measureTexels(this.points, mat);
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
    this.span[i] = s.span ?? 0;
    this.age[i] = 0;
    this.life[i] = s.life;
    this.grav[i] = s.gravity ?? 0;
    this.wob[i] = s.wobble ?? 0;
    this.drag[i] = s.drag ?? 0;
    this.rise[i] = s.fadeIn ?? 0.15;
    this.keep[i] = s.hold ?? 0;
    this.windy[i] = s.windy ?? 0;
    this.sink[i] = s.sink ?? 0;
    this.floor[i] = s.floor ?? -Infinity;
    this.leaf[i] = s.leaf === undefined ? 0 : 1;
    if (s.leaf !== undefined) {
      const blow = s.leaf;
      this.swing[i] = (0.2 + Math.random() * 0.35) * (1 - blow * 0.6);
      this.pace[i] = 2.2 + Math.random() * 1.4;
      this.axis[i] = Math.random() * Math.PI * 2;
      this.spin[i] = Math.random() < 0.25 + blow * 0.6 ? (4 + Math.random() * 5) * (Math.random() < 0.5 ? -1 : 1) : 0;
      this.turn[i] = Math.random() * Math.PI * 2;
      this.phase[i] = Math.random() * Math.PI * 2;
    }
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
      if (this.windy[i]) {
        // carried along, and sinking in fits and starts as it seesaws (a leaf has its own swing for that)
        const k = 1 - Math.exp(-this.windy[i] * dt);
        const seesaw = this.leaf[i] ? 1 : 1 + Math.sin(this.clock * 3.1 + i * 1.7) * 0.7;
        this.vel[i * 3] += (this.wind.x - this.vel[i * 3]) * k;
        this.vel[i * 3 + 1] += (this.wind.y - this.sink[i] * seesaw - this.vel[i * 3 + 1]) * k;
        this.vel[i * 3 + 2] += (this.wind.z - this.vel[i * 3 + 2]) * k;
      }
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      const w = this.wob[i] ? Math.sin(this.clock * 2.3 + i) * this.wob[i] * dt : 0;
      this.pos[i * 3] += this.vel[i * 3] * dt + w;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      // a windy one swings both ways, round and round as it falls
      const wz = this.windy[i] && this.wob[i] ? Math.cos(this.clock * 2.3 + i) * this.wob[i] * dt : 0;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt + wz;
      if (this.leaf[i]) {
        // a leaf swings from side to side like a pendulum, dropping fast through the middle of the
        // swing and all but stopping at the ends, rocking with it; a tumbling one turns over and
        // over, face and underside, and swings less
        const th = this.age[i] * this.pace[i] + this.phase[i];
        const c = Math.cos(th);
        const tumbling = this.spin[i] !== 0;
        const along = this.swing[i] * (tumbling ? 0.4 : 1) * this.pace[i] * c * dt;
        this.pos[i * 3] += Math.cos(this.axis[i]) * along;
        this.pos[i * 3 + 2] += Math.sin(this.axis[i]) * along;
        this.pos[i * 3 + 1] += this.sink[i] * (tumbling ? 0 : 0.8 - 1.6 * c * c) * dt;
        this.angle[i] = this.turn[i] + (tumbling ? this.age[i] * this.spin[i] * 0.3 : Math.sin(th) * 0.6);
        this.face[i] = tumbling ? Math.cos(this.age[i] * this.spin[i] + this.phase[i]) : 0.55 + 0.45 * Math.abs(c);
      }
      if (this.pos[i * 3 + 1] < this.floor[i]) {
        // down: gone over a moment, from here
        this.floor[i] = -Infinity;
        this.life[i] = Math.min(this.life[i], this.age[i] + 0.4);
        this.keep[i] = this.age[i] / this.life[i];
      }
      const f = this.age[i] / this.life[i];
      const r = this.rise[i];
      const k = Math.max(r, this.keep[i]);
      this.col[i * 4 + 3] = f < r ? f / r : f < k ? 1 : 1 - (f - k) / (1 - k);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.span.needsUpdate = true;
    g.attributes.leaf.needsUpdate = true;
    g.attributes.angle.needsUpdate = true;
    g.attributes.face.needsUpdate = true;
  }
}
