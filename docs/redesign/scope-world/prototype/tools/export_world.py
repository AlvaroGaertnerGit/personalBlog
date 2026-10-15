"""Scope World prototype: export the Pliego (Entrega 1.5) to a web GLB.

Reuses the world exactly as the approved renders build it (docs/scope-world/
entrega-1-5/blender/mundo.py on top of pliego_base.py). Nothing is re-modelled
here; this script only:

- evaluates every object of the PLIEGO collection (booleans, solidify, curves),
- thins the sheet (its 0.5 cm grid is for Cycles; flat areas are dissolved),
- swaps Cycles node materials for plain glTF ones that carry what the browser
  shader needs (`extras`: kind, tint, images); the shading itself (ruled lines,
  the lamp's firing law, MathView's contours) is rebuilt in the browser,
- writes world.glb (WebP textures) and world.json (places, route, lamp, pool)
  plus height.bin (the walkable floor, for standing Scope on the sheet) and
  nav.bin (where he can stand: every piece below his height, grown by his radius).

The approved Scope .blend is not opened. Run headless, ONE Blender at a time:

  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
      --python docs/redesign/scope-world/prototype/tools/export_world.py
"""

import json
import math
import os
import struct
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
OUT = os.path.abspath(os.path.join(HERE, "..", "assets"))
sys.path.insert(0, os.path.join(REPO, "docs", "scope-world", "entrega-1-5", "blender"))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import mundo  # noqa: E402  (patches pliego_base.build_world with the 1.5 field)

B = mundo.B
MAX_TEX = 1024
SKIP = {"Desk"}  # the dark desk is an infinite plane in the browser


def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)


# --- materials ----------------------------------------------------------------------------
def first_image(node):
    """The image feeding a socket chain (through a Mapping node), if any."""
    if node is None:
        return None
    if node.type == "TEX_IMAGE":
        return node.image
    return None


def linked_from(socket):
    return socket.links[0].from_node if socket.is_linked else None


def describe(mat):
    """What the browser needs to rebuild a Cycles material."""
    nt = mat.node_tree
    nodes = nt.nodes
    kinds = {n.type for n in nodes}
    bsdf = B.principled(nt)
    name = mat.name
    # two-sided page (paper_duo): Backfacing picks the image
    for n in nodes:
        if n.type == "MIX" and n.inputs["Factor"].is_linked and \
                n.inputs["Factor"].links[0].from_socket.name == "Backfacing":
            a = first_image(linked_from(n.inputs[6]))  # A (RGBA)
            b = first_image(linked_from(n.inputs[7]))  # B (RGBA)
            return dict(kind="page", front=a, back=b, tint=list(B.PAPER))
    if "BSDF_TRANSLUCENT" in kinds:  # paper_material
        rgb = next((n for n in nodes if n.type == "RGB"), None)
        tint = list(rgb.outputs[0].default_value[:3]) if rgb else list(B.PAPER)
        image = next((n.image for n in nodes if n.type == "TEX_IMAGE"), None)
        ruled = any(n.type == "MAP_RANGE" and abs(n.inputs["From Min"].default_value - 0.035) < 1e-6
                    for n in nodes)
        fired = sum(1 for n in nodes if n.type == "BSDF_PRINCIPLED") > 1
        return dict(kind="paper", image=image, tint=tint, ruled=ruled, fired=fired)
    col = bsdf.inputs["Base Color"].default_value
    emit = bsdf.inputs["Emission Strength"].default_value
    d = dict(kind="solid", tint=list(col[:3]), rough=bsdf.inputs["Roughness"].default_value,
             coat=bsdf.inputs["Coat Weight"].default_value, metal=bsdf.inputs["Metallic"].default_value)
    if emit > 0:
        d["emission"] = list(bsdf.inputs["Emission Color"].default_value[:3])
    if name.startswith("Glaze_MathView") or name == "Glaze_Celadon":
        d["kind"] = "mathview"
        mix = next((n for n in nodes if n.type == "MIX" and n.data_type == "RGBA"), None)
        if mix:
            d["tint"] = list(mix.inputs[6].default_value[:3])
            d["lines"] = list(mix.inputs[7].default_value[:3])
    return d


