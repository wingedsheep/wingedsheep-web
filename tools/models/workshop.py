"""The workshop, inside: a dollhouse cutaway like the library, exported on its own as workshop.glb.

Every project stands in the room as a thing you can walk up to, and a slightly clumsy robot
looks after them. The camera looks in from the south-east, so the north and west walls stand
full height and the south and east walls are sawn off low. x = east, y = north, z = up.

Each exhibit's root has id "project_<id>" (matching src/data/projects.ts). Waypoints carry
`waypoint` (a name) and `links` (names it can walk to in a straight line, both ways); an
exhibit's stand is the waypoint named after its project, where the robot stops to present it.

Parts the runtime animates (src/island/scene/workshop-room.ts):
  gear, card, orb0..4          the Argentum engine turns, its card spins, the mana orbits
  press_plate, press_wheel,    the press stamps; a fresh card slides onto the pile
  card_out
  quill, ink0..5, leaf         the quill writes a tale by itself and turns the page
  node_<layer>_<i>             the network's nodes flash as a forward pass runs through
  meeple                       one meeple can't sit still
  record                       the gramophone spins
  lander, thrust               the lunar lander practises its landing
  hammock, cursor              the hammock sways; the terminal cursor blinks
  window_glass                 takes the colour of the sky outside
  robot_* parts                walking, tripping, presenting (src/island/scene/robot.ts)
  robot_update, robot_bar      its update's progress bar, on Patch Tuesday
  vincent_workshop             Vincent at the boat he's building, on a Saturday (bench_* parts)
  boat_stage_<n>               the boat, one Saturday's work at a time (week.ts shows one)
  sawdust_fresh                a Saturday's shavings
"""
from __future__ import annotations

import math

import characters
import palette as P
from kit import Model, emitter, group, light

W, D, H = 14.0, 10.0, 5.0         # inside of the room
T = 0.4                           # wall thickness
X0, X1 = -W / 2, W / 2
Y0, Y1 = -D / 2, D / 2
CUT = 0.5                         # height of the sawn-off south and east walls

# colours only the workshop uses
BRASS = "#c9953c"
BRASS_DARK = "#8f6428"
SILVER = "#c4c8d4"
SILVER_DARK = "#8a8fa3"
ROBOT = "#e0a94a"            # mustard paint, a bit chipped
ROBOT_DARK = "#a8702f"
ROBOT_FACE = "#262233"
EYE = "#8ff0e0"
BULB = "#ff6a4d"
PLASTER_TAPE = "#f0cf9e"
MANA = ["#f7efcf", "#4a8fd6", "#51405e", "#e0553c", "#4fa35a"]   # W U B R G
CARD_BACK = "#6b4a2b"
CARD_ART = ["#6aa7c9", "#c96a4a", "#7ab36a", "#b58ad0"]
PARCHMENT = "#efe2c0"
CHALK = "#f2eee4"
BOARD = "#2f4a3c"
SCREEN_GREEN = "#7dffa0"
CRT = "#d8cdb0"
MOON = "#b9b4c0"
LANDER = "#8f7ad6"
MEEPLE = ["#d9503a", "#3b6fd1", "#e8c640", "#3f9a55", "#1d1a24"]
TILE = "#6aa75a"
ROAD = "#e6d3a3"
CITY = "#c79a5e"
PEGBOARD = "#c9a36f"
SAWDUST = "#9a6a44"


def _card(m: Model, loc, art: str, size=1.0, rot=(0, 0, 0), back=True):
    """A Magic card standing upright in the XZ plane, face towards -y."""
    w, h, d = 0.63 * size, 0.88 * size, 0.03 * size
    x, y, z = loc
    m.box((w, d, h), (x, y, z), "#1d1a24", rot=rot)
    if back:
        m.box((w * 0.9, d, h * 0.92), (x, y + d * 0.6, z), CARD_BACK, rot=rot)
        m.ball(w * 0.28, (x, y + d * 1.1, z), BRASS, subdiv=1, scale=(1, 0.2, 1.4), rot=rot)
    m.box((w * 0.86, d, h * 0.08), (x, y - d * 0.5, z + h * 0.38), PARCHMENT, rot=rot)     # title bar
    m.box((w * 0.82, d, h * 0.4), (x, y - d * 0.5, z + h * 0.1), art, rot=rot)             # art
    m.box((w * 0.82, d, h * 0.3), (x, y - d * 0.5, z - h * 0.28), PARCHMENT, rot=rot)      # rules text


# --- the room ------------------------------------------------------------------------------

def shell(root):
    m = Model("room", seed=51)
    # a stone slab under wide, worn floorboards running north-south
    m.box((W + 2 * T + 0.3, D + 2 * T + 0.3, 0.6), (0, 0, -0.4), P.STONE_DARK)
    boards = [P.WOOD_DARK, P.WOOD, P.WOOD_DARK, "#6e4630"]
    x = X0 - T
    while x < X1 - 1e-6:
        w = min(0.55, X1 - x)
        m.box((w, D + T, 0.1), (x + w / 2, T / 2 - 0.0, -0.05), boards[m.rng.randrange(len(boards))])
        x += w
    # plank walls: full height north and west, sawn off low on the open sides
    m.box((W + 2 * T, T, H), (0, Y1 + T / 2, H / 2), P.PLANK)
    m.box((T, D + T, H), (X0 - T / 2, -T / 2, H / 2), P.PLANK)
    m.box((T, D + T, CUT), (X1 + T / 2, -T / 2, CUT / 2), P.PLANK)
    m.box((W, T, CUT), (0, Y0 - T / 2, CUT / 2), P.PLANK)
    for a, b in [((0, Y1 + T / 2), (W + 2 * T, T, H)), ((X0 - T / 2, -T / 2), (T, D + T, H)),
                 ((X1 + T / 2, -T / 2), (T, D + T, CUT)), ((0, Y0 - T / 2), (W, T, CUT))]:
        m.box((b[0], b[1], 0.04), (a[0], a[1], b[2] + 0.02), P.WALL_CUT)                  # the saw cut
    # board seams on the inside, and heavy corner posts and a beam along the top
    for i in range(1, 11):
        z = i * 0.45
        m.box((W, 0.03, 0.04), (0, Y1 - 0.01, z), P.WOOD_DARK)
        m.box((0.03, D, 0.04), (X0 + 0.01, 0, z), P.WOOD_DARK)
    for x in (X0 + 0.18, -2.4, 2.4):
        m.box((0.3, 0.3, H), (x, Y1 - 0.15, H / 2), P.WOOD_DARK)
    m.box((0.3, 0.3, H), (X0 + 0.15, Y0 + 0.9, H / 2), P.WOOD_DARK)
    m.box((W, 0.3, 0.3), (0, Y1 - 0.15, H - 0.15), P.WOOD_DARK)
    m.box((0.3, D, 0.3), (X0 + 0.15, 0, H - 0.15), P.WOOD_DARK)
    # sawdust drifts and a round rag rug under the game table
    for i, (x, y, r) in enumerate([(4.8, 3.7, 0.7), (1.8, 2.3, 0.5), (-4.6, 2.0, 0.4), (5.8, -0.9, 0.35)]):
        m.cyl(r, 0.02, (x, y, 0.0), SAWDUST, segs=7)
    for i, (r, c) in enumerate([(1.9, "#8a4a3a"), (1.6, "#c9a36f"), (1.3, "#4f6a8a"), (0.9, "#b0512f"), (0.5, "#c9a36f")]):
        m.cyl(r, 0.02 + i * 0.004, (-1.2, 0.6, 0.0), c, segs=14)
    m.build(root)


