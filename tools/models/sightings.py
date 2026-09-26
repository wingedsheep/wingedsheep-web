"""Rare sightings (src/island/scene/sightings.ts): a hot-air balloon on calm summer evenings, a
seal hauled out on the beach, ships on the horizon (the ferry on its timetable, a container ship
now and then, very rarely a tall ship), and a fisherman at the end of the pier on some early
mornings. (The starlings are a few triangles each, built and drawn by the runtime.)

They're templates like the wildlife (fauna.py merges ALL into its own): parked out of sight
under a root tagged `fauna=<name>`, facing +x, y to their left, z = 0 the ground (or the
waterline, or for the fisherman the planks he sits on). Parts that move are their own objects.

The ships are built small, a toy fleet, and the runtime scales the ferry and the container ship
up to sail them (so she's the biggest thing out there).
"""
from __future__ import annotations

import math

from mathutils import Vector

import palette as P
from kit import Model

# the balloon's gores, in turn (Gelderland's are every colour going; this one's a classic)
BALLOON = ["#d8433a", "#f2c440", "#2f6fb0", "#f2ece2"]
WICKER = "#a8783f"
WICKER_DARK = "#7a5530"
FLAME = "#ffb347"

SEAL = "#7a7f86"
SEAL_DARK = "#5a5e66"
SEAL_BELLY = "#b4b2ac"

HULL_NAVY = "#23324f"
HULL_RED = "#9a2f2a"
FERRY_WHITE = "#f4f1ea"
FERRY_BLUE = "#2c6cb0"
WINDOW = "#ffe2a0"
CONTAINERS = ["#c8403a", "#2f6fb0", "#e0823a", "#3d7a4a", "#e8b24a", "#8a8f99", "#6a3b6e"]
TAR = "#2a2230"
SAIL = "#efe6d0"
SAIL_SHADE = "#d8ccb0"
BRACE = 0.6  # how far the tall ship's yards are swung round from square

WAX_JACKET = "#4f5a3a"
CAP = "#6b5a48"
WELLIES = "#2f4a2c"
TROUSERS = "#4a4452"
BUCKET = "#8fa3b0"
ROD = "#3a2a22"
FLOAT = "#e0523a"


def _limb(m: Model, a, b, r0, r1, color, segs=5, glow=False):
    """A tapered round limb from a (radius r0) to b (radius r1)."""
    d = Vector(b) - Vector(a)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r0, d.length, a, color, segs=segs, r_top=r1, rot=tuple(rot), glow=glow)


def _lathe(m: Model, profile, colors, segs=12):
    """A shape turned about z from `profile`, (radius, z) from the top down, each gore (a
    vertical strip between two segments) painted the next colour in turn. The top is closed to a
    point; the bottom is left open, like a balloon's mouth."""
    rings = []
    for r, z in profile:
        rings.append([m.bm.verts.new((math.cos(a) * r, math.sin(a) * r, z))
                      for a in (i / segs * math.pi * 2 for i in range(segs))])
    apex = m.bm.verts.new((0, 0, profile[0][1] + 0.001))
    slots = [m._slot(c, False) for c in colors]
    for j in range(segs):
        k = (j + 1) % segs
        f = m.bm.faces.new((apex, rings[0][k], rings[0][j]))
        f.material_index = slots[j % len(slots)]
        for a, b in zip(rings, rings[1:]):
            f = m.bm.faces.new((a[j], a[k], b[k], b[j]))
            f.material_index = slots[j % len(slots)]


# --- in the air ---------------------------------------------------------------------------

def balloon(root):
    """A hot-air balloon: a striped envelope, the basket hanging under it on its ropes, and the
    burner's flame (`balloon_flame`), which the runtime lights now and then with a roar."""
    e = Model("balloon_envelope")
    profile = [(0.9, 6.4), (1.9, 6.1), (2.5, 5.5), (2.75, 4.8), (2.7, 4.0), (2.35, 3.2), (1.8, 2.5), (1.1, 1.95), (0.55, 1.6)]
    _lathe(e, profile, BALLOON)
    e.cyl(0.9, 0.06, (0, 0, 6.36), BALLOON[0], segs=12)                                   # the crown
    for i in range(4):  # the ropes from the mouth down to the basket's corners
        a = i * math.pi / 2 + math.pi / 4
        _limb(e, (math.cos(a) * 0.52, math.sin(a) * 0.52, 1.6), (math.cos(a) * 0.36, math.sin(a) * 0.36, 0.72), 0.018, 0.018, P.INK, segs=3)
    env = e.build(root)
    b = Model("balloon_basket")
    b.box((0.7, 0.7, 0.55), (0, 0, 0.28), WICKER)
    b.box((0.76, 0.76, 0.08), (0, 0, 0.56), WICKER_DARK)                                  # the rim
    for s in (1, -1):
        b.box((0.03, 0.72, 0.5), (s * 0.36, 0, 0.28), WICKER_DARK)
    b.box((0.18, 0.12, 0.16), (0.12, 0.1, 0.68), "#e3a680")                               # two heads looking over the side
    b.box((0.18, 0.12, 0.16), (0.12, -0.14, 0.68), "#c89070")
    b.box((0.22, 0.16, 0.18), (0, 0, 0.82), P.IRON)                                       # the burner
    b.build(env)
    f = Model("balloon_flame")
    f.cyl(0.14, 0.5, (0, 0, 0), FLAME, segs=6, r_top=0.02, glow=True)
    f.cyl(0.07, 0.35, (0, 0, 0.02), "#fff2c0", segs=5, r_top=0.0, glow=True)
    f.build(env, loc=(0, 0, 0.92))


