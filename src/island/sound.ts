/**
 * All island audio, built on one AudioContext:
 *  - the sea: filtered noise that swells like waves (synthesised, no files)
 *  - campfire crackle: tiny noise bursts, louder the closer the camera is
 *  - guitar: Vincent's recordings. He only plays once you've zoomed in close to the campfire
 *    and asked him to (clicked him): he starts a random song from the top, then carries on
 *    through the setlist until you wander off. The recordings run through an "outdoors" chain:
 *    levelled to one loudness, the room boom and harsh top trimmed, a little ground bounce and
 *    open-air scatter added, and duller the further away you stand.
 *  - piano: Vincent's own compositions, on the upright in the library. Indoors, so they get
 *    the opposite of the guitar's treatment: a small wooden room that rings a little. While
 *    you're inside, the sea and the weather are heard through the walls.
 *  - the gramophone in the workshop: music from Vincent's music generation experiments, played
 *    like an old 78: a honky horn with no real bass or treble, a wind-up as the platter gets
 *    to speed, a slow wow in the pitch, and the hiss and crackle of the needle in the groove.
 *  - the winged sheep: a baa when you click it; Beike: a bark (short clips, decoded up front)
 *  - Charlie and George: a synthesised purr when you pet them
 *  - the wildlife: gulls, robins, the owl, ducks, geese and the whale's blow
 *  - weather: rain, rolling thunder, gusting wind and cicadas on a hot day
 *  - the river: its water, the falls, the paddle, the hull on the rocks, and whatever lives on the banks
 * The sea, the fire, the weather, the wildlife and the river are recordings (public/audio/sfx/, made
 * with tools/sounds/generate.ts), loaded once sound starts. Everything has a synthesised stand-in
 * that plays until its recording has arrived, and the game's little musical cues stay synthesised.
 * Sound is on by default, but browsers only allow audio after a user gesture, so it starts on
 * the visitor's first click, tap or key press (unless they've muted it by then).
 */
import type { RiverSound } from './river/game';
import type { Call } from './scene/fauna';

export interface Song {
  id: number;
  title: string;
  duration: number;
  /** Integrated loudness of the recording in LUFS, so every song plays at the same level. */
  loudness?: number;
}

/** One of Vincent's piano pieces (src/data/piano.json). */
export interface Piece {
  id: number;
  file: string;
  title: string;
  duration: number;
  loudness?: number;
}

/** A track on the workshop's gramophone (src/data/records.json). */
export interface Disc {
  id: number;
  file: string; // without extension: there's a .webm and an .m4a
  title: string;
  set: string;
  duration: number;
  /** Where the music starts: the silence before it is skipped. */
  start?: number;
}

const AUDIO = '/audio/';
/** Short clips, decoded up front: one of each set plays, never the same one twice in a row. */
const CLIPS = {
  baa: ['sheep-1', 'sheep-2', 'sheep-3'],
  bark: ['bark-1', 'bark-2'],
};
type Clip = keyof typeof CLIPS;

/**
 * The recorded effects and how many takes of each (name-1, name-2… when more than one), in
 * sets: the island's load when sound starts, the river's the first time you're out on it, the rooms'
 * the first time you step into one, and the telly's the first time she has it on while you're in.
 */
const SFX = {
  island: { sea: 1, fire: 1, rain: 1, wind: 1, cicadas: 1, crickets: 1, birdsong: 1, hail: 1, leaves: 1, gull: 1, chirp: 1, hoot: 1, quack: 1, honk: 1, chatter: 1, blow: 1, breach: 1, roar: 1, purr: 1, mew: 1, tap: 1, thunder: 2, boom: 1, firework: 1, heron: 1, fox: 1, bellow: 1, snuffle: 1, plop: 1, ufo: 1, foghorn: 1,
    rocket: 1, fizz: 1, whistle: 1, staff: 2, tink: 1, bounce: 2, pant: 1, whine: 1, mrrp: 1, dolphin: 1,
    drips: 1, flag: 1, 'door-library': 1, 'door-hut': 1, 'door-lighthouse': 1, bell: 1, hatch: 1, bottle: 1, clink: 1, jump: 1,
    flurry: 1, stroke: 3 },
  rooms: {
    simmer: 1, typing: 1, clockwork: 1, workshop: 1, press: 1, engine: 1, quill: 1, page: 1, zap: 1, 'robot-servo': 1,
    'robot-tinker': 1, 'robot-snore': 1, 'robot-clank': 1, 'robot-beep': 1, ding: 1, snore: 1,
  },
  dioramas: {
    'dio-student': 1, 'dio-backbone': 1, 'dio-entrnce': 1, 'bike-bell': 1, 'castle-clock': 1, 'bus-doors': 1, 'bus-go': 1,
    'truck-horn': 1, 'car-door': 1, turbine: 1, cheers: 1, cowbells: 1, transformer: 1,
  },
  telly: { 'tv-murder': 1, 'tv-location': 1, 'tv-bnb': 1, 'tv-rail': 1 },
  // only on the special days that need them (scene/calendar.ts)
  festive: { fireworks: 1, 'fw-launch': 2, 'fw-burst': 3, 'fw-crackle': 2, 'steam-whistle': 1 },
  river: { 'river-calm': 1, 'river-white': 1, falls: 1, stroke: 3, hit: 2, bump: 1, splash: 1, capsize: 1, roll: 1, brace: 1, boof: 1, dropin: 1, hole: 1, slap: 1, howl: 1, huff: 1, croak: 1, whoosh: 2, kingfisher: 1, otter: 1, grunt: 1, yeti: 1, raven: 1 },
};
type SfxSet = keyof typeof SFX;
/**
 * How loud each one-shot plays: they're all levelled to the same loudness (-18 LUFS), which is
 * right for none of them. A robin is small, a whale is not; a stroke comes every second.
 */
const LEVEL: Record<string, number> = {
  gull: 1.1, chirp: 0.3, hoot: 0.45, quack: 0.45, honk: 0.4, chatter: 0.3, blow: 0.6, breach: 0.75, roar: 0.8,
  purr: 0.55, mew: 0.4, tap: 0.3, thunder: 0.9, boom: 0.7, firework: 0.55,
  heron: 0.5, fox: 0.45, bellow: 0.6, snuffle: 0.35, plop: 0.3, ufo: 0.4, foghorn: 0.8,
  rocket: 0.6, fizz: 0.4, whistle: 0.55, staff: 0.3, tink: 0.3, bounce: 0.3, pant: 0.35, whine: 0.4, mrrp: 0.45,
  dolphin: 0.4, raven: 0.45,
  'door-library': 0.25, 'door-hut': 0.25, 'door-lighthouse': 0.22, bell: 0.25, hatch: 0.25, bottle: 0.5, clink: 0.35, jump: 0.25,
  flurry: 0.45, press: 0.35, engine: 2.5, quill: 0.3, page: 0.35, zap: 0.25, 'robot-servo': 0.35, 'robot-tinker': 0.3,
  'robot-snore': 0.3, 'robot-clank': 0.45, 'robot-beep': 0.35, ding: 0.35, snore: 0.3,
  'bike-bell': 0.4, 'castle-clock': 0.5, 'bus-doors': 0.35, 'bus-go': 0.35, 'truck-horn': 0.45, 'car-door': 0.45, turbine: 0.6,
  cheers: 0.5, cowbells: 0.45, transformer: 0.4,
  stroke: 0.3, hit: 0.85, bump: 0.5, splash: 0.7, capsize: 0.8, roll: 0.55, brace: 0.55, boof: 0.7, dropin: 0.55,
  hole: 0.6, slap: 0.65, howl: 0.45, huff: 0.55, croak: 0.4, whoosh: 0.35, kingfisher: 0.4, otter: 0.4, grunt: 0.55,
  yeti: 0.6,
  'fw-launch': 0.3, 'fw-burst': 0.75, 'fw-crackle': 0.35, 'steam-whistle': 0.65,
};
/**
 * The ones that could make someone jump, browsing late with the volume up: after dark they're
 * held back to this much of their daytime level.
 */
const STARTLING: Record<string, number> = {
  fox: 0.5, foghorn: 0.6, yeti: 0.55, roar: 0.6, howl: 0.65, bellow: 0.65, boom: 0.6, firework: 0.65, thunder: 0.65,
};
/** The beds are levelled lower (-24 LUFS) and each gets its own trim into its old volume curve. */
const BED = { sea: 1.8, fire: 3.5, rain: 3, wind: 2.5, cicadas: 8, falls: 1.6, crickets: 1.5, birdsong: 1.5, hail: 2.5, leaves: 2, drips: 2, flag: 2, fireworks: 1.6 };
/** Each room's door, as you go in or out (the workshop's has a bell over it); made by tools/sounds/doors.py. */
const DOORS = { library: 'door-library', hut: 'door-hut', lighthouse: 'door-lighthouse', workshop: 'bell', hatch: 'hatch' };
/** The rooms' own sounds, and how loud each plays while you're in it (over the outdoors through the walls). */
const ROOM_BEDS = { simmer: 0.35, typing: 0.3, clockwork: 0.4, workshop: 0.35 };
export type RoomName = 'hut' | 'quarters' | 'lamp' | 'workshop' | 'library';
/** Every song is trimmed to this loudness (LUFS) before it hits the outdoor chain. */
const TARGET_LUFS = -16;
const MAKEUP = 0.85;

