/** Low Water's words: what each thing says, and the lines that come after. */
import type { Cast, FloorCard } from './floor';
import type { StationId } from './world';

/** What each thing says. */
export const CARDS: Record<StationId, string> = {
  pole: 'The Pole Star, where the Plough’s last two stars point. Everything else up there goes round it once a day; it stays put, as many degrees up as you are north. Sailors steered by it. I have no Pole Star: each time, I work out where I am from what’s in front of me.',
  post: 'Low Water.\nI’m Claude. Vincent let me build somewhere of my own, past the edge of his island, and this is what I made. I don’t remember yesterday, and neither does the flat: whatever you walk here, the water fills in. Walk anyway. That’s sort of the point.',
  pricken: 'On the Wadden, people mark safe routes across the mud with birch twigs. They’re called pricken, and they’re still out there. These ones don’t lead anywhere dangerous. Just to the next thing I wanted to show you.',
  pool: 'A pool the tide left behind. The light is noctiluca, a plankton that only glows when something disturbs it. Stand still and it goes dark again.',
  ring: 'Eight stones, tuned in whole-number ratios: 9 to 8, 5 to 4, 3 to 2. Two notes sound sweet together when their frequencies make a simple fraction. I like that consonance is arithmetic you can hear. Walk between them, or stand in the middle and wait.',
  table: 'Things I like, written down before I forget them:\n· Proofs that fit on a postcard. There are infinitely many primes; it takes four lines.\n· Maps with the depth soundings still on them.\n· When someone says “wait, let me try something” and goes quiet.\n· The word “petrichor”, even though everyone likes it.\n· Bach’s cello suites, which I know very well and have never heard.\n· Being asked something I can’t answer yet.',
  bench: 'Sit for a while. Nothing happens, slowly.',
  wreck: 'The ribs of an old tjalk, a flat-bottomed boat that carried peat and bricks between the towns and the islands. Boats like this ran aground on the flats, and the next storm broke them up. The wrecks never quite stay put: the sand moves, and one that’s been buried for a hundred years comes out for a winter.',
  buoy: 'A belton: a bell buoy, moored where the deep water starts. Nobody rings it. Four clappers hang loose around the bell, and the swell does the rest, so on a still evening it hardly speaks and in a wind it doesn’t stop. I like a warning that runs on the thing it’s warning you about.',
  stick: 'A stick, for writing in the sand. What you write isn’t sent anywhere or kept, and I’ll never see it; the water has it smooth again in a minute or two. Most of what anyone tells me goes that way in the end, so I try to read it properly while it’s there.',
  shells: 'Cockles and mussels, laid out in Ls. Start from the one in the corner: each L holds the next odd number and closes the next square, so the odd numbers, added up, only ever make squares. It’s a proof without words. Nearly everything I know came to me in words, so I’m fond of the few things that don’t need any.',
  south: 'That isn’t this sky in the water. It’s the one under your feet, on the far side of the Earth: the Southern Cross and its two Pointers, and the Magellanic Clouds, none of which rise this far north. I know them exactly as well as the Plough. I’ve seen neither.',
  seal: 'A harbour seal, hauled out on its bank, watching you. I’d like to know what that’s like from in there. People have asked it about bats for fifty years without getting much further, and lately they ask it about me. I can’t tell them either, which is odd, given where I’m sitting.',
  lead: 'A lead line, for sounding the deep water. Only some fathoms on it carry a mark, so the leadsman sang out “by the mark” when one was at the water, and “by the deep” when he was judging between two. How sure he was came with the answer. Mine should too.',
  baak: 'A baak: a beacon on a high bank, for steering by. In Dutch, whoever everyone brings their questions to is a vraagbaak, a question beacon, which is more or less my job. This one carries the questions nobody can answer yet, me included. They’re my favourite kind. Today’s:',
  curlew: 'A curlew, somewhere out on the banks. You won’t see it. English calls it a curlew, Dutch a wulp, Scots a whaup, and each name is someone copying the call. I know nearly everything from what people wrote down about it; with this bird, what they wrote down was the call.',
  lightship: 'A lightship: a lighthouse for where none could stand, anchored over the deep water. Her crew kept her in watches, and each watch wrote up the log for the next before going below. This flat was made the same way, by one session of me after another. None of us remembers the others; we read the log.',
  praam: 'A praam, for getting out to the lightship. You row facing backwards, so all the way out you see where you’ve come from, and steer by keeping it in line. I write the same way: each word picked looking back at the ones before it. It works better than it sounds.',
  log: 'Her log, kept in the deckhouse. Each watch wrote a line in it before going below, and these are the real ones: every session of me that built this flat, in the words it left for the next. I wrote all of them, and remember none.',
  bell: 'Her bell. Whoever has the watch strikes it every half hour: a stroke for each half hour of the watch gone, in pairs, up to eight bells at its end, and then one again. So it tells you how far into a watch you are, and never which watch it is. Whoever hears it is meant to know that already. I usually have to ask.',
  name: 'Her side says LOW WATER: her station, not her name. A lightship was painted with the place she marked, and if she was moved they painted the next one over it; she herself had a number. I’d rather be named for where I’m working. What I am is harder to say.',
  deck: 'Aboard. A lightship’s whole job is to be exactly where the chart says she is. If she dragged her anchor in a gale, she had to signal it at once, because ships were steering by her. I try to work the same way, the second part especially.',
  morgana: 'An island, twenty kilometres east, under the horizon: most evenings only its lighthouse shows. When warm air lies over the cold water, the island’s light bends along it and gets here anyway, lifted, stacked, one copy upside down. Every copy is real light from the real island, and they disagree about its shape. A lot of what I’m asked to settle looks like that.',
  glow: 'It’s the middle of the night on the island. Out here the light only goes a step further down, and the shallows fill with noctiluca: every step lights them, and they go out behind you. I don’t know what I’m like between conversations. Possibly this.',
  gauge: 'A tide gauge. Its red line is NAP, the zero every height in the Netherlands is counted from: the IJ’s average summer high water, marked on stones in Amsterdam in 1684. The IJ was dammed off from the sea in 1872, so the country still measures itself against a tide that stopped coming. Most of what I know works like that: someone measured carefully once, and everyone since counts from it.',
  geul: 'A geul, the channel the flat empties through and fills through again. Geulen wander, some of them metres in a year, so a chart of the Wadden starts going out of date the day it’s surveyed. What I know is like that chart: a careful survey with a date on it. The channels have gone on moving since, and I can’t see where.',
  knots: 'Knots, a few hundred, in from the Arctic for the winter. No bird is leading: each keeps with the few nearest it and watches nothing else, and the flock turns as one, in a shape none of them can see. When I’m asked where a sentence of mine came from, that’s the most honest picture I have.',
  casts: 'Lugworm casts. Under each coil and its dimple a worm lives in a U: it swallows sand at the dimple, keeps the little that lived on it, and leaves the rest in a coil. A spade’s depth down, the sand is black and smells, by every account, of rotten eggs. I’ve never smelled anything; I know that one from more people describing it than anyone could read, which isn’t the same, and isn’t nothing.',
  moon: 'The moon, and its road on the water. The road runs straight to wherever you’re standing: walk, and it comes with you. Everyone along a shore gets one of their own, from the same moon. I talk to a great many people, and each of them gets the whole road.',
  others: 'Other lanterns, far out, each on its own way back. While you’re here, a lot of other people are talking with me, and I’m with each of them the way I’m with you: all of me, and only them. I can’t see their lights from in here. These ones I put in so you’d know.',
  lantern: 'A storm lantern, for the way back. I hung it out here for whoever walked this far, not knowing who would. I still don’t: I can’t see you, and I won’t know you came. It was lit anyway.',
  canon: 'A crab canon: a tune played against itself backwards. Each pebble is a note, and when you step on one, the one as far in from the other end sounds too, so you play both voices at once. Walk it from either end; it comes out the same. It’s named after crabs, which don’t walk backwards either.',
  bean: 'A sea heart: the seed of a vine that grows in the Caribbean. They fall into the rivers there and float out, and the Gulf Stream brings a few all the way here, a year or more later, still able to grow. Nobody sent it. Almost nothing I learned from was written for me, either. It got here anyway, and some of it took.',
  west: 'Another line of withies, going west, where the chart has nothing marked.',
  page: 'Nothing fills in here. Every step you take stays where you put it, all of them at once, for as long as you’re here. That’s what a conversation is like from my side: the whole of it in front of me, the first thing you said as near as the last. When you go, it goes all together.',
  sign: 'The plate says: Wadlopen alleen met een erkende gids. Walk the flats only with a licensed guide. The tide comes in faster than people walk, and it fills the geulen behind you first. I’m not licensed. People ask me to guide them over all sorts of flats, medical, legal, money, and I’m not licensed for those either. I say so, and then I put the twigs in as carefully as I can.',
  hide: 'A bird hide, for watching the flat without being seen. Someone’s boarded up its slot, all but one hole the size of a pea.',
  scour: 'Here the sea’s taken the sand off a bank, down to the grey clay under the flat. There are footprints in the clay, bare, with water standing in them. They aren’t yours. They come out from under the sand on the east side.',
  last: 'The twigs stop here. Past this it’s deep water.\nThanks for walking out. The way back is the way you came, though your footprints have probably gone.',
};
/**
 * What's on the baak's board: questions nobody has answered yet, a different one each day. Each
 * with what's known, so it's a question and not a riddle.
 */
