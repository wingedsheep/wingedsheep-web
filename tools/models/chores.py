"""The workshop robot out on the island doing odd jobs (src/island/scene/chores.ts), parked out
of sight while it's indoors:

  robot_about   the robot as it is in the workshop (workshop.py `robot`, every part named `bot_*`),
                without its wrench, and with what each job wants. Each tool is its own part,
                hidden but for the job in hand:
    bot_sack       a paper leaf sack in its left hand, `bot_sack_leaves` showing over the rim as it fills
    bot_broom      a yard broom, held low in its right hand
    bot_shovel     a snow shovel, with a lump of snow on the blade (`bot_snowload`)
    bot_grabber    a litter picker, its catch in the jaws (`bot_grabbed_<i>`), and a
    bot_bucket     bucket on the other arm for it, `bot_bucket_fill` once there's something in it
    bot_can        a watering can, the rose at `bot_spout`
    bot_mower      a push mower in front of it (not in its hands: it stays on the ground), the
                   blades `bot_reel`, going round about their x
    bot_scarf      a scarf, for a cold day

Faces -y; z = 0 is the ground. Tools on an arm hang from its clamp, 0.36 off the ground.
"""
from __future__ import annotations

import math

from mathutils import Vector

import palette as P
import workshop as W
from kit import Model, group

PARKED = (0, 0, -20)
CLAMP = (0, 0, -0.48)        # the two-finger clamp, down the arm from the shoulder
SACK = "#b98a56"             # kraft paper
SACK_DARK = "#8f6437"
LEAVES = ["#c04e30", "#e08a3a", "#d4ae40", "#8c5a3c"]
BRISTLE = "#d9b25f"
SHOVEL = "#4f7fb0"           # a blue plastic snow shovel
GALV = "#9aa3ad"             # a galvanised bucket
CAN = "#4f8f5a"
MOWER = "#c8403a"
SCARF = "#c8403a"
SCARF_STRIPE = "#f2ece2"
CATCH = ["#3b6fd1", "#e8743a", "#d8dde6"]   # a bottle top, a bit of rope, a crisp packet


