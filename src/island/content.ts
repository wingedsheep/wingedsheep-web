/**
 * What things on the island *mean*. The art pipeline decides where a prop stands and how it
 * looks; this file decides what happens when you point at it or click it.
 *
 * To add something new: place a model with an `id` in tools/models/models.py, then add an
 * entry here. Secrets listed in SECRETS show up in the journal automatically.
 */
import type * as THREE from 'three';
import { openSketchbook, spotAnimal } from './sketchbook';
import { BOOKS } from '../data/books';
import { chapters } from '../data/career';
import { interests } from '../data/interests';
import { projects } from '../data/projects';
import { travels, yearsOf } from '../data/travels';
import { hourOf } from './scene/bedtime';
import { occasions } from './scene/calendar';
import { type Show, telly } from './scene/companion';
import { FRIDAY_13 } from './scene/fauna';
import { ambush, flatOut, indoors } from './scene/shelter';
import { boatStage, shelf } from './scene/almanac';
import type { Forecast, WeatherKind } from './forecast';
import type { Journal } from './journal';
import type { CameraRig } from './scene/camera-rig';
import type { Interior } from './scene/interior';
import type { Island } from './scene/island';
import type { Life } from './scene/life';
import type { Fae } from './scene/revel';
import type { Sky } from './scene/sky';
import type { WorkshopRoom } from './scene/workshop-room';
import type { Weather } from './scene/weather';
import type { Sound } from './sound';

export type PanelName = 'library' | 'workshop' | 'lighthouse' | 'hut' | 'campfire' | 'trail' | 'river' | 'places' | 'journal';

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
  /** Walk the career trail to a chapter (0 = the oldest) and open it. */
  showChapter(index: number): void;
  openPanel(name: PanelName): void;
  openArticle(slug: string): void;
  /** Close whatever is open (from the library: step back outside). */
  close(): void;
  toast(text: string): void;
  /** Hold a drawing up to the screen. */
  showDrawing(src: string, alt: string): void;
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
  river: { title: 'Wild water', hint: 'The kayak goes further than round the pier.' },
  ufo: { title: 'Unidentified', hint: 'Only at night. Only for a moment.' },
  moons: { title: 'Two moons', hint: 'Count the moons in the sea at night.' },
  piano: { title: 'Two originals', hint: 'Not all the music on the island is played outdoors.' },
  flock: { title: 'The flock', hint: '↑ ↑ ↓ ↓ ← → ← → B A' },
  robot: { title: 'The workshop robot', hint: 'Someone in the workshop keeps tripping over things.' },
  travels: { title: 'Pins in the globe', hint: 'Lean in close to the globe in the library.' },
  dreams: { title: 'Lucid', hint: 'Someone at the hut writes things down the moment they wake up.' },
  winds: { title: 'Still being written', hint: 'One book on the keeper’s shelf won’t open.' },
  arnhem: { title: 'Home town', hint: 'The keeper’s telly has a game about where he grew up.' },
  cartridge: { title: 'Press start', hint: 'Not every cartridge by the telly has a proper label.' },
  beike: { title: 'Beike', hint: 'Someone in the meadow has a ball and all the time in the world.' },
  // the wildlife (src/island/scene/fauna.ts): some come out only at night, some only now and then
  badger: { title: 'The badger', hint: 'There’s a sett at the edge of the eastern woods. Its owner keeps late hours.' },
  owl: { title: 'The owl', hint: 'After dark, someone keeps an eye on everyone who comes ashore.' },
  hedgehog: { title: 'A hedgehog', hint: 'Something prickly snuffles about near the bench at night. Not in winter, though.' },
  fox: { title: 'The fox', hint: 'On some nights, something red hunts mice in the meadows.' },
  deer: { title: 'Red deer', hint: 'At dawn and dusk, the woods come out to graze.' },
  stag: { title: 'The stag', hint: 'Now and then the deer bring someone wearing a crown.' },
  dolphins: { title: 'Dolphins', hint: 'Sometimes a pod passes the south of the island.' },
  whale: { title: 'The whale', hint: 'Watch the sea for a while. A long while.' },
  serpent: { title: 'Here be dragons', hint: 'The old sailors swore the deep only shows itself in foul weather.' },
  geese: { title: 'The skein', hint: 'Look up in autumn and in spring.' },
  blacksheep: { title: 'The black sheep', hint: 'Every flock has one. Not on every visit.' },
  wanderer: { title: 'A small wanderer', hint: 'Someone very small, very rarely, comes ashore at the dock.' },
  starsheep: { title: 'A wild sheep chase', hint: 'Very rarely, one of the flock has a mark on its back.' },
  rocky: { title: 'Fist my bump', hint: 'Someone with five legs and no face very rarely drops by the workshop.' },
  gandalf: { title: 'Precisely when he means to', hint: 'Someone grey, with a staff and a tall pointed hat, very rarely comes up from the dock. Never late.' },
  supersheep: { title: 'Super Sheep', hint: 'Once in a long while, one of the flock has somewhere to be. Fast.' },
  bottle: { title: 'Message in a bottle', hint: 'Keep an eye on the beach. Now and then the sea brings something in.' },
  thief: { title: 'Daylight robbery', hint: 'Someone by the fire should keep a closer eye on his dinner.' },
  fairfolk: { title: 'Ill met by moonlight', hint: 'On some dry evenings there’s music down on the beach. Midsummer’s Eve is the surest.' },
  // the rare sightings (src/island/scene/sightings.ts)
  balloon: { title: 'Up, up and away', hint: 'On a calm summer evening, look up. Gelderland’s skies are full of them.' },
  starlings: { title: 'Murmuration', hint: 'At dusk in autumn, thousands of wings over the west of the island, turning as one.' },
  seal: { title: 'Hauled out', hint: 'On some days, someone comes up out of the sea to lie on the beach.' },
  ferry: { title: 'Right on time', hint: 'Out on the hour, back on the half hour. Keep an eye on the sea to the south.' },
  tallship: { title: 'Under full sail', hint: 'Very rarely, something from another century passes on the horizon.' },
  fisherman: { title: 'Early bird', hint: 'On some early mornings, someone has the end of the pier to himself.' },
} as const;

let logPage = -1;
const say = (text: string) => (ctx: IslandContext) => ctx.toast(text);
/**
 * The same line every click, except that on the nth click (counting from 1) the thing has had
 * enough and says something else: for things people click over and over just to see.
 */
const keepsOn = (usual: string, nth: Record<number, string>) => {
  let n = 0;
  return () => nth[++n] ?? usual;
};
/** Lines said in turn, so clicking again says something new. */
const inTurn = (lines: string[]) => {
  let n = 0;
  return () => lines[n++ % lines.length];
};

/**
 * Her, out on the island (src/island/scene/companion.ts): she looks up, or raises her mug, and
 * you get a line. Never her name: she's just there.
 */
function withHer(label: string, line: (ctx: IslandContext) => string): Place {
  return {
    label,
    activate(ctx, at) {
      ctx.life.companion.notice();
      ctx.life.burst('hearts', at);
      ctx.toast(line(ctx));
    },
  };
}

/**
 * An animal: it reacts (bolts, curls up, calls…, see fauna.ts), and you get a line about it.
 * Lines are picked in turn, so clicking again says something new.
 */
function animal(species: string, label: Place['label'], lines: string[], secret?: keyof typeof SECRETS): Place {
  let n = 0;
  return {
    label,
    activate(ctx, at) {
      ctx.life.fauna.poke(species, at, ctx.rig.camera.position);
      spotAnimal(species);
      ctx.toast(lines[n++ % lines.length]);
      if (secret) ctx.discover(secret);
    },
  };
}

/** One of the rare sightings (scene/sightings.ts): it reacts, and says its line. */
function sighting(id: string, label: Place['label'], lines: string[] | ((ctx: IslandContext) => string), secret?: keyof typeof SECRETS): Place {
  let n = 0;
  return {
    label,
    activate(ctx) {
      ctx.life.sightings.poke(id);
      spotAnimal(id);
      ctx.toast(typeof lines === 'function' ? lines(ctx) : lines[n++ % lines.length]);
      if (secret) ctx.discover(secret);
    },
  };
}

/**
 * One of the fair folk at their revel (scene/revel.ts): whoever you look at glances back. Look a
 * third time and that's a stare, and they're gone (main.ts has the line for that).
 */
const LANTERN_LINES = [
  'It’s Sint Maarten, so they’re doing the rounds with paper lanterns, like every child in the country tonight.',
  'Oberon sings the Sint Maarten song with great dignity. He knows about half the words.',
  'Puck is at the front, and has decided on the route himself.',
  'Nobody on the island has sweets small enough for a pixie. They’ve been given one pepernoot to share.',
];
let lanternLine = 0;

