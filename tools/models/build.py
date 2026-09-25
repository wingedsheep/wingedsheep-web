"""Build the island scene and export it for the web.

    blender -b --factory-startup -P tools/models/build.py -- [--preview out.png] [--night]
    blender -b --factory-startup -P tools/models/build.py -- --only library [--preview out.png]
    blender -b --factory-startup -P tools/models/build.py -- --only workshop [--preview out.png]
    blender -b --factory-startup -P tools/models/build.py -- --only lighthouse [--preview out.png]

Outputs (public/models/):
  island.glb    terrain + every model, with ids, lights and emitters as glTF extras
  shore.png     distance-from-land map for the water shader
  island.json   world extent and other numbers the runtime needs
  library.glb   the library, inside (tools/models/interior.py)
  workshop.glb  the workshop, inside, with the projects and the robot (tools/models/workshop.py)
  lighthouse.glb  the keeper's quarters in the lighthouse (tools/models/quarters.py)
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import kit  # noqa: E402
import terrain  # noqa: E402
from layout import CELL, EXTENT  # noqa: E402

OUT = HERE.parent.parent / "public" / "models"


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview")
    ap.add_argument("--night", action="store_true")
    ap.add_argument("--yaw", type=float, default=0.0)
    ap.add_argument("--focus", default="0,1")
    ap.add_argument("--span", type=float, default=70.0)
    ap.add_argument("--only", choices=["island", "library", "workshop", "lighthouse"])
    return ap.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit.reset()


def export(name: str):
    OUT.mkdir(parents=True, exist_ok=True)
    kit.stash_clips()
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / name),
        export_format="GLB",
        export_extras=True,
        export_yup=True,
        export_apply=True,
        export_vertex_color="ACTIVE",
        export_lights=False,
        export_cameras=False,
        export_animation_mode="ACTIONS",
        export_merge_animation="ACTION",
    )


def preview(path: str, night: bool, yaw: float, focus: tuple[float, float], span: float, sea=True):
    """Rough Eevee render from the game camera angle, pixelated, for eyeballing the models."""
    scene = bpy.context.scene
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = span
    pitch = math.radians(55)       # 35° above the horizon
    yaw_r = math.radians(yaw)
    d = 80
    fx, fy = focus
    cam.location = (fx - math.sin(yaw_r) * d * math.cos(math.radians(35)),
                    fy - math.cos(yaw_r) * d * math.cos(math.radians(35)),
                    d * math.sin(math.radians(35)))
    cam.rotation_euler = (pitch, 0, -yaw_r)
    scene.camera = cam

    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-35))
    sun.data.energy = 0.6 if night else 4.0
    sun.data.color = (0.5, 0.6, 1.0) if night else (1.0, 0.93, 0.8)

    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.02, 0.03, 0.08, 1) if night else (0.45, 0.55, 0.75, 1)
    bg.inputs["Strength"].default_value = 0.5 if night else 1.0

    # stand-in foliage: the runtime grows leaf cards on these markers
    palettes = {"leaf": "#4a8a45", "pine": "#234d3d", "autumn": "#c85a2c", "blossom": "#ecb3c8"}
    for o in [o for o in bpy.data.objects if "canopy" in o]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=o["canopy"], location=o.matrix_world.translation)
        bpy.context.object.scale.z = o.get("squash", 1.0)
        bpy.context.object.data.materials.append(kit.material(palettes[o["palette"]]))

    if sea:  # a flat sea so the island has context
        bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0.02))
        bpy.context.object.data.materials.append(kit.material("#1d6d8c"))

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 480
    scene.render.resolution_y = 300
    scene.render.filter_size = 0.0
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

    img = bpy.data.images.load(path)
    img.scale(1440, 900)  # bilinear, but good enough to judge shapes and colours


def build_island(a):
    reset_scene()
    t = terrain.generate()
    terrain.build_mesh(t)
    terrain.save_shore(t, str(OUT / "shore.png"))

    import models  # noqa: E402  (after the terrain exists: models sit on it)
    models.populate(t)

    export("island.glb")
    x0, y0, x1, y1 = EXTENT
    (OUT / "island.json").write_text(json.dumps({"extent": [x0, y0, x1, y1], "cell": CELL}, indent=1))
    print(f"exported {len(bpy.data.objects)} objects -> {OUT}")

    if a.preview and a.only == "island":
        fx, fy = (float(v) for v in a.focus.split(","))
        preview(a.preview, a.night, a.yaw, (fx, fy), a.span)


def build_library(a):
    reset_scene()
    import interior  # noqa: E402
    interior.build()
    export("library.glb")
    print(f"exported {len(bpy.data.objects)} objects -> {OUT / 'library.glb'}")

    if a.preview and a.only == "library":
        preview(a.preview, a.night, -30.0, (-0.5, 3.0), 21.0, sea=False)


def build_workshop(a):
    reset_scene()
    import workshop  # noqa: E402
    workshop.build()
    export("workshop.glb")
    print(f"exported {len(bpy.data.objects)} objects -> {OUT / 'workshop.glb'}")

    if a.preview and a.only == "workshop":
        preview(a.preview, a.night, -22.0, (0.0, 0.5), 20.0, sea=False)


def build_lighthouse(a):
    reset_scene()
    import quarters  # noqa: E402
    quarters.build()
    export("lighthouse.glb")
    print(f"exported {len(bpy.data.objects)} objects -> {OUT / 'lighthouse.glb'}")

    if a.preview and a.only == "lighthouse":
        preview(a.preview, a.night, -22.0, (0.0, 0.3), 16.0, sea=False)


def main():
    a = args()
    if a.preview and not a.only:
        a.only = "island"
    if a.only in (None, "island"):
        build_island(a)
    if a.only in (None, "library"):
        build_library(a)
    if a.only in (None, "workshop"):
        build_workshop(a)
    if a.only in (None, "lighthouse"):
        build_lighthouse(a)


main()
