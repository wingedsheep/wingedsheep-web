import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toonIndoors } from './interior';
import { Picker } from './picking';
import { RoomCamera } from './room-camera';
import { haloTexture } from './sky';

const SKY_DAY = new THREE.Color('#9fc4e8');
const SKY_NIGHT = new THREE.Color('#141a36');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

interface Lamp {
  light: THREE.PointLight;
  halo?: THREE.Sprite;
  base: number;
  flicker: number;
  seed: number;
}

interface Screen {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  paint: Painter;
  next: number;
}

/** Draws one frame of a little screen; returns how many seconds until the next one. */
type Painter = (g: CanvasRenderingContext2D, t: number) => number;

/**
 * A chapter of the career trail (tools/models/career/): a small scene floating in the sky above
 * the mountain. Anything with an id can be clicked; meshes named `screen_<kind>` get a little
 * animated screen drawn by the painter of that kind (see SCREENS); "<name>_idle" clips loop.
 */
export class Diorama {
  readonly scene = new THREE.Scene();
  readonly picker: Picker;
  /** Things with an id, for highlighting. */
  readonly named = new Map<string, THREE.Object3D>();

  private bounds = new THREE.Box3();
  /** Frames the whole diorama; you can zoom and look around it. */
  readonly view = new RoomCamera(this.bounds);
  private lamps: Lamp[] = [];
  private screens: Screen[] = [];
  private sky = SKY_DAY.clone();
  private hemi = new THREE.HemisphereLight('#dfe8ff', '#4a3a2a', 1.3);
  private key = new THREE.DirectionalLight('#ffe9cc', 1.2);
  private mixer: THREE.AnimationMixer;
  private clock = 0;

  static async load(id: string, base = '/models/'): Promise<Diorama> {
    const gltf = await new GLTFLoader().loadAsync(`${base}career-${id}.glb`);
    return new Diorama(gltf.scene, gltf.animations);
  }

  private constructor(root: THREE.Group, clips: THREE.AnimationClip[]) {
    this.scene.add(root);
    this.scene.background = this.sky;
    root.updateMatrixWorld(true);

    const halo = haloTexture();
    root.traverse((o) => {
      const x = o.userData;
      if (x.id) this.named.set(x.id, o);
      if (x.light) this.addLamp(o.getWorldPosition(V()), x, halo);
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glow = src.name.startsWith('glow_');
        const screen = SCREENS[screenKind(o) ?? ''];
        if (screen) {
          this.addScreen(mesh, screen);
          return;
        }
        mesh.material = toonIndoors(src.color, glow);
        mesh.castShadow = !glow && !o.name.startsWith('clouds');
        mesh.receiveShadow = true;
      }
    });
    // frame the land, not the clouds drifting round it
    const land = root.getObjectByName('plinth');
    this.bounds.setFromObject(land ?? root);
    this.bounds.max.y = Math.max(this.bounds.max.y, new THREE.Box3().setFromObject(root).max.y);

    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips.filter((c) => c.name.endsWith('_idle'))) this.mixer.clipAction(clip).play();

    const size = this.bounds.getSize(V());
    const reach = Math.max(size.x, size.z) * 0.6;
    this.key.position.set(reach * 0.6, reach * 1.1, reach * 0.8).add(this.bounds.getCenter(V()));
    this.key.target.position.copy(this.bounds.getCenter(V()));
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: reach * 4 });
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.key, this.key.target);

    this.picker = new Picker(this.camera);
    this.picker.add(...this.named.values());
  }

  get camera() {
    return this.view.camera;
  }

  frame(width: number, height: number, free: { x: number; y: number; w: number; h: number }) {
    this.view.frame(width, height, free);
  }

  /** `night` is 0 (day) … 1 (night), the same as on the island below. */
  update(dt: number, night: number) {
    this.clock += dt;
    const t = this.clock;
    const day = 1 - night;
    this.mixer.update(dt);
    for (const l of this.lamps) {
      const f = l.flicker ? 1 - l.flicker * 0.25 * (Math.sin(t * 13 + l.seed) * 0.5 + Math.sin(t * 7.7 + l.seed * 3) * 0.5 + 0.5) : 1;
      l.light.intensity = l.base * (0.2 + night * 0.8) * f;
      if (l.halo) (l.halo.material as THREE.SpriteMaterial).opacity = (0.1 + night * 0.6) * f;
    }
    this.sky.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    this.hemi.intensity = 0.55 + day * 0.8;
    this.key.intensity = 0.3 + day * 0.95;
    this.key.color.set(day > 0.5 ? '#ffe9cc' : '#aab8ff');

    for (const s of this.screens) {
      if ((s.next -= dt) > 0) continue;
      s.next = s.paint(s.canvas.getContext('2d')!, t);
      s.texture.needsUpdate = true;
    }
  }

  private addScreen(mesh: THREE.Mesh, screen: ScreenKind) {
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = screen.size ?? [48, 32];
    const paint = screen.make();
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    faceFront(mesh);
    mesh.material = new THREE.MeshBasicMaterial({ map: texture });
    this.screens.push({ canvas, texture, paint, next: 0 });
  }

  private addLamp(position: THREE.Vector3, x: Record<string, number | string>, halo: THREE.Texture) {
    const radius = Number(x.radius);
    const light = new THREE.PointLight(new THREE.Color(String(x.color)), 0, radius * 1.8, 1.4);
    light.position.copy(position);
    this.scene.add(light);
    const lamp: Lamp = { light, base: Number(x.intensity) * 7, flicker: Number(x.flicker), seed: Math.random() * 100 };
    this.lamps.push(lamp);
    if (x.halo === 0) return;
    lamp.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: halo, color: new THREE.Color(String(x.color)), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    lamp.halo.position.copy(position);
    lamp.halo.scale.setScalar(radius * 0.22);
    lamp.halo.renderOrder = 2;
    lamp.halo.raycast = () => {};
    this.scene.add(lamp.halo);
  }
}

