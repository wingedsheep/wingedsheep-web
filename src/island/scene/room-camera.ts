import * as THREE from 'three';

const ELEVATION = THREE.MathUtils.degToRad(35); // the same angle as the island camera
const YAW = THREE.MathUtils.degToRad(-22); // looking in from the south-east
const DISTANCE = 60;
const MAX_ZOOM = 4;
const GLIDE = 3.5; // how quickly a focus() glides in

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/**
 * The camera looking into a room (the library, the workshop). It frames the whole room in the
 * part of the canvas a panel leaves free, and from there you can zoom in and look around, but
 * never so far that the room slides out of view.
 */
export class RoomCamera {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2);
  private zoom = 1;
  /** How far the view has been moved off the framing, in world units along the camera's axes. */
  private offset = new THREE.Vector2();
  /** Where focus() is gliding to, until it gets there or someone grabs the view. */
  private goal: { zoom: number; offset: THREE.Vector2 } | null = null;
  /** focus() may go in closer than the scroll wheel can (and lets it follow); zooming back out drops it again. */
  private limit = MAX_ZOOM;
  private fit = {
    position: V(),
    right: V(),
    up: V(),
    half: new THREE.Vector2(1, 1), // half the visible width and height when framed
    perPx: 1, // world units per CSS pixel when framed
    lo: new THREE.Vector2(), // the room's edges, relative to the framed centre
    hi: new THREE.Vector2(),
    free: new THREE.Vector2(), // the free area's centre, in CSS pixels from the canvas centre
    freeSize: new THREE.Vector2(1, 1), // and its size
  };

  constructor(private bounds: THREE.Box3) {}

  /**
   * Fit the room into the part of the canvas that isn't under a panel. `free` is in CSS pixels
   * relative to the canvas. Any zoom is kept.
   */
  frame(width: number, height: number, free: { x: number; y: number; w: number; h: number }) {
    const cam = this.camera;
    const centre = this.bounds.getCenter(V());
    const dir = V(-Math.sin(YAW) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(YAW) * Math.cos(ELEVATION));
    cam.position.copy(centre).addScaledVector(dir, DISTANCE);
    cam.lookAt(centre);
    cam.updateMatrixWorld();

    const box = new THREE.Box2();
    const { min, max } = this.bounds;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      const p = V(x, y, z).applyMatrix4(cam.matrixWorldInverse);
      box.expandByPoint(new THREE.Vector2(p.x, p.y));
    }
    const size = box.getSize(new THREE.Vector2());
    const mid = box.getCenter(new THREE.Vector2());
    const perPx = Math.max(size.x / free.w, size.y / free.h) * 1.04;
    const fx = free.x + free.w / 2 - width / 2;
    const fy = free.y + free.h / 2 - height / 2;
    const shift = new THREE.Vector2(mid.x - fx * perPx, mid.y + fy * perPx);
    const fit = this.fit;
    fit.right.setFromMatrixColumn(cam.matrixWorld, 0);
    fit.up.setFromMatrixColumn(cam.matrixWorld, 1);
    fit.position.copy(cam.position).addScaledVector(fit.right, shift.x).addScaledVector(fit.up, shift.y);
    fit.half.set((perPx * width) / 2, (perPx * height) / 2);
    fit.perPx = perPx;
    fit.lo.copy(box.min).sub(shift);
    fit.hi.copy(box.max).sub(shift);
    fit.free.set(fx, fy);
    fit.freeSize.set(free.w, free.h);
    this.apply();
  }

  /** How far in the view is (1 = the whole room). */
  get level() {
    return this.zoom;
  }

  /** Whether a focus() is still gliding in. */
  get gliding() {
    return this.goal !== null;
  }

  /** The zoom at which something `size` across fills `share` of the free area. */
  zoomFor(size: number, share: number) {
    const { fit } = this;
    return Math.max(1, (share * Math.min(fit.freeSize.x, fit.freeSize.y) * fit.perPx) / size);
  }

  /** Glide in until `p` sits in the middle of the free area, `zoom` times closer. */
  focus(p: THREE.Vector3, zoom: number, instant = false) {
    const { fit } = this;
    this.limit = Math.max(MAX_ZOOM, zoom * 2); // and from there, scroll in closer still
    const rel = p.clone().sub(fit.position);
    const perPx = fit.perPx / zoom;
    const offset = new THREE.Vector2(rel.dot(fit.right) - fit.free.x * perPx, rel.dot(fit.up) + fit.free.y * perPx);
    this.goal = { zoom, offset };
    if (instant) this.step(Infinity);
  }

  /** Move a glide along; true while it's still moving (and on the frame it arrives). */
  step(dt: number) {
    const goal = this.goal;
    if (!goal) return false;
    const k = 1 - Math.exp(-GLIDE * dt);
    const was = this.offset.clone();
    this.zoom = Math.exp(THREE.MathUtils.lerp(Math.log(this.zoom), Math.log(goal.zoom), k));
    this.offset.lerp(goal.offset, k);
    this.apply(); // (may hold the offset back at the room's edge)
    // there, or as close as the room's edges allow
    if (Math.abs(this.zoom - goal.zoom) < 0.01 * goal.zoom && this.offset.distanceTo(was) < 0.001) {
      this.zoom = goal.zoom;
      this.goal = null;
      this.apply();
    }
    return true;
  }

  /** Zoom by a factor of the visible size (below 1 zooms in), keeping `ndc` where it is. */
  zoomBy(factor: number, ndc: THREE.Vector2) {
    this.goal = null;
    const before = this.zoom;
    this.zoom = THREE.MathUtils.clamp(this.zoom / factor, 1, this.limit);
    if (this.zoom <= MAX_ZOOM) this.limit = MAX_ZOOM;
    this.offset.x += ndc.x * this.fit.half.x * (1 / before - 1 / this.zoom);
    this.offset.y += ndc.y * this.fit.half.y * (1 / before - 1 / this.zoom);
    this.apply();
  }

  /** Drag the room along by some CSS pixels. */
  pan(dxPx: number, dyPx: number) {
    this.goal = null;
    const perPx = this.fit.perPx / this.zoom;
    this.offset.x -= dxPx * perPx;
    this.offset.y += dyPx * perPx;
    this.apply();
  }

  /** Back to the whole room. */
  reset() {
    this.goal = null;
    this.limit = MAX_ZOOM;
    this.zoom = 1;
    this.offset.set(0, 0);
    this.apply();
  }

  private apply() {
    const { fit, camera: cam } = this;
    // the further in, the further you can look around, up to the room's edges
    const reach = 1 - 1 / this.zoom;
    this.offset.x = THREE.MathUtils.clamp(this.offset.x, fit.lo.x * reach, fit.hi.x * reach);
    this.offset.y = THREE.MathUtils.clamp(this.offset.y, fit.lo.y * reach, fit.hi.y * reach);
    cam.position.copy(fit.position).addScaledVector(fit.right, this.offset.x).addScaledVector(fit.up, this.offset.y);
    const w = fit.half.x / this.zoom;
    const h = fit.half.y / this.zoom;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }
}
