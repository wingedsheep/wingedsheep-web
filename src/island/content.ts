/**
 * What things on the island *mean*. The art pipeline decides where a prop stands and how it
 * looks; this file decides what happens when you point at it or click it.
 *
 * To add something new: place a model with an `id` in tools/models/models.py, then add an
 * entry here. Secrets listed in SECRETS show up in the journal automatically.
 */
import type * as THREE from 'three';
import { BOOKS } from '../data/books';
import { interests } from '../data/interests';
import { projects } from '../data/projects';
import { travels, yearsOf } from '../data/travels';
import type { Forecast } from './forecast';
import type { Journal } from './journal';
import type { CameraRig } from './scene/camera-rig';
import type { Interior } from './scene/interior';
import type { Island } from './scene/island';
import type { Life } from './scene/life';
import type { Sky } from './scene/sky';
import type { WorkshopRoom } from './scene/workshop-room';
import type { Weather } from './scene/weather';
import type { Sound } from './sound';

export type PanelName = 'library' | 'workshop' | 'lighthouse' | 'campfire' | 'trail' | 'places' | 'journal';

export interface IslandContext {
  island: Island;
  rig: CameraRig;
  sky: Sky;
  weather: Weather;
  /** The visitor's real weather, once it's in (null if we couldn't find it). */
  forecast?: Forecast | null;
  life: Life;
  sound: Sound;
  journal: Journal;
  /** The library's inside, once it has loaded. */
  interior?: Interior;
  /** The workshop's inside, once it has loaded. */
  workshop?: WorkshopRoom;
  /** Unfold a project's card in the workshop (null folds it away). */
  showProject(id: string | null): void;
  openPanel(name: PanelName): void;
  openArticle(slug: string): void;
  /** Close whatever is open (from the library: step back outside). */
  close(): void;
  toast(text: string): void;
  /** A toast with buttons; picking one dismisses it. */
  ask(text: string, choices: { label: string; pick?(): void }[]): void;
  /** Mark a secret as found (toasts the first time). */
  discover(id: keyof typeof SECRETS): void;
}

export interface Place {
  label: string | ((ctx: IslandContext) => string);
  /** Open this panel and glide the camera to the place. */
  panel?: PanelName;
  activate?(ctx: IslandContext, at: THREE.Vector3): void;
}

export const SECRETS = {
  cat: { title: 'The dock cat', hint: 'Someone is napping where the boats come in.' },
  cats: { title: 'Charlie & George', hint: 'Someone got to the bench before you.' },
  sheep: { title: 'The winged sheep', hint: 'Look up. Then click.' },
  guitar: { title: 'A song by the fire', hint: 'Follow the sound of strings.' },
  well: { title: 'The well', hint: 'Some wells go deeper than others.' },
  bench: { title: 'A place to rest', hint: 'Every good journey has benches.' },
  boulder: { title: 'First ascent', hint: 'There are holds on one of the rocks.' },
  summit: { title: 'The summit', hint: 'The trail keeps going up.' },
  magic: { title: 'An unfinished game', hint: 'Someone left in the middle of their turn.' },
  kayak: { title: 'Wet paddles', hint: 'Check the water by the dock.' },
  ufo: { title: 'Unidentified', hint: 'Only at night. Only for a moment.' },
  moons: { title: 'Two moons', hint: 'Count the moons in the sea at night.' },
  piano: { title: 'Two originals', hint: 'Not all the music on the island is played outdoors.' },
  flock: { title: 'The flock', hint: '↑ ↑ ↓ ↓ ← → ← → B A' },
  robot: { title: 'The workshop robot', hint: 'Someone in the workshop keeps tripping over things.' },
  travels: { title: 'Pins in the globe', hint: 'Lean in close to the globe in the library.' },
  winds: { title: 'Still being written', hint: 'One book on the keeper’s shelf won’t open.' },
  arnhem: { title: 'Home town', hint: 'The keeper’s telly has a game about where he grew up.' },
  beike: { title: 'Beike', hint: 'Someone in the meadow has a ball and all the time in the world.' },
} as const;

let logPage = -1;
const say = (text: string) => (ctx: IslandContext) => ctx.toast(text);

