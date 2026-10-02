"""Imaginary creatures (src/island/scene/sightings.ts), from the 2022 blog posts where GPT-3 wrote
the field notes and DALL·E painted them: the island's rarest visitors, each with its own weather.

  snorble      a curl of russet fur round a pale head and a long pink snout, napping in a sunbeam
  balloonbug   a bug blown up into an orange and pink teardrop, drifting over on a still afternoon
  fosha        a small blue fox with curled ears, sat on the high meadow looking up at the stars
  treestrider  a leaf-green wedge on five metres of stilt legs, wading the shallows on a misty morning
  mosslits     little glowing slugs in the moss at the wood's edge, their tail-lights curled up

Templates like the wildlife (fauna.py merges ALL into its own): parked under a root tagged
`fauna=<name>`, facing +x, y to their left, z = 0 the ground (the treestrider's the sea's
surface; its feet are in the water). Parts that move are their own objects.
"""
from __future__ import annotations

import math

from mathutils import Vector

import palette as P
from kit import Model

# the snorble's fur "can appear to have multiple colours": russet, caramel and honey, with a
# rosy sheen, and a halo of cream fluff round the edge; its face is pale and pink
SNORBLE = ["#b8784c", "#a4643e", "#c98e5a", "#b87a68"]
SNORBLE_DARK = "#8a5636"
SNORBLE_FLUFF = "#ecd6bc"
SNORBLE_FACE = "#f6e2e2"
SNORBLE_EAR = "#7a3e4c"
SNOUT = "#f2c2cc"
SNOUT_TIP = "#e898b0"
SNOUT_NOSE = "#5a2c3c"

# the balloonbug is orange on top, blushing to a pink-magenta underneath, with gold streaks
BUG = "#ec6a32"
BUG_LIGHT = "#f89a4c"
BUG_BLUSH = "#e0525a"
BUG_PINK = "#c83c78"
BUG_STRIPE = "#f6c84a"
BUG_SPOT = "#2a1a22"
BUG_HEAD = "#1d1a24"
BUG_LEG = "#e4e2e6"

FOSHA = "#3a5ed8"        # deep royal blue
FOSHA_DARK = "#24338c"   # navy, in the shadows and round the eyes
FOSHA_LIGHT = "#62c4f0"  # the cyan of its mane
FOSHA_PALE = "#b8c8f8"   # the inside of its ears
FOSHA_EYE = "#9ff0ff"

STRIDER = "#b4c23a"
STRIDER_LIGHT = "#e2e06a"
STRIDER_DARK = "#5e7a2a"
STRIDER_EDGE = "#d0602a"
STRIDER_LEG = "#b08c34"
STRIDER_JOINT = "#5a4426"
STRIDER_EYE = "#e8902c"

SHELL = "#1c5a4c"  # the mosslits' foot: their glow is all on top
GLOW = "#7cffc8"
GLOW_TIP = "#d8fff0"

TROMB = "#e2d4ea"
TROMB_SHADE = "#b8a4c8"
TROMB_STRIPE = "#3f9cb8"
TROMB_STRIPE_DARK = "#2f6f94"
TROMB_HORN = "#cbb8dc"
TROMB_EYE = "#c42a32"
TROMB_SNOUT = "#d6c4e0"
TROMB_SEGS = 9      # the snout's segments, each its own object so it can curl and uncurl
TROMB_SEG = 0.1     # and each one's length


def _limb(m: Model, a, b, r0, r1, color, segs=5, glow=False):
    """A tapered round limb from a (radius r0) to b (radius r1)."""
    d = Vector(b) - Vector(a)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    m.cyl(r0, d.length, a, color, segs=segs, r_top=r1, rot=tuple(rot), glow=glow)


