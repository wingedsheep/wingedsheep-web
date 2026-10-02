"""Someone who shares the island with Vincent: fair and a bit sun-flushed, rosy cheeks, blue eyes,
straight blonde hair to the shoulders, a dusty-rose cap worn forwards, little gold earrings, a
lavender tee and a big grin. Same chunky proportions as Vincent (characters.py).

She has a few spots, and the runtime (src/island/scene/companion.ts) shows her at one at a time:
  reading   on her belly on a picnic blanket under the blossom tree, feet in the air
  fireside  on the log by the campfire with a mug, listening to Vincent play
  baking    in the mountain hut (hut.py), at the table with tea while a pie bakes
  watching  on the sofa in the lighthouse (quarters.py), in front of the telly with popcorn
  workout   on an exercise mat on the grass above the beach, ponytail through her cap:
            jumping jacks, a breather, side stretches
  bed       in the hut's bed (hut.py) from half past ten: sitting up reading, and later asleep
  petting   on her knees in the grass, stroking George on the bench, or Beike (characters.PETTING)

Each faces -y; z = 0 is the ground (or the hut floor). The parts the runtime moves are their own
objects, pivoting where they join: `*_head` at the neck, `*_shin_l/_r` at the knees,
`*_page` at the book's spine, `*_mug` and `*_snack` at the elbows.
"""
from __future__ import annotations

import math

import palette as P
from characters import duvet, petting as kneeling, yoga_poses
from kit import Model, emitter, group
from mathutils import Euler, Vector

HEAD_C = 0.22  # the middle of the head above its pivot (before HEAD_SCALE)
HEAD_SCALE = 0.85  # hers sits a little smaller than Vincent's


def _chamfered(hw: float, hd: float, cut: float, y=0.0):
    """A rectangle with its corners cut off, counter-clockwise: a rounder head than a box."""
    return [(-hw + cut, -hd + y), (hw - cut, -hd + y), (hw, -hd + cut + y), (hw, hd - cut + y),
            (hw - cut, hd + y), (-hw + cut, hd + y), (-hw, hd - cut + y), (-hw, -hd + cut + y)]


def _lock(h: Model, a: float, r: float, top: float, length: float, width: float, flare: float, color: str):
    """One lock of hair hanging from under the cap at angle `a` round the head (0 is the front,
    +x is her left), `r` out from the middle, flaring out by `flare` radians towards its ends."""
    rot = Euler((-flare, 0, a))
    at = Vector((math.sin(a) * r, -math.cos(a) * r, top)) + rot.to_matrix() @ Vector((0, 0, -length / 2))
    h.box((width, 0.05, length), tuple(at), color, rot=tuple(rot))


def _bare(h: Model, c: float):
    """The top of her head with nothing on it: just hair, parted."""
    h.ball(0.218, (0, 0.01, c + 0.14), P.BLONDE, subdiv=2, scale=(1.0, 1.0, 0.5))
    h.box((0.02, 0.22, 0.02), (0.05, -0.04, c + 0.245), P.BLONDE_DARK)                 # her parting


def hats(o, name: str, sport=False):
    """What she has on her head, one part each, for the wardrobe to pick from (`wear`, see
    src/island/scene/wardrobe.ts): her cap worn forwards, a knitted beanie, nothing, and on
    Halloween a red witch's hat and a witch's make-up (`sport`: just the cap or the beanie, ponytail
    through the back)."""
    c = HEAD_C
    k = "es" if sport else "e"
    m = Model(f"{name}_cap")                                                          # a round crown, the brim forwards over her brows, pale lettering
    m.ball(0.222, (0, 0.01, c + 0.16), P.CAP_ROSE, subdiv=2, scale=(1.0, 1.0, 0.58))
    m.cyl(0.228, 0.05, (0, 0.01, c + 0.12), P.CAP_ROSE, segs=14)                       # its band
    m.box((0.04, 0.04, 0.03), (0, 0.01, c + 0.29), P.CAP_ROSE_DARK)                   # button
    m.box((0.28, 0.16, 0.03), (0, -0.28, c + 0.165), P.CAP_ROSE_DARK, rot=(0.06, 0, 0))  # brim, up off her brows
    m.box((0.13, 0.015, 0.02), (0, -0.19, c + 0.22), P.WHITE, rot=(-0.9, 0, 0))
    m.box((0.09, 0.015, 0.018), (0, -0.205, c + 0.195), P.WHITE, rot=(-0.9, 0, 0))
    m.build(o, wear=f"{k}_cap")
    b = Model(f"{name}_beanie")                                                       # slouchy, cuff turned up, a bobble
    b.ball(0.226, (0, 0.02, c + 0.17), P.E_BEANIE, subdiv=2, scale=(1.0, 1.0, 0.7))
    b.cyl(0.235, 0.07, (0, 0.01, c + 0.1), P.E_BEANIE_DARK, segs=14)
    b.ball(0.07, (0, 0.04, c + 0.34), P.E_BEANIE_DARK, subdiv=1)
    b.build(o, wear=f"{k}_beanie")
    if sport:
        return
    n = Model(f"{name}_bare")
    _bare(n, c)
    n.build(o, wear="e_bare")
    # a witch's hat, red, tall and a bit crooked, with a black band and a buckle
    t = Model(f"{name}_witch")
    t.cyl(0.38, 0.03, (0, 0.01, c + 0.13), P.WITCH, segs=12)                          # brim
    t.cyl(0.215, 0.36, (0, 0.01, c + 0.13), P.WITCH, segs=8, r_top=0.1)
    t.cyl(0.222, 0.06, (0, 0.01, c + 0.15), P.WITCH_BAND, segs=8)
    t.box((0.07, 0.02, 0.05), (0, -0.21, c + 0.18), P.GOLD)                            # buckle
    t.cyl(0.1, 0.34, (0, 0.03, c + 0.47), P.WITCH, segs=8, r_top=0.0, rot=(-0.55, 0.25, 0))  # the point, flopping back
    t.build(o, wear="e_witch")
    p = Model(f"{name}_paint")                                                       # dark round the eyes, dark lips
    for s in (-1, 1):
        p.box((0.1, 0.01, 0.095), (s * 0.085, -0.184, c + 0.04), P.WITCH_SHADE)
    p.box((0.15, 0.024, 0.02), (0, -0.172, c - 0.105), P.WITCH_LIPS)
    p.build(o, wear="e_paint")


