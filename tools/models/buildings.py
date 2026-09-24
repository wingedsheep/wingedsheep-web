"""Landmark buildings. Each builder adds parts under `root` (an empty at the building's foot).
Buildings face south (-y), towards the default camera."""
from __future__ import annotations

import math

import palette as P
from kit import Model, emitter, group, light


def _window(m: Model, x, y, z, w, h, frame=P.WOOD_DARK, arch=True, mullion=True):
    """A lit window on a south-facing wall at depth y."""
    m.box((w + 0.24, 0.16, h + 0.24), (x, y - 0.02, z), frame)
    m.box((w, 0.1, h), (x, y - 0.1, z), P.WARM_LIGHT, glow=True)
    if arch:
        m.cyl(w / 2 + 0.12, 0.16, (x, y + 0.06, z + h / 2), frame, segs=8, rot=(math.pi / 2, 0, 0))
        m.cyl(w / 2, 0.1, (x, y + 0.0, z + h / 2), P.WARM_LIGHT, segs=8, rot=(math.pi / 2, 0, 0), glow=True)
    if mullion:
        m.box((0.08, 0.14, h), (x, y - 0.14, z), frame)
        m.box((w, 0.14, 0.08), (x, y - 0.14, z + h * 0.15), frame)
    m.box((w + 0.4, 0.3, 0.1), (x, y - 0.15, z - h / 2 - 0.1), P.STONE)       # sill


