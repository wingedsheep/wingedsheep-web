/**
 * Can every river be paddled from the push-off to the take-out without touching a rock, a log,
 * a bank or an island? Makes up each river for a run of seeds, exactly as the game does, and
 * walks it in thin slices across the water: in each slice, which bits of it a boat could be in
 * (clear of everything by its hull), and which of those it could have got to from the slice
 * above, sliding across no faster than it can ferry against the current it's riding.
 *
 * The seeds are 1, 2, 3…, so a river that fails is one you can paddle: ?river=<id>&seed=<n>.
 *
 *   just validate-rivers                    200 seeds a river
 *   just validate-rivers --seeds 1000 --river tumble --ferry 1.5 --verbose
 *   just validate-rivers --river black --seed 195     a map of the last 60 m of that one
 *
 * It exits non-zero if any river can't be got down clean (holes aside: see --holes).
 */

import { Course, type Log, type Sample } from '../../src/island/river/course';
import { RIVERS, type RiverDef } from '../../src/island/river/rivers';

// the boat, as kayak.ts has it
const HULL_R = 0.36; // its collision circles (a rock's only counts at 0.9 of its radius)
const BANK = 0.55; // how close its middle gets to a bank or an island before it's shoved off
const HOLE_REACH = 0.3; // how far past a hole's side it still holds you
const HOLE_ALONG: [number, number] = [-0.6, 1.0];
/** The bridge's trestles (land.ts puts them in the water; the course doesn't know about them). */
const BRIDGE_SPAN = 20;

const args = parse(process.argv.slice(2));
const SEEDS = Number(args.seeds ?? 200);
/** How fast (m/s) a boat can slide across the river while it's carried down it. */
const FERRY = Number(args.ferry ?? 2);
/** Room to spare (m) past the hull, for a line you could actually hold. */
const MARGIN = Number(args.margin ?? 0.1);
const DS = 0.5; // metres between slices
const DU = 0.025; // metres between the places across a slice (fine: see walk())
const U_MAX = 30; // the widest a river gets, either side of the middle
const CELLS = Math.round((2 * U_MAX) / DU) + 1;
const cell = (u: number) => Math.round((u + U_MAX) / DU);
const uOf = (j: number) => j * DU - U_MAX;

interface Failure {
  seed: number;
  s: number; // where the way through runs out (from the push-off)
  where: string;
  heat: number;
  widest: number; // the widest clear water in that slice (m)
}

interface Result {
  failure?: Failure;
  /** The narrowest the way through got (m), and where. */
  tightest: number;
  tightestAt: number;
  tightestWhere: string;
}

if (args.seed) {
  const river = RIVERS.find((r) => r.id === (args.river ?? 'black'))!;
  const seed = Number(args.seed);
  const { course, start, finish } = make(seed, river);
  const trace: Row[] = [];
  const res = walk(course, start, finish, seed, !!args.holes, trace);
  map(trace, start);
  console.log(res.failure ? `\nstuck ${describe(river, res.failure)}` : `\ngot down: the tightest the way through got was ${res.tightest.toFixed(2)} m, ${res.tightestAt.toFixed(0)} m down (${res.tightestWhere})`);
  process.exit(res.failure ? 1 : 0);
}