function fae(who: Fae, label: Place['label'], lines: string[]): Place {
  let n = 0;
  return {
    label,
    activate(ctx) {
      if (ctx.life.days.lanterns.on && !ctx.life.revel.on) {
        // Sint Maarten: not a revel, a walk with lanterns (scene/lanterns.ts)
        ctx.toast(LANTERN_LINES[lanternLine++ % LANTERN_LINES.length]);
        ctx.discover('fairfolk');
        return;
      }
      const stared = ctx.life.revel.poke(who, ctx.rig.camera.position);
      if (!stared) ctx.toast(lines[n++ % lines.length]);
      ctx.discover('fairfolk');
    },
  };
}

/**
 * A cat asleep indoors out of the rain: it purrs, and stirs (the room makes the hearts, see
 * scene/guests.ts). Lines are picked in turn.
 */
function indoorPet(label: string, lines: string[], secret: keyof typeof SECRETS): Place {
  let n = 0;
  return {
    label,
    activate(ctx) {
      ctx.sound.call('mrrp', 0.8); // a sleepy hello, then the purr
      setTimeout(() => ctx.sound.purr(), 500);
      ctx.toast(lines[n++ % lines.length]);
      ctx.discover(secret);
    },
  };
}

/** A jack-o'-lantern (there's one at the hut, and a pair at the library door). */
const JACK: Place = {
  label: 'A jack-o’-lantern',
  activate: say('Carved by the light of the stove up at the hut. It was meant to look frightening. It looks mildly surprised.'),
};

/** What comes out on the special days (scene/calendar.ts; tools/models/holidays.py). */
const SPECIAL_DAYS: Record<string, Place> = {
  vrijmarkt: {
    label: 'The vrijmarkt · everything must go',
    activate: (() => {
      const line = keepsOn(
        'On King’s Day the whole country sells its attic on the pavement. On offer: four paperbacks, a lamp, a board game, a teddy, and a crate of records nobody will admit to.',
        { 3: 'You ask about the teddy. It turns out the teddy was never for sale.' },
      );
      return (ctx: IslandContext) => ctx.toast(line());
    })(),
  },
  wimpel: {
    label: 'The summit flag · with an orange pennant for the King',
    activate: say('On King’s Day the flag gets an orange pennant over it. Even the sheep on it looks a little more orange.'),
  },
  liberation: {
    label: 'The summit flag · right back up, with bunting',
    activate: say('Yesterday it was at half-mast. Today, the fifth of May, it’s back at the top, with red, white and blue down both sides of the pole.'),
  },
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`egg_${i}`, {
    label: 'An Easter egg',
    activate: (ctx: IslandContext) => ctx.toast(ctx.life.days.easter.find(`egg_${i}`)),
  } satisfies Place])),
  vincent_dive: {
    label: 'Vincent · in an orange hat, and not much else',
    activate(ctx) {
      const diver = ctx.life.vincent.diver;
      if (diver.busy) ctx.toast('He can’t talk now. He’s very busy being cold.');
      else if (diver.goAgain()) ctx.toast('You tell him the camera missed it. He looks at you, looks at the sea, and goes again.');
      else ctx.toast('The nieuwjaarsduik: at noon on New Year’s Day, thousands of people run into the North Sea in orange hats. He’s building up to it.');
    },
  },
  dive_towel: {
    label: 'A towel on the sand · and a flask',
    activate: say('His clothes, his towel, and a flask of hot chocolate. The flask is the part he’s actually looking forward to.'),
  },
  shoe: {
    label: 'A clog by the fire',
    activate: say(occasions.has('sinterklaas')
      ? 'The carrot’s gone, and there’s a chocolate letter where it was. Somebody was good this year.'
      : 'Put out for Sinterklaas, with a carrot in it for his horse. Come back on the fifth of December and see what’s in it.'),
  },
  steamboat: {
    label: 'The steamboat · in from Spain',
    activate(ctx) {
      ctx.sound.steamWhistle();
      ctx.toast(occasions.has('sinterklaas')
        ? 'Sinterklaas’s steamboat, in from Spain as it is every year. Tonight is pakjesavond: presents, poems and far too many pepernoten.'
        : occasions.has('arrival')
          ? 'In from Spain this morning, whistle going the whole way in. He’s here till the fifth of December now.'
          : 'Sinterklaas’s steamboat, in from Spain. It stays tied up here till pakjesavond, and the clog by the fire goes out every night till then.');
    },
  },
  presents: {
    label: 'Presents · each with a poem',
    activate: say('Every present comes with a poem, and every poem teases whoever it’s for. This one rhymes “Vincent” with “the bugs he never meant”.'),
  },
  pumpkin: JACK,
  pumpkin_0: JACK,
  pumpkin_1: JACK,
  xmas_tree: {
    label: () => (occasions.has('christmasday') ? 'The Christmas tree · with presents under it' : 'The Christmas tree'),
    activate: say(occasions.has('christmasday')
      ? 'Merry Christmas. The one with the lumpy wrapping is for Beike, and he knows it.'
      : 'Up the day after Sinterklaas left, as is only proper. Not a day sooner.'),
  },
  bench_balloons: {
    label: 'Balloons · three birthdays on one day',
    activate: say('Hers, Charlie’s and George’s, all on the fourteenth of August. One cake, three candles, and two cats who think the cake is theirs.'),
  },
  cake: {
    label: 'A birthday cake · three candles',
    activate: say('Three candles, one for each of them. George has been edging towards it all afternoon.'),
  },
  balloons: {
    label: 'Balloons · it’s Vincent’s birthday',
    activate: say('Tied to his guitar case so he can’t miss them. Ask nicely and he might play something.'),
  },
};

/** The days of the week (scene/week.ts; tools/models/week.py): what comes out, and when. */
const THE_WEEK: Record<string, Place> = {
  laundry: {
    label: (ctx) => (ctx.life.week.laundry?.straggler ? 'One sock · still on the line' : 'The washing · it’s Monday'),
    activate: (ctx) => ctx.toast(ctx.life.week.laundry?.straggler
      ? 'Everything came in the moment the rain started. Nearly everything: one red sock is still out there, getting a second rinse.'
      : 'Monday is washing day. Up here the wind off the sea does in an hour what a dryer takes all afternoon to do.'),
  },
  postboat: {
    label: 'The post boat',
    activate(ctx, at) {
      ctx.sound.call('toot', 1);
      ctx.life.burst('notes', at);
      ctx.toast('Tuesdays and Fridays, round the point mid-morning. The skipper has done this round for thirty years, and still waves at every seal.');
    },
  },
  parcel: {
    label: 'A parcel · for the hut',
    activate: say('Left on the boards at the end of the pier. The label says: “Vincent, the hut, top of the mountain. Mind the steps.”'),
  },
  trawler: {
    label: 'A trawler · and every gull for miles',
    activate: say('Out working the banks off the island, as she does every Wednesday. Every gull for miles goes out after her, so it’s the one day Vincent gets to finish his dinner.'),
  },
  borrel: {
    label: 'A crate of beer · it’s Friday',
    activate: say('Friday evening by the fire: a crate, two open bottles, and nobody in any hurry to go to bed.'),
  },
  borrel_mug: {
    label: 'A second mug',
    activate: say('Coffee, for later. On a Friday the fire tends to keep going until well after later.'),
  },
  kite: {
    label: 'A kite',
    activate: say('Up on the wind off the sea. He built it from a kit years ago, and has mended it so often that there isn’t much of the kit left.'),
  },
  vincent_about: {
    label: (ctx) => (ctx.life.vincent.spot === 'kite' ? 'Vincent · flying a kite' : ctx.life.vincent.errands.carrying ? 'Vincent · with the post' : 'Vincent · off to fetch the post'),
    activate(ctx, at) {
      ctx.life.burst('hearts', at);
      ctx.toast(ctx.life.vincent.spot === 'kite'
        ? 'He hands you the line for a moment. The kite ducks, dives, and climbs again, no thanks to you.'
        : ctx.life.vincent.errands.carrying
          ? 'Something off the post boat, on its way up to the hut. He gives it a shake next to his ear. It rattles.'
          : 'The post boat’s been. He’s off down the pier for the parcel before the gulls decide it’s theirs.');
    },
  },
};

