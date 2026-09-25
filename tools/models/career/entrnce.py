"""The third stretch of the trail: the energy years at ENTRNCE, trading power so the grid can take
more sun and wind. Exported as career-entrnce.glb.

A small solarpunk neighbourhood: a row of houses with solar panels on their roofs, a heat pump and
a car on the charger, a wind turbine turning at the back, and a meadow of solar panels with sheep
grazing under them. Everything they make runs along the cables (pulses of light, sun-yellow and
wind-teal) to the transformer kiosk, which is full: on its screen (`screen_grid`) the day goes
by, and at noon the solar peak runs into the red line, unless the community battery by the road
soaks it up (its charge on `screen_soc`). At a desk under a pergola, Vincent watches Direct+ on
`screen_market`: the day-ahead prices, below zero when the sun shines.

At the back rises a mountain: colleagues climbing to an Austrian hut (off-grid, of course: solar
on the roof), two of them already on the bench outside with a beer, and a summit cross on top.

The day on the screens (DAY_SECONDS, the load and price curves) lives in
src/island/scene/diorama.ts.

x = east, y = north, z = up; the camera looks in from the south-south-east.
"""
from __future__ import annotations

import math

import fauna
import palette as P
from kit import FPS, Model, animate, group, light

from career.base import Look, bike, bush, clouds, letters, outline, person, plinth, tree

RX, RY, CENTRE = 16.0, 11.0, (0.5, -0.5)
SCALE = 0.75            # people and furniture, against the buildings
HIKER = 0.45            # the hikers, up on the mountain

BRAND = "#136aff"       # ENTRNCE blue
BRAND_NAVY = "#1a194f"
PANEL = "#23325c"
PANEL_LINE = "#3d5690"
PANEL_FRAME = "#c9ccd2"
SUN = "#ffd84a"
WIND = "#6fe0d6"
CABLE = "#3a3540"
LAWN = "#6fb84f"
PATH = "#cdb892"
KIOSK = "#6f8a72"
KIOSK_DARK = "#56705a"
BATTERY = "#e9ece8"
GLASS = "#2f3440"
PLASTER = "#ece6da"
HUT_ROOF = "#5d5866"
TURBINE = "#eef0ec"

ENTRNCE_VINCENT = Look(hair=P.HAIR, top=BRAND_NAVY, legs="#3a4a6e", beard=P.BEARD)
# colleagues, from a way off and from behind: nobody in particular (bar the one bald head)
HIKERS = [
    Look(hair="#2a2024", top="#b5562d", legs="#3b3a42"),
    Look(hair="#c9a23f", top="#3d7a4a", legs="#2e2a3a", long_hair=True),
    Look(hair="#4a3322", top="#2f5d9a", legs="#3b3a42", cap="#c8403a"),
]
BALD = Look(top="#5a5a66", legs="#2e2a3a", bald=True)
AT_THE_BENCH = Look(hair="#6b4a30", top="#8c2f39", legs="#3a4a6e")

# the mountain: stacked terraces, (centre x, centre y, rx, ry, top), and the shoulder the hut is on
TERRACES = [(-8.0, 4.0, 5.6, 3.2, 1.0), (-8.6, 4.4, 4.5, 2.6, 2.1), (-9.2, 4.8, 3.4, 2.0, 3.3),
            (-9.6, 5.1, 2.3, 1.4, 4.6)]
SHOULDERS = [(-3.9, 4.6, 2.8, 2.4, 1.0), (-4.3, 5.3, 2.3, 1.7, 2.1)]
PEAK = (-9.9, 5.3, 7.4)
HUT = (-4.4, 5.8, 2.1)

HOUSES = (2.0, 4.6, 7.2)
HOUSE_Y = 3.9
KIOSK_AT = (4.6, -0.6)
BATTERY_AT = (11.6, 0.9)
TURBINE_AT = (12.4, 6.0)
DESK = (-1.6, -5.4)

PULSE_LAP = 4.0         # seconds for a pulse to run the length of its cable


# --- the mountain ----------------------------------------------------------------------

