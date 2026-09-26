"""
Draw the wildlife sketchbook's later pages in the atlas's pixel-pencil style (the first six rows
were generated, see wildlife-sketches.md) into its seventh row, left to right:

  starlings  one in its autumn coat, glossy and spangled with white, and a murmuration behind it
  seal       a harbour seal hauled out on the sand, head up, taking a look round

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


CELLS = [starling, seal]  # the seventh row, from the left


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
