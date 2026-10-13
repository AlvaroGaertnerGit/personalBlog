"""Render static views of the definitive Scope (rest pose) for review.

The studio is rebuilt from scope3d/studio.py so every render uses the same
cameras and lights; "warm" matches the design sheet, "cool" checks the beige
and the mineral grain under neutral/cold light.

Run:
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup       --python assets/scope-3d/scripts/render_views.py -- [--views front,three-quarter,...] [--rigs warm,cool] [--res N] [--samples N]

Output: renders/model/<rig>/view-<name>.png
"""

import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from scope3d import studio  # noqa: E402

ROOT = os.path.dirname(HERE)
BLEND = os.path.join(ROOT, "blender", "scope-master.blend")
DEFAULT_VIEWS = "front,three-quarter,profile-left,profile-right,back,face-closeup,hero,focus"


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = dict(views=DEFAULT_VIEWS, rigs="warm,cool", out="renders/model", res=640, samples=48)
    it = iter(argv)
    for a in it:
        key = a.lstrip("-")
        val = next(it)
        if key in ("res", "samples"):
            opts[key] = int(val)
        else:
            opts[key] = val
    return opts


def main():
    o = parse()
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    cams = studio.replace()
    studio.render_settings(o["res"], o["samples"])
    studio.bloom()
    for rig in o["rigs"].split(","):
        studio.set_light_rig(rig)
        out = os.path.join(ROOT, o["out"], rig)
        os.makedirs(out, exist_ok=True)
        for view in o["views"].split(","):
            t0 = time.time()
            studio.render(cams[view], os.path.join(out, f"view-{view}.png"))
            print(f"[views] {rig}/{view}: {time.time() - t0:.1f}s")


main()