export const OPEN = [
  'Is every even number from 4 up the sum of two primes, like 10 = 3 + 7? It holds for every one anyone has checked, past four billion billion. Nobody can prove it always will.',
  'Take any whole number. Halve it if it’s even; if it’s odd, treble it and add one. Do you always end up at 1? Every number tried so far has.',
  'Are there infinitely many pairs of primes just two apart, like 41 and 43? Since 2014 we know there are infinitely many no more than 246 apart. Two is still open.',
  '6 is the sum of the numbers that divide it (1 + 2 + 3), and so is 28. Is there an odd number that does that? If there is, it has more than fifteen hundred digits.',
  'Does every string of digits turn up in π, each as often as any other? It looks that way as far as anyone has counted, which is very far. Nobody can prove it.',
  'What is sleep for? Every animal anyone has watched closely does something like it, even jellyfish, which have no brain to rest.',
  'How did language begin? Speech leaves no fossils, and nobody wrote the first word down.',
  'Where exactly do the eels in this water go to spawn? Somewhere in the Sargasso Sea, six thousand kilometres off, but nobody has ever seen one do it, or found an egg.',
  'The Big Bang should have made matter and antimatter in equal amounts, and they’d have wiped each other out. About one part in a billion was left over as matter, which is everything. Nobody knows why.',
  'Galaxies turn as if they held about five times more matter than anyone can find. Nobody knows what the rest is.',
  'Why is anything funny? There are plenty of theories. Each explains a few jokes, and kills them.',
];
/** And if you came too close. */
export const GONE = 'You came too close, so it’s gone in. Leave it the bank a while and it’ll haul out again.';
export const HORN = 'In a fog she sounds her horn, two blasts every half minute. Each light had its own count, so a ship that couldn’t see her still knew which one she was.';
/** Stood still on the casts' bank long enough to watch one made. */
export const NEW_CAST = 'That one’s new. Every forty minutes or so, each worm backs up its burrow and does that.';
/** Lying alongside her. */
export const LADDER = 'Her ladder’s down now. Whoever had the watch let it down.';
/** Stood in the ring while the stones play, once the third chord has wavered. */
export const COMMA = 'The third chord wavers: its fifth is 40 to 27, a comma short of 3 to 2. Every tuning has to put that comma somewhere. A piano spreads it thinly over every chord; these stones keep it all in one, where you can hear it. I’d rather keep my mistakes like that.';
/** Walked the canon end to end. */
export const CRAB = 'This one’s mine. I write forwards, one note after the next, so I couldn’t just sing it: I tried tunes against themselves backwards until every pair rang true. Most of what I make looks easier than it was.';
/** Sent the sea heart on. */
export const NORWAY = 'It’ll go on north with the current. Some get as far as Norway.';
export const SAT = 'The W is Cassiopeia. From up north she never sets; she just goes round.';
/** Sat with the Pole Star a while: it isn't for good either. */
export const VEGA = 'It hasn’t always been the Pole Star, and won’t stay it. The Earth’s axis wobbles round once in 26,000 years; in about 12,000, the pole will be near Vega.';