export const PLACES: Record<string, Place> = {
  dock: { label: 'The dock', activate: say('Every visitor arrives here. The water is calm today.') },
  signpost: { label: 'Signpost · where to?', panel: 'places' },
  library: { label: 'The library · blog', panel: 'library' },
  workshop: { label: 'The workshop · projects', panel: 'workshop' },
  lighthouse: { label: 'The lighthouse · the keeper’s quarters', panel: 'lighthouse' },
  campfire: { label: 'The campfire · about me', panel: 'campfire' },
  cairn: { label: 'A cairn on the trail · career', panel: 'trail' },
  summit: {
    label: 'The summit',
    panel: 'trail',
    activate: (ctx) => ctx.discover('summit'),
  },
  vincent: {
    label: (ctx) => (ctx.sound.playing ? `Vincent · playing ${ctx.sound.playing.title}` : 'Vincent · ask for a song'),
    activate(ctx, at) {
      ctx.life.burst('notes', at);
      soundOn(ctx);
      if (ctx.sound.playing) return;
      // pull up a log: the camera settles in close enough to hear him
      ctx.sound.ask();
      ctx.rig.focus(ctx.island.positionOf('vincent')!, Math.min(ctx.rig.view, 16));
      ctx.toast('He grins, counts in, and starts to play.');
    },
  },
  guitar_case: { label: 'An open guitar case', panel: 'campfire' },
  cat: {
    label: (ctx) => (ctx.journal.has('cat') ? 'The dock cat' : 'A sleeping cat'),
    activate(ctx, at) {
      ctx.toast('Mrrp. One eye opens, then closes again.');
      ctx.life.burst('hearts', at);
      ctx.discover('cat');
      setTimeout(() => ctx.life.burst('zzz', at), 4000);
    },
  },
  george: {
    label: (ctx) => (ctx.journal.has('cats') ? 'George · taking up most of the bench' : 'A big cat, sprawled out'),
    activate(ctx, at) {
      ctx.life.pet('george');
      ctx.sound.purr();
      ctx.life.burst('hearts', at);
      ctx.toast('George stretches one paw even further across the bench, clearly not moving for anyone.');
      ctx.discover('cats');
    },
  },
  charlie: {
    label: (ctx) => (ctx.journal.has('cats') ? 'Charlie · curled up tight' : 'A cat, curled into a ball'),
    activate(ctx, at) {
      ctx.life.pet('charlie');
      ctx.sound.purr();
      ctx.life.burst('hearts', at);
      ctx.toast('Charlie opens one eye, checks that George is still there, and goes back to sleep.');
      ctx.discover('cats');
      setTimeout(() => ctx.life.burst('zzz', at), 4000);
    },
  },
  sheep: {
    label: 'A winged sheep',
    activate(ctx) {
      ctx.life.loop();
      ctx.sound.baa();
      ctx.toast('Baa!');
      ctx.discover('sheep');
    },
  },
  well: {
    label: 'An old well',
    activate(ctx) {
      ctx.toast('It is very deep. Far below, something winds a spring: kriiik, kriiik.');
      ctx.discover('well');
    },
  },
  beike: {
    label: (ctx) =>
      ctx.life.beike.waiting ? 'Beike’s ball · throw it' : ctx.journal.has('beike') ? 'Beike' : 'A black-and-white dog',
    activate(ctx, at) {
      const beike = ctx.life.beike;
      switch (beike.poke(ctx.rig.camera.position)) {
        case 'greet':
          ctx.sound.bark();
          ctx.life.burst('hearts', at);
          ctx.toast('Beike spots you, launches himself at your knees, then flops over and rolls right round.');
          ctx.discover('beike');
          break;
        case 'offer':
          ctx.toast('Beike drops his ball at your feet. He looks at the ball. Then at you. Then at the ball.');
          break;
        case 'throw': {
          const said: Record<number, string> = {
            0: 'You throw the ball. Beike is gone before it lands.',
            4: 'Five throws. Beike is just getting warmed up.',
            9: 'Ten throws. Beike is not tired. Beike will never be tired.',
            24: 'Twenty-five throws. Your arm is tired. Beike is not.',
          };
          if (said[beike.fetched]) ctx.toast(said[beike.fetched]);
          break;
        }
      }
    },
  },
  blossom: {
    label: 'A blossom tree',
    activate: (ctx, at) => ctx.life.burst('petals', at),
  },
  bench: {
    label: 'A bench',
    activate(ctx, at) {
      ctx.life.burst('silk', at);
      ctx.toast('You squeeze onto the end, next to the cats. Progress saved.');
      ctx.discover('bench');
    },
  },
  boulder: {
    label: 'A boulder with holds',
    activate(ctx, at) {
      ctx.life.burst('chalk', at);
      ctx.toast('Yellow holds, V4. You send it on the third try.');
      ctx.discover('boulder');
    },
  },
  card_table: {
    label: 'A game of Magic',
    activate(ctx) {
      ctx.toast('Someone left mid-turn with two Islands untapped. Suspicious.');
      ctx.discover('magic');
      ctx.ask('Take their seat and keep playing?', [
        { label: 'Yes', pick: () => window.open('https://magic.wingedsheep.com/play/solo', '_blank', 'noopener') },
        { label: 'No' },
      ]);
    },
  },
  kayak: {
    label: 'A kayak',
    activate(ctx) {
      ctx.toast('The seat is still wet. Someone has been paddling around the island.');
      ctx.discover('kayak');
    },
  },
  ufo: {
    label: '???',
    activate(ctx) {
      ctx.toast('…and it is gone. Nobody will believe you.');
      ctx.discover('ufo');
    },
  },
  moons: {
    label: 'The moon, reflected. Twice?',
    activate(ctx) {
      ctx.toast('Two moons tonight. Nobody else seems to notice.');
      ctx.discover('moons');
    },
  },
};

