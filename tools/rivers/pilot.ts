/**
 * The autopilot's paddler, on its own: the line it plans (Chart), the paddler that follows it
 * (Pilot), and the foresight that tries moves out before making them (Foresight). No Node in it, so
 * the same paddler runs in the tests (autopilot.ts) and in the game in a browser (record.ts).
 */

import type { Intent } from '../../src/island/river/controls';
import { NEUTRAL } from '../../src/island/river/controls';
import type { Course, Hole, Ledge, Log } from '../../src/island/river/course';
import { waterAt } from '../../src/island/river/flow';
import type { Kayak } from '../../src/island/river/kayak';
import { CELLS, DS, DU, HULL_R, cell, clear, dilate, sampleAt, uOf } from './shared';

/** The frame the paddler thinks in (s). */
export const DT = 1 / 60;
/** How far past it can lean before it wants to go over (kayak.ts's TIP). */
const TIP = 0.95;

/** How it paddles. Any of these can be set (configure()); these are what came out best. */
export const S = {
  /** How fast (m/s) the planned line may slide across the river: well inside what a boat can ferry. */
  ferry: 1.2,
  /** Room to spare (m) past the hull when planning. */
  margin: 0.25,
  /** How hard it paddles, 0..1 (sprinting through holes whatever this is). */
  power: 1,
  /** How well it balances, 0..1: how hard it leans against the roll (it still braces past the tipping point). */
  balance: 1,
  // the paddler's feel for it (found by a search over runs of the Tumble and the Black)
  ahead: 0.57, // how far ahead (s of travel) it reads the line
  lead: 1.1, // how far ahead (s) it reckons its own drift across
  gain: 1.25, // how hard it closes on the line (m/s across per m off)
  damp: 0.28, // how far ahead (s) it reckons its own turning
  dead: 0.22, // this close (radians) to the heading it wants, it paddles straight on
  sweep: 0.7, // further off than this, a reverse sweep
  catch: 0.07, // how hard it chases the speed across it wants
  /** The furthest (radians) it points the bow across the river to get over. */
  maxoff: 1,
  /** How fast the boat goes through the water, paddling (m/s): how far round it has to point to ferry. */
  through: 3,
  /** Trying moves out before making them. */
  foresight: true,
  horizon: 4, // how far ahead (s) it tries each one
  far: 0.3, // what trouble at the end of that counts for, against trouble in the next second
  wander: 0.5, // what ending up a metre off the line costs
  progress: 1, // what a metre of holding back costs
  dice: 1, // how many different wobbles each move is tried on (it goes by the worst)
  every: 8, // frames between looks
  /** Further off the line than this (m), it plans a new one from where it is (0: never). */
  reroute: 0.3,
  /** Metres from the push-off to tell what foresight's thinking round (NaN: nowhere). */
  trace: NaN,
};

export function configure(o: Partial<typeof S>) {
  Object.assign(S, o);
  MOVES = moves();
}

/**
 * The whole paddler, for one boat on one river: the line planned from the push-off (null if there's
 * no way down at all), and each frame what to do.
 */
export function autopilot(course: Course, kayak: Kayak, start: number, finish: number) {
  const plan = planLine(course, start, finish);
  const pilot = new Pilot(course, kayak, plan.chart?.line ?? new Float32Array(2), start);
  const sight = new Foresight(course, kayak, pilot, start);
  let frame = 0;
  return {
    plan,
    pilot,
    /** What to do this frame. */
    intent(dt = DT): Intent {
      // off the line (knocked, shoved, or swerving round something): a new line from here
      if (S.reroute && plan.chart && frame++ % S.every === 0 && Math.abs(kayak.side - pilot.uAt(kayak.s)) > S.reroute) {
        plan.chart.reroute(kayak.s, kayak.side, 80);
      }
      if (S.foresight) sight.look();
      return pilot.intent(dt);
    },
  };
}

// --- the line -----------------------------------------------------------------------------

export interface Plan {
  kind: 'clean' | 'holes' | 'none';
  /** The water it's reckoned with, and the line through it. */
  chart?: Chart;
  stuckAt: number;
}

