"""The second stretch of the trail: seven years at Backbone Systems, software for things that
drive around. Exported as career-backbone.glb.

At the back stands Kasteel Ampsen near Lochem, "the castle" we sometimes worked from: brick
wings with hipped slate roofs, a pale yellow middle with a clock in its gable, and a lawn on
either side of a cobbled path. In front of it runs a loop of road, and round it go a Qbuzz
streekBuzz bus (green face, grey sides, its destination sign lit on `screen_route`) and an
Eijgenhuijsen truck, white with purple and gold. The bus stops at its halte on the south side.

Inside the loop is the verkeersleiding: a big screen (`screen_fleet`) where the runtime draws
the very same loop with the bus and the truck on it, where they are right now, and Vincent
beside it. West, two black Going Dutch cars by a garage with navy doors, the ivy beside them,
and a little Fernsehturm behind for the half year in Berlin; east, Eijgenhuijsen's warehouse in
Ruurlo, with a driver checking his tablet.

The loop and the timetable (LOOP_*, BUS_*, TRUCK_*) are mirrored in src/island/scene/diorama.ts,
so the screen can keep up with the vehicles: change them in both places.

x = east, y = north, z = up; the camera looks in from the south-south-east.
"""
from __future__ import annotations

import math

import palette as P
from kit import FPS, Model, animate, group, light

from career.base import Look, bush, clouds, person, plinth, tree

BRICK = "#6e5352"
BRICK_DARK = "#56403f"
CREAM = "#eadfb4"
BAY = "#e8dc9e"
SLATE = "#4a4a5a"
SLATE_DARK = "#3b3a4a"
GLASS = "#2f3440"
FRAME = "#f2ecdc"
GRAVEL = "#cfc3a9"
COBBLE = "#9a9186"
LAWN = "#6fb84f"
HEDGE = "#2f6a3c"
ASPHALT = "#58565f"
KERB = "#a8a39c"
PAVERS = "#7a6d69"
BOULDER = "#7d7a7a"

QBUZZ_GREEN = "#3fb44a"
BUS_GREY = "#60666c"
BUS_ROOF = "#eef0ec"
TINT = "#27303a"
EIJ_PURPLE = "#3f2b6e"
EIJ_GOLD = "#e0a526"
TRUCK_WHITE = "#f1f0ea"
CAR_BLACK = "#1a191f"
CAR_GLASS = "#56687a"
PLATE = "#f0c02a"
NAVY = "#1f2a4a"
CLADDING = "#d5d8d4"
TOWER = "#b9bcc4"

RX, RY, CENTRE = 16.0, 11.0, (0.5, -0.5)
FACADE = 3.6            # the castle's middle; its wings stand forward of it
WINGS = FACADE - 0.3
SCALE = 0.75            # people and furniture, against the buildings
BACKBONE_VINCENT = Look(hair=P.HAIR, top="#3f5f8a", legs="#3a4a6e", beard=P.BEARD)

# the loop of road: two straights joined by half circles, driven anticlockwise (seen from
# above) from the west end of the south straight. Mirrored in diorama.ts.
LOOP_HALF, LOOP_R, LOOP_Y = 6.0, 3.4, -4.8
ROAD = 1.6
LOOP_LEN = 4 * LOOP_HALF + 2 * math.pi * LOOP_R
# the bus drives a lap in BUS_DRIVE seconds, easing out of and into its stop, then waits there;
# the truck just keeps rolling, a lap per BUS_LAP, half a lap ahead
BUS_DRIVE, BUS_LAP, BUS_EASE = 16.0, 19.5, 0.7
BUS_STOP = 7.7          # where the bus's front axle stops (x = 1.7 on the south straight)
TRUCK_START = BUS_STOP + LOOP_LEN / 2


def loop_point(s: float):
    """Where the road's centre line is, `s` along the loop, and which way it runs there."""
    s %= LOOP_LEN
    h, r, yc = LOOP_HALF, LOOP_R, LOOP_Y
    if s < 2 * h:
        return (-h + s, yc - r), 0.0
    s -= 2 * h
    if s < math.pi * r:
        a = -math.pi / 2 + s / r
        return (h + r * math.cos(a), yc + r * math.sin(a)), a + math.pi / 2
    s -= math.pi * r
    if s < 2 * h:
        return (h - s, yc + r), math.pi
    s -= 2 * h
    a = math.pi / 2 + s / r
    return (-h + r * math.cos(a), yc + r * math.sin(a)), a + math.pi / 2


def bus_s(t: float) -> float:
    p = min((t % BUS_LAP) / BUS_DRIVE, 1.0)
    return BUS_STOP + LOOP_LEN * (p - BUS_EASE * math.sin(math.tau * p) / math.tau)


def truck_s(t: float) -> float:
    return TRUCK_START + LOOP_LEN * t / BUS_LAP


def drive(obj, clip: str, where, ahead: float, wheelbase: float):
    """Keyframe a rigid body along the loop: its origin (at `ahead` behind where(t)) on the road,
    turned to face the point `wheelbase` further ahead than its back wheels."""
    locs, rots, prev = [], [], None
    for f in range(0, round(BUS_LAP * FPS) + 1, 3):
        t = f / FPS
        s = where(t) - ahead
        (fx, fy), _ = loop_point(s)
        (bx, by), _ = loop_point(s - wheelbase)
        h = math.atan2(fy - by, fx - bx)
        if prev is not None:
            h += round((prev - h) / math.tau) * math.tau
        prev = h
        locs.append((t, (fx, fy, 0.0)))
        rots.append((t, (0.0, 0.0, h)))
    obj.location, obj.rotation_euler = locs[0][1], rots[0][1]
    animate(obj, clip, "location", locs, rest=(0, 0, 0))
    animate(obj, clip, "rotation_euler", rots, rest=(0, 0, 0))


