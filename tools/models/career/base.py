"""What every career diorama shares: the floating chunk of land it stands on, the clouds
drifting under it, little people, bikes, and blocky lettering.

People are built at the island's toy scale (Vincent at the campfire is about 2.3 m standing)
and then shrunk with `scale`, so the dioramas can hold whole buildings.
"""
from __future__ import annotations

import math
import random

import palette as P
from kit import Model, group

GRASS_TOP = "#5a9a4a"
GRASS_EDGE = "#4a8a45"
CLOUD = "#f4f1ec"
CLOUD_SHADE = "#dcdbe6"


def outline(rx: float, ry: float, seed: int, n: int = 30, wobble: float = 0.06, centre=(0.0, 0.0)):
    """A lumpy ellipse, counter-clockwise: the rim of a floating island."""
    rng = random.Random(seed)
    phase = [rng.uniform(0, math.tau) for _ in range(3)]
    pts = []
    for i in range(n):
        a = i / n * math.tau
        k = 1 + wobble * (math.sin(a * 3 + phase[0]) + 0.6 * math.sin(a * 5 + phase[1]) + 0.4 * math.sin(a * 7 + phase[2])) / 2
        k += rng.uniform(-0.015, 0.015)
        pts.append((centre[0] + math.cos(a) * rx * k, centre[1] + math.sin(a) * ry * k))
    return pts


def _scaled(pts, s, centre, jitter, rng):
    cx, cy = centre
    return [(cx + (x - cx) * s + rng.uniform(-jitter, jitter), cy + (y - cy) * s + rng.uniform(-jitter, jitter)) for x, y in pts]


def plinth(root, rx: float, ry: float, seed: int = 1, centre=(0.0, 0.0)):
    """The chunk of land a diorama floats on: a grass top, a band of soil, and rock tapering
    to a point underneath. The top is at z = 0. Returns the rim, for placing things near it."""
    rng = random.Random(seed)
    rim = outline(rx, ry, seed, centre=centre)
    m = Model("plinth", seed)
    m.slab(rim, -0.25, 0.0, GRASS_TOP)
    m.slab(_scaled(rim, 1.0, centre, 0.0, rng), -0.45, -0.25, GRASS_EDGE)
    # soil, then rock in steps, each narrower and a little crooked, down to a point
    layers = [(-0.45, 1.0, P.DIRT_LIGHT), (-1.2, 0.97, P.DIRT), (-2.2, 0.82, P.ROCK[3]),
              (-3.3, 0.6, P.ROCK[2]), (-4.3, 0.36, P.ROCK[1]), (-5.1, 0.14, P.ROCK[0])]
    prev = _scaled(rim, 1.0, centre, 0.0, rng)
    for (z_top, _, _), (z_bot, s, color) in zip(layers, layers[1:]):
        nxt = _scaled(rim, s, centre, 0.25 * s, rng)
        m.slab(nxt, z_bot, z_top, color, top=prev)
        prev = nxt
    m.build(root)
    return rim


def clouds(root, rx: float, ry: float, seed: int = 2, count: int = 7, centre=(0.0, 0.0)):
    """Puffs of cloud drifting past below the rim: the trail is high up."""
    rng = random.Random(seed)
    m = Model("clouds", seed)
    for i in range(count):
        a = (i + rng.uniform(-0.3, 0.3)) / count * math.tau
        r = rng.uniform(0.85, 1.15)
        x, y = centre[0] + math.cos(a) * rx * r, centre[1] + math.sin(a) * ry * r
        z = rng.uniform(-3.8, -2.2)
        for k in range(rng.randint(2, 4)):
            s = rng.uniform(0.7, 1.3)
            m.ball(s, (x + k * 0.9 * math.cos(a + 1.6), y + k * 0.9 * math.sin(a + 1.6), z + rng.uniform(-0.2, 0.2)),
                   CLOUD if k % 2 == 0 else CLOUD_SHADE, subdiv=1, scale=(1.4, 1.1, 0.55))
    m.build(root)


def tree(m: Model, loc, size: float = 1.0, palette=None):
    """A round, leafy tree for a diorama (the island grows its own foliage at runtime; rooms don't)."""
    x, y, z = loc
    leaves = palette or P.LEAF[1:]
    m.cyl(0.14 * size, 1.4 * size, (x, y, z), P.BARK, segs=5, r_top=0.09 * size)
    for k, (dx, dy, dz, r) in enumerate(((0, 0, 1.9, 0.95), (0.45, 0.2, 1.55, 0.7), (-0.4, -0.15, 1.6, 0.72), (0.1, -0.3, 2.35, 0.6))):
        m.ball(r * size, (x + dx * size, y + dy * size, z + dz * size), leaves[k % len(leaves)], subdiv=1, jitter=0.05 * size)


