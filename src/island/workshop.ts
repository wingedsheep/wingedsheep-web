/**
 * Stepping into the workshop: the island dithers shut and the room inside dithers open, with
 * every project set out on the floor. There's no side panel: a wooden sign hangs over each
 * exhibit, and picking one unfolds its card right there while the robot trundles over to show
 * it off.
 */
import * as THREE from 'three';
import { type IslandContext, labelFor, toggleRecord, workshopPlaceFor } from './content';
import type { RoomInput } from './scene/camera-rig';
import type { PixelRenderer } from './scene/pixel-renderer';
import { WorkshopRoom } from './scene/workshop-room';
import type { UI } from './ui';

const FADE = 0.35; // seconds for the iris to close (and again to open)
const NO_SHIFT = new THREE.Vector2();
const narrow = () => innerWidth <= 760;

interface Sign {
  id: string;
  li: HTMLElement;
  sign: HTMLButtonElement;
  card: HTMLElement;
  at: { x: number; y: number };
}

export class Workshop implements RoomInput {
  /** Whether the room (rather than the island) is on screen. */
  inside = false;
  private want = false;
  private fade = 0;
  private room?: WorkshopRoom;
  private loading?: Promise<WorkshopRoom | undefined>;
  private el = document.querySelector<HTMLElement>('[data-panel="workshop"]')!;
  private signs: Sign[] = [];
  private selected: Sign | null = null;

  constructor(
    private ctx: IslandContext,
    private ui: UI,
    private pixels: PixelRenderer,
    private host: HTMLElement,
    private reducedMotion: boolean,
  ) {
    this.el.querySelectorAll<HTMLElement>('[data-exhibit]').forEach((li, i) => {
      const s: Sign = {
        id: li.dataset.exhibit!,
        li,
        sign: li.querySelector('.exhibit-sign')!,
        card: li.querySelector('.exhibit-card')!,
        at: { x: 0, y: 0 },
      };
      s.sign.style.setProperty('--delay', `${0.3 + i * 0.05}s`);
      s.sign.addEventListener('click', () => this.select(this.selected === s ? null : s.id));
      s.sign.addEventListener('pointerenter', () => this.light(`project_${s.id}`));
      s.sign.addEventListener('pointerleave', () => this.light(null));
      this.signs.push(s);
    });
    for (const b of this.el.querySelectorAll('[data-deselect]')) b.addEventListener('click', () => this.select(null));
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-step]')) b.addEventListener('click', () => this.step(Number(b.dataset.step)));

    // inside, Escape folds the card away first (and only then leaves); arrows walk the room
    window.addEventListener('keydown', (e) => {
      if (!this.inside || !this.want || (e.target as HTMLElement).closest('input, textarea') || this.el.hidden) return;
      if (e.key === 'Escape' && this.selected) {
        e.stopImmediatePropagation();
        this.select(null);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.step(e.key === 'ArrowRight' ? 1 : -1);
      }
    }, true);

