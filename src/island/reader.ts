/**
 * Reading comforts for the open book: a text size, a candlelit (dark) page, a ribbon that shows
 * how far you've read, the title in the toolbar once the real one scrolls away, and in-page
 * links (the contents) that scroll within the book instead of changing the URL.
 * The visitor's size and candle choices are remembered.
 */
const KEY = 'wingedsheep:reading';
const SIZES = [17, 18.5, 20, 21.5, 23];

interface Prefs {
  size: number; // index into SIZES
  candle: boolean;
}

export class Reader {
  private prefs: Prefs = { size: 2, candle: false };
  private ribbon: HTMLElement;
  private barTitle: HTMLElement;
  private body: HTMLElement;

  constructor(private book: HTMLElement) {
    this.ribbon = book.querySelector('[data-progress]')!;
    this.barTitle = book.querySelector('[data-bar-title]')!;
    this.body = book.querySelector('#article-body')!;
    try {
      Object.assign(this.prefs, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
    } catch {
      /* no storage: defaults it is */
    }
    this.apply();

    book.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLElement>('[data-read]');
      if (btn) {
        const what = btn.dataset.read;
        if (what === 'smaller') this.prefs.size = Math.max(0, this.prefs.size - 1);
        if (what === 'larger') this.prefs.size = Math.min(SIZES.length - 1, this.prefs.size + 1);
        if (what === 'candle') this.prefs.candle = !this.prefs.candle;
        this.apply();
        this.save();
        return;
      }
      const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link || !this.body.contains(link) || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = this.fragmentTarget(link.hash);
      if (!target) return;
      e.preventDefault();
      this.jumpTo(target, !matchMedia('(prefers-reduced-motion: reduce)').matches);
    });
    book.addEventListener('scroll', () => this.onScroll(), { passive: true });
  }

  /** A new post is on the page. */
  opened() {
    this.barTitle.textContent = this.body.querySelector('h1')?.textContent ?? '';
    const target = this.fragmentTarget(location.hash);
    if (target) this.jumpTo(target, false);
    this.onScroll();
  }

  private fragmentTarget(hash: string): HTMLElement | null {
    if (hash.length < 2) return null;
    try {
      return this.body.querySelector<HTMLElement>(`#${CSS.escape(decodeURIComponent(hash.slice(1)))}`);
    } catch {
      return null; // a malformed fragment should leave the book readable
    }
  }

  private jumpTo(target: HTMLElement, smooth: boolean) {
    // Use the actual toolbar height: its controls can wrap on narrow screens.
    const clearance = this.book.querySelector('.book-bar')!.getBoundingClientRect().height + 20;
    const top = target.getBoundingClientRect().top - this.book.getBoundingClientRect().top + this.book.scrollTop - clearance;
    this.book.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    // Continue keyboard reading at the destination instead of back in the contents.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  private onScroll() {
    const b = this.book;
    const max = b.scrollHeight - b.clientHeight;
    this.ribbon.style.transform = `scaleX(${max > 0 ? Math.min(1, b.scrollTop / max) : 0})`;
    const h1 = this.body.querySelector('h1');
    const past = h1 ? h1.getBoundingClientRect().bottom < b.getBoundingClientRect().top + 50 : false;
    b.classList.toggle('scrolled', past);
  }

  private apply() {
    this.book.style.setProperty('--read-size', `${SIZES[this.prefs.size]}px`);
    this.book.classList.toggle('candle', this.prefs.candle);
    this.book.querySelector('[data-read="candle"]')?.setAttribute('aria-pressed', String(this.prefs.candle));
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.prefs));
    } catch {
      /* private mode: the choice lasts for this visit */
    }
  }
}
