"""Trees, bushes, rocks and flowers.

Canopies are *not* modelled: a tree exports a trunk plus `canopy` markers (centre, radius,
palette) and the runtime grows fluffy leaf-card foliage there. Easy to restyle later.
"""
from __future__ import annotations

import math
import random

import palette as P
from mathutils import Euler, Matrix, Vector
from kit import Model, emitter, group

# canopy palettes the runtime knows about (see src/island/foliage.ts)
LEAF, PINE, AUTUMN, BLOSSOM = "leaf", "pine", "autumn", "blossom"


def canopy(root, loc, radius, palette, squash=1.0):
    return group("canopy", loc, parent=root, canopy=radius, palette=palette, squash=squash)


def oak(root, seed: int, size=1.0, palette=LEAF):
    rng = random.Random(seed)
    m = Model("trunk", seed)
    h = 2.4 * size
    m.cyl(0.26 * size, h, (0, 0, 0), P.BARK, segs=6, r_top=0.18 * size)
    m.cyl(0.4 * size, 0.3, (0, 0, 0), P.BARK, segs=6, r_top=0.26 * size)       # root flare
    # two branches reaching into the canopy
    for a in (rng.uniform(0, math.tau), rng.uniform(0, math.tau)):
        m.plank_line((0, 0, h * 0.7), (math.cos(a) * 0.9 * size, math.sin(a) * 0.9 * size, h * 1.15),
                     0.14 * size, 0.14 * size, P.BARK)
    m.build(root)
    canopy(root, (0, 0, h + 1.0 * size), 1.7 * size, palette)
    for _ in range(3):
        a = rng.uniform(0, math.tau)
        canopy(root, (math.cos(a) * 1.0 * size, math.sin(a) * 1.0 * size, h + rng.uniform(0.3, 1.2) * size),
               rng.uniform(1.0, 1.3) * size, palette)


def blossom(root):
    """The one cherry tree on the island, shedding petals."""
    oak(root, 305, 1.1, BLOSSOM)
    emitter(root, (0, 0, 3.8), "petals")


def pine(root, seed: int, size=1.0, snowy=False):
    rng = random.Random(seed)
    m = Model("pine", seed)
    m.cyl(0.2 * size, 1.2 * size, (0, 0, 0), P.BARK, segs=5)
    tiers = 4
    for i in range(tiers):
        z = (0.8 + i * 1.05) * size
        r = (1.6 - i * 0.33) * size
        col = P.PINE[(i + seed) % len(P.PINE)]
        m.cyl(r, 1.6 * size, (0, 0, z), col, segs=7, r_top=0.05, rot=(0, 0, rng.uniform(0, 1)))
        if snowy:
            m.cyl(r * 0.45, 0.6 * size, (0, 0, z + 1.0 * size), P.SNOW, segs=7, r_top=0.03)
    m.build(root)


def bush(root, seed: int, size=1.0, palette=LEAF):
    canopy(root, (0, 0, 0.5 * size), 0.8 * size, palette, squash=0.7)


def rock(root, seed: int, size=1.0):
    m = Model("rock", seed)
    m.ball(0.8 * size, (0, 0, 0.25 * size), P.ROCK[2], subdiv=1, scale=(1.2, 1.0, 0.7), jitter=0.12 * size)
    m.build(root, rot_z=random.Random(seed).uniform(0, math.tau))


def flowers(root, points, seed: int):
    """Many tiny flowers merged into one mesh."""
    rng = random.Random(seed)
    m = Model("flowers", seed)
    cols = ["#f4efe6", "#f2d15a", "#e98aa8", "#b6a4f0", "#f08c5a"]
    for x, y, z in points:
        c = rng.choice(cols)
        for _ in range(rng.randrange(3, 8)):
            fx, fy = x + rng.gauss(0, 0.5), y + rng.gauss(0, 0.5)
            m.box((0.06, 0.06, 0.35), (fx, fy, z + 0.17), "#3f7d43")
            m.box((0.16, 0.16, 0.1), (fx, fy, z + 0.38), c)
    m.build(root)


