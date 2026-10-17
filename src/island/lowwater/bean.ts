/**
 * A sea heart, in the wrack on a low bank of its own out west: the seed of a Caribbean vine
 * (Entada gigas), carried here by the Gulf Stream. The wrack is the tide's line of dried weed
 * along the bank's crest, broken and wandering, with a bit of shell and a feather in it. Send the
 * bean on and you toss it, underarm, into the water north of the bank, where it floats off with
 * the current, round the banks rather than over them, until it's out of sight. Leave the flat and
 * it's back in the wrack for whoever walks out next.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Where = 'lying' | 'held' | 'flying' | 'afloat' | 'gone';

/** How long the wrack runs along the crest (m), and how far it wanders either side of it. */
const WRACK_LENGTH = 4.4;
const WANDER = 0.3;
/** The swing (s): the arm back and through, then the bean in the air. */
const SWING = 0.45;
const FLIGHT = 1;
/** How high over a straight line it goes (m): a low throw, not a lob. */
const ARC = 0.55;
/** The current it goes off on (m/s): north, and a little east. */
const DRIFT = new THREE.Vector2(0.09, -0.44);
/** How long it's watched afloat before it's gone for good (s), and its bob (m: a texel's worth). */
const LIFE = 150;
const BOB = 0.035;
/** How deep the sand has to be ahead of it to float on (m): under water even at the bottom of the tide. */
const AFLOAT = -0.05;

/** Dried weed, dark olive to brown-black; and what's caught in it. */
const WRACK = ['#2e2b20', '#3b3826', '#26211f'].map((c) => new THREE.Color(c));
const SHELL = new THREE.Color('#cfc6c4');
const FEATHER = new THREE.Color('#d8d4cc');

/** A box for the wrack, laid on the sand at (x, z), turned by `turn`, in one colour. */
function piece(x: number, y: number, z: number, size: THREE.Vector3, turn: number, tilt: number, color: THREE.Color) {
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y + size.y * 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, turn, 0)), new THREE.Vector3(1, 1, 1)));
  const colors = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

export class SeaHeart {
  /** The bean, and the wrack it lies in (with a hit box over it, the wrack being thin to click on). */
  readonly root = new THREE.Group();
  readonly wrack: THREE.Mesh;
  readonly hit: THREE.Mesh;
  where: Where = 'lying';
  /** Where it lies in the wrack (x, z). */
  readonly lies: THREE.Vector2;
  private age = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector2();
  private afloatAt = new THREE.Vector2();
  private ringAt = 0;
  /** Which way it's drifting (atan2(x, z)), and how long it keeps to a bank's edge before trying the current's way again (s). */
  private heading = Math.atan2(DRIFT.x, DRIFT.y);
  private keep = 0;

