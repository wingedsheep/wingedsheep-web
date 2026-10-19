"""Visitors out of the books on Vincent's shelf (src/island/scene/fiction.ts brings them out, each
rarely and only in its own weather): a hippogriff, a Mistborn, and a sperm whale with a bowl of
petunias, falling.

Templates like the wildlife (fauna.py merges ALL into its own): parked under a root tagged
`fauna=<name>`, facing +x, y to their left, z = 0 the ground. Parts that move are their own
objects, pivoting where they join.
"""
from __future__ import annotations

import math

from mathutils import Vector

import palette as P
from kit import Model


def _limb(m: Model, a, b, r0, r1, color, segs=6):
    """A tapered round limb from a (radius r0) to b (radius r1)."""
    d = Vector(b) - Vector(a)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r0, d.length, a, color, segs=segs, r_top=r1, rot=tuple(rot))


def _eye(m: Model, at, side, r, iris, pupil=P.INK):
    x, y, z = at
    m.ball(r, (x, side * y, z), iris, subdiv=1, scale=(0.6, 0.5, 1))
    m.box((r * 0.7, r * 0.5, r * 1.1), (x + r * 0.25, side * (y + r * 0.2), z), pupil)
    m.box((r * 0.35, r * 0.3, r * 0.35), (x + r * 0.35, side * (y + r * 0.35), z + r * 0.35), "#ffffff")   # a glint


# --- the hippogriff (Prisoner of Azkaban) --------------------------------------------------------

FEATHER = "#8f949a"
FEATHER_DARK = "#62666e"
FEATHER_LIGHT = "#c2c6ca"
COAT = "#80848b"
COAT_DARK = "#5c6067"
BEAK = "#d8cfb0"
BEAK_DARK = "#8c8678"
EYE = "#f0a030"
TALON = "#c8b47c"
CLAW = "#1d1a24"
HOOF = "#3a3640"
HAIR = "#b8bcc2"


def _feather_rows(m: Model, centre, rx, ry, rz, rows, color_a, color_b, x_from, x_to):
    """Overlapping rows of little feathers over the front of a body, scaled like a breastplate."""
    cx, cy, cz = centre
    for i in range(rows):
        t = i / max(1, rows - 1)
        x = x_from + (x_to - x_from) * t
        for k in range(-3, 4):
            a = k / 3 * 1.2
            y = math.sin(a) * ry * 0.95
            z = cz + math.cos(a) * rz * 0.15 - 0.05 * i
            m.prism([(0.0, 0.0), (-0.12, 0.06), (-0.12, -0.06)], 0.07, (cx + x, cy + y, z), color_a if (i + k) % 2 else color_b, rot=(math.pi / 2, 0.25, a))


def _wing(tag: str, side: int, body):
    """A great wing, flat and spread (the runtime flaps it about x, folds it back about y): the
    arm, with its coverts, and the hand at the wrist (`hippogriff_hand_<tag>`) with the long
    primaries fanned out to the tip."""
    w = Model(f"hippogriff_wing_{tag}", seed=60 + side)
    w.box((0.7, 1.15, 0.07), (-0.08, side * 0.58, 0), FEATHER)                                  # the arm's flight feathers
    w.box((0.36, 1.15, 0.09), (0.12, side * 0.58, 0.02), FEATHER_LIGHT)                         # the coverts
    w.box((0.18, 1.12, 0.1), (0.24, side * 0.58, 0.03), FEATHER_DARK)                           # the leading edge
    for k in range(7):                                                                          # secondaries, their ends ragged
        w.box((0.22, 0.15, 0.05), (-0.48, side * (0.12 + k * 0.155), -0.005), FEATHER_DARK if k % 2 else FEATHER)
    wing = w.build(body, loc=(0.42, side * 0.3, 0.32))
    h = Model(f"hippogriff_hand_{tag}", seed=70 + side)
    h.box((0.55, 0.5, 0.06), (-0.02, side * 0.25, 0), FEATHER)
    h.box((0.2, 0.5, 0.08), (0.18, side * 0.25, 0.02), FEATHER_DARK)
    for k in range(8):                                                                          # the primaries, fingered at the tip
        a = side * (0.28 - k * 0.12)
        length = 1.05 - abs(k - 2) * 0.07
        x0, y0 = 0.16 - k * 0.075, 0.42
        h.box((0.1, length, 0.035), (x0 - math.sin(a * side) * length / 2, side * (y0 + math.cos(a) * length / 2), -0.01 * k), FEATHER_DARK if k < 3 else FEATHER, rot=(0, 0, a))
    h.build(wing, loc=(0, side * 1.15, 0))


