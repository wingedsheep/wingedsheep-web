/**
 * All island audio, built on one AudioContext:
 *  - the sea: filtered noise that swells like waves (synthesised, no files)
 *  - campfire crackle: tiny noise bursts, louder the closer the camera is
 *  - guitar: Vincent's recordings. A quiet teaser loop plays when you come near the
 *    campfire; clicking him plays the whole song.
 * Nothing makes a sound until the visitor turns sound on.
 */
export interface Song {
  id: number;
  title: string;
  duration: number;
}

const AUDIO = '/audio/';

export class Sound {
  enabled = false;
  private ctx?: AudioContext;
  private master?: GainNode;
  private seaGain?: GainNode;
  private fireGain?: GainNode;
  private teaser?: { el: HTMLAudioElement; gain: GainNode; song: number };
  private song?: { el: HTMLAudioElement; gain: GainNode; id: number };
  private noise?: AudioBuffer;
  private nextCrackle = 0;
  private readonly ext: 'webm' | 'm4a';
  onSongChange?: (song: Song | null) => void;

  constructor(private songs: Song[]) {
    const probe = document.createElement('audio');
    this.ext = probe.canPlayType('audio/webm; codecs="opus"') ? 'webm' : 'm4a';
  }

  get playing(): Song | null {
    return this.song ? (this.songs.find((s) => s.id === this.song!.id) ?? null) : null;
  }

  /** Must be called from a user gesture. */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.start();
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.3);
    if (!on) this.stopSong();
  }

  playSong(id: number) {
    this.setEnabled(true);
    this.stopSong();
    const { el, gain } = this.stream(`guitar-${id}`, false);
    gain.gain.value = 0.9;
    el.addEventListener('ended', () => this.stopSong());
    void el.play();
    this.song = { el, gain, id };
    this.onSongChange?.(this.playing);
  }

  stopSong() {
    if (!this.song) return;
    const { el, gain } = this.song;
    this.fadeOutAndDrop(el, gain);
    this.song = undefined;
    this.onSongChange?.(null);
  }

  /** Next song in the setlist, wrapping around. */
  nextSongId(): number {
    const i = this.songs.findIndex((s) => s.id === this.song?.id);
    return this.songs[(i + 1) % this.songs.length].id;
  }

  /** Called every frame with how close (0..1) the camera is to the campfire. */
  update(campfireNearness: number, zoomedIn: boolean) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const near = Math.max(0, Math.min(1, campfireNearness));
    this.fireGain?.gain.setTargetAtTime(near * 0.5, t, 0.2);
    this.seaGain?.gain.setTargetAtTime(0.28 - near * 0.12, t, 0.5);
    if (near > 0 && t > this.nextCrackle) this.crackle(near);

    // teaser: faint strumming when you come close, silent while a full song plays
    const want = !this.song && zoomedIn && near > 0.15;
    if (want && !this.teaser) this.startTeaser();
    if (this.teaser) this.teaser.gain.gain.setTargetAtTime(want ? near * 0.35 : 0, t, 0.6);
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

  private startTeaser() {
    const id = this.songs[Math.floor(Math.random() * this.songs.length)].id;
    const { el, gain } = this.stream(`guitar-${id}-tease`, true);
    gain.gain.value = 0;
    void el.play();
    this.teaser = { el, gain, song: id };
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