def snorble(root):
    """Curled up asleep in a ring of russet fluff (`snorble_body`, which breathes), its pale head
    tucked in at the front and the long pink snout laid out on the grass (`snorble_head`, which
    lifts to sniff the air), a round ear cocked even in its sleep."""
    b = Model("snorble_body", seed=7)
    b.ball(0.28, (-0.08, 0, 0.24), SNORBLE_DARK, subdiv=2, scale=(1.1, 1.05, 0.8), jitter=0.01)  # the hollow of the curl
    # the curl: from its shoulders, round the back, to a tail tucked in by its nose
    n = 12
    for i in range(n):
        k = i / (n - 1)
        a = math.radians(55 + k * 250)
        r = 0.2 - k * 0.08
        x, y = math.cos(a) * 0.3 - 0.08, math.sin(a) * 0.3
        b.ball(r, (x, y, 0.1 + r * 1.1), SNORBLE[i % 4], subdiv=2, scale=(1.15, 1.15, 1.25), jitter=0.012)
        # a halo of cream fluff round the outside, where the sun catches it
        for da in ((0, 0.5) if i < n - 1 else (0,)):
            a2 = a + math.radians(da * 250 / (n - 1))
            out = 0.3 + r * 0.62
            b.ball(r * 0.66, (math.cos(a2) * out - 0.08, math.sin(a2) * out, 0.1 + r * 1.35), SNORBLE_FLUFF,
                   subdiv=1, scale=(1.2, 1.2, 0.85), jitter=0.012)
    b.ball(0.15, (0.12, 0.04, 0.18), SNORBLE_FACE, subdiv=1, scale=(1.2, 1.2, 1.0), jitter=0.01)  # the pale scruff behind its head
    body = b.build(root)
    h = Model("snorble_head")  # pivots under the brow, the snout reaching out along +x
    h.ball(0.17, (0.0, 0, 0.0), SNORBLE_FACE, subdiv=2, scale=(1.25, 1.05, 0.95), jitter=0.006)
    _limb(h, (0.08, 0, -0.03), (0.52, 0, -0.12), 0.125, 0.045, SNOUT, segs=8)              # the long snout, on the grass
    _limb(h, (0.07, 0, -0.028), (0.24, 0, -0.064), 0.13, 0.102, SNORBLE_FACE, segs=8)     # pale where it meets the face
    h.ball(0.05, (0.52, 0, -0.12), SNOUT_TIP, subdiv=1, scale=(1.1, 1.0, 0.9))
    h.ball(0.026, (0.565, 0, -0.115), SNOUT_NOSE, subdiv=1)                                # its nose, dark at the tip
    for s in (1, -1):
        h.box((0.065, 0.02, 0.016), (0.1, s * 0.15, 0.03), P.INK, rot=(0, 0.25, 0))         # eyes shut: two dark lines
        h.cyl(0.085, 0.03, (-0.1, s * 0.11, 0.09), SNOUT, segs=8, rot=(-s * 1.2, 0, 0))     # a round ear, pink-rimmed
        h.cyl(0.055, 0.03, (-0.1, s * 0.125, 0.095), SNORBLE_EAR, segs=8, rot=(-s * 1.2, 0, 0))
    h.build(body, loc=(0.3, 0, 0.16))


