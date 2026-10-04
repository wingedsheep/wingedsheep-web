import * as THREE from 'three';
import { occasions, visitDate } from './calendar';
import { season } from './season';
import { GRADIENT, toon } from './toon';
import type { Weather } from './weather';

/**
 * What Vincent and Eef have on. Their clothes are built in "wear" colours (kit.Wear in
 * tools/models: one material per slot, `wear_<slot>`), which the wardrobe gives the day's
 * colours, and the things that only come out with an outfit (hats, a scarf, the Christmas
 * jumpers' fronts, the Halloween costumes) are parts tagged `wear=<piece>`, shown only when they
 * have them on.
 *
 * The outfit follows the time of year and the visitor's real temperature once the forecast is in:
 * tee and shorts when it's warm, long sleeves and jeans when it's mild (spring's or autumn's
 * colours), jumpers when it's cold. Hats follow the weather (overheadFor): mostly they go bare-headed,
 * with caps (and his shades) only when the sun's high and out on a warm day, and in the cold
 * or the snow their muts, his dark green, hers bright green with the scarf to match. Indoors the hats
 * come off. From St Nicholas to Twelfth Night
 * (calendar `christmas`) they wear their Christmas jumpers, and from the 29th of October to Halloween
 * itself they're dressed up: Vincent as a steampunk vampire, Eef as a witch in a red dress. Their sports things (his
 * kayak, hiking and yoga, her workout and yoga) only follow the weather.
 *
 * Slots: v_top v_arm v_neck v_legs v_shin v_face, and vs_* for his sports things; e_top e_arm
 * e_legs e_shorts e_thigh e_shin e_cardi e_cardi_edge, and es_* for hers. Anything an outfit
 * leaves out keeps the colour it was built in (summer's).
 *
 * To preview: ?outfit=summer|spring|autumn|winter|christmas|halloween (and ?temp= moves the weather;
 * ?weather=clear for the caps, ?temp=2 or ?weather=snow for the muts).
 */

export type OutfitName = 'summer' | 'spring' | 'autumn' | 'winter' | 'christmas' | 'halloween';

interface Outfit {
  colours: Record<string, string>;
  wear: string[];
}

const SKIN = '#e3a680';
const JEANS = '#3a4660';
const DARK_JEANS = '#2c3550';

/** Long sleeves and long legs: what the arm and shin slots turn into. */
const sleeves = (who: 'v' | 'e', top: string): Record<string, string> => ({ [`${who}_top`]: top, [`${who}_arm`]: top });
const trousers = (who: 'v' | 'e', legs: string): Record<string, string> =>
  who === 'v' ? { v_legs: legs, v_shin: legs } : { e_legs: legs, e_shorts: legs, e_thigh: legs, e_shin: legs };

