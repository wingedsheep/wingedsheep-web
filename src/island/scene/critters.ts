import * as THREE from 'three';
import type { Island } from './island';
import { measureTexels } from './particles';
import { season } from './season';
import type { Sky } from './sky';
import type { Weather } from './weather';

/** Where the small things find what they're after: the island's, or the river's banks (river/air.ts). */
export interface Habitat {
  /** Every flower head there is to visit (asked once; the ones near the view are picked out of it every second). */
  blooms(): THREE.Vector3[];
  /** The lamps that are on near `around`, for the moths. */
  lamps(around: THREE.Vector3, size: number): THREE.Vector3[];
  /** A spot on the water near its edge, at the water's height, for a dragonfly to keep to. */
  water(around: THREE.Vector3, size: number): THREE.Vector3 | null;
  /** Flowers that come and go (blooms along a river that's being built as you go): asked again every few seconds. */
  changing?: boolean;
}

/** The air the critters come out into. */
export interface Air {
  night: number; // 0..1
  rising: boolean; // the sun climbing: morning rather than evening
  alt: number; // the sun's elevation, degrees
  wet: number; // rain, snow and hail, 0..1
  cloud: number;
  fog: number;
  gust: number; // 0..1
  wind: number; // m/s
  temperature: number; // °C
}

/** The island's air, as the critters see it. */
export function airOf(sky: Sky, weather: Weather): Air {
  const w = weather.now;
  return {
    night: sky.lamps, rising: sky.rising, alt: sky.alt, wet: w.rain + w.snow + w.hail, cloud: w.cloud, fog: w.fog,
    gust: weather.gust, wind: weather.wind, temperature: weather.temperature,
  };
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const smooth = THREE.MathUtils.smoothstep;

const MAX = 220;
const MOST_BLOOMS = 1500;
/** The wild flowers' heads (nature.py flowers): the stems are this green, and nobody visits a stem. */
const STEM = new THREE.Color('#3f7d43');
const BEE = new THREE.Color('#f2c53a');
const BEE_DARK = new THREE.Color('#3a2a10');
/** A bumblebee: bigger, slower, furrier, and out on a cool spring day when the honeybees aren't. */
const BUMBLEBEE = new THREE.Color('#e0aa36');
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
  bumble?: boolean;
  // a butterfly's: the way it's heading (radians), how fast it's climbing or sinking, the time
  // left flapping (> 0) or gliding (< 0), how far its wings are open (0..1) and the beat they're
  // at, whether it's basking, and the one it's dancing with, which way round, and for how long
  yaw?: number;
  climb?: number;
  flap?: number;
  wing?: number;
  beat?: number;
  bask?: boolean;
  partner?: Critter;
  side?: number;
  dance?: number;
}

/**
 * The small life of a fine day, each kind out only when it would be: bees going from flower to
 * flower and butterflies flitting over the grass on a mild, calm, dry day (spring most of all),
 * dragonflies darting off the shore on a warm summer's day, moths round the lamps on a mild night,
 * and on a still summer evening a column of midges dancing in the low sun. A pixel or two from
 * afar, as big as they are zoomed in, kept near where you're looking; none of them sits still long
 * enough to click on.
 */