/**
 * The line: first which bits of each slice a boat can be in and still get to the take-out
 * (forward from the push-off, then back from the take-out), then through those, the way that
 * keeps furthest from anything, and slides across as little as it can. Out of the holes if it can
 * be; through one if it can't.
 */
export function planLine(course: Course, start: number, finish: number): Plan {
  let stuckAt = start;
  for (const holes of [true, false]) {
    for (const ferry of [S.ferry, 2]) {
      for (const margin of [S.margin, 0.1]) {
        const chart = new Chart(course, start, finish, holes, ferry, margin);
        if (chart.ok) return { kind: holes ? 'clean' : 'holes', chart, stuckAt };
        stuckAt = Math.max(stuckAt, chart.stuckAt);
      }
    }
  }
  return { kind: 'none', stuckAt };
}

/** The bow and the stern's collision circles, from the middle (m), as kayak.ts has them. */
const ENDS_AT = 1.45;
/** A metre across costs this much, against keeping away from things (see Chart.penalty). */
const SWING = 1.5;

/**
 * The river in slices, as the boat sees it: where it can be in each (`free`), where it can still get
 * down to the take-out from (`down`), how much room there is round each place, and the line.
 */
export class Chart {
  readonly n: number;
  readonly free: Uint8Array[] = [];
  /** Where, in each slice, the boat can still get down to the take-out from (wherever it came from). */
  readonly down: Uint8Array[];
  readonly ks: number[] = [];
  /** The river's speed at each slice (m/s). */
  readonly speeds: number[] = [];
  /** Whether the line keeps the bow and the stern clear too, at the angle it'd take to ferry across. */
  hull = true;
  /** Rerouting in a hurry: ferrying this many times harder than the line was planned for. */
  private boost = 1;
  readonly room: Float32Array[];
  /** Across the river (m, + is river right) at each slice from the push-off. */
  readonly line: Float32Array;
  ok = false;
  stuckAt: number;

  constructor(course: Course, readonly start: number, finish: number, holes: boolean, ferry: number, margin: number) {
    const n = (this.n = Math.ceil((finish + 20 - start) / DS) + 1); // (a bit past the take-out, to paddle on through)
    this.stuckAt = start;
    this.line = new Float32Array(n);
    for (let i = 0; i < n; i++) this.free.push(clear(course, start + i * DS, holes, margin));
    for (let i = 0; i < n - 1; i++) {
      const speed = sampleAt(course, start + i * DS).speed;
      this.speeds.push(speed);
      this.ks.push(Math.min(400, Math.floor((ferry * DS) / Math.max(0.5, speed) / DU)));
    }
    // back from the take-out: where it could still get down from
    this.down = new Array(n);
    this.down[n - 1] = this.free[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      const spread = dilate(this.down[i + 1], this.free[i], this.ks[i]);
      const d = new Uint8Array(CELLS);
      for (let j = 0; j < CELLS; j++) d[j] = this.free[i][j] & spread[j];
      this.down[i] = d;
    }
    this.room = this.free.map(distance);
    // (where it gets stuck, if it does: forward from the push-off, until there's nowhere to be)
    const reach = this.reach(0, cell(0), n - 1);
    if (!reach) return;
    let path = this.cheapest(0, n - 1, reach, (j) => this.penalty(n - 1, j));
    if (!path) (this.hull = false), (path = this.cheapest(0, n - 1, reach, (j) => this.penalty(n - 1, j)));
    if (!path) return;
    for (let i = 0; i < n; i++) this.line[i] = uOf(path[i]);
    this.ok = true;
  }

  /** Keeping away from things: how far each place is from anything, across and a metre up and down the river. */
  penalty(i: number, j: number) {
    let d = 3;
    for (let q = Math.max(0, i - 2); q <= Math.min(this.n - 1, i + 2); q++) d = Math.min(d, this.room[q][j] + Math.abs(q - i) * DS * 0.5);
    return 1 / (d + 0.15);
  }

