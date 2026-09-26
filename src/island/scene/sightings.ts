import * as THREE from 'three';
import type { Ground } from './beike';
import { occasions } from './calendar';
import { Body, headingOf, orient, splash, type Call, type Season } from './fauna';
import type { Island } from './island';
import type { Particles } from './particles';
import { GRADIENT } from './toon';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const chance = (p: number) => Math.random() < p;
const damp = THREE.MathUtils.damp;
const clamp = THREE.MathUtils.clamp;
const smooth = (k: number) => THREE.MathUtils.smoothstep(k, 0, 1);
const DECK = 0.78; // the top of the pier's planks

/** What the day is like, as far as the rare sightings care. */
export interface Outlook {
  night: number; // 0 day … 1 night (the Sky's lamps)
  season: Season;
  wet: number;
  storm: number;
  /** The hour on the island, 0 … 24. */
  hour: number;
  /** Island time, ms (the ferry keeps to its timetable by it). */
  time: number;
  /** Wind speed, m/s. */
  wind: number;
  /** Which way the wind blows (world x, z), longer the stronger. */
  drift: THREE.Vector2;
}

/** Who's about on this visit. `?animal=<name>` brings one along soon, whatever the hour. */
const LUCK = (() => {
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const want = (k: string) => q.get('animal') === k;
  return {
    balloon: want('balloon') || chance(0.6), // not every calm summer evening
    balloonSoon: want('balloon'),
    starlings: want('starlings') || chance(0.6),
    starlingsSoon: want('starlings'),
    seal: want('seal') || chance(1 / 6),
    sealSoon: want('seal'),
    ferrySoon: want('ferry'),
    containerSoon: want('container'),
    tallship: want('tallship') || chance(1 / 25),
    tallshipSoon: want('tallship'),
    fisherman: want('fisherman') || chance(0.45),
    fishermanSoon: want('fisherman'),
  };
})();

// --- in the air ---------------------------------------------------------------------------

/**
 * A hot-air balloon, on calm, dry summer evenings: it drifts over the island with the wind, the
 * burner roaring now and then to lift it, sinking slowly in between. (Over Gelderland, on an
 * evening like that, you can count a dozen.)
 */
class Balloon {
  readonly body: Body;
  private flame?: THREE.Object3D;
  private t = -1;
  private wait = LUCK.balloonSoon ? 3 : rand(20, 90);
  private from = V();
  private dir = V();
  private speed = 1;
  private y = 20;
  private lift = 0;
  private burn = 0;
  private nextBurn = rand(2, 5);
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene) {
    this.body = new Body('balloon', template, scene);
    this.flame = this.body.part('flame');
  }

  /** Someone waved: they give the burner a blast. */
  wave() {
    if (this.t >= 0) this.nextBurn = 0;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (this.t < 0) {
      const fine = LUCK.balloonSoon || (LUCK.balloon && o.season === 'summer' && o.hour >= 18 && o.hour < 21.75
        && o.wind < 5 && o.wet < 0.05 && o.storm < 0.05 && o.night < 0.7);
      if (!fine || (this.wait -= dt) > 0) return;
      // downwind, across the island (seen from above and to the south, it hangs well north of
      // where it's really over, so its track runs south of the middle)
      const d = o.drift.lengthSq() > 0.01 ? o.drift : new THREE.Vector2(1, -0.25);
      this.dir.set(d.x, 0, d.y).normalize();
      const side = V(-this.dir.z, 0, this.dir.x);
      const mid = V(rand(-8, 8), 0, 14).addScaledVector(side, rand(-8, 8));
      this.from.copy(mid).addScaledVector(this.dir, -80);
      this.y = rand(17, 23);
      this.speed = clamp(o.wind * 0.4, 0.7, 1.8);
      this.t = 0;
      b.show(this.from);
    }
    this.t += dt;
    if ((this.nextBurn -= dt) <= 0) {
      this.burn = rand(1.5, 3);
      this.nextBurn = rand(7, 15);
      this.onCall?.('burner', b.root.position.clone(), true);
    }
    this.burn -= dt;
    this.lift = damp(this.lift, this.burn > 0 ? 0.5 : -0.2, this.burn > 0 ? 1.5 : 0.5, dt);
    this.y = clamp(this.y + this.lift * dt, 14, 26);
    b.relax();
    b.root.position.copy(this.from).addScaledVector(this.dir, this.t * this.speed).setY(this.y);
    b.root.rotation.set(Math.sin(clock * 0.6) * 0.03, this.t * 0.04, Math.sin(clock * 0.45 + 1) * 0.03);
    if (this.flame) {
      this.flame.visible = this.burn > 0;
      this.flame.scale.set(1, 0.8 + Math.sin(clock * 31) * 0.2 + Math.sin(clock * 17) * 0.1, 1);
    }
    if (this.t * this.speed > 160) {
      b.hide();
      this.t = -1;
      this.wait = rand(240, 600); // on a good evening, another one along in a while
    }
  }
}

