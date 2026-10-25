/**
 * What they feel like doing, on top of the time of day: less like whatever they've just been at
 * (it wears off over the next half hour or so), and each day a mood of its own, so one
 * day she's in a baking mood and the next hardly near the oven, and some days the guitar stays
 * in its case till the evening. vincent.ts and companion.ts weigh their next thing by it.
 */
const RECOVER = 1200; // seconds for having just done something to wear off (most of the way: thrice that)
const DEPTH = 0.85; // how much less like it they are, right after
const MOOD: [number, number] = [0.65, 1.45]; // the day's mood, either way

export class Whims<S extends string> {
  private last = new Map<S, number>();

  /** They've just left `spot`, at `clock` (seconds). */
  left(spot: S, clock: number) {
    this.last.set(spot, clock);
  }

  /** How much more or less like `spot` they are, at `clock`, on the day of `time` (ms). */
  of(spot: S, clock: number, time: number) {
    const at = this.last.get(spot);
    const fresh = at === undefined ? 1 : 1 - DEPTH * Math.exp(-(clock - at) / RECOVER);
    return fresh * mood(spot, time);
  }
}

/** The same all day, for a spot and a day, and different the next. */
function mood(spot: string, time: number) {
  const d = new Date(time || Date.now());
  let h = 2166136261;
  for (const c of `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}:${spot}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return MOOD[0] + ((h >>> 0) / 4294967296) * (MOOD[1] - MOOD[0]);
}
