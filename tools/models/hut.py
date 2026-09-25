"""The mountain hut, inside: one pine-panelled room under the gable, as a dollhouse cutaway,
exported on its own as hut.glb.

Like the lighthouse the camera looks in from the south-east, so the north and west walls stand
full height (the north one is the gable end, rising to the ridge) and the south and east walls
are sawn off low. x = east, y = north, z = up, the floor at z = 0.

Vincent's bed is in the north-west corner, under the little west window, with a candle on the
nightstand. The stove is lit along the north wall, the long table is laid for soup, and the
boots wait in a row by the door. The runtime (src/island/scene/hut-room.ts) drives:
  window_glass  the sky outside          steam  rises from the kettle and the soup pot
  the rest      things you can click (ids)
"""
from __future__ import annotations

import math

import palette as P
from kit import Model, emitter, group, light

W, D = 9.0, 7.0                    # inside of the room
EAVE, RIDGE = 2.9, 4.7             # wall height at the sides, and under the ridge
T = 0.35
X0, X1 = -W / 2, W / 2
Y0, Y1 = -D / 2, D / 2
CUT = 0.5

BED = (X0 + 0.62, Y1 - 1.12)       # the middle of Vincent's bed
STOVE = (-1.3, Y1 - 0.5)
TABLE = (2.0, -0.4)
DOOR_Y = -2.5                      # the door out, in the west wall


def half_width(z: float) -> float:
    """How far the north (gable) wall reaches each side of the middle at height z."""
    if z <= EAVE:
        return W / 2 + T
    return (W / 2 + T) * max(0.0, (RIDGE - z) / (RIDGE - EAVE))


def shell(root):
    m = Model("room", seed=81)
    m.box((W + 2 * T + 0.3, D + 2 * T + 0.3, 0.6), (0, 0, -0.4), P.STONE_DARK)
    boards = [P.PINE_PANEL, P.WOOD_LIGHT, P.PINE_PANEL, P.PLANK, P.PINE_PANEL_DARK]
    y = Y0 - T
    while y < Y1 - 1e-6:                                    # wide boards running east-west
        w = min(0.45, Y1 - y)
        m.box((W + T, w, 0.1), (-T / 2, y + w / 2, -0.05), boards[m.rng.randrange(len(boards))])
        y += w

    # the gable end: log walls right up to the ridge
    m.prism([(X0 - T, 0), (X1 + T, 0), (X1 + T, EAVE), (0, RIDGE), (X0 - T, EAVE)], T, (0, Y1 + T / 2, 0), P.PINE_PANEL)
    m.box((T, D + T, EAVE), (X0 - T / 2, -T / 2, EAVE / 2), P.PINE_PANEL)
    m.box((T, D + T, CUT), (X1 + T / 2, -T / 2, CUT / 2), P.PINE_PANEL)
    m.box((W, T, CUT), (0, Y0 - T / 2, CUT / 2), P.PINE_PANEL)
    m.box((T, D + T, 0.04), (X0 - T / 2, -T / 2, EAVE + 0.02), P.WALL_CUT)
    m.box((T, D + T, 0.04), (X1 + T / 2, -T / 2, CUT + 0.02), P.WALL_CUT)
    m.box((W, T, 0.04), (0, Y0 - T / 2, CUT + 0.02), P.WALL_CUT)
    # the log courses, as dark seams, on the two tall walls
    z = 0.3
    while z < RIDGE - 0.15:
        hw = half_width(z) - T
        if hw > 0.1:
            m.box((2 * hw, 0.04, 0.035), (0, Y1 - 0.015, z), P.PINE_PANEL_DARK)
        if z < EAVE - 0.05:
            m.box((0.04, D, 0.035), (X0 + 0.015, 0, z), P.PINE_PANEL_DARK)
        z += 0.3
    # the roof in section along the gable, slate on rafters, and the ridge beam
    for side in (-1, 1):
        a, b = (side * (W / 2 + T + 0.45), Y1 + T / 2, EAVE - 0.3), (0, Y1 + T / 2, RIDGE + 0.15)
        m.plank_line(a, b, 0.28, T + 0.3, P.WALL_CUT)
        m.plank_line((a[0], a[1], a[2] - 0.2), (b[0], b[1], b[2] - 0.2), 0.14, T + 0.05, P.WOOD_DARK)
    m.box((0.22, 1.0, 0.24), (0, Y1 - 0.45, RIDGE - 0.3), P.WOOD_DARK)
    # a skirting board, and the corner post
    m.box((W, 0.06, 0.14), (0, Y1 - 0.03, 0.07), P.WOOD_DARK)
    m.box((0.06, D, 0.14), (X0 + 0.03, 0, 0.07), P.WOOD_DARK)
    m.box((0.22, 0.22, EAVE), (X0 + 0.08, Y1 - 0.08, EAVE / 2), P.WOOD_DARK)
    m.build(root)


