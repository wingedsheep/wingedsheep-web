/**
 * The island's recorded sound effects, generated with ElevenLabs' text-to-sound and levelled with
 * ffmpeg into public/audio/sfx/. Only missing files are generated (each costs credits), so
 * delete a file, or pass its name, to make it again:
 *
 *   just sounds            # whatever is missing
 *   just sounds stroke-2   # just that one, again
 *
 * The key is read from config.yaml (elevenlabs.apiKey), which stays out of git. The raw
 * generations are kept in tools/sounds/raw/ so re-levelling never costs a second call.
 *
 * Beds (loop: true) are the ambience that runs under everything: stereo, levelled to BED_LUFS.
 * Music (music: true) is composed with ElevenLabs' music model instead: stereo and whole, levelled to
 * MUSIC_LUFS. The rest are one-shots: mono, the silence before them trimmed, levelled to SHOT_LUFS.
 * The game turns them up and down from there (src/island/sound.ts).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Sfx {
  name: string;
  prompt: string;
  seconds: number;
  loop?: boolean;
  /** A piece of music, composed rather than generated as a sound. */
  music?: boolean;
  /** Its own loudness target, for something mostly transients (a fire's crackle) that would only be squashed. */
  lufs?: number;
}

const BED_LUFS = -24;
const SHOT_LUFS = -18;
const MUSIC_LUFS = -20;

