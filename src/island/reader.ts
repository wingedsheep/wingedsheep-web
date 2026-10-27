/**
 * Reading comforts for the open book: a text size, a candlelit (dark) page, a ribbon that shows
 * how far you've read, the title in the toolbar once the real one scrolls away, and in-page
 * links (the contents) that scroll within the book instead of changing the URL. A long book gets
 * its chapters, beside the page when there's room and behind a button when there isn't, with the
 * one you're in marked and the time left to read; its code blocks get a copy button.
 * The visitor's size and candle choices are remembered.
 */
const KEY = 'wingedsheep:reading';
const SIZES = [17, 18.5, 20, 21.5, 23];
const WORDS_A_MINUTE = 230;
const MIN_CHAPTERS = 3;

interface Prefs {
  size: number; // index into SIZES
  candle: boolean;
}

export class Reader {
  private prefs: Prefs = { size: 2, candle: false };
  private ribbon: HTMLElement;
  private barTitle: HTMLElement;
  private barChapter: HTMLElement;
  private body: HTMLElement;
  private bar: HTMLElement;
  private nav: HTMLElement;
  private toggle: HTMLButtonElement;
  private chapters: { heading: HTMLElement; link: HTMLAnchorElement }[] = [];
  private current = -1;
  private words = 0;
  private stopAiming = () => {};

