"""Things that only come out on special days (src/island/scene/calendar.ts decides which days).

Each one hangs off a root tagged `holiday=<occasion>`; on any other day the runtime drops the
whole subtree before it looks for ids, lights and emitters, so a pumpkin's candle doesn't shine
in June. They're built where they stand, in island coordinates.

  kingsday     orange bunting over the plaza and along the pier, a pennant over the summit
               flag, and a vrijmarkt blanket of odds and ends for sale
  easter       eggs for the Easter egg hunt: one in plain sight in Beike's meadow, the rest
               hidden all over the island (easter.ts)
  liberation   5 May: red, white and blue bunting down the summit flag's pole (the 4th's
               half-mast is the runtime lowering the flag: remembrance.ts)
  shoe         a clog by the campfire with a carrot in it for the horse (the weeks before 5 Dec),
               and some mornings a chocolate letter or pepernoten in its place
  steamboat    his steamboat moored at the head of the pier, from the day he arrives to 5 Dec
  sinterklaas  presents on the boards
  halloween    jack-o'-lanterns at the mountain hut's door, on the library's doorstep and down
               the path from the pier; a little graveyard of unfinished projects with a
               pumpkin-headed scarecrow keeping watch and a sheet ghost drifting over it; and
               bats round the lighthouse lamp (the runtime only lets them out after dark)
  christmas    a tree on the plaza, put up the day after Sinterklaas, lit at night; a wreath on
               the hut door, fairy lights along the pier, over the plaza and along the eaves,
               a candle in the library window
  christmasday presents under it
  birthday     Vincent's (23 January): balloons tied to the guitar case by the fire
  birthdays    14 August, Eef's and Charlie's and George's: party hats on the cats, a cake by the
               bench with three candles, balloons tied to its arm
"""
from __future__ import annotations

import math
import random

import bpy

import layout as L
import palette as P
from kit import _CLIPS, Model, animate, emitter, group, light
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


WHITE_BULBS = ["#fff4dc", "#ffeec8"]                                                     # warm white, in the trees
BULBS = ["#ffd27a", "#ff6a4a", "#fff0c8", "#ffd27a", "#7ad28a", "#fff0c8", "#ffb050"]   # mostly warm


def fairy_lights(m: Model, a, b, sag=0.3, every=0.5, size=0.13, k=0):
    """A string of fairy lights from a to b (x, y, z), sagging in the middle; returns the next
    bulb's number, so strings that meet carry on the pattern."""
    n = max(2, round(math.dist(a, b) / every))
    pts = [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n,
            a[2] + (b[2] - a[2]) * i / n - sag * 4 * (i / n) * (1 - i / n)) for i in range(n + 1)]
    for p, q in zip(pts, pts[1:]):
        m.plank_line(p, q, 0.025, 0.025, P.INK)
    for (x, y, z) in pts[1:-1]:
        m.ball(size, (x, y, z - size * 0.7), BULBS[k % len(BULBS)], subdiv=1, glow=True)
        k += 1
    return k


def pine_lights(spots: list, pine, k=0, rng=random):
    """Fairy lights spiralling up a pine (nature.pine: four tiers of cones) from the lowest boughs
    to near the top, just off the needles: adds (x, y, z, colour) to `spots` and returns the next
    bulb's number."""
    size = max(v.co.z for v in pine.data.vertices) / 5.55
    ox, oy, oz = pine.parent.location
    tiers = [((0.8 + i * 1.05) * size, (1.6 - i * 0.33) * size) for i in range(4)]
    h = 1.6 * size

    def reach(z):                                   # how far the needles stand out at height z
        return max((r - (r - 0.05) * (z - z0) / h for z0, r in tiers if z0 <= z <= z0 + h), default=0.1)

    z0, z1 = 1.1 * size, 4.9 * size
    turns, spin = 4.5, rng.uniform(0, math.tau)
    pts = []
    for i in range(int((z1 - z0) / 0.07) + 1):
        z = z0 + i * 0.07
        a = spin + (z - z0) / (z1 - z0) * turns * math.tau
        r = reach(z) + 0.06
        pts.append((ox + math.cos(a) * r, oy + math.sin(a) * r, oz + z))
    last = pts[0]
    for p in pts[1:]:                               # a bulb every 30 cm or so (the wire's too thin to see)
        if math.dist(p, last) < 0.3:
            continue
        spots.append((*p, BULBS[k % len(BULBS)]))
        last, k = p, k + 1
    return k


def crown_lights(spots: list, centre, radius, rng=random):
    """White fairy lights wound all through a tree's crown, here and there among the branches
    rather than round the outside: adds (x, y, z, colour) to `spots`."""
    cx, cy, cz = centre
    for _ in range(round(radius ** 3 * 2.2)):
        while True:                                 # anywhere in the crown, evenly
            x, y, z = (rng.uniform(-1, 1) for _ in range(3))
            if x * x + y * y + z * z <= 1:
                break
        spots.append((cx + x * radius * 1.05, cy + y * radius * 1.05, cz + z * radius * 0.9, rng.choice(WHITE_BULBS)))


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
    carrot.build(root, clog="carrot")
    # …till a morning when the horse has had it, and there's something in its place: a chocolate
    # letter (always on the fifth), or a handful of pepernoten (calendar.ts clogHolds picks)
    letter = Model("chocolate_letter")
    letter.prism([(-0.17, 0.3), (-0.09, 0.3), (0, 0.06), (0.09, 0.3), (0.17, 0.3), (0.04, -0.05), (-0.04, -0.05)],
                 0.05, (-0.08, 0, 0.12), "#5a3222", rot=(0, -0.25, math.pi / 2 - 0.2))
    letter.build(root, clog="letter")
    nuts = Model("pepernoten")
    for i, (dx, dy, dz) in enumerate([(-0.16, -0.05, 0.26), (-0.08, 0.04, 0.27), (-0.12, 0.08, 0.25), (-0.04, -0.06, 0.26),
                                      (-0.18, 0.05, 0.25), (-0.1, -0.02, 0.31), (-0.05, 0.05, 0.3), (-0.14, 0.01, 0.33)]):
        nuts.ball(0.04, (dx, dy, dz), "#a8622e" if i % 3 else "#8a4b22", subdiv=1, scale=(1, 1, 0.75))
    nuts.build(root, clog="pepernoten")


def steamboat(t: Terrain):
    """Sinterklaas's steamboat, in from Spain, tied up across the head of the pier from the day
    he arrives (mid-November) till pakjesavond, when the presents come ashore."""
    dx, dy = L.DOCK
    head = dy + 1.0 - L.DOCK_LEN                                   # the pier's far end
    root = holiday("sinterklaas", "sinterklaas")
    boat = holiday("steamboat", "steamboat", (-0.8, head - 1.95, 0.0), id="steamboat")
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


def halloween_dressing(t: Terrain):
    """The rest of the island for Halloween (halloween() has the pumpkins at the doors)."""
    root = holiday("halloween_dressing", "halloween")
    # jack-o'-lanterns down the path from the pier, on alternate sides
    for i, (px, py, r) in enumerate([(1.15, -16.6, 0.26), (-1.2, -14.5, 0.3), (1.2, -13.7, 0.24), (-1.2, -12.6, 0.28)]):
        g = group("path_pumpkin", (px, py, t.sample(px, py)), rot_z=-0.3 * px, parent=root)
        s = Model("path_pumpkin", seed=i + 50)
        jack(s, (0, 0, 0), r, True, i * 0.7)
        s.build(g)
        light(g, (0, -0.2, 0.2), CANDLE, 2, 0.5, flicker=1.0, halo=False)
    graveyard(t, root)
    bats(root)
    spooky(t, root)


