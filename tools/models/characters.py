"""Vincent with his guitar, the dock cat and the winged sheep (chunky, toy-like proportions)."""
from __future__ import annotations

import math

import palette as P
from kit import Model, group
from mathutils import Euler, Matrix, Vector


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


def head(parent, name: str, loc, rot=(0, 0, 0), cap=True, sport=False, shut=False):
    """His head, pivoting at the neck: tanned, short beard going grey at the chin, big grin. With
    `cap` (not in bed) he's dressed for the day: his cap on backwards, or whatever hat the outfit
    has (hats), and his face can take Halloween's paint. With `shut` his eyes are closed, and his
    left one, opening, is its own part (`<name>_peek`), hidden till he peeks."""
    h = Model(name)
    hz = 1.45                                                                            # built where it sits on him
    face = P.V_FACE if cap and not sport else P.SKIN
    h.box((0.42, 0.4, 0.44), (0, 0.0, 1.68 - hz), face)
    # jaw and sideburns, no further back than the ears, reaching a little under the face (level
    # with it, the two flicker where you see his chin from below: lying in bed)
    h.box((0.44, 0.225, 0.16), (0, -0.0925, 1.53 - hz), P.BEARD)
    h.box((0.14, 0.03, 0.07), (0, -0.2, 1.475 - hz), P.BEARD_GREY)
    h.box((0.22, 0.03, 0.035), (0, -0.203, 1.62 - hz), P.BEARD)                          # moustache
    h.box((0.14, 0.03, 0.035), (0, -0.207, 1.575 - hz), P.TEETH)                         # smile
    h.box((0.07, 0.05, 0.08), (0, -0.215, 1.67 - hz), face)                              # nose
    for x in (-0.1, 0.1):
        if shut:
            h.box((0.08, 0.02, 0.02), (x, -0.205, 1.705 - hz), P.INK)                    # eyes, closed
        else:
            h.box((0.06, 0.02, 0.06), (x, -0.205, 1.72 - hz), P.INK)                     # eyes
        h.box((0.1, 0.02, 0.025), (x, -0.205, 1.775 - hz), P.HAIR)                       # brows
    for x in (-0.22, 0.22):
        h.box((0.04, 0.1, 0.12), (x, 0.02, 1.68 - hz), face)                             # ears
        h.box((0.03, 0.34, 0.14), (x * 0.99, 0.02, 1.83 - hz), P.HAIR)                   # short sides
    h.box((0.4, 0.04, 0.3), (0, 0.205, 1.71 - hz), P.HAIR)                               # back of the head, down to the nape
    h.box((0.44, 0.42, 0.1), (0, 0.0, 1.93 - hz), P.HAIR)                                # short on top, under any hat
    if not cap:
        h.box((0.3, 0.04, 0.06), (0.03, -0.2, 1.91 - hz), P.HAIR)                        # and a bit ruffled
    o = h.build(parent, loc=loc)
    o.rotation_euler = rot
    if shut:
        e = Model(f"{name}_peek")
        e.box((0.06, 0.02, 0.06), (0.1, -0.208, 1.72 - hz), P.INK)
        e.build(o)
    if cap:
        hats(o, name, hz, sport)
    return o


