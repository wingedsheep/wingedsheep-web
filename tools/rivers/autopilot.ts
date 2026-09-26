/**
 * A paddler that goes down every river for real: the game's own kayak (kayak.ts) on the game's own
 * river, stepped at 60 frames a second and driven only through what a player has, the Intent (strokes
 * left and right, reverse sweeps, lean, brace, sprint). Where validate.ts asks whether there's a
 * clear line at all, this asks whether a boat can actually be paddled down it: with its momentum,
 * the current shoving it about, the waves trying to tip it, the ledges to boof and the falls to tuck.
 *
 * It plans first: the same slices as the validator, the water a boat can be in and get to the
 * take-out from, and through it the line that keeps furthest from everything without swinging about
 * more than it has to, with room for the bow and the stern where it has to point across the current
 * to get over. Then it paddles that line: steering for a speed across the river that closes on it
 * (allowing for whatever the water's doing sideways), sweeping to turn (a reverse sweep when it's
 * badly off), leaning against the roll, bracing past the tipping point, sprinting through holes,
 * letting its strokes go so one catches at a ledge's lip, and tucking straight into a waterfall.
 *
 * And it reads the water ahead. Several times a second it tries what it's doing on a copy of the
 * boat, four seconds on; if that runs into anything it tries the other moves it has (steer either
 * side of the line, point across the current, ease off, drive on, back off) and takes the cleanest.
 * Knocked or pushed off its line, it plans a new one from where it is.
 *
 * A clean run is to the take-out with no knock (a hit hard enough that the game breaks your flow),
 * no capsize and no bad landing. The seeds are 1, 2, 3…, so a river that goes wrong is one you can
 * paddle yourself: ?river=<id>&seed=<n>.
 *
 *   just autopilot                          12 seeds a river (a few minutes)
 *   just autopilot --seeds 100 --river black --verbose
 *   just autopilot --river coffee --seed 7   one run, told as it goes
 *   just autopilot --storm 1                 out in a storm (0..1): chop, and a wind across the river
 *
 * The runs are shared out over every core (--cores to say how many). It exits non-zero if any run
 * knocks, capsizes or doesn't get down.
 */

import { cpus } from 'node:os';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import * as THREE from 'three';
import type { RiverAssets } from '../../src/island/river/assets';
import type { Course, Log, Rock } from '../../src/island/river/course';
import { Kayak } from '../../src/island/river/kayak';
import { RIVERS, type RiverDef } from '../../src/island/river/rivers';
import { DT, S, angle, autopilot, configure, mulberry, segment } from './pilot';
import { make } from './shared';

const args = parse(process.argv.slice(2));
const SEEDS = Number(args.seeds ?? 12);
// any of the paddler's settings (pilot.ts's S), e.g. --gain 2 --horizon 3; --blind to paddle without foresight
configure({
  ...Object.fromEntries(Object.keys(S).filter((k) => args[k] !== undefined).map((k) => [k, Number(args[k])])),
  foresight: !args.blind,
});

interface Incident {
  t: number;
  at: number; // metres from the push-off
  what: string;
  where: string;
  /** Something that went wrong (a knock, a capsize, a bad landing, getting stuck), and in which bit of the river. */
  trouble: boolean;
  bit?: number;
}

/** A bit of the river, as it's made: a stretch of a kind, or one set piece in it. */
interface Bit {
  kind: string; // e.g. 'rapids', 'chute: slalom', 'falls'
  s0: number; // metres from the push-off
  s1: number;
}

interface Run {
  seed: number;
  finished: boolean;
  time: number;
  metres: number;
  knocks: number;
  bumps: number;
  capsizes: number;
  rolls: number;
  swam: boolean;
  bad: number; // bad landings
  braces: number;
  incidents: Incident[];
  /** Why it stopped short, if it did. */
  stopped?: string;
  plan: 'clean' | 'holes' | 'none';
  /** The bits of river it went down (see bits()). */
  bits: Bit[];
  /** How closely it held the line (m, root mean square). */
  rms: number;
}

const clean = (r: Run) => r.finished && !r.knocks && !r.capsizes && !r.bad;

