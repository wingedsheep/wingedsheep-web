import * as THREE from 'three';
import { Beike } from './beike';
import type { Island } from './island';
import { Particles } from './particles';
import type { Sky } from './sky';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Tiny pixel icons (hearts, notes, zzz) as sprite textures. */
function icon(rows: string[], color: string): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = rows[0].length;
  cv.height = rows.length;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = color;
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && ctx.fillRect(x, y, 1, 1)));
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const ICONS = {
  heart: icon(['.#.#.', '#####', '#####', '.###.', '..#..'], '#e46f5a'),
  note: icon(['...##', '...#.', '...#.', '...#.', '.###.', '####.', '.##..'], '#fff3c4'),
  zzz: icon(['###', '..#', '.#.', '#..', '###'], '#cdc6cf'),
};

/** A song's rhythm (src/data/beats.json): beat times in seconds, and [beat, chord] changes. */
export interface Rhythm {
  beats: number[];
  chords: number[][];
}

const SWING = 0.3; // how far (radians) the strumming forearm swings each way
const SLIDE = 0.05; // how far the fretting hand travels up or down the neck
const LIFT = 0.12; // how far (radians) it comes off the strings while it moves
const q = new THREE.Quaternion();
const axis = new THREE.Vector3();

export type Burst = 'hearts' | 'notes' | 'chalk' | 'petals' | 'zzz' | 'silk';

interface Floater {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  age: number;
  life: number;
}

/**
 * Everything that moves by itself: flames, flags, the weathervane, smoke and embers,
 * fireflies after dark, the winged sheep's flight, the occasional UFO, Beike and his ball, and the
 * clips keyframed in Blender (Charlie and George breathing, twitching and dreaming on the bench).
 */
export class Life {
  readonly particles = new Particles();
  private clock = 0;
  private timers = new Map<string, number>();
  private floaters: Floater[] = [];
  private sheep?: THREE.Object3D;
  private flock: THREE.Object3D[] = [];
  private stunt = 0;
  private ufo?: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private idles = new Map<string, THREE.AnimationAction>();
  readonly beike: Beike;
  /** Whether Vincent's song is audible; he eases into and out of playing. */
  playing = false;
  /** The beats and chord changes of the song he's playing... */
  rhythm: Rhythm | null = null;
  /** ...and how far into it you're hearing, set every frame. */
  songTime = 0;
  private groove = 0;
  /** The song time he strums to: runs on the frame clock, pulled gently towards `songTime`. */
  private heard = 0;
  private beatIndex = 0;
  private chordIndex = 0;
  /** Where his fretting hand is along the neck, -1..1, easing towards the chord's place. */
  private fretPos = 0;

  constructor(
    private scene: THREE.Scene,
    private island: Island,
    private sky: Sky,
  ) {
    scene.add(this.particles.points);
    this.sheep = island.get('sheep');
    this.ufo = island.get('ufo');
    if (this.ufo) this.ufo.visible = false;
    this.beike = new Beike(island);

    this.mixer = new THREE.AnimationMixer(island.root);
    for (const clip of island.clips.filter((c) => c.name.endsWith('_idle'))) {
      const idle = this.mixer.clipAction(clip).play();
      idle.time = Math.random() * clip.duration; // so the cats don't breathe in step
      this.idles.set(clip.name.slice(0, -'_idle'.length), idle);
    }
    // a reaction clip hands back to the idle loop when it's done
    this.mixer.addEventListener('finished', (e) => {
      const id = e.action.getClip().name.split('_')[0];
      this.idles.get(id)?.reset().fadeIn(0.5).play();
    });
  }

  /** Play a named thing's "<id>_pet" clip once, if Blender gave it one. */
  pet(id: string) {
    const clip = this.island.clips.find((c) => c.name === `${id}_pet`);
    if (!clip) return;
    const action = this.mixer.clipAction(clip);
    if (action.isRunning()) return;
    this.idles.get(id)?.fadeOut(0.3);
    action.setLoop(THREE.LoopOnce, 1).reset().fadeIn(0.3).play();
  }

  /** Where the sheep is right now (for the camera and for clicking). */
  get sheepPosition() {
    return this.sheep?.getWorldPosition(V()) ?? V();
  }

  loop() {
    this.stunt = 1.6;
  }