let bad = 0;
const only = args.river ? RIVERS.filter((r) => r.id === args.river) : RIVERS;
if (!only.length) {
  console.error(`no river called ${args.river}: ${RIVERS.map((r) => r.id).join(', ')}`);
  process.exit(2);
}
console.log(`${SEEDS} seeds a river, ferrying at ${FERRY} m/s, ${MARGIN} m to spare\n`);
console.log(pad('river', 18) + pad('stuck', 9) + pad('holes', 9) + pad('tightest', 10) + 'median');
for (const river of only) {
  const stuck: Failure[] = [];
  const holed: Failure[] = [];
  const tight: number[] = [];
  let worst: (Result & { seed: number }) | null = null;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { course, start, finish } = make(seed, river);
    const clean = walk(course, start, finish, seed, false);
    if (clean.failure) stuck.push(clean.failure);
    else {
      tight.push(clean.tightest);
      if (!worst || clean.tightest < worst.tightest) worst = { ...clean, seed };
      // a clean line that keeps out of the holes as well (the ones at the foot of a ledge go all
      // the way across: those you boof)
      const dry = walk(course, start, finish, seed, true);
      if (dry.failure) holed.push(dry.failure);
    }
  }
  tight.sort((a, b) => a - b);
  const median = tight.length ? tight[Math.floor(tight.length / 2)] : NaN;
  console.log(
    pad(river.id, 18) + pad(`${stuck.length}`, 9) + pad(`${holed.length}`, 9)
    + pad(worst ? `${worst.tightest.toFixed(1)} m` : '-', 10) + (tight.length ? `${median.toFixed(1)} m` : '-'),
  );
  if (worst && args.verbose) console.log(`    tightest: seed ${worst.seed}, ${worst.tightestAt.toFixed(0)} m down, ${worst.tightestWhere}`);
  for (const f of stuck.slice(0, args.verbose ? Infinity : 5)) console.log(`    stuck ${describe(river, f)}`);
  if (stuck.length > 5 && !args.verbose) console.log(`    …and ${stuck.length - 5} more (--verbose)`);
  if (args.holes || args.verbose) for (const f of holed.slice(0, args.verbose ? Infinity : 5)) console.log(`    hole  ${describe(river, f)}`);
  bad += stuck.length;
}
if (!args.holes && !args.verbose) console.log('\n(holes: seeds whose only clean line goes through a hole off a ledge; --holes lists them)');
process.exit(bad ? 1 : 0);

// --- the river, as the game makes it ----------------------------------------------------

function make(seed: number, river: RiverDef) {
  const start = calm(seed, 50, river);
  const finish = start + river.length;
  const course = new Course(seed, finish, river);
  course.extend(finish + 60);
  // the bridges' trestles, as land.ts stands them in the water
  for (const f of course.features) {
    if (f.kind !== 'bridge') continue;
    const p = course.at(f.s);
    for (const u of [-5, 5]) {
      const off = (u / BRIDGE_SPAN) * (p.width + 3);
      for (const dz of [-1, 1]) {
        course.addObstacle({
          kind: 'rock', x: p.x + Math.cos(p.a) * off - Math.sin(p.a) * dz, z: p.z + Math.sin(p.a) * off + Math.cos(p.a) * dz,
          r: 0.25, s: f.s, variant: 0,
        });
      }
    }
  }
  return { course, start, finish };
}

/** Where the game pushes off (game.ts's calm(), kept in step with it by hand). */
function calm(seed: number, from: number, river: RiverDef) {
  const probe = new Course(seed, Infinity, river);
  for (let s = from; s < from + 3000; s += 5) {
    probe.extend(s + 60);
    const st = probe.stretchAt(s);
    const easy = st.kind === 'pool' || st.kind === 'run';
    const at = Math.max(s, st.start + 15);
    const clear = !probe.splits.some((x) => at > x.s0 - 45 && at < x.s1 + 10);
    if (easy && clear && st.end - at >= 50) return at;
  }
  return 50;
}

// --- walking it -------------------------------------------------------------------------

/**
 * Slice by slice from the push-off (in the middle of the river) to the take-out: the places across
 * the river the boat could be, clear of everything, that it could have got to from the slice
 * above. If that ever comes up empty, there's no way down.
 */