def balloonbug(root):
    """Its backside blown up like a hot-air balloon (`balloonbug_balloon`: the runtime blows it up
    and lets it down), round on top and tapering to a point, where its little black head hangs
    (`balloonbug_body`) with its pale legs dangling (`balloonbug_legs`)."""
    # the balloon's outline, from the tip up: (height, radius, colour), pink below and orange above
    rings = [(0.0, 0.03, BUG_PINK), (0.07, 0.11, BUG_PINK), (0.17, 0.2, BUG_PINK), (0.29, 0.29, BUG_PINK),
             (0.4, 0.345, BUG_BLUSH), (0.48, 0.37, BUG), (0.51, 0.375, BUG_STRIPE), (0.54, 0.38, BUG), (0.66, 0.37, BUG),
             (0.76, 0.33, BUG), (0.85, 0.25, BUG), (0.91, 0.14, BUG), (0.94, 0.0, BUG)]

    def round_at(z):  # the balloon's radius at a height, for things on its skin
        for (z0, r0, _), (z1, r1, _) in zip(rings, rings[1:]):
            if z0 <= z <= z1:
                return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
        return 0.0

    bal = Model("balloonbug_balloon", seed=3)
    for (z0, r0, c), (z1, r1, _) in zip(rings, rings[1:]):
        bal.cyl(r0, z1 - z0, (0, 0, z0), c, segs=12, r_top=r1)
    bal.cyl(round_at(0.3) + 0.006, 0.025, (0, 0, 0.3), BUG_STRIPE, segs=12, r_top=round_at(0.325) + 0.006)  # a lower streak
    for i in range(12):  # dark spots, sprinkled over the orange
        a = i * 2.39
        z = 0.42 + (i * 0.618 % 1) * 0.36
        r = round_at(z)
        bal.ball(0.022 + (i % 3) * 0.008, (math.cos(a) * r, math.sin(a) * r, z), BUG_SPOT, subdiv=1, scale=(1, 1, 0.8))
    z = 0.72
    bal.ball(0.06, (round_at(z) * 0.72, -round_at(z) * 0.5, z), BUG_LIGHT, subdiv=1, scale=(0.6, 1, 1.4))  # a shine
    balloon = bal.build(root, loc=(0, 0, 0.12))
    bd = Model("balloonbug_body")  # at the tip: a little black head peeping out, eyes and feelers
    bd.ball(0.055, (0.01, 0, -0.03), BUG_HEAD, subdiv=1, scale=(1.1, 1, 1))
    for s in (1, -1):
        bd.box((0.022, 0.022, 0.022), (0.06, s * 0.025, -0.02), P.WHITE)                       # eyes
        _limb(bd, (0.04, s * 0.02, -0.06), (0.11, s * 0.06, -0.1), 0.007, 0.005, BUG_LEG, segs=3)  # feelers
    bd.build(balloon, loc=(0, 0, 0.02))
    lg = Model("balloonbug_legs")  # three pairs splayed out from under the head, swinging
    for i, x in enumerate((0.03, 0.0, -0.03)):
        for s in (1, -1):
            knee = (x + (1 - i) * 0.05, s * 0.13, -0.03)
            _limb(lg, (x, s * 0.03, 0), knee, 0.011, 0.009, BUG_LEG, segs=3)
            _limb(lg, knee, (x + (1 - i) * 0.08, s * 0.17, -0.12), 0.009, 0.006, BUG_LEG, segs=3)
    lg.build(balloon, loc=(0, 0, -0.03))


