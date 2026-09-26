import * as THREE from 'three';
import type { Ground } from './beike';
import { occasions } from './calendar';
import { Body, type Call } from './fauna';
import type { Island } from './island';
import type { Particles } from './particles';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** Blender's (east, north) to a point in the scene (east, up, south). */
const B = (x: number, y: number) => V(x, 0, -y);
const headingOf = (dx: number, dz: number) => Math.atan2(-dz, dx);
const GLITTER = ['#fff6d8', '#ffd1f0', '#c8f0ff', '#ffe8a0'];

/** Their way round: out of the lighthouse, past the library, over the plaza and along to the campfire (layout.py PATHS). */
const ROUTE = [[-28.2, -4.6], [-26, -4], [-20, -5.5], [-14, -7.5], [-11, -7.2], [-8, -7], [-4, -7.5], [0, -8.2], [3.6, -9.5], [9, -11], [15, -10.5], [21, -6], [24.2, -2.8]];
const PACE = 0.65; // m/s: a walk, lanterns held carefully
const GAP = 1.25; // metres between one and the next
/** Who walks, in order, how high they hold the lantern (the bottom of its stick), and how big it is for them (big: you'd not see it otherwise). */
const WALKERS: { species: string; hand: number; size: number; fly?: number }[] = [
  { species: 'puck', hand: 0.12, size: 1.1 },
  { species: 'pixie_rose', hand: 0.0, size: 0.7, fly: 0.35 },
  { species: 'pixie_gold', hand: 0.0, size: 0.7, fly: 0.4 },
  { species: 'titania', hand: 0.4, size: 1.9 },
  { species: 'oberon', hand: 0.45, size: 2 },
  { species: 'pixie_blue', hand: 0.0, size: 0.7, fly: 0.38 },
  { species: 'pixie_green', hand: 0.0, size: 0.7, fly: 0.33 },
];

const WANTED = (() => {
  try {
    return new URLSearchParams(location.search).has('lanterns');
  } catch {
    return false;
  }
})();

interface Walker {
  body: Body;
  scale: number;
  lantern: THREE.Object3D;
  hand: number;
  fly?: number;
}

/**
 * Sint Maarten, the eleventh of November. At dusk children go from door to door with paper
 * lanterns, singing for sweets; on the island it's the fair folk. Once it's getting dark (and
 * if it's dry) they come out of the lighthouse in a line, Puck at the front, the pixies bobbing
 * along in the air, Oberon and Titania walking behind, every one of them with a lantern on a
 * stick, and walk slowly past the library, over the plaza and along to the campfire, where they
 * wink out one by one. A while later they do it all again, till it's properly night.
 */
