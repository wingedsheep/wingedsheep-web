"""Vincent surfing, on a day with a bit of swell (src/island/scene/surf.ts):

  vincent_surf      him in a wetsuit, built like the swimmers (outings.py): everything hangs off
                    `surf_core` at his hips, which the runtime lays flat to paddle, sits up to wait,
                    and turns side-on to stand; legs that bend at the knee, arms, his head.
  surfboard         his board, a soft-top, on its own so it can go flying when he does. Nose to
                    -y, its origin under the middle of it, the deck on top; a fin underneath.

Both are parked out of sight till he's down at the beach east of the pier.
"""
from __future__ import annotations

import characters
import palette as P
from kit import Model, group

PARKED = (0, 0, -20)

SUIT = "#22252c"                 # black neoprene
SUIT_SEAM = "#3f6f9a"            # a blue panel down the sides
DECK = "#4f9fd0"                 # a foam soft-top, the kind you learn on
DECK_STRIPE = "#f2ece2"
BOTTOM = "#f2ece2"
FIN = "#2a2c34"


def vincent_surfer(root, p: str):
    """In his wetsuit: long arms and legs, bare hands and feet, his head."""
    hip = 0.84
    core = group(f"{p}_core", (0, 0, hip), parent=root)
    m = Model(f"{p}_body")
    m.box((0.5, 0.3, 0.22), (0, 0, -0.02), SUIT)
    m.box((0.54, 0.32, 0.46), (0, 0.02, 0.31), SUIT)
    for s in (-1, 1):
        m.box((0.02, 0.2, 0.5), (s * 0.27, 0.02, 0.22), SUIT_SEAM)                    # down each side
    m.box((0.06, 0.03, 0.3), (0, 0.185, 0.36), SUIT_SEAM)                             # the zip, down the back
    m.box((0.22, 0.22, 0.12), (0, 0.0, 0.59), SUIT)                                   # collar
    m.build(core)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"{p}_leg_{side}")
        g.box((0.2, 0.22, 0.42), (0, 0, -0.19), SUIT)
        leg = g.build(core, loc=(s * 0.13, 0, 0))
        k = Model(f"{p}_shin_{side}")
        k.box((0.16, 0.17, 0.36), (0, 0, -0.17), SUIT)
        k.box((0.17, 0.28, 0.07), (0, -0.05, -0.38), P.SKIN)                          # bare feet
        k.build(leg, loc=(0, 0, -0.42))
        a = Model(f"{p}_arm_{side}")
        a.box((0.15, 0.15, 0.56), (0, 0, -0.28), SUIT)
        a.box((0.11, 0.12, 0.1), (0, 0, -0.62), P.SKIN)                                # hands
        a.build(core, loc=(s * 0.34, 0, 0.48))
    characters.head(core, f"{p}_head", (0, 0, 0.61), cap=False)


def surfboard(root, name: str):
    """A seven-foot soft-top: a long middle, the nose narrowing to a round point, a squared tail."""
    b = Model(name)
    t = 0.08
    b.box((0.56, 1.3, t), (0, 0.05, t / 2), DECK)
    b.box((0.5, 0.3, t), (0, -0.75, t / 2), DECK)                                    # towards the nose
    b.box((0.38, 0.2, t * 0.9), (0, -1.0, t * 0.45), DECK)
    b.box((0.2, 0.12, t * 0.8), (0, -1.15, t * 0.4), DECK)                           # the tip
    b.box((0.48, 0.25, t), (0, 0.82, t / 2), DECK)                                   # the tail
    b.box((0.05, 2.2, 0.005), (0, -0.12, t + 0.002), DECK_STRIPE)                     # the stringer, painted on
    b.box((0.54, 1.9, 0.01), (0, -0.05, 0.004), BOTTOM)                              # the slick, underneath
    b.box((0.03, 0.18, 0.08), (0, 0.8, -0.04), FIN)                                   # the fin, narrowing to its tip
    b.box((0.03, 0.09, 0.06), (0, 0.84, -0.11), FIN)
    b.build(root)


def populate(t):
    vincent_surfer(group("vincent_surf", PARKED, id="vincent_surf"), "surf")
    surfboard(group("surfboard", PARKED, id="vincent_surf"), "surfboard_board")
