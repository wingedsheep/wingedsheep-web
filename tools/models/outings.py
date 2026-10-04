"""Vincent and her out and about, and at the table (src/island/scene/outings.ts, meals.ts):

  vincent_stroll / companion_stroll   each of them on their feet, for a stroll round the island on
                    their own, or the two of them side by side with a mug of glühwein on a cold day.
                    Knees that bend (`*_shin_l/_r` under `*_leg_l/_r`) and a torso that leans
                    (`*_torso`, carrying the arms and the head), so they can crouch to look at a
                    flower or pick up a shell; `*_mug` in the right hand and `*_find_*` (a shell, a
                    leaf, a pebble, a flower) in the left, shown when the runtime wants them.
  vincent_meal / companion_meal       sitting down to eat: on their logs at the campfire, or (the
                    `_hut` ones, hut.py) on the bench at the hut's long table. A dish in front of
                    them for every meal (`*_lap_<dish>`), and in the right hand whatever it's eaten
                    with (`*_hand_<thing>`); the right arm comes up to the mouth from the shoulder
                    (`*_upper_r`) and the elbow (`*_fore_r`), turning about the axes in their `lift`
                    and `bend` properties by up to `lift_angle` and `bend_angle`.
  meal_spread       what's on the go between them: the breakfast board, the pot, the pizza box.

Everyone faces -y; z = 0 is the ground (or the hut's floor).
"""
from __future__ import annotations

import math

import bpy

import characters
import companion
import layout as L
import palette as P
from kit import Model, group
from mathutils import Vector

PARKED = (0, 0, -20)

# the food
YOGHURT = "#f6f2ea"
GRANOLA = "#c8924a"
BERRY = "#7a2a5a"
BREAD = "#d8a860"
CRUST = "#9a6634"
PATE = "#7a5038"
PEANUT = "#c08a44"
EGG = "#f2d65a"
PASTA = "#f0d27a"
SAUCE = "#c8402e"
BASIL = "#4a8a3a"
MISO = "#c99a5a"
MISO_BOWL = "#2a2430"
TOFU = "#f4efe2"
SPRING_ONION = "#6ab04a"
RICE = "#f6f4ee"
CURRY = "#d8902a"
RISOTTO = "#efe2b8"
PEA = "#7ab04a"
PIZZA = "#e8b45a"
TOMATO = "#d0402a"
CHEESE = "#f6e4a0"
BOARD = "#c08a52"
GLUHWEIN = "#5a1424"
MUG = "#b8303a"
STEEL = P.TUNER
CHOPSTICK = "#c8a070"


def _y_up(v: Vector):
    """A direction in Blender's frame as the runtime sees it (glTF is y-up)."""
    v = v.normalized()
    return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]


def _axis_angle(q):
    axis, angle = q.to_axis_angle()
    if angle < 1e-4:
        return [1, 0, 0], 0.0
    return _y_up(axis), round(angle, 4)


# --- on their feet ---------------------------------------------------------------------------

def _mug(parent, name: str, loc):
    """A glühwein mug, steaming (the runtime lets the steam off), handle out to the side."""
    m = Model(name)
    m.cyl(0.055, 0.12, (0, 0, -0.06), MUG, segs=8)
    m.cyl(0.046, 0.005, (0, 0, 0.06), GLUHWEIN, segs=8)
    m.box((0.02, 0.025, 0.07), (0.07, 0, 0.0), MUG)
    m.box((0.03, 0.025, 0.015), (0.06, 0, 0.035), MUG)
    m.box((0.03, 0.025, 0.015), (0.06, 0, -0.035), MUG)
    m.box((0.01, 0.01, 0.05), (-0.02, -0.03, 0.08), "#e8d070")                            # a cinnamon stick
    return m.build(parent, loc=loc)


