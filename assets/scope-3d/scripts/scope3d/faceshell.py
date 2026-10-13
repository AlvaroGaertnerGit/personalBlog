"""v3 shell: body and face glass as ONE mesh with outline-aligned topology.

A separate glass surface dropped into a cavity carved in the shell crosses it,
which draws a jagged, glossy seam along the edge (an earlier version did this),
and a uniform rim makes the chin read as a heavy frame. Here every edge loop
near the face follows the rounded-rect outline instead:

  glass   scaled copies of the outline, s = 0 (centre) .. 1 (outline)
  wall    offset copies of the outline, d = 0 .. W(t): the rim rolls from the
          glass edge onto the shell surface (thick brow, softer cheeks, low chin)
  skirt   a few more offset loops on the untouched surface
  back    from the last loop to the back pole by slerp on the shell's unit-
          sphere parametrisation (so taper, flattening and feet still apply)

There is nothing to intersect: the black-to-beige edge is one clean loop, a
material boundary with split normals (crisp, no gap). Glass faces get exact
analytic normals, so its reflections stay smooth over the centre fan.
"""

import math

import bmesh
import bpy
from mathutils import Vector

from . import geometry as G
from . import spec as S

P = S.P
MM = S.MM

M_SEG = 256        # vertices per loop (divisible by 4: symmetric about both axes)
GLASS_RINGS = 34
WALL_RINGS = 18
SKIRT_RINGS = 4
BACK_RINGS = 120


# --- Rounded-rect outline: arc-length parametrisation ---------------------------
def _outline_pieces():
    hw, hh, r = P["display_half_w"], P["display_half_h"], P["display_radius"]
    a, b = hw - r, hh - r
    # (kind, data, length) counter-clockwise from the right-middle
    return [
        ("line", ((hw, 0), (hw, b)), b),
        ("arc", ((a, b), 0), math.pi * r / 2),
        ("line", ((a, hh), (-a, hh)), 2 * a),
        ("arc", ((-a, b), 90), math.pi * r / 2),
        ("line", ((-hw, b), (-hw, -b)), 2 * b),
        ("arc", ((-a, -b), 180), math.pi * r / 2),
        ("line", ((-a, -hh), (a, -hh)), 2 * a),
        ("arc", ((a, -b), 270), math.pi * r / 2),
        ("line", ((hw, -b), (hw, 0)), b),
    ]


def outline_samples(n=M_SEG):
    """n points evenly spaced by arc length: (x, z_rel) and outward unit normal."""
    r = P["display_radius"]
    pieces = _outline_pieces()
    total = sum(p[2] for p in pieces)
    out = []
    for k in range(n):
        target = total * k / n
        for kind, data, length in pieces:
            if target <= length + 1e-12:
                f = target / length if length else 0.0
                if kind == "line":
                    (x0, z0), (x1, z1) = data
                    px, pz = x0 + (x1 - x0) * f, z0 + (z1 - z0) * f
                    tx, tz = (x1 - x0), (z1 - z0)
                    ln = math.hypot(tx, tz)
                    nx, nz = tz / ln, -tx / ln  # CCW travel -> outward is to the right
                else:
                    (cx, cz), start = data
                    ang = math.radians(start + 90 * f)
                    nx, nz = math.cos(ang), math.sin(ang)
                    px, pz = cx + r * nx, cz + r * nz
                out.append(((px, pz), (nx, nz)))
                break
            target -= length
    return out


# --- Directional parameters (blend top / side / bottom by the outline normal) ----
def _by_normal(nx, nz, top, side, bottom, upper_corner):
    """Blend four anchors by the outline normal; every weight is C1-smooth, so
    the rim never creases. The upper corners get their own value: there the
    egg narrows toward the crown and the face sits closest to the body's edge
    (on the sheet the rim is thinnest there too)."""
    up = max(nz, 0.0)
    w_top = up ** 6
    w_corner = 4 * nx * nx * up * up
    w_bottom = max(-nz, 0.0) ** 2
    return side + (top - side) * w_top + (upper_corner - side) * w_corner + (bottom - side) * w_bottom


def rim_width(nx, nz):
    return _by_normal(nx, nz, P["rim_top"], P["rim_side"], P["rim_bottom"], P["rim_upper_corner"])


def skirt_width(nx, nz):
    return _by_normal(nx, nz, 1.5 * MM, 4 * MM, 2 * MM, 1.0 * MM)


