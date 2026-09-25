/**
 * Paddling with whatever's to hand, the way your hands would on a real paddle.
 *
 *            forward strokes     reverse sweep (tap) /        lean (side, and     brace
 *            left / right        blade planted (hold)         fore and aft)
 * keyboard   A / D  (↑: both)    Q / E                        ← → and W S         Space
 * pad        L2 / R2             L1 / R1                      left stick          ✕ / A
 * touch      hold the left or right half of the screen to paddle on that side (both thumbs:
 *            straight on); low down, a reverse sweep (tap) or a planted blade (hold). On a touch
 *            screen the paddler leans for himself.
 *
 * Both sides held, Vincent strokes left, right, left: straight on. One side only, he sweeps on
 * that side and you turn away from it. A reverse sweep brakes and swings you towards its side,
 * whatever the current; a blade left planted after it is a rudder, and only bites as hard as
 * you're moving through the water. A bumper on the side you're falling to is a brace.
 */
export type Device = 'keys' | 'pad' | 'touch';

export interface Intent {
  /** 0..1: forward strokes on the left and the right (held). */
  left: number;
  right: number;
  /** Reverse sweep / planted blade on the left and the right: held, and pressed this frame. */
  backLeft: boolean;
  backRight: boolean;
  tapLeft: boolean;
  tapRight: boolean;
  /** -1 (lean left) … 1 (lean right). */
  lean: number;
  /** -1 (lean back) … 1 (lean forward). */
  pitch: number;
  /** Brace on whichever side you're falling to (Space, ✕). */
  brace: boolean;
}

export const NEUTRAL: Intent = {
  left: 0, right: 0, backLeft: false, backRight: false, tapLeft: false, tapRight: false, lean: 0, pitch: 0, brace: false,
};

const DEAD = 0.18;
const BACK_BAND = 0.78; // below this far down the screen, a finger is a reverse sweep

