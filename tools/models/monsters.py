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
  werewolf  out of the oak wood behind the library, on the nights the moon is up for it: shaggy and
            hunched, yellow eyes, what's left of his jeans and a rag of checked shirt. Unlike the
            others it's animated in Blender: its clips (`werewolf_lope`, `_prowl`, `_sniff`,
            `_howl`, `_snarl`, `_shake`) are baked here and played by the runtime.

Templates like the wildlife (fauna.py merges ALL into its own): facing +x, y to their left, z = 0
the ground. The parts the runtime moves are their own objects, named `<species>_<part>`.
"""
from __future__ import annotations

import math
import random

import palette as P
from holidays import jack
from kit import Model, animate
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

# --- the werewolf ----------------------------------------------------------------------------

WOLF = "#6a6266"           # the werewolf: shaggy and grey, to catch the moon…
WOLF_DARK = "#433b40"      # …darker down its back and on its paws…
WOLF_LIGHT = "#968c8c"     # …paler on its muzzle and belly
WOLF_PALE = "#c4b8ac"
WOLF_EYE = "#ffd23a"
CLAW = "#e8dfc8"
GUMS = "#8a2a34"
MOUTH = "#3a1418"
JEANS = "#3e4c66"          # what's left of his clothes
JEANS_PALE = "#62729a"
CHECK = "#9a3030"

# Its bones, in metres. Every limb part is built hanging straight down from its joint, so a part's
# pitch is just the angle it swings away from straight down (forwards is a negative rotation).
W_THIGH, W_SHIN, W_META = 0.44, 0.46, 0.30
W_ARM, W_FORE, W_HAND = 0.46, 0.44, 0.15
W_WAIST = (0.32, 0.06)      # the chest's pivot, in the pelvis's frame (forward, up)
W_SHOULDER = (0.50, -0.06)  # the shoulders, in the chest's
W_NECK = (0.80, 0.30)       # the head's pivot, in the chest's
W_PAW = 0.05                # the ankle's and the wrist's height off the ground with the paw flat
W_HIP = 0.95                # the hips' height on all fours
# How fast it goes in each of its gaits (the runtime moves it at just this speed, so its paws
# stay planted), and how long a stride takes.
W_PROWL = (0.85, 1.4)
W_LOPE = (5.0, 0.6)


def _yrot(p, r):
    """(forward, up) turned by a pitch of r, as Blender's rotation about y turns it."""
    x, z = p
    return (x * math.cos(r) + z * math.sin(r), -x * math.sin(r) + z * math.cos(r))


def _reach(a, b, l1, l2, bend):
    """Two bones from a to b (forward, up): the angle of each away from straight down, forwards
    positive. bend +1 puts the middle joint forward of the line (a knee), -1 behind it (an elbow)."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    d = min(max(math.hypot(dx, dz), abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4)
    base = math.atan2(dx, -dz)
    a1 = base + bend * math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))
    m = (a[0] + l1 * math.sin(a1), a[1] - l1 * math.cos(a1))
    return a1, math.atan2(b[0] - m[0], -(b[1] - m[1]))


def _shoulder(z, rb, rc):
    w = _yrot(W_WAIST, rb)
    s = _yrot(W_SHOULDER, rb + rc)
    return (w[0] + s[0], z + w[1] + s[1])


def _arms_to(z, rb, rc, wrist, hand):
    """A front leg's angles to put its wrist at `wrist` (forward, up), the hand at `hand`."""
    return (*_reach(_shoulder(z, rb, rc), wrist, W_ARM, W_FORE, -1), hand)


