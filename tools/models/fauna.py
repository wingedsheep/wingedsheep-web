"""The island's wildlife: one model of each animal, parked out of sight. The runtime
(src/island/scene/fauna.ts) clones them, decides who is out and about (by time of day, season
and luck), and moves them.

Every animal faces +x, y is its left, z = 0 is the ground (or the waterline for swimmers).
Parts that move are their own objects, pivoting where they join the body. A template's root
carries `fauna=<species>` (not an `id`: the runtime gives each clone its id).
"""
from __future__ import annotations

import math

from mathutils import Vector

import fae
import sightings
import palette as P
from kit import Model, group


def _limb(m: Model, a, b, r0, r1, color, segs=5):
    """A tapered round limb from a (radius r0) to b (radius r1)."""
    d = Vector(b) - Vector(a)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r0, d.length, a, color, segs=segs, r_top=r1, rot=tuple(rot))


def _eyes(m: Model, x, spread, z, size=0.03, color=P.INK):
    for s in (1, -1):
        m.box((size, size * 0.6, size), (x, s * spread, z), color)


def _legs(body, name: str, spots, length, r, color, hoof=None):
    """Four legs hanging from (x, y, z) hips, named <name>_leg_fl/fr/bl/br."""
    for tag, (x, y, z) in zip(("fl", "fr", "bl", "br"), spots):
        g = Model(f"{name}_leg_{tag}")
        _limb(g, (0, 0, 0), (0, 0, -length), r, r * 0.7, color)
        if hoof:
            g.box((r * 1.6, r * 1.4, r * 1.2), (0.01, 0, -length + r * 0.5), hoof)
        g.build(body, loc=(x, y, z))


def _wings(body, name: str, at, span, chord, color, tip=None, tip_frac=0.3):
    """Two flat wings pivoting at the shoulders, reaching out along ±y; they flap about x."""
    x, y, z = at
    for side in (1, -1):
        w = Model(f"{name}_wing_{'l' if side > 0 else 'r'}")
        inner = span * (1 - tip_frac) if tip else span
        w.box((chord, inner, 0.03), (0, side * inner / 2, 0), color, taper=1.0)
        if tip:
            w.box((chord * 0.7, span * tip_frac, 0.025), (-chord * 0.12, side * (inner + span * tip_frac / 2), 0), tip)
        w.build(body, loc=(x, side * y, z))


def _template(root_name: str, species: str, scale=1.0):
    root = group(root_name, (0, -200, -20), fauna=species)
    root.scale = (scale,) * 3
    return root


# --- birds -------------------------------------------------------------------------------

def gull(root):
    b = Model("gull_body")
    b.ball(0.13, (0, 0, 0), P.WHITE, subdiv=2, scale=(1.7, 0.85, 0.8))
    b.ball(0.1, (-0.05, 0, 0.05), P.GULL_GREY, subdiv=1, scale=(1.6, 0.9, 0.5))       # grey mantle
    b.box((0.16, 0.12, 0.03), (-0.26, 0, 0.02), P.WHITE, taper=0.6)                    # tail
    b.box((0.05, 0.12, 0.03), (-0.33, 0, 0.02), P.WING_TIP)
    for s in (1, -1):
        b.box((0.025, 0.025, 0.1), (0.0, s * 0.04, -0.13), P.GOLD)                     # legs
    body = b.build(root, loc=(0, 0, 0.18))
    h = Model("gull_head")
    h.ball(0.075, (0.03, 0, 0.02), P.WHITE, subdiv=1, scale=(1.2, 0.9, 0.95))
    h.box((0.1, 0.03, 0.03), (0.14, 0, 0.0), P.GOLD)
    h.box((0.02, 0.031, 0.02), (0.17, 0, -0.012), P.RED)
    _eyes(h, 0.07, 0.045, 0.04, 0.022)
    h.build(body, loc=(0.2, 0, 0.08))
    _wings(body, "gull", (-0.02, 0.07, 0.06), 0.6, 0.2, P.GULL_GREY, tip=P.WING_TIP)


def songbird(root):
    """A robin: brown back, orange breast, and a lot of opinions."""
    b = Model("bird_body")
    b.ball(0.07, (0, 0, 0), P.ROBIN, subdiv=2, scale=(1.3, 0.95, 1.0))
    b.ball(0.06, (0.035, 0, -0.01), P.ROBIN_BREAST, subdiv=1, scale=(1.0, 0.9, 1.0))
    b.ball(0.04, (0.02, 0, -0.045), P.RABBIT_LIGHT, subdiv=1)
    b.box((0.09, 0.045, 0.015), (-0.11, 0, 0.02), P.ROBIN, rot=(0, -0.4, 0))           # cocked tail
    for s in (1, -1):
        b.box((0.012, 0.012, 0.05), (0.0, s * 0.025, -0.08), P.INK)
    body = b.build(root, loc=(0, 0, 0.1))
    h = Model("bird_head")
    h.ball(0.05, (0.02, 0, 0.0), P.ROBIN, subdiv=1)
    h.ball(0.04, (0.04, 0, -0.012), P.ROBIN_BREAST, subdiv=1)
    h.box((0.035, 0.012, 0.012), (0.08, 0, 0.0), P.INK)
    _eyes(h, 0.05, 0.03, 0.015, 0.015)
    h.build(body, loc=(0.07, 0, 0.05))
    _wings(body, "bird", (-0.01, 0.045, 0.03), 0.14, 0.08, P.ROBIN)


def goose(root):
    """A greylag goose, flying (they only pass over, in a V)."""
    b = Model("goose_body")
    b.ball(0.16, (0, 0, 0), P.GOOSE, subdiv=2, scale=(1.8, 0.85, 0.8))
    b.ball(0.1, (-0.1, 0, -0.06), P.HERON_LIGHT, subdiv=1, scale=(1.4, 0.8, 0.6))
    _limb(b, (0.2, 0, 0.02), (0.48, 0, 0.05), 0.05, 0.04, P.GOOSE)                      # neck, straight out
    b.ball(0.06, (0.5, 0, 0.05), P.GOOSE, subdiv=1, scale=(1.3, 0.9, 0.9))
    b.box((0.08, 0.04, 0.035), (0.58, 0, 0.04), P.DUCK_BILL)
    body = b.build(root)
    _wings(body, "goose", (0.02, 0.08, 0.05), 0.7, 0.24, P.GOOSE, tip=P.GOOSE_NECK, tip_frac=0.25)


