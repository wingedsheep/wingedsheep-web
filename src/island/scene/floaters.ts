import * as THREE from 'three';

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
  alert: icon(['.#.', '.#.', '.#.', '.#.', '...', '.#.'], '#e4463a'),
  // a thought bubble, three dots in it, trailing off down to the left
  thought: icon(['.#####.', '#######', '#.#.#.#', '#######', '.#####.', '.#.....', '#......'], '#f4f1ea'),
};

interface Floater {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  /** Set on a pop: its full size, which it springs up to. */
  pop?: THREE.Vector3;
}

/**
 * Pixel icons that drift up and fade: hearts when you pet someone, notes from the guitar, zzz
 * from whoever is asleep. `scale` is metres per icon pixel, so the rooms can use smaller ones.
 */
export class Floaters {
  private all: Floater[] = [];

  constructor(
    private scene: THREE.Object3D,
    private scale = 0.09,
  ) {}

  /** The `i`th of a little group rising from `at`, each a moment after the last. */
  add(name: keyof typeof ICONS, at: THREE.Vector3, i = 0) {
    const k = this.scale / 0.09; // the island's spread, shrunk to match
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS[name], transparent: true, depthWrite: false, fog: false }));
    const img = ICONS[name].image as HTMLCanvasElement;
    sprite.scale.set(img.width * this.scale, img.height * this.scale, 1);
    sprite.position.copy(at).add(V(rand(-0.5, 0.5) * k, (1 + i * 0.3) * k, rand(-0.3, 0.3) * k));
    sprite.renderOrder = 5;
    sprite.raycast = () => {};
    this.scene.add(sprite);
    this.all.push({ sprite, velocity: V(rand(-0.3, 0.3) * k, rand(0.7, 1.1) * k, 0), age: -i * 0.15, life: 2 });
  }

  /** One icon springing up over `at` and staying put a moment: a shock (the room's `!`). */
  pop(name: keyof typeof ICONS, at: THREE.Vector3, life = 1.6) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS[name], transparent: true, depthWrite: false, fog: false }));
    const img = ICONS[name].image as HTMLCanvasElement;
    sprite.scale.set(img.width * this.scale * 2.4, img.height * this.scale * 2.4, 1);
    sprite.position.copy(at);
    sprite.renderOrder = 5;
    sprite.raycast = () => {};
    this.scene.add(sprite);
    this.all.push({ sprite, velocity: V(), age: 0, life, pop: sprite.scale.clone() });
  }

  update(dt: number) {
    this.all = this.all.filter((f) => {
      f.age += dt;
      if (f.age < 0) return true;
      f.sprite.position.addScaledVector(f.velocity, dt);
      if (f.pop) {
        const spring = THREE.MathUtils.lerp(0.2, 1, Math.min(1, f.age / 0.12)) + Math.sin(Math.min(1, f.age / 0.3) * Math.PI) * 0.25;
        f.sprite.scale.copy(f.pop).multiplyScalar(spring); // pops up, overshoots, settles
      }
      f.sprite.material.opacity = 1 - Math.max(0, f.age / f.life - 0.6) / 0.4;
      if (f.age < f.life) return true;
      this.scene.remove(f.sprite);
      f.sprite.material.dispose();
      return false;
    });
  }
}
