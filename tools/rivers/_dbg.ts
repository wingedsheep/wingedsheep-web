import { Course } from '../../src/island/river/course';
import { reach, HIT } from '../../src/island/river/outline';
import { RIVERS } from '../../src/island/river/rivers';
import { make } from './shared';
const proto = Course.prototype as any;
const orig = proto.passageRock;
let start = 0;
proto.passageRock = function (o: any, p: any, lanes: any, file = true) {
  const rx = Math.cos(p.a), rz = Math.sin(p.a);
  const from = (o.x - p.x) * rx + (o.z - p.z) * rz;
  orig.call(this, o, p, lanes, file);
  const to = (o.x - p.x) * rx + (o.z - p.z) * rz;
  if (Math.abs(o.s - start - 1249.5) < 1.5) console.log('rock', (o.s - start).toFixed(1), 'from', from.toFixed(2), 'to', to.toFixed(2), 'half', (p.width / 2).toFixed(2), 'ext', (reach(o, rx, rz) * HIT).toFixed(2), 'lanes', JSON.stringify(lanes.map((l: any) => [+l.u.toFixed(2), +l.half.toFixed(2)])), 'sharp', o.sharp);
};
const river = RIVERS.find((r) => r.id === 'drop')!;
start = (make as any) && 0;
const { start: st } = make(56, river);
start = st;
make(56, river);
