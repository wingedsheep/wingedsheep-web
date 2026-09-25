"""The first stretch of the trail: studying artificial intelligence in Utrecht, and the jobs
alongside it. Exported as career-student.glb.

At the back stands the Minnaert building on the Uithof, rust red with ridges running across
its walls and its name in white letters along the ground floor, with a grey slab of the old
campus behind it. The young trees in front were planted with it. Young Vincent sits at a picnic
table with a laptop, where a lunar lander from OpenAI Gym keeps trying to land (the runtime
draws the game on `screen_lander`). By the entrance a notice board carries the news that came
just after: DQN playing Atari, AlphaGo, a machine learning course, OpenAI Five.

A red bike path leads east, past a bike with a computer tower on its rack (Studentaanhuis:
fixing computers all over Arnhem), to a brick house in Velp: ZorgDigi's table out front, with
the illustrator drawing and a PHP elephant by the laptop, the carers' rota on the wall, and
uniQ Development's whiteboard, where Vincent teaches two new programmers.

x = east, y = north, z = up; the camera looks in from the south-south-east.
"""
from __future__ import annotations

import math

import palette as P
from kit import Model, group, light

from career.base import YOUNG_VINCENT, Look, bike, bush, clouds, letters, person, plinth, tree

RUST = "#b5482c"
RUST_DARK = "#973a24"
RUST_LIGHT = "#c65a38"
SLATE = "#3d3a45"
GLASS = "#2a3440"
GLASS_LIGHT = "#8fb3c4"
CONCRETE = "#b9b4ab"
CONCRETE_DARK = "#8f8a82"
PAVING = "#bdb5a8"
BIKE_PATH = "#a0524a"
MUD = "#8a6a48"
PUDDLE = "#6d8fa8"
BRICK = "#7a4638"
BRICK_DARK = "#633629"
ROOF_TILE = "#4a4652"
FRAME_WHITE = "#efe9df"
PHP = "#8993be"
SAPLING = "#8a7a6a"

RX, RY, CENTRE = 15.0, 10.0, (0.5, -0.5)
FACADE = 1.5            # the Minnaert's south wall
SCALE = 0.75            # people and furniture, against the buildings