def owl(root):
    """A tawny owl: round, brown, with a pale face disc and eyes like wet ink."""
    b = Model("owl_body")
    b.ball(0.16, (0, 0, 0.16), P.OWL, subdiv=2, scale=(0.9, 1.0, 1.25))
    b.ball(0.12, (0.06, 0, 0.12), P.OWL_LIGHT, subdiv=1, scale=(0.7, 0.9, 1.2))       # breast
    for z in (0.06, 0.13, 0.2):                                                          # streaks
        b.box((0.02, 0.1, 0.012), (0.145, 0, z), P.OWL)
    b.box((0.08, 0.1, 0.1), (-0.1, 0, -0.02), P.OWL, rot=(0, 0.5, 0))                   # tail
    for s in (1, -1):
        b.box((0.06, 0.03, 0.03), (0.08, s * 0.05, -0.02), P.GOLD)                        # talons
    body = b.build(root, loc=(0, 0, 0.02))
    h = Model("owl_head")
    h.ball(0.13, (0, 0, 0.07), P.OWL, subdiv=2, scale=(0.95, 1.05, 0.9))
    h.ball(0.1, (0.07, 0, 0.06), P.OWL_LIGHT, subdiv=1, scale=(0.5, 1.2, 0.95))      # face disc
    for s in (1, -1):
        h.ball(0.03, (0.115, s * 0.045, 0.075), P.OWL_EYE, subdiv=1)
        h.box((0.012, 0.012, 0.012), (0.14, s * 0.04, 0.085), P.WHITE)                   # glint
    h.box((0.03, 0.02, 0.04), (0.13, 0, 0.035), P.HERON_BILL, taper=0.4, rot=(0, 3.14, 0))
    head = h.build(body, loc=(0.0, 0, 0.34))
    lids = Model("owl_lids")  # closed most of the time by day; the runtime scales them away to open
    for s in (1, -1):
        lids.ball(0.033, (0.117, s * 0.045, 0.075), P.OWL, subdiv=1, scale=(1, 1, 1))
    lids.build(head)
    _wings(body, "owl", (-0.02, 0.13, 0.22), 0.45, 0.22, P.OWL, tip=P.OWL_LIGHT, tip_frac=0.2)


def heron(root):
    """A grey heron: stilts, an S of a neck, a dagger of a bill, and endless patience."""
    b = Model("heron_body")
    b.ball(0.2, (0, 0, 0), P.HERON, subdiv=2, scale=(1.6, 0.8, 0.85))
    b.ball(0.12, (0.18, 0, -0.04), P.HERON_LIGHT, subdiv=1, scale=(1.2, 0.8, 1.0))
    b.box((0.22, 0.2, 0.05), (-0.33, 0, -0.04), P.HERON, rot=(0, 0.25, 0), taper=0.7)
    body = b.build(root, loc=(0, 0, 0.95))
    for s in (1, -1):
        leg = Model(f"heron_leg_{'l' if s > 0 else 'r'}")
        _limb(leg, (0, 0, 0), (0, 0, -0.95), 0.025, 0.018, P.HERON_BILL)
        leg.box((0.16, 0.03, 0.015), (0.04, 0, -0.94), P.HERON_BILL)
        leg.build(body, loc=(0.02, s * 0.07, -0.1))
    n = Model("heron_neck")  # pivots at the shoulders; the runtime folds and strikes with it
    _limb(n, (0, 0, 0), (0.12, 0, 0.22), 0.07, 0.055, P.HERON_LIGHT)
    _limb(n, (0.12, 0, 0.22), (0.08, 0, 0.42), 0.055, 0.05, P.HERON_LIGHT)
    n.ball(0.075, (0.12, 0, 0.47), P.HERON_LIGHT, subdiv=1, scale=(1.3, 0.85, 0.9))
    n.box((0.24, 0.028, 0.04), (0.33, 0, 0.455), P.HERON_BILL)
    n.box((0.16, 0.08, 0.02), (0.02, 0, 0.5), P.INK, rot=(0, -0.3, 0))                  # the black crest
    n.box((0.02, 0.1, 0.04), (0.14, 0, 0.48), P.INK)                                      # eye stripe
    n.build(body, loc=(0.26, 0, 0.08))
    _wings(body, "heron", (0.0, 0.12, 0.08), 0.85, 0.34, P.HERON, tip=P.WING_TIP, tip_frac=0.3)


def duck(root):
    """A mallard drake, bobbing about."""
    b = Model("duck_body")
    b.ball(0.15, (0, 0, 0.06), P.MALLARD_GREY, subdiv=2, scale=(1.55, 0.95, 0.75))
    b.ball(0.1, (0.14, 0, 0.08), P.MALLARD_BROWN, subdiv=1, scale=(1.0, 1.1, 0.9))
    b.ball(0.08, (-0.22, 0, 0.12), P.INK, subdiv=1, scale=(1.0, 0.8, 0.6))
    for s in (1, -1):
        b.box((0.2, 0.02, 0.05), (-0.04, s * 0.13, 0.1), P.MALLARD_BROWN)
        b.box((0.06, 0.021, 0.03), (-0.04, s * 0.13, 0.11), "#3a5ad0")                   # the blue flash
    body = b.build(root)
    h = Model("duck_head")
    h.ball(0.08, (0, 0, 0.0), P.MALLARD_GREEN, subdiv=1, scale=(1.2, 0.9, 1.0))
    h.box((0.11, 0.06, 0.03), (0.1, 0, -0.02), P.DUCK_BILL)
    h.cyl(0.06, 0.02, (0, 0, -0.08), P.WHITE, segs=8)                                    # white collar
    _eyes(h, 0.05, 0.05, 0.02, 0.02)
    h.build(body, loc=(0.2, 0, 0.22))