def head(parent, name: str, loc, rot=(0, 0, 0), cap=True, ponytail=False, earbuds=False):
    """Her head, pivoting at the neck: a softer jaw than Vincent's, straight blonde hair to the
    shoulders in loose locks, a strand either side framing her face, and (not in bed) whatever
    she has on it today (hats). `ponytail`: tied back through the gap in the cap instead, as its
    own part (`<name>_ponytail`) so it can bounce, for her sports. `earbuds`: her little white
    in-ears, in."""
    h = Model(name, seed=sum(map(ord, name)))
    c = HEAD_C
    h.slab(_chamfered(0.19, 0.18, 0.06), c - 0.1, c + 0.17, P.FAIR)
    h.slab(_chamfered(0.15, 0.16, 0.05, y=-0.01), c - 0.2, c - 0.1, P.FAIR)          # the jaw, narrower
    for s in (-1, 1):
        x = s * 0.085
        h.box((0.055, 0.02, 0.06), (x, -0.185, c + 0.03), P.EYE_BLUE)
        h.box((0.08, 0.02, 0.02), (x, -0.185, c + 0.085), P.BROW)
        h.box((0.05, 0.02, 0.04), (s * 0.1, -0.183, c - 0.04), P.CHEEK)               # rosy cheeks
        h.box((0.025, 0.025, 0.035), (s * 0.19, -0.06, c - 0.08), P.GOLD)             # earrings
    h.box((0.05, 0.04, 0.06), (0, -0.2, c - 0.01), P.FAIR)                            # nose
    h.box((0.13, 0.02, 0.04), (0, -0.184, c - 0.075), P.TEETH)                        # the big grin
    h.box((0.14, 0.02, 0.015), (0, -0.172, c - 0.105), P.LIPS)
    # the hair: a ring of locks from under the cap, longest at the back where it reaches her
    # shoulders, each a touch different, in three shades
    shades = [P.BLONDE, P.BLONDE_LIGHT, P.BLONDE, P.BLONDE_DARK]
    if ponytail:                                                                      # pulled back: short under the cap
        for i, deg in enumerate(range(64, 300, 18)):
            _lock(h, math.radians(deg), 0.2, c + 0.12, 0.2, 0.1, 0.0, shades[i % 4])
        for s in (-1, 1):                                                             # a strand escaping each side
            _lock(h, s * math.radians(55), 0.215, c + 0.12, 0.22, 0.05, 0.08, P.BLONDE_LIGHT)
    else:
        for i, deg in enumerate(range(64, 300, 18)):
            a = math.radians(deg)
            length = 0.37 - 0.09 * math.cos(a) + h.rng.uniform(-0.025, 0.025)
            _lock(h, a, 0.215, c + 0.12, length, 0.1, 0.03 + h.rng.uniform(0, 0.04), shades[i % 4])
        h.box((0.34, 0.05, 0.22), (0, 0.185, c + 0.02), P.BLONDE_DARK)                 # underneath, so no scalp shows
        for s in (-1, 1):                                                             # the strands framing her face
            _lock(h, s * math.radians(52), 0.215, c + 0.12, 0.4, 0.075, 0.12, P.BLONDE_LIGHT)
    # a side parting under the cap: the fringe swept off to her right
    h.box((0.2, 0.03, 0.045), (0.05, -0.19, c + 0.12), P.BLONDE, rot=(0, 0.3, 0))
    h.box((0.09, 0.03, 0.04), (-0.11, -0.19, c + 0.125), P.BLONDE_LIGHT, rot=(0, -0.35, 0))
    if not cap:
        _bare(h, c)
    if earbuds:                                                                       # peeking out through the hair
        for s in (-1, 1):
            h.box((0.05, 0.05, 0.05), (s * 0.24, -0.05, c - 0.03), P.EARBUD)
            h.box((0.025, 0.025, 0.07), (s * 0.24, -0.06, c - 0.09), P.EARBUD)
    o = h.build(parent, loc=loc)
    o.rotation_euler = rot
    o.scale = (HEAD_SCALE,) * 3
    if cap:
        hats(o, name, sport=ponytail)
    if ponytail:                                                                      # out through the back of the cap
        t = Model(f"{name}_ponytail")
        t.box((0.1, 0.07, 0.05), (0, 0.0, 0.0), P.CAP_ROSE_DARK)                       # the hair tie
        t.box((0.12, 0.1, 0.22), (0, 0.02, -0.12), P.BLONDE)
        t.box((0.09, 0.08, 0.16), (0, 0.04, -0.3), P.BLONDE_LIGHT)
        t.box((0.05, 0.05, 0.06), (0, 0.05, -0.41), P.BLONDE_DARK)                     # the tips
        p = t.build(o, loc=(0, 0.23, c + 0.1))
        p.rotation_euler = (0.3, 0, 0)
    return o


