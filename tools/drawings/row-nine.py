"""
Draw the wildlife sketchbook's ninth row in the atlas's pixel-pencil style, with the palette and
helpers of row-seven.py (the first six rows were generated, see wildlife-sketches.md; rows seven
and eight are drawn by row-seven.py). The ninth row, left to right:

  curlew   a Eurasian curlew side on, on wet sand: long grey legs, a small head, streaky
           brown-buff plumage and the very long bill curving down; its reflection under it,
           and a line of footprints behind
  knot     a red knot in winter grey, side on, on wet sand: stocky and short-necked, a plain pale
           grey back finely scaled, a white belly speckled grey along the breast and flanks, a short
           straight dark bill and short greenish legs; its reflection under it, and far off above it
           the smudge of a flock

The atlas grows to nine rows (in paper) the first time this runs; after that it redraws the same
pages over themselves.

    python3 tools/drawings/row-nine.py
"""
import importlib.util
import os
import sys

import numpy as np
from PIL import Image

# row-seven.py has a hyphen in its name, so load it by path
_spec = importlib.util.spec_from_file_location("row_seven", os.path.join(os.path.dirname(os.path.abspath(__file__)), "row-seven.py"))
sys.modules["row_seven"] = _row_seven = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_row_seven)
from row_seven import (ATLAS, CELL, PX, N, PAPER, INK, DARK, MID, LIGHT, CREAM, BUFF, SMUDGE, PALE,  # noqa: E402
                       BROWN, UMBER, HEAD, BAYER, hashed, shape, brush, edges, tone, volume, inside_ellipse,
                       inside_poly)

# the curlew's legs, blue-grey, and the wet sand
SLATE = (118, 124, 132)
SLATE_D = (84, 88, 98)
WET = (226, 216, 194)
# the knot's winter grey, and its short greenish legs
ASH = (172, 168, 162)
ASH_D = (128, 124, 124)
OLIVE = (132, 136, 112)
OLIVE_D = (94, 98, 82)


