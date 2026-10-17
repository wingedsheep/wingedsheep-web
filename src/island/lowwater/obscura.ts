/**
 * Inside the hide (hide.ts): a camera obscura. The room's dark but for one hole in its north wall,
 * and the light that comes through it lays the flat on the whitewashed back wall: upside down, in
 * its own colours, moving, as it is out there right now (the flat's picture is drawn into
 * `target` each frame, from the hide). It lands on whatever's in the way, too: the curtain over
 * the door, and you; where you stand between the hole and the wall, your shadow's in the picture.
 *
 * You come in from the bright, so at first it's black, and the picture comes up as your eyes get
 * used to it: the brightest things first (her flash, the warm band), the rest over half a minute.
 * Its own scene and camera, drawn through the island's PixelRenderer, as the page is.
 *
 * Behind you, over the hole, a slide: a strip of wood with four holes in it, a thumb's width down to
 * a needle's prick, pushed along to the next. A wider hole lets in more light and blurs the picture;
 * a smaller one sharpens it and dims it, until (smaller than a pin's head, for a room this deep) the
 * light spreads out from the hole's own edges and it goes soft again. Your eyes take the change a
 * moment late, and never all the way.
 *
 * Stay a long while and your eyes go over to their night cells, the rods: the picture loses its colour
 * (reds first, blues last), its faint things come up, and right where you look (the pointer on the wall,
 * or where you last touched it) there are no rods at all, so the faint things go out there and come back just to one side.
 * A real eye takes half an hour over this, the change coming at about seven minutes; here it's two.
 */
import * as THREE from 'three';
import { makeFigure, type Figure } from './figure';

const ELEVATION = THREE.MathUtils.degToRad(15);
const DISTANCE = 30;
const PACE = 1.1;
/** The room (m): the back wall at z = 0, the hole's wall at DEPTH; WIDE across, TALL to the ceiling. */
const WIDE = 4.6;
const DEPTH = 3.4;
const TALL = 2.4;
/** The hole, at about eye height in the middle of the north wall. */
const HOLE = new THREE.Vector3(0, 1.35, DEPTH);
/** The picture's shape (the flat's, drawn as wide as the back wall). */
export const PICTURE_ASPECT = 1.6;
const TAN = new THREE.Vector2(WIDE / 2 / DEPTH, WIDE / 2 / DEPTH / PICTURE_ASPECT);
/** The curtain over the door, at the west end of the back wall (on your right as you face it). */
const CURTAIN = { x0: 1.4, x1: 2.25 };
/** Where you come in, and where you go out. */
const IN = new THREE.Vector3(1.8, 0, 0.75);
const STEP_IN = new THREE.Vector3(1.0, 0, 1.3);
/** How long your eyes take (s): most of the way in this, the rest a while longer. */
const ADAPT = 7;
/** Stood still this long once you can see, its card. */
const STILL = 3;
/**
 * The slide's four holes: how much light each lets in (ln of its area, against the pea's) and how
 * soft its picture is (texels; a real pea's blur is under a texel on this wall, so it's drawn larger).
 * A thumb's 20 mm, a pea's 7, a pin's head 2.2 (about the best for 3.4 m: 1.9 √(λ d)), a needle's 0.6.
 */
export const HOLES = [
  { light: Math.log((20 / 7) ** 2), blur: 3.5, edge: 0.07 },
  { light: 0, blur: 1, edge: 0.02 },
  { light: Math.log((2.2 / 7) ** 2), blur: 0.3, edge: 0 },
  { light: Math.log((0.6 / 7) ** 2), blur: 2, edge: 0 },
] as const;
/** How far your eyes make up for a change of light (the rest you see). */
const MAKE_UP = 0.75;
/** The strip's push from one hole to the next (s), the hole covered for the middle of it. */
const PUSH = 0.6;
/** Stand this close to the hole's wall, and the slide's yours. */
const AT_HOLE = DEPTH - 0.85;
/** Where you work it from: beside the hole, by the strip's end, out of the light's way (in front of the hole you're in all of it). */
const BY_HOLE = new THREE.Vector3(0.75, 0, DEPTH - 0.45);
/** In the dark this long (s), your night eyes start to come; this much longer, and they're as good as they get. */
const NIGHT_FROM = 75;
const NIGHT_TAKES = 45;
/** Where you look, your eye has no rods: how wide that is, as an angle (cos, at its edge and its middle; a real one's under 2°, drawn wider). */
const FOVEA = [Math.cos(THREE.MathUtils.degToRad(7)), Math.cos(THREE.MathUtils.degToRad(2.5))];
/** Your eyes, stood. */
const EYE = 1.6;

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

