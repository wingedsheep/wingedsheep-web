/**
 * All island audio, built on one AudioContext:
 *  - the sea: filtered noise that swells like waves (synthesised, no files)
 *  - campfire crackle: tiny noise bursts, louder the closer the camera is
 *  - guitar: Vincent's recordings. The setlist runs around the clock (the position is derived
 *    from the wall clock, so he always picks up mid-song), but he only plays once you've
 *    zoomed in close to the campfire and asked him to (clicked him).
 *  - the winged sheep: a baa when you click it (short clips, decoded up front)
 *  - Charlie and George: a synthesised purr when you pet them
 * Sound is on by default, but browsers only allow audio after a user gesture, so it starts on
 * the visitor's first click, tap or key press (unless they've muted it by then).
 */
export interface Song {
  id: number;
  title: string;
  duration: number;
}

const AUDIO = '/audio/';
const BAAS = ['sheep-1', 'sheep-2', 'sheep-3'];

export class Sound {
  enabled = true;
  private ctx?: AudioContext;
  private master?: GainNode;
  private seaGain?: GainNode;
  private fireGain?: GainNode;
  private song?: { el: HTMLAudioElement; gain: GainNode; id: number; live: boolean };
  private asked = false;
  private loudness = 0;
  private silentFor = 0;
  private noise?: AudioBuffer;
  private baas: Promise<AudioBuffer>[] = [];
  private lastBaa = -1;
  private nextCrackle = 0;
  private readonly ext: 'webm' | 'm4a';
  private readonly setlistLength: number;

  constructor(private songs: Song[]) {
    const probe = document.createElement('audio');
    this.ext = probe.canPlayType('audio/webm; codecs="opus"') ? 'webm' : 'm4a';
    this.setlistLength = songs.reduce((sum, s) => sum + s.duration, 0);

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
    if (near > 0 && t > this.nextCrackle) this.crackle(near);

    // the guitar only carries when you're zoomed right in on the fire
    const close = Math.max(0, Math.min(1, (24 - view) / 10));
    this.loudness = this.asked ? near * close : 0;
    if (this.loudness > 0.02 && !this.song) this.joinSong();
    if (this.song) this.song.gain.gain.setTargetAtTime(this.loudness * 0.9, t, 0.6);
    // stop streaming once you've been out of earshot for a while
    this.silentFor = this.loudness > 0.02 ? 0 : this.silentFor + dt;
    if (this.silentFor > 4) {
      this.dropSong();
      this.asked = false;
    }
  }

  /** Pick up wherever Vincent is in the setlist right now. */
  private joinSong() {
    let at = (Date.now() / 1000) % this.setlistLength;
    for (const song of this.songs) {
      if (at < song.duration) return this.playFrom(song.id, at);
      at -= song.duration;
    }
  }

  private playFrom(id: number, offset: number) {
    const { el, gain } = this.stream(`guitar-${id}`, false);
    gain.gain.value = 0;
    el.currentTime = offset;
    el.addEventListener('ended', () => {
      if (this.song?.el !== el) return;
      this.song = undefined;
      const next = this.songs[(this.songs.findIndex((s) => s.id === id) + 1) % this.songs.length];
      this.playFrom(next.id, 0);
    });
    const song = { el, gain, id, live: false };
    el.addEventListener('playing', () => (song.live = true), { once: true });
    void el.play();
    this.song = song;
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

    this.fireGain = ctx.createGain();
    this.fireGain.gain.value = 0;
    this.fireGain.connect(this.master);

    this.baas = BAAS.map((name) =>
      fetch(`${AUDIO}${name}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data)),
    );
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

  private stream(name: string, loop: boolean) {
    const el = new Audio(`${AUDIO}${name}.${this.ext}`);
    el.loop = loop;
    el.preload = 'auto';
    const gain = this.ctx!.createGain();
    this.ctx!.createMediaElementSource(el).connect(gain).connect(this.master!);
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