def _finds(parent, prefix: str, loc):
    """Little things picked up on a walk, one shown at a time in the hand."""
    s = Model(f"{prefix}_find_shell")                                                    # a cockle, pale pink
    s.ball(0.05, (0, 0, 0), "#f2d8d0", subdiv=1, scale=(1, 0.5, 0.8))
    s.box((0.07, 0.03, 0.012), (0, -0.02, 0.02), "#e0b8b0")
    s.build(parent, loc=loc)
    f = Model(f"{prefix}_find_leaf")                                                     # a maple leaf, turned
    f.prism([(0, 0.08), (-0.05, 0.03), (-0.07, 0.04), (-0.04, -0.02), (0, -0.05), (0.04, -0.02), (0.07, 0.04), (0.05, 0.03)],
            0.01, (0, -0.02, 0.02), "#d0602a")
    f.box((0.008, 0.01, 0.06), (0, -0.02, -0.04), "#8a4a2a")
    f.build(parent, loc=loc)
    p = Model(f"{prefix}_find_pebble")                                                   # a smooth flat stone
    p.ball(0.045, (0, 0, 0), "#9aa0a8", subdiv=1, scale=(1.2, 0.5, 0.9))
    p.build(parent, loc=loc)
    w = Model(f"{prefix}_find_flower")                                                   # a daisy
    w.box((0.01, 0.01, 0.12), (0, -0.02, 0.0), P.STALK if hasattr(P, "STALK") else "#4a8a45")
    w.cyl(0.04, 0.012, (0, -0.02, 0.06), P.WHITE, segs=8, rot=(math.pi / 2, 0, 0))
    w.cyl(0.016, 0.016, (0, -0.03, 0.06), P.GOLD, segs=6, rot=(math.pi / 2, 0, 0))
    w.build(parent, loc=loc)
    c = Model(f"{prefix}_find_conker")                                                   # a conker, shiny
    c.ball(0.04, (0, 0, 0), "#6a3218", subdiv=1)
    c.box((0.03, 0.01, 0.03), (0, -0.035, 0.0), "#d8c8a0")
    c.build(parent, loc=loc)


def vincent_walker(root, p: str):
    """Vincent on his feet in his tee, with knees and a waist that bend (see the module notes)."""
    hip = 0.84
    hips = Model(f"{p}_hips")
    hips.box((0.5, 0.3, 0.2), (0, 0, hip + 0.02), P.V_LEGS)
    hips.build(root)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"{p}_leg_{side}")
        g.box((0.2, 0.22, 0.34), (0, 0, -0.17), P.V_LEGS)
        g.box((0.16, 0.16, 0.1), (0, 0, -0.38), P.V_SHIN)
        leg = g.build(root, loc=(s * 0.13, 0, hip))
        k = Model(f"{p}_shin_{side}")
        k.box((0.16, 0.16, 0.34), (0, 0, -0.15), P.V_SHIN)
        k.box((0.2, 0.34, 0.1), (0, -0.05, -0.37), P.SHOE)
        k.box((0.21, 0.35, 0.05), (0, -0.05, -0.415), P.SOLE)
        k.build(leg, loc=(0, 0, -0.42))
    torso = group(f"{p}_torso", (0, 0, hip), parent=root)
    m = Model(f"{p}_body")
    characters._tee(m, -0.12, torso)
    m.build(torso)
    for s, side in ((1, "l"), (-1, "r")):
        a = Model(f"{p}_arm_{side}")
        a.box((0.15, 0.15, 0.22), (0, 0, -0.11), P.V_TOP)
        a.box((0.12, 0.12, 0.36), (0, 0, -0.38), P.V_ARM)
        a.box((0.11, 0.12, 0.1), (0, 0, -0.6), P.SKIN)
        if s > 0:
            a.box((0.13, 0.13, 0.05), (0, 0, -0.5), P.WATCH)
        arm = a.build(torso, loc=(s * 0.34, 0, 0.48))
        if side == "r":
            _mug(arm, f"{p}_mug", (0, -0.07, -0.64))
        else:
            _finds(arm, p, (0, -0.07, -0.66))
    characters.head(torso, f"{p}_head", (0, 0, 0.61))