def bush(m: Model, loc, size: float = 1.0):
    x, y, z = loc
    for k, (dx, dy, r) in enumerate(((0, 0, 0.5), (0.35, 0.1, 0.38), (-0.3, 0.12, 0.4))):
        m.ball(r * size, (x + dx * size, y + dy * size, z + r * size * 0.6), P.LEAF[2 + k % 2], subdiv=1, scale=(1, 1, 0.8))


# --- people ----------------------------------------------------------------------------

class Look:
    """How someone is dressed. Hair, top and legs are colours; `beard` may be None."""

    def __init__(self, hair=P.HAIR, top=P.TEE, legs=P.SHORTS, shoes=P.SHOE, skin=P.SKIN, beard=None,
                 long_hair=False, cap=None):
        self.hair, self.top, self.legs, self.shoes, self.skin = hair, top, legs, shoes, skin
        self.beard, self.long_hair, self.cap = beard, long_hair, cap


YOUNG_VINCENT = Look(hair="#4a3322", top="#2f6f73", legs="#3a4a6e", shoes="#3b3a42")


def _head(m: Model, z: float, look: Look):
    """A head sitting on the neck at height z, facing -y."""
    m.box((0.2, 0.2, 0.12), (0, 0.0, z - 0.02), look.skin)                               # neck
    hz = z + 0.23
    m.box((0.42, 0.4, 0.44), (0, 0.0, hz), look.skin)
    if look.beard:
        m.box((0.44, 0.41, 0.15), (0, 0.0, hz - 0.145), look.beard)
        m.box((0.22, 0.03, 0.035), (0, -0.203, hz - 0.06), look.beard)
    m.box((0.14, 0.03, 0.035), (0, -0.207, hz - 0.105), P.TEETH)                           # smile
    m.box((0.07, 0.05, 0.08), (0, -0.215, hz - 0.01), look.skin)                           # nose
    for x in (-0.1, 0.1):
        m.box((0.06, 0.02, 0.06), (x, -0.205, hz + 0.04), P.INK)                          # eyes
        m.box((0.1, 0.02, 0.025), (x, -0.205, hz + 0.095), look.hair)                     # brows
        m.box((0.04, 0.1, 0.12), (x * 2.2, 0.02, hz), look.skin)                          # ears
    m.box((0.46, 0.44, 0.13), (0, 0.01, hz + 0.26), look.hair)                            # hair on top
    m.box((0.44, 0.1, 0.1), (0, -0.17, hz + 0.19), look.hair)                             # fringe
    m.box((0.44, 0.06, 0.3 if not look.long_hair else 0.62), (0, 0.21, hz + (0.1 if not look.long_hair else -0.06)), look.hair)
    for x in (-0.225, 0.225):
        m.box((0.03, 0.3, 0.16 if not look.long_hair else 0.5), (x, 0.06, hz + (0.13 if not look.long_hair else -0.04)), look.hair)
    if look.cap:
        m.box((0.47, 0.45, 0.12), (0, 0.0, hz + 0.3), look.cap)
        m.box((0.36, 0.26, 0.035), (0, -0.33, hz + 0.26), look.cap, rot=(-0.2, 0, 0))


def person(root, name: str, loc, rot_z: float = 0.0, look: Look | None = None, pose: str = "stand",
           scale: float = 1.0, arms: str = "down", **props):
    """Someone standing or sitting (on a seat 0.5 high), facing -y before `rot_z` turns them.

    arms: "down" by their sides, "forward" (typing, drawing), or "point" (the right arm up at a
    board to their right).
    """
    look = look or Look()
    g = group(name, loc, rot_z=rot_z, parent=root, **props)
    g.scale = (scale, scale, scale)
    m = Model(f"{name}_body")
    if pose == "sit":
        for x in (-0.16, 0.16):
            m.box((0.21, 0.52, 0.21), (x, -0.24, 0.62), look.legs)                          # thighs
            m.box((0.17, 0.17, 0.5), (x, -0.5, 0.3), look.legs)                              # shins
            m.box((0.2, 0.32, 0.1), (x, -0.58, 0.06), look.shoes)
        hip = 0.72
    else:
        for x in (-0.15, 0.15):
            m.box((0.22, 0.24, 0.9), (x, 0.0, 0.52), look.legs)
            m.box((0.22, 0.34, 0.1), (x, -0.05, 0.05), look.shoes)
        hip = 0.95
    m.box((0.56, 0.34, 0.66), (0, 0.02, hip + 0.33), look.top)                                # torso
    shoulder = hip + 0.58
    for side in (-1, 1):
        s = (side * 0.34, 0.0, shoulder)
        if arms == "forward":
            elbow = (side * 0.36, -0.22, shoulder - 0.3)
            hand = (side * 0.2, -0.55, shoulder - 0.3)
        elif arms == "point" and side < 0:
            elbow = (side * 0.5, -0.05, shoulder + 0.05)
            hand = (side * 0.72, -0.12, shoulder + 0.3)
        else:
            elbow = (side * 0.37, 0.02, shoulder - 0.32)
            hand = (side * 0.38, 0.0, shoulder - 0.62)
        m.plank_line(s, elbow, 0.14, 0.14, look.top)
        m.plank_line(elbow, hand, 0.12, 0.12, look.skin)
        m.box((0.12, 0.12, 0.12), hand, look.skin)
    _head(m, shoulder + 0.12, look)
    m.build(g)
    return g


