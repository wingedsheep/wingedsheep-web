import type { Show } from './companion';

type Ctx = CanvasRenderingContext2D;

/** A 3×5 pixel font, just the characters the programmes need, one string per row. */
const GLYPHS: Record<string, string[]> = {
  P: ['###', '#.#', '###', '#..', '#..'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
};

/** Pixel art from strings: '#' is a pixel. */
function sprite(c: Ctx, rows: string[], x: number, y: number, color: string) {
  c.fillStyle = color;
  rows.forEach((r, j) => [...r].forEach((p, i) => p === '#' && c.fillRect(x + i, y + j, 1, 1)));
}

function text(c: Ctx, s: string, x: number, y: number, color: string) {
  [...s].forEach((ch, i) => GLYPHS[ch] && sprite(c, GLYPHS[ch], x + i * 4, y, color));
}

/** The chalk outline on the village green, arms and legs every which way. */
const OUTLINE = ['.#...#......', '#.#.#.......', '.#.#######..', '...#.....#..', '..#.......#.'];

function rect(c: Ctx, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

/** Someone two pixels wide: head, body in `coat`, legs. */
function person(c: Ctx, x: number, y: number, coat: string, hair = '#5a3e2c') {
  rect(c, hair, x, y, 2, 1);
  rect(c, '#f2c6a6', x, y + 1, 2, 1);
  rect(c, coat, x, y + 2, 2, 3);
  rect(c, '#2e2a3a', x, y + 5, 2, 2);
}

function heart(c: Ctx, x: number, y: number, color: string) {
  rect(c, color, x, y, 1, 1);
  rect(c, color, x + 2, y, 1, 1);
  rect(c, color, x, y + 1, 3, 1);
  rect(c, color, x + 1, y + 2, 1, 1);
}

/**
 * A British murder mystery: a thatched cottage, a church, a chalk outline on the village green,
 * a detective pacing up and down, and the sign at the edge of the village, which can't keep up.
 */
function murder(c: Ctx, t: number) {
  rect(c, '#9db8d8', 0, 0, 48, 36);
  rect(c, '#4a8a45', 0, 22, 48, 14);
  rect(c, '#8f8799', 35, 12, 7, 10); // the church, and its spire
  for (let i = 0; i < 7; i++) rect(c, '#6a6275', 38 - Math.floor(i / 2), 5 + i, 1 + Math.floor(i / 2) * 2, 1);
  rect(c, '#e8b24a', 38, 15, 1, 2);
  rect(c, '#e6d4b8', 4, 16, 12, 6); // the cottage, under its thatch
  for (let i = 0; i < 4; i++) rect(c, '#c9a23f', 3 + i, 12 + i, 14 - i * 2, 1);
  rect(c, '#8c3a2a', 9, 18, 2, 4);
  rect(c, '#fff1b0', 5, 17, 2, 2);
  rect(c, '#fff1b0', 13, 17, 2, 2);
  // the sign: a fresh body every few seconds, and a new series once they run out
  const pop = 12 - (Math.floor(t / 3) % 12);
  rect(c, '#f2ece2', 19, 11, 14, 13);
  rect(c, '#5c3824', 25, 24, 2, 2);
  text(c, 'POP', 20, 12, '#1d1a24');
  text(c, String(pop), pop > 9 ? 22 : 24, 18, pop <= 3 ? '#c8403a' : '#1d1a24');
  // the chalk outline, and the detective in his trench coat, pacing
  sprite(c, OUTLINE, 30, 28, '#f2ece2');
  const x = 8 + Math.round((Math.sin(t * 0.6) * 0.5 + 0.5) * 16);
  person(c, x, 25, '#c9ad8c');
  rect(c, '#c9c6c0', x + (Math.cos(t * 0.6) > 0 ? 2 : -1), 27, 1, 1); // the magnifying glass
  if (t % 9 < 0.5) rect(c, 'rgba(120,0,20,0.45)', 0, 0, 48, 36); // dun dun DUNN
}

/**
 * Location, Location, Location: the perfect cottage, the asking price going up faster than you
 * can read it, and the couple, shaking their heads.
 */
function location(c: Ctx, t: number) {
  rect(c, '#a9dcff', 0, 0, 48, 36);
  rect(c, '#6aa74f', 0, 24, 48, 12);
  rect(c, '#dcbd83', 21, 24, 4, 12); // the garden path
  rect(c, '#b27a48', 14, 13, 18, 11); // a cottage in the countryside, roses round the door
  for (let i = 0; i < 5; i++) rect(c, '#6a3b6e', 13 + i, 8 + i, 20 - i * 2, 1);
  rect(c, '#3f6a8a', 21, 18, 4, 6);
  rect(c, '#fff1b0', 16, 15, 3, 3);
  rect(c, '#fff1b0', 27, 15, 3, 3);
  for (const x of [15, 19, 26, 30]) rect(c, '#d98fb0', x, 23, 1, 1);
  // the estate agent's board, and the price
  rect(c, '#5c3824', 38, 16, 1, 9);
  rect(c, '#f2ece2', 31, 10, 17, 7);
  const k = 400 + (Math.floor(t * 23) % 600); // and up, and up, and back to 400 for the next couple
  text(c, `${k}K`, 32, 11, k > 800 ? '#c8403a' : '#1d1a24');
  // the presenters, and the couple: a slow no, left and right
  const no = Math.round(Math.sin(t * 5));
  person(c, 4, 26, '#c8403a', '#8c2f39');
  person(c, 7, 26, '#26242b', '#9c8f82');
  person(c, 40 + no, 27, '#2f5d8c');
  person(c, 43 + no, 27, '#3d7a4a', '#e8cf9c');
}

/**
 * B&B vol liefde: lavender rows in Provence, a stone farmhouse with blue shutters, breakfast
 * for two on the terrace, and hearts rising... until one of them doesn't.
 */
function bnb(c: Ctx, t: number) {
  rect(c, '#f4d27a', 0, 0, 48, 36);
  rect(c, '#e8a05a', 0, 12, 48, 3);
  rect(c, '#6b8a3a', 0, 15, 48, 21);
  for (let y = 17; y < 36; y += 3) rect(c, '#9c88c4', 0, y, 48, 1);
  rect(c, '#e3dacb', 26, 5, 18, 12); // the mas, and its terracotta roof
  rect(c, '#b0512f', 25, 3, 20, 2);
  for (const x of [28, 34, 40]) rect(c, '#4f7fae', x, 8, 2, 3);
  // the table on the terrace, a croissant each, and the two of them
  rect(c, '#f2ece2', 10, 27, 12, 1);
  rect(c, '#5c3824', 11, 28, 1, 4);
  rect(c, '#5c3824', 20, 28, 1, 4);
  rect(c, '#e8b24a', 13, 26, 2, 1);
  rect(c, '#e8b24a', 17, 26, 2, 1);
  person(c, 7, 24, '#f2ece2', '#2a2230');
  person(c, 23, 24, '#c8403a', '#ecd38e');
  const cycle = t % 12;
  if (cycle < 9) {
    for (let i = 0; i < 3; i++) {
      const k = (cycle * 0.7 + i * 1.3) % 3;
      heart(c, 14 + Math.round(Math.sin(t * 2 + i) * 2), Math.round(24 - k * 7), '#e46f5a');
    }
  } else {
    heart(c, 15, Math.round(12 + (cycle - 9) * 5), '#8c8290'); // and then someone mentions their ex
  }
}

/**
 * Rail Away: a little red train over a stone viaduct in the Alps. Nothing else happens, for
 * forty-five minutes. That's the point.
 */
function rail(c: Ctx, t: number) {
  rect(c, '#bfe2f4', 0, 0, 48, 36);
  const far = (t * 0.4) % 48; // the mountains drift by, the far ones slower
  for (const off of [-far, 48 - far]) {
    for (const [x, h] of [[4, 16], [18, 22], [32, 14]]) {
      for (let i = 0; i < h; i++) rect(c, i < 5 ? '#e9f0f7' : '#8a8a9e', Math.round(off + x - i / 2), 6 + (22 - h) + i, i + 1, 1);
    }
  }
  rect(c, '#3d7a4a', 0, 24, 48, 12);
  rect(c, '#9a8d9c', 0, 21, 48, 2); // the viaduct, and its arches
  for (let x = 2; x < 48; x += 8) rect(c, '#9a8d9c', x, 23, 3, 13);
  rect(c, '#5c3824', 0, 20, 48, 1);
  const x = Math.round(((t * 3) % 80) - 28); // train
  for (let k = 0; k < 3; k++) {
    rect(c, '#c8403a', x + k * 9, 15, 8, 5);
    rect(c, '#fff1b0', x + k * 9 + 1, 16, 6, 1);
  }
  rect(c, '#2e2a3a', x + 26, 12, 1, 3); // the pantograph
  rect(c, '#1d1a24', 0, 11, 48, 1); // the overhead line
}

const DRAW: Record<Show, (c: Ctx, t: number) => void> = { murder, location, bnb, rail };

/** Paint one frame of a programme onto the telly's 48×36 canvas. */
export function drawProgramme(c: Ctx, show: Show, t: number) {
  DRAW[show](c, t);
}
