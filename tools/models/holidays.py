"""Things that only come out on special days (src/island/scene/calendar.ts decides which days).

Each one hangs off a root tagged `holiday=<occasion>`; on any other day the runtime drops the
whole subtree before it looks for ids, lights and emitters, so a pumpkin's candle doesn't shine
in June. They're built where they stand, in island coordinates.

  kingsday     orange bunting over the plaza and along the pier, a pennant over the summit
               flag, and a vrijmarkt blanket of odds and ends for sale
  shoe         a clog by the campfire with a carrot in it for the horse (the weeks before 5 Dec),
               and on the day a chocolate letter in its place
  sinterklaas  his steamboat moored at the head of the pier, presents on the boards
  halloween    jack-o'-lanterns at the mountain hut's door and on the library's doorstep
  christmas    a tree on the plaza, put up the day after Sinterklaas, lit at night
  christmasday presents under it
  birthday     Vincent's (23 January): balloons tied to the guitar case by the fire
  birthdays    14 August, hers and Charlie's and George's: party hats on the cats, a cake by the
               bench with three candles, balloons tied to its arm
"""
from __future__ import annotations

import math

import bpy

import layout as L
import palette as P
from kit import Model, emitter, group, light
from terrain import Terrain

ORANGE = "#f07a1a"
ORANGE_LIGHT = "#ffa040"
NL_RED = "#c8303a"
NL_WHITE = "#f2ece2"
NL_BLUE = "#2a4f9a"
PUMPKIN = "#e8741c"
PUMPKIN_DARK = "#b8520f"
CANDLE = "#ffb640"


def holiday(name: str, occasion: str, loc=(0, 0, 0), rot_z=0.0, **extras):
    return group(name, loc, rot_z=rot_z, holiday=occasion, **extras)


# --- King's Day ---------------------------------------------------------------------------

def bunting(m: Model, a, b, colors, sag=0.45, every=0.62, size=1.0):
    """A string of pennants from a to b (x, y, z), sagging in the middle."""
    a, b = [float(v) for v in a], [float(v) for v in b]
    length = math.dist(a[:2], b[:2])
    n = max(2, int(length / every))
    heading = math.atan2(b[1] - a[1], b[0] - a[0])
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                    a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t)))
    for p, q in zip(pts, pts[1:]):
        m.plank_line(p, q, 0.04, 0.04, "#e8e0cc")
    for i, (x, y, z) in enumerate(pts[1:-1], 1):
        w, h = 0.5 * size, 0.62 * size
        lift = 0.55 + 0.25 * math.sin(i * 1.7)                    # lifted in the breeze, catching the sun
        m.prism([(-w / 2, 0), (w / 2, 0), (0, -h)], 0.02, (x, y, z - 0.01), colors[i % len(colors)],
                rot=(lift, 0, heading))


def kings_day(t: Terrain):
    root = holiday("kingsday", "kingsday")
    m = Model("bunting", seed=27)
    colors = [ORANGE, ORANGE_LIGHT, NL_RED, ORANGE, NL_WHITE, ORANGE_LIGHT, NL_BLUE]
    px, py = L.PLAZA
    lamps = [(px - 5.2, py + 3), (px + 5.2, py + 3), (px + 5, py - 3.6), (px - 5, py - 3.6)]
    tops = [(x, y, t.sample(x, y) + 2.4) for x, y in lamps]
    for i in range(4):                                               # round the plaza, lamp to lamp…
        bunting(m, tops[i], tops[(i + 1) % 4], colors, sag=0.35)
    bunting(m, tops[0], tops[2], colors, sag=0.4)                    # …and criss-crossed over it
    bunting(m, tops[1], tops[3], colors[::-1], sag=0.4)
    # along the pier, from the lamp at the foot of it to the one at its end
    dx, dy = L.DOCK
    foot = (dx - 1.6, dy + 0.4, t.sample(dx - 1.6, dy + 0.4) + 2.3)
    end = (-1.1 + 0.2, dy + 1.0 - L.DOCK_LEN + 0.3, 2.8)
    bunting(m, foot, end, colors, sag=0.6)
    bunting(m, end, (1.0, end[1] + 0.1, 1.65), colors, sag=0.15, size=0.8)   # and across to the mooring post
    m.build(root, unshaded=1)                                        # thin: it would only shadow itself

    # the summit flag flies an orange pennant above it today (life.ts waves it with the flag)
    sx, sy = L.SUMMIT
    top = group("wimpel", (sx, sy, t.sample(sx, sy) + 3.02), parent=root, id="wimpel")
    w = Model("wimpel")
    w.prism([(0, 0.07), (1.7, 0), (0, -0.07)], 0.02, (0.03, 0, 0), ORANGE)
    w.build(top)
    cap = Model("wimpel_cap")
    cap.ball(0.07, (0, 0, 0), P.GOLD, subdiv=1)
    cap.build(top)

    vrijmarkt(t, root)


