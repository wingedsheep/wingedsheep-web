import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toon } from './toon';

export interface LightMarker {
  position: THREE.Vector3; // world
  color: THREE.Color;
  radius: number;
  intensity: number;
  flicker: number;
  day: boolean;
}

export interface CanopyMarker {
  position: THREE.Vector3;
  radius: number;
  palette: string;
  squash: number;
  owner?: string; // id of the named thing this canopy belongs to (e.g. "blossom")
}

export interface Emitter {
  kind: 'smoke' | 'embers' | 'petals';
  position: THREE.Vector3;
}

export interface IslandInfo {
  extent: [number, number, number, number]; // min x, min y(north), max x, max y — Blender coords
  cell: number;
}

/**
 * The island as exported from Blender (tools/models), with its markers resolved:
 * named things you can click, lights, canopies, particle emitters and animated parts.
 */
export class Island {
  readonly root: THREE.Group;
  readonly terrain: THREE.Mesh;
  readonly named = new Map<string, THREE.Object3D>();
  readonly lights: LightMarker[] = [];
  readonly canopies: CanopyMarker[] = [];
  readonly emitters: Emitter[] = [];
  readonly shore: THREE.Texture;
  readonly info: IslandInfo;

  private constructor(root: THREE.Group, shore: THREE.Texture, info: IslandInfo) {
    this.root = root;
    this.shore = shore;
    this.info = info;
    root.updateMatrixWorld(true);

    let terrain: THREE.Mesh | undefined;
    root.traverse((o) => {
      const x = o.userData;
      if (x.id && !this.named.has(x.id)) this.named.set(x.id, o);
      if (x.light) {
        this.lights.push({
          position: o.getWorldPosition(new THREE.Vector3()),
          color: new THREE.Color(x.color),
          radius: x.radius,
          intensity: x.intensity,
          flicker: x.flicker,
          day: Boolean(x.day),
        });
      }
      if (x.canopy) {
        this.canopies.push({
          position: o.getWorldPosition(new THREE.Vector3()),
          radius: x.canopy,
          palette: x.palette,
          squash: x.squash ?? 1,
          owner: ownerId(o),
        });
      }
      if (x.emit) this.emitters.push({ kind: x.emit, position: o.getWorldPosition(new THREE.Vector3()) });
      if (x.terrain) terrain = o as THREE.Mesh;

      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glow = src.name.startsWith('glow_');
        mesh.material = toon(src.color, { glow, vertexColors: Boolean(x.terrain) || src.name === 'terrain' });
        if (src.name === 'terrain') terrain = mesh;
        mesh.castShadow = !glow;
        mesh.receiveShadow = true;
      }
    });
    if (!terrain) throw new Error('island.glb has no terrain');
    this.terrain = terrain;
    (terrain.material as THREE.MeshToonMaterial).color.set(0xffffff);
    terrain.castShadow = true;
  }

  static async load(base = '/models/'): Promise<Island> {
    const [gltf, shore, info] = await Promise.all([
      new GLTFLoader().loadAsync(`${base}island.glb`),
      new THREE.TextureLoader().loadAsync(`${base}shore.png`),
      fetch(`${base}island.json`).then((r) => r.json() as Promise<IslandInfo>),
    ]);
    shore.magFilter = THREE.LinearFilter;
    shore.colorSpace = THREE.NoColorSpace;
    return new Island(gltf.scene, shore, info);
  }

  get(id: string) {
    return this.named.get(id);
  }

  /** A child part by name (e.g. "flag", "arm_strum", "wing_l"). */
  part(id: string, name: string) {
    return this.get(id)?.getObjectByName(name);
  }

  /** World position of a named thing (its foot). */
  positionOf(id: string) {
    return this.get(id)?.getWorldPosition(new THREE.Vector3());
  }
}

function ownerId(o: THREE.Object3D): string | undefined {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.id) return p.userData.id;
  return undefined;
}