def windows(root):
    """A window over the counter, one over the bed, and a little one up in the gable."""
    glass = Model("window_glass")
    frame = Model("window_frame")
    curtains = Model("curtains")
    panes = [  # (centre, size, facing): x-y centre on the wall, width, height, which wall
        ((2.9, Y1), 1.05, 0.9, 1.75, "north"),
        ((0.0, Y1), 0.6, 0.5, 3.75, "north"),
        ((X0, BED[1] - 0.1), 0.8, 0.7, 1.75, "west"),
    ]
    for (x, y), w, h, z, wall in panes:
        north = wall == "north"
        size = lambda a, b, c: (a, b, c) if north else (b, a, c)  # noqa: E731
        at = lambda dx, dy, dz: (x + dx, y + dy, z + dz) if north else (x + dy, y + dx, z + dz)  # noqa: E731
        inset = -0.01 if north else 0.01
        glass.box(size(w, 0.05, h), at(0, inset, 0), P.SKY_DAY, glow=True)
        for dz in (-h / 2 - 0.05, h / 2 + 0.05):
            frame.box(size(w + 0.2, 0.12, 0.1), at(0, -0.05 if north else 0.05, dz), P.WOOD_DARK)
        for dx in (-w / 2 - 0.05, 0, w / 2 + 0.05):
            frame.box(size(0.08 if dx else 0.05, 0.1, h), at(dx, -0.04 if north else 0.04, 0), P.WOOD_DARK)
        frame.box(size(w, 0.08, 0.05), at(0, -0.04 if north else 0.04, 0), P.WOOD_DARK)
        frame.box(size(w + 0.3, 0.2, 0.06), at(0, -0.1 if north else 0.1, -h / 2 - 0.12), P.WOOD_LIGHT)  # sill
        if h > 0.6:                                            # red and white check curtains
            for s in (-1, 1):
                for k in range(4):
                    c = P.RED if (k % 2) else P.WHITE
                    curtains.box(size(0.1, 0.05, h + 0.05), at(s * (w / 2 + 0.05 + k * 0.08), -0.12 if north else 0.12, 0.02),
                                 c)
                curtains.box(size(0.5, 0.04, 0.04), at(s * (w / 2 + 0.17), -0.15 if north else 0.15, h / 2 + 0.12), P.GOLD)
    glass.build(root)
    frame.build(root)
    curtains.build(root)

    # geraniums on the counter window's sill, the same as outside
    g = Model("geraniums")
    for k in range(3):
        x = 2.55 + k * 0.35
        g.cyl(0.08, 0.13, (x, Y1 - 0.12, 1.24), P.RUST_ROOF, segs=6, r_top=0.1)
        g.ball(0.11, (x, Y1 - 0.12, 1.43), P.LEAF[2], subdiv=1, jitter=0.02)
        g.ball(0.05, (x + 0.03, Y1 - 0.16, 1.53), P.RED if k % 2 else "#e04868", subdiv=1)
    g.build(root)