def mountain(root):
    """Terraces of rock stepping up to the peak, grass on the lower ones, snow up top."""
    g = group("mountain", parent=root)
    m = Model("mountain", seed=301)
    for layers in (TERRACES, SHOULDERS):
        z0 = 0.0
        for k, (x, y, rx, ry, top) in enumerate(layers):
            rim = outline(rx, ry, 310 + k + (10 if layers is SHOULDERS else 0), n=20, wobble=0.08, centre=(x, y))
            foot = [(x + (px - x) * 1.12, y + (py - y) * 1.12) for px, py in rim]
            m.slab(foot, z0, top - 0.12, P.ROCK[1 + k % 3], top=rim)
            cap = P.GRASS[2] if top < 2.5 else (P.PEAK_ROCK[2] if top < 4 else P.PEAK_ROCK[3])
            m.slab(rim, top - 0.12, top, cap)
            z0 = top
    prev_top = TERRACES[-1][4]
    # the peak, with snow on it
    px, py, pz = PEAK
    m.cyl(1.6, pz - prev_top - 1.0, (px, py, prev_top), P.PEAK_ROCK[1], segs=7, r_top=0.55)
    m.cyl(0.6, 1.05, (px, py, pz - 1.05), P.SNOW, segs=7, r_top=0.05)
    for x, y, z, r in ((-10.6, 5.6, 4.62, 0.6), (-8.6, 5.9, 4.62, 0.45), (-11.0, 4.4, 3.32, 0.55), (-7.4, 5.6, 3.32, 0.4)):
        m.ball(r, (x, y, z), P.SNOW, subdiv=1, scale=(1.4, 1, 0.18), jitter=0.02)
    # boulders on the terraces
    for x, y, z, r in ((-6.2, 2.4, 1.0, 0.3), (-11.5, 2.9, 1.0, 0.35), (-7.3, 3.0, 2.1, 0.25), (-10.4, 3.4, 2.1, 0.3),
                       (-2.2, 5.9, 1.0, 0.28), (-8.9, 3.6, 3.3, 0.22)):
        m.ball(r, (x, y, z + r * 0.4), P.PEBBLE, subdiv=1, scale=(1.3, 1, 0.7), jitter=0.04)
    m.build(g)

    f = Model("mountain_pines", seed=302)
    for x, y, z, s in ((-12.2, 2.6, 1.0, 0.8), (-12.8, 4.0, 1.0, 0.7), (-5.2, 2.1, 1.0, 0.7), (-10.8, 2.2, 1.0, 0.9),
                       (-6.6, 3.2, 2.1, 0.6), (-11.9, 5.2, 2.1, 0.6), (-1.6, 6.2, 1.0, 0.7), (-2.1, 7.0, 1.0, 0.6)):
        pine(f, (x, y, z), s)
    f.build(g)

    # the summit cross
    c = Model("summit_cross")
    c.box((0.1, 0.1, 1.2), (px, py, pz + 0.5), P.WOOD_DARK)
    c.box((0.62, 0.1, 0.1), (px, py, pz + 0.82), P.WOOD_DARK)
    c.box((0.14, 0.12, 0.1), (px, py - 0.02, pz + 0.82), P.GOLD)
    c.build(root, id="summit")


def pine(m: Model, loc, size: float = 1.0):
    x, y, z = loc
    m.cyl(0.1 * size, 0.5 * size, (x, y, z), P.BARK, segs=5)
    for k, (h, r) in enumerate(((0.35, 0.75), (0.95, 0.58), (1.5, 0.38))):
        m.cyl(r * size, 0.85 * size, (x, y, z + h * size), P.PINE[k % 3], segs=7, r_top=0.04)


def steps(m: Model, a, b, n: int, width=0.7):
    """Rough stone steps from a to b (x, y, z), n of them."""
    ax, ay, az = a
    bx, by, bz = b
    turn = math.atan2(by - ay, bx - ax)
    for i in range(n):
        f = (i + 0.5) / n
        z = az + (bz - az) * (i + 1) / n
        m.box((0.45, width, z - az + 0.05), (ax + (bx - ax) * f, ay + (by - ay) * f, (az + z) / 2), P.STEP,
              rot=(0, 0, turn))


def trail(root):
    """The path up: gravel across the grass, steps onto each shoulder, red-white waymarks."""
    m = Model("trail", seed=303)
    for (x0, y0), (x1, y1), z in (((1.8, -0.5), (-1.6, 1.4), 0.0), ((-2.3, 2.9), (-2.5, 3.5), 1.0),
                                  ((-3.0, 4.2), (-4.2, 4.3), 2.1)):
        d = math.dist((x0, y0), (x1, y1))
        m.box((d + 0.5, 0.6, 0.04), ((x0 + x1) / 2, (y0 + y1) / 2, z + 0.02), P.GRAVEL[0],
              rot=(0, 0, math.atan2(y1 - y0, x1 - x0)))
    steps(m, (-1.6, 1.4, 0.0), (-2.3, 2.9, 1.0), 5)
    steps(m, (-2.5, 3.5, 1.0), (-3.0, 4.2, 2.1), 5)
    for x, y, z in ((-1.1, 1.3, 0.0), (-2.9, 3.4, 1.0)):                                # waymarks on rocks
        m.ball(0.22, (x, y, z + 0.1), P.PEBBLE, subdiv=1, scale=(1.2, 1, 0.8))
        m.box((0.16, 0.03, 0.05), (x, y - 0.2, z + 0.2), P.RED)
        m.box((0.16, 0.03, 0.05), (x, y - 0.2, z + 0.15), P.WHITE)
        m.box((0.16, 0.03, 0.05), (x, y - 0.2, z + 0.1), P.RED)
    m.build(root)