def companion_walker(root, p: str):
    """Her on her feet, in the same things she sits by the fire in, with knees and a waist that bend."""
    hip = 0.84
    hips = Model(f"{p}_hips")
    hips.box((0.44, 0.28, 0.18), (0, 0.02, hip + 0.02), P.E_LEGS)
    hips.build(root)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"{p}_leg_{side}")
        g.box((0.17, 0.19, 0.42), (0, 0, -0.21), P.E_LEGS)
        leg = g.build(root, loc=(s * 0.11, 0, hip))
        k = Model(f"{p}_shin_{side}")
        k.box((0.16, 0.18, 0.34), (0, 0, -0.15), P.E_LEGS)
        k.box((0.16, 0.28, 0.1), (0, -0.04, -0.37), P.SNEAKER)
        k.box((0.17, 0.29, 0.03), (0, -0.04, -0.405), P.PEBBLE)
        k.build(leg, loc=(0, 0, -0.42))
    torso = group(f"{p}_torso", (0, 0, hip), parent=root)
    up = -0.64                                                                         # companion._top's frame, hips at the torso's pivot
    m = Model(f"{p}_body")
    m.box((0.44, 0.28, 0.56), (0, 0.03, 1.02 + up), P.E_TOP)                          # tee
    m.box((0.16, 0.01, 0.06), (0, -0.112, 1.27 + up), P.FAIR)                         # round neck
    m.box((0.15, 0.15, 0.1), (0, 0.02, 1.33 + up), P.FAIR)                            # neck
    m.build(torso)
    companion.dressing(torso, m.name, up)
    seated = bpy.data.objects.get(f"{m.name}_dress")                                   # that one's a skirt over a lap
    if seated:
        bpy.data.objects.remove(seated, do_unlink=True)
    d = Model(f"{p}_dress")                                                           # the witch's red dress, standing
    d.box((0.5, 0.34, 0.1), (0, 0.02, 0.06), P.WITCH)
    d.box((0.48, 0.31, 0.06), (0, 0.03, 0.13), P.WITCH_BAND)
    d.box((0.62, 0.42, 0.5), (0, 0.02, -0.2), P.WITCH, taper=0.78)
    for i in range(5):
        d.prism([(-0.05, 0.0), (0.05, 0.0), (0, -0.08)], 0.04, (-0.24 + i * 0.12, -0.19, -0.45), P.WITCH_DARK)
    d.build(torso, wear="e_dress")
    for s, side in ((1, "l"), (-1, "r")):
        a = Model(f"{p}_arm_{side}")
        companion._limb(a, (0, 0, 0), (0, 0, -0.18), 0.14, P.E_TOP)
        companion._limb(a, (0, 0, -0.18), (0, 0, -0.52), 0.11, P.E_ARM)
        a.box((0.09, 0.11, 0.11), (0, 0, -0.56), P.FAIR)
        if s < 0:
            a.box((0.12, 0.13, 0.04), (0, 0, -0.46), P.GOLD)                             # a thin gold watch
        arm = a.build(torso, loc=(s * 0.28, 0.03, 0.6))
        if side == "r":
            _mug(arm, f"{p}_mug", (0, -0.07, -0.6))
        else:
            _finds(arm, p, (0, -0.07, -0.62))
    companion.head(torso, f"{p}_head", (0, 0.02, 0.73))


# --- at the table ----------------------------------------------------------------------------

def _plate(m: Model, at, color=P.WHITE, r=0.13):
    x, y, z = at
    m.cyl(r, 0.02, (x, y, z), color, segs=10)
    m.cyl(r * 0.8, 0.005, (x, y, z + 0.02), "#e6ddd0" if color == P.WHITE else color, segs=10)


def _bowl(m: Model, at, color, food, r=0.1):
    x, y, z = at
    m.cyl(r * 0.7, 0.08, (x, y, z), color, segs=10, r_top=r)
    m.cyl(r * 0.92, 0.01, (x, y, z + 0.07), food, segs=10)


def _lap_dishes(parent, prefix: str, at, who: str):
    """Every dish they might have in front of them, each its own part (the runtime shows one)."""
    x, y, z = at
    dishes = {}
    if who == "v":
        for name, filling in (("sandwich_pate", PATE), ("sandwich_pb", PEANUT), ("sandwich_egg", EGG)):
            m = Model(f"{prefix}_lap_{name}")
            _plate(m, (x, y, z))
            for dx, rz in ((-0.04, 0.4), (0.05, -0.3)):                                  # two halves, cut corner to corner
                m.prism([(-0.06, 0), (0.06, 0), (-0.06, 0.11)], 0.025, (x + dx, y, z + 0.035), BREAD, rot=(math.pi / 2, 0, rz))
                m.prism([(-0.05, 0.01), (0.05, 0.01), (-0.05, 0.1)], 0.028, (x + dx, y, z + 0.05), filling, rot=(math.pi / 2, 0, rz))
            dishes[name] = m
    else:
        m = Model(f"{prefix}_lap_yoghurt")
        _bowl(m, (x, y, z), P.TILE_BLUE, YOGHURT)
        for i, (dx, dy) in enumerate(((-0.03, 0.02), (0.03, -0.01), (0.0, 0.04), (-0.02, -0.04))):
            m.box((0.03, 0.03, 0.02), (x + dx, y + dy, z + 0.085), GRANOLA if i % 2 else BERRY)
        dishes["yoghurt"] = m
    m = Model(f"{prefix}_lap_pasta")
    _bowl(m, (x, y, z), P.WHITE, PASTA, r=0.12)
    m.ball(0.05, (x, y, z + 0.08), SAUCE, subdiv=1, scale=(1.2, 1.2, 0.4))
    m.box((0.03, 0.03, 0.01), (x + 0.02, y - 0.02, z + 0.1), BASIL)
    dishes["pasta"] = m
    m = Model(f"{prefix}_lap_miso")
    _bowl(m, (x, y, z), MISO_BOWL, MISO)
    for dx, dy in ((-0.03, 0.0), (0.02, 0.03)):
        m.box((0.03, 0.03, 0.02), (x + dx, y + dy, z + 0.08), TOFU)
    m.box((0.05, 0.02, 0.01), (x + 0.02, y - 0.03, z + 0.08), SPRING_ONION)
    dishes["miso"] = m
    m = Model(f"{prefix}_lap_curry")
    _plate(m, (x, y, z), r=0.14)
    m.ball(0.06, (x - 0.04, y, z + 0.03), RICE, subdiv=1, scale=(1, 1, 0.5))
    m.ball(0.06, (x + 0.045, y, z + 0.03), CURRY, subdiv=1, scale=(1, 1, 0.4))
    dishes["curry"] = m
    m = Model(f"{prefix}_lap_risotto")
    _bowl(m, (x, y, z), P.WHITE, RISOTTO, r=0.12)
    for dx, dy in ((-0.03, 0.02), (0.03, -0.02), (0.01, 0.04)):
        m.box((0.02, 0.02, 0.015), (x + dx, y + dy, z + 0.08), PEA)
    dishes["risotto"] = m
    m = Model(f"{prefix}_lap_pizza")
    _plate(m, (x, y, z), r=0.14)
    for a in (0.3, 1.9):                                                               # two slices left on it
        m.prism([(0, 0), (0.1, 0.04), (0.1, -0.04)], 0.02, (x + math.cos(a) * 0.01, y + math.sin(a) * 0.01, z + 0.03), PIZZA,
                 rot=(math.pi / 2, 0, a))
        m.box((0.03, 0.03, 0.012), (x + math.cos(a) * 0.06, y + math.sin(a) * 0.06, z + 0.045), TOMATO)
    dishes["pizza"] = m
    for m in dishes.values():
        m.build(parent)


