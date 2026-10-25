"""A few more of their days (src/island/scene/routines.ts):

  drawing   Vincent on the grass with his back to the oak by the plaza's south lamp, knees up, his
            sketchbook against them and a pencil in his right hand (`vincent_drawing_stroke`, from
            the shoulder), drawing the robin on a forked stick in front of him
            (`vincent_drawing_robin`, its head `drawing_robin_head`). `vincent_drawing_head` goes
            from the page up to the bird and back.
  ball      Vincent on his feet at the edge of Beike's meadow (`vincent_ball`, the parts are
            characters.vincent_standing's, prefix `ball`), for throwing the ball: the runtime puts
            Beike's ball in his right hand (`ball_arm_r`) and throws it.
  coffee    The two of them on the cats' bench of a morning: him at the free end with a black
            coffee (`bench_cup`, his forearm from the elbow), her next to him with her tea
            (companion.bench_tea), and Charlie curled up on her lap (`companion_bench_charlie`),
            shown in place of the bench's Charlie when he's there.

Everyone faces -y in their own frame; z = 0 is what they're on.
"""
from __future__ import annotations

import math

import cats
import characters
import companion
import layout as L
import palette as P
from kit import Model, group
from mathutils import Vector

# sitting on the grass, back to a tree, knees up: the sketchbook rests against them, held at its
# edge by the left hand, the right drawing (characters._person's joints)
DRAWING = dict(hips=(0, 0.08, 0.16), neck=(0, 0.14, 0.72),
               leg=[(0.12, 0.06, 0.12), (0.14, -0.36, 0.44), (0.13, -0.6, 0.05)],
               arm=[(0.3, 0.12, 0.66), (0.34, -0.08, 0.44), (0.17, -0.32, 0.56)],
               arm_r=[(-0.3, 0.12, 0.66), (-0.3, -0.12, 0.46), (-0.06, -0.33, 0.6)],
               head=((0, 0.14, 0.74), (0.45, 0, 0)))
# where the robin's perch is, in his frame: off to his right, a step in front of his feet (to his
# left there's a bush)
PERCH = (-0.85, -1.1)


def drawing(root):
    """Vincent drawing the robin (see the module notes)."""
    characters._person(root, "vincent_drawing", DRAWING,
                       dict(top=P.V_TOP, sleeve=P.V_TOP, arm=P.V_ARM, thigh=P.V_LEGS, shin=P.V_SHIN, skin=P.SKIN, foot=P.SHOE, wide=1.1),
                       lambda parent, name, loc, rot: characters.head(parent, name, loc, rot=rot))
    # the sketchbook, open against his knees, tipped towards him: the page with the bird coming
    m = Model("vincent_drawing_book")
    m.box((0.44, 0.03, 0.32), (0, 0, 0), P.TENT_GREEN)                                 # the cover
    m.box((0.41, 0.02, 0.29), (0, -0.02, 0.005), P.CANVAS)                             # the page
    for x, z, w, h in ((0.02, 0.03, 0.12, 0.08), (-0.04, 0.06, 0.06, 0.04), (0.07, -0.02, 0.03, 0.05),
                       (-0.11, -0.06, 0.2, 0.015), (0.1, -0.08, 0.12, 0.012)):        # graphite: the bird, and the branch under it
        m.box((w, 0.005, h), (x, -0.032, z), P.SHADES)
    book = m.build(root, loc=(0.02, -0.4, 0.62))
    book.rotation_euler = (-0.55, 0, 0)
    stroke = next(o for o in root.children if o.name.startswith("vincent_drawing_stroke"))
    hand = Vector(DRAWING["arm_r"][2]) - Vector(DRAWING["arm_r"][0])
    p = Model("vincent_drawing_pencil")
    p.plank_line((hand.x - 0.02, hand.y - 0.02, hand.z + 0.08), (hand.x + 0.03, hand.y - 0.06, hand.z - 0.04), 0.02, 0.02, P.GOLD)
    p.build(stroke)
    # the forked stick it's sitting on, pushed into the grass, and the robin
    x, y = PERCH
    b = Model("vincent_drawing_branch")
    b.plank_line((x, y, 0), (x + 0.03, y, 0.55), 0.045, 0.045, P.WOOD)
    b.plank_line((x + 0.02, y, 0.36), (x + 0.16, y + 0.02, 0.5), 0.03, 0.03, P.WOOD)
    b.box((0.06, 0.04, 0.03), (x + 0.17, y + 0.02, 0.51), "#5a8a45")                    # a leaf still on it
    b.build(root)
    r = group("vincent_drawing_robin", (x + 0.03, y, 0.56), rot_z=0.3, parent=root)  # side-on to you, turned a little to him
    r.scale = (1.7,) * 3
    body = Model("drawing_robin_body")
    body.ball(0.07, (0, 0, 0.07), P.ROBIN, subdiv=2, scale=(1.3, 0.95, 1.0))
    body.ball(0.06, (0.035, 0, 0.06), P.ROBIN_BREAST, subdiv=1, scale=(1.0, 0.9, 1.0))
    body.box((0.09, 0.045, 0.015), (-0.11, 0, 0.09), P.ROBIN, rot=(0, -0.4, 0))       # cocked tail
    for s in (1, -1):
        body.box((0.012, 0.012, 0.03), (0.0, s * 0.025, 0.0), P.INK)
    body.build(r)
    h = Model("drawing_robin_head")
    h.ball(0.05, (0.02, 0, 0.0), P.ROBIN, subdiv=1)
    h.ball(0.04, (0.04, 0, -0.012), P.ROBIN_BREAST, subdiv=1)
    h.box((0.035, 0.012, 0.012), (0.08, 0, 0.0), P.INK)
    for s in (1, -1):
        h.box((0.012, 0.01, 0.012), (0.045, s * 0.035, 0.015), P.INK)
    h.build(r, loc=(0.07, 0, 0.12))


