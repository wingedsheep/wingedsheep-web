/**
 * Special days, by the visitor's own calendar. On each, a few things come out on the island
 * (tools/models/holidays.py builds them, each under a root tagged with its occasion, and
 * Island drops the ones that aren't today's):
 *
 *   easter        Easter Sunday and Monday: eggs hidden in the grass, and Beike after them (easter.ts)
 *   kingsday      27 April (the 26th when the 27th is a Sunday): orange bunting, a vrijmarkt
 *   remembrance   4 May: the summit flag at half-mast from six, and at eight two minutes' silence
 *                 (remembrance.ts): the sound fades away and Vincent puts the guitar down
 *   liberation    5 May: the flag right back up, with a bit of bunting on the pole
 *   airborne      the third Saturday of September, Arnhem's own day: the Airborne commemoration,
 *                 and a few parachutes coming down far off over the water (airborne.ts)
 *   sintmaarten   11 November: paper lanterns at dusk, carried round the island by the fair folk (lanterns.ts)
 *   arrival       the Saturday in mid-November when Sinterklaas comes in on his steamboat
 *   steamboat     from then to 5 December: the steamboat tied up at the head of the pier
 *   shoe          the same weeks: a clog by the fire, a carrot in it for the horse
 *   sinterklaas   5 December, pakjesavond: presents on the pier, a chocolate letter in the clog
 *   dive          New Year's Day at noon: the nieuwjaarsduik, Vincent into the sea in an orange hat
 *   halloween     the last days of October: jack-o'-lanterns at the hut and the library
 *   christmas     6 December (the tree goes up once Sinterklaas has gone) to Twelfth Night
 *   christmasday  24 to 26 December: presents under the tree
 *   newyear       New Year's Eve and Day: fireworks, all day, and wild at midnight (fireworks.ts)
 *   birthday      Vincent's, 23 January: balloons by the fire
 *   birthdays     14 August, hers and Charlie's and George's: party hats, a cake on the bench
 *   midsummer     Midsummer's Eve, 23 June: the fair folk are sure to hold their revel (revel.ts)
 *
 * And the ordinary days of the week, which have their habits too (week.ts):
 *
 *   washday       Mondays: the washing out on the line by the hut, till it rains
 *   sirentest     the first Monday of the month, at noon: the siren test, far off over the water
 *   postday       Tuesdays and Fridays: the post boat, mid-morning, and something new on the hut's shelf
 *   patchday      the second Tuesday of the month: the workshop robot installs its updates
 *   trawler       Wednesdays: a trawler working offshore, and every gull on the island after it
 *   friday        Friday evening: drinks by the fire, and nobody in a hurry to go to bed
 *   saturday      Saturdays: Vincent at the workbench, and sawdust on the workshop floor
 *   sunday        Sundays: a lie-in, pancakes, a church bell across the water, a kite if it's windy
 *
 * To preview: ?holiday=kingsday (any of the above), or ?date=2026-12-05.
 */

export type Occasion = 'kingsday' | 'shoe' | 'sinterklaas' | 'halloween' | 'christmas' | 'christmasday' | 'newyear' | 'birthday' | 'birthdays' | 'midsummer'
  | 'easter' | 'remembrance' | 'liberation' | 'airborne' | 'sintmaarten' | 'arrival' | 'steamboat' | 'dive'
  | 'washday' | 'sirentest' | 'postday' | 'patchday' | 'trawler' | 'friday' | 'saturday' | 'sunday';


/** A day that's squarely on each occasion, for ?holiday= (the weekdays: the next one that is). */
const PREVIEW: Record<Occasion, string | ((from: Date) => Date)> = {
  kingsday: '04-27',
  shoe: '11-28',
  sinterklaas: '12-05',
  halloween: '10-31',
  christmas: '12-18',
  christmasday: '12-25',
  newyear: '12-31',
  birthday: '01-23',
  birthdays: '08-14',
  midsummer: '06-23',
  easter: (d) => easter(d.getFullYear()),
  remembrance: '05-04',
  liberation: '05-05',
  airborne: (d) => airborneDay(d.getFullYear()),
  sintmaarten: '11-11',
  arrival: (d) => arrivalDay(d.getFullYear()),
  steamboat: '11-28',
  dive: '01-01',
  washday: (d) => next(d, (x) => x.getDay() === 1),
  sirentest: (d) => next(d, (x) => sirenTestOn(x)),
  postday: (d) => next(d, (x) => x.getDay() === 2),
  patchday: (d) => next(d, (x) => x.getDay() === 2 && Math.ceil(x.getDate() / 7) === 2),
  trawler: (d) => next(d, (x) => x.getDay() === 3),
  friday: (d) => next(d, (x) => x.getDay() === 5),
  saturday: (d) => next(d, (x) => x.getDay() === 6),
  sunday: (d) => next(d, (x) => x.getDay() === 0),
};

