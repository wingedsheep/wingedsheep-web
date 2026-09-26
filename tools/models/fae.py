"""The fair folk, who hold a revel on the island on some nights (src/island/scene/revel.ts): a
ring of toadstools that comes up out of the grass, Oberon and Titania dancing inside it, Puck
turning cartwheels round the outside, and pixies dancing the ring.

They're templates like the wildlife (fauna.py merges ALL into its own): parked out of sight
under a root tagged `fauna=<name>`, facing +x, y to their left, feet at z = 0. Parts that move
are their own objects, pivoting where they join. The toadstools are one part each, so they can
come up one by one.
"""
from __future__ import annotations

import math
import random

from mathutils import Vector

import palette as P
from kit import Model

RING = 1.6  # the fairy ring's radius; the runtime dances round it


def _limb(m: Model, a, b, r0, r1, color, segs=5, glow=False):
    """A tapered round limb from a (radius r0) to b (radius r1)."""
    d = Vector(b) - Vector(a)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r0, d.length, a, color, segs=segs, r_top=r1, rot=tuple(rot), glow=glow)


def _ears(m: Model, z, spread, length, color):
    """Long pointed ears, swept back and up."""
    for s in (1, -1):
        _limb(m, (-0.02, s * spread, z), (-0.1, s * (spread + length * 0.6), z + length * 0.8), 0.035, 0.004, color, segs=4)


def _arms(body, name: str, shoulder, length, sleeve, r, hand):
    """Two arms hanging from the shoulders, <name>_arm_l / _arm_r; the runtime raises them (about x)."""
    x, y, z = shoulder
    for side in (1, -1):
        a = Model(f"{name}_arm_{'l' if side > 0 else 'r'}")
        _limb(a, (0, 0, 0), (0.03, side * 0.02, -length), r, r * 0.75, sleeve)
        a.ball(r * 0.8, (0.035, side * 0.02, -length - r * 0.4), hand)
        a.build(body, loc=(x, side * y, z))


def _wing(body, name: str, at, size, color, sweep=0.4, lower=True):
    """A pair of gossamer wings on the back, <name>_wing_l / _wing_r, flat and upright; they beat about z."""
    x, y, z = at
    upper = [(0, 0), (0.18, 0.12), (0.36, 0.42), (0.3, 0.52), (0.12, 0.34), (0.02, 0.12)]
    under = [(0, 0), (0.04, -0.14), (0.16, -0.3), (0.24, -0.26), (0.1, -0.08)]
    for side in (1, -1):
        w = Model(f"{name}_wing_{'l' if side > 0 else 'r'}")
        for shape in (upper, under) if lower else (upper,):
            pts = [(px * size, pz * size) for px, pz in shape]
            if side < 0:
                pts = [(-px, pz) for px, pz in pts][::-1]
            # drawn in x (outwards) and z; turned so outwards is ±y, swept back towards -x
            w.prism(pts, 0.012, (0, 0, 0), color, rot=(0, 0, math.pi / 2 + side * sweep), glow=True)
        w.build(body, loc=(x, side * y, z))


