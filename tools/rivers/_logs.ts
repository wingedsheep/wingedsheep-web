// scratch: how far the logs reach in from the bank (m from the shove line), by river, strainer beat and fallen trees
import { RIVERS } from '../../src/island/river/rivers';
import { make } from './shared';
for (const river of RIVERS) {
  const beats: number[][] = [];
  const lone: number[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const { course, start, finish } = make(seed, river);
    for (const o of course.obstacles) {
      if (o.kind !== 'log' || o.s < start || o.s > finish) continue;
      const p = course.at(Math.round(o.s));
      const u = (o.x1 - p.x) * Math.cos(p.a) + (o.z1 - p.z) * Math.sin(p.a);
      const out = p.width / 2 - 0.55 - Math.abs(u);
      const set = course.sets.find((q) => q.kind === 'strainers' && o.s >= q.s0 - 1 && o.s <= q.s1 + 1);
      if (!set) { lone.push(out); continue; }
      const k = course.line.filter((b) => b.piece === 'strainers' && b.s >= set.s0 && b.s < o.s - 0.5).length;
      (beats[Math.min(k, 4)] ??= []).push(out);
    }
  }
  const avg = (a?: number[]) => a?.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : ' - ';
  console.log(river.id.padEnd(8), 'strainer beats 0..4+:', beats.map((b) => avg(b)).join(' '), ' lone trees:', avg(lone), `(${lone.length})`);
}