def tombstone(m: Model, loc, rot_z: float, lean: float, w: float, h: float):
    """A gravestone with a rounded top, leaning a bit, RIP on its face (to the south)."""
    x, y, z = loc
    rot = (lean, 0, rot_z)
    m.box((w, 0.14, h), (x, y, z + h / 2 - 0.08), P.STONE, rot=rot)
    m.cyl(w / 2, 0.14, (x, y + 0.07, z + h - 0.08), P.STONE, segs=8, rot=(lean + math.pi / 2, 0, rot_z))
    c, sn = math.cos(rot_z), math.sin(rot_z)
    fx, fy = x + sn * 0.075, y - c * 0.075
    m.box((w * 0.55, 0.02, 0.05), (fx, fy, z + h * 0.62), P.STONE_DARK, rot=rot)       # the lettering
    m.box((w * 0.4, 0.02, 0.04), (fx, fy, z + h * 0.45), P.STONE_DARK, rot=rot)


def graveyard(t: Terrain, root):
    """A little graveyard on the grass between the plaza and the library: the unfinished
    projects, a grave still open for the next one, a scarecrow with a pumpkin for a head
    keeping watch, and a bedsheet ghost drifting over it all (`ghost_idle`)."""
    gx, gy = -7.6, -10.6
    g = group("graves", (gx, gy, t.sample(gx, gy)), rot_z=0.05, parent=root, id="graves")
    g.scale = (1.35,) * 3
    m = Model("graves", seed=13)
    for (x, y, rz, lean, w, h) in [(-1.3, 0.35, 0.15, 0.08, 0.5, 0.75), (-0.45, 0.5, -0.1, -0.12, 0.42, 0.62),
                                   (0.4, 0.4, 0.05, 0.2, 0.55, 0.85), (1.25, 0.25, -0.2, -0.05, 0.4, 0.55)]:
        tombstone(m, (x, y, 0.0), rz, lean, w, h)
        m.box((w * 1.1, 0.9, 0.08), (x, y - 0.55, 0.02), P.DIRT, rot=(0, 0, rz))          # its mound
    # one still open, the spade stuck in the heap beside it
    m.box((0.6, 1.0, 0.04), (0.2, -1.05, 0.0), P.INK)
    m.box((0.5, 0.5, 0.22), (0.85, -1.05, 0.08), P.DIRT, rot=(0, 0, 0.3))
    m.box((0.35, 0.3, 0.12), (0.95, -1.35, 0.06), P.DIRT_LIGHT, rot=(0, 0, -0.2))
    m.plank_line((0.85, -1.0, 0.15), (0.95, -0.95, 1.05), 0.05, 0.05, P.WOOD)
    m.box((0.18, 0.03, 0.24), (0.84, -1.0, 0.15), P.IRON, rot=(0.05, 0.1, 0))
    m.box((0.2, 0.05, 0.05), (0.96, -0.95, 1.07), P.WOOD_DARK)
    # a crooked wooden cross at the end
    m.box((0.08, 0.08, 0.8), (-2.05, -0.1, 0.35), P.WOOD_DARK, rot=(0.0, 0.18, 0))
    m.box((0.42, 0.08, 0.08), (-2.0, -0.1, 0.55), P.WOOD_DARK, rot=(0.0, 0.18, 0))
    m.build(g)

    # the scarecrow: a pumpkin head, a stick cross in an old coat, straw at the cuffs
    s = Model("pumpkinhead", seed=8)
    sx, sy = 2.3, 0.6
    s.box((0.08, 0.08, 1.6), (sx, sy, 0.8), P.WOOD_DARK)
    s.box((1.1, 0.07, 0.07), (sx, sy, 1.3), P.WOOD_DARK)
    s.box((0.5, 0.32, 0.6), (sx, sy, 1.12), "#4a5a3a", taper=0.85)                       # the coat
    for k in (-1, 1):
        s.box((0.36, 0.24, 0.2), (sx + k * 0.33, sy, 1.3), "#4a5a3a")
        s.box((0.1, 0.12, 0.14), (sx + k * 0.55, sy, 1.27), "#d8b04a")                   # straw
    s.box((0.3, 0.1, 0.12), (sx, sy - 0.02, 0.8), "#d8b04a")
    s.build(g)
    head = group("pumpkinhead", (sx, sy, 1.42), rot_z=0.25, parent=g, id="pumpkinhead")
    p = Model("pumpkinhead_jack", seed=9)
    jack(p, (0, 0, 0), 0.27, True, 0.3)
    p.cyl(0.36, 0.03, (0, 0, 0.44), P.INK, segs=10)                                     # a pointed hat
    p.cyl(0.18, 0.36, (0, 0, 0.44), P.INK, segs=8, r_top=0.02, rot=(-0.25, 0, 0))
    p.build(head)
    light(head, (0, -0.2, 0.2), CANDLE, 2, 0.5, flicker=1.0, halo=False)

    # the ghost: an old sheet with two holes in it, drifting and swaying over the graves
    gh = group("ghost", (-0.2, 0.0, 1.5), parent=g, id="ghost")
    b = Model("ghost_sheet", seed=4)
    b.ball(0.26, (0, 0, 0.3), P.WHITE, subdiv=2, scale=(1, 1, 1.1))
    b.cyl(0.4, 0.42, (0, 0, -0.1), P.WHITE, segs=10, r_top=0.25)
    for k in range(8):                                                                # the ragged hem
        a = k / 8 * math.tau
        b.box((0.13, 0.06, 0.16), (math.cos(a) * 0.38, math.sin(a) * 0.38, -0.12 - (k % 2) * 0.06), P.WHITE, rot=(0, 0, a + math.pi / 2))
    for k in (-1, 1):
        b.box((0.07, 0.05, 0.1), (k * 0.09, -0.24, 0.34), P.INK)
    b.box((0.08, 0.05, 0.08), (0, -0.25, 0.18), P.INK)                                  # a little "oo"
    sheet = b.build(gh)
    light(gh, (0, -0.3, 0.2), "#cfe8ff", 3, 0.5, flicker=0.3)
    animate(gh, "ghost_idle", "location", [(0, (0, 0, 0)), (2, (0.5, 0.2, 0.2)), (4, (0.9, -0.1, 0)),
                                           (6, (0.4, -0.3, 0.25)), (8, (0, 0, 0))])
    risen(g)
    animate(sheet, "ghost_idle", "rotation_euler", [(0, 0), (1.5, (0.1, 0, 0.3)), (4, (-0.08, 0, -0.2)),
                                                    (6.5, (0.06, 0, 0.25)), (8, 0)])


def bats(root):
    """Bats round the lighthouse lamp: a ring the runtime only shows after dark (`bats`), going
    round once every twelve seconds (`bats_idle`), each bat flapping and bobbing."""
    lx, ly = L.LIGHTHOUSE
    ring = group("bats", (lx, ly, 13.2), parent=root, id="bats")
    ring.scale = (1.8,) * 3
    period, n = 12.0, 6
    rng = random.Random(31)
    for i in range(n):
        a = i / n * math.tau + rng.uniform(-0.3, 0.3)
        r = rng.uniform(2.4, 3.6)
        bat = group(f"bat_{i}", (math.cos(a) * r, math.sin(a) * r, rng.uniform(-0.8, 0.9)), rot_z=a, parent=ring)
        body = Model(f"bat_body_{i}")
        body.ball(0.09, (0, 0, 0), P.INK, subdiv=1, scale=(0.8, 1.3, 0.8))
        for k in (-1, 1):
            body.prism([(0, 0), (0.04, 0.1), (0.07, 0)], 0.02, (k * 0.05 - 0.035, 0.08, 0.06), P.INK)  # ears
        body.build(bat)
        flap = 0.24 + rng.uniform(-0.03, 0.03)
        beats = int(period / flap)
        flap = period / beats
        for k in (-1, 1):
            w = Model(f"bat_wing_{i}_{'l' if k < 0 else 'r'}")
            w.prism([(0, 0.06), (k * 0.2, 0.1), (k * 0.36, 0.02), (k * 0.26, -0.03), (k * 0.14, 0.0), (0, -0.06)][::k],
                    0.02, (0, 0, 0), P.INK, rot=(math.pi / 2, 0, 0))
            wing = w.build(bat)
            keys = [(j * flap / 2, (0, -k * (0.7 if j % 2 else -0.5), 0)) for j in range(beats * 2 + 1)]
            animate(wing, "bats_idle", "rotation_euler", keys)
        bob = rng.uniform(0, math.tau)
        animate(bat, "bats_idle", "location", [(j * period / 4, (0, 0, 0.25 * math.sin(bob + j * math.pi / 2))) for j in range(5)])
    animate(ring, "bats_idle", "rotation_euler", [(j * period / 4, (0, 0, j * math.pi / 2)) for j in range(5)])
    for fc in _fcurves(_CLIPS["bats_idle"]):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"