def _utensils(parent, prefix: str, hand: Vector):
    """What's in the right hand, built in the forearm's frame round the hand at `hand`."""
    x, y, z = hand
    f = Model(f"{prefix}_hand_fork")
    f.plank_line((x, y + 0.02, z - 0.02), (x + 0.02, y - 0.13, z + 0.04), 0.02, 0.01, STEEL)
    f.build(parent)
    s = Model(f"{prefix}_hand_spoon")
    s.plank_line((x, y + 0.02, z - 0.02), (x + 0.02, y - 0.1, z + 0.03), 0.018, 0.01, STEEL)
    s.ball(0.025, (x + 0.025, y - 0.12, z + 0.035), STEEL, subdiv=1, scale=(1, 1.4, 0.5))
    s.build(parent)
    c = Model(f"{prefix}_hand_chopsticks")
    for dx in (-0.012, 0.012):
        c.plank_line((x + dx, y + 0.04, z), (x + dx * 2, y - 0.16, z + 0.04), 0.012, 0.012, CHOPSTICK)
    c.build(parent)
    p = Model(f"{prefix}_hand_pizza")
    p.prism([(0, 0), (0.13, 0.05), (0.13, -0.05)], 0.02, (x, y - 0.04, z + 0.02), PIZZA, rot=(math.pi / 2, 0, -math.pi / 2))
    p.box((0.03, 0.03, 0.01), (x, y - 0.1, z + 0.035), TOMATO)
    p.box((0.03, 0.03, 0.01), (x + 0.01, y - 0.07, z + 0.035), CHEESE)
    p.build(parent)
    for name, filling in (("sandwich_pate", PATE), ("sandwich_pb", PEANUT), ("sandwich_egg", EGG)):
        w = Model(f"{prefix}_hand_{name}")
        w.prism([(-0.06, 0), (0.06, 0), (-0.06, 0.11)], 0.05, (x, y - 0.06, z + 0.02), BREAD)
        w.prism([(-0.05, 0.01), (0.05, 0.01), (-0.05, 0.1)], 0.055, (x, y - 0.06, z + 0.02), filling)
        w.build(parent)


