/** Buttons around the island (zoom, time of day, sound, journal) and small global delights. */
import { type IslandContext, SECRETS } from './content';
import { PHASES } from './scene/sky';

const on = (sel: string, fn: (el: HTMLElement) => void) =>
  document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));

export function bindHud(ctx: IslandContext) {
  on('[data-action="zoom-in"]', () => ctx.rig.zoom(0.75));
  on('[data-action="zoom-out"]', () => ctx.rig.zoom(1.33));
  on('[data-action="rotate-left"]', () => ctx.rig.rotate(-1));
  on('[data-action="rotate-right"]', () => ctx.rig.rotate(1));
  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'q') ctx.rig.rotate(-1);
    if (e.key === 'e') ctx.rig.rotate(1);
  });
  on('[data-action="journal"]', () => ctx.openPanel('journal'));
  on('[data-action="places"]', () => ctx.openPanel('places'));

  // time of day: cycles now → dawn → day → golden hour → dusk → night → now
  let phase = -1;
  on('[data-action="time"]', (el) => {
    phase = phase + 1 >= PHASES.length ? -1 : phase + 1;
    ctx.sky.setHour(phase < 0 ? null : PHASES[phase].hour);
    const label = phase < 0 ? 'now' : PHASES[phase].name;
    el.querySelector('[data-label]')!.textContent = label;
    el.setAttribute('aria-label', `Time of day: ${label}`);
  });

  on('[data-action="sound"]', (el) => {
    ctx.sound.setEnabled(!ctx.sound.enabled);
    el.setAttribute('aria-pressed', String(ctx.sound.enabled));
  });
  ctx.sound.onSongChange = (song) => {
    document.querySelectorAll<HTMLElement>('[data-action="sound"]').forEach((el) => el.setAttribute('aria-pressed', String(ctx.sound.enabled)));
    document.querySelectorAll<HTMLElement>('[data-song]').forEach((el) => {
      const playing = song?.id === Number(el.dataset.song);
      el.setAttribute('aria-pressed', String(playing));
    });
    ctx.life.playing = Boolean(song);
  };
  on('[data-song]', (el) => {
    const id = Number(el.dataset.song);
    if (ctx.sound.playing?.id === id) ctx.sound.stopSong();
    else {
      ctx.sound.playSong(id);
      ctx.discover('guitar');
    }
  });

  renderJournal(ctx);
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
