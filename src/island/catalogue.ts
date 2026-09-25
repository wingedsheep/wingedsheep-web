/**
 * The library's card catalogue (the panel beside the room): a drawer of index cards, one per
 * post, filed by year. Pick a subject or a tag to narrow it down; the matching books stand out on
 * the shelves. Pointing at a card finds its book and pointing at a book finds its card.
 */

export interface CatalogueEvents {
  /** a card is pointed at or focused (null: none) */
  hot(slug: string | null): void;
  /** the filter changed: the posts that match, or null for all of them */
  filter(slugs: Set<string> | null): void;
  /** a piece on the music stand was picked */
  piano(id: number): void;
}

const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode) => [...root.querySelectorAll<T>(sel)];

export class Catalogue {
  private cards: HTMLElement[];
  private years: HTMLElement[];
  private status: HTMLElement;
  private subject: string | null = null;
  private tag: string | null = null;
  private hot: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private events: CatalogueEvents,
  ) {
    this.cards = $$('[data-slug]', root);
    this.years = $$('[data-year]', root);
    this.status = root.querySelector('[data-status]')!;

    root.addEventListener('click', (e) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-subject], [data-tag], [data-clear], [data-more], [data-piano]');
      if (!el) return;
      if (el.dataset.subject !== undefined) this.set(el.dataset.subject === this.subject ? null : el.dataset.subject, this.tag);
      else if (el.dataset.tag !== undefined) this.set(this.subject, el.dataset.tag === this.tag ? null : el.dataset.tag);
      else if (el.dataset.clear !== undefined) this.set(null, null);
      else if (el.dataset.more !== undefined) this.toggleMore(el);
      else if (el.dataset.piano) this.events.piano(Number(el.dataset.piano));
    });

    for (const card of this.cards) {
      const slug = card.dataset.slug!;
      card.addEventListener('pointerenter', () => this.events.hot(slug));
      card.addEventListener('pointerleave', () => this.events.hot(null));
      card.addEventListener('focusin', () => this.events.hot(slug));
      card.addEventListener('focusout', () => this.events.hot(null));
    }
  }

  /** A book on the shelf is pointed at: light up its card and bring it into view. */
  markHot(slug: string | null) {
    this.hot?.classList.remove('is-hot');
    this.hot = slug ? (this.cards.find((c) => c.dataset.slug === slug) ?? null) : null;
    if (!this.hot) return;
    this.hot.classList.add('is-hot');
    if (!this.hot.hidden) this.hot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** Show which piece is playing on the music stand (null: silence). */
  setPlaying(id: number | null) {
    for (const btn of $$('[data-piano]', this.root)) {
      const on = Number(btn.dataset.piano) === id;
      btn.setAttribute('aria-pressed', String(on));
      btn.querySelector('[data-glyph]')!.textContent = on ? '■' : '▶';
    }
  }

  private set(subject: string | null, tag: string | null) {
    this.subject = subject;
    this.tag = tag;
    const matching = new Set<string>();
    for (const card of this.cards) {
      const ok = (!subject || card.dataset.subjectOf === subject) && (!tag || card.dataset.tags!.split('|').includes(tag));
      card.hidden = !ok;
      if (ok) matching.add(card.dataset.slug!);
    }
    for (const year of this.years) year.hidden = !$$('[data-slug]', year).some((c) => !c.hidden);

    for (const btn of $$('[data-subject]', this.root)) btn.setAttribute('aria-pressed', String(btn.dataset.subject === subject));
    for (const btn of $$('.tag-filters [data-tag]', this.root)) btn.setAttribute('aria-pressed', String(btn.dataset.tag === tag));
    // a tag picked from a card may be one of the hidden ones: open the drawer so it shows as picked
    const more = this.root.querySelector<HTMLElement>('[data-more]');
    if (tag && more && this.root.querySelector(`.tags-more [data-tag="${CSS.escape(tag)}"]`)) this.toggleMore(more, true);

    const filtered = Boolean(subject || tag);
    this.status.hidden = !filtered;
    if (filtered) {
      const what = [subject && this.labelOf(`[data-subject="${subject}"]`), tag && `tagged “${this.labelOf(`.tag-filters [data-tag="${CSS.escape(tag)}"]`)}”`]
        .filter(Boolean)
        .join(', ');
      const n = matching.size;
      this.status.querySelector('[data-status-text]')!.textContent = n
        ? `${n} ${n === 1 ? 'book' : 'books'}: ${what}`
        : `No books ${what} (yet).`;
    }
    this.events.filter(filtered ? matching : null);
  }

  private labelOf(sel: string) {
    return this.root.querySelector(sel)?.querySelector('[data-name]')?.textContent ?? '';
  }

  private toggleMore(btn: HTMLElement, open?: boolean) {
    const more = this.root.querySelector<HTMLElement>('.tags-more')!;
    more.hidden = open === undefined ? !more.hidden : !open;
    btn.setAttribute('aria-expanded', String(!more.hidden));
    btn.textContent = more.hidden ? btn.dataset.more! : 'fewer';
  }
}
