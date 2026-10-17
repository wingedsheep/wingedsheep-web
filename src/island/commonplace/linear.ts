/**
 * Past the block in Luxor, the end of the stones: a decipherment with no Greek beside anything.
 * Three clay tablets from Knossos, each with a word in its three forms, the way Alice Kober found
 * them; a small one from Pylos; Michael Ventris's grid on a sheet of squared paper, every sign in
 * its place by consonant and vowel and not one of them with a sound; and the tripod tablet from
 * Pylos, dug up in 1952, with its pictures.
 *
 * Guess the town at the tablets (commonplace.ts takes it in the card's line) and the four names
 * come out, and with them every row and column of the grid they touch; walk under the tripod
 * tablet and it reads as far as the grid goes, beside a picture you can see. Say what the picture
 * is and the rest of it comes out Greek.
 *
 * Built into the stones' scene (stone.ts), east along the same floor.
 */
import * as THREE from 'three';
import { BAYER, CHALK_FONT, Face, type FaceLook, type FaceSlot } from './face';
import SYL from './syllables.json';

const PX = 32;
const BIG = 2;
/** The grid's paper: texture pixels to the metre (pencil's finer than a chisel). */
const SHEET_PX = 16;
/** One sign's column on a tablet, and a word divider's (px). */
const COL = 34;
const DIVIDE = 16;
/** A line of writing on a tablet: the signs, then their chalked sounds under them (px). */
const LINE = 52;

/** Where things are along the floor (m). */
export const LINEAR = { from: 49.5, strips: [50.5, 56.6, 63.7], pylos: 70.6, grid: 77.6, tripod: 96, east: 107.4 };
const GRID_TO = 93.2;

const CLAY: FaceLook = {
  bands: [
    [0x96, 0x73, 0x5a],
    [0x80, 0x61, 0x4c],
    [0x6a, 0x4f, 0x40],
    [0x54, 0x3f, 0x34],
  ],
  cut: [0x2a, 0x1f, 0x1b],
  wall: [0xc4, 0xa3, 0x86],
  letter: 2,
};

/** A syllable's consonant ('' for a bare vowel) and its vowel. */
function cv(s: string) {
  return { c: s.length > 1 ? s[0] : '', v: s[s.length - 1] };
}

/** The three towns' words, each in Kober's three forms: the place, a man of it, a woman of it. */
const TOWNS = [
  ['ko', 'no', 'so'],
  ['a', 'mi', 'ni', 'so'],
  ['tu', 'ri', 'so'],
].map((t) => [t, [...t.slice(0, -1), 'si', 'jo'], [...t.slice(0, -1), 'si', 'ja']]);

/** A cup with this many handles, as the scribe drew them on the tripod tablet. */
function cup(handles: number) {
  const W = 18;
  const g = Array.from({ length: 15 }, () => Array(W).fill('.'));
  const set = (x: number, y: number) => (g[y][x] = '#');
  for (let x = 0; x < W; x++) set(x, 5);
  [[0, 17], [1, 16], [2, 15], [3, 14], [4, 13]].forEach(([a, b], k) => (set(a, 6 + k), set(b, 6 + k)));
  for (let x = 5; x <= 12; x++) set(x, 10);
  for (let y = 11; y < 13; y++) set(8, y), set(9, y);
  for (let x = 5; x <= 12; x++) set(x, 13);
  for (let i = 0; i < handles; i++) {
    const x = handles === 1 ? 7 : Math.round((i * (W - 3)) / (handles - 1));
    set(x + 1, 0);
    for (let y = 1; y < 5; y++) set(x, y), set(x + 2, y);
  }
  return g.map((r) => r.join(''));
}
/** A tripod cauldron: its two ring handles, the bowl, three legs. */
const TRIPOD = [
  '..##........##..',
  '.#..#......#..#.',
  '.#..#......#..#.',
  '################',
  '#..............#',
  '.#............#.',
  '..#..........#..',
  '...##########...',
  '...#...#....#...',
  '..#....#.....#..',
  '..#....#.....#..',
  '.#.....#......#.',
  '.#.....#......#.',
  '#......#.......#',
];
const PICTURES: Record<string, string[]> = { tripod: TRIPOD, cup4: cup(4), cup3: cup(3), cup0: cup(0) };

type Item = { word: string[] } | { pic: string } | { num: number };

