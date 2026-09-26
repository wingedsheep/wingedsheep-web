/**
 * The rivers over the ridge, gentlest first, each a small step on from the last. You start on the
 * Dawdle; make it all the way down one and the next one opens. Each is the same kind of made-up mountain river (see course.ts), shaped
 * by its Profile: how hard it starts, how hard it gets, and what's allowed in it.
 *
 * (Only data here: the island's own bundle reads it for the cards, before the river's loaded.)
 */

import type { Piece } from './course';

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
  },
  {
    id: 'meander', name: 'The Meander', grade: 2, lede: 'A bit quicker. The ducks look less sure.',
    length: 1000, heat: [0, 0.25], cap: 0.34, cascades: Infinity, falls: Infinity, gorges: 0.3, stairs: 1,
    speed: 0.92, pieces: ['balls', 'fork', 'slalom'], ledges: true, snags: 0.4, key: 'wingedsheep:river:meander',
  },
  {
    id: 'tumble', name: 'The Tumble', grade: 3, lede: 'Proper white water now. Keep her upright.',
    length: 1200, heat: [0.05, 0.5], cap: 0.55, cascades: Infinity, falls: Infinity, gorges: 0.6, stairs: 1,
    speed: 1, pieces: ['balls', 'fork', 'slalom', 'doors', 'strainers'], ledges: true, snags: 0.8, key: 'wingedsheep:river:tumble',
  },
  {
    id: 'drop', name: 'The Long Drop', grade: 3, lede: 'Ledges all the way down. Boof them.',
    length: 1400, heat: [0.1, 0.62], cap: 0.62, cascades: 450, falls: Infinity, gorges: 0.8, stairs: 3,
    speed: 1, pieces: ['slalom', 'strainers', 'doors', 'funnel', 'weir', 'fork', 'balls'], ledges: true, snags: 1, key: 'wingedsheep:river:drop',
  },
  {
    // (the river as it was before there were six of them: its best carries on here)
    id: 'black', name: 'Black Water', grade: 4, lede: 'Holes, gorges, and a waterfall. Don’t look down.',
    length: 1800, heat: [0.15, 0.9], cap: 0.88, cascades: 750, falls: 950, gorges: 1, stairs: 1,
    speed: 1, pieces: ['slalom', 'strainers', 'doors', 'funnel', 'weir', 'fork', 'balls'], ledges: true, snags: 1, key: 'wingedsheep:river:takeout',
  },
  {
    id: 'coffee', name: 'Hold My Coffee', grade: 5, lede: 'Grade 5, and a long way down. Beike’s staying on the bank.',
    length: 2200, heat: [0.55, 1], cap: 1, cascades: 600, falls: 650, gorges: 1.5, stairs: 1,
    speed: 1, pieces: ['slalom', 'strainers', 'doors', 'funnel', 'weir', 'fork', 'balls'], ledges: true, snags: 1, key: 'wingedsheep:river:coffee',
  },
];

/** For anything that makes a river up without saying which (Black Water: the river as it was). */
export const DEFAULT_PROFILE: Profile = RIVERS[4];
