"""Procedural geometry helpers for Scope — pure bmesh/bpy.data, no operators.

Every part derives from one analytic shell surface (a tapered ellipsoid with an
eased-flat underside) so the parts always agree with each other. The shell
mesh itself (body + face glass + grown feet as one surface) is built in
faceshell.py; this module holds the surface maths and the smaller parts:

  feet     grown out of the shell (displacement + skin-weight factors)
  mouth    tiny horizontal capsule, seated on the glass
  antenna  tapered swept tube with a flared root + ball tip
  accent   the hidden purple accent light

All dimensions come from spec.P.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import spec as S

P = S.P  # active profile (mutated in place by spec.apply_profile)


def smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


# --- Analytic shell surface ---------------------------------------------------------
def _taper(zr):
    return 1 - P["shell_taper"] * zr


def shell_field(p):
    """Implicit function: < 0 inside, 0 on the (un-flattened) shell, > 0 outside."""
    zr = (p.z - P["shell_center_z"]) / P["shell_rz"]
    t = _taper(zr)
    return (p.x / (P["shell_rx"] * t)) ** 2 + (p.y / (P["shell_ry"] * t)) ** 2 + zr ** 2 - 1


def inward_normal(p, eps=1e-4):
    g = Vector((
        shell_field(p + Vector((eps, 0, 0))) - shell_field(p - Vector((eps, 0, 0))),
        shell_field(p + Vector((0, eps, 0))) - shell_field(p - Vector((0, eps, 0))),
        shell_field(p + Vector((0, 0, eps))) - shell_field(p - Vector((0, 0, eps))),
    ))
    return -g.normalized()


def front_point(x, z):
    """Front (-Y) point of the un-carved shell at (x, z)."""
    zr = (z - P["shell_center_z"]) / P["shell_rz"]
    t = _taper(zr)
    k = 1 - (x / (P["shell_rx"] * t)) ** 2 - zr ** 2
    return Vector((x, -P["shell_ry"] * t * math.sqrt(max(k, 0.0)), z))


def _surface_z(x, y, sign):
    """Top (sign=+1) or underside (sign=-1) z of the shell above (x, y), flattening included."""
    zr = 0.0
    for _ in range(8):  # taper depends on zr: fixed-point iterate
        t = _taper(zr)
        k = 1 - (x / (P["shell_rx"] * t)) ** 2 - (y / (P["shell_ry"] * t)) ** 2
        zr = sign * math.sqrt(max(k, 0.0))
    return P["shell_center_z"] + zr * P["shell_rz"] + (_flatten_lift(zr) if sign < 0 else 0.0)


def top_z(x, y):
    return _surface_z(x, y, +1)


def underside_z(x, y):
    return _surface_z(x, y, -1)


def _flatten_lift(zr):
    band = P["bottom_band"]
    if zr >= -1 + band:
        return 0.0
    return P["bottom_lift"] * smoothstep(((-1 + band) - zr) / band) ** 1.5


# --- Feet grown from the shell ------------------------------------------------------------
def _feet_frames():
    frames = []
    for f in P["feet"]:
        a = math.radians(f["angle"])
        x, y = math.sin(a) * P["shell_rx"] * f["radial"], -math.cos(a) * P["shell_ry"] * f["radial"]
        anchor = Vector((x, y, underside_z(x, y)))
        axis = (-inward_normal(anchor) + Vector((0, 0, -0.85))).normalized()  # splayed: outward + down
        frames.append((anchor, axis, f["radius"], f["length"], f.get("profile", 1.6), f.get("fillet", 0.0)))
    return frames


def grow_feet(p, frames, factors=None):
    """Displace shell points near each anchor along the foot axis: a rounded,
    slightly conical nub with a filleted base — the foot IS the shell.

    `factors`, if given, receives one value per frame: how much of that foot
    this point belongs to (0 body .. 1 foot tip) — the rig's skin weights."""
    for frame in frames:
        anchor, axis, radius, length, expo = frame[:5]
        fillet = frame[5] if len(frame) > 5 else 0.0
        reach = radius * (1.5 if fillet else 1.0)
        w = p - anchor
        t = w.dot(axis)
        if t < -reach:
            if factors is not None:
                factors.append(0.0)
            continue
        q = (w - axis * t).length
        if q >= reach and factors is not None:
            factors.append(0.0)
        if q < reach:
            # expo ~1: conical flanks; higher: bell-shaped. The raw profile is
            # overdriven then soft-capped so the tip is a blunt rounded pad,
            # not a point (the sheet's feet are nubs). `fillet` adds a wide, low
            # skirt so the foot swells out of the body instead of meeting it at
            # a crease.
            f = 1.35 * (1 - (q / radius) ** 2) ** expo if q < radius else 0.0
            if fillet:
                f += fillet * (1 - (q / reach) ** 2) ** 3
            f = f - 0.5 * max(0.0, f - 0.7) ** 2 / 0.65 if f > 0.7 else f
            p = p + axis * (length * min(f, 1.0))
            if factors is not None:
                factors.append(min(f, 1.0))
    return p


