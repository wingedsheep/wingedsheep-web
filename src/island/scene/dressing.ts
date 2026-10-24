import * as THREE from 'three';
import { type Occasion, occasions } from './calendar';
import { haloTexture } from './sky';

/**
 * The rooms indoors, dressed for the special days (tools/models/dressing.py), as the island is
 * outside (holidays.py). Each room drops what isn't for today with `undress`, before it looks for
 * ids and lights, and then hands its root to a `Haunts`, which moves what's tagged `spook=`:
 *
 *   spider  lets itself down on its thread, bobs, hangs a while turning, and climbs back up hand
 *           over hand; then waits at the top
 *   sway    paper bats on a garland, swinging in a draught that comes and goes
 *   flame   a candle flame, flickering
 *   ghost   drifts about its spot after dark, fading in, and some time later out again
 *   raven   looks about in quick turns of the head, and now and then shakes its feathers out
 *   crawler a clockwork spider, ticking along the bench, stopping, turning round, the key going
 *   bulb    a string of pumpkin lights running in a slow chase
 *   bubbles what's in the cauldron, coming up in bubbles that swell and pop
 *
 * And over Halloween the room itself goes dim and lilac, the candles carrying it, with a low mist
 * drifting across the floor (`gloom`, which the room calls after it has set its own lights).
 */
export function undress(root: THREE.Object3D) {
  const off: THREE.Object3D[] = [];
  root.traverse((o) => {
    const tag = o.userData.holiday as string | undefined;
    if (tag && occasions.has(tag.replace('!', '') as Occasion) === tag.startsWith('!')) off.push(o);
  });
  for (const o of off) o.removeFromParent();
  root.updateMatrixWorld(true);
}

const LILAC = new THREE.Color('#9c8cc8');
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const smooth = (x: number) => x * x * (3 - 2 * x);
/** Where a spider sits, curled up at the top of its thread. */
const TUCKED = 0.06;

interface Spider {
  root: THREE.Object3D;
  thread: THREE.Object3D;
  body: THREE.Object3D;
  drop: number;
  /** How far down it is now, and where it was when this stretch began. */
  at: number;
  from: number;
  state: 'waiting' | 'dropping' | 'hanging' | 'climbing';
  t: number;
  /** How long this stretch lasts. */
  span: number;
  spin: number;
}

interface Ghost {
  root: THREE.Object3D;
  rest: THREE.Vector3;
  range: THREE.Vector3;
  materials: THREE.Material[];
  /** 0 gone .. 1 there; whether it's coming or going; how long until it turns. */
  shown: number;
  coming: boolean;
  left: number;
  seed: number;
  last: THREE.Vector3;
}

interface Raven {
  head: THREE.Object3D;
  body: THREE.Object3D;
  rest: THREE.Euler;
  look: { yaw: number; tilt: number };
  next: number;
  shake: number;
}

interface Crawler {
  root: THREE.Object3D;
  start: THREE.Vector3;
  run: number;
  legs: { o: THREE.Object3D; rest: number; phase: number }[];
  key?: THREE.Object3D;
  /** Where along its run (-1..1 of half of it), which way, its heading, and whether it's stopped. */
  at: number;
  dir: 1 | -1;
  heading: number;
  pause: number;
  stride: number;
}

interface Wisp {
  sprite: THREE.Sprite;
  t: number;
  life: number;
  drift: THREE.Vector3;
}

interface Swing {
  o: THREE.Object3D;
  rest: THREE.Euler;
  phase: number;
}

export class Haunts {
  private spiders: Spider[] = [];
  private ghosts: Ghost[] = [];
  private swings: Swing[] = [];
  private flames: { o: THREE.Object3D; phase: number }[] = [];
  private ravens: Raven[] = [];
  private crawlers: Crawler[] = [];
  private bulbs: { material: THREE.MeshToonMaterial; index: number }[] = [];
  private wisps: Wisp[] = [];
  private bubbles: { o: THREE.Object3D; base: THREE.Vector3; phase: number; speed: number }[] = [];
  private clock = Math.random() * 100;
  /** Whether it's Halloween in here at all (anything of it survived `undress`). */
  readonly haunted: boolean;
  private hemiColor?: THREE.Color;

