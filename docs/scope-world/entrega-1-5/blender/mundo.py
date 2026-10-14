"""PLIEGO, Entrega 1.5: the same sheet, made explorable.

Builds on pliego_base.py (a lab copy of Entrega 1's pliego.py; same map, scale,
lamp, materials and rules) and evolves the field of questions:

- every standing question of Entrega 1 was a *closed* question: a book stood on
  its spine. Opened, real notes from the notebook rise inside as pop-up layers;
- the red thread carries paper tags (research notes) and pulls on related books;
- Local Models lies flat (its real status is "Paused"): a place to rest;
- a folded lookout with accordion stairs gives the field height and a view;
- MathView gets its axes, its card and contour lines that light up.

Scope: the approved model, read-only, placed and posed with the approved channels
(clip frames, held poses within the rig's ranges, or *experimental* poses that are
declared as such in 04-comportamiento.md). Nothing is ever saved to the .blend.

Run ONE shot per Blender process (memory):
  blender --background --factory-startup --python docs/scope-world/entrega-1-5/blender/mundo.py -- \
      --shot a1-wide --res 1920 --samples 64 --out docs/scope-world/entrega-1-5/renders/raw
"""

import math
import os
import random
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import pliego_base as B  # noqa: E402

TEX15 = os.path.join(HERE, "..", "textures")


def img(name, folder=TEX15):
    return bpy.data.images.load(os.path.join(folder, name + ".png"), check_existing=True)