/** The tripod tablet (Pylos, Ta 641), its four entries one to a line. */
const TRIPOD_LINES: Item[][] = [
  [{ word: ['ti', 'ri', 'po', 'de'] }, { pic: 'tripod' }, { num: 2 }],
  [{ word: ['di', 'pa'] }, { word: ['qe', 'to', 'ro', 'we'] }, { pic: 'cup4' }, { num: 1 }],
  [{ word: ['di', 'pa'] }, { word: ['ti', 'ri', 'jo', 'we'] }, { pic: 'cup3' }, { num: 1 }],
  [{ word: ['di', 'pa'] }, { word: ['a', 'no', 'we'] }, { pic: 'cup0' }, { num: 1 }],
];

/** The grid's columns (consonants, the bare vowels' too) and rows (vowels), in the order Ventris might have had them: not the alphabet's. */
const CONSONANTS = ['t', '', 'r', 'j', 'k', 'w', 'n', 's', 'd', 'm', 'q', 'p'];
const VOWELS = ['o', 'a', 'i', 'e', 'u'];

interface Sign extends FaceSlot {
  syl: string;
  face: Face;
  /** Which tablet it's on, and where it is along the floor (m). */
  on: 'town' | 'pylos' | 'tripod';
  x: number;
}

export type LinearCard = 'kober' | 'towns' | 'grid' | 'tablet' | 'greek';
export type LinearThing = 'strips' | 'pylos' | 'grid' | 'tripod';
type Body = (outline: [number, number][], x0: number, y0: number, front: number, depth: number, face: Face, id: string) => void;

/** Ventris's grid: squared paper, a sign in each square, and in red pencil whatever's been worked out. */
class Sheet {
  readonly canvas = document.createElement('canvas');
  readonly tex: THREE.CanvasTexture;
  readonly w: number;
  readonly h: number;
  dirty = true;
  /** Worked out and pencilled in: column heads, row heads, squares. */
  readonly shown = { c: new Set<string>(), v: new Set<string>(), cells: new Set<string>() };
  static readonly CELL_W = 18;
  static readonly CELL_H = 24;
  static readonly HEAD_W = 14;
  static readonly HEAD_H = 16;
  static readonly EDGE = 6;

  constructor() {
    this.w = Sheet.EDGE * 2 + Sheet.HEAD_W + CONSONANTS.length * Sheet.CELL_W;
    this.h = Sheet.EDGE * 2 + Sheet.HEAD_H + VOWELS.length * Sheet.CELL_H;
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.colorSpace = THREE.SRGBColorSpace;
  }

  /** Where a column and a row start (px). */
  colX(i: number) {
    return Sheet.EDGE + Sheet.HEAD_W + i * Sheet.CELL_W;
  }
  rowY(j: number) {
    return Sheet.EDGE + Sheet.HEAD_H + j * Sheet.CELL_H;
  }