export type ObscuraCard = 'obscura' | 'slide' | 'night';

/** The light in the room: every surface lit by the picture through the hole, and nothing else. */
function projected(shared: Record<string, THREE.IUniform>, albedo: string, opts: { planks?: boolean; you?: boolean } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uAlbedo: { value: new THREE.Color(albedo) } },
    defines: { PLANKS: opts.planks ? 1 : 0, SHADOWED: opts.you ? 0 : 1 },
    vertexShader: /* glsl */ `
      varying vec3 vAt;
      varying vec3 vNormal;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vAt = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPicture;
      uniform vec3 uHole;
      uniform vec2 uTan;
      uniform vec2 uTexel;
      uniform float uSeen;
      uniform vec3 uYou;
      uniform vec3 uAlbedo;
      uniform float uBounce;
      uniform float uBlur;
      uniform float uGain;
      uniform float uEdge;
      uniform float uNight;
      uniform vec3 uGaze;
      uniform float uLooking;
      varying vec3 vAt;
      varying vec3 vNormal;
      void main() {
        vec3 albedo = uAlbedo;
        #if PLANKS
          // floorboards, running out from the back wall, a seam every 18 cm and the ends staggered
          float board = floor(vAt.x / 0.18);
          if (fract(vAt.x / 0.18) < 0.07 || fract(vAt.z / 1.7 + fract(board * 0.37)) < 0.012) albedo *= 0.55;
          else albedo *= 0.9 + 0.1 * fract(sin(board * 12.9898) * 43758.5);
        #endif
        vec3 d = vAt - uHole;
        vec3 light = vec3(0.0);
        if (d.z < -0.05) {
          // what's out there in the direction this point looks back through the hole: up is down, and
          // (facing the wall, with the flat behind you) east is still on the right
          vec2 uv = vec2(0.5 + 0.5 * (d.x / -d.z) / uTan.x, 0.5 + 0.5 * (d.y / d.z) / uTan.y);
          vec2 edge = min(uv, 1.0 - uv);
          if (min(edge.x, edge.y) > 0.0) {
            // a pinhole's picture is soft: every point is a little disc of the flat, as wide as the hole
            // lets it be (the slide's), so a wide hole smears its neighbours in and a pin's head hardly
            vec3 c = textureLod(uPicture, uv, 0.0).rgb;
            for (int i = 0; i < 12; i++) {
              float r = uBlur * sqrt((float(i) + 0.5) / 12.0);
              float a = float(i) * 2.39996;
              c += textureLod(uPicture, uv + vec2(cos(a), sin(a)) * r * uTexel, 0.0).rgb;
            }
            c /= 13.0;
            vec3 to = normalize(-d);
            float facing = max(0.0, dot(normalize(vNormal), to));
            // dimmer off to the sides and the corners (as every pinhole's picture is), and with distance
            float off = to.z;
            float fall = off * off * off * off * min(1.6, ${(DEPTH * DEPTH).toFixed(3)} / dot(d, d));
            light = c * facing * fall * smoothstep(0.0, 0.04, min(edge.x, edge.y)) * 2.1;
          }
        }
        #if SHADOWED
          // you, between here and the hole (figure.ts's shapes, from behind): legs, coat, arms, scarf and head;
          // seen from four points across the hole, so a wide one gives your shadow a soft edge
          float t = (uYou.z - vAt.z) / (uHole.z - vAt.z);
          if (t > 0.0 && t < 1.0) {
            float lit = 0.0;
            for (int k = 0; k < 4; k++) {
              vec2 o = vec2(k == 0 ? 1.0 : k == 1 ? -1.0 : 0.0, k == 2 ? 1.0 : k == 3 ? -1.0 : 0.0) * uEdge;
              vec3 q = mix(vAt, uHole + vec3(o, 0.0), t);
              float y = q.y - uYou.y;
              float x = abs(q.x - uYou.x);
              bool legs = y > 0.0 && y < 0.82 && abs(x - 0.1) < 0.07;
              bool coat = y > 0.71 && y < 1.49 && x < mix(0.27, 0.2, (y - 0.71) / 0.78);
              bool arms = y > 0.8 && y < 1.44 && abs(x - 0.25) < 0.055;
              bool scarf = y > 1.46 && y < 1.58 && x < 0.2;
              bool head = length(vec2(x, y - 1.7)) < 0.15;
              if (!(legs || coat || arms || scarf || head)) lit += 0.25;
            }
            light *= lit;
          }
        #endif
        // and the little that comes back off the bright wall, most near it: the picture's own average,
        // so it's darker at night, and her flash comes and goes in the whole room
        light += textureLod(uPicture, vec2(0.5), 12.0).rgb * uBounce / (1.0 + vAt.z * vAt.z * 0.5);
        vec3 seen = albedo * light * uSeen * uGain;
        // night eyes: rods see by blue-green and no colour, and lift what's faint; but there are none where
        // you look straight, so there it's the cones' dim colour picture still, and the faint things go out
        vec3 eye = uYou + vec3(0.0, ${EYE.toFixed(2)}, 0.0);
        float straight = smoothstep(${FOVEA[0].toFixed(5)}, ${FOVEA[1].toFixed(5)}, dot(normalize(vAt - eye), normalize(uGaze - eye)));
        float lum = max(dot(seen, vec3(0.04, 0.5, 0.46)), 0.0);
        vec3 rod = vec3(0.6, 0.68, 0.84) * pow(lum, 0.8) * 0.85;
        vec3 cone = seen * smoothstep(0.08, 0.3, lum) * 0.7;
        seen = mix(seen, mix(rod, cone, straight * uLooking * 0.75), uNight);
        gl_FragColor = vec4(seen, 1.0);
      }`,
  });
}

