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
  lugworm  a cut through the wet sand of the flat, paler round the burrow and going grey and black
           deeper down: the funnel at the surface on the left, the coiled cast on the right, and the
           L-shaped burrow between them with the worm in it, head down under the funnel, its fat
           ringed reddish-brown body tufted with red gills, the tail end thin and pale up the tail shaft

and then three out of his books, on the rest of the row:

  hippogriff  a hippogriff side on, standing, storm grey: an eagle's front half, the grey-white
              feathered head with a hooked beak and an orange eye, the scalloped neck and chest and
              the front legs scaled and taloned; a horse's dappled hindquarters, hocks and hooves behind,
              the wings folded along its side, a short tail
  spermwhale  a sperm whale side on, falling nose down through the sky: the great square head, the
              narrow jaw dropped open under it, wrinkled dark grey skin, the small flippers splayed and
              the flukes up; a few speed lines streaming up past it, and nothing at all below
  windspren   two windspren, ribbons of pale light curling over into a loop and running on with the
              wind, twisting as they go and thinning to nothing at the ends; a few faint wind lines

The atlas grows to nine rows (in paper) the first time this runs; after that it redraws the same
pages over themselves.

    python3 tools/drawings/row-nine.py
"""
import importlib.util
import math
import os
import sys

import numpy as np
from PIL import Image

# row-seven.py has a hyphen in its name, so load it by path
_spec = importlib.util.spec_from_file_location("row_seven", os.path.join(os.path.dirname(os.path.abspath(__file__)), "row-seven.py"))
sys.modules["row_seven"] = _row_seven = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_row_seven)
from row_seven import (ATLAS, CELL, PX, N, PAPER, INK, DARK, MID, LIGHT, CREAM, BUFF, SMUDGE, PALE,  # noqa: E402
                       BROWN, UMBER, HEAD, BEAK, BLUE_L, RED, RED_L, RED_D, PINK, PINK_D, BAYER, hashed, shape, brush, edges,
                       tone, volume, inside_ellipse, inside_poly)

# the curlew's legs, blue-grey, and the wet sand
SLATE = (118, 124, 132)
SLATE_D = (84, 88, 98)
WET = (226, 216, 194)
# the knot's winter grey, and its short greenish legs
ASH = (172, 168, 162)
ASH_D = (128, 124, 124)
OLIVE = (132, 136, 112)
OLIVE_D = (94, 98, 82)
# the lugworm, reddish-brown to nearly black, and the sand going grey and then black under the flat
WORM = (128, 78, 64)
WORM_D = (92, 56, 50)
WORM_L = (160, 106, 84)
SILT = (168, 160, 150)
# the hippogriff's storm greys, its orange eye and its horn-coloured beak and legs
STORM = (128, 130, 138)
STORM_D = (92, 94, 104)
STORM_L = (172, 172, 174)
AMBER = (214, 132, 60)
AMBER_D = (164, 96, 52)
HORN = (196, 178, 140)
# the sperm whale's wrinkled dark grey
WHALE = (104, 104, 114)
WHALE_L = (138, 138, 146)
# the windspren's pale light, and the side of the ribbon turned away
GLEAM = (246, 248, 240)
GLEAM_D = (220, 228, 230)


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


def lugworm():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    surface = 17

    def top(x):   # the flat, sagging into a funnel where the sand slumps down towards the worm's head
        return surface + 4 * np.exp(-((x - 10) / 4.2) ** 2)

    # the cut through the sand: a block of it, its sides and foot left ragged
    def in_sand(X, Y):
        w = 1.6 * hashed(int(Y), 0, 31)
        return top(X) <= Y < 47.5 + 1.5 * hashed(int(X), 0, 32) and 1.5 + w < X < 50.5 - w
    sand = shape(in_sand)

    # the burrow: a head shaft of loose sand under the funnel, the gallery along the bottom, and the
    # tail shaft up to the cast; the sand round it paler (the water gets in) than the black below
    head_shaft = brush([(10, top(10)), (9.8, 26)], [1.5, 1.8])
    path = [(9.8, 25.5), (10.4, 30.5), (13.2, 34.6), (18.5, 37.2), (28, 37.4), (33.5, 35.8), (37.2, 32), (39.2, 26),
            (40, 21), (40, 16)]
    tube = brush(path, [3.4, 4.2, 4.6, 4.6, 4.4, 4, 3.4, 2.6, 2.2, 1.4])
    halo = brush(path, [6, 6.5, 7, 7, 7, 6.5, 5.5, 4.5, 4.2, 4]) | brush([(10, 20), (9.8, 26)], [4, 5.5])
    deep = np.zeros((N, N))
    for y, x in np.argwhere(sand):
        deep[y, x] = np.clip((y - surface - 4) / 22, 0, 1) ** 1.2 * (0.4 if halo[y, x] else 1)
    tone(img, sand, 1 - deep, [LIGHT, SILT, PALE, SMUDGE, WET, WET], 0.9)
    for y, x in np.argwhere(sand):   # the grain of it, the sides and foot of the cut fraying out
        fray = max((y - 44) / 5, (4.5 - x) / 3, (x - 46.5) / 3)
        if fray > 0 and hashed(x, y, 39) < fray:
            img[y, x] = PAPER if hashed(x, y, 40) < 0.7 else SMUDGE
        elif hashed(x, y, 33) < 0.16:
            img[y, x] = BUFF if deep[y, x] < 0.35 else SILT if deep[y, x] < 0.6 else MID
    for y, x in np.argwhere(head_shaft & sand):   # the loose sand trickling down the head shaft
        img[y, x] = BUFF if hashed(x, y, 34) < 0.4 else CREAM
    img[tube & sand] = CREAM
    img[edges(tube) & sand & ~head_shaft] = LIGHT   # the burrow's wall, a thin light pencil line

    # the worm: head down in the head shaft, the fat ringed body along the gallery with its red
    # gills, the tail end thinner and pale, up the tail shaft
    spine = [(9.8, 28), (10.6, 31.4), (13.4, 35), (18.5, 37.2), (24.5, 37.7), (29.5, 37.2), (33.4, 35.6),
             (36.6, 32.2), (38.5, 27.6), (39.5, 23)]
    radii = [1.8, 2.8, 3.2, 3.2, 3.0, 2.6, 2.0, 1.4, 1.1, 0.8]
    worm = brush(spine, radii)
    pts = []   # the spine, sampled finely, with how far along it each sample lies
    s = 0.0
    for (x0, y0), (x1, y1) in zip(spine, spine[1:]):
        L = np.hypot(x1 - x0, y1 - y0)
        for k in range(int(L * 4)):
            t = k / (L * 4)
            pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, s + L * t))
        s += L
    pts = np.array(pts)
    along = np.zeros((N, N))
    for y, x in np.argwhere(worm):
        along[y, x] = pts[np.argmin((pts[:, 0] - x - 0.5) ** 2 + (pts[:, 1] - y - 0.5) ** 2), 2]
    tail = worm & (along > 23)
    body = worm & ~tail
    tone(img, body, volume(body, 2.5, (-0.3, -0.85, 0.5)), [WORM_D, WORM, WORM, WORM_L], 0.4)
    tone(img, tail, volume(tail, 1.5, (-0.3, -0.85, 0.5)), [PINK_D, PINK, PINK], 0.3)
    for y, x in np.argwhere(worm):   # the rings, close together
        if int(along[y, x] * 0.8) % 2 == 0 and BAYER[y % 4][x % 4] < 12:
            img[y, x] = WORM_D if body[y, x] else PINK_D
    img[edges(worm)] = INK
    img[worm & (along < 1.6) & ~edges(worm)] = WORM_L   # the snout, paler
    # the gills, little bushy red tufts along the middle of it, above and below
    for a in np.arange(9, 21, 2.4):
        x, y, _ = pts[np.argmin(np.abs(pts[:, 2] - a))]
        x = int(x)
        for dy in (-1, 1):
            yy = int(y)
            while worm[yy, x]:
                yy += dy
            for ex, ey, c in ((0, 0, RED), (1, 0, RED_L), (0, dy, RED_D), (-1, dy, RED), (1, dy, RED)):
                if not worm[yy + ey, x + ex]:
                    img[yy + ey, x + ex] = c

    # the surface of the flat, pencilled across the cut, the funnel in it
    for x in range(0, N):
        y0, y1 = int(top(x)), int(top(x + 1))
        if 2 < x < 49 or hashed(x, 0, 37) < 0.5:
            for y in range(min(y0, y1), max(y0, y1) + 1):
                img[y, x] = DARK if 2 < x < 49 else LIGHT
    for x in range(4, 18):   # slumped sand round the funnel's rim
        y = int(top(x + 0.5)) - 1
        if hashed(x, y, 38) < 0.35 and abs(x - 10.5) > 2.5:
            img[y, x] = LIGHT

    # the cast: sand squeezed out of the tail shaft in coils, piled on itself like toothpaste
    coils = [(40, 15.4, 6.6, 0.22), (40.8, 12.8, 5.2, -0.2), (39.8, 10.4, 3.8, 0.2), (40.6, 8.3, 2.2, -0.1)]
    cast = np.zeros((N, N), bool)
    for cx, cy, w, tilt in coils:   # bottom up, each coil lying on the one under it
        c = brush([(cx - w, cy + tilt * w), (cx, cy - 0.5), (cx + w, cy - tilt * w)], [1.5, 1.7, 1.5])
        c &= shape(lambda X, Y: Y < surface)
        new = c & ~cast
        tone(img, new, volume(c, 1.6, (-0.4, -0.9, 0.4)), [SILT, BUFF, BUFF, HEAD], 0.5)
        crease = new & np.roll(cast, -1, 0)   # where it sits on the coil below
        img[crease] = LIGHT
        cast |= c
    img[edges(cast) & shape(lambda X, Y: Y < surface)] = INK
    img[np.roll(edges(cast), 1, 0) & ~cast & shape(lambda X, Y: Y < surface)] = SMUDGE   # its shadow
    return img


def hippogriff():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    ground = 46

    # half eagle and half horse: the horse's barrel and round rump behind, a deep feathered chest in
    # front, the neck up and forward to an eagle's head
    barrel = shape(lambda X, Y: inside_ellipse(X, Y, 19, 26, 11, 6.6) or inside_ellipse(X, Y, 10.5, 24.6, 6.2, 6.6))
    chest = shape(lambda X, Y: inside_ellipse(X, Y, 31.5, 25, 6.4, 8, 0.3))
    neck = brush([(31, 21), (35.5, 14.5), (38, 10.5)], [5.6, 4.4, 3.6])
    head = shape(lambda X, Y: inside_ellipse(X, Y, 39.5, 9, 5, 4.4, -0.1))
    tail = brush([(5, 21.5), (2.8, 25.5), (2.6, 31)], [1.5, 2, 1.3])
    near = brush([(11, 27), (9.8, 33), (8.4, 37.2)], [5, 3, 1.7]) | brush([(8.4, 37.2), (9.6, 43.6)], [1.4, 1.2])
    far = brush([(18, 28.5), (17, 33), (15.4, 37.2)], [3.6, 2.6, 1.5]) | brush([(15.4, 37.2), (16.6, 43.6)], [1.3, 1.1])
    horse = barrel | near | far
    front = (chest | neck | head) & ~barrel | chest & shape(lambda X, Y: X > 28)
    beast = horse | front | tail
    wing = shape(lambda X, Y: inside_ellipse(X, Y, 28.5, 22.6, 6.4, 5.6, -0.15)
                 or inside_poly(X, Y, [(29, 17.2), (20, 18.2), (11, 20.2), (3.6, 24.4), (8, 26.4), (16, 27), (24, 28.2)]))

    # the horse half, storm grey, the far legs darker, a lighter dapple over the rump
    tone(img, horse, volume(horse, 4, (-0.4, -0.85, 0.5)), [STORM_D, STORM, STORM, STORM_L], 0.6)
    img[far & ~barrel] = STORM_D
    for y, x in np.argwhere(barrel):   # the dapples
        if (x + 2 * (y // 3)) % 5 == 0 and y % 3 == 1 and hashed(x, y, 41) < 0.6:
            img[y, x] = STORM_L
    tone(img, tail, volume(tail, 1.4, (-0.4, -0.85, 0.5)), [DARK, STORM_D, STORM], 0.4)
    for y, x in np.argwhere(tail):
        if x % 2 == 0 and y > 24:
            img[y, x] = DARK   # the strands

    # the eagle half: grey-white feathers, whitest on the head, scalloped down the neck and chest,
    # the feathers ending in a ragged fringe over the horse's shoulder
    tone(img, front, volume(chest | neck | head, 3.5, (-0.3, -0.85, 0.6)), [STORM, STORM_L, PALE, HEAD, CREAM], 0.5)
    for y, x in np.argwhere(front & ~head):
        r = (x + (y // 2) % 2 * 2) % 4
        if y % 2 == 0 and r == 0:
            img[y, x] = STORM_L if y > 14 else PALE
    for y, x in np.argwhere(horse & ~front):
        if front[y, min(x + 2, N - 1)] and hashed(x, y, 42) < 0.6 and y < 33:
            img[y, x] = PALE if y % 2 else STORM_L
    img[edges(beast)] = INK
    for y, x in np.argwhere(near & ~barrel):   # the near hind leg, pencilled against the far one
        if far[y, x - 1] or far[y, x + 1]:
            img[y, x] = INK

    # the folded wing, laid along its side: grey coverts edged pale at the shoulder, the long flight
    # feathers behind darker and striped, their tips lying over the rump
    img[wing] = STORM_L
    for y, x in np.argwhere(wing):
        if x > 22:   # the coverts, row on row of rounded little feathers
            r, ry = (x + (y // 3) % 2 * 2) % 4, y % 3
            arc = ry == 2 and r in (1, 2) or ry == 1 and r in (0, 3)
            img[y, x] = STORM if arc else PALE if ry == 0 and BAYER[y % 4][x % 4] > 6 else STORM_L
        else:
            stripe = (y - (x - 22) * 0.3) % 2.5
            img[y, x] = DARK if stripe < 0.8 else STORM_D if stripe < 1.4 and BAYER[y % 4][x % 4] < 8 else STORM
    img[edges(wing)] = INK
    for y, x in np.argwhere(wing):   # a pencil line between the coverts and the flight feathers
        if 22 <= x < 23 and 19 < y < 28:
            img[y, x] = DARK

    # the head: a pale crown, the eye orange and fierce under a heavy brow
    img[head & shape(lambda X, Y: Y < 7.6) & ~edges(beast)] = CREAM
    img[7, 40] = img[7, 41] = img[7, 42] = DARK   # the brow
    img[8, 41] = AMBER
    img[8, 40] = INK
    img[9, 41] = AMBER_D
    img[9, 40] = STORM_L
    # the beak: hooked, horn-coloured, darker at the hook
    bill = shape(lambda X, Y: inside_poly(X, Y, [(42.4, 6.8), (46.5, 7.4), (49.2, 9.4), (49.8, 12.6), (48.6, 14),
                                                 (47.9, 12), (46, 11.6), (42.6, 12)]))
    bill &= ~shape(lambda X, Y: inside_ellipse(X, Y, 39.5, 9, 3.4, 3.2))
    tone(img, bill, volume(bill, 1.5, (-0.3, -0.9, 0.4)), [BEAK, HORN, HORN, HEAD], 0.5)
    img[edges(bill)] = INK
    img[bill & shape(lambda X, Y: X > 47.6 and Y > 11.2)] = DARK   # the hook
    for x in range(43, 47):   # the gape
        img[11, x] = INK if x > 43 else DARK
    img[8, 44] = DARK   # the nostril

    # front legs: an eagle's, feathered to the knee, then scaled, ending in spread talons
    for (x0, y0), (fx, fy), far_side in (((35.6, 30), (37.2, ground - 1), True), ((30.5, 31), (30.6, ground - 1), False)):
        trouser = brush([(x0, y0), (x0 + 0.4, y0 + 5)], [2.7, 2]) & ~chest
        img[trouser] = STORM_L if far_side else PALE
        img[trouser & (np.arange(N)[None, :] % 2 == 1) & (np.arange(N)[:, None] % 2 == 0)] = STORM
        img[edges(trouser)] = INK
        leg = brush([(x0 + 0.4, y0 + 5.5), (fx, fy)], [1.0, 0.9]) & ~trouser
        img[leg] = BEAK if far_side else HORN
        img[leg & ~np.roll(leg, 1, 1)] = DARK   # pencilled down the back
        fx = int(fx)
        for yy in range(int(y0) + 7, ground - 2, 2):   # the scales
            if leg[yy, fx + 1]:
                img[yy, fx + 1] = BEAK if not far_side else UMBER
        for dx in (-3, -2, -1, 0, 1, 2, 3):   # the toes, spread
            img[ground - 1, fx + dx] = BEAK if far_side else HORN
        img[ground - 2, fx - 1] = img[ground - 2, fx + 1] = INK
        for tx in (fx - 4, fx + 4):   # the talons, hooked into the ground
            img[ground - 1, tx] = INK
            img[ground, tx] = INK
    # the hooves
    for fx in (9, 16):
        for dx in range(-1, 3):
            img[ground - 2, fx + dx] = DARK
            img[ground - 1, fx + dx] = INK

    # ground: a few smudges round the feet
    for x in range(2, 50):
        if hashed(x, ground, 43) < 0.45 and img[ground, x].tolist() == list(PAPER):
            img[ground, x] = SMUDGE
        if hashed(x, ground + 2, 44) < 0.2:
            img[ground + 2, x] = SMUDGE
    return img


def spermwhale():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER

    # nose down, tipped a little: `along` runs from the snout (0) up to the flukes, `across` from the
    # back (negative, on the right) to the belly and jaw (positive, on the left)
    cx, cy, lean = 25.5, 25, 0.18
    nose = (cx + 22 * math.sin(lean), cy + 22 * math.cos(lean))

    def local(X, Y):
        dx, dy = X - nose[0], Y - nose[1]
        along = -(dx * math.sin(lean) + dy * math.cos(lean))
        across = -(dx * math.cos(lean) - dy * math.sin(lean))
        return along, across

    def to_xy(along, across):
        return (nose[0] - along * math.sin(lean) - across * math.cos(lean),
                nose[1] - along * math.cos(lean) + across * math.sin(lean))

    def body_test(X, Y):
        a, c = local(X, Y)
        if a < 0 or a > 40:
            return False
        if a < 18:   # the great square head, its snout blunt, the underside cut away a little for the jaw
            r = max(0, 2.6 - a)   # rounding off the snout's corners
            lo = -8.6 + r * r * 0.5
            hi = 8.6 - r * r * 0.5 - (1.6 if a > 4 else 1.6 * a / 4)
            return lo < c < hi
        t = (a - 18) / 22   # the body behind it, a step narrower, tapering to the tail stock
        half = 7.2 * (1 - t) ** 0.9 + 1.3 * t
        mid = -0.9 + 0.9 * t
        return abs(c - mid) < half

    body = shape(body_test)
    flukes = shape(lambda X, Y: inside_poly(X, Y, [to_xy(*p) for p in
                   [(38.5, -1.6), (41.6, -8), (44.8, -11.5), (44.4, -6), (42.8, 0), (44.4, 6), (44.8, 11.5), (41.6, 8), (38.5, 1.6)]]))
    whale = body | flukes
    head = body & shape(lambda X, Y: local(X, Y)[0] < 18)

    # dark grey all over, lighter where the light catches the back and the great brow of the head
    lit = volume(whale, 5, (0.55, -0.35, 0.75))
    tone(img, whale, lit, [DARK, WHALE, WHALE, WHALE_L, WHALE_L], 0.6)
    # the wrinkles: wavy lines running round the body behind the head, pencilled darker
    for y, x in np.argwhere(body & ~head):
        a, c = local(x + 0.5, y + 0.5)
        if (a / 2.8 + 0.3 * math.sin(c * 0.9 + a * 0.4)) % 1 < 0.34 and hashed(x // 2, y, 61) < 0.7:
            img[y, x] = DARK
    img[edges(whale)] = INK

    # the jaw: long, narrow, slung under the head, dropped wide open as it falls, pale teeth along it
    hinge = to_xy(16, 7.4)
    tip = to_xy(2, 15.5)
    jaw = brush([hinge, tip], [1.8, 1.1]) & ~body
    img[jaw] = STORM_L
    img[jaw & shape(lambda X, Y: local(X, Y)[1] < local(*hinge)[1] + (16 - local(X, Y)[0]) * 0.58)] = PALE
    img[edges(jaw)] = INK
    for k in range(4, 14, 2):   # the teeth, on the jaw's inner edge
        x, y = to_xy(k, 7.4 + (16 - k) / 14 * 8.1 - 1.4)
        x, y = int(x), int(y)
        if not body[y, x]:
            img[y, x] = CREAM
    # the pale mouth along the underside of the head, now the jaw has left it
    for y, x in np.argwhere(head & ~edges(whale)):
        a, c = local(x + 0.5, y + 0.5)
        if 2.5 < a < 15.5 and c > 4.6:
            img[y, x] = PALE if (x + y) % 2 else CREAM
    # the eye, small, just above the corner of the mouth
    ex, ey = to_xy(15.8, 3.6)
    img[int(ey), int(ex)] = INK
    img[int(ey), int(ex) + 1] = INK
    img[int(ey) - 1, int(ex)] = WHALE_L
    # the blowhole, off at the front of the head, on its back
    bx, by = to_xy(1.4, -7.4)
    img[int(by), int(bx)] = INK
    # small flippers, splayed out behind the head
    for side, (fa, fc) in ((1, (21, 5)), (-1, (21, -7))):
        root = to_xy(fa, fc)
        end = to_xy(fa + 2.5, fc + side * 6)
        fin = brush([root, to_xy(fa + 1, fc + side * 3.5), end], [1.8, 1.5, 0.8]) & ~body
        img[fin] = WHALE
        img[edges(fin)] = INK

    # speed lines streaming up past it, the way it came
    for c0, a0, length in ((-11.5, 27, 14), (-14.5, 12, 8), (10.5, 28, 13), (14, 8, 6), (5.5, 45, 5), (-6, 46, 4)):
        for k in range(int(length * 3)):
            x, y = to_xy(a0 + k / 3, c0)
            x, y = int(x), int(y)
            if 0 <= y < N and 0 <= x < N and not whale[y, x]:
                img[y, x] = LIGHT if k < length * 1.6 or y % 2 else SMUDGE
    return img


def windspren():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER

    # wind lines first, faint, the ribbons riding them
    for y0, x0, x1, k in ((5, 27, 47, 51), (34, 2, 15, 52), (49, 17, 39, 53), (28.5, 39, 50, 54)):
        for x in range(x0, x1):
            y = int(y0 + 1.2 * math.sin((x - x0) / 4.5))
            if hashed(x, y, k) < 0.7:
                img[y, x] = SMUDGE if x - x0 < 3 or x1 - x < 4 or hashed(x, y, k + 1) < 0.4 else LIGHT

    # each ribbon: a curve that runs, loops and runs on, its width twisting as it turns over
    def ribbon(path, width, twist, phase):
        idx = np.full((N, N), -1)
        face = np.zeros((N, N))
        for i, (x, y, nx, ny, s) in enumerate(path):
            w = width(s) * (0.25 + 0.75 * abs(math.cos(twist * s + phase)))
            for u in np.arange(-w, w + 0.01, 0.25):
                px, py = int(x + nx * u), int(y + ny * u)
                if 0 <= px < N and 0 <= py < N:
                    idx[py, px] = i
                    face[py, px] = math.cos(twist * s + phase)
        return idx, face

    def sample(points, step=0.2):
        out, s = [], 0.0
        pts = [np.array(p, float) for p in points]
        # a Catmull-Rom spline through the points
        for i in range(len(pts) - 1):
            p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
            L = np.linalg.norm(p2 - p1)
            for k in range(int(L / step) + 1):
                t = k / (int(L / step) + 1)
                q = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
                d = 0.5 * ((-p0 + p2) + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t * t)
                d /= max(np.linalg.norm(d), 1e-6)
                out.append((q[0], q[1], -d[1], d[0], s + L * t))
            s += L
        return out

    ribbons = [
        (sample([(3, 27), (10, 25), (18, 25.5), (25, 22), (27, 15), (22, 9.5), (16, 13), (18, 20), (26, 24.5), (35, 23),
                 (42, 17), (49, 13)]),
         lambda s: 0.6 + 1.9 * math.sin(min(s / 78, 1) * math.pi), 0.13, 0.3),
        (sample([(8, 45), (16, 42), (24, 41), (30, 37), (30, 31), (25, 30.5), (24, 35), (30, 39.5), (38, 39), (44, 35),
                 (49, 34)]),
         lambda s: 0.5 + 1.3 * math.sin(min(s / 62, 1) * math.pi), 0.17, 1.8),
    ]
    for path, width, twist, phase in ribbons:
        idx, face = ribbon(path, width, twist, phase)
        mask = idx >= 0
        for y, x in np.argwhere(mask):
            img[y, x] = GLEAM if face[y, x] > 0 else GLEAM_D
        # the ribbon's edges, in pencil: where it meets paper, or crosses an earlier stretch of itself
        pad = np.pad(idx, 1, constant_values=-1)
        for y, x in np.argwhere(mask):
            near = [pad[y, x + 1], pad[y + 2, x + 1], pad[y + 1, x], pad[y + 1, x + 2]]
            if any(n < 0 for n in near):   # fading out at either end, as if it were going thin as air
                fade = min(idx[y, x], len(path) - idx[y, x]) / 40
                img[y, x] = (BLUE_L if face[y, x] < 0 else LIGHT) if fade > 1 or hashed(x, y, 57) < fade else SMUDGE
            elif any(n >= 0 and n < idx[y, x] - 25 for n in near):   # where it passes over itself
                img[y, x] = LIGHT
    # a few motes of light shed along the way
    for x, y in ((9, 21), (32, 12), (44, 22), (13, 38), (37, 45), (6, 9)):
        img[y, x] = GLEAM
        img[y - 1, x] = img[y + 1, x] = img[y, x - 1] = img[y, x + 1] = SMUDGE
    return img


# the pages drawn here, by their tile in the atlas (row * 6 + column)
CELLS = {
    48: curlew,   # the ninth row
    49: knot,
    50: lugworm,
    51: hippogriff,
    52: spermwhale,
    53: windspren,
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