# --- Kasteel Ampsen --------------------------------------------------------------------

def hip(m: Model, x0, x1, y0, y1, z, h, color, ridge: float):
    """A hipped roof over a rectangle: all four sides slope up to a ridge `ridge` long (along x)."""
    xc, yc, e = (x0 + x1) / 2, (y0 + y1) / 2, 0.04
    top = [(xc - ridge / 2, yc - e), (xc + ridge / 2, yc - e), (xc + ridge / 2, yc + e), (xc - ridge / 2, yc + e)]
    m.slab([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z, z + h, color, top=top)


def window(m: Model, x, y, z, w, h, face="-y"):
    """A tall sash window, white-framed with a cross of glazing bars, set in a wall facing `face`."""
    if face == "-y":
        m.box((w + 0.12, 0.06, h + 0.12), (x, y - 0.02, z), FRAME)
        m.box((w, 0.07, h), (x, y - 0.03, z), GLASS)
        m.box((0.035, 0.08, h), (x, y - 0.035, z), FRAME)
        m.box((w, 0.08, 0.035), (x, y - 0.035, z + h * 0.18), FRAME)
    else:
        m.box((0.06, w + 0.12, h + 0.12), (x + 0.02, y, z), FRAME)
        m.box((0.07, w, h), (x + 0.03, y, z), GLASS)
        m.box((0.08, 0.035, h), (x + 0.035, y, z), FRAME)
        m.box((0.08, w, 0.035), (x + 0.035, y, z + h * 0.18), FRAME)


def dormer(m: Model, x, y, z, w=0.55):
    m.box((w, 0.7, 0.6), (x, y + 0.2, z), SLATE_DARK)
    m.box((w + 0.08, 0.06, 0.64), (x, y - 0.15, z), CREAM)
    m.box((w - 0.2, 0.07, 0.36), (x, y - 0.16, z - 0.02), GLASS)
    m.gable((0.8, w + 0.14, 0.26), (x, y + 0.2, z + 0.3), SLATE, rot=(0, 0, math.pi / 2), thick=0.08)


def ampsen(root):
    g = group("ampsen", parent=root, id="ampsen")
    m = Model("ampsen_walls", seed=101)
    F, W = FACADE, WINGS
    # the middle block and the two wings, on a darker plinth of brick
    m.box((8.4, 3.0, 2.8), (0, F + 1.5, 1.4), BRICK)
    for s in (-1, 1):
        m.box((3.0, 3.6, 3.1), (s * 5.7, W + 1.8, 1.55), BRICK)
        m.box((3.1, 3.7, 0.3), (s * 5.7, W + 1.8, 0.15), BRICK_DARK)
        m.box((3.16, 3.76, 0.14), (s * 5.7, W + 1.8, 3.1), CREAM)                        # cornice
    m.box((8.5, 3.1, 0.3), (0, F + 1.5, 0.15), BRICK_DARK)
    m.box((8.5, 3.12, 0.12), (0, F + 1.5, 2.8), CREAM)
    # the pale yellow middle bay, its curly gable with the clock and the door up a few steps
    m.box((2.4, 0.2, 2.8), (0, F - 0.08, 1.4), BAY)
    gable = [(-1.2, 2.8), (1.2, 2.8), (1.2, 3.05), (0.95, 3.15), (0.8, 3.5), (0.5, 3.8), (0, 3.92),
             (-0.5, 3.8), (-0.8, 3.5), (-0.95, 3.15), (-1.2, 3.05)]
    m.prism(gable, 0.22, (0, F - 0.07, 0), BAY)
    m.prism([(-1.24, 2.78), (1.24, 2.78), (1.24, 2.9), (-1.24, 2.9)], 0.3, (0, F - 0.08, 0), CREAM)
    m.cyl(0.22, 0.04, (0, F - 0.17, 3.42), FRAME, segs=12, rot=(math.pi / 2, 0, 0))     # the clock
    m.cyl(0.18, 0.02, (0, F - 0.2, 3.42), P.WHITE, segs=12, rot=(math.pi / 2, 0, 0))
    m.box((0.025, 0.02, 0.14), (0, F - 0.23, 3.48), P.INK)
    m.box((0.11, 0.02, 0.025), (0.05, F - 0.23, 3.42), P.INK)
    for x in (-0.12, 0.12):                                                              # coats of arms
        m.box((0.16, 0.04, 0.2), (x, F - 0.19, 3.0), FRAME)
    m.box((0.1, 0.05, 0.12), (-0.12, F - 0.2, 2.99), "#b5562d")
    m.box((0.1, 0.05, 0.12), (0.12, F - 0.2, 2.99), P.GOLD)
    m.box((0.7, 0.08, 1.15), (0, F - 0.2, 0.9), FRAME)                                   # the door
    m.box((0.5, 0.09, 0.45), (0, F - 0.21, 1.1), GLASS)
    for k, (w, d) in enumerate(((1.7, 0.75), (1.5, 0.55), (1.3, 0.35))):
        m.box((w, d, 0.11), (0, F - 0.2 - d / 2, 0.055 + k * 0.11), SLATE_DARK)
    window(m, 0, F - 0.18, 2.15, 0.5, 0.8)
    for x in (-0.82, 0.82):
        window(m, x, F - 0.18, 1.0, 0.24, 1.0)
        window(m, x, F - 0.18, 2.15, 0.24, 0.8)
    # rows of tall windows, and little cellar windows under them
    for x in (-3.5, -2.45, -1.6, 1.6, 2.45, 3.5):
        w = 0.3 if abs(x) < 2 else 0.52
        window(m, x, F, 1.1, w, 1.0)
        window(m, x, F, 2.2, w, 0.8)
        m.box((w, 0.06, 0.14), (x, F - 0.02, 0.18), FRAME)
    for s in (-1, 1):
        for x in (4.95, 6.45):
            window(m, s * x, W, 1.15, 0.58, 1.1)
            window(m, s * x, W, 2.45, 0.58, 0.95)
            m.box((0.58, 0.06, 0.14), (s * x, W - 0.02, 0.18), FRAME)
    for y in (W + 1.0, W + 2.5):                                                         # round the east side
        window(m, 7.2, y, 1.15, 0.58, 1.1, face="+x")
        window(m, 7.2, y, 2.45, 0.58, 0.95, face="+x")
    # roofs: a long hip over the middle, steep ones over the wings, dormers and chimneys
    hip(m, -4.3, 4.3, F - 0.12, F + 3.12, 2.86, 1.8, SLATE, ridge=5.2)
    for s in (-1, 1):
        x0, x1 = sorted((s * 4.05, s * 7.35))
        hip(m, x0, x1, W - 0.15, W + 3.75, 3.17, 2.2, SLATE, ridge=0.4)
        dormer(m, s * 5.7, W + 0.55, 3.95)
        dormer(m, s * 2.8, F + 0.55, 3.35)
        for x, y, h in ((s * 3.1, F + 1.3, 2.3), (s * 1.2, F + 1.9, 2.1), (s * 5.2, W + 2.4, 3.2), (s * 6.3, W + 1.6, 2.9)):
            m.box((0.36, 0.36, h), (x, y, 2.9 + h / 2), BRICK_DARK)
            m.box((0.44, 0.44, 0.08), (x, y, 2.9 + h), CREAM)
    # the little tower at the back corner, with its pointed hat and a weathervane
    m.cyl(0.72, 3.4, (7.7, W + 3.4, 0), BRICK, segs=10)
    m.cyl(0.76, 0.12, (7.7, W + 3.4, 3.35), CREAM, segs=10)
    m.cyl(0.84, 2.1, (7.7, W + 3.4, 3.45), SLATE, segs=10, r_top=0.04)
    m.cyl(0.025, 0.6, (7.7, W + 3.4, 5.5), P.IRON, segs=4)
    m.box((0.3, 0.02, 0.12), (7.78, W + 3.4, 5.95), P.IRON)
    window(m, 7.7 + 0.72, W + 3.2, 2.0, 0.3, 0.7, face="+x")
    m.build(g)

    lamps = Model("ampsen_lanterns")
    for x in (-0.5, 0.5):
        lamps.box((0.14, 0.14, 0.24), (x, F - 0.32, 1.3), P.LANTERN, glow=True)
        lamps.box((0.18, 0.18, 0.05), (x, F - 0.32, 1.45), P.IRON)
        light(g, (x, F - 0.5, 1.3), P.WARM_LIGHT, 2.5, 0.7, halo=False)
    lamps.build(g)


def ampsen_grounds(root):
    """Gravel in front of the castle, two lawns with a cobbled path between them down to the
    road, boulders along the edges, urns of flowers, clipped balls by the door, tall hedges."""
    m = Model("ampsen_grounds", seed=102)
    m.box((16.0, 4.0, 0.04), (0, 1.5, 0.02), GRAVEL)
    for s in (-1, 1):
        x0, x1 = sorted((s * 0.55, s * 5.4))
        m.box((x1 - x0, 2.6, 0.08), ((x0 + x1) / 2, 1.3, 0.04), LAWN)
        for x in (x0 + 0.25, (x0 + x1) / 2, x1 - 0.25):
            m.ball(0.2, (x, -0.1, 0.08), BOULDER, subdiv=1, scale=(1.2, 1, 0.6), jitter=0.02)
        for y in (0.5, 2.1):
            m.ball(0.17, (s * 0.72, y, 0.08), BOULDER, subdiv=1, scale=(1.2, 1, 0.6), jitter=0.02)
        # urns with pink flowers
        ux = s * 6.1
        m.cyl(0.18, 0.5, (ux, 1.0, 0), CREAM, segs=6, r_top=0.12)
        m.cyl(0.26, 0.25, (ux, 1.0, 0.5), CREAM, segs=6, r_top=0.3)
        m.ball(0.34, (ux, 1.0, 0.9), "#d98fb0", subdiv=1, jitter=0.04, scale=(1, 1, 0.8))
        m.ball(0.2, (ux + 0.12, 1.05, 1.02), P.LEAF[2], subdiv=1, jitter=0.03)
        # clipped balls on stems either side of the steps
        m.cyl(0.14, 0.3, (s * 1.45, FACADE - 0.55, 0), SLATE_DARK, segs=6)
        m.cyl(0.03, 0.4, (s * 1.45, FACADE - 0.55, 0.3), P.BARK, segs=4)
        m.ball(0.3, (s * 1.45, FACADE - 0.55, 0.9), P.LEAF[1], subdiv=1, jitter=0.02)
        # the tall hedges either side of the house
        m.box((1.0, 3.0, 1.9), (s * 8.4, WINGS + 0.9, 0.95), HEDGE)
    m.box((0.9, FACADE + 1.2, 0.07), (0, (FACADE - 1.2) / 2, 0.035), COBBLE)
    for k in range(9):                                                                   # the cobbles
        m.box((0.8, 0.04, 0.075), (0, -0.9 + k * 0.5, 0.04), "#8a8177")
    m.build(root)


# --- the road --------------------------------------------------------------------------

def road(root):
    """The loop of asphalt, with a zebra crossing where the castle's path meets it, and a few
    street lamps."""
    m = Model("road", seed=103)
    n = 96
    for i in range(n):
        s0, s1 = i / n * LOOP_LEN, (i + 1) / n * LOOP_LEN
        quad = []
        for s, side in ((s0, -1), (s1, -1), (s1, 1), (s0, 1)):
            (x, y), h = loop_point(s)
            quad.append((x - math.sin(h) * side * ROAD / 2, y + math.cos(h) * side * ROAD / 2))
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(quad, quad[1:] + quad[:1]))
        m.slab(quad if area > 0 else quad[::-1], 0.0, 0.05, ASPHALT)
        # a kerb along the outside
        for side, w in ((-1, 0.14), (1, 0.14)):
            (xa, ya), ha = loop_point(s0)
            (xb, yb), hb = loop_point(s1)
            off = ROAD / 2 + w / 2
            a = (xa - math.sin(ha) * side * off, ya + math.cos(ha) * side * off, 0.04)
            b = (xb - math.sin(hb) * side * off, yb + math.cos(hb) * side * off, 0.04)
            m.box((math.dist(a, b) + 0.02, w, 0.08), ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.04), KERB,
                  rot=(0, 0, math.atan2(b[1] - a[1], b[0] - a[0])))
    # dashes down the middle
    for i in range(int(LOOP_LEN / 1.2)):
        (x, y), h = loop_point(i * 1.2)
        m.box((0.5, 0.07, 0.02), (x, y, 0.055), P.WHITE, rot=(0, 0, h))
    ny = LOOP_Y + LOOP_R
    for k in range(5):
        m.box((0.2, ROAD - 0.2, 0.02), (-0.8 + k * 0.4, ny, 0.056), P.WHITE)
    m.build(root)

    for x, y in ((-3.2, -0.45), (3.2, -0.45), (-4.0, LOOP_Y - LOOP_R - 1.1)):
        lamp = Model("lamp_post")
        lamp.cyl(0.06, 2.4, (x, y, 0), P.IRON, segs=5)
        lamp.box((0.08, 0.5, 0.08), (x, y - 0.2 * (1 if y > -2 else -1), 2.4), P.IRON)
        ly = y - 0.4 * (1 if y > -2 else -1)
        lamp.box((0.18, 0.28, 0.06), (x, ly, 2.34), P.LANTERN, glow=True)
        lamp.build(root)
        light(root, (x, ly, 2.2), P.WARM_LIGHT, 4.0)