  constructor(private book: HTMLElement) {
    this.ribbon = book.querySelector('[data-progress]')!;
    this.barTitle = book.querySelector('[data-bar-title]')!;
    this.barChapter = book.querySelector('[data-bar-chapter]')!;
    this.body = book.querySelector('#article-body')!;
    this.bar = book.querySelector('.book-bar')!;
    this.nav = book.querySelector('.book-chapters')!;
    this.toggle = book.querySelector('[data-read="chapters"]')!;
    // a phone held at arm's length reads better a step smaller, until the visitor picks a size
    if (matchMedia('(max-width: 600px)').matches) this.prefs.size = 1;
    try {
      Object.assign(this.prefs, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
    } catch {
      /* no storage: defaults it is */
    }
    this.apply();
    // the rail and the menu hang just under the toolbar, whose height changes as its controls wrap
    new ResizeObserver(() => book.style.setProperty('--bar-h', `${this.bar.offsetHeight}px`)).observe(this.bar);

    book.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLElement>('[data-read]');
      if (btn) {
        const what = btn.dataset.read;
        if (what === 'chapters') return this.showChapters(!book.classList.contains('chapters-open'));
        if (what === 'copy') return this.copy(btn);
        if (what === 'smaller') this.prefs.size = Math.max(0, this.prefs.size - 1);
        if (what === 'larger') this.prefs.size = Math.min(SIZES.length - 1, this.prefs.size + 1);
        if (what === 'candle') this.prefs.candle = !this.prefs.candle;
        this.apply();
        this.save();
        return;
      }
      const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link || !book.contains(link) || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = this.fragmentTarget(link.hash);
      if (!target) return;
      e.preventDefault();
      this.showChapters(false);
      this.jumpTo(target, !matchMedia('(prefers-reduced-motion: reduce)').matches);
    });
    book.addEventListener('scroll', () => this.onScroll(), { passive: true });
    // the chapters menu goes away with Escape, before Escape closes the book itself
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || !book.classList.contains('chapters-open')) return;
        e.stopImmediatePropagation();
        this.showChapters(false);
        this.toggle.focus();
      },
      true,
    );
    document.addEventListener('pointerdown', (e) => {
      const t = e.target as Node;
      if (book.classList.contains('chapters-open') && !this.nav.contains(t) && !this.toggle.contains(t)) this.showChapters(false);
    });
  }

  /** A new post is on the page. */
  opened() {
    this.stopAiming();
    this.barTitle.textContent = this.body.querySelector('h1')?.textContent ?? '';
    this.showChapters(false);
    this.listChapters();
    this.addCopyButtons();
    const target = this.fragmentTarget(location.hash);
    if (target) this.jumpTo(target, false);
    this.onScroll();
  }

  private listChapters() {
    const prose = this.body.querySelector('.prose');
    const headings = prose ? [...prose.querySelectorAll<HTMLElement>(':scope > h2[id]')] : [];
    this.words = prose?.textContent?.split(/\s+/).length ?? 0;
    const list = this.nav.querySelector('[data-chapters]')!;
    list.replaceChildren();
    this.chapters = [];
    this.current = -1;
    const enough = headings.length >= MIN_CHAPTERS;
    this.nav.hidden = !enough;
    this.toggle.hidden = !enough;
    this.book.classList.toggle('has-chapters', enough);
    if (!enough) return;
    const top = this.body.querySelector<HTMLElement>('h1');
    if (top && !top.id) top.id = 'title-page';
    for (const [i, heading] of [top, ...headings].entries()) {
      if (!heading) continue;
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = i === 0 ? 'Title page' : (heading.textContent ?? '').trim();
      if (i === 0) li.className = 'book-chapters-top';
      li.append(link);
      list.append(li);
      this.chapters.push({ heading, link });
    }
  }

  private showChapters(open: boolean) {
    this.book.classList.toggle('chapters-open', open);
    this.toggle.setAttribute('aria-expanded', String(open));
    if (open) this.keepInSight(this.chapters[this.current]?.link);
  }

  /** Scroll the chapter list (only the list, never the book) so a chapter's link shows. */
  private keepInSight(link?: HTMLElement) {
    const box = this.nav.querySelector<HTMLElement>('.book-chapters-box')!;
    if (!link || !box.clientHeight) return;
    const top = link.offsetTop;
    if (top < box.scrollTop + 8) box.scrollTop = top - 8;
    else if (top + link.offsetHeight > box.scrollTop + box.clientHeight - 40) box.scrollTop = top + link.offsetHeight - box.clientHeight + 40;
  }

  private addCopyButtons() {
    for (const pre of this.body.querySelectorAll<HTMLElement>('.prose pre')) {
      if (pre.parentElement?.classList.contains('code-block')) continue;
      const wrap = document.createElement('div');
      wrap.className = 'code-block';
      pre.replaceWith(wrap);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.read = 'copy';
      btn.textContent = 'copy';
      btn.setAttribute('aria-label', 'Copy this code');
      wrap.append(pre, btn);
    }
  }

  private async copy(btn: HTMLElement) {
    const code = btn.parentElement?.querySelector('pre')?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(code.replace(/\n$/, ''));
      btn.textContent = 'copied';
    } catch {
      btn.textContent = 'select it';
    }
    setTimeout(() => (btn.textContent = 'copy'), 1600);
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
    this.stopAiming();
    const aim = () => {
      if (!this.body.contains(target)) return this.stopAiming(); // another post came in
      // Use the actual toolbar height: its controls can wrap on narrow screens.
      const clearance = this.book.querySelector('.book-bar')!.getBoundingClientRect().height + 20;
      const top = target.getBoundingClientRect().top - this.book.getBoundingClientRect().top + this.book.scrollTop - clearance;
      this.book.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    };
    aim();
    // Things on the way can still change size as the book scrolls past them (a picture loading
    // lazily, a late font, an embed): keep aiming at the heading until the scroll has settled,
    // unless the reader takes over.
    let first = true;
    const watch = new ResizeObserver(() => (first ? (first = false) : aim()));
    watch.observe(this.body);
    const stop = () => this.stopAiming();
    let still = 0;
    const moving = () => {
      clearTimeout(still);
      still = window.setTimeout(stop, 1000);
    };
    moving();
    const cap = setTimeout(stop, 6000);
    const takeOver = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    for (const t of takeOver) this.book.addEventListener(t, stop, { passive: true });
    this.book.addEventListener('scroll', moving, { passive: true });
    this.stopAiming = () => {
      watch.disconnect();
      clearTimeout(still);
      clearTimeout(cap);
      for (const t of takeOver) this.book.removeEventListener(t, stop);
      this.book.removeEventListener('scroll', moving);
      this.stopAiming = () => {};
    };
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
    if (!this.chapters.length) return;

    // the chapter you're in: the last one whose heading has gone up past the toolbar
    const line = b.getBoundingClientRect().top + this.bar.offsetHeight + 90;
    let current = 0;
    for (const [i, { heading }] of this.chapters.entries()) if (heading.getBoundingClientRect().top < line) current = i;
    if (max > 0 && b.scrollTop >= max - 2) current = this.chapters.length - 1; // a short last chapter never reaches the line
    if (current !== this.current) {
      this.chapters[this.current]?.link.removeAttribute('aria-current');
      this.current = current;
      const { link } = this.chapters[current];
      link.setAttribute('aria-current', 'true');
      this.barChapter.textContent = current > 0 ? link.textContent : '';
      this.keepInSight(link);
    }
    const minutes = Math.ceil((this.words / WORDS_A_MINUTE) * (1 - (max > 0 ? b.scrollTop / max : 0)));
    this.nav.querySelector('[data-left]')!.textContent = minutes > 1 ? `about ${minutes} minutes left` : minutes === 1 ? 'a minute left' : 'the end';
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
