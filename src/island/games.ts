/**
 * The box of games by the keeper's telly: a cardboard box with a cartridge in it for each of his
 * games, labels facing out. Pick the controller up (or the telly's play) and it comes out; pick a
 * cartridge and that game opens in a new tab. The markup is in IslandShell.astro (#games).
 */
import type { IslandContext } from './content';
import { track } from './track';

const GAMES: Record<string, { href: string; found?: 'arnhem' }> = {
  arnhem: { href: 'https://racer.wingedsheep.com/', found: 'arnhem' },
  rustwing: { href: 'https://rustwing.wingedsheep.com/' },
};

export class GameBox {
  private root = document.querySelector<HTMLElement>('#games')!;
  private hint = this.root.querySelector<HTMLElement>('[data-games-hint]')!;
  private ctx: IslandContext | null = null;

  constructor() {
    // what's on the cartridge you're over, under the box
    const idle = this.hint.textContent;
    const about = (e: Event) => {
      const cart = (e.target as Element).closest<HTMLElement>('[data-game]');
      this.hint.textContent = cart ? `${cart.dataset.about} ↗` : idle;
    };
    this.root.addEventListener('pointerover', about);
    this.root.addEventListener('focusin', about);
    this.root.addEventListener('click', (e) => {
      const cart = (e.target as Element).closest<HTMLButtonElement>('[data-game]');
      if (!cart) {
        // a click beside the box puts it away
        if (!(e.target as Element).closest('.games-box')) this.close();
        return;
      }
      const game = GAMES[cart.dataset.game!];
      window.open(game.href, '_blank', 'noopener');
      track('game', { game: cart.dataset.game! });
      if (game.found) this.ctx?.discover(game.found);
      this.close();
    });
    // ahead of the island's own Escape (which would step back outside)
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || this.root.hidden) return;
        e.stopImmediatePropagation();
        this.close();
      },
      true,
    );
  }

  open(ctx: IslandContext) {
    this.ctx = ctx;
    this.root.hidden = false;
    this.root.querySelector<HTMLElement>('[data-game]')?.focus({ preventScroll: true });
  }

  close() {
    this.root.hidden = true;
  }
}