# Front projection (x, z) -> shell only exists on the visible front hemisphere.
# Loops that wander past it get clamped flat (that drew a slit across the crown
# in an early v3 build), so every projected point is checked.
_GRAZING_LIMIT = 0.06
_grazing = {"count": 0, "worst": 1.0}


def _front(x, z):
    zr = (z - P["shell_center_z"]) / P["shell_rz"]
    t = G._taper(zr)
    k = 1 - (x / (P["shell_rx"] * t)) ** 2 - zr ** 2
    _grazing["worst"] = min(_grazing["worst"], k)
    if k < _GRAZING_LIMIT:
        _grazing["count"] += 1
    return G.front_point(x, z)


def surface_y(x, z):
    return _front(x, z).y


# --- Glass surface, valid for any (x, z) inside the outline ----------------------
# A single smooth polynomial in (u, v) = (x / half_w, (z - zc) / half_h), least-
# squares fitted to the per-direction edge depths plus a slightly forward
# centre. It must be smooth everywhere: any slope kink in a glossy surface
# shows up as a crease in its reflections (a first v3 attempt tied depth to the
# outline direction and drew a radial "pinwheel" of streaks).
_BASIS = (
    lambda u, v: 1.0,
    lambda u, v: v,
    lambda u, v: v * v,
    lambda u, v: u * u,
    lambda u, v: u * u * v,
    lambda u, v: v ** 3,
    lambda u, v: u ** 4,
    lambda u, v: u * u * v * v,
    lambda u, v: v ** 4,
)

_CACHE = {}


def _edge_target(px, pz_rel, nx, nz):
    depth = _by_normal(nx, nz, P["glass_depth_top"], P["glass_depth_side"], P["glass_depth_bottom"],
                       P["glass_depth_upper_corner"])
    return surface_y(px, P["display_center_z"] + pz_rel) + depth


def _fit():
    import numpy as np

    hw, hh = P["display_half_w"], P["display_half_h"]
    rows, ys, ws = [], [], []
    edge = outline_samples(128)
    for (px, pz), (nx, nz) in edge:
        u, v = px / hw, pz / hh
        rows.append([f(u, v) for f in _BASIS])
        ys.append(_edge_target(px, pz, nx, nz))
        ws.append(1.0)
    yc = sum(ys) / len(ys) - P["glass_bulge"]
    for u, v in ((0, 0), (0.35, 0), (-0.35, 0), (0, 0.35), (0, -0.35)):
        rows.append([f(u, v) for f in _BASIS])
        ys.append(yc)
        ws.append(0.6 if (u or v) else 2.0)
    A = np.array(rows) * np.array(ws)[:, None]
    coef, *_ = np.linalg.lstsq(A, np.array(ys) * np.array(ws), rcond=None)
    # report how well the edge targets are met (depth must stay positive)
    depths = [
        sum(c * f(px / hw, pz / hh) for c, f in zip(coef, _BASIS)) - surface_y(px, P["display_center_z"] + pz)
        for (px, pz), _n in edge
    ]
    print(f"[faceshell] glass edge depth behind the surface: {min(depths) * 1000:.2f}"
          f"..{max(depths) * 1000:.2f} mm")
    return coef


def glass_y(x, z):
    if "coef" not in _CACHE:
        _CACHE["coef"] = _fit()
    u = x / P["display_half_w"]
    v = (z - P["display_center_z"]) / P["display_half_h"]
    return sum(c * f(u, v) for c, f in zip(_CACHE["coef"], _BASIS))


def glass_point(x, z):
    return Vector((x, glass_y(x, z), z))


def glass_normal(x, z, eps=0.4 * MM):
    dx = glass_point(x + eps, z) - glass_point(x - eps, z)
    dz = glass_point(x, z + eps) - glass_point(x, z - eps)
    n = dz.cross(dx).normalized()
    return n if n.y < 0 else -n


def reset():
    _CACHE.clear()


# --- Mesh ---------------------------------------------------------------------------
def _rim_profile(t):
    """0 at the glass edge -> 1 on the shell. Steep into the cavity, rolling
    tangentially onto the surface (p'(1) = 0): a thick, rounded lip."""
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 2.4


def _unit_coords(p):
    """Inverse of the shell parametrisation (un-flattened region only)."""
    zr = (p.z - P["shell_center_z"]) / P["shell_rz"]
    t = G._taper(zr)
    return Vector((p.x / (P["shell_rx"] * t), p.y / (P["shell_ry"] * t), zr)).normalized()


