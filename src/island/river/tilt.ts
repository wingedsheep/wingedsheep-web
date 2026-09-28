/**
 * Leaning by tilting the phone: turned like a steering wheel, round the axis out of the screen,
 * which is the way the kayak rolls round its own length as the camera follows it down the river.
 *
 * Read as where "up" is in the plane of the screen, from the phone's orientation, so it's the same
 * held upright or on its side, and doesn't jump about when the phone's held straight up (as the
 * raw left-right angle does). Level is however you were holding it when you pushed off (or carried
 * on after a pause), not straight up: nobody plays holding a phone plumb. Lying flat on its back
 * the phone can't tell which way it's turned, and tilting fades out.
 *
 * Off unless asked for (the start card's switch); on an iPhone, turning it on asks for the motion
 * sensors, which only works from a tap, and only on https.
 */
const TILT = 'wingedsheep:river:tilt';
const DEAD = 0.07; // rad (~4°): a hand's wobble
const FULL = 0.44; // rad (~25°): turned this far is leaning all the way over
const STALE = 500; // ms without a reading and the sensors have stopped

type Asking = { requestPermission?: () => Promise<'granted' | 'denied'> };

class Tilt {
  /** Whether you'd like to lean by tilting (kept from last time). */
  wanted = (() => {
    try {
      return localStorage.getItem(TILT) === '1';
    } catch {
      return false;
    }
  })();
  /** Whether this device has the sensors at all (worth offering the switch). */
  readonly possible = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && window.isSecureContext;
  private granted = false;
  private listening = false;
  private roll = 0; // the phone's turn from upright, clockwise as you look at it (rad)
  private upright = 0; // 0 lying flat … 1 held up: how much the roll means anything
  private at = -Infinity; // when the last reading came (ms)
  private level: number | null = null;

  constructor() {
    // Android asks nothing, and an iPhone that said yes this visit says yes again without a tap
    if (this.wanted && this.possible && !this.asks) this.listen();
  }

  /** Whether the phone needs asking (an iPhone): only from a tap. */
  private get asks() {
    return typeof (DeviceOrientationEvent as unknown as Asking).requestPermission === 'function';
  }

  /** Readings coming in, and wanted: the lean's in your hands. */
  get live() {
    return this.wanted && this.granted && performance.now() - this.at < STALE;
  }

  /** Turn it on or off (from a tap: on an iPhone that's when it can ask). False if the phone said no. */
  async want(on: boolean): Promise<boolean> {
    this.wanted = on;
    try {
      localStorage.setItem(TILT, on ? '1' : '0');
    } catch {}
    if (on) return this.ask();
    return true;
  }

  /** Ask for the sensors, if wanted and not had yet (call from a tap). */
  async ask(): Promise<boolean> {
    if (!this.wanted || this.granted) return true;
    if (this.asks) {
      try {
        if ((await (DeviceOrientationEvent as unknown as Asking).requestPermission!()) !== 'granted') return false;
      } catch {
        return false; // (not from a tap: try again on the next one)
      }
    }
    this.listen();
    return true;
  }

  /** However the phone's held now is level. */
  setLevel() {
    this.level = this.upright > 0.3 ? this.roll : null;
  }

  /** -1 (lean left) … 1 (lean right). */
  lean(): number {
    if (!this.live) return 0;
    if (this.level === null) this.setLevel(); // (picked up after pushing off)
    if (this.level === null) return 0;
    let d = this.roll - this.level;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const far = Math.min(1, Math.max(0, (Math.abs(d) - DEAD) / (FULL - DEAD)));
    const held = Math.min(1, Math.max(0, (this.upright - 0.25) / 0.25));
    return Math.sign(d) * far * held;
  }

  private listen() {
    this.granted = true;
    if (this.listening) return;
    this.listening = true;
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null) return;
      // up, in the phone's own frame (x to the right of the screen, y to its top)
      const b = (e.beta * Math.PI) / 180;
      const g = (e.gamma * Math.PI) / 180;
      const x = -Math.sin(g) * Math.cos(b);
      const y = Math.sin(b);
      this.roll = Math.atan2(-x, y);
      this.upright = Math.hypot(x, y);
      this.at = performance.now();
    });
    // turned from portrait to landscape (or back): level again, however it's held now
    screen.orientation?.addEventListener('change', () => (this.level = null));
  }
}

export const tilt = new Tilt();