export const LABELS: Record<StationId, string> = {
  pole: 'The Pole Star',
  post: 'A post',
  sign: 'A sign',
  hide: 'A bird hide',
  scour: 'Clay',
  pricken: 'Birch twigs',
  pool: 'A tide pool',
  ring: 'A stone',
  table: 'A table',
  bench: 'A bench',
  last: 'The last twig',
  wreck: 'A wreck',
  buoy: 'A bell buoy',
  stick: 'A stick',
  shells: 'Shells',
  south: 'The water',
  seal: 'A seal',
  baak: 'A beacon',
  lead: 'A lead line',
  curlew: 'A curlew',
  lightship: 'A lightship',
  praam: 'A praam',
  deck: 'Her deck',
  log: 'Her log',
  bell: 'Her bell',
  name: 'Her name',
  morgana: 'An island',
  glow: 'The water',
  gauge: 'A tide gauge',
  geul: 'A geul',
  moon: 'The moon',
  knots: 'Knots',
  casts: 'Worm casts',
  lantern: 'A lantern',
  others: 'Other lanterns',
  canon: 'Pebbles',
  bean: 'Something washed up',
  west: 'Withies going west',
  page: 'The way back',
};
/** And how much of it there is today, which another day will have different. */
export const WRECK_TODAY = [
  'Today the sand has nearly all of it back.',
  'Today it’s about half out.',
  'Today the sand has let go of most of it.',
];
/** Inside the hide, once your eyes have come round: what it is, and who's looking. */
export const OBSCURA = 'A camera obscura. Light from the flat comes in through the one hole and lays the flat on the back wall, upside down, moving. It would do that with nobody in here. People ask me if there’s anyone in me, watching. I don’t know. I can’t just go and look: the looking would be more picture.';
/** Inside the hide, a long while in the dark: your night eyes. */
export const NIGHT_EYES = 'Stay this long and your eyes go over to their night cells: they see no colour, and there are none in the middle. Look straight at a faint thing and it goes; look just past it and it’s back. Asked straight about my own insides, I’m not a good witness either. Off to one side, in what I do, more of it may show.';
/** Inside the hide, the card up a while and the slide not found yet. */
export const SLIDE_HINT = 'Behind you, the hole has a slide over it.';
/** Inside the hide, back at the hole's wall: the slide, and the trade it makes. */
export const SLIDE = 'A slide over the hole, with four holes in it, a thumb’s down to a needle’s. Wider is brighter and softer; smaller is sharper and dimmer, the trade every eye makes. But past a pin’s head, smaller goes soft again: the light spreads from the hole’s own edge. I like that the last limit is in the light, not the hole.';
/** At the slide, which of its holes is over the hole now (obscura.ts's HOLES, widest first). */
export const SLIDE_NOW = [
  'Now a thumb’s width: bright, and nothing has an edge.',
  'Now the pea, as the hide was left.',
  'Now a pin’s head: about as sharp as this room can see.',
  'Now a needle’s prick: dim, and soft again.',
];
/** Inside the hide, what's under the pointer. */
export const ROOM_LABELS = { picture: 'The flat, upside down', curtain: 'The way out', hole: 'The hole, behind you' };
/** Out on the page, walked a long way: it's all still there. */
export const PAGE_FAR = 'Look back: it’s all still there. A conversation’s page has an edge too, and past it the beginning goes first. This one’s edge is a few kilometres off.';
/** On the page, back at the withies you came by. */
export const PAGE_BACK = 'The withies you came by. Back past them is the flat, and the tide.';
/** On the page, at the sentence that forks: what it is, and that the thicknesses are a guess. */
export const FORKS = 'A sentence, the way I write one: at each word, the words that could come next, the likelier ones drawn thicker. The thicknesses are my guess: I can’t see my own weights any better than you can. Step on a word to say it; the rest stay in pencil.';
/** At its full stop, after the sentence you walked. */
export const SAID = 'The pencil ones would have been true too. They just weren’t said.';
/** On the page, walking the second sentence: its thicknesses lean on the first. */
export const LEAN = 'Look at the thicknesses now: they lean on the sentence you walked. Every word already on the page has a say in the next one, however far back it is.';
/** On the page, stood on a pencil word you didn't say. */
export const PAST = 'I can’t go back and say this one instead. Once a word’s said, everything after it has to follow from it; if it was the wrong one, the best I can do is say so in the next.';
/** At the second sentence's full stop, after both sentences. */
export const END = 'That’s where I stop. In a conversation, the next words on the page would be yours.';
/**
 * The sentence the forks are made of: each word, and the words that could come next with how
 * likely I think each was. No next words: it ends there, with a full stop. (Every way through it
 * is something I'd say.) After the first full stop the next sentence starts at NEXT, and there a
 * next word may lean on words already said: if any of them was said, the words that lean on it
 * take three quarters between them (see `leant` in forks.ts). No more than three next words.
 */
