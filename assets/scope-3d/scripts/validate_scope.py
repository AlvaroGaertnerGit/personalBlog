"""Automated checks on the rigged Scope. Every number in the report is measured.

Run:
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
      --python assets/scope-3d/scripts/validate_scope.py

Checks:
  1. skin       every shell vertex sums to 1; face glass 100% body; eyes 100% eye bones
  2. rest       every clip starts and ends exactly at rest (loops: start == end)
  3. ground     no shell vertex goes below the floor in any frame
  4. face       glass vertices move rigidly with the body (max deviation from the
                body bone's own transform), in every frame
  5. eyes       eye bones stay seated on the glass surface in every frame
  6. glTF       export exports/scope.glb (NLA tracks -> animations, shape keys ->
                morph targets, skin), re-import into a clean scene, counts
Writes reports/VALIDATION.md and exits non-zero if a check fails.
"""

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from scope3d import faceshell as F, geometry as G, spec as S  # noqa: E402
from scope3d.export import export_glb  # noqa: E402

ROOT = os.path.dirname(HERE)
BLEND = os.path.join(ROOT, "blender", "scope-master.blend")
GLB = os.path.join(ROOT, "exports", "scope.glb")
REPORT = os.path.join(ROOT, "reports", "VALIDATION.md")
MM = S.MM
results = []


def record(name, ok, detail):
    results.append((name, ok, detail))
    print(f"[validate] {'PASS' if ok else 'FAIL'} {name}: {detail}")


def assign(owner, action):
    ad = owner.animation_data
    ad.use_nla = False
    ad.action = action
    if action is not None and getattr(ad, "action_slot", None) is None and len(getattr(action, "slots", [])):
        ad.action_slot = action.slots[0]