def bed(root):
    """Vincent's bed: a carved pine box bed in the corner, made up with a red check duvet, his name
    on a board over it, and on the nightstand a candle, an alarm clock and a notebook."""
    bx, by = BED
    length, width = 2.1, 1.1
    g = group("bed", parent=root, id="bed")
    m = Model("bed_frame", seed=82)
    for dx in (-width / 2, width / 2):                                                  # posts
        m.box((0.1, 0.1, 1.2), (bx + dx, by + length / 2, 0.6), P.WOOD)
        m.box((0.1, 0.1, 0.75), (bx + dx, by - length / 2, 0.375), P.WOOD)
        m.box((0.06, length, 0.26), (bx + dx, by, 0.34), P.WOOD)                        # side rails
    m.box((width, 0.06, 0.8), (bx, by + length / 2, 0.75), P.WOOD_LIGHT)                # headboard
    m.box((width, 0.06, 0.35), (bx, by - length / 2, 0.52), P.WOOD_LIGHT)               # footboard
    for dx in (-0.075, 0.075):                                                          # a heart cut in the headboard
        m.ball(0.09, (bx + dx, by + length / 2 - 0.035, 0.97), P.WOOD_DARK, subdiv=1, scale=(1, 0.3, 1))
    m.box((0.14, 0.03, 0.14), (bx, by + length / 2 - 0.035, 0.89), P.WOOD_DARK, rot=(0, math.pi / 4, 0))
    m.box((width - 0.08, length - 0.1, 0.18), (bx, by, 0.46), P.WHITE)                  # mattress
    m.ball(0.2, (bx, by + length / 2 - 0.3, 0.6), P.WHITE, subdiv=2, scale=(2.2, 1.1, 0.5))  # pillow
    # the duvet, in red and white checks, turned back at the top
    n, cols = 7, 5
    cw, cl = (width - 0.02) / cols, 1.45 / n
    for i in range(n):
        for j in range(cols):
            c = P.RED if (i + j) % 2 else P.WHITE
            m.box((cw, cl, 0.1), (bx - width / 2 + 0.01 + (j + 0.5) * cw, by - length / 2 + 0.07 + (i + 0.5) * cl, 0.6), c)
    m.box((width + 0.02, 0.18, 0.13), (bx, by - length / 2 + 0.07 + n * cl + 0.05, 0.61), P.WHITE)
    for dx in (-width / 2 - 0.01, width / 2 + 0.01):                                    # it hangs over the sides
        m.box((0.02, 1.45, 0.18), (bx + dx, by - length / 2 + 0.07 + 0.725, 0.52), P.RED)
    m.box((0.8, 0.35, 0.1), (bx, by - length / 2 + 0.3, 0.7), P.BLANKET)                # a wool blanket, folded
    m.box((0.8, 0.02, 0.1), (bx, by - length / 2 + 0.3, 0.705), P.BLANKET_STRIPE)
    # his name, on a board over the bed
    m.box((1.0, 0.04, 0.24), (bx, Y1 - 0.02, 1.62), P.WOOD_DARK)
    for k in range(7):                                                                  # V I N C E N T
        m.box((0.075, 0.02, 0.12), (bx - 0.36 + k * 0.12, Y1 - 0.045, 1.62), P.CANVAS)
    m.build(g)

    # a rag rug to step out onto
    r = Model("bed_rug", seed=83)
    for k in range(6):
        r.box((0.7, 0.22, 0.03), (bx + width / 2 + 0.45, by - 0.55 + k * 0.22, 0.015),
              [P.TILE_BLUE, P.CANVAS, P.RUG, P.CANVAS, P.TENT_GREEN, P.CANVAS][k])
    r.build(root)

    nx, ny = bx + width / 2 + 0.4, Y1 - 0.3
    s = Model("nightstand")
    s.box((0.5, 0.45, 0.55), (nx, ny, 0.275), P.WOOD)
    s.box((0.56, 0.5, 0.05), (nx, ny, 0.575), P.WOOD_LIGHT)
    s.box((0.36, 0.02, 0.18), (nx, ny - 0.235, 0.36), P.WOOD_DARK)                      # a drawer
    s.cyl(0.07, 0.03, (nx + 0.12, ny + 0.05, 0.6), P.GOLD, segs=8)                      # the candle, on a brass dish
    s.cyl(0.035, 0.16, (nx + 0.12, ny + 0.05, 0.63), P.WHITE, segs=6)
    s.ball(0.025, (nx + 0.12, ny + 0.05, 0.815), P.LANTERN, subdiv=1, scale=(1, 1, 1.6), glow=True)
    s.build(root)
    light(root, (nx + 0.12, ny + 0.05, 0.9), P.WARM_LIGHT, 2.8, 0.7, flicker=0.35)

    c = group("alarm_clock", parent=root, id="alarm_clock")
    a = Model("alarm_clock_body")
    a.cyl(0.09, 0.07, (nx - 0.1, ny + 0.08, 0.69), P.RED, segs=10, rot=(math.pi / 2, 0, 0))
    a.cyl(0.075, 0.01, (nx - 0.1, ny + 0.04, 0.69), P.WHITE, segs=10, rot=(math.pi / 2, 0, 0))
    for dx in (-0.06, 0.06):
        a.ball(0.035, (nx - 0.1 + dx, ny + 0.08, 0.79), P.GOLD, subdiv=1)               # bells
        a.box((0.02, 0.02, 0.06), (nx - 0.1 + dx * 0.9, ny + 0.08, 0.62), P.IRON)       # feet
    a.build(c)

    j = group("dream_journal", parent=root, id="dream_journal")
    b = Model("dream_journal_cover")
    b.box((0.2, 0.28, 0.035), (nx - 0.05, ny - 0.1, 0.618), P.NIGHT_BLUE, rot=(0, 0, 0.25))
    b.box((0.19, 0.265, 0.025), (nx - 0.045, ny - 0.1, 0.62), P.WHITE, rot=(0, 0, 0.25))
    b.ball(0.02, (nx - 0.02, ny - 0.06, 0.637), P.GOLD, subdiv=1, scale=(1, 1, 0.3))   # a moon on the cover
    b.plank_line((nx - 0.2, ny - 0.22, 0.63), (nx + 0.02, ny - 0.28, 0.63), 0.015, 0.015, P.GOLD)  # its pencil
    b.build(j)

    # his headlamp, hung on the bedpost
    h = group("headlamp", parent=root, id="headlamp")
    l = Model("headlamp_band")
    px, py = bx + width / 2, by + length / 2
    l.cyl(0.09, 0.04, (px, py - 0.07, 1.02), P.PACK, segs=10, rot=(math.pi / 2, 0, 0))
    l.box((0.08, 0.05, 0.06), (px + 0.02, py - 0.13, 0.95), P.IRON)
    l.box((0.04, 0.01, 0.03), (px + 0.02, py - 0.16, 0.95), P.LANTERN, glow=True)
    l.build(h)


