import * as THREE from 'three';

const ELEVATION = THREE.MathUtils.degToRad(35); // camera angle above the horizon
const DISTANCE = 120;
const MIN_VIEW = 9; // world units visible vertically, most zoomed in
const MAX_VIEW = 64;

export interface RigEvents {
  click(ndc: THREE.Vector2, client: { x: number; y: number }): void;
  hover(ndc: THREE.Vector2 | null, client: { x: number; y: number }): void;
}

/**
 * An orthographic camera looking down at the island at a fixed angle. Drag to pan, wheel or
 * pinch to zoom, rotate in quarter turns. Movement snaps to whole texels (see PixelRenderer).
 */
export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3(0, 1, -3);
  view = 46; // visible world height
  yaw = 0; // radians, 0 = looking north
  /** Locked, it still reports hovers and clicks but won't pan or zoom (e.g. while indoors). */
  locked = false;
  readonly subTexel = new THREE.Vector2();

  private goal: { target: THREE.Vector3; view: number; yaw: number } | null = null;
  private velocity = new THREE.Vector2();
  private pointers = new Map<number, { x: number; y: number }>();
  private dragDistance = 0;
  private pinchStart = 0;
  private viewAtPinch = 0;
  private aspect = 1;

  constructor(
    private el: HTMLElement,
    private bounds: THREE.Box2,
    private events: RigEvents,
    private texels: () => number, // render-target height in texels
  ) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2.5);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('pointerleave', (e) => this.events.hover(null, { x: e.clientX, y: e.clientY }));
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
  }

  /** Glide to a point; offsetX (CSS px) keeps it clear of a side panel. */
  focus(point: THREE.Vector3, view = Math.min(this.view, 22), offsetX = 0, instant = false) {
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const perPx = view / this.el.clientHeight;
    const target = point.clone().setY(1).addScaledVector(right, offsetX * perPx);
    this.goal = { target, view, yaw: this.yaw };
    if (instant) this.finishGoal();
  }

  rotate(quarterTurns: number) {
    const yaw = Math.round((this.goal?.yaw ?? this.yaw) / (Math.PI / 2) + quarterTurns) * (Math.PI / 2);
    this.goal = { target: (this.goal?.target ?? this.target).clone(), view: this.goal?.view ?? this.view, yaw };
  }

  zoom(factor: number, around?: THREE.Vector3) {
    const view = THREE.MathUtils.clamp((this.goal?.view ?? this.view) * factor, MIN_VIEW, MAX_VIEW);
    const target = (this.goal?.target ?? this.target).clone();
    if (around) target.lerp(around.clone().setY(1), 1 - view / (this.goal?.view ?? this.view));
    this.goal = { target, view, yaw: this.goal?.yaw ?? this.yaw };
  }

  /** Point on the ground plane (y = 1) under a normalised device coordinate. */
  groundAt(ndc: THREE.Vector2): THREE.Vector3 {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), hit);
    return hit;
  }

  ndc(clientX: number, clientY: number) {
    const r = this.el.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  update(dt: number) {
    if (this.goal) {
      const k = 1 - Math.exp(-dt * 5);
      this.target.lerp(this.goal.target, k);
      this.view += (this.goal.view - this.view) * k;
      this.yaw += (this.goal.yaw - this.yaw) * k;
      if (this.target.distanceTo(this.goal.target) < 0.01 && Math.abs(this.goal.view - this.view) < 0.01 && Math.abs(this.goal.yaw - this.yaw) < 0.001) {
        this.finishGoal();
      }
    } else if (this.velocity.lengthSq() > 1e-6 && this.pointers.size === 0) {
      this.pan(this.velocity.x * dt * 60, this.velocity.y * dt * 60);
      this.velocity.multiplyScalar(Math.exp(-dt * 6));
    }
    this.clamp();
    this.place();
  }

  // --- internals -------------------------------------------------------------------

  private finishGoal() {
    if (!this.goal) return;
    this.target.copy(this.goal.target);
    this.view = this.goal.view;
    this.yaw = ((this.goal.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    this.goal = null;
  }

  private place() {
    const h = this.view / 2;
    const w = h * this.aspect;
    const cam = this.camera;
    Object.assign(cam, { left: -w, right: w, top: h, bottom: -h });
    cam.updateProjectionMatrix();

    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(ELEVATION),
      Math.sin(ELEVATION),
      Math.cos(this.yaw) * Math.cos(ELEVATION),
    );
    cam.position.copy(this.target).addScaledVector(dir, DISTANCE);
    cam.lookAt(this.target);
    cam.updateMatrixWorld();

    // snap the camera to the texel grid; hand the remainder to the renderer as an image shift
    const texel = this.view / this.texels();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const r = cam.position.dot(right) / texel;
    const u = cam.position.dot(up) / texel;
    const dr = Math.round(r) - r;
    const du = Math.round(u) - u;
    cam.position.addScaledVector(right, dr * texel).addScaledVector(up, du * texel);
    cam.updateMatrixWorld();
    this.subTexel.set(-dr, -du);
  }

  private pan(dxPx: number, dyPx: number) {
    const perPx = this.view / this.el.clientHeight;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, -dxPx * perPx).addScaledVector(forward, (dyPx * perPx) / Math.sin(ELEVATION));
  }

  private clamp() {
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.min.x, this.bounds.max.x);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.min.y, this.bounds.max.y);
  }

  private onDown = (e: PointerEvent) => {
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dragDistance = 0;
    this.velocity.set(0, 0);
    if (this.goal && this.pointers.size === 1) {
      this.goal = null; // grabbing the island interrupts any glide
    }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      this.viewAtPinch = this.view;
    }
  };

  private onMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === 'mouse') this.events.hover(this.ndc(e.clientX, e.clientY), { x: e.clientX, y: e.clientY });
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dragDistance += Math.abs(dx) + Math.abs(dy);
    if (this.locked) return;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.view = THREE.MathUtils.clamp((this.viewAtPinch * this.pinchStart) / Math.max(d, 1), MIN_VIEW, MAX_VIEW);
      return;
    }
    this.pan(dx, dy);
    this.velocity.set(dx, dy);
    this.el.style.cursor = 'grabbing';
  };

  private onUp = (e: PointerEvent) => {
    const wasClick = this.pointers.size === 1 && this.dragDistance < 6;
    this.pointers.delete(e.pointerId);
    this.el.style.cursor = '';
    if (wasClick) {
      this.velocity.set(0, 0);
      this.events.click(this.ndc(e.clientX, e.clientY), { x: e.clientX, y: e.clientY });
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.locked) return;
    const around = this.groundAt(this.ndc(e.clientX, e.clientY));
    this.zoom(Math.pow(1.0015, e.deltaY), around);
  };
}