def hippogriff(root):
    """Buckbeak, or one very like him: an eagle in front, a horse behind, storm grey all over. A
    great hooked beak, orange eyes, a crest swept back off the head, feathers giving way to a
    grey coat over the barrel, and a long pale tail. The neck and head turn (`neck`, `head`,
    and the beak opens: `jaw`), the wings flap and fold, the front legs are an eagle's, with
    talons, bending at the knee (`leg_fl`/`fr`, then `shin_fl`/`fr`), the hind legs a horse's
    (`leg_bl`/`br`, `hock_bl`/`br`), and the tail swishes."""
    b = Model("hippogriff_body", seed=50)
    b.ball(0.42, (0.42, 0, 0.04), FEATHER, subdiv=2, scale=(1.0, 0.82, 1.05))                   # the deep feathered chest
    b.ball(0.4, (-0.18, 0, 0.0), COAT, subdiv=2, scale=(1.45, 0.8, 0.88))                        # the barrel
    b.ball(0.4, (-0.66, 0, 0.04), COAT, subdiv=2, scale=(0.95, 0.86, 1.0))                       # the hindquarters
    b.ball(0.22, (-0.62, 0, 0.3), COAT_DARK, subdiv=1, scale=(1.4, 0.9, 0.5))                    # the croup
    b.ball(0.3, (0.12, 0, 0.26), FEATHER_DARK, subdiv=1, scale=(1.5, 0.9, 0.55))                 # feathers over the withers
    _feather_rows(b, (0.45, 0, 0.0), 0.42, 0.34, 0.4, 5, FEATHER_LIGHT, FEATHER, 0.34, 0.02)
    for i in range(10):                                                                          # where the feathers give way to the coat
        a = (i / 9 - 0.5) * 2.6
        b.prism([(0.0, 0.0), (-0.2, 0.07), (-0.2, -0.07)], 0.06, (0.02, math.sin(a) * 0.3, math.cos(a) * 0.28 - 0.04), FEATHER, rot=(math.pi / 2, 0, a))
    body = b.build(root, loc=(0, 0, 1.15))

    n = Model("hippogriff_neck", seed=51)
    _limb(n, (0, 0, 0), (0.2, 0, 0.36), 0.26, 0.19, FEATHER, segs=8)
    for i in range(6):                                                                           # the ruff, down the front
        n.prism([(0.0, 0.0), (-0.16, 0.05), (-0.16, -0.05)], 0.12, (0.17 + i * 0.02, 0, 0.36 - i * 0.07), FEATHER_LIGHT if i % 2 else FEATHER, rot=(math.pi / 2, 0.6, 0))
    neck = n.build(body, loc=(0.62, 0, 0.3))

    h = Model("hippogriff_head", seed=52)
    h.ball(0.2, (0.02, 0, 0.02), FEATHER, subdiv=2, scale=(1.25, 0.88, 0.98))
    h.ball(0.12, (0.12, 0, 0.11), FEATHER_LIGHT, subdiv=1, scale=(1.3, 1.2, 0.5))                # the brow
    # the beak: deep at the base, hooked over at the tip
    h.prism([(0.16, 0.08), (0.36, 0.06), (0.47, -0.02), (0.46, -0.12), (0.4, -0.06), (0.16, -0.06)], 0.17, (0, 0, 0), BEAK)
    h.prism([(0.4, -0.04), (0.47, -0.02), (0.46, -0.12), (0.42, -0.08)], 0.12, (0, 0, 0), BEAK_DARK)
    h.box((0.06, 0.2, 0.08), (0.17, 0, 0.0), BEAK_DARK)                                         # the cere
    for s in (1, -1):
        _eye(h, (0.12, 0.13, 0.08), s, 0.045, EYE)
    for i in range(6):                                                                           # the crest, swept back
        h.prism([(0.0, 0.0), (-0.42 + i * 0.03, 0.12 - i * 0.025), (-0.3, 0.0)], 0.05, (-0.04, (i - 2.5) * 0.045, 0.14 - abs(i - 2.5) * 0.02), FEATHER_DARK if i % 2 else FEATHER, rot=(math.pi / 2, 0, 0))
    head = h.build(neck, loc=(0.24, 0, 0.42))
    head.scale = (1.15, 1.15, 1.15)
    j = Model("hippogriff_jaw")                                                                 # the lower beak, hinged at its root
    j.prism([(0.0, 0.0), (0.22, -0.02), (0.18, -0.07), (0.0, -0.06)], 0.13, (0, 0, 0), BEAK_DARK)
    j.build(head, loc=(0.18, 0, -0.06))

    for tag, s in (("l", 1), ("r", -1)):
        _wing(tag, s, body)
        # the front legs: an eagle's, feathered to the knee, then scaly, with great talons
        f = Model(f"hippogriff_leg_f{tag}", seed=80 + s)
        _limb(f, (0, 0, 0), (0.06, 0, -0.42), 0.13, 0.09, FEATHER)
        for i in range(4):
            f.prism([(0.0, 0.0), (-0.1, 0.05), (-0.1, -0.05)], 0.05, (0.0, s * 0.09, -0.12 - i * 0.08), FEATHER_DARK, rot=(math.pi / 2, 1.4, s * 0.4))
        leg = f.build(body, loc=(0.5, s * 0.2, -0.27))
        k = Model(f"hippogriff_shin_f{tag}", seed=82 + s)
        _limb(k, (0, 0, 0), (-0.02, 0, -0.42), 0.055, 0.045, TALON)
        for a in (-0.45, 0, 0.45):                                                              # three toes forward and one back, clawed
            k.plank_line((-0.02, 0, -0.43), (-0.02 + math.cos(a) * 0.16, math.sin(a) * 0.14, -0.47), 0.04, 0.04, TALON)
            k.box((0.06, 0.03, 0.04), (-0.02 + math.cos(a) * 0.19, math.sin(a) * 0.16, -0.49), CLAW, rot=(0, 0.5, a))
        k.plank_line((-0.02, 0, -0.43), (-0.12, 0, -0.47), 0.04, 0.04, TALON)
        k.box((0.05, 0.03, 0.04), (-0.15, 0, -0.49), CLAW)
        k.build(leg, loc=(0.06, 0, -0.42))
        # the hind legs: a horse's, a long thigh down to the hock, then the cannon to the hoof
        g = Model(f"hippogriff_leg_b{tag}", seed=84 + s)
        _limb(g, (0.0, 0, 0.05), (-0.1, 0, -0.48), 0.17, 0.08, COAT)
        leg = g.build(body, loc=(-0.72, s * 0.21, -0.12))
        c = Model(f"hippogriff_hock_b{tag}", seed=86 + s)
        _limb(c, (0, 0, 0), (0.06, 0, -0.44), 0.065, 0.05, COAT_DARK)
        c.box((0.14, 0.12, 0.09), (0.08, 0, -0.47), HOOF)
        c.build(leg, loc=(-0.1, 0, -0.48))

    t = Model("hippogriff_tail", seed=90)                                                        # long and pale, falling from the dock
    _limb(t, (0, 0, 0), (-0.22, 0, -0.18), 0.09, 0.08, COAT_DARK)
    for i in range(6):
        y = (i - 2.5) * 0.035
        _limb(t, (-0.18, y, -0.14), (-0.32 - i % 3 * 0.04, y * 1.6, -0.78 + (i % 2) * 0.08), 0.06, 0.025, HAIR if i % 2 else "#a4a8ae")
    t.build(body, loc=(-1.02, 0, 0.18))


