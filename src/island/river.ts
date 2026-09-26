/**
 * Wild water: the kayak off the pier goes a lot further than round the island. Through the iris
 * like a room, but outdoors: a mountain river (src/island/river/), made up ahead of you, lit by the
 * island's own sun and weather, 1.8 km down to the take-out. Distance times flow is the score,
 * less a bit for each capsize; make it down and every second under par, gate and ball pays on
 * top. The best stays in this browser.
 */
import * as THREE from 'three';
import type { IslandContext } from './content';
import type { RoomInput } from './scene/camera-rig';
import type { PixelRenderer } from './scene/pixel-renderer';
import type { Device } from './river/controls';
import type { Stretch } from './river/course';
import { FLIP, type Hint, LENGTH, PAR, type RiverGame, type Tally } from './river/game';
import { TIP } from './river/kayak';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
// a new key for the run with a take-out: the endless river's scores don't compare
const BEST = 'wingedsheep:river:takeout';

/** What the river is like as you come into it, for the banner. */
function banner(s: Stretch, index: number) {
  if (s.takeout) return 'The take-out: under the bridge. Sprint!';
  switch (s.kind) {
    case 'rapids': return `Grade ${s.grade} · ${s.name}`;
    case 'cascade': return `Grade ${s.grade} · ${s.name}, all the way down`;
    case 'gorge': return `Grade ${s.grade} · The gorge`;
    case 'falls': return 'Is that… a waterfall?';
    case 'pool': return index === 0 ? 'A slow green pool. Get the feel of her.' : 'A slow green pool';
    case 'run': return s.fast ? 'The river picks up…' : 'Into the forest';
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
  eddy: {
    keys: 'Read the water: long streaks are the fast line. Behind rocks and inside bends it turns back upstream. Tuck in there and stop to catch an eddy',
    pad: 'Read the water: long streaks are the fast line. Behind rocks and inside bends it turns back upstream. Tuck in there and stop to catch an eddy',
    touch: 'Read the water: long streaks are the fast line. Behind rocks and inside bends it turns back upstream. Tuck in there and stop to catch an eddy',
  },
  sprint: {
    keys: 'Hold Shift while you paddle to dig in: faster, for as long as your breath lasts (the bar over the boat)',
    pad: 'Hold □ while you paddle to dig in: faster, for as long as your breath lasts (the bar over the boat)',
    touch: 'Hold Sprint while you paddle to dig in: faster, for as long as your breath lasts (the bar over the boat)',
  },
  peel: {
    keys: 'Eddy caught! Crossing the foamy line back out, lean into the turn (← / →) or the current will trip you',
    pad: 'Eddy caught! Crossing the foamy line back out, lean into the turn with the stick or the current will trip you',
    touch: 'Eddy caught! Point back downstream and paddle hard across the foamy line',
  },
};

/** How it ends. */
const SWIMS = [
  'You swim the kayak to the bank, still holding the paddle.',
  'Upside down, briefly. Then for rather longer.',
  'The river wins this one. It usually does.',
  'Out on the bank, emptying the kayak. Then your other shoe.',
];

/** How it ends, the good way. */
const FINISHES = [
  'Under the bridge, soaked to the skin, grinning.',
  'You drift into the take-out and just sit there for a bit.',
  'All the way down. Beike would want to go again.',
  'The river lets you go, this time.',
];

interface Best {
  score: number;
  metres: number;
  /** The quickest you've made it all the way down (s). */
  time?: number;
}

const round = (n: number) => Math.round(n).toLocaleString('en-GB');
/** Seconds as m:ss. */
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

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
  private mile = 0;
  private swims = 0;
  private finishes = 0;
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
    for (const name of ['metres', 'time', 'flow', 'score', 'balls', 'pace', 'banner', 'hint', 'gauge', 'roll', 'praise', 'flash', 'sprint', 'sprint-go']) {
      this.$[name] = this.el.querySelector<HTMLElement>(`[data-river-${name}]`)!;
    }
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-river-go]')) b.addEventListener('click', () => this.go());
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-river-resume]')) b.addEventListener('click', () => this.pause(false));
    // held (a thumb on it while the other paddles, or a finger while both do)
    const go = this.$['sprint-go'];
    go.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      go.setPointerCapture(e.pointerId);
      this.game?.controls.sprint(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) go.addEventListener(type, () => this.game?.controls.sprint(false));
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
        // (to poke at it from the console while working on it)
        if (import.meta.env.DEV) Object.assign(window, { river: game });
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
      this.mile = 0;
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
      this.mile = 0;
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
      split: (s) => this.say(s.kind === 'bar' ? `A gravel bar · the fast water's on the ${s.hero < 0 ? 'left' : 'right'}` : `The river splits · hero line ${s.hero < 0 ? 'left' : 'right'}, sneak ${s.hero < 0 ? 'right' : 'left'}`),
      praise: (text, big) => this.praise(text, big),
      broke: (why, cost) => {
        this.praise(cost ? `${why} · −${round(cost)}` : `${why} · flow lost`, false, true);
        this.bounce(this.$.flow, 'lost');
      },
      tier: (flow) => {
        this.praise(`×${flow} flow!`, true);
        this.bounce(this.$.flow, 'tier');
      },
      ball: () => this.bounce(this.$.balls.parentElement!, 'pop'),
      hint: (kind) => this.hint(HINTS[kind][game.controls.device]),
      start: () => this.go(),
      over: (tally) => this.over(tally),
      say: (text) => this.ctx.toast(text),
      sound: (kind, volume, step) => this.ctx.sound.river(kind, volume, step),
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
    if (!bad) this.bounce(this.$.flow, 'pop');
  }

  /** Replay a one-off CSS animation on a bit of the HUD. */
  private bounce(el: HTMLElement, name: string) {
    el.classList.remove(name);
    void el.offsetWidth;
    el.classList.add(name);
  }

  /** Show one of the cards (the start, paused, a swim), or none. */
  private card(name: 'ready' | 'paused' | 'over' | null) {
    for (const c of this.el.querySelectorAll<HTMLElement>('[data-river-card]')) c.hidden = c.dataset.riverCard !== name;
    const shown = name && this.el.querySelector<HTMLElement>(`[data-river-card="${name}"] [data-river-go], [data-river-card="${name}"] [data-river-resume]`);
    shown?.focus({ preventScroll: true });
  }

  private hud(t: Tally) {
    const pace = Math.round((t.pace - 1) * 10) * 10;
    const key = `${t.metres}|${Math.floor(t.time)}|${t.balls}|${t.flow}|${Math.round(t.score)}|${pace}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    // every 500 m, a moment
    const mile = Math.floor(t.metres / 500);
    if (mile > this.mile && t.metres < LENGTH) {
      this.mile = mile;
      this.bounce(this.$.metres.parentElement!, 'pop');
      this.ctx.sound.river('mile');
      if (this.bannerTimer <= 0) this.say(`${round(LENGTH - mile * 500)} m to the take-out`);
    }
    this.$.pace.textContent = pace > 0 ? `+${pace}%` : '';
    this.$.pace.style.setProperty('--pace', String(pace / 100));
    this.$.metres.textContent = round(LENGTH - t.metres);
    this.$.time.textContent = clock(t.time);
    // past par, the clock's not paying any more
    this.$.time.parentElement!.classList.toggle('late', t.time > PAR);
    this.$.balls.textContent = String(t.balls);
    this.$.score.textContent = round(t.score);
    this.$.flow.textContent = `×${t.flow.toFixed(1)}`;
    this.$.flow.style.setProperty('--heat', String(Math.min(1, (t.flow - 1) / 3)));
    if (t.score > this.best.score && t.score > 0) {
      if (!this.fresh && this.best.score > 0) this.say('A new best!');
      this.fresh = true;
      this.best = { ...this.best, score: Math.round(t.score), metres: t.metres };
      writeBest(this.best);
      this.showBest();
    }
  }

  /** The things that follow the kayak: its balance, the roll-up meter, a flash. */
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
    // the sprint: a bar over the boat, draining while you dig in and filling as you get your breath back
    const running = game.state === 'running' && !game.paused;
    const sprint = this.$.sprint;
    const showSprint = running && (k.sprinting || k.wind < 1);
    sprint.hidden = !showSprint;
    if (showSprint) {
      sprint.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y - 40)}px)`;
      sprint.style.setProperty('--charge', String(k.wind));
      sprint.classList.toggle('on', k.sprinting);
    }
    this.$['sprint-go'].hidden = !running;
    this.$['sprint-go'].classList.toggle('spent', !k.sprinting && k.wind < 0.2);
    // the flash
    this.$.flash.style.opacity = String(game.flash.amount * 0.6);
    this.$.flash.style.background = `#${game.flash.color.getHexString()}`;
  }

  private showBest() {
    for (const el of this.el.querySelectorAll('[data-river-best]')) el.textContent = round(this.best.score);
    for (const el of this.el.querySelectorAll<HTMLElement>('[data-river-fastest]')) {
      el.textContent = this.best.time ? clock(this.best.time) : '–';
    }
  }

  private over(t: Tally) {
    const set = (sel: string, text: string) => {
      const el = this.el.querySelector(sel);
      if (el) el.textContent = text;
    };
    // the tally's score already has the bonus in it; a new best score was saved as it came in
    const quickest = t.finished && (!this.best.time || t.time < this.best.time);
    if (quickest) {
      this.best = { ...this.best, time: t.time };
      writeBest(this.best);
    }
    if (t.score > this.best.score) {
      this.fresh = true;
      this.best = { ...this.best, score: Math.round(t.score), metres: t.metres };
      writeBest(this.best);
    }
    this.showBest();
    set('[data-river-line]', t.finished ? FINISHES[this.finishes++ % FINISHES.length] : SWIMS[this.swims++ % SWIMS.length]);
    set('[data-over-metres]', t.finished ? 'All the way' : `${round(t.metres)} m`);
    set('[data-over-time]', clock(t.time));
    set('[data-over-bonus]', t.finished ? `+${round(t.bonus.time)}` : '–');
    set('[data-over-gates]', t.finished ? `${t.gates} · +${round(t.bonus.gates)}` : String(t.gates));
    set('[data-over-balls]', t.finished ? `${t.balls} · +${round(t.bonus.balls)}` : String(t.balls));
    set('[data-over-flips]', t.flips ? `${t.flips} · −${round(t.flips * FLIP)}` : '0');
    set('[data-over-flow]', `×${t.bestFlow.toFixed(1)}`);
    set('[data-over-score]', round(t.score));
    const title = this.el.querySelector('[data-over-title]');
    if (title) title.textContent = this.fresh ? 'A new best' : quickest ? 'Your quickest yet' : t.finished ? 'Down' : 'Swimming';
    if (this.fresh || quickest) this.ctx.sound.river('best');
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
