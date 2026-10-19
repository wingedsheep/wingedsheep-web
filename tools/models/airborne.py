"""The Airborne commemoration's Dakota and its parachutists (src/island/scene/airborne.ts sends
them over on the day; holidays.py parks them under the island).

  dakota      a C-47 as it flew in September 1944: olive drab over grey, the black and white
              invasion stripes round the wings and the rear fuselage, an RAF roundel on the
              stripes, a fin flash, and the cargo door open on the port side. Its propellers
              (`dakota_prop_l`, `dakota_prop_r`) spin about x. Nose +x, y to port, z up, the
              origin on the fuselage's axis at the wing.
  parachute   one jumper under a round canopy, ribbed where the lines pull the gores in. The
              root's origin is at the jumper's feet. `chute_canopy_<n>` (one colour each: olive,
              khaki and, rarely, white) pivots at the risers' confluence above his head, with the
              lines and risers down to his shoulders; `chute_jumper` (pivoting at his feet) has
              his arms and legs (`chute_arm_l/r` at the shoulders, `chute_leg_l/r` at the hips)
              and, in his arms, the rolled-up canopy (`chute_bundle_<n>`) for once he's down;
              `chute_bag` is the kit bag he lowers on its line (`chute_bagline`, 1 m, for the
              runtime to stretch) once his canopy's open.

Built big: a jumper is a person's height, and the plane two thirds of a real one's size.
"""
from __future__ import annotations

import math

import bmesh

from kit import Model, group

OLIVE = "#5f6442"
OLIVE_DARK = "#474b33"
UNDER = "#8a8c86"           # the underside's grey
STRIPE_W = "#ece6d6"
STRIPE_B = "#1e1c22"
GLASS = "#2c3a4a"
DOORWAY = "#15131a"
PROP = "#222026"
PROP_TIP = "#e8c440"
ROUNDEL = ["#e8c440", "#2a3f7a", "#ece6d6", "#b83a32"]   # yellow ring, blue, white, red (type C1)
FIN_FLASH = ["#b83a32", "#ece6d6", "#2a3f7a"]
TYRE = "#1d1a24"

# the canopies, two tones a gore: olive drab, khaki, and white
CANOPIES = [("#6e6f4a", "#5e5f3f"), ("#c4b88e", "#b0a47c"), ("#e8e4d6", "#d4cfc0")]
CANOPY_INSIDE = ["#3f402c", "#7d7458", "#9a968a"]
LINE = "#a39c84"
SMOCK = "#7a6a48"            # the Denison smock, brown and green
SMOCK_DARK = "#59583a"
SMOCK_RED = "#8c6444"
HARNESS = "#b8a47a"
TROUSERS = "#6b6248"
BOOT = "#3a2a20"
HELMET = "#4a4d34"
SKIN = "#e0a882"
BAG = "#55583a"

STRIPES = 5                  # three white, two black


def _loft(m: Model, sections, paint, caps=True):
    """Skin closed loops of points (each as long as the next) one to the next; `paint(i, j)` is
    the colour between section i and i + 1, from point j to j + 1. Capped at both ends."""
    rings = [[m.bm.verts.new(p) for p in s] for s in sections]
    n = len(sections[0])
    faces = []
    for i, (a, b) in enumerate(zip(rings, rings[1:])):
        for j in range(n):
            k = (j + 1) % n
            f = m.bm.faces.new((a[j], a[k], b[k], b[j]))
            f.material_index = m._slot(paint(i, j), False)
            faces.append(f)
    if caps:
        for ring, i in ((rings[0], 0), (rings[-1], len(rings) - 2)):
            f = m.bm.faces.new(ring)
            f.material_index = m._slot(paint(i, 0), False)
            faces.append(f)
    bmesh.ops.recalc_face_normals(m.bm, faces=faces)


def _lerp(table, x):
    """Linear interpolation in [(x, (values…)), …], x descending or ascending."""
    pts = sorted(table)
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, v0), (x1, v1) in zip(pts, pts[1:]):
        if x <= x1:
            t = (x - x0) / (x1 - x0)
            return tuple(a + (b - a) * t for a, b in zip(v0, v1))
    return pts[-1][1]


# --- the Dakota ----------------------------------------------------------------------------

# the fuselage: x, (half width, half height, centre height); the tail sweeps up
FUSELAGE = [
    (6.05, (0.12, 0.12, -0.02)), (5.85, (0.38, 0.36, -0.03)), (5.5, (0.58, 0.56, 0.0)),
    (5.0, (0.72, 0.72, 0.04)), (4.4, (0.78, 0.8, 0.06)), (3.4, (0.8, 0.83, 0.06)),
    (1.0, (0.8, 0.83, 0.06)), (-0.8, (0.78, 0.81, 0.07)), (-3.0, (0.62, 0.66, 0.16)),
    (-4.2, (0.46, 0.5, 0.28)), (-5.3, (0.24, 0.28, 0.42)), (-6.1, (0.1, 0.12, 0.5)),
]
STRIPE_AFT = (-1.6, -3.0)         # the bands round the rear fuselage, front to back
SEGS = 16