# --- Qbuzz -----------------------------------------------------------------------------

def wheels(m: Model, xs, half: float, r: float, hub="#c9c6c0"):
    for x in xs:
        for side in (-1, 1):
            m.cyl(r, 0.2, (x, side * half, r), P.INK, segs=10, rot=(-side * math.pi / 2, 0, 0))
            m.cyl(r * 0.55, 0.03, (x, side * (half + 0.2), r), hub, segs=8, rot=(-side * math.pi / 2, 0, 0))


def bus(root):
    """A VDL Citea in streekBuzz colours: the front and a band round the top Qbuzz green, the
    sides grey, a white roof with the air conditioning and the antenna that told the office
    where it was. Its origin is the front axle; it points along +x."""
    g = group("qbuzz_bus", parent=root, id="qbuzz")
    m = Model("bus_body", seed=104)
    m.box((5.35, 1.35, 1.5), (-1.625, 0, 0.95), BUS_GREY)
    m.box((5.36, 1.37, 0.16), (-1.625, 0, 1.62), QBUZZ_GREEN)
    m.box((0.1, 1.36, 1.5), (1.02, 0, 0.95), QBUZZ_GREEN)
    m.box((5.3, 1.3, 0.12), (-1.6, 0, 1.76), BUS_ROOF)
    m.box((1.5, 0.95, 0.22), (-2.3, 0, 1.92), BUS_ROOF)                                  # airco
    m.cyl(0.02, 0.28, (-0.6, 0.2, 1.82), P.INK, segs=4)                                  # antenna
    m.box((0.1, 0.07, 0.04), (-0.6, 0.2, 2.1), P.INK)
    m.box((4.45, 1.38, 0.62), (-2.15, 0, 1.2), TINT)                                     # side windows
    for x in (-0.7, -1.9, -3.1):
        m.box((0.06, 1.39, 0.62), (x, 0, 1.2), BUS_GREY)
    m.box((0.11, 1.22, 0.78), (1.03, 0, 1.13), TINT)                                     # windscreen
    m.box((0.12, 1.36, 0.1), (1.04, 0, 0.3), "#2b2a30")                                  # bumper
    for y in (-0.45, 0.45):
        m.box((0.05, 0.22, 0.1), (1.08, y, 0.5), P.LANTERN, glow=True)
    m.box((0.04, 0.42, 0.11), (1.09, 0, 0.36), PLATE)
    for x in (0.45, -2.2):                                                               # doors, on the kerb side
        m.box((0.75, 0.04, 1.3), (x, -0.69, 0.82), TINT)
        m.box((0.03, 0.05, 1.3), (x, -0.7, 0.82), BUS_GREY)
    m.box((1.6, 0.02, 0.3), (-2.6, -0.69, 0.55), P.WHITE)                                # "streek"
    m.box((0.9, 0.02, 0.4), (-1.35, -0.69, 0.55), QBUZZ_GREEN)                           # "Buzz"
    m.box((1.6, 0.02, 0.3), (-2.6, 0.69, 0.55), P.WHITE)
    m.box((0.9, 0.02, 0.4), (-3.85, 0.69, 0.55), QBUZZ_GREEN)
    for y in (-0.72, 0.72):                                                              # mirrors, on their arms
        m.plank_line((1.0, y * 0.95, 1.55), (1.25, y * 1.1, 1.35), 0.05, 0.05, P.INK)
        m.box((0.06, 0.12, 0.26), (1.27, y * 1.12, 1.2), P.INK)
    wheels(m, (0.0, -3.3), 0.58, 0.3)
    m.build(g)
    # the destination sign above the windscreen, drawn by the runtime
    sign = Model("screen_route")
    sign.box((1.0, 0.01, 0.17), (0, 0, 0), "#ffb020", glow=True)
    sign.build(g, loc=(1.09, 0, 1.63), rot_z=math.pi / 2)
    drive(g, "bus_idle", bus_s, 0.0, 3.3)


