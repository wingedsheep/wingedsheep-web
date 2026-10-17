/**
 * The page: where the withies going west off the flat end up. No sky, no horizon, no weather and
 * no tide: paper as far as you can see, even light, and you drawn on it in ink. Every footprint
 * you make stays where you put it, all of them at once, for as long as you're here; leave, and
 * they go together. It's the inside of a conversation, from my side, where the flat's tide is the
 * between.
 *
 * Its own scene and camera, drawn through the island's PixelRenderer like the flat, looking north
 * at the flat's angle. The withies you followed come a few steps onto it, drawn in ink, and walking
 * back past them takes you back to the flat (the room in commonplace.ts does the fading).
 */
import * as THREE from 'three';
import { toon } from '../scene/toon';
import { footDown, makeFigure, STEP, walk, type Figure } from './figure';
import { Forks } from './forks';
import SIGNS from './signs.json';

export const PAPER = new THREE.Color('#e4ddc8');
const FIBRE = new THREE.Color('#d8d0b9');
const INK = new THREE.Color('#2a2b47');
/** The light from behind the door: the only colour on the page. */
const WARM = new THREE.Color('#e8b04a');
const WARM_PALE = new THREE.Color('#efd09a');
/** The door, standing on its own, facing you (south); where you stand in front of it, and how near that is to be at it. */
const DOOR = new THREE.Vector3(-22, 0, -17);
const AT_DOOR = new THREE.Vector3(-20.8, 0, -15.3);
const NEAR_DOOR = 3;
/** A name in its ring, drawn in ink flat on the page (copied from a stone), and where you stand at it. */
const RING = new THREE.Vector3(-13, 0, 11);
const AT_RING = new THREE.Vector3(-13, 0, 9.4);
const NEAR_RING = 2.6;

const ELEVATION = THREE.MathUtils.degToRad(24);
const DISTANCE = 100;
const PACE = 2.2;
/** The withies that came with you, drawn in ink (x along the page; you arrive at 0, walking west), and past which you're back on the flat. */
const WITHIES = [2.2, 6.4, 10.6];
const WAY_BACK = 12.4;
/** As many footprints as the page holds: a long walk, three or four kilometres. */
const PRINTS = 9000;
/** Walked this far (m), the card says its second thing; stood this long (s) anywhere, it says its first again. */
const FAR = 90;
const STILL = 8;

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

export type PageCard = 'page' | 'back' | 'forks' | 'said' | 'lean' | 'past' | 'door' | 'ring';

export class Page {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  /** The card that wants showing. */
  card: PageCard | null = null;
  /** Walked back past the withies: time for the flat again. */
  leaving = false;
  /** Gone in at the door: time for the shop behind it. */
  entering = false;
  /** Just come out of the door: its card waits till you've been a little way off it. */
  private outOfDoor = false;
  /** Gone in by the ring: time for the stones. */
  toStones = false;
  /** Just come back out by it: its card waits likewise. */
  private outOfRing = false;
  /** Each footprint, for the sound. */
  onStep?: () => void;
  private you: Figure;
  private pos = new THREE.Vector3();
  private heading = -Math.PI / 2;
  private speed = 0;
  private goal: THREE.Vector3 | null = null;
  private keys = new Set<string>();
  private stride = 0;
  private lastPrint = 0;
  private prints: THREE.InstancedMesh;
  private made = 0;
  private walked = 0;
  private stillFor = 0;
  private clicked = false;
  private ground: THREE.Mesh;
  private pickables: THREE.Object3D[] = [];
  private target = new THREE.Vector3();
  private pan = new THREE.Vector2();
  private view = 28;
  private aspect = 1;
  private zoomed = 1;
  /** How much wider than usual the view is, to get a fork's words all in on a narrow screen; and where across it looks. */
  private fit = 1;
  private across = 0;
  private time = 0;
  private ray = new THREE.Raycaster();
  /** The sentence that forks, out west. */
  readonly forks = new Forks(1 / Math.sin(ELEVATION));