def backpack(who, color):
    b = Model(f"{who.name}_pack")
    b.box((0.48, 0.3, 0.7), (0, 0.3, 1.35), color)
    b.box((0.4, 0.12, 0.3), (0, 0.48, 1.25), color)
    b.box((0.52, 0.32, 0.12), (0, 0.3, 1.74), "#2e2a3a")
    b.build(who)


def hikers(root):
    """Colleagues on the way up, backs to us, each with a pack and a pole."""
    for k, ((x, y, z), look, pack) in enumerate((((0.6, -0.1, 0.0), HIKERS[0], "#3d7a4a"),
                                                  ((-1.0, 0.9, 0.0), HIKERS[1], "#c8403a"),
                                                  ((-2.4, 3.2, 1.0), HIKERS[2], "#e0a526"))):
        who = person(root, f"hiker_{k}", (x, y, z), rot_z=math.radians(215), look=look, scale=HIKER, id="colleagues")
        backpack(who, pack)
        pole = Model(f"hiker_{k}_pole")
        pole.plank_line((0.38, -0.05, 0.9), (0.45, -0.35, 0.0), 0.04, 0.04, "#8d8a93")
        pole.build(who)


def hut(root):
    """An Alpenverein hut on its shoulder: a white stone ground floor, dark wood above, red and
    white shutters, a balcony in the gable, solar panels on the roof, and the Austrian flag."""
    x0, y0, z0 = HUT
    g = group("hut", (x0, y0, z0), parent=root, id="hut")
    m = Model("hut_walls", seed=304)
    W, D = 2.8, 2.0
    m.box((W, D, 1.2), (0, 0, 0.6), PLASTER)
    m.box((W + 0.08, D + 0.08, 0.2), (0, 0, 0.1), P.STONE_DARK)
    m.box((W + 0.1, D + 0.1, 0.85), (0, 0, 1.62), P.WOOD_DARK)
    m.prism([(-(W + 0.1) / 2, 0), ((W + 0.1) / 2, 0), (0, 0.85)], D + 0.1, (0, 0, 2.05), P.WOOD_DARK)
    m.gable((D + 0.7, W + 0.1, 0.85), (0, 0, 2.05), HUT_ROOF, rot=(0, 0, math.pi / 2), overhang=0.3, thick=0.12)
    # solar panels on the east slope, and a chimney
    slope = math.atan2(0.85, (W + 0.1) / 2)
    m.box((0.12, 1.9, 0.9), (0.72, 0.0, 2.58), PANEL, rot=(0, -math.pi / 2 + slope, 0))
    m.box((0.5, 0.4, 0.7), (-0.6, 0.5, 2.7), P.STONE)
    fy = -D / 2 - 0.06
    # windows with shutters, the door, the balcony across the gable
    for x, z in ((-0.85, 0.65), (0.85, 0.65), (-0.75, 1.62), (0.75, 1.62)):
        m.box((0.36, 0.05, 0.4), (x, fy, z), P.LANTERN, glow=True)
        m.box((0.04, 0.06, 0.4), (x, fy - 0.01, z), P.WOOD_DARK)
        for s in (-1, 1):
            m.box((0.17, 0.05, 0.44), (x + s * 0.28, fy - 0.01, z), P.RED)
            m.box((0.12, 0.06, 0.05), (x + s * 0.28, fy - 0.02, z), P.WHITE, rot=(0, s * 0.6, 0))
    m.box((0.5, 0.06, 0.85), (0, fy, 0.43), P.WOOD)
    m.box((W + 0.3, 0.5, 0.06), (0, fy - 0.22, 1.2), P.WOOD)                           # balcony
    for k in range(12):
        m.box((0.05, 0.05, 0.4), (-(W + 0.2) / 2 + k * (W + 0.2) / 11, fy - 0.45, 1.42), P.WOOD_LIGHT)
    m.box((W + 0.3, 0.07, 0.06), (0, fy - 0.45, 1.62), P.WOOD)
    for k in range(4):                                                                   # geraniums
        m.ball(0.08, (-1.0 + k * 0.65, fy - 0.45, 1.68), P.RED if k % 2 else "#e04868", subdiv=1)
    m.box((0.7, 0.05, 0.22), (0, fy - 0.03, 2.35), P.WHITE)                              # the name board
    m.box((0.5, 0.06, 0.06), (0, fy - 0.04, 2.35), P.INK)
    # a bench against the wall and a table in front of it
    m.box((1.6, 0.3, 0.05), (-0.05, -1.35, 0.22), P.WOOD_LIGHT)
    m.box((1.5, 0.55, 0.05), (-0.05, -1.95, 0.42), P.WOOD_LIGHT)
    for x in (-0.7, 0.6):
        m.box((0.07, 0.45, 0.4), (x, -1.95, 0.2), P.WOOD_DARK)
    for k, x in enumerate((-0.35, 0.2, 0.45)):                                          # beers, and a Kaiserschmarrn
        m.cyl(0.045, 0.14, (x, -1.9 - k * 0.06, 0.445), "#e0a526", segs=6)
        m.cyl(0.047, 0.035, (x, -1.9 - k * 0.06, 0.585), P.WHITE, segs=6)
    m.cyl(0.13, 0.02, (-0.05, -2.05, 0.445), P.WHITE, segs=8)
    m.ball(0.08, (-0.05, -2.05, 0.48), "#d9a24a", subdiv=1, scale=(1.2, 1, 0.5), jitter=0.01)
    m.cyl(0.03, 2.4, (1.75, -1.1, 0), "#cfc9c0", segs=5)
    m.build(g)
    light(g, (0, fy - 0.5, 1.0), P.WARM_LIGHT, 3.0, 0.8)

    flag = Model("hut_flag")                                                            # rot-weiß-rot
    for i, c in enumerate((P.RED, P.WHITE, P.RED)):
        flag.box((0.62, 0.02, 0.13), (0.31, 0, -i * 0.13), c)
    f = flag.build(g, loc=(1.75, -1.1, 2.3))
    animate(f, "flag_idle", "rotation_euler", [(0, (0, 0, -0.2)), (1.6, (0, 0, 0.2)), (3.2, (0, 0, -0.2))])

    # two of them made it already: one raising his glass
    cheers = person(g, "bald", (-0.4, -1.35, 0), rot_z=0.0, look=BALD, pose="sit", arms="point", scale=HIKER, id="bald")
    mug = Model("bald_beer")
    mug.cyl(0.12, 0.3, (-0.72, -0.12, 1.52), "#e0a526", segs=6)
    mug.cyl(0.125, 0.08, (-0.72, -0.12, 1.82), P.WHITE, segs=6)
    mug.build(cheers)
    other = person(g, "bench_colleague", (0.4, -1.35, 0), rot_z=0.1, look=AT_THE_BENCH, pose="sit", arms="forward",
                   scale=HIKER, id="colleagues")
    backpack(other, "#2f5d9a")