function walk(course: Course, start: number, finish: number, seed: number, holes: boolean, trace?: Row[]): Result {
  let reach = new Uint8Array(CELLS);
  let free = clear(course, start, holes);
  const j0 = cell(0);
  if (!free[j0]) return { failure: fail(course, start, start, seed, free), tightest: 0, tightestAt: 0, tightestWhere: '' };
  reach[j0] = 1;
  let tightest = Infinity;
  let tightestAt = 0;
  for (let s = start; s < finish; s += DS) {
    // slide across as far as the current allows before the next slice, through clear water only
    const p = sampleAt(course, s);
    // (rounded down, so the boat's never credited with more than it can do)
    const k = Math.min(400, Math.floor((FERRY * DS) / Math.max(0.5, p.speed) / DU));
    const spread = dilate(reach, free, k);
    const next = clear(course, s + DS, holes);
    reach = new Uint8Array(CELLS);
    let any = false;
    for (let j = 0; j < CELLS; j++) if (spread[j] && next[j]) reach[j] = 1, any = true;
    if (!any) trace?.push({ s: s + DS, free: next, reach, half: sampleAt(course, s + DS).width / 2 });
    if (!any) return { failure: fail(course, s + DS, start, seed, next), tightest, tightestAt, tightestWhere: '' };
    free = next;
    trace?.push({ s: s + DS, free, reach, half: sampleAt(course, s + DS).width / 2 });
    if (trace && trace.length > 120) trace.shift();
    // (past the first few metres: the boat goes in on a single spot)
    const w = widest(reach);
    if (s - start > 20 && w < tightest) tightest = w, tightestAt = s - start;
  }
  const at = course.stretchAt(start + tightestAt);
  return { tightest, tightestAt, tightestWhere: at.name ? `${at.name} (${at.kind})` : at.kind };
}

interface Row {
  s: number;
  free: Uint8Array;
  reach: Uint8Array;
  half: number;
}

/**
 * The last 60 m of a walk, upstream at the top, a character to every 25 cm across: `o` where the
 * boat can be, `.` clear water it can't get to, `#` a rock, a log or an island, blank the bank.
 */
function map(trace: Row[], start: number) {
  const W = 10; // cells to a character
  const edge = Math.max(...trace.map((r) => r.half)) + 0.5;
  const j0 = cell(-edge);
  const j1 = cell(edge);
  for (const row of trace) {
    let line = '';
    for (let j = j0; j < j1; j += W) {
      let reach = false;
      let free = false;
      for (let q = j; q < j + W; q++) reach ||= !!row.reach[q], free ||= !!row.free[q];
      const u = uOf(j + W / 2);
      line += reach ? 'o' : free ? '.' : Math.abs(u) < row.half ? '#' : ' ';
    }
    console.log(`${(row.s - start).toFixed(1).padStart(8)} m |${line}|`);
  }
}

/** Spread what's reachable up to k cells either way, but not through anything in the way. */
function dilate(reach: Uint8Array, free: Uint8Array, k: number) {
  const out = new Uint8Array(CELLS);
  let run = -1; // cells since the last reachable one, going right
  for (let j = 0; j < CELLS; j++) {
    if (!free[j]) run = -1;
    else if (reach[j]) run = 0;
    else if (run >= 0) run++;
    if (run >= 0 && run <= k) out[j] = 1;
  }
  run = -1;
  for (let j = CELLS - 1; j >= 0; j--) {
    if (!free[j]) run = -1;
    else if (reach[j]) run = 0;
    else if (run >= 0) run++;
    if (run >= 0 && run <= k) out[j] = 1;
  }
  return out;
}