def duckling(root):
    b = Model("duckling_body")
    b.ball(0.07, (0, 0, 0.03), P.DUCKLING, subdiv=1, scale=(1.3, 1.0, 0.9))
    b.ball(0.05, (-0.03, 0, 0.07), P.DUCKLING_DARK, subdiv=1, scale=(1.3, 1.0, 0.6))
    body = b.build(root)
    h = Model("duckling_head")
    h.ball(0.045, (0, 0, 0), P.DUCKLING, subdiv=1)
    h.box((0.04, 0.03, 0.015), (0.05, 0, -0.01), P.INK)
    h.box((0.02, 0.07, 0.012), (0.01, 0, 0.012), P.DUCKLING_DARK)
    h.build(body, loc=(0.08, 0, 0.1))


def bat(root):
    b = Model("bat_body")
    b.ball(0.05, (0, 0, 0), P.BAT, subdiv=1, scale=(1.4, 0.9, 0.9))
    b.ball(0.035, (0.06, 0, 0.01), P.BAT, subdiv=1)
    for s in (1, -1):
        b.box((0.02, 0.012, 0.04), (0.06, s * 0.02, 0.045), P.BAT, taper=0.2)
    body = b.build(root)
    _wings(body, "bat", (0.0, 0.03, 0.01), 0.18, 0.1, P.BAT)


# --- on the ground ------------------------------------------------------------------------

def rabbit(root):
    b = Model("rabbit_body")
    b.ball(0.13, (0, 0, 0.15), P.RABBIT, subdiv=2, scale=(1.35, 0.95, 0.95))
    b.ball(0.11, (-0.1, 0, 0.12), P.RABBIT, subdiv=1, scale=(1.0, 1.15, 1.0))         # haunches
    b.ball(0.08, (0.1, 0, 0.1), P.RABBIT_LIGHT, subdiv=1, scale=(0.9, 1.0, 1.1))
    b.ball(0.045, (-0.22, 0, 0.18), P.WHITE, subdiv=1)                                    # the white scut
    for s in (1, -1):
        b.box((0.15, 0.05, 0.035), (-0.07, s * 0.08, 0.02), P.RABBIT)                   # hind feet
        b.box((0.04, 0.035, 0.1), (0.13, s * 0.045, 0.05), P.RABBIT_LIGHT)              # fore paws
    body = b.build(root)
    h = Model("rabbit_head")
    h.ball(0.08, (0.04, 0, 0.0), P.RABBIT, subdiv=1, scale=(1.3, 0.95, 0.95))
    h.ball(0.04, (0.11, 0, -0.03), P.RABBIT_LIGHT, subdiv=1)
    h.box((0.02, 0.025, 0.018), (0.145, 0, -0.015), P.CAT_NOSE)
    _eyes(h, 0.08, 0.055, 0.02, 0.028)
    head = h.build(body, loc=(0.15, 0, 0.25))
    for s in (1, -1):
        e = Model(f"rabbit_ear_{'l' if s > 0 else 'r'}")
        e.box((0.055, 0.025, 0.18), (0, 0, 0.09), P.RABBIT, taper=0.7)
        e.box((0.03, 0.026, 0.13), (0.008, 0, 0.08), P.EAR_PINK)
        e.build(head, loc=(0.0, s * 0.035, 0.06)).rotation_euler = (s * 0.15, -0.25, 0)


def deer(root, stag=False):
    """A red deer from the Veluwe, next door to Arnhem. The stag carries a crown of antlers."""
    name = "stag" if stag else "deer"
    b = Model(f"{name}_body")
    b.ball(0.3, (0, 0, 0), P.DEER, subdiv=2, scale=(1.75, 0.78, 0.85))
    b.ball(0.2, (0, 0, -0.1), P.DEER_DARK, subdiv=1, scale=(2.0, 0.8, 0.5))
    b.ball(0.16, (-0.47, 0, 0.04), P.DEER_CREAM, subdiv=1, scale=(0.5, 0.9, 1.0))     # rump patch
    body = b.build(root, loc=(0, 0, 1.0))
    _legs(body, name, ((0.34, 0.12, -0.12), (0.34, -0.12, -0.12), (-0.36, 0.12, -0.1), (-0.36, -0.12, -0.1)),
          0.9, 0.05, P.DEER_DARK, hoof=P.INK)
    t = Model(f"{name}_tail")
    t.box((0.06, 0.06, 0.14), (0, 0, -0.06), P.DEER, rot=(0, 0.3, 0))
    t.build(body, loc=(-0.52, 0, 0.1))
    n = Model(f"{name}_neck")  # pivots at the shoulders: down to graze, up to listen
    _limb(n, (0, 0, 0), (0.2, 0, 0.45), 0.13 if stag else 0.1, 0.08, P.DEER_DARK if stag else P.DEER, segs=6)
    n.ball(0.1, (0.24, 0, 0.5), P.DEER, subdiv=1, scale=(1.3, 0.85, 0.9))                # head
    n.ball(0.065, (0.38, 0, 0.45), P.DEER, subdiv=1, scale=(1.3, 0.85, 0.85))            # muzzle
    n.box((0.05, 0.06, 0.04), (0.45, 0, 0.45), P.INK)
    n.ball(0.05, (0.37, 0, 0.42), P.DEER_CREAM, subdiv=1, scale=(1.0, 0.8, 0.5))
    _eyes(n, 0.3, 0.075, 0.54, 0.035)
    for s in (1, -1):
        n.box((0.05, 0.14, 0.08), (0.17, s * 0.1, 0.63), P.DEER, rot=(s * -0.5, 0, 0), taper=0.6)
    if stag:  # a crown: two beams sweeping back and up, with tines forward
        for s in (1, -1):
            base = Vector((0.2, s * 0.05, 0.6))
            top = base + Vector((-0.15, s * 0.28, 0.5))
            n.plank_line(tuple(base), tuple(top), 0.035, 0.035, P.ANTLER)
            for k, (fx, fz) in enumerate(((0.16, 0.08), (0.14, 0.1), (0.08, 0.14))):
                p = base + (top - base) * (0.3 + k * 0.28)
                n.plank_line(tuple(p), tuple(p + Vector((fx, s * 0.03, fz))), 0.028, 0.028, P.ANTLER)
            n.plank_line(tuple(top), tuple(top + Vector((0.02, s * 0.06, 0.14))), 0.028, 0.028, P.ANTLER)
    n.build(body, loc=(0.42, 0, 0.12))


