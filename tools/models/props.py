"""Smaller things: campfire, pier, kayak, signpost, well, bench, lamps, cairns, flag…

Parts the runtime animates are separate objects with telling names:
  flame*   flicker      flag   waves      wing_*   flap      arm_strum   strums      arm_fret   changes chords
"""
from __future__ import annotations

import math

import palette as P
from kit import Model, animate, emitter, light


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
    m.gable((2.4, 1.6, 0.7), (0, 0, 2.8), P.RUST_ROOF, overhang=0.15, icicles=True)
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


def cairn(root, seed: int, emblem: str | None = None):
    """A stack of stones with a flat capstone, and on it a token of the stretch of the career it
    stands for (see layout.CAIRN_EMBLEMS): a mortarboard on a book, a bus, a lightning bolt."""
    m = Model("cairn", seed)
    z = 0
    for i, r in enumerate([0.46, 0.38, 0.3, 0.24]):
        dx, dy = m.rng.uniform(-0.04, 0.04), m.rng.uniform(-0.03, 0.03)
        m.ball(r, (dx, dy, z + r * 0.5), P.LIMESTONE[(i + 1) % 3], subdiv=1, scale=(1.2, 1.05, 0.55),
               rot=(0, 0, m.rng.uniform(0, math.pi)))
        z += r * 0.92
    cap = 0.46 if emblem == "bus" else 0.3                                     # room for the wheels
    m.cyl(cap, 0.07, (0, 0, z - 0.03), P.LIMESTONE[0], segs=7, r_top=cap - 0.03, rot=(0, 0, m.rng.uniform(0, 1)))
    z += 0.04
    m.build(root)
    # a faint warm glow pooling on the ground round its foot, a little stronger after dark
    light(root, (0, 0, 0.35), P.LANTERN, 2.2, intensity=0.45, day=True, halo=False)
    if not emblem:
        return
    # the token, big enough to spot from the plaza
    e = Model(f"emblem_{emblem}")
    if emblem == "mortarboard":
        # a closed book: cream pages between two covers, the spine on the left
        e.box((0.46, 0.34, 0.08), (0.01, 0, 0.055), "#efe3c4")
        for zz in (0.0075, 0.1025):
            e.box((0.5, 0.37, 0.015), (0, 0, zz), "#8c2f39")
        e.box((0.03, 0.37, 0.11), (-0.235, 0, 0.055), "#8c2f39")
        e.box((0.505, 0.02, 0.016), (0, -0.12, 0.103), P.GOLD)                     # a gold band
        # the cap: a skull cap, the board at a jaunty tilt, a button and the tassel over the edge
        e.cyl(0.13, 0.09, (0, 0, 0.11), P.INK, segs=8)
        e.box((0.42, 0.42, 0.028), (0, 0, 0.214), P.INK, rot=(0.06, -0.04, math.pi / 4))
        e.cyl(0.03, 0.02, (0, 0, 0.226), P.GOLD, segs=6)
        e.plank_line((0, 0, 0.238), (0.27, -0.05, 0.228), 0.018, 0.018, P.GOLD)
        e.plank_line((0.27, -0.05, 0.228), (0.285, -0.055, 0.12), 0.018, 0.018, P.GOLD)
        e.cyl(0.035, 0.08, (0.285, -0.055, 0.05), P.GOLD, segs=6, r_top=0.014)   # the tassel
        scale = 1.6
    elif emblem == "bus":
        # a city bus: red, a white skirt, dark windows all along, a lit destination sign
        e.box((0.8, 0.3, 0.24), (0, 0, 0.2), P.RED)
        e.box((0.76, 0.27, 0.04), (0, 0, 0.335), P.RED, taper=0.94)                # the roof
        e.box((0.12, 0.2, 0.04), (-0.18, 0, 0.365), "#9aa0ab")                     # the air-con
        e.box((0.805, 0.305, 0.045), (0, 0, 0.1), P.WHITE)
        e.box((0.58, 0.31, 0.09), (-0.07, 0, 0.245), "#233040")                    # side windows
        for x in (-0.28, -0.14, 0.0, 0.14):
            e.box((0.015, 0.315, 0.09), (x, 0, 0.245), P.RED)                      # pillars
        e.box((0.02, 0.27, 0.13), (0.395, 0, 0.23), "#2e4458")                     # windscreen
        e.box((0.02, 0.2, 0.04), (0.402, 0, 0.318), "#ffb347", glow=True)          # destination
        e.box((0.1, 0.02, 0.2), (0.3, -0.15, 0.18), "#2e4458")                     # front door
        for y in (-0.1, 0.1):
            e.box((0.02, 0.05, 0.03), (0.402, y, 0.12), P.LANTERN, glow=True)      # headlights
        for x in (-0.24, 0.26):
            for y in (-0.13, 0.13):
                e.cyl(0.07, 0.06, (x, y, 0.07), P.INK, segs=8, rot=(math.pi / 2, 0, 0))
                e.cyl(0.03, 0.062, (x, y + (0.001 if y < 0 else -0.001), 0.07), "#9aa0ab", segs=6,
                      rot=(math.pi / 2, 0, 0))
        scale = 1.35
    elif emblem == "bolt":
        # a chunky lightning bolt, balanced on its tip and glowing after dark
        bolt = [(-0.02, 0.62), (0.22, 0.62), (0.1, 0.38), (0.24, 0.38), (-0.12, 0.0), (0.0, 0.3), (-0.13, 0.3)]
        e.prism([(x - 0.05, z) for x, z in bolt], 0.12, (0, 0, 0), P.GOLD, glow=True)
        scale = 1.35
        light(root, (0, 0, z + 0.5), P.GOLD, 3.0)
    obj = e.build(root, loc=(0, 0, z))
    obj.scale = (scale, scale, scale)
    # it turns slowly to and fro, which catches the eye from the plaza; the bolt hovers too
    animate(obj, f"{emblem}_idle", "rotation_euler", [(0, (0, 0, -0.5)), (4, (0, 0, 0.5)), (8, (0, 0, -0.5))])
    emitter(root, (0, 0, z + 0.4), "sparkle")         # golden motes rising round it (life.ts)
    if emblem == "bolt":
        animate(obj, f"{emblem}_idle", "location", [(t, (0, 0, 0.04 if t % 4 == 0 else 0.14)) for t in (0, 2, 4, 6, 8)])


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


