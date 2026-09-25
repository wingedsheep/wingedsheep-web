"""The wild-water river (src/island/river/): everything the runtime scatters along a river it makes
up as you paddle down it. Nothing here is placed: each template's root sits out of sight and
carries `river=<kind>`, and the runtime clones it wherever the river wants one.

The banks and the water are generated at runtime; this is the furniture. Things in the water
(rocks, logs, buoys, balls) have z = 0 at the waterline. Trees and the rest stand on z = 0.
Animals face +x like the island's (tools/models/fauna.py); the kayak faces -y like Vincent's.
"""
from __future__ import annotations

import math
import random

import palette as P
import beike
import characters
import fauna
from kit import Model, group, light
from mathutils import Vector

MOSS = ["#4f7a3a", "#5f8a42", "#6f9a4a"]
WET_ROCK = ["#4a3f52", "#574b5f", "#5d5063"]
# river rocks are paler than the island's, so they stand out from the water
RIVER_ROCK = ["#9a90a2", "#a89fae", "#8a8094", "#b3aab5"]
BIRCH = "#e8e2d6"
BIRCH_MARK = "#2e2a33"
LILY = ["#3f7d43", "#4a8a45"]
LILY_FLOWER = ["#f4efe6", "#f2b6c8"]
REED = ["#6f8a3a", "#86a04a", "#a0b25a"]
BULRUSH = "#5a3a24"
BUOY_RED = "#d8402e"
BUOY_WHITE = "#f2ece2"
TAPE = "#b9bcc4"
TAPE_DARK = "#8a8e98"
KINGFISHER = "#2f8ac0"
KINGFISHER_LIGHT = "#5fc0d8"
# wildflowers, toadstools and the forest floor
STEM = "#4f7a3a"
FIREWEED = ["#b0489a", "#c45aae", "#9a3f8c"]
BUTTERCUP = "#f2c52e"
CAMPION = ["#f4efe6", "#e87aa8", "#f2b6c8"]
AGARIC = "#d0342a"
AGARIC_DOT = "#f4efe6"
MUSH_STEM = "#efe6d4"
CEP = ["#7a4a2a", "#8c5a34"]
CEP_STEM = "#d9c8a4"
SHELF_FUNGUS = ["#c9803a", "#e0a45a"]
HEARTWOOD = "#c9a06a"
EARTH = "#4a3a2e"
# bleached driftwood, sun- and water-worn
DRIFT = ["#c9bca6", "#b5a892", "#d8cdb8", "#a89a84"]
WILLOW = ["#7fa84a", "#8fb85a", "#6f9a4a"]
SWING_ROPE = "#c9a56a"

_n = 0


def _root(kind: str, **extras):
    """A template's root, parked in a row far under the world."""
    global _n
    _n += 1
    return group(f"river_{kind}", (_n * 4.0, -300, -40), river=kind, **extras)


# --- in the water ------------------------------------------------------------------------

def rocks():
    """Boulders for the river to break on: rounded, wet-dark below the waterline and paler,
    sometimes mossy, above it. Radius about 1 (the runtime scales them); z = 0 is the water."""
    shapes = [
        (1.0, (1.2, 1.0, 0.7), 0.14, False),
        (1.0, (1.0, 0.9, 0.85), 0.16, True),
        (1.0, (1.4, 0.8, 0.5), 0.1, False),     # a low slab the water pours over
        (0.9, (0.9, 0.9, 1.25), 0.14, True),    # a tall one, standing up out of the current
        (1.0, (1.1, 1.1, 0.6), 0.18, True),
    ]
    for i, (r, scale, jitter, mossy) in enumerate(shapes):
        root = _root(f"rock_{i}", radius=round(max(scale[0], scale[1]) * r, 3))
        m = Model(f"rock_{i}", seed=40 + i)
        top = RIVER_ROCK[i % 4]
        m.ball(r, (0, 0, 0.05), top, subdiv=2, scale=scale, jitter=jitter)
        m.ball(r * 1.04, (0, 0, -0.35), WET_ROCK[i % 3], subdiv=1, scale=(scale[0], scale[1], 0.45), jitter=jitter)
        if mossy:
            m.ball(r * 0.6, (-0.1, 0.05, r * scale[2] * 0.62), MOSS[i % 3], subdiv=1,
                   scale=(scale[0], scale[1], 0.35), jitter=0.05)
        # a few pebbles lodged round it
        rng = random.Random(i)
        for _ in range(3):
            a = rng.uniform(0, math.tau)
            d = r * scale[0] * rng.uniform(0.9, 1.2)
            m.ball(rng.uniform(0.12, 0.22), (math.cos(a) * d, math.sin(a) * d, -0.05), P.PEBBLE, subdiv=1, jitter=0.03)
        m.build(root)