export class Controls {
  /** What was used last, for the hints on screen. */
  device: Device = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keys';
  /** Called once per press of "go" (Enter, ✕/A): start, or go again. */
  onGo?: () => void;
  /** Called once per press of pause (P, Start/Options). */
  onPause?: () => void;
  private keys = new Set<string>();
  private taps = { left: false, right: false, brace: false };
  private fingers = new Map<number, { side: -1 | 1; back: boolean }>();
  /** (Everything starts out held: a button only counts once it's been seen let go.) */
  private padWas = { go: true, pause: true, l1: true, r1: true };
  /** A stick only counts once it's been seen at rest: a pad lying on a stick, or one that drifts, can't lean. */
  private centred = [false, false, false, false];
  /** …and the same for the triggers (L2, R2): one held down all along (the pad face down on the desk) can't paddle. */
  private released = [false, false];
  private active = false;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.active || (e.target as HTMLElement).closest('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'w', 'a', 's', 'd', 'q', 'e'].includes(k)) e.preventDefault();
      this.device = 'keys';
      if (e.repeat) return;
      if (k === 'enter') this.onGo?.();
      if (k === ' ' || k === 'shift') this.taps.brace = true;
      if (k === 'q') this.taps.left = true;
      if (k === 'e') this.taps.right = true;
      if (k === 'p') this.onPause?.();
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      if (e.pointerType !== 'mouse') this.device = 'touch';
      const r = el.getBoundingClientRect();
      const side = e.clientX < r.left + r.width / 2 ? -1 : 1;
      const back = e.clientY > r.top + r.height * BACK_BAND;
      this.fingers.set(e.pointerId, { side, back });
      if (back) this.taps[side < 0 ? 'left' : 'right'] = true;
    });
    const up = (e: PointerEvent) => this.fingers.delete(e.pointerId);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** Listen (or stop listening) for the game. */
  enable(on: boolean) {
    this.active = on;
    this.taps = { left: false, right: false, brace: false };
    this.padWas = { go: true, pause: true, l1: true, r1: true };
    if (!on) {
      this.keys.clear();
      this.fingers.clear();
    }
  }

  /** On a touch screen the paddler balances himself: you do the paddling. */
  get assisted() {
    return this.device === 'touch';
  }

  /** Read everything for this frame. */
  read(): Intent {
    const taps = this.taps;
    this.taps = { left: false, right: false, brace: false };
    if (!this.active) return NEUTRAL;
    const k = this.keys;
    const both = k.has('arrowup') ? 1 : 0;
    const i: Intent = {
      left: Math.max(both, k.has('a') ? 1 : 0),
      right: Math.max(both, k.has('d') ? 1 : 0),
      backLeft: k.has('q'),
      backRight: k.has('e'),
      tapLeft: taps.left,
      tapRight: taps.right,
      lean: (k.has('arrowright') ? 1 : 0) - (k.has('arrowleft') ? 1 : 0),
      pitch: (k.has('w') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0),
      brace: taps.brace,
    };
    for (const f of this.fingers.values()) {
      if (f.back) {
        if (f.side < 0) i.backLeft = true;
        else i.backRight = true;
      } else if (f.side < 0) i.left = 1;
      else i.right = 1;
    }

    const pad = this.pad();
    if (pad) {
      const axis = (n: number) => {
        const v = pad.axes[n] ?? 0;
        if (Math.abs(v) < DEAD * 0.5) this.centred[n] = true;
        return this.centred[n] && Math.abs(v) > DEAD ? (v - Math.sign(v) * DEAD) / (1 - DEAD) : 0;
      };
      const b = (n: number) => pad.buttons[n]?.value ?? 0;
      // the body: either stick (left by default), sideways to lean and edge, up and down for fore and aft
      const [lx, ly, rx, ry] = [axis(0), axis(1), axis(2), axis(3)];
      const lean = Math.abs(lx) >= Math.abs(rx) ? lx : rx;
      const pitch = -(Math.abs(ly) >= Math.abs(ry) ? ly : ry);
      const l1 = b(4) > 0.5;
      const r1 = b(5) > 0.5;
      const go = !!pad.buttons[0]?.pressed;
      const pause = !!(pad.buttons[9]?.pressed || pad.buttons[8]?.pressed);
      const trigger = (n: 0 | 1) => {
        const v = b(6 + n);
        if (v < 0.05) this.released[n] = true;
        return this.released[n] && v > 0.12 ? v : 0;
      };
      const l2 = trigger(0);
      const r2 = trigger(1);
      if (Math.abs(lean) > 0.3 || Math.abs(pitch) > 0.3 || l2 > 0.3 || r2 > 0.3 || l1 || r1 || go) this.device = 'pad';
      i.left = Math.max(i.left, l2);
      i.right = Math.max(i.right, r2);
      i.backLeft ||= l1;
      i.backRight ||= r1;
      const was = this.padWas;
      i.tapLeft ||= l1 && !was.l1;
      i.tapRight ||= r1 && !was.r1;
      if (Math.abs(lean) > Math.abs(i.lean)) i.lean = lean;
      if (Math.abs(pitch) > Math.abs(i.pitch)) i.pitch = pitch;
      if (go && !was.go) {
        i.brace = true;
        this.onGo?.();
      }
      if (pause && !was.pause) this.onPause?.();
      this.padWas = { go, pause, l1, r1 };
    }
    return i;
  }

  /** A rumble on a pad that can: a knock against a rock, a boof, the water getting big. */
  rumble(strong: number, weak: number, ms: number) {
    const pad = this.pad() as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }) | null;
    void pad?.vibrationActuator?.playEffect?.('dual-rumble', {
      duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak),
    })?.catch(() => {});
  }

  private pad(): Gamepad | null {
    if (!navigator.getGamepads) return null;
    for (const p of navigator.getGamepads()) if (p?.connected) return p;
    return null;
  }
}
