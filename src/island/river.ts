/**
 * Wild water: the kayak off the pier goes a lot further than round the island. Through the iris
 * like a room, but outdoors: a mountain river (src/island/river/), made up ahead of you, lit by the
 * island's own sun and weather, a km or two down to the take-out. Six of them, gentlest first
 * (river/rivers.ts): make it all the way down one and the next one opens. Distance times flow is
 * the score, less a bit for each capsize; make it down and every second under par, gate and ball
 * pays on top. Each river's best stays in this browser.
 */
import * as THREE from 'three';
import type { IslandContext } from './content';
import type { RoomInput } from './scene/camera-rig';
import type { PixelRenderer } from './scene/pixel-renderer';
import type { Device, Nav } from './river/controls';
import type { Stretch } from './river/course';
import { FLIP, type Hint, type RiverGame, type Tally } from './river/game';
import { TIP } from './river/kayak';
import { RIVERS, type RiverDef } from './river/rivers';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
/** How long a card's up before ✕ presses anything on it (a brace mashed as you go over isn't "go again"). */
const SETTLE = 700;
/** The river you picked last time. */
const PICK = 'wingedsheep:river:pick';

/** What the river is like as you come into it, for the banner. */
function banner(s: Stretch, index: number) {
  if (s.takeout) return 'The take-out: under the bridge. Sprint!';
  switch (s.kind) {
    case 'rapids': return `Grade ${s.grade} · ${s.name}`;
    case 'cascade': return `Grade ${s.grade} · ${s.name}, all the way down`;
    case 'gorge': return `Grade ${s.grade} · The gorge`;
    case 'falls': return 'Is that… a waterfall?';
    case 'pool': return 'A slow green pool';
    case 'chute': return index === 2 ? `The river picks up… ${s.name}` : `Grade ${s.grade} · ${s.name}${s.slot ? ', between the walls' : ', flat out'}`;
    case 'run': return 'Into the forest';
  }
}