# --- two-sided paper: a different image on each face ---------------------------------
def paper_duo(name, front, back, flip_front=False, flip_back=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    bsdf = B.principled(nt)
    bsdf.inputs["Roughness"].default_value = 0.88
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
    tc = B.node(nt, "ShaderNodeTexCoord", (-1100, 300))
    cols = []
    for image, flip in ((front, flip_front), (back, flip_back)):
        vec = tc.outputs["UV"]
        if flip:  # u -> 1 - u, so writing reads the right way round on that face
            mp = B.node(nt, "ShaderNodeMapping", (-900, 300))
            mp.inputs["Location"].default_value = (1, 0, 0)
            mp.inputs["Scale"].default_value = (-1, 1, 1)
            B.link(nt, vec, mp.inputs["Vector"])
            vec = mp.outputs["Vector"]
        if image is None:
            c = B.node(nt, "ShaderNodeRGB", (-600, 300))
            c.outputs[0].default_value = (1, 1, 1, 1)
            cols.append(c.outputs[0])
            continue
        t = B.node(nt, "ShaderNodeTexImage", (-600, 300))
        t.image = image
        t.extension = "CLIP"
        B.link(nt, vec, t.inputs["Vector"])
        cols.append(t.outputs["Color"])
    geo = B.node(nt, "ShaderNodeNewGeometry", (-600, 0))
    pick = B.node(nt, "ShaderNodeMix", (-350, 300))
    pick.data_type = "RGBA"
    B.link(nt, geo.outputs["Backfacing"], pick.inputs["Factor"])
    B.link(nt, cols[0], pick.inputs["A"])
    B.link(nt, cols[1], pick.inputs["B"])
    tint = B.node(nt, "ShaderNodeMix", (-150, 300))
    tint.data_type = "RGBA"
    tint.blend_type = "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs["A"].default_value = (*B.PAPER, 1)
    B.link(nt, pick.outputs["Result"], tint.inputs["B"])
    B.link(nt, tint.outputs["Result"], bsdf.inputs["Base Color"])
    tr = B.node(nt, "ShaderNodeBsdfTranslucent", (100, -100))
    B.link(nt, tint.outputs["Result"], tr.inputs["Color"])
    mix = B.node(nt, "ShaderNodeMixShader", (300, 100))
    mix.inputs["Fac"].default_value = 0.34
    B.link(nt, bsdf.outputs[0], mix.inputs[1])
    B.link(nt, tr.outputs[0], mix.inputs[2])
    B.link(nt, mix.outputs[0], out.inputs["Surface"])
    return mat


# --- books: the questions --------------------------------------------------------------
def page_mesh(col, name, w, h, curl=0.012):
    """One page from the spine (x = 0) to its free edge (x = w); front face -Y."""
    sx, sz = 20, 28
    verts, uvs, faces = [], [], []
    for j in range(sz + 1):
        for i in range(sx + 1):
            u, v = i / sx, j / sz
            verts.append((u * w, -curl * (u ** 2) * (0.6 + 0.4 * v), v * h))
            uvs.append((u, v))
    for j in range(sz):
        for i in range(sx):
            a = j * (sx + 1) + i
            faces.append((a, a + 1, a + sx + 2, a + sx + 1))
    o = B.obj_from(name, verts, faces, col, uvs)
    B.shade_smooth(o)
    return o


def book(col, cutters, name, x, y, facing_deg, w, h, open_deg, cover, inner_a, inner_b, layers=(), lift=None):
    """A question standing on its spine. Closed (0 deg) it reads as Entrega 1's sheet;
    opened, its pop-up layers rise from the gutter (progress follows the opening)."""
    z = B.height(x, y)
    delta = (180 - open_deg) / 2
    a_dir = math.radians(facing_deg + 90 + delta)
    b_dir = math.radians(facing_deg - 90 - delta)
    pa = page_mesh(col, name + "_A", w, h)
    pa.data.materials.append(paper_duo(name + "_matA", inner_a, cover, flip_back=True))
    pa.location = (x, y, z)
    pa.rotation_euler = (0, 0, a_dir)
    pb = page_mesh(col, name + "_B", w, h)
    pb.data.materials.append(paper_duo(name + "_matB", None, inner_b, flip_back=True))
    pb.location = (x, y, z)
    pb.rotation_euler = (0, 0, b_dir)
    if lift:  # the cover curling up at its free edge (heat of the light / a draft)
        for v in pa.data.vertices:
            u = v.co.x / w
            v.co.y -= lift * (u ** 3) * (v.co.z / h + 0.3)
    # a book folds up on its own spine: no hole is left behind it
    face = math.radians(facing_deg)
    progress = max(0.0, min(1.0, (open_deg - 70) / 90))
    d = Vector((math.cos(face), math.sin(face), 0))
    plain = bpy.data.materials.get("Paper_Plain")
    for tex, dist, lw, lh, z0 in layers:
        if progress <= 0.02:
            break
        m = B.paper_material(f"{name}_{tex}", image=img(tex))
        lay = B.panel(col, f"{name}_{tex}", lw, lh, m, bend=0.0)
        base = Vector((x, y, z)) + d * dist
        lay.location = base + Vector((0, 0, z0 * progress))
        lay.rotation_euler = (math.radians(-(1 - progress) * 88), 0, face + math.pi / 2)
        if z0 > 0.005:  # pop-up tabs: two thin strips holding the raised layer
            for side in (-1, 1):
                tab = B.panel(col, f"{name}_{tex}_tab{side}", 0.012, z0 * progress, plain, bend=0.0)
                off = Vector((-math.sin(face), math.cos(face), 0)) * (side * lw * 0.38)
                tab.location = base + off + d * 0.002
                tab.rotation_euler = (0, 0, face + math.pi / 2)
    top_a = Vector((x, y, z)) + Vector((math.cos(a_dir), math.sin(a_dir), 0)) * (w - 0.012) + Vector((0, 0, h - 0.01))
    return dict(top=top_a, spine=Vector((x, y, z)), pages=(pa, pb))


def hang_tags(col, a, b, sag, tags, mat_cache):
    """Paper tags clipped along a thread (same catenary as pliego.thread)."""
    rnd = random.Random(len(tags) * 13)
    for t, tex in tags:
        p = a.lerp(b, t)
        p.z -= sag * 4 * t * (1 - t)
        w, h, string = 0.042, 0.059, 0.022
        m = mat_cache.setdefault(tex, B.paper_material("Tag_" + tex, image=img(tex)))
        tag = B.panel(col, "Tag_" + tex, w, h, m, bend=0.0)
        tag.location = p - Vector((0, 0, h + string))
        tag.rotation_euler = (math.radians(rnd.uniform(-4, 4)), 0, math.radians(rnd.uniform(-35, 35)) + math.atan2(
            b.y - a.y, b.x - a.x))
        B.thread(col, p, p - Vector((0, 0, string)), bpy.data.materials["Thread_Red"], sag=0.0)


def lookout(col, x, y, mat):
    """A folded box (a pop-up platform) with accordion stairs down to the route."""
    top_z, tw, td = 0.09, 0.20, 0.17
    z = B.height(x, y)

    def box(name, cx, cy, cz, sx, sy, sz):
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        o = bpy.context.object
        for c in o.users_collection:
            c.objects.unlink(o)
        col.objects.link(o)
        o.name = name
        o.location = (cx, cy, cz)
        o.scale = (sx, sy, sz)
        bv = o.modifiers.new("bevel", "BEVEL")
        bv.width = 0.0008
        o.data.materials.append(mat)
        return o

    box("Lookout_top", x, y, z + top_z - 0.0008, tw, td, 0.0016)
    for sgn in (-1, 1):  # side walls (the fold that holds the top up)
        box(f"Lookout_wall{sgn}", x, y + sgn * (td / 2 - 0.0008), z + top_z / 2, tw, 0.0016, top_z)
    box("Lookout_back", x - tw / 2 + 0.0008, y, z + top_z / 2, 0.0016, td, top_z)
    steps, run = 7, 0.020
    for i in range(steps):  # accordion: each fold is a riser and a tread
        rise = top_z * (steps - i) / (steps + 1)
        sx_ = x + tw / 2 + run * (i + 0.5)
        box(f"Stair_{i}", sx_, y, z + rise / 2, run, 0.07, rise)
    return Vector((x, y, z + top_z))


def mathview_material(contours):
    """Celadon glaze with the graph grid fired in; with the light on, its level
    curves glow (amber): 'see the math, not just read it'."""
    mat = B.solid_material("Glaze_MathView", (0.46, 0.58, 0.52), rough=0.22, coat=0.8,
                           lines=(0.02, (0.30, 0.40, 0.36)))
    if contours <= 0:
        return mat
    nt = mat.node_tree
    bsdf = B.principled(nt)
    tc = B.node(nt, "ShaderNodeTexCoord", (-900, -300))
    sep = B.node(nt, "ShaderNodeSeparateXYZ", (-750, -300))
    B.link(nt, tc.outputs["Object"], sep.inputs[0])
    sc = B.node(nt, "ShaderNodeMath", (-600, -300))
    sc.operation = "DIVIDE"
    sc.inputs[1].default_value = 0.0045
    B.link(nt, sep.outputs["Z"], sc.inputs[0])
    pp = B.node(nt, "ShaderNodeMath", (-450, -300))
    pp.operation = "PINGPONG"
    pp.inputs[1].default_value = 0.5
    B.link(nt, sc.outputs[0], pp.inputs[0])
    mr = B.node(nt, "ShaderNodeMapRange", (-300, -300))
    mr.inputs["From Min"].default_value = 0.06
    mr.inputs["From Max"].default_value = 0.0
    B.link(nt, pp.outputs[0], mr.inputs["Value"])
    # only on the top surface (its normal points up), not on the tile's sides
    geo = B.node(nt, "ShaderNodeNewGeometry", (-600, -500))
    sepn = B.node(nt, "ShaderNodeSeparateXYZ", (-450, -500))
    B.link(nt, geo.outputs["Normal"], sepn.inputs[0])
    up = B.node(nt, "ShaderNodeMapRange", (-300, -500))
    up.inputs["From Min"].default_value = 0.5
    up.inputs["From Max"].default_value = 0.8
    B.link(nt, sepn.outputs["Z"], up.inputs["Value"])
    both = B.node(nt, "ShaderNodeMath", (-150, -400))
    both.operation = "MULTIPLY"
    B.link(nt, mr.outputs[0], both.inputs[0])
    B.link(nt, up.outputs[0], both.inputs[1])
    strength = B.node(nt, "ShaderNodeMath", (0, -400))
    strength.operation = "MULTIPLY"
    strength.inputs[1].default_value = contours
    B.link(nt, both.outputs[0], strength.inputs[0])
    bsdf.inputs["Emission Color"].default_value = (1.0, 0.70, 0.32, 1)
    B.link(nt, strength.outputs[0], bsdf.inputs["Emission Strength"])
    return mat


def mathview_extras(col, mv, contours):
    mv.data.materials[0] = mathview_material(contours)
    porc = B.solid_material("Axis_Porcelain", B.PORCELAIN, rough=0.3, coat=0.6)
    w, d = 0.30, 0.26

    def rod(name, a, b, r=0.0028):
        a, b = Vector(a), Vector(b)
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=(b - a).length, vertices=24)
        o = bpy.context.object
        for c in o.users_collection:
            c.objects.unlink(o)
        col.objects.link(o)
        o.name = name
        o.location = (a + b) / 2
        o.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
        o.data.materials.append(porc)
        B.shade_smooth(o)
        bpy.ops.mesh.primitive_cone_add(radius1=r * 2.4, radius2=0, depth=r * 6, vertices=24)
        tip = bpy.context.object
        for c in tip.users_collection:
            c.objects.unlink(tip)
        col.objects.link(tip)
        tip.location = b
        tip.rotation_euler = o.rotation_euler
        tip.data.materials.append(porc)
        for p in (o, tip):
            p.parent = mv
            p.matrix_parent_inverse.identity()
        return o

    c0 = (-w / 2 - 0.012, -d / 2 - 0.012, 0.004)
    rod("Axis_x", c0, (w / 2 + 0.03, -d / 2 - 0.012, 0.004))
    rod("Axis_y", c0, (-w / 2 - 0.012, d / 2 + 0.03, 0.004))
    rod("Axis_z", c0, (-w / 2 - 0.012, -d / 2 - 0.012, 0.11))
    for k in range(1, 6):  # ticks
        t = -w / 2 + k * w / 6
        rod(f"Tick_x{k}", (t, -d / 2 - 0.012, 0.004), (t, -d / 2 - 0.024, 0.004), r=0.0012)
    # its card, cut from the sheet beside the tile
    card_m = B.paper_material("Paper_card_mathview", image=img("card-mathview"))
    card = B.panel(col, "Card_MathView", 0.10, 0.056, card_m, bend=0.0)
    corner = mv.matrix_world @ Vector((w / 2 + 0.05, -d / 2 - 0.035, 0))
    card.location = (corner.x, corner.y, B.height(corner.x, corner.y))
    card.rotation_euler = (math.radians(14), 0, mv.rotation_euler.z + math.radians(8))


