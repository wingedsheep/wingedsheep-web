"""The island's week (src/island/scene/calendar.ts has the days, src/island/scene/week.ts runs them).
Like the special days' things (holidays.py), each hangs off a root tagged `holiday=<occasion>`,
so it only comes out on its day; the ones that move are parked out of sight till they're wanted.

  washday   Mondays: a line of washing between the hut and a post, each thing on it its own part
            (`laundry_<i>`, swinging from `laundry_<i>_swing`) so the wind can get at it
  postday   Tuesdays and Fridays: the post boat (`postboat`, a parcel in its stern) and the parcel
            it leaves on the pier (`parcel`)
  trawler   Wednesdays: a trawler, outriggers down, working offshore (`trawler`)
  friday    a crate of beer by the fire and a second mug (`borrel`), for the evening
  sunday    a kite (`kite`) and its line (`kite_line`, a metre long up its z, for the runtime to stretch)

and, on any day, Vincent on his feet with nothing in his hands (`vincent_about`), for fetching the
post and flying the kite.
"""
from __future__ import annotations

import math

import characters
import layout as L
import palette as P
from kit import Model, group
from terrain import Terrain

PARKED = (0, 0, -20)
KRAFT = "#b98a56"
KRAFT_DARK = "#8f6437"
POST_HULL = "#24385c"
POST_CABIN = "#f0c33a"
OILSKIN = "#f2c230"


def holiday(name: str, occasion: str, loc=(0, 0, 0), rot_z=0.0, parent=None, **extras):
    return group(name, loc, rot_z=rot_z, parent=parent, holiday=occasion, **extras)


# --- Monday: washing day ---------------------------------------------------------------------

# what's on the line, from the hut end: (kind, colour, second colour); the last sock is the one
# nobody gets to in time when the rain comes
WASHING = [
    ("towel", "#e8e2d4", "#4a78b8"),
    ("tee", P.TEE, None),
    ("sock", "#d8d2c8", None),
    ("shirt", "#e98aa8", None),
    ("shorts", P.SHORTS, None),
    ("towel", "#f0c33a", "#e8e2d4"),
    ("sock", "#c8303a", None),
]


def _garment(m: Model, kind: str, c: str, c2: str | None):
    """One thing on the line, hanging down from the line at z = 0, in the XZ plane."""
    peg = "#d8c49a"
    if kind == "towel":
        m.box((0.5, 0.025, 0.7), (0, 0, -0.35), c)
        if c2:
            for z in (-0.12, -0.58):
                m.box((0.505, 0.03, 0.06), (0, 0, z), c2)
        pegs = (-0.2, 0.2)
    elif kind == "tee":
        m.box((0.44, 0.025, 0.52), (0, 0, -0.3), c)
        for s in (-1, 1):
            m.box((0.18, 0.025, 0.16), (s * 0.28, 0, -0.1), c, rot=(0, s * 0.5, 0))
        pegs = (-0.18, 0.18)
    elif kind == "shirt":
        m.box((0.4, 0.025, 0.46), (0, 0, -0.26), c)
        for s in (-1, 1):
            m.box((0.12, 0.025, 0.32), (s * 0.25, 0, -0.18), c, rot=(0, s * 0.25, 0))
        m.box((0.16, 0.03, 0.04), (0, 0, -0.04), P.WHITE)
        pegs = (-0.16, 0.16)
    elif kind == "shorts":
        m.box((0.42, 0.025, 0.16), (0, 0, -0.08), c)
        for s in (-1, 1):
            m.box((0.19, 0.025, 0.28), (s * 0.11, 0, -0.28), c)
        pegs = (-0.17, 0.17)
    else:  # a sock, heel and all
        m.box((0.1, 0.025, 0.3), (0, 0, -0.15), c)
        m.box((0.16, 0.025, 0.09), (0.04, 0, -0.33), c)
        pegs = (0.0,)
    for x in pegs:
        m.box((0.03, 0.05, 0.1), (x, 0, -0.01), peg)