def library(root):
    m = Model("library_body", seed=1)
    W, D = 9.0, 6.0
    # plinth, walls, timber frame
    m.box((W + 0.4, D + 0.4, 0.6), (0, 0, 0.3), P.STONE_DARK)
    m.box((W, D, 3.4), (0, 0, 2.3), P.PLASTER)
    for x in (-W / 2, W / 2):
        for y in (-D / 2, D / 2):
            m.box((0.34, 0.34, 3.4), (x, y, 2.3), P.WOOD_DARK)
    m.box((W + 0.1, 0.3, 0.3), (0, -D / 2, 3.9), P.WOOD_DARK)                 # lintel beam
    m.box((W + 0.1, 0.3, 0.3), (0, D / 2, 3.9), P.WOOD_DARK)
    # roof
    m.gable((W + 1.0, D + 0.2, 2.8), (0, 0, 4.0), P.PLUM_ROOF, overhang=0.5)
    m.box((W + 1.1, 0.25, 0.25), (0, 0, 6.85), P.PLUM_ROOF_DARK)               # ridge cap
    # gable ends in plaster
    m.prism([(-D / 2, 0), (D / 2, 0), (0, 2.6)], 0.2, (W / 2 - 0.05, 0, 4.0), P.PLASTER_DARK, rot=(0, 0, math.pi / 2))
    m.prism([(-D / 2, 0), (D / 2, 0), (0, 2.6)], 0.2, (-W / 2 + 0.05, 0, 4.0), P.PLASTER_DARK, rot=(0, 0, math.pi / 2))
    # front: two tall windows, door, round dormer
    for x in (-2.6, 2.6):
        _window(m, x, -D / 2, 2.3, 1.2, 1.8)
    m.box((1.5, 0.2, 2.3), (0, -D / 2 - 0.02, 1.75), P.WOOD)                    # door
    m.cyl(0.75, 0.2, (0, -D / 2 + 0.08, 2.9), P.WOOD, segs=10, rot=(math.pi / 2, 0, 0))
    m.box((1.8, 0.25, 0.14), (0, -D / 2 - 0.05, 3.55), P.STONE)
    m.box((0.12, 0.26, 0.12), (0.45, -D / 2 - 0.12, 1.8), P.GOLD)              # handle
    m.box((2.4, 1.0, 0.25), (0, -D / 2 - 0.6, 0.12), P.STONE)                   # step
    # dormer
    m.box((1.8, 1.6, 1.4), (0, -1.6, 5.0), P.PLASTER)
    m.gable((1.8, 2.3, 1.0), (0, -1.6, 5.7), P.PLUM_ROOF_DARK, rot=(0, 0, math.pi / 2))
    m.cyl(0.42, 0.1, (0, -2.42, 5.0), P.WARM_LIGHT, segs=10, rot=(math.pi / 2, 0, 0), glow=True)
    m.cyl(0.52, 0.08, (0, -2.4, 5.0), P.WOOD_DARK, segs=10, rot=(math.pi / 2, 0, 0))
    # chimney
    m.box((0.8, 0.8, 2.6), (3.0, 1.2, 6.2), P.STONE, taper=0.95)
    m.box((1.0, 1.0, 0.2), (3.0, 1.2, 7.55), P.STONE_DARK)
    # sign: an open book hanging by the door
    m.box((0.08, 0.9, 0.08), (-1.3, -D / 2 - 0.45, 3.2), P.IRON)
    m.box((0.9, 0.08, 0.6), (-1.3, -D / 2 - 0.85, 2.8), P.WOOD_LIGHT)
    m.box((0.7, 0.1, 0.4), (-1.3, -D / 2 - 0.9, 2.8), P.WHITE)
    # books stacked by the door
    for i, c in enumerate(P.BOOKS[:4]):
        m.box((0.5, 0.35, 0.12), (1.3 + (i % 2) * 0.05, -D / 2 - 0.5, 0.3 + i * 0.12), c)
    m.build(root)

    tower = Model("library_tower", seed=2)
    tx, ty = -W / 2 - 0.4, -D / 2 + 0.9
    tower.cyl(1.9, 7.4, (tx, ty, 0), P.STONE, segs=10)
    tower.cyl(2.0, 0.5, (tx, ty, 0), P.STONE_DARK, segs=10)
    tower.cyl(2.05, 0.3, (tx, ty, 7.4), P.STONE_DARK, segs=10)
    tower.cyl(2.5, 3.6, (tx, ty, 7.6), P.PLUM_ROOF, segs=10, r_top=0.05)
    for z in (2.6, 5.2):
        tower.box((0.45, 0.2, 1.0), (tx, ty - 1.9, z), P.WARM_LIGHT, glow=True)
        tower.box((0.65, 0.18, 1.2), (tx, ty - 1.86, z), P.STONE_DARK)
    tower.box((0.06, 0.06, 1.2), (tx, ty, 11.6), P.IRON)                      # weathervane pole
    tower.build(root)

    # a tiny winged sheep on the weathervane (turns in the wind)
    vane = group("weathervane", (tx, ty, 12.1), parent=root, spin=1)
    s = Model("vane_sheep")
    s.ball(0.28, (0, 0, 0), P.WOOL, scale=(1.3, 0.8, 0.8))
    s.box((0.2, 0.2, 0.2), (0.38, 0, 0.05), P.SHEEP_FACE)
    s.box((0.3, 0.04, 0.18), (-0.05, 0.22, 0.2), P.FEATHER, rot=(0.5, 0, 0))
    s.box((0.3, 0.04, 0.18), (-0.05, -0.22, 0.2), P.FEATHER, rot=(-0.5, 0, 0))
    s.build(vane)

    emitter(root, (3.0, 1.2, 7.8), "smoke")
    for x in (-2.6, 2.6):
        light(root, (x, -D / 2 - 1.0, 2.3), P.WARM_LIGHT, 5.5)
    light(root, (0, -D / 2 - 1.4, 1.6), P.WARM_LIGHT, 5)
    light(root, (tx, ty - 2.4, 5.2), P.WARM_LIGHT, 4, 0.6)