export class Obscura {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
  readonly subTexel = new THREE.Vector2();
  /** The flat as it is out there, from the hide: drawn into this each frame by the world. */
  readonly target = new THREE.WebGLRenderTarget(200, 125, { depthBuffer: true });
  card: ObscuraCard | null = null;
  /** Walked out through the curtain: back to the flat. */
  leaving = false;
  /** Each step on the boards, for the sound. */
  onStep?: () => void;
  private you: Figure;
  private pos = new THREE.Vector3();
  private heading = 0;
  private speed = 0;
  private goal: THREE.Vector3 | null = null;
  private keys = new Set<string>();
  private stride = 0;
  private lastStep = 0;
  private stillFor = 0;
  private dark = 0;
  /** How long you've been in here (s): your eyes don't wait for you to stand still. */
  private time = 0;
  private away = false;
  private out = false;
  private told = false;
  private pickables: THREE.Object3D[] = [];
  private ray = new THREE.Raycaster();
  private target3 = new THREE.Vector3();
  private aspect = 1;
  private view = 4;
  private zoomed = 1;
  private shared = {
    uPicture: { value: this.target.texture as THREE.Texture },
    uHole: { value: HOLE },
    uTan: { value: TAN },
    uTexel: { value: new THREE.Vector2(1 / 200, 1 / 125) },
    uSeen: { value: 0 },
    uYou: { value: new THREE.Vector3() },
    uBounce: { value: 0.55 },
    uBlur: { value: 1 },
    uGain: { value: 1 },
    uEdge: { value: 0.02 },
    uNight: { value: 0 },
    uGaze: { value: new THREE.Vector3(0, 1.4, 0) },
    uLooking: { value: 0 },
  };
  /** Which of the slide's holes is over the hole (HOLES; the pea, as the hide was left). */
  hole = 1;
  /** Ever stood at the slide this visit. */
  slid = false;
  /** The light coming in, as the slide has it now (ln, against the pea), and how far your eyes have made up for it. */
  private light = 0;
  private eyes = 0;
  private blur = 1;
  private pushing = 0;
  private toldFor = 0;
  /** How long your eyes have had the dark (s): a wide-open thumb's hole bleaches them back. */
  private darkFor = 0;
  private nightTold = false;
  /** Where on the back wall you're looking, and when the pointer last said so (this visit). */
  private gaze = new THREE.Vector3(0, 1.4, 0);
  private lookedAt = -99;

