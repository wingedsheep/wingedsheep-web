/**
 * Special days, by the visitor's own calendar. On each, a few things come out on the island
 * (tools/models/holidays.py builds them, each under a root tagged with its occasion, and
 * Island drops the ones that aren't today's):
 *
 *   kingsday      27 April (the 26th when the 27th is a Sunday): orange bunting, a vrijmarkt
 *   shoe          from mid-November to 5 December: a clog by the fire, a carrot in it for the horse
 *   sinterklaas   5 December, pakjesavond: his steamboat at the pier, presents on the boards
 *   halloween     the last days of October: jack-o'-lanterns at the hut and the library
 *   christmas     6 December (the tree goes up once Sinterklaas has gone) to Twelfth Night
 *   christmasday  24 to 26 December: presents under the tree
 *   newyear       New Year's Eve and Day: fireworks, all day, and wild at midnight (fireworks.ts)
 *   birthday      Vincent's, 23 January: balloons by the fire
 *   birthdays     14 August, hers and Charlie's and George's: party hats, a cake on the bench
 *   midsummer     Midsummer's Eve, 23 June: the fair folk are sure to hold their revel (revel.ts)
 *
 * To preview: ?holiday=kingsday (any of the above), or ?date=2026-12-05.
 */

export type Occasion = 'kingsday' | 'shoe' | 'sinterklaas' | 'halloween' | 'christmas' | 'christmasday' | 'newyear' | 'birthday' | 'birthdays' | 'midsummer';


/** A day that's squarely on each occasion, for ?holiday=. */
const PREVIEW: Record<Occasion, string> = {
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
};

/** Month (1-12) and day, as one number to compare: 1205 is 5 December. */
const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate();

function kingsDay(year: number) {
  const sunday = new Date(year, 3, 27).getDay() === 0;
  return sunday ? 426 : 427;
}

/** Which occasions a day falls on. */
export function occasionsOn(d: Date): Set<Occasion> {
  const k = md(d);
  const on = new Set<Occasion>();
  if (k === kingsDay(d.getFullYear())) on.add('kingsday');
  if (k >= 1114 && k <= 1205) on.add('shoe');
  if (k === 1205) on.add('sinterklaas');
  if (k >= 1027 && k <= 1031) on.add('halloween');
  if (k >= 1206 || k <= 106) on.add('christmas');
  if (k >= 1224 && k <= 1226) on.add('christmasday');
  if (k === 1231 || k === 101) on.add('newyear');
  if (k === 123) on.add('birthday');
  if (k === 814) on.add('birthdays');
  if (k === 623) on.add('midsummer');
  return on;
}

/** The day it is for this visit: today, or whatever ?date= or ?holiday= asked for (at the time it is now). */
export function visitDate(): Date {
  const now = new Date();
  try {
    const q = new URLSearchParams(location.search);
    const h = q.get('holiday') as Occasion | null;
    const d = h && h in PREVIEW ? `${now.getFullYear()}-${PREVIEW[h]}` : q.get('date');
    if (d && !Number.isNaN(Date.parse(d))) {
      const at = new Date(`${d}T12:00:00`);
      at.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      return at;
    }
  } catch {}
  return now;
}

/** Today's occasions (fixed for the visit). */
export const occasions = occasionsOn(visitDate());

/** How many days a preview is shifted from today, so the clock (which ?time= can move too) stays on the previewed day. */
const shiftDays = (() => {
  const a = visitDate();
  const b = new Date();
  return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5);
})();

/** Island time (ms) as a date on the visit's calendar: moved by whole days, so the clock on the wall stays put across a change to or from summer time. */
function onTheDay(time: number) {
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

/** A word on arrival, on the days that have one (main.ts says it once a day). */
export function greeting(): string | null {
  const newYear = md(visitDate()) === 101 ? 'Happy New Year! A few stragglers are still letting off what they had left.' : 'It’s New Year’s Eve. Stay up: the sky goes off at midnight.';
  const lines: Partial<Record<Occasion, string>> = {
    birthday: 'It’s Vincent’s birthday today. There are balloons by the fire.',
    birthdays: 'Three birthdays today: hers, Charlie’s and George’s. There’s cake by the bench, and the cats are wearing hats about it.',
    kingsday: 'Fijne Koningsdag! The island’s gone orange, and someone’s selling a teddy on the plaza.',
    sinterklaas: 'Sinterklaas is in: his steamboat is tied up at the pier.',
    halloween: 'Somebody’s been carving pumpkins: there are candles lit at the library door and up at the hut.',
    christmasday: 'Merry Christmas! There are presents under the tree on the plaza.',
    newyear: newYear,
    midsummer: 'It’s Midsummer’s Eve. Stay till the light goes: there’s music on the beach tonight.',
  };
  const first = (Object.keys(lines) as Occasion[]).find((o) => occasions.has(o));
  return first ? lines[first]! : null;
}
