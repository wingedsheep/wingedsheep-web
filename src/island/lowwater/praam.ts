/**
 * The praam: a flat little boat drawn up at the deep water's edge, east of the last twig, for
 * getting out to the lightship. You sit on its thwart facing the stern, the way anyone rows, so
 * all the way out you're looking back at where you came from. Each stroke leaves two small
 * puddles behind on the water, where the blades came out. Alongside her, she's bigger than she
 * looked from the flat; then you row back, and the boat stays drawn up the way you left it.
 */
import * as THREE from 'three';
import { LIGHTSHIP } from './lightship';

/** Where it lies drawn up, its stern on the sand and its bow over the deep, and where you get in from. */
export const PRAAM = new THREE.Vector2(3, -114.1);
export const BOARD = new THREE.Vector2(3.1, -112.3);
/** Alongside her, off the middle of her near side (clear of her hull however she's swung). */
const ALONGSIDE = new THREE.Vector2(LIGHTSHIP.x, LIGHTSHIP.y + 4.6);
/** The way out: straight off the edge, then round to come up alongside her, heading west. */
const WAY = new THREE.CubicBezierCurve(PRAAM.clone(), new THREE.Vector2(3, -120), new THREE.Vector2(2.5, ALONGSIDE.y), ALONGSIDE.clone());
const LENGTH = WAY.getLength();
/** One slow stroke (s), how much of it the blades are in, and the boat's speed through the water (m/s). */
const STROKE = 2.6;
const DRIVE = 0.4;
const SPEED = 0.95;
/** The oars' sweep (rad, toward the bow positive) at the catch and the finish, and how far the blades go down. */
const CATCH = 0.6;
const FINISH = -0.55;
const DIP = 0.24;
const LIFT = -0.08;
/** The boat: its length, beam, and where the oars pivot (local: bow +z). */
const L = 2.9;
const BEAM = 1.2;
const THOLE = new THREE.Vector3(0.6, 0.42, -0.25);
const LOOM = 2.2;
const INBOARD = 0.62;

type State = 'moored' | 'turn' | 'out' | 'along' | 'back';

export interface PraamHooks {
  /** Both blades in at the catch (where they went in). */
  stroke(blades: THREE.Vector2[]): void;
  /** And out again at the finish, leaving their puddles. */
  puddle(blades: THREE.Vector2[]): void;
}

export class Praam {
  readonly root = new THREE.Group();
  /** The oars on their tholes (sweep), and tipped down into the water (dip), port and starboard. */
  readonly pivots: THREE.Group[] = [];
  private tilts: THREE.Group[] = [];
  private state: State = 'moored';
  /** Going out (true) or back. */
  private outward = true;
  private s = 0;
  private phase = 0;
  private speed = 0;
  private heading = Math.PI;
  private pos = PRAAM.clone();
  private bob = 0;