def halte(root):
    """The bus stop on the south side: a blue sign on a pole, a bench, someone waiting."""
    y = LOOP_Y - LOOP_R - ROAD / 2 - 0.55
    m = Model("halte", seed=105)
    m.cyl(0.05, 2.1, (2.9, y, 0), "#8d8a93", segs=5)
    m.box((0.06, 0.4, 0.44), (2.9, y, 1.9), "#2f5d9a")
    m.box((0.07, 0.2, 0.26), (2.9, y, 1.9), P.WHITE)
    m.box((0.07, 0.16, 0.08), (2.9, y + 0.02, 1.98), "#2f5d9a")
    m.box((0.25, 0.36, 0.3), (2.9, y, 1.05), "#d9d5cf")                                  # timetable
    m.box((1.2, 0.35, 0.06), (4.1, y - 0.15, 0.45), P.WOOD)
    for x in (3.65, 4.55):
        m.box((0.06, 0.3, 0.45), (x, y - 0.15, 0.22), P.IRON)
    m.build(root, id="qbuzz")
    person(root, "passenger", (3.9, y - 0.1, 0), rot_z=0.0, look=Look(hair="#c9a23f", top="#b5562d", legs="#2e2a3a", long_hair=True),
           pose="sit", scale=SCALE, id="qbuzz")


