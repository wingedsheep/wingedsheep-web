/**
 * The lightship, anchored out in the deep water past the last twig: a lighthouse put where none
 * could stand. She rides to her anchor, so she swings slowly as the tide turns, and rolls a little
 * on the swell, less than the buoy. Her lamp gives two short flashes every fifteen seconds, her own
 * character, so nobody takes her for the buoy. Far enough out that she comes up over the horizon
 * as you walk out to the deep water: the lamp first.
 */
import * as THREE from 'three';

/** Where she lies (x east, z south, like the rest of the flat). */
export const LIGHTSHIP = new THREE.Vector2(-5, -130);
/** How much smaller than her model she's shown, so she reads as further off than she is. */
export const LIGHTSHIP_SCALE = 0.7;
/** How tall she stands over the water, to the top of the lantern's cap (m). */
const TALL = 9.8 * LIGHTSHIP_SCALE;
/** How far past the horizon she's all the way up (m). */
const RISE = 6.5;
/** Which way she lies on an even tide, and how far she swings either side of it as it turns. */
const HEADING = 0.28;
const SWING = 0.4;
/** Her light: two flashes of half a second, a second apart, every fifteen seconds. */
const PERIOD = 15;
const FLASHES = [0, 1.5];
const FLASH_ON = 0.5;

export class Lightship {
  private bob = 0;
  private sunk = 0;

  /** `lamps` are her lamp and its halo, and their reflections: lit together. */
  constructor(
    readonly root: THREE.Object3D,
    private lamps: THREE.Object3D[],
    private lampHeight: number,
  ) {}

  /** On the swell, and swinging to the tide (`tide`: where it is in its turn, 0 … 1). */
  update(t: number, tide: number, wind: number) {
    const sway = 0.012 + wind * 0.05;
    const roll = sway * (Math.sin((t / 7.3) * Math.PI * 2) + 0.5 * Math.sin((t / 4.9) * Math.PI * 2 + 0.7));
    const pitch = sway * 0.4 * Math.sin((t / 8.1) * Math.PI * 2 + 2.1);
    this.root.rotation.set(0, HEADING + SWING * Math.cos(tide * Math.PI * 2), 0);
    this.root.rotateX(roll);
    this.root.rotateZ(pitch);
    this.bob = Math.sin((t / 7.3) * Math.PI * 2 + 1.1) * (0.03 + wind * 0.05);
    const s = t % PERIOD;
    const on = FLASHES.some((f) => s >= f && s < f + FLASH_ON);
    // (and not while she's still under the horizon: the halo would show on the water)
    const up = this.lampHeight - this.sunk > 0.3;
    for (const l of this.lamps) l.visible = on && up;
  }

  /** Up over the horizon as you come out, top first. `far` is where the flat runs out (z). */
  place(level: number, far: number, sink: number) {
    const rise = THREE.MathUtils.clamp((LIGHTSHIP.y - (far + sink)) / RISE, 0, 1);
    this.sunk = (1 - rise) * (TALL + 0.3);
    this.root.position.y = level - 0.02 + this.bob - this.sunk;
  }
}
