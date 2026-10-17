/**
 * A face with things cut in it, lit from the west in stepped bands: the stones' granodiorite, and
 * the tablets' clay past them. Chalk goes on over what's been read.
 */
import * as THREE from 'three';
import SIGNS from './signs.json';

export type Glyph = keyof typeof SIGNS;
/** The filler: the rest of each text, too small and too many to read here. */
const FILL: Glyph[] = ['owl', 'ankh', 'eye', 'snake', 'bolt', 'seat', 'reed', 'bread', 'water', 'lasso', 'vulture', 'mouth', 'cloth', 'hand', 'egg', 'stool'];

/** Chalk letters, three by five. */
export const CHALK_FONT: Record<string, string[]> = {
  '-': ['...', '...', '###', '...', '...'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['#.#', '###', '###', '###', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
};

/** Ordered dither, four by four. */
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * One stone's face: a texture of dark granodiorite with its flecks, lit from the west in stepped
 * bands, and its signs cut in (dark in the cut, its east wall catching the light). Chalk goes on
 * over that.
 */
/** What's cut on a face and can be chalked: the letters it's read as, and where they go (px, their top left). */
export interface FaceSlot {
  letter: string;
  chalk: string | null;
  lx: number;
  ly: number;
}

/** How a face is coloured: its four lit-to-dark bands, a cut's dark and its lit east wall, and its flecks. */
export interface FaceLook {
  bands: number[][];
  cut: number[];
  wall: number[];
  /** Chalk letters, this many texture pixels to each of theirs. */
  letter: number;
}

const GRANODIORITE: FaceLook = {
  bands: [
    [0x47, 0x45, 0x50],
    [0x3b, 0x3a, 0x45],
    [0x31, 0x30, 0x3a],
    [0x28, 0x27, 0x30],
  ],
  cut: [0x15, 0x14, 0x1a],
  wall: [0x86, 0x80, 0x88],
  letter: 3,
};

export class Face {
  readonly canvas = document.createElement('canvas');
  readonly tex: THREE.CanvasTexture;
  /** What's cut: 0 nothing, 1 a cut; and which slot a cut belongs to (−1: none of the names). */
  private cut: Uint8Array;
  private owner: Int16Array;
  private base?: ImageData;
  dirty = true;
  readonly slots: FaceSlot[] = [];

  readonly w: number;
  readonly h: number;

  constructor(
    w: number,
    h: number,
    private seed: number,
    /** How much of the light's left at its east edge. */
    private falloff = 0.55,
    private look: FaceLook = GRANODIORITE,
  ) {
    this.w = w = Math.round(w);
    this.h = h = Math.round(h);
    this.canvas.width = w;
    this.canvas.height = h;
    this.cut = new Uint8Array(w * h);
    this.owner = new Int16Array(w * h).fill(-1);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.colorSpace = THREE.SRGBColorSpace;
  }

  rand() {
    return (this.seed = (this.seed * 16807) % 2147483647) / 2147483647;
  }

  /** Cut a sign in at (x, y), its top left, `scale` texture pixels to each of its own; flipped to face east if asked. */
  glyph(g: Glyph, x: number, y: number, scale = 1, owner = -1, flip = false) {
    this.cutRows(SIGNS[g], x, y, scale, owner, flip);
  }

  /** Cut any drawing in, given as rows of '#' and '.'. */
  cutRows(rows: string[], x: number, y: number, scale = 1, owner = -1, flip = false) {
    const gw = Math.max(...rows.map((r) => r.length));
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== '#') continue;
        const ii = flip ? gw - 1 - i : i;
        for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) this.mark(x + ii * scale + a, y + j * scale + b, owner);
      }
    });
  }

  mark(x: number, y: number, owner = -1) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cut[y * this.w + x] = 1;
    if (owner >= 0) this.owner[y * this.w + x] = owner;
  }

  /** A ring round a name: its outline cut in, two pixels wide, and the bar it's tied off with at its end. */
  ring(x: number, y: number, w: number, h: number, upright: boolean) {
    const r = Math.min(w, h) / 2;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        // (a stadium: straight sides, round ends)
        const cx = upright ? w / 2 : Math.min(Math.max(i, r), w - r);
        const cy = upright ? Math.min(Math.max(j, r), h - r) : h / 2;
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
        if (d <= r && d > r - 2) this.mark(x + i, y + j);
      }
    }
    // (tied off at the name's end: a bar across, past its sides)
    if (upright) for (let i = -3; i < w + 3; i++) for (let b = 0; b < 2; b++) this.mark(x + i, y + h + 1 + b);
    else for (let j = -3; j < h + 3; j++) for (let b = 0; b < 2; b++) this.mark(x + w + 1 + b, y + j);
  }

  /** Rows of small signs, as the rest of a text, between x0 and x1 (px), leaving out the box `skip`. */
  rows(x0: number, x1: number, y0: number, y1: number, gap: number, skip?: { x0: number; x1: number; y0: number; y1: number }) {
    for (let y = y0; y + 12 <= y1; y += gap) {
      let x = x0 + Math.floor(this.rand() * 4);
      while (x < x1 - 8) {
        const g = FILL[Math.floor(this.rand() * FILL.length)];
        const gw = Math.max(...SIGNS[g].map((r) => r.length));
        const gh = SIGNS[g].length;
        if (x + gw > x1) break;
        if (!(skip && x + gw > skip.x0 && x < skip.x1 && y + 12 > skip.y0 && y < skip.y1)) this.glyph(g, x, y + 12 - gh);
        x += gw + 2 + Math.floor(this.rand() * 2);
      }
    }
  }

  /** Demotic, as it looks from a little way off: running hooks and ticks along a line. */
  demotic(x0: number, x1: number, y0: number, y1: number, gap: number) {
    for (let y = y0; y + 8 <= y1; y += gap) {
      let x = x0;
      while (x < x1 - 4) {
        const n = 2 + Math.floor(this.rand() * 6);
        for (let k = 0; k < n && x < x1; k++) {
          const tall = this.rand() < 0.35;
          const top = y + (tall ? 0 : 3);
          for (let j = top; j < y + 7; j++) this.mark(x, j);
          if (this.rand() < 0.5) this.mark(x + 1, top);
          if (this.rand() < 0.4) this.mark(x - 1, y + 6);
          x += 2;
        }
        x += 3;
      }
    }
  }

  /** Greek capitals, cut in: drawn with a font and then made hard-edged, so they're cut, not smudged. */
  greek(text: string, x: number, y: number, size: number, width?: number) {
    const c = document.createElement('canvas');
    c.width = width ?? Math.ceil(text.length * size);
    c.height = size + 4;
    const g = c.getContext('2d')!;
    g.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
    g.textBaseline = 'top';
    g.fillStyle = '#fff';
    const measured = g.measureText(text).width;
    // (if there's a width to fill, as many letters as fit, from the front)
    let s = text;
    if (width) while (s.length && g.measureText(s).width > width) s = s.slice(0, -1);
    g.fillText(s, width ? 0 : 0, 1);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (d[(j * c.width + i) * 4 + 3] > 120) this.mark(x + i, y + j);
    return width ? width : measured;
  }

  /** The stone and its cuts, lit, once. */
  private paintBase() {
    const img = new ImageData(this.w, this.h);
    const p = img.data;
    const stone = this.look.bands;
    const fleck = Float32Array.from({ length: ((this.w >> 1) + 1) * ((this.h >> 1) + 1) }, () => this.rand());
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        // (the light from the west, in four steps, dithered where they meet: two texture pixels to a dot, so it doesn't shimmer)
        const lit = 1 - (x / this.w) * (1 - this.falloff) - (y / this.h) * 0.12;
        const bx = x >> 1;
        const by = y >> 1;
        const band = THREE.MathUtils.clamp((1 - lit) * 7.5 + BAYER[(by % 4) * 4 + (bx % 4)] - 0.5, 0, 3);
        let c = stone[Math.round(band)];
        // (granodiorite: grey, with pale and dark flecks, a dot each; clay, the same, gritty)
        const n = fleck[by * (this.w >> 1) + bx] ?? 0;
        if (n < 0.03) c = [c[0] + 14, c[1] + 10, c[2] + 12];
        else if (n < 0.05) c = [c[0] - 9, c[1] - 9, c[2] - 8];
        const i = (y * this.w + x) * 4;
        const k = y * this.w + x;
        if (this.cut[k]) {
          // in the cut: dark, but its east wall (facing the light) lit
          const east = x + 1 >= this.w || !this.cut[k + 1];
          c = east ? this.look.wall : this.look.cut;
        }
        p[i] = c[0];
        p[i + 1] = c[1];
        p[i + 2] = c[2];
        p[i + 3] = 255;
      }
    }
    this.base = img;
  }

  /** The face as it is now: the stone, and chalk in what's been read, with its letter by it. */
  paint() {
    if (!this.base) this.paintBase();
    const img = new ImageData(new Uint8ClampedArray(this.base!.data), this.w, this.h);
    const p = img.data;
    const chalk = (x: number, y: number, dim = 0) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = (y * this.w + x) * 4;
      // (chalk's never quite even)
      const v = 0xe2 - dim - ((x * 7 + y * 13) % 5 === 0 ? 18 : 0);
      p[i] = v;
      p[i + 1] = v - 3;
      p[i + 2] = v - 12;
    };
    const chalked = new Set(this.slots.filter((s) => s.chalk !== null).map((s) => this.slots.indexOf(s)));
    if (chalked.size) {
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const k = y * this.w + x;
          if (!this.cut[k] || !chalked.has(this.owner[k])) continue;
          // (the west wall of the cut still in its shadow)
          chalk(x, y, x > 0 && !this.cut[k - 1] ? 40 : 0);
        }
      }
    }
    for (const s of this.slots) {
      if (!s.chalk) continue;
      // the letters, in chalk, under the sign (or beside it, on the obelisk's ring)
      const k = this.look.letter;
      [...s.chalk].forEach((ch, n) => {
        const rows = CHALK_FONT[ch];
        if (!rows) return;
        const lx = s.lx + n * 4 * k;
        rows.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) if (row[i] === '#') for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) chalk(lx + i * k + a, s.ly + j * k + b, 10);
        });
      });
    }
    this.canvas.getContext('2d')!.putImageData(img, 0, 0);
    this.tex.needsUpdate = true;
    this.dirty = false;
  }
}