# --- spring bulbs ----------------------------------------------------------------------

CROCUS_LEAF = "#3f7a3c"
SNOWDROP_LEAF = "#5b8c6a"
CROCUS_TUBE = "#ece6f4"
CROCUS_HEART = "#f2a43a"
SNOWDROP = "#f7f8f2"
STALK = "#4a8a45"

# a clump's crocuses: (inner petals, outer petals), and how many of them are still shut
CROCUS_TINTS = [
    (("#bba8ee", "#a48ddf"), 0.25),   # pale lilac
    (("#d2c6f5", "#bcaaee"), 0.25),   # paler still
    (("#9a74d8", "#8159c4"), 0.2),    # deep purple
    (("#f6f3fb", "#ddd2f2"), 0.25),   # white, flushed lilac outside
    (("#bba8ee", "#a48ddf"), 0.8),    # a clump not open yet, all buds
]
BULB_KINDS = [*(f"crocus_{i}" for i in range(len(CROCUS_TINTS))), "snowdrop_0", "snowdrop_1"]


def petal(m, base, yaw, tilt, length, width, color, thick=0.01, shape="petal"):
    """A thin flat blade from `base`: tilted `tilt` from upright, leaning out towards `yaw`. Just
    its two faces, back to back (the edges would never show, and there are thousands of them)."""
    w = width / 2
    pts = {
        "petal": [(-w * 0.3, 0), (w * 0.3, 0), (w, length * 0.62), (0, length), (-w, length * 0.62)],
        "bud": [(-w * 0.45, 0), (w * 0.45, 0), (w, length * 0.5), (0, length), (-w, length * 0.5)],
        "leaf": [(-w, 0), (w, 0), (0, length)],
        "stem": [(-w, 0), (w, 0), (w, length), (-w, length)],
    }[shape]
    mat = Matrix.LocRotScale(Vector(base), Euler((-tilt, 0, yaw - math.pi / 2)), None)
    front = [m.bm.verts.new(mat @ Vector((x, -thick / 2, z))) for x, z in pts]
    back = [m.bm.verts.new(mat @ Vector((x, thick / 2, z))) for x, z in pts]
    idx = m._slot(color, False)
    for f in (m.bm.faces.new(front[::-1]), m.bm.faces.new(back)):
        f.material_index = idx


def crocus(m, rng, x, y, tint, shut):
    """One crocus: a pale tube out of the leaves and a goblet of six petals, shut to a point,
    half open, or flung open to the sun round a tuft of orange stamens."""
    (inner, outer), h = tint, rng.uniform(0.17, 0.3)
    petal(m, (x, y, -0.03), rng.uniform(0, math.tau), 0, h, 0.035, CROCUS_TUBE, shape="stem")
    top, turn = (x, y, h - 0.04), rng.uniform(0, math.tau)
    if rng.random() < shut:                                                       # a bud
        for k in range(3):
            petal(m, top, turn + k * math.tau / 3, 0.06, rng.uniform(0.15, 0.19), 0.065, outer, shape="bud")
        return
    spread = rng.choice((0.22, 0.45, 0.85))
    for k in range(6):
        out = k % 2 == 0
        petal(m, top, turn + k * math.tau / 6, spread * (1.1 if out else 0.9), 0.15 if out else 0.13,
              0.075 if out else 0.065, outer if out else inner)
    if spread > 0.3:
        m.box((0.045, 0.045, 0.07), (x, y, top[2] + 0.04), CROCUS_HEART, rot=(0, 0, turn))