def _eating_arm(root, prefix: str, shoulder: Vector, elbow: Vector, hand: Vector, mouth: Vector, raised: Vector,
                sleeve, arm, skin, thick=0.12):
    """The right arm, eating: the upper arm from the shoulder and the forearm from the elbow, at
    rest over the dish, and the turns (y-up axis and angle) that bring the hand up to the mouth."""
    u0, u1 = elbow - shoulder, (raised - shoulder).normalized() * (elbow - shoulder).length
    qu = u0.rotation_difference(u1)
    f0 = hand - elbow
    f1 = (mouth - (shoulder + u1)).normalized() * f0.length
    qf = f0.rotation_difference(qu.inverted() @ f1)
    lift, lift_angle = _axis_angle(qu)
    bend, bend_angle = _axis_angle(qf)
    up = Model(f"{prefix}_upper_r")
    up.plank_line((0, 0, 0), u0 * 0.4, thick + 0.03, thick + 0.03, sleeve)
    up.plank_line(u0 * 0.4, u0, thick + 0.01, thick + 0.01, arm)
    upper = up.build(root, loc=shoulder, lift=lift, lift_angle=lift_angle)
    fo = Model(f"{prefix}_fore_r")
    fo.box((thick, thick, thick), (0, 0, 0), arm)
    fo.plank_line((0, 0, 0), f0 * 0.9, thick - 0.01, thick - 0.01, arm)
    fo.box((0.1, 0.11, 0.1), f0, skin)
    fore = fo.build(upper, loc=u0, bend=bend, bend_angle=bend_angle)
    _utensils(fore, prefix, f0)


def vincent_eating(root, prefix: str, seat: float):
    """Him sitting down to eat, on a log or a bench `seat` high: a dish held in his lap in his
    left hand, eating with his right."""
    up = seat - 0.56
    m = Model(f"{prefix}_body")
    for x in (-0.16, 0.16):
        m.box((0.21, 0.52, 0.21), (x, -0.24, 0.62 + up), P.V_LEGS)                        # thighs
        m.box((0.16, 0.16, 0.52 + up), (x, -0.5, (0.52 + up) / 2 + 0.07), P.V_SHIN)
        m.box((0.2, 0.34, 0.1), (x, -0.56, 0.05), P.SHOE)
    characters._tee(m, 0.72 + up, root, cape=0.2)
    dish = Vector((0.04, -0.44, 0.86 + up))
    m.plank_line((0.31, -0.02, 1.3 + up), (0.33, -0.1, 1.05 + up), 0.15, 0.15, P.V_TOP)    # left arm, under the dish
    m.plank_line((0.33, -0.1, 1.05 + up), (0.16, -0.42, 0.86 + up), 0.12, 0.12, P.V_ARM)
    m.box((0.11, 0.12, 0.08), (0.14, -0.44, 0.84 + up), P.SKIN)
    m.build(root)
    _lap_dishes(root, prefix, dish, "v")
    _eating_arm(root, prefix, Vector((-0.31, -0.02, 1.3 + up)), Vector((-0.34, -0.16, 1.03 + up)),
                Vector((-0.08, -0.44, 0.92 + up)), Vector((-0.02, -0.3, 1.52 + up)), Vector((-0.4, -0.34, 1.16 + up)),
                P.V_TOP, P.V_ARM, P.SKIN)
    characters.head(root, f"{prefix}_head", (0, 0, 1.45 + up))


def companion_eating(root, prefix: str, seat: float):
    """Her sitting down to eat, a bowl or plate in her left hand, eating with her right."""
    up = seat - 0.56
    m = Model(f"{prefix}_body")
    companion._seated(m, seat, root)
    dish = Vector((0.03, -0.42, 0.88 + up))
    sh, el = Vector((0.28, 0.03, 1.24 + up)), Vector((0.3, -0.08, 0.98 + up))
    companion._limb(m, sh, sh.lerp(el, 0.35), 0.14, P.E_TOP)
    companion._limb(m, sh.lerp(el, 0.35), el, 0.12, P.E_ARM)
    companion._limb(m, el, (0.13, -0.4, 0.86 + up), 0.11, P.E_ARM)
    m.box((0.09, 0.11, 0.08), (0.12, -0.42, 0.85 + up), P.FAIR)
    m.build(root)
    _lap_dishes(root, prefix, dish, "e")
    _eating_arm(root, prefix, Vector((-0.28, 0.03, 1.24 + up)), Vector((-0.3, -0.1, 0.98 + up)),
                Vector((-0.07, -0.42, 0.93 + up)), Vector((-0.02, -0.28, 1.5 + up)), Vector((-0.36, -0.3, 1.12 + up)),
                P.E_TOP, P.E_ARM, P.FAIR, thick=0.11)
    companion.head(root, f"{prefix}_head", (0, 0.02, 1.37 + up))