def fosha(root):
    """Sitting up on its haunches (`fosha_body`), its head (`fosha_head`) tipped back to the stars,
    long ears (`fosha_ear_l/r`) swept back and curled like a fern, and a big soft tail
    (`fosha_tail`) round its feet. Deep blue, with a shaggy cyan mane and eyes full of stars."""
    b = Model("fosha_body", seed=11)
    b.ball(0.16, (-0.05, 0, 0.16), FOSHA, subdiv=2, scale=(1.15, 0.95, 1.0))               # haunches
    b.ball(0.11, (0.03, 0, 0.35), FOSHA, subdiv=2, scale=(0.95, 0.85, 1.3))                # chest, upright
    b.ball(0.09, (0.08, 0, 0.42), FOSHA_LIGHT, subdiv=1, scale=(0.8, 1.0, 1.0))            # the mane
    for x, y, z, l in ((0.12, 0, 0.36, 0.16), (0.11, 0.05, 0.38, 0.14), (0.11, -0.05, 0.38, 0.14),
                       (0.06, 0.09, 0.42, 0.13), (0.06, -0.09, 0.42, 0.13), (0.13, 0.025, 0.3, 0.12)):
        _limb(b, (x, y, z), (x + 0.03, y * 1.2, z - l), 0.04, 0.004, FOSHA_LIGHT, segs=4)    # shaggy tufts, hanging
    for s in (1, -1):
        b.ball(0.08, (-0.03, s * 0.12, 0.14), FOSHA_DARK, subdiv=1, scale=(1.5, 0.6, 1.2))    # thighs in shadow
        _limb(b, (0.08, s * 0.05, 0.3), (0.12, s * 0.05, 0.02), 0.032, 0.024, FOSHA)          # front legs, straight
        b.box((0.07, 0.045, 0.03), (0.14, s * 0.05, 0.015), FOSHA_LIGHT)
        b.ball(0.06, (0.03, s * 0.12, 0.04), FOSHA, subdiv=1, scale=(1.5, 0.7, 0.6))     # hind feet
    for _ in range(5):  # a few specks of starlight caught in its coat
        a = b.rng.uniform(0, 2 * math.pi)
        b.box((0.018, 0.018, 0.018), (math.cos(a) * 0.12 - 0.04, math.sin(a) * 0.13, b.rng.uniform(0.1, 0.3)), FOSHA_EYE, glow=True)
    body = b.build(root)
    h = Model("fosha_head")  # pivots at the neck
    h.ball(0.105, (0.02, 0, 0.05), FOSHA, subdiv=1, scale=(1.1, 1.0, 1.0))
    h.cyl(0.055, 0.14, (0.06, 0, 0.02), FOSHA_LIGHT, segs=4, r_top=0.012, rot=(0, math.pi / 2, 0))  # a fox's muzzle
    h.box((0.025, 0.03, 0.025), (0.2, 0, 0.025), P.INK)
    for s in (1, -1):
        h.ball(0.04, (0.04, s * 0.075, -0.01), FOSHA_LIGHT, subdiv=1, scale=(1.2, 0.6, 1.0))  # pale cheeks
        h.box((0.07, 0.02, 0.05), (0.06, s * 0.075, 0.075), FOSHA_DARK, rot=(0, -0.3, 0))    # the dark mask
        h.box((0.04, 0.02, 0.04), (0.08, s * 0.084, 0.07), FOSHA_EYE, glow=True)              # eyes full of stars
    head = h.build(body, loc=(0.08, 0, 0.48))
    # each ear sweeps back off the crown and rolls up into a curl, pale at the heart
    curl = ((0, 0, 0, 0.03), (-0.07, 0, 0.07, 0.034), (-0.15, 0, 0.09, 0.03), (-0.2, 0, 0.04, 0.025),
            (-0.18, 0, -0.02, 0.02), (-0.13, 0, -0.02, 0.015), (-0.12, 0, 0.02, 0.01))
    for s in (1, -1):
        e = Model(f"fosha_ear_{'l' if s > 0 else 'r'}")
        for i, ((x0, _, z0, r0), (x1, _, z1, r1)) in enumerate(zip(curl, curl[1:])):
            _limb(e, (x0, 0, z0), (x1, 0, z1), r0, r1, FOSHA_PALE if i >= 4 else FOSHA, segs=4)
        e.ball(0.028, (-0.15, -s * 0.012, 0.03), FOSHA_PALE, subdiv=1, scale=(1.3, 0.4, 1.3))  # the inside of the roll
        e.build(head, loc=(-0.0, s * 0.055, 0.11)).rotation_euler = (-s * 0.3, 0, 0)
    t = Model("fosha_tail")  # from the rump, round on the grass
    for i, (x, y, z, r) in enumerate(((-0.06, 0.02, -0.02, 0.06), (-0.1, 0.1, -0.08, 0.075), (-0.02, 0.17, -0.1, 0.075), (0.09, 0.16, -0.11, 0.06))):
        t.ball(r, (x, y, z), FOSHA_LIGHT if i == 3 else FOSHA, subdiv=1, scale=(1.3, 1.0, 0.8))
    t.build(body, loc=(-0.18, 0, 0.13))


