import * as THREE from 'three';
import type { CanopyMarker } from './island';
import { wind, windDir, windGust } from './grass';
import { leavesAt, season } from './season';
import { GRADIENT, frostCover, snowCover } from './toon';

const PALETTES: Record<string, string[]> = {
  leaf: ['#2f6a3c', '#3a7a40', '#4a8c45', '#5d9f4c'],
  pine: ['#1f4a3c', '#275640', '#2f6446'],
  autumn: ['#b04a26', '#cc622c', '#e08a3a', '#eaa748'],
  blossom: ['#d98fb0', '#e7a7c2', '#f2c3d6', '#fbe0ea'],
};
const FRESH = ['#3f8038', '#56993f', '#72b04c', '#92c55e']; // new leaves in spring
const TURNED: Record<string, string[]> = {
  red: ['#7a2a26', '#a0392c', '#c04e30', '#da6c3c'],
  orange: PALETTES.autumn,
  gold: ['#8c6e28', '#b48f30', '#d4ae40', '#e9cf66'],
};
const WITHERED = ['#4a4634', '#5b573c', '#6c6746', '#7d7650']; // what the bushes keep over winter

/** A steady random number for a tree, from its id. */
const hash = (n: number, k = 0) => {
  const x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * One leaf card's colour for the time of year, or null once it has fallen. Every tree runs a
 * few days ahead of or behind the others and turns its own colour; the autumn-palette trees
 * turn first. Leaves turn and fall one by one (by their seeds), so a tree thins out gradually.
 */
function leafColor(c: CanopyMarker, seed: number, colorSeed: number): string[] | null {
  const bush = c.squash < 1;
  const early = c.palette === 'autumn';
  const shift = (hash(c.tree) - 0.5) * 28 + (early ? 22 : 0);
  const { leafOut, fresh, turn, fall } = leavesAt(season.leafYear + shift);
  const cherry = c.palette === 'blossom';
  const bloom = cherry ? season.blossom : 0;
  if (bush) {
    // evergreen-ish: some leaves hang on through winter, brown and dull
    if (seed < fall * 0.6 || seed >= Math.max(leafOut, 0.4)) return null;
    if (colorSeed < Math.max(turn, 1 - leafOut)) return colorSeed < fall || leafOut < 1 ? WITHERED : TURNED[early ? 'red' : 'orange'];
  } else {
    if (seed >= Math.max(leafOut, bloom) || seed < fall) return null;
    if (colorSeed < bloom) return PALETTES.blossom;
    if (colorSeed < turn) {
      const h = hash(c.tree, 1);
      return TURNED[cherry ? 'orange' : early ? (h < 0.5 ? 'red' : 'orange') : h < 0.33 ? 'red' : h < 0.66 ? 'orange' : 'gold'];
    }
  }
  return colorSeed < fresh * (0.15 + hash(c.tree, 2) * 0.85) ? FRESH : c.palette === 'pine' ? PALETTES.pine : PALETTES.leaf;
}

const BARE = ['#4e3934', '#634d45', '#7a6558']; // twigs, once the leaves are down

/** A little clump of leaves (left half) and a spray of bare twigs (right half), as alpha-tested pixels. */
function leafTexture(): THREE.Texture {
  const s = 16;
  const c = document.createElement('canvas');
  c.width = s * 2;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  for (const [x, y, r] of [[8, 8, 5.5], [4.5, 6, 3.5], [11.5, 6.5, 3.5], [6, 11.5, 3.5], [11, 11, 3.5], [8, 3.5, 3]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // twigs: one-pixel lines forking up and out from the bottom middle
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) ctx.fillRect(s + Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
  };
  for (const [x0, y0, x1, y1] of [[8, 15, 8, 8], [8, 9, 3, 3], [8, 8, 13, 2], [8, 11, 14, 8], [8, 12, 2, 9], [5, 5, 6, 1], [11, 4, 10, 0], [4, 4, 1, 3]]) {
    line(x0, y0, x1, y1);
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
  const leaves: { p: THREE.Vector3; n: THREE.Vector3; size: number; color: THREE.Color; twig?: boolean }[] = [];
  const proxies = new THREE.Group();
  const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const proxyGeo = new THREE.IcosahedronGeometry(1, 1);

  for (const c of canopies) {
    const count = Math.round(c.radius * c.radius * 26);
    let kept = 0;
    for (let i = 0; i < count; i++) {
      let pal = leafColor(c, Math.random(), Math.random());
      // where a tree's leaves have fallen, its bare twigs show through
      const twig = !pal && c.squash >= 1 && Math.random() < 0.3;
      if (twig) pal = BARE;
      if (!pal) continue;
      if (!twig) kept++;
      const dir = new THREE.Vector3().randomDirection();
      dir.y = Math.abs(dir.y) * 0.8 + dir.y * 0.2; // more leaves on top
      dir.normalize();
      const r = c.radius * (0.45 + 0.55 * Math.sqrt(Math.random()));
      const p = c.position.clone().add(new THREE.Vector3(dir.x * r, dir.y * r * c.squash, dir.z * r));
      // lighter leaves towards the top, darker underneath
      const shade = THREE.MathUtils.clamp(Math.floor((dir.y * 0.5 + 0.5) * pal.length + (Math.random() - 0.5)), 0, pal.length - 1);
      const size = (c.radius * (0.42 + Math.random() * 0.2) + 0.25) * (twig ? 1.1 : 1);
      leaves.push({ p, n: dir, size, color: new THREE.Color(pal[shade]), twig });
    }
    const proxy = new THREE.Mesh(proxyGeo, proxyMat);
    proxy.position.copy(c.position);
    proxy.scale.set(c.radius * 0.95, c.radius * 0.95 * c.squash, c.radius * 0.95);
    proxy.castShadow = kept > count * 0.35; // a bare tree's twigs hardly shade the ground
    if (c.owner) proxy.userData.id = c.owner; // clicking the canopy counts as clicking its tree
    proxies.add(proxy);
  }

  const quad = new THREE.PlaneGeometry(1, 1);
  const normals = new Float32Array(leaves.length * 3);
  leaves.forEach((l, i) => normals.set([l.n.x, l.n.y, l.n.z], i * 3));
  quad.setAttribute('aLeafNormal', new THREE.InstancedBufferAttribute(normals, 3));
  quad.setAttribute('aTwig', new THREE.InstancedBufferAttribute(new Float32Array(leaves.map((l) => (l.twig ? 1 : 0))), 1));

  const mat = new THREE.MeshToonMaterial({ gradientMap: GRADIENT, map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.uniforms.uSnow = snowCover;
    shader.uniforms.uFrost = frostCover;
    shader.uniforms.uGust = windGust;
    shader.uniforms.uWindDir = windDir;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uGust;\nuniform vec2 uWindDir;\nattribute vec3 aLeafNormal;\nattribute float aTwig;\nvarying float vLeafUp;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv.x = vMapUv.x * 0.5 + aTwig * 0.5;')
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
        vec2 downwind = (viewMatrix * vec4(uWindDir.x, 0.0, uWindDir.y, 0.0)).xy;
        vec2 blow = downwind * (sway + shake * 0.09 + uGust * 0.12) + vec2(0.0, cos(uWind * 11.0 + wc.z * 4.3) * uGust * 0.06);
        vec4 mvPosition = centre + vec4(position.xy * scale + blow, 0.0, 0.0);
        gl_Position = projectionMatrix * mvPosition;
        // snow settles on the upper leaves first; the seed keeps its edge ragged
        vLeafUp = aLeafNormal.y * 0.7 + fract(sin(wc.x * 12.9 + wc.z * 78.2) * 43758.5) * 0.3;
        `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;\nuniform float uFrost;\nvarying float vLeafUp;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.88, 0.95), step(1.0 - uFrost * 0.35, vLeafUp) * uFrost * 0.3);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), step(1.0 - uSnow * 0.9, vLeafUp) * step(0.001, uSnow));');
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