# --- the neighbourhood ------------------------------------------------------------------

def solar_rows(m: Model, x, y, z, length, width, tilt, rows=2):
    """Panels on a slope tilted by `tilt` (facing -y), with the lines between the cells."""
    m.box((length, width, 0.06), (x, y, z), PANEL, rot=(tilt, 0, 0))
    n = max(2, round(length / 0.55))
    for i in range(1, n):
        m.box((0.03, width, 0.065), (x - length / 2 + i * length / n, y, z), PANEL_LINE, rot=(tilt, 0, 0))
    for j in range(1, rows):
        dy = -width / 2 + j * width / rows
        m.box((length, 0.03, 0.065), (x, y + dy * math.cos(tilt), z + dy * math.sin(tilt)), PANEL_LINE, rot=(tilt, 0, 0))


def houses(root):
    """A row of three houses, solar on every south roof, window boxes, a green roof on the shed."""
    g = group("houses", parent=root, id="trader")
    m = Model("houses", seed=305)
    walls = ("#b86a4a", "#e6d4b8", "#8a6a52")
    W, D, E, H = 2.3, 2.6, 1.9, 1.3
    tilt = math.atan2(H, D / 2)
    for k, x in enumerate(HOUSES):
        y = HOUSE_Y
        m.box((W, D, E), (x, y, E / 2), walls[k])
        m.prism([(-D / 2, 0), (D / 2, 0), (0, H)], W, (x, y, E), walls[k], rot=(0, 0, math.pi / 2))
        m.gable((W + 0.2, D, H), (x, y, E), P.PLUM_ROOF_DARK if k != 1 else P.RUST_ROOF, overhang=0.15, thick=0.14)
        solar_rows(m, x, y - D / 4 - 0.02, E + H / 2 + 0.12, W - 0.2, D / 2 * 0.95, tilt)
        fy = y - D / 2 - 0.03
        m.box((0.55, 0.06, 1.1), (x - 0.55, fy, 0.55), P.WOOD_DARK)                          # door
        m.box((0.7, 0.05, 0.6), (x + 0.5, fy, 1.0), P.LANTERN, glow=True)                    # window
        m.box((0.04, 0.06, 0.6), (x + 0.5, fy - 0.01, 1.0), P.WHITE)
        m.box((0.8, 0.2, 0.12), (x + 0.5, fy - 0.1, 0.66), P.WOOD)                           # window box
        for i in range(4):
            m.ball(0.08, (x + 0.2 + i * 0.2, fy - 0.12, 0.78), (SUN, P.LEAF[3], "#e04868", P.LEAF[2])[(i + k) % 4], subdiv=1)
        # a garden path and a lawn out front
        m.box((W, 1.2, 0.04), (x, fy - 0.6, 0.02), LAWN)
        m.box((0.5, 1.2, 0.05), (x - 0.55, fy - 0.6, 0.025), PATH)
    # a shed with a green roof by the first house
    m.box((1.1, 1.2, 1.0), (HOUSES[0] - 1.9, HOUSE_Y + 0.5, 0.5), P.WOOD)
    m.box((1.25, 1.35, 0.14), (HOUSES[0] - 1.9, HOUSE_Y + 0.5, 1.07), P.GRASS[3])
    for i in range(3):
        m.ball(0.12, (HOUSES[0] - 2.2 + i * 0.3, HOUSE_Y + 0.4, 1.17), ("#e04868", SUN, P.WHITE)[i], subdiv=1)
    # vegetable beds between the houses and the kiosk
    for x in (1.3, 2.9):
        m.box((1.3, 0.6, 0.25), (x, 0.4, 0.125), P.WOOD)
        m.box((1.2, 0.5, 0.05), (x, 0.4, 0.26), P.DIRT)
        for i in range(4):
            m.ball(0.12, (x - 0.45 + i * 0.3, 0.4, 0.34), P.LEAF[2 + i % 2], subdiv=1)
    m.build(g)