def vrijmarkt(t: Terrain, parent):
    """The free market: everybody sells their old things on a blanket on the pavement. The
    island's is a bit of everything: books, a lamp, a teddy, records, a board game, a sign."""
    x, y = 3.4, -12.6
    root = group("vrijmarkt", (x, y, t.sample(x, y)), rot_z=-0.35, parent=parent, id="vrijmarkt")
    m = Model("vrijmarkt", seed=427)
    for i in range(4):                                               # a checked picnic blanket
        for j in range(3):
            m.box((0.5, 0.45, 0.03), (-0.75 + i * 0.5, -0.45 + j * 0.45, 0.02), ORANGE if (i + j) % 2 else NL_WHITE)
    # a stack of old paperbacks
    for k in range(4):
        m.box((0.32, 0.22, 0.06), (-0.7, 0.25, 0.07 + k * 0.06), P.BOOKS[k], rot=(0, 0, m.rng.uniform(-0.3, 0.3)))
    # a lamp with a fringed shade
    m.cyl(0.1, 0.05, (-0.25, 0.3, 0.04), P.GOLD, segs=8)
    m.cyl(0.02, 0.4, (-0.25, 0.3, 0.08), P.GOLD, segs=4)
    m.cyl(0.18, 0.2, (-0.25, 0.3, 0.44), "#e9a7b0", segs=8, r_top=0.1)
    # a teddy bear, sat up
    m.ball(0.12, (0.25, 0.3, 0.14), "#b07a48", subdiv=1, scale=(1, 0.9, 1.1))
    m.ball(0.09, (0.25, 0.27, 0.32), "#b07a48", subdiv=1)
    for s in (-1, 1):
        m.ball(0.035, (0.25 + s * 0.07, 0.27, 0.4), "#8a5a36", subdiv=1)
        m.ball(0.045, (0.25 + s * 0.12, 0.24, 0.1), "#8a5a36", subdiv=1)
    m.ball(0.03, (0.25, 0.19, 0.31), "#e8d0b0", subdiv=1)
    # a crate of records
    m.box((0.36, 0.3, 0.2), (0.7, 0.25, 0.12), P.WOOD_LIGHT)
    for k in range(5):
        m.box((0.3, 0.02, 0.28), (0.7, 0.14 + k * 0.05, 0.2), [P.INK, "#8c2f39", P.INK, "#2f5d8c", P.INK][k])
    # a board game, a mug and a wind-up car at the front
    m.box((0.4, 0.28, 0.06), (-0.5, -0.3, 0.06), "#2f6a3c")
    m.box((0.36, 0.24, 0.005), (-0.5, -0.3, 0.095), "#e8d8a8")
    m.cyl(0.06, 0.12, (0.0, -0.3, 0.04), NL_BLUE, segs=8)
    m.box((0.24, 0.12, 0.08), (0.45, -0.3, 0.08), NL_RED)
    m.box((0.12, 0.1, 0.06), (0.42, -0.3, 0.14), "#9fd0e0")
    for sx in (0.37, 0.53):
        m.cyl(0.03, 0.14, (sx, -0.37, 0.035), P.INK, segs=6, rot=(math.pi / 2, 0, 0))
    # a cardboard sign on a stick: everything must go
    m.cyl(0.02, 0.9, (1.05, -0.45, 0), P.WOOD, segs=4)
    m.box((0.46, 0.03, 0.3), (1.05, -0.47, 0.8), "#c9a86a")
    m.box((0.3, 0.035, 0.05), (1.05, -0.47, 0.84), P.INK)
    m.box((0.2, 0.035, 0.04), (1.05, -0.47, 0.74), P.INK)
    m.build(root)