const FLOCK = 560;
const STARLING = 1.6; // how much bigger than life they're drawn, like the rest of the island's birds

/**
 * One starling, a few triangles: a stubby body, a short square tail and the pointed, swept-back
 * wings that make a starling look like a little four-pointed star against the sky. Nose along +x,
 * wings along ±z. `aWing` is how far out along a wing a vertex is (signed by side), for the
 * wingbeat in the shader.
 */
function starlingGeometry() {
  const p: number[] = [];
  const w: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    for (const v of [a, b, c]) p.push(v[0], v[1], v[2]), w.push(v[3] ?? 0);
  };
  // the body: a stretched diamond, beak to rump
  const nose = [0.13, 0.005, 0], rump = [-0.09, 0, 0];
  const top = [0.03, 0.03, 0], belly = [0.02, -0.028, 0];
  const l = [0.02, 0, 0.035], r = [0.02, 0, -0.035];
  for (const [a, b] of [[top, l], [l, belly], [belly, r], [r, top]]) tri(nose, a, b), tri(rump, b, a);
  // the tail, short and square
  tri([-0.07, 0, 0.015], [-0.07, 0, -0.015], [-0.16, 0, -0.03]);
  tri([-0.07, 0, 0.015], [-0.16, 0, -0.03], [-0.16, 0, 0.03]);
  // the wings: broad at the root, narrowing to a point swept back
  for (const side of [1, -1]) {
    const lead = [0.05, 0.01, 0.025 * side, 0];
    const trail = [-0.04, 0.01, 0.025 * side, 0];
    const elbow = [0.03, 0.01, 0.11 * side, 0.45 * side];
    const tip = [-0.05, 0.01, 0.21 * side, side];
    tri(lead, trail, elbow);
    tri(elbow, trail, tip);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(w, 1));
  g.computeVertexNormals();
  return g;
}

/**
 * A murmuration of starlings at dusk in autumn: they stream in from the east, wheel and fold
 * over the west of the island for a couple of minutes, as one thing, then pour down into the
 * trees by the lighthouse for the night. Each bird is a tiny starling, pointed into the way it's
 * going, beating its wings in bursts and gliding in between.
 *
 * The shape is worked out fresh each frame: every bird has a fixed place in a unit ball, and the
 * ball is stretched, squashed and turned, folded into a ribbon and rippled through by a wave of
 * density, all on slow sine clocks that never quite line up.
 */
class Murmuration {
  readonly birds: THREE.InstancedMesh;
  /** An invisible ball round the flock, for clicks (the Picker doesn't see the birds). */
  readonly hit: THREE.Mesh;
  private seeds = new Float32Array(FLOCK * 4);
  private last = new Float32Array(FLOCK * 3);
  private dir = new Float32Array(FLOCK * 3);
  private bank = new Float32Array(FLOCK);
  private clock = { value: 0 };
  private t = -1;
  private wait = LUCK.starlingsSoon ? 2 : rand(10, 60);
  private dance = 120;
  private next = 6;
  private centre = V(-16, 13, 6);
  private roost = V(-24, 2, -1);
  private entry = V(80, 22, -10);
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(scene: THREE.Scene) {
    const phase = new Float32Array(FLOCK);
    for (let i = 0; i < FLOCK; i++) {
      let x, y, z;
      do [x, y, z] = [rand(-1, 1), rand(-1, 1), rand(-1, 1)]; while (x * x + y * y + z * z > 1);
      this.seeds.set([x, y, z, rand(0, 1)], i * 4);
      this.dir.set([-1, 0, 0], i * 3); // in from the east
      phase[i] = rand(0, 1);
    }
    const g = starlingGeometry();
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    const mat = new THREE.MeshToonMaterial({ color: '#2a2331', gradientMap: GRADIENT, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uClock = this.clock;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uClock;\nattribute float aWing;\nattribute float aPhase;')
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `#include <begin_vertex>
          // bursts of quick wingbeats, then a glide with the wings held out flat
          float beating = smoothstep(-0.2, 0.3, sin(uClock * 0.8 + aPhase * 37.0));
          float beat = sin(uClock * 17.0 + aPhase * 60.0) * 0.75 * beating + 0.08;
          float reach = abs(aWing);
          if (reach > 0.0) {
            float a = beat * (0.6 + 0.4 * reach);
            float out_ = abs(transformed.z) - 0.025;
            transformed.z = sign(aWing) * (0.025 + out_ * cos(a));
            transformed.y += out_ * sin(a);
          }`,
        );
    };
    this.birds = new THREE.InstancedMesh(g, mat, FLOCK);
    this.birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.birds.frustumCulled = false;
    this.birds.visible = false;
    this.birds.raycast = () => {};
    scene.add(this.birds);
    this.hit = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.userData.id = 'starlings';
    this.hit.visible = false;
    scene.add(this.hit);
  }

