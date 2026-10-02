"""Imaginary creatures (src/island/scene/sightings.ts), from the 2022 blog posts where GPT-3 wrote
the field notes and DALL·E painted them: the island's rarest visitors, each with its own weather.

  snorble      a fluffy heap of a thing with a long pink snout, napping in a sunbeam
  balloonbug   a red-orange bug blown up like a hot-air balloon, drifting over on a still afternoon
  fosha        a small blue fox with long ears, sat on the high meadow looking up at the stars
  treestrider  five metres of stilt legs and a leafy back, wading the shallows on a misty morning
  mosslits     little glowing snails in the moss at the wood's edge, their tail-lights curled up

Templates like the wildlife (fauna.py merges ALL into its own): parked under a root tagged
`fauna=<name>`, facing +x, y to their left, z = 0 the ground (the treestrider's the sea's
surface; its feet are in the water). Parts that move are their own objects.
"""
from __future__ import annotations

import math

from mathutils import Vector

import palette as P
from kit import Model

# the snorble's fur "can appear to have multiple colours": peach, with a sheen of lilac and cream
SNORBLE = ["#e8b48c", "#d9a07e", "#c9a0b8", "#f0d2b0"]
SNORBLE_DARK = "#b08068"
SNOUT = "#eeb4b0"
SNOUT_TIP = "#c87878"

BUG = "#e0582c"
BUG_LIGHT = "#f08a3a"
BUG_STRIPE = "#f2c440"
BUG_SPOT = "#3a2228"
BUG_LEG = "#4a3030"

FOSHA = "#6c98ec"
FOSHA_DARK = "#4468c0"
FOSHA_LIGHT = "#c4dcff"
FOSHA_EYE = "#bfe8ff"

STRIDER = "#7a9a3a"
STRIDER_DARK = "#4f6a2a"
STRIDER_LEAF = "#9cc04a"
STRIDER_LEG = "#5a4a32"
STRIDER_EYE = "#f2d040"

SHELL = "#3c6a4a"
SHELL_DARK = "#2a4a36"
GLOW = "#7cffc8"
GLOW_TIP = "#d8fff0"


def _limb(m: Model, a, b, r0, r1, color, segs=5, glow=False):
    """A tapered round limb from a (radius r0) to b (radius r1)."""
    d = Vector(b) - Vector(a)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r0, d.length, a, color, segs=segs, r_top=r1, rot=tuple(rot), glow=glow)


def snorble(root):
    """Curled up asleep: a heap of fluff (`snorble_body`, which breathes), the long snout laid on
    the grass in front (`snorble_head`, which lifts to sniff the air), and a little round ear."""
    b = Model("snorble_body", seed=7)
    b.ball(0.3, (-0.04, 0, 0.24), SNORBLE[0], subdiv=2, scale=(1.35, 1.1, 0.85), jitter=0.02)
    for _ in range(26):  # tufts, in all its colours
        a = b.rng.uniform(0, 2 * math.pi)
        up = b.rng.uniform(0.1, 1.0)
        r = 0.3 * math.sqrt(1 - up * up) + 0.04
        b.ball(b.rng.uniform(0.08, 0.12), (math.cos(a) * r * 1.3 - 0.04, math.sin(a) * r * 1.05, 0.22 + up * 0.2),
               b.rng.choice(SNORBLE), subdiv=2, jitter=0.008)
    b.ball(0.16, (-0.36, 0.12, 0.12), SNORBLE[3], subdiv=1, scale=(1.2, 1.0, 0.8), jitter=0.015)  # the tail curled round
    for s in (1, -1):
        b.ball(0.06, (0.24, s * 0.16, 0.05), SNORBLE_DARK, subdiv=1, scale=(1.4, 1, 0.6))      # front paws, tucked
    body = b.build(root)
    h = Model("snorble_head")  # pivots under the brow, the snout reaching out along +x
    h.ball(0.15, (0.02, 0, 0.0), SNORBLE[3], subdiv=1, scale=(1.2, 1.0, 0.85), jitter=0.01)
    _limb(h, (0.1, 0, -0.03), (0.42, 0, -0.08), 0.075, 0.035, SNOUT, segs=6)
    h.ball(0.04, (0.43, 0, -0.08), SNOUT_TIP, subdiv=1)
    for s in (1, -1):
        h.box((0.05, 0.02, 0.012), (0.1, s * 0.09, 0.04), P.INK, rot=(0, 0.2, 0))           # eyes shut: two dark lines
        h.cyl(0.055, 0.03, (-0.04, s * 0.12, 0.08), SNORBLE[1], segs=7, rot=(s * 1.2, 0, 0))  # a little round ear
        h.cyl(0.032, 0.032, (-0.038, s * 0.125, 0.082), SNOUT, segs=6, rot=(s * 1.2, 0, 0))
    h.build(body, loc=(0.3, 0, 0.16))


