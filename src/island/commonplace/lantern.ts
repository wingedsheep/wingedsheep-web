/**
 * The lantern on the last twig. It hangs out where the deep water starts, lit, and you can take
 * it down and carry it back the way you came: it swings from your hand as you walk, and lights
 * the wet sand round you. Set it down anywhere and it stays lit there; leave the flat and it's
 * back on its twig for whoever walks out next.
 */
import * as THREE from 'three';

export type Where = 'hung' | 'held' | 'down';

/** From the bail's top, where it hangs, down to the middle of the glass (m). */
const DROP = 0.15;
/** The swing: how stiff (1/s², g over the bail's length) and how fast it dies away. */
const STIFF = 9.8 / 0.22;
const DAMP = 2.6;

export class Lantern {
  /** The lantern itself, its origin at the top of the bail, where it hangs from. */
  readonly root = new THREE.Group();
  where: Where = 'hung';
  private hook = new THREE.Vector3();
  private set = new THREE.Vector3();
  /** The swing, about the two level axes (rad), and how fast. */
  private swing = new THREE.Vector2();
  private spin = new THREE.Vector2();
  private hand = new THREE.Vector3();
  private handV = new THREE.Vector3();
  private started = false;
  /** Where it was taken from, so its card can wait till you've walked on. */
  takenAt = new THREE.Vector2();

  constructor(glass: THREE.Material, metal: THREE.Material) {
    const lit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.14), glass);
    lit.position.y = -DROP;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), metal);
    cap.position.y = -DROP + 0.1;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.17), metal);
    foot.position.y = -DROP - 0.1;
    // the bail, a wire loop over the top
    const bail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.02), metal);
    bail.position.y = -0.005;
    for (const side of [-1, 1]) {
      const wire = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), metal);
      wire.position.set(side * 0.08, -0.03, 0);
      this.root.add(wire);
    }
    this.root.add(lit, cap, foot, bail);
  }

  /** Where it hangs on its twig (the bail's top, in the world). */
  hangAt(at: THREE.Vector3) {
    this.hook.copy(at);
  }

  take(x: number, z: number) {
    this.where = 'held';
    this.takenAt.set(x, z);
    this.started = false;
    this.swing.set(0, 0);
    this.spin.set(0, 0);
  }

  /** Set down on the sand at (x, z), its foot at height y. */
  putDown(x: number, y: number, z: number) {
    this.where = 'down';
    this.set.set(x, y + DROP + 0.115, z);
  }

  hang() {
    this.where = 'hung';
  }

  /** Where it's lying, if it's been set down (on the flat: x, z). */
  get down() {
    return this.where === 'down' ? new THREE.Vector2(this.set.x, this.set.z) : null;
  }

  /** Each frame: `hand` is where your hand is in the world, if you're holding it. */
  update(dt: number, hand: THREE.Vector3 | null, wind: number, time: number) {
    const r = this.root;
    if (this.where === 'held' && hand) {
      // a pendulum hung from your hand, pushed about by how your hand moves
      if (!this.started || dt <= 0) {
        this.hand.copy(hand);
        this.handV.set(0, 0, 0);
        this.started = true;
      }
      const v = hand.clone().sub(this.hand).divideScalar(Math.max(dt, 1e-3));
      const a = v.clone().sub(this.handV).divideScalar(Math.max(dt, 1e-3));
      this.hand.copy(hand);
      this.handV.copy(v);
      const step = Math.min(dt, 1 / 30);
      // (x: the swing about the world's x axis, so it's pushed by the hand's z; z the other way)
      this.spin.x += (-STIFF * Math.sin(this.swing.x) - DAMP * this.spin.x + (a.z / 0.22) * 0.6) * step;
      this.spin.y += (-STIFF * Math.sin(this.swing.y) - DAMP * this.spin.y - (a.x / 0.22) * 0.6) * step;
      this.swing.x = THREE.MathUtils.clamp(this.swing.x + this.spin.x * step, -0.7, 0.7);
      this.swing.y = THREE.MathUtils.clamp(this.swing.y + this.spin.y * step, -0.7, 0.7);
      r.position.copy(hand);
      r.rotation.set(this.swing.x, 0, this.swing.y);
    } else if (this.where === 'down') {
      r.position.copy(this.set);
      r.rotation.set(0, 0, 0);
    } else {
      // on its twig, stirring a little in the wind
      r.position.copy(this.hook);
      r.rotation.set(Math.sin(time * 1.3) * 0.04 * wind, 0, Math.sin(time * 0.9 + 1) * 0.06 * wind);
    }
  }

  /** Where its light is: the middle of the glass. */
  light(out: THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    return this.root.localToWorld(out.set(0, -DROP, 0));
  }
}
