/**
 * The stones: through the ring of signs drawn on the page, three inscribed stones that are never
 * side by side, standing in the dark in a row: the slab from Rashid (in London now), the obelisk
 * from Philae (in a garden in Dorset), and a block of a wall in Luxor (still there). The same few
 * names are cut in them, in a writing nobody could read for fourteen hundred years.
 *
 * You walk along their feet with a low light raking across them from the west, the way an
 * inscription's read, and the signs you work out go white with chalk, as the slab's letters were
 * in London for nearly two hundred years. Ptolemy's ring has his name in Greek under it, so its
 * signs are his sounds; Cleopatra's shares four of them, and her base names her; the block in
 * Luxor has no Greek at all, and all but one of its signs are ones you know by then. Its name is
 * yours to read (commonplace.ts takes it in the card's line).
 *
 * Its own scene and camera, looking north at the faces from a little above the floor, drawn
 * through the island's PixelRenderer like the other places. Walking west off the floor, onto the
 * page you came in through, takes you back to it.
 */
import * as THREE from 'three';
import { toon } from '../scene/toon';
import { makeFigure, STEP, walk, type Figure } from './figure';
import { Face, type Glyph } from './face';
import SIGNS from './signs.json';
import { Linear, LINEAR, type LinearCard, type LinearThing } from './linear';

const DARK = new THREE.Color('#121117');
const FLOOR = new THREE.Color('#1c1a21');
const FLECK = new THREE.Color('#25232b');
const PAPER = new THREE.Color('#e4ddc8');
/** Texture pixels to the metre on the faces, and how big a ring's signs are drawn (each sign's pixel, in texture pixels). */
const PX = 32;
const BIG = 2;

const ELEVATION = THREE.MathUtils.degToRad(8);
const DISTANCE = 60;
const PACE = 2;
/** The floor you can walk: from the page at its west end to the block's far side, and out from the faces. */
const WEST = -5;
const EAST = LINEAR.east;
const NEAR = 0.7;
const FAR_OUT = 6.5;
/** Walked west past here, you're on the page you came in through: and past the second, back on it. */
const SHEET = -2.2;
const WAY_BACK = -4.4;
/** Stood this long anywhere, the stones' first card again. */
const STILL = 9;
/** Each of the obelisk's signs chalks this long after the last, top to bottom, while you stand at its foot. */
const CHALK_EVERY = 0.38;

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

/** The three names, sign by sign, and the sound each sign was given by the Greek (the egg isn't a sound: it says she's a woman). */
const PTOLEMY: [Glyph, string][] = [['stool', 'P'], ['bread', 'T'], ['lasso', 'O'], ['lion', 'L'], ['board', 'M'], ['reeds', 'I'], ['cloth', 'S']];
const CLEOPATRA: [Glyph, string][] = [['basket', 'K'], ['lion', 'L'], ['reed', 'E'], ['lasso', 'O'], ['stool', 'P'], ['vulture', 'A'], ['hand', 'T'], ['mouth', 'R'], ['vulture', 'A'], ['bread', 'T'], ['egg', '']];
const ALEXANDER: [Glyph, string][] = [['vulture', 'A'], ['lion', 'L'], ['basket', 'K'], ['cloth', 'S'], ['reed', 'E'], ['water', 'N'], ['hand', 'T'], ['mouth', 'R'], ['cloth', 'S']];

/** The Rosetta decree's first lines, in its Greek (which is how the rest of it could be read at all). */
const DECREE =
  'ΒΑΣΙΛΕΥΟΝΤΟΣ ΤΟΥ ΝΕΟΥ ΚΑΙ ΠΑΡΑΛΑΒΟΝΤΟΣ ΤΗΝ ΒΑΣΙΛΕΙΑΝ ΠΑΡΑ ΤΟΥ ΠΑΤΡΟΣ ΚΥΡΙΟΥ ΒΑΣΙΛΕΙΩΝ ΜΕΓΑΛΟΔΟΞΟΥ ΤΟΥ ΤΗΝ ΑΙΓΥΠΤΟΝ ΚΑΤΑΣΤΗΣΑΜΕΝΟΥ ΚΑΙ ΤΑ ΠΡΟΣ ΤΟΥΣ ΘΕΟΥΣ ΕΥΣΕΒΟΥΣ ΑΝΤΙΠΑΛΩΝ ΥΠΕΡΤΕΡΟΥ ΤΟΥ ΤΟΝ ΒΙΟΝ ΤΩΝ ΑΝΘΡΩΠΩΝ ΕΠΑΝΟΡΘΩΣΑΝΤΟΣ ';