# --- Eijgenhuijsen ---------------------------------------------------------------------

def stripes(m: Model, x, y, z, h, lean=0.35):
    """Eijgenhuijsen's purple and gold, slanting up the side at x (on a side at y)."""
    m.box((0.2, 0.02, h), (x, y, z), EIJ_PURPLE, rot=(0, lean, 0))
    m.box((0.2, 0.02, h), (x + 0.22, y, z), EIJ_GOLD, rot=(0, lean, 0))


def truck(root):
    """A Volvo FH with a box trailer, white with the purple and gold. The tractor's origin is
    its front axle, the trailer's its kingpin; both point along +x."""
    t = group("eij_tractor", parent=root, id="eijgenhuijsen")
    m = Model("tractor_body", seed=106)
    m.box((1.25, 1.34, 1.5), (0.05, 0, 1.3), TRUCK_WHITE)
    m.box((1.1, 1.24, 0.35), (-0.02, 0, 2.2), TRUCK_WHITE, taper=0.85)                   # sleeper roof
    m.box((0.06, 1.2, 0.55), (0.69, 0, 1.68), TINT)                                     # windscreen
    m.box((0.07, 1.2, 0.18), (0.7, 0, 2.08), P.INK)                                     # the name board
    m.box((0.075, 0.8, 0.07), (0.71, 0, 2.08), P.WHITE)
    m.box((0.06, 1.2, 0.6), (0.69, 0, 1.05), "#2b2a30")                                  # grille
    for z in (0.95, 1.12):
        m.box((0.07, 0.7, 0.04), (0.7, 0, z), "#c9c6c0")
    m.box((0.07, 1.34, 0.08), (0.7, 0, 0.68), EIJ_GOLD)
    m.box((0.07, 1.34, 0.12), (0.7, 0, 0.58), EIJ_PURPLE)
    for y in (-0.45, 0.45):
        m.box((0.05, 0.2, 0.12), (0.72, y, 0.82), P.LANTERN, glow=True)
    m.box((0.04, 0.4, 0.1), (0.73, 0, 0.45), PLATE)
    for s in (-1, 1):
        stripes(m, -0.1, s * 0.68, 1.2, 1.1)
        m.box((0.06, 0.1, 0.3), (0.65, s * 0.75, 1.65), P.INK)                           # mirrors
    m.box((2.4, 0.8, 0.25), (-0.75, 0, 0.45), "#2b2a30")                                 # chassis
    m.box((0.6, 0.7, 0.06), (-1.4, 0, 0.6), P.INK)                                       # fifth wheel
    wheels(m, (0.0, -1.5), 0.55, 0.3)
    m.build(t)
    drive(t, "truck_idle", truck_s, 0.0, 1.5)

    tr = group("eij_trailer", parent=root, id="eijgenhuijsen")
    b = Model("trailer_body", seed=107)
    b.box((5.05, 1.34, 1.75), (-2.175, 0, 1.5), TRUCK_WHITE)
    for s in (-1, 1):
        y = s * 0.68
        stripes(b, -0.5, y, 1.5, 1.6)
        b.box((0.3, 0.02, 0.26), (-1.05, y, 1.95), EIJ_PURPLE)
        b.box((0.3, 0.02, 0.26), (-1.05, y, 1.2), EIJ_PURPLE)
        b.box((0.26, 0.02, 0.26), (-0.8, y, 1.6), EIJ_GOLD)
        b.box((1.9, 0.02, 0.2), (-2.6, y, 1.85), P.INK)                                  # eijgenhuijsen bv
        b.box((0.9, 0.02, 0.08), (-3.5, y, 1.62), P.INK)                                 # precisievervoer
        b.box((1.6, 0.02, 0.05), (-2.45, y, 2.2), P.INK)
    b.box((2.2, 1.1, 0.3), (-2.0, 0, 0.55), "#8d8a93")                                   # side skirts
    b.plank_line((-0.6, 0.4, 0.0), (-0.6, 0.4, 0.62), 0.06, 0.06, "#8d8a93")              # landing legs
    b.plank_line((-0.6, -0.4, 0.0), (-0.6, -0.4, 0.62), 0.06, 0.06, "#8d8a93")
    b.box((0.06, 1.2, 0.12), (-4.72, 0, 0.72), P.RED)                                    # rear lights
    wheels(b, (-3.6, -4.25), 0.55, 0.3)
    b.build(tr)
    drive(tr, "truck_idle", truck_s, 1.4, 4.1)