def hats(o, name: str, hz: float, sport=False):
    """What he has on his head, one part each, for the wardrobe to pick from (`wear`, see
    src/island/scene/wardrobe.ts): his cap on backwards, a knitted beanie, nothing (his hair a
    bit ruffled), and (not for sport) Halloween's steampunk top hat with the goggles on it."""
    k = "vs" if sport else "v"
    c = Model(f"{name}_cap")                                                             # brim over the neck, snapback strap over the forehead
    c.box((0.46, 0.44, 0.14), (0, 0.0, 1.93 - hz), P.CAP)
    c.box((0.38, 0.36, 0.07), (0, 0.0, 2.03 - hz), P.CAP)
    c.box((0.06, 0.06, 0.03), (0, 0.0, 2.075 - hz), P.CAP_DARK)                          # button
    c.box((0.36, 0.26, 0.035), (0, 0.33, 1.9 - hz), P.CAP_DARK, rot=(0.25, 0, 0))       # brim
    c.box((0.16, 0.02, 0.04), (0, -0.225, 1.93 - hz), P.CAP_DARK)                        # strap
    c.box((0.12, 0.02, 0.05), (0, -0.226, 1.88 - hz), P.HAIR)                            # hair through the gap
    c.build(o, wear=f"{k}_cap")
    b = Model(f"{name}_beanie")                                                          # his dark green muts: ribbed, a deep cuff, a round patch
    b.box((0.47, 0.45, 0.14), (0, 0.0, 1.95 - hz), P.BEANIE)
    b.box((0.4, 0.38, 0.06), (0, 0.0, 2.05 - hz), P.BEANIE)
    for x in (-0.15, -0.05, 0.05, 0.15):                                                 # its ribs
        b.box((0.03, 0.452, 0.14), (x, 0.0, 1.95 - hz), P.BEANIE_DARK)
    b.box((0.49, 0.47, 0.1), (0, 0.0, 1.87 - hz), P.BEANIE)                              # the cuff
    for x in (-0.18, -0.06, 0.06, 0.18):
        b.box((0.03, 0.472, 0.1), (x, 0.0, 1.87 - hz), P.BEANIE_DARK)
    b.box((0.09, 0.02, 0.08), (0.14, -0.24, 1.87 - hz), P.BEANIE_PATCH)                  # the patch, to his left
    b.build(o, wear=f"{k}_beanie")
    # nothing on: short and a bit tousled, tufts standing up more towards the front, the fringe
    # pushed up and swept off to his left
    r = Model(f"{name}_bare", seed=7)
    for i, x in enumerate((-0.13, 0.0, 0.13)):
        for j, y in enumerate((0.12, 0.0, -0.12)):
            up = 0.02 + 0.015 * j + r.rng.uniform(0, 0.02)
            r.box((0.15, 0.14, up), (x, y, 1.975 + up / 2 - hz), (P.HAIR, P.HAIR_LIGHT)[(i + j) % 2],
                  rot=(0, 0, r.rng.uniform(-0.15, 0.15)))
    r.box((0.36, 0.08, 0.08), (0.02, -0.19, 1.97 - hz), P.HAIR, rot=(0.45, 0, 0))       # the fringe, pushed up
    r.box((0.14, 0.07, 0.06), (0.13, -0.2, 2.03 - hz), P.HAIR_LIGHT, rot=(0.6, 0, -0.35))   # a flick off to the side
    r.box((0.1, 0.06, 0.05), (-0.12, -0.18, 2.01 - hz), P.HAIR_LIGHT, rot=(0.5, 0, 0.3))
    r.build(o, wear=f"{k}_bare")
    if sport:
        return
    # the top hat: flaring a little to the crown, worn tipped back, the goggles on the front
    # and a brass cog with a chain on the side
    t = Model(f"{name}_tophat")
    t.box((0.66, 0.62, 0.035), (0, 0.0, 1.9 - hz), P.TOPHAT)                             # brim
    t.box((0.47, 0.45, 0.42), (0, 0.0, 2.12 - hz), P.TOPHAT, taper=1.08)                 # crown
    t.box((0.5, 0.48, 0.035), (0, 0.0, 2.335 - hz), P.TOPHAT)                            # its top
    t.box((0.48, 0.46, 0.07), (0, 0.0, 1.96 - hz), P.TOPHAT_BAND)                        # band
    for x in (-0.11, 0.11):
        t.cyl(0.085, 0.05, (x, -0.235, 2.04 - hz), P.GOGGLE, segs=8, rot=(math.pi / 2, 0, 0))
        t.cyl(0.06, 0.02, (x, -0.26, 2.04 - hz), P.GOGGLE_GLASS, segs=8, rot=(math.pi / 2, 0, 0))
    t.box((0.08, 0.04, 0.03), (0, -0.24, 2.04 - hz), P.GOGGLE)                           # the bridge
    t.box((0.08, 0.02, 0.08), (0.17, -0.235, 2.22 - hz), P.GOLD, rot=(0, 0.4, 0))       # the cog
    t.box((0.02, 0.02, 0.14), (0.2, -0.235, 2.13 - hz), P.GOLD)                          # its chain
    hat = t.build(o, wear="v_tophat")
    hat.rotation_euler = (0.12, 0.06, 0)
    p = Model(f"{name}_paint")                                                           # a vampire: hollow round the eyes, and fangs
    for x in (-0.1, 0.1):
        p.box((0.11, 0.01, 0.1), (x, -0.203, 1.715 - hz), P.FACE_SHADE)
        p.box((0.06, 0.012, 0.03), (x * 0.9, -0.2015, 1.645 - hz), P.FACE_SHADE)          # sunken cheeks
    for x in (-0.045, 0.045):
        p.box((0.03, 0.02, 0.06), (x, -0.214, 1.545 - hz), P.TEETH)
        p.box((0.015, 0.02, 0.025), (x, -0.214, 1.505 - hz), P.TEETH)                    # their points
    p.box((0.02, 0.02, 0.04), (0.045, -0.215, 1.47 - hz), P.BLOOD)                       # a drop
    p.build(o, wear="v_paint")


def log(root):
    """The log he sits on at the campfire, which stays when he's off somewhere else."""
    m = Model("vincent_log")
    m.cyl(0.26, 1.7, (-0.85, 0, 0.26), P.WOOD, segs=7, rot=(0, math.pi / 2, 0))
    m.build(root)


