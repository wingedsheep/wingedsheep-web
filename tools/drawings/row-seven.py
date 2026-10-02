"""
Draw the wildlife sketchbook's later pages in the atlas's pixel-pencil style (the first six rows
were generated, see wildlife-sketches.md). The seventh row, left to right:

  starlings  one in its autumn coat, glossy and spangled with white, and a murmuration behind it
  seal       a harbour seal hauled out on the sand, head up, taking a look round
  eagle      a white-tailed eagle on a dead branch: pale head, a heavy hooked bill, the white tail
  boar       a wild boar side on, snout down, with one of her striped piglets trotting in front
  highland   a Highland cow side on, her head turned to you: fringe, handlebar horns, a shaggy skirt

and then the imaginary beasts, still unconfirmed: the snorble on the seventh row's last page,
the rest along the eighth row:

  snorble      curled up asleep in a heap of fur that shifts colour, its long pink snout poking out
  balloonbug   a little red insect blown up like a hot-air balloon, its legs dangling underneath
  fosha        a blue fox with long ears, sat with its muzzle lifted to the stars
  treestrider  a small leafy body high up on four stilt legs, wading through the shallows
  mosslits     three of them on a mossy branch, each tail curled over a little light
  tromb        a striped lizard crouched on a clifftop, its long snout let out over the sea

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
# the imaginary beasts': the snorble's rosy fur and pink snout, the balloonbug's reds,
# the fosha's blues, the treestrider's leaves, the mosslits' glow
ROSE = (184, 146, 136)
ROSE_D = (146, 110, 106)
LILAC = (160, 142, 158)
FAWN = (210, 182, 146)
BLUSH = (236, 214, 200)
PINK = (220, 168, 160)
PINK_D = (176, 120, 116)
RED = (182, 82, 62)
RED_L = (212, 124, 86)
RED_D = (132, 58, 52)
BLUE = (100, 116, 152)
BLUE_L = (148, 162, 190)
BLUE_D = (66, 74, 108)
LEAF = (112, 126, 78)
LEAF_L = (156, 164, 104)
LEAF_D = (78, 88, 60)
GLOW = (150, 192, 146)
GLOW_L = (204, 226, 184)
GLOW_D = (98, 132, 102)
HALO = (216, 230, 192)
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


def extent(mask):
    """Where a shape starts and ends down each column, for shading it from the top."""
    top = np.array([np.argmax(mask[:, x]) if mask[:, x].any() else N for x in range(N)])
    bottom = np.array([N - 1 - np.argmax(mask[::-1, x]) if mask[:, x].any() else 0 for x in range(N)])
    return top, bottom


def shape(test):
    """The art pixels whose centres pass `test(x, y)`."""
    return np.array([[bool(test(x + 0.5, y + 0.5)) for x in range(N)] for y in range(N)])


def brush(pts, radii):
    """A stroke of any thickness through `pts`, `radii` round at each point (tapering between)."""
    mask = np.zeros((N, N), bool)
    ys, xs = np.mgrid[0:N, 0:N] + 0.5
    for (x0, y0), (x1, y1), r0, r1 in zip(pts, pts[1:], radii, radii[1:]):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 3) + 1
        for k in range(steps + 1):
            t = k / steps
            x, y, r = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t
            mask |= (xs - x) ** 2 + (ys - y) ** 2 <= r * r
    return mask


def edges(mask):
    pad = np.pad(mask, 1)
    return mask & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])


def volume(mask, depth=4.0, light=(-0.55, -0.7, 0.6)):
    """How much light each pixel of a shape catches, 0 to 1, if it bulges out of the page like a
    pillow `depth` pixels in from its edge, lit from `light` (left, up, towards you)."""
    inside = np.argwhere(mask)
    outside = np.argwhere(~np.pad(mask, 1)) - 1
    d = np.zeros((N, N))
    for chunk in np.array_split(inside, max(1, len(inside) // 400)):
        if len(chunk):
            diff = chunk[:, None, :] - outside[None, :, :]
            d[chunk[:, 0], chunk[:, 1]] = np.sqrt((diff ** 2).sum(2)).min(1) - 0.5
    t = np.clip(d / depth, 0, 1)
    h = np.sqrt(1 - (1 - t) ** 2) * depth
    h = (h + np.roll(h, 1, 0) + np.roll(h, -1, 0) + np.roll(h, 1, 1) + np.roll(h, -1, 1)) / 5
    gy, gx = np.gradient(h)
    n = np.stack([-gx, -gy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    L = np.array(light, float)
    L /= np.linalg.norm(L)
    return np.clip((n * L).sum(-1), 0, 1) * mask


def tone(img, mask, value, ramp, dither=0.6):
    """Shade `mask` with `ramp` (dark to light) by `value`, dithered like a pencil's grain."""
    for y, x in np.argwhere(mask):
        v = value[y, x] * len(ramp) + (BAYER[y % 4][x % 4] / 16 - 0.47) * dither * 2
        img[y, x] = ramp[int(np.clip(v, 0, len(ramp) - 1))]


def star(img, x, y, big=False):
    img[y, x] = MID if big else LIGHT
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        img[y + dy, x + dx] = LIGHT if big else SMUDGE
    if big:
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            img[y + dy, x + dx] = SMUDGE


