"""The library, inside: one cosy room as a dollhouse cutaway, exported on its own as library.glb.

The camera looks in from the south-east, so the north and west walls stand full height and the
south and east walls are sawn off low. x = east, y = north, z = up, the floor at z = 0.

The runtime fills the big bookcase: every `shelf` marker is one row (row 0 at the top) and each
row holds one year of posts. Other parts it drives:
  window_glass   takes the colour of the sky outside     piano_lid   the fallboard, opens to play
  flame*         flicker in the hearth                   globe_ball  turns slowly
Things with an `id` can be pointed at and clicked, like on the island.
"""
from __future__ import annotations

import math

import palette as P
from kit import Model, group, light

W, D, H = 13.0, 9.0, 6.2          # inside of the room
T = 0.4                           # wall thickness
X0, X1 = -W / 2, W / 2
Y0, Y1 = -D / 2, D / 2
CUT = 0.5                         # height of the sawn-off south and east walls

# the bookcase along the north wall: one row per year
CASE_X0, CASE_X1 = -6.2, -0.4
CASE_DEPTH = 0.75
ROWS = 8
PLINTH = 0.35
PITCH = 0.64
BOARD = 0.08

WINDOW_X = 1.55
PIANO_X = 4.75
HEARTH_Y = 0.7


def shell(root):
    m = Model("room", seed=31)
    # the stone slab the room stands on, and floorboards running east-west
    m.box((W + 2 * T + 0.3, D + 2 * T + 0.3, 0.6), (0, 0, -0.4), P.STONE_DARK)
    boards = [P.WOOD, P.PLANK, P.WOOD, P.PLANK, P.WOOD_LIGHT]
    y = Y0 - T
    while y < Y1 - 1e-6:
        depth = min(0.45, Y1 - y)
        m.box((W + T, depth, 0.1), (T / 2, y + depth / 2, -0.05), boards[m.rng.randrange(len(boards))])
        y += depth

    # full-height north and west walls, low cut walls on the open sides
    m.box((W + 2 * T, T, H), (0, Y1 + T / 2, H / 2), P.WALLPAPER)
    m.box((T, D + T, H), (X0 - T / 2, -T / 2, H / 2), P.WALLPAPER)
    m.box((T, D + T, CUT), (X1 + T / 2, -T / 2, CUT / 2), P.WALLPAPER)
    m.box((W, T, CUT), (0, Y0 - T / 2, CUT / 2), P.WALLPAPER)
    # the saw cut shows dark along the top of every wall
    m.box((W + 2 * T, T, 0.04), (0, Y1 + T / 2, H + 0.02), P.WALL_CUT)
    m.box((T, D + T, 0.04), (X0 - T / 2, -T / 2, H + 0.02), P.WALL_CUT)
    m.box((T, D + T, 0.04), (X1 + T / 2, -T / 2, CUT + 0.02), P.WALL_CUT)
    m.box((W, T, 0.04), (0, Y0 - T / 2, CUT + 0.02), P.WALL_CUT)

    # striped wallpaper above walnut panelling, a crown moulding at the top
    x = X0 + 0.35
    while x < X1:
        m.box((0.16, 0.02, H - 1.35), (x, Y1 - 0.01, 1.3 + (H - 1.3) / 2), P.WALLPAPER_STRIPE)
        x += 0.55
    y = Y0 + 0.35
    while y < Y1:
        m.box((0.02, 0.16, H - 1.35), (X0 + 0.01, y, 1.3 + (H - 1.3) / 2), P.WALLPAPER_STRIPE)
        y += 0.55
    m.box((W, 0.08, 1.2), (0, Y1 - 0.04, 0.6), P.WALNUT)
    m.box((0.08, D, 1.2), (X0 + 0.04, 0, 0.6), P.WALNUT)
    m.box((W, 0.14, 0.08), (0, Y1 - 0.07, 1.24), P.WOOD_LIGHT)
    m.box((0.14, D, 0.08), (X0 + 0.07, 0, 1.24), P.WOOD_LIGHT)
    m.box((W, 0.18, 0.2), (0, Y1 - 0.09, H - 0.1), P.WALNUT)
    m.box((0.18, D, 0.2), (X0 + 0.09, 0, H - 0.1), P.WALNUT)
    m.box((0.32, 0.32, H), (X0 + 0.16, Y1 - 0.16, H / 2), P.WALNUT)                 # corner post
    m.build(root)


