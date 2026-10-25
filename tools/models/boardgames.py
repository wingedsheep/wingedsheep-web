"""A board game, the two of them (src/island/scene/boardgames.ts): out at the card table by the
workshop on a fine day, its Magic cleared away (props.card_table), or up at the hut's long table
when it isn't (hut.py). Some of his favourites: Agricola, Root, Dune: Imperium, Star Realms and
Wingspan, one out at a time.

  vincent_games / companion_games   each of them sat at the table (the `_hut` ones are hut.py's):
                    a hand of the game's cards in the left hand (`*_fan_<game>`), and the right arm
                    reaching out over the board from the shoulder (`*_upper_r`) and the elbow
                    (`*_fore_r`), turning about the axes in their `reach` and `bend` properties by
                    up to `reach_angle` and `bend_angle`, with a piece in the hand (`*_hold_piece`,
                    or for Star Realms a card, `*_hold_card`).
  games_spread      the game itself (`games_spread_<game>`), laid out between them: in its own
                    frame he sits at +y and she sits at -y, each facing the other, and it fits in
                    a square a little under a metre across, the table's top at z = 0.

Everyone faces -y; z = 0 is the ground (or the hut's floor).
"""
from __future__ import annotations

import math

import characters
import companion
import layout as L
import outings
import palette as P
from kit import Model, group
from mathutils import Matrix, Vector

GAMES = ("agricola", "root", "dune", "star", "wingspan")

HIS = "#3c6fd0"                  # his pieces blue, hers purple (whatever the box says)
HERS = "#a04cb0"
CARD_FACE = "#f2ead6"

# what's on the back of each game's cards
BACKS = {"agricola": "#d8902a", "root": "#c8a468", "dune": "#7a3a1e", "star": "#2a2f6a", "wingspan": "#3a8a8a"}


# --- the two of them ---------------------------------------------------------------------------

def _elbow(shoulder: Vector, hand: Vector, upper: float, fore: float, out: float):
    """Where the elbow goes for the hand to be at `hand`: down, and out to the side (`out`: +1 the
    left arm, -1 the right)."""
    d = hand - shoulder
    reach = min(d.length, upper + fore - 1e-3)
    d = d.normalized()
    a = math.acos(max(-1.0, min(1.0, (upper * upper + reach * reach - fore * fore) / (2 * upper * reach))))
    pole = Vector((out * 0.6, 0.15, -1.0))
    n = (pole - d * pole.dot(d)).normalized()
    return shoulder + (d * math.cos(a) + n * math.sin(a)) * upper


def _fan(parent, name: str, back: str, at: Vector, tilt=0.4, inward=1.05, n=5, spread=0.3):
    """A hand of cards held up in the left hand, fanned from the bottom corner at `at`, their faces
    to whoever holds them (+y), leaning back from them by `tilt` and turned `inward`, across to
    their face."""
    m = Model(name)
    w, h, t = 0.095, 0.135, 0.004
    for i in range(n):
        turn = (i - (n - 1) / 2) * spread / max(1, n - 1) * 2
        r = Matrix.Rotation(inward, 3, "Z") @ Matrix.Rotation(tilt, 3, "X") @ Matrix.Rotation(turn, 3, "Y")
        e = r.to_euler()
        for side, color in ((-1, back), (1, CARD_FACE)):
            c = r @ Vector((0.0, side * t * 0.6 - i * 0.002, h * 0.42))
            m.box((w, t, h), at + c, color, rot=e)
    return m.build(parent)


