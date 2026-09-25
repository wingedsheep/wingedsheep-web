import * as THREE from 'three';
import { Particles } from './particles';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const OVERCAST = new THREE.Color('#7d8a99');
const STORMY = new THREE.Color('#4a5566');
const FLASH = new THREE.Color('#eef2ff');

/** What the weather is doing outside (weather.ts `now`), as much as a room needs to know. */
export interface Outside {
  cloud: number;
  rain: number;
  hail: number;
  snow: number;
  storm: number;
  flash: number;
}

interface Pane {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  /** Into the room, off the glass. */
  inward: THREE.Vector3;
}

/**
 * The weather, seen from indoors, and only ever through the windows: a grey sky in the glass
 * when it's overcast, rain (or snow) coming down beyond it, drops beading and running down the
 * panes, and lightning flashing in them and lighting the whole room for a moment.
 */
export class Windows {
  private particles = new Particles(500);
  private panes: Pane[] = [];
  private uniforms = { uTime: { value: 0 }, uRain: { value: 0 }, uSnow: { value: 0 } };

  /** `glass` are the window meshes, all sharing `material`; `bounds` is the room. */
  constructor(scene: THREE.Scene, glass: THREE.Mesh[], material: THREE.MeshBasicMaterial, bounds: THREE.Box3) {
    const centre = bounds.getCenter(V());
    for (const mesh of glass) {
      const geo = mesh.geometry;
      const pos = geo.getAttribute('position');
      const index = geo.index;
      const count = index ? index.count : pos.count;
      const at = (i: number) => V().fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      for (let i = 0; i + 2 < count; i += 3) {
        const a = at(i);
        const b = at(i + 1);
        const c = at(i + 2);
        const n = V().subVectors(b, a).cross(V().subVectors(c, a));
        if (n.lengthSq() < 1e-8) continue;
        n.normalize();
        if (Math.abs(n.y) > 0.5) continue; // the top and bottom edges of a pane: nothing runs down those
        const mid = a.clone().add(b).add(c).divideScalar(3);
        if (n.dot(V().subVectors(centre, mid)) < 0) n.negate();
        this.panes.push({ a, b, c, inward: n.multiplyScalar(0.03) });
      }
    }
    this.weatherIn(material);
    scene.add(this.particles.points);
  }

  /** The sky in the glass, greyed by cloud and lit by lightning. */
  tint(sky: THREE.Color, out: Outside) {
    sky.lerp(OVERCAST, out.cloud * 0.55).lerp(STORMY, out.storm * 0.5).lerp(FLASH, out.flash * 0.85);
  }

  update(dt: number, out: Outside) {
    const rain = Math.min(1, out.rain + out.hail);
    this.uniforms.uTime.value += dt;
    this.uniforms.uRain.value = rain;
    this.uniforms.uSnow.value = out.snow;
    this.onGlass(dt, rain, out.snow);
    this.particles.update(dt);
  }

  /**
   * Rain and snow beyond the glass, drawn in the glass itself so it only shows through a window:
   * streaks in columns, each falling at its own speed, and flakes drifting down more slowly.
   */
  private weatherIn(material: THREE.MeshBasicMaterial) {
    const u = this.uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */ `#include <common>
          varying vec3 vWorld;
          uniform float uTime, uRain, uSnow;
          float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
          // one layer of streaks: columns across the pane, each with its own speed and phase
          float streaks(float across, float up, float cols, float speed, float len) {
            float c = floor(across * cols);
            float on = step(1.0 - uRain, h1(c + 3.1) * 0.85 + 0.1);
            float y = fract(up * 1.3 + uTime * speed * (0.8 + h1(c) * 0.5) + h1(c + 7.7));
            return on * step(1.0 - len, y);
          }
          float flakes(float across, float up) {
            vec2 cell = floor(vec2(across * 9.0 + sin(uTime * 0.7 + up * 3.0) * 0.4, up * 9.0 + uTime * 0.9));
            return step(1.0 - uSnow * 0.18, h1(cell.x * 31.7 + cell.y * 7.3));
          }`)
        .replace('#include <dithering_fragment>', /* glsl */ `#include <dithering_fragment>
          float across = vWorld.x + vWorld.z;
          float s = streaks(across, vWorld.y, 14.0, 2.6, 0.22) * 0.55 + streaks(across + 0.37, vWorld.y, 23.0, 3.4, 0.14) * 0.35;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.82, 0.88, 0.95), min(1.0, s));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.97), flakes(across, vWorld.y));`);
    };
    material.needsUpdate = true;
  }

  /** Drops beading and running down the panes, flakes catching on them. */
  private onGlass(dt: number, rain: number, snow: number) {
    const n = this.panes.length ? (rain * 70 + snow * 25) * dt : 0;
    for (let i = Math.floor(n + Math.random()); i > 0; i--) {
      const p = this.panes[Math.floor(Math.random() * this.panes.length)];
      const at = this.pointOn(p);
      if (Math.random() < rain / (rain + snow + 1e-6)) {
        this.particles.emit({
          position: at,
          velocity: V(rand(-0.01, 0.01), -rand(0.05, 0.15), rand(-0.01, 0.01)),
          gravity: -rand(0.1, 0.6), // a bead first, then a quick run
          color: Math.random() < 0.3 ? '#e6f0fa' : '#a9c2d9',
          life: rand(0.7, 1.4),
        });
      } else {
        this.particles.emit({
          position: at,
          velocity: V(rand(-0.01, 0.01), -rand(0.01, 0.03), rand(-0.01, 0.01)),
          color: '#f4f6fb',
          life: rand(1.5, 2.5),
        });
      }
    }
  }

  private pointOn(p: Pane) {
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) [u, v] = [1 - u, 1 - v];
    return p.a.clone()
      .addScaledVector(V().subVectors(p.b, p.a), u)
      .addScaledVector(V().subVectors(p.c, p.a), v)
      .add(p.inward);
  }
}