  paint() {
    const img = new ImageData(this.w, this.h);
    const p = img.data;
    const paper = [
      [0xc9, 0xc1, 0xab],
      [0xac, 0xa5, 0x92],
      [0x8f, 0x89, 0x79],
      [0x74, 0x6f, 0x63],
    ];
    const shade = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const lit = 1 - (x / this.w) * 0.42 - (y / this.h) * 0.1;
        const band = THREE.MathUtils.clamp((1 - lit) * 7 + BAYER[((y >> 1) % 4) * 4 + ((x >> 1) % 4)] - 0.5, 0, 3);
        shade[y * this.w + x] = Math.round(band);
      }
    }
    const put = (x: number, y: number, c: number[], lit = true) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = (y * this.w + x) * 4;
      // (whatever's drawn on it is in the same light as the paper)
      const k = lit ? 1 - shade[y * this.w + x] * 0.11 : 1;
      p[i] = c[0] * k;
      p[i + 1] = c[1] * k;
      p[i + 2] = c[2] * k;
      p[i + 3] = 255;
    };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) put(x, y, paper[shade[y * this.w + x]], false);
    // the squares, ruled faintly
    const rule = [0x7d, 0x86, 0x9c];
    for (let i = 0; i <= CONSONANTS.length; i++) for (let y = Sheet.EDGE; y < this.h - Sheet.EDGE; y++) put(this.colX(i) - 1, y, rule);
    for (let j = 0; j <= VOWELS.length; j++) for (let x = Sheet.EDGE; x < this.w - Sheet.EDGE; x++) put(x, this.rowY(j) - 1, rule);
    // (a pin at each corner)
    for (const [x, y] of [[3, 3], [this.w - 4, 3], [3, this.h - 4], [this.w - 4, this.h - 4]]) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) put(x + a, y + b, [0x3a, 0x38, 0x3e]);
    const pencil = [0x3c, 0x3a, 0x42];
    const red = [0xa8, 0x3e, 0x2c];
    const letters = (s: string, x: number, y: number, k: number) =>
      [...s.toUpperCase()].forEach((ch, n) =>
        (CHALK_FONT[ch] ?? []).forEach((row, j) => {
          for (let i = 0; i < row.length; i++) if (row[i] === '#') for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) put(x + n * 4 * k + i * k + a, y + j * k + b, red);
        }),
      );
    CONSONANTS.forEach((c, i) => {
      const x = this.colX(i);
      if (this.shown.c.has(c)) letters(c || '-', x + Math.floor((Sheet.CELL_W - 6) / 2), Sheet.EDGE + 3, 2);
      VOWELS.forEach((v, j) => {
        const syl = c + v;
        const rows = (SYL as Record<string, string[]>)[syl];
        if (!rows) return;
        const y = this.rowY(j);
        const gw = Math.max(...rows.map((r) => r.length));
        const ox = x + Math.floor((Sheet.CELL_W - 1 - gw) / 2);
        const oy = y + 1 + Math.floor((16 - rows.length) / 2);
        rows.forEach((row, b) => {
          for (let a = 0; a < row.length; a++) if (row[a] === '#') put(ox + a, oy + b, pencil);
        });
        if (this.shown.cells.has(syl)) letters(syl, x + Math.floor((Sheet.CELL_W - 1 - (syl.length * 4 - 1)) / 2), y + 18, 1);
      });
    });
    VOWELS.forEach((v, j) => {
      if (this.shown.v.has(v)) letters(v, Sheet.EDGE + 4, this.rowY(j) + 7, 2);
    });
    this.canvas.getContext('2d')!.putImageData(img, 0, 0);
    this.tex.needsUpdate = true;
    this.dirty = false;
  }
}

export class Linear {
  /** Guessed the town. */
  town = false;
  /** Said what the first picture is, and the tablet came out Greek. */
  greek = false;
  wrongTown = 0;
  wrongThing = 0;
  /** A sign chalked in, or a square pencilled: where along the floor (m). */
  onChalk?: (x: number) => void;
  private faces: Face[] = [];
  private signs: Sign[] = [];
  private sheet = new Sheet();
  /** What's worked out: consonants and vowels. */
  private c = new Set<string>();
  private v = new Set<string>();
  /** Signs waiting to be chalked, one after another. */
  private queue: Sign[] = [];
  private clock = 0;