def fox(root):
    b = Model("fox_body")
    b.ball(0.16, (0, 0, 0), P.FOX, subdiv=2, scale=(1.8, 0.8, 0.8))
    b.ball(0.1, (0.18, 0, -0.06), P.WHITE, subdiv=1, scale=(1.1, 0.8, 0.8))            # white chest
    body = b.build(root, loc=(0, 0, 0.36))
    _legs(body, "fox", ((0.2, 0.08, -0.05), (0.2, -0.08, -0.05), (-0.2, 0.08, -0.05), (-0.2, -0.08, -0.05)),
          0.3, 0.035, P.FOX_DARK)
    h = Model("fox_head")
    h.ball(0.1, (0.03, 0, 0.02), P.FOX, subdiv=1, scale=(1.1, 1.0, 0.9))
    h.box((0.16, 0.08, 0.07), (0.14, 0, -0.01), P.FOX, taper=0.5, rot=(0, math.pi / 2, 0))
    h.box((0.12, 0.07, 0.035), (0.12, 0, -0.04), P.WHITE)
    h.box((0.03, 0.03, 0.03), (0.21, 0, 0.0), P.FOX_DARK)
    _eyes(h, 0.1, 0.05, 0.05, 0.025)
    for s in (1, -1):
        h.cyl(0.05, 0.12, (0.0, s * 0.06, 0.08), P.FOX, segs=3, r_top=0.0)
        h.box((0.02, 0.02, 0.05), (0.01, s * 0.06, 0.1), P.FOX_DARK)
    h.build(body, loc=(0.3, 0, 0.1))
    t = Model("fox_tail")  # the brush, with a white tip
    for i, (x, z, r) in enumerate(((-0.08, 0.0, 0.06), (-0.18, -0.03, 0.08), (-0.29, -0.06, 0.08), (-0.38, -0.08, 0.06))):
        t.ball(r, (x, 0, z), P.WHITE if i == 3 else P.FOX, subdiv=1, scale=(1.4, 0.9, 0.9))
    t.build(body, loc=(-0.25, 0, 0.05))


def hedgehog(root):
    b = Model("hedgehog_body", seed=61)
    b.ball(0.14, (0, 0, 0.1), P.HEDGEHOG_FACE, subdiv=1, scale=(1.3, 1.0, 0.7))
    for i in range(34):  # spines: little cones pointing out and back
        a = b.rng.uniform(0, math.tau)
        up = b.rng.uniform(0.15, 1.0)
        d = Vector((math.cos(a) * math.sqrt(1 - up * up) * 1.2 - 0.25, math.sin(a) * math.sqrt(1 - up * up), up)).normalized()
        p = Vector((0, 0, 0.1)) + Vector((d.x * 0.16, d.y * 0.13, d.z * 0.1))
        rot = Vector((0, 0, 1)).rotation_difference((d + Vector((-0.6, 0, 0))).normalized()).to_euler()
        b.cyl(0.035, 0.1, tuple(p), P.HEDGEHOG_TIP if i % 5 == 0 else P.HEDGEHOG, segs=3, r_top=0.0, rot=tuple(rot))
    body = b.build(root)
    h = Model("hedgehog_head")
    h.ball(0.07, (0.03, 0, 0), P.HEDGEHOG_FACE, subdiv=1, scale=(1.3, 1.0, 0.85))
    h.box((0.09, 0.05, 0.05), (0.11, 0, -0.015), P.HEDGEHOG_FACE, taper=0.5, rot=(0, math.pi / 2, 0))
    h.box((0.025, 0.025, 0.025), (0.16, 0, -0.015), P.INK)
    _eyes(h, 0.07, 0.04, 0.015, 0.02)
    h.build(body, loc=(0.15, 0, 0.07))


def badger(root):
    """A badger: low, broad and grey, with the black-and-white striped face. Comes out at dusk."""
    b = Model("badger_body")
    b.ball(0.2, (0, 0, 0), P.BADGER, subdiv=2, scale=(1.6, 1.0, 0.7))
    b.ball(0.16, (0.02, 0, -0.07), P.BADGER_DARK, subdiv=1, scale=(1.8, 0.95, 0.5))    # dark underside
    b.ball(0.06, (-0.32, 0, 0.02), P.BADGER, subdiv=1, scale=(1.2, 0.8, 0.6))           # stubby tail
    body = b.build(root, loc=(0, 0, 0.19))
    _legs(body, "badger", ((0.18, 0.12, -0.06), (0.18, -0.12, -0.06), (-0.18, 0.12, -0.06), (-0.18, -0.12, -0.06)),
          0.13, 0.06, P.BADGER_DARK)
    h = Model("badger_head")  # the famous stripes: white face, a black band over each eye
    h.ball(0.1, (0.02, 0, 0.0), P.BADGER_WHITE, subdiv=1, scale=(1.2, 1.0, 0.85))
    h.box((0.16, 0.1, 0.07), (0.13, 0, -0.03), P.BADGER_WHITE, taper=0.55, rot=(0, math.pi / 2, 0))
    for s in (1, -1):
        h.box((0.2, 0.035, 0.05), (0.06, s * 0.05, 0.05), P.BADGER_DARK, rot=(0, 0.25, 0))
        h.box((0.04, 0.03, 0.03), (-0.04, s * 0.09, 0.07), P.BADGER_WHITE)             # white-tipped ears
    h.box((0.035, 0.04, 0.03), (0.21, 0, -0.03), P.INK)
    h.build(body, loc=(0.3, 0, 0.02))


def sett(root):
    """The badgers' sett: a mound of dug-out earth with a dark doorway."""
    m = Model("sett", seed=83)
    m.ball(0.9, (0, 0, -0.1), P.SETT, subdiv=2, scale=(1.3, 1.1, 0.7), jitter=0.06)
    m.ball(0.35, (1.05, 0.3, 0.05), P.SETT, subdiv=1, scale=(1.3, 1.0, 0.45), jitter=0.04)  # spoil heap
    m.ball(0.3, (1.0, 0, 0.18), P.INK, subdiv=1, scale=(0.5, 1.0, 0.85))                     # the doorway
    m.build(root)