def _arm(parent, prefix: str, shoulder: Vector, hand: Vector, to: Vector, sleeve, arm, skin, thick, piece: str, out=-1):
    """The right arm: at rest with the hand on the table's edge, and the turns (y-up axis and
    angle) that take it out to `to` on the board."""
    upper, fore = 0.31, 0.38
    elbow = _elbow(shoulder, hand, upper, fore, out)
    reached = _elbow(shoulder, to, upper, fore, out)
    u0, u1 = elbow - shoulder, reached - shoulder
    qu = u0.rotation_difference(u1)
    f0 = (hand - elbow).normalized() * fore
    f1 = (to - reached).normalized() * fore
    qf = f0.rotation_difference(qu.inverted() @ f1)
    lift, lift_angle = outings._axis_angle(qu)
    bend, bend_angle = outings._axis_angle(qf)
    up = Model(f"{prefix}_upper_r")
    up.plank_line((0, 0, 0), u0 * 0.45, thick + 0.03, thick + 0.03, sleeve)
    up.plank_line(u0 * 0.45, u0, thick + 0.01, thick + 0.01, arm)
    u = up.build(parent, loc=shoulder, reach=lift, reach_angle=lift_angle)
    fo = Model(f"{prefix}_fore_r")
    fo.box((thick, thick, thick), (0, 0, 0), arm)
    fo.plank_line((0, 0, 0), f0 * 0.88, thick - 0.01, thick - 0.01, arm)
    fo.box((0.1, 0.11, 0.08), f0, skin)
    f = fo.build(u, loc=u0, bend=bend, bend_angle=bend_angle)
    # in the hand: a piece of theirs, or a card to play
    p = Model(f"{prefix}_hold_piece")
    p.box((0.04, 0.04, 0.045), f0 + Vector((0, -0.02, 0.055)), piece)
    p.build(f)
    c = Model(f"{prefix}_hold_card")
    c.box((0.085, 0.12, 0.006), f0 + Vector((0, -0.07, 0.05)), CARD_FACE, rot=(0.15, 0, 0))
    c.box((0.075, 0.03, 0.007), f0 + Vector((0, -0.115, 0.057)), "#3a7ad8", rot=(0.15, 0, 0))
    c.build(f)


def _fans(parent, prefix: str, at: Vector):
    for g in GAMES:
        _fan(parent, f"{prefix}_fan_{g}", BACKS[g], at)


def vincent_playing(root, prefix: str, seat: float, top: float, edge: float):
    """Him sat at a table `top` high, its edge `edge` in front of his seat (`seat` high): his
    cards up in his left hand, his right on the table, ready to reach out over the board."""
    up = seat - 0.56
    m = Model(f"{prefix}_body")
    for x in (-0.16, 0.16):
        m.box((0.21, 0.52, 0.21), (x, -0.24, 0.62 + up), P.V_LEGS)                        # thighs
        m.box((0.16, 0.16, 0.52 + up), (x, -0.5, (0.52 + up) / 2 + 0.07), P.V_SHIN)
        m.box((0.2, 0.34, 0.1), (x, -0.56, 0.05), P.SHOE)
    characters._tee(m, 0.72 + up, root, cape=0.2)
    sh = Vector((0.31, -0.02, 1.3 + up))
    hand = Vector((0.1, -edge - 0.02, top + 0.2))
    el = _elbow(sh, hand, 0.31, 0.36, 1)
    m.plank_line(sh, sh.lerp(el, 0.45), 0.15, 0.15, P.V_TOP)                              # left arm, the cards up
    m.plank_line(sh.lerp(el, 0.45), el, 0.13, 0.13, P.V_ARM)
    m.plank_line(el, hand, 0.12, 0.12, P.V_ARM)
    m.box((0.11, 0.1, 0.1), hand, P.SKIN)
    m.build(root)
    _fans(root, prefix, hand + Vector((-0.02, -0.03, 0.03)))
    _arm(root, prefix, Vector((-0.31, -0.02, 1.3 + up)), Vector((-0.16, -edge - 0.14, top + 0.05)),
         Vector((-0.06, -edge - 0.36, top + 0.06)), P.V_TOP, P.V_ARM, P.SKIN, 0.12, HIS)
    characters.head(root, f"{prefix}_head", (0, 0, 1.45 + up))


def companion_playing(root, prefix: str, seat: float, top: float, edge: float):
    """Her sat at the table, the same way round: cards in her left hand, her right free to play."""
    up = seat - 0.56
    m = Model(f"{prefix}_body")
    companion._seated(m, seat, root)
    sh = Vector((0.28, 0.03, 1.24 + up))
    hand = Vector((0.09, -edge - 0.02, top + 0.18))
    el = _elbow(sh, hand, 0.29, 0.34, 1)
    companion._limb(m, sh, sh.lerp(el, 0.35), 0.14, P.E_TOP)
    companion._limb(m, sh.lerp(el, 0.35), el, 0.12, P.E_ARM)
    companion._limb(m, el, hand, 0.11, P.E_ARM)
    m.box((0.09, 0.1, 0.09), hand, P.FAIR)
    m.build(root)
    _fans(root, prefix, hand + Vector((-0.02, -0.03, 0.03)))
    _arm(root, prefix, Vector((-0.28, 0.03, 1.24 + up)), Vector((-0.15, -edge - 0.13, top + 0.05)),
         Vector((-0.06, -edge - 0.34, top + 0.06)), P.E_TOP, P.E_ARM, P.FAIR, 0.11, HERS)
    companion.head(root, f"{prefix}_head", (0, 0.02, 1.37 + up))