def workshop(root):
    m = Model("workshop_body", seed=3)
    W, D, H = 7.0, 6.5, 3.2
    m.box((W + 0.3, D + 0.3, 0.4), (0, 0, 0.2), P.STONE_DARK)
    # walls, with a real opening in the front for the barn door
    door_w, door_h, t_ = 3.2, 2.7, 0.25
    z0 = 0.4
    m.box((W, t_, H), (0, D / 2 - t_ / 2, z0 + H / 2), P.PLANK)                       # back
    for x in (-W / 2 + t_ / 2, W / 2 - t_ / 2):
        m.box((t_, D, H), (x, 0, z0 + H / 2), P.PLANK)                                # sides
    side = (W - door_w) / 2
    for x in (-(door_w + side) / 2, (door_w + side) / 2):
        m.box((side, t_, H), (x, -D / 2 + t_ / 2, z0 + H / 2), P.PLANK)              # front, beside the door
    m.box((door_w, t_, H - door_h), (0, -D / 2 + t_ / 2, z0 + door_h + (H - door_h) / 2), P.PLANK)
    m.box((W - 0.4, D - 0.4, 0.1), (0, 0, z0 + 0.05), P.WOOD_DARK)                    # floor
    m.box((W - 0.4, D - 0.4, 0.1), (0, 0, z0 + H - 0.05), "#1b1622")                  # ceiling (dark inside)
    for i in range(7):                                                                # plank lines outside
        z = 0.7 + i * 0.45
        for x in (-W / 2 - 0.01, W / 2 + 0.01):
            m.box((0.04, D, 0.05), (x, 0, z), P.WOOD_DARK)
        m.box((W, 0.04, 0.05), (0, D / 2 + 0.01, z), P.WOOD_DARK)
        if z > z0 + door_h:
            m.box((W, 0.04, 0.05), (0, -D / 2 - 0.01, z), P.WOOD_DARK)
        else:
            for x in (-(door_w + side) / 2, (door_w + side) / 2):
                m.box((side, 0.04, 0.05), (x, -D / 2 - 0.01, z), P.WOOD_DARK)
    for x in (-W / 2, W / 2):
        for y in (-D / 2, D / 2):
            m.box((0.3, 0.3, H), (x, y, 0.4 + H / 2), P.WOOD_DARK)
    # front gable (ridge runs north-south)
    m.gable((D + 0.8, W + 0.1, 2.6), (0, 0, 0.4 + H), P.RUST_ROOF, overhang=0.55, rot=(0, 0, math.pi / 2))
    m.prism([(-W / 2, 0), (W / 2, 0), (0, 2.5)], 0.2, (0, -D / 2 + 0.05, 0.4 + H), P.PLANK)
    m.cyl(0.55, 0.12, (0, -D / 2 - 0.07, 4.6), P.WARM_LIGHT, segs=8, rot=(math.pi / 2, 0, 0), glow=True)
    m.cyl(0.66, 0.1, (0, -D / 2 - 0.03, 4.6), P.WOOD_DARK, segs=8, rot=(math.pi / 2, 0, 0))
    # inside: a workbench against the back wall, a glowing screen, MTG cards pinned up
    m.box((3.0, 0.9, 0.12), (0, D / 2 - 0.8, 1.3), P.WOOD_LIGHT)
    for x in (-1.3, 1.3):
        m.box((0.12, 0.8, 0.9), (x, D / 2 - 0.8, 0.85), P.WOOD_DARK)
    m.box((1.1, 0.1, 0.7), (0, D / 2 - 0.5, 1.9), P.IRON)
    m.box((0.95, 0.06, 0.58), (0, D / 2 - 0.56, 1.9), P.SCREEN, glow=True)
    for i, c in enumerate((P.GOLD, "#5b7fd1", P.RED)):
        m.box((0.24, 0.04, 0.32), (-1.3 + i * 0.3, D / 2 - 0.27, 2.5 + (i % 2) * 0.1), c)
    m.box((0.5, 0.5, 0.9), (-2.5, D / 2 - 0.6, 0.85), P.WOOD)                         # shelf with parts
    m.box((1.2, 1.2, 0.02), (0.3, -0.2, z0 + 0.11), "#6b3f2b")                        # rug
    for side in (-1, 1):                                                        # door leaves swung open
        m.box((0.12, 1.5, 2.6), (side * 1.75, -D / 2 - 0.75, 1.7), P.WOOD)
        m.plank_line((side * 1.75, -D / 2 - 0.05, 0.6), (side * 1.75, -D / 2 - 1.45, 2.8), 0.14, 0.14, P.WOOD_DARK)
    m.box((3.6, 0.3, 0.3), (0, -D / 2, z0 + door_h + 0.1), P.WOOD_DARK)
    # side window
    _window(m, W / 2 + 0.01, 0, 2.0, 1.0, 1.0, arch=False)
    # stove pipe and a small dish listening to the sky
    m.cyl(0.18, 2.8, (2.0, 1.4, 4.0), P.IRON, segs=6)
    m.cyl(0.32, 0.2, (2.0, 1.4, 6.8), P.IRON, segs=6)
    m.cyl(0.08, 0.8, (-1.8, 0.8, 5.0), P.IRON, segs=5)
    m.cyl(0.6, 0.25, (-1.8, 0.8, 5.8), P.STONE, segs=8, r_top=0.15, rot=(0.6, 0, 0.4))
    # barrels and crates
    for i, (x, y) in enumerate([(-4.3, -2.2), (-4.4, -1.0)]):
        m.cyl(0.45, 0.95, (x, y, 0), P.WOOD, segs=8)
        m.cyl(0.47, 0.08, (x, y, 0.2), P.IRON, segs=8)
        m.cyl(0.47, 0.08, (x, y, 0.75), P.IRON, segs=8)
    m.box((0.9, 0.9, 0.9), (4.4, -2.4, 0.45), P.WOOD_LIGHT)
    m.box((0.7, 0.7, 0.7), (4.4, -2.4, 1.25), P.WOOD, rot=(0, 0, 0.3))
    m.build(root)
    emitter(root, (2.0, 1.4, 7.1), "smoke")
    light(root, (0, D / 2 - 1.4, 1.9), P.SCREEN, 5.5)
    light(root, (0, -D / 2 - 0.6, 1.6), P.WARM_LIGHT, 4)
    light(root, (0, -D / 2 - 0.8, 4.6), P.WARM_LIGHT, 3.5)


