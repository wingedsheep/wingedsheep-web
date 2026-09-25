"""Beike, Vincent's dad's dog: a Frisian Stabij, black head and saddle, white chest and legs
ticked with black, floppy ears and a big feathered tail curled up over his back.

He faces +x, y is his left, z = 0 is the ground. Everything that moves is its own part, pivoting
where it joins the body: the runtime (src/island/scene/beike.ts) trots him around, makes him jump
up and roll over, and sends him after the tennis ball.
"""
from __future__ import annotations

from mathutils import Vector

import palette as P
from kit import Model

BODY_Z = 0.42  # the torso's centre above the ground
SCALE = 1.25   # modelled cat-sized; a Stabij is a good bit bigger than Charlie and George


def _limb(m: Model, a, b, r0, r1, color, segs=6):
    """A tapered round limb from a (radius r0) to b (radius r1)."""
    d = Vector(b) - Vector(a)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r0, d.length, a, color, segs=segs, r_top=r1, rot=tuple(rot))


def _leg(body, name: str, at, rear: bool):
    """One leg hanging from its shoulder or hip, white with black ticks and a round paw."""
    g = Model(name)
    if rear:  # feathered black thigh
        g.ball(0.085, (0, 0, -0.02), P.DOG_BLACK, subdiv=1, scale=(1.2, 0.8, 1.2))
    _limb(g, (0, 0, -0.02), (0.0, 0, -0.3), 0.052, 0.04, P.DOG_WHITE)
    g.ball(0.05, (0.02, 0, -0.31), P.DOG_WHITE, subdiv=1, scale=(1.35, 1.0, 0.7))  # paw
    for z, dx in ((-0.13, 0.045), (-0.2, 0.04), (-0.25, -0.04)):
        g.box((0.018, 0.02, 0.018), (dx, 0.015 if dx > 0 else -0.02, z), P.DOG_BLACK)  # ticking
    return g.build(body, loc=at)


def beike(root):
    root.scale = (SCALE,) * 3
    b = Model("beike_body")
    b.ball(0.22, (0, 0, 0), P.DOG_WHITE, subdiv=2, scale=(1.7, 0.95, 0.9))            # belly and chest
    b.ball(0.225, (-0.03, 0, 0.055), P.DOG_BLACK, subdiv=2, scale=(1.6, 1.0, 0.78))   # black saddle
    b.ball(0.16, (0.27, 0, -0.02), P.DOG_WHITE, subdiv=2, scale=(1.0, 1.05, 1.1))     # white chest
    b.ball(0.13, (0.31, 0, 0.14), P.DOG_BLACK, subdiv=1, scale=(1.0, 1.05, 1.25))      # neck
    b.cyl(0.125, 0.05, (0.31, 0, 0.06), P.COLLAR, segs=8, rot=(0, -0.7, 0))            # blue harness
    b.ball(0.07, (0.39, 0, -0.1), P.DOG_WHITE, subdiv=1, scale=(1.0, 1.4, 1.0))       # chest ruff
    for x, y, z in ((0.33, 0.1, -0.12), (0.3, -0.08, -0.14), (0.38, 0.03, -0.17), (0.1, 0.1, -0.17)):
        b.box((0.02, 0.02, 0.02), (x, y, z), P.DOG_BLACK)                              # ticking
    body = b.build(root, loc=(0, 0, BODY_Z))

    h = Model("beike_head")
    h.ball(0.14, (0.07, 0, 0.07), P.DOG_BLACK, subdiv=2, scale=(1.1, 0.95, 0.92))     # skull
    h.ball(0.085, (0.2, 0, 0.02), P.DOG_BLACK, subdiv=1, scale=(1.35, 0.85, 0.72))    # muzzle
    h.ball(0.06, (0.25, 0, 0.0), P.DOG_WHITE, subdiv=1, scale=(1.3, 0.95, 0.78))      # white on the muzzle
    h.box((0.2, 0.05, 0.03), (0.2, 0, 0.075), P.DOG_WHITE, rot=(0, 0.42, 0))            # blaze up the nose
    h.ball(0.03, (0.1, 0, 0.19), P.DOG_WHITE, subdiv=1, scale=(1.4, 0.6, 0.5))         # star on the forehead
    h.box((0.045, 0.06, 0.04), (0.31, 0, 0.02), P.DOG_NOSE)
    for y in (-0.065, 0.065):
        h.box((0.03, 0.03, 0.03), (0.17, y, 0.1), P.DOG_EYE)
        h.box((0.012, 0.032, 0.014), (0.18, y, 0.105), P.INK)                            # pupils
    head = h.build(body, loc=(0.37, 0, 0.23))

    t = Model("beike_tongue")  # hangs out when he pants
    t.box((0.05, 0.045, 0.012), (0.03, 0, 0), P.DOG_TONGUE)
    t.box((0.045, 0.045, 0.05), (0.06, 0, -0.025), P.DOG_TONGUE)
    t.build(head, loc=(0.24, 0, -0.035))

    for side in (1, -1):  # floppy ears, pivoting where they fold over
        e = Model(f"beike_ear_{'l' if side > 0 else 'r'}")
        e.box((0.1, 0.035, 0.17), (0, side * 0.012, -0.075), P.DOG_BLACK, rot=(side * 0.18, 0, 0), taper=1.3)
        e.build(head, loc=(0.04, side * 0.115, 0.15))

    # the tennis ball waits in his mouth; the runtime takes it out to throw it
    ball = Model("beike_ball")
    ball.ball(0.055, (0, 0, 0), P.TENNIS, subdiv=1)
    ball.box((0.112, 0.01, 0.012), (0, 0, 0), P.DOG_WHITE)                             # the seam
    ball.build(head, loc=(0.29, 0, -0.045))

    for name, x, y, rear in (("fl", 0.24, 0.1, False), ("fr", 0.24, -0.1, False),
                             ("bl", -0.24, 0.1, True), ("br", -0.24, -0.1, True)):
        _leg(body, f"beike_leg_{name}", (x, y, -0.08), rear)

    # the plume: up from the rump and curled forward over the back, black with white feathering
    tl = Model("beike_tail")
    arc = [(-0.02, 0.02, 0.055), (-0.05, 0.09, 0.07), (-0.06, 0.16, 0.085), (-0.04, 0.23, 0.095),
           (0.01, 0.28, 0.1), (0.07, 0.3, 0.095), (0.13, 0.29, 0.08), (0.18, 0.26, 0.06)]
    colors = [P.DOG_BLACK] * 3 + [P.DOG_WHITE, P.DOG_WHITE, P.DOG_BLACK, P.DOG_WHITE, P.DOG_WHITE]
    for (x, z, r), c in zip(arc, colors):
        tl.ball(r, (x, 0, z), c, subdiv=1, scale=(1.0, 0.85, 1.0), jitter=0.01)
    tl.build(body, loc=(-0.34, 0, 0.1))