def stove(root):
    """A cast-iron range against the north wall, lit, with the kettle and the soup on, a pipe up
    into the gable, and a line of socks drying over it."""
    sx, sy = STOVE
    g = group("stove", parent=root, id="stove")
    m = Model("stove_body")
    m.box((1.8, 1.0, 0.04), (sx, sy + 0.05, 0.02), P.STONE)                              # hearth stone
    m.box((1.3, 0.72, 0.82), (sx, sy, 0.45), P.IRON)
    m.box((1.36, 0.78, 0.06), (sx, sy, 0.88), "#3d384a")                                 # hob
    m.box((0.38, 0.03, 0.3), (sx - 0.3, sy - 0.37, 0.48), P.FIREBOX)                    # firebox door
    m.box((0.28, 0.02, 0.14), (sx - 0.3, sy - 0.385, 0.5), P.FIRE, glow=True)          # the fire, through the grille
    for dz in (0.44, 0.48, 0.52, 0.56):
        m.box((0.3, 0.03, 0.012), (sx - 0.3, sy - 0.39, dz), P.IRON)
    m.box((0.45, 0.03, 0.3), (sx + 0.3, sy - 0.37, 0.48), "#3d384a")                    # oven door
    m.box((0.3, 0.04, 0.03), (sx + 0.3, sy - 0.4, 0.6), P.TUNER)
    m.box((1.36, 0.04, 0.04), (sx, sy - 0.46, 0.76), P.TUNER)                           # towel rail
    m.box((0.28, 0.02, 0.3), (sx + 0.25, sy - 0.47, 0.64), P.WHITE)                      # a tea towel on it
    m.box((0.28, 0.021, 0.04), (sx + 0.25, sy - 0.475, 0.6), P.RED)
    for dx in (-0.55, 0.55):
        for dy in (-0.3, 0.3):
            m.box((0.08, 0.08, 0.08), (sx + dx, sy + dy, 0.04), P.IRON)
    m.cyl(0.11, 2.3, (sx + 0.4, sy + 0.2, 0.9), P.IRON, segs=8)                         # the stovepipe
    m.cyl(0.13, 0.08, (sx + 0.4, sy + 0.2, 2.2), P.TUNER, segs=8)                       # its damper collar
    m.build(g)
    # tiles behind it, green and white
    t = Model("stove_tiles")
    for i in range(8):
        for j in range(6):
            t.box((0.22, 0.02, 0.22), (sx - 0.77 + i * 0.22, Y1 - 0.02, 0.2 + j * 0.22),
                  P.STOVE_TILE if (i + j) % 2 else P.TILE)
    t.build(root)
    light(root, (sx - 0.3, sy - 0.8, 0.55), P.FIRE, 4.5, 1.2, flicker=0.6)

    k = group("kettle", parent=root, id="kettle")
    kt = Model("kettle_body")
    kx, ky = sx - 0.32, sy - 0.05
    kt.cyl(0.17, 0.22, (kx, ky, 0.91), P.RED, segs=8, r_top=0.12)
    kt.cyl(0.05, 0.05, (kx, ky, 1.13), P.INK, segs=5)
    kt.plank_line((kx - 0.14, ky, 0.98), (kx - 0.3, ky - 0.02, 1.12), 0.04, 0.04, P.RED)  # spout
    kt.plank_line((kx - 0.08, ky, 1.2), (kx + 0.08, ky, 1.2), 0.03, 0.03, P.INK)       # handle
    kt.build(k)
    emitter(root, (kx - 0.32, ky - 0.02, 1.16), "steam")

    p = group("soup_pot", parent=root, id="soup_pot")
    pt = Model("soup_pot_body")
    px, py = sx + 0.15, sy + 0.05
    pt.cyl(0.2, 0.26, (px, py, 0.91), P.IRON, segs=10)
    pt.cyl(0.18, 0.01, (px, py, 1.15), P.SOUP, segs=10)
    for dx in (-0.23, 0.23):
        pt.box((0.07, 0.04, 0.04), (px + dx, py, 1.1), P.IRON)
    pt.plank_line((px + 0.05, py - 0.02, 1.1), (px + 0.2, py - 0.12, 1.45), 0.03, 0.03, P.WOOD_LIGHT)  # the ladle
    pt.build(p)
    emitter(root, (px, py, 1.2), "steam")

    # a basket of logs by the stove
    b = Model("log_basket", seed=84)
    lx, ly = sx + 1.15, Y1 - 0.4
    b.cyl(0.3, 0.4, (lx, ly, 0), P.WICKER, segs=8, r_top=0.34)
    for i in range(5):
        a = i * 1.3
        b.cyl(0.07, 0.6, (lx + math.cos(a) * 0.14, ly + math.sin(a) * 0.14, 0.05), P.WOOD_LIGHT,
              segs=6, rot=(0.18, 0, a + math.pi / 2))
    b.build(root)

    # socks drying on a line over the stove
    s = group("socks", parent=root, id="socks")
    sk = Model("socks_line")
    x0, x1, z = sx - 1.1, sx + 1.1, 2.15
    sk.plank_line((x0, sy - 0.2, z), (x1, sy - 0.2, z), 0.015, 0.015, P.CANVAS)
    for x in (x0, x1):
        sk.plank_line((x, sy - 0.2, z), (x, Y1 - 0.02, z + 0.05), 0.03, 0.03, P.WOOD_DARK)
    for k_, (dx, c) in enumerate([(-0.75, P.BLANKET), (-0.5, P.BLANKET), (-0.05, P.RED), (0.2, P.TENT_GREEN),
                                  (0.6, P.CANVAS), (0.85, P.TILE_BLUE)]):
        sk.box((0.1, 0.05, 0.34), (sx + dx, sy - 0.2, z - 0.18), c)
        sk.box((0.17, 0.05, 0.08), (sx + dx + 0.04, sy - 0.2, z - 0.33), c)            # the foot
        sk.box((0.11, 0.055, 0.05), (sx + dx, sy - 0.2, z - 0.03), P.WHITE if c != P.WHITE else P.RED)
    sk.build(s)