# --- the evolved field ----------------------------------------------------------------
BOOKS = {
    # name: (x, y, w, h, cover texture, inner A, inner B, layers)
    # layers: (texture, distance from spine, width, height, raised by)
    "q-context": (-0.46, -0.08, 0.24, 0.48, "q-context", "sketch-a", "sketch-b",
                  [("ctx-note", 0.05, 0.21, 0.133, 0.20), ("ctx-hypothesis", 0.11, 0.23, 0.146, 0.09),
                   ("ctx-finding", 0.17, 0.21, 0.133, 0.0)]),
    "q-agents": (-0.14, -0.38, 0.22, 0.40, "q-agents", "sketch-b", "sketch-a",
                 [("ag-fork", 0.04, 0.13, 0.13, 0.19), ("ag-next", 0.09, 0.20, 0.127, 0.11),
                  ("ag-hypothesis", 0.14, 0.22, 0.139, 0.04), ("ag-failed", 0.19, 0.19, 0.12, 0.0)]),
    "q-mcp": (-0.12, 0.15, 0.25, 0.54, "q-mcp", "sketch-a", "sketch-b", []),
}


def facing_to_route(x, y):
    best = min(((ax + (bx - ax) * t, ay + (by - ay) * t) for (ax, ay), (bx, by) in zip(B.ROUTE, B.ROUTE[1:])
                for t in (i / 20 for i in range(21))), key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)
    return math.degrees(math.atan2(best[1] - y, best[0] - x))


