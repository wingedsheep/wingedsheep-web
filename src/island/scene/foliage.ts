import * as THREE from 'three';
import type { CanopyMarker } from './island';
import { wind, windGust } from './grass';
import { GRADIENT, snowCover } from './toon';

const PALETTES: Record<string, string[]> = {
  leaf: ['#2f6a3c', '#3a7a40', '#4a8c45', '#5d9f4c'],
  pine: ['#1f4a3c', '#275640', '#2f6446'],
  autumn: ['#b04a26', '#cc622c', '#e08a3a', '#eaa748'],
  blossom: ['#d98fb0', '#e7a7c2', '#f2c3d6', '#fbe0ea'],
};

/** A little clump of leaves as an alpha-tested pixel texture. */
function leafTexture(): THREE.Texture {
  const s = 16;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  for (const [x, y, r] of [[8, 8, 5.5], [4.5, 6, 3.5], [11.5, 6.5, 3.5], [6, 11.5, 3.5], [11, 11, 3.5], [8, 3.5, 3]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * Fluffy canopies from leaf cards: camera-facing quads scattered through each canopy volume.
 * Each card is shaded with the direction from the canopy's centre, so a tree lights like one
 * soft ball, while its ragged silhouette stays pixel-crisp. Invisible spheres cast the shadows.
 */
export function createFoliage(canopies: CanopyMarker[], island: THREE.Object3D) {
  const leaves: { p: THREE.Vector3; n: THREE.Vector3; size: number; color: THREE.Color }[] = [];
  const proxies = new THREE.Group();
  const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const proxyGeo = new THREE.IcosahedronGeometry(1, 1);

  for (const c of canopies) {
    const pal = PALETTES[c.palette] ?? PALETTES.leaf;
    const count = Math.round(c.radius * c.radius * 26);
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3().randomDirection();
      dir.y = Math.abs(dir.y) * 0.8 + dir.y * 0.2; // more leaves on top
      dir.normalize();
      const r = c.radius * (0.45 + 0.55 * Math.sqrt(Math.random()));
      const p = c.position.clone().add(new THREE.Vector3(dir.x * r, dir.y * r * c.squash, dir.z * r));
      // lighter leaves towards the top, darker underneath
      const shade = THREE.MathUtils.clamp(Math.floor((dir.y * 0.5 + 0.5) * pal.length + (Math.random() - 0.5)), 0, pal.length - 1);
      leaves.push({ p, n: dir, size: c.radius * (0.42 + Math.random() * 0.2) + 0.25, color: new THREE.Color(pal[shade]) });
    }
    const proxy = new THREE.Mesh(proxyGeo, proxyMat);
    proxy.position.copy(c.position);
    proxy.scale.set(c.radius * 0.95, c.radius * 0.95 * c.squash, c.radius * 0.95);
    proxy.castShadow = true;
    if (c.owner) proxy.userData.id = c.owner; // clicking the canopy counts as clicking its tree
    proxies.add(proxy);
  }

  const quad = new THREE.PlaneGeometry(1, 1);
  const normals = new Float32Array(leaves.length * 3);
  leaves.forEach((l, i) => normals.set([l.n.x, l.n.y, l.n.z], i * 3));
  quad.setAttribute('aLeafNormal', new THREE.InstancedBufferAttribute(normals, 3));

  const mat = new THREE.MeshToonMaterial({ gradientMap: GRADIENT, map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.uniforms.uSnow = snowCover;
    shader.uniforms.uGust = windGust;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uGust;\nattribute vec3 aLeafNormal;\nvarying float vLeafUp;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = aLeafNormal;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        // billboard: place the card at the instance centre, facing the camera
        vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float scale = length(instanceMatrix[0].xyz);
        vec4 wc = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uWind * 1.3 + wc.x * 0.4 + wc.z * 0.3) * 0.06 * (1.0 + uGust * 4.0);
        // in a gale every leaf shakes on its own, and the whole crown leans downwind
        float shake = sin(uWind * 13.0 + wc.x * 3.1 + wc.y * 5.7) * uGust;
        vec2 blow = vec2(sway + shake * 0.09 + uGust * 0.12, cos(uWind * 11.0 + wc.z * 4.3) * uGust * 0.06);
        vec4 mvPosition = centre + vec4(position.xy * scale + blow, 0.0, 0.0);
        gl_Position = projectionMatrix * mvPosition;
        // snow settles on the upper leaves first; the seed keeps its edge ragged
        vLeafUp = aLeafNormal.y * 0.7 + fract(sin(wc.x * 12.9 + wc.z * 78.2) * 43758.5) * 0.3;
        `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying float vLeafUp;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), step(1.0 - uSnow * 0.9, vLeafUp) * step(0.001, uSnow));');
  };

  const mesh = new THREE.InstancedMesh(quad, mat, leaves.length);
  const m = new THREE.Matrix4();
  leaves.forEach((l, i) => {
    m.makeScale(l.size, l.size, l.size).setPosition(l.p);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, l.color);
  });
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.raycast = () => {};

  island.add(proxies);
  return mesh;
}