def oberon(root):
    """Oberon, King of the fair folk: tall and narrow, a cloak like the woods at midnight lined
    with moss, a gold circlet and antlers, silver hair to his shoulders, eyes that catch the light."""
    b = Model("oberon_body", seed=7)
    b.cyl(0.34, 1.1, (0, 0, 0), P.FAE_CLOAK, segs=8, r_top=0.17)                       # the cloak, to the ground
    b.box((0.05, 0.22, 0.95), (0.27, 0, 0.5), P.FAE_CLOAK_LINING, taper=0.6)          # open at the front: the lining
    b.box((0.05, 0.14, 0.9), (0.29, 0, 0.5), P.FAE_DOUBLET, taper=0.6)
    b.box((0.34, 0.38, 0.42), (0, 0, 1.2), P.FAE_DOUBLET)                              # chest
    b.cyl(0.21, 0.05, (0, 0, 0.98), P.FAE_GOLD, segs=8)                                # a gold belt
    for i in range(9):                                                                 # a collar of leaves
        a = -math.pi * 0.85 + i * math.pi * 1.7 / 8
        b.ball(0.07, (math.cos(a) * 0.19, math.sin(a) * 0.22, 1.42), P.FAE_CLOAK_LINING if i % 3 else P.AUTUMN[1],
               scale=(1, 1, 0.5), jitter=0.01)
    body = b.build(root)
    _arms(body, "oberon", (0.0, 0.25, 1.36), 0.56, P.FAE_CLOAK, 0.075, P.FAE_SKIN)
    h = Model("oberon_head", seed=8)  # pivots at the neck
    h.box((0.1, 0.1, 0.1), (0, 0, 0.03), P.FAE_SKIN)                                   # neck
    h.box((0.28, 0.26, 0.34), (0.01, 0, 0.22), P.FAE_SKIN, taper=0.95)
    h.box((0.06, 0.18, 0.1), (0.12, 0, 0.07), P.FAE_SKIN, taper=0.5)                   # a narrow chin
    h.box((0.05, 0.04, 0.07), (0.16, 0, 0.22), P.FAE_SKIN)                             # nose
    for s in (1, -1):
        h.box((0.02, 0.06, 0.03), (0.155, s * 0.07, 0.27), P.FAE_EYE, glow=True)       # eyes
        h.box((0.02, 0.08, 0.02), (0.16, s * 0.07, 0.31), P.FAE_SILVER, rot=(s * 0.25, 0, 0))  # brows, up at the ends
        h.box((0.24, 0.05, 0.4), (-0.03, s * 0.15, 0.16), P.FAE_SILVER)                # hair, to the shoulders
    h.box((0.06, 0.3, 0.44), (-0.15, 0, 0.14), P.FAE_SILVER)
    h.box((0.3, 0.3, 0.06), (-0.01, 0, 0.4), P.FAE_SILVER)                             # …and on top
    _ears(h, 0.24, 0.13, 0.16, P.FAE_SKIN)
    h.cyl(0.165, 0.05, (0, 0, 0.38), P.FAE_GOLD, segs=8)                               # the circlet
    h.box((0.03, 0.05, 0.07), (0.16, 0, 0.42), P.FAE_GOLD)                             # a point at the front
    for s in (1, -1):                                                                   # antlers: a beam and three tines
        base = Vector((-0.02, s * 0.11, 0.42))
        beam = [base, base + Vector((-0.05, s * 0.12, 0.2)), base + Vector((-0.12, s * 0.2, 0.42)), base + Vector((-0.18, s * 0.22, 0.6))]
        for p, q in zip(beam, beam[1:]):
            _limb(h, p, q, 0.036, 0.026, P.FAE_ANTLER, segs=4)
        for k, (dx, dy, dz) in enumerate([(0.1, 0.02, 0.14), (0.08, 0.06, 0.16), (0.04, 0.08, 0.12)]):
            p = beam[k + 1]
            _limb(h, p, p + Vector((dx, s * dy, dz)), 0.024, 0.01, P.FAE_ANTLER, segs=4)
    h.build(body, loc=(0, 0, 1.41))


