import * as THREE from 'three';
import { countdownAt, fireworksAt } from './calendar';
import type { Island } from './island';
import { Particles } from './particles';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

/** What goes up: where from, and what it does at the top. */
type Kind = 'peony' | 'ring' | 'willow' | 'glitter' | 'double';

interface Shell {
  kind: Kind;
  at: THREE.Vector3;
  velocity: THREE.Vector3;
  fuse: number; // seconds till it bursts
  colors: string[];
  scale: number; // the far-off ones are bigger shells, so they read at the distance
}

interface Crackle {
  at: THREE.Vector3;
  radius: number;
  t: number;
  length: number;
}

const PALETTES = [
  ['#ff5a4e', '#ffd070', '#ffffff'],
  ['#6ab0ff', '#e8f0ff', '#b8f5e8'],
  ['#6ee06a', '#f4d35e', '#ffffff'],
  ['#ff7ad0', '#ffd1f0', '#ffffff'],
  ['#b38cff', '#6ab0ff', '#ffffff'],
  ['#f07a1a', '#ffd070', '#fff1b0'],
];
const GOLD = ['#ffcf6a', '#ffb640', '#fff1b0'];

/** Where the neighbours let theirs off: named places on the island, in Blender (x, y) when they have no id. */
const SPOTS = ['dock', 'campfire', 'summit', 'lighthouse', 'library', 'workshop', 'well', 'signpost'];
const BEACHES: [number, number][] = [[-9, -15], [8, -15.5], [15, -13], [-18, -13], [2, -27]];

/**
 * New Year's Eve (calendar.ts): now and then a rocket goes up from somewhere on the island through
 * the evening, then more and more, until at midnight the whole sky goes off, from the island and
 * from far out across the water all round, and the small hours bring the last few stragglers.
 * Each burst lights the island in its colour for a moment, and is heard a beat after it's seen.
 */
export class Fireworks {
  readonly particles = new Particles(12000);
  private shells: Shell[] = [];
  private crackles: Crackle[] = [];
  private next = 1;
  private salvo = 4;
  private flash = new THREE.PointLight('#ffffff', 0, 90, 1.2);
  private glow = 0;
  private spots: THREE.Vector3[];
  private lastCountdown: number | null = null;
  private dark = 1;
  /** How hard they're going: 1 a lively night, more when it goes wild (calendar.ts fireworksAt). */
  level = 0;
  /** A rocket going up, a shell bursting, glitter crackling: at `at`, so it can be heard from there. */
  onSound?: (kind: 'launch' | 'burst' | 'crackle', at: THREE.Vector3, big: number) => void;

  constructor(scene: THREE.Scene, island: Island, private reducedMotion = false) {
    scene.add(this.particles.points);
    scene.add(this.flash);
    this.spots = [
      ...SPOTS.map((id) => island.positionOf(id)).filter((p): p is THREE.Vector3 => Boolean(p)),
      ...BEACHES.map(([x, y]) => V(x, 0.3, -y)),
    ];
  }

  update(dt: number, time: number, lamps: number) {
    this.level = fireworksAt(time);
    const k = this.level;
    this.dark = lamps;
    if (k > 0.001 && (this.next -= dt) < 0) {
      this.launch(Math.random() < 0.3 + Math.min(k, 1) * 0.25);
      this.next = rand(0.4, 1.6) * Math.min(40, 0.9 / k ** 1.3);
    }
    // when it goes wild, salvos: a handful at once from all over
    if (k > 1.5 && (this.salvo -= dt) < 0) {
      for (let i = 0; i < 6; i++) setTimeout(() => this.launch(i % 2 === 0), i * rand(40, 120));
      this.salvo = rand(2, 4.5) * (3.2 / k);
    }
    // the stroke of midnight: everyone at once
    const c = countdownAt(time);
    if (this.lastCountdown !== null && this.lastCountdown <= 2 && c === null && k > 0.3) {
      for (let i = 0; i < 24; i++) setTimeout(() => this.launch(i % 3 === 0), i * rand(40, 110));
    }
    this.lastCountdown = c;

    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.velocity.y -= 9.8 * 0.35 * dt;
      s.at.addScaledVector(s.velocity, dt);
      // the rocket's tail: a few sparks shed as it climbs
      for (let n = 0; n < 2; n++) {
        this.particles.emit({
          position: s.at.clone().add(V(rand(-0.05, 0.05), rand(-0.1, 0), rand(-0.05, 0.05))),
          velocity: V(rand(-0.3, 0.3), rand(-1.2, -0.4), rand(-0.3, 0.3)),
          color: pick(['#ffd070', '#ff9a3c', '#fff1b0']),
          life: rand(0.25, 0.5),
          fadeIn: 0,
        });
      }
      if ((s.fuse -= dt) <= 0) {
        this.shells.splice(i, 1);
        this.burst(s);
      }
    }
    for (let i = this.crackles.length - 1; i >= 0; i--) {
      const c = this.crackles[i];
      c.t += dt;
      // glitter: white pinpricks popping in and out all through where the stars have got to
      for (let n = 0; n < 6; n++) {
        const p = V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(c.radius * rand(0.5, 1.1));
        this.particles.emit({ position: c.at.clone().add(p).add(V(0, -c.t * 1.5, 0)), color: '#ffffff', life: rand(0.06, 0.14), fadeIn: 0 });
      }
      if (c.t > c.length) this.crackles.splice(i, 1);
    }

