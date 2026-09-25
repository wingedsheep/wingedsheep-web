import * as THREE from 'three';
import type { Particles } from './particles';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ease = THREE.MathUtils.smootherstep;

/** What the exhibits need from the room they stand in. */
export interface ExhibitRoom {
  particles: Particles;
  /** A few music notes rising from a point. */
  notes(at: THREE.Vector3): void;
  /** An exhibit's root, by project id. */
  exhibit(id: string): THREE.Object3D | undefined;
  /** Particle emitter markers in the room. */
  emitters: { kind: string; position: THREE.Vector3 }[];
}

/**
 * The projects in the workshop, going about their business: the Argentum engine turns
 * its gears with the five colours of mana orbiting a card, the press prints a new card every
 * few seconds, a quill writes a tale by itself, sparks run up the network, a meeple fidgets,
 * the gramophone plays (when asked), the lunar
 * lander practises landing, and the hammock sways next to a blinking cursor.
 */
export class Exhibits {
  private clock = 0;
  private parts = new Map<string, THREE.Object3D>();
  private rest = new Map<THREE.Object3D, { position: THREE.Vector3; rotation: THREE.Euler }>();
  private gears: THREE.Object3D[] = [];
  private timers = new Map<string, number>();
  private landerDrift = 0;
  /** Set by the room: whether a record is on. */
  playing = false;
  private spin = 0;
  // the network: nodes by layer, each with its own glass to light up, and sparks on the wires
  private layers: { mat: THREE.MeshToonMaterial; glow: number }[][] = [];
  private nodeAt: THREE.Vector3[][] = [];
  private sparks: { from: THREE.Vector3; to: THREE.Vector3; t: number; layer: number; i: number }[] = [];
  private nextPass = 3;
  // the quill: which line it's on, how far along, and the page turn
  private line = 0;
  private along = -0.3;
  private turning = -1;

  constructor(private room: ExhibitRoom) {
    const find = (id: string, name: string) => {
      const o = room.exhibit(id)?.getObjectByName(name);
      if (!o) return;
      this.parts.set(`${id}.${name}`, o);
      this.rest.set(o, { position: o.position.clone(), rotation: o.rotation.clone() });
    };
    find('argentum', 'card');
    for (let i = 0; i < 5; i++) find('argentum', `orb${i}`);
    for (const n of ['press_plate', 'press_wheel', 'card_out']) find('mana', n);
    for (const n of ['quill', 'leaf', ...[0, 1, 2, 3, 4, 5].map((i) => `ink${i}`)]) find('talespinner', n);
    find('carcassonne', 'meeple');
    find('music', 'record');
    for (const n of ['lander', 'thrust']) find('lander', n);
    for (const n of ['hammock', 'cursor']) find('lazyhttp', n);
    this.wireNetwork();
    room.exhibit('argentum')?.traverse((o) => o.userData.spin && this.gears.push(o));
  }

  private part(key: string) {
    return this.parts.get(key);
  }

  private at(key: string) {
    return this.rest.get(this.part(key)!)!;
  }

  update(dt: number) {
    this.clock += dt;
    const t = this.clock;

    // Argentum: gears, a slowly turning card, and the mana going round it
    for (const g of this.gears) g.rotateY(dt * g.userData.spin);
    const card = this.part('argentum.card');
    if (card) {
      card.rotation.y = t * 0.5;
      card.position.y = this.at('argentum.card').position.y + Math.sin(t * 1.3) * 0.06;
      for (let i = 0; i < 5; i++) {
        const orb = this.part(`argentum.orb${i}`);
        if (!orb) continue;
        const a = t * 0.8 + (i / 5) * Math.PI * 2;
        orb.position.set(Math.cos(a) * 0.62, card.position.y + Math.sin(t * 2 + i) * 0.12, Math.sin(a) * 0.62);
        orb.position.add(V(this.at('argentum.card').position.x, 0, this.at('argentum.card').position.z));
      }
    }

    this.press(t);

    this.write(dt);
    this.network(dt);

    // one meeple can't sit still: two hops and a spin every few seconds
    const meeple = this.part('carcassonne.meeple');
    if (meeple) {
      const k = (t % 5.5) / 0.8;
      const hop = k < 1 ? Math.abs(Math.sin(k * Math.PI * 2)) * 0.14 : 0;
      meeple.position.y = this.at('carcassonne.meeple').position.y + hop;
      if (k < 1) meeple.rotation.y = this.at('carcassonne.meeple').rotation.y + ease(k, 0, 1) * Math.PI * 2;
    }

    // the record only turns while it's playing (and takes a moment to get up to speed)
    this.spin = THREE.MathUtils.damp(this.spin, this.playing ? 3.5 : 0, this.playing ? 1.5 : 3, dt);
    this.part('music.record')?.rotateY(dt * this.spin);
    this.lander(t, dt);

    const hammock = this.part('lazyhttp.hammock');
    if (hammock) hammock.rotation.x = this.at('lazyhttp.hammock').rotation.x + Math.sin(t * 0.9) * 0.07;
    const cursor = this.part('lazyhttp.cursor');
    if (cursor) cursor.visible = Math.floor(t * 1.8) % 2 === 0;

    this.emitters(dt);
  }