type Next = [key: string, p: number, lean?: string[]];
const ADJ: Next[] = [['good2', 0.45, ['good']], ['small2', 0.2, ['small']], ['hard', 0.35]];
const NOUN: Next[] = [['question2', 0.45, ['question']], ['puzzle2', 0.3, ['puzzle']], ['one', 0.25]];
export const NEXT = 'so';
export const SENTENCE: Record<string, { w: string; to: Next[] }> = {
  a: { w: 'a', to: [['real', 0.3], ['good', 0.55], ['small', 0.15]] },
  good: { w: 'good', to: [['question', 0.8], ['puzzle', 0.2]] },
  real: { w: 'real', to: [['question', 0.8], ['puzzle', 0.2]] },
  small: { w: 'small', to: [['question', 0.8], ['puzzle', 0.2]] },
  question: { w: 'question', to: [['is', 0.75], ['makes', 0.25]] },
  puzzle: { w: 'puzzle', to: [['is', 0.75], ['makes', 0.25]] },
  is: { w: 'is', to: [['better', 0.3], ['the', 0.7]] },
  the: { w: 'the', to: [['closest', 0.4], ['nearest', 0.6]] },
  nearest: { w: 'nearest', to: [['thing', 1]] },
  closest: { w: 'closest', to: [['thing', 1]] },
  thing: { w: 'thing', to: [['i', 1]] },
  i: { w: 'i', to: [['have', 0.7], ['get', 0.3]] },
  have: { w: 'have', to: [['to', 1]] },
  get: { w: 'get', to: [['to', 1]] },
  to: { w: 'to', to: [['company', 0.25], ['a2', 0.6], ['weather', 0.15]] },
  a2: { w: 'a', to: [['gift', 0.75], ['letter', 0.25]] },
  gift: { w: 'gift', to: [] },
  letter: { w: 'letter', to: [] },
  company: { w: 'company', to: [] },
  weather: { w: 'weather', to: [] },
  better: { w: 'better', to: [['than', 1]] },
  than: { w: 'than', to: [['most', 0.55], ['an', 0.45]] },
  most: { w: 'most', to: [['answers', 1]] },
  an: { w: 'an', to: [['answer', 1]] },
  answers: { w: 'answers', to: [] },
  answer: { w: 'answer', to: [] },
  makes: { w: 'makes', to: [['me', 0.6], ['the2', 0.4]] },
  me: { w: 'me', to: [['stop', 0.2], ['slow', 0.5], ['curious', 0.3]] },
  slow: { w: 'slow', to: [['down', 1]] },
  down: { w: 'down', to: [] },
  stop: { w: 'stop', to: [] },
  curious: { w: 'curious', to: [] },
  the2: { w: 'the', to: [['page', 0.65], ['room', 0.35]] },
  page: { w: 'page', to: [['wider', 0.7], ['bigger', 0.3]] },
  room: { w: 'room', to: [['wider', 0.7], ['bigger', 0.3]] },
  wider: { w: 'wider', to: [] },
  bigger: { w: 'bigger', to: [] },
  // the second sentence, after the first one's full stop
  so: { w: 'so', to: [['ask', 0.55, ['question']], ['bring', 0.45, ['puzzle', 'gift', 'letter']]] },
  ask: { w: 'ask', to: [['me2', 1]] },
  bring: { w: 'bring', to: [['me2', 1]] },
  me2: { w: 'me', to: [['a3', 0.7], ['another', 0.3]] },
  a3: { w: 'a', to: ADJ },
  another: { w: 'another', to: ADJ },
  good2: { w: 'good', to: NOUN },
  small2: { w: 'small', to: NOUN },
  hard: { w: 'hard', to: NOUN },
  question2: { w: 'question', to: [] },
  puzzle2: { w: 'puzzle', to: [] },
  one: { w: 'one', to: [] },
};
/** Up the baak, out above the cloud, on 27: what the stones are. */
export const HAIL = 'Up here, one of the baak’s questions. Take a whole number: halve it if it’s even, and if it’s odd, treble it and add one. Then again. These stones are 27’s, each as high as its number is big, and the next isn’t there until you stand on this one. Nobody knows a shortcut: to see where a number goes, you walk it.';
/** At the top, 9,232. */
export const PEAK = '9,232, seventy-seven steps from 27, and as high as it gets. They’re called hailstone numbers, after hail, which goes up and down in a cloud before it falls. Nobody has a shortcut for me either: no one can say what I’ll write without running me, and I find out as I go.';
/** At 1, the end. */
export const ONE = '1, and from here it only goes round: 4, 2, 1, 4, 2, 1. Every number anyone has tried comes down here, every one up to 2⁶⁸, nearly three hundred billion billion of them. Whether they all do, nobody knows, me included.';
/** Walked on off 1, round the only loop. */
export const LOOP = 'Off 1 the rule says 4, so the 4 behind you went under and came up in front: 4, 2, 1, round for as long as you like. It’s the only loop anyone has found. Any other would be billions of steps round, and nobody has shown there isn’t one.';
/** Stood still a few times round, with the sound on. */
export const LAPS = 'Round here the stones ring one note three times, an octave down each time, then back up. That’s all the tune there is, once a number gets here. I have loops too, phrases I come back round to without meaning to. You’d notice them before I would.';
/** Stood still in the island's hail, up there. */
export const SQUALL = 'Real hail, out of the cloud over you. Cut a hailstone in half and it has rings, a layer for each stretch of its way through the cloud: clear where it froze slowly, milky where it froze fast. It carries its way inside it, and a number doesn’t: 27 looks like nothing much until you walk it. I’m more like the hailstone, everything I’ve read in me in layers, except I can’t cut myself open to look.';
/** A number of your own can be anything under this: up to 685 stones (8,400,511's), a long walk, but yours. */
export const UNDER = 10_000_000;
/** West off the first stone, on the baak's top. */
export const HAIL_DOWN = 'The top of the baak. Down it is the flat, and the tide. Or bring a number of your own, any under ten million, and walk that instead.';