/** Which places across the slice at arc length s the boat's middle could be without touching anything. */
function clear(course: Course, s: number, holes: boolean): Uint8Array {
  const p = sampleAt(course, s);
  const free = new Uint8Array(CELLS);
  const half = p.width / 2 - BANK;
  for (let j = cell(-half); j <= cell(half); j++) if (Math.abs(uOf(j)) <= half) free[j] = 1;
  const block = (u0: number, u1: number) => {
    for (let j = Math.max(0, Math.ceil((u0 + U_MAX) / DU)); j <= Math.min(CELLS - 1, Math.floor((u1 + U_MAX) / DU)); j++) free[j] = 0;
  };
  // an island (kayak.ts: its middle can't get within the island's half-width and a bit)
  const isle = course.at(s);
  if (isle.isle > 0) block(isle.isleU - isle.isle - BANK, isle.isleU + isle.isle + BANK);
  const cos = Math.cos(p.a);
  const sin = Math.sin(p.a);
  for (const t of course.near(s - 20, s + 20)) {
    if (!('kind' in t)) continue;
    if (t.kind === 'rock') {
      const R = t.r * 0.9 + HULL_R + MARGIN;
      // the rock against this slice's line across the river
      const u0 = (t.x - p.x) * cos + (t.z - p.z) * sin;
      const d = (t.x - p.x) * sin - (t.z - p.z) * cos; // along the river (+ is downstream)
      if (Math.abs(d) < R) {
        const w = Math.sqrt(R * R - d * d);
        block(u0 - w, u0 + w);
      }
    } else if (t.kind === 'log') {
      blockLog(t, p, block);
    } else if (t.kind === 'hole' && holes) {
      if (t.half >= course.at(t.s).width / 2 - 0.01) continue; // a ledge's: all the way across
      const along = s - t.s;
      if (along > HOLE_ALONG[0] && along < HOLE_ALONG[1]) block(t.u - t.half - HOLE_REACH, t.u + t.half + HOLE_REACH);
    }
  }
  return free;
}

/** A log against the slice's line: wherever along it the line comes within reach of it. */
function blockLog(o: Log, p: Sample, block: (u0: number, u1: number) => void) {
  const R = o.r + HULL_R + MARGIN;
  const cos = Math.cos(p.a);
  const sin = Math.sin(p.a);
  const lo = -p.width / 2 - 1;
  let from = NaN;
  for (let u = lo; u <= -lo + DU; u += DU) {
    const x = p.x + cos * u;
    const z = p.z + sin * u;
    const hit = segment(x, z, o) < R;
    if (hit && Number.isNaN(from)) from = u;
    if (!hit && !Number.isNaN(from)) block(from, u - DU), from = NaN;
  }
  if (!Number.isNaN(from)) block(from, -lo);
}

function segment(x: number, z: number, o: Log) {
  const dx = o.x1 - o.x0;
  const dz = o.z1 - o.z0;
  const t = Math.max(0, Math.min(1, ((x - o.x0) * dx + (z - o.z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - o.x0 - dx * t, z - o.z0 - dz * t);
}

/** The river at arc length s, between its samples. */
function sampleAt(course: Course, s: number) {
  const a = course.at(Math.floor(s));
  const b = course.at(Math.floor(s) + 1);
  const f = s - Math.floor(s);
  const mix = (m: number, n: number) => m + (n - m) * f;
  return { x: mix(a.x, b.x), z: mix(a.z, b.z), a: mix(a.a, b.a), width: mix(a.width, b.width), speed: mix(a.speed, b.speed) } as Sample;
}

function widest(row: Uint8Array) {
  let best = 0;
  let run = 0;
  for (let j = 0; j < CELLS; j++) {
    run = row[j] ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best * DU;
}

function fail(course: Course, s: number, start: number, seed: number, free: Uint8Array): Failure {
  const st = course.stretchAt(s);
  return { seed, s: s - start, where: st.name ? `${st.name} (${st.kind})` : st.kind, heat: course.at(s).heat, widest: widest(free) };
}

function describe(river: RiverDef, f: Failure) {
  const room = f.widest > 0 ? `the widest clear water there ${f.widest.toFixed(1)} m` : 'no clear water at all';
  return `seed ${f.seed}: ${f.s.toFixed(0)} m down, in ${f.where}, heat ${f.heat.toFixed(2)}; ${room}  ?river=${river.id}&seed=${f.seed}`;
}

// --- odds and ends ----------------------------------------------------------------------

function parse(argv: string[]) {
  const out: Record<string, string | undefined> & { verbose?: string; holes?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--(\w+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[2] !== undefined) out[m[1]] = m[2];
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[m[1]] = argv[++i];
    else out[m[1]] = '1';
  }
  return out;
}

function pad(s: string, n: number) {
  return s.padEnd(n);
}