def vincent(root):
    """Vincent at the campfire with his acoustic, on the log (`log`, placed on its own). Faces
    -y; his right hand is -x. The runtime animates `arm_strum`, `arm_fret`, `head` and
    `foot_tap` while he plays. Reference photos of the real Vincent are in tools/reference."""
    m = Model("vincent")
    for x in (-0.16, 0.16):
        m.box((0.21, 0.52, 0.21), (x, -0.24, 0.62), P.V_LEGS)                             # thighs
        m.box((0.16, 0.16, 0.52), (x, -0.5, 0.33), P.V_SHIN)                              # bare shins
    m.box((0.2, 0.34, 0.1), (0.16, -0.56, 0.1), P.SHOE)
    m.box((0.21, 0.35, 0.05), (0.16, -0.56, 0.025), P.SOLE)
    foot = Model("foot_tap")                                                             # right foot, pivots at the heel
    foot.box((0.2, 0.34, 0.1), (0, -0.17, 0.1), P.SHOE)
    foot.box((0.21, 0.35, 0.05), (0, -0.17, 0.025), P.SOLE)
    foot.build(root, loc=(-0.16, -0.39, 0))
    _tee(m, 0.72, root, cape=0.25)
    head(root, "head", (0, 0, 1.45))
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
    m.plank_line((0.33, -0.02, 1.32), (0.37, -0.08, 1.16), 0.15, 0.15, P.V_TOP)
    m.plank_line((0.37, -0.08, 1.16), (0.4, -0.16, 1.0), 0.12, 0.12, P.V_ARM)
    elbow, hand = Vector((0.4, -0.16, 1.0)), Vector((0.57, -0.36, 1.22))
    fret = Model("arm_fret")
    fret.box((0.12, 0.12, 0.12), (0, 0, 0), P.V_ARM)                                    # elbow
    fret.plank_line((0, 0, 0), Vector((0.14, -0.17, 0.16)), 0.11, 0.11, P.V_ARM)
    fret.plank_line((0.1, -0.13, 0.1), (0.12, -0.15, 0.13), 0.13, 0.13, P.WATCH)
    fret.box((0.1, 0.12, 0.13), hand - elbow, P.SKIN)
    fret.build(root, loc=elbow, slide=y_up(along), lift=turning(hand - elbow, out))

    # strumming (right) arm, like a player's: the upper arm comes round over the lower bout, the
    # elbow rests just past its edge and the forearm lies across the top, clear of the strings
    shoulder, elbow = Vector((-0.31, -0.08, 1.3)), on_guitar(-0.26, -0.21, 0.45)
    hand = on_guitar(0.0, -0.2, 0.06)                                                   # between soundhole and bridge
    upper = Model("arm_strum_upper")                                                    # its own, to put away while he drinks
    upper.plank_line(shoulder, shoulder.lerp(elbow, 0.4), 0.15, 0.15, P.V_TOP)
    upper.plank_line(shoulder.lerp(elbow, 0.4), elbow, 0.12, 0.12, P.V_ARM)
    upper.build(root)
    m.build(root)
    guitar(root, loc, tilt)
    ipa(root, shoulder)
    # the forearm pivots at the elbow and swings parallel to the top, so it never goes through
    # the guitar; `swing` turns it for a downstroke
    down = out * math.copysign(1, (hand - elbow).cross(-across).dot(out))
    arm = Model("arm_strum")
    arm.box((0.13, 0.13, 0.13), (0, 0, 0), P.V_ARM)                                    # elbow
    arm.plank_line((0, 0, 0), (hand - elbow) * 0.85, 0.11, 0.11, P.V_ARM)
    arm.box((0.11, 0.1, 0.12), hand - elbow, P.SKIN)
    arm.build(root, loc=elbow, swing=y_up(down))


def _ipa_can(m: Model, loc, rot=(0, 0, 0)):
    """His IPA: a tall can, teal with an orange band, nothing like the brown bottles in the crate."""
    turn = Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4()
    m.cyl(0.036, 0.16, loc, "#2a8a80", segs=8, rot=rot)
    m.cyl(0.037, 0.03, turn @ Vector((0, 0, 0.07)), "#e8902a", segs=8, rot=rot)
    m.cyl(0.03, 0.008, turn @ Vector((0, 0, 0.16)), "#d8dde2", segs=8, rot=rot)


def ipa(root, shoulder: Vector):
    """Friday evening (the runtime shows it): an IPA on the grass by his right foot (`ipa`), and,
    between songs, his right arm off the guitar with it up at his mouth (`arm_sip`, pivoting at the
    shoulder; the runtime swaps it in for `arm_strum` and `arm_strum_upper` and lifts it)."""
    g = Model("ipa")
    _ipa_can(g, (-0.44, -0.24, 0))
    g.build(root)
    elbow, hand = Vector((-0.36, -0.3, 1.04)), Vector((-0.1, -0.36, 1.58))
    a = Model("arm_sip")
    a.plank_line((0, 0, 0), (elbow - shoulder) * 0.4, 0.15, 0.15, P.V_TOP)
    a.plank_line((elbow - shoulder) * 0.4, elbow - shoulder, 0.12, 0.12, P.V_ARM)
    a.plank_line(elbow - shoulder, hand - shoulder, 0.11, 0.11, P.V_ARM)
    a.box((0.11, 0.1, 0.12), hand - shoulder, P.SKIN)
    # tipped up, the can's end at his lips and its bottom in the air, in front of his hand
    bottom, lips = Vector((-0.04, -0.46, 1.67)), Vector((0, -0.23, 1.6))
    _ipa_can(a, bottom - shoulder, Vector((0, 0, 1)).rotation_difference((lips - bottom).normalized()).to_euler())
    a.build(root, loc=shoulder)


def _tee(m: Model, z: float, root=None, sport=False, cape=0.5):
    """His torso in the tee with the v-neck and his shades on the collar, the bottom of it at z
    (`sport`: his sports tee, crew-necked, nothing on the collar). Given the `root` the body is
    built in, it also builds what can come out over it with an outfit (dressing), the cape
    reaching `cape` below z."""
    if sport:
        m.box((0.56, 0.34, 0.66), (0, 0.02, z + 0.33), P.VS_TOP)
        m.box((0.2, 0.2, 0.12), (0, 0.0, z + 0.71), P.SKIN)                                # neck
        return
    m.box((0.56, 0.34, 0.66), (0, 0.02, z + 0.33), P.V_TOP)
    m.prism([(-0.1, 0), (0.1, 0), (0, -0.17)], 0.01, (0, -0.152, z + 0.665), P.V_NECK)
    m.box((0.2, 0.2, 0.12), (0, 0.0, z + 0.71), P.SKIN)                                 # neck
    s = Model(f"{m.name}_shades") if root else m                                        # hooked on the collar
    for dz in (0.59, 0.5):
        s.box((0.08, 0.02, 0.07), (-0.08, -0.158, z + dz), P.SHADES)
    s.box((0.02, 0.02, 0.16), (-0.08, -0.158, z + 0.57), P.SHADES_FRAME)
    if root:
        s.build(root, wear="v_shades")
        dressing(root, m.name, z, cape)