# --- Halloween town ----------------------------------------------------------------------------
# The week before Halloween the island goes a bit Halloween Town: bare black trees curling at the
# ends, spiders in their webs, the dead out for a walk, and now and then a monster.

SKIN = "#8fae7c"            # the dead: a little green
SKIN_DARK = "#6a8a5c"
RAGS = "#4a4658"
RAGS_DARK = "#33303e"
DEAD_WOOD = "#1f1c26"
WEB = "#dfe2ec"
SPIDER = "#16141c"


def open_spot(t: Terrain, x: float, y: float, r: float, taken: list):
    """The nearest spot to (x, y) on open grass: not on a path or the plaza, not in the sea,
    and clear of the scattered trees and of what's already been put down (`taken`)."""
    trees = [o.location for o in bpy.data.objects if o.parent is None and o.name.startswith("tree")]
    for k in range(400):
        a, d = k * 2.4, 0.25 * math.sqrt(k)
        px, py = x + math.cos(a) * d, y + math.sin(a) * d
        ix, iy = int(round((px - L.EXTENT[0]) / L.CELL)), int(round((py - L.EXTENT[1]) / L.CELL))
        n = max(1, int(r / L.CELL))
        if not t.land[iy, ix] or t.height[iy, ix] < 0.45 or t.level[iy, ix] != -1:
            continue
        if t.path[iy - n:iy + n + 1, ix - n:ix + n + 1].any() or t.plaza[iy - n:iy + n + 1, ix - n:ix + n + 1].any():
            continue
        if any(math.hypot(px - tx, py - ty) < r + 1.6 for tx, ty, _ in trees):
            continue
        if any(math.hypot(px - qx, py - qy) < r + qr for qx, qy, qr in taken):
            continue
        taken.append((px, py, r))
        return px, py
    taken.append((x, y, r))
    return x, y


def curl(m: Model, at, r0: float, turns: float, z_turn: float, width: float, color, start=0.0, step=0.35):
    """A spiral of short beams in the vertical plane through `at`, winding in from radius r0."""
    pts = []
    n = int(turns * math.tau / step)
    for k in range(n + 1):
        a = start + k * step
        r = r0 * (1 - k / (n + 1) * 0.85)
        pts.append((at[0] + math.cos(a) * r * math.cos(z_turn), at[1] + math.cos(a) * r * math.sin(z_turn), at[2] + math.sin(a) * r))
    for a, b in zip(pts, pts[1:]):
        m.plank_line(a, b, width, width, color)


def dead_tree(m: Model, rng: random.Random, h: float):
    """A bare black tree, leaning, its branches curling up at the ends."""
    lean = rng.uniform(-0.25, 0.25)
    trunk = [(0, 0, 0), (lean * 0.3, 0.05, h * 0.35), (lean * 0.8, -0.05, h * 0.7), (lean * 1.4, 0.1, h)]
    for k, (a, b) in enumerate(zip(trunk, trunk[1:])):
        m.plank_line(a, b, 0.3 - k * 0.07, 0.3 - k * 0.07, DEAD_WOOD)
    for k in range(5):
        base = trunk[1 + k % 3]
        side = 1 if k % 2 else -1
        heading = rng.uniform(0, math.tau)
        ln = rng.uniform(0.7, 1.2) * h * 0.35
        tip = (base[0] + math.cos(heading) * ln, base[1] + math.sin(heading) * ln, base[2] + ln * 0.7)
        m.plank_line(base, tip, 0.1, 0.1, DEAD_WOOD)
        curl(m, (tip[0], tip[1], tip[2] + 0.2), 0.22, 1.3, heading + math.pi / 2, 0.06, DEAD_WOOD, start=-math.pi / 2 * side)
    curl(m, (trunk[-1][0], trunk[-1][1], trunk[-1][2] + 0.28), 0.3, 1.5, 0.3, 0.08, DEAD_WOOD, start=-math.pi / 2)


def web(m: Model, centre, r: float, z_turn: float):
    """A spider's web hung upright, facing south-ish: spokes and three rings of silk."""
    cx, cy, cz = centre
    c, s = math.cos(z_turn), math.sin(z_turn)
    pt = lambda a, d: (cx + math.cos(a) * d * c, cy + math.cos(a) * d * s, cz + math.sin(a) * d)  # noqa: E731
    for k in range(8):
        m.plank_line(pt(k * math.pi / 4, 0), pt(k * math.pi / 4, r), 0.025, 0.02, WEB)
    for ring in (0.35, 0.65, 0.95):
        for k in range(8):
            m.plank_line(pt(k * math.pi / 4, r * ring), pt((k + 1) * math.pi / 4, r * ring * 0.96), 0.02, 0.02, WEB)


def spider(m: Model, at, size: float):
    """A round black spider, eight bent legs, a pair of red eyes."""
    x, y, z = at
    m.ball(size * 0.5, (x, y, z), SPIDER, subdiv=1, scale=(1, 1.2, 0.9))                       # abdomen
    m.ball(size * 0.3, (x, y - size * 0.62, z), SPIDER, subdiv=1)
    for k in (-1, 1):
        m.box((size * 0.1,) * 3, (x + k * size * 0.1, y - size * 0.88, z + size * 0.08), "#e0303a", glow=True)
        for j in range(4):
            a = -0.9 + j * 0.55
            knee = (x + k * size * 0.75, y - size * 0.5 + math.sin(a) * size * 0.6, z + size * 0.45)
            foot = (x + k * size * 1.25, y - size * 0.5 + math.sin(a) * size * 1.0, z - size * 0.35)
            m.plank_line((x + k * size * 0.15, y - size * 0.55, z), knee, size * 0.08, size * 0.08, SPIDER)
            m.plank_line(knee, foot, size * 0.07, size * 0.07, SPIDER)


def dangling(parent, name: str, at, drop: float, size: float, phase: float):
    """A spider on its thread, letting itself down and climbing back up (`<name>_idle`)."""
    g = group(name, at, parent=parent)
    m = Model(f"{name}_thread")
    m.plank_line((0, 0, 0), (0, 0, -drop), 0.015, 0.015, WEB)
    thread = m.build(g)
    s = Model(f"{name}_body")
    spider(s, (0, 0, -drop), size)
    body = s.build(g)
    keys = [(0, 0), (1.5 + phase, -0.35), (3 + phase, -0.1), (5 + phase, -0.45), (7, 0)]
    animate(body, "spiders_idle", "location", [(t_, (0, 0, z)) for t_, z in keys])
    animate(thread, "spiders_idle", "scale", [(t_, (0, 0, -z / drop)) for t_, z in keys])