def fire_wrap(root):
    """Dinner by the fire: a wrap on a tin plate on the grass beside Vincent's log. The wrap is
    its own mesh (`fire_wrap_roll`), since a gull sometimes leaves with it (mischief.ts)."""
    m = Model("fire_wrap_plate")
    m.cyl(0.22, 0.03, (0, 0, 0), "#b9c2c8", segs=10)
    m.cyl(0.17, 0.012, (0, 0, 0.03), "#d7dde0", segs=10)
    m.build(root)
    w = Model("fire_wrap_roll")
    w.cyl(0.07, 0.3, (-0.15, 0, 0.1), "#e8cf9c", segs=6, rot=(0, math.pi / 2, 0))
    w.cyl(0.05, 0.02, (0.15, 0, 0.1), "#7fae55", segs=6, rot=(0, math.pi / 2, 0))   # lettuce at the open end
    w.build(root)


def bottle(root):
    """A message in a bottle: green glass, a cork, a rolled-up note inside. The runtime floats it
    in to the beach (bottle.ts), so it lies on its side, along x."""
    m = Model("bottle")
    m.cyl(0.075, 0.26, (-0.13, 0, 0.075), "#4f8f6a", segs=8, rot=(0, math.pi / 2, 0))
    m.cyl(0.075, 0.07, (0.13, 0, 0.075), "#4f8f6a", segs=8, r_top=0.03, rot=(0, math.pi / 2, 0))
    m.cyl(0.03, 0.08, (0.2, 0, 0.075), "#4f8f6a", segs=6, rot=(0, math.pi / 2, 0))
    m.cyl(0.032, 0.05, (0.27, 0, 0.075), P.WOOD, segs=6, rot=(0, math.pi / 2, 0))     # the cork
    m.cyl(0.045, 0.2, (-0.1, 0, 0.075), "#f2ead2", segs=6, rot=(0, math.pi / 2, 0))   # the note, rolled up
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