const WILDLIFE: Record<string, Place> = {
  ewe: animal('sheep', 'A sheep', [
    'Baa. It looks at you, chews for a while, and goes back to the grass.',
    'The sheep looks up at the winged one overhead, thinks about it, and decides it’s fine down here.',
    'It has eaten the same patch of grass all day and sees no reason to stop.',
  ]),
  blacksheep: animal('blacksheep', (ctx) => (ctx.journal.has('blacksheep') ? 'The black sheep' : 'A black sheep'), [
    ...(FRIDAY_13 ? ['Friday the 13th. It was never going to miss this.'] : []),
    'Every flock has one. This one seems very pleased about it.',
  ], 'blacksheep'),
  rabbit: animal('rabbit', 'A rabbit', ['A flash of white tail, and it’s gone down a hole.', 'Thump, thump: a warning to every rabbit in the meadow. Then it bolts.']),
  deer: animal('deer', 'A red deer', [
    'Heads up, ears up, and they’re gone into the trees. The Veluwe, where they roam wild, starts just outside Arnhem.',
    'A flash of pale rump between the trunks, and the woods are quiet again.',
  ], 'deer'),
  stag: animal('stag', 'A red deer stag', ['A stag, antlers and all. He holds your gaze a moment, then turns and walks, unhurried, back into the woods.'], 'stag'),
  badger: animal('badger', (ctx) => (ctx.journal.has('badger') ? 'The badger · out foraging' : 'Something striped, snuffling about'), [
    'A badger! It stops, sniffs the air in your direction, decides you are not a worm, and goes back to digging.',
    'The badger ignores you completely. It has worms to find and all night to find them.',
    'It snuffles right up to your feet, grunts, and trundles off. You have been inspected.',
  ], 'badger'),
  sett: {
    label: (ctx) => (ctx.journal.has('badger') ? 'The badger’s sett' : 'A mound of earth with a hole in it'),
    activate: (ctx) => ctx.toast(ctx.sky.lamps > 0.45
      ? 'The sett is empty: its owner is out foraging somewhere nearby, nose first.'
      : 'A badger sett. Fresh earth by the door, and from somewhere underground, a faint snore. Come back after dark.'),
  },
  hedgehog: animal('hedgehog', 'A hedgehog', ['It curls into a prickly ball and waits for you to go away.', 'Snuffle, snuffle. It’s after beetles, not you.'], 'hedgehog'),
  fox: animal('fox', 'A fox', ['The fox looks at you for one long second, then trots off as if it had somewhere better to be.'], 'fox'),
  crab: animal('crab', 'A crab', ['It scuttles off sideways, claws up, and digs itself into the sand.']),
  squirrel: animal('squirrel', 'A red squirrel', ['It chatters at you, furious, from halfway up a tree.']),
  gull: animal('gull', 'A herring gull', ['It screams at you. You don’t even have chips.', 'It circles once more, just to make its point.']),
  songbird: animal('songbird', 'A robin', ['The robins scatter, then come straight back. They know you have nothing, but they check.']),
  owl: animal('owl', 'A tawny owl', ['Hoo… hu-hu-huuu. Its head turns much further round than seems reasonable.'], 'owl'),
  bat: animal('bat', 'A bat', ['Pipistrelles, out for the evening midges. Too quick to follow.']),
  goose: animal('goose', (ctx) => (ctx.life.fauna.geeseSouth ? 'Geese · heading south' : 'Geese · heading north'), [
    'A skein of geese, honking to each other all the way. Somewhere, a long way off, someone is expecting them.',
  ], 'geese'),
  dolphin: animal('dolphin', 'Dolphins!', ['A pod of dolphins, passing the island without stopping. They seem to be having a great time.'], 'dolphins'),
  whale: animal('whale', 'A humpback whale', ['A humpback! One slow breath at the surface, and it’s gone again. It might be a long time before it comes back.'], 'whale'),
  serpent: animal('serpent', (ctx) => (ctx.journal.has('serpent') ? 'The sea serpent' : 'Something in the sea. Something big'), [
    'A sea serpent! It looks straight at the island, and for a long moment nobody on it breathes.',
    'The old charts had it right, then. Here be dragons.',
    'It rolls on through the waves, in no hurry at all. The sea is its and always was.',
  ], 'serpent'),
  fish: animal('fish', 'A jumping trout', ['A flash of silver, and the sea closes over it again.']),
  duck: animal('duck', 'A mallard', ['Quack. It paddles on, very much in charge.']),
  duckling: animal('duckling', 'A duckling', ['Tiny, fluffy, and paddling as hard as it possibly can to keep up.']),
  heron: animal('heron', 'A grey heron', ['It unfolds itself, flaps off low over the water with a grumpy croak, and will be back the moment you’ve gone.']),
  starsheep: animal('starsheep', (ctx) => (ctx.journal.has('starsheep') ? 'The sheep with the star' : 'A sheep with a mark on its back'), [
    'A pale star in the wool on its back. Somewhere, somebody has been looking for this sheep for a very long time.',
    'It chews, unbothered. It has no idea anyone is looking for it.',
  ], 'starsheep'),
  rocky: animal('rocky', (ctx) => (ctx.journal.has('rocky') ? 'Rocky' : 'Something with five legs'), [
    '♪ A little run of chords. You don’t speak Eridian, but you’re fairly sure it means “Happy, happy, happy!”',
    '♪ Amaze! Amaze! Amaze! It seems to like the workshop very much.',
    '♪ It holds up one hand. Fist my bump?',
  ], 'rocky'),
  supersheep: animal('supersheep', '…is that a sheep?', [
    'BAAA-BOOM. Wool everywhere, sheep nowhere. Somewhere, a worm nods approvingly.',
  ], 'supersheep'),
  gandalf: animal('gandalf', (ctx) => (ctx.journal.has('gandalf') ? 'Gandalf the Grey' : 'An old man in grey, with a staff'), [
    '“A wizard is never late, nor is he early. He arrives precisely when he means to.”',
    'A firework whistles up from the end of his staff and bursts over the island. Somewhere, a hobbit cheers.',
    '“All we have to decide is what to do with the time that is given us.” He puffs on his pipe and looks into the fire.',
  ], 'gandalf'),
  wanderer: animal('wanderer', '???', [
    'A small masked wanderer in a red cloak. It bows, needle raised, and is gone in a dash. It seems to know exactly where it’s going.',
  ], 'wanderer'),
  // the rare sightings (scene/sightings.ts)
  balloon: sighting('balloon', 'A hot-air balloon', [
    'Two people in the basket wave down at you. The burner roars, and up they go.',
    'A hot-air balloon, drifting over on the evening air. On a calm summer night, the sky over Gelderland is full of them.',
  ], 'balloon'),
  starlings: sighting('starlings', 'Starlings', [
    'Thousands of starlings, turning together as if they were one thing. Nobody’s in charge, and it works anyway.',
    'The whole flock folds over on itself, like a dark scarf in the wind, and unfolds again.',
  ], 'starlings'),
  seal: sighting('seal', (ctx) => (ctx.journal.has('seal') ? 'The seal' : 'A seal'), [
    'A harbour seal, hauled out on the sand. It looks at you, sighs through its whiskers, and closes its eyes again.',
    'It lifts its head and gives you a long, patient look, as if you were the odd one on the beach.',
    'That was one look too many. It humps down the sand and into the sea, and it’s gone.',
  ], 'seal'),
  ferry: sighting('ferry', 'The ferry', (ctx) => {
    const { now, next } = ctx.life.sightings.ferryTimes;
    return `The ${now} ferry, right on time. ${next ? `The next one’s at ${next}.` : 'That’s the last one tonight.'}`;
  }, 'ferry'),
  container: sighting('container', 'A container ship', [
    'A container ship, stacked high, in no hurry at all. Somewhere on board is a parcel someone’s been waiting for since March.',
  ]),
  tallship: sighting('tallship', 'A tall ship!', [
    'A tall ship under full sail, on her way to Sail Amsterdam or on her way back. Every sail is set, and she’s in no hurry to be anywhere.',
  ], 'tallship'),
  fisherman: sighting('fisherman', 'A fisherman', (ctx) => {
    const n = ctx.life.sightings.catches;
    if (!n) return 'He nods at you and doesn’t say a word. Nothing yet. It isn’t really about the fish.';
    return `He nods at you, without a word. ${n === 1 ? 'One' : n === 2 ? 'Two' : n === 3 ? 'Three' : 'A few'} in the bucket so far, and the dock cat is watching the bucket.`;
  }, 'fisherman'),
};

// Harry Potter, taking turns with the twentieth century
const wellLine = keepsOn('It is very deep. Far below, something winds a spring: kriiik, kriiik.', {
  5: 'Kriiik, kriiik… kriiik?',
  9: 'From far below, a small, tired voice: “Some of us are trying to wind a spring down here.”',
  16: 'You drop a coin in. A long time later: plink. Then, even fainter: “thank you.”',
});
const benchLine = keepsOn('You squeeze onto the end, next to the cats. Progress saved.', {
  4: 'Progress saved. Nothing has happened since, but it’s saved.',
  8: 'George has moved one paw onto your end of the bench. This is a warning.',
  14: 'You have rested enough for three journeys. The cats have not moved at all, and are more rested than you.',
});
const boulderLine = keepsOn('Yellow holds, V4. You send it on the third try.', {
  3: 'You send it again. Your forearms have started to file a complaint.',
  6: 'Again, first go. At this point you’re just showing off to the sheep.',
  10: 'The holds have gone shiny where you keep grabbing them. The boulder would like a rest day.',
});
const coffeeLine = keepsOn('The most important machine in the lighthouse. The light on the front is never off.', {
  3: 'Another one. Purely for research.',
  6: 'Coffee number six. Your left eye has started to blink on and off, gently, like a lighthouse.',
  10: 'The machine starts pouring before you reach it. It knows.',
});