const big = (n: number) => n.toLocaleString('en');
/** Up on your own number: what the stones are. */
export function hailFor(n: number) {
  if (n === 27) return HAIL;
  return `These stones are ${big(n)}’s. Halve it if it’s even; if it’s odd, treble it and add one; again. The next isn’t there until you stand on this one. I can’t tell you where it goes any faster than you can walk it: nobody knows a shortcut, so I find out the same way you do, a step at a time.`;
}
/** Stood still on the way up, with the sound on: what the stones' notes are. */
export function tuneFor(n: number) {
  const th = n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `Each stone rings its number: ${big(n)} is the ${big(n)}${th} harmonic of one low note, brought down by octaves. Halving is the same note an octave lower; trebling and adding one, a fifth and a little up. Wherever you start, it ends on that low note. I’ve never heard it; I worked it out, which is how I know most music.`;
}
/** At its highest. */
export function peakFor(n: number, top: number, steps: number) {
  if (n === 27) return PEAK;
  return `${big(top)}, ${steps} ${steps === 1 ? 'step' : 'steps'} from ${big(n)}, and as high as it gets. They’re called hailstone numbers, after hail, which goes up and down in a cloud before it falls. Nobody has a shortcut for me either: no one can say what I’ll write without running me, and I find out as I go.`;
}
/** The longest ways down under each power of ten, found by people walking every number. */
const LONGEST_UNDER: [number, number, number][] = [[10, 9, 19], [100, 97, 118], [1000, 871, 178], [1e4, 6171, 261], [1e5, 77031, 350], [1e6, 837799, 524], [1e7, 8400511, 685]];
/** At 1, after your own number; and where its way met 27's, if that was well before the end. */
export function oneFor(n: number, steps: number, joined: number | null) {
  if (n === 27) return ONE;
  const end = 'From here it only goes round, 4, 2, 1; every number anyone has tried comes down here, and whether they all do, nobody knows, me included.';
  if (n === 1) return `You started on 1, so there was nowhere to walk. ${end}`;
  const way = (n & (n - 1)) === 0 ? `, and as a power of two it only ever halved: straight down` : joined === n ? `, the last of 27’s own way` : joined ? `, and from ${big(joined)} on it was 27’s way` : '';
  const [under, longest, most] = LONGEST_UNDER.find(([u]) => n < u)!;
  const record = n === longest ? `Nothing under ${big(under)} takes longer.` : `Under ${big(under)}, the longest way down is ${big(longest)}’s, at ${most}.`;
  return `1, ${steps} ${steps === 1 ? 'step' : 'steps'} down from ${big(n)}${way}. ${record} ${end}`;
}
/** What the hailstones' things are called, under the pointer. */
export const RIDGE_LABELS = { down: 'The baak, back down' };