def rod(m: Model, a, b, r, color, segs=5):
    """A round rod from a to b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r, d.length, tuple(a), color, segs=segs, rot=tuple(rot))


def held(name: str, arm, build):
    """A tool in the clamp at the end of `arm`, hidden till the runtime wants it."""
    g = group(name, CLAMP, parent=arm)
    build(g)
    return g


def sack(g):
    m = Model("bot_sack_paper")
    m.box((0.26, 0.2, 0.3), (0, 0, -0.18), SACK, taper=1.08)
    m.box((0.28, 0.22, 0.04), (0, 0, -0.03), SACK_DARK)             # the rolled-down rim, where it holds it
    m.build(g)
    full = group("bot_sack_leaves", (0, 0, 0), parent=g)
    f = Model("bot_sack_leafy", seed=71)
    for i, (x, y) in enumerate([(-0.07, -0.04), (0.06, 0.03), (0.0, -0.06), (-0.04, 0.06), (0.08, -0.05)]):
        f.box((0.1, 0.08, 0.02), (x, y, 0.01 + (i % 2) * 0.015), LEAVES[i % len(LEAVES)], rot=(0.4 * (i % 3 - 1), 0.3, i * 0.9))
    f.build(full)


def broom(g):
    m = Model("bot_broom_stick")
    tip = (0, -0.55, -0.3)
    rod(m, tip, (0, 0.22, 0.16), 0.02, P.WOOD_LIGHT)
    m.box((0.38, 0.1, 0.07), (0, -0.56, -0.3), P.WOOD)               # the stock
    m.box((0.4, 0.12, 0.06), (0, -0.57, -0.34), BRISTLE)              # bristles, to the ground
    m.build(g)


def shovel(g):
    m = Model("bot_shovel_stick")
    rod(m, (0, -0.42, -0.3), (0, 0.22, 0.12), 0.022, P.WOOD_LIGHT)
    m.box((0.12, 0.05, 0.04), (0, 0.23, 0.13), P.IRON)                # the grip
    m.box((0.34, 0.3, 0.025), (0, -0.56, -0.34), SHOVEL)             # the blade, flat on the ground
    m.box((0.34, 0.025, 0.08), (0, -0.42, -0.3), SHOVEL)             # its back
    for sx in (-1, 1):
        m.box((0.02, 0.3, 0.05), (sx * 0.17, -0.56, -0.32), SHOVEL)
    m.build(g)
    load = group("bot_snowload", (0, -0.56, -0.3), parent=g)
    s = Model("bot_snowlump", seed=72)
    s.ball(0.11, (0, 0, 0), P.SNOW, subdiv=1, scale=(1.3, 1.1, 0.6), jitter=0.015)
    s.build(load)


def grabber(g):
    m = Model("bot_grabber_pole")
    rod(m, (0, -0.32, -0.34), (0, 0.04, 0.1), 0.015, GALV)
    m.box((0.04, 0.1, 0.12), (0, 0.05, 0.06), MOWER)                  # the trigger grip
    for sx in (-1, 1):
        m.box((0.03, 0.06, 0.03), (sx * 0.03, -0.34, -0.35), P.IRON)  # the jaws
    m.build(g)
    for i, c in enumerate(CATCH):
        bit = group(f"bot_grabbed_{i}", (0, -0.35, -0.33), parent=g)
        b = Model(f"bot_catch_{i}")
        if i == 0:
            b.cyl(0.035, 0.015, (0, 0, -0.01), c, segs=6)
        elif i == 1:
            b.box((0.16, 0.025, 0.025), (0, 0, 0), c, rot=(0, 0.5, 0.4))
        else:
            b.box((0.1, 0.02, 0.08), (0, 0, 0), c, rot=(0.3, 0, 0.5))
        b.build(bit)


def bucket(g):
    m = Model("bot_bucket_pail")
    m.cyl(0.11, 0.2, (0, 0, -0.32), GALV, segs=8, r_top=0.13)
    m.cyl(0.1, 0.01, (0, 0, -0.13), P.STONE_DARK, segs=8)             # the inside, looking in
    m.box((0.28, 0.015, 0.015), (0, 0, -0.06), P.IRON)                # the handle, up to the clamp
    for sx in (-1, 1):
        m.box((0.015, 0.015, 0.08), (sx * 0.135, 0, -0.1), P.IRON)
    m.build(g)
    fill = group("bot_bucket_fill", (0, 0, -0.13), parent=g)
    f = Model("bot_bucket_bits")
    for i, (x, y) in enumerate([(-0.04, 0.02), (0.04, -0.03), (0.01, 0.05)]):
        f.box((0.06, 0.05, 0.03), (x, y, 0.01), CATCH[i], rot=(0, 0, i))
    f.build(fill)


def can(g):
    m = Model("bot_can_body")
    m.cyl(0.11, 0.2, (0, 0.02, -0.32), CAN, segs=8)
    m.box((0.03, 0.2, 0.02), (0, 0.02, -0.05), CAN)                   # the handle over the top
    for y in (-0.07, 0.11):
        m.box((0.03, 0.02, 0.08), (0, y, -0.1), CAN)
    rod(m, (0, -0.06, -0.28), (0, -0.33, -0.1), 0.02, CAN)           # the spout
    m.cyl(0.04, 0.03, (0, -0.34, -0.09), W.BRASS, segs=6, rot=(-1.0, 0, 0))   # the rose
    m.build(g)
    group("bot_spout", (0, -0.37, -0.08), parent=g)


def mower(root):
    g = group("bot_mower", (0, 0, 0), parent=root)
    m = Model("bot_mower_frame")
    y = -0.95                                                         # the axle, out in front
    for sx in (-1, 1):
        m.cyl(0.15, 0.04, (sx * 0.23, y, 0.15), P.IRON, segs=8, rot=(0, math.pi / 2, 0))     # wheels
        m.cyl(0.06, 0.05, (sx * 0.24, y, 0.15), MOWER, segs=6, rot=(0, math.pi / 2, 0))
        rod(m, (sx * 0.17, y + 0.02, 0.17), (sx * 0.17, -0.4, 0.57), 0.018, MOWER)          # the handle
    rod(m, (-0.2, -0.4, 0.57), (0.2, -0.4, 0.57), 0.022, P.IRON)                            # its bar, for the hands
    m.box((0.4, 0.06, 0.04), (0, y + 0.22, 0.05), P.IRON)                                     # the roller behind
    m.box((0.42, 0.03, 0.02), (0, y - 0.1, 0.03), W.SILVER)                                  # the bottom blade
    m.build(g)
    reel = group("bot_reel", (0, y, 0.12), parent=g)
    r = Model("bot_reel_blades")
    for i in range(5):
        a = i / 5 * math.tau
        r.box((0.4, 0.012, 0.03), (0, math.cos(a) * 0.08, math.sin(a) * 0.08), W.SILVER, rot=(a, 0, 0))
    r.cyl(0.02, 0.42, (-0.21, 0, 0), P.IRON, segs=5, rot=(0, math.pi / 2, 0))
    r.build(reel)


def scarf(hips):
    g = group("bot_scarf", (0, 0, 0.52), parent=hips)
    m = Model("bot_scarf_wool")
    m.box((0.36, 0.34, 0.07), (0, 0, 0), SCARF)
    m.box((0.37, 0.35, 0.02), (0, 0, 0.0), SCARF_STRIPE)
    m.box((0.09, 0.03, 0.24), (0.1, -0.19, -0.13), SCARF, rot=(0, 0.15, 0))      # the ends, down its front
    m.box((0.09, 0.03, 0.03), (0.11, -0.195, -0.08), SCARF_STRIPE, rot=(0, 0.15, 0))
    m.box((0.08, 0.03, 0.18), (0.0, -0.19, -0.1), SCARF, rot=(0, -0.2, 0))
    m.build(g)


def robot_about():
    import bpy
    root = group("robot_about", PARKED, id="robot_about")
    W.robot(root, "bot_", indoors=False)
    arm_l, arm_r = bpy.data.objects["bot_arm_l"], bpy.data.objects["bot_arm_r"]
    held("bot_sack", arm_l, sack)
    held("bot_bucket", arm_l, bucket)
    held("bot_broom", arm_r, broom)
    held("bot_shovel", arm_r, shovel)
    held("bot_grabber", arm_r, grabber)
    held("bot_can", arm_r, can)
    mower(root)
    scarf(bpy.data.objects["bot_robot_hips"])


def populate(t):
    robot_about()