# --- Mesh helpers ----------------------------------------------------------------------
def _new_object(name, bm, collection, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


def _uv_sphere(segments, rings):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    return bm


def capsule_bmesh(radius_x, radius_y, radius_z, half_length, axis="Z", segments=40, rings=24):
    """Capsule (stadium silhouette): sphere halves pushed apart along `axis`."""
    bm = _uv_sphere(segments, rings)
    idx = "XYZ".index(axis)
    radii = (radius_x, radius_y, radius_z)
    for v in bm.verts:
        co = [v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2]]
        if abs(co[idx]) > 1e-9:
            co[idx] += math.copysign(half_length, co[idx])
        v.co = Vector(co)
    return bm


# --- Parts -------------------------------------------------------------------------------
EYE_THICKNESS = 2.2 * S.MM


def build_mouth(collection):
    w, h = P["mouth_w"], P["mouth_h"]
    bm = capsule_bmesh(h / 2, 1.2 * S.MM, h / 2, (w - h) / 2, "X", 24, 12)
    return _new_object("Scope_Mouth", bm, collection)


def seat_on_glass(obj, x, z, proud, scale_z=1.0):
    """Place `obj` (local -Y = its front) on the glass at (x, z), facing out.

    Writes matrix_basis: parts are parented to the body pivot with
    parent-inverse = rest pose, so basis is rest-world space.
    """
    from . import faceshell as F  # the glass lives on the shell mesh

    n = F.glass_normal(x, z)
    p = F.glass_point(x, z) + n * proud
    q = Vector((0, -1, 0)).rotation_difference(n)
    obj.matrix_basis = Matrix.Translation(p) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((1.0, 1.0, scale_z, 1.0))


def _antenna_points():
    """(p0, p1, p2, tip_centre) in metres: offsets from the crown."""
    a = P["antenna"]
    bx, by = a["base_offset"]
    z0 = top_z(bx, by)
    p0 = Vector((bx, by, z0))
    p1 = Vector((a["rise"][0], by - 2 * S.MM, z0 + a["rise"][1]))
    p2 = Vector((a["top"][0], by - 4 * S.MM, z0 + a["top"][1]))
    tip = p2 + Vector((0, 0, a["tip_lift"]))
    return p0, p1, p2, tip


def build_antenna(collection):
    """Quadratic stroke -> cubic bezier, swept as a tapered tube, plus ball tip."""
    a = P["antenna"]
    p0, p1, p2, tip_c = _antenna_points()
    flare = a["root_flare"]
    # root the stalk inside the shell, straight down the surface normal so the
    # wide flared base can't poke out of the side
    sink = inward_normal(p0) * 5 * S.MM
    c1, c2 = p0 + (p1 - p0) * (2 / 3), p2 + (p1 - p2) * (2 / 3)

    curve = bpy.data.curves.new("Scope_AntennaCurve", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = a["radius"]
    curve.bevel_resolution = 6
    curve.resolution_u = 24
    curve.use_fill_caps = True
    spline = curve.splines.new("BEZIER")
    # a flared root buried in the antenna mound: the stalk widens as it meets
    # the shell, like a stem, instead of a tube plugged into a hole
    spline.bezier_points.add(2)
    b_root, b0, b1 = spline.bezier_points
    up = (p1 - p0).normalized()
    b_root.co, b_root.radius = p0 + sink, flare
    b_root.handle_left, b_root.handle_right = p0 + sink * 2, p0 + sink * 0.4
    b0.co, b0.radius = p0 + up * 2.5 * S.MM, a["taper"][0]
    b0.handle_left, b0.handle_right = p0 + up * 0.8 * S.MM, p0 + up * 2.5 * S.MM + (c1 - p0) * 0.6
    b1.co, b1.handle_left, b1.handle_right, b1.radius = p2, c2, p2 + (p2 - c2), a["taper"][1]
    tmp = bpy.data.objects.new("tmp_antenna", curve)
    collection.objects.link(tmp)
    mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(curve)
    mesh.name = "Scope_Antenna"
    for poly in mesh.polygons:
        poly.use_smooth = True
    stalk = bpy.data.objects.new("Scope_Antenna", mesh)
    collection.objects.link(stalk)

    bm = _uv_sphere(40, 24)
    bmesh.ops.scale(bm, vec=(a["tip_r"],) * 3, verts=bm.verts)
    bmesh.ops.translate(bm, vec=tip_c, verts=bm.verts)
    tip = _new_object("Scope_AntennaTip", bm, collection)
    return stalk, tip, p0


def build_accent(collection):
    """The purple accent light — present but hidden at rest (2D: scale 0).
    Placed by the SVG point's relative position on the shell."""
    sx, sy = S.ACCENT_SVG
    rx = (sx - 80) / 75 * P["shell_rx"]
    zr = (78 - sy) / 71
    z = P["shell_center_z"] + zr * P["shell_rz"]
    p = front_point(rx, z)
    bm = _uv_sphere(16, 8)
    bmesh.ops.scale(bm, vec=(S.ACCENT_RADIUS, S.ACCENT_RADIUS * 0.5, S.ACCENT_RADIUS), verts=bm.verts)
    obj = _new_object("Scope_Accent", bm, collection)
    q = Vector((0, -1, 0)).rotation_difference(-inward_normal(p))
    obj.matrix_basis = Matrix.Translation(p) @ q.to_matrix().to_4x4()
    return obj
