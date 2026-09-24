import * as THREE from 'three';

/**
 * Banded ("toon") lighting: diffuse light snaps to a few steps, which is what makes the
 * low-res render read as pixel art instead of smooth 3D.
 */
function gradient(steps: number[]): THREE.DataTexture {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const GRADIENT = gradient([90, 150, 205, 255]);

const cache = new Map<string, THREE.MeshToonMaterial>();

/** Shared toon material for a flat colour (or a glowing one). */
export function toon(color: THREE.Color, opts: { glow?: boolean; vertexColors?: boolean } = {}) {
  const key = `${color.getHexString()}:${opts.glow ? 1 : 0}:${opts.vertexColors ? 1 : 0}`;
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshToonMaterial({
      color,
      gradientMap: GRADIENT,
      vertexColors: opts.vertexColors,
    });
    if (opts.glow) {
      mat.emissive = color.clone();
      mat.emissiveIntensity = 0.25;
      mat.userData.glow = true;
    }
    cache.set(key, mat);
  }
  return mat;
}

/** Every glowing material, so lighting can brighten them all at night. */
export function glowMaterials(): THREE.MeshToonMaterial[] {
  return [...cache.values()].filter((m) => m.userData.glow);
}