def balloonbug(root):
    """Blown up like a balloon (`balloonbug_balloon`: the runtime blows it up and lets it down),
    with its little body hanging underneath and its legs dangling (`balloonbug_legs`)."""
    bal = Model("balloonbug_balloon", seed=3)
    bal.ball(0.36, (0, 0, 0.42), BUG, subdiv=2, scale=(1.0, 1.0, 1.12))
    bal.ball(0.2, (0, 0, 0.12), BUG, subdiv=1, scale=(1.0, 1.0, 0.9))                      # the neck, narrowing
    bal.cyl(0.37, 0.05, (0, 0, 0.4), BUG_STRIPE, segs=12)                                  # its band, round the middle
    bal.cyl(0.33, 0.035, (0, 0, 0.6), BUG_LIGHT, segs=12)
    for i in range(9):  # dark spots, like a ladybird's
        a = i * 2.39
        z = 0.32 + (i % 3) * 0.17
        r = 0.36 * math.sqrt(max(0.0, 1 - ((z - 0.42) / 0.4) ** 2)) + 0.005
        bal.ball(0.035, (math.cos(a) * r, math.sin(a) * r, z), BUG_SPOT, subdiv=1, scale=(1, 1, 0.8))
    bal.ball(0.09, (0.2, 0.12, 0.66), "#f8c8a0", subdiv=1, scale=(1, 1, 0.6))              # a shine
    balloon = bal.build(root, loc=(0, 0, 0.12))
    bd = Model("balloonbug_body")  # under the balloon: a little head and thorax
    bd.ball(0.07, (0, 0, 0), BUG_LEG, subdiv=1, scale=(1.3, 1, 0.9))
    bd.ball(0.05, (0.09, 0, -0.01), BUG_LEG, subdiv=1)
    for s in (1, -1):
        bd.box((0.025, 0.025, 0.025), (0.13, s * 0.03, 0.01), "#f2ece2")                    # eyes
        _limb(bd, (0.11, s * 0.02, 0.03), (0.17, s * 0.06, 0.1), 0.008, 0.006, BUG_LEG, segs=3)  # feelers
    bd.build(balloon, loc=(0, 0, 0.02))
    lg = Model("balloonbug_legs")  # hanging from the thorax, swinging
    for i, x in enumerate((-0.04, 0.0, 0.04)):
        for s in (1, -1):
            _limb(lg, (x, s * 0.04, 0), (x + (i - 1) * 0.03, s * 0.08, -0.16), 0.01, 0.007, BUG_LEG, segs=3)
    lg.build(balloon, loc=(0, 0, -0.02))