const OUTFITS: Record<OutfitName, Outfit> = {
  // as built: his black v-neck and navy shorts, her lavender tee, cap and shades
  summer: { colours: {}, wear: [] },
  // a chambray shirt and grey jeans; a sage long-sleeve and jeans
  spring: {
    colours: { ...sleeves('v', '#6f8fb4'), v_neck: SKIN, ...trousers('v', '#8d96a3'), ...sleeves('e', '#9cb89a'), ...trousers('e', '#4f6392') },
    wear: [],
  },
  // a rust flannel over the black tee; a mustard jumper, and her cardigan a warm brown
  autumn: {
    colours: {
      ...sleeves('v', '#9c4a32'), v_neck: '#26242b', ...trousers('v', JEANS),
      ...sleeves('e', '#d4a03a'), ...trousers('e', JEANS), e_cardi: '#7a5038', e_cardi_edge: '#5a3826',
    },
    wear: [],
  },
  // chunky knits
  winter: {
    colours: {
      ...sleeves('v', '#3d6b58'), v_neck: '#3d6b58', ...trousers('v', DARK_JEANS),
      ...sleeves('e', '#ece2cf'), ...trousers('e', DARK_JEANS), e_cardi: '#8e3a4a', e_cardi_edge: '#6e2a38',
    },
    wear: [],
  },
  // his navy jumper with the reindeer on it; hers red with a tree, both lit up
  christmas: {
    colours: {
      ...sleeves('v', '#1f2740'), v_neck: '#1f2740', ...trousers('v', DARK_JEANS),
      ...sleeves('e', '#b8303a'), ...trousers('e', DARK_JEANS), e_cardi: '#ece2cf', e_cardi_edge: '#c9bfae',
    },
    wear: ['v_reindeer', 'e_tree'],
  },
  // a pale vampire in a white shirt, black waistcoat, red bow tie, cape and top hat; a witch in a red dress
  halloween: {
    colours: {
      ...sleeves('v', '#eeeae2'), v_neck: '#eeeae2', ...trousers('v', '#a9b0ba'), v_face: '#e4e0e2',
      ...sleeves('e', '#b8202e'), ...trousers('e', '#1f1a24'), e_cardi: '#7a1420', e_cardi_edge: '#1c1a22',
    },
    wear: ['v_tophat', 'v_paint', 'v_waistcoat', 'v_cape', 'e_witch', 'e_paint', 'e_cloak', 'e_dress'],
  },
};

const SPORT: Record<'warm' | 'cold', Outfit> = {
  warm: { colours: {}, wear: [] },
  // long sleeves and tights, her top a warmer blue
  cold: {
    colours: {
      vs_top: '#c8563a', vs_arm: '#c8563a', vs_shin: '#26242b',
      es_top: '#6f9ccc', es_arm: '#6f9ccc',
    },
    wear: [],
  },
};

/** What it usually feels like at this time of year, before the forecast says. */
function usual() {
  const w = season.weights;
  return w.summer * 21 + w.spring * 13 + w.autumn * 12 + w.winter * 4;
}

function preview(): OutfitName | null {
  try {
    const o = new URLSearchParams(location.search).get('outfit');
    return o && o in OUTFITS ? (o as OutfitName) : null;
  } catch {
    return null;
  }
}

/** The outfit for the day, at `temperature` (°C). */
export function outfitFor(temperature: number): OutfitName {
  const asked = preview();
  if (asked) return asked;
  const d = visitDate();
  if (d.getMonth() === 9 && d.getDate() >= 29) return 'halloween'; // the last few days, for the parties
  if (occasions.has('christmas')) return 'christmas';
  if (temperature >= 17) return 'summer';
  if (temperature >= 9) return season.name === 'spring' || season.name === 'summer' ? 'spring' : 'autumn';
  return 'winter';
}

interface Look {
  colours: Record<string, string>;
  wear: Set<string>;
  /** What they have on indoors: the same, hats and scarf off. */
  indoors: Set<string>;
}

/** What it's like out, as far as hats go: the sun out on a warm day, cold (or snow), or neither. */
type Overhead = 'sun' | 'cold' | 'none';

/** The hats for it, for every head (his and hers, and their sports heads). */
const HATS: Record<Overhead, string[]> = {
  sun: ['v_cap', 'v_shades', 'e_cap', 'vs_cap', 'es_cap'],
  cold: ['v_beanie', 'e_beanie', 'e_scarf', 'vs_beanie', 'es_beanie'],
  none: [],
};
const OFF_INDOORS = new Set([...HATS.sun, ...HATS.cold]);
const SUNNY = ['clear', 'partly', 'windy', 'warm', 'hot'];

function overheadFor(w: Weather, sunAlt: number): Overhead {
  if (w.kind === 'snow' || w.kind === 'sleet' || w.lying > 0.2 || w.temperature < 5) return 'cold';
  const sunny = SUNNY.includes(w.kind) && !(w.kind === 'partly' && w.intensity > 0.5);
  return sunny && sunAlt > 15 && w.temperature >= 15 ? 'sun' : 'none';
}

