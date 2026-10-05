import * as THREE from 'three';
import type { RiverAssets } from '../../src/island/river/assets';
import { Kayak } from '../../src/island/river/kayak';
import { RIVERS } from '../../src/island/river/rivers';
import { make } from './shared';
import { PilotCamera, visibleEnd } from './visibility';
const aspect = Number(process.argv[2] ?? 16 / 9);
const byV = new Map<number, number[]>();
for (const river of RIVERS) {
  const secs: number[] = [];
  for (let seed = 1; seed <= 6; seed++) {
    const { course, start, finish } = make(seed, river);
    const k = new Kayak({ clone: () => new THREE.Group() } as unknown as RiverAssets);
    k.launch(course, start);
    const cam = new PilotCamera(aspect);
    for (let s = start; s < finish; s += 2) {
      k.launch(course, s);
      const sp = course.at(s).speed + 2.5;
      k.vel.set(Math.sin(k.heading), -Math.cos(k.heading)).multiplyScalar(sp);
      for (let i = 0; i < 3; i++) cam.update(course, k, 1);
      secs.push((visibleEnd(course, k, cam.camera) - s) / sp);
      const b = Math.round(sp); (byV.get(b) ?? byV.set(b, []).get(b)!).push(visibleEnd(course, k, cam.camera) - s);
    }
  }
  secs.sort((a, b) => a - b);
  const q = (f: number) => secs[Math.floor(f * (secs.length - 1))].toFixed(2);
  console.log(river.id.padEnd(8), 'seconds visible ahead: min', q(0), 'p5', q(0.05), 'p25', q(0.25), 'median', q(0.5));
}

for (const [v, m] of [...byV].sort((a, b) => a[0] - b[0])) { m.sort((a, b) => a - b); if (m.length > 30) console.log(`v ${v}: metres min ${m[0]} p1 ${m[Math.floor(m.length * 0.01)]} p5 ${m[Math.floor(m.length * 0.05)]} median ${m[m.length >> 1]} (${m.length})`); }
