import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toon } from '../scene/toon';

/**
 * The river's furniture (tools/models/river.py): one template of each thing, keyed by its
 * `river` kind, with the Blender colours swapped for the island's toon materials. Clones share
 * geometry and materials, so scattering hundreds of trees costs little.
 */
export class RiverAssets {
  private templates = new Map<string, THREE.Object3D>();
  /** What a template knows about itself (a rock's radius, a log's length, a bridge's span). */
  readonly extras = new Map<string, Record<string, number>>();

  static async load(base = '/models/'): Promise<RiverAssets> {
    const gltf = await new GLTFLoader().loadAsync(`${base}river.glb?v=${__MODELS__}`);
    return new RiverAssets(gltf.scene);
  }

  private constructor(root: THREE.Group) {
    root.updateMatrixWorld(true);
    for (const o of [...root.children]) {
      const kind = o.userData.river as string | undefined;
      if (!kind) continue;
      o.removeFromParent();
      o.position.set(0, 0, 0);
      o.updateMatrixWorld(true);
      o.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const glow = src.name.startsWith('glow_');
        mesh.material = toon(src.color, { glow });
        mesh.castShadow = !glow;
        mesh.receiveShadow = true;
      });
      this.templates.set(kind, o);
      this.extras.set(kind, o.userData as Record<string, number>);
    }
  }

  has(kind: string) {
    return this.templates.has(kind);
  }

  /** A fresh copy of a template (sharing its geometry and materials). */
  clone(kind: string): THREE.Object3D {
    const t = this.templates.get(kind);
    if (!t) throw new Error(`river.glb has no ${kind}`);
    return t.clone(true);
  }
}
