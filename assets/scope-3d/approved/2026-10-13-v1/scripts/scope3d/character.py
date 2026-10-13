"""Assemble Scope's parts into the rest-pose character that rig.py then rigs.

  Scope_Shell        body + face glass + grown feet, one mesh (faceshell.py)
  Scope_Mouth        seated on the glass
  Scope_Antenna/Tip  flared stalk + ball, rooted on the crown
  Scope_Accent       hidden purple accent light
  SCOPE_FaceCenter   anchor at the centre of the face (camera framing, web anchor)

The eyes are built by rig.py directly as one mesh with shape keys. The empties
created here (SCOPE_Root/Body/AntennaPivot) only carry the rest transforms the
rig needs; rig.build() bakes them into the meshes and removes them.
"""

import bpy
from mathutils import Matrix, Vector

from . import faceshell as F
from . import geometry as G
from . import materials as M
from . import spec as S

P = S.P


def _collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def _empty(name, col, location, display="PLAIN_AXES", size=0.02):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.empty_display_size = size
    obj.location = location
    col.objects.link(obj)
    return obj


def _parent(child, parent, rest):
    child.parent = parent
    child.matrix_parent_inverse = rest.inverted()


def build():
    col = _collection("SCOPE")
    ceramic, glass, eye_mat = M.shell(P["shell_color"]), M.glass(), M.eye()
    # the shell goes first: with grown feet it re-grounds the body centre.
    # v3: body and face glass are one mesh (material slots: ceramic, glass)
    shell = F.build(col, ceramic, glass)

    root = _empty("SCOPE_Root", col, (0, 0, 0), "CIRCLE", 0.08)
    cz = P["shell_center_z"]
    body = _empty("SCOPE_Body", col, (0, 0, cz), "SPHERE", 0.02)
    body.parent = root
    body_rest = Matrix.Translation((0, 0, cz))

    face = _empty("SCOPE_FaceCenter", col, F.glass_point(0.0, P["display_center_z"]), "PLAIN_AXES", 0.01)

    mouth = G.build_mouth(col)
    M.assign(mouth, eye_mat)

    accent = G.build_accent(col)
    M.assign(accent, M.accent())
    accent.hide_render = True  # 2D: scale 0 until the cursor comes close

    stalk, tip, base = G.build_antenna(col)
    M.assign(stalk, ceramic)
    M.assign(tip, ceramic)
    pivot = _empty("SCOPE_AntennaPivot", col, base, "SINGLE_ARROW", 0.02)
    _parent(pivot, body, body_rest)
    pivot_rest = Matrix.Translation(base)
    for o in (stalk, tip):
        _parent(o, pivot, pivot_rest)

    for o in (shell, face, mouth, accent):
        _parent(o, body, body_rest)

    # the mouth sits on the glass (the 2D mouth: 11 mm under the eye centres)
    G.seat_on_glass(mouth, 0.0, P["display_center_z"] + P["mouth_dz"], 0.3 * S.MM)
    bpy.context.view_layer.update()
    return dict(root=root, body=body, mouth=mouth, shell=shell, face=face,
                antenna_pivot=pivot, antenna=(stalk, tip), accent=accent, eye_mat=eye_mat)
