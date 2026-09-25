"""The top of the lighthouse: the lamp room, as a dollhouse cutaway, exported on its own as
lamproom.glb.

A twelve-sided iron lantern: a knee wall, tall panes of glass between the astragals and, in the
middle, the great beehive lens turning slowly round its lamp on a clockwork pedestal. Outside
runs the gallery with its railing. The spiral stair comes up through a hatch in the floor.

Like the other interiors the camera looks in from the south-east, so the facets facing north
and west stand full height and the ones facing the camera are sawn off at the knee wall.
x = east, y = north, z = up, the floor at z = 0.

The runtime (src/island/scene/lamp-room.ts) drives:
  window_glass  the sky outside              lens_turn  turns, with the beams, round the lamp
  beam          where the light comes from   the rest   things you can click (ids)
"""
from __future__ import annotations

import math

import palette as P
from kit import Model, group, light

N = 12                              # facets of the lantern
R = 4.2                             # apothem: from the centre to the inside of the knee wall
T = 0.25
KNEE = 1.1                          # the knee wall under the glass
H = 4.6                             # top of the glazing
CUT = 0.45                          # the front facets are sawn off here
GALLERY = 1.3                       # width of the walkway outside
HATCH = (-2.2, 0.1)                 # where the stair comes up
SIDE = 2 * R * math.tan(math.pi / N)
CAMERA = math.atan2(-math.cos(math.radians(22)), math.sin(math.radians(22)))  # towards the camera


def facets():
    """(angle of the facet's outward normal, whether it stands full height)."""
    for i in range(N):
        a = (i + 0.5) / N * math.tau
        yield a, math.cos(a - CAMERA) < 0.15


def at(a, r, z=0.0):
    return (math.cos(a) * r, math.sin(a) * r, z)


def corner(i, r):
    """The corner between facet i-1 and facet i, at apothem r."""
    a = i / N * math.tau
    rr = r / math.cos(math.pi / N)
    return (math.cos(a) * rr, math.sin(a) * rr)