def _from_unit(u):
    zr = u.z
    t = G._taper(zr)
    p = Vector((u.x * P["shell_rx"] * t, u.y * P["shell_ry"] * t, P["shell_center_z"] + zr * P["shell_rz"]))
    p.z += G._flatten_lift(zr)
    return p


def build(collection, shell_mat, glass_mat):
    reset()
    _grazing.update(count=0, worst=1.0)
    zc = P["display_center_z"]
    samples = outline_samples()
    rings = []        # list of lists of Vector, front (glass centre) to back
    glass_ring_count = 0

    # glass: scaled outlines (s from small to 1)
    for j in range(1, GLASS_RINGS + 1):
        s = j / GLASS_RINGS
        ring = []
        for (px, pz), _n in samples:
            x, z = px * s, zc + pz * s
            ring.append(glass_point(x, z))
        rings.append(ring)
    glass_ring_count = len(rings)  # the last glass ring is the shared edge loop

    # wall: offset outlines rolling from the glass edge to the surface
    edge_y = [rings[-1][i].y for i in range(M_SEG)]
    for k in range(1, WALL_RINGS + 1):
        t = (k / WALL_RINGS) ** 1.35  # denser near the glass edge: crisp inner corner
        ring = []
        for i, ((px, pz), (nx, nz)) in enumerate(samples):
            d = t * rim_width(nx, nz)
            x, z = px + nx * d, zc + pz + nz * d
            ys = surface_y(x, z)
            ring.append(Vector((x, edge_y[i] + (ys - edge_y[i]) * _rim_profile(t), z)))
        rings.append(ring)

    # skirt: a few loops on the untouched surface beyond the rim
    for k in range(1, SKIRT_RINGS + 1):
        ring = []
        for (px, pz), (nx, nz) in samples:
            d = rim_width(nx, nz) + skirt_width(nx, nz) * k / SKIRT_RINGS
            x, z = px + nx * d, zc + pz + nz * d
            ring.append(_front(x, z))
        rings.append(ring)

    _round_rim(rings, glass_ring_count)

    print(f"[faceshell] front projection: {_grazing['count']} points past the grazing limit "
          f"(worst k = {_grazing['worst']:.3f}; must stay > {_GRAZING_LIMIT})")
    if _grazing["count"]:
        raise RuntimeError("face loops leave the front hemisphere — shrink rim/skirt widths")

    # back: slerp each last-loop point to the back pole on the unit sphere
    starts = [_unit_coords(p) for p in rings[-1]]
    pole = Vector((0.0, 1.0, 0.0))
    for k in range(1, BACK_RINGS):
        f = k / BACK_RINGS
        rings.append([_from_unit(u.slerp(pole, f) if (u - pole).length > 1e-6 else pole) for u in starts])

    # --- assemble -------------------------------------------------------------
    bm = bmesh.new()
    centre = bm.verts.new(glass_point(0.0, zc))
    back_pole = bm.verts.new(_from_unit(pole))
    vrings = [[bm.verts.new(p) for p in ring] for ring in rings]
    faces_glass = []
    for i in range(M_SEG):
        f = bm.faces.new((centre, vrings[0][i], vrings[0][(i + 1) % M_SEG]))
        faces_glass.append(f)
    for j in range(len(vrings) - 1):
        a, b = vrings[j], vrings[j + 1]
        for i in range(M_SEG):
            i2 = (i + 1) % M_SEG
            f = bm.faces.new((a[i], b[i], b[i2], a[i2]))
            if j < glass_ring_count - 1:
                faces_glass.append(f)
    last = vrings[-1]
    for i in range(M_SEG):
        bm.faces.new((last[(i + 1) % M_SEG], back_pole, last[i]))

    glass_set = set(faces_glass)
    for f in bm.faces:
        f.material_index = 1 if f in glass_set else 0
        f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    # feet + antenna mound act on the finished surface, then ground on the feet
    frames = G._feet_frames() if P.get("feet_style") == "grown" else []
    mound = _antenna_mound()
    foot_factors = []  # per vertex, per foot: skin weight source for the rig
    for v in bm.verts:
        p = v.co.copy()
        if frames:
            f = []
            p = G.grow_feet(p, frames, f)
            foot_factors.append(f)
        if mound:
            p = G.grow_feet(p, [mound])
        v.co = p
    zmin = min(v.co.z for v in bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, -zmin), verts=bm.verts)
    P["shell_center_z"] -= zmin
    P["display_center_z"] -= zmin
    reset()  # glass cache depends on display_center_z

    mesh = bpy.data.meshes.new("Scope_Shell")
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(shell_mat)
    mesh.materials.append(glass_mat)
    _split_normals(mesh)
    obj = bpy.data.objects.new("Scope_Shell", mesh)
    collection.objects.link(obj)
    if frames:
        _foot_groups(obj, frames, foot_factors)
    return obj


