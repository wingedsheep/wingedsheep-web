"""Vincent out for a run (src/island/scene/running.ts), parked out of sight till he sets off:

  vincent_run   him in his running things: the teal sports tee, black running shorts, orange
                running shoes and his watch. Jointed for a runner's stride: `run_leg_l/_r` from
                the hips with `run_shin_l/_r` at the knee, `run_torso` at the hips (it leans into
                the run, and carries the head and arms), `run_arm_l/_r` from the shoulders with
                `run_fore_l/_r` at the elbow. Every limb hangs straight down from its joint as
                built; the runtime bends the elbows. `run_torch`, a head torch, is for after dark.

Faces -y; z = 0 is the ground.
"""
from __future__ import annotations

import characters
import palette as P
from kit import Model, group

PARKED = (0, 0, -20)
RUN_SHOE = "#e8743a"           # orange, with a white sole
RUN_SOLE = "#f4f0e6"
TORCH_BAND = "#2a2833"


def vincent_runner(root, p: str):
    hip = 0.84
    hips = Model(f"{p}_hips")
    hips.box((0.5, 0.3, 0.2), (0, 0, hip + 0.02), P.VS_LEGS)
    hips.build(root)
    for s, side in ((1, "l"), (-1, "r")):
        g = Model(f"{p}_leg_{side}")
        g.box((0.2, 0.22, 0.3), (0, 0, -0.15), P.VS_LEGS)                                  # running shorts, short
        g.box((0.16, 0.16, 0.14), (0, 0, -0.35), P.VS_SHIN)
        leg = g.build(root, loc=(s * 0.13, 0, hip))
        k = Model(f"{p}_shin_{side}")
        k.box((0.16, 0.16, 0.32), (0, 0, -0.15), P.VS_SHIN)
        k.box((0.165, 0.165, 0.05), (0, 0, -0.33), P.WHITE)                                 # sock
        k.box((0.19, 0.33, 0.1), (0, -0.05, -0.37), RUN_SHOE)
        k.box((0.2, 0.34, 0.05), (0, -0.05, -0.415), RUN_SOLE)
        k.build(leg, loc=(0, 0, -0.42))
    torso = group(f"{p}_torso", (0, 0, hip), parent=root)
    m = Model(f"{p}_body")
    characters._tee(m, -0.12, sport=True)
    m.build(torso)
    for s, side in ((1, "l"), (-1, "r")):
        a = Model(f"{p}_arm_{side}")
        a.box((0.15, 0.15, 0.2), (0, 0, -0.1), P.VS_TOP)
        a.box((0.12, 0.12, 0.1), (0, 0, -0.24), P.VS_ARM)
        arm = a.build(torso, loc=(s * 0.34, 0, 0.48))
        f = Model(f"{p}_fore_{side}")
        f.box((0.12, 0.12, 0.26), (0, 0, -0.13), P.VS_ARM)
        f.box((0.11, 0.12, 0.1), (0, 0, -0.3), P.SKIN)                                      # a loose fist
        if s > 0:
            f.box((0.13, 0.13, 0.05), (0, 0, -0.22), P.WATCH)
        f.build(arm, loc=(0, 0, -0.28))
    h = characters.head(torso, f"{p}_head", (0, 0, 0.61), sport=True)
    # the head torch: an elastic band round his head, and the lamp on his forehead
    hz = 1.45
    t = Model(f"{p}_torch")
    t.box((0.46, 0.44, 0.045), (0, 0.0, 1.82 - hz), TORCH_BAND)
    t.box((0.12, 0.05, 0.08), (0, -0.235, 1.82 - hz), "#3b3a42")
    t.box((0.08, 0.02, 0.05), (0, -0.262, 1.82 - hz), P.LANTERN, glow=True)
    t.build(h)


def populate(t):
    vincent_runner(group("vincent_run", PARKED, id="vincent_run"), "run")
