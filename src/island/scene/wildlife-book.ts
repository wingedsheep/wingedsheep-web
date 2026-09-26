import * as THREE from 'three';
import { GRADIENT } from './toon';

/** The green field notebook on the library's candlelit reading table (interior.py). */
export function createWildlifeBook() {
  const root = new THREE.Group();
  root.name = 'wildlife_book';
  root.userData.id = 'wildlife_book';
  // Over the open volume already on the table, clear of its mug and candle.
  root.position.set(-1.7, 0.885, 0.1);
  root.rotation.y = -0.2;
  root.scale.setScalar(0.6);
  const toon = (color: THREE.Color) => new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT });
  const linen = toon(new THREE.Color('#506b53'));
  const paper = toon(new THREE.Color('#eee0bc'));
  const brass = toon(new THREE.Color('#c3a168'));
  const ink = toon(new THREE.Color('#77694f'));
  function box(parent: THREE.Object3D, size: number[], at: number[], material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), material);
    mesh.position.set(...at as [number, number, number]);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const book = new THREE.Group();
  book.position.set(0, 0, 0);
  book.rotation.y = 0;
  root.add(book);
  // An open, cloth-bound notebook: raised leaves, visible binding and a red ribbon.
  box(book, [1.5, 0.055, 0.99], [0, 0, 0], linen);
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(side * 0.365, 0.075, 0);
    leaf.rotation.z = side * 0.07;
    book.add(leaf);
    box(leaf, [0.7, 0.09, 0.88], [0, 0, 0], paper);
    for (const y of [-0.015, 0.008, 0.032]) box(leaf, [0.7, 0.004, 0.88], [0, y, 0], brass);
    // Small pencil marks on the left; the right-hand leaf holds a bird silhouette.
    if (side < 0) {
      for (let n = 0; n < 5; n++) box(leaf, [0.43 - n % 2 * 0.1, 0.004, 0.014], [-0.015, 0.047, -0.18 + n * 0.095], ink);
    } else {
      const bird = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 5), ink);
      bird.scale.set(1, 0.035, 1.35); bird.position.set(0, 0.05, 0.035); leaf.add(bird);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), ink);
      head.scale.y = 0.06; head.position.set(0.04, 0.05, -0.15); leaf.add(head);
      const tail = box(leaf, [0.07, 0.006, 0.22], [-0.09, 0.05, 0.2], ink); tail.rotation.y = -0.35;
      box(leaf, [0.4, 0.004, 0.013], [0, 0.049, 0.32], ink);
    }
  }
  box(book, [0.035, 0.012, 0.7], [0.04, 0.15, 0.26], toon(new THREE.Color('#a65242')));
  const pencil = box(root, [0.045, 0.045, 0.67], [0.86, 0.015, 0.04], brass);
  pencil.rotation.y = -0.22;
  box(root, [0.045, 0.045, 0.08], [0.93, 0.015, -0.31], ink);
  return root;
}