# --- Sinterklaas ----------------------------------------------------------------------------

def shoe(t: Terrain):
    """A wooden clog put out by the fire, with a carrot in it for the horse (and a hope)."""
    cx, cy = L.CAMPFIRE
    x, y = cx - 0.5, cy - 1.35
    root = holiday("shoe", "shoe", (x, y, t.sample(x, y)), rot_z=0.5, id="shoe")
    root.scale = (1.5, 1.5, 1.5)                                   # so you'd notice it from the plaza
    m = Model("shoe")
    wood, dark = "#e8c77a", "#b8904a"
    m.ball(0.2, (0.02, 0, 0.13), wood, subdiv=2, scale=(1.55, 0.72, 0.62))     # the toe, pointing up a little
    m.ball(0.06, (0.3, 0, 0.19), wood, subdiv=1, scale=(1, 1, 0.8))
    m.cyl(0.15, 0.24, (-0.14, 0, 0.0), wood, segs=8, r_top=0.14)             # the heel
    m.cyl(0.12, 0.02, (-0.1, 0, 0.24), "#3a2a1c", segs=8)                    # the hole you put your foot in
    m.box((0.08, 0.3, 0.02), (0.1, 0, 0.26), dark, rot=(0, 0.35, 0))          # a painted band
    m.build(root)
    # the carrot, leaning out of it, tops and all…
    carrot = Model("carrot")
    carrot.cyl(0.006, 0.42, (-0.08, 0, 0.04), "#f07a1a", segs=6, r_top=0.06, rot=(0, -0.55, 0))
    for a in (-0.4, 0, 0.4):                                       # its greens, fanned out at the top
        carrot.box((0.03, 0.03, 0.2), (-0.36 + a * 0.05, a * 0.12, 0.46), "#4a8a45", rot=(a, -0.7, 0))
    carrot.build(root, holiday="!sinterklaas")
    # …till the morning of the fifth, when the horse has had it and there's a chocolate letter instead
    letter = Model("chocolate_letter")
    letter.prism([(-0.17, 0.3), (-0.09, 0.3), (0, 0.06), (0.09, 0.3), (0.17, 0.3), (0.04, -0.05), (-0.04, -0.05)],
                 0.05, (-0.08, 0, 0.12), "#5a3222", rot=(0, -0.25, math.pi / 2 - 0.2))
    letter.build(root, holiday="sinterklaas")