  constructor(
    crest: THREE.Vector2,
    private ground: (x: number, z: number) => number,
    wrackMat: THREE.Material,
    beanMat: THREE.Material,
    glintMat: THREE.Material,
    rand: () => number,
  ) {
    // the line the tide left: wandering along the crest, in clumps with gaps between
    const line = (x: number) => crest.y + WANDER * (Math.sin(x * 1.3 + 0.4) * 0.7 + Math.sin(x * 3.1 + 2) * 0.3);
    const parts: THREE.BufferGeometry[] = [];
    let x = crest.x - WRACK_LENGTH / 2;
    const end = crest.x + WRACK_LENGTH / 2;
    while (x < end) {
      // a clump, then a gap (shorter towards the ends, where it gives out)
      const run = 0.25 + rand() * 0.6;
      for (let s = x; s < Math.min(end, x + run); s += 0.09 + rand() * 0.06) {
        const z = line(s) + (rand() - 0.5) * 0.12;
        const turn = Math.atan2(line(s + 0.1) - line(s), 0.1) + (rand() - 0.5) * 0.9;
        const size = new THREE.Vector3(0.12 + rand() * 0.14, 0.03 + rand() * 0.03, 0.07 + rand() * 0.09);
        parts.push(piece(s, this.ground(s, z), z, size, -turn, 0, WRACK[Math.floor(rand() * WRACK.length)]));
      }
      x += run + 0.1 + rand() * 0.3 * (1 + Math.abs(x - crest.x) / (WRACK_LENGTH / 2));
    }
    // and a few strays, mostly on the landward side, where the wind's had them
    for (let i = 0; i < 9; i++) {
      const s = crest.x + (rand() - 0.5) * WRACK_LENGTH * 0.9;
      const z = line(s) + 0.25 + rand() * 0.45;
      parts.push(piece(s, this.ground(s, z), z, new THREE.Vector3(0.1 + rand() * 0.1, 0.03, 0.06 + rand() * 0.05), rand() * Math.PI, 0, WRACK[i % WRACK.length]));
    }
    // a bit of shell or three, and a gull's feather, one end up on the weed
    for (const s of [-1.6, -0.3, 1.2]) {
      const sx = crest.x + s + (rand() - 0.5) * 0.3;
      const z = line(sx) + (rand() - 0.5) * 0.1;
      parts.push(piece(sx, this.ground(sx, z) + 0.01, z, new THREE.Vector3(0.09, 0.03, 0.08), rand() * Math.PI, 0, SHELL));
    }
    const fx = crest.x - 0.9;
    parts.push(piece(fx, this.ground(fx, line(fx)) + 0.03, line(fx) + 0.05, new THREE.Vector3(0.3, 0.02, 0.06), 0.35, 0.25, FEATHER));
    this.wrack = new THREE.Mesh(mergeGeometries(parts), wrackMat);
    for (const p of parts) p.dispose();
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(WRACK_LENGTH + 0.4, 0.4, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.set(crest.x, this.ground(crest.x, crest.y), crest.y + 0.1);

    // the bean: a flat, rounded seed, glossy dark chestnut, its edge catching the
    // last of the light (far bigger than a real one's 5 cm, or it'd be nothing from up here)
    const seed = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), beanMat);
    seed.scale.set(0.16, 0.06, 0.14);
    const glint = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.05), glintMat);
    glint.position.set(-0.05, 0.035, 0.11);
    this.root.add(seed, glint);
    this.lies = new THREE.Vector2(crest.x + 1.1, line(crest.x + 1.1));
    this.reset();
  }

  /** In the wrack again, as it was. */
  reset() {
    this.where = 'lying';
    this.age = 0;
    this.root.scale.setScalar(1);
    // (propped on the weed, tipped up towards you a little)
    this.root.position.set(this.lies.x, this.ground(this.lies.x, this.lies.y) + 0.07, this.lies.y);
    this.root.rotation.set(0.45, 0.4, 0);
  }

  /** Picked up, to be thrown to (x, z) on the water. */
  toss(to: THREE.Vector2) {
    if (this.where !== 'lying') return;
    this.where = 'held';
    this.age = 0;
    this.to.copy(to);
  }

  /** Where it's being thrown to. */
  get target() {
    return this.to;
  }

  /** Thrown, and not coming back this visit. */
  get sent() {
    return this.where === 'flying' || this.where === 'afloat' || this.where === 'gone';
  }

  /** Where it's floating, if it is. */
  get floating() {
    return this.where === 'afloat' ? this.afloatAt : null;
  }

  /** The throwing arm (rad), back and through underarm, and its follow-through; null when it's not throwing. */
  get arm() {
    if (this.where === 'held') {
      const t = this.age / SWING;
      return t < 0.5 ? 0.8 * (t / 0.5) : 0.8 - 2.2 * ((t - 0.5) / 0.5);
    }
    if (this.where === 'flying' && this.age < 0.35) return -1.4 * (1 - this.age / 0.35);
    return null;
  }

  /**
   * Which way the current takes it this frame (a heading, as atan2(x, z)): the current's own,
   * or, with a bank ahead, along the bank's edge, kept a while so it gets round rather than
   * nosing back in; null if there's no way on from here.
   */
  private flow(dt: number) {
    const p = this.afloatAt;
    const clear = (a: number) => this.ground(p.x + Math.sin(a) * 1.2, p.y + Math.cos(a) * 1.2) <= AFLOAT;
    const want = Math.atan2(DRIFT.x, DRIFT.y);
    this.keep -= dt;
    if (this.keep <= 0 && clear(want)) return (this.heading = want);
    if (clear(this.heading)) return this.heading;
    for (let k = 1; k <= 16; k++) {
      for (const side of [1, -1]) {
        const a = this.heading + side * k * 0.2;
        if (!clear(a)) continue;
        this.keep = 2;
        return (this.heading = a);
      }
    }
    return null;
  }

  /**
   * Each frame: `hand` is where your throwing hand is. Says when it hits the water ('landed'),
   * and when it's due a small ring as it bobs ('ring').
   */
  update(dt: number, hand: THREE.Vector3, level: number, time: number): 'landed' | 'ring' | null {
    this.age += dt;
    const r = this.root;
    if (this.where === 'held') {
      r.position.copy(hand);
      if (this.age < SWING) return null;
      this.where = 'flying';
      this.age = 0;
      this.from.copy(hand);
    }
    if (this.where === 'flying') {
      const t = Math.min(1, this.age / FLIGHT);
      r.position.set(THREE.MathUtils.lerp(this.from.x, this.to.x, t), THREE.MathUtils.lerp(this.from.y, level, t) + ARC * 4 * t * (1 - t), THREE.MathUtils.lerp(this.from.z, this.to.y, t));
      r.rotation.set(0.45 + t * 5, 0.4, t * 2);
      if (t < 1) return null;
      this.where = 'afloat';
      this.age = 0;
      this.afloatAt.copy(this.to);
      this.heading = Math.atan2(DRIFT.x, DRIFT.y);
      this.keep = 0;
      this.ringAt = 3;
      r.rotation.set(0, 0.4, 0);
      return 'landed';
    }
    if (this.where === 'afloat') {
      if (this.age > LIFE) {
        this.where = 'gone';
        r.scale.setScalar(0);
        return null;
      }
      // off on the current; where a bank's in the way, along its edge instead, as the water goes
      const way = this.flow(dt);
      if (way !== null) this.afloatAt.add(new THREE.Vector2(Math.sin(way), Math.cos(way)).multiplyScalar(DRIFT.length() * dt));
      // low in the water, riding a little up and down, and rocking with it
      r.position.set(this.afloatAt.x, level - 0.01 + BOB * Math.sin(time * 1.4), this.afloatAt.y);
      r.rotation.set(Math.sin(time * 1.4 + 1) * 0.12, 0.4 + this.age * 0.03, Math.sin(time * 1.1) * 0.1);
      if (this.age > this.ringAt) {
        this.ringAt = this.age + 4 + Math.random() * 3;
        return 'ring';
      }
    }
    return null;
  }
}