def bookcase(root):
    m = Model("bookcase", seed=32)
    w = CASE_X1 - CASE_X0
    cx = (CASE_X0 + CASE_X1) / 2
    yf = Y1 - CASE_DEPTH
    yc = Y1 - CASE_DEPTH / 2
    top = PLINTH + ROWS * PITCH
    m.box((w, 0.06, top), (cx, Y1 - 0.03, top / 2), P.WALNUT_BACK)
    for x in (CASE_X0 + 0.09, CASE_X1 - 0.09):
        m.box((0.18, CASE_DEPTH, top), (x, yc, top / 2), P.WALNUT)
        m.box((0.24, 0.06, top), (x, yf - 0.02, top / 2), P.WOOD_DARK)                # pilaster face
    m.box((w, CASE_DEPTH, PLINTH), (cx, yc, PLINTH / 2), P.WALNUT)
    m.box((w, 0.04, 0.06), (cx, yf - 0.02, PLINTH - 0.08), P.WOOD_LIGHT)
    for i in range(1, ROWS):
        z = PLINTH + i * PITCH
        m.box((w - 0.3, CASE_DEPTH - 0.06, BOARD), (cx, yc + 0.03, z - BOARD / 2), P.WOOD)
        m.box((w - 0.3, 0.04, BOARD + 0.02), (cx, yf + 0.02, z - BOARD / 2), P.WOOD_DARK)  # front lip
    m.box((w + 0.3, CASE_DEPTH + 0.2, 0.2), (cx, yc - 0.1, top + 0.1), P.WALNUT)          # cornice
    m.box((w + 0.44, CASE_DEPTH + 0.3, 0.1), (cx, yc - 0.15, top + 0.25), P.WOOD_DARK)
    m.build(root)
    for i in range(ROWS):
        group(f"shelf_{ROWS - 1 - i}", (CASE_X0 + 0.22, yf, PLINTH + i * PITCH), parent=root,
              shelf=ROWS - 1 - i, width=w - 0.44, depth=CASE_DEPTH - 0.1, clear=PITCH - BOARD)

    # a rolling ladder on a brass rail, parked at the quiet end
    lad = Model("ladder")
    rail = top - 0.25
    lad.cyl(0.04, w - 0.2, (CASE_X0 + 0.1, yf - 0.12, rail), P.GOLD, segs=5, rot=(0, math.pi / 2, 0))
    lx, foot = -0.72, yf - 1.2
    for dx in (-0.28, 0.28):
        lad.plank_line((lx + dx, foot, 0), (lx + dx, yf - 0.14, rail), 0.08, 0.08, P.WOOD_LIGHT)
    for k in range(1, 10):
        t = k / 10.5
        lad.box((0.56, 0.06, 0.05), (lx, foot + (yf - 0.14 - foot) * t, rail * t), P.WOOD_LIGHT)
    lad.build(root)

    # picture lights on the cornice, so the spines can be read after dark
    for x in (cx - w / 4, cx + w / 4):
        pl = Model("picture_light")
        pl.box((0.08, 0.3, 0.08), (x, yf - 0.1, top + 0.05), P.GOLD)
        pl.box((1.4, 0.2, 0.12), (x, yf - 0.3, top + 0.02), P.GOLD)
        pl.box((1.3, 0.1, 0.04), (x, yf - 0.3, top - 0.06), P.LANTERN, glow=True)
        pl.build(root)
        light(root, (x, yf - 1.1, top - 1.2), P.WARM_LIGHT, 5.5, 1.0, halo=False)
        light(root, (x, yf - 1.1, PLINTH + 1.4), P.WARM_LIGHT, 4.5, 0.6, halo=False)