def spread(parent, prefix: str, at, rot_z=0.0):
    """What's on the go between them (one shown at a time): the breakfast board, the pasta pot, a
    little Japanese spread with the miso, the curry pot and naan, the risotto pan, the pizza box."""
    g = group(prefix, at, rot_z=rot_z, parent=parent)
    m = Model(f"{prefix}_breakfast")
    m.box((0.42, 0.26, 0.03), (0, 0, 0.015), BOARD)                                    # the bread board
    for i in range(3):
        m.box((0.08, 0.1, 0.06), (-0.13 + i * 0.06, 0.02, 0.06), BREAD if i else CRUST, rot=(0, 0.3, 0))
    for i, c in enumerate((PATE, PEANUT, EGG)):                                        # three jars
        m.cyl(0.035, 0.08, (0.08 + i * 0.075, -0.17, 0), "#e8eef0", segs=8)
        m.cyl(0.03, 0.06, (0.08 + i * 0.075, -0.17, 0.005), c, segs=8)
        m.cyl(0.037, 0.02, (0.08 + i * 0.075, -0.17, 0.08), (P.RED, P.GOLD, "#4a7a3a")[i], segs=8)
    m.cyl(0.05, 0.12, (-0.25, -0.16, 0), "#f2f0ea", segs=8)                            # the yoghurt pot
    m.cyl(0.045, 0.06, (-0.12, -0.2, 0), P.WHITE, segs=8)                              # coffee, and her tea
    m.cyl(0.04, 0.005, (-0.12, -0.2, 0.06), "#4a2a1a", segs=8)
    m.cyl(0.045, 0.06, (0.22, 0.12, 0), P.TILE_BLUE, segs=8)
    m.cyl(0.04, 0.005, (0.22, 0.12, 0.06), "#c08a4a", segs=8)
    m.build(g)
    m = Model(f"{prefix}_pasta")
    m.cyl(0.14, 0.16, (0, 0, 0), "#3a3a42", segs=10)                                   # the pot
    m.cyl(0.13, 0.01, (0, 0, 0.15), PASTA, segs=10)
    m.box((0.06, 0.04, 0.02), (-0.18, 0, 0.12), "#3a3a42")
    m.box((0.08, 0.06, 0.05), (0.25, 0.05, 0.025), CHEESE)                             # parmesan
    m.build(g)
    m = Model(f"{prefix}_miso")
    m.box((0.5, 0.3, 0.02), (0, 0, 0.01), "#5a2a2a")                                   # a lacquer tray
    for dx in (-0.14, 0.0):
        m.cyl(0.05, 0.06, (dx, 0.05, 0.02), P.WHITE, segs=8, r_top=0.065)              # rice
        m.cyl(0.055, 0.01, (dx, 0.05, 0.075), RICE, segs=8)
    m.box((0.12, 0.08, 0.02), (0.14, 0.04, 0.03), P.WHITE)                             # edamame
    for i in range(3):
        m.box((0.025, 0.02, 0.015), (0.1 + i * 0.035, 0.04, 0.045), PEA)
    m.cyl(0.02, 0.1, (0.17, -0.08, 0.02), "#2a1a14", segs=6)                            # soy sauce
    m.cyl(0.01, 0.03, (0.17, -0.08, 0.12), P.RED, segs=6)
    m.build(g)
    m = Model(f"{prefix}_curry")
    m.cyl(0.13, 0.12, (0, 0, 0), "#7a4a2a", segs=10)                                   # the pot
    m.cyl(0.12, 0.01, (0, 0, 0.11), CURRY, segs=10)
    m.box((0.22, 0.14, 0.02), (0.22, 0.02, 0.01), "#e8c890", rot=(0, 0, 0.3))          # naan
    m.box((0.06, 0.05, 0.022), (0.2, 0.0, 0.015), "#b8803a")
    m.build(g)
    m = Model(f"{prefix}_risotto")
    m.cyl(0.16, 0.07, (0, 0, 0), "#3a3a42", segs=10)                                   # the pan
    m.cyl(0.15, 0.01, (0, 0, 0.06), RISOTTO, segs=10)
    m.box((0.22, 0.03, 0.03), (-0.26, 0, 0.05), "#3a3a42")
    m.box((0.06, 0.05, 0.04), (0.22, 0.06, 0.02), CHEESE)
    m.build(g)
    m = Model(f"{prefix}_pizza")
    m.box((0.46, 0.46, 0.03), (0, 0, 0.015), "#d8b888")                                # the box, open
    m.box((0.46, 0.03, 0.4), (0, 0.24, 0.2), "#d8b888", rot=(-0.25, 0, 0))
    m.box((0.2, 0.01, 0.12), (0, 0.22, 0.22), P.RED, rot=(-0.25, 0, 0))
    m.cyl(0.19, 0.02, (0, 0, 0.03), PIZZA, segs=12)
    m.cyl(0.16, 0.005, (0, 0, 0.05), TOMATO, segs=12)
    for a in range(5):
        m.box((0.04, 0.04, 0.01), (math.cos(a * 1.3) * 0.09, math.sin(a * 1.3) * 0.09, 0.057), CHEESE)
    m.prism([(0, 0), (0.19, 0.08), (0.19, -0.08)], 0.04, (0, 0, 0.03), "#d8b888", rot=(math.pi / 2, 0, 0.9))  # two slices gone
    m.build(g)
    return g


