/**
 * The lead line: a mooring post at the edge of the deep water, out west of the last twig, with a
 * coil of line over it and the lead hung under the coil. Heave it and you swing the lead twice
 * and let it go; it goes in with a plunk, sinks, and finds the bottom, which you feel through the
 * line (on a phone) rather than hear. Then the call, the old leadsmen's way: "by the mark" when
 * one of the line's marks is at the water, "by the deep" when it's judged between two. Haul it
 * in, and what's stuck to the tallow in its foot says what the bottom's made of.
 */
import * as THREE from 'three';

/** Where the post stands, right at the edge (the deep starts just past it), and where you stand to heave. */
export const LEAD = new THREE.Vector2(-8, -113.6);
export const HEAVE_AT = new THREE.Vector2(-7.25, -113.85);

/** The fathoms that carry a mark, and what the mark's made of (each a different stuff, so it's known by feel in the dark). */
const MARKS: Record<number, string> = {
  2: 'the two strips of leather',
  3: 'the three strips of leather',
  5: 'the white rag',
  7: 'the red rag',
  10: 'the leather with a hole in it',
  13: 'the blue serge',
  15: 'the white rag',
  17: 'the red rag',
  20: 'the two knots',
};
const WORDS = ['nought', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];
const FATHOM = 1.8288;

/** How deep it is at a point past the edge (m): shelving away, with the gully's floor rising and falling, and shifting from day to day. */
function depthAt(x: number, z: number, day: number) {
  const out = Math.max(0, LEAD.y - 0.4 - z);
  return 4 + out * 1.15 + 2.2 * Math.sin(x * 0.37 + 1) + 2 * Math.sin(x * 0.13 + z * 0.21 + day * 0.27);
}

/** What the leadsman sings out for a depth (m), and what that means. */
export function call(depth: number) {
  const n = THREE.MathUtils.clamp(Math.round(depth / FATHOM), 2, 13);
  const m = Math.round(n * FATHOM);
  const mark = MARKS[n];
  if (mark) return `“By the mark, ${WORDS[n]}.” ${mark[0].toUpperCase()}${mark.slice(1)} was right at the water: ${m} metres.`;
  const below = Math.max(...Object.keys(MARKS).map(Number).filter((k) => k < n));
  const above = Math.min(...Object.keys(MARKS).map(Number).filter((k) => k > n));
  return `“By the deep, ${WORDS[n]}.” Between ${MARKS[below]} at ${WORDS[below]} and ${MARKS[above]} at ${WORDS[above]}, so that one’s judged: about ${m} metres.`;
}

/** What comes up on the tallow, by how deep it went. */
function tallow(depth: number) {
  const n = Math.round(depth / FATHOM);
  if (n <= 4) return 'On the tallow in its foot: fine grey sand.';
  if (n === 5) return 'On the tallow in its foot: sand, and bits of shell.';
  if (n === 6) return 'On the tallow in its foot: soft grey mud.';
  if (n === 7) return 'On the tallow in its foot: mud, and one small cockle.';
  return 'The tallow in its foot came up clean, with a dent in it: something hard down there. Old clay, maybe.';
}

type State = 'hung' | 'swing' | 'fly' | 'sink' | 'down' | 'haul' | 'up';
const SWING = 1.3;
const FLY = 0.95;
const DOWN = 2.6;
const HAUL = 3.2;
const UP = 0.6;
const SINK_SPEED = 3.5; // (m/s)
const POINTS = 14;

export interface LeadHooks {
  /** The lead going in, out there. */
  plunk(at: THREE.Vector2): void;
  /** It's touched the bottom. */
  bottom(): void;
  /** It's come up out of the water, near you. */
  surface(at: THREE.Vector2): void;
  /** Where the line goes into the water, now and then, a small ring. */
  stir(at: THREE.Vector2): void;
}

export class Lead {
  /** The post with its coil and the lead hung on it, to be stood on the flat. */
  readonly post = new THREE.Group();
  /** The lead out of its place, and the line paid out after it. */
  readonly flying: THREE.Mesh;
  readonly line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  /** What's been sung out, and then what came up (the card's second line). */
  said = '';
  private hung: THREE.Mesh;
  private state: State = 'hung';
  private t = 0;
  private from = new THREE.Vector3();
  private drop = new THREE.Vector2();
  private depth = 0;
  private water = new THREE.Vector2();
  private stirred = 0;