# --- the mountain trail -------------------------------------------------------------------

def steps(root, treads, width=1.7):
    """Stone steps up a cliff, and a rope railing on posts. `treads` are (y0, y1, z) in the
    root's frame, from the bottom up: each step is a block whose top is its tread."""
    m = Model("steps", seed=5)
    for i, (y0, y1, z) in enumerate(treads):
        c = P.STEP if i % 2 else P.STONE
        m.box((width + m.rng.uniform(-0.1, 0.1), y1 - y0 + 0.06, 0.7), (m.rng.uniform(-0.04, 0.04), (y0 + y1) / 2, z - 0.27), c)
    m.build(root)
    r = Model("railing")
    for side in (-1, 1):
        tops = []
        for y0, y1, z in treads[::2] + treads[-1:]:
            x, y = side * (width / 2 + 0.12), (y0 + y1) / 2
            r.box((0.09, 0.09, 0.95), (x, y, z + 0.4), P.WOOD_DARK)
            tops.append((x, y, z + 0.82))
        for a, b in zip(tops, tops[1:]):
            r.plank_line(a, b, 0.035, 0.035, "#d9c7a0")                                   # rope
    r.build(root)


def trail_edge(root, pts, seed=12):
    """Pebbles lining the mountain trail, merged into one mesh. pts are world (x, y, z)."""
    m = Model("trail_edge", seed)
    for x, y, z in pts:
        r = m.rng.uniform(0.07, 0.14)
        m.ball(r, (x, y, z + r * 0.3), P.LIMESTONE[m.rng.randrange(3)], subdiv=1, scale=(1.3, 1.1, 0.7),
               rot=(0, 0, m.rng.uniform(0, math.pi)))
    m.build(root)


def waymarks(root, pts):
    """Short posts painted red-white-red, like the waymarks on a real mountain trail."""
    m = Model("waymarks")
    for x, y, z in pts:
        m.box((0.14, 0.14, 0.8), (x, y, z + 0.3), P.WOOD)
        for i, c in enumerate((P.RED, P.WHITE, P.RED)):
            m.box((0.155, 0.155, 0.09), (x, y, z + 0.45 + i * 0.09), c)
    m.build(root)


def fingerpost(root):
    """A yellow signpost where the trail leaves the plaza, one arm up the mountain."""
    m = Model("fingerpost")
    m.cyl(0.07, 2.1, (0, 0, 0), "#9aa0ab", segs=6)
    for z, rot, ln in ((1.85, 0.9, 0.95), (1.55, 2.2, 0.8)):
        c, s = math.cos(rot), math.sin(rot)
        m.box((ln, 0.05, 0.22), (c * (ln / 2 + 0.05), s * (ln / 2 + 0.05), z), "#f0c419", rot=(0, 0, rot))
        m.box((ln * 0.6, 0.06, 0.05), (c * (ln / 2 + 0.05), s * (ln / 2 + 0.05), z), P.INK, rot=(0, 0, rot))
        tip = (c * (ln + 0.1), s * (ln + 0.1), z)
        m.box((0.16, 0.05, 0.16), tip, "#f0c419", rot=(0, math.pi / 4, rot))
    m.box((0.2, 0.2, 0.08), (0, 0, 2.12), P.WHITE)                                        # a cap
    m.box((0.2, 0.2, 0.06), (0, 0, 2.02), P.RED)
    m.build(root)
