"""The two of them out in the snow (src/island/scene/snowplay.ts):

  snowman           built by the plaza on a snowy day: `snowman_base`, `snowman_middle` and
                    `snowman_head`, each a ball with its centre at its origin so the runtime can
                    roll it across the snow (and grow it as it goes) before stacking it. On the
                    middle `snowman_arms` (two sticks), `snowman_buttons` and `snowman_scarf`; on
                    the head `snowman_face` (coal eyes and a smile) and `snowman_nose` (a carrot),
                    each shown as it goes on. Faces -y, like everyone.
  *_snowball        one in each walker's right hand (outings.py's `vincent_stroll` and
                    `companion_stroll`), shown while there's one to throw.
  snowball_v / _e   the ones in the air, parked out of sight under `snowballs` (at the origin,
                    so their positions are the world's).
"""
from __future__ import annotations

import math

import bpy

import palette as P
from kit import Model, group

SNOWMAN = (-2.5, -10.7)          # on the snowy plaza, west of the path down to the pier
PARKED = (0, 0, -20)

# the snowman's balls: radius, and the height of the centre once stacked (each settles a
# little into the one below)
BASE = (0.42, 0.36)
MIDDLE = (0.3, 0.36 + 0.42 * 0.8 + 0.3 * 0.8)
HEAD = (0.21, MIDDLE[1] + 0.3 * 0.82 + 0.21 * 0.85)

COAL = "#26232a"
CARROT = "#e8782a"
STICK = "#6a4a32"
SCARF = P.RED
SCARF_STRIPE = "#f2ece2"


def _ball(name: str, r: float, parent, z: float, subdiv=2):
    m = Model(name)
    m.ball(r, (0, 0, 0), P.SNOW, subdiv=subdiv)
    return m.build(parent, loc=(0, 0, z))


def snowman(parent):
    base = _ball("snowman_base", BASE[0], parent, BASE[1])
    base["snow_r"] = BASE[0]

    middle = _ball("snowman_middle", MIDDLE[0], parent, MIDDLE[1])
    middle["snow_r"] = MIDDLE[0]
    r = MIDDLE[0]
    b = Model("snowman_buttons")
    for z in (0.13, 0.02, -0.09):
        y = -math.sqrt(max(0.0, r * r - z * z)) - 0.005
        b.box((0.05, 0.03, 0.05), (0, y, z), COAL)
    b.build(middle)
    a = Model("snowman_arms")
    for s in (1, -1):                                                                  # two forked sticks, up a bit
        a.plank_line((s * 0.24, 0, 0.05), (s * 0.62, 0, 0.3), 0.035, 0.035, STICK)
        a.plank_line((s * 0.5, 0, 0.22), (s * 0.58, 0, 0.42), 0.03, 0.03, STICK)
        a.plank_line((s * 0.55, 0, 0.27), (s * 0.7, 0, 0.28), 0.03, 0.03, STICK)
    a.build(middle)
    sc = Model("snowman_scarf")                                                         # a woolly scarf, the end hanging down the front
    sc.cyl(0.21, 0.09, (0, 0, 0.2), SCARF, segs=10)
    sc.box((0.1, 0.04, 0.24), (0.1, -0.29, 0.1), SCARF, rot=(-0.3, 0, 0.1))
    sc.box((0.1, 0.045, 0.03), (0.1, -0.295, 0.08), SCARF_STRIPE, rot=(-0.3, 0, 0.1))
    sc.box((0.1, 0.045, 0.03), (0.106, -0.268, 0.0), SCARF_STRIPE, rot=(-0.3, 0, 0.1))
    sc.build(middle)

    head = _ball("snowman_head", HEAD[0], parent, HEAD[1], subdiv=1)
    head["snow_r"] = HEAD[0]
    r = HEAD[0]
    f = Model("snowman_face")
    for s in (1, -1):
        f.box((0.045, 0.03, 0.045), (s * 0.07, -r * 0.9, 0.06), COAL)                 # coal eyes
    for i in range(5):                                                                 # and a smile of little stones
        a = (i - 2) * 0.35
        f.box((0.03, 0.03, 0.03), (math.sin(a) * 0.09, -r * 0.93, -0.06 - math.cos(a) * 0.035 + 0.035), COAL)
    f.build(head)
    n = Model("snowman_nose")
    n.cyl(0.035, 0.16, (0, -r * 0.92, 0.0), CARROT, segs=6, r_top=0.004, rot=(math.pi / 2, 0, 0))
    n.build(head)


def snowballs():
    """The ones in the air, one each."""
    g = group("snowballs", (0, 0, 0))
    for who in ("v", "e"):
        m = Model(f"snowball_{who}")
        m.ball(0.08, (0, 0, 0), P.SNOW, subdiv=1)
        m.build(g, loc=PARKED)


def in_hand(arm_name: str, name: str, loc):
    arm = bpy.data.objects.get(arm_name)
    if not arm:
        return
    m = Model(name)
    m.ball(0.075, (0, 0, 0), P.SNOW, subdiv=1)
    m.build(arm, loc=loc)


def populate(t):
    """The snowman, hidden till it's built; a snowball for each of their right hands (after
    outings.populate has made them), and the two in the air."""
    x, y = SNOWMAN
    snowman(group("snowman", (x, y, t.sample(x, y)), id="snowman"))
    snowballs()
    in_hand("stroll_arm_r", "stroll_snowball", (0, -0.07, -0.66))
    in_hand("companion_stroll_arm_r", "companion_stroll_snowball", (0, -0.07, -0.63))