def lighthouse(root):
    m = Model("lighthouse_body", seed=4)
    # keeper's hut
    m.box((2.6, 2.2, 1.9), (2.0, 0.6, 0.95), P.WHITE)
    m.gable((2.8, 2.6, 1.1), (2.0, 0.6, 1.9), P.RED, overhang=0.2)
    m.box((0.6, 0.1, 0.8), (2.0, -0.52, 1.0), P.WARM_LIGHT, glow=True)
    # striped tower, tapering
    h, segs = 9.0, 10
    bands = 6
    for i in range(bands):
        z0 = i * h / bands
        r0 = 1.45 - 0.45 * (i / bands)
        r1 = 1.45 - 0.45 * ((i + 1) / bands)
        m.cyl(r0, h / bands, (0, 0, z0), P.RED if i % 2 == 0 else P.WHITE, segs=segs, r_top=r1)
    m.cyl(1.6, 0.4, (0, 0, 0), P.STONE_DARK, segs=segs)
    m.box((0.6, 0.12, 1.1), (0, -1.42, 0.75), P.WOOD_DARK)
    for z in (3.3, 6.2):
        m.box((0.3, 0.12, 0.5), (0, -1.28 + z * 0.05, z), P.WARM_LIGHT, glow=True)
    # gallery, lantern room, cap
    m.cyl(1.5, 0.22, (0, 0, h), P.STONE_DARK, segs=segs)
    for i in range(12):
        a = i / 12 * math.tau
        m.box((0.06, 0.06, 0.6), (math.cos(a) * 1.4, math.sin(a) * 1.4, h + 0.5), P.IRON)
    m.cyl(1.42, 0.06, (0, 0, h + 0.78), P.IRON, segs=segs)
    m.cyl(0.8, 1.3, (0, 0, h + 0.22), P.LANTERN, segs=8, glow=True)
    for i in range(4):
        a = i / 4 * math.tau + math.pi / 4
        m.box((0.1, 0.1, 1.3), (math.cos(a) * 0.8, math.sin(a) * 0.8, h + 0.87), P.IRON)
    m.cyl(1.0, 0.9, (0, 0, h + 1.5), P.RED, segs=segs, r_top=0.15)
    m.cyl(0.05, 0.6, (0, 0, h + 2.4), P.IRON, segs=4)
    m.ball(0.12, (0, 0, h + 3.0), P.GOLD, subdiv=1)
    m.build(root)
    group("beam", (0, 0, h + 0.9), parent=root, beam=1)
    light(root, (0, 0, h + 0.9), P.LANTERN, 9, 1.4)
    light(root, (2.0, -1.4, 1.0), P.WARM_LIGHT, 3.5)