def titania(root):
    """Titania, his Queen: a gown like moonlight, copper hair to her waist under a crown of
    flowers, and gossamer wings that shimmer."""
    b = Model("titania_body", seed=11)
    b.cyl(0.38, 1.0, (0, 0, 0), P.FAE_GOWN, segs=10, r_top=0.15)                        # the gown, flaring out
    b.cyl(0.39, 0.07, (0, 0, 0), P.FAE_GOWN_SHADE, segs=10, r_top=0.37)                 # its hem
    b.box((0.26, 0.32, 0.36), (0, 0, 1.12), P.FAE_GOWN)                                 # bodice
    b.cyl(0.15, 0.04, (0, 0, 0.96), P.FAE_GOWN_SHADE, segs=8)
    for i, c in enumerate([P.BLOSSOM[0], P.FAE_GOLD, P.BLOSSOM[2], P.LEAF[2], P.BLOSSOM[0]]):
        a = -0.9 + i * 0.45                                                             # a sash of flowers
        b.ball(0.035, (math.cos(a) * 0.16, math.sin(a) * 0.17, 0.98), c)
    for s in (1, -1):
        b.box((0.06, 0.09, 0.9), (-0.16, s * 0.08, 0.72), P.FAE_COPPER, taper=0.6)      # her hair, down her back
    body = b.build(root)
    _arms(body, "titania", (0.0, 0.2, 1.26), 0.5, P.FAE_SKIN_WARM, 0.055, P.FAE_SKIN_WARM)
    _wing(body, "titania", (-0.14, 0.06, 1.1), 1.15, P.FAE_WING, sweep=0.6)
    h = Model("titania_head", seed=12)
    h.box((0.08, 0.08, 0.08), (0, 0, 0.03), P.FAE_SKIN_WARM)
    h.box((0.25, 0.23, 0.3), (0.01, 0, 0.2), P.FAE_SKIN_WARM, taper=0.95)
    h.box((0.05, 0.14, 0.08), (0.1, 0, 0.07), P.FAE_SKIN_WARM, taper=0.5)
    for s in (1, -1):
        h.box((0.02, 0.05, 0.03), (0.14, s * 0.06, 0.24), P.FAE_EYE, glow=True)
        h.box((0.02, 0.03, 0.02), (0.14, s * 0.075, 0.14), P.CHEEK)                     # a flush
        h.box((0.2, 0.05, 0.36), (-0.03, s * 0.135, 0.12), P.FAE_COPPER)
    h.box((0.06, 0.26, 0.42), (-0.13, 0, 0.1), P.FAE_COPPER)
    h.box((0.27, 0.27, 0.07), (-0.01, 0, 0.36), P.FAE_COPPER)
    _ears(h, 0.22, 0.115, 0.13, P.FAE_SKIN_WARM)
    flowers = [P.BLOSSOM[1], "#fff4ea", P.FAE_GOLD, P.BLOSSOM[0], "#fff4ea", P.PANSY]
    for i in range(12):                                                                 # the crown of flowers
        a = i * math.tau / 12
        at = (math.cos(a) * 0.15, math.sin(a) * 0.14, 0.38 + 0.02 * math.sin(a * 3))
        if i % 2:
            h.ball(0.035, at, P.LEAF[2], scale=(1, 1, 0.6))
        else:
            h.ball(0.042, at, flowers[(i // 2) % len(flowers)], subdiv=1)
    h.build(body, loc=(0, 0, 1.3))


def puck(root):
    """Puck, Robin Goodfellow: small and quick, goat legs, a jerkin of leaves, little horns, a
    grin, and a sprig of love-in-idleness in his hand."""
    b = Model("puck_body", seed=13)
    for s in (1, -1):                                                                   # goat legs, hooves
        _limb(b, (0, s * 0.06, 0.3), (0.04, s * 0.06, 0.16), 0.05, 0.04, P.PUCK_FUR)
        _limb(b, (0.04, s * 0.06, 0.16), (-0.02, s * 0.06, 0.03), 0.04, 0.03, P.PUCK_FUR)
        b.box((0.06, 0.05, 0.04), (0.0, s * 0.06, 0.02), P.INK)
    b.cyl(0.13, 0.22, (0, 0, 0.26), P.PUCK, segs=6, r_top=0.1)                          # the jerkin
    for i in range(6):                                                                  # its hem, cut into leaves
        a = i * math.tau / 6 + 0.3
        b.prism([(-0.04, 0), (0.04, 0), (0, -0.07)], 0.01, (math.cos(a) * 0.125, math.sin(a) * 0.125, 0.27),
                P.PUCK if i % 2 else P.LEAF[1], rot=(0, 0, a + math.pi / 2))
    b.cyl(0.11, 0.03, (0, 0, 0.34), P.PUCK_FUR, segs=6)                                 # belt
    body = b.build(root)
    _arms(body, "puck", (0.0, 0.12, 0.45), 0.2, P.PUCK_SKIN, 0.03, P.PUCK_SKIN)
    f = Model("puck_flower")                                                             # the flower, in his right hand
    _limb(f, (0, 0, 0), (0.02, 0, 0.12), 0.006, 0.006, P.LEAF[2], segs=3)
    for i in range(5):
        a = i * math.tau / 5
        f.ball(0.02, (0.02 + math.cos(a) * 0.018, math.sin(a) * 0.018, 0.13), P.PANSY if i else P.FAE_GOLD)
    arm_r = next(o for o in body.children if o.name.startswith("puck_arm_r"))
    f.build(arm_r, loc=(0.04, -0.03, -0.22))
    h = Model("puck_head", seed=14)
    h.ball(0.12, (0, 0, 0.1), P.PUCK_SKIN, subdiv=2, scale=(0.95, 1, 1))
    h.box((0.03, 0.03, 0.04), (0.12, 0, 0.1), P.PUCK_SKIN)                              # a snub nose
    for s in (1, -1):
        h.box((0.02, 0.035, 0.03), (0.11, s * 0.045, 0.14), P.INK)                       # bright little eyes
        _limb(h, (-0.02, s * 0.06, 0.2), (-0.06, s * 0.09, 0.29), 0.022, 0.005, P.FAE_ANTLER, segs=4)  # horns
    h.box((0.02, 0.11, 0.025), (0.115, 0, 0.055), "#f6f0e2")                            # the grin
    h.box((0.02, 0.02, 0.02), (0.112, 0.06, 0.07), "#f6f0e2")
    h.box((0.02, 0.02, 0.02), (0.112, -0.06, 0.07), "#f6f0e2")
    for i in range(7):                                                                  # a shock of red hair
        a = i * math.tau / 7
        h.ball(0.045, (-0.02 + math.cos(a) * 0.06, math.sin(a) * 0.07, 0.2), P.PUCK_HAIR, jitter=0.01)
    _ears(h, 0.12, 0.1, 0.12, P.PUCK_SKIN)
    h.build(body, loc=(0, 0, 0.47))


def pixie(root, name: str, color: str, wing: str):
    """A pixie, a hand high: a glowing dress, a pale glowing face, and wings that never stop."""
    b = Model(f"{name}_body")
    b.cyl(0.06, 0.12, (0, 0, 0.02), color, segs=6, r_top=0.02, glow=True)              # dress
    for s in (1, -1):
        b.box((0.012, 0.012, 0.03), (0, s * 0.02, 0.01), "#fff4ea", glow=True)          # legs
    body = b.build(root)
    h = Model(f"{name}_head")
    h.ball(0.04, (0, 0, 0.03), "#fff4ea", subdiv=1, glow=True)
    h.ball(0.042, (-0.012, 0, 0.05), color, subdiv=1, scale=(0.9, 1, 0.7))              # hair
    for s in (1, -1):
        _limb(h, (0, s * 0.03, 0.04), (-0.01, s * 0.06, 0.08), 0.01, 0.002, "#fff4ea", segs=3, glow=True)
    h.build(body, loc=(0, 0, 0.14))
    _wing(body, name, (-0.02, 0.01, 0.12), 0.3, wing, sweep=0.6)


def fairy_ring(root):
    """A ring of toadstools: red caps with glowing spots, and here and there a pale one that
    glows all over. Each is its own part (fairyring_cap_<i>), standing at its place on the ring."""
    rng = random.Random(21)
    n = 16
    for i in range(n):
        a = i * math.tau / n + rng.uniform(-0.08, 0.08)
        r = RING + rng.uniform(-0.08, 0.08)
        big = rng.uniform(1.3, 2.0)
        pale = i % 4 == 2
        m = Model(f"fairyring_cap_{i}", seed=30 + i)
        h = 0.1 * big
        m.cyl(0.022 * big, h, (0, 0, 0), P.TOADSTOOL_STALK, segs=5, r_top=0.018 * big)
        m.box((0.05 * big, 0.05 * big, 0.012), (0, 0, h * 0.7), P.TOADSTOOL_STALK)     # the ring on the stalk
        cap = P.TOADSTOOL_PALE if pale else P.TOADSTOOL
        m.ball(0.075 * big, (0, 0, h), cap, subdiv=1, scale=(1, 1, 0.55), glow=pale)
        if not pale:
            for k in range(5):                                                          # the spots
                sa = k * math.tau / 5 + rng.uniform(0, 0.8)
                m.box((0.018, 0.018, 0.012), (math.cos(sa) * 0.045 * big, math.sin(sa) * 0.045 * big, h + 0.03 * big),
                      P.TOADSTOOL_SPOT, glow=True)
        if rng.random() < 0.5:                                                          # a little one alongside
            s = rng.uniform(0.4, 0.6)
            dx, dy = rng.uniform(-0.1, 0.1), rng.uniform(0.06, 0.1)
            m.cyl(0.014 * s * 1.5, 0.06 * s * 1.5, (dx, dy, 0), P.TOADSTOOL_STALK, segs=5)
            m.ball(0.05 * s * 1.5, (dx, dy, 0.09 * s * 1.5), cap, subdiv=1, scale=(1, 1, 0.55), glow=pale)
        m.build(root, loc=(math.cos(a) * r, math.sin(a) * r, 0), rot_z=rng.uniform(0, math.tau))


PIXIES = {
    "pixie_rose": ("#ffb3dc", "#ffe0f2"),
    "pixie_blue": ("#9fd4ff", "#e0f2ff"),
    "pixie_gold": ("#ffe08a", "#fff4d0"),
    "pixie_green": ("#b8f5a0", "#e8ffe0"),
}

ALL = {
    "oberon": (oberon, 1.15), "titania": (titania, 1.1), "puck": (puck, 1.3),
    **{k: ((lambda r, k=k, c=c: pixie(r, k, *c)), 1.6) for k, c in PIXIES.items()},
    "fairyring": (fairy_ring, 1.0),
}