def _wolf_pose(q):
    """One frame of the werewolf, from a few numbers, as each part's (location, rotation).

      z, rb, rc     the hips' height, the pelvis's pitch (-ve rears up) and the chest's on top of it
      roll, croll   the pelvis's and the chest's roll (a shake)
      head          the head's pitch in the world (0 level, -ve up), its turn and its tilt
      jaw           how far its mouth is open
      hind          per side (l, r): its paw (forward, up) and the angle of the foot above it
      front         per side: the arm's, the forearm's and the hand's angles from straight down
      tail          the tail's lift and its swing
      spread        the arms held out from its sides
      breath        how full its chest is (a breath in before a howl, panting after a run)
    """
    z, rb, rc = q["z"], q["rb"], q.get("rc", 0.0)
    hp, hy, hr = q.get("head", (0.2, 0.0, 0.0))
    b = q.get("breath", 0.0)
    out = {
        "body": ((0, 0, z), (q.get("roll", 0.0), rb, q.get("yaw", 0.0))),
        "chest": (None, (q.get("croll", 0.0), rc, q.get("cyaw", 0.0)), (1 + 0.4 * b, 1 + 0.7 * b, 1 + b)),
        "head": (None, (hr, hp - rb - rc, hy)),
        "jaw": (None, (0, -q.get("jaw", 0.0), 0)),
        "tail": (None, (0, q.get("tail", (0.0, 0.0))[0], q.get("tail", (0.0, 0.0))[1])),
    }
    for side in ("l", "r"):
        (px, pz), meta = q["hind"][side]
        hock = (px - W_META * math.sin(meta), pz + W_META * math.cos(meta))
        t, s = _reach((0, z), hock, W_THIGH, W_SHIN, 1)
        out[f"thigh_{side}"] = (None, (0, -t - rb, 0))
        out[f"shin_{side}"] = (None, (0, -s + t, 0))
        out[f"foot_{side}"] = (None, (0, -meta + s, 0))
        u, f, h = q["front"][side]
        sp = q.get("spread", 0.0) * (1 if side == "l" else -1)
        out[f"arm_{side}"] = (None, (-sp, -u - rb - rc, 0))
        out[f"forearm_{side}"] = (None, (0, -f + u, 0))
        out[f"hand_{side}"] = (None, (0, -h + f, 0))
    return out


def _stride(p, duty, length, lift):
    """Where a paw is, a fraction p through its stride: how far ahead of where it's planted in the
    middle, how high, and how far through its stance (0..1) or its swing (1..2)."""
    p -= math.floor(p)
    if p < duty:
        u = p / duty
        return length * (0.5 - u), 0.0, u
    u = (p - duty) / (1 - duty)
    ease = u * u * (3 - 2 * u)
    return length * (ease - 0.5), math.sin(math.pi * u ** 0.8) * lift, 1 + u


def _hind_angle(phase):
    """The foot above a hind paw: tipped forward as it lands, back as it pushes off, folded up behind in the air."""
    if phase < 1:
        return 0.35 - 0.75 * phase
    u = phase - 1
    return -0.4 - 0.6 * math.sin(math.pi * min(1, u * 1.4)) + 0.75 * max(0.0, (u - 0.5) / 0.5) ** 1.5


def _hand_angle(phase):
    """A front paw: flat on the ground, rolling up onto its toes, flicked back in the air, reaching to land."""
    if phase < 1:
        return 1.35 - 0.9 * max(0.0, (phase - 0.55) / 0.45) ** 1.5
    u = phase - 1
    return 0.45 - 1.4 * math.sin(math.pi * min(1, u * 1.6)) * (1 - u) + 0.9 * max(0.0, (u - 0.45) / 0.55) ** 1.2


def _stand(**over):
    """On all fours, standing still."""
    q = dict(z=W_HIP, rb=0.02, rc=0.06, head=(0.25, 0, 0), jaw=0.04, tail=(-0.45, 0.0), breath=0.0)
    q.update(over)
    hx = q.pop("hx", -0.08)
    fx = q.pop("fx", 0.06)
    q.setdefault("hind", {"l": ((hx, W_PAW), 0.25), "r": ((hx, W_PAW), 0.25)})
    sx = _shoulder(q["z"], q["rb"], q["rc"])[0]
    q.setdefault("front", {s: _arms_to(q["z"], q["rb"], q["rc"], (sx + fx, W_PAW + 0.03), 1.35) for s in ("l", "r")})
    return q


def _gait(u, speed, period, phases, duty, lift, centre, body):
    """One frame of a walk or a run, `u` 0..1 through the stride: each paw planted and carried
    along at the speed the body goes, picked up, swung forward and put down again."""
    q = body(u)
    sx = _shoulder(q["z"], q["rb"], q["rc"])[0]
    q["hind"], q["front"] = {}, {}
    for leg, ph in phases.items():
        front = leg[0] == "f"
        d = duty[1] if front else duty[0]
        x, up, at = _stride(u - ph, d, speed * period * d, lift[1] if front else lift[0])
        if front:
            hand = _hand_angle(at)
            q["front"][leg[1]] = _arms_to(q["z"], q["rb"], q["rc"], (sx + centre[1] + x, W_PAW + 0.03 + up), hand)
        else:
            q["hind"][leg[1]] = ((centre[0] + x, W_PAW + up), _hind_angle(at))
    return q


