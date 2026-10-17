/**
 * Aboard the lightship: up her ladder from the praam, and about her deck. Everything here is in
 * her own frame (her model's metres: x toward the bow, y to port, z up, as tools/models/lowwater.py
 * draws her), so the deck stays under you however she swings to the tide and rolls on the swell;
 * world.ts turns it into the world each frame, after she's been moved.
 */
import * as THREE from 'three';
import { LIGHTSHIP_SCALE } from './lightship';

/** Her measures, as the model has them. */
const LENGTH = 15;
const BEAM = 4.4;
const FREEBOARD = 1.3;
const DECK = FREEBOARD - 0.05;
/** The forecastle, a step up: where it starts, and how high. */
const FOC = LENGTH / 2 - 4.2;
const FOC_UP = 0.55;
/** Where the ladder comes down, on the near side (port: y negative). */
const LADDER_X = -1.2;
/** Things on deck to walk round: round ones (x, y, r) and the deckhouse and windlass (x0, x1, y0, y1). */
const ROUND: [number, number, number][] = [[0.4, 0, 0.62], [1.9, 1.1, 0.38], [1.9, -1.1, 0.38], [-6.5, 0, 0.3]];
const BOXES: [number, number, number, number][] = [[-5.9, -2.3, -1.2, 1.2], [5.05, 5.55, -0.55, 0.55]];
const PAD = 0.28;
/** How long each leg of the climb takes (s): to the ladder, up it, and in over the rail. */
const LEGS = [0.9, 2.8, 0.9];

type State = 'off' | 'up' | 'on' | 'down';

/** Her half-width at t (-1 stern … 1 bow), as the model shapes it. */
function half(t: number) {
  if (t > 0) return (BEAM / 2) * Math.max(0, 1 - t ** 2.2) ** 0.62;
  return (BEAM / 2) * Math.max(0, 1 - (-t) ** 3.5) ** 0.5;
}

/** A point in her model's metres, in her group's frame (three's axes, and the scale she's shown at). */
function local(x: number, y: number, z: number, out = new THREE.Vector3()) {
  return out.set(x * LIGHTSHIP_SCALE, z * LIGHTSHIP_SCALE, -y * LIGHTSHIP_SCALE);
}

export class Deck {
  private state: State = 'off';
  /** Where you are (her metres) and which way you face, in her frame (three's, about her up). */
  readonly at = new THREE.Vector3();
  heading = Math.PI;
  /** Where you're walking to on deck, if anywhere. */
  goal: THREE.Vector2 | null = null;
  /** Into the climb (s), and where it started from or ends at: the praam's seat, in her frame. */
  private t = 0;
  private seat = new THREE.Vector3();

  /** Up the ladder and on board, or on the way. */
  get aboard() {
    return this.state !== 'off';
  }

  /** Stood on her deck (not on the ladder). */
  get onDeck() {
    return this.state === 'on';
  }

  get climbing() {
    return this.state === 'up' || this.state === 'down';
  }

  /** How far through a rung you are on the ladder (for the arms and legs), or -1 off it. */
  get rung() {
    if (!this.climbing) return -1;
    const k = this.state === 'up' ? this.t : LEGS[0] + LEGS[1] + LEGS[2] - this.t;
    return k > LEGS[0] && k < LEGS[0] + LEGS[1] ? ((k - LEGS[0]) / LEGS[1]) * 5 : -1;
  }

  /** By the head of the ladder, where you came up. */
  get atLadder() {
    return this.state === 'on' && Math.hypot(this.at.x - LADDER_X, this.at.y - this.head().y) < 1.7;
  }

  /** Up you go, from the seat (given in her frame, her metres). */
  board(seat: THREE.Vector3) {
    if (this.state !== 'off') return;
    this.seat.copy(seat);
    this.state = 'up';
    this.t = 0;
    this.goal = null;
  }

  /** Back down to the boat: to the ladder first if you're not at it. */
  leave() {
    if (this.state !== 'on') return;
    if (!this.atLadder || this.at.distanceTo(this.head()) > 0.3) {
      const h = this.head();
      this.goal = new THREE.Vector2(h.x, h.y);
      return;
    }
    this.goal = null;
    this.state = 'down';
    this.t = 0;
  }

  /** Off her at once (leaving the flat while aboard). */
  reset() {
    this.state = 'off';
    this.goal = null;
  }

  /** Whether you're on your way to the ladder to go down. */
  get leaving() {
    const h = this.head();
    return !!this.goal && this.goal.x === h.x && this.goal.y === h.y;
  }

