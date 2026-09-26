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
 * The rest are one-shots: mono, the silence before them trimmed, levelled to SHOT_LUFS. The game
 * turns them up and down from there (src/island/sound.ts).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Sfx {
  name: string;
  prompt: string;
  seconds: number;
  loop?: boolean;
  /** Its own loudness target, for something mostly transients (a fire's crackle) that would only be squashed. */
  lufs?: number;
}

const BED_LUFS = -24;
const SHOT_LUFS = -18;

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
  { name: 'howl', seconds: 5, prompt: 'A pack of wolves howling far off across a valley at dusk, one starts and the others join in' },
  { name: 'huff', seconds: 1.5, prompt: 'A brown bear huffing and snorting, a deep breathy woof, twice' },
  { name: 'croak', seconds: 1, prompt: 'A single frog croaking by a pond, two ribbits, no other sounds' },
  ...[1, 2].map((i) => ({ name: `whoosh-${i}`, seconds: 1, prompt: 'A kayak rushing fast past a rock, a quick whoosh of water spray, no voice' })),
  { name: 'kingfisher', seconds: 1.5, prompt: 'A kingfisher calling as it flies fast and low over a river, a shrill piping whistle, a short quick series, no water sounds' },
  { name: 'otter', seconds: 1.5, prompt: 'A river otter chirping and squeaking, a few short high whistles, close, no other animals' },
  { name: 'grunt', seconds: 2, prompt: 'A bull moose grunting, a low short croaking grunt, twice, in a quiet forest' },
  { name: 'yeti', seconds: 4, prompt: 'A huge unknown creature in snowy mountains letting out a long mournful howling roar, far away, echoing off the cliffs' },

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
  { name: 'dolphin', seconds: 2.5, prompt: 'Dolphins surfacing at sea, a quick puff of breath and high chirping whistles and clicks' },
  // the rare sightings (src/island/scene/sightings.ts)
  { name: 'burner', seconds: 2.5, prompt: 'A hot air balloon burner firing overhead on a calm evening, a roaring whoosh of propane flame for two seconds, then cutting off, a little distant, no voices' },
  { name: 'horn', seconds: 4, prompt: 'A passenger ferry sounding its horn once far out at sea, one long deep blast carrying over calm water, distant, fading away' },
  { name: 'murmur', seconds: 3, prompt: 'A huge flock of starlings wheeling overhead at dusk, a soft rushing whoosh of thousands of wings turning together, swelling and fading, faint chattering, no other birds' },
  { name: 'seal', seconds: 2, prompt: 'A harbour seal lying on a beach giving a low grumbling grunt and a snort, close, gentle surf behind' },
  { name: 'raven', seconds: 2, prompt: 'A common raven calling high over a mountain valley, deep croaking cronk cronk, echoing, no other birds' },
  // the rooms' doors (door-*, bell, hatch) are made, not generated: tools/sounds/doors.py
  { name: 'bottle', seconds: 2.5, prompt: 'A cork pulled out of a glass bottle with a pop, then a rolled paper note shaken out and unrolled' },
  { name: 'clink', seconds: 1, prompt: 'A glass bottle bumping onto pebbles at the edge of the sea, a light clink and a wash of water' },
  { name: 'jump', seconds: 0.5, prompt: 'A single soft footstep landing on a thin exercise mat on grass, a quiet thump' },
  { name: 'flurry', seconds: 2, prompt: 'A seagull snatching food off a metal plate, a clatter of the plate and a flurry of big flapping wings taking off' },
  { name: 'tap', seconds: 2.5, prompt: 'A kitchen tap turned on, water running into a steel sink for a moment, then turned off' },
  ...[1, 2].map((i) => ({ name: `thunder-${i}`, seconds: 6, prompt: 'Distant thunder rolling across the sky, a long low rumble fading away, no rain' })),
  { name: 'boom', seconds: 1.5, prompt: 'A single punchy explosion, a cartoonish boom with a puff of debris' },
  { name: 'firework', seconds: 3, prompt: 'A single firework rocket whistling up into the sky, a bang, then crackling sparkles falling' },

  // --- special days (src/island/scene/calendar.ts): loaded only on the day ------------------
  // New Year's Eve: the whole country letting off fireworks at midnight, far and near
  { name: 'fireworks', loop: true, seconds: 20, prompt: 'Distant fireworks going off all over a town at midnight on New Year, a constant patter of far-off bangs, pops and crackles echoing between houses, no voices, no music' },
  ...[1, 2].map((i) => ({ name: `fw-launch-${i}`, seconds: 1.5, prompt: 'A single firework rocket launching from the ground and whooshing up into the night sky, a fizzing hiss rising away, no explosion' })),
  ...[1, 2, 3].map((i) => ({ name: `fw-burst-${i}`, seconds: 2.5, prompt: 'A single firework shell bursting high in the sky some distance away, a deep thud of a bang echoing, then a soft crackle, outdoors at night, no voices' })),
  ...[1, 2].map((i) => ({ name: `fw-crackle-${i}`, seconds: 3, prompt: 'Firework crackling glitter stars popping and sizzling high in the air after a burst, a spray of tiny sharp crackles fading out, no bang' })),
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

/**
 * Level and encode: beds stereo and whole, one-shots mono with the silence around them trimmed.
 * One fixed gain per file (measured first), then a limiter to catch the peaks: a loudness
 * normaliser that rides the level would pump, and put a jump in a bed where it loops.
 */
function level(s: Sfx, raw: string, out: string) {
  const trim = s.loop ? [] : ['silenceremove=start_periods=1:start_threshold=-50dB', 'areverse', 'silenceremove=start_periods=1:start_threshold=-60dB', 'areverse'];
  const mix = ['-ar', '44100', '-ac', s.loop ? '2' : '1'];
  // ebur128 prints its summary to stderr; the integrated loudness is the last "I:" in it
  const report = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', raw, '-af', [...trim, 'ebur128'].join(','), ...mix, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const lufs = Number([...report.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1]);
  if (!Number.isFinite(lufs)) throw new Error(`${s.name}: couldn't measure its loudness`);
  const gain = (s.lufs ?? (s.loop ? BED_LUFS : SHOT_LUFS)) - lufs;
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', raw,
    '-af', [...trim, `volume=${gain.toFixed(2)}dB`, `alimiter=limit=0.7:attack=2:release=60:level=false`].join(','),
    ...mix,
    '-codec:a', 'libmp3lame', '-b:a', s.loop ? '112k' : '64k',
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