# --- the Mistborn ------------------------------------------------------------------------------

DARK = "#2e2c36"
DARK_LIGHT = "#3e3c48"
CLOAK = ["#4a4e58", "#3c404a", "#555a64"]
SKIN_PALE = "#e8c0a0"
HAIR_DARK = "#1f1a1c"
BELT = "#5a4a3a"
TASSELS = 9


def mistborn(root):
    """A Mistborn in her mistcloak, small and slight: dark clothes, short dark hair, and the
    cloak of long ribbons sewn together only at the shoulders (`tassel_0`…, pivoting there, to
    stream out behind her when she flies). `body` pivots at the hips; `head` at the neck; the
    arms at the shoulders; each leg at the hip (`thigh_l`/`r`) and the knee (`shin_l`/`r`)."""
    b = Model("mistborn_body", seed=120)
    b.box((0.17, 0.27, 0.22), (0, 0, 0.1), DARK)                                               # hips
    b.box((0.16, 0.3, 0.3), (0, 0, 0.33), DARK_LIGHT, taper=1.1)                               # chest
    b.box((0.18, 0.29, 0.05), (0, 0, 0.21), BELT)                                              # the belt, and its vials
    for y in (-0.06, 0.02, 0.1):
        b.box((0.03, 0.025, 0.06), (0.095, y, 0.21), "#c8d8e0")
    b.box((0.22, 0.4, 0.08), (-0.01, 0, 0.47), CLOAK[0])                                       # the cloak's shoulders
    b.box((0.2, 0.2, 0.06), (0.0, 0, 0.53), CLOAK[1])                                          # the collar, the hood down
    body = b.build(root, loc=(0, 0, 0.82))
    h = Model("mistborn_head", seed=121)
    h.box((0.06, 0.06, 0.08), (0, 0, 0.03), SKIN_PALE)
    h.ball(0.105, (0.01, 0, 0.14), SKIN_PALE, subdiv=1, scale=(1.0, 0.88, 1.08))
    h.ball(0.115, (-0.02, 0, 0.17), HAIR_DARK, subdiv=1, scale=(1.0, 0.95, 1.0))               # short dark hair
    h.box((0.08, 0.2, 0.09), (-0.05, 0, 0.1), HAIR_DARK)
    for s in (1, -1):
        h.box((0.02, 0.025, 0.025), (0.1, s * 0.04, 0.15), P.INK)
    h.build(body, loc=(0, 0, 0.5))
    for tag, s in (("l", 1), ("r", -1)):
        a = Model(f"mistborn_arm_{tag}", seed=122 + s)
        _limb(a, (0, 0, 0), (0, 0, -0.27), 0.05, 0.04, DARK_LIGHT)
        _limb(a, (0, 0, -0.27), (0.02, 0, -0.5), 0.04, 0.035, DARK)
        a.box((0.06, 0.05, 0.07), (0.02, 0, -0.54), SKIN_PALE)
        a.build(body, loc=(0, s * 0.18, 0.44))
        t = Model(f"mistborn_thigh_{tag}", seed=124 + s)
        _limb(t, (0, 0, 0), (0, 0, -0.4), 0.07, 0.055, DARK)
        thigh = t.build(body, loc=(0, s * 0.075, 0.0))
        k = Model(f"mistborn_shin_{tag}", seed=126 + s)
        _limb(k, (0, 0, 0), (0, 0, -0.36), 0.05, 0.045, DARK)
        k.box((0.17, 0.08, 0.08), (0.03, 0, -0.39), "#1d1a24")                                  # soft boots
        k.build(thigh, loc=(0, 0, -0.4))
    # the mistcloak: ribbons from the shoulders, round the back and down the sides
    for i in range(TASSELS):
        a = (i / (TASSELS - 1) - 0.5) * 2.4                                                    # round the back, side to side
        x, y = -math.cos(a) * 0.12 - 0.02, math.sin(a) * 0.2
        length = 1.0 - abs(i - (TASSELS - 1) / 2) * 0.05
        t = Model(f"mistborn_tassel_{i}", seed=130 + i)
        t.box((0.03, 0.085, length), (0, 0, -length / 2), CLOAK[i % 3], rot=(0, 0, a))
        t.box((0.032, 0.07, 0.08), (0, 0, -length + 0.04), CLOAK[(i + 1) % 3], rot=(0, 0, a))  # a frayed end
        t.build(body, loc=(x, y, 0.5), rot_z=0)


