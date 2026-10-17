/**
 * Someone comes into the bookshop (shop.ts) after a book they half remember: the bell, in at the
 * street door, up to the counter to ask. Tine doesn't look up; it's your turn. They wait at the
 * back by the shelves while you find it, and say so when you've got the wrong one, with the next
 * thing they remember. When you hand them the right one they take it to the counter, Tine says
 * what she thinks of it, and out they go.
 *
 * Who they are and what they say is customers.json (recorded in their own voices by
 * tools/commonplace/tine.py). Real books, and the way people really misremember them.
 */
import * as THREE from 'three';
import { toon } from '../scene/toon';
import { makeFigure, type Figure } from './figure';
import PEOPLE from './customers.json';

export type Person = (typeof PEOPLE)[number];
export const CUSTOMERS: Person[] = PEOPLE;

/**
 * Where they are: coming in to the counter, asking, waiting by the shelves for you, pleased with it
 * (or put right), at the counter paying while Tine has her say, and going out.
 */
export type Phase = 'in' | 'ask' | 'wait' | 'found' | 'pay' | 'out' | 'gone';

/** Their way about the shop (the shop's floor plan: round the table, along the counter). */
const DOOR_IN = new THREE.Vector3(-4.05, 0, 1.45);
const OUTSIDE = new THREE.Vector3(-4.8, 0, 1.45);
const AISLE = new THREE.Vector3(1.75, 0, 1.3);
const COUNTER = new THREE.Vector3(1.8, 0, 0.3);
const TURN = new THREE.Vector3(1.25, 0, -1.6);
const SHELF = new THREE.Vector3(0.35, 0, -2.05);
const PACE = 1.3;

export class Customer {
  readonly figure: Figure;
  phase: Phase = 'in';
  /** What they last said, and its key on the tape (`<id>.ask`, `.wrong<n>`, `.found`, `.tine`). */
  said = '';
  line = '';
  /** Which books on the shelves are still to try (by index in the person's list). */
  left: number[];
  /** Said something new since the shop last looked (it plays it, once). */
  fresh = false;
  /** Who's talking: them, or Tine (as they pay). */
  speaker: 'them' | 'tine' = 'them';
  /** Each of their steps, for the boards. */
  onStep?: (x: number, z: number) => void;
  private pos = DOOR_IN.clone();
  private heading = Math.PI / 2;
  private path: THREE.Vector3[] = [];
  private stride = 0;
  private lastStep = 0;
  private speed = 0;
  /** Seconds before they're done talking and move on. */
  private talk = 0;
  private wrongs = 0;
  private paid = false;
  private book: THREE.Mesh;