def counter(root):
    """Under the north window: a counter with the bread and the mugs, pans on hooks, and the
    schnapps on a shelf."""
    x0, x1 = 1.6, X1
    depth, top = 0.6, 0.88
    yc = Y1 - depth / 2
    m = Model("counter", seed=85)
    m.box((x1 - x0, depth - 0.05, top - 0.08), (0.5 * (x0 + x1), yc + 0.02, (top - 0.08) / 2), P.PINE_PANEL_DARK)
    for k in range(3):
        dx = x0 + (k + 0.5) * (x1 - x0) / 3
        m.box(((x1 - x0) / 3 - 0.1, 0.03, top - 0.28), (dx, Y1 - depth - 0.005, top / 2 - 0.02), P.WOOD)
        m.cyl(0.03, 0.03, (dx, Y1 - depth - 0.02, top - 0.24), P.IRON, segs=5, rot=(math.pi / 2, 0, 0))
    m.box((x1 - x0 + 0.04, depth + 0.04, 0.08), (0.5 * (x0 + x1), yc, top - 0.04), P.BUTCHER_BLOCK)
    # the loaf on its board
    m.box((0.55, 0.32, 0.04), (2.0, yc, top + 0.02), P.WOOD_LIGHT)
    m.ball(0.14, (1.95, yc, top + 0.1), P.BREAD, subdiv=2, scale=(1.6, 1.0, 0.75))
    m.ball(0.1, (2.2, yc, top + 0.08), P.BREAD_CUT, subdiv=1, scale=(0.3, 1.0, 0.85))
    # the shelf of schnapps and mugs, and the pans
    m.box((1.4, 0.26, 0.05), (4.0, Y1 - 0.13, 2.3), P.WOOD)
    for k, c in enumerate(["#cfe6c8", "#e8c48a", "#cfe6c8"]):
        x = 3.5 + k * 0.22
        m.cyl(0.06, 0.24, (x, Y1 - 0.13, 2.325), c, segs=6)
        m.cyl(0.025, 0.08, (x, Y1 - 0.13, 2.565), c, segs=5)
    for k, c in enumerate([P.WHITE, P.RED, P.WHITE]):
        m.cyl(0.065, 0.13, (4.25 + k * 0.2, Y1 - 0.13, 2.325), c, segs=6)
    m.box((1.2, 0.05, 0.05), (4.0, Y1 - 0.05, 1.95), P.WOOD_DARK)                       # the pan rail
    for k, r in enumerate((0.16, 0.2, 0.13)):
        x = 3.6 + k * 0.4
        m.plank_line((x, Y1 - 0.07, 1.93), (x, Y1 - 0.07, 1.78), 0.015, 0.015, P.IRON)
        m.cyl(r, 0.04, (x, Y1 - 0.08, 1.75 - r), P.COPPER, segs=10, rot=(math.pi / 2, 0, 0))
    m.build(root)

    # the coffee: a capsule machine that made it all the way up here, and its tower of capsules
    g = group("nespresso", parent=root, id="nespresso")
    c = Model("nespresso_body")
    cx, cy = 3.75, yc + 0.02
    c.box((0.26, 0.4, 0.34), (cx, cy + 0.02, top + 0.17), P.INK)
    c.cyl(0.13, 0.4, (cx, cy + 0.22, top + 0.34), P.INK, segs=10, rot=(math.pi / 2, 0, 0))   # rounded top
    c.box((0.2, 0.2, 0.26), (cx, cy + 0.12, top + 0.36), "#cfd4dc", taper=0.9)              # water tank
    c.box((0.24, 0.06, 0.04), (cx, cy - 0.2, top + 0.47), P.TUNER, rot=(-0.35, 0, 0))       # the lever
    c.box((0.06, 0.03, 0.03), (cx + 0.08, cy - 0.19, top + 0.38), P.LANTERN, glow=True)     # the button, lit
    c.box((0.08, 0.06, 0.05), (cx, cy - 0.2, top + 0.3), P.TUNER)                           # spout
    c.box((0.24, 0.16, 0.03), (cx, cy - 0.26, top + 0.015), P.TUNER)                        # drip tray
    c.cyl(0.05, 0.08, (cx, cy - 0.24, top + 0.03), P.WHITE, segs=8)                         # the cup, filling
    c.cyl(0.042, 0.005, (cx, cy - 0.24, top + 0.108), P.COFFEE, segs=8)
    c.build(g)
    emitter(root, (cx, cy - 0.24, top + 0.14), "steam")

    t = group("capsules", parent=root, id="capsules")
    k = Model("capsule_tower")
    tx = cx + 0.42
    k.cyl(0.1, 0.02, (tx, cy, top), P.IRON, segs=8)
    k.cyl(0.012, 0.5, (tx, cy, top), P.TUNER, segs=4)
    for i, col in enumerate(P.CAPSULES * 2):                                                # a spiral of colours
        a = i * 0.9
        k.cyl(0.035, 0.03, (tx + math.cos(a) * 0.06, cy + math.sin(a) * 0.06, top + 0.05 + i * 0.037), col, segs=6)
    k.build(t)