  /** Forward from cell j0 in slice i0 to slice i1: where the boat can get to and still get down from. */
  private reach(i0: number, j0: number, i1: number) {
    const ok = (i: number) => (this.boost > 1 && i < i1 ? this.free[i] : this.down[i]);
    if (!ok(i0)[j0]) return (this.stuckAt = this.start + i0 * DS), null;
    const out: Uint8Array[] = [];
    let r = new Uint8Array(CELLS);
    r[j0] = 1;
    out.push(r);
    for (let i = i0; i < i1; i++) {
      const spread = dilate(r, this.free[i], Math.round(this.ks[i] * this.boost));
      const next = new Uint8Array(CELLS);
      const good = ok(i + 1);
      let any = false;
      for (let j = 0; j < CELLS; j++) if (spread[j] && good[j]) (next[j] = 1), (any = true);
      if (!any) return (this.stuckAt = this.start + (i + 1) * DS), null;
      out.push((r = next));
    }
    return out;
  }

  /**
   * The cheapest way from slice i0 (its one reachable cell) to slice i1 over the places in `reach`,
   * worked back from i1 (cost to go): near things costs, and so does sliding across.
   */
  private cheapest(i0: number, i1: number, reach: Uint8Array[], end: (j: number) => number) {
    let next = new Float64Array(CELLS).fill(Infinity);
    for (let j = 0; j < CELLS; j++) if (reach[i1 - i0][j]) next[j] = end(j);
    const choice: Int32Array[] = new Array(i1 - i0);
    for (let i = i1 - 1; i >= i0; i--) {
      const cost = new Float64Array(CELLS).fill(Infinity);
      const pick = new Int32Array(CELLS).fill(-1);
      const k = Math.round(this.ks[i] * this.boost);
      const f = this.free[i];
      const here = reach[i - i0];
      for (let j = 0; j < CELLS; j++) {
        if (!here[j]) continue;
        let best = Infinity;
        let at = -1;
        // across as far as it can slide this slice, through clear water only
        for (let dir = -1; dir <= 1; dir += 2) {
          for (let d = dir < 0 ? 1 : 0; d <= k; d++) {
            const q = j + dir * d;
            if (q < 0 || q >= CELLS || !f[q]) break;
            if (this.hull && !this.ends(i, j, dir * d)) continue;
            const c = next[q] + d * DU * SWING;
            if (c < best) (best = c), (at = q);
          }
        }
        if (at < 0) continue;
        cost[j] = best + this.penalty(i, j);
        pick[j] = at;
      }
      choice[i - i0] = pick;
      next = cost;
    }
    let j = reach[0].indexOf(1);
    if (j < 0 || !Number.isFinite(next[j])) return null;
    const path = new Int32Array(i1 - i0 + 1);
    for (let i = i0; i <= i1; i++) {
      path[i - i0] = j;
      if (i < i1) j = choice[i - i0][j];
    }
    return path;
  }

  /**
   * Sliding `d` cells across from j at slice i, the boat points across the river to do it (as far
   * as the speed across it needs, against how fast it goes through the water): are its bow (ahead,
   * and out towards where it's going) and its stern (behind, and the other way) in clear water?
   */
  private ends(i: number, j: number, d: number) {
    const across = (d * DU * this.speeds[i]) / DS;
    const lean = Math.min(0.95, Math.abs(across) / S.through);
    const out = Math.sign(d) * Math.round((ENDS_AT * lean) / DU);
    const along = Math.round((ENDS_AT * Math.sqrt(1 - lean * lean)) / DS);
    const bow = this.free[Math.min(this.n - 1, i + along)];
    const stern = this.free[Math.max(0, i - along)];
    const jb = j + out;
    const js = j - out;
    return jb >= 0 && jb < CELLS && js >= 0 && js < CELLS && !!bow[jb] && !!stern[js];
  }

  /**
   * Knocked or pushed off the line: a new one from where the boat is (u across, at arc length s),
   * for the next `ahead` metres, rejoining the old line (or not) as it's cheapest. False if there's
   * no way on from here.
   */
  reroute(s: number, u: number, ahead: number) {
    // as planned, or failing that ferrying twice as hard (paddling flat out, it can)
    for (const boost of [1, 2]) {
      this.boost = boost;
      const done = this.route(s, u, ahead);
      this.boost = 1;
      if (done) return true;
    }
    return false;
  }

