import * as THREE from 'three';
import type { Ground } from './beike';
import { occasions } from './calendar';
import { Body, type Call } from './fauna';
import type { Particles } from './particles';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const clamp = THREE.MathUtils.clamp;
const smooth = (k: number) => THREE.MathUtils.smoothstep(k, 0, 1);
/** Up past 1 and settling back: a toadstool pushing up out of the grass. */
const overshoot = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2);
/** Blender's (east, north) to a point in the scene (east, up, south). */
const B = (x: number, y: number) => V(x, 0, -y);
const headingOf = (dx: number, dz: number) => Math.atan2(-dz, dx);
/** Face along a heading, then pitch and roll (the models face +x). */
const orient = (o: THREE.Object3D, heading: number, pitch = 0, roll = 0) => o.rotation.set(roll, heading, pitch, 'YZX');

/** Where they dance: on the top of the beach just east of the pier, where the grass gives way to sand. */
const SHORE = B(4.4, -13.9);
const RING = 1.6; // the ring's radius (tools/models/fae.py)
const PIXIES = ['pixie_rose', 'pixie_blue', 'pixie_gold', 'pixie_green', 'pixie_rose', 'pixie_blue'];
const GLITTER = ['#fff6d8', '#ffd1f0', '#c8f0ff', '#e0ffd0', '#ffe8a0'];
const WISP = ['#c8ffe0', '#b8e8ff', '#e8fff0'];

const WISPS = 8; // seconds for the will-o'-the-wisps to find the place
const RINGING = 5; // for the ring to come up
const COURT = 4; // for the court to arrive
const STARE = 1.8; // everyone looking straight at you, before they go
const PARTING = 5; // bows, and gone, and the ring sinking back into the grass

/** Whether the fair folk are out on this visit: now and then, and always on Midsummer's Eve. */
const LUCK = (() => {
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const wanted = q.get('animal') === 'fae' || q.has('revel');
  return { wanted, tonight: wanted || occasions.has('midsummer') || Math.random() < 1 / 10, again: wanted || occasions.has('midsummer') };
})();

type Phase = 'waiting' | 'wisps' | 'ring' | 'court' | 'revel' | 'stare' | 'parting' | 'gone';
export type Fae = 'oberon' | 'titania' | 'puck' | 'pixie' | 'fairyring';

interface Wisp {
  from: THREE.Vector3;
  via: THREE.Vector3;
  to: THREE.Vector3;
  delay: number;
  at: THREE.Vector3;
}

/**
 * The fair folk's revel. On some evenings and nights (and every Midsummer's Eve), from dusk on,
 * if it's dry, will-o'-the-wisps drift out of the woods and down to the beach by the pier; where
 * they sink into the grass a ring of toadstools comes up, glowing; pixies pop into being round
 * it, and Oberon and Titania shimmer up in the middle. Then the dance: the pixies dance the
 * ring, the King and Queen turn round each other with their hands joined overhead, and Puck
 * cartwheels round the outside, all to a thin, bright tune. After a minute or two they bow and
 * are gone, and the ring sinks back into the grass. They don't mind being looked at, a little;
 * stare (click them three times) and the music stops, every head turns your way, and they
 * vanish on the spot.
 */
export class Revel {
  private ring?: Body;
  private caps: THREE.Object3D[] = [];
  private king?: Body;
  private queen?: Body;
  private puck?: Body;
  private pixies: Body[] = [];
  private scales = new Map<Body, number>();
  private light = new THREE.PointLight('#c8f5dc', 0, 7, 1.4);
  private centre = SHORE.clone();
  private phase: Phase = 'waiting';
  private t = 0;
  private clock = 0;
  private wait = LUCK.wanted ? 6 : rand(40, 200);
  private length = 0; // how long this revel's dance goes on
  private wisps: Wisp[] = [];
  private looks = 0;
  private spin = 0; // how far round the ring the dance has gone
  private tune = 0;
  private sparkle = 0;
  /** The last one someone looked at, and when: they glance back. */
  private glance = { who: null as Fae | null, t: 0 };
  /** Puck's cartwheel (seconds into it, or -1), and a pixie's loop-the-loop. */
  private wheel = -1;
  private nextWheel = rand(4, 8);
  private loop = { i: -1, t: 0 };
  private from = V();
  /** Where they turn to look when you've stared too long. */
  private watcher = V();
  /** A sound from the revel (the island plays it if it's in earshot). */
  onCall?: (call: Call, at: THREE.Vector3, ambient?: boolean, loud?: number) => void;
  /** The revel's over: `stared` if you stared them away. `watched`: whether you'd been looking at them. */
  onEnd?: (stared: boolean, watched: boolean) => void;

