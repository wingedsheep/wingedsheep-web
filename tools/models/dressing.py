"""The rooms indoors, dressed for the special days, as holidays.py dresses the island outside.

Each room's build() calls its function here last. Everything hangs off a root tagged
`holiday=<occasion>`, which the runtime (src/island/scene/dressing.ts) drops on any other day,
lights and all, before it looks for ids. Parts it moves are tagged `spook=<kind>`:

  spider   lets itself down on its thread (`<name>_thread`, one metre long, scaled), hangs a
           while turning, and climbs back up hand over hand (`drop`: how far it goes)
  sway     a paper bat or pumpkin on a garland, swinging in the draught (`phase`)
  flame    a candle flame, flickering
  ghost    a bedsheet ghost drifting about its spot (`rx`, `ry`, `rz`: how far), there only after
           dark, fading in and out
  raven    turns its head in quick looks about (`<name>_head`), and now and then shakes itself
  crawler  walks to and fro along x as far as `run`, legs going, stops, turns round
  bulb     one of a string of lights, running in a slow chase (`index`)
  twinkle  one of a string of fairy lights (or the ones on the tree), each glowing up and down
           on its own

  halloween    each room its own (see each function): the library's ghost, bats and raven, the
               workshop's clockwork spider and pumpkin lights, the lighthouse's green lantern, the
               carving at the hut; jack-o'-lanterns throughout
  shoe         the Sinterklaas weeks: shoes put out on the library hearth and a clog by the hut's
               stove, with a carrot in for the horse or what he's left (`clog=`, as outside);
               pepernoten and mandarins; a surprise on the go in the workshop (`!sinterklaas`)
  sinterklaas  pakjesavond, 5 December: the sack by the library fire, presents, poems, the
               surprise, and chocolate letters for the two of them
  christmas    fairy lights in every room, and a tree in the lighthouse with just lights and
               kerstballen on it (`christmasday`: presents under it)
"""
from __future__ import annotations

import math

import palette as P
from holidays import CANDLE, PUMPKIN, PUMPKIN_DARK, WEB, jack, spider
from kit import Model, group, light

PAPER = "#1d1a24"           # black paper bats
STRING = "#4a3e3a"          # the twine they hang from
NEWSPAPER = "#d9d4c4"
SEEDS = "#efe2b0"
PULP = "#f0a040"
RAVEN = "#1d1a24"
RAVEN_SHEEN = "#2c2e48"
BRASS = "#c9953c"
BRASS_DARK = "#8f6428"
LED = "#8ff0e0"             # the workshop's jack-o'-lantern, lit like the robot's eye


# --- the pieces ---------------------------------------------------------------------------------

def halloween_root(root, name: str):
    return group(name, parent=root, holiday="halloween")


def lantern(parent, name: str, at, r: float, turn: float, carved=True, glow=CANDLE, id_=None):
    """A jack-o'-lantern standing at `at`, its face turned `turn` from the south, a candle in it."""
    g = group(name, at, rot_z=turn, parent=parent, **({"id": id_} if id_ else {}))
    m = Model(name, seed=int(r * 100))
    jack(m, (0, 0, 0), r, carved, turn, glow)
    m.build(g)
    if carved:
        light(g, (0, -r * 1.5, r * 1.1), glow, 1.2 + r * 5, 0.2 + r * 0.7, flicker=1.0, halo=r > 0.3)  # out in front of the face
    return g


def candles(parent, name: str, spots, colour=P.WHITE, drips=False):
    """Candles at (x, y, z, height): a stub of wax each, its flame its own part (`spook=flame`)."""
    m = Model(name)
    for i, (x, y, z, h) in enumerate(spots):
        m.cyl(0.055, h, (x, y, z), colour, segs=6)
        m.cyl(0.07, 0.02, (x, y, z + h - 0.04), colour, segs=6, r_top=0.055)            # a drip round the top
        m.box((0.012, 0.012, 0.04), (x, y, z + h + 0.01), P.INK)                       # the wick
        if drips:                                                                       # wax run down the sides
            for k in range(3):
                d = k * 2.1 + i
                m.box((0.025, 0.025, h * (0.3 + 0.2 * k)), (x + math.cos(d) * 0.05, y + math.sin(d) * 0.05, z + h - h * (0.15 + 0.1 * k)), colour)
        f = group(f"{name}_flame_{i}", (x, y, z + h + 0.02), parent=parent, spook="flame", phase=i * 1.7)
        fl = Model(f"{name}_flame_{i}")
        fl.ball(0.04, (0, 0, 0.05), "#ffd070", subdiv=1, scale=(1, 1, 1.7), glow=True)
        fl.ball(0.022, (0, 0, 0.04), "#fff4c8", subdiv=1, scale=(1, 1, 1.5), glow=True)
        fl.build(f)
        light(parent, (x, y - 0.05, z + h + 0.12), P.FIRE, 2.2, 0.45, flicker=1.0, halo=i % 2 == 0)
    m.build(parent)


def corner_web(m: Model, corner, a, b, r: float, spokes=5):
    """A cobweb strung across a top corner: from `corner` along the two walls (unit directions
    `a` and `b`, level), sagging in between, three threads round."""
    cx, cy, cz = corner

    def pt(t, d):
        """At fraction t of the way from wall a to wall b, d of the way out."""
        sag = math.sin(t * math.pi) * 0.45 * d
        return (cx + d * r * ((1 - t) * a[0] + t * b[0]), cy + d * r * ((1 - t) * a[1] + t * b[1]), cz - sag * r)

    for k in range(spokes):
        t = k / (spokes - 1)
        m.plank_line((cx, cy, cz), pt(t, 1.0), 0.03, 0.03, WEB)
    for ring in (0.35, 0.65, 0.95):
        for k in range(spokes - 1):
            m.plank_line(pt(k / (spokes - 1), ring), pt((k + 1) / (spokes - 1), ring * 0.97), 0.025, 0.025, WEB)
    # a stray thread hanging off the end of it
    end = pt(0.75, 0.95)
    m.plank_line(end, (end[0], end[1], end[2] - r * 0.4), 0.02, 0.02, WEB)


def dangling_spider(parent, name: str, at, drop: float, size=0.15, wait=0.0):
    """A spider on its thread from `at`, which the runtime lets down as far as `drop` and back."""
    g = group(name, at, parent=parent, spook="spider", drop=drop, wait=wait)
    t = Model(f"{name}_thread")
    t.box((0.032, 0.032, 1.0), (0, 0, -0.5), WEB)                                         # a metre, scaled to length
    t.build(g)
    body = group(f"{name}_body", (0, 0, -0.1), parent=g)
    s = Model(f"{name}_body")
    spider(s, (0, 0, 0), size)
    obj = s.build(body)
    obj.location = (0, 0, -size * 0.6)                                                 # hung by its back end,
    obj.rotation_euler = (math.pi / 2, 0, 0)                                           # head down
    return g


def paper_bat(m: Model, size: float):
    """A paper bat cut out flat, facing ±y: scalloped wings, two ears."""
    half = [(0.0, 0.03), (0.03, 0.075), (0.045, 0.025), (0.11, 0.055), (0.2, 0.075), (0.26, 0.03),
            (0.21, -0.015), (0.17, 0.005), (0.135, -0.045), (0.095, -0.015), (0.05, -0.06), (0.0, -0.085)]
    pts = half + [(-x, z) for x, z in reversed(half[1:-1])]
    m.prism([(x * size, z * size) for x, z in pts], 0.015, (0, 0, -0.06 * size), PAPER)


def paper_pumpkin(m: Model, size: float):
    m.cyl(0.07 * size, 0.015, (0, 0, -0.075 * size), PUMPKIN, segs=10, rot=(math.pi / 2, 0, 0))
    m.box((0.02 * size, 0.016, 0.04 * size), (0, 0, 0.0), "#4d5a2a")
    for dx in (-0.025, 0.025):
        m.box((0.02 * size, 0.017, 0.02 * size), (dx * size, 0, -0.065 * size), PAPER, rot=(0, math.pi / 4, 0))
    m.box((0.06 * size, 0.017, 0.012 * size), (0, 0, -0.1 * size), PAPER)