  private route(s: number, u: number, ahead: number) {
    const i0 = Math.max(0, Math.min(this.n - 2, Math.round((s - this.start) / DS)));
    const i1 = Math.min(this.n - 1, i0 + Math.round(ahead / DS));
    // (from the nearest place it can still get down from, within a metre)
    let j0 = cell(u);
    const d = this.boost > 1 ? this.free[i0] : this.down[i0];
    for (let w = 0; w <= 40 && !d[j0]; w++) {
      if (d[cell(u) + w]) j0 = cell(u) + w;
      else if (d[cell(u) - w]) j0 = cell(u) - w;
    }
    if (!d[j0]) return false;
    const stuck = this.stuckAt;
    const reach = this.reach(i0, j0, i1);
    this.stuckAt = stuck;
    if (!reach) return false;
    const back = cell(this.line[i1]);
    const end = (j: number) => this.penalty(i1, j) + Math.abs(j - back) * DU * SWING * 2;
    let path = this.cheapest(i0, i1, reach, end);
    if (!path && this.hull) {
      this.hull = false;
      path = this.cheapest(i0, i1, reach, end);
      this.hull = true;
    }
    if (!path) return false;
    for (let i = i0; i <= i1; i++) this.line[i] = uOf(path[i - i0]);
    return true;
  }
}

/** Each place's distance (m) to the nearest thing it can't be, across the slice. */
function distance(free: Uint8Array) {
  const out = new Float32Array(CELLS);
  let d = 0;
  for (let j = 0; j < CELLS; j++) out[j] = d = free[j] ? d + DU : 0;
  d = 0;
  for (let j = CELLS - 1; j >= 0; j--) out[j] = Math.min(out[j], (d = free[j] ? d + DU : 0));
  return out;
}

// --- the paddler --------------------------------------------------------------------------

/**
 * Steers for a point on the line a few boat lengths ahead (further the faster it's going), with its
 * bow set off that to allow for the way the current is carrying it. Straight on it paddles both
 * sides; off a bit it sweeps on the other side; well off it throws in a reverse sweep. All the while
 * it leans against the roll and braces when it goes past the tipping point.
 */
/** The ways it tries to peel out, in turn: how long it turns up into the eddy first (s), then how far off downstream it drives out (rad). */
const PEELS: [number, number][] = [[1, 1], [0, 0.6], [1, 1.5], [0, 1.2], [2, 0.8]];

export class Pilot {
  /** What foresight has it doing just now: how far off the line to steer, how hard to paddle. */
  move: Move = MOVES[0];
  private cooldown = 0;
  private braced = 0;
  private rollTapped = false;
  /** Going nowhere: the furthest it's got, how long since it got further, and how far into a peel-out (-1: not). */
  private stallS = -Infinity;
  private stallT = 0;
  private peel = -1;
  private peelFrom = 0;
  private peels = 0;

  constructor(private course: Course, private k: Kayak, private line: Float32Array, private start: number) {}

  /** The same paddler, in another boat (for trying a move out). */
  copy(k: Kayak) {
    const p = new Pilot(this.course, k, this.line, this.start);
    p.cooldown = this.cooldown;
    p.braced = this.braced;
    p.rollTapped = this.rollTapped;
    p.stallS = this.stallS;
    p.stallT = this.stallT;
    p.peel = this.peel;
    p.peelFrom = this.peelFrom;
    p.peels = this.peels;
    return p;
  }

  uAt(s: number) {
    const f = (s - this.start) / DS;
    const i = Math.max(0, Math.min(this.line.length - 2, Math.floor(f)));
    const t = Math.max(0, Math.min(1, f - i));
    return this.line[i] + (this.line[i + 1] - this.line[i]) * t;
  }

  /** Where it's steering for: the line, or off it by the move's bias. */
  private aim(s: number) {
    return this.uAt(s) + this.move.bias;
  }

