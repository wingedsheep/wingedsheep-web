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
  /** What the grass leans towards (hex) and how far, and how much bare rock breaks through it. */
  earth: [string, number];
  crags: number;
  /**
   * 0..1: how lived-in the banks are (cottages, jetties, a picnic, hay in the meadows, swans), and
   * how forsaken (dead trees, needles of black rock, a wreck on the rocks, ravens overhead).
   */
  homely: number;
  grim: number;
  /** Butterflies and thistledown over the meadows, against the default. */
  flutter: number;
  /** Every tree's leaves as dark as a pine's: a black forest. */
  dark: boolean;
  /**
   * 0..1: how high up into the mountains it runs, here and there: stretches where the valley's
   * sides climb to bare rock and old snow, the trees thin out to pines, and the light is thinner.
   */
  alpine: number;
  mood: Mood;
}

/**
 * The air a river's run in, a lean on the island's own light (its time of day and its weather
 * always come through): the Dawdle's a touch warmer and softer, Hold My Coffee greyer and colder.
 */
export interface Mood {
  /** What the air leans towards (hex), and how far: the haze, the sky, the sky in the water. */
  air: [string, number];
  /** How far you can see, against the default (under 1: murkier). */
  sight: number;
  /** The sun's strength against the island's, and the colour its light leans to (hex) and how far. */
  sun: number;
  tint: [string, number];
  /** On top of the island's grade: saturation, contrast, brightness; and how dark round the edges (0..1). */
  grade: [number, number, number];
  vignette: number;
  /** 0..1: how thick its fog banks get, in the stretches that have them (see land.ts fogAt). */
  mist: number;
  /**
   * How much the night's lifted on it (0: as dark as it is out): the deep valleys, the gorges and
   * the black forest would show you nothing but your lamp.
   */
  night: number;
}

/** The rare ones: not on every run, and never on every river. */
export type Rare = 'beaver' | 'otter' | 'moose' | 'bear' | 'wolves' | 'lynx' | 'yeti';

export const RARE: { id: Rare; name: string; line: string }[] = [
  { id: 'beaver', name: 'Beaver', line: 'A beaver, towing its supper home.' },
  { id: 'otter', name: 'Otter', line: 'An otter! It’s seen you too.' },
  { id: 'moose', name: 'Moose', line: 'A moose, knee-deep and unimpressed.' },
  { id: 'bear', name: 'Brown bear', line: 'A brown bear, fishing. Give it room.' },
  { id: 'wolves', name: 'Wolves', line: 'Wolves on the bank. Just looking.' },
  { id: 'lynx', name: 'Lynx', line: 'A lynx. Most people never see one.' },
  { id: 'yeti', name: 'Yeti', line: 'Was that… no. It couldn’t have been.' },
];

/**
 * Who might be out on a river, and how likely: `chance` of anyone at all on a run, then one of
 * `who` by weight. The wilder and higher the river, the likelier you are to meet something.
 */
export interface Wild {
  chance: number;
  who: Partial<Record<Rare, number>>;
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
  /** Who you might be lucky enough to see on it (one of them, on some runs). */
  rare: Wild;
  look: Look;
}

/**
 * Something to go back for: three on every river, each worth points every time you do it (and a
 * tick on the river's card the first time). `n` is how many, how high, or how long, by kind.
 */
export type GoalKind = 'balls' | 'flow' | 'time' | 'clean' | 'boofs' | 'spin' | 'upright' | 'gates' | 'sends' | 'falls' | 'train' | 'flat';
export interface Goal {
  kind: GoalKind;
  n?: number;
  text: string;
  points: number;
}

export interface RiverDef extends Profile {
  id: string;
  name: string;
  /** One line about it, for the card. */
  lede: string;
  /** Where its best is kept in this browser. */
  key: string;
  /** Its three goals (they only ever ask for what every run down it has in it). */
  goals: Goal[];
}