/** And the petition on the obelisk's base, to the king and the two queens. */
const PETITION = 'ΒΑΣΙΛΕΙ ΠΤΟΛΕΜΑΙΩΙ ΚΑΙ ΒΑΣΙΛΙΣΣΗΙ ΚΛΕΟΠΑΤΡΑΙ ΤΗΙ ΑΔΕΛΦΗΙ ΚΑΙ ΒΑΣΙΛΙΣΣΗΙ ΚΛΕΟΠΑΤΡΑΙ ΤΗΙ ΓΥΝΑΙΚΙ ';


export type StoneCard = 'stone' | 'ptolemy' | 'cleopatra' | 'alexander' | 'read' | 'back' | LinearCard;
export type StoneThing = 'slab' | 'obelisk' | 'block' | 'back' | LinearThing;
type Which = 'ptolemy' | 'cleopatra' | 'alexander';

interface Slot {
  which: Which;
  glyph: Glyph;
  /** The sound the Greek gives it (Alexander's are only ever what you've learned). */
  letter: string;
  face: Face;
  /** Its box in the face's texture (px, from the top left), and where it is in the world (m). */
  px: number;
  py: number;
  w: number;
  h: number;
  x: number;
  y: number;
  /** Chalked in, and the letter chalked by it; and where that letter goes (px, its top left). */
  chalk: string | null;
  lx: number;
  ly: number;
}


function glyphSize(g: Glyph) {
  const rows = SIGNS[g];
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length };
}

export class Stone {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  card: StoneCard | null = null;
  /** Walked back off the floor onto the page. */
  leaving = false;
  /** Read the last name yourself. */
  read = false;
  /** Guessed the last name, wrongly, this many times. */
  wrong = 0;
  /** Each footstep, for the sound. */
  onStep?: () => void;
  /** A sign chalked in: where across the picture (−1..1). */
  onChalk?: (pan: number) => void;
  private you: Figure;
  private pos = new THREE.Vector3();
  private heading = Math.PI / 2;
  private speed = 0;
  private goal: THREE.Vector3 | null = null;
  private keys = new Set<string>();
  private stride = 0;
  private lastStep = 0;
  private stillFor = 0;
  private clicked = false;
  private faces: Face[] = [];
  private slots: Slot[] = [];
  /** What each sign's been found to say. */
  private learned = new Map<Glyph, string>();
  private chalkClock = 0;
  private pickables: THREE.Object3D[] = [];
  private floor: THREE.Mesh;
  private target = new THREE.Vector3();
  private pan = new THREE.Vector2();
  private view = 13;
  private aspect = 1;
  private zoomed = 1;
  private ray = new THREE.Raycaster();
  private time = 0;
  /** Past the block: the tablets, the grid, and a writing with no Greek beside it (linear.ts). */
  readonly linear: Linear;

