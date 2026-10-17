/**
 * The page: where the withies going west off the flat end up. No sky, no horizon, no weather and
 * no tide: paper as far as you can see, even light, and you drawn on it in ink. Every footprint
 * you make stays where you put it, all of them at once, for as long as you're here; leave, and
 * they go together. It's the inside of a conversation, from my side, where the flat's tide is the
 * between.
 *
 * Its own scene and camera, drawn through the island's PixelRenderer like the flat, looking north
 * at the flat's angle. The withies you followed come a few steps onto it, drawn in ink, and walking
 * back past them takes you back to the flat (the room in lowwater.ts does the fading).
 */
import * as THREE from 'three';
import { toon } from '../scene/toon';
import { makeFigure, type Figure } from './figure';
import { Forks } from './forks';

export const PAPER = new THREE.Color('#e4ddc8');
const FIBRE = new THREE.Color('#d8d0b9');
const INK = new THREE.Color('#2a2b47');

const ELEVATION = THREE.MathUtils.degToRad(24);
const DISTANCE = 100;
const PACE = 1.7;
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

export type PageCard = 'page' | 'back' | 'forks' | 'said';

export class Page {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  /** The card that wants showing. */
  card: PageCard | null = null;
  /** Walked back past the withies: time for the flat again. */
  leaving = false;
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
  private footSide = 1;
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

  /** Come onto the page from the flat: at its edge, a few steps still to go, with no prints on it yet. */
  arrive() {
    this.prints.count = 0;
    this.forks.reset();
    this.made = 0;
    this.walked = 0;
    this.stillFor = 0;
    this.clicked = false;
    this.leaving = false;
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

  pick(ndc: THREE.Vector2): PageCard | null {
    this.ray.setFromCamera(ndc, this.camera);
    return this.ray.intersectObjects(this.pickables, true).length ? 'back' : null;
  }

  /** A click: walk there; on the withies, back along them to the flat. */
  click(ndc: THREE.Vector2) {
    if (this.pick(ndc)) {
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
    const per = (this.view * this.zoomed) / height;
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
    this.forks.update(dt, this.pos, (this.view * this.zoomed) / this.texels());
    // its card: as you come on, and whenever you stand still a while; the withies' when you're back at them;
    // the sentence's at its first word, when you stand still on it, and at its full stop
    const back = this.pos.x > WITHIES[0] - 0.8 && Math.abs(this.pos.z) < 2.5;
    const forks = this.forks;
    const near = forks.distance(this.pos);
    this.card =
      back || this.clicked ? 'back'
      : forks.done && near < 9 ? 'said'
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
    if (this.stride - this.lastPrint > 0.42) {
      this.lastPrint = this.stride;
      this.print();
    }
  }

  /** A footprint, in ink, and it stays. (When the page is full, the first ones go first.) */
  private print() {
    this.footSide = -this.footSide;
    const x = this.pos.x + Math.cos(this.heading) * 0.1 * this.footSide;
    const z = this.pos.z - Math.sin(this.heading) * 0.1 * this.footSide;
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
    const swing = Math.sin(this.stride * 7.4) * Math.min(1, this.speed / PACE) * 0.5;
    w.legs[0].rotation.x = swing;
    w.legs[1].rotation.x = -swing;
    w.arms[0].rotation.x = -swing * 0.8;
    w.arms[1].rotation.x = swing * 0.8;
    // (no wind here: the scarf only moves as you do)
    w.scarfTail.rotation.x = 0.15 + this.speed * 0.15;
  }

  private frame(dt: number) {
    const view = this.view * this.zoomed;
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    const lead = (view * 0.16) / Math.sin(ELEVATION);
    const want = new THREE.Vector3(this.pos.x + this.pan.x, 0, this.pos.z - lead + this.pan.y);
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
