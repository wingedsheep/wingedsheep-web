"""The lighthouse, inside: the keeper's quarters, as a dollhouse cutaway, exported on its own as
lighthouse.glb.

Like the library the camera looks in from the south-east, so the north and west walls stand
full height and the south and east walls are sawn off low. x = east, y = north, z = up, the
floor at z = 0. In the north-west corner the tower's spiral stair winds up towards the lamp.

The runtime (src/island/scene/quarters.ts) fills the bookcase with what Vincent has read: every
`shelf` marker is one row (row 0 at the top). Other parts it drives:
  tv_screen     shows the game on the console          window_glass  the sky outside
  steam         rises from the coffee                  painting_canvas  Vincent's painting, as a texture
  the rest      things you can click (ids)
"""
from __future__ import annotations

import math

import beike
import cats
import characters
import companion
import palette as P
from kit import Model, emitter, group, light

W, D, H = 11.0, 8.0, 5.2           # inside of the room
T = 0.4
X0, X1 = -W / 2, W / 2
Y0, Y1 = -D / 2, D / 2
CUT = 0.5

# the reading bookcase on the north wall
CASE_X0, CASE_X1 = -2.7, 0.9
CASE_DEPTH = 0.5
ROWS = 6
PLINTH = 0.3
PITCH = 0.5
BOARD = 0.06

STAIR = (-4.1, 2.6)                # the spiral stair's newel post
TV_Y = 0.2                         # the telly against the west wall
TABLE = (2.0, -0.5)
DESK = (0.0, -2.35)                # Vincent's desk, out in the room, his chair on its south side
MONITOR = (0.25, 0.12, 1.2)        # the screen's middle, from the desk's (it faces south, -y)
SCREEN = (0.86, 0.46)


def shell(root):
    m = Model("room", seed=61)
    m.box((W + 2 * T + 0.3, D + 2 * T + 0.3, 0.6), (0, 0, -0.4), P.STONE_DARK)
    boards = [P.WOOD_LIGHT, P.PLANK, P.WOOD_LIGHT, P.WOOD, P.PLANK]
    x = X0 - T
    while x < X1 - 1e-6:                                    # wide boards running north-south
        w = min(0.5, X1 - x)
        m.box((w, D + T, 0.1), (x + w / 2, T / 2 - 0.0, -0.05), boards[m.rng.randrange(len(boards))])
        x += w

    # whitewashed walls over a sea-blue wainscot, with a red rail between
    m.box((W + 2 * T, T, H), (0, Y1 + T / 2, H / 2), P.WHITEWASH)
    m.box((T, D + T, H), (X0 - T / 2, -T / 2, H / 2), P.WHITEWASH)
    m.box((T, D + T, CUT), (X1 + T / 2, -T / 2, CUT / 2), P.WAINSCOT)
    m.box((W, T, CUT), (0, Y0 - T / 2, CUT / 2), P.WAINSCOT)
    m.box((W + 2 * T, T, 0.04), (0, Y1 + T / 2, H + 0.02), P.WALL_CUT)
    m.box((T, D + T, 0.04), (X0 - T / 2, -T / 2, H + 0.02), P.WALL_CUT)
    m.box((T, D + T, 0.04), (X1 + T / 2, -T / 2, CUT + 0.02), P.WALL_CUT)
    m.box((W, T, 0.04), (0, Y0 - T / 2, CUT + 0.02), P.WALL_CUT)
    m.box((W, 0.06, 1.1), (0, Y1 - 0.03, 0.55), P.WAINSCOT)
    m.box((0.06, D, 1.1), (X0 + 0.03, 0, 0.55), P.WAINSCOT)
    for k in range(int(W / 0.3)):                          # tongue-and-groove lines
        m.box((0.02, 0.02, 1.0), (X0 + 0.15 + k * 0.3, Y1 - 0.065, 0.55), P.WAINSCOT_DARK)
    for k in range(int(D / 0.3)):
        m.box((0.02, 0.02, 1.0), (X0 + 0.065, Y0 + 0.15 + k * 0.3, 0.55), P.WAINSCOT_DARK)
    m.box((W, 0.12, 0.08), (0, Y1 - 0.06, 1.14), P.RED)
    m.box((0.12, D, 0.08), (X0 + 0.06, 0, 1.14), P.RED)
    # exposed beams at the top of the walls
    m.box((W, 0.2, 0.22), (0, Y1 - 0.1, H - 0.11), P.WOOD_DARK)
    m.box((0.2, D, 0.22), (X0 + 0.1, 0, H - 0.11), P.WOOD_DARK)
    m.build(root)


def stair(root):
    """The foot of the tower: a spiral stair round an iron post, climbing out of the room."""
    g = group("stairs", parent=root, id="stairs")
    cx, cy = STAIR
    m = Model("stair", seed=62)
    m.cyl(1.55, 0.08, (cx, cy, 0), P.STONE, segs=16)                                     # landing stone
    m.cyl(0.1, H + 0.6, (cx, cy, 0), P.IRON, segs=6)                                     # newel post
    steps = 17
    for i in range(steps):
        a = -math.pi / 2 + i * (math.tau * 1.1 / steps)                                  # starts facing south
        z = 0.1 + i * 0.3
        x, y = cx + math.cos(a) * 0.72, cy + math.sin(a) * 0.72
        m.box((1.3, 0.42, 0.08), (x, y, z), P.WOOD if i % 2 else P.WOOD_LIGHT, rot=(0, 0, a))
        m.box((0.05, 0.05, 0.9), (cx + math.cos(a) * 1.32, cy + math.sin(a) * 1.32, z + 0.45), P.IRON)  # balusters
    for i in range(steps - 1):                                                           # the handrail
        a0 = -math.pi / 2 + i * (math.tau * 1.1 / steps)
        a1 = a0 + math.tau * 1.1 / steps
        m.plank_line((cx + math.cos(a0) * 1.32, cy + math.sin(a0) * 1.32, 1.0 + i * 0.3),
                     (cx + math.cos(a1) * 1.32, cy + math.sin(a1) * 1.32, 1.0 + (i + 1) * 0.3), 0.06, 0.06, P.GOLD)
    m.build(g)
    # warm light spilling down from the lamp room far above
    light(root, (cx, cy, H - 0.2), P.LANTERN, 4, 0.5)


