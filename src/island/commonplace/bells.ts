/**
 * The lightship's bell: whoever has the watch strikes it every half hour, by the island's clock,
 * in pairs, one bell half an hour into a watch up to eight at its end (Royal Navy reckoning, the
 * same as her log's: the dog watches split 16–20 in two). Heard across the flat from where she
 * lies; aboard, you see it rock on its bar as it's struck.
 */

/** Within a pair, and between pairs (s). */
const IN_PAIR = 0.55;
const BETWEEN = 1.5;
const COUNT = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/** The bells for the half hour that's just begun at `ms` (on the island's clock), 1 … 8. */
export function bellsAt(ms: number) {
  const d = new Date(ms);
  const h = d.getHours();
  const halves = Math.floor((h * 60 + d.getMinutes()) / 30);
  // (the dog watches: the first ends at four bells, and the last starts again from one)
  if (h >= 16 && h < 20) {
    const n = halves - 32;
    return n === 0 ? 8 : n <= 4 ? n : n - 4;
  }
  return halves % 8 || 8;
}

/** When in a striking each stroke falls (s from the first), for `n` bells. */
export function strokes(n: number) {
  const at: number[] = [];
  for (let i = 0; i < n; i++) at.push(Math.floor(i / 2) * (IN_PAIR + BETWEEN) + (i % 2) * IN_PAIR);
  return at;
}

/** What her bell last struck, and when it strikes next, for its card. */
export function bellSaid(ms: number) {
  const last = bellsAt(ms);
  const next = bellsAt(ms + 30 * 6e4 - (ms % (30 * 6e4)));
  const mins = Math.ceil((30 * 6e4 - (ms % (30 * 6e4))) / 6e4);
  return `It last struck ${COUNT[last].toLowerCase()} bell${last === 1 ? '' : 's'}. ${COUNT[next]} bell${next === 1 ? '' : 's'} in ${mins === 1 ? 'a minute' : mins < 9 ? `${COUNT[mins].toLowerCase()} minutes` : `${mins} minutes`}.`;
}

/** Said on her card from the flat, a little while after you heard it. */
export function bellHeard(n: number) {
  return `That was her bell, struck by whoever has the watch: ${COUNT[n].toLowerCase()} bell${n === 1 ? '' : 's'}.`;
}

/**
 * Watches the clock, and strikes the bells as each half hour comes round, a stroke at a time.
 * `heard` is the last striking's count, for a few minutes after it.
 */
export class Bells {
  private half = -1;
  /** The strokes still to come (s, on the flat's own clock), and the count being struck. */
  private due: number[] = [];
  private count = 0;
  private struckAt = -1e9;
  /** How hard the bell's swinging (it rocks on its bar after each stroke), and where in its swing. */
  swing = 0;
  private phase = 0;

  /** One frame: `ms` the island's clock, `t` the flat's. Strikes as each stroke comes due. */
  update(dt: number, ms: number, t: number, stroke: () => void) {
    const half = Math.floor(ms / (30 * 6e4));
    // (not on arrival: only a half hour that comes round while you're here)
    if (this.half >= 0 && half !== this.half) this.strike(bellsAt(ms), t);
    this.half = half;
    while (this.due.length && t >= this.due[0]) {
      this.due.shift();
      this.swing = 1;
      this.phase = 0;
      stroke();
    }
    this.phase += dt;
    this.swing *= Math.exp(-dt * 1.4);
  }

  /** The bell's angle on its bar now (rad): a small rock after each stroke, dying away. */
  get angle() {
    return 0.22 * this.swing * Math.sin(this.phase * Math.PI * 2 * 1.3);
  }

  /** Strike `n` bells, starting now. */
  strike(n: number, t: number) {
    this.count = n;
    this.struckAt = t;
    this.due = strokes(n).map((s) => t + s);
  }

  /** The count just struck, while it's still news (three minutes), or 0. */
  heard(t: number) {
    return t - this.struckAt < 180 ? this.count : 0;
  }
}
