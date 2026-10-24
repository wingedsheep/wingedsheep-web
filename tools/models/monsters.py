"""Halloween's monsters (src/island/scene/monsters.ts), out only in the last week of October, and
only now and then after dark:

  horseman  the Headless Horseman: a black horse with red eyes, a rider in a cloak with nothing
            above the collar, a lit jack-o'-lantern held up in his right hand. Now and then he
            gallops a lap of the island, out from behind the mountain and back.
  tallone   something very tall from the eastern woods: legs like stilts, arms down to its knees,
            a pale bony face, and antlers of bare branches curling at the tips. It steps out
            behind the campfire, looks, and steps back.

And the ones that only turn up on some nights of the week (the runtime makes sure you meet one):

  ghostship a galleon black with rot, her sails in rags, green light in her stern windows and a
            lantern swinging off her taffrail, her captain at the wheel.
  witch     a witch on her broomstick, hat crooked, hair and cloak streaming, a black cat riding
            on the bristles and a little jack-o'-lantern swinging from the end of the handle.
  nazgul    a Nazgûl (The Lord of the Rings) on its fell beast: a rider in black, no face under
            the hood, on a great featherless thing with leathery wings, a long neck and a longer tail.
  grimm     the Grimm Troupe (Hollow Knight): a scarlet-and-black tent with its lantern lit, the
            Troupe Master in his cloak, and three of his little flames, the Grimmkin.

Templates like the wildlife (fauna.py merges ALL into its own): facing +x, y to their left, z = 0
the ground. The parts the runtime moves are their own objects, named `<species>_<part>`.
"""
from __future__ import annotations

import math
import random

import palette as P
from holidays import jack
from kit import Model
from sightings import _lathe, _limb as _taper

HORSE = "#1c1a22"
HORSE_SHEEN = "#34303e"
MANE = "#0e0c12"
EYE = "#ff3a2a"
CLOAK = "#14121a"
CLOAK_LINING = "#7a1420"
LEATHER = "#3a2a24"

GAUNT = "#4a4456"          # the tall one: its rags, and the bark of its limbs
GAUNT_LIGHT = "#6e6680"
BONE = "#d8d0bc"
BONE_DARK = "#a89e88"
GLARE = "#f4f8ff"


def _limb(m: Model, a, b, w, color):
    m.plank_line(a, b, w, w, color)


def _curl(m: Model, at, r0: float, turns: float, heading: float, width: float, color, start=0.0, step=0.4):
    """A spiral of short beams in the upright plane through `at`, facing `heading`."""
    pts = []
    n = int(turns * math.tau / step)
    for k in range(n + 1):
        a = start + k * step
        r = r0 * (1 - k / (n + 1) * 0.85)
        pts.append((at[0] + math.cos(a) * r * math.cos(heading), at[1] + math.cos(a) * r * math.sin(heading), at[2] + math.sin(a) * r))
    for a, b in zip(pts, pts[1:]):
        m.plank_line(a, b, width, width, color)


def horseman(root):
    b = Model("horseman_body", seed=13)
    # the horse: a deep barrel, a high neck, the head stretched out at the gallop
    b.box((1.5, 0.56, 0.62), (0, 0, 1.2), HORSE)
    b.box((0.5, 0.58, 0.66), (0.62, 0, 1.25), HORSE)                                    # chest
    b.box((0.5, 0.6, 0.62), (-0.6, 0, 1.24), HORSE)                                     # rump
    b.box((1.2, 0.02, 0.2), (0, 0.29, 1.32), HORSE_SHEEN)                               # the sheen along its flanks
    b.box((1.2, 0.02, 0.2), (0, -0.29, 1.32), HORSE_SHEEN)
    _limb(b, (0.75, 0, 1.4), (1.12, 0, 1.95), 0.32, HORSE)                              # neck
    b.box((0.62, 0.26, 0.28), (1.35, 0, 1.92), HORSE, rot=(0, 0.45, 0))                 # head, reaching
    b.box((0.2, 0.24, 0.2), (1.58, 0, 1.78), HORSE_SHEEN, rot=(0, 0.45, 0))             # muzzle
    for s in (-1, 1):
        b.box((0.06, 0.06, 0.16), (1.12, s * 0.09, 2.17), HORSE)                          # ears, back
        b.box((0.07, 0.03, 0.06), (1.32, s * 0.135, 1.98), EYE, glow=True)                # red eyes
    for k in range(6):                                                                    # the mane, streaming
        b.box((0.16, 0.08, 0.2), (1.0 - k * 0.07, 0.0, 2.05 - k * 0.11), MANE, rot=(0, -0.6, 0))
    b.box((0.5, 0.62, 0.08), (-0.1, 0, 1.54), LEATHER)                                  # the saddle
    # the rider: legs down its sides, a cloaked chest, a high collar with nothing in it
    for s in (-1, 1):
        _limb(b, (-0.05, s * 0.2, 1.62), (0.18, s * 0.34, 1.2), 0.16, CLOAK)
        b.box((0.24, 0.12, 0.12), (0.24, s * 0.34, 1.1), P.INK)                            # boots in the stirrups
    b.box((0.36, 0.46, 0.66), (-0.1, 0, 1.98), CLOAK, rot=(0, -0.15, 0), taper=0.85)
    b.box((0.08, 0.3, 0.5), (0.08, 0, 1.98), CLOAK_LINING, rot=(0, -0.15, 0))           # red showing at the front
    b.box((0.26, 0.4, 0.2), (-0.04, 0, 2.38), CLOAK)                                    # the collar, turned up…
    b.box((0.16, 0.26, 0.04), (-0.04, 0, 2.47), "#3a0c12")                              # …and the dark inside it
    _limb(b, (-0.05, 0.22, 2.2), (0.35, 0.18, 1.82), 0.13, CLOAK)                       # left arm, the reins
    _limb(b, (0.35, 0.18, 1.82), (0.95, 0.0, 1.95), 0.025, LEATHER)
    body = b.build(root)

    # its legs, from the shoulders and the hips, swinging at the gallop
    for name, x, y in (("fl", 0.62, 0.17), ("fr", 0.62, -0.17), ("bl", -0.58, 0.17), ("br", -0.58, -0.17)):
        g = Model(f"horseman_leg_{name}")
        _limb(g, (0, 0, 0), (0.02, 0, -0.5), 0.17, HORSE)
        _limb(g, (0.02, 0, -0.5), (0, 0, -0.95), 0.12, HORSE)
        g.box((0.16, 0.15, 0.1), (0.02, 0, -0.98), P.INK)                                 # hoof
        g.build(body, loc=(x, y, 1.0))
    t = Model("horseman_tail")
    for k in range(5):
        t.box((0.12, 0.1, 0.24), (-0.1 - k * 0.12, 0, -0.06 - k * 0.07), MANE, rot=(0, -0.5, 0))
    t.build(body, loc=(-0.85, 0, 1.38))
    c = Model("horseman_cape")                                                            # flying out behind him
    c.box((0.75, 0.5, 0.04), (-0.38, 0, 0), CLOAK, rot=(0, 0.25, 0))
    c.box((0.7, 0.46, 0.02), (-0.36, 0, -0.03), CLOAK_LINING, rot=(0, 0.25, 0))
    c.build(body, loc=(-0.2, 0, 2.3))
    a = Model("horseman_arm")                                                             # the right arm, the lantern held high
    _limb(a, (0, 0, 0), (0.25, -0.12, 0.42), 0.13, CLOAK)
    _limb(a, (0.25, -0.12, 0.42), (0.3, -0.1, 0.8), 0.11, CLOAK)
    a.box((0.1, 0.1, 0.1), (0.3, -0.1, 0.86), P.INK)                                      # a gloved fist
    arm = a.build(body, loc=(-0.04, -0.22, 2.22))
    j = Model("horseman_lantern")                                                         # lit, its carved face forwards
    jack(j, (0, 0, 0), 0.24, True, 0.4)
    j.build(arm, loc=(0.32, -0.1, 0.9), rot_z=math.pi / 2)