// (at the bottom, once the Pilot's defined)
async function main() {
  if (!isMainThread) {
    // a worker: paddle each run it's handed, hand it back, and ask for another
    parentPort!.on('message', ([id, seed]: [string, number]) => parentPort!.postMessage(paddle(RIVERS.find((r) => r.id === id)!, seed, false)));
    return;
  }
  if (args.seed) {
    const river = RIVERS.find((r) => r.id === (args.river ?? 'black'))!;
    const run = paddle(river, Number(args.seed), true);
    console.log(`\n${summary(run)}`);
    process.exit(clean(run) ? 0 : 1);
  }

  const only = args.river ? RIVERS.filter((r) => r.id === args.river) : RIVERS;
  if (!only.length) {
    console.error(`no river called ${args.river}: ${RIVERS.map((r) => r.id).join(', ')}`);
    process.exit(2);
  }
  console.log(`${SEEDS} seeds a river, paddling at ${S.power}, a line that ferries at ${S.ferry} m/s with ${S.margin} m to spare\n`);
  console.log(pad('river', 12) + pad('clean', 8) + pad('knocked', 9) + pad('capsized', 10) + pad('swam', 6) + pad('landed', 8) + pad('short', 7) + pad('off', 7) + pad('knocks', 8) + pad('bumps', 7) + 'time');
  // every run on its own, handed out to the cores as they come free (the long rivers first)
  const jobs: [string, number][] = [...only].reverse().flatMap((r) => Array.from({ length: SEEDS }, (_, i) => [r.id, i + 1] as [string, number]));
  const cores = Math.max(1, Math.min(jobs.length, Number(args.cores ?? cpus().length)));
  const all = new Map<string, Run>();
  let handed = 0;
  await Promise.all(Array.from({ length: cores }, () => new Promise<void>((done, fail) => {
    const w = new Worker(new URL(import.meta.url), { argv: process.argv.slice(2) });
    let job: [string, number];
    const next = () => {
      if (handed >= jobs.length) return void w.terminate().then(() => done());
      w.postMessage((job = jobs[handed++]));
    };
    w.on('message', (r: Run) => {
      all.set(`${job[0]}/${r.seed}`, r);
      if (!args.verbose) process.stderr.write(`\r${all.size}/${jobs.length} runs`);
      next();
    });
    w.on('error', fail);
    next();
  })));
  if (!args.verbose) process.stderr.write('\r');
  let bad = 0;
  for (const river of only) {
    const runs: Run[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) runs.push(all.get(`${river.id}/${seed}`)!);
    const n = (f: (r: Run) => boolean) => runs.filter(f).length;
    const done = runs.filter((r) => r.finished);
    const time = done.length ? done.reduce((a, r) => a + r.time, 0) / done.length : NaN;
    console.log(
      pad(river.id, 12) + pad(`${n(clean)}`, 8) + pad(`${n((r) => r.knocks > 0)}`, 9) + pad(`${n((r) => r.capsizes > 0)}`, 10)
      + pad(`${n((r) => r.swam)}`, 6) + pad(`${n((r) => r.bad > 0)}`, 8) + pad(`${n((r) => !r.finished)}`, 7) + pad((runs.reduce((a, r) => a + r.rms, 0) / runs.length).toFixed(2), 7)
      + pad(`${runs.reduce((a, r) => a + r.knocks, 0)}`, 8) + pad((runs.reduce((a, r) => a + r.bumps, 0) / runs.length).toFixed(1), 7) + (Number.isNaN(time) ? '-' : `${time.toFixed(0)} s`),
    );
    const wrong = runs.filter((r) => !clean(r));
    for (const r of wrong.slice(0, args.verbose ? Infinity : 5)) console.log(`    ${summary(r, river)}`);
    if (wrong.length > 5 && !args.verbose) console.log(`    …and ${wrong.length - 5} more (--verbose)`);
    bad += wrong.length;
    trouble(runs, river);
  }
  process.exit(bad ? 1 : 0);
}

// --- one run ----------------------------------------------------------------------------

