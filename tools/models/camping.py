"""A night out under canvas (src/island/scene/camping.ts): their ridge tent, pitched on the headland
east of the campfire (layout.py CAMP, HEADLAND) on a warm, dry night, its door to the fire.

  camp          the tent, hidden till it's a camping night. Its canvas (`camp_canvas`), the inside
                (`camp_inside`: the lining, the groundsheet and their sleeping bags) and the door,
                zipped shut (`camp_door`), each have a lit twin (`.._lit`) the runtime swaps in
                while the lantern's on inside; the flaps rolled back and tied (`camp_flaps`) show
                while the door's open. The poles, the guy lines and pegs, and their shoes by the
                door are `camp_frame`.

The door faces -y in the tent's own frame; z = 0 is the grass.
"""
from __future__ import annotations

import math

import layout as L
import palette as P
from kit import Model, group
from mathutils import Vector

CANVAS = "#d9893d"             # a sunny orange cotton canvas, a darker seam down the ridge
CANVAS_DARK = "#b06a2c"
CANVAS_LIT = "#f3a861"         # the lantern on inside, through the canvas: the sides (one a shade
CANVAS_LIT_FAR = "#e4934c"     # down), the gable ends, and the seams
CANVAS_LIT_END = "#f8bd78"
CANVAS_LIT_SEAM = "#c97a3a"
LINING = "#3a2f2a"             # inside, by day: shade
LINING_LIT = "#ffd58e"
GROUNDSHEET = "#3e4a52"
POLE = "#3b3f45"
GUY = "#e8e0c8"
BAG_HIS = "#2f5a8a"            # sleeping bags: his navy, hers plum
BAG_HERS = "#8a3a62"
PILLOW = "#e9e2d0"
HER_SHOE = "#c97b8a"

LENGTH = 2.1                   # along the ridge, door to back
WIDE = 1.6                     # across the bottom
RIDGE = 1.08                   # how high the ridge runs
DOOR_W = 0.44                  # half the door's width at the bottom
DOOR_H = 0.9


def _shell(m: Model, color: str, end: str, inset=0.0, glow=False, far: str | None = None):
    """The canvas: the two sides down from the ridge (the -x one in `far`, if given), the back
    gable, and the front gable round the door. `inset` shrinks it all a little, for the lining inside."""
    w, h, half = WIDE / 2 - inset, RIDGE - inset, LENGTH / 2 - inset
    run = w + 0.04
    angle = math.atan2(h, w)
    slope = run / math.cos(angle)
    for s in (-1, 1):
        m.box((0.03, LENGTH - 2 * inset, slope), (s * run / 2, 0, h - run / 2 * math.tan(angle)), (far or color) if s < 0 else color,
              rot=(0, -s * (math.pi / 2 - angle), 0), glow=glow)
    m.prism([(-w, 0), (w, 0), (0, h)], 0.03, (0, half, 0), end, glow=glow)                        # the back
    dw, dh = DOOR_W - inset, DOOR_H - inset
    for s in (-1, 1):                                                                             # the front, round the door
        m.prism([(s * w, 0), (s * dw, 0), (0, dh), (0, h)][:: -s], 0.03, (0, -half, 0), end, glow=glow)


