import type { Day, Forecast, WeatherKind } from '../forecast';

type Ctx = CanvasRenderingContext2D;

/** The board's size in pixels: three columns, one a day. */
export const BOARD = { w: 66, h: 48 };

const SLATE = '#27302c';
const CHALK = '#ece8dc';
const YELLOW = '#f0d77a';
const BLUE = '#9cc3ea';

/** A 3×5 pixel font, just what the board needs (the degree sign is two wide). */
const GLYPHS: Record<string, string[]> = {
  A: ['###', '#.#', '###', '#.#', '#.#'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  Y: ['#.#', '#.#', '###', '.#.', '.#.'],
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
  '-': ['...', '...', '###', '...', '...'],
  '°': ['##', '##', '..', '..', '..'],
  '?': ['###', '..#', '.##', '...', '.#.'],
};

// the pictures, chalked in outline: '#' is chalk, 'o' rubs out what's behind (the sun behind a cloud)
const SUN = ['....#....', '.#.....#.', '...###...', '..#####..', '#.#####.#', '..#####..', '...###...', '.#.....#.', '....#....'];
const CLOUD = ['....###....', '..##ooo##..', '.#ooooooo#.', '#ooooooooo#', '#ooooooooo#', '.#########.'];
const RAIN = ['#...#...#', '.#...#...', '..#...#..'];
const DRIZZLE = ['#.....#..', '...#.....', '.....#..#'];
const SNOW = ['#...#...#', '.........', '..#...#..'];
const SLEET = ['#...+...#', '..+...#..', '#...#...+']; // '+': snow among the rain
const BOLT = ['..##', '.##.', '####', '..#.', '.#..'];
const FOG = ['#######.##', '..........', '.###.######', '..........', '#####.####'];
const WIND = ['######.', '......#', '..####.'];

/**
 * Chalk the next three days onto the hut's board: the day, a picture of the weather, a mark
 * for a windy day, and the high and the low. With no forecast in, a big question mark.
 */
export function drawForecast(c: Ctx, forecast: Forecast | null | undefined) {
  const rnd = seeded(hash(forecast?.days.map((d) => d.date).join() ?? ''));
  c.globalAlpha = 1;
  c.fillStyle = SLATE;
  c.fillRect(0, 0, BOARD.w, BOARD.h);
  // yesterday's forecast, not quite rubbed out
  for (let i = 0; i < 90; i++) {
    c.globalAlpha = 0.05 + rnd() * 0.07;
    c.fillStyle = CHALK;
    c.fillRect(Math.floor(rnd() * BOARD.w), Math.floor(rnd() * BOARD.h), 1 + Math.floor(rnd() * 3), 1);
  }
  const days = forecast?.days.slice(0, 3) ?? [];
  if (!days.length) {
    chalk(c, rnd, GLYPHS['?'].map((r) => [...r].map((p) => p.repeat(3)).join('')).flatMap((r) => [r, r, r]), 28, 16, CHALK);
    return;
  }
  days.forEach((day, i) => {
    const mid = 11 + i * 22;
    const label = i === 0 ? 'TODAY' : weekday(day.date);
    text(c, rnd, label, mid - width(label) / 2, 3, CHALK);
    picture(c, rnd, day.kind, mid, 11);
    if (day.wind >= 9) chalk(c, rnd, WIND, mid - 3, 25, CHALK);
    const high = `${Math.round(day.high)}°`;
    const low = `${Math.round(day.low)}°`;
    text(c, rnd, high, mid - width(high) / 2, 31, CHALK);
    text(c, rnd, low, mid - width(low) / 2, 38, BLUE);
  });
  // a line under the days, drawn freehand
  for (let x = 3; x < BOARD.w - 3; x++) {
    c.globalAlpha = 0.5 + rnd() * 0.3;
    c.fillStyle = CHALK;
    c.fillRect(x, x % 17 < 9 ? 9 : 10, 1, 1);
  }
  c.globalAlpha = 1;
}

/** The weather's picture, its top centred on (mid, top). */
function picture(c: Ctx, rnd: () => number, kind: WeatherKind, mid: number, top: number) {
  const cloudy = (under?: string[], color = BLUE) => {
    chalk(c, rnd, CLOUD, mid - 5, top + 1, CHALK);
    if (under) chalk(c, rnd, under, mid - 4, top + 8, color);
  };
  switch (kind) {
    case 'clear':
    case 'warm':
    case 'hot':
      chalk(c, rnd, SUN, mid - 4, top + 1, YELLOW);
      break;
    case 'partly':
      chalk(c, rnd, SUN, mid - 7, top - 1, YELLOW);
      chalk(c, rnd, CLOUD, mid - 3, top + 4, CHALK);
      break;
    case 'cloudy':
    case 'windy':
      chalk(c, rnd, CLOUD, mid - 7, top + 1, CHALK);
      chalk(c, rnd, CLOUD, mid - 3, top + 4, CHALK);
      break;
    case 'fog':
      chalk(c, rnd, FOG, mid - 5, top + 3, CHALK);
      break;
    case 'drizzle':
      cloudy(DRIZZLE);
      break;
    case 'rain':
    case 'showers':
      cloudy(RAIN);
      break;
    case 'snow':
      cloudy(SNOW, CHALK);
      break;
    case 'sleet':
      cloudy(SLEET);
      chalk(c, rnd, SLEET.map((r) => r.replace(/[#]/g, '.').replace(/\+/g, '#')), mid - 4, top + 8, CHALK);
      break;
    case 'storm':
    case 'hail':
      cloudy();
      chalk(c, rnd, BOLT, mid - 2, top + 7, YELLOW);
      break;
  }
}

/** Pixel art from strings, in chalk: never quite even. */
function chalk(c: Ctx, rnd: () => number, rows: string[], x: number, y: number, color: string) {
  rows.forEach((r, j) =>
    [...r].forEach((p, i) => {
      if (p === '.' || p === '+') return;
      c.globalAlpha = p === 'o' ? 1 : 0.75 + rnd() * 0.25;
      c.fillStyle = p === 'o' ? SLATE : color;
      c.fillRect(x + i, y + j, 1, 1);
    }),
  );
  c.globalAlpha = 1;
}

function text(c: Ctx, rnd: () => number, s: string, x: number, y: number, color: string) {
  for (const ch of s) {
    const g = GLYPHS[ch];
    if (g) chalk(c, rnd, g, Math.round(x), y, color);
    x += (g?.[0].length ?? 3) + 1;
  }
}

function width(s: string) {
  return [...s].reduce((w, ch) => w + (GLYPHS[ch]?.[0].length ?? 3) + 1, -1);
}

function weekday(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3).toUpperCase();
}

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A seeded random stream, so the chalk doesn't shimmer each time the board is redrawn. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