def tallone(root):
    b = Model("tallone_body", seed=9)
    # a narrow chest wrapped in rags, hunched forward, ribs showing through a tear
    b.box((0.55, 0.7, 2.3), (0.05, 0, 4.7), GAUNT, rot=(0, 0.12, 0), taper=0.7)
    for k in range(4):
        b.box((0.03, 0.42, 0.05), (0.33, 0, 4.9 - k * 0.18), BONE_DARK, rot=(0, 0.12, 0))
    for k in range(7):                                                                    # tatters hanging off it
        b.box((0.14, 0.04, 0.7 + (k % 3) * 0.25), (-0.2 + k * 0.08, (k % 2 - 0.5) * 0.7, 3.6), GAUNT, rot=(0.1 * (k % 2), 0, 0))
    _limb(b, (0.12, 0, 5.8), (0.32, 0, 6.25), 0.22, GAUNT_LIGHT)                         # a long neck, craned
    body = b.build(root)

    h = Model("tallone_head")                                                             # pivots at the top of the neck
    h.box((0.46, 0.4, 0.62), (0.08, 0, 0.18), BONE, rot=(0, 0.15, 0))                    # a long pale skull
    h.box((0.2, 0.3, 0.22), (0.27, 0, -0.1), BONE_DARK)                                   # the jaw
    for s in (-1, 1):
        h.box((0.04, 0.12, 0.14), (0.31, s * 0.1, 0.22), P.INK)                          # sockets…
        h.box((0.04, 0.09, 0.09), (0.335, s * 0.1, 0.22), GLARE, glow=True)              # …with a light in each
        _limb(h, (0.0, s * 0.15, 0.4), (-0.15, s * 0.45, 1.1), 0.08, GAUNT_LIGHT)       # antlers of bare branches
        _limb(h, (-0.15, s * 0.45, 1.1), (-0.05, s * 0.7, 1.6), 0.06, GAUNT_LIGHT)
        _limb(h, (-0.1, s * 0.4, 0.95), (-0.45, s * 0.75, 1.25), 0.05, GAUNT_LIGHT)
        _curl(h, (-0.05, s * 0.7, 1.75), 0.16, 1.4, math.pi / 2, 0.04, GAUNT_LIGHT, start=-math.pi / 2)
        _curl(h, (-0.45, s * 0.8, 1.38), 0.12, 1.3, math.pi / 2, 0.035, GAUNT_LIGHT, start=-math.pi / 2)
    for k in range(5):
        h.box((0.03, 0.03, 0.06), (0.37, -0.08 + k * 0.04, -0.2), BONE, rot=(0, 0, 0))      # teeth
    h.build(body, loc=(0.4, 0, 6.35))

    for s, side in ((1, "l"), (-1, "r")):
        a = Model(f"tallone_arm_{side}")                                                  # from the shoulder, down to its knees
        _limb(a, (0, 0, 0), (0.15, 0, -1.4), 0.14, GAUNT)
        arm = a.build(body, loc=(0.1, s * 0.42, 5.6))
        f = Model(f"tallone_forearm_{side}")                                              # from the elbow, dangling as it walks
        _limb(f, (0, 0, 0), (0.2, 0, -1.2), 0.11, GAUNT_LIGHT)
        for k in range(4):                                                                # long fingers
            _limb(f, (0.2, 0, -1.2), (0.27 + k * 0.04, (k - 1.5) * 0.06, -1.8 - (k % 2) * 0.1), 0.03, GAUNT_LIGHT)
        f.build(arm, loc=(0.15, 0, -1.4))
        g = Model(f"tallone_leg_{side}")                                                  # from the hip: stilts…
        _limb(g, (0, 0, 0), (0, 0, -1.7), 0.18, GAUNT)
        leg = g.build(body, loc=(0, s * 0.18, 3.48))
        n = Model(f"tallone_shin_{side}")                                                 # …a knot at the knee…
        n.ball(0.14, (0, 0, 0), GAUNT_LIGHT, subdiv=1)
        _limb(n, (0, 0, 0), (0, 0, -1.7), 0.13, GAUNT_LIGHT)
        shin = n.build(leg, loc=(0, 0, -1.7))
        t = Model(f"tallone_foot_{side}")                                                 # …and a long splayed foot, from the ankle
        t.box((0.4, 0.14, 0.08), (0.12, 0, -0.04), GAUNT)
        t.build(shin, loc=(0, 0, -1.7))


# --- now and then ----------------------------------------------------------------------------

ROT = "#1e2622"            # the ghost ship: her hull, black with rot…
ROT_LIGHT = "#2f3b34"
WEED = "#3c5a3a"           # …weed trailing at her waterline…
RAG = "#a9b8a6"            # …and sails gone grey-green, in tatters
RAG_SHADE = "#86978a"
SPECTRE = "#7dffb0"        # the light aboard her
CAPTAIN = "#b8c8bc"
BRACE = 0.65               # how far her yards are swung round from square

BROOM = "#7a5232"          # the witch
BRISTLE = "#c9a24f"
BRISTLE_DARK = "#a07c38"
ROBE = "#2a2036"
ROBE_LINING = "#5e2a6e"
GREEN_SKIN = "#9cc78a"
STOCKING = "#6a3b6e"
GREY_HAIR = "#cfcbd6"
HAT = "#1f1a28"
HAT_BAND = "#8a3a9a"
CAT_EYE = "#ffd84a"

FELL = "#2b2730"           # the fell beast: grey-black hide…
FELL_BELLY = "#4c4552"
MEMBRANE = "#3b3343"       # …and wings of bare skin
WRAITH = "#121016"         # its rider
WRAITH_STEEL = "#8a8a96"
WRAITH_EYES = "#cfe0ff"

