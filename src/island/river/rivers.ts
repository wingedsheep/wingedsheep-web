/**
 * The rivers over the ridge, gentlest first, each a small step on from the last. You start on the
 * Dawdle; make it all the way down one and the next one opens. Each is the same kind of made-up mountain river (see course.ts), shaped
 * by its Profile: how hard it starts, how hard it gets, and what's allowed in it.
 *
 * (Only data here: the island's own bundle reads it for the cards, before the river's loaded.)
 */

import type { Kind, Piece } from './course';

/**
 * What a river looks like, so no two feel the same: the colour of its water, what grows along it,
 * and what's up on the valley's sides. (Colours are linear RGB, as the water's shader wants them.)
 */
export interface Look {
  /** The water in the shallows, over the middle, and where it's deep and running hard. */
  water: { shallow: [number, number, number]; mid: [number, number, number]; deep: [number, number, number] };
  /** How many of the trees are pines (by the water: further back, more), and how many of the rest birches. */
  pines: number;
  birch: number;
  /** Flowers, willows and lilies by the slow water, and sheep on the open banks, against the default. */
  meadow: number;
  /** 0..1: snow lying on the high ground. */
  snow: number;
  /** How often a side stream spills down a gorge's wall into it, against the default. */
  springs: number;
}

/** What the course needs to know about a river to make one up. */
export interface Profile {
  /** From where you push off to the take-out (m). */
  length: number;
  /** How hard it is (0..1, see Course.ramp) at the top and by the take-out… */
  heat: [number, number];
  /** …and the hottest any stretch of white water gets. */
  cap: number;
  /** How far down (m) the cascades and the waterfalls can start (Infinity: none). */
  cascades: number;
  falls: number;
  /** How often a gorge, and a cascade (a staircase of ledges), come up against the default. */
  gorges: number;
  stairs: number;
  /** The hardest grade you'll meet on it: nothing on it is graded higher. */
  grade: number;
  /** How fast the water runs, against the default. */
  speed: number;
  /** Which set pieces it has (see Course.piece): a gentle river only has the ones that aren't hard. */
  pieces: Piece[];
  /** Whether it has ledges at all, and how many holes and fallen trees it has, against the default. */
  ledges: boolean;
  snags: number;
  /** What it's known for, and always has somewhere on it (a cascade, a waterfall). */
  signature: Kind[];
  look: Look;
}

export interface RiverDef extends Profile {
  id: string;
  name: string;
  /** One line about it, for the card. */
  lede: string;
  /** Where its best is kept in this browser. */
  key: string;
}

export const RIVERS: RiverDef[] = [
  // each one a small step on from the last, with one new thing in it
  {
    id: 'dawdle', name: 'The Dawdle', grade: 2, lede: 'Slow and green, a few rocks, a lot of ducks.',
    length: 800, heat: [0, 0.1], cap: 0.3, cascades: Infinity, falls: Infinity, gorges: 0, stairs: 1,
    speed: 0.85, pieces: ['balls'], ledges: false, snags: 0, key: 'wingedsheep:river:dawdle',
    signature: [], look: { water: { shallow: [0.36, 0.8, 0.46], mid: [0.1, 0.48, 0.34], deep: [0.05, 0.27, 0.24] }, pines: 0.2, birch: 0.2, meadow: 2, snow: 0, springs: 0 },
  },
  {
    id: 'meander', name: 'The Meander', grade: 2, lede: 'A bit quicker. The ducks look less sure.',
    length: 1000, heat: [0, 0.25], cap: 0.34, cascades: Infinity, falls: Infinity, gorges: 0.3, stairs: 1,
    speed: 0.92, pieces: ['balls', 'fork', 'slalom'], ledges: true, snags: 0.4, key: 'wingedsheep:river:meander',
    signature: [], look: { water: { shallow: [0.25, 0.8, 0.62], mid: [0.06, 0.43, 0.48], deep: [0.03, 0.2, 0.33] }, pines: 0.3, birch: 0.45, meadow: 1.5, snow: 0, springs: 0.4 },
  },
  {
    id: 'tumble', name: 'The Tumble', grade: 3, lede: 'Proper white water now. Keep her upright.',
    length: 1200, heat: [0.05, 0.5], cap: 0.55, cascades: Infinity, falls: Infinity, gorges: 0.6, stairs: 1,
    speed: 1, pieces: ['balls', 'fork', 'slalom', 'doors', 'strainers'], ledges: true, snags: 0.8, key: 'wingedsheep:river:tumble',
    signature: [], look: { water: { shallow: [0.22, 0.78, 0.66], mid: [0.05, 0.4, 0.52], deep: [0.03, 0.17, 0.33] }, pines: 0.45, birch: 0.15, meadow: 1, snow: 0, springs: 0.8 },
  },
  {
    id: 'drop', name: 'The Long Drop', grade: 3, lede: 'Ledges all the way down. Boof them.',
    length: 1400, heat: [0.1, 0.62], cap: 0.62, cascades: 450, falls: Infinity, gorges: 0.8, stairs: 3,
    speed: 1, pieces: ['slalom', 'strainers', 'doors', 'funnel', 'weir', 'fork', 'balls'], ledges: true, snags: 1, key: 'wingedsheep:river:drop',
    signature: ['cascade'], look: { water: { shallow: [0.24, 0.74, 0.56], mid: [0.05, 0.38, 0.42], deep: [0.03, 0.18, 0.27] }, pines: 0.5, birch: 0.1, meadow: 0.8, snow: 0, springs: 1.2 },
  },
  {
    // (the river as it was before there were six of them: its best carries on here)
    id: 'black', name: 'Black Water', grade: 4, lede: 'Holes, gorges, and a waterfall. Don’t look down.',
    length: 1800, heat: [0.15, 0.9], cap: 0.88, cascades: 750, falls: 950, gorges: 1, stairs: 1,
    speed: 1, pieces: ['slalom', 'strainers', 'doors', 'funnel', 'weir', 'fork', 'balls'], ledges: true, snags: 1, key: 'wingedsheep:river:takeout',
    signature: ['falls'], look: { water: { shallow: [0.34, 0.56, 0.4], mid: [0.07, 0.22, 0.25], deep: [0.02, 0.07, 0.11] }, pines: 0.75, birch: 0.05, meadow: 0.4, snow: 0, springs: 1.3 },
  },
  {
    id: 'coffee', name: 'Hold My Coffee', grade: 5, lede: 'Grade 5, and a long way down. Beike’s staying on the bank.',
    length: 2200, heat: [0.55, 1], cap: 1, cascades: 600, falls: 650, gorges: 1.5, stairs: 1,
    speed: 1, pieces: ['slalom', 'strainers', 'doors', 'funnel', 'weir', 'fork', 'balls'], ledges: true, snags: 1, key: 'wingedsheep:river:coffee',
    signature: ['cascade', 'falls'], look: { water: { shallow: [0.46, 0.88, 0.82], mid: [0.15, 0.6, 0.68], deep: [0.05, 0.33, 0.5] }, pines: 0.85, birch: 0.05, meadow: 0.3, snow: 1, springs: 1.7 },
  },
];

/** For anything that makes a river up without saying which (Black Water: the river as it was). */
export const DEFAULT_PROFILE: Profile = RIVERS[4];