# --- a sperm whale and a bowl of petunias (The Hitchhiker's Guide to the Galaxy) ---------------

WHALE = "#4c4a54"
WHALE_LIGHT = "#62606c"
WHALE_DARK = "#38363f"
WHALE_LIP = "#e2ddd2"
TOOTH = "#f2ece2"


def spermwhale(root):
    """A sperm whale, suddenly called into being a long way above the sea: the great square
    head, a third of it, the narrow lower jaw underneath (`jaw`, hinged at the back, to drop open
    in surprise), little flippers (`flipper_l`/`r`), wrinkled dark grey skin, a hump and knuckles
    along the back, and broad flukes (`fluke`, pivoting at the tail stock)."""
    b = Model("spermwhale_body", seed=140)
    b.ball(1.05, (2.4, 0, 0.1), WHALE, subdiv=2, scale=(1.75, 0.82, 0.98))                    # the head, deep and long
    b.box((1.1, 1.5, 1.75), (3.55, 0, 0.12), WHALE, taper=0.92)                               # squared off at the front
    b.ball(0.78, (3.95, 0, 0.12), WHALE, subdiv=1, scale=(0.5, 0.95, 1.1))
    b.ball(1.0, (0.2, 0, -0.05), WHALE, subdiv=2, scale=(1.9, 0.88, 0.9))                     # the body
    b.ball(0.8, (0.6, 0, -0.45), WHALE_LIGHT, subdiv=1, scale=(2.2, 0.8, 0.5))                # paler underneath
    _limb(b, (-1.3, 0, -0.05), (-4.0, 0, 0.05), 0.82, 0.24, WHALE)                            # the tail stock
    b.prism([(-0.6, 0.0), (-1.2, 0.42), (-1.7, 0.0)], 0.35, (-0.6, 0, 0.78), WHALE_DARK)      # the hump
    for i in range(4):                                                                         # the knuckles down the tail
        b.box((0.28, 0.25, 0.18), (-2.4 - i * 0.45, 0, 0.58 - i * 0.1), WHALE_DARK)
    for i in range(14):                                                                        # wrinkles in the skin
        x = b.rng.uniform(-1.4, 2.8)
        for sd in (1, -1):
            b.box((b.rng.uniform(0.3, 0.7), 0.04, 0.05), (x, sd * (0.8 if x < 1.2 else 0.88), b.rng.uniform(-0.4, 0.4)), WHALE_DARK, rot=(0, b.rng.uniform(-0.2, 0.2), 0))
    for sd in (1, -1):                                                                         # a small eye, low and far back, rather surprised
        b.box((0.16, 0.06, 0.16), (2.05, sd * 0.84, -0.32), WHALE_LIP)
        b.box((0.09, 0.08, 0.1), (2.08, sd * 0.85, -0.32), P.INK)
        b.box((0.04, 0.085, 0.04), (2.1, sd * 0.86, -0.29), "#ffffff")
    body = b.build(root, loc=(0, 0, 0))
    j = Model("spermwhale_jaw", seed=141)                                                     # narrow, white-lipped, toothed
    j.box((2.3, 0.42, 0.22), (1.15, 0, 0), WHALE_LIGHT, taper=0.8)
    j.box((2.25, 0.36, 0.06), (1.15, 0, 0.12), WHALE_LIP)
    for i in range(9):
        for sd in (1, -1):
            j.box((0.06, 0.06, 0.12), (0.4 + i * 0.22, sd * 0.13, 0.2), TOOTH)
    j.build(body, loc=(1.6, 0, -0.78))
    for tag, sd in (("l", 1), ("r", -1)):
        f = Model(f"spermwhale_flipper_{tag}", seed=142 + sd)
        f.ball(0.32, (-0.2, sd * 0.35, 0), WHALE_DARK, subdiv=1, scale=(1.4, 1.5, 0.25))
        f.build(body, loc=(1.6, sd * 0.72, -0.55))
    t = Model("spermwhale_fluke", seed=144)
    t.box((0.6, 0.4, 0.3), (-0.2, 0, 0), WHALE)
    for sd in (1, -1):
        t.prism([(0.1, 0.0), (-0.75, 1.6), (-1.15, 1.45), (-0.7, 0.2)], 0.14, (0, 0, 0), WHALE_DARK, rot=(-sd * math.pi / 2, 0, 0))
    t.build(body, loc=(-4.0, 0, 0.05))