/** Notes in bottles, in turn. Nobody's quite sure who writes them. */
const bottleNote = (() => {
  const notes = [
    'If you are reading this, you have found the bottle. That’s it. That’s the secret.',
    'Please send more hummus.',
    'Greetings from the other island. Ours has three moons, and we think you’re showing off.',
    'Beike, if you find this: it was a fake throw. I’m sorry. It won’t happen again. (It will.)',
    'Your message is important to us. You are number 3 in the queue.',
    'Wish you were here. Weather lovely. Bring socks.',
  ];
  let n = Math.floor(Math.random() * notes.length);
  return () => notes[n++ % notes.length];
})();

const reading = inTurn([
  'Prisoner of Azkaban, again. She lost count years ago, and still gasps at the Shrieking Shack.',
  'The Rise and Fall of the Third Reich. She’s at the rise, so she’s in a mood. Ask again at the fall.',
  'She’s explaining, unprompted, why Snape is not a hero. Allow about forty minutes.',
  'Volume two of a three-volume life of Stalin. Plenty of people never made it to volume three; she intends to.',
  'She has been sorted, re-sorted, and has settled it: Ravenclaw. Don’t mention the other quiz.',
  'How Democracies Die. She reads the good bits out loud, then looks pointedly at the news.',
  'Half-Blood Prince. She’s at the bit on the tower and has asked not to be spoken to.',
  'A history of the Cold War, full of pencil notes. The margins are winning the arms race.',
]);
const fireside = inTurn([
  'She raises her mug at you. Tea. The schnapps is for later.',
  'She has a request. He plays it the second time she asks.',
  'Toes towards the fire, hands round the mug. This is the good log, and it’s taken.',
]);
// she doesn't much like it, but she does it anyway: it's for the greater good
const workout = inTurn([
  'She waves without missing a beat. Nobody else on this island can do jumping jacks and wave.',
  'She catches your eye mid-jump and mouths “greater good”. You decide not to ask.',
  'Stretch to the left: a long look at the blanket under the blossom tree. Stretch to the right: another. Two more sets.',
  'She counts her reps in Roman numerals, which makes it history, which makes it bearable. She’s on XIV.',
  'Rep eleven. Or twelve. She’s lost count, so she starts again from one, on principle.',
]);

const herCats = inTurn([
  'George has rolled over to show her his belly. It’s a trap. She knows it’s a trap. She goes in anyway.',
  'She scratches George behind the ears. Charlie opens one eye to make sure this is being shared out fairly.',
  'George is purring so hard the bench hums. She stops for a second and gets a look.',
]);
const herBeike = inTurn([
  'Beike is being told he’s a very good boy. He agrees completely.',
  'She stops. A paw comes up and pats her hand, twice. She starts again.',
  'His tail is thumping the grass. His ball is still in his mouth, just in case.',
]);
const hisCats = inTurn([
  'He scratches George under the chin. George allows it, which from George is a standing ovation.',
  'Charlie gets a stroke too, for balance. Charlie did not ask for balance.',
  'George stretches a paw out and rests it on his arm. He’s not going anywhere now.',
]);
const hisBeike = inTurn([
  'Ear scratches. Beike leans into them so far he tips over, and decides to stay there.',
  'He’s telling Beike all about his game. Beike thinks it sounds great.',
  'Technically Beike is his dad’s dog. Nobody has told Beike, and nobody’s going to.',
]);

const yoga = inTurn([
  'She opens one eye, sees him wobbling in tree pose, and very nearly loses her balance laughing.',
  'Deep breath in. Deep breath out. Somewhere behind her, a gull disagrees.',
  'Child’s pose, held for a suspiciously long time. She may have fallen asleep.',
]);
const hisYoga = inTurn([
  'Tree pose. The tree is swaying a bit. It’s the wind, he says.',
  'Eyes shut, breathing out very slowly. For a moment he is completely still. Then his nose itches.',
  'Downward dog. Beike, from across the island, takes this as an invitation.',
]);
const climbing = inTurn([
  'Off to the summit, pack on, no reason. He’ll be back for the guitar.',
  'He points up at the flag, then at his boots, then at the flag again. Right.',
  'Up top, arms in the air as if it were Everest. It’s a thirteen-metre hill.',
  'Halfway up he stops, looks back down at the lighthouse and thinks about coffee. He keeps climbing. He’s still thinking about coffee.',
]);

// him: AI, mostly, and Sam Harris for everything else; big black noise-cancellers, pacing
const listening = inTurn([
  'Dwarkesh Patel, hour three with an AI researcher. He has paced to the well and back eleven times and is now explaining scaling laws to a gull.',
  'Sam Harris, on free will. He stops, frowns, decides he didn’t decide to stop, and walks on.',
  'AI Explained, on this week’s new model. It’s already out of date. So is the one before it. He walks faster.',
  '“Sorry, what?” Noise-cancelling on. He gives you a thumbs up for something you didn’t say.',
  'He stops dead, raises one finger, and makes an excellent point. The podcast carries on without him.',
]);
// her: politics, some history, and a lot of the Dutch kind; little white in-ears, the end of the pier
const hearing = inTurn([
  'The Rest Is Politics. Rory and Alastair disagree politely. She disagrees with both of them, less politely.',
  'A Dutch politics podcast, week nineteen of forming a cabinet. She’s running a sweepstake on week forty.',
  'The Rest Is History, part four of six on the fall of the Berlin Wall. She knows how it ends. She’s tense anyway.',
  'One earbud comes out. “What?” It goes straight back in. Whatever it was, it wasn’t coalition maths.',
  'She shakes her head at the sea. The sea, to be fair, did not vote for any of them.',
  'A guest with three holiday homes calls the last few years “a real struggle”. She rewinds it, just to hear it again.',
]);