def washday(t: Terrain):
    hx, hy = L.HUT
    s = 0.8                                                          # the hut is built at 0.8 (models.py)
    a = (hx + 1.9 * s + 0.02, hy + 0.5)                              # off the hut's east wall, behind the woodpile…
    b = (a[0] + 2.1, a[1] - 1.0)                                     # …to a post on the grass short of the edge
    za, zb = t.sample(*a) + 1.95, t.sample(*b) + 1.95
    root = holiday("laundry", "washday", id="laundry")
    heading = math.atan2(b[1] - a[1], b[0] - a[0])
    length = math.dist(a, b)
    # the post, a hook on the hut, and the line between them, sagging a little
    post = Model("laundry_post")
    post.cyl(0.06, 2.2, (b[0], b[1], t.sample(*b) - 0.1), P.WOOD_DARK, segs=6)
    post.box((0.08, 0.5, 0.06), (b[0], b[1], zb + 0.03), P.WOOD_DARK, rot=(0, 0, heading))
    post.box((0.08, 0.06, 0.06), (a[0], a[1], za), P.IRON)
    sag = 0.12
    pts = []
    for i in range(9):
        k = i / 8
        pts.append((a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, za + (zb - za) * k - sag * 4 * k * (1 - k)))
    for p, q in zip(pts, pts[1:]):
        post.plank_line(p, q, 0.02, 0.02, "#e8e0cc")
    post.build(root, unshaded=1)
    # and the washing, each thing pegged on at its own spot along it
    for i, (kind, c, c2) in enumerate(WASHING):
        k = (i + 0.7) / (len(WASHING) + 0.4)
        x, y = a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k
        z = za + (zb - za) * k - sag * 4 * k * (1 - k)
        g = group(f"laundry_{i}", (x, y, z), rot_z=heading, parent=root, kind=kind, **({"last": 1} if i == len(WASHING) - 1 else {}))
        swing = group(f"laundry_{i}_swing", parent=g)
        m = Model(f"laundry_{i}_cloth", seed=i)
        _garment(m, kind, c, c2)
        m.build(swing, unshaded=1)
    # a peg bag on the post
    bag = Model("peg_bag")
    bag.box((0.18, 0.1, 0.2), (b[0] - 0.12, b[1], zb - 0.35), "#7a9a6a")
    bag.build(root)
    root["length"] = round(length, 3)


# --- Tuesday and Friday: the post boat ---------------------------------------------------------