  burst(kind: Burst, at: THREE.Vector3) {
    const p = this.particles;
    for (let i = 0; i < 8; i++) {
      switch (kind) {
        case 'hearts':
        case 'notes':
        case 'zzz':
          if (i < (kind === 'zzz' ? 2 : 4)) this.float(kind === 'hearts' ? 'heart' : kind === 'notes' ? 'note' : 'zzz', at, i);
          break;
        case 'chalk':
          p.emit({ position: at.clone().add(V(rand(-0.6, 0.6), rand(0, 1.5), rand(-0.6, 0.6))), velocity: V(rand(-1, 1), rand(0, 1), rand(-1, 1)), color: '#f7f3ea', life: 1.2, size: 2 });
          break;
        case 'petals':
          p.emit({ position: at.clone().add(V(rand(-1.5, 1.5), rand(2, 4), rand(-1.5, 1.5))), velocity: V(rand(0.3, 1), -rand(0.4, 0.8), rand(-0.3, 0.3)), color: '#f6cfdc', life: 4, wobble: 0.8 });
          break;
        case 'silk':
          p.emit({ position: at.clone().add(V(rand(-1, 1), rand(0.4, 1.4), rand(-0.4, 0.4))), velocity: V(0, rand(0.3, 0.8), 0), color: '#fff6e0', life: 1.5, size: 1 });
          break;
      }
    }
  }

  releaseFlock() {
    if (!this.sheep || this.flock.length) return;
    for (let i = 0; i < 9; i++) {
      const s = this.sheep.clone();
      s.userData = { flockIndex: i, lane: rand(-18, 14), delay: i * 0.35 };
      this.scene.add(s);
      this.flock.push(s);
    }
  }

  update(dt: number) {
    this.clock += dt;
    const t = this.clock;
    const night = this.sky.lamps;

    // campfire flames, flag, weathervane, a sleeping cat's breath
    for (let i = 0; i < 3; i++) {
      const f = this.island.part('campfire', `flame${i}`);
      if (f) f.scale.set(1, 0.8 + Math.sin(t * (9 + i * 3) + i) * 0.15 + Math.sin(t * 23 + i) * 0.08, 1);
    }
    const flag = this.island.part('summit', 'flag');
    if (flag) flag.rotation.y = Math.sin(t * 2.2) * 0.35;
    const vane = this.island.get('library')?.getObjectByName('weathervane');
    if (vane) vane.rotation.y = Math.sin(t * 0.13) * 1.2 + Math.sin(t * 0.7) * 0.1;
    const cat = this.island.part('cat', 'cat_body');
    if (cat) cat.scale.set(1, 1 + Math.sin(t * 1.8) * 0.04, 1);

    this.mixer.update(dt);
    this.strum(dt);
    this.flySheep(dt);
    this.flyFlock();
    this.beike.update(dt);
    this.visitors(dt, night);
    this.emitters(dt, night);
    this.updateFloaters(dt);
    this.particles.update(dt);
  }

  // --- internals -------------------------------------------------------------------

  private every(key: string, seconds: number, dt: number) {
    const left = (this.timers.get(key) ?? Math.random() * seconds) - dt;
    this.timers.set(key, left <= 0 ? left + seconds : left);
    return left <= 0;
  }

  /**
   * Vincent: idle he rests his hands and looks around; playing he strums down on every beat of
   * the song and up in between, moves his fretting hand along the neck when the chord changes,
   * nods on the beat and taps his right foot. `groove` blends between the two, so he also rests
   * before the first beat and after the last.
   */
  private strum(dt: number) {
    const t = this.clock;
    const beat = this.beatAt(dt); // beats into the song, fractional; -1 outside of it
    const g = (this.groove = THREE.MathUtils.damp(this.groove, this.playing && beat >= 0 ? 1 : 0, 3, dt));
    const swing = Math.max(0, beat) * Math.PI * 2;
    const nod = Math.max(0, Math.cos(swing)) ** 3; // deepest right on the beat
    const tap = Math.max(0, -Math.sin(swing)); // toes up in the second half of the beat, down on it
    // quick through the strings, lingering a moment at the top and bottom of each stroke
    const stroke = Math.sign(Math.sin(swing)) * Math.abs(Math.sin(swing)) ** 0.7;
    const arm = this.island.part('vincent', 'arm_strum');
    if (arm?.userData.swing) arm.quaternion.setFromAxisAngle(axis.fromArray(arm.userData.swing), stroke * SWING * g);

    // the fretting hand gets to each new chord a touch early, lifting off the strings to move
    const place = beat < 0 ? 0 : this.chordPlace(beat + 0.2) * g;
    this.fretPos = THREE.MathUtils.damp(this.fretPos, place, 14, dt);
    const fret = this.island.part('vincent', 'arm_fret');
    if (fret?.userData.slide) {
      const rest = (fret.userData.rest ??= fret.position.clone()) as THREE.Vector3;
      fret.position.copy(rest).addScaledVector(axis.fromArray(fret.userData.slide), this.fretPos * SLIDE);
      fret.quaternion.setFromAxisAngle(axis.fromArray(fret.userData.lift), Math.min(1, Math.abs(place - this.fretPos) * 3) * LIFT);
    }

    const head = this.island.part('vincent', 'head');
    if (head) {
      head.rotation.x = nod * 0.12 * g - 0.05 * (1 - g);
      head.rotation.z = Math.sin(t * 0.4) * 0.25 * (1 - g) + Math.sin(swing / 4) * 0.06 * g;
    }
    const foot = this.island.part('vincent', 'foot_tap');
    if (foot) foot.rotation.x = -tap * 0.4 * g;
  }

