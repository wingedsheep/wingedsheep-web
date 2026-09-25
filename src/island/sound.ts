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
 *  - the wildlife: gulls, robins, the owl, ducks, geese and the whale's blow (synthesised)
 *  - weather: hissing rain, rolling thunder, gusting wind and cicadas on a hot day (synthesised)
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
  /** The river's rush, once someone has been out on it. */
  private rush?: { gain: GainNode; filter: BiquadFilterNode };
  private atRiver = false;
  /** Set every frame by the weather, 0..1 each. */
  rain = 0;
  wind = 0;
  /** How rough the sea is, 0..1: louder, lower surf with a faster swell. */
  sea = 0;
  cicadas = 0;
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

  /**
   * An animal's call, synthesised: a robin's chirps, a gull's cry, a tawny owl's hoo-hoo, a
   * quack, geese honking overhead, the whale's blow and splash, the sea serpent's roar, Rocky's chords, the Super
   * Sheep going off and Gandalf's fireworks. `volume` falls off with distance.
   */
  call(kind: Call, volume = 1) {
    if (kind === 'baa') return this.clip('baa', 0.5 * volume);
    if (!this.enabled || !this.ctx || !this.master) return;
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
      case 'firework': // Gandalf's: a whistle up, a bang, and a crackle as it falls
        tone('sine', 0, [[0, 700], [0.65, 2600]], 0.05, 0.7);
        hiss(0.7, 0.9, 300, 0.45);
        tone('sine', 0.7, [[0, 90], [0.3, 40]], 0.3, 0.5);
        for (let i = 0; i < 10; i++) hiss(0.9 + r(0, 0.9), 0.06, 3500, 0.12);
        break;
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
  riverWater(on: boolean, rough = 0, speed = 0) {
    this.atRiver = on;
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
    const t = ctx.currentTime;
    this.rush.gain.gain.setTargetAtTime(on ? 0.12 + rough * 0.5 + speed * 0.02 : 0, t, on ? 0.4 : 0.2);
    this.rush.filter.frequency.setTargetAtTime(500 + rough * 1600 + speed * 60, t, 0.5);
  }

  /** The river's own sounds: a paddle stroke, a knock on a rock, landing off a fall, and so on. */
  river(kind: RiverSound, volume = 1) {
    if (!this.enabled || !this.ctx || !this.master) return;
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
      case 'croak': // a heron, put out: a harsh, rasping "fraank"
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
    const near = this.indoors || this.atRiver ? 0 : Math.max(0, Math.min(1, campfireNearness));
    const walls = this.atRiver ? 0 : this.indoors ? 0.3 : 1; // indoors the sea and the wind come through the walls
    this.fireGain?.gain.setTargetAtTime(near * 0.5, t, 0.2);
    this.seaGain?.gain.setTargetAtTime((0.28 + this.sea * 0.3 - near * 0.12) * walls, t, 0.5);
    this.seaLfo?.frequency.setTargetAtTime(0.11 + this.sea * 0.12, t, 2);
    this.rainGain?.gain.setTargetAtTime(this.rain * 0.22 * (this.indoors ? 0.25 : 1), t, 1);
    this.roofGain?.gain.setTargetAtTime(this.indoors ? this.rain * 0.5 : 0, t, 0.6); // indoors, it drums on the roof
    // squared, so a breeze on a fair day is a whisper and only real wind howls
    this.windGain?.gain.setTargetAtTime(this.wind * this.wind * 0.35 * (this.atRiver ? 1 : walls), t, 1);
    this.cicadaGain?.gain.setTargetAtTime(this.cicadas * 0.05 * walls, t, 1.5);
    if (near > 0 && t > this.nextCrackle) this.crackle(near);

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
    this.master.connect(ctx.destination);

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
    sea.connect(lp).connect(swell).connect(this.seaGain).connect(this.master);
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
    rain.connect(hiss).connect(this.rainGain).connect(this.master);
    // the same rain heard from indoors: the hiss muffled by the roof into a soft, uneven drumming
    const roof = ctx.createBiquadFilter();
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
    rain.connect(roof).connect(patter).connect(this.roofGain).connect(this.master);
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
    gusts.connect(howl).connect(gusting).connect(this.windGain).connect(this.master);
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
    waves.gain.value = 0.5;
    const slow = ctx.createOscillator();
    slow.frequency.value = 0.12;
    const slowDepth = ctx.createGain();
    slowDepth.gain.value = 0.5;
    slow.connect(slowDepth).connect(waves.gain);
    this.cicadaGain = ctx.createGain();
    this.cicadaGain.gain.value = 0;
    buzz.connect(chirp).connect(pulse).connect(waves).connect(this.cicadaGain).connect(this.master);
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

/** A fair shuffle (Fisher-Yates), in place. */
function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
