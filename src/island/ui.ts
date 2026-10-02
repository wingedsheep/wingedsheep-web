/**
 * DOM side of the island: panels, the reading "book", tooltip, toasts and URL routing.
 * Panels are server-rendered by Astro; this only shows/hides them and swaps article content.
 */
import type { PanelName } from './content';
import { track } from './track';
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
  /** Whether the last press on a zoomed-in picture dragged it, rather than clicked it. */
  private dragged = false;
  private stowed = $('#stowed')!;
  private reader = new Reader(this.article);
  private current: Open = null;
  /** The panel a post was opened from; closing the post goes back there. */
  private returnTo: PanelName = 'library';
  private articleCache = new Map<string, Promise<string>>();

  /** Whether a book is open over the island. */
  get reading() {
    return this.current?.kind === 'article';
  }

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
    this.sketch.addEventListener('click', (e) => {
      if (this.dragged) return;
      if (this.sketch.classList.contains('zoomed')) this.sketch.classList.remove('zoomed');
      else if (this.sketch.classList.contains('zoomable') && e.target instanceof HTMLImageElement) this.zoomIn(e);
      else this.sketch.hidden = true;
    });
    this.panWithMouse();
    // a picture in one of a book's galleries is held up larger; a big one (data-zoom) can be looked into
    this.articleBody.addEventListener('click', (e) => {
      const img = (e.target as Element).closest<HTMLImageElement>('.gallery img, img[data-zoom]');
      if (!img) return;
      const caption = img.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
      this.showDrawing(img.currentSrc || img.src, caption || img.alt, true, img.dataset.zoom);
    });

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
    track('open_panel', { panel: name });
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
    track('open_article', { post: slug });
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

  toast(text: string, kind: 'note' | 'secret' = 'note', duration?: number) {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = text;
    this.toasts.append(el);
    // longer notes stay up long enough to read
    const stay = duration ?? Math.max(kind === 'secret' ? 4200 : 3400, text.length * 55);
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

  /** Hold up a drawing or painting over whatever is on screen; a click or Escape puts it down again.
   *  A photo is shown at up to its own size, smoothly, where a drawing is blown up in crisp pixels. */
  /**
   * Hold a picture up over everything. With `zoom` it can be looked into: a click zooms in on
   * that spot, to `zoom` CSS pixels wide (or the picture's own width when it's empty).
   */
  showDrawing(src: string, alt: string, photo = false, zoom?: string) {
    const img = $<HTMLImageElement>('img', this.sketch)!;
    this.sketch.classList.toggle('photo', photo);
    this.sketch.classList.toggle('zoomable', zoom !== undefined);
    this.sketch.classList.remove('zoomed');
    img.style.setProperty('--zoom', zoom || '');
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

  /** Zoom a held-up picture in on the clicked spot, keeping that spot under the pointer. */
  private zoomIn(e: MouseEvent) {
    const img = e.target as HTMLImageElement;
    const r = img.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    this.sketch.classList.add('zoomed');
    img.style.setProperty('--zoom', img.style.getPropertyValue('--zoom') || String(img.naturalWidth));
    this.sketch.scrollLeft = fx * img.offsetWidth - e.clientX;
    this.sketch.scrollTop = fy * img.offsetHeight - e.clientY;
  }

  /** Drag a zoomed-in picture around with the mouse (touch scrolls it natively). */
  private panWithMouse() {
    let last: { x: number; y: number } | null = null;
    this.sketch.addEventListener('pointerdown', (e) => {
      this.dragged = false;
      if (e.pointerType !== 'mouse' || !this.sketch.classList.contains('zoomed')) return;
      last = { x: e.clientX, y: e.clientY };
      this.sketch.setPointerCapture(e.pointerId);
    });
    this.sketch.addEventListener('pointermove', (e) => {
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.dragged = true;
      this.sketch.scrollLeft -= dx;
      this.sketch.scrollTop -= dy;
      last = { x: e.clientX, y: e.clientY };
    });
    const end = () => (last = null);
    this.sketch.addEventListener('pointerup', end);
    this.sketch.addEventListener('pointercancel', end);
  }

  private showArticle(slug: string) {
    this.hideAll();
    this.article.hidden = false;
    this.backdrop.hidden = false;
    this.article.removeAttribute('aria-busy');
    this.article.scrollTop = 0;
    this.current = { kind: 'article', slug };
    this.articleBack.textContent = `← back to the ${this.returnTo === 'library' ? 'shelves' : this.returnTo}`;
    this.events.panelOpened('article');
    $('h1', this.articleBody)?.focus({ preventScroll: true });
    this.reader.opened();
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