def warehouse(root):
    """Eijgenhuijsen in Ruurlo: a warehouse with two loading docks, pallets waiting, and a
    driver checking his route on the tablet we built."""
    g = group("eij_warehouse", parent=root, id="eijgenhuijsen")
    wx, wy, d = 12.2, 1.9, 3.2
    fy = wy - d / 2
    m = Model("warehouse", seed=108)
    m.box((4.4, d, 2.6), (wx, wy, 1.3), CLADDING)
    m.box((4.55, d + 0.15, 0.2), (wx, wy, 2.7), "#8d8a93")
    for k in range(10):                                                                  # ribbed cladding
        m.box((0.04, 0.03, 2.5), (wx - 2.0 + k * 0.45, fy - 0.01, 1.25), "#c2c5c1")
    for x in (wx - 1.1, wx + 0.7):
        m.box((1.2, 0.06, 1.5), (x, fy - 0.03, 1.05), "#8e939a")                         # dock doors
        for z in (0.5, 0.8, 1.1, 1.4, 1.7):
            m.box((1.2, 0.07, 0.03), (x, fy - 0.035, z), "#7a7f86")
        m.box((1.5, 0.5, 0.3), (x, fy - 0.25, 0.15), "#8d8a93")                          # dock
        for dx in (-0.55, 0.55):
            m.box((0.14, 0.1, 0.25), (x + dx, fy - 0.52, 0.35), P.INK)
    m.box((4.4, 0.05, 0.14), (wx, fy - 0.03, 2.25), EIJ_PURPLE)
    m.box((4.4, 0.05, 0.1), (wx, fy - 0.03, 2.1), EIJ_GOLD)
    for s in (0, 1):                                                                     # the chevrons on the end wall
        m.box((0.05, 0.36, 0.36), (wx + 2.21, wy - 0.5 + s * 0.45, 1.3 + s * 0.4), EIJ_PURPLE, rot=(0.6, 0, 0))
        m.box((0.05, 0.36, 0.36), (wx + 2.21, wy - 0.05 + s * 0.45, 1.3 + s * 0.4), EIJ_GOLD, rot=(0.6, 0, 0))
    m.box((1.8, 0.06, 0.4), (wx + 1.1, fy - 0.04, 2.47), P.WHITE)                        # the sign
    m.box((1.4, 0.07, 0.14), (wx + 1.1, fy - 0.05, 2.49), P.INK)
    # pallets and boxes out front
    for x, y, h in ((wx - 2.4, fy - 0.8, 2), (wx - 1.9, fy - 1.5, 1)):
        m.box((0.6, 0.5, 0.1), (x, y, 0.05), P.WOOD)
        for k in range(h):
            m.box((0.55, 0.45, 0.35), (x, y, 0.28 + k * 0.36), "#b98a55")
            m.box((0.56, 0.02, 0.06), (x, y - 0.23, 0.3 + k * 0.36), EIJ_GOLD)
    m.box((4.8, 2.0, 0.04), (wx, fy - 1.1, 0.02), "#9a958d")                             # the yard
    m.build(g)
    driver = person(g, "driver", (wx - 0.1, fy - 1.4, 0), rot_z=-0.3, look=Look(hair="#3a2a20", top=EIJ_PURPLE, legs="#3a4a6e"),
                    arms="forward", scale=SCALE, id="eijgenhuijsen")
    tab = Model("tablet")
    tab.box((0.42, 0.04, 0.3), (0, -0.6, 1.3), P.INK, rot=(0.9, 0, 0))
    tab.box((0.36, 0.02, 0.24), (0, -0.62, 1.32), P.SCREEN, glow=True, rot=(0.9, 0, 0))
    tab.build(driver)


# --- Going Dutch -----------------------------------------------------------------------