function paddle(river: RiverDef, seed: number, tell: boolean): Run {
  // the kayak's wobbles are Math.random(): the same seed, the same run
  Math.random = mulberry(seed * 7919 + 1);
  const { course, start, finish } = make(seed, river);
  const kayak = new Kayak({ clone: () => new THREE.Group() } as unknown as RiverAssets);
  kayak.launch(course, start);
  kayak.storm = Number(args.storm ?? 0);
  const auto = autopilot(course, kayak, start, finish);
  const { plan, pilot } = auto;
  const run: Run = {
    seed, finished: false, time: 0, metres: 0, knocks: 0, bumps: 0, capsizes: 0, rolls: 0, swam: false, bad: 0, braces: 0,
    incidents: [], plan: plan.kind, rms: 0, bits: bits(course, start, finish),
  };
  const note = (what: string, trouble = false) => {
    const st = course.stretchAt(kayak.s);
    const at = kayak.s - start;
    const i = run.bits.findIndex((b) => at >= b.s0 - 1 && at < b.s1 + 1);
    const where = (st.name ? `${st.name} (${i >= 0 ? run.bits[i].kind : st.kind})` : i >= 0 ? run.bits[i].kind : st.kind);
    const inc: Incident = { t: run.time, at, what, where, trouble, bit: i >= 0 ? i : undefined };
    run.incidents.push(inc);
    if (tell) console.log(`${inc.t.toFixed(1).padStart(6)} s ${inc.at.toFixed(0).padStart(5)} m  ${what}, in ${inc.where}`);
  };
  kayak.events = {
    hit: (strength, at) => {
      run.knocks++;
      // what it hit, where that is across the river, and how the boat was lying
      const o = course.nearest(at.x, at.z, kayak.s);
      const what = course.near(kayak.s - 4, kayak.s + 4).filter((t) => 'kind' in t && (t.kind === 'rock' || t.kind === 'log'))
        .sort((a, b) => dist(a, at) - dist(b, at))[0] as Rock | Log | undefined;
      const detail = args.seed ? ` ${what?.kind ?? '?'}${what?.kind === 'rock' ? ` r ${what.r.toFixed(2)}${what.post ? ' post' : ''}` : ''} at u ${o.side.toFixed(1)}, s ${(o.sample.s - kayak.s).toFixed(1)} from the boat; the boat at u ${kayak.side.toFixed(1)}, line ${pilot.uAt(kayak.s).toFixed(1)}, bow ${angle(kayak.heading - kayak.here.a).toFixed(2)}` : '';
      note(`knocked (${strength.toFixed(1)}, ${(kayak.side - pilot.uAt(kayak.s)).toFixed(1)} m off the line)${detail}`, true);
    },
    bump: (strength) => { if (strength > 0.6) run.bumps++; },
    capsize: () => (run.capsizes++, note('capsized', true)),
    rolled: () => (run.rolls++, note('rolled up')),
    swim: () => (run.swam = true, note('swimming')),
    brace: (perfect) => (run.braces++, tell && note(perfect ? 'perfect brace' : 'brace')),
    ledge: (how, height) => {
      if (how === 'flat' || how === 'skew' || how === 'pencil') run.bad++;
      if (tell || how === 'flat' || how === 'skew' || how === 'pencil') note(`${how} off a ${height.toFixed(1)} m drop`, how === 'flat' || how === 'skew' || how === 'pencil');
    },
    hole: (stuck) => { if (stuck) note('stuck in a hole'); },
  };
  if (plan.kind === 'none') {
    run.stopped = `no line through, ${(plan.stuckAt - start).toFixed(0)} m down`;
    return run;
  }
  let best = start;
  let bestAt = 0;
  let sq = 0;
  let frames = 0;
  const limit = river.length / 0.8; // (a crawl: well under a metre a second)
  while (run.time < limit) {
    const intent = auto.intent(DT);
    kayak.update(DT, intent, course, true);
    run.time += DT;
    const off = kayak.side - pilot.uAt(kayak.s);
    (sq += off * off), frames++;
    if (args.trace && Math.round(run.time * 60) % 15 === 0 && Math.abs(kayak.s - start - Number(args.trace)) < 40) {
      console.log(`  ${(kayak.s - start).toFixed(1).padStart(7)} m  u ${kayak.side.toFixed(2).padStart(6)} line ${pilot.uAt(kayak.s).toFixed(2).padStart(6)}  hdg ${angle(kayak.heading - kayak.here.a).toFixed(2).padStart(5)}  v ${kayak.speed.toFixed(1)} water ${kayak.here.speed.toFixed(1)} w ${kayak.here.width.toFixed(1)}  L${intent.left.toFixed(1)} R${intent.right.toFixed(1)}${intent.tapLeft ? ' tapL' : ''}${intent.tapRight ? ' tapR' : ''}`);
    }
    if (kayak.s > best + 1) (best = kayak.s), (bestAt = run.time);
    if (kayak.s - start >= river.length) {
      run.finished = true;
      break;
    }
    if (kayak.balance === 'swimming') break;
    if (run.time - bestAt > 20) {
      run.stopped = `going nowhere, ${(kayak.s - start).toFixed(0)} m down`;
      note('going nowhere', true);
      break;
    }
  }
  if (!run.finished && !run.stopped && !run.swam) run.stopped = 'out of time';
  run.metres = Math.min(river.length, kayak.s - start);
  run.rms = Math.sqrt(sq / Math.max(1, frames));
  return run;
}

function summary(r: Run, river?: RiverDef) {
  const bits: string[] = [];
  if (r.finished) bits.push(`down in ${r.time.toFixed(0)} s`);
  else bits.push(r.swam ? `swam, ${r.metres.toFixed(0)} m down` : r.stopped ?? 'short');
  if (r.knocks) bits.push(`${r.knocks} knock${r.knocks > 1 ? 's' : ''}`);
  if (r.capsizes) bits.push(`${r.capsizes} capsize${r.capsizes > 1 ? 's' : ''} (${r.rolls} rolled up)`);
  if (r.bad) bits.push(`${r.bad} bad landing${r.bad > 1 ? 's' : ''}`);
  if (r.braces) bits.push(`${r.braces} brace${r.braces > 1 ? 's' : ''}`);
  if (r.plan === 'holes') bits.push('(the only line goes through a hole)');
  const first = r.incidents.find((i) => i.what !== 'rolled up' && !i.what.includes('brace'));
  const at = first ? `; first: ${first.what} ${first.at.toFixed(0)} m down, in ${first.where}` : '';
  return `seed ${r.seed}: ${bits.join(', ')}${at}${river ? `  ?river=${river.id}&seed=${r.seed}` : ''}`;
}

