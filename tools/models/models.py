"""Places every model on the island: hand-placed landmarks plus a seeded scatter of nature."""
from __future__ import annotations

import math
import random

import bpy

import beike
import buildings
import cats
import characters
import companion
import fauna
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
    place(t, "card_table", *L.CARD_TABLE, props.card_table, id="card_table")
    place(t, "campfire", cx, cy, props.campfire, id="campfire")
    # Vincent sits on the far side of the fire, facing it and the default camera, clear of the trees
    place(t, "vincent", cx + 0.2, cy + 2.2, characters.vincent, rot_z=-0.1, id="vincent")
    place(t, "log", cx + 0.2, cy + 2.2, characters.log, rot_z=-0.1)                  # his seat, there when he isn't
    # out in the kayak (the runtime paddles him round the loop, and hides the moored one)
    (kx, ky), rx, ry = L.KAYAK_LOOP
    place(t, "vincent_kayak", kx, ky, characters.vincent_kayak, z=0.05, id="vincent_kayak", loop_rx=rx, loop_ry=ry)
    # doing yoga on the grass by the beach, sometimes with her on the next mat
    # (facing east, side-on to the default camera, so you can see a downward dog for what it is)
    place(t, "vincent_yoga", *L.YOGA, characters.vincent_yoga, rot_z=math.pi / 2, id="vincent_yoga")
    place(t, "companion_yoga", L.YOGA[0] + 0.6, L.YOGA[1] + 1.1, companion.yoga, rot_z=math.pi / 2, id="companion_yoga")
    # and climbing the mountain: parked under the island till he sets off up the trail
    characters.vincent_hiking(group("vincent_hiking", (0, 0, -20), id="vincent_hiking"))
    for i, (x, y) in enumerate(L.CLIMB):
        group(f"route_climb_{i}", (x, y, t.sample(x, y)), route="climb", step=i, fixed=0)
    place(t, "guitar_case", cx + 2.5, cy + 3.0, props.guitar_case, rot_z=-0.4, id="guitar_case")
    # his dinner, on the grass by his log (a gull has its eye on it: src/island/scene/mischief.ts)
    place(t, "fire_wrap", cx + 1.3, cy + 1.9, props.fire_wrap, rot_z=0.3, id="fire_wrap")
    # a message in a bottle, parked under the island till the tide brings it in (bottle.ts)
    props.bottle(group("bottle", (0, 0, -20), id="bottle"))
    place(t, "log", cx + 2.0, cy - 0.4, props.log_seat, rot_z=1.9)
    place(t, "log", cx - 2.2, cy + 0.6, props.log_seat, rot_z=-1.3)
    # her spots: on the east log, facing the fire, on a blanket under the blossom, and on an
    # exercise mat above the beach (the runtime shows her at one of them, or indoors)
    place(t, "companion_fireside", cx + 2.0, cy - 0.4, companion.fireside, rot_z=-1.5, id="companion_fireside")
    place(t, "companion_reading", *L.READING, companion.reading, rot_z=0.25, id="companion_reading")
    place(t, "companion_workout", *L.WORKOUT, companion.workout, rot_z=0.15, id="companion_workout")
    # with a podcast: her on the edge of the pier facing out west, legs over the water, and him
    # pacing the path east of the plaza (parked under the island till he puts his headphones on)
    place(t, "companion_podcast", *L.PIER_SEAT, companion.podcast, rot_z=-math.pi / 2, z=0.0, id="companion_podcast")
    characters.vincent_podcast(group("vincent_podcast", (0, 0, -20), id="vincent_podcast"))
    for i, (x, y) in enumerate(L.PODCAST_WALK):
        group(f"route_podcast_{i}", (x, y, t.sample(x, y)), route="podcast", step=i, fixed=0)
    place(t, "well", *L.WELL, props.well, id="well")
    place(t, "blossom", L.WELL[0] + 2.8, L.WELL[1] + 1.8, nature.blossom, id="blossom")
    bench = place(t, "bench", *L.BENCH, lambda r: (props.bench(r), cats.fleece(r)), rot_z=0.3, id="bench")
    # Charlie and George have claimed it: each sits on the fleece at an offset along the seat
    bx, by = L.BENCH
    for name, along, build in (("charlie", -0.58, cats.charlie), ("george", 0.2, cats.george)):
        c, s = math.cos(0.3), math.sin(0.3)
        x, y = bx + c * along + s * 0.02, by + s * along - c * 0.02
        place(t, name, x, y, build, rot_z=0.3, z=bench.location.z + 0.56, id=name)
    place(t, "beike", *L.BEIKE, beike.beike, rot_z=2.4, id="beike")
    place(t, "boulder", *L.BOULDER, props.boulder, id="boulder")
    place(t, "sett", *L.SETT, fauna.sett, rot_z=-1.9, id="sett")
    place(t, "summit", *L.SUMMIT, props.summit_flag, id="summit")
    hut = place(t, "hut", *L.HUT, buildings.mountain_hut, id="hut")
    hut.scale = (0.8, 0.8, 0.8)                                       # so it doesn't rival the peak
    trail(t)
    for i, (x, y) in enumerate(L.CAIRNS):
        cairn = place(t, f"cairn_{i}", x, y, lambda r, i=i: props.cairn(r, 40 + i, L.CAIRN_EMBLEMS.get(i)), id=f"cairn_{i}")
        cairn.scale = (1.25, 1.25, 1.25)                              # big enough to spot from the plaza
    px, py = L.PLAZA
    for x, y in [(px - 5.2, py + 3), (px + 5.2, py + 3), (px - 5, py - 3.6), (px + 5, py - 3.6),
                 (dx - 1.6, dy + 0.4), (L.LIBRARY[0] + 6, L.LIBRARY[1] - 3.4), (cx - 4, cy - 3)]:
        place(t, "lamp", x, y, props.lamp)

    # things the runtime moves around; parked out of sight
    characters.sheep(group("sheep", (0, 0, 30), id="sheep"))
    props.ufo(group("ufo", (0, 0, 40), id="ufo"))
    shelter(t)


