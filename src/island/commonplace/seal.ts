/**
 * The seal: a harbour seal hauled out on a bank of its own, out east near the deep water. It lies
 * with its head to the water, and when you're about it lifts its head and watches you. Come too
 * close and it humps off the bank and goes in; a little later its head comes up out in the deep
 * water, still watching. Leave it the bank a while and it hauls out again.
 */
import * as THREE from 'three';

/**
 * Where it lies, and which way it faces as it lies there: side-on to the way you come, its head
 * to the west. The bank it's on.
 */
export const SEAL = new THREE.Vector2(20, -111.3);
export const SEAL_BANK = { x: 20.6, z: -111, rx: 4.4, rz: 1.35, h: 0.075 };
const REST = Math.PI - 0.3;
/** Where it goes into the water, off the bank's edge where the deep starts, and which way that is. */
const IN = SEAL.clone().add(new THREE.Vector2(-1.4, -4.3));
const GO = Math.atan2(-(IN.y - SEAL.y), IN.x - SEAL.x);
const GOING = 3.4;
const HAULING = 5.5;
/** It watches you from this far (m), goes in if you come this close, and comes back out once you've been this far off a while. */
const WATCH = 16;
export const SHY = 6.5;
const LEAVE = 17;
const LEFT_FOR = 14;

export type SealState = 'out' | 'going' | 'under' | 'up' | 'hauling';

export interface SealEvents {
  /** It went in, or its head came up: where, to make a ring, and for the sound. */
  slip?(at: THREE.Vector2): void;
  breath?(at: THREE.Vector2): void;
}

export class Seal {
  state: SealState = 'out';
  private body: THREE.Object3D;
  private head: THREE.Object3D;
  /** 0 on the bank … 1 in the water, along the way between. */
  private along = 0;
  private timer = 0;
  private left = 0;
  private look = 0;
  private lookUntil = 0;
  private yaw = 0;
  private pitch = -0.12;
  private time = 0;
  private up = new THREE.Vector2();
  private slipped = false;

  constructor(readonly root: THREE.Object3D, private model: THREE.Object3D, private random: () => number, private events: SealEvents) {
    this.body = model.getObjectByName('seal_body') ?? model;
    this.head = model.getObjectByName('seal_head') ?? model;
    this.head.rotation.order = 'YZX';
  }

  /** Whether it's gone in (it's in the water, or on its way). */
  get gone() {
    return this.state !== 'out' && this.state !== 'hauling';
  }

  /** Where it is now: on the bank, or its head out in the water. */
  get at() {
    return new THREE.Vector2(this.root.position.x, this.root.position.z);
  }

  update(dt: number, you: THREE.Vector2, level: number, ground: (x: number, z: number) => number) {
    this.time += dt;
    const d = you.distanceTo(SEAL);
    this.left = d > LEAVE ? this.left + dt : 0;
    switch (this.state) {
      case 'out':
        if (d < SHY) this.state = 'going';
        break;
      case 'hauling':
        this.along -= dt / HAULING;
        if (d < SHY) this.state = 'going';
        else if (this.along <= 0) (this.along = 0), (this.state = 'out');
        break;
      case 'going':
        this.along += dt / GOING;
        if (this.along > 0.8 && !this.slipped) {
          this.slipped = true;
          this.events.slip?.(this.lying());
        }
        if (this.along >= 1) this.dive(5 + this.random() * 4);
        break;
      case 'under':
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.left > LEFT_FOR) {
          this.state = 'hauling';
          this.along = 1;
          this.slipped = false;
        } else {
          // up somewhere out in the deep water, to have a look at you
          this.state = 'up';
          this.timer = 10 + this.random() * 7;
          this.up.set(IN.x - 5 + this.random() * 8, IN.y - 1.5 - this.random() * 3.5);
          this.events.breath?.(this.up.clone());
        }
        break;
      case 'up':
        this.timer -= dt;
        if (this.timer <= 0 || this.left > LEFT_FOR) this.dive(6 + this.random() * 5);
        break;
    }
    this.place(you, d, level, ground, dt);
  }

  private dive(time: number) {
    this.state = 'under';
    this.timer = time;
  }

  /** Where it'd be lying, along the way from the bank to the water. */
  private lying() {
    return SEAL.clone().lerp(IN, THREE.MathUtils.smootherstep(this.along, 0, 1));
  }

  private place(you: THREE.Vector2, d: number, level: number, ground: (x: number, z: number) => number, dt: number) {
    const r = this.root;
    // (the root's own visibility is the world's: it hides what's past the horizon)
    this.model.visible = this.state !== 'under';
    this.body.visible = this.state !== 'up';
    let yawWant = 0;
    let pitchWant = -0.12;
    if (this.state === 'up') {
      // just its head, bobbing, turned to you
      const to = Math.atan2(-(you.y - this.up.y), you.x - this.up.x);
      r.position.set(this.up.x, level - 0.33 + Math.sin(this.time * 1.3) * 0.03, this.up.y);
      r.rotation.set(0, to, 0);
      pitchWant = 0.9;
    } else {
      const p = this.lying();
      // humping along: a rise and fall for each heave, the head low and the way ahead
      const moving = this.state === 'going' || this.state === 'hauling';
      const heave = moving ? Math.abs(Math.sin(this.time * 4.2)) : 0;
      const sink = THREE.MathUtils.smoothstep(this.along, 0.7, 1) * 0.42;
      r.position.set(p.x, Math.max(level, ground(p.x, p.y)) - 0.03 + heave * 0.05 - sink, p.y);
      // (turning to the water as it sets off, and coming back up head first)
      const way = this.state === 'hauling' ? GO + Math.PI : GO;
      const turn = REST + Math.atan2(Math.sin(way - REST), Math.cos(way - REST)) * THREE.MathUtils.smoothstep(this.along, 0, 0.2);
      r.rotation.set(0, turn, 0);
      this.body.rotation.z = heave * 0.06;
      if (moving) {
        pitchWant = 0.1 + heave * 0.15;
      } else {
        // lifting its head to watch you; on its own, now and then, to look round
        if (this.time > this.lookUntil + 6 && this.random() < dt / 9) (this.lookUntil = this.time + 2.5 + this.random() * 2), (this.look = (this.random() - 0.5) * 1.6);
        const watching = d < WATCH;
        const looking = this.time < this.lookUntil;
        if (watching) {
          const to = Math.atan2(-(you.y - p.y), you.x - p.x);
          yawWant = THREE.MathUtils.clamp(Math.atan2(Math.sin(to - REST), Math.cos(to - REST)), -1.25, 1.25);
          pitchWant = 0.25 + (1 - d / WATCH) * 0.35;
        } else if (looking) {
          yawWant = this.look;
          pitchWant = 0.3;
        }
      }
    }
    const k = 1 - Math.exp(-dt * 3);
    this.yaw += (yawWant - this.yaw) * k;
    this.pitch += (pitchWant - this.pitch) * k;
    this.head.rotation.y = this.yaw;
    this.head.rotation.z = this.pitch;
  }
}