  constructor(readonly who: Person, scene: THREE.Scene) {
    const look = who.look;
    this.figure = makeFigure({
      coat: toon(new THREE.Color(look.coat), { own: true, bare: true }),
      boots: toon(new THREE.Color(look.boots), { own: true, bare: true }),
      scarf: toon(new THREE.Color(look.scarf), { own: true, bare: true }),
      skin: toon(new THREE.Color(look.skin), { own: true, bare: true }),
    });
    this.figure.root.scale.setScalar(look.tall);
    // (their hair, over the top and back of the head)
    const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(0.155, 1), toon(new THREE.Color(look.hair), { own: true, bare: true }));
    hair.scale.set(1.04, 0.8, 1.04);
    hair.position.set(0, 1.75, -0.03);
    this.figure.root.add(hair);
    // (the book they go out with, in their right hand, once it's found)
    this.book = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.17), toon(new THREE.Color('#6e2229'), { own: true, bare: true }));
    this.book.position.set(0, -0.6, 0.06);
    this.book.visible = false;
    this.figure.arms[1].add(this.book);
    scene.add(this.figure.root);
    this.left = who.books.map((_, i) => i);
    this.path = [AISLE.clone(), COUNTER.clone()];
    this.place();
  }

  get x() {
    return this.pos.x;
  }

  get z() {
    return this.pos.z;
  }

  /** The books on the shelves still to choose from: their place in the list, and their label. */
  choices() {
    return this.phase === 'wait' && this.talk <= 0.5 ? this.left.map((i) => ({ i, label: this.who.books[i].label })) : [];
  }

  /** You hand them a book (or tell them it isn't there): right, they're pleased; wrong, they say what else they remember. */
  choose(i: number) {
    if (this.phase !== 'wait' || !this.left.includes(i)) return;
    const book = this.who.books[i];
    if (book.right) {
      // (they go out with it; where there's no right book, the one he settles for: the last in the list)
      const kept = 'cover' in book ? book : this.who.books.filter((b) => 'cover' in b).at(-1)!;
      (this.book.material as THREE.MeshToonMaterial).color.set((kept as { cover: string }).cover);
      this.book.visible = true;
      this.phase = 'found';
      this.say('found', this.who.found);
    } else {
      this.left = this.left.filter((j) => j !== i);
      const n = Math.min(this.wrongs++, this.who.wrong.length - 1);
      this.say(`wrong${n}`, this.who.wrong[n]);
    }
  }

  private say(key: string, text: string, speaker: 'them' | 'tine' = 'them') {
    this.line = `${this.who.id}.${key}`;
    this.said = text;
    this.speaker = speaker;
    this.fresh = true;
    // (their takes run about fourteen characters a second)
    this.talk = 0.4 + text.length / 14;
  }

  /** How long the current line has to run (s). */
  get talking() {
    return this.talk;
  }

  update(dt: number) {
    this.talk = Math.max(0, this.talk - dt);
    const walking = this.path.length > 0;
    if (walking) this.walk(dt);
    else this.speed = 0;
    if (!walking) {
      const tine = this.phase === 'ask' || this.phase === 'pay';
      if (tine) this.face(3.45, -0.75);
      if (this.phase === 'wait' || this.phase === 'found') this.face(SHELF.x - 0.6, SHELF.z + 0.4);
      if (this.phase === 'in') (this.phase = 'ask'), this.say('ask', this.who.ask);
      else if (this.phase === 'ask' && this.talk <= 0) (this.phase = 'wait'), (this.path = [TURN.clone(), SHELF.clone()]);
      else if (this.phase === 'found' && this.talk <= 0) (this.phase = 'pay'), (this.path = [TURN.clone(), COUNTER.clone()]), (this.paid = false);
      else if (this.phase === 'pay' && !this.paid) (this.paid = true), this.say('tine', this.who.tine, 'tine');
      else if (this.phase === 'pay' && this.talk <= 0) (this.phase = 'out'), (this.path = [AISLE.clone(), DOOR_IN.clone(), OUTSIDE.clone()]);
      else if (this.phase === 'out') this.phase = 'gone';
    }
    this.place();
  }


  /** Turn (gently) to face a point. */
  private face(x: number, z: number) {
    let turn = Math.atan2(x - this.pos.x, z - this.pos.z) - this.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.heading += turn * 0.06;
  }

  private walk(dt: number) {
    const to = this.path[0];
    const dx = to.x - this.pos.x;
    const dz = to.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return void this.path.shift();
    this.speed += (PACE - this.speed) * (1 - Math.exp(-dt * 6));
    let turn = Math.atan2(dx, dz) - this.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.heading += turn * (1 - Math.exp(-dt * 10));
    const step = Math.min(d, this.speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    this.stride += step;
    if (this.stride - this.lastStep > 0.6) {
      this.lastStep = this.stride;
      this.onStep?.(this.pos.x, this.pos.z);
    }
  }

  private place() {
    const f = this.figure;
    f.root.position.copy(this.pos);
    f.root.rotation.set(0, this.heading, 0);
    const swing = Math.sin(this.stride * 9) * Math.min(1, this.speed / PACE) * 0.4;
    f.legs[0].rotation.x = swing;
    f.legs[1].rotation.x = -swing;
    f.arms[0].rotation.x = -swing * 0.8;
    // (the hand with the book in it holds it to them)
    f.arms[1].rotation.x = this.book.visible ? -0.5 : swing * 0.8;
    f.scarfTail.rotation.x = 0.1 + this.speed * 0.1;
  }

  /** Gone from the shop (out of the door, or you've left). */
  remove() {
    this.figure.root.removeFromParent();
  }
}
