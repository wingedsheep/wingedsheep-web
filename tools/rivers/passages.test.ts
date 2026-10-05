/** The hard rivers must leave their authored main and alternate passages clear of real rock shapes. */
import assert from 'node:assert/strict';
import { Course, type Rock, type Sample } from '../../src/island/river/course';
import { gap, HIT, reach } from '../../src/island/river/outline';
import { RIVERS } from '../../src/island/river/rivers';
import { make } from './shared';
import { planLine } from './pilot';

type Lane = { u: number; half: number };
type Placement = { passageRock(o: Rock, p: Sample, lanes: Lane[]): void };
const proto = Course.prototype as unknown as Placement;
const place = proto.passageRock;
let checked = 0, corrected = 0;
proto.passageRock = function (this: Course, o, p, lanes) {
  const before = { x: o.x, z: o.z, r: o.r, s: o.s };
  place.call(this, o, p, lanes);
  if (this.profile.grade < 4) return;
  assert.equal(o.r, before.r, 'keep the obstacle size');
  assert.equal(o.s, before.s, 'keep the beat spacing');
  const rx = Math.cos(p.a), rz = Math.sin(p.a);
  const u = (o.x - p.x) * rx + (o.z - p.z) * rz;
  for (const lane of lanes) {
    assert(Math.abs(u - lane.u) - reach(o, rx, rz) * HIT >= lane.half - 1e-8, 'full waterline intrudes into a promised passage');
    // Check independently against the collision routine at several points along the opening.
    for (let v = lane.u - lane.half; v <= lane.u + lane.half; v += 0.1) {
      assert(gap(o, p.x + rx * v, p.z + rz * v).d >= -1e-7, 'collision inside the passage');
    }
  }
  checked++;
  if (o.x !== before.x || o.z !== before.z) corrected++;
};
try {
  for (const river of RIVERS.filter((r) => r.grade >= 4)) {
    for (let seed = 1; seed <= 100; seed++) make(seed, river);
  }
} finally {
  proto.passageRock = place;
}
assert(checked > 1000 && corrected > 0, 'exercise real generated rocks and corrections');
console.log(`Passage checks passed: ${checked} rocks in 200 hard courses (${corrected} corrected).`);

// Also check connected routes with bow and stern clearance. Never accept the planner's
// centre-only fallback as evidence that a whole kayak fits. This is a geometry check;
// the camera-limited gameplay replays separately exercise steering and landings.
for (const river of RIVERS.filter((r) => r.grade >= 4)) {
  for (let seed = 1; seed <= 24; seed++) {
    const { course, start, finish } = make(seed, river);
    const plan = planLine(course, start, finish, 0, false, true);
    assert(plan.chart?.hull, `${river.id} seed ${seed}: no full-hull route at ${plan.stuckAt - start} m`);
  }
}
console.log('Full-hull routes passed: 48 hard courses.');
