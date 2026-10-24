"""Their pastimes in places of their own round the island (src/island/scene/pastimes.ts):

  hammock   a striped hammock slung between two oaks on the lawn north of the lighthouse path, for
            a warm day. All that swings hangs off `hammock_swing`, which turns about the line between
            the two ties: her in it with a book (`companion_hammock`), or him asleep with his book
            face down on his chest (`vincent_hammock`).
  boulder   Vincent bouldering on the block up on the north-west cliffs (props.boulder): a crash pad
            in front of its south face with his chalk bag and brush, a yellow problem up the face
            (`boulder_hold_<n>`, each with `<..>_out` a little way out from the rock, so the runtime
            knows which way the rock faces there), and him, jointed so the runtime can put his
            hands and feet on them: `boulder_body` at the hips carries `boulder_torso` (and the
            head and the arms, `boulder_upper_l/r` with `boulder_fore_l/r` at the elbow) and the
            legs (`boulder_thigh_l/r` with `boulder_shin_l/r` at the knee). Every limb hangs
            straight down from its joint as built.

Everyone faces -y in their own frame; z = 0 is what they're on.
"""
from __future__ import annotations

import math

import bpy

import characters
import companion
import layout as L
import palette as P
from kit import Model, group
from mathutils import Matrix, Vector

CANVAS_RED = "#c8503a"         # the hammock: cream canvas, red and teal stripes
CANVAS_TEAL = "#2f8f9a"
CANVAS_CREAM = "#efe3c4"
HAMMOCK_ROPE = "#d8c9a4"


def _limb(m: Model, a, b, size, color):
    m.plank_line(a, b, size, size, color)


def _facing(up, face):
    """The rotation (an Euler) that turns a head built upright facing -y so its top points along
    `up` and its face along `face`."""
    up, face = Vector(up).normalized(), Vector(face).normalized()
    y = -face
    x = y.cross(up).normalized()
    up = x.cross(y)
    return tuple(Matrix((x, y, up)).transposed().to_euler())


# --- the hammock -------------------------------------------------------------------------------

HAMMOCK_HALF = 1.15        # half the length of the bed of it, spreader bar to spreader bar
HAMMOCK_LOW = 0.6          # the lowest of it, in the middle
HAMMOCK_BARS = 1.0         # how high the spreader bars hang
HAMMOCK_TIE = 1.75         # how high it's tied to the trees
HAMMOCK_WIDE = 0.86


def _sag(x):
    """The height of the hammock's bed at x along it, from the ground."""
    k = x / HAMMOCK_HALF
    return HAMMOCK_LOW + (HAMMOCK_BARS - HAMMOCK_LOW) * k * k