def shell(root):
    m = Model("room", seed=71)
    circ = (R + T) / math.cos(math.pi / N)
    m.cyl(circ + GALLERY + 0.1, 0.5, (0, 0, -0.55), P.STONE_DARK, segs=N)                  # the gallery slab
    m.cyl(circ + GALLERY + 0.15, 0.08, (0, 0, -0.1), P.IRON, segs=N)                      # its iron lip
    m.cyl(circ + GALLERY - 0.05, 0.06, (0, 0, -0.06), P.STONE, segs=N)                    # the walk
    m.cyl(circ, 0.1, (0, 0, -0.1), P.DECK, segs=N)                                         # the floor inside
    for k in range(1, 4):                                                                  # rings of floor plates
        m.cyl(k * R / 4 + 0.03, 0.012, (0, 0, 0), P.IRON, segs=N)
        m.cyl(k * R / 4 - 0.03, 0.014, (0, 0, 0), P.DECK, segs=N)
    for i in range(N):
        x, y = corner(i, R)
        m.plank_line((x * 0.25, y * 0.25, 0.008), (x, y, 0.008), 0.05, 0.012, P.IRON)
    m.cyl(1.25, 0.025, (0, 0, 0), P.GOLD, segs=N)                                         # brass ring round the pedestal
    m.cyl(1.15, 0.03, (0, 0, 0), P.DECK, segs=N)

    for a, full in facets():
        ca, sa = math.cos(a), math.sin(a)
        mid = R + T / 2
        knee = KNEE if full else CUT
        # the knee wall: whitewash inside, red iron outside, with a cap of dark iron
        m.box((T * 0.5, SIDE + 0.02, knee), at(a, R + T * 0.25, knee / 2), P.WHITEWASH, rot=(0, 0, a))
        m.box((T * 0.5, SIDE + 0.02 + T * 0.3, knee), at(a, R + T * 0.75, knee / 2), P.RED, rot=(0, 0, a))
        m.box((T + 0.08, SIDE + T * 0.3, 0.06), at(a, mid, knee + 0.03), P.WALL_CUT if not full else P.IRON, rot=(0, 0, a))
        if not full:
            continue
        m.box((0.03, SIDE * 0.55, 0.28), at(a, R - 0.01, 0.35), P.WAINSCOT_DARK, rot=(0, 0, a))  # a vent
        for k in range(4):
            m.box((0.04, SIDE * 0.5, 0.025), at(a, R - 0.03, 0.26 + k * 0.06), P.IRON, rot=(0, 0, a))
        # the frame of the glazing: a sill, a head, a transom, and diagonal astragals
        m.box((T, SIDE, 0.1), at(a, mid, H), P.IRON, rot=(0, 0, a))
        m.box((0.08, SIDE, 0.06), at(a, R + 0.06, (KNEE + H) / 2 + 0.3), P.IRON, rot=(0, 0, a))
        for s in (-1, 1):
            for z0, z1 in ((KNEE, (KNEE + H) / 2 + 0.3), ((KNEE + H) / 2 + 0.3, H)):
                y0 = -s * SIDE / 2
                p0 = (mid * ca - y0 * sa, mid * sa + y0 * ca, z0)
                p1 = (mid * ca + y0 * sa, mid * sa - y0 * ca, z1)
                m.plank_line(p0, p1, 0.035, 0.05, P.IRON)
    for i in range(N):                                                                     # the mullions at the corners
        a0, a1 = (i - 0.5) / N * math.tau, (i + 0.5) / N * math.tau
        full0 = math.cos(a0 - CAMERA) < 0.15
        full1 = math.cos(a1 - CAMERA) < 0.15
        x, y = corner(i, R + T / 2)
        top = H if (full0 and full1) else (KNEE if (full0 or full1) else CUT)
        m.box((0.14, 0.14, top), (x, y, top / 2), P.IRON, rot=(0, 0, i / N * math.tau))
    # the cornice and the start of the red dome over the tall facets
    for a, full in facets():
        if full:
            m.box((T + 0.3, SIDE + 0.2, 0.18), at(a, R + T / 2, H + 0.12), P.RED, rot=(0, 0, a))
            m.box((0.5, SIDE * 0.9, 0.1), at(a, R - 0.1, H + 0.3), P.RED, rot=(0, -0.55, a))
            m.box((0.52, SIDE * 0.9, 0.03), at(a, R - 0.1, H + 0.24), P.WALL_CUT, rot=(0, -0.55, a))
    m.build(root)

    glass = Model("window_glass")
    for a, full in facets():
        if full:
            glass.box((0.03, SIDE - 0.1, H - KNEE - 0.1), at(a, R + T / 2, (KNEE + H) / 2), P.SKY_DAY, rot=(0, 0, a), glow=True)
    glass.build(root)