# the white dots on his Christmas jumper, (x, height up the front)
_SNOW = [(-0.22, 0.6), (-0.06, 0.62), (0.13, 0.58), (0.23, 0.48), (-0.17, 0.47), (0.0, 0.5), (-0.23, 0.34),
         (0.21, 0.3), (-0.2, 0.2), (-0.12, 0.08), (0.23, 0.15)]


def dressing(root, name: str, z: float, cape: float):
    """What comes out over his tee with an outfit (`wear`, see src/island/scene/wardrobe.ts),
    for a torso from z up: at Christmas the jumper's knitted front, snow
    falling round a reindeer with a scarf on and a nose that lights up; and on Halloween the
    waistcoat and red bow tie, and the black cape with its collar turned up."""
    y = -0.152                                                                           # the front of the tee
    j = Model(f"{name}_reindeer")
    for x, dz in _SNOW:
        j.box((0.05, 0.012, 0.05), (x, y - 0.004, z + dz), P.WHITE)
    j.box((0.56, 0.012, 0.07), (0, y - 0.004, z + 0.04), P.WHITE)                         # snow along the hem
    for s in (-1, 1):                                                                    # antlers
        j.plank_line((0.03 + s * 0.06, y - 0.006, z + 0.36), (0.03 + s * 0.13, y - 0.006, z + 0.52), 0.035, 0.012, P.REINDEER_DARK)
        j.plank_line((0.03 + s * 0.1, y - 0.006, z + 0.44), (0.03 + s * 0.19, y - 0.006, z + 0.48), 0.03, 0.012, P.REINDEER_DARK)
        j.box((0.05, 0.012, 0.04), (0.03 + s * 0.13, y - 0.005, z + 0.33), P.REINDEER_DARK)   # ears
    j.box((0.2, 0.012, 0.18), (0.03, y - 0.004, z + 0.27), P.REINDEER)                    # head
    j.box((0.14, 0.014, 0.08), (0.03, y - 0.006, z + 0.2), P.REINDEER_LIGHT)              # muzzle
    for s in (-1, 1):
        j.box((0.05, 0.014, 0.05), (0.03 + s * 0.045, y - 0.006, z + 0.31), P.WHITE)      # eyes
        j.box((0.025, 0.016, 0.03), (0.03 + s * 0.045, y - 0.008, z + 0.305), P.INK)
    j.box((0.2, 0.014, 0.05), (0.03, y - 0.006, z + 0.13), P.RED)                         # his scarf
    j.box((0.05, 0.014, 0.1), (0.1, y - 0.006, z + 0.08), P.RED)
    j.box((0.06, 0.03, 0.05), (0.03, y - 0.015, z + 0.215), P.RED, glow=True)              # the nose, lit
    j.build(root, wear="v_reindeer")

    w = Model(f"{name}_waistcoat")                                                       # over the white shirt
    w.box((0.58, 0.36, 0.5), (0, 0.02, z + 0.25), P.WAISTCOAT)
    w.prism([(-0.09, 0), (0.09, 0), (0, -0.2)], 0.01, (0, y - 0.012, z + 0.5), P.SHIRT)
    for dz in (0.14, 0.24):
        w.box((0.03, 0.012, 0.03), (0.02, y - 0.012, z + dz), P.GOLD)                     # buttons
    for s in (-1, 1):
        w.box((0.08, 0.02, 0.05), (s * 0.08, y - 0.01, z + 0.66), P.SHIRT, rot=(0, s * 0.5, 0))   # collar points
        w.box((0.09, 0.03, 0.07), (s * 0.06, y - 0.025, z + 0.6), P.BOWTIE, rot=(0, s * 0.3, 0))  # the bow
    w.box((0.04, 0.035, 0.05), (0, y - 0.03, z + 0.6), P.BOWTIE)
    w.build(root, wear="v_waistcoat")

    c = Model(f"{name}_cape")                                                            # off the shoulders, down the back
    bottom = z - cape
    c.prism([(-0.36, z + 0.7), (0.36, z + 0.7), (0.46, bottom), (-0.46, bottom)], 0.04, (0, 0.23, 0), P.CAPE_BLACK)
    for s in (-1, 1):
        c.box((0.04, 0.26, z + 0.66 - bottom), (s * 0.45, 0.1, (z + 0.66 + bottom) / 2), P.CAPE_BLACK)
        c.box((0.14, 0.24, 0.05), (s * 0.36, 0.08, z + 0.69), P.CAPE_BLACK)                # over the shoulders
        c.box((0.24, 0.03, 0.32), (s * 0.15, 0.28, z + 0.86), P.CAPE_BLACK, rot=(-0.25, s * 0.35, 0))       # the collar, up
        c.box((0.2, 0.01, 0.28), (s * 0.145, 0.26, z + 0.85), P.CAPE_LINING, rot=(-0.25, s * 0.35, 0))
    c.build(root, wear="v_cape")