  /** After the room has given its meshes their materials (a ghost gets its own, to fade). */
  constructor(root: THREE.Object3D, private scene?: THREE.Scene, private bounds?: THREE.Box3) {
    let haunted = false;
    root.traverse((o) => {
      const x = o.userData;
      if (x.holiday === 'halloween') haunted = true;
      if (x.spook === 'spider') {
        const thread = o.children.find((c) => c.name.endsWith('_thread'));
        const body = o.children.find((c) => c.name.endsWith('_body'));
        if (!thread || !body) return;
        const s: Spider = {
          root: o, thread, body, drop: x.drop, at: TUCKED, from: TUCKED,
          state: 'waiting', t: 0, span: (x.wait ?? 0) + rand(2, 6), spin: 0,
        };
        this.spiders.push(s);
        this.place(s);
      } else if (x.spook === 'sway') {
        this.swings.push({ o, rest: new THREE.Euler().setFromQuaternion(o.quaternion, 'YXZ'), phase: x.phase ?? 0 });
        o.rotation.order = 'YXZ';
      } else if (x.spook === 'flame') {
        this.flames.push({ o, phase: x.phase ?? Math.random() * 10 });
      } else if (x.spook === 'ghost') {
        const materials: THREE.Material[] = [];
        o.traverse((m) => {
          const mesh = m as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mat = (mesh.material as THREE.Material).clone();
          mat.transparent = true;
          mat.depthWrite = false;
          mesh.material = mat;
          mesh.castShadow = false;
          materials.push(mat);
        });
        // Blender's (x, y, z) ranges are the scene's (x, z, y)
        const g: Ghost = {
          root: o, rest: o.position.clone(), range: new THREE.Vector3(x.rx ?? 1, x.rz ?? 0.3, x.ry ?? 0.3),
          materials, shown: 0, coming: false, left: rand(2, 6), seed: Math.random() * 50, last: o.position.clone(),
        };
        this.ghosts.push(g);
        this.fade(g);
      } else if (x.spook === 'raven') {
        const head = o.children.find((c) => c.name.endsWith('_head'));
        const body = o.children.find((c) => c.name.endsWith('_body'));
        if (head && body) this.ravens.push({ head, body, rest: head.rotation.clone(), look: { yaw: 0, tilt: 0 }, next: rand(1, 3), shake: rand(12, 30) });
      } else if (x.spook === 'crawler') {
        const legs = o.children
          .filter((c) => c.name.includes('_leg_'))
          .map((c) => ({ o: c, rest: new THREE.Euler().setFromQuaternion(c.quaternion, 'YXZ').y, phase: c.userData.phase ?? 0 }));
        for (const l of legs) l.o.rotation.order = 'YXZ';
        this.crawlers.push({
          root: o, start: o.position.clone(), run: x.run ?? 1, legs, key: o.children.find((c) => c.name.endsWith('_key')),
          at: 0, dir: 1, heading: 0, pause: rand(1, 3), stride: 0,
        });
      } else if (x.spook === 'bubbles') {
        for (const [i, b] of o.children.entries()) this.bubbles.push({ o: b, base: b.position.clone(), phase: i / o.children.length, speed: rand(0.6, 0.9) });
      } else if (x.spook === 'bulb') {
        o.traverse((m) => {
          const mesh = m as THREE.Mesh;
          const mat = mesh.isMesh ? (mesh.material as THREE.MeshToonMaterial) : null;
          if (!mat?.emissive || mat.emissive.getHex() === 0) return;
          mesh.material = mat.clone();
          this.bulbs.push({ material: mesh.material as THREE.MeshToonMaterial, index: x.index ?? 0 });
        });
      }
    });
    this.haunted = haunted;
  }

  /**
   * Halloween's light, after the room has set its own for the moment: dimmer, and lilac in the
   * shadows, so what's lit by candle stands out; and the mist on the floor.
   */
  gloom(hemi: THREE.HemisphereLight, key: THREE.DirectionalLight, night: number) {
    if (!this.haunted) return;
    this.hemiColor ??= hemi.color.clone();
    hemi.color.copy(this.hemiColor).lerp(LILAC, 0.45 + night * 0.35);
    hemi.intensity *= 0.7 - night * 0.25;
    key.intensity *= 0.7 - night * 0.3;
    key.color.lerp(LILAC, night * 0.5);
    this.mist(night);
  }