def logs():
    """A fallen tree lying out from the bank: the root plate on the bank end (x = 0), the trunk
    reaching along +x into the river, stubs of branches, a bit of moss. 7 m long."""
    for i in range(2):
        root = _root(f"log_{i}", length=7.0)
        m = Model(f"log_{i}", seed=60 + i)
        m.cyl(0.36, 7.0, (0, 0, 0.12), P.BARK, segs=7, r_top=0.26, rot=(0, math.pi / 2, 0))
        m.cyl(0.9, 0.35, (-0.1, 0, -0.3), "#4a3a2e", segs=7, rot=(0, math.pi / 2, 0))   # root plate, torn up
        for x, a, l in ((2.2, 0.9, 1.1), (3.8, -1.1, 0.9), (5.3, 0.7, 0.8)):
            m.plank_line((x, 0, 0.3), (x + 0.3, math.sin(a) * l, 0.3 + abs(math.cos(a)) * l * 0.6), 0.1, 0.1, P.BARK)
        m.ball(0.3, (1.4, 0, 0.44), MOSS[i], subdiv=1, scale=(2.2, 0.9, 0.3), jitter=0.04)
        if i == 1:
            m.ball(0.2, (4.4, 0, 0.36), MOSS[2], subdiv=1, scale=(2.0, 0.9, 0.3), jitter=0.04)
        m.build(root)


def buoys():
    """A pair of slalom buoys: red and white, bobbing. Go between them for a bonus."""
    root = _root("buoy")
    m = Model("buoy")
    m.ball(0.32, (0, 0, 0.05), BUOY_RED, subdiv=2, scale=(1, 1, 0.9))
    m.cyl(0.33, 0.1, (0, 0, 0.08), BUOY_WHITE, segs=10)
    m.cyl(0.04, 0.55, (0, 0, 0.3), P.IRON, segs=5)
    m.box((0.3, 0.02, 0.2), (0.15, 0, 0.72), BUOY_RED)                                 # a little flag
    m.build(root)


def ball():
    """A tennis ball, bobbing downstream. Beike has lost a great many of them in this river."""
    root = _root("ball")
    m = Model("ball")
    m.ball(0.2, (0, 0, 0.08), P.TENNIS, subdiv=2)
    m.box((0.41, 0.03, 0.035), (0, 0, 0.08), P.DOG_WHITE, rot=(0, 0, 0.4))            # the seam
    m.box((0.035, 0.41, 0.035), (0, 0, 0.1), P.DOG_WHITE, rot=(0.5, 0, 0))
    m.build(root)


def tape():
    """A roll of duct tape, floating: patches a hole in the hull."""
    root = _root("tape")
    m = Model("tape")
    m.cyl(0.3, 0.2, (0, 0, -0.02), TAPE, segs=12)
    m.cyl(0.17, 0.21, (0, 0, -0.025), P.INK, segs=10)
    m.cyl(0.31, 0.04, (0, 0, 0.06), TAPE_DARK, segs=12)
    m.build(root)


def lily():
    """A cluster of lily pads for the slow water, one with a flower."""
    for i in range(2):
        root = _root(f"lily_{i}")
        m = Model(f"lily_{i}", seed=80 + i)
        rng = random.Random(80 + i)
        for k in range(5):
            a = rng.uniform(0, math.tau)
            d = rng.uniform(0.2, 1.1)
            r = rng.uniform(0.28, 0.45)
            m.cyl(r, 0.03, (math.cos(a) * d, math.sin(a) * d, 0.0), LILY[k % 2], segs=8)
        if i == 0:
            for k in range(6):
                a = k * math.tau / 6
                m.box((0.16, 0.06, 0.06), (math.cos(a) * 0.08, math.sin(a) * 0.08, 0.08), LILY_FLOWER[0],
                      rot=(0, -0.5, a))
            m.cyl(0.05, 0.06, (0, 0, 0.06), "#f2d15a", segs=6)
        m.build(root)


# --- on the banks -------------------------------------------------------------------------

