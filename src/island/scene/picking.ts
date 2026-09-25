import * as THREE from 'three';

const HIGHLIGHT = new THREE.Color(0x3a2e14);

/**
 * Finds the named thing under the pointer and gives it a warm highlight on hover.
 * Only registered targets are tested, which keeps it cheap enough to run on every move.
 */
export class Picker {
  private ray = new THREE.Raycaster();
  private targets: THREE.Object3D[] = [];
  private lit: THREE.Object3D | null = null;
  private originals = new WeakMap<THREE.Mesh, THREE.Material>();
  private glowing = new Map<THREE.Material, THREE.Material>();

  constructor(private camera: THREE.Camera) {}

  add(...objects: THREE.Object3D[]) {
    this.targets.push(...objects);
  }

  pick(ndc: THREE.Vector2): { id: string; point: THREE.Vector3 } | null {
    this.ray.setFromCamera(ndc, this.camera);
    for (const hit of this.ray.intersectObjects(this.targets, true)) {
      if (!hit.object.visible) continue;
      const id = idOf(hit.object);
      if (id) return { id, point: hit.point };
    }
    return null;
  }

  highlight(root: THREE.Object3D | null) {
    if (root === this.lit) return;
    if (this.lit) this.swap(this.lit, false);
    if (root) this.swap(root, true);
    this.lit = root;
  }

  private swap(root: THREE.Object3D, on: boolean) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      if (on) {
        const src = mesh.material as THREE.MeshToonMaterial;
        let lit = this.glowing.get(src);
        if (!lit) {
          lit = src.clone();
          lit.onBeforeCompile = src.onBeforeCompile; // clone() drops shader hooks (e.g. snow cover)
          (lit as THREE.MeshToonMaterial).emissive?.add(HIGHLIGHT);
          this.glowing.set(src, lit);
        }
        this.originals.set(mesh, src);
        mesh.material = lit;
      } else {
        const src = this.originals.get(mesh);
        if (src) mesh.material = src;
      }
    });
  }
}

export function idOf(o: THREE.Object3D | null): string | undefined {
  for (let p = o; p; p = p.parent) if (p.userData.id) return p.userData.id;
  return undefined;
}
