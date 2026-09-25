/**
 * Wild water: the kayak off the pier goes a lot further than round the island. Through the iris
 * like a room, but outdoors: an endless mountain river (src/island/river/), made up ahead of you,
 * lit by the island's own sun and weather. Distance times flow is the score, and the best stays
 * in this browser.
 */
import * as THREE from 'three';
import type { IslandContext } from './content';
import type { RoomInput } from './scene/camera-rig';
import type { PixelRenderer } from './scene/pixel-renderer';
import type { Device } from './river/controls';
import type { Stretch } from './river/course';
import type { Hint, RiverGame, Tally } from './river/game';
import { TIP } from './river/kayak';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
const BEST = 'wingedsheep:river';

/** What the river is like as you come into it, for the banner. */
function banner(s: Stretch, index: number) {
  switch (s.kind) {
    case 'rapids': return `Grade ${s.grade} · ${s.name}`;
    case 'cascade': return `Grade ${s.grade} · ${s.name}, all the way down`;
    case 'gorge': return `Grade ${s.grade} · The gorge`;
    case 'falls': return 'Is that… a waterfall?';
    case 'pool': return index === 0 ? 'A slow green pool. Get the feel of her.' : 'A slow green pool';
    case 'run': return 'Into the forest';
  }
}

/** How to deal with each thing, the first time it comes up, for whatever's in your hands. */
const HINTS: Record<Hint, Record<Device, string>> = {
  paddle: {
    keys: 'Hold ↑ (or A and D) to paddle straight on. Just A sweeps on the left and turns you right; Q / E brakes on that side',
    pad: 'Hold L2 and R2 to paddle straight on. One trigger sweeps on that side and turns you away; L1 / R1 brakes on that side',
    touch: 'Hold both sides of the screen to paddle. One side turns you away from it; low down brakes on that side',
  },
  lean: {
    keys: 'She’s tipping: lean against it with ← / →',
    pad: 'She’s tipping: lean against it with the left stick',
    touch: '',
  },
  brace: {
    keys: 'Going over! Q or E on that side to brace (or Space)',
    pad: 'Going over! L1 or R1 on that side to brace (or ✕)',
    touch: 'Going over! Tap low down on that side to brace',
  },
  boof: {
    keys: 'A ledge: a fresh stroke right at the lip, not leaning forward, boofs it',
    pad: 'A ledge: a fresh stroke right at the lip, not leaning forward, boofs it',
    touch: 'A ledge: a fresh stroke right at the lip boofs it',
  },
  falls: {
    keys: 'A waterfall: lean forward (W) and tuck as you go over. Don’t land flat',
    pad: 'A waterfall: push the stick forward and tuck as you go over. Don’t land flat',
    touch: 'A waterfall: hold on tight',
  },
  hole: {
    keys: 'In a hole! Lean forward (W) and paddle hard to punch through. Lean back and it’ll have you',
    pad: 'In a hole! Stick forward and paddle hard to punch through. Lean back and it’ll have you',
    touch: 'In a hole! Keep paddling, or it’ll spit you out sideways',
  },
  roll: {
    keys: 'Upside down! Brace (Space) when the needle’s in the gap',
    pad: 'Upside down! Brace (✕, L1 or R1) when the needle’s in the gap',
    touch: 'Upside down! Tap when the needle’s in the gap',
  },
  tongue: {
    keys: 'Aim for the dark V between the rocks: that’s the fast line',
    pad: 'Aim for the dark V between the rocks: that’s the fast line',
    touch: 'Aim for the dark V between the rocks: that’s the fast line',
  },
};

/** How it ends. */
const SWIMS = [
  'Vincent swims the kayak to the bank, still holding the paddle.',
  'Upside down, briefly. Then for rather longer.',
  'The river wins this one. It usually does.',
  'Out, on the bank, emptying the kayak. Then the other shoe.',
];

interface Best {
  score: number;
  metres: number;
}