  constructor(
    wood: THREE.Material,
    rope: THREE.Material,
    lead: THREE.Material,
    lineMat: THREE.LineBasicMaterial,
    private rand: () => number,
    private day: number,
    private hooks: LeadHooks,
  ) {
    // a squat mooring post, its top worn round, a coil of line over it and the lead hung below
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.05, 7), wood);
    pole.position.y = 0.5;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 7), wood);
    cap.position.y = 1.06;
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 4, 12), rope);
    coil.position.set(0, 0.8, 0.15);
    coil.rotation.x = 0.35;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.32, 0.035), rope);
    tail.position.set(0.12, 0.52, 0.2);
    const shape = new THREE.CylinderGeometry(0.035, 0.055, 0.24, 6);
    this.hung = new THREE.Mesh(shape, lead);
    this.hung.position.set(0.12, 0.26, 0.2);
    this.post.add(pole, cap, coil, tail, this.hung);
    this.flying = new THREE.Mesh(shape, lead);
    this.flying.visible = false;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINTS * 3), 3));
    this.line = new THREE.Line(geo, lineMat);
    this.line.frustumCulled = false;
    this.line.visible = false;
  }

  /** Whether it's out of your hands: swinging, out in the water, or coming back in. */
  get busy() {
    return this.state !== 'hung';
  }

  /** Hauling it in, hand over hand (both arms). */
  get hauling() {
    return this.state === 'haul' || this.state === 'up';
  }

  /** How the heaving arm is held (its swing, forward is negative), or null when it's free. */
  get arm() {
    const k = this.t;
    switch (this.state) {
      case 'swing': {
        // two swings, the second one let go of at the front
        const a = k / SWING;
        return -1.35 * Math.sin(a * Math.PI * 2.5) * (0.55 + 0.45 * a);
      }
      case 'fly':
        return -1.35 + Math.min(1, k / 0.4) * 0.6;
      case 'sink':
      case 'down':
        return -0.6;
      case 'haul':
      case 'up':
        return -0.55 - 0.35 * Math.abs(Math.sin(k * 5));
      default:
        return null;
    }
  }

  heave() {
    if (this.busy) return;
    this.state = 'swing';
    this.t = 0;
    this.said = '';
    // out it goes: six to eight and a half metres, a little either way
    const far = 6 + this.rand() * 2.5;
    const side = (this.rand() - 0.5) * 6;
    this.drop.set(HEAVE_AT.x + side, HEAVE_AT.y - far);
    this.depth = depthAt(this.drop.x, this.drop.y, this.day);
    this.hung.visible = false;
    this.flying.visible = true;
    this.line.visible = true;
  }

  /** Let go of it: walked off mid-heave, the line goes back on its post. */
  letGo() {
    if (!this.busy) return;
    this.state = 'hung';
    this.said = '';
    this.hung.visible = true;
    this.flying.visible = false;
    this.line.visible = false;
  }

  update(dt: number, hand: THREE.Vector3, level: number) {
    if (!this.busy) return;
    this.t += dt;
    const lead = this.flying.position;
    switch (this.state) {
      case 'swing':
        lead.copy(hand).y -= 0.15;
        if (this.t >= SWING) this.next('fly'), this.from.copy(lead);
        break;
      case 'fly': {
        const k = Math.min(1, this.t / FLY);
        lead.set(
          THREE.MathUtils.lerp(this.from.x, this.drop.x, k),
          THREE.MathUtils.lerp(this.from.y, level, k) + Math.sin(k * Math.PI) * 2.6,
          THREE.MathUtils.lerp(this.from.z, this.drop.y, k),
        );
        if (k >= 1) {
          this.next('sink');
          this.flying.visible = false;
          this.water.copy(this.drop);
          this.hooks.plunk(this.drop);
        }
        break;
      }
      case 'sink':
        // (the line drifts in a little as it goes down)
        this.water.y = this.drop.y + Math.min(1, this.t / (this.depth / SINK_SPEED)) * 0.6;
        if (this.t >= this.depth / SINK_SPEED) {
          this.next('down');
          this.said = call(this.depth);
          this.hooks.bottom();
        }
        break;
      case 'down':
        if (this.t >= DOWN) this.next('haul'), this.from.set(this.water.x, 0, this.water.y);
        break;
      case 'haul': {
        // hand over hand, the line coming in to the edge in front of you
        const k = THREE.MathUtils.smoothstep(this.t / HAUL, 0, 1);
        this.water.set(THREE.MathUtils.lerp(this.from.x, hand.x, k), THREE.MathUtils.lerp(this.from.z, LEAD.y - 0.9, k));
        if (this.t >= HAUL) {
          this.next('up');
          this.flying.visible = true;
          this.hooks.surface(this.water);
        }
        break;
      }
      case 'up': {
        const k = Math.min(1, this.t / UP);
        lead.set(this.water.x, level, this.water.y).lerp(new THREE.Vector3(hand.x, hand.y - 0.15, hand.z), k);
        if (k >= 1) {
          this.said = `${call(this.depth)} ${tallow(this.depth)}`;
          this.state = 'hung';
          this.hung.visible = true;
          this.flying.visible = false;
          this.line.visible = false;
        }
        break;
      }
    }
    // (a small ring now and then where the line goes in)
    const wet = this.state === 'sink' || this.state === 'down' || this.state === 'haul';
    this.stirred += dt;
    if (wet && this.stirred > 1.3) (this.stirred = 0), this.hooks.stir(this.water);
    this.lay(hand, level);
  }

  private next(state: State) {
    this.state = state;
    this.t = 0;
  }

  /** The line from your hand to the lead (or to where it goes into the water), sagging a little. */
  private lay(hand: THREE.Vector3, level: number) {
    const end = this.flying.visible ? this.flying.position.clone() : new THREE.Vector3(this.water.x, level, this.water.y);
    const pos = this.line.geometry.attributes.position as THREE.BufferAttribute;
    const sag = this.state === 'fly' ? 0.1 : 0.35;
    for (let i = 0; i < POINTS; i++) {
      const s = i / (POINTS - 1);
      const p = hand.clone().lerp(end, s);
      p.y -= Math.sin(s * Math.PI) * sag * hand.distanceTo(end) * 0.12;
      pos.setXYZ(i, p.x, Math.max(p.y, level + 0.01), p.z);
    }
    pos.needsUpdate = true;
  }
}
