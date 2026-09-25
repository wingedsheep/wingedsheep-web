import * as THREE from 'three';
import { season } from '../scene/season';
import type { RiverAssets } from './assets';
import type { Course } from './course';
import type { Spot } from './land';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** The turn that points a model's front (+x, as the animals are built) along (dx, dz). */
const face = (dx: number, dz: number) => Math.atan2(-dz, dx);

export interface WildlifeEvents {
  /** Something happened worth a line on screen. */
  say?(text: string): void;
  croak?(): void;
  quack?(): void;
  baa?(): void;
  bark?(): void;
}

interface Actor {
  s: number;
  root: THREE.Object3D;
  /** Returns false once it's done and can go. */
  update(dt: number, kayak: THREE.Vector3): boolean;
}

// --- particles --------------------------------------------------------------------------------

const MAX = 900;

/**
 * Little square specks, one texel each (or two): spray off the bow and the rocks, drips off the
 * paddle, mist at the foot of a fall, leaves drifting on the current, rain and snow, dragonflies
 * over slow water by day and fireflies along the banks at night.
 */
class Specks {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private kind = new Uint8Array(MAX); // 0 falls with gravity, 1 floats on the current, 2 drifts, 3 flits
  private next = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(V(), 1e6);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: true }));
    this.points.frustumCulled = false;
    this.life.fill(0);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -1e4;
  }

  emit(at: THREE.Vector3, v: THREE.Vector3, color: THREE.Color, life: number, kind = 0) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.pos.set([at.x, at.y, at.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.life[i] = life;
    this.kind[i] = kind;
  }

  /** `flow` gives the current at a point (for things floating on it). */
  update(dt: number, t: number, flow: (x: number, z: number, out: THREE.Vector3) => THREE.Vector3) {
    const f = V();
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) {
        this.pos[k + 1] = -1e4;
        continue;
      }
      switch (this.kind[i]) {
        case 0:
          this.vel[k + 1] -= 9.8 * dt;
          break;
        case 1:
          flow(this.pos[k], this.pos[k + 2], f);
          this.vel[k] = f.x;
          this.vel[k + 2] = f.z;
          break;
        case 3: // flitting: a dragonfly's darts, a firefly's wander
          if (Math.random() < dt * 1.5) this.vel.set([rand(-2, 2), rand(-0.3, 0.3), rand(-2, 2)], k);
          this.pos[k + 1] += Math.sin(t * 3 + i) * 0.005;
          break;
      }
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -1e4;
  }
}

const WHITE = new THREE.Color('#f2f7f6');
const FOAM = new THREE.Color('#d6ecea');
const DRIP = new THREE.Color('#a8d8e0');
const GOLD = new THREE.Color('#ffd35a');
const EMBER = new THREE.Color('#ff9a3c');
const FIREFLY = new THREE.Color('#fff38a');
const DRAGONFLY = new THREE.Color('#3fa8d8');
const RAIN = new THREE.Color('#b8cde0');
const LEAVES_GREEN = ['#4a8c45', '#72b04c'].map((c) => new THREE.Color(c));
const LEAVES_AUTUMN = ['#cc622c', '#d4ae40', '#a0392c', '#e08a3a'].map((c) => new THREE.Color(c));
const BLOSSOM = ['#f2c3d6', '#fbe0ea'].map((c) => new THREE.Color(c));

/**
 * Life along the river: the animals the land left room for (a heron fishing, ducks, deer
 * drinking, fish jumping), a kingfisher flashing past, Beike running the bank for
 * a while, now and then the winged sheep overhead, and all the specks.
 */
export class Wildlife {
  readonly group = new THREE.Group();
  readonly specks = new Specks();
  events: WildlifeEvents = {};
  /** The ground's height at (x, z), for animals on the bank. */
  ground: (x: number, z: number) => number = () => 0;
  private actors: Actor[] = [];
  private clock = 0;
  private kingfisherIn = rand(12, 30);
  private sheepIn = rand(90, 200);
  private beikeDone = false;

  constructor(private assets: RiverAssets, private course: Course) {
    this.group.add(this.specks.points);
  }

  reset(course: Course) {
    this.course = course;
    for (const a of this.actors) a.root.removeFromParent();
    this.actors = [];
    this.specks.clear();
    this.kingfisherIn = rand(12, 30);
    this.sheepIn = rand(90, 200);
    this.beikeDone = false;
  }

  /** A chunk of river came into view with places for animals. */
  settle(spots: Spot[]) {
    for (const spot of spots) {
      const a = this.spawn(spot);
      if (a) this.actors.push(a);
    }
  }

