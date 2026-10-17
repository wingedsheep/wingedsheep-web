/**
 * The forks: a sentence on the page that you walk. It starts as one word, written small, west of
 * where you come on. Step on a word and it's said: it goes into ink, and the words that could come
 * next are drawn out from it in pencil, each line as thick as I'd guess that word was likely. What
 * comes after a word isn't there until you've said it. Step on one of them and so on, to a full
 * stop; the words you didn't take stay where they are, in pencil, for as long as you're here.
 * After the full stop a second sentence starts, and some of its thicknesses lean on the words you
 * said in the first: everything already on the page has a say in what comes next.
 *
 * Words are drawn in the page's letters (letters.ts), one mark a texel, and lines a texel or three
 * wide, so both are scaled with the texel each frame; where they lie is in metres.
 */
import * as THREE from 'three';
import { write, type Written } from './letters';
import { NEXT, SENTENCE } from './words';

const INK = new THREE.Color('#2a2b47');
const PENCIL = new THREE.Color('#a29d8e');
/** Where the sentence starts: west of where you come on, out of sight until you've walked a little. */
const START = new THREE.Vector3(-40, 0, -6);
/** Each line's length (m, north), and how far apart the words at a fork lie. */
const LEN = 5.5;
const SPREAD: Record<number, number[]> = { 1: [0], 2: [-4.6, 4.6], 3: [-7.5, 0, 7.5] };
/** The texel the layout's made for (m): a word's room on the page. */
const T0 = 0.14;
/** Lines grow at this many metres a second, and words are written at this many letters a second. */
const DRAW = 9;
const HAND = 16;

interface Word {
  key: string;
  w: string;
  at: THREE.Vector3;
  mesh: THREE.Mesh;
  text: Written;
  /** The line it was reached by (none for the first), from the word before it. */
  line: Line | null;
  /** Seconds until it starts being written. */
  wait: number;
  letters: number;
}

interface Line {
  from: Word;
  mesh: THREE.Mesh;
  /** Its thickness in texels. */
  weight: number;
  wait: number;
  grown: number;
}