export const SOUNDS: Sfx[] = [
  // --- beds -------------------------------------------------------------------------------
  { name: 'sea', loop: true, seconds: 16, prompt: 'Gentle ocean waves washing onto a sandy beach, soft surf rolling in and drawing back over pebbles, calm evening, no wind, no birds, no music' },
  { name: 'fire', loop: true, seconds: 10, lufs: -33, prompt: 'Small campfire crackling outdoors, dry wood popping and snapping softly, close up, no voices, no wind, no music' },
  { name: 'rain', loop: true, seconds: 10, prompt: 'Steady rain falling on grass and leaves outdoors, even and constant, no thunder, no music' },
  { name: 'wind', loop: true, seconds: 12, prompt: 'Wind gusting over an open grassy coastal hilltop, soft whooshing gusts rising and falling, no rain, no birds, no music' },
  { name: 'cicadas', loop: true, seconds: 8, prompt: 'Cicadas buzzing on a hot summer afternoon in the Mediterranean countryside, constant chorus, no birds, no music' },
  { name: 'river-calm', loop: true, seconds: 12, prompt: 'A gentle river flowing past, water babbling and gurgling softly over small stones, close up, no birds, no music' },
  { name: 'river-white', loop: true, seconds: 12, prompt: 'Fast mountain river rapids, whitewater rushing and churning over rocks, close up, constant, no birds, no music' },
  { name: 'falls', loop: true, seconds: 10, prompt: 'Powerful waterfall roaring, heavy water crashing down into a deep pool, dense rumbling roar, constant, no music' },
  { name: 'crickets', loop: true, seconds: 10, prompt: 'Field crickets chirping on a warm summer night in a meadow, a steady gentle chorus, a little distant, no frogs, no birds, no wind, no music' },
  { name: 'birdsong', loop: true, seconds: 20, prompt: 'Songbirds singing in a quiet meadow with scattered trees on a spring morning, robins, blackbirds and wrens, sparse and relaxed, a little distant, no water, no wind, no music' },

  { name: 'hail', loop: true, seconds: 10, prompt: 'Hailstones clattering and bouncing on a wooden roof and a window pane, a hard rattling patter, constant, no thunder, no music' },
  { name: 'leaves', loop: true, seconds: 12, prompt: 'Wind rustling through the leaves of broadleaf trees in a small wood, soft shimmering rustle swelling and easing, no birds, no music' },
  // the rooms
  { name: 'simmer', loop: true, seconds: 10, prompt: 'A pot of soup simmering on a wood stove in a cabin, gentle bubbling and the stove ticking as it heats, quiet, no voices, no music' },
  { name: 'typing', loop: true, seconds: 8, prompt: 'Someone typing on a mechanical keyboard at a desk, steady bursts of typing with short pauses, close, no voices, no music' },
  { name: 'clockwork', loop: true, seconds: 8, prompt: 'An old brass clockwork mechanism slowly turning, steady heavy ticking and soft ratcheting gears, in a small stone room, no music' },
  { name: 'workshop', loop: true, seconds: 12, prompt: 'A tinkerer\'s workshop full of small machines running, a steady electric hum, clockwork gears ticking and little motors whirring now and then, close, no voices, no music' },
  { name: 'drips', loop: true, seconds: 12, prompt: 'After the rain has stopped: water dripping slowly from leaves and roof eaves onto wet ground and puddles, sparse irregular drips, quiet, no rain, no music' },
  { name: 'flag', loop: true, seconds: 8, prompt: 'A small cloth flag flapping and snapping in a strong wind on a mountain summit, no voices, no music' },
  // the workshop's exhibits and its robot, and the hut
  { name: 'press', seconds: 1.5, prompt: 'A small hand-cranked printing press pressing down once, a wooden creak and a firm clunk' },
  { name: 'engine', loop: true, seconds: 5, prompt: 'A small lunar lander rocket engine burning steadily, a constant roaring hiss with a low rumble, no music' },
  { name: 'quill', seconds: 3, prompt: 'A quill pen scratching across parchment, writing a line of words, close up, quiet room' },
  { name: 'page', seconds: 1.5, prompt: 'A single page of a big old book being turned over, a crisp papery flip, close up' },
  { name: 'zap', seconds: 1.5, prompt: 'Small electric sparks crackling along a wire, a quick bright fizzy zap, quiet' },
  { name: 'robot-servo', seconds: 1.5, prompt: 'A small clumsy toy robot starting to walk, whirring servo motors and a couple of clanky metal footsteps' },
  { name: 'robot-tinker', seconds: 2.5, prompt: 'A small robot tinkering with a machine, a wrench ratcheting and little metallic clinks and taps' },
  { name: 'robot-snore', seconds: 3, prompt: 'A tiny robot asleep and charging, a soft electronic snore, a low buzzing hum rising and falling, cute' },
  { name: 'robot-clank', seconds: 1.5, prompt: 'A small tin robot falling flat on its face on a wooden floor, a clattering metallic clank' },
  { name: 'robot-beep', seconds: 1, prompt: 'A cute little robot beeping a happy greeting, three short cheerful bleeps' },
  { name: 'crunch', seconds: 4, prompt: 'Close-up recording of a cat eating dry kibble from a ceramic bowl: fast crisp crunching, soft wet lip smacking, little biscuits scraping and clicking against the bowl, a tiny pause and then more crunching, no purring, no meowing, no voices, no music' },
  { name: 'grind', seconds: 4, prompt: 'An automatic espresso machine grinding coffee beans, a loud whirring grinder crunching through beans, close up, no voices, no music' },
  { name: 'brew', seconds: 11, prompt: 'An espresso machine brewing a coffee, a pump humming, hot water and coffee running steadily into a ceramic cup with a little steam hiss, close up, no voices, no music' },
  { name: 'sip', seconds: 2, prompt: 'Someone slowly sipping hot coffee from a ceramic mug, a quiet slurp, a small swallow and a soft satisfied breath out, close up, no voices, no music' },
  { name: 'ding', seconds: 1.5, prompt: 'A mechanical kitchen oven timer ringing once, a single bright ding' },
  { name: 'snore', seconds: 3, prompt: 'Someone gently snoring in their sleep, one soft slow breath in and a quiet snore out, close, peaceful' },
  // the career dioramas: one place each, and the things in them (career.ts `sound`)
  { name: 'dio-student', loop: true, seconds: 15, prompt: 'A Dutch university campus outdoors on a spring day, students chatting in the distance, bicycles rattling past on a bike path, a bike bell far off, a few birds, no music' },
  { name: 'dio-backbone', loop: true, seconds: 15, prompt: 'The Dutch countryside by an old country house on a quiet afternoon, birds in the trees, a light breeze, distant traffic on a country road, no music' },
  { name: 'dio-entrnce', loop: true, seconds: 15, prompt: 'A breezy sunny meadow with a large wind turbine nearby, its blades slowly whooshing round, sheep far off, a faint electrical hum, no music' },
  { name: 'bike-bell', seconds: 1, prompt: 'A Dutch bicycle bell ringing twice, a bright ring-ring' },
  { name: 'castle-clock', seconds: 4, prompt: 'An old clock in the gable of a country house striking, three slow mellow bell chimes' },
  { name: 'bus-doors', seconds: 2, prompt: 'A city bus pulling up at a stop, brakes sighing and the doors opening with a pneumatic hiss' },
  { name: 'bus-go', seconds: 3, prompt: 'A diesel bus doors closing with a hiss, then the engine revving as it pulls away from the stop' },
  { name: 'truck-horn', seconds: 1.5, prompt: 'A lorry giving a short friendly double toot of its horn' },
  { name: 'car-door', seconds: 1, prompt: 'A car door opening and shutting with a solid thunk' },
  { name: 'turbine', seconds: 4, prompt: 'Standing right under a wind turbine, the huge blades sweeping past with a deep rhythmic whoosh' },
  { name: 'cheers', seconds: 6, prompt: 'Busy crowded mountain hut restaurant, many people talking at once, a constant lively warm murmur of German conversation filling the room, glasses clinking now and then in the background, cosy walla crowd ambience' },
  { name: 'cowbells', seconds: 4, prompt: 'Alpine cowbells clonking gently on a mountain pasture, a few cows moving about, far off' },
  { name: 'transformer', seconds: 2, prompt: 'A full electrical transformer humming loudly, a low buzzing mains drone with a crackle' },
  // the telly in the lighthouse, one bed per programme she might have on (companion.ts SHOWS)
  { name: 'tv-murder', loop: true, seconds: 15, prompt: 'A British TV murder mystery drama playing on a television, tense low strings and a ticking clock under muffled, indistinct voices of a detective questioning a suspect, quiet' },
  { name: 'tv-location', loop: true, seconds: 15, prompt: 'A cheerful British property TV show playing on a television, an upbeat presenter and a couple chatting indistinctly while walking round a house, footsteps, light jaunty background music' },
  { name: 'tv-bnb', loop: true, seconds: 15, prompt: 'A reality dating show playing on a television, people chatting and laughing indistinctly round a breakfast table outdoors in Provence, cutlery clinking, cicadas, light romantic accordion music' },
  { name: 'tv-rail', loop: true, seconds: 15, prompt: 'A train travel documentary playing on a television, the steady clatter of a train rolling along the rails, a calm narrator murmuring indistinctly now and then, gentle soft music' },

  // --- the river ----------------------------------------------------------------------------
  ...[1, 2, 3].map((i) => ({ name: `stroke-${i}`, seconds: 1, prompt: 'A single kayak paddle stroke, the blade dipping in and pulling through the water, a clean swish and drip, close up, no music' })),
  ...[1, 2].map((i) => ({ name: `hit-${i}`, seconds: 1, prompt: 'A plastic kayak hull slamming into a rock in a river, a hollow thud with a splash of water, no voice' })),
  { name: 'bump', seconds: 1, prompt: 'A plastic kayak hull bumping and scraping lightly along a rock in a river, short, no voice' },
  { name: 'splash', seconds: 1.5, prompt: 'A big splash of water, something heavy dropping into a river, no voice' },
  { name: 'capsize', seconds: 3, prompt: 'A kayak flipping over into a river, a big splash then muffled underwater bubbling, no voice' },
  { name: 'roll', seconds: 1.5, prompt: 'A kayaker rolling back up out of the water, water pouring off the boat and a sharp gasp for breath' },
  { name: 'brace', seconds: 1, prompt: 'A kayak paddle blade slapped hard and flat onto the water surface, a sharp slap and spray' },
  { name: 'boof', seconds: 1, prompt: 'A kayak landing flat on the water after a drop, a fat heavy smack and a burst of spray' },
  { name: 'dropin', seconds: 2, prompt: 'A kayak plunging into whitewater rapids, a low surge of rushing water swelling up' },
  { name: 'hole', seconds: 2, prompt: 'Water churning and recirculating in a river hydraulic, a turbulent pouring roar' },
  { name: 'slap', seconds: 1.5, prompt: 'Loud close-up slap on the water: a flat paddle smacked hard onto a lake surface, a sharp crack then splashing' },
  // (the pack on the bank as you come by: close, one long clear howl first and the others joining in)
  { name: 'howl-1', seconds: 7, prompt: 'A grey wolf standing close by on a riverbank lifts its head and lets out one long, clear, rising howl, then two more wolves of the pack join in, a little off-key, in a quiet pine forest valley, a river faintly behind, no music' },
  { name: 'howl-2', seconds: 7, prompt: 'A wolf pack howling together close by in a dark pine forest beside a river: one deep lead howl swelling up, the others joining in higher and wavering, then fading into the trees, no music' },
  // (knee-deep in the rapids, up on its hind legs to see what you are: close, and it means it)
  { name: 'growl-1', seconds: 3.5, prompt: 'A huge brown grizzly bear rearing up close by in a river lets out one deep, thunderous, guttural roar, a rumbling growl swelling into a full-throated bellow, then a sharp huff, rushing water faintly behind, no music' },
  { name: 'growl-2', seconds: 3.5, prompt: 'A big angry brown bear standing up in shallow rapids roars at you from a few metres away, a low chesty growl rising into a loud rasping roar that tails off into snorts, whitewater in the background, no music' },
  { name: 'croak', seconds: 1, prompt: 'A single frog croaking by a pond, two ribbits, no other sounds' },
  ...[1, 2].map((i) => ({ name: `whoosh-${i}`, seconds: 1, prompt: 'A kayak rushing fast past a rock, a quick whoosh of water spray, no voice' })),
  { name: 'kingfisher', seconds: 1.5, prompt: 'A kingfisher calling as it flies fast and low over a river, a shrill piping whistle, a short quick series, no water sounds' },
  { name: 'otter', seconds: 1.5, prompt: 'A river otter chirping and squeaking, a few short high whistles, close, no other animals' },
  // (the bull in the shallows, head up out of the weed, and you've been noticed)
  { name: 'grunt-1', seconds: 3, prompt: 'A huge bull moose standing in a river close by gives a deep, hollow, croaking grunt, then a long nasal bellowing moan, oo-waaah, rich and resonant, water dripping, a quiet northern forest, no music' },
  { name: 'grunt-2', seconds: 3, prompt: 'A big bull moose calling across a still river in the wilderness, three deep throaty croaking grunts, heavy and resonant, a snort of breath after, no birds, no music' },
  // (up on the bank above you with its arms over its head: close enough to carry over the water, and off the cliffs after)
  { name: 'yeti-1', seconds: 5, prompt: 'A huge shaggy ape-like creature on a snowy mountainside close by throws back its head and lets out one deep booming whooping call, rising into a long wavering howl, then its echo rolling back off the cliffs, no music' },
  { name: 'yeti-2', seconds: 5, prompt: 'A giant unknown beast in snowy mountains nearby bellows twice, deep chesty whoops like a huge gorilla crossed with a wolf howl, and the sound echoes back off the rock walls of a gorge, no music' },

  // --- the island ---------------------------------------------------------------------------
  { name: 'gull', seconds: 2, prompt: 'A herring gull crying overhead at the seaside, three calls, no waves, no other birds' },
  { name: 'chirp', seconds: 2, prompt: 'A European robin singing one short bright song phrase, clean, no other birds' },
  { name: 'hoot', seconds: 3, prompt: 'A tawny owl hooting at night in a quiet wood, hoo, then hu-hu-hoooo, a little distant' },
  { name: 'quack', seconds: 1, prompt: 'A mallard duck quacking twice, close, no water sounds' },
  { name: 'honk', seconds: 3, prompt: 'A flock of geese honking as they fly past overhead' },
  { name: 'chatter', seconds: 1, prompt: 'A red squirrel chattering angrily in a tree, a quick scolding chatter' },
  { name: 'blow', seconds: 2, prompt: 'A humpback whale exhaling through its blowhole at the ocean surface, a powerful breathy spout' },
  { name: 'breach', seconds: 2.5, prompt: 'A whale crashing back down into the sea after breaching, a huge deep splash' },
  { name: 'roar', seconds: 3, prompt: 'A huge sea monster roaring out over the water, a deep rasping bellow that swells and dies away' },
  { name: 'purr', seconds: 3, prompt: 'A cat purring contentedly, close up, soft and steady' },
  { name: 'mew', seconds: 1, prompt: 'A cat giving one short, annoyed warning meow' },
  { name: 'heron', seconds: 2, prompt: 'A grey heron taking off with a harsh, loud croaking call, one rasping fraank, and a few heavy wingbeats' },
  { name: 'fox', seconds: 2, prompt: 'A red fox vixen screaming once at night in the countryside, an eerie high scream, distant, no other animals' },
  { name: 'bellow', seconds: 4, prompt: 'A red deer stag bellowing during the autumn rut, a deep roaring bellow, twice, across a misty glen' },
  { name: 'snuffle', seconds: 2, prompt: 'A hedgehog snuffling and snorting in dry leaves, small huffy sniffs, close up' },
  { name: 'plop', seconds: 1, prompt: 'A small fish jumping out of calm sea water and falling back in, a light splash and plop' },
  { name: 'ufo', seconds: 3, prompt: 'A small flying saucer warbling past overhead, a wobbly retro sci-fi theremin hum that swoops by' },
  { name: 'foghorn', seconds: 5, prompt: 'A lighthouse foghorn sounding one long deep blast across the sea in thick fog, echoing, then fading away' },
  { name: 'rocket', seconds: 2.5, prompt: 'A small cartoon rocket igniting and blasting off, a fizzing hiss and a rushing whoosh up into the sky' },
  { name: 'fizz', seconds: 3, prompt: 'A small rocket fizzing and sputtering as it flies past overhead, a crackling hiss with a doppler whoosh' },
  { name: 'whistle', seconds: 2, prompt: 'A falling bomb whistle, a cartoon descending whistle getting lower as it drops, no explosion' },
  ...[1, 2].map((i) => ({ name: `staff-${i}`, seconds: 0.6, prompt: 'A wooden walking staff tapping once on a stone path, a single dry knock' })),
  { name: 'tink', seconds: 1.5, prompt: 'Something tapping curiously on a metal box, a few quick light metallic tinks' },
  ...[1, 2].map((i) => ({ name: `bounce-${i}`, seconds: 0.5, prompt: 'A tennis ball bouncing once on firm ground, a clear hollow thud, close up' })),
  { name: 'pant', seconds: 2, prompt: 'A happy dog panting after running, quick breathy pants, close, no barking' },
  { name: 'whine', seconds: 1.5, prompt: 'A dog giving one short, eager, hopeful whine, asking to play' },
  { name: 'mrrp', seconds: 1, prompt: 'A sleepy cat giving one soft chirruping mrrp, a trilling little greeting, close' },
  // the pod passing: their calls now and then, and with every leap a breath as one breaks the surface and a splash going back in
  ...[
    'Bottlenose dolphins whistling to each other at the sea surface, bright rising and falling signature whistles, a little distant, no music',
    'Dolphins chattering at sea, rapid clicks and a buzzing creak with a short squeaky whistle, a little distant, no music',
    'A dolphin calling with a few short excited squeals and chirps at the surface of the sea, gentle waves, no music',
  ].map((prompt, i) => ({ name: `dolphin-${i + 1}`, seconds: 2, prompt })),
  ...[1, 2].map((i) => ({ name: `puff-${i}`, seconds: 0.6, prompt: 'A single dolphin breathing out through its blowhole as it breaks the surface, one short sharp wet puff of breath, no voice, no music' })),
  ...[1, 2].map((i) => ({ name: `dip-${i}`, seconds: 0.8, prompt: 'A dolphin diving cleanly back into the sea after a leap, a short smooth slicing splash, no voice, no music' })),
  // the rare sightings (src/island/scene/sightings.ts)
  { name: 'burner', seconds: 2.5, prompt: 'A hot air balloon burner firing overhead on a calm evening, a roaring whoosh of propane flame for two seconds, then cutting off, a little distant, no voices' },
  { name: 'horn', seconds: 4, prompt: 'A passenger ferry sounding its horn once far out at sea, one long deep blast carrying over calm water, distant, fading away' },
  { name: 'typhon', seconds: 7, prompt: 'A huge container ship sounding its great foghorn far out at sea, one very long, very low, booming blast that shakes the air, rolling across the water, then echoing away, distant, no music' },
  { name: 'murmur', seconds: 3, prompt: 'A huge flock of starlings wheeling overhead at dusk, a soft rushing whoosh of thousands of wings turning together, swelling and fading, faint chattering, no other birds' },
  { name: 'seal', seconds: 2, prompt: 'A harbour seal lying on a beach giving a low grumbling grunt and a snort, close, gentle surf behind' },
  { name: 'eagle', seconds: 2.5, prompt: 'A white-tailed eagle calling over a quiet river, a series of high yelping kyik kyik kyik calls falling in pitch, a little distant, no other birds, no water' },
  { name: 'boar', seconds: 2, prompt: 'A wild boar in a forest at the edge of a river, a sharp loud warning snort through the nose and then a low grunting grumble, close, no other animals, no music' },
  { name: 'moo', seconds: 3, prompt: 'A Highland cow standing in a quiet river meadow gives one long, deep, lowing moo, calm and unhurried, a little distant, gentle river behind, no other animals, no music' },
  { name: 'raven', seconds: 2, prompt: 'A common raven calling high over a mountain valley, deep croaking cronk cronk, echoing, no other birds' },
  // the snorbles (src/island/scene/imaginary.ts): small, fluffy, long-snouted, out in the sunny grass
  ...[1, 2].map((i) => ({ name: `sniff-${i}`, seconds: 1.5, prompt: 'A small furry animal with a long snout sniffing busily at the grass, quick soft snuffly sniffs through a little nose, close up, quiet meadow, no voices, no music' })),
  { name: 'snooze', seconds: 4, prompt: 'A small fluffy animal fast asleep in the sun, tiny soft whistling snores, slow and contented, very close and quiet, no voices, no music' },
  ...[1, 2].map((i) => ({ name: `squeak-${i}`, seconds: 1, prompt: 'A small startled furry animal giving one short surprised squeak as it leaps up into the air, with a soft whoosh, cute, close, no voices, no music' })),
  ...[1, 2].map((i) => ({ name: `chirrup-${i}`, seconds: 1, prompt: 'A baby furry animal giving a few tiny happy chirrups and peeps to its mother, soft and small, close, quiet meadow, no birds, no voices, no music' })),
  // the treestrider (src/island/scene/imaginary.ts): five metres of insect wading the bay
  { name: 'strider', seconds: 4, prompt: 'A cricket chirp slowed down eight times and pitched very low, so it sounds like an insect as big as a house: deep bassy rasping pulses of huge wooden wings scraping, slow and rhythmic, booming and resonant, out over a calm sea, no high hiss, no music, no voices, no birds' },
  ...[1, 2].map((i) => ({ name: `creak-${i}`, seconds: 1, prompt: 'The leg joint of an enormous insect bending, a slow deep creak and click of hard chitin shell, dry and woody, heavy, close, no water, no music' })),
  ...[1, 2].map((i) => ({ name: `wade-${i}`, seconds: 1.5, prompt: 'A giant thin insect leg plunging down into shallow calm sea water, a heavy deep slosh and splash, then water dripping, a little distant, no voices, no music' })),
  // the rooms' doors (door-*, bell, hatch) are made, not generated: tools/sounds/doors.py
  { name: 'bottle', seconds: 2.5, prompt: 'A cork pulled out of a glass bottle with a pop, then a rolled paper note shaken out and unrolled' },
  { name: 'clink', seconds: 1, prompt: 'A glass bottle bumping onto pebbles at the edge of the sea, a light clink and a wash of water' },
  { name: 'jump', seconds: 0.5, prompt: 'A single soft footstep landing on a thin exercise mat on grass, a quiet thump' },
  { name: 'flurry', seconds: 2, prompt: 'A seagull snatching food off a metal plate, a clatter of the plate and a flurry of big flapping wings taking off' },
  // the kitchen tap, left running for the cats: turned on, a thin stream (looped as long as it runs), turned off
  { name: 'tap', seconds: 1.5, prompt: 'A kitchen tap handle turned on with a small squeak, and a thin stream of water starting to patter into an empty steel sink, close, quiet kitchen, no voices' },
  { name: 'tap-run', loop: true, seconds: 8, prompt: 'A thin steady stream of water running from a kitchen tap into a stainless steel sink, a gentle constant trickle and patter, close, quiet kitchen, no voices, no music' },
  { name: 'tap-off', seconds: 1.2, prompt: 'A kitchen tap handle turned off, the thin stream of water stopping, a couple of last drips into a steel sink, close, quiet' },
  ...[1, 2].map((i) => ({ name: `lap-${i}`, seconds: 3, prompt: 'Close-up of a cat drinking from a thin stream of running tap water, quick rhythmic wet lapping of its tongue, soft and delicate, no meowing, no voices, no music' })),
  ...[1, 2].map((i) => ({ name: `thunder-${i}`, seconds: 6, prompt: 'Distant thunder rolling across the sky, a long low rumble fading away, no rain' })),
  { name: 'boom', seconds: 1.5, prompt: 'A single punchy explosion, a cartoonish boom with a puff of debris' },
  { name: 'firework', seconds: 3, prompt: 'A single firework rocket whistling up into the sky, a bang, then crackling sparkles falling' },

  // --- special days (src/island/scene/calendar.ts): loaded only on the day ------------------
  // New Year's Eve: the whole country letting off fireworks at midnight, far and near
  { name: 'fireworks', loop: true, seconds: 20, prompt: 'Distant fireworks going off all over a town at midnight on New Year, a constant patter of far-off bangs, pops and crackles echoing between houses, no voices, no music' },
  ...[1, 2].map((i) => ({ name: `fw-launch-${i}`, seconds: 1.5, prompt: 'A single firework rocket launching from the ground and whooshing up into the night sky, a fizzing hiss rising away, no explosion' })),
  ...[1, 2, 3].map((i) => ({ name: `fw-burst-${i}`, seconds: 2.5, prompt: 'A single firework shell bursting high in the sky some distance away, a deep thud of a bang echoing, then a soft crackle, outdoors at night, no voices' })),
  ...[1, 2].map((i) => ({ name: `fw-crackle-${i}`, seconds: 3, prompt: 'Firework crackling glitter stars popping and sizzling high in the air after a burst, a spray of tiny sharp crackles fading out, no bang' })),
  // --- music --------------------------------------------------------------------------------
  // the fair folk's tune (src/island/scene/revel.ts): long enough for the whole dance, which runs a minute and a half or so
  { name: 'revel', music: true, seconds: 120, prompt: 'Instrumental fairy reel for a revel of the fair folk in a moonlit glade at midnight. A light, skipping jig in 6/8 led by a tin whistle and a fiddle, with glassy celesta and little bells sparkling on top, a lilting harp, and a soft bodhrán keeping the dance going over a quiet drone. Bright, playful and enchanted, a little otherworldly, as if the tuning were not quite of this world. Traditional Celtic folk feel, acoustic and delicate, no vocals, no heavy drums, no electronic sounds.' },

  // the Halloween week and the Christmas weeks, all day: a quiet score under
  // everything, with a long rest between plays (sound.ts score())
  { name: 'halloween-tune', music: true, seconds: 150, prompt: 'Dark, eerie Halloween night soundscape, like the haunted graveyard scenes of a gothic stop-motion film score. Slow and creeping, in a minor key with crooked, dissonant harmony. A low drone of bowed double basses and a deep pipe organ breathing in and out, a wavering musical saw and a ghostly theremin sliding between notes, a cracked music box picking out a few sinister notes and then stopping, out-of-tune celesta, plucked pizzicato strings creeping like footsteps, a tolling bell far off, wind moaning through the gaps, the odd creak of a gate and a distant rattle of bones on a xylophone. Long dark silences in between, building to a quiet swell of unease and falling away again. Spooky, unsettling and atmospheric rather than loud, no jump scares, no vocals, no choir, no lyrics, no drums, no electronic beats.' },
  { name: 'christmas-tune', music: true, seconds: 150, prompt: 'Cheerful, cosy instrumental Christmas music, light and merry, like the soundtrack of a classic family Christmas film. A bright, bouncy melody on celesta and glockenspiel in a major key, jingling sleigh bells keeping a gentle trot, playful pizzicato strings, a warm swinging upright bass, a soft clarinet and flute answering each other, a little twinkling piano. Happy, festive and twinkly, like snow falling on a lit-up village, smiling but not loud. Light and airy, background music, no vocals, no choir, no lyrics, no drum kit, no electronic sounds.' },
  // and dressed up for it (scene/wardrobe.ts): Vincent as a vampire, Eef as a witch, when you click them
  ...[1, 2].map((i) => ({ name: `cackle-${i}`, seconds: 2.5, prompt: 'A witch giving a short, gleeful, theatrical cackle, a high crackly hee-hee-hee-hee rising and falling, playful rather than scary, close, dry, no music, no other sounds' })),
  ...[1, 2].map((i) => ({ name: `vampire-${i}`, seconds: 2.5, prompt: 'A man playing a vampire at a costume party giving a deep, hammy, theatrical mwa-ha-ha-ha laugh, rich and drawn out, playful rather than scary, close, dry, no music, no other sounds' })),
  // and its graveyard (tools/models/holidays.py): the dead, the ghost, the bats, a spider
  ...[1, 2].map((i) => ({ name: `groan-${i}`, seconds: 2.5, prompt: 'A zombie giving one slow, low, drawn-out groan, hoarse and gravelly, a cartoonish Halloween zombie rather than gory, close, dry, no music, no other sounds' })),
  { name: 'moan', seconds: 3, prompt: 'A friendly cartoon ghost giving a long, wavering, hollow wooooo, rising and falling, airy and echoing, spooky but gentle, no music, no other sounds' },
  { name: 'bats', seconds: 2.5, prompt: 'A few small bats flittering past at night, quick high squeaks and the soft flutter of leathery wings, close, no music, no other sounds' },
  { name: 'skitter', seconds: 1.5, prompt: 'A large spider skittering quickly over dry leaves and wood, many tiny fast leg taps, close, quiet, no music, no other sounds' },
  // and its monsters (src/island/scene/monsters.ts): the Headless Horseman, and the tall one from the woods
  { name: 'neigh', seconds: 2, prompt: 'A black stallion rearing up and giving one wild, shrill, frightened neigh at night, close, no music, no other sounds' },
  { name: 'gallop', seconds: 4, prompt: 'A single horse galloping hard along a sandy beach at night, heavy fast hoofbeats thudding on wet sand and its harness jingling, passing close by, no music, no voices' },
  { name: 'headless', seconds: 3, prompt: 'A ghostly horseman giving a deep, echoing, sinister laugh that rings out across the dark, theatrical and spooky, with a cold hollow reverb, no music, no other sounds' },
  { name: 'giant', seconds: 4, prompt: 'Something enormous breathing slowly in a dark forest at night, a long deep rattling inhale and exhale like wind through a hollow tree, with old wood creaking, eerie and low, no music, no voices' },
  ...[1, 2].map((i) => ({ name: `stomp-${i}`, seconds: 1, prompt: 'One slow heavy footstep of a giant creature on a forest floor, a deep muffled thud with twigs snapping under it, no music, no other sounds' })),
  ...[1, 2].map((i) => ({ name: `wail-${i}`, seconds: 4, prompt: 'A long, eerie, inhuman wail rising out of a dark forest at night, a hollow wavering cry somewhere between a moan and a distant scream, drawn out and echoing between the trees, unsettling, heard from a little way off, no music, no voices, no words' })),

  // Sinterklaas: his steamboat at the dock, sounding its whistle
  { name: 'steam-whistle', seconds: 3, prompt: 'An old steamboat sounding its steam whistle twice at a harbour, a warm hooting toot toot, with a hiss of steam after, no voices, no music' },
];

