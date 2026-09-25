"""
Turn a photographed pencil drawing into a page from the keeper's sketchbook: flatten the paper,
lay it on an A4 page, sign it, shrink it to island pixels and draw it in a few graphite tones on
the site's paper colour.

    python3 tools/drawings/pixelate.py tools/drawings/bird.png public/drawings/bird.png
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

CROP = (62, 196, 1180, 1616)  # the drawing, without the sketchbook's edge and the table
PAGE = (210, 297)             # A4, one pixel per millimetre
MARGIN = (12, 22)             # where the drawing sits on the page (left, top), in page pixels
SIGNATURE = ("Vincent", "/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf", 19)  # text, font, height in page pixels
# paper, then graphite from light to dark
TONES = np.array([(0xF4, 0xEA, 0xD3), (0xC9, 0xBD, 0xA8), (0x8C, 0x84, 0x7E), (0x4A, 0x44, 0x4E)], float)
LEVELS = (0.93, 0.80, 0.62)   # darkness cut-offs between the tones (1 = paper)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 - 0.5


def main(src, dst):
    img = Image.open(src).convert("L").crop(CROP)
    # divide out the uneven light across the page so the paper reads as flat white
    paper = img.filter(ImageFilter.GaussianBlur(40))
    flat = np.clip(np.asarray(img, float) / np.maximum(np.asarray(paper, float), 1), 0, 1)
    # the page, at the photo's resolution: k photo pixels to a page pixel
    k = flat.shape[1] / (PAGE[0] - 2 * MARGIN[0])
    page = Image.new("L", (round(PAGE[0] * k), round(PAGE[1] * k)), 255)
    page.paste(Image.fromarray((flat * 255).astype(np.uint8)), (round(MARGIN[0] * k), round(MARGIN[1] * k)))
    sign(page, k)
    WIDTH, h = PAGE
    small = np.asarray(page.resize(PAGE, Image.BOX), float) / 255
    # stretch so faint lines still show, then a light ordered dither between neighbouring tones
    small = np.clip((small - 0.55) / 0.43, 0, 1)
    jitter = BAYER[np.arange(h)[:, None] % 4, np.arange(WIDTH)[None, :] % 4] * 0.06
    v = small + jitter
    idx = np.select([v > LEVELS[0], v > LEVELS[1], v > LEVELS[2]], [0, 1, 2], 3)
    # lift stray specks (paper grain, dust): a lone mark with no marked neighbour goes back to paper
    marked = idx > 0
    pad = np.pad(marked, 1)
    neighbours = sum(np.roll(np.roll(pad, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1))[1:-1, 1:-1] - marked
    idx[marked & (neighbours == 0)] = 0
    out = TONES[idx].astype(np.uint8)
    Image.fromarray(out, "RGB").save(dst, optimize=True)
    print(f"{dst}: {WIDTH}×{h}")


def sign(page, k):
    """A quick pencil autograph in the bottom-right corner: slanted, a little uphill, a wobbly
    line and a flick underneath, pressed on harder in some places than others."""
    text, font, size = SIGNATURE
    font = ImageFont.truetype(font, round(size * k))
    rng = np.random.default_rng(7)
    x0, y0, x1, y1 = font.getbbox(text)
    pad = round(6 * k)
    ink = Image.new("L", (x1 + 2 * pad, y1 + 2 * pad), 0)  # 255 = graphite
    d = ImageDraw.Draw(ink)
    d.text((pad, pad), text, font=font, fill=255)
    # the flick: a quick stroke back under the name, heavier where it starts
    w = round(0.9 * k)
    xs = np.linspace(pad + (x1 - x0) * 0.15, pad + x1 + k, 40)
    ys = pad + y1 + k * (1.8 + 0.9 * np.sin(np.linspace(0.3, 2.6, 40)) - np.linspace(0, 1.4, 40))
    for i in range(39):
        d.line((xs[i], ys[i], xs[i + 1], ys[i + 1]), fill=round(255 - 90 * i / 39), width=w)
    # slant it forward, tip it uphill and let the hand wobble
    ink = ink.transform(ink.size, Image.AFFINE, (1, 0.12, -0.12 * ink.height / 2, 0, 1, 0), Image.BICUBIC)
    ink = ink.rotate(4, Image.BICUBIC, expand=True)
    a = np.asarray(ink, float)
    shift = np.round(np.convolve(rng.normal(0, 0.6, a.shape[1]), np.ones(25) / 25 * 5, "same")).astype(int)
    a = np.stack([np.roll(a[:, x], shift[x]) for x in range(a.shape[1])], 1)
    pressure = np.clip(np.asarray(Image.fromarray(rng.uniform(0.75, 1, (6, 12)).astype(np.float32)).resize(a.shape[::-1], Image.BICUBIC)), 0, 1)
    ink = Image.fromarray((a * pressure).astype(np.uint8))
    x = round(page.width - MARGIN[0] * k - ink.width + pad)
    y = round(page.height - 7 * k - ink.height + pad)
    page.paste(Image.new("L", ink.size, 0), (x, y), ink)


if __name__ == "__main__":
    main(*sys.argv[1:3])