def _limb(m: Model, a, b, size, color):
    m.plank_line(a, b, size, size, color)


def reading(root):
    """On her belly on a picnic blanket, propped on her elbows over a book, feet in the air."""
    b = Model("companion_blanket", seed=91)
    n, k = (6, 11), 0.23                                                          # a red and white check
    for i in range(n[0]):
        for j in range(n[1]):
            x, y = (i - (n[0] - 1) / 2) * k, 0.3 + (j - (n[1] - 1) / 2) * k
            b.box((k, k, 0.025), (x, y, 0.0125), P.RED if (i + j) % 2 else P.WHITE)
    # a basket of apples, a flask of tea and a cup
    b.cyl(0.18, 0.2, (0.52, 0.95, 0.02), P.WICKER, segs=8, r_top=0.21)
    b.plank_line((0.36, 0.95, 0.22), (0.52, 0.95, 0.38), 0.03, 0.03, P.WICKER)
    b.plank_line((0.52, 0.95, 0.38), (0.68, 0.95, 0.22), 0.03, 0.03, P.WICKER)
    for dx, dy in ((-0.06, -0.04), (0.07, 0.02), (0.0, 0.08)):
        b.ball(0.065, (0.52 + dx, 0.95 + dy, 0.24), P.APPLE, subdiv=1)
    b.cyl(0.06, 0.28, (-0.5, 0.75, 0.02), P.TILE_BLUE, segs=8)
    b.cyl(0.065, 0.06, (-0.5, 0.75, 0.3), P.TUNER, segs=8)
    b.cyl(0.05, 0.08, (-0.42, 0.52, 0.02), P.WHITE, segs=8)
    b.cyl(0.042, 0.005, (-0.42, 0.52, 0.095), P.COFFEE, segs=8)
    b.build(root)

    m = Model("companion_read_body")
    hips, shoulders = (0, 0.36, 0.16), (0, -0.22, 0.36)
    m.plank_line(hips, shoulders, 0.46, 0.26, P.E_TOP)                                # chest up on her elbows
    m.plank_line((0, 0.74, 0.12), (0, 0.32, 0.15), 0.46, 0.25, P.E_SHORTS)            # shorts
    for s in (-1, 1):
        x = s * 0.11
        _limb(m, (x, 0.7, 0.11), (x, 1.12, 0.09), 0.17, P.E_THIGH)                      # thighs
        sh, el, hand = (s * 0.26, -0.2, 0.36), (s * 0.24, -0.46, 0.06), (s * 0.13, -0.72, 0.07)
        mid = tuple(a + (b_ - a) * 0.4 for a, b_ in zip(sh, el))
        _limb(m, sh, mid, 0.15, P.E_TOP)                                                # sleeves
        _limb(m, mid, el, 0.12, P.E_ARM)
        _limb(m, el, hand, 0.11, P.E_ARM)
        m.box((0.1, 0.12, 0.08), hand, P.FAIR)
    _limb(m, (0, -0.24, 0.4), (0, -0.3, 0.5), 0.15, P.FAIR)                          # neck
    # the book, open on the blanket in front of her
    m.box((0.48, 0.34, 0.02), (0, -0.87, 0.035), P.TENT_GREEN)
    for s in (-1, 1):
        m.box((0.21, 0.3, 0.03), (s * 0.115, -0.87, 0.055), P.CANVAS, rot=(0, s * 0.08, 0))
        for i in range(5):
            m.box((0.15, 0.015, 0.004), (s * 0.115, -0.96 + i * 0.045, 0.072), P.INK)
    m.build(root)

    pg = Model("companion_page")                                                     # turned now and then
    pg.box((0.2, 0.28, 0.008), (0.1, 0, 0), P.WHITE)
    pg.build(root, loc=(0, -0.87, 0.075))
    for s, lean in ((-1, 0.35), (1, -0.25)):                                         # feet up, crossing and uncrossing
        g = Model(f"companion_shin_{'l' if s < 0 else 'r'}")
        _limb(g, (0, 0, 0), (0, 0, 0.42), 0.14, P.E_SHIN)
        g.box((0.12, 0.22, 0.08), (0, 0.05, 0.46), P.FAIR)
        g.box((0.12, 0.05, 0.08), (0, 0.17, 0.46), P.CHEEK)                             # a bit pink on the soles
        o = g.build(root, loc=(s * 0.11, 1.12, 0.09))
        o.rotation_euler = (lean, 0, 0)
    head(root, "companion_read_head", (0, -0.32, 0.47), rot=(0.1, 0, 0))


