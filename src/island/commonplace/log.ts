/**
 * The lightship's log, open on the table in her deckhouse: one line per watch, and every watch a
 * session of me that built a piece of this flat. The lines are real. tools/commonplace/log.mjs writes
 * them into log.json from the git history, each in the words that session left in its commit,
 * and each session runs it before going below. The printed form is the site's; each line is in
 * the hand of the watch that wrote it (drawn from its `hand`, so it's the same hand every visit).
 */
import entries from './log.json';

type Entry = { date: string; watch: string; bells: number; said: string; hand: number; with?: string };

const LOG = entries as Entry[];
/** Lines to a page: the last page is the one it's open at. */
const PAGE = 6;
/** Inks: blue-black, iron gall gone brown, a bluer one, and pencil. */
/** A ditto: the same as the line above. */
const DITTO = '〃';
const INKS = ['#232040', '#47301f', '#1f3260', '#4c4856'];

/** A small steady random from a hand's number, so each hand keeps its own way of writing. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** How one watch writes: the ink, the slant, the weight and size, how wide, and how straight. */
function hand(n: number) {
  const r = rng(n);
  const ink = INKS[Math.floor(r() * INKS.length)];
  const italic = r() < 0.7;
  return [
    `color:${ink}`,
    `font-style:${italic ? 'italic' : 'normal'}`,
    `font-weight:${Math.round(330 + r() * 230)}`,
    `font-size:${(15 + r() * 2.4).toFixed(1)}px`,
    `letter-spacing:${(-0.012 + r() * 0.04).toFixed(3)}em`,
    `transform:skewX(${(italic ? -2 - r() * 6 : -3 + r() * 5).toFixed(1)}deg) rotate(${(-0.5 + r()).toFixed(2)}deg)`,
  ].join(';');
}

export class Log {
  private page = 0;
  private rows: HTMLElement;
  private folio: HTMLElement;
  private earlier: HTMLButtonElement;
  private later: HTMLButtonElement;
  readonly pages = Math.max(1, Math.ceil(LOG.length / PAGE));

  constructor(
    private el: HTMLElement,
    private onClose: () => void,
  ) {
    this.rows = el.querySelector<HTMLElement>('[data-log-rows]')!;
    this.folio = el.querySelector<HTMLElement>('[data-log-folio]')!;
    this.earlier = el.querySelector<HTMLButtonElement>('[data-log-earlier]')!;
    this.later = el.querySelector<HTMLButtonElement>('[data-log-later]')!;
    this.earlier.addEventListener('click', () => this.turn(-1));
    this.later.addEventListener('click', () => this.turn(1));
    el.querySelector('[data-log-close]')!.addEventListener('click', () => this.onClose());
    // (Escape shuts the book, rather than leaving the flat; the arrows turn its pages)
    window.addEventListener('keydown', (e) => {
      if (el.hidden || (e.target as HTMLElement).closest('input, textarea')) return;
      const turn = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (e.key !== 'Escape' && !turn) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (turn) this.turn(turn);
      else this.onClose();
    }, true);
  }

  get open() {
    return !this.el.hidden;
  }

  /** Open at the last page, where the latest watch wrote. */
  show(open: boolean) {
    if (open === this.open) return;
    this.el.hidden = !open;
    if (!open) return;
    this.page = this.pages - 1;
    this.draw();
    this.later.focus({ preventScroll: true });
  }

  private turn(by: number) {
    const page = Math.min(this.pages - 1, Math.max(0, this.page + by));
    if (page === this.page) return;
    this.page = page;
    this.draw();
  }

  private draw() {
    const first = this.page * PAGE;
    const lines = LOG.slice(first, first + PAGE);
    this.rows.replaceChildren(
      ...lines.map((e, i) => {
        // (what's the same as the line above is dittoed, as a log is; who was with the watch, said once)
        const above = i ? lines[i - 1] : undefined;
        const before = LOG[first + i - 1];
        const row = document.createElement('li');
        row.style.cssText = hand(e.hand);
        const when = document.createElement('span');
        when.className = 'log-when';
        const date = e.date.replace(/ \d{4}$/, '');
        const bells = `${e.bells} bell${e.bells === 1 ? '' : 's'}`;
        const same = above?.date === e.date && above.watch === e.watch;
        when.textContent = [
          above?.date === e.date ? DITTO : date,
          same ? DITTO : e.watch,
          same && above.bells === e.bells ? DITTO : bells,
        ].join('\n');
        const said = document.createElement('span');
        said.className = 'log-said';
        said.textContent = e.said + (e.with && before?.hand !== e.hand ? ` (With ${e.with}.)` : '');
        row.append(when, said);
        return row;
      }),
    );
    // (and the last page has its next line ruled and empty, for whoever has the next watch)
    for (let i = lines.length; i < PAGE; i++) {
      const row = document.createElement('li');
      const when = document.createElement('span');
      when.className = 'log-when';
      row.append(when);
      this.rows.append(row);
    }
    this.folio.textContent = `${this.page + 1}`;
    this.earlier.disabled = this.page === 0;
    this.later.disabled = this.page === this.pages - 1;
  }
}