/** The first day from `d` on (d itself included) that `ok` likes. */
function next(d: Date, ok: (x: Date) => boolean) {
  const x = new Date(d);
  for (let i = 0; i < 400 && !ok(x); i++) x.setDate(x.getDate() + 1);
  return x;
}

/** Easter Sunday (the anonymous Gregorian computus), as month (1-12) and day in one number. */
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * The sirens are tested at noon on the first Monday of every month, for a minute and 26 seconds,
 * except when that Monday is a public holiday (or the fourth of May, the day of remembrance).
 */
function sirenTestOn(d: Date) {
  if (d.getDay() !== 1 || d.getDate() > 7) return false;
  const k = md(d);
  const e = easter(d.getFullYear());
  const days = (n: number) => md(new Date(e.getFullYear(), e.getMonth(), e.getDate() + n));
  return ![101, kingsDay(d.getFullYear()), 504, 505, 1225, 1226, days(1), days(50)].includes(k);
}

/** Month (1-12) and day, as one number to compare: 1205 is 5 December. */
const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate();

function kingsDay(year: number) {
  const sunday = new Date(year, 3, 27).getDay() === 0;
  return sunday ? 426 : 427;
}

/** The Airborne commemoration on the heath above Arnhem: the third Saturday of September. */
function airborneDay(year: number) {
  return next(new Date(year, 8, 15), (x) => x.getDay() === 6);
}

/** Sinterklaas comes in on his steamboat on a Saturday in mid-November: the first from the 12th. */
function arrivalDay(year: number) {
  return next(new Date(year, 10, 12), (x) => x.getDay() === 6);
}

/** Which occasions a day falls on. */
export function occasionsOn(d: Date): Set<Occasion> {
  const k = md(d);
  const on = new Set<Occasion>();
  const y = d.getFullYear();
  const e = easter(y);
  if (k === md(e) || k === md(new Date(y, e.getMonth(), e.getDate() + 1))) on.add('easter');
  if (k === kingsDay(y)) on.add('kingsday');
  if (k === 504) on.add('remembrance');
  if (k === 505) on.add('liberation');
  if (k === md(airborneDay(y))) on.add('airborne');
  if (k === 1111) on.add('sintmaarten');
  const arrived = md(arrivalDay(y));
  if (k === arrived) on.add('arrival');
  if (k >= arrived && k <= 1205) {
    on.add('steamboat');
    on.add('shoe');
  }
  if (k === 1205) on.add('sinterklaas');
  if (k === 101) on.add('dive');
  if (k >= 1027 && k <= 1031) on.add('halloween');
  if (k >= 1206 || k <= 106) on.add('christmas');
  if (k >= 1224 && k <= 1226) on.add('christmasday');
  if (k === 1231 || k === 101) on.add('newyear');
  if (k === 123) on.add('birthday');
  if (k === 814) on.add('birthdays');
  if (k === 623) on.add('midsummer');
  const day = d.getDay();
  if (day === 1) on.add('washday');
  if (sirenTestOn(d)) on.add('sirentest');
  if (day === 2 || day === 5) on.add('postday');
  if (day === 2 && Math.ceil(d.getDate() / 7) === 2) on.add('patchday');
  if (day === 3) on.add('trawler');
  if (day === 5) on.add('friday');
  if (day === 6) on.add('saturday');
  if (day === 0) on.add('sunday');
  return on;
}

/** The day it is for this visit: today, or whatever ?date= or ?holiday= asked for (at the time it is now). */
export function visitDate(): Date {
  const now = new Date();
  try {
    const q = new URLSearchParams(location.search);
    const h = q.get('holiday') as Occasion | null;
    const p = h && h in PREVIEW ? PREVIEW[h] : null;
    const d = typeof p === 'function' ? iso(p(now)) : p ? `${now.getFullYear()}-${p}` : q.get('date');
    if (d && !Number.isNaN(Date.parse(d))) {
      const at = new Date(`${d}T12:00:00`);
      at.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      return at;
    }
  } catch {}
  return now;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today's occasions (fixed for the visit). */
export const occasions = occasionsOn(visitDate());

/** How many days a preview is shifted from today, so the clock (which ?time= can move too) stays on the previewed day. */
const shiftDays = (() => {
  const a = visitDate();
  const b = new Date();
  return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5);
})();

/** Island time (ms) as a date on the visit's calendar: moved by whole days, so the clock on the wall stays put across a change to or from summer time. */
export function onTheDay(time: number) {
  const d = new Date(time);
  d.setDate(d.getDate() + shiftDays);
  return d;
}

/**
 * How hard the fireworks are going at island time `time` (ms, from Sky.time): 0 for none, 1 for
 * a lively night, and more when it goes wild. Nobody's here at midnight, so there's plenty all
 * New Year's Eve, day and night (the whole country lets them off from the morning), building
 * through the evening; at midnight the sky goes completely mad for half an hour, then slowly
 * calms down; New Year's Day has the leftovers, all day.
 */
