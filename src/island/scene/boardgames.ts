import * as THREE from 'three';
import type { CampWorld } from './camping';
import type { Island } from './island';
import { beds, indoors } from './shelter';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const smooth = THREE.MathUtils.smoothstep;

/** Some of his favourites (boardgames.py lays each one out). */
export type Game = 'agricola' | 'root' | 'dune' | 'star' | 'wingspan';
export const GAMES: Game[] = ['agricola', 'root', 'dune', 'star', 'wingspan'];
export const GAME_NAMES: Record<Game, string> = { agricola: 'Agricola', root: 'Root', dune: 'Dune: Imperium', star: 'Star Realms', wingspan: 'Wingspan' };
/** Seconds a game goes on once she's sat down: a quick Star Realms, a long Agricola. */
export const LENGTH: Record<Game, [number, number]> = { agricola: [600, 900], root: [540, 840], dune: [600, 900], star: [300, 480], wingspan: [480, 720] };

/** Seconds to reach out over the board, put something down, and sit back. */
const REACH = 1.8;

const preview = (() => {
  try {
    const q = new URLSearchParams(location.search);
    const g = q.get('games') as Game | null;
    const where = q.get('where');
    return g && GAMES.includes(g) ? { game: g, indoors: where === 'hut' ? true : where === 'table' ? false : null } : null;
  } catch {
    return null;
  }
})();

/**
 * A game, the two of them: he gets one out and sets it up (he asks, vincent.ts), and she comes and
 * sits down when she can (companion.ts). Out at the card table on a fine, still day, otherwise up
 * at the hut's long table. Shared by the island (Games, here) and the hut (hut-room.ts).
 */
export const games = {
  /** He's sat down with it, and would like her to come. */
  asked: false,
  /** She's sat down too. */
  joined: false,
  game: null as Game | null,
  /** Up at the hut rather than out at the card table. */
  indoors: false,
};

/** Whose turn it is, how long they've been at it, and how long they think before they play. */
const turn = { who: 'v' as 'v' | 'e', t: 0, think: rand(2, 4) };

function tick(dt: number) {
  if (!games.asked && !games.joined) return;
  turn.t += dt;
  if (turn.t < turn.think + REACH) return;
  // setting up on his own, it's one piece after another; then a turn each
  const playing = games.asked && games.joined;
  if (playing) turn.who = turn.who === 'v' ? 'e' : 'v';
  else turn.who = games.asked ? 'v' : 'e'; // (or on her own, putting it away)
  turn.t = 0;
  turn.think = playing ? rand(3, 9) * (games.game === 'star' ? 0.6 : 1) : rand(0.6, 2);
}

/** How far out over the board one of them is reaching (0..1), and whether there's a piece in the hand yet. */
export function reach(who: 'v' | 'e') {
  if (turn.who !== who) return { out: 0, holding: false };
  const k = (turn.t - turn.think) / REACH;
  const out = k < 0 || k > 1 ? 0 : k < 0.4 ? smooth(k, 0, 0.4) : k < 0.55 ? 1 : 1 - smooth(k, 0.55, 1);
  return { out, holding: k > -0.4 && k < 0.5 };
}

/** Whose turn it is. */
export const turnOf = () => turn.who;

/** One of the games out on the table, the rest put away (boardgames.py `spread`). */
export function showGame(root: THREE.Object3D | undefined, prefix: string, game: Game | null) {
  if (!root) return;
  for (const g of GAMES) {
    const o = root.getObjectByName(`${prefix}_${g}`);
    if (o) o.visible = g === game;
  }
}

/**
 * One of them sat at a game (boardgames.py `*_playing`): the game's cards in the left hand, and on
 * their turn the right arm out over the board from the shoulder and the elbow to put a piece down
 * (or for Star Realms, to play a card), eyes on it; between turns, eyes on the board, now and
 * then on the cards in hand, and up at the other when they're playing.
 */
export class Player {
  private upper?: { o: THREE.Object3D; axis: THREE.Vector3; angle: number };
  private fore?: { o: THREE.Object3D; axis: THREE.Vector3; angle: number };
  private head?: THREE.Object3D;
  private headRest = new THREE.Euler();
  private fans = new Map<Game, THREE.Object3D>();
  private piece?: THREE.Object3D;
  private card?: THREE.Object3D;
  private clock = rand(0, 10);
  private look = 0;
  /** Clicked on: a look up, 1 easing back to 0. */
  noticed = 0;

  constructor(
    readonly root: THREE.Object3D,
    prefix: string,
    private who: 'v' | 'e',
  ) {
    root.traverse((o) => {
      const x = o.userData;
      if (o.name === `${prefix}_upper_r`) this.upper = { o, axis: new THREE.Vector3().fromArray(x.reach ?? [1, 0, 0]), angle: x.reach_angle ?? 0 };
      if (o.name === `${prefix}_fore_r`) this.fore = { o, axis: new THREE.Vector3().fromArray(x.bend ?? [1, 0, 0]), angle: x.bend_angle ?? 0 };
      if (o.name === `${prefix}_head`) {
        this.head = o;
        this.headRest.copy(o.rotation);
      }
      // (a part in several colours comes in as a group of meshes: _1, _2… under the part itself)
      if (o.name === `${prefix}_hold_piece`) this.piece = o;
      if (o.name === `${prefix}_hold_card`) this.card = o;
      for (const g of GAMES) if (o.name === `${prefix}_fan_${g}`) this.fans.set(g, o);
    });
  }