    this.glow = Math.max(0, this.glow - dt * 3);
    // each burst lights the island in its colour for a moment (not with reduced motion: no flashing)
    this.flash.intensity = this.reducedMotion ? 0 : this.glow ** 2 * 60 * THREE.MathUtils.smoothstep(this.dark, 0.2, 0.8);
    this.flash.visible = !this.reducedMotion && this.glow > 0.01;
    this.particles.update(dt);
  }

  private launch(far: boolean) {
    const from = far
      ? new THREE.Vector3(0, 0, 1).applyAxisAngle(V(0, 1, 0), rand(Math.PI * 0.3, Math.PI * 1.7)).multiplyScalar(rand(50, 75))
      : pick(this.spots).clone().add(V(rand(-1.5, 1.5), 0, rand(-1.5, 1.5)));
    const scale = far ? rand(1.5, 2.1) : rand(0.8, 1.2);
    const height = far ? rand(18, 28) : rand(12, 20);
    const up = rand(16, 20) * (far ? 1.35 : 1);
    const kind = pick<Kind>(['peony', 'peony', 'ring', 'willow', 'glitter', 'double']);
    this.shells.push({
      kind,
      at: from,
      velocity: V(rand(-1.2, 1.2), up, rand(-1.2, 1.2)),
      fuse: height / (up * 0.8),
      colors: kind === 'willow' ? GOLD : pick(PALETTES),
      scale,
    });
    this.onSound?.('launch', from, scale);
  }

  private burst(s: Shell) {
    const { at, colors, scale } = s;
    const star = (v: THREE.Vector3, color: string, life: number, opts: { gravity?: number; drag?: number; size?: number } = {}) =>
      this.particles.emit({ position: at.clone(), velocity: v, color, life, fadeIn: 0, hold: 0.45, gravity: opts.gravity ?? -2.2, drag: opts.drag ?? 1.1, size: opts.size ?? 2 });
    const sphere = () => V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    const speed = 11 * scale;
    switch (s.kind) {
      case 'peony':
      case 'glitter':
        for (let i = 0; i < 130; i++) star(sphere().multiplyScalar(speed * rand(0.85, 1)), pick(colors), rand(1.5, 2.2), { size: i % 3 ? 2 : 1 });
        if (s.kind === 'glitter') this.crackles.push({ at: at.clone(), radius: 5 * scale, t: -0.5, length: 1.2 });
        break;
      case 'double': // two shells in one: a big ring of one colour round a tight core of another
        for (let i = 0; i < 110; i++) star(sphere().multiplyScalar(speed * rand(0.9, 1)), colors[0], rand(1.5, 2.1));
        for (let i = 0; i < 50; i++) star(sphere().multiplyScalar(speed * 0.45), colors[2], rand(1.1, 1.5), { size: 1 });
        break;
      case 'ring': { // a flat ring, tilted a little towards you
        const tilt = new THREE.Euler(rand(0.9, 1.4), rand(0, Math.PI), 0);
        for (let i = 0; i < 70; i++) {
          const a = (i / 70) * Math.PI * 2;
          star(V(Math.cos(a), 0, Math.sin(a)).applyEuler(tilt).multiplyScalar(speed), colors[i % 2], rand(1.5, 2), { size: 2 });
        }
        for (let i = 0; i < 20; i++) star(sphere().multiplyScalar(speed * 0.25), colors[2], 1.2, { size: 1 });
        break;
      }
      case 'willow': // gold that hangs and droops, long after the bang
        for (let i = 0; i < 150; i++) star(sphere().multiplyScalar(speed * rand(0.6, 0.8)), pick(colors), rand(2.6, 3.6), { gravity: -2.8, drag: 1.6, size: i % 2 ? 2 : 1 });
        break;
    }
    this.flash.position.copy(at);
    this.flash.color.set(colors[0]);
    this.glow = Math.min(1.2, this.glow + 0.8 / Math.max(1, scale * 0.7));
    this.onSound?.('burst', at, scale);
    if (s.kind === 'glitter' || s.kind === 'willow') setTimeout(() => this.onSound?.('crackle', at, scale), 500);
  }
}