def fosha(root):
    """Sitting up on its haunches (`fosha_body`), its head (`fosha_head`) tipped back to the stars,
    long ears (`fosha_ear_l/r`) and a big soft tail (`fosha_tail`) curled round its feet."""
    b = Model("fosha_body", seed=11)
    b.ball(0.16, (-0.04, 0, 0.17), FOSHA, subdiv=2, scale=(1.2, 0.95, 1.0))                # haunches
    b.ball(0.12, (0.04, 0, 0.36), FOSHA, subdiv=2, scale=(0.95, 0.85, 1.25))               # chest, upright
    b.ball(0.08, (0.11, 0, 0.32), FOSHA_LIGHT, subdiv=1, scale=(0.7, 0.9, 1.3))            # a pale ruff
    for s in (1, -1):
        _limb(b, (0.1, s * 0.06, 0.3), (0.13, s * 0.06, 0.02), 0.03, 0.025, FOSHA_DARK)       # front legs, straight
        b.box((0.07, 0.04, 0.03), (0.15, s * 0.06, 0.015), FOSHA_DARK)
        b.ball(0.06, (0.02, s * 0.11, 0.07), FOSHA_DARK, subdiv=1, scale=(1.5, 0.7, 0.7))     # hind feet
    for _ in range(5):  # a few specks of starlight caught in its coat
        a = b.rng.uniform(0, 2 * math.pi)
        b.box((0.018, 0.018, 0.018), (math.cos(a) * 0.12 - 0.03, math.sin(a) * 0.13, b.rng.uniform(0.12, 0.42)), FOSHA_EYE, glow=True)
    body = b.build(root)
    h = Model("fosha_head")  # pivots at the neck
    h.ball(0.1, (0.03, 0, 0.05), FOSHA, subdiv=1, scale=(1.1, 1.0, 0.95))
    h.box((0.13, 0.07, 0.06), (0.13, 0, 0.02), FOSHA, taper=0.5, rot=(0, math.pi / 2, 0))  # the muzzle
    h.box((0.03, 0.03, 0.03), (0.2, 0, 0.03), P.INK)
    for s in (1, -1):
        h.box((0.03, 0.02, 0.035), (0.1, s * 0.055, 0.08), FOSHA_EYE, glow=True)             # eyes full of stars
    head = h.build(body, loc=(0.08, 0, 0.48))
    for s in (1, -1):
        e = Model(f"fosha_ear_{'l' if s > 0 else 'r'}")
        e.box((0.07, 0.025, 0.24), (0, 0, 0.12), FOSHA, taper=0.35)
        e.box((0.04, 0.026, 0.17), (0.01, 0, 0.1), FOSHA_LIGHT, taper=0.4)
        e.build(head, loc=(-0.0, s * 0.055, 0.11)).rotation_euler = (s * 0.3, -0.2, 0)
    t = Model("fosha_tail")  # from the rump, round on the grass
    for i, (x, y, z, r) in enumerate(((-0.06, 0.02, -0.02, 0.06), (-0.1, 0.1, -0.08, 0.075), (-0.02, 0.17, -0.1, 0.075), (0.09, 0.16, -0.11, 0.06))):
        t.ball(r, (x, y, z), FOSHA_LIGHT if i == 3 else FOSHA, subdiv=1, scale=(1.3, 1.0, 0.8))
    t.build(body, loc=(-0.18, 0, 0.13))


