/** The pilot's observations: a camera-bounded prefix, frozen while it tries moves. */
import * as THREE from 'three';
import type { Course } from '../../src/island/river/course';
import type { Kayak } from '../../src/island/river/kayak';

/** Headless equivalent of game.ts's follow camera, without shake or wildlife glances. */
export class PilotCamera {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 350);
  private yaw = NaN;
  private zoom = 1;
  constructor(private aspect = 16 / 9) {}
  update(course: Course, k: Kayak, dt: number) {
    const elevation = 48 * Math.PI / 180;
    const ahead = course.at(k.s + 10 + Math.min(12, k.speed * 1.2));
    this.yaw = Number.isNaN(this.yaw) ? ahead.a : this.yaw + (ahead.a - this.yaw) * (1 - Math.exp(-dt * 1.4));
    const fast = THREE.MathUtils.clamp((k.speed - 3) / 7, 0, 1);
    this.zoom += (1 + fast * 0.32 - this.zoom) * (1 - Math.exp(-dt * 1.2));
    const view = Math.max(22, Math.min(32, 20 / this.aspect + 9)) * this.zoom;
    const h = view / 2;
    Object.assign(this.camera, { left: -h * this.aspect, right: h * this.aspect, top: h, bottom: -h });
    this.camera.updateProjectionMatrix();
    const fx = Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const lead = view * (0.22 + fast * 0.08) / Math.sin(elevation);
    const target = new THREE.Vector3(k.pos.x + fx * lead, course.heightAt(k.s), k.pos.z + fz * lead);
    this.camera.position.set(target.x - fx * Math.cos(elevation) * 140, target.y + Math.sin(elevation) * 140, target.z - fz * Math.cos(elevation) * 140);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    return this.camera;
  }
}

/** Stop at the first slice whose navigable width leaves the frame (including bends and drops).
 * This is deliberately conservative: no seeing through an off-screen bend to a later slice.
 * It bounds geometry, not human recognition in darkness, spray or behind scenery.
 */
export function visibleEnd(course: Course, k: Kayak, camera: THREE.Camera) {
  const point = new THREE.Vector3();
  let end = Math.floor(k.s);
  for (let s = end + 1; s <= k.s + 100; s++) {
    const p = course.at(s);
    const half = Math.max(0, p.width / 2 - 0.55);
    const visible = [-half, 0, half].every((u) => {
      point.set(p.x + Math.cos(p.a) * u, p.y, p.z + Math.sin(p.a) * u).project(camera);
      return Math.abs(point.x) < 0.98 && Math.abs(point.y) < 0.98 && Math.abs(point.z) <= 1;
    });
    if (!visible) break;
    end = s;
  }
  return end;
}

/** Course methods run against truncated samples; bucket queries explicitly filter their spill.
 * The real kayak always uses the original course. Only the planner and its trial boats use this.
 */
export function observedCourse(course: Course, end: number): Course {
  const seen = Object.create(course) as Course;
  Object.defineProperty(seen, 'samples', { value: course.samples.filter((p) => p.s <= end) });
  seen.near = (a, b) => course.near(a, Math.min(b, end)).filter((t) => t.s <= end);
  return seen;
}