SCARLET = "#c0202e"        # the Grimm Troupe
SCARLET_DARK = "#7a1020"
TROUPE = "#1a1418"
FLAME = "#ff3a3a"
GRIMM_CLOAK = "#2e2834"     # the Troupe Master: his cloak, a shade off black…
GRIMM_LINING = "#b02a44"   # …lined in red
MASK_GRIMM = "#d8ccd0"
MASK_SHADE = "#a99aa2"
GRIMM_CLOAK_EDGE = "#4a4050"
FLAME_CORE = "#ffb0a0"
SLATE = "#3e4258"          # Brumm, its accordionist
MASK = "#ece6dc"
BOA = "#b0405a"
BOA_DARK = "#8a2e48"
BAND = "#e4d8c0"
BAND_GREY = "#8a8c9a"
BELLOWS = "#d8b08a"
BELLOWS_DARK = "#b88e68"



def _sail(m: Model, x0: float, width: float, top: float, drop: float, rng, ragged=True):
    """A square sail gone to rags: strips hanging from the yard, each torn off at its own length,
    the odd one gone altogether. In the plane x = x0, `width` across y, hanging from z = top."""
    n = 6
    w = width / n
    for k in range(n):
        if ragged and rng.random() < 0.15:
            continue
        length = drop * (rng.uniform(0.45, 1.0) if ragged else 1.0)
        y = -width / 2 + w * (k + 0.5)
        m.box((0.04, w * 0.92, length), (x0 + 0.08 * math.sin(k / (n - 1) * math.pi), y, top - length / 2),
              RAG if k % 2 else RAG_SHADE)
        if ragged and rng.random() < 0.5:                                                   # a tongue torn further down
            m.box((0.035, w * 0.4, 0.25), (x0 + 0.05, y + w * 0.2, top - length - 0.1), RAG_SHADE, rot=(0.2, 0, 0))


def ghostship(root):
    m = Model("ghostship_body", seed=17)
    plan = [(-3.6, -0.85), (2.4, -0.85), (4.0, 0.0), (2.4, 0.85), (-3.6, 0.85), (-3.9, 0.0)]
    m.slab(plan, -0.4, 0.12, WEED)                                                        # weed at the waterline
    m.slab(plan, 0.12, 1.0, ROT, top=[(x * 1.03, y * 1.1) for x, y in plan])
    m.slab([(x * 1.0, y * 1.06) for x, y in plan], 1.0, 1.05, ROT_LIGHT)                 # the deck
    m.box((1.7, 1.8, 1.0), (-3.0, 0, 1.5), ROT)                                           # a high stern castle…
    m.box((1.72, 1.82, 0.06), (-3.0, 0, 2.02), ROT_LIGHT)
    m.box((0.7, 1.6, 0.55), (-3.55, 0, 2.3), ROT)                                         # …and the poop on top of it
    m.box((1.1, 1.55, 0.45), (2.7, 0, 1.25), ROT)                                         # the forecastle
    for i in range(4):                                                                    # stern windows, lit green
        m.box((0.06, 0.22, 0.24), (-3.9, -0.6 + i * 0.4, 1.55), SPECTRE, glow=True)
    for i in range(6):                                                                    # gunports, a couple lit from inside
        for s in (1, -1):
            lit = (i + (s > 0)) % 3 == 0
            m.box((0.2, 0.05, 0.16), (-2.0 + i * 0.75, s * 0.9, 0.62), SPECTRE if lit else "#0e1210", glow=lit)
    for (x, y, z, w, h) in [(-0.9, 0.93, 0.35, 0.5, 0.3), (1.4, -0.93, 0.42, 0.4, 0.25), (-2.4, -0.93, 0.25, 0.3, 0.3)]:
        m.box((w, 0.05, h), (x, y, z), "#0a0d0b")                                       # holes stove in her planking
    for s in (1, -1):                                                                     # a broken rail along each side
        m.plank_line((-2.2, s * 0.88, 1.32), (-0.6, s * 0.86, 1.3), 0.05, 0.05, ROT_LIGHT)
        m.plank_line((0.0, s * 0.86, 1.3), (1.2, s * 0.84, 1.25), 0.05, 0.05, ROT_LIGHT)
        m.plank_line((0.2, s * 0.86, 1.3), (0.5, s * 0.92, 1.05), 0.05, 0.05, ROT_LIGHT)  # snapped, hanging
    _limb(m, (3.6, 0, 1.15), (5.5, 0, 1.75), 0.08, ROT_LIGHT)                             # the bowsprit
    m.ball(0.2, (4.05, 0, 0.95), BONE, subdiv=1, scale=(1.2, 0.9, 1.1))                    # the figurehead: a skull
    for s in (1, -1):
        m.box((0.04, 0.07, 0.07), (4.25, s * 0.08, 1.0), SPECTRE, glow=True)
    _limb(m, (-3.75, 0, 2.55), (-3.75, 0, 3.1), 0.04, ROT_LIGHT)                           # the ensign staff…
    m.box((0.5, 0.03, 0.32), (-4.0, 0, 2.9), "#3a3a36")                                  # …and a rag of a flag
    m.cyl(0.03, 0.5, (-3.0, 0, 2.05), ROT_LIGHT, segs=4)                                 # the wheel's post…
    m.cyl(0.26, 0.04, (-2.85, 0, 2.5), ROT_LIGHT, segs=8, rot=(0, math.pi / 2, 0))       # …and the wheel
    rng = random.Random(1641)
    masts = ((2.0, 5.0), (-0.1, 5.8), (-2.2, 4.4))
    for k, (x, h) in enumerate(masts):
        top = h if k != 1 else h * 0.78                                                  # the main topmast's gone
        m.cyl(0.09, top, (x, 0, 1.0), ROT_LIGHT, segs=5, r_top=0.05)
        for s in (1, -1):                                                                 # the shrouds, down to her sides
            _limb(m, (x, 0, 1.0 + h * 0.7), (x - 0.25, s * 0.9, 1.1), 0.025, "#3a4a40")
    _limb(m, (-0.1, 0, 1.0 + 5.8 * 0.78), (-0.6, 0.3, 1.0 + 5.8 * 0.6), 0.05, ROT_LIGHT)   # what's left of it, hanging in its rigging
    _limb(m, (-4.0, 0, 2.55), (-4.35, 0, 2.6), 0.04, P.IRON)                                 # the lantern's bracket
    body = m.build(root)

    # each mast's yards and what's left of its sails, a part of their own (`ghostship_sail_<k>`),
    # braced round as if she had the wind on her quarter (she sails against it, all the same)
    for k, (x, h) in enumerate(masts):
        s = Model(f"ghostship_sail_{k}", seed=40 + k)
        base = h * 0.32
        for j, lv in enumerate((0.32, 0.56, 0.8)):
            if k == 1 and j == 2:
                continue                                                                  # (the topmast's gone)
            w = 2.6 - lv * 1.2
            tilt = rng.uniform(-0.1, 0.1) + (0.3 if (k, j) == (0, 2) else 0)             # yards hanging askew
            _limb(s, (0, -w / 2, h * lv - base - tilt * w / 2), (0, w / 2, h * lv - base + tilt * w / 2), 0.05, ROT_LIGHT)
        for j, (lo, hi) in enumerate(((0.32, 0.56), (0.56, 0.8))):
            if k == 1 and j == 1:
                continue
            _sail(s, 0.0, (2.6 - hi * 1.2) * 0.95, h * hi - base - 0.05, (hi - lo) * h * 0.92, rng)
        s.build(body, loc=(x + 0.06, 0, 1.0 + base), rot_z=BRACE)
    for k, (x, y, z, ln) in enumerate([(2.0, 0.85, 1.0 + 5.0 * 0.8, 1.4), (-0.1, -1.05, 1.0 + 5.8 * 0.56, 1.8), (-2.2, 0.85, 1.0 + 4.4 * 0.56, 1.2)]):
        r = Model(f"ghostship_rag_{k}")                                                    # long loose ones, streaming off the yardarms
        r.box((0.03, 0.14, ln), (0, 0, -ln / 2), RAG)
        r.box((0.03, 0.08, 0.3), (0, 0.03, -ln - 0.12), RAG_SHADE, rot=(0.3, 0, 0))
        r.build(body, loc=(x + 0.06 - math.sin(BRACE) * y, math.cos(BRACE) * y, z))
    lantern = Model("ghostship_lantern")                                                   # swinging off the taffrail
    lantern.plank_line((0, 0, 0), (0, 0, -0.25), 0.03, 0.03, P.IRON)
    lantern.box((0.2, 0.2, 0.28), (0, 0, -0.42), SPECTRE, glow=True)
    lantern.box((0.26, 0.26, 0.05), (0, 0, -0.27), P.IRON)
    lantern.box((0.24, 0.24, 0.04), (0, 0, -0.57), P.IRON)
    lantern.build(body, loc=(-4.3, 0, 2.55))
    c = Model("ghostship_captain")                                                         # at the wheel, as he always has been
    c.box((0.24, 0.34, 0.55), (0, 0, 0.55), CAPTAIN, taper=0.8)                          # a long coat…
    c.box((0.3, 0.42, 0.3), (0, 0, 0.18), CAPTAIN, taper=1.15)
    c.ball(0.12, (0.02, 0, 0.95), CAPTAIN, subdiv=1)
    for s in (1, -1):
        c.box((0.04, 0.03, 0.04), (0.13, s * 0.045, 0.97), SPECTRE, glow=True)          # two points of green for eyes
        _limb(c, (0.02, s * 0.17, 0.75), (0.25, s * 0.12, 0.55), 0.07, CAPTAIN)          # hands on the wheel
    c.cyl(0.24, 0.03, (0.02, 0, 1.03), "#4a5450", segs=10)                              # a wide hat
    c.cyl(0.11, 0.14, (0.02, 0, 1.05), "#4a5450", segs=8, r_top=0.09)
    c.build(body, loc=(-3.3, 0, 2.05))