# --- on the beach -------------------------------------------------------------------------

def seal(root):
    """A harbour seal hauled out on the sand: fat and speckled, lying on its belly. It lifts its
    head (`seal_head`) and its hind flippers (`seal_tail`) into a banana, now and then."""
    b = Model("seal_body", seed=31)
    b.ball(0.32, (0, 0, 0.24), SEAL, subdiv=2, scale=(2.1, 1.0, 0.78))
    b.ball(0.26, (0.05, 0, 0.1), SEAL_BELLY, subdiv=1, scale=(2.2, 0.95, 0.45))
    for _ in range(9):  # the speckles
        x = b.rng.uniform(-0.5, 0.45)
        y = b.rng.choice((1, -1)) * b.rng.uniform(0.05, 0.28)
        b.box((0.06, 0.05, 0.04), (x, y, 0.45 - abs(y) * 0.5), SEAL_DARK)
    for s in (1, -1):  # front flippers, flat on the sand
        b.box((0.2, 0.08, 0.04), (0.28, s * 0.33, 0.04), SEAL_DARK, rot=(0, 0, s * 0.5))
    body = b.build(root)
    h = Model("seal_head")  # pivots at the neck
    h.ball(0.2, (0.12, 0, 0.04), SEAL, subdiv=2, scale=(1.2, 1.0, 0.95))
    h.ball(0.1, (0.3, 0, -0.02), SEAL_BELLY, subdiv=1, scale=(1.0, 1.2, 0.8))              # the muzzle
    h.box((0.04, 0.05, 0.03), (0.4, 0, 0.0), P.INK)                                        # nose
    for s in (1, -1):
        h.box((0.05, 0.06, 0.06), (0.25, s * 0.1, 0.1), P.INK)                             # big dark eyes
        for i in range(2):  # whiskers
            h.box((0.02, 0.16, 0.01), (0.33, s * 0.14, -0.02 - i * 0.03), "#ece6da", rot=(0, 0, s * (0.3 + i * 0.3)))
    h.build(body, loc=(0.62, 0, 0.28))
    t = Model("seal_tail")  # the hind flippers, pivoting at the hips
    _limb(t, (0, 0, 0), (-0.32, 0, -0.02), 0.16, 0.08, SEAL, segs=6)
    for s in (1, -1):
        t.box((0.22, 0.14, 0.03), (-0.42, s * 0.08, -0.02), SEAL_DARK, rot=(0, 0, s * 0.35), taper=1.0)
    t.build(body, loc=(-0.6, 0, 0.2))


# --- on the horizon -----------------------------------------------------------------------