def minnaert(root):
    g = group("minnaert", parent=root, id="minnaert")
    m = Model("minnaert_walls", seed=81)
    d = 3.0
    yc = FACADE + d / 2
    # the west end, taller, with rows of little windows
    m.box((2.6, d, 3.8), (-10.8, yc, 1.9), RUST)
    for r in range(4):
        for c in range(4):
            m.box((0.34, 0.06, 0.22), (-11.8 + c * 0.6, FACADE - 0.02, 1.2 + r * 0.6), GLASS)
    # the long middle wing: glass along the ground, a row of small windows, the dark roof rising west
    m.box((8.0, d, 2.6), (-5.5, yc, 1.3), RUST)
    m.box((8.0, 0.1, 0.55), (-5.5, FACADE - 0.04, 0.3), GLASS)
    for k in range(9):
        m.box((0.36, 0.06, 0.44), (-4.9 + k * 0.62, FACADE - 0.02, 1.75), GLASS)
    m.prism([(-9.5, 2.6), (-6.2, 2.6), (-9.5, 3.8)], d - 0.4, (0, yc, 0), SLATE)
    for x in (-8.9, -8.1):
        m.box((0.4, 0.8, 0.08), (x, yc, 3.3), GLASS_LIGHT, rot=(0, math.atan2(1.2, 3.3), 0))
    # the east block: up on a dark, recessed ground floor, with its long ribbon of windows
    m.box((7.2, d, 3.1), (2.5, yc, 1.3 + 1.55), RUST)
    m.box((7.0, d - 0.8, 1.3), (2.5, yc + 0.4, 0.65), GLASS)
    for x in (-0.9, 1.3, 3.7, 5.9):
        m.box((0.28, 0.28, 1.3), (x, FACADE + 0.9, 0.65), CONCRETE_DARK)                   # columns
    m.box((5.2, 0.1, 0.7), (3.1, FACADE - 0.04, 2.85), GLASS_LIGHT)
    for k in range(14):
        m.box((0.05, 0.14, 0.7), (0.55 + k * 0.4, FACADE - 0.07, 2.85), FRAME_WHITE)     # mullions
    m.box((0.5, 0.1, 0.4), (5.6, FACADE - 0.04, 2.0), SLATE)                            # a vent
    # the ridges, sweeping up across the walls like wind in the grass
    ridges = [(-12.0, 0.4, 3.0, 3.1), (-9.0, 0.5, 4.0, 1.7), (-6.4, 0.6, 3.6, 1.5), (-3.6, 0.5, 4.0, 1.7),
              (-1.2, 1.5, 3.4, 2.6), (1.2, 1.6, 3.4, 2.4), (3.4, 1.5, 3.0, 2.6)]
    for x0, z0, length, rise in ridges:
        prev = None
        for i in range(11):
            t = i / 10
            x = x0 + t * length
            z = z0 + t * rise + 0.28 * math.sin(t * math.tau)
            top = 4.35 if x > -1.1 else (3.75 if x < -9.5 else 2.55)
            p = (x, FACADE - 0.06, min(z, top))
            if prev:
                m.plank_line(prev, p, 0.16, 0.1, RUST_DARK)
            prev = p
    # two more round the corner, on the east wall
    for y0 in (FACADE + 0.4, FACADE + 1.6):
        prev = None
        for i in range(7):
            t = i / 6
            p = (6.16, y0 + t * 1.1, 1.6 + t * 2.4 + 0.2 * math.sin(t * math.tau))
            if prev:
                m.plank_line(prev, p, 0.16, 0.1, RUST_DARK)
            prev = p
    m.box((7.4, d + 0.1, 0.1), (2.5, yc, 4.44), RUST_LIGHT)                              # parapets
    m.box((8.1, d + 0.1, 0.1), (-5.5, yc, 2.64), RUST_LIGHT)
    m.box((2.7, d + 0.1, 0.1), (-10.8, yc, 3.84), RUST_LIGHT)
    m.build(g)

    sign = Model("minnaert_letters")
    width = letters(sign, "MINNAERT", (0, 0, 0), 0.12, 0.14, FRAME_WHITE)
    sign.build(g, loc=(2.5 - width / 2, FACADE + 0.35, 0.0))

    # the old campus behind: a grey slab with bands of windows
    s = Model("uithof_slab", seed=82)
    s.box((8.5, 2.4, 6.8), (-1.0, 6.6, 3.4), CONCRETE)
    for k in range(7):
        s.box((8.3, 0.08, 0.36), (-1.0, 5.38, 1.2 + k * 0.78), GLASS)
    s.box((1.6, 1.4, 0.7), (1.5, 6.6, 7.15), CONCRETE_DARK)
    s.build(root)


def grounds(root):
    """Paving along the front, the bike path, the field with its muddy patch and puddle, and
    the row of young trees."""
    m = Model("grounds", seed=83)
    m.box((19.5, 1.5, 0.05), (-2.5, FACADE - 0.75, 0.025), PAVING)
    # the red bike path, from the Minnaert's door east to Velp and off the edge
    path = [(6.3, 0.6), (7.5, -1.6), (9.5, -3.6), (12.0, -4.4), (15.5, -4.8)]
    for (ax, ay), (bx, by) in zip(path, path[1:]):
        m.box((math.hypot(bx - ax, by - ay), 1.0, 0.04), ((ax + bx) / 2, (ay + by) / 2, 0.02), BIKE_PATH,
              rot=(0, 0, math.atan2(by - ay, bx - ax)))
        m.cyl(0.5, 0.04, (bx, by, 0.0), BIKE_PATH, segs=8)
    m.slab([(math.cos(a) * 3.8 - 2.5, math.sin(a) * 1.7 - 4.3) for a in (i / 14 * math.tau for i in range(14))],
           0.0, 0.03, MUD)
    m.slab([(math.cos(a) * 2.2 - 2.2, math.sin(a) * 0.8 - 4.2) for a in (i / 12 * math.tau for i in range(12))],
           0.0, 0.045, PUDDLE)
    for x, w, h in ((-3.4, 0.5, 0.3), (-2.7, 0.9, 0.45), (-1.7, 0.6, 0.4)):              # the building, upside down
        m.box((w, h, 0.01), (x, -3.75 - h / 2, 0.05), RUST)
    m.build(root)

    # the edges of the Uithof were still green: a few old trees and bushes round the rim
    f = Model("greenery", seed=91)
    for x, y, s in ((-13.0, -2.5, 1.1), (-11.5, -6.5, 0.9), (-12.6, 4.6, 1.0), (7.3, 5.8, 1.2), (4.5, -7.8, 0.8), (-5.5, -8.6, 0.9)):
        tree(f, (x, y, 0), s)
    for x, y, s in ((-9.8, -7.8, 1.0), (1.5, -8.8, 0.9), (-13.8, 1.2, 0.8), (14.0, 2.0, 0.9), (8.0, 1.2, 0.7), (-0.8, -6.5, 0.6)):
        bush(f, (x, y, 0), s)
    f.build(root)

    t = Model("saplings", seed=84)
    for x in (-11.5, -9.2, -6.9, -4.8, 1.2, 3.4, 5.6):
        y = 0.35 + t.rng.uniform(-0.1, 0.1)
        h = t.rng.uniform(1.8, 2.3)
        t.cyl(0.055, h, (x, y, 0), SAPLING, segs=5, r_top=0.03)
        for k in range(3):
            a = k * 2.2 + t.rng.uniform(-0.4, 0.4)
            z = h * (0.55 + k * 0.13)
            t.plank_line((x, y, z), (x + math.cos(a) * 0.4, y + math.sin(a) * 0.4, z + 0.45), 0.03, 0.03, SAPLING)
        t.cyl(0.25, 0.03, (x, y, 0.0), MUD, segs=6)
    t.build(root)

    for x in (-7.5, 6.8):                                                                # street lamps
        lamp = Model("lamp_post")
        lamp.cyl(0.06, 2.6, (x, 0.9, 0), P.IRON, segs=5)
        lamp.box((0.5, 0.14, 0.08), (x - 0.2, 0.9, 2.6), P.IRON)
        lamp.box((0.3, 0.16, 0.06), (x - 0.35, 0.9, 2.54), P.LANTERN, glow=True)
        lamp.build(root)
        light(root, (x - 0.35, 0.9, 2.4), P.WARM_LIGHT, 4.5)