def shelter(t: Terrain):
    """For when it rains: the cats on their feet (swapped in for the sleeping ones, parked under
    the island till then) and the routes they and Beike take indoors, as markers."""
    white = dict(coat=cats.P.CAT_WHITE, patch=cats.P.GINGER, cap=cats.P.GINGER, tail=cats.P.GINGER, socks=cats.P.CAT_WHITE)
    cats.walker(group("charlie_walk", (0, 0, -20)), "charlie", size=0.9, **white)
    cats.walker(group("george_walk", (0, 0, -20)), "george", size=1.1, eyes="#c9b560", **white)
    cats.walker(group("cat_walk", (0, 0, -20)), "cat", coat=cats.P.CAT, patch=None, cap=cats.P.CAT, tail=cats.P.CAT,
                socks=cats.P.CAT_WHITE, bib=cats.P.CAT_WHITE, eyes="#e0c050")
    for name, points in L.SHELTER.items():
        for i, (x, y, *on) in enumerate(points):
            if on == ["deck"]:
                z = 0.84                                                # the pier's boards
            elif on == ["floor"]:
                z = t.sample(*L.LIGHTHOUSE) + 0.4                       # up on the lighthouse's plinth
            else:
                z = t.sample(x, y)
            group(f"route_{name}_{i}", (x, y, z), route=name, step=i, fixed=int(bool(on)))