def heat_pump_and_car(root):
    """By the last house: a heat pump humming, and a car on the charger, waiting for the sun."""
    g = group("flex_home", parent=root, id="flex")
    m = Model("flex_home", seed=306)
    hx, hy = HOUSES[1] + 1.45, HOUSE_Y - 0.4
    m.box((0.5, 0.8, 0.75), (hx, hy, 0.375), P.WHITE)
    m.cyl(0.26, 0.03, (hx + 0.26, hy, 0.4), "#8d8a93", segs=10, rot=(0, math.pi / 2, 0))
    m.cyl(0.2, 0.04, (hx + 0.27, hy, 0.4), "#3b3a42", segs=10, rot=(0, math.pi / 2, 0))
    # the car: small, green, plugged in
    cx, cy = HOUSES[2] + 2.3, HOUSE_Y - 1.0
    m.box((1.2, 2.3, 0.5), (cx, cy, 0.47), "#3f8a6a")
    m.box((1.0, 1.3, 0.42), (cx, cy + 0.1, 0.92), "#56687a", taper=0.8)
    m.box((0.82, 1.05, 0.06), (cx, cy + 0.1, 1.13), "#3f8a6a")
    for s in (-1, 1):
        m.box((0.26, 0.05, 0.1), (cx + s * 0.36, cy - 1.16, 0.6), "#e8ecf0", glow=True)
        for y in (cy - 0.75, cy + 0.75):
            m.cyl(0.24, 0.18, (cx + s * 0.55, y, 0.24), P.INK, segs=10, rot=(0, s * math.pi / 2, 0))
    m.box((0.2, 0.2, 1.2), (cx - 1.1, cy + 0.4, 0.6), P.WHITE)                           # the charger
    m.box((0.14, 0.05, 0.2), (cx - 1.1, cy + 0.29, 0.95), WIND, glow=True)
    m.plank_line((cx - 1.0, cy + 0.35, 0.8), (cx - 0.62, cy + 0.2, 0.55), 0.04, 0.04, P.INK)
    m.box((2.8, 3.2, 0.04), (cx - 0.2, cy, 0.02), "#9a958d")                             # the drive
    m.build(g)


def turbine(root):
    """A wind turbine at the back, its blades turning slowly."""
    x, y = TURBINE_AT
    g = group("turbine", (x, y, 0), parent=root, id="turbine")
    m = Model("turbine_tower")
    m.cyl(0.7, 0.25, (0, 0, 0), "#b9bcc4", segs=10)
    m.cyl(0.32, 8.0, (0, 0, 0.25), TURBINE, segs=10, r_top=0.16)
    m.box((0.55, 1.3, 0.55), (0, 0.25, 8.4), TURBINE)
    m.box((0.56, 0.2, 0.1), (0, 0.6, 8.4), BRAND)
    m.build(g)
    hub = group("turbine_hub", (0, -0.5, 8.4), parent=g)
    r = Model("turbine_rotor")
    r.ball(0.26, (0, -0.1, 0), TURBINE, subdiv=1, scale=(1, 1.4, 1))
    for k in range(3):
        a = k * math.tau / 3
        tip = (math.cos(a) * 3.2, 0, math.sin(a) * 3.2)
        r.plank_line((math.cos(a) * 0.2, 0, math.sin(a) * 0.2), tip, 0.26, 0.07, TURBINE)
        r.box((0.28, 0.08, 0.28), (math.cos(a) * 3.0, 0, math.sin(a) * 3.0), P.RED, rot=(0, -a, 0))
    r.build(hub)
    period = 6.0
    keys = [(f / FPS, (0, -math.tau * f / (period * FPS), 0)) for f in range(0, round(period * FPS) + 1, 3)]
    animate(hub, "turbine_idle", "rotation_euler", keys, rest=(0, 0, 0))


