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

/** How far one step takes you (m): a foot comes down every STEP of the way, left then right. */
export const STEP = 0.7;
/** Hip to boot sole (m). */
const LEG = 0.82;

/**
 * Walking, `steps` steps in (the way you've come over STEP, so the legs go by the ground and not by
 * the clock), `amount` of a full stride (less as you slow to a stop), each step `long` metres. The
 * foot that's down goes back under you exactly as fast as you go on, so it stays where it was put;
 * the other swings through to come down half a step ahead. The arms go against the legs.
 */
export function walk(f: Pick<Figure, 'legs' | 'arms'>, steps: number, amount: number, long = STEP) {
  for (let i = 0; i < 2; i++) {
    const u = (((steps + i) % 2) + 2) % 2;
    // (how far ahead of the hip the boot is: down and going back for a step, then through the air)
    const ahead = u < 1 ? long * (0.5 - u) : long * (THREE.MathUtils.smootherstep(u - 1, 0, 1) - 0.5);
    const hip = -Math.asin(THREE.MathUtils.clamp(ahead / LEG, -1, 1)) * amount;
    f.legs[i].rotation.x = hip;
    f.arms[i].rotation.x = -hip * 0.8;
  }
}

/** Which foot came down last, `steps` steps in, as the side of you it's on: -1 for legs[0], 1 for legs[1]. */
export function footDown(steps: number) {
  return Math.floor(steps) % 2 ? 1 : -1;
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
