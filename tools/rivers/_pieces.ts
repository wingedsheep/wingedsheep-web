// scratch: per river and kind of set piece, how far the line moves between beats, against the time it has
import { RIVERS } from '../../src/island/river/rivers';
import { make } from './shared';
const stats: Record<string, Record<string, number[]>> = {};
for (const river of RIVERS) {
  for (let seed = 1; seed <= 40; seed++) {
    const { course } = make(seed, river);
    const line = course.line.filter((b) => b.piece !== 'rest');
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      if (a.piece !== b.piece || b.s - a.s > 40) continue;
      const v = course.at(b.s).speed + 2.5;
      const need = Math.abs(b.u - a.u) / ((b.s - a.s) / v); // m/s across
      ((stats[river.id] ??= {})[b.piece] ??= []).push(need);
    }
  }
}
for (const [r, kinds] of Object.entries(stats)) {
  console.log(r, Object.entries(kinds).map(([k, v]) => { v.sort((x, y) => x - y); return `${k} p50 ${v[v.length >> 1].toFixed(2)} max ${v[v.length - 1].toFixed(2)}`; }).join(' | '));
}