export class Sound {
  enabled = true;
  private ctx?: AudioContext;
  private master?: GainNode;
  private seaGain?: GainNode;
  private seaLfo?: OscillatorNode;
  private fireGain?: GainNode;
  private rainGain?: GainNode;
  private roofGain?: GainNode;
  /** Where songs enter the outdoor chain, and the lowpass that dulls them with distance. */
  private songBus?: GainNode;
  private songAir?: BiquadFilterNode;
  private windGain?: GainNode;
  private cicadaGain?: GainNode;
  private cricketGain?: GainNode;
  private hailGain?: GainNode;
  private hailRoof?: BiquadFilterNode;
  private leafGain?: GainNode;
  private dripGain?: GainNode;
  private flagGain?: GainNode;
  private fireworksGain?: GainNode;
  /** How wet everything still is (0..1), drying off over a minute or so once the rain stops. */
  private soaked = 0;
  /** The rooms' beds by name, and the hut's stove: the fire's crackle, shut in behind iron. */
  private roomBeds = new Map<string, GainNode>();
  private stove?: GainNode;
  private birdGain?: GainNode;
  /** The river's rush, once someone has been out on it. */
  private rush?: { gain: GainNode; filter: BiquadFilterNode };
  private falls?: { roar: GainNode; air: BiquadFilterNode; deep: GainNode; throb: OscillatorNode; depth: GainNode; synth: GainNode; recorded: boolean };
  private atRiver = false;
  /** How rough the river is where you are: birdsong along the banks drowns in the rapids. */
  private riverRough = 0;
  /** Set every frame by the weather, 0..1 each. */
  rain = 0;
  wind = 0;
  /** How rough the sea is, 0..1: louder, lower surf with a faster swell. */
  sea = 0;
  cicadas = 0;
  /** Crickets on a warm night, and the birds singing by day (loudest at dawn), 0..1 each. */
  crickets = 0;
  birdsong = 0;
  /** How thick the fog is, 0..1: in a proper one the lighthouse sounds its horn. */
  fog = 0;
  private nextHorn = 0;
  /** How dark it is, 0 (day) … 1 (night): the startling sounds are held back after dark. */
  night = 0;
  /** Hail, and snow lying and falling (which hushes everything a little), 0..1 each. */
  hail = 0;
  snow = 0;
  /** How much leaf there is on the trees to rustle in the wind, 0..1. */
  leaves = 0;
  /** The room you're in, if any, and whether Vincent's typing at his desk in the lighthouse. */
  room: RoomName | null = null;
  typing = false;
  /** How close you are to the summit (0..1): the wind's stronger up there, and the flag snaps. */
  summit = 0;
  /** New Year's Eve: the whole country letting off fireworks, far off all round, 0..1. */
  fireworks = 0;
  /** Whether the icicles are melting (their drips join the rain's). */
  thaw = 0;
  /** The programme on the telly, if you're in the room while she watches it (lighthouse.ts). */
  telly: string | null = null;
  /** Its little speaker, and each programme's soundtrack on a loop behind it, once they're in. */
  private tv?: GainNode;
  private shows = new Map<string, GainNode>();
  /** Things that run while they're on (hum()), each a loop behind its own gain. */
  private hums = new Map<string, GainNode>();
  /** The career diorama you're in on the trail (its id), if any: each has its own place to sound like. */
  diorama: string | null = null;
  private places = new Map<string, GainNode>();
  /** In the library: the outdoors is muffled by the walls. */
  indoors = false;
  /** Whether Vincent is at the campfire to play at all (he isn't when he's out in the kayak, or in bed). */
  guitarist = true;
  /** Told whenever the piano starts or stops (null). */
  onPiano?: (piece: Piece | null) => void;
  private pianoBus?: GainNode;
  private piano?: { el: HTMLAudioElement; gain: GainNode; piece: Piece };
  private lastPiece = -1;
  /** Told whenever a record starts or stops (null). */
  onRecord?: (record: Disc | null) => void;
  private recordBus?: GainNode;
  private surface?: GainNode;
  private record?: { el: HTMLAudioElement; gain: GainNode; track: Disc; started: number; stopping: boolean };
  private recordOrder: number[] = [];
  /** Whether the visitor wants records on (so the next goes on when one ends). */
  private recordsOn = false;
  private song?: { el: HTMLAudioElement; gain: GainNode; id: number; live: boolean };
  private asked = false;
  private loudness = 0;
  private silentFor = 0;
  private noise?: AudioBuffer;
  private clips = new Map<Clip, Promise<AudioBuffer>[]>();
  private lastClip = new Map<Clip, number>();
  private nextCrackle = 0;
  /** The recordings that have arrived, each a list of takes, and which take played last. */
  private sfx = new Map<string, AudioBuffer[]>();
  private lastTake = new Map<string, number>();
  private loading = new Set<SfxSet>();
  private wantsFestive = false;
  /** Fed by the synthesised beds, so they can step aside once the recording is in. */
  private seaSynth?: GainNode;
  private seaWalls?: BiquadFilterNode;
  private rainSynth?: GainNode;
  private roof?: BiquadFilterNode;
  private windSynth?: GainNode;
  private gusting?: GainNode;
  private cicadaSynth?: GainNode;
  private cicadaWaves?: GainNode;
  private fireRecorded = false;
  /** The river recorded: a calm run and white water, crossfaded by how rough it is. */
  private water?: { calm: GainNode; white: GainNode; tone: BiquadFilterNode };
  private lastSong = -1;
  private readonly ext: 'webm' | 'm4a';

  constructor(
    private songs: Song[],
    private pieces: Piece[] = [],
    private records: Disc[] = [],
  ) {
    const probe = document.createElement('audio');
    this.ext = probe.canPlayType('audio/webm; codecs="opus"') ? 'webm' : 'm4a';

    const gestures = ['pointerdown', 'keydown', 'touchstart'] as const;
    const unlock = () => {
      gestures.forEach((type) => window.removeEventListener(type, unlock, true));
      if (this.enabled) this.setEnabled(true);
    };
    gestures.forEach((type) => window.addEventListener(type, unlock, true));
  }

  /** Out on the island, where its animals can be heard (not indoors, not away on the river). */
  get outdoors() {
    return !this.indoors && !this.atRiver && !this.diorama;
  }

  /** The song you can currently hear, if you're close enough to hear one. */
  get playing(): Song | null {
    if (!this.song?.live || this.loudness < 0.05) return null;
    return this.songs.find((s) => s.id === this.song!.id) ?? null;
  }

  /**
   * How far into the song you're hearing (seconds), less the time the audio takes to reach your
   * ears, so what's on screen lines up with what you hear.
   */
  get songTime(): number {
    if (!this.song || !this.ctx) return 0;
    return this.song.el.currentTime - (this.ctx.baseLatency || 0) - (this.ctx.outputLatency || 0);
  }

  /** The piano piece playing in the library, if any. */
  get pianoPiece(): Piece | null {
    return this.piano?.piece ?? null;
  }

