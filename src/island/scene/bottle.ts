import * as THREE from 'three';
import type { Ground } from './beike';
import type { Island } from './island';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const B = (x: number, y: number) => V(x, 0, -y); // Blender (x, y) → world

/** Stretches of beach it can wash up on: out at sea, and a point inland it drifts towards. */
const LANES: [THREE.Vector3, THREE.Vector3][] = [
  [B(-10, -40), B(-10, -12)],
  [B(-7, -40), B(-7, -12)],
  [B(6, -40), B(6, -12)],
  [B(8.5, -40), B(8.5, -12)],
  [B(14, -38), B(14, -12)],
];
const DRIFT = 0.28; // m/s, in on the swell
const OUT = 22; // m offshore it first shows up

/**
 * A message in a bottle. Now and then one comes bobbing in on the swell and fetches up on the
 * beach, where it lies until somebody picks it up (content.ts reads the note). Then, a while
 * later, another.
 */
export class Bottle {
  private root?: THREE.Object3D;
  private from = V();
  private to = V();
  private phase: 'away' | 'drifting' | 'ashore' = 'away';
  private t = 0;
  private length = 1;
  private next = rand(30, 120);
  private clock = 0;
  private seed = Math.random() * 10;
  private heading = 0;
  private glint = 2;
  /** The sun catching the glass now and then, so you notice it (life.ts makes the sparkle). */
  onGlint?: (at: THREE.Vector3) => void;

  constructor(
    island: Island,
    private ground: Ground,
  ) {
    this.root = island.get('bottle');
    if (this.root) this.root.visible = false;
  }

  /** Whether it's there to be picked up (floating or on the sand). */
  get here() {
    return this.phase !== 'away';
  }

  /** Straight onto the beach: for previews (?bottle). */
  ashore() {
    if (!this.launch()) return;
    this.t = this.length;
  }

  /** Somebody picked it up and read the note: gone, till the next one. */
  take() {
    this.phase = 'away';
    this.next = rand(240, 480);
    if (this.root) this.root.visible = false;
  }

  update(dt: number) {
    const root = this.root;
    if (!root) return;
    this.clock += dt;
    if (this.phase === 'away') {
      if ((this.next -= dt) <= 0 && !this.launch()) this.next = 30;
      return;
    }
    this.t = Math.min(this.length, this.t + dt);
    const k = this.t / this.length;
    const p = V().lerpVectors(this.from, this.to, k);
    const t = this.clock + this.seed;
    if (k < 1) {
      // bobbing and rolling in the swell, nose up, nose down
      p.y = -0.04 + Math.sin(t * 1.6) * 0.05;
      root.rotation.set(Math.sin(t * 1.1) * 0.3, this.heading + Math.sin(t * 0.4) * 0.3, Math.sin(t * 1.6 + 1) * 0.15, 'YZX');
    } else {
      // on the sand, just nudged now and then by the last of a wave
      this.phase = 'ashore';
      p.y = this.ground.at(p.x, p.z) - 0.03;
      root.rotation.set(0.25, this.heading + Math.sin(t * 0.7) * 0.03, 0.05, 'YZX');
    }
    root.position.copy(p);
    if ((this.glint -= dt) <= 0) {
      this.glint = rand(1.8, 3.2);
      this.onGlint?.(p.clone().add(V(0, 0.2, 0)));
    }
  }

  /** Pick a stretch of beach, and set off towards it. False if there's nowhere to land. */
  private launch() {
    const root = this.root;
    if (!root) return false;
    const [sea, land] = LANES[Math.floor(Math.random() * LANES.length)];
    // walk in from the sea to the first dry sand: that's where it fetches up
    const dir = land.clone().sub(sea).normalize();
    const shore = sea.clone();
    for (let i = 0; i < 400; i++) {
      const h = this.ground.at(shore.x, shore.z);
      if (h > 0.04) break;
      shore.addScaledVector(dir, 0.1);
    }
    if (!(this.ground.at(shore.x, shore.z) > 0.04)) return false;
    shore.addScaledVector(dir, 0.35).add(V(rand(-0.6, 0.6), 0, 0));
    this.to.copy(shore);
    this.from.copy(shore).addScaledVector(dir, -OUT).add(V(rand(-3, 3), 0, 0));
    this.length = this.from.distanceTo(this.to) / DRIFT;
    this.heading = rand(0, Math.PI * 2);
    this.t = 0;
    this.phase = 'drifting';
    root.visible = true;
    return true;
  }
}