def hammock(t, a, b):
    """The hammock slung between trunks at a and b (Blender x, y), the length of it along x."""
    (ax, ay), (bx, by) = a, b
    cx, cy = (ax + bx) / 2, (ay + by) / 2
    span = math.hypot(bx - ax, by - ay)
    turn = math.atan2(by - ay, bx - ax)
    z0 = t.sample(cx, cy)
    root = group("hammock", (cx, cy, z0), rot_z=turn, id="hammock")
    tie = span / 2 - 0.24                                                                # round the trunk, on this side of it
    for s in (-1, 1):                                                                     # rope round each trunk
        r = Model(f"hammock_tie_{'e' if s > 0 else 'w'}")
        zt = t.sample(cx + math.cos(turn) * s * span / 2, cy + math.sin(turn) * s * span / 2) - z0 + HAMMOCK_TIE
        r.box((0.1, 0.48, 0.07), (s * (span / 2 - 0.2), 0, zt), HAMMOCK_ROPE)
        r.box((0.06, 0.06, 0.14), (s * tie, 0, zt - 0.06), P.IRON)                         # the ring
        r.build(root)
    # what swings: about the line through the two rings
    swing = group("hammock_swing", (0, 0, HAMMOCK_TIE), parent=root)
    m = Model("hammock_bed")
    zt = -HAMMOCK_TIE
    for s in (-1, 1):
        bar = s * HAMMOCK_HALF
        m.box((0.06, HAMMOCK_WIDE + 0.12, 0.06), (bar, 0, zt + HAMMOCK_BARS), P.WOOD_LIGHT)   # spreader bar
        for i in range(5):                                                                # the strings, fanning in to the ring
            y = (i - 2) / 2 * HAMMOCK_WIDE * 0.5
            m.plank_line((bar, y, zt + HAMMOCK_BARS + 0.02), (s * (tie - 0.02), 0, -0.1), 0.015, 0.015, HAMMOCK_ROPE)
    # the bed: strips across, following the sag, each a little dished so the sides come up round whoever's in it
    n = 14
    stripes = [CANVAS_CREAM, CANVAS_RED, CANVAS_RED, CANVAS_TEAL, CANVAS_TEAL]                # along it, from the middle out
    for i in range(n):
        x0 = -HAMMOCK_HALF + i * 2 * HAMMOCK_HALF / n
        x1 = x0 + 2 * HAMMOCK_HALF / n
        xm = (x0 + x1) / 2
        z = zt + _sag(xm)
        slope = math.atan2(_sag(x1) - _sag(x0), x1 - x0)
        for j, (y, lift) in enumerate(((0, 0.0), (-0.29, 0.1), (0.29, 0.1), (-0.42, 0.28), (0.42, 0.28))):
            w = 0.34 if j == 0 else 0.28 if j < 3 else 0.16
            tilt = 0 if j == 0 else (0.7 if y > 0 else -0.7) if j < 3 else (1.25 if y > 0 else -1.25)
            m.box((x1 - x0 + 0.005, w, 0.03), (xm, y, z + lift), stripes[j], rot=(tilt, -slope, 0))
    m.build(swing)
    return root, swing


def companion_hammock(swing):
    """Her lying back in the hammock with a book held up, one leg over the near side with the foot
    down to give it a push now and then (`companion_hammock_shin`). Built head to +x, then turned
    round, so her head's at the west end, out from under the oaks."""
    g = group("companion_hammock", (0, 0, 0), rot_z=math.pi, parent=swing, id="companion_hammock")
    zt = -HAMMOCK_TIE
    bed = lambda x, dz=0.0: zt + _sag(x) + dz                                           # noqa: E731
    m = Model("companion_hammock_body")
    hips, neck = Vector((-0.12, 0, bed(-0.12, 0.14))), Vector((0.42, 0, bed(0.42, 0.3)))
    m.plank_line(hips, neck, 0.26, 0.42, P.E_TOP)
    m.box((0.28, 0.42, 0.22), (-0.16, 0, bed(-0.16, 0.13)), P.E_LEGS)                     # hips
    # right leg along the hammock, knee up a little
    knee, foot = Vector((-0.6, -0.1, bed(-0.6, 0.25))), Vector((-0.98, -0.08, bed(-0.98, 0.16)))
    _limb(m, (-0.18, -0.1, bed(-0.18, 0.14)), knee, 0.18, P.E_LEGS)
    _limb(m, knee, foot, 0.15, P.E_LEGS)
    m.box((0.28, 0.16, 0.1), foot + Vector((-0.06, 0, 0.04)), P.SNEAKER)
    # the other thigh out over the side
    lknee = Vector((-0.4, 0.5, bed(-0.4, 0.2)))
    _limb(m, (-0.18, 0.1, bed(-0.18, 0.14)), lknee, 0.18, P.E_LEGS)
    # both arms up, holding the book over her chest
    book = Vector((0.36, 0, bed(0.36, 0.62)))
    for s in (-1, 1):
        sh = Vector((0.38, s * 0.22, bed(0.38, 0.32)))
        el = Vector((0.18, s * 0.3, bed(0.18, 0.42)))
        hand = book + Vector((-0.04, s * 0.15, -0.02))
        _limb(m, sh, sh.lerp(el, 0.4), 0.14, P.E_TOP)
        _limb(m, sh.lerp(el, 0.4), el, 0.12, P.E_ARM)
        _limb(m, el, hand, 0.11, P.E_ARM)
        m.box((0.1, 0.09, 0.1), hand, P.FAIR)
    m.build(g)
    k = Model("companion_hammock_book")                                                 # held open, facing her
    k.box((0.04, 0.42, 0.3), (0.02, 0, 0), P.BOOKS[4], rot=(0, -0.5, 0))
    k.box((0.03, 0.38, 0.27), (0.045, 0, 0.0), P.CANVAS, rot=(0, -0.5, 0))
    k.build(g, loc=tuple(book))
    s = Model("companion_hammock_shin")                                                  # over the side, toes to the grass
    _limb(s, (0, 0, 0), (0.02, 0.05, -0.46), 0.15, P.E_LEGS)
    s.box((0.28, 0.16, 0.09), (-0.04, 0.06, -0.5), P.SNEAKER)                             # pointing along, as you'd push off
    s.box((0.29, 0.17, 0.03), (-0.04, 0.06, -0.545), P.PEBBLE)
    s.build(g, loc=tuple(lknee))
    companion.head(g, "companion_hammock_head", tuple(neck + Vector((0.04, 0, 0.0))),
                   rot=_facing((1, 0, 0.75), (-0.35, 0.1, 1)))