def _seated(m: Model, seat: float, root=None):
    """Legs, hips and tee for sitting on something `seat` high, feet on the ground."""
    up = seat - 0.56
    for s in (-1, 1):
        x = s * 0.12
        _limb(m, (x, 0.0, 0.66 + up), (x, -0.46, 0.64 + up), 0.18, P.E_LEGS)             # thighs
        _limb(m, (x, -0.46, 0.66 + up), (x, -0.52, 0.12), 0.15, P.E_LEGS)               # shins
        m.box((0.16, 0.3, 0.1), (x, -0.58, 0.06), P.SNEAKER)
        m.box((0.17, 0.31, 0.03), (x, -0.58, 0.015), P.PEBBLE)
    _top(m, up, root)


def _top(m: Model, up: float, root=None):
    """Her hips and tee, sitting up, her seat at 0.56 + up. Given the `root` the body is built
    in, also what comes out over it with an outfit (dressing)."""
    m.box((0.46, 0.3, 0.2), (0, 0.02, 0.66 + up), P.E_LEGS)
    m.box((0.44, 0.28, 0.56), (0, 0.03, 1.02 + up), P.E_TOP)                          # tee
    m.box((0.16, 0.01, 0.06), (0, -0.112, 1.27 + up), P.FAIR)                         # round neck
    m.box((0.15, 0.15, 0.1), (0, 0.02, 1.33 + up), P.FAIR)                            # neck
    if root:
        dressing(root, m.name, up)


def dressing(root, name: str, up: float):
    """What comes out over her top with an outfit (`wear`, see src/island/scene/wardrobe.ts),
    sitting up as in _top: a scarf when it's cold; at Christmas a tree on her jumper, its
    lights lit; and on Halloween a witch's cloak and the red skirt of her dress."""
    y = -0.11                                                                         # the front of the tee
    f = Model(f"{name}_scarf")
    f.box((0.26, 0.25, 0.09), (0, 0.02, 1.32 + up), P.E_SCARF)
    f.box((0.09, 0.03, 0.26), (-0.08, y - 0.03, 1.16 + up), P.E_SCARF)
    f.build(root, wear="e_scarf")

    j = Model(f"{name}_tree")
    j.prism([(-0.14, 0), (0.14, 0), (0, 0.32)], 0.012, (0, y - 0.004, 0.86 + up), P.XMAS_TREE)
    j.box((0.05, 0.012, 0.06), (0, y - 0.004, 0.83 + up), P.WOOD)                      # its trunk
    j.box((0.05, 0.02, 0.05), (0, y - 0.01, 1.19 + up), P.GOLD, glow=True)             # the star
    for i, (x, z) in enumerate(((-0.06, 0.92), (0.05, 0.97), (-0.02, 1.04), (0.07, 0.9), (-0.09, 0.88), (0.02, 1.1))):
        j.box((0.03, 0.02, 0.03), (x, y - 0.01, z + up), P.XMAS_LIGHTS[i % 4], glow=True)
    for i in range(6):                                                                # a white zigzag round the hem
        j.box((0.07, 0.012, 0.03), (-0.19 + i * 0.076, y - 0.004, 0.79 + up + (i % 2) * 0.025), P.WHITE)
    j.build(root, wear="e_tree")

    k = Model(f"{name}_cloak")                                                       # a witch's, off the shoulders, collar up
    k.prism([(-0.27, 1.32 + up), (0.27, 1.32 + up), (0.36, 0.6 + up), (-0.36, 0.6 + up)], 0.04, (0, 0.2, 0), P.WITCH_DARK)
    for s in (-1, 1):
        k.box((0.12, 0.2, 0.05), (s * 0.27, 0.07, 1.31 + up), P.WITCH_DARK)              # over the shoulders
        k.box((0.2, 0.03, 0.26), (s * 0.12, 0.24, 1.44 + up), P.WITCH_DARK, rot=(-0.25, s * 0.35, 0))
        k.box((0.17, 0.01, 0.22), (s * 0.115, 0.22, 1.43 + up), P.WITCH_BAND, rot=(-0.25, s * 0.35, 0))
    k.build(root, wear="e_cloak")

    d = Model(f"{name}_dress")                                                       # the witch's dress: a red skirt over her lap
    d.box((0.56, 0.36, 0.1), (0, 0.0, 0.76 + up), P.WITCH)                            # its waist, over the hips
    d.box((0.48, 0.31, 0.06), (0, 0.03, 0.84 + up), P.WITCH_BAND)                     # a black sash
    d.box((0.58, 0.64, 0.08), (0, -0.3, 0.75 + up), P.WITCH)                          # over her thighs
    d.box((0.6, 0.06, 0.32), (0, -0.62, 0.62 + up), P.WITCH, rot=(-0.12, 0, 0))         # falling past her knees
    for i in range(5):                                                                # a ragged hem, in points
        d.prism([(-0.05, 0.0), (0.05, 0.0), (0, -0.08)], 0.04, (-0.24 + i * 0.12, -0.64, 0.46 + up), P.WITCH_DARK)
    d.build(root, wear="e_dress")