def bookcase(root):
    m = Model("bookcase", seed=63)
    w = CASE_X1 - CASE_X0
    cx = (CASE_X0 + CASE_X1) / 2
    yf = Y1 - CASE_DEPTH
    yc = Y1 - CASE_DEPTH / 2
    top = PLINTH + ROWS * PITCH
    m.box((w, 0.05, top), (cx, Y1 - 0.03, top / 2), P.WALNUT_BACK)
    for x in (CASE_X0 + 0.07, CASE_X1 - 0.07):
        m.box((0.14, CASE_DEPTH, top), (x, yc, top / 2), P.DRIFTWOOD)
    m.box((w, CASE_DEPTH, PLINTH), (cx, yc, PLINTH / 2), P.DRIFTWOOD)
    for i in range(1, ROWS):
        z = PLINTH + i * PITCH
        m.box((w - 0.2, CASE_DEPTH - 0.05, BOARD), (cx, yc + 0.02, z - BOARD / 2), P.DRIFTWOOD)
    m.box((w + 0.2, CASE_DEPTH + 0.1, 0.12), (cx, yc - 0.05, top + 0.06), P.DRIFTWOOD)
    m.build(root)
    for i in range(ROWS):
        group(f"shelf_{ROWS - 1 - i}", (CASE_X0 + 0.16, yf, PLINTH + i * PITCH), parent=root,
              shelf=ROWS - 1 - i, width=w - 0.32, depth=CASE_DEPTH - 0.08, clear=PITCH - BOARD)
    light(root, (cx, yf - 1.2, top - 0.6), P.WARM_LIGHT, 4.5, 0.7, halo=False)


def portholes(root):
    """Two round windows onto the sea, over the kitchen."""
    glass = Model("window_glass")
    frame = Model("porthole")
    for x in (2.5, 4.3):
        z = 2.55
        glass.cyl(0.46, 0.05, (x, Y1 - 0.01, z), P.SKY_DAY, segs=14, rot=(math.pi / 2, 0, 0), glow=True)
        for k in range(14):
            a = k / 14 * math.tau
            frame.box((0.2, 0.14, 0.12), (x + math.cos(a) * 0.52, Y1 - 0.08, z + math.sin(a) * 0.52), P.GOLD, rot=(0, -a, 0))
        for a in (0, math.pi / 2):
            frame.box((0.9 if a == 0 else 0.05, 0.06, 0.05 if a == 0 else 0.9), (x, Y1 - 0.06, z), P.GOLD)
    glass.build(root)
    frame.build(root)