  constructor(
    hull: THREE.Material,
    inside: THREE.Material,
    trim: THREE.Material,
    oar: THREE.Material,
    private hooks: PraamHooks,
  ) {
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      this.root.add(m);
      return m;
    };
    // a flat bottom, sides flared out a little, and square ends, the bow raked up higher
    box(BEAM - 0.3, 0.06, L - 0.3, inside, 0, 0.03, 0);
    for (const s of [-1, 1]) {
      box(0.06, 0.42, L - 0.1, hull, s * (BEAM / 2 - 0.08), 0.22, 0, 0, s * 0.22);
      box(0.08, 0.06, L - 0.05, trim, s * (BEAM / 2 - 0.03), 0.43, 0); // (the gunwale, pale where hands go)
    }
    box(BEAM - 0.35, 0.42, 0.06, hull, 0, 0.26, L / 2 - 0.1, -0.55);
    box(BEAM - 0.2, 0.4, 0.06, hull, 0, 0.22, -L / 2 + 0.06, 0.12);
    box(BEAM - 0.15, 0.05, 0.26, trim, 0, 0.3, 0.2); // the thwart, where you sit
    box(BEAM - 0.4, 0.05, 0.3, inside, 0, 0.3, -L / 2 + 0.3); // and a stern seat
    for (const s of [-1, 1]) {
      // an oar on each side, pivoting at its thole: loom, a pale blade, a handle
      const pivot = new THREE.Group();
      pivot.position.set(s * THOLE.x, THOLE.y, THOLE.z);
      const tilt = new THREE.Group();
      const loom = new THREE.Mesh(new THREE.BoxGeometry(LOOM, 0.045, 0.045), oar);
      loom.position.x = s * (LOOM / 2 - INBOARD);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.14), oar);
      blade.position.x = s * (LOOM - INBOARD - 0.2);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), trim);
      pin.position.set(0, 0.04, 0.05);
      tilt.add(loom, blade);
      pivot.add(tilt, pin);
      this.root.add(pivot);
      this.pivots.push(pivot);
      this.tilts.push(tilt);
    }
    this.pose(0);
    this.root.rotation.y = this.heading;
  }

  /** Whether you're in it (and not stood on the flat). */
  get afloat() {
    return this.state !== 'moored';
  }

  /** Lying alongside her, the oars still. */
  get alongside() {
    return this.state === 'along';
  }

  /** Out you go (you're in it now), or back. */
  row() {
    if (this.state === 'moored') (this.outward = true), (this.state = 'turn');
    else if (this.state === 'along') (this.outward = false), (this.state = 'turn');
    this.phase = 0;
  }

  /** Back on the sand at once (leaving the flat while out). */
  beach() {
    this.state = 'moored';
    this.s = 0;
    this.speed = 0;
    this.pos.copy(PRAAM);
    this.pose(0);
  }

  /** Where your seat is, and which way you face on it: to the stern. */
  seat(out: THREE.Vector3) {
    return this.root.localToWorld(out.set(0, 0.3, 0.22));
  }

  get facing() {
    return this.heading + Math.PI;
  }

  /** How your arms are held (forward is negative), pulling the handles in. */
  get arms() {
    if (this.state === 'along' || this.state === 'moored') return -0.55;
    const a = this.sweep(this.phase);
    return THREE.MathUtils.mapLinear(a, FINISH, CATCH, -0.55, -1.35);
  }

  update(dt: number, level: number, t: number, wind: number) {
    const going = this.state === 'turn' || this.state === 'out' || this.state === 'back';
    if (going) {
      const was = this.phase;
      this.phase = (this.phase + dt / STROKE) % 1;
      const blades = () => this.pivots.map((p) => {
        const b = p.localToWorld(new THREE.Vector3((p.position.x > 0 ? 1 : -1) * (LOOM - INBOARD - 0.2), 0, 0));
        return new THREE.Vector2(b.x, b.z);
      });
      if (this.phase < was) this.hooks.stroke(blades());
      if (was < DRIVE && this.phase >= DRIVE) this.hooks.puddle(blades());
      // the boat surges on each pull and carries on between them
      const want = (this.phase < DRIVE ? 1.35 : 0.75) * SPEED;
      this.speed += (want - this.speed) * (1 - Math.exp(-dt * 2.5));
    } else {
      this.speed *= Math.exp(-dt * 1.5);
    }
    const ahead = (this.outward ? WAY.getTangentAt(this.s) : WAY.getTangentAt(this.s).negate()).normalize();
    const face = Math.atan2(ahead.x, ahead.y);
    let turn = face - this.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    if (this.state === 'turn') {
      // round first, with the oars, nearly on the spot
      this.heading += Math.sign(turn) * Math.min(Math.abs(turn), dt * 0.5);
      if (Math.abs(turn) < 0.05) this.state = this.outward ? 'out' : 'back';
    } else if (this.state === 'out' || this.state === 'back') {
      this.s = THREE.MathUtils.clamp(this.s + ((this.outward ? 1 : -1) * this.speed * dt) / LENGTH, 0, 1);
      this.heading += turn * (1 - Math.exp(-dt * 3));
      if (this.outward && this.s >= 1) this.state = 'along';
      if (!this.outward && this.s <= 0) this.state = 'moored';
    }
    this.pos.copy(WAY.getPointAt(this.s));
    // drawn up, only the bow end floats; out on the water, a little bob and roll
    const up = this.state === 'moored' && this.s === 0 ? 0.15 : 1;
    this.bob = Math.sin((t / 3.7) * Math.PI * 2) * (0.015 + wind * 0.03) * up;
    this.root.position.set(this.pos.x, level - 0.08 + this.bob, this.pos.y);
    this.root.rotation.set(0, this.heading, 0);
    this.root.rotateZ(Math.sin((t / 4.3) * Math.PI * 2 + 0.6) * (0.015 + wind * 0.04) * up);
    this.pose(going ? this.phase : 0);
  }

  private sweep(p: number) {
    const ease = (k: number) => k * k * (3 - 2 * k);
    return p < DRIVE ? THREE.MathUtils.lerp(CATCH, FINISH, ease(p / DRIVE)) : THREE.MathUtils.lerp(FINISH, CATCH, ease((p - DRIVE) / (1 - DRIVE)));
  }

  /** The oars at a point in the stroke (or shipped: laid in along the boat). */
  private pose(p: number) {
    const shipped = this.state === 'moored' || this.state === 'along';
    const a = shipped ? 0 : this.sweep(p);
    // blades in for the drive, lifted clear for the recovery, back in at its very end
    const r = (p - DRIVE) / (1 - DRIVE);
    const dip = shipped ? 0 : p < DRIVE ? DIP : r < 0.12 ? THREE.MathUtils.lerp(DIP, LIFT, r / 0.12) : r > 0.9 ? THREE.MathUtils.lerp(LIFT, DIP, (r - 0.9) / 0.1) : LIFT;
    this.pivots.forEach((pivot, i) => {
      const s = i === 0 ? -1 : 1;
      // (shipped: swung in to lie along the boat, blades toward the bow)
      pivot.rotation.y = shipped ? -s * 1.5 : -s * a;
      this.tilts[i].rotation.z = shipped ? s * 0.03 : -s * dip;
    });
  }
}