def tent(root):
    # the canvas, and its twin with the lantern on inside
    for lit in (False, True):
        m = Model("camp_canvas_lit" if lit else "camp_canvas")
        _shell(m, CANVAS_LIT if lit else CANVAS, CANVAS_LIT_END if lit else CANVAS, glow=lit, far=CANVAS_LIT_FAR if lit else None)
        seam = CANVAS_LIT_SEAM if lit else CANVAS_DARK
        m.box((0.07, LENGTH + 0.02, 0.04), (0, 0, RIDGE + 0.01), seam, glow=lit)                   # the ridge seam
        for s in (-1, 1):                                                                         # a tape along each foot
            m.box((0.05, LENGTH, 0.06), (s * (WIDE / 2 + 0.02), 0, 0.03), seam, glow=lit)
            for y in (-0.36, 0.36):                                                               # and the seams, down the sides
                a, b = Vector((0, y, RIDGE + 0.01)), Vector((s * (WIDE / 2 + 0.045), y, 0.0))
                m.box((0.035, 0.05, (b - a).length), (a + b) / 2, seam, rot=Vector((0, 0, 1)).rotation_difference((b - a).normalized()).to_euler(), glow=lit)
        m.build(root)
    # inside: the lining, the groundsheet, and the two sleeping bags, feet to the door
    for lit in (False, True):
        m = Model("camp_inside_lit" if lit else "camp_inside")
        _shell(m, LINING_LIT if lit else LINING, LINING_LIT if lit else LINING, inset=0.06, glow=lit)
        m.box((WIDE - 0.1, LENGTH - 0.08, 0.02), (0, 0, 0.01), LINING_LIT if lit else GROUNDSHEET, glow=lit)
        if not lit:
            for x, c, lie in ((-0.3, BAG_HIS, 0.04), (0.3, BAG_HERS, -0.05)):
                m.box((0.5, 1.6, 0.13), (x, 0.12, 0.08), c, rot=(0, 0, lie))
                m.box((0.52, 0.3, 0.16), (x, -0.62, 0.09), c, rot=(0, 0, lie))                    # the foot, rounded
                m.box((0.4, 0.26, 0.1), (x, 0.82, 0.1), PILLOW, rot=(0, 0, lie))                  # a pillow, at the back
        m.build(root)
    # the door, zipped shut (and lit), and rolled back and tied when it's open
    for lit in (False, True):
        m = Model("camp_door_lit" if lit else "camp_door")
        m.prism([(-DOOR_W - 0.02, 0), (DOOR_W + 0.02, 0), (0, DOOR_H + 0.03)], 0.02, (0, -LENGTH / 2 - 0.02, 0),
                CANVAS_LIT_END if lit else CANVAS, glow=lit)
        m.box((0.02, 0.025, DOOR_H - 0.06), (0, -LENGTH / 2 - 0.035, (DOOR_H - 0.06) / 2), CANVAS_DARK if not lit else CANVAS_LIT)   # the zip
        m.build(root)
    f = Model("camp_flaps")
    for s in (-1, 1):
        a, b = (s * 0.06, -LENGTH / 2 - 0.05, DOOR_H - 0.05), (s * (DOOR_W + 0.1), -LENGTH / 2 - 0.05, 0.12)
        f.plank_line(a, b, 0.1, 0.09, CANVAS_DARK)                                                # rolled back
        mid = (a[0] * 0.45 + b[0] * 0.55, a[1], a[2] * 0.45 + b[2] * 0.55)
        f.box((0.13, 0.11, 0.025), mid, GUY, rot=(0, s * 0.85, 0))                               # and tied
    f.build(root)
    # the poles at each end, the guy lines out from them and down the sides, their pegs, the
    # groundsheet's edge, and their shoes by the door
    m = Model("camp_frame")
    for y in (-1, 1):
        py = y * (LENGTH / 2 + 0.03)
        m.box((0.035, 0.035, RIDGE + 0.12), (0, py, (RIDGE + 0.12) / 2), POLE)
        m.box((0.025, 0.025, 0.06), (0, py, RIDGE + 0.15), P.GOLD)                               # its finial
        peg = (0, y * (LENGTH / 2 + 0.95), 0.02)
        m.plank_line((0, py, RIDGE + 0.08), peg, 0.015, 0.015, GUY)
        m.box((0.03, 0.03, 0.08), (peg[0], peg[1], 0.03), P.IRON)
        for s in (-1, 1):                                                                         # and from the sides' corners
            corner = (s * (WIDE / 2 + 0.02), y * (LENGTH / 2 - 0.08), 0.08)
            pp = (s * (WIDE / 2 + 0.42), y * (LENGTH / 2 + 0.28), 0.02)
            m.plank_line(corner, pp, 0.012, 0.012, GUY)
            m.box((0.03, 0.03, 0.06), (pp[0], pp[1], 0.03), P.IRON)
    m.box((WIDE + 0.14, LENGTH + 0.1, 0.02), (0, 0, 0.005), GROUNDSHEET)
    for x, c, turn in ((0.36, P.SHOE, 0.15), (0.53, P.SHOE, -0.1), (-0.42, HER_SHOE, -0.2), (-0.56, HER_SHOE, 0.05)):
        m.box((0.12, 0.26, 0.09), (x, -LENGTH / 2 - 0.32, 0.045), c, rot=(0, 0, turn))
    m.build(root)


def populate(t):
    x, y = L.CAMP
    fx, fy = L.CAMPFIRE
    # the door half to the fire, half to the default camera (south), so you can see in
    turn = math.atan2(fx - x, -(fy - y)) * 0.33
    root = group("camp", (x, y, t.sample(x, y)), rot_z=turn, id="camp")
    tent(root)