  update(dt: number, kayak: THREE.Vector3, s: number, speed: number, night: number, rain: number, snow: number, fair: boolean) {
    this.clock += dt;
    this.actors = this.actors.filter((a) => {
      const keep = a.s > s - 45 && a.update(dt, kayak);
      if (!keep) a.root.removeFromParent();
      return keep;
    });

    // a kingfisher, straight up the river past you, low over the water
    if ((this.kingfisherIn -= dt) < 0 && night < 0.3) {
      this.kingfisherIn = rand(25, 60);
      this.actors.push(this.kingfisher(s));
    }
    // the winged sheep, crossing high over the river
    if ((this.sheepIn -= dt) < 0 && fair) {
      this.sheepIn = rand(180, 360);
      this.actors.push(this.wingedSheep(s));
    }
    // Beike, once a trip: somewhere open, a few hundred metres down
    const p = this.course.at(s);
    if (!this.beikeDone && s > 200 && p.clear > 0.6 && p.gorge < 0.3 && night < 0.5) {
      const beike = this.beike(s);
      if (beike) {
        this.beikeDone = true;
        this.actors.push(beike);
      }
    }

    this.ambient(dt, kayak, s, night, rain, snow);
    this.specks.update(dt, this.clock, (x, z, out) => this.flow(x, z, out));
  }

  /** The current at (x, z): for leaves and foam floating on it. */
  private flow(x: number, z: number, out: THREE.Vector3) {
    const { sample: p } = this.course.nearest(x, z);
    return out.set(Math.sin(p.a) * p.speed, 0, -Math.cos(p.a) * p.speed);
  }

  // --- specks ---------------------------------------------------------------------------------

  /** A burst of spray: off a rock, a knock, a landing. */
  spray(at: THREE.Vector3, count: number, power = 1) {
    for (let i = 0; i < count; i++) {
      const v = V(rand(-1, 1), rand(1.5, 3.5) * power, rand(-1, 1)).multiplyScalar(power);
      this.specks.emit(at.clone().add(V(rand(-0.3, 0.3), 0.1, rand(-0.3, 0.3))), v, i % 3 ? WHITE : FOAM, rand(0.4, 0.9));
    }
  }

