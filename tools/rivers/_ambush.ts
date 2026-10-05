// scratch prototype: can a paddler who only sees what the camera shows be led into a dead end?
import * as THREE from 'three';
import type { RiverAssets } from '../../src/island/river/assets';
import { Course } from '../../src/island/river/course';
// tag each obstacle with the generator code that put it there
const add = Course.prototype.addObstacle;
Course.prototype.addObstacle = function (o) {
  const st = (new Error().stack ?? '').split('\n').slice(2, 6).map((l) => l.trim().split(' ')[1]).filter((f) => f && !f.startsWith('Course.addObstacle'));
  (o as any).src = st.slice(0, 2).join('<');
  return add.call(this, o);
};
import { Kayak } from '../../src/island/river/kayak';
import { RIVERS } from '../../src/island/river/rivers';
import { BANK, CELLS, DS, DU, cell, clear, make, sampleAt, uOf } from './shared';
import { PilotCamera, visibleEnd } from './visibility';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const FERRY = Number(args.ferry ?? 1.5);
const MARGIN = Number(args.margin ?? 0.1);
const REACT = Number(args.react ?? 0.5);
const SEEDS = Number(args.seeds ?? 24);
const ASPECT = Number(args.aspect ?? 16 / 9);

function dil(r: Uint8Array, free: Uint8Array, k: number, lo: number, hi: number) {
  const out = new Uint8Array(CELLS);
  let run = -1;
  for (let j = lo; j <= hi; j++) {
    if (!free[j]) run = -1; else if (r[j]) run = 0; else if (run >= 0) run++;
    if (run >= 0 && run <= k) out[j] = 1;
  }
  run = -1;
  for (let j = hi; j >= lo; j--) {
    if (!free[j]) run = -1; else if (r[j]) run = 0; else if (run >= 0) run++;
    if (run >= 0 && run <= k) out[j] = 1;
  }
  return out;
}