# --- a swim ----------------------------------------------------------------------------------

SWIM_SHORTS = "#2f8fb0"                                                              # sea blue, a white stripe down the side
SUIT = "#d0506a"                                                                     # her swimsuit, raspberry
SUIT_DARK = "#a83a52"
TOWEL_V = "#3f8fc0"
TOWEL_E = "#f0b83a"
TOWEL_STRIPE = "#f2ece2"
# their towels on the sand west of the pier (Blender x, y of the middle), the long way up the beach
TOWELS = {"vincent": (-10.6, -15.5), "companion": (-9.3, -15.6)}


def _swim_legs(core, p: str, x: float, thigh, skin, foot=(0.17, 0.28, 0.07)):
    """Legs from the hips (`<p>_leg_l/_r`) with knees (`<p>_shin_l/_r`), bare from the thigh down
    (`thigh`: what covers the top of it, boxes as (size, loc, color), x outwards)."""
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"{p}_leg_{side}")
        for size, (bx, by, bz), color in thigh:
            g.box(size, (s * bx, by, bz), color)
        g.box((0.16, 0.17, 0.3), (0, 0, -0.27), skin)
        leg = g.build(core, loc=(s * x, 0, 0))
        k = Model(f"{p}_shin_{side}")
        k.box((0.15, 0.16, 0.36), (0, 0, -0.17), skin)
        k.box(foot, (0, -0.05, -0.38), skin)                                          # bare feet
        k.build(leg, loc=(0, 0, -0.42))


def vincent_bather(root, p: str):
    """Vincent in his swimming shorts, for a swim on a hot day (swim.ts). Everything hangs off
    `<p>_core` at his hips, which the runtime tips over to swim, or back to lie on his towel."""
    hip = 0.84
    core = group(f"{p}_core", (0, 0, hip), parent=root)
    m = Model(f"{p}_body")
    m.box((0.5, 0.3, 0.22), (0, 0, -0.02), SWIM_SHORTS)
    m.box((0.505, 0.305, 0.035), (0, 0, 0.075), TOWEL_STRIPE)                         # waistband
    m.box((0.54, 0.32, 0.46), (0, 0.02, 0.31), P.SKIN)                                # bare chest (as tall as his tee, vincent_walker)
    m.box((0.2, 0.2, 0.12), (0, 0.0, 0.59), P.SKIN)                                   # neck
    m.build(core)
    _swim_legs(core, p, 0.13, [((0.2, 0.22, 0.24), (0, 0, -0.08), SWIM_SHORTS),
                               ((0.01, 0.06, 0.24), (0.1, 0, -0.08), TOWEL_STRIPE)], P.SKIN)          # a stripe down the outside
    for s, side in ((1, "l"), (-1, "r")):
        a = Model(f"{p}_arm_{side}")
        a.box((0.14, 0.14, 0.58), (0, 0, -0.29), P.SKIN)
        a.box((0.11, 0.12, 0.1), (0, 0, -0.62), P.SKIN)
        a.build(core, loc=(s * 0.34, 0, 0.48))
    characters.head(core, f"{p}_head", (0, 0, 0.61), cap=False)


def companion_bather(root, p: str):
    """Her in a swimsuit, hair tied back, for a swim on a hot day (swim.ts): built like him, round
    `<p>_core` at her hips."""
    hip = 0.84
    core = group(f"{p}_core", (0, 0, hip), parent=root)
    m = Model(f"{p}_body")
    m.box((0.44, 0.26, 0.18), (0, 0, 0.0), SUIT)
    m.box((0.42, 0.25, 0.52), (0, 0, 0.35), SUIT)
    m.box((0.3, 0.255, 0.04), (0, 0, 0.36), SUIT_DARK)                               # a band round the middle
    for s in (-1, 1):
        m.box((0.12, 0.22, 0.08), (s * 0.17, 0, 0.64), P.FAIR)                       # bare shoulders
        m.box((0.07, 0.24, 0.1), (s * 0.1, 0, 0.64), SUIT)                            # straps
    m.box((0.14, 0.14, 0.1), (0, 0, 0.71), P.FAIR)                                    # neck
    m.build(core)
    _swim_legs(core, p, 0.11, [((0.18, 0.2, 0.1), (0, 0, -0.04), SUIT)], P.FAIR, foot=(0.15, 0.26, 0.06))
    for s, side in ((1, "l"), (-1, "r")):
        a = Model(f"{p}_arm_{side}")
        companion._limb(a, (0, 0, 0), (0, 0, -0.56), 0.11, P.FAIR)
        a.box((0.09, 0.11, 0.11), (0, 0, -0.6), P.FAIR)
        a.build(core, loc=(s * 0.28, 0, 0.62))
    companion.head(core, f"{p}_head", (0, 0, 0.76), cap=False, ponytail=True)