def window(root):
    cx, w, z0, z1 = WINDOW_X, 1.8, 1.5, 4.1
    r = w / 2
    glass = Model("window_glass")
    glass.box((w, 0.05, z1 - z0), (cx, Y1 - 0.03, (z0 + z1) / 2), P.SKY_DAY, glow=True)
    glass.cyl(r, 0.05, (cx, Y1 - 0.005, z1), P.SKY_DAY, segs=16, rot=(math.pi / 2, 0, 0), glow=True)
    glass.build(root)

    m = Model("window_frame")
    y = Y1 - 0.12
    for x in (cx - r - 0.1, cx + r + 0.1):
        m.box((0.2, 0.16, z1 - z0), (x, y, (z0 + z1) / 2), P.WALNUT)
    for k in range(10):
        a = (k + 0.5) / 10 * math.pi
        m.box((0.2, 0.16, 0.34), (cx + math.cos(a) * (r + 0.1), y, z1 + math.sin(a) * (r + 0.1)), P.WALNUT, rot=(0, -a, 0))
    m.box((0.07, 0.1, z1 - z0 + r), (cx, y + 0.02, (z0 + z1 + r) / 2), P.WALNUT)          # mullion
    for k in (1, 2):
        m.box((w, 0.1, 0.07), (cx, y + 0.02, z0 + (z1 - z0) * k / 3), P.WALNUT)          # transoms
    m.box((w + 0.5, 0.34, 0.12), (cx, Y1 - 0.17, z0 - 0.06), P.STONE)                    # sill
    # a window seat with cushions
    m.box((w + 0.8, 0.75, 0.55), (cx, Y1 - 0.375, 0.275), P.WALNUT)
    m.box((w + 0.6, 0.65, 0.16), (cx, Y1 - 0.39, 0.63), P.PLUM_ROOF)
    m.box((0.5, 0.2, 0.42), (cx - 0.85, Y1 - 0.2, 0.9), P.GOLD, rot=(0.2, 0, 0.15))
    m.box((0.45, 0.2, 0.38), (cx + 0.9, Y1 - 0.2, 0.88), P.RUG, rot=(0.2, 0, -0.2))
    # curtains tied back, on a brass rod
    top = z1 + r + 0.35
    m.cyl(0.035, w + 1.6, (cx - w / 2 - 0.8, Y1 - 0.25, top), P.GOLD, segs=5, rot=(0, math.pi / 2, 0))
    for side in (-1, 1):
        x = cx + side * (r + 0.45)
        m.box((0.42, 0.14, top - z0 + 0.6), (x, Y1 - 0.24, (top + z0 - 0.6) / 2), P.RED)
        m.box((0.46, 0.18, 0.1), (x, Y1 - 0.24, z0 + 0.8), P.GOLD)                       # tie-back
    m.build(root)
    group("sunbeam", (cx, Y1, (z0 + z1) / 2), parent=root, sunbeam=1)

    # a tall plant between the window and the piano
    plant = Model("plant", seed=35)
    px, py = 3.3, Y1 - 0.45
    plant.cyl(0.3, 0.55, (px, py, 0), P.RUST_ROOF, segs=8, r_top=0.36)
    plant.cyl(0.38, 0.08, (px, py, 0.55), P.RUST_ROOF, segs=8)
    plant.cyl(0.04, 1.6, (px, py, 0.6), P.BARK, segs=4)
    for k, (dx, dy, z, s) in enumerate([(0, 0, 2.3, 0.5), (-0.3, 0.1, 1.8, 0.42), (0.32, -0.05, 1.6, 0.4), (0.1, -0.2, 1.2, 0.34)]):
        plant.ball(s, (px + dx, py + dy, z), P.LEAF[1 + k % 3], subdiv=1, scale=(1, 1, 0.8), jitter=0.06)
    plant.build(root)


