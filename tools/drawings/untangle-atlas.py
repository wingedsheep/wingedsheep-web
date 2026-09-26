"""
Keep every animal in the wildlife atlas inside its own cell. The generated grid lets a few
reach over the line (the sea serpent's spines poke up under the robin, the black sheep's ears
under the bat), and since a sketchbook page shows one whole cell, those stray tips turn up on the
neighbour's page. Each connected mark belongs to the cell holding most of it; wherever it spills
into another cell, that part is painted back to paper. Nothing a page shows of its own animal
changes: the owner's page is cropped at the line anyway.

    python3 tools/drawings/untangle-atlas.py public/art/wildlife-sketches-pixel.png
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

GRID = 6  # columns; the rows are square cells, however many the atlas has grown to
INK = 40  # how far from the paper colour (summed over RGB) a pixel must be to count as a mark


def main(path):
    img = np.asarray(Image.open(path).convert("RGB")).copy()
    h, w, _ = img.shape
    cell = w / GRID
    paper = np.median(img[:8, :8].reshape(-1, 3), 0)
    ink = np.abs(img.astype(int) - paper).sum(2) > INK
    # dithered strokes are full of single-pixel gaps; bridge them so one limb is one mark
    near = ink.copy()
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            near |= np.roll(np.roll(ink, dy, 0), dx, 1)
    rows = np.minimum((np.arange(h) / cell).astype(int), round(h / cell) - 1)
    cols = np.minimum((np.arange(w) / cell).astype(int), GRID - 1)
    cells = rows[:, None] * GRID + cols[None, :]
    seen = np.zeros_like(near)
    cleared = 0
    for y, x in zip(*np.nonzero(near)):
        if seen[y, x]:
            continue
        seen[y, x] = True
        mark, queue = [], deque([(y, x)])
        while queue:
            cy, cx = queue.popleft()
            mark.append((cy, cx))
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        ys, xs = np.array(mark).T
        owners = cells[ys, xs]
        if owners.min() == owners.max():
            continue
        owner = np.bincount(owners).argmax()
        stray = owners != owner  # its faint anti-aliased halo too, not just the ink
        if (stray & ink[ys, xs]).sum() > 0.2 * ink[ys, xs].sum():  # two animals touching, not one reaching over
            print(f"left alone: a mark across cells {sorted(set(owners))} at ({x}, {y})")
            continue
        img[ys[stray], xs[stray]] = paper
        cleared += stray.sum()
    Image.fromarray(img).save(path, optimize=True)
    print(f"{path}: {cleared} stray pixels back to paper")


if __name__ == "__main__":
    main(sys.argv[1])
