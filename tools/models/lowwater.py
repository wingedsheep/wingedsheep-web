"""Low Water (src/island/lowwater/): the models the flat loads when you walk out. Most of the flat
is made in code (its sticks and stones are a few boxes each); what's here is what deserves more
shape than that. Each template's root carries `lowwater=<kind>`, and the world puts it where it goes.

The wreck: what's left of an old wooden tjalk, a flat-bottomed Dutch cargo boat, lying on the flat
with a list to one side. Its length runs along x (the bow at +x), its beam along y, and z = 0 is the
sand on a day the sand has let go of most of it. The ribs carry on below that, so the world can sink
the whole thing to bury more of it on other days.

The bell buoy: a belton, out where the deep water starts, in the red and white stripes of a
safe-water mark with a red ball on top. Its float sits on z = 0 (the waterline), the bell hangs in
the cage over it, and the world rocks the whole thing on the swell. The bell is its own part
(`buoy_bell`) so it can lag the rocking a little.

The seal: a harbour seal hauled out on a far bank, lying along x with its head at +x and its belly
on z = 0. The head is its own part (`seal_head`), pivoting at the neck, so the world can lift it and
turn it to watch you.
"""
from __future__ import annotations

import math
import random

from kit import Model, group

# old oak, black from a long time wet; a little paler where the tops dry out between tides
OAK = "#352e3b"
OAK_DRY = "#5a4d57"
# the green-black of weed where the sand and the water meet the wood
WEED = "#2c3a39"
IRON = "#3a3440"

LENGTH = 10.0
BEAM = 3.2
DEPTH = 2.3
SAND_BELOW = 0.7  # how far the ribs go on under the sand line


def _half_beam(t: float) -> float:
    """The hull's half-width at t (-1 stern … 1 bow): bluff at both ends, the bow rounder."""
    end = 0.55 if t > 0 else 0.7
    k = max(0.0, abs(t) - (1 - end)) / end
    return BEAM / 2 * math.sqrt(max(0.0, 1 - k * k * (0.92 if t > 0 else 0.75)))


def _profile(half: float, steps: int = 6) -> list[tuple[float, float]]:
    """One side of a frame, from the keel out and up: a flat floor, the bilge turned round, then
    the side going up near-vertical with a little tumblehome. (y out, z up)"""
    floor = half * 0.62
    r = half - floor
    pts = [(0.0, -SAND_BELOW), (floor, -SAND_BELOW)]
    for i in range(1, steps + 1):
        a = i / steps * math.pi / 2
        pts.append((floor + math.sin(a) * r, -SAND_BELOW + r - math.cos(a) * r))
    top = DEPTH - SAND_BELOW
    pts.append((half * 0.97, top))
    return pts


def _cut(pts: list[tuple[float, float]], height: float) -> list[tuple[float, float]]:
    """The profile, broken off at `height` (z)."""
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        if b[1] <= height:
            out.append(b)
            continue
        if a[1] < height:
            k = (height - a[1]) / (b[1] - a[1])
            out.append((a[0] + (b[0] - a[0]) * k, height))
        break
    return out