def treestrider(root):
    """Five metres tall: a sharp, leaf-shaped body like a katydid's, yellow-green and edged in
    orange, slung between four stilt legs (`treestrider_leg_*`, each its own object so the
    runtime can stride them), its head (`treestrider_head`) the low front end of the wedge, with
    a big round eye on either side."""
    H = 4.6  # the body's height above the water

    def hull(m, rings, top, under):
        """A faceted body lofted through diamond rings (x, ridge z, half width, flank z, keel z), a
        ring of (x, z) being a point: the upper facets in `top`, the lower ones in `under`."""
        import bmesh
        loops = []
        for r in rings:
            if len(r) == 2:
                loops.append([m.bm.verts.new((r[0], 0, r[1]))] * 4)
            else:
                x, zt, w, zs, zb = r
                loops.append([m.bm.verts.new(p) for p in ((x, 0, zt), (x, w, zs), (x, 0, zb), (x, -w, zs))])
        paint = [m._slot(c, False) for c in (top, under, under, top)]
        faces = []
        for a, c in zip(loops, loops[1:]):
            for i in range(4):
                j = (i + 1) % 4
                quad = [a[i], c[i], c[j], a[j]]
                quad = [v for k, v in enumerate(quad) if v not in quad[:k]]
                f = m.bm.faces.new(quad)
                f.material_index = paint[i]
                faces.append(f)
        for ring in (loops[0], loops[-1]):  # cap an open end
            if ring[0] is not ring[1]:
                f = m.bm.faces.new(ring)
                f.material_index = paint[2]
                faces.append(f)
        bmesh.ops.recalc_face_normals(m.bm, faces=faces)

    b = Model("treestrider_body", seed=5)
    # a leaf of a back: up from the neck in one long slope to a sharp point behind, high over the legs
    hull(b, [(-1.15, 0.95),
             (-0.7, 0.72, 0.2, 0.2, -0.12),
             (-0.15, 0.5, 0.32, 0.02, -0.34),
             (0.45, 0.26, 0.3, -0.06, -0.36),
             (0.62, 0.2, 0.28, -0.07, -0.32)], STRIDER, STRIDER_DARK)
    _limb(b, (-1.1, 0, 0.93), (0.6, 0, 0.21), 0.03, 0.03, STRIDER_LIGHT, segs=4)        # the midrib
    for s in (1, -1):  # an orange edge along each flank, as if the leaf were turning
        _limb(b, (-1.12, s * 0.02, 0.92), (-0.7, s * 0.21, 0.2), 0.035, 0.035, STRIDER_EDGE, segs=4)
        _limb(b, (-0.7, s * 0.21, 0.2), (-0.15, s * 0.33, 0.02), 0.035, 0.035, STRIDER_EDGE, segs=4)
    _limb(b, (-1.12, 0, 0.9), (-0.68, 0, -0.14), 0.04, 0.04, STRIDER_EDGE, segs=4)       # and down its back edge
    body = b.build(root, loc=(0, 0, H))
    h = Model("treestrider_head")  # pivots at the neck; the face points down and ahead, to browse
    hull(h, [(-0.05, 0.1, 0.28, -0.17, -0.42),
             (0.3, -0.05, 0.3, -0.3, -0.55),
             (0.58, -0.3, 0.22, -0.5, -0.65),
             (0.72, -0.6)], STRIDER, STRIDER_DARK)
    _limb(h, (0.55, 0, -0.62), (0.74, 0, -0.62), 0.06, 0.02, STRIDER_EDGE, segs=4)         # mouthparts
    for s in (1, -1):  # big round eyes, ringed in orange
        h.ball(0.19, (0.4, s * 0.25, -0.36), STRIDER_EYE, subdiv=1, scale=(1, 0.6, 1))
        h.ball(0.13, (0.42, s * 0.32, -0.36), P.INK, subdiv=1, scale=(1, 0.6, 1))
    h.build(body, loc=(0.6, 0, 0.1))
    # four legs like a stick insect's, from under the body: the front pair reaching down and
    # ahead to a low knee, the back pair up and out behind to a high one, then long shins down to
    # knobbly ankles and feet in the water, spread wide so all four read from the side. Each leg
    # bends at the knee: a thigh (`treestrider_leg_*`) from the hip, a shin (`treestrider_shin_*`)
    # hung from the knee, and a foot (`treestrider_foot_*`) at its end, which the runtime plants
    for tag, (fx, fy) in zip(("fl", "fr", "bl", "br"), ((1, 1), (1, -1), (-1, 1), (-1, -1))):
        knee = Vector((1.0, fy * 0.7, -0.7) if fx > 0 else (-1.15, fy * 0.85, 0.55))
        ankle = Vector((fx * 1.55, fy * 1.2, -H + 0.7)) - knee
        foot = Vector((fx * 1.7, fy * 1.3, -H - 0.3)) - knee
        g = Model(f"treestrider_leg_{tag}")
        _limb(g, (0, 0, 0), knee, 0.09, 0.07, STRIDER_LEG, segs=5)
        g.ball(0.1, knee, STRIDER_JOINT, subdiv=1)
        thigh = g.build(body, loc=(fx * 0.3, fy * 0.2, -0.15))
        sh = Model(f"treestrider_shin_{tag}")
        _limb(sh, (0, 0, 0), ankle, 0.07, 0.05, STRIDER_LEG, segs=5)
        sh.ball(0.07, ankle, STRIDER_JOINT, subdiv=1)
        _limb(sh, ankle, foot, 0.05, 0.03, STRIDER_LEG, segs=5)
        shin = sh.build(thigh, loc=knee)
        ft = Model(f"treestrider_foot_{tag}")
        ft.ball(0.06, (0, 0, 0), STRIDER_JOINT, subdiv=1, scale=(1.4, 1, 0.5))
        ft.build(shin, loc=foot)