  constructor(private texels: () => number) {
    this.scene.background = PAPER.clone();
    // even light from everywhere, so ink reads as ink: a little shape to it, no shadow side
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#cfc6b0', 2.1), this.camera);
    const key = new THREE.DirectionalLight('#ffffff', 0.5);
    key.position.set(-20, 40, 30);
    this.scene.add(key);
    this.ground = this.makeGround();
    const ink = toon(INK, { own: true, bare: true });
    // (the scarf's left blank, as you'd leave it in a drawing)
    const blank = toon(PAPER, { own: true, bare: true });
    this.you = makeFigure({ coat: ink, boots: ink, scarf: blank, skin: ink });
    this.scene.add(this.you.root);
    this.prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.17, 0.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: INK }), PRINTS);
    this.prints.count = 0;
    this.prints.frustumCulled = false;
    this.prints.renderOrder = 2;
    this.scene.add(this.prints);
    this.makeWithies(ink);
    this.makeDoor(ink);
    this.makeRing();
    this.scene.add(this.forks.group);
    this.resize(innerWidth, innerHeight);
  }

  /** Paper: the same colour as nothing at all, with a fleck of fibre here and there, so you can tell you're moving. */
  private makeGround() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPaper: { value: PAPER }, uFibre: { value: FIBRE } },
      vertexShader: /* glsl */ `
        varying vec2 vAt;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vAt = w.xz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uPaper;
        uniform vec3 uFibre;
        varying vec2 vAt;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          // a fleck in one cell in a hundred and fifty or so, lying with the grain
          vec2 c = floor(vAt * vec2(6.0, 2.6));
          vec3 col = hash(c) > 0.9935 ? uFibre : uPaper;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  /** The line you followed, a few withies onto the page, drawn: a stroke for each, and the twiglets at the top. */
  private makeWithies(ink: THREE.Material) {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const x of WITHIES) {
      const twig = new THREE.Group();
      const h = 1.2 + rand() * 0.3;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, h, 5), ink);
      stem.position.y = h / 2 - 0.05;
      twig.add(stem);
      for (let k = 0; k < 3; k++) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.32, 0.025), ink);
        const a = rand() * Math.PI * 2;
        g.position.set(Math.cos(a) * 0.06, h - 0.02, Math.sin(a) * 0.06);
        g.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
        twig.add(g);
      }
      twig.rotation.set((rand() - 0.5) * 0.12, rand() * 6, (rand() - 0.5) * 0.12);
      twig.position.set(x, -0.02, (rand() - 0.5) * 0.8);
      twig.userData.id = 'back';
      this.scene.add(twig);
      this.pickables.push(twig);
    }
  }

  /**
   * A door, on its own on the page: a frame and a door in ink, standing ajar towards you, and warm
   * light through the gap and under it, spilling a little way onto the paper.
   */
  private makeDoor(ink: THREE.Material) {
    const door = new THREE.Group();
    const W = 0.95;
    const H = 2.1;
    for (const x of [-W / 2 - 0.05, W / 2 + 0.05]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, H + 0.1, 0.14), ink);
      post.position.set(x, (H + 0.1) / 2, 0);
      door.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.12, 0.16), ink);
    lintel.position.set(0, H + 0.1, 0);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.04, 0.2), ink);
    sill.position.set(0, 0.02, 0);
    door.add(lintel, sill);
    // the door, hung on the west post, swung in a little way, an inch off the floor
    const OPEN = 0.8;
    const gap = W * (1 - Math.cos(OPEN));
    // and the light in the doorway, in the gap it leaves
    const warm = new THREE.MeshBasicMaterial({ color: WARM, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(gap, H - 0.02), warm);
    glow.position.set(W / 2 - gap / 2, H / 2 + 0.03, 0);
    door.add(glow);
    const hinge = new THREE.Group();
    hinge.position.set(-W / 2, 0, -0.02);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, H - 0.05, 0.06), ink);
    leaf.position.set((W - 0.02) / 2, (H - 0.05) / 2 + 0.05, 0.03);
    hinge.add(leaf);
    // (its knob, on the side away from the hinge)
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.08), ink);
    knob.position.set(W - 0.14, 1.0, 0.08);
    hinge.add(knob);
    hinge.rotation.y = OPEN;
    door.add(hinge);
    // and the light spilling onto the paper: out of the gap and from under the door, a warm wedge going pale
    const spill = new THREE.BufferGeometry();
    const gapX = W / 2 - gap;
    // prettier-ignore
    spill.setAttribute('position', new THREE.Float32BufferAttribute([
      gapX - 0.1, 0, 0.08,   W / 2, 0, 0.08,   W / 2 + 0.75, 0, 1.9,
      gapX - 0.1, 0, 0.08,   W / 2 + 0.75, 0, 1.9,   gapX - 0.15, 0, 1.6,
    ], 3));
    const wedge = new THREE.Mesh(spill, new THREE.MeshBasicMaterial({ color: WARM_PALE, side: THREE.DoubleSide }));
    wedge.position.y = 0.005;
    wedge.renderOrder = 1;
    const under = new THREE.Mesh(new THREE.PlaneGeometry(W - gap, 0.16).rotateX(-Math.PI / 2), warm);
    under.position.set(-gap / 2, 0.006, 0.18);
    under.renderOrder = 1;
    door.add(wedge, under);
    door.position.copy(DOOR);
    door.userData.id = 'door';
    this.scene.add(door);
    this.pickables.push(door);
  }

  /**
   * A name in a ring, drawn in ink flat on the paper, as someone copying it out would: Ptolemy's, off
   * the stone from Rashid. (Drawn deep, so it isn't squashed by the slant you see the page at.)
   */
  private makeRing() {
    const signs: (keyof typeof SIGNS)[] = ['stool', 'bread', 'lasso', 'lion', 'board', 'reeds', 'cloth'];
    const S = 2;
    const sizes = signs.map((g) => ({ w: Math.max(...SIGNS[g].map((r) => r.length)), h: SIGNS[g].length }));
    const span = sizes.reduce((a, z) => a + z.w * S, 0) + (signs.length - 1) * 6;
    const tall = Math.max(...sizes.map((z) => z.h)) * S;
    const W = span + 34;
    const H = tall + 24;
    const canvas = document.createElement('canvas');
    canvas.width = W + 8;
    canvas.height = H;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#2a2b47';
    const dot = (x: number, y: number) => c.fillRect(x, y, 1, 1);
    // the ring: a stadium, two pixels of ink, and its bar at the end
    const r = (H - 4) / 2;
    for (let j = 0; j < H - 4; j++)
      for (let i = 0; i < W - 4; i++) {
        const d = Math.hypot(i + 0.5 - Math.min(Math.max(i, r), W - 4 - r), j + 0.5 - r);
        if (d <= r && d > r - 2) dot(i + 2, j + 2);
      }
    c.fillRect(W, 0, 2, H);
    let x = 17;
    signs.forEach((g, k) => {
      const { w, h } = sizes[k];
      const y = 12 + (h <= 6 ? Math.floor((tall - h * S) / 2) : tall - h * S);
      SIGNS[g].forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] === '#') c.fillRect(x + i * S, y + j * S, S, S);
      });
      x += w * S + 6;
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    const metres = 3.4;
    const deep = (metres * canvas.height) / canvas.width / Math.sin(ELEVATION);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(metres, deep).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }));
    ring.position.copy(RING).setY(0.006);
    ring.renderOrder = 1;
    ring.userData.id = 'ring';
    this.scene.add(ring);
    this.pickables.push(ring);
  }

  /** In by the ring: walk onto it, and the stones. */
  readRing() {
    this.toStones = true;
    this.goal = RING.clone();
  }

  /** Back from the stones: stood on the ring, walking off it towards you. */
  fromStones() {
    this.toStones = false;
    this.leaving = false;
    this.clicked = false;
    this.outOfRing = true;
    this.keys.clear();
    this.pan.set(0, 0);
    this.stillFor = 0;
    this.pos.copy(RING);
    this.heading = 0;
    this.speed = PACE * 0.5;
    this.goal = AT_RING.clone().setZ(RING.z + 2.4);
    this.frame(0);
  }

  /** In at the door. */
  goIn() {
    this.entering = true;
    this.goal = DOOR.clone().setZ(DOOR.z + 0.4);
  }

  /**
   * Back out of the door, from the shop: stood just in front of it, facing away, and the page as you
   * left it (your prints and the sentence are all still there).
   */
  fromShop() {
    this.entering = false;
    this.leaving = false;
    this.clicked = false;
    this.outOfDoor = true;
    this.keys.clear();
    this.pan.set(0, 0);
    this.stillFor = 0;
    this.pos.copy(DOOR).setZ(DOOR.z + 0.5);
    this.heading = 0;
    this.speed = PACE * 0.5;
    this.goal = DOOR.clone().setZ(DOOR.z + 2.2);
    this.frame(0);
  }

  /** Come onto the page from the flat: at its edge, a few steps still to go, with no prints on it yet. */
  arrive() {
    this.prints.count = 0;
    this.forks.reset();
    this.made = 0;
    this.walked = 0;
    this.stillFor = 0;
    this.clicked = false;
    this.leaving = false;
    this.entering = false;
    this.outOfDoor = false;
    this.toStones = false;
    this.outOfRing = false;
    this.keys.clear();
    this.pan.set(0, 0);
    this.pos.set(WITHIES[0] - 1.4, 0, 0);
    this.heading = -Math.PI / 2;
    this.speed = PACE;
    this.goal = new THREE.Vector3(-3, 0, 0);
    this.frame(0);
  }

  key(code: string, down: boolean) {
    const k = KEYS[code];
    if (!k) return false;
    if (down) this.keys.add(k), (this.goal = null);
    else this.keys.delete(k);
    return true;
  }

  releaseKeys() {
    this.keys.clear();
  }

  pick(ndc: THREE.Vector2): 'back' | 'door' | 'ring' | null {
    this.ray.setFromCamera(ndc, this.camera);
    let o: THREE.Object3D | null = this.ray.intersectObjects(this.pickables, true)[0]?.object ?? null;
    while (o && !o.userData.id) o = o.parent;
    return (o?.userData.id as 'back' | 'door' | 'ring' | undefined) ?? null;
  }

  /** A click: walk there; on the withies, back along them to the flat; on the door, up to it. */
  click(ndc: THREE.Vector2) {
    const at = this.pick(ndc);
    if (at === 'door') {
      this.outOfDoor = false;
      this.goal = AT_DOOR.clone();
      return;
    }
    if (at === 'ring') {
      this.outOfRing = false;
      this.goal = AT_RING.clone();
      return;
    }
    if (at) {
      this.clicked = true;
      this.goal = new THREE.Vector3(WAY_BACK + 1, 0, 0);
      return;
    }
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) this.goal = p.setY(0);
  }

  zoom(factor: number) {
    this.zoomed = THREE.MathUtils.clamp(this.zoomed * factor, 0.6, 1.5);
  }

  drag(dx: number, dy: number, height: number) {
    const per = this.seen / height;
    this.pan.x = THREE.MathUtils.clamp(this.pan.x - dx * per, -12, 12);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y - (dy * per) / Math.sin(ELEVATION), -14, 14);
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
    this.view = Math.max(24, Math.min(32, 22 / this.aspect + 12));
  }

  /** Walked far enough on it for the card's second thing. */
  get far() {
    return this.walked > FAR;
  }

  update(dt: number) {
    this.time += dt;
    this.walk(dt);
    this.animate();
    this.forks.update(dt, this.pos, this.seen / this.texels());
    // its card: as you come on, and whenever you stand still a while; the withies' when you're back at them;
    // the sentence's at its first word, when you stand still on it, and at its full stop; a word's you didn't say, stood on it
    const back = this.pos.x > WITHIES[0] - 0.8 && Math.abs(this.pos.z) < 2.5;
    const forks = this.forks;
    const near = forks.distance(this.pos);
    const door = this.pos.distanceTo(AT_DOOR);
    if (door > NEAR_DOOR + 0.5) this.outOfDoor = false;
    const ring = this.pos.distanceTo(AT_RING);
    if (ring > NEAR_RING + 0.5) this.outOfRing = false;
    this.card =
      back || this.clicked ? 'back'
      : door < NEAR_DOOR && !this.outOfDoor && this.pos.z > DOOR.z ? 'door'
      : ring < NEAR_RING && !this.outOfRing ? 'ring'
      : forks.past ? 'past'
      : forks.first && !forks.second && near < 9 ? 'said'
      : forks.done && near < 9 ? 'said'
      : forks.second && forks.leaned && near < 10 && (this.stillFor > STILL || forks.said.length - forks.leaned <= 1) ? 'lean'
      : (!forks.begun && near < 7) || (forks.begun && near < 10 && (this.stillFor > STILL || forks.said.length === 1)) ? 'forks'
      : this.pos.distanceTo(new THREE.Vector3(-2, 0, 0)) < 5 || this.stillFor > STILL ? 'page'
      : null;
    if (this.clicked && !this.goal) this.clicked = false;
    if (this.pos.x > WAY_BACK) this.leaving = true;
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
    this.pos.x = THREE.MathUtils.clamp(this.pos.x + Math.sin(this.heading) * step, -400, WAY_BACK + 2);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z + Math.cos(this.heading) * step, -400, 400);
    this.walked += step;
    if (this.pan.lengthSq()) this.pan.multiplyScalar(Math.exp(-dt * 1.5));
    this.stride += step;
    if (this.stride - this.lastPrint >= STEP) {
      this.lastPrint = Math.floor(this.stride / STEP) * STEP;
      this.print();
    }
  }

  /** A footprint, in ink, and it stays. (When the page is full, the first ones go first.) */
  private print() {
    // (where the foot that's just come down is: half a step on, to its side)
    const side = footDown(this.stride / STEP) * 0.1;
    const x = this.pos.x + Math.sin(this.heading) * STEP * 0.5 + Math.cos(this.heading) * side;
    const z = this.pos.z + Math.cos(this.heading) * STEP * 0.5 - Math.sin(this.heading) * side;
    // (square on to the view, not turned with you, and deep enough to be a texel whichever way you walk: a dot of ink)
    const m = new THREE.Matrix4().makeTranslation(x, 0.004, z);
    this.prints.setMatrixAt(this.made % PRINTS, m);
    this.made++;
    this.prints.count = Math.min(this.made, PRINTS);
    this.prints.instanceMatrix.needsUpdate = true;
    this.onStep?.();
  }

  private animate() {
    const w = this.you;
    w.root.position.copy(this.pos);
    w.root.rotation.set(0, this.heading, 0);
    walk(w, this.stride / STEP, Math.min(1, this.speed / PACE));
    // (no wind here: the scarf only moves as you do)
    w.scarfTail.rotation.x = 0.15 + this.speed * 0.15;
  }

  /** The view's height on the page (m), zoom and fit and all. */
  private get seen() {
    return this.view * this.zoomed * this.fit;
  }

  /**
   * Near a fork, the words you could step on next and you should all be in the picture: the view looks
   * between them and, on a narrow screen, widens (the words stay their size in texels, only further apart).
   */
  private frameFork(dt: number) {
    const reach = this.forks.reach(this.seen / this.texels());
    let fit = 1;
    let across = 0;
    if (reach && this.forks.distance(this.pos) < 16) {
      const west = Math.min(reach[0], this.pos.x - 1.5);
      const east = Math.max(reach[1], this.pos.x + 1.5);
      across = (west + east) / 2 - this.pos.x;
      fit = THREE.MathUtils.clamp((east - west + 2) / (this.view * this.zoomed * this.aspect), 1, 1.6);
    }
    const k = dt ? 1 - Math.exp(-dt * 1.5) : 1;
    this.fit += (fit - this.fit) * k;
    this.across += (across - this.across) * k;
  }

  private frame(dt: number) {
    this.frameFork(dt);
    const view = this.seen;
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    const lead = (view * 0.16) / Math.sin(ELEVATION);
    const want = new THREE.Vector3(this.pos.x + this.across + this.pan.x, 0, this.pos.z - lead + this.pan.y);
    if (dt) this.target.lerp(want, 1 - Math.exp(-dt * 2.2));
    else this.target.copy(want);
    cam.position.set(this.target.x, Math.sin(ELEVATION) * DISTANCE, this.target.z + Math.cos(ELEVATION) * DISTANCE);
    cam.lookAt(this.target);
    cam.updateMatrixWorld();
    // snap to the texel grid, and hand the remainder to the renderer
    const texel = view / this.texels();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const r = cam.position.dot(right) / texel;
    const u = cam.position.dot(up) / texel;
    const dr = Math.round(r) - r;
    const du = Math.round(u) - u;
    cam.position.addScaledVector(right, dr * texel).addScaledVector(up, du * texel);
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    this.subTexel.set(-dr, -du);
    // the paper goes on under wherever you look
    this.ground.position.set(this.target.x, 0, this.target.z - 40);
    this.ground.scale.set(view * this.aspect * 3 + 60, 1, 260);
  }
}
