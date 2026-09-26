/**
 * DOM side of the island: panels, the reading "book", tooltip, toasts and URL routing.
 * Panels are server-rendered by Astro; this only shows/hides them and swaps article content.
 */
import type { PanelName } from './content';
import { Reader } from './reader';

type Open = { kind: 'panel'; name: PanelName } | { kind: 'article'; slug: string } | null;

export interface UIEvents {
  /** a panel opened (the island may want to glide the camera there) */
  panelOpened(name: PanelName | 'article', sub?: string): void;
  /** everything closed: back to the open island */
  closed(): void;
}

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

export class UI {
  private tip = $('#tip')!;
  private toasts = $('#toasts')!;
  private backdrop = $('#backdrop')!;
  private article = $('#article')!;
  private articleBody = $('#article-body')!;
  private articleBack = $('.book-back')!;
  private sketch = $('#sketch')!;
  private stowed = $('#stowed')!;
  private reader = new Reader(this.article);
  private current: Open = null;
  /** The panel a post was opened from; closing the post goes back there. */
  private returnTo: PanelName = 'library';
  private articleCache = new Map<string, Promise<string>>();

  constructor(private events: UIEvents) {
    for (const btn of $$('[data-close]')) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.back();
      });
    }
    $('[data-unstow]', this.stowed)!.addEventListener('click', () => this.openPanel('library'));
    this.backdrop.addEventListener('click', () => this.back());
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!this.sketch.hidden) this.sketch.hidden = true;
      else this.back();
    });
    this.sketch.addEventListener('click', () => (this.sketch.hidden = true));

    // books in the library open in place, without a page load
    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-book]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      void this.openArticle(a.dataset.book!);
    });
    document.addEventListener('pointerover', (e) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-book]');
      if (a) this.fetchArticle(a.dataset.book!); // warm the cache
    });
    window.addEventListener('popstate', () => this.route(false));
  }

  /** Restore state from the URL (initial load and back/forward). */
  route(initial: boolean) {
    const path = location.pathname.replace(/\/+$/, '/');
    const m = path.match(/^\/blog\/([^/]+)\/$/);
    if (m) {
      if (initial) this.showArticle(m[1]); // content is already server-rendered
      else void this.openArticle(m[1], false);
    } else if (path === '/blog/') {
      this.openPanel('library', false);
    } else if (location.hash.length > 1) {
      // #trail/student: a panel, and somewhere inside it
      const [name, sub] = location.hash.slice(1).split('/');
      this.openPanel(name as PanelName, false, sub);
    } else {
      this.close(false);
    }
  }

  openPanel(name: PanelName, push = true, sub?: string) {
    const el = $(`[data-panel="${name}"]`);
    if (!el) return;
    const same = this.current?.kind === 'panel' && this.current.name === name;
    if (same && this.stowed.hidden) return;
    if (same) push = false; // only fetching the catalogue back out: still the same page
    this.hideAll();
    el.hidden = false;
    el.scrollTop = 0;
    this.current = { kind: 'panel', name };
    if (name === 'library') document.title = 'The library · wingedsheep';
    else if (name === 'workshop') document.title = 'The workshop · wingedsheep';
    else if (name === 'lighthouse') document.title = 'The lighthouse · wingedsheep';
    else if (name === 'hut') document.title = 'The mountain hut · wingedsheep';
    else if (name === 'trail') document.title = 'The mountain trail · wingedsheep';
    else if (name === 'river') document.title = 'Wild water · wingedsheep';
    if (push) history.pushState(null, '', name === 'library' ? '/blog/' : `/#${name}`);
    this.events.panelOpened(name, sub);
    ($('[data-autofocus]', el) ?? $('h2', el))?.focus({ preventScroll: true });
  }

  async openArticle(slug: string, push = true) {
    if (this.current?.kind === 'panel') this.returnTo = this.current.name;
    if (push) history.pushState(null, '', `/blog/${slug}/`);
    this.hideAll();
    this.article.hidden = false;
    this.backdrop.hidden = false;
    this.article.setAttribute('aria-busy', 'true');
    this.articleBody.innerHTML = '<p class="loading">Taking the book from the shelf…</p>';
    try {
      this.articleBody.innerHTML = await this.fetchArticle(slug);
      runScripts(this.articleBody); // some posts carry small interactive embeds
      const title = $('h1', this.articleBody)?.textContent;
      if (title) document.title = `${title} · wingedsheep`;
    } catch {
      location.href = `/blog/${slug}/`; // fall back to a normal page load
      return;
    }
    this.showArticle(slug);
  }

  /**
   * Step back one level: from a post to the shelf it came from, from a panel out to the island.
   * The library's catalogue is put away first, so you can stay in the room without it.
   */
  back() {
    if (this.current?.kind === 'article') this.openPanel(this.returnTo);
    else if (this.current?.kind === 'panel' && this.current.name === 'library' && this.stowed.hidden) this.stow();
    else this.close();
  }

  /** Put the library's catalogue away, staying in the room; the door (or Escape) still leads out. */
  private stow() {
    $('[data-panel="library"]')!.hidden = true;
    this.stowed.hidden = false;
    $<HTMLElement>('[data-unstow]', this.stowed)!.focus({ preventScroll: true });
  }

  close(push = true) {
    if (!this.current) return;
    this.hideAll();
    this.current = null;
    document.title = document.body.dataset.title ?? document.title;
    if (push) history.pushState(null, '', '/');
    this.events.closed();
  }

  /** Follows the pointer; pass null to hide. */
  tooltip(text: string | null, x = 0, y = 0) {
    if (!text) {
      this.tip.hidden = true;
      return;
    }
    this.tip.hidden = false;
    this.tip.textContent = text;
    this.tip.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 12)}px)`;
  }

  toast(text: string, kind: 'note' | 'secret' = 'note') {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = text;
    this.toasts.append(el);
    // longer notes stay up long enough to read
    const stay = Math.max(kind === 'secret' ? 4200 : 3400, text.length * 55);
    setTimeout(() => el.classList.add('out'), stay);
    setTimeout(() => el.remove(), stay + 600);
  }

  /** A toast with buttons. It waits a while for an answer, then quietly goes away. */
  ask(text: string, choices: { label: string; pick?(): void }[]) {
    const el = document.createElement('div');
    el.className = 'toast toast-ask';
    const p = document.createElement('p');
    p.textContent = text;
    const row = document.createElement('div');
    row.className = 'toast-choices';
    const dismiss = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 600);
    };
    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = choice.label;
      btn.addEventListener('click', () => {
        dismiss();
        choice.pick?.();
      });
      row.append(btn);
    }
    el.append(p, row);
    this.toasts.append(el);
    setTimeout(dismiss, 12000);
  }

  /** Hold up a drawing or painting over whatever is on screen; a click or Escape puts it down again. */
  showDrawing(src: string, alt: string) {
    const img = $<HTMLImageElement>('img', this.sketch)!;
    img.src = src;
    img.alt = alt;
    this.sketch.setAttribute('aria-label', alt);
    this.tooltip(null);
    // size it to the picture once it's in, so it doesn't jump
    void img.decode().catch(() => {}).then(() => {
      img.style.setProperty('--w', String(img.naturalWidth || 1));
      img.style.setProperty('--h', String(img.naturalHeight || 1));
      this.sketch.hidden = false;
    });
  }

  private showArticle(slug: string) {
    this.hideAll();
    this.article.hidden = false;
    this.backdrop.hidden = false;
    this.article.removeAttribute('aria-busy');
    this.article.scrollTop = 0;
    this.current = { kind: 'article', slug };
    this.articleBack.textContent = `← back to the ${this.returnTo === 'library' ? 'shelves' : this.returnTo}`;
    this.reader.opened();
    this.events.panelOpened('article');
    $('h1', this.articleBody)?.focus({ preventScroll: true });
  }

  private hideAll() {
    for (const p of $$('[data-panel]')) p.hidden = true;
    this.stowed.hidden = true;
    this.article.hidden = true;
    this.backdrop.hidden = true;
  }

  private fetchArticle(slug: string): Promise<string> {
    let p = this.articleCache.get(slug);
    if (!p) {
      p = fetch(`/blog/${slug}/`)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((html) => new DOMParser().parseFromString(html, 'text/html').querySelector('#article-body')!.innerHTML);
      p.catch(() => this.articleCache.delete(slug));
      this.articleCache.set(slug, p);
    }
    return p;
  }
}

/** innerHTML never runs <script> tags; re-create them so they execute. */
function runScripts(root: HTMLElement) {
  for (const old of root.querySelectorAll('script')) {
    const s = document.createElement('script');
    for (const a of old.attributes) s.setAttribute(a.name, a.value);
    s.textContent = old.textContent;
    old.replaceWith(s);
  }
}
