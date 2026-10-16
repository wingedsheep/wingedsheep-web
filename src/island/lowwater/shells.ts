/**
 * A proof without words, laid out in shells on a bank of its own: a square of them eight by
 * eight, one in the corner, then an L of three round it, then five, and so on, cockles and
 * mussels by turns. Each L is the next odd number and closes the next square, so walking in from
 * the corner you're always stood on 1 + 3 + … = n × n. They're seen at a slant, like everything
 * on the flat, so the rows are laid further apart than the columns, and the square looks square.
 */
import * as THREE from 'three';

/** How many to a side, and the spacing (m): across, and along the way out. */
export const SIDE = 8;
const ACROSS = 0.34;
const ALONG = ACROSS / Math.sin(THREE.MathUtils.degToRad(24));

const COCKLE = new THREE.Color('#cfc6c4');
const MUSSEL = new THREE.Color('#25223a');

export class Shells {
  readonly mesh: THREE.InstancedMesh;
  /** The corner the single shell is in: the far, western one, so the Ls open towards you and the card never hides it. */
  readonly corner: THREE.Vector2;

  constructor(
    readonly at: THREE.Vector2,
    ground: (x: number, z: number) => number,
    material: THREE.Material,
    rand: () => number,
  ) {
    this.corner = new THREE.Vector2(at.x - ((SIDE - 1) * ACROSS) / 2, at.y - ((SIDE - 1) * ALONG) / 2);
    // a shell: a low dome, longer along the way out so it reads round from up here
    const geo = new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, material, SIDE * SIDE);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const turn = new THREE.Euler();
    let n = 0;
    for (let i = 0; i < SIDE; i++) {
      for (let j = 0; j < SIDE; j++) {
        const k = Math.max(i, j);
        const mussel = k % 2 === 1;
        // laid by hand: a little off the grid, each its own way round
        // (close enough that each L reads as one band, cockles pale and mussels dark)
        const x = this.corner.x + i * ACROSS + (rand() - 0.5) * 0.03;
        const z = this.corner.y + j * ALONG + (rand() - 0.5) * 0.08;
        turn.set(0, (rand() - 0.5) * 0.3, 0);
        const s = mussel ? new THREE.Vector3(0.12, 0.035, 0.34) : new THREE.Vector3(0.135, 0.045, 0.31);
        m.compose(new THREE.Vector3(x - at.x, ground(x, z) - 0.008, z - at.y), q.setFromEuler(turn), s);
        this.mesh.setMatrixAt(n, m);
        this.mesh.setColorAt(n, mussel ? MUSSEL : COCKLE);
        n++;
      }
    }
    this.mesh.position.set(at.x, 0, at.y);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.frustumCulled = false;
  }

  /** Which L you're stood in (0 the single shell … SIDE - 1 the outermost), or -1 off the square. */
  which(x: number, z: number) {
    const i = Math.round((x - this.corner.x) / ACROSS);
    const j = Math.round((z - this.corner.y) / ALONG);
    if (i < 0 || j < 0 || i >= SIDE || j >= SIDE) return -1;
    return Math.max(i, j);
  }
}

/** The sum stood on, written out: 1 + 3 + 5 = 9 = 3 × 3 (and the one in the corner just 1 = 1 × 1). */
export function sum(k: number) {
  const odd = Array.from({ length: k + 1 }, (_, n) => 2 * n + 1);
  return `${k ? `${odd.join(' + ')} = ${(k + 1) ** 2}` : '1'} = ${k + 1} × ${k + 1}`;
}