function screenKind(o: THREE.Object3D): string | undefined {
  for (const n of [o.name, o.parent?.name ?? '']) {
    const m = n.match(/^screen_([a-z]+)/);
    if (m) return m[1];
  }
  return undefined;
}

/**
 * A screen modelled facing -y in Blender (+z here, before its object turns it): map the
 * picture flat across it, the right way round when you look at its face.
 */
function faceFront(mesh: THREE.Mesh) {
  const geo = mesh.geometry.clone();
  const pos = geo.getAttribute('position');
  const box = new THREE.Box3().setFromBufferAttribute(pos as THREE.BufferAttribute);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - box.min.x) / (box.max.x - box.min.x || 1);
    uv[i * 2 + 1] = (pos.getY(i) - box.min.y) / (box.max.y - box.min.y || 1);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  mesh.geometry = geo;
}

// --- screens --------------------------------------------------------------------------------

/**
 * OpenAI Gym's Lunar Lander, still learning: it drifts down between the flags, firing its engine
 * too much or too little, and lands (sometimes) or crashes (mostly). The episode counter ticks up.
 */
function lunarLander(): Painter {
  let episode = 1 + Math.floor(Math.random() * 400);
  let x = 0, y = 0, vx = 0, vy = 0, fire = 0, end = 0, landed = false;
  const reset = () => {
    x = 10 + Math.random() * 28;
    y = 4;
    vx = (Math.random() - 0.5) * 6;
    vy = 0;
    end = 0;
  };
  reset();
  let last = 0;
  return (g, t) => {
    const dt = Math.min(t - last, 0.2);
    last = t;
    const W = 48, H = 32, ground = 26;
    if (end > 0) {
      end -= dt;
      if (end <= 0) {
        episode++;
        reset();
      }
    } else {
      // a policy that's getting there: brake near the ground, steer vaguely at the pad
      const skill = Math.min(0.9, 0.3 + episode / 2000);
      fire = (vy > 3 && y > 12) || Math.random() < 0.25 ? (Math.random() < skill ? 1 : 0) : 0;
      vy += (6 - fire * 13) * dt;
      vx += ((24 - x) * 0.3 * skill + (Math.random() - 0.5) * 6) * dt;
      x += vx * dt;
      y += vy * dt;
      if (y >= ground - 3) {
        y = ground - 3;
        landed = Math.abs(vy) < 5 && Math.abs(x - 24) < 7;
        end = landed ? 1.6 : 1.2;
      }
      if (x < -4 || x > W + 4) end = 0.4;
    }
    g.fillStyle = '#0b0a14';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#e8e2d4';
    for (const [sx, sy] of [[5, 4], [17, 9], [31, 3], [42, 11], [38, 6]]) g.fillRect(sx, sy, 1, 1);
    // the moon's surface, flat in the middle for the pad
    g.fillStyle = '#e8e2d4';
    g.beginPath();
    g.moveTo(0, H);
    for (const [px, py] of [[0, 21], [6, 24], [12, 22], [17, ground], [31, ground], [36, 22], [42, 25], [48, 20], [48, H]]) g.lineTo(px, py);
    g.fill();
    g.fillStyle = '#f0d040';
    g.fillRect(17, ground - 4, 1, 4);
    g.fillRect(30, ground - 4, 1, 4);
    g.fillRect(18, ground - 4, 2, 1);
    g.fillRect(31, ground - 4, 2, 1);
    const lx = Math.round(x), ly = Math.round(y);
    if (end > 0 && !landed) {
      // a small, sad explosion
      g.fillStyle = Math.floor(t * 8) % 2 ? '#ff9a3c' : '#ffd070';
      g.fillRect(lx - 2, ly - 1, 5, 3);
      g.fillRect(lx - 1, ly - 3, 3, 1);
    } else {
      g.fillStyle = '#b89cf0';
      g.fillRect(lx - 2, ly - 1, 5, 3);
      g.fillStyle = '#e8e2d4';
      g.fillRect(lx - 3, ly + 2, 1, 1);
      g.fillRect(lx + 3, ly + 2, 1, 1);
      if (fire && end <= 0) {
        g.fillStyle = '#ff9a3c';
        g.fillRect(lx, ly + 2, 1, 2 + Math.floor(Math.random() * 2));
      }
    }
    g.fillStyle = '#6fe0d6';
    g.font = '5px monospace';
    g.fillText(landed && end > 0 ? 'LANDED' : `EP ${episode}`, 2, 6);
    return 1 / 12;
  };
}