  intent(dt: number): Intent {
    const k = this.k;
    const i: Intent = { ...NEUTRAL };
    this.cooldown -= dt;
    this.braced -= dt;
    const tiltV = (k as unknown as { tiltV: number }).tiltV;

    // upside down: the brace when the needle's in the window
    if (k.balance === 'rolling') {
      const r = k.roll;
      const inWindow = r.time > 0.65 && Math.abs(r.needle - 0.5) < r.window * 0.3;
      if (inWindow && !this.rollTapped) (i.brace = true), (this.rollTapped = true);
      return i;
    }
    this.rollTapped = false;

    const speed = k.speed;
    const s = k.s;
    // what's coming
    let ledge: Ledge | null = null;
    let hole = false;
    for (const t of this.course.near(s - 1, s + 25)) {
      if (!('kind' in t)) continue;
      if (t.kind === 'ledge' && !t.passed && t.s > s - 0.3 && (!ledge || t.s < ledge.s)) ledge = t;
      if (t.kind === 'hole' && t.s > s - 1 && t.s < s + 5 && Math.abs(this.aim(t.s) - (t as Hole).u) < (t as Hole).half + 0.8) hole = true;
    }
    const toLip = ledge ? (ledge.s - s) / Math.max(1, speed) : Infinity;
    const falls = !!ledge && ledge.height >= 3;

    // where to point: in the river's own frame, a speed across it that closes on the line (where
    // the boat will be in a moment against where the line will be), and the bow angled across the
    // river enough to make that speed through the water
    const here = sampleAt(this.course, s);
    const rx = Math.cos(here.a);
    const rz = Math.sin(here.a);
    const across = k.vel.x * rx + k.vel.y * rz;
    const ahead = Math.max(1.5, speed * S.ahead);
    const gap = this.aim(s + ahead) - (k.side + across * S.lead);
    const slope = (this.aim(s + ahead + 2) - this.aim(s + ahead)) / 2;
    const wantAcross = Math.max(-2.5, Math.min(2.5, gap * S.gain + slope * speed));
    const through = Math.max(1.5, k.through.length());
    // (less whatever the water's doing across the river where it is: a bend, a funnel, a rock's pillow)
    const w = waterAt(this.course, k.pos.x, k.pos.z, s, this.course.near(s - 14, s + 8));
    const drift = (w.fx * w.along + w.px) * rx + (w.fz * w.along + w.pz) * rz;
    let off = Math.asin(Math.max(-0.8, Math.min(0.8, (wantAcross - drift) / through))) + (wantAcross - across) * S.catch;
    off = Math.max(-S.maxoff, Math.min(S.maxoff, off));
    let want = here.a + (this.move.hold ?? off);
    // going nowhere (held in an eddy, or pinned on a rock): peel out. Turn up into the eddy first,
    // which gets the bow off a rock and some speed on, then drive out across the eddy line, angled
    // downstream, towards the middle. (Straight out at it, the eddy line spins you back in.) If that
    // doesn't do it, the next go is a different one: no turn first, and steeper or flatter out.
    if (this.peel < 0) {
      if (s > this.stallS + 2) (this.stallS = s), (this.stallT = 0);
      else if ((this.stallT += dt) > 2.5) (this.peel = 0), (this.peelFrom = k.side), this.peels++;
    }
    if (this.peel >= 0) {
      this.peel += dt;
      const out = -Math.sign(this.peelFrom || 1);
      const [up, across] = PEELS[(this.peels - 1) % PEELS.length];
      want = this.peel < up ? here.a + Math.PI : here.a + out * across;
      if ((this.peel > up && Math.abs(k.side) < Math.abs(this.peelFrom) - 2.5) || this.peel > 6) {
        this.peel = -1;
        this.stallS = s;
        this.stallT = 0;
      }
    }
    const escape = this.peel >= 0;
    // over a waterfall: straight down it
    if (falls && toLip < 1.6) want = k.here.a;
    const err = angle(want - k.heading) - k.yawRate * S.damp; // + wants to turn right

    // the paddle
    const hard = hole || k.holed > 0;
    const power = hard || escape ? 1 : this.move.power;
    if (Math.abs(err) < S.dead) i.left = i.right = power;
    else if (Math.abs(err) < S.sweep || this.cooldown > 0) {
      // a forward sweep turns you away from its side
      if (err > 0) i.left = power;
      else i.right = power;
    } else {
      // well off: a reverse sweep turns you towards its side
      if (err > 0) i.tapRight = true;
      else i.tapLeft = true;
      this.cooldown = 0.6;
    }
    i.sprint = hard || escape;
    // backing off: both blades back, the bow held where it is
    if (this.move.back && !hard && !escape) {
      i.left = i.right = 0;
      i.tapLeft = i.tapRight = false;
      i.backLeft = i.backRight = true;
    }
    // a ledge: let the strokes go, then one catching right at the lip (sitting back a touch)
    if (ledge && !falls) {
      if (toLip < 1.0 && toLip > 0.32) i.left = i.right = 0;
      else if (toLip <= 0.32) i.left = i.right = 1;
      if (toLip < 1.2) i.tapLeft = i.tapRight = false;
    }
    i.pitch = ledge && !falls && toLip < 1.2 ? -0.3 : falls && toLip < 2 ? 1 : 0.4;
    // (over the lip the ledge is passed and gone from what's coming: ask the boat what it's off)
    if (k.airborne) i.pitch = k.flying >= 3 ? 1 : -0.3;

    // balance: lean against the roll, and brace past the tipping point
    i.lean = Math.max(-1, Math.min(1, (-k.tilt * 1.6 - tiltV * 0.4) * S.balance));
    if ((Math.abs(k.tilt) > TIP * 0.9 || k.balance === 'over') && this.braced <= 0) {
      i.brace = true;
      this.braced = 0.5;
    }
    return i;
  }
}