  /**
   * Where along the neck (-1..1) his hand sits for the chord playing at `beat`. Chords with
   * different roots sit in different places; minor ones a little further up.
   */
  private chordPlace(beat: number): number {
    const c = this.rhythm?.chords;
    if (!c?.length) return 0;
    let i = this.chordIndex;
    if (i >= c.length || c[i][0] > beat) i = 0;
    while (i < c.length - 1 && c[i + 1][0] <= beat) i++;
    this.chordIndex = i;
    const chord = c[i][1];
    return (((chord % 12) * 5) % 12) / 11 * 1.6 - 0.8 + (chord >= 12 ? 0.2 : 0);
  }

  /**
   * Where in the song's beats he is: 2.25 is a quarter of the way from the third beat to the
   * fourth, -1 is before the first or after the last. Audio clocks tick coarsely, so he keeps
   * his own time and only drifts towards what you hear (or jumps, for a new song).
   */
  private beatAt(dt: number): number {
    const b = this.rhythm?.beats ?? [];
    if (!this.playing || b.length < 2) return -1;
    this.heard += dt;
    const off = this.songTime - this.heard;
    this.heard = Math.abs(off) > 0.25 ? this.songTime : this.heard + off * Math.min(1, dt * 4);
    const now = this.heard;
    let i = this.beatIndex;
    if (i >= b.length - 1 || b[i] > now) i = 0; // a new song, or started over
    while (i < b.length - 2 && b[i + 1] <= now) i++;
    this.beatIndex = i;
    if (now < b[0] || now >= b[b.length - 1]) return -1;
    return i + (now - b[i]) / (b[i + 1] - b[i]);
  }

  /** Figure-eight over the island; y is altitude. */
  private sheepPath(t: number) {
    const a = t * 0.07;
    return V(2 + Math.sin(a) * 30, 13 + Math.sin(a * 3) * 1.5, -2 - Math.sin(a) * Math.cos(a) * 17);
  }

  private flySheep(dt: number) {
    if (!this.sheep) return;
    const p = this.sheepPath(this.clock);
    const ahead = this.sheepPath(this.clock + 0.2);
    if (this.stunt > 0) {
      this.stunt -= dt;
      const a = (1 - this.stunt / 1.6) * Math.PI * 2;
      p.y += Math.sin(a) * 2.5;
      p.addScaledVector(ahead.clone().sub(p).normalize(), (1 - Math.cos(a)) * 1.5);
    }
    this.sheep.position.copy(p);
    this.sheep.lookAt(ahead.x, p.y, ahead.z);
    this.sheep.rotateY(-Math.PI / 2); // the model faces +x
    this.flap(this.sheep, this.clock);
  }

  private flyFlock() {
    for (const s of this.flock) {
      const { lane, delay, flockIndex } = s.userData;
      const k = Math.max(0, this.clock - (s.userData.start ??= this.clock) - delay);
      s.position.set(-50 + k * 9, 11 + flockIndex * 0.6 + Math.sin(k * 1.5 + flockIndex) * 0.6, lane);
      s.rotation.set(0, 0, 0);
      this.flap(s, this.clock + flockIndex);
    }
    if (this.flock.length && this.flock.every((s) => s.position.x > 60)) {
      this.flock.forEach((s) => this.scene.remove(s));
      this.flock = [];
    }
  }

