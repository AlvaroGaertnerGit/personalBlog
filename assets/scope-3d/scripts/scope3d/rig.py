"""Scope's rig: armature, skin weights, and the eyes as one mesh with shape keys.

Built on the approved v3 geometry (character.build), never re-modelled.

Bone hierarchy (every bone points +Z, roll 0, so bone-local axes are
x = world X, y = world Z (up), z = world -Y (toward the viewer)):

  root                 ground; the web moves/places Scope through this
  └─ hop               vertical travel for jumps (pivot on the ground)
     └─ squash         volume-preserving squash & stretch, pivot on the ground
        ├─ look        RESERVED for the web: procedural yaw/pitch toward the
        │  │           cursor. Never keyed in a clip, so code can own it.
        │  └─ body     clip-driven tilt/turn/lean, pivot at the shell centre
        │     ├─ eye.L / eye.R   gaze (translation on the glass), height (scale)
        │     ├─ mouth           width (scale)
        │     └─ antenna.1 └─ antenna.2   two-segment flexible antenna
        └─ foot.FL / FR / BL / BR        planted feet (children of squash, not
                                          body: they stay put while the body leans)

Skin: the whole face (glass + rim) is weighted 100% to `body`, so the cavity
moves rigidly with the body and only ever deforms by the body's own affine
squash — it can't tear, slide or intersect. Feet blend body -> foot bone from
the filleted base to the tip (weights recorded by faceshell.py).

"Left/right" are Scope's own sides (Scope faces -Y, so its left is +X).
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import faceshell as F
from . import geometry as G
from . import spec as S

P = S.P
MM = S.MM

DEFORM = {"body", "eye.L", "eye.R", "mouth", "antenna.1", "antenna.2",
          "foot.FL", "foot.FR", "foot.BL", "foot.BR"}


def _bake_world(obj):
    """Move an object's world transform into its mesh data and unparent it."""
    mw = obj.matrix_world.copy()
    obj.parent = None
    obj.data.transform(mw)
    obj.matrix_world = Matrix.Identity(4)


# --- Eyes: one mesh, two halves, shape keys ------------------------------------
# The glass is opaque, so whatever part of an eye sinks under it is cut away.
# v1 seated a FLAT lens on the CURVED glass: its outline grazed the surface, so
# the glass already cut ~6 % off the top and ~11 % off the bottom at rest, and
# every gaze shift, squint, blink or laugh moved that cut line — the "pixels
# crawling over the face" (outline up to 1.6 mm under the glass, measured;
# reports/POLISH_REVIEW.md). v2 lays every eye shape ON the glass (wrapped, with
# a constant clearance) and the eye bones turn with the glass normal, so the
# glass never cuts an eye. Sizes keep the v1 look that was approved: the visible
# height and centre measured at rest, not the uncut 26 mm capsule.
EYE_PROUD = 0.5 * MM  # outline clearance over the glass (v1: 0.4 mm at the centre only)
EYE_VISIBLE_H = 23.7 * MM            # v1 visible height at rest (12.2 up + 11.5 down)
EYE_VISIBLE_DZ = 0.35 * MM           # v1 visible centre, above the seat point
# Widening (eye_h > 1, e.g. Focus/observe 1.15) is the `Tall` shape key, laid on
# the glass like the others: a bone scale stretches the eye in a straight line
# and its tips leave the curved glass (measured: 0.35 mm under at 1.15).
# Squinting (eye_h < 1) stays a bone scale — it pulls the tips inward, away
# from the glass.
EYE_TALL = 1.15


def eye_seat(side):
    """(x, z) where an eye's centre sits on the glass at rest."""
    sign = 1 if side == "eye.L" else -1
    return sign * P["eye_dx"], P["display_center_z"] + P["eye_dz"] + EYE_VISIBLE_DZ


def glass_frame(x, z):
    """Surface point, outward normal and in-plane axes (across, up) of the glass at (x, z)."""
    n = F.glass_normal(x, z)
    rot = Vector((0, -1, 0)).rotation_difference(n).to_matrix()
    return F.glass_point(x, z), n, rot @ Vector((1, 0, 0)), rot @ Vector((0, 0, 1))


