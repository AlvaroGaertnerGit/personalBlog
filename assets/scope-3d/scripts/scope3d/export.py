"""glTF 2.0 export of the rigged Scope (shared by export_scope.py and validate_scope.py).

What goes in: the skinned meshes, the armature, the face anchor, the eye shape
keys as morph targets, and one animation per clip — the exporter merges each
clip's NLA tracks (armature + eye shape keys) by name.

What does NOT go in yet (pending web optimisation, see SCOPE_3D_ANIMATION.md §6):
the procedural mineral texture (exports as a flat base colour until it is
baked to textures), compression (Draco/meshopt), and the retopologised mesh.
The studio (cameras, lights, floor) is never exported.
"""

import os

import bpy


def export_glb(path):
    arm = bpy.data.objects["Scope_Rig"]
    keys = bpy.data.objects["Scope_Eyes"].data.shape_keys
    for o in bpy.data.objects:
        o.select_set(o.name.startswith(("Scope_", "SCOPE_")) and not o.hide_render)
    # NLA tracks carry the clips; no active action, NLA evaluation on
    for owner in (arm, keys):
        owner.animation_data.action = None
        owner.animation_data.use_nla = True
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_animation_mode="NLA_TRACKS", export_morph=True, export_skins=True,
        export_morph_animation=True, export_optimize_animation_size=True,
        export_image_format="NONE",
    )
    return path