def piano(root):
    """An upright piano in the north-east corner, keys facing the room (-y)."""
    g = group("piano", parent=root, id="piano")
    cx, w, yb = PIANO_X, 1.8, Y1 - 0.02
    m = Model("piano_body", seed=33)
    m.box((w, 0.5, 0.67), (cx, yb - 0.25, 0.05 + 0.335), P.PIANO)                        # lower case
    m.box((w + 0.04, 0.54, 0.06), (cx, yb - 0.27, 0.03), P.PIANO_EDGE)                   # toe
    m.box((w, 0.45, 0.7), (cx, yb - 0.225, 0.93 + 0.35), P.PIANO)                        # upper case
    m.box((w + 0.08, 0.52, 0.06), (cx, yb - 0.24, 1.66), P.PIANO_EDGE)                   # top lid
    m.box((w - 0.16, 0.5, 0.08), (cx, yb - 0.72, 0.76), P.PIANO)                         # keybed
    m.box((w - 0.2, 0.04, 0.14), (cx, yb - 0.95, 0.79), P.PIANO_EDGE)                    # key slip
    m.box((w - 0.24, 0.4, 0.05), (cx, yb - 0.72, 0.825), P.KEYS)                         # white keys
    kx = cx - (w - 0.24) / 2
    key = (w - 0.24) / 36
    for i in range(36):
        if i % 7 in (0, 1, 3, 4, 5) and i < 35:
            m.box((key * 0.55, 0.22, 0.04), (kx + (i + 1) * key, yb - 0.63, 0.865), P.INK)
    for side in (-1, 1):
        m.box((0.1, 0.52, 0.26), (cx + side * (w / 2 - 0.05), yb - 0.72, 0.85), P.PIANO)  # cheeks
        m.cyl(0.05, 0.67, (cx + side * (w / 2 - 0.12), yb - 0.9, 0.05), P.PIANO_EDGE, segs=6)  # legs
    for dx in (-0.12, 0.12):
        m.box((0.06, 0.14, 0.03), (cx + dx, yb - 0.55, 0.12), P.GOLD)                      # pedals
    # music desk and a page of sheet music
    m.box((1.1, 0.05, 0.34), (cx, yb - 0.56, 1.38), P.PIANO_EDGE, rot=(-0.2, 0, 0))
    m.box((0.36, 0.02, 0.28), (cx - 0.19, yb - 0.6, 1.4), P.WHITE, rot=(-0.2, 0, 0.04))
    m.box((0.36, 0.02, 0.28), (cx + 0.19, yb - 0.6, 1.4), P.WHITE, rot=(-0.2, 0, -0.04))
    # on top: candlesticks, a metronome and a vase
    for side in (-1, 1):
        x = cx + side * 0.7
        m.cyl(0.08, 0.04, (x, yb - 0.25, 1.69), P.GOLD, segs=6)
        m.cyl(0.025, 0.14, (x, yb - 0.25, 1.73), P.GOLD, segs=4)
        m.cyl(0.04, 0.24, (x, yb - 0.25, 1.87), P.WHITE, segs=5)
        m.ball(0.035, (x, yb - 0.25, 2.14), P.FIRE, subdiv=1, scale=(1, 1, 1.6), glow=True)
    m.prism([(-0.1, 0), (0.1, 0), (0.03, 0.34), (-0.03, 0.34)], 0.14, (cx + 0.3, yb - 0.22, 1.69), P.WALNUT)
    m.cyl(0.08, 0.26, (cx - 0.3, yb - 0.22, 1.69), P.SCREEN, segs=6, r_top=0.05)
    for k, c in enumerate(P.BLOSSOM):
        m.ball(0.06, (cx - 0.3 + (k - 1) * 0.06, yb - 0.22, 2.02 + (k % 2) * 0.05), c, subdiv=1)
    # the bench
    m.box((1.1, 0.42, 0.1), (cx, yb - 1.55, 0.5), P.PIANO)
    m.box((1.02, 0.36, 0.07), (cx, yb - 1.55, 0.585), P.PLUM_ROOF)
    for dx in (-0.48, 0.48):
        for dy in (-0.16, 0.16):
            m.box((0.06, 0.06, 0.45), (cx + dx, yb - 1.55 + dy, 0.225), P.PIANO)
    m.build(g)

    # the fallboard, hinged at the back of the keys; closed it lies over them
    lid = Model("piano_lid")
    lid.box((w - 0.24, 0.46, 0.04), (0, -0.23, 0.02), P.PIANO_EDGE)
    lid.box((0.08, 0.02, 0.02), (0, -0.45, 0.045), P.GOLD)                              # lock plate
    lid.build(g, loc=(cx, yb - 0.49, 0.87))
    light(g, (cx, yb - 0.5, 2.1), P.WARM_LIGHT, 4.5, 0.9, flicker=0.5, day=True)