def ferry(root):
    """The ferry: a white double-ended boat with a blue band, cars on the open deck, two decks
    of windows (lit after dark) and a funnel in the company colours."""
    m = Model("ferry_body", seed=4)
    plan = [(-4.4, -0.9), (4.4, -0.9), (4.9, 0.0), (4.4, 0.9), (-4.4, 0.9), (-4.9, 0.0)]
    m.slab(plan, -0.4, 0.2, HULL_NAVY)
    m.slab(plan, 0.2, 0.75, FERRY_WHITE)
    m.slab([(x * 1.01, y * 1.02) for x, y in plan], 0.42, 0.56, FERRY_BLUE)             # the band
    m.slab([(x * 0.98, y * 0.96) for x, y in plan], 0.75, 0.8, P.STONE_DARK)             # the car deck
    for i, x in enumerate((-3.6, -2.6, -1.6, 2.2, 3.2)):                                 # cars, nose to tail
        c = ["#c8403a", "#e8b24a", "#8fa3b0", "#3d7a4a", "#2f6fb0"][i]
        m.box((0.7, 0.4, 0.22), (x, 0.4, 0.92), c)
        m.box((0.4, 0.36, 0.16), (x - 0.05, 0.4, 1.1), c)
        m.box((0.7, 0.4, 0.22), (x + 0.2, -0.42, 0.92), ["#f2ece2", "#6a3b6e", "#c8403a", "#1d1a24", "#e0823a"][i])
    # the superstructure amidships: two decks of windows and the bridge on top
    m.box((3.2, 1.5, 0.7), (0.3, 0, 1.15), FERRY_WHITE)
    m.box((2.6, 1.4, 0.55), (0.3, 0, 1.78), FERRY_WHITE)
    for i in range(7):
        for s in (1, -1):
            m.box((0.26, 0.04, 0.2), (-1.0 + i * 0.43, s * 0.76, 1.2), WINDOW, glow=True)
    for i in range(5):
        for s in (1, -1):
            m.box((0.3, 0.04, 0.18), (-0.7 + i * 0.5, s * 0.71, 1.82), WINDOW, glow=True)
    m.box((1.2, 1.7, 0.4), (0.3, 0, 2.25), FERRY_WHITE)                                   # the bridge, wings out wide
    m.box((1.22, 1.72, 0.12), (0.3, 0, 2.25), "#2a3a4a")                                  # its windows
    m.box((1.3, 1.8, 0.06), (0.3, 0, 2.48), P.STONE_DARK)
    m.cyl(0.24, 0.8, (-1.1, 0, 2.05), FERRY_BLUE, segs=8)                                 # the funnel
    m.cyl(0.25, 0.2, (-1.1, 0, 2.55), FERRY_WHITE, segs=8)
    m.cyl(0.25, 0.14, (-1.1, 0, 2.85), P.INK, segs=8)
    m.cyl(0.03, 0.8, (0.3, 0, 2.5), P.IRON, segs=4)                                       # the mast, with its lamp
    m.box((0.1, 0.1, 0.1), (0.3, 0, 3.32), "#fff6d0", glow=True)
    m.build(root)


def container(root):
    """A container ship, low and long and in no hurry: containers stacked every colour the
    whole length of her, and the bridge right aft."""
    m = Model("container_body", seed=9)
    plan = [(-7.2, -1.1), (5.8, -1.1), (7.6, 0.0), (5.8, 1.1), (-7.2, 1.1), (-7.5, 0.0)]
    m.slab(plan, -0.5, 0.25, HULL_RED)                                                    # the red below the waterline, just
    m.slab(plan, 0.25, 1.0, HULL_NAVY)
    m.slab([(x * 0.99, y * 0.97) for x, y in plan], 1.0, 1.05, "#8a8f99")
    for bay in range(9):
        x = 4.6 - bay * 1.18
        rows = 3 if bay in (0, 8) else 4
        for tier in range(m.rng.randint(1, 3) if bay else 1):
            for row in range(rows):
                y = (row - (rows - 1) / 2) * 0.5
                m.box((1.12, 0.48, 0.44), (x, y, 1.27 + tier * 0.45), m.rng.choice(CONTAINERS))
    # the bridge: a tall white block aft, windows across the top, and the funnel behind it
    m.box((1.2, 2.0, 1.9), (-6.2, 0, 2.0), FERRY_WHITE)
    m.box((1.25, 2.6, 0.3), (-6.0, 0, 2.9), FERRY_WHITE)                                  # bridge wings
    m.box((1.27, 2.62, 0.12), (-5.98, 0, 2.95), "#2a3a4a")
    for i in range(3):
        for s in (1, -1):
            m.box((0.2, 0.04, 0.14), (-6.4 + i * 0.3, s * 1.01, 1.6 + (i % 2) * 0.4), WINDOW, glow=True)
    m.box((0.6, 0.7, 0.9), (-7.0, 0, 2.5), HULL_RED)                                      # the funnel
    m.box((0.62, 0.72, 0.2), (-7.0, 0, 2.9), P.INK)
    m.cyl(0.03, 0.9, (5.9, 0, 1.0), P.IRON, segs=4)                                       # the foremast, with its lamp
    m.box((0.1, 0.1, 0.1), (5.9, 0, 1.95), "#fff6d0", glow=True)
    m.build(root)


