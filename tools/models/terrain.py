"""Island terrain: a heightfield with terraced cliffs, flat-shaded with per-face colours.

Also exports `shore.png`, a distance-from-land map the runtime's water shader uses for
shallows and foam.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import bmesh
import bpy
import numpy as np

import palette as P
from layout import CELL, EXTENT, ISLAND, PATHS, PEAK, PLATEAUS, PLAZA, STAIRS, SWITCHBACKS, TRAIL

X0, Y0, X1, Y1 = EXTENT
PEAK_LEVEL = 9  # level id for cells on the mountain peak (terraces are 0, 1; the lighthouse rock is 2)
NX = int((X1 - X0) / CELL) + 1
NY = int((Y1 - Y0) / CELL) + 1
XS = X0 + np.arange(NX) * CELL
YS = Y0 + np.arange(NY) * CELL
GX, GY = np.meshgrid(XS, YS)          # [iy, ix]


def noise(scale: float, seed: int, octaves: int = 3) -> np.ndarray:
    """Smooth value noise sampled on the terrain grid (world-space scale in metres)."""
    rng = np.random.default_rng(seed)
    out = np.zeros_like(GX)
    amp, total, s = 1.0, 0.0, scale
    for _ in range(octaves):
        gw, gh = int((X1 - X0) / s) + 3, int((Y1 - Y0) / s) + 3
        g = rng.random((gh, gw))
        fx, fy = (GX - X0) / s, (GY - Y0) / s
        ix, iy = fx.astype(int), fy.astype(int)
        tx, ty = fx - ix, fy - iy
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        a, b = g[iy, ix], g[iy, ix + 1]
        c, d = g[iy + 1, ix], g[iy + 1, ix + 1]
        out += amp * ((a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty)
        total += amp
        amp *= 0.5
        s /= 2
    return out / total


def blob(ellipses, n, amount) -> np.ndarray:
    f = np.full(GX.shape, -9.0)
    for cx, cy, rx, ry in ellipses:
        f = np.maximum(f, 1 - np.sqrt(((GX - cx) / rx) ** 2 + ((GY - cy) / ry) ** 2))
    return f + (n - 0.5) * amount


def stroke(polyline, width) -> np.ndarray:
    d = np.full(GX.shape, 1e9)
    for (x0, y0), (x1, y1) in zip(polyline, polyline[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((GX - x0) * dx + (GY - y0) * dy) / max(dx * dx + dy * dy, 1e-6), 0, 1)
        d = np.minimum(d, np.hypot(GX - (x0 + t * dx), GY - (y0 + t * dy)))
    return d <= width / 2


def nearest(polyline):
    """Distance to a polyline, and the nearest point on it, for every grid cell."""
    d = np.full(GX.shape, 1e9)
    nx, ny = np.zeros(GX.shape), np.zeros(GX.shape)
    for (x0, y0), (x1, y1) in zip(polyline, polyline[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((GX - x0) * dx + (GY - y0) * dy) / max(dx * dx + dy * dy, 1e-6), 0, 1)
        qx, qy = x0 + t * dx, y0 + t * dy
        dd = np.hypot(GX - qx, GY - qy)
        closer = dd < d
        d, nx, ny = np.where(closer, dd, d), np.where(closer, qx, nx), np.where(closer, qy, ny)
    return d, nx, ny


def distance(mask: np.ndarray, limit: int) -> np.ndarray:
    """Grid distance (in cells) from outside `mask`, capped at `limit`."""
    d = np.zeros(mask.shape, np.int32)
    cur = mask.copy()
    for i in range(1, limit + 1):
        shrunk = cur.copy()
        shrunk[1:, :] &= cur[:-1, :]
        shrunk[:-1, :] &= cur[1:, :]
        shrunk[:, 1:] &= cur[:, :-1]
        shrunk[:, :-1] &= cur[:, 1:]
        cur = shrunk
        d[cur] = i
        if not cur.any():
            break
    return d


@dataclass
class Terrain:
    height: np.ndarray
    land: np.ndarray
    level: np.ndarray          # plateau index per cell (-1 = ground)
    path: np.ndarray
    plaza: np.ndarray
    shore: np.ndarray          # 0 at the coast … 1 far out at sea
    trail: np.ndarray          # the mountain trail (also in `path`)
    stair: np.ndarray          # the stone steps up the cliffs

    def sample(self, x: float, y: float) -> float:
        """Terrain height at a world position (bilinear)."""
        fx, fy = (x - X0) / CELL, (y - Y0) / CELL
        ix, iy = int(fx), int(fy)
        tx, ty = fx - ix, fy - iy
        h = self.height
        return float((h[iy, ix] * (1 - tx) + h[iy, ix + 1] * tx) * (1 - ty)
                     + (h[iy + 1, ix] * (1 - tx) + h[iy + 1, ix + 1] * tx) * ty)

    def level_at(self, x: float, y: float) -> int:
        return int(self.level[int(round((y - Y0) / CELL)), int(round((x - X0) / CELL))])


def generate() -> Terrain:
    n_big, n_mid, n_fine = noise(14, 1, 4), noise(5, 2, 3), noise(1.5, 3, 2)

    land = blob(ISLAND, n_big, 0.3) > 0.02
    inland = distance(land, 40) * CELL                  # metres from the coast
    sea_d = distance(~land, 40) * CELL

    # ground: beach rising into gently rolling grass
    h = np.where(land, 0.14 + np.clip((inland - 2.0) / 3.0, 0, 1) * 0.7 + np.clip(inland / 2.0, 0, 1) * 0.1 + (n_mid - 0.5) * 0.35 * np.clip(inland / 6, 0, 1), 0.0)
    h = np.where(land, h, -0.5 - np.clip(sea_d / 3, 0, 1) * 1.5)

    level = np.full(GX.shape, -1)
    masks = []
    for k, (ells, top) in enumerate(PLATEAUS):
        m = (blob(ells, noise(4, 40 + k, 3), 0.28) > 0) & (distance(land, 6) >= 4)
        if k == 1:                                        # the upper terrace sits on the lower one
            m &= distance(masks[k - 1], 4) >= 3
        dome = np.clip(distance(m, 8) * CELL / 4, 0, 1) * 0.5    # tops swell gently inwards
        h = np.where(m, top + dome + (n_fine - 0.5) * 0.25, h)
        level[m] = k
        masks.append(m)

    # the peak: a ridged cone on the upper terrace, with a small flat ledge on top for the flag,
    # and a lower shoulder to the west so the massif has a skyline
    (px, py), pr, ph = PEAK
    base = PLATEAUS[1][1]
    dx, dy = GX - px, (GY - py) * 1.25
    ang = np.arctan2(dy, dx)
    reach = 1 + 0.14 * np.cos(5 * ang + 0.6) + 0.06 * np.cos(9 * ang + 2.0)    # spurs and gullies
    d = np.hypot(dx, dy) / (pr * reach)
    smooth = base + (ph - base) * np.clip(1 - d, 0, 1) ** 1.15
    sd = np.hypot(GX - 0.2, (GY - 16.6) * 1.3) / 3.4
    smooth = np.maximum(smooth, base + 3.4 * np.clip(1 - sd, 0, 1) ** 1.1)
    cone = smooth + (n_mid - 0.5) * 0.5 * ((d < 0.85) | (sd < 0.8))
    peak = ((d < 1) | (sd < 1)) & (level == 1)
    ground = h.copy()
    h = np.where(peak, np.where(d < 0.14, ph, np.maximum(h, cone)), h)
    level[peak & (cone > base + 0.5)] = PEAK_LEVEL

    # the trail zigzags up the peak on a ledge: level across, following the slope along
    sw, qx, qy = nearest(SWITCHBACKS)
    qi = np.clip(np.round((qx - X0) / CELL).astype(int), 0, NX - 1)
    qj = np.clip(np.round((qy - Y0) / CELL).astype(int), 0, NY - 1)
    ref = np.where(peak, np.where(d < 0.14, ph, np.maximum(ground, smooth)), h)
    bench = (sw <= 0.8) & (peak | (level == 1))
    h = np.where(bench, ref[qj, qi], h)

    # paths and plaza are pressed slightly into the ground
    trail = bench.copy()
    for pl, w in TRAIL:
        trail |= stroke(pl, w)
    path = trail.copy()
    for pl, w in PATHS:
        path |= stroke(pl, w + (0.3 if w > 1.2 else 0))
    plaza = stroke([PLAZA, PLAZA], 9.5) & land
    path &= land & ~plaza
    trail &= land & ~plaza
    ground_path = path & (level < 0)
    h = np.where(ground_path, h - 0.06, h)
    h = np.where(plaza, 0.86, h)

    # stairs: stepped ramps of stone from the ground at y0 up to the ground at y1
    stair = np.zeros(GX.shape, bool)
    for sx, y0, y1 in STAIRS:
        at = lambda y: h[int(round((y - Y0) / CELL)), int(round((sx - X0) / CELL))]  # noqa: E731
        lo, hi = at(y0), at(y1)
        ramp = (np.abs(GX - sx) <= 0.8) & (GY >= y0) & (GY <= y1)
        t = np.clip((GY - y0) / (y1 - y0), 0, 1)
        steps = max(4, int((hi - lo) / 0.45))
        h = np.where(ramp, lo + np.floor(t * steps) / steps * (hi - lo), h)
        stair |= ramp
    path |= stair
    trail &= ~stair

    shore = np.clip(sea_d / 14.0, 0, 1)
    shore[land] = 0
    return Terrain(h, land, level, path, plaza, shore, trail, stair)


def face_color(t: Terrain, ix: int, iy: int, nz: float, avg_h: float, rng) -> str:
    x, y = XS[ix], YS[iy]
    if not t.land[iy, ix]:
        return P.SAND_WET
    if t.stair[iy, ix]:                                   # under the stone steps (props.steps)
        return P.STONE_DARK
    if t.trail[iy, ix] and nz >= 0.5:                     # pale gravel (pebbles line it: props.trail_edge)
        return P.GRAVEL[(ix * 7 + iy * 3) % 5 == 0]
    if t.level[iy, ix] == PEAK_LEVEL:
        return _peak_color(ix, iy, nz, avg_h)
    if nz < 0.6:                                          # cliff face
        band = int((avg_h * 1.4 + (ix * 7 + iy * 3) % 3 * 0.4)) % len(P.ROCK)
        return P.ROCK[band]
    if t.plaza[iy, ix]:
        r = math.hypot(x - PLAZA[0], y - PLAZA[1])
        if r < 0.3 or (r < 2.2 and (abs(x - PLAZA[0]) < 0.3 or abs(y - PLAZA[1]) < 0.3)):
            return P.GOLD                                  # a compass inlay
        return P.COBBLE[(ix // 2 + iy // 2 + (ix * iy) % 3) % len(P.COBBLE)] if r < 4.5 else P.STONE_DARK
    if t.path[iy, ix]:
        return P.DIRT_LIGHT if rng.random() < 0.3 else P.DIRT
    if avg_h < 0.42 and t.level[iy, ix] < 0:
        return P.SAND_WET if avg_h < 0.17 else (P.SAND if rng.random() < 0.7 else P.SAND_LIGHT)
    lvl = t.level[iy, ix]
    if lvl == 2:                                          # lighthouse rock
        return P.ROCK[2 + (ix + iy) % 2]
    ramp = P.GRASS_HIGH if lvl == 1 else P.GRASS
    v = _grass_tone[iy, ix] + rng.uniform(-0.12, 0.12)
    return ramp[min(len(ramp) - 1, max(0, int(v * len(ramp))))]


_grass_tone = noise(9, 7, 3)
_snow_line = noise(2.5, 8, 2)


def _peak_color(ix: int, iy: int, nz: float, avg_h: float) -> str:
    """The peak in bands: alpine meadow, scree and rock, then a ragged snow cap."""
    n = _snow_line[iy, ix] - 0.5
    if avg_h > 11.0 + n * 2.4:
        return P.SNOW if nz > 0.72 else P.SNOW_SHADE
    if avg_h > 8.8 + n * 1.8 or nz < 0.62:
        if int(avg_h * 1.7) % 5 == 0:                     # a pale stratum
            return P.PEAK_ROCK[3]
        return P.PEAK_ROCK[0 if nz < 0.45 else 1 if nz < 0.7 else 2]
    return P.GRASS_HIGH[(ix * 3 + iy) % 3]


def build_mesh(t: Terrain) -> bpy.types.Object:
    rng = np.random.default_rng(3)
    jitter = noise(1.0, 9, 1)
    bm = bmesh.new()
    verts = {}
    h = t.height
    for iy in range(NY):
        for ix in range(NX):
            z = h[iy, ix]
            x, y = XS[ix], YS[iy]
            # roughen cliff edges so terraces don't look extruded
            if 0 < iy < NY - 1 and 0 < ix < NX - 1:
                steep = max(abs(h[iy, ix + 1] - h[iy, ix - 1]), abs(h[iy + 1, ix] - h[iy - 1, ix]))
                if steep > 1.2:
                    x += (jitter[iy, ix] - 0.5) * 0.45
                    z += (jitter[iy, ix] - 0.5) * 0.3
            verts[ix, iy] = bm.verts.new((x, y, z))

    colors = {}
    for iy in range(NY - 1):
        for ix in range(NX - 1):
            # skip deep sea: the runtime's water plane covers it
            if not (t.land[iy:iy + 2, ix:ix + 2].any()) and t.shore[iy, ix] > 0.12:
                continue
            quad = [verts[ix, iy], verts[ix + 1, iy], verts[ix + 1, iy + 1], verts[ix, iy + 1]]
            # alternate the diagonal for a less regular look
            tris = ([quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]) if (ix + iy) % 2 else \
                   ([quad[0], quad[1], quad[3]], [quad[1], quad[2], quad[3]])
            faces = [bm.faces.new(tri) for tri in tris]
            for f in faces:
                f.normal_update()
            # one colour per quad keeps the ground calm; the steepest triangle decides "cliff"
            nz = min(f.normal.z for f in faces)
            avg = sum(v.co.z for v in quad) / 4
            c = face_color(t, ix, iy, nz, avg, rng)
            for f in faces:
                colors[f] = c

    bm.verts.ensure_lookup_table()
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")

    # a byte colour layer holds sRGB (the glTF exporter linearises it), so no rgb() here:
    # converting first darkened the whole island twice over
    layer = bm.loops.layers.color.new("Col")
    cache = {}
    for f, hex_ in colors.items():
        h = hex_.lstrip("#")
        c = cache.setdefault(hex_, (*(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)), 1.0))
        for loop in f.loops:
            loop[layer] = c

    mesh = bpy.data.meshes.new("terrain")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("terrain", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["terrain"] = 1
    # a material that uses the vertex colours so the exporter keeps them
    mat = bpy.data.materials.new("terrain")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    mesh.materials.append(mat)
    return obj


def save_shore(t: Terrain, path: str):
    img = bpy.data.images.new("shore", NX, NY, alpha=False)
    px = np.zeros((NY, NX, 4), np.float32)
    px[..., 0] = t.shore
    px[..., 1] = t.land.astype(np.float32)
    px[..., 3] = 1
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
