/** Buttons around the island (places, journal, sound), Q/E to turn, and small global delights. */
import { bindSketchbook } from './sketchbook';
import { type IslandContext, SECRETS } from './content';
import type { Level } from './sound';

/** A volume slider, wired to one of the sound's levels (the radio's, the Walkman's, the island's). */
export function level(input: HTMLInputElement | null | undefined, ctx: IslandContext, which: Level) {
  if (!input) return;
  input.value = String(Math.round(ctx.sound[which] * 100));
  input.addEventListener('input', () => ctx.sound.setLevel(which, Number(input.value) / 100));
}

const on = (sel: string, fn: (el: HTMLElement) => void) =>
  document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));

/** `turnable` says whether Q/E may turn the island now (not on the river, where they're paddle strokes). */
export function bindHud(ctx: IslandContext, turnable: () => boolean) {
  bindSketchbook();
  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea') || !turnable()) return;
    if (e.key === 'q') ctx.rig.rotate(-1);
    if (e.key === 'e') ctx.rig.rotate(1);
  });
  on('[data-action="journal"]', () => ctx.openPanel('journal'));
  on('[data-action="places"]', () => ctx.openPanel('places'));

  // the sound button opens a little menu: the island's volume, and sound on or off
  const menu = document.querySelector<HTMLElement>('[data-volume-menu]');
  const button = document.querySelector<HTMLElement>('[data-action="sound"]');
  const mute = menu?.querySelector<HTMLButtonElement>('[data-sound-toggle]');
  const showMute = () => {
    if (mute) mute.textContent = ctx.sound.enabled ? 'Sound off' : 'Sound on';
    button?.setAttribute('aria-pressed', String(ctx.sound.enabled));
  };
  const open = (show: boolean) => {
    if (!menu) return;
    menu.hidden = !show;
    button?.setAttribute('aria-expanded', String(show));
    showMute();
  };
  level(menu?.querySelector('[data-volume="island"]'), ctx, 'volume');
  button?.addEventListener('click', (e) => {
    e.stopPropagation();
    open(!!menu?.hidden);
  });
  mute?.addEventListener('click', () => {
    ctx.sound.setEnabled(!ctx.sound.enabled);
    showMute();
  });
  document.addEventListener('pointerdown', (e) => {
    if (menu && !menu.hidden && !(e.target as HTMLElement).closest('[data-volume-menu], [data-action="sound"]')) open(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu && !menu.hidden) open(false);
  });
  // sound's on but the browser holds it back until the first click or key: the button glows till then
  const waiting = () => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-action="sound"]')) {
      el.toggleAttribute('data-waiting', ctx.sound.waiting);
      el.title = ctx.sound.waiting ? 'Click anywhere to hear the island' : '';
    }
  };
  ctx.sound.onWaiting = waiting;
  waiting();

  renderJournal(ctx);
  // at Easter, a counter for the egg hunt, which asks Beike for a hint (scene/easter.ts)
  ctx.life.days.easter.mount((text) => ctx.toast(text), () => ctx.rig.target);
  konami(() => {
    ctx.life.releaseFlock();
    ctx.discover('flock');
  });
}

export function renderJournal(ctx: IslandContext) {
  for (const li of document.querySelectorAll<HTMLElement>('[data-secret]')) {
    const id = li.dataset.secret as keyof typeof SECRETS;
    const found = ctx.journal.has(id);
    li.classList.toggle('found', found);
    li.querySelector('[data-title]')!.textContent = found ? SECRETS[id].title : '???';
  }
  for (const el of document.querySelectorAll('[data-journal-count]')) {
    el.textContent = `${ctx.journal.count}/${ctx.journal.size}`;
  }
}

function konami(fn: () => void) {
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let i = 0;
  window.addEventListener('keydown', (e) => {
    i = e.key === code[i] ? i + 1 : e.key === code[0] ? 1 : 0;
    if (i === code.length) {
      i = 0;
      fn();
    }
  });
}