def witch(root):
    b = Model("witch_body", seed=21)
    _limb(b, (-0.85, 0, -0.02), (0.15, 0, 0.0), 0.045, BROOM)                             # a crooked ash handle
    _limb(b, (0.15, 0, 0.0), (1.05, 0, 0.1), 0.04, BROOM)
    b.box((0.07, 0.07, 0.07), (1.06, 0, 0.11), P.WOOD_DARK)
    # her skirts, over the handle and down both sides
    b.box((0.42, 0.42, 0.18), (-0.08, 0, 0.12), ROBE, taper=0.8)
    for s in (1, -1):
        b.box((0.42, 0.05, 0.3), (-0.05, s * 0.2, -0.06), ROBE, rot=(s * 0.2, 0, 0))
    for s in (1, -1):                                                                     # her legs: knees forward, feet tucked back
        _limb(b, (-0.02, s * 0.13, 0.06), (0.24, s * 0.18, -0.1), 0.1, ROBE)
        for k in range(4):                                                                # stripy stockings
            t0, t1 = k / 4, (k + 1) / 4
            a = (0.24 - 0.12 * t0, s * (0.18 - 0.02 * t0), -0.1 - 0.32 * t0)
            c = (0.24 - 0.12 * t1, s * (0.18 - 0.02 * t1), -0.1 - 0.32 * t1)
            _limb(b, a, c, 0.065, STOCKING if k % 2 else P.INK)
        b.box((0.2, 0.08, 0.08), (0.17, s * 0.16, -0.46), P.INK)                          # pointed boots…
        b.box((0.08, 0.06, 0.06), (0.29, s * 0.16, -0.42), P.INK, rot=(0, -0.6, 0))       # …turned up at the toe
    b.box((0.3, 0.32, 0.5), (0.04, 0, 0.38), ROBE, rot=(0, 0.45, 0), taper=0.8)            # leaning into the wind
    for s in (1, -1):                                                                     # both hands on the handle
        _limb(b, (0.18, s * 0.15, 0.55), (0.42, s * 0.11, 0.3), 0.08, ROBE)
        _limb(b, (0.42, s * 0.11, 0.3), (0.56, s * 0.05, 0.08), 0.07, ROBE)
        b.box((0.08, 0.07, 0.08), (0.58, s * 0.04, 0.05), GREEN_SKIN)
    b.box((0.08, 0.1, 0.08), (0.24, 0, 0.62), GREEN_SKIN)                                 # neck
    body = b.build(root)

    br = Model("witch_bristles")                                                          # the besom, bound on with twine
    br.cyl(0.075, 0.62, (0, 0, 0), BRISTLE, segs=7, r_top=0.22, rot=(0, -math.pi / 2, 0))
    br.cyl(0.085, 0.07, (-0.06, 0, 0), "#6a3b2a", segs=7, rot=(0, -math.pi / 2, 0))
    for k in range(7):                                                                    # straws sticking out at the end
        a = k / 7 * math.tau
        br.plank_line((-0.55, math.cos(a) * 0.15, math.sin(a) * 0.15), (-0.75, math.cos(a) * 0.24, math.sin(a) * 0.22), 0.025, 0.025,
                      BRISTLE_DARK if k % 2 else BRISTLE)
    br.build(body, loc=(-0.85, 0, -0.02))

    cl = Model("witch_cloak")                                                             # streaming out behind her, from the shoulders
    cl.box((0.42, 0.36, 0.03), (-0.2, 0, 0), ROBE, rot=(0, -0.3, 0), taper=0.9)
    cl.box((0.4, 0.32, 0.02), (-0.2, 0, -0.025), ROBE_LINING, rot=(0, -0.3, 0))
    cloak = cl.build(body, loc=(0.06, 0, 0.58))
    ct = Model("witch_cloak_tail")
    ct.box((0.45, 0.38, 0.025), (-0.22, 0, 0), ROBE)
    ct.box((0.43, 0.34, 0.02), (-0.22, 0, -0.022), ROBE_LINING)
    for k in range(3):                                                                    # a ragged hem
        ct.box((0.1, 0.1, 0.025), (-0.48, -0.12 + k * 0.12, 0), ROBE, rot=(0, 0, 0.3 * (k - 1)))
    ct.build(cloak, loc=(-0.39, 0, -0.12))

    h = Model("witch_head")                                                               # turns to look about (and at you)
    h.box((0.22, 0.2, 0.24), (0.04, 0, 0.1), GREEN_SKIN)
    h.plank_line((0.14, 0, 0.1), (0.29, 0, 0.03), 0.05, 0.05, GREEN_SKIN)                 # a long nose…
    h.ball(0.025, (0.22, 0.02, 0.07), "#6a9a5a", subdiv=1)                                # …with a wart on it
    h.box((0.07, 0.1, 0.07), (0.15, 0, -0.03), GREEN_SKIN, rot=(0, -0.5, 0))               # and a chin to meet it
    for s in (1, -1):
        h.box((0.03, 0.04, 0.04), (0.155, s * 0.05, 0.14), P.INK)
    h.box((0.03, 0.08, 0.02), (0.155, 0, 0.03), "#3a2030")                                # a grin, gappy
    h.cyl(0.26, 0.03, (0.0, 0, 0.21), HAT, segs=12)                                       # her hat: the brim…
    h.cyl(0.135, 0.05, (-0.01, 0, 0.23), HAT_BAND, segs=8, r_top=0.13)
    h.cyl(0.13, 0.3, (-0.01, 0, 0.23), HAT, segs=8, r_top=0.06, rot=(0, -0.3, 0))        # …and the crown, leaning back
    head = h.build(body, loc=(0.25, 0, 0.66))
    t = Model("witch_hat_tip")                                                            # bent over at the top, bobbing
    t.cyl(0.06, 0.24, (0, 0, 0), HAT, segs=6, r_top=0.005, rot=(0, -1.0, 0))
    t.build(head, loc=(-0.1, 0, 0.51))
    hr = Model("witch_hair")                                                              # grey and wild, blowing back
    for k in range(6):
        y = -0.09 + k * 0.036
        hr.plank_line((0, y, 0), (-0.32 - 0.08 * (k % 3), y * 1.6, -0.12 - 0.05 * (k % 2)), 0.045, 0.03, GREY_HAIR)
    hr.build(head, loc=(-0.07, 0, 0.08))

    cat = Model("witch_cat")                                                              # riding on the back, crouched against the wind
    cat.ball(0.1, (0, 0, 0.1), P.CAT, subdiv=1, scale=(1.4, 0.9, 0.9))
    cat.ball(0.075, (0.13, 0, 0.18), P.CAT, subdiv=1)
    for s in (1, -1):
        cat.prism([(0, 0), (0.03, 0.08), (0.06, 0)], 0.02, (0.1, s * 0.045, 0.23), P.CAT)
        cat.box((0.02, 0.025, 0.02), (0.2, s * 0.03, 0.19), CAT_EYE, glow=True)
        for x in (0.07, -0.08):
            cat.box((0.04, 0.04, 0.07), (x, s * 0.05, 0.03), P.CAT)
    kitty = cat.build(body, loc=(-0.55, 0, 0.04))
    ct = Model("witch_cat_tail")
    for k in range(4):                                                                    # straight up, curling over at the top
        a = k * 0.45
        ct.plank_line((-math.sin(a) * 0.06 * k, 0, math.cos(a) * 0.06 * k), (-math.sin(a + 0.45) * 0.06 * (k + 1), 0, math.cos(a + 0.45) * 0.06 * (k + 1)), 0.035, 0.035, P.CAT)
    ct.build(kitty, loc=(-0.13, 0, 0.13))

    ln = Model("witch_lantern")                                                           # a little pumpkin, swinging off the front
    ln.plank_line((0, 0, 0), (0, 0, -0.16), 0.015, 0.015, P.INK)
    lantern = ln.build(body, loc=(0.98, 0, 0.08))
    j = Model("witch_jack")
    jack(j, (0, 0, 0), 0.09, True, 0.2)
    j.build(lantern, loc=(0, 0, -0.29), rot_z=math.pi / 2)