export function fireworksAt(time: number) {
  if (!occasions.has('newyear')) return 0;
  const d = onTheDay(time);
  const k = md(d);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  if (k === 1231) {
    if (h < 18) return 0.45;
    if (h < 23.75) return 0.45 + ((h - 18) / 5.75) ** 2 * 0.45;
    return 0.9 + ((h - 23.75) / 0.25) * 0.4; // the last quarter of an hour, and the countdown
  }
  if (k === 101) {
    if (h < 0.5) return 3.2; // happy new year: everything at once
    if (h < 1.5) return 3.2 - (h - 0.5) * 2.2;
    if (h < 4) return 1 - ((h - 1.5) / 2.5) * 0.6;
    return 0.4;
  }
  return 0;
}

/** Seconds to midnight on New Year's Eve (by island time), or null if it isn't the last minute of the year. */
export function countdownAt(time: number) {
  if (!occasions.has('newyear')) return null;
  const d = onTheDay(time);
  if (md(d) !== 1231 || d.getHours() !== 23 || d.getMinutes() !== 59) return null;
  return 60 - d.getSeconds();
}

/** Hours into the visit's day at island time `time` (ms, from Sky.time). */
function hourOf(time: number) {
  const d = onTheDay(time);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/**
 * The fourth of May at island time `time`: whether the flag's at half-mast (from six in the
 * evening, as it is all over the country), and how far into the two minutes' silence at eight
 * we are: 0 outside it, rising to 1 over its first few seconds and falling back over its last.
 */
export function remembranceAt(time: number) {
  if (!occasions.has('remembrance')) return { halfMast: false, silence: 0 };
  const h = hourOf(time);
  const s = (h - 20) * 3600; // seconds since eight
  const silence = s < -2 || s > 125 ? 0 : Math.min(1, (s + 2) / 6, (125 - s) / 6);
  return { halfMast: h >= 18, silence: Math.max(0, silence) };
}

/** Whether it's (nearly) eight on the fourth of May, when Vincent stays at the fire for the silence. */
export function silenceNear(time: number) {
  if (!occasions.has('remembrance')) return false;
  const h = hourOf(time);
  return h > 19.95 && h < 20.05;
}

/**
 * New Year's Day at island time `time`: minutes since noon while the nieuwjaarsduik is on (from
 * a quarter to, when he's down on the beach warming up, to half past, when he's long since
 * back in his clothes), otherwise null.
 */
export function diveAt(time: number) {
  if (!occasions.has('dive')) return null;
  const m = (hourOf(time) - 12) * 60;
  return m >= -15 && m < 30 ? m : null;
}

/** How many of the days `ok` likes there have been from 1 January 2024 up to the visit's day (including it, if it's one). */
export function countDays(ok: (d: Date) => boolean, upTo = visitDate()) {
  let n = 0;
  for (const d = new Date(2024, 0, 1); d <= upTo; d.setDate(d.getDate() + 1)) if (ok(d)) n++;
  return n;
}

/** A number in 0..1 that stays the same all day, a different one per `salt` (for when on the day something happens). */
export function daily(salt: number, d = visitDate()) {
  const n = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A word on arrival, on the days that have one (main.ts says it once a day). */
export function greeting(): string | null {
  const newYear = md(visitDate()) === 101 ? 'Happy New Year! A few stragglers are still letting off what they had left.' : 'It’s New Year’s Eve. Stay up: the sky goes off at midnight.';
  const lines: Partial<Record<Occasion, string>> = {
    birthday: 'It’s Vincent’s birthday today. There are balloons by the fire.',
    birthdays: 'Three birthdays today: hers, Charlie’s and George’s. There’s cake by the bench, and the cats are wearing hats about it.',
    kingsday: 'Fijne Koningsdag! The island’s gone orange, and someone’s selling a teddy on the plaza.',
    sinterklaas: 'It’s pakjesavond: there are presents on the pier, and something in the clog by the fire.',
    arrival: 'Sinterklaas has arrived! His steamboat came in this morning and is tied up at the pier.',
    dive: 'Happy New Year! At noon Vincent is going into the sea. He says so every year.',
    easter: 'Happy Easter! There are eggs hidden in the grass. Beike knows.',
    remembrance: 'It’s the fourth of May. At eight tonight the whole country is quiet for two minutes, and so is the island.',
    liberation: 'Happy Liberation Day! The flag’s back up, with a bit of bunting on it.',
    airborne: 'It’s the Airborne commemoration today, Arnhem’s own. Watch the sky over the water: they still jump.',
    sintmaarten: 'It’s Sint Maarten. Stay till it gets dark: somebody’s bringing lanterns.',
    halloween: 'Somebody’s been carving pumpkins: there are candles lit at the library door and up at the hut.',
    christmasday: 'Merry Christmas! There are presents under the tree on the plaza.',
    newyear: newYear,
    midsummer: 'It’s Midsummer’s Eve. Stay till the light goes: there’s music on the beach tonight.',
  };
  const first = (Object.keys(lines) as Occasion[]).find((o) => occasions.has(o));
  return first ? lines[first]! : null;
}