export class Forks {
  readonly group = new THREE.Group();
  /** The words said so far; how many of them the first sentence was (once it's had its full stop); whether the second's ended too. */
  said: string[] = [];
  first = 0;
  done = false;
  /** How many words were said when a fork in the second sentence first leant (0: none yet; if the first said both sides of one, it can't). */
  leaned = 0;
  /**
   * For the sound: the pencil starting a word (or its line) for so many seconds, from so near (0–1)
   * and that side (−1–1); a word going into ink; the full stop.
   */
  onPencil?: (seconds: number, near: number, pan: number, line: boolean) => void;
  onSay?: (stop: boolean) => void;
  private ink = new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide });
  private pencil = new THREE.MeshBasicMaterial({ color: PENCIL, side: THREE.DoubleSide });
  private words: Word[] = [];
  private lines: Line[] = [];
  /** The words you could step on next. */
  private open: Word[] = [];
  private last: Word | null = null;
  private strip = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);

  /** depth: one texel's worth of the page's depth, in texels across (1/sin of the slant). */
  constructor(private depth: number) {
    this.reset();
  }

  /** Back to one word on a clean page. */
  reset() {
    for (const w of this.words) (this.group.remove(w.mesh), w.text.geometry.dispose());
    for (const l of this.lines) this.group.remove(l.mesh);
    this.words = [];
    this.lines = [];
    this.said = [];
    this.first = 0;
    this.done = false;
    this.leaned = 0;
    this.last = null;
    this.open = [this.word('a', START, null, 0)];
  }

  /** The sentences as walked, written out properly. */
  get sentence() {
    const write = (words: string[], stop: boolean) => {
      const s = words.join(' ').replace(/\bi\b/g, 'I');
      return `${s.charAt(0).toUpperCase()}${s.slice(1)}${stop ? '.' : ''}`;
    };
    if (!this.first) return `“${write(this.said, false)}”`;
    const rest = this.said.slice(this.first);
    return `“${write(this.said.slice(0, this.first), true)}${rest.length ? ` ${write(rest, this.done)}` : ''}”`;
  }

  /** In the second sentence: had the first's full stop and said a word since. */
  get second() {
    return this.first > 0 && this.said.length > this.first;
  }

  /** How far you are from the sentence: its first word before you've begun, the last one said after. */
  distance(pos: THREE.Vector3) {
    return pos.distanceTo((this.last ?? this.open[0]).at);
  }

  /** How far across the words you could step on next reach (m, west and east), for the camera; null if none. */
  reach(texel: number): [number, number] | null {
    if (!this.open.length) return null;
    let west = Infinity;
    let east = -Infinity;
    for (const w of this.open) {
      const half = w.w.length * 3.5 * texel;
      west = Math.min(west, w.at.x - half);
      east = Math.max(east, w.at.x + half);
    }
    return [west, east];
  }

  get begun() {
    return this.said.length > 0;
  }

  private word(key: string, at: THREE.Vector3, from: Word | null, weight: number, wait = 0) {
    const w = SENTENCE[key].w;
    const text = write(w, this.depth);
    text.geometry.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(text.geometry, this.pencil);
    mesh.position.copy(at).setY(0.006);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    let line: Line | null = null;
    if (from) {
      const m = new THREE.Mesh(this.strip, this.pencil);
      m.renderOrder = 1;
      m.frustumCulled = false;
      m.scale.set(0, 1, 0);
      this.group.add(m);
      line = { from, mesh: m, weight, wait, grown: 0 };
      this.lines.push(line);
    }
    const word: Word = { key, w, at: at.clone(), mesh, text, line, wait: line ? wait + LEN / DRAW : wait, letters: 0 };
    this.words.push(word);
    return word;
  }

  /** Said: into ink, and what could come next drawn out from it. */
  private say(word: Word) {
    this.said.push(word.w);
    this.last = word;
    word.mesh.material = this.ink;
    if (word.line) word.line.mesh.material = this.ink;
    const next = SENTENCE[word.key].to;
    if (!next.length) {
      // the first sentence's stop starts the second, a space further on; the second's is the end
      if (this.first) this.done = true;
      else this.first = this.said.length;
      this.open = this.done ? [] : [this.word(NEXT, word.at.clone().add(new THREE.Vector3(0, 0, -(7 * this.depth * T0 + 3.5))), null, 0, 1.2)];
      // (and its full stop)
      word.text.geometry.dispose();
      word.text = write(`${word.w}.`, this.depth);
      word.mesh.geometry = word.text.geometry;
      this.onSay?.(true);
      return;
    }
    this.onSay?.(false);
    // (a fork wanders as a path does, but keeps coming back towards where the sentence began)
    const lean = THREE.MathUtils.clamp((START.x - word.at.x) * 0.3, -4, 4);
    const top = 7 * this.depth * T0 + 0.5;
    // (the words that lean on something already said take three quarters between them)
    const leant = next.map(([, , lean]) => !!lean?.some((w) => this.said.slice(0, this.first || undefined).includes(w)));
    const share = (on: boolean) => next.reduce((sum, [, p], i) => sum + (leant[i] === on ? p : 0), 0);
    const any = leant.some(Boolean) && !leant.every(Boolean);
    if (any && !this.leaned) this.leaned = this.said.length;
    this.open = next.map(([key, base], i) => {
      const p = any ? (base / share(leant[i])) * (leant[i] ? 0.75 : 0.25) : base;
      const at = new THREE.Vector3(word.at.x + SPREAD[next.length][i] + lean, 0, word.at.z - top - LEN);
      return this.word(key, at, word, p >= 0.5 ? 3 : p >= 0.25 ? 2 : 1, 0.15 + i * 0.25);
    });
  }

  update(dt: number, pos: THREE.Vector3, texel: number) {
    // stood on a word you could say next: said
    for (const w of this.open) {
      if (w.letters < 1) continue;
      const half = (w.text.width / 2) * texel + 0.5;
      const north = w.at.z - 7 * this.depth * texel - 0.3;
      if (Math.abs(pos.x - w.at.x) < half && pos.z < w.at.z + 0.7 && pos.z > north) {
        this.say(w);
        break;
      }
    }
    // heard from where it's being written: softer further off, gone past about 30 m
    const hear = (at: THREE.Vector3) => [Math.max(0, 1 - pos.distanceTo(at) / 30), THREE.MathUtils.clamp((at.x - pos.x) / 14, -1, 1)] as const;
    for (const l of this.lines) {
      if (l.wait > 0 && l.wait - dt <= 0) this.onPencil?.(LEN / DRAW, ...hear(l.from.at), true);
      l.wait -= dt;
      if (l.wait < 0) l.grown = Math.min(1, l.grown + (dt * DRAW) / LEN);
    }
    for (const w of this.words) {
      if (w.wait > 0 && w.wait - dt <= 0) this.onPencil?.((w.text.marks.length - 1) / HAND, ...hear(w.at), false);
      w.wait -= dt;
      if (w.wait < 0 && w.letters < w.text.marks.length - 1) w.letters = Math.min(w.text.marks.length - 1, w.letters + dt * HAND);
      w.text.geometry.setDrawRange(0, w.text.marks[Math.floor(w.letters)]);
      w.mesh.scale.set(texel, 1, texel);
    }
    // each line from just past the top of the word before to the foot of its own, as thick as it was likely
    for (const w of this.words) {
      const l = w.line;
      if (!l) continue;
      const from = new THREE.Vector3(l.from.at.x, 0.005, l.from.at.z - 7 * this.depth * texel - 0.35);
      const to = new THREE.Vector3(w.at.x, 0.005, w.at.z + 2 * this.depth * texel + 0.15);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const len = Math.hypot(dx, dz);
      l.mesh.position.copy(from);
      l.mesh.rotation.set(0, Math.atan2(-dx, -dz), 0);
      // (as many texels thick on screen whichever way it goes: across the page's depth, a line has to be wider)
      const across = Math.hypot(dz / len, (dx / len) * this.depth);
      l.mesh.scale.set(l.weight * texel * across, 1, len * l.grown);
    }
  }
}