    // the gramophone's card has a record player; it follows whatever the gramophone is doing
    const player = this.el.querySelector<HTMLElement>('[data-player]');
    if (player) {
      const btn = player.querySelector<HTMLButtonElement>('[data-record]')!;
      const now = player.querySelector<HTMLElement>('[data-now]')!;
      const idle = now.textContent;
      btn.addEventListener('click', () => toggleRecord(ctx));
      ctx.sound.onRecord = (disc) => {
        btn.setAttribute('aria-pressed', String(Boolean(disc)));
        btn.querySelector('[data-glyph]')!.textContent = disc ? '■' : '▶';
        btn.querySelector('[data-record-label]')!.textContent = disc ? 'Lift the needle' : 'Put a record on';
        now.textContent = disc ? `Now playing: ${disc.title}` : idle;
      };
    }
  }

  /** The next (or previous) exhibit along, wrapping round the room. */
  private step(by: number) {
    const i = this.selected ? this.signs.indexOf(this.selected) : by > 0 ? -1 : 0;
    const next = this.signs[(i + by + this.signs.length) % this.signs.length];
    this.select(next.id);
  }

  /** Whether the pointer should drive the room rather than the island. */
  get wanted() {
    return this.want;
  }

  /** Fetch the room ahead of time, so the door opens without a wait. */
  load() {
    this.loading ??= WorkshopRoom.load()
      .then((room) => {
        this.room = room;
        this.ctx.workshop = room;
        this.resize();
        return room;
      })
      .catch((err) => {
        console.error(err);
        return undefined;
      });
    return this.loading;
  }

  /** Go in (or out). `instant` skips the iris closing, e.g. coming straight from another room. */
  enter(inside: boolean, instant = false) {
    if (inside) void this.load();
    if (!inside && this.want) this.select(null);
    this.want = inside;
    if (instant) this.fade = inside === this.inside ? 0 : 1;
    this.ui.tooltip(null);
  }

  /** Unfold one project's card (null folds it away again); the robot goes to show it. */
  select(id: string | null) {
    const next = this.signs.find((s) => s.id === id) ?? null;
    if (this.selected && this.selected !== next) {
      this.selected.card.hidden = true;
      this.selected.sign.setAttribute('aria-expanded', 'false');
    }
    this.selected = next;
    this.el.classList.toggle('picking', Boolean(next));
    if (!next) return this.room?.robot.dismiss();
    next.card.hidden = false;
    next.sign.setAttribute('aria-expanded', 'true');
    this.place(next);
    next.card.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
    this.room?.robot.present(next.id);
  }

  resize() {
    const room = this.room;
    if (!room) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    room.frame(w, h, this.freeArea(w, h));
    this.pinSigns();
  }

  /** Pinch, scroll or drag: look closer at the exhibits. */
  zoom(factor: number, ndc: THREE.Vector2) {
    this.room?.view.zoomBy(factor, ndc);
    this.pinSigns();
  }

  pan(dxPx: number, dyPx: number) {
    this.room?.view.pan(dxPx, dyPx);
    this.pinSigns();
  }

  private pinSigns() {
    const room = this.room;
    if (!room) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    // pin each sign over its exhibit; one that would cover another is lifted clear of it
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    const shown = this.signs.filter((s) => (s.li.hidden = !room.anchors.has(s.id)) === false);
    for (const s of shown) s.at = room.project(room.anchors.get(s.id)!, w, h);
    for (const s of [...shown].sort((a, b) => b.at.y - a.at.y)) {
      const half = s.sign.offsetWidth / 2 + 4;
      const tall = s.sign.offsetHeight + 4;
      let y = s.at.y;
      for (let tries = 0; tries < 6; tries++) {
        const hit = placed.find((p) => s.at.x - half < p.r && s.at.x + half > p.l && y - tall < p.b && y > p.t);
        if (!hit) break;
        y = hit.t - 2;
      }
      placed.push({ l: s.at.x - half, r: s.at.x + half, t: y - tall, b: y });
      s.at = { x: s.at.x, y };
      s.li.style.left = `${Math.round(s.at.x)}px`;
      s.li.style.top = `${Math.round(y)}px`;
      // the post reaches from the sign down to just above the exhibit
      const top = room.project(room.anchors.get(s.id)!.clone().setY(room.anchors.get(s.id)!.y - 0.6), w, h).y;
      s.li.style.setProperty('--post', `${Math.max(8, Math.round(top - y))}px`);
    }
    if (this.selected) this.place(this.selected);
  }

  hover(ndc: THREE.Vector2 | null, client: { x: number; y: number }) {
    if (!this.room || !this.inside) return;
    const hit = ndc && this.room.picker.pick(ndc);
    const place = hit ? workshopPlaceFor(hit.id) : undefined;
    this.light(place && hit ? hit.id : null);
    this.host.querySelector('canvas')!.style.cursor = place ? 'pointer' : '';
    this.ui.tooltip(place ? labelFor(place, this.ctx) : null, client.x, client.y);
  }

  click(ndc: THREE.Vector2) {
    if (!this.room || !this.inside) return;
    const hit = this.room.picker.pick(ndc);
    const place = hit ? workshopPlaceFor(hit.id) : undefined;
    if (!hit || !place) return this.select(null);
    this.ui.tooltip(null);
    place.activate?.(this.ctx, hit.point);
  }

  /** Run the iris and, once inside, the room. `night` is 0 (day) … 1 (night) outside. */
  update(dt: number, night: number) {
    const step = this.reducedMotion ? 1 : dt / FADE;
    if (this.want !== this.inside) {
      this.fade = Math.min(1, this.fade + step);
      // wait behind the closed iris until the room has loaded
      if (this.fade >= 1 && (!this.want || this.room)) this.swap();
    } else {
      this.fade = Math.max(0, this.fade - step);
    }
    this.pixels.uniforms.uFade.value = this.fade;
    this.el.classList.toggle('dim', !this.inside || this.fade > 0.3);
    // with reduced motion the room holds still (the robot stays on its charger)
    if (this.inside && this.room) {
      this.room.playing = this.ctx.sound.recordPlaying !== null;
      this.room.update(this.reducedMotion ? 0 : dt, night);
    }
  }

  render() {
    const u = this.pixels.uniforms;
    u.uGrade.value.set(1.06, 1.03, 0.98); // indoors, whatever the weather is doing outside
    u.uTone.value = u.uVignette.value = 0; // the island's light stays outside
    u.uHeat.value = 0;
    this.pixels.render(this.room!.scene, this.room!.camera, NO_SHIFT);
  }

  private swap() {
    this.inside = this.want;
    this.ctx.sound.indoors = this.inside;
    if (this.inside) {
      this.ctx.rig.room = this;
      this.room?.view.reset();
      this.resize();
    } else {
      if (this.ctx.rig.room === this) this.ctx.rig.room = null;
      this.ctx.sound.stopRecord();
      this.light(null);
    }
  }

  private light(id: string | null) {
    const room = this.room;
    room?.picker.highlight(id ? (room.named.get(id) ?? null) : null);
  }

  /**
   * Keep a card on screen and off its exhibit: above the sign if there's room, otherwise beside
   * the exhibit, on whichever side has more space.
   */
  private place(s: Sign) {
    if (narrow()) return; // on phones the card is a sheet along the bottom
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const card = s.card;
    const above = s.at.y > card.offsetHeight + 110;
    card.classList.toggle('beside', !above);
    card.classList.toggle('to-left', !above && s.at.x > w / 2);
    if (above) {
      const half = Math.min(320, w - 24) / 2;
      card.style.setProperty('--shift', `${Math.round(THREE.MathUtils.clamp(s.at.x, half + 12, w - half - 12) - s.at.x)}px`);
      card.style.setProperty('--drop', '0px');
    } else {
      // level with the sign, nudged down if it would run off the bottom
      const drop = Math.min(0, h - 16 - (s.at.y - 20 + card.offsetHeight));
      card.style.setProperty('--drop', `${Math.round(drop)}px`);
    }
  }

  /** The canvas below the banner: the room gets the whole width. */
  private freeArea(w: number, h: number) {
    if (w > 760) return { x: 16, y: 84, w: w - 32, h: h - 110 };
    return { x: 8, y: 100, w: w - 16, h: h - 170 };
  }
}