def zombie(m: Model, dark=False):
    """The dead, shambling: green, in rags, arms out in front, one shoulder lower. Faces -y; z = 0
    at the hips (the legs are separate, for walking)."""
    rags = RAGS_DARK if dark else RAGS
    m.box((0.44, 0.28, 0.55), (0, 0, 0.32), rags, rot=(0.12, 0.08, 0))                     # torso, hunched
    m.box((0.2, 0.05, 0.12), (0.08, -0.15, 0.18), SKIN_DARK)                                # through a tear
    for k in (-1, 1):                                                                         # arms out
        sh = (k * 0.28, -0.05, 0.52 + (0.04 if k > 0 else -0.04))
        hand = (k * 0.24, -0.62, 0.48 + k * 0.05)
        m.plank_line(sh, ((sh[0] + hand[0]) / 2, -0.32, sh[2]), 0.14, 0.14, rags)
        m.plank_line(((sh[0] + hand[0]) / 2, -0.32, sh[2]), hand, 0.12, 0.12, SKIN)
        m.box((0.13, 0.14, 0.08), (hand[0], hand[1] - 0.06, hand[2]), SKIN)
    m.box((0.14, 0.14, 0.1), (0, -0.04, 0.64), SKIN)                                        # neck
    hx, hz = 0.03, 0.82
    m.box((0.34, 0.32, 0.32), (hx, -0.06, hz), SKIN, rot=(0, 0.2, 0))                       # head, lolling
    for k in (-1, 1):
        m.box((0.08, 0.02, 0.08), (hx + k * 0.08, -0.225, hz + 0.04), P.INK)                 # hollow eyes
    m.box((0.14, 0.02, 0.05), (hx, -0.225, hz - 0.09), "#3a2a30")                           # mouth, agape
    m.box((0.3, 0.3, 0.06), (hx - 0.02, -0.05, hz + 0.18), "#3a3a2a", rot=(0, 0.2, 0))       # wisps of hair


def zombie_legs(parent, name: str, dark=False):
    legs = []
    for k in (-1, 1):
        l_ = Model(f"{name}_leg_{'l' if k < 0 else 'r'}")
        l_.box((0.17, 0.2, 0.62), (0, 0, -0.31), RAGS_DARK if not dark else "#2a2733")
        l_.box((0.17, 0.28, 0.1), (0, -0.04, -0.62), SKIN_DARK)                               # bare feet
        legs.append(l_.build(parent, loc=(k * 0.12, 0, 0)))
    return legs


def risen(g):
    """Two of the dead climbing out of their graves, and a hand up out of the open one
    (`risen_idle`: they sway and reach)."""
    for k, (x, y, rz) in enumerate([(-1.0, -0.35, 0.3), (1.45, -0.5, -0.25)]):
        r = group("risen", (x, y, -0.35), rot_z=rz, parent=g, id="risen")
        m = Model(f"risen_{k}")
        zombie(m, dark=bool(k))
        m.box((0.6, 0.5, 0.12), (0, 0, 0.0), P.DIRT)                                         # the earth heaved up round it
        body = m.build(r)
        animate(body, "risen_idle", "rotation_euler", [(0, 0), (1.6 + k, (0.08, 0.12, 0.1)), (3.4, (-0.05, -0.08, -0.1)), (5, 0)])
    h = Model("risen_hand")                                                                      # out of the open grave
    h.plank_line((0, 0, 0), (0, 0, 0.35), 0.1, 0.1, SKIN)
    for j in range(4):
        h.plank_line((-0.06 + j * 0.04, 0, 0.35), (-0.08 + j * 0.055, -0.02, 0.48), 0.035, 0.035, SKIN)
    hand = h.build(g, loc=(0.2, -1.1, 0.0))
    animate(hand, "risen_idle", "rotation_euler", [(0, 0), (1.2, (0.25, 0, 0.2)), (2.4, (-0.1, 0, -0.2)), (3.6, (0.2, 0, 0.1)), (5, 0)])


def walker(t: Terrain, parent, a, b):
    """One of the dead out for a walk, shambling from a to b and back all evening (`zombie_idle`)."""
    (ax, ay), (bx, by) = a, b
    heading = math.atan2(bx - ax, -(by - ay))
    z = t.sample(ax, ay) + 0.62
    g = group("zombie", (ax, ay, z), rot_z=heading, parent=parent, id="zombie")
    m = Model("zombie_body")
    zombie(m)
    body = m.build(g)
    legs = zombie_legs(g, "zombie")
    walk, turn = 9.0, 1.0
    dz = t.sample(bx, by) - t.sample(ax, ay)
    there = (bx - ax, by - ay, dz)
    animate(g, "zombie_idle", "location", [(0, (0, 0, 0)), (walk, there), (walk + turn, there), (2 * walk + turn, (0, 0, 0)),
                                           (2 * walk + 2 * turn, (0, 0, 0))])
    animate(g, "zombie_idle", "rotation_euler", [(0, 0), (walk, 0), (walk + turn, (0, 0, math.pi)), (2 * walk + turn, (0, 0, math.pi)),
                                                 (2 * walk + 2 * turn, (0, 0, math.tau))])
    total = 2 * walk + 2 * turn
    stride = total / 20
    for k, leg in enumerate(legs):
        sign = 1 if k else -1
        animate(leg, "zombie_idle", "rotation_euler", [(j * stride / 2, (sign * (0.4 if j % 2 else -0.4), 0, 0)) for j in range(41)])
    animate(body, "zombie_idle", "rotation_euler", [(j * stride / 2, (0, 0.1 if j % 2 else -0.1, 0)) for j in range(41)])
    for fc in _fcurves(_CLIPS["zombie_idle"]):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"


def spooky(t: Terrain, root):
    taken = [(-7.6, -10.6, 3.6)]                                     # the graveyard
    for (x, y), r in [(L.WORKOUT, 2.2), (L.YOGA, 2.2), (L.BENCH, 2.5), (L.BEIKE, 3.0), (L.READING, 1.8),
                      (L.SIGNPOST, 1.2), (L.WELL, 2.0), (L.SETT, 2.0), (L.CAMPFIRE, 4.0)]:
        taken.append((x, y, r))
    rng = random.Random(1031)
    trees = []
    for k, (tx, ty) in enumerate([(-11.2, -11.6), (-4.6, -9.8), (-19.5, -14.8), (15.5, -8.6), (-15.0, -5.6)]):
        x, y = open_spot(t, tx, ty, 1.2, taken)
        g = group("dead_tree", (x, y, t.sample(x, y)), rot_z=rng.uniform(0, math.tau), parent=root)
        m = Model(f"dead_tree_{k}", seed=k)
        h = rng.uniform(2.6, 3.4)
        dead_tree(m, rng, h)
        if k in (0, 3):                                              # a web in the fork, with its spider
            web(m, (0.0, -0.1, h * 0.55), 0.55, 0.0)
        m.build(g)
        trees.append((g, h))
        if k in (1, 2, 4):
            dangling(g, f"spider_{k}", (0.6, -0.3, h * 0.82), 1.1, 0.12, k * 0.4)
    # the big one, in a web hung between the first tree and a stake, by the graves
    g0, h0 = trees[0]
    big = group("spider", (0, -0.1, h0 * 0.55), parent=g0, id="spider")
    s = Model("spider_big")
    spider(s, (0, -0.08, 0), 0.34)
    s.build(big)
    for k in (1, 2):                                                  # little ones on the web
        s2 = Model(f"spider_small_{k}")
        spider(s2, (0.0, 0, 0), 0.09)
        s2.build(g0, loc=(-0.25 + k * 0.2, -0.13, h0 * 0.55 + 0.3 - k * 0.25))
    # the dead out for a walk: one along the meadow, one on the grass below the workshop
    a = open_spot(t, -9.6, -15.0, 0.6, taken)
    b = open_spot(t, -14.0, -15.6, 0.6, taken)
    walker(t, root, a, b)
    big_props(t, root, taken)


