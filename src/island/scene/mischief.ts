import * as THREE from 'three';
import type { Island } from './island';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const PARKED = V(0, -80, 0);

const IN = 2.8; // seconds for the dive down to the plate
const GRAB = 0.6; // hovering over it, getting a proper grip
const OUT = 4.5; // off out to sea with it

/** A point along a quadratic Bézier. */
const bezier = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, k: number, out: THREE.Vector3) =>
  out.copy(a).multiplyScalar((1 - k) ** 2).addScaledVector(b, 2 * (1 - k) * k).addScaledVector(c, k * k);

/**
 * Vincent's dinner by the fire (models.py `fire_wrap`), and the gull that has had its eye on it.
 * Every few minutes of daylight, a gull comes in low off the sea, snatches the wrap off the plate
 * and makes off with it, wings going like mad. The plate stays empty until Vincent has been away
 * from the fire for a bit: he's gone and made another one.
 */
export class Mischief {
  /** The gull doing the stealing: its own clone, so the ones wheeling overhead carry on. */
  readonly thief?: THREE.Object3D;
  private wings: { o: THREE.Object3D; side: number; rest: number }[] = [];
  private wrap?: THREE.Object3D;
  private plate?: THREE.Object3D;
  private wrapRest?: { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 };
  private at = V(); // over the plate
  private from = V();
  private via = V();
  private away = V();
  private away2 = V();
  private phase: 'waiting' | 'in' | 'grab' | 'out' | 'gone' = 'waiting';
  private t = 0;
  private next = rand(60, 180);
  /** How long the plate's been empty, and how long of that Vincent has been away from the fire. */
  private empty = 0;
  private awayFor = 0;
  private clock = 0;
  /** Called when the gull grabs the wrap (a triumphant scream). */
  onSnatch?: (at: THREE.Vector3) => void;

  constructor(scene: THREE.Scene, island: Island, gull?: THREE.Object3D) {
    this.plate = island.get('fire_wrap');
    this.wrap = island.part('fire_wrap', 'fire_wrap_roll');
    if (!gull || !this.plate || !this.wrap) return;
    this.wrapRest = { position: this.wrap.position.clone(), quaternion: this.wrap.quaternion.clone(), scale: this.wrap.scale.clone() };
    this.at.copy(this.wrap.getWorldPosition(V())).add(V(0, 0.25, 0));
    const thief = gull.clone(true);
    thief.userData = { id: 'thief' };
    thief.visible = false;
    thief.position.copy(PARKED);
    thief.traverse((o) => {
      const m = o.name.match(/^gull_wing_([lr])/);
      if (m) this.wings.push({ o, side: m[1] === 'l' ? 1 : -1, rest: o.rotation.x });
    });
    scene.add(thief);
    this.thief = thief;
  }

  /** Whether the plate's empty just now. */
  get stolen() {
    return this.phase === 'grab' || this.phase === 'out' || this.phase === 'gone';
  }

  /** Whether the gull is on its way in, or off with the wrap. */
  get flying() {
    return this.phase === 'in' || this.phase === 'grab' || this.phase === 'out';
  }

  /** Straight to the robbery: for previews (?mischief). */
  soon() {
    this.next = 2;
  }

  /** `gulls`: whether it's light enough for gulls to be about. `atFire`: whether Vincent's at the fire. */
  update(dt: number, gulls: boolean, atFire: boolean) {
    const thief = this.thief;
    if (!thief || !this.wrap || !this.plate) return;
    this.clock += dt;
    this.t += dt;
    switch (this.phase) {
      case 'waiting':
        if (!gulls || (this.next -= dt) > 0) return;
        this.plan();
        this.phase = 'in';
        this.t = 0;
        thief.visible = true;
        break;
      case 'in':
        if (this.t >= IN) Object.assign(this, { phase: 'grab', t: 0 });
        break;
      case 'grab':
        if (this.t >= GRAB) {
          // got it: into the beak, and away
          thief.attach(this.wrap);
          this.onSnatch?.(this.at.clone());
          Object.assign(this, { phase: 'out', t: 0 });
        }
        break;
      case 'out':
        if (this.t >= OUT) {
          thief.visible = false;
          thief.position.copy(PARKED);
          this.wrap.visible = false;
          Object.assign(this, { phase: 'gone', t: 0, empty: 0, awayFor: 0 });
        }
        break;
      case 'gone':
        // he's made another one, once he's been off somewhere else a while
        this.empty += dt;
        this.awayFor = atFire ? 0 : this.awayFor + dt;
        if (this.empty > 60 && this.awayFor > 20) this.restore();
        return;
    }
    this.fly(thief);
  }

  /** Where it comes in from, and where it makes off to: out over the sea to the east, either side. */
  private plan() {
    const side = Math.random() < 0.5 ? 1 : -1;
    this.from.copy(this.at).add(V(rand(16, 20), rand(9, 12), side * rand(4, 9)));
    this.via.copy(this.at).add(V(rand(3, 5), 0.6, side * rand(0.5, 2)));
    this.away.copy(this.at).add(V(rand(2, 3), rand(2.5, 3.5), -side * rand(1, 2)));
    this.away2.copy(this.at).add(V(rand(22, 28), rand(12, 16), -side * rand(6, 12)));
  }

  private fly(thief: THREE.Object3D) {
    const p = V();
    const ahead = V();
    let flap = 0;
    if (this.phase === 'in') {
      const k = THREE.MathUtils.smoothstep(this.t / IN, 0, 1) * 0.6 + (this.t / IN) * 0.4;
      bezier(this.from, this.via, this.at, k, p);
      bezier(this.from, this.via, this.at, Math.min(1, k + 0.02), ahead);
      flap = k > 0.75 ? Math.sin(this.clock * 20) * 0.7 : 0.1; // glide in, then back-pedal
    } else if (this.phase === 'grab') {
      p.copy(this.at).add(V(0, Math.sin(this.t * 14) * 0.05, 0));
      ahead.copy(p).add(V(1, 0, 0));
      flap = Math.sin(this.clock * 24) * 0.8;
    } else {
      const k = Math.min(1, this.t / OUT);
      bezier(this.at, this.away, this.away2, k, p);
      bezier(this.at, this.away, this.away2, Math.min(1, k + 0.02), ahead);
      flap = Math.sin(this.clock * (k < 0.4 ? 22 : 12)) * 0.75; // heavy with dinner
    }
    thief.position.copy(p);
    const d = ahead.sub(p);
    const heading = Math.atan2(-d.z, d.x);
    const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) * 0.6;
    thief.rotation.set(0, heading, pitch, 'YZX');
    for (const w of this.wings) w.o.rotation.x = w.rest + w.side * flap;
    if (this.phase === 'out' && this.wrap) {
      this.wrap.position.set(0.36, 0.22, 0); // crosswise in the beak (the gull faces +x)
      this.wrap.rotation.set(0, Math.PI / 2, 0);
    }
  }

  private restore() {
    if (!this.wrap || !this.plate || !this.wrapRest) return;
    this.plate.add(this.wrap);
    this.wrap.position.copy(this.wrapRest.position);
    this.wrap.quaternion.copy(this.wrapRest.quaternion);
    this.wrap.scale.copy(this.wrapRest.scale);
    this.wrap.visible = true;
    this.phase = 'waiting';
    this.next = rand(150, 360);
  }
}
