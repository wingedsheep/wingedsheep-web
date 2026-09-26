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

import type { Course } from '../../src/island/river/course';
import { RIVERS, type RiverDef } from '../../src/island/river/rivers';
import { CELLS, DS, DU, cell, clear as clearAt, dilate, make, sampleAt, uOf, widest } from './shared';

const args = parse(process.argv.slice(2));
const SEEDS = Number(args.seeds ?? 200);
/** How fast (m/s) a boat can slide across the river while it's carried down it. */
const FERRY = Number(args.ferry ?? 2);
/** Room to spare (m) past the hull, for a line you could actually hold. */
const MARGIN = Number(args.margin ?? 0.1);
const clear = (course: Course, s: number, holes: boolean) => clearAt(course, s, holes, MARGIN);

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