# --- the games ---------------------------------------------------------------------------------

def _sides(f):
    """Lay out what's each player's twice: his (at +y, the right way up for him), and hers, turned
    round to face her. `f(m, at, color)` gets `at`, mapping (x, y) in the player's own frame (+y
    towards them, x to their left) onto the table, and their colour."""
    def his(x, y):
        return (x, y)

    def hers(x, y):
        return (-x, -y)
    return [(his, HIS), (hers, HERS)]


def _disc(m: Model, x, y, z, r, color, h=0.012, segs=8):
    m.cyl(r, h, (x, y, z), color, segs=segs)


def agricola(m: Model):
    """Agricola: the action boards down the middle, goods on the spaces, a few workers out; and each
    a farm in front of them: a little wooden house, ploughed fields with grain, a fenced pasture
    with sheep."""
    m.box((0.9, 0.24, 0.012), (0, 0, 0.006), "#c9b27a")                                  # the action boards
    goods = ["#8a5a2a", "#c06a3a", "#d8d0a0", "#8a8a90", "#e0a020", "#e8c860", "#8a5a2a"]
    for i in range(7):
        for j in (-1, 1):
            x, y = -0.37 + i * 0.123, j * 0.058
            m.box((0.105, 0.09, 0.008), (x, y, 0.014), "#ece0b8")
            if (i + j) % 3:
                for k in range(1 + (i * 7 + j) % 3):
                    m.box((0.022, 0.022, 0.022), (x - 0.025 + k * 0.026, y, 0.03), goods[(i + (j > 0)) % len(goods)])
    for x, y, c in ((-0.37, 0.058, HIS), (0.12, -0.058, HERS), (0.24, 0.058, HIS), (-0.13, -0.058, HERS)):
        m.cyl(0.022, 0.026, (x + 0.025, y, 0.018), c, segs=8)                             # workers out
    for at, color in _sides(None):
        ox, oy = at(0.0, 0.33)
        m.box((0.56, 0.26, 0.012), (ox, oy, 0.006), "#5f8f43")                           # the farm board
        cell = 0.1
        for c in range(5):
            for r in range(3):
                x, y = at(-0.2 + c * cell, 0.24 + r * 0.085)
                kind = "house" if c == 0 and r < 2 else "field" if c in (1, 2) and r == 0 else "pasture" if c >= 3 and r >= 1 else "grass"
                if kind == "house":
                    m.box((0.085, 0.075, 0.03), (x, y, 0.027), "#a8743a")
                    m.box((0.085, 0.04, 0.015), (x, y, 0.05), "#8a4a2a")
                    m.cyl(0.016, 0.02, (x, y, 0.058), color, segs=8)                     # one of the family, home
                elif kind == "field":
                    m.box((0.085, 0.075, 0.016), (x, y, 0.02), "#7a5530")
                    for k in range(3):
                        gx, gy = at(-0.2 + c * cell - 0.025 + k * 0.025, 0.24 + r * 0.085)
                        m.box((0.016, 0.05, 0.016), (gx, gy, 0.034), "#e8c860")
                elif kind == "pasture":
                    m.box((0.088, 0.078, 0.008), (x, y, 0.016), "#7fb050")
        # the fence round the pasture, and three sheep in it
        a, b = at(0.07, 0.29), at(0.23, 0.29)
        c_, d = at(0.07, 0.45), at(0.23, 0.45)
        for p, q in ((a, b), (c_, d), (a, c_), (b, d)):
            m.plank_line((p[0], p[1], 0.03), (q[0], q[1], 0.03), 0.012, 0.025, "#c89858")
        for sx, sy in ((0.11, 0.34), (0.17, 0.38), (0.13, 0.41)):
            x, y = at(sx, sy)
            m.box((0.03, 0.022, 0.022), (x, y, 0.032), "#f2f0e8")


