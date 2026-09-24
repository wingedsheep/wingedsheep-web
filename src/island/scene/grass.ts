import * as THREE from 'three';
import { GRADIENT } from './toon';

export const wind = { value: 0 }; // shared clock uniform for everything that sways

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
  const n = new THREE.Vector3();
  const color = new THREE.Color();
  const spots: { p: THREE.Vector3; c: THREE.Color }[] = [];
  const tris = index ? index.count / 3 : pos.count / 3;

  for (let t = 0; t < tris; t++) {
    const [i0, i1, i2] = [0, 1, 2].map((k) => (index ? index.getX(t * 3 + k) : t * 3 + k));
    a.fromBufferAttribute(pos, i0).applyMatrix4(m);
    b.fromBufferAttribute(pos, i1).applyMatrix4(m);
    c.fromBufferAttribute(pos, i2).applyMatrix4(m);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const area = n.length() / 2;
    if (n.normalize().y < 0.82) continue; // too steep
    color.fromBufferAttribute(col, i0);
    if (!(color.g > color.r * 1.15 && color.g > color.b * 1.1)) continue; // only on grass
    const count = area * BLADES_PER_M2;
    const whole = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0);
    for (let k = 0; k < whole; k++) {
      let u = Math.random();
      let v = Math.random();
      if (u + v > 1) [u, v] = [1 - u, 1 - v];
      const p = a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
      spots.push({ p, c: color.clone() });
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
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        vec4 rootW = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float gust = sin(uWind * 1.7 + rootW.x * 0.35 + rootW.z * 0.2) * 0.5 + sin(uWind * 3.1 + rootW.x * 1.3) * 0.2;
        transformed.x += gust * 0.16 * position.y * 2.0;
        transformed.z += gust * 0.08 * position.y * 2.0;
        `,
      );
  };

  const mesh = new THREE.InstancedMesh(blade, mat, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach(({ p, c }, i) => {
    dummy.position.copy(p);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    const s = 0.7 + Math.random() * 0.7;
    dummy.scale.set(1, s, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05));
  });
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mat.depthWrite = false;
  mesh.raycast = () => {}; // never pickable
  return mesh;
}