def vincent_hammock(swing):
    """Him asleep in the hammock, hands behind his head, his book face down on his chest, his
    head at the west end like hers; he breathes (`vincent_hammock_chest`)."""
    g = group("vincent_hammock", (0, 0, 0), rot_z=math.pi, parent=swing, id="vincent_hammock")
    zt = -HAMMOCK_TIE
    bed = lambda x, dz=0.0: zt + _sag(x) + dz                                           # noqa: E731
    m = Model("vincent_hammock_body")
    m.box((0.3, 0.48, 0.22), (-0.16, 0, bed(-0.16, 0.13)), P.V_LEGS)                     # hips
    for s in (-1, 1):                                                                    # legs along it, ankles crossed
        knee = Vector((-0.6, s * 0.11, bed(-0.6, 0.22)))
        foot = Vector((-1.0, -s * 0.03, bed(-1.0, 0.18)))
        _limb(m, (-0.2, s * 0.12, bed(-0.2, 0.14)), knee, 0.2, P.V_LEGS)
        _limb(m, knee, foot, 0.16, P.V_SHIN)
        m.box((0.32, 0.18, 0.11), foot + Vector((-0.08, 0, 0.05 + 0.03 * s)), P.SHOE)
    # hands behind his head, elbows out
    nape = Vector((0.5, 0, bed(0.5, 0.32)))
    for s in (-1, 1):
        sh = Vector((0.38, s * 0.27, bed(0.38, 0.3)))
        el = Vector((0.6, s * 0.42, bed(0.6, 0.36)))
        _limb(m, sh, sh.lerp(el, 0.45), 0.15, P.V_TOP)
        _limb(m, sh.lerp(el, 0.45), el, 0.12, P.V_ARM)
        _limb(m, el, nape + Vector((0.08, s * 0.07, 0.06)), 0.11, P.V_ARM)
    m.build(g)
    c = Model("vincent_hammock_chest")                                                  # breathes; the book rides on it
    c.plank_line((-0.16, 0, 0), (0.52, 0, 0.18), 0.3, 0.5, P.V_TOP)
    c.box((0.06, 0.2, 0.08), (0.5, 0.14, 0.15), P.SHADES)                               # his shades, hooked on the collar
    c.prism([(-0.16, 0), (0.16, 0), (0.12, 0.12), (-0.12, 0.12)], 0.36, (0.2, 0, 0.17), P.BOOKS[1], rot=(0, -0.26, 0))  # face down, open
    c.box((0.3, 0.32, 0.02), (0.2, 0, 0.19), P.CANVAS, rot=(0, -0.26, 0))
    c.build(g, loc=(0, 0, bed(0, 0.16)))
    characters.head(g, "vincent_hammock_head", tuple(nape + Vector((0.02, 0, 0.0))), shut=True,
                    rot=_facing((1, 0, 0.6), (-0.3, 0.15, 1)))


# --- bouldering -------------------------------------------------------------------------------