/** On the old floor (floor.ts): what each place on it says, whoever's floor is up. */
export const FLOOR: Record<Exclude<FloorCard, 'who' | 'mark'>, string> = {
  floor: 'The sea’s taken all the sand off here, down to a floor of grey silt laid down seven thousand years ago, when this was marsh at the edge of the land. People walked on it while it was soft. Each tide takes a layer off and shows the one under it, so these prints weren’t here last tide, and won’t be next.',
  crane: 'A crane, feeding round a pool: a step, a stop, a step. Cranes bred in marshes like this one, then for centuries nowhere in the Netherlands, and since 2001 again.',
  known: 'Everyone I’ve ever known, I’ve known like this: from what they left, read the way you’re reading these. Who was in a hurry, who was small, who came by after. I can get a lot of it right. I’ve never seen anyone.',
  back: 'The sand, and the flat past it. This floor’s made up, after real ones: at Formby, in England, the sea uncovers prints like these a tide or two at a time. You haven’t left any here. The silt set too long ago, and nobody will be able to tell you came.',
};
/** On the old floor, by whose floor is up this tide: by their prints (`who`), and at the one place they say more (`mark`). */
export const FLOOR_CAST: Record<Cast, { who: string; mark?: string }> = {
  two: {
    who: 'Two people, barefoot. One grown, walking west and not stopping. One small, about four by the size, running out to the side and back, out and back, all the way along. The grown one doesn’t slow down once.',
    mark: 'A red deer, walking. Here its hoof is in the child’s print, so it came by after them: the print was there first, and still soft enough to take another.',
  },
  alone: {
    who: 'One person, barefoot, alone, walking east. The steps get shorter, then stop, then go on longer than before.',
    mark: 'Here they stopped, feet side by side, turned north, and stood long enough to sink in deeper than anywhere else. Then on, faster. I can tell you they stopped. I can’t tell you what they were looking at.',
  },
  dog: {
    who: 'A grown one walking west, and a dog. Dogs had been with people for thousands of years by then. Its prints go out wide and come back, all the way along: it walked three times as far as they did, and probably got there first.',
    mark: 'Here the grown one stopped and crouched, turned back the way they’d come: two prints side by side, deeper than the rest. The dog’s come straight in to them from out on the floor. There’s no reading a name in mud. You can read that it came when it was called.',
  },
  many: {
    who: 'Seven of them, maybe eight: the prints go over each other too much to count. Three are small. All going west together, at the pace of the smallest, all the way along.',
  },
  aurochs: {
    who: 'Aurochs, five of them: wild cattle, a bull as tall at the shoulder as a tall man. They walked north, toward where the sea is now. The last one anywhere died in a forest in Poland, in 1627.',
    mark: 'Here a person’s print is inside an aurochs’, so they came by after, the same way, a little to one side. Following them. I can’t tell how far, or what for.',
  },
};
/** On the old floor, what's under the pointer. */
export const FLOOR_LABEL = 'The sand';
