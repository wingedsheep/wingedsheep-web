/**
 * Letters for writing on the page: a small lowercase hand, one mark a texel, nine rows from the
 * top of an ascender to the bottom of a descender. Built as flat quads lying on the paper, in
 * units of one texel across and one texel's worth of depth (the page is seen at a slant), so a
 * word's mesh is scaled by the texel each frame and stays crisp at any zoom.
 */
import * as THREE from 'three';

const ROWS = 9;

// prettier-ignore
const GLYPHS: Record<string, string[]> = {
  a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###', '....', '....'],
  b: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '###.', '....', '....'],
  c: ['...', '...', '.##', '#..', '#..', '#..', '.##', '...', '...'],
  d: ['...#', '...#', '.###', '#..#', '#..#', '#..#', '.###', '....', '....'],
  e: ['....', '....', '.##.', '#..#', '####', '#...', '.###', '....', '....'],
  f: ['.##', '#..', '###', '#..', '#..', '#..', '#..', '...', '...'],
  g: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  h: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '#..#', '....', '....'],
  i: ['#', '.', '#', '#', '#', '#', '#', '.', '.'],
  j: ['.#', '..', '.#', '.#', '.#', '.#', '.#', '.#', '#.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#', '....', '....'],
  l: ['#', '#', '#', '#', '#', '#', '#', '.', '.'],
  m: ['.....', '.....', '####.', '#.#.#', '#.#.#', '#.#.#', '#.#.#', '.....', '.....'],
  n: ['....', '....', '###.', '#..#', '#..#', '#..#', '#..#', '....', '....'],
  o: ['....', '....', '.##.', '#..#', '#..#', '#..#', '.##.', '....', '....'],
  p: ['....', '....', '###.', '#..#', '#..#', '#..#', '###.', '#...', '#...'],
  q: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '...#'],
  r: ['...', '...', '#.#', '##.', '#..', '#..', '#..', '...', '...'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.', '....', '....'],
  t: ['.#.', '.#.', '###', '.#.', '.#.', '.#.', '..#', '...', '...'],
  u: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###', '....', '....'],
  v: ['.....', '.....', '#...#', '#...#', '.#.#.', '.#.#.', '..#..', '.....', '.....'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.', '.....', '.....'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....', '.....'],
  y: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  z: ['....', '....', '####', '..#.', '.#..', '#...', '####', '....', '....'],
  '.': ['.', '.', '.', '.', '.', '.', '#', '.', '.'],
  ',': ['.', '.', '.', '.', '.', '.', '#', '#', '.'],
  "'": ['#', '#', '.', '.', '.', '.', '.', '.', '.'],
  '-': ['...', '...', '...', '...', '###', '...', '...', '...', '...'],
  ' ': ['..', '..', '..', '..', '..', '..', '..', '..', '..'],
};

export interface Written {
  geometry: THREE.BufferGeometry;
  /** Across, in texels. */
  width: number;
  /** How many marks are in the first k letters, for writing it out a letter at a time. */
  marks: number[];
}

/**
 * A word as one geometry, centred across on the origin with its baseline's foot there, rows going
 * north (−z) in units of one texel's depth (`depth`, the page's 1/sin of its slant).
 */
export function write(word: string, depth: number): Written {
  const pos: number[] = [];
  const idx: number[] = [];
  const marks = [0];
  const glyphs = [...word].map((c) => GLYPHS[c] ?? GLYPHS[' ']);
  const width = glyphs.reduce((w, g) => w + g[0].length + 1, -1);
  let x = -Math.round(width / 2);
  for (const g of glyphs) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < g[r].length; c++) {
        if (g[r][c] !== '#') continue;
        // (row 6 is the baseline's row: it sits just north of the origin)
        const z0 = -(6 - r) * depth;
        const n = pos.length / 3;
        pos.push(x + c, 0, z0, x + c + 1, 0, z0, x + c + 1, 0, z0 - depth, x + c, 0, z0 - depth);
        idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
      }
    }
    x += g[0].length + 1;
    marks.push(idx.length);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  return { geometry, width, marks };
}