/** Hair, on any head with nothing on it. */
function bare(wear: Set<string>) {
  for (const who of ['v', 'e', 'vs', 'es']) {
    if (!['cap', 'beanie', 'tophat', 'witch'].some((h) => wear.has(`${who}_${h}`))) wear.add(`${who}_bare`);
  }
  return wear;
}

/** Everything they have on, at `temperature`: the day's outfit, the sports things for the weather, and the hats for the sky. */
function lookFor(outfit: OutfitName, temperature: number, overhead: Overhead): Look {
  const o = OUTFITS[outfit];
  const s = SPORT[temperature < 10 ? 'cold' : 'warm'];
  const wear = new Set([...o.wear, ...s.wear]);
  for (const w of HATS[overhead]) if (outfit !== 'halloween' || w.startsWith('vs_') || w.startsWith('es_')) wear.add(w); // the costumes have their own
  const indoors = bare(new Set([...wear].filter((w) => !OFF_INDOORS.has(w))));
  return { colours: { ...o.colours, ...s.colours }, wear: bare(wear), indoors };
}

interface Slot {
  mat: THREE.MeshToonMaterial;
  slot: string;
  base: THREE.Color; // as built
}

class Wardrobe {
  /** What they're wearing now. */
  outfit: OutfitName;
  private look: Look;
  private temperature = usual();
  private overhead: Overhead = 'none';
  private pieces: { o: THREE.Object3D; indoors: boolean }[] = [];
  /** One material per slot, per kind of room (outdoors has snow on it, indoors doesn't). */
  private slots = new Map<string, Slot>();

  constructor() {
    this.outfit = outfitFor(this.temperature);
    this.look = lookFor(this.outfit, this.temperature, this.overhead);
  }

  /**
   * An object as it comes out of a GLB: if it's a piece that comes with an outfit, kept track of
   * (and shown or not); if it's a mesh in clothes, the material for them, which the loader uses
   * instead of its own. Call it for every object in the scene.
   */
  adopt(o: THREE.Object3D, indoors = false): THREE.Material | null {
    if (o.userData.wear) {
      const piece = { o, indoors };
      this.pieces.push(piece);
      this.show(piece);
    }
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return null;
    const src = mesh.material as THREE.MeshStandardMaterial;
    if (!src.name.startsWith('wear_')) return null;
    const slot = src.name.slice('wear_'.length);
    const key = `${slot}:${indoors ? 1 : 0}`;
    let s = this.slots.get(key);
    if (!s) {
      const base = src.color.clone();
      const mat = indoors ? new THREE.MeshToonMaterial({ color: base, gradientMap: GRADIENT }) : toon(base, { own: true });
      s = { mat, slot, base };
      this.slots.set(key, s);
      this.colour(s);
    }
    return s.mat;
  }

  /** The weather's in: dress for it. */
  feel(temperature: number) {
    this.temperature = temperature;
    this.outfit = outfitFor(temperature);
    this.dress();
  }

  /** Every frame, once the weather's known: hats on or off for the sky, with the sun `sunAlt` degrees up. */
  watch(weather: Weather, sunAlt: number) {
    const overhead = overheadFor(weather, sunAlt);
    if (overhead === this.overhead) return;
    this.overhead = overhead;
    this.dress();
  }

  private dress() {
    this.look = lookFor(this.outfit, this.temperature, this.overhead);
    for (const s of this.slots.values()) this.colour(s);
    for (const p of this.pieces) this.show(p);
  }

  private show(p: { o: THREE.Object3D; indoors: boolean }) {
    p.o.visible = (p.indoors ? this.look.indoors : this.look.wear).has(p.o.userData.wear);
  }

  private colour(s: Slot) {
    const c = this.look.colours[s.slot];
    if (c) s.mat.color.set(c);
    else s.mat.color.copy(s.base);
  }
}

export const wardrobe = new Wardrobe();
