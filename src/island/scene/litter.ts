import * as THREE from 'three';
import type { CanopyMarker } from './island';
import { season } from './season';
import { toon } from './toon';

// fallen leaves: the bright ones that came down first, browning as they lie
const FRESH = ['#c04e30', '#cc622c', '#e08a3a', '#d4ae40', '#e9cf66', '#a0392c'];
const BROWN = ['#8c5a3c', '#6e4a32', '#a07a52', '#7a5236', '#b0643a'];
const PER_TREE = 70;
const LEAF = new THREE.BoxGeometry(0.24, 0.02, 0.18);
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const S = new THREE.Vector3(1, 1, 1);
const P = new THREE.Vector3();
const C = new THREE.Color();

/**
 * How much of the year's leaves are lying, 0..1: a few early in autumn, a carpet by the end of
 * November, lying on (and browning) through the winter, gone by spring, when the leaf year starts again.
 */
export function littered() {
  return Math.min(1, season.turn * 0.12 + season.fall * 0.95);
}

/**
 * Fallen leaves on the ground under the trees, a flat pixel or two each, thicker towards the
 * trunk: shown a few at a time as autumn goes on (`count`), so the ground fills up rather than
 * changing all at once. Every leaf has its place in that order, the earliest ones going brown first.
 */
export function litter(trees: CanopyMarker[], groundAt: (x: number, z: number) => number, seed = 1) {
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const leaves: { x: number; y: number; z: number; turn: number; order: number }[] = [];
  for (const c of trees) {
    const n = Math.round(PER_TREE * Math.min(1.6, c.radius / 1.6));
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.pow(rnd(), 0.7) * c.radius * 1.5; // most under the crown, a few further off
      const x = c.position.x + Math.cos(a) * d;
      const z = c.position.z + Math.sin(a) * d;
      const y = groundAt(x, z);
      if (!Number.isFinite(y)) continue;
      leaves.push({ x, y: y + 0.02, z, turn: rnd() * Math.PI * 2, order: rnd() });
    }
  }
  leaves.sort((a, b) => a.order - b.order);
  const mesh = new THREE.InstancedMesh(LEAF, toon(new THREE.Color(1, 1, 1)), Math.max(1, leaves.length));
  leaves.forEach((l, i) => {
    Q.setFromEuler(E.set((rnd() - 0.5) * 0.3, l.turn, (rnd() - 0.5) * 0.3));
    mesh.setMatrixAt(i, M.compose(P.set(l.x, l.y, l.z), Q, S));
    // the first to fall are the first to go brown
    const brown = l.order < 0.45 ? 0.75 : 0.25;
    const palette = rnd() < brown ? BROWN : FRESH;
    mesh.setColorAt(i, C.set(palette[Math.floor(rnd() * palette.length)]));
  });
  mesh.count = 0;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.userData.leaves = leaves.length;
  return mesh;
}

/** Show as much of a carpet as is lying: `amount` 0..1 of its leaves. */
export function spread(mesh: THREE.InstancedMesh, amount: number) {
  mesh.count = Math.round((mesh.userData.leaves as number) * THREE.MathUtils.clamp(amount, 0, 1));
}