export class Critters {
  private points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 4);
  private size = new Float32Array(MAX);
  private span = new Float32Array(MAX);
  private shape = new Float32Array(MAX);
  private temperature = 15;
  private sunny = 1;
  private heading = new Float32Array(MAX * 3);
  private wings = new Float32Array(MAX);
  private mat: THREE.ShaderMaterial;
  private bugs: Critter[] = [];
  private blooms: THREE.Vector3[] | null = null;
  private bloomsIn = 0;
  /** The blooms within reach of the view, refreshed every second or so. */
  private near: THREE.Vector3[] = [];
  private nearIn = 0;
  private clock = 0;

  constructor(
    scene: THREE.Scene,
    private habitat: Habitat,
  ) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('span', new THREE.BufferAttribute(this.span, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('heading', new THREE.BufferAttribute(this.heading, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('wing', new THREE.BufferAttribute(this.wings, 1).setUsage(THREE.DynamicDrawUsage));
    // a pixel or two from afar, but zoomed in they're as big as they are (span, in metres), and
    // shaped: a butterfly with its body along the way it's flying (turned to the screen here) and
    // its wings as far open as they are, a bee round and striped
    const mat = (this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { texelsPerMetre: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float texelsPerMetre;
        attribute float size;
        attribute float span;
        attribute float shape;
        attribute vec3 heading;
        attribute float wing;
        attribute vec4 color;
        varying vec4 vColor;
        varying float vShape;
        varying float vSize;
        varying vec2 vDir;
        varying float vWing;
        void main() {
          vColor = color;
          vShape = shape;
          vWing = wing;
          vSize = max(size, floor(span * texelsPerMetre + 0.5));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec4 ahead = projectionMatrix * modelViewMatrix * vec4(position + heading * 0.2, 1.0);
          vec2 d = vec2((ahead.x - gl_Position.x) / projectionMatrix[0][0], (ahead.y - gl_Position.y) / projectionMatrix[1][1]);
          vDir = length(d) > 1e-5 ? normalize(d) : vec2(1.0, 0.0);
          gl_PointSize = vSize;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        varying float vShape;
        varying float vSize;
        varying vec2 vDir;
        varying float vWing;
        void main() {
          if (vColor.a < 0.02) discard;
          vec2 p = gl_PointCoord - 0.5;
          vec4 c = vColor;
          if (vShape > 0.5 && vShape < 1.5 && vSize > 2.5) {
            // along the body (u) and out from it (s, as a share of how far the wings are spread):
            // a dark body, the forewings and the smaller hindwings, darker at the tips
            p.y = -p.y;
            float u = dot(p, vDir);
            float v = abs(p.y * vDir.x - p.x * vDir.y);
            float s = v / max(vWing, 0.12);
            bool body = v < 0.08 && abs(u) < 0.36;
            bool fore = pow((u - 0.08) / 0.3, 2.0) + pow((s - 0.27) / 0.27, 2.0) < 1.0;
            bool hind = pow((u + 0.17) / 0.2, 2.0) + pow((s - 0.2) / 0.2, 2.0) < 1.0;
            bool middle = max(abs(p.x), abs(p.y)) <= 0.5 / vSize + 0.001;
            if (!(body || fore || hind || middle)) discard;
            if (vSize > 4.5 && body) c.rgb *= 0.35;
            else if (vSize > 4.5 && fore && s > 0.42) c.rgb *= 0.7;
          }
          if (vShape > 1.5 && vSize > 2.5) {
            if (length(p) > 0.45) discard;
            if (mod(floor(gl_PointCoord.x * vSize), 2.0) > 0.5) c.rgb *= 0.25;
          }
          gl_FragColor = c;
          #include <colorspace_fragment>
        }
      `,
    }));
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.raycast = () => {};
    measureTexels(this.points, mat);
    scene.add(this.points);
  }

  update(dt: number, air: Air, around: THREE.Vector3, view: number) {
    this.clock += dt;
    const size = Math.max(16, view * 0.9);
    if (!this.blooms || (this.habitat.changing && (this.bloomsIn -= dt) < 0)) {
      this.blooms = this.habitat.blooms();
      this.bloomsIn = 3;
    }
    if ((this.nearIn -= dt) < 0) {
      this.nearIn = 1;
      this.near = this.blooms.filter((b) => Math.abs(b.x - around.x) < size && Math.abs(b.z - around.z) < size);
    }

    // what the day allows
    const s = season.weights;
    const temp = air.temperature;
    const dry = 1 - smooth(air.wet, 0, 0.08);
    const day = smooth(1 - air.night, 0.5, 0.9);
    const calm = 1 - smooth(air.gust, 0.3, 0.8);
    this.temperature = temp;
    const sun = 1 - Math.min(1, air.cloud * 0.7 + air.fog);
    this.sunny = sun;
    // zoomed out over the whole island there are more flowers in view, so more of them about
    const flowering = this.near.length ? THREE.MathUtils.clamp(view / 16, 1, 3) : 0;
    const want: Record<Kind, number> = {
      // the bumblebees are out from 6° or so, the honeybees and most butterflies once it's mild
      bee: 30 * (s.spring + s.summer * 0.8 + s.autumn * 0.15) * smooth(temp, 6, 13) * day * dry * calm * (0.5 + sun * 0.5) * flowering,
      butterfly: 24 * (s.spring + s.summer * 0.9 + s.autumn * 0.2) * smooth(temp, 10, 16) * day * dry * calm * (0.35 + sun * 0.65) * flowering,
      dragonfly: 4 * s.summer * smooth(temp, 17, 22) * day * dry * (1 - smooth(air.wind, 4, 8)) * (0.5 + sun * 0.5),
      // round the lamps once it's properly dark: a mild night, not the cold or the wet or a wind
      moth: 3 * (s.summer + s.autumn * 0.6 + s.spring * 0.3) * smooth(temp, 8, 14) * smooth(air.night, 0.6, 0.9) * dry * (1 - smooth(air.wind, 5, 9)),
      // a still summer evening, the sun low and going down
      midge: 14 * (s.summer + s.spring * 0.5) * smooth(temp, 12, 16) * dry * (1 - smooth(air.wind, 2, 3.5)) * sun
        * (!air.rising && air.alt > -1 && air.alt < 10 ? 1 : 0),
    };

    // too far from the view, gone; more than the day wants, off they go
    this.bugs = this.bugs.filter((b) => b.fade > 0 || !b.leaving);
    this.bugs = this.bugs.filter((b) => Math.abs(b.pos.x - around.x) < size * 1.5 && Math.abs(b.pos.z - around.z) < size * 1.5);
    for (const kind of Object.keys(want) as Kind[]) {
      const goal = Math.round(want[kind]);
      const mine = this.bugs.filter((b) => b.kind === kind && !b.leaving);
      for (let i = goal; i < mine.length; i++) mine[i].leaving = true;
      // a few at a time, so they arrive rather than appear (quicker the more there are to come)
      if (mine.length < goal && this.bugs.length < MAX && Math.random() < dt * (3 + goal * 0.3)) this.spawn(kind, around, size);
    }

    for (const b of this.bugs) {
      b.fade = THREE.MathUtils.clamp(b.fade + (b.leaving ? -dt / 1.5 : dt), 0, 1);
      if (b.kind === 'bee') this.bee(b, dt);
      else if (b.kind === 'butterfly') this.butterfly(b, dt);
      else if (b.kind === 'moth') this.moth(b, dt);
      else if (b.kind === 'dragonfly') this.dragonfly(b, dt);
      else this.midge(b);
    }
    this.draw(1 - air.night * 0.4);
  }

  // --- who comes out where -----------------------------------------------------------

  private spawn(kind: Kind, around: THREE.Vector3, size: number) {
    let home: THREE.Vector3 | null = null;
    if (kind === 'bee' || kind === 'butterfly') home = this.near.length ? pick(this.near).clone() : null;
    else if (kind === 'moth') {
      // a lamp that's on, near the view, with fewer than three already round it
      const lamps = this.habitat.lamps(around, size)
        .filter((l) => this.bugs.filter((b) => b.kind === 'moth' && b.home.distanceTo(l) < 0.1).length < 3);
      home = lamps.length ? pick(lamps).clone() : null;
    } else if (kind === 'dragonfly') home = this.habitat.water(around, size)?.add(V(0, rand(0.5, 1), 0)) ?? null;
    else {
      // the midges dance in one column: theirs, if they've started, or somewhere over the flowers
      const other = this.bugs.find((b) => b.kind === 'midge');
      home = other ? other.home.clone() : this.near.length ? pick(this.near).clone().add(V(0, 1.6, 0)) : null;
    }
    if (!home) return;
    const butterfly = pick(BUTTERFLIES.flatMap(([a, b, n]) => Array.from({ length: n * 2 }, () => [a, b])));
    // on a cool day it's mostly bumblebees out
    const bumble = kind === 'bee' && Math.random() < 0.2 + 0.6 * (1 - smooth(this.temperature, 9, 16));
    const color = bumble ? BUMBLEBEE : kind === 'bee' ? BEE : kind === 'moth' ? MOTH : kind === 'midge' ? MIDGE : kind === 'dragonfly' ? DRAGONFLY[0] : new THREE.Color(butterfly[0]);
    const under = kind === 'bee' ? BEE_DARK : kind === 'dragonfly' ? DRAGONFLY[1] : kind === 'butterfly' ? new THREE.Color(butterfly[1]) : color;
    // bees and butterflies come in from a little way off, the rest are where they keep to
    const start = kind === 'bee' || kind === 'butterfly' ? home.clone().add(V(rand(-3, 3), rand(0.8, 2), rand(-3, 3))) : home.clone().add(V(rand(-0.5, 0.5), rand(-0.2, 0.2), rand(-0.5, 0.5)));
    this.bugs.push({
      kind, pos: start, vel: V(), goal: kind === 'bee' ? home.clone().add(V(0, 0.12, 0)) : home.clone(), home,
      state: 'fly', t: rand(2, 5), phase: rand(0, 100), color, under, fade: 0, leaving: false, bumble,
      yaw: rand(0, Math.PI * 2), climb: 0, flap: rand(0.3, 1), wing: 0.5, beat: rand(0, 6),
    });
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
      if (d < 0.08) Object.assign(b, { state: 'hover', t: b.bumble ? rand(1.5, 4) : rand(0.8, 3) });
      else {
        to.multiplyScalar(Math.min(d, (b.bumble ? 1.4 : 2.2) * dt) / d);
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

  /**
   * The way a butterfly gets about: a few beats of its wings that lift it, then a glide with them
   * held open that lets it down, so it bobs along, never straight, always turning a little this way
   * and that, drifting from flower to flower and now and then settling on one, wings shut, opening
   * them in the sun to bask. And now and then two of them meet and spiral up round each other.
   */
  private butterfly(b: Critter, dt: number) {
    const beat = (b.beat = (b.beat ?? 0) + dt * 18);
    if (b.state === 'sit') {
      b.pos.copy(b.goal);
      if (Math.random() < dt * (b.bask ? 0.25 : 0.3 * this.sunny)) b.bask = !b.bask;
      const open = b.bask ? 0.95 : 0.08 + Math.max(0, Math.sin(this.clock * 1.3 + b.phase)) * 0.15;
      b.wing = THREE.MathUtils.damp(b.wing ?? 0, open, 4, dt);
      if ((b.t -= dt) < 0 || b.leaving) Object.assign(b, { state: 'fly', t: rand(3, 6), flap: rand(0.6, 1), climb: 0.5, bask: false });
      return;
    }

    // dancing: round and round each other about a point they share (their goal) that rises and
    // drifts, until one of them has had enough
    const p = b.partner;
    if (p && (b.dance = (b.dance ?? 0) - dt) > 0 && p.partner === b && !b.leaving && !p.leaving) {
      if (b.side === 0) b.goal.add(V(Math.sin(this.clock * 0.8 + b.phase) * 0.2 * dt, 0.35 * dt, Math.cos(this.clock * 0.7 + b.phase) * 0.2 * dt));
      const a = this.clock * 6 + (b.side ?? 0);
      const to = b.goal.clone().add(V(Math.cos(a) * 0.22, Math.sin(this.clock * 3 + b.phase) * 0.05, Math.sin(a) * 0.22));
      const step = to.clone().sub(b.pos);
      if (step.lengthSq() > 1e-6) b.yaw = Math.atan2(step.z, step.x);
      b.pos.lerp(to, 1 - Math.exp(-6 * dt));
      b.wing = 0.5 + 0.5 * Math.sin(beat);
      return;
    }
    if (p) {
      b.partner = undefined;
      b.goal = b.goal.clone(); // no longer theirs
      b.t = 0; // off somewhere else after
    }
    // or meeting one: another flying close by, on its own
    if (!b.leaving && Math.random() < dt * 0.05) {
      const q = this.bugs.find((o) => o !== b && o.kind === 'butterfly' && o.state === 'fly' && !o.partner && !o.leaving && o.pos.distanceToSquared(b.pos) < 6);
      if (q) {
        const dance = rand(3, 5);
        const centre = b.pos.clone().add(q.pos).multiplyScalar(0.5);
        Object.assign(b, { partner: q, dance, side: 0, goal: centre });
        Object.assign(q, { partner: b, dance, side: Math.PI, goal: centre });
        return;
      }
    }

    if ((b.t -= dt) < 0) {
      b.t = rand(3, 6);
      b.home.copy(this.nextBloom(b.home));
      b.goal.copy(b.home).add(V(0, Math.random() < 0.4 ? 0.06 : rand(0.4, 1.4), 0));
    }
    const to = b.goal.clone().sub(b.pos);
    const landing = b.goal.y - b.home.y < 0.1 && !b.leaving;
    if (landing && to.length() < 0.2) {
      Object.assign(b, { state: 'sit', t: rand(3, 9), bask: Math.random() < this.sunny * 0.5 });
      return;
    }

    // flap a few beats (counting down), glide a moment (counting up to 0), flap again
    if ((b.flap ?? 0) > 0) {
      if ((b.flap = b.flap! - dt) <= 0) b.flap = -rand(0.3, 0.9);
    } else if ((b.flap = (b.flap ?? 0) + dt) >= 0) b.flap = rand(0.4, 1.2);
    const flapping = b.flap > 0;

    // turning: towards where it's going, but never straight there
    const want = Math.atan2(to.z, to.x);
    const off = Math.atan2(Math.sin(want - (b.yaw ?? 0)), Math.cos(want - (b.yaw ?? 0)));
    const wander = Math.sin(this.clock * 2.3 + b.phase) * 2.2 + Math.sin(this.clock * 5.3 + b.phase * 2) * 1.6;
    b.yaw = (b.yaw ?? 0) + (THREE.MathUtils.clamp(off * 1.6, -2.5, 2.5) + wander) * dt;
    // up while it flaps, down while it glides, and back towards the height it's after
    const rise = (flapping ? 0.55 : -0.45) + THREE.MathUtils.clamp(to.y * 1.2, -0.6, 0.6) + (b.leaving ? 0.9 : 0);
    b.climb = THREE.MathUtils.damp(b.climb ?? 0, rise, 6, dt);
    const speed = (flapping ? 0.85 : 0.65) * (landing ? THREE.MathUtils.clamp(to.length() * 1.5, 0.35, 1) : 1);
    b.pos.add(V(Math.cos(b.yaw) * speed * dt, b.climb * dt, Math.sin(b.yaw) * speed * dt));
    b.pos.y = Math.max(b.pos.y, b.home.y + 0.04);
    b.wing = flapping ? 0.5 + 0.5 * Math.sin(beat) : THREE.MathUtils.damp(b.wing ?? 0, 0.9, 10, dt);
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
        b.goal.copy(b.home).add(V(rand(-3.5, 3.5), b.leaving ? 3.5 : rand(-0.3, 0.4), rand(-3.5, 3.5)));
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
      let span = 0;
      let shape = 0;
      let flip = false;
      if (b.kind === 'bee') {
        // a flicker of its stripes in the buzz when it's a pixel; zoomed in, round and striped
        span = b.bumble ? 0.12 : 0.08;
        flip = span * this.mat.uniforms.texelsPerMetre.value < 2.5 && Math.sin(t * 40 + b.phase) > 0.4;
        shape = 2;
      } else if (b.kind === 'butterfly') {
        // from afar, two pixels with its wings open (their top colour) and one shut (the
        // underside); zoomed in, its wings as far open as they are, and pointing the way it's going
        const wing = b.wing ?? 1;
        size = wing > 0.5 ? 2 : 1;
        span = 0.17;
        shape = 1;
        flip = wing < 0.3;
        this.wings[i] = wing;
        this.heading.set([Math.cos(b.yaw ?? 0), 0, Math.sin(b.yaw ?? 0)], i * 3);
      } else if (b.kind === 'moth') span = 0.08;
      else if (b.kind === 'dragonfly') {
        flip = Math.sin(t * 25 + b.phase) > 0.5; // the light off its wings
        size = b.state === 'fly' ? 1 : 2;
      }
      tmp.copy(flip ? b.under : b.color);
      // the moths are lit by the lamp they're round; the rest by the day
      if (b.kind !== 'moth') tmp.multiplyScalar(light);
      this.col.set([tmp.r, tmp.g, tmp.b, b.fade * (b.kind === 'midge' ? 0.8 : 1)], i * 4);
      this.size[i] = size;
      this.span[i] = span;
      this.shape[i] = shape;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.span.needsUpdate = true;
    g.attributes.shape.needsUpdate = true;
    g.attributes.heading.needsUpdate = true;
    g.attributes.wing.needsUpdate = true;
  }
}

/**
 * The island as a place to live: its wild flowers that are out (the ones dressIsland has left
 * showing), the crocuses and snowdrops while they're up, and in April the blossom on the cherry
 * tree; its lamps; and open water just off the shore, out of the surf.
 */
export function islandHabitat(island: Island, sea: (x: number, y: number) => boolean): Habitat {
  return {
    blooms() {
      const out: THREE.Vector3[] = [];
      const seen = new Set<string>();
      const p = V();
      island.root.updateMatrixWorld(true);
      island.root.getObjectByName('flowers')?.traverse((o) => {
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
      island.root.traverse((o) => {
        const { bulb, spots } = o.userData as { bulb?: string; spots?: number[] };
        if (!bulb || !spots) return;
        const up = bulb.startsWith('snowdrop') ? season.snowdrops : season.crocuses;
        for (let i = 0; i < spots.length; i += 6) {
          if (spots[i + 5] >= up) continue;
          out.push(V(spots[i], spots[i + 2] + 0.12, -spots[i + 1])); // Blender's (x, y, z) is (x, z, -y)
        }
      });
      if (season.blossom > 0.1) {
        for (const c of island.canopies.filter((c) => c.owner === 'blossom')) {
          for (let i = 0; i < 30; i++) out.push(c.position.clone().add(V(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize().multiplyScalar(c.radius * 0.95)));
        }
      }
      // plenty to choose from, but not so many that sorting through them every second costs anything
      while (out.length > MOST_BLOOMS) out.splice(Math.floor(Math.random() * out.length), 1);
      return out;
    },
    lamps: (around, size) => island.lights.filter((l) => !l.day && l.position.distanceTo(around) < size).map((l) => l.position),
    water(around, size) {
      for (let i = 0; i < 20; i++) {
        const x = around.x + rand(-size, size) * 0.8;
        const y = -around.z + rand(-size, size) * 0.6; // blender coordinates: y = -z
        if (!sea(x, y)) continue;
        const a = rand(0, Math.PI * 2);
        if (sea(x + Math.cos(a) * 4, y + Math.sin(a) * 4) && sea(x - Math.cos(a) * 4, y - Math.sin(a) * 4)) continue;
        return V(x, 0, -y);
      }
      return null;
    },
  };
}
