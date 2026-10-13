"""Studio: world, floor, lights, cameras and CPU-only render settings.

Lighting follows VISUAL_LANGUAGE.md ("warm indirect lighting, minimal
reflections") and the reference sheet's dark presentation, which also matches
the site's dark theme. Everything is CPU Cycles: Workbench/EEVEE need a GPU
context and crash on this machine (see reports/ENVIRONMENT.md).
"""

import math
import os

import bpy
from mathutils import Vector

TARGET = Vector((0.0, 0.0, 0.098))  # roughly the visual centre of Scope incl. antenna


def _collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def world(color=(0.0028, 0.0040, 0.0080), strength=1.0):  # the sheet's deep navy
    w = bpy.context.scene.world or bpy.data.worlds.new("Studio")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*color, 1.0)
    bg.inputs["Strength"].default_value = strength


def floor(col):
    bpy.ops.mesh.primitive_plane_add(size=4.0)  # data-only op, fine headless
    obj = bpy.context.object
    obj.name = "Studio_Floor"
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)
    mat = bpy.data.materials.new("Studio_Floor")
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.0035, 0.0035, 0.0045, 1)
    bsdf.inputs["Roughness"].default_value = 0.7
    bsdf.inputs["Specular IOR Level"].default_value = 0.15  # no grey glare: the sheet's floor is near-black
    obj.data.materials.append(mat)
    return obj