def bike_racks(root):
    """Bikes parked along the wall, as at any Dutch university."""
    frames = ["#2f3a3a", "#6a2a2a", "#23384f", "#2f3a3a", "#4a4a4a"]
    for k, c in enumerate(frames):
        bike(root, f"parked_{k}", (-3.9 + k * 0.55, FACADE - 0.5, 0), rot_z=math.pi / 2 + 0.08 * (k % 2), frame=c, scale=SCALE)


def picnic(root):
    """Young Vincent at a picnic table in front of the Minnaert, a laptop open in front of him."""
    g = group("picnic", (-8.2, -3.4, 0), rot_z=0.15, parent=root)
    g.scale = (SCALE, SCALE, SCALE)
    m = Model("picnic_table", seed=85)
    m.box((2.2, 1.0, 0.08), (0, 0, 0.95), P.WOOD_LIGHT)
    for y in (-0.8, 0.8):
        m.box((2.2, 0.35, 0.07), (0, y, 0.5), P.WOOD)                                  # benches
    for x in (-0.85, 0.85):
        for s in (-1, 1):
            m.plank_line((x, s * 0.95, 0.0), (x, s * 0.1, 0.92), 0.1, 0.08, P.WOOD_DARK)
    # a backpack, and a coffee in a paper cup
    m.box((0.4, 0.3, 0.5), (-0.8, -0.8, 0.8), "#6a3f2a")
    m.cyl(0.07, 0.18, (-0.55, 0.15, 0.99), P.WHITE, segs=6, r_top=0.08)
    m.build(g)
    person(g, "young_vincent", (0.35, -0.8, 0.0), rot_z=math.pi, look=YOUNG_VINCENT, pose="sit", arms="forward",
           id="young_vincent")

    lap = group("laptop", (0.55, -0.1, 0.99), parent=g, id="laptop")
    b = Model("laptop_base")
    b.box((0.72, 0.5, 0.03), (0, 0, 0.015), "#b9bcc4")
    b.box((0.6, 0.26, 0.005), (0, -0.04, 0.033), "#3a3a44")                             # keys
    b.build(lap)
    lid = group("laptop_lid", (0, 0.24, 0.03), parent=lap)
    lid.rotation_euler = (-0.28, 0, 0)
    back = Model("laptop_back")
    back.box((0.72, 0.03, 0.48), (0, 0.0, 0.24), "#b9bcc4")
    back.build(lid)
    # the display faces the one typing (-y here; the table is turned round so that's north)
    scr = Model("screen_lander")
    scr.box((0.64, 0.01, 0.4), (0, 0, 0), P.SCREEN, glow=True)
    scr.build(lid, loc=(0, -0.02, 0.25))
    light(g, (0.55, -0.4, 1.3), P.SCREEN, 2.0, 0.4, halo=False)