def window(root):
    """A wide workshop window in the north wall, square panes, a bench of pots on the sill."""
    cx, w, z0, z1 = 0.4, 2.2, 1.9, 3.7
    glass = Model("window_glass")
    glass.box((w, 0.05, z1 - z0), (cx, Y1 - 0.03, (z0 + z1) / 2), P.SKY_DAY, glow=True)
    glass.build(root)
    m = Model("window_frame")
    y = Y1 - 0.1
    for x in (cx - w / 2 - 0.08, cx + w / 2 + 0.08):
        m.box((0.16, 0.16, z1 - z0 + 0.3), (x, y, (z0 + z1) / 2), P.WOOD_DARK)
    for z in (z0 - 0.08, z1 + 0.08):
        m.box((w + 0.3, 0.16, 0.16), (cx, y, z), P.WOOD_DARK)
    for k in (1, 2):
        m.box((0.06, 0.1, z1 - z0), (cx - w / 2 + k * w / 3, y + 0.02, (z0 + z1) / 2), P.WOOD_DARK)
    m.box((w, 0.1, 0.06), (cx, y + 0.02, (z0 + z1) / 2), P.WOOD_DARK)
    m.box((w + 0.4, 0.3, 0.08), (cx, Y1 - 0.18, z0 - 0.2), P.WOOD)                      # sill
    m.build(root)
    group("sunbeam", (cx, Y1, (z0 + z1) / 2), parent=root, sunbeam=1)


def door(root):
    g = group("workshop_door", parent=root, id="workshop_door")
    x, yc, w, h = X0, 0.7, 1.6, 2.9
    m = Model("door")
    m.box((0.14, w + 0.36, h + 0.18), (x + 0.07, yc, (h + 0.18) / 2), P.WOOD_DARK)
    m.box((0.1, w, h), (x + 0.17, yc, h / 2), P.WOOD_LIGHT)
    m.plank_line((x + 0.24, yc - w / 2 + 0.1, 0.2), (x + 0.24, yc + w / 2 - 0.1, h - 0.2), 0.1, 0.03, P.WOOD_DARK)  # the Z brace
    for z in (0.3, h - 0.3):
        m.box((0.03, w - 0.1, 0.1), (x + 0.24, yc, z), P.WOOD_DARK)
    m.cyl(0.07, 0.04, (x + 0.24, yc - w / 2 + 0.2, 1.2), P.IRON, segs=6, rot=(0, math.pi / 2, 0))
    m.box((1.0, 1.4, 0.03), (x + 0.6, yc, 0.015), "#6a5a3a")                               # doormat
    m.build(g)


def tool_wall(root):
    """Pegboard with the tools outlined, a long bench under it, a vice and a spare robot head."""
    m = Model("tool_wall", seed=52)
    x0, x1 = 3.4, 6.7
    cx = (x0 + x1) / 2
    m.box((x1 - x0, 0.06, 1.5), (cx, Y1 - 0.04, 2.6), PEGBOARD)
    for i in range(12):
        for j in range(5):
            m.box((0.03, 0.02, 0.03), (x0 + 0.15 + i * 0.26, Y1 - 0.08, 2.0 + j * 0.28), BRASS_DARK)
    # tools hanging on it: a hammer, a saw, spanners in a row, a coil of wire
    m.box((0.08, 0.05, 0.5), (x0 + 0.4, Y1 - 0.1, 2.6), P.WOOD)
    m.box((0.28, 0.06, 0.1), (x0 + 0.4, Y1 - 0.1, 2.88), P.IRON)
    m.prism([(-0.4, 0), (0.35, 0), (0.35, 0.28), (-0.4, 0.12)], 0.03, (x0 + 1.15, Y1 - 0.1, 2.45), SILVER)
    m.box((0.18, 0.06, 0.22), (x0 + 1.6, Y1 - 0.1, 2.58), P.WOOD)
    for i in range(5):
        m.box((0.05, 0.04, 0.25 + i * 0.06), (x0 + 2.0 + i * 0.14, Y1 - 0.1, 2.9 - i * 0.03), SILVER_DARK)
    m.cyl(0.18, 0.06, (x0 + 2.95, Y1 - 0.1, 2.4), "#b5562d", segs=10, rot=(math.pi / 2, 0, 0))
    # the bench
    m.box((x1 - x0 + 0.2, 0.9, 0.12), (cx, Y1 - 0.5, 1.0), P.WOOD_LIGHT)
    for x in (x0 + 0.1, x1 - 0.1):
        for y in (Y1 - 0.9, Y1 - 0.15):
            m.box((0.12, 0.12, 1.0), (x, y, 0.5), P.WOOD_DARK)
    m.box((x1 - x0, 0.8, 0.06), (cx, Y1 - 0.5, 0.25), P.WOOD)                            # lower shelf
    m.box((0.3, 0.4, 0.25), (x0 + 0.4, Y1 - 0.75, 1.18), P.IRON)                        # vice
    m.box((0.06, 0.5, 0.06), (x0 + 0.4, Y1 - 1.1, 1.18), SILVER)
    # a spare head for the robot, the eye dark, waiting for a new bulb
    m.ball(0.2, (x0 + 1.6, Y1 - 0.5, 1.24), ROBOT, subdiv=2, scale=(1.15, 0.95, 0.85))
    m.cyl(0.12, 0.05, (x0 + 1.6, Y1 - 0.68, 1.24), ROBOT_FACE, segs=10, rot=(math.pi / 2, 0, 0))
    for i, c in enumerate(["#6fe0d6", "#e8b24a", "#e46f5a"]):                           # jars of bits
        m.cyl(0.12, 0.28, (x0 + 2.4 + i * 0.3, Y1 - 0.4, 1.06), "#cfe6e0", segs=6)
        m.cyl(0.09, 0.12, (x0 + 2.4 + i * 0.3, Y1 - 0.4, 1.08), c, segs=6)
    for i in range(3):                                                                   # boxes under it
        m.box((0.6, 0.5, 0.35), (x0 + 0.5 + i * 1.1, Y1 - 0.5, 0.49), [P.WOOD, "#6b3f2b", P.WOOD_LIGHT][i])
    m.build(root)
    light(root, (cx, Y1 - 1.0, 2.2), P.WARM_LIGHT, 4, 0.7, halo=False)


def shelves(root):
    """Shelves on the west wall: paint tins, a clock with its insides out, parts in jars."""
    m = Model("shelves", seed=53)
    x = X0 + 0.25
    for z in (2.2, 2.9):
        m.box((0.4, 2.2, 0.06), (x, -2.6, z), P.WOOD_LIGHT)
        for y in (-3.6, -1.6):
            m.box((0.04, 0.06, 0.2), (X0 + 0.1, y, z - 0.12), P.IRON)
    for i, c in enumerate(["#c8403a", "#2f5d8c", "#e8b24a"]):
        m.cyl(0.14, 0.26, (x, -3.4 + i * 0.32, 2.23), c, segs=8)
    m.cyl(0.25, 0.08, (x, -2.2, 2.5), PARCHMENT, segs=10, rot=(0, math.pi / 2, 0))         # a clock face
    for i in range(4):
        m.cyl(0.1, 0.24, (x, -3.4 + i * 0.3, 2.93), "#cfe6e0", segs=6)
    m.box((0.3, 0.6, 0.35), (x, -1.9, 3.1), CARD_BACK)                                     # a box of cards
    m.build(root)