  constructor(scene: THREE.Scene, body: Body, pickables: THREE.Object3D[]) {
    // the dark boards they're shown on
    const board = new THREE.MeshBasicMaterial({ color: '#19171d' });
    const back = (x0: number, x1: number, y1: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1), board);
      m.position.set((x0 + x1) / 2, y1 / 2, -0.6);
      scene.add(m);
    };
    back(LINEAR.strips[0] - 0.6, LINEAR.pylos + 5.3, 7.4);
    back(LINEAR.tripod - 0.6, LINEAR.tripod + 10.6, 8.8);
    TOWNS.forEach((forms, k) => this.tablet(forms.map((f) => [{ word: f }]), 'town', LINEAR.strips[k], 1.6, 91 + k * 13, body, 'strips'));
    this.tablet([[{ word: ['pu', 'ro'] }, { num: 4 }], [{ word: ['pu', 'ro'] }, { num: 2 }]], 'pylos', LINEAR.pylos, 2.1, 131, body, 'pylos');
    this.tablet(TRIPOD_LINES, 'tripod', LINEAR.tripod, 1.2, 157, body, 'tripod');
    // the grid, on its board
    const sheet = this.sheet;
    const w = sheet.w / SHEET_PX;
    const h = sheet.h / SHEET_PX;
    const paperBoard = new THREE.Mesh(new THREE.PlaneGeometry(w + 1, h + 1), board);
    paperBoard.position.set(LINEAR.grid + w / 2, 1 + h / 2, -0.3);
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sheet.tex }));
    paper.position.set(LINEAR.grid + w / 2, 1.1 + h / 2, -0.2);
    const g = new THREE.Group();
    g.add(paperBoard, paper);
    g.userData.id = 'grid';
    scene.add(g);
    pickables.push(g);
    sheet.paint();
    for (const f of this.faces) f.paint();
  }

  /** A clay tablet: its lines of signs, words, pictures and numbers, cut in; stood with its bottom at `y0` (m). */
  private tablet(lines: Item[][], on: Sign['on'], x0: number, y0: number, seed: number, body: Body, id: string) {
    const items = (line: Item[]) =>
      line.reduce((w, it, n) => w + (n ? DIVIDE : 0) + ('word' in it ? it.word.length * COL : 'pic' in it ? Math.max(...PICTURES[it.pic].map((r) => r.length)) * BIG + 8 : 6 * Math.min(it.num, 5) + 8), 0);
    const wpx = Math.max(...lines.map(items)) + 28;
    const hpx = lines.length * LINE + 14;
    const face = new Face(wpx, hpx, seed, 0.6, CLAY);
    this.faces.push(face);
    lines.forEach((line, j) => {
      const top = 8 + j * LINE;
      // (ruled, as the scribes ruled them)
      if (j) for (let x = 6; x < face.w - 14; x++) face.mark(x, top - 3), face.mark(x, top - 2);
      let x = 14;
      line.forEach((it, n) => {
        if (n && 'word' in it && 'word' in line[n - 1]) for (let y = top + 10; y < top + 30; y++) (face.mark(x + 6, y), face.mark(x + 7, y));
        if (n) x += DIVIDE;
        if ('word' in it) {
          for (const syl of it.word) {
            const rows = (SYL as Record<string, string[]>)[syl];
            const gw = Math.max(...rows.map((r) => r.length)) * BIG;
            const gh = rows.length * BIG;
            const px = x + Math.floor((COL - gw) / 2);
            face.cutRows(rows, px, top + Math.floor((32 - gh) / 2), BIG, face.slots.length);
            const sign: Sign = {
              syl, face, on, letter: syl.toUpperCase(), chalk: null,
              lx: x + Math.floor((COL - (syl.length * 4 - 1) * CLAY.letter) / 2),
              ly: top + 35,
              x: x0 + (x + COL / 2) / PX,
            };
            face.slots.push(sign);
            this.signs.push(sign);
            x += COL;
          }
        } else if ('pic' in it) {
          const rows = PICTURES[it.pic];
          const k = BIG;
          face.cutRows(rows, x + 4, top + Math.max(0, 34 - rows.length * k), k);
          x += Math.max(...rows.map((r) => r.length)) * k + 8;
        } else {
          // (a number: a stroke for each one, and for ten a bar, as they counted)
          const tens = Math.floor(it.num / 10);
          const ones = it.num % 10;
          for (let t = 0; t < tens; t++) for (let i = 0; i < 12; i++) (face.mark(x + 2 + i, top + 12 + t * 5), face.mark(x + 2 + i, top + 13 + t * 5));
          const ox = x + (tens ? 18 : 2);
          for (let o = 0; o < ones; o++) for (let y = top + 12 + (o >= 5 ? 12 : 0); y < top + 22 + (o >= 5 ? 12 : 0); y++) (face.mark(ox + (o % 5) * 5, y), face.mark(ox + (o % 5) * 5 + 1, y));
          x += 6 * Math.min(it.num, 5) + 8;
        }
      });
    });
    // (clay: rounded at the corners, a bit gone at one end)
    const w = wpx / PX;
    const h = hpx / PX;
    const r = 0.25;
    body(
      [[r, 0], [w - r, 0], [w, r], [w, h - r * 1.6], [w - r * 2.2, h], [r, h], [0, h - r], [0, r]],
      x0, y0, 0, 0.5, face, id,
    );
  }

  /** What there is to say where you are. */
  card(x: number, near: boolean): LinearCard | null {
    if (!near || x < LINEAR.from) return null;
    if (x < LINEAR.grid - 0.8) return this.town ? 'towns' : 'kober';
    if (x < GRID_TO + 1) return 'grid';
    return this.greek ? 'greek' : 'tablet';
  }

  /** Where to stand to read each thing. */
  goal(thing: LinearThing) {
    return thing === 'strips' ? 59.6 : thing === 'pylos' ? 72.9 : thing === 'grid' ? LINEAR.grid + 7 : LINEAR.tripod + 4.5;
  }

  /** The tripod tablet as far as it can be read. */
  get spelled() {
    const lines: string[] = [];
    for (const line of TRIPOD_LINES) {
      const words = line.filter((it): it is { word: string[] } => 'word' in it).map((it) => it.word.map((s) => (this.knows(s) ? s : '?')).join('-'));
      lines.push(words.join(' '));
    }
    return lines.join(' · ');
  }

  private knows(syl: string) {
    const { c, v } = cv(syl);
    return this.c.has(c) && this.v.has(v);
  }

  /** The town the top tablet names. Knossos, in any of the ways it's spelled. */
  guessTown(said: string) {
    const n = said.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-zα-ω]/g, '');
    const right = /^[kcg]?n[oω]s{1,2}(o|u|ό)?s?$/.test(n) || /^(κνωσ|κνοσ)/.test(n) || /^amn[ie]s+[ou]s$/.test(n) || /^t[yiu]l[iy]s+[ou]s$/.test(n);
    if (!right) {
      this.wrongTown++;
      return false;
    }
    this.town = true;
    for (const c of ['', 'k', 'n', 's', 'j', 'm', 't', 'r', 'p']) this.c.add(c);
    for (const v of ['o', 'i', 'a', 'u']) this.v.add(v);
    this.queue.push(...this.signs.filter((s) => s.on !== 'tripod'));
    return true;
  }

  /** What the first picture on the tripod tablet is. */
  guessThing(said: string) {
    const n = said.toLowerCase().replace(/[^a-zα-ω]/g, '');
    if (!/(trip|τριπ|cauldron)/.test(n)) {
      this.wrongThing++;
      return false;
    }
    this.greek = true;
    for (const c of ['d', 'q', 'w']) this.c.add(c);
    this.v.add('e');
    this.queue.push(...this.signs.filter((s) => s.on === 'tripod' && s.chalk === null));
    return true;
  }

  private chalk(s: Sign) {
    if (s.chalk !== null) return;
    s.chalk = s.letter;
    s.face.dirty = true;
    this.onChalk?.(s.x);
  }

  update(dt: number, x: number, z: number) {
    const near = z < 4.2;
    this.clock += dt;
    // (what's been worked out goes on one sign after another)
    if (this.queue.length && this.clock > 0.09) {
      this.clock = 0;
      this.chalk(this.queue.shift()!);
    }
    // the tripod tablet, as far as you know, under you as you walk
    if (this.town && near) for (const s of this.signs) if (s.on === 'tripod' && s.chalk === null && Math.abs(s.x - x) < 0.8 && this.knows(s.syl)) this.chalk(s);
    // and the grid, while you're at it: heads first, then each square they make
    if (near && x > LINEAR.grid - 1 && x < GRID_TO + 1 && this.clock > 0.11) {
      const shown = this.sheet.shown;
      const c = CONSONANTS.find((c) => this.c.has(c) && !shown.c.has(c));
      const v = c === undefined ? VOWELS.find((v) => this.v.has(v) && !shown.v.has(v)) : undefined;
      const cell = c === undefined && v === undefined ? CONSONANTS.flatMap((c) => VOWELS.map((v) => c + v)).find((s) => s in SYL && this.knows(s) && !shown.cells.has(s)) : undefined;
      if (c !== undefined) shown.c.add(c);
      else if (v !== undefined) shown.v.add(v);
      else if (cell) shown.cells.add(cell);
      if (c !== undefined || v !== undefined || cell) {
        this.clock = 0;
        this.sheet.paint();
        this.onChalk?.(this.sheetX(c, cell));
      }
    }
    for (const f of this.faces) if (f.dirty) f.paint();
  }

  /** Where along the floor a column of the grid is (m). */
  private sheetX(c?: string, cell?: string) {
    const col = c ?? (cell ? cv(cell).c : undefined);
    const i = col === undefined ? CONSONANTS.length / 2 : CONSONANTS.indexOf(col);
    return LINEAR.grid + (this.sheet.colX(i) + Sheet.CELL_W / 2) / SHEET_PX;
  }
}