def postboat():
    """A little motor launch in navy and yellow, the skipper at the wheel in his oilskins, a parcel
    in the stern. Faces +x; the runtime brings it in to the pier and takes it away again."""
    root = holiday("postboat", "postday", PARKED, id="postboat")
    m = Model("postboat", seed=2)
    plan = [(-1.5, -0.55), (0.9, -0.6), (1.8, 0.0), (0.9, 0.6), (-1.5, 0.55)]
    flare = [(x * 1.05, y * 1.1) for x, y in plan]
    m.slab(plan, -0.3, 0.1, "#b8352e")                              # red below the waterline…
    m.slab(plan, 0.1, 0.55, POST_HULL, top=flare)                   # …navy above
    m.slab([(x * 1.04, y * 1.06) for x, y in flare], 0.55, 0.6, P.WHITE)  # a white rubbing strake
    m.slab([(x * 0.97, y * 0.97) for x, y in flare], 0.5, 0.56, P.WOOD_LIGHT)
    # the cabin forward, yellow, with windows, a post horn on each side, and a white roof
    m.box((1.1, 0.9, 0.7), (0.15, 0, 0.9), POST_CABIN)
    m.box((1.25, 1.02, 0.07), (0.15, 0, 1.28), P.WHITE)
    for s in (-1, 1):
        m.box((0.7, 0.03, 0.24), (0.15, s * 0.46, 1.05), "#2a3f5a")
        # the post horn: a coiled loop with a bell at one end and a mouthpiece at the other
        m.cyl(0.11, 0.03, (-0.15, s * 0.465, 0.78), P.INK, segs=10, rot=(math.pi / 2, 0, 0))
        m.cyl(0.07, 0.035, (-0.15, s * 0.47, 0.78), POST_CABIN, segs=10, rot=(math.pi / 2, 0, 0))
        m.cyl(0.07, 0.03, (0.07, s * 0.465, 0.8), P.INK, segs=6, rot=(math.pi / 2, 0, 0))
        m.box((0.16, 0.03, 0.04), (0.01, s * 0.465, 0.8), P.INK)
    m.box((0.04, 0.8, 0.28), (0.72, 0, 1.08), "#2a3f5a")            # the windscreen
    # a mast with a lamp and a pennant, and a lifebuoy on the cabin's back
    m.cyl(0.03, 1.1, (0.35, 0, 1.3), P.WOOD_DARK, segs=5)
    m.ball(0.05, (0.35, 0, 2.42), P.WHITE, subdiv=1)
    m.prism([(0, 0.06), (0.45, 0), (0, -0.06)], 0.02, (0.37, 0, 2.3), "#b8352e")
    m.cyl(0.16, 0.06, (-0.42, 0, 0.95), "#f07a1a", segs=8, rot=(0, math.pi / 2, 0))
    m.cyl(0.08, 0.065, (-0.42, 0, 0.95), P.WHITE, segs=8, rot=(0, math.pi / 2, 0))
    # fenders over the side
    for x in (-0.9, 0.5):
        for s in (-1, 1):
            m.cyl(0.07, 0.24, (x, s * 0.62, 0.2), P.WHITE, segs=6)
    m.build(root)
    # the skipper, in the stern at the tiller, sou'wester on
    k = Model("postboat_skipper")
    k.box((0.3, 0.26, 0.42), (-0.95, 0, 0.78), OILSKIN)
    k.box((0.2, 0.2, 0.2), (-0.95, 0, 1.1), P.SKIN)
    k.box((0.22, 0.04, 0.08), (-0.95, -0.1, 1.06), "#b8a898")        # a grey beard
    k.cyl(0.17, 0.05, (-0.95, 0, 1.2), OILSKIN, segs=8)
    k.cyl(0.11, 0.12, (-0.95, 0, 1.22), OILSKIN, segs=8, r_top=0.09)
    k.plank_line((-0.95, -0.14, 0.9), (-1.3, -0.1, 0.72), 0.07, 0.07, OILSKIN)       # a hand on the tiller
    k.plank_line((-1.25, 0, 0.62), (-1.62, 0, 0.62), 0.05, 0.05, P.WOOD_DARK)
    k.build(root)
    # the parcel, till it's handed up onto the pier
    p = Model("postboat_parcel")
    _parcel(p, (-0.35, 0.25, 0.56), 0.7)
    p.build(root)


def _parcel(m: Model, at, size=1.0):
    x, y, z = at
    w, d, h = 0.5 * size, 0.38 * size, 0.3 * size
    m.box((w, d, h), (x, y, z + h / 2), KRAFT)
    m.box((w + 0.01, 0.03, h + 0.01), (x, y, z + h / 2), "#e8e0cc")            # string, both ways
    m.box((0.03, d + 0.01, h + 0.01), (x, y, z + h / 2), "#e8e0cc")
    m.box((0.16 * size, 0.12 * size, 0.01), (x + w * 0.22, y - d * 0.15, z + h + 0.005), P.WHITE)   # the label
    m.box((0.1 * size, 0.02, 0.012), (x + w * 0.22, y - d * 0.15, z + h + 0.008), P.INK)


def parcel():
    """The parcel, left on the pier's head for Vincent to come down and fetch."""
    root = holiday("parcel", "postday", PARKED, id="parcel")
    root.scale = (1.3,) * 3                                         # so you'd spot it from the plaza
    m = Model("parcel")
    _parcel(m, (0, 0, 0))
    m.build(root)