def lamps(root):
    """Enamel shade lamps on the walls."""
    for x, y, face in [(-3.9, Y1 - 0.02, "y"), (3.0, Y1 - 0.02, "y"), (X0 + 0.02, -2.6, "x")]:
        m = Model("wall_lamp")
        dx, dy = (0.45, 0) if face == "x" else (0, -0.45)
        z = 3.9
        m.plank_line((x, y, z), (x + dx, y + dy, z + 0.1), 0.05, 0.05, P.IRON)
        m.cyl(0.26, 0.2, (x + dx, y + dy, z - 0.15), "#3f6a58", segs=8, r_top=0.08)
        m.ball(0.09, (x + dx, y + dy, z - 0.18), P.LANTERN, subdiv=1, glow=True)
        m.build(root)
        light(root, (x + dx, y + dy, z - 0.4), P.WARM_LIGHT, 6, 0.9, flicker=0.1)


# --- the exhibits -------------------------------------------------------------------------

def argentum(root):
    """A silver engine that plays Magic by itself: gears turn, the mana orbits a floating card."""
    m = Model("argentum_base", seed=31)
    m.cyl(0.95, 0.35, (0, 0, 0), P.STONE_DARK, segs=8)
    m.cyl(0.8, 0.12, (0, 0, 0.35), P.STONE, segs=8)
    for x in (-0.55, 0.55):                                   # silver uprights (argentum!)
        m.box((0.16, 0.3, 1.8), (x, 0.1, 1.35), SILVER)
        m.box((0.22, 0.36, 0.14), (x, 0.1, 2.25), SILVER_DARK)
        m.ball(0.12, (x, 0.1, 2.4), BRASS, subdiv=1)
    m.box((1.26, 0.3, 0.14), (0, 0.1, 0.55), SILVER_DARK)
    m.box((0.9, 0.5, 0.35), (0, 0.15, 0.62), BRASS_DARK)      # the engine's belly
    for i in range(4):                                         # little dials
        m.cyl(0.07, 0.03, (-0.3 + i * 0.2, -0.11, 0.66), PARCHMENT, segs=8, rot=(math.pi / 2, 0, 0))
    m.box((0.5, 0.04, 0.06), (0, -0.12, 0.84), "#1d1a24")     # a slot for cards
    # a deck, face down, waiting to be drawn
    m.box((0.3, 0.42, 0.18), (0.65, -0.55, 0.44), CARD_BACK)
    m.build(root)

    for side, r, z in ((1, 0.42, 1.1), (-1, 0.28, 1.45)):
        g = Model("gear")
        g.cyl(r, 0.08, (0, 0, -0.04), BRASS, segs=12, rot=(0, 0, 0))
        g.cyl(r * 0.3, 0.12, (0, 0, -0.06), BRASS_DARK, segs=6)
        for i in range(10 if r > 0.3 else 7):
            a = i / (10 if r > 0.3 else 7) * math.tau
            g.box((0.1, 0.08, 0.1), (math.cos(a) * (r + 0.04), math.sin(a) * (r + 0.04), 0), BRASS, rot=(0, 0, a))
        obj = g.build(root, loc=(side * 0.66, 0.1, z))
        obj.rotation_euler = (0, math.pi / 2, 0)
        obj["spin"] = side * (0.8 if r > 0.3 else -1.2)

    c = Model("card")
    _card(c, (0, 0, 0), CARD_ART[0], size=1.1)
    c.build(root, loc=(0, 0.1, 1.75))
    for i, col in enumerate(MANA):
        o = Model(f"orb{i}")
        o.ball(0.1, (0, 0, 0), col, subdiv=1, glow=True)
        o.build(root, loc=(0, 0.1, 1.75))
    light(root, (0, -0.4, 1.8), "#cfd8ff", 5, 0.8)


def press(root):
    """Mana from the Machine: an iron press that prints brand-new cards, drying on a line."""
    m = Model("press_frame", seed=32)
    m.box((1.4, 0.9, 0.7), (0, 0, 0.35), P.WOOD_DARK)                  # bed
    m.box((1.2, 0.75, 0.06), (0, 0, 0.73), "#3a3440")                  # type bed
    for x in (-0.6, 0.6):
        m.box((0.16, 0.2, 1.6), (x, 0, 1.4), P.IRON)
    m.box((1.5, 0.3, 0.26), (0, 0, 2.25), P.IRON)                      # crossbeam
    m.cyl(0.06, 0.8, (0, 0, 1.7), BRASS, segs=6)                       # the screw
    m.cyl(0.22, 0.4, (0, 0, 2.38), P.IRON, segs=8, r_top=0.1)
    # "the machine": a glowing tube on top, humming with ideas
    m.cyl(0.13, 0.5, (0.45, 0.05, 2.38), P.SCREEN, segs=8, glow=True)
    m.cyl(0.16, 0.08, (0.45, 0.05, 2.88), BRASS, segs=8)
    m.cyl(0.16, 0.08, (0.45, 0.05, 2.36), BRASS, segs=8)
    # the pile of finished cards on a side tray
    m.box((0.7, 0.8, 0.08), (1.05, -0.1, 0.72), P.WOOD)
    for i in range(6):
        m.box((0.44, 0.6, 0.02), (1.05 + (i % 2) * 0.03, -0.1, 0.78 + i * 0.022), "#1d1a24" if i % 2 else PARCHMENT,
              rot=(0, 0, (i % 3 - 1) * 0.08))
    # a paper roll feeding in from the back
    m.cyl(0.18, 1.1, (-0.55, 0.62, 0.95), PARCHMENT, segs=8, rot=(0, math.pi / 2, 0))
    m.build(root)

    pl = Model("press_plate")
    pl.box((1.0, 0.65, 0.14), (0, 0, 0), P.IRON)
    pl.box((0.9, 0.55, 0.03), (0, 0, -0.08), BRASS_DARK)
    pl.build(root, loc=(0, 0, 1.25))

    w = Model("press_wheel")
    w.cyl(0.5, 0.06, (0, 0, -0.03), P.IRON, segs=10, r_top=0.5)
    w.cyl(0.42, 0.08, (0, 0, -0.04), "#3a3440", segs=10)
    for i in range(4):
        w.box((0.9, 0.06, 0.05), (0, 0, 0), BRASS, rot=(0, 0, i * math.pi / 4))
    for i in range(4):
        a = i / 4 * math.tau
        w.cyl(0.035, 0.22, (math.cos(a) * 0.5, math.sin(a) * 0.5, 0), P.WOOD_LIGHT, segs=5)
    obj = w.build(root, loc=(0, -0.2, 2.25))
    obj.rotation_euler = (math.pi / 2, 0, 0)

    out = Model("card_out")
    out.box((0.44, 0.6, 0.02), (0, 0, 0), PARCHMENT)
    out.box((0.36, 0.28, 0.022), (0, 0.08, 0), CARD_ART[1])
    out.build(root, loc=(0.35, -0.1, 0.8))

    # a washing line of freshly printed cards drying in the sun
    line = Model("drying_line", seed=33)
    for x in (-1.4, 1.6):
        line.cyl(0.05, 2.0, (x, 1.2, 0), P.WOOD_DARK, segs=5)
    line.plank_line((-1.4, 1.2, 1.9), (1.6, 1.2, 1.86), 0.02, 0.02, "#d9c79a")
    for i, art in enumerate(CARD_ART):
        x = -0.9 + i * 0.7
        _card(line, (x, 1.18, 1.58), art, size=0.7, rot=(0, 0, 0), back=False)
        line.box((0.05, 0.06, 0.12), (x, 1.17, 1.88), P.WOOD_LIGHT)     # peg
    line.build(root)


