/**
 * The scour: a low bank out east past the gauge where the sea's taken the sand off its top, down
 * to the grey clay under the flat, and in the clay a few bare footprints with water in them, coming
 * west out from under the sand. They aren't yours. Follow them back east and you come out on the old floor (floor.ts).
 */
import * as THREE from 'three';
import { BIG, HOLLOW, SKY, flat, footShape } from './floor';

/** Its bank, and where you stand on the clay to follow the prints. */
export const SCOUR = { x: 34, z: -33, rx: 3.4, rz: 1.5, h: 0.09 };
export const SCOUR_FOOT = new THREE.Vector2(SCOUR.x + 0.4, SCOUR.z + 0.5);
const CLAY = new THREE.Color('#45465e');

/**
 * The clay where it shows, a ragged patch on the bank's top a little proud of it (laid in rings, so
 * it follows the bank's rise), and on it the prints, a grown one's and a child's, coming out of the east.
 */
export function makeScour(bankAt: (x: number, z: number) => number, mat: (c: THREE.Color) => THREE.Material) {
  const g = new THREE.Group();
  const rings = 5;
  const around = 32;
  const pos: number[] = [];
  const idx: number[] = [];
  const reach = (a: number) => 0.66 + 0.1 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(7 * a + 2.1) + 0.04 * Math.sin(13 * a);
  pos.push(SCOUR.x, bankAt(SCOUR.x, SCOUR.z) + 0.006, SCOUR.z);
  for (let j = 1; j <= rings; j++) {
    for (let i = 0; i < around; i++) {
      const a = (i / around) * Math.PI * 2;
      const r = (j / rings) * reach(a);
      const x = SCOUR.x + Math.cos(a) * r * SCOUR.rx;
      const z = SCOUR.z + Math.sin(a) * r * SCOUR.rz;
      pos.push(x, bankAt(x, z) + 0.006, z);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < around; i++) {
      const i2 = (i + 1) % around;
      if (j === 0) idx.push(0, 1 + i2, 1 + i);
      else {
        const a = 1 + (j - 1) * around;
        const b = 1 + j * around;
        idx.push(a + i, a + i2, b + i2, a + i, b + i2, b + i);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const clay = new THREE.Mesh(geo, mat(CLAY));
  clay.userData.id = 'scour';
  g.add(clay);
  // the prints, coming west out from under the sand on the clay's far side
  const prints: [number, number, number, number][] = [
    // x, z, length, side (+1 a left foot)
    [-1.9, 0.15, 0.26, 1], [-1.15, -0.05, 0.26, -1], [-0.4, 0.12, 0.26, 1], [0.35, -0.06, 0.26, -1], [1.1, 0.1, 0.26, 1],
    [-1.6, -0.75, 0.165, -1], [-0.85, -0.55, 0.165, 1], [-0.1, -0.85, 0.165, -1], [0.7, -0.6, 0.165, 1], [1.5, -0.9, 0.165, -1],
  ];
  for (const [dx, dz, l, side] of prints) {
    const x = SCOUR.x + dx;
    const z = SCOUR.z + dz;
    for (const [shape, color, lift] of [[flat(footShape(l * BIG * 1.5)), HOLLOW, 0.02], [flat(footShape(l * BIG * 1.5, false), 0.55, -0.02), SKY, 0.03]] as const) {
      const m = new THREE.Mesh(shape, mat(color));
      // (going west, the way they were; its big toe on the inside)
      m.rotation.y = Math.PI;
      m.scale.set(1, 1, -side);
      m.position.set(x, bankAt(x, z) + lift, z);
      g.add(m);
    }
  }
  return g;
}
