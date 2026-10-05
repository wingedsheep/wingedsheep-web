// scratch: how far across can the real kayak get in t seconds, from going straight down the river
import * as THREE from 'three';
import type { RiverAssets } from '../../src/island/river/assets';
import { NEUTRAL } from '../../src/island/river/controls';
import { Kayak } from '../../src/island/river/kayak';
import { RIVERS } from '../../src/island/river/rivers';
import { angle, mulberry } from './pilot';
import { make } from './shared';
Math.random = mulberry(1);
for (const id of ['tumble', 'black', 'coffee']) {
  const river = RIVERS.find((r) => r.id === id)!;
  const { course, start } = make(3, river);
  // straight stretches of each kind, fast and slow
  const out: Record<string, number[][]> = {};
  for (let s = start + 60; s < start + river.length - 60; s += 37) {
    const st = course.stretchAt(s);
    const p = course.at(s);
    if (Math.abs(p.bend) > 0.006 || p.isle > 0 || course.ledges.some((l) => Math.abs(l.s - s) < 40)) continue;
    let best = [0, 0, 0];
    for (const hold of [0.4, 0.6, 0.8, 1.0, 1.2]) {
      const k = new Kayak({ clone: () => new THREE.Group() } as unknown as RiverAssets);
      k.launch(course, s);
      k.vel.set(Math.sin(p.a), -Math.cos(p.a)).multiplyScalar(p.speed + 1.5);
      const u0 = k.side;
      const res = [0, 0, 0];
      let t = 0;
      for (let f = 0; f < 150; f++) {
        // steer for the bow held `hold` rad to the right of downstream, paddling hard; sweeps to turn
        const err = angle(k.here.a + hold - k.heading) - k.yawRate * 0.28;
        const i = { ...NEUTRAL, sprint: true };
        if (Math.abs(err) < 0.2) i.left = i.right = 1; else if (err > 0) i.left = 1; else i.right = 1;
        i.lean = Math.max(-1, Math.min(1, -k.tilt * 1.6));
        k.events = {};
        k.update(1 / 60, i, course, true);
        t += 1 / 60;
        if (f === 89) res[0] = k.side - u0;
        if (f === 119) res[1] = k.side - u0;
        if (f === 149) res[2] = k.side - u0;
      }
      if (res[1] > best[1]) best = res;
    }
    (out[`${st.kind} ${Math.round(p.speed)}`] ??= []).push(best);
  }
  for (const [k, v] of Object.entries(out)) {
    const m = (i: number) => (v.reduce((a, b) => a + b[i], 0) / v.length).toFixed(1);
    console.log(id, k.padEnd(12), `across in 1.5 s ${m(0)} m, 2 s ${m(1)} m, 2.5 s ${m(2)} m (${v.length})`);
  }
}