def squirrel(root):
    """A red squirrel, all tail."""
    b = Model("squirrel_body")
    b.ball(0.08, (0, 0, 0.1), P.SQUIRREL, subdiv=1, scale=(1.4, 0.9, 1.0))
    b.ball(0.05, (0.05, 0, 0.07), P.SQUIRREL_LIGHT, subdiv=1)
    b.ball(0.055, (0.1, 0, 0.17), P.SQUIRREL, subdiv=1, scale=(1.2, 0.9, 0.95))       # head
    _eyes(b, 0.14, 0.035, 0.19, 0.02)
    for s in (1, -1):
        b.cyl(0.02, 0.06, (0.08, s * 0.03, 0.2), P.SQUIRREL, segs=3, r_top=0.0)        # tufted ears
        b.box((0.08, 0.03, 0.025), (-0.03, s * 0.04, 0.02), P.SQUIRREL)
    body = b.build(root)
    t = Model("squirrel_tail")
    for x, z, r in ((-0.05, 0.03, 0.05), (-0.1, 0.1, 0.06), (-0.1, 0.19, 0.065), (-0.05, 0.26, 0.06), (0.0, 0.29, 0.045)):
        t.ball(r, (x, 0, z), P.SQUIRREL, subdiv=1, scale=(1.0, 0.7, 1.0))
    t.build(body, loc=(-0.08, 0, 0.06))


def crab(root):
    b = Model("crab_body")
    b.ball(0.1, (0, 0, 0.06), P.CRAB, subdiv=1, scale=(0.9, 1.3, 0.5))
    for s in (1, -1):
        for k in range(3):
            b.plank_line((-0.04 + k * 0.04, s * 0.1, 0.05), (-0.06 + k * 0.05, s * 0.2, 0.0), 0.02, 0.02, P.CRAB_DARK)
        b.box((0.02, 0.02, 0.05), (0.07, s * 0.035, 0.1), P.INK)                          # eyes on stalks
    body = b.build(root)
    for s in (1, -1):
        c = Model(f"crab_claw_{'l' if s > 0 else 'r'}")
        c.plank_line((0, 0, 0), (0.08, s * 0.03, 0.02), 0.025, 0.025, P.CRAB)
        c.ball(0.04, (0.11, s * 0.035, 0.03), P.CRAB, subdiv=1, scale=(1.4, 0.8, 0.8))
        c.build(body, loc=(0.06, s * 0.09, 0.05))


def sheep(root, name="sheep"):
    """An ordinary sheep, no wings. Grazes, chews, and says so. Now and then the flock has a
    black one, and very rarely a sheep with a star on its back (A Wild Sheep Chase), or one in a
    cape with somewhere to be (Worms' Super Sheep)."""
    black = name == "blacksheep"
    wool, face = (P.BLACK_WOOL, P.INK) if black else (P.WOOL, P.SHEEP_FACE)
    b = Model(f"{name}_body", seed=9 if black else 8)
    for x, y, z, r in [(0, 0, 0, 0.36), (-0.25, 0, 0.03, 0.3), (0.22, 0, 0.05, 0.28), (0, 0.16, 0.12, 0.25),
                       (0, -0.16, 0.12, 0.25), (-0.1, 0, 0.22, 0.24)]:
        b.ball(r, (x, y, z), wool, subdiv=1, jitter=0.025)
    b.ball(0.08, (-0.5, 0, 0.05), wool, subdiv=1)                                        # tail
    if name == "starsheep":  # a faint chestnut star in the wool on its back
        for i in range(5):
            a = math.pi / 2 + i * 2 * math.pi / 5
            b.box((0.15, 0.06, 0.05), (-0.08 + math.cos(a) * 0.07, math.sin(a) * 0.07, 0.425), P.STAR_MARK,
                  rot=(0, 0, a), taper=1.0)
        b.cyl(0.055, 0.05, (-0.08, 0, 0.4), P.STAR_MARK, segs=5)
    body = b.build(root, loc=(0, 0, 0.62))
    if name == "supersheep":  # the cape, pivoting at the shoulders so it can stream out behind
        c = Model("supersheep_cape")
        c.box((0.62, 0.46, 0.025), (-0.31, 0, 0), P.CAPE, taper=1.0)
        c.box((0.08, 0.5, 0.04), (-0.02, 0, 0.0), P.CAPE_DARK)                            # the collar
        c.build(body, loc=(0.24, 0, 0.51)).rotation_euler = (0, -0.1, 0)
    _legs(body, name, ((0.2, 0.12, -0.2), (0.2, -0.12, -0.2), (-0.2, 0.12, -0.2), (-0.2, -0.12, -0.2)),
          0.42, 0.045, face)
    h = Model(f"{name}_head")  # pivots at the neck: down to graze
    h.box((0.26, 0.2, 0.2), (0.13, 0, 0.0), face, rot=(0, 0.35, 0), taper=0.8)
    h.ball(0.11, (0.04, 0, 0.1), wool, subdiv=1)                                          # top knot
    for s in (1, -1):
        h.box((0.06, 0.14, 0.05), (0.04, s * 0.13, 0.04), face, rot=(s * 0.4, 0, 0))
        h.box((0.03, 0.02, 0.03), (0.18, s * 0.07, 0.05), P.WHITE)
    h.build(body, loc=(0.4, 0, 0.12))


def wanderer(root):
    """A small masked wanderer in a red cloak, carrying a needle. Not from around here."""
    b = Model("wanderer_body")
    b.cyl(0.13, 0.32, (0, 0, 0.06), P.CLOAK, segs=6, r_top=0.05)
    b.cyl(0.14, 0.05, (0, 0, 0.05), P.CLOAK_DARK, segs=6, r_top=0.13)
    for s in (1, -1):
        b.box((0.03, 0.03, 0.1), (0, s * 0.05, 0.02), P.INK)                              # thin legs
    body = b.build(root)
    h = Model("wanderer_head")
    h.ball(0.1, (0, 0, 0.05), P.MASK, subdiv=2, scale=(0.85, 0.9, 1.05))
    for s in (1, -1):
        h.box((0.03, 0.035, 0.05), (0.08, s * 0.035, 0.04), P.INK)                         # eye holes
        _limb(h, (-0.01, s * 0.05, 0.12), (-0.03, s * 0.09, 0.26), 0.025, 0.012, P.MASK)  # horns
    h.build(body, loc=(0, 0, 0.36))
    n = Model("wanderer_needle")
    _limb(n, (0, 0, 0), (0.0, 0, 0.42), 0.012, 0.004, P.NEEDLE)
    n.box((0.02, 0.06, 0.02), (0, 0, 0.02), P.INK)
    n.build(body, loc=(0.02, -0.15, 0.08)).rotation_euler = (0.3, -0.5, 0)