PETUNIAS = ["#8a3fa8", "#c8408a", "#f2ece2", "#6a4fb8", "#d85a9a"]
BOWL = "#f0ebe0"
BOWL_SHADE = "#cfc8b8"


def petunias(root):
    """A bowl of petunias, white china, full: trumpets of purple, magenta and white, each with
    a yellow throat, over a mound of leaves. The flowers (`flowers`) can quiver."""
    b = Model("petunias_bowl", seed=150)
    b.cyl(0.2, 0.26, (0, 0, 0), BOWL, segs=12, r_top=0.36)
    b.cyl(0.38, 0.05, (0, 0, 0.25), BOWL_SHADE, segs=12, r_top=0.37)                          # the rim
    b.cyl(0.16, 0.03, (0, 0, -0.01), BOWL_SHADE, segs=12)                                      # the foot
    b.cyl(0.34, 0.03, (0, 0, 0.27), "#4a3426", segs=12)                                        # the earth
    for k in range(4):                                                                         # a blue band round it
        b.cyl(0.33 + k * 0.0, 0.02, (0, 0, 0.18), "#5a7ab0", segs=12)
    bowl = b.build(root)
    f = Model("petunias_flowers", seed=151)
    for i in range(16):                                                                        # leaves, heaped
        a = f.rng.uniform(0, math.tau)
        r = f.rng.uniform(0.05, 0.32)
        f.ball(0.09, (math.cos(a) * r, math.sin(a) * r, 0.04 + f.rng.uniform(0, 0.1)), "#3f7d43" if i % 2 else "#5a9a4a", subdiv=1, scale=(1.3, 0.8, 0.45), rot=(0, 0, a))
    for i in range(11):                                                                        # the trumpets, facing up and out
        a = i / 11 * math.tau + f.rng.uniform(-0.2, 0.2)
        r = 0.08 + (i % 3) * 0.1
        tilt = 0.25 + r * 1.4
        at = (math.cos(a) * r, math.sin(a) * r, 0.14 + f.rng.uniform(0, 0.08))
        c = PETUNIAS[i % len(PETUNIAS)]
        f.cyl(0.02, 0.1, at, c, segs=5, r_top=0.085, rot=(0, tilt, a))
        f.cyl(0.03, 0.02, (at[0] + math.cos(a) * math.sin(tilt) * 0.09, at[1] + math.sin(a) * math.sin(tilt) * 0.09, at[2] + math.cos(tilt) * 0.09), "#f2d040", segs=5, rot=(0, tilt, a))
    f.build(bowl, loc=(0, 0, 0.27))


ALL = {
    "hippogriff": (hippogriff, 1.0),
    "mistborn": (mistborn, 1.15),
    "spermwhale": (spermwhale, 1.0),
    "petunias": (petunias, 1.7),
}