def notice_board(root):
    """By the entrance: the news from just after graduating, pinned to the cork."""
    g = group("noticeboard", (-0.9, 0.55, 0), parent=root, id="noticeboard")
    m = Model("board", seed=86)
    for x in (-0.8, 0.8):
        m.cyl(0.05, 1.7, (x, 0, 0), P.IRON, segs=5)
    m.box((1.8, 0.08, 1.05), (0, 0, 1.2), "#b98a55")
    m.box((1.9, 0.1, 0.08), (0, 0, 1.76), P.WOOD_DARK)
    # Breakout (DQN on Atari): rows of coloured bricks and a paddle
    px, pz = -0.52, 1.25
    m.box((0.5, 0.02, 0.62), (px, -0.05, pz), P.INK)
    for r, c in enumerate(("#e46f5a", "#e8b24a", "#6aa74f", "#43b3d9")):
        m.box((0.42, 0.025, 0.05), (px, -0.06, pz + 0.22 - r * 0.07), c)
    m.box((0.12, 0.025, 0.03), (px + 0.08, -0.06, pz - 0.24), P.WHITE)
    m.box((0.03, 0.025, 0.03), (px - 0.06, -0.06, pz - 0.1), P.WHITE)
    # AlphaGo: a go board with stones
    gx, gz = 0.05, 1.3
    m.box((0.46, 0.02, 0.46), (gx, -0.05, gz), "#dcb56a")
    for i, (dx, dz) in enumerate(((-0.1, 0.05), (0.05, -0.1), (0.12, 0.08), (-0.05, -0.05), (0.0, 0.12), (0.1, -0.02))):
        m.cyl(0.035, 0.02, (gx + dx, -0.06, gz + dz), P.INK if i % 2 else P.WHITE, segs=6, rot=(math.pi / 2, 0, 0))
    # OpenAI Five: a dark red poster with five little heroes
    fx, fz = 0.6, 1.2
    m.box((0.44, 0.02, 0.6), (fx, -0.05, fz), "#6a2230")
    for k in range(5):
        m.box((0.05, 0.025, 0.1), (fx - 0.16 + k * 0.08, -0.06, fz - 0.05), "#e8b24a")
    m.box((0.3, 0.025, 0.04), (fx, -0.06, fz + 0.18), P.WHITE)
    # Coursera's Machine Learning course: a small blue flyer under the go board
    m.box((0.34, 0.02, 0.18), (gx, -0.05, 0.86), "#2f5d8c")
    for k in range(2):
        m.box((0.24 - k * 0.08, 0.025, 0.025), (gx - 0.03 - k * 0.04, -0.06, 0.9 - k * 0.06), P.WHITE)
    for x in (px, gx, fx):
        m.ball(0.025, (x, -0.07, 1.62 if x != gx else 1.52), P.RED, subdiv=1)              # pins
    m.build(g)


def studentaanhuis(root):
    """A bike on the path to Arnhem, a computer tower strapped on the rack and a toolbox in the
    crate: fixing whatever was acting up in people's houses."""
    b = bike(root, "service_bike", (7.9, -3.4, 0), rot_z=-0.45, frame="#23384f", scale=SCALE, id="studentaanhuis")
    m = Model("service_load", seed=87)
    m.box((0.4, 0.2, 0.45), (-0.45, 0, 1.05), "#d9d5cf")                                # the tower
    m.box((0.03, 0.14, 0.03), (-0.24, -0.02, 1.2), "#43b3d9")                             # its power light
    m.box((0.04, 0.16, 0.08), (-0.24, 0.0, 1.05), "#8d8a93")                             # drive bay
    m.plank_line((-0.45, -0.11, 1.28), (-0.45, -0.11, 0.8), 0.03, 0.02, "#e46f5a")       # strap
    m.box((0.36, 0.34, 0.26), (0.62, 0, 0.95), "#6a3f2a")                                # crate
    m.box((0.3, 0.2, 0.14), (0.62, 0, 1.12), P.RED)                                      # toolbox
    m.build(b)
    # an ANWB mushroom: white, with the way to Arnhem in red
    s = Model("paddestoel")
    s.cyl(0.2, 0.5, (9.6, -5.0, 0), P.WHITE, segs=8)
    s.cyl(0.32, 0.2, (9.6, -5.0, 0.5), P.WHITE, segs=8, r_top=0.12)
    for k in range(4):
        a = k / 4 * math.tau + 0.4
        s.box((0.08, 0.02, 0.06), (9.6 + math.cos(a) * 0.29, -5.0 + math.sin(a) * 0.29, 0.6), P.RED, rot=(0, 0, a + math.pi / 2))
    s.build(root)