def treestrider(root):
    """Five metres tall: a small leafy body slung between four stilt legs (`treestrider_leg_*`,
    each its own object so the runtime can stride them), a long head craning forward
    (`treestrider_head`) and a crest of fronds."""
    H = 4.6  # the body's height above the water
    b = Model("treestrider_body", seed=5)
    b.ball(0.5, (0, 0, 0), STRIDER, subdiv=2, scale=(1.4, 0.95, 0.7), jitter=0.03)
    b.ball(0.38, (-0.15, 0, 0.18), STRIDER_DARK, subdiv=1, scale=(1.3, 0.9, 0.6), jitter=0.03)
    for i in range(9):  # a crown of fronds fanning up and back off its shoulders, like a palm's
        a = (i - 4) * 0.36
        _limb(b, (0.1, 0, 0.25), (-0.45 - math.cos(a) * 0.5, math.sin(a) * 0.9, 0.75 + math.cos(a) * 0.35),
              0.09, 0.02, STRIDER_LEAF if i % 2 else STRIDER, segs=4)
    _limb(b, (-0.6, 0, 0.0), (-1.1, 0, -0.4), 0.12, 0.03, STRIDER_DARK, segs=5)            # a short tail
    body = b.build(root, loc=(0, 0, H))
    h = Model("treestrider_head")  # pivots at the neck; looks down and about
    _limb(h, (0, 0, 0), (0.55, 0, 0.25), 0.13, 0.09, STRIDER, segs=6)
    h.ball(0.17, (0.65, 0, 0.27), STRIDER, subdiv=1, scale=(1.5, 0.85, 0.8))
    _limb(h, (0.8, 0, 0.24), (1.15, 0, 0.12), 0.06, 0.015, STRIDER_DARK, segs=5)           # a long thin snout
    for s in (1, -1):
        h.box((0.07, 0.03, 0.07), (0.74, s * 0.12, 0.33), STRIDER_EYE)
        _limb(h, (0.55, s * 0.08, 0.35), (0.35, s * 0.35, 0.75), 0.04, 0.01, STRIDER_LEAF, segs=4)  # frond "ears"
    h.build(body, loc=(0.6, 0, 0.1))
    # four legs like a harvestman's: up from the hip to a knee well above the back, then a long
    # shin down to the water, the feet spread wide so all four read from the side
    for tag, (fx, fy) in zip(("fl", "fr", "bl", "br"), ((1, 1), (1, -1), (-1, 1), (-1, -1))):
        g = Model(f"treestrider_leg_{tag}")
        knee = (fx * 0.9, fy * 0.9, 1.0)
        foot = (fx * 1.7, fy * 1.3, -H - 0.3)
        _limb(g, (0, 0, 0), knee, 0.08, 0.06, STRIDER_LEG, segs=5)
        g.ball(0.08, knee, STRIDER_DARK, subdiv=1)
        _limb(g, knee, foot, 0.06, 0.03, STRIDER_LEG, segs=5)
        g.build(body, loc=(fx * 0.35, fy * 0.25, 0))


def mosslits(root):
    """Three little snails creeping along together: mossy shells, soft bodies, and long tails curling up to a light
    (`mosslits_light_*`, which glow and pulse). Each snail is its own object: `mosslits_snail_*`."""
    for i, (x, y, turn) in enumerate(((0.0, 0.0, 0.2), (0.2, 0.14, -0.3), (-0.16, 0.2, 0.5))):
        s = Model(f"mosslits_snail_{i}", seed=20 + i)
        s.ball(0.035, (0.02, 0, 0.0), "#a8c8a0", subdiv=1, scale=(2.2, 0.8, 0.6))            # the soft foot
        s.ball(0.045, (-0.005, 0, 0.035), SHELL, subdiv=1, scale=(1.0, 0.8, 1.0), jitter=0.006)
        s.ball(0.028, (-0.01, 0, 0.06), SHELL_DARK, subdiv=1, jitter=0.004)
        for k in range(3):
            s.box((0.014, 0.014, 0.014), (s.rng.uniform(-0.03, 0.02), s.rng.uniform(-0.03, 0.03), 0.06 + k * 0.004), GLOW, glow=True)  # glowing moss
        s.box((0.008, 0.008, 0.03), (0.07, 0.01, 0.025), "#a8c8a0")                            # eye stalks
        s.box((0.008, 0.008, 0.03), (0.07, -0.01, 0.025), "#a8c8a0")
        # the tail, curling up and over in a hook, a light at its tip
        pts = [(-0.06, 0, 0.0), (-0.1, 0, 0.04), (-0.11, 0, 0.1), (-0.08, 0, 0.14), (-0.04, 0, 0.13)]
        for (a, c) in zip(pts, pts[1:]):
            _limb(s, a, c, 0.012, 0.009, GLOW, segs=4, glow=True)
        snail = s.build(root, loc=(x, y, 0), rot_z=turn)
        lt = Model(f"mosslits_light_{i}")
        lt.ball(0.022, (0, 0, 0), GLOW_TIP, subdiv=1, glow=True)
        lt.build(snail, loc=(-0.04, 0, 0.13))


ALL = {
    "snorble": (snorble, 1.3),
    "balloonbug": (balloonbug, 2.4),
    "fosha": (fosha, 2.2),
    "treestrider": (treestrider, 1.4),
    "mosslits": (mosslits, 4.5),
}