def trees():
    """Trees for the banks. The leafy crowns are their own parts named `crown` so the runtime can
    colour them for the season (fresh in spring, turning in autumn, bare in winter)."""
    for i in range(3):
        root = _root(f"pine_{i}", height=round(6 + i * 1.3, 2))
        rng = random.Random(100 + i)
        m = Model(f"pine_{i}", seed=100 + i)
        size = 1.0 + i * 0.22
        m.cyl(0.22 * size, 1.4 * size, (0, 0, 0), P.BARK, segs=5)
        for k in range(4 + (i > 0)):
            z = (1.0 + k * 1.05) * size
            r = (1.7 - k * 0.32) * size
            m.cyl(max(r, 0.4), 1.7 * size, (0, 0, z), P.PINE[(k + i) % 3], segs=7, r_top=0.05,
                  rot=(0, 0, rng.uniform(0, 1)))
        m.build(root)

    for i in range(3):
        root = _root(f"tree_{i}", height=round(5.5 + i, 2))
        rng = random.Random(120 + i)
        size = 1.0 + i * 0.18
        m = Model(f"tree_{i}_trunk", seed=120 + i)
        h = 2.6 * size
        m.cyl(0.25 * size, h, (0, 0, 0), P.BARK, segs=6, r_top=0.17 * size)
        m.cyl(0.42 * size, 0.3, (0, 0, 0), P.BARK, segs=6, r_top=0.25 * size)
        for a in (rng.uniform(0, math.tau), rng.uniform(0, math.tau)):
            m.plank_line((0, 0, h * 0.65), (math.cos(a) * 1.0 * size, math.sin(a) * 1.0 * size, h * 1.2),
                         0.13 * size, 0.13 * size, P.BARK)
        m.build(root)
        c = Model("crown", seed=121 + i)
        c.ball(1.8 * size, (0, 0, h + 1.1 * size), P.LEAF[2], subdiv=1, jitter=0.25 * size, scale=(1, 1, 0.85))
        for k in range(3):
            a = rng.uniform(0, math.tau)
            c.ball(rng.uniform(1.0, 1.3) * size, (math.cos(a) * 1.1 * size, math.sin(a) * 1.1 * size,
                                                  h + rng.uniform(0.3, 1.3) * size),
                   P.LEAF[1 + k % 3], subdiv=1, jitter=0.18 * size)
        c.build(root)

    # birches: pale and thin, for the sandy stretches
    for i in range(2):
        root = _root(f"birch_{i}", height=6.0)
        rng = random.Random(140 + i)
        m = Model(f"birch_{i}_trunk", seed=140 + i)
        m.cyl(0.15, 5.2, (0, 0, 0), BIRCH, segs=6, r_top=0.09)
        for k in range(7):
            m.box((0.2, 0.2, 0.07), (0, 0, 0.5 + k * 0.65 + rng.uniform(-0.1, 0.1)), BIRCH_MARK,
                  rot=(0, 0, rng.uniform(0, math.tau)))
        m.build(root)
        c = Model("crown", seed=141 + i)
        for k in range(4):
            a = rng.uniform(0, math.tau)
            c.ball(rng.uniform(0.8, 1.1), (math.cos(a) * 0.6, math.sin(a) * 0.6, 4.2 + k * 0.45),
                   P.LEAF[2 + k % 2], subdiv=1, jitter=0.15, scale=(1, 1, 1.2))
        c.build(root)


def bushes():
    for i in range(2):
        root = _root(f"bush_{i}")
        c = Model("crown", seed=160 + i)
        rng = random.Random(160 + i)
        for k in range(3):
            c.ball(rng.uniform(0.55, 0.8), (rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), 0.45),
                   P.LEAF[1 + k % 3], subdiv=1, jitter=0.1, scale=(1, 1, 0.75))
        c.build(root)


def reeds():
    """Reeds and a couple of bulrushes, for the slow edges."""
    for i in range(2):
        root = _root(f"reeds_{i}")
        m = Model(f"reeds_{i}", seed=180 + i)
        rng = random.Random(180 + i)
        for _ in range(14):
            x, y = rng.gauss(0, 0.45), rng.gauss(0, 0.45)
            h = rng.uniform(0.8, 1.6)
            m.plank_line((x, y, -0.2), (x + rng.uniform(-0.15, 0.15), y + rng.uniform(-0.15, 0.15), h),
                         0.05, 0.05, rng.choice(REED))
        for _ in range(3):
            x, y = rng.gauss(0, 0.3), rng.gauss(0, 0.3)
            m.cyl(0.02, 1.5, (x, y, -0.2), REED[0], segs=4)
            m.cyl(0.07, 0.3, (x, y, 1.15), BULRUSH, segs=6)
        m.build(root)


def ferns():
    root = _root("fern")
    m = Model("fern", seed=190)
    for k in range(7):
        a = k * math.tau / 7
        m.plank_line((0, 0, 0.05), (math.cos(a) * 0.7, math.sin(a) * 0.7, 0.45), 0.2, 0.03, P.LEAF[2 + k % 2])
    m.build(root)


def boulders():
    """Big, dry bank rocks and a stretch of gorge wall: craggy, stepped, pale on top."""
    for i in range(2):
        root = _root(f"crag_{i}")
        m = Model(f"crag_{i}", seed=200 + i)
        rng = random.Random(200 + i)
        for k in range(4):
            m.ball(rng.uniform(1.2, 1.9), (rng.uniform(-1.2, 1.2), rng.uniform(-1.0, 1.0), rng.uniform(0.2, 1.6)),
                   P.PEAK_ROCK[k % 4], subdiv=1, jitter=0.25, scale=(1.2, 1.0, 1.0))
        m.build(root)


