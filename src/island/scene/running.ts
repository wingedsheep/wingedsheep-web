import * as THREE from 'three';
import type { Ground } from './beike';
import type { Island } from './island';
import { heightBetween, type Waypoint } from './shelter';
import type { Ways } from './ways';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const smooth = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1);

const PACE = 2.6; // m/s: an easy run, not a race
const CADENCE = 0.74; // seconds for a full stride, left and right
const THIGH = 0.42; // hip to knee, knee to sole (running.py)
const SHIN = 0.42;
const CHANGE: [number, number] = [6, 10]; // seconds in the hut, getting changed
const STRETCH = 4; // seconds for each leg's stretch
const JOG = 3; // seconds on the spot before he's off
const BLOWING = 6; // seconds bent over at the end, getting his breath back
/** The hut's door (Blender x, y): where he gets changed, and sets off from (vincent.ts DOORS). */
export const RUN_FROM: [number, number] = [13.6, 14.5];
/** The plaza, out in the open: where he stretches first, and gets his breath back after. */
const PLAZA: [number, number] = [0, -8];
/**
 * Round the island from the plaza (Blender x, y), joined up along the ways (ways.ts): past the
 * campfire to the east shore, west along the beach past the pier, out to the lighthouse point, and
 * back by the library.
 */
const LAP: [number, number][] = [PLAZA, [21, -6], [27.4, -9], [21, -16.4], [13, -16], [5, -14.8], [0.2, -15.8], [-3.4, -15.4], [-7, -13.4],
  [-16, -13.4], [-20.5, -12.2], [-25.2, -5.2], [-20, -5.5], [-11, -7.2], PLAZA];

export type Running = 'changing' | 'stretching' | 'running' | 'blowing' | 'done';

/**
 * Vincent out for a run (running.py `vincent_run`): in at the hut to get changed, out again in his
 * running things and down to the plaza for a stretch (a quad each side, then on the spot), a lap
 * or two round the island at an easy pace, and back at the plaza, hands on his knees, getting his
 * breath back before he jogs home. After dark the head torch goes on.
 */
export class Runner {
  readonly root?: THREE.Object3D;
  private parts = new Map<string, THREE.Object3D>();
  doing: Running = 'done';
  /** Laps done, and how many he's out for. */
  lap = 0;
  laps = 1;
  private way: Waypoint[] = [];
  private leg = 1;
  private along = 0;
  private t = 0;
  private stride = 0;
  private heading = 0;
  private start = V();
  private lapLength = 0;
  /** Down from the hut, round the island, and home again: the way for each, and which he's on. */
  private ways3: Record<'out' | 'lap' | 'home', Waypoint[]> = { out: [], lap: [], home: [] };
  private stage: 'out' | 'lap' | 'home' = 'out';

  constructor(
    island: Island,
    private ground: Ground,
    private ways: Ways,
  ) {
    this.start = V(RUN_FROM[0], ground.at(RUN_FROM[0], -RUN_FROM[1]), -RUN_FROM[1]);
    this.root = island.get('vincent_run');
    this.root?.traverse((o) => this.parts.set(o.name, o));
    if (this.root) this.root.visible = false;
  }

  set visible(on: boolean) {
    if (this.root) this.root.visible = on && this.doing !== 'changing' && this.doing !== 'done';
  }

  get head() {
    return this.part('head');
  }

  get busy() {
    return this.doing !== 'done';
  }

  /** How far round he is, 0..1 a lap. */
  get round() {
    let d = this.along;
    for (let i = 1; i < this.leg; i++) d += this.way[i - 1].at.distanceTo(this.way[i].at);
    return this.lapLength ? d / this.lapLength : 0;
  }

  private part(name: string) {
    return this.parts.get(`run_${name}`);
  }

  /** In to get changed, and out for a run (`laps` times round). */
  begin(laps = Math.random() < 0.6 ? 1 : 2) {
    const on = ([x, y]: [number, number]): Waypoint => ({ at: V(x, this.ground.at(x, -y), -y), fixed: false });
    const along = (pts: [number, number][]) => {
      const stops = pts.map(on).filter((w) => !Number.isNaN(w.at.y));
      const way: Waypoint[] = [stops[0]];
      for (let i = 1; i < stops.length; i++) {
        const bit = this.ways.between(way[way.length - 1], stops[i]);
        if (bit) way.push(...bit.slice(1));
      }
      return way.filter((w, i) => i === 0 || w.at.distanceTo(way[i - 1].at) > 0.05);
    };
    this.start = on(RUN_FROM).at;
    this.ways3 = { out: along([RUN_FROM, PLAZA]), lap: along(LAP), home: along([PLAZA, RUN_FROM]) };
    this.lapLength = this.ways3.lap.slice(1).reduce((sum, w, i) => sum + w.at.distanceTo(this.ways3.lap[i].at), 0);
    this.onto('out');
    const w = this.way;
    if (w.length > 1) this.heading = Math.atan2(w[1].at.x - w[0].at.x, w[1].at.z - w[0].at.z);
    Object.assign(this, { doing: 'changing', lap: 0, laps, t: rand(...CHANGE) });
    if (this.root) this.root.visible = false;
  }