def root_game(m: Model):
    """Root: the woodland map, its clearings joined by paths, a river through it and the forests
    between; the Marquise's orange cats and her sawmills across most of it, and the Eyrie's blue
    birds holding the north; each their faction board."""
    m.box((0.88, 0.6, 0.012), (0, 0, 0.006), "#d9c89a")
    for x, y, w, h in ((-0.28, 0.15, 0.2, 0.14), (0.05, -0.18, 0.24, 0.12), (0.3, 0.12, 0.16, 0.18), (-0.1, 0.05, 0.12, 0.1)):
        m.box((w, h, 0.004), (x, y, 0.014), "#5a7a42")                                   # the woods
    for (x0, y0), (x1, y1) in (((-0.44, -0.05), (-0.2, -0.1)), ((-0.2, -0.1), (0.0, 0.0)), ((0.0, 0.0), (0.18, -0.05)), ((0.18, -0.05), (0.44, 0.02))):
        m.plank_line((x0, y0, 0.014), (x1, y1, 0.014), 0.03, 0.004, "#5a8ab0")         # the river
    suits = ["#c8502a", "#e0b040", "#d8783a"]
    clearings = [(-0.36, 0.2), (-0.12, 0.22), (0.12, 0.22), (0.36, 0.22), (-0.36, -0.2), (-0.12, -0.04),
                 (0.14, 0.04), (0.36, -0.12), (-0.18, -0.22), (0.08, -0.22), (0.36, -0.24), (-0.38, 0.0)]
    for i, (x, y) in enumerate(clearings):
        for (x1, y1) in clearings[i + 1:]:
            if math.hypot(x1 - x, y1 - y) < 0.27:
                m.plank_line((x, y, 0.015), (x1, y1, 0.015), 0.016, 0.004, "#b89a6a")   # paths
    for i, (x, y) in enumerate(clearings):
        m.cyl(0.05, 0.008, (x, y, 0.014), suits[i % 3], segs=10)
        m.cyl(0.042, 0.009, (x, y, 0.014), "#efe4c4", segs=10)
        if i in (0, 1, 2, 3):                                                             # the birds' roosts, and birds
            m.box((0.034, 0.034, 0.016), (x - 0.015, y + 0.01, 0.03), "#3a62c0")
            for k in range(1 + i % 2):
                m.box((0.016, 0.016, 0.03), (x + 0.018 + k * 0.018, y - 0.012, 0.038), "#3a62c0")
        else:                                                                             # the cats, and a sawmill or two
            for k in range(1 + (i * 5) % 3):
                m.box((0.016, 0.016, 0.03), (x - 0.02 + k * 0.018, y - 0.012, 0.038), "#e07a2a")
            if i % 3 == 0:
                m.box((0.032, 0.032, 0.016), (x + 0.01, y + 0.018, 0.03), "#b8561a")
    m.box((0.05, 0.05, 0.03), (-0.38, 0.0, 0.04), "#f0ead8")                             # the keep
    for at, color in _sides(None):
        x, y = at(0.18, 0.4)
        m.box((0.3, 0.13, 0.008), (x, y, 0.004), "#e8a860" if color == HIS else "#7a9ad8")  # faction boards


