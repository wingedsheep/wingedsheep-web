import { RIVERS } from '../../src/island/river/rivers';
import { make } from './shared';
const [id, seed, a, b] = process.argv.slice(2);
const { course, start } = make(Number(seed), RIVERS.find((r) => r.id === id)!);
for (const x of course.splits) if (x.s1 > start + Number(a) && x.s0 < start + Number(b)) console.log(JSON.stringify({ ...x, s0: x.s0 - start, s1: x.s1 - start }));
for (let s = start + Number(a); s <= start + Number(b); s += 1) { const p = course.at(s); if (p.isle > 0) console.log((s - start).toFixed(0), 'w', p.width.toFixed(1), 'isle', p.isleU.toFixed(2), '±', p.isle.toFixed(2), 'left channel', (p.isleU - p.isle + p.width / 2).toFixed(2), 'right', (p.width / 2 - p.isleU - p.isle).toFixed(2)); }