def steamboat(t: Terrain):
    """Sinterklaas's steamboat, in from Spain, tied up across the head of the pier."""
    dx, dy = L.DOCK
    head = dy + 1.0 - L.DOCK_LEN                                   # the pier's far end
    root = holiday("sinterklaas", "sinterklaas")
    boat = group("steamboat", (-0.8, head - 1.95, 0.0), parent=root, id="steamboat")
    m = Model("steamboat", seed=5)
    plan = [(-2.5, -0.8), (1.5, -0.8), (2.9, 0.0), (1.5, 0.8), (-2.5, 0.8)]
    flare = [(x * 1.06, y * 1.12) for x, y in plan]
    m.slab(plan, -0.4, 0.15, NL_RED)                               # red below the waterline…
    m.slab(plan, 0.15, 0.95, NL_WHITE, top=flare)                  # …white above
    m.slab([(x * 1.05, y * 1.1) for x, y in flare], 0.95, 1.02, NL_RED)   # a red gunwale
    m.slab([(x * 0.98, y * 1.02) for x, y in flare], 1.0, 1.06, P.WOOD_LIGHT)  # the deck
    for i in range(6):                                             # portholes
        m.cyl(0.08, 0.04, (-1.9 + i * 0.6, -0.86, 0.6), P.LANTERN, segs=6, rot=(math.pi / 2, 0, 0), glow=True)
        m.cyl(0.08, 0.04, (-1.9 + i * 0.6, 0.82, 0.6), P.LANTERN, segs=6, rot=(math.pi / 2, 0, 0), glow=True)
    # the deckhouse, windows lit, with a red roof
    m.box((2.0, 1.1, 0.8), (-0.6, 0, 1.45), NL_WHITE)
    for i in range(3):
        for s in (-1, 1):
            m.box((0.34, 0.04, 0.3), (-1.2 + i * 0.6, s * 0.56, 1.55), P.LANTERN, glow=True)
    m.box((2.3, 1.3, 0.1), (-0.6, 0, 1.9), NL_RED)
    m.box((0.9, 0.8, 0.5), (-1.1, 0, 2.2), NL_WHITE)               # the wheelhouse
    m.box((0.7, 0.04, 0.24), (-1.1, -0.41, 2.25), P.LANTERN, glow=True)
    m.box((1.05, 0.95, 0.08), (-1.1, 0, 2.5), NL_RED)
    # the funnel, red with a gold band and a black top, and a whistle on it
    m.cyl(0.26, 1.4, (0.25, 0, 1.95), NL_RED, segs=10)
    m.cyl(0.27, 0.14, (0.25, 0, 2.75), P.GOLD, segs=10)
    m.cyl(0.27, 0.2, (0.25, 0, 3.15), P.INK, segs=10)
    m.cyl(0.05, 0.25, (0.5, 0, 2.3), P.GOLD, segs=5)
    # masts fore and aft, a line of flags between them over the funnel
    m.cyl(0.04, 2.3, (2.1, 0, 1.0), P.WOOD_DARK, segs=5)
    m.cyl(0.04, 1.9, (-2.2, 0, 1.0), P.WOOD_DARK, segs=5)
    bunting(m, (2.1, 0, 3.25), (0.25, 0, 3.4), [NL_RED, P.GOLD, NL_WHITE, NL_BLUE], sag=0.15, every=0.34, size=0.6)
    bunting(m, (0.25, 0, 3.4), (-2.2, 0, 2.85), [NL_RED, P.GOLD, NL_WHITE, NL_BLUE], sag=0.15, every=0.34, size=0.6)
    m.box((0.5, 0.02, 0.32), (-2.47, 0, 2.7), NL_RED)             # a red flag at the stern
    m.ball(0.06, (-2.47, -0.02, 2.72), P.GOLD, subdiv=1)
    # a lifebuoy on the deckhouse, and a gangplank across to the pier
    m.cyl(0.2, 0.08, (0.2, -0.58, 1.4), "#f07a1a", segs=8, rot=(math.pi / 2, 0, 0))
    m.cyl(0.1, 0.1, (0.2, -0.6, 1.4), NL_WHITE, segs=8, rot=(math.pi / 2, 0, 0))
    m.plank_line((1.1, 0.7, 1.06), (1.1, 1.75, 0.8), 0.45, 0.06, P.WOOD_LIGHT)
    m.build(boat)
    emitter(boat, (0.25, 0, 3.4), "smoke")
    light(boat, (-0.6, 0, 1.5), P.WARM_LIGHT, 4, 0.8)

    # on the pier: presents in bright paper, and the sack they came in
    x, y = -0.35, head + 2.3
    gifts = group("presents", (x, y, 0.78), rot_z=0.3, parent=root, id="presents")
    g = Model("presents", seed=12)
    for (gx, gy, s, paper, ribbon) in [(0, 0, 0.36, NL_RED, P.GOLD), (0.38, 0.1, 0.26, NL_BLUE, NL_WHITE),
                                       (0.15, 0.36, 0.22, P.GOLD, NL_RED), (0.02, 0.02, 0.18, "#3d7a4a", P.GOLD)]:
        z = 0.36 if s == 0.18 else 0
        g.box((s, s, s * 0.8), (gx, gy, z + s * 0.4), paper)
        g.box((s + 0.01, 0.04, s * 0.8 + 0.01), (gx, gy, z + s * 0.4), ribbon)
        g.box((0.04, s + 0.01, s * 0.8 + 0.01), (gx, gy, z + s * 0.4), ribbon)
    g.ball(0.32, (-0.45, 0.2, 0.3), "#b8955a", subdiv=1, scale=(1, 1, 1.1), jitter=0.02)  # the jute sack
    g.cyl(0.14, 0.14, (-0.45, 0.2, 0.6), "#b8955a", segs=6, r_top=0.2)
    g.cyl(0.15, 0.04, (-0.45, 0.2, 0.63), NL_RED, segs=6)
    g.build(gifts)