CHALK = "#f1efe8"
PAD = "#2f4f6f"                # the crash pad: navy, with an orange trim and black straps
PAD_TRIM = "#d8743a"
CHALK_BAG = "#c8403a"
CLIMB_SHOE = "#d8b03a"         # yellow climbing shoes, black rand
HOLD = "#e8b24a"               # the yellow problem (content.ts: "Yellow holds, V4")
# the problem, up the south face (x across, z up, Blender, from the boulder's foot): the holds
# for the hands, then the feet, and the two over the top for the top-out
PROBLEM = {
    "h0": (-0.35, 1.25), "h1": (0.15, 1.15), "h2": (0.4, 1.85), "h3": (-0.25, 2.35), "h4": (0.3, 2.85),
    "f0": (-0.3, 0.45), "f1": (0.2, 0.4), "f2": (-0.12, 0.95), "f3": (0.38, 1.15), "f4": (-0.3, 1.6), "f5": (0.2, 1.85),
}
TOP = {"t0": (-0.25, -0.75), "t1": (0.3, -0.7)}        # x, y on top of it


def _limb_part(parent, name: str, loc, length: float, size: float, color, end=None):
    """A limb as its own part, hanging straight down `length` from its joint at `loc`."""
    m = Model(name)
    m.box((size, size, length + 0.04), (0, 0, -length / 2), color)
    if end:
        end(m)
    return m.build(parent, loc=loc)


def climber(g):
    """Vincent jointed for climbing (see the module notes), facing -y, standing, hips at 0.84."""
    hip = 0.84
    body = group("boulder_body", (0, 0, hip), parent=g)
    shorts = Model("boulder_shorts")
    shorts.box((0.5, 0.3, 0.22), (0, 0, 0.0), P.VS_LEGS)
    shorts.build(body)
    torso = group("boulder_torso", (0, 0, 0), parent=body)
    t = Model("boulder_chest")
    characters._tee(t, -0.12, sport=True)
    t.build(torso)
    characters.head(torso, "boulder_head", (0, 0, 0.61), sport=True)
    for s, side in ((1, "l"), (-1, "r")):
        u = Model(f"boulder_upper_{side}")                                                # the sleeve, then the arm
        u.box((0.15, 0.15, 0.16), (0, 0, -0.06), P.VS_TOP)
        u.box((0.12, 0.12, 0.18), (0, 0, -0.21), P.VS_ARM)
        up = u.build(torso, loc=(s * 0.34, 0, 0.48))

        def hand(m: Model):
            m.box((0.11, 0.12, 0.11), (0, 0, -0.33), CHALK)                               # chalky hands
        _limb_part(up, f"boulder_fore_{side}", (0, 0, -0.3), 0.28, 0.115, P.VS_ARM, hand)
        th = _limb_part(body, f"boulder_thigh_{side}", (s * 0.13, 0, 0), 0.42, 0.19, P.VS_SHIN)

        def shoe(m: Model):
            m.box((0.17, 0.3, 0.1), (0, -0.06, -0.42), CLIMB_SHOE)                        # toes pointing, as climbing shoes do
            m.box((0.18, 0.31, 0.035), (0, -0.06, -0.47), P.INK)
        _limb_part(th, f"boulder_shin_{side}", (0, 0, -0.42), 0.38, 0.15, P.VS_SHIN, shoe)
    # the shorts come down over the top of the thighs
    for s, side in ((1, "l"), (-1, "r")):
        o = bpy.data.objects[f"boulder_thigh_{side}"]
        k = Model(f"boulder_shorts_{side}")
        k.box((0.21, 0.24, 0.24), (0, 0, -0.1), P.VS_LEGS)
        k.build(o)
    return body