export function ambushes(course: Course, start: number, finish: number) {
  const n = Math.floor((finish - start) / DS) + 1;
  const free: Uint8Array[] = [], ks: number[] = [], lo: number[] = [], hi: number[] = [], ends: number[] = [];
  // banks and islands are soft (they shove you back into the water): where a place off the water ends up
  const to: Int32Array[] = [];
  const raw: Uint8Array[] = Array.from({ length: n }, () => new Uint8Array(CELLS));
  const k = new Kayak({ clone: () => new THREE.Group() } as unknown as RiverAssets);
  const cam = new PilotCamera(ASPECT);
  for (let i = 0; i < n; i++) {
    const s = start + i * DS;
    const p = sampleAt(course, s);
    free.push(clear(course, s, false, MARGIN));
    // (a boat's no point: open here only if it's open half a metre up and down the river as well)
    if (i >= 2) for (let j = 0; j < CELLS; j++) raw[i - 1][j] = free[i - 2][j] & free[i - 1][j] & free[i][j];
    ks.push(Math.floor((FERRY * DS) / Math.max(0.5, p.speed) / DU));
    lo.push(Math.max(0, cell(-p.width / 2 - 1)));
    hi.push(Math.min(CELLS - 1, cell(p.width / 2 + 1)));
    const half = p.width / 2 - BANK;
    const isle = course.at(s);
    const m = new Int32Array(CELLS).fill(-1);
    for (let j = lo[i]; j <= hi[i]; j++) {
      let u = Math.max(-half, Math.min(half, uOf(j)));
      if (isle.isle > 0 && Math.abs(u - isle.isleU) < isle.isle + BANK) u = isle.isleU + (Math.sign(u - isle.isleU) || 1) * (isle.isle + BANK + DU);
      const q = Math.max(lo[i], Math.min(hi[i], u < 0 ? Math.ceil((u + 30) / DU - 1e-6) : Math.floor((u + 30) / DU + 1e-6)));
      m[j] = q;
    }
    to.push(m);
  }
  // one slice back: where in slice i it can still get to `nextOk` in slice i+1 from
  const back = (nextOk: Uint8Array, i: number) => {
    const ext = new Uint8Array(CELLS);
    for (let j = lo[i]; j <= hi[i]; j++) {
      const q = j >= lo[i + 1] && j <= hi[i + 1] ? to[i + 1][j] : j < lo[i + 1] ? to[i + 1][lo[i + 1]] : to[i + 1][hi[i + 1]];
      ext[j] = nextOk[q] & free[i][j];
    }
    const d = dil(ext, free[i], ks[i], lo[i], hi[i]);
    for (let j = lo[i]; j <= hi[i]; j++) d[j] &= free[i][j];
    return d;
  };
  // one slice on: where it can be in slice i+1 from `here` in slice i
  const on = (here: Uint8Array, i: number) => {
    const d = dil(here, free[i], ks[i], lo[i], hi[i]);
    const out = new Uint8Array(CELLS);
    for (let j = lo[i]; j <= hi[i]; j++) {
      if (!d[j]) continue;
      const q = j >= lo[i + 1] && j <= hi[i + 1] ? to[i + 1][j] : j < lo[i + 1] ? to[i + 1][lo[i + 1]] : to[i + 1][hi[i + 1]];
      if (free[i + 1][q]) out[q] = 1;
    }
    return out;
  };
  for (let i = 1; i < n - 1; i++) free[i] = raw[i];
  // what's in view: from where the boat was a reaction time ago
  for (let i = 0; i < n; i++) {
    const s = start + i * DS;
    const v = course.at(s).speed + 2.5;
    const from = Math.max(start, s - REACT * v);
    k.launch(course, from);
    k.vel.set(Math.sin(k.heading), -Math.cos(k.heading)).multiplyScalar(v);
    for (let q = 0; q < 3; q++) cam.update(course, k, 1);
    ends.push(Math.min(n - 1, Math.max(i, Math.floor((visibleEnd(course, k, cam.camera) - start) / DS))));
  }
  // where it can still get down from, knowing everything
  const down: Uint8Array[] = new Array(n);
  down[n - 1] = free[n - 1];
  for (let i = n - 2; i >= 0; i--) down[i] = back(down[i + 1], i);
  // forward: only places that look passable through what's in view
  let R = new Uint8Array(CELLS);
  R[cell(0)] = 1;
  const found: { s: number; u: number; dies: number; seen: number; what?: string }[] = [];
  // the doomed places already told of (carried down the river): a new report only for new ones
  let known = new Uint8Array(CELLS);
  for (let i = 0; i < n - 1; i++) {
    // passable to the end of the view?
    const e = ends[i];
    let w = free[e];
    for (let q = e - 1; q >= i; q--) w = back(w, q);
    let any = false;
    // (and, with --bankpad, not riding right along a bank by choice)
    const pad = Number(args.bankpad ?? 0), hw = sampleAt(course, start + i * DS).width / 2 - BANK - pad;
    for (let j = lo[i]; j <= hi[i]; j++) if ((R[j] &= w[j]) && pad && Math.abs(uOf(j)) > hw) R[j] = 0;
    for (let j = lo[i]; j <= hi[i]; j++) if (R[j]) any = true;
    if (!any) { found.push({ s: i * DS, u: NaN, dies: i * DS, seen: (e - i) * DS }); break; }
    // a place it could be that looks fine, but isn't
    let bad = -1;
    for (let j = lo[i]; j <= hi[i]; j++) if (R[j] && !down[i][j] && !known[j]) { bad = j; break; }
    for (let j = lo[i]; j <= hi[i]; j++) if (R[j] && !down[i][j]) known[j] = 1;
    if (bad >= 0) {
      // follow the doomed places down until they run out
      let D = new Uint8Array(CELLS);
      for (let j = lo[i]; j <= hi[i]; j++) D[j] = R[j] & (down[i][j] ^ 1);
      let q = i;
      for (; q < n - 1; q++) {
        const d = on(D, q);
        if (!d.some((x) => x)) break;
        D = d;
      }
      // what closes it off: the nearest thing to where the doomed water runs out
      let uu = 0, m = 0;
      for (let j = lo[q]; j <= hi[q]; j++) if (D[j]) (uu += uOf(j)), m++;
      uu /= Math.max(1, m);
      const sq = start + q * DS, p = sampleAt(course, sq);
      const x = p.x + Math.cos(p.a) * uu, z = p.z + Math.sin(p.a) * uu;
      let what = 'bank', best = 1.5 + (p.width / 2 - Math.abs(uu));
      for (const t of course.near(sq - 3, sq + 6) as any[]) {
        const d = t.kind === 'rock' ? Math.hypot(t.x - x, t.z - z) - t.r : t.kind === 'log' ? Math.min(Math.hypot(t.x1 - x, t.z1 - z), Math.hypot(t.x0 - x, t.z0 - z)) - 1 : Infinity;
        if (d < best) (best = d), (what = `${t.kind} ${t.src ?? ''}`);
      }
      if (course.at(sq).isle > 0 && Math.abs(uu - course.at(sq).isleU) < course.at(sq).isle + 1.5) what = 'island';
      found.push({ s: i * DS, u: uOf(bad), dies: q * DS, seen: (e - i) * DS, what });
    }
    if (args.map) {
      const [m0, m1] = args.map.split(':').map(Number);
      if (i * DS >= m0 && i * DS <= m1 && (i % 2 === 0 || args.fine)) {
        let row = '';
        const W = 8, half = 15;
        for (let j = cell(-half); j < cell(half); j += W) {
          let o = false, x = false, f = false, b = false;
          for (let q = j; q < j + W; q++) (o ||= !!(R[q] && down[i][q])), (x ||= !!(R[q] && !down[i][q])), (f ||= !!free[i][q]), (b ||= Math.abs(uOf(q)) < sampleAt(course, start + i * DS).width / 2);
          row += x ? 'x' : o ? 'o' : f ? '.' : b ? '#' : ' ';
        }
        console.log(`${(i * DS).toFixed(1).padStart(7)} sees ${((e - i) * DS).toFixed(0).padStart(2)} |${row}|`);
      }
    }
    // and on to the next slice
    // (what's doomed only spreads to what's doomed: a dead end's water is all dead end)
    const kn = on(known, i);
    R = on(R, i);
    known = new Uint8Array(CELLS);
    for (let j = lo[i + 1]; j <= hi[i + 1]; j++) known[j] = kn[j] & (down[i + 1][j] ^ 1);
  }
  return found;
}

