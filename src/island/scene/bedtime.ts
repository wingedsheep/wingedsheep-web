/**
 * The island keeps the visitor's hours (sky.ts follows their real sun, and ?time=23:30 previews
 * another hour): who's up, who's reading in bed, who's asleep. Bedtimes wander a little from
 * night to night, but hold still for the whole of one, so nobody hops in and out of bed.
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

/** Whether `hour` falls from `from` up to `to`, round midnight if `to` comes first. */
function between(hour: number, from: number, to: number) {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** Vincent's night: to bed anywhere from half past ten to half past two, up again between seven and eight. */
export function vincentAsleep(time: number) {
  return between(hourOf(time), (22.5 + nightly(time, 1) * 4) % 24, 7 + nightly(time, 2));
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
  const up = 6.75 + nightly(time, 3) * 0.75;
  if (!between(hour, 22.5, up)) return null;
  return between(hour, 23 + nightly(time, 4) * 0.75, up) ? 'asleep' : 'reading';
}
