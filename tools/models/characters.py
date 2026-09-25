"""Vincent with his guitar, the dock cat and the winged sheep (chunky, toy-like proportions)."""
from __future__ import annotations

import math

import palette as P
from kit import Model
from mathutils import Matrix, Vector


# dreadnought outline in the guitar's own frame: x runs along the neck, z across the body
_BODY = [(-0.43, 0.0), (-0.41, 0.16), (-0.33, 0.27), (-0.2, 0.31), (-0.06, 0.29), (0.04, 0.22),
         (0.12, 0.23), (0.26, 0.24), (0.36, 0.2), (0.41, 0.1), (0.42, 0.0)]
_BODY = _BODY + [(x, -z) for x, z in reversed(_BODY[1:-1])]


def guitar(root, loc, tilt):
    """His acoustic, top facing -y, neck along +x, tilted up by `tilt`."""
    g = Model("guitar")
    g.prism(_BODY, 0.2, (0, 0, 0), P.GUITAR_SIDES)                                     # sides + back
    g.prism([(x * 0.95, z * 0.93) for x, z in _BODY], 0.02, (0, -0.105, 0), P.GUITAR)  # top, binding shows
    g.cyl(0.115, 0.01, (0.14, -0.114, 0), P.GUITAR_SIDES, segs=12, rot=(math.pi / 2, 0, 0))  # rosette
    g.cyl(0.09, 0.012, (0.14, -0.116, 0), P.INK, segs=12, rot=(math.pi / 2, 0, 0))           # soundhole
    g.box((0.13, 0.01, 0.09), (0.04, -0.118, -0.13), P.PICKGUARD, rot=(0, 0.5, 0))
    g.box((0.05, 0.03, 0.2), (-0.22, -0.125, 0), P.FRETBOARD)                                 # bridge
    g.box((0.66, 0.07, 0.085), (0.72, -0.05, 0), P.GUITAR_NECK)
    g.box((0.8, 0.02, 0.085), (0.65, -0.095, 0), P.FRETBOARD)                                 # fretboard
    for x in (0.4, 0.54, 0.68, 0.82, 0.96):
        g.box((0.012, 0.022, 0.085), (x, -0.097, 0), P.TUNER)                                 # frets
    for z in (-0.024, 0.0, 0.024):
        g.plank_line((-0.22, -0.112, z), (1.05, -0.112, z * 0.8), 0.008, 0.008, P.STRING)
    g.box((0.2, 0.045, 0.11), (1.15, -0.03, 0), P.GUITAR_NECK, rot=(0, 0, 0.25))            # headstock
    for i in range(3):
        for side in (-1, 1):
            g.cyl(0.018, 0.05, (1.1 + i * 0.06, -0.02 + i * 0.015, side * 0.055), P.TUNER, segs=5,
                  rot=(-side * math.pi / 2, 0, 0))
    obj = g.build(root, loc=loc)
    obj.rotation_euler = (0, -tilt, 0)
    return obj


