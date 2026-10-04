import * as THREE from 'three';
import type { Island } from './island';
import { season } from './season';
import type { Sky } from './sky';
import type { Weather } from './weather';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const smooth = THREE.MathUtils.smoothstep;

const MAX = 160;
const MOST_BLOOMS = 1500;
/** The wild flowers' heads (nature.py flowers): the stems are this green, and nobody visits a stem. */
const STEM = new THREE.Color('#3f7d43');
const BEE = new THREE.Color('#f2c53a');
const BEE_DARK = new THREE.Color('#3a2a10');
const MOTH = new THREE.Color('#efe6cc');
const MIDGE = new THREE.Color('#ffe3a0');
const DRAGONFLY = [new THREE.Color('#3f8fd8'), new THREE.Color('#58c0c8')];
/** Wings open, then the underside as they close: cabbage white, brimstone, small tortoiseshell, common blue, peacock. */
const BUTTERFLIES: [string, string, number][] = [
  ['#f7f5ec', '#d8d8c4', 4],
  ['#f2e15a', '#d9cf7a', 2],
  ['#e8823a', '#5a3a28', 2],
  ['#8fb4f0', '#c8c0d8', 1.5],
  ['#b8423a', '#3a2830', 1],
];

type Kind = 'bee' | 'butterfly' | 'moth' | 'dragonfly' | 'midge';

interface Critter {
  kind: Kind;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Where it's heading, or hovering over. */
  goal: THREE.Vector3;
  /** What it keeps coming back to: the lamp a moth circles, a dragonfly's stretch of shore, the midges' column. */
  home: THREE.Vector3;
  state: 'fly' | 'hover' | 'sit';
  t: number; // seconds left in this state
  phase: number;
  color: THREE.Color;
  under: THREE.Color; // the other colour it flickers to
  fade: number; // 0..1, coming and going
  leaving: boolean;
}

/**
 * The small life of a fine day, each kind out only when it would be: bees going from flower to
 * flower and butterflies flitting over the grass on a mild, calm, dry day (spring most of all),
 * dragonflies darting off the shore on a warm summer's day, moths round the lamps on a mild night,
 * and on a still summer evening a column of midges dancing in the low sun. All of them a pixel or
 * two, kept near where you're looking; none of them sits still long enough to click on.
 */
