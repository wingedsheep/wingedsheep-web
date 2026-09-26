import { onTheDay } from './calendar';

/**
 * The island keeps the visitor's hours (sky.ts follows their real sun, and ?time=23:30 previews
 * another hour): who's up, who's reading in bed, who's asleep. Bedtimes wander a little from
 * night to night, but hold still for the whole of one, so nobody hops in and out of bed. Friday
 * night runs late (drinks by the fire), and Sunday morning is a lie-in.
 */

/** Hours since local midnight, 0..24, at a timestamp (sky.ts `time`). */
export function hourOf(time: number) {
  const d = new Date(time);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** A number in 0..1 that stays the same all night (one runs noon to noon), a different one per `salt`. */
function nightly(time: number, salt: number) {
  const d = new Date(time - 12 * 3600e3);
  const n = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Which night it is, by the day it started on (0 Sunday … 6 Saturday; a night runs noon to noon). */
function night(time: number) {
  return onTheDay(time - 12 * 3600e3).getDay();
}
/** Friday night: nobody's in a hurry. */
const FRIDAY = 5;
/** Saturday night, and so Sunday morning: nobody's in a hurry to get up either. */
const SATURDAY = 6;

/** Whether `hour` falls from `from` up to `to`, round midnight if `to` comes first. */
function between(hour: number, from: number, to: number) {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/**
 * Vincent's night: to bed anywhere from half past ten to half past two (an hour later on a Friday),
 * up again between seven and eight (on a Sunday, not before nine).
 */
export function vincentAsleep(time: number) {
  const n = night(time);
  const down = (22.5 + (n === FRIDAY ? 1 : 0) + nightly(time, 1) * 4) % 24;
  const up = n === SATURDAY ? 9 + nightly(time, 2) * 0.75 : 7 + nightly(time, 2);
  return between(hourOf(time), down, up);
}

/** Late evening, when he's more likely to be hunched over his game than out by the fire. */
export function late(time: number) {
  const hour = hourOf(time);
  return hour >= 21.5 || hour < 3;
}

/**
 * Hers: into bed at half past ten with a book, asleep by a quarter to twelve at the latest, and
 * up a little before him. `null` while she's up.
 */
export function herNight(time: number): 'reading' | 'asleep' | null {
  const hour = hourOf(time);
  const n = night(time);
  const late = n === FRIDAY ? 1.25 : 0;
  const up = n === SATURDAY ? 8.5 + nightly(time, 3) * 0.6 : 6.75 + nightly(time, 3) * 0.75;
  if (!between(hour, (22.5 + late) % 24, up)) return null;
  return between(hour, (23 + late + nightly(time, 4) * 0.75) % 24, up) ? 'asleep' : 'reading';
}

/** Friday evening, from five: drinks by the fire (week.ts puts out the crate). */
export function fridayEvening(time: number) {
  const d = onTheDay(time);
  return d.getDay() === FRIDAY && hourOf(time) >= 17;
}

/** Sunday morning, till half past eleven: pancakes. */
export function sundayMorning(time: number) {
  return onTheDay(time).getDay() === 0 && hourOf(time) < 11.5;
}