def vincent(root):
    """Vincent on a log at the campfire with his acoustic. Faces -y; his right hand is -x.
    The runtime animates `arm_strum`, `arm_fret`, `head` and `foot_tap` while he plays.
    Reference photos of the real Vincent are in tools/reference."""
    m = Model("vincent")
    m.cyl(0.26, 1.7, (-0.85, 0, 0.26), P.WOOD, segs=7, rot=(0, math.pi / 2, 0))        # the log
    for x in (-0.16, 0.16):
        m.box((0.21, 0.52, 0.21), (x, -0.24, 0.62), P.SHORTS)                             # thighs
        m.box((0.16, 0.16, 0.52), (x, -0.5, 0.33), P.SKIN)                                # bare shins
    m.box((0.2, 0.34, 0.1), (0.16, -0.56, 0.1), P.SHOE)
    m.box((0.21, 0.35, 0.05), (0.16, -0.56, 0.025), P.SOLE)
    foot = Model("foot_tap")                                                             # right foot, pivots at the heel
    foot.box((0.2, 0.34, 0.1), (0, -0.17, 0.1), P.SHOE)
    foot.box((0.21, 0.35, 0.05), (0, -0.17, 0.025), P.SOLE)
    foot.build(root, loc=(-0.16, -0.39, 0))
    m.box((0.56, 0.34, 0.66), (0, 0.02, 1.05), P.TEE)                                    # torso
    m.prism([(-0.1, 0), (0.1, 0), (0, -0.17)], 0.01, (0, -0.152, 1.385), P.SKIN)          # v-neck
    for z in (1.31, 1.22):                                                               # shades hooked on the collar
        m.box((0.08, 0.02, 0.07), (-0.08, -0.158, z), P.SHADES)
    m.box((0.02, 0.02, 0.16), (-0.08, -0.158, 1.29), P.SHADES_FRAME)
    m.box((0.2, 0.2, 0.12), (0, 0.0, 1.43), P.SKIN)                                      # neck
    # head (nods along; pivots at the neck): tanned, short beard going grey at the chin, big grin
    h = Model("head")
    hz = 1.45
    h.box((0.42, 0.4, 0.44), (0, 0.0, 1.68 - hz), P.SKIN)
    h.box((0.44, 0.41, 0.15), (0, 0.0, 1.535 - hz), P.BEARD)
    h.box((0.14, 0.03, 0.06), (0, -0.2, 1.485 - hz), P.BEARD_GREY)
    h.box((0.22, 0.03, 0.035), (0, -0.203, 1.62 - hz), P.BEARD)                          # moustache
    h.box((0.14, 0.03, 0.035), (0, -0.207, 1.575 - hz), P.TEETH)                         # smile
    h.box((0.07, 0.05, 0.08), (0, -0.215, 1.67 - hz), P.SKIN)                            # nose
    for x in (-0.1, 0.1):
        h.box((0.06, 0.02, 0.06), (x, -0.205, 1.72 - hz), P.INK)                         # eyes
        h.box((0.1, 0.02, 0.025), (x, -0.205, 1.775 - hz), P.HAIR)                       # brows
    for x in (-0.22, 0.22):
        h.box((0.04, 0.1, 0.12), (x, 0.02, 1.68 - hz), P.SKIN)                           # ears
        h.box((0.03, 0.34, 0.14), (x * 0.99, 0.02, 1.83 - hz), P.HAIR)                   # short sides
    h.box((0.4, 0.04, 0.2), (0, 0.205, 1.76 - hz), P.HAIR)                               # back of the head
    # cap on backwards: brim over the neck, snapback strap over the forehead
    h.box((0.46, 0.44, 0.14), (0, 0.0, 1.93 - hz), P.CAP)
    h.box((0.38, 0.36, 0.07), (0, 0.0, 2.03 - hz), P.CAP)
    h.box((0.06, 0.06, 0.03), (0, 0.0, 2.075 - hz), P.CAP_DARK)                          # button
    h.box((0.36, 0.26, 0.035), (0, 0.33, 1.9 - hz), P.CAP_DARK, rot=(0.25, 0, 0))       # brim
    h.box((0.16, 0.02, 0.04), (0, -0.225, 1.93 - hz), P.CAP_DARK)                        # strap
    h.box((0.12, 0.02, 0.05), (0, -0.226, 1.88 - hz), P.HAIR)                            # hair through the gap
    h.build(root, loc=(0, 0, hz))
    loc, tilt = (-0.14, -0.29, 0.97), 0.33
    frame = Matrix.Translation(loc) @ Matrix.Rotation(-tilt, 4, "Y")

    def on_guitar(x, y, z):
        """A point in the guitar's frame (x along the neck, -y out of the top) in Vincent's."""
        return frame @ Vector((x, y, z))

    def y_up(v):
        """A direction in Vincent's frame as the runtime sees it (glTF is y-up)."""
        v = v.normalized()
        return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]

    def turning(r, towards):
        """The axis to turn about so that a point at r (from the pivot) moves towards `towards`."""
        return y_up(r.cross(towards))

    along, across, out = (frame.to_3x3() @ Vector(v) for v in ((1, 0, 0), (0, 0, 1), (0, -1, 0)))
    # fretting (left) arm: sleeve and upper arm, then the forearm, watch and hand, which slide
    # along the neck (`slide`) from chord to chord, lifting off the strings in between (`lift`)
    m.plank_line((0.33, -0.02, 1.32), (0.37, -0.08, 1.16), 0.15, 0.15, P.TEE)
    m.plank_line((0.37, -0.08, 1.16), (0.4, -0.16, 1.0), 0.12, 0.12, P.SKIN)
    elbow, hand = Vector((0.4, -0.16, 1.0)), Vector((0.57, -0.36, 1.22))
    fret = Model("arm_fret")
    fret.box((0.12, 0.12, 0.12), (0, 0, 0), P.SKIN)                                     # elbow
    fret.plank_line((0, 0, 0), Vector((0.14, -0.17, 0.16)), 0.11, 0.11, P.SKIN)
    fret.plank_line((0.1, -0.13, 0.1), (0.12, -0.15, 0.13), 0.13, 0.13, P.WATCH)
    fret.box((0.1, 0.12, 0.13), hand - elbow, P.SKIN)
    fret.build(root, loc=elbow, slide=y_up(along), lift=turning(hand - elbow, out))

    # strumming (right) arm, like a player's: the upper arm comes round over the lower bout, the
    # elbow rests just past its edge and the forearm lies across the top, clear of the strings
    shoulder, elbow = Vector((-0.31, -0.08, 1.3)), on_guitar(-0.26, -0.21, 0.45)
    hand = on_guitar(0.0, -0.2, 0.06)                                                   # between soundhole and bridge
    m.plank_line(shoulder, shoulder.lerp(elbow, 0.4), 0.15, 0.15, P.TEE)
    m.plank_line(shoulder.lerp(elbow, 0.4), elbow, 0.12, 0.12, P.SKIN)
    m.build(root)
    guitar(root, loc, tilt)
    # the forearm pivots at the elbow and swings parallel to the top, so it never goes through
    # the guitar; `swing` turns it for a downstroke
    down = out * math.copysign(1, (hand - elbow).cross(-across).dot(out))
    arm = Model("arm_strum")
    arm.box((0.13, 0.13, 0.13), (0, 0, 0), P.SKIN)                                     # elbow
    arm.plank_line((0, 0, 0), (hand - elbow) * 0.85, 0.11, 0.11, P.SKIN)
    arm.box((0.11, 0.1, 0.12), hand - elbow, P.SKIN)
    arm.build(root, loc=elbow, swing=y_up(down))