# --- Halloween -------------------------------------------------------------------------------

def jack(m: Model, loc, r: float, carved: bool, seed: float):
    x, y, z = loc
    for k in range(6):                                             # ribbed: a ring of squashed lobes
        a = k / 6 * math.tau + seed
        m.ball(r * 0.62, (x + math.cos(a) * r * 0.4, y + math.sin(a) * r * 0.4, z + r * 0.72),
               PUMPKIN if k % 2 else PUMPKIN_DARK, subdiv=1, scale=(1, 1, 1.05))
    m.ball(r * 0.8, (x, y, z + r * 0.72), PUMPKIN, subdiv=2, scale=(1.1, 1.1, 0.9))
    m.cyl(r * 0.12, r * 0.35, (x, y, z + r * 1.35), "#4d5a2a", segs=5, r_top=r * 0.08, rot=(0.2, 0.1, 0))
    if not carved:
        return
    f = y - r * 0.93                                               # the face, on the south side
    e = r * 0.3
    for s in (-1, 1):                                              # triangle eyes
        m.prism([(-e, -e * 0.7), (e, -e * 0.7), (0, e * 0.8)], 0.06, (x + s * r * 0.36, f, z + r * 0.92), CANDLE, glow=True)
    m.prism([(-e * 0.4, 0), (e * 0.4, 0), (0, e * 0.6)], 0.06, (x, f - 0.005, z + r * 0.68), CANDLE, glow=True)  # the nose
    grin = [(-1, 0.2), (-0.6, -0.15), (-0.35, 0.0), (-0.1, -0.2), (0.15, 0.0), (0.4, -0.2), (0.65, 0.0), (1, 0.2),
            (0.5, -0.45), (-0.5, -0.45)]
    m.prism([(gx * r * 0.5, gz * r * 0.5) for gx, gz in grin], 0.06, (x, f + 0.01, z + r * 0.45), CANDLE, glow=True)


def halloween(t: Terrain):
    hx, hy = L.HUT
    front = hy - 1.75                                              # the door, scaled like the hut
    root = holiday("halloween", "halloween")
    x, y = hx + 0.7, front - 0.15
    lantern = group("pumpkin", (x, y, t.sample(x, y)), rot_z=0.15, parent=root, id="pumpkin")
    m = Model("pumpkin", seed=31)
    jack(m, (0, 0, 0), 0.45, True, 0.0)
    m.build(lantern)
    light(lantern, (0, -0.3, 0.3), CANDLE, 4, 1.0, flicker=1.0)
    # a little one beside it, and one on the other side of the door, not yet carved
    for (px, py, r, carved) in [(hx + 1.3, front - 0.05, 0.28, True), (hx - 0.8, front - 0.1, 0.34, False)]:
        g = group("pumpkin_small", (px, py, t.sample(px, py)), rot_z=-0.2, parent=root)
        s = Model("pumpkin_small", seed=int(px * 10))
        jack(s, (0, 0, 0), r, carved, 0.5)
        s.build(g)
        if carved:
            light(g, (0, -0.2, 0.2), CANDLE, 2, 0.6, flicker=1.0, halo=False)
    # and a pair on the library's doorstep, down where everybody passes
    lx, ly = L.LIBRARY
    for i, (px, py, r, rot) in enumerate([(lx + 1.45, ly - 3.9, 0.52, 0.1), (lx - 1.4, ly - 3.85, 0.42, -0.25)]):
        g = group("pumpkin", (px, py, t.sample(px, py)), rot_z=rot, parent=root, id=f"pumpkin_{i}")
        s = Model("pumpkin", seed=int(px * 10))
        jack(s, (0, 0, 0), r, True, rot)
        s.build(g)
        light(g, (0, -0.3, 0.3), CANDLE, 3, 0.8, flicker=1.0, halo=r > 0.5)


# --- Christmas ---------------------------------------------------------------------------------

