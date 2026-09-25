"""Rasterise the world's land into the little pixel map the library globe wears.

    python3 tools/globe/land.py

Downloads Natural Earth's 110m land (via the world-atlas package), draws it into an
equirectangular W x H bitmap (row 0 = 90°N, column 0 = 180°W) and writes it to
src/data/land.json as one hex string per row. Run it again only to change the resolution.
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

W, H = 160, 80
SS = 8  # supersample, then keep pixels that are mostly land
URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"
OUT = Path(__file__).resolve().parents[2] / "src" / "data" / "land.json"


def arcs(topo):
    """Decode the delta-encoded, quantised arcs into lon/lat points."""
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    out = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def ring(decoded, refs):
    pts = []
    for r in refs:
        a = decoded[r] if r >= 0 else decoded[~r][::-1]
        pts.extend(a if not pts else a[1:])
    return pts


def main():
    topo = json.load(urllib.request.urlopen(URL))
    decoded = arcs(topo)
    img = Image.new("L", (W * SS, H * SS), 0)
    draw = ImageDraw.Draw(img)
    px = lambda lon, lat: ((lon + 180) / 360 * W * SS, (90 - lat) / 180 * H * SS)  # noqa: E731
    for geom in topo["objects"]["land"]["geometries"]:
        polys = geom["arcs"] if geom["type"] == "MultiPolygon" else [geom["arcs"]]
        for poly in polys:
            for i, refs in enumerate(poly):
                pts = [px(lon, lat) for lon, lat in ring(decoded, refs)]
                if len(pts) > 2:
                    draw.polygon(pts, fill=0 if i else 255)  # holes are the later rings
    small = img.resize((W, H), Image.BOX)
    rows = []
    for y in range(H):
        bits = "".join("1" if small.getpixel((x, y)) > 90 else "0" for x in range(W))
        rows.append(f"{int(bits, 2):0{W // 4}x}")
    OUT.write_text(json.dumps({"width": W, "height": H, "rows": rows}) + "\n")
    print(f"wrote {OUT} ({W}x{H})")
    for y in range(0, H, 2):  # a quick look in the terminal
        print("".join("#" if small.getpixel((x, y)) > 90 else "." for x in range(0, W, 2)))


main()