def nazgul(root):
    b = Model("nazgul_body", seed=33)
    b.ball(0.55, (0, 0, 0), FELL, subdiv=2, scale=(1.9, 0.85, 0.8))                       # a long lean body
    b.ball(0.45, (0.55, 0, -0.12), FELL_BELLY, subdiv=1, scale=(1.2, 0.8, 0.8))           # the chest, paler underneath
    for s in (1, -1):                                                                     # hind legs, trailing, talons curled
        _limb(b, (-0.5, s * 0.3, -0.25), (-0.95, s * 0.32, -0.7), 0.16, FELL)
        _limb(b, (-0.95, s * 0.32, -0.7), (-1.35, s * 0.3, -0.8), 0.11, FELL)
        for k in (-1, 0, 1):
            _limb(b, (-1.35, s * 0.3, -0.8), (-1.55, s * 0.3 + k * 0.08, -0.95), 0.04, BONE_DARK)
    # its rider, astride at the shoulders: a black cloak with nobody in it, a crown on the hood
    b.box((0.45, 0.5, 0.75), (0.3, 0, 0.82), WRAITH, rot=(0, 0.25, 0), taper=0.7)
    for s in (1, -1):
        _limb(b, (0.3, s * 0.22, 0.55), (0.62, s * 0.42, 0.18), 0.12, WRAITH)
        _limb(b, (0.42, s * 0.22, 1.05), (0.82, s * 0.15, 0.78), 0.09, WRAITH)              # arms out to the reins…
        _limb(b, (0.82, s * 0.15, 0.78), (1.35, s * 0.08, 0.45), 0.02, P.INK)              # …and the reins
    b.ball(0.2, (0.45, 0, 1.32), WRAITH, subdiv=1, scale=(1.1, 1.0, 1.25))
    b.box((0.06, 0.18, 0.22), (0.64, 0, 1.28), "#050407")                                 # nothing under the hood…
    for s in (1, -1):
        b.box((0.02, 0.03, 0.025), (0.665, s * 0.045, 1.3), WRAITH_EYES, glow=True)       # …but two cold points of light
    for k in range(7):                                                                    # a crown of steel spikes
        a = k / 7 * math.tau
        b.box((0.03, 0.03, 0.12), (0.45 + math.cos(a) * 0.17, math.sin(a) * 0.17, 1.52), WRAITH_STEEL)
    _limb(b, (0.2, -0.28, 0.75), (-0.3, -0.36, 0.35), 0.035, WRAITH_STEEL)                # a sword at his side
    body = b.build(root)

    n = Model("nazgul_neck")                                                              # a long snaking neck…
    _limb(n, (0, 0, 0), (0.6, 0, 0.32), 0.32, FELL)
    _limb(n, (0.6, 0, 0.32), (1.2, 0, 0.5), 0.24, FELL)
    neck = n.build(body, loc=(0.95, 0, 0.1))
    h = Model("nazgul_head")                                                              # …a narrow skull, a hooked beak
    h.box((0.5, 0.24, 0.24), (0.2, 0, 0.0), FELL, rot=(0, 0.15, 0))
    h.box((0.35, 0.16, 0.12), (0.58, 0, -0.02), BONE_DARK, rot=(0, 0.3, 0), taper=0.6)
    h.box((0.08, 0.1, 0.12), (0.76, 0, -0.1), BONE_DARK, rot=(0, 0.6, 0))
    for s in (1, -1):
        h.box((0.04, 0.03, 0.03), (0.38, s * 0.12, 0.07), "#d04020", glow=True)
        _limb(h, (0.05, s * 0.06, 0.1), (-0.3, s * 0.12, 0.28), 0.05, FELL)              # spines back off the skull
    head = h.build(neck, loc=(1.22, 0, 0.5))
    j = Model("nazgul_jaw")                                                               # it opens to scream
    j.box((0.42, 0.14, 0.07), (0.21, 0, -0.03), BONE_DARK, taper=0.6)
    j.build(head, loc=(0.18, 0, -0.1))

    for s, side in ((1, "l"), (-1, "r")):                                                 # the wings: an arm and a hand of long fingers
        w = Model(f"nazgul_wing_{side}")
        _limb(w, (0, 0, 0), (0.2, s * 1.9, 0.1), 0.12, FELL)
        pts = [(0.15, 0), (0.25, 1.9), (-0.45, 1.85), (-0.9, 0.9), (-0.7, 0)]
        w.slab([(x, s * y) for x, y in (pts if s > 0 else pts[::-1])], -0.015, 0.015, MEMBRANE)
        wing = w.build(body, loc=(0.35, s * 0.35, 0.3))
        t = Model(f"nazgul_wingtip_{side}")
        for fx, fy in ((-0.1, 2.0), (-0.75, 1.75), (-1.05, 1.0)):
            _limb(t, (0, 0, 0), (fx, s * fy, -0.05), 0.06, FELL)
        pts = [(0.05, 0), (-0.1, 2.0), (-0.55, 1.5), (-0.75, 1.75), (-0.85, 1.1), (-1.05, 1.0), (-0.65, 0)]
        t.slab([(x, s * y) for x, y in (pts if s > 0 else pts[::-1])], -0.06, -0.035, MEMBRANE)
        t.build(wing, loc=(0.2, s * 1.9, 0.1))
    t = Model("nazgul_tail")                                                              # a long tail, ending in a barb
    _limb(t, (0, 0, 0), (-1.0, 0, -0.05), 0.2, FELL)
    tail = t.build(body, loc=(-0.95, 0, 0.05))
    t2 = Model("nazgul_tail_2")
    _limb(t2, (0, 0, 0), (-1.1, 0, 0.0), 0.11, FELL)
    t2.prism([(-1.0, 0), (-1.5, 0.0), (-1.2, 0.0)], 0.3, (0, 0, 0), FELL)
    t2.slab([(-1.0, 0.0), (-1.3, -0.18), (-1.55, 0.0), (-1.3, 0.18)], -0.02, 0.02, MEMBRANE)
    t2.build(tail, loc=(-1.0, 0, -0.05))
    c = Model("nazgul_cloak")                                                             # his cloak, streaming out behind him
    c.box((0.8, 0.45, 0.03), (-0.4, 0, 0), WRAITH, rot=(0, -0.2, 0), taper=1.0)
    for k in range(4):
        c.box((0.25, 0.09, 0.025), (-0.88, -0.17 + k * 0.11, -0.1 - (k % 2) * 0.03), WRAITH, rot=(0, -0.2, 0))
    c.build(body, loc=(0.25, 0, 1.18))