def velp(root):
    """A brick house in Velp: uniQ Development, with ZorgDigi's table out front."""
    hx, hy = 11.2, 3.2
    g = group("velp_house", parent=root, id="uniq")
    m = Model("house", seed=88)
    m.box((4.2, 3.0, 3.0), (hx, hy, 1.5), BRICK)
    m.box((4.3, 3.1, 0.2), (hx, hy, 0.1), BRICK_DARK)
    m.prism([(-2.1, 0), (2.1, 0), (0, 2.0)], 3.0, (hx, hy, 3.0), BRICK)                 # gable wall
    m.gable((3.4, 4.6, 2.0), (hx, hy, 3.0), ROOF_TILE, rot=(0, 0, math.pi / 2), overhang=0.1)
    m.box((0.5, 0.5, 1.0), (hx + 0.9, hy + 0.6, 4.4), BRICK_DARK)                         # chimney
    fy = hy - 1.52
    for x, z, w, h in ((hx - 1.1, 1.3, 1.3, 1.3), (hx, 3.4, 0.8, 0.8)):                   # big window, attic window
        m.box((w + 0.14, 0.06, h + 0.14), (x, fy, z), FRAME_WHITE)
        m.box((w, 0.08, h), (x, fy - 0.01, z), "#ffd98a", glow=True)
        m.box((0.05, 0.1, h), (x, fy - 0.02, z), FRAME_WHITE)
    m.box((0.9, 0.08, 1.9), (hx + 1.1, fy, 0.95), "#2f5d8c")                             # door
    m.box((1.1, 0.06, 2.0), (hx + 1.1, fy + 0.01, 1.0), FRAME_WHITE)
    m.box((1.0, 0.06, 0.3), (hx + 0.6, fy - 0.04, 2.35), FRAME_WHITE)                     # the name board
    m.box((0.2, 0.08, 0.2), (hx + 0.3, fy - 0.06, 2.35), "#2f5d8c")
    for k in range(3):
        m.box((0.12, 0.08, 0.06), (hx + 0.55 + k * 0.17, fy - 0.06, 2.35), P.INK)
    m.build(g)

    # the rota for the carers, on the wall by the door: a grid of shifts
    rota = group("rota", parent=root, id="zorgdigi")
    r = Model("rota_board")
    rx, rz = hx - 1.1, 2.35
    r.box((1.2, 0.05, 0.62), (rx, fy - 0.04, rz), P.WHITE)
    colours = ["#43b3d9", "#e8b24a", "#6aa74f", "#e46f5a"]
    for row in range(4):
        for col in range(7):
            if (row * 3 + col * 5) % 4:
                r.box((0.13, 0.03, 0.1), (rx - 0.46 + col * 0.155, fy - 0.07, rz + 0.2 - row * 0.13), colours[(row + col) % 4])
    r.build(rota)