def cat(root):
    """A black cat curled up asleep: white bib, four white socks, pink inside the ears (after Zola)."""
    body = Model("cat_body")
    body.ball(0.32, (0, 0, 0.18), P.CAT, subdiv=1, scale=(1.3, 1.0, 0.65))
    body.ball(0.17, (0.36, -0.12, 0.2), P.CAT, subdiv=1)                                # head
    for dx in (-0.08, 0.08):
        body.cyl(0.06, 0.12, (0.36 + dx, -0.12, 0.33), P.CAT, segs=4, r_top=0.0)           # ears
        body.cyl(0.035, 0.08, (0.36 + dx, -0.15, 0.33), P.EAR_PINK, segs=3, r_top=0.0)     # inside the ears
    body.ball(0.08, (0.36, -0.24, 0.08), P.CAT_WHITE, subdiv=1, scale=(1.0, 0.6, 0.8))    # white bib under the chin
    body.plank_line((-0.3, 0.1, 0.08), (0.2, -0.32, 0.06), 0.09, 0.09, P.CAT)           # tail wrapped round
    for x in (0.29, 0.45):
        body.ball(0.05, (x, -0.28, 0.04), P.CAT_WHITE, subdiv=1, scale=(1.5, 1.0, 0.7))   # front paws, tucked under the chin
    body.ball(0.05, (-0.14, -0.28, 0.04), P.CAT_WHITE, subdiv=1, scale=(1.4, 1.0, 0.7))    # a back paw poking out
    body.build(root)


def sheep(root):
    """The winged sheep: wool, a dark face, and two feathered wings that flap."""
    m = Model("sheep_body", seed=8)
    for x, y, z, r in [(0, 0, 0, 0.5), (-0.35, 0, 0.05, 0.4), (0.3, 0, 0.08, 0.38), (0, 0.22, 0.2, 0.34),
                       (0, -0.22, 0.2, 0.34), (-0.15, 0, 0.35, 0.32), (0.2, 0, 0.32, 0.3)]:
        m.ball(r, (x, y, z), P.WOOL, subdiv=1, jitter=0.03)
    m.box((0.32, 0.3, 0.36), (0.62, 0, 0.12), P.SHEEP_FACE, rot=(0, 0.25, 0))
    m.ball(0.14, (0.55, 0, 0.36), P.WOOL, subdiv=1)                                      # top knot
    for y in (-0.15, 0.15):
        m.box((0.08, 0.2, 0.08), (0.55, y * 1.5, 0.22), P.SHEEP_FACE, rot=(0.4 * (1 if y > 0 else -1), 0, 0))
        m.box((0.05, 0.02, 0.05), (0.79, y * 0.6, 0.2), "#f7f3ea")                        # eyes
    for x in (-0.25, 0.25):
        for y in (-0.16, 0.16):
            m.box((0.1, 0.1, 0.34), (x, y, -0.5), P.SHEEP_FACE)                          # legs
    m.build(root)
    for side in (-1, 1):
        w = Model(f"wing_{'l' if side > 0 else 'r'}")
        for i, (length, spread) in enumerate([(1.0, -0.35), (1.25, -0.1), (1.1, 0.15), (0.8, 0.4)]):
            w.box((0.24, length, 0.05), (spread, side * length / 2, 0), P.FEATHER if i % 2 else P.WHITE,
                  rot=(0, 0, spread * side * 0.6))
        w.build(root, loc=(-0.05, side * 0.3, 0.42))