def gandalf(root):
    """Gandalf the Grey: long grey robe, a tall hat with a wide, floppy brim, a beard to his belt,
    a gnarled staff in his right hand (-y) and a long pipe. He arrives precisely when he means to.
    The runtime swings the staff (`staff`, pivoting in his hand) and nods the head."""
    b = Model("gandalf_body", seed=3)
    b.cyl(0.36, 1.05, (0, 0, 0.0), P.WIZARD, segs=8, r_top=0.22)                          # robe
    b.cyl(0.37, 0.08, (0, 0, 0.0), P.WIZARD_DARK, segs=8, r_top=0.36)                     # muddy hem
    b.box((0.44, 0.44, 0.42), (0, 0, 1.18), P.WIZARD)                                     # chest
    b.cyl(0.25, 0.07, (0, 0, 0.9), P.WIZARD_DARK, segs=8)                                 # belt
    for s in (1, -1):
        b.box((0.16, 0.12, 0.06), (0.24, s * 0.12, 0.03), P.INK)                           # boots poking out
    # the left arm hangs by his side, a big sleeve; the right comes forward to hold the staff
    b.plank_line((0, 0.27, 1.34), (0.04, 0.3, 0.86), 0.17, 0.17, P.WIZARD)
    b.box((0.1, 0.1, 0.11), (0.05, 0.3, 0.78), P.WIZARD_SKIN)
    b.plank_line((0, -0.27, 1.34), (0.2, -0.32, 1.02), 0.17, 0.17, P.WIZARD)
    b.box((0.12, 0.12, 0.12), (0.26, -0.33, 0.98), P.WIZARD_SKIN)                         # right hand
    b.box((0.24, 0.3, 0.1), (-0.02, 0, 1.42), P.WIZARD_DARK)                              # grey scarf
    body = b.build(root)
    h = Model("gandalf_head")  # pivots at the neck
    h.box((0.36, 0.36, 0.38), (0, 0, 0.19), P.WIZARD_SKIN)
    h.box((0.06, 0.05, 0.08), (0.2, 0, 0.18), P.WIZARD_SKIN)                               # nose
    for s in (1, -1):
        h.box((0.02, 0.06, 0.05), (0.185, s * 0.09, 0.23), P.INK)                          # eyes
        h.box((0.03, 0.11, 0.035), (0.19, s * 0.09, 0.285), P.WIZARD_BEARD)               # bushy brows
        h.box((0.3, 0.05, 0.36), (-0.02, s * 0.2, 0.14), P.WIZARD_BEARD)                  # long hair at the sides
    h.box((0.06, 0.38, 0.4), (-0.19, 0, 0.12), P.WIZARD_BEARD)                            # …and behind
    h.box((0.06, 0.24, 0.05), (0.2, 0, 0.1), P.WIZARD_BEARD)                               # moustache
    h.box((0.14, 0.34, 0.36), (0.22, 0, -0.06), P.WIZARD_BEARD)                           # the beard, down his chest
    h.box((0.12, 0.24, 0.26), (0.26, 0, -0.36), P.WIZARD_BEARD)
    h.box((0.1, 0.12, 0.12), (0.28, 0, -0.54), P.WIZARD_BEARD)
    # the long pipe, from the corner of his mouth, bowl hanging down
    _limb(h, (0.2, -0.08, 0.08), (0.44, -0.2, 0.02), 0.018, 0.018, P.PIPE, segs=4)
    h.cyl(0.035, 0.08, (0.45, -0.2, 0.01), P.PIPE, segs=5)
    # the hat: a wide, floppy brim and a tall cone that bends back at the tip
    h.cyl(0.46, 0.04, (0, 0, 0.38), P.WIZARD_DARK, segs=10, r_top=0.4)
    h.cyl(0.22, 0.4, (-0.02, 0, 0.4), P.WIZARD, segs=8, r_top=0.12)
    _limb(h, (-0.04, 0, 0.78), (-0.2, 0, 1.02), 0.12, 0.02, P.WIZARD, segs=8)
    h.build(body, loc=(0, 0, 1.4))
    st = Model("gandalf_staff")  # a gnarled staff, pivoting in his right hand
    _limb(st, (0, 0, -0.96), (0, 0, 0.6), 0.035, 0.035, P.STAFF, segs=5)
    for i in range(4):  # the knotted head, crooked round
        a = i * 1.4
        st.ball(0.06, (math.cos(a) * 0.05, math.sin(a) * 0.05, 0.62 + i * 0.05), P.STAFF, jitter=0.01)
    st.build(body, loc=(0.27, -0.33, 0.98))