def bridge():
    """A wooden footbridge on stone footings. It spans x = -10 … 10; the runtime stretches it (x)
    to the river's width, so the planks run across the stream."""
    root = _root("bridge", span=20.0)
    m = Model("bridge")
    for x in (-10.5, 10.5):
        m.box((2.4, 3.2, 3.2), (x, 0, 0.8), P.STONE)
        m.box((2.6, 3.4, 0.3), (x, 0, 2.45), P.STONE_DARK)
    m.box((22.0, 2.4, 0.22), (0, 0, 2.7), P.PLANK)
    for k in range(-10, 11):
        m.box((0.08, 2.42, 0.23), (k * 1.0, 0, 2.71), P.WOOD_DARK)
    for y in (-1.15, 1.15):
        m.box((22.0, 0.12, 0.12), (0, y, 3.75), P.WOOD)
        for k in range(-10, 11, 2):
            m.box((0.14, 0.14, 1.05), (k * 1.0, y, 3.25), P.WOOD_DARK)
    for x in (-5, 5):                                                                   # trestles in the river
        for y in (-1.0, 1.0):
            m.box((0.3, 0.3, 4.0), (x, y, 0.6), P.WOOD_DARK)
    m.build(root)
    light(root, (10.5, 1.3, 3.8), P.LANTERN, radius=7, intensity=1.1, flicker=0.2)   # a lantern at one end
    lamp = Model("bridge_lamp")
    lamp.box((0.08, 0.08, 1.0), (10.5, 1.3, 3.2), P.IRON)
    lamp.box((0.24, 0.24, 0.3), (10.5, 1.3, 3.8), P.LANTERN, glow=True)
    lamp.build(root)


def sign():
    """A distance post on the bank. The runtime paints the board (`sign_board`)."""
    root = _root("sign")
    m = Model("sign_post")
    m.cyl(0.09, 1.9, (0, 0, 0), P.WOOD_DARK, segs=6)
    m.box((0.1, 0.1, 0.12), (0, 0, 1.94), P.WOOD_DARK)
    m.build(root)
    b = Model("sign_board")
    b.box((1.3, 0.08, 0.6), (0, 0, 0), P.WOOD_LIGHT)
    b.build(root, loc=(0, -0.08, 1.45))


def tent():
    """A little green tent pitched on the bank, a wild camp, with a fire that glows at night."""
    root = _root("tent")
    m = Model("tent")
    m.prism([(-0.9, 0), (0.9, 0), (0, 1.1)], 2.0, (0, 0, 0), P.TENT_GREEN)
    m.prism([(-0.4, 0), (0.4, 0), (0, 0.6)], 0.02, (0, -1.01, 0), "#2e5a2a")          # the door
    for x in (-1.3, 1.3):
        m.plank_line((0, x * 0.9, 1.1), (0, x * 1.3, 0), 0.02, 0.02, P.STRING)         # guy lines
    m.box((0.5, 0.35, 0.3), (1.2, -0.6, 0.15), P.PACK)
    for a in range(5):
        m.cyl(0.1, 0.1, (math.cos(a * 1.25) * 0.4 - 0.2, math.sin(a * 1.25) * 0.4 - 2.2, 0), P.STONE, segs=5)
    m.build(root)
    f = Model("tent_fire")
    f.cyl(0.18, 0.35, (-0.2, -2.2, 0.05), P.FIRE, segs=5, r_top=0.02, glow=True)
    f.build(root)
    light(root, (-0.2, -2.2, 0.6), P.FIRE, radius=6, intensity=1.2, flicker=0.6)


def cabin():
    """A fisherman's cabin on stilts at the water's edge, with a little jetty. Its window glows at
    night; nobody is ever in."""
    root = _root("cabin")
    m = Model("cabin")
    for x in (-1.3, 1.3):
        for y in (-1.1, 1.1):
            m.box((0.2, 0.2, 1.4), (x, y, 0.2), P.WOOD_DARK)
    m.box((3.0, 2.6, 2.0), (0, 0, 1.9), P.WOOD)
    m.gable((3.4, 3.0, 1.2), (0, 0, 2.9), P.RUST_ROOF, rot=(0, 0, 0))
    m.prism([(-1.3, 0), (1.3, 0), (0, 1.2)], 0.1, (0, 0, 2.9), P.WOOD, rot=(0, 0, math.pi / 2))
    m.box((0.6, 0.06, 0.5), (0.6, -1.31, 2.1), P.WARM_LIGHT, glow=True)
    m.box((0.7, 1.9, 0.1), (-0.3, -2.4, 0.9), P.PLANK)                                 # the jetty
    for y in (-3.2, -1.6):
        m.box((0.12, 0.12, 1.2), (-0.3, y, 0.35), P.WOOD_DARK)
    m.cyl(0.08, 0.5, (0.5, 1.4, 1.0), P.STONE_DARK, segs=6)                            # stovepipe
    m.build(root)
    light(root, (0.6, -2.0, 2.1), P.WARM_LIGHT, radius=6, intensity=0.8)


# --- the wilder bits: flowers, fungi, dead wood, driftwood ------------------------------------