def gallery(root):
    """The iron railing round the walkway outside, and a gull who has come to sit on it."""
    m = Model("railing", seed=72)
    rr = (R + T) / math.cos(math.pi / N) + GALLERY - 0.15                              # circumradius of the rail
    for i in range(N):
        a0, a1 = i / N * math.tau, (i + 1) / N * math.tau
        p0 = (math.cos(a0) * rr, math.sin(a0) * rr)
        p1 = (math.cos(a1) * rr, math.sin(a1) * rr)
        m.box((0.1, 0.1, 1.05), (*p0, 0.52), P.IRON)
        for z, w in ((1.05, 0.08), (0.55, 0.04)):
            m.plank_line((*p0, z), (*p1, z), w, w, P.IRON if z < 1 else P.RED)
        for k in range(1, 4):
            t = k / 4
            m.box((0.035, 0.035, 1.0), (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, 0.5), P.IRON)
    m.build(root)

    g = group("gull", parent=root, id="gull")
    b = Model("gull_body")
    a = CAMERA + 0.55
    x, y, _ = at(a, rr * math.cos(math.pi / N) - 0.02)
    z = 1.1
    b.ball(0.2, (x, y, z + 0.16), P.WHITE, subdiv=1, scale=(1.5, 0.8, 0.8), rot=(0, 0, a + math.pi / 2))
    b.ball(0.11, (x + math.cos(a + math.pi / 2) * 0.24, y + math.sin(a + math.pi / 2) * 0.24, z + 0.32), P.WHITE, subdiv=1)
    for s in (-1, 1):                                                                  # grey wings, folded
        b.ball(0.16, (x + math.cos(a) * s * 0.12, y + math.sin(a) * s * 0.12, z + 0.2), P.STONE, subdiv=1,
               scale=(1.6, 0.35, 0.6), rot=(0, 0.2, a + math.pi / 2))
    bx, by = x + math.cos(a + math.pi / 2) * 0.35, y + math.sin(a + math.pi / 2) * 0.35
    b.box((0.05, 0.14, 0.04), (bx, by, z + 0.3), P.GOLD, rot=(0, 0, a))                 # beak
    b.box((0.04, 0.04, 0.02), (bx + math.cos(a + math.pi / 2) * 0.05, by + math.sin(a + math.pi / 2) * 0.05, z + 0.275), P.RED, rot=(0, 0, a))
    tx, ty = x - math.cos(a + math.pi / 2) * 0.3, y - math.sin(a + math.pi / 2) * 0.3
    b.box((0.12, 0.2, 0.05), (tx, ty, z + 0.2), P.INK, rot=(0.3, 0, a + math.pi / 2))
    for s in (-1, 1):
        b.box((0.03, 0.03, 0.1), (x + math.cos(a) * s * 0.06, y + math.sin(a) * s * 0.06, z + 0.03), P.GOLD)
    b.build(g)