def rocky(root):
    """An engineer from 40 Eridani (Project Hail Mary): a rocky five-sided carapace on five
    jointed legs, each ending in a three-fingered hand. No eyes, no face; talks in chords."""
    b = Model("rocky_body", seed=40)
    b.cyl(0.24, 0.16, (0, 0, -0.08), P.ROCKY, segs=5, r_top=0.19)
    b.cyl(0.19, 0.06, (0, 0, 0.08), P.ROCKY_LIGHT, segs=5, r_top=0.12)
    for i in range(7):  # knobbly, like a rock
        a = b.rng.uniform(0, 2 * math.pi)
        d = b.rng.uniform(0.04, 0.16)
        b.ball(b.rng.uniform(0.035, 0.06), (math.cos(a) * d, math.sin(a) * d, 0.1), b.rng.choice([P.ROCKY, P.ROCKY_DARK]), jitter=0.01)
    b.cyl(0.2, 0.05, (0, 0, -0.12), P.ROCKY_DARK, segs=5, r_top=0.23)                     # underside
    body = b.build(root, loc=(0, 0, 0.34))
    for i in range(5):
        a = i * 2 * math.pi / 5
        leg = Model(f"rocky_leg_{i}")
        knee, foot = (0.2, 0, 0.12), (0.32, 0, -0.29)
        _limb(leg, (0, 0, 0), knee, 0.045, 0.035, P.ROCKY)
        _limb(leg, knee, foot, 0.035, 0.022, P.ROCKY_DARK)
        for f in (-1, 0, 1):  # the three fingers of its hand
            leg.box((0.06, 0.018, 0.018), (0.345 + math.cos(f * 0.8) * 0.02, math.sin(f * 0.8) * 0.03, -0.285), P.ROCKY_DARK,
                    rot=(0, 0, f * 0.8))
        leg.build(body, loc=(math.cos(a) * 0.2, math.sin(a) * 0.2, -0.04), rot_z=a)


# --- in the sea ---------------------------------------------------------------------------

def fish(root):
    b = Model("fish_body")
    b.ball(0.08, (0, 0, 0), P.FISH, subdiv=1, scale=(2.2, 0.6, 0.9))
    b.ball(0.05, (0, 0, 0.035), P.FISH_BACK, subdiv=1, scale=(3.0, 0.5, 0.5))
    _eyes(b, 0.13, 0.03, 0.02, 0.018)
    body = b.build(root)
    t = Model("fish_tail")
    t.box((0.1, 0.02, 0.14), (-0.05, 0, 0), P.FISH_BACK, taper=1.8, rot=(0, math.pi / 2, 0))
    t.build(body, loc=(-0.16, 0, 0))


def dolphin(root):
    b = Model("dolphin_body")
    b.ball(0.3, (0, 0, 0), P.DOLPHIN, subdiv=2, scale=(2.6, 0.75, 0.75))
    b.ball(0.2, (0.1, 0, -0.08), P.DOLPHIN_BELLY, subdiv=1, scale=(3.0, 0.7, 0.55))
    b.ball(0.18, (0.62, 0, 0.04), P.DOLPHIN, subdiv=1, scale=(1.2, 0.9, 0.9))           # melon
    b.box((0.22, 0.1, 0.07), (0.84, 0, -0.03), P.DOLPHIN, taper=0.6)                     # beak
    b.prism([(-0.2, 0), (0.1, 0), (-0.22, 0.32)], 0.05, (0, 0, 0.18), P.DOLPHIN, rot=(0, 0, 0))  # dorsal fin
    for s in (1, -1):
        b.box((0.2, 0.18, 0.03), (0.25, s * 0.22, -0.12), P.DOLPHIN, rot=(s * 0.3, 0, 0.3))
    _eyes(b, 0.7, 0.14, 0.03, 0.035)
    body = b.build(root)
    t = Model("dolphin_tail")
    _limb(t, (0, 0, 0), (-0.45, 0, 0.0), 0.14, 0.05, P.DOLPHIN)
    t.box((0.18, 0.5, 0.03), (-0.5, 0, 0), P.DOLPHIN, taper=0.5)
    t.build(body, loc=(-0.65, 0, 0))


def whale(root):
    """A humpback, mostly underwater. Long white flippers, knobbly head, and a fluke to wave."""
    b = Model("whale_body", seed=77)
    b.ball(1.2, (0, 0, 0), P.WHALE, subdiv=2, scale=(3.0, 0.9, 0.75))
    b.ball(0.9, (0.4, 0, -0.35), P.WHALE_BELLY, subdiv=1, scale=(3.2, 0.9, 0.5))
    b.ball(0.8, (2.8, 0, 0.0), P.WHALE, subdiv=1, scale=(1.6, 0.9, 0.6))                 # head
    for i in range(6):  # tubercles
        b.box((0.14, 0.14, 0.1), (2.6 + i * 0.28, b.rng.uniform(-0.25, 0.25), 0.45 - i * 0.05), P.WHALE)
    b.prism([(-0.4, 0), (0.1, 0), (-0.3, 0.3)], 0.12, (-1.8, 0, 0.6), P.WHALE)            # little dorsal hump
    for s in (1, -1):
        b.box((0.5, 2.4, 0.1), (1.3, s * 1.8, -0.3), P.WHALE_BELLY, rot=(s * 0.25, 0, s * -0.45))
    body = b.build(root)
    t = Model("whale_tail")
    _limb(t, (0, 0, 0), (-2.2, 0, 0.1), 0.7, 0.25, P.WHALE, segs=8)
    for s in (1, -1):  # the flukes, swept back
        t.box((0.9, 1.7, 0.12), (-2.55, s * 0.8, 0.1), P.WHALE, rot=(0, 0, s * 0.45), taper=1.0)
        t.box((0.4, 0.8, 0.13), (-2.6, s * 0.8, 0.1), P.WHALE_BELLY, rot=(0, 0, s * 0.45))
    t.build(body, loc=(-3.2, 0, 0.0))


SERPENT_SEGS = 16
SERPENT_STEP = 1.3   # metres between segments along the spine


def _serpent_radius(i: int) -> float:
    """Thin at the neck, thickest a third of the way down, tapering to the tail."""
    k = i / (SERPENT_SEGS - 1)
    return 0.55 + 0.6 * math.sin(min(1.0, k * 1.6) * math.pi / 2) - max(0.0, k - 0.55) * 1.6