def _lerp_pose(a, b, k):
    """Partway from one pose to the next (nested tuples and dicts of numbers)."""
    if isinstance(a, dict):
        return {key: _lerp_pose(a[key], b.get(key, a[key]), k) for key in a} | {key: b[key] for key in b if key not in a}
    if isinstance(a, (tuple, list)):
        return tuple(_lerp_pose(x, y, k) for x, y in zip(a, b))
    return a + (b - a) * k


_EASE = {
    "io": lambda k: k * k * (3 - 2 * k),                     # in and out
    "out": lambda k: 1 - (1 - k) ** 3,                        # off fast, slowing into it: a snap
    "in": lambda k: k ** 2.2,                                 # slow away, then quick: a drop
    "back": lambda k: 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2,  # a touch past it, and back: a settle
}


def _keyed(poses, t):
    """The pose at t seconds between keyed poses [(seconds, pose[, ease]), …]; a key's ease (io by
    default, see _EASE) is how the pose before it gets there."""
    for a, b in zip(poses, poses[1:]):
        (t0, p0), (t1, p1) = a[:2], b[:2]
        if t <= t1:
            k = (t - t0) / (t1 - t0) if t1 > t0 else 1
            return _lerp_pose(p0, p1, _EASE[b[2] if len(b) > 2 else "io"](k))
    return poses[-1][1]


def _bake(parts, clip, length, pose_at, step=1 / 24):
    """Key every part of the werewolf for `clip`, sampling pose_at(seconds) through it."""
    n = max(2, round(length / step))
    frames = [(k * length / n, _wolf_pose(pose_at(k * length / n))) for k in range(n + 1)]
    for name, obj in parts.items():
        if frames[0][1][name][0] is not None:
            animate(obj, clip, "location", [(t, f[name][0]) for t, f in frames], rest=(0, 0, 0))
        animate(obj, clip, "rotation_euler", [(t, f[name][1]) for t, f in frames], rest=(0, 0, 0))
        if len(frames[0][1][name]) > 2:
            animate(obj, clip, "scale", [(t, f[name][2]) for t, f in frames], rest=(0, 0, 0))


def _tuft(m: Model, at, length, color, heading=math.pi, lean=0.5, width=0.07):
    """A shaggy point of fur sticking out from `at`, swept back."""
    x, y, z = at
    m.prism([(-width, 0), (width, 0), (-length * math.sin(lean) - width, length * math.cos(lean))], 0.05, (x, y, z), color,
            rot=(0, 0, heading - math.pi))


def _shag(m: Model, rng, x0, x1, z0, z1, rise, n):
    """Fur standing up along the spine from x0 to x1 (rising from z0 to z1 and back), in uneven
    tufts swept back, some dark and some not, some splayed a little to either side."""
    for k in range(n):
        u = k / max(1, n - 1)
        x = x0 + (x1 - x0) * u
        z = z0 + (z1 - z0) * math.sin(u * math.pi * 0.8)
        ln = rise * rng.uniform(0.6, 1.25)
        w = rng.uniform(0.04, 0.07)
        m.prism([(-w, 0), (w, 0), (-ln * 0.9 - w, ln * 0.55)], rng.uniform(0.06, 0.12), (x, rng.uniform(-0.04, 0.04), z),
                WOLF_DARK if rng.random() < 0.65 else WOLF, rot=(rng.uniform(-0.35, 0.35), 0, 0))