def table(root):
    """The long table: soup for three, the bread, a candle in a jar, the guestbook and the map."""
    tx, ty = TABLE
    L, Wd, top = 3.1, 1.05, 0.78
    m = Model("table", seed=86)
    m.box((L, Wd, 0.08), (tx, ty, top - 0.04), P.WOOD_LIGHT)
    for dx in (-L / 2 + 0.25, L / 2 - 0.25):                                            # trestle legs
        m.box((0.12, Wd - 0.2, 0.08), (tx + dx, ty, 0.04), P.WOOD)
        m.box((0.1, 0.12, top - 0.08), (tx + dx, ty, (top - 0.08) / 2), P.WOOD)
    m.box((L - 0.5, 0.08, 0.08), (tx, ty, 0.3), P.WOOD)
    for dy in (-Wd / 2 - 0.4, Wd / 2 + 0.4):                                            # a bench each side
        m.box((L - 0.2, 0.34, 0.07), (tx, ty + dy, 0.44), P.WOOD)
        for dx in (-L / 2 + 0.3, L / 2 - 0.3):
            m.box((0.08, 0.28, 0.42), (tx + dx, ty + dy, 0.21), P.WOOD_DARK)
    for k in range(int(L / 0.18)):                                                      # a check runner down the middle
        m.box((0.18, 0.4, 0.01), (tx - L / 2 + 0.09 + k * 0.18, ty, top + 0.005), P.RED if k % 2 else P.WHITE)
    for dy in (-0.1, 0.1):
        for k in range(int(L / 0.18)):
            if k % 2 == 0:
                m.box((0.18, 0.1, 0.012), (tx - L / 2 + 0.09 + k * 0.18, ty + dy, top + 0.006), P.RED)
    m.build(root)

    g = group("soup", parent=root, id="soup")
    s = Model("soup_bowls")
    for bx, by in ((tx - 0.9, ty - 0.33), (tx + 0.1, ty - 0.33), (tx - 0.4, ty + 0.33)):
        s.cyl(0.14, 0.09, (bx, by, top), P.WHITE, segs=10, r_top=0.17)
        s.cyl(0.14, 0.01, (bx, by, top + 0.075), P.SOUP, segs=10)
        s.plank_line((bx + 0.17, by - 0.05, top + 0.01), (bx + 0.32, by - 0.12, top + 0.01), 0.03, 0.01, P.TUNER)
    s.cyl(0.18, 0.1, (tx - 0.4, ty - 0.02, top), P.WICKER, segs=8, r_top=0.22)          # bread basket
    for dx in (-0.08, 0.06):
        s.ball(0.07, (tx - 0.4 + dx, ty - 0.02, top + 0.12), P.BREAD, subdiv=1, scale=(1.3, 0.9, 0.7))
    s.build(g)

    j = Model("candle_jar")
    j.cyl(0.07, 0.14, (tx + 0.5, ty + 0.05, top), "#d8e6e0", segs=8)
    j.cyl(0.04, 0.06, (tx + 0.5, ty + 0.05, top + 0.01), P.WHITE, segs=6)
    j.ball(0.02, (tx + 0.5, ty + 0.05, top + 0.09), P.LANTERN, subdiv=1, scale=(1, 1, 1.5), glow=True)
    j.build(root)

    b = group("guestbook", parent=root, id="guestbook")
    gb = Model("guestbook_pages")
    bx, by = tx + 1.0, ty + 0.2
    gb.box((0.62, 0.42, 0.03), (bx, by, top + 0.015), P.LEATHER, rot=(0, 0, -0.15))
    for s_ in (-1, 1):                                                                  # open, pages curling up a little
        gb.box((0.28, 0.38, 0.03), (bx + s_ * 0.15, by - s_ * 0.02, top + 0.04), P.CANVAS, rot=(0, s_ * 0.06, -0.15))
    for k in range(5):                                                                  # lines of names
        gb.box((0.18, 0.015, 0.005), (bx - 0.15 + 0.01 * k, by + 0.12 - k * 0.06, top + 0.058), P.INK, rot=(0, 0, -0.15))
    gb.plank_line((bx + 0.12, by - 0.08, top + 0.07), (bx + 0.3, by + 0.1, top + 0.07), 0.02, 0.02, P.GOLD)  # pen
    gb.build(b)

    mp = group("map", parent=root, id="map")
    ma = Model("map_sheet")
    mx, my = tx + 0.8, ty - 0.33
    ma.box((0.55, 0.4, 0.01), (mx, my, top + 0.012), P.MAP, rot=(0, 0, 0.2))
    ma.ball(0.1, (mx - 0.05, my + 0.02, top + 0.02), P.GRASS[2], subdiv=1, scale=(1.4, 1, 0.05), rot=(0, 0, 0.2))
    ma.ball(0.05, (mx + 0.02, my + 0.04, top + 0.024), P.PEAK_ROCK[2], subdiv=1, scale=(1, 1, 0.05))
    for k in range(4):                                                                  # the trail, in red dashes
        ma.box((0.05, 0.015, 0.005), (mx - 0.14 + k * 0.06, my - 0.08 + k * 0.035, top + 0.03), P.RED, rot=(0, 0, 0.5))
    ma.build(mp)

    # a storm lantern on the table, lit
    lp = Model("table_lantern")
    lx, ly = tx - 1.2, ty + 0.25
    lp.cyl(0.1, 0.03, (lx, ly, top), P.IRON, segs=8)
    lp.cyl(0.08, 0.2, (lx, ly, top + 0.03), P.LANTERN, segs=8, glow=True)
    lp.cyl(0.11, 0.06, (lx, ly, top + 0.23), P.RED, segs=8, r_top=0.04)
    for a in (0, math.pi / 2):
        lp.box((0.2 if a == 0 else 0.015, 0.015 if a == 0 else 0.2, 0.2), (lx, ly, top + 0.13), P.IRON)
    lp.plank_line((lx - 0.1, ly, top + 0.26), (lx + 0.1, ly, top + 0.26), 0.015, 0.015, P.IRON)
    lp.build(root)
    light(root, (tx - 1.2, ty + 0.25, 1.4), P.WARM_LIGHT, 5, 1.0, flicker=0.15)

    rug = Model("table_rug")
    rug.box((3.8, 2.6, 0.03), (tx, ty, 0.015), P.RUG)
    rug.box((3.5, 2.3, 0.035), (tx, ty, 0.018), P.RUG_DARK)
    rug.build(root)