def lens(root):
    """The beehive lens on its clockwork pedestal. The lens and its bullseye panels turn."""
    g = group("lens", parent=root, id="lens")
    base = Model("pedestal", seed=73)
    base.cyl(0.95, 0.15, (0, 0, 0), P.IRON, segs=12)
    base.cyl(0.7, 1.0, (0, 0, 0.15), P.IRON, segs=12, r_top=0.55)
    base.cyl(0.72, 0.06, (0, 0, 0.55), P.GOLD, segs=12)
    base.cyl(0.8, 0.12, (0, 0, 1.15), P.GOLD, segs=12)                                   # the brass table
    # the clockwork box on the pedestal's side, its winding crank and the weight chain
    base.box((0.5, 0.45, 0.55), (0.75, -0.1, 0.62), P.WAINSCOT, rot=(0, 0, -0.3))
    base.cyl(0.14, 0.05, (0.99, -0.18, 0.72), P.GOLD, segs=10, rot=(0, math.pi / 2, -0.3))
    base.cyl(0.08, 0.05, (0.99, -0.02, 0.55), P.BRASS_DARK, segs=8, rot=(0, math.pi / 2, -0.3))
    base.plank_line((1.03, -0.19, 0.72), (1.06, -0.2, 0.45), 0.04, 0.04, P.IRON)
    base.cyl(0.035, 0.1, (1.06, -0.2, 0.42), P.WOOD_DARK, segs=5, rot=(0, math.pi / 2, -0.3))
    base.cyl(0.03, 0.02, (0, 0, -0.01), P.INK, segs=4)
    base.build(g)

    turn = group("lens_turn", (0, 0, 1.27), parent=g)
    lz = 0.0
    m = Model("lens_glass", seed=74)
    # the middle drum: tall bullseye panels, each with its bright centre
    drum_r, drum_h = 0.85, 0.8
    m.cyl(drum_r, drum_h, (0, 0, lz + 0.75), P.LENS, segs=8)
    for k in range(8):
        a = (k + 0.5) / 8 * math.tau
        r = drum_r * math.cos(math.pi / 8)
        for j, (rad, c) in enumerate(((0.26, P.LENS_DARK), (0.18, P.LENS), (0.09, P.WHITE))):
            m.cyl(rad, 0.02 + j * 0.015, at(a, r - 0.01, lz + 1.15), c, segs=10, rot=(0, math.pi / 2, a))
    # the prism rings above and below narrow like a beehive; brass bands hold them
    rings = [(0.15, 0.8, 0.7), (0.35, 0.72, 0.62), (0.55, 0.64, 0.5)]
    for z0, r0, r1 in rings:
        m.cyl(r0, 0.18, (0, 0, lz + z0 - 0.04), P.LENS_DARK if z0 == 0.35 else P.LENS, segs=12, r_top=r0 * 1.02)
    for z0, r0, r1 in rings:
        top = lz + 1.55 + (0.55 - z0)
        m.cyl(r1, 0.18, (0, 0, top), P.LENS_DARK if z0 == 0.35 else P.LENS, segs=12, r_top=r1 * 0.82)
    for z, rr in ((0.0, 0.84), (0.72, 0.88), (1.55, 0.88), (2.08, 0.5)):
        m.cyl(rr, 0.035, (0, 0, lz + z), P.GOLD, segs=12)
    for k in range(8):                                                                   # vertical brass ribs
        a = k / 8 * math.tau
        m.plank_line(at(a, 0.82, lz + 0.05), at(a, 0.87, lz + 0.75), 0.025, 0.03, P.BRASS_DARK)
        m.plank_line(at(a, 0.88, lz + 0.75), at(a, 0.88, lz + 1.55), 0.05, 0.04, P.GOLD)
        m.plank_line(at(a, 0.87, lz + 1.55), at(a, 0.47, lz + 2.1), 0.025, 0.03, P.BRASS_DARK)
    m.cyl(0.45, 0.08, (0, 0, lz + 2.12), P.GOLD, segs=12, r_top=0.2)                   # the crown and its vent
    m.cyl(0.1, 0.25, (0, 0, lz + 2.2), P.IRON, segs=6)
    m.cyl(0.18, 0.06, (0, 0, lz + 2.45), P.IRON, segs=6)
    m.build(turn)

    core = Model("lamp_core")                                                            # the burner, seen through the glass
    core.cyl(0.07, 0.6, (0, 0, 1.27 + 0.3), P.BRASS_DARK, segs=6)
    core.ball(0.28, (0, 0, 1.27 + 1.15), P.LANTERN, subdiv=2, scale=(1, 1, 1.3), glow=True)
    core.build(g)
    group("beam", (0, 0, 1.27 + 1.15), parent=root, beam=1)
    light(root, (0, 0, 1.27 + 1.15), P.LANTERN, 7, 1.3, flicker=0.05)