def _ring(x, w, h, zc):
    out = []
    for j in range(SEGS):
        a = j / SEGS * math.tau
        s = math.sin(a)
        out.append((x, w * math.cos(a), zc + h * s * (0.9 if s < 0 else 1.0)))   # a flatter belly
    return out


def _fuselage(m: Model):
    xs = [6.05, 5.85, 5.5, 5.25, 5.0, 4.7, 4.4, 3.4, 1.0, -0.8]
    x0, x1 = STRIPE_AFT
    xs += [x0 + (x1 - x0) * k / STRIPES for k in range(STRIPES + 1)]
    xs += [-4.2, -5.3, -6.1]
    sections = [_ring(x, *_lerp(FUSELAGE, x)) for x in xs]

    def paint(i, j):
        mid = (xs[i] + xs[i + 1]) / 2
        a = (j + 0.5) / SEGS * math.tau
        up, side = math.sin(a), abs(math.cos(a))
        if x1 < mid < x0:
            band = int((x0 - mid) / ((x0 - x1) / STRIPES))
            return STRIPE_W if band % 2 == 0 else STRIPE_B
        if 5.0 < mid < 5.5 and up > 0.45:                       # the windscreen
            return GLASS
        if 4.4 < mid < 5.0 and 0.2 < up < 0.75 and side > 0.5:  # the cockpit's side windows
            return GLASS
        return UNDER if up < -0.35 else OLIVE

    _loft(m, sections, paint)
    # the cabin windows, both sides, and the cargo door open on the port side
    for x in (2.4, 1.7, 1.0, 0.3, -0.4):
        for s in (1, -1):
            m.box((0.24, 0.05, 0.22), (x, s * 0.79, 0.3), GLASS)
    m.box((0.62, 0.06, 1.0), (-1.05, 0.775, 0.02), DOORWAY)
    m.box((0.7, 0.07, 0.06), (-1.05, 0.775, 0.55), OLIVE_DARK)                     # the frame
    m.box((0.7, 0.07, 0.06), (-1.05, 0.775, -0.51), OLIVE_DARK)
    # the roundel, on the stripes
    w = _lerp(FUSELAGE, -2.2)[0]
    for s in (1, -1):
        for k, (r, c) in enumerate(zip((0.38, 0.33, 0.2, 0.12), ROUNDEL)):
            m.cyl(r, 0.03 + k * 0.012, (-2.2, s * (w - 0.04), 0.18), c, segs=14, rot=(-s * math.pi / 2, 0, 0))
    m.ball(0.13, (3.9, 0, 0.88), GLASS, subdiv=1, scale=(1.3, 1, 0.6))               # the astrodome
    m.box((0.05, 0.03, 0.35), (3.2, 0, 1.02), OLIVE_DARK, rot=(0, -0.4, 0))          # aerial mast


# the wing: y, (leading edge x, chord, height); the outer panels have dihedral
WING = [(0.4, (1.55, 2.95, -0.5)), (2.9, (1.45, 2.8, -0.5)), (8.9, (-0.15, 1.1, 0.13)), (9.15, (-0.35, 0.65, 0.16))]
WING_STRIPES = (3.3, 4.7)


def _airfoil(y, le, c, z):
    t = 0.13 * c
    return [(le, y, z), (le - 0.1 * c, y, z + 0.55 * t), (le - 0.35 * c, y, z + 0.62 * t), (le - 0.75 * c, y, z + 0.3 * t),
            (le - c, y, z + 0.02), (le - 0.75 * c, y, z - 0.12 * t), (le - 0.35 * c, y, z - 0.3 * t), (le - 0.1 * c, y, z - 0.3 * t)]


def _wings(m: Model):
    a, b = WING_STRIPES
    ys = [0.4, 2.9] + [a + (b - a) * k / STRIPES for k in range(STRIPES + 1)] + [6.5, 8.9, 9.15]
    for side in (1, -1):
        sections = [_airfoil(side * y, *_lerp(WING, y)) for y in ys]

        def paint(i, j):
            mid = (ys[i] + ys[i + 1]) / 2
            if a < mid < b:
                return STRIPE_W if int((mid - a) / ((b - a) / STRIPES)) % 2 == 0 else STRIPE_B
            return OLIVE if j < 4 else UNDER

        _loft(m, sections, paint)


