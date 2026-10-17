/**
 * The hide: a birders' hut of tarred planks on short legs, out east past the geul, on a bank of
 * its own. Its long slot on the north side, the one birders look out of, is boarded up all but one
 * small hole; its door's on the south side, the end nearest the geul. Inside it's a camera
 * obscura (obscura.ts): the hole lays the flat on its back wall, upside down.
 */
import * as THREE from 'three';

/** Where it stands (its middle), and where you stand at its door to go in. */
export const HIDE = new THREE.Vector2(31, -90);
export const HIDE_DOOR = new THREE.Vector2(HIDE.x - 1.85, HIDE.y + 2.65);
/** Where the picture inside is looking: the flat north of the hide, with her and the buoy in it. */
export const PICTURE_X = 13;
/** Its bank: low, broad, and dry under the hut's legs at any tide. */
export const HIDE_BANK = { x: HIDE.x, z: HIDE.y + 0.5, rx: 4.8, rz: 2.8, h: 0.12 };

/** Its size (m), outside: big for a hide, so the room inside is as big as obscura.ts has it. */
export const WIDE = 4.8;
export const DEEP = 3.6;
const LEGS = 0.45;
const WALL = 2.5;

/** The hut, its foot at the bank (its south side facing +z, as you come at it). */
export function makeHide(m: { tar: THREE.Material; plank: THREE.Material; roof: THREE.Material; door: THREE.Material; trim: THREE.Material }) {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y, z);
    g.add(b);
    return b;
  };
  // the legs, so the tide goes under, and the floor on them
  for (const x of [-1, 1]) for (const z of [-1, 1]) box(0.14, LEGS + 0.1, 0.14, m.tar, x * (WIDE / 2 - 0.12), (LEGS + 0.1) / 2 - 0.1, z * (DEEP / 2 - 0.12));
  box(WIDE + 0.1, 0.1, DEEP + 0.1, m.tar, 0, LEGS, 0);
  // the walls: tarred planks, each one a little proud of the last, so they catch the light in lines
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const y = LEGS + 0.05 + (i + 0.5) * (WALL / rows);
    const mat = i % 2 ? m.plank : m.tar;
    const out = 0.012 * (i % 2);
    box(WIDE, WALL / rows, 0.06, mat, 0, y, DEEP / 2 + out);
    box(WIDE, WALL / rows, 0.06, mat, 0, y, -DEEP / 2 - out);
    box(0.06, WALL / rows, DEEP, mat, -WIDE / 2 - out, y, 0);
    box(0.06, WALL / rows, DEEP, mat, WIDE / 2 + out, y, 0);
  }
  // the roof: one slope, high over the door, falling away north to the slot side, a little
  // overhang all round (that way round it's seen nearly edge on from the flat, not as a slab)
  const roof = box(WIDE + 0.3, 0.08, DEEP + 0.5, m.roof, 0, 0, 0);
  roof.rotation.x = -0.2;
  roof.position.set(0, LEGS + WALL + 0.36, 0.05);
  // (and a pale board along its high edge, over the door, where the light catches)
  const fascia = box(WIDE + 0.3, 0.12, 0.04, m.trim, 0, 0, 0);
  fascia.rotation.x = -0.2;
  fascia.position.set(0, LEGS + WALL + 0.36 + Math.sin(0.2) * (DEEP / 2 + 0.27), 0.05 + Math.cos(0.2) * (DEEP / 2 + 0.27));
  // (and the gables under it, so there's no gap: the shape's x runs north as it's turned)
  const gable = new THREE.Shape();
  gable.moveTo(-DEEP / 2, 0);
  gable.lineTo(DEEP / 2, 0);
  gable.lineTo(DEEP / 2, 0.04);
  gable.lineTo(-DEEP / 2, 0.75);
  gable.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: 0.06, bevelEnabled: false });
  for (const x of [-1, 1]) {
    const side = new THREE.Mesh(gableGeo, m.tar);
    side.rotation.y = Math.PI / 2;
    side.position.set(x * (WIDE / 2) - 0.03, LEGS + 0.05 + WALL, 0);
    g.add(side);
  }
  // (and the front's top board, under the high edge)
  box(WIDE, 0.75, 0.06, m.tar, 0, LEGS + 0.05 + WALL + 0.375, DEEP / 2);
  // the door, at the west end of the south side, with its latch, and a plank to step up on
  const doorX = -WIDE / 2 + 0.55;
  box(0.72, 1.72, 0.04, m.door, doorX, LEGS + 0.05 + 0.86, DEEP / 2 + 0.04);
  box(0.1, 0.04, 0.03, m.trim, doorX + 0.25, LEGS + 0.95, DEEP / 2 + 0.075);
  box(0.8, 0.06, 0.34, m.plank, doorX, LEGS * 0.45, DEEP / 2 + 0.3);
  // the slot on the north side, boarded over, and its one hole (a dark pea in a pale board)
  box(WIDE - 0.5, 0.3, 0.03, m.plank, 0, LEGS + 1.3, -DEEP / 2 - 0.05);
  box(0.035, 0.035, 0.02, m.tar, 0, LEGS + 1.3, -DEEP / 2 - 0.07);
  return g;
}
