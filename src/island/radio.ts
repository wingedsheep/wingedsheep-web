/**
 * Radio Alles, the pirate station on the boat far out west of the lighthouse (scene/sightings.ts). Tune
 * the lamp-room radio past the shipping forecast and it comes in: Vincent's playlist, "alles",
 * played in its own order from wherever the needle happens to land, with no skipping: it's an
 * old radio, it just plays. The music comes from YouTube (src/data/radio.json, matched by
 * tools/radio/videos.py), through a player kept out of sight in the set. Between songs
 * Kees, the DJ, talks (src/data/dj.json, recorded by tools/radio/voice.py): he introduces the
 * next song over its first bars, with the music down, when he has an intro for it on tape, and
 * now and then just chats: about his past, about life aboard, or about what's going on around
 * the island (the hour, the weather, the season), though not too often about that. Some songs
 * have intros for a moment, too (the rain one when it's raining). Listen long enough and he tells
 * his story, an instalment at a time, carrying on where he left off with you last time, with
 * tales from his life in between. It's a long way out, so now and then the signal fades for a moment, and more often
 * in a storm; never for long, and never all the way.
 *
 * Like the Walkman you take the set with you, down in the corner (IslandShell.astro), and it plays
 * on while you walk about. The island's own music waits while it plays, and it stops for anything
 * else that starts.
 */
import records from '../data/radio.json';
import dj from '../data/dj.json';
import type { IslandContext } from './content';
import { occasions } from './scene/calendar';
import { season } from './scene/season';
import { weekOf } from './kees';
import { level } from './hud';

const ORIGIN = 'https://www.youtube-nocookie.com';
const PLAYLIST = 'https://open.spotify.com/playlist/0qtf98mX3X2LJJrihD1DGY';
/** How often he chats between songs (as well as, or instead of, an intro). */
const CHATTY = 0.3;
/**
 * What the chat's about, as shares: one of his tales (`tale-…`, things that happened, in no
 * order), life aboard (anything not tied to the moment, his week included), and what's going on
 * right now (the hour, the weather, the season, the day).
 */
const TOPICS = { tales: 0.3, aboard: 0.45, now: 0.25 };
/**
 * His story comes on its own clock: the first instalment a couple of songs after you tune in,
 * then one every few songs. People forget, so the first one of a visit is the last bit you heard,
 * now and then he tells an older bit again, and once he's told it all he goes back over it.
 */
const STORY = { first: [2, 3], every: [4, 5], again: 0.15 };
/** How often a tale's one you've heard before (as long as there are new ones; all of them, after). */
const RETOLD = 0.2;
/**
 * What he remembers about you between visits: which bits of his story and which tales you've
 * heard (so he carries on where he left off, and doesn't tell you the same tale twice till he's
 * run out), and what he's said lately.
 */
const MEMORY = 'wingedsheep:radio';
/** He remarks on the moment (in chat or a song's intro for it) at most once in so many seconds; half that in a storm. */
const NOW_GAP = 480;
/** How likely he is to use a song's intro for the moment, when there's one that fits (and he hasn't just remarked on it). */
const MOMENTARY = 0.35;
/** The music's volume while he's talking over it. */
const UNDER = 30;
/**
 * How many seconds the fades take: a song coming in (from nothing, once it's actually playing),
 * going down under him before he cuts in, coming back up after he's said his piece, a song's last
 * seconds going out before the break, and the set switched off.
 */
const FADE = { in: 1.2, duck: 0.8, swell: 3, out: 4, off: 0.5 };
/**
 * The signal: in calm weather it fades once every few minutes, shallow and brief; a storm makes
 * that several times as often, a little deeper and longer. It never goes all the way.
 */
const FADES = { every: [150, 330], calm: { depth: 0.25, length: 0.5 }, storm: { depth: 0.85, length: 3 } };
/**
 * In a storm he cuts in over the music now and then, when the signal's just dropped badly (lines
 * with ids from tools/radio/lines/chatter-storm.json): not more often than this many seconds apart.
 */