export class Critters {
  private points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 4);
  private size = new Float32Array(MAX);
  private bugs: Critter[] = [];
  private blooms: THREE.Vector3[] | null = null;
  /** The blooms within reach of the view, refreshed every second or so. */
  private near: THREE.Vector3[] = [];
  private nearIn = 0;
  private clock = 0;

  constructor(
    scene: THREE.Scene,
    private island: Island,
    private sea: (x: number, y: number) => boolean,
  ) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec4 color;
        varying vec4 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        void main() {
          if (vColor.a < 0.02) discard;
          gl_FragColor = vColor;
          #include <colorspace_fragment>
        }
      `,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.raycast = () => {};
    scene.add(this.points);
  }

  update(dt: number, sky: Sky, weather: Weather, around: THREE.Vector3, view: number) {
    this.clock += dt;
    const size = Math.max(16, view * 0.9);
    this.blooms ??= this.findBlooms();
    if ((this.nearIn -= dt) < 0) {
      this.nearIn = 1;
      this.near = this.blooms.filter((b) => Math.abs(b.x - around.x) < size && Math.abs(b.z - around.z) < size);
    }

    // what the day allows
    const w = weather.now;
    const s = season.weights;
    const temp = weather.temperature;
    const dry = 1 - smooth(w.rain + w.snow + w.hail, 0, 0.08);
    const day = smooth(1 - sky.lamps, 0.5, 0.9);
    const calm = 1 - smooth(weather.gust, 0.2, 0.65);
    const sun = 1 - Math.min(1, w.cloud * 0.7 + w.fog);
    const flowering = this.near.length ? 1 : 0;
    const want: Record<Kind, number> = {
      bee: 14 * (s.spring + s.summer * 0.7 + s.autumn * 0.15) * smooth(temp, 9, 15) * day * dry * calm * (0.4 + sun * 0.6) * flowering,
      butterfly: 8 * (s.spring + s.summer * 0.8 + s.autumn * 0.2) * smooth(temp, 12, 18) * day * dry * calm * (0.25 + sun * 0.75) * flowering,
      dragonfly: 4 * s.summer * smooth(temp, 17, 22) * day * dry * (1 - smooth(weather.wind, 4, 8)) * (0.5 + sun * 0.5),
      // round the lamps once it's properly dark: a mild night, not the cold or the wet or a wind
      moth: 3 * (s.summer + s.autumn * 0.6 + s.spring * 0.3) * smooth(temp, 8, 14) * smooth(sky.lamps, 0.6, 0.9) * dry * (1 - smooth(weather.wind, 5, 9)),
      // a still summer evening, the sun low and going down
      midge: 14 * (s.summer + s.spring * 0.5) * smooth(temp, 12, 16) * dry * (1 - smooth(weather.wind, 2, 3.5)) * sun
        * (!sky.rising && sky.alt > -1 && sky.alt < 10 ? 1 : 0),
    };

    // too far from the view, gone; more than the day wants, off they go
    this.bugs = this.bugs.filter((b) => b.fade > 0 || !b.leaving);
    this.bugs = this.bugs.filter((b) => Math.abs(b.pos.x - around.x) < size * 1.5 && Math.abs(b.pos.z - around.z) < size * 1.5);
    for (const kind of Object.keys(want) as Kind[]) {
      const goal = Math.round(want[kind]);
      const mine = this.bugs.filter((b) => b.kind === kind && !b.leaving);
      for (let i = goal; i < mine.length; i++) mine[i].leaving = true;
      // a few at a time, so they arrive rather than appear
      if (mine.length < goal && this.bugs.length < MAX && Math.random() < dt * 3) this.spawn(kind, around, size);
    }

    for (const b of this.bugs) {
      b.fade = THREE.MathUtils.clamp(b.fade + (b.leaving ? -dt / 1.5 : dt), 0, 1);
      if (b.kind === 'bee') this.bee(b, dt);
      else if (b.kind === 'butterfly') this.butterfly(b, dt);
      else if (b.kind === 'moth') this.moth(b, dt);
      else if (b.kind === 'dragonfly') this.dragonfly(b, dt);
      else this.midge(b);
    }
    this.draw(1 - sky.lamps * 0.4);
  }

  // --- who comes out where -----------------------------------------------------------

  private spawn(kind: Kind, around: THREE.Vector3, size: number) {
    let home: THREE.Vector3 | null = null;
    if (kind === 'bee' || kind === 'butterfly') home = this.near.length ? pick(this.near).clone() : null;
    else if (kind === 'moth') {
      // a lamp that's on, near the view, with fewer than three already round it
      const lamps = this.island.lights.filter((l) => !l.day && l.position.distanceTo(around) < size
        && this.bugs.filter((b) => b.kind === 'moth' && b.home.distanceTo(l.position) < 0.1).length < 3);
      home = lamps.length ? pick(lamps).position.clone() : null;
    } else if (kind === 'dragonfly') home = this.offshore(around, size);
    else {
      // the midges dance in one column: theirs, if they've started, or somewhere over the flowers
      const other = this.bugs.find((b) => b.kind === 'midge');
      home = other ? other.home.clone() : this.near.length ? pick(this.near).clone().add(V(0, 1.6, 0)) : null;
    }
    if (!home) return;
    const butterfly = pick(BUTTERFLIES.flatMap(([a, b, n]) => Array.from({ length: n * 2 }, () => [a, b])));
    const color = kind === 'bee' ? BEE : kind === 'moth' ? MOTH : kind === 'midge' ? MIDGE : kind === 'dragonfly' ? DRAGONFLY[0] : new THREE.Color(butterfly[0]);
    const under = kind === 'bee' ? BEE_DARK : kind === 'dragonfly' ? DRAGONFLY[1] : kind === 'butterfly' ? new THREE.Color(butterfly[1]) : color;
    // bees and butterflies come in from a little way off, the rest are where they keep to
    const start = kind === 'bee' || kind === 'butterfly' ? home.clone().add(V(rand(-3, 3), rand(0.8, 2), rand(-3, 3))) : home.clone().add(V(rand(-0.5, 0.5), rand(-0.2, 0.2), rand(-0.5, 0.5)));
    this.bugs.push({
      kind, pos: start, vel: V(), goal: kind === 'bee' ? home.clone().add(V(0, 0.12, 0)) : home.clone(), home,
      state: 'fly', t: rand(2, 5), phase: rand(0, 100), color, under, fade: 0, leaving: false,
    });
  }

  /** A spot just off the shore, out of the surf: open water within a few metres of land. */
  private offshore(around: THREE.Vector3, size: number) {
    for (let i = 0; i < 20; i++) {
      const x = around.x + rand(-size, size) * 0.8;
      const y = -around.z + rand(-size, size) * 0.6; // blender coordinates: y = -z
      if (!this.sea(x, y)) continue;
      const a = rand(0, Math.PI * 2);
      if (this.sea(x + Math.cos(a) * 4, y + Math.sin(a) * 4) && this.sea(x - Math.cos(a) * 4, y - Math.sin(a) * 4)) continue;
      return V(x, rand(0.5, 1), -y);
    }
    return null;
  }

  /**
   * Every flower head on the island that's out (the wild flowers dressIsland has left showing),
   * the crocuses and snowdrops while they're up, and in April the blossom on the cherry tree.
   */
  private findBlooms() {
    const out: THREE.Vector3[] = [];
    const seen = new Set<string>();
    const p = V();
    this.island.root.updateMatrixWorld(true);
    this.island.root.getObjectByName('flowers')?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) return;
      const c = (mesh.material as THREE.MeshToonMaterial).color;
      if (c && Math.abs(c.r - STEM.r) + Math.abs(c.g - STEM.g) + Math.abs(c.b - STEM.b) < 0.08) return;
      const at = mesh.geometry.getAttribute('position');
      for (let i = 0; i < at.count; i++) {
        p.fromBufferAttribute(at, i).applyMatrix4(mesh.matrixWorld);
        const key = `${Math.round(p.x / 0.3)},${Math.round(p.z / 0.3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p.clone());
      }
    });
    this.island.root.traverse((o) => {
      const { bulb, spots } = o.userData as { bulb?: string; spots?: number[] };
      if (!bulb || !spots) return;
      const up = bulb.startsWith('snowdrop') ? season.snowdrops : season.crocuses;
      for (let i = 0; i < spots.length; i += 6) {
        if (spots[i + 5] >= up) continue;
        out.push(V(spots[i], spots[i + 2] + 0.12, -spots[i + 1])); // Blender's (x, y, z) is (x, z, -y)
      }
    });
    if (season.blossom > 0.1) {
      for (const c of this.island.canopies.filter((c) => c.owner === 'blossom')) {
        for (let i = 0; i < 30; i++) out.push(c.position.clone().add(V(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize().multiplyScalar(c.radius * 0.95)));
      }
    }
    // plenty to choose from, but not so many that sorting through them every second costs anything
    while (out.length > MOST_BLOOMS) out.splice(Math.floor(Math.random() * out.length), 1);
    return out;
  }

  /** Another flower near this one, mostly. */
  private nextBloom(from: THREE.Vector3) {
    const close = this.near.filter((b) => b.distanceToSquared(from) < 9 && b !== from);
    return (close.length && Math.random() < 0.85 ? pick(close) : pick(this.near)) ?? from;
  }

  // --- how each one gets about -------------------------------------------------------

  /** Straight at a flower, buzzing; a moment hanging over it; on to the next. */
  private bee(b: Critter, dt: number) {
    if (b.leaving) {
      b.pos.y += dt * 1.2;
      return;
    }
    if (b.state === 'fly') {
      const to = b.goal.clone().sub(b.pos);
      const d = to.length();
      if (d < 0.08) Object.assign(b, { state: 'hover', t: rand(0.8, 3) });
      else {
        to.multiplyScalar(Math.min(d, 2.2 * dt) / d);
        b.pos.add(to).add(V(Math.sin(this.clock * 21 + b.phase), Math.sin(this.clock * 17 + b.phase) * 0.5, Math.cos(this.clock * 19 + b.phase)).multiplyScalar(0.25 * dt));
      }
    } else {
      b.pos.copy(b.goal).add(V(Math.sin(this.clock * 31 + b.phase) * 0.02, Math.sin(this.clock * 23 + b.phase) * 0.015, Math.cos(this.clock * 29 + b.phase) * 0.02));
      if ((b.t -= dt) < 0) {
        b.goal.copy(this.nextBloom(b.home)).add(V(0, 0.12, 0));
        b.home.copy(b.goal).y -= 0.12;
        b.state = 'fly';
      }
    }
  }

  /** All over the place, wings going, drifting towards a flower and now and then settling on one. */
  private butterfly(b: Critter, dt: number) {
    if (b.state === 'sit') {
      b.pos.copy(b.goal);
      if ((b.t -= dt) < 0 || b.leaving) Object.assign(b, { state: 'fly', t: rand(3, 6) });
      return;
    }
    if ((b.t -= dt) < 0) {
      b.t = rand(3, 6);
      b.home.copy(this.nextBloom(b.home));
      b.goal.copy(b.home).add(V(0, Math.random() < 0.4 ? 0.06 : rand(0.4, 1.4), 0));
    }
    const to = b.goal.clone().sub(b.pos);
    if (to.length() < 0.15 && b.goal.y - b.home.y < 0.1 && !b.leaving) {
      Object.assign(b, { state: 'sit', t: rand(2, 6) });
      return;
    }
    b.vel.addScaledVector(to.normalize(), 1.6 * dt).add(V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(5 * dt));
    if (b.leaving) b.vel.y += 1.5 * dt;
    const speed = b.vel.length();
    if (speed > 0.9) b.vel.multiplyScalar(0.9 / speed);
    b.pos.addScaledVector(b.vel, dt);
    b.pos.y += Math.sin(this.clock * 6 + b.phase) * 0.5 * dt; // up and down with every few beats
  }

  /** Round and round the lamp, never quite the same circle twice, now and then bumping into it. */
  private moth(b: Critter, dt: number) {
    b.t += dt * (2.5 + Math.sin(this.clock * 0.7 + b.phase) * 1.2);
    const r = 0.35 + Math.sin(this.clock * 1.3 + b.phase) * 0.2 + (Math.sin(this.clock * 0.4 + b.phase * 3) > 0.92 ? -0.25 : 0);
    const goal = V(Math.cos(b.t) * r, Math.sin(this.clock * 2.1 + b.phase) * 0.25, Math.sin(b.t) * r).add(b.home);
    if (b.leaving) goal.y += 3;
    b.pos.lerp(goal, 1 - Math.exp(-8 * dt));
  }

  /** A dart, a hover, a dart: low over the water off the shore. */
  private dragonfly(b: Critter, dt: number) {
    if (b.state === 'fly') {
      const to = b.goal.clone().sub(b.pos);
      const d = to.length();
      if (d < 0.05) Object.assign(b, { state: 'hover', t: rand(0.4, 1.6) });
      else b.pos.addScaledVector(to, Math.min(d, 5 * dt) / d);
    } else {
      b.pos.copy(b.goal).y += Math.sin(this.clock * 9 + b.phase) * 0.02;
      if ((b.t -= dt) < 0) {
        b.goal.copy(b.home).add(V(rand(-3.5, 3.5), 0, rand(-3.5, 3.5)));
        b.goal.y = b.leaving ? 4 : rand(0.4, 1.2);
        b.state = 'fly';
      }
    }
  }

  /** Bobbing up and down in their column, each in its own little loop. */
  private midge(b: Critter) {
    const t = this.clock;
    b.pos.set(Math.sin(t * 3.7 + b.phase) * 0.22, Math.sin(t * 2.3 + b.phase * 2) * 0.45, Math.cos(t * 4.1 + b.phase * 0.7) * 0.22).add(b.home);
  }

  private draw(light: number) {
    const t = this.clock;
    const tmp = new THREE.Color();
    for (let i = 0; i < MAX; i++) {
      const b = this.bugs[i];
      if (!b) {
        this.col[i * 4 + 3] = 0;
        continue;
      }
      this.pos.set([b.pos.x, b.pos.y, b.pos.z], i * 3);
      let size = 1;
      let flip = false;
      if (b.kind === 'bee') flip = Math.sin(t * 40 + b.phase) > 0.4; // stripes, in the buzz
      else if (b.kind === 'butterfly') {
        // wings open (two pixels, the top colour) and shut (one, the underside); slow when it's sitting
        const open = b.state === 'sit' ? Math.sin(t * 2 + b.phase) > 0.6 : Math.sin(t * 14 + b.phase) > 0;
        size = open ? 2 : 1;
        flip = !open;
      } else if (b.kind === 'dragonfly') {
        flip = Math.sin(t * 25 + b.phase) > 0.5; // the light off its wings
        size = b.state === 'fly' ? 1 : 2;
      }
      tmp.copy(flip ? b.under : b.color);
      // the moths are lit by the lamp they're round; the rest by the day
      if (b.kind !== 'moth') tmp.multiplyScalar(light);
      this.col.set([tmp.r, tmp.g, tmp.b, b.fade * (b.kind === 'midge' ? 0.8 : 1)], i * 4);
      this.size[i] = size;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
  }
}
