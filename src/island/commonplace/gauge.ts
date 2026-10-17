/**
 * The tide gauge: a peilschaal, a painted board on a steel pile standing in the shallows east of
 * the ring. Black marks for every decimetre, alternating sides as Dutch gauges have them, and a
 * red line at its zero, NAP, which stands a metre or so over the flat's water: out here at low
 * water you read it from well under. What it reads is the flat's own tide.
 */
import * as THREE from 'three';

/** Where it stands, out in the water east of the ring, away from the twigs. */
export const GAUGE = new THREE.Vector2(15.5, -40);
/** How far its zero (NAP) stands over the flat's middle water (m). */
const ZERO = 1.05;
const TALL = 1.95;
const BOARD = 1.5;

/** The pile with its board, to be stood on the flat (foot at its feet; the water cuts it). */
export function makeGauge(pile: THREE.Material, board: THREE.Material, ink: THREE.Material, red: THREE.Material) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, TALL, 0.16), pile);
  post.position.y = TALL / 2;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.2), pile);
  cap.position.y = TALL;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.44, BOARD, 0.02), board);
  face.position.set(0, BOARD / 2, 0.08);
  g.add(post, cap, face);
  // a mark for every decimetre, left and right by turns, so each one's an E with its neighbours
  const mark = new THREE.BoxGeometry(0.2, 0.05, 0.012);
  for (let i = 0; i * 0.1 < BOARD - 0.05; i++) {
    const m = new THREE.Mesh(mark, i * 0.1 > ZERO ? red : ink);
    m.position.set(i % 2 ? 0.11 : -0.11, i * 0.1 + 0.025, 0.095);
    g.add(m);
  }
  // and its zero, painted right across
  const zero = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.014), red);
  zero.position.set(0, ZERO, 0.096);
  g.add(zero);
  return g;
}

/** What it reads, for where the water is (m from the middle) and which way it's going (−1 … 1). */
export function reading(level: number, going: number) {
  const cm = Math.round((ZERO - level) * 100);
  if (Math.abs(going) < 0.3) return level < 0 ? `Low water, slack: ${cm} centimetres under NAP.` : `High water, slack: ${cm} centimetres under NAP. Out here it only ever moves a few centimetres.`;
  return `The water’s ${cm} centimetres under NAP, and ${going > 0 ? 'rising' : 'falling'}.`;
}