for (const river of args.river ? RIVERS.filter((r) => r.id === args.river) : RIVERS) {
  let total = 0;
  const lines: string[] = [];
  const kinds = new Map<string, number>();
  for (let seed = args.seed ? Number(args.seed) : 1; seed <= (args.seed ? Number(args.seed) : SEEDS); seed++) {
    const { course, start, finish } = make(seed, river);
    for (const a of ambushes(course, start, finish)) {
      total++;
      const st = course.stretchAt(start + a.dies);
      const piece = course.line.filter((b) => b.s <= start + a.dies + 2).pop();
      const where = `[${a.what}] ${st.kind}${piece && start + a.dies - piece.s < 25 && piece.piece !== 'rest' ? `: ${piece.piece}` : ''}${course.splitAt(start + a.dies) ? ' (island)' : ''}`;
      kinds.set(where, (kinds.get(where) ?? 0) + 1);
      lines.push(`    seed ${seed}: looks fine at ${a.s.toFixed(0)} m (u ${a.u.toFixed(1)}, seeing ${a.seen.toFixed(0)} m), dead end at ${a.dies.toFixed(0)} m in ${where}`);
    }
  }
  console.log(`${river.id.padEnd(8)} ${total} dead ends you can't see coming  ${[...kinds].map(([k, v]) => `${k} ×${v}`).join(', ')}`);
  if (args.verbose) lines.forEach((l) => console.log(l));
}