def vincent_kayak(root):
    """Vincent out in the kayak, paddling. Faces -y like everyone, which is where the bow points.
    The runtime moves the whole thing round its loop, and swings `paddle` (the shaft, blades and
    his forearms, pivoting at his chest) from side to side, stroke by stroke."""
    m = Model("vincent_kayak_hull")
    m.ball(1.0, (0, 0, 0.1), P.KAYAK, subdiv=2, scale=(0.38, 2.0, 0.2))
    m.ball(0.3, (0, 0.1, 0.22), P.INK, subdiv=1, scale=(1, 1.6, 0.4))                  # the cockpit
    m.box((0.5, 0.5, 0.06), (0, 0.08, 0.3), P.INK)                                      # spray deck round him
    m.box((0.2, 0.5, 0.04), (0, 1.1, 0.28), "#2a5da8")                                  # a dry bag behind him
    _tee(m, 0.28, sport=True)
    m.box((0.62, 0.4, 0.4), (0, 0.02, 0.58), P.KAYAK_VEST)                              # his buoyancy aid
    m.box((0.5, 0.36, 0.06), (0, 0.02, 0.81), P.KAYAK_VEST_DARK)
    m.box((0.64, 0.42, 0.05), (0, 0.02, 0.44), P.INK)                                   # its waist strap
    m.box((0.06, 0.02, 0.06), (0.12, -0.19, 0.44), P.TUNER)
    for s in (-1, 1):                                                                   # upper arms, out to the elbows
        m.plank_line((s * 0.3, 0.0, 0.88), (s * 0.36, -0.22, 0.68), 0.14, 0.14, P.VS_TOP)
    m.build(root)
    head(root, "head", (0, 0, 1.0), sport=True)
    p = Model("paddle")
    p.plank_line((-1.15, 0, 0), (1.15, 0, 0), 0.05, 0.05, P.WOOD_DARK)
    for s in (-1, 1):
        p.box((0.36, 0.05, 0.16), (s * 1.25, 0, 0), "#2a5da8", rot=(0, s * 0.3, 0))    # blades, feathered a little
        p.plank_line((s * 0.36, 0.2, 0.02), (s * 0.3, 0.0, 0.0), 0.11, 0.11, P.VS_ARM)  # forearms
        p.box((0.1, 0.12, 0.12), (s * 0.3, 0, 0), P.SKIN)                               # hands on the shaft
    p.plank_line((0.3, 0.06, 0.0), (0.3, 0.12, 0.0), 0.13, 0.13, P.WATCH)
    p.build(root, loc=(0, -0.42, 0.7))


def vincent_coding(root):
    """At the computer, making a game: on the desk chair (quarters.py), typing, his hands 0.6 in
    front of him at z = 0.79. Faces -y; the runtime turns `type_l`/`type_r` (his forearms, from
    the elbows) and `code_head` a little."""
    seat = 0.5
    up = seat - 0.56
    m = Model("vincent_coding_body")
    for x in (-0.16, 0.16):
        m.box((0.21, 0.52, 0.21), (x, -0.24, 0.62 + up), P.V_LEGS)                        # thighs
        m.box((0.16, 0.16, 0.52 + up), (x, -0.5, (0.52 + up) / 2 + 0.07), P.V_SHIN)       # bare shins
        m.box((0.2, 0.34, 0.1), (x, -0.56, 0.05), P.SHOE)
    _tee(m, 0.72 + up, root, cape=0.2)
    for s in (-1, 1):
        m.plank_line((s * 0.31, -0.02, 1.3 + up), (s * 0.33, -0.08, 1.16 + up), 0.15, 0.15, P.V_TOP)
        m.plank_line((s * 0.33, -0.08, 1.16 + up), (s * 0.34, -0.14, 1.02 + up), 0.13, 0.13, P.V_ARM)
    m.build(root)
    for s, name in ((-1, "type_r"), (1, "type_l")):
        a = Model(name)
        a.box((0.12, 0.12, 0.12), (0, 0, 0), P.V_ARM)
        a.plank_line((0, 0, 0), (-s * 0.1, -0.4, -0.13), 0.11, 0.11, P.V_ARM)
        a.box((0.11, 0.13, 0.07), (-s * 0.12, -0.46, -0.15), P.SKIN)
        if s > 0:
            a.plank_line((-0.06, -0.26, -0.08), (-0.07, -0.3, -0.1), 0.13, 0.13, P.WATCH)
        a.build(root, loc=(s * 0.34, -0.14, 1.0 + up))
    head(root, "code_head", (0, 0, 1.45 + up))


def vincent_asleep(root, top: float, cell):
    """Fast asleep on his back, head on the pillow, the red check duvet up to his chin (hut.py's
    bed). The group sits at his neck, just over the mattress; the duvet runs off south (-y) from
    `top`, in checks of `cell` lined up with the bed's. `*_head` and `*_body` breathe."""
    m = Model("vincent_asleep_body")
    m.box((0.56, 0.2, 0.2), (0, -0.08, -0.05), P.TEE)                                   # shoulders
    duvet(m, (0, top), 5, cell)
    m.build(root)
    head(root, "vincent_asleep_head", (0, 0, 0.12), rot=(-math.pi / 2, 0.3, 0), cap=False)


def duvet(m: Model, top, rows: int, cell, rise=0.12, parity=1):
    """The duvet over someone in bed: three columns of red and white checks, `rows` long from
    `top` (x, y) southwards, rising `rise` over the made bed at the chest and less towards the
    feet, turned back at the top. z = 0 is roughly where their middle is, and the checks reach
    down 0.13 to meet the rest of the duvet; `parity` picks which colour starts."""
    x0, y0 = top
    cw, cl = cell
    for i in range(rows):
        for j in range(3):
            h = rise * (1 - 0.4 * i / rows) * (0.8 if j != 1 else 1)
            m.box((cw, cl, h + 0.13), (x0 + (j - 1) * cw, y0 - (i + 0.5) * cl, (h - 0.13) / 2),
                  (P.RED, P.WHITE)[(i + j + parity) % 2])
    m.box((3 * cw + 0.02, 0.16, rise + 0.15), (x0, y0 + 0.02, (rise - 0.12) / 2), P.WHITE)       # turned back