  constructor(
    scene: THREE.Scene,
    template: (species: string) => THREE.Object3D | undefined,
    private ground: Ground,
    private particles: Particles,
  ) {
    if (!LUCK.tonight) return;
    const body = (species: string) => {
      const t = template(species);
      if (!t) return undefined;
      const b = new Body(species, t, scene);
      b.root.userData.id = species.startsWith('pixie') ? 'pixie' : species;
      this.scales.set(b, t.scale.x);
      return b;
    };
    this.ring = body('fairyring');
    this.king = body('oberon');
    this.queen = body('titania');
    this.puck = Math.random() < 0.8 || LUCK.wanted ? body('puck') : undefined;
    this.pixies = PIXIES.map(body).filter((b): b is Body => !!b);
    if (!this.ring || !this.king || !this.queen) return;
    this.ring.root.traverse((o) => {
      if (/^fairyring_cap_\d+$/.test(o.name)) this.caps.push(o);
    });
    this.caps.sort((a, b) => Number(a.name.split('_').pop()) - Number(b.name.split('_').pop()));
    const h = ground.at(SHORE.x, SHORE.z);
    this.centre.setY(Number.isNaN(h) ? 1 : h);
    this.light.position.copy(this.centre).add(V(0, 1.2, 0));
    scene.add(this.light);
  }

  /** Everyone in it, for the Picker. */
  get pickables() {
    return [this.ring, this.king, this.queen, this.puck, ...this.pixies].filter((b): b is Body => !!b).map((b) => b.root);
  }

  /** Whether they're out just now. */
  get on() {
    return this.phase !== 'waiting' && this.phase !== 'gone';
  }

  /** Straight to it: for previews (?revel). */
  soon() {
    this.wait = Math.min(this.wait, 6);
  }

  /**
   * Someone clicked one of them, looking from `from`: the one looked at glances back (and does
   * its thing), and the third look is a stare. Returns whether that was the stare.
   */
  poke(who: Fae, from: THREE.Vector3): boolean {
    if (this.phase !== 'ring' && this.phase !== 'court' && this.phase !== 'revel') return false;
    this.looks++;
    this.watcher.copy(from);
    if (this.looks >= 3 && this.phase === 'revel') {
      this.phase = 'stare';
      this.t = 0;
      return true;
    }
    this.glance = { who, t: this.clock };
    const at = this.bodyOf(who)?.root.position ?? this.centre;
    if (who === 'puck' && this.wheel < 0) {
      this.wheel = 0;
      this.onCall?.('giggle', at.clone());
    } else if (who === 'pixie') {
      this.loop = { i: Math.floor(Math.random() * this.pixies.length), t: 0 };
      this.onCall?.('twinkle', at.clone());
    } else if (who === 'titania') {
      this.burst(at.clone().add(V(0, 1.4, 0)), 24, 1.2);
      this.onCall?.('shimmer', at.clone());
    } else this.onCall?.('twinkle', at.clone());
    return false;
  }

  private bodyOf(who: Fae) {
    return who === 'oberon' ? this.king : who === 'titania' ? this.queen : who === 'puck' ? this.puck : who === 'fairyring' ? this.ring : this.pixies[0];
  }

  /** `night`: how dark it is (the Sky's lamps: dusk is about 0.3). `wet`: how wet it is. `hour`: island time, 0..24. */
  update(dt: number, night: number, wet: number, hour: number) {
    const ring = this.ring;
    if (!ring || !this.king || !this.queen) return;
    this.clock += dt;
    this.t += dt;
    const evening = hour >= 16 || hour < 4; // from dusk on, and on into the night (but not at dawn)
    const fair = (night > 0.3 && evening && wet < 0.25) || LUCK.wanted;
    switch (this.phase) {
      case 'waiting':
        if (!fair || (this.wait -= dt) > 0) return;
        this.begin();
        break;
      case 'wisps':
        if (this.t >= WISPS) this.next('ring');
        break;
      case 'ring':
        if (this.t >= RINGING) this.next('court');
        break;
      case 'court':
        if (this.t >= COURT) this.next('revel');
        break;
      case 'revel':
        // the rain puts a stop to it (and dawn, if it comes to that)
        if (this.t >= this.length || (!fair && this.t > 10)) this.next('parting');
        break;
      case 'stare':
        if (this.t >= STARE) this.vanish(true);
        break;
      case 'parting':
        if (this.t >= PARTING) this.vanish(false);
        break;
      case 'gone':
        if (!LUCK.again || (this.wait -= dt) > 0) return;
        this.phase = 'waiting';
        return;
    }
    if ((this.phase as Phase) === 'gone') return;
    this.animate(dt);
  }