/**
 * Where it goes wrong, over all the seeds: for each kind of bit of river (a rapid, a slalom in a
 * chute, a waterfall…), how many of them it paddled and in how many something went wrong. A bit that
 * goes wrong often is one to look at: too tight, too fast, or laid out so it can't be read in time.
 */
function trouble(runs: Run[], river: RiverDef) {
  const tally = new Map<string, { seen: number; hit: number; events: number; example?: string }>();
  for (const r of runs) {
    const hurt = new Map<number, number>();
    const first = new Map<number, Incident>();
    for (const inc of r.incidents) {
      if (!inc.trouble || inc.bit === undefined) continue;
      hurt.set(inc.bit, (hurt.get(inc.bit) ?? 0) + 1);
      if (!first.has(inc.bit)) first.set(inc.bit, inc);
    }
    r.bits.forEach((b, i) => {
      const t = tally.get(b.kind) ?? { seen: 0, hit: 0, events: 0 };
      t.seen++;
      const n = hurt.get(i) ?? 0;
      if (n) {
        t.hit++;
        t.events += n;
        t.example ??= `?river=${river.id}&seed=${r.seed} (${first.get(i)!.what.split(' (')[0]} ${first.get(i)!.at.toFixed(0)} m down)`;
      }
      tally.set(b.kind, t);
    });
  }
  const rows = [...tally].filter(([, t]) => t.hit).sort((a, b) => b[1].hit / b[1].seen - a[1].hit / a[1].seen);
  if (!rows.length) return;
  console.log('    where it goes wrong:');
  for (const [kind, t] of rows.slice(0, args.verbose ? Infinity : 6)) {
    const rate = `${t.hit} of ${t.seen} (${Math.round((100 * t.hit) / t.seen)}%)`;
    console.log(`      ${pad(kind, 22)} ${pad(rate, 16)} ${pad(`${t.events} time${t.events > 1 ? 's' : ''}`, 10)} e.g. ${t.example}`);
  }
}

/**
 * The river from the push-off to the take-out, in bits: each stretch (a pool, a run, a rapid, a
 * cascade…), except that a stretch with set pieces is its set pieces (and the water between them),
 * and each drop is a bit of its own: a ledge, or a waterfall.
 */
function bits(course: Course, start: number, finish: number): Bit[] {
  const out: Bit[] = [];
  for (const st of course.stretches) {
    if (st.end < start || st.start > finish) continue;
    const s0 = Math.max(st.start, start) - start;
    const s1 = Math.min(st.end, finish) - start;
    // its set pieces, one bit for each run of beats of the same piece
    const beats = course.line.filter((b) => b.s >= st.start && b.s < st.end && b.s >= start && b.s < finish);
    let from = s0;
    let piece: string | null = null;
    for (const b of beats) {
      const name = b.piece === 'rest' ? null : b.piece;
      if (name === piece) continue;
      const at = b.s - start;
      if (at > from) out.push({ kind: piece ? `${st.kind}: ${piece}` : st.kind, s0: from, s1: at });
      (from = at), (piece = name);
    }
    out.push({ kind: piece ? `${st.kind}: ${piece}` : st.kind, s0: from, s1 });
    // below a waterfall, its run-out (the waves and the white water) apart from the flat above it
    if (st.runout !== undefined && st.runout < finish) out.unshift({ kind: 'falls: run-out', s0: st.runout - start, s1 });
  }
  // the drops, over whatever they're in
  for (const t of course.near(start, finish)) {
    if (!('kind' in t) || t.kind !== 'ledge' || t.s < start || t.s > finish) continue;
    const at = t.s - start;
    out.unshift({ kind: t.height >= 3 ? 'waterfall' : 'ledge', s0: at - 3, s1: at + 12 });
  }
  return out;
}

// --- odds and ends ----------------------------------------------------------------------

function dist(t: Rock | Log | object, at: { x: number; z: number }) {
  const o = t as Rock | Log;
  return o.kind === 'rock' ? Math.hypot(o.x - at.x, o.z - at.z) - o.r : segment(at.x, at.z, o);
}

function parse(argv: string[]) {
  const out: Record<string, string | undefined> & { verbose?: string } = {};
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

main();