def vincent_podcast(root):
    """Vincent on his feet with his big black over-ear headphones on, for pacing about with a
    podcast. Faces -y; the runtime walks him up and down layout.PODCAST_WALK, swinging
    `pod_leg_l/_r` from the hips and `pod_arm_l/_r` from the shoulders, and stops him now and
    then to make a point to nobody with his right hand (`pod_arm_r`) while `pod_head` nods."""
    hip = 0.84
    m = Model("vincent_podcast_body")
    m.box((0.5, 0.3, 0.2), (0, 0, hip + 0.02), P.V_LEGS)
    _tee(m, hip - 0.12, root)
    m.box((0.05, 0.1, 0.16), (0.27, -0.08, hip + 0.05), P.PHONE)                        # his phone, in his pocket
    m.build(root)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"pod_leg_{side}")
        g.box((0.2, 0.22, 0.34), (0, 0, -0.17), P.V_LEGS)
        g.box((0.16, 0.16, 0.44), (0, 0, -0.52), P.V_SHIN)
        g.box((0.2, 0.34, 0.1), (0, -0.05, -0.79), P.SHOE)
        g.box((0.21, 0.35, 0.05), (0, -0.05, -0.835), P.SOLE)
        g.build(root, loc=(s * 0.13, 0, hip))
        a = Model(f"pod_arm_{side}")
        a.box((0.15, 0.15, 0.22), (0, 0, -0.11), P.V_TOP)
        a.box((0.12, 0.12, 0.36), (0, 0, -0.38), P.V_ARM)
        a.box((0.11, 0.12, 0.1), (0, 0, -0.6), P.SKIN)
        if s > 0:
            a.box((0.13, 0.13, 0.05), (0, 0, -0.5), P.WATCH)
        a.build(root, loc=(s * 0.34, 0, hip + 0.48))
    h = head(root, "pod_head", (0, 0, hip + 0.61))
    # the headphones: big cups over his ears, the band arching over the cap
    p = Model("pod_headphones")
    for s in (-1, 1):
        p.box((0.09, 0.2, 0.25), (s * 0.27, 0.02, 0.23), P.PHONES)
        p.box((0.02, 0.1, 0.1), (s * 0.317, 0.02, 0.21), P.COPPER)                        # the ring round the mic
        p.plank_line((s * 0.27, 0.02, 0.35), (s * 0.25, 0.02, 0.6), 0.05, 0.07, P.PHONES)
    p.box((0.52, 0.07, 0.05), (0, 0.02, 0.63), P.PHONES)
    p.build(h)


def vincent_standing(root, prefix: str, apron=False):
    """Vincent on his feet in his tee and shorts, nothing in his hands: for fetching the post, flying
    a kite on the beach or working at the bench in the workshop (`apron`: a canvas one over it).
    Faces -y; the runtime swings `<prefix>_leg_l/_r` from the hips and `<prefix>_arm_l/_r` from
    the shoulders, and turns `<prefix>_head`."""
    hip = 0.84
    m = Model(f"{prefix}_body")
    m.box((0.5, 0.3, 0.2), (0, 0, hip + 0.02), P.V_LEGS)
    _tee(m, hip - 0.12, root)
    if apron:
        m.box((0.46, 0.04, 0.7), (0, -0.165, hip + 0.1), P.CANVAS)
        m.box((0.3, 0.05, 0.12), (0, -0.18, hip + 0.1), P.WOOD_LIGHT)                    # its pocket, a pencil in it
        m.box((0.02, 0.02, 0.18), (0.08, -0.2, hip + 0.2), P.GOLD)
        for s in (-1, 1):
            m.box((0.04, 0.03, 0.3), (s * 0.13, -0.16, hip + 0.55), P.CANVAS, rot=(0, s * 0.3, 0))
    m.build(root)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"{prefix}_leg_{side}")
        g.box((0.2, 0.22, 0.34), (0, 0, -0.17), P.V_LEGS)
        g.box((0.16, 0.16, 0.44), (0, 0, -0.52), P.V_SHIN)
        g.box((0.2, 0.34, 0.1), (0, -0.05, -0.79), P.SHOE)
        g.box((0.21, 0.35, 0.05), (0, -0.05, -0.835), P.SOLE)
        g.build(root, loc=(s * 0.13, 0, hip))
        a = Model(f"{prefix}_arm_{side}")
        a.box((0.15, 0.15, 0.22), (0, 0, -0.11), P.V_TOP)
        a.box((0.12, 0.12, 0.36), (0, 0, -0.38), P.V_ARM)
        a.box((0.11, 0.12, 0.1), (0, 0, -0.6), P.SKIN)
        if s > 0:
            a.box((0.13, 0.13, 0.05), (0, 0, -0.5), P.WATCH)
        a.build(root, loc=(s * 0.34, 0, hip + 0.48))
    return head(root, f"{prefix}_head", (0, 0, hip + 0.61))