def carcassonne(root):
    """A game of Carcassonne in progress: roads, a walled city, meeples everywhere."""
    m = Model("carcassonne", seed=35)
    m.box((1.9, 1.5, 0.08), (0, 0, 0.78), P.WOOD_LIGHT)
    for x in (-0.85, 0.85):
        for y in (-0.62, 0.62):
            m.box((0.09, 0.09, 0.76), (x, y, 0.38), P.WOOD_DARK)
    s = 0.3
    # 5 x 4 tiles; "r" road east-west, "v" road north-south, "c" city, "m" monastery, "." field
    grid = ["..c..",
            "rrcr.",
            ".vmv.",
            ".v..."]
    for j, row in enumerate(grid):
        for i, k in enumerate(row):
            x, y = (i - 2) * (s + 0.01), (1.5 - j) * (s + 0.01)
            top = 0.84
            m.box((s, s, 0.03), (x, y, top), TILE if (i + j) % 3 else "#77b163")
            if k == "r":
                m.box((s, 0.07, 0.035), (x, y, top + 0.003), ROAD)
            elif k == "v":
                m.box((0.07, s, 0.035), (x, y, top + 0.003), ROAD)
            elif k == "c":
                m.box((s * 0.9, s * 0.9, 0.05), (x, y, top + 0.02), CITY)
                m.box((0.08, 0.08, 0.12), (x + 0.06, y - 0.04, top + 0.08), P.RUST_ROOF)
                m.box((0.07, 0.07, 0.1), (x - 0.07, y + 0.05, top + 0.07), P.RUST_ROOF)
            elif k == "m":
                m.box((0.14, 0.12, 0.12), (x, y, top + 0.07), P.PLASTER)
                m.gable((0.16, 0.14, 0.07), (x, y, top + 0.13), P.RUST_ROOF)
    for (i, j), c in [((0, 1), MEEPLE[1]), ((2, 0), MEEPLE[2]), ((3, 2), MEEPLE[3]), ((1, 3), MEEPLE[4])]:
        x, y = (i - 2) * (s + 0.01), (1.5 - j) * (s + 0.01)
        _meeple(m, (x + 0.05, y, 0.86), c)
    # the tile stack, the score track and the box lid leaning on a leg
    for i in range(8):
        m.box((s, s, 0.03), (0.72, -0.5 + (i % 2) * 0.01, 0.84 + i * 0.03), "#5f4a3a" if i < 7 else "#8a6a4a")
    m.box((0.12, 0.8, 0.02), (-0.82, 0, 0.83), "#7aa36a")
    m.box((0.05, 1.0, 0.7), (-1.0, 0.15, 0.36), "#2f5d8c", rot=(0, 0.25, 0))
    m.box((0.02, 0.6, 0.3), (-1.04, 0.15, 0.42), "#e8b24a", rot=(0, 0.25, 0))
    for x in (-0.7, 0.7):                                                   # stools
        m.cyl(0.22, 0.48, (x, 1.1, 0), P.WOOD, segs=6)
    m.build(root)

    mp = Model("meeple")
    _meeple(mp, (0, 0, 0), MEEPLE[0])
    mp.build(root, loc=((1 - 2) * (s + 0.01) + 0.03, (1.5 - 1) * (s + 0.01), 0.86))


def _meeple(m: Model, loc, c):
    x, y, z = loc
    m.prism([(-0.06, 0), (-0.035, 0.05), (-0.05, 0.08), (-0.02, 0.1), (-0.025, 0.13), (0.025, 0.13), (0.02, 0.1),
             (0.05, 0.08), (0.035, 0.05), (0.06, 0), (0.015, 0), (0, 0.035), (-0.015, 0)],
            0.04, (x, y, z), c)


def gramophone(root):
    """A gramophone on a tree stump, for the music generation toolbox. Notes drift out of it."""
    m = Model("gramophone", seed=36)
    m.cyl(0.42, 0.62, (0, 0, 0), P.WOOD, segs=9, r_top=0.4)          # stump
    m.cyl(0.36, 0.03, (0, 0, 0.62), "#c9a36f", segs=9)                # rings on top
    m.cyl(0.24, 0.03, (0, 0, 0.625), "#b5895a", segs=9)
    m.box((0.5, 0.5, 0.26), (0, 0, 0.78), "#6b2f24")                  # cabinet
    m.box((0.54, 0.54, 0.04), (0, 0, 0.66), BRASS_DARK)
    m.cyl(0.03, 0.2, (0.25, 0, 0.8), BRASS, segs=5, rot=(0, math.pi / 2, 0))   # crank
    m.box((0.04, 0.04, 0.12), (0.46, 0, 0.8), P.WOOD_DARK)
    # tone arm and the horn, opening towards the camera
    m.plank_line((0.18, 0.18, 0.93), (0.05, -0.02, 1.0), 0.04, 0.04, BRASS)
    m.plank_line((0.18, 0.18, 0.93), (0.1, 0.2, 1.25), 0.05, 0.05, BRASS)
    for i, (r0, r1, l) in enumerate([(0.04, 0.08, 0.2), (0.08, 0.16, 0.18), (0.16, 0.3, 0.16), (0.3, 0.42, 0.08)]):
        z = 0.2 + [0, 0.2, 0.38, 0.54][i]
        m.cyl(r0, l, (0.1, 0.2 - z * 0.7, 1.05 + z * 0.9), BRASS if i % 2 else "#d9a84a", segs=10, r_top=r1,
              rot=(-0.66, 0, 0))
    m.build(root)
    r = Model("record")
    r.cyl(0.22, 0.02, (0, 0, 0), "#1b1820", segs=12)
    r.cyl(0.07, 0.022, (0, 0, 0), "#c8403a", segs=8)
    r.box((0.02, 0.18, 0.024), (0, 0.12, 0), "#3a3440")               # a glint, so you see it turn
    r.build(root, loc=(0, 0, 0.91))
    emitter(root, (0.1, -0.35, 1.8), "notes")