def snorble():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    ground = 44
    # a heap of fur curled round on itself, flat where it lies on the grass, wispy all round
    def heap(X, Y):
        a = math.atan2(Y - 31, X - 28)
        tuft = 1 + 0.03 * math.sin(a * 17) + 0.025 * math.sin(a * 9 + 2) + 0.02 * math.sin(a * 29 + 1)
        return inside_ellipse(X, Y, 28, 31, 19.5 * tuft, 15.5 * tuft) and Y < ground
    fur = shape(heap)
    # its head, tucked in at the front, and the long snout laid out along the grass
    def snout_half(x):   # the snout's half-thickness along its length, from the tip at x = 4
        return 1.3 + (x - 4) * 0.13
    def head_test(X, Y):
        if inside_ellipse(X, Y, 34, 37.5, 7.5, 6.3, 0.15):
            return True
        if 3.5 < X < 32:
            mid = 41.2 - (X - 4) * 0.1
            return abs(Y - mid) < snout_half(X) and Y < ground
        return False
    head = shape(head_test)
    fur &= ~head

    # the fur: rounded and soft, lit from the upper left, its colour shifting from lock to lock,
    # warm rose and fawn here, a cool lilac sheen there
    lit = volume(fur, 10, (-0.4, -0.8, 0.45))
    warm = [(124, 90, 86), ROSE_D, ROSE, FAWN, BLUSH]
    cool = [(104, 90, 108), (134, 116, 136), LILAC, (192, 178, 188), BLUSH]
    near_head = np.zeros((N, N), bool)   # the fur in the hollow round its head, in shadow
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            near_head |= np.roll(np.roll(head, dy, 0), dx, 1)
    for y, x in np.argwhere(fur):
        X, Y = x + 0.5, y + 0.5
        r = math.hypot((X - 33) / 1.25, Y - 38)
        a = math.atan2(Y - 38, (X - 33) / 1.25)
        sheen = math.sin(a * 1.6 + r * 0.22) + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.9
        ramp = cool if sheen > 0.45 else warm
        v = lit[y, x] * 5 + (BAYER[y % 4][x % 4] / 16 - 0.47) * 1.4
        if near_head[y, x]:
            v -= 1.2
        img[y, x] = ramp[int(np.clip(v, 0, 4))]
    # locks of fur, pencilled in short strokes that follow the curl round
    darker = {tuple(c): d for ramp in (warm, cool) for c, d in zip(ramp[1:], ramp[:-1])}
    rng = np.random.default_rng(3)
    for _ in range(70):
        x, y = rng.uniform(9, 47), rng.uniform(16, 42)
        if not fur[int(y), int(x)]:
            continue
        for k in range(4):
            a = math.atan2(y - 38, (x - 33) / 1.25)
            xi, yi = int(x), int(y)
            if not (0 <= xi < N and 0 <= yi < N) or not fur[yi, xi] or near_head[yi, xi]:
                break
            img[yi, xi] = darker.get(tuple(img[yi, xi]), img[yi, xi])
            x, y = x - math.sin(a) * 1.25 * 1.1, y + math.cos(a) * 1.1   # round the curl, clockwise
    # the underside, in its own shadow
    for y, x in np.argwhere(fur):
        if y >= ground - 2 and BAYER[y % 4][x % 4] > 4:
            img[y, x] = ROSE_D
    # the head: pale, going pink towards the end of the snout, rounded by the light
    lit = volume(head, 3, (-0.4, -0.8, 0.7))
    for y, x in np.argwhere(head):
        pink = np.clip((30 - x) / 24, 0, 1)
        ramp = [PINK_D, PINK, BLUSH] if pink > 0.55 else [PINK_D, PINK, BLUSH, CREAM] if pink > 0.2 else [ROSE, BLUSH, CREAM, CREAM]
        v = lit[y, x] * len(ramp) + (BAYER[y % 4][x % 4] / 16 - 0.47) * 1.2
        img[y, x] = ramp[int(np.clip(v, 0, len(ramp) - 1))]
    # the fur hangs over the top of its head and casts a soft shadow on it
    for y, x in np.argwhere(head):
        if fur[max(y - 2, 0), x] and (fur[max(y - 1, 0), x] or BAYER[y % 4][x % 4] > 6):
            img[y, x] = ROSE if x > 27 else PINK
    img[edges(fur)] = INK
    img[edges(head)] = INK
    # break the fur's outline into wisps, the way a soft pencil goes over fluff
    for y, x in np.argwhere(edges(fur)):
        if y < ground - 2 and hashed(x, y, 6) < 0.35:
            img[y, x] = DARK
    for a in np.linspace(-2.9, -0.2, 11):   # a few stray hairs standing up off the top
        x = int(28 + math.cos(a) * 21.2 + 0.5)
        y = int(31 + math.sin(a) * 16.8 + 0.5)
        if 0 <= x < N and 0 <= y < N and not fur[y, x] and hashed(x, y, 2) < 0.6:
            img[y, x] = LIGHT
    # the mouth, a line along the underside of the snout, and the nose at its tip
    for x in range(8, 27):
        y = int(41.2 - (x - 4) * 0.1 + snout_half(x) * 0.45)
        if hashed(x, 0, 8) < 0.85:
            img[y, x] = PINK_D
    img[40, 4] = img[41, 4] = INK
    img[40, 5] = PINK_D
    img[39, 5] = BLUSH
    # the eye, shut tight, with its lashes
    for x, y in ((29, 36), (30, 37), (31, 37), (32, 37), (33, 36)):
        img[y, x] = INK
    img[38, 30] = img[38, 32] = ROSE
    # the small round ear, half lost in the fur
    ear = shape(lambda X, Y: inside_ellipse(X, Y, 39.5, 34.5, 2.7, 3.3, 0.2))
    inner = shape(lambda X, Y: inside_ellipse(X, Y, 39.7, 34.9, 1.3, 2, 0.2))
    img[ear] = BLUSH
    img[inner] = PINK
    img[edges(ear)] = INK
    img[34, 40] = PINK_D
    # it lies on the grass: a soft shadow, and a few blades
    for x in range(2, 50):
        if (fur | head)[ground - 1, x] and BAYER[ground % 4][x % 4] < 9:
            img[ground, x] = LIGHT
        elif hashed(x, ground, 2) < 0.5 and x % 2:
            img[ground, x] = SMUDGE
    for x0, h, lean in ((47, 3, 1), (49, 2, 0), (6, 2, -1), (2, 3, 0)):
        for k in range(h):
            img[ground - 1 - k, x0 + (lean if k == h - 1 else 0)] = SMUDGE if k else LIGHT
    return img