# --- Wednesday: the trawler -----------------------------------------------------------------------

def trawler():
    """A beam trawler: blue hull, white wheelhouse forward, a gantry aft, and the outriggers down
    either side, trawling. Faces +x."""
    root = holiday("trawler", "trawler", PARKED, id="trawler")
    m = Model("trawler", seed=3)
    plan = [(-3.2, -1.0), (2.2, -1.1), (3.8, 0.0), (2.2, 1.1), (-3.2, 1.0)]
    flare = [(x * 1.04, y * 1.12) for x, y in plan]
    m.slab(plan, -0.5, 0.2, "#a8302c")
    m.slab(plan, 0.2, 1.2, "#2d5486", top=flare)
    m.slab([(x * 1.03, y * 1.05) for x, y in flare], 1.2, 1.3, P.WHITE)
    m.slab([(x * 0.96, y * 0.95) for x, y in flare], 1.1, 1.22, "#7a7068")
    m.box((0.3, 0.05, 0.3), (2.6, -1.14, 0.8), P.WHITE)               # her number on the bow
    m.box((0.2, 0.06, 0.12), (2.6, -1.16, 0.8), P.INK)
    # the wheelhouse forward, windows all round
    m.box((1.6, 1.4, 1.1), (1.3, 0, 1.75), P.WHITE)
    m.box((1.75, 1.55, 0.1), (1.3, 0, 2.33), "#2d5486")
    m.box((0.05, 1.2, 0.35), (2.11, 0, 1.95), "#2a3f5a")
    for s in (-1, 1):
        m.box((1.2, 0.05, 0.3), (1.3, s * 0.71, 1.95), "#2a3f5a")
    # the mast over it, lamps and a radar
    m.cyl(0.06, 2.0, (1.0, 0, 2.38), P.WHITE, segs=5)
    m.box((0.6, 0.12, 0.06), (1.0, 0, 3.9), P.INK)
    m.ball(0.07, (1.0, 0, 4.4), P.WHITE, subdiv=1)
    # the gantry aft, and the fish boxes stacked on deck
    for s in (-1, 1):
        m.box((0.15, 0.15, 2.4), (-2.3, s * 0.75, 2.4), "#e8b24a")
    m.box((0.15, 1.65, 0.15), (-2.3, 0, 3.6), "#e8b24a")
    for i in range(3):
        for j in range(2):
            m.box((0.5, 0.35, 0.24), (-1.2 + j * 0.55, -0.4 + i * 0.4, 1.34), "#4a90c8" if (i + j) % 2 else "#e07a3a")
    # the outriggers: booms out to both sides from the mast's foot, the warps down into the sea
    for s in (-1, 1):
        m.plank_line((-0.2, s * 0.6, 1.6), (-0.2, s * 5.6, 2.5), 0.12, 0.12, "#e8b24a")
        m.plank_line((-0.2, s * 5.6, 2.5), (-1.8, s * 5.8, -0.2), 0.03, 0.03, P.INK)
        m.plank_line((0.9, 0, 3.8), (-0.2, s * 5.6, 2.55), 0.02, 0.02, P.INK)
    # a net hung up on the gantry to dry
    m.box((0.08, 1.4, 0.9), (-2.3, 0, 2.9), "#6a8a6a")
    m.build(root)


# --- Friday: drinks by the fire -------------------------------------------------------------------