  get on() {
    return this.t >= 0;
  }

  /** Where bird i is in the flock's shape at time t. */
  private shape(i: number, t: number, out: THREE.Vector3) {
    const s = this.seeds;
    const [a, b, c, ph] = [s[i * 4], s[i * 4 + 1], s[i * 4 + 2], s[i * 4 + 3]];
    const A = 8 + 5 * Math.sin(t * 0.31);
    const B = 2 + 1.3 * Math.sin(t * 0.27 + 1);
    const C = 4.5 + 3 * Math.sin(t * 0.23 + 2);
    let x = a * A + Math.sin(a * 3 - t * 1.6) * 1.3; // a wave of density running through
    let y = b * B + Math.sin(a * 2.2 + t * 0.9) * 2.2; // folded into a ribbon
    let z = c * C;
    const tilt = Math.sin(t * 0.21) * 0.5;
    [y, z] = [y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
    const yaw = t * 0.35 + Math.sin(t * 0.19) * 1.5;
    [x, z] = [x * Math.cos(yaw) - z * Math.sin(yaw), x * Math.sin(yaw) + z * Math.cos(yaw)];
    out.set(x, y, z).add(this.middle(t));
    out.y += Math.sin(t * 3 + ph * 40) * 0.12;
    return out;
  }

  private middle(t: number) {
    return V(Math.sin(t * 0.13) * 8, Math.sin(t * 0.21 + 1) * 2.5, Math.cos(t * 0.11) * 5).add(this.centre);
  }

  /** Turn bird i towards the way it moved since last frame, leaning into the turn. */
  private face(i: number, at: THREE.Vector3, turn: number, dt: number) {
    const [l, d] = [this.last, this.dir];
    const k = i * 3;
    const [vx, vy, vz] = [at.x - l[k], at.y - l[k + 1], at.z - l[k + 2]];
    l.set([at.x, at.y, at.z], k);
    const len = Math.hypot(vx, vy, vz);
    if (!(len > 1e-4)) return; // first frame, or hanging still
    const [ox, oz] = [d[k], d[k + 2]];
    const [nx, ny, nz] = [d[k] + (vx / len - d[k]) * turn, d[k + 1] + (vy / len - d[k + 1]) * turn, d[k + 2] + (vz / len - d[k + 2]) * turn];
    const n = Math.hypot(nx, ny, nz) || 1;
    d.set([nx / n, ny / n, nz / n], k);
    const yawRate = (Math.atan2(-d[k + 2], d[k]) - Math.atan2(-oz, ox) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    this.bank[i] = damp(this.bank[i], clamp((-yawRate / Math.max(dt, 1e-3)) * 0.35, -0.9, 0.9), 6, dt);
  }

  update(dt: number, o: Outlook) {
    if (this.t < 0) {
      const fine = LUCK.starlingsSoon || (LUCK.starlings && o.season === 'autumn' && o.hour >= 15 && o.night > 0.1 && o.night < 0.8
        && o.wet < 0.3 && o.wind < 10);
      if (!fine || (this.wait -= dt) > 0) return;
      this.t = 0;
      this.dance = rand(100, 150);
      this.next = 12;
      this.birds.visible = true;
      this.last.fill(NaN);
    }
    this.t += dt;
    const t = this.t;
    const at = V();
    const end = 14 + this.dance;
    this.clock.value = t;
    const turn = 1 - Math.exp(-8 * dt);
    const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YZX'), m4 = new THREE.Matrix4();
    const size = V(STARLING, STARLING, STARLING), none = V(0, 0, 0);
    for (let i = 0; i < FLOCK; i++) {
      const lag = this.seeds[i * 4 + 3] * 10;
      this.shape(i, t, at);
      const come = smooth(clamp((t - lag) / 7, 0, 1));
      if (come < 1) at.lerp(V(this.entry.x + lag * 4, this.entry.y + (this.seeds[i * 4 + 1] * 3), this.entry.z + this.seeds[i * 4 + 2] * 4), 1 - come);
      const go = clamp((t - end - lag * 0.5) / 5, 0, 1);
      if (go > 0) at.lerp(V(this.roost.x + this.seeds[i * 4] * 2.5, this.roost.y, this.roost.z + this.seeds[i * 4 + 2] * 2.5), smooth(go));
      if (go >= 1) { // down among the branches
        this.birds.setMatrixAt(i, m4.makeScale(0, 0, 0));
        continue;
      }
      this.face(i, at, turn, dt);
      const d = this.dir;
      const yaw = Math.atan2(-d[i * 3 + 2], d[i * 3]);
      e.set(this.bank[i], yaw, Math.asin(clamp(d[i * 3 + 1], -0.6, 0.6)));
      this.birds.setMatrixAt(i, m4.compose(at, q.setFromEuler(e), go > 0.85 ? none : size));
    }
    this.birds.instanceMatrix.needsUpdate = true;
    const m = this.middle(t);
    this.hit.visible = t > 10 && t < end;
    this.hit.position.copy(m);
    this.hit.scale.setScalar(9);
    // the rush of thousands of wings, as they turn
    if (t > this.next && t < end) {
      this.next = t + rand(8, 16);
      this.onCall?.('murmur', m, true);
    }
    if (t > end + 12) {
      this.t = -1;
      this.birds.visible = false;
      this.hit.visible = false;
      this.wait = rand(900, 1800);
    }
  }
}

// --- on the beach -------------------------------------------------------------------------

/**
 * A harbour seal, on some visits: it comes up out of the sea onto the south beach and lies there
 * in the sun, lifting its head to look about, and now and then its head and tail both, into a
 * banana. Bother it three times and it galumphs back into the sea (and comes back later).
 */
class Seal {
  readonly body: Body;
  private state: 'away' | 'coming' | 'resting' | 'going' = 'away';
  private wait = LUCK.sealSoon ? 2 : rand(5, 40);
  private k = 0;
  private spot = V();
  private sea = V();
  private heading = 0;
  private lying = 0;
  private looking = 0;
  private lookAt = 0;
  private banana = 0;
  private nextBanana = rand(10, 25);
  private stare = 0;
  private pokes = 0;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private ground: Ground, private particles: Particles) {
    this.body = new Body('seal', template, scene);
    // a stretch of sand on the south beach, clear of the pier and the crabs
    for (const x of pick([[-8.5, -15, 14], [14, -8.5, -15], [-15, 14, -8.5]])) {
      for (let z = 34; z > 14; z -= 0.25) {
        const h = ground.at(x, z);
        if (!Number.isNaN(h) && h > 0.08) {
          const hIn = ground.at(x, z - 0.8);
          if (Number.isNaN(hIn) || hIn > 0.45) break; // no beach here, just a bank
          this.spot.set(x, ground.at(x, z - 0.6), z - 0.6);
          this.sea.set(x, -0.25, z + 4);
          this.heading = headingOf(1, 0) + (x > 0 ? Math.PI : 0); // lying along the beach, head towards the pier
          return;
        }
      }
    }
  }

  get resting() {
    return this.state === 'resting';
  }

  /** Clicked: it looks at you, and the third time that's enough. */
  poke() {
    if (this.state !== 'resting') return;
    this.onCall?.('seal', this.body.root.position.clone());
    if (++this.pokes >= 3) {
      this.pokes = 0;
      this.state = 'going';
      this.k = 0;
      return;
    }
    this.stare = 3;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    if (!this.spot.lengthSq()) return;
    const fine = LUCK.sealSoon || (LUCK.seal && o.night < 0.75 && o.storm < 0.2 && o.wet < 0.7);
    const toLand = headingOf(this.spot.x - this.sea.x, this.spot.z - this.sea.z);
    if (this.state === 'away') {
      if (!fine || (this.wait -= dt) > 0) return;
      this.state = 'coming';
      this.k = 0;
      b.show(this.sea);
      splash(this.particles, this.sea, 0.8);
    }
    b.relax();
    let pitch = 0;
    let heading = this.heading;
    let head = 0;
    let tail = 0;
    let yaw = 0;
    if (this.state === 'coming' || this.state === 'going') {
      // humping up the sand on its belly (or back down it)
      this.k = Math.min(1, this.k + dt / 6);
      const k = this.state === 'coming' ? this.k : 1 - this.k;
      const p = this.sea.clone().lerp(this.spot, smooth(k));
      const h = this.ground.at(p.x, p.z);
      p.y = Math.max(Number.isNaN(h) ? -0.25 : h, -0.25) + Math.max(0, Math.sin(this.k * Math.PI * 9)) * 0.06;
      b.root.position.copy(p);
      heading = this.state === 'coming' ? toLand : toLand + Math.PI;
      pitch = Math.sin(this.k * Math.PI * 9) * 0.08;
      head = 0.2;
      this.lying = heading;
      if (this.k >= 1) {
        if (this.state === 'coming') {
          this.state = 'resting';
          this.lying = heading;
        } else {
          splash(this.particles, b.root.position, 0.8);
          b.hide();
          this.state = 'away';
          this.wait = rand(90, 240);
          return;
        }
      }
    } else {
      // resting: turn to lie along the beach, breathe, look about, now and then a banana
      if (!fine) {
        this.state = 'going';
        this.k = 0;
      }
      const d = Math.atan2(Math.sin(this.heading - this.lying), Math.cos(this.heading - this.lying));
      this.lying += d * (1 - Math.exp(-1.5 * dt));
      heading = this.lying;
      b.root.position.copy(this.spot);
      if ((this.nextBanana -= dt) <= 0) {
        this.banana = 4;
        this.nextBanana = rand(15, 35);
      }
      this.banana -= dt;
      if ((this.looking -= dt) <= 0) {
        this.looking = rand(3, 8);
        this.lookAt = chance(0.4) ? 0 : rand(-0.8, 0.8);
      }
      const up = this.banana > 0 ? Math.sin(Math.min(1, (4 - this.banana) / 4) * Math.PI) : 0;
      this.stare -= dt;
      head = up * 0.55 + (this.stare > 0 ? 0.35 : this.lookAt ? 0.15 : 0);
      tail = up * 0.6;
      yaw = this.stare > 0 ? 0.7 * (this.spot.x > 0 ? 1 : -1) : this.lookAt; // round to look at you
      const body = b.part('body');
      if (body) body.scale.y *= 1 + Math.sin(clock * 1.3) * 0.03;
    }
    orient(b.root, heading, pitch);
    const hd = b.part('head');
    if (hd) {
      hd.rotation.z += head;
      hd.rotation.y += yaw;
    }
    const tl = b.part('tail');
    if (tl) tl.rotation.z -= tail;
  }
}

// --- on the horizon -----------------------------------------------------------------------

/** One ship's passage: along a lane (world z) from one side of the sea to the other. */
class Ship {
  readonly body: Body;
  private x = 0;
  private dir = 1;
  private z = 0;
  private speed = 1;
  private wake = 0;
  private phase = rand(0, 10);
  sailing = false;

