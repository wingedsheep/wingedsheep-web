import * as THREE from 'three';
import { occasions, visitDate } from './calendar';
import { season } from './season';
import { GRADIENT, toon } from './toon';

/**
 * What Vincent and Eef have on. Their clothes are built in "wear" colours (kit.Wear in
 * tools/models: one material per slot, `wear_<slot>`), which the wardrobe gives the day's
 * colours, and the things that only come out with an outfit (hats, a scarf, the Christmas
 * jumpers' fronts, the Halloween costumes) are parts tagged `wear=<piece>`, shown only when the
 * outfit has them.
 *
 * The outfit follows the time of year and the visitor's real temperature once the forecast is in:
 * tee and shorts when it's warm, long sleeves and jeans when it's mild (spring's or autumn's
 * colours), jumpers, beanies and scarves when it's cold. From St Nicholas to Twelfth Night
 * (calendar `christmas`) they wear their Christmas jumpers, and from the 29th of October to Halloween
 * itself they're dressed up: Vincent as a steampunk vampire, Eef as a witch in a red dress. Their sports things (his
 * kayak, hiking and yoga, her workout and yoga) only follow the weather.
 *
 * Slots: v_top v_arm v_neck v_legs v_shin v_face, and vs_* for his sports things; e_top e_arm
 * e_legs e_shorts e_thigh e_shin e_cardi e_cardi_edge, and es_* for hers. Anything an outfit
 * leaves out keeps the colour it was built in (summer's).
 *
 * To preview: ?outfit=summer|spring|autumn|winter|christmas|halloween (and ?temp= moves the weather).
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
  summer: { colours: {}, wear: ['v_cap', 'v_shades', 'e_cap'] },
  // a chambray shirt and grey jeans; a sage long-sleeve and jeans
  spring: {
    colours: { ...sleeves('v', '#6f8fb4'), v_neck: SKIN, ...trousers('v', '#8d96a3'), ...sleeves('e', '#9cb89a'), ...trousers('e', '#4f6392') },
    wear: ['v_cap', 'v_shades', 'e_cap'],
  },
  // a rust flannel over the black tee; a mustard jumper, and her cardigan a warm brown
  autumn: {
    colours: {
      ...sleeves('v', '#9c4a32'), v_neck: '#26242b', ...trousers('v', JEANS),
      ...sleeves('e', '#d4a03a'), ...trousers('e', JEANS), e_cardi: '#7a5038', e_cardi_edge: '#5a3826',
    },
    wear: ['v_cap', 'e_cap'],
  },
  // chunky knits, beanies and scarves
  winter: {
    colours: {
      ...sleeves('v', '#3d6b58'), v_neck: '#3d6b58', ...trousers('v', DARK_JEANS),
      ...sleeves('e', '#ece2cf'), ...trousers('e', DARK_JEANS), e_cardi: '#8e3a4a', e_cardi_edge: '#6e2a38',
    },
    wear: ['v_beanie', 'v_scarf', 'e_beanie', 'e_scarf'],
  },
  // his navy jumper with the reindeer on it; hers red with a tree, both lit up
  christmas: {
    colours: {
      ...sleeves('v', '#1f2740'), v_neck: '#1f2740', ...trousers('v', DARK_JEANS),
      ...sleeves('e', '#b8303a'), ...trousers('e', DARK_JEANS), e_cardi: '#ece2cf', e_cardi_edge: '#c9bfae',
    },
    wear: ['v_reindeer', 'e_tree'], // and a beanie if it's cold (dress)
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
  warm: { colours: {}, wear: ['vs_cap', 'es_cap'] },
  // long sleeves and tights, her top a warmer blue
  cold: {
    colours: {
      vs_top: '#c8563a', vs_arm: '#c8563a', vs_shin: '#26242b',
      es_top: '#6f9ccc', es_arm: '#6f9ccc',
    },
    wear: ['vs_beanie', 'es_beanie'],
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
}

/** Everything they have on, at `temperature`: the day's outfit and the sports things for the weather. */
function lookFor(outfit: OutfitName, temperature: number): Look {
  const o = OUTFITS[outfit];
  const s = SPORT[temperature < 10 ? 'cold' : 'warm'];
  const wear = new Set([...o.wear, ...s.wear]);
  if (outfit === 'christmas' && temperature < 6) wear.add('v_beanie').add('e_beanie');
  for (const who of ['v', 'e']) {
    if (!['cap', 'beanie', 'tophat', 'witch'].some((h) => wear.has(`${who}_${h}`))) wear.add(`${who}_bare`);
  }
  return { colours: { ...o.colours, ...s.colours }, wear };
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
  private pieces: THREE.Object3D[] = [];
  /** One material per slot, per kind of room (outdoors has snow on it, indoors doesn't). */
  private slots = new Map<string, Slot>();

  constructor() {
    const t = usual();
    this.outfit = outfitFor(t);
    this.look = lookFor(this.outfit, t);
  }

  /**
   * An object as it comes out of a GLB: if it's a piece that comes with an outfit, kept track of
   * (and shown or not); if it's a mesh in clothes, the material for them, which the loader uses
   * instead of its own. Call it for every object in the scene.
   */
  adopt(o: THREE.Object3D, indoors = false): THREE.Material | null {
    if (o.userData.wear) {
      this.pieces.push(o);
      o.visible = this.look.wear.has(o.userData.wear);
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
    this.outfit = outfitFor(temperature);
    this.look = lookFor(this.outfit, temperature);
    for (const s of this.slots.values()) this.colour(s);
    for (const o of this.pieces) o.visible = this.look.wear.has(o.userData.wear);
  }

  private colour(s: Slot) {
    const c = this.look.colours[s.slot];
    if (c) s.mat.color.set(c);
    else s.mat.color.copy(s.base);
  }
}

export const wardrobe = new Wardrobe();