IMAGES = {}


def web_image(image):
    """A resized copy (≤ MAX_TEX), so the GLB stays small."""
    if image is None:
        return None
    if image.name in IMAGES:
        return IMAGES[image.name]
    w, h = image.size
    copy = image.copy()
    copy.name = "web_" + os.path.splitext(image.name)[0]
    s = min(1.0, MAX_TEX / max(w, h))
    if s < 1.0:
        copy.scale(max(1, round(w * s)), max(1, round(h * s)))
    IMAGES[image.name] = copy
    return copy


def export_material(name, info, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = B.principled(nt)
    bsdf.inputs["Base Color"].default_value = (*info.get("tint", (1, 1, 1)), 1)
    bsdf.inputs["Roughness"].default_value = info.get("rough", 0.88)
    if image is not None:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = web_image(image)
        t.extension = "EXTEND"
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    extras = {k: v for k, v in info.items() if k not in ("image", "front", "back")}
    for k, v in extras.items():
        m[k] = v
    return m


# --- geometry -----------------------------------------------------------------------------
def thin(me, drop_bottom=False):
    """Dissolve flat areas (Cycles' dense grids -> what the folds and curls need).
    `drop_bottom`: remove faces looking straight down (hidden against the sheet)."""
    bm = bmesh.new()
    bm.from_mesh(me)
    if drop_bottom:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.9], context="FACES")
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.35), verts=bm.verts, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()


def back_face_copy(obj, mat, col):
    """The other side of a single-surface page: same mesh, reversed, u mirrored."""
    me = obj.data.copy()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.active
    if uv:
        for f in bm.faces:
            for loop in f.loops:
                loop[uv].uv.x = 1.0 - loop[uv].uv.x
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    me.materials.append(mat)
    o = bpy.data.objects.new(obj.name + "_back", me)
    col.objects.link(o)
    o.matrix_world = obj.matrix_world
    return o


def bake_objects(state):
    built = B.build_world(state)
    dg = bpy.context.evaluated_depsgraph_get()
    src = bpy.data.collections["PLIEGO"]
    exp = bpy.data.collections.new("EXPORT")
    bpy.context.scene.collection.children.link(exp)
    materials = {}
    pages = []
    out = []
    for o in list(src.all_objects):
        if o.name in SKIP or o.type not in ("MESH", "CURVE"):
            continue
        name = o.name
        mw = o.matrix_world.copy()
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        o.name = "src_" + name
        me.name = name
        n = bpy.data.objects.new(name, me)
        exp.objects.link(n)
        n.matrix_world = mw
        thin(me, drop_bottom=name == "MathView")
        for i, slot_mat in enumerate(list(me.materials)):
            if slot_mat is None:
                continue
            info = materials.get(slot_mat.name)
            if info is None:
                info = describe(slot_mat)
                materials[slot_mat.name] = info
            if info["kind"] == "page":
                front = export_material(slot_mat.name + "_front", dict(info, side="front"), info["front"])
                back = export_material(slot_mat.name + "_back", dict(info, side="back"), info["back"])
                me.materials[i] = front
                pages.append((n, back))
            else:
                key = "web_" + slot_mat.name
                me.materials[i] = bpy.data.materials.get(key) or export_material(
                    key, dict(info, source=slot_mat.name), info.get("image"))
        out.append(n)
    for n, back in pages:
        out.append(back_face_copy(n, back, exp))
    return built, exp, out


