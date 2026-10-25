import * as THREE from 'three';
import { herNight, hourOf, nightly } from './bedtime';
import { onTheDay } from './calendar';
import { pressGrass } from './grass';
import type { Island } from './island';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The weather and the hour, as far as a night out under canvas goes. */
export interface CampWorld {
  time: number; // the island's time (sky.ts)
  night: number; // 0..1: the Sky's lamps
  rain: number; // 0..1
  storm?: number; // 0..1
  wind: number; // m/s
  temperature: number; // °C
  camera?: THREE.Camera; // to pitch it and strike it while nobody's looking
}

/** How many of the nights fit for it they spend out (the rest, it's the hut as ever). */
const CHANCE = 0.45;
/** From late afternoon on a camping night the tent's up, till late the next morning. */
const PITCHED = 16.5;
const STRUCK = 11;
/** Seconds he lies reading by the lantern when he comes in, if she's asleep already. */
const SETTLING = 150;

const preview = (() => {
  try {
    return new URLSearchParams(location.search).has('camp');
  } catch {
    return false;
  }
})();

/**
 * A night out in the tent on the headland past the campfire (camping.py): on a warm, dry, still
 * summer night (May to September), now and then, the two of them sleep out instead of up at the hut.
 * It goes up in the late afternoon and stays up till the next morning's late. She goes in first,
 * with a book by the lantern (the canvas glows with it) while he's still out by the fire; he comes
 * along later, and the light goes out once they're both asleep. Whether a night's a camping night is
 * settled once, when its evening comes, on the weather as it is then (?camp: tonight, whatever the
 * weather).
 */
export class Camp {
  readonly root?: THREE.Object3D;
  private parts = new Map<string, THREE.Object3D>();
  private light = new THREE.PointLight('#ffb35c', 0, 5, 1.6);
  /** Who's in it. */
  readonly in = new Set<'vincent' | 'companion'>();
  /** Tonight's answer, settled once a night (noon to noon), and for which night. */
  private decided: { key: number; on: boolean } | null = null;
  private settling = 0;
  private lit = 0;
  private clock = 0;
  private frustum = new THREE.Frustum();
  private sphere = new THREE.Sphere(V(), 2.2);
  private matrix = new THREE.Matrix4();

  constructor(island: Island) {
    this.root = island.get('camp');
    for (const name of ['camp_canvas', 'camp_canvas_lit', 'camp_inside', 'camp_inside_lit', 'camp_door', 'camp_door_lit', 'camp_flaps']) {
      const o = this.root?.getObjectByName(name);
      if (o) this.parts.set(name, o);
    }
    if (this.root) {
      this.root.visible = false;
      this.light.position.set(0, 0.75, 0.55); // the lantern, hung from the ridge inside the door
      this.root.add(this.light);
    }
  }

  /** Just outside the door, on the grass: where they come and go. */
  get doorstep() {
    return this.root?.localToWorld(V(0, 0, 1.3));
  }

  /** Whether it's up just now. */
  get up() {
    return !!this.root?.visible;
  }

  /** Whether the lantern's on inside. */
  get glowing() {
    return this.lit > 0.5;
  }

  /** Whether tonight's a night out under canvas (settled once, as its evening comes). */
  tonight(w: CampWorld) {
    const key = Math.floor(nightly(w.time, 11) * 1e9);
    if (this.decided?.key === key) return this.decided.on;
    const hour = hourOf(w.time);
    if (hour >= STRUCK && hour < PITCHED && !preview) return false; // nothing settled yet: it's still the day
    const month = onTheDay(w.time - 12 * 3600e3).getMonth();
    const warm = w.temperature >= (hour >= 22 || hour < 6 ? 12 : 15);
    const fit = month >= 4 && month <= 8 && warm && w.rain < 0.05 && (w.storm ?? 0) < 0.1 && w.wind < 9;
    this.decided = { key, on: preview || (fit && nightly(w.time, 12) < CHANCE) };
    return this.decided.on;
  }

  /** Whether they'd go to bed in it, as things are now: it's a camping night, and not pouring down. */
  bedtime(w: CampWorld) {
    return this.tonight(w) && (this.in.size > 0 || (w.rain < 0.3 && (w.storm ?? 0) < 0.2));
  }

  set(who: 'vincent' | 'companion', on: boolean) {
    if (on && !this.in.has(who) && who === 'vincent') this.settling = SETTLING;
    if (on) this.in.add(who);
    else this.in.delete(who);
  }

  update(dt: number, w: CampWorld) {
    const root = this.root;
    if (!root) return;
    this.clock += dt;
    const hour = hourOf(w.time);
    // up from the late afternoon of a camping night till late the next morning (or while anyone's
    // in it); it goes up and comes down while nobody's looking
    const wanted = this.in.size > 0 || ((hour >= PITCHED || hour < STRUCK || preview) && this.tonight(w));
    if (wanted !== root.visible && (!this.seen(w) || preview || !this.clock)) {
      root.visible = wanted;
      if (wanted) {
        root.updateWorldMatrix(true, false);
        const box = new THREE.Box3();
        for (const [x, z] of [[-0.95, -1.15], [0.95, -1.15], [-0.95, 1.15], [0.95, 1.15]]) box.expandByPoint(root.localToWorld(V(x, 0, z)));
        const half = box.getSize(V()).multiplyScalar(0.5);
        pressGrass('camp', box.getCenter(V()), new THREE.Vector2(half.x, half.z));
      } else pressGrass('camp', null);
    }
    if (!root.visible) return;
    // the lantern: on while she reads, and a while after he's come in; out once they're asleep
    this.settling = Math.max(0, this.settling - dt);
    const reading = this.in.has('companion') && herNight(w.time) === 'reading';
    const on = this.in.size > 0 && w.night > 0.3 && (reading || (this.in.has('vincent') && this.settling > 0));
    this.lit = THREE.MathUtils.damp(this.lit, on ? 1 : 0, 3, dt);
    const show = (name: string, v: boolean) => {
      const o = this.parts.get(name);
      if (o) o.visible = v;
    };
    const glow = this.lit > 0.5;
    const shut = this.in.size > 0; // zipped up, with anyone in it
    show('camp_canvas', !(glow && shut));
    show('camp_canvas_lit', glow && shut);
    show('camp_inside', !glow);
    show('camp_inside_lit', glow);
    show('camp_door', shut && !glow);
    show('camp_door_lit', shut && glow);
    show('camp_flaps', !shut);
    this.light.intensity = this.lit * (2.2 + Math.sin(this.clock * 9) * 0.08 + Math.sin(this.clock * 23) * 0.05) * w.night;
  }

  private seen(w: CampWorld) {
    if (!w.camera || !this.root) return false;
    this.matrix.multiplyMatrices(w.camera.projectionMatrix, w.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    this.root.getWorldPosition(this.sphere.center).y += 0.6;
    return this.frustum.intersectsSphere(this.sphere);
  }
}