def towel(t, name: str, at, color, extras):
    """A towel spread on the sand, following the slope of the beach a strip at a time, and what
    they've brought down with them on it."""
    x, y = at
    z0 = t.sample(x, y)
    g = group(name, (x, y, z0), id=name)
    k = Model(name)
    n = 6
    for i in range(n):                                                               # strips up the beach
        dy = -0.85 + (i + 0.5) * 1.7 / n
        z = t.sample(x, y + dy) - z0
        k.box((0.82, 1.7 / n + 0.01, 0.03), (0, dy, z + 0.015), TOWEL_STRIPE if i in (0, n - 1) else color)
    k.build(g)
    extras(g, lambda dx, dy: t.sample(x + dx, y + dy) - z0)
    return g


def _flipflops(m: Model, x, y, z, color, strap):
    for dx in (-0.07, 0.07):
        m.box((0.1, 0.26, 0.02), (x + dx, y, z + 0.01), color)
        m.box((0.1, 0.03, 0.025), (x + dx, y - 0.04, z + 0.03), strap)                  # the strap, across


def _his_things(g, h):
    m = Model("towel_vincent_things")
    _flipflops(m, 0.62, -0.5, h(0.62, -0.5), "#e8743a", "#a8482a")
    m.cyl(0.04, 0.24, (0.6, 0.45, h(0.6, 0.45)), P.TILE_BLUE, segs=8)                  # a water bottle
    m.cyl(0.028, 0.04, (0.6, 0.45, h(0.6, 0.45) + 0.24), P.WHITE, segs=6)
    m.box((0.36, 0.26, 0.08), (-0.62, 0.3, h(-0.62, 0.3) + 0.04), P.TEE)             # his tee, folded, and the shades on it
    m.box((0.18, 0.04, 0.03), (-0.62, 0.28, h(-0.62, 0.3) + 0.095), P.SHADES)
    m.build(g)


def _her_things(g, h):
    m = Model("towel_companion_things")
    _flipflops(m, -0.62, -0.45, h(-0.62, -0.45), SUIT, SUIT_DARK)
    z = h(0.66, 0.25)
    m.box((0.36, 0.2, 0.3), (0.66, 0.25, z + 0.15), "#e8d6a8", taper=0.85)             # a straw beach bag
    m.box((0.3, 0.02, 0.06), (0.66, 0.145, z + 0.24), SUIT_DARK)
    m.box((0.2, 0.04, 0.26), (0.62, 0.25, z + 0.38), P.TILE_BLUE)                    # her book, sticking out of it
    m.cyl(0.035, 0.16, (0.45, -0.3, h(0.45, -0.3)), P.WHITE, segs=6)                  # suncream
    m.cyl(0.036, 0.04, (0.45, -0.3, h(0.45, -0.3) + 0.16), "#f08a3a", segs=6)
    m.build(g)


def populate(t):
    """The walkers, parked out of sight till they set off; the two of them at the campfire,
    hidden till it's time to eat; and their swimming things and towels for a hot day."""
    vincent_walker(group("vincent_stroll", PARKED, id="vincent_stroll"), "stroll")
    companion_walker(group("companion_stroll", PARKED, id="companion_stroll"), "companion_stroll")
    vincent_bather(group("vincent_swim", PARKED, id="vincent_swim"), "swim")
    companion_bather(group("companion_swim", PARKED, id="companion_swim"), "companion_swim")
    towel(t, "towel_vincent", TOWELS["vincent"], TOWEL_V, _his_things)
    towel(t, "towel_companion", TOWELS["companion"], TOWEL_E, _her_things)
    cx, cy = L.CAMPFIRE
    # on his log on the far side of the fire, and her on the east one (as models.py seats them)
    x, y = cx + 0.2, cy + 2.2
    vincent_eating(group("vincent_meal", (x, y, t.sample(x, y)), rot_z=-0.1, id="vincent_meal"), "meal_v", 0.56)
    x, y = cx + 2.0, cy - 0.4
    companion_eating(group("companion_meal", (x, y, t.sample(x, y)), rot_z=-1.5, id="companion_meal"), "meal_e", 0.56)
    x, y = cx + 0.2 + 0.64, cy + 2.2 - 0.06                                            # on his log, to his left, where it's in sight
    spread(None, "meal_spread", (x, y, t.sample(cx + 0.2, cy + 2.2) + 0.5), rot_z=-0.1)
