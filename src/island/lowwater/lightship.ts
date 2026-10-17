/**
 * The lightship, anchored out in the deep water past the last twig: a lighthouse put where none
 * could stand. She rides to her anchor, so she swings slowly as the tide turns, and rolls a little
 * on the swell, less than the buoy. Her lamp gives two short flashes every fifteen seconds, her own
 * character, so nobody takes her for the buoy. Far enough out that she comes up over the horizon
 * as you walk out to the deep water: the lamp first. In a fog she sounds her horn, two blasts
 * every half minute (her count, as the flashes are), heard from where she lies all over the flat.
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
/** Her fog signal: two blasts, the second a little after the first one's done, every half minute. */
const HORN_PERIOD = 30;
const BLASTS = [0, 4.2];
/** How thick the fog has to be before she sounds it (the island's lighthouse waits for the same). */
export const HORN_FOG = 0.5;

export class Lightship {
  private bob = 0;
  private sunk = 0;
  /** Where her fog signal's count was last frame (s into its period), or -1 when it's not sounding. */
  private horn = -1;

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

  /**
   * Her horn, while the fog's thick enough: `blast` is given how near she is (1 alongside … 0 out
   * of earshot) and which side (-1 … 1). A foghorn carries: she's heard from anywhere on the flat.
   */
  fogSignal(t: number, fog: number, you: THREE.Vector2, blast: (near: number, pan: number) => void) {
    const was = this.horn;
    this.horn = fog > HORN_FOG ? t % HORN_PERIOD : -1;
    // (fog coming in starts her count where it is, rather than with a blast mid-way)
    if (was < 0 || this.horn < 0) return;
    if (!BLASTS.some((b) => (was < b || was > this.horn) && this.horn >= b)) return;
    const dx = LIGHTSHIP.x - you.x;
    const d = Math.hypot(dx, LIGHTSHIP.y - you.y);
    blast(1 / (1 + (d / 100) ** 2), (dx / Math.max(d, 1)) * 0.9);
  }

  /** Up over the horizon as you come out, top first. `far` is where the flat runs out (z). */
  place(level: number, far: number, sink: number) {
    const rise = THREE.MathUtils.clamp((LIGHTSHIP.y - (far + sink)) / RISE, 0, 1);
    this.sunk = (1 - rise) * (TALL + 0.3);
    this.root.position.y = level - 0.02 + this.bob - this.sunk;
  }
}