# --- data for the browser ----------------------------------------------------------------
def floor_heights(objs, step=0.0125):
    """Walkable floor: the sheet, plus raised surfaces Scope can stand on."""
    walk = [o for o in objs if o.name in ("Pliego_Sheet", "MathView", "Bench_q-local", "Lookout_top")
            or o.name.startswith("Stair_")]
    trees = []
    for o in walk:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.transform(o.matrix_world)
        trees.append(BVHTree.FromBMesh(bm))
        bm.free()
    nx, ny = int(round(2 * B.SHEET_X / step)) + 1, int(round(2 * B.SHEET_Y / step)) + 1
    vals = []
    for j in range(ny):
        for i in range(nx):
            x, y = -B.SHEET_X + i * step, -B.SHEET_Y + j * step
            top = B.height(x, y)
            for t in trees:
                hit = t.ray_cast(Vector((x, y, 0.5)), Vector((0, 0, -1)))
                if hit[0] is not None and hit[1].z > 0.6:
                    top = max(top, hit[0].z)
            vals.append(top)
    return dict(step=step, nx=nx, ny=ny, x0=-B.SHEET_X, y0=-B.SHEET_Y), vals


# what Scope can stand on (never an obstacle), and how tall / wide he is
WALKABLE = ("Pliego_Sheet", "MathView", "Bench_q-local", "Lookout_top")
SCOPE_HEIGHT = 0.16
SCOPE_RADIUS = 0.06
# anything lower than this he hops over (MathView's lying axes, its card, the pencil)
STEP_OVER = 0.03


def nav_grid(objs, step=0.01):
    """Where Scope can stand: 1 = free. Every triangle below his height is an
    obstacle (thin standing sheets project to lines), grown by his radius;
    off the sheet and over the holes cut out of it is not walkable either."""
    import array
    nx, ny = int(round(2 * B.SHEET_X / step)) + 1, int(round(2 * B.SHEET_Y / step)) + 1
    blocked = bytearray(nx * ny)

    def cell(x, y):
        return int(round((x + B.SHEET_X) / step)), int(round((y + B.SHEET_Y) / step))

    def mark(x, y):
        i, j = cell(x, y)
        if 0 <= i < nx and 0 <= j < ny:
            blocked[j * nx + i] = 1

    for o in objs:
        if o.name in WALKABLE or o.name.startswith(("Stair_", "Page_")):
            continue
        me = o.data
        me.calc_loop_triangles()
        mw = o.matrix_world
        verts = [mw @ v.co for v in me.vertices]
        if verts and max(v.z for v in verts) < STEP_OVER:
            continue
        for tri in me.loop_triangles:
            a, b, c = (verts[k] for k in tri.vertices)
            if min(a.z, b.z, c.z) > SCOPE_HEIGHT:
                continue
            for p, q in ((a, b), (b, c), (c, a)):  # edges: thin sheets are lines from above
                n = max(1, int((p - q).length / (step * 0.5)))
                for k in range(n + 1):
                    t = k / n
                    mark(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t)
            # fill (flat or leaning pieces)
            xs, ys = (a.x, b.x, c.x), (a.y, b.y, c.y)
            area = abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2
            if area > step * step:
                i0, j0 = cell(min(xs), min(ys))
                i1, j1 = cell(max(xs), max(ys))
                for j in range(max(0, j0), min(ny, j1 + 1)):
                    for i in range(max(0, i0), min(nx, i1 + 1)):
                        x, y = -B.SHEET_X + i * step, -B.SHEET_Y + j * step
                        d1 = (x - b.x) * (a.y - b.y) - (a.x - b.x) * (y - b.y)
                        d2 = (x - c.x) * (b.y - c.y) - (b.x - c.x) * (y - c.y)
                        d3 = (x - a.x) * (c.y - a.y) - (c.x - a.x) * (y - a.y)
                        neg = d1 < 0 or d2 < 0 or d3 < 0
                        pos = d1 > 0 or d2 > 0 or d3 > 0
                        if not (neg and pos):
                            blocked[j * nx + i] = 1

    # holes cut out of the sheet (popups, Scope's own silhouette): nothing to stand on
    sheet = next(o for o in objs if o.name == "Pliego_Sheet")
    bm = bmesh.new()
    bm.from_mesh(sheet.data)
    bm.transform(sheet.matrix_world)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    for j in range(ny):
        for i in range(nx):
            x, y = -B.SHEET_X + i * step, -B.SHEET_Y + j * step
            if tree.ray_cast(Vector((x, y, 0.3)), Vector((0, 0, -1)))[0] is None:
                blocked[j * nx + i] = 1

    # grow every obstacle by Scope's radius (and keep him off the sheet's edge)
    r = int(math.ceil(SCOPE_RADIUS / step))
    disk = [(di, dj) for dj in range(-r, r + 1) for di in range(-r, r + 1) if di * di + dj * dj <= r * r]
    free = array.array("B", [1]) * (nx * ny)
    for j in range(ny):
        for i in range(nx):
            if i < r or j < r or i >= nx - r or j >= ny - r:
                free[j * nx + i] = 0
            elif blocked[j * nx + i]:
                for di, dj in disk:
                    ii, jj = i + di, j + dj
                    if 0 <= ii < nx and 0 <= jj < ny:
                        free[jj * nx + ii] = 0
    return dict(step=step, nx=nx, ny=ny, x0=-B.SHEET_X, y0=-B.SHEET_Y, radius=SCOPE_RADIUS,
                height=SCOPE_HEIGHT, step_over=STEP_OVER), free