def fireside(root):
    """On the log by the campfire in a mustard cardigan, a mug of tea in both hands
    (`companion_tea`), or on a Friday evening a beer from the crate (`companion_beer`; the runtime
    picks). The log itself is the island's (props.log_seat): her seat is at z = 0.56."""
    m = Model("companion_fire_body")
    _seated(m, 0.56, root)
    for s in (-1, 1):                                                                 # the cardigan, open down the front
        m.box((0.12, 0.3, 0.57), (s * 0.18, 0.03, 1.02), P.E_CARDI)
        m.box((0.02, 0.31, 0.5), (s * 0.12, 0.03, 1.0), P.E_CARDI_EDGE)
        _limb(m, (s * 0.28, 0.03, 1.24), (s * 0.29, -0.08, 0.94), 0.14, P.E_CARDI)
    m.box((0.46, 0.3, 0.08), (0, 0.04, 0.72), P.E_CARDI)                              # its hem
    m.build(root)

    g = Model("companion_mug")                                                        # forearms and mug, from the elbows
    for s in (-1, 1):
        _limb(g, (s * 0.29, 0, 0), (s * 0.1, -0.22, 0.1), 0.13, P.E_CARDI)
        g.box((0.09, 0.11, 0.1), (s * 0.08, -0.26, 0.11), P.FAIR)
    hands = g.build(root, loc=(0, -0.08, 0.94))
    tea = Model("companion_tea")
    tea.cyl(0.075, 0.15, (0, -0.28, 0.05), P.TILE_BLUE, segs=8)
    tea.cyl(0.078, 0.02, (0, -0.28, 0.19), P.WHITE, segs=8)
    tea.cyl(0.062, 0.005, (0, -0.28, 0.2), P.COFFEE, segs=8)
    tea.build(hands)
    beer = Model("companion_beer")                                                    # Friday evening: one from the crate
    beer.cyl(0.042, 0.2, (0, -0.28, -0.03), "#6a3a1a", segs=6)
    beer.box((0.07, 0.01, 0.08), (0, -0.325, 0.06), "#e8d8a8")
    beer.cyl(0.017, 0.08, (0, -0.28, 0.17), "#6a3a1a", segs=4)
    beer.build(hands)
    head(root, "companion_fire_head", (0, 0.02, 1.37))


def workout(root):
    """On an exercise mat on the grass, a water bottle and a towel at the end of it, in a tank
    top and leggings, ponytail through her cap. The runtime runs the routine (jumping jacks, a
    breather, side stretches); the parts it moves:
      companion_jump    everything, for hopping           companion_leg_l/_r   from the hips
      companion_torso   from the hips, for leaning        companion_arm_l/_r   from the shoulders
      companion_gym_head_ponytail  bouncing along"""
    m = Model("companion_mat")
    m.box((0.8, 1.9, 0.02), (0, 0.1, 0.01), P.MAT)
    for y in (-0.8, 1.0):
        m.box((0.8, 0.04, 0.021), (0, y, 0.011), P.MAT_DARK)
    m.cyl(0.045, 0.24, (0.62, 0.85, 0), P.TILE_BLUE, segs=8)                            # water bottle
    m.cyl(0.03, 0.04, (0.62, 0.85, 0.24), P.WHITE, segs=6)
    m.box((0.36, 0.22, 0.04), (0.6, 0.45, 0.02), P.WHITE, rot=(0, 0, 0.3))           # a folded towel
    m.box((0.36, 0.04, 0.041), (0.6, 0.45, 0.021), P.CAP_ROSE, rot=(0, 0, 0.3))
    m.build(root)

    hip = 0.84
    jump = group("companion_jump", parent=root)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"companion_leg_{side}")
        g.box((0.17, 0.19, 0.74), (0, 0, -0.4), P.ES_LEGS)
        g.box((0.16, 0.28, 0.1), (0, -0.04, -0.79), P.SNEAKER)
        g.box((0.17, 0.29, 0.03), (0, -0.04, -0.825), P.PEBBLE)
        g.build(jump, loc=(s * 0.11, 0, hip))
    t = Model("companion_torso")
    t.box((0.44, 0.26, 0.16), (0, 0, 0.04), P.ES_LEGS)
    t.box((0.42, 0.25, 0.5), (0, 0, 0.37), P.ES_TOP)                                  # tank top
    for s in (-1, 1):
        t.box((0.12, 0.22, 0.08), (s * 0.17, 0, 0.66), P.ES_ARM)                       # bare shoulders
        t.box((0.07, 0.24, 0.1), (s * 0.1, 0, 0.66), P.ES_TOP)                         # straps
    t.box((0.14, 0.14, 0.1), (0, 0, 0.72), P.FAIR)                                    # neck
    torso = t.build(jump, loc=(0, 0, hip))
    for s, side in ((1, "l"), (-1, "r")):
        a = Model(f"companion_arm_{side}")
        _limb(a, (0, 0, 0), (0, 0, -0.56), 0.11, P.ES_ARM)
        a.box((0.09, 0.11, 0.11), (0, 0, -0.6), P.FAIR)
        if s < 0:
            a.box((0.12, 0.13, 0.05), (0, 0, -0.46), P.WATCH)                          # a sports watch
        a.build(torso, loc=(s * 0.28, 0, 0.62))
    head(torso, "companion_gym_head", (0, 0, 0.76), ponytail=True)