def kitchen(root):
    """Along the north wall: a counter, the stove with the kettle, the sink, the coffee machine."""
    x0, x1 = 1.6, X1
    depth, top = 0.65, 0.92
    yc = Y1 - depth / 2
    m = Model("kitchen", seed=64)
    m.box((x1 - x0, depth - 0.05, top - 0.1), (0.5 * (x0 + x1), yc + 0.02, (top - 0.1) / 2), P.WAINSCOT)
    for k in range(4):                                                                   # cupboard doors
        dx = x0 + (k + 0.5) * (x1 - x0) / 4
        m.box((((x1 - x0) / 4) - 0.1, 0.03, top - 0.3), (dx, Y1 - depth - 0.005, top / 2 - 0.02), P.WAINSCOT_DARK)
        m.box((0.12, 0.04, 0.03), (dx, Y1 - depth - 0.03, top - 0.25), P.GOLD)
    m.box((x1 - x0 + 0.06, depth + 0.04, 0.08), (0.5 * (x0 + x1), yc, top - 0.04), P.BUTCHER_BLOCK)
    m.box((x1 - x0, 0.03, 0.9), (0.5 * (x0 + x1), Y1 - 0.02, top + 0.45), P.TILE)        # splashback
    for k in range(int((x1 - x0) / 0.22)):
        for j in range(4):
            m.box((0.2, 0.02, 0.2), (x0 + 0.11 + k * 0.22, Y1 - 0.04, top + 0.12 + j * 0.22), P.TILE if (k + j) % 2 else P.TILE_BLUE)
    # the stove, and a shelf of jars and mugs above the counter
    m.box((0.9, 0.55, 0.05), (4.9, yc, top + 0.02), P.IRON)
    for dx in (-0.2, 0.2):
        m.cyl(0.14, 0.02, (4.9 + dx, yc, top + 0.045), "#3a3440", segs=8)
    m.box((x1 - x0 - 0.4, 0.3, 0.05), (0.5 * (x0 + x1) + 0.2, Y1 - 0.15, 3.35), P.DRIFTWOOD)
    for k, c in enumerate([P.WHITE, P.TILE_BLUE, P.RED, P.WHITE, P.GOLD, P.TILE_BLUE]):
        x = 1.9 + k * 0.55
        if k % 2:
            m.cyl(0.1, 0.24, (x, Y1 - 0.15, 3.375), "#dfe8e0", segs=6)                   # jars
            m.cyl(0.11, 0.05, (x, Y1 - 0.15, 3.615), P.WOOD, segs=6)
        else:
            m.cyl(0.08, 0.14, (x, Y1 - 0.15, 3.375), c, segs=6)                          # mugs
    m.build(root)

    # the sink under the first porthole, with its own id so the tap can be turned on (and every
    # cat in the lighthouse hears it)
    g = group("sink", parent=root, id="tap")
    t = Model("sink")
    t.box((0.7, 0.45, 0.06), (2.5, yc, top + 0.005), P.IRON)
    t.box((0.6, 0.35, 0.04), (2.5, yc, top + 0.02), "#5d6a74")
    t.plank_line((2.5, Y1 - 0.1, top), (2.5, Y1 - 0.1, top + 0.4), 0.05, 0.05, P.TUNER)
    t.plank_line((2.5, Y1 - 0.1, top + 0.4), (2.5, yc - 0.02, top + 0.34), 0.05, 0.05, P.TUNER)
    t.build(g)

    k = Model("kettle")                                                                 # red enamel, on the back ring
    k.cyl(0.17, 0.24, (4.7, yc, top + 0.05), P.RED, segs=8, r_top=0.12)
    k.cyl(0.05, 0.06, (4.7, yc, top + 0.29), P.INK, segs=5)
    k.plank_line((4.85, yc, top + 0.12), (5.0, yc - 0.02, top + 0.26), 0.04, 0.04, P.RED)
    k.build(root)

    # the coffee machine gets its own id: it is the most important thing in the house
    g = group("coffee_machine", parent=root, id="coffee_machine")
    c = Model("coffee_machine_body")
    cx = 3.6
    c.box((0.55, 0.45, 0.6), (cx, yc + 0.05, top + 0.3), P.TUNER)
    c.box((0.57, 0.47, 0.08), (cx, yc + 0.05, top + 0.62), P.IRON)
    c.box((0.45, 0.02, 0.18), (cx, yc - 0.18, top + 0.42), P.IRON)                      # group head
    c.plank_line((cx, yc - 0.22, top + 0.33), (cx - 0.05, yc - 0.45, top + 0.33), 0.05, 0.05, P.INK)  # portafilter
    c.box((0.35, 0.2, 0.03), (cx, yc - 0.2, top + 0.06), P.IRON)                         # drip tray
    c.cyl(0.05, 0.08, (cx, yc - 0.2, top + 0.075), P.WHITE, segs=6)                     # espresso cup
    c.box((0.08, 0.02, 0.08), (cx + 0.17, yc - 0.18, top + 0.52), P.LANTERN, glow=True)  # it's on
    c.build(g)

    # tonight's dinner: a wrap, on a plate by the sink
    g = group("wrap", parent=root, id="wrap")
    w = Model("wrap_plate")
    w.cyl(0.24, 0.03, (1.95, yc - 0.05, top), P.WHITE, segs=10)
    w.cyl(0.075, 0.34, (1.95, yc - 0.05, top + 0.1), "#e8cf9c", segs=6, rot=(0, math.pi / 2, 0.4))  # the wrap
    w.ball(0.06, (1.8, yc - 0.1, top + 0.1), "#d8c49a", subdiv=1, scale=(0.5, 1.1, 1.1))  # hummus showing at the end
    w.ball(0.03, (1.78, yc - 0.12, top + 0.12), P.LEAF[2], subdiv=1)                    # a bit of lettuce
    w.build(g)


