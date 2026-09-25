import * as THREE from 'three';
import type { Island } from './island';
import { GRADIENT } from './toon';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Icicle {
  at: THREE.Vector3; // where it hangs from, world
  length: number; // full grown
  width: number;
  from: number; // how cold (chill 0..1) before it starts to grow…
  to: number; // …and how cold before it's full grown
}

/**
 * Icicles along the eaves of the roofs (marked in tools/models/kit.py), growing as it freezes
 * harder, the long ones only in a real cold snap, and shrinking back as it thaws.
 */
export class Icicles {
  private mesh: THREE.InstancedMesh;
  private icicles: Icicle[] = [];
  private grown = -1;

  constructor(scene: THREE.Scene, island: Island) {
    const p = new THREE.Vector3();
    for (const eave of island.eaves) {
      const count = Math.round(eave.length * 1.8);
      for (let i = 0; i < count; i++) {
        if (Math.random() < 0.3) continue; // gaps
        p.set(((i + rand(0.2, 0.8)) / count - 0.5) * eave.length, 0, 0).applyMatrix4(eave.matrix);
        const from = rand(0.35, 0.75);
        this.icicles.push({ at: p.clone(), length: rand(0.3, 0.6) + (Math.random() < 0.3 ? rand(0.3, 0.6) : 0), width: rand(0.09, 0.14), from, to: from + 0.3 });
      }
    }
    // a slim cone, its point down and its base at the origin
    const cone = new THREE.ConeGeometry(1, 1, 4).rotateX(Math.PI).translate(0, -0.5, 0);
    const mat = new THREE.MeshToonMaterial({ color: '#cfe8f4', gradientMap: GRADIENT, emissive: '#6d8fa6', emissiveIntensity: 0.35 });
    this.mesh = new THREE.InstancedMesh(cone, mat, Math.max(1, this.icicles.length));
    this.mesh.count = this.icicles.length;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.raycast = () => {};
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** `chill` is Weather's heat.chill, 0..1. */
  update(chill: number) {
    if (Math.abs(chill - this.grown) < 0.005) return;
    this.grown = chill;
    this.mesh.visible = this.icicles.some((c) => chill > c.from);
    if (!this.mesh.visible) return;
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    const q = new THREE.Quaternion();
    this.icicles.forEach((c, i) => {
      const k = THREE.MathUtils.smoothstep(chill, c.from, c.to);
      s.set(c.width * (0.4 + k * 0.6), Math.max(0.0001, c.length * k), c.width * (0.4 + k * 0.6));
      this.mesh.setMatrixAt(i, m.compose(c.at, q, k > 0 ? s : s.setScalar(0.0001)));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
