"""Exports the Entrega 2 environment (no approved world: that is world.glb) for the
real-time viewer: the relief decimated for the web, groves, waves, arches, towers,
the ink lake and Scope's places. Materials keep their names; the viewer rebuilds
the paper ones (ruled lines that dissolve, translucency) in its own shaders.

  blender --background --factory-startup --python docs/redesign/scope-world/entrega-2-entorno/blender/export_env.py -- \
      --out docs/redesign/scope-world/entrega-2-entorno/visor/assets/entorno.glb [--ratio 0.12]
"""

import os
import random
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

import entorno2 as E2  # noqa: E402

B = E2.B


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = {"out": os.path.join(HERE, "..", "visor", "assets", "entorno.glb"), "ratio": 0.12}
    it = iter(argv)
    for a in it:
        k = a.lstrip("-")
        o[k] = float(next(it)) if k == "ratio" else next(it)
    return o


def simple(name, color, rough=0.85):
    """A plain material the glTF exporter can carry (the viewer replaces it by name)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = B.principled(m.node_tree)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def main():
    o = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    col = B.collection("ENV_EXPORT")
    rnd = random.Random(23)  # same seed and order as the renders
    relief = E2.Relief()
    land = E2.relief_mesh(col, simple("Paper_World", B.PAPER), relief)
    dec = land.modifiers.new("web", "DECIMATE")
    dec.ratio = o["ratio"]
    sheet_m, wave_m = simple("Paper_Standing", (0.86, 0.83, 0.77)), simple("Paper_Wave", (0.84, 0.81, 0.75))
    # E.lantern/E.cabinet build their own (exportable) solid materials; paper ones are renamed below
    E2.build_environment(col, rnd, relief.height, sheet_m, wave_m, 0.0)
    for ob in col.objects:
        for slot in ob.material_slots:
            if slot.material and slot.material.name.startswith("Paper_Lantern"):
                slot.material = simple("Paper_Lantern", (0.86, 0.82, 0.74))
            if slot.material and slot.material.name.startswith("Trail_Graphite"):
                slot.material = simple("Trail_Graphite", (0.14, 0.14, 0.16), 0.6)
    lights = [ob for ob in col.objects if ob.type == "LIGHT"]
    for ob in lights:
        bpy.data.objects.remove(ob, do_unlink=True)
    out = os.path.abspath(o["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_yup=True,
                              export_lights=False, export_cameras=False, export_extras=False)
    tris = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in col.objects:
        if ob.type == "MESH":
            me = ob.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            ob.evaluated_get(dg).to_mesh_clear()
    print(f"[export_env] {out} {os.path.getsize(out) / 1024:.0f} KB, {tris} triangles, {len(col.objects)} objects")


if __name__ == "__main__":
    main()