def coffee(root):
    """Vincent on the bench (seat at z = 0.56) with his coffee, black: his left hand on his knee,
    the right forearm (`bench_cup`, from the elbow) bringing the mug up now and then."""
    m = Model("vincent_bench_body")
    for x in (-0.16, 0.16):
        m.box((0.21, 0.52, 0.21), (x, -0.24, 0.62), P.V_LEGS)                             # thighs
        m.box((0.16, 0.16, 0.52), (x, -0.5, 0.33), P.V_SHIN)                              # bare shins
        m.box((0.2, 0.34, 0.1), (x, -0.56, 0.05), P.SHOE)
    characters._tee(m, 0.72, root, cape=0.2)
    for s in (-1, 1):
        m.plank_line((s * 0.31, -0.02, 1.3), (s * 0.33, -0.08, 1.16), 0.15, 0.15, P.V_TOP)
        m.plank_line((s * 0.33, -0.08, 1.16), (s * 0.34, -0.14, 1.02), 0.13, 0.13, P.V_ARM)
    m.plank_line((0.34, -0.14, 1.0), (0.2, -0.42, 0.76), 0.11, 0.11, P.V_ARM)              # left forearm, down to his knee
    m.plank_line((0.24, -0.34, 0.82), (0.23, -0.36, 0.8), 0.13, 0.13, P.WATCH)
    m.box((0.11, 0.13, 0.08), (0.18, -0.46, 0.75), P.SKIN)
    m.build(root)
    a = Model("bench_cup")
    a.box((0.12, 0.12, 0.12), (0, 0, 0), P.V_ARM)
    a.plank_line((0, 0, 0), (0.12, -0.34, 0.04), 0.11, 0.11, P.V_ARM)
    a.box((0.11, 0.12, 0.1), (0.13, -0.39, 0.05), P.SKIN)
    a.cyl(0.06, 0.13, (0.15, -0.46, 0.02), P.WHITE, segs=8)                              # his mug
    a.cyl(0.05, 0.005, (0.15, -0.46, 0.152), P.COFFEE, segs=8)
    a.box((0.02, 0.03, 0.07), (0.15, -0.53, 0.08), P.WHITE)                               # its handle
    a.build(root, loc=(-0.34, -0.14, 1.0))
    characters.head(root, "bench_head", (0, 0, 1.45))


# along the bench (its own x), where each of them sits: her in Charlie's place, him at the end
# George doesn't sleep at (models.py puts Charlie at -0.58 and George at 0.2)
SEATS = {"companion": -0.55, "vincent": 0.68}


def populate(t):
    """Everything above, in its place (all of it hidden till the runtime wants it)."""
    x, y = L.DRAWING
    drawing(group("vincent_drawing", (x, y, t.sample(x, y)), rot_z=0.15, id="vincent_drawing"))
    x, y = L.BALL
    characters.vincent_standing(group("vincent_ball", (x, y, t.sample(x, y)), rot_z=2.6, id="vincent_ball"), "ball")
    bx, by = L.BENCH
    c, s = math.cos(0.3), math.sin(0.3)
    z = t.sample(bx, by)                                                               # where the bench stands (models.place)
    seated = {}
    for who, build in (("vincent", coffee), ("companion", companion.bench_tea)):
        along = SEATS[who]
        seated[who] = group(f"{who}_coffee", (bx + c * along - s * 0.04, by + s * along + c * 0.04, z), rot_z=0.3, id=f"{who}_coffee")
        build(seated[who])
    # Charlie, curled up on her lap: on her thighs, a little forward of her hips
    cats.charlie(group("companion_bench_charlie", (0.02, -0.3, 0.72), rot_z=-0.4, parent=seated["companion"]))