  /** Mana from the Machine: stamp, lift, and a fresh card slides out onto the pile. */
  private press(t: number) {
    const plate = this.part('mana.press_plate');
    const wheel = this.part('mana.press_wheel');
    const out = this.part('mana.card_out');
    if (!plate || !wheel || !out) return;
    const k = t % 6;
    const down = ease(k, 0.3, 1.0) - ease(k, 1.6, 2.3);
    plate.position.y = this.at('mana.press_plate').position.y - down * 0.38;
    wheel.rotation.copy(this.at('mana.press_wheel').rotation);
    wheel.rotateY(down * Math.PI);
    const slide = ease(k, 2.3, 3.3);
    const from = this.at('mana.press_plate').position;
    const to = this.at('mana.card_out').position;
    out.visible = k > 2.3;
    out.position.set(THREE.MathUtils.lerp(from.x, to.x, slide), to.y + 0.16 * slide, THREE.MathUtils.lerp(from.z, to.z, slide));
    out.position.y += Math.sin(slide * Math.PI) * 0.12;
  }

  /** Reinforcement learning, visibly still in progress: up, wobble, down, not quite centred. */
  private lander(t: number, dt: number) {
    const lander = this.part('lander.lander');
    const thrust = this.part('lander.thrust');
    if (!lander || !thrust) return;
    const rest = this.at('lander.lander');
    const k = t % 13;
    if (k < dt) this.landerDrift = rand(-0.35, 0.35);
    const lift = ease(k, 5, 6.5) - ease(k, 8, 10.2);
    const wobble = lift > 0.01 ? Math.sin(t * 3.1) * 0.25 * lift + this.landerDrift * lift * 0.6 : 0;
    const drift = this.landerDrift * Math.sin(Math.min(1, Math.max(0, (k - 5) / 5.2)) * Math.PI);
    lander.position.set(rest.position.x + drift, rest.position.y + lift * 1.5, rest.position.z);
    lander.rotation.z = rest.rotation.z + wobble;
    // a bump on touchdown
    const bump = k > 10.2 && k < 10.6 ? Math.sin(((k - 10.2) / 0.4) * Math.PI) * 0.08 : 0;
    lander.position.y += bump;
    const burning = (k > 4.6 && k < 6.8) || (k > 8.2 && k < 10.2 && Math.sin(t * 11) > -0.3);
    thrust.visible = burning;
    if (burning) thrust.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    if (k > 10.2 && k - dt <= 10.2) {
      const at = lander.getWorldPosition(V());
      for (let i = 0; i < 12; i++) {
        this.room.particles.emit({ position: at.clone().add(V(rand(-0.4, 0.4), 0.05, rand(-0.4, 0.4))), velocity: V(rand(-1, 1), rand(0.1, 0.5), rand(-1, 1)), color: '#d4cfd9', life: rand(0.5, 1.0), size: 2 });
      }
    }
  }

  /**
   * Talespinner: the quill writes each line left to right, lifting between words, then goes
   * back for the next. When the page is full it turns, and the tale carries on.
   */
  private write(dt: number) {
    const quill = this.part('talespinner.quill');
    const leaf = this.part('talespinner.leaf');
    const inks = [0, 1, 2, 3, 4, 5].map((i) => this.part(`talespinner.ink${i}`)!).filter(Boolean);
    if (!quill || !leaf || inks.length < 6) return;
    const rest = this.at('talespinner.quill');

    if (this.turning >= 0) {
      // the full page lifts from the right and settles on the left
      this.turning += dt / 1.1;
      leaf.visible = this.turning < 1;
      leaf.rotation.z = ease(this.turning, 0, 1) * Math.PI;
      leaf.position.y = this.at('talespinner.leaf').position.y + Math.sin(Math.min(1, this.turning) * Math.PI) * 0.05;
      quill.position.lerp(rest.position.clone().add(V(0.15, 0.25, 0)), 1 - Math.exp(-dt * 4));
      if (this.turning >= 1) {
        this.turning = -1;
        this.line = 0;
        this.along = -0.4;
      }
      return;
    }

    this.along += dt / 3.2; // a line every few seconds
    if (this.along >= 1) {
      this.along = -0.25; // a moment to go back to the start of the next line
      if (++this.line >= inks.length) {
        this.turning = 0;
        leaf.visible = true;
        leaf.rotation.z = 0;
        for (const ink of inks) ink.visible = false;
        return;
      }
    }
    inks.forEach((ink, i) => {
      const k = i < this.line ? 1 : i === this.line ? THREE.MathUtils.clamp(this.along, 0, 1) : 0;
      ink.visible = k > 0.01;
      ink.scale.x = Math.max(0.01, k);
    });
    const ink = inks[this.line];
    const len = Number(ink.userData.len ?? 0.34);
    const k = THREE.MathUtils.clamp(this.along, 0, 1);
    const word = (k * 5) % 1; // five words to a line, and a hop between each
    const lift = this.along < 0 ? 0.08 : word > 0.85 ? Math.sin(((word - 0.85) / 0.15) * Math.PI) * 0.03 : 0;
    const writing = this.along >= 0 && word <= 0.85;
    quill.position.set(
      ink.position.x + k * len,
      ink.position.y + 0.015 + lift + (writing ? Math.abs(Math.sin(this.clock * 30)) * 0.006 : 0),
      ink.position.z + (writing ? Math.sin(this.clock * 22) * 0.012 : 0),
    );
    quill.rotation.set(rest.rotation.x + Math.sin(this.clock * 22) * 0.06 * Number(writing), rest.rotation.y, rest.rotation.z + Math.sin(this.clock * 3) * 0.05);
    if (writing && this.every('nib', 0.12, dt)) {
      const at = quill.getWorldPosition(V());
      this.room.particles.emit({ position: at, velocity: V(rand(-0.1, 0.1), rand(0.2, 0.5), rand(-0.1, 0.1)), color: Math.random() < 0.5 ? '#ffe38a' : '#fff6c4', life: rand(0.8, 1.6), wobble: 0.4 });
    }
  }