const CUT_IN = { gap: 240, chance: 0.4, prefix: 'storm-cutin-' };
/**
 * Things on the island he reacts to (lines `event-<what>-…`, tools/radio/lines/chatter-events.json):
 * at most once in so many seconds each (the ferry's every half hour; a shooting star every
 * minute on a clear night), and never two within a minute.
 */
const EVENTS: Record<string, number> = {
  ferry: 1800, container: 900, tallship: 600, whale: 300, dolphins: 600, ufo: 300, fireworks: 600,
  shootingstar: 900, aurora: 3600, dusk: 3600, dawn: 3600, snow: 3600, siren: 3600, guitar: 1800,
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Song { id: string; title: string; artist: string; video: string }
interface When { time?: string[]; weather?: string[]; season?: string[]; occasion?: string[]; state?: string[] }
interface Chat { id: string; file: string; when?: When }
interface Moment { track: string; file: string; when: When }

const SONGS = records as Song[];
const CHATTER = dj.chatter as Chat[];
const TALE = dj.story as Chat[];
const INTROS = dj.intros as { [track: string]: string[] };
const MOMENTS = (dj as { moments?: Moment[] }).moments ?? [];

const songsBetween = ([a, b]: number[]) => a + Math.floor(Math.random() * (b - a + 1));

function remembered(): { heard: string[]; said: string[] } {
  try {
    const m = JSON.parse(localStorage.getItem(MEMORY) ?? '{}');
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return { heard: list(m.heard), said: list(m.said) };
  } catch {
    return { heard: [], said: [] };
  }
}

/** Whether a line's about the moment (rather than just matching his week). */
const aboutNow = (when?: When) => !!when && !!(when.time || when.weather || when.season || when.occasion);

const timeOfDay = (h: number) => (h >= 6 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night');

export class Radio {
  /** Whether the set's out (in your hands, down in the corner). */
  on = false;
  private deck = document.querySelector<HTMLElement>('[data-radio]');
  private player?: HTMLIFrameElement;
  /** Where we are in the playlist. */
  private at = Math.floor(Math.random() * SONGS.length);
  /** YouTube's last word on the player: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering. */
  private state = -1;
  /** Kees, while he's talking. */
  private talking?: { stop(): void };
  /** The song's volume (down while he talks over it). */
  private volume = 100;
  /** Lines he's said lately, so he doesn't repeat himself, and the bits of his past you've heard (both kept between visits). */
  private said = remembered().said;
  private known = remembered().heard;
  /** A break between songs is under way (so the end of one isn't taken for the end of the next). */
  private changing = false;
  /** Songs to go till the next instalment of his story, and whether he's told any yet this visit. */
  private storyIn = songsBetween(STORY.first);
  private resumed = false;
  /** How well she's coming in (1 clear), the fade under way, the time to the next one, and what the player was last told. */
  private signal = 1;
  private fading = { left: 0, length: 1, depth: 0 };
  /** The song's volume on its way somewhere (fadeTo), the song's length, and whether it's on its way out. */
  private ramp?: { cancel(): void };
  private duration = 0;
  private ending = false;
  private calm = rand(FADES.every[0], FADES.every[1]);
  private told = -1;
  private clock = 0;
  /** How rough it is out there (0 calm … 1 a proper storm), the last lightning heard, and the last time he cut in. */
  private rough = 0;
  private struck = 0;
  private cutAt = -Infinity;
  /** When he last remarked on each thing that happened, the last remark of any kind, and one he's saving for the break. */
  private remarked: Record<string, number> = {};
  private lastRemark = -Infinity;
  private saved?: { line: Chat; until: number };
  /** When he last remarked on the moment between songs. */
  private lastNow = -Infinity;
  /** Whether he's off the air for the two minutes' silence (and the song's waiting). */
  private hushed = false;

  constructor(private ctx: IslandContext) {
    this.deck?.querySelector('[data-radio-off]')?.addEventListener('click', () => this.switchOff());
    this.deck?.querySelector<HTMLAnchorElement>('[data-radio-spotify]')?.setAttribute('href', PLAYLIST);
    level(this.deck?.querySelector('[data-radio-volume]'), ctx, 'radioVolume');
    window.addEventListener('message', (e) => this.heard(e));
  }

  /** Tune in: the set comes up, and the station with it, Kees first. */
  tuneIn() {
    const deck = this.deck;
    if (!deck || !SONGS.length) return;
    this.on = true;
    deck.hidden = false;
    // one set in your hands at a time: the Walkman goes back in the pocket
    const walkman = document.querySelector<HTMLElement>('[data-walkman]');
    if (walkman) walkman.hidden = true;
    this.ctx.sound.stopAlbum();
    this.ctx.sound.stopRecord();
    if (this.player) {
      this.volume = 0; // (and in it comes, once it's playing)
      this.level();
      return this.command('playVideo');
    }
    // you've come in partway through his show: an ident over the first song, not an intro
    void this.next(true, this.pick(CHATTER.filter((c) => c.id.startsWith('ident'))));
  }

  /** Off it goes, and back in the pocket. */
  switchOff() {
    this.on = false;
    this.talking?.stop();
    void this.fadeTo(0, FADE.off).then(() => this.on || this.command('pauseVideo'));
    this.ctx.sound.radio = false;
    this.deck?.classList.remove('playing', 'talking');
    if (this.deck) this.deck.hidden = true;
  }

  /**
   * Something happened on the island (main.ts): the ferry's horn, a shooting star, the lamp lit…
   * If he's got a line for it, and hasn't remarked on it lately, he cuts in over the song, or
   * saves it for the next break if he's in the middle of one.
   */
  notice(what: string) {
    if (!this.on || !(what in EVENTS)) return;
    if (this.clock - (this.remarked[what] ?? -Infinity) < EVENTS[what] || this.clock - this.lastRemark < 60) return;
    const line = this.pick(CHATTER.filter((c) => c.id.startsWith(`event-${what}-`) && (!c.when || this.fits(c.when))), 0);
    if (!line) return;
    this.remarked[what] = this.lastRemark = this.clock;
    if (this.talking || this.changing || this.state !== 1) this.saved = { line, until: this.clock + 90 };
    else void this.cutIn(line, 400);
  }

  /**
   * Every frame: the signal comes and goes with the weather, and the set steps aside for any
   * other music that's started (the Walkman, the gramophone, the telly).
   */
  update(dt: number) {
    const s = this.ctx.sound;
    if (this.on && (this.state === 1 || this.talking) && (!s.enabled || s.film || s.albumPlaying || s.recordPlaying)) {
      this.talking?.stop();
      this.command('pauseVideo');
    }
    // the two minutes' silence on the fourth of May: the station keeps it too, then carries on
    if (s.silence > 0.5 !== this.hushed) {
      this.hushed = !this.hushed;
      this.talking?.stop();
      if (this.on) this.command(this.hushed ? 'pauseVideo' : 'playVideo');
    }
    s.radio = this.on && (this.state === 1 || !!this.talking);
    if (!s.radio) {
      this.struck = s.lightning; // (lightning while it's off isn't heard later)
      return;
    }
    this.clock += dt;
    const w = this.ctx.weather;
    const rough = (this.rough = Math.min(1, w.now.storm + Math.max(0, w.wind - 12) / 12));
    s.radioRough = rough;
    if ((this.calm -= dt * (1 + rough * 6)) <= 0) {
      this.calm = rand(FADES.every[0], FADES.every[1]);
      const { calm, storm } = FADES;
      const length = (calm.length + (storm.length - calm.length) * rough) * rand(0.7, 1.3);
      this.fading = { left: length, length, depth: Math.min(0.92, (calm.depth + (storm.depth - calm.depth) * rough) * rand(0.7, 1.1)) };
      if (this.fading.depth > 0.6) this.stormCutIn();
    }
    // lightning: a crack of static, and the signal all but gone for a moment
    if (s.lightning !== this.struck) {
      this.struck = s.lightning;
      s.radioCrash(0.6 + rough * 0.4);
      this.fading = { left: 1.4, length: 1.4, depth: 0.9 };
    }
    const f = this.fading;
    if (f.left > 0) f.left -= dt;
    const dip = f.left > 0 ? Math.sin(Math.PI * (1 - f.left / f.length)) * (0.85 + 0.15 * Math.sin(this.clock * 31)) : 0;
    this.signal = 1 - f.depth * Math.max(0, dip);
    s.radioSignal = this.signal;
    this.level();
  }

  /** Tell the player the song's volume: where it's at (down under him, or swelling back), faded with the signal. */
  private level() {
    const v = Math.round(this.volume * this.signal * this.ctx.sound.radioVolume);
    if (v !== this.told && (Math.abs(v - this.told) >= 2 || v === 0 || this.volume === 100 || this.volume === UNDER)) {
      this.told = v;
      this.command('setVolume', [v]);
    }
  }

  /**
   * On to the next song (or the first): a break, if he's got something to say, then the song,
   * turned down under him while he introduces it.
   */
  private async next(first: boolean, opener?: Chat) {
    if (this.changing) return;
    this.changing = true;
    this.ending = false;
    this.talking?.stop();
    if (!first) this.at = (this.at + 1) % SONGS.length;
    const song = SONGS[this.at];
    const storm = this.rough > 0.5;
    const now = first || !this.mayRemark(storm) ? [] : MOMENTS.filter((m) => m.track === song.id && this.fits(m.when));
    const momentary = now.length > 0 && Math.random() < MOMENTARY;
    if (momentary) this.lastNow = this.clock;
    const takes = first ? undefined : momentary ? now.map((m) => m.file) : INTROS[song.id];
    const intro = takes?.[Math.floor(Math.random() * takes.length)];
    // a bit of chat first, now and then (more often when there's no intro on tape, and a little
    // more in a storm, when he's glad of the company)
    const chatting = !first && Math.random() < (intro ? CHATTY : CHATTY * 1.6) * (storm ? 1.3 : 1);
    const saved = this.saved && this.saved.until > this.clock ? this.saved.line : undefined;
    this.saved = undefined;
    // his story when it's due (unless something's just happened that he wants to talk about)
    const instalment = !first && !saved && --this.storyIn <= 0 ? this.nextInstalment() : undefined;
    const chat = saved ?? instalment ?? (chatting ? this.chat(storm) : undefined);
    this.command('pauseVideo');
    if (chat) await this.speak(chat.file, chat.id);
    if (!this.on) return void (this.changing = false);
    const over = opener ?? (intro ? { id: song.id, file: intro } : undefined);
    this.play(song);
    this.changing = false;
    if (over) {
      await this.speak(over.file, over.id);
      if (this.state === 1) void this.fadeTo(100, FADE.swell); // (if it's still loading, it comes in at full)
    }
  }

  /**
   * The next instalment of his story for you (and the one after's due in a few songs): the next
   * you haven't heard, or, to jog your memory, the last you did, or an older one.
   */
  private nextInstalment(): Chat | undefined {
    this.storyIn = songsBetween(STORY.every);
    const told = TALE.filter((part) => this.known.includes(part.id));
    const next = TALE.find((part) => !this.known.includes(part.id));
    const last = told[told.length - 1];
    const resuming = !this.resumed;
    this.resumed = true;
    if (resuming && last) return last;
    if (told.length && (!next || Math.random() < STORY.again)) return this.pick(told);
    return next;
  }

  /** One of his tales, mostly one you haven't heard. */
  private tale(): Chat | undefined {
    const tales = this.talk('tale');
    const fresh = tales.filter((t) => !this.known.includes(t.id));
    return this.pick(fresh.length && Math.random() > RETOLD ? fresh : tales);
  }

  private remember() {
    try {
      localStorage.setItem(MEMORY, JSON.stringify({ heard: this.known, said: this.said }));
    } catch { /* Still works for this visit. */ }
  }

  /** A line from him; resolves when he's done. */
  private async speak(file: string, id: string) {
    if (!this.on || !this.ctx.sound.enabled) return;
    this.said = [id, ...this.said].slice(0, Math.max(1, Math.min(40, CHATTER.length - 1)));
    if ((id.startsWith('story-') || id.startsWith('tale-')) && !this.known.includes(id)) this.known.push(id);
    this.remember();
    this.deck?.classList.add('talking');
    const line = this.ctx.sound.say(file);
    this.talking = line;
    await line.done;
    if (this.talking === line) this.talking = undefined;
    this.deck?.classList.remove('talking');
  }

  /** Whether it's been long enough since he last remarked on the moment (sooner in a storm: it's hard to ignore). */
  private mayRemark(storm: boolean) {
    return this.clock - this.lastNow > NOW_GAP / (storm ? 2 : 1);
  }

  /**
   * Something to say between songs: a tale, life aboard or the moment, in TOPICS' shares (the
   * moment only if he hasn't just remarked on it; twice as likely in a storm).
   */
  private chat(storm: boolean): Chat | undefined {
    const now = this.mayRemark(storm) ? TOPICS.now * (storm ? 2 : 1) : 0;
    let r = Math.random() * (TOPICS.tales + TOPICS.aboard + now);
    if ((r -= TOPICS.tales) < 0) {
      const told = this.tale();
      if (told) return told;
    } else if (r - TOPICS.aboard >= 0) {
      const line = this.pick(this.talk('now'));
      if (line) {
        this.lastNow = this.clock;
        return line;
      }
    }
    return this.pick(this.talk('aboard'), 0.4); // (his week, when it's got a line for today, 40% of the time)
  }

  /** The chatter on a topic that's true right now (the storm cut-ins and the remarks on events aside: they have their moments). */
  private talk(topic: 'tale' | 'aboard' | 'now'): Chat[] {
    return CHATTER.filter(({ id, when }) => !id.startsWith(CUT_IN.prefix) && !id.startsWith('event-')
      && (topic === 'tale' ? id.startsWith('tale-') : !id.startsWith('tale-') && aboutNow(when) === (topic === 'now'))
      && (!when || this.fits(when)));
  }

  /**
   * The signal's just dropped badly in a storm: now and then he breaks in over the song to say
   * he's still there, and lets it carry on.
   */
  private stormCutIn() {
    if (this.rough < 0.5 || this.talking || this.changing || this.state !== 1) return;
    if (this.clock - this.cutAt < CUT_IN.gap || Math.random() > CUT_IN.chance) return;
    const line = this.pick(CHATTER.filter((c) => c.id.startsWith(CUT_IN.prefix) && (!c.when || this.fits(c.when))), 0);
    if (!line) return;
    this.cutAt = this.clock;
    void this.cutIn(line, 1500); // as the signal comes back
  }

  /** Break in over the song (turned down under him) with a line, after `wait` ms, and let it carry on. */
  private async cutIn(line: Chat, wait: number) {
    await new Promise((r) => setTimeout(r, wait));
    if (!this.on || this.talking || this.changing || this.ending || this.state !== 1) return;
    await this.fadeTo(UNDER, FADE.duck);
    await this.speak(line.file, line.id);
    void this.fadeTo(100, FADE.swell);
  }

  /** Whether it's that hour, weather, season, special day and point in his week on the island (whichever of them it asks). */
  private fits(when: When) {
    const now = this.ctx.sky.time;
    const time = timeOfDay(new Date(now).getHours());
    const week = when.state && weekOf(now);
    return (!when.time || when.time.includes(time)) && (!when.weather || when.weather.includes(this.ctx.weather.kind))
      && (!when.season || when.season.includes(season.name))
      && (!when.occasion || when.occasion.some((o) => (occasions as Set<string>).has(o)))
      && (!when.state || when.state.some((s) => week!.has(s)));
  }

  /** One of these he hasn't said lately (the ones written for this very moment `timely` of the time, if there are any). */
  private pick(from: Chat[], timely = 0.5): Chat | undefined {
    const fresh = from.filter((c) => !this.said.includes(c.id));
    const pool = fresh.length ? fresh : from;
    const now = pool.filter((c) => c.when);
    const choose = now.length && Math.random() < timely ? now : pool;
    return choose[Math.floor(Math.random() * choose.length)];
  }

  /**
   * Put a song on, silent at first: it fades in once it's actually playing (heard()). The player's
   * made the first time, and after that it's only told what's next.
   */
  private play(song: Song) {
    this.ramp?.cancel();
    this.volume = 0;
    this.state = -1;
    this.duration = 0;
    const now = this.deck?.querySelector('[data-radio-now]');
    if (now) now.textContent = `${song.title} · ${song.artist}`;
    if (this.player) {
      this.level();
      this.command('loadVideoById', [song.video]);
      return;
    }
    const player = document.createElement('iframe');
    player.src = `${ORIGIN}/embed/${song.video}?autoplay=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
    player.title = 'Radio Alles';
    player.allow = 'autoplay; encrypted-media';
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.tabIndex = -1;
    player.addEventListener('load', () => {
      this.tell({ event: 'listening' });
      this.told = -1;
      this.level();
    });
    this.deck?.querySelector('[data-radio-player]')?.replaceChildren(player);
    this.player = player;
  }

  /**
   * Take the song's volume to `to` over so many seconds, eased at both ends; a new fade takes over
   * from one under way. On a timer rather than with the frames, which stop while you're in another
   * tab (the song would stay down under nobody till you came back). Resolves when it's there (or
   * another fade took over).
   */
  private fadeTo(to: number, seconds: number): Promise<void> {
    this.ramp?.cancel();
    const from = this.volume;
    const start = performance.now();
    return new Promise((resolve) => {
      let timer = 0;
      const fade = { cancel: () => (clearTimeout(timer), resolve()) };
      this.ramp = fade;
      const step = () => {
        const k = Math.min(1, (performance.now() - start) / (seconds * 1000));
        this.volume = from + (to - from) * k * k * (3 - 2 * k);
        this.level();
        if (k < 1) timer = window.setTimeout(step, 40);
        else {
          if (this.ramp === fade) this.ramp = undefined;
          resolve();
        }
      };
      step();
    });
  }

  /** What the player says: how it's getting on, and when a song's over (or won't play here). */
  private heard(e: MessageEvent) {
    if (e.origin !== ORIGIN || !this.player || e.source !== this.player.contentWindow || typeof e.data !== 'string') return;
    let msg: { event?: string; info?: unknown };
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.event === 'onError') return void this.next(false); // (taken down, or not allowed off YouTube)
    const info = msg.event === 'infoDelivery' ? (msg.info as { playerState?: number; currentTime?: number; duration?: number } | null) : null;
    if (typeof info?.duration === 'number') this.duration = info.duration;
    // the last few seconds: the song goes out, and on to the break (a little early, like on the radio)
    if (typeof info?.currentTime === 'number' && this.on && this.state === 1 && !this.ending && !this.changing && !this.talking && this.duration > 30) {
      const left = this.duration - info.currentTime;
      if (left > 0 && left < FADE.out) {
        this.ending = true;
        void this.fadeTo(0, left).then(() => this.ending && this.on && this.next(false));
      }
    }
    const state = msg.event === 'onStateChange' ? msg.info : info?.playerState;
    if (typeof state !== 'number' || state === this.state) return;
    this.state = state;
    this.deck?.classList.toggle('playing', state === 1);
    // in it comes, once it's actually playing (under him, if he's talking)
    if (state === 1 && this.volume < 1 && !this.ending) void this.fadeTo(this.talking ? UNDER : 100, FADE.in);
    if (state === 0 && this.on) void this.next(false);
  }

  private command(func: string, args: unknown[] = []) {
    this.tell({ event: 'command', func, args });
  }

  private tell(msg: object) {
    this.player?.contentWindow?.postMessage(JSON.stringify(msg), ORIGIN);
  }
}