def werewolf(root):
    rng = random.Random(41)
    b = Model("werewolf_body", seed=41)                                                    # the pelvis: hips in his old jeans
    b.ball(0.24, (0.2, 0, 0.06), WOLF, subdiv=2, scale=(1.3, 0.8, 0.85), jitter=0.02)
    b.ball(0.13, (0.2, 0, -0.1), WOLF_LIGHT, subdiv=1, scale=(1.4, 0.9, 0.6))             # the belly, paler
    b.ball(0.24, (-0.02, 0, 0.02), JEANS, subdiv=2, scale=(1.0, 1.12, 0.95))
    for k in range(9):                                                                     # the waistband, torn through
        a = k / 9 * math.tau
        b.box((0.07, 0.07, 0.07 + 0.06 * (k % 3)), (0.12 + 0.05 * math.cos(a), 0.25 * math.sin(a), 0.0), JEANS_PALE)
    _shag(b, rng, 0.02, 0.4, 0.2, 0.22, 0.09, 6)                                           # the hackles start here…
    body = b.build(root, loc=(0, 0, W_HIP))

    t = Model("werewolf_tail", seed=42)                                                    # bushy, from the base of the spine
    for k in range(5):
        r = 0.1 - k * 0.01
        t.ball(r, (-0.08 - k * 0.12, 0, -0.02 * k), WOLF_DARK if k < 3 else WOLF, subdiv=1, scale=(1.4, 1, 1), jitter=0.02)
    t.ball(0.05, (-0.66, 0, -0.1), WOLF_PALE, subdiv=1)
    tail = t.build(body, loc=(-0.22, 0, 0.12))

    c = Model("werewolf_chest", seed=43)                                                   # a great barrel of a chest, hunched up at the shoulders
    c.ball(0.3, (0.28, 0, 0.0), WOLF, subdiv=2, scale=(1.3, 0.85, 1.05), jitter=0.025)
    c.ball(0.2, (0.48, 0, 0.17), WOLF_DARK, subdiv=1, scale=(1.25, 1.15, 0.8), jitter=0.02)
    c.ball(0.13, (0.56, 0, -0.1), WOLF_PALE, subdiv=1, scale=(0.7, 1.1, 1.2), jitter=0.03)    # the ruff on its chest
    c.ball(0.15, (0.2, 0, -0.18), WOLF_LIGHT, subdiv=1, scale=(1.6, 0.8, 0.6))
    _shag(c, rng, -0.02, 0.7, 0.25, 0.32, 0.13, 12)                                      # …and run all the way up its back, standing on end
    for k in range(6):                                                                     # a ragged fringe under its belly
        for s in (1, -1):
            c.prism([(-0.05, 0), (0.05, 0), (-0.09, -0.1 - 0.05 * rng.random())], 0.03, (0.05 + k * 0.09, s * 0.2, -0.2), WOLF, rot=(-s * 0.3, 0, 0))
    _taper(c, (0.55, 0, 0.08), (W_NECK[0] + 0.02, 0, W_NECK[1]), 0.18, 0.13, WOLF)          # a thick neck
    c.ball(0.16, (0.72, 0, 0.27), WOLF_DARK, subdiv=1, scale=(1.1, 1.2, 1.0), jitter=0.03)  # with a mane on it
    for s in (1, -1):                                                                      # a rag of checked shirt, round one shoulder and across
        c.box((0.09, 0.05, 0.3), (0.5, s * 0.24, 0.0), CHECK, rot=(s * 0.25, 0.2, 0))
        c.box((0.03, 0.055, 0.3), (0.5, s * 0.245, 0.0), "#d8c8b0", rot=(s * 0.25, 0.2, 0))
    c.box((0.32, 0.06, 0.07), (0.34, 0.27, -0.12), CHECK, rot=(0, -0.5, 0))
    chest = c.build(body, loc=(W_WAIST[0], 0, W_WAIST[1]))

    h = Model("werewolf_head", seed=44)                                                    # a long wolf's head on a man's neck
    h.ball(0.15, (0.06, 0, 0.04), WOLF, subdiv=2, scale=(1.25, 1.05, 0.95), jitter=0.012)
    for s in (1, -1):
        h.ball(0.08, (0.02, s * 0.12, -0.03), WOLF_LIGHT, subdiv=1, jitter=0.02)            # cheek ruffs
        _tuft(h, (-0.02, s * 0.15, -0.02), 0.14, WOLF_LIGHT, heading=math.pi + s * 0.6, lean=1.0, width=0.05)
    h.box((0.28, 0.14, 0.1), (0.3, 0, 0.01), WOLF, taper=0.8)                              # the muzzle
    h.box((0.2, 0.1, 0.04), (0.32, 0, -0.05), WOLF_LIGHT)
    h.box((0.06, 0.08, 0.06), (0.45, 0, 0.03), P.INK)                                      # its nose
    for s in (1, -1):
        h.box((0.025, 0.025, 0.07), (0.4, s * 0.045, -0.08), CLAW)                         # fangs
        h.box((0.04, 0.045, 0.03), (0.17, s * 0.068, 0.08), WOLF_EYE, glow=True)            # yellow eyes…
        h.box((0.07, 0.06, 0.025), (0.17, s * 0.065, 0.11), WOLF_DARK, rot=(0, -0.3, s * 0.3))   # …under a heavy brow
        h.prism([(-0.06, 0), (0.05, 0), (-0.04, 0.22)], 0.035, (-0.02, s * 0.09, 0.14), WOLF_DARK, rot=(s * 0.25, 0, 0))   # tall ears
        h.prism([(-0.03, 0.02), (0.03, 0.02), (-0.025, 0.15)], 0.02, (0.0, s * 0.09, 0.15), "#6a4a4a", rot=(s * 0.25, 0, 0))
    head = h.build(chest, loc=(W_NECK[0], 0, W_NECK[1]))

    j = Model("werewolf_jaw")                                                              # the lower jaw, hinged under its ears
    j.box((0.26, 0.11, 0.05), (0.13, 0, -0.025), WOLF_LIGHT, taper=1.0)
    j.box((0.2, 0.08, 0.02), (0.13, 0, 0.005), MOUTH)
    j.box((0.16, 0.06, 0.02), (0.11, 0, 0.012), GUMS)                                      # its tongue
    for s in (1, -1):
        j.box((0.022, 0.022, 0.05), (0.23, s * 0.035, 0.03), CLAW)
    jaw = j.build(head, loc=(0.16, 0, -0.06))

    parts = {"body": body, "chest": chest, "head": head, "jaw": jaw, "tail": tail}
    for s, side in ((1, "l"), (-1, "r")):
        a = Model(f"werewolf_arm_{side}", seed=45)                                         # long arms, the shoulders shaggy
        a.ball(0.12, (0, 0, -0.02), WOLF_DARK, subdiv=1, jitter=0.02)
        _taper(a, (0, 0, 0), (0, 0, -W_ARM), 0.1, 0.075, WOLF)
        _tuft(a, (-0.05, 0, -W_ARM + 0.04), 0.12, WOLF_DARK, lean=1.2)                    # elbows
        arm = a.build(chest, loc=(W_SHOULDER[0], s * 0.22, W_SHOULDER[1]))
        f = Model(f"werewolf_forearm_{side}", seed=46)
        _taper(f, (0, 0, 0), (0, 0, -W_FORE), 0.078, 0.055, WOLF)
        f.ball(0.065, (0, 0, -W_FORE + 0.02), WOLF_DARK, subdiv=1)
        fore = f.build(arm, loc=(0, 0, -W_ARM))
        n = Model(f"werewolf_hand_{side}", seed=47)                                        # hands that are paws that are hands
        n.box((0.09, 0.13, 0.11), (0, 0, -0.06), WOLF_DARK)
        for k in range(4):                                                                 # four claws, hooked
            y = (k - 1.5) * 0.032
            n.plank_line((0.0, y, -0.1), (-0.015, y * 1.15, -0.16), 0.02, 0.02, WOLF_DARK)
            n.plank_line((-0.015, y * 1.15, -0.16), (-0.05, y * 1.2, -0.2), 0.016, 0.016, CLAW)
        n.plank_line((0.03, s * 0.06, -0.05), (0.0, s * 0.09, -0.12), 0.016, 0.016, CLAW)    # and a thumb
        hand = n.build(fore, loc=(0, 0, -W_FORE))
        g = Model(f"werewolf_thigh_{side}", seed=48)                                       # haunches in the jeans…
        _taper(g, (0, 0, 0.04), (0, 0, -W_THIGH + 0.04), 0.15, 0.11, JEANS)
        for k in range(8):                                                                 # …torn off ragged above the knee
            a_ = k / 8 * math.tau
            g.box((0.06, 0.05, 0.06 + 0.07 * rng.random()), (0.11 * math.cos(a_), 0.11 * math.sin(a_), -W_THIGH + 0.03), JEANS_PALE)
        g.ball(0.1, (0.02, 0, -W_THIGH), WOLF, subdiv=1, jitter=0.02)
        thigh = g.build(body, loc=(0, s * 0.17, 0))
        sh = Model(f"werewolf_shin_{side}", seed=49)
        _taper(sh, (0, 0, 0), (0, 0, -W_SHIN), 0.085, 0.055, WOLF)
        _tuft(sh, (-0.04, 0, -0.12), 0.12, WOLF_DARK, lean=1.1)
        shin = sh.build(thigh, loc=(0, 0, -W_THIGH))
        ft = Model(f"werewolf_foot_{side}", seed=50)                                       # long feet: it walks on its toes
        _taper(ft, (0, 0, 0), (0, 0, -W_META), 0.055, 0.045, WOLF_DARK)
        ft.ball(0.07, (0.06, 0, -W_META), WOLF_DARK, subdiv=1, scale=(1.6, 1.0, 0.6))
        for k in range(3):
            ft.box((0.05, 0.02, 0.025), (0.16, (k - 1) * 0.035, -W_META - 0.03), CLAW)
        foot = ft.build(shin, loc=(0, 0, -W_SHIN))
        parts |= {f"arm_{side}": arm, f"forearm_{side}": fore, f"hand_{side}": hand, f"thigh_{side}": thigh, f"shin_{side}": shin, f"foot_{side}": foot}
    _werewolf_clips(parts)


