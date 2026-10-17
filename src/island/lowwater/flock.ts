/**
 * Knots: a few hundred of them (a real flock would be thousands), over the far flat in autumn and
 * winter. Now and then they get up off a far bank, wheel for a minute or so, and go down again
 * somewhere else.
 *
 * Nothing about the flock's shape is drawn. Each bird keeps with its seven nearest (by rank, not
 * by distance, as starlings were found to), keeps its own room, and holds its speed; all the
 * flock is told is roughly where to be. The shape, the dense bands as it turns edge-on and the
 * flashes when a turn runs through it are what comes of that. A bird banking shows you its back
 * or its white belly, so a turn goes through the flock as a wave of light.
 *
 * It's a sky thing, fixed to the view as the moon and the island in the east are: the flock's
 * three hundred metres off, so walking doesn't move it.
 */
import * as THREE from 'three';

/** Birds, and how many each keeps with. */
const N = 520;
const K = 7;
/** How far off the flock is (m), how wide it roams either side, and how high it flies (m). */
const FAR = 330;
const ROAM = 52;
const HIGH: [number, number] = [4, 9];
/** View heights to a degree (the island in the east has 0.3: this is less magnified, it's nearer). */
const SCALE = 0.055;
/** Their cruising speed (m/s), and the room each keeps (m). */
const SPEED = 15;
const ROOM = 1.15;
/** Up for this long (s), then down for this long, after the first. */
const UP: [number, number] = [65, 95];
const DOWN: [number, number] = [150, 290];
const FIRST: [number, number] = [18, 36];
const STEP = 1 / 30;
const G = 9.8;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Flock {
  /** The birds, and their mirror in the water: picture coordinates, written each frame by `place`. */
  readonly birds: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly mirror: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private p = new Float32Array(N * 3);
  private v = new Float32Array(N * 3);
  private bank = new Float32Array(N);
  /** Down on the bank again, at the end of a flight. */
  private down = new Uint8Array(N);
  private near = new Int32Array(N * K);
  private shade: THREE.BufferAttribute;
  private mirrorShade: THREE.BufferAttribute;
  /** Where the flock's being drawn to (m), and where it goes after. */
  private aim = new THREE.Vector3();
  private aimNext = new THREE.Vector3();
  private aimFor = 0;
  /** Up and flying, how long it's been (s) and how long it'll be; or down, how long till they get up. */
  private flying = false;
  private flown = 0;
  private flight = 0;
  private wait = rand(...FIRST);
  private settling = false;
  private acc = 0;
  private turn = 0;
  /** How much of it can be seen (0 … 1), how hard it's turning (0 … 1), and where its middle is across the picture (a share of the width). */
  seen = 0;
  turning = 0;
  across = 0;
  /** Its extent on the picture, across (shares of the width) and up (view heights over the horizon). */
  box = new THREE.Box2();
  /** Seconds since it got up (99 while it's down). */
  upFor = 99;

  constructor() {
    const make = (mirror: boolean) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
      geo.setAttribute('shade', new THREE.Float32BufferAttribute(new Float32Array(N), 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uFade: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float shade;
          varying float vShade;
          void main() {
            vShade = shade;
            gl_PointSize = 1.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        // three tones only: a back seen edge-on, a grey back, a white belly with the last light on it;
        // in the water, each a step towards the water's own blue
        fragmentShader: /* glsl */ `
          uniform float uFade;
          varying float vShade;
          void main() {
            if (vShade < 0.0) discard;
            vec3 c = vShade > 1.5 ? vec3(0.6, 0.5, 0.56) : vShade > 0.5 ? vec3(0.09, 0.085, 0.17) : vec3(0.022, 0.02, 0.06); // (linear: these go out as sRGB)
            ${mirror ? 'c = mix(c, vec3(0.06, 0.08, 0.2), 0.35) * 0.85;' : ''}
            // (fading, the furthest-off go first, in a dither)
            if (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > uFade) discard;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        depthWrite: false,
        fog: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = mirror ? 4 : 2;
      pts.visible = false;
      return pts;
    };
    this.birds = make(false);
    this.mirror = make(true);
    this.shade = this.birds.geometry.getAttribute('shade') as THREE.BufferAttribute;
    this.mirrorShade = this.mirror.geometry.getAttribute('shade') as THREE.BufferAttribute;
  }

  /** A point over the far flat to be drawn to (m). */
  private somewhere(low = false) {
    return new THREE.Vector3(rand(-ROAM, ROAM), low ? -3 : rand(...HIGH), FAR + rand(-25, 40));
  }

  /** They get up off a far bank, off to one side, all together. */
  private getUp() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const from = new THREE.Vector3(side * rand(ROAM * 0.5, ROAM * 1.1), -1.5, FAR + rand(0, 50));
    const off = new THREE.Vector3(-side, 0.35, rand(-0.3, 0.3)).normalize();
    for (let i = 0; i < N; i++) {
      // a low loose carpet, as they were on the bank, lifting off along it
      const r = Math.sqrt(Math.random()) * 9;
      const a = Math.random() * Math.PI * 2;
      this.p.set([from.x + Math.cos(a) * r * 1.8, from.y + Math.random() * 0.6, from.z + Math.sin(a) * r], i * 3);
      const s = SPEED * rand(0.85, 1.05);
      this.v.set([off.x * s + rand(-1, 1), off.y * s + rand(0, 1.5), off.z * s + rand(-1, 1)], i * 3);
      this.bank[i] = 0;
      this.down[i] = 0;
    }
    this.aim.set(-side * rand(0, ROAM * 0.6), rand(...HIGH), FAR + rand(-10, 30));
    this.aimNext.copy(this.somewhere());
    this.aimFor = rand(6, 10);
    this.flying = true;
    this.settling = false;
    this.flown = 0;
    this.flight = rand(...UP);
    this.upFor = 0;
    this.neighbours(0, N);
  }

  /** Each bird's seven nearest, for the birds from `a` to `b` (a share each frame, not all of them). */
  private neighbours(a: number, b: number) {
    const p = this.p;
    const best = new Float32Array(K);
    for (let i = a; i < b; i++) {
      best.fill(Infinity);
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const dx = p[j * 3] - x, dy = p[j * 3 + 1] - y, dz = p[j * 3 + 2] - z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d >= best[K - 1]) continue;
        let k = K - 1;
        while (k > 0 && best[k - 1] > d) {
          best[k] = best[k - 1];
          this.near[i * K + k] = this.near[i * K + k - 1];
          k--;
        }
        best[k] = d;
        this.near[i * K + k] = j;
      }
    }
  }

  /**
   * On, or off: whether knots are here at all (autumn to spring) and whether you could see them
   * (not at night, nor in rain, fog or a gale). A flight that's up when it turns finishes as it was.
   */
  update(dt: number, here: boolean) {
    if (!this.flying) {
      this.upFor = 99;
      this.seen = Math.max(0, this.seen - dt);
      this.birds.visible = this.mirror.visible = false;
      if (!here) return;
      this.wait -= dt;
      if (this.wait <= 0) this.getUp();
      else return;
    }
    this.upFor += dt;
    this.acc += Math.min(dt, 0.1);
    let steps = 0;
    while (this.acc >= STEP && steps++ < 3) {
      this.acc -= STEP;
      this.tick();
    }
    if (this.acc > STEP) this.acc = 0;
  }

  private tick() {
    const p = this.p, v = this.v;
    this.flown += STEP;
    // where to be: drawn from one point to the next over the far flat, then, at the end, down
    this.aimFor -= STEP;
    if (this.aimFor <= 0) {
      this.aimNext.copy(this.somewhere());
      this.aimFor = rand(5, 11);
      // (and now and then a sharp turn, all at once: something's put them up again)
      if (Math.random() < 0.35) this.aim.x = THREE.MathUtils.clamp(-this.aim.x * 1.3, -ROAM, ROAM);
    }
    if (!this.settling && this.flown > this.flight) {
      this.settling = true;
      this.aimNext.copy(this.somewhere(true));
      this.aimNext.x = (this.aimNext.x > 0 ? 1 : -1) * rand(ROAM * 0.4, ROAM);
    }
    this.aim.lerp(this.aimNext, 1 - Math.exp(-STEP / (this.settling ? 4 : 2.5)));
    // (a share of them find their neighbours again each tick)
    const share = Math.ceil(N / 4);
    const from = (Math.round(this.flown / STEP) % 4) * share;
    this.neighbours(from, Math.min(N, from + share));
    let mx = 0, my = 0, mz = 0, mvx = 0, mvy = 0, mvz = 0;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      (mx += p[o]), (my += p[o + 1]), (mz += p[o + 2]);
      (mvx += v[o]), (mvy += v[o + 1]), (mvz += v[o + 2]);
    }
    (mx /= N), (my /= N), (mz /= N), (mvx /= N), (mvy /= N), (mvz /= N);
    // roughly where the flock's meant to be (they each know that much): across, a way to be
    // going, towards it; up and down, a height to be at, not overshooting it
    const toward = new THREE.Vector2(this.aim.x - mx, this.aim.z - mz);
    const far = toward.length();
    toward.multiplyScalar((SPEED * Math.min(1, far / 12)) / (far || 1));
    const pull = new THREE.Vector3((toward.x - mvx) * 0.75, (this.aim.y - my) * 0.5 - mvy * 1.1, (toward.y - mvz) * 0.75);
    const acc = new THREE.Vector3();
    const vel = new THREE.Vector3();
    let turn = 0;
    let gone = 0;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      if (this.down[i]) {
        gone++;
        continue;
      }
      const x = p[o], y = p[o + 1], z = p[o + 2];
      vel.set(v[o], v[o + 1], v[o + 2]);
      acc.set(0, 0, 0);
      let ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < K; k++) {
        const j = this.near[i * K + k] * 3;
        const dx = p[j] - x, dy = p[j + 1] - y, dz = p[j + 2] - z;
        cx += dx;
        cy += dy;
        cz += dz;
        ax += v[j];
        ay += v[j + 1];
        az += v[j + 2];
        // its own room: away from any too near
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < ROOM * ROOM) {
          const d = Math.sqrt(d2) + 0.05;
          const push = (ROOM - d) / d;
          acc.x -= dx * push * 14;
          acc.y -= dy * push * 14;
          acc.z -= dz * push * 14;
        }
      }
      // with its seven: the way they're going, and towards them
      acc.x += (ax / K - vel.x) * 2.2 + (cx / K) * 0.9;
      acc.y += (ay / K - vel.y) * 2.2 + (cy / K) * 0.9;
      acc.z += (az / K - vel.z) * 2.2 + (cz / K) * 0.9;
      // and roughly where the flock's meant to be (they each know that much)
      acc.add(pull);
      // (and none strays far from the rest: a bird out on the edge turns back in)
      acc.x += (mx - x) * 0.2 - (vel.x - mvx) * 0.4;
      acc.y += (my - y) * 0.6 - (vel.y - mvy) * 0.8;
      acc.z += (mz - z) * 0.2 - (vel.z - mvz) * 0.4;
      // not into the water, while they're up
      if (!this.settling && y < 2) acc.y += (2 - y) * 3;
      // holding its speed
      const s = vel.length() || 1;
      acc.addScaledVector(vel, ((this.settling ? SPEED * 0.8 : SPEED) - s) * 0.9 / s);
      vel.addScaledVector(acc, STEP);
      // (no faster than a knot flies, nor so slow it falls)
      const s2 = vel.length();
      if (s2 > SPEED * 1.35) vel.multiplyScalar((SPEED * 1.35) / s2);
      if (s2 < SPEED * 0.55) vel.multiplyScalar((SPEED * 0.55) / s2);
      vel.y = THREE.MathUtils.clamp(vel.y, -SPEED * 0.45, SPEED * 0.45);
      // banking into the turn: the sideways part of its acceleration, against gravity
      const side = new THREE.Vector3().crossVectors(vel, new THREE.Vector3(0, 1, 0)).normalize();
      const lateral = acc.dot(side);
      // (and each a little on its own, so a turn goes through the flock rather than all at once)
      const want = Math.atan2(-lateral, G) + 0.22 * Math.sin(this.flown * (1.1 + (i % 7) * 0.13) + i * 2.399);
      this.bank[i] += (THREE.MathUtils.clamp(want, -1.3, 1.3) - this.bank[i]) * (1 - Math.exp(-STEP / 0.12));
      turn += Math.abs(this.bank[i]);
      v[o] = vel.x;
      v[o + 1] = vel.y;
      v[o + 2] = vel.z;
      p[o] += vel.x * STEP;
      p[o + 1] += vel.y * STEP;
      p[o + 2] += vel.z * STEP;
      if (this.settling && p[o + 1] < -0.5) (this.down[i] = 1), gone++;
    }
    this.turn = turn / N;
    // down: once they're all in under the horizon, they're on the bank, and it's quiet till next time
    if (this.settling && (gone > N * 0.97 || this.flown > this.flight + 30)) {
      this.flying = false;
      this.wait = rand(...DOWN);
    }
  }

  /**
   * Into the picture: camera space, the horizon at `hy`, `hz` (the sky just behind it), and the
   * water's surface running from there to (`ty`, `tz`), so each bird's reflection is on it. `view`
   * is the picture's height (m), `aspect` its shape, `eye` how high you're looking from (m).
   * `fade` (0 … 1) takes the whole flock into the weather.
   */
  place(view: number, aspect: number, hy: number, hz: number, ty: number, tz: number, eye: number, fade: number) {
    if (!this.flying) return;
    const scale = (SCALE * 180) / Math.PI * Math.min(1, aspect / 1.3);
    const bp = this.birds.geometry.getAttribute('position') as THREE.BufferAttribute;
    const mp = this.mirror.geometry.getAttribute('position') as THREE.BufferAttribute;
    const p = this.p, v = this.v;
    const toEye = new THREE.Vector3();
    const up = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const side = new THREE.Vector3();
    let shown = 0;
    let sx = 0;
    this.box.makeEmpty();
    const width = aspect;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      const z = Math.max(40, p[o + 2]);
      const across = (p[o] / z) * scale;
      const a = ((p[o + 1] - eye) / z) * scale;
      // (mirrored about the drawn horizon, as the sky is in the water)
      const aMirror = -a;
      bp.setXYZ(i, across * view, hy + a * view, hz - 0.2);
      // (the water's surface where its reflection lands, a hair nearer than it)
      const my = hy + aMirror * view;
      mp.setXYZ(i, across * view, my, tz + ((my - ty) * (hz - tz)) / (hy - ty) + 0.02);
      // what you see of it: its white belly, its grey back, or an edge
      fwd.set(v[o], v[o + 1], v[o + 2]).normalize();
      side.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      up.crossVectors(side, fwd).applyAxisAngle(fwd, this.bank[i]);
      toEye.set(-p[o], eye - p[o + 1], -p[o + 2]).normalize();
      const facing = up.dot(toEye);
      const tone = facing < -0.22 ? 2 : facing > 0.3 ? 1 : 0;
      // under the horizon (down on the bank, or behind one): not seen, nor its reflection
      const under = a < 0.002;
      this.shade.setX(i, under ? -1 : tone);
      this.mirrorShade.setX(i, under ? -1 : tone);
      if (!under) {
        shown++;
        sx += across;
        this.box.expandByPoint(new THREE.Vector2(across / width, a));
      }
    }
    bp.needsUpdate = mp.needsUpdate = true;
    this.shade.needsUpdate = this.mirrorShade.needsUpdate = true;
    this.seen = (shown / N) * fade;
    this.across = shown ? sx / shown / width : 0;
    this.turning = THREE.MathUtils.clamp(this.turn / 0.6, 0, 1);
    this.birds.material.uniforms.uFade.value = fade;
    this.mirror.material.uniforms.uFade.value = fade;
    this.birds.visible = this.mirror.visible = shown > 0 && fade > 0.02;
  }

  /** Whether this point of the sky (up from the horizon in view heights, across as a share of the width) is on the flock, give or take. */
  at(a: number, across: number) {
    if (this.seen < 0.2 || this.box.isEmpty()) return false;
    return across > this.box.min.x - 0.03 && across < this.box.max.x + 0.03 && a > this.box.min.y - 0.02 && a < this.box.max.y + 0.02;
  }
}