def door(root):
    """The west wall by the door: the boots in a row, coats and ropes on the hooks, and the board
    of hut stamps."""
    d = group("door", parent=root, id="door")
    x, yc, w, h = X0, DOOR_Y, 1.1, 2.2
    m = Model("door_leaf")
    m.box((0.14, w + 0.3, h + 0.15), (x + 0.07, yc, (h + 0.15) / 2), P.WOOD_DARK)
    m.box((0.1, w, h), (x + 0.17, yc, h / 2), P.RED)
    for k in range(4):                                                                  # planks
        m.box((0.02, 0.02, h - 0.1), (x + 0.23, yc - w / 2 + (k + 1) * w / 5, h / 2), "#a8352f")
    m.box((0.02, w - 0.1, 0.1), (x + 0.23, yc, h * 0.3), P.WOOD_DARK)                   # the Z brace
    m.box((0.02, w - 0.1, 0.1), (x + 0.23, yc, h * 0.75), P.WOOD_DARK)
    m.cyl(0.05, 0.04, (x + 0.24, yc - 0.4, 1.1), P.IRON, segs=6, rot=(0, math.pi / 2, 0))
    m.box((0.8, 1.1, 0.03), (x + 0.55, yc, 0.015), P.WICKER)                            # doormat
    m.build(d)

    b = group("boots", parent=root, id="boots")
    bt = Model("boot_row", seed=87)
    bt.box((0.42, 1.9, 0.06), (X0 + 0.25, -0.9, 0.12), P.WOOD)                          # the rack
    colours = [P.BOOT, "#6a3a2a", P.BOOT, "#3b3a42"]
    for k, c in enumerate(colours):
        y = -1.65 + k * 0.48
        for dy in (-0.1, 0.1):
            bt.box((0.32, 0.15, 0.13), (X0 + 0.28, y + dy, 0.21), c)
            bt.box((0.16, 0.15, 0.28), (X0 + 0.2, y + dy, 0.35), c, taper=0.9)
            bt.box((0.33, 0.16, 0.03), (X0 + 0.28, y + dy, 0.155), P.INK)              # soles
            bt.box((0.02, 0.1, 0.02), (X0 + 0.29, y + dy, 0.47), P.RED)                 # laces
    bt.build(b)

    c = Model("coats")
    c.box((0.08, 1.9, 0.08), (X0 + 0.04, -0.9, 1.75), P.WOOD_DARK)                      # the peg rail
    for k, col in enumerate((P.PACK, P.TILE_BLUE, P.OILSKIN)):
        y = -1.55 + k * 0.5
        c.box((0.08, 0.04, 0.04), (X0 + 0.11, y, 1.75), P.WOOD)
        c.box((0.22, 0.42, 0.85), (X0 + 0.16, y, 1.25), col, taper=0.6)
        c.box((0.24, 0.12, 0.12), (X0 + 0.17, y, 1.62), col)                            # the hood, over the peg
    c.build(root)

    r = group("rope", parent=root, id="rope")
    rp = Model("rope_coil")
    ry = -0.1
    for i in range(4):                                                                  # a climbing rope, coiled
        rp.cyl(0.26 - i * 0.01, 0.05, (X0 + 0.14, ry, 1.35 + i * 0.03), P.ROPE, segs=12, r_top=0.26 - i * 0.01,
               rot=(0, math.pi / 2, 0))
    rp.cyl(0.2, 0.08, (X0 + 0.12, ry, 1.38), P.PINE_PANEL, segs=12, rot=(0, math.pi / 2, 0))
    rp.plank_line((X0 + 0.14, ry + 0.02, 1.7), (X0 + 0.14, ry + 0.0, 1.12), 0.07, 0.05, P.ROPE)
    rp.plank_line((X0 + 0.2, ry + 0.35, 1.8), (X0 + 0.2, ry + 0.32, 0.95), 0.05, 0.04, P.WOOD_LIGHT)  # an ice axe
    rp.box((0.05, 0.3, 0.05), (X0 + 0.2, ry + 0.38, 1.8), P.TUNER)
    rp.box((0.05, 0.04, 0.08), (X0 + 0.2, ry + 0.5, 1.76), P.TUNER)
    rp.build(r)

    s = group("stamps", parent=root, id="stamps")
    st = Model("stamp_board", seed=88)
    sy, sz = 0.72, 1.9
    st.box((0.05, 1.0, 0.75), (X0 + 0.03, sy, sz), P.WOOD_DARK)
    st.box((0.05, 0.9, 0.65), (X0 + 0.05, sy, sz), P.CANVAS)
    inks = [P.TILE_BLUE, P.RED, "#3d6a4a", P.NIGHT_BLUE, "#7a2c3a", P.TILE_BLUE, "#3d6a4a", P.RED]
    for k, c in enumerate(inks):                                                        # stamps, a bit crooked
        yy = sy - 0.32 + (k % 4) * 0.21 + st.rng.uniform(-0.02, 0.02)
        zz = sz + (0.14 if k < 4 else -0.14) + st.rng.uniform(-0.03, 0.03)
        st.cyl(0.075, 0.012, (X0 + 0.07, yy, zz), c, segs=10, rot=(0, math.pi / 2, 0))
        st.cyl(0.055, 0.014, (X0 + 0.07, yy, zz), P.CANVAS, segs=10, rot=(0, math.pi / 2, 0))
        st.box((0.016, 0.05, 0.03), (X0 + 0.08, yy, zz), c)
    st.build(s)