# --- things ----------------------------------------------------------------------------

def bike(root, name: str, loc, rot_z: float = 0.0, frame: str = "#2f3a3a", scale: float = 1.0, **props):
    """A Dutch bike (upright, black-ish, with a rack), pointing along +x. Returns its group, so
    a load can go on the rack (at x = -0.45, z = 0.95 before scaling)."""
    g = group(name, loc, rot_z=rot_z, parent=root, **props)
    g.scale = (scale, scale, scale)
    m = Model(f"{name}_frame")
    for x in (-0.55, 0.55):
        m.cyl(0.36, 0.05, (x, 0.025, 0.36), P.INK, segs=12, rot=(math.pi / 2, 0, 0))      # tyres
        m.cyl(0.28, 0.06, (x, 0.03, 0.36), "#8d8a93", segs=12, rot=(math.pi / 2, 0, 0))   # spokes, seen as a blur
        m.cyl(0.05, 0.08, (x, 0.04, 0.36), P.INK, segs=6, rot=(math.pi / 2, 0, 0))        # hub
    rear, front = (-0.55, 0, 0.36), (0.55, 0, 0.36)
    crank, seat, head = (-0.05, 0, 0.36), (-0.2, 0, 0.9), (0.42, 0, 0.92)
    for a, b in ((rear, crank), (crank, seat), (rear, seat), (crank, head), (seat, (0.4, 0, 0.8)), (front, head)):
        m.plank_line(a, b, 0.045, 0.045, frame)
    m.plank_line(head, (0.36, 0, 1.12), 0.045, 0.045, frame)                            # stem
    m.plank_line((0.26, -0.24, 1.14), (0.26, 0.24, 1.14), 0.04, 0.04, P.INK)            # handlebar
    m.box((0.26, 0.12, 0.06), (-0.22, 0, 0.96), P.INK)                                  # saddle
    m.box((0.5, 0.3, 0.03), (-0.45, 0, 0.8), frame)                                     # rack
    m.plank_line((-0.65, 0, 0.8), rear, 0.03, 0.03, frame)
    m.box((0.5, 0.05, 0.08), (-0.52, 0.0, 0.45), "#1f1d24")                              # mudguard, chain case
    m.box((0.35, 0.08, 0.14), (-0.28, 0.08, 0.38), "#1f1d24")
    m.box((0.1, 0.08, 0.06), (0.55, 0.0, 0.82), P.LANTERN)                               # front light
    m.build(g)
    return g


# 5 wide, 7 tall; enough letters for the signs so far
GLYPHS = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "I": ["00100"] * 7,
    "M": ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "T": ["11111"] + ["00100"] * 6,
}


def letters(m: Model, text: str, origin, cell: float, depth: float, color: str, gap: float = 1.0):
    """Blocky capitals standing on `origin` (their left foot), in the XZ plane, facing -y."""
    x0, y0, z0 = origin
    for k, ch in enumerate(text):
        rows = GLYPHS[ch]
        for r, row in enumerate(rows):
            z = z0 + (len(rows) - 1 - r) * cell + cell / 2
            c = 0
            while c < len(row):
                if row[c] != "1":
                    c += 1
                    continue
                run = c
                while run < len(row) and row[run] == "1":
                    run += 1
                x = x0 + k * (5 + gap) * cell + (c + run) / 2 * cell
                m.box(((run - c) * cell + 0.002, depth, cell + 0.002), (x, y0, z), color)
                c = run
    return len(text) * (5 + gap) * cell - gap * cell