  constructor(private texels: () => number) {
    this.scene.background = new THREE.Color('#000000');
    // (crisp, in texels; and its mipmaps, for the room's light off the wall, which is the picture's average)
    this.target.texture.minFilter = THREE.NearestMipmapNearestFilter;
    this.target.texture.magFilter = THREE.NearestFilter;
    this.target.texture.generateMipmaps = true;
    this.scene.add(this.camera);
    // (whitewashed, the back wall, as a camera obscura's is)
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(WIDE, TALL), projected(this.shared, '#d9d3c4'));
    wall.position.set(0, TALL / 2, 0);
    wall.userData.id = 'picture';
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WIDE, DEPTH).rotateX(-Math.PI / 2), projected(this.shared, '#8a7666', { planks: true }));
    floor.position.set(0, 0, DEPTH / 2);
    // the side walls, rough planks, seen only edge on unless the picture finds them
    const sideMat = projected(this.shared, '#5a4c46');
    for (const x of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, TALL), sideMat);
      side.rotation.y = -x * Math.PI / 2;
      side.position.set((x * WIDE) / 2, TALL / 2, DEPTH / 2);
      this.scene.add(side);
    }
    this.scene.add(wall, floor);
    this.pickables.push(wall);
    this.makeCurtain();
    // (the floor in front of the hole's wall, at the bottom of the picture: the hole's behind you, but you can go to it)
    const toHole = new THREE.Mesh(new THREE.PlaneGeometry(2.2, DEPTH - AT_HOLE).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
    toHole.position.set(0, 0.01, (DEPTH + AT_HOLE) / 2);
    toHole.userData.id = 'hole';
    this.scene.add(toHole);
    this.pickables.push(toHole);
    this.you = makeFigure({
      coat: projected(this.shared, '#4c4a6e', { you: true }),
      boots: projected(this.shared, '#2a2938', { you: true }),
      scarf: projected(this.shared, '#efe2c6', { you: true }),
      skin: projected(this.shared, '#5a4f63', { you: true }),
    });
    this.scene.add(this.you.root);
    this.resize(innerWidth, innerHeight);
  }

  /** A heavy curtain over the door, in folds, so the light from the flat stays out; the picture falls on it all the same. */
  private makeCurtain() {
    const mat = projected(this.shared, '#8a7a72');
    const g = new THREE.Group();
    const folds = 7;
    const w = (CURTAIN.x1 - CURTAIN.x0) / folds;
    for (let i = 0; i < folds; i++) {
      const fold = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 2.05, 0.05), mat);
      fold.position.set(CURTAIN.x0 + (i + 0.5) * w, 1.025, 0.08 + (i % 2) * 0.07);
      fold.rotation.y = (i % 2 ? -1 : 1) * 0.35;
      g.add(fold);
    }
    g.userData.id = 'curtain';
    this.scene.add(g);
    this.pickables.push(g);
  }

  /** In through the curtain: black, a step or two in, and turn to the wall. */
  arrive() {
    this.leaving = false;
    this.away = false;
    this.out = false;
    this.told = false;
    this.toldFor = 0;
    this.slid = false;
    this.pushing = 0;
    // (the slide stays where the last visitor left it; your eyes come in fresh)
    this.light = HOLES[this.hole].light;
    this.eyes = this.light * MAKE_UP;
    this.blur = HOLES[this.hole].blur;
    this.dark = 0;
    this.time = 0;
    this.darkFor = 0;
    this.nightTold = false;
    this.lookedAt = -99;
    this.stillFor = 0;
    this.keys.clear();
    this.pos.copy(IN);
    this.heading = Math.atan2(STEP_IN.x - IN.x, STEP_IN.z - IN.z);
    this.speed = PACE * 0.6;
    this.goal = STEP_IN.clone();
    this.frame(0);
  }

  /** Back out through the curtain. */
  goOut() {
    this.out = true;
    this.goal = new THREE.Vector3((CURTAIN.x0 + CURTAIN.x1) / 2, 0, 0.3);
  }

  key(code: string, down: boolean) {
    const k = KEYS[code];
    if (!k) return false;
    if (down) this.keys.add(k), (this.goal = null), (this.out = false);
    else this.keys.delete(k);
    return true;
  }

  releaseKeys() {
    this.keys.clear();
  }

  /** Push the slide along to its next hole: smaller, until the needle's, then back to the thumb's. */
  push() {
    if (this.pushing > 0) return false;
    this.hole = (this.hole + 1) % HOLES.length;
    this.pushing = PUSH;
    return true;
  }

  pick(ndc: THREE.Vector2): 'picture' | 'curtain' | 'hole' | null {
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObjects(this.pickables, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.id) o = o.parent;
    return (o?.userData.id as 'picture' | 'curtain' | 'hole' | undefined) ?? null;
  }

  /** The pointer's over the room: where on the back wall you're looking. */
  look(ndc: THREE.Vector2) {
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), p)) return;
    if (Math.abs(p.x) > WIDE / 2 || p.y < 0 || p.y > TALL) return;
    this.gaze.copy(p);
    this.lookedAt = this.time;
  }

  /** A click: on the curtain, out; on the picture, up to it and look; anywhere on the floor, walk there. */
  click(ndc: THREE.Vector2) {
    this.look(ndc);
    const id = this.pick(ndc);
    if (id === 'curtain') return this.goOut();
    this.out = false;
    if (id === 'hole') return void (this.goal = BY_HOLE.clone());
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (id === 'picture') {
      this.told = true;
      const hit = this.ray.intersectObjects(this.pickables, true)[0];
      this.goal = new THREE.Vector3(THREE.MathUtils.clamp(hit.point.x, -1.9, 1.2), 0, 1.6);
      return;
    }
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) this.goal = p.setY(0);
  }

  zoom(factor: number) {
    this.zoomed = THREE.MathUtils.clamp(this.zoomed * factor, 0.7, 1.3);
  }

  drag() {}

  resize(width: number, height: number) {
    this.aspect = width / height;
    // the whole back wall and the floor in front of it; on a narrow screen, as much of the wall as fits, following you
    this.view = Math.max(4.1, 3.1 / this.aspect);
  }

  /** How far your eyes have come round (0 black … 1 as well as they will). */
  get seeing() {
    return this.dark;
  }

  /** How far your night eyes have come (0 … 1). */
  get night() {
    return THREE.MathUtils.smoothstep(this.darkFor, NIGHT_FROM, NIGHT_FROM + NIGHT_TAKES);
  }

  update(dt: number) {
    this.walk(dt);
    this.animate();
    // your eyes: quick at first, then slower, and never quite all the way
    this.dark = 1 - Math.exp(-this.time / ADAPT);
    this.shared.uSeen.value = 0.05 + 0.95 * this.dark;
    this.lightIn(dt);
    this.shared.uYou.value.copy(this.pos);
    // the long dark: the thumb's glare takes your night eyes back, faster than they came
    this.darkFor = this.hole === 0 ? Math.max(0, this.darkFor - dt * 3) : this.darkFor + dt;
    this.shared.uNight.value = this.night;
    // (where the pointer last was on the wall, or where you last touched it; till then, nowhere in particular)
    this.shared.uGaze.value.copy(this.gaze);
    this.shared.uLooking.value = this.lookedAt > 0 ? 1 : 0;
    const curtain = this.pos.x > CURTAIN.x0 - 0.1 && this.pos.z < 1.0;
    if (!curtain && this.pos.distanceTo(IN) > 0.9) this.away = true;
    if (this.away && curtain && this.pos.x > CURTAIN.x0 + 0.15 && this.pos.z < 0.5) this.leaving = true;
    if (this.out && !this.goal) this.leaving = true;
    // its card, once you can see and have stood a moment (or looked closer); and it stays
    if (!this.told && this.dark > 0.75 && this.stillFor > STILL) this.told = true;
    if (this.told) this.toldFor += dt;
    if (!this.nightTold && this.night > 0.95 && this.stillFor > STILL) this.nightTold = true;
    // (back by the hole's wall, the slide's card instead)
    const atHole = this.pos.z > AT_HOLE && Math.abs(this.pos.x) < 1.3 && !this.out;
    if (atHole) this.slid = true;
    this.card = atHole && this.dark > 0.3 ? 'slide' : this.nightTold ? 'night' : this.told ? 'obscura' : null;
    this.frame(dt);
  }

  /** Once the card's been up a while and you haven't found the slide: a word that it's there. */
  get hint() {
    return this.card === 'obscura' && !this.slid && this.toldFor > 15;
  }

  /** The light through whichever hole's over it: the strip covers the hole as it moves, then your eyes catch up. */
  private lightIn(dt: number) {
    const to = HOLES[this.hole];
    let cover = 1;
    if (this.pushing > 0) {
      this.pushing = Math.max(0, this.pushing - dt);
      cover = Math.abs(1 - (2 * this.pushing) / PUSH) ** 2;
      // (the new hole's light comes in as the strip uncovers it)
      if (this.pushing < PUSH / 2) (this.light = to.light), (this.blur = to.blur), (this.shared.uEdge.value = to.edge);
    } else (this.light = to.light), (this.blur = to.blur), (this.shared.uEdge.value = to.edge);
    this.eyes += (this.light * MAKE_UP - this.eyes) * (1 - Math.exp(-dt / 2.5));
    this.shared.uGain.value = Math.min(6, Math.exp(this.light - this.eyes)) * cover;
    this.shared.uBlur.value = this.blur;
  }

  private walk(dt: number) {
    this.time += dt;
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
      if (d <= 0.06) this.goal = null;
      else (move.set(dx / d, dz / d), (want = PACE * Math.min(1, d / 0.3 + 0.3)));
    }
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * 8));
    if (this.speed < 0.02 && !want) {
      this.speed = 0;
      this.stillFor += dt;
      // stood, you turn to the picture
      if (!this.out) {
        let turn = Math.PI - this.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        this.heading += turn * (1 - Math.exp(-dt * 3));
      }
      return;
    }
    this.stillFor = 0;
    if (move.lengthSq()) {
      let turn = Math.atan2(move.x, move.y) - this.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      this.heading += turn * (1 - Math.exp(-dt * 10));
    }
    const step = this.speed * dt;
    const behind = this.out || this.pos.x > CURTAIN.x0 - 0.2;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x + Math.sin(this.heading) * step, -WIDE / 2 + 0.3, WIDE / 2 - 0.3);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z + Math.cos(this.heading) * step, behind ? 0.25 : 0.45, DEPTH - 0.3);
    this.stride += step;
    if (this.stride - this.lastStep > 0.62) {
      this.lastStep = this.stride;
      this.onStep?.();
    }
  }

  private animate() {
    const w = this.you;
    w.root.position.copy(this.pos);
    w.root.rotation.set(0, this.heading, 0);
    const swing = Math.sin(this.stride * 9) * Math.min(1, this.speed / PACE) * 0.45;
    w.legs[0].rotation.x = swing;
    w.legs[1].rotation.x = -swing;
    w.arms[0].rotation.x = -swing * 0.8;
    w.arms[1].rotation.x = swing * 0.8;
    w.scarfTail.rotation.x = 0.1 + this.speed * 0.1;
  }

  /** The picture as many texels across as the back wall is on screen, so it's drawn one for one. */
  private fitPicture(view: number) {
    const w = THREE.MathUtils.clamp(Math.round((WIDE * this.texels()) / view), 64, 640);
    const h = Math.round(w / PICTURE_ASPECT);
    if (w === this.target.width && h === this.target.height) return;
    this.target.setSize(w, h);
    this.shared.uTexel.value.set(1 / w, 1 / h);
  }

  private frame(dt: number) {
    const view = this.view * this.zoomed;
    this.fitPicture(view);
    const h = view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    // the wall's middle, a little low so the floor you stand on is in; across, as far as the wall goes
    const room = Math.max(0, WIDE / 2 + 0.2 - w);
    const want = new THREE.Vector3(THREE.MathUtils.clamp(this.pos.x, -room, room), 1.0, 1.1);
    if (dt) this.target3.lerp(want, 1 - Math.exp(-dt * 2));
    else this.target3.copy(want);
    const t = this.target3;
    cam.position.set(t.x, t.y + Math.sin(ELEVATION) * DISTANCE, t.z + Math.cos(ELEVATION) * DISTANCE);
    cam.lookAt(t);
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
  }
}