// --- foresight ----------------------------------------------------------------------------

interface Move {
  bias: number; // m off the line (+ is river right)
  power: number;
  back: boolean;
  /** Or, instead of the line: the bow held this far (radians, + is right) off straight down the river. */
  hold?: number;
}

let MOVES: Move[] = moves();

function moves(): Move[] {
  return [
  { bias: 0, power: S.power, back: false },
  ...[-1.6, -0.8, 0.8, 1.6].map((bias) => ({ bias, power: S.power, back: false })),
  ...[-1.2, 0, 1.2].map((bias) => ({ bias, power: 0.2, back: false })),
  { bias: 0, power: 1, back: false },
  { bias: 0, power: 0, back: true },
  ...[-1, -0.6, -0.3, 0.3, 0.6, 1].flatMap((hold) => [S.power, 0.2].map((power) => ({ bias: 0, power, back: false, hold }))),
  ];
}

/**
 * Every few frames (S.every), it tries what it's doing now on a copy of the boat, S.horizon seconds
 * on. If that runs into something, or shaves it too close, it tries the others (steering a boat
 * length or two either side of the line, holding the bow at an angle across the current, easing off,
 * driving on, backing off) and takes whichever comes out cleanest, with the least fuss and without
 * hanging back. A human paddler reads the water ahead the same way; this one gets to read it
 * nearly exactly (the waves' wobbles are a throw of the dice it can't see coming).
 */
export class Foresight {
  private frame = 0;

  constructor(private course: Course, private k: Kayak, private pilot: Pilot, private start: number) {}

  look() {
    if (this.frame++ % S.every || this.k.balance !== 'up') return;
    const now = this.pilot.move;
    const first = this.cost(now);
    if (first.safe && now === MOVES[0]) return;
    if (now !== MOVES[0]) {
      const plain = this.cost(MOVES[0]);
      if (plain.safe) return void (this.pilot.move = MOVES[0]);
    }
    let best = now;
    let bestCost = first.cost - 0.2; // (sticking with a move beats switching, all else equal)
    for (const m of MOVES) {
      if (m === now) continue;
      const c = this.cost(m).cost;
      if (c < bestCost) (best = m), (bestCost = c);
    }
    if (Math.abs(this.k.s - this.start - S.trace) < 30) {
      console.log(`    look ${(this.k.s - this.start).toFixed(1)}: now ${JSON.stringify(now)} ${first.cost.toFixed(1)} -> ${JSON.stringify(best)} ${bestCost.toFixed(1)}`);
    }
    this.pilot.move = best;
  }

  /** Try a move out, on each of the wobbles: the worst of them. */
  private cost(move: Move) {
    let worst = this.trial(move, 0);
    for (let d = 1; d < S.dice; d++) {
      const t = this.trial(move, d);
      if (t.cost > worst.cost) worst = t;
    }
    return worst;
  }