def build_world15(state):
    # Entrega 1's world minus what evolves here: the three books, Local Models (now
    # lying down) and the small draft where the lookout now stands.
    keep_q = [q for q in B.QUESTIONS if q[0] not in BOOKS and q[0] != "q-local"]
    saved = (B.QUESTIONS, B.DRAFTS, B.THREADS)
    B.QUESTIONS = keep_q
    B.DRAFTS = [d for d in B.DRAFTS if not (abs(d[1] + 0.60) < 0.01 and abs(d[2] - 0.10) < 0.01)]
    B.THREADS = []
    try:
        built = B._build_world_e1(state)
    finally:
        B.QUESTIONS, B.DRAFTS, B.THREADS = saved
    col = bpy.data.collections["PLIEGO"]
    cutters = bpy.data.collections["PLIEGO_CUTTERS"]
    plain = bpy.data.materials["Paper_Plain"]

    tops = {}
    opening = {"q-context": state.get("ctx_open", 0), "q-agents": state.get("ag_open", 0),
               "q-mcp": state.get("mcp_open", 0)}
    for name, (x, y, w, h, cover, ia, ib, layers) in BOOKS.items():
        facing = state.get("facing_" + name, facing_to_route(x, y))
        res = book(col, cutters, "Book_" + name, x, y, facing, w, h, opening[name],
                   img(cover, B.TEX), img(ia, B.TEX), img(ib, B.TEX), layers,
                   lift=state.get("lift_" + name))
        tops[name] = res["top"]
    for name, x, y, w, h, tilt, _ in B.QUESTIONS:
        if name in ("q-ux", "q-arch"):
            o = bpy.data.objects["Q_" + name]
            tops[name] = o.matrix_world @ Vector((w / 2 - 0.01, 0.0, h - 0.012))

    # Local Models: paused, lying flat beside the path (a place to rest)
    lm = B.paper_material("Paper_local_paused", image=img("local-paused"))
    bench = B.popup(col, cutters, "Bench_q-local", 0.04, -0.26, 0.17, 0.23, lm, rot=math.radians(90), tilt=3,
                    bend=0.0)
    state["_bench"] = bench

    # the red thread and its tags (the notebook's relatedIds; notes as tags)
    red = bpy.data.materials.get("Thread_Red") or B.solid_material("Thread_Red", (0.50, 0.10, 0.07), rough=0.6)
    cache = {}
    taut = state.get("taut", 0.0)
    pairs = [("q-context", "q-arch", 0.05, [(0.45, "tag-auto")]),
             ("q-agents", "q-mcp", 0.05 * (1 - taut) + 0.004, [(0.55, "tag-mcp")]),
             ("q-ux", "q-context", 0.06, [(0.5, "tag-ux")])]
    for a, b, sag, tags in pairs:
        B.thread(col, tops[a], tops[b], red, sag=sag)
        hang_tags(col, tops[a], tops[b], sag, tags, cache)

    state["_lookout"] = lookout(col, -0.68, 0.15, plain)
    mathview_extras(col, built["mathview"], state.get("contours", 0.0))
    return built