def hatch(root):
    """The stair arrives through a hatch in the floor, with a rail round it and the post's brass knob."""
    g = group("stairs", parent=root, id="stairs")
    hx, hy = HATCH
    m = Model("hatch", seed=75)
    m.box((1.5, 1.5, 0.04), (hx, hy, 0.02), P.INK)                                        # the dark well
    for dx, dy, w, d in ((0, -0.79, 1.62, 0.08), (0, 0.79, 1.62, 0.08), (-0.79, 0, 0.08, 1.62), (0.79, 0, 0.08, 1.62)):
        m.box((w, d, 0.06), (hx + dx, hy + dy, 0.03), P.IRON)
    for k in range(3):                                                                   # the top treads, going down
        a = -0.6 - k * 0.55
        m.box((0.7, 0.3, 0.04), (hx + math.cos(a) * 0.35, hy + math.sin(a) * 0.35, 0.035 - k * 0.012),
              P.WOOD if k % 2 else P.WOOD_LIGHT, rot=(0, 0, a))
    m.cyl(0.06, 1.0, (hx, hy, 0), P.IRON, segs=6)                                       # the newel post comes up
    m.ball(0.1, (hx, hy, 1.05), P.GOLD, subdiv=1)
    # the lid, hinged on the west side and propped open against its stay
    m.box((0.06, 1.45, 1.45), (hx - 0.85, hy, 0.72), P.WOOD_DARK, rot=(0, 0.12, 0))
    for dy in (-0.5, 0.5):
        m.box((0.02, 0.08, 1.3), (hx - 0.82, hy + dy, 0.72), P.IRON, rot=(0, 0.12, 0))
    m.plank_line((hx - 0.79, hy + 0.7, 0), (hx - 0.7, hy + 0.7, 1.1), 0.03, 0.03, P.IRON)
    # a rail on the open sides so nobody backs into the well
    for dx, dy in ((0.8, -0.8), (0.8, 0.8), (-0.8, -0.8)):
        m.box((0.05, 0.05, 1.0), (hx + dx, hy + dy, 0.5), P.IRON)
    m.plank_line((hx - 0.8, hy - 0.8, 1.0), (hx + 0.8, hy - 0.8, 1.0), 0.06, 0.06, P.GOLD)
    m.plank_line((hx + 0.8, hy - 0.8, 1.0), (hx + 0.8, hy + 0.8, 1.0), 0.06, 0.06, P.GOLD)
    m.build(g)
    light(root, (hx, hy, 0.3), P.WARM_LIGHT, 2.5, 0.4, halo=False)                     # the quarters' glow below


def curtains(root):
    """Canvas blinds, let down on the sunny side by day so the lens can't set anything alight."""
    m = Model("curtains", seed=76)
    for a, full in facets():
        if not full or math.cos(a - math.pi * 0.95) < 0.5:                              # on the west, where the sun sets
            continue
        m.plank_line(at(a - 0.25, R - 0.12, H - 0.15), at(a + 0.25, R - 0.12, H - 0.15), 0.04, 0.04, P.GOLD)
        m.box((0.04, SIDE * 0.9, 2.1), at(a, R - 0.1, H - 0.2 - 1.05), P.CANVAS, rot=(0, 0, a))
        for k in range(4):                                                               # folds
            m.box((0.05, 0.05, 2.1), at(a - 0.18 + k * 0.12, R - 0.12, H - 1.25), "#d8c9a8", rot=(0, 0, a))
        m.box((0.08, SIDE * 0.9, 0.08), at(a, R - 0.12, H - 2.28), P.WOOD_DARK, rot=(0, 0, a))  # the weight bar
    for a, full in facets():                                                             # the others rolled up
        if full and math.cos(a - math.pi * 0.95) < 0.5:
            x, y, z = at(a, R - 0.12, H - 0.2)
            half = SIDE * 0.425                                                         # the roll lies along the wall
            m.cyl(0.08, 2 * half, (x - math.sin(a) * half, y + math.cos(a) * half, z), P.CANVAS, segs=6, rot=(math.pi / 2, 0, a))
    m.build(root)


