import * as THREE from 'three';
import type { Ground } from './beike';
import type { Island } from './island';
import type { Waypoint } from './shelter';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;

const IN = 2.4; // m/s, running in (bravely)
const WARMUP = 8; // seconds on the spot at least, before he goes
const HESITATE = 1.6; // seconds at the water's edge, thinking better of it
const OUT = 4.6; // m/s, running out (faster)
const UNDER = 1.4; // seconds from going under to coming back up
const STRIDE = 0.28; // seconds a step, running

type Phase = 'warmup' | 'in' | 'edge' | 'wade' | 'under' | 'out' | 'shiver';

/**
 * The nieuwjaarsduik (holidays.py `dive`): on New Year's Day at noon Vincent goes into the sea in
 * an orange hat, like thousands of people up and down the coast. From a quarter to he's on the
 * beach by his towel, jogging on the spot and swinging his arms; at noon he runs in, whooping,
 * goes right under, and comes out again a great deal faster than he went in. Then he stands on
 * his towel with his arms wrapped round himself, shivering, very pleased with himself. Click him
 * afterwards and he can be talked into going again.
 */
export class Diver {
  private me?: THREE.Object3D;
  private route: Waypoint[] = [];
  private phase: Phase = 'warmup';
  private t = 0;
  private clock = 0;
  private along = 0;
  private gone = false; // been in yet this year
  private again = false;
  /** Going under (the island makes a splash of it). */
  onSplash?: (at: THREE.Vector3) => void;

  constructor(
    island: Island,
    private ground: Ground,
  ) {
    this.me = island.get('vincent_dive');
    this.route = island.routes.get('dive') ?? [];
  }

  /** Whether the dive figure is there at all (only on New Year's Day). */
  get ready() {
    return !!this.me && this.route.length === 3;
  }

  set visible(on: boolean) {
    if (this.me) this.me.visible = on;
  }

  get body() {
    return this.me;
  }

  get head() {
    return this.me?.getObjectByName('dive_head');
  }

  /** Whether he's in the water or on his way in or out (not to be interrupted). */
  get busy() {
    return this.phase !== 'warmup' && this.phase !== 'shiver';
  }

  /** Talked into another go: returns false if he's mid-dive or not yet been in at all. */
  goAgain() {
    if (!this.gone || this.busy) return false;
    this.again = true;
    return true;
  }

  /** `minutes`: minutes since noon on New Year's Day (calendar.diveAt). */
  update(dt: number, minutes: number) {
    const me = this.me;
    const r = this.route;
    if (!me || r.length < 3) return;
    this.clock += dt;
    this.t += dt;
    // in at noon (or as soon as he's down on the beach, if that's later), and again if he's talked into it
    if ((this.phase === 'warmup' && minutes >= 0 && this.t > WARMUP) || (this.phase === 'shiver' && this.again)) this.go('in');
    const [towel, edge, deep] = r.map((p) => p.at);
    const part = (name: string) => me.getObjectByName(name);
    const legL = part('dive_leg_l');
    const legR = part('dive_leg_r');
    const armL = part('dive_arm_l');
    const armR = part('dive_arm_r');
    const head = part('dive_head');
    let swing = 0;
    let arms = 0; // 0 hanging, 1 flung up
    let hug = 0; // arms wrapped round himself
    let sink = 0;
    let bob = 0;
    let face = Math.atan2(deep.x - towel.x, deep.z - towel.z); // towards the sea

    switch (this.phase) {
      case 'warmup': {
        // jogging on the spot, now and then a big swing of the arms
        me.position.copy(towel);
        swing = Math.sin((this.clock / 0.35) * Math.PI) * 0.35;
        bob = Math.abs(Math.sin((this.clock / 0.35) * Math.PI)) * 0.06;
        arms = Math.max(0, Math.sin(this.clock * 0.9)) ** 4;
        break;
      }
      case 'in':
      case 'wade':
      case 'out': {
        // in: down the sand to the water's edge; wade: on in up to his chest; out: all of it, at once
        const [a, b] = this.phase === 'in' ? [towel, edge] : this.phase === 'wade' ? [edge, deep] : [deep, towel];
        const length = a.distanceTo(b);
        this.along += (this.phase === 'out' ? OUT : this.phase === 'wade' ? IN * 0.6 : IN) * dt;
        me.position.lerpVectors(a, b, Math.min(1, this.along / length));
        const h = this.ground.at(me.position.x, me.position.z);
        me.position.y = Number.isNaN(h) ? me.position.y : Math.max(h, -0.2);
        face = Math.atan2(b.x - a.x, b.z - a.z);
        swing = Math.sin((this.clock / STRIDE) * Math.PI) * (this.phase === 'wade' ? 0.35 : 0.7);
        bob = Math.abs(Math.sin((this.clock / STRIDE) * Math.PI)) * 0.08;
        arms = this.phase === 'out' ? 0 : 0.8 + Math.sin(this.clock * 9) * 0.2; // arms up, whooping
        hug = this.phase === 'out' ? 0.7 : 0; // clutching himself
        if (this.along < length) break;
        if (this.phase === 'in') this.go('edge');
        else if (this.phase === 'wade') {
          this.go('under');
          this.onSplash?.(deep.clone().setY(0));
        } else this.go('shiver');
        break;
      }
      case 'edge': {
        // feet in the water: a moment's second thoughts, arms round himself, then on
        me.position.copy(edge);
        hug = 1;
        bob = Math.abs(Math.sin(this.clock * 30)) * 0.015;
        if (this.t >= HESITATE) this.go('wade');
        break;
      }
      case 'under': {
        me.position.copy(deep);
        me.position.y = Math.max(this.ground.at(deep.x, deep.z) || -1, -1);
        // down till the hat's the only thing showing, then straight back up
        sink = Math.sin(clamp(this.t / UNDER, 0, 1) * Math.PI) * 1.2;
        arms = 1 - Math.sin(clamp(this.t / UNDER, 0, 1) * Math.PI);
        if (this.t >= UNDER) {
          this.onSplash?.(deep.clone().setY(0));
          this.go('out');
        }
        break;
      }
      case 'shiver': {
        me.position.copy(towel);
        face = Math.atan2(deep.x - towel.x, deep.z - towel.z) + Math.PI * 0.85; // back to the sea
        hug = 1;
        bob = Math.abs(Math.sin(this.clock * 40)) * 0.012;
        me.position.x += Math.sin(this.clock * 47) * 0.012;
        break;
      }
    }
    me.position.y += bob - sink;
    me.rotation.set(0, face, 0);
    legL?.rotation.set(swing, 0, 0);
    legR?.rotation.set(-swing, 0, 0);
    // arms: swinging while he runs, flung up going in, wrapped round his chest coming out
    armL?.rotation.set(-swing * 0.8 * (1 - arms) * (1 - hug) - arms * 2.9 - hug * 1.3, hug * 0.9, arms * 0.3);
    armR?.rotation.set(swing * 0.8 * (1 - arms) * (1 - hug) - arms * 2.9 - hug * 1.3, -hug * 0.9, -arms * 0.3);
    head?.rotation.set(this.phase === 'shiver' ? 0.15 : 0, Math.sin(this.clock * 0.4) * (this.phase === 'warmup' ? 0.4 : 0.05), 0);
  }

  private go(phase: Phase) {
    this.phase = phase;
    this.t = 0;
    this.along = 0;
    if (phase === 'in') this.again = false;
    if (phase === 'out') this.gone = true;
    if (phase === 'shiver') this.gone = true;
  }
}