def vincent_hiking(root):
    """Vincent on his feet with a pack and boots on, for climbing the mountain. Faces -y; the
    runtime walks the whole thing up the trail (layout.CLIMB) and swings `hike_leg_l/_r` from
    the hips and `hike_arm_l/_r` from the shoulders; `hike_head` looks around at the top."""
    hip = 0.84
    m = Model("vincent_hiking_body")
    m.box((0.5, 0.3, 0.2), (0, 0, hip + 0.02), P.VS_LEGS)
    _tee(m, hip - 0.12, sport=True)
    m.box((0.46, 0.26, 0.56), (0, 0.3, hip + 0.3), P.PACK)                               # the pack
    m.box((0.4, 0.1, 0.22), (0, 0.46, hip + 0.18), P.PACK_DARK)                          # its pocket
    m.cyl(0.1, 0.5, (-0.25, 0.3, hip + 0.64), P.TENT_GREEN, segs=6, rot=(0, math.pi / 2, 0))  # a jacket, rolled
    for s in (-1, 1):
        m.box((0.06, 0.04, 0.5), (s * 0.16, -0.15, hip + 0.32), P.PACK_DARK)             # straps
    m.build(root)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"hike_leg_{side}")
        g.box((0.2, 0.22, 0.34), (0, 0, -0.17), P.VS_LEGS)
        g.box((0.16, 0.16, 0.44), (0, 0, -0.52), P.VS_SHIN)
        g.box((0.2, 0.34, 0.14), (0, -0.05, -0.77), P.BOOT)
        g.box((0.21, 0.35, 0.04), (0, -0.05, -0.83), P.SOLE)
        g.build(root, loc=(s * 0.13, 0, hip))
        a = Model(f"hike_arm_{side}")
        a.box((0.15, 0.15, 0.22), (0, 0, -0.11), P.VS_TOP)
        a.box((0.12, 0.12, 0.36), (0, 0, -0.38), P.VS_ARM)
        a.box((0.11, 0.12, 0.1), (0, 0, -0.6), P.SKIN)
        if s > 0:
            a.box((0.13, 0.13, 0.05), (0, 0, -0.5), P.WATCH)
        a.build(root, loc=(s * 0.34, 0, hip + 0.48))
    head(root, "hike_head", (0, 0, hip + 0.61), sport=True)


# Yoga (vincent_yoga below, companion.yoga): the poses they flow through, as joints in the frame of
# someone facing -y on a mat at z = 0. Limbs run hip/shoulder -> knee/elbow -> foot/hand, for the
# left side (+x); the right side mirrors it unless a pose gives it its own. The head is a pivot
# (at the neck) and a rotation.
POSES = {
    # sitting cross-legged, hands on the knees, eyes front
    "lotus": dict(hips=(0, 0.05, 0.2), neck=(0, 0.05, 0.78),
                  leg=[(0.12, 0.05, 0.14), (0.42, -0.2, 0.1), (-0.1, -0.32, 0.1)],
                  arm=[(0.3, 0.05, 0.7), (0.4, -0.05, 0.4), (0.38, -0.2, 0.2)],
                  head=((0, 0.05, 0.8), (0, 0, 0))),
    # on the left leg, the right foot against the left knee, hands together high overhead
    "tree": dict(hips=(0, 0, 0.84), neck=(0, 0, 1.42),
                 leg=[(0.11, 0, 0.84), (0.11, 0, 0.44), (0.11, -0.05, 0.05)],
                 leg_r=[(-0.11, 0, 0.84), (-0.46, -0.05, 0.56), (0.0, 0.0, 0.46)],
                 arm=[(0.3, 0, 1.36), (0.27, 0, 1.76), (0.05, 0, 2.02)],
                 head=((0, 0, 1.44), (0, 0, 0))),
    # downward dog: hands and feet on the mat, hips up high, looking back through the legs
    "dog": dict(hips=(0, 0.4, 0.95), neck=(0, -0.23, 0.5),
                leg=[(0.12, 0.4, 0.9), (0.13, 0.57, 0.48), (0.13, 0.75, 0.05)],
                arm=[(0.26, -0.21, 0.5), (0.25, -0.47, 0.28), (0.24, -0.7, 0.05)],
                head=((0, -0.3, 0.42), (2.3, 0, 0))),
}


def _person(g, prefix: str, j: dict, look: dict, make_head):
    """A whole person in `g`, jointed as `j` says (see POSES), in `look`'s colours (top, sleeve,
    arm below the sleeve, thigh, shin, skin, feet if not bare, and wider for broader shoulders). An `arm_r` is their
    right arm as its own part (`<prefix>_stroke`), pivoting at the shoulder."""
    m = Model(f"{prefix}_body")
    m.plank_line(j["hips"], j["neck"], 0.5 * look.get("wide", 1.0), 0.3, look["top"])

    def arm(m: Model, sh, el, hand, at=Vector()):
        sh, el, hand = (Vector(v) - at for v in (sh, el, hand))
        mid = sh.lerp(el, 0.45)
        m.plank_line(sh, mid, 0.14, 0.14, look["sleeve"])
        m.plank_line(mid, el, 0.12, 0.12, look.get("arm", look["skin"]))
        m.plank_line(el, hand, 0.11, 0.11, look.get("arm", look["skin"]))
        m.box((0.1, 0.11, 0.1), hand, look["skin"])

    for side in (1, -1):
        hip, knee, foot = j["leg"] if side > 0 or "leg_r" not in j else j["leg_r"]
        if side < 0 and "leg_r" not in j:
            hip, knee, foot = ((-x, y, z) for x, y, z in (hip, knee, foot))
        m.plank_line(hip, knee, 0.2, 0.2, look["thigh"])
        m.plank_line(knee, foot, 0.16, 0.16, look["shin"])
        m.box((0.15, 0.26, 0.08), (foot[0], foot[1] - 0.06, max(0.04, foot[2] - 0.02)), look.get("foot", look["skin"]))
        if side < 0 and "arm_r" in j:
            s = Model(f"{prefix}_stroke")
            arm(s, *j["arm_r"], at=Vector(j["arm_r"][0]))
            s.build(g, loc=j["arm_r"][0])
        else:
            arm(m, *(j["arm"] if side > 0 else ((-x, y, z) for x, y, z in j["arm"])))
    m.build(g)
    loc, rot = j["head"]
    make_head(g, f"{prefix}_head", loc, rot)