  /** Try a move out on a copy of the boat: what it hits, how close it comes, and the fuss. */
  private trial(move: Move, dice: number) {
    const k = copyKayak(this.k);
    const p = this.pilot.copy(k);
    p.move = move;
    // (the river remembers what's been passed and taken: put that back afterwards)
    const flags = this.course.near(this.k.s - 5, this.k.s + 40).map((t) => [t, { ...t }] as const);
    let hit = 0;
    let over = 0;
    let bad = 0;
    k.events = {
      hit: (strength) => (hit += strength * soon),
      bump: (strength) => (hit += (0.5 + strength * 0.5) * soon),
      capsize: () => (over += soon),
      swim: () => (over += soon),
      ledge: (how) => { if (how === 'flat' || how === 'skew' || how === 'pencil') bad += soon; },
    };
    // trouble soon counts in full; further off, less (there'll be other looks before it comes)
    let soon = 1;
    let near = Infinity;
    let tight = 0;
    const frames = Math.round(S.horizon / DT);
    // (its own dice, the same for every move tried from here: moves are compared on the same water)
    const real = Math.random;
    Math.random = mulberry(this.frame * 31 + dice);
    const from = k.s;
    // (held all the way: trying a move for a moment and then going back to the line did worse, as
    // the line's no longer from where the boat is)
    for (let f = 0; f < frames; f++) {
      soon = Math.max(S.far, 1 - Math.max(0, f * DT - 1) / Math.max(0.01, S.horizon - 1) * (1 - S.far));
      k.update(DT, p.intent(DT), this.course, true);
      if (f % 3 === 0) {
        const d = room(this.course, k);
        near = Math.min(near, d);
        tight = Math.max(tight, (0.5 - d) * soon);
      }
      if (k.balance === 'swimming') break;
    }
    Math.random = real;
    for (const [t, was] of flags) Object.assign(t, was);
    const cost = hit * 40 + over * 200 + bad * 30 + tight * 40
      + Math.abs(move.bias) * 0.4 + Math.abs(move.power - S.power) * 0.5 + (move.back ? 0.8 : 0)
      // (and hanging back only puts off what's coming: every metre short of drifting down costs)
      + Math.max(0, this.k.here.speed * S.horizon * 0.8 - (k.s - from)) * S.progress
      // (and wandering off: where it ends up against the line)
      + Math.abs(k.side - p.uAt(k.s)) * S.wander;
    return { cost, safe: !hit && !over && !bad && near > 0.35 };
  }
}

/** How close (m) the hull is to the nearest rock or log. */
function room(course: Course, k: Kayak) {
  const hx = Math.sin(k.heading);
  const hz = -Math.cos(k.heading);
  let best = Infinity;
  for (const t of course.near(k.s - 4, k.s + 4)) {
    if (!('kind' in t) || (t.kind !== 'rock' && t.kind !== 'log')) continue;
    for (const along of [1.45, 0, -1.45]) {
      const x = k.pos.x + hx * along;
      const z = k.pos.z + hz * along;
      const d = t.kind === 'rock' ? Math.hypot(x - t.x, z - t.z) - t.r * 0.9 : segment(x, z, t);
      best = Math.min(best, d - HULL_R);
    }
  }
  return best;
}

export function segment(x: number, z: number, o: Log) {
  const dx = o.x1 - o.x0;
  const dz = o.z1 - o.z0;
  const t = Math.max(0, Math.min(1, ((x - o.x0) * dx + (z - o.z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - o.x0 - dx * t, z - o.z0 - dz * t) - o.r;
}

/** A copy of the boat, as it is this moment, to try things out on. */
function copyKayak(k: Kayak): Kayak {
  // (by what things are, not their classes: in the browser the game has its own copy of three.js)
  const c = Object.create(Object.getPrototypeOf(k)) as Kayak;
  for (const [key, v] of Object.entries(k)) {
    let out: unknown = v;
    if (v && (v.isVector3 || v.isVector2)) out = v.clone();
    else if (v instanceof WeakSet) out = new WeakSet(); // (only for praise: shaves and punched holes)
    else if (key === 'model') out = k.model.clone(false);
    else if (key === 'paddle' || key === 'head') out = undefined;
    else if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype && key !== 'here') out = { ...v };
    (c as unknown as Record<string, unknown>)[key] = out;
  }
  return c;
}

// --- odds and ends ----------------------------------------------------------------------

export function angle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
