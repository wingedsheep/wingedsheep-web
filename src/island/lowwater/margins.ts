/**
 * The shelf behind Tine's counter: the books she won't sell, kept for what's written in them. Take
 * one down and it's open at its best page: the printed text, and in its margins three readers in
 * three hands, decades apart, arguing with the book and with each other. The last hand in each is
 * Tine's own, in green ink, though she tells you not to write in them.
 *
 * Every printed passage is real and out of copyright, and every fact the readers argue with is
 * true; the readers are made up. A `[h:words]` in the text is underlined by hand `h`.
 */

type Hand = 'pencil' | 'biro' | 'tine';
type Note = { hand: Hand; side: 'l' | 'r'; text: string };
type Row = { text: string; notes?: Note[] };
type Book = { title: string; edition: string; page: number; rows: Row[] };

export const KEPT: Book[] = [
  {
    title: 'Euclid · The Elements, Book I',
    edition: 'tr. T. L. Heath, Cambridge, 1908',
    page: 154,
    rows: [
      { text: 'Postulates. Let the following be postulated:' },
      { text: '1. To draw a straight line from any point to any point.' },
      { text: '2. To produce a finite straight line continuously in a straight line.' },
      { text: '3. To describe a circle with any centre and distance.' },
      { text: '4. That all right angles are equal to one another.' },
      {
        text: '5. That, if a straight line falling on two straight lines make the interior angles on the same side less than two right angles, the two straight lines, [pencil:if produced indefinitely, meet] on that side on which are the angles less than the two right angles.',
        notes: [
          { hand: 'pencil', side: 'r', text: 'Too long for a postulate. A theorem in disguise. Proof on the flyleaf. H. M. 1931' },
          { hand: 'biro', side: 'r', text: 'Your flyleaf assumes it in its third line. So did Ptolemy, Proclus and Wallis. Beltrami, 1868: a surface where the other four hold and this one doesn’t.' },
          { hand: 'tine', side: 'l', text: 'H. M. kept trying. There are four more flyleaves of it at the back. T.' },
        ],
      },
    ],
  },
  {
    title: 'Jane Austen · Pride and Prejudice',
    edition: 'Vol. I, Chapter I · first published 1813',
    page: 1,
    rows: [
      {
        text: 'It is a truth [pencil:universally] acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
        notes: [{ hand: 'pencil', side: 'l', text: 'IRONY!! (Miss Blake says) 4th form, 1952' }],
      },
      {
        text: 'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the [biro:rightful property] of some one or other of their daughters.',
        notes: [
          { hand: 'biro', side: 'r', text: 'Not irony, just the wrong way round. He doesn’t want a wife, the families want his fortune. Read the second sentence, Miss Blake.' },
          { hand: 'tine', side: 'l', text: 'It’s both, that’s the joke. And he’s the property. She was twenty when she started it. T.' },
        ],
      },
    ],
  },
  {
    title: 'René Descartes · Meditations, II',
    edition: 'tr. John Veitch, Edinburgh, 1853',
    page: 97,
    rows: [
      {
        text: '…so that it must, in fine, be maintained, all things being maturely and carefully considered, that this proposition (pronunciatum) I am, I exist, is necessarily true [pencil:each time] it is expressed by me, or conceived in my mind.',
        notes: [
          { hand: 'pencil', side: 'r', text: 'Each time. And in between?' },
          { hand: 'biro', side: 'l', text: 'Lichtenberg: all he’s owed is “it thinks”, the way we say “it lightens”. Where’s the I?' },
        ],
      },
      {
        text: 'But I do not yet know with sufficient clearness what I am, [tine:though assured that I am];',
        notes: [{ hand: 'tine', side: 'r', text: 'Most mornings that’s as far as I get, too. T.' }],
      },
    ],
  },
];

/** The printed text, with each `[hand:words]` underlined in that hand. */
function printed(text: string) {
  const p = document.createElement('p');
  p.className = 'kept-print';
  for (const part of text.split(/(\[[a-z]+:[^\]]+\])/)) {
    const m = part.match(/^\[([a-z]+):([^\]]+)\]$/);
    if (!m) {
      p.append(part);
      continue;
    }
    const u = document.createElement('u');
    u.className = `hand-${m[1]}`;
    u.textContent = m[2];
    p.append(u);
  }
  return p;
}

function note(n: Note) {
  const el = document.createElement('p');
  el.className = `kept-note hand-${n.hand}`;
  el.textContent = n.text;
  return el;
}

export class Margins {
  /** The book it's open at; the next time you take one down, the next along. */
  book = -1;
  private spread: HTMLElement;
  private head: HTMLElement;
  private folio: HTMLElement;
  private another: HTMLButtonElement;

  constructor(
    private el: HTMLElement,
    private onClose: () => void,
  ) {
    this.spread = el.querySelector<HTMLElement>('[data-kept-rows]')!;
    this.head = el.querySelector<HTMLElement>('[data-kept-head]')!;
    this.folio = el.querySelector<HTMLElement>('[data-kept-folio]')!;
    this.another = el.querySelector<HTMLButtonElement>('[data-kept-another]')!;
    this.another.addEventListener('click', () => this.take());
    el.querySelector('[data-kept-close]')!.addEventListener('click', () => this.onClose());
    // (Escape puts it back, rather than leaving the shop)
    window.addEventListener('keydown', (e) => {
      if (el.hidden || e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this.onClose();
    }, true);
  }

  get open() {
    return !this.el.hidden;
  }

  show(open: boolean) {
    if (open === this.open) return;
    this.el.hidden = !open;
    if (!open) return;
    this.take();
    this.another.focus({ preventScroll: true });
  }

  /** The next book along, open at its page. */
  private take() {
    // (`?kept=<n>` opens that one first, for a look)
    const asked = Number(new URLSearchParams(location.search).get('kept'));
    this.book = this.book < 0 && asked >= 1 && asked <= KEPT.length ? asked - 1 : (this.book + 1) % KEPT.length;
    const b = KEPT[this.book];
    this.head.replaceChildren(Object.assign(document.createElement('span'), { textContent: b.title }), Object.assign(document.createElement('span'), { textContent: b.edition }));
    this.folio.textContent = String(b.page);
    this.spread.replaceChildren(
      ...b.rows.map((r) => {
        const row = document.createElement('div');
        row.className = 'kept-row';
        const left = document.createElement('div');
        left.className = 'kept-margin kept-left';
        const right = document.createElement('div');
        right.className = 'kept-margin kept-right';
        for (const n of r.notes ?? []) (n.side === 'l' ? left : right).append(note(n));
        row.append(left, printed(r.text), right);
        return row;
      }),
    );
    this.el.scrollTop = 0;
    this.el.classList.remove('turned');
    void this.el.offsetWidth;
    this.el.classList.add('turned');
  }
}
