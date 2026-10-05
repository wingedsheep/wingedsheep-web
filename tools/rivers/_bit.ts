// scratch: paddle one bit of one river with the camera-limited autopilot, and tell it as it goes
import * as THREE from 'three';
import type { RiverAssets } from '../../src/island/river/assets';
import { Kayak } from '../../src/island/river/kayak';
import { RIVERS } from '../../src/island/river/rivers';
import { DT, angle, autopilot, configure, mulberry } from './pilot';
import { make } from './shared';
const [id, seedS, fromS, toS, traceS] = process.argv.slice(2);
if (process.argv.includes('--omni')) configure({ omniscient: 1 });
const river = RIVERS.find((r) => r.id === id)!;
const seed = Number(seedS);
Math.random = mulberry(seed * 7919 + 1);
const { course, start, finish } = make(seed, river);
const from = start + Number(fromS), to = start + Number(toS);
const k = new Kayak({ clone: () => new THREE.Group() } as unknown as RiverAssets);
k.launch(course, from);
const auto = autopilot(course, k, from, Math.min(finish, to + 40));
let t = 0;
const sight: [number, number][] = [[0, auto.seen()]];
k.events = {
  hit: (v, at) => {
    const o = course.nearest(at.x, at.z, k.s);
    const ws = sight.find(([, e]) => e >= o.sample.s)?.[0] ?? t;
    const thing = course.near(k.s - 4, k.s + 4).filter((x: any) => x.kind === 'rock' || x.kind === 'log')
      .sort((a: any, b: any) => Math.hypot((a.x ?? a.x1) - at.x, (a.z ?? a.z1) - at.z) - Math.hypot((b.x ?? b.x1) - at.x, (b.z ?? b.z1) - at.z))[0] as any;
    console.log(`${t.toFixed(2)} s ${(k.s - start).toFixed(1)} m HIT ${v.toFixed(1)} ${thing?.kind} at u ${o.side.toFixed(2)} (s ${(o.sample.s - start).toFixed(1)}), in view ${(t - ws).toFixed(1)} s; boat u ${k.side.toFixed(2)} line ${auto.pilot.uAt(k.s).toFixed(2)} bow ${angle(k.heading - k.here.a).toFixed(2)} v ${k.speed.toFixed(1)} plan ${auto.plan.kind}`);
  },
  capsize: () => console.log(`${t.toFixed(2)} s ${(k.s - start).toFixed(1)} m CAPSIZE`),
  ledge: (how, h) => console.log(`${t.toFixed(2)} s ${(k.s - start).toFixed(1)} m ${how} off ${h.toFixed(1)}`),
  tumbler: () => console.log(`${t.toFixed(2)} s ${(k.s - start).toFixed(1)} m WASHING MACHINE`),
};
while (k.s < to && t < 120) {
  const i = auto.intent(DT);
  if (auto.seen() > sight[sight.length - 1][1]) sight.push([t, auto.seen()]);
  k.update(DT, i, course, true);
  t += DT;
  if (traceS && Math.round(t * 60) % 6 === 0 && Math.abs(k.s - start - Number(traceS)) < 25)
    console.log(`  ${(k.s - start).toFixed(1).padStart(7)} u ${k.side.toFixed(2).padStart(6)} line ${auto.pilot.uAt(k.s).toFixed(2).padStart(6)} hdg ${angle(k.heading - k.here.a).toFixed(2).padStart(5)} v ${k.speed.toFixed(1)}/${(k.here.speed + 2.5).toFixed(1)} see +${(auto.seen() - k.s).toFixed(0)} plan ${auto.plan.kind} move ${JSON.stringify(auto.pilot.move)}`);
}
console.log(`reached ${(k.s - start).toFixed(0)} m in ${t.toFixed(1)} s`);
