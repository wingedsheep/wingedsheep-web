/**
 * Writing in the sand: one line, scratched with a stick, in capitals five grooves wide and seven
 * deep. Each groove is a dark cut with a pale lip where the sand was pushed up, and each fills in
 * on its own: water seeps in, then the edges slump, then it's smooth. Wherever the tide comes up
 * over it, it goes faster. What's written is never kept anywhere: not saved, not sent, and gone
 * from here too once the last groove has filled.
 */
import * as THREE from 'three';

/** The longest line the bank takes. */
export const LONGEST = 24;
/** One cell of a letter on the ground (m): across, and along the way out (it's seen at a slant). */
const CELL_X = 0.09;
const CELL_Z = 0.22;
const ADVANCE = 6 * CELL_X;
/** How long a groove lasts on dry sand (s), give or take its own share, and how much quicker under water. */
const LIFE = 55;
const SPREAD = 40;
const WET = 6;

const CUT = new THREE.Color('#3d3952');
const SEEP = new THREE.Color('#47508a');
const SLUMP = new THREE.Color('#615c72');
const LIP = new THREE.Color('#8b859c');

/** Capitals, figures and a little punctuation, five by seven: a row a string, top first. */
const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  '♥': ['00000', '01010', '11111', '11111', '01110', '00100', '00000'],
};
const ALIKE: Record<string, string> = { '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '.', '❤': '♥', '♡': '♥', ß: 'SS', Æ: 'AE', Ø: 'O', Œ: 'OE', Ł: 'L' };

/** What can be written of a line: capitals, accents dropped, the rest let go of. */
export function sandable(text: string) {
  const out = [...text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()]
    .map((c) => ALIKE[c] ?? c)
    .join('')
    .split('')
    .map((c) => (GLYPHS[c] || c === ' ' ? c : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return out.slice(0, LONGEST).trim();
}

interface Groove {
  /** Which letter it belongs to (and so when it's cut), and its place on the ground. */
  letter: number;
  x: number;
  z: number;
  lip: boolean;
  /** How long it's had, and how long it lasts; -1 not cut yet. */
  age: number;
  life: number;
  shown: number;
}

export class Sand {
  readonly mesh: THREE.InstancedMesh;
  private grooves: Groove[] = [];
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private at = new THREE.Matrix4();

  constructor(private height: (x: number, z: number) => number) {
    const max = LONGEST * 35 * 2;
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(CELL_X, CELL_Z).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ depthWrite: false, fog: false }),
      max,
    );
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, this.hidden);
      this.mesh.setColorAt(i, CUT);
    }
    this.mesh.count = 0;
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
  }

  /** Whether any of it is still there to read. */
  get there() {
    return this.grooves.length > 0;
  }

  /** How wide a line comes out (m). */
  static width(line: string) {
    return line.length * ADVANCE - CELL_X;
  }

  /** Where each letter's middle falls along the line, from its left end. */
  static middles(line: string) {
    return [...line].map((_, i) => i * ADVANCE + 2.5 * CELL_X);
  }

  /** Lay out a new line, its letters' tops along z, starting at x, all still to be cut (smoothing over whatever was there). */
  lay(line: string, x: number, z: number) {
    this.grooves = [];
    [...line].forEach((c, letter) => {
      const g = GLYPHS[c];
      if (!g) return;
      const on = (r: number, k: number) => g[r]?.[k] === '1';
      for (let r = 0; r < 7; r++) {
        for (let k = 0; k < 5; k++) {
          const cx = x + letter * ADVANCE + (k + 0.5) * CELL_X;
          const cz = z + (r + 0.5) * CELL_Z;
          const life = LIFE + Math.random() * SPREAD;
          if (on(r, k)) this.grooves.push({ letter, x: cx, z: cz, lip: false, age: -1, life, shown: -1 });
          // the sand pushed up on the near side of a cut (towards you), where there's no cut of its own
          else if (on(r - 1, k)) this.grooves.push({ letter, x: cx, z: cz, lip: true, age: -1, life: life * 0.45, shown: -1 });
        }
      }
    });
    this.mesh.count = this.grooves.length;
    for (let i = 0; i < this.grooves.length; i++) this.mesh.setMatrixAt(i, this.hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Cut a letter (the stick's got to it). */
  cut(letter: number, level: number) {
    for (const g of this.grooves) if (g.letter === letter && g.age < 0) g.age = 0;
    this.place(level);
  }

  /** Stop partway: whatever wasn't cut yet never will be. */
  abandon() {
    for (const g of this.grooves) if (g.age < 0) (g.age = g.life), (g.shown = 3);
  }

  private place(level: number) {
    this.grooves.forEach((g, i) => {
      if (g.age < 0) return;
      this.at.makeTranslation(g.x, Math.max(level, this.height(g.x, g.z)) + 0.005, g.z);
      this.mesh.setMatrixAt(i, this.at);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Let it fill in: water first, then the edges slump, then smooth. */
  update(dt: number, level: number) {
    if (!this.grooves.length) return;
    let colours = false;
    let gone = 0;
    this.grooves.forEach((g, i) => {
      if (g.age < 0) return;
      const under = this.height(g.x, g.z) < level;
      g.age += dt * (under ? WET : 1);
      const a = g.age / g.life;
      const step = a < 0.4 ? 0 : a < 0.75 ? 1 : a < 1 ? 2 : 3;
      if (step === 3) gone++;
      if (step === g.shown) return;
      g.shown = step;
      if (step === 3) {
        this.mesh.setMatrixAt(i, this.hidden);
        this.mesh.instanceMatrix.needsUpdate = true;
        return;
      }
      // (a lip just slumps back into the sand)
      this.mesh.setColorAt(i, g.lip ? (step === 0 ? LIP : SLUMP) : [CUT, SEEP, SLUMP][step]);
      colours = true;
    });
    if (colours) this.mesh.instanceColor!.needsUpdate = true;
    if (gone === this.grooves.length) {
      this.grooves = [];
      this.mesh.count = 0;
    }
  }
}