IRON = "#1a1820"
BONE_SIGN = "#d8d0bc"


def crow(m: Model, at, heading: float):
    """A crow perched, hunched, its beak to `heading`."""
    x, y, z = at
    c, s = math.cos(heading), math.sin(heading)
    m.ball(0.11, (x, y, z + 0.1), P.INK, subdiv=1, scale=(1.3, 0.9, 1.0))
    m.ball(0.07, (x + c * 0.12, y + s * 0.12, z + 0.2), P.INK, subdiv=1)
    m.box((0.09, 0.03, 0.03), (x + c * 0.2, y + s * 0.2, z + 0.19), "#3a3440", rot=(0, 0, heading))
    m.box((0.14, 0.05, 0.03), (x - c * 0.16, y - s * 0.16, z + 0.06), P.INK, rot=(0, 0.4, heading))


def archway(t: Terrain, parent):
    """Over the path up from the pier: a black iron arch, curls on top, a big pumpkin at its crown
    and lanterns swinging from it."""
    y = -15.6
    g = group("archway", (0, y, t.sample(0, y)), parent=parent, id="archway")
    m = Model("archway", seed=5)
    w, h = 1.35, 2.9
    for sx in (-1, 1):
        m.box((0.18, 0.18, h), (sx * w, 0, h / 2), IRON)
        m.box((0.3, 0.3, 0.2), (sx * w, 0, 0.1), IRON)
        curl(m, (sx * (w - 0.35), 0, h + 0.55), 0.32, 1.4, 0.0, 0.05, IRON, start=-math.pi / 2 if sx > 0 else math.pi / 2)
        curl(m, (sx * (w + 0.25), 0, h - 0.3), 0.22, 1.3, 0.0, 0.045, IRON, start=math.pi if sx > 0 else 0.0)
        m.plank_line((sx * w, 0, h), (sx * 0.2, 0, h + 0.35), 0.09, 0.09, IRON)
        m.plank_line((sx * w * 0.6, 0, h + 0.14), (sx * w * 0.6, 0, h - 0.45), 0.02, 0.02, IRON)   # a lantern on a chain
        m.box((0.16, 0.16, 0.22), (sx * w * 0.6, 0, h - 0.56), CANDLE, glow=True)
        m.box((0.2, 0.2, 0.04), (sx * w * 0.6, 0, h - 0.43), IRON)
    m.build(g)
    light(g, (0, -0.3, h - 0.6), CANDLE, 3, 0.7, flicker=0.6)
    p = Model("archway_pumpkin", seed=6)
    jack(p, (0, 0, 0), 0.38, True, 0.2)
    p.build(g, loc=(0, 0, h + 0.35))
    light(g, (0, -0.35, h + 0.65), CANDLE, 3, 0.8, flicker=1.0)
    b = Model("archway_bats")
    for k, (bx, bz) in enumerate([(-0.8, h + 1.1), (0.7, h + 1.3), (0.2, h + 1.6)]):
        b.ball(0.06, (bx, 0, bz), P.INK, subdiv=1)
        for sx in (-1, 1):
            b.prism([(0, 0), (sx * 0.22, 0.08), (sx * 0.16, -0.04)][::sx], 0.02, (bx, 0, bz), P.INK)
    b.build(g)


def big_props(t: Terrain, root, taken):
    graves = next(o for o in root.children_recursive if o.name.startswith("graves") and o.get("id") == "graves")
    cr = Model("crows", seed=3)
    for at, hd in [((-1.3, 0.35, 0.8), -1.2), ((0.85, -1.05, 0.2), 2.4), ((0.4, 0.4, 0.95), 0.4)]:
        crow(cr, at, hd)
    cr.build(graves)
    archway(t, root)

    # a pumpkin the size of a shed, carved, by the path to the campfire
    x, y = open_spot(t, 6.0, -12.6, 1.3, taken)
    g = group("giant_pumpkin", (x, y, t.sample(x, y)), rot_z=0.2, parent=root, id="giant_pumpkin")
    m = Model("giant_pumpkin", seed=8)
    jack(m, (0, 0, 0), 1.0, True, 0.3)
    m.build(g)
    light(g, (0, -0.8, 0.8), CANDLE, 6, 1.1, flicker=1.0)

    # a witch's cauldron on three legs over a fire, bubbling over
    x, y = open_spot(t, -3.6, -4.8, 0.9, taken)
    g = group("cauldron", (x, y, t.sample(x, y)), parent=root, id="cauldron")
    m = Model("cauldron", seed=4)
    for k in range(3):
        a = k * math.tau / 3
        m.plank_line((math.cos(a) * 0.6, math.sin(a) * 0.6, 0), (math.cos(a) * 0.15, math.sin(a) * 0.15, 1.5), 0.07, 0.07, P.WOOD_DARK)
    m.ball(0.5, (0, 0, 0.7), IRON, subdiv=2, scale=(1, 1, 0.8))
    m.cyl(0.42, 0.06, (0, 0, 1.02), IRON, segs=12)
    m.cyl(0.38, 0.02, (0, 0, 1.05), "#c070e0", segs=12, glow=True)                 # the brew, glowing violet
    for k in range(4):
        a = k * 1.7
        m.ball(0.07, (math.cos(a) * 0.2, math.sin(a) * 0.2, 1.1), "#d8a0f0", subdiv=1, glow=True)
    for k in range(5):
        a = k * math.tau / 5
        m.plank_line((math.cos(a) * 0.35, math.sin(a) * 0.35, 0.03), (math.cos(a + 2) * 0.3, math.sin(a + 2) * 0.3, 0.08), 0.09, 0.09, P.WOOD)
    m.box((0.3, 0.3, 0.2), (0, 0, 0.12), "#ff9a30", glow=True)
    m.build(g)
    light(g, (0, 0, 0.3), "#ff9a30", 3, 0.9, flicker=1.0, halo=False)
    light(g, (0, 0, 1.25), "#c070e0", 3, 0.6, flicker=0.3)
    emitter(g, (0, 0, 1.15), "steam")

    # an old coffin propped against a tree, its lid off and leant beside it
    x, y = open_spot(t, -12.6, -9.6, 0.9, taken)
    g = group("coffin", (x, y, t.sample(x, y)), rot_z=0.3, parent=root, id="coffin")
    m = Model("coffin", seed=2)
    outline = [(-0.3, 0), (0.3, 0), (0.42, 1.35), (0.24, 1.9), (-0.24, 1.9), (-0.42, 1.35)]
    m.prism(outline, 0.32, (0, 0.05, 0), P.WOOD_DARK, rot=(-0.25, 0, 0))
    m.prism([(x_ * 0.85, z * 0.95 + 0.05) for x_, z in outline], 0.1, (0, -0.1, 0.05), "#2a1a20", rot=(-0.25, 0, 0))   # inside
    m.prism(outline, 0.06, (0.75, 0.0, 0), P.WOOD, rot=(-0.2, 0, -0.3))                                         # the lid
    m.box((0.06, 0.02, 0.5), (0.75, -0.06, 1.0), P.GOLD, rot=(-0.2, 0, -0.3))
    m.box((0.3, 0.02, 0.06), (0.75, -0.06, 1.15), P.GOLD, rot=(-0.2, 0, -0.3))
    m.build(g)

    # a skeleton sat against the signpost, waiting for someone to show it the way
    sx_, sy_ = L.SIGNPOST
    g = group("skeleton", (sx_ + 0.35, sy_ - 0.3, t.sample(sx_ + 0.35, sy_ - 0.3)), rot_z=0.4, parent=root, id="skeleton")
    m = Model("skeleton", seed=7)
    m.box((0.32, 0.22, 0.12), (0, 0.05, 0.08), BONE_SIGN)                          # pelvis
    for k in range(5):
        m.box((0.32 - k * 0.02, 0.18, 0.035), (0, 0.1, 0.24 + k * 0.08), BONE_SIGN)   # ribs
    m.box((0.05, 0.05, 0.5), (0, 0.18, 0.4), BONE_SIGN)                            # spine
    m.box((0.26, 0.24, 0.26), (0.02, 0.1, 0.82), BONE_SIGN, rot=(0, 0.35, 0))      # skull, lolling
    for k in (-1, 1):
        m.box((0.07, 0.02, 0.07), (0.07 + k * 0.06, -0.03, 0.84), P.INK)
        m.plank_line((k * 0.1, 0.0, 0.06), (k * 0.14, -0.5, 0.1), 0.05, 0.05, BONE_SIGN)   # legs out in front
        m.plank_line((k * 0.14, -0.5, 0.1), (k * 0.16, -0.85, 0.04), 0.045, 0.045, BONE_SIGN)
        m.plank_line((k * 0.18, 0.12, 0.6), (k * 0.25, -0.1, 0.3), 0.04, 0.04, BONE_SIGN)  # arms in its lap
    m.box((0.06, 0.05, 0.03), (0.0, -0.06, 0.73), P.INK)
    m.build(g)