  private next(phase: Phase) {
    this.phase = phase;
    this.t = 0;
    if (phase === 'court') {
      for (const b of this.dancers()) {
        b.show(this.centre);
        b.root.scale.setScalar(0.001); // each comes into being on its cue
      }
    }
    if (phase === 'revel') this.tune = 0;
    if (phase === 'parting') this.onCall?.('hush', this.centre.clone(), true);
  }

  private begin() {
    this.phase = 'wisps';
    this.t = 0;
    this.looks = 0;
    this.spin = rand(0, Math.PI * 2);
    this.length = LUCK.wanted ? 70 : rand(80, 110);
    this.ring!.show(this.centre);
    for (const b of this.dancers()) {
      delete b.root.userData.popped;
      delete b.root.userData.poof;
    }
    // down out of the trees inland, and in along the shore from either side
    const outs = [0.2, 0.7, 1.3, 1.9, 2.5, 2.95];
    this.wisps = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + rand(-0.3, 0.3);
      const out = outs[(i + Math.floor(rand(0, outs.length))) % outs.length] + rand(-0.15, 0.15);
      const far = rand(7, 10);
      const from = this.centre.clone().add(V(Math.cos(out) * far, rand(0.6, 1.4), -Math.sin(out) * far * 0.7));
      const to = this.onGround(this.centre.x + Math.cos(a) * RING, this.centre.z + Math.sin(a) * RING).add(V(0, 0.25, 0));
      const via = from.clone().lerp(to, 0.5).add(V(rand(-2, 2), rand(0.8, 1.6), rand(-1.5, 1.5)));
      return { from, via, to, delay: rand(0, 2.5), at: from.clone() };
    });
  }

  /** Gone: all at once in a flurry of glitter if they were stared at, or one by one after their bows. */
  private vanish(stared: boolean) {
    if (stared) {
      for (const b of this.dancers()) this.burst(b.root.position.clone().add(V(0, 0.6, 0)), 30, 1.6);
      this.onCall?.('hush', this.centre.clone());
    }
    for (const b of [this.ring, ...this.dancers()]) b?.hide();
    this.light.intensity = 0;
    this.phase = 'gone';
    this.wait = rand(240, 480);
    this.onEnd?.(stared, this.looks > 0);
  }

  private dancers() {
    return [this.king, this.queen, this.puck, ...this.pixies].filter((b): b is Body => !!b);
  }

  private burst(at: THREE.Vector3, n: number, speed = 1) {
    for (let i = 0; i < n; i++) {
      const v = V(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.4, 1.2) * speed);
      this.particles.emit({ position: at.clone(), velocity: v, color: pick(GLITTER), life: rand(0.6, 1.3), drag: 2, gravity: -0.4, fadeIn: 0 });
    }
  }

  /** How far each part of the court has come into being, 0..1, for this frame. */
  private presence() {
    const t = this.t;
    switch (this.phase) {
      case 'wisps':
        return { caps: this.caps.map(() => 0), pixies: 0, court: 0, puck: 0, leaving: 0 };
      case 'ring':
        return { caps: this.caps.map((_, i) => overshoot(clamp((t - (i / this.caps.length) * (RINGING - 1)) / 0.6, 0, 1))), pixies: 0, court: 0, puck: 0, leaving: 0 };
      case 'court':
        return { caps: this.caps.map(() => 1), pixies: clamp(t / 1.8, 0, 1), court: smooth(clamp((t - 2.2) / 1.2, 0, 1)), puck: clamp((t - 3) / 0.4, 0, 1), leaving: 0 };
      case 'parting': {
        const n = this.caps.length;
        return { caps: this.caps.map((_, i) => 1 - smooth(clamp((t - 2 - ((n - i) / n) * 2.4) / 0.5, 0, 1))), pixies: 1, court: 1, puck: 1, leaving: t };
      }
      default:
        return { caps: this.caps.map(() => 1), pixies: 1, court: 1, puck: 1, leaving: 0 };
    }
  }

  private animate(dt: number) {
    const c = this.centre;
    const t = this.t;
    const clock = this.clock;
    const p = this.presence();
    const dancing = this.phase === 'revel' || this.phase === 'parting' ? 1 : this.phase === 'court' ? p.court : 0;
    const frozen = this.phase === 'stare';
    if (!frozen) this.spin += dt * 0.55 * dancing;
    // the ring's glow on the grass: up with the toadstools, breathing with the tune
    const lit = this.phase === 'wisps' ? 0 : p.caps.reduce((a, b) => a + b, 0) / this.caps.length;
    this.light.intensity = lit * (1.6 + Math.sin(clock * 2.1) * 0.25) * (frozen ? 0.6 : 1);

    // the will-o'-the-wisps, drifting in and sinking into the grass where the ring will be
    if (this.phase === 'wisps') {
      for (const w of this.wisps) {
        const k = smooth(clamp((t - w.delay) / (WISPS - 2.5), 0, 1));
        const a = w.from.clone().multiplyScalar((1 - k) ** 2).addScaledVector(w.via, 2 * (1 - k) * k).addScaledVector(w.to, k * k);
        a.y += Math.sin(clock * 3 + w.delay * 5) * 0.12 * (1 - k);
        w.at.copy(a);
        if (k < 1 || Math.random() < 0.3) {
          this.particles.emit({ position: a.clone().add(V(rand(-0.05, 0.05), rand(-0.05, 0.05), rand(-0.05, 0.05))), velocity: V(0, rand(0.02, 0.15), 0), color: pick(WISP), life: rand(0.4, 0.8), size: Math.random() < 0.4 ? 2 : 1, fadeIn: 0 });
        }
      }
    }

    // the ring, coming up one toadstool at a time (and a puff of glitter as each breaks the grass)
    const ring = this.ring!;
    ring.relax();
    ring.root.position.copy(c);
    this.caps.forEach((cap, i) => {
      const k = p.caps[i];
      const was = cap.userData.up ?? 0;
      cap.scale.setScalar(Math.max(0.001, k));
      cap.position.y = this.onGround(c.x + cap.position.x, c.z + cap.position.z).y - c.y; // the beach slopes
      cap.visible = k > 0.01;
      if (was < 0.05 && k >= 0.05 && this.phase === 'ring') {
        this.burst(cap.getWorldPosition(V()).add(V(0, 0.1, 0)), 5, 0.5);
        if (i % 3 === 0) this.onCall?.('twinkle', c.clone(), true, 0.6);
      }
      cap.userData.up = k;
    });

    // the pixies, dancing the ring: hopping steps round it, a little way in from the toadstools
    const n = this.pixies.length;
    this.pixies.forEach((b, i) => {
      const s0 = this.scales.get(b)!;
      const into = clamp(p.pixies * n - i, 0, 1); // popping in one after another
      const gone = this.phase === 'parting' ? clamp((t - 0.8 - i * 0.2) / 0.3, 0, 1) : 0;
      const k = into * (1 - gone);
      if (k <= 0.001) {
        if (gone > 0 && b.shown) b.hide();
        return;
      }
      if (!b.root.userData.popped) {
        b.root.userData.popped = true;
        this.burst(b.root.position.clone().add(V(0, 0.2, 0)), 8, 0.6);
        this.onCall?.('twinkle', c.clone(), true, 0.5);
      }
      if (gone > 0 && !b.root.userData.poof) {
        b.root.userData.poof = true;
        this.burst(b.root.position.clone().add(V(0, 0.2, 0)), 10, 0.8);
      }
      b.relax();
      const a = this.spin + (i / n) * Math.PI * 2;
      const r = RING - 0.35 + Math.sin(a * 3 + clock) * 0.06;
      const hop = frozen ? 0.25 : 0.2 + Math.abs(Math.sin(clock * 4.4 + i * 1.3)) * 0.14 * dancing;
      let lift = hop;
      let pitch = 0;
      if (this.loop.i === i) {
        // loop-the-loop, trailing sparks
        const lt = (this.loop.t += dt) / 0.9;
        if (lt >= 1) this.loop.i = -1;
        else {
          lift += (1 - Math.cos(lt * Math.PI * 2)) * 0.45;
          pitch = lt * Math.PI * 2;
          this.particles.emit({ position: b.root.position.clone().add(V(0, 0.15, 0)), velocity: V(0, 0, 0), color: pick(GLITTER), life: 0.5, fadeIn: 0 });
        }
      }
      b.root.position.copy(this.onGround(c.x + Math.cos(a) * r, c.z - Math.sin(a) * r)).y += lift;
      const heading = frozen ? this.facing(b) : a + Math.PI / 2; // along the ring, anticlockwise from above
      orient(b.root, heading, pitch + (this.phase === 'parting' && t < 1.6 ? -0.4 * Math.sin((t / 1.6) * Math.PI) : 0));
      b.root.scale.setScalar(s0 * k);
      const beat = frozen ? 0.1 : Math.sin(clock * 38 + i) * 0.7;
      const [l, rr] = [b.part('wing_l'), b.part('wing_r')];
      if (l) l.rotation.z += beat;
      if (rr) rr.rotation.z -= beat;
      if (!frozen && Math.random() < dt * 3) {
        this.particles.emit({ position: b.root.position.clone().add(V(rand(-0.05, 0.05), 0.12, rand(-0.05, 0.05))), velocity: V(0, rand(-0.1, 0.05), 0), color: pick(GLITTER), life: rand(0.4, 0.8), fadeIn: 0 });
      }
    });

    // Oberon and Titania in the middle, turning round each other, hands joined over their heads
    const court = [this.king!, this.queen!];
    const turn = this.spin * 0.6;
    court.forEach((b, i) => {
      const s0 = this.scales.get(b)!;
      const gone = this.phase === 'parting' ? smooth(clamp((t - 2.2) / 0.8, 0, 1)) : 0;
      const k = p.court * (1 - gone);
      if (k <= 0.001) {
        if (gone >= 1 && b.shown) {
          b.hide();
          this.burst(c.clone().add(V(0, 1, 0)), 20, 1);
        }
        if (this.phase === 'court' && t > 1.4 && t < 2.2) this.column(c);
        return;
      }
      if (this.phase === 'court' && t < 3.4) this.column(c);
      if (this.phase === 'parting' && t > 1.8 && t < 3) this.column(c);
      b.relax();
      const a = turn + i * Math.PI;
      const r = 0.42;
      const float = i === 1 ? 0.04 + Math.sin(clock * 1.6) * 0.03 : 0;
      b.root.position.copy(this.onGround(c.x + Math.cos(a) * r, c.z - Math.sin(a) * r)).y += float + Math.abs(Math.sin(clock * 2.2 + i * Math.PI)) * 0.03 * dancing;
      const toCentre = headingOf(c.x - b.root.position.x, c.z - b.root.position.z);
      const bow = this.phase === 'parting' && t < 2.2 ? Math.sin(clamp(t / 2, 0, 1) * Math.PI) * 0.35 : 0;
      orient(b.root, frozen ? this.facing(b) : toCentre, -bow);
      // shimmering up out of nothing: tall and thin first, then filling out
      b.root.scale.set(s0 * Math.sqrt(k), s0 * k, s0 * Math.sqrt(k));
      const raise = frozen ? 0.2 : dancing * (this.phase === 'parting' ? Math.max(0, 1 - t) : 1);
      // face to face, his left hand and her right go up to meet in the middle; the others are held out
      const inner = b.part(i === 0 ? 'arm_l' : 'arm_r');
      const outer = b.part(i === 0 ? 'arm_r' : 'arm_l');
      if (inner) inner.rotation.y -= 2.3 * raise;
      if (outer) outer.rotation.x += (i === 0 ? -1 : 1) * (0.5 + Math.sin(clock * 1.1 + i) * 0.15) * raise;
      const head = b.part('head');
      const who = i === 0 ? 'oberon' : 'titania';
      if (head && this.glance.who === who && clock - this.glance.t < 2.5) {
        // a look your way (and a slight nod), then back to the dance
        const k2 = Math.sin(((clock - this.glance.t) / 2.5) * Math.PI);
        const to = headingOf(this.watcher.x - b.root.position.x, this.watcher.z - b.root.position.z);
        head.rotation.y += Math.atan2(Math.sin(to - toCentre), Math.cos(to - toCentre)) * 0.7 * k2;
        head.rotation.z -= 0.15 * k2;
      }
      if (i === 1) {
        const wing = frozen ? 0 : Math.sin(clock * 3.2) * 0.25;
        const l = b.part('wing_l');
        const rr = b.part('wing_r');
        if (l) l.rotation.z += wing;
        if (rr) rr.rotation.z -= wing;
      }
    });

    // Puck, the wrong way round the outside, bounding, and now and then a cartwheel
    const puck = this.puck;
    if (puck) {
      const s0 = this.scales.get(puck)!;
      const gone = this.phase === 'parting' ? clamp((t - 0.4) / 0.3, 0, 1) : 0;
      const k = p.puck * (1 - gone);
      if (k <= 0.001) {
        if (gone > 0 && puck.shown) {
          this.burst(puck.root.position.clone().add(V(0, 0.4, 0)), 12, 0.8);
          puck.hide();
        }
      } else {
        if (this.phase === 'court' && !puck.root.userData.popped) {
          puck.root.userData.popped = true;
          this.burst(c.clone().add(V(0, 0.4, 0)), 14, 1);
          this.onCall?.('giggle', c.clone(), true, 0.6);
        }
        puck.relax();
        const a = -this.spin * 1.3 + 1;
        const r = RING + 0.6;
        if (!frozen && this.phase === 'revel' && this.wheel < 0 && (this.nextWheel -= dt) < 0) this.wheel = 0;
        let roll = 0;
        let lift = frozen ? 0 : Math.abs(Math.sin(clock * 5)) * 0.12 * dancing;
        if (this.wheel >= 0 && !frozen) {
          const w = (this.wheel += dt) / 0.8;
          if (w >= 1) {
            this.wheel = -1;
            this.nextWheel = rand(5, 10);
          } else {
            roll = w * Math.PI * 2;
            lift = ((1 - Math.cos(roll)) / 2) * 0.8 + Math.sin(w * Math.PI) * 0.25; // over his own middle
          }
        }
        const x = c.x + Math.cos(a) * r;
        const z = c.z - Math.sin(a) * r;
        puck.root.position.copy(this.onGround(x, z)).y += lift;
        orient(puck.root, frozen ? this.facing(puck) : a - Math.PI / 2, 0, roll);
        puck.root.scale.setScalar(s0 * k);
        const arms = frozen ? 0 : dancing;
        const [l, rr] = [puck.part('arm_l'), puck.part('arm_r')];
        if (l) l.rotation.x += (1.2 + Math.sin(clock * 5) * 0.4) * arms;
        if (rr) rr.rotation.x -= (1.2 + Math.sin(clock * 5 + 1) * 0.4) * arms;
        const head = puck.part('head');
        if (head && !frozen) head.rotation.z += Math.sin(clock * 5) * 0.1;
      }
    }

    // the tune, and glitter rising off the ring
    if (this.phase === 'revel' && (this.tune -= dt) < 0) {
      this.tune = 3.2;
      this.onCall?.('reel', c.clone(), true);
    }
    if (!frozen && lit > 0.5 && (this.sparkle -= dt) < 0) {
      this.sparkle = 0.06;
      const a = rand(0, Math.PI * 2);
      const r = rand(0, RING + 0.2);
      this.particles.emit({ position: c.clone().add(V(Math.cos(a) * r, rand(0.05, 0.3), Math.sin(a) * r)), velocity: V(rand(-0.05, 0.05), rand(0.25, 0.6), rand(-0.05, 0.05)), color: pick(GLITTER), life: rand(1.2, 2.2), wobble: 0.3, fadeIn: 0.3 });
    }
  }

  /** The point on the ground at (x, z). */
  private onGround(x: number, z: number) {
    const h = this.ground.at(x, z);
    return V(x, Number.isNaN(h) ? this.centre.y : h, z);
  }

  /** The heading that looks at whoever's been staring (from where the camera was). */
  private facing(b: Body) {
    return headingOf(this.watcher.x - b.root.position.x, this.watcher.z - b.root.position.z);
  }

  /** A column of glitter where the King and Queen come (and go). */
  private column(c: THREE.Vector3) {
    for (let i = 0; i < 2; i++) {
      const a = rand(0, Math.PI * 2);
      this.particles.emit({ position: c.clone().add(V(Math.cos(a) * 0.5, rand(0, 0.4), Math.sin(a) * 0.5)), velocity: V(-Math.cos(a) * 0.2, rand(0.8, 1.6), -Math.sin(a) * 0.2), color: pick(GLITTER), life: rand(0.8, 1.4), fadeIn: 0 });
    }
  }
}