def evaluated_coords(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    mesh = ev.to_mesh()
    co = np.empty(len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", co)
    ev.to_mesh_clear()
    return (np.array(obj.matrix_world) @ np.c_[co.reshape(-1, 3), np.ones(len(co) // 3)].T).T[:, :3]


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    scene = bpy.context.scene
    arm = bpy.data.objects["Scope_Rig"]
    shell = bpy.data.objects["Scope_Shell"]
    eyes = bpy.data.objects["Scope_Eyes"]
    keys = eyes.data.shape_keys
    S.apply_profile("sheet")
    # restore the grounded centres from the rig itself (body bone head)
    S.P["shell_center_z"] = arm.data.bones["body"].head_local.z
    S.P["display_center_z"] = S.P["shell_center_z"] + S.P["display_center_dz"]
    F.reset()

    # 1. skin -----------------------------------------------------------------
    gi = {g.index: g.name for g in shell.vertex_groups}
    sums = np.array([sum(g.weight for g in v.groups) for v in shell.data.vertices])
    record("skin: shell weights sum to 1", bool(np.all(np.abs(sums - 1) < 1e-4)),
           f"min {sums.min():.5f}, max {sums.max():.5f}")
    glass_verts = sorted({vi for p in shell.data.polygons if p.material_index == 1 for vi in p.vertices})
    bad = 0
    for vi in glass_verts:
        ws = {gi[g.group]: g.weight for g in shell.data.vertices[vi].groups}
        if abs(ws.get("body", 0) - 1) > 1e-5 or len([w for w in ws.values() if w > 1e-5]) != 1:
            bad += 1
    record("skin: face glass 100% body", bad == 0, f"{len(glass_verts)} glass vertices, {bad} off")
    egi = {g.index: g.name for g in eyes.vertex_groups}
    ebad = sum(1 for v in eyes.data.vertices
               if len(v.groups) != 1 or egi[v.groups[0].group] not in ("eye.L", "eye.R") or v.groups[0].weight != 1.0)
    record("skin: eyes 100% eye bones", ebad == 0, f"{len(eyes.data.vertices)} eye vertices, {ebad} off")

    # rest-space glass positions, for the rigidity check
    rest_glass = np.array([tuple(shell.data.vertices[i].co) for i in glass_verts])
    body_rest = arm.data.bones["body"].matrix_local

    actions = sorted(a.name for a in bpy.data.actions if not a.name.endswith("__eyes"))
    worst_ground, worst_face, worst_eye, rest_fail = 1.0, 0.0, 0.0, []
    proud = G.EYE_THICKNESS * 0.18
    for name in actions:
        act = bpy.data.actions[name]
        assign(arm, act)
        assign(keys, bpy.data.actions[name + "__eyes"])
        fr = act.frame_range
        first, last = int(fr[0]), int(fr[1])

        def pose_state():
            vals = []
            for pb in arm.pose.bones:
                vals += list(pb.location) + list(pb.rotation_quaternion) + list(pb.scale)
            vals += [kb.value for kb in keys.key_blocks[1:]]
            return np.array(vals)

        scene.frame_set(first)
        a = pose_state()
        scene.frame_set(last)
        b = pose_state()
        rest = np.array(sum(([0, 0, 0, 1, 0, 0, 0, 1, 1, 1] for _ in arm.pose.bones), []) + [0, 0], float)
        if act.get("scope_loop"):
            dev = float(np.max(np.abs(a - b)))
            # quaternions: q and -q are the same rotation; loops are periodic by construction
            ok = dev < 2e-3
        else:
            dev = max(float(np.max(np.abs(a - rest))), float(np.max(np.abs(b - rest))))
            ok = dev < 1e-3
        if not ok:
            rest_fail.append(f"{name} ({dev:.4f})")

        for f in range(first, last + 1):
            scene.frame_set(f)
            co = evaluated_coords(shell)
            worst_ground = min(worst_ground, float(co[:, 2].min()))
            # face rigidity: expected = body pose matrix (armature space) applied to rest
            body_pose = arm.matrix_world @ arm.pose.bones["body"].matrix @ body_rest.inverted()
            exp = (np.array(body_pose) @ np.c_[rest_glass, np.ones(len(rest_glass))].T).T[:, :3]
            worst_face = max(worst_face, float(np.max(np.linalg.norm(co[glass_verts] - exp, axis=1))))
            # eye seating: eye bone head back in body rest space vs glass surface
            inv = (arm.matrix_world @ arm.pose.bones["body"].matrix @ body_rest.inverted()).inverted()
            for side in ("eye.L", "eye.R"):
                head = inv @ (arm.matrix_world @ arm.pose.bones[side].head)
                n = F.glass_normal(head.x, head.z)
                surface = F.glass_point(head.x, head.z)
                worst_eye = max(worst_eye, abs((head - surface).dot(n) - proud))
    record("rest: clips start/end at rest", not rest_fail,
           f"{len(actions)} clips checked" + (f"; off: {', '.join(rest_fail)}" if rest_fail else ""))
    record("ground: no vertex below the floor", worst_ground > -0.3 * MM,
           f"lowest shell vertex over all frames: {worst_ground / MM:+.2f} mm")
    record("face: glass rigid with the body", worst_face < 0.05 * MM,
           f"max deviation {worst_face / MM:.4f} mm")
    record("eyes: seated on the glass", worst_eye < 0.35 * MM,
           f"max seat error {worst_eye / MM:.3f} mm")

    # 6. glTF export ----------------------------------------------------------------
    export_glb(GLB)
    size_kb = os.path.getsize(GLB) / 1024
    with open(GLB, "rb") as fh:
        data = fh.read()
    jlen = int.from_bytes(data[12:16], "little")
    gltf = json.loads(data[20:20 + jlen])
    anims = [a.get("name") for a in gltf.get("animations", [])]
    morph = sum(len(p.get("targets", [])) for m in gltf.get("meshes", []) for p in m["primitives"])
    joints = sum(len(s["joints"]) for s in gltf.get("skins", []))
    morph_anims = sum(1 for a in gltf.get("animations", []) for c in a["channels"] if c["target"]["path"] == "weights")
    expected = set(actions)
    record("glTF: one animation per clip", expected <= set(anims),
           f"{len(anims)} animations: {', '.join(sorted(anims))}")
    record("glTF: morph targets + morph animation", morph >= 2 and morph_anims >= len(expected),
           f"{morph} morph targets, {morph_anims} weight channels")
    record("glTF: skin", joints >= 10, f"{joints} joints, file {size_kb:.0f} KB (not web-optimised: no compression, no baked textures)")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    imported = [a.name for a in bpy.data.actions]
    record("glTF: re-import", len(imported) >= len(expected),
           f"{len(imported)} actions after import, {len(bpy.data.objects)} objects")

    write_report()
    if not all(ok for _n, ok, _d in results):
        sys.exit(1)


def write_report():
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    lines = ["# Scope 3D — validación", "",
             "Generado por `scripts/validate_scope.py` sobre `blender/scope-master.blend`. "
             "Todos los valores son medidos, no estimados.", "",
             "| Comprobación | Resultado | Detalle |", "|---|---|---|"]
    for name, ok, detail in results:
        lines.append(f"| {name} | {'✅ PASS' if ok else '❌ FAIL'} | {detail} |")
    with open(REPORT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print("[validate] report", REPORT)


main()
