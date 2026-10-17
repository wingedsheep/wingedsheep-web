/**
 * The postcard on the table, under a stone: the proof the table's card promises, that there are
 * infinitely many primes, in four lines (Euclid's, copied out). Its words are in the panel's
 * markup; this only opens it, turns it over to its picture (the flat itself, as it looked the
 * day it was written: public/commonplace/postcard.png), and puts it back.
 */
export class Postcard {
  private back: HTMLElement;
  private front: HTMLElement;
  private turnButton: HTMLButtonElement;

  constructor(
    private el: HTMLElement,
    private onClose: () => void,
  ) {
    this.back = el.querySelector<HTMLElement>('.postcard-back')!;
    this.front = el.querySelector<HTMLElement>('.postcard-front')!;
    this.turnButton = el.querySelector<HTMLButtonElement>('[data-postcard-turn]')!;
    this.turnButton.addEventListener('click', () => this.turn(!this.el.classList.contains('turned')));
    el.querySelector('[data-postcard-close]')!.addEventListener('click', () => this.onClose());
    // (Escape puts it back, rather than leaving the flat)
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

  /** Picked up writing side up, as it was lying. */
  show(open: boolean) {
    if (open === this.open) return;
    this.el.hidden = !open;
    if (!open) return;
    this.turn(false);
    this.turnButton.focus({ preventScroll: true });
  }

  private turn(toPicture: boolean) {
    this.front.hidden = !toPicture;
    this.back.hidden = toPicture;
    this.el.classList.toggle('turned', toPicture);
  }
}
