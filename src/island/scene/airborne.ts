import * as THREE from 'three';
import { occasions } from './calendar';
import type { Island } from './island';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const LANE = 28; // world z: out to sea off the south-east shore (behind the island the camera can't see)
const REACH = 120; // from one side to the other
const HEIGHT = 14;
const SPEED = 7; // m/s: an old Dakota, not in a hurry
const STICK = 9; // parachutes in a stick
const FALL = 0.85; // m/s under the canopy

const WANTED = (() => {
  try {
    return new URLSearchParams(location.search).has('airborne');
  } catch {
    return false;
  }
})();

interface Chute {
  o: THREE.Object3D;
  drift: number;
  phase: number;
  landed: number; // seconds since touching the water, or -1
}

/**
 * The Airborne commemoration, on the heath above Arnhem, the third Saturday of September: every
 * year the old Dakotas fly over again, and a stick of parachutists jumps, in memory of September
 * 1944. On the island it's far off and quiet: now and then through the day an old plane crosses
 * low over the sea off the south-east shore, and a line of round canopies opens behind it and
 * comes slowly down to the water. No sound reaches the island; you just have to look up.
 */
export class Airborne {
  private plane?: THREE.Object3D;
  private template?: THREE.Object3D;
  private chutes: Chute[] = [];
  private x = 0;
  private dir = 1;
  private flying = false;
  private dropped = 0;
  private dropFrom = 0;
  private wait = WANTED ? 3 : rand(20, 90);
  private clock = 0;

  constructor(
    private scene: THREE.Scene,
    island: Island,
  ) {
    if (!occasions.has('airborne')) return;
    this.plane = island.get('dakota');
    this.template = island.get('parachute');
    if (this.plane) this.plane.visible = false;
    if (this.template) this.template.visible = false;
  }

  /** `hour`: island time, 0..24; `rain`, `wind` (m/s): nobody jumps in a storm. */
  update(dt: number, hour: number, rain: number, wind: number) {
    const plane = this.plane;
    if (!plane || !this.template) return;
    this.clock += dt;
    const flyable = (hour >= 10 && hour < 17.5 && rain < 0.3 && wind < 13) || WANTED;
    if (!this.flying && flyable && (this.wait -= dt) < 0) {
      this.flying = true;
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.x = -this.dir * REACH;
      this.dropped = 0;
      this.dropFrom = this.dir > 0 ? 16 : 45; // over the open water east of the pier, either way
      plane.visible = true;
    }
    if (this.flying) {
      this.x += this.dir * SPEED * dt;
      plane.position.set(this.x, HEIGHT + Math.sin(this.clock * 0.7) * 0.2, LANE);
      // the model's nose is to its -x (holidays.py): it faces the way it's going
      plane.rotation.set(Math.sin(this.clock * 0.9) * 0.03, this.dir > 0 ? Math.PI : 0, 0);
      // over the drop zone, one after another out of the door
      while (this.dropped < STICK && (this.x - this.dropFrom) * this.dir > this.dropped * 3.2) {
        this.jump(V(this.x + this.dir * 0.8, HEIGHT - 0.6, LANE + rand(-0.3, 0.3)));
        this.dropped++;
      }
      if (Math.abs(this.x) > REACH) {
        this.flying = false;
        plane.visible = false;
        this.wait = WANTED ? 25 : rand(240, 480);
      }
    }
    for (const c of this.chutes) {
      const o = c.o;
      if (c.landed >= 0) {
        // down in the water: the canopy settles over them and goes
        c.landed += dt;
        o.scale.setScalar(Math.max(0.001, 1 - c.landed / 3));
        o.position.y -= dt * 0.2;
        continue;
      }
      // it opens a moment after they jump, then they swing gently down, drifting with the wind
      const age = this.clock - c.phase;
      const open = Math.min(1, Math.max(0.15, (age - 0.6) / 0.8));
      o.scale.set(open, Math.min(1, 0.4 + open * 0.6), open);
      o.position.y -= (age < 1 ? 4 : FALL) * dt;
      o.position.x += c.drift * dt;
      o.rotation.set(Math.sin(this.clock * 0.8 + c.phase) * 0.12, 0, Math.cos(this.clock * 0.6 + c.phase) * 0.1);
      if (o.position.y < 0.4) c.landed = 0;
    }
    this.chutes = this.chutes.filter((c) => {
      if (c.landed < 3) return true;
      this.scene.remove(c.o);
      return false;
    });
  }

  private jump(at: THREE.Vector3) {
    const o = this.template!.clone(true);
    o.visible = true;
    o.position.copy(at);
    o.scale.setScalar(0.15);
    this.scene.add(o);
    this.chutes.push({ o, drift: rand(0.3, 0.7), phase: this.clock, landed: -1 });
  }
}