def garland(parent, name: str, a, b, n: int, sag=0.3, size=1.25):
    """Paper bats on a string from a to b (x, y, z), with a paper pumpkin every third, each on its
    own bit of thread so it can swing (`spook=sway`)."""
    g = group(name, parent=parent)
    pts = [(a[0] + (b[0] - a[0]) * i / (n + 1), a[1] + (b[1] - a[1]) * i / (n + 1),
            a[2] + (b[2] - a[2]) * i / (n + 1) - sag * 4 * (i / (n + 1)) * (1 - i / (n + 1))) for i in range(n + 2)]
    s = Model(f"{name}_string")
    for p, q in zip(pts, pts[1:]):
        s.plank_line(p, q, 0.025, 0.025, STRING)
    s.build(g)
    heading = math.atan2(b[1] - a[1], b[0] - a[0])
    for i, p in enumerate(pts[1:-1]):
        h = group(f"{name}_{i}", p, rot_z=heading, parent=g, spook="sway", phase=i * 0.9)
        m = Model(f"{name}_{i}")
        drop = 0.08 + (i % 2) * 0.06
        m.box((0.012, 0.012, drop), (0, 0, -drop / 2), STRING)
        part = Model(f"{name}_{i}_cut")
        (paper_pumpkin if i % 3 == 1 else paper_bat)(part, size)
        m.build(h)
        part.build(h, loc=(0, 0, -drop))
    return g


def ghost(parent, name: str, at, size: float, rx: float, ry: float, rz: float):
    """An old bedsheet with two holes in it (as over the graves outside), drifting about `at`."""
    g = group(name, at, parent=parent, spook="ghost", rx=rx, ry=ry, rz=rz)
    b = Model(f"{name}_sheet", seed=4)
    b.ball(0.26 * size, (0, 0, 0.3 * size), P.WHITE, subdiv=2, scale=(1, 1, 1.1))
    b.cyl(0.4 * size, 0.42 * size, (0, 0, -0.1 * size), P.WHITE, segs=10, r_top=0.25 * size)
    for k in range(8):                                                                # the ragged hem
        a = k / 8 * math.tau
        b.box((0.13 * size, 0.06 * size, 0.16 * size), (math.cos(a) * 0.38 * size, math.sin(a) * 0.38 * size, (-0.12 - (k % 2) * 0.06) * size),
              P.WHITE, rot=(0, 0, a + math.pi / 2))
    for k in (-1, 1):
        b.box((0.07 * size, 0.05 * size, 0.1 * size), (k * 0.09 * size, -0.24 * size, 0.34 * size), P.INK)
    b.box((0.08 * size, 0.05 * size, 0.08 * size), (0, -0.25 * size, 0.18 * size), P.INK)  # a little "oo"
    b.build(g)
    return g