/**
 * The loop of road in the Backbone diorama and who drives round it when: mirrors LOOP_*, BUS_*
 * and TRUCK_* in tools/models/career/backbone.py. The clips and this clock both start at 0.
 */
const LOOP = { half: 6, r: 3.4, y: -4.8 };
const LOOP_LEN = 4 * LOOP.half + 2 * Math.PI * LOOP.r;
const BUS = { drive: 16, lap: 19.5, ease: 0.7, stop: 7.7 };

function loopPoint(s: number): [number, number] {
  const { half: h, r, y: yc } = LOOP;
  s = ((s % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
  if (s < 2 * h) return [-h + s, yc - r];
  s -= 2 * h;
  if (s < Math.PI * r) {
    const a = -Math.PI / 2 + s / r;
    return [h + r * Math.cos(a), yc + r * Math.sin(a)];
  }
  s -= Math.PI * r;
  if (s < 2 * h) return [h - s, yc + r];
  s -= 2 * h;
  const a = Math.PI / 2 + s / r;
  return [-h + r * Math.cos(a), yc + r * Math.sin(a)];
}

const busAt = (t: number) => {
  const p = Math.min((t % BUS.lap) / BUS.drive, 1);
  return BUS.stop + LOOP_LEN * (p - (BUS.ease * Math.sin(2 * Math.PI * p)) / (2 * Math.PI));
};
const truckAt = (t: number) => BUS.stop + LOOP_LEN / 2 + (LOOP_LEN * t) / BUS.lap;

/**
 * The verkeersleiding's big screen: the diorama seen from above, north up, with the bus and the
 * truck blinking where they really are and the two shared cars parked by their garage.
 */
function fleetMap(): Painter {
  const W = 64, H = 40;
  const px = (x: number) => Math.round(W / 2 + (x - 0.5) * 1.75);
  const py = (y: number) => Math.round(H / 2 - (y + 0.5) * 1.75);
  const dot = (g: CanvasRenderingContext2D, [x, y]: [number, number], c: string, s = 2) => {
    g.fillStyle = c;
    g.fillRect(px(x) - (s >> 1), py(y) - (s >> 1), s, s);
  };
  return (g, t) => {
    g.fillStyle = '#0d1a22';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#16303a';                     // the land
    g.beginPath();
    g.ellipse(px(0.5), py(-0.5), 16 * 1.75, 11 * 1.75, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3c5a66';                     // buildings: castle, warehouse, garage
    g.fillRect(px(-7.3), py(6.9), px(7.3) - px(-7.3), py(3.3) - py(6.9));
    g.fillRect(px(10), py(3.5), px(14.4) - px(10), py(0.3) - py(3.5));
    g.fillRect(px(-13.7), py(3.1), px(-10.1) - px(-13.7), py(0.7) - py(3.1));
    for (let s = 0; s < LOOP_LEN; s += 0.5) dot(g, loopPoint(s), '#7d98a3', 1);   // the road
    dot(g, [2.9, -9.6], '#6fe0d6', 1);           // the halte
    const blink = Math.floor(t * 3) % 3 !== 0;
    for (const [s, c] of [[busAt(t) - 1.6, '#4fdc5a'], [truckAt(t) - 2.5, '#f0b42a']] as const) {
      const p = loopPoint(s);
      if (blink) dot(g, p, '#ffffff', 4);
      dot(g, p, c, 2);
    }
    const unlocked = Math.floor(t / 4) % 3;      // now and then someone opens a car
    dot(g, [-12.6, -1.9], unlocked === 1 && blink ? '#4fdc5a' : '#e8e2d4', 2);
    dot(g, [-11.3, -0.2], unlocked === 2 && blink ? '#4fdc5a' : '#e8e2d4', 2);
    g.fillStyle = '#6fe0d6';
    g.font = '5px monospace';
    g.fillText('LIVE', 2, 6);
    return 1 / 10;
  };
}

/** The bus's destination sign: orange LEDs, taking turns between where it goes and via where. */
function destination(): Painter {
  const pages = ['UTRECHT CS', 'via UITHOF', 'streekBuzz'];
  return (g, t) => {
    const W = 64, H = 9;
    g.fillStyle = '#140d05';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffb020';
    g.font = '7px monospace';
    g.textAlign = 'center';
    g.fillText(pages[Math.floor(t / 3) % pages.length], W / 2, 7);
    return 0.5;
  };
}

/**
 * The energy diorama's day, shared by its three screens so they agree: one simulated day every
 * DAY_SECONDS, starting at dawn. A street of solar roofs feeds in at noon and draws in the
 * evening; the transformer can take CAP either way. The battery soaks up what's over the line at
 * noon and hands it back at the evening peak.
 */
const DAY_SECONDS = 30;
const STEPS = 96;
const CAP = 0.55;
const hourAt = (t: number) => ((t / DAY_SECONDS) * 24 + 6) % 24;

const grid = (() => {
  const sun = (h: number) => Math.max(0, Math.sin((Math.PI * (h - 6.5)) / 13));
  const demand = (h: number) => 0.28 + 0.18 * Math.exp(-((h - 8) ** 2) / 3) + 0.38 * Math.exp(-((h - 19) ** 2) / 4);
  const hours = Array.from({ length: STEPS }, (_, i) => (i * 24) / STEPS);
  const net = hours.map((h) => demand(h) - 1.25 * sun(h));
  const charge = net.map((n) => Math.max(0, -n - CAP * 0.8));
  const size = charge.reduce((a, c) => a + c, 0) * 1.05;
  const soc: number[] = [];
  const flex: number[] = [];
  let e = size * 0.15;
  for (let i = 0; i < STEPS; i++) {
    const out = Math.min(e, Math.max(0, net[i] - CAP * 0.8));
    e = Math.min(size, e + charge[i] - out);
    soc.push(e / size);
    flex.push(net[i] + charge[i] - out);
  }
  // euros per MWh on the day-ahead market: below zero when the sun floods it
  const price = Array.from({ length: 24 }, (_, h) => Math.round(20 + 120 * demand(h + 0.5) - 95 * sun(h + 0.5)));
  return { net, flex, soc, charge, price };
})();

const stepAt = (t: number) => Math.floor((hourAt(t) / 24) * STEPS) % STEPS;

/** A little sun by day, a moon by night, in the top corner of a screen. */
function sky(g: CanvasRenderingContext2D, t: number, x: number) {
  const h = hourAt(t);
  g.fillStyle = h > 6.5 && h < 19.5 ? '#ffd84a' : '#c9d6e6';
  g.fillRect(x, 1, 2, 2);
}

/**
 * The transformer kiosk: one big gauge of how hard it's working right now, feeding the sun out
 * (bar grows right) or taking power in (the same, in amber), with the red mark it can't pass.
 * Where the street on its own would blow through the mark, the overshoot shows in dull red; the
 * bar itself, with the battery doing its bit, stops short of it.
 */
function gridLoad(): Painter {
  const W = 16, H = 10, x0 = 1, full = 13;
  const len = (v: number) => Math.min(full + 1, Math.round((Math.abs(v) / 1.0) * full));
  return (g, t) => {
    const i = stepAt(t), net = grid.net[i], flex = grid.flex[i];
    g.fillStyle = '#0d1a22';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#1c323b';
    g.fillRect(x0, 4, full + 1, 4);
    if (Math.abs(net) > CAP) {
      g.fillStyle = '#7a2e2a';
      g.fillRect(x0, 4, len(net), 4);
    }
    g.fillStyle = flex < 0 ? '#6fe0d6' : '#f0b42a';
    g.fillRect(x0, 4, len(flex), 4);
    g.fillStyle = '#e0503a';
    g.fillRect(x0 + len(CAP), 3, 1, 6);
    sky(g, t, W - 3);
    return 1 / 6;
  };
}

/** The battery's side: how full it is, with an arrow while it charges or gives back. */
function batteryCharge(): Painter {
  return (g, t) => {
    const W = 15, H = 10, i = stepAt(t), soc = grid.soc[i];
    g.fillStyle = '#0d1a22';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#6fe0d6';
    g.fillRect(1, 2, 11, 6);
    g.fillRect(12, 4, 1, 2);
    g.fillStyle = '#0d1a22';
    g.fillRect(2, 3, 9, 4);
    g.fillStyle = soc < 0.2 ? '#e0503a' : '#4fdc5a';
    g.fillRect(2, 3, Math.max(1, Math.round(9 * soc)), 4);
    const charging = grid.charge[i] > 0, giving = grid.flex[i] < grid.net[i];
    if ((charging || giving) && Math.floor(t * 2) % 2) {
      g.fillStyle = '#ffd84a';
      g.fillRect(13, charging ? 0 : 8, 2, 2);
    }
    return 1 / 4;
  };
}

/**
 * Direct+ on Vincent's screen: the day-ahead price for every two hours on the power exchange,
 * green where it drops below zero around noon, amber at the evening peak, the hour we're in lit
 * white, under a header in Direct+ blue.
 */
function dayAhead(): Painter {
  const W = 16, H = 10, zero = 7, k = 0.045;
  return (g, t) => {
    const h = Math.floor(hourAt(t) / 2);
    g.fillStyle = '#0b1026';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#136aff';
    g.fillRect(0, 0, W, 1);
    for (let i = 0; i < 12; i++) {
      const p = (grid.price[i * 2] + grid.price[i * 2 + 1]) / 2;
      const hgt = Math.max(1, Math.round(Math.abs(p) * k));
      g.fillStyle = i === h ? '#ffffff' : p < 0 ? '#4fdc5a' : p > 90 ? '#f0b42a' : '#6aa0ff';
      g.fillRect(2 + i, p < 0 ? zero + 1 : zero + 1 - hgt, 1, hgt);
    }
    return 1 / 4;
  };
}

interface ScreenKind {
  make: () => Painter;
  /** Canvas pixels; 48 × 32 unless the screen is shaped otherwise. */
  size?: [number, number];
}

const SCREENS: Record<string, ScreenKind> = {
  lander: { make: lunarLander },
  fleet: { make: fleetMap, size: [64, 40] },
  route: { make: destination, size: [64, 9] },
  grid: { make: gridLoad, size: [16, 10] },
  soc: { make: batteryCharge, size: [15, 10] },
  market: { make: dayAhead, size: [16, 10] },
};