def serpent(root):
    """The sea serpent: a dragon's head, a long body in segments and a crest of red spines.
    Every part hangs straight off the root and faces +x (the head leads), so the runtime can lay
    the segments along whatever curve the spine is making: humps through the waves, or a neck
    reared up out of the sea. `jaw` is the head's child, hinged to open."""
    h = Model("serpent_head", seed=13)
    h.ball(0.7, (0.3, 0, 0.3), P.SERPENT, subdiv=1, scale=(1.2, 0.9, 0.85))                # skull
    h.ball(0.5, (1.55, 0, 0.12), P.SERPENT, subdiv=1, scale=(2.4, 0.95, 0.65))              # long snout
    h.box((1.9, 0.7, 0.06), (1.4, 0, -0.16), P.SERPENT_MOUTH)                               # the roof of the mouth
    for s in (1, -1):
        h.box((0.5, 0.26, 0.14), (0.95, s * 0.38, 0.72), P.SERPENT_DARK, rot=(s * -0.35, 0, -0.15))  # heavy brow
        h.box((0.32, 0.16, 0.22), (0.95, s * 0.44, 0.52), P.SERPENT_EYE, glow=True)        # eyes that glow
        h.box((0.07, 0.17, 0.2), (0.97, s * 0.45, 0.52), P.INK)                           # slit pupil
        h.box((0.12, 0.1, 0.08), (2.45, s * 0.14, 0.24), P.INK)                           # nostrils
        for i in range(6):  # teeth along the upper jaw, pointing down
            h.cyl(0.07, 0.26, (0.75 + i * 0.3, s * (0.36 - i * 0.03), -0.12), P.SERPENT_TOOTH, segs=4, r_top=0.0, rot=(math.pi, 0, 0))
        # swept-back horns, and a fan of red spines behind the jaw
        _limb(h, (0.35, s * 0.3, 0.8), (-0.8, s * 0.6, 1.5), 0.16, 0.02, P.SERPENT_HORN, segs=5)
        for i in range(3):
            _limb(h, (-0.05, s * 0.5, 0.1 + i * 0.22), (-0.8, s * (1.05 + i * 0.1), -0.05 + i * 0.45), 0.08, 0.01, P.SERPENT_FIN, segs=4)
    for i in range(4):  # a ridge of knobs down the snout
        h.box((0.18, 0.16, 0.12), (2.2 - i * 0.35, 0, 0.44 + i * 0.07), P.SERPENT_DARK)
    head = h.build(root)
    j = Model("serpent_jaw")  # hinged at the back of the mouth
    j.ball(0.42, (1.0, 0, -0.12), P.SERPENT_BELLY, subdiv=1, scale=(2.7, 0.85, 0.45))
    j.box((2.0, 0.6, 0.06), (1.0, 0, 0.02), P.SERPENT_MOUTH)
    for s in (1, -1):
        for i in range(5):
            j.cyl(0.06, 0.22, (0.5 + i * 0.32, s * (0.3 - i * 0.025), 0.0), P.SERPENT_TOOTH, segs=4, r_top=0.0)
    j.build(head, loc=(0.35, 0, -0.14))
    for i in range(SERPENT_SEGS):
        r = _serpent_radius(i)
        g = Model(f"serpent_seg_{i:02d}", seed=40 + i)
        g.ball(r, (0, 0, 0), P.SERPENT, subdiv=1, scale=(SERPENT_STEP * 0.95 / r, 1.0, 0.92))
        g.ball(r * 0.85, (0, 0, -r * 0.3), P.SERPENT_BELLY, subdiv=1, scale=(SERPENT_STEP * 0.9 / r, 0.95, 0.75))
        for s in (1, -1):  # a few darker scutes along the flanks
            g.box((r * 0.5, 0.1, r * 0.35), (g.rng.uniform(-0.3, 0.3), s * r * 0.9, r * 0.25), P.SERPENT_DARK, rot=(s * 0.35, 0, 0))
        # a red spine standing up from the crest of the back
        g.prism([(-0.35, 0), (0.25, 0), (-0.45, 0.55 + r * 0.45)], 0.08, (0, 0, r * 0.8), P.SERPENT_FIN)
        g.build(root, loc=(-(i + 0.8) * SERPENT_STEP, 0, 0))
    t = Model("serpent_tail")  # a tall fin, like an eel's
    t.prism([(0.3, 0), (-1.8, 0.9), (-1.2, 0), (-1.8, -0.9)], 0.06, (0, 0, 0), P.SERPENT_FIN)
    t.ball(0.28, (0, 0, 0), P.SERPENT, subdiv=1, scale=(1.8, 1, 1))
    t.build(root, loc=(-(SERPENT_SEGS + 0.6) * SERPENT_STEP, 0, 0))


ALL = {
    "gull": (gull, 1.4), "songbird": (songbird, 1.7), "goose": (goose, 1.4), "owl": (owl, 1.5),
    "heron": (heron, 1.2), "duck": (duck, 1.3), "duckling": (duckling, 1.3), "bat": (bat, 1.8),
    "rabbit": (rabbit, 1.4), "deer": (deer, 1.0), "stag": (lambda r: deer(r, stag=True), 1.05),
    "fox": (fox, 1.25), "badger": (badger, 1.55), "hedgehog": (hedgehog, 1.5), "squirrel": (squirrel, 1.6), "crab": (crab, 1.6),
    "sheep": (sheep, 1.0), "blacksheep": (lambda r: sheep(r, "blacksheep"), 1.0),
    "starsheep": (lambda r: sheep(r, "starsheep"), 1.0), "supersheep": (lambda r: sheep(r, "supersheep"), 1.3),
    "wanderer": (wanderer, 1.3), "rocky": (rocky, 1.6), "gandalf": (gandalf, 1.15),
    "fish": (fish, 1.6), "dolphin": (dolphin, 1.0), "whale": (whale, 1.0),
    "serpent": (serpent, 1.9),
    **fae.ALL,  # the fair folk, and their ring
    **sightings.ALL,  # the balloon, the seal, the ships and the fisherman
}


def populate():
    """One template of every animal, parked under the island."""
    for species, (build, scale) in ALL.items():
        build(_template(f"fauna_{species}", species, scale))


def lineup(spacing=2.4):
    """Every animal in a row on the ground, for a preview render."""
    x = 0.0
    roots = []
    for species, (build, scale) in ALL.items():
        big = {"fairyring": 3.2, "serpent": 16, "whale": 6, "dolphin": 2.4, "heron": 1.4, "deer": 1.8, "stag": 1.8, "balloon": 3, "ferry": 5, "container": 7, "tallship": 5, "seal": 1.4}.get(species, 1.0)
        x += spacing * big / 2
        root = group(f"fauna_{species}", (x, 0, 0), fauna=species)
        root.scale = (scale,) * 3
        build(root)
        roots.append(root)
        x += spacing * big / 2
    return x
