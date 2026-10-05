import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Kayak } from '../../src/island/river/kayak';
import type { RiverAssets } from '../../src/island/river/assets';
import { RIVERS } from '../../src/island/river/rivers';
import { autopilot, configure, DT } from './pilot';
import { make } from './shared';
import { observedCourse, PilotCamera, visibleEnd } from './visibility';

const { course, start, finish } = make(2, RIVERS[5]);
const boat = () => {
  const k = new Kayak({ clone: () => new THREE.Group() } as unknown as RiverAssets);
  k.launch(course, start);
  return k;
};
const k = boat();
const camera = new PilotCamera().update(course, k, DT);
const end = visibleEnd(course, k, camera);
assert(end > start + 5 && end < start + 50, `unexpected camera horizon: ${end - start}`);
const seen = observedCourse(course, end);
assert(seen.samples.every((p) => p.s <= end));
assert(seen.near(0, finish).every((t) => t.s <= end));
assert.equal(seen.at(finish).s, end);
assert.equal(seen.heightAt(finish), seen.at(end).y);
assert(seen.nearest(course.at(end + 10).x, course.at(end + 10).z, end + 10).sample.s <= end);

// Two different futures outside an identical camera must produce the same route AND controls.
const changed = Object.create(course) as typeof course;
Object.defineProperty(changed, 'samples', { value: course.samples.map((p) => p.s <= end ? p : { ...p, width: 1, speed: 30, isle: 8, y: p.y - 50 }) });
changed.near = (a, b) => [...course.near(a, b), { kind: 'rock', s: end + 1, x: course.at(end).x, z: course.at(end).z, r: 20, variant: 0 }];
configure({ omniscient: 0 });
const a = autopilot(course, boat(), start, finish, () => camera);
const b = autopilot(changed, boat(), start, finish, () => camera);
assert.deepEqual(a.plan.chart?.line, b.plan.chart?.line);
for (let i = 0; i < 24; i++) assert.deepEqual(a.intent(), b.intent());
assert(a.plan.chart && a.plan.chart.start + (a.plan.chart.n - 1) * 0.5 <= end);
console.log(`Visibility checks passed (initial view: ${end - start} m).`);