export class Lanterns {
  private walkers: Walker[] = [];
  private path: THREE.Vector3[] = [];
  private lengths: number[] = [];
  private total = 0;
  private along = -1; // metres the leader has come; -1 when nobody's out
  private wait = WANTED ? 4 : rand(10, 40);
  private clock = 0;
  private twinkle = 0;
  private light = new THREE.PointLight('#ffc070', 0, 9, 1.2);
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean, loud?: number) => void;

  constructor(
    scene: THREE.Scene,
    island: Island,
    template: (species: string) => THREE.Object3D | undefined,
    private ground: Ground,
    private particles: Particles,
  ) {
    if (!occasions.has('sintmaarten') && !WANTED) return;
    const lanterns = [0, 1, 2, 3].map((i) => island.get(`lantern_${i}`)).filter((o): o is THREE.Object3D => !!o);
    if (!lanterns.length) return;
    WALKERS.forEach((w, i) => {
      const t = template(w.species);
      if (!t) return;
      const body = new Body(w.species, t, scene);
      body.root.userData.id = w.species.startsWith('pixie') ? 'pixie' : w.species;
      const lantern = lanterns[i % lanterns.length].clone(true);
      lantern.scale.setScalar(w.size);
      lantern.visible = false;
      scene.add(lantern);
      this.walkers.push({ body, scale: t.scale.x, lantern, hand: w.hand, fly: w.fly });
    });
    this.path = ROUTE.map(([x, y]) => this.onGround(B(x, y)));
    this.lengths = this.path.slice(1).map((p, i) => this.path[i].distanceTo(p));
    this.total = this.lengths.reduce((a, b) => a + b, 0);
    scene.add(this.light);
  }

  /** Everyone walking, for the Picker. */
  get pickables() {
    return this.walkers.map((w) => w.body.root);
  }

  /** Whether they're out just now. */
  get on() {
    return this.along >= 0;
  }

  /** `night`: the Sky's lamps (dusk is about 0.3). `hour`: island time, 0..24. `wet`: 0..1. */
  update(dt: number, night: number, wet: number, hour: number) {
    if (!this.walkers.length) return;
    this.clock += dt;
    const dusk = (night > 0.25 && hour >= 16 && hour < 21.5 && wet < 0.3) || WANTED;
    if (this.along < 0) {
      if (!dusk || (this.wait -= dt) > 0) return;
      this.along = 0;
      for (const w of this.walkers) w.body.show(this.path[0]);
    }
    this.along += PACE * dt;
    let lit = 0;
    const middle = V();
    this.walkers.forEach((w, i) => {
      const d = this.along - i * GAP;
      const b = w.body;
      // not out of the door yet, or already gone at the far end (with a little glitter)
      if (d < 0 || d > this.total) {
        if (d > this.total && b.root.visible) {
          this.burst(b.root.position.clone().add(V(0, 0.4, 0)));
          this.onCall?.('twinkle', b.root.position.clone(), true, 0.5);
        }
        b.root.visible = false;
        w.lantern.visible = false;
        return;
      }
      b.root.visible = true;
      w.lantern.visible = true;
      const { at, heading } = this.pointAt(d);
      b.relax();
      const step = Math.sin(this.clock * 5 + i);
      const lift = w.fly !== undefined ? w.fly + Math.sin(this.clock * 2.4 + i * 1.7) * 0.06 : Math.abs(step) * 0.03;
      b.root.position.copy(at).y += lift;
      b.root.rotation.set(0, heading, 0, 'YZX');
      b.root.scale.setScalar(w.scale);
      const [wl, wr] = [b.part('wing_l'), b.part('wing_r')];
      if (w.fly !== undefined) {
        const beat = Math.sin(this.clock * 38 + i) * 0.7;
        if (wl) wl.rotation.z += beat;
        if (wr) wr.rotation.z -= beat;
      }
      // the lantern held out in front, to their right, swinging a little as they go
      const right = V(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(0.18 * (w.fly !== undefined ? 0.4 : 1));
      const ahead = V(Math.cos(heading), 0, -Math.sin(heading)).multiplyScalar(0.15);
      w.lantern.position.copy(b.root.position).add(right).add(ahead).y += w.hand - lift * 0.3;
      w.lantern.rotation.set(Math.sin(this.clock * 2 + i) * 0.08, heading, 0.15 + step * 0.04, 'YXZ');
      middle.add(b.root.position);
      lit++;
    });
    if (lit) {
      this.light.position.copy(middle.divideScalar(lit)).y += 1;
      this.light.intensity = Math.min(1, lit / 3) * (2.4 + Math.sin(this.clock * 3) * 0.15);
    } else this.light.intensity = 0;
    if (lit && (this.twinkle -= dt) < 0) {
      this.twinkle = rand(3, 6);
      this.onCall?.('twinkle', this.light.position.clone(), true, 0.35);
    }
    // all of them gone at the far end: again in a while, if it's still the evening for it
    if (this.along - (this.walkers.length - 1) * GAP > this.total + 0.5) {
      this.along = -1;
      this.wait = WANTED ? 10 : rand(90, 180);
      for (const w of this.walkers) {
        w.body.hide();
        w.lantern.visible = false;
      }
    }
  }

  /** Where along the route `d` metres is, and which way it goes there. */
  private pointAt(d: number) {
    let leg = 0;
    let k = Math.max(0, d);
    while (leg < this.lengths.length - 1 && k > this.lengths[leg]) k -= this.lengths[leg++];
    const a = this.path[leg];
    const b = this.path[leg + 1];
    const at = a.clone().lerp(b, Math.min(1, k / Math.max(1e-3, this.lengths[leg])));
    return { at: this.onGround(at), heading: headingOf(b.x - a.x, b.z - a.z) };
  }

  private onGround(p: THREE.Vector3) {
    const h = this.ground.at(p.x, p.z);
    return p.setY(Number.isNaN(h) ? 0.5 : h);
  }

  private burst(at: THREE.Vector3) {
    for (let i = 0; i < 10; i++) {
      const v = V(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.3, 0.9));
      this.particles.emit({ position: at.clone(), velocity: v, color: GLITTER[i % GLITTER.length], life: rand(0.5, 1), drag: 2, gravity: -0.3, fadeIn: 0 });
    }
  }
}