  /**
   * One frame: the climb, or a walk about the deck. `move` is which way the keys say (in her
   * frame, three's x and z), `pace` how fast in her metres a second. `seat` is where the praam's seat is now
   * (her frame), for coming down into it. Says how far you went (her metres), for the stride.
   */
  update(dt: number, move: THREE.Vector2 | null, pace: number, seat: THREE.Vector3) {
    if (this.climbing) {
      this.t += dt;
      const total = LEGS[0] + LEGS[1] + LEGS[2];
      const k = this.state === 'up' ? this.t : total - this.t;
      this.climb(k, seat);
      if (this.t >= total) {
        if (this.state === 'up') (this.state = 'on'), (this.heading = Math.PI);
        else this.state = 'off';
      }
      return 0;
    }
    if (this.state !== 'on') return 0;
    // where to: the keys, or the goal (and down the ladder once at it, if that's why)
    let dir = move && move.lengthSq() ? move.clone().normalize() : null;
    let speed = pace;
    if (!dir && this.goal) {
      // (the goal's in her metres: y to port is three's -z)
      const dx = this.goal.x - this.at.x;
      const dz = -(this.goal.y - this.at.y);
      const d = Math.hypot(dx, dz);
      if (d < 0.1) {
        const down = this.leaving;
        this.goal = null;
        if (down) this.leave();
        return 0;
      }
      dir = new THREE.Vector2(dx / d, dz / d);
      speed = pace * Math.min(1, d / 0.5 + 0.3);
    }
    if (!dir) return 0;
    let turn = Math.atan2(dir.x, dir.y) - this.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.heading += turn * (1 - Math.exp(-dt * 10));
    const was = this.at.clone();
    this.at.x += Math.sin(this.heading) * speed * dt;
    this.at.y -= Math.cos(this.heading) * speed * dt;
    this.keepOn();
    this.at.z = this.deckAt(this.at.x);
    return Math.hypot(this.at.x - was.x, this.at.y - was.y);
  }

  /** Where you are in her frame (three's axes, her group's scale), to be put into the world. */
  where(out: THREE.Vector3) {
    return local(this.at.x, this.at.y, this.at.z, out);
  }

  /** A point on deck (her frame, three's axes) to her metres, kept to where you can stand. */
  toDeck(p: THREE.Vector3) {
    const k = LIGHTSHIP_SCALE;
    const save = this.at.clone();
    this.at.set(p.x / k, -p.z / k, 0);
    this.keepOn();
    const goal = new THREE.Vector2(this.at.x, this.at.y);
    this.at.copy(save);
    return goal;
  }

  /** How high her deck is here (her metres): the forecastle's a step up. */
  deckAt(x: number) {
    return DECK + FOC_UP * THREE.MathUtils.smoothstep(x, FOC - 0.15, FOC + 0.15);
  }

  /** The deck's height in her frame, near enough, for finding where a click lands on it. */
  get plane() {
    return DECK * LIGHTSHIP_SCALE;
  }

  /** Where the ladder comes up on deck (her metres). */
  private head() {
    return new THREE.Vector3(LADDER_X, -(half(LADDER_X / (LENGTH / 2)) * 0.88 - 0.4), DECK);
  }

  /** The climb at k seconds in (from the boat): to the ladder, up it rung by rung, in over the rail. */
  private climb(k: number, seat: THREE.Vector3) {
    const side = -half(LADDER_X / (LENGTH / 2));
    const foot = new THREE.Vector3(LADDER_X, side - 0.38, 0.3);
    const top = new THREE.Vector3(LADDER_X, side - 0.3, FREEBOARD + 0.05);
    const head = this.head();
    // (the seat's in her frame; the rest in her metres)
    const from = this.state === 'down' ? seat : this.seat;
    const boat = new THREE.Vector3(from.x / LIGHTSHIP_SCALE, -from.z / LIGHTSHIP_SCALE, from.y / LIGHTSHIP_SCALE);
    const ease = (u: number) => u * u * (3 - 2 * u);
    if (k < LEGS[0]) this.at.lerpVectors(boat, foot, ease(THREE.MathUtils.clamp(k / LEGS[0], 0, 1)));
    else if (k < LEGS[0] + LEGS[1]) {
      // a rung at a time: a pull, then a pause to get the next hold
      const r = ((k - LEGS[0]) / LEGS[1]) * 5;
      const u = (Math.floor(r) + ease(Math.min(1, (r % 1) * 1.6))) / 5;
      this.at.lerpVectors(foot, top, u);
    } else this.at.lerpVectors(top, head, ease(THREE.MathUtils.clamp((k - LEGS[0] - LEGS[1]) / LEGS[2], 0, 1)));
    // facing her side on the ladder; facing inboard either way
    this.heading = Math.PI;
  }

  /** Inside the rail and round what's on deck. */
  private keepOn() {
    const a = this.at;
    a.x = THREE.MathUtils.clamp(a.x, -LENGTH / 2 + 0.6, LENGTH / 2 - 0.5);
    const w = Math.max(0, half(a.x / (LENGTH / 2)) * 0.88 - 0.35);
    a.y = THREE.MathUtils.clamp(a.y, -w, w);
    for (const [x, y, r] of ROUND) {
      const dx = a.x - x;
      const dy = a.y - y;
      const d = Math.hypot(dx, dy);
      if (d < r + PAD && d > 1e-4) (a.x = x + (dx / d) * (r + PAD)), (a.y = y + (dy / d) * (r + PAD));
    }
    for (const [x0, x1, y0, y1] of BOXES) {
      if (a.x < x0 - PAD || a.x > x1 + PAD || a.y < y0 - PAD || a.y > y1 + PAD) continue;
      // out the nearest way
      const out = [x0 - PAD - a.x, x1 + PAD - a.x, y0 - PAD - a.y, y1 + PAD - a.y];
      const i = out.reduce((b, v, j) => (Math.abs(v) < Math.abs(out[b]) ? j : b), 0);
      if (i < 2) a.x += out[i];
      else a.y += out[i];
    }
  }
}
