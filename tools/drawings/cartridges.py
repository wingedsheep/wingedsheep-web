"""
The labels on the cartridges in the box by the keeper's telly, at island pixels (80 × 60, shown
blown up): GTA Arnhem drawn here in code (the John Frost bridge over the Rhine at sundown, the
Eusebius tower behind it, a car on its way over), and Rustwing Raiders cut from the game's own
title painting and brought down to a few colours.

    python3 tools/drawings/cartridges.py ../flying/public/art/title.png public/art/cartridges
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

W, H = 80, 60


def arnhem():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    # the sky in bands, warm low down
    sky = ["#2b2350", "#45305e", "#6b3a62", "#a24a5a", "#d9694a", "#f09a4a", "#f7c66a"]
    horizon = 38
    for i, c in enumerate(sky):
        d.rectangle((0, i * horizon // len(sky), W, (i + 1) * horizon // len(sky)), fill=c)
    d.ellipse((50, 26, 64, 40), fill="#ffe2a0")                       # the sun, going down
    # the town behind: rooftops, and the Eusebius tower with its glass crown
    d.rectangle((0, 32, W, horizon), fill="#3a2a48")
    for x, h in [(2, 4), (8, 6), (14, 3), (40, 5), (46, 3), (68, 6), (74, 4)]:
        d.rectangle((x, horizon - 2 - h, x + 5, horizon), fill="#3a2a48")
    d.rectangle((22, 12, 29, horizon), fill="#2e2240")
    d.rectangle((23, 6, 28, 12), fill="#2e2240")
    d.rectangle((24, 7, 27, 11), fill="#7fb6d8")                       # the glass
    d.point([(25, 4), (26, 4), (25, 5), (26, 5)], fill="#2e2240")
    for y in range(15, 36, 4):
        d.point([(24, y), (27, y)], fill="#f7c66a")                     # lit windows
    # the Rhine
    d.rectangle((0, horizon, W, H), fill="#24305a")
    for y in range(horizon + 2, H, 3):
        for x in range((y * 7) % 5, W, 9):
            d.line((x, y, x + 3, y), fill="#3d4f80")
    for y in range(horizon + 1, H, 2):
        d.line((53, y, 61, y), fill="#f09a4a" if y % 4 else "#d9694a")   # the sun on the water
    # the bridge: a deck across, and the big arch over it, hung with cables
    deck = 41
    d.rectangle((0, deck, W, deck + 2), fill="#1d1a2c")
    for x in (10, 70):
        d.rectangle((x - 2, deck + 2, x + 2, H), fill="#1d1a2c")       # the piers
    top, left, right = 18, 12, 68
    arch = [(x, deck - (deck - top) * math.sin(math.pi * (x - left) / (right - left))) for x in range(left, right + 1)]
    d.line(arch, fill="#1d1a2c", width=2)
    for x, y in arch[4::6]:
        d.line((x, y, x, deck), fill="#1d1a2c")
    # a car on its way over, headlights on
    d.rectangle((33, deck - 3, 40, deck - 1), fill="#c8382c")
    d.rectangle((35, deck - 5, 38, deck - 3), fill="#c8382c")
    d.point([(41, deck - 2)], fill="#fff2b0")
    return img


def rustwing(title):
    img = Image.open(title).convert("RGB")
    # the ship, coming in low over the jungle with its burners lit
    img = img.crop((0, 300, 560, 720)).resize((W, H), Image.LANCZOS)
    return img.quantize(colors=28, dither=Image.Dither.NONE).convert("RGB")


def main(title, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    arnhem().save(out / "arnhem.png", optimize=True)
    rustwing(title).save(out / "rustwing.png", optimize=True)


if __name__ == "__main__":
    main(*sys.argv[1:3])