def curlew():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    ground = 41

    # the wet sand: a shine that holds the bird's reflection, ripples, and footprints behind it
    for x in range(1, N - 1):
        for y in (ground + 1, ground + 6, ground + 9):
            if hashed(x, y, 11) < (0.45 if y < ground + 5 else 0.3):
                img[y, x] = SMUDGE
    for fx, fy in ((2, ground + 4), (8, ground + 2), (14, ground + 4)):   # three-toed prints, walking right
        for dx, dy in ((0, 0), (1, 0), (2, 0), (2, -1), (2, 1)):
            img[fy + dy, fx + dx] = MID if dx == 1 else LIGHT

    body = shape(lambda X, Y: inside_ellipse(X, Y, 19, 24, 11, 6.6, -0.18))
    tail = shape(lambda X, Y: inside_poly(X, Y, [(10, 20.5), (3.5, 25), (4, 27), (12, 27.5)]))
    neck = brush([(26, 21), (29.5, 17), (31, 14)], [4.2, 3.2, 2.7])
    head = shape(lambda X, Y: inside_ellipse(X, Y, 32.2, 12.8, 3.4, 3))
    bird = body | tail | neck | head
    wing = shape(lambda X, Y: inside_poly(X, Y, [(27, 19.5), (20, 18.5), (12, 20), (5, 25.5), (9, 27), (18, 27.5), (26, 25)])) & bird

    # streaky brown-buff, paler underneath, the belly nearly white
    tone(img, bird, volume(bird, 4, (-0.4, -0.85, 0.5)), [BROWN, BUFF, BUFF, HEAD, HEAD], 0.5)
    tone(img, (neck | head) & ~body, volume(neck | head, 2.5, (0.2, -0.6, 0.8)), [BROWN, BUFF, HEAD, HEAD], 0.5)
    under = shape(lambda X, Y: Y > 25.5 + (X - 19) * -0.18 and X > 13) & body & ~wing
    tone(img, under, volume(under, 2, (-0.2, 0.3, 0.9)), [HEAD, CREAM, CREAM], 0.4)
    for y, x in np.argwhere((neck | head | body) & ~wing):   # fine dark streaks down the neck and breast
        if (x + y // 3) % 3 == 0 and hashed(x, y // 2, 3) < (0.7 if y < 25 else 0.25):
            img[y, x] = BUFF if img[y, x].tolist() == list(CREAM) else BROWN
    img[head & shape(lambda X, Y: Y < 11.8 and X < 35)] = BROWN   # the darker crown
    img[10, 31] = img[10, 33] = UMBER

    # the folded wing: dark-centred feathers, each edged in buff, so it reads as scallops
    for y, x in np.argwhere(wing):
        r = (x + (y // 3) % 2 * 2) % 4
        img[y, x] = UMBER if r == 0 else BROWN if r == 1 or BAYER[y % 4][x % 4] < 6 else BUFF
        if y % 3 == 2 and r in (2, 3):
            img[y, x] = HEAD
    for y in range(N):   # the long feathers, darker, lying over the tail
        for x in range(N):
            if wing[y, x] and x < 13 and (x + y) % 2:
                img[y, x] = UMBER
    for x, y in ((8, 25), (6, 26), (10, 26)):   # tail bars
        if tail[y, x]:
            img[y, x] = BROWN
    img[edges(bird)] = INK
    for y in range(1, N):   # a pencil line along the top of the wing
        for x in range(N):
            if wing[y, x] and not wing[y - 1, x] and bird[y - 1, x]:
                img[y, x] = DARK

    # the eye, a pale ring round it, and a faint stripe over it
    img[12, 33] = INK
    img[11, 33] = img[12, 34] = CREAM
    img[13, 34] = HEAD

    # the bill, the whole point of the bird: half again as long as the body is deep, curving down
    path = [(35.2, 13.4), (39, 14.2), (42.5, 15.8), (45.5, 18.4), (47.8, 21.8), (49.2, 25)]
    bill = brush(path, [1.35, 1.05, 0.9, 0.78, 0.66, 0.5]) & ~head
    img[bill] = DARK
    img[bill & ~np.roll(bill, -1, 0)] = INK                      # pencilled firmly along its underside
    img[bill & ~np.roll(bill, 1, 0) & np.roll(bill, -1, 0)] = MID  # lighter on top, the base pinkish
    img[13, 35] = img[13, 36] = (150, 120, 108)

    # long legs, the knee a little back, the toes spread on the sand
    for (x0, y0), (kx, ky), (fx, fy) in (((18, 29), (16.8, 35), (18.5, ground)), ((22.5, 29), (21.6, 35), (23.2, ground))):
        leg = brush([(x0, y0), (kx, ky), (fx, fy)], [0.6, 0.55, 0.5]) & ~body
        img[leg] = SLATE
        img[leg & ~np.roll(leg, 1, 1)] = SLATE_D
        for dx in (-2, -1, 1, 2, 3):
            img[ground, int(fx) + dx] = SLATE_D if abs(dx) < 3 else SLATE
    # the knee joints
    img[35, 16] = img[35, 21] = SLATE_D

    # its reflection, broken by ripples, in the wet sand under it
    for y in range(ground + 1, N - 1):
        sy = 2 * ground - y + 1
        if sy < 0 or y % 2 == 0 and y > ground + 3:
            continue
        for x in range(N):
            c = img[sy, x]
            if c.tolist() == list(PAPER) or hashed(x, y, 13) < 0.25:
                continue
            dark = int(c[0]) + int(c[1]) + int(c[2]) < 450
            img[y, x] = (LIGHT if dark else WET) if y < ground + 8 else (WET if dark else PAPER)
    return img


def knot():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    ground = 42

    # far off, over the flat, the rest of them: a loose drift of dots, thicker in the middle
    for x in range(6, 44):
        for y in range(4, 14):
            d = ((x - 25) / 17) ** 2 + ((y - 9 + (x - 25) * 0.15 + 1.2 * np.sin(x / 4)) / 2.6) ** 2
            if d < 1 and hashed(x, y, 21) < 0.36 * (1 - d) + 0.04:
                img[y, x] = LIGHT if hashed(x, y, 22) < 0.8 or d > 0.4 else MID

    # the wet sand: a shine that holds the bird's reflection, and ripples
    for x in range(1, N - 1):
        for y in (ground + 1, ground + 5, ground + 8):
            if hashed(x, y, 17) < (0.45 if y < ground + 5 else 0.3):
                img[y, x] = SMUDGE

    # plump and low: a round body, the head sunk on it with hardly a neck, a short tail
    body = shape(lambda X, Y: inside_ellipse(X, Y, 23, 30.5, 11.5, 7.4, -0.12))
    tail = shape(lambda X, Y: inside_poly(X, Y, [(14, 27), (8.5, 29.5), (9, 31.5), (15, 33)]))
    neck = brush([(30, 28), (33, 25.5)], [5, 4.2])
    head = shape(lambda X, Y: inside_ellipse(X, Y, 34.6, 23.6, 4.3, 3.9))
    bird = body | tail | neck | head
    wing = shape(lambda X, Y: inside_poly(X, Y, [(31, 25), (22, 22.5), (14, 25.5), (9, 30.5), (13, 32.5), (22, 33.5), (29.5, 31.5)])) & bird

    # plain grey above, white below, the line between them soft
    tone(img, bird, volume(bird, 4, (-0.4, -0.85, 0.5)), [ASH_D, ASH, ASH, PALE, HEAD], 0.5)
    tone(img, (neck | head) & ~body, volume(neck | head, 2.5, (0.2, -0.6, 0.8)), [ASH_D, ASH, PALE, HEAD], 0.5)
    under = shape(lambda X, Y: Y > 30.5 + (X - 23) * -0.35) & (body | neck) & ~wing
    tone(img, under, volume(under, 2, (-0.2, 0.3, 0.9)), [HEAD, CREAM, CREAM], 0.4)
    for y, x in np.argwhere(under | (neck & ~wing)):   # faint grey speckle on the breast and down the flanks
        if (x + y) % 2 == 0 and hashed(x, y, 5) < (0.7 if y < 31 else 0.35 if x < 30 else 0.1):
            img[y, x] = PALE if y > 31 else ASH

    # the folded wing: plain grey feathers, each finely edged pale, so it reads as fine scaling
    for y, x in np.argwhere(wing):
        r = (x + (y // 2) % 2 * 2) % 4
        img[y, x] = ASH_D if r == 0 and BAYER[y % 4][x % 4] < 8 else ASH
        if y % 2 == 1 and r in (1, 2):
            img[y, x] = HEAD
    for y in range(N):   # the long feathers, darker, lying over the tail
        for x in range(N):
            if wing[y, x] and x < 14 and (x + y) % 2:
                img[y, x] = LIGHT
    img[edges(bird)] = INK
    for y in range(1, N):   # a pencil line along the top of the wing
        for x in range(N):
            if wing[y, x] and not wing[y - 1, x] and bird[y - 1, x]:
                img[y, x] = DARK

    # a darker cap, a pale stripe over the eye, the eye dark, a grey smudge through it
    img[head & shape(lambda X, Y: Y < 21.8 and X < 37.5) & ~edges(bird)] = ASH_D
    for x in (33, 34, 35, 36):
        img[22, x] = CREAM
    img[23, 35] = INK
    img[23, 34] = img[23, 36] = LIGHT

    # the bill, short, straight and dark, about as long as the head
    bill = brush([(38.4, 23.9), (42, 24.6), (45, 25.4)], [1.1, 0.85, 0.55]) & ~head
    img[bill] = DARK
    img[bill & ~np.roll(bill, -1, 0)] = INK

    # short greenish legs, the knee hardly showing, the toes spread on the sand
    for (x0, y0), (fx, fy) in (((21, 37), (20.6, ground)), ((25.5, 37), (26, ground))):
        leg = brush([(x0, y0), (fx, fy)], [0.6, 0.5]) & ~body
        img[leg] = OLIVE
        img[leg & ~np.roll(leg, 1, 1)] = OLIVE_D
        for dx in (-2, -1, 1, 2):
            img[ground, int(fx) + dx] = OLIVE_D if abs(dx) < 2 else OLIVE

    # its reflection, broken by ripples, in the wet sand under it
    for y in range(ground + 1, N - 1):
        sy = 2 * ground - y + 1
        if sy < 14 or y % 2 == 0 and y > ground + 4:
            continue
        for x in range(N):
            c = img[sy, x]
            if c.tolist() == list(PAPER) or hashed(x, y, 19) < 0.25:
                continue
            dark = int(c[0]) + int(c[1]) + int(c[2]) < 450
            img[y, x] = LIGHT if dark and y < ground + 6 else WET
    return img


# the pages drawn here, by their tile in the atlas (row * 6 + column)
CELLS = {
    48: curlew,   # the ninth row
    49: knot,
}


def main():
    atlas = Image.open(ATLAS).convert("RGB")
    rows = max(atlas.height // CELL, max(CELLS) // 6 + 1)
    if atlas.height < CELL * rows:  # grow the atlas a row at a time, in paper
        grown = Image.new("RGB", (atlas.width, CELL * rows), PAPER)
        grown.paste(atlas, (0, 0))
        atlas = grown
    for tile, draw in CELLS.items():
        art = Image.fromarray(draw()).resize((N * PX, N * PX), Image.NEAREST)
        cell = Image.new("RGB", (CELL, CELL), PAPER)
        cell.paste(art, ((CELL - art.width) // 2, (CELL - art.height) // 2))
        atlas.paste(cell, (tile % 6 * CELL, tile // 6 * CELL))
    atlas.save(ATLAS, optimize=True)
    print(f"{ATLAS}: {atlas.width}×{atlas.height}")


if __name__ == "__main__":
    main()