def telly(root):
    """Against the west wall: a low cabinet, a chunky old telly, the console, and the games."""
    g = group("console", parent=root, id="console")
    x, yc = X0 + 0.3, TV_Y
    m = Model("tv_cabinet", seed=65)
    m.box((0.6, 1.8, 0.55), (x, yc, 0.275), P.WOOD_DARK)
    m.box((0.03, 0.8, 0.4), (x + 0.3, yc + 0.42, 0.3), P.WOOD)                          # cabinet door
    m.box((0.03, 0.8, 0.4), (x + 0.3, yc - 0.42, 0.3), "#1d1a22")                       # open shelf
    # the console on the open shelf, one controller out on the rug with its cable
    m.box((0.36, 0.5, 0.1), (x + 0.02, yc - 0.42, 0.18), "#d9d5cf")
    m.box((0.02, 0.1, 0.04), (x + 0.2, yc - 0.52, 0.19), P.RED)
    m.box((0.02, 0.06, 0.03), (x + 0.2, yc - 0.3, 0.2), "#5f5a66")
    m.box((0.22, 0.34, 0.07), (x + 1.3, yc - 0.6, 0.035), "#d9d5cf", rot=(0, 0, 0.4))  # controller
    for dy in (-0.09, 0.09):
        m.cyl(0.035, 0.03, (x + 1.33, yc - 0.6 + dy, 0.07), P.RED if dy > 0 else P.TILE_BLUE, segs=5)
    m.plank_line((x + 0.2, yc - 0.52, 0.12), (x + 1.2, yc - 0.55, 0.02), 0.02, 0.02, P.INK)
    # the telly: a deep plastic box with a curved-looking screen facing the room (+x)
    m.box((0.8, 1.2, 0.95), (x - 0.02, yc, 0.55 + 0.475), "#34303b")
    m.box((0.1, 1.05, 0.8), (x + 0.4, yc, 1.02), "#24212a")                             # bezel
    m.box((0.06, 0.12, 0.05), (x + 0.44, yc - 0.45, 0.66), P.GOLD)                      # knobs
    m.box((0.06, 0.12, 0.05), (x + 0.44, yc - 0.3, 0.66), P.GOLD)
    m.build(g)
    # beside the controller, a second cartridge: masking tape on the front, names in marker,
    # each one crossed out, and a fresh one at the bottom
    cg = group("cartridge", parent=root, id="cartridge")
    c = Model("cartridge")
    ccx, ccy, rz = x + 1.05, yc - 1.0, -0.5
    c.box((0.25, 0.3, 0.05), (ccx, ccy, 0.025), "#5f5a66", rot=(0, 0, rz))
    c.box((0.17, 0.22, 0.012), (ccx + 0.01, ccy, 0.055), "#e6d7a8", rot=(0, 0, rz))       # the tape
    for k in range(4):
        # the written lines, all but the last struck through in red
        d = 0.065 - k * 0.038
        c.box((0.016, 0.15, 0.006), (ccx + 0.01 + d * math.cos(rz), ccy + d * math.sin(rz), 0.063), P.INK if k == 3 else P.RED, rot=(0, 0, rz))
    c.build(cg)

    s = Model("tv_screen")
    s.box((0.02, 0.92, 0.7), (x + 0.455, yc, 1.05), P.SCREEN, glow=True)
    s.build(g)
    light(root, (x + 1.2, yc, 1.1), P.SCREEN, 3.5, 0.6, flicker=0.3)

    # a shelf above it: his favourite games, face out
    sh = Model("game_shelf")
    sh.box((0.3, 2.2, 0.06), (X0 + 0.15, yc, 2.2), P.DRIFTWOOD)
    for dy in (-0.9, 0.9):
        sh.box((0.2, 0.05, 0.25), (X0 + 0.12, yc + dy, 2.08), P.IRON, rot=(0.6, 0, 0))    # brackets
    sh.build(root)
    boxes = [
        ("silksong", yc - 0.75, P.SILKSONG, P.WHITE),
        ("civilization", yc - 0.25, P.CIV, P.GOLD),
        ("overwatch", yc + 0.25, P.OVERWATCH, P.WHITE),
        ("warcraft", yc + 0.75, P.WARCRAFT, P.GOLD),
    ]
    for gid, y, cover, mark in boxes:
        gg = group(f"game_{gid}", parent=root, id=f"game:{gid}")
        b = Model(f"box_{gid}")
        b.box((0.05, 0.4, 0.56), (X0 + 0.2, y, 2.51), cover, rot=(0, -0.12, 0))
        f = X0 + 0.25                                                                    # just proud of the cover
        if gid == "silksong":
            # a white mask with two horns, and the red cloak's pin below it
            b.ball(0.07, (f - 0.005, y, 2.5), mark, subdiv=1, scale=(0.5, 1.0, 1.1))
            for side in (-1, 1):
                b.box((0.02, 0.03, 0.14), (f, y + side * 0.06, 2.62), mark, rot=(side * 0.3, 0, 0))
            b.ball(0.035, (f, y, 2.36), P.WHITE, subdiv=1)
        elif gid == "civilization":
            b.cyl(0.11, 0.02, (f - 0.01, y, 2.52), mark, segs=10, rot=(0, math.pi / 2, 0))  # a gold globe
            b.cyl(0.08, 0.025, (f - 0.01, y, 2.52), P.CIV, segs=10, rot=(0, math.pi / 2, 0))
            b.box((0.02, 0.2, 0.02), (f + 0.005, y, 2.52), mark)                         # its equator
        elif gid == "overwatch":
            b.cyl(0.12, 0.02, (f - 0.01, y, 2.52), mark, segs=10, rot=(0, math.pi / 2, 0))  # the white ring
            b.cyl(0.08, 0.025, (f - 0.01, y, 2.52), P.OVERWATCH, segs=10, rot=(0, math.pi / 2, 0))
            for side in (-1, 1):
                b.box((0.02, 0.05, 0.12), (f + 0.005, y + side * 0.035, 2.5), mark, rot=(-side * 0.35, 0, 0))
        else:
            # a gold shield with a W on it
            b.box((0.02, 0.2, 0.22), (f - 0.005, y, 2.53), mark, taper=1.0)
            b.box((0.02, 0.1, 0.1), (f - 0.005, y, 2.4), mark, rot=(math.pi / 4, 0, 0))
            for dy in (-0.06, 0.0, 0.06):
                b.box((0.02, 0.025, 0.12), (f + 0.005, y + dy, 2.54), P.WARCRAFT, rot=(0.25 if dy <= 0 else -0.25, 0, 0))
        b.build(gg)

    # the board games, stacked on a stool beside the cabinet
    st = Model("stool")
    sx, sy = X0 + 0.45, yc - 1.55
    st.cyl(0.35, 0.05, (sx, sy, 0.45), P.WOOD, segs=8)
    for k in range(3):
        a = k / 3 * math.tau
        st.plank_line((sx + math.cos(a) * 0.25, sy + math.sin(a) * 0.25, 0), (sx + math.cos(a) * 0.2, sy + math.sin(a) * 0.2, 0.45), 0.05, 0.05, P.WOOD_DARK)
    st.build(root)
    stack = [("carcassonne", P.CARCASSONNE, 0.13), ("root", P.ROOT, 0.1), ("dune", P.DUNE, 0.12),
             ("agricola", P.AGRICOLA, 0.11), ("next-station", P.NEXT_STATION, 0.07)]
    z = 0.5
    for i, (gid, color, h) in enumerate(stack):
        gg = group(f"game_{gid}", parent=root, id=f"game:{gid}")
        b = Model(f"box_{gid}")
        b.box((0.62, 0.62, h), (sx, sy, z + h / 2), color, rot=(0, 0, (i % 2 - 0.5) * 0.18))
        b.box((0.3, 0.02, h * 0.5), (sx, sy - 0.31, z + h / 2), P.WHITE, rot=(0, 0, (i % 2 - 0.5) * 0.18))  # title on the side
        b.build(gg)
        z += h