def snowdrop(m, rng, x, y):
    """One snowdrop: a stalk that arches over at the top, three white petals hanging
    and splaying a little, and the small cup inside."""
    h = rng.uniform(0.26, 0.36)
    a = rng.uniform(0, math.tau)
    dx, dy = math.cos(a), math.sin(a)
    petal(m, (x, y, -0.03), a + math.pi / 2, 0, h + 0.03, 0.028, STALK, shape="stem")
    tip = (x + dx * 0.06, y + dy * 0.06, h - 0.01)
    petal(m, (x, y, h), a, math.pi / 2 + 0.17, 0.061, 0.024, STALK, shape="stem")
    bell = (tip[0], tip[1], tip[2] - 0.02)
    for k in range(3):
        petal(m, bell, a + k * math.tau / 3, math.pi - 0.42, 0.12, 0.075, SNOWDROP)
    m.box((0.045, 0.045, 0.05), (bell[0], bell[1], bell[2] - 0.04), SNOWDROP, rot=(0, 0, a))
    for k in range(2):                                                            # two strap leaves
        petal(m, (x, y, -0.03), a + math.pi / 2 + k * math.pi + rng.uniform(-0.4, 0.4), rng.uniform(0.1, 0.3),
              rng.uniform(0.22, 0.32), 0.04, SNOWDROP_LEAF, shape="leaf")


def bulb_clump(m, rng, kind, at=(0, 0)):
    """A clump of crocuses or snowdrops about 0.4 m across, at `at` in m."""
    cx, cy = at
    if kind.startswith("snowdrop"):
        for _ in range(rng.randrange(5, 9)):
            snowdrop(m, rng, cx + rng.gauss(0, 0.09), cy + rng.gauss(0, 0.09))
        return
    tint, shut = CROCUS_TINTS[int(kind.split("_")[1])]
    for _ in range(rng.randrange(4, 7)):                                          # the grassy leaves
        petal(m, (cx + rng.gauss(0, 0.05), cy + rng.gauss(0, 0.05), -0.03), rng.uniform(0, math.tau),
              rng.uniform(0.15, 0.55), rng.uniform(0.22, 0.36), 0.03, CROCUS_LEAF, shape="leaf")
    for _ in range(rng.randrange(4, 8)):
        crocus(m, rng, cx + rng.gauss(0, 0.08), cy + rng.gauss(0, 0.08), tint, shut)


def bulbs(root, patches, ground, seed: int):
    """Late-winter and spring carpets of crocuses and snowdrops: each patch a scatter of small
    clumps, like bulbs gone wild under the trees. `ground(x, y)` is the lawn height there, or
    None off the grass. A clump is drawn once per kind (`bulb_<kind>`, parked out of sight) and
    stood wherever it grows by the runtime, from its `spots`: x, y, z, turn, size and `bloom`,
    the point in its season (0..1) by which a clump is out, so a patch fills in and thins out
    a clump at a time."""
    rng = random.Random(seed)
    spots = {k: [] for k in BULB_KINDS}
    for x, y, spread in patches:
        crocus_share = rng.uniform(0.3, 0.9)
        for _ in range(rng.randrange(8, 16)):
            cx, cy = x + rng.gauss(0, spread), y + rng.gauss(0, spread)
            z = ground(cx, cy)
            if z is None:
                continue
            if rng.random() < crocus_share:
                kind = f"crocus_{rng.choices(range(len(CROCUS_TINTS)), (6, 3, 1.2, 1.5, 3))[0]}"
            else:
                kind = f"snowdrop_{rng.randrange(2)}"
            spots[kind] += [round(cx, 2), round(cy, 2), round(z, 2), round(rng.uniform(0, math.tau), 2),
                            round(rng.uniform(1.25, 1.6), 2), round(rng.random(), 2)]
    for i, kind in enumerate(BULB_KINDS):
        g = group(f"bulb_{kind}", (i * 2.0, -300, -40), parent=root, bulb=kind, spots=spots[kind])
        m = Model(f"bulb_{kind}", seed + i)
        bulb_clump(m, random.Random(seed * 31 + i), kind)
        m.build(g)