def fireplace(root):
    """A stone fireplace in the west wall, the winged sheep's portrait above the mantel."""
    g = group("fireplace", parent=root, id="fireplace")
    x, yc = X0, HEARTH_Y
    m = Model("fireplace_body", seed=34)
    m.box((0.5, 2.9, H - 0.2), (x + 0.25, yc, (H - 0.2) / 2), P.STONE_DARK)              # chimney breast
    for _ in range(46):
        sy, sz = m.rng.uniform(-1.35, 1.35), m.rng.uniform(2.1, H - 0.4)
        m.box((0.03, m.rng.uniform(0.25, 0.5), m.rng.uniform(0.16, 0.26)), (x + 0.51, yc + sy, sz), P.ROCK[1])
    m.box((0.03, 1.5, 1.35), (x + 0.52, yc, 0.72), P.FIREBOX)                            # soot-black back
    for side in (-1, 1):
        m.box((0.36, 0.4, 1.5), (x + 0.68, yc + side * 0.95, 0.75), P.STONE)              # piers
    m.box((0.36, 2.3, 0.36), (x + 0.68, yc, 1.62), P.STONE)                              # lintel
    m.box((0.62, 2.7, 0.12), (x + 0.8, yc, 1.86), P.WALNUT)                               # mantel
    m.box((1.3, 2.7, 0.08), (x + 1.0, yc, 0.04), P.STONE_DARK)                            # hearth
    m.cyl(0.11, 1.0, (x + 0.72, yc - 0.5, 0.2), P.WOOD_DARK, segs=6, rot=(-math.pi / 2, 0, 0))
    m.cyl(0.1, 0.9, (x + 0.8, yc - 0.45, 0.33), P.WOOD, segs=6, rot=(-math.pi / 2, 0, 0.3))
    m.box((0.5, 1.0, 0.04), (x + 0.75, yc, 0.1), P.IRON)                                  # grate
    # on the mantel: a clock, candlesticks and a small stack of books
    m.box((0.2, 0.36, 0.42), (x + 0.75, yc, 2.13), P.WALNUT)
    m.cyl(0.13, 0.02, (x + 0.86, yc, 2.2), P.WHITE, segs=10, rot=(0, math.pi / 2, 0))
    for side in (-1, 1):
        m.cyl(0.05, 0.1, (x + 0.8, yc + side * 1.05, 1.92), P.GOLD, segs=5)
        m.cyl(0.035, 0.3, (x + 0.8, yc + side * 1.05, 2.02), P.WHITE, segs=5)
    for k, c in enumerate(P.BOOKS[:3]):
        m.box((0.3, 0.42, 0.08), (x + 0.78, yc - 0.6, 1.96 + k * 0.08), c, rot=(0, 0, 0.1 * k))
    m.build(g)
    for i, (dy, h, r) in enumerate([(0, 0.85, 0.26), (0.2, 0.6, 0.18), (-0.18, 0.55, 0.16)]):
        f = Model(f"flame{i}")
        f.cyl(r, h, (0, 0, 0), P.FIRE if i else "#ffd070", segs=5, r_top=0.0, glow=True)
        f.build(g, loc=(x + 0.75, yc + dy, 0.3))
    light(g, (x + 1.3, yc, 0.7), P.FIRE, 9, 1.4, flicker=1.0, day=True)

    # the portrait: a winged sheep on a hill, in a gold frame
    pg = group("painting", (x + 0.5, yc, 3.35), parent=root, id="painting")
    p = Model("painting")
    p.box((0.08, 1.6, 1.2), (0.04, 0, 0), P.GOLD)
    p.box((0.04, 1.36, 0.96), (0.09, 0, 0), "#8fc3e0")
    p.box((0.04, 1.36, 0.34), (0.1, 0, -0.31), P.GRASS[2])
    p.ball(0.12, (0.12, -0.45, 0.3), P.GOLD, subdiv=1, scale=(0.3, 1, 1))                 # the sun
    p.ball(0.22, (0.14, 0.05, 0.02), P.WOOL, subdiv=1, scale=(0.35, 1.3, 0.85))
    p.box((0.05, 0.14, 0.14), (0.16, 0.34, 0.08), P.SHEEP_FACE)
    for dy in (-0.04, 0.14):
        p.box((0.03, 0.26, 0.12), (0.17, dy, 0.24), P.FEATHER, rot=(0.6 if dy > 0 else -0.6, 0, 0))
    for dy in (-0.15, 0.15):
        p.box((0.03, 0.04, 0.12), (0.15, dy, -0.2), P.SHEEP_FACE)
    p.build(pg)