def _fcurves(act):
    """Every F-curve in a (layered) action."""
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for slot in act.slots:
                bag = strip.channelbag(slot)
                if bag:
                    out.extend(bag.fcurves)
    return out


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


def christmas_dressing(t: Terrain):
    """The rest of the island for Christmas: a wreath on the hut door, fairy lights along the
    pier, over the plaza and along the eaves, and a candle in the library window."""
    root = holiday("christmas_dressing", "christmas")
    # a holly wreath on the hut door, with a red bow (the hut is built at 0.8 scale)
    hx, hy = L.HUT
    k = 0.8
    wreath = group("wreath", (hx, hy - (1.6 + 0.17) * k, t.sample(hx, hy) + 1.2 * k), parent=root)
    w = Model("wreath", seed=12)
    for i in range(14):
        a = i * 2 * math.pi / 14
        w.ball(0.1, (math.cos(a) * 0.27, 0, math.sin(a) * 0.27), ["#4f9a4a", "#3d8040", "#5aa850"][i % 3], subdiv=1, scale=(1, 0.6, 1))
        if i % 3 == 1:
            w.ball(0.045, (math.cos(a) * 0.3, -0.08, math.sin(a) * 0.3), "#e8303a", subdiv=1)   # berries
    for s_ in (-1, 1):                                             # the bow, at the bottom
        w.prism([(0, 0), (s_ * 0.2, 0.1), (s_ * 0.2, -0.1)], 0.04, (0, -0.09, -0.27), "#e8303a")
    w.build(wreath)

    # fairy lights along both edges of the pier, festooned between little posts (seen from
    # the island the pier runs away from you, so a string from lamp to lamp would hide behind them)
    dx, dy = L.DOCK
    f = Model("fairy_lights", seed=13)
    near, far = dy + 1.0, dy + 1.0 - 10                             # on top of the pilings (props.pier), every 2 m
    posts, k = 5, 0
    for side in (-1, 1):
        x = dx + side * 1.1
        tops = [(x, near + (far - near) * i / posts, 1.45) for i in range(posts + 1)]
        for (px, py, pz) in tops:
            f.cyl(0.035, pz - 0.78, (px, py, 0.78), P.WOOD_DARK, segs=4)
        for a, b in zip(tops, tops[1:]):
            k = fairy_lights(f, a, b, sag=0.22, every=0.5, k=k)
    # round the plaza, lamp to lamp (not across it: the tree's in the way)
    px, py = L.PLAZA
    lamps = [(px - 5.2, py + 3), (px + 5.2, py + 3), (px + 5, py - 3.6), (px - 5, py - 3.6)]
    tops = [(x, y, t.sample(x, y) + 2.4) for x, y in lamps]
    for i in range(4):
        k = fairy_lights(f, tops[i], tops[(i + 1) % 4], sag=0.35, every=0.6, k=k)
    # along the library's eaves, in two swags either side of the door
    lx, ly = L.LIBRARY
    lz = t.sample(lx, ly)
    for x0, x1 in ((-4.6, -0.9), (0.9, 4.6)):
        k = fairy_lights(f, (lx + x0, ly - 3.6, lz + 3.75), (lx + x1, ly - 3.6, lz + 3.75), sag=0.35, k=k)
    # along the front of the workshop, under the roof
    wx, wy = L.WORKSHOP
    wz = t.sample(wx, wy)
    k = fairy_lights(f, (wx - 3.6, wy - 3.45, wz + 3.55), (wx + 3.6, wy - 3.45, wz + 3.55), sag=0.3, k=k)
    # and up the hut's gable, built at 0.8 scale, to the peak and down again
    hx, hy = L.HUT
    hz = t.sample(hx, hy)
    s_ = 0.8
    eave_l, peak, eave_r = [(hx + x * s_, hy - 1.72 * s_, hz + z * s_) for x, z in ((-1.95, 2.5), (0, 3.55), (1.95, 2.5))]
    k = fairy_lights(f, eave_l, peak, sag=0.06, every=0.35, size=0.1, k=k)
    k = fairy_lights(f, peak, eave_r, sag=0.06, every=0.35, size=0.1, k=k)
    # and strung from tree to tree through the woods, east and west, below the (bare) crowns
    woods = [(27, 4, 9), (-18, 0, 8)]
    trees = [tuple(o.location) for o in bpy.data.objects
             if o.name.split(".")[0] == "tree" and o.parent is None
             and any(math.hypot(o.location.x - cx, o.location.y - cy) < r for cx, cy, r in woods)]
    rng = random.Random(1225)
    linked = set()
    for i, (x, y, z) in enumerate(trees):
        nearest = sorted((math.hypot(x - x2, y - y2), j) for j, (x2, y2, _) in enumerate(trees) if j != i)
        for d, j in nearest[:2]:
            if d > 6.5 or (min(i, j), max(i, j)) in linked:
                continue
            linked.add((min(i, j), max(i, j)))
            x2, y2, z2 = trees[j]
            k = fairy_lights(f, (x, y, z + rng.uniform(1.9, 2.3)), (x2, y2, z2 + rng.uniform(1.9, 2.3)), sag=0.5, every=0.6, k=k)
    # and wound round every pine on the island, in the woods and up the mountainside behind
    pines = [o for o in bpy.data.objects
             if o.name.split(".")[0] == "pine" and o.parent and o.parent.name.split(".")[0] == "tree"]
    sparkles = []
    for o in pines:
        k = pine_lights(sparkles, o, k, rng)
    # and white ones all through the crown of every tree on the island (not the bushes)
    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        if "canopy" in o and o.get("squash", 1) >= 1 and o.parent and o.parent.name.split(".")[0] in ("tree", "blossom"):
            crown_lights(sparkles, tuple(o.matrix_world.translation), o["canopy"], rng)
    f.build(root, unshaded=1)
    # (thousands of them, all alike: one bulb of each colour, which the runtime stands at each of
    # its spots, see season.ts)
    for c, colour in enumerate(dict.fromkeys(BULBS + WHITE_BULBS)):
        spots = [round(v, 2) for n, (x, y, z, col) in enumerate(sparkles) if col == colour for v in (x, y, z, n * 0.7, 1, 0)]
        g = group(f"tree_bulb_{c}", (c * 2.0, -300, -40), parent=root, spots=spots)
        b = Model(f"tree_bulb_{c}", seed=c)
        b.box((0.16, 0.16, 0.16), (0, 0, 0), colour, glow=True)
        b.build(g)
    for x, y in ((px, py), (lx, ly - 3.6), (wx, wy - 3.8)):
        light(root, (x, y, t.sample(x, y) + 2.2), "#ffd8a0", 4, 0.4, halo=False)
    # the woods glow with it, from a few places in each
    for cx, cy, r in woods:
        for a in (0.4, 2.5, 4.6):
            x, y = cx + math.cos(a) * r * 0.45, cy + math.sin(a) * r * 0.45
            light(root, (x, y, t.sample(x, y) + 1.8), "#ffc887", 8.5, 1.5, halo=False)
    # and so do the stands of pines out of the woods, a light among each (the biggest few)
    rest = [tuple(o.parent.location) for o in pines
            if not any(math.hypot(o.parent.location.x - cx, o.parent.location.y - cy) < r for cx, cy, r in woods)]
    stands = []
    while rest:
        seed_ = rest[0]
        stand = [p for p in rest if math.dist(p[:2], seed_[:2]) < 7]
        rest = [p for p in rest if p not in stand]
        stands.append(stand)
    for stand in sorted(stands, key=len, reverse=True)[:4]:
        x, y, z = (sum(c) / len(stand) for c in zip(*stand))
        light(root, (x, y, z + 2.5), "#ffc887", 8, 1.4, halo=False)
    for y in (near + (far - near) * 0.3, near + (far - near) * 0.75):
        light(root, (dx, y, 1.4), "#ffd8a0", 3, 0.45, halo=False)

    # a candle on the sill of the library's west window
    lx, ly = L.LIBRARY
    sill = group("library_candle", (lx - 2.3, ly - 3.17, t.sample(lx, ly) + 1.35), parent=root)
    c = Model("library_candle", seed=14)
    c.cyl(0.16, 0.05, (0, 0, 0), P.GOLD, segs=8)                   # a brass holder
    c.cyl(0.1, 0.55, (0, 0, 0.05), "#c8202a", segs=6)              # a fat red candle, dark against the lit window
    c.ball(0.07, (0, 0, 0.7), "#fff0b0", subdiv=1, scale=(0.8, 0.8, 1.5), glow=True)
    for s_ in (-1, 1):                                             # a sprig of holly either side
        c.ball(0.1, (s_ * 0.24, 0, 0.06), "#3d8040", subdiv=1, scale=(1.4, 0.8, 0.5))
        c.ball(0.04, (s_ * 0.2, -0.08, 0.12), "#e8303a", subdiv=1)
    c.build(sill)
    light(sill, (0, -0.25, 0.7), CANDLE, 3, 0.8, flicker=1.0, halo=False)


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
    """Eef's, Charlie's and George's, all on one day. The bench is where the three of them meet."""
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