def _nacelle(m: Model, y):
    z = -0.42
    table = [(2.15, (0.44,)), (1.6, (0.46,)), (1.0, (0.42,)), (0.0, (0.36,)), (-1.0, (0.24,)), (-1.6, (0.1,))]
    xs = [2.15, 1.6, 1.0, 0.0, -1.0, -1.6]
    sections = []
    for x in xs:
        r = _lerp(table, x)[0]
        sections.append([(x, y + r * math.cos(t), z + r * math.sin(t)) for t in (k / 12 * math.tau for k in range(12))])
    _loft(m, sections, lambda i, j: OLIVE_DARK if i == 0 else (UNDER if math.sin((j + 0.5) / 12 * math.tau) < -0.3 else OLIVE))
    m.cyl(0.36, 0.04, (2.16, y, z), "#2e2a3a", segs=12, rot=(0, math.pi / 2, 0))     # the engine, in its cowling
    for k in range(9):                                                               # its cylinders, in a ring
        t = k / 9 * math.tau
        m.box((0.06, 0.1, 0.1), (2.17, y + 0.25 * math.cos(t), z + 0.25 * math.sin(t)), "#55505e")
    m.cyl(0.13, 0.22, (2.18, y, z), OLIVE_DARK, segs=8, r_top=0.04, rot=(0, math.pi / 2, 0))   # the hub
    m.cyl(0.3, 0.16, (0.7, y + 0.08, -0.82), TYRE, segs=10, rot=(math.pi / 2, 0, 0))  # the wheel, half up in its well


def _tail(m: Model):
    m.prism([(-3.7, 0.55), (-4.5, 0.75), (-5.0, 1.3), (-5.3, 2.0), (-5.5, 2.4), (-5.75, 2.55), (-6.0, 2.45),
             (-6.15, 2.0), (-6.2, 0.55)], 0.12, (0, 0, 0), OLIVE)
    for k, c in enumerate(FIN_FLASH):
        m.box((0.18, 0.15, 0.55), (-5.4 - k * 0.18, 0, 1.05), c)
    tail = [(-4.5, 0.3), (-4.9, 2.4), (-5.25, 2.85), (-5.7, 2.9), (-6.05, 2.5), (-6.15, 0.3),
            (-6.15, -0.3), (-6.05, -2.5), (-5.7, -2.9), (-5.25, -2.85), (-4.9, -2.4), (-4.5, -0.3)]
    m.slab(tail, 0.42, 0.52, OLIVE)
    m.box((0.06, 0.06, 0.18), (-5.2, 0, 0.12), OLIVE_DARK)                           # the tail wheel
    m.cyl(0.12, 0.08, (-5.2, 0.04, 0.02), TYRE, segs=8, rot=(math.pi / 2, 0, 0))


def _propeller(name, parent, at):
    p = Model(name)
    for k in range(3):
        a = k * math.tau / 3
        for length, r0, c in ((0.95, 0.06, PROP), (0.16, 0.95, PROP_TIP)):
            d = r0 + length / 2
            p.box((0.05, 0.13, length), (0, -math.sin(a) * d, math.cos(a) * d), c, rot=(a, 0, 0))
    p.build(parent, loc=at)


def dakota(parent):
    m = Model("dakota")
    _fuselage(m)
    _wings(m)
    for s in (1, -1):
        _nacelle(m, s * 2.05)
    _tail(m)
    body = m.build(parent)
    for s, tag in ((1, "l"), (-1, "r")):
        _propeller(f"dakota_prop_{tag}", body, (2.32, s * 2.05, -0.42))
    return body


# --- the parachutist -----------------------------------------------------------------------

GORES = 14
# the canopy, apex down to the skirt: (radius, height above the confluence)
DOME = [(0.25, 5.32), (0.9, 5.22), (1.55, 4.98), (2.05, 4.62), (2.38, 4.18), (2.5, 3.8), (2.42, 3.6)]
CONFLUENCE = 2.0           # how high the risers meet above his feet
RISER = 0.22