def yoga_poses(root, prefix: str, look: dict, make_head):
    """One group per pose (`<prefix>_<pose>`), each a whole person in `look`'s colours; the
    runtime shows one at a time. `make_head(parent, name, loc, rot)` builds the head."""
    for pose, j in POSES.items():
        _person(group(f"{prefix}_{pose}", parent=root), f"{prefix}_{pose}", j, look, make_head)


# Petting (vincent_petting below, companion.petting): up on their knees in front of the bench,
# reaching over to stroke George, or sat back on their heels in Beike's meadow with a hand along
# his back while he lies in front of them. The stroking hand (`arm_r`) is the right one.
PETTING = {
    # the bench is in front of them (-y): its seat's front edge 0.4 away, George 0.63 away and 0.75 up
    "cats": dict(hips=(0, -0.04, 0.6), neck=(0, -0.14, 1.12),
                 leg=[(0.12, -0.04, 0.58), (0.13, -0.12, 0.1), (0.12, 0.34, 0.06)],
                 arm=[(0.28, -0.12, 1.06), (0.36, -0.3, 0.82), (0.32, -0.46, 0.6)],
                 arm_r=[(-0.28, -0.12, 1.06), (-0.3, -0.38, 0.9), (-0.08, -0.6, 0.76)],
                 head=((0, -0.15, 1.14), (0.35, 0, 0))),
    # Beike lying across in front of them, 0.62 away, head to their left: a hand on his shoulders
    "beike": dict(hips=(0, 0.18, 0.36), neck=(0, -0.06, 0.88),
                  leg=[(0.12, 0.16, 0.34), (0.13, -0.22, 0.1), (0.12, 0.3, 0.06)],
                  arm=[(0.28, -0.05, 0.82), (0.36, -0.25, 0.58), (0.3, -0.5, 0.46)],
                  arm_r=[(-0.28, -0.05, 0.82), (-0.3, -0.3, 0.62), (-0.14, -0.52, 0.5)],
                  head=((0, -0.07, 0.9), (0.5, 0, 0))),
}


def petting(root, prefix: str, pet: str, look: dict, make_head):
    """Someone kneeling to pet the cats or Beike (PETTING[pet]), facing -y."""
    _person(root, prefix, PETTING[pet], look, make_head)


def vincent_yoga(root):
    """Vincent on his mat (rust red), barefoot in his sports things, flowing through the POSES; she sometimes joins
    him on the next mat along (companion.yoga)."""
    m = Model("vincent_yoga_mat")
    m.box((0.8, 1.9, 0.02), (0, 0, 0.01), P.PACK)
    m.box((0.8, 0.04, 0.021), (0, 0.9, 0.011), P.PACK_DARK)
    m.cyl(0.05, 0.22, (-0.62, 0.7, 0), P.WHITE, segs=8)                                # water bottle
    m.build(root)
    yoga_poses(root, "vincent_yoga", dict(top=P.VS_TOP, sleeve=P.VS_TOP, arm=P.VS_ARM, thigh=P.VS_LEGS, shin=P.VS_SHIN,
                                          skin=P.SKIN, wide=1.1),
               lambda parent, name, loc, rot: head(parent, name, loc, rot=rot, sport=True))


def vincent_petting(root, pet: str):
    """Vincent on his knees in the grass, petting the cats on their bench or Beike (PETTING)."""
    petting(root, f"vincent_petting_{pet}", pet,
            dict(top=P.V_TOP, sleeve=P.V_TOP, arm=P.V_ARM, thigh=P.V_LEGS, shin=P.V_SHIN, skin=P.SKIN, foot=P.SHOE, wide=1.1),
            lambda parent, name, loc, rot: head(parent, name, loc, rot=rot))


# sitting cross-legged on a cushion, hands resting one in the other in the lap, head a little bowed
SITTING = dict(hips=(0, 0.05, 0.34), neck=(0, 0.06, 0.92),
               leg=[(0.12, 0.05, 0.3), (0.42, -0.2, 0.12), (-0.1, -0.32, 0.12)],
               arm=[(0.3, 0.06, 0.84), (0.33, -0.08, 0.52), (0.04, -0.2, 0.4)],
               head=((0, 0.06, 0.94), (0.12, 0, 0)))


def vincent_meditating(root):
    """Vincent sitting on a cushion (SITTING), eyes shut, his shoes kicked off beside him. Faces -y;
    the runtime opens an eye now and then (`vincent_meditate_head_peek`) and nods the head with his breath."""
    m = Model("vincent_meditate_cushion")
    m.cyl(0.3, 0.16, (0, 0.0, 0), P.CUSHION, segs=10)
    m.cyl(0.26, 0.02, (0, 0.0, 0.16), P.CUSHION_TOP, segs=10)
    for x in (0.5, 0.64):                                                              # his shoes
        m.box((0.13, 0.26, 0.09), (x, 0.3, 0.045), P.SHOE, rot=(0, 0, 0.2))
    m.build(root)
    _person(root, "vincent_meditate", SITTING,
            dict(top=P.V_TOP, sleeve=P.V_TOP, arm=P.V_ARM, thigh=P.V_LEGS, shin=P.V_SHIN, skin=P.SKIN, wide=1.1),
            lambda parent, name, loc, rot: head(parent, name, loc, rot=rot, shut=True))


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