  private flap(sheep: THREE.Object3D, t: number) {
    const a = Math.sin(t * 9) * 0.7;
    const l = sheep.getObjectByName('wing_l');
    const r = sheep.getObjectByName('wing_r');
    if (l) l.rotation.x = -a;
    if (r) r.rotation.x = a;
  }

  /** At night, now and then, something unexplained hops across the sky. */
  private visitors(dt: number, night: number) {
    if (!this.ufo) return;
    const cycle = 50;
    const t = this.clock % cycle;
    const active = night > 0.7 && t < 12;
    this.ufo.visible = active;
    if (!active) return;
    const k = t / 12;
    const hop = Math.floor(k * 4);
    const local = k * 4 - hop;
    const ease = local < 0.75 ? 0 : THREE.MathUtils.smootherstep(local, 0.75, 1);
    const pts = [V(-30, 18, 10), V(-10, 20, -14), V(12, 17, 4), V(28, 21, -18), V(50, 24, -10)];
    this.ufo.position.lerpVectors(pts[hop], pts[hop + 1], ease);
    this.ufo.position.y += Math.sin(this.clock * 2) * 0.2;
    this.ufo.rotation.y += dt * 2;
  }

  private emitters(dt: number, night: number) {
    const p = this.particles;
    for (const e of this.island.emitters) {
      const key = `${e.kind}:${e.position.x.toFixed(1)}`;
      if (e.kind === 'smoke' && this.every(key, 0.35, dt)) {
        p.emit({ position: e.position.clone(), velocity: V(rand(0.3, 0.6), rand(0.7, 1.0), rand(-0.1, 0.1)), color: '#d8d4dc', life: 4.5, size: 2, wobble: 0.3 });
      } else if (e.kind === 'embers' && this.every(key, 0.12, dt)) {
        p.emit({ position: e.position.clone().add(V(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), velocity: V(rand(-0.2, 0.2), rand(1.2, 2.2), rand(-0.2, 0.2)), color: rand(0, 1) < 0.5 ? '#ffd070' : '#ff9a3c', life: rand(0.8, 1.6), wobble: 0.4 });
      } else if (e.kind === 'petals' && this.every(key, 0.8, dt)) {
        p.emit({ position: e.position.clone().add(V(rand(-1.5, 1.5), rand(0, 1), rand(-1.5, 1.5))), velocity: V(rand(0.2, 0.6), -rand(0.3, 0.6), rand(-0.2, 0.2)), color: '#f6cfdc', life: 5, wobble: 0.6 });
      }
    }
    // fireflies drift through the eastern woods after dusk
    if (night > 0.6 && this.every('firefly', 0.15, dt)) {
      const camp = this.island.positionOf('campfire') ?? V(27, 0, 1);
      p.emit({
        position: camp.clone().add(V(rand(-12, 8), rand(0.5, 3), rand(-10, 8))),
        velocity: V(rand(-0.3, 0.3), rand(-0.1, 0.2), rand(-0.3, 0.3)),
        color: '#e8ff8a', life: rand(2.5, 5), wobble: 0.8,
      });
    }
  }

  private float(name: keyof typeof ICONS, at: THREE.Vector3, i: number) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS[name], transparent: true, depthWrite: false, fog: false }));
    const img = ICONS[name].image as HTMLCanvasElement;
    sprite.scale.set(img.width * 0.09, img.height * 0.09, 1);
    sprite.position.copy(at).add(V(rand(-0.5, 0.5), 1 + i * 0.3, rand(-0.3, 0.3)));
    sprite.renderOrder = 5;
    this.scene.add(sprite);
    this.floaters.push({ sprite, velocity: V(rand(-0.3, 0.3), rand(0.7, 1.1), 0), age: -i * 0.15, life: 2 });
  }

  private updateFloaters(dt: number) {
    this.floaters = this.floaters.filter((f) => {
      f.age += dt;
      if (f.age < 0) return true;
      f.sprite.position.addScaledVector(f.velocity, dt);
      f.sprite.material.opacity = 1 - Math.max(0, f.age / f.life - 0.6) / 0.4;
      if (f.age < f.life) return true;
      this.scene.remove(f.sprite);
      f.sprite.material.dispose();
      return false;
    });
  }
}