def carving(m: Model, x: float, y: float, z: float):
    """The carving on newspaper: a pumpkin with its eyes cut and its lid off, the knife and the
    spoon, the insides in a bowl and the seeds put by for roasting. The pumpkin faces south."""
    m.box((0.95, 0.62, 0.008), (x, y, z + 0.004), NEWSPAPER, rot=(0, 0, 0.08))
    for k in range(5):                                                                 # columns of print
        m.box((0.3, 0.04, 0.004), (x - 0.25 + (k % 2) * 0.48, y + 0.2 - k * 0.09, z + 0.01), "#9a968c", rot=(0, 0, 0.08))
    r = 0.24
    jack(m, (x - 0.12, y + 0.05, z), r, False, 0.4)
    m.cyl(r * 0.62, 0.02, (x - 0.12, y + 0.05, z + r * 1.3), PULP, segs=8)              # cut open at the top
    e = r * 0.3
    for s in (-1, 1):                                                                  # the eyes, cut, not lit
        m.prism([(-e, -e * 0.7), (e, -e * 0.7), (0, e * 0.8)], 0.06, (x - 0.12 + s * r * 0.36, y + 0.05 - r * 0.93, z + r * 0.92), P.INK)
    lx, ly = x + 0.2, y - 0.17                                                          # its lid, upside down
    m.cyl(r * 0.5, r * 0.18, (lx, ly, z), PUMPKIN_DARK, segs=8, r_top=r * 0.6)
    m.cyl(r * 0.45, 0.01, (lx, ly, z + r * 0.18), PULP, segs=8)
    m.cyl(0.025, 0.06, (lx, ly, z), "#4d5a2a", segs=5)
    bx, by = x + 0.3, y + 0.14                                                          # the insides
    m.cyl(0.12, 0.08, (bx, by, z), P.WHITE, segs=8, r_top=0.15)
    for k in range(5):
        m.ball(0.05, (bx + math.cos(k * 1.3) * 0.06, by + math.sin(k * 1.3) * 0.06, z + 0.08), PULP if k % 2 else PUMPKIN, subdiv=1)
    for k in range(9):                                                                 # seeds, spread out to dry
        m.box((0.035, 0.022, 0.012), (x + 0.04 + (k % 3) * 0.06, y - 0.22 + (k // 3) * 0.05, z + 0.012), SEEDS,
              rot=(0, 0, k * 0.7))
    m.box((0.2, 0.025, 0.012), (x - 0.38, y - 0.2, z + 0.014), "#c4c8d4", rot=(0, 0, 0.5))   # the knife
    m.box((0.1, 0.035, 0.03), (x - 0.48, y - 0.26, z + 0.02), P.WOOD_DARK, rot=(0, 0, 0.5))
    m.box((0.16, 0.02, 0.01), (x + 0.33, y - 0.05, z + 0.012), "#c4c8d4", rot=(0, 0, -0.3))  # the spoon
    m.cyl(0.03, 0.012, (x + 0.42, y - 0.08, z + 0.006), "#c4c8d4", segs=6)


def gourds(m: Model, x: float, y: float, z: float):
    """A row of odd squashes, as they come from the market: a white pumpkin, a green-striped
    bottle gourd and a warty little orange one, along y from (x, y)."""
    for k in range(6):                                                                  # the white one, ribbed
        a = k / 6 * math.tau
        m.ball(0.09, (x + math.cos(a) * 0.06, y + math.sin(a) * 0.06, z + 0.09), "#ece6d6" if k % 2 else "#d8d0bc",
               subdiv=1, scale=(1, 1, 0.9))
    m.cyl(0.02, 0.07, (x, y, z + 0.15), "#6a7a3a", segs=5, rot=(0.3, 0, 0))
    gx, gy = x + 0.02, y + 0.3                                                          # the bottle gourd, lying down
    m.ball(0.1, (gx, gy, z + 0.09), "#7a9a3a", subdiv=1, scale=(1, 1.1, 0.9))
    m.ball(0.06, (gx, gy + 0.15, z + 0.08), "#7a9a3a", subdiv=1, scale=(1, 1.4, 1))
    for k in (-1, 0, 1):                                                                # its stripes
        m.box((0.015, 0.2, 0.012), (gx + k * 0.05, gy + 0.03, z + 0.17 - abs(k) * 0.03), "#e8dca0")
    m.cyl(0.015, 0.06, (gx, gy + 0.24, z + 0.07), "#5a4a2a", segs=4, rot=(-1.3, 0, 0))
    wx, wy = x - 0.02, y + 0.58                                                         # the warty one
    m.ball(0.075, (wx, wy, z + 0.07), PUMPKIN_DARK, subdiv=1, scale=(1, 1, 0.85))
    for k in range(7):
        a, e = k * 2.3, 0.4 + (k % 3) * 0.3
        m.ball(0.02, (wx + math.cos(a) * math.cos(e) * 0.07, wy + math.sin(a) * math.cos(e) * 0.07, z + 0.07 + math.sin(e) * 0.06),
               "#e0a040", subdiv=1)


def raven(parent, name: str, at, turn: float, size=1.0):
    """A raven, perched, facing -y: glossy black, a heavy beak. Its head (`<name>_head`) snaps
    round to look at things (`spook=raven`)."""
    g = group(name, at, rot_z=turn, parent=parent, spook="raven")
    s = size
    m = Model(f"{name}_body")
    m.ball(0.13 * s, (0, 0.02 * s, 0.2 * s), RAVEN, subdiv=2, scale=(0.9, 1.35, 1.0), rot=(-0.35, 0, 0))
    for k in (-1, 1):                                                                   # folded wings, a blue sheen
        m.ball(0.1 * s, (k * 0.09 * s, 0.06 * s, 0.22 * s), RAVEN_SHEEN, subdiv=1, scale=(0.35, 1.6, 0.8), rot=(-0.3, 0, k * 0.1))
    m.prism([(-0.07 * s, 0), (0.07 * s, 0), (0.04 * s, -0.22 * s), (-0.04 * s, -0.22 * s)], 0.03 * s,
            (0, 0.2 * s, 0.17 * s), RAVEN, rot=(-0.9, 0, 0))                           # the tail
    for k in (-1, 1):                                                                   # legs and claws round the edge
        m.box((0.02 * s, 0.02 * s, 0.1 * s), (k * 0.04 * s, 0, 0.05 * s), P.INK)
        m.box((0.03 * s, 0.09 * s, 0.015 * s), (k * 0.04 * s, -0.03 * s, 0.006), P.INK)
    m.build(g)
    head = group(f"{name}_head", (0, -0.1 * s, 0.33 * s), parent=g)
    hm = Model(f"{name}_head")
    hm.ball(0.085 * s, (0, 0, 0.02 * s), RAVEN, subdiv=2, scale=(0.9, 1.1, 1))
    hm.cyl(0.035 * s, 0.13 * s, (0, -0.06 * s, 0.0), "#3a3644", segs=5, r_top=0.004, rot=(math.pi / 2 + 0.25, 0, 0))  # the beak
    for k in (-1, 1):
        hm.box((0.02 * s, 0.02 * s, 0.02 * s), (k * 0.055 * s, -0.04 * s, 0.04 * s), "#f2ece2", glow=True)  # an eye catching the light
    hm.build(head)
    return g


def candelabra(parent, name: str, x: float, y: float, z: float):
    """A brass candelabra, three tall candles with the wax run down them."""
    m = Model(name)
    m.cyl(0.11, 0.04, (x, y, z), P.GOLD, segs=8)
    m.cyl(0.03, 0.34, (x, y, z + 0.04), P.GOLD, segs=5)
    m.ball(0.045, (x, y, z + 0.2), P.GOLD, subdiv=1)
    for k in (-1, 1):                                                                   # the arms, curving up
        m.plank_line((x, y, z + 0.3), (x + k * 0.16, y, z + 0.34), 0.03, 0.03, P.GOLD)
        m.plank_line((x + k * 0.16, y, z + 0.34), (x + k * 0.22, y, z + 0.44), 0.03, 0.03, P.GOLD)
    for dx in (-0.22, 0.0, 0.22):
        m.cyl(0.05, 0.03, (x + dx, y, z + 0.42 if dx else z + 0.38), P.GOLD, segs=6, r_top=0.06)
    m.build(parent)
    candles(parent, f"{name}_candles", [(x - 0.22, y, z + 0.45, 0.3), (x, y, z + 0.41, 0.4), (x + 0.22, y, z + 0.45, 0.24)],
            colour="#efe6d2", drips=True)


def clockwork_spider(parent, name: str, at, run: float, size=1.0):
    """A wind-up spider in brass, walking up and down the bench (`spook=crawler`) as far as `run`
    along x: eight legs (`<name>_leg_<i>`), red glass eyes, its key (`<name>_key`) turning."""
    g = group(name, at, parent=parent, spook="crawler", run=run)
    s = size
    m = Model(f"{name}_body")
    m.ball(0.09 * s, (-0.06 * s, 0, 0.11 * s), BRASS, subdiv=2, scale=(1.25, 1, 0.8))   # it walks along +x
    m.ball(0.055 * s, (0.07 * s, 0, 0.1 * s), BRASS_DARK, subdiv=1)
    for k in (-1, 1):
        m.box((0.025 * s,) * 3, (0.115 * s, k * 0.025 * s, 0.11 * s), "#ff3a3a", glow=True)
    for k in range(4):                                                                  # rivets round its back
        m.ball(0.012 * s, (-0.06 * s + math.cos(k * 1.57) * 0.08 * s, math.sin(k * 1.57) * 0.07 * s, 0.15 * s), P.IRON, subdiv=1)
    m.build(g)
    key = group(f"{name}_key", (-0.08 * s, 0, 0.18 * s), parent=g)
    k_ = Model(f"{name}_key")
    k_.cyl(0.008 * s, 0.05 * s, (0, 0, 0), P.IRON, segs=4)
    k_.box((0.08 * s, 0.012 * s, 0.035 * s), (0, 0, 0.06 * s), BRASS_DARK)
    k_.build(key)
    for i in range(8):
        side = 1 if i < 4 else -1
        j = i % 4
        a = side * (0.6 + j * 0.62)                                                    # fanned out, front to back
        leg = group(f"{name}_leg_{i}", (0.0, side * 0.04 * s, 0.1 * s), rot_z=a, parent=g, phase=(j + (side < 0)) % 2)  # two sets of four, alternating
        lm = Model(f"{name}_leg_{i}")
        lm.plank_line((0, 0, 0), (0.12 * s, 0, 0.07 * s), 0.018 * s, 0.018 * s, BRASS_DARK)
        lm.plank_line((0.12 * s, 0, 0.07 * s), (0.2 * s, 0, -0.1 * s), 0.016 * s, 0.016 * s, P.IRON)
        lm.build(leg)
    return g


def pumpkin_lights(parent, name: str, a, b, n: int, sag=0.3, size=1.0):
    """A string of little pumpkin lights from a to b, which run in a slow chase (`spook=bulb`)."""
    pts = [(a[0] + (b[0] - a[0]) * i / (n + 1), a[1] + (b[1] - a[1]) * i / (n + 1),
            a[2] + (b[2] - a[2]) * i / (n + 1) - sag * 4 * (i / (n + 1)) * (1 - i / (n + 1))) for i in range(n + 2)]
    w = Model(f"{name}_wire")
    for p, q in zip(pts, pts[1:]):
        w.plank_line(p, q, 0.025, 0.025, "#2a3a2a")
    w.build(parent)
    for i, (x, y, z) in enumerate(pts[1:-1]):
        g = group(f"{name}_{i}", (x, y, z - 0.09), parent=parent, spook="bulb", index=i)
        m = Model(f"{name}_{i}")
        m.box((0.03, 0.03, 0.06), (0, 0, 0.07), "#2a3a2a")
        m.ball(0.075 * size, (0, 0, 0), PUMPKIN, subdiv=1, scale=(1.15, 1.15, 0.9), glow=True)
        m.build(g)
    for t in (0.15, 0.4, 0.65, 0.9):                                                         # a warm wash off them
        k = int(t * (n + 1))
        x, y, z = pts[k]
        light(parent, (x, y - 0.4, z - 0.3), "#ff9a3c", 3.2, 0.55, halo=False)


def bottle_candle(parent, name: str, x: float, y: float, z: float, glass: str, h: float):
    """A candle stuck in an empty wine bottle, the wax run down its neck in rivers."""
    m = Model(name)
    m.cyl(0.075, 0.26, (x, y, z), glass, segs=8)
    m.cyl(0.075, 0.08, (x, y, z + 0.26), glass, segs=8, r_top=0.03)
    m.cyl(0.03, 0.08, (x, y, z + 0.34), glass, segs=6)
    m.build(parent)
    candles(parent, f"{name}_candle", [(x, y, z + 0.42, h)], colour="#efe6d2", drips=True)
    d = Model(f"{name}_wax")
    for k in range(5):                                                                  # old wax, down the neck
        a = k * 1.3
        d.box((0.03, 0.03, 0.06 + (k % 3) * 0.08), (x + math.cos(a) * 0.04, y + math.sin(a) * 0.04, z + 0.36 - (k % 3) * 0.04),
              "#efe6d2")
    d.build(parent)


def ships_lantern(parent, name: str, at, glow="#7dff8a"):
    """A ship's lantern with green glass, the starboard light off an old boat, lit for the week."""
    g = group(name, at, parent=parent)
    m = Model(name)
    m.cyl(0.13, 0.04, (0, 0, 0), P.COPPER, segs=8)
    m.cyl(0.1, 0.26, (0, 0, 0.04), glow, segs=8, glow=True)
    for k in range(4):                                                                  # the guard wires
        a = k / 4 * math.tau + 0.4
        m.box((0.02, 0.02, 0.28), (math.cos(a) * 0.11, math.sin(a) * 0.11, 0.17), P.COPPER)
    m.cyl(0.13, 0.08, (0, 0, 0.3), P.COPPER, segs=8, r_top=0.05)
    m.cyl(0.03, 0.06, (0, 0, 0.38), P.COPPER, segs=5)
    m.build(g)
    light(g, (0, -0.25, 0.2), glow, 3.2, 0.45, flicker=0.6, halo=True)


def broom(m: Model, x: float, y: float, lean: float):
    """A witch's besom propped against the wall at (x, y), leaning `lean` from upright towards it."""
    top = (x - math.sin(lean) * 1.6, y, math.cos(lean) * 1.6)
    m.plank_line((x + 0.06, y, 0.3), top, 0.05, 0.05, "#7a5232")
    for k in range(9):                                                                  # the twigs, splayed
        a = (k - 4) * 0.08
        m.plank_line((x + 0.05, y + a * 0.6, 0.38), (x + 0.12 + abs(a) * 0.3, y + a * 2.2, 0.0), 0.04, 0.04,
                     "#b08a4a" if k % 2 else "#9a7438")
    m.box((0.1, 0.12, 0.05), (x + 0.06, y, 0.36), "#c8303a", rot=(0, lean, 0))                # the binding


def squash(m: Model, loc, r: float, colour: str, dark: str, squat=0.85):
    """A plain ribbed pumpkin or squash in any colour, stalk and all."""
    x, y, z = loc
    for k in range(6):
        a = k / 6 * math.tau
        m.ball(r * 0.62, (x + math.cos(a) * r * 0.4, y + math.sin(a) * r * 0.4, z + r * 0.7 * squat), colour if k % 2 else dark,
               subdiv=1, scale=(1, 1, squat * 1.15))
    m.cyl(r * 0.1, r * 0.3, (x, y, z + r * 1.25 * squat), "#5a5a2a", segs=5, r_top=r * 0.07, rot=(0.25, -0.1, 0))


def heap(parent, name: str, at, turn: float, seed: int):
    """A heap of pumpkins and squashes on loose straw, as from the field: big and small, orange,
    white and green, and one carved and lit at the front."""
    g = group(name, at, rot_z=turn, parent=parent)
    m = Model(name, seed=seed)
    for k in range(14):                                                                 # straw under it all
        a, d = k * 2.4, 0.15 + 0.05 * k
        m.box((0.4, 0.04, 0.02), (math.cos(a) * d, math.sin(a) * d * 0.7, 0.01), "#d8b04a" if k % 2 else "#c09838", rot=(0, 0, a * 1.7))
    squash(m, (0.2, 0.3, 0), 0.42, PUMPKIN, PUMPKIN_DARK)
    squash(m, (-0.45, 0.25, 0), 0.3, "#ece6d6", "#d0c8b4")
    squash(m, (0.65, -0.05, 0), 0.24, "#5f7f3a", "#4a6a2e", squat=1.0)
    squash(m, (-0.2, 0.6, 0), 0.22, "#e89a3a", "#c87a28")
    squash(m, (0.25, 0.4, 0.6), 0.2, PUMPKIN_DARK, "#a8480c")                          # one up on the big one
    for k in range(5):                                                                  # little gourds round the edge
        a = 3.6 + k * 0.5
        c = ["#f0c040", "#7a9a3a", "#ece6d6", PUMPKIN, "#c84a2a"][k]
        m.ball(0.08, (math.cos(a) * 0.75, math.sin(a) * 0.55, 0.07), c, subdiv=1, scale=(1, 1.3, 0.9), rot=(0, 0, a))
    m.build(g)
    lantern(g, f"{name}_jack", (-0.15, -0.3, 0), 0.32, -0.1)
    return g


def cauldron(parent, name: str, at):
    """A black cauldron hung in the fire, something green in it, bubbling (`spook=bubbles`)."""
    g = group(name, at, parent=parent)
    m = Model(name)
    m.ball(0.32, (0, 0, 0.25), P.INK, subdiv=2, scale=(1, 1, 0.75))
    m.cyl(0.3, 0.06, (0, 0, 0.5), "#2a2632", segs=12)
    m.cyl(0.26, 0.03, (0, 0, 0.54), "#5cff7a", segs=12, glow=True)                        # the brew, up to the brim
    for k in (-1, 1):
        m.box((0.05, 0.05, 0.12), (0, k * 0.31, 0.5), P.IRON)
    m.plank_line((0, -0.31, 0.56), (0, 0, 1.15), 0.025, 0.025, P.IRON)                 # the bail, up to the hook
    m.plank_line((0, 0.31, 0.56), (0, 0, 1.15), 0.025, 0.025, P.IRON)
    m.box((0.03, 0.03, 0.5), (0, 0, 1.4), P.IRON)
    m.build(g)
    b = group(f"{name}_bubbles", (0, 0, 0.58), parent=g, spook="bubbles")
    for k in range(6):
        bm = Model(f"{name}_bubble_{k}")
        bm.ball(0.06 + 0.02 * (k % 3), (0, 0, 0), "#9cff8a" if k % 2 else "#5cff7a", subdiv=1, glow=True)
        a = k * 2.1
        bm.build(b, loc=(math.cos(a) * 0.15 * (k % 3) / 2, math.sin(a) * 0.15 * (k % 3) / 2, 0))
    light(g, (0.45, 0, 0.8), "#5cff7a", 4.0, 0.7, flicker=0.5, halo=True)


# --- the rooms ------------------------------------------------------------------------------------

def library(root):
    """The bats along the curtain rod, the candles in the window, a raven on the bookcase, a
    candelabra on the piano, the market's odd squashes on the mantel, one jack-o'-lantern at the
    end of the hearth, and after dark the ghost along the shelves."""
    import interior as R
    h = halloween_root(root, "library_halloween")
    lantern(h, "library_jack", (R.X0 + 1.3, R.HEARTH_Y + 1.3, 0.08), 0.42, 0.85, id_="library_jack")
    sill = R.Y1 - 0.2
    candles(h, "sill_candles", [(R.WINDOW_X - 0.75, sill, 1.5, 0.3), (R.WINDOW_X - 0.52, sill + 0.03, 1.5, 0.2),
                                (R.WINDOW_X + 0.62, sill, 1.5, 0.24)], drips=True)
    rod = 4.1 + 0.9 + 0.35
    garland(h, "library_bats", (R.WINDOW_X - 1.55, R.Y1 - 0.34, rod - 0.08), (R.WINDOW_X + 1.55, R.Y1 - 0.34, rod - 0.08), 4, sag=0.35)
    top = R.PLINTH + R.ROWS * R.PITCH + 0.3
    raven(h, "library_raven", (-1.15, R.Y1 - R.CASE_DEPTH / 2 - 0.15, top), 0.55, size=1.5)
    candelabra(h, "library_candelabra", R.PIANO_X, R.Y1 - 0.27, 1.69)
    g = Model("mantel_gourds", seed=29)
    gourds(g, R.X0 + 0.78, R.HEARTH_Y + 0.35, 1.92)
    g.build(h)
    ghost(h, "library_ghost", (-3.4, R.Y1 - 1.6, 3.7), 0.85, 2.0, 0.35, 0.35)
    cauldron(h, "library_cauldron", (R.X0 + 0.9, R.HEARTH_Y, 0.12))
    heap(h, "library_heap", (1.1, R.Y0 + 0.9, 0), 0.5, 11)
    december_library(root)


def workshop(root):
    """His jack-o'-lantern, lit by an LED; a clockwork spider walking the bench; a string of
    pumpkin lights along the beam over the window."""
    import workshop as R
    h = halloween_root(root, "workshop_halloween")
    led = lantern(h, "led_jack", (0.9, R.Y1 - 0.3, 1.74), 0.25, 0.4, glow=LED, id_="led_jack")
    b = Model("led_battery")
    b.box((0.16, 0.1, 0.09), (0.32, 0.05, 0.045), "#3b6fd1")
    b.box((0.03, 0.04, 0.03), (0.41, 0.05, 0.05), R.SILVER)
    b.box((0.06, 0.08, 0.02), (0.32, 0.05, 0.1), R.SILVER_DARK)
    b.plank_line((0.24, 0.05, 0.08), (0.18, 0.02, 0.3), 0.015, 0.015, "#e04848")       # the wire, in over the lid
    b.build(led)
    clockwork_spider(h, "clockwork_spider", (4.85, R.Y1 - 0.85, 1.06), 1.3, size=2.0)
    pumpkin_lights(h, "pumpkin_lights", (-4.6, R.Y1 - 0.3, 4.2), (2.3, R.Y1 - 0.3, 4.2), 17, sag=0.55, size=1.5)
    heap(h, "workshop_heap", (R.X0 + 0.75, -0.8, 0), 0.6, 12)                         # by the door
    december_workshop(root)


def quarters(root):
    """Jack-o'-lanterns by the door and on the bookcase, a green ship's lantern and candles in
    bottles on the table, a web over the stair, and a spider letting itself down by the telly."""
    import quarters as R
    h = halloween_root(root, "lighthouse_halloween")
    lantern(h, "door_jack", (R.X0 + 0.85, -1.85, 0.0), 0.3, 0.9)
    top = R.PLINTH + R.ROWS * R.PITCH + 0.12
    lantern(h, "case_jack", (R.CASE_X0 + 0.45, R.Y1 - 0.25, top), 0.24, 0.35)
    lantern(h, "case_jack_small", (R.CASE_X0 + 0.95, R.Y1 - 0.25, top), 0.15, 0.1, carved=False)
    tx, ty = R.TABLE
    ships_lantern(h, "green_lantern", (tx + 0.45, ty + 0.1, 0.86))
    heap(h, "lighthouse_heap", (3.2, R.Y0 + 0.85, 0), 0.4, 13)
    bottle_candle(h, "bottle_candle_0", tx + 0.05, ty + 0.52, 0.86, "#2f5a3a", 0.18)
    bottle_candle(h, "bottle_candle_1", tx - 0.3, ty + 0.55, 0.86, "#5a3a22", 0.1)
    w = Model("lighthouse_web")
    corner_web(w, (R.X0 + 0.2, R.Y1 - 0.2, R.H - 0.22), (1, 0, 0), (0, -1, 0), 1.1)
    w.build(h)
    dangling_spider(h, "lighthouse_spider", (R.X0 + 0.32, -1.0, R.H - 0.22), 2.6, wait=2.0)
    december_quarters(root)


def lamproom(root):
    """Two jack-o'-lanterns by the lens, and a web up in the glazing."""
    import lamproom as R
    h = halloween_root(root, "lamproom_halloween")
    lantern(h, "lamp_jack", (-0.75, -1.45, 0.0), 0.3, 0.55)
    lantern(h, "lamp_jack_small", (-1.2, -1.1, 0.0), 0.18, 0.3)
    a = math.pi * 0.62
    ca, sa = math.cos(a), math.sin(a)
    w = Model("lamproom_web")
    corner_web(w, (ca * (R.R - 0.15), sa * (R.R - 0.15), R.H - 0.15), (sa, -ca, 0), (-sa, ca, 0), 0.9)
    w.build(h)
    december_lamproom(root)


def hut(root):
    """The carving, half done, by the woodpile (the island's jack-o'-lanterns are carved up here),
    a finished one on the gable window's sill with a spider letting itself down in front of it, a
    web over the bed, and her broom by the door."""
    import hut as R
    h = halloween_root(root, "hut_halloween")
    g = group("carving", parent=h, id="carving")
    m = Model("carving", seed=23)
    carving(m, R.X1 - 2.2, -2.55, 0.0)
    m.build(g)
    heap(h, "hut_heap", (0.6, R.Y0 + 0.8, 0), 0.3, 14)
    lantern(h, "gable_jack", (0.0, R.Y1 - 0.17, 3.75 - 0.25 - 0.09), 0.15, 0.0)
    w = Model("hut_web")
    corner_web(w, (R.X0 + 0.12, R.Y1 - 0.12, R.EAVE - 0.05), (1, 0, 0), (0, -1, 0), 0.9)
    w.build(h)
    dangling_spider(h, "hut_spider", (0.0, R.Y1 - 0.5, R.RIDGE - 0.43), 1.5, size=0.13, wait=6.0)
    b = Model("broom")
    broom(b, R.X0 + 0.25, -3.2, 0.2)
    b.build(h)
    december_hut(root)


# --- December: Sinterklaas, then Christmas --------------------------------------------------------

SHOE_WOOD, SHOE_DARK = "#e8c77a", "#b8904a"
CARROT = "#f07a1a"
CARROT_TOP = "#4a8a45"
CHOCOLATE = "#5a3222"
PEPERNOOT = ["#a8622e", "#8a4b22"]
MANDARIN = "#f28a1e"
JUTE = "#b8955a"
POEM = "#f2ead6"
PASTE = "#e8e2cc"
MEEPLE_RED = "#d9503a"
BAUBLES = ["#c8303a", "#d8a83a", "#c4c8d4", "#2f5f9a", "#c8303a", "#d8a83a", "#7a2a5a"]   # kerstballen: glass, mostly red and gold
WARM_BULB = "#fff0c8"
PRESENTS = [("#c8303a", "#d8a83a"), ("#2a4f9a", "#f2ece2"), ("#d8a83a", "#c8303a"), ("#3d7a4a", "#d8a83a"),
            ("#f2ece2", "#c8303a"), ("#7a2a5a", "#d8a83a")]
LETTERS = {  # chocolate letters, flat outlines in a unit box (x right, y up)
    "V": [(-0.5, 1.0), (-0.22, 1.0), (0.0, 0.32), (0.22, 1.0), (0.5, 1.0), (0.13, 0.0), (-0.13, 0.0)],
    "E": [(-0.4, 0.0), (0.4, 0.0), (0.4, 0.22), (-0.14, 0.22), (-0.14, 0.4), (0.3, 0.4), (0.3, 0.6), (-0.14, 0.6),
          (-0.14, 0.78), (0.4, 0.78), (0.4, 1.0), (-0.4, 1.0)],
}


def sint_root(root, name: str):
    """The Sinterklaas weeks: from the day he comes in on his steamboat to pakjesavond."""
    return group(name, parent=root, holiday="shoe")


def kerst_root(root, name: str):
    """Christmas: from the day after Sinterklaas till Twelfth Night."""
    return group(name, parent=root, holiday="christmas")


def put_out_shoe(parent, name: str, at, turn: float, colour=SHOE_WOOD, band=SHOE_DARK, size=1.0):
    """A shoe put out by the fire for the night, with what's in it today: a carrot for the horse,
    or (on the mornings he's been) a chocolate letter or a handful of pepernoten, each a part
    tagged `clog=` (calendar.ts clogHolds picks, as for the clog by the campfire outside)."""
    g = group(name, at, rot_z=turn, parent=parent)
    g.scale = (size, size, size)
    m = Model(name)
    m.ball(0.12, (0.02, 0, 0.08), colour, subdiv=2, scale=(1.55, 0.72, 0.62))           # the toe, pointing up a little
    m.ball(0.036, (0.2, 0, 0.115), colour, subdiv=1, scale=(1, 1, 0.8))
    m.cyl(0.09, 0.15, (-0.09, 0, 0.0), colour, segs=8, r_top=0.085)                    # the heel
    m.cyl(0.072, 0.012, (-0.06, 0, 0.15), "#3a2a1c", segs=8)                           # the hole you put your foot in
    m.box((0.05, 0.18, 0.012), (0.06, 0, 0.16), band, rot=(0, 0.35, 0))                # a painted band
    m.build(g)
    c = Model(f"{name}_carrot")
    c.cyl(0.004, 0.26, (-0.05, 0, 0.03), CARROT, segs=6, r_top=0.035, rot=(0, -0.55, 0))
    for a in (-0.4, 0, 0.4):
        c.box((0.02, 0.02, 0.12), (-0.22 + a * 0.03, a * 0.07, 0.28), CARROT_TOP, rot=(a, -0.7, 0))
    c.build(g, clog="carrot")
    k = Model(f"{name}_letter")
    k.prism([(x * 0.2, y * 0.22) for x, y in LETTERS["V"]], 0.03, (-0.05, 0, 0.08), CHOCOLATE, rot=(0, -0.25, math.pi / 2 - 0.2))
    k.build(g, clog="letter")
    n = Model(f"{name}_pepernoten")
    for i, (dx, dy, dz) in enumerate([(-0.1, -0.03, 0.15), (-0.05, 0.025, 0.16), (-0.07, 0.05, 0.15), (-0.02, -0.035, 0.155),
                                      (-0.11, 0.03, 0.15), (-0.06, -0.01, 0.185)]):
        n.ball(0.025, (dx, dy, dz), PEPERNOOT[i % 2], subdiv=1, scale=(1, 1, 0.75))
    n.build(g, clog="pepernoten")
    return g


def pepernoten_bowl(m: Model, x: float, y: float, z: float, r=0.16):
    """A bowl of pepernoten, heaped."""
    m.cyl(r * 0.65, 0.09, (x, y, z), P.WHITE, segs=10, r_top=r)
    for k in range(16):
        a, d = k * 2.4, r * 0.75 * math.sqrt((k + 0.5) / 16)
        m.ball(0.028, (x + math.cos(a) * d, y + math.sin(a) * d, z + 0.1 + 0.03 * (1 - d / r)), PEPERNOOT[k % 2],
               subdiv=1, scale=(1, 1, 0.75))


def mandarins(m: Model, x: float, y: float, z: float, n=4):
    """Mandarins, a few in a little heap, one with its peel coming off."""
    for k in range(n):
        a = k * 2.1
        d = 0.0 if k == 0 else 0.1
        m.ball(0.06, (x + math.cos(a) * d, y + math.sin(a) * d, z + 0.055 + (0.07 if k == n - 1 else 0)), MANDARIN,
               subdiv=1, scale=(1, 1, 0.85))
    m.box((0.05, 0.04, 0.012), (x + 0.15, y - 0.06, z + 0.006), "#f8b060", rot=(0, 0, 0.6))  # peel


def chocolate_letter(m: Model, ch: str, at, size: float, turn: float, wrapper=None):
    """A chocolate letter lying flat (its initial), on its foil-edged card if `wrapper`."""
    x, y, z = at
    pts = LETTERS[ch]
    ca, sa = math.cos(turn), math.sin(turn)
    if wrapper:
        m.box((size * 1.25, size * 1.25, 0.012), (x, y, z + 0.006), wrapper, rot=(0, 0, turn))
        z += 0.012
    m.prism([((px * ca - (py - 0.5) * sa) * size, (px * sa + (py - 0.5) * ca) * size) for px, py in pts], 0.035,
            (x, y, z + 0.035), CHOCOLATE, rot=(math.pi / 2, 0, 0))


def present(m: Model, x: float, y: float, z: float, w: float, d: float, h: float, k: int, turn=0.0):
    paper, ribbon = PRESENTS[k % len(PRESENTS)]
    m.box((w, d, h), (x, y, z + h / 2), paper, rot=(0, 0, turn))
    m.box((w + 0.01, 0.035, h + 0.01), (x, y, z + h / 2), ribbon, rot=(0, 0, turn))
    m.box((0.035, d + 0.01, h + 0.01), (x, y, z + h / 2), ribbon, rot=(0, 0, turn))
    for s in (-1, 1):                                                                       # the bow
        m.ball(0.035, (x + s * 0.03 * math.cos(turn), y + s * 0.03 * math.sin(turn), z + h + 0.02), ribbon, subdiv=1,
               scale=(1.3, 0.6, 0.6), rot=(0, 0, turn))


def poem(m: Model, x: float, y: float, z: float, turn: float, ribbon="#c8303a"):
    """A poem, rolled up and tied with a ribbon."""
    m.cyl(0.03, 0.26, (x, y, z + 0.03), POEM, segs=6, rot=(math.pi / 2, 0, turn))
    m.cyl(0.033, 0.03, (x, y, z + 0.03), ribbon, segs=6, rot=(math.pi / 2, 0, turn))


def meeple(m: Model, x: float, y: float, z: float, h: float, colour: str, half=None):
    """A Carcassonne meeple, `h` tall, facing -y: head, arms out, legs apart. With `half`, the
    papier-mâché isn't painted yet above that height."""
    def c(zz):
        return colour if half is None or zz < half else NEWSPAPER
    w = h * 0.95
    m.prism([(-w * 0.16, 0), (-w * 0.5, 0), (-w * 0.12, h * 0.5), (0, h * 0.42)], h * 0.32, (x, y + h * 0.16, z), c(0.2 * h),
            rot=(math.pi / 2, 0, 0))                                                        # left leg
    m.prism([(w * 0.16, 0), (w * 0.5, 0), (w * 0.12, h * 0.5), (0, h * 0.42)], h * 0.32, (x, y + h * 0.16, z), c(0.2 * h),
            rot=(math.pi / 2, 0, 0))                                                        # right leg
    m.box((w * 0.44, h * 0.32, h * 0.3), (x, y, z + h * 0.55), c(0.55 * h))                  # the body
    m.box((w, h * 0.3, h * 0.17), (x, y, z + h * 0.62), c(0.62 * h))                         # arms out
    m.ball(h * 0.17, (x, y, z + h * 0.84), c(0.84 * h), subdiv=1, scale=(1, 0.9, 1))        # the head


def surprise_in_hand(parent, x: float, y: float, z: float):
    """A surprise on the go: a papier-mâché meeple, half painted, drying on newspaper, with the
    bowl of paste, the strips, the paint and the brush, and the poem to go with it, half written."""
    g = group("surprise_making", parent=parent, id="surprise_making")
    m = Model("surprise_making", seed=51)
    m.box((0.9, 0.6, 0.006), (x, y, z + 0.003), NEWSPAPER, rot=(0, 0, 0.1))
    for k in range(4):                                                                     # columns of print
        m.box((0.3, 0.035, 0.004), (x - 0.22 + (k % 2) * 0.44, y + 0.18 - k * 0.1, z + 0.008), "#9a968c", rot=(0, 0, 0.1))
    meeple(m, x - 0.1, y + 0.05, z + 0.006, 0.5, MEEPLE_RED, half=0.26)
    bx, by = x + 0.3, y + 0.12                                                             # the paste
    m.cyl(0.08, 0.07, (bx, by, z), P.WHITE, segs=8, r_top=0.1)
    m.cyl(0.09, 0.01, (bx, by, z + 0.065), PASTE, segs=8)
    for k in range(5):                                                                     # strips torn off, ready
        m.box((0.16, 0.035, 0.006), (x + 0.22 + (k % 2) * 0.05, y - 0.12 - k * 0.035, z + 0.01 + k * 0.003), NEWSPAPER,
              rot=(0, 0, 0.3 + k * 0.4))
    m.cyl(0.035, 0.06, (x + 0.08, y - 0.2, z), MEEPLE_RED, segs=6)                         # a pot of red,
    m.plank_line((x + 0.08, y - 0.2, z + 0.05), (x - 0.06, y - 0.3, z + 0.12), 0.015, 0.015, P.WOOD_LIGHT)  # the brush in it
    m.box((0.21, 0.29, 0.006), (x - 0.36, y - 0.18, z + 0.01), POEM, rot=(0, 0, -0.25))    # the poem, so far
    for k in range(5):
        m.box((0.14 - (k % 2) * 0.04, 0.012, 0.004), (x - 0.37 + 0.01 * k, y - 0.08 - k * 0.045, z + 0.015), "#4a4a5a",
              rot=(0, 0, -0.25))
    m.box((0.1, 0.012, 0.005), (x - 0.33, y - 0.14, z + 0.017), MEEPLE_RED, rot=(0, 0, -0.25))  # a rhyme crossed out
    m.plank_line((x - 0.24, y - 0.33, z + 0.015), (x - 0.4, y - 0.38, z + 0.015), 0.015, 0.015, P.GOLD)  # pencil
    m.build(g)
    return g


def pakjesavond(parent, x: float, y: float, turn: float):
    """Pakjesavond, round (x, y) on the floor: the jute sack, half emptied, presents unwrapped and
    not yet, the surprise (the meeple from the workshop, painted now), poems, and paper everywhere."""
    g = group("pakjesavond", (x, y, 0), rot_z=turn, parent=parent, id="pakjesavond")
    m = Model("pakjesavond", seed=55)
    m.ball(0.34, (-0.55, 0.45, 0.3), JUTE, subdiv=1, scale=(1, 1, 1.05), jitter=0.02)       # the sack
    m.cyl(0.15, 0.16, (-0.55, 0.45, 0.6), JUTE, segs=6, r_top=0.22)
    m.cyl(0.16, 0.04, (-0.55, 0.45, 0.62), "#c8303a", segs=6)
    m.box((0.5, 0.3, 0.12), (-0.2, 0.62, 0.06), JUTE, rot=(0, 0, 0.4))                      # its mouth, spilling
    for k, (px, py, w, d, h, t) in enumerate([(0.0, 0.3, 0.34, 0.26, 0.22, 0.3), (0.4, 0.45, 0.24, 0.24, 0.3, -0.2),
                                               (0.35, 0.05, 0.4, 0.18, 0.12, 0.6), (-0.15, 0.0, 0.2, 0.2, 0.16, 1.0),
                                               (0.65, 0.2, 0.18, 0.14, 0.1, 0.1)]):
        present(m, px, py, 0, w, d, h, k, t)
    meeple(m, -0.05, -0.4, 0.0, 0.48, MEEPLE_RED)                                           # the surprise
    m.box((0.6, 0.5, 0.006), (-0.1, -0.45, 0.003), PRESENTS[1][0], rot=(0, 0, 0.3))          # torn off it
    for k in range(9):                                                                      # paper everywhere
        a, d = k * 2.3, 0.5 + 0.12 * (k % 4)
        m.box((0.16 + 0.04 * (k % 3), 0.12, 0.012), (0.1 + math.cos(a) * d, -0.05 + math.sin(a) * d * 0.7, 0.006 + 0.004 * (k % 2)),
              PRESENTS[k % len(PRESENTS)][0], rot=(0, 0, a * 1.7))
    poem(m, 0.3, -0.5, 0.0, 0.5)
    poem(m, 0.75, -0.2, 0.0, 1.8, ribbon="#d8a83a")
    m.build(g)
    return g


def lights_string(parent, name: str, a, b, n: int, sag=0.3, size=0.07, colours=None, start=0):
    """A string of little fairy lights from a to b, each one twinkling on its own (`spook=twinkle`)."""
    pts = [(a[0] + (b[0] - a[0]) * i / (n + 1), a[1] + (b[1] - a[1]) * i / (n + 1),
            a[2] + (b[2] - a[2]) * i / (n + 1) - sag * 4 * (i / (n + 1)) * (1 - i / (n + 1))) for i in range(n + 2)]
    w = Model(f"{name}_wire")
    for p, q in zip(pts, pts[1:]):
        w.plank_line(p, q, 0.02, 0.02, "#2a3a2a")
    w.build(parent)
    _bulbs(parent, name, [(x, y, z - size) for x, y, z in pts[1:-1]], size, colours, start)


def _bulbs(parent, name: str, spots, size: float, colours=None, start=0):
    for i, (x, y, z) in enumerate(spots):
        g = group(f"{name}_{i}", (x, y, z), parent=parent, spook="twinkle", index=start + i)
        m = Model(f"{name}_{i}")
        m.ball(size, (0, 0, 0), (colours or [WARM_BULB])[i % len(colours or [WARM_BULB])], subdiv=1, glow=True)
        m.build(g)


def kerstboom(parent, name: str, at, h=2.5, presents=True):
    """A Christmas tree in a stand, with just lights and kerstballen on it; and on Christmas Day
    (24 to 26 December) presents under it."""
    x, y, z = at
    g = group(name, at, parent=parent, id="kerstboom")
    m = Model(name, seed=81)
    m.cyl(0.32, 0.3, (0, 0, 0), "#8a2a2a", segs=8, r_top=0.36)                             # the stand, in a red pot
    m.cyl(0.07, 0.4, (0, 0, 0.25), P.BARK, segs=5)
    s = h / 2.5
    tiers = [(0.95 * s, 0.4 * s, 0.95 * s), (0.78 * s, 0.95 * s, 0.85 * s), (0.58 * s, 1.5 * s, 0.75 * s), (0.36 * s, 2.0 * s, 0.6 * s)]
    for i, (r, z0, th) in enumerate(tiers):
        m.cyl(r, th, (0, 0, z0), P.PINE[i % 3], segs=9, r_top=0.04)
    m.build(g)

    def reach(zz):                                                                          # how far the needles stand out
        return max((r - (r - 0.04) * (zz - z0) / th for r, z0, th in tiers if z0 <= zz <= z0 + th), default=0.05)

    b = Model(f"{name}_baubles", seed=82)
    for i in range(30):
        zz = 0.5 * s + (i * 0.61 % 1) * 1.95 * s
        a = i * 2.4
        r = reach(zz) + 0.02
        b.ball(0.075 if i % 3 else 0.095, (math.cos(a) * r, math.sin(a) * r, zz - 0.06), BAUBLES[i % len(BAUBLES)], subdiv=1)
        b.box((0.025, 0.025, 0.03), (math.cos(a) * r, math.sin(a) * r, zz + 0.03), "#d8d0b8")  # the cap
    b.build(g)
    spots = []
    zz, a = 0.5 * s, 0.0
    while zz < 2.4 * s:                                                                     # lights wound round it, bottom to top
        r = reach(zz) + 0.04
        spots.append((math.cos(a) * r, math.sin(a) * r, zz))
        a += 0.55 / max(r, 0.2)
        zz += 0.022 * s
    _bulbs(g, f"{name}_light", spots[::2], 0.04, [WARM_BULB, "#ffe2a0"])
    light(g, (0.0, -0.8, 1.3 * s), "#ffd8a0", 3.5, 0.7, flicker=0.15, halo=False)
    if presents:
        p = group(f"{name}_presents", parent=g, holiday="christmasday")
        pm = Model(f"{name}_presents", seed=83)
        for k, (px, py, w, d, hh, t) in enumerate([(-0.55, -0.45, 0.36, 0.3, 0.26, 0.3), (0.35, -0.6, 0.3, 0.3, 0.2, -0.4),
                                                    (-0.05, -0.75, 0.24, 0.2, 0.32, 0.1), (0.6, -0.1, 0.22, 0.26, 0.18, 0.8),
                                                    (-0.7, 0.15, 0.2, 0.2, 0.14, 1.2)]):
            present(pm, px, py, 0, w, d, hh, k + 2, t)
        pm.build(p)
    return g


def december_library(root):
    """The Sinterklaas weeks: his and her shoes on the hearth, pepernoten and mandarins on the
    reading table; and on pakjesavond the sack by the fire, the chocolate letters out. Then at
    Christmas, lights along the curtain rod and the mantel."""
    import interior as R
    s = sint_root(root, "library_sinterklaas")
    hx = R.X0 + 1.4
    put_out_shoe(s, "library_shoe_v", (hx, R.HEARTH_Y - 0.3, 0.08), 3.0, size=1.25)
    put_out_shoe(s, "library_shoe_e", (hx + 0.05, R.HEARTH_Y + 0.4, 0.08), 3.3, colour="#e0e8f0", band="#c8303a", size=1.1)
    tx, ty = -1.6, 0.1                                                                      # the reading table (interior.py)
    t = Model("library_pepernoten", seed=52)
    pepernoten_bowl(t, tx - 0.45, ty + 0.35, 0.82)
    mandarins(t, tx + 0.45, ty - 0.35, 0.82)
    t.build(s)
    day = group("library_pakjesavond", parent=s, holiday="sinterklaas")
    pakjesavond(day, R.X0 + 2.4, R.HEARTH_Y + 1.25, -0.4)
    c = Model("library_letters", seed=53)
    chocolate_letter(c, "V", (tx + 0.1, ty - 0.55, 0.82), 0.22, 0.3, wrapper="#d8a83a")
    chocolate_letter(c, "E", (tx - 0.4, ty - 0.35, 0.82), 0.22, -0.2, wrapper="#c4c8d4")
    c.build(day)

    k = kerst_root(root, "library_kerst")
    rod = 4.1 + 0.9 + 0.35
    lights_string(k, "library_rod_lights", (R.WINDOW_X - 1.55, R.Y1 - 0.34, rod - 0.08), (R.WINDOW_X + 1.55, R.Y1 - 0.34, rod - 0.08),
                  11, sag=0.3)
    mx = R.X0 + 1.12                                                                        # the mantel's front edge
    lights_string(k, "library_mantel_lights", (mx, R.HEARTH_Y - 1.35, 1.9), (mx, R.HEARTH_Y + 1.35, 1.9), 13, sag=0.12)
    top = R.PLINTH + R.ROWS * R.PITCH + 0.25
    lights_string(k, "library_case_lights", (R.CASE_X0 + 0.2, R.Y1 - R.CASE_DEPTH - 0.05, top), (R.CASE_X1 - 0.2, R.Y1 - R.CASE_DEPTH - 0.05, top),
                  17, sag=0.0, start=11)
    light(k, (R.WINDOW_X, R.Y1 - 0.8, rod - 0.5), "#ffd8a0", 3.0, 0.45, halo=False)


def december_workshop(root):
    """The Sinterklaas weeks: a surprise on the go on the bench (till it's taken over on the fifth);
    at Christmas, lights along the beam over the window."""
    import workshop as R
    s = sint_root(root, "workshop_sinterklaas")
    making = group("workshop_surprise", parent=s, holiday="!sinterklaas")
    surprise_in_hand(making, 4.65, R.Y1 - 0.8, 1.06)
    k = kerst_root(root, "workshop_kerst")
    lights_string(k, "workshop_lights", (-4.6, R.Y1 - 0.3, 4.2), (2.3, R.Y1 - 0.3, 4.2), 23, sag=0.5, size=0.08)
    for x in (-3.2, 0.6):
        light(k, (x, R.Y1 - 0.8, 3.6), "#ffd8a0", 3.2, 0.45, halo=False)


def december_quarters(root):
    """The Sinterklaas weeks: pepernoten and a mandarin or two on the counter. Christmas: the tree by
    the east wall, lights over the portholes, and presents under the tree at the end."""
    import quarters as R
    s = sint_root(root, "lighthouse_sinterklaas")
    c = Model("lighthouse_pepernoten", seed=54)
    pepernoten_bowl(c, 2.05, R.Y1 - 0.35, 0.96, r=0.14)
    mandarins(c, 2.45, R.Y1 - 0.4, 0.96, n=3)
    c.build(s)
    k = kerst_root(root, "lighthouse_kerst")
    kerstboom(k, "lighthouse_tree", (R.X1 - 0.95, 0.1, 0.0), h=2.3)                     # against the east wall by the table, clear of the counter
    top = R.PLINTH + R.ROWS * R.PITCH + 0.2
    lights_string(k, "lighthouse_case_lights", (R.CASE_X0 + 0.1, R.Y1 - R.CASE_DEPTH - 0.05, top), (R.CASE_X1 - 0.1, R.Y1 - R.CASE_DEPTH - 0.05, top),
                  13, sag=0.05)
    lights_string(k, "lighthouse_shelf_lights", (1.7, R.Y1 - 0.1, 2.75), (R.X1 - 0.2, R.Y1 - 0.1, 2.75), 15, sag=0.25, start=13)


def december_lamproom(root):
    """Christmas: a string of lights in swags along the sill under the glass, round the back; and
    the pot plant from downstairs, moved up here out of the tree's way."""
    import lamproom as R
    import quarters
    k = kerst_root(root, "lamproom_kerst")
    px, py, _ = R.at(math.pi * 0.02, R.R - 0.75)
    quarters.potted_plant(k, px, py)
    n = 0
    for i in range(R.N):
        a0, a1 = i / R.N * math.tau, (i + 1) / R.N * math.tau
        mid = (a0 + a1) / 2
        if math.cos(mid - R.CAMERA) > -0.2:                                                 # only the back, the side you look at
            continue
        p, q = R.corner(i, R.R - 0.12), R.corner(i + 1, R.R - 0.12)
        lights_string(k, f"lamproom_lights_{i}", (*p, R.KNEE + 0.02), (*q, R.KNEE + 0.02), 4, sag=0.18, start=n)
        n += 4


def december_hut(root):
    """The Sinterklaas weeks: a clog by the stove. Christmas: lights along the north wall under the
    gable, and round the window over the counter."""
    import hut as R
    s = sint_root(root, "hut_sinterklaas")
    sx, sy = R.STOVE
    put_out_shoe(s, "hut_clog", (sx + 0.45, sy - 0.72, 0.04), 3.9, size=1.3)
    k = kerst_root(root, "hut_kerst")
    z = R.EAVE - 0.25
    lights_string(k, "hut_eave_lights", (R.X0 + 0.4, R.Y1 - 0.12, z), (R.X1 - 0.4, R.Y1 - 0.12, z), 25, sag=0.35, size=0.06)
    x, wz = 2.9, 1.75                                                                       # the window over the counter (hut.py)
    lights_string(k, "hut_window_lights", (x - 0.75, R.Y1 - 0.2, wz + 0.62), (x + 0.75, R.Y1 - 0.2, wz + 0.62), 9, sag=0.08,
                  size=0.055, start=25)
    light(k, (0.0, R.Y1 - 0.8, z - 0.3), "#ffd8a0", 3.0, 0.4, halo=False)