/** Things inside the library. Books are `book:<slug>` and open their post. */
export const LIBRARY_PLACES: Record<string, Place> = {
  piano: {
    label: (ctx) => {
      const piece = ctx.sound.pianoPiece;
      return piece ? `The piano · ${piece.title} (click to stop)` : "The piano · play one of Vincent's compositions";
    },
    activate: (ctx) => togglePiano(ctx),
  },
  door: { label: 'The door · back to the island', activate: (ctx) => ctx.close() },
  fireplace: {
    label: 'The fireplace',
    activate(ctx) {
      ctx.interior?.sparks();
      ctx.toast('A log settles and sends up sparks. Someone keeps this fire going for whoever comes in to read.');
    },
  },
  painting: {
    label: 'A portrait of the winged sheep',
    activate(ctx) {
      ctx.sound.baa();
      ctx.toast('Its eyes follow you around the room.');
    },
  },
  armchair: {
    label: 'A worn armchair',
    activate: say('Still warm. Someone was reading here a minute ago, and left their book face down on the arm.'),
  },
  catalogue: {
    label: 'The card catalogue',
    activate(ctx) {
      ctx.openPanel('library');
      document.querySelector<HTMLElement>('[data-subject]')?.focus();
      ctx.toast('Every book has a card. Pick a subject or a tag to find the ones you want.');
    },
  },
  globe: {
    label: (ctx) => (ctx.interior?.globeFocused ? 'The globe · click to turn it' : 'A globe'),
    activate(ctx) {
      const room = ctx.interior;
      if (!room) return;
      if (room.globeFocused) {
        room.turnGlobe();
        return;
      }
      room.focusGlobe(matchMedia('(prefers-reduced-motion: reduce)').matches);
      ctx.toast('You lean in close. There are little pins in it, one for every trip.');
    },
  },
};

/** A pin in the library globe: "pin:<index into travels>", or "pin:home" for the island. */
function pinPlace(id: string): Place | undefined {
  if (id === 'pin:home') {
    return {
      label: 'A small island · not on any map',
      activate: say('A small island that isn’t on any map. You are here.'),
    };
  }
  const trip = travels[Number(id.slice(4))];
  if (!trip) return undefined;
  const when = yearsOf(trip);
  return {
    label: `${trip.place} · ${when}`,
    activate(ctx) {
      const where = trip.place === trip.country ? trip.place : `${trip.place}, ${trip.country}`;
      ctx.toast(`${where} (${when}). ${trip.note}`.trim());
      ctx.discover('travels');
    },
  };
}

