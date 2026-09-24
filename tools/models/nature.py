"""Trees, bushes, rocks and flowers.

Canopies are *not* modelled: a tree exports a trunk plus `canopy` markers (centre, radius,
palette) and the runtime grows fluffy leaf-card foliage there. Easy to restyle later.
"""
from __future__ import annotations

import math
import random

import palette as P
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