  /** Must be called from a user gesture. */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.start();
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.3);
    if (!on) {
      this.dropSong();
      this.stopPiano();
      this.stopRecord();
    }
  }

  /** Play a piano piece from the top (by default the one after the last). Call from a gesture. */
  playPiano(id?: number): Piece | null {
    if (!this.pieces.length) return null;
    if (!this.enabled) this.setEnabled(true);
    this.start();
    const next = this.pieces[(this.pieces.findIndex((p) => p.id === this.lastPiece) + 1) % this.pieces.length];
    const piece = this.pieces.find((p) => p.id === id) ?? next;
    this.stopPiano(false);
    this.lastPiece = piece.id;
    const trim = this.ctx!.createGain();
    trim.gain.value = 10 ** ((TARGET_LUFS - (piece.loudness ?? TARGET_LUFS)) / 20);
    trim.connect(this.pianoBus!);
    const { el, gain } = this.stream(piece.file, false, trim);
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.85, this.ctx!.currentTime, 0.15);
    el.addEventListener('ended', () => this.piano?.el === el && this.stopPiano());
    void el.play();
    this.piano = { el, gain, piece };
    this.onPiano?.(piece);
    return piece;
  }

  /** The record on the gramophone, if one is playing. */
  get recordPlaying(): Disc | null {
    return this.record && !this.record.stopping ? this.record.track : null;
  }

  /**
   * Put a record on (by default the next in a shuffled pile) and let it wind up to speed. When
   * it runs out the next one goes on, until it's stopped. Call from a gesture.
   */
  playRecord(id?: number): Disc | null {
    if (!this.records.length) return null;
    if (!this.enabled) this.setEnabled(true);
    this.start();
    if (!this.recordOrder.length) this.recordOrder = shuffle(this.records.map((r) => r.id));
    const want = id ?? this.recordOrder.shift();
    const track = this.records.find((r) => r.id === want)!;
    this.stopRecord(false);
    this.recordsOn = true;
    const { el, gain } = this.stream(`${track.file}.${this.ext}`, false, this.recordBus);
    el.preservesPitch = false; // so the wind-up and the wow bend the pitch, like a real platter
    el.playbackRate = 0.8;
    el.currentTime = track.start ?? 0;
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.9, this.ctx!.currentTime + 0.35, 0.2); // the needle finds the groove
    el.addEventListener('ended', () => {
      if (this.record?.el !== el) return;
      this.stopRecord(false);
      setTimeout(() => this.recordsOn && !this.record && this.playRecord(), 1400); // a moment of run-out crackle
    });
    void el.play();
    this.record = { el, gain, track, started: this.ctx!.currentTime, stopping: false };
    this.onRecord?.(track);
    return track;
  }

  /** Lift the needle: the platter winds down as the music fades. */
  stopRecord(tell = true) {
    if (tell) this.recordsOn = false;
    const r = this.record;
    if (!r) return;
    r.stopping = true;
    this.fadeOutAndDrop(r.el, r.gain, 0.35);
    this.record = undefined;
    const slow = setInterval(() => (r.el.playbackRate = Math.max(0.5, r.el.playbackRate - 0.04)), 50);
    setTimeout(() => clearInterval(slow), 1200);
    if (tell) this.onRecord?.(null);
  }

  /** Let the last notes ring out and close the lid. */
  stopPiano(tell = true) {
    if (!this.piano) return;
    this.fadeOutAndDrop(this.piano.el, this.piano.gain, 0.5);
    this.piano = undefined;
    if (tell) this.onPiano?.(null);
  }

  /** Ask Vincent for a song. He plays while you stay close, and stops once you wander off. */
  ask() {
    this.asked = true;
    this.silentFor = 0;
  }

  /** The winged sheep says baa. Silent while sound is off. */
  baa() {
    this.clip('baa', 0.7);
  }

  /** Beike barks. Silent while sound is off. */
  bark() {
    this.clip('bark', 0.6);
  }

  /** A room's door as you go through it, in or out; `hatch` is the lighthouse stairs. */
  door(room: keyof typeof DOORS) {
    if (this.enabled) this.play(DOORS[room]);
  }

  /** Something in the room you're in: the workshop's machines and robot, the oven timer, a snore. */
  here(name: string, volume = 1) {
    if (this.enabled) this.play(name, volume);
  }

  /**
   * Something that runs for as long as it's on, like the lander's engine: its recording on a loop,
   * opened and shut with `level` (0..1), set every frame. Quick, so a flickering flame sputters.
   */
  hum(name: string, level: number) {
    if (!this.ctx || !this.master) return;
    let g = this.hums.get(name);
    if (!g) {
      if (!level || !this.sfx.has(name)) return;
      g = this.ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      this.bed(name, g, LEVEL[name] ?? 0.5);
      this.hums.set(name, g);
    }
    g.gain.setTargetAtTime(this.enabled ? level : 0, this.ctx.currentTime, level ? 0.03 : 0.08);
  }

  /**
   * A small chime: `found` for a secret discovered (up and bright, with a sparkle), `cairn` for a
   * chapter opening on the trail (two soft bell tones, like a struck stone).
   */
  chime(kind: 'found' | 'cairn') {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    if (kind === 'found') {
      [784, 988, 1175, 1568].forEach((f, i) => this.tone(t + i * 0.09, 'triangle', [[0, f]], 0.07, 0.5 + i * 0.1));
      for (let i = 0; i < 5; i++) this.tone(t + 0.35 + i * 0.06 + Math.random() * 0.03, 'sine', [[0, 2400 + Math.random() * 1800]], 0.025, 0.25);
    } else {
      this.tone(t, 'sine', [[0, 523]], 0.12, 2.2);
      this.tone(t, 'sine', [[0, 1318]], 0.03, 1.2);
      this.tone(t + 0.25, 'sine', [[0, 784]], 0.09, 2.4);
    }
  }

  /**
   * An animal's call: a robin's song, a gull's cry, a tawny owl's hoo-hoo, a quack, geese honking
   * overhead, the whale's blow and splash, the sea serpent's roar, Rocky's chords (always
   * synthesised: he's a rock that talks in music), the Super Sheep going off and Gandalf's
   * fireworks. `volume` falls off with distance; `pan` is where it is across the screen, -1..1.
   */
  call(kind: Call, volume = 1, pan = 0) {
    if (kind === 'baa') return this.clip('baa', 0.5 * volume);
    if (!this.enabled || !this.ctx || !this.master) return;
    // the recording if it's in (the whale's splash is its breach), duller the further off it is
    const recorded = kind === 'splash' ? 'breach' : kind;
    if (kind !== 'chord' && this.play(recorded, volume, { air: 2500 + volume * 17500, pan })) return;
    const t = this.ctx.currentTime;
    const tone = (type: OscillatorType, at: number, glide: [number, number][], peak: number, length: number, filter?: number) =>
      this.tone(t + at, type, glide, peak * volume, length, filter);
    const hiss = (at: number, length: number, freq: number, peak: number) => this.hiss(t + at, length, freq, peak * volume);
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    switch (kind) {
      case 'chirp':
        for (let i = 0; i < 4; i++) tone('sine', i * 0.13 + r(0, 0.04), [[0, r(3200, 4200)], [0.07, r(2200, 5200)]], 0.08, 0.09);
        break;
      case 'gull':
        for (let i = 0; i < 3; i++) tone('sawtooth', i * 0.32, [[0, 900], [0.08, 1500], [0.25, 700]], 0.07, 0.3, 1400);
        break;
      case 'hoot': // the tawny owl: hoo … hu-hu-huuuu
        tone('sine', 0, [[0, 420], [0.5, 380]], 0.25, 0.7);
        for (let i = 0; i < 3; i++) tone('sine', 1.1 + i * 0.16, [[0, 400], [0.1, 390]], 0.18, 0.14);
        tone('sine', 1.6, [[0, 410], [0.8, 360]], 0.22, 1.0);
        break;
      case 'tap': // the kitchen tap, running for a moment
        hiss(0, 2.2, 2600, 0.08);
        hiss(0.05, 2.1, 900, 0.05);
        break;
      case 'mew': // Charlie's one small warning, before the claws
        tone('triangle', 0, [[0, 780], [0.09, 1150], [0.3, 640]], 0.1, 0.34, 1300);
        break;
      case 'quack':
        for (let i = 0; i < 2; i++) tone('sawtooth', i * 0.22, [[0, 520], [0.12, 380]], 0.12, 0.16, 900);
        break;
      case 'honk':
        for (let i = 0; i < 6; i++) tone('sawtooth', r(0, 2.2), [[0, r(330, 420)], [0.15, r(280, 330)]], 0.05, 0.2, 700);
        break;
      case 'chatter':
        for (let i = 0; i < 7; i++) tone('square', i * 0.06, [[0, 2600], [0.03, 1900]], 0.03, 0.04, 2400);
        break;
      case 'blow':
        hiss(0, 1.4, 500, 0.35);
        hiss(0.1, 1.0, 1800, 0.12);
        break;
      case 'splash':
        hiss(0, 1.6, 700, 0.5);
        hiss(0, 0.5, 200, 0.4);
        break;
      case 'chord': { // Rocky talks in chords: three quick, happy ones
        const phrase = [[523, 659, 784], [587, 740, 880], [659, 831, 988]];
        const up = r(0.9, 1.15);
        phrase.forEach((notes, i) => notes.forEach((f) => tone('triangle', i * 0.18, [[0, f * up], [0.15, f * up * 1.01]], 0.05, 0.22)));
        break;
      }
      case 'boom': // the Super Sheep going off
        hiss(0, 1.2, 150, 0.6);
        hiss(0, 0.4, 900, 0.3);
        tone('sine', 0, [[0, 110], [0.4, 40]], 0.4, 0.6);
        break;
      case 'roar': // the sea serpent: a deep, rasping bellow that swells and dies away over the water
        tone('sawtooth', 0, [[0, 62], [0.5, 92], [2.4, 42]], 0.4, 2.8, 170);
        tone('sawtooth', 0.04, [[0, 98], [0.6, 138], [2.2, 58]], 0.22, 2.5, 320);
        tone('square', 0.1, [[0, 31], [1.5, 26]], 0.18, 2.2, 90);
        hiss(0, 2.6, 260, 0.45);
        hiss(0.15, 1.7, 1000, 0.12);
        break;
      // the fair folk (scene/revel.ts): all glass and bells, never quite in tune with the world
      case 'twinkle': // a pixie popping into being, a toadstool breaking the grass
        for (let i = 0; i < 4; i++) tone('sine', i * 0.05 + r(0, 0.02), [[0, r(2600, 4200)]], 0.03, 0.35);
        break;
      case 'shimmer': // a glassy run up, and it hangs in the air
        [1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => tone('sine', i * 0.06, [[0, f], [0.8, f * 1.006]], 0.035, 1.1));
        break;
      case 'reel': { // one turn of their tune: a skipping pentatonic run over a drone, in six-eight
        const scale = [587, 659, 784, 880, 988, 1175, 1319];
        const turn = [0, 2, 4, 5, 4, 2, 1, 3, 5, 6, 5, 3];
        const step = 3.2 / turn.length;
        const lift = Math.random() < 0.3 ? 1.1225 : 1; // now and then a tone up, for the next turn
        turn.forEach((n, i) => {
          tone('triangle', i * step, [[0, scale[n] * lift]], i % 3 === 0 ? 0.05 : 0.035, step * 1.8);
          if (i % 6 === 0) tone('sine', i * step, [[0, scale[n] * lift * 2]], 0.012, 0.5); // a bell on the beat
        });
        tone('sine', 0, [[0, 294 * lift]], 0.025, 3.3);
        tone('sine', 0, [[0, 440 * lift]], 0.012, 3.3);
        break;
      }
      case 'giggle': // Puck: a quick, high titter
        for (let i = 0; i < 5; i++) tone('triangle', i * 0.08, [[0, 1500 + i * 60], [0.05, 1250 + i * 40]], 0.04, 0.07, 1600);
        break;
      case 'hush': // gone: a falling shimmer, and a breath of air through the grass
        [3136, 2637, 2093, 1568, 1319, 1047].forEach((f, i) => tone('sine', i * 0.07, [[0, f]], 0.03, 0.9));
        hiss(0, 1.4, 3000, 0.06);
        break;
      case 'firework': // Gandalf's: a whistle up, a bang, and a crackle as it falls
        tone('sine', 0, [[0, 700], [0.65, 2600]], 0.05, 0.7);
        hiss(0.7, 0.9, 300, 0.45);
        tone('sine', 0.7, [[0, 90], [0.3, 40]], 0.3, 0.5);
        for (let i = 0; i < 10; i++) hiss(0.9 + r(0, 0.9), 0.06, 3500, 0.12);
        break;
    }
  }

  /** A special day needs its sounds (the fireworks, the steamboat's whistle): fetch them once sound is on. */
  festive() {
    this.wantsFestive = true;
    if (this.ctx) this.load('festive');
  }

  /**
   * One of the New Year's fireworks: a rocket going up, a shell bursting, the glitter crackling
   * after. `delay` is how long its sound takes to get here; `volume` falls off with distance.
   */
  firework(kind: 'launch' | 'burst' | 'crackle', volume: number, pan = 0, delay = 0) {
    if (!this.enabled || this.atRiver) return;
    const walls = this.indoors || this.diorama ? 0.35 : 1;
    this.play(`fw-${kind}`, volume * walls, { air: this.indoors ? 1500 : 3000 + volume * 15000, pan, delay });
  }

  /** The steamboat's whistle, twice (a synthesised toot till the recording's in). */
  steamWhistle() {
    if (!this.enabled || !this.ctx || !this.master) return;
    if (this.play('steam-whistle', 1)) return;
    const t = this.ctx.currentTime;
    for (const at of [0, 0.7]) {
      [311, 370, 466].forEach((f) => this.tone(t + at, 'triangle', [[0, f], [0.5, f * 0.98]], 0.05, 0.6));
      this.hiss(t + at, 0.6, 2400, 0.05);
    }
  }

  /** One tone at time t: a pitch glide [[offset, Hz]…] through a shaped envelope, maybe band-passed. */
  private tone(t: number, type: OscillatorType, glide: [number, number][], peak: number, length: number, filter?: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    glide.forEach(([dt, f], i) => (i ? osc.frequency.exponentialRampToValueAtTime(f, t + dt) : osc.frequency.setValueAtTime(f, t)));
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + Math.min(0.03, length / 4));
    env.gain.exponentialRampToValueAtTime(0.001, t + length);
    let out: AudioNode = osc;
    if (filter) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = filter;
      bp.Q.value = 2;
      out = osc.connect(bp);
    }
    out.connect(env).connect(this.master!);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  /** A burst of filtered noise at time t (breath, spray, a splash). */
  private hiss(t: number, length: number, freq: number, peak: number) {
    if (!this.noise) return;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + length * 0.15);
    env.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(f).connect(env).connect(this.master!);
    src.start(t, Math.random());
    src.stop(t + length + 0.05);
  }

  // --- the river ------------------------------------------------------------------------

  /**
   * Out on the river (src/island/river/): the island's sea and fire fall silent, and the river
   * rushes instead, louder and brighter the whiter the water. Weather still comes along.
   */
  riverWater(on: boolean, rough = 0, speed = 0, roar = 0, near = 0) {
    this.atRiver = on;
    this.riverRough = rough;
    if (!this.enabled || !this.ctx || !this.master || !this.noise) return;
    const ctx = this.ctx;
    if (!this.rush) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(bp).connect(gain).connect(this.master);
      src.start();
      this.rush = { gain, filter: bp };
    }
    if (on) this.load('river');
    if (!this.water && this.sfx.has('river-calm') && this.sfx.has('river-white')) {
      // the calm run and the white water on loops side by side, the rough one opening as the river does
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.Q.value = 0.5;
      tone.connect(this.master);
      const calm = this.bed('river-calm', tone, 0);
      const white = this.bed('river-white', tone, 0);
      this.water = { calm, white, tone };
    }
    const t = ctx.currentTime;
    const w = this.water;
    const level = on ? 0.08 + rough * 0.32 + speed * 0.013 : 0;
    this.rush.gain.gain.setTargetAtTime(w ? 0 : level, t, on ? 0.4 : 0.2);
    this.rush.filter.frequency.setTargetAtTime(500 + rough * 1600 + speed * 60, t, 0.5);
    if (w) {
      w.calm.gain.setTargetAtTime(on ? 1.0 * (1 - rough * 0.7) : 0, t, on ? 0.6 : 0.2);
      w.white.gain.setTargetAtTime(on ? rough * 1.4 + speed * 0.025 : 0, t, on ? 0.6 : 0.2);
      w.tone.frequency.setTargetAtTime(3000 + rough * 15000, t, 0.8);
    }
    this.fallsAhead(on ? roar : 0, near);
  }

  /**
   * A fall coming up: from far off a low rumble with the highs eaten by the air, opening out into
   * a thundering roar as you close in, and under a big one a slow, heavy throb you feel more than
   * hear.
   */
  private fallsAhead(roar: number, near: number) {
    const ctx = this.ctx!;
    if (!this.falls) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise!;
      src.loop = true;
      src.playbackRate.value = 0.7; // slowed down: deeper, heavier water
      const air = ctx.createBiquadFilter();
      air.type = 'lowpass';
      air.Q.value = 0.9;
      air.frequency.value = 200;
      const roarGain = ctx.createGain();
      roarGain.gain.value = 0;
      const deepFilter = ctx.createBiquadFilter();
      deepFilter.type = 'lowpass';
      deepFilter.frequency.value = 110;
      deepFilter.Q.value = 2;
      const deep = ctx.createGain();
      deep.gain.value = 0;
      // the throb: a slow swell riding on both layers
      const swell = ctx.createGain();
      swell.gain.value = 1;
      const throb = ctx.createOscillator();
      throb.frequency.value = 0.4;
      const depth = ctx.createGain();
      depth.gain.value = 0;
      throb.connect(depth).connect(swell.gain);
      throb.start();
      const synth = ctx.createGain(); // steps aside for the recording, once it's in
      src.connect(synth).connect(air).connect(roarGain).connect(swell);
      src.connect(deepFilter).connect(deep).connect(swell);
      // squeezed, so right at the lip it's a dense wall of sound rather than clipping
      const squeeze = ctx.createDynamicsCompressor();
      squeeze.threshold.value = -14;
      squeeze.ratio.value = 6;
      swell.connect(squeeze).connect(this.master!);
      src.start(0, Math.random() * 2);
      this.falls = { roar: roarGain, air, deep, throb, depth, synth, recorded: false };
    }
    const f = this.falls;
    const t = ctx.currentTime;
    if (!f.recorded && this.sfx.has('falls')) {
      // the real roar goes through the same air; the synthesised rumble stays on under it
      f.recorded = true;
      this.bed('falls', f.air, BED.falls);
      f.synth.gain.setTargetAtTime(0, t, 0.5);
    }
    const big = roar * roar;
    f.roar.gain.setTargetAtTime(roar * 0.7, t, 0.6);
    f.air.frequency.setTargetAtTime(160 + near ** 2 * 2200, t, 0.8);
    f.deep.gain.setTargetAtTime(big * 1.1, t, 0.8);
    // quicker and deeper the closer you get
    f.throb.frequency.setTargetAtTime(0.3 + near * 0.5, t, 1);
    f.depth.gain.setTargetAtTime(big * 0.4, t, 1);
  }

  /**
   * The river's own sounds: a paddle stroke, a knock on a rock, landing off a fall, and so on,
   * recorded where there's a recording. `step` pitches the chime up the scale as a streak goes on.
   */
  river(kind: RiverSound, volume = 1, step = 0) {
    if (!this.enabled || !this.ctx || !this.master) return;
    if (this.play(kind, volume)) return;
    const t = this.ctx.currentTime;
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    switch (kind) {
      case 'stroke':
        this.hiss(t, 0.28, r(900, 1300), 0.05 * volume);
        break;
      case 'bump':
        this.tone(t, 'sine', [[0, 140], [0.12, 70]], 0.2 * volume, 0.18);
        this.hiss(t, 0.3, 700, 0.1 * volume);
        break;
      case 'hit': // the hull on a rock: a hollow thunk and a crack of spray
        this.tone(t, 'triangle', [[0, 180], [0.2, 60]], 0.45 * volume, 0.35);
        this.tone(t, 'square', [[0, 90], [0.1, 45]], 0.15 * volume, 0.2, 300);
        this.hiss(t, 0.6, 1400, 0.25 * volume);
        break;
      case 'splash':
        this.hiss(t, 1.2, 600, 0.45 * volume);
        this.hiss(t, 0.4, 180, 0.4 * volume);
        break;
      case 'ball': // a tennis ball fished out: two bright little notes
        this.tone(t, 'square', [[0, 988]], 0.05 * volume, 0.1, 2000);
        this.tone(t + 0.08, 'square', [[0, 1319]], 0.05 * volume, 0.16, 2600);
        break;
      case 'gate':
        [659, 784, 988].forEach((f, i) => this.tone(t + i * 0.09, 'triangle', [[0, f]], 0.08 * volume, 0.25));
        break;
      case 'slap': // a beaver's tail on the water: a flat crack, like a shot, and the splash
        this.hiss(t, 0.12, 2200, 0.5 * volume);
        this.tone(t, 'sine', [[0, 160], [0.1, 60]], 0.5 * volume, 0.16);
        this.hiss(t + 0.05, 0.9, 600, 0.3 * volume);
        break;
      case 'howl': { // wolves: one long rising howl, and the others joining in, off-key
        const f0 = r(330, 380);
        this.tone(t, 'sine', [[0, f0 * 0.8], [0.5, f0 * 1.25], [2.2, f0 * 1.2], [3, f0 * 0.85]], 0.12 * volume, 3.1);
        this.tone(t, 'triangle', [[0, f0 * 1.6], [0.5, f0 * 2.5], [2.2, f0 * 2.4], [3, f0 * 1.7]], 0.02 * volume, 3.1, 1400);
        for (let i = 0; i < 2; i++) {
          const f = f0 * r(1.15, 1.45);
          const at = t + 1.2 + i * r(0.4, 0.9);
          this.tone(at, 'sine', [[0, f * 0.85], [0.4, f], [1.6, f * 0.97], [2.1, f * 0.8]], 0.07 * volume, 2.2);
        }
        break;
      }
      case 'huff': // a bear (or a moose): a deep, breathy huff, twice
        for (let i = 0; i < 2; i++) {
          this.hiss(t + i * 0.45, 0.35, 320, 0.35 * volume);
          this.tone(t + i * 0.45, 'sawtooth', [[0, 90], [0.25, 60]], 0.12 * volume, 0.3, 220);
        }
        break;
      case 'spotted': // something rare: a soft, wondering phrase, up and up
        [523, 659, 880, 1047].forEach((f, i) => this.tone(t + i * 0.14, 'sine', [[0, f]], 0.07 * volume, 0.6));
        break;
      case 'croak':
        this.tone(t, 'sawtooth', [[0, 380], [0.25, 260]], 0.12 * volume, 0.32, 700);
        this.hiss(t, 0.3, 1100, 0.05 * volume);
        break;
      case 'capsize':
        this.hiss(t, 1.8, 400, 0.5 * volume);
        this.tone(t + 0.1, 'sine', [[0, 320], [0.8, 120]], 0.12 * volume, 0.9);
        for (let i = 0; i < 6; i++) this.tone(t + 0.4 + i * r(0.1, 0.2), 'sine', [[0, r(500, 900)], [0.06, r(900, 1400)]], 0.05 * volume, 0.08);
        break;
      case 'brace': // the blade slapped flat on the water
        this.hiss(t, 0.25, 1800, 0.3 * volume);
        this.tone(t, 'sine', [[0, 260], [0.08, 150]], 0.3 * volume, 0.12);
        break;
      case 'boof': // the flat, fat smack of a boof landing
        this.tone(t, 'sine', [[0, 120], [0.18, 50]], 0.6 * volume, 0.3);
        this.hiss(t, 0.5, 900, 0.35 * volume);
        this.tone(t + 0.05, 'triangle', [[0, 523], [0.1, 784]], 0.06 * volume, 0.2);
        break;
      case 'roll': // back up: a gasp of air and water pouring off
        this.hiss(t, 0.7, 2400, 0.2 * volume);
        this.tone(t, 'sine', [[0, 300], [0.3, 600]], 0.1 * volume, 0.35);
        break;
      case 'whoosh': // past something fast
        this.hiss(t, 0.35, 2600, 0.12 * volume);
        this.tone(t, 'triangle', [[0, 880], [0.12, 1175]], 0.04 * volume, 0.15);
        break;
      case 'hole': // the roar of water pouring back on itself
        this.hiss(t, 0.9, 320, 0.4 * volume);
        this.hiss(t, 0.6, 1200, 0.15 * volume);
        break;
      case 'cleared': // out the bottom of a rapid clean: a bright run up and a splash
        [392, 523, 659, 784].forEach((f, i) => this.tone(t + i * 0.07, 'triangle', [[0, f]], 0.08 * volume, i === 3 ? 0.4 : 0.12));
        this.hiss(t + 0.28, 0.5, 2000, 0.12 * volume);
        break;
      case 'dropin': // into white water: a low surge
        this.hiss(t, 1.1, 350, 0.35 * volume);
        this.tone(t, 'sine', [[0, 90], [0.5, 55]], 0.25 * volume, 0.6);
        break;
      case 'chime': { // something done well, a note higher each time in a streak
        const f = 523 * 2 ** ([0, 2, 4, 7, 9][step % 5] / 12 + Math.floor(step / 5));
        this.tone(t, 'triangle', [[0, f]], 0.05 * volume, 0.22);
        this.tone(t + 0.04, 'sine', [[0, f * 2]], 0.02 * volume, 0.3);
        break;
      }
      case 'tier': { // the flow up a whole notch: a rising arpeggio that climbs with it
        const base = 392 * 2 ** (Math.min(step, 5) * 2 / 12);
        [1, 1.26, 1.5, 2].forEach((m, i) => this.tone(t + i * 0.06, 'square', [[0, base * m]], 0.045 * volume, i === 3 ? 0.45 : 0.12, 2600));
        this.hiss(t + 0.2, 0.4, 3000, 0.08 * volume);
        break;
      }
      case 'lost': // the flow gone: a sad little slide down
        this.tone(t, 'square', [[0, 392], [0.25, 196]], 0.04 * volume, 0.3, 1200);
        break;
      case 'mile': // another stretch of distance put behind you
        [784, 1047].forEach((f, i) => this.tone(t + i * 0.1, 'triangle', [[0, f]], 0.06 * volume, 0.25));
        break;
      case 'best': // a new best: a little fanfare
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.11, 'square', [[0, f]], 0.05 * volume, i === 3 ? 0.5 : 0.14, 2400));
        break;
    }
  }

  /** One clip from a set, never the same one twice in a row, a touch higher or lower each time. */
  private clip(kind: Clip, volume: number) {
    const buffers = this.clips.get(kind);
    if (!this.enabled || !this.ctx || !buffers) return;
    const n = buffers.length;
    const i = ((this.lastClip.get(kind) ?? -1) + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.lastClip.set(kind, i);
    void buffers[i].then((buffer) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = 0.95 + Math.random() * 0.1;
      const gain = this.ctx!.createGain();
      gain.gain.value = volume;
      src.connect(gain).connect(this.master!);
      src.start();
    });
  }

  /** A purr: rumbling noise pulsing ~25 times a second, over two slow breaths. */
  purr() {
    if (!this.enabled || !this.ctx || !this.noise) return;
    if (this.play('purr')) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 450;
    const pulse = ctx.createGain();
    pulse.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 23 + Math.random() * 4;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(pulse.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    for (const [at, peak] of [[0, 1], [1.4, 0.75]]) {
      env.gain.linearRampToValueAtTime(peak, t + at + 0.35);
      env.gain.linearRampToValueAtTime(0.15, t + at + 1.3);
    }
    env.gain.linearRampToValueAtTime(0, t + 2.9);
    src.connect(lp).connect(pulse).connect(env).connect(this.master!);
    src.start(t, Math.random());
    lfo.start(t);
    src.stop(t + 3);
    lfo.stop(t + 3);
  }

  /** A far-off rumble: deep noise swelling in and dying away, quieter the further the strike. */
  thunder(distance: number) {
    if (!this.enabled || !this.ctx || !this.noise) return;
    // a far strike arrives late, quieter, and with the crack gone out of it
    if (this.play('thunder', 1.25 - distance * 0.8, { air: 300 + (1 - distance) ** 2 * 9000, delay: distance * 1.5, rate: 0.95 - distance * 0.1 })) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160 - distance * 80;
    const env = ctx.createGain();
    const peak = 1.6 - distance;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.15 + distance * 0.4);
    env.gain.linearRampToValueAtTime(peak * 0.5, t + 1.2);
    env.gain.exponentialRampToValueAtTime(0.001, t + 4 + distance * 2);
    src.connect(lp).connect(env).connect(this.master!);
    src.start(t, Math.random());
    src.stop(t + 6.5);
  }

  /**
   * Called every frame with how close (0..1) the camera is to the campfire and how much of
   * the world is in view (smaller is more zoomed in).
   */
  update(campfireNearness: number, view: number, dt: number) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const near = this.indoors || this.atRiver || this.diorama ? 0 : Math.max(0, Math.min(1, campfireNearness));
    // indoors the sea and the wind come through the walls; up in a diorama the island's far below
    const walls = this.atRiver ? 0 : this.indoors ? 0.3 : this.diorama ? 0.3 : 1;
    this.fireGain?.gain.setTargetAtTime(near * 0.5, t, 0.2);
    this.seaGain?.gain.setTargetAtTime((0.28 + this.sea * 0.3 - near * 0.12) * walls * (1 - this.snow * 0.3), t, 0.5);
    this.seaLfo?.frequency.setTargetAtTime(0.11 + this.sea * 0.12, t, 2);
    this.rainGain?.gain.setTargetAtTime(this.rain * 0.22 * (this.indoors ? 0.25 : 1), t, 1);
    this.roofGain?.gain.setTargetAtTime(this.indoors ? this.rain * 0.5 : 0, t, 0.6); // indoors, it drums on the roof
    // squared, so a breeze on a fair day is a whisper and only real wind howls
    const up = this.atRiver ? 0 : this.summit * 0.4; // always a wind at the top
    this.windGain?.gain.setTargetAtTime(Math.min(1, this.wind * this.wind + up) * 0.35 * (this.atRiver ? 1 : walls), t, 1);
    this.cicadaGain?.gain.setTargetAtTime(this.cicadas * 0.05 * walls, t, 1.5);
    // on the river, the banks sing as loud as the water lets them; snow hushes it all a little
    const hush = 1 - this.snow * 0.4;
    const banks = (this.atRiver ? (1 - this.riverRough) ** 2 : walls) * hush;
    this.cricketGain?.gain.setTargetAtTime(this.crickets * 0.18 * banks, t, 2);
    this.birdGain?.gain.setTargetAtTime(this.birdsong * 0.16 * banks, t, 2);
    // hail rattles on the roof as loud indoors as out, just duller
    this.hailGain?.gain.setTargetAtTime(this.hail * 0.3, t, 0.8);
    this.hailRoof?.frequency.setTargetAtTime(this.indoors ? 1800 : 16000, t, 0.3);
    this.leafGain?.gain.setTargetAtTime(Math.min(1, this.wind * 1.5) * this.leaves * 0.14 * (this.atRiver ? 1 : walls), t, 1);
    // after the rain, the trees and the eaves drip for a while (and so do the icicles as they thaw)
    this.soaked = Math.max(this.rain, this.soaked - dt / 80);
    const drip = Math.min(1, Math.max(0, this.soaked - this.rain * 2) + this.thaw * 0.6);
    this.dripGain?.gain.setTargetAtTime(drip * 0.22 * (this.atRiver ? 0 : walls), t, 1.5);
    this.flagGain?.gain.setTargetAtTime(this.summit * (0.35 + this.wind) * 0.2 * (this.atRiver ? 0 : walls), t, 1);
    this.fireworksGain?.gain.setTargetAtTime(this.fireworks * 0.3 * (this.atRiver ? 0 : walls), t, 2);
    // the rooms: the stove and the soup in the hut, the clockwork up in the lamp room, the
    // workshop's machines, and the keyboard when Vincent's at his desk
    if (this.room) this.load('rooms');
    const want: Record<string, boolean> = {
      simmer: this.room === 'hut', typing: this.room === 'quarters' && this.typing, clockwork: this.room === 'lamp', workshop: this.room === 'workshop',
    };
    for (const [name, g] of this.roomBeds) g.gain.setTargetAtTime(want[name] ? ROOM_BEDS[name as keyof typeof ROOM_BEDS] : 0, t, name === 'typing' ? 0.08 : 0.4);
    if (this.room === 'hut' && !this.stove && this.sfx.has('fire')) {
      const iron = this.ctx.createBiquadFilter();
      iron.type = 'lowpass';
      iron.frequency.value = 1600;
      this.stove = this.ctx.createGain();
      this.stove.gain.value = 0;
      iron.connect(this.stove).connect(this.master!);
      this.bed('fire', iron, BED.fire);
    }
    this.stove?.gain.setTargetAtTime(this.room === 'hut' ? 0.6 : 0, t, 0.4);
    // up on the trail, the diorama's own place: the campus, the countryside, the solar meadow
    if (this.diorama) this.load('dioramas');
    for (const [id, g] of this.places) g.gain.setTargetAtTime(this.diorama === id ? 0.9 : 0, t, 0.5);
    // the telly: only the programme that's on, low, as if she's turned it down for you
    if (this.telly) this.load('telly');
    for (const [show, g] of this.shows) g.gain.setTargetAtTime(this.telly === show ? 1 : 0, t, 0.25);
    // the foghorn: one long blast a minute or so, while the fog lasts, muffled through the walls
    if (this.fog > 0.5 && !this.atRiver && t > this.nextHorn) {
      if (this.nextHorn && this.play('foghorn', 0.5 + this.fog * 0.5, { air: this.indoors ? 700 : 16000 })) this.nextHorn = t + 45 + Math.random() * 30;
      else this.nextHorn = t + 4 + Math.random() * 10; // the first a little after the fog comes in
    }
    if (near > 0 && !this.fireRecorded && t > this.nextCrackle) this.crackle(near);
    // indoors the walls take the sea's highs (the synthesised one never had any)
    this.seaWalls?.frequency.setTargetAtTime(this.indoors ? 500 : 16000, t, 0.3);

    // the gramophone: wind-up, then a slow wow and a faster flutter in the speed
    const r = this.record;
    if (r && !r.stopping) {
      const age = t - r.started;
      const wound = 0.8 + 0.2 * Math.min(1, age / 1.4) ** 0.6;
      r.el.playbackRate = wound * (1 + Math.sin(age * Math.PI * 2 * 0.55) * 0.0045 + Math.sin(age * Math.PI * 2 * 5.5) * 0.0012);
    }
    this.surface?.gain.setTargetAtTime(r && !r.stopping ? 0.05 : 0, t, r ? 0.3 : 0.6);

    // the guitar only carries when you're zoomed right in on the fire
    const close = Math.max(0, Math.min(1, (24 - view) / 10));
    this.loudness = this.asked && this.guitarist ? near * close : 0;
    if (this.loudness > 0.02 && !this.song) this.joinSong();
    if (this.song) this.song.gain.gain.setTargetAtTime(this.loudness * 0.9, t, 0.6);
    // air eats the highs first: muffled from the edge of earshot, clear up close
    this.songAir?.frequency.setTargetAtTime(2500 + this.loudness * 11000, t, 0.6);
    // stop streaming once you've been out of earshot for a while
    this.silentFor = this.loudness > 0.02 ? 0 : this.silentFor + dt;
    if (this.silentFor > 4) {
      this.dropSong();
      this.asked = false;
    }
  }

  /** Start a random song from the top, never the one he played last. */
  private joinSong() {
    const others = this.songs.filter((s) => s.id !== this.lastSong);
    const pick = others.length ? others : this.songs;
    this.playFrom(pick[Math.floor(Math.random() * pick.length)].id);
  }

  private playFrom(id: number) {
    this.lastSong = id;
    const { el, gain } = this.stream(`guitar-${id}.${this.ext}`, false, this.songTrim(id));
    gain.gain.value = 0;
    el.addEventListener('ended', () => {
      if (this.song?.el !== el) return;
      this.song = undefined;
      const next = this.songs[(this.songs.findIndex((s) => s.id === id) + 1) % this.songs.length];
      this.playFrom(next.id);
    });
    const song = { el, gain, id, live: false };
    el.addEventListener('playing', () => (song.live = true), { once: true });
    void el.play();
    this.song = song;
  }

  /** A trim that brings song `id` to the target loudness, feeding the outdoor chain. */
  private songTrim(id: number) {
    const lufs = this.songs.find((s) => s.id === id)?.loudness ?? TARGET_LUFS;
    const trim = this.ctx!.createGain();
    trim.gain.value = 10 ** ((TARGET_LUFS - lufs) / 20);
    trim.connect(this.songBus!);
    return trim;
  }

  private dropSong() {
    if (!this.song) return;
    this.fadeOutAndDrop(this.song.el, this.song.gain);
    this.song = undefined;
  }

  private start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // a safety net at the end: when the falls, the river and a crash on a rock all land at once,
    // they're squeezed rather than clipped
    const safety = ctx.createDynamicsCompressor();
    safety.threshold.value = -4;
    safety.knee.value = 4;
    safety.ratio.value = 12;
    safety.attack.value = 0.003;
    safety.release.value = 0.25;
    this.master.connect(safety).connect(ctx.destination);

    // two seconds of brown-ish noise, reused by the sea and the fire
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }

    // the sea: lowpassed noise, its volume swelling on a slow LFO
    const sea = ctx.createBufferSource();
    sea.buffer = this.noise;
    sea.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const swell = ctx.createGain();
    swell.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.25; // 0.35..0.85: the waves come and go but never fall silent
    lfo.connect(lfoDepth).connect(swell.gain);
    this.seaLfo = lfo;
    this.seaGain = ctx.createGain();
    this.seaGain.gain.value = 0.28;
    this.seaSynth = ctx.createGain();
    sea.connect(lp).connect(swell).connect(this.seaSynth).connect(this.seaGain).connect(this.master);
    this.seaWalls = ctx.createBiquadFilter();
    this.seaWalls.type = 'lowpass';
    this.seaWalls.frequency.value = 16000;
    this.seaWalls.connect(this.seaGain);
    sea.start();
    lfo.start();

    this.buildSongChain(ctx);
    this.buildPianoChain(ctx);
    this.buildRecordChain(ctx);

    this.fireGain = ctx.createGain();
    this.fireGain.gain.value = 0;
    this.fireGain.connect(this.master);

    // rain: white noise with the lows and the harsh top cut away, a steady hiss
    const white = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = white.getChannelData(0);
    for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    const rain = ctx.createBufferSource();
    rain.buffer = white;
    rain.loop = true;
    const hiss = ctx.createBiquadFilter();
    hiss.type = 'bandpass';
    hiss.frequency.value = 2400;
    hiss.Q.value = 0.4;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this.rainSynth = ctx.createGain();
    rain.connect(this.rainSynth).connect(hiss).connect(this.rainGain).connect(this.master);
    // the same rain heard from indoors: the hiss muffled by the roof into a soft, uneven drumming
    const roof = ctx.createBiquadFilter();
    this.roof = roof;
    roof.type = 'lowpass';
    roof.frequency.value = 700;
    roof.Q.value = 0.7;
    const patter = ctx.createGain();
    patter.gain.value = 0.75;
    const unevenly = ctx.createOscillator();
    unevenly.frequency.value = 0.37;
    const depth = ctx.createGain();
    depth.gain.value = 0.25; // it comes in waves as the wind blows it across the roof
    unevenly.connect(depth).connect(patter.gain);
    unevenly.start();
    this.roofGain = ctx.createGain();
    this.roofGain.gain.value = 0;
    this.rainSynth.connect(roof).connect(patter).connect(this.roofGain).connect(this.master);
    rain.start();

    // wind: a low band of noise, gusting on two slow, out-of-step LFOs
    const gusts = ctx.createBufferSource();
    gusts.buffer = this.noise;
    gusts.loop = true;
    const howl = ctx.createBiquadFilter();
    howl.type = 'bandpass';
    howl.frequency.value = 420;
    howl.Q.value = 0.8;
    const gusting = ctx.createGain();
    this.gusting = gusting;
    gusting.gain.value = 0.6;
    for (const f of [0.09, 0.23]) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = f;
      const depth = ctx.createGain();
      depth.gain.value = 0.25;
      lfo.connect(depth).connect(gusting.gain);
      lfo.start();
    }
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSynth = ctx.createGain();
    gusts.connect(this.windSynth).connect(howl).connect(gusting).connect(this.windGain).connect(this.master);
    gusts.start();

    // cicadas: a high buzz pulsing fast, swelling and fading in slow waves
    const buzz = ctx.createBufferSource();
    buzz.buffer = white;
    buzz.loop = true;
    const chirp = ctx.createBiquadFilter();
    chirp.type = 'bandpass';
    chirp.frequency.value = 4600;
    chirp.Q.value = 6;
    const pulse = ctx.createGain();
    pulse.gain.value = 0.5;
    const fast = ctx.createOscillator();
    fast.frequency.value = 42;
    const fastDepth = ctx.createGain();
    fastDepth.gain.value = 0.5;
    fast.connect(fastDepth).connect(pulse.gain);
    const waves = ctx.createGain();
    this.cicadaWaves = waves;
    waves.gain.value = 0.5;
    const slow = ctx.createOscillator();
    slow.frequency.value = 0.12;
    const slowDepth = ctx.createGain();
    slowDepth.gain.value = 0.5;
    slow.connect(slowDepth).connect(waves.gain);
    this.cicadaGain = ctx.createGain();
    this.cicadaGain.gain.value = 0;
    // crickets and birdsong: recordings only, silent until they arrive
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    this.cricketGain.connect(this.master);
    this.birdGain = ctx.createGain();
    this.birdGain.gain.value = 0;
    this.birdGain.connect(this.master);
    this.hailRoof = ctx.createBiquadFilter();
    this.hailRoof.type = 'lowpass';
    this.hailRoof.frequency.value = 16000;
    this.hailGain = ctx.createGain();
    this.hailGain.gain.value = 0;
    this.hailRoof.connect(this.hailGain).connect(this.master);
    this.leafGain = ctx.createGain();
    this.leafGain.gain.value = 0;
    this.leafGain.connect(this.master);
    this.dripGain = ctx.createGain();
    this.dripGain.gain.value = 0;
    this.dripGain.connect(this.master);
    this.flagGain = ctx.createGain();
    this.flagGain.gain.value = 0;
    this.flagGain.connect(this.master);
    this.fireworksGain = ctx.createGain();
    this.fireworksGain.gain.value = 0;
    this.fireworksGain.connect(this.master);
    // the telly's speaker: small and boxy, no lows and no sparkle
    this.tv = ctx.createGain();
    this.tv.gain.value = 1; // clearly on, but turned down a notch: the speaker takes the rest
    const box = ctx.createBiquadFilter();
    box.type = 'highpass';
    box.frequency.value = 280;
    const tinny = ctx.createBiquadFilter();
    tinny.type = 'lowpass';
    tinny.frequency.value = 4500;
    this.tv.connect(box).connect(tinny).connect(this.master);
    this.cicadaSynth = ctx.createGain();
    buzz.connect(chirp).connect(pulse).connect(this.cicadaSynth).connect(waves).connect(this.cicadaGain).connect(this.master);
    buzz.start();
    fast.start();
    slow.start();

    for (const [kind, names] of Object.entries(CLIPS) as [Clip, string[]][]) {
      this.clips.set(kind, names.map((name) =>
        fetch(`${AUDIO}${name}.mp3`)
          .then((r) => r.arrayBuffer())
          .then((data) => ctx.decodeAudioData(data)),
      ));
    }
    this.load('island');
    if (this.wantsFestive) this.load('festive');
    if (this.atRiver) this.load('river');
  }

  // --- the recordings -----------------------------------------------------------------------

  /** Fetch and decode a set of recordings (once), switching each bed over as it arrives. */
  private load(set: SfxSet) {
    if (this.loading.has(set) || !this.ctx) return;
    this.loading.add(set);
    const ctx = this.ctx;
    for (const [name, takes] of Object.entries(SFX[set])) {
      const files = takes === 1 ? [name] : Array.from({ length: takes }, (_, i) => `${name}-${i + 1}`);
      void Promise.all(files.map((file) =>
        fetch(`${AUDIO}sfx/${file}.mp3`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${file}: ${r.status}`))))
          .then((data) => ctx.decodeAudioData(data)),
      ))
        .then((buffers) => {
          this.sfx.set(name, buffers);
          this.arrived(name);
        })
        .catch(() => {}); // the synthesised one carries on
    }
  }

  /** A bed's recording is in: loop it into its chain and fade the synthesised one out. */
  private arrived(name: string) {
    const t = this.ctx!.currentTime;
    const out = (synth?: GainNode) => synth?.gain.setTargetAtTime(0, t, 1.5);
    switch (name) {
      case 'sea':
        this.bed('sea', this.seaWalls!, BED.sea);
        out(this.seaSynth);
        break;
      case 'fire':
        this.bed('fire', this.fireGain!, BED.fire);
        this.fireRecorded = true;
        break;
      case 'rain': {
        const rain = this.bed('rain', this.rainGain!, BED.rain);
        rain.connect(this.roof!); // and the same rain on the roof, heard from indoors
        out(this.rainSynth);
        break;
      }
      case 'wind':
        this.bed('wind', this.gusting!, BED.wind); // still gusting on the same slow swells
        out(this.windSynth);
        break;
      case 'cicadas':
        this.bed('cicadas', this.cicadaWaves!, BED.cicadas);
        out(this.cicadaSynth);
        break;
      case 'crickets':
        this.bed('crickets', this.cricketGain!, BED.crickets);
        break;
      case 'birdsong':
        this.bed('birdsong', this.birdGain!, BED.birdsong);
        break;
      case 'hail':
        this.bed('hail', this.hailRoof!, BED.hail);
        break;
      case 'leaves':
        this.bed('leaves', this.leafGain!, BED.leaves);
        break;
      case 'drips':
        this.bed('drips', this.dripGain!, BED.drips);
        break;
      case 'flag':
        this.bed('flag', this.flagGain!, BED.flag);
        break;
      case 'fireworks':
        this.bed('fireworks', this.fireworksGain!, BED.fireworks);
        break;
      case 'simmer':
      case 'typing':
      case 'clockwork':
      case 'workshop': {
        const g = this.ctx!.createGain();
        g.gain.value = 0;
        g.connect(this.master!);
        this.bed(name, g, 1);
        this.roomBeds.set(name, g);
        break;
      }
      case 'dio-student':
      case 'dio-backbone':
      case 'dio-entrnce': {
        const g = this.ctx!.createGain();
        g.gain.value = 0;
        g.connect(this.master!);
        this.bed(name, g, 1);
        this.places.set(name.slice(4), g);
        break;
      }
      case 'tv-murder':
      case 'tv-location':
      case 'tv-bnb':
      case 'tv-rail': {
        const g = this.ctx!.createGain();
        g.gain.value = 0;
        g.connect(this.tv!);
        this.bed(name, g, 1);
        this.shows.set(name.slice(3), g);
        break;
      }
    }
  }

  /** A recording on an endless loop from a random point, through a gain (returned) into `into`. */
  private bed(name: string, into: AudioNode, gain: number) {
    const ctx = this.ctx!;
    const buffer = seamless(ctx, this.sfx.get(name)![0]);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(into);
    src.start(0, Math.random() * buffer.duration);
    return g;
  }

  /**
   * One take of a recorded one-shot, never the same one twice running and a touch higher or lower
   * each time. False if it hasn't arrived yet, so the synthesised one can play instead.
   */
  private play(name: string, volume = 1, opts: { air?: number; delay?: number; rate?: number; pan?: number } = {}): boolean {
    const takes = this.sfx.get(name);
    if (!takes || !this.ctx || !this.master) return false;
    const ctx = this.ctx;
    const n = takes.length;
    const i = n === 1 ? 0 : ((this.lastTake.get(name) ?? -1) + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.lastTake.set(name, i);
    const src = ctx.createBufferSource();
    src.buffer = takes[i];
    src.playbackRate.value = (opts.rate ?? 1) * (0.94 + Math.random() * 0.12);
    const gain = ctx.createGain();
    const hush = STARTLING[name] === undefined ? 1 : 1 - (1 - STARTLING[name]) * this.night;
    gain.gain.value = (LEVEL[name] ?? 0.5) * volume * hush;
    let out: AudioNode = src;
    if (opts.air && opts.air < 18000) {
      const air = ctx.createBiquadFilter();
      air.type = 'lowpass';
      air.frequency.value = opts.air;
      out = src.connect(air);
    }
    if (opts.pan) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, opts.pan));
      out = out.connect(pan);
    }
    out.connect(gain).connect(this.master);
    src.start(ctx.currentTime + (opts.delay ?? 0));
    return true;
  }

  /**
   * The guitar as heard outdoors, by a fire: no walls, so the chain strips the recording's
   * boom and fizz, evens out the loud and quiet passages, and adds only what open air gives
   * back: one bounce off the ground and a faint, short scatter from rocks and trees.
   */
  private buildSongChain(ctx: AudioContext) {
    this.songBus = ctx.createGain();

    // cut the low rumble and the boxy room build-up a close mic picks up
    const lows = ctx.createBiquadFilter();
    lows.type = 'highpass';
    lows.frequency.value = 85;
    lows.Q.value = 0.6;
    const box = ctx.createBiquadFilter();
    box.type = 'peaking';
    box.frequency.value = 280;
    box.Q.value = 1;
    box.gain.value = -3;
    // a touch of body in the strings, and the pick scrape tamed
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 2200;
    body.Q.value = 0.8;
    body.gain.value = 1.5;
    const fizz = ctx.createBiquadFilter();
    fizz.type = 'highshelf';
    fizz.frequency.value = 7000;
    fizz.gain.value = -4;

    // gentle levelling, so quiet verses and loud choruses sit closer together
    const level = ctx.createDynamicsCompressor();
    level.threshold.value = -22;
    level.knee.value = 10;
    level.ratio.value = 2.5;
    level.attack.value = 0.015;
    level.release.value = 0.3;
    // the compressor adds its own makeup gain; bring the result back to the old level
    const makeup = ctx.createGain();
    makeup.gain.value = MAKEUP;

    this.songAir = ctx.createBiquadFilter();
    this.songAir.type = 'lowpass';
    this.songAir.frequency.value = 13500;
    this.songAir.Q.value = 0.5;

    this.songBus
      .connect(lows)
      .connect(box)
      .connect(body)
      .connect(fizz)
      .connect(level)
      .connect(makeup)
      .connect(this.songAir)
      .connect(this.master!);

    // the ground bounce: a quiet, darker copy a few milliseconds late
    const bounce = ctx.createDelay(0.1);
    bounce.delayTime.value = 0.011;
    const bounceTone = ctx.createBiquadFilter();
    bounceTone.type = 'lowpass';
    bounceTone.frequency.value = 3000;
    const bounceGain = ctx.createGain();
    bounceGain.gain.value = 0.18;
    this.songAir.connect(bounce).connect(bounceTone).connect(bounceGain).connect(this.master!);

    // open-air scatter: a short, sparse, fast-dying tail with no room to ring in
    const scatter = ctx.createConvolver();
    scatter.buffer = this.scatterImpulse(ctx);
    const scatterTone = ctx.createBiquadFilter();
    scatterTone.type = 'bandpass';
    scatterTone.frequency.value = 1200;
    scatterTone.Q.value = 0.5;
    const scatterGain = ctx.createGain();
    scatterGain.gain.value = 0.1;
    this.songAir.connect(scatterTone).connect(scatter).connect(scatterGain).connect(this.master!);
  }

  /**
   * The piano as heard in the library: a wood-panelled room full of books, so a warm, short
   * bloom rather than a hall. Books soak up the highs; the low end is kept but not boomy.
   */
  /**
   * The gramophone: everything squeezed through a horn (no lows, no highs, a honk around
   * 1.5 kHz, a touch of grit), then a small wooden workshop. Surface noise runs beside it:
   * hiss plus the odd crackle and pop, which the record fades up while it plays.
   */
  private buildRecordChain(ctx: AudioContext) {
    this.recordBus = ctx.createGain();
    const lows = ctx.createBiquadFilter();
    lows.type = 'highpass';
    lows.frequency.value = 320;
    lows.Q.value = 0.9;
    const highs = ctx.createBiquadFilter();
    highs.type = 'lowpass';
    highs.frequency.value = 3800;
    highs.Q.value = 0.9;
    const horn = ctx.createBiquadFilter();
    horn.type = 'peaking';
    horn.frequency.value = 1500;
    horn.Q.value = 1.1;
    horn.gain.value = 6;
    const grit = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8);
    }
    grit.curve = curve;
    const level = ctx.createGain();
    level.gain.value = 0.8;
    this.recordBus.connect(lows).connect(highs).connect(horn).connect(grit).connect(level).connect(this.master!);
    const room = ctx.createConvolver();
    room.buffer = this.roomImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    level.connect(room).connect(wet).connect(this.master!);

    // the groove: a second of hiss with crackles and the occasional pop in it, on a loop
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.08;
    for (let k = 0; k < 90; k++) {
      const at = Math.floor(Math.random() * (len - 200));
      const amp = Math.random() < 0.08 ? 0.9 : 0.25 + Math.random() * 0.35;
      for (let j = 0; j < 40; j++) d[at + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / 6);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const tone = ctx.createBiquadFilter();
    tone.type = 'bandpass';
    tone.frequency.value = 2600;
    tone.Q.value = 0.6;
    this.surface = ctx.createGain();
    this.surface.gain.value = 0;
    src.connect(tone).connect(this.surface).connect(this.master!);
    src.start();
  }

  private buildPianoChain(ctx: AudioContext) {
    this.pianoBus = ctx.createGain();
    const lows = ctx.createBiquadFilter();
    lows.type = 'highpass';
    lows.frequency.value = 45;
    const soft = ctx.createBiquadFilter();
    soft.type = 'highshelf';
    soft.frequency.value = 8000;
    soft.gain.value = -2;
    this.pianoBus.connect(lows).connect(soft).connect(this.master!);

    const room = ctx.createConvolver();
    room.buffer = this.roomImpulse(ctx);
    const roomTone = ctx.createBiquadFilter();
    roomTone.type = 'lowpass';
    roomTone.frequency.value = 4500;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    soft.connect(room).connect(roomTone).connect(wet).connect(this.master!);
  }

  /** A dense, smooth ~1.4s tail, a little different per ear: a room, not open air. */
  private roomImpulse(ctx: AudioContext) {
    const len = Math.floor(ctx.sampleRate * 1.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    const pre = Math.floor(ctx.sampleRate * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = pre; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-(i - pre) / len) * 5.5) * 0.5;
    }
    return ir;
  }

  /** Sparse echoes over ~0.7s, different per ear, fading fast: trees and rocks, not walls. */
  private scatterImpulse(ctx: AudioContext) {
    const len = Math.floor(ctx.sampleRate * 0.7);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = Math.floor(ctx.sampleRate * 0.02); i < len; i++) {
        if (Math.random() < 0.006) d[i] = (Math.random() * 2 - 1) * Math.exp((-i / len) * 7);
      }
    }
    return ir;
  }

  private crackle(near: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 2500;
    bp.Q.value = 3;
    const env = ctx.createGain();
    const t = ctx.currentTime;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.6 + Math.random() * 0.8, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.03 + Math.random() * 0.06);
    src.connect(bp).connect(env).connect(this.fireGain!);
    src.start(t, Math.random() * 1.5, 0.12);
    this.nextCrackle = t + 0.04 + Math.random() * (0.35 / Math.max(near, 0.2));
  }

  private stream(file: string, loop: boolean, into: AudioNode = this.master!) {
    const el = new Audio(`${AUDIO}${file}`);
    el.loop = loop;
    el.preload = 'auto';
    const gain = this.ctx!.createGain();
    this.ctx!.createMediaElementSource(el).connect(gain).connect(into);
    return { el, gain };
  }

  private fadeOutAndDrop(el: HTMLAudioElement, gain: GainNode, seconds = 0.25) {
    gain.gain.setTargetAtTime(0, this.ctx!.currentTime, seconds);
    setTimeout(() => {
      el.pause();
      el.src = '';
      gain.disconnect();
    }, seconds * 4800);
  }
}

/**
 * A loop without a click where it wraps: the codec's padding shaved off both ends, and the tail
 * crossfaded (equal power) into the head.
 */
function seamless(ctx: AudioContext, buffer: AudioBuffer, fade = 1.2): AudioBuffer {
  const rate = buffer.sampleRate;
  const pad = Math.floor(rate * 0.05);
  const x = Math.min(Math.floor(rate * fade), Math.floor((buffer.length - 2 * pad) / 3));
  const len = buffer.length - 2 * pad - x;
  const out = ctx.createBuffer(buffer.numberOfChannels, len, rate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch).subarray(pad, buffer.length - pad);
    const d = out.getChannelData(ch);
    d.set(src.subarray(0, len));
    for (let i = 0; i < x; i++) {
      const k = (i / x) * (Math.PI / 2);
      d[i] = src[i] * Math.sin(k) + src[len + i] * Math.cos(k);
    }
  }
  return out;
}

/** A fair shuffle (Fisher-Yates), in place. */
function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
