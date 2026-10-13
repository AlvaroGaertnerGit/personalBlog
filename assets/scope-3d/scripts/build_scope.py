"""Build the definitive Scope 3D: approved geometry + rig + 12 clips.

Run (headless — never opens the Blender UI):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
      --python assets/scope-3d/scripts/build_scope.py

1. Builds the character (scope3d/character.py, faceshell.py, geometry.py) and
   checks the shell against approved-geometry.json — if the code no longer
   produces the approved model, it stops instead of rigging something else.
2. Adds the armature, skin weights and eye shape keys (scope3d/rig.py).
3. Bakes every clip (scope3d/clips.py) as actions filed under NLA tracks.
Output: blender/scope-master.blend and exports/scope-clips.json
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from scope3d import character, clips, rig, spec, studio  # noqa: E402

ROOT = os.path.dirname(HERE)
APPROVED = os.path.join(HERE, "approved-geometry.json")
OUT = os.path.join(ROOT, "blender", "scope-master.blend")
META = os.path.join(ROOT, "exports", "scope-clips.json")


def signature(obj):
    """Vertex count + a positional checksum over every 97th vertex."""
    verts = obj.data.vertices
    n = len(verts)
    s = sum(verts[i].co.x + verts[i].co.y * 2.0 + verts[i].co.z * 3.0 for i in range(0, n, 97))
    return n, round(s, 6)


def main():
    with open(APPROVED, encoding="utf-8") as fh:
        approved = json.load(fh)["Scope_Shell"]

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "MILLIMETERS"
    scene.render.fps = clips.FPS
    spec.apply_profile("sheet")
    objs = character.build()
    n, checksum = signature(objs["shell"])
    print(f"[build] shell signature {n} / {checksum} (approved {approved['verts']} / {approved['checksum']})")
    if (n, checksum) != (approved["verts"], approved["checksum"]):
        raise RuntimeError("the shell no longer matches the approved geometry — refusing to rig it")

    r = rig.build(objs)
    studio.build()
    studio.render_settings(480, 24)
    studio.bloom()

    meta = {"fps": clips.FPS, "clips": {}}
    for clip in clips.all_clips():
        clips.bake(r, clip)
        meta["clips"][clip.name] = {
            "duration": round(clip.duration, 4),
            "loop": clip.loop,
            "markers": {m: round(t, 4) for m, t in clip.markers},
        }
        print(f"[build] baked {clip.name}: {clip.duration:.2f}s")
    # leave the file at rest, NLA evaluation off (renders assign actions explicitly)
    r["arm"].animation_data.use_nla = False
    r["eyes"].data.shape_keys.animation_data.use_nla = False
    for pb in r["arm"].pose.bones:
        pb.location, pb.scale = (0, 0, 0), (1, 1, 1)
        pb.rotation_quaternion = (1, 0, 0, 0)

    bpy.context.preferences.filepaths.save_version = 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
    os.makedirs(os.path.dirname(META), exist_ok=True)
    with open(META, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)
    print("[build] saved", OUT)


main()
