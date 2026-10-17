/**
 * A crab canon, laid in pebbles across a bank out west: a tune that's played against itself
 * backwards. Each pebble is a note, laid nearer or further by its pitch so the row is the tune's
 * own shape. Step onto one and it sounds, and so does the one as far in from the other end, so
 * walking the row you play both voices at once: the two lit pebbles come in from the ends, meet on
 * the middle one, and pass. Walk it from either end and you get the same music, which is the
 * whole trick. The tune's mine: every pair it makes is a third, a sixth or an octave, in the
 * stones' own tuning (found by trying tunes against their reverse until every pair rang true).
 */
import * as THREE from 'three';

/** The tune, in steps of the stones' scale from G (0) up: G A C B D E F♯ G A C B G E F♯ G. */
const TUNE = [0, 1, 3, 2, 4, 5, 6, 7, 8, 10, 9, 7, 5, 6, 7];
const SCALE = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
/** How far apart the pebbles are along the row (m), and how much further off a step higher lies. */
export const SPACING = 0.85;
const RISE = 0.24;
/** Within this of the row's line (m), you're on it. */
const BAND = 1.4;
/** The pace you walk it at when the card walks you (m/s): two notes a second. */
export const CANON_PACE = 1.7;

export class Canon {
  readonly pebbles: { at: THREE.Vector2; mesh: THREE.Mesh; mat: THREE.MeshToonMaterial; freq: number; lit: number }[] = [];
  /** The pebble you're on (or -1), and how many you've walked in a row, one after the next, either way. */
  private on = -1;
  private run = 0;
  private dir = 0;
  /** Whether you've walked it end to end (the card's second line), until you walk off. */
  played = false;

  constructor(
    readonly at: THREE.Vector2,
    base: number,
    material: (c: THREE.Color) => THREE.MeshToonMaterial,
    rand: () => number,
  ) {
    const geo = new THREE.IcosahedronGeometry(0.25, 0);
    TUNE.forEach((step, i) => {
      const freq = base * SCALE[step % 7] * 2 ** Math.floor(step / 7);
      const p = new THREE.Vector2(this.x(i), at.y - (step - 5) * RISE + (rand() - 0.5) * 0.05);
      // pale and darker by turns, like the ring's stones; each a little its own way round
      const mat = material(new THREE.Color(i % 2 ? '#9a96ad' : '#c4bfd0'));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(1, 0.5, 0.8 + rand() * 0.2);
      mesh.rotation.y = rand() * Math.PI;
      this.pebbles.push({ at: p, mesh, mat, freq, lit: 0 });
    });
  }

  get length() {
    return TUNE.length;
  }

  /** Where pebble i lies across the row (x). */
  x(i: number) {
    return this.at.x + (i - (TUNE.length - 1) / 2) * SPACING;
  }

  /** Whether (x, z) is on the row, or just off its ends. */
  near(x: number, z: number, margin = 0) {
    return Math.abs(z - this.at.y) < BAND + margin && Math.abs(x - this.at.x) < ((TUNE.length - 1) / 2) * SPACING + 0.5 + margin;
  }

  /** The end you're nearer, just off it (where a walk along it starts), and the other. */
  ends(x: number) {
    const half = ((TUNE.length - 1) / 2) * SPACING + 0.8;
    const side = x < this.at.x ? -1 : 1;
    return [new THREE.Vector2(this.at.x + side * half, this.at.y), new THREE.Vector2(this.at.x - side * half, this.at.y)];
  }

  /**
   * Where you are this frame: stepping onto a pebble sounds it and its partner (`play(yours,
   * theirs)`, pebble indices; the same one in the middle). Lights them, and lets them go dark.
   */
  update(dt: number, x: number, z: number, play: (yours: number, theirs: number) => void) {
    const i = Math.round((x - this.x(0)) / SPACING);
    const now = Math.abs(z - this.at.y) < BAND && i >= 0 && i < TUNE.length && Math.abs(x - this.x(i)) < SPACING * 0.4 ? i : -1;
    if (now >= 0 && now !== this.on) {
      const j = TUNE.length - 1 - now;
      // (a walk along it, one pebble after the next the same way, counts towards playing it through)
      const d = this.on >= 0 ? now - this.on : 0;
      if (Math.abs(d) === 1 && (d === this.dir || this.run === 1)) this.run++, (this.dir = d);
      else (this.run = 1), (this.dir = 0);
      if (this.run >= TUNE.length) this.played = true;
      this.pebbles[now].lit = 1;
      this.pebbles[j].lit = 1;
      play(now, j);
    }
    if (now >= 0 || !this.near(x, z, 0.6)) this.on = now;
    if (!this.near(x, z, 3)) (this.played = false), (this.run = 0);
    for (const p of this.pebbles) {
      p.lit = Math.max(0, p.lit - dt / 0.9);
      // lit when it sounds, in two steps back down
      const step = p.lit > 0.55 ? 0.8 : p.lit > 0.15 ? 0.35 : 0;
      p.mat.emissive.setRGB(step, step * 0.92, step * 0.8);
    }
  }
}