def lounge(root):
    """A worn sofa facing the telly, on a striped rug."""
    m = Model("lounge", seed=66)
    cx, cy = -2.4, TV_Y - 0.3
    m.box((3.0, 2.6, 0.03), (cx - 0.3, cy, 0.015), P.WHITE)
    for k in range(5):
        m.box((3.0, 0.24, 0.035), (cx - 0.3, cy - 1.0 + k * 0.5, 0.018), P.TILE_BLUE)
    sx = cx + 0.5
    m.box((0.9, 2.1, 0.45), (sx, cy, 0.225), P.SOFA)
    m.box((0.3, 2.1, 0.85), (sx + 0.35, cy, 0.425), P.SOFA)                             # back
    for dy in (-1.0, 1.0):
        m.box((0.9, 0.2, 0.65), (sx, cy + dy, 0.325), P.SOFA_DARK)                       # arms
    for dy in (-0.48, 0.48):
        m.box((0.7, 0.9, 0.14), (sx - 0.05, cy + dy, 0.52), P.SOFA_LIGHT)                # cushions
    m.box((0.6, 0.7, 0.1), (sx + 0.05, cy + 0.55, 0.62), P.GOLD, rot=(0.2, 0.3, 0))      # a knitted blanket
    m.build(root)


def table(root):
    """The kitchen table: the coffee, the sketchbook and the keeper's log."""
    tx, ty = TABLE
    m = Model("table", seed=67)
    m.cyl(0.75, 0.07, (tx, ty, 0.82), P.WOOD_LIGHT, segs=12)
    m.cyl(0.08, 0.8, (tx, ty, 0.02), P.WOOD_DARK, segs=6)
    m.cyl(0.4, 0.04, (tx, ty, 0), P.WOOD_DARK, segs=8)
    for a in (0.6, 2.9):                                                                 # two chairs
        cx, cy = tx + math.cos(a) * 1.05, ty + math.sin(a) * 1.05
        m.box((0.5, 0.5, 0.06), (cx, cy, 0.48), P.WOOD, rot=(0, 0, a))
        for dx in (-0.2, 0.2):
            for dy in (-0.2, 0.2):
                ca, sa = math.cos(a), math.sin(a)
                m.box((0.05, 0.05, 0.48), (cx + dx * ca - dy * sa, cy + dx * sa + dy * ca, 0.24), P.WOOD_DARK)
        bx, by = cx + math.cos(a) * 0.23, cy + math.sin(a) * 0.23
        m.box((0.06, 0.5, 0.6), (bx, by, 0.8), P.WOOD, rot=(0, 0, a))
    m.build(root)
    top = 0.86

    g = group("coffee", parent=root, id="coffee")
    c = Model("mug")
    c.cyl(0.08, 0.16, (tx + 0.3, ty - 0.25, top), P.TILE_BLUE, segs=8)
    c.cyl(0.065, 0.01, (tx + 0.3, ty - 0.25, top + 0.15), P.COFFEE, segs=8)           # black
    c.plank_line((tx + 0.38, ty - 0.25, top + 0.12), (tx + 0.44, ty - 0.25, top + 0.05), 0.03, 0.03, P.TILE_BLUE)
    c.build(g)
    emitter(root, (tx + 0.3, ty - 0.25, top + 0.2), "steam")

    g = group("sketchbook", parent=root, id="sketchbook")
    s = Model("sketchbook_pages")
    s.box((0.6, 0.42, 0.03), (tx - 0.15, ty + 0.2, top + 0.015), P.INK, rot=(0, 0, 0.15))
    s.box((0.56, 0.38, 0.02), (tx - 0.15, ty + 0.2, top + 0.035), P.WHITE, rot=(0, 0, 0.15))
    for dx, dy, r in ((-0.05, 0.22, 0.05), (0.02, 0.2, 0.035)):                         # a pencil bird
        s.ball(r, (tx - 0.15 + dx, ty + dy, top + 0.047), "#8c8793", subdiv=1, scale=(1.3, 1, 0.1))
    s.plank_line((tx - 0.3, ty + 0.12, top + 0.05), (tx + 0.05, ty + 0.1, top + 0.05), 0.012, 0.01, "#8c8793")  # the branch
    s.plank_line((tx + 0.12, ty + 0.05, top + 0.05), (tx + 0.25, ty + 0.35, top + 0.05), 0.02, 0.02, P.GOLD)   # pencil
    s.build(g)

    g = group("logbook", parent=root, id="logbook")
    b = Model("logbook_cover")
    b.box((0.36, 0.5, 0.07), (tx - 0.35, ty - 0.35, top + 0.035), P.LEATHER, rot=(0, 0, -0.3))
    b.box((0.34, 0.47, 0.05), (tx - 0.34, ty - 0.35, top + 0.035), P.WHITE, rot=(0, 0, -0.3))
    b.box((0.37, 0.05, 0.075), (tx - 0.35, ty - 0.35, top + 0.036), P.GOLD, rot=(0, 0, -0.3))
    b.build(g)
    light(root, (tx, ty, 2.6), P.WARM_LIGHT, 4, 0.9)