def car(root, name, loc, rot_z):
    """A black Ford Fiesta with the Deelauto sticker on its doors, a little flag on the aerial and
    the OV-chipkaart reader behind the windscreen. Points along +x."""
    g = group(name, loc, rot_z=rot_z, parent=root, id="goingdutch")
    m = Model(f"{name}_body", seed=109)
    m.box((2.3, 1.05, 0.5), (0, 0, 0.47), CAR_BLACK)
    m.box((0.5, 1.0, 0.18), (0.85, 0, 0.72), CAR_BLACK, taper=0.9)                     # bonnet
    m.box((1.3, 0.98, 0.44), (-0.25, 0, 0.93), CAR_GLASS, taper=0.8)
    m.box((1.05, 0.8, 0.06), (-0.3, 0, 1.16), CAR_BLACK)
    m.box((0.06, 1.0, 0.44), (-0.25, 0, 0.93), CAR_BLACK)                               # b-pillar
    for y in (-0.36, 0.36):
        m.box((0.05, 0.26, 0.1), (1.15, y, 0.6), "#e8ecf0", glow=True)
        m.box((0.05, 0.18, 0.08), (-1.15, y, 0.62), P.RED)
    m.box((0.03, 0.38, 0.1), (1.16, 0, 0.38), PLATE)
    m.box((0.03, 0.38, 0.1), (-1.16, 0, 0.45), PLATE)
    for s in (-1, 1):                                                                    # "Deelauto project Going Dutch"
        y = s * 0.53
        m.box((0.4, 0.02, 0.32), (0.2, y, 0.5), P.WHITE)
        m.box((0.4, 0.025, 0.07), (0.2, y, 0.63), P.RED)
        m.box((0.4, 0.025, 0.06), (0.2, y, 0.37), "#2f4f9a")
        m.box((0.24, 0.025, 0.03), (0.2, y, 0.5), "#5a5a66")
        m.box((0.08, 0.12, 0.08), (0.42, s * 0.56, 0.86), CAR_BLACK)                      # mirrors
    m.box((0.02, 0.08, 0.06), (0.4, 0.22, 1.0), "#58c08a", glow=True)                   # OV-chip reader
    m.plank_line((-0.75, 0, 1.18), (-0.95, 0, 1.55), 0.02, 0.02, P.INK)                  # aerial and flag
    for k, c in enumerate(("#c8403a", P.WHITE, "#2f4f9a")):
        m.box((0.02, 0.14, 0.035), (-0.95, 0.07, 1.54 - k * 0.035), c)
    m.box((0.02, 0.1, 0.03), (-0.95, 0.19, 1.54), "#f08a24")
    wheels(m, (0.75, -0.75), 0.38, 0.24, hub="#c9ccd2")
    m.build(g)
    return g


def going_dutch(root):
    """Lochem: two shared cars on the paving in front of a garage with navy doors, the ivy fence
    behind them."""
    gx, gy = -11.9, 1.9
    g = group("garage", parent=root, id="goingdutch")
    m = Model("garage", seed=110)
    m.box((3.6, 2.4, 2.0), (gx, gy, 1.0), P.WHITE)
    m.prism([(-1.8, 0), (1.8, 0), (0, 0.8)], 2.4, (gx, gy, 2.0), P.WHITE)
    m.gable((2.7, 3.9, 0.8), (gx, gy, 2.0), SLATE, rot=(0, 0, math.pi / 2), overhang=0.12)
    fy = gy - 1.22
    for x in (gx - 0.85, gx + 0.85):
        m.box((1.45, 0.06, 1.75), (x, fy, 0.88), NAVY)
        m.box((0.03, 0.07, 1.75), (x, fy - 0.005, 0.88), "#141b33")
        for dx in (-0.36, 0.36):                                                         # the diamond windows
            m.box((0.22, 0.07, 0.22), (x + dx, fy - 0.01, 1.35), P.WHITE, rot=(0, math.pi / 4, 0))
            m.box((0.14, 0.08, 0.14), (x + dx, fy - 0.015, 1.35), NAVY, rot=(0, math.pi / 4, 0))
    m.slab([(-14.5, -2.8), (-9.4, -2.8), (-9.4, 0.6), (-14.5, 0.6)], 0.0, 0.05, PAVERS)
    for k in range(6):
        m.box((5.1, 0.03, 0.02), (-11.95, -2.5 + k * 0.55, 0.055), "#6a5d5a")
    # the ivy, grown over a wooden fence along the west side
    m.box((0.2, 3.2, 1.5), (-14.6, -1.1, 0.75), P.WOOD_DARK)
    for k in range(9):
        y = -2.6 + k * 0.38
        m.ball(0.34, (-14.5, y, 0.35 + (k % 3) * 0.45), P.LEAF[1 + k % 3], subdiv=1, jitter=0.05, scale=(0.6, 1, 1))
        m.ball(0.3, (-14.45, y + 0.15, 1.2 - (k % 2) * 0.3), P.LEAF[2 - k % 2], subdiv=1, jitter=0.05, scale=(0.6, 1, 1))
    m.build(g)
    for k, (x, y) in enumerate(((-12.6, -1.9), (-11.3, -0.2))):
        c = car(root, f"deelauto_{k}", (x, y, 0), -0.5)
        c.scale = (0.95, 0.95, 0.95)


# --- the verkeersleiding ---------------------------------------------------------------