def tallship(root):
    """A tall ship under full sail: three masts square-rigged, black hull with a white stripe
    and a row of painted gunports, a long bowsprit with its jibs. The sails are one part
    (`tallship_sails`), so the runtime can fill them with the wind."""
    m = Model("tallship_body", seed=12)
    plan = [(-3.8, -0.7), (2.6, -0.8), (4.1, 0.0), (2.6, 0.8), (-3.8, 0.7), (-4.0, 0.0)]
    m.slab(plan, -0.4, 0.15, "#6a3b2a")                                                   # copper-brown below
    m.slab(plan, 0.15, 0.9, TAR, top=[(x * 1.03, y * 1.08) for x, y in plan])
    m.slab([(x * 1.02, y * 1.06) for x, y in plan], 0.48, 0.62, "#f2ece2")                # the white stripe…
    for i in range(8):                                                                    # …with its gunports
        for s in (1, -1):
            m.box((0.16, 0.04, 0.1), (-2.8 + i * 0.72, s * 0.8, 0.55), TAR)
    m.slab([(x * 1.0, y * 1.04) for x, y in plan], 0.9, 0.95, P.WOOD_LIGHT)               # the deck
    m.box((1.3, 1.3, 0.45), (-3.2, 0, 1.15), TAR)                                         # the raised poop deck aft
    m.box((1.32, 1.32, 0.06), (-3.2, 0, 1.4), P.WOOD_LIGHT)
    for i in range(3):
        m.box((0.18, 0.04, 0.14), (-3.6 + i * 0.35, 0, 1.1), WINDOW, glow=True)
    _limb(m, (3.6, 0, 1.0), (5.6, 0, 1.7), 0.07, 0.04, P.WOOD_DARK, segs=4)               # the bowsprit
    # the masts: fore, main (tallest) and mizzen, each with its yards
    for x, h in ((2.0, 5.2), (-0.1, 6.0), (-2.2, 4.6)):
        m.cyl(0.08, h, (x, 0, 0.9), P.WOOD_DARK, segs=5, r_top=0.04)
        for k in (0.3, 0.55, 0.78):  # braced round, as if the wind were on her quarter
            w = 2.3 - k * 1.3
            dx, dy = math.sin(BRACE) * w / 2, math.cos(BRACE) * w / 2
            _limb(m, (x + dx, -dy, 0.9 + h * k), (x - dx, dy, 0.9 + h * k), 0.035, 0.035, P.WOOD_DARK, segs=4)
        m.box((0.3, 0.06, 0.18), (x - 0.1, 0, 0.9 + h + 0.1), "#c8403a")                  # a pennant at each masthead
    m.box((0.5, 0.03, 0.34), (-4.05, 0, 1.95), "#c8403a")                                 # the ensign at the stern
    m.box((0.5, 0.032, 0.11), (-4.05, 0, 1.95), "#f2ece2")
    m.box((0.5, 0.034, 0.11), (-4.05, 0, 1.84), "#2f6fb0")
    _limb(m, (-4.0, 0, 1.4), (-4.0, 0, 2.2), 0.02, 0.02, P.WOOD_DARK, segs=3)
    body = m.build(root)
    s = Model("tallship_sails", seed=13)
    for x, h in ((2.0, 5.2), (-0.1, 6.0), (-2.2, 4.6)):
        for lo, hi in ((0.3, 0.55), (0.55, 0.78), (0.78, 0.95)):
            wl, wh = 2.2 - lo * 1.3, 2.2 - hi * 1.3
            z0, z1 = 0.9 + h * lo + 0.05, 0.9 + h * hi - 0.05
            # a square sail bellying forward: its middle further forward than its edges
            fwd = (math.cos(BRACE), math.sin(BRACE))
            s.box((0.04, (wl + wh) / 2, z1 - z0), (x + fwd[0] * 0.1, fwd[1] * 0.1, (z0 + z1) / 2), SAIL, taper=wh / wl, rot=(0, 0, BRACE))
            s.box((0.04, (wl + wh) / 2 * 0.5, (z1 - z0) * 0.9), (x + fwd[0] * 0.16, fwd[1] * 0.16, (z0 + z1) / 2), SAIL_SHADE, rot=(0, 0, BRACE))
    for i, (a, b) in enumerate((((3.6, 1.0), (2.0, 5.6)), ((4.6, 1.3), (2.0, 4.8)))):     # the jibs, from bowsprit to foremast
        (x0, z0), (x1, z1) = a, b
        s.prism([(x0, z0), (x1, z0 + 0.4), (x1, z1)], 0.03, (0, 0, 0), SAIL if i else SAIL_SHADE)
    s.build(body)


# --- on the pier --------------------------------------------------------------------------