/** Start the piano (or stop it if that piece is already playing). */
export function togglePiano(ctx: IslandContext, id?: number) {
  soundOn(ctx);
  const now = ctx.sound.pianoPiece;
  if (now && (id === undefined || id === now.id)) {
    ctx.sound.stopPiano();
    return;
  }
  const piece = ctx.sound.playPiano(id);
  if (!piece) return;
  ctx.toast(`The keys begin to move on their own. Vincent wrote this one: ${piece.title}.`);
  ctx.discover('piano');
}

/** Clicking something that makes music turns the sound on. */
function soundOn(ctx: IslandContext) {
  if (ctx.sound.enabled) return;
  ctx.sound.setEnabled(true);
  document.querySelector('[data-action="sound"]')?.setAttribute('aria-pressed', 'true');
}

let robotLine = -1;
const ROBOT_HELLOS = [
  'Bzzt! A visitor! It waves with the hand holding the wrench. Clang.',
  'BEEP BOOP. Everything in here is working as intended. Mostly.',
  'It salutes, and bonks itself on the sticking plaster.',
  'Its eye flickers happily. It points at the nearest project, then at a different one, then shrugs.',
];

/** Things inside the workshop: every project, the robot, and the way out. */
export const WORKSHOP_PLACES: Record<string, Place> = {
  workshop_door: { label: 'The door · back to the island', activate: (ctx) => ctx.close() },
  robot: {
    label: (ctx) => (ctx.journal.has('robot') ? 'The workshop robot' : 'A robot, mid-errand'),
    activate(ctx) {
      const what = ctx.workshop?.robot.poke();
      robotLine = (robotLine + 1) % ROBOT_HELLOS.length;
      ctx.toast(
        what === 'trip' ? 'You startled it. It windmills its arms and, somehow, stays upright.'
        : what === 'fall' ? 'It waves so hard it falls flat on its face. It gets up as if nothing happened.'
        : ROBOT_HELLOS[robotLine],
      );
      ctx.discover('robot');
    },
  },
  ...Object.fromEntries(
    projects.map((p): [string, Place] => [`project_${p.id}`, { label: `${p.name} · ${p.thing}`, activate: (ctx) => ctx.showProject(p.id) }]),
  ),
};

const GAMES: Record<string, { label: string; text: string }> = {
  'hollow-knight': { label: 'Hollow Knight', text: 'Hollow Knight. A strange, beautiful, dangerous world where you have to be completely in the zone, with music to match.' },
  silksong: { label: 'Hollow Knight: Silksong', text: 'Hollow Knight: Silksong. The one that’s been an inspiration lately: the world, the art, the music, and how good it feels to move.' },
  worms: { label: 'Worms', text: 'Worms, played hot-seat on an old PC with friends, with all the voices re-recorded as our own. Its Super Sheep is where the name wingedsheep comes from.' },
  carcassonne: { label: 'Carcassonne', text: 'Carcassonne. Also rebuilt from scratch in Python and in Kotlin: it’s over in the workshop.' },
  root: { label: 'Root', text: 'Root. Cats, birds and woodland rebels, all fighting over the same forest, each by different rules.' },
  dune: { label: 'Dune: Imperium', text: 'Dune: Imperium. Deck building and worker placement on Arrakis.' },
  agricola: { label: 'Agricola', text: 'Agricola. Build a farm, feed your family, and never have quite enough wood.' },
  'next-station': { label: 'Next Station: London and Tokyo', text: 'Next Station: London and Tokyo. Draw your own underground line, one flip of a card at a time.' },
};