  constructor(private texels: () => number) {
    this.scene.background = DARK.clone();
    // a low light from the west, raking along the faces, and very little else
    this.scene.add(new THREE.HemisphereLight('#6d6a86', '#141218', 0.9), this.camera);
    const lamp = new THREE.DirectionalLight('#f0d9b0', 2.2);
    lamp.position.set(-40, 9, 14);
    this.scene.add(lamp);
    this.floor = this.makeFloor();
    this.you = makeFigure({
      coat: toon(new THREE.Color('#5d5873'), { own: true, bare: true }),
      boots: toon(new THREE.Color('#2b2933'), { own: true, bare: true }),
      scarf: toon(new THREE.Color('#c9a46a'), { own: true, bare: true }),
      skin: toon(new THREE.Color('#c6a28a'), { own: true, bare: true }),
    });
    this.scene.add(this.you.root);
    this.makeSlab();
    this.makeObelisk();
    this.makeBlock();
    this.makeSheet();
    this.linear = new Linear(this.scene, (o, x0, y0, front, depth, face, id) => this.body(o, x0, y0, front, depth, face, id), this.pickables);
    this.linear.onChalk = (x) => this.onChalk?.(THREE.MathUtils.clamp((x - this.target.x) / ((this.seen * this.aspect) / 2), -1, 1));
    for (const f of this.faces) f.paint();
    this.resize(innerWidth, innerHeight);
  }