def dune(m: Model):
    """Dune: Imperium: the board's sand and its spaces, the conflict in the middle, the four
    factions' tracks down one side with their influence cubes, agents out; the Imperium row of
    cards up the other side; spice, solari and water by each of them."""
    m.box((0.72, 0.58, 0.012), (-0.08, 0, 0.006), "#c89058")
    for k, c in enumerate(("#b03030", "#d07a2a", "#6a4a9a", "#3a7ab0")):                # the factions' tracks
        x = -0.4 + k * 0.045
        m.box((0.036, 0.5, 0.006), (x, 0, 0.015), c)
        m.box((0.02, 0.02, 0.02), (x, (0.05, 0.13, 0.09, 0.17)[k], 0.028), HIS)       # influence, his and hers
        m.box((0.02, 0.02, 0.02), (x, (-0.09, -0.05, -0.15, -0.11)[k], 0.028), HERS)
    for i, (x, y) in enumerate(((-0.14, 0.2), (0.0, 0.2), (0.14, 0.2), (-0.14, -0.2), (0.0, -0.2), (0.14, -0.2),
                                (-0.18, 0.06), (0.18, 0.06), (-0.18, -0.06), (0.18, -0.06))):
        m.box((0.11, 0.07, 0.006), (x, y, 0.015), "#8a4a2a" if i % 2 else "#a85a30")    # the spaces
    m.cyl(0.075, 0.008, (0.0, 0.0, 0.012), "#4a2418", segs=12)                         # the conflict
    m.box((0.06, 0.08, 0.01), (0.0, 0.0, 0.02), "#e8d0a0")                              # its card
    for x, y, c in ((-0.14, 0.2, HIS), (0.14, -0.2, HERS), (0.18, 0.06, HIS)):
        m.box((0.022, 0.022, 0.05), (x, y, 0.04), c)                                     # agents
    for k in range(4):
        m.box((0.016, 0.016, 0.016), (-0.02 + (k % 2) * 0.03, 0.01 + (k // 2) * 0.03 - 0.03, 0.03), (HIS, HERS)[k % 2])  # troops in it
    for k in range(5):                                                                    # the Imperium row
        m.box((0.075, 0.105, 0.006), (0.37, -0.24 + k * 0.12, 0.004), "#e8d4b0")
        m.box((0.065, 0.03, 0.007), (0.37, -0.24 + k * 0.12 + 0.03, 0.005), ("#d07a2a", "#6a4a9a", "#3a7ab0", "#b03030", "#8a6a3a")[k])
    for at, color in _sides(None):
        x, y = at(-0.06, 0.42)
        m.box((0.085, 0.12, 0.008), (x, y, 0.004), "#6a3a1e")                           # their leader
        for k in range(3):
            sx, sy = at(0.08 + k * 0.025, 0.4)
            m.box((0.02, 0.02, 0.02), (sx, sy, 0.01), "#e08a2a")                         # spice
        sx, sy = at(0.17, 0.43)
        _disc(m, sx, sy, 0.0, 0.018, "#c8c8d0", 0.01)                                     # solari
        _disc(m, sx, sy, 0.01, 0.018, "#c8c8d0", 0.01)
        wx, wy = at(0.21, 0.4)
        m.ball(0.016, (wx, wy, 0.016), "#4a9ad8", subdiv=1, scale=(1, 1, 1.3))           # water


def _star_card(m: Model, x, y, band, rot=0.0):
    m.box((0.12, 0.17, 0.006), (x, y, 0.004), "#1a1e3a", rot=(0, 0, rot))
    m.box((0.1, 0.06, 0.007), (x, y + 0.02, 0.005), "#2e3a72", rot=(0, 0, rot))         # the ship
    m.box((0.12, 0.025, 0.008), (x, y + 0.075, 0.006), band, rot=(0, 0, rot))           # its faction
    m.cyl(0.012, 0.009, (x + 0.045, y + 0.075, 0.005), "#e8c040", segs=6)               # its cost


def star_realms(m: Model):
    """Star Realms: no board, just cards. The trade row across the middle, the trade deck and the
    explorers either end of it; and each of them their deck, their discard pile, what they've got
    in play, and their authority."""
    bands = ["#3a7ad8", "#5ab04a", "#e0c040", "#d0403a", "#5ab04a"]
    for i in range(5):
        _star_card(m, -0.29 + i * 0.145, 0.0, bands[i])
    m.box((0.12, 0.17, 0.04), (0.44, 0.0, 0.02), "#2a2050")                               # the trade deck
    m.box((0.1, 0.15, 0.002), (0.44, 0.0, 0.041), "#5a3a9a")
    m.box((0.12, 0.17, 0.025), (-0.44, 0.0, 0.0125), "#3a3a50")                           # explorers
    for at, color in _sides(None):
        x, y = at(0.33, 0.36)
        m.box((0.12, 0.17, 0.03), (x, y, 0.015), "#2a2050")                               # deck
        m.box((0.1, 0.15, 0.002), (x, y, 0.031), "#5a3a9a")
        x, y = at(-0.36, 0.36)
        _star_card(m, x, y, "#d0403a", rot=0.1)                                           # discard
        for k in range(3):
            x, y = at(-0.15 + k * 0.14, 0.24)
            _star_card(m, x, y, bands[(k + (color == HERS)) % 4])                         # in play
        x, y = at(0.36, 0.17)
        m.cyl(0.04, 0.01, (x, y, 0.0), "#d0403a", segs=10)                                # authority
        m.cyl(0.028, 0.012, (x, y, 0.0), "#f2ead6", segs=10)


def wingspan(m: Model):
    """Wingspan: each their mat, forest, grassland and wetland, birds played along the rows and
    eggs on them; between them the birdfeeder dice tower and its dice, the bird tray, and a dish of
    eggs."""
    birds = ["#c8402a", "#3a6ac0", "#e8c040", "#5a4a3a", "#e07a9a", "#4a9a6a"]
    eggs = ["#f0d8e0", "#d0e8f0", "#f8f0c8", "#d8f0d0", "#f4e0c8"]
    for at, color in _sides(None):
        x, y = at(0.0, 0.33)
        m.box((0.6, 0.27, 0.01), (x, y, 0.005), "#e8dcc0")
        for r, habitat in enumerate(("#5a8a4a", "#d8b84a", "#4a8ab8")):
            hx, hy = at(-0.26, 0.24 + r * 0.085)
            m.box((0.06, 0.075, 0.004), (hx, hy, 0.012), habitat)
            for c in range(5 - r - (color == HERS)):
                bx, by = at(-0.19 + c * 0.095, 0.24 + r * 0.085)
                m.box((0.075, 0.072, 0.006), (bx, by, 0.013), CARD_FACE)
                m.ball(0.017, (bx, by - 0.005, 0.02), birds[(r * 3 + c + (color == HERS)) % 6], subdiv=1, scale=(1.3, 1, 0.5))
                if (r + c) % 2 == 0:
                    ex, ey = at(-0.19 + c * 0.095 + 0.025, 0.24 + r * 0.085 + 0.018)
                    m.ball(0.011, (ex, ey, 0.026), eggs[(r + c) % 5], subdiv=1, scale=(1, 1, 1.25))
    # the birdfeeder: a little wooden birdhouse, the dice tumbled out in front
    m.box((0.1, 0.09, 0.15), (-0.22, 0.0, 0.075), "#c8a070")
    m.prism([(-0.06, 0), (0.06, 0), (0, 0.06)], 0.11, (-0.22, -0.055, 0.15), "#8a5a3a")
    m.cyl(0.018, 0.004, (-0.22, -0.047, 0.09), "#3a2a1a", segs=8, rot=(math.pi / 2, 0, 0))
    m.box((0.14, 0.1, 0.012), (-0.22, -0.1, 0.006), "#a87a4a")                           # its tray
    for k, c in enumerate(("#c8402a", "#7a4a2a", "#4a8a3a", "#5a7ab8", "#e0b040")):
        m.box((0.028, 0.028, 0.028), (-0.27 + k * 0.026, -0.1 + (k % 2) * 0.02 - 0.01, 0.026), "#f0e8d8", rot=(0, 0, k * 0.4))
        m.box((0.012, 0.012, 0.002), (-0.27 + k * 0.026, -0.1 + (k % 2) * 0.02 - 0.01, 0.041), c)
    for k in range(3):                                                                    # the bird tray
        m.box((0.075, 0.1, 0.006), (0.06 + k * 0.09, 0.0, 0.004), CARD_FACE)
        m.ball(0.02, (0.06 + k * 0.09, 0.005, 0.012), birds[k + 2], subdiv=1, scale=(1.3, 1, 0.5))
    m.cyl(0.045, 0.02, (0.38, 0.0, 0.0), "#d8d0c0", segs=10)                              # a dish of eggs
    for k in range(4):
        m.ball(0.012, (0.37 + (k % 2) * 0.02, -0.01 + (k // 2) * 0.02, 0.028), eggs[k], subdiv=1, scale=(1, 1, 1.25))


SPREADS = {"agricola": agricola, "root": root_game, "dune": dune, "star": star_realms, "wingspan": wingspan}


def spread(parent, prefix: str, at, rot_z=0.0):
    """The games, one shown at a time (see the module notes)."""
    g = group(prefix, at, rot_z=rot_z, parent=parent)
    for name, f in SPREADS.items():
        m = Model(f"{prefix}_{name}", seed=len(name))
        f(m)
        m.build(g)
    return g


def populate(t):
    """At the card table by the workshop (props.card_table): him on the west stool, her on the east
    one, facing each other down its length, and the games between them; all hidden till there's
    one out."""
    x, y = L.CARD_TABLE
    z = t.sample(x, y)
    vincent_playing(group("vincent_games", (x - 1.1, y, z), rot_z=math.pi / 2, id="vincent_games"), "games_v", 0.5, 0.84, 0.3)
    companion_playing(group("companion_games", (x + 1.1, y, z), rot_z=-math.pi / 2, id="companion_games"), "games_e", 0.5, 0.84, 0.3)
    spread(None, "games_spread", (x, y, z + 0.84), rot_z=math.pi / 2)
