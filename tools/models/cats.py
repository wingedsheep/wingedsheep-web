"""Charlie and George, Vincent's cats: white with ginger patches, asleep on a fleece on the bench.

George is the big one, sprawled out, one front paw stretched and the tail hanging off the edge.
Charlie is the slim one, curled into a tight ball beside him. Each cat's frame: x runs along
the bench towards George's head, -y faces the front of the bench, z = 0 is the top of the fleece.

The animation is keyframed here and exported as glTF clips: "<cat>_idle" loops (breathing, ear
flicks, a lazy tail), "<cat>_pet" plays once when someone clicks the cat.
"""
from __future__ import annotations

from mathutils import Vector

import palette as P
from kit import Model, animate


def _limb(m: Model, a, b, r0, r1, color, segs=6):
    """A tapered round limb or tail from a (radius r0) to b (radius r1), with a rounded end."""
    d = Vector(b) - Vector(a)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r0, d.length, a, color, segs=segs, r_top=r1, rot=tuple(rot))
    m.ball(r1, b, color, subdiv=1)


def _face(h: Model, c, cap, blaze_top, nose_smudge=False):
    """Shared face details on a head centred at c: closed eyes, white blaze, muzzle, pink nose."""
    x, y, z = c
    h.ball(cap[0], (x, y + cap[1], z + cap[2]), P.GINGER, subdiv=2, scale=(1.1, 1.0, 0.85))  # ginger cap
    h.ball(0.05, (x, y - 0.1, z + blaze_top), P.CAT_WHITE, subdiv=1, scale=(0.45, 0.6, 1.3), rot=(-0.5, 0, 0))  # blaze
    h.ball(0.062, (x, y - 0.11, z - 0.045), P.CAT_WHITE, subdiv=1, scale=(1.35, 0.8, 0.8))   # muzzle
    if nose_smudge:  # George has a ginger smudge under the nose
        h.ball(0.04, (x, y - 0.155, z - 0.05), P.GINGER, subdiv=1, scale=(1.2, 0.5, 0.9))
    h.box((0.036, 0.02, 0.026), (x, y - 0.165, z - 0.015), P.CAT_NOSE)
    for dx in (-0.05, 0.05):  # eyes shut, slanting down at the corners
        h.box((0.055, 0.02, 0.014), (x + dx, y - 0.128, z + 0.018), P.INK, rot=(0, -dx * 4, 0))


def _ears(head, name: str, at, spread: float, size: float, tilt=0.3):
    """Two pointy ears (left, right; separate parts so they can flick), pivoting at their base."""
    ears = []
    for side in (1, -1):  # left, right
        e = Model(f"{name}_ear_{'l' if side > 0 else 'r'}")
        e.cyl(size, size * 1.7, (0, 0, 0), P.GINGER, segs=4, r_top=0.0, rot=(0, 0, 0.785))
        e.cyl(size * 0.6, size * 1.2, (0, -size * 0.45, 0.0), P.EAR_PINK, segs=3, r_top=0.0, rot=(0, 0, 3.14))
        obj = e.build(head, loc=(at[0] + side * spread, at[1], at[2]))
        obj.rotation_euler = (0.15, side * tilt, 0)
        ears.append(obj)
    return ears


