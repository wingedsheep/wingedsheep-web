/** A clean landing can still leave the boat trapped: foresight must reject that approach. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { RiverAssets } from '../../src/island/river/assets';
import { Kayak } from '../../src/island/river/kayak';
import { RIVERS } from '../../src/island/river/rivers';
import { DT, Foresight, Pilot, mulberry } from './pilot';
import { make } from './shared';
import { observedCourse, PilotCamera, visibleEnd } from './visibility';

const coast = { bias: 0, power: 0, back: false };
const random = Math.random;
try {
  for (const [id, seed, at] of [['black', 2, 1001], ['coffee', 4, 1834]] as const) {
    const { course } = make(seed, RIVERS.find((r) => r.id === id)!);
    const ledge = course.ledges.find((l) => l.s === at);
    assert(ledge && ledge.height >= 3);
    const k = new Kayak({ clone: () => new THREE.Group() } as unknown as RiverAssets);
    k.launch(course, at - 1.5);
    const from = k.s;
    const camera = new PilotCamera().update(course, k, DT);
    const end = visibleEnd(course, k, camera);
    const seen = observedCourse(course, end);
    const pilot = new Pilot(seen, k, new Float32Array(200), from);
    const foresight = new Foresight(seen, k, pilot, from, end);
    // Inspect the assessment of this particular approach without changing the public pilot API.
    const assessment = (foresight as unknown as {
      cost(move: typeof coast): { safe: boolean };
    }).cost(coast);
    assert.equal(assessment.safe, false, `${id}: coasting into the washing machine is not safe`);
    assert.equal(k.s, from, 'a trial must leave the real boat alone');
    assert.equal(ledge.passed, false, 'a trial must restore the lip');

    // Verify why it is unsafe with the real physics, still entirely inside the frozen view.
    let washed = false, otherTrouble = false;
    k.events = {
      tumbler: () => { washed = true; },
      hit: () => { otherTrouble = true; },
      capsize: () => { otherTrouble = true; },
      ledge: (how) => { if (how === 'flat' || how === 'skew' || how === 'pencil') otherTrouble = true; },
    };
    pilot.move = coast;
    Math.random = mulberry(0);
    for (let f = 0; f < 240 && !washed && k.s + 4 < end; f++) k.update(DT, pilot.intent(DT), seen, true);
    assert(washed, `${id}: exercise a real washing-machine entry`);
    assert.equal(otherTrouble, false, 'the trap alone must make this approach unsafe');
  }
} finally {
  Math.random = random;
}
console.log('Foresight washing-machine regressions passed.');
