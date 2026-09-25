"""Smaller things: campfire, pier, kayak, signpost, well, bench, lamps, cairns, flag…

Parts the runtime animates are separate objects with telling names:
  flame*   flicker      flag   waves      wing_*   flap      arm_strum   strums      arm_fret   changes chords
"""
from __future__ import annotations

import math

import palette as P
from kit import Model, emitter, light


def campfire(root):
    m = Model("campfire_base")
    for i in range(9):
        a = i / 9 * math.tau
        m.ball(0.22, (math.cos(a) * 0.75, math.sin(a) * 0.75, 0.1), P.ROCK[2 + i % 2], subdiv=1, scale=(1.2, 1, 0.8))
    m.plank_line((-0.6, -0.3, 0.12), (0.6, 0.3, 0.3), 0.16, 0.16, P.WOOD_DARK)
    m.plank_line((-0.6, 0.3, 0.12), (0.6, -0.3, 0.3), 0.16, 0.16, P.WOOD)
    m.ball(0.3, (0, 0, 0.12), "#2a1d1d", subdiv=1, scale=(1.4, 1.4, 0.4))  # embers bed
    m.build(root)
    for i, (x, y, h, r) in enumerate([(0, 0, 1.1, 0.34), (0.18, 0.1, 0.8, 0.22), (-0.16, -0.08, 0.7, 0.2)]):
        f = Model(f"flame{i}")
        f.cyl(r, h, (0, 0, 0), P.FIRE if i else "#ffd070", segs=5, r_top=0.0, glow=True)
        f.build(root, loc=(x, y, 0.2))
    light(root, (0, 0, 0.8), P.FIRE, 9, 1.6, flicker=1.0, day=True)
    emitter(root, (0, 0, 1.0), "embers")


def log_seat(root):
    m = Model("log")
    m.cyl(0.28, 1.8, (-0.9, 0, 0.28), P.WOOD, segs=7, rot=(0, math.pi / 2, 0))
    m.build(root)


def pier(root, length: float):
    m = Model("pier", seed=5)
    w = 2.2
    for i in range(int(length / 0.45)):
        y = -i * 0.45
        m.box((w, 0.4, 0.12), (0, y, 0.72), P.WOOD_LIGHT if i % 3 else P.WOOD)
    for y in range(0, int(length) + 1, 2):
        for x in (-w / 2, w / 2):
            m.cyl(0.13, 1.8, (x, -y, -1.0), P.WOOD_DARK, segs=6)
    m.cyl(0.14, 1.0, (w / 2 - 0.2, -length + 0.4, 0.7), P.WOOD_DARK, segs=6)      # mooring post
    m.cyl(0.25, 0.1, (-w / 2 + 0.5, -length + 0.8, 0.78), "#d9c79a", segs=8)      # rope coil
    # lamp at the end of the pier
    m.cyl(0.07, 2.2, (-w / 2 + 0.2, -length + 0.3, 0.78), P.IRON, segs=5)
    m.box((0.35, 0.35, 0.45), (-w / 2 + 0.2, -length + 0.3, 3.1), P.LANTERN, glow=True)
    m.box((0.5, 0.5, 0.1), (-w / 2 + 0.2, -length + 0.3, 3.38), P.IRON)
    m.build(root)
    light(root, (-w / 2 + 0.2, -length + 0.3, 3.0), P.WARM_LIGHT, 6)


def kayak(root):
    m = Model("kayak")
    m.ball(1.0, (0, 0, 0.1), P.KAYAK, subdiv=2, scale=(0.38, 2.0, 0.2))
    m.ball(0.3, (0, 0.1, 0.22), P.INK, subdiv=1, scale=(1, 1.6, 0.4))
    m.plank_line((-1.2, -0.9, 0.3), (1.2, 1.0, 0.35), 0.06, 0.06, P.WOOD_DARK)
    m.box((0.3, 0.08, 0.5), (-1.25, -0.95, 0.3), "#2a5da8", rot=(0, 0, 0.9))
    m.box((0.3, 0.08, 0.5), (1.25, 1.05, 0.35), "#2a5da8", rot=(0, 0, 0.9))
    m.build(root)


def signpost(root):
    m = Model("signpost")
    m.cyl(0.1, 2.6, (0, 0, 0), P.WOOD_DARK, segs=6)
    for z, rot, c in [(2.2, 0.5, P.WOOD_LIGHT), (1.75, -2.4, P.PLANK), (1.3, 1.9, P.WOOD_LIGHT)]:
        board = Model("board")
        board.box((1.2, 0.08, 0.32), (0.65, 0, 0), c)
        board.prism([(1.25, -0.16), (1.45, 0), (1.25, 0.16)], 0.08, (0, 0, 0), c)
        board.build(root, loc=(0, 0, z), rot_z=rot)
    m.build(root)


def well(root):
    m = Model("well", seed=6)
    m.cyl(1.0, 0.9, (0, 0, 0), P.STONE, segs=10)
    m.cyl(1.08, 0.14, (0, 0, 0.9), P.STONE_DARK, segs=10)
    m.cyl(0.75, 0.05, (0, 0, 0.98), "#07060c", segs=10)
    for x in (-0.9, 0.9):
        m.box((0.16, 0.16, 1.9), (x, 0, 1.9), P.WOOD_DARK)
    m.gable((2.4, 1.6, 0.7), (0, 0, 2.8), P.RUST_ROOF, overhang=0.15)
    m.cyl(0.07, 1.8, (-0.9, 0, 2.3), P.WOOD, segs=5, rot=(0, math.pi / 2, 0))
    m.cyl(0.02, 0.8, (0, 0, 1.5), "#d9c79a", segs=4)
    m.cyl(0.2, 0.3, (0, 0, 1.2), P.WOOD, segs=7)
    m.build(root)