  /** Onto the start of a stage (he turns to face along it as he goes). */
  private onto(stage: 'out' | 'lap' | 'home') {
    this.stage = stage;
    this.way = this.ways3[stage];
    Object.assign(this, { leg: 1, along: 0 });
  }

  /** Straight off: no changing, no stretching (a preview, or settling where he'd be by now). */
  midway() {
    this.begin(2);
    this.onto('lap');
    const w = this.way;
    if (w.length > 1) this.heading = Math.atan2(w[1].at.x - w[0].at.x, w[1].at.z - w[0].at.z);
    this.doing = 'running';
    const k = Math.random() * 0.8;
    let d = this.lapLength * k;
    while (this.leg < this.way.length - 1 && d > this.way[this.leg - 1].at.distanceTo(this.way[this.leg].at)) {
      d -= this.way[this.leg - 1].at.distanceTo(this.way[this.leg].at);
      this.leg++;
    }
    this.along = d;
    this.update(0, 0);
  }

  /** One frame of it (0 holds him where he is); `night` 0..1 puts the torch on. */
  update(dt: number, night: number) {
    const root = this.root;
    if (!root || this.way.length < 2) return;
    const torch = this.part('torch');
    if (torch) torch.visible = night > 0.35;
    if (this.doing === 'changing') {
      root.visible = false;
      if ((this.t -= dt) < 0) Object.assign(this, { doing: 'running', t: 0 }); // and down to the plaza
      return;
    }
    if (this.doing === 'done') {
      root.visible = false;
      return;
    }
    root.visible = true;
    this.t += dt;
    if (this.doing === 'stretching' && this.t > STRETCH * 2 + JOG) {
      Object.assign(this, { doing: 'running', t: 0 });
      this.onto('lap');
    }
    if (this.doing === 'blowing' && this.t > BLOWING) {
      Object.assign(this, { doing: 'running', t: 0 }); // and home
      this.onto('home');
    }
    const at = V();
    let heading = this.heading;
    if (this.doing === 'running') {
      this.along += PACE * dt;
      for (;;) {
        const len = this.way[this.leg - 1].at.distanceTo(this.way[this.leg].at);
        if (this.along < len) break;
        this.along -= len;
        if (++this.leg >= this.way.length) {
          // at the plaza: a stretch first; round again, or his breath back; home, and in
          const stage = this.stage;
          if (stage === 'lap' && ++this.lap < this.laps) {
            this.onto('lap');
            continue;
          }
          Object.assign(this, { leg: this.way.length - 1, doing: stage === 'out' ? 'stretching' : stage === 'lap' ? 'blowing' : 'done', t: 0 });
          this.along = this.way[this.leg - 1].at.distanceTo(this.way[this.leg].at);
          break;
        }
      }
    }
    if (this.doing !== 'stretching' || this.way.length > 1) {
      const a = this.way[this.leg - 1];
      const b = this.way[this.leg];
      const len = Math.max(1e-3, a.at.distanceTo(b.at));
      at.lerpVectors(a.at, b.at, Math.min(1, this.along / len));
      const h = heightBetween(a, b, at, this.ground);
      if (!Number.isNaN(h)) at.y = h;
      if (this.doing === 'running') heading = Math.atan2(b.at.x - a.at.x, b.at.z - a.at.z);
    } else at.copy(this.start);
    if ((this.doing as Running) === 'done') {
      root.visible = false; // in at the hut
      return;
    }
    const turn = Math.atan2(Math.sin(heading - this.heading), Math.cos(heading - this.heading));
    this.heading += dt ? turn * (1 - Math.exp(-6 * dt)) : turn;
    this.pose(at, dt);
  }