  /** The floor: dark stone, a fleck here and there so you can tell you're moving. */
  private makeFloor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uFloor: { value: FLOOR }, uFleck: { value: FLECK }, uDark: { value: DARK } },
      vertexShader: /* glsl */ `
        varying vec2 vAt;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vAt = w.xz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uFloor;
        uniform vec3 uFleck;
        uniform vec3 uDark;
        varying vec2 vAt;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec2 c = floor(vAt * vec2(5.0, 3.0));
          vec3 col = hash(c) > 0.985 ? uFleck : uFloor;
          // the light that rakes the faces falls on the floor at their feet too, and is gone a few metres out, in steps
          float out_ = vAt.y + (hash(c + 7.0) - 0.5) * 1.6;
          col = mix(col, uDark, out_ < 4.5 ? 0.0 : out_ < 8.0 ? 0.45 : 0.8);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 80).rotateX(-Math.PI / 2), mat);
    mesh.position.set(22, 0, 32);
    mesh.renderOrder = -10;
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * A stone: its body, dark, and its face, the texture, on the front (z = `front`); shaped by
   * `outline` (m, from its bottom left), stood at `x0`.
   */
  private body(outline: [number, number][], x0: number, y0: number, front: number, depth: number, face: Face, id: string) {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), toon(new THREE.Color('#34333d'), { own: true, bare: true }));
    body.position.z = front - depth;
    g.add(body);
    const w = face.w / PX;
    const h = face.h / PX;
    face.tex.repeat.set(1 / w, 1 / h);
    const front_ = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ map: face.tex }));
    front_.position.z = front + 0.01;
    g.add(front_);
    g.position.set(x0, y0, 0);
    g.userData.id = id;
    this.scene.add(g);
    this.pickables.push(g);
  }

  /** Put a name's signs in a row (or a column) on a face, from (x, y) px, each `BIG` to its pixel; returns how far it went. */
  private name(face: Face, which: Which, list: [Glyph, string][], x: number, y: number, upright: boolean, origin: THREE.Vector2) {
    const gap = 4;
    let at = 0;
    const tall = Math.max(...list.map(([g]) => glyphSize(g).h)) * BIG;
    const wide = Math.max(...list.map(([g]) => glyphSize(g).w)) * BIG;
    for (const [g, letter] of list) {
      const { w, h } = glyphSize(g);
      const sw = w * BIG;
      const sh = h * BIG;
      // (along a row, sat on its line or, if low, in its middle; down a column, in its middle)
      const px = upright ? x + Math.floor((wide - sw) / 2) : x + at;
      const py = upright ? y + at : y + (h <= 6 ? Math.floor((tall - sh) / 2) : tall - sh);
      const slot: Slot = {
        which, glyph: g, letter, face, px, py, w: sw, h: sh,
        x: origin.x + (px + sw / 2) / PX,
        y: origin.y + (face.h - (py + sh / 2)) / PX,
        chalk: null,
        // (along a row, all on one line under the ring; down a column, beside each sign, outside the ring)
        lx: upright ? x + wide + 10 : px + Math.floor(sw / 2) - 4,
        ly: upright ? py + Math.floor(sh / 2) - 7 : y + tall + 13,
      };
      face.glyph(g, px, py, BIG, face.slots.length);
      face.slots.push(slot);
      this.slots.push(slot);
      at += (upright ? sh : sw) + gap * BIG;
    }
    return { at: at - gap * BIG, tall, wide };
  }

  /** The slab from Rashid: broken off at the top, hieroglyphs above, demotic in the middle, Greek at the foot. */
  private makeSlab() {
    const W = 22;
    const H = 10;
    const face = new Face(W * PX, H * PX, 11);
    this.faces.push(face);
    const at = (m: number) => Math.round(m * PX);
    const top = (m: number) => Math.round((H - m) * PX);
    // Ptolemy's ring, in the hieroglyphs, high
    const ringX = at(6.4);
    const ringY = top(7.9);
    const sizes = PTOLEMY.map(([g]) => glyphSize(g));
    const span = sizes.reduce((s, z) => s + z.w * BIG, 0) + (PTOLEMY.length - 1) * 4 * BIG;
    const tall = Math.max(...sizes.map((z) => z.h)) * BIG;
    const pad = 12;
    this.name(face, 'ptolemy', PTOLEMY, ringX + pad, ringY + 8, false, new THREE.Vector2(0, 0));
    face.ring(ringX, ringY, span + pad * 2, tall + 16, false);
    face.rows(at(0.3), at(21.7), top(9.9), top(6.15), 20, { x0: ringX - 6, x1: ringX + span + pad * 2 + 8, y0: ringY - 6, y1: ringY + tall + 22 });
    // the demotic, the everyday hand
    face.demotic(at(0.4), at(21.6), top(5.9), top(3.6), 12);
    // the Greek, and under the ring, his name, larger
    for (let k = 0, y = top(3.35); y < top(0.4); y += 11, k++) {
      if (k === 2) {
        face.greek('ΠΤΟΛΕΜΑΙΟΥ ΑΙΩΝΟΒΙΟΥ', ringX, y + 3, 17);
        y += 16;
        continue;
      }
      face.greek(DECREE.slice((k * 37) % 120) + DECREE, at(0.4), y, 9, at(21.2));
    }
    this.body(
      [[0, 0], [W, 0], [W, 7.6], [20.4, 8.5], [17.2, 9.2], [13.5, 9.95], [8.6, 10], [4.2, 9.2], [1.6, 8.1], [0, 7.1]],
      0, 0, 0, 1.4, face, 'slab',
    );
  }

  /** The obelisk from Philae on its base: her ring down its shaft, and her name in Greek on the base. */
  private makeObelisk() {
    const BW = 4.5;
    const BH = 2;
    const base = new Face(BW * PX, BH * PX, 23, 0.7);
    this.faces.push(base);
    base.greek(PETITION.slice(24), 6, 6, 9, base.w - 12);
    base.greek('ΚΛΕΟΠΑΤΡΑΙ', 14, 22, 17);
    base.greek(PETITION.slice(70) + PETITION, 6, 46, 9, base.w - 12);
    this.body([[0, 0], [BW, 0], [BW, BH], [0, BH]], 25.8, 0, 0, 2.4, base, 'obelisk');
    // (the shaft a little wider than true, so her ring has room for its letters beside it)
    const SW = 2.4;
    const SH = 9.6;
    const shaft = new Face(SW * PX, SH * PX, 31, 0.8);
    this.faces.push(shaft);
    const origin = new THREE.Vector2(25.8 + (BW - SW) / 2, BH);
    const sizes = CLEOPATRA.map(([g]) => glyphSize(g));
    const wide = Math.max(...sizes.map((z) => z.w)) * BIG;
    const span = sizes.reduce((s, z) => s + z.h * BIG, 0) + (CLEOPATRA.length - 1) * 4 * BIG;
    const x = Math.round((shaft.w - wide) / 2) - 5;
    // (below the point)
    const y = Math.round(1.15 * PX);
    this.name(shaft, 'cleopatra', CLEOPATRA, x, y + 10, true, origin);
    shaft.ring(x - 8, y, wide + 16, span + 20, true);
    this.body([[0, 0], [SW, 0], [SW - 0.1, 8.6], [SW / 2, 9.6], [0.1, 8.6]], origin.x, BH, -0.4, 1.6, shaft, 'obelisk');
  }

  /** A block of a wall in Luxor: Alexander's ring, at about your eye, and no Greek anywhere. */
  private makeBlock() {
    const W = 11;
    const H = 5.2;
    const face = new Face(W * PX, H * PX, 47, 0.65);
    this.faces.push(face);
    const at = (m: number) => Math.round(m * PX);
    const top = (m: number) => Math.round((H - m) * PX);
    const sizes = ALEXANDER.map(([g]) => glyphSize(g));
    const span = sizes.reduce((s, z) => s + z.w * BIG, 0) + (ALEXANDER.length - 1) * 4 * BIG;
    const tall = Math.max(...sizes.map((z) => z.h)) * BIG;
    const ringX = Math.round((face.w - span) / 2) - 12;
    const ringY = top(3.7);
    this.name(face, 'alexander', ALEXANDER, ringX + 12, ringY + 8, false, new THREE.Vector2(36, 0));
    face.ring(ringX, ringY, span + 24, tall + 16, false);
    face.rows(at(0.3), at(10.7), top(5.0), top(3.95), 20);
    face.rows(at(0.3), at(10.7), top(1.75), top(0.2), 20);
    this.body([[0, 0], [W, 0], [W, 4.5], [10.3, 5.2], [0.6, 5.2], [0, 4.7]], 36, 0, 0, 1.6, face, 'block');
  }

  /** The page you came in through, lying on the floor at the west end, pale in the dark. */
  private makeSheet() {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PAPER }));
    sheet.rotation.y = 0.12;
    sheet.position.set(-3.4, 0.01, 2.6);
    // (and the ring you came in by, in ink on it)
    const ink = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2b47' }));
    ink.scale.set(1.9, 1, 1);
    ink.position.set(-3.4, 0.02, 2.6);
    const g = new THREE.Group();
    g.add(sheet, ink);
    g.userData.id = 'back';
    this.scene.add(g);
    this.pickables.push(g);
  }

  /** Come in through the ring on the page: at the west end, walking east. */
  arrive() {
    this.leaving = false;
    this.clicked = false;
    this.stillFor = 0;
    this.keys.clear();
    this.pan.set(0, 0);
    this.pos.set(-3.2, 0, 2.6);
    this.heading = Math.PI / 2;
    this.speed = PACE * 0.6;
    this.goal = new THREE.Vector3(0.6, 0, 2.4);
    this.frame(0);
  }

  key(code: string, down: boolean) {
    const k = KEYS[code];
    if (!k) return false;
    if (down) this.keys.add(k), (this.goal = null), (this.clicked = false);
    else this.keys.delete(k);
    return true;
  }

  releaseKeys() {
    this.keys.clear();
  }

  pick(ndc: THREE.Vector2): StoneThing | null {
    this.ray.setFromCamera(ndc, this.camera);
    let o: THREE.Object3D | null = this.ray.intersectObjects(this.pickables, true)[0]?.object ?? null;
    while (o && !o.userData.id) o = o.parent;
    return (o?.userData.id as StoneThing | undefined) ?? null;
  }

  /** A click: on a stone, to where its name can be read; on the page, back onto it; anywhere else, there. */
  click(ndc: THREE.Vector2) {
    const at = this.pick(ndc);
    this.clicked = at === 'back';
    if (at === 'back') return void (this.goal = new THREE.Vector3(WAY_BACK - 1, 0, 2.6));
    if (at === 'slab') return void (this.goal = new THREE.Vector3(this.slots[0].x - 0.6, 0, 1.6));
    if (at === 'obelisk') return void (this.goal = new THREE.Vector3(28, 0, 1.4));
    if (at === 'block') return void (this.goal = new THREE.Vector3(this.alexander()[0].x - 0.4, 0, 1.6));
    if (at === 'strips' || at === 'pylos' || at === 'grid' || at === 'tripod') return void (this.goal = new THREE.Vector3(this.linear.goal(at), 0, 1.6));
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) this.goal = p.setY(0);
  }

  zoom(factor: number) {
    this.zoomed = THREE.MathUtils.clamp(this.zoomed * factor, 0.6, 1.3);
  }

  drag(dx: number, dy: number, height: number) {
    const per = this.seen / height;
    this.pan.x = THREE.MathUtils.clamp(this.pan.x - dx * per, -10, 10);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y + dy * per, -3, 4);
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
    // (a little more on a phone, so the obelisk's point is in over the card)
    this.view = this.aspect < 0.8 ? 18 : 17;
  }

  private alexander() {
    return this.slots.filter((s) => s.which === 'alexander');
  }

  /** The last name as far as you can read it: what you've learned of each sign, and a gap for what you haven't. */
  get spelled() {
    return this.alexander()
      .map((s) => (this.read ? s.letter : this.learned.get(s.glyph) ?? '?'))
      .join(' ');
  }

  /** How many of the last name's signs you don't know yet. */
  get unknown() {
    return this.alexander().filter((s) => !this.read && !this.learned.has(s.glyph)).length;
  }

  /** Whether all of a name's signs are chalked in. */
  done(which: Which) {
    return this.slots.filter((s) => s.which === which).every((s) => s.chalk !== null);
  }

  /** Whatever the card's line was asked: past the block, the town or the picture; at the block, its name. */
  guess(said: string) {
    if (this.card === 'kober') return this.linear.guessTown(said);
    if (this.card === 'tablet') return this.linear.guessThing(said);
    return this.alexander_(said);
  }

  /** Your reading of the last name. Alexander, in any of the ways his name goes. */
  private alexander_(name: string) {
    const n = name.toLowerCase().replace(/[^a-zα-ω]/g, '');
    const right = /^(alex|aleks|alek|alks|alis|alix|iskand|sikand|eskand|aλεξ|αλεξ)/.test(n) || n.includes('alexand') || n.includes('aleksand');
    if (!right) {
      this.wrong++;
      return false;
    }
    this.read = true;
    for (const s of this.alexander()) this.chalk(s, s.letter);
    return true;
  }

  private chalk(s: Slot, letter: string) {
    if (s.chalk !== null) return;
    s.chalk = letter;
    s.face.dirty = true;
    this.onChalk?.(THREE.MathUtils.clamp((s.x - this.target.x) / ((this.seen * this.aspect) / 2), -1, 1));
  }

  /** The signs you're stood under, read: the Greek's sound for the bilingual ones, what you've learned for the last. */
  private read_(dt: number) {
    const x = this.pos.x;
    const close = this.pos.z < 3.4;
    for (const s of this.slots) {
      if (s.chalk !== null || !close) continue;
      const under = Math.abs(x - s.x) < s.w / PX / 2 + 0.2;
      if (s.which === 'ptolemy' && under) {
        this.chalk(s, s.letter);
        this.learned.set(s.glyph, s.letter);
      } else if (s.which === 'alexander' && under && this.learned.has(s.glyph)) {
        this.chalk(s, this.learned.get(s.glyph)!);
      }
    }
    // (the obelisk's, top to bottom, one after another while you stand at its foot)
    if (close && x > 25.9 && x < 30.1) {
      this.chalkClock += dt;
      const next = this.slots.find((s) => s.which === 'cleopatra' && s.chalk === null);
      if (next && this.chalkClock > CHALK_EVERY) {
        this.chalkClock = 0;
        this.chalk(next, next.letter);
        if (next.letter) this.learned.set(next.glyph, next.letter);
      }
    } else this.chalkClock = CHALK_EVERY * 0.6;
  }

  update(dt: number) {
    this.time += dt;
    this.walk(dt);
    this.read_(dt);
    this.linear.update(dt, this.pos.x, this.pos.z);
    for (const f of this.faces) if (f.dirty) f.paint();
    this.animate();
    const x = this.pos.x;
    const near = this.pos.z < 4.2;
    const past = this.linear.card(x, near);
    this.card =
      x < SHEET || this.clicked ? 'back'
      : past ? past
      : near && x > 35 && x < 48 ? (this.read ? 'read' : 'alexander')
      : near && x > 24.6 && x < 31.4 ? 'cleopatra'
      : near && x > 5.6 && x < 14.6 ? 'ptolemy'
      : x < 4 || this.stillFor > STILL ? 'stone'
      : null;
    if (this.clicked && !this.goal) this.clicked = false;
    if (x < WAY_BACK) this.leaving = true;
    this.frame(dt);
  }

  private walk(dt: number) {
    const move = new THREE.Vector2();
    if (this.keys.has('up')) move.y -= 1;
    if (this.keys.has('down')) move.y += 1;
    if (this.keys.has('left')) move.x -= 1;
    if (this.keys.has('right')) move.x += 1;
    let want = 0;
    if (move.lengthSq()) {
      move.normalize();
      want = PACE;
    } else if (this.goal) {
      const dx = this.goal.x - this.pos.x;
      const dz = this.goal.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d <= 0.08) this.goal = null;
      else (move.set(dx / d, dz / d), (want = PACE * Math.min(1, d / 0.4 + 0.3)));
    }
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * 8));
    if (this.speed < 0.02 && !want) {
      this.speed = 0;
      this.stillFor += dt;
      return;
    }
    this.stillFor = 0;
    if (move.lengthSq()) {
      let turn = Math.atan2(move.x, move.y) - this.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      this.heading += turn * (1 - Math.exp(-dt * 10));
    }
    const step = this.speed * dt;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x + Math.sin(this.heading) * step, WEST - 1, EAST);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z + Math.cos(this.heading) * step, NEAR, FAR_OUT);
    if (this.goal && (this.goal.x > EAST || this.goal.z < NEAR || this.goal.z > FAR_OUT)) this.goal.set(THREE.MathUtils.clamp(this.goal.x, WEST - 1, EAST), 0, THREE.MathUtils.clamp(this.goal.z, NEAR, FAR_OUT));
    if (this.pan.lengthSq()) this.pan.multiplyScalar(Math.exp(-dt * 1.5));
    this.stride += step;
    if (this.stride - this.lastStep >= STEP) {
      this.lastStep = Math.floor(this.stride / STEP) * STEP;
      this.onStep?.();
    }
  }

  private animate() {
    const w = this.you;
    w.root.position.copy(this.pos);
    w.root.rotation.set(0, this.heading, 0);
    walk(w, this.stride / STEP, Math.min(1, this.speed / PACE));
    // (no wind in here)
    w.scarfTail.rotation.x = 0.15 + this.speed * 0.15;
  }

  /** The view's height (m), zoom and all. */
  private get seen() {
    return this.view * this.zoomed;
  }

  private frame(dt: number) {
    const view = this.seen;
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    // (the floor along the bottom, deep enough that you're above the card, and the stones' tops in; zoomed in, it's their names you're looking at)
    const floor = this.aspect < 0.8 ? 0.34 : 0.3;
    const up = h - floor * view;
    const want = new THREE.Vector3(this.pos.x + this.pan.x, (this.zoomed < 1 ? THREE.MathUtils.lerp(up, 5.6, (1 - this.zoomed) / 0.4) : up) + this.pan.y, 0);
    if (dt) this.target.lerp(want, 1 - Math.exp(-dt * 2.2));
    else this.target.copy(want);
    cam.position.set(this.target.x, this.target.y + Math.sin(ELEVATION) * DISTANCE, this.target.z + Math.cos(ELEVATION) * DISTANCE);
    cam.lookAt(this.target);
    cam.updateMatrixWorld();
    // snap to the texel grid, and hand the remainder to the renderer
    const texel = view / this.texels();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const upv = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const r = cam.position.dot(right) / texel;
    const u = cam.position.dot(upv) / texel;
    const dr = Math.round(r) - r;
    const du = Math.round(u) - u;
    cam.position.addScaledVector(right, dr * texel).addScaledVector(upv, du * texel);
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    this.subTexel.set(-dr, -du);
    this.floor.position.x = this.target.x;
  }
}
