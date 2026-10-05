import { RIVERS } from '../../src/island/river/rivers';
import { clear, make, sampleAt, uOf, CELLS } from './shared';
const [id, seed, at] = process.argv.slice(2);
const { course, start } = make(Number(seed), RIVERS.find((r) => r.id === id)!);
const s = start + Number(at);
const p = sampleAt(course, s);
const f = clear(course, s, false, 0.1);
let spans = '', was = -1;
for (let j = 0; j < CELLS; j++) { if (Math.abs(uOf(j)) > p.width / 2) continue; if (!f[j] && was < 0) was = j; if (f[j] && was >= 0) (spans += ` [${uOf(was).toFixed(2)},${uOf(j).toFixed(2)}]`), (was = -1); }
console.log('width', p.width.toFixed(2), 'blocked', spans);
for (const t of course.near(s - 25, s + 25) as any[]) if ('kind' in t && (t.kind === 'rock' || t.kind === 'log')) {
  const u = ((t.x ?? t.x1) - p.x) * Math.cos(p.a) + ((t.z ?? t.z1) - p.z) * Math.sin(p.a);
  console.log(t.kind, 's', (t.s - start).toFixed(1), 'u', u.toFixed(2), 'r', t.r, t.scenery ? 'scenery' : '', t.post ? 'post' : '');
}