def christmas(t: Terrain):
    x, y = -2.9, -6.0
    root = holiday("christmas", "christmas", (x, y, t.sample(x, y)), id="xmas_tree")
    m = Model("xmas_tree", seed=25)
    m.cyl(0.3, 0.45, (0, 0, 0), NL_RED, segs=8, r_top=0.36)       # a red pot
    m.cyl(0.1, 0.5, (0, 0, 0.3), P.BARK, segs=5)
    for i, (r, z, h) in enumerate([(1.25, 0.7, 1.3), (1.0, 1.45, 1.15), (0.75, 2.15, 1.0), (0.48, 2.8, 0.8)]):
        m.cyl(r, h, (0, 0, z), P.PINE[i % 3], segs=9, r_top=0.05)
    m.build(root)
    # baubles and fairy lights, glowing at night
    b = Model("baubles", seed=6)
    rng = b.rng
    for i in range(26):
        z = rng.uniform(0.85, 3.2)
        r = 1.2 * (1 - (z - 0.7) / 3.1) + 0.05
        a = i * 2.4
        colour = [NL_RED, P.GOLD, NL_WHITE, "#6ab0ff", P.GOLD][i % 5]
        b.ball(0.07 if i % 3 else 0.1, (math.cos(a) * r, math.sin(a) * r, z), colour, subdiv=1, glow=True)
    b.build(root)
    star = Model("star")
    pts = [((0.28 if k % 2 == 0 else 0.12) * math.sin(k * math.pi / 5), (0.28 if k % 2 == 0 else 0.12) * math.cos(k * math.pi / 5))
           for k in range(10)]
    star.prism(pts, 0.06, (0, 0, 3.72), "#ffe28a", rot=(0, 0, 0.35), glow=True)
    star.build(root)
    light(root, (0, -0.6, 2.0), "#ffd8a0", 5, 0.8, flicker=0.2)
    light(root, (0, 0, 3.75), "#ffe28a", 2, 0.5, halo=True)

    # on Christmas Day, presents under it
    gifts = holiday("xmas_presents", "christmasday", (x, y - 0.1, t.sample(x, y)))
    g = Model("xmas_presents", seed=24)
    for (gx, gy, s, paper, ribbon) in [(-0.7, -0.7, 0.34, NL_RED, P.GOLD), (0.55, -0.8, 0.28, "#3d7a4a", NL_RED),
                                       (0.05, -1.05, 0.24, P.GOLD, NL_RED), (0.95, -0.2, 0.22, NL_BLUE, NL_WHITE)]:
        g.box((s, s, s * 0.8), (gx, gy, s * 0.4), paper, rot=(0, 0, gx))
        g.box((s + 0.01, 0.04, s * 0.8 + 0.01), (gx, gy, s * 0.4), ribbon, rot=(0, 0, gx))
    g.build(gifts)


# --- a birthday -----------------------------------------------------------------------------------

def balloons(root, bunch):
    """A bunch of balloons on strings from root's origin, each its own part so life.ts can bob them."""
    for i, (bx, by, h, c) in enumerate(bunch):
        bal = group(f"balloon_{i}", (0, 0, 0), parent=root)
        m = Model("balloon")
        m.plank_line((0, 0, 0), (bx, by, h - 0.35), 0.015, 0.015, "#e8e0cc")
        m.ball(0.3, (bx, by, h), c, subdiv=2, scale=(1, 1, 1.2))
        m.cyl(0.05, 0.08, (bx, by, h - 0.4), c, segs=5, r_top=0.02)
        m.build(bal)


def birthday(t: Terrain):
    """Vincent's: balloons tied to the guitar case by the fire, bobbing (life.ts sways them)."""
    cx, cy = L.CAMPFIRE
    x, y = cx + 2.5, cy + 3.0
    root = holiday("balloons", "birthday", (x, y, t.sample(x, y) + 0.35), id="balloons")
    balloons(root, [(-0.3, 0.1, 2.25, ORANGE), (0.25, -0.1, 2.55, "#6ab0ff"), (0.05, 0.3, 2.85, P.GOLD), (0.45, 0.35, 2.15, NL_RED)])


