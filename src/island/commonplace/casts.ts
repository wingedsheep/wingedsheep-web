/**
 * Lugworm casts, on a low bank of their own east of the ring. Under each coil and its dimple a
 * lugworm lives in a U: it swallows sand at the dimple and leaves it in a coil at the other end.
 * Stand still on the bank a while and one of them makes a new coil in front of you, pushed out
 * in pulses, wet, so it catches a little more of the sky. Nothing else happens here; the rest is the card.
 */
import * as THREE from 'three';

/** How many casts on the bank, and how high the sand has to be for one (m; the rest is under water). */
const COUNT = 120;
const DRY = 0.03;
/** Stood still on the bank this long (s), and a worm near you makes a new coil; it takes this long. */
const WAIT = 5;
const MAKING = 9;
/** A coil's size (m): far bigger than a real one (a few cm), or it'd be nothing from up here. */
const COIL_R = 0.1;
const COIL_H = 0.085;
const TUBE = 0.032;

const CAST = new THREE.Color('#7a7588');
/** (a new one's wet, so it gives back a little more of the sky than the dry ones) */
const FRESH = new THREE.Color('#aca7bd');
const DIMPLE = new THREE.Color('#3e3a50');

/** A coil of sand, laid from the ground up, a little lopsided; shaded darker underneath. */
function coil(turns: number, rand: () => number) {
  const pts: THREE.Vector3[] = [];
  const n = Math.round(turns * 10);
  const lean = rand() * Math.PI * 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2 + lean;
    const r = COIL_R * (1 - 0.6 * t) * (0.9 + 0.2 * Math.sin(i * 1.7));
    pts.push(new THREE.Vector3(Math.cos(a) * r + t * 0.02, TUBE * 0.6 + t * COIL_H, Math.sin(a) * r * 0.85));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, TUBE, 4, false);
  const normal = geo.attributes.normal;
  const shade = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    const k = normal.getY(i) > 0.35 ? 1 : normal.getY(i) > -0.35 ? 0.8 : 0.62;
    shade.set([k, k, k], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  return geo;
}

export class Casts {
  readonly casts: THREE.InstancedMesh;
  readonly dimples: THREE.InstancedMesh;
  /** The new ones, made while you watched (up to three a visit; then the oldest goes again). */
  private fresh: { mesh: THREE.Mesh; dimple: THREE.Mesh; made: number }[] = [];
  private making = -1;
  private time = 0;
  /** One a still spell, and not again for a while after. */
  private madeThisStill = false;
  private restUntil = 0;
  /** Whether you've watched one made, and are still on the bank (the card's second line). */
  watched = false;