def reading_corner(root):
    """An armchair turned to the fire, a side table with a green-shaded lamp."""
    g = group("armchair", (-4.2, -1.5, 0), rot_z=-2.35, parent=root, id="armchair")
    a = Model("armchair")
    a.box((1.0, 0.9, 0.4), (0, 0, 0.3), P.LEATHER)
    a.box((0.84, 0.76, 0.14), (0, -0.04, 0.55), P.LEATHER_DARK)                           # cushion
    a.box((1.0, 0.26, 1.0), (0, 0.36, 0.95), P.LEATHER)                                   # back
    a.box((1.0, 0.3, 0.12), (0, 0.34, 1.48), P.LEATHER_DARK)
    for side in (-1, 1):
        a.box((0.2, 0.9, 0.42), (side * 0.5, 0, 0.62), P.LEATHER)                          # arms
        a.cyl(0.13, 0.9, (side * 0.5, -0.45, 0.83), P.LEATHER_DARK, segs=6, rot=(-math.pi / 2, 0, 0))
        for dy in (-0.36, 0.36):
            a.box((0.08, 0.08, 0.12), (side * 0.42, dy, 0.06), P.WOOD_DARK)
    a.box((0.34, 0.26, 0.06), (0.52, -0.1, 1.08), P.BOOKS[1], rot=(0, 0, 0.3))             # a book, face down
    a.build(g)

    t = Model("side_table")
    tx, ty = -5.1, -2.6
    t.cyl(0.42, 0.06, (tx, ty, 0.7), P.WALNUT, segs=10)
    t.cyl(0.06, 0.7, (tx, ty, 0), P.WALNUT, segs=5)
    t.cyl(0.26, 0.05, (tx, ty, 0), P.WALNUT, segs=8)
    t.cyl(0.07, 0.1, (tx + 0.2, ty - 0.1, 0.76), P.WHITE, segs=6)                         # teacup
    t.cyl(0.12, 0.02, (tx + 0.2, ty - 0.1, 0.76), P.WHITE, segs=8)
    t.cyl(0.1, 0.04, (tx - 0.1, ty + 0.1, 0.76), P.GOLD, segs=6)                          # lamp base
    t.cyl(0.02, 0.36, (tx - 0.1, ty + 0.1, 0.8), P.GOLD, segs=4)
    t.cyl(0.24, 0.16, (tx - 0.1, ty + 0.1, 1.12), P.LAMP_GREEN, segs=8, r_top=0.08)
    t.build(root)
    light(root, (tx - 0.1, ty + 0.1, 1.05), P.WARM_LIGHT, 4.5, 0.9)

    # books that didn't make it back to the shelves
    s = Model("book_pile", seed=36)
    for k, c in enumerate([P.BOOKS[3], P.BOOKS[0], P.BOOKS[5], P.BOOKS[2]]):
        s.box((0.46 - k * 0.04, 0.34, 0.1), (-5.6, -3.7, 0.05 + k * 0.1), c, rot=(0, 0, s.rng.uniform(-0.3, 0.3)))
    s.build(root)