def party_hat(name: str, head: str, loc, tilt, colours):
    """A striped party hat with a pompom, on a cat's head (so it moves with it)."""
    parent = bpy.data.objects.get(head)
    if not parent:
        return
    hat = group(name, loc, parent=parent, holiday="birthdays")
    hat.rotation_euler = tilt
    hat.scale = (1.4, 1.4, 1.4)                                    # a size you'd spot from the plaza
    m = Model(name)
    for i in range(4):                                             # a cone in bands
        r0, r1 = 0.075 * (1 - i / 4), 0.075 * (1 - (i + 1) / 4)
        m.cyl(r0, 0.055, (0, 0, i * 0.055), colours[i % 2], segs=8, r_top=max(r1, 0.004))
    m.ball(0.03, (0, 0, 0.225), NL_WHITE, subdiv=1)
    m.build(hat)


def birthdays(t: Terrain):
    """Hers, Charlie's and George's, all on one day. The bench is where the three of them meet."""
    bx, by = L.BENCH
    c, s = math.cos(0.3), math.sin(0.3)
    z = t.sample(bx, by)
    root = holiday("birthdays", "birthdays")
    # balloons tied to the bench's right arm, leaning away from the tree over it
    tie = group("bench_balloons", (bx + c * 0.95 - s * 0.26, by + s * 0.95 + c * 0.26, z + 1.02), parent=root, id="bench_balloons")
    balloons(tie, [(0.35, 0.2, 1.7, "#e98aa8"), (0.8, 0.35, 2.0, P.GOLD), (0.5, -0.1, 2.3, "#6ab0ff"),
                   (1.05, 0.15, 1.6, NL_WHITE), (0.2, 0.5, 2.05, "#b6a4f0")])
    # a cake on an upturned crate by the bench (the cats have the seat), three candles lit, one each
    along, out = 1.45, -0.1
    cx, cy = bx + c * along + s * out, by + s * along - c * out
    crate = group("cake_crate", (cx, cy, t.sample(cx, cy)), rot_z=0.3, parent=root)
    k = Model("cake_crate")
    k.box((0.55, 0.45, 0.5), (0, 0, 0.25), P.WOOD_LIGHT)
    for zz in (0.12, 0.38):
        k.box((0.57, 0.47, 0.05), (0, 0, zz), P.WOOD)
    k.build(crate)
    cake = group("cake", (cx, cy, t.sample(cx, cy) + 0.5), rot_z=0.3, parent=root, id="cake")
    m = Model("cake")
    m.cyl(0.2, 0.02, (0, 0, 0), NL_WHITE, segs=10)                 # the plate
    m.cyl(0.16, 0.1, (0, 0, 0.02), "#f2e6d0", segs=10)             # sponge…
    m.cyl(0.165, 0.025, (0, 0, 0.07), "#e98aa8", segs=10)          # …jam…
    m.cyl(0.16, 0.08, (0, 0, 0.095), "#f2e6d0", segs=10)
    m.cyl(0.168, 0.03, (0, 0, 0.17), "#fbf4ec", segs=10)           # …icing, dripping a little
    for k in range(8):
        a = k / 8 * math.tau
        m.box((0.035, 0.02, 0.05), (math.cos(a) * 0.16, math.sin(a) * 0.16, 0.16), "#fbf4ec", rot=(0, 0, a))
    for k, col in enumerate(["#6ab0ff", "#e98aa8", P.GOLD]):
        a = k / 3 * math.tau + 0.4
        x, y = math.cos(a) * 0.08, math.sin(a) * 0.08
        m.cyl(0.012, 0.09, (x, y, 0.2), col, segs=4)
        m.ball(0.02, (x, y, 0.31), CANDLE, subdiv=1, scale=(0.8, 0.8, 1.4), glow=True)
    m.build(cake)
    light(cake, (0, 0, 0.4), CANDLE, 2, 0.5, flicker=0.6, halo=False)
    # party hats, on their heads
    party_hat("hat_george", "george_head", (0.07, -0.04, 0.1), (0.35, 0.15, 0), [NL_BLUE, P.GOLD])
    party_hat("hat_charlie", "charlie_head", (0.02, -0.06, 0.09), (0.25, -0.3, 0), ["#e98aa8", NL_WHITE])


def populate(t: Terrain):
    kings_day(t)
    shoe(t)
    steamboat(t)
    halloween(t)
    christmas(t)
    birthday(t)
    birthdays(t)