def bouldering(t):
    """Vincent's crash pad in front of the boulder's south face, his problem up it, and him."""
    root = bpy.data.objects["boulder"]
    rock = next(c for c in root.children if c.type == "MESH")
    x0, y0 = L.BOULDER
    g = group("vincent_boulder", (x0, y0, root.location.z), parent=None, id="vincent_boulder")
    core = Vector((0, 0, 1.0))
    group("boulder_core", tuple(core), parent=g)

    def surface(o: Vector, d: Vector):
        hit, at, normal, _ = rock.ray_cast(o, d.normalized())
        assert hit, f"missed the boulder from {tuple(o)}"
        return at, normal

    holds = Model("boulder_problem")
    marks = []
    for name, (x, z) in PROBLEM.items():
        marks.append((name, *surface(Vector((x, -4.0, z)), Vector((0, 1, 0)))))
    for name, (x, y) in TOP.items():
        marks.append((name, *surface(Vector((x, y, 4.0)), Vector((0, 0, -1)))))
    for name, at, normal in marks:
        rot = Vector((0, 0, 1)).rotation_difference(normal).to_euler()
        big = 0.15 if name[0] in "ht" else 0.11
        holds.box((big, big * 0.8, 0.07), tuple(at + normal * 0.02), HOLD, rot=tuple(rot))
        if name[0] != "t":                                                                 # chalk where the hands go
            holds.box((big * 0.7, big * 0.6, 0.02), tuple(at + normal * 0.06 + Vector((0, 0, 0.03))), CHALK, rot=tuple(rot))
        group(f"boulder_hold_{name}", tuple(at), parent=g)
        group(f"boulder_hold_{name}_out", tuple(at + normal * 0.3), parent=g)
    holds.build(root)                                                                     # the problem stays when he's gone
    # the pad, folded out flat in front of it, with the chalk bag and the brush on the corner
    pad = Model("boulder_pad")
    py = -2.1
    pad.box((1.5, 1.1, 0.14), (0, py, 0.07), PAD)
    pad.box((1.52, 0.06, 0.145), (0, py - 0.53, 0.072), PAD_TRIM)
    pad.box((1.52, 0.06, 0.145), (0, py + 0.53, 0.072), PAD_TRIM)
    pad.box((0.02, 1.1, 0.142), (0, py, 0.071), P.INK)                                     # the hinge
    for x in (-0.4, 0.4):
        pad.box((0.06, 1.12, 0.15), (x, py, 0.075), P.INK)                                 # straps
    pad.cyl(0.08, 0.16, (0.62, py - 0.38, 0.14), CHALK_BAG, segs=8, r_top=0.07)
    pad.cyl(0.072, 0.02, (0.62, py - 0.38, 0.3), CHALK, segs=8)
    pad.box((0.22, 0.04, 0.03), (0.4, py - 0.42, 0.155), P.WOOD_LIGHT, rot=(0, 0, 0.4))   # the brush
    pad.box((0.12, 0.05, 0.03), (0.32, py - 0.46, 0.17), P.INK, rot=(0, 0, 0.4))
    pad.cyl(0.05, 0.22, (-0.62, py - 0.4, 0.14), P.WHITE, segs=8)                          # water bottle
    pad.box((0.36, 0.16, 0.12), (-0.5, py + 0.75, 0.06), P.SHOE, rot=(0, 0, 0.3))          # his trainers, kicked off
    pad.box((0.36, 0.16, 0.12), (-0.25, py + 0.82, 0.06), P.SHOE, rot=(0, 0, 0.1))
    pad.build(g)
    group("boulder_pad_seat", (0, py, 0.14), parent=g)
    group("boulder_bag", (0.62, py - 0.38, 0.3), parent=g)
    climber(group("boulder_climber", (0, py, 0.14), rot_z=math.pi, parent=g))


def populate(t):
    """Everything above, in its place. The hammock is slung between the two oaks nearest
    layout.HAMMOCK's ends (the scatter grows them), so it needs the trees out first."""
    trees = [o for o in bpy.data.objects if o.name.startswith("tree") and o.parent is None]
    ends = []
    for x, y in L.HAMMOCK:
        near = min(trees, key=lambda o: math.hypot(o.location.x - x, o.location.y - y))
        assert math.hypot(near.location.x - x, near.location.y - y) < 0.6, f"no oak to tie the hammock to near {(x, y)}"
        ends.append((near.location.x, near.location.y))
    _, swing = hammock(t, *ends)
    companion_hammock(swing)
    vincent_hammock(swing)
    bouldering(t)
