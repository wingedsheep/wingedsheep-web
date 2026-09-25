"""Places every model on the island: hand-placed landmarks plus a seeded scatter of nature."""
from __future__ import annotations

import math
import random

import buildings
import characters
import layout as L
import nature
import props
from kit import group
from terrain import Terrain


def place(t: Terrain, name: str, x: float, y: float, build, rot_z=0.0, z=None, **extras):
    """Create a root empty on the ground at (x, y) and let `build(root)` fill it."""
    root = group(name, (x, y, t.sample(x, y) if z is None else z), rot_z=rot_z, **extras)
    build(root)
    return root


def landmarks(t: Terrain):
    cx, cy = L.CAMPFIRE
    dx, dy = L.DOCK
    pier_z = 0.0
    place(t, "library", *L.LIBRARY, buildings.library, id="library")
    place(t, "workshop", *L.WORKSHOP, buildings.workshop, id="workshop")
    place(t, "lighthouse", *L.LIGHTHOUSE, buildings.lighthouse, id="lighthouse")
    place(t, "dock", dx, dy + 1.0, lambda r: props.pier(r, L.DOCK_LEN), z=pier_z, id="dock")
    place(t, "cat", dx + 0.4, dy - L.DOCK_LEN + 1.6, characters.cat, z=0.84, id="cat")
    place(t, "kayak", *L.KAYAK, props.kayak, z=0.05, rot_z=0.25, id="kayak")
    place(t, "signpost", *L.SIGNPOST, props.signpost, id="signpost")
    place(t, "card_table", L.WORKSHOP[0] - 5.2, L.WORKSHOP[1] - 4.6, props.card_table, id="card_table")
    place(t, "campfire", cx, cy, props.campfire, id="campfire")
    # Vincent sits on the far side of the fire, facing it and the default camera, clear of the trees
    place(t, "vincent", cx + 0.2, cy + 2.2, characters.vincent, rot_z=-0.1, id="vincent")
    place(t, "guitar_case", cx + 2.5, cy + 3.0, props.guitar_case, rot_z=-0.4, id="guitar_case")
    place(t, "log", cx + 2.0, cy - 0.4, props.log_seat, rot_z=1.9)
    place(t, "log", cx - 2.2, cy + 0.6, props.log_seat, rot_z=-1.3)
    place(t, "well", *L.WELL, props.well, id="well")
    place(t, "blossom", L.WELL[0] + 2.8, L.WELL[1] + 1.8, nature.blossom, id="blossom")
    place(t, "bench", *L.BENCH, props.bench, rot_z=0.3, id="bench")
    place(t, "boulder", *L.BOULDER, props.boulder, id="boulder")
    place(t, "summit", *L.SUMMIT, props.summit_flag, id="summit")
    for i, (x, y) in enumerate(L.CAIRNS):
        place(t, f"cairn_{i}", x, y, lambda r, i=i: props.cairn(r, 40 + i), id=f"cairn_{i}")
    px, py = L.PLAZA
    for x, y in [(px - 5.2, py + 3), (px + 5.2, py + 3), (px - 5, py - 3.6), (px + 5, py - 3.6),
                 (dx - 1.6, dy + 0.4), (L.LIBRARY[0] + 6, L.LIBRARY[1] - 3.4), (cx - 4, cy - 3)]:
        place(t, "lamp", x, y, props.lamp)

    # things the runtime moves around; parked out of sight
    characters.sheep(group("sheep", (0, 0, 30), id="sheep"))
    props.ufo(group("ufo", (0, 0, 40), id="ufo"))


def scatter(t: Terrain, seed=11):
    rng = random.Random(seed)
    taken: list[tuple[float, float, float]] = []
    # clearances around landmarks
    for (x, y), r in [(L.LIBRARY, 8.5), (L.WORKSHOP, 7.5), (L.LIGHTHOUSE, 5), (L.CAMPFIRE, 5.5), (L.WELL, 3),
                      (L.BENCH, 2), (L.BOULDER, 3), (L.SIGNPOST, 1.5), (L.PLAZA, 6.5), (L.SUMMIT, 2)]:
        taken.append((x, y, r))

    def free(x, y, r, levels=(-1, 0, 1)):
        ix = int(round((x - L.EXTENT[0]) / L.CELL))
        iy = int(round((y - L.EXTENT[1]) / L.CELL))
        if not (2 <= ix < t.height.shape[1] - 2 and 2 <= iy < t.height.shape[0] - 2):
            return False
        if not t.land[iy, ix] or t.path[iy - 2:iy + 3, ix - 2:ix + 3].any() or t.plaza[iy, ix]:
            return False
        if t.level[iy, ix] not in levels or t.height[iy, ix] < 0.45:
            return False
        patch = t.height[iy - 3:iy + 4, ix - 3:ix + 4]
        if patch.max() - patch.min() > 0.6:          # no trees hanging off cliffs
            return False
        return all(math.hypot(x - px, y - py) >= max(r, pr) for px, py, pr in taken)

    def grow(n, region, make, r, levels=(-1, 0, 1), tries=5000):
        count = 0
        for _ in range(tries):
            if count >= n:
                return
            x, y = region()
            if free(x, y, r, levels):
                taken.append((x, y, r))
                place(t, "tree", x, y, lambda root: make(root, rng.randrange(1_000_000)), rot_z=rng.uniform(0, math.tau))
                count += 1

    def ellipse(cx, cy, rx, ry):
        def pick():
            a, d = rng.uniform(0, math.tau), math.sqrt(rng.random())
            return cx + math.cos(a) * rx * d, cy + math.sin(a) * ry * d
        return pick

    anywhere = lambda: (rng.uniform(-40, 40), rng.uniform(-28, 28))  # noqa: E731
    oak = lambda root, s: nature.oak(root, s, rng.uniform(0.85, 1.25))  # noqa: E731
    autumn = lambda root, s: nature.oak(root, s, rng.uniform(0.8, 1.1), nature.AUTUMN)  # noqa: E731
    pine = lambda root, s: nature.pine(root, s, rng.uniform(0.8, 1.2))  # noqa: E731
    mixed = lambda root, s: (oak if rng.random() < 0.6 else pine)(root, s)  # noqa: E731

    grow(26, ellipse(27, 4, 9, 9), mixed, 2.6)                         # eastern forest
    grow(8, ellipse(-18, 0, 8, 5), lambda r, s: (autumn if rng.random() < 0.5 else oak)(r, s), 3.2)
    grow(10, anywhere, pine, 3.0, levels=(0,))                        # mountain pines
    grow(5, anywhere, lambda r, s: nature.pine(r, s, 0.9, snowy=True), 2.8, levels=(1,))
    grow(10, anywhere, oak, 4.5, levels=(-1,))                        # lone trees
    grow(18, anywhere, lambda r, s: nature.bush(r, s, rng.uniform(0.7, 1.2)), 1.6)
    grow(10, anywhere, lambda r, s: nature.rock(r, s, rng.uniform(0.5, 1.1)), 2.0)

    # flower patches, merged into one mesh
    pts = []
    for _ in range(400):
        x, y = anywhere()
        if len(pts) < 40 and free(x, y, 0.8):
            pts.append((x, y, t.sample(x, y)))
    nature.flowers(group("flowers"), pts, seed)


def populate(t: Terrain):
    landmarks(t)
    scatter(t)