def bench(root):
    """A wrought-iron rest bench. Sitting here feels like saving your progress."""
    m = Model("bench")
    for x in (-0.8, 0.8):
        m.box((0.08, 0.5, 0.45), (x, 0, 0.22), P.IRON)
        m.box((0.08, 0.08, 0.9), (x, 0.24, 0.6), P.IRON)
    for i in range(3):
        m.box((1.9, 0.14, 0.06), (0, -0.16 + i * 0.16, 0.48), P.WOOD_LIGHT)
    m.box((1.9, 0.06, 0.28), (0, 0.26, 0.85), P.IRON)
    for x in (-0.95, 0.95):
        m.ball(0.08, (x, 0.26, 1.02), P.IRON, subdiv=1)
    m.build(root)


def lamp(root):
    m = Model("lamp")
    m.cyl(0.07, 2.4, (0, 0, 0), P.IRON, segs=5)
    m.cyl(0.18, 0.12, (0, 0, 0), P.IRON, segs=6)
    m.box((0.32, 0.32, 0.42), (0, 0, 2.55), P.LANTERN, glow=True)
    m.cyl(0.3, 0.2, (0, 0, 2.76), P.IRON, segs=4, r_top=0.02)
    m.build(root)
    light(root, (0, 0, 2.5), P.WARM_LIGHT, 5.5)


def cairn(root, seed: int):
    m = Model("cairn", seed)
    z = 0
    for i, r in enumerate([0.42, 0.34, 0.27, 0.2, 0.13]):
        m.ball(r, (m.rng.uniform(-0.04, 0.04), 0, z + r * 0.5), P.ROCK[1 + i % 3], subdiv=1, scale=(1.2, 1.0, 0.55))
        z += r * 0.95
    m.build(root)


def summit_flag(root):
    m = Model("flagpole")
    m.cyl(0.05, 3.0, (0, 0, 0), P.WOOD_DARK, segs=5)
    m.build(root)
    f = Model("flag")
    f.box((1.2, 0.04, 0.7), (0.62, 0, 0), P.RED)
    f.ball(0.14, (0.55, -0.04, 0.02), P.WOOL, subdiv=1)                     # a tiny sheep emblem
    f.build(root, loc=(0, 0, 2.6))


def boulder(root):
    """A bouldering block with a couple of coloured problems on it."""
    m = Model("boulder", seed=21)
    m.ball(1.6, (0, 0, 1.0), P.ROCK[2], subdiv=2, scale=(1.3, 1.0, 0.95), jitter=0.18)
    for i, c in enumerate(["#e8b24a"] * 5 + ["#43b3d9"] * 4 + ["#e46f5a"] * 4):
        a = i * 2.4
        z = 0.5 + (i % 5) * 0.4
        r = 1.6 * math.sqrt(max(0.1, 1 - ((z - 1.0) / 1.52) ** 2))
        m.box((0.16, 0.16, 0.12), (math.cos(a) * r * 1.25, math.sin(a) * r * 0.95, z), c)
    m.build(root)


def card_table(root):
    m = Model("card_table")
    m.box((1.6, 1.0, 0.08), (0, 0, 0.8), "#2d5a3c")
    for x in (-0.7, 0.7):
        for y in (-0.4, 0.4):
            m.box((0.08, 0.08, 0.8), (x, y, 0.4), P.WOOD_DARK)
    for i, c in enumerate(["#e8d7a8", "#5b7fd1", P.RED, "#e8d7a8", "#3d7a4a"]):
        m.box((0.16, 0.22, 0.02), (-0.55 + i * 0.27, -0.15 + (i % 2) * 0.2, 0.85), c, rot=(0, 0, 0.1 * i))
    m.box((0.2, 0.28, 0.12), (0.5, 0.3, 0.9), "#6b3f8c")                    # the library (deck)
    for x in (-1.1, 1.1):                                                   # two stools
        m.cyl(0.25, 0.5, (x, 0, 0), P.WOOD, segs=6)
    m.build(root)


def guitar_case(root):
    m = Model("guitar_case")
    m.ball(0.5, (0, 0, 0.08), "#1f1a26", subdiv=1, scale=(1.8, 0.8, 0.25))
    m.ball(0.44, (0, 0, 0.12), "#8c2f39", subdiv=1, scale=(1.8, 0.75, 0.12))
    for x in (-0.3, 0.1, 0.4):
        m.cyl(0.05, 0.02, (x, 0.05, 0.18), P.GOLD, segs=6)
    m.build(root)


def ufo(root):
    m = Model("ufo")
    m.cyl(1.6, 0.25, (0, 0, 0), "#8a91a8", segs=12, r_top=1.2)
    m.cyl(1.2, 0.2, (0, 0, -0.2), "#4a4f66", segs=12, r_top=1.6)
    m.ball(0.7, (0, 0, 0.3), P.UFO, subdiv=2, scale=(1, 1, 0.6), glow=True)
    for i in range(6):
        a = i / 6 * math.tau
        m.ball(0.1, (math.cos(a) * 1.45, math.sin(a) * 1.45, 0.02), "#fff6a0", subdiv=1, glow=True)
    m.build(root)
    light(root, (0, 0, -0.5), P.UFO, 10, 2.0)