def zorgdigi(root):
    """ZorgDigi's table: the illustrator drawing a site, and Vincent's laptop with a PHP elephant."""
    g = group("zorgdigi_table", (10.3, -0.3, 0), rot_z=0.1, parent=root, id="zorgdigi")
    g.scale = (SCALE, SCALE, SCALE)
    m = Model("zd_table", seed=89)
    m.box((1.8, 1.1, 0.07), (0, 0, 0.95), "#e6d4b8")
    for x in (-0.8, 0.8):
        for y in (-0.45, 0.45):
            m.cyl(0.04, 0.92, (x, y, 0), P.IRON, segs=5)
    for y, s in ((0.95, 1), (-0.95, -1)):                                               # two chairs
        m.box((0.55, 0.5, 0.06), (0.35 * s, y, 0.5), P.IRON)
        m.box((0.55, 0.06, 0.6), (0.35 * s, y + 0.25 * s, 0.8), P.IRON)
        for dx in (-0.22, 0.22):
            for dy in (-0.2, 0.2):
                m.cyl(0.025, 0.5, (0.35 * s + dx, y + dy, 0), P.IRON, segs=4)
    # a drawing tablet with a sketch on it
    m.box((0.5, 0.36, 0.02), (0.3, 0.2, 1.0), P.INK, rot=(0, 0, 0.2))
    m.box((0.42, 0.28, 0.01), (0.3, 0.2, 1.012), "#f4ead3", rot=(0, 0, 0.2))
    for k in range(3):
        m.box((0.2 - k * 0.04, 0.03, 0.005), (0.28 + k * 0.02, 0.14 + k * 0.06, 1.02), "#b5562d" if k else "#2f5d8c", rot=(0, 0, 0.5 + k))
    # Vincent's laptop, facing his empty chair (he's round the back, teaching)
    m.box((0.62, 0.42, 0.03), (-0.35, -0.2, 0.99), "#3a3a44")
    m.box((0.62, 0.03, 0.4), (-0.35, 0.03, 1.2), "#3a3a44", rot=(-0.25, 0, 0))
    m.box((0.54, 0.01, 0.32), (-0.35, 0.005, 1.2), "#58c08a", glow=True, rot=(-0.25, 0, 0))
    m.build(g)
    # the elePHPant, blue and plush
    e = Model("elephpant")
    ex, ey, ez = -0.8, 0.15, 0.99
    e.ball(0.15, (ex, ey, ez + 0.14), PHP, subdiv=1, scale=(1.3, 1.0, 1.0))
    e.ball(0.11, (ex + 0.17, ey, ez + 0.24), PHP, subdiv=1)
    e.plank_line((ex + 0.26, ey, ez + 0.22), (ex + 0.32, ey, ez + 0.06), 0.05, 0.05, PHP)
    for s in (-1, 1):
        e.box((0.03, 0.12, 0.14), (ex + 0.13, ey + s * 0.1, ez + 0.26), "#7780ad", rot=(0, 0, s * 0.3))
        for dx in (-0.08, 0.08):
            e.cyl(0.045, 0.08, (ex + dx, ey + s * 0.07, ez), PHP, segs=5)
    e.build(g)
    person(g, "illustrator", (0.35, 0.95, 0.0), rot_z=0.0, look=Look(hair="#a8552a", top="#c9a23f", legs="#2e2a3a", long_hair=True),
           pose="sit", arms="forward", id="zorgdigi")


def uniq(root):
    """uniQ Development: a whiteboard in the garden, Vincent at it, two new programmers watching."""
    g = group("uniq_class", (13.2, -1.6, 0), rot_z=0.35, parent=root, id="uniq")
    g.scale = (SCALE, SCALE, SCALE)
    m = Model("whiteboard", seed=90)
    for x in (-0.9, 0.9):
        m.plank_line((x, 0.25, 0), (x, 0, 2.1), 0.07, 0.07, "#8d8a93")
        m.plank_line((x, -0.25, 0), (x, 0, 2.1), 0.07, 0.07, "#8d8a93")
    m.box((2.2, 0.06, 1.3), (0, 0, 1.55), P.WHITE)
    m.box((2.3, 0.08, 0.06), (0, 0, 0.88), "#8d8a93")
    # a few lines of code, indented, with a loop in the middle
    lines = [(0, 0.9, "#2f5d8c"), (0.15, 0.6, P.INK), (0.3, 0.7, "#c8403a"), (0.3, 0.5, P.INK), (0.15, 0.3, P.INK), (0, 0.4, "#2f5d8c")]
    for k, (indent, w, c) in enumerate(lines):
        m.box((w, 0.02, 0.07), (-0.95 + indent + w / 2, -0.04, 2.05 - k * 0.17), c)
    m.box((0.15, 0.04, 0.04), (0.6, -0.06, 0.92), "#c8403a")                             # a marker
    m.build(g)
    # the room is turned so the board faces -y; the class sits in front of it
    person(g, "teacher", (1.5, -0.5, 0), rot_z=-0.6, look=YOUNG_VINCENT, arms="point", id="uniq")
    for k, (x, look) in enumerate(((-0.7, Look(hair="#2a2024", top="#6b3f8c", legs="#3a4a6e")),
                                   (0.6, Look(hair="#c9a23f", top="#3d7a4a", legs="#2e2a3a")))):
        stool = Model(f"stool_{k}")
        stool.cyl(0.25, 0.06, (x, -2.0, 0.45), P.WOOD, segs=6)
        stool.cyl(0.06, 0.45, (x, -2.0, 0), P.WOOD_DARK, segs=5)
        stool.build(g)
        person(g, f"student_{k}", (x, -1.8, 0), rot_z=math.pi, look=look, pose="sit", id="uniq")


def build():
    root = group("room")
    plinth(root, RX, RY, seed=7, centre=CENTRE)
    clouds(root, RX, RY, seed=8, centre=CENTRE)
    minnaert(root)
    grounds(root)
    bike_racks(root)
    picnic(root)
    notice_board(root)
    studentaanhuis(root)
    velp(root)
    zorgdigi(root)
    uniq(root)