def network(root):
    """Building a language model: a network of glass nodes in a brass frame, every layer wired to
    the next. Now and then a forward pass runs through it and the wires carry sparks upwards.
    Each node is its own part (node_<layer>_<i>) so the runtime can light it; wires join every
    node to every node in the layer above."""
    m = Model("network_frame", seed=37)
    W, z0, z1 = 1.9, 0.75, 2.75
    m.box((W + 0.5, 0.6, 0.18), (0, 0, 0.09), P.WOOD_DARK)                     # plinth
    m.box((W + 0.3, 0.45, 0.5), (0, 0, 0.43), P.WOOD)
    for i in range(5):                                                          # the input tokens
        m.box((0.24, 0.1, 0.18), (-0.76 + i * 0.38, -0.24, 0.5), PARCHMENT)
        m.box((0.1, 0.02, 0.1), (-0.76 + i * 0.38, -0.3, 0.5), ["#c8403a", "#2f5d8c", "#3f7a4a", "#b5562d", "#6b3f8c"][i])
    for x in (-W / 2 - 0.12, W / 2 + 0.12):                                     # brass uprights
        m.box((0.08, 0.08, z1 - 0.5 + 0.35), (x, 0.08, (0.68 + z1 + 0.35) / 2), BRASS)
        m.ball(0.08, (x, 0.08, z1 + 0.4), BRASS, subdiv=1)
    m.box((W + 0.4, 0.08, 0.08), (0, 0.08, z1 + 0.35), BRASS)
    # a knife switch on the side, to set it going
    m.box((0.3, 0.2, 0.06), (W / 2 + 0.45, -0.05, 0.71), P.IRON)
    m.plank_line((W / 2 + 0.35, -0.05, 0.74), (W / 2 + 0.52, -0.05, 1.0), 0.04, 0.03, "#b5562d")
    layers = [5, 4, 4, 3]
    pos = []
    for L, n in enumerate(layers):
        z = z0 + L * (z1 - z0) / (len(layers) - 1)
        row = []
        for i in range(n):
            x = (i - (n - 1) / 2) * (W / 4.4) * (1 if n > 3 else 1.2)
            row.append((x, 0.0, z))
        pos.append(row)
        m.box((W + 0.24, 0.04, 0.04), (0, 0.1, z), BRASS_DARK)                    # a rail behind each layer
    for L in range(len(layers) - 1):                                            # every node to every node above
        for a in pos[L]:
            for b in pos[L + 1]:
                m.plank_line(a, b, 0.014, 0.014, "#b87333")
    m.build(root)
    for L, row in enumerate(pos):
        for i, p in enumerate(row):
            node = Model(f"node_{L}_{i}")
            node.ball(0.1, (0, 0, 0), "#9fd8e8", subdiv=2, glow=True)
            node.cyl(0.05, 0.06, (0, 0, 0.08), BRASS, segs=6)
            node.build(root, loc=p)
    light(root, (0, -0.5, 1.8), "#9fd8e8", 4, 0.6, halo=False)


def quill_desk(root):
    """Talespinner: a writing desk where a quill writes a story all by itself, line after line,
    and turns the page when it runs out of room. The runtime moves `quill` (its origin is the
    nib) along the lines `ink0..5`, which grow as it writes; `leaf` is the page that turns."""
    m = Model("quill_desk", seed=34)
    m.box((1.5, 0.85, 0.08), (0, 0, 0.82), P.WALNUT)                            # desk top
    for x in (-0.66, 0.66):
        for y in (-0.34, 0.34):
            m.box((0.08, 0.08, 0.82), (x, y, 0.41), P.WOOD_DARK)
    m.box((1.36, 0.06, 0.18), (0, -0.4, 0.7), P.WALNUT)                         # apron with a drawer
    m.box((0.12, 0.03, 0.04), (0, -0.44, 0.7), BRASS)
    m.box((1.5, 0.2, 0.3), (0, 0.33, 1.0), P.WALNUT)                            # a shelf at the back
    m.cyl(0.08, 0.1, (0.55, 0.3, 1.15), P.INK, segs=8)                          # ink pot
    m.cyl(0.05, 0.03, (0.55, 0.3, 1.25), "#1d1a24", segs=8)
    m.cyl(0.05, 0.2, (-0.55, 0.3, 1.15), P.WHITE, segs=6)                       # a candle
    m.ball(0.035, (-0.55, 0.3, 1.39), P.FIRE, subdiv=1, scale=(1, 1, 1.6), glow=True)
    for i, c in enumerate(P.BOOKS[:3]):                                         # finished tales, stacked
        m.box((0.4, 0.3, 0.08), (-0.12 + i * 0.02, 0.3, 1.19 + i * 0.08), c, rot=(0, 0, 0.1 * i))
    # a stool, pushed back: nobody is sitting here
    m.cyl(0.24, 0.5, (0.2, -0.95, 0), P.WOOD, segs=6)
    m.build(root)
    light(root, (-0.55, 0.2, 1.5), P.FIRE, 3, 0.6, flicker=0.6)

    book = group("tale", (0, -0.08, 0.87), parent=root)
    b = Model("tale_book")
    b.box((1.0, 0.64, 0.05), (0, 0, 0.0), "#7a2c3a")                            # cover
    b.box((0.46, 0.58, 0.05), (-0.24, 0, 0.04), PARCHMENT, rot=(0, 0.04, 0))
    b.box((0.46, 0.58, 0.05), (0.24, 0, 0.04), PARCHMENT, rot=(0, -0.04, 0))
    for i in range(6):                                                          # the left page, already written
        b.box((0.34 - (i == 5) * 0.14, 0.012, 0.012), (-0.24 - (i == 5) * 0.07, 0.2 - i * 0.075, 0.075), "#5a4a6a")
    b.box((0.06, 0.07, 0.012), (-0.4, 0.2, 0.076), "#c8403a")                   # an illuminated capital
    b.build(book)
    x0, L = 0.07, 0.34
    for i in range(6):
        ink = Model(f"ink{i}")
        ink.box((L, 0.012, 0.012), (L / 2, 0, 0), "#5a4a6a")
        obj = ink.build(book, loc=(x0, 0.2 - i * 0.075, 0.075))
        obj["len"] = L
    leaf = Model("leaf")                                                        # hinged at the spine
    leaf.box((0.46, 0.58, 0.012), (0.24, 0, 0), PARCHMENT)
    for i in range(6):
        leaf.box((0.34, 0.012, 0.012), (0.24, 0.2 - i * 0.075, 0.008), "#5a4a6a")
    leaf.build(book, loc=(0, 0, 0.07))
    q = Model("quill")                                                          # the nib at the origin
    q.cyl(0.008, 0.06, (0, 0, 0), "#2a2530", segs=4, r_top=0.012)
    q.plank_line((0, 0, 0.05), (0.14, 0.2, 0.5), 0.012, 0.012, "#e8dcc0")
    q.ball(0.06, (0.1, 0.15, 0.4), "#f4efe2", subdiv=1, scale=(0.35, 1.9, 0.25), rot=(0.8, -0.3, -0.6))
    q.ball(0.045, (0.12, 0.17, 0.46), "#e8b24a", subdiv=1, scale=(0.3, 1.2, 0.2), rot=(0.8, -0.3, -0.6))
    obj = q.build(book, loc=(x0, 0.2, 0.09))
    obj.scale = (1.5, 1.5, 1.5)                                                 # big enough to see it write