def _wrap_on_glass(x0, z0, co):
    """Eye-frame point (x across, z up, -y out of the glass) -> rest space, laid
    on the curved glass: (x, z) walk along the surface from the seat, depth
    stays along the local normal."""
    p0, _n0, ex, ez = glass_frame(x0, z0)
    q = p0 + ex * co.x + ez * co.z
    s, n = F.glass_point(q.x, q.z), F.glass_normal(q.x, q.z)
    return s + n * (EYE_PROUD - co.y)


def _eye_shapes(local):
    """Basis / Blink / Laugh / Tall positions for one eye, in the eye's own frame
    (x across, y depth with -y toward the viewer, z up).

    Blink: the pill closes to a thin horizontal line — the same height-only
    blink as the 2D eyes (scaleY -> 0.08), as a smooth morph, not a cut.
    Laugh: the pill bends into a luminous arc (∩). Mapping x -> angle along the
    arc and z -> band thickness keeps the morph smooth and gives the arc
    softly tapered ends. Approved exception to the "no eye shape swap" canon
    (owner, 2026-10-13); used ONLY by the Laugh reaction.
    """
    w, h = P["eye_w"], EYE_VISIBLE_H
    half_w, half_h = w / 2, h / 2
    blink, laugh, tall = [], [], []
    arc_deg, band = 70.0, 3.2 * MM
    radius = 0.62 * P["eye_h"] / 2  # arc radius (approved arc size)
    top = radius + band / 2
    low = (radius - band / 2) * math.cos(math.radians(arc_deg))
    zshift = (top + low) / 2
    for co in local:
        u = max(-1.0, min(1.0, co.x / half_w))
        v = max(-1.0, min(1.0, co.z / half_h))
        blink.append(Vector((co.x * 1.04, co.y * 0.8, co.z * 0.085)))
        a = math.radians(arc_deg) * u
        r = radius + v * band / 2
        laugh.append(Vector((r * math.sin(a), co.y * 0.8, r * math.cos(a) - zshift)))
        tall.append(Vector((co.x, co.y, co.z * EYE_TALL)))
    return blink, laugh, tall


