// scratch: what's in the river between two points (m from the push-off)
import { RIVERS } from '../../src/island/river/rivers';
import { make } from './shared';
const [id, seedS, a, b] = process.argv.slice(2);
const { course, start } = make(Number(seedS), RIVERS.find((r) => r.id === id)!);
for (let s = start + Number(a); s <= start + Number(b); s += 4) {
  const p = course.at(Math.round(s)); const st = course.stretchAt(s);
  console.log(`${(s - start).toFixed(0).padStart(5)} w ${p.width.toFixed(1)} speed ${p.speed.toFixed(1)} bend ${p.bend.toFixed(3)} ${st.kind}${st.big ? ' big' : ''} heat ${p.heat.toFixed(2)}${p.isle ? ` isle ${p.isleU.toFixed(1)}±${p.isle.toFixed(1)}` : ''}`);
}
const u = (x: number, z: number, s: number) => { const p = course.at(Math.round(s)); return (x - p.x) * Math.cos(p.a) + (z - p.z) * Math.sin(p.a); };
for (const t of course.near(start + Number(a), start + Number(b)) as any[]) {
  if (t.kind === 'rock') console.log(`  rock s ${(t.s - start).toFixed(1)} u ${u(t.x, t.z, t.s).toFixed(2)} r ${t.r.toFixed(2)}${t.post ? ' post' : ''}`);
  else if (t.kind === 'log') console.log(`  log s ${(t.s - start).toFixed(1)} u ${u(t.x0, t.z0, t.s).toFixed(2)} → ${u(t.x1, t.z1, t.s).toFixed(2)}`);
  else if (t.kind === 'hole' || t.kind === 'ledge') console.log(`  ${t.kind} s ${(t.s - start).toFixed(1)}`);
}
for (const m of course.line) if (m.s > start + Number(a) && m.s < start + Number(b)) console.log(`  line ${(m.s - start).toFixed(1)} u ${m.u.toFixed(2)} ${m.piece}`);
