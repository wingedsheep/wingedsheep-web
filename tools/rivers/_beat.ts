import { RIVERS } from '../../src/island/river/rivers';
import { make } from './shared';
import { readFileSync } from 'node:fs';
let river = '';
const tally: Record<string, number> = {};
for (const l of readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (/^[a-z]/.test(l)) { river = l.split(' ')[0]; continue; }
  const m = l.match(/seed (\d+): .*dead end at (\d+) m in \[log Course.piece/);
  if (!m) continue;
  const { course, start } = make(Number(m[1]), RIVERS.find((r) => r.id === river)!);
  const at = start + Number(m[2]);
  const set = course.sets.find((p) => at >= p.s0 - 5 && at <= p.s1 + 5);
  if (!set) { tally['?'] = (tally['?'] ?? 0) + 1; continue; }
  const marks = course.line.filter((b) => b.piece === set.kind && b.s >= set.s0 && b.s <= set.s1);
  const k = marks.findIndex((b) => b.s > at - 4);
  tally[`beat ${k}`] = (tally[`beat ${k}`] ?? 0) + 1;
  console.log(river, m[1], m[2], `beat ${k} of ${marks.length}`, `width ${course.at(at).width.toFixed(1)}`);
}
console.log(tally);