def _pole(m, a, b, r, color, r_end=None, segs=6):
    """A round log or branch from a to b (r at a, r_end at b)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r, d.length, tuple(a), color, segs=segs, r_top=r if r_end is None else r_end, rot=tuple(rot))


def _tuft(m, rng, spread, n=4):
    """A low leafy base for a clump of flowers."""
    for k in range(n):
        m.ball(rng.uniform(0.1, 0.15), (rng.uniform(-spread, spread), rng.uniform(-spread, spread), 0.04),
               P.LEAF[1 + k % 3], subdiv=1, jitter=0.02, scale=(1.2, 1.2, 0.55))


def flowers():
    """Wildflower clumps about 0.8 m across: fireweed spikes, buttercups, campion. They stay in
    flower all year (they are not crowns)."""
    # 0: fireweed / foxglove spikes, tall and purple
    root = _root("flowers_0")
    m = Model("flowers_0", seed=300)
    rng = random.Random(300)
    _tuft(m, rng, 0.25)
    for k in range(6):
        a = k * math.tau / 6 + rng.uniform(-0.3, 0.3)
        d = rng.uniform(0.08, 0.32)
        x, y = math.cos(a) * d, math.sin(a) * d
        h = rng.uniform(0.45, 0.7)
        m.plank_line((x, y, 0.0), (x, y, h), 0.035, 0.035, STEM)
        m.cyl(0.085, rng.uniform(0.3, 0.4), (x, y, h - 0.05), FIREWEED[k % 3], segs=5, r_top=0.015)
    m.build(root)

    # 1: buttercups, a spray of bright yellow
    root = _root("flowers_1")
    m = Model("flowers_1", seed=301)
    rng = random.Random(301)
    _tuft(m, rng, 0.25, 5)
    for k in range(10):
        a = rng.uniform(0, math.tau)
        d = rng.uniform(0.05, 0.38)
        x, y = math.cos(a) * d, math.sin(a) * d
        h = rng.uniform(0.22, 0.4)
        m.plank_line((x * 0.5, y * 0.5, 0.0), (x, y, h), 0.025, 0.025, STEM)
        m.ball(0.065, (x, y, h + 0.02), BUTTERCUP, subdiv=1, scale=(1, 1, 0.55))
    m.build(root)

    # 2: red and white campion, mixed
    root = _root("flowers_2")
    m = Model("flowers_2", seed=302)
    rng = random.Random(302)
    _tuft(m, rng, 0.25, 5)
    for k in range(9):
        a = rng.uniform(0, math.tau)
        d = rng.uniform(0.05, 0.36)
        x, y = math.cos(a) * d, math.sin(a) * d
        h = rng.uniform(0.3, 0.5)
        m.plank_line((x * 0.6, y * 0.6, 0.0), (x, y, h), 0.025, 0.025, STEM)
        m.cyl(0.08, 0.05, (x, y, h), CAMPION[k % 3], segs=5)
        m.cyl(0.025, 0.06, (x, y, h + 0.01), BUTTERCUP if k % 3 == 0 else "#f4efe6", segs=4)
    m.build(root)


def mushrooms():
    """Toadstools for the forest floor: fly agarics (red, white spots) and a cluster of ceps."""
    root = _root("mushroom_0")
    m = Model("mushroom_0", seed=320)
    for x, y, h, r in ((0.0, 0.0, 0.3, 0.17), (0.2, 0.1, 0.2, 0.12), (-0.12, 0.16, 0.14, 0.09)):
        m.cyl(r * 0.32, h, (x, y, 0), MUSH_STEM, segs=6, r_top=r * 0.25)
        m.cyl(r * 0.4, 0.03, (x, y, h * 0.7), MUSH_STEM, segs=6)                          # the ring
        m.ball(r, (x, y, h), AGARIC, subdiv=1, scale=(1, 1, 0.6))
        for k in range(5):
            a = k * math.tau / 5 + x * 7
            rr = r * (0.55 if k % 2 else 0.35)
            m.ball(r * 0.16, (x + math.cos(a) * rr, y + math.sin(a) * rr, h + r * 0.5), AGARIC_DOT, subdiv=1)
        m.ball(r * 0.16, (x, y, h + r * 0.6), AGARIC_DOT, subdiv=1)
    m.build(root)

    root = _root("mushroom_1")
    m = Model("mushroom_1", seed=321)
    for i, (x, y, h, r) in enumerate(((0.0, 0.0, 0.22, 0.16), (0.18, -0.08, 0.16, 0.12),
                                       (-0.14, 0.12, 0.12, 0.1), (0.06, 0.2, 0.08, 0.07))):
        m.cyl(r * 0.6, h, (x, y, 0), CEP_STEM, segs=6, r_top=r * 0.45)
        m.ball(r, (x, y, h), CEP[i % 2], subdiv=1, scale=(1, 1, 0.62))
    m.build(root)


def stump():
    """A mossy broken stump, splintered on one side, with a shelf fungus."""
    root = _root("stump", radius=0.5)
    m = Model("stump", seed=340)
    m.cyl(0.5, 0.55, (0, 0, 0), P.BARK, segs=7, r_top=0.42)
    m.cyl(0.36, 0.03, (0, 0, 0.55), HEARTWOOD, segs=7)
    for a, h in ((0.3, 0.72), (1.1, 0.64), (2.0, 0.7)):                                  # the splinters
        m.box((0.18, 0.1, h - 0.4), (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.4 + (h - 0.4) / 2), P.BARK,
              rot=(0, 0, a), taper=0.3)
    for k in range(4):                                                                  # root flare
        a = k * math.tau / 4 + 0.4
        m.plank_line((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.3), (math.cos(a) * 0.75, math.sin(a) * 0.75, -0.02),
                     0.2, 0.18, P.BARK)
    m.ball(0.3, (-0.25, -0.22, 0.3), MOSS[1], subdiv=1, scale=(1.1, 0.8, 1.0), jitter=0.04)
    m.ball(0.26, (-0.1, 0.05, 0.56), MOSS[2], subdiv=1, scale=(1.1, 1.1, 0.3), jitter=0.03)
    m.ball(0.2, (0.45, 0.3, 0.05), MOSS[0], subdiv=1, scale=(1.2, 1, 0.5), jitter=0.03)
    for z, r, c in ((0.38, 0.2, SHELF_FUNGUS[0]), (0.26, 0.14, SHELF_FUNGUS[1])):   # the shelf fungus
        m.ball(r, (0.2, -0.43, z), c, subdiv=1, scale=(1.2, 0.8, 0.28))
    m.build(root)


def trunk():
    """A mossy fallen trunk lying on the forest floor along +x, root plate at x = 0. 5 m long."""
    root = _root("trunk", length=5.0)
    m = Model("trunk", seed=360)
    rng = random.Random(360)
    m.cyl(0.45, 5.0, (0, 0, 0.4), P.BARK, segs=7, r_top=0.32, rot=(0, math.pi / 2, 0))
    m.cyl(0.28, 0.03, (5.0, 0, 0.4), HEARTWOOD, segs=7, rot=(0, math.pi / 2, 0))         # the sawn end
    m.cyl(1.05, 0.5, (-0.5, 0, 0.75), EARTH, segs=7, rot=(0, math.pi / 2, 0))           # the root plate
    m.ball(0.6, (-0.6, 0, 0.05), EARTH, subdiv=1, scale=(1.2, 1.6, 0.4), jitter=0.06)  # the hole it tore up
    for k in range(6):                                                                  # roots sticking out of it
        a = k * math.tau / 6 + 0.3
        m.plank_line((-0.2, math.cos(a) * 0.8, 0.7 + math.sin(a) * 0.8),
                     (-0.35, math.cos(a) * 1.25, max(0.7 + math.sin(a) * 1.25, 0.05)), 0.09, 0.09, P.BARK)
    for x, a in ((1.8, 0.8), (3.3, -1.0)):                                              # broken branch stubs
        m.plank_line((x, 0, 0.55), (x + 0.2, math.sin(a) * 0.6, 0.55 + abs(math.cos(a)) * 0.5), 0.1, 0.1, P.BARK)
    for x, l in ((1.0, 1.2), (2.6, 0.9), (4.0, 0.7)):                                   # moss along the top
        m.ball(0.3, (x, 0, 0.7), MOSS[int(x) % 3], subdiv=1, scale=(l * 1.5, 1.2, 0.35), jitter=0.04)
    for x in (1.4, 3.6):                                                                # a couple of ferns growing on it
        for k in range(5):
            a = k * math.tau / 5 + rng.uniform(0, 0.5)
            m.plank_line((x, 0, 0.72), (x + math.cos(a) * 0.45, math.sin(a) * 0.45, 1.0), 0.14, 0.03,
                         P.LEAF[2 + k % 2])
    m.build(root)


def driftwood():
    """A jam of bleached driftwood piled against the upstream tip of a river island: logs and
    branches criss-crossed, about 5 m across (x) and 3 m deep (y). The water comes from -y and
    the pile faces it; z = 0 is the waterline, the lowest logs are half under."""
    root = _root("driftwood", width=5.0, depth=3.0)
    m = Model("driftwood", seed=380)
    rng = random.Random(380)
    # the big logs, jammed across the current, the front ones low in the water
    big = [
        ((-2.5, -1.2, 0.0), (2.3, -0.9, 0.05), 0.28),
        ((-2.2, -0.2, 0.2), (2.5, 0.3, 0.1), 0.3),
        ((-1.8, 0.9, 0.25), (1.9, 1.3, 0.3), 0.26),
        ((-2.0, 1.4, 0.1), (-0.3, -1.4, 0.55), 0.22),            # diagonals, riding up over the rest
        ((0.6, -1.5, 0.45), (2.2, 1.4, 0.55), 0.24),
        ((-1.2, -0.8, 0.6), (1.4, 0.7, 0.75), 0.2),
    ]
    for k, (a, b, r) in enumerate(big):
        _pole(m, a, b, r, DRIFT[k % 4], r_end=r * 0.75, segs=6)
    m.ball(0.55, (-2.55, -1.2, 0.05), DRIFT[3], subdiv=1, scale=(0.6, 1, 1), jitter=0.12)   # a root wad
    m.ball(0.45, (2.55, 0.3, 0.15), DRIFT[1], subdiv=1, scale=(0.6, 1, 1), jitter=0.1)
    # branches and sticks poking every which way
    for _ in range(12):
        x, y = rng.uniform(-2.2, 2.2), rng.uniform(-1.3, 1.3)
        z = rng.uniform(0.2, 0.7)
        a = rng.uniform(0, math.tau)
        l = rng.uniform(0.7, 1.4)
        m.plank_line((x, y, z), (x + math.cos(a) * l, y + math.sin(a) * l, z + rng.uniform(-0.2, 0.5)),
                     0.08, 0.08, DRIFT[rng.randrange(4)])
    # the waterlogged underside, darker
    m.ball(1.0, (0, 0.1, -0.25), "#7a6e5e", subdiv=1, scale=(2.5, 1.4, 0.25), jitter=0.08)
    m.build(root)


def cairn():
    """A little stack of flat river stones, about 0.9 m tall."""
    root = _root("cairn")
    m = Model("cairn", seed=400)
    rng = random.Random(400)
    z = 0.0
    for k, (r, t) in enumerate(((0.34, 0.2), (0.29, 0.18), (0.25, 0.17), (0.21, 0.16), (0.16, 0.14), (0.11, 0.12))):
        c = (P.LIMESTONE + RIVER_ROCK)[(k * 3) % 7]
        m.ball(r, (rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), z + t / 2), c, subdiv=1,
               scale=(1.15, 0.95, t / (2 * r)), jitter=0.02, rot=(0, 0, rng.uniform(0, math.tau)))
        z += t * 0.95
    m.build(root)


def willow():
    """A weeping willow leaning out over the water (+x): a leaning trunk and a curtain of foliage
    dripping down towards the river. The foliage is the `crown`. About 7 m tall."""
    root = _root("willow", height=7.0)
    m = Model("willow_trunk", seed=420)
    m.cyl(0.55, 0.4, (0, 0, 0), P.BARK, segs=6, r_top=0.35)
    _pole(m, (0, 0, 0), (0.9, 0, 2.6), 0.38, P.BARK, r_end=0.3)
    _pole(m, (0.9, 0, 2.5), (2.0, 0.2, 4.3), 0.3, P.BARK, r_end=0.2)
    _pole(m, (0.9, 0, 2.5), (0.6, -0.8, 4.6), 0.2, P.BARK, r_end=0.12)
    _pole(m, (2.0, 0.2, 4.2), (3.4, 0.3, 5.0), 0.16, P.BARK, r_end=0.08)
    m.build(root)
    c = Model("crown", seed=421)
    rng = random.Random(421)
    cx, cz = 2.0, 5.8
    c.ball(2.1, (cx, 0, cz), WILLOW[0], subdiv=1, scale=(1.15, 1, 0.55), jitter=0.2)
    c.ball(1.3, (cx - 0.9, -0.3, cz + 0.5), WILLOW[1], subdiv=1, scale=(1, 1, 0.6), jitter=0.15)
    c.ball(1.3, (cx + 1.0, 0.4, cz + 0.3), WILLOW[1], subdiv=1, scale=(1, 1, 0.6), jitter=0.15)
    for k in range(14):                                                                  # the drooping curtain
        a = k * math.tau / 14 + rng.uniform(-0.1, 0.1)
        rx, ry = 2.3, 2.0
        x, y = cx + math.cos(a) * rx, math.sin(a) * ry
        drop = 3.2 + max(math.cos(a), 0) * 1.4 + rng.uniform(-0.4, 0.4)                # longest over the water
        c.cyl(0.5, drop, (x, y, cz + 0.2), WILLOW[k % 3], segs=5, r_top=0.12, rot=(math.pi, 0, rng.uniform(0, 1)))
    for k in range(5):                                                                  # inner strands
        a = k * math.tau / 5 + 0.3
        c.cyl(0.4, 2.6, (cx + math.cos(a) * 1.2, math.sin(a) * 1.1, cz), WILLOW[(k + 1) % 3], segs=5, r_top=0.1,
              rot=(math.pi, 0, 0))
    c.build(root)


def swing():
    """A big old broadleaf by a pool, one long branch reaching out along +x (4 m) with a rope
    swing hanging from its end: two ropes and a plank seat. The foliage is the `crown`."""
    root = _root("swing", reach=4.0)
    m = Model("swing_trunk", seed=440)
    m.cyl(0.75, 0.45, (0, 0, 0), P.BARK, segs=7, r_top=0.45)
    m.cyl(0.48, 3.4, (0, 0, 0), P.BARK, segs=7, r_top=0.36)
    _pole(m, (0.1, 0, 2.9), (2.2, 0, 3.55), 0.26, P.BARK, r_end=0.2)                    # the swing branch
    _pole(m, (2.1, 0, 3.55), (4.3, 0, 3.75), 0.2, P.BARK, r_end=0.13)
    _pole(m, (0, 0, 3.2), (-1.2, 0.6, 4.7), 0.22, P.BARK, r_end=0.12)
    _pole(m, (0, 0, 3.3), (0.6, -0.9, 4.9), 0.22, P.BARK, r_end=0.12)
    for k in range(4):                                                                  # roots
        a = k * math.tau / 4 + 0.5
        m.plank_line((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.4), (math.cos(a) * 1.0, math.sin(a) * 1.0, -0.05),
                     0.22, 0.2, P.BARK)
    for y in (-0.28, 0.28):                                                             # the rope and seat
        m.box((0.09, 0.09, 2.9), (4.0, y, 0.8 + 1.45 + 0.05), SWING_ROPE)
        m.box((0.16, 0.16, 0.16), (4.0, y, 3.72), SWING_ROPE)
    m.box((0.45, 0.9, 0.1), (4.0, 0, 0.8), P.WOOD_LIGHT)
    m.build(root)
    c = Model("crown", seed=441)
    rng = random.Random(441)
    c.ball(2.4, (0.1, 0, 5.3), P.LEAF[2], subdiv=1, jitter=0.25, scale=(1.1, 1, 0.8))
    for x, y, z, r in ((-1.5, 0.6, 5.0, 1.5), (1.4, -0.7, 5.6, 1.5), (0.0, 1.2, 6.3, 1.3), (2.4, 0.3, 4.9, 1.2),
                       (-0.6, -1.3, 4.6, 1.2)):
        c.ball(r, (x, y, z), P.LEAF[1 + rng.randrange(3)], subdiv=1, jitter=0.18)
    c.ball(0.75, (3.9, 0.0, 4.35), P.LEAF[3], subdiv=1, jitter=0.1, scale=(1.3, 1, 0.7))   # leaves on the branch end
    c.build(root)


def gravel():
    """A low gravel bar: pale pebbles and a couple of flat stones, peeking just out of the water.
    About 2 m (x) by 4 m (y); z = 0 is the waterline, the top about 0.12."""
    root = _root("gravel", width=2.0, length=4.0)
    m = Model("gravel", seed=460)
    rng = random.Random(460)
    m.ball(1.0, (0, 0, -0.02), P.GRAVEL[0], subdiv=1, scale=(1.0, 2.0, 0.08), jitter=0.02)
    m.ball(0.8, (0.15, 0.4, -0.02), P.GRAVEL[1], subdiv=1, scale=(0.8, 1.9, 0.09), jitter=0.02)
    for x, y, r in ((-0.3, -0.9, 0.36), (0.35, 1.1, 0.3)):                                # flat stones
        m.cyl(r, 0.1, (x, y, 0.0), P.LIMESTONE[0], segs=6, r_top=r * 0.85, rot=(0, 0, rng.uniform(0, 1)))
    cols = [P.LIMESTONE[1], P.LIMESTONE[2], P.PEBBLE, RIVER_ROCK[3], RIVER_ROCK[1]]
    for k in range(26):
        t = rng.uniform(-1, 1)
        y = t * 1.8
        w = 0.85 * math.sqrt(max(0.05, 1 - t * t))
        x = rng.uniform(-w, w)
        r = rng.uniform(0.07, 0.16)
        m.ball(r, (x, y, 0.1 - r * 0.45), cols[k % 5], subdiv=1, scale=(1.2, 1, 0.5), jitter=0.02)
    m.build(root)


# --- the animals ------------------------------------------------------------------------------

def kingfisher(root):
    """A kingfisher: a flash of blue along the river, orange underneath, a dagger of a bill."""
    b = Model("kingfisher_body")
    b.ball(0.07, (0, 0, 0), KINGFISHER, subdiv=1, scale=(1.5, 0.9, 0.9))
    b.ball(0.06, (0.0, 0, -0.03), P.ROBIN_BREAST, subdiv=1, scale=(1.3, 0.8, 0.6))
    b.ball(0.055, (0.1, 0, 0.04), KINGFISHER, subdiv=1)
    b.box((0.1, 0.02, 0.02), (0.18, 0, 0.035), P.INK)
    b.box((0.08, 0.04, 0.02), (-0.13, 0, 0.0), KINGFISHER_LIGHT)
    body = b.build(root)
    fauna._wings(body, "kingfisher", (0.0, 0.04, 0.03), 0.14, 0.08, KINGFISHER, tip=KINGFISHER_LIGHT)


def animals():
    """The island's animals, again, for the riverside: a heron fishing the shallows, a mallard
    family, deer drinking, sheep on the meadows, fish jumping, a kingfisher, Beike running the
    bank, and (now and then) the winged sheep overhead."""
    fauna.heron(_root("heron"))
    fauna.duck(_root("duck"))
    fauna.duckling(_root("duckling"))
    fauna.deer(_root("deer"))
    fauna.sheep(_root("sheep"))
    fauna.fish(_root("fish"))
    kingfisher(_root("kingfisher"))
    beike.beike(_root("beike"))
    characters.sheep(_root("wingedsheep"))


def kayak():
    """Vincent in his kayak: the same model as round the island (hull, head, paddle)."""
    characters.vincent_kayak(_root("kayak"))


def build():
    global _n
    _n = 0
    kayak()
    rocks()
    logs()
    buoys()
    ball()
    tape()
    lily()
    trees()
    bushes()
    reeds()
    ferns()
    boulders()
    bridge()
    sign()
    tent()
    cabin()
    animals()
    flowers()
    mushrooms()
    stump()
    trunk()
    driftwood()
    cairn()
    willow()
    swing()
    gravel()
