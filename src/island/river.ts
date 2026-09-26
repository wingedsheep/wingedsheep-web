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
import { RARE, RIVERS, type Rare, type RiverDef } from './river/rivers';
import { darkness } from './scene/sun';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
/** How long a card's up before ✕ presses anything on it (a brace mashed as you go over isn't "go again"). */
const SETTLE = 700;
/** The river you picked last time. */
const PICK = 'wingedsheep:river:pick';
/** Whether you'd rather paddle on a clear day, whatever the hour and the weather outside. */
const CALM = 'wingedsheep:river:calm';
/** The rare ones you've seen, on any river. */
const SPOTTED = 'wingedsheep:river:spotted';

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

/**
 * How to deal with each thing, the first time it comes up, for whatever's in your hands. Short:
 * you're busy. [Keys] in brackets show as key caps.
 */
const HINTS: Record<Hint, Record<Device, string>> = {
  paddle: { keys: 'Hold [↑] to paddle', pad: 'Hold [✕], or [L2] and [R2], to paddle', touch: 'Hold both sides of the screen to paddle' },
  steer: {
    keys: '[A] or [D] alone turns you. [Q] / [E] brakes',
    pad: 'One trigger alone turns you. [L1] / [R1] brakes',
    touch: 'Hold one side to turn away from it',
  },
  lean: { keys: 'She’s tipping: lean against it with [←] / [→]', pad: 'She’s tipping: lean against it with the stick', touch: '' },
  brace: { keys: 'Going over! [Space] to brace', pad: 'Going over! [✕] to brace', touch: 'Going over! Tap low down on that side' },
  boof: {
    keys: 'A ledge! Stroke hard as the lip lights up gold',
    pad: 'A ledge! Stroke hard as the lip lights up gold',
    touch: 'A ledge! Paddle hard as the lip lights up gold',
  },
  falls: {
    keys: 'A waterfall! Go over straight, leaning forward [W]',
    pad: 'A waterfall! Go over straight, stick forward',
    touch: 'A waterfall! Go over it straight',
  },
  hole: {
    keys: 'In a hole! Lean forward [W] and paddle hard',
    pad: 'In a hole! Stick forward and paddle hard',
    touch: 'In a hole! Keep paddling',
  },
  roll: {
    keys: 'Upside down! [Space] when the needle’s in the gap',
    pad: 'Upside down! [✕] when the needle’s in the gap',
    touch: 'Upside down! Tap when the needle’s in the gap',
  },
  tongue: {
    keys: 'Follow the arrows: the dark V between rocks is the fast line',
    pad: 'Follow the arrows: the dark V between rocks is the fast line',
    touch: 'Follow the arrows: the dark V between rocks is the fast line',
  },
  eddy: { keys: 'Tuck in behind a rock and stop: an eddy', pad: 'Tuck in behind a rock and stop: an eddy', touch: 'Tuck in behind a rock and stop: an eddy' },
  sprint: {
    keys: 'Hold [Shift] to dig in, while your breath lasts',
    pad: 'Hold [□] to dig in, while your breath lasts',
    touch: 'Hold Sprint to dig in, while your breath lasts',
  },
  ball: { keys: 'Beike’s tennis balls! Paddle over them', pad: 'Beike’s tennis balls! Paddle over them', touch: 'Beike’s tennis balls! Paddle over them' },
  waves: {
    keys: 'Waves! Lean into each crest with [←] / [→], and stroke down their backs',
    pad: 'Waves! Lean into each crest with the stick, and stroke down their backs',
    touch: 'Waves! Stroke as you slide down the back of each one',
  },
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
  /** Its goals you've ever done (by their place in its list). */
  goals?: number[];
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
  /** The rare ones you've seen, on any river. */
  private log = readLog();
  private bests: Record<string, Best> = Object.fromEntries(RIVERS.map((r) => [r.id, readBest(r.key)]));
  private pick = 0;
  private fresh = false; // a new best this run
  private newGoals = new Set<number>(); // goals done for the first time this run
  private named = false; // the river's name has been up this run
  private cardAt = 0; // when the card on screen came up (ms)
  private $: Record<string, HTMLElement> = {};
  private grade = new THREE.Vector3();
  /** The island's light as the river gets it (see run). */
  private lit = { sun: new THREE.DirectionalLight(), hemi: new THREE.HemisphereLight(), fog: new THREE.Color() };
  /** A clear day on the river, whatever the hour and the weather outside (the start card's switch). */
  calm = (() => {
    try {
      return localStorage.getItem(CALM) === '1';
    } catch {
      return false;
    }
  })();

  constructor(
    private ctx: IslandContext,
    private ui: UI,
    private pixels: PixelRenderer,
    private host: HTMLElement,
    private reducedMotion: boolean,
    private island: THREE.Scene,
  ) {
    this.el = document.querySelector<HTMLElement>('[data-panel="river"]')!;
    for (const name of ['metres', 'time', 'flow', 'score', 'balls', 'pace', 'banner', 'hint', 'gauge', 'roll', 'praise', 'flash', 'edge', 'sprint', 'sprint-go']) {
      this.$[name] = this.el.querySelector<HTMLElement>(`[data-river-${name}]`)!;
    }
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-river-go]')) b.addEventListener('click', () => this.go());
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-river-resume]')) b.addEventListener('click', () => this.pause(false));
    this.el.querySelector('[data-river-next]')?.addEventListener('click', () => {
      this.select(this.pick + 1);
      this.go();
    });
    // back to the rivers: after a run, or giving up on this one from the pause card
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-river-rivers]')) b.addEventListener('click', () => {
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
    const calm = this.el.querySelector<HTMLElement>('[data-river-calm]');
    calm?.addEventListener('click', () => {
      this.calm = !this.calm;
      try {
        localStorage.setItem(CALM, this.calm ? '1' : '0');
      } catch {}
      this.showCalm();
    });
    this.showBest();
    this.showPicks();
    this.showLog();
    this.showCalm();
  }

  /** The switch on the start card: out there as it is, or a clear day. */
  private showCalm() {
    const b = this.el.querySelector<HTMLElement>('[data-river-calm]');
    if (!b) return;
    b.setAttribute('aria-checked', String(this.calm));
    b.querySelector('span')!.textContent = this.calm ? 'Always a clear day' : 'The real sky and weather';
  }

  /** On the start card, the rare ones you've seen so far. */
  private showLog() {
    const el = this.el.querySelector('[data-river-spotted]');
    if (!el) return;
    const seen = RARE.filter((r) => this.log.has(r.id)).map((r) => r.name);
    const left = RARE.length - seen.length;
    el.textContent = seen.length
      ? `Spotted: ${seen.join(', ')}${left ? ` · ${left} still out there` : ' · every one. Now nobody believes you.'}`
      : 'Keep an eye on the banks: on some runs, something rare is about.';
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
    if (this.game) this.game.logged = this.log;
    this.game?.reset(this.river);
    this.named = false;
    this.fresh = false;
    this.newGoals.clear();
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
    const done = this.bests[r.id].goals ?? [];
    this.goalList(this.el.querySelector('[data-river-goals]'), r, (g) => (done.includes(g) ? 'done' : ''));
    this.el.querySelector('[data-river-chosen]')?.classList.toggle('locked', !open);
  }

  /** A river's three goals, each ticked (or marked new) as `how` says. */
  private goalList(el: Element | null, r: RiverDef, how: (i: number) => '' | 'done' | 'new') {
    el?.replaceChildren(...r.goals.map((g, i) => {
      const li = document.createElement('li');
      const state = how(i);
      if (state) li.classList.add('done');
      li.textContent = `${g.text} · ${round(g.points)}`;
      if (state === 'new') {
        const b = document.createElement('b');
        b.textContent = 'new';
        li.append(' ', b);
      }
      li.setAttribute('aria-label', `${g.text}, ${round(g.points)} points${state ? ', done' : ''}`);
      return li;
    }));
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
    if (!on) game.controls.releaseGo(); // "Carry on" with ✕ doesn't paddle off on the same press
    this.card(on ? 'paused' : null);
  }

  update(dt: number) {
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
      this.run(game, dt);
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

  private run(game: RiverGame, dt: number) {
    const sky = this.ctx.sky;
    const u = this.pixels.uniforms;
    if (this.calm) {
      // a clear day, whatever it's doing outside: the island's grade swapped for a noon one, and
      // its rain, wind and fog kept off the water
      const noon = sky.noon;
      (u.uGrade.value as THREE.Vector3).copy(noon.grade);
      u.uShade.value.copy(noon.shade);
      u.uLight.value.copy(noon.light);
      const sound = this.ctx.sound;
      sound.rain = sound.hail = sound.snow = sound.wind = sound.fog = 0;
      game.update(dt, { sun: noon.sun, hemi: noon.hemi, fog: noon.fog, night: 0, rain: 0, snow: 0, fair: true, storm: 0, flash: 0, haze: 0 });
    } else {
      const w = this.ctx.weather.now;
      // the island's evening comes on early (its lamps are its clock): out on the river, lift its
      // light back up towards the day by as much as the real sky is still lighter, keeping the
      // colour of the evening and the weather's cloud
      const noon = sky.noon;
      // (the real dark by the light there'd be, and cloud dims a dusk as it does a day)
      const night = darkness(sky.alt, Math.min(1.2, w.cloud * 0.8 + w.storm * 0.4));
      const lift = THREE.MathUtils.clamp(sky.lamps - night, 0, 1);
      const cloud = 1 - w.cloud * 0.65;
      this.lit.sun.position.copy(sky.sun.position);
      this.lit.sun.color.copy(sky.sun.color).lerp(noon.sun.color, lift * 0.3);
      this.lit.sun.intensity = THREE.MathUtils.lerp(sky.sun.intensity, noon.sun.intensity * cloud, lift);
      this.lit.hemi.color.copy(sky.hemi.color).lerp(noon.hemi.color, lift * 0.4);
      this.lit.hemi.groundColor.copy(sky.hemi.groundColor).lerp(noon.hemi.groundColor, lift * 0.6);
      this.lit.hemi.intensity = THREE.MathUtils.lerp(sky.hemi.intensity, noon.hemi.intensity, lift);
      const fog = (this.island.fog as THREE.Fog).color;
      this.lit.fog.copy(fog).lerp(noon.fog, lift * 0.35).multiplyScalar(1 + lift * 0.3);
      u.uShade.value.lerp(noon.shade, lift);
      u.uLight.value.lerp(noon.light, lift * 0.5);
      game.update(dt, {
        sun: this.lit.sun,
        hemi: this.lit.hemi,
        fog: this.lit.fog,
        // the real dark, not the island's lamps: still light at sundown, properly dark an hour or so after
        night,
        rain: Math.min(1, w.rain + w.hail),
        snow: w.snow,
        fair: w.storm < 0.3 && w.rain < 0.2,
        storm: w.storm,
        flash: w.flash,
        haze: w.fog,
      });
    }
    // the river's own air over the island's grade: golden and soft on the Dawdle, grey and cold
    // and dark round the edges on the big ones
    const mood = game.river.look.mood;
    (u.uGrade.value as THREE.Vector3).multiply(this.grade.fromArray(mood.grade));
    u.uVignette.value = Math.min(1, mood.vignette + game.drama * 0.45); // (closing in over a waterfall)
    const roar = game.roar;
    this.ctx.sound.riverWater(true, game.state === 'ready' ? 0.2 : game.rough, game.tally.speed, roar.level, roar.near);
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
      else if (card === 'over') this.shownCard()?.querySelector<HTMLElement>('[data-river-rivers]')?.click();
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
      goal: (_, i) => {
        const done = this.best.goals ?? [];
        if (done.includes(i)) return;
        this.best = { ...this.best, goals: [...done, i] };
        this.newGoals.add(i);
      },
      start: () => this.go(),
      over: (tally) => this.over(tally),
      say: (text) => this.ctx.toast(text),
      sound: (kind, volume, step) => this.ctx.sound.river(kind, volume, step),
      bark: () => this.ctx.sound.bark(),
      baa: () => this.ctx.sound.baa(),
      quack: () => this.ctx.sound.call('quack', 0.6),
      spotted: (kind) => {
        const r = RARE.find((x) => x.id === kind)!;
        const first = !this.log.has(kind);
        if (first) {
          this.log.add(kind);
          writeLog(this.log);
          this.showLog();
        }
        this.ctx.toast(first ? `${r.line} · ${this.log.size} of ${RARE.length} spotted` : r.line);
      },
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
    // [W] as a key cap
    el.replaceChildren(...text.split(/\[(.+?)\]/).map((part, i) => {
      if (i % 2 === 0) return part;
      const k = document.createElement('kbd');
      k.textContent = part;
      return k;
    }));
    el.hidden = false;
    this.bounce(el, 'in');
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
    // the edges of the picture: red, throbbing, as she tips towards going over; warm gold while the
    // flow's running hot
    const danger = running && k.balance !== 'rolling' && k.balance !== 'swimming' ? THREE.MathUtils.clamp((Math.abs(k.tilt) - 0.5) / (TIP - 0.5), 0, 1) : 0;
    const edge = this.$.edge;
    edge.style.setProperty('--danger', danger.toFixed(2));
    edge.style.setProperty('--hot', (running ? THREE.MathUtils.clamp((game.tally.flow - 2) / 2.5, 0, 1) : 0).toFixed(2));
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
    set('[data-over-sends]', t.sends ? `${t.sends} · +${round(t.sent)}` : '0');
    set('[data-over-hot]', t.flatOut ? `${Math.floor(t.longest)}s · +${round(t.flatOut)}` : '–');
    set('[data-over-flips]', t.flips ? `${t.flips} · −${round(t.flips * FLIP)}` : '0');
    set('[data-over-flow]', `×${t.bestFlow.toFixed(1)}`);
    set('[data-over-goals]', t.goals.length ? `${t.goals.length} of ${this.river.goals.length} · +${round(t.goalPoints)}` : `0 of ${this.river.goals.length}`);
    this.goalList(this.el.querySelector('[data-over-goals-list]'), this.river, (i) => (this.newGoals.has(i) ? 'new' : t.goals.includes(i) ? 'done' : ''));
    this.showChosen(this.pick);
    set('[data-over-score]', round(t.score));
    for (const el of this.el.querySelectorAll<HTMLElement>('[data-over-spotted], [data-over-spotted-label]')) el.hidden = !t.spotted.length;
    for (const el of this.el.querySelectorAll<HTMLElement>('[data-over-storm], [data-over-storm-label]')) el.hidden = !t.bonus.storm;
    set('[data-over-storm]', `+${round(t.bonus.storm)}`);
    set('[data-over-spotted]', t.spotted.map((k) => RARE.find((r) => r.id === k)!.name).join(', '));
    const title = this.el.querySelector('[data-over-title]');
    if (title) title.textContent = this.fresh ? 'A new best' : quickest ? 'Your quickest yet' : t.finished ? 'Down' : 'Swimming';
    if (this.fresh || quickest) this.ctx.sound.river('best');
    this.$.gauge.hidden = this.$.roll.hidden = true;
    this.card('over');
    if (next) this.focus(onward);
  }
}

function readLog(): Set<Rare> {
  try {
    const ids = JSON.parse(localStorage.getItem(SPOTTED) ?? '[]');
    if (Array.isArray(ids)) return new Set(RARE.map((r) => r.id).filter((id) => ids.includes(id)));
  } catch {}
  return new Set();
}

function writeLog(log: Set<Rare>) {
  try {
    localStorage.setItem(SPOTTED, JSON.stringify([...log]));
  } catch {}
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