def balloonbug():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    cx, cy, R = 26, 18, 13.5
    # blown up like a hot-air balloon: a sphere drawn in to a neck underneath
    def balloon(X, Y):
        if (X - cx) ** 2 + (Y - cy) ** 2 <= R * R:
            return True
        if cy < Y < 35.5:   # the taper, curving in to the neck
            t = (Y - cy) / (35.5 - cy)
            return abs(X - cx) < max(R * math.cos(t * math.pi / 2) ** 0.75, 2.3)
        return False
    body = shape(balloon)
    lit = volume(body, 12, (-0.55, -0.75, 0.5))
    tone(img, body, lit, [RED_D, RED, RED_L, (226, 156, 108)], 0.7)

    def on_sphere(lon, lat):
        """Where a point on the balloon at a longitude/latitude (radians, 0 facing you) lands."""
        tilt = 0.32   # we look down on it a little
        x, y, z = math.cos(lat) * math.sin(lon), -math.sin(lat), math.cos(lat) * math.cos(lon)
        y, z = y * math.cos(tilt) + z * math.sin(tilt), -y * math.sin(tilt) + z * math.cos(tilt)
        return cx + x * R * 0.96, cy + y * R * 0.96, z

    # bands round its middle, like the gores of a balloon, bending round with it
    for lat, band in ((0.24, BUFF), (0.18, BUFF), (-0.22, RED_L), (-0.34, BUFF), (-0.4, BUFF)):
        for k in range(160):
            lon = -math.pi / 2 + k / 159 * math.pi
            x, y, z = on_sphere(lon, lat)
            if z > 0:
                xi, yi = int(x), int(y)
                if body[yi, xi] and not edges(body)[yi, xi]:
                    shade = lit[yi, xi]
                    img[yi, xi] = band if shade > 0.35 else (GINGER_D if band == BUFF else RED)
    # dark spots scattered over it, squashed as they turn away round the curve
    for lon, lat, size in ((-0.2, 0.68, 1.5), (0.55, 0.6, 1.3), (-0.95, 0.5, 1.1), (1.15, 0.45, 0.9),
                           (0.1, 0.0, 1.6), (-0.62, -0.03, 1.4), (0.82, 0.02, 1.2), (-1.25, 0.0, 0.9),
                           (1.35, -0.05, 0.8), (-0.3, -0.68, 1.2), (0.42, -0.72, 1.1), (0.2, 1.05, 1.0),
                           (-1.0, -0.62, 0.9), (1.0, -0.62, 0.9)):
        x, y, z = on_sphere(lon, lat)
        for yy in range(int(y - 2), int(y + 3)):
            for xx in range(int(x - 2), int(x + 3)):
                if body[yy, xx] and inside_ellipse(xx + 0.5, yy + 0.5, x, y, size * max(z, 0.5), size):
                    img[yy, xx] = INK if lit[yy, xx] < 0.5 else DARK
    # the shine, and a pale rim of light reflected up from below on the far side
    for x, y in ((19, 9), (20, 9), (18, 10), (19, 10), (17, 12), (21, 8)):
        img[y, x] = CREAM
    img[11, 18] = (226, 156, 108)
    img[edges(body)] = INK

    # the insect itself hanging under it: a little head, feelers, and six thin legs
    bug = shape(lambda X, Y: inside_ellipse(X, Y, 26, 38, 3.2, 2.5) or inside_ellipse(X, Y, 26, 35.8, 2.4, 1.5))
    lit = volume(bug, 1.5)
    tone(img, bug, lit, [INK, DARK, MID], 0.5)
    img[edges(bug)] = INK
    img[37, 24] = img[37, 27] = CREAM   # the eyes, catching the light
    img[38, 24] = img[38, 27] = DARK
    for pts in (((24.5, 36), (21, 33.5), (19.5, 34)), ((27.5, 36), (31, 33.5), (32.5, 34))):   # the feelers
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            for s in range(9):
                t = s / 8
                xx, yy = int(ax + (bx - ax) * t), int(ay + (by - ay) * t)
                if not body[yy, xx]:
                    img[yy, xx] = DARK
    legs = (((23.5, 38.5), (20, 39), (19, 42.5)), ((24, 39.5), (21.5, 41.5), (21.5, 45)),
            ((25, 40.3), (24.5, 43), (24.5, 46)), ((27, 40.3), (27.5, 43), (27.5, 46)),
            ((28, 39.5), (30.5, 41.5), (30.5, 45)), ((28.5, 38.5), (32, 39), (33, 42.5)))
    for (hx, hy), (kx, ky), (fx, fy) in legs:
        for (ax, ay), (bx, by), c in (((hx, hy), (kx, ky), DARK), ((kx, ky), (fx, fy), MID)):
            for s in range(13):
                t = s / 12
                xx, yy = int(ax + (bx - ax) * t), int(ay + (by - ay) * t)
                if not bug[yy, xx]:
                    img[yy, xx] = c
        img[int(ky), int(kx)] = INK   # the knee
        img[int(fy), int(fx) + (1 if fx > 26 else -1)] = MID   # a hooked foot
    # far below: its shadow on the grass, and a few blades
    for x in range(18, 35):
        if inside_ellipse(x + 0.5, 50.5, 26, 50.5, 8, 1) and BAYER[2][x % 4] < 9:
            img[50, x] = SMUDGE
    for x0, h, lean in ((5, 7, 1), (8, 5, -1), (10, 4, 0), (42, 5, -1), (45, 8, 1), (48, 5, 0)):
        for k in range(h):
            img[50 - k, x0 + (lean if k > h // 2 else 0)] = LIGHT if k < h // 2 else SMUDGE
    return img


def fosha():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    BLUE_P = (186, 196, 216)   # the palest blue, where the starlight catches it
    ramp = [BLUE_D, BLUE, BLUE_L, BLUE_P]
    light = (0.5, -0.8, 0.55)   # the light comes from the stars, up to the right
    # the far legs and ear first, darker, behind everything else
    far = shape(lambda X, Y: inside_poly(X, Y, [(26.5, 33), (29, 33), (28.8, 46.5), (26.2, 46.5)])
                or inside_poly(X, Y, [(29.5, 12), (33.5, 10), (29.5, 3.5), (25.5, 1.5), (26, 4.5)]))
    tone(img, far, volume(far, 1.5, light) * 0.6, ramp, 0.5)
    img[edges(far)] = INK
    # sat up on its haunches, side on, its head thrown back to look at the sky
    muzzle = [(32, 11.5), (38.5, 7), (41.5, 5.8), (42.8, 7.2), (38, 13), (34.5, 18.5)]
    head = shape(lambda X, Y: inside_ellipse(X, Y, 31, 15.5, 6, 5.4, -0.6) or inside_poly(X, Y, muzzle))
    ruff = shape(lambda X, Y: inside_poly(X, Y, [(25.5, 15), (22.5, 19.5), (25, 19.5), (23.5, 22.5), (27, 21.5), (28, 23), (30, 20)]))
    torso = shape(lambda X, Y: inside_ellipse(X, Y, 20.5, 38.5, 8.5, 7.8)          # the haunch
                  or inside_ellipse(X, Y, 25, 30, 6.8, 10.5, 0.25)                   # the body
                  or inside_ellipse(X, Y, 29.5, 22, 4.2, 6, 0.3)                     # the neck
                  or inside_ellipse(X, Y, 29.8, 30, 3.8, 6, 0.1))                    # the chest
    leg = shape(lambda X, Y: inside_poly(X, Y, [(29.5, 32), (33.2, 32), (33, 46.5), (30, 46.5)]))
    ear = shape(lambda X, Y: inside_poly(X, Y, [(25, 15), (30.5, 11), (24, 5.5), (16.5, 4), (19, 7.5)]))
    body = head | ruff | torso | leg
    tone(img, body, volume(body, 5, light), ramp)
    # the pale bib, down the throat and chest, and the cream under the jaw
    bib = shape(lambda X, Y: inside_poly(X, Y, [(42.8, 7.2), (34.5, 18.5), (33.6, 31), (31, 34), (30.5, 25), (32.5, 17.5), (39.5, 10)]))
    for y, x in np.argwhere(bib & body):
        img[y, x] = CREAM if BAYER[y % 4][x % 4] > 4 else BLUE_P
    # the line of the haunch, and the back of the leg; fur pencilled along the back
    for x, y in ((14, 33), (15, 32), (16, 31.5), (17, 31), (12, 35), (11.5, 37), (19, 31)):
        if body[int(y), int(x)]:
            img[int(y), int(x)] = BLUE_D
    rng = np.random.default_rng(4)
    for _ in range(26):
        x, y = rng.uniform(13, 30), rng.uniform(20, 44)
        if body[int(y), int(x)] and body[int(y) + 1, int(x) - 1] and not bib[int(y), int(x)]:
            img[int(y), int(x)] = BLUE_D
            img[int(y) + 1, int(x) - 1] = BLUE_D if rng.uniform() < 0.5 else img[int(y) + 1, int(x) - 1]
    img[edges(body)] = INK
    for y in range(33, 46):   # the gap between the front leg and the chest
        if body[y, 29] and not leg[y, 28]:
            img[y, 29] = BLUE_D
    # the ear, long and laid back, with its dark inside
    tone(img, ear, volume(ear, 1.5, light), ramp, 0.4)
    inner = shape(lambda X, Y: inside_poly(X, Y, [(25.5, 13), (29, 11), (23.5, 6.5), (19, 5.4), (20.5, 7.5)]))
    img[inner & ear] = BLUE_D
    img[edges(ear)] = INK
    # the tail, big and soft, swept round in front of its feet with a pale tip
    tail = brush([(12, 38.5), (12.5, 43), (17, 46.5), (25, 47.5), (33, 46.5), (38.5, 44)], [1.6, 2.6, 2.8, 2.8, 2.5, 1.4])
    tail &= ~shape(lambda X, Y: Y < 41 and X > 12.5)
    tlit = volume(tail, 2.5, light)
    for y, x in np.argwhere(tail):
        if x > 33:
            img[y, x] = CREAM if BAYER[y % 4][x % 4] > 3 else BLUE_P
        else:
            v = tlit[y, x] * 4 + (BAYER[y % 4][x % 4] / 16 - 0.47) * 1.2
            img[y, x] = ramp[int(np.clip(v, 0, 3))]
    img[edges(tail)] = INK
    # the face: a dark nose, the line of the mouth, an eye turned up to the stars
    img[6, 41] = img[6, 42] = img[7, 42] = img[5, 41] = INK
    for x, y in ((41, 8), (40, 9), (39, 10), (38, 11)):   # the line of the mouth, shut
        img[y, x] = BLUE_D
    for x, y in ((33, 12), (34, 12), (33, 13), (34, 11), (32, 13)):
        img[y, x] = INK
    img[12, 34] = CREAM
    img[11, 35] = BLUE_D   # the lid, swept up at the corner
    # paws, just showing
    for x in (30, 32):
        img[46, x] = BLUE_D
    # the stars it is looking at
    star(img, 47, 4, True)
    star(img, 50, 14)
    star(img, 39, 2)
    for x, y in ((50, 8), (44, 11), (33, 3), (45, 17)):
        img[y, x] = SMUDGE
    # the ground: a shadow, and a few blades of grass
    for x in range(9, 42):
        if x % 2 or (x > 14 and x < 38 and BAYER[1][x % 4] < 10):
            img[49, x] = SMUDGE if x % 3 else LIGHT
    for x0, h in ((7, 3), (9, 2), (41, 3), (43, 2)):
        for k in range(h):
            img[48 - k, x0 + (k == h - 1)] = SMUDGE
    return img


def treestrider():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    leafy = [LEAF_D, LEAF, LEAF_L, (186, 188, 132)]
    feet = ((5, 45), (17, 48), (35, 47.5), (47, 44.5))
    # the water it wades through: a far shore line, a few strokes on the surface, and rings
    # spreading out from each foot, the legs' reflections broken up beneath them
    for x in range(2, 50, 2):
        if hashed(x, 37, 1) < 0.4:
            img[37, x] = SMUDGE
    for x0, y0, n in ((24, 42, 4), (40, 40, 3), (26, 50, 3)):
        img[y0, x0:x0 + n] = SMUDGE
    for fx, fy in feet:
        for rx, c in ((2.5, MID), (4.5, LIGHT), (6.5, SMUDGE)):
            for k in range(int(rx * 9)):
                t = k / int(rx * 9) * 2 * math.pi
                x, y = int(fx + 0.5 + rx * math.cos(t)), int(fy + 0.5 + rx * 0.3 * math.sin(t))
                if 1 <= x < N - 1 and y < N and hashed(x, y, int(rx)) < (0.9 if math.sin(t) > 0 else 0.55):
                    img[y, x] = c
        for k in range(2, 6, 2):
            if fy + k < N:
                img[int(fy) + k, int(fx)] = LIGHT
    # four long stilt legs, thin as reeds, each bent once at a knee held up level with its back,
    # the shins bowing a little; the far pair drawn paler
    hips = ((17, 15.5), (25, 19), (29.5, 16), (32, 12.5))
    knees = ((6.5, 5.5), (14.5, 5), (35, 4), (38.5, 1.5))

    def leg(i, far):
        (hx, hy), (kx, ky), (fx, fy) = hips[i], knees[i], feet[i]
        bow = 2.2 if fx < kx else -2.2   # the shin bows out, away from the body
        mx, my = (kx + fx) / 2 - bow, (ky + fy) / 2
        line = []
        for k in range(60):
            t = k / 59
            line.append((hx + (kx - hx) * t, hy + (ky - hy) * t, True))
        for k in range(120):
            t = k / 119
            x = (1 - t) ** 2 * kx + 2 * (1 - t) * t * mx + t * t * fx
            y = (1 - t) ** 2 * ky + 2 * (1 - t) * t * my + t * t * fy
            line.append((x, y, False))
        for x, y, upper in line:
            xi, yi = int(x + 0.5), int(y + 0.5)
            if 0 <= yi < N and 0 <= xi < N:
                img[yi, xi] = MID if far else DARK
        img[int(ky + 0.5), int(kx + 0.5)] = DARK if far else INK   # the knees, knobbly
        img[int(ky + 0.5) - 1, int(kx + 0.5)] = LIGHT if far else MID
        fxi, fyi = int(fx + 0.5), int(fy + 0.5)
        img[fyi, fxi - 1:fxi + 2] = MID if far else DARK   # the foot, splayed in the water
    leg(1, True)
    leg(2, True)
    leg(3, False)   # this one passes behind its head
    # the body up top: a plump leafy abdomen, a small thorax, and a head drawn out to a point
    belly = shape(lambda X, Y: inside_ellipse(X, Y, 23, 14, 7.5, 5.5, -0.1))
    chest = shape(lambda X, Y: inside_ellipse(X, Y, 31, 14, 3.6, 3, -0.15)) & ~belly
    head = shape(lambda X, Y: inside_ellipse(X, Y, 35.5, 14.5, 2.4, 1.8, 0)          # the neck
                 or inside_ellipse(X, Y, 39.8, 14.2, 3, 2.6, -0.2)
                 or inside_poly(X, Y, [(40, 12), (45, 12.3), (49.5, 13.8), (44.5, 15.2), (40.5, 16.5)])) & ~chest & ~belly
    for part, depth in ((belly, 3), (chest, 1.5), (head, 1.5)):
        tone(img, part, volume(part, depth), leafy)
    # the abdomen is a leaf: a midrib along it and the veins running back from it
    for x in range(16, 30):
        y = int(13 - (x - 23) * 0.1)
        if belly[y, x]:
            img[y, x] = LEAF_D
        if x % 3 == 0:
            for k in (1, 2, 3):
                for yy in (y + k, y - k):
                    if belly[yy, x - k] and not edges(belly)[yy, x - k]:
                        img[yy, x - k] = LEAF_D
    for x in range(42, 49):   # the seam along its snout
        img[int(13.9 + (x - 42) * 0.05), x] = LEAF_D
    img[edges(belly)] = INK
    img[edges(chest)] = INK
    img[edges(head)] = INK
    img[13, 39] = img[13, 40] = img[14, 39] = INK   # the eye
    img[13, 39] = CREAM
    # fronds sweeping back off its shoulders, like the crown of a young palm
    for cx, cy, rx, ry, ang in ((12, 13, 5.5, 2, 0.2), (15.5, 8, 5.5, 1.9, -0.55)):
        leaf = shape(lambda X, Y: inside_ellipse(X, Y, cx, cy, rx, ry, ang)) & ~belly
        tone(img, leaf, volume(leaf, 1.5), [LEAF_D, LEAF, LEAF_L], 0.5)
        for k in range(-int(rx) + 1, int(rx)):   # the midrib
            x, y = int(cx + 0.5 + k * math.cos(ang)), int(cy + 0.5 + k * math.sin(ang))
            if leaf[y, x]:
                img[y, x] = LEAF_D
        img[edges(leaf)] = DARK
        for y, x in np.argwhere(leaf):   # a soft shadow under each one
            if y + 1 < N and img[y + 1, x].tolist() == list(PAPER):
                img[y + 1, x] = LIGHT
    leg(0, False)
    return img


def mosslits():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    glow = [(80, 116, 90), GLOW_D, GLOW, GLOW_L]
    rim = (58, 84, 66)

    def along(x):   # the top of the branch
        return 41 - x * 0.34

    def girth(x):
        return 8 - x * 0.06
    # a mossy branch, rising across the page from the lower left, rounded by the light
    branch = shape(lambda X, Y: 0 <= Y - along(X) < girth(X) and 1 <= X <= 50.5)
    for y, x in np.argwhere(branch):
        d = (y + 0.5 - along(x + 0.5)) / girth(x + 0.5)   # 0 on top, 1 underneath
        v = (1 - abs(d - 0.3) * 1.6) * 3 + (BAYER[y % 4][x % 4] / 16 - 0.47) * 1.3
        img[y, x] = [DARK, MID, LIGHT, PALE][int(np.clip(v, 0, 3))]
        if (x * 0.34 + y + hashed(x // 3, 0, 1) * 1.5) % 3.4 < 0.75 and d > 0.25 and hashed(x, y) < 0.7:
            img[y, x] = DARK   # the furrows in the bark
    img[edges(branch)] = INK
    knot = shape(lambda X, Y: inside_ellipse(X, Y, 37, along(37) + 5, 1.8, 1.2))
    img[knot] = DARK
    img[int(along(37) + 5), 37] = INK
    # moss in soft cushions along the top, and a strand or two hanging under
    for x in range(2, 50):
        y0 = int(along(x + 0.5))
        lump = math.sin(x * 0.42 + 1) * 1.2 + hashed(x, 3, 5) * 1.1
        for k in range(int(max(lump, 0) * 1.3) + 1):
            yy = y0 + 1 - k
            img[yy, x] = LEAF_D if k == 0 and lump < 0.5 else GREEN if BAYER[yy % 4][x % 4] > 9 else LEAF_L if k else LEAF
        if lump > 0.4:
            img[y0 + 1 - int(lump * 1.3), x] = DARK if hashed(x, 1) < 0.5 else LEAF_D
    for x, n in ((12, 4), (15, 2), (31, 3)):
        for k in range(n):
            img[int(along(x) + girth(x)) + k, x + (k > 1)] = GREEN

    # the mosslits: soft, slug-like bodies laid along the branch, each lifting a long thin tail
    # that curls over forwards at the end, round a little light
    for bx, size, flip in ((10, 0.95, 1), (26.5, 1.2, -1), (41.5, 0.9, 1)):
        by = along(bx) - 2.1 * size
        slope = math.atan(-0.34)
        length, height = 6.2 * size, 2.3 * size
        rear = (bx - flip * length * 0.75, by + 0.3 - (-flip * length * 0.75) * 0.34)
        rise, curl = 15 * size, 4.2 * size
        tail = []
        for k in range(14):   # up from its back in a gentle S
            t = k / 13
            tail.append((rear[0] - flip * math.sin(t * 3.1) * 1.8 * size + flip * t * 1.2, rear[1] - t * rise))
        top = tail[-1]
        cx, cy = top[0] + flip * curl, top[1]
        turns = 26
        for k in range(1, turns):   # then over in a spiral, tighter and tighter
            a = k / (turns - 1) * 4.4
            r = curl * (1 - k / (turns - 1) * 0.55)
            tail.append((cx - flip * r * math.cos(a), cy - r * math.sin(a)))
        tipx, tipy = tail[-1]
        # its glow: a pale halo out into the paper round the tip
        for y in range(N):
            for x in range(N):
                r = math.hypot(x + 0.5 - tipx, y + 0.5 - tipy)
                if r < 6 * size and img[y, x].tolist() == list(PAPER) and BAYER[y % 4][x % 4] < (16 if r < 2.8 * size else 8 if r < 4.4 * size else 3):
                    img[y, x] = HALO
        n = len(tail)
        shape_ = brush(tail, [max(1.9 * size - 1.9 * size * k / n, 0.55) for k in range(n)])
        shape_ |= shape(lambda X, Y: inside_ellipse(X, Y, bx, by, length, height, slope))
        hx, hy = bx + flip * length * 0.82, by - 1.1 * size - flip * length * 0.82 * 0.34
        shape_ |= shape(lambda X, Y: inside_ellipse(X, Y, hx, hy, 2.1 * size, 1.9 * size))
        lit = volume(shape_, 1.8, (-0.3, -0.8, 0.5))
        tone(img, shape_, lit, glow, 0.6)
        edge = edges(shape_)
        shadowed = edge & ~(np.roll(shape_, -1, 0) & np.roll(shape_, -1, 1))
        img[edge] = GLOW   # lit on the upper left, where it glows out into the paper,
        img[shadowed] = rim   # pencilled firmly on the side away from the light
        under = edges(shape_) & ~np.roll(shape_, -1, 0)
        img[under & (np.mgrid[0:N, 0:N][0] > by - 3)] = INK   # a firmer line underneath, where it sits
        for k in range(4, n - 8, 4):   # the brighter freckles along its tail
            x, y = int(tail[k][0] + 0.5), int(tail[k][1] + 0.5)
            if shape_[y, x]:
                img[y, x] = (222, 236, 206)
        # two short feelers, and an eye
        fx, fy = int(hx + flip * 1.5 * size + 0.5), int(hy - 1.6 * size)
        img[fy, fx] = img[fy - 1, fx + flip] = rim
        img[fy, fx - flip * 2] = img[fy - 1, fx - flip * 2] = rim
        img[int(hy + 0.5), int(hx + flip * 0.6 + 0.5)] = INK
        # the light itself, at the heart of the curl
        ix, iy = int(tipx + 0.5), int(tipy + 0.5)
        img[iy, ix] = img[iy, ix + flip] = CREAM
        for dx, dy in ((-1, 0), (2, 0), (0, -1), (1, -1), (0, 1), (1, 1)):
            xx = ix + (dx if flip > 0 else -dx)
            if img[iy + dy, xx].tolist() in (list(PAPER), list(HALO)):
                img[iy + dy, xx] = GLOW_L
    for x, y in ((3, 9), (19, 4), (38, 5), (49, 13), (47, 38), (5, 26), (28, 48)):   # motes of light
        img[y, x] = GLOW
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + dx < N and 0 <= y + dy < N and img[y + dy, x + dx].tolist() == list(PAPER):
                img[y + dy, x + dx] = HALO
    return img


def tromb():
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = PAPER
    # the sea below, in level pencil strokes, and a fish in it, just under the surface
    for y in range(40, 50, 2):
        for x in range(24, 51):
            if hashed(x // 3, y, 2) < 0.45 - (y - 40) * 0.02 and x % 4:
                img[y, x] = BLUE_L if y < 44 and hashed(x // 2, y, 3) < 0.4 else SMUDGE
    fish = shape(lambda X, Y: inside_ellipse(X, Y, 43.5, 45, 2.6, 1.1) or inside_poly(X, Y, [(41, 45), (39.5, 43.8), (39.5, 46.2)]))
    img[fish] = LIGHT
    img[edges(fish)] = MID
    # the rock it sits on, at the top of a cliff
    rock = shape(lambda X, Y: inside_poly(X, Y, [(1, 36), (3, 34.5), (8, 33.6), (12, 33.9), (17, 33.1), (22, 33.6), (26, 35.5),
                                                 (26.5, 38), (24.5, 40.5), (25.5, 44), (24, 47), (24.5, 50), (1, 50)]))
    tone(img, rock, volume(rock, 4, (-0.3, -0.85, 0.45)), [UMBER, BROWN, (158, 134, 110), (200, 184, 154), (226, 212, 184)])
    for pts in (((9, 36), (11, 40), (10, 44)), ((19, 35.5), (20.5, 38), (23, 39)), ((15, 43), (16.5, 47), (16, 50)), ((4, 40), (5, 45))):
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):   # the cracks in it
            for k in range(9):
                t = k / 8
                img[int(ay + (by - ay) * t), int(ax + (bx - ax) * t)] = UMBER
    img[edges(rock)] = INK
    # the tromb, crouched at the edge on its elbows, striped pale and blue like a sea-going lizard
    head = shape(lambda X, Y: inside_ellipse(X, Y, 25, 28.2, 4.3, 3.5, -0.1))
    body = shape(lambda X, Y: inside_ellipse(X, Y, 15, 28.8, 8.8, 4.4, 0.06)) | head
    tail = brush([(8.5, 28), (5, 24), (3, 19), (3, 14), (4.5, 10.5)], [2.8, 2.3, 1.7, 1.1, 0.6])
    lizard = body | tail
    tone(img, lizard, volume(lizard, 2.5, (-0.4, -0.85, 0.6)), [BLUE_L, PALE, CREAM, CREAM])
    # the blue bands across its back and down its tail
    for y, x in np.argwhere((tail | body) & ~head):
        band = (x * 0.95 - y * 0.35) % 3.4 if body[y, x] else (y * 0.95 + x * 0.3) % 3.4
        if band < 1.3:
            img[y, x] = BLUE_D if img[y, x].tolist() == list(BLUE_L) else BLUE
    img[edges(lizard)] = INK
    # its legs folded under it, the elbows and knees up, the toes gripping the rock
    for leg in (brush([(19.5, 30.5), (22.5, 29), (23.8, 32.8)], [1.5, 1.2, 1.1]),
                brush([(11, 30.5), (7.5, 28.5), (8.2, 32.8)], [1.8, 1.4, 1.1])):
        tone(img, leg, volume(leg, 1.2, (-0.4, -0.85, 0.6)), [BLUE_L, PALE, CREAM])
        img[edges(leg)] = INK
    for x, y in ((24, 33), (25, 33), (8, 33), (9, 33)):
        img[y, x] = INK
    # the crest: a long thin horn sweeping up off its head, a shorter one behind it
    for pts, radii in ((((24, 25.5), (24, 18), (25.5, 10), (28.5, 3.5)), (1.4, 1, 0.75, 0.5)),
                       (((22, 26), (20, 21), (19, 17.5)), (1.1, 0.8, 0.5))):
        horn = brush(list(pts), list(radii)) & ~body
        img[horn] = BLUSH
        img[horn & np.roll(horn, -1, 1) & ~np.roll(horn, 1, 1)] = LILAC
        img[edges(horn) & ~np.roll(horn, -1, 1)] = DARK
    # the long snout, let out over the water like a frog's tongue, rolled up at the end
    path = [(28, 29.5), (32, 31.2), (36, 33.5), (40, 35.5), (43.5, 36.3)]
    cx, cy, R = 44, 33.7, 2.7
    for k in range(1, 20):
        a = math.pi / 2 - k / 19 * 5.4
        r = R * (1 - k / 19 * 0.55)
        path.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    snout = brush(path, [2.2, 1.8, 1.55, 1.4, 1.3] + [1.25 - 0.35 * k / 19 for k in range(1, 20)]) & ~head
    tone(img, snout, volume(snout, 1.5, (-0.3, -0.9, 0.6)), [LILAC, BLUSH, CREAM], 0.4)
    img[edges(snout)] = LIGHT
    img[edges(snout) & ~np.roll(snout, -1, 0)] = INK   # pencilled firmly along its underside
    # the eye, red, and the line of its jaw
    for x, y in ((25, 27), (26, 27), (25, 28), (26, 28)):
        img[y, x] = RED_D
    img[27, 25] = RED_L
    img[28, 26] = INK
    for x in (22, 23, 24, 25, 26):
        img[30, x] = BLUE
    return img


# the pages drawn here, by their tile in the atlas (row * 6 + column)
CELLS = {
    36: starling, 37: seal, 38: eagle, 39: boar, 40: highland,   # the seventh row
    41: snorble,                                                   # its last page
    42: balloonbug, 43: fosha, 44: treestrider, 45: mosslits, 46: tromb,   # the eighth row
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
