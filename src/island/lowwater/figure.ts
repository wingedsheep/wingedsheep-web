/**
 * You, out past the island: coat, boots, scarf and head, in whatever materials the place you're
 * in draws you with (the flat's blue-hour colours, or the page's ink).
 */
import * as THREE from 'three';

export interface Figure {
  root: THREE.Group;
  /** Hips and shoulders, left then right, to swing. */
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  /** The scarf's loose end, to lift in the wind. */
  scarfTail: THREE.Group;
}

export function makeFigure(mat: { coat: THREE.Material; boots: THREE.Material; scarf: THREE.Material; skin: THREE.Material }, root = new THREE.Group(), scarfTail = new THREE.Group()): Figure {
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.82, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.82, 0.15), mat.boots);
    leg.position.y = -0.41;
    hip.add(leg);
    root.add(hip);
    legs.push(hip);
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.25, 1.42, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.12), mat.coat);
    arm.position.y = -0.3;
    shoulder.add(arm);
    root.add(shoulder);
    arms.push(shoulder);
  }
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.78, 6), mat.coat);
  body.position.y = 1.1;
  root.add(body);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 6), mat.scarf);
  ring.position.y = 1.52;
  root.add(ring);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.04), mat.scarf);
  tail.position.set(0, -0.18, 0);
  scarfTail.position.set(0.08, 1.52, -0.17);
  scarfTail.add(tail);
  root.add(scarfTail);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), mat.skin);
  skull.position.y = 1.7;
  root.add(skull);
  return { root, legs, arms, scarfTail };
}