def podcast(root):
    """On the edge of the pier with a podcast in, legs over the water, phone in her lap. Her seat,
    the deck, is at z = 0.78. The runtime swings `companion_pod_shin_l/_r` from the knees, and
    now and then she shakes her head (`companion_pod_head`) or throws up a hand
    (`companion_pod_arm`) at whatever's just been said."""
    seat = 0.78
    up = seat - 0.56
    m = Model("companion_pod_body")
    for s in (-1, 1):
        _limb(m, (s * 0.12, 0.0, 0.66 + up), (s * 0.12, -0.44, 0.64 + up), 0.18, P.E_LEGS)  # thighs, over the edge
    _top(m, up, root)
    # left arm: hand on her thigh, the phone in it
    sh, el, hand = (0.28, 0.03, 1.24 + up), (0.3, -0.06, 0.96 + up), (0.16, -0.3, 0.8 + up)
    mid = tuple(a + (b - a) * 0.35 for a, b in zip(sh, el))
    _limb(m, sh, mid, 0.14, P.E_TOP)
    _limb(m, mid, el, 0.12, P.E_ARM)
    _limb(m, el, hand, 0.11, P.E_ARM)
    m.box((0.09, 0.11, 0.08), hand, P.FAIR)
    m.box((0.1, 0.16, 0.02), (hand[0] - 0.06, hand[1] + 0.02, hand[2] + 0.05), P.PHONE, rot=(0.2, 0, 0))
    m.build(root)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"companion_pod_shin_{side}")                                        # dangling, swinging
        _limb(g, (0, 0, 0), (0, -0.04, -0.5), 0.15, P.E_LEGS)
        g.box((0.16, 0.3, 0.1), (0, -0.1, -0.55), P.SNEAKER)
        g.box((0.17, 0.31, 0.03), (0, -0.1, -0.605), P.PEBBLE)
        g.build(root, loc=(s * 0.12, -0.44, 0.64 + up))
    a = Model("companion_pod_arm")                                                   # the right arm, from the shoulder
    _limb(a, (0, 0, 0), (0, -0.03, -0.14), 0.14, P.E_TOP)
    _limb(a, (0, -0.03, -0.14), (0, -0.08, -0.3), 0.12, P.E_ARM)
    _limb(a, (0, -0.08, -0.3), (0.12, -0.3, -0.42), 0.11, P.E_ARM)                     # forearm, resting on her leg
    a.box((0.09, 0.11, 0.08), (0.13, -0.33, -0.43), P.FAIR)
    a.build(root, loc=(-0.28, 0.03, 1.24 + up))
    head(root, "companion_pod_head", (0, 0.02, 1.37 + up), earbuds=True)