# --- Liberation Day -----------------------------------------------------------------------------

def liberation(t: Terrain):
    """5 May: the flag's right back up after the fourth, dressed with a string of red, white and
    blue each way down from the top of the pole to a peg in the grass."""
    sx, sy = L.SUMMIT
    z = t.sample(sx, sy)
    root = holiday("liberation", "liberation", id="liberation")
    m = Model("liberation_bunting", seed=45)
    top = (sx, sy, z + 2.95)
    for dx, dy in ((-2.1, -1.1), (1.9, -1.6)):
        px, py = sx + dx, sy + dy
        peg = (px, py, t.sample(px, py) + 0.15)
        bunting(m, top, peg, [NL_RED, NL_WHITE, NL_BLUE], sag=0.25, every=0.4, size=0.6)
        m.cyl(0.03, 0.25, (px, py, peg[2] - 0.2), P.WOOD_DARK, segs=4)
    m.build(root, unshaded=1)


# --- Easter ----------------------------------------------------------------------------------------

EGG_COLOURS = [("#f2b8c6", "#fff4d8"), ("#a8d8f0", "#f2c440"), ("#f7e08a", "#e86a6a"), ("#b8e0a0", "#f2ece2"),
               ("#d0b8f0", "#fff4d8"), ("#f5a860", "#2f6fb0")]
# One out in the open in Beike's meadow, so you know what you're looking for; the rest hidden all
# over the island, in the same order as easter.ts's hints: (x, y, scale, height if not the ground)
EGGS = [
    (-11.2, -11.6, 4.5, None),     # in plain sight, in Beike's meadow
    (-16.85, -11.45, 1.7, None),   # peeking out from under the bench, beneath the cats
    (-0.2, -26.5, 1.6, 0.78),      # at the end of the pier, beside the dock cat
    (20.3, -13.2, 1.7, None),      # round the back of the well
    (16.1, 15.3, 1.6, None),       # at the end of the mountain hut's woodpile
    (5.0, 18.5, 1.5, "summit"),    # tied to the summit flagpole, under the flag
    (28.1, -5.7, 1.6, None),       # at the mouth of the badgers' sett
    (-30.0, -5.3, 1.7, None),      # in the rocks at the lighthouse's foot
    (-12.1, 12.4, 1.7, None),      # behind the bouldering rock
    (24.6, -1.6, 1.6, None),       # by the campfire, against a log
    (23.4, -11.4, 1.6, None),      # among the blossom tree's roots
    (-2.3, -15.7, 1.6, None),      # at the foot of the signpost
]


def easter(t: Terrain):
    """Painted eggs for the Easter egg hunt (easter.ts), each its own part (egg_<i>) so it can be
    found and taken away. The first sits out in the open; the others are tucked away round the
    island, small, behind and under things."""
    root = holiday("easter", "easter")
    rng = random.Random(4)
    for i, (x, y, size, z) in enumerate(EGGS):
        shell, band = EGG_COLOURS[i % len(EGG_COLOURS)]
        if z == "summit":                                            # tied to the flagpole under the flag (the peak's rocks hide its foot)
            z = t.sample(*L.SUMMIT) + 1.95
        g = group(f"egg_{i}", (x, y, t.sample(x, y) if z is None else z), rot_z=rng.uniform(0, math.tau), parent=root, id=f"egg_{i}")
        g.scale = (size, size, size)
        m = Model(f"egg_{i}")
        tip = rng.uniform(-0.5, 0.5)                                 # lying a little on its side
        m.ball(0.085, (0, 0, 0.1), shell, subdiv=2, scale=(1, 1, 1.3), rot=(tip, 0, 0))
        m.cyl(0.088, 0.035, (0, 0, 0.1), band, segs=10, rot=(tip, 0, 0))
        for k in range(3):                                           # dots
            a = k * math.tau / 3
            m.ball(0.018, (math.cos(a) * 0.08, math.sin(a) * 0.08, 0.15), band, subdiv=1)
        m.build(g)


# --- the New Year's dive ------------------------------------------------------------------------------

HAT = "#f47a1c"                                                      # nieuwjaarsduik orange
TOWEL = "#3f8fc0"
TOWEL_STRIPE = "#f2ece2"
# on the beach west of the pier: his towel on the sand, the water's edge, and in up to his chest
DIVE = [(-5.4, -14.7), (-5.5, -16.6), (-5.9, -18.1)]


