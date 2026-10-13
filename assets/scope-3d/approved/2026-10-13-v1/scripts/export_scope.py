"""Export the rigged Scope to glTF binary.

Run:
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
      --python assets/scope-3d/scripts/export_scope.py

Output: exports/scope.glb — 12 animations, Blink/Laugh morph targets, 14 joints.
Not web-optimised yet (no compression, no baked textures): see scope3d/export.py.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from scope3d.export import export_glb  # noqa: E402

ROOT = os.path.dirname(HERE)
BLEND = os.path.join(ROOT, "blender", "scope-master.blend")
GLB = os.path.join(ROOT, "exports", "scope.glb")

bpy.ops.wm.open_mainfile(filepath=BLEND)
export_glb(GLB)
print(f"[export] {GLB} ({os.path.getsize(GLB) / 1024:.0f} KB)")
