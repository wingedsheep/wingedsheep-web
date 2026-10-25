import * as THREE from 'three';
import type { Ground } from './beike';
import type { Island } from './island';
import { ROUTE_POINTS } from './outings';
import type { Waypoint } from './shelter';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/**
 * The paths across the island that aren't a route of anybody's (Blender x, y; layout.py PATHS),
 * to go with the ones that are (the strolls, the ways in out of the rain, the trail).
 */
const PATHS: [number, number, 'deck'?][][] = [
  [[0.2, -18.4, 'deck'], [0.2, -21.5, 'deck'], [0.3, -25.2, 'deck']], // out along the pier
  [[0, -17.5], [0, -12.5]], // dock -> plaza
  [[0, -12.5], [0, -8], [0, -4]], // across the plaza to the foot of the trail
  [[-4, -7.5], [-8, -7], [-11, -7.2]], // plaza -> library
  [[4, -7.5], [8, -7], [11.5, -7.2]], // plaza -> workshop
  [[0, -8], [-4, -7.5]],
  [[0, -8], [4, -7.5]],
  [[0, -8], [3.6, -9.5]],
  [[3.6, -9.5], [9, -11], [15, -10.5], [21, -6], [25, -2.5]], // -> campfire
  [[-11, -7.2], [-14, -7.5], [-20, -5.5], [-26, -4]], // library -> lighthouse
  [[4, -10], [12, -13], [18.5, -14]], // -> well
  [[25, -2.5], [29.5, -2.4], [32.6, -1.6]], // across the glade from the fire, to where the tent goes up (layout.py CAMP)
];
/** Two ways meet where their points come this close (metres). */
const JOIN = 2.6;
/** From somewhere off the paths, how far to look for one. */
const REACH = 7;
/** Too steep to walk, between two samples a quarter metre apart: a cliff, or a building's wall. */
const STEP = 0.32;

interface Node {
  at: THREE.Vector3;
  fixed: boolean;
  next: Map<number, number>; // node -> metres
}

/**
 * Every way there is to walk across the island, as one network, for getting from one thing to
 * the next with someone watching (vincent.ts, companion.ts): out along the nearest way, round by
 * the shortest, and off it again to where they're going. A straight line, if nothing's in the way.
 */
export class Ways {
  private nodes: Node[] = [];

  constructor(
    island: Island,
    private ground: Ground,
  ) {
    const lines: Waypoint[][] = [];
    const flat = (pts: [number, number, string?][]) => pts.map(([x, y, on]) => (on === 'deck' ? { at: V(x, 0.84, -y), fixed: true } : { at: V(x, ground.at(x, -y), -y), fixed: false }));
    for (const p of PATHS) lines.push(flat(p));
    for (const p of ROUTE_POINTS) lines.push(flat(p));
    for (const name of ['bench', 'dock', 'climb']) {
      const r = island.routes.get(name);
      if (r?.length) lines.push(r.filter(Boolean));
    }
    for (const line of lines) {
      let prev = -1;
      for (const w of line) {
        if (Number.isNaN(w.at.y)) continue;
        const i = this.add(w.at, w.fixed);
        if (prev >= 0 && prev !== i) this.link(prev, i, true);
        prev = i;
      }
    }
    // where two ways come close, they meet
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];
        if (!a.next.has(j) && a.at.distanceTo(b.at) < JOIN) this.link(i, j);
      }
    }
  }

  /** A node at `at` (or the one already there). */
  private add(at: THREE.Vector3, fixed: boolean) {
    const same = this.nodes.findIndex((n) => n.at.distanceTo(at) < 0.3);
    if (same >= 0) return same;
    this.nodes.push({ at: at.clone(), fixed, next: new Map() });
    return this.nodes.length - 1;
  }

  /** Join two nodes, if a body can walk straight from one to the other (or they're on a way already: `known`). */
  private link(i: number, j: number, known = false) {
    const a = this.nodes[i];
    const b = this.nodes[j];
    if (!known && !this.clear(a, b)) return false;
    const d = a.at.distanceTo(b.at);
    a.next.set(j, d);
    b.next.set(i, d);
    return true;
  }

  /** Nothing but walkable ground between them: no cliff, no wall, no water. */
  private clear(a: { at: THREE.Vector3; fixed: boolean }, b: { at: THREE.Vector3; fixed: boolean }) {
    if (a.fixed || b.fixed) return a.at.distanceTo(b.at) < 1.2; // onto the deck or a plinth only where the way does
    const n = Math.ceil(a.at.distanceTo(b.at) / 0.25);
    let last = a.at.y;
    for (let k = 1; k <= n; k++) {
      const p = V().lerpVectors(a.at, b.at, k / n);
      const y = this.ground.at(p.x, p.z);
      if (Number.isNaN(y) || y < 0.15 || Math.abs(y - last) > STEP) return false;
      last = y;
    }
    return true;
  }

  /**
   * The way from `from` to `to` (on the ground, or up on the pier's deck: `fixed`), as waypoints:
   * straight there if the ground allows, otherwise onto the network, round it and off again. Null
   * if there's no way.
   */
  between(from: Waypoint, to: Waypoint): Waypoint[] | null {
    const start = { at: from.at.clone(), fixed: from.fixed };
    const end = { at: to.at.clone(), fixed: to.fixed };
    if (start.at.distanceTo(end.at) < 9 && this.clear(start, end)) return [start, end];
    const ins = this.near(start);
    const outs = new Map(this.near(end).map(([i, d]) => [i, d]));
    if (!ins.length || !outs.size) return null;
    // Dijkstra from wherever they can get on, to wherever they can get off
    const dist = new Map<number, number>();
    const back = new Map<number, number>();
    const open = new Set<number>();
    for (const [i, d] of ins) {
      dist.set(i, d);
      open.add(i);
    }
    let best = Infinity;
    let last = -1;
    while (open.size) {
      let i = -1;
      for (const k of open) if (i < 0 || dist.get(k)! < dist.get(i)!) i = k;
      open.delete(i);
      const d = dist.get(i)!;
      if (d >= best) break;
      const off = outs.get(i);
      if (off !== undefined && d + off < best) {
        best = d + off;
        last = i;
      }
      for (const [j, w] of this.nodes[i].next) {
        if (d + w < (dist.get(j) ?? Infinity)) {
          dist.set(j, d + w);
          back.set(j, i);
          open.add(j);
        }
      }
    }
    if (last < 0) return null;
    const way: Waypoint[] = [];
    for (let i: number | undefined = last; i !== undefined; i = back.get(i)) way.unshift({ at: this.nodes[i].at.clone(), fixed: this.nodes[i].fixed });
    return [start, ...way, end];
  }

  /** The nodes within reach of a point that can be walked to straight, with how far. */
  private near(p: { at: THREE.Vector3; fixed: boolean }): [number, number][] {
    const found: [number, number][] = [];
    this.nodes.forEach((n, i) => {
      const d = n.at.distanceTo(p.at);
      if (d < REACH && (p.fixed ? n.fixed && d < 1.2 : !n.fixed && this.clear(p, n))) found.push([i, d]);
    });
    return found.sort((a, b) => a[1] - b[1]).slice(0, 4);
  }

  /** The whole network as line segments (for a look at it: `?ways`). */
  segments() {
    const out: THREE.Vector3[] = [];
    this.nodes.forEach((n, i) => {
      for (const j of n.next.keys()) if (j > i) out.push(n.at, this.nodes[j].at);
    });
    return out;
  }
}