def dive(t: Terrain):
    """1 January: Vincent in his swimming shorts and an orange hat, for the nieuwjaarsduik (dive.ts
    runs him in and, very soon after, out). Parked under the island; the route runs from his towel
    down the beach into the sea. Faces -y like the others: `dive_leg_l/_r` and `dive_arm_l/_r`
    swing from hips and shoulders, and `dive_head` turns."""
    import characters                                                # (it needs bpy's mathutils, like this file)

    root = holiday("dive", "dive")
    me = group("vincent_dive", (0, 0, -20), parent=root, id="vincent_dive")
    hip = 0.84
    m = Model("vincent_dive_body")
    m.box((0.5, 0.3, 0.22), (0, 0, hip + 0.02), HAT)                # orange shorts too, to go with the hat
    m.box((0.54, 0.32, 0.64), (0, 0.02, hip + 0.44), P.SKIN)        # bare chest, in January
    m.box((0.2, 0.2, 0.12), (0, 0.0, hip + 0.83), P.SKIN)           # neck
    m.build(me)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"dive_leg_{side}")
        g.box((0.2, 0.22, 0.3), (0, 0, -0.15), HAT)
        g.box((0.16, 0.16, 0.48), (0, 0, -0.52), P.SKIN)
        g.box((0.17, 0.3, 0.07), (0, -0.05, -0.8), P.SKIN)           # bare feet
        g.build(me, loc=(s * 0.13, 0, hip))
        a = Model(f"dive_arm_{side}")
        a.box((0.14, 0.14, 0.58), (0, 0, -0.29), P.SKIN)
        a.box((0.11, 0.12, 0.1), (0, 0, -0.62), P.SKIN)
        a.build(me, loc=(s * 0.34, 0, hip + 0.7))
    h = characters.head(me, "dive_head", (0, 0, hip + 0.89), cap=False)
    hat = Model("dive_hat")                                          # a knitted orange hat with a bobble
    hat.cyl(0.25, 0.14, (0, 0, 0.41), HAT, segs=10, r_top=0.24)
    hat.cyl(0.23, 0.1, (0, 0, 0.54), HAT, segs=10, r_top=0.14)
    hat.ball(0.08, (0, 0, 0.66), TOWEL_STRIPE, subdiv=1)
    hat.cyl(0.255, 0.05, (0, 0, 0.42), TOWEL_STRIPE, segs=10)        # a white band round it
    hat.build(h)
    for i, (x, y) in enumerate(DIVE):
        group(f"route_dive_{i}", (x, y, t.sample(x, y)), parent=root, route="dive", step=i, fixed=0)

    # his towel spread on the sand, his clothes in a heap on it, and a flask of something hot
    x, y = DIVE[0]
    towel = group("dive_towel", (x + 0.9, y + 0.2, t.sample(x + 0.9, y + 0.2)), rot_z=0.3, parent=root, id="dive_towel")
    k = Model("dive_towel")
    k.box((0.8, 1.5, 0.03), (0, 0, 0.015), TOWEL)
    for yy in (-0.55, 0.55):
        k.box((0.8, 0.1, 0.031), (0, yy, 0.016), TOWEL_STRIPE)
    k.box((0.4, 0.3, 0.1), (0.1, 0.35, 0.08), P.TEE)                # his tee, folded
    k.box((0.36, 0.26, 0.08), (0.1, 0.35, 0.17), P.SHORTS)
    k.box((0.2, 0.34, 0.1), (-0.2, -0.4, 0.08), P.SHOE)
    k.box((0.2, 0.34, 0.1), (0.05, -0.45, 0.08), P.SHOE)
    k.cyl(0.07, 0.3, (0.5, 0.0, 0.0), "#9aa6ae", segs=8)             # the flask
    k.cyl(0.075, 0.06, (0.5, 0.0, 0.3), P.INK, segs=8)
    k.build(towel)


# --- Sint Maarten and the Airborne commemoration: things the runtime copies ---------------------------

LANTERNS = [("#f5a040", "#c8303a"), ("#f7d850", "#2a4f9a"), ("#f28ab0", "#3d7a4a"), ("#8fd0f0", "#f07a1a")]


def lanterns(t: Terrain):
    """Paper lanterns on sticks for the fair folk's Sint Maarten walk (lanterns.ts clones them):
    a stick with a hook at the top, and from it a round paper lantern lit from inside. Each is
    `lantern_<i>`, parked under the island, the bottom of the stick at its origin."""
    root = holiday("sintmaarten", "sintmaarten")
    for i, (paper, trim) in enumerate(LANTERNS):
        g = group(f"lantern_{i}", (i * 2.0, 0, -20), parent=root, id=f"lantern_{i}")
        m = Model(f"lantern_{i}")
        m.cyl(0.012, 0.75, (0, 0, 0), P.WOOD, segs=4)                 # the stick
        m.plank_line((0, 0, 0.75), (0.16, 0, 0.8), 0.015, 0.015, P.WOOD)
        m.plank_line((0.16, 0, 0.8), (0.16, 0, 0.7), 0.008, 0.008, P.INK)   # the wire
        m.ball(0.11, (0.16, 0, 0.58), paper, subdiv=2, scale=(1, 1, 0.9), glow=True)
        m.cyl(0.07, 0.03, (0.16, 0, 0.67), trim, segs=8)             # the rims, top and bottom
        m.cyl(0.07, 0.03, (0.16, 0, 0.47), trim, segs=8)
        m.build(g)


def airborne(t: Terrain):
    """Things the runtime (airborne.ts) sends over the sea on the day: an old Dakota, and the
    round parachutes that come out of it. Far off, so built small like the ships on the horizon.
    Parked under the island; each faces +x."""
    root = holiday("airborne", "airborne")
    plane = group("dakota", (0, 0, -30), parent=root, id="dakota")
    d = Model("dakota")
    olive, dark = "#5a6040", "#3f4430"
    d.cyl(0.35, 4.2, (-2.0, 0, 0), olive, segs=8, r_top=0.12, rot=(0, math.pi / 2, 0))   # fuselage, tapering aft
    d.ball(0.35, (-2.0, 0, 0), olive, subdiv=1, scale=(0.9, 1, 1))                    # the nose
    d.box((1.1, 6.0, 0.08), (-1.2, 0, -0.1), olive)                                   # wings
    for s in (-1, 1):
        d.cyl(0.16, 0.7, (-1.95, s * 1.1, -0.1), dark, segs=6, rot=(0, math.pi / 2, 0))   # engines
    d.box((0.6, 2.0, 0.06), (1.9, 0, 0.1), olive)                                     # tailplane
    d.prism([(0, 0), (0.7, 0), (0.6, 0.8), (0.3, 0.8)], 0.06, (1.6, 0, 0.1), olive, rot=(math.pi / 2, 0, 0))  # the fin
    d.box((0.3, 0.02, 0.6), (-0.2, 0.36, 0.18), "#e8e0cc")                            # invasion stripes
    d.box((0.3, 0.02, 0.6), (-0.2, -0.36, 0.18), "#e8e0cc")
    d.build(plane)
    chute = group("parachute", (0, 0, -40), parent=root, id="parachute")
    c = Model("parachute")
    rings = [(0.05, 1.0), (0.55, 0.9), (0.8, 0.65), (0.9, 0.4)]                        # the canopy, a dome
    for (r0, z0), (r1, z1) in zip(rings, rings[1:]):
        c.cyl(r1, z0 - z1, (0, 0, z1), "#d8d4c0", segs=10, r_top=r0)
    for k in range(6):                                                                 # the lines
        a = k * math.tau / 6
        c.plank_line((math.cos(a) * 0.85, math.sin(a) * 0.85, 0.4), (0, 0, -0.55), 0.01, 0.01, "#8a8670")
    c.box((0.14, 0.12, 0.34), (0, 0, -0.72), "#4f5a3a")                               # the jumper
    c.build(chute)


def populate(t: Terrain):
    dive(t)
    lanterns(t)
    airborne(t)
    liberation(t)
    easter(t)
    kings_day(t)
    shoe(t)
    steamboat(t)
    halloween(t)
    halloween_dressing(t)
    christmas(t)
    christmas_dressing(t)
    birthday(t)
    birthdays(t)