def borrel(t: Terrain):
    """A crate of beer by Vincent's log, and a second mug on the grass by his feet: Friday evening."""
    cx, cy = L.CAMPFIRE
    x, y = cx - 0.95, cy + 2.55
    root = holiday("borrel", "friday", (x, y, t.sample(x, y)), rot_z=-0.25, id="borrel")
    root.scale = (1.3,) * 3
    m = Model("borrel", seed=5)
    m.box((0.48, 0.34, 0.26), (0, 0, 0.13), "#c8303a")               # a red crate
    m.box((0.5, 0.36, 0.04), (0, 0, 0.25), "#a8252e")
    m.box((0.12, 0.37, 0.05), (0, 0, 0.2), "#a8252e")                # the handle slot
    for i in range(4):
        for j in range(3):
            if (i, j) in ((3, 0), (1, 2)):
                continue                                             # two gone already
            bx, by = -0.18 + i * 0.12, -0.11 + j * 0.11
            m.cyl(0.04, 0.2, (bx, by, 0.12), "#6a3a1a", segs=6)
            m.cyl(0.016, 0.06, (bx, by, 0.32), "#6a3a1a", segs=4)
            m.cyl(0.02, 0.012, (bx, by, 0.38), P.GOLD, segs=5)
    # and the two open ones, stood on the grass by the log
    for bx, by in ((0.35, -0.18), (0.44, -0.02)):
        m.cyl(0.04, 0.2, (bx, by, 0), "#6a3a1a", segs=6)
        m.cyl(0.016, 0.07, (bx, by, 0.2), "#6a3a1a", segs=4)
        m.box((0.06, 0.005, 0.07), (bx, by - 0.04, 0.08), "#e8d8a8")
    m.build(root)
    # the mug, on the other side of his log
    mx, my = cx + 1.0, cy + 1.55
    g = holiday("borrel_mug", "friday", (mx, my, t.sample(mx, my)), id="borrel_mug")
    g.scale = (1.3,) * 3
    u = Model("borrel_mug")
    u.cyl(0.07, 0.14, (0, 0, 0), "#4a78b8", segs=8)
    u.cyl(0.058, 0.01, (0, 0, 0.13), P.COFFEE, segs=8)
    u.cyl(0.04, 0.02, (0.085, 0, 0.07), "#4a78b8", segs=6, rot=(math.pi / 2, 0, 0))
    u.build(g)


# --- Sunday: a kite -------------------------------------------------------------------------------

def kite():
    """A diamond kite in red and yellow, a tail of bows below it. Faces -y (into the wind, when the
    runtime flies it); its line is a separate thread the runtime stretches from his hands to it."""
    root = holiday("kite", "sunday", PARKED, id="kite")
    m = Model("kite")
    top, bottom, half = 0.75, -1.05, 0.62
    for (x0, z0), (x1, z1), c in (((0, top), (-half, 0), "#c8303a"), ((0, top), (half, 0), P.GOLD),
                                  ((0, bottom), (-half, 0), P.GOLD), ((0, bottom), (half, 0), "#c8303a")):
        m.prism([(0, 0), (x0, z0), (x1, z1)], 0.02, (0, 0, 0), c)
    m.plank_line((0, 0.02, top), (0, 0.02, bottom), 0.03, 0.02, P.WOOD_DARK)
    m.plank_line((-half, 0.02, 0), (half, 0.02, 0), 0.03, 0.02, P.WOOD_DARK)
    m.build(root)
    tail = group("kite_tail", (0, 0, bottom), parent=root)
    tl = Model("kite_tail_string")
    for i in range(5):
        z = -0.35 * (i + 1)
        tl.plank_line((0, 0, z + 0.35), (0, 0, z), 0.015, 0.015, "#e8e0cc")
        c = ["#4a78b8", P.GOLD, "#c8303a"][i % 3]
        for s in (-1, 1):
            tl.prism([(0, 0), (s * 0.14, 0.07), (s * 0.14, -0.07)], 0.02, (0, 0, z), c)
    tl.build(tail)
    line = holiday("kite_line", "sunday", PARKED, id="kite_line")
    k = Model("kite_line_thread")
    k.box((0.015, 0.015, 1.0), (0, 0, 0.5), "#f4efe6")
    k.build(line, unshaded=1)


def populate(t: Terrain):
    washday(t)
    postboat()
    parcel()
    trawler()
    borrel(t)
    kite()
    characters.vincent_standing(group("vincent_about", PARKED, id="vincent_about"), "about")