def wreck():
    rng = random.Random(1857)
    root = group("wreck", (0, -900, 0), lowwater="wreck",
                 length=LENGTH, beam=BEAM)
    m = Model("wreck_wood", seed=7)

    # the keelson down the middle, and the stem and sternpost at the ends
    m.box((LENGTH * 0.92, 0.26, 0.24), (0, 0, -SAND_BELOW + 0.12), OAK)
    # the stem: a tjalk's bow is round, so it rises in a curve, and it's the tallest thing left
    stem = [(LENGTH / 2 - 0.25, -SAND_BELOW), (LENGTH / 2 + 0.05, 0.2), (LENGTH / 2 + 0.3, 1.1), (LENGTH / 2 + 0.42, 2.0)]
    for a, b in zip(stem, stem[1:]):
        m.plank_line((a[0], 0, a[1]), (b[0], 0, b[1]), 0.24, 0.22, OAK)
    m.box((0.3, 0.28, 0.12), (LENGTH / 2 + 0.42, 0, 2.02), OAK_DRY)
    m.plank_line((-LENGTH / 2 + 0.2, 0, -SAND_BELOW), (-LENGTH / 2 - 0.1, 0, 0.9), 0.24, 0.22, OAK)

    # the frames, in pairs, broken off at their own heights: the side it lists towards (-y) is
    # mostly gone under, the high side stands up out of the sand
    n = 15
    for i in range(n):
        t = -0.9 + 1.8 * i / (n - 1)
        x = t * LENGTH / 2
        half = _half_beam(t)
        pts = _profile(half)
        for side in (-1, 1):
            if side < 0:
                h = rng.uniform(0.1, 0.7)
            else:
                # tallest amidships, and some broken short anyway
                h = DEPTH - SAND_BELOW - rng.uniform(0.0, 0.45) - abs(t) * 0.5
                if rng.random() < 0.25:
                    h = rng.uniform(0.3, 0.8)
            seg = _cut(pts, h)
            for (y0, z0), (y1, z1) in zip(seg, seg[1:]):
                m.plank_line((x, y0 * side, z0), (x, y1 * side, z1), 0.2, 0.17, OAK)
            # where it broke, the end is paler: dry at low water
            if len(seg) > 1 and seg[-1][1] > -0.05:
                y, z = seg[-1]
                m.box((0.18, 0.18, 0.07), (x, y * side, z), OAK_DRY)

    # a few strakes of planking still on the high side, low down where the sand kept them
    for z, x0, x1 in ((0.15, -2.9, 1.6), (0.45, -1.8, 0.6), (-0.15, -3.6, 3.2)):
        for k in range(8):
            xa = x0 + (x1 - x0) * k / 8
            xb = x0 + (x1 - x0) * (k + 1) / 8
            ya = _half_beam(xa / (LENGTH / 2)) * 0.99 + 0.06
            yb = _half_beam(xb / (LENGTH / 2)) * 0.99 + 0.06
            m.plank_line((xa, ya, z), (xb, yb, z), 0.08, 0.2, OAK)
    # weed where the wood meets the sand
    for i in range(n):
        if rng.random() < 0.6:
            t = -0.9 + 1.8 * i / (n - 1)
            m.box((0.24, 0.24, 0.1), (t * LENGTH / 2, _half_beam(t) * 0.96, 0.02), WEED)
    m.build(parent=root)

    # the leeboard: a tjalk's swing keel, fan-shaped, come off and lying in the sand alongside
    lee = Model("wreck_leeboard", seed=8)
    fan = [(-0.25, 0), (0.25, 0), (0.55, 2.3), (-0.55, 2.3)]
    lee.prism(fan, 0.09, (0, 0, 0), OAK, rot=(0, 0, 0))
    lee.box((0.18, 0.12, 0.1), (0, 0, 0.05), IRON)
    lee.build(parent=root, loc=(-1.2, BEAM / 2 + 0.4, 0.05)).rotation_euler = (math.radians(-86), 0, math.radians(-18))
    return root


# the buoy's paint, gone dull with salt: the red is closer to brick than to a postbox
RED = "#7e3440"
WHITE = "#cfc8c0"
BRONZE = "#7a6a4c"
FLOAT_R = 0.85


def buoy():
    root = group("buoy", (0, -910, 0), lowwater="buoy")
    m = Model("buoy_float", seed=9)
    # the float: eight staves round, red and white by turns, wider at the waterline and drawn in under it
    segs = 8
    for i in range(segs):
        a0 = (i / segs) * math.tau
        a1 = ((i + 1) / segs) * math.tau
        wedge = lambda r: [(0.0, 0.0), (math.cos(a0) * r, math.sin(a0) * r), (math.cos(a1) * r, math.sin(a1) * r)]
        color = RED if i % 2 == 0 else WHITE
        m.slab(wedge(FLOAT_R * 0.55), -0.7, -0.15, color, top=wedge(FLOAT_R))
        m.slab(wedge(FLOAT_R), -0.15, 0.3, color, top=wedge(FLOAT_R * 0.92))
    # its deck, and the weed line just over the water
    m.cyl(FLOAT_R * 0.94, 0.07, (0, 0, 0.3), IRON, segs=8)
    m.cyl(FLOAT_R * 1.01, 0.08, (0, 0, -0.04), WEED, segs=8)
    # the cage: four legs leaning in to a ring at the top, and a band half way
    top_z = 2.2
    for i in range(4):
        a = (i / 4) * math.tau + math.pi / 4
        lo = (math.cos(a) * 0.62, math.sin(a) * 0.62, 0.34)
        hi = (math.cos(a) * 0.3, math.sin(a) * 0.3, top_z)
        m.plank_line(lo, hi, 0.08, 0.08, RED if i % 2 == 0 else WHITE)
    for z, r in ((1.0, 0.5), (top_z, 0.32)):
        for i in range(4):
            a0 = (i / 4) * math.tau + math.pi / 4
            a1 = ((i + 1) / 4) * math.tau + math.pi / 4
            m.plank_line((math.cos(a0) * r, math.sin(a0) * r, z), (math.cos(a1) * r, math.sin(a1) * r, z), 0.06, 0.06, IRON)
    # the topmark on its pole: one red ball (safe water, all round)
    m.cyl(0.04, 0.55, (0, 0, top_z), IRON, segs=4)
    m.ball(0.2, (0, 0, top_z + 0.68), RED, subdiv=1)
    m.build(parent=root)

    # the bell, hung from the top ring, its four clappers loose around it
    bell = Model("buoy_bell", seed=10)
    bell.cyl(0.3, 0.12, (0, 0, -0.62), BRONZE, segs=8, r_top=0.27)
    bell.cyl(0.27, 0.42, (0, 0, -0.5), BRONZE, segs=8, r_top=0.15)
    bell.box((0.06, 0.06, 0.5), (0, 0, -0.1), IRON)
    for i in range(4):
        a = (i / 4) * math.tau
        x, y = math.cos(a) * 0.42, math.sin(a) * 0.42
        bell.plank_line((x * 0.6, y * 0.6, -0.12), (x, y, -0.5), 0.03, 0.03, IRON)
        bell.ball(0.06, (x, y, -0.55), IRON, subdiv=0)
    bell.build(parent=root, loc=(0, 0, top_z - 0.05))
    return root