def main():
    clear_scene()
    state = dict(mundo.CTX, **mundo.AG)
    state["bulb"] = 80.0
    built, exp, objs = bake_objects(state)
    bpy.context.view_layer.update()

    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    os.makedirs(OUT, exist_ok=True)
    glb = os.path.join(OUT, "world.glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_extras=True,
                              export_apply=False, export_yup=True, export_image_format="WEBP",
                              export_animations=False, export_cameras=False, export_lights=False)

    grid, heights = floor_heights(objs)
    with open(os.path.join(OUT, "height.bin"), "wb") as fh:
        fh.write(struct.pack(f"<{len(heights)}f", *heights))
    nav, free = nav_grid(objs)
    with open(os.path.join(OUT, "nav.bin"), "wb") as fh:
        fh.write(bytes(free))

    mv = bpy.data.objects["MathView"]
    card = bpy.data.objects["Card_MathView"]
    books = {}
    for name, (x, y, w, h, *_rest) in mundo.BOOKS.items():
        books[name] = dict(x=x, y=y, w=w, h=h, facing=state.get("facing_" + name, mundo.facing_to_route(x, y)))
    standing = {q[0]: dict(x=q[1], y=q[2], w=q[3], h=q[4]) for q in B.QUESTIONS
                if q[0] in ("q-ux", "q-arch", "q-next")}
    data = dict(
        units="metres, Blender axes (x right, y away, z up); the browser converts to y-up",
        sheet=dict(x=B.SHEET_X, y=B.SHEET_Y), margin_x=B.MARGIN_X, rule=B.RULE,
        pool=dict(x=B.POOL.x, y=B.POOL.y, r=B.POOL_R),
        lamp=dict(head=list(B.LAMP_HEAD), base=list(B.LAMP_BASE), elbow=list(B.LAMP_ELBOW)),
        window_dir=list(B.WINDOW_DIR), route=B.ROUTE, places=B.PLACES,
        mathview=dict(x=mv.location.x, y=mv.location.y, z=mv.location.z, rot=mv.rotation_euler.z,
                      w=0.30, d=0.26),
        card=dict(x=card.location.x, y=card.location.y, z=card.location.z),
        books=books, questions=standing,
        bench=list(mundo.BENCH), lookout_top=list(mundo.LOOKOUT_TOP),
        floor=grid, nav=nav,
        state="CTX + AG (q-context open at 150 deg, q-agents facing -90 deg), as a1-wide",
    )
    with open(os.path.join(OUT, "world.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
    tris = sum(len(o.data.loop_triangles) if o.data.calc_loop_triangles() is None else 0 for o in objs)
    print(f"[export] {len(objs)} objects, {tris} triangles -> {glb} ({os.path.getsize(glb) // 1024} KB)",
          flush=True)


if __name__ == "__main__":
    main()