def _werewolf_clips(parts):
    stand = _stand()

    # padding along on all fours, nose down, sniffing the way
    def prowl_body(u):
        w = math.tau * u
        return _stand(z=W_HIP + 0.02 * math.cos(2 * w), rb=0.04 + 0.02 * math.sin(2 * w), rc=0.1, roll=0.03 * math.sin(w),
                      croll=-0.04 * math.sin(w), head=(0.55 + 0.05 * math.sin(2 * w + 0.6), 0.12 * math.sin(w + 0.4), 0),
                      tail=(-0.55 + 0.05 * math.sin(2 * w), 0.18 * math.sin(w + 1)), jaw=0.03)
    speed, period = W_PROWL
    _bake(parts, "werewolf_prowl", period, lambda t: _gait(t / period, speed, period, {"hl": 0.0, "fl": 0.25, "hr": 0.5, "fr": 0.75},
                                                              (0.66, 0.62), (0.12, 0.16), (-0.06, 0.08), prowl_body))

    # flat out: a gallop, back flexing and stretching, the hind feet reaching up past the front
    def lope_body(u):
        w = math.tau * u
        return _stand(z=W_HIP - 0.04 + 0.07 * math.sin(w - 0.9), rb=-0.08 * math.sin(w - 0.6), rc=0.17 * math.cos(w - 0.3),
                      head=(0.08 + 0.06 * math.sin(w + 0.4), 0, 0), jaw=0.28 + 0.08 * math.sin(2 * w), breath=0.05 * math.sin(w - 0.3),
                      tail=(0.05 + 0.15 * math.sin(w + 1.2), 0.08 * math.sin(w)))
    speed, period = W_LOPE
    _bake(parts, "werewolf_lope", period, lambda t: _gait(t / period, speed, period, {"hl": 0.0, "hr": 0.08, "fl": 0.5, "fr": 0.6},
                                                             (0.4, 0.36), (0.3, 0.36), (-0.02, 0.18), lope_body), step=1 / 48)

    # stood still, nose to the ground, casting about for a scent, the tail swinging slowly
    def sniff(t):
        u = t / 4.0
        w = math.tau * u
        jerk = max(0.0, math.sin(math.tau * 9 * u)) ** 3
        return _stand(rb=0.1, rc=0.16, z=W_HIP - 0.04, head=(0.8 + 0.06 * jerk, 0.55 * math.sin(w), 0.1 * math.sin(w)),
                      jaw=0.02 + 0.02 * jerk, tail=(-0.4, 0.25 * math.sin(2 * w)), roll=0.02 * math.sin(w), breath=0.03 * math.sin(w * 2))
    _bake(parts, "werewolf_sniff", 4.0, sniff, step=1 / 24)

    # The howl: nose up to test the air, a crouch and up onto its hind legs, and two calls at the
    # moon, a shorter one and then the long one, each on a big breath in, head back and climbing as
    # it swells and sinking as it dies away; then it pants, looks round and drops back down. The
    # runtime starts a howl's sound at each HOWL_AT (monsters.ts has the same numbers).
    HOWL_AT = (3.0, 5.7)

    def up(**over):
        q = dict(z=W_HIP + 0.06, rb=-1.22, rc=-0.12, head=(-0.7, 0, 0), jaw=0.08, tail=(0.9, 0.0), spread=0.1, breath=0.0,
                 hind={"l": ((-0.02, W_PAW), 0.2), "r": ((-0.02, W_PAW), 0.2)},
                 front={"l": (0.25, 0.55, 0.45), "r": (0.25, 0.55, 0.45)})
        q.update(over)
        return q
    air = _stand(z=W_HIP + 0.02, rb=-0.06, rc=-0.04, head=(-0.35, 0, 0), tail=(-0.3, 0.0), breath=0.02)
    gather = _stand(z=W_HIP - 0.14, rb=0.12, rc=0.14, head=(0.25, 0, 0), tail=(-0.55, 0), breath=0.0)
    drawn = {"l": (0.35, 0.95, 0.9), "r": (0.35, 0.95, 0.9)}                                 # arms in, claws curled
    flung = {"l": (0.55, 1.15, 1.3), "r": (0.55, 1.15, 1.3)}                               # arms out, elbows bent, claws up
    wide = {"l": (0.75, 1.45, 1.6), "r": (0.75, 1.45, 1.6)}                                # and wider again, for the long one
    sunk = {"l": (0.3, 0.7, 0.6), "r": (0.3, 0.7, 0.6)}
    c1, c2 = HOWL_AT
    howl_keys = [
        (0.0, stand),
        (0.6, air),                                                                         # nose up: something on the air
        (1.2, gather, "io"),                                                                # down on its haunches…
        (1.9, up(rb=-1.3, rc=-0.06, head=(-0.25, 0, 0), spread=0.2), "out"),                # …and up, all in one go
        (2.25, up(rb=-1.2, rc=-0.08, head=(-0.35, 0, 0), spread=0.2), "back"),
        (c1 - 0.15, up(rc=-0.26, head=(-0.5, 0, 0), jaw=0.03, spread=0.3, breath=0.12, front=drawn)),   # a breath in, head down a little
        (c1 + 0.25, up(rb=-1.24, rc=-0.32, head=(-0.95, 0.05, 0.05), jaw=0.62, spread=0.7, breath=0.06, front=flung), "out"),  # the first call
        (c1 + 1.3, up(rb=-1.25, rc=-0.33, head=(-1.02, 0.02, 0.04), jaw=0.66, spread=0.75, breath=-0.02, front=flung)),
        (c1 + 2.1, up(rb=-1.2, rc=-0.2, head=(-0.6, 0, 0), jaw=0.2, spread=0.45, breath=-0.04, front=sunk), "in"),  # dying away
        (c2 - 0.2, up(rb=-1.2, rc=-0.3, head=(-0.42, -0.04, 0), jaw=0.02, spread=0.3, breath=0.16, front=drawn)),   # a bigger breath…
        (c2 + 0.3, up(rb=-1.3, rc=-0.4, head=(-1.08, -0.05, -0.05), jaw=0.78, spread=0.95, breath=0.08, front=wide), "out"),  # …and the long one
        (c2 + 1.8, up(rb=-1.32, rc=-0.42, head=(-1.18, -0.08, -0.06), jaw=0.8, spread=1.0, breath=-0.02, front=wide)),
        (c2 + 3.4, up(rb=-1.2, rc=-0.18, head=(-0.5, 0, 0), jaw=0.12, spread=0.35, breath=-0.06, front=sunk), "in"),
        (c2 + 4.1, up(head=(-0.15, 0.6, 0.12), jaw=0.18, spread=0.2, breath=0.05)),       # panting, and a look round
        (c2 + 4.8, up(head=(-0.2, -0.4, -0.05), jaw=0.15, spread=0.2, breath=0.02)),
        (c2 + 5.4, _stand(z=W_HIP - 0.1, rb=0.1, rc=0.12, fx=0.2, head=(0.25, -0.2, 0), jaw=0.15), "in"),   # down onto its hands
        (c2 + 5.9, _stand(jaw=0.12), "back"),
        (c2 + 6.4, stand),
    ]
    howl_length = c2 + 6.4

    def calling(t):
        """How far into a call it is, 0..1 (0 when it isn't calling)."""
        for c, n in ((c1, 1.9), (c2, 3.2)):
            if c <= t <= c + n:
                return min(1.0, (t - c) / 0.25) * min(1.0, (c + n - t) / 0.6)
        return 0.0

    def howl(t):
        q = _keyed(howl_keys, t)
        lag = _keyed(howl_keys, max(0.0, t - 0.12))                                         # the head a beat behind the body…
        tail = _keyed(howl_keys, max(0.0, t - 0.3))                                         # …and the tail behind that
        k = calling(t)
        hp, hy, hr = lag["head"]
        q["head"] = (hp + 0.025 * k * math.sin(t * 47), hy + 0.05 * k * math.sin(t * 1.9), hr)   # its throat trembling with it
        q["jaw"] = q["jaw"] + 0.05 * k * math.sin(t * 29)
        q["tail"] = (tail["tail"][0] + 0.12 * k, tail["tail"][1] + 0.35 * k * math.sin(t * 2.3))
        q["roll"] = 0.05 * k * math.sin(t * 1.6)                                            # swaying with it
        if t > c2 + 3.6:                                                                    # and after, out of breath
            q["breath"] = q.get("breath", 0.0) + 0.05 * math.sin(t * 14)
            q["jaw"] += 0.04 * math.sin(t * 14)
        return q
    _bake(parts, "werewolf_howl", howl_length, howl)

    # clicked: down low, hackles up, and a snarl with a snap of the jaws, a paw stamped down
    low = _stand(z=W_HIP - 0.16, rb=0.14, rc=0.16, fx=0.16, hx=-0.18, head=(0.0, 0, 0), jaw=0.45, tail=(-0.75, 0))
    stamp = _stand(z=W_HIP - 0.16, rb=0.14, rc=0.16, fx=0.16, hx=-0.18, head=(-0.05, 0, 0), jaw=0.2, tail=(-0.75, 0))
    sx = _shoulder(stamp["z"], stamp["rb"], stamp["rc"])[0]
    stamp["front"] = dict(stamp["front"], l=_arms_to(stamp["z"], stamp["rb"], stamp["rc"], (sx + 0.35, W_PAW + 0.28), 0.9))
    snarl_keys = [(0.0, stand), (0.3, low), (0.7, dict(low, jaw=0.55, head=(0.05, 0.1, 0))), (0.85, stamp),
                  (1.0, dict(low, jaw=0.6)), (1.15, dict(low, jaw=0.1, head=(-0.08, 0, 0))), (1.3, dict(low, jaw=0.55)),
                  (1.8, dict(low, jaw=0.45, head=(0.0, -0.1, 0))), (2.3, stand)]

    def snarl(t):
        q = _keyed(snarl_keys, t)
        k = max(0.0, min(1.0, t / 0.3)) * max(0.0, min(1.0, (2.2 - t) / 0.4))
        q["head"] = (q["head"][0] + 0.02 * k * math.sin(t * 40), q["head"][1], q["head"][2])   # the growl in its chest
        q["roll"] = 0.015 * k * math.sin(t * 37)
        return q
    _bake(parts, "werewolf_snarl", 2.3, snarl)

    # a wet-dog shake, nose to tail
    def shake(t):
        env = math.sin(math.pi * min(1, t / 1.4)) ** 2
        w = math.tau * 5.5 * t
        return _stand(roll=0.22 * env * math.sin(w - 1.2), croll=0.32 * env * math.sin(w - 0.6),
                      head=(0.25, 0.25 * env * math.sin(w + 0.4), 0.7 * env * math.sin(w)), jaw=0.04,
                      tail=(-0.2 * env - 0.45 * (1 - env), 0.7 * env * math.sin(w - 1.8)), yaw=0.08 * env * math.sin(w - 1.5))
    _bake(parts, "werewolf_shake", 1.6, shake)

    # and between clips, stood as it is on all fours
    for name, (loc, rot, *_) in _wolf_pose(stand).items():
        if loc is not None:
            parts[name].location = loc
        parts[name].rotation_euler = rot


ALL = {
    "horseman": (horseman, 1.0),
    "tallone": (tallone, 1.0),
    "ghostship": (ghostship, 1.0),
    "witch": (witch, 1.3),
    "nazgul": (nazgul, 1.0),
    "grimm": (grimm, 1.0),
    "werewolf": (werewolf, 1.0),
}
