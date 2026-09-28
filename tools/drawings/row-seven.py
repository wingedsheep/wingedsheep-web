"""
Draw the wildlife sketchbook's later pages in the atlas's pixel-pencil style (the first six rows
were generated, see wildlife-sketches.md) into its seventh row, left to right:

  starlings  one in its autumn coat, glossy and spangled with white, and a murmuration behind it
  seal       a harbour seal hauled out on the sand, head up, taking a look round
  eagle      a white-tailed eagle on a dead branch: pale head, a heavy hooked bill, the white tail
  boar       a wild boar side on, snout down, with one of her striped piglets trotting in front
  highland   a Highland cow side on, her head turned to you: fringe, handlebar horns, a shaggy skirt

    python3 tools/drawings/row-seven.py
"""
import math

import numpy as np
from PIL import Image

ATLAS = "public/art/wildlife-sketches-pixel.png"
CELL = 209   # atlas cell, in image pixels
PX = 4       # image pixels to an art pixel, like the rest of the atlas
N = 52       # the drawing, in art pixels

PAPER = (245, 235, 211)
# warm graphite, from darkest to lightest, with a muted gloss of purple and green in it
INK = (50, 42, 44)
DARK = (72, 62, 68)
MID = (98, 86, 96)
PURPLE = (112, 92, 112)
GREEN = (96, 106, 90)
LIGHT = (146, 134, 136)
CREAM = (238, 228, 204)
BUFF = (204, 180, 140)
BEAK = (132, 116, 92)
LEG = (136, 92, 82)
SMUDGE = (224, 212, 186)
# the seal's greys
FUR = (150, 142, 140)
PALE = (190, 182, 172)
SPOT = (88, 82, 86)
# the eagle's browns, and its buff head
BROWN = (120, 96, 76)
UMBER = (84, 66, 56)
HEAD = (226, 212, 182)
# the boar's snout, and the Highland cow's gingers
SNOUT = (196, 164, 152)
GINGER = (178, 114, 72)
GINGER_L = (206, 150, 100)
GINGER_D = (128, 80, 54)
NOSE = (96, 66, 58)
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def inside_ellipse(x, y, cx, cy, rx, ry, angle=0.0):
    c, s = math.cos(angle), math.sin(angle)
    dx, dy = x - cx, y - cy
    u, v = dx * c + dy * s, -dx * s + dy * c
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1


def inside_poly(x, y, pts):
    hit = False
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


def hashed(x, y, k=0):
    return (math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453) % 1


