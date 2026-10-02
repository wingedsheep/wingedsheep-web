"""Halloween's monsters (src/island/scene/monsters.ts), out only in the last week of October, and
only now and then after dark:

  horseman  the Headless Horseman: a black horse with red eyes, a rider in a cloak with nothing
            above the collar, a lit jack-o'-lantern held up in his right hand. Now and then he
            gallops a lap of the island, out from behind the mountain and back.
  tallone   something very tall from the eastern woods: legs like stilts, arms down to its knees,
            a pale bony face, and antlers of bare branches curling at the tips. It steps out
            behind the campfire, looks, and steps back.

Templates like the wildlife (fauna.py merges ALL into its own): facing +x, y to their left, z = 0
the ground. The parts the runtime moves are their own objects, named `<species>_<part>`.
"""
from __future__ import annotations

import math

import palette as P
from holidays import jack
from kit import Model

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
        _limb(a, (0.15, 0, -1.4), (0.35, 0, -2.6), 0.11, GAUNT_LIGHT)
        for f in range(4):                                                                # long fingers
            _limb(a, (0.35, 0, -2.6), (0.42 + f * 0.04, (f - 1.5) * 0.06, -3.2 - (f % 2) * 0.1), 0.03, GAUNT_LIGHT)
        a.build(body, loc=(0.1, s * 0.42, 5.6))
        g = Model(f"tallone_leg_{side}")                                                  # from the hip: stilts, a knot at the knee
        _limb(g, (0, 0, 0), (0.05, 0, -1.7), 0.18, GAUNT)
        g.ball(0.14, (0.05, 0, -1.7), GAUNT_LIGHT, subdiv=1)
        _limb(g, (0.05, 0, -1.7), (0, 0, -3.4), 0.13, GAUNT_LIGHT)
        g.box((0.4, 0.14, 0.08), (0.12, 0, -3.44), GAUNT)                                  # a long splayed foot
        g.build(body, loc=(0, s * 0.18, 3.48))


ALL = {
    "horseman": (horseman, 1.0),
    "tallone": (tallone, 1.0),
}