  constructor(
    readonly bank: { x: number; z: number; rx: number; rz: number },
    private ground: (x: number, z: number) => number,
    material: () => THREE.MeshBasicMaterial,
    rand: () => number,
  ) {
    const castMat = material();
    castMat.vertexColors = true;
    this.casts = new THREE.InstancedMesh(coil(2.4, rand), castMat, COUNT);
    const flat = new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2);
    this.dimples = new THREE.InstancedMesh(flat, material(), COUNT);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (let tries = 0; n < COUNT && tries < COUNT * 40; tries++) {
      const x = bank.x + (rand() * 2 - 1) * bank.rx;
      const z = bank.z + (rand() * 2 - 1) * bank.rz;
      if (ground(x, z) < DRY) continue;
      const s = 0.7 + rand() * 0.5;
      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      m.compose(new THREE.Vector3(x, ground(x, z) - 0.006, z), q, new THREE.Vector3(s, s * (0.8 + rand() * 0.4), s));
      this.casts.setMatrixAt(n, m);
      this.casts.setColorAt(n, CAST.clone().multiplyScalar(0.94 + rand() * 0.1));
      // its dimple, a hand or so off, the worm's other end
      const a = rand() * Math.PI * 2;
      const d = 0.22 + rand() * 0.14;
      const dx = x + Math.cos(a) * d;
      const dz = z + Math.sin(a) * d * 0.7;
      const r = 0.05 + rand() * 0.03;
      m.compose(new THREE.Vector3(dx, ground(dx, dz) + 0.004, dz), q.identity(), new THREE.Vector3(r * 1.3, 1, r));
      this.dimples.setMatrixAt(n, m);
      this.dimples.setColorAt(n, DIMPLE);
      n++;
    }
    this.casts.count = this.dimples.count = n;
    for (const mesh of [this.casts, this.dimples]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.userData.id = 'casts';
    }
    for (let i = 0; i < 3; i++) {
      const freshMat = material();
      freshMat.vertexColors = true;
      freshMat.color.copy(FRESH);
      const geo = coil(3.2, rand);
      geo.setDrawRange(0, 0);
      const mesh = new THREE.Mesh(geo, freshMat);
      const dimpleMat = material();
      dimpleMat.color.copy(DIMPLE);
      const dimple = new THREE.Mesh(flat, dimpleMat);
      mesh.visible = dimple.visible = false;
      mesh.frustumCulled = false;
      this.fresh.push({ mesh, dimple, made: -1 });
    }
  }

  /** Everything to add to the scene. */
  get meshes() {
    return [this.casts, this.dimples, ...this.fresh.flatMap((f) => [f.mesh, f.dimple])];
  }

  /** Whether a point's on the casts' bank (or close by its edge). */
  on(x: number, z: number) {
    const qx = (x - this.bank.x) / (this.bank.rx + 0.6);
    const qz = (z - this.bank.z) / (this.bank.rz + 0.6);
    return qx * qx + qz * qz < 1 && this.ground(x, z) > -0.02;
  }

  /** Each frame: where you are, and how long you've stood still. */
  update(dt: number, x: number, z: number, stillFor: number) {
    const t = (this.time += dt);
    const here = this.on(x, z);
    if (!here) this.watched = false;
    if (stillFor === 0) this.madeThisStill = false;
    if (this.making < 0 && here && stillFor > WAIT && !this.madeThisStill && t > this.restUntil) this.start(x, z, t);
    if (this.making >= 0) {
      const f = this.fresh[this.making];
      const age = t - f.made;
      // pushed out in pulses, as a worm squeezes: quick, then a pause
      const pulse = age + 0.35 * Math.sin(age * Math.PI * 1.2);
      const done = THREE.MathUtils.clamp(pulse / MAKING, 0, 1);
      const geo = f.mesh.geometry;
      const all = geo.index!.count;
      geo.setDrawRange(0, Math.floor((all * done) / 3) * 3);
      if (done >= 1) {
        this.making = -1;
        this.restUntil = t + 30;
        if (here) this.watched = true;
      }
    }
  }

  /** A new cast, beside you on the bank (to one side, so you don't stand in front of it), if there's dry sand there. */
  private start(x: number, z: number, t: number) {
    for (const [ox, oz] of [[1.1, -0.3], [-1.1, -0.3], [1.4, -1], [-1.4, -1], [0.7, 0.6]]) {
      const cx = x + ox;
      const cz = z + oz;
      if (this.ground(cx, cz) < DRY) continue;
      const i = this.fresh.reduce((a, f, k) => (f.made < this.fresh[a].made ? k : a), 0);
      const f = this.fresh[i];
      f.made = t;
      f.mesh.position.set(cx, this.ground(cx, cz) - 0.006, cz);
      f.mesh.rotation.y = Math.atan2(ox, oz);
      f.mesh.scale.setScalar(2.2);
      f.mesh.geometry.setDrawRange(0, 0);
      f.dimple.position.set(cx - 0.3, this.ground(cx - 0.3, cz + 0.05) + 0.004, cz + 0.05);
      f.dimple.scale.set(0.09, 1, 0.07);
      f.mesh.visible = f.dimple.visible = true;
      this.making = i;
      this.madeThisStill = true;
      return;
    }
    this.madeThisStill = true;
  }
}