def desk(root):
    """The keeper's desk against the north wall: the log, a mug, a radio and a pressure lamp."""
    a = math.pi * 0.52
    ca, sa = math.cos(a), math.sin(a)
    tx, ty = ca * (R - 0.45), sa * (R - 0.45)
    rot = a + math.pi / 2
    m = Model("desk", seed=77)
    m.box((1.9, 0.8, 0.07), (tx, ty, 0.82), P.WOOD_LIGHT, rot=(0, 0, rot))
    for dx in (-0.85, 0.85):
        for dy in (-0.32, 0.32):
            x = tx + dx * math.cos(rot) - dy * math.sin(rot)
            y = ty + dx * math.sin(rot) + dy * math.cos(rot)
            m.box((0.07, 0.07, 0.8), (x, y, 0.4), P.WOOD_DARK)
    m.box((0.5, 0.35, 0.3), (tx + 0.55 * math.cos(rot), ty + 0.55 * math.sin(rot), 0.84), P.WOOD_DARK, rot=(0, 0, rot))  # drawers
    sx, sy = tx - ca * 0.9, ty - sa * 0.9                                               # the stool
    m.cyl(0.26, 0.06, (sx, sy, 0.6), P.WOOD, segs=8)
    for k in range(3):
        b = k / 3 * math.tau
        m.plank_line((sx + math.cos(b) * 0.22, sy + math.sin(b) * 0.22, 0), (sx + math.cos(b) * 0.15, sy + math.sin(b) * 0.15, 0.6), 0.05, 0.05, P.WOOD_DARK)
    m.build(root)
    top = 0.86

    def pos(dx, dy):
        return (tx + dx * math.cos(rot) - dy * math.sin(rot), ty + dx * math.sin(rot) + dy * math.cos(rot))

    g = group("log", parent=root, id="lamp_log")
    b = Model("log_book")
    x, y = pos(-0.2, -0.05)
    b.box((0.62, 0.44, 0.03), (x, y, top + 0.015), P.LEATHER, rot=(0, 0, rot + 0.1))
    b.box((0.58, 0.4, 0.02), (x, y, top + 0.035), P.WHITE, rot=(0, 0, rot + 0.1))
    b.box((0.02, 0.4, 0.025), (x, y, top + 0.036), P.GOLD, rot=(0, 0, rot + 0.1))
    for k in range(4):                                                                   # the day's entries
        ex, ey = pos(-0.33, -0.18 + k * 0.08)
        b.box((0.2, 0.012, 0.004), (ex, ey, top + 0.047), P.INK, rot=(0, 0, rot + 0.1))
    px, py = pos(0.1, -0.12)
    b.plank_line((px, py, top + 0.05), (px + 0.1, py + 0.18, top + 0.05), 0.015, 0.015, P.INK)  # pen
    b.build(g)

    g = group("radio", parent=root, id="radio")
    r = Model("radio_set")
    x, y = pos(0.55, 0.05)
    r.box((0.46, 0.3, 0.3), (x, y, top + 0.3 + 0.15), "#3a4a3f", rot=(0, 0, rot))
    fx, fy = pos(0.55, -0.11)
    r.box((0.3, 0.02, 0.12), (fx, fy, top + 0.5), P.WARM_LIGHT, rot=(0, 0, rot), glow=True)  # its lit dial
    for d in (-0.1, 0.1):
        kx, ky = pos(0.55 + d, -0.12)
        r.cyl(0.035, 0.03, (kx, ky, top + 0.38), P.TUNER, segs=6, rot=(math.pi / 2, 0, rot))
    ax, ay = pos(0.72, 0.1)
    r.plank_line((ax, ay, top + 0.6), (ax + 0.05, ay + 0.02, top + 1.2), 0.015, 0.015, P.TUNER)
    r.build(g)

    c = Model("desk_things")
    x, y = pos(-0.72, 0.2)
    c.cyl(0.07, 0.13, (x, y, top), P.WHITE, segs=8)                                    # coffee, of course
    c.cyl(0.058, 0.01, (x, y, top + 0.12), P.COFFEE, segs=8)
    x, y = pos(0.1, 0.25)
    c.cyl(0.1, 0.05, (x, y, top), P.GOLD, segs=8)                                      # pressure lamp
    c.cyl(0.07, 0.2, (x, y, top + 0.05), P.WARM_LIGHT, segs=8, glow=True)
    c.cyl(0.09, 0.06, (x, y, top + 0.25), P.GOLD, segs=8, r_top=0.03)
    c.build(root)
    lx, ly = pos(0.1, 0.1)
    light(root, (lx, ly, 1.5), P.WARM_LIGHT, 3, 0.6, flicker=0.15)