def _area(col, name, location, power, size, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    col.objects.link(obj)
    obj.location = location
    direction = TARGET - Vector(location)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


# Light rigs. "warm" matches the design sheet (warm key, cool blue rim); "cool"
# is a daylight-ish check that the beige and the mineral grain survive a
# neutral/cold environment (the site's light theme). Sizes are large on purpose:
# a glossy face reflects the light's shape, and big sources give broad, soft
# reflections instead of crisp white rectangles.
LIGHT_RIGS = {
    "warm": [
        ("Light_Key", (-0.42, -0.50, 0.48), 8.0, 0.7, (1.0, 0.86, 0.70)),
        ("Light_Fill", (0.55, -0.45, 0.16), 2.4, 0.9, (1.0, 0.97, 0.94)),
        ("Light_Rim", (0.40, 0.50, 0.30), 9.0, 0.35, (0.70, 0.82, 1.0)),
        ("Light_Top", (0.0, 0.05, 0.75), 2.4, 0.9, (1.0, 1.0, 1.0)),
    ],
    "cool": [
        ("Light_Key", (-0.42, -0.50, 0.48), 8.0, 0.7, (0.86, 0.93, 1.0)),
        ("Light_Fill", (0.55, -0.45, 0.16), 2.6, 0.9, (0.92, 0.96, 1.0)),
        ("Light_Rim", (0.40, 0.50, 0.30), 7.0, 0.35, (1.0, 0.92, 0.85)),
        ("Light_Top", (0.0, 0.05, 0.75), 3.0, 0.9, (0.9, 0.95, 1.0)),
    ],
}


def lights(col, rig="warm"):
    for name, loc, power, size, color in LIGHT_RIGS[rig]:
        _area(col, name, loc, power, size, color)


def set_light_rig(rig):
    """Retint/re-power the existing studio lights in place (same positions)."""
    for name, _loc, power, size, color in LIGHT_RIGS[rig]:
        light = bpy.data.objects[name].data
        light.energy, light.size, light.color = power, size, color


# name -> (direction from target toward the eye, orthographic?[, options])
# options: distance (m), target_object (frame that object's bbox centre).
# "left/right" are SCOPE's own sides: Scope faces -Y, so its left is +X.
VIEWS = {
    "front": ((0, -1, 0), True),
    "profile-left": ((1, 0, 0), True),
    "profile-right": ((-1, 0, 0), True),
    "back": ((0, 1, 0), True),
    "top": ((0, -0.0001, 1), True),
    "three-quarter": ((0.62, -0.78, 0.16), False),
    "high-three-quarter": ((0.5, -0.66, 0.56), False),
    "hero": ((0.34, -0.92, 0.2), False),  # the sheet's hero angle (face turned to image-left)
    "focus": ((0.18, -1.0, 0.30), False),  # the sheet's FOCUS panel: front, slightly above
    # the face cavity up close, slightly from above and the side, so the brow
    # edge, cheek walls and chin rim all read
    "face-closeup": ((0.30, -1.0, 0.22), False, dict(distance=0.30, target_object=("SCOPE_FaceCenter",))),
}
ORTHO_SCALE = 0.255
PERSP_LENS = 85
PERSP_DISTANCE = 0.66


def _bbox_centre(names):
    obj = next((bpy.data.objects[n] for n in names if n in bpy.data.objects), None)
    if obj is None:
        return TARGET
    if obj.type == "EMPTY":
        return obj.matrix_world.translation.copy()
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(corners, Vector()) / 8


def camera(col, view):
    direction, ortho, *rest = VIEWS[view]
    opts = rest[0] if rest else {}
    target = _bbox_centre(opts["target_object"]) if "target_object" in opts else TARGET
    data = bpy.data.cameras.new(f"Cam_{view}")
    obj = bpy.data.objects.new(f"Cam_{view}", data)
    col.objects.link(obj)
    d = Vector(direction).normalized()
    if ortho:
        data.type = "ORTHO"
        data.ortho_scale = ORTHO_SCALE
        obj.location = target + d * 1.2
    else:
        data.lens = PERSP_LENS
        obj.location = target + d * opts.get("distance", PERSP_DISTANCE)
    data.clip_start, data.clip_end = 0.01, 10
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def replace():
    """Delete the STUDIO collection's contents and rebuild it with the current
    code — lets two saved versions be rendered under identical cameras/lights."""
    col = bpy.data.collections.get("STUDIO")
    if col:
        for o in list(col.objects):
            bpy.data.objects.remove(o)
    return build()


def build(views=VIEWS):
    col = _collection("STUDIO")
    world()
    floor(col)
    lights(col)
    return {v: camera(col, v) for v in views}


def render_settings(resolution=640, samples=48, threads=None):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        pass
    scene.cycles.max_bounces = 6
    scene.render.resolution_x = scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.threads_mode = "FIXED"
    # leave headroom so the machine stays responsive during renders
    scene.render.threads = threads or max(1, (os.cpu_count() or 4) - 4)
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"


def bloom(strength=0.55, threshold=0.9, size=0.6):
    """Compositor bloom for the eyes' "soft bloom" (VISUAL_LANGUAGE.md).

    Cycles has no bloom of its own; this runs in the CPU compositor. Blender 5.x
    uses a node group + Group Output instead of the old scene.node_tree.
    """
    scene = bpy.context.scene
    tree = bpy.data.node_groups.get("Studio_Comp")
    if tree is None:
        tree = bpy.data.node_groups.new("Studio_Comp", "CompositorNodeTree")
        tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        rl = tree.nodes.new("CompositorNodeRLayers")
        glare = tree.nodes.new("CompositorNodeGlare")
        out = tree.nodes.new("NodeGroupOutput")
        tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
        tree.links.new(glare.outputs["Image"], out.inputs[0])
    glare = next(n for n in tree.nodes if n.bl_idname == "CompositorNodeGlare")
    glare.inputs["Type"].default_value = "Bloom"
    glare.inputs["Threshold"].default_value = threshold
    glare.inputs["Strength"].default_value = strength
    glare.inputs["Size"].default_value = size
    scene.compositing_node_group = tree
    try:
        scene.render.compositor_device = "CPU"
    except (AttributeError, TypeError):
        pass


def render(camera_obj, path):
    scene = bpy.context.scene
    scene.camera = camera_obj
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