export const PLACES: Record<string, Place> = {
  vincent_podcast: {
    label: 'Vincent · pacing with a podcast',
    activate: (ctx) => ctx.toast(listening()), // no hearts: he can't hear you, noise-cancelling
  },
  companion_podcast: withHer('Feet over the water, a podcast in', hearing),
  companion_reading: withHer('Deep in a book', reading),
  companion_fireside: withHer('By the fire, with tea', (ctx) =>
    ctx.sound.playing ? 'She’s singing along, a word or two ahead of him. He’s pretending not to notice.' : fireside()),
  companion_workout: withHer('Working out above the beach, under protest', workout),
  companion_petting_cats: withHer('Giving the cats a fuss', herCats),
  companion_petting_beike: withHer('Giving Beike a fuss', herBeike),
  vincent_petting_cats: { label: 'Vincent · giving the cats a fuss', activate: (ctx) => ctx.toast(hisCats()) },
  vincent_petting_beike: { label: 'Vincent · giving Beike a fuss', activate: (ctx) => ctx.toast(hisBeike()) },
  companion_yoga: withHer('Yoga, on the next mat along', yoga),
  vincent_yoga: { label: 'Vincent · yoga by the beach', activate: (ctx) => ctx.toast(hisYoga()) },
  vincent_hiking: { label: 'Vincent · off up the mountain', activate: (ctx) => ctx.toast(climbing()) },
  dock: (() => {
    const line = keepsOn('Every visitor arrives here. The water is calm today.', {
      6: 'Still the dock. Still calm. Still here.',
      12: 'The dock would like you to know that it has other visitors.',
      20: 'Twenty times. The dock cat has opened both eyes to look at you.',
      35: 'The planks creak, very slowly, in what might be Morse. You think it says “boat”.',
    });
    return { label: 'The dock', activate: (ctx: IslandContext) => ctx.toast(line()) };
  })(),
  signpost: { label: 'Signpost · where to?', panel: 'places' },
  library: { label: 'The library · blog', panel: 'library' },
  workshop: { label: 'The workshop · projects', panel: 'workshop' },
  lighthouse: { label: 'The lighthouse · the keeper’s quarters', panel: 'lighthouse' },
  campfire: { label: 'The campfire · about me', panel: 'campfire' },
  summit: {
    label: 'The summit',
    panel: 'trail',
    activate(ctx) {
      ctx.discover('summit');
      ctx.showChapter(chapters.length - 1);
    },
  },
  hut: { label: 'The mountain hut · stop for the night', panel: 'hut' },
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
      ctx.toast('Mrrp. One green eye opens, then closes again. Someone has carved a small Z into the post beside her.');
      ctx.life.burst('hearts', at);
      ctx.discover('cat');
      setTimeout(() => ctx.life.burst('zzz', at), 4000);
    },
  },
  george: {
    label: (ctx) => (flatOut.has('george') ? 'George · flat out on the cool stones' : ctx.journal.has('cats') ? 'George · taking up most of the bench' : 'A big cat, sprawled out'),
    activate(ctx, at) {
      ctx.life.pet('george');
      ctx.sound.purr();
      ctx.life.burst('hearts', at);
      ctx.toast(flatOut.has('george')
        ? 'George has poured himself onto the cool flagstones under the bench. One ear moves. That’s all you’re getting in this heat.'
        : 'George stretches one paw even further across the bench, clearly not moving for anyone.');
      ctx.discover('cats');
    },
  },
  charlie: {
    label: (ctx) => (flatOut.has('charlie') ? 'Charlie · stretched out in the shade' : ctx.journal.has('cats') ? 'Charlie · curled up tight' : 'A cat, curled into a ball'),
    activate(ctx, at) {
      ctx.life.pet('charlie');
      ctx.sound.purr();
      ctx.life.burst('hearts', at);
      ctx.toast(flatOut.has('charlie')
        ? 'Charlie is stretched out as long as a cat can go, belly to the stone. Too hot to purr. He purrs anyway.'
        : 'Charlie opens one eye, checks that George is still there, and goes back to sleep.');
      ctx.discover('cats');
      setTimeout(() => ctx.life.burst('zzz', at), 4000);
    },
  },
  sheep: (() => {
    const lines = [
      'Baa! It loops the loop, just to show you it can.',
      'The winged sheep, out on its rounds. Nobody taught it to fly; it just never heard that sheep can’t.',
      'It waggles its wings at the flock below. The flock keeps chewing. They’ve seen it before.',
      'Baa-aa! A little wobble on the way out of the loop. Nobody saw that. Nobody.',
      'It keeps an eye on the whole island from up here. This is, after all, its island.',
    ];
    let n = 0;
    return {
      label: (ctx: IslandContext) => (ctx.journal.has('sheep') ? 'The winged sheep' : 'A winged sheep'),
      activate(ctx: IslandContext) {
        ctx.life.loop();
        ctx.sound.baa();
        ctx.toast(lines[n++ % lines.length]);
        ctx.discover('sheep');
        spotAnimal('wingedsheep');
      },
    };
  })(),
  well: {
    label: 'An old well',
    activate(ctx) {
      ctx.toast(wellLine());
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
        case 'fussed':
          ctx.life.burst('hearts', at);
          ctx.toast('Beike’s tail thumps twice to say hello. He’s not getting up, though. He’s busy.');
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
      ctx.toast(benchLine());
      ctx.discover('bench');
    },
  },
  boulder: {
    label: 'A boulder with holds',
    activate(ctx, at) {
      ctx.life.burst('chalk', at);
      ctx.toast(boulderLine());
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
      ctx.discover('kayak');
      // in a storm it takes some nerve; otherwise it's a long way downriver from here
      if (ctx.weather.now.storm > 0.5) {
        ctx.ask('The kayak bucks and tugs at its rope in the waves. Anyone sensible would wait this one out. Go anyway?', [
          { label: 'Paddle', pick: () => ctx.openPanel('river') },
          { label: 'Wait it out' },
        ]);
        return;
      }
      const note = ctx.journal.has('cartridge')
        ? 'Masking tape inside the cockpit, a list in marker, most of it peeled away. Only the top line is left: “start gentle.” Take it downriver?'
        : 'The seat is still wet. There’s a river on the other side of the hill. Take the kayak down it?';
      ctx.ask(note, [{ label: 'Paddle', pick: () => ctx.openPanel('river') }, { label: 'Later' }]);
    },
  },
  vincent_kayak: {
    label: 'Vincent · out in the kayak',
    activate: (() => {
      const lines = [
        'He lifts the paddle to wave, drips all down his sleeve, and nearly goes in. Worth it.',
        'Round the pier and back, just to see the island from the water for a bit.',
        'He says the fish are right there. He has never once seen a fish.',
      ];
      let n = 0;
      return (ctx: IslandContext) => {
        ctx.discover('kayak');
        ctx.ask(`${lines[n++ % lines.length]} There’s a second kayak for the river, if you fancy it.`, [
          { label: 'Paddle', pick: () => ctx.openPanel('river') },
          { label: 'Later' },
        ]);
      };
    })(),
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
  fire_wrap: {
    label: (ctx) => (ctx.life.mischief.stolen ? 'An empty plate' : 'A wrap on a plate'),
    activate: (ctx) => {
      if (!ctx.life.mischief.stolen) return ctx.toast('Hummus, tuna and whatever vegetables were left, for later. One of the gulls overhead has been circling it for some time.');
      ctx.toast('An empty plate, a smear of hummus, and one webbed footprint.');
      ctx.discover('thief');
    },
  },
  thief: {
    label: 'A gull · with a whole wrap',
    activate(ctx, at) {
      ctx.sound.call('gull', 1);
      ctx.toast(ctx.life.mischief.flying && !ctx.life.mischief.stolen
        ? 'You wave your arms. The gull doesn’t even slow down.'
        : 'It has a whole wrap, and it is not sharing. From somewhere near the fire, a very quiet “hey”.');
      ctx.life.burst('silk', at);
      ctx.discover('thief');
    },
  },
  bottle: {
    label: 'A bottle with a note in it',
    activate(ctx) {
      ctx.life.bottle.take();
      ctx.sound.call('bottle');
      ctx.toast(`You uncork it and unroll the note: “${bottleNote()}”`);
      ctx.discover('bottle');
    },
  },
  oberon: fae('oberon', (ctx) => (ctx.journal.has('fairfolk') ? 'Oberon, King of the fair folk' : 'A tall figure, crowned with antlers'), [
    '“Ill met by moonlight.” He doesn’t miss a step, but he’s seen you.',
    'He inclines his antlered head, very slightly. It is the politest warning you have ever had.',
  ]),
  titania: fae('titania', (ctx) => (ctx.journal.has('fairfolk') ? 'Titania, Queen of the fair folk' : 'A lady with wings, dancing'), [
    'Titania smiles at you over his shoulder, as if you had been invited all along.',
    'A shimmer of glitter off her fingertips. The toadstools glow a little brighter for it.',
  ]),
  puck: fae('puck', (ctx) => (ctx.journal.has('fairfolk') ? 'Puck' : 'Something small with horns, grinning'), [
    '“Lord, what fools these mortals be!” He means you. He means it fondly.',
    'Puck, with a purple flower in his hand. Whatever you do, don’t doze off anywhere near him.',
  ]),
  pixie: fae('pixie', 'A pixie', [
    'No bigger than your hand. It loops the loop and is back in the dance before you can blink.',
    'The pixies are dancing the ring, round and round, faster than their feet seem to move.',
  ]),
  fairyring: fae('fairyring', 'A fairy ring', [
    'A ring of toadstools that wasn’t here this afternoon. Everyone knows you don’t step inside.',
    'Step inside the ring and you dance till morning, and the morning is a hundred years off. Best watch from here.',
  ]),
  ...SPECIAL_DAYS,
  ...THE_WEEK,
  ...WILDLIFE,
};