def gear(root):
    """What he goes out with: a surfboard over the bookcase, a pack and boots by the door."""
    g = group("surfboard", parent=root, id="surfboard")
    m = Model("surfboard_body")
    cx, z = (CASE_X0 + CASE_X1) / 2, 4.25
    m.ball(0.3, (cx, Y1 - 0.14, z), P.SURFBOARD, subdiv=2, scale=(6.2, 0.22, 1.0))
    m.box((3.4, 0.05, 0.05), (cx, Y1 - 0.2, z), P.RED)                                  # stringer
    m.box((0.2, 0.04, 0.12), (cx + 1.6, Y1 - 0.08, z - 0.3), P.WOOD_DARK)              # wall pegs
    m.box((0.2, 0.04, 0.12), (cx - 1.6, Y1 - 0.08, z - 0.3), P.WOOD_DARK)
    m.build(g)

    g = group("backpack", parent=root, id="backpack")
    b = Model("pack")
    px, py = X0 + 0.55, -3.7
    b.box((0.5, 0.38, 0.8), (px, py, 0.4), P.PACK, taper=0.85)
    b.box((0.4, 0.1, 0.4), (px, py - 0.22, 0.35), P.PACK_DARK)                        # front pocket
    b.cyl(0.12, 0.55, (px - 0.28, py, 0.95), P.TENT_GREEN, segs=6, rot=(0, math.pi / 2, 0))  # the tent, rolled
    for dx in (-0.14, 0.14):
        b.plank_line((px + dx, py + 0.2, 0.75), (px + dx, py + 0.22, 0.15), 0.05, 0.03, P.INK)
    for dy, dx in ((0.35, 0.15), (0.6, 0.0)):                                           # boots, one fallen over
        b.box((0.18, 0.34, 0.14), (px + 0.5 + dx, py + dy + 0.3, 0.07), P.BOOT, rot=(0, 0, 0.2 + dx))
        b.box((0.16, 0.16, 0.3), (px + 0.5 + dx, py + dy + 0.2, 0.2), P.BOOT, rot=(0, 0, 0.2 + dx))
    b.build(g)

    rug = Model("table_rug")
    tx, ty = TABLE
    rug.cyl(1.55, 0.03, (tx, ty, 0), P.RUG_ROUND, segs=16)
    rug.cyl(1.3, 0.035, (tx, ty, 0), P.RUG_ROUND_DARK, segs=16)
    rug.build(root)

    plant = Model("plant", seed=68)
    px, py = X1 - 0.6, Y0 + 0.7
    plant.cyl(0.28, 0.5, (px, py, 0), P.RUST_ROOF, segs=8, r_top=0.33)
    for k, (dx, dy, z, r) in enumerate([(0, 0, 1.3, 0.45), (-0.25, 0.1, 0.95, 0.35), (0.25, -0.1, 0.9, 0.33)]):
        plant.ball(r, (px + dx, py + dy, z), P.LEAF[1 + k % 3], subdiv=1, scale=(1, 1, 0.85), jitter=0.05)
    plant.cyl(0.04, 1.0, (px, py, 0.4), P.BARK, segs=4)
    plant.build(root)


def easel(root):
    """Vincent's painting, a figure alone before a pale moon, on an easel in the open corner of the
    room, turned towards whoever is looking in. The runtime hangs public/drawings/painting.png on
    the canvas; its face is the canvas model's -y side, so it can be turned like any model."""
    g = group("painting", parent=root, id="painting")
    ex, ey, turn = 4.1, -1.7, 0.38                                                    # facing the camera, more or less
    w, h, bottom = 1.25, 1.0, 0.95                                                     # 160 × 128, like the canvas
    e = Model("easel")
    for side in (-1, 1):                                                               # two front legs and one behind
        e.plank_line((side * 0.5, -0.12, 0), (side * 0.12, 0.02, 2.3), 0.07, 0.05, P.WOOD_LIGHT)
    e.plank_line((0, 0.75, 0), (0, 0.08, 2.1), 0.06, 0.05, P.WOOD_LIGHT)
    e.box((w + 0.2, 0.2, 0.05), (0, -0.12, bottom - 0.03), P.WOOD_LIGHT)                # the ledge it stands on
    e.box((0.2, 0.08, 0.1), (0, 0.0, bottom + h + 0.02), P.WOOD_LIGHT)                 # the clamp on top
    for k, c in enumerate((P.RED, P.TILE_BLUE, P.GOLD)):                               # paint on the ledge
        e.cyl(0.03, 0.12, (-0.45 + k * 0.08, -0.14, bottom - 0.005), c, segs=5, rot=(0, math.pi / 2 - 0.2, 0.3))
    e.build(g, loc=(ex, ey, 0), rot_z=turn)
    c = Model("painting_canvas")
    c.box((w, 0.05, h), (0, -0.06, bottom + h / 2), "#2c3a8c")                          # the blue of its sky
    c.build(g, loc=(ex, ey, 0), rot_z=turn)
    light(root, (ex - 0.6, ey - 1.4, 2.4), P.WARM_LIGHT, 3.5, 0.5, halo=False)