def mosslits(root):
    """Three little glowing slugs creeping along together, as in the painting: a soft teal body that tapers to a
    point, speckled with light, and a long tail rising behind in an S and rolling up like a fern frond, with the
    light-sensing tip at the heart of the curl (`mosslits_light_*`, which glow and pulse). Each one is its own
    object: `mosslits_snail_*`."""
    for i, (x, y, turn) in enumerate(((0.0, 0.0, 0.2), (0.2, 0.14, -0.3), (-0.16, 0.2, 0.5))):
        s = Model(f"mosslits_snail_{i}", seed=20 + i)
        s.ball(0.04, (0.0, 0, 0.012), SHELL, subdiv=1, scale=(2.2, 0.95, 0.4))                # the soft foot
        s.ball(0.04, (-0.015, 0, 0.032), GLOW, subdiv=1, scale=(1.6, 0.85, 0.85), glow=True)   # a plump glowing body
        _limb(s, (0.0, 0, 0.032), (0.12, 0, 0.01), 0.03, 0.003, GLOW, segs=6, glow=True)        # tapering to a point
        for _ in range(6):                                                                     # specks of light
            u = s.rng.uniform(-0.05, 0.06)
            s.box((0.009,) * 3, (u, s.rng.uniform(-0.015, 0.015), 0.062 - max(0.0, u) * 0.4), GLOW_TIP, glow=True)
        # the tail: up behind in an S, then rolled up tight, thinning as it goes
        pts = [(-0.06, 0.035), (-0.085, 0.065), (-0.1, 0.11)]
        cx, cz, turns = -0.06, 0.17, 380
        for k in range(11):
            t = k / 10
            a = math.radians(180 - turns * t)
            r = 0.045 - 0.033 * t
            pts.append((cx + math.cos(a) * r, cz + math.sin(a) * r))
        n = len(pts) - 1
        for k, (a, c) in enumerate(zip(pts, pts[1:])):
            _limb(s, (a[0], 0, a[1]), (c[0], 0, c[1]), 0.018 - 0.013 * k / n, 0.018 - 0.013 * (k + 1) / n, GLOW, segs=5, glow=True)
        for k, side in ((1, 1), (3, -1), (6, 1), (8, -1)):                                    # and a few up the tail
            s.box((0.008,) * 3, (pts[k][0], side * 0.011, pts[k][1]), GLOW_TIP, glow=True)
        snail = s.build(root, loc=(x, y, 0), rot_z=turn)
        lt = Model(f"mosslits_light_{i}")
        lt.ball(0.014, (0, 0, 0), GLOW_TIP, subdiv=1, glow=True)
        lt.build(snail, loc=(pts[-1][0], 0, pts[-1][1]))