def george(root):
    """The big one, sprawled on one side, belly to the front, head resting on the fleece."""
    b = Model("george_body")
    b.ball(0.22, (0, 0, 0.17), P.CAT_WHITE, subdiv=2, scale=(1.9, 1.0, 0.78))
    b.ball(0.2, (-0.02, 0.09, 0.2), P.GINGER, subdiv=2, scale=(1.35, 0.8, 0.75))     # ginger saddle
    b.ball(0.14, (-0.34, 0.03, 0.18), P.GINGER, subdiv=2, scale=(1.0, 1.25, 1.05))   # rump
    b.ball(0.17, (0.3, -0.01, 0.17), P.CAT_WHITE, subdiv=2, scale=(1.0, 1.1, 0.95))  # shoulders
    # hind leg dangling over the front edge: ginger thigh, white foot
    b.ball(0.11, (-0.27, -0.13, 0.1), P.GINGER, subdiv=1, scale=(1.3, 1.0, 0.9))
    _limb(b, (-0.25, -0.18, 0.07), (-0.2, -0.3, -0.12), 0.05, 0.042, P.GINGER)
    b.ball(0.048, (-0.2, -0.32, -0.17), P.CAT_WHITE, subdiv=1, scale=(1.0, 1.3, 0.8))
    body = b.build(root)

    h = Model("george_head")
    _face(h, (0.09, -0.05, -0.02), (0.14, 0.02, 0.07), 0.085, nose_smudge=True)
    h.ball(0.15, (0.09, -0.05, -0.02), P.CAT_WHITE, subdiv=2, scale=(1.05, 0.95, 0.88))
    for dx in (-0.1, 0.1):
        h.ball(0.05, (0.09 + dx, -0.1, -0.06), P.CAT_WHITE, subdiv=1)                  # chubby cheeks
    head = h.build(root, loc=(0.46, -0.04, 0.14))
    ear_l, ear_r = _ears(head, "george", (0.09, -0.02, 0.1), 0.085, 0.055)

    # the front leg stretched out towards the edge (pivots at the shoulder)
    p = Model("george_paw")
    _limb(p, (0, 0, 0), (0.4, -0.1, -0.02), 0.048, 0.04, P.CAT_WHITE)
    p.ball(0.046, (0.12, -0.03, 0.0), P.GINGER, subdiv=1, scale=(1.4, 1.0, 1.0))       # patch at the elbow
    p.ball(0.052, (0.43, -0.11, -0.025), P.CAT_WHITE, subdiv=2, scale=(1.35, 1.1, 0.7))
    paw = p.build(root, loc=(0.34, -0.15, 0.06))

    # the tail lies across the fleece, then hangs off the edge
    t = Model("george_tail")
    _limb(t, (0, 0, 0), (0.02, -0.17, -0.08), 0.042, 0.037, P.GINGER)
    tail = t.build(root, loc=(-0.42, -0.06, 0.1))
    tt = Model("george_tail_tip")
    _limb(tt, (0, 0, 0), (0.02, -0.07, -0.22), 0.037, 0.03, P.GINGER)
    tt.ball(0.032, (0.02, -0.07, -0.22), P.GINGER_DARK, subdiv=1)
    tip = tt.build(tail, loc=(0.02, -0.17, -0.08))

    # idle, 8 s: two slow breaths, an ear flick each side, a lazy tail, one little knead
    animate(body, "george_idle", "scale", [(s, (0, 0.02 * (i % 2), 0.045 * (i % 2))) for i, s in enumerate((0, 2, 4, 6, 8))])
    animate(head, "george_idle", "rotation_euler", [(0, 0), (4, 0), (4.8, (0, 0, 0.07)), (6.2, (0, 0, 0.07)), (7.2, 0), (8, 0)])
    for ear, at in ((ear_l, 2.4), (ear_r, 6.1)):
        animate(ear, "george_idle", "rotation_euler",
                [(0, 0), (at, 0), (at + 0.1, (0, 0.5, 0)), (at + 0.22, 0), (at + 0.32, (0, 0.35, 0)), (at + 0.5, 0), (8, 0)])
    animate(tail, "george_idle", "rotation_euler", [(0, 0), (4, (0, 0.08, 0)), (8, 0)])
    animate(tip, "george_idle", "rotation_euler",
            [(0, 0), (1.5, (0, 0.25, 0)), (3, 0), (4.2, (0, -0.1, 0)), (5, (0, 0.35, 0)), (5.3, (0, 0.12, 0)), (6.5, 0), (8, 0)])
    animate(paw, "george_idle", "rotation_euler", [(0, 0), (6.3, 0), (6.7, (0, 0, -0.1)), (7.3, 0), (8, 0)])

    # pet, 3.2 s: a huge stretch, head up, ears forward, the tail tip goes thump
    animate(body, "george_pet", "scale", [(0, 0), (0.6, 0), (1.4, (0.07, 0, -0.03)), (2.2, (0.07, 0, -0.03)), (3.2, 0)])
    animate(paw, "george_pet", "rotation_euler", [(0, 0), (0.6, 0), (1.4, (0.25, 0, -0.3)), (2.2, (0.25, 0, -0.3)), (3.2, 0)])
    animate(head, "george_pet", "rotation_euler", [(0, 0), (0.5, 0), (1.2, (-0.25, 0, -0.15)), (2.3, (-0.25, 0, -0.15)), (3.2, 0)])
    for ear in (ear_l, ear_r):
        animate(ear, "george_pet", "rotation_euler", [(0, 0), (0.8, 0), (1.1, (-0.3, 0, 0)), (2.4, (-0.3, 0, 0)), (3.2, 0)])
    animate(tip, "george_pet", "rotation_euler",
            [(0, 0), (1.6, 0), (1.8, (-0.5, 0, 0)), (2.0, 0), (2.2, (-0.5, 0, 0)), (2.4, 0), (3.2, 0)])
    animate(tail, "george_pet", "rotation_euler", [(0, 0), (3.2, 0)])