  /** Low wisps over the floor, each drifting a while, there and gone again. */
  private mist(night: number) {
    const b = this.bounds;
    if (!this.scene || !b || b.isEmpty()) return;
    if (!this.wisps.length) {
      const halo = haloTexture();
      for (let i = 0; i < 14; i++) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#d8ccec', transparent: true, depthWrite: false, opacity: 0 }));
        sprite.raycast = () => {};
        sprite.renderOrder = 1;
        this.scene.add(sprite);
        const w: Wisp = { sprite, t: 0, life: 1, drift: new THREE.Vector3() };
        this.respawn(w);
        w.t = Math.random() * w.life; // not all at once
        this.wisps.push(w);
      }
    }
    for (const w of this.wisps) {
      const k = w.t / w.life;
      (w.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) ** 2 * (0.16 + night * 0.2);
    }
  }

  private respawn(w: Wisp) {
    const b = this.bounds!;
    const size = b.getSize(new THREE.Vector3());
    // well inside the walls (a wisp is wide), low over the floor (every room's is at 0)
    w.sprite.position.set(b.min.x + size.x * rand(0.3, 0.7), rand(0.3, 0.55), b.min.z + size.z * rand(0.3, 0.7));
    const s = Math.min(size.x, size.z) * rand(0.18, 0.3);
    w.sprite.scale.set(s, s * 0.3, 1);
    w.drift.set(rand(-0.06, 0.06), 0, rand(-0.04, 0.04));
    w.life = rand(10, 18);
    w.t = 0;
  }

  update(dt: number, night: number) {
    if (dt <= 0) return;
    this.clock += dt;
    const t = this.clock;
    for (const s of this.spiders) this.spider(s, dt, t);
    // the draught: mostly still, now and then a breath through the room that sets them all going
    const draught = 0.25 + 0.75 * Math.max(0, Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1));
    for (const { o, rest, phase } of this.swings) {
      const swing = draught * (0.28 * Math.sin(t * 2.3 + phase) + 0.08 * Math.sin(t * 3.9 + phase * 2));
      const twist = 0.35 * Math.sin(t * 0.7 + phase * 1.3) * (0.4 + draught);
      o.rotation.set(rest.x + swing, rest.y + twist, rest.z);
    }
    for (const { o, phase } of this.flames) {
      const a = Math.sin(t * 11 + phase) * 0.5 + Math.sin(t * 17.3 + phase * 2) * 0.3 + Math.sin(t * 5.1 + phase) * 0.2;
      o.scale.set(1 - a * 0.06, 0.9 + a * 0.2, 1 - a * 0.06);
      o.rotation.z = Math.sin(t * 2.7 + phase) * 0.12;
    }
    for (const g of this.ghosts) this.ghost(g, dt, t, night);
    for (const r of this.ravens) this.raven(r, dt);
    for (const c of this.crawlers) this.crawl(c, dt);
    for (const { material, index } of this.bulbs) {
      const wave = 0.5 + 0.5 * Math.sin(t * 2.2 - index * 0.9);
      material.emissiveIntensity = 0.35 + wave * 0.9;
    }
    for (const b of this.bubbles) {
      // up through the brew, swelling, and pop
      const k = (t * b.speed + b.phase) % 1;
      b.o.position.set(b.base.x, b.base.y + k * 0.08, b.base.z);
      b.o.scale.setScalar(k < 0.85 ? 0.3 + k * 0.9 : Math.max(0.01, (1 - k) * 6));
    }
    for (const w of this.wisps) {
      w.t += dt;
      w.sprite.position.addScaledVector(w.drift, dt);
      if (w.t >= w.life) this.respawn(w);
    }
  }

  /** Quick looks about, a held stare, a tilt of the head; every so often it ruffles itself up and settles. */
  private raven(r: Raven, dt: number) {
    if ((r.next -= dt) < 0) {
      r.look = { yaw: rand(-1, 1) * (Math.random() < 0.3 ? 1.4 : 0.7), tilt: Math.random() < 0.35 ? rand(-0.45, 0.45) : 0 };
      r.next = rand(0.6, 3.2);
    }
    // birds turn their heads in snaps, not sweeps (Blender's up is the scene's y)
    const h = r.head.rotation;
    h.y = THREE.MathUtils.damp(h.y, r.rest.y + r.look.yaw, 16, dt);
    h.z = THREE.MathUtils.damp(h.z, r.rest.z + r.look.tilt, 10, dt);
    if ((r.shake -= dt) < 0) r.shake = rand(14, 32);
    const k = r.shake < 0.7 ? r.shake / 0.7 : 0; // the last moment before each reset: a shake, dying away
    const s = Math.sin(k * Math.PI * 4) * k * 0.08;
    r.body.scale.set(1 + Math.abs(s), 1 + s * 0.5, 1 + Math.abs(s));
  }

  /** Tick along, stop, tick on; at the end of the bench, turn round on the spot. */
  private crawl(c: Crawler, dt: number) {
    const half = c.run / 2;
    const want = c.dir > 0 ? 0 : Math.PI;
    let moving = false;
    if (c.pause > 0) {
      c.pause -= dt;
    } else if (Math.abs(c.heading - want) > 0.01) {
      c.heading = THREE.MathUtils.damp(c.heading, want, 5, dt); // turning on the spot, legs still going
      if (Math.abs(c.heading - want) < 0.02) c.heading = want;
      moving = true;
    } else {
      c.at += c.dir * 0.16 * dt;
      moving = true;
      if (Math.abs(c.at) >= half) {
        c.at = c.dir * half;
        c.dir = c.dir > 0 ? -1 : 1;
        c.pause = rand(0.8, 2);
      } else if (Math.random() < dt * 0.12) c.pause = rand(1.2, 3.5); // winding down for a moment
    }
    c.root.position.set(c.start.x + c.at, c.start.y, c.start.z);
    c.root.rotation.y = c.heading;
    c.stride += (moving ? 1 : 0) * dt * 7;
    for (const l of c.legs) {
      const p = c.stride + l.phase * Math.PI;
      const swing = moving ? Math.sin(p) * 0.28 : 0;
      const lift = moving ? Math.max(0, Math.cos(p)) * 0.35 : 0;
      l.o.rotation.set(0, l.rest + swing, lift);
    }
    if (c.key && moving) c.key.rotation.y += dt * 3;
    c.root.position.y += moving ? Math.abs(Math.sin(c.stride * 2)) * 0.008 : 0; // a tick in its step
  }

  /** Down, a bob on the stretch of the thread, a turn or two hanging there, and back up in hitches. */
  private spider(s: Spider, dt: number, t: number) {
    s.t += dt;
    const p = Math.min(1, s.t / s.span);
    if (s.state === 'waiting') {
      if (p >= 1) this.next(s, 'dropping', s.drop / rand(0.8, 1.1));
    } else if (s.state === 'dropping') {
      s.at = s.from + (s.drop - s.from) * (1 - (1 - p) ** 2.4); // lets go, then brakes
      if (p >= 1) this.next(s, 'hanging', rand(5, 10));
    } else if (s.state === 'hanging') {
      const k = s.t;
      s.at = s.drop * (1 + 0.06 * Math.exp(-k * 2.5) * Math.sin(k * 10)); // the thread gives, and settles
      s.spin = THREE.MathUtils.damp(s.spin, Math.sin(k * 0.6) * 1.2, 2, dt);
      s.body.rotation.y += s.spin * dt;
      if (p >= 1) this.next(s, 'climbing', s.drop / 0.32);
    } else {
      // hand over hand: a quick pull, a rest, and again
      const hitch = 0.55;
      const n = Math.floor(s.t / hitch);
      const f = Math.min(1, (s.t % hitch) / 0.3);
      const per = (hitch / s.span) * (s.from - TUCKED);
      s.at = Math.max(TUCKED, s.from - per * (n + smooth(f)));
      s.body.rotation.z = f < 1 ? Math.sin(t * 38) * 0.14 : 0;
      if (s.at <= TUCKED) this.next(s, 'waiting', rand(7, 16));
    }
    this.place(s);
    // a little swing on the thread while it's out, round its anchor
    const out = (s.at - TUCKED) / (s.drop - TUCKED);
    s.root.rotation.set(Math.sin(t * 1.4 + s.drop) * 0.05 * out, 0, Math.sin(t * 1.1) * 0.06 * out);
  }

  private next(s: Spider, state: Spider['state'], span: number) {
    Object.assign(s, { state, t: 0, span, from: s.at });
    s.body.rotation.z = 0;
  }

  private place(s: Spider) {
    s.thread.scale.y = s.at;
    s.body.position.y = -s.at;
  }

  /** After dark: there a while, drifting and bobbing, its hem stirring; then fades, and comes back later. */
  private ghost(g: Ghost, dt: number, t: number, night: number) {
    g.left -= dt;
    if (g.left <= 0) {
      g.coming = !g.coming && night > 0.5;
      g.left = g.coming ? rand(14, 24) : rand(10, 22);
    }
    if (night < 0.4) g.coming = false; // morning: gone
    g.shown = THREE.MathUtils.clamp(g.shown + (g.coming ? dt : -dt) / 2.2, 0, 1);
    g.root.visible = g.shown > 0;
    if (!g.root.visible) return;
    const k = t * 0.25 + g.seed;
    const { rest, range } = g;
    g.last.copy(g.root.position);
    g.root.position.set(
      rest.x + range.x * Math.sin(k * 0.5),
      rest.y + range.y * Math.sin(k * 0.9 + 1) + 0.07 * Math.sin(t * 1.8) - (1 - smooth(g.shown)) * 0.4,
      rest.z + range.z * Math.sin(k * 0.7 + 2),
    );
    // leaning into where it's going, turning a little to look about
    const vx = (g.root.position.x - g.last.x) / dt;
    g.root.rotation.set(0, Math.sin(k * 0.8) * 0.5, -vx * 0.35);
    const hem = g.root.children[0];
    if (hem) hem.scale.set(1 + Math.sin(t * 3.1) * 0.04, 1 + Math.sin(t * 2.3) * 0.05, 1 + Math.sin(t * 3.1 + 1.5) * 0.04);
    this.fade(g);
  }

  private fade(g: Ghost) {
    for (const m of g.materials) m.opacity = 0.8 * smooth(g.shown);
  }
}