B._build_world_e1 = B.build_world
B.build_world = build_world15

# --- shots ------------------------------------------------------------------------------
LOOKOUT_TOP = (-0.68, 0.15, 0.09 + B.height(-0.68, 0.15))
BENCH = (0.155, -0.26, B.height(0.155, -0.26) + 0.0026)
CTX = dict(ctx_open=150, **{"facing_q-context": -125})
AG = {"facing_q-agents": -90}
CAM_B = ((-0.40, -0.98, 0.44), (-0.03, -0.25, 0.06), 32, 11.0)  # one camera for the whole interaction

SHOTS = {
    "debug-top": dict(time="day", aspect=(1, 1), haze=0.0, ortho=1.2, state=dict(CTX, **AG, ag_open=150),
                      cam=((-0.15, -0.20, 2.0), (-0.15, -0.1999, 0.0), None, None),
                      scope=("at", BENCH, 200, ("clip", "Idle", 0.0))),
    # A: the field, three views of the same place
    "a1-wide": dict(time="dawn", aspect=(16, 9), haze=0.35, state=dict(CTX, **AG),
                    cam=((-1.12, -1.00, 0.78), (-0.20, 0.02, 0.06), 28, None),
                    scope=("at", LOOKOUT_TOP, None, ("held", dict(pitch=-3.0, eye_dz=1.2))),
                    look_at=(0.45, 0.18)),
    "a2-inside": dict(time="dawn", aspect=(16, 9), haze=0.4, state=dict(CTX, **AG),
                      cam=((-0.50, -0.50, 0.05), (-0.22, 0.04, 0.17), 18, 5.6),
                      scope=(-0.26, -0.20, None, ("held", dict(pitch=-3.0, eye_dz=1.2, eye_h=1.06, yaw=4.0,
                                                                ant_pitch=4.0))),
                      look_at=(-0.55, -0.12)),
    "a3-discovery": dict(time="dawn", aspect=(16, 9), haze=0.3, state=dict(CTX, **AG), eye=0.6,
                         scope=(-0.54, -0.37, None, ("clip", "Focus.L", 1.3)), look_at=(-0.56, -0.17),
                         cam=((-0.92, -0.27, 0.10), (-0.50, -0.22, 0.11), 26, 5.6)),
    # B: Scope opens a question (same camera, six beats)
    "b1-rest": dict(time="day", aspect=(16, 9), haze=0.35, state=dict(AG), cam=CAM_B,
                    scope=("at", BENCH, -120, ("held", dict(eye_h=0.88, pitch=3.0, eye_dz=-0.6, squash=0.985)))),
    "b2-notice": dict(time="day", aspect=(16, 9), haze=0.35, state=dict(AG, **{"lift_q-agents": 0.035}), cam=CAM_B,
                      scope=("at", BENCH, None, ("clip", "Focus.L", 1.0)), look_at=(-0.14, -0.20)),
    "b3-approach": dict(time="day", aspect=(16, 9), haze=0.35, state=dict(AG, **{"lift_q-agents": 0.035}),
                        scope=(-0.12, -0.09, None, ("clip", "Focus.R", 1.3)), look_at=(-0.14, -0.18),
                        rel=(55, 0.38, 0.10, 30, 5.6, 0.5)),
    "b4-push": dict(time="day", aspect=(16, 9), haze=0.35, state=dict(AG, ag_open=45),
                    scope=(-0.14, -0.125, -90, ("held", dict(pitch=8.0, fwd=3.6, eye_h=0.9, ant_pitch=9.0,
                                                               squash=0.97))),
                    look_at=(-0.14, -0.38), cam=((-0.14, -0.355, 0.055), (-0.14, -0.10, 0.085), 22, 4.0)),
    "b5-open": dict(time="day", aspect=(16, 9), haze=0.35, state=dict(AG, ag_open=150, taut=1.0, mcp_open=40),
                    cam=CAM_B, scope=(0.13, -0.41, None, ("clip", "Bounce", 0.47)), look_at=(-0.14, -0.46)),
    "b6-follow": dict(time="day", aspect=(16, 9), haze=0.35, state=dict(AG, ag_open=150, taut=1.0, mcp_open=40),
                      cam=CAM_B, scope=(0.04, -0.52, None, ("held", dict(yaw=-8.0, pitch=-3.0, eye_dx=-3.2,
                                                                          eye_dz=1.4, ant_pitch=5.0))),
                      look_at=(-0.14, -0.46)),
    # C: MathView, discovered inside the lamp's circle
    "c1-place": dict(time="day", aspect=(16, 9), haze=0.3, state=dict(CTX, **AG),
                     cam=((0.88, -0.32, 0.55), (0.42, 0.22, 0.0), 30, None),
                     scope=(0.37, 0.05, None, ("clip", "LookAround.R", 0.62)), look_at=(0.40, 0.31)),
    "c2-close": dict(time="day", aspect=(16, 9), haze=0.25, state=dict(CTX, **AG),
                     cam=((0.72, -0.02, 0.29), (0.40, 0.30, 0.03), 30, 8.0),
                     scope=("mathview", (0.37, 0.28), None, ("held", dict(yaw=4.0, pitch=4.0, eye_dx=1.8,
                                                                           eye_dz=-1.0, eye_h=1.08))),
                     look_at=(0.55, 0.12)),
    "c3-active": dict(time="day", aspect=(16, 9), haze=0.25, state=dict(CTX, **AG, contours=6.0),
                      cam=((0.72, -0.02, 0.29), (0.40, 0.30, 0.03), 30, 8.0),
                      scope=("mathview", (0.37, 0.28), None, ("clip", "Focus.L", 1.3)), look_at=(0.46, 0.21)),
    # D: the first seconds of the home (same camera as Entrega 1's home)
    "d2-lampon": dict(time="lampon", aspect=(16, 9), haze=0.3, eye=1.5, bounce=0, state=dict(AG),
                      cam=B.SHOTS["home"]["cam"], scope=(-0.52, -0.34, None, ("clip", "Focus.L", 1.3)),
                      look_at=(-0.70, -0.50)),
    "d3-home": dict(B.SHOTS["home"], state=dict(AG)),
    "d4-invite": dict(time="dawn", aspect=(16, 9), haze=0.5, state=dict(AG, next_tilt=55),
                      cam=B.SHOTS["home"]["cam"],
                      scope=(-0.52, -0.34, None, ("held", dict(yaw=-6.0, pitch=2.0, eye_dx=-3.0, eye_dz=-0.6,
                                                                eye_h=1.08, ant_pitch=5.0))),
                      look_at=(-0.80, -0.36)),
}