def grimm(root):
    """The troupe's tent at the template's middle, its door to +x; the Troupe Master in front of
    it; Brumm with his accordion on the other side of the door; the lantern; three Grimmkin."""
    t = Model("grimm_tent", seed=44)
    _lathe(t, [(0.05, 3.7), (0.75, 2.9), (1.6, 2.05), (1.95, 1.75), (1.85, 0.0)], [SCARLET, TROUPE], segs=14)
    for k in range(14):                                                                   # a scalloped valance
        a = (k + 0.5) / 14 * math.tau
        t.box((0.18, 0.75, 0.28), (math.cos(a) * 1.97, math.sin(a) * 1.97, 1.62), TROUPE if k % 2 else SCARLET, rot=(0, 0, a))
    t.box((0.1, 0.8, 1.45), (1.83, 0, 0.72), "#0e0608")                                   # the door, open…
    t.box((0.06, 0.6, 1.1), (1.8, 0, 0.6), "#5a0a14", glow=True)                          # …and red inside
    for s in (1, -1):                                                                     # the flaps tied back
        t.prism([(0, 0), (0.0, 1.5), (0.4, 0.0)], 0.05, (1.86, s * 0.45, 0), SCARLET, rot=(0, 0, s * 0.5))
    t.cyl(0.05, 0.75, (0, 0, 3.6), TROUPE, segs=5)
    tent = t.build(root)
    f = Model("grimm_flag")                                                               # a forked pennant at the top
    f.prism([(0, 0), (-0.9, 0.12), (-0.6, 0.0), (-0.9, -0.12)], 0.02, (0, 0, 0), SCARLET, rot=(math.pi / 2, 0, 0))
    f.prism([(0, 0.0), (-0.9, 0.0), (-0.6, -0.12)], 0.03, (0, 0, 0.1), SCARLET, rot=(0, 0, 0))
    f.build(tent, loc=(0, 0, 4.2))
    tent.scale = (0.62,) * 3                                                              # a small one: there's not much room on the island

    ln = Model("grimm_lantern")                                                           # the Nightmare Lantern, lit
    ln.cyl(0.07, 1.9, (0, 0, 0), P.IRON, segs=5)
    curl_ = [(0, 0, 1.9), (0.15, 0, 2.1), (0.4, 0, 2.15), (0.55, 0, 2.0)]
    for a, b in zip(curl_, curl_[1:]):
        ln.plank_line(a, b, 0.06, 0.06, P.IRON)
    for dx, dy in ((-0.17, -0.17), (0.17, -0.17), (-0.17, 0.17), (0.17, 0.17)):
        ln.plank_line((0.55 + dx, dy, 1.25), (0.55 + dx * 0.6, dy * 0.6, 1.95), 0.04, 0.04, P.IRON)
    ln.box((0.42, 0.42, 0.06), (0.55, 0, 1.25), P.IRON)
    ln.cyl(0.25, 0.25, (0.55, 0, 1.95), P.IRON, segs=6, r_top=0.03)
    lantern = ln.build(root, loc=(1.15, -1.75, 0))
    fl = Model("grimm_lantern_flame")
    fl.cyl(0.14, 0.4, (0, 0, 0), FLAME, segs=6, r_top=0.0, glow=True)
    fl.cyl(0.07, 0.25, (0, 0, 0.02), FLAME_CORE, segs=5, r_top=0.0, glow=True)
    fl.build(lantern, loc=(0.55, 0, 1.3))

    m = Model("grimm_master")                                                             # legs like needles, down to a point
    for s in (1, -1):
        _taper(m, (0, s * 0.06, 1.0), (0.02, s * 0.08, 0.45), 0.055, 0.035, TROUPE)
        _taper(m, (0.02, s * 0.08, 0.45), (0.06, s * 0.1, 0.0), 0.035, 0.0, TROUPE)
    master = m.build(root, loc=(1.95, 0.7, 0))
    o = Model("grimm_torso")                                                              # from the hips: a cloak wrapped tight round a waist…
    _lathe(o, [(0.04, 0.98), (0.2, 0.86), (0.17, 0.62), (0.09, 0.32), (0.12, 0.1), (0.16, -0.05)], [TROUPE, GRIMM_CLOAK], segs=8)
    for k in range(11):                                                                   # …and a high collar of spikes, flaring out wide round the head
        a = math.pi * 0.38 + k / 10 * math.pi * 1.24                                      # round the back and sides, open at the front
        rise = 0.42 + 0.14 * math.cos((k - 5) / 5 * math.pi / 2)
        reach = 0.5 + 0.12 * (k % 2)
        base = (math.cos(a) * 0.12, math.sin(a) * 0.16, 0.8)
        mid = (math.cos(a) * reach * 0.5, math.sin(a) * reach * 0.6, 0.8 + rise * 0.45)
        tip = (math.cos(a) * reach * 0.8, math.sin(a) * reach * 1.15, 0.8 + rise)
        col = TROUPE if k % 2 else GRIMM_LINING                                           # red showing between the black
        _taper(o, base, mid, 0.07, 0.045, col, segs=4)
        _taper(o, mid, tip, 0.045, 0.0, col, segs=4)
    for k in range(7):                                                                    # an inner row, shorter, all lining
        a = math.pi * 0.5 + k / 6 * math.pi
        base = (math.cos(a) * 0.1, math.sin(a) * 0.13, 0.82)
        tip = (math.cos(a) * 0.3, math.sin(a) * 0.42, 1.12 + 0.06 * (k % 2))
        _taper(o, base, tip, 0.05, 0.0, GRIMM_LINING, segs=4)
    for k, (z0, z1, turn) in enumerate(((0.82, 0.3, 1.0), (0.7, 0.12, -1.0), (0.55, -0.02, 1.0))):
        for j in range(6):                                                                # the cloak wound round him, in bands that cross
            t0, t1 = j / 6, (j + 1) / 6
            r0, r1 = (0.2 - 0.09 * math.sin(t * math.pi) for t in (t0, t1))
            a0, a1 = (turn * (t * math.pi * 1.1 - 0.6) for t in (t0, t1))
            za, zb = z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1
            _taper(o, (math.cos(a0) * r0, math.sin(a0) * r0, za), (math.cos(a1) * r1, math.sin(a1) * r1, zb), 0.035, 0.035,
                   GRIMM_CLOAK_EDGE if k % 2 else TROUPE, segs=4)
    o.box((0.03, 0.04, 0.6), (0.17, 0, 0.5), GRIMM_LINING, taper=0.4)                    # a red seam down his front
    torso = o.build(master, loc=(0, 0, 1.0))
    h = Model("grimm_head")                                                               # a black head like a flame…
    h.ball(0.19, (0, 0, 0.18), TROUPE, subdiv=2, scale=(0.7, 1.0, 1.2))
    for a, b_, r0, r1 in (((-0.03, 0, 0.28), (-0.15, 0, 0.5), 0.11, 0.075),              # …its crest curling up, back, and over at the tip
                          ((-0.15, 0, 0.5), (-0.24, 0, 0.7), 0.075, 0.045),
                          ((-0.24, 0, 0.7), (-0.13, 0, 0.85), 0.045, 0.0)):
        _taper(h, a, b_, r0, r1, TROUPE, segs=6)
    _taper(h, (0.0, -0.08, 0.32), (-0.02, -0.21, 0.5), 0.06, 0.0, TROUPE, segs=5)        # and a little flick off to one side
    mask = [(-0.15, 0.3), (-0.035, 0.3), (0.0, 0.19), (0.035, 0.3), (0.15, 0.3),           # a pale mask like a shield, the black coming down
            (0.135, 0.12), (0.06, -0.02), (0.0, -0.07), (-0.06, -0.02), (-0.135, 0.12)]   # into it in a point between the eyes
    h.prism(mask, 0.04, (0.12, 0, 0.0), MASK_GRIMM, rot=(0, 0, math.pi / 2), glow=True)  # pale even in his own red light
    shade = [(0.0, 0.19), (0.035, 0.3), (0.15, 0.3), (0.135, 0.12), (0.06, -0.02), (0.0, -0.07)]
    h.prism([(-y, z) for y, z in shade[::-1]], 0.01, (0.142, 0, 0.0), MASK_SHADE, rot=(0, 0, math.pi / 2), glow=True)  # one cheek in shadow
    eye = [(0.025, 0.15), (0.075, 0.1), (0.13, 0.15), (0.135, 0.27), (0.08, 0.24)]
    rim = [(0.012, 0.15), (0.07, 0.085), (0.145, 0.14), (0.15, 0.29), (0.075, 0.26)]
    for s in (1, -1):                                                                     # great red eyes, slanting up and out, ringed in black
        h.prism([(-s * y, z) for y, z in (rim if s < 0 else rim[::-1])], 0.01, (0.15, 0, 0.0), P.INK, rot=(0, 0, math.pi / 2))
        h.prism([(-s * y, z) for y, z in (eye if s < 0 else eye[::-1])], 0.01, (0.158, 0, 0.0), FLAME, rot=(0, 0, math.pi / 2), glow=True)
    h.build(torso, loc=(0.02, 0, 1.0))
    for s, side in ((1, "l"), (-1, "r")):
        a_ = Model(f"grimm_arm_{side}")                                                   # his arms: long sweeps of cloak, red underneath
        _taper(a_, (0, 0, 0), (0.08, s * 0.16, -0.45), 0.08, 0.06, GRIMM_CLOAK, segs=5)
        _taper(a_, (0.08, s * 0.16, -0.45), (0.14, s * 0.3, -1.0), 0.06, 0.0, GRIMM_CLOAK, segs=5)
        _taper(a_, (-0.02, s * 0.02, -0.1), (0.1, s * 0.24, -0.85), 0.04, 0.0, GRIMM_LINING, segs=4)
        a_.build(torso, loc=(0, s * 0.19, 0.82))
    c = Model("grimm_cape")                                                               # the cloak below the waist: long twisting strands
    for k in range(14):
        a = k / 14 * math.tau
        ln = 0.62 + 0.18 * math.sin(k * 2.3)
        out = 0.34 + 0.08 * math.cos(k * 1.7)
        twist = 0.35
        mid = (math.cos(a + twist * 0.5) * out * 0.65, math.sin(a + twist * 0.5) * out * 0.65, -ln * 0.5)
        tip = (math.cos(a + twist) * out, math.sin(a + twist) * out, -ln)
        col = (GRIMM_CLOAK, TROUPE, GRIMM_LINING)[k % 3]
        _taper(c, (math.cos(a) * 0.1, math.sin(a) * 0.1, 0.25), mid, 0.075, 0.05, col, segs=4)
        _taper(c, mid, tip, 0.05, 0.0, col, segs=4)
    for k in range(9):                                                                    # and under them, shorter, the lining
        a = (k + 0.5) / 9 * math.tau
        tip = (math.cos(a + 0.2) * 0.26, math.sin(a + 0.2) * 0.26, -0.45 - 0.08 * (k % 2))
        _taper(c, (math.cos(a) * 0.08, math.sin(a) * 0.08, 0.2), tip, 0.05, 0.0, GRIMM_LINING, segs=4)
    c.build(torso, loc=(0, 0, 0.25))

    br = Model("grimm_brumm")                                                             # Brumm: bandy hooked legs, a round body…
    for s in (1, -1):
        _limb(br, (0, s * 0.1, 0.5), (0.04, s * 0.2, 0.2), 0.08, SLATE)
        _limb(br, (0.04, s * 0.2, 0.2), (0.0, s * 0.24, 0.0), 0.07, SLATE)
        _limb(br, (0.0, s * 0.24, 0.0), (0.12, s * 0.28, 0.06), 0.05, SLATE)
    br.ball(0.3, (0, 0, 0.75), SLATE, subdiv=2, scale=(0.85, 1.0, 1.05))
    for k in range(12):                                                                   # …a feather boa…
        a = k / 12 * math.tau
        br.ball(0.11, (math.cos(a) * 0.24, math.sin(a) * 0.3, 1.0 + 0.03 * math.sin(k * 2.1)), BOA if k % 2 else BOA_DARK, subdiv=1, jitter=0.02)
    brumm = br.build(root, loc=(1.75, -0.8, 0))
    bh = Model("grimm_brumm_head")                                                        # …a hood with ears, a pale mask with a seam down it
    bh.ball(0.2, (0, 0, 0.14), SLATE, subdiv=1, scale=(0.95, 1.0, 1.3))
    for s in (1, -1):
        bh.prism([(-0.06, 0), (0.06, 0), (0.0, 0.16)], 0.05, (0.0, s * 0.12, 0.36), SLATE, rot=(-s * 0.3, 0, math.pi / 2))
    bh.box((0.05, 0.22, 0.3), (0.17, 0, 0.1), "#cdc8be", taper=0.6, glow=True)
    bh.box((0.02, 0.015, 0.26), (0.195, 0, 0.1), P.INK)
    for s in (1, -1):
        bh.box((0.02, 0.04, 0.06), (0.195, s * 0.05, 0.06), P.INK)
    bh.build(brumm, loc=(0.04, 0, 1.1))
    for s, side in ((1, "l"), (-1, "r")):                                                 # big banded arms, out round the accordion
        ba = Model(f"grimm_brumm_arm_{side}")
        for k in range(4):
            t0 = k / 4
            ba.ball(0.1, (0.1 * t0 + 0.18 * t0 * t0, s * (0.06 * t0), -0.12 * k), BAND if k % 2 == 0 else BAND_GREY, subdiv=1, scale=(1, 1, 0.8))
        for c_ in (-1, 0, 1):
            _limb(ba, (0.28, s * 0.0, -0.42), (0.34, s * (0.0 + c_ * 0.04), -0.5), 0.025, P.INK)   # claws
        ba.build(brumm, loc=(0.05, s * 0.34, 0.95))
    bw = Model("grimm_brumm_bellows")                                                     # the accordion: it squeezes in and out as he plays
    for k in range(5):
        bw.cyl(0.17, 0.11, (0, -0.28 + k * 0.12, 0), BELLOWS if k % 2 == 0 else BELLOWS_DARK, segs=8, rot=(-math.pi / 2, 0, 0))
    for s in (1, -1):
        bw.box((0.3, 0.04, 0.34), (0, s * 0.34, 0), BELLOWS_DARK)
        for k in range(3):
            bw.box((0.04, 0.02, 0.04), (0.06 - k * 0.06, s * 0.365, 0.1), MASK)          # its buttons
    bw.build(brumm, loc=(0.32, 0, 0.55))

    for k in range(3):                                                                    # the Grimmkin: little red flames, each with a pale face
        g = Model(f"grimm_kin_{k}")
        g.ball(0.17, (0, 0, 0), "#e0405a", subdiv=2, scale=(1, 1, 1.05), glow=True)
        g.box((0.04, 0.2, 0.16), (0.14, 0, 0.0), "#f2dde2")
        for s in (1, -1):
            g.box((0.02, 0.025, 0.09), (0.165, s * 0.045, 0.0), P.INK)                    # slit eyes
        a = k / 3 * math.tau
        kin = g.build(root, loc=(math.cos(a) * 2.0, math.sin(a) * 2.0, 1.3))
        fl = Model(f"grimm_kin_{k}_flame")                                                # drawing up to a flickering point
        fl.cyl(0.15, 0.36, (0, 0, 0), "#e0405a", segs=7, r_top=0.0, glow=True, rot=(0, -0.35, 0))
        fl.build(kin, loc=(0, 0, 0.08))

ALL = {
    "horseman": (horseman, 1.0),
    "tallone": (tallone, 1.0),
    "ghostship": (ghostship, 1.0),
    "witch": (witch, 1.3),
    "nazgul": (nazgul, 1.0),
    "grimm": (grimm, 1.0),
}