def starling():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    body = np.zeros((N, N), bool)   # the bird's silhouette, less beak and legs
    wing = np.zeros((N, N), bool)
    tail = [(16, 33), (11, 35), (5, 42), (9, 45), (19, 39)]
    wing_pts = [(32, 25), (24, 25), (16, 31), (8, 42), (12, 42), (22, 35), (31, 31)]
    for y in range(N):
        for x in range(N):
            X, Y = x + 0.5, y + 0.5
            if (inside_ellipse(X, Y, 25, 30, 13, 9, -0.4) or inside_ellipse(X, Y, 36, 17, 5.5, 5)
                    or inside_ellipse(X, Y, 32, 22, 5.5, 6) or inside_poly(X, Y, tail)):
                body[y, x] = True
            if inside_poly(X, Y, wing_pts):
                wing[y, x] = True
    wing &= body
    top = np.array([np.argmax(body[:, x]) if body[:, x].any() else N for x in range(N)])
    bottom = np.array([N - 1 - np.argmax(body[::-1, x]) if body[:, x].any() else 0 for x in range(N)])

    # the coat: lit from above, glossy green on the head and purple on the back, shading down
    # to near-black underneath, spangled with pale spots, bigger and whiter on the belly
    for y in range(N):
        for x in range(N):
            if not body[y, x]:
                continue
            depth = (y - top[x]) / max(bottom[x] - top[x], 1) + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.35
            head = inside_ellipse(x + 0.5, y + 0.5, 36, 18, 7, 6.5)
            gloss = GREEN if head else PURPLE
            img[y, x] = gloss if depth < 0.3 else MID if depth < 0.6 else DARK
            under = (depth > 0.55 or x > 31) and not head
            lattice = (x + (y // 2) % 2 * 2) % 4 == 0 and y % 2 == 0
            if not wing[y, x] and lattice and hashed(x, y) < (0.95 if under else 0.25 if head else 0.7):
                img[y, x] = CREAM if under else BUFF
                if under and hashed(x, y, 2) < 0.4 and body[y, x + 1]:
                    img[y, x + 1] = CREAM  # the biggest spangles, on the breast
    # the folded wing: dark, its feathers edged in buff (dotted, as a pencil would)
    for y in range(N):
        for x in range(N):
            if wing[y, x]:
                d = (BAYER[y % 4][x % 4] / 16)
                img[y, x] = INK if d < 0.35 else DARK
                if (x * 0.75 + y) % 6 < 1 and y > 25 and x % 2 == 0:
                    img[y, x] = BUFF
    # the lower margin of the wing, pale where the long feathers lie over each other
    for x in range(9, 31):
        ys = [y for y in range(N) if wing[y, x]]
        if ys and x % 2:
            img[ys[-1] - 1, x] = BUFF
    # a pencil line along the top of the wing, where it lies against the back
    for y in range(1, N):
        for x in range(N):
            if wing[y, x] and body[y - 1, x] and not wing[y - 1, x]:
                img[y, x] = INK
    for x, y in [(34, 12), (35, 12), (36, 12), (32, 14), (30, 17), (28, 19)]:
        img[y, x] = LIGHT  # a glint on the crown and back

    # beak: long and sharp; the legs, a little bent, with their toes spread
    beak = [(40.5, 15.5), (40.5, 20), (49, 18.2)]
    for y in range(N):
        for x in range(N):
            if not body[y, x] and inside_poly(x + 0.5, y + 0.5, beak):
                img[y, x] = INK if not inside_poly(x + 0.5, y - 0.5, beak) or not inside_poly(x + 0.5, y + 1.5, beak) else BEAK
    for fx, lean in ((23, 1), (29, -1)):
        for y in range(37, 46):
            img[y, fx + (lean if y > 41 else 0)] = LEG
        for dx in (-1, 1, 2, 3):  # three toes forward, one back
            img[45, fx + lean + dx] = LEG
        img[44, fx + lean + 3] = LEG

    # outline wherever the bird meets paper
    solid = np.any(img != PAPER, axis=2)
    pad = np.pad(solid, 1)
    edge = solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    img[edge & body] = INK
    img[16, 37] = INK   # the eye, with a catchlight
    img[16, 38] = INK
    img[15, 37] = CREAM

    for x in (16, 18, 21, 25, 27, 31, 34, 36):   # pencil smudges on the ground
        img[47, x] = SMUDGE

    # the murmuration, far off behind: little birds streaming along a ribbon that folds back
    rng = np.random.default_rng(5)
    for _ in range(46):
        t = rng.uniform(0, 1)
        x = int(3 + t * 26 + rng.normal(0, 1.4))
        y = int(12 + math.sin(t * 6.0) * 5 - t * 4 + rng.normal(0, 1.1))
        if not (1 <= x < N - 2 and 2 <= y < 24) or solid[y - 1:y + 1, x - 1:x + 2].any():
            continue
        tone = MID if rng.uniform() < 0.5 else LIGHT
        img[y, x] = tone
        if rng.uniform() < 0.6:  # near enough to see the wings
            img[y - 1, x - 1] = tone
            img[y - 1, x + 1] = tone
    return img


def seal():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    body = np.zeros((N, N), bool)
    # the hind flippers, splayed and lifted a little off the sand
    upper = [(13, 28), (7, 25), (3, 25), (4, 28), (8, 31), (13, 32)]
    lower = [(13, 32), (4, 32), (1, 35), (3, 37), (13, 37)]
    for y in range(N):
        for x in range(N):
            X, Y = x + 0.5, y + 0.5
            if (inside_ellipse(X, Y, 24, 33, 16, 8.5, 0.04) or inside_ellipse(X, Y, 35, 27, 7.5, 8, -0.6)
                    or inside_ellipse(X, Y, 40, 19, 6.5, 6) or inside_ellipse(X, Y, 45.5, 21.5, 3.2, 2.6)
                    or inside_poly(X, Y, upper) or inside_poly(X, Y, lower)):
                body[y, x] = True
    top = np.array([np.argmax(body[:, x]) if body[:, x].any() else N for x in range(N)])
    bottom = np.array([N - 1 - np.argmax(body[::-1, x]) if body[:, x].any() else 0 for x in range(N)])
    # a mottled grey coat, darker on the back, paler underneath; the spots are small and many
    for y in range(N):
        for x in range(N):
            if not body[y, x]:
                continue
            depth = (y - top[x]) / max(bottom[x] - top[x], 1) + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.35
            img[y, x] = MID if depth < 0.22 else FUR if depth < 0.62 else PALE
            if hashed(x, y) < (0.2 if depth < 0.62 else 0.07) and x < 43:
                img[y, x] = SPOT
                if hashed(x, y, 5) < 0.4 and body[y, x + 1]:
                    img[y, x + 1] = SPOT
    for x, y in [(37, 14), (38, 14), (39, 13), (40, 13), (32, 21), (29, 24), (26, 25), (23, 25)]:
        if body[y, x]:
            img[y, x] = PALE  # the light along its head and back
    # a front flipper, tucked against its side
    for x, y in [(31, 35), (32, 36), (33, 36), (34, 37), (35, 37), (32, 35), (33, 35)]:
        img[y, x] = DARK

    solid = np.any(img != PAPER, axis=2)
    pad = np.pad(solid, 1)
    edge = solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    img[edge & body] = INK
    # the face: a big dark eye, a nostril, a mouth, whiskers
    for x, y in [(41, 17), (42, 17), (41, 18), (42, 18)]:
        img[y, x] = INK
    img[17, 41] = CREAM
    img[20, 47] = INK
    img[23, 45] = img[23, 46] = SPOT
    for x, y in [(49, 21), (50, 22), (49, 23), (51, 24)]:
        img[y, x] = LIGHT
    # sand under it: a scuffed line, and a pebble
    for x in range(3, 42):
        if hashed(x, 43, 7) < 0.55:
            img[43, x] = SMUDGE
    for x in range(8, 36, 3):
        if hashed(x, 45, 8) < 0.5:
            img[45, x] = SMUDGE
    for x, y in [(44, 42), (45, 42), (44, 41), (45, 41)]:
        img[y, x] = LIGHT
    return img


def eagle():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    body = np.zeros((N, N), bool)
    head = np.zeros((N, N), bool)
    wing = np.zeros((N, N), bool)
    tail = np.zeros((N, N), bool)
    bill = [(35, 9), (41, 9.5), (44.5, 12), (44, 16), (42, 15), (41, 13.5), (36, 14.5)]
    wing_pts = [(31, 18), (22, 19), (16, 28), (12, 40), (11, 46), (15, 43), (22, 36), (28, 29)]
    tail_pts = [(18, 36), (11, 46), (13, 49), (19, 48), (23, 38)]
    for y in range(N):
        for x in range(N):
            X, Y = x + 0.5, y + 0.5
            if inside_ellipse(X, Y, 31, 11.5, 6.5, 5.5) or inside_ellipse(X, Y, 28.5, 17.5, 6.5, 5.5, 0.3):
                head[y, x] = body[y, x] = True
            if inside_ellipse(X, Y, 24, 28, 9, 12.5, -0.35) or inside_ellipse(X, Y, 27.5, 36, 4.5, 4.5):
                body[y, x] = True
            if inside_poly(X, Y, wing_pts):
                wing[y, x] = body[y, x] = True
            if inside_poly(X, Y, tail_pts):
                tail[y, x] = body[y, x] = True
    top = np.array([np.argmax(body[:, x]) if body[:, x].any() else N for x in range(N)])
    bottom = np.array([N - 1 - np.argmax(body[::-1, x]) if body[:, x].any() else 0 for x in range(N)])

    # the dead branch it's sat on, silver-grey, running off both sides of the page
    for x in range(2, 50):
        y = 42 - (x - 2) * 0.1
        for dy in range(3):
            yy = int(y) + dy
            if not body[yy, x]:
                img[yy, x] = LIGHT if dy == 0 else MID if dy == 1 or (x + yy) % 3 else LIGHT
    for k in range(5):  # a broken twig off it
        img[39 - k, 44 + k // 2] = MID

    for y in range(N):
        for x in range(N):
            if not body[y, x]:
                continue
            depth = (y - top[x]) / max(bottom[x] - top[x], 1) + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.35
            if tail[y, x]:
                img[y, x] = CREAM if BAYER[y % 4][x % 4] > 3 else PALE
            elif head[y, x]:
                # the pale head, going browner down the neck
                img[y, x] = HEAD if y < 14 else PALE if y < 18 or BAYER[y % 4][x % 4] > 6 else BUFF
            elif wing[y, x]:
                # coverts paler at the shoulder, scalloped; the long feathers dark
                img[y, x] = (BUFF if BAYER[y % 4][x % 4] > 9 else BROWN) if y < 27 else UMBER if BAYER[y % 4][x % 4] > 4 else DARK
                if y < 29 and (x + (y // 3) % 2 * 2) % 4 == 0 and y % 3 == 0:
                    img[y, x] = UMBER
            else:
                img[y, x] = BROWN if depth < 0.3 else UMBER
                if depth > 0.3 and hashed(x, y) < 0.15:
                    img[y, x] = BROWN
    # the feathered trousers, dark, and the feet gripping the branch
    for y in range(33, 40):
        for x in range(25, 31):
            if body[y, x] and not wing[y, x]:
                img[y, x] = UMBER if (x + y) % 3 else DARK
    for x in range(25, 33):
        img[40, x] = BEAK if x % 2 or x > 30 else INK
    img[41, 32] = img[41, 26] = INK   # talons over the far side of the branch
    for y in range(N):
        for x in range(N):
            if inside_poly(x + 0.5, y + 0.5, bill) and not head[y, x] or (inside_poly(x + 0.5, y + 0.5, bill) and x > 34):
                img[y, x] = BUFF if y < 12 else BEAK
    img[15, 43] = img[15, 42] = INK   # the hook

    solid = np.any(img != PAPER, axis=2)
    pad = np.pad(solid, 1)
    edge = solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    img[edge] = INK
    # a pencil line where the wing lies against the body, and along the gape
    for y in range(1, N):
        for x in range(1, N):
            if wing[y, x] and body[y, x + 1] and not wing[y, x + 1]:
                img[y, x] = INK
    for x in range(37, 43):
        img[13, x] = INK
    # the eye: pale, fierce, under a heavy brow
    img[10, 34] = img[10, 35] = INK
    img[11, 34] = INK
    img[11, 35] = BEAK
    img[9, 33] = img[9, 34] = img[9, 35] = img[9, 36] = MID
    for x in (8, 12, 17, 36, 40, 47):   # pencil smudges under the branch
        img[46 + x % 3, x] = SMUDGE
    return img


def thick_line(img, pts, widths, color, mask=None):
    """A pencil stroke through `pts`, `widths` thick at each (tapering between them)."""
    for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], widths, widths[1:]):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 3) + 1
        for k in range(steps + 1):
            t = k / steps
            x, y, w = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w0 + (w1 - w0) * t
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    if dx * dx + dy * dy <= (w / 2) ** 2 + 0.3:
                        xx, yy = int(x + dx), int(y + dy)
                        if 0 <= xx < N and 0 <= yy < N:
                            img[yy, xx] = color
                            if mask is not None:
                                mask[yy, xx] = True


def outline(img, mask):
    solid = mask
    pad = np.pad(solid, 1)
    edge = solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    img[edge] = INK


def boar():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    body = np.zeros((N, N), bool)
    head = [(33, 21), (38, 22), (46, 32), (49, 35), (48, 39), (43, 40), (35, 37), (31, 31)]
    for y in range(N):
        for x in range(N):
            X, Y = x + 0.5, y + 0.5
            if (inside_ellipse(X, Y, 28, 28, 10.5, 11) or inside_ellipse(X, Y, 18, 30.5, 11.5, 9)
                    or inside_ellipse(X, Y, 9, 31, 6.5, 8) or inside_poly(X, Y, head)):
                body[y, x] = True
    top = np.array([np.argmax(body[:, x]) if body[:, x].any() else N for x in range(N)])
    bottom = np.array([N - 1 - np.argmax(body[::-1, x]) if body[:, x].any() else 0 for x in range(N)])
    for y in range(N):
        for x in range(N):
            if not body[y, x]:
                continue
            depth = (y - top[x]) / max(bottom[x] - top[x], 1) + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.35
            img[y, x] = MID if depth < 0.3 else DARK if depth < 0.75 else INK
            if hashed(x, y) < 0.18:
                img[y, x] = LIGHT  # grizzle
            if inside_poly(x + 0.5, y + 0.5, head) and 33 < x < 42 and y > 29 and hashed(x, y, 3) < 0.5:
                img[y, x] = LIGHT  # the grizzled cheek
    # thin legs, and the tail with its tuft
    for x0, y0 in ((30, 37), (34, 37), (8, 37), (12, 37)):
        for y in range(y0, 45):
            img[y, x0] = img[y, x0 + 1] = DARK
            body[y, x0] = body[y, x0 + 1] = True
        img[45, x0] = img[45, x0 + 1] = INK
        body[45, x0] = body[45, x0 + 1] = True
    thick_line(img, [(3.5, 29), (2.5, 35)], [1, 1], DARK, body)
    thick_line(img, [(2.5, 35), (2.5, 38)], [2, 2], INK, body)
    outline(img, body)
    # the crest of bristles along the back
    for x in range(13, 37):
        if x % 2 == 0:
            img[top[x] - 1, x] = INK
            if 20 < x < 34 and x % 4 == 0:
                img[top[x] - 2, x] = INK
    # the snout's disc, a tusk, an ear, the eye
    for y in range(34, 41):
        for x in range(47, 51):
            if inside_ellipse(x + 0.5, y + 0.5, 49, 37, 1.8, 2.8):
                img[y, x] = SNOUT
    img[36, 49] = img[38, 49] = INK
    for x, y in ((44, 38), (45, 37), (45, 36), (46, 35)):
        img[y, x] = CREAM
    ear = np.zeros((N, N), bool)
    thick_line(img, [(34, 21), (35, 17.5)], [3, 1.6], DARK, ear)   # a small upright ear
    outline(img, ear)
    img[25, 38] = INK
    img[24, 38] = LIGHT

    # a piglet trotting along in front, striped
    pig = np.zeros((N, N), bool)
    for y in range(N):
        for x in range(N):
            if inside_ellipse(x + 0.5, y + 0.5, 41, 44.5, 5.5, 3.3) or inside_poly(x + 0.5, y + 0.5, [(45, 42), (50.5, 44.5), (50, 46.5), (45, 47)]):
                pig[y, x] = True
    for y in range(N):
        for x in range(N):
            if pig[y, x]:
                img[y, x] = BUFF if (y % 2 == 1 and x < 46) else BROWN if y < 46 else UMBER
    for x0 in (38, 43):
        img[48, x0] = img[48, x0 + 1] = UMBER
        pig[48, x0] = pig[48, x0 + 1] = True
    outline(img, pig)
    img[45, 50] = SNOUT
    img[43, 46] = INK
    for x in range(2, 50, 3):   # scuffed earth under them
        if hashed(x, 49, 9) < 0.6:
            img[49, x] = SMUDGE
    return img


def highland():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    body = np.zeros((N, N), bool)
    for y in range(N):
        for x in range(N):
            X, Y = x + 0.5, y + 0.5
            if inside_ellipse(X, Y, 19, 29, 14, 9) or inside_ellipse(X, Y, 38, 26, 6.5, 7.5):
                body[y, x] = True
    # the shaggy skirt: strands hanging below the belly
    for x in range(6, 33):
        b = max((y for y in range(N) if body[y, x]), default=0)
        for y in range(b, b + 1 + int(hashed(x, 0, 4) * 4)):
            body[y, x] = True
    # short, hairy legs
    for x0 in (9, 13, 25, 29):
        for y in range(36, 45):
            body[y, x0] = body[y, x0 + 1] = body[y, x0 + 2] = True
    thick_line(img, [(5.5, 25), (4, 33), (4, 37)], [1.4, 1.2, 2.4], GINGER_D, body)   # the tail
    for y in range(N):
        for x in range(N):
            if not body[y, x]:
                continue
            strand = hashed(x, y // 3, 1)
            img[y, x] = GINGER_L if strand < 0.3 else GINGER if strand < 0.75 else GINGER_D
            if y > 33 and BAYER[y % 4][x % 4] > 9:
                img[y, x] = GINGER_D
    for x0 in (9, 13, 25, 29):
        img[44, x0:x0 + 3] = INK
    # the face: a dark muzzle below a mop of fringe hanging over the eyes
    for y in range(N):
        for x in range(N):
            if inside_ellipse(x + 0.5, y + 0.5, 38, 33, 4, 2.8):
                img[y, x] = NOSE
                body[y, x] = True
    img[33, 36] = img[33, 40] = INK
    for x in range(32, 45):
        long = 5 + int(hashed(x, 7, 2) * 5)
        for y in range(20, 20 + long):
            if body[y, x]:
                img[y, x] = GINGER_L if (x + y // 2) % 3 else GINGER
    img[27, 35] = img[27, 41] = INK   # an eye, just showing through
    outline(img, body)
    # the horns: out sideways, then sweeping up, pale with dark tips
    horns = np.zeros((N, N), bool)
    thick_line(img, [(34, 21), (28.5, 19.5), (26.5, 15), (26.5, 13)], [3.4, 2.8, 2, 1.2], CREAM, horns)
    thick_line(img, [(42, 21), (47.5, 19.5), (49.5, 15), (49.5, 13)], [3.4, 2.8, 2, 1.2], CREAM, horns)
    for y in range(N - 1):
        for x in range(1, N - 1):
            if horns[y, x] and not horns[y + 1, x] and not body[y + 1, x]:
                img[y + 1, x] = MID   # a pencil line under each horn
            if horns[y, x] and not horns[y, x - 1] and not body[y, x - 1]:
                img[y, x - 1] = MID
            if horns[y, x] and not horns[y, x + 1] and not body[y, x + 1]:
                img[y, x + 1] = MID
    for (x, y) in ((26, 13), (26, 14), (49, 13), (49, 14), (27, 13), (50, 13)):
        if horns[y, x]:
            img[y, x] = DARK
    for x in range(3, 50, 2):   # grass round its feet
        if hashed(x, 46, 5) < 0.5:
            img[46, x] = SMUDGE
            if hashed(x, 45, 6) < 0.4 and not body[45, x]:
                img[45, x] = SMUDGE
    return img


CELLS = [starling, seal, eagle, boar, highland]  # the seventh row, from the left


def main():
    atlas = Image.open(ATLAS).convert("RGB")
    cols, rows = atlas.width // CELL, atlas.height // CELL
    if rows < 7:  # add the seventh row, in paper
        grown = Image.new("RGB", (atlas.width, CELL * 7), PAPER)
        grown.paste(atlas, (0, 0))
        atlas = grown
    for column, draw in enumerate(CELLS):
        art = Image.fromarray(draw()).resize((N * PX, N * PX), Image.NEAREST)
        cell = Image.new("RGB", (CELL, CELL), PAPER)
        cell.paste(art, ((CELL - art.width) // 2, (CELL - art.height) // 2))
        atlas.paste(cell, (column * CELL, CELL * 6))
    atlas.save(ATLAS, optimize=True)
    print(f"{ATLAS}: {atlas.width}×{atlas.height}")


if __name__ == "__main__":
    main()
