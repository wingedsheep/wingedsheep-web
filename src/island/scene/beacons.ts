import * as THREE from 'three';
import type { Island } from './island';

const GOLD = new THREE.Color('#ffd36a');
const RING = 1.7; // radius of the ring on the ground round a cairn's foot
const BEAM = 5.5; // how high the column of light reaches

/** A ring in hard pixel steps: a bright rim, a fainter fill inside, a thin inner line. */
function ringTexture(): THREE.Texture {
  const s = 32;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - s / 2, y + 0.5 - s / 2) / (s / 2);
      const a = d > 1 ? 0 : d > 0.84 ? 1 : d > 0.72 ? 0.35 : d > 0.62 ? 0.7 : d > 0.54 ? 0 : 0.18;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** A column of light that fades out upwards, in a few bands, with a bright seam at the bottom. */
function beamTexture(): THREE.Texture {
  const h = 16;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const up = 1 - y / (h - 1); // canvas top = top of the beam
    ctx.fillStyle = `rgba(255,255,255,${y === h - 1 ? 1 : Math.round((1 - up) ** 2 * 5) / 5 * 0.8})`;
    ctx.fillRect(0, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * Quest markers on the mountain trail: every cairn stands in a pulsing ring of gold light with
 * a soft column rising from it, so the career chapters beckon from across the island.
 */
export class Beacons {
  private items: { ring: THREE.Mesh; beam: THREE.Mesh; seed: number }[] = [];
  private clock = 0;

  constructor(scene: THREE.Scene, island: Island, private reducedMotion: boolean) {
    const ringGeo = new THREE.PlaneGeometry(RING * 2, RING * 2).rotateX(-Math.PI / 2);
    const beamGeo = new THREE.CylinderGeometry(0.75, 0.95, BEAM, 12, 1, true).translate(0, BEAM / 2, 0);
    const ringMap = ringTexture();
    const beamMap = beamTexture();
    for (let i = 0; island.get(`cairn_${i}`); i++) {
      const foot = island.positionOf(`cairn_${i}`)!;
      const glow = (map: THREE.Texture) => new THREE.MeshBasicMaterial({
        map, color: GOLD, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, glow(ringMap));
      ring.position.copy(foot).add(new THREE.Vector3(0, 0.06, 0));
      const beam = new THREE.Mesh(beamGeo, glow(beamMap));
      beam.position.copy(foot);
      for (const m of [ring, beam]) {
        m.renderOrder = 2;
        m.raycast = () => {}; // clicks go through to the cairn
        scene.add(m);
      }
      this.items.push({ ring, beam, seed: i * 1.7 });
    }
  }

  /** `night`: 0 by day … 1 at night; the markers shine brighter after dark. */
  update(dt: number, night: number) {
    this.clock += dt;
    const strength = 0.55 + night * 0.45;
    for (const { ring, beam, seed } of this.items) {
      const pulse = this.reducedMotion ? 0.5 : Math.sin(this.clock * 2.2 + seed) * 0.5 + 0.5;
      ring.scale.setScalar(0.92 + pulse * 0.1);
      (ring.material as THREE.MeshBasicMaterial).opacity = strength * (0.6 + pulse * 0.4);
      (beam.material as THREE.MeshBasicMaterial).opacity = strength * (0.5 + pulse * 0.25);
    }
  }
}