# the moment the lamp comes on: still the loader's night, a first warm pool far away
B.TIMES["lampon"] = dict(world=((0.0045, 0.0065, 0.014), 1.0), sky=(0.03, 0.035, 0.07),
                         window=((0.45, 0.55, 0.95), 12.0), lamp=60.0, bulb=30.0, haze=(0.03, 0.035, 0.08),
                         exposure=0.35)


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = dict(shot="a1-wide", res=960, samples=24, out=os.path.join(HERE, "..", "renders", "test"), project=0)
    it = iter(argv)
    for a in it:
        k = a.lstrip("-")
        v = next(it)
        o[k] = int(v) if k in ("res", "samples", "project") else v
    return o


def resolve(spec):
    """Shot-level helpers that need the book layout."""
    sc = spec["scope"]
    if sc[0] == "front_of_book":
        name, dist = sc[1], sc[2]
        x, y = BOOKS[name][:2]
        f = math.radians(spec.get("state", {}).get("facing_" + name, facing_to_route(x, y)))
        px, py = x + math.cos(f) * dist, y + math.sin(f) * dist
        spec = dict(spec, scope=(px, py, None, spec.get("pose", ("clip", "Focus.L", 1.3))), look_at=(x, y))
    return spec


def main():
    o = parse()
    B.PROJECT = bool(o["project"])
    for n in o["shot"].split(","):
        B.render_shot(n, resolve(SHOTS[n]), o["res"], o["samples"], os.path.abspath(o["out"]))


if __name__ == "__main__":
    main()