def _along(polyline, every):
    """Points every `every` metres along a polyline, with the direction there: (x, y, dx, dy)."""
    out, carry = [], 0.0
    for (x0, y0), (x1, y1) in zip(polyline, polyline[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        dx, dy = (x1 - x0) / seg, (y1 - y0) / seg
        s = carry
        while s < seg:
            out.append((x0 + dx * s, y0 + dy * s, dx, dy))
            s += every
        carry = s - seg
    return out


def trail(t: Terrain):
    """What makes the mountain trail a trail: stone steps up the cliffs, pebbles along the
    edges, red-and-white waymarks, and a yellow fingerpost where it leaves the plaza."""
    for sx, y0, y1 in L.STAIRS:
        # the same steps terrain.generate() cut into the cliff, as stone blocks on top
        lo, hi = t.sample(sx, y0 - 0.25), t.sample(sx, y1 + 0.25)
        n = max(4, int((hi - lo) / 0.45))
        run = (y1 - y0) / n
        treads = [(k * run, (k + 1) * run, (lo + k / n * (hi - lo)) - lo + 0.08) for k in range(n)]
        props.steps(group("steps", (sx, y0, lo)), treads)

    def clear(x, y):
        on_stairs = any(abs(x - sx) < 1.3 and y0 - 0.6 < y < y1 + 0.6 for sx, y0, y1 in L.STAIRS)
        near = [*L.CAIRNS, L.HUT, L.SUMMIT]
        return not on_stairs and all(math.hypot(x - px, y - py) > 1.1 for px, py in near) \
            and math.hypot(x - L.PLAZA[0], y - L.PLAZA[1]) > 5.2

    def level_with(x, y, px, py):         # not over a cliff edge, not up a cut wall
        return abs(t.sample(px, py) - t.sample(x, y)) < 0.25

    pebbles, marks = [], []
    routes = [(pl, w) for pl, w in L.TRAIL] + [(L.SWITCHBACKS, 1.6)]
    for pl, w in routes:
        for i, (x, y, dx, dy) in enumerate(_along(pl, 0.8)):
            for side in (-1, 1):
                px, py = x - dy * side * (w / 2 + 0.05), y + dx * side * (w / 2 + 0.05)
                if clear(px, py) and level_with(x, y, px, py) and (i + (side > 0)) % 4:        # a gap now and then
                    pebbles.append((px, py, t.sample(px, py)))
        for i, (x, y, dx, dy) in enumerate(_along(pl, 5.5)):
            side = 1 if i % 2 else -1
            px, py = x - dy * side * (w / 2 + 0.35), y + dx * side * (w / 2 + 0.35)
            if i and clear(px, py) and level_with(x, y, px, py):
                marks.append((px, py, t.sample(px, py)))
    props.trail_edge(group("trail_edge"), pebbles)
    props.waymarks(group("waymarks"), marks)
    place(t, "fingerpost", 1.5, -3.6, props.fingerpost, rot_z=0.0)


def scatter(t: Terrain, seed=11):
    rng = random.Random(seed)
    taken: list[tuple[float, float, float]] = []    # plants: each keeps its own spacing
    kept: list[tuple[float, float, float]] = []     # clearances around landmarks: nothing grows inside
    for (x, y), r in [(L.LIBRARY, 8.5), (L.WORKSHOP, 7.5), (L.LIGHTHOUSE, 5), (L.CAMPFIRE, 5.5), (L.WELL, 3),
                      (L.BENCH, 2), (L.BEIKE, 3.5), (L.BOULDER, 3), (L.SETT, 2.2), (L.SIGNPOST, 1.5), (L.PLAZA, 6.5), (L.SUMMIT, 2)]:
        kept.append((x, y, r))
    for x, y in L.CAIRNS:                   # nothing in front of the cairns, so they're easy to spot
        kept.append((x, y, 4.0))
    kept.append((*L.HUT, 4.5))

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
        if any(math.hypot(x - px, y - py) < pr for px, py, pr in kept):
            return False
        # two plants stand as close as the smaller of their spacings allows, so bushes and
        # rocks can tuck in under a big oak, while the oaks themselves keep apart
        return all(math.hypot(x - px, y - py) >= min(r, pr) for px, py, pr in taken)

    def in_sightline(x, y):                # the camera looks north: keep the card table's south side open
        tx, ty = L.CARD_TABLE
        return math.hypot(x - tx, y - (ty - 2.8)) < 3.2

    def blocks_bench(x, y):                # keep the view onto Charlie and George open
        bx, by = L.BENCH
        fx, fy = math.sin(0.3), -math.cos(0.3)                        # the way the bench faces
        return math.hypot(x - (bx + fx * 3), y - (by + fy * 3)) < 3.0

    def elsewhere(x, y, r, levels):        # a nearby free spot, off its own rng so the rest of the scatter stays put
        near = random.Random(f"{x:.3f},{y:.3f}")
        for _ in range(200):
            a, d = near.uniform(0, math.tau), near.uniform(4, 9)
            nx, ny = x + math.cos(a) * d, y + math.sin(a) * d
            if free(nx, ny, r, levels) and not blocks_bench(nx, ny):
                return nx, ny
        return None

    def grow(n, region, make, r, levels=(-1, 0, 1), tries=5000):
        count = 0
        for _ in range(tries):
            if count >= n:
                return
            x, y = region()
            if free(x, y, r, levels) and blocks_bench(x, y):
                moved = elsewhere(x, y, r, levels)
                if moved is None:
                    continue
                x, y = moved
            if free(x, y, r, levels):
                taken.append((x, y, r))
                root = place(t, "tree", x, y, lambda root: make(root, rng.randrange(1_000_000)), rot_z=rng.uniform(0, math.tau))
                if in_sightline(x, y):     # grown and cut again, so the seeded scatter doesn't reshuffle
                    for obj in [root, *root.children_recursive]:
                        bpy.data.objects.remove(obj)
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

    bush = lambda root, s: nature.bush(root, s, rng.uniform(0.7, 1.2))  # noqa: E731
    grow(30, ellipse(27, 4, 9, 9), mixed, 2.4)                         # eastern forest
    grow(10, ellipse(-18, 0, 8, 5), lambda r, s: (autumn if rng.random() < 0.5 else oak)(r, s), 2.8)
    grow(14, anywhere, pine, 2.6, levels=(0,))                        # mountain pines
    grow(7, anywhere, lambda r, s: nature.pine(r, s, 0.9, snowy=True), 2.6, levels=(1,))
    grow(14, anywhere, oak, 4.0, levels=(-1,))                        # lone trees
    grow(12, ellipse(27, 4, 11, 11), bush, 1.2)                       # undergrowth at the woods' edge
    grow(8, ellipse(-18, 0, 9, 6), bush, 1.2)
    grow(30, anywhere, bush, 1.4)
    grow(14, anywhere, lambda r, s: nature.rock(r, s, rng.uniform(0.5, 1.1)), 1.8)

    # flower patches, merged into one mesh
    pts = []
    for _ in range(400):
        x, y = anywhere()
        if len(pts) < 60 and free(x, y, 0.8):
            pts.append((x, y, t.sample(x, y)))
    nature.flowers(group("flowers"), pts, seed)


def populate(t: Terrain):
    landmarks(t)
    scatter(t)
    fauna.populate()