def foot_name(anchor):
    """foot.FL / FR / BL / BR — Scope's own left is +X, front is -Y."""
    return "foot." + ("F" if anchor.y < 0 else "B") + ("L" if anchor.x > 0 else "R")


def _foot_groups(obj, frames, foot_factors):
    """Vertex groups for the feet: tips follow their foot bone fully, the
    filleted base blends into the body (the remainder goes to the body bone)."""
    groups = [obj.vertex_groups.new(name=foot_name(fr[0])) for fr in frames]
    for vi, factors in enumerate(foot_factors):
        for g, f in zip(groups, factors):
            w = G.smoothstep((f - 0.04) / 0.7)
            if w > 1e-4:
                g.add([vi], w, "REPLACE")


RIM_SMOOTH_ITERS = 14
RIM_SMOOTH_LAMBDA = 0.45


def _round_rim(rings, glass_ring_count):
    """Round the lip: Laplacian-smooth each radial chain (glass edge -> wall ->
    skirt), never across a loop. Where the rising wall meets the shell curving
    away (the brow, the chin) the raw profile folds into a ridge; this turns
    the fold into a bullnose. The glass edge loop is pinned (crisp inner
    corner); weights fade to zero at the far end so the shell is untouched."""
    first = glass_ring_count - 1           # the shared edge loop: pinned
    last = len(rings) - 1                  # end of the skirt: pinned
    span = last - first
    for i in range(M_SEG):
        chain = [rings[j][i] for j in range(first, last + 1)]
        for _ in range(RIM_SMOOTH_ITERS):
            prev = [c.copy() for c in chain]
            for k in range(1, span):
                fade = 1 - (k / span) ** 2
                avg = (prev[k - 1] + prev[k + 1]) * 0.5
                chain[k] = prev[k] + (avg - prev[k]) * RIM_SMOOTH_LAMBDA * fade
        for k in range(1, span):
            rings[first + k][i] = chain[k]


def _antenna_mound():
    """A low, wide swell where the antenna roots, so the stalk grows out of the
    shell instead of being plugged into it. Same displacement as the feet."""
    a = P.get("antenna", {})
    if "base_offset" not in a:
        return None
    bx, by = a["base_offset"]
    anchor = Vector((bx, by, G.top_z(bx, by)))
    axis = -G.inward_normal(anchor)
    return (anchor, axis, a.get("mound_radius", 9 * MM), a.get("mound_height", 2.2 * MM), 2.4)


def _split_normals(mesh):
    """Per-material smooth normals: glass and shell are each smooth, the edge
    loop between them is crisp. Glass loops use the analytic normal."""
    import numpy as np

    nv = len(mesh.vertices)
    acc = {0: np.zeros((nv, 3)), 1: np.zeros((nv, 3))}
    for poly in mesh.polygons:
        n = np.array(poly.normal) * poly.area
        for vi in poly.vertices:
            acc[poly.material_index][vi] += n
    for k in acc:
        ln = np.linalg.norm(acc[k], axis=1, keepdims=True)
        ln[ln == 0] = 1
        acc[k] /= ln
    zc = P["display_center_z"]
    analytic = {}
    loop_normals = [None] * len(mesh.loops)
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi = mesh.loops[li].vertex_index
            if poly.material_index == 1:
                if vi not in analytic:
                    co = mesh.vertices[vi].co
                    if abs(co.x) < 1e-7 and abs(co.z - zc) < 1e-7:
                        analytic[vi] = tuple(acc[1][vi])
                    else:
                        analytic[vi] = tuple(glass_normal(co.x, co.z))
                loop_normals[li] = analytic[vi]
            else:
                loop_normals[li] = tuple(acc[0][vi])
    mesh.normals_split_custom_set(loop_normals)