def charlie(root):
    """The slim one, curled into a tight ball, chin on the paws."""
    b = Model("charlie_body")
    b.ball(0.24, (0, 0.02, 0.16), P.CAT_WHITE, subdiv=2, scale=(1.2, 1.0, 0.72))
    b.ball(0.2, (-0.16, 0.08, 0.19), P.GINGER, subdiv=2, scale=(1.0, 1.0, 0.75))      # hip patch
    b.ball(0.12, (0.1, 0.16, 0.24), P.GINGER, subdiv=2, scale=(1.2, 1.0, 0.6))        # back patch
    for x in (0.02, 0.13):
        b.ball(0.05, (x, -0.2, 0.04), P.CAT_WHITE, subdiv=1, scale=(1.3, 1.0, 0.7))      # tucked paws
    body = b.build(root)

    h = Model("charlie_head")
    _face(h, (0.03, -0.07, -0.01), (0.126, 0.015, 0.05), 0.075)
    h.ball(0.13, (0.03, -0.07, -0.01), P.CAT_WHITE, subdiv=2, scale=(1.0, 0.95, 0.9))
    head = h.build(root, loc=(0.12, -0.04, 0.16))
    head.rotation_euler = (0, 0.22, 0)                                                 # cheek tilted down
    ear_l, ear_r = _ears(head, "charlie", (0.03, -0.04, 0.085), 0.07, 0.048, tilt=0.35)
    e = Model("charlie_eye")                                                           # opens when you pet Charlie
    e.box((0.05, 0.02, 0.036), (0, 0, 0), "#b8c98f")
    e.box((0.012, 0.022, 0.032), (0, -0.002, 0), P.INK)
    eye = e.build(head, loc=(0.08, -0.2, 0.008))
    eye.scale = (1, 1, 0.01)

    # tail wrapped round the front, tip resting by her nose
    t = Model("charlie_tail")
    _limb(t, (0, 0, 0), (0.12, -0.15, -0.01), 0.04, 0.035, P.GINGER)
    tail = t.build(root, loc=(-0.27, -0.08, 0.05))
    tt = Model("charlie_tail_tip")
    _limb(tt, (0, 0, 0), (0.24, -0.04, 0.0), 0.035, 0.028, P.GINGER)
    tt.ball(0.03, (0.24, -0.04, 0.0), P.GINGER_DARK, subdiv=1)
    tip = tt.build(tail, loc=(0.12, -0.15, -0.01))

    # idle, 6 s: quicker, smaller breaths, an ear flick, the tail tip twitching in a dream
    animate(body, "charlie_idle", "scale", [(s, (0.015 * (i % 2), 0, 0.05 * (i % 2))) for i, s in enumerate((0, 1.5, 3, 4.5, 6))])
    animate(ear_r, "charlie_idle", "rotation_euler",
            [(0, 0), (1.8, 0), (1.9, (0, -0.5, 0)), (2.05, 0), (6, 0)])
    animate(tip, "charlie_idle", "rotation_euler",
            [(0, 0), (3.8, 0), (4.0, (0, 0, 0.35)), (4.25, (0, 0, 0.05)), (4.45, (0, 0, 0.3)), (4.9, 0), (6, 0)])
    animate(head, "charlie_idle", "rotation_euler", [(0, 0), (4.6, 0), (5.1, (0, 0.05, 0)), (6, 0)])

    # pet, 4 s: the head comes up, one eye opens to check who it is, then back to sleep
    animate(head, "charlie_pet", "rotation_euler", [(0, 0), (0.7, (-0.3, -0.2, -0.25)), (2.8, (-0.3, -0.2, -0.25)), (4, 0)])
    animate(eye, "charlie_pet", "scale", [(0, 0), (0.9, 0), (1.1, (0, 0, 0.99)), (2.5, (0, 0, 0.99)), (2.7, 0), (4, 0)])
    for ear in (ear_l, ear_r):
        animate(ear, "charlie_pet", "rotation_euler", [(0, 0), (0.6, (-0.3, 0, 0)), (1.4, (-0.3, 0, 0)), (1.5, (0.2, 0, 0)), (1.7, (-0.3, 0, 0)), (4, 0)])
    animate(tip, "charlie_pet", "rotation_euler", [(0, 0), (2.9, 0), (3.1, (0, 0, 0.4)), (3.4, 0), (4, 0)])
    animate(body, "charlie_pet", "scale", [(0, 0), (4, 0)])


def fleece(root):
    """The dark teal fleece they sleep on, spread over the bench seat."""
    m = Model("fleece", seed=5)
    m.box((1.86, 0.5, 0.05), (0, -0.01, 0.535), P.FLEECE)
    m.box((1.7, 0.045, 0.2), (0, -0.255, 0.44), P.FLEECE_DARK, rot=(0.12, 0, 0))    # draped over the front
    for x in (-0.2, 0.75):
        m.ball(0.12, (x, 0.02, 0.555), P.FLEECE, subdiv=1, scale=(1.4, 1.2, 0.3), jitter=0.01)  # rumples
    m.build(root)