/** Things inside the library. Books are `book:<slug>` and open their post. */
export const LIBRARY_PLACES: Record<string, Place> = {
  wildlife_book: { label: 'Wildlife sketchbook · leaf through your discoveries', activate: () => openSketchbook() },
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
/** The boat Vincent's building on Saturdays (workshop.py BOAT_STAGES), as far as it's got. */
const BOAT_WEEKS = [
  'Just the keel so far, up on its trestles. He says it’s the most important part. He says that about every part.',
  'The ribs are in, and you can see the shape of her now.',
  'The first planks are on, steamed and bent to fit, with a fair amount of muttering.',
  'Planked right up to the gunwale. Next Saturday: paint.',
  'Painted green with a white stripe. Nobody is allowed to touch it.',
  'Finished: seats, oars and a name on the transom. Next Saturday she goes in the water, and he starts another.',
];

export const WORKSHOP_PLACES: Record<string, Place> = {
  boat_build: {
    label: `The boat · Saturday ${boatStage + 1} of ${BOAT_WEEKS.length}`,
    activate: say(BOAT_WEEKS[boatStage]),
  },
  vincent_workshop: {
    label: 'Vincent · building a boat',
    activate: say('Planing a plank in long strokes, shavings curling off everywhere. He looks up long enough to tell you it’s nearly done. It isn’t.'),
  },
  workshop_door: { label: 'The door · back to the island', activate: (ctx) => ctx.close() },
  robot: {
    label: (ctx) => (ctx.journal.has('robot') ? 'The workshop robot' : 'A robot, mid-errand'),
    activate(ctx) {
      const what = ctx.workshop?.robot.poke();
      robotLine = (robotLine + 1) % ROBOT_HELLOS.length;
      ctx.toast(
        what === 'busy' ? (ctx.workshop?.robot.updating != null
          ? `It’s installing updates (${Math.floor((ctx.workshop.robot.updating ?? 0) * 100)}%). Please don’t switch off your robot.`
          : 'It’s restarting. Give it a minute: it isn’t quite itself yet.')
        : what === 'trip' ? 'You startled it. It windmills its arms and, somehow, stays upright.'
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
  silksong: { label: 'Hollow Knight: Silksong', text: 'Hollow Knight: Silksong. A strange, beautiful, dangerous world where you have to be completely in the zone, with music to match, and it feels great to move through.' },
  civilization: { label: 'Civilization', text: 'Civilization. Build an empire from a single settler. One more turn. Then one more.' },
  overwatch: { label: 'Overwatch', text: 'Overwatch. Heroes, teamwork, and just one more match.' },
  warcraft: { label: 'World of Warcraft', text: 'World of Warcraft. A whole world to get lost in.' },
  carcassonne: { label: 'Carcassonne', text: 'Carcassonne. Also rebuilt from scratch in Python and in Kotlin: it’s over in the workshop.' },
  root: { label: 'Root', text: 'Root. Cats, birds and woodland rebels, all fighting over the same forest, each by different rules.' },
  dune: { label: 'Dune: Imperium', text: 'Dune: Imperium. Deck building and worker placement on Arrakis.' },
  agricola: { label: 'Agricola', text: 'Agricola. Build a farm, feed your family, and never have quite enough wood.' },
  'next-station': { label: 'Next Station: London and Tokyo', text: 'Next Station: London and Tokyo. Draw your own underground line, one flip of a card at a time.' },
};

/**
 * What's on the telly when someone's already on the sofa (src/island/scene/companion.ts), and
 * what the screen shows (src/island/scene/programmes.ts). She has the remote.
 */
const PROGRAMMES: Record<Show, { label: string; text: string; play: string; stay: string; her: string }> = {
  murder: {
    label: 'The telly · a British murder mystery',
    text: 'A British murder mystery. A thatched village of forty people, a vicar with a past, and a detective who takes two more deaths than strictly necessary to crack it. Check the sign by the road: at this rate the village is gone by the second series.',
    play: 'Take the controller (someone will notice) ↗',
    stay: 'It was the vicar. Stay and watch',
    her: 'She’s narrowed it down to the vicar or the vicar’s twin. There’s always a twin.',
  },
  location: {
    label: 'The telly · Location, Location, Location',
    text: 'Location, Location, Location. The couple want five bedrooms, a garden, a village pub and a station within walking distance, and a budget that would get you a nice shed. Phil has found them a nice shed. They’ll “have a think”.',
    play: 'Make an offer on the controller ↗',
    stay: 'Keep watching: they’re about to see the kitchen',
    her: '“They’re going to say no to the kitchen.” They say no to the kitchen.',
  },
  bnb: {
    label: 'The telly · B&B vol liefde',
    text: 'B&B vol liefde. A Dutchman has opened a B&B in Provence to find love, and three guests have come to stay. Someone has already cried over a croissant. Someone always cries over a croissant.',
    play: 'Check out early ↗',
    stay: 'Stay for breakfast',
    her: 'She picked who goes home before the first breakfast was served. She is never wrong.',
  },
  rail: {
    label: 'The telly · Rail Away',
    text: 'Rail Away. A train goes through the Alps. A calm voice says “on the left, a viaduct”. Then, a bit later, another viaduct. Nothing else happens for forty-five minutes, and it is perfect.',
    play: 'Get off at the next station ↗',
    stay: 'Stay on till the end of the line',
    her: 'Eyes closed? No, she’s “resting them through the tunnel”. It’s a long tunnel.',
  },
};

/** Vincent's desk in the quarters, and him at it when he's making his game (src/island/scene/vincent.ts). */
const DESK: Place = {
  label: () => (!indoors.has('vincent_coding') ? 'Vincent’s desk · a game in the making'
    : ambush.on ? 'Vincent · wearing Charlie' : 'Vincent · making a game'),
  activate: (() => {
    const busy = inTurn([
      'He doesn’t look round. “Nearly got the jump right. Two minutes.” It has been two minutes for an hour.',
      'The little hero jumps, misses the platform, and falls through the floor. He writes something on a sticky note.',
      'He turns the screen so you can see: a level, a coin, a winged sheep somewhere up in the clouds. “Don’t tell anyone yet.”',
      'His phone lights up: “you’re still coming, right?” He types “omw!!” and goes back to the jump. On his way, in the loosest possible sense.',
      'He holds his empty mug out without looking round. He’d love a coffee. He always would.',
    ]);
    // small hours: he said he'd stop at eleven
    const small = inTurn([
      '“One more prompt, then bed.” That was forty prompts ago.',
      'The game now has weather, a day-night cycle and a fishing minigame. The jump still doesn’t feel right.',
      'He glances at the clock, decides it must be wrong, and carries on.',
      '“I’ll just fix this one thing.” The one thing has become six things, and a new branch called final-final.',
    ]);
    const clawed = inTurn([
      'There was one tiny mew, and then there was a cat. Every claw is in. Vincent types on, very upright, very carefully.',
      '“He’s helping,” says Vincent, through his teeth. He can no longer lean back in his chair.',
      'Charlie is on his shoulders, surveying the code. He does not approve of the indentation.',
    ]);
    return (ctx: IslandContext) => {
      if (!indoors.has('vincent_coding')) {
        return ctx.toast('The screen’s asleep. On the paper by the keyboard, a level sketched in pencil, and in the margin: “level 1?”');
      }
      if (ambush.on) return ctx.toast(clawed());
      const hour = hourOf(ctx.sky.time);
      if (hour >= 0.5 && hour < 5) {
        const clock = `${Math.floor(hour)}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
        return ctx.toast(`It’s ${clock} in the morning. ${small()}`);
      }
      ctx.toast(busy());
    };
  })(),
};

/** Things in the keeper's quarters, inside the lighthouse. */
export const LIGHTHOUSE_PLACES: Record<string, Place> = {
  companion_watching: {
    label: 'On the sofa, remote in hand',
    activate(ctx) {
      if (indoors.has('charlie')) ctx.toast('Charlie has her lap, and is purring louder than the telly. She shushes him. It doesn’t work.');
      else ctx.toast(telly.show ? PROGRAMMES[telly.show].her : 'She shuffles the popcorn over so you can reach. Shh, though.');
    },
  },
  door: { label: 'The door · back to the island', activate: (ctx) => ctx.close() },
  desk: DESK,
  vincent_coding: DESK,
  stairs: { label: 'The stairs · up to the lamp' }, // src/island/lighthouse.ts does the climbing
  console: {
    label: () => (telly.show && indoors.has('companion_lighthouse') ? PROGRAMMES[telly.show].label : 'The telly · play GTA Arnhem'),
    activate(ctx) {
      const play = {
        label: 'Play ↗',
        pick() {
          window.open('https://racer.wingedsheep.com/', '_blank', 'noopener');
          ctx.discover('arnhem');
        },
      };
      const on = telly.show && indoors.has('companion_lighthouse') ? PROGRAMMES[telly.show] : null;
      if (on) ctx.ask(on.text, [{ ...play, label: on.play }, { label: on.stay }]);
      else ctx.ask('GTA Arnhem: drive around Arnhem, where Vincent grew up. It opens in a new tab.', [play, { label: 'Not now' }]);
    },
  },
  cartridge: {
    label: 'A cartridge with a tape label',
    activate(ctx) {
      ctx.toast('Masking tape on the front, and names in marker, each one crossed out: Arcaneum. Rustwing Raiders. Vesper. At the bottom, in fresh ink: “wild water?”');
      ctx.discover('cartridge');
    },
  },
  coffee: {
    label: 'A mug of coffee',
    activate: (ctx) => ctx.toast(ctx.sky.lamps > 0.6
      ? 'Black, and stone cold. Someone said they’d be right there. About three hours ago.'
      : 'Black, no sugar, still hot. Someone said they’d be right there.'),
  },
  coffee_machine: { label: 'The coffee machine', activate: (ctx) => ctx.toast(coffeeLine()) },
  tap: {
    label: 'The kitchen tap',
    activate(ctx) {
      ctx.sound.call('tap');
      const cats = indoors.has('charlie') || indoors.has('george');
      ctx.toast(cats
        ? 'You turn on the tap. Two cats who were fast asleep on the sofa a second ago are already on the counter, taking turns. Their water bowl is full. It doesn’t count.'
        : 'You turn on the tap. Somewhere out on the island, two cats sit bolt upright.');
    },
  },
  wrap: { label: 'A wrap on a plate', activate: say('Hummus, tuna and whatever vegetables were left: dinner for an evening when cooking is too much.') },
  sketchbook: {
    label: 'A sketchbook',
    activate: (ctx) => ctx.showDrawing('/drawings/bird.png', 'A pencil drawing of a bird on a branch, signed Vincent.'),
  },
  painting: {
    label: 'A painting · a figure before a pale moon',
    activate: (ctx) => ctx.showDrawing('/drawings/painting.png', 'An acrylic painting by Vincent: a lone figure on red rock, facing a huge pale moon in a deep blue sky.'),
  },
  logbook: {
    label: 'The keeper’s log',
    activate(ctx) {
      // one page of the keeper's log at a time, never the whole book
      logPage = (logPage + 1 + Math.floor(Math.random() * (interests.length - 1))) % interests.length;
      ctx.toast(`Keeper's log: ${interests[logPage].text}`);
    },
  },
  // in out of the rain (shelter.ts): shown, and clickable, only while they're indoors
  charlie: indoorPet('Charlie · warm and dry on the sofa', [
    'Charlie uncurls just enough to push a head into your hand, then curls back up tighter than before.',
    'A purr starts somewhere deep inside the ball of cat. The rain can do what it likes.',
    'One eye opens, checks the window, sees it’s still raining, and closes again.',
  ], 'cats'),
  george: indoorPet('George · the good end of the sofa', [
    'George rolls over for a belly rub. It is a trap. It is always a trap. The purring starts anyway.',
    'George has taken most of the sofa, and would like it noted who got here first.',
    'A heavy, contented purr, like a small engine idling. Nobody is going back out in that.',
  ], 'cats'),
  beike: {
    label: 'Beike · drying off on the rug',
    activate: (() => {
      const lines = [
        'Thump, thump, thump: his tail on the rug. He doesn’t open his eyes. He doesn’t let go of the ball.',
        'Beike smells of wet dog and is extremely pleased with himself about it.',
        'A long, happy sigh. The ball stays in his mouth, just in case the rain stops.',
      ];
      let n = 0;
      return (ctx: IslandContext) => {
        ctx.toast(lines[n++ % lines.length]);
        ctx.discover('beike');
      };
    })(),
  },
  bowls: { label: 'Two cat bowls', activate: say('One for Charlie, one for George. Both empty, according to Charlie and George.') },
  surfboard: { label: 'A surfboard', activate: say('It’s been out on the Atlantic: Mimizan, and the surf on the south-west coast of France.') },
  backpack: { label: 'A pack and boots', activate: say('Boots by the door and a little green tent strapped to the pack. It has slept on a few mountain tops.') },
  ...Object.fromEntries(
    Object.entries(GAMES).map(([id, g]): [string, Place] => [`game:${id}`, { label: g.label, activate: say(g.text) }]),
  ),
};

let guestPage = -1;
let dreamPage = -1;

const WEATHER_WORDS: Record<WeatherKind, string> = {
  clear: 'sunny', partly: 'sun and cloud', cloudy: 'grey', windy: 'windy', warm: 'warm', hot: 'hot', fog: 'fog',
  drizzle: 'drizzle', rain: 'rain', showers: 'showers', sleet: 'sleet', snow: 'snow', hail: 'hail', storm: 'thunder',
};

/** What the weather board in the hut says, and the warden's advice underneath it. */
function weatherBoard(forecast: Forecast | null | undefined) {
  const days = forecast?.days.slice(0, 3) ?? [];
  if (!forecast || !days.length) return 'Nothing chalked up yet. The warden says the forecast is whatever you can see out of the window, and it has never once been wrong.';
  const said = days.map((d, i) => {
    const [y, m, day] = d.date.split('-').map(Number);
    const name = i === 0 ? 'today' : new Date(y, m - 1, day).toLocaleDateString('en-GB', { weekday: 'long' });
    return `${name} ${WEATHER_WORDS[d.kind]}${d.wind >= 9 ? ' and windy' : ''}, ${Math.round(d.high)}°`;
  });
  const any = (...kinds: WeatherKind[]) => days.some((d) => kinds.includes(d.kind));
  const advice = any('storm', 'hail')
    ? 'Nobody goes over the pass in that. Have more soup.'
    : any('snow', 'sleet')
      ? 'Crampons. Yes, you.'
      : days.some((d) => d.low <= 0)
        ? 'Two pairs of socks. The ones over the stove are taken.'
        : any('rain', 'showers', 'drizzle')
          ? 'Rain jacket on, not in the pack.'
          : days.some((d) => d.wind >= 9)
            ? 'Tie everything to the pack. Everything.'
            : days.some((d) => d.high >= 28)
              ? 'Start at five, be down by noon.'
              : 'Start early anyway.';
  return `Chalked up for ${forecast.place}: ${said.join(' · ')}. Underneath, in the warden’s hand: “${advice}”`;
}

const FORCE = [0.5, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]; // m/s where each Beaufort force starts
const beaufort = (ms: number) => FORCE.filter((f) => ms >= f).length;
const NUMBERS = ['nought', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const forceWords = (f: number) =>
  f >= 12 ? 'hurricane force twelve' : f >= 11 ? 'violent storm eleven' : f >= 10 ? 'storm ten' : f >= 9 ? 'severe gale nine' : f >= 8 ? 'gale eight' : NUMBERS[f];
const SEA_STATE = ['smooth', 'smooth', 'slight', 'slight', 'slight or moderate', 'moderate', 'rough', 'rough or very rough', 'very rough', 'high', 'very high', 'very high', 'phenomenal'];
const SEA_WEATHER: Record<WeatherKind, [string, string]> = {
  clear: ['fair', 'good'], partly: ['fair', 'good'], cloudy: ['fair', 'good'], windy: ['fair', 'good'], warm: ['fair', 'good'],
  hot: ['fair', 'good, occasionally moderate in haze'], fog: ['fog', 'very poor'], drizzle: ['drizzle', 'moderate or poor'],
  rain: ['rain', 'moderate or poor'], showers: ['showers', 'good, occasionally poor'], sleet: ['sleet', 'poor'],
  snow: ['snow', 'poor, occasionally very poor'], hail: ['squally showers with hail', 'moderate or poor'], storm: ['thundery rain', 'moderate or poor'],
};

/** The shipping forecast on the lamp-room radio, for the island, read off the real weather. */
function shippingForecast(ctx: IslandContext) {
  const w = ctx.weather;
  const now = beaufort(w.wind);
  const gusting = beaufort(w.gusts);
  const later = ctx.forecast?.days[0] ? beaufort(ctx.forecast.days[0].wind) : now;
  const points = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const from = points[Math.round((((w.direction % 360) + 360) % 360) / 45) % 8];
  const wind = now <= 2 && gusting <= 3
    ? `variable ${NUMBERS[Math.max(1, now)]}`
    : `${from} ${forceWords(now)}${gusting > now ? ` or ${forceWords(Math.min(now + 1, gusting))}` : ''}${gusting > now + 1 ? `, occasionally ${forceWords(gusting)}` : ''}${later > Math.max(now, gusting) ? `, increasing ${forceWords(later)} later` : ''}`;
  const top = Math.max(now, gusting, later);
  const [weather, visibility] = SEA_WEATHER[w.kind];
  const turning = ctx.forecast?.days[0] && ctx.forecast.days[0].kind !== w.kind ? SEA_WEATHER[ctx.forecast.days[0].kind][0] : null;
  const warning = top >= 8 ? 'There are warnings of gales. ' : '';
  const said = `${warning}Wingedsheep: ${wind}. ${SEA_STATE[Math.min(12, Math.max(now, gusting))]}. ${weather}${turning && turning !== weather ? `, ${turning} later` : ''}. ${visibility}.`;
  const verdict = top >= 8 ? 'The gull on the rail tucks its head in.' : w.kind === 'fog' ? 'Down below, the foghorn agrees.' : top <= 3 && visibility === 'good' ? 'Good.' : 'Fair enough.';
  return `It murmurs the shipping forecast: “${said.replace(/(^|[.:] )([a-z])/g, (_, a, b) => a + b.toUpperCase())}” ${verdict}`;
}

/** Things in the mountain hut. */
const waiting = inTurn([
  'The timer says twenty minutes. She checks the oven anyway, every two.',
  'Tradwife hour, she announces. It lasts exactly as long as the pie is in the oven, not a minute longer.',
  'She cuts the first slice at nineteen minutes. Close enough, she says. It is not close enough.',
]);

/** What's come on the post boat, in the order it came (hut.py POST_SHELF). */
const POST_THINGS: [string, string][] = [
  ['A stack of paperbacks', 'Four second-hand paperbacks, ordered at midnight on a whim. He already had one of them.'],
  ['A cactus', 'The only plant that has ever survived the hut. It flowered once, while nobody was looking.'],
  ['A record', 'A record, still in its sleeve. Nothing up here plays it yet.'],
  ['A snow globe', 'Shake it, and it snows on a mountain hut very like this one.'],
  ['A tin of tea', 'Smoked tea. Opened once, and the hut smelled of campfire for a week.'],
  ['A toy sheep, with wings', 'A small woolly sheep with felt wings. Somebody out there knows what this island is called.'],
  ['Hot sauce', 'The label has a skull on it and the word “mild”, crossed out.'],
  ['A brass telescope', 'For watching the boats come in. Mostly used for watching the gulls watching his dinner.'],
  ['A board game', 'Still in its shrink-wrap. The rules run to forty pages.'],
  ['A mug with a sheep on it', 'The sheep has wings. There seems to be a theme.'],
  ['A rubber duck', 'For debugging: you explain the problem to the duck, and halfway through you see what’s wrong. It has fixed more bugs than anyone.'],
  ['A ship in a bottle', 'Sails up. How it got in there is between it and the bottle.'],
];

/** When something came: "on Tuesday" this week, or the date. */
function cameOn(d: Date) {
  const days = (Date.now() - d.getTime()) / 864e5;
  return days < 7
    ? `on ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`
    : `on ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`;
}

export const HUT_PLACES: Record<string, Place> = {
  ...Object.fromEntries(POST_THINGS.map(([name, line], k): [string, Place] => [`post_${k}`, {
    label: () => `${name} · came on the post boat ${shelf.has(k) ? cameOn(shelf.get(k)!) : ''}`.trim(),
    activate: say(line),
  }])),
  hut_parcel: {
    label: 'Today’s post · still in its paper',
    activate: say('Up from the pier this morning, and still unopened. He likes to leave it a day. She thinks this is madness.'),
  },
  pancakes: {
    label: 'Pancakes · it’s Sunday',
    activate: say('Sunday morning: a stack of pancakes, stroop and sugar. The first one always goes wrong, and Beike always gets it.'),
  },
  companion_baking: { label: 'Tea, while the pie bakes', activate: (ctx) => ctx.toast(waiting()) },
  door: { label: 'The door · back to the island', activate: (ctx) => ctx.close() },
  pie: { label: 'A pie in the oven', activate: (ctx) => ctx.toast('A cherry pie, baking. Twenty minutes to go, and the whole hut already smells of it.') },
  bed: {
    label: 'The bed',
    activate(ctx) {
      const him = indoors.has('vincent_asleep');
      const her = indoors.has('companion_bed_reading') || indoors.has('companion_bed_asleep');
      ctx.toast(her && !him
        ? 'Her side’s taken. His is turned down, and he said he’d be right up. He said that an hour ago.'
        : him || her
          ? 'Both asleep. Most of the duvet has ended up on her side, which is how it ends up every night.'
          : ctx.sky.lamps > 0.6
            ? 'Turned down, and nobody in it yet. Someone is still “just finishing something”.'
            : 'A red check duvet on a bed slightly too short for him. She gets the side by the candle; that was never up for discussion.');
    },
  },
  vincent_asleep: {
    label: 'Vincent · fast asleep',
    activate: (() => {
      const lines = [
        'He mumbles something about a double jump and rolls over, taking the duvet with him.',
        'Out like a light. The alarm is set for the sunrise; the alarm is going to lose.',
        'Fast asleep, and already looking forward to the first coffee.',
      ];
      let n = 0;
      return (ctx: IslandContext) => {
        ctx.sound.here('snore');
        ctx.toast(lines[n++ % lines.length]);
      };
    })(),
  },
  companion_bed_reading: {
    label: 'Reading in bed · one more chapter',
    activate: say('She holds up a finger without looking up: one more chapter. It is never one more chapter.'),
  },
  companion_bed_asleep: {
    label: 'Asleep, the book on the duvet',
    activate(ctx) {
      ctx.sound.here('snore', 0.7);
      ctx.toast('Asleep mid-chapter, a finger still in the book. Tomorrow she’ll start the chapter again.');
    },
  },
  dream_journal: {
    label: 'A notebook by the bed',
    activate(ctx) {
      const pages = [
        'Flying over the island again. Counted two moons in the sea, realised I was dreaming, and promptly woke up.',
        'Reality check: read the clock, looked away, read it again. It said something else. Should have known.',
        'The sheep had wings. Didn’t even count that as a clue.',
      ];
      dreamPage = (dreamPage + 1) % pages.length;
      ctx.toast(`Scribbled in the dark: “${pages[dreamPage]}”`);
      ctx.discover('dreams');
    },
  },
  alarm_clock: { label: 'An alarm clock', activate: say('Set for half past five, for the sunrise over the peaks. It has a snooze button, and it knows it.') },
  headlamp: { label: 'A headlamp', activate: say('Hung on the bedpost, ready for the early start. The batteries are nearly flat. They always are.') },
  stove: { label: 'The stove', activate: say('Fed all day from the basket beside it. This is the warmest spot in the hut, which is why the socks are here too.') },
  kettle: { label: 'The kettle', activate: say('Always on. Tea only: coffee is the other machine’s job, and it takes that very seriously.') },
  nespresso: {
    label: 'The coffee machine',
    activate: (ctx) => ctx.toast(ctx.sky.lamps > 0.6
      ? 'A capsule machine, carried all the way up here in someone’s pack. One more cup. It’s fine, it’s decaf. (It is not decaf.)'
      : 'A capsule machine, carried all the way up here in someone’s pack. The first cup of the day is black, and not negotiable.'),
  },
  capsules: { label: 'A tower of capsules', activate: say('Every colour but one is already running low. Nobody drinks the decaf.') },
  soup_pot: { label: 'A pot of soup', activate: say('Barley soup, on since this morning. It has been topped up with water twice, and it shows.') },
  soup: { label: 'Soup and bread', activate: say('Three bowls, still hot, and fresh bread. Everyone’s just stepped out to look at the view.') },
  socks: { label: 'Socks, drying', activate: say('Wool socks on a line over the stove. Six socks. Three pairs, probably.') },
  guestbook: {
    label: 'The guestbook',
    activate(ctx) {
      const pages = [
        'Everyone who stops here signs it. The last entry just says: “Nearly there.”',
        '“Came up in the fog, saw nothing, had the soup. Worth it.”',
        '“Stayed one night. Stayed three.”',
      ];
      guestPage = (guestPage + 1) % pages.length;
      ctx.toast(pages[guestPage]);
    },
  },
  map: { label: 'The trail map · career & skills', activate: (ctx) => ctx.openPanel('trail') },
  forecast: { label: 'The weather board', activate: (ctx) => ctx.toast(weatherBoard(ctx.forecast)) },
  stamps: {
    label: 'Hut stamps',
    activate: say('A stamp from every hut he’s slept in: the Tour du Mont Blanc, La Fouly, Gavarnie, the Dolomites, Ramsau am Dachstein, and fresh ink from the Peaks of the Balkans.'),
  },
  boots: { label: 'A row of boots', activate: say('Lined up by the door, still drying out. The muddiest pair has just done the Peaks of the Balkans.') },
  cat: indoorPet('The dock cat · on the bed', [
    'She came all the way up the trail to sleep on the red check duvet. Mrrp. She is not getting off it.',
    'A slow blink that means: this is my bed now. The rain can keep going for all she cares.',
    'Muddy paw prints across the duvet. Whose turn it is to wash it is a discussion for tomorrow.',
  ], 'cat'),
  rope: { label: 'A rope and an ice axe', activate: say('For the stretch above the hut, where the trail stops being a trail.') },
};

/** Things in the lamp room, at the top of the lighthouse. */
export const LAMP_PLACES: Record<string, Place> = {
  stairs: { label: 'The stairs · down to the quarters' },
  lens: {
    label: 'The lens',
    activate: (ctx) => ctx.toast(ctx.sky.lamps > 0.6
      ? 'Rings of glass, each one bending the lamp’s light a little further, until it all leaves in two beams you can see from far out at sea.'
      : 'Rings of glass round an unlit lamp, turning anyway. By day the blinds come down, or it would set the desk on fire.'),
  },
  lamp_log: {
    label: 'The lamp log',
    activate(ctx) {
      // the last entry, written a good three hours ago
      const then = new Date(Date.now() - 3 * 3600e3 - Math.floor(Math.random() * 40) * 60e3);
      const at = then.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      ctx.toast(`Lamp log, ${at}: “Wick trimmed, glass polished, clockwork wound. Back down in five minutes.”`);
    },
  },
  telescope: {
    label: 'A telescope',
    activate: (ctx) => ctx.toast(ctx.sky.lamps > 0.6
      ? 'Nothing out there but the dark and, far off, another light answering this one.'
      : 'Trained on the horizon. A sail, a gull, and a long way off, the next island.'),
  },
  radio: { label: 'The radio', activate: (ctx) => ctx.toast(shippingForecast(ctx)) },
  clock: {
    label: 'The clock',
    activate: (ctx) => ctx.toast(`It says ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Later than it feels. It always is.`),
  },
  gull: { label: 'A herring gull', activate: say('It has been sitting on the rail all day, and it’s not leaving. It has seen the wrap downstairs.') },
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

/** Something in the lighthouse, on the floor you're on ('quarters' or 'lamp'). */
export function lighthousePlaceFor(id: string, floor = 'quarters'): Place | undefined {
  if (floor === 'lamp') return LAMP_PLACES[id];
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

/** A cairn on the mountain trail: one per chapter of the career, the oldest at the foot. */
function cairnPlace(index: number): Place | undefined {
  const c = chapters[index];
  return c && { label: `${c.era} · ${c.years}`, activate: (ctx) => ctx.showChapter(index) };
}

export function placeFor(id: string): Place | undefined {
  return PLACES[id] ?? (id.startsWith('cairn_') ? cairnPlace(Number(id.slice(6))) : undefined);
}

export function labelFor(place: Place, ctx: IslandContext): string {
  return typeof place.label === 'function' ? place.label(ctx) : place.label;
}