def telescope(root):
    """A brass telescope on a tripod by the glass, trained on the sea to the north-west."""
    g = group("telescope", parent=root, id="telescope")
    a = math.pi * 0.78
    x, y, _ = at(a, R - 1.0)
    m = Model("telescope_body")
    for k in range(3):
        b = a + k / 3 * math.tau + 0.4
        m.plank_line((x + math.cos(b) * 0.4, y + math.sin(b) * 0.4, 0), (x, y, 1.25), 0.04, 0.04, P.WOOD_DARK)
    m.cyl(0.06, 0.1, (x, y, 1.22), P.GOLD, segs=6)
    # the tube, pointing out and a little up
    pitch = 0.18
    d = (math.cos(a) * math.cos(pitch), math.sin(a) * math.cos(pitch), math.sin(pitch))
    for r, l0, l1, c in ((0.045, -0.3, 0.05, P.GOLD), (0.06, 0.05, 0.45, P.BRASS_DARK), (0.075, 0.45, 0.6, P.GOLD)):
        m.plank_line((x + d[0] * l0, y + d[1] * l0, 1.36 + d[2] * l0), (x + d[0] * l1, y + d[1] * l1, 1.36 + d[2] * l1), r * 2, r * 2, c)
    m.build(g)


def upkeep(root):
    """What keeps the light burning: paraffin cans, a bucket of rags, spare mantles, a clock."""
    m = Model("upkeep", seed=78)
    a = math.pi * 1.12                                                                    # against the west-south-west wall
    x, y, _ = at(a, R - 0.4)
    for k, (dx, dy) in enumerate(((0, 0), (0.1, 0.45), (-0.35, 0.2))):
        m.box((0.32, 0.26, 0.5), (x + dx, y + dy, 0.25), P.RED if k != 1 else P.WAINSCOT, rot=(0, 0, a + 0.2 * k))
        m.cyl(0.04, 0.06, (x + dx + 0.08, y + dy, 0.5), P.GOLD, segs=5)
    bx, by, _ = at(a + 0.35, R - 0.9)
    m.cyl(0.2, 0.34, (bx, by, 0), P.TUNER, segs=8, r_top=0.24)                         # the bucket
    m.ball(0.14, (bx, by, 0.36), P.CANVAS, subdiv=1, scale=(1.2, 1, 0.5), jitter=0.02)
    m.plank_line((bx - 0.22, by, 0.34), (bx, by, 0.6), 0.02, 0.02, P.IRON)
    m.plank_line((bx, by, 0.6), (bx + 0.22, by, 0.34), 0.02, 0.02, P.IRON)
    ox, oy, _ = at(a - 0.35, R - 0.7)                                                     # a long-spouted oil can
    m.cyl(0.14, 0.18, (ox, oy, 0), P.GOLD, segs=8, r_top=0.05)
    m.plank_line((ox, oy, 0.15), (ox + 0.35, oy - 0.1, 0.35), 0.025, 0.025, P.GOLD)
    m.build(root)

    g = group("clock", parent=root, id="clock")
    c = Model("clock_face")
    for a, full in facets():                                                             # on the knee wall to the north-west
        if full and abs(math.sin(a - math.pi * 0.72)) < 0.3 and math.cos(a - math.pi * 0.72) > 0:
            break
    x, y, _ = at(a, R - 0.05)
    c.cyl(0.26, 0.08, (x, y, 0.65), P.GOLD, segs=12, rot=(0, math.pi / 2, a + math.pi))
    c.cyl(0.21, 0.09, (x, y, 0.65), P.WHITE, segs=12, rot=(0, math.pi / 2, a + math.pi))
    ix, iy, _ = at(a, R - 0.1)
    c.plank_line((ix, iy, 0.65), (ix - math.sin(a) * 0.1, iy + math.cos(a) * 0.1, 0.72), 0.025, 0.01, P.INK)
    c.plank_line((ix, iy, 0.65), (ix, iy, 0.81), 0.02, 0.01, P.INK)
    c.build(g)


def build():
    root = group("lamp_room")
    shell(root)
    gallery(root)
    lens(root)
    hatch(root)
    curtains(root)
    desk(root)
    telescope(root)
    upkeep(root)
    return root