def door(root):
    g = group("door", parent=root, id="door")
    x, yc, w, h = X0, -3.2, 1.3, 2.7
    m = Model("door")
    m.box((0.14, w + 0.36, h + 0.18), (x + 0.07, yc, (h + 0.18) / 2), P.WALNUT)
    m.box((0.1, w, h), (x + 0.17, yc, h / 2), P.WOOD)
    for k in range(1, 4):
        m.box((0.02, 0.03, h - 0.1), (x + 0.23, yc - w / 2 + k * w / 4, h / 2), P.WOOD_DARK)
    for z in (0.5, h - 0.5):
        m.box((0.03, 0.8, 0.08), (x + 0.24, yc + 0.2, z), P.IRON)                          # strap hinges
    m.cyl(0.07, 0.04, (x + 0.24, yc - 0.45, 1.2), P.GOLD, segs=6, rot=(0, math.pi / 2, 0))
    m.box((0.9, 1.3, 0.03), (x + 0.6, yc, 0.015), "#8a6a3a")                              # doormat
    m.build(g)


def rug_and_table(root):
    m = Model("rug")
    cx, cy, rw, rd = -1.9, -0.6, 5.4, 3.9
    m.box((rw, rd, 0.03), (cx, cy, 0.015), P.GOLD)
    m.box((rw - 0.24, rd - 0.24, 0.036), (cx, cy, 0.018), P.RUG)
    m.box((rw - 0.9, rd - 0.9, 0.04), (cx, cy, 0.02), P.RUG_DARK)
    m.box((0.9, 0.9, 0.045), (cx, cy, 0.022), P.GOLD, rot=(0, 0, math.pi / 4))
    m.box((0.6, 0.6, 0.05), (cx, cy, 0.024), P.RUG, rot=(0, 0, math.pi / 4))
    for k in range(14):
        for side in (-1, 1):
            m.box((0.05, 0.14, 0.02), (cx + side * (rw / 2 + 0.07), cy - rd / 2 + 0.2 + k * (rd - 0.4) / 13, 0.01), P.WHITE)
    m.build(root)

    t = Model("reading_table")
    tx, ty = -1.6, 0.1
    t.cyl(0.85, 0.08, (tx, ty, 0.78), P.WALNUT, segs=12)
    t.cyl(0.1, 0.78, (tx, ty, 0), P.WALNUT, segs=6)
    for k in range(3):
        a = k / 3 * math.tau + 0.4
        t.plank_line((tx, ty, 0.3), (tx + math.cos(a) * 0.55, ty + math.sin(a) * 0.55, 0.02), 0.08, 0.08, P.WALNUT)
    for side in (-1, 1):                                                                  # an open book
        t.box((0.34, 0.46, 0.04), (tx - 0.1 + side * 0.17, ty - 0.2, 0.86), P.WHITE, rot=(0, side * 0.12, 0.2))
    t.box((0.7, 0.5, 0.03), (tx - 0.1, ty - 0.2, 0.835), P.BOOKS[0], rot=(0, 0, 0.2))
    t.cyl(0.08, 0.14, (tx + 0.45, ty + 0.25, 0.82), "#e8d7a8", segs=6)                    # a mug
    t.cyl(0.07, 0.03, (tx + 0.1, ty + 0.4, 0.82), P.GOLD, segs=6)                         # candle
    t.cyl(0.035, 0.2, (tx + 0.1, ty + 0.4, 0.85), P.WHITE, segs=5)
    t.ball(0.03, (tx + 0.1, ty + 0.4, 1.08), P.FIRE, subdiv=1, scale=(1, 1, 1.6), glow=True)
    # a chair pulled up to it
    c = (tx + 0.9, ty - 0.9)
    t.box((0.5, 0.5, 0.06), (c[0], c[1], 0.5), P.WOOD)
    t.box((0.5, 0.06, 0.6), (c[0] + 0.06, c[1] + 0.25, 0.83), P.WOOD, rot=(0, 0, 0.5))
    for dx in (-0.2, 0.2):
        for dy in (-0.2, 0.2):
            t.box((0.05, 0.05, 0.5), (c[0] + dx, c[1] + dy, 0.25), P.WOOD_DARK)
    t.build(root)
    light(root, (tx + 0.1, ty + 0.4, 1.3), P.WARM_LIGHT, 4, 0.7, flicker=0.4)