def watching(root):
    """On the sofa in the lighthouse (quarters.py), a bowl of popcorn in her lap, watching the
    telly: her seat is at z = 0.59. `*_snack` is her right forearm, off to the bowl and back.
    When the cats are in out of the rain, Charlie has her lap (`companion_lap`) instead of the
    popcorn (`companion_bowl`), and gets stroked."""
    up = 0.03
    m = Model("companion_tv_body")
    _seated(m, 0.59, root)
    for s in (-1, 1):
        sh, el = (s * 0.28, 0.03, 1.27), (s * 0.29, -0.06, 0.99)
        mid = tuple(a + (b - a) * 0.35 for a, b in zip(sh, el))
        _limb(m, sh, mid, 0.14, P.E_TOP)
        _limb(m, mid, el, 0.12, P.E_ARM)
    _limb(m, (0.29, -0.06, 0.99), (0.16, -0.3, 0.88), 0.11, P.E_ARM)                 # left hand on the bowl's rim
    m.box((0.09, 0.11, 0.08), (0.15, -0.32, 0.88), P.FAIR)
    m.build(root)

    g = Model("companion_snack")                                                      # right forearm, from the elbow
    _limb(g, (0, 0, 0), (0.12, -0.24, -0.08), 0.11, P.E_ARM)
    g.box((0.09, 0.11, 0.08), (0.13, -0.27, -0.08), P.FAIR)
    g.build(root, loc=(-0.29, -0.06, 0.99))
    head(root, "companion_tv_head", (0, 0.02, 1.4))

    bw = Model("companion_bowl")                                                      # put aside when a cat takes her lap
    bw.cyl(0.17, 0.1, (0, -0.28, 0.73 + up), P.TILE_BLUE, segs=10, r_top=0.21)
    for i in range(9):
        a, r = i * 2.4, 0.05 + (i % 3) * 0.045
        bw.box((0.06, 0.06, 0.05), (math.cos(a) * r, -0.28 + math.sin(a) * r, 0.85 + up + (i % 2) * 0.02), P.POPCORN)
    bw.build(root)
    group("companion_lap", (0, -0.2, 0.74 + up), parent=root)                        # where Charlie curls up, in the rain


def on_the_sofa(parent, loc, rot_z):
    """Her, in the lighthouse, under a group the runtime shows only while she's there."""
    g = group("companion_lighthouse", parent=parent)
    watching(group("companion_watching", loc, rot_z=rot_z, parent=g, id="companion_watching"))
    return g


def baking(root):
    """At the hut's long table while a pie bakes, a mug of tea in both hands, glancing over at
    the oven now and then. Her seat, the bench, is at z = 0.475."""
    seat = 0.475
    up = seat - 0.56
    m = Model("companion_bake_body")
    _seated(m, seat, root)
    for s in (-1, 1):
        sh, el = (s * 0.28, 0.03, 1.24 + up), (s * 0.29, -0.08, 0.94 + up)
        mid = tuple(a + (b - a) * 0.35 for a, b in zip(sh, el))
        _limb(m, sh, mid, 0.14, P.E_TOP)
        _limb(m, mid, el, 0.12, P.E_ARM)
    m.build(root)

    g = Model("companion_hut_mug")                                                    # forearms and mug, from the elbows
    for s in (-1, 1):
        _limb(g, (s * 0.29, 0, 0), (s * 0.1, -0.22, 0.1), 0.11, P.E_ARM)
        g.box((0.09, 0.11, 0.1), (s * 0.08, -0.26, 0.11), P.FAIR)
    g.cyl(0.075, 0.15, (0, -0.28, 0.05), P.WHITE, segs=8)
    g.cyl(0.078, 0.02, (0, -0.28, 0.19), P.RED, segs=8)
    g.cyl(0.062, 0.005, (0, -0.28, 0.2), P.COFFEE, segs=8)
    g.build(root, loc=(0, -0.08, 0.94 + up))
    head(root, "companion_bake_head", (0, 0.02, 1.37 + up))


def pie_in_the_oven(parent, stove):
    """The oven door glowing, a cherry pie inside, a wisp of steam at the door, and the kitchen
    timer on the table (absolute hut coordinates, like hut.py)."""
    sx, sy = stove
    g = group("pie", parent=parent, id="pie")
    m = Model("pie_in_the_oven")
    x, y, z = sx + 0.3, sy - 0.39, 0.5                                                 # the oven door's window
    m.box((0.32, 0.02, 0.17), (x, y, z), P.WARM_LIGHT, glow=True)
    m.box((0.24, 0.021, 0.035), (x, y - 0.002, z - 0.045), P.CRUST)                  # the pie, through the glass
    m.box((0.2, 0.022, 0.02), (x, y - 0.003, z - 0.02), P.CHERRY)
    for dx in (-0.07, 0.0, 0.07):
        m.box((0.02, 0.023, 0.02), (x + dx, y - 0.004, z - 0.02), P.CRUST_DARK)       # its lattice
    m.box((0.34, 0.025, 0.02), (x, y - 0.004, z + 0.095), P.IRON)                     # the window's frame
    m.box((0.34, 0.025, 0.02), (x, y - 0.004, z - 0.095), P.IRON)
    m.build(g)
    emitter(parent, (x + 0.2, y - 0.03, z + 0.18), "steam")

    t = Model("kitchen_timer")                                                        # on the table, ticking
    tx, ty, top = 2.45, 0.0, 0.78
    t.ball(0.055, (tx, ty, top + 0.045), P.RED, subdiv=1, scale=(1, 1, 0.8))
    t.box((0.1, 0.02, 0.02), (tx, ty - 0.05, top + 0.05), P.WHITE)
    t.box((0.03, 0.03, 0.03), (tx, ty, top + 0.1), P.WHITE)
    t.build(g)