# a harbour seal at blue hour, dried off on the sand: pale grey going buff, mottled darker
SEAL = "#a39a9c"
SEAL_DARK = "#5e5662"
SEAL_PALE = "#bdb2ac"
SEAL_EYE = "#1c1a22"


def seal():
    root = group("seal", (0, -920, 0), lowwater="seal")
    m = Model("seal_body", seed=11)
    # the body: a run of flattened balls along the spine, thickest behind the shoulders, the hind
    # end tapering and tipped up a little off the sand (as they lie, like a banana)
    spine = [(-0.66, 0.11, 0.1), (-0.5, 0.15, 0.13), (-0.3, 0.21, 0.19), (-0.08, 0.25, 0.22), (0.14, 0.24, 0.21), (0.32, 0.2, 0.2), (0.46, 0.15, 0.22)]
    for x, r, z in spine:
        m.ball(r, (x, 0, z), SEAL, subdiv=1, scale=(1.35, 1.0, 0.82))
    # the belly, paler, just showing along the sand
    for x in (-0.3, -0.05, 0.2):
        m.ball(0.2, (x, 0, 0.1), SEAL_PALE, subdiv=1, scale=(1.4, 1.08, 0.5))
    # a few darker spots on the back
    for x, y in ((-0.38, 0.06), (-0.12, -0.08), (0.08, 0.1), (0.26, -0.05), (-0.22, 0.14)):
        m.ball(0.05, (x, y, 0.38 - abs(x) * 0.18), SEAL_DARK, subdiv=0, scale=(1.3, 1, 0.5))
    # the hind flippers, held together and tipped up
    for side in (-1, 1):
        m.ball(0.09, (-0.86, side * 0.06, 0.2), SEAL_DARK, subdiv=1, scale=(1.9, 0.75, 0.35), rot=(0, math.radians(-25), side * 0.25))
    # the fore flippers, flat to the sand by the chest
    for side in (-1, 1):
        m.ball(0.07, (0.26, side * 0.24, 0.05), SEAL_DARK, subdiv=0, scale=(1.8, 0.8, 0.4), rot=(0, 0, side * -0.4))
    m.build(parent=root)

    # the head on its neck, pivoting where the neck meets the shoulders
    h = Model("seal_head", seed=12)
    h.ball(0.15, (0.04, 0, 0.0), SEAL, subdiv=1, scale=(1.3, 1, 0.95))
    h.ball(0.135, (0.2, 0, 0.06), SEAL, subdiv=1, scale=(1.15, 1, 0.92))
    h.ball(0.08, (0.34, 0, 0.03), SEAL_PALE, subdiv=1, scale=(1.1, 1, 0.8))
    h.ball(0.03, (0.41, 0, 0.05), SEAL_EYE, subdiv=0)
    for side in (-1, 1):
        h.ball(0.035, (0.27, side * 0.08, 0.12), SEAL_EYE, subdiv=0)
    h.build(parent=root, loc=(0.52, 0, 0.24))
    return root


def build():
    wreck()
    buoy()
    seal()