def catalogue(root):
    """The card catalogue: little drawers with brass pulls, facing the room."""
    g = group("catalogue", (4.4, -0.2, 0), rot_z=0.35, parent=root, id="catalogue")
    m = Model("catalogue")
    w, d, h = 1.4, 0.7, 1.1
    m.box((w, d, h), (0, 0, 0.15 + h / 2), P.WALNUT)
    m.box((w + 0.1, d + 0.1, 0.06), (0, 0, 0.15 + h + 0.03), P.WOOD_DARK)
    for dx in (-w / 2 + 0.08, w / 2 - 0.08):
        for dy in (-d / 2 + 0.08, d / 2 - 0.08):
            m.box((0.08, 0.08, 0.15), (dx, dy, 0.075), P.WOOD_DARK)
    cols, rows = 4, 5
    for i in range(cols):
        for j in range(rows):
            x = -w / 2 + (i + 0.5) * w / cols
            z = 0.15 + (j + 0.5) * h / rows
            m.box((w / cols - 0.06, 0.03, h / rows - 0.05), (x, -d / 2 - 0.015, z), P.WOOD)
            m.box((0.12, 0.02, 0.05), (x, -d / 2 - 0.035, z + 0.04), P.WHITE)
            m.box((0.08, 0.04, 0.03), (x, -d / 2 - 0.04, z - 0.04), P.GOLD)
    m.box((0.36, 0.26, 0.2), (-0.3, 0.05, 1.41), P.WHITE, rot=(0, 0, 0.2))                 # cards, pulled
    m.cyl(0.1, 0.08, (0.35, 0.0, 1.31), P.GOLD, segs=8, r_top=0.03)                       # a desk bell
    m.build(g)


def globe(root):
    g = group("globe", (0.2, 2.2, 0), parent=root, id="globe")
    m = Model("globe_stand")
    m.cyl(0.3, 0.06, (0, 0, 0), P.WALNUT, segs=8)
    m.cyl(0.04, 0.75, (0, 0, 0.06), P.WALNUT, segs=5)
    for k in range(12):
        a = k / 12 * math.tau
        m.box((0.05, 0.05, 0.14), (0, math.cos(a) * 0.42, 1.2 + math.sin(a) * 0.42), P.GOLD, rot=(-a, 0, 0))
    m.build(g)
    b = Model("globe_ball", seed=37)
    b.ball(0.38, (0, 0, 0), "#3a6ea5", subdiv=2)
    for _ in range(9):
        a, e = b.rng.uniform(0, math.tau), b.rng.uniform(-1.0, 1.0)
        b.ball(b.rng.uniform(0.08, 0.14), (math.cos(a) * math.cos(e) * 0.34, math.sin(a) * math.cos(e) * 0.34, math.sin(e) * 0.34),
               P.GRASS[1 + b.rng.randrange(3)], subdiv=1)
    obj = b.build(g, loc=(0, 0, 1.2))
    obj.rotation_euler = (0.4, 0, 0)


def sconces(root):
    for x, y, z, face in [(X0 + 0.02, -1.5, 2.9, "x"), (X0 + 0.02, 2.75, 2.9, "x"), (3.3, Y1 - 0.02, 3.4, "y")]:
        m = Model("sconce")
        dx, dy = (0.2, 0) if face == "x" else (0, -0.2)
        m.box((0.06 if face == "x" else 0.16, 0.16 if face == "x" else 0.06, 0.24), (x, y, z), P.GOLD)
        m.plank_line((x, y, z), (x + dx, y + dy, z + 0.1), 0.04, 0.04, P.GOLD)
        m.box((0.18, 0.18, 0.24), (x + dx, y + dy, z + 0.26), P.LANTERN, glow=True)
        m.cyl(0.14, 0.08, (x + dx, y + dy, z + 0.38), P.GOLD, segs=4, r_top=0.02)
        m.build(root)
        light(root, (x + dx * 2, y + dy * 2, z + 0.2), P.WARM_LIGHT, 5, 0.8)


def build():
    root = group("library_interior")
    shell(root)
    bookcase(root)
    window(root)
    piano(root)
    fireplace(root)
    reading_corner(root)
    door(root)
    rug_and_table(root)
    catalogue(root)
    globe(root)
    sconces(root)
    return root