def fisherman(root):
    """An old fisherman sitting on the end of the pier, legs over the edge, facing out to sea:
    flat cap, waxed jacket, wellies, a bucket beside him and a thermos. The rod (`fisherman_rod`)
    pivots in his hands; from its tip hangs the line (`fisherman_line`) with a float, and a fish
    (`fisherman_fish`), hidden till he lands one."""
    b = Model("fisherman_body", seed=21)
    b.box((0.34, 0.42, 0.14), (0.0, 0, 0.07), TROUSERS)                                   # sitting on the planks
    for s in (1, -1):  # legs over the edge, wellies dangling
        b.box((0.38, 0.15, 0.13), (0.22, s * 0.11, 0.06), TROUSERS)
        b.box((0.14, 0.15, 0.42), (0.44, s * 0.11, -0.12), WELLIES)
        b.box((0.2, 0.15, 0.08), (0.48, s * 0.11, -0.32), WELLIES)
    b.box((0.3, 0.46, 0.5), (-0.02, 0, 0.38), WAX_JACKET, taper=0.85)                     # waxed jacket
    b.box((0.31, 0.2, 0.12), (-0.02, 0, 0.6), "#3f4a2e")                                  # its corduroy collar
    for s in (1, -1):  # arms forward to the rod, resting on his knees
        _limb(b, (0.02, s * 0.24, 0.55), (0.24, s * 0.16, 0.26), 0.07, 0.06, WAX_JACKET, segs=5)
        b.box((0.09, 0.09, 0.08), (0.28, s * 0.12, 0.24), "#e0a888")                      # hands
    b.box((0.16, 0.2, 0.2), (-0.3, 0, 0.12), "#6a5a4a")                                   # a folded coat to lean on
    body = b.build(root)
    h = Model("fisherman_head")  # pivots at the neck
    h.box((0.24, 0.24, 0.26), (0, 0, 0.13), "#e0a888")
    h.box((0.05, 0.05, 0.06), (0.13, 0, 0.1), "#d08f70")                                  # nose
    for s in (1, -1):
        h.box((0.02, 0.04, 0.03), (0.125, s * 0.06, 0.15), P.INK)
    h.box((0.1, 0.22, 0.08), (0.08, 0, 0.02), "#d8d4cc")                                  # a grey stubbly beard
    h.box((0.3, 0.28, 0.08), (0.02, 0, 0.29), CAP)                                        # the flat cap…
    h.box((0.12, 0.26, 0.03), (0.18, 0, 0.27), CAP)                                       # …and its peak
    h.build(body, loc=(0.0, 0, 0.66))
    r = Model("fisherman_rod")  # pivots in his hands; points out to sea along +x, and up
    _limb(r, (-0.18, 0, -0.05), (1.9, 0, 0.9), 0.025, 0.008, ROD, segs=4)
    r.cyl(0.04, 0.06, (0.02, 0, 0.0), "#8a8f99", segs=5, rot=(0, math.pi / 2 - 0.4, 0))  # the reel
    rod = r.build(body, loc=(0.3, 0, 0.26))
    ln = Model("fisherman_line")  # hangs from the rod's tip to the float on the water
    ln.box((0.01, 0.01, 1.85), (0, 0, -0.925), "#dcdcdc")
    ln.ball(0.045, (0, 0, -1.85), FLOAT, subdiv=1)
    ln.build(rod, loc=(1.9, 0, 0.9))
    f = Model("fisherman_fish")  # hanging from the tip when he reels one in
    f.ball(0.07, (0, 0, -0.18), "#b8c4cc", subdiv=1, scale=(0.6, 0.6, 2.0))
    f.box((0.02, 0.1, 0.07), (0, 0, -0.34), "#8a9aa4")
    f.box((0.004, 0.004, 0.06), (0, 0, -0.03), "#dcdcdc")
    f.build(rod, loc=(1.9, 0, 0.9))
    k = Model("fisherman_kit")  # beside him on the boards, on his right: the bucket, the thermos behind it
    k.cyl(0.13, 0.26, (0, 0, 0), BUCKET, segs=8, r_top=0.15)
    k.cyl(0.12, 0.02, (0, 0, 0.22), "#3a6a8a", segs=8)                                    # water in it
    k.cyl(0.05, 0.28, (-0.3, 0.02, 0), "#3d7a4a", segs=6)                                 # the thermos
    k.cyl(0.052, 0.06, (-0.3, 0.02, 0.26), "#c8c8c8", segs=6)
    k.build(body, loc=(-0.05, -0.4, 0))


ALL = {
    "balloon": (balloon, 1.0),
    "seal": (seal, 1.3),
    "ferry": (ferry, 1.0), "container": (container, 1.0), "tallship": (tallship, 1.0),
    "fisherman": (fisherman, 1.15),
}