def _ring(m: Model, x, ry, rz, z, color, width=0.035):
    """A stripe round a body whose cross-section at x is an ellipse ry by rz, centred at height z."""
    m.cyl(1.0, width, (x - width / 2, 0, z), color, segs=10, rot=(0, math.pi / 2, 0))
    # (squashed to the ellipse below, by scaling the ring's verts)
    m.bm.verts.ensure_lookup_table()
    for v in m.bm.verts[-20:]:
        v.co.y *= ry * 1.06
        v.co.z = z + (v.co.z - z) * rz * 1.06


def tromb(root):
    """Crouched on a rock at the water's edge, like the painting: a pale lilac lizard banded in
    teal (`tromb_body`, its legs folded under it), a long striped tail (`tromb_tail`), and a
    narrow head (`tromb_head`) with a frill, a red eye and two long horns swept up and back. Its
    snout is a chain of segments (`tromb_snout_0` … from the head out, each the child of the last)
    that the runtime curls into the loop at its tip, and straightens to fish. The tongue
    (`tromb_tongue`, from the snout's tip) rolls out to the water; a fish (`tromb_fish`) on the
    end of it, now and then."""
    b = Model("tromb_body", seed=13)
    b.ball(0.2, (0, 0, 0.2), TROMB, subdiv=2, scale=(2.2, 0.8, 0.72))
    b.ball(0.15, (0.02, 0, 0.14), TROMB_SHADE, subdiv=1, scale=(2.4, 0.85, 0.5))        # the belly, in shadow
    for i, x in enumerate((-0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3)):
        k = math.sqrt(max(0.0, 1 - (x / 0.44) ** 2))
        _ring(b, x, 0.16 * k, 0.145 * k, 0.2, TROMB_STRIPE if i % 2 else TROMB_STRIPE_DARK)
    for i in range(6):  # a low crest of little spines down the back
        b.box((0.035, 0.02, 0.06), (0.26 - i * 0.1, 0, 0.34 - abs(i - 2.5) * 0.01), TROMB_STRIPE_DARK, taper=0.2)
    for s in (1, -1):
        # front legs, braced on the edge of the rock
        _limb(b, (0.24, s * 0.1, 0.16), (0.28, s * 0.23, 0.13), 0.04, 0.032, TROMB)
        _limb(b, (0.28, s * 0.23, 0.13), (0.36, s * 0.19, 0.0), 0.03, 0.025, TROMB_SHADE)
        b.box((0.08, 0.06, 0.02), (0.39, s * 0.18, 0.01), TROMB_SHADE)
        # hind legs, folded up like a frog's, knees high
        _limb(b, (-0.22, s * 0.11, 0.18), (-0.12, s * 0.26, 0.27), 0.06, 0.045, TROMB)
        _limb(b, (-0.12, s * 0.26, 0.27), (-0.26, s * 0.25, 0.02), 0.04, 0.03, TROMB_SHADE)
        b.box((0.11, 0.07, 0.02), (-0.24, s * 0.25, 0.01), TROMB_SHADE)
    body = b.build(root)
    t = Model("tromb_tail", seed=14)  # from the hips, curving off down the back of the rock
    n = 9
    pts = [(-i * 0.1, math.sin(i * 0.35) * 0.08, -0.03 * i - 0.004 * i * i) for i in range(n)]
    for i, (a_, c_) in enumerate(zip(pts, pts[1:])):
        r = 0.075 * (1 - i / n) + 0.008
        _limb(t, a_, c_, r, r * 0.88, TROMB_STRIPE if i % 2 else TROMB, segs=7)
    t.build(body, loc=(-0.42, 0, 0.21))
    h = Model("tromb_head", seed=15)  # pivots at the neck; the head is long and narrow, like a heron's
    _limb(h, (-0.06, 0, -0.04), (0.06, 0, 0.0), 0.08, 0.075, TROMB, segs=6)              # the neck
    h.ball(0.09, (0.1, 0, 0.02), TROMB, subdiv=2, scale=(1.5, 0.85, 0.85))
    _ring(h, 0.02, 0.075, 0.075, 0.0, TROMB_STRIPE, 0.03)
    for s in (1, -1):
        h.ball(0.032, (0.15, s * 0.062, 0.04), TROMB_EYE, subdiv=1, scale=(1.1, 0.6, 1.0))  # the red eye
        h.box((0.015, 0.01, 0.02), (0.165, s * 0.08, 0.045), P.INK)
        # a frill behind the eye, swept back like an ear
        _limb(h, (0.06, s * 0.06, 0.06), (-0.06, s * 0.16, 0.16), 0.035, 0.004, TROMB_SHADE, segs=4)
        # two long horns, up off the crown and curving back
        horn = [(0.08, s * 0.03, 0.08), (0.05, s * 0.05, 0.3), (-0.02, s * 0.07, 0.5), (-0.12, s * 0.08, 0.64)]
        for i, (a_, c_) in enumerate(zip(horn, horn[1:])):
            _limb(h, a_, c_, 0.022 - i * 0.006, 0.016 - i * 0.006 + 0.002, TROMB_HORN, segs=5)
    head = h.build(body, loc=(0.42, 0, 0.3))
    # the snout: a chain of segments out of the front of the head, tapering
    parent, at = head, (0.22, 0, 0.0)
    for i in range(TROMB_SEGS):
        g = Model(f"tromb_snout_{i}")
        r0 = 0.04 - i * 0.0028
        _limb(g, (0, 0, 0), (TROMB_SEG, 0, 0), r0, r0 - 0.0028, TROMB_SNOUT if i % 3 else TROMB_SHADE, segs=6)
        parent = g.build(parent, loc=at)
        at = (TROMB_SEG, 0, 0)
    tip = Model("tromb_snout_tip")
    tip.ball(0.022, (0.01, 0, 0), TROMB_SHADE, subdiv=1)
    tip.build(parent, loc=at)
    tg = Model("tromb_tongue")  # rolled out, 1 m long at scale 1 along +x (the runtime stretches it)
    _limb(tg, (0, 0, 0), (1.0, 0, 0), 0.024, 0.018, TROMB_SNOUT, segs=6)              # the snout, rolled right out
    tg.ball(0.03, (1.0, 0, 0), TROMB_SHADE, subdiv=1)
    tongue = tg.build(parent, loc=at)
    f = Model("tromb_fish")  # caught on the end
    f.ball(0.06, (0.0, 0, -0.04), "#b8c4cc", subdiv=1, scale=(0.7, 0.6, 2.0))
    f.box((0.02, 0.08, 0.06), (0.0, 0, -0.18), "#8a9aa4")
    f.build(tongue, loc=(1.0, 0, 0))


ALL = {
    "snorble": (snorble, 1.3),
    "balloonbug": (balloonbug, 2.4),
    "fosha": (fosha, 2.2),
    "treestrider": (treestrider, 1.4),
    "mosslits": (mosslits, 4.5),
    "tromb": (tromb, 2.3),
}