  /** `size` scales the model up from how it was built (length is the built one, in metres). */
  constructor(species: string, template: THREE.Object3D, scene: THREE.Scene, private particles: Particles, private length: number, private size = 1) {
    this.body = new Body(species, template, scene);
    this.body.root.scale.setScalar(size);
    this.length *= size;
  }

  sail(z: number, dir: number, speed: number, reach: number) {
    this.z = z;
    this.dir = dir;
    this.speed = speed;
    this.x = -dir * reach;
    this.sailing = true;
    this.body.show(V(this.x, 0, z));
  }

  /** Put it at x (for the ferry, which the timetable places). */
  at(x: number, z: number, dir: number) {
    if (!this.sailing) this.body.show(V(x, 0, z));
    this.sailing = true;
    this.x = x;
    this.z = z;
    this.dir = dir;
    this.speed = 0;
  }

  dock() {
    this.sailing = false;
    this.body.hide();
  }

  get position() {
    return this.body.root.position;
  }

  /** How far east she is. */
  get along() {
    return this.x;
  }

  update(dt: number, clock: number, swell: number) {
    if (!this.sailing) return;
    this.x += this.dir * this.speed * dt;
    const b = this.body;
    const c = clock + this.phase;
    b.relax();
    b.root.position.set(this.x, Math.sin(c * 0.9) * 0.05, this.z);
    orient(b.root, this.dir > 0 ? 0 : Math.PI, Math.sin(c * 0.6) * 0.015 * (1 + swell), Math.sin(c * 0.8) * 0.03 * (1 + swell * 2));
    // a white wake, spreading out behind her
    if (Math.abs(this.x) < 95 && (this.wake -= dt) < 0) {
      this.wake = 0.14;
      const stern = V(this.x - this.dir * this.length * 0.5, 0.05, this.z + rand(-0.6, 0.6) * this.size);
      this.particles.emit({ position: stern, velocity: V(rand(-0.1, 0.1), 0, rand(-0.25, 0.25)), color: pick(['#ffffff', '#e2f2fa']), life: rand(2, 3.5), size: 1 });
      const bow = V(this.x + this.dir * this.length * 0.5, 0.05, this.z + (chance(0.5) ? 0.8 : -0.8) * this.size);
      this.particles.emit({ position: bow, velocity: V(0, 0, Math.sign(bow.z - this.z) * 0.4), color: '#ffffff', life: rand(0.8, 1.4), size: 1 });
    }
  }
}

/** The ferry's timetable: half-hourly from 07:00 (out on the hour, back on the half hour), the last at 22:30. */
const FERRY = { z: 40, first: 7, last: 22.5, crossing: 300, reach: 110 };
const hhmm = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${Math.round((h % 1) * 60) === 30 ? '30' : '00'}`;

// --- on the pier --------------------------------------------------------------------------

/**
 * A fisherman at the end of the pier on some early mornings, legs over the edge, rod out. Every
 * so often the float bobs; sometimes that's a bite, and he reels in a fish for his bucket.
 */
class Fisherman {
  readonly body: Body;
  private rod?: THREE.Object3D;
  private line?: THREE.Object3D;
  private fish?: THREE.Object3D;
  private head?: THREE.Object3D;
  private state: 'waiting' | 'nibble' | 'reeling' | 'landed' | 'casting' = 'waiting';
  private st = 0;
  private nextBite = rand(15, 40);
  private nod = 0;
  /** How many he's caught this morning. */
  catches = 0;
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(template: THREE.Object3D, scene: THREE.Scene, private seat: THREE.Vector3) {
    this.body = new Body('fisherman', template, scene);
    this.rod = this.body.part('rod');
    this.line = this.body.part('line');
    this.fish = this.body.part('fish');
    this.head = this.body.part('head');
  }

  poke() {
    this.nod = 1;
  }

  update(dt: number, o: Outlook, clock: number) {
    const b = this.body;
    const fine = !occasions.has('sinterklaas') // the steamboat's tied up across the end of the pier
      && (LUCK.fishermanSoon || (LUCK.fisherman && o.hour >= 5 && o.hour < 9.5 && o.wet < 0.5 && o.storm < 0.1));
    if (fine !== b.shown) {
      if (fine) b.show(this.seat);
      else b.hide();
    }
    if (!fine) return;
    b.relax();
    b.root.position.copy(this.seat);
    orient(b.root, headingOf(0, 1)); // facing out to sea
    this.st += dt;
    let pitch = Math.sin(clock * 0.7) * 0.03;
    let reel = 1;
    let dip = 0;
    let fish = false;
    switch (this.state) {
      case 'waiting':
        if ((this.nextBite -= dt) <= 0) [this.state, this.st] = ['nibble', 0];
        break;
      case 'nibble': // the float bobs under, and bobs up
        dip = Math.max(0, Math.sin(this.st * 9)) * 0.06;
        if (this.st > 2.5) {
          if (chance(0.5)) [this.state, this.st] = ['reeling', 0];
          else [this.state, this.st, this.nextBite] = ['waiting', 0, rand(20, 50)];
        }
        break;
      case 'reeling': { // rod up, winding in
        const k = Math.min(1, this.st / 2.5);
        pitch += smooth(k) * 0.55 + Math.sin(this.st * 14) * 0.03;
        reel = 1 - smooth(k) * 0.88;
        if (k >= 1) {
          [this.state, this.st] = ['landed', 0];
          this.catches++;
        }
        break;
      }
      case 'landed': // the fish swinging off the end, then into the bucket
        pitch += 0.55;
        reel = 0.12;
        fish = true;
        if (this.st > 3) {
          [this.state, this.st] = ['casting', 0];
          this.onCall?.('plop', b.root.position.clone(), true);
        }
        break;
      case 'casting': { // and back out
        const k = Math.min(1, this.st / 1.2);
        pitch += 0.55 * (1 - smooth(k)) + Math.sin(k * Math.PI) * 0.25;
        reel = 0.12 + smooth(k) * 0.88;
        if (k >= 1) [this.state, this.st, this.nextBite] = ['waiting', 0, rand(25, 60)];
        break;
      }
    }
    if (this.rod) this.rod.rotation.z += pitch;
    if (this.line) {
      this.line.rotation.z -= pitch; // the line hangs straight down whatever the rod does
      this.line.scale.y *= reel + dip / 1.85;
      this.line.visible = !fish;
    }
    if (this.fish) {
      this.fish.visible = fish;
      this.fish.rotation.z -= pitch;
      this.fish.rotation.x += Math.sin(clock * 9) * 0.3;
    }
    if (this.head) {
      this.nod = Math.max(0, this.nod - dt);
      if (this.nod > 0) this.head.rotation.z -= Math.sin(this.nod * Math.PI) * 0.25; // a nod, and not a word
      this.head.rotation.y += Math.sin(clock * 0.23) * 0.3;
    }
  }
}

/**
 * The rare sightings, off the island's edges and over it: a hot-air balloon on calm summer
 * evenings, a murmuration of starlings at dusk in autumn, a seal hauled out on the beach, ships
 * on the horizon (the ferry, to its timetable; a container ship now and then; very rarely a tall
 * ship), and a fisherman at the end of the pier on some early mornings. (The geese and the
 * dolphins, and the black sheep that turns up more on Friday the 13th, are in fauna.ts.)
 */
export class Sightings {
  private balloon?: Balloon;
  private murmuration: Murmuration;
  private seal?: Seal;
  private ferry?: Ship;
  private container?: Ship;
  private tallship?: Ship;
  private fisherman?: Fisherman;
  private containerWait = LUCK.containerSoon ? 2 : rand(60, 360);
  private tallshipWait = LUCK.tallshipSoon ? 2 : rand(60, 400);
  private tallshipDone = false;
  private hornedFerry = -1;
  private hornedContainer = false;
  private ferryStart = -1;
  private clock = 0;
  private now = 0;
  /** A sound from one of them (the island plays it if it's in earshot). */
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean) => void;

  constructor(scene: THREE.Scene, island: Island, template: (species: string) => THREE.Object3D | undefined, ground: Ground, private particles: Particles) {
    const call = (c: Call, at: THREE.Vector3, ambient?: boolean) => this.onCall?.(c, at, ambient);
    this.murmuration = new Murmuration(scene);
    const T = template;
    const balloon = T('balloon');
    if (balloon) {
      this.balloon = new Balloon(balloon, scene);
      this.balloon.onCall = call;
    }
    this.murmuration.onCall = call;
    const seal = T('seal');
    if (seal) {
      this.seal = new Seal(seal, scene, ground, particles);
      this.seal.onCall = call;
    }
    const ship = (s: string, length: number, size = 1) => {
      const t = T(s);
      return t ? new Ship(s, t, scene, particles, length, size) : undefined;
    };
    // the ferry close in, where she'd look a toy beside a 4 m kayak: built small, sailed big
    this.ferry = ship('ferry', 9.8, 2.4);
    // and the container ship the same way, bigger again: twice the ferry's length and more
    this.container = ship('container', 15, 3.4);
    this.tallship = ship('tallship', 8);
    const fisherman = T('fisherman');
    const dock = island.positionOf('dock');
    if (fisherman && dock) {
      // sitting on the very end of the pier (DOCK_LEN on from where it's placed), just west of the middle
      this.fisherman = new Fisherman(fisherman, scene, V(dock.x - 0.1, DECK, dock.z + 10.85));
      this.fisherman.onCall = call;
    }
  }

  /** All of them, for the Picker. */
  get pickables() {
    return [this.balloon?.body, this.seal?.body, this.ferry?.body, this.container?.body, this.tallship?.body, this.fisherman?.body]
      .filter((b): b is Body => !!b).map((b) => b.root).concat(this.murmuration.hit);
  }

  /** Someone clicked one of them. */
  poke(id: string) {
    if (id === 'balloon') this.balloon?.wave();
    if (id === 'seal') this.seal?.poke();
    if (id === 'fisherman') this.fisherman?.poke();
  }

  /** How many fish in the fisherman's bucket. */
  get catches() {
    return this.fisherman?.catches ?? 0;
  }

  /** The ferry going past (as "07:30"), and the next one after it, by the timetable. */
  get ferryTimes(): { now: string; next: string | null } {
    const d = new Date(this.now);
    const h = d.getHours() + (d.getMinutes() >= 30 ? 0.5 : 0);
    return { now: hhmm(h), next: h + 0.5 <= FERRY.last ? hhmm(h + 0.5) : null };
  }

  update(dt: number, o: Outlook) {
    this.clock += dt;
    this.now = o.time;
    const t = this.clock;
    this.balloon?.update(dt, o, t);
    this.murmuration.update(dt, o);
    this.seal?.update(dt, o, t);
    this.fisherman?.update(dt, o, t);
    const swell = clamp(o.wind / 15, 0, 1);

    // the ferry, where the timetable says it is (?animal=ferry: one leaving now)
    if (this.ferry) {
      const d = new Date(o.time);
      let secs = (d.getMinutes() % 30) * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
      let out = d.getMinutes() < 30;
      let running = d.getHours() + (out ? 0 : 0.5) >= FERRY.first && d.getHours() + (out ? 0 : 0.5) <= FERRY.last;
      if (LUCK.ferrySoon) {
        if (this.ferryStart < 0) this.ferryStart = t;
        secs = (t - this.ferryStart + 20) % 1800;
        [out, running] = [true, true];
      }
      if (running && secs < FERRY.crossing) {
        const k = secs / FERRY.crossing;
        const dir = out ? 1 : -1;
        this.ferry.at(dir * FERRY.reach * (2 * k - 1), FERRY.z, dir);
        const trip = Math.floor(o.time / 1.8e6);
        if (k > 0.45 && this.hornedFerry !== trip) {
          this.hornedFerry = trip;
          this.onCall?.('horn', this.ferry.position.clone(), true);
        }
      } else if (this.ferry.sailing) this.ferry.dock();
      this.ferry.update(dt, t, swell);
    }

    // a container ship now and then, day or night, far out on one side or the other
    if (this.container) {
      if (!this.container.sailing && (this.containerWait -= dt) <= 0) {
        this.container.sail(pick([56, -60]), chance(0.5) ? 1 : -1, 1.4, 135);
        this.hornedContainer = false;
      }
      this.container.update(dt, t, swell);
      if (this.container.sailing && !this.hornedContainer && Math.abs(this.container.along) < 8) {
        this.hornedContainer = true;
        if (chance(0.35)) this.onCall?.('horn', this.container.position.clone(), true);
      }
      if (this.container.sailing && Math.abs(this.container.along) > 136) {
        this.container.dock();
        this.containerWait = rand(300, 900);
      }
    }

    // and on some visits, once, a tall ship under full sail, in daylight and fair weather
    if (this.tallship && LUCK.tallship && !this.tallshipDone) {
      if (!this.tallship.sailing && (this.tallshipWait -= dt) <= 0 && (LUCK.tallshipSoon || (o.night < 0.4 && o.storm < 0.2 && o.wind < 14))) {
        this.tallship.sail(pick([44, -48]), chance(0.5) ? 1 : -1, 0.9, 110);
      }
      this.tallship.update(dt, t, swell);
      if (this.tallship.sailing && Math.abs(this.tallship.along) > 111) {
        this.tallship.dock();
        this.tallshipDone = true;
      }
    }
  }
}