  /** A ring of spray thrown out flat across the water: a landing, a big smack. */
  ring(at: THREE.Vector3, count: number, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.1, 0.1);
      const v = V(Math.cos(a) * rand(2.5, 4) * power, rand(0.8, 1.6) * power, Math.sin(a) * rand(2.5, 4) * power);
      this.specks.emit(at.clone().add(V(Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8)), v, i % 2 ? WHITE : FOAM, rand(0.35, 0.6));
    }
  }

  /** Glints thrown up round the kayak: a ball fished out, the flow going up a notch. */
  sparkle(at: THREE.Vector3, count: number, color: THREE.Color = GOLD, power = 1) {
    for (let i = 0; i < count; i++) {
      const v = V(rand(-1.5, 1.5), rand(2, 4.5), rand(-1.5, 1.5)).multiplyScalar(power);
      this.specks.emit(at.clone().add(V(rand(-0.6, 0.6), 0.6, rand(-0.6, 0.6))), v, color, rand(0.5, 1));
    }
  }

  /** A glint left floating in the wake, when the flow's running hot. */
  glint(at: THREE.Vector3) {
    this.specks.emit(at.clone().setY(at.y + 0.08), V(), Math.random() < 0.5 ? GOLD : EMBER, rand(0.4, 0.9), 1);
  }

  /** Drips off the paddle's blade. */
  drip(at: THREE.Vector3) {
    this.specks.emit(at, V(rand(-0.3, 0.3), rand(0, 0.6), rand(-0.3, 0.3)), DRIP, 0.5);
  }

  /** Froth left behind on the water, floating off downstream. */
  froth(at: THREE.Vector3) {
    this.specks.emit(at.clone().setY(at.y + 0.05), V(), FOAM, rand(0.8, 1.6), 1);
  }

  private ambient(dt: number, kayak: THREE.Vector3, s: number, night: number, rain: number, snow: number) {
    const p = this.course.at(s + 12);
    const half = p.width / 2;
    const rx = Math.cos(p.a);
    const rz = Math.sin(p.a);
    // leaves and petals on the water, drifting down with you
    const leafy = season.turn > 0.3 ? LEAVES_AUTUMN : season.blossom > 0.3 ? BLOSSOM : LEAVES_GREEN;
    if (Math.random() < dt * (0.25 + season.turn * 0.8 + season.blossom * 0.8)) {
      const q = this.course.at(s + rand(10, 35));
      const u = rand(-0.9, 0.9) * q.width / 2;
      this.specks.emit(V(q.x + Math.cos(q.a) * u, q.y + 0.04, q.z + Math.sin(q.a) * u), V(), leafy[Math.floor(Math.random() * leafy.length)], 10, 1);
    }
    // over slow water on a summer's day: dragonflies. Along the banks at night: fireflies
    const warm = season.weights.summer + season.weights.spring * 0.4;
    if (p.speed < 4.5 && night < 0.3 && Math.random() < dt * warm * 1.5) {
      const u = rand(-1, 1) * half;
      this.specks.emit(V(p.x + rx * u, p.y + rand(0.5, 1.2), p.z + rz * u), V(), DRAGONFLY, rand(4, 8), 3);
    }
    if (night > 0.6 && warm > 0.3 && Math.random() < dt * 6) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const u = side * (half + rand(0.5, 6));
      const q = this.course.at(s + rand(-10, 30));
      this.specks.emit(V(q.x + Math.cos(q.a) * u, q.y + rand(0.6, 2), q.z + Math.sin(q.a) * u), V(), FIREFLY, rand(3, 6), 3);
    }
    // rain, and snow, falling round you
    const fall = (rain + snow) * 60;
    for (let n = Math.floor(fall * dt + Math.random()); n > 0; n--) {
      const at = kayak.clone().add(V(rand(-22, 22), rand(8, 14), rand(-30, 12)));
      if (Math.random() < snow / Math.max(rain + snow, 0.01)) this.specks.emit(at, V(rand(-0.5, 0.5), -1.2, rand(-0.5, 0.5)), WHITE, 10, 2);
      else this.specks.emit(at, V(0.4, -16, 0), RAIN, 1, 2);
    }
  }

  // --- the animals ----------------------------------------------------------------------------

  private spawn(spot: Spot): Actor | null {
    switch (spot.kind) {
      case 'heron': return this.heron(spot);
      case 'ducks': return this.ducks(spot);
      case 'deer': return this.deer(spot);
      case 'sheep': return this.sheep(spot);
      case 'fish': return this.fish(spot);
    }
  }

  /** A heron fishing the shallows, dead still, until you come too close: then off, complaining. */
  private heron(spot: Spot): Actor {
    const root = this.assets.clone('heron');
    root.position.set(spot.x, spot.y - 0.35, spot.z);
    root.rotation.y = face(Math.sin(spot.a) * -1, Math.cos(spot.a)) + rand(-0.8, 0.8); // looking upstream, mostly
    this.group.add(root);
    const wings = [root.getObjectByName('heron_wing_l'), root.getObjectByName('heron_wing_r')];
    const neck = root.getObjectByName('heron_neck');
    let flying = -1;
    const away = V(Math.cos(spot.a) * spot.side, 0, Math.sin(spot.a) * spot.side);
    return {
      s: spot.s,
      root,
      update: (dt, kayak) => {
        if (flying < 0 && root.position.distanceTo(kayak) < 11) {
          flying = 0;
          root.rotation.y = face(away.x + Math.sin(spot.a) * 0.6, away.z - Math.cos(spot.a) * 0.6);
          this.events.croak?.();
        }
        if (flying < 0) {
          if (neck) neck.rotation.z = Math.sin(this.clock * 0.4 + spot.s) > 0.97 ? -0.6 : 0; // now and then, a strike
          return true;
        }
        flying += dt;
        const beat = Math.sin(flying * 9);
        wings.forEach((w, i) => w && (w.rotation.x = (i ? -1 : 1) * beat * 0.9));
        root.position.addScaledVector(away, dt * 4).add(V(Math.sin(spot.a) * dt * 3, dt * Math.min(3, 1 + flying), -Math.cos(spot.a) * dt * 3));
        if (neck) neck.rotation.z = 0.5;
        return flying < 7;
      },
    };
  }

  /** A mallard and her ducklings, paddling along the edge; they make for the bank when you come by. */
  private ducks(spot: Spot): Actor {
    const root = new THREE.Group();
    const mum = this.assets.clone('duck');
    root.add(mum);
    const brood = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, i) => {
      const d = this.assets.clone('duckling');
      d.position.set(-0.5 - i * 0.38, 0, rand(-0.12, 0.12));
      root.add(d);
      return d;
    });
    root.position.set(spot.x, spot.y, spot.z);
    const up = face(-Math.sin(spot.a), Math.cos(spot.a)); // paddling upstream
    root.rotation.y = up;
    this.group.add(root);
    let fled = false;
    const bank = V(Math.cos(spot.a) * spot.side, 0, Math.sin(spot.a) * spot.side);
    return {
      s: spot.s,
      root,
      update: (dt, kayak) => {
        const t = this.clock;
        mum.position.y = Math.sin(t * 2.2) * 0.02;
        brood.forEach((d, i) => (d.position.y = Math.sin(t * 3 + i) * 0.015));
        if (!fled && root.position.distanceTo(kayak) < 9) {
          fled = true;
          this.events.quack?.();
        }
        if (fled) {
          root.rotation.y += (face(bank.x, bank.z) - root.rotation.y) * Math.min(1, dt * 2);
          root.position.addScaledVector(bank, dt * 0.8);
        } else {
          root.position.add(V(-Math.sin(spot.a) * dt * 0.25, 0, Math.cos(spot.a) * dt * 0.25));
        }
        return true;
      },
    };
  }

  /** Red deer come down to drink. Heads up as you come round the bend; gone as you pass. */
  private deer(spot: Spot): Actor {
    const root = this.assets.clone('deer');
    root.position.set(spot.x, spot.y, spot.z);
    const toWater = V(-Math.cos(spot.a) * spot.side, 0, -Math.sin(spot.a) * spot.side);
    root.rotation.y = face(toWater.x, toWater.z);
    this.group.add(root);
    const neck = root.getObjectByName('deer_neck');
    const legs = ['fl', 'fr', 'bl', 'br'].map((k) => root.getObjectByName(`deer_leg_${k}`));
    let bolt = -1;
    return {
      s: spot.s,
      root,
      update: (dt, kayak) => {
        const d = root.position.distanceTo(kayak);
        const wary = d < 20;
        if (bolt < 0 && d < 11) {
          bolt = 0;
          root.rotation.y = face(-toWater.x + rand(-0.3, 0.3), -toWater.z);
        }
        if (bolt < 0) {
          // drinking, and looking up when something's coming
          if (neck) neck.rotation.z += ((wary ? 0.1 : -0.95) - neck.rotation.z) * Math.min(1, dt * 4);
          return true;
        }
        bolt += dt;
        const run = Math.sin(bolt * 14);
        legs.forEach((l, i) => l && (l.rotation.z = (i < 2 ? 1 : -1) * run * 0.7));
        root.position.addScaledVector(toWater, -dt * 6);
        root.position.y += Math.abs(run) * 0.02;
        if (neck) neck.rotation.z = 0.2;
        return bolt < 4;
      },
    };
  }

  /** Sheep on the meadow, heads down, now and then one says so. */
  private sheep(spot: Spot): Actor {
    const root = new THREE.Group();
    const flock = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
      const s = this.assets.clone('sheep');
      s.position.set(rand(-2, 2), 0, rand(-2, 2));
      s.rotation.y = rand(0, Math.PI * 2);
      root.add(s);
      return { s, head: s.getObjectByName('sheep_head'), seed: Math.random() * 10 };
    });
    root.position.set(spot.x, spot.y, spot.z);
    this.group.add(root);
    let said = false;
    return {
      s: spot.s,
      root,
      update: (_, kayak) => {
        for (const f of flock) if (f.head) f.head.rotation.z = Math.sin(this.clock * 0.7 + f.seed) > 0 ? -0.7 : 0;
        if (!said && root.position.distanceTo(kayak) < 10) {
          said = true;
          if (Math.random() < 0.5) this.events.baa?.();
        }
        return true;
      },
    };
  }

  /** In the slow water, a fish jumps now and then. */
  private fish(spot: Spot): Actor {
    const root = this.assets.clone('fish');
    root.visible = false;
    root.scale.setScalar(1.6);
    this.group.add(root);
    let wait = rand(0.5, 5);
    let jump = -1;
    const dir = rand(0, Math.PI * 2);
    return {
      s: spot.s,
      root,
      update: (dt) => {
        if (jump < 0) {
          if ((wait -= dt) < 0) {
            jump = 0;
            root.visible = true;
            this.spray(V(spot.x, spot.y, spot.z), 6, 0.5);
          }
          return true;
        }
        jump += dt;
        const t = jump / 0.7;
        root.position.set(spot.x + Math.cos(dir) * t * 1.2, spot.y + Math.sin(Math.PI * t) * 0.9, spot.z + Math.sin(dir) * t * 1.2);
        root.rotation.set(0, -dir, Math.cos(Math.PI * t) * 0.9);
        if (t >= 1) {
          this.spray(root.position, 8, 0.6);
          root.visible = false;
          jump = -1;
          wait = rand(4, 12);
        }
        return true;
      },
    };
  }

  private kingfisher(s: number): Actor {
    const root = this.assets.clone('kingfisher');
    root.scale.setScalar(2.2); // a speck otherwise: the river's own flash of blue
    const side = rand(-0.6, 0.6);
    let at = s + 40;
    const wings = [root.getObjectByName('kingfisher_wing_l'), root.getObjectByName('kingfisher_wing_r')];
    this.group.add(root);
    return {
      s,
      root,
      update: (dt) => {
        at -= dt * 14;
        const p = this.course.at(at);
        const u = side * p.width / 2;
        root.position.set(p.x + Math.cos(p.a) * u, p.y + 0.9 + Math.sin(at * 0.5) * 0.2, p.z + Math.sin(p.a) * u);
        root.rotation.y = face(-Math.sin(p.a), Math.cos(p.a));
        const beat = Math.sin(this.clock * 40);
        wings.forEach((w, i) => w && (w.rotation.x = (i ? -1 : 1) * beat));
        return at > s - 40;
      },
    };
  }

  private wingedSheep(s: number): Actor {
    const root = this.assets.clone('wingedsheep');
    const p = this.course.at(s + 18);
    const rx = Math.cos(p.a);
    const rz = Math.sin(p.a);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const from = V(p.x - rx * dir * 40, p.y + 9, p.z - rz * dir * 40);
    root.position.copy(from);
    root.rotation.y = face(rx * dir, rz * dir);
    this.group.add(root);
    const wings = [root.getObjectByName('wing_l'), root.getObjectByName('wing_r')];
    let t = 0;
    return {
      s: s + 18,
      root,
      update: (dt) => {
        t += dt;
        root.position.set(from.x + rx * dir * t * 6, from.y + Math.sin(t * 1.3) * 0.6, from.z + rz * dir * t * 6);
        const beat = Math.sin(t * 5);
        wings.forEach((w, i) => w && (w.rotation.x = (i ? -1 : 1) * beat * 0.7));
        if (t > 6 && t - dt <= 6) this.events.baa?.();
        return t < 14;
      },
    };
  }

  /**
   * Beike, running the bank alongside you with his ball in his mouth, barking now and then.
   * After a while something smells more interesting, and he stops to sit and watch you go.
   */
  private beike(s: number): Actor | null {
    const p = this.course.at(s + 10);
    const side = Math.random() < 0.5 ? -1 : 1;
    const root = this.assets.clone('beike');
    root.scale.multiplyScalar(1.5); // a dog, from this high up, is a speck otherwise
    this.group.add(root);
    const legs = ['fl', 'fr', 'bl', 'br'].map((k) => root.getObjectByName(`beike_leg_${k}`));
    const tail = root.getObjectByName('beike_tail');
    let at = s + 10;
    let t = 0;
    let barkIn = 1.5;
    const run = rand(16, 24);
    this.events.say?.('Beike has spotted you. He’ll keep pace along the bank for a bit.');
    let e = 3;
    const place = (sPos: number) => {
      const q = this.course.at(sPos);
      const u = side * (q.width / 2 + e);
      const x = q.x + Math.cos(q.a) * u;
      const z = q.z + Math.sin(q.a) * u;
      const near = this.course.nearest(x, z);
      if (near.d - near.sample.width / 2 < 1) e = Math.min(e + 0.5, 8);
      root.position.set(x, this.ground(x, z), z);
      return q;
    };
    place(at);
    return {
      s,
      root,
      update: (dt, kayak) => {
        t += dt;
        const running = t < run;
        const q = this.course.at(at);
        if (running) {
          // keep level with the kayak, a boat's length ahead
          const target = this.course.nearest(kayak.x, kayak.z).sample.s + 4;
          at += Math.max(0, Math.min(9, (target - at) * 2 + 3)) * dt;
          const g = Math.sin(t * 16);
          legs.forEach((l, i) => l && (l.rotation.z = (i % 2 ? 1 : -1) * g * 0.8));
          root.rotation.y = face(Math.sin(q.a), -Math.cos(q.a));
          if ((barkIn -= dt) < 0) {
            barkIn = rand(2.5, 5);
            this.events.bark?.();
          }
        } else {
          legs.forEach((l) => l && (l.rotation.z *= 0.9));
          root.rotation.y += (face(-Math.cos(q.a) * side, -Math.sin(q.a) * side) - root.rotation.y) * Math.min(1, dt * 3);
        }
        if (tail) tail.rotation.x = Math.sin(t * 12) * 0.3;
        place(at);
        if (running) root.position.y += Math.abs(Math.sin(t * 16)) * 0.08;
        return !running ? t < run + 20 : true;
      },
    };
  }
}