/** How to deal with each thing, the first time it comes up, for whatever's in your hands. Short: you're busy. */
const HINTS: Record<Hint, Record<Device, string>> = {
  paddle: { keys: 'Hold ↑ to paddle', pad: 'Hold L2 and R2 to paddle', touch: 'Hold both sides of the screen to paddle' },
  steer: {
    keys: 'A or D alone turns you. Q / E brakes',
    pad: 'One trigger alone turns you. L1 / R1 brakes',
    touch: 'Hold one side to turn away from it',
  },
  lean: { keys: 'She’s tipping: lean against it with ← / →', pad: 'She’s tipping: lean against it with the stick', touch: '' },
  brace: { keys: 'Going over! Space to brace', pad: 'Going over! ✕ to brace', touch: 'Going over! Tap low down on that side' },
  boof: {
    keys: 'A ledge: a hard stroke right at the lip',
    pad: 'A ledge: a hard stroke right at the lip',
    touch: 'A ledge: paddle hard right at the lip',
  },
  falls: {
    keys: 'A waterfall! Lean forward (W) as you go over',
    pad: 'A waterfall! Stick forward as you go over',
    touch: 'A waterfall! Hold on tight',
  },
  hole: {
    keys: 'In a hole! Lean forward (W) and paddle hard',
    pad: 'In a hole! Stick forward and paddle hard',
    touch: 'In a hole! Keep paddling',
  },
  roll: {
    keys: 'Upside down! Space when the needle’s in the gap',
    pad: 'Upside down! ✕ when the needle’s in the gap',
    touch: 'Upside down! Tap when the needle’s in the gap',
  },
  tongue: { keys: 'The dark V between rocks is the fast line', pad: 'The dark V between rocks is the fast line', touch: 'The dark V between rocks is the fast line' },
  eddy: { keys: 'Tuck in behind a rock and stop: an eddy', pad: 'Tuck in behind a rock and stop: an eddy', touch: 'Tuck in behind a rock and stop: an eddy' },
  sprint: {
    keys: 'Hold Shift to dig in, while your breath lasts',
    pad: 'Hold □ to dig in, while your breath lasts',
    touch: 'Hold Sprint to dig in, while your breath lasts',
  },
  ball: { keys: 'Beike’s tennis balls! Paddle over them', pad: 'Beike’s tennis balls! Paddle over them', touch: 'Beike’s tennis balls! Paddle over them' },
  peel: {
    keys: 'Eddy! Lean into the turn on the way out',
    pad: 'Eddy! Lean into the turn on the way out',
    touch: 'Eddy! Paddle hard on the way out',
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
  /** Each river's best, by its id, and which one's picked. */
  private bests: Record<string, Best> = Object.fromEntries(RIVERS.map((r) => [r.id, readBest(r.key)]));
  private pick = 0;
  private fresh = false; // a new best this run
  private named = false; // the river's name has been up this run
  private cardAt = 0; // when the card on screen came up (ms)
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
    this.el.querySelector('[data-river-next]')?.addEventListener('click', () => {
      this.select(this.pick + 1);
      this.go();
    });
    this.el.querySelector('[data-river-rivers]')?.addEventListener('click', () => {
      this.again();
      this.card('ready');
    });
    // the river picked last time (or, to try one straight away, ?river=coffee)
    const asked = RIVERS.findIndex((r) => r.id === new URLSearchParams(location.search).get('river'));
    let last = -1;
    try {
      last = RIVERS.findIndex((r) => r.id === localStorage.getItem(PICK));
    } catch {}
    this.pick = asked >= 0 ? asked : this.open(last) ? last : 0;
    this.el.querySelectorAll<HTMLElement>('[data-river-pick]').forEach((b, i) => {
      b.addEventListener('click', () => this.select(i));
      // a look at the one you're pointing at (even one that's not open yet), then back to the picked one
      b.addEventListener('pointerenter', () => this.showChosen(i));
      b.addEventListener('pointerleave', () => this.showChosen(this.pick));
    });
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
    this.showPicks();
  }

  private get river(): RiverDef {
    return RIVERS[this.pick];
  }

  private get best(): Best {
    return this.bests[this.river.id];
  }

  private set best(b: Best) {
    this.bests[this.river.id] = b;
    writeBest(this.river.key, b);
  }

  /**
   * How far through the rivers you've got: the one after the last you've made it down. Only
   * making it down opens the next (so a best from before there were six waits on Black Water).
   */
  private get reached() {
    let n = 0;
    RIVERS.forEach((r, i) => {
      if (this.bests[r.id].time) n = Math.max(n, i + 1);
    });
    return Math.min(n, RIVERS.length - 1);
  }

  /** Whether river `i` is open to you. */
  private open(i: number) {
    const asked = new URLSearchParams(location.search).get('river');
    return i >= 0 && i < RIVERS.length && (i <= this.reached || RIVERS[i].id === asked);
  }

  /** Pick river `i` (if it's open), and put the kayak at the top of it. */
  private select(i: number) {
    if (!this.open(i) || i === this.pick) return;
    this.pick = i;
    try {
      localStorage.setItem(PICK, this.river.id);
    } catch {}
    if (this.game && this.game.state !== 'running') this.again();
    this.showPicks();
    this.showBest();
  }

  /** A fresh river: the one picked, from the top. */
  private again() {
    this.game?.reset(this.river);
    this.named = false;
    this.fresh = false;
    this.lastHud = '';
    this.mile = 0;
  }

  /** The stepping stones: which is picked, which are open, which you've made it down, which is next. */
  private showPicks() {
    const reached = this.reached;
    this.el.querySelectorAll<HTMLElement>('[data-river-pick]').forEach((b, i) => {
      const open = this.open(i);
      const r = RIVERS[i];
      b.setAttribute('aria-checked', String(i === this.pick));
      b.setAttribute('aria-disabled', String(!open));
      b.setAttribute('aria-label', open ? `${r.name}, grade ${r.grade}` : `${r.name}: make it down ${RIVERS[i - 1].name} first`);
      b.tabIndex = i === this.pick ? 0 : -1;
      b.classList.toggle('down', !!this.bests[r.id].time);
      b.classList.toggle('next', i === reached && !this.bests[r.id].time);
    });
    this.showChosen(this.pick);
  }

  /** Under the stones: the river's name, grade and length, and a line about it (or what it takes to open). */
  private showChosen(i: number) {
    const r = RIVERS[i];
    const open = this.open(i);
    const set = (sel: string, text: string) => {
      const el = this.el.querySelector(sel);
      if (el) el.textContent = text;
    };
    set('[data-river-pick-name]', r.name);
    set('[data-river-pick-meta]', `Grade ${r.grade} · ${(r.length / 1000).toFixed(1)} km`);
    set('[data-river-pick-lede]', open ? r.lede : `Make it down ${RIVERS[i - 1].name} first.`);
    this.el.querySelector('[data-river-chosen]')?.classList.toggle('locked', !open);
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
    if (game.state === 'over') this.again();
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
      this.again();
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
      // on a card, ✕ presses whichever button's picked out (a river stone: push off down it)
      const card = this.shownCard();
      const at = document.activeElement as HTMLElement | null;
      if (card && performance.now() - this.cardAt < SETTLE) return;
      if (card && at && card.contains(at) && at.matches('button, summary') && !at.matches('[data-river-pick]')) at.click();
      else if (this.game?.paused) this.pause(false);
      else if (this.game?.state !== 'running') this.go();
    };
    game.controls.onPause = () => this.pause(!this.game?.paused);
    game.controls.onPick = (dir) => this.step(dir);
    game.controls.onNav = (dir) => this.nav(dir);
    // ○: back out one card (off the start card, back to the island)
    game.controls.onBack = () => {
      const card = this.shownCard()?.dataset.riverCard;
      if (card === 'paused') this.pause(false);
      else if (card === 'over') this.el.querySelector<HTMLElement>('[data-river-rivers]')?.click();
      else if (card === 'ready') this.ui.back();
    };
    game.events = {
      // pushing off, just the river's name; after that, what's coming
      stretch: (s, i) => {
        this.say(this.named ? banner(s, i) : this.river.name);
        this.named = true;
      },
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
      ball: () => {
        this.bounce(this.$.balls.parentElement!, 'pop');
        this.word('Fetch!', 'ball');
      },
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

  /** Left and right on the start card go through the rivers (skipping the ones not open yet). */
  private step(dir: -1 | 1) {
    if (this.game?.state !== 'ready' || this.shownCard()?.dataset.riverCard !== 'ready') return;
    for (let i = this.pick + dir; i >= 0 && i < RIVERS.length; i += dir) {
      if (!this.open(i)) continue;
      this.select(i);
      this.focus(this.el.querySelector<HTMLElement>(`[data-river-pick="${this.river.id}"]`));
      return;
    }
  }

  /** The d-pad on a card: along the rivers on the start card, otherwise to the nearest button that way. */
  private nav(dir: Nav) {
    const card = this.shownCard();
    if (!card) return;
    if (card.dataset.riverCard === 'ready' && (dir === 'left' || dir === 'right')) return this.step(dir === 'left' ? -1 : 1);
    const all = [...card.querySelectorAll<HTMLElement>('button, summary')].filter((b) => b.tabIndex >= 0 && b.offsetParent);
    const at = document.activeElement as HTMLElement | null;
    if (!at || !all.includes(at)) return this.focus(card.querySelector<HTMLElement>('[data-river-go], [data-river-resume]'));
    const from = at.getBoundingClientRect();
    const [fx, fy] = [from.left + from.width / 2, from.top + from.height / 2];
    let best: HTMLElement | undefined;
    let score = Infinity;
    for (const b of all) {
      const r = b.getBoundingClientRect();
      const dx = r.left + r.width / 2 - fx;
      const dy = r.top + r.height / 2 - fy;
      // how far that way, and (counting double) how far off to the side
      const [along, across] = dir === 'up' ? [-dy, dx] : dir === 'down' ? [dy, dx] : dir === 'left' ? [-dx, dy] : [dx, dy];
      if (b === at || along < 4) continue;
      const d = along + Math.abs(across) * 2;
      if (d < score) [best, score] = [b, d];
    }
    if (best) this.focus(best);
  }

  /** Pick out a button (with the focus ring showing, on a pad), scrolled into view. */
  private focus(el: HTMLElement | null | undefined) {
    if (!el) return;
    el.focus({ preventScroll: true, focusVisible: this.game?.controls.device !== 'touch' } as FocusOptions);
    el.scrollIntoView({ block: 'nearest' });
  }

  /** The card on screen, if there is one. */
  private shownCard() {
    return this.el.querySelector<HTMLElement>('[data-river-card]:not([hidden])') ?? undefined;
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
    this.word(text, big ? 'big' : bad ? 'bad' : '');
    if (!bad) this.bounce(this.$.flow, 'pop');
  }

  private word(text: string, kind: '' | 'big' | 'bad' | 'ball') {
    const game = this.game;
    if (!game) return;
    const at = game.onScreen(game.kayak.pos, this.host.clientWidth, this.host.clientHeight);
    const el = document.createElement('span');
    el.className = `river-word${kind ? ` ${kind}` : ''}`;
    el.textContent = text;
    el.style.left = `${Math.round(at.x + (kind === 'ball' ? 40 : 0))}px`;
    el.style.top = `${Math.round(at.y - (kind === 'ball' ? 30 : 60))}px`;
    this.$.praise.append(el);
    setTimeout(() => el.remove(), 1100);
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
    this.cardAt = performance.now();
    if (name) this.focus(this.el.querySelector<HTMLElement>(`[data-river-card="${name}"] [data-river-go], [data-river-card="${name}"] [data-river-resume]`));
  }

  private hud(t: Tally) {
    const length = this.river.length;
    const pace = Math.round((t.pace - 1) * 10) * 10;
    const key = `${this.river.id}|${t.metres}|${Math.floor(t.time)}|${t.balls}|${t.flow}|${Math.round(t.score)}|${pace}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    // every 500 m, a moment
    const mile = Math.floor(t.metres / 500);
    if (mile > this.mile && t.metres < length) {
      this.mile = mile;
      this.bounce(this.$.metres.parentElement!, 'pop');
      this.ctx.sound.river('mile');
      if (this.bannerTimer <= 0) this.say(`${round(length - mile * 500)} m to the take-out`);
    }
    this.$.pace.textContent = pace > 0 ? `+${pace}%` : '';
    this.$.pace.style.setProperty('--pace', String(pace / 100));
    this.$.metres.textContent = round(length - t.metres);
    this.$.time.textContent = clock(t.time);
    // past par, the clock's not paying any more
    this.$.time.parentElement!.classList.toggle('late', t.time > this.game!.par);
    this.$.balls.textContent = String(t.balls);
    this.$.score.textContent = round(t.score);
    this.$.flow.textContent = `×${t.flow.toFixed(1)}`;
    this.$.flow.style.setProperty('--heat', String(Math.min(1, (t.flow - 1) / 3)));
    if (t.score > this.best.score && t.score > 0) {
      if (!this.fresh && this.best.score > 0) this.say('A new best!');
      this.fresh = true;
      this.best = { ...this.best, score: Math.round(t.score), metres: t.metres };
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
    const was = this.reached;
    const first = t.finished && !this.best.time;
    if (quickest) this.best = { ...this.best, time: t.time };
    if (t.score > this.best.score) {
      this.fresh = true;
      this.best = { ...this.best, score: Math.round(t.score), metres: t.metres };
    }
    this.showBest();
    this.showPicks();
    // down one for the first time: the next river opens (or, down the last, that's all of them)
    const next = this.reached > was && this.pick + 1 === this.reached ? RIVERS[this.reached] : undefined;
    const unlocked = this.el.querySelector<HTMLElement>('[data-river-unlocked]');
    if (unlocked) {
      unlocked.hidden = !next && !(first && this.pick === RIVERS.length - 1);
      unlocked.textContent = next ? `New river: ${next.name}` : 'Every river down. Beike’s impressed.';
    }
    const onward = this.el.querySelector<HTMLElement>('[data-river-next]');
    if (onward) {
      onward.hidden = !next;
      if (next) onward.textContent = `On to ${next.name}`;
    }
    // (with somewhere new to go, going again is the second choice)
    const again = this.el.querySelector<HTMLElement>('[data-river-card="over"] [data-river-go]');
    again?.classList.toggle('river-back', !!next);
    again?.classList.toggle('river-go', !next);
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
    if (next) this.focus(onward);
  }
}

function readBest(key: string): Best {
  try {
    const b = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (b && typeof b.score === 'number') return b;
  } catch {}
  return { score: 0, metres: 0 };
}

function writeBest(key: string, b: Best) {
  try {
    localStorage.setItem(key, JSON.stringify(b));
  } catch {}
}