def _canopy(name, parent, colors, inside):
    """A round canopy, ribbed: between the seams each gore bellies out, and dips at the skirt."""
    m = Model(name)
    rings = []
    for i, (r, z) in enumerate(DOME):
        ring = []
        for k in range(GORES * 2):
            a = k / (GORES * 2) * math.tau
            mid = k % 2 == 1
            rr = r * (1.07 if mid and i > 0 else 1.0)
            zz = z + (0.12 if mid and i == len(DOME) - 1 else 0.0)
            ring.append(m.bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, zz)))
        rings.append(ring)
    n = GORES * 2
    out = [m._slot(c, False) for c in colors]
    under = m._slot(inside, False)
    for a, b in zip(rings, rings[1:]):
        for j in range(n):
            k = (j + 1) % n
            f = m.bm.faces.new((a[j], b[j], b[k], a[k]))       # outwards
            f.material_index = out[(j // 2) % 2]
    # the underside, a shade darker: its own skin, a hair inside the top one
    for a, b in zip(rings, rings[1:]):
        for j in range(n):
            k = (j + 1) % n
            vs = [m.bm.verts.new(v.co * 0.985) for v in (a[j], a[k], b[k], b[j])]
            f = m.bm.faces.new(vs)
            f.material_index = under
    m.cyl(0.27, 0.08, (0, 0, DOME[0][1] - 0.02), colors[1], segs=GORES)                  # the vent's band
    # the lines, from the seams at the skirt to the two risers, and the risers down to his shoulders
    skirt = DOME[-1]
    for k in range(GORES):
        a = k / GORES * math.tau
        y = math.sin(a)
        m.plank_line((math.cos(a) * skirt[0], y * skirt[0], skirt[1]), (0, RISER if y >= 0 else -RISER, 0), 0.03, 0.03, LINE)
    for s in (1, -1):
        m.plank_line((0, s * RISER, 0), (0.02, s * 0.2, -0.55), 0.06, 0.03, HARNESS)
    return m.build(parent, loc=(0, 0, CONFLUENCE))


def _limb(m: Model, a, b, w, color):
    m.plank_line(a, b, w, w, color)


def parachute(parent):
    for n, (colors, inside) in enumerate(zip(CANOPIES, CANOPY_INSIDE)):
        _canopy(f"chute_canopy_{n}", parent, colors, inside)
    j = Model("chute_jumper", seed=7)
    j.box((0.3, 0.42, 0.58), (0, 0, 1.15), SMOCK)                                       # the smock
    for _ in range(9):                                                                 # its camouflage
        j.box((0.31, j.rng.uniform(0.08, 0.16), j.rng.uniform(0.06, 0.14)),
              (0, j.rng.uniform(-0.16, 0.16), j.rng.uniform(0.92, 1.38)), j.rng.choice([SMOCK_DARK, SMOCK_RED]))
    j.box((0.34, 0.46, 0.08), (0, 0, 0.9), HARNESS)                                     # the harness
    for s in (1, -1):
        j.box((0.33, 0.06, 0.56), (0, s * 0.12, 1.17), HARNESS)
    j.box((0.14, 0.32, 0.22), (0.2, 0, 1.0), OLIVE_DARK)                                # the reserve, on his chest
    j.ball(0.115, (0.01, 0, 1.58), SKIN, subdiv=1, scale=(1, 0.95, 1.05))
    j.ball(0.16, (-0.01, 0, 1.64), HELMET, subdiv=1, scale=(1.05, 1.05, 0.68))           # the helmet
    j.box((0.03, 0.2, 0.03), (0.08, 0, 1.5), HARNESS)                                   # its chin strap
    body = j.build(parent)
    for s, tag in ((1, "l"), (-1, "r")):
        a = Model(f"chute_arm_{tag}")
        _limb(a, (0, 0, 0), (0, 0, -0.5), 0.12, SMOCK)
        a.box((0.1, 0.1, 0.1), (0, 0, -0.55), SKIN)
        a.build(body, loc=(0, s * 0.27, 1.4))
        g = Model(f"chute_leg_{tag}")
        _limb(g, (0, 0, 0), (0, 0, -0.78), 0.15, TROUSERS)
        g.box((0.26, 0.14, 0.12), (0.05, 0, -0.82), BOOT)
        g.build(body, loc=(0, s * 0.1, 0.88))
    for n, (colors, _) in enumerate(zip(CANOPIES, CANOPY_INSIDE)):
        b = Model(f"chute_bundle_{n}", seed=n)
        b.ball(0.3, (0, 0, 0), colors[0], subdiv=1, scale=(0.9, 1.3, 0.85), jitter=0.04)
        b.ball(0.2, (0.05, 0.22, 0.14), colors[1], subdiv=1, jitter=0.03)
        b.build(body, loc=(0.36, 0, 1.0))
    bag = Model("chute_bag")
    bag.box((0.32, 0.3, 0.55), (0, 0, -0.28), BAG)
    bag.box((0.33, 0.31, 0.06), (0, 0, -0.12), HARNESS)
    bag.build(parent, loc=(0.1, 0, -1.6))
    line = Model("chute_bagline")
    line.box((0.025, 0.025, 1.0), (0, 0, -0.5), LINE)
    line.build(parent, loc=(0.1, 0, 0.85))


def populate(root):
    """Both templates, parked out of sight under `root` (holidays.py)."""
    plane = group("dakota", (0, 0, -30), parent=root, id="dakota")
    dakota(plane)
    chute = group("parachute", (0, 0, -40), parent=root, id="parachute")
    parachute(chute)
