import * as THREE from 'three';
import { Critters, type Air, type Habitat } from '../scene/critters';
import { windDir } from '../scene/grass';
import { Particles } from '../scene/particles';
import { season } from '../scene/season';
import { windStrength } from '../scene/weather';
import type { Course } from './course';
import type { Land } from './land';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// as on the island (ambience.ts): green-gold first, then red and orange, the last ones brown
const FIRST_LEAVES = ['#c9b04a', '#d4ae40', '#9aa848', '#e08a3a', '#b8c25a'];
const FALLING = ['#a0392c', '#c04e30', '#cc622c', '#e08a3a', '#d4ae40', '#e9cf66'];
const LAST_LEAVES = ['#8c5a3c', '#6e4a32', '#a07a52', '#b0643a'];
const DRIP = '#cfe0ee';
const DIM = new THREE.Color();
const dim = (hex: string, night: number) => DIM.set(hex).multiplyScalar(1 - night * 0.55).clone();

/**
 * The island's small life in the air, out along the river too, by the same rules: leaves coming
 * off the bankside trees in autumn (dropping straight on a still day, blown off across the water
 * in a wind), the trees dripping after rain, and the critters (scene/critters.ts): bees and
 * butterflies at the wild flowers on the banks, dragonflies low over the water by the edge, moths
 * round the cottages' lamps and the camps' lanterns, midges over the flowers on a summer evening.
 */
export class RiverAir {
  private motes = new Particles(700);
  private critters: Critters;
  private land?: Land;
  private course?: Course;
  /** 1 while it's raining, running down to 0 a couple of minutes after it stops. */
  private soaked = 0;
  private clock = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.motes.points);
    this.critters = new Critters(scene, this.habitat());
  }

  /** A new river: its banks and its water. */
  reset(land: Land, course: Course) {
    this.land = land;
    this.course = course;
  }

  /** `around`: just ahead of the kayak, where you're looking; `view`: how much of the river you see. */
  update(dt: number, air: Air, around: THREE.Vector3, view: number) {
    this.clock += dt;
    this.motes.update(dt);
    this.critters.update(dt, air, around, view);
    const land = this.land;
    if (!land) return;
    const size = Math.max(20, view * 1.1);
    const night = air.night;
    const { x: dx, y: dz } = windDir.value;
    const windiness = windStrength(air.wind);
    const near = [...land.trees()].filter((c) => Math.abs(c.position.x - around.x) < size && Math.abs(c.position.z - around.z) < size);

    // autumn: every tree near you letting its leaves go, carried off downwind as hard as it's blowing
    const shedding = season.turn * (1 - season.fall) + season.fall * (1 - season.fall);
    const blow = air.wind * 0.55 * (1 + air.gust * 0.6);
    this.motes.wind.set(blow * dx, air.gust * 1.4 * (0.4 + 0.6 * Math.max(0, Math.sin(this.clock * 0.9))), blow * dz);
    const colours = season.fall < 0.3 ? FIRST_LEAVES : season.fall < 0.7 ? FALLING : LAST_LEAVES;
    this.spawn(dt, near.length * shedding * (0.6 + windiness * 1.2) * (1 + air.gust * 2), () => {
      const c = pick(near);
      const top = c.position.clone().add(V(rand(-1, 1), rand(-0.3, 0.5), rand(-1, 1)).multiplyScalar(c.radius));
      const ground = land.heightAt(top.x, top.z);
      const sink = rand(0.45, 0.75);
      this.motes.emit({
        position: top,
        velocity: V(rand(-0.2, 0.2), -sink, rand(-0.2, 0.2)),
        color: dim(pick(colours), night),
        life: Math.min(14, (Math.max(0.5, top.y - ground) / sink) * (1 + windiness)),
        size: 1,
        span: rand(0.2, 0.28), // as big as the ones lying on the ground (scene/litter.ts)
        leaf: windiness,
        fadeIn: 0.08,
        hold: 0.9, // whole all the way down, not fading as it falls
        floor: ground,
        windy: 1.2 + windiness * 1.5,
        sink,
      });
    });

    // after the rain the trees go on dripping a while, less and less
    this.soaked = air.wet > 0.15 ? 1 : Math.max(0, this.soaked - dt / 150);
    const leafy = 0.3 + season.leafOut * (1 - season.fall) * 0.7;
    this.spawn(dt, air.wet < 0.05 ? this.soaked * near.length * 0.4 * leafy : 0, () => {
      const c = pick(near);
      const from = c.position.clone().add(V(rand(-0.8, 0.8) * c.radius, -c.radius * 0.4, rand(-0.8, 0.8) * c.radius));
      const fall = Math.max(0.2, from.y - land.heightAt(from.x, from.z));
      this.motes.emit({
        position: from,
        velocity: V(0, -1, 0),
        color: dim(DRIP, night),
        life: Math.sqrt(fall / 4.9),
        gravity: -9.8,
        fadeIn: 0,
        hold: 0.8,
      });
    });
  }

  private spawn(dt: number, rate: number, make: () => void) {
    const count = rate * dt;
    const whole = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0);
    for (let i = 0; i < whole; i++) make();
  }

  /** The river as a place to live: whatever banks and water it has right now. */
  private habitat(): Habitat {
    return {
      changing: true, // the banks are built ahead of you and taken down behind
      blooms: () => (this.land ? [...this.land.blooms()] : []),
      lamps: (around, size) => {
        if (!this.land) return [];
        const out: THREE.Vector3[] = [];
        for (const g of this.land.lamps()) {
          const at = g.getWorldPosition(V());
          if (at.distanceTo(around) < size) out.push(at);
        }
        return out;
      },
      water: (around, size) => {
        const course = this.course;
        if (!course) return null;
        // somewhere along the river near you, a metre or two off one bank or the other
        const s = course.nearest(around.x, around.z).sample.s + rand(-size, size) * 0.8;
        const p = course.along(s);
        const u = (Math.random() < 0.5 ? -1 : 1) * Math.max(0, p.width / 2 - rand(0.6, 2.2));
        return V(p.x + Math.cos(p.a) * u, p.y, p.z + Math.sin(p.a) * u);
      },
    };
  }
}
