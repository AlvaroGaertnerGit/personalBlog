"""Headless environment check for the Scope 3D pipeline.

Run:
  blender --background --factory-startup --python assets/scope-3d/scripts/check_env.py

Verifies bpy, .blend save/reload, GLB export, and a tiny CPU render (Cycles, then
Workbench) without ever touching the GUI. Writes into a temp dir, never the repo.
"""

import os
import sys
import tempfile
import time

import bpy

out = tempfile.mkdtemp(prefix="scope3d_env_")
results = []


def check(name, fn):
    t0 = time.time()
    try:
        detail = fn() or ""
        results.append((name, "OK", detail, time.time() - t0))
    except Exception as exc:  # report, don't abort — we want every result
        results.append((name, "FAIL", repr(exc), time.time() - t0))


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1)
    bpy.ops.object.camera_add(location=(0, -5, 0), rotation=(1.5708, 0, 0))
    bpy.context.scene.camera = bpy.context.object
    bpy.ops.object.light_add(type="SUN", location=(2, -2, 3))


def save_and_reload():
    reset_scene()
    path = os.path.join(out, "probe.blend")
    bpy.ops.wm.save_as_mainfile(filepath=path)
    bpy.ops.wm.open_mainfile(filepath=path)
    return f"{len(bpy.data.objects)} objects after reload"


def export_glb():
    reset_scene()
    path = os.path.join(out, "probe.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB")
    return f"{os.path.getsize(path)} bytes"


def render(engine):
    def _run():
        reset_scene()
        scene = bpy.context.scene
        try:
            scene.render.engine = engine
        except TypeError as exc:
            raise RuntimeError(f"engine {engine} unavailable: {exc}")
        if engine == "CYCLES":
            scene.cycles.device = "CPU"
            scene.cycles.samples = 8
        scene.render.resolution_x = scene.render.resolution_y = 128
        scene.render.threads_mode = "FIXED"
        scene.render.threads = max(1, (os.cpu_count() or 4) - 2)
        scene.render.filepath = os.path.join(out, f"probe_{engine}.png")
        bpy.ops.render.render(write_still=True)
        return f"{os.path.getsize(scene.render.filepath)} bytes png"

    return _run


print("Blender", bpy.app.version_string, "| Python", sys.version.split()[0])
print("background:", bpy.app.background, "| cpu_count:", os.cpu_count())
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
print("engines:", engines)

check("save + reload .blend", save_and_reload)
check("export GLB", export_glb)
check("render CYCLES (CPU)", render("CYCLES"))
check("render BLENDER_WORKBENCH", render("BLENDER_WORKBENCH"))

print("\n=== RESULTS (temp dir: %s) ===" % out)
for name, status, detail, dt in results:
    print(f"[{status}] {name} ({dt:.1f}s) {detail}")