const ROOT = process.cwd(); // just runs recipes from the repo root
const RAW = join(ROOT, 'tools/sounds/raw');
const OUT = join(ROOT, 'public/audio/sfx');

function apiKey(): string {
  const yaml = readFileSync(join(ROOT, 'config.yaml'), 'utf8');
  const key = yaml.match(/apiKey:\s*["']?([^"'\s]+)/)?.[1];
  if (!key) throw new Error('no elevenlabs.apiKey in config.yaml');
  return key;
}

async function generate(s: Sfx, key: string): Promise<Buffer> {
  if (s.music) return compose(s, key);
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: s.prompt,
      duration_seconds: s.seconds,
      prompt_influence: 0.5,
      model_id: 'eleven_text_to_sound_v2',
      ...(s.loop ? { loop: true } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${s.name}: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function compose(s: Sfx, key: string): Promise<Buffer> {
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: s.prompt, music_length_ms: s.seconds * 1000, model_id: 'music_v2_5', force_instrumental: true }),
  });
  if (!res.ok) throw new Error(`${s.name}: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Level and encode: beds stereo and whole, one-shots mono with the silence around them trimmed.
 * One fixed gain per file (measured first), then a limiter to catch the peaks: a loudness
 * normaliser that rides the level would pump, and put a jump in a bed where it loops.
 */
function level(s: Sfx, raw: string, out: string) {
  const whole = s.loop || s.music;
  const trim = whole ? [] : ['silenceremove=start_periods=1:start_threshold=-50dB', 'areverse', 'silenceremove=start_periods=1:start_threshold=-60dB', 'areverse'];
  const mix = ['-ar', '44100', '-ac', whole ? '2' : '1'];
  // ebur128 prints its summary to stderr; the integrated loudness is the last "I:" in it
  const report = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', raw, '-af', [...trim, 'ebur128'].join(','), ...mix, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const lufs = Number([...report.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1]);
  if (!Number.isFinite(lufs)) throw new Error(`${s.name}: couldn't measure its loudness`);
  const gain = (s.lufs ?? (s.music ? MUSIC_LUFS : s.loop ? BED_LUFS : SHOT_LUFS)) - lufs;
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', raw,
    '-af', [...trim, `volume=${gain.toFixed(2)}dB`, `alimiter=limit=0.7:attack=2:release=60:level=false`].join(','),
    ...mix,
    '-codec:a', 'libmp3lame', '-b:a', s.music ? '128k' : s.loop ? '112k' : '64k',
    out,
  ]);
}

async function main() {
  const only = process.argv.slice(2);
  mkdirSync(RAW, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const key = apiKey();
  for (const s of SOUNDS) {
    const raw = join(RAW, `${s.name}.mp3`);
    const out = join(OUT, `${s.name}.mp3`);
    const redo = only.includes(s.name);
    if (only.length && !redo) continue;
    if (redo || !existsSync(raw)) {
      process.stdout.write(`generating ${s.name} (${s.seconds}s)… `);
      writeFileSync(raw, await generate(s, key));
      console.log('ok');
    }
    if (redo || !existsSync(out)) level(s, raw, out);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