def kiosk(root):
    """The transformer kiosk everything runs through. It's full; its screen shows how full."""
    x, y = KIOSK_AT
    g = group("kiosk", (x, y, 0), parent=root, id="grid")
    m = Model("kiosk", seed=307)
    m.box((2.0, 1.3, 1.7), (0, 0, 0.85), KIOSK)
    m.box((2.2, 1.5, 0.12), (0, 0, 1.76), KIOSK_DARK)
    m.box((2.1, 1.4, 0.15), (0, 0, 0.075), KIOSK_DARK)
    for s in (-1, 1):
        m.box((0.05, 0.9, 1.2), (s * 1.01, 0, 0.8), KIOSK_DARK)                            # side doors, louvred
        for z in (0.45, 0.65, 0.85, 1.05, 1.25):
            m.box((0.06, 0.8, 0.04), (s * 1.02, 0, z), "#4a5e4d")
    m.box((0.05, 0.3, 0.26), (1.04, -0.35, 1.45), SUN)                                    # the lightning sign
    m.box((0.06, 0.06, 0.2), (1.06, -0.35, 1.45), P.INK, rot=(0.5, 0, 0))
    m.build(g)
    frame = Model("kiosk_frame")
    frame.box((1.8, 0.06, 1.2), (0, -0.67, 0.9), "#26242b")
    frame.build(g)
    scr = Model("screen_grid")
    scr.box((1.7, 0.01, 1.08), (0, 0, 0), P.SCREEN, glow=True)
    scr.build(g, loc=(0, -0.71, 0.9))
    light(g, (-0.2, -1.4, 1.0), P.SCREEN, 3.0, 0.5, halo=False)


def battery(root):
    """The neighbourhood's battery: a white container with vents, and its charge on the side."""
    x, y = BATTERY_AT
    g = group("battery", (x, y, 0), parent=root, id="battery")
    m = Model("battery", seed=308)
    m.box((3.4, 1.4, 1.5), (0, 0, 0.85), BATTERY)
    m.box((3.5, 1.5, 0.1), (0, 0, 0.05), "#8d8a93")
    m.box((3.42, 1.42, 0.12), (0, 0, 1.38), BRAND)
    for k in range(6):
        m.box((0.3, 0.05, 0.7), (-1.4 + k * 0.32, -0.71, 0.75), "#c9ccd2")
        for z in (0.5, 0.7, 0.9):
            m.box((0.26, 0.06, 0.04), (-1.4 + k * 0.32, -0.72, z), "#a8aab0")
    m.box((0.7, 0.05, 0.5), (1.1, -0.71, 0.85), "#26242b")
    for sx in (-1.6, 1.6):                                                               # a little fence
        m.box((0.06, 0.06, 0.7), (sx, -1.1, 0.35), P.IRON)
    m.box((3.26, 0.04, 0.04), (0, -1.1, 0.62), P.IRON)
    m.build(g)
    scr = Model("screen_soc")
    scr.box((0.6, 0.01, 0.4), (0, 0, 0), P.SCREEN, glow=True)
    scr.build(g, loc=(1.1, -0.74, 0.85))


def solar_meadow(root):
    """Rows of panels on posts, facing south, with sheep grazing between them."""
    g = group("solar_meadow", parent=root, id="solarfield")
    m = Model("solar_meadow", seed=309)
    tilt = 0.5
    for y, x0, x1 in ((-4.4, 7.4, 14.2), (-6.3, 7.0, 12.8), (-8.2, 6.6, 10.8)):
        length = x1 - x0
        for x in [x0 + 0.3 + i * 1.6 for i in range(int((length - 0.2) / 1.6) + 1)]:
            m.box((0.08, 0.08, 0.7), (x, y + 0.35, 0.35), "#8d8a93")
            m.box((0.08, 0.08, 1.2), (x, y - 0.35, 0.6), "#8d8a93")
        m.box((length + 0.1, 1.3, 0.04), ((x0 + x1) / 2, y, 0.92), PANEL_FRAME, rot=(tilt, 0, 0))
        solar_rows(m, (x0 + x1) / 2, y, 0.95, length, 1.2, tilt)
    m.build(g)
    for k, (x, y, turn) in enumerate(((13.6, -6.1, 2.6), (11.5, -7.6, 0.3), (6.0, -7.0, 1.4))):
        s = group(f"meadow_sheep_{k}", (x, y, 0), rot_z=turn, parent=g, id="solarfield")
        s.scale = (0.9, 0.9, 0.9)
        fauna.sheep(s, name=f"meadow_sheep_{k}")


