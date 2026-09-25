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

/** How much snow has settled on the island, 0..1 (set by Weather). */
export const snowCover = { value: 0 };

/** How much hoar frost there is, 0..1 (set by Weather): a cold night's rime, burning off in the sun. */
export const frostCover = { value: 0 };

/**
 * Settled snow: upward-facing surfaces turn white, flat tops first and steeper slopes as it
 * deepens, with a ragged pixel edge. The shoreline stays clear. Frost is the same idea, thinner:
 * a pale speckle of rime on everything facing the sky, filling in as it gets colder.
 */
function withSnow(mat: THREE.MeshToonMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = snowCover;
    shader.uniforms.uFrost = frostCover;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowN;\nvarying vec3 vSnowP;')
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
        vSnowN = mat3(modelMatrix) * objectNormal;
        vSnowP = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;\nuniform float uFrost;\nvarying vec3 vSnowN;\nvarying vec3 vSnowP;')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        if (uSnow > 0.001) {
          float speck = fract(sin(dot(floor(vSnowP.xz * 3.0), vec2(127.1, 311.7))) * 43758.5453);
          float on = step(1.0 - uSnow * 0.95 + (speck - 0.5) * 0.25, normalize(vSnowN).y) * step(0.35, vSnowP.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), on);
        }
        if (uFrost > 0.001) {
          float rime = fract(sin(dot(floor(vSnowP.xz * 7.0), vec2(269.5, 183.3))) * 43758.5453);
          float up = smoothstep(0.35, 0.8, normalize(vSnowN).y) * step(0.35, vSnowP.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.88, 0.95), uFrost * up * (0.15 + step(rime, 0.2) * 0.3));
        }`,
      );
  };
}

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
    } else {
      withSnow(mat);
    }
    cache.set(key, mat);
  }
  return mat;
}

/** Every glowing material, so lighting can brighten them all at night. */
export function glowMaterials(): THREE.MeshToonMaterial[] {
  return [...cache.values()].filter((m) => m.userData.glow);
}