def details(root):
    """Two cat bowls, the keeper's oilskins by the door, a life ring, and the door out."""
    g = group("bowls", parent=root, id="bowls")
    m = Model("cat_bowls")
    for dx, c in ((0, P.RED), (0.4, P.TILE_BLUE)):
        m.cyl(0.16, 0.08, (1.1 + dx, Y1 - 0.9, 0), c, segs=8, r_top=0.19)
        m.cyl(0.14, 0.01, (1.1 + dx, Y1 - 0.9, 0.075), "#3a2e2a", segs=8)
    m.build(g)

    d = group("door", parent=root, id="door")
    x, yc, w, h = X0, -2.9, 1.2, 2.6
    m = Model("door")
    m.box((0.14, w + 0.3, h + 0.15), (x + 0.07, yc, (h + 0.15) / 2), P.WHITE)
    m.box((0.1, w, h), (x + 0.17, yc, h / 2), P.TILE_BLUE)
    m.box((0.02, w - 0.4, 0.5), (x + 0.23, yc, h - 0.6), P.SKY_DAY)                     # a little window in it
    m.cyl(0.06, 0.04, (x + 0.24, yc - 0.42, 1.2), P.GOLD, segs=6, rot=(0, math.pi / 2, 0))
    m.box((0.8, 1.2, 0.03), (x + 0.55, yc, 0.015), "#8a6a3a")
    m.build(d)

    k = Model("oilskins")                                                               # yellow coat and sou'wester
    ky = yc + 1.1
    k.box((0.1, 0.9, 0.06), (X0 + 0.05, ky, 2.2), P.WOOD_DARK)
    k.box((0.25, 0.55, 1.1), (X0 + 0.18, ky - 0.15, 1.6), P.OILSKIN, taper=0.7)
    k.cyl(0.2, 0.12, (X0 + 0.2, ky + 0.3, 2.05), P.OILSKIN, segs=8, r_top=0.14, rot=(0, math.pi / 2 - 0.3, 0))
    k.build(root)

    r = Model("life_ring")                                                             # over the door
    ry, rz = yc, 3.55
    for i in range(12):
        a = i / 12 * math.tau
        r.box((0.14, 0.14, 0.24), (X0 + 0.1, ry + math.cos(a) * 0.36, rz + math.sin(a) * 0.36), P.RED if (i // 3) % 2 else P.WHITE, rot=(a, 0, 0))
    r.build(root)


    lamp = Model("lamp")                                                                # a ship's lamp over the kitchen
    lamp.box((0.06, 0.4, 0.06), (3.4, Y1 - 0.2, 4.1), P.IRON)
    lamp.box((0.22, 0.22, 0.3), (3.4, Y1 - 0.45, 3.9), P.LANTERN, glow=True)
    lamp.cyl(0.16, 0.08, (3.4, Y1 - 0.45, 4.05), P.GOLD, segs=4, r_top=0.03)
    lamp.build(root)
    light(root, (3.4, Y1 - 0.8, 3.6), P.WARM_LIGHT, 5, 0.9, flicker=0.1)


def guests(root):
    """Out of the rain (the runtime shows them only while it rains on the island): Charlie and
    George asleep on the sofa, Beike stretched out on the rug in front of it. She is in here
    whenever she's watching the telly (src/island/scene/companion.ts), and Vincent whenever he's
    at his desk making a game (src/island/scene/vincent.ts)."""
    g = group("guests", parent=root, guests="lighthouse")
    sx, cy = -1.95, TV_Y - 0.3
    cats.charlie(group("charlie", (sx, cy - 0.5, 0.59), rot_z=-math.pi / 2, parent=g))
    cats.george(group("george", (sx, cy + 0.38, 0.6), rot_z=-math.pi / 2, parent=g))
    beike.asleep(group("beike", (-3.3, 0.5, 0), rot_z=-math.pi / 2 - 0.4, parent=g))
    # and her, whenever she's in watching the telly (rain or not): on Charlie's end of the sofa,
    # so when the cats are in too, Charlie moves onto her lap (quarters.ts)
    companion.on_the_sofa(g, (sx + 0.08, cy - 0.45, 0), rot_z=-math.pi / 2)
    coding(group("vincent_coding", (*DESK, 0), parent=g, id="vincent_coding"))


def desk(root):
    """Vincent's desk: a wide monitor (dark while he's away), a keyboard and mouse, a mug, a
    controller for testing, his level sketched out on paper, the tower underneath and a desk
    chair on wheels."""
    dx, dy = DESK
    top = 0.74
    g = group("desk", (dx, dy, 0), parent=root, id="desk")
    m = Model("desk_body", seed=69)
    m.box((1.5, 0.72, 0.06), (0, 0, top - 0.03), P.WOOD_LIGHT)
    for sx in (-0.68, 0.68):
        for sy in (-0.3, 0.3):
            m.box((0.06, 0.06, top - 0.06), (sx, sy, (top - 0.06) / 2), P.WOOD_DARK)
    m.box((0.22, 0.46, 0.48), (0.5, 0.05, 0.28), "#2c2a33")                              # the tower
    m.box((0.02, 0.3, 0.02), (0.5, -0.19, 0.44), "#8ff0e0", glow=True)                  # its light
    mx, my, mz = MONITOR
    w, h = SCREEN
    m.box((0.3, 0.2, 0.02), (mx, my + 0.05, top + 0.01), "#2c2a33")                     # the monitor's foot
    m.box((0.06, 0.05, mz - top - 0.1), (mx, my + 0.08, (top + mz - 0.1) / 2), "#2c2a33")
    m.box((w + 0.08, 0.05, h + 0.08), (mx, my, mz), "#2c2a33")
    m.box((w, 0.01, h), (mx, my - 0.026, mz), "#15131c")                                 # the screen, off
    for k, c in enumerate((P.GOLD, "#ff8fb0")):                                         # sticky notes on its edge
        m.box((0.08, 0.01, 0.08), (mx + w / 2 + 0.02, my - 0.03, mz + 0.15 - k * 0.11), c, rot=(0, 0.1 - k * 0.2, 0))
    m.box((0.5, 0.17, 0.03), (-0.05, -0.18, top + 0.015), "#3a3440")                     # keyboard
    m.box((0.46, 0.13, 0.01), (-0.05, -0.18, top + 0.033), "#8c8793")
    m.box((0.07, 0.11, 0.035), (0.35, -0.17, top + 0.017), "#3a3440")                    # mouse
    m.cyl(0.07, 0.15, (-0.55, 0.05, top), P.RED, segs=8)                                 # a mug
    m.cyl(0.058, 0.01, (-0.55, 0.05, top + 0.14), P.COFFEE, segs=8)
    m.box((0.22, 0.13, 0.05), (-0.45, -0.22, top + 0.025), "#d9d5cf", rot=(0, 0, 0.5))   # the controller
    m.box((0.36, 0.26, 0.01), (-0.35, 0.18, top + 0.005), P.WHITE, rot=(0, 0, -0.2))     # the level, on paper
    for k in range(4):
        m.box((0.08, 0.02, 0.003), (-0.45 + k * 0.08, 0.13 + (k % 2) * 0.06, top + 0.012), P.INK, rot=(0, 0, -0.2))
    m.build(g)

    c = Model("desk_chair")
    cy, seat = -0.75, 0.5
    c.box((0.52, 0.5, 0.08), (-0.1, cy, seat - 0.04), "#3a3440")
    c.box((0.48, 0.08, 0.5), (-0.1, cy - 0.28, seat + 0.32), "#3a3440", rot=(0.12, 0, 0))
    c.box((0.06, 0.06, 0.3), (-0.1, cy - 0.26, seat + 0.02), P.IRON)
    c.cyl(0.04, seat - 0.12, (-0.1, cy, 0.08), P.IRON, segs=6)
    for k in range(5):
        a = k / 5 * math.tau + 0.3
        c.plank_line((-0.1, cy, 0.07), (-0.1 + math.cos(a) * 0.3, cy + math.sin(a) * 0.3, 0.05), 0.05, 0.04, P.IRON)
    c.build(g)


def coding(g):
    """Vincent at the desk (it stands at the group's origin), and what's on his screen while he's
    there: his code on the left, and the game on the right, a little hero (`desk_hero`, which
    the runtime makes run and jump) in a level of grass and floating platforms."""
    characters.vincent_coding(group("vincent_at_desk", (-0.1, -0.75, 0), rot_z=math.pi, parent=g))
    mx, my, mz = MONITOR
    w, h = SCREEN
    y = my - 0.033
    m = Model("desk_screen")
    split = mx - w / 2 + w * 0.38                                                        # code | game
    for i, (indent, length, c) in enumerate([(0, 0.2, "#ff8fb0"), (1, 0.16, "#8ff0e0"), (1, 0.22, P.WHITE),
                                              (2, 0.12, P.GOLD), (2, 0.18, P.WHITE), (1, 0.08, "#8ff0e0"),
                                              (0, 0.05, "#ff8fb0"), (0, 0.14, P.WHITE), (1, 0.2, "#b7a6ff")]):
        x0 = mx - w / 2 + 0.03 + indent * 0.03
        m.box((length, 0.004, 0.022), (x0 + length / 2, y, mz + h / 2 - 0.04 - i * 0.045), c, glow=True)
    gw = mx + w / 2 - split
    gx = split + gw / 2
    m.box((gw, 0.004, h), (gx, y, mz), "#8fd3ff", glow=True)                               # the sky
    m.box((gw, 0.006, 0.08), (gx, y, mz - h / 2 + 0.04), "#7a4f2e", glow=True)             # the ground
    m.box((gw, 0.007, 0.025), (gx, y, mz - h / 2 + 0.07), "#5fc05a", glow=True)            # and its grass
    for px, pz, pw in ((0.08, 0.02, 0.14), (0.3, 0.11, 0.12), (0.18, -0.09, 0.08)):      # floating platforms
        m.box((pw, 0.007, 0.03), (split + px, y, mz + pz), "#c98a4a", glow=True)
        m.box((pw, 0.008, 0.01), (split + px, y, mz + pz + 0.015), "#5fc05a", glow=True)
    m.box((0.03, 0.008, 0.03), (split + 0.3, y, mz + 0.16), P.GOLD, glow=True)            # a coin
    m.box((0.06, 0.008, 0.03), (split + 0.1, y, mz + 0.17), P.WHITE, glow=True)           # a cloud
    m.build(g)
    hero = Model("desk_hero")                                                            # red cap, blue dungarees
    hero.box((0.028, 0.008, 0.02), (0, 0, 0.01), "#2a5da8", glow=True)
    hero.box((0.028, 0.009, 0.018), (0, 0, 0.029), "#f0c8a0", glow=True)
    hero.box((0.032, 0.01, 0.01), (0, 0, 0.042), P.RED, glow=True)
    hero.build(g, loc=(split + 0.05, y - 0.002, mz - h / 2 + 0.083))


def build():
    root = group("lighthouse_interior")
    shell(root)
    stair(root)
    bookcase(root)
    portholes(root)
    kitchen(root)
    telly(root)
    lounge(root)
    table(root)
    gear(root)
    easel(root)
    desk(root)
    details(root)
    guests(root)
    return root