def cables(root):
    """The cables from the roofs, the meadow and the turbine to the kiosk and the battery, with
    pulses of power running along them."""
    kx, ky = KIOSK_AT
    bx, by = BATTERY_AT
    tx, ty = TURBINE_AT
    runs = [
        ([(HOUSES[0], HOUSE_Y - 1.4), (HOUSES[0], 1.3), (kx, 1.3), (kx, ky + 0.66)], SUN, 3),
        ([(HOUSES[2], HOUSE_Y - 1.4), (HOUSES[2], 1.3), (kx, 1.3)], SUN, 2),
        ([(kx + 1.05, ky), (bx - 2.3, ky), (bx - 2.3, by), (bx - 1.72, by)], SUN, 3),
        ([(9.2, -3.6), (9.2, -1.9), (bx, -1.9), (bx, by - 1.15)], SUN, 3),
        ([(tx, ty - 0.7), (tx, by + 0.72)], WIND, 3),
    ]
    m = Model("cables")
    for pts, _, _ in runs:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            m.box((abs(x1 - x0) + 0.1, abs(y1 - y0) + 0.1, 0.03), ((x0 + x1) / 2, (y0 + y1) / 2, 0.035), CABLE)
    m.build(root)
    for r, (pts, color, count) in enumerate(runs):
        lengths = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
        total = sum(lengths)

        def at(d, pts=pts, lengths=lengths):
            for (a, b), l in zip(zip(pts, pts[1:]), lengths):
                if d <= l:
                    f = d / l
                    return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
                d -= l
            return pts[-1]

        for k in range(count):
            p = Model(f"pulse_{r}_{k}")
            p.box((0.16, 0.16, 0.08), (0, 0, 0), color, glow=True)
            obj = p.build(root)
            locs, scales = [], []
            for f in range(0, round(PULSE_LAP * FPS) + 1, 3):
                u = (f / (PULSE_LAP * FPS) + k / count) % 1.0
                x, y = at(u * total)
                s = min(1.0, u / 0.06, (1 - u) / 0.06)
                locs.append((f / FPS, (x, y, 0.08)))
                scales.append((f / FPS, (s, s, s)))
            obj.location = locs[0][1]
            animate(obj, "pulses_idle", "location", locs, rest=(0, 0, 0))
            animate(obj, "pulses_idle", "scale", scales, rest=(0, 0, 0))


def office(root):
    """Vincent's desk out in the garden, under a pergola grown over with vines: Direct+ on the
    screen, a black coffee, and ENTRNCE along the beam."""
    x, y = DESK
    g = group("office", (x, y, 0), rot_z=0.2, parent=root, id="directplus")
    m = Model("pergola", seed=310)
    for px in (-1.7, 1.7):
        for py in (-0.9, 1.1):
            m.box((0.16, 0.16, 2.5), (px, py, 1.25), P.WOOD)
    for py in (-0.9, 1.1):
        m.box((3.8, 0.14, 0.2), (0, py, 2.55), P.WOOD)
    for k in range(7):
        m.box((0.1, 2.4, 0.12), (-1.5 + k * 0.5, 0.1, 2.7), P.WOOD_LIGHT)
    for k in range(9):                                                                   # the vines on top
        m.ball(0.34, (-1.7 + k * 0.42, 0.1 + (k % 3 - 1) * 0.6, 2.85), P.LEAF[1 + k % 3], subdiv=1, jitter=0.04,
               scale=(1, 1, 0.6))
    for px in (-1.7, 1.7):                                                               # and down the posts
        for z in (0.6, 1.2, 1.8):
            m.ball(0.16, (px, 1.1, z), P.LEAF[2 + int(z) % 2], subdiv=1, jitter=0.03)
    m.box((3.1, 0.14, 0.62), (0, 1.18, 2.1), P.WOOD_LIGHT)                               # the sign board, at the back
    letters(m, "ENTRNCE", (-1.38, 1.1, 1.87), 0.066, 0.04, BRAND)
    m.build(g)

    d = Model("desk", seed=311)
    d.box((2.0, 0.9, 0.07), (0, 0.4, 0.78), P.WOOD_LIGHT)
    for dx in (-0.9, 0.9):
        d.box((0.07, 0.8, 0.76), (dx, 0.4, 0.38), P.WOOD_DARK)
    d.box((1.5, 0.08, 0.95), (0, 0.72, 1.45), P.INK)                                      # the monitor
    d.box((0.1, 0.1, 0.25), (0, 0.76, 0.93), P.INK)
    d.cyl(0.07, 0.12, (0.72, 0.3, 0.815), P.INK, segs=8)                                 # black coffee
    d.box((0.5, 0.35, 0.03), (-0.2, 0.25, 0.83), "#3b3a42")                              # keyboard
    d.box((0.55, 0.45, 0.06), (-0.55, -0.25, 0.5), P.WOOD)                               # the chair
    for cx, cy in ((-0.22, -0.43), (0.22, -0.43), (-0.22, -0.07), (0.22, -0.07)):
        d.box((0.05, 0.05, 0.48), (cx - 0.55, cy, 0.24), P.WOOD_DARK)
    d.box((0.55, 0.06, 0.55), (-0.55, -0.48, 0.8), P.WOOD)
    for px, py in ((-2.1, -1.0), (2.1, -0.9)):                                           # potted plants
        d.cyl(0.25, 0.4, (px, py, 0), P.RUST_ROOF, segs=8, r_top=0.3)
        d.ball(0.35, (px, py, 0.65), P.LEAF[2], subdiv=1, jitter=0.04)
    d.box((4.4, 2.8, 0.04), (0, 0.1, 0.02), P.WOOD_LIGHT)                                # the deck
    for k in range(10):
        d.box((0.02, 2.8, 0.045), (-2.0 + k * 0.44, 0.1, 0.02), P.WOOD)
    d.build(g)
    scr = Model("screen_market")
    scr.box((1.38, 0.01, 0.84), (0, 0, 0), P.SCREEN, glow=True)
    scr.build(g, loc=(0, 0.67, 1.45))
    light(g, (0, 0.0, 1.5), P.SCREEN, 3.0, 0.5, halo=False)

    person(g, "vincent", (-0.55, -0.25, 0), rot_z=math.pi - 0.25, look=ENTRNCE_VINCENT, pose="sit", arms="forward", scale=SCALE,
           id="vincent")
    bike(root, "vincent_bike", (x + 2.9, y - 1.2, 0), rot_z=1.9, scale=0.8, id="vincent")