  /** Find the network's nodes and give each its own glass, so they can light up one by one. */
  private wireNetwork() {
    const root = this.room.exhibit('transformer');
    if (!root) return;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o.name.match(/^node_(\d+)_(\d+)/);
      if (!m) return;
      const [L, i] = [Number(m[1]), Number(m[2])];
      o.traverse((c) => {
        const mesh = c as THREE.Mesh;
        const mat = mesh.material as THREE.MeshToonMaterial | undefined;
        if (!mesh.isMesh || !mat?.emissive || mat.emissive.getHex() === 0) return;
        mesh.material = mat.clone();
        ((this.layers[L] ??= [])[i] = { mat: mesh.material as THREE.MeshToonMaterial, glow: 0 });
      });
      (this.nodeAt[L] ??= [])[i] = o.getWorldPosition(V());
    });
  }

  /**
   * A forward pass now and then: a few input nodes fire, and sparks run up the wires layer by
   * layer, each node flashing as one arrives, until the top layer lights and crackles.
   */
  private network(dt: number) {
    if (!this.layers.length) return;
    if ((this.nextPass -= dt) < 0) {
      this.nextPass = rand(4, 8);
      const first = this.layers[0].map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
      for (const i of first) this.fire(0, i);
    }
    for (const s of this.sparks) {
      s.t += dt / 0.4;
      const p = s.from.clone().lerp(s.to, Math.min(1, s.t));
      this.room.particles.emit({ position: p, color: Math.random() < 0.3 ? '#ffffff' : '#9ff0ff', life: 0.18, size: 2 });
      if (s.t >= 1) this.fire(s.layer, s.i);
    }
    this.sparks = this.sparks.filter((s) => s.t < 1);
    this.layers.forEach((layer, L) =>
      layer.forEach((n, i) => {
        n.glow = Math.max(0, n.glow - dt * 1.6);
        n.mat.emissiveIntensity = 0.35 + n.glow * 2.5 + Math.sin(this.clock * 2 + L * 1.7 + i) * 0.05;
      }),
    );
  }

  private fire(L: number, i: number) {
    const node = this.layers[L]?.[i];
    if (!node || node.glow > 0.6) return; // already lit by another spark this pass
    node.glow = 1;
    const next = this.nodeAt[L + 1];
    if (!next) {
      // the output: a little crackle upwards
      for (let k = 0; k < 6; k++) {
        this.room.particles.emit({ position: this.nodeAt[L][i].clone(), velocity: V(rand(-0.4, 0.4), rand(0.5, 1.2), rand(-0.2, 0.2)), color: '#e0fbff', life: rand(0.2, 0.45), gravity: 2 });
      }
      return;
    }
    const targets = next.map((_, j) => j).sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
    for (const j of targets) this.sparks.push({ from: this.nodeAt[L][i], to: next[j], t: 0, layer: L + 1, i: j });
  }

  private every(key: string, seconds: number, dt: number) {
    const left = (this.timers.get(key) ?? Math.random() * seconds) - dt;
    this.timers.set(key, left <= 0 ? left + seconds : left);
    return left <= 0;
  }

  private emitters(dt: number) {
    for (const e of this.room.emitters) {
      if (e.kind === 'notes' && this.playing && this.spin > 2 && this.every('notes', 1.8, dt)) {
        this.room.notes(e.position.clone().add(V(0, -0.4, 0)));
      }
    }
  }
}
