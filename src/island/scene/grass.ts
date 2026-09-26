import * as THREE from 'three';
import { isGrass, tintGround } from './season';
import { GRADIENT, frostCover, snowCover } from './toon';

export const wind = { value: 0 }; // shared clock uniform for everything that sways
export const windGust = { value: 0 }; // 0 calm … 1 gale: how hard things sway
export const windDir = { value: new THREE.Vector2(1, 0) }; // which way it blows (world x, z; unit)
export const drought = { value: 0 }; // 0..1: grass bleaching to straw in the heat

const BLADES_PER_M2 = 14;

/**
 * Thousands of instanced grass blades on every grassy triangle of the terrain. Blades take the
 * ground colour, shade with the ground's normal (so they read as texture, not clutter), sway
 * in the wind, and don't write depth so they never get outlined.
 */
export function createGrass(terrain: THREE.Mesh): THREE.InstancedMesh {
  const geo = terrain.geometry;
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  const index = geo.getIndex();
  const m = terrain.matrixWorld;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  const color = new THREE.Color();
  // where each blade stands and its colour, six numbers a blade (the river grows grass on every
  // tile it lays, so this stays allocation-free)
  const spots: number[] = [];
  const tris = index ? index.count / 3 : pos.count / 3;
  const at = (k: number) => (index ? index.getX(k) : k);

  for (let t = 0; t < tris; t++) {
    const i0 = at(t * 3);
    a.fromBufferAttribute(pos, i0).applyMatrix4(m);
    b.fromBufferAttribute(pos, at(t * 3 + 1)).applyMatrix4(m);
    c.fromBufferAttribute(pos, at(t * 3 + 2)).applyMatrix4(m);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    const area = n.length() / 2;
    if (n.normalize().y < 0.82) continue; // too steep
    color.fromBufferAttribute(col, i0);
    if (!isGrass(color)) continue; // only on grass
    tintGround(color);
    const count = area * BLADES_PER_M2;
    const whole = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0);
    for (let k = 0; k < whole; k++) {
      let u = Math.random();
      let v = Math.random();
      if (u + v > 1) [u, v] = [1 - u, 1 - v];
      spots.push(a.x + ab.x * u + ac.x * v, a.y + ab.y * u + ac.y * v, a.z + ab.z * u + ac.z * v, color.r, color.g, color.b);
    }
  }

  // one blade: a slim triangle, darker at the root
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, 0, 0.5, 0], 3));
  blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  blade.setAttribute('color', new THREE.Float32BufferAttribute([0.78, 0.78, 0.78, 0.78, 0.78, 0.78, 1.18, 1.18, 1.1], 3));

  const mat = new THREE.MeshToonMaterial({ gradientMap: GRADIENT, vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.uniforms.uSnow = snowCover;
    shader.uniforms.uGust = windGust;
    shader.uniforms.uWindDir = windDir;
    shader.uniforms.uDry = drought;
    shader.uniforms.uFrost = frostCover;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uSnow;\nuniform float uGust;\nuniform vec2 uWindDir;\nuniform float uFrost;\nvarying float vTip;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        vec4 rootW = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float gust = sin(uWind * 1.7 + rootW.x * 0.35 + rootW.z * 0.2) * 0.5 + sin(uWind * 3.1 + rootW.x * 1.3) * 0.2;
        // in a gale the blades flatten downwind and flutter
        gust = gust * (1.0 + uGust * 1.5) + uGust * (1.2 + sin(uWind * 11.0 + rootW.x * 2.1 + rootW.z) * 0.35);
        gust *= 1.0 - uFrost * 0.6; // frozen stiff
        vTip = position.y * 2.0;
        // downwind, turned into the blade's own (randomly rotated) frame
        vec3 downwind = vec3(uWindDir.x, 0.0, uWindDir.y) * mat3(instanceMatrix);
        transformed.xz += normalize(downwind.xz) * gust * 0.36 * position.y;
        transformed.y *= 1.0 - uSnow * 0.85; // buried in snow
        `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;\nuniform float uDry;\nuniform float uFrost;\nvarying float vTip;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.7, 0.4) * dot(diffuseColor.rgb, vec3(0.5, 0.8, 0.2)), uDry * 0.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.9, 0.96), uFrost * (0.06 + vTip * vTip * 0.3)); // rime on the tips
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), uSnow * 0.8);`,
      );
  };

  const blades = spots.length / 6;
  const mesh = new THREE.InstancedMesh(blade, mat, blades);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < blades; i++) {
    const o = i * 6;
    // turned a random way about y, and a random height
    const turn = Math.random() * Math.PI;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const s = 0.7 + Math.random() * 0.7;
    matrix.set(cos, 0, sin, spots[o], 0, s, 0, spots[o + 1], -sin, 0, cos, spots[o + 2], 0, 0, 0, 1);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.setRGB(spots[o + 3], spots[o + 4], spots[o + 5]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.05));
  }
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mat.depthWrite = false;
  mesh.raycast = () => {}; // never pickable
  return mesh;
}