const round = (n: number) => Math.round(n).toLocaleString('en-GB');

export class River implements RoomInput {
  /** Whether the river (rather than the island) is on screen. */
  inside = false;
  private want = false;
  private fade = 0;
  private game?: RiverGame;
  private loading?: Promise<RiverGame | undefined>;
  private el: HTMLElement;
  private bannerTimer = 0;
  private hintTimer = 0;
  private lastHud = '';
  private swims = 0;
  private best: Best = readBest();
  private fresh = false; // a new best this run
  private $: Record<string, HTMLElement> = {};

  constructor(
    private ctx: IslandContext,
    private ui: UI,
    private pixels: PixelRenderer,
    private host: HTMLElement,
    private reducedMotion: boolean,
    private island: THREE.Scene,
  ) {
    this.el = document.querySelector<HTMLElement>('[data-panel="river"]')!;
    for (const name of ['metres', 'flow', 'score', 'balls', 'banner', 'hint', 'breath', 'gauge', 'roll', 'praise', 'flash']) {
      this.$[name] = this.el.querySelector<HTMLElement>(`[data-river-${name}]`)!;
    }
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-river-go]')) b.addEventListener('click', () => this.go());
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-river-resume]')) b.addEventListener('click', () => this.pause(false));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(true);
    });
    this.showBest();
  }

  /** Whether the pointer should drive the river rather than the island. */
  get wanted() {
    return this.want;
  }

  load() {
    this.loading ??= import('./river/game')
      .then(({ RiverGame }) => RiverGame.load(this.host.querySelector('canvas')!, () => this.pixels.height))
      .then((game) => {
        this.game = game;
        this.wire(game);
        this.resize();
        return game;
      })
      .catch((err) => {
        console.error(err);
        this.want = false;
        this.ui.close();
        this.ctx.toast('The river’s not running today. Try again in a bit?');
        return undefined;
      });
    return this.loading;
  }

  enter(open: boolean, instant = false) {
    if (open) void this.load();
    if (open && !this.want) this.card('ready');
    this.want = open;
    if (instant) this.fade = open === this.inside ? 0 : 1;
    this.ui.tooltip(null);
  }

  resize() {
    this.game?.resize(this.host.clientWidth, this.host.clientHeight);
  }

  zoom() {}

  pan() {}

  hover() {
    this.host.querySelector('canvas')!.style.cursor = '';
    this.ui.tooltip(null);
  }

  click() {
    if (this.game?.state === 'ready') this.go();
  }

  /** Push off (or, after a swim, a new river). */
  private go() {
    const game = this.game;
    if (!game || !this.inside) return;
    if (game.state === 'over') {
      game.reset();
      this.fresh = false;
      this.lastHud = '';
    }
    if (game.state !== 'ready') return;
    game.go();
    this.card(null);
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.ctx.discover('river');
  }

  private pause(on: boolean) {
    const game = this.game;
    if (!game || game.state !== 'running' || game.paused === on) return;
    game.paused = on;
    this.card(on ? 'paused' : null);
  }

  update(dt: number, night: number) {
    const step = this.reducedMotion ? 1 : dt / FADE;
    if (this.want !== this.inside) {
      this.fade = Math.min(1, this.fade + step);
      if (this.fade >= 1 && (!this.want || this.game)) this.swap();
    } else {
      this.fade = Math.max(0, this.fade - step);
    }
    this.pixels.uniforms.uFade.value = this.fade;
    const game = this.game;
    if (!this.inside || !game) return;
    try {
      this.run(game, dt, night);
    } catch (err) {
      // never take the island down with it: out of the river, and say so
      console.error(err);
      this.want = false;
      this.ui.close();
      this.ctx.toast('The river’s gone a bit wrong. Back to the island for now.');
    }
    if (this.bannerTimer > 0 && (this.bannerTimer -= dt) <= 0) this.$.banner.hidden = true;
    if (this.hintTimer > 0 && (this.hintTimer -= dt) <= 0) this.$.hint.hidden = true;
    if (this.el.dataset.device !== game.controls.device) this.el.dataset.device = game.controls.device;
  }

  private run(game: RiverGame, dt: number, night: number) {
    const w = this.ctx.weather.now;
    game.update(dt, {
      sun: this.ctx.sky.sun,
      hemi: this.ctx.sky.hemi,
      fog: (this.island.fog as THREE.Fog).color,
      night,
      rain: Math.min(1, w.rain + w.hail),
      snow: w.snow,
      fair: w.storm < 0.3 && w.rain < 0.2,
    });
    this.ctx.sound.riverWater(true, game.state === 'ready' ? 0.2 : game.rough, game.tally.speed);
    this.hud(game.tally);
    this.follow(game);
  }

  render() {
    const game = this.game!;
    this.pixels.render(game.scene, game.camera, game.subTexel);
  }

  private swap() {
    this.inside = this.want;
    const game = this.game;
    if (this.inside) {
      this.ctx.rig.room = this;
      game?.reset();
      this.fresh = false;
      this.lastHud = '';
      game?.controls.enable(true);
      this.resize();
    } else {
      if (this.ctx.rig.room === this) this.ctx.rig.room = null;
      game?.controls.enable(false);
      this.ctx.sound.riverWater(false);
    }
  }

  // --- on screen ------------------------------------------------------------------------------

  private wire(game: RiverGame) {
    game.controls.onGo = () => {
      if (this.game?.paused) this.pause(false);
      else if (this.game?.state !== 'running') this.go();
    };
    game.controls.onPause = () => this.pause(!this.game?.paused);
    game.events = {
      stretch: (s, i) => this.say(banner(s, i)),
      praise: (text, big) => this.praise(text, big),
      broke: (why) => this.praise(`${why} · flow lost`, false, true),
      hint: (kind) => this.hint(HINTS[kind][game.controls.device]),
      start: () => this.go(),
      over: (tally) => this.over(tally),
      say: (text) => this.ctx.toast(text),
      sound: (kind, volume) => this.ctx.sound.river(kind, volume),
      bark: () => this.ctx.sound.bark(),
      baa: () => this.ctx.sound.baa(),
      quack: () => this.ctx.sound.call('quack', 0.6),
    };
  }

  private say(text: string) {
    const el = this.$.banner;
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('in');
    void el.offsetWidth;
    el.classList.add('in');
    this.bannerTimer = 3.2;
  }

  private hint(text: string) {
    if (!text) return;
    const el = this.$.hint;
    el.textContent = text;
    el.hidden = false;
    this.hintTimer = 4.5;
  }

  /** A word popping up over the kayak: a boof, a brace, a clean gate (or the flow breaking). */
  private praise(text: string, big: boolean, bad = false) {
    const game = this.game;
    if (!game) return;
    const at = game.onScreen(game.kayak.pos, this.host.clientWidth, this.host.clientHeight);
    const el = document.createElement('span');
    el.className = `river-word${big ? ' big' : ''}${bad ? ' bad' : ''}`;
    el.textContent = text;
    el.style.left = `${Math.round(at.x)}px`;
    el.style.top = `${Math.round(at.y - 60)}px`;
    this.$.praise.append(el);
    setTimeout(() => el.remove(), 1100);
    if (!bad) {
      const flow = this.$.flow;
      flow.classList.remove('pop');
      void flow.offsetWidth;
      flow.classList.add('pop');
    }
  }

  /** Show one of the cards (the start, paused, a swim), or none. */
  private card(name: 'ready' | 'paused' | 'over' | null) {
    for (const c of this.el.querySelectorAll<HTMLElement>('[data-river-card]')) c.hidden = c.dataset.riverCard !== name;
    const shown = name && this.el.querySelector<HTMLElement>(`[data-river-card="${name}"] [data-river-go], [data-river-card="${name}"] [data-river-resume]`);
    shown?.focus({ preventScroll: true });
  }

  private hud(t: Tally) {
    const key = `${t.metres}|${t.balls}|${t.flow}|${Math.round(t.score)}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.$.metres.textContent = round(t.metres);
    this.$.balls.textContent = String(t.balls);
    this.$.score.textContent = round(t.score);
    this.$.flow.textContent = `×${t.flow.toFixed(1)}`;
    this.$.flow.style.setProperty('--heat', String(Math.min(1, (t.flow - 1) / 3)));
    if (t.score > this.best.score && t.score > 0) {
      if (!this.fresh && this.best.score > 0) this.say('A new best!');
      this.fresh = true;
      this.best = { score: Math.round(t.score), metres: t.metres };
      writeBest(this.best);
      this.showBest();
    }
  }

  /** The things that follow the kayak: its balance, the roll-up meter, a flash, your breath. */
  private follow(game: RiverGame) {
    const k = game.kayak;
    const at = game.onScreen(k.pos, this.host.clientWidth, this.host.clientHeight);
    // balance: a little arc under the kayak with a needle, when it's leaning at all
    const gauge = this.$.gauge;
    const leaning = k.balance !== 'rolling' && k.balance !== 'swimming' && game.state === 'running' && Math.abs(k.tilt) > 0.35;
    gauge.hidden = !leaning;
    if (leaning) {
      gauge.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y + 34)}px)`;
      // the kayak's right is the screen's left when it's pointing back at the camera
      const tilt = Math.max(-1.6, Math.min(1.6, k.tilt)) * (game.facingCamera ? -1 : 1);
      gauge.style.setProperty('--tilt', `${tilt * (180 / Math.PI) * 0.9}deg`);
      gauge.classList.toggle('danger', Math.abs(k.tilt) > TIP * 0.8);
    }
    // the roll: a needle sweeping across a bar, and the gap to hit
    const roll = this.$.roll;
    const rolling = k.balance === 'rolling' && k.roll.time > 0.45;
    roll.hidden = !rolling;
    if (rolling) {
      roll.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y - 70)}px)`;
      roll.style.setProperty('--needle', String(k.roll.needle));
      roll.style.setProperty('--window', String(k.roll.window));
    }
    // breath: only when you've used some
    this.$.breath.hidden = k.stamina > 0.98 || game.state !== 'running';
    this.$.breath.style.setProperty('--breath', String(k.stamina));
    this.$.breath.classList.toggle('puffed', k.stamina < 0.08);
    // the flash
    this.$.flash.style.opacity = String(game.flash.amount * 0.6);
    this.$.flash.style.background = `#${game.flash.color.getHexString()}`;
  }

  private showBest() {
    for (const el of this.el.querySelectorAll('[data-river-best]')) el.textContent = round(this.best.score);
  }

  private over(t: Tally) {
    const set = (sel: string, text: string) => {
      const el = this.el.querySelector(sel);
      if (el) el.textContent = text;
    };
    set('[data-river-line]', SWIMS[this.swims++ % SWIMS.length]);
    set('[data-over-metres]', `${round(t.metres)} m`);
    set('[data-over-flow]', `×${t.bestFlow.toFixed(1)}`);
    set('[data-over-balls]', String(t.balls));
    set('[data-over-score]', round(t.score));
    const title = this.el.querySelector('[data-over-title]');
    if (title) title.textContent = this.fresh ? 'A new best' : 'Swimming';
    if (this.fresh) this.ctx.sound.river('best');
    this.$.gauge.hidden = this.$.roll.hidden = true;
    this.card('over');
  }
}

function readBest(): Best {
  try {
    const b = JSON.parse(localStorage.getItem(BEST) ?? 'null');
    if (b && typeof b.score === 'number') return b;
  } catch {}
  return { score: 0, metres: 0 };
}

function writeBest(b: Best) {
  try {
    localStorage.setItem(BEST, JSON.stringify(b));
  } catch {}
}