  /** Each joint, for what he's doing: a stretch, the stride, or bent double at the end. */
  private pose(at: THREE.Vector3, dt: number) {
    const root = this.root!;
    const j = {
      legL: 0, legR: 0, shinL: 0, shinR: 0, lean: 0, twist: 0, armL: 0, armR: 0, foreL: 0, foreR: 0, outL: 0, outR: 0, head: 0, flight: 0,
    };
    const t = this.t;
    if (this.doing === 'running' || (this.doing === 'stretching' && t > STRETCH * 2)) {
      // the stride: the back foot kicks up behind as it comes through, the arms pump against
      // the legs, bent at the elbow, and he leans into it
      const onTheSpot = this.doing === 'stretching';
      const k = onTheSpot ? 0.45 : 1;
      this.stride += (dt / CADENCE) * Math.PI * 2;
      const s = this.stride;
      for (const [side, p] of [['L', s], ['R', s + Math.PI]] as const) {
        j[`leg${side}`] = (-0.15 - 0.72 * Math.sin(p)) * k;
        j[`shin${side}`] = 0.25 + 1.45 * Math.max(0, Math.cos(p + 0.45)) ** 1.5 * k;
        j[`arm${side}`] = 0.12 + 0.62 * Math.sin(p) * k;
        j[`fore${side}`] = -1.45 - 0.25 * Math.max(0, -Math.sin(p)) * k;
      }
      j.outL = 0.1;
      j.outR = -0.1;
      j.lean = onTheSpot ? 0.06 : 0.17;
      j.twist = Math.sin(s) * 0.08 * k;
      j.head = -0.12 + (onTheSpot ? 0.06 : 0);
      j.flight = 0.05 * Math.abs(Math.sin(s)) * k;
    } else if (this.doing === 'stretching') {
      // a quad stretch: a heel up behind him in one hand, the other arm out for balance
      const side = t < STRETCH ? 'L' : 'R';
      const other = side === 'L' ? 'R' : 'L';
      const u = t % STRETCH;
      const k = smooth(Math.min(u / 0.8, (STRETCH - u) / 0.6));
      j[`leg${side}`] = 0.12 * k;
      j[`shin${side}`] = 2.55 * k;
      j[`arm${side}`] = 0.75 * k;
      j[`fore${side}`] = -0.15 * k;
      j[`out${other}`] = (other === 'L' ? 1 : -1) * 0.55 * k;
      j[`arm${other}`] = -0.15 * k;
      j.outL += side === 'L' ? 0.12 * k : 0;
      j.outR -= side === 'R' ? 0.12 * k : 0;
      j.lean = 0.05 * k;
      j.head = -0.05 + Math.sin(t * 0.7) * 0.03;
    } else {
      // hands on his knees, breathing hard, then slower, and up straight again
      const k = smooth(Math.min(t / 0.6, (BLOWING - t) / 0.9));
      const breath = Math.sin(t * (9 - t * 0.8)) * 0.05 * (1 - t / BLOWING);
      j.legL = j.legR = -0.35 * k;
      j.shinL = j.shinR = 0.55 * k;
      j.lean = 0.85 * k + breath;
      j.armL = j.armR = -0.55 * k;
      j.foreL = j.foreR = -0.25 * k;
      j.outL = 0.05;
      j.outR = -0.05;
      j.head = -0.6 * k - breath;
    }
    // down onto the lower of the two feet, so it stays on the ground
    const foot = (a: number, b: number) => Math.cos(a) * THIGH + Math.cos(a + b) * SHIN;
    const drop = THIGH + SHIN - Math.max(foot(j.legL, j.shinL), foot(j.legR, j.shinR));
    root.position.copy(at);
    root.position.y += j.flight - drop;
    root.rotation.set(0, this.heading, 0);
    this.part('leg_l')?.rotation.set(j.legL, 0, 0);
    this.part('leg_r')?.rotation.set(j.legR, 0, 0);
    this.part('shin_l')?.rotation.set(j.shinL, 0, 0);
    this.part('shin_r')?.rotation.set(j.shinR, 0, 0);
    this.part('torso')?.rotation.set(j.lean, j.twist, 0);
    this.part('arm_l')?.rotation.set(j.armL, 0, j.outL);
    this.part('arm_r')?.rotation.set(j.armR, 0, j.outR);
    this.part('fore_l')?.rotation.set(j.foreL, 0, 0);
    this.part('fore_r')?.rotation.set(j.foreR, 0, 0);
    // the head stays level: what the torso leans, it takes back (most of)
    this.part('head')?.rotation.set(j.head - j.lean * 0.6, -j.twist, 0);
  }

  /** Where he is now (for the camera's view, and for clicking). */
  get position() {
    return this.root?.visible ? this.root.position : this.start;
  }
}