/** Things in the keeper's quarters, inside the lighthouse. */
export const LIGHTHOUSE_PLACES: Record<string, Place> = {
  door: { label: 'The door · back to the island', activate: (ctx) => ctx.close() },
  stairs: {
    label: 'The stairs · up to the lamp',
    activate: (ctx) => ctx.toast(ctx.sky.lamps > 0.6
      ? 'Round and round and up. Far above, the lamp is turning.'
      : 'Round and round and up to the lamp. It lights itself at dusk.'),
  },
  console: {
    label: 'The telly · play GTA Arnhem',
    activate(ctx) {
      ctx.ask('GTA Arnhem: drive around Arnhem, where Vincent grew up. It opens in a new tab.', [
        {
          label: 'Play ↗',
          pick() {
            window.open('https://racer.wingedsheep.com/', '_blank', 'noopener');
            ctx.discover('arnhem');
          },
        },
        { label: 'Not now' },
      ]);
    },
  },
  coffee: {
    label: 'A mug of coffee',
    activate: (ctx) => ctx.toast(ctx.sky.lamps > 0.6
      ? 'Black, and stone cold. Someone said they’d be right there. About three hours ago.'
      : 'Black, no sugar, still hot. Someone said they’d be right there.'),
  },
  coffee_machine: { label: 'The coffee machine', activate: say('The most important machine in the lighthouse. The light on the front is never off.') },
  wrap: { label: 'A wrap on a plate', activate: say('Hummus, tuna and whatever vegetables were left: dinner for an evening when cooking is too much.') },
  sketchbook: { label: 'A sketchbook', activate: say('Open on a pencil drawing of a bird on a branch. Vincent is learning to draw.') },
  logbook: {
    label: 'The keeper’s log',
    activate(ctx) {
      // one page of the keeper's log at a time, never the whole book
      logPage = (logPage + 1 + Math.floor(Math.random() * (interests.length - 1))) % interests.length;
      ctx.toast(`Keeper's log: ${interests[logPage].text}`);
    },
  },
  bowls: { label: 'Two cat bowls', activate: say('One for Charlie, one for George. Both empty, according to Charlie and George.') },
  surfboard: { label: 'A surfboard', activate: say('It’s been out on the Atlantic: Mimizan, and the surf on the south-west coast of France.') },
  backpack: { label: 'A pack and boots', activate: say('Boots by the door and a little green tent strapped to the pack. It has slept on a few mountain tops.') },
  ...Object.fromEntries(
    Object.entries(GAMES).map(([id, g]): [string, Place] => [`game:${id}`, { label: g.label, activate: say(g.text) }]),
  ),
};

/** A book on the keeper's shelf: "read:<index into BOOKS>". */
function readPlace(id: string): Place | undefined {
  const book = BOOKS[Number(id.slice(5))];
  if (!book) return undefined;
  const stars = book.stars ? ` · ${'★'.repeat(book.stars)}` : '';
  return {
    label: `${book.title} · ${book.author}${stars}`,
    activate(ctx) {
      if (book.title === 'The Winds of Winter') {
        ctx.toast('The Winds of Winter. It won’t open: it’s still being written. Five stars anyway.');
        ctx.discover('winds');
        return;
      }
      const when = book.read
        ? ` Finished in ${new Date(`${book.read}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.`
        : '';
      ctx.toast(`${book.title}${book.series ? ` (${book.series})` : ''}, by ${book.author}.${when}`);
    },
  };
}

export function lighthousePlaceFor(id: string): Place | undefined {
  return id.startsWith('read:') ? readPlace(id) : LIGHTHOUSE_PLACES[id];
}

/** Put a record on the workshop gramophone (or lift the needle if one is playing). */
export function toggleRecord(ctx: IslandContext) {
  soundOn(ctx);
  if (ctx.sound.recordPlaying) return ctx.sound.stopRecord();
  const disc = ctx.sound.playRecord();
  if (disc) ctx.toast(`You wind the handle and lower the needle. Crackle, then: ${disc.set}, written by a transformer.`);
}

export function workshopPlaceFor(id: string): Place | undefined {
  return WORKSHOP_PLACES[id];
}

export function libraryPlaceFor(id: string): Place | undefined {
  return id.startsWith('pin:') ? pinPlace(id) : LIBRARY_PLACES[id];
}

export function placeFor(id: string): Place | undefined {
  return PLACES[id] ?? (id.startsWith('cairn_') ? PLACES.cairn : undefined);
}

export function labelFor(place: Place, ctx: IslandContext): string {
  return typeof place.label === 'function' ? place.label(ctx) : place.label;
}