  /** The head, for breath on a cold evening. */
  get face() {
    return this.head;
  }

  update(dt: number) {
    const game = games.game;
    if (!game) return;
    this.clock += dt;
    for (const [g, o] of this.fans) o.visible = g === game;
    const { out, holding } = reach(this.who);
    if (this.piece) this.piece.visible = holding && game !== 'star';
    if (this.card) this.card.visible = holding && game === 'star';
    if (this.upper) this.upper.o.quaternion.setFromAxisAngle(this.upper.axis, this.upper.angle * out);
    if (this.fore) this.fore.o.quaternion.setFromAxisAngle(this.fore.axis, this.fore.angle * out);
    this.noticed = Math.max(0, this.noticed - dt / 2.5);
    if (!this.head) return;
    // their turn: a look at the cards in hand, then down at the board as they play; the other's:
    // up at them now and then, otherwise down at what they're doing
    const mine = turnOf() === this.who;
    const t = this.clock;
    const cards = mine && !holding && Math.sin(t * 0.8) > 0.2 ? 1 : 0;
    const up = !mine && Math.sin(t * 0.37 + (this.who === 'e' ? 2 : 0)) > 0.75 ? 1 : 0;
    this.look = THREE.MathUtils.damp(this.look, cards - up, 4, dt);
    const down = 0.32 + out * 0.12 - this.noticed * 0.45;
    this.head.rotation.set(
      this.headRest.x + down + Math.max(0, this.look) * 0.1 + Math.min(0, this.look) * 0.3,
      this.headRest.y + Math.max(0, this.look) * 0.35 + Math.sin(t * 0.3) * 0.05,
      this.headRest.z,
    );
  }
}

/** Fit for the card table: dry, light, not blowing the cards about, and warm enough to sit out. */
const tableWeather = (w: CampWorld) => w.night < 0.45 && w.rain < 0.05 && (w.storm ?? 0) < 0.1 && w.wind < 8 && w.temperature >= 9;

/**
 * The game out at the card table by the workshop (its Magic cleared away while it's out), or at
 * the hut's long table, and the two of them at it; who's sat down where (vincent.ts and
 * companion.ts say so), and the turns.
 */
export class Games {
  private spread?: THREE.Object3D;
  private magic?: THREE.Object3D;
  /** The card table, where the game goes when it's out of doors. */
  readonly table?: THREE.Object3D;
  readonly him?: Player;
  readonly her?: Player;
  /** Whether it's weather for the card table just now. */
  private fit = true;

  constructor(island: Island) {
    this.table = island.get('card_table');
    this.magic = this.table?.getObjectByName('card_table_magic');
    this.spread = island.root.getObjectByName('games_spread');
    const v = island.get('vincent_games');
    const e = island.get('companion_games');
    if (v) this.him = new Player(v, 'games_v', 'v');
    if (e) this.her = new Player(e, 'games_e', 'e');
    this.show();
  }

  /** Where a game would be, if he got one out now (or where it is, if it's out): not on a cat. */
  get inside() {
    return games.asked || games.joined ? games.indoors : this.wet();
  }

  private wet() {
    const cat = beds.charlie === 'cards' || beds.george === 'cards';
    return preview?.indoors ?? (!this.fit || cat);
  }

  /** Him sitting down with a game (which one, and where, settled now), or her joining him; or getting up from it. */
  set(who: 'vincent' | 'companion', on: boolean) {
    if (who === 'vincent' && on && !games.asked) {
      games.game = preview?.game ?? GAMES[Math.floor(Math.random() * GAMES.length)];
      games.indoors = this.wet();
      Object.assign(turn, { who: 'v', t: 0, think: rand(1, 2) });
    }
    if (who === 'vincent') games.asked = on;
    else games.joined = on && (games.asked || !!preview);
    if (!games.asked && !games.joined) games.game = null;
    this.show();
  }

  private show() {
    const out = !!games.game && !games.indoors;
    if (this.spread) this.spread.visible = out;
    showGame(this.spread, 'games_spread', games.game);
    if (this.magic) this.magic.visible = !out;
    if (this.him) this.him.root.visible = out && games.asked;
    if (this.her) this.her.root.visible = out && games.joined;
    const inside = !!games.game && games.indoors;
    for (const [group, on] of [['games_hut', inside], ['vincent_games_hut', inside && games.asked], ['companion_games_hut', inside && games.joined]] as const) {
      if (on) indoors.add(group);
      else indoors.delete(group);
    }
  }

  update(dt: number, w: CampWorld) {
    this.fit = tableWeather(w);
    tick(dt);
    if (!games.game || games.indoors) return;
    this.him?.update(dt);
    this.her?.update(dt);
  }
}
