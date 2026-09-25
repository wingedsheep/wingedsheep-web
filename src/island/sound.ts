/**
 * All island audio, built on one AudioContext:
 *  - the sea: filtered noise that swells like waves (synthesised, no files)
 *  - campfire crackle: tiny noise bursts, louder the closer the camera is
 *  - guitar: Vincent's recordings. He only plays once you've zoomed in close to the campfire
 *    and asked him to (clicked him): he starts a random song from the top, then carries on
 *    through the setlist until you wander off. The recordings run through an "outdoors" chain:
 *    levelled to one loudness, the room boom and harsh top trimmed, a little ground bounce and
 *    open-air scatter added, and duller the further away you stand.
 *  - the winged sheep: a baa when you click it (short clips, decoded up front)
 *  - Charlie and George: a synthesised purr when you pet them
 *  - weather: hissing rain, rolling thunder, gusting wind and cicadas on a hot day (synthesised)
 * Sound is on by default, but browsers only allow audio after a user gesture, so it starts on
 * the visitor's first click, tap or key press (unless they've muted it by then).
 */
export interface Song {
  id: number;
  title: string;
  duration: number;
  /** Integrated loudness of the recording in LUFS, so every song plays at the same level. */
  loudness?: number;
}

const AUDIO = '/audio/';
const BAAS = ['sheep-1', 'sheep-2', 'sheep-3'];
/** Every song is trimmed to this loudness (LUFS) before it hits the outdoor chain. */
const TARGET_LUFS = -16;
const MAKEUP = 0.85;

export class Sound {
  enabled = true;
  private ctx?: AudioContext;
  private master?: GainNode;
  private seaGain?: GainNode;
  private fireGain?: GainNode;
  private rainGain?: GainNode;
  /** Where songs enter the outdoor chain, and the lowpass that dulls them with distance. */
  private songBus?: GainNode;
  private songAir?: BiquadFilterNode;
  private windGain?: GainNode;
  private cicadaGain?: GainNode;
  /** Set every frame by the weather, 0..1 each. */
  rain = 0;
  wind = 0;
  cicadas = 0;
  private song?: { el: HTMLAudioElement; gain: GainNode; id: number; live: boolean };
  private asked = false;
  private loudness = 0;
  private silentFor = 0;
  private noise?: AudioBuffer;
  private baas: Promise<AudioBuffer>[] = [];
  private lastBaa = -1;
  private nextCrackle = 0;
  private lastSong = -1;
  private readonly ext: 'webm' | 'm4a';

  constructor(private songs: Song[]) {
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

  /** Must be called from a user gesture. */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.start();
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.3);
    if (!on) this.dropSong();
  }

  /** Ask Vincent for a song. He plays while you stay close, and stops once you wander off. */
  ask() {
    this.asked = true;
    this.silentFor = 0;
  }

  /** One of the sheep's baas, never the same one twice in a row. Silent while sound is off. */
  baa() {
    if (!this.enabled || !this.ctx) return;
    const i = (this.lastBaa + 1 + Math.floor(Math.random() * (BAAS.length - 1))) % BAAS.length;
    this.lastBaa = i;
    void this.baas[i].then((buffer) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = 0.95 + Math.random() * 0.1;
      const gain = this.ctx!.createGain();
      gain.gain.value = 0.7;
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
    const near = Math.max(0, Math.min(1, campfireNearness));
    this.fireGain?.gain.setTargetAtTime(near * 0.5, t, 0.2);
    this.seaGain?.gain.setTargetAtTime(0.28 - near * 0.12, t, 0.5);
    this.rainGain?.gain.setTargetAtTime(this.rain * 0.22, t, 1);
    this.windGain?.gain.setTargetAtTime(this.wind * 0.35, t, 1);
    this.cicadaGain?.gain.setTargetAtTime(this.cicadas * 0.05, t, 1.5);
    if (near > 0 && t > this.nextCrackle) this.crackle(near);

    // the guitar only carries when you're zoomed right in on the fire
    const close = Math.max(0, Math.min(1, (24 - view) / 10));
    this.loudness = this.asked ? near * close : 0;
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
    const { el, gain } = this.stream(`guitar-${id}`, false, this.songTrim(id));
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
    lfoDepth.gain.value = 0.4;
    lfo.connect(lfoDepth).connect(swell.gain);
    this.seaGain = ctx.createGain();
    this.seaGain.gain.value = 0.28;
    sea.connect(lp).connect(swell).connect(this.seaGain).connect(this.master);
    sea.start();
    lfo.start();

    this.buildSongChain(ctx);

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

    this.baas = BAAS.map((name) =>
      fetch(`${AUDIO}${name}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data)),
    );
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

  private stream(name: string, loop: boolean, into: AudioNode = this.master!) {
    const el = new Audio(`${AUDIO}${name}.${this.ext}`);
    el.loop = loop;
    el.preload = 'auto';
    const gain = this.ctx!.createGain();
    this.ctx!.createMediaElementSource(el).connect(gain).connect(into);
    return { el, gain };
  }

  private fadeOutAndDrop(el: HTMLAudioElement, gain: GainNode) {
    gain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.25);
    setTimeout(() => {
      el.pause();
      el.src = '';
      gain.disconnect();
    }, 1200);
  }
}