def lunar_lander(root):
    """Reinforcement learning: a lunar lander on a pad between two yellow flags, still learning."""
    m = Model("launch_pad", seed=38)
    m.cyl(1.35, 0.08, (0, 0, -0.02), MOON, segs=10)
    for i in range(7):                                                 # craters
        a = i * 2.1
        m.cyl(0.14 + (i % 3) * 0.05, 0.04, (math.cos(a) * 0.95, math.sin(a) * 0.85, 0.04), "#a19ba9", segs=7)
    m.box((1.3, 0.8, 0.03), (0, 0, 0.07), "#6e6978")                    # the landing zone
    for x in (-0.75, 0.75):
        m.cyl(0.025, 0.9, (x, 0, 0.07), P.WHITE, segs=4)
        m.box((0.28, 0.02, 0.18), (x + 0.14, 0, 0.86), "#f0d040")
    # a tally board of attempts
    m.cyl(0.04, 1.2, (1.35, 0.4, 0), P.WOOD_DARK, segs=5)
    m.box((0.6, 0.05, 0.4), (1.35, 0.36, 1.0), P.WOOD_LIGHT)
    for i in range(9):
        x = 1.13 + (i % 5) * 0.09 + (i // 5) * 0.05
        if i % 5 == 4:
            m.plank_line((1.1 + (i // 5) * 0.5, 0.33, 0.92), (1.5 + (i // 5) * 0.5, 0.33, 1.08), 0.02, 0.01, P.INK)
        else:
            m.box((0.02, 0.01, 0.2), (x, 0.33, 1.0), P.INK)
    m.build(root)

    lander = group("lander", (0, 0, 0.09), parent=root)
    b = Model("lander_body")
    b.prism([(-0.28, 0.25), (0.28, 0.25), (0.34, 0.45), (0.2, 0.62), (-0.2, 0.62), (-0.34, 0.45)], 0.5,
            (0, 0, 0), LANDER)
    b.box((0.2, 0.03, 0.14), (0, -0.26, 0.47), P.SCREEN, glow=True)     # window
    b.cyl(0.12, 0.12, (0, 0, 0.13), P.IRON, segs=6, r_top=0.08)         # nozzle
    for sx in (-1, 1):
        b.plank_line((sx * 0.22, 0, 0.3), (sx * 0.5, 0, 0.0), 0.04, 0.04, SILVER_DARK)
        b.box((0.16, 0.2, 0.03), (sx * 0.52, 0, 0.0), SILVER)
    b.cyl(0.015, 0.25, (0.12, 0, 0.62), SILVER, segs=4)                 # antenna
    b.build(lander)
    th = Model("thrust")
    th.cyl(0.1, 0.35, (0, 0, 0), P.FIRE, segs=6, r_top=0.0, glow=True, rot=(math.pi, 0, 0))
    th.cyl(0.05, 0.22, (0, 0, 0), "#ffd070", segs=5, r_top=0.0, glow=True, rot=(math.pi, 0, 0))
    th.build(lander, loc=(0, 0, 0.13))


def lazy_corner(root):
    """lazyhttp: a hammock, a green-screen terminal on a crate and a cold coffee."""
    m = Model("lazy_corner", seed=39)
    for x in (-1.6, 1.6):
        m.cyl(0.1, 1.8, (x, 0, 0), P.WOOD_DARK, segs=6)
        m.cyl(0.13, 0.08, (x, 0, 1.8), P.WOOD, segs=6)
    # the terminal on its crate, in front of the hammock
    m.box((0.8, 0.6, 0.6), (0.6, -1.5, 0.3), P.WOOD_LIGHT)
    for z in (0.12, 0.48):
        m.box((0.82, 0.62, 0.05), (0.6, -1.5, z), P.WOOD)
    m.box((0.6, 0.55, 0.5), (0.6, -1.45, 0.86), CRT)                    # the monitor
    m.box((0.46, 0.04, 0.34), (0.6, -1.74, 0.88), "#0f2a1c")
    for i in range(4):                                                 # lines of requests, some green
        m.box((0.28 - (i % 2) * 0.1, 0.02, 0.03), (0.5 - (i % 2) * 0.05, -1.76, 1.0 - i * 0.07),
              SCREEN_GREEN if i != 2 else "#ffb86b", glow=True)
    m.box((0.5, 0.2, 0.04), (0.6, -1.9, 0.62), "#bdb192")               # keyboard
    m.cyl(0.05, 0.1, (1.05, -1.8, 0.6), P.WHITE, segs=6)                # coffee
    m.cyl(0.04, 0.01, (1.05, -1.8, 0.7), "#4a2c1e", segs=6)
    m.plank_line((0.6, -1.2, 0.9), (0.3, -0.7, 0.0), 0.03, 0.03, P.IRON) # the cable, trailing off
    m.build(root)
    cur = Model("cursor")
    cur.box((0.04, 0.02, 0.05), (0, 0, 0), SCREEN_GREEN, glow=True)
    cur.build(root, loc=(0.5, -1.77, 0.79))

    h = Model("hammock")                                               # hangs from the posts, pivots at the ropes
    for sx in (-1, 1):
        h.plank_line((sx * 1.55, 0, 0), (sx * 1.05, 0, -0.55), 0.02, 0.02, "#d9c79a")
    for i in range(9):
        x = -1.0 + i * 0.25
        z = -0.55 - math.sin(i / 8 * math.pi) * 0.35
        h.box((0.27, 0.8, 0.04), (x, 0, z), "#c8503a" if i % 2 else "#e8b24a")
    h.ball(0.2, (-0.8, 0, -0.62), P.WHITE, subdiv=1, scale=(1, 1.4, 0.5))   # a pillow
    h.build(root, loc=(0, 0, 1.6))
    light(root, (0.6, -1.9, 0.9), SCREEN_GREEN, 3, 0.6)


# --- the robot -----------------------------------------------------------------------------

def robot(root):
    """The workshop's assistant: mustard paint, one big eye, a plaster on its head from last
    Tuesday, and feet slightly too big for it. Faces -y. The runtime moves the whole thing and
    swings robot_hips, robot_head, antenna, arm_l/arm_r and leg_l/leg_r."""
    hips = group("robot_hips", (0, 0, 0.42), parent=root)

    t = Model("robot_torso", seed=40)
    t.box((0.56, 0.42, 0.5), (0, 0, 0.27), ROBOT, taper=0.9)
    t.box((0.6, 0.46, 0.08), (0, 0, 0.04), ROBOT_DARK)                   # waist band
    t.box((0.3, 0.04, 0.2), (0, -0.21, 0.3), ROBOT_FACE)                 # chest panel
    for i, c in enumerate(("#e8b24a", "#e46f5a", EYE)):
        t.box((0.05, 0.03, 0.05), (-0.08 + i * 0.08, -0.235, 0.34), c, glow=True)
    t.cyl(0.04, 0.03, (0.18, -0.22, 0.14), PARCHMENT, segs=6, rot=(math.pi / 2, 0, 0))   # a gauge
    for x in (-0.24, 0.24):                                              # rivets
        for z in (0.12, 0.42):
            t.ball(0.02, (x, -0.2, z), ROBOT_DARK, subdiv=1)
    t.box((0.18, 0.1, 0.24), (0, 0.24, 0.3), P.IRON)                     # battery pack
    t.cyl(0.03, 0.1, (0.05, 0.3, 0.42), "#e46f5a", segs=5)
    t.cyl(0.12, 0.08, (0, 0, 0.52), P.IRON, segs=6)                      # neck
    t.build(hips)
    # on Patch Tuesday its chest panel shows how the update's going (the runtime fills the bar)
    upd = group("robot_update", (0, -0.24, 0.3), parent=hips)
    u = Model("robot_update_frame")
    u.box((0.3, 0.012, 0.2), (0, 0, 0), ROBOT_FACE)
    u.box((0.26, 0.014, 0.07), (0, -0.002, -0.02), P.WHITE)
    u.box((0.24, 0.016, 0.05), (0, -0.004, -0.02), ROBOT_FACE)
    for i in range(3):                                                    # "please wait", in dots
        u.box((0.025, 0.016, 0.025), (-0.04 + i * 0.04, -0.004, 0.055), EYE, glow=True)
    u.build(upd)
    bar = group("robot_bar", (-0.12, -0.012, -0.02), parent=upd)
    b = Model("robot_bar_fill")
    b.box((0.24, 0.01, 0.04), (0.12, 0, 0), SCREEN_GREEN, glow=True)
    b.build(bar)

    head = group("robot_head", (0, 0, 0.58), parent=hips)
    h = Model("robot_headshell", seed=41)
    h.ball(0.24, (0, 0, 0.17), ROBOT, subdiv=2, scale=(1.15, 0.95, 0.85))
    h.cyl(0.14, 0.06, (0, -0.2, 0.17), ROBOT_FACE, segs=10, rot=(math.pi / 2, 0, 0))   # eye socket
    h.cyl(0.1, 0.04, (0, -0.23, 0.17), EYE, segs=10, rot=(math.pi / 2, 0, 0), glow=True)
    h.cyl(0.035, 0.02, (0.03, -0.255, 0.19), P.WHITE, segs=6, rot=(math.pi / 2, 0, 0))  # glint
    for sx in (-1, 1):                                                   # ear bolts
        h.cyl(0.06, 0.08, (sx * 0.27, 0, 0.17), ROBOT_DARK, segs=6, rot=(0, math.pi / 2, 0))
    # a sticking plaster on its forehead, from a door frame it didn't see coming
    h.box((0.16, 0.03, 0.05), (-0.1, -0.16, 0.33), PLASTER_TAPE, rot=(0.6, 0.5, 0.1))
    h.box((0.16, 0.03, 0.05), (-0.1, -0.162, 0.33), PLASTER_TAPE, rot=(0.6, -0.5, -0.1))
    h.box((0.04, 0.02, 0.03), (0.05, -0.2, 0.06), P.INK)                 # a small dent of a mouth
    h.build(head)

    ant = Model("antenna")
    ant.cyl(0.015, 0.26, (0, 0, 0), P.IRON, segs=4)
    ant.ball(0.05, (0, 0, 0.28), BULB, subdiv=1, glow=True)
    obj = ant.build(head, loc=(0.06, 0.02, 0.36))
    obj.rotation_euler = (0, 0.15, 0)

    for sx, name in ((1, "arm_l"), (-1, "arm_r")):                       # left is +x (it faces -y)
        a = Model(name)
        a.ball(0.075, (0, 0, 0), ROBOT_DARK, subdiv=1)
        a.cyl(0.045, 0.34, (0, 0, -0.36), P.IRON, segs=5)
        a.box((0.1, 0.1, 0.1), (0, 0, -0.4), ROBOT, rot=(0, 0, 0))
        for dy in (-0.04, 0.04):                                         # two-finger clamp
            a.box((0.03, 0.03, 0.1), (0, dy, -0.48), P.IRON)
        if sx < 0:                                                       # it's never without its wrench
            a.box((0.04, 0.3, 0.03), (0, -0.14, -0.48), SILVER_DARK)
            a.cyl(0.05, 0.03, (0, -0.3, -0.495), SILVER_DARK, segs=6)
        a.build(hips, loc=(sx * 0.34, 0, 0.42))

    for sx, name in ((1, "leg_l"), (-1, "leg_r")):
        g = Model(name)
        g.cyl(0.06, 0.28, (0, 0, -0.3), P.IRON, segs=5)
        g.ball(0.07, (0, 0, -0.02), ROBOT_DARK, subdiv=1)
        g.box((0.2, 0.34, 0.1), (0, -0.05, -0.37), ROBOT_DARK)          # big, flat, trip-prone feet
        g.box((0.21, 0.35, 0.03), (0, -0.05, -0.415), P.IRON)
        g.build(hips, loc=(sx * 0.14, 0, 0.0))


# --- layout --------------------------------------------------------------------------------

# where each project stands in the room: (id, x, y, facing, builder)
EXHIBITS = [
    ("argentum", -5.2, 3.2, 0.25, argentum),
    ("transformer", -2.0, 4.1, 0.0, network),
    ("mana", 1.9, 3.1, 0.0, press),
    ("lander", 5.0, 0.8, 0.0, lunar_lander),
    ("carcassonne", -1.2, 0.6, 0.0, carcassonne),
    ("lazyhttp", 4.6, -2.4, 0.0, lazy_corner),
    ("music", -0.9, -3.8, 0.2, gramophone),
    ("talespinner", -4.9, -2.7, 0.35, quill_desk),
]

# the robot's walking graph: a ring round the game table, and a stand at every exhibit
WAYPOINTS = {
    "A": ((-3.4, 1.9), "B F"),
    "B": ((0.4, 1.9), "C"),
    "C": ((3.0, 2.0), "D"),
    "D": ((3.0, -0.9), "E"),
    "E": ((0.3, -1.6), "F"),
    "F": ((-3.4, -1.2), ""),
    "argentum": ((-4.2, 2.0), "A"),
    "transformer": ((-2.0, 2.9), "A B"),
    "mana": ((1.4, 2.0), "B C"),
    "lander": ((3.3, 0.5), "C D"),
    "carcassonne": ((-1.2, -0.8), "E F"),
    "lazyhttp": ((2.4, -3.1), "E D"),
    "music": ((-0.9, -2.6), "E F"),
    "talespinner": ((-3.9, -1.9), "F"),
    "home": ((1.5, -3.5), "E"),
}


def charging_dock(root):
    """Where the robot goes to rest: a plug-in pad with a cable to the wall."""
    m = Model("dock", seed=42)
    m.box((1.0, 0.8, 0.08), (0, 0, 0.04), P.IRON)
    m.box((0.8, 0.6, 0.02), (0, 0, 0.09), "#e8b24a")
    for i in range(4):
        m.box((0.1, 0.62, 0.021), (-0.3 + i * 0.2, 0, 0.1), P.INK)   # hazard stripes
    m.box((0.2, 0.16, 0.9), (0.55, 0.3, 0.45), P.IRON)
    m.box((0.04, 0.14, 0.14), (0.44, 0.3, 0.8), EYE, glow=True)
    m.plank_line((0.6, 0.35, 0.2), (1.2, -1.6, 0.03), 0.04, 0.04, P.IRON)
    m.build(root)


def clutter(root):
    m = Model("clutter", seed=43)
    m.box((0.7, 0.4, 0.35), (1.7, -4.3, 0.18), P.RED)                     # toolbox
    m.box((0.5, 0.06, 0.06), (1.7, -4.3, 0.42), P.IRON)
    m.cyl(0.12, 0.25, (2.35, -4.4, 0), "#6a8a6a", segs=6, r_top=0.08)     # oil can
    m.plank_line((2.35, -4.4, 0.25), (2.55, -4.5, 0.4), 0.03, 0.03, "#6a8a6a")
    for i, (x, y) in enumerate([(0.2, -1.0), (2.6, 1.2), (-3.0, 0.2)]):   # dropped bolts, everywhere
        m.cyl(0.06, 0.03, (x, y, 0), BRASS, segs=6)
    m.cyl(0.4, 0.95, (-6.3, 4.3, 0), P.WOOD, segs=8)                       # a barrel of offcuts
    for i in range(3):
        m.box((0.08, 0.08, 0.6), (-6.3 + i * 0.1 - 0.1, 4.3, 1.0), P.WOOD_LIGHT, rot=(0.2 * (i - 1), 0.1, 0))
    m.build(root)


# --- Saturdays: the boat ---------------------------------------------------------------------------

BOAT = (5.1, 2.75)                  # where it stands on its trestles, bow to the east
VINCENT_BENCH = (5.0, 3.6)          # and where he works at it, his back to the bench
BOAT_STAGES = 6                     # one a Saturday: keel, ribs, planks, more planks, paint, done

_XS = [-1.0, -0.65, -0.25, 0.15, 0.55, 0.85, 1.08]
_HW = [0.3, 0.38, 0.41, 0.39, 0.31, 0.18, 0.03]


def _outline(scale: float, x0: float, y0: float):
    """The hull's plan at one height: starboard from the transom to the bow, then back along port."""
    side = [(x0 + x, y0 - hw * scale) for x, hw in zip(_XS, _HW)]
    return side + [(x0 + x, y0 + hw * scale) for x, hw in reversed(list(zip(_XS, _HW)))]


def _hull(m: Model, stage: int, x0: float, y0: float):
    """The boat as it stands after `stage` Saturdays' work (0: just the keel on its trestles)."""
    keel, mid, top = 0.62, 0.84, 1.04
    for dx in (-0.6, 0.6):                                               # the trestles
        m.box((0.08, 0.9, 0.08), (x0 + dx, y0, keel - 0.04), P.WOOD)
        for s in (-1, 1):
            m.plank_line((x0 + dx, y0 + s * 0.4, 0), (x0 + dx, y0 + s * 0.3, keel - 0.08), 0.07, 0.07, P.WOOD_DARK)
    m.plank_line((x0 - 1.0, y0, keel), (x0 + 0.85, y0, keel), 0.08, 0.08, P.WOOD_LIGHT)            # keel…
    m.plank_line((x0 + 0.85, y0, keel), (x0 + 1.12, y0, top + 0.08), 0.07, 0.07, P.WOOD_LIGHT)     # …and stem
    m.box((0.05, 0.62, top - keel), (x0 - 1.0, y0, (top + keel) / 2), P.PLANK)                     # the transom
    if stage >= 1 and stage < 4:                                          # ribs: the frames she's planked on
        for x, hw in zip(_XS[1:5], _HW[1:5]):
            for s in (-1, 1):
                m.plank_line((x0 + x, y0 + s * hw * 0.45, keel), (x0 + x, y0 + s * hw, top), 0.04, 0.04, P.WOOD_LIGHT)
            m.plank_line((x0 + x, y0 - hw * 0.45, keel), (x0 + x, y0 + hw * 0.45, keel), 0.04, 0.04, P.WOOD_LIGHT)
    if stage >= 2:
        paint = stage >= 4
        low = "#2f6a6a" if paint else P.PLANK
        up = "#2f6a6a" if paint else P.WOOD_LIGHT
        m.slab(_outline(0.45, x0, y0), keel, mid, low, top=_outline(0.82, x0, y0))
        if stage >= 3:
            m.slab(_outline(0.82, x0, y0), mid, top, up, top=_outline(1.0, x0, y0))
            m.slab(_outline(0.93, x0, y0), top - 0.03, top + 0.002, P.WOOD_DARK)                    # inside her, shaded
            m.slab(_outline(1.03, x0, y0), top, top + 0.03, P.WHITE if paint else P.WOOD)          # the gunwale
        if paint:
            m.slab(_outline(0.9, x0, y0), mid + 0.07, mid + 0.1, P.WHITE, top=_outline(0.93, x0, y0))  # a white stripe
    if stage >= 5:                                                        # done: seats, oars, a name
        for x in (-0.55, 0.25):
            m.box((0.18, 0.72, 0.04), (x0 + x, y0, top - 0.06), P.WOOD_LIGHT)
        for s in (-1, 1):
            m.plank_line((x0 - 0.8, y0 + s * 0.12, top + 0.04), (x0 + 0.7, y0 + s * 0.2, top + 0.05), 0.04, 0.04, P.WOOD)
            m.box((0.3, 0.1, 0.02), (x0 + 0.8, y0 + s * 0.2, top + 0.05), P.WOOD)
        m.box((0.02, 0.4, 0.08), (x0 - 1.03, y0, top - 0.12), P.WHITE)                               # her name
        m.box((0.022, 0.3, 0.03), (x0 - 1.035, y0, top - 0.12), P.INK)
        m.cyl(0.05, 0.06, (x0 + 1.12, y0, top + 0.1), "#c8303a", segs=6)                              # a ribbon on the bow


def boat(root):
    """The boat Vincent is building in the workshop, one stage of it for each Saturday he's put in."""
    x0, y0 = BOAT
    g = group("boat_build", parent=root, id="boat_build")
    for stage in range(BOAT_STAGES):
        st = group(f"boat_stage_{stage}", parent=g, stage=stage)
        m = Model(f"boat_stage_{stage}", seed=60 + stage)
        _hull(m, stage, x0, y0)
        m.build(st)
    # a Saturday's shavings, fresh round the trestles and under the bench
    f = group("sawdust_fresh", parent=root)
    sd = Model("sawdust_fresh", seed=61)
    for _ in range(40):
        x = x0 + sd.rng.uniform(-1.4, 1.5)
        y = y0 + sd.rng.uniform(-0.7, 1.4)
        sd.box((0.1, 0.04, 0.015), (x, y, 0.008), "#e8c890" if sd.rng.random() < 0.6 else "#d4a868", rot=(0, 0, sd.rng.uniform(0, 3)))
    sd.cyl(0.55, 0.02, (x0 + 0.3, y0 + 0.9, 0), "#d4a868", segs=8)
    sd.build(f)
    # and him, in his apron with a plane in his right hand, facing her across the trestles
    vx, vy = VINCENT_BENCH
    v = group("vincent_workshop", (vx, vy, 0), parent=root, id="vincent_workshop")
    characters.vincent_standing(v, "bench", apron=True)
    arm = next(o for o in v.children_recursive if o.name.startswith("bench_arm_r"))
    pl = Model("bench_plane")
    pl.box((0.12, 0.3, 0.1), (0, -0.1, -0.66), P.WOOD_LIGHT)
    pl.box((0.05, 0.08, 0.09), (0, -0.2, -0.58), P.WOOD_DARK)
    pl.box((0.04, 0.04, 0.12), (0, 0.0, -0.6), "#c8303a")
    pl.build(arm)


def build():
    root = group("workshop_interior")
    shell(root)
    window(root)
    door(root)
    tool_wall(root)
    shelves(root)
    lamps(root)
    clutter(root)
    for name, x, y, rot, make in EXHIBITS:
        make(group(f"project_{name}", (x, y, 0), rot_z=rot, parent=root, id=f"project_{name}"))
    for name, ((x, y), links) in WAYPOINTS.items():
        group(f"waypoint_{name}", (x, y, 0), parent=root, waypoint=name, links=links)
    hx, hy = WAYPOINTS["home"][0]
    charging_dock(group("robot_dock", (hx, hy, 0), parent=root))
    robot(group("robot", (hx, hy, 0), parent=root, id="robot"))
    boat(root)
    return root
