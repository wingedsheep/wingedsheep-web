"""
Turn a photographed painting into island pixels: straighten the canvas, shrink it and paint it
again with a small palette taken from the painting itself.

    python3 tools/drawings/painting.py tools/drawings/painting.png public/drawings/painting.png
"""
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

# the canvas corners in the photo (top-left, top-right, bottom-right, bottom-left). The camera
# looked down at it on the desk, so the bottom corners fall just outside the frame.
CORNERS = [(260, 196), (1686, 192), (2104, 1388), (-99, 1430)]
SIZE = (160, 128)                  # a 50 × 40 canvas
COLOURS = 40


def coeffs(src, dst):
    """Perspective transform taking dst points to src points (what PIL's transform wants)."""
    rows = []
    for (x, y), (u, v) in zip(dst, src):
        rows += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]
    return np.linalg.solve(np.array(rows, float), np.array(src, float).reshape(8))


def main(src, dst):
    photo = Image.open(src).convert("RGB")
    big = (SIZE[0] * 8, SIZE[1] * 8)
    rect = [(0, 0), (big[0], 0), big, (0, big[1])]
    flat = photo.transform(big, Image.PERSPECTIVE, coeffs(CORNERS, rect), Image.BICUBIC)
    # where the canvas ran off the photo there's nothing: fill it from the nearest paint
    seen = Image.new("L", photo.size, 255).transform(big, Image.PERSPECTIVE, coeffs(CORNERS, rect), Image.NEAREST)
    a = np.asarray(flat).copy()
    hole = np.asarray(seen) < 128
    for y in np.flatnonzero(hole.any(1)):
        row = np.flatnonzero(~hole[y])
        if row.size:
            a[y, : row[0]] = a[y, row[0] : row[0] + 1]
            a[y, row[-1] + 1 :] = a[y, row[-1] : row[-1] + 1]
    flat = Image.fromarray(a).filter(ImageFilter.MedianFilter(5))  # lose the canvas weave
    # the phone's white balance washed the colours out a little
    small = ImageEnhance.Color(flat.resize(SIZE, Image.BOX)).enhance(1.25)
    out = small.quantize(COLOURS, Image.Quantize.MEDIANCUT, kmeans=4, dither=Image.Dither.NONE).convert("RGB")
    out.save(dst, optimize=True)
    print(f"{dst}: {SIZE[0]}×{SIZE[1]}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