# --- the land --------------------------------------------------------------------------

def greenery(root):
    f = Model("greenery", seed=312)
    for x, y, s in ((0.2, 6.0, 1.0), (5.9, 6.4, 1.1), (9.4, 3.6, 0.9), (14.4, 2.2, 0.8), (-5.2, -2.2, 1.0),
                    (-8.6, -3.8, 1.1), (-12.2, -1.6, 0.9), (3.0, -7.6, 0.9), (15.2, -2.6, 0.7), (-0.2, 3.6, 0.7)):
        tree(f, (x, y, 0), s)
    for x, y, s in ((-4.4, -8.4, 0.8), (1.4, -9.6, 0.7), (7.0, -2.6, 0.6), (-10.2, -6.4, 0.8), (-13.4, 0.6, 0.7),
                    (13.6, -0.8, 0.6), (8.2, 5.8, 0.7), (1.0, -3.0, 0.6)):
        bush(f, (x, y, 0), s)
    # wildflowers along the way
    for i, (x, y) in enumerate(((-3.2, -3.6), (-2.6, -3.2), (-6.0, -6.6), (5.2, -4.6), (4.6, -5.8), (-7.6, -1.2),
                                (-0.6, -1.4), (2.4, -2.2), (-9.4, -8.4), (6.2, -9.0))):
        f.ball(0.09, (x, y, 0.1), (SUN, "#e04868", P.WHITE, "#9b7ad8")[i % 4], subdiv=1)
        f.box((0.03, 0.03, 0.1), (x, y, 0.04), P.LEAF[2])
    # a little orchard in the south-west, with beehives
    for x, y, s in ((-9.6, -6.6, 0.8), (-7.0, -8.2, 0.75), (-11.8, -4.4, 0.8), (-6.2, -5.8, 0.7)):
        tree(f, (x, y, 0), s)
        for k in range(5):
            a = k * 1.3
            f.ball(0.09, (x + math.cos(a) * 0.7 * s, y + math.sin(a) * 0.6 * s, (1.7 + (k % 3) * 0.3) * s),
                   ("#c8403a", "#e0823a")[k % 2], subdiv=1)
    for k, (x, y) in enumerate(((-9.0, -8.8), (-8.2, -9.2), (-10.9, -7.9))):
        f.box((0.5, 0.5, 0.25), (x, y, 0.2), P.WOOD_DARK)
        for j in range(2):
            f.box((0.46, 0.46, 0.22), (x, y, 0.45 + j * 0.23), ("#e8b24a", P.WHITE, "#8fb6d8")[(k + j) % 3])
        f.box((0.58, 0.58, 0.06), (x, y, 0.94), P.WOOD)
    f.build(root)
    # a path from the office up to the houses and the trail
    p = Model("paths")
    for (x0, y0), (x1, y1) in (((-1.0, -4.0), (0.4, -1.8)), ((0.4, -1.8), (1.8, -0.5)), ((1.8, -0.5), (3.6, 1.8))):
        d = math.dist((x0, y0), (x1, y1))
        p.box((d + 0.4, 0.7, 0.04), ((x0 + x1) / 2, (y0 + y1) / 2, 0.02), PATH, rot=(0, 0, math.atan2(y1 - y0, x1 - x0)))
    p.build(root)


def build():
    root = group("room")
    plinth(root, RX, RY, seed=21, centre=CENTRE)
    clouds(root, RX, RY, seed=22, centre=CENTRE)
    mountain(root)
    trail(root)
    hikers(root)
    hut(root)
    houses(root)
    heat_pump_and_car(root)
    turbine(root)
    kiosk(root)
    battery(root)
    solar_meadow(root)
    cables(root)
    office(root)
    greenery(root)