def build_eyes(collection, eye_mat):
    """Both eyes as one skinned mesh carrying the Blink / Laugh shape keys."""
    w, h = P["eye_w"], EYE_VISIBLE_H
    bm_local = G.capsule_bmesh(w / 2, G.EYE_THICKNESS / 2, w / 2, (h - w) / 2, "Z")
    local = [v.co.copy() for v in bm_local.verts]
    faces = [[v.index for v in f.verts] for f in bm_local.faces]
    bm_local.free()
    shapes = dict(zip(("Blink", "Laugh", "Tall"), _eye_shapes(local)))

    verts, all_faces, groups, centres = [], [], {}, {}
    shape_verts = {name: [] for name in shapes}
    for side in ("eye.R", "eye.L"):  # Scope's right eye is at -X
        x, z = eye_seat(side)
        offset = len(verts)
        verts += [_wrap_on_glass(x, z, c) for c in local]
        for name, coords in shapes.items():
            shape_verts[name] += [_wrap_on_glass(x, z, c) for c in coords]
        all_faces += [[i + offset for i in f] for f in faces]
        groups[side] = list(range(offset, offset + len(local)))
        centres[side] = _wrap_on_glass(x, z, Vector())

    mesh = bpy.data.meshes.new("Scope_Eyes")
    mesh.from_pydata([tuple(v) for v in verts], [], all_faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(eye_mat)
    obj = bpy.data.objects.new("Scope_Eyes", mesh)
    collection.objects.link(obj)
    obj.shape_key_add(name="Basis")
    for name, coords in shape_verts.items():
        kb = obj.shape_key_add(name=name, from_mix=False)
        for i, c in enumerate(coords):
            kb.data[i].co = c
    for side, idx in groups.items():
        obj.vertex_groups.new(name=side).add(idx, 1.0, "REPLACE")
    return obj, centres


# --- Armature ---------------------------------------------------------------------
def build(objs):
    """objs: the dict returned by character.build(). Returns the rig dict."""
    col = bpy.data.collections["SCOPE"]
    scene = bpy.context.scene
    bpy.context.view_layer.update()

    cz = P["shell_center_z"]
    antenna_base = objs["antenna_pivot"].matrix_world.translation.copy()
    stalk, tip = objs["antenna"]
    mouth = objs["mouth"]
    mouth_centre = mouth.matrix_world.translation.copy()
    eye_mat = objs["eye_mat"]

    for o in (objs["shell"], mouth, stalk, tip, objs["accent"]):
        _bake_world(o)
    tip_centre = sum((Vector(v.co) for v in tip.data.vertices), Vector()) / len(tip.data.vertices)

    eyes, eye_centres = build_eyes(col, eye_mat)

    face_anchor = objs["face"]
    face_world = face_anchor.matrix_world.translation.copy()
    for name in ("SCOPE_Body", "SCOPE_AntennaPivot", "SCOPE_Root"):
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name])

    arm_data = bpy.data.armatures.new("Scope_Rig")
    arm = bpy.data.objects.new("Scope_Rig", arm_data)
    col.objects.link(arm)
    arm.show_in_front = True
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def bone(name, head, length, parent=None):
        b = eb.new(name)
        b.head = head
        b.tail = Vector(head) + Vector((0, 0, length))
        b.roll = 0.0
        b.use_connect = False
        b.use_deform = name in DEFORM
        if parent:
            b.parent = eb[parent]
        return b

    origin = Vector((0, 0, 0))
    bone("root", origin, 0.04)
    bone("hop", origin, 0.03, "root")
    bone("squash", origin, 0.025, "hop")
    bone("look", (0, 0, cz), 0.02, "squash")
    bone("body", (0, 0, cz), 0.035, "look")
    bone("eye.L", eye_centres["eye.L"], 0.012, "body")
    bone("eye.R", eye_centres["eye.R"], 0.012, "body")
    bone("mouth", mouth_centre, 0.008, "body")
    mid = antenna_base.lerp(tip_centre, 0.5)
    bone("antenna.1", antenna_base, (mid - antenna_base).length, "body")
    bone("antenna.2", mid, (tip_centre - mid).length, "antenna.1")
    for anchor, *_ in G._feet_frames():
        bone(F.foot_name(anchor), anchor, 0.015, "squash")
    bpy.ops.object.mode_set(mode="OBJECT")

    # --- skin -----------------------------------------------------------------
    shell = objs["shell"]
    _body_group_remainder(shell)
    _single_group(objs["accent"], "body")
    _single_group(mouth, "mouth")
    _antenna_groups(stalk, tip, antenna_base, tip_centre)
    for o in (shell, eyes, mouth, stalk, tip, objs["accent"]):
        mod = o.modifiers.new("Rig", "ARMATURE")
        mod.object = arm
        o.parent = arm
        o.matrix_parent_inverse = Matrix.Identity(4)

    # the face anchor rides on the body bone (camera framing, web anchor)
    face_anchor.parent = arm
    face_anchor.parent_type = "BONE"
    face_anchor.parent_bone = "body"
    face_anchor.matrix_world = Matrix.Translation(face_world)

    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    arm["scope_rig_version"] = 1
    return dict(arm=arm, shell=shell, eyes=eyes, mouth=mouth, antenna=(stalk, tip),
                accent=objs["accent"], eye_mat=eye_mat)


def _single_group(obj, name):
    obj.vertex_groups.new(name=name).add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")


def _body_group_remainder(shell):
    """body = 1 - sum(feet) so every shell vertex sums to exactly 1."""
    feet = [g for g in shell.vertex_groups if g.name.startswith("foot.")]
    body = shell.vertex_groups.new(name="body")
    idx_feet = {g.index for g in feet}
    for v in shell.data.vertices:
        total = sum(g.weight for g in v.groups if g.group in idx_feet)
        if total > 1.0:  # feet never overlap in practice; normalise just in case
            for g in v.groups:
                if g.group in idx_feet:
                    g.weight /= total
            total = 1.0
        if total < 1.0 - 1e-6:
            body.add([v.index], 1.0 - total, "REPLACE")


def _antenna_groups(stalk, tip, base, tip_centre):
    """Lower stalk follows antenna.1, upper stalk and ball follow antenna.2."""
    g1 = stalk.vertex_groups.new(name="antenna.1")
    g2 = stalk.vertex_groups.new(name="antenna.2")
    span = (tip_centre - base)
    for v in stalk.data.vertices:
        s = (Vector(v.co) - base).dot(span) / span.length_squared
        w2 = G.smoothstep((s - 0.3) / 0.45)
        if w2 < 1.0:
            g1.add([v.index], 1.0 - w2, "REPLACE")
        if w2 > 0.0:
            g2.add([v.index], w2, "REPLACE")
    _single_group(tip, "antenna.2")