export const RIVERS: RiverDef[] = [
  // each one a small step on from the last, with one new thing in it; the middle ones gentle
  // enough to learn on, and the last one as hard as it likes (you've earned it by then)
  {
    id: 'dawdle', name: 'The Dawdle', grade: 2, lede: 'Slow and green, a few rocks, a lot of ducks.',
    goals: [{ kind: 'balls', n: 25, text: 'Fetch 25 of Beike’s balls', points: 300 }, { kind: 'flow', n: 2, text: 'Get your flow up to ×2', points: 300 }, { kind: 'time', n: 105, text: 'Down in under 1:45', points: 300 }],
    length: 800, heat: [0, 0.1], cap: 0.3, cascades: Infinity, falls: Infinity, gorges: 0, stairs: 1,
    speed: 0.85, pieces: ['balls'], ledges: false, snags: 0, key: 'wingedsheep:river:dawdle',
    rare: { chance: 0.3, who: { beaver: 3, otter: 2 } }, signature: [], look: { water: { shallow: [0.48, 0.82, 0.42], mid: [0.14, 0.5, 0.3], deep: [0.06, 0.3, 0.22] }, pines: 0.04, birch: 0.25, meadow: 2.4, snow: 0, springs: 0,
      earth: ['#9ccf52', 0.3], crags: 0, homely: 1, grim: 0, flutter: 1.5, dark: false, alpine: 0,
      mood: { air: ['#f4dcaa', 0.3], sight: 1, sun: 1.1, tint: ['#ffcf8a', 0.3], grade: [1.12, 0.98, 1.05], vignette: 0.4, mist: 0.35, night: 0 } },
  },
  {
    id: 'meander', name: 'The Meander', grade: 2, lede: 'A bit quicker. The ducks look less sure.',
    goals: [{ kind: 'clean', text: 'Not a single knock', points: 400 }, { kind: 'boofs', text: 'Boof every ledge', points: 400 }, { kind: 'spin', text: 'Spin a 360', points: 400 }],
    length: 1000, heat: [0, 0.2], cap: 0.3, cascades: Infinity, falls: Infinity, gorges: 0.3, stairs: 1,
    speed: 0.92, pieces: ['balls', 'fork', 'slalom'], ledges: true, snags: 0.4, key: 'wingedsheep:river:meander',
    rare: { chance: 0.35, who: { beaver: 3, otter: 3, moose: 1 } }, signature: [], look: { water: { shallow: [0.25, 0.8, 0.62], mid: [0.06, 0.43, 0.48], deep: [0.03, 0.2, 0.33] }, pines: 0.2, birch: 0.45, meadow: 1.7, snow: 0, springs: 0.4,
      earth: ['#8fcf62', 0.2], crags: 0, homely: 0.55, grim: 0, flutter: 1, dark: false, alpine: 0.1,
      mood: { air: ['#d8eef2', 0.25], sight: 1, sun: 1.05, tint: ['#fff0d0', 0.15], grade: [1.07, 1, 1.03], vignette: 0.5, mist: 0.35, night: 0 } },
  },
  {
    id: 'tumble', name: 'The Tumble', grade: 3, lede: 'Proper white water now. Keep her upright.',
    goals: [{ kind: 'upright', text: 'Stay upright all the way', points: 500 }, { kind: 'gates', text: 'Every gate clean', points: 500 }, { kind: 'flow', n: 3, text: 'Get your flow up to ×3', points: 500 }],
    length: 1200, heat: [0.05, 0.38], cap: 0.42, cascades: Infinity, falls: Infinity, gorges: 0.6, stairs: 1,
    speed: 1, pieces: ['balls', 'fork', 'slalom', 'doors', 'strainers', 'waves'], ledges: true, snags: 0.8, key: 'wingedsheep:river:tumble',
    rare: { chance: 0.45, who: { otter: 2, moose: 2, bear: 1.5, wolves: 0.5 } }, signature: [], look: { water: { shallow: [0.22, 0.78, 0.66], mid: [0.05, 0.4, 0.52], deep: [0.03, 0.17, 0.33] }, pines: 0.45, birch: 0.15, meadow: 1, snow: 0, springs: 0.8,
      earth: ['#6fae4a', 0], crags: 0.1, homely: 0.15, grim: 0, flutter: 0.4, dark: false, alpine: 0.45,
      mood: { air: ['#bfe0f0', 0.15], sight: 1, sun: 1, tint: ['#ffffff', 0], grade: [1.03, 1, 1], vignette: 0.6, mist: 0.3, night: 0.35 } },
  },
  {
    id: 'drop', name: 'The Long Drop', grade: 3, lede: 'Ledges all the way down. Boof them.',
    goals: [{ kind: 'boofs', text: 'Boof every ledge', points: 600 }, { kind: 'sends', n: 3, text: 'Three full sends', points: 600 }, { kind: 'upright', text: 'Stay upright all the way', points: 600 }],
    length: 1400, heat: [0.08, 0.52], cap: 0.55, cascades: 450, falls: Infinity, gorges: 0.8, stairs: 3,
    speed: 1, pieces: ['slalom', 'strainers', 'doors', 'funnel', 'weir', 'fork', 'balls', 'waves'], ledges: true, snags: 1, key: 'wingedsheep:river:drop',
    rare: { chance: 0.5, who: { moose: 2, bear: 2.5, wolves: 1.5, lynx: 0.5 } }, signature: ['cascade'], look: { water: { shallow: [0.24, 0.74, 0.56], mid: [0.05, 0.38, 0.42], deep: [0.03, 0.18, 0.27] }, pines: 0.55, birch: 0.1, meadow: 0.7, snow: 0, springs: 1.2,
      earth: ['#5f8a52', 0.15], crags: 0.3, homely: 0, grim: 0.2, flutter: 0.2, dark: false, alpine: 0.6,
      mood: { air: ['#a8b8c6', 0.35], sight: 0.95, sun: 0.9, tint: ['#d8e2f0', 0.15], grade: [0.93, 1, 0.98], vignette: 0.7, mist: 0.45, night: 0.5 } },
  },
  {
    // (the river as it was before there were six of them: its best carries on here)
    id: 'black', name: 'Black Water', grade: 4, lede: 'Holes, gorges, and a waterfall. Don’t look down.',
    goals: [{ kind: 'falls', text: 'Send the waterfall', points: 800 }, { kind: 'train', text: 'Pump every wave in a train', points: 800 }, { kind: 'flat', n: 15, text: 'Flat out for 15 seconds', points: 800 }],
    length: 1800, heat: [0.12, 0.75], cap: 0.78, cascades: 750, falls: 950, gorges: 1, stairs: 1,
    speed: 1, pieces: ['slalom', 'strainers', 'doors', 'funnel', 'weir', 'fork', 'balls', 'waves'], ledges: true, snags: 1, key: 'wingedsheep:river:takeout',
    rare: { chance: 0.55, who: { bear: 2, wolves: 2.5, lynx: 1.5, yeti: 0.08 } }, signature: ['falls'], look: { water: { shallow: [0.34, 0.56, 0.4], mid: [0.07, 0.22, 0.25], deep: [0.02, 0.07, 0.11] }, pines: 0.85, birch: 0.03, meadow: 0.2, snow: 0, springs: 1.3,
      earth: ['#4a6656', 0.25], crags: 0.5, homely: 0, grim: 0.6, flutter: 0, dark: true, alpine: 0.3,
      mood: { air: ['#74868a', 0.4], sight: 0.82, sun: 0.85, tint: ['#a8c8c0', 0.25], grade: [0.82, 1, 0.97], vignette: 0.8, mist: 0.9, night: 0.75 } },
  },
  {
    id: 'coffee', name: 'Hold My Coffee', grade: 5, lede: 'Grade 5, and a long way down. Beike’s staying on the bank.',
    goals: [{ kind: 'falls', text: 'Send the waterfall', points: 1000 }, { kind: 'flow', n: 4, text: 'Get your flow up to ×4', points: 1000 }, { kind: 'time', n: 270, text: 'Down in under 4:30', points: 1000 }],
    length: 2200, heat: [0.55, 1], cap: 1, cascades: 600, falls: 650, gorges: 1.5, stairs: 1,
    speed: 1, pieces: ['slalom', 'strainers', 'doors', 'funnel', 'weir', 'fork', 'balls', 'waves'], ledges: true, snags: 1, key: 'wingedsheep:river:coffee',
    rare: { chance: 0.6, who: { wolves: 2.5, lynx: 2, bear: 1.5, yeti: 0.15 } }, signature: ['cascade', 'falls'], look: { water: { shallow: [0.4, 0.58, 0.6], mid: [0.1, 0.24, 0.3], deep: [0.02, 0.07, 0.12] }, pines: 0.9, birch: 0, meadow: 0, snow: 1, springs: 1.7,
      earth: ['#5a6662', 0.35], crags: 1, homely: 0, grim: 1, flutter: 0, dark: true, alpine: 1,
      mood: { air: ['#687280', 0.45], sight: 0.8, sun: 0.75, tint: ['#b0bcd8', 0.35], grade: [0.7, 1, 0.95], vignette: 0.9, mist: 0.6, night: 0.65 } },
  },
];

/** For anything that makes a river up without saying which (Black Water: the river as it was). */
export const DEFAULT_PROFILE: Profile = RIVERS[4];