def corner(root):
    """The south-east corner: a stack of firewood along the low wall, and an axe in the block."""
    w = Model("woodpile", seed=89)
    for row in range(4):
        for i in range(6 - row):
            y = -3.0 + (i + row * 0.5) * 0.24
            w.cyl(0.11, 0.7, (X1 - 0.45, y, 0.11 + row * 0.2), P.WOOD_LIGHT if (i + row) % 3 else P.PLANK, segs=6,
                  rot=(0, math.pi / 2, 0))
            w.cyl(0.08, 0.705, (X1 - 0.45, y, 0.11 + row * 0.2), P.BREAD_CUT, segs=6, rot=(0, math.pi / 2, 0))
    w.cyl(0.25, 0.45, (X1 - 1.3, -2.9, 0), P.WOOD, segs=8)                              # the chopping block
    w.cyl(0.22, 0.01, (X1 - 1.3, -2.9, 0.45), P.BREAD_CUT, segs=8)
    w.plank_line((X1 - 1.3, -2.9, 0.47), (X1 - 1.45, -2.65, 0.95), 0.05, 0.04, P.WOOD_LIGHT)
    w.box((0.04, 0.2, 0.12), (X1 - 1.3, -2.95, 0.5), P.TUNER, rot=(0.5, 0, 0))
    w.build(root)


def build():
    root = group("hut_interior")
    shell(root)
    windows(root)
    bed(root)
    stove(root)
    counter(root)
    table(root)
    door(root)
    corner(root)
    return root