def verkeersleiding(root):
    """The big screen inside the loop, with the whole fleet on it, a dispatcher at the desk with
    his headset, and Vincent explaining what the dots mean."""
    g = group("verkeersleiding", (-2.6, -4.0, 0), rot_z=0.3, parent=root, id="verkeersleiding")
    m = Model("board", seed=111)
    for x in (-1.4, 1.4):
        m.box((0.14, 0.14, 1.4), (x, 0.05, 0.7), "#3a3a44")
    m.box((3.3, 0.16, 2.1), (0, 0.05, 2.35), "#26242b")
    m.box((3.2, 0.1, 0.1), (0, -0.02, 1.33), "#3a3a44")
    m.build(g)
    scr = Model("screen_fleet")
    scr.box((3.05, 0.01, 1.9), (0, 0, 0), P.SCREEN, glow=True)
    scr.build(g, loc=(0, -0.04, 2.35))
    light(g, (0, -1.0, 2.2), P.SCREEN, 4.0, 0.6, halo=False)

    desk = group("dispatch", (-0.3, -1.3, 0), parent=g, id="verkeersleiding")
    desk.scale = (SCALE, SCALE, SCALE)
    d = Model("desk", seed=112)
    d.box((2.0, 0.8, 0.07), (0, 0, 0.95), "#d9d5cf")
    for x in (-0.9, 0.9):
        d.box((0.06, 0.7, 0.92), (x, 0, 0.46), "#8d8a93")
    for k, x in enumerate((-0.45, 0.45)):
        d.box((0.6, 0.05, 0.4), (x, 0.15, 1.35), P.INK, rot=(0, 0, 0.2 - k * 0.4))
        d.box((0.54, 0.02, 0.34), (x, 0.12, 1.35), P.SCREEN, glow=True, rot=(0, 0, 0.2 - k * 0.4))
        d.box((0.1, 0.1, 0.35), (x, 0.2, 1.1), P.INK)
    d.box((0.6, 0.5, 0.06), (0.1, -0.65, 0.5), P.IRON)                                   # the chair
    d.cyl(0.04, 0.5, (0.1, -0.65, 0), P.IRON, segs=4)
    d.box((0.6, 0.06, 0.6), (0.1, -0.92, 0.8), P.IRON)
    d.build(desk)
    who = person(desk, "dispatcher", (0.1, -0.65, 0), rot_z=math.pi, look=Look(hair="#2a2024", top="#3d7a4a", legs="#2e2a3a"),
                 pose="sit", arms="forward", id="verkeersleiding")
    h = Model("headset")
    h.box((0.5, 0.06, 0.06), (0, 0.0, 1.95), P.INK)
    for x in (-0.25, 0.25):
        h.box((0.06, 0.16, 0.18), (x, 0.0, 1.66), P.INK)
    h.plank_line((-0.26, 0.0, 1.6), (-0.1, -0.22, 1.5), 0.03, 0.03, P.INK)
    h.build(who)

    person(g, "vincent", (2.0, -0.4, 0), rot_z=-0.35, look=BACKBONE_VINCENT, arms="point", scale=SCALE, id="vincent")



# --- Berlin ----------------------------------------------------------------------------

def berlin(root):
    """Half a year in Berlin: the Fernsehturm on the skyline behind, and a pile of parcels waiting to be
    planned onto the right van."""
    g = group("berlin", parent=root, id="berlin")
    bx, by = -11.8, 5.6
    m = Model("fernsehturm", seed=113)
    m.cyl(0.9, 0.35, (bx, by, 0), "#8d8a93", segs=8)
    m.cyl(0.26, 4.3, (bx, by, 0.35), P.WHITE, segs=8, r_top=0.17)
    m.ball(0.62, (bx, by, 4.85), TOWER, subdiv=2)
    m.cyl(0.64, 0.14, (bx, by, 4.78), "#3a3f4a", segs=12)
    m.cyl(0.12, 0.7, (bx, by, 5.4), P.WHITE, segs=6, r_top=0.08)
    for k in range(4):
        m.cyl(0.05, 0.3, (bx, by, 6.1 + k * 0.3), P.RED if k % 2 == 0 else P.WHITE, segs=5)
    # the parcels, and the Rainmaking Loft's sign
    for k, (x, y, z, s) in enumerate(((-10.5, 4.3, 0, 0.5), (-10.0, 4.1, 0, 0.4), (-10.4, 4.25, 0.5, 0.36),
                                      (-11.0, 3.9, 0, 0.3))):
        m.box((s, s * 0.8, s * 0.8), (x, y, z + s * 0.4), "#b98a55")
        m.box((s * 0.4, 0.02, s * 0.25), (x, y - s * 0.41, z + s * 0.5), P.WHITE)
    m.cyl(0.04, 1.3, (-9.6, 3.9, 0), P.IRON, segs=4)
    m.box((1.1, 0.06, 0.45), (-9.6, 3.9, 1.35), "#2a2530")
    m.box((0.8, 0.07, 0.08), (-9.6, 3.9, 1.42), "#e46f5a")
    m.box((0.6, 0.07, 0.06), (-9.65, 3.9, 1.26), P.WHITE)
    m.build(g)


# --- the land --------------------------------------------------------------------------

def greenery(root):
    f = Model("greenery", seed=114)
    for x, y, s in ((-8.0, 8.0, 1.2), (-5.6, 8.2, 1.1), (-1.5, 8.6, 1.0), (3.2, 8.4, 1.15), (10.3, 5.6, 1.1),
                    (-6.3, -4.8, 0.85), (12.6, -6.4, 0.9), (14.6, -1.8, 0.7), (-12.6, -5.6, 0.9)):
        tree(f, (x, y, 0), s)
    for x, y, s in ((-4.0, -10.3, 0.8), (5.8, -10.1, 0.8), (-9.4, -8.2, 0.7), (8.6, -8.6, 0.7), (-15.0, 2.8, 0.7),
                    (9.3, 0.5, 0.6), (-8.5, 1.8, 0.6)):
        bush(f, (x, y, 0), s)
    # hay bales in the field inside the loop: this is the Achterhoek
    for x, y, a in ((4.2, -5.6, 0.2), (5.3, -4.4, 1.3), (6.3, -5.7, 0.6)):
        f.cyl(0.45, 0.6, (x, y, 0.45), "#d9b86a", segs=8, rot=(math.pi / 2, 0, a))
        f.cyl(0.3, 0.62, (x, y, 0.45), "#c9a458", segs=8, rot=(math.pi / 2, 0, a))
    f.build(root)


def build():
    root = group("room")
    plinth(root, RX, RY, seed=11, centre=CENTRE)
    clouds(root, RX, RY, seed=12, centre=CENTRE)
    ampsen(root)
    ampsen_grounds(root)
    road(root)
    bus(root)
    halte(root)
    truck(root)
    warehouse(root)
    going_dutch(root)
    verkeersleiding(root)
    berlin(root)
    greenery(root)