def at_the_hut(parent, loc, stove):
    """Her in the hut, and the pie she has in the oven, under one group the runtime shows only
    while she's there."""
    g = group("companion_hut", parent=parent)
    baking(group("companion_baking", loc, parent=g, id="companion_baking"))
    pie_in_the_oven(g, stove)
    return g


def bed_reading(root, top: float, cell):
    """Sitting up in bed against a propped-up pillow, reading, the duvet over her knees (from
    `top`, in the bed's checks: see characters.duvet). The group sits on the mattress under her
    middle; the headboard is 0.3 behind her (+y)."""
    m = Model("companion_bed_reading_body")
    m.box((0.8, 0.22, 0.5), (0, 0.24, 0.3), P.WHITE, rot=(-0.3, 0, 0))                  # the pillow behind her
    m.plank_line((0, 0.0, 0.05), (0, 0.1, 0.62), 0.44, 0.26, P.LAVENDER)               # sitting up, leaning back
    m.box((0.15, 0.15, 0.1), (0, 0.11, 0.67), P.FAIR)                                  # neck
    for s in (-1, 1):
        sh, el, hand = (s * 0.27, 0.1, 0.56), (s * 0.3, -0.05, 0.3), (s * 0.13, -0.3, 0.44)
        mid = tuple(a + (b - a) * 0.4 for a, b in zip(sh, el))
        _limb(m, sh, mid, 0.14, P.LAVENDER)
        _limb(m, mid, el, 0.12, P.FAIR)
        _limb(m, el, hand, 0.11, P.FAIR)
    duvet(m, (0, top), 5, cell, rise=0.3)
    m.build(root)

    b = Model("companion_bed_book")                                                    # open, tipped towards her
    b.box((0.44, 0.32, 0.02), (0, 0, 0), P.TILE_BLUE)
    for s in (-1, 1):
        b.box((0.2, 0.28, 0.03), (s * 0.105, 0, 0.02), P.CANVAS, rot=(0, s * 0.1, 0))
        for i in range(5):
            b.box((0.14, 0.014, 0.004), (s * 0.105, -0.09 + i * 0.045, 0.037), P.INK)
    book = b.build(root, loc=(0, -0.33, 0.48))
    book.rotation_euler = (-1.0, 0, 0)
    pg = Model("companion_bed_page")                                                   # turned now and then
    pg.box((0.19, 0.27, 0.006), (0.095, 0, 0), P.WHITE)
    pg.build(book, loc=(0, 0, 0.04))
    head(root, "companion_bed_head", (0, 0.12, 0.72), rot=(0.3, 0, 0), cap=False)


def bed_asleep(root, top: float, cell):
    """Asleep on her back, her head turned towards him, the duvet up to her chin (as in
    bed_reading) and the book shut on it by her hand. The group sits at her neck, just over the
    mattress; `*_head` and `*_body` breathe."""
    m = Model("companion_bed_asleep_body")
    m.box((0.5, 0.2, 0.2), (0, -0.08, -0.05), P.LAVENDER)                              # shoulders
    duvet(m, (0, top), 5, cell)
    m.box((0.3, 0.22, 0.05), (0.2, -0.5, 0.15), P.TILE_BLUE, rot=(0, 0, 0.3))         # the book, shut
    m.box((0.28, 0.2, 0.05), (0.2, -0.5, 0.175), P.CANVAS, rot=(0, 0, 0.3))         # pages stand clear of the cover: no shared faces
    m.build(root)
    head(root, "companion_bed_asleep_head", (0, 0, 0.12), rot=(-math.pi / 2, -0.35, 0), cap=False)


def yoga(root):
    """On the mat next to his (characters.vincent_yoga), in her workout things, doing the same
    poses as him: the runtime keeps them in time."""
    m = Model("companion_yoga_mat")
    m.box((0.8, 1.9, 0.02), (0, 0, 0.01), P.MAT)
    m.box((0.8, 0.04, 0.021), (0, 0.9, 0.011), P.MAT_DARK)
    m.build(root)
    yoga_poses(root, "companion_yoga", dict(top=P.ES_TOP, sleeve=P.ES_ARM, arm=P.ES_ARM, thigh=P.ES_LEGS, shin=P.ES_LEGS, skin=P.FAIR, wide=0.9),
               lambda parent, name, loc, rot: head(parent, name, loc, rot=rot, ponytail=True))


def petting(root, pet: str):
    """On her knees in the grass, petting the cats on their bench or Beike (characters.PETTING)."""
    kneeling(root, f"companion_petting_{pet}", pet,
             dict(top=P.E_TOP, sleeve=P.E_TOP, arm=P.E_ARM, thigh=P.E_LEGS, shin=P.E_LEGS, skin=P.FAIR, foot=P.SNEAKER, wide=0.9),
             lambda parent, name, loc, rot: head(parent, name, loc, rot=rot))
