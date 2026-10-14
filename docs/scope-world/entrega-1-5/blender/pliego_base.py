"""(Entrega 1.5 lab copy of docs/scope-world/blender/pliego.py; importable, the original is untouched.)

PLIEGO: concept renders of Scope World around the approved Scope.

The world is one large sheet of paper on the maker's desk, cut and folded
(kirigami), lit by the maker's lamp. Paper is what is not built yet; light
held long enough fires paper into porcelain, so everything inside the lamp's
pool has hardened (the projects) and anything crossing its edge is half
paper, half porcelain. See docs/scope-world/02-biblia.md.

The approved Scope is opened read-only from assets/scope-3d/blender/scope-master.blend
and never saved. It is only placed (rig object transform) and posed with the
approved channels (scope3d/clips.py), either at a frame of an existing clip or
as a held pose inside the rig's authored ranges. Nothing about the character
is modified.

Run (headless, CPU only):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
      --python docs/scope-world/blender/pliego.py -- --shot main [--res 1920] [--samples 128] [--out <dir>]
  --shot accepts a name, a comma list, or "all".
"""

import math
import os
import sys
import time

sys.dont_write_bytecode = True  # the scope3d package has versioned __pycache__; never touch it
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
SCOPE_SCRIPTS = os.path.join(ROOT, "assets", "scope-3d", "scripts")
sys.path.insert(0, SCOPE_SCRIPTS)

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from scope3d import clips as C, faceshell as F, spec as S  # noqa: E402

BLEND = os.path.join(ROOT, "assets", "scope-3d", "blender", "scope-master.blend")
TEX = os.path.join(HERE, "..", "..", "textures")  # Entrega 1 textures, shared

# --- world layout (metres; Scope's body is ~0.15 m) ---------------------------------
SHEET_X, SHEET_Y = 1.0, 0.7          # half extents of the sheet
POOL = Vector((0.45, 0.18))          # centre of the lamp's pool on the sheet
POOL_R = 0.36
LAMP_HEAD = Vector((0.47, 0.20, 1.25))
LAMP_BASE = Vector((1.38, 0.14, 0.0))
LAMP_ELBOW = Vector((1.30, 0.34, 1.05))
MARGIN_X = -0.80
RULE = 0.03                          # ruled-line spacing
ROUTE = [(-0.64, -0.46), (-0.30, -0.22), (0.05, -0.03), (0.40, 0.14), (0.70, 0.42), (0.86, 0.04)]

# flattened folds: (a, b, amplitude, width); a,b = segment ends. Negative = valley.
CREASES = [
    ((0.0, -0.7), (0.0, 0.7), -0.0035, 0.018),
    ((-1.0, 0.0), (1.0, 0.0), 0.0025, 0.022),
    ((-0.5, -0.7), (-0.5, 0.7), 0.0018, 0.016),
    ((0.5, -0.7), (0.5, 0.7), -0.0015, 0.016),
    ((-0.64, -0.46), (0.40, 0.14), -0.0045, 0.03),  # the route: one long valley fold
]

PAPER = (0.80, 0.77, 0.70)
PORCELAIN = (0.86, 0.83, 0.76)
GRAPHITE = (0.10, 0.10, 0.11)


def _seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


def height(x, y):
    """Floor height of the sheet at (x, y): old folds pressed flat again."""
    return sum(amp * math.exp(-_seg_dist((x, y), a, b) / w) for a, b, amp, w in CREASES)


# --- helpers ----------------------------------------------------------------------------
def collection(name):
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    return col


def obj_from(name, verts, faces, col, uvs=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if uvs is not None:
        layer = me.uv_layers.new(name="UV")
        for poly in me.polygons:
            for li in poly.loop_indices:
                layer.data[li].uv = uvs[me.loops[li].vertex_index]
    me.update()
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    return o


def shade_smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True


def node(nt, kind, loc=(0, 0), **inputs):
    n = nt.nodes.new(kind)
    n.location = loc
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def link(nt, a, b):
    nt.links.new(a, b)


def principled(nt):
    return next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")


# --- materials ----------------------------------------------------------------------------
def _fired_factor(nt):
    """1 inside the lamp's pool, 0 outside, with an irregular edge (world space)."""
    geo = node(nt, "ShaderNodeNewGeometry", (-1400, 0))
    sep = node(nt, "ShaderNodeSeparateXYZ", (-1200, 0))
    link(nt, geo.outputs["Position"], sep.inputs[0])
    dx = node(nt, "ShaderNodeMath", (-1000, 60))
    dx.operation = "SUBTRACT"
    dx.inputs[1].default_value = POOL.x
    link(nt, sep.outputs["X"], dx.inputs[0])
    dy = node(nt, "ShaderNodeMath", (-1000, -60))
    dy.operation = "SUBTRACT"
    dy.inputs[1].default_value = POOL.y
    link(nt, sep.outputs["Y"], dy.inputs[0])
    comb = node(nt, "ShaderNodeCombineXYZ", (-850, 0))
    link(nt, dx.outputs[0], comb.inputs[0])
    link(nt, dy.outputs[0], comb.inputs[1])
    length = node(nt, "ShaderNodeVectorMath", (-700, 0))
    length.operation = "LENGTH"
    link(nt, comb.outputs[0], length.inputs[0])
    noise = node(nt, "ShaderNodeTexNoise", (-850, -200))
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 6.0
    link(nt, geo.outputs["Position"], noise.inputs["Vector"])
    wob = node(nt, "ShaderNodeMath", (-700, -200))
    wob.operation = "MULTIPLY_ADD"
    wob.inputs[1].default_value = 0.09
    wob.inputs[2].default_value = -0.045
    link(nt, noise.outputs["Fac"], wob.inputs[0])
    d = node(nt, "ShaderNodeMath", (-550, 0))
    d.operation = "ADD"
    link(nt, length.outputs["Value"], d.inputs[0])
    link(nt, wob.outputs[0], d.inputs[1])
    fired = node(nt, "ShaderNodeMapRange", (-400, 0))
    fired.interpolation_type = "SMOOTHSTEP"
    fired.inputs["From Min"].default_value = POOL_R + 0.012
    fired.inputs["From Max"].default_value = POOL_R - 0.012
    link(nt, d.outputs[0], fired.inputs["Value"])
    # the toasted ring where paper turns: a narrow band just outside the edge
    ring = node(nt, "ShaderNodeMapRange", (-400, -220))
    ring.interpolation_type = "SMOOTHSTEP"
    ring.inputs["From Min"].default_value = POOL_R + 0.03
    ring.inputs["From Max"].default_value = POOL_R + 0.008
    link(nt, d.outputs[0], ring.inputs["Value"])
    band = node(nt, "ShaderNodeMath", (-250, -220))
    band.operation = "SUBTRACT"
    link(nt, ring.outputs[0], band.inputs[0])
    link(nt, fired.outputs[0], band.inputs[1])
    bandc = node(nt, "ShaderNodeMath", (-120, -220))
    bandc.operation = "MAXIMUM"
    bandc.inputs[1].default_value = 0.0
    link(nt, band.outputs[0], bandc.inputs[0])
    return fired.outputs[0], bandc.outputs[0]


def paper_material(name, image=None, ruled=False, fire=True, tint=PAPER):
    """Paper (translucent, grain), optionally with handwriting and/or ruled lines;
    fired into glazed porcelain inside the lamp's pool."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    bsdf = principled(nt)
    bsdf.location = (300, 200)
    bsdf.inputs["Roughness"].default_value = 0.88
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
    color = node(nt, "ShaderNodeRGB", (-200, 400))
    color.outputs[0].default_value = (*tint, 1)
    col_out = color.outputs[0]

    if image is not None:
        tc = node(nt, "ShaderNodeTexCoord", (-700, 600))
        img = node(nt, "ShaderNodeTexImage", (-500, 600))
        img.image = image
        img.extension = "CLIP"
        link(nt, tc.outputs["UV"], img.inputs["Vector"])
        mul = node(nt, "ShaderNodeMix", (0, 500))
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        link(nt, col_out, mul.inputs["A"])
        link(nt, img.outputs["Color"], mul.inputs["B"])
        col_out = mul.outputs["Result"]

    if ruled:
        geo = node(nt, "ShaderNodeNewGeometry", (-900, 900))
        sep = node(nt, "ShaderNodeSeparateXYZ", (-750, 900))
        link(nt, geo.outputs["Position"], sep.inputs[0])
        # horizontal rules: pale grey-blue, below the top band of the sheet
        scaled = node(nt, "ShaderNodeMath", (-600, 950))
        scaled.operation = "DIVIDE"
        scaled.inputs[1].default_value = RULE
        link(nt, sep.outputs["Y"], scaled.inputs[0])
        fr = node(nt, "ShaderNodeMath", (-450, 950))
        fr.operation = "PINGPONG"
        fr.inputs[1].default_value = 0.5
        link(nt, scaled.outputs[0], fr.inputs[0])
        line = node(nt, "ShaderNodeMapRange", (-300, 950))
        line.inputs["From Min"].default_value = 0.035
        line.inputs["From Max"].default_value = 0.012
        link(nt, fr.outputs[0], line.inputs["Value"])
        top = node(nt, "ShaderNodeMapRange", (-300, 800))
        top.inputs["From Min"].default_value = SHEET_Y - 0.08
        top.inputs["From Max"].default_value = SHEET_Y - 0.09
        link(nt, sep.outputs["Y"], top.inputs["Value"])
        rules = node(nt, "ShaderNodeMath", (-150, 900))
        rules.operation = "MULTIPLY"
        link(nt, line.outputs[0], rules.inputs[0])
        link(nt, top.outputs[0], rules.inputs[1])
        rmix = node(nt, "ShaderNodeMix", (50, 800))
        rmix.data_type = "RGBA"
        rmix.inputs["B"].default_value = (0.42, 0.50, 0.62, 1)
        fac = node(nt, "ShaderNodeMath", (-50, 980))
        fac.operation = "MULTIPLY"
        fac.inputs[1].default_value = 0.55
        link(nt, rules.outputs[0], fac.inputs[0])
        link(nt, fac.outputs[0], rmix.inputs["Factor"])
        link(nt, col_out, rmix.inputs["A"])
        # the margin: one vertical line in a muted vermilion
        mx = node(nt, "ShaderNodeMath", (-600, 700))
        mx.operation = "SUBTRACT"
        mx.inputs[1].default_value = MARGIN_X
        link(nt, sep.outputs["X"], mx.inputs[0])
        mabs = node(nt, "ShaderNodeMath", (-450, 700))
        mabs.operation = "ABSOLUTE"
        link(nt, mx.outputs[0], mabs.inputs[0])
        mline = node(nt, "ShaderNodeMapRange", (-300, 650))
        mline.inputs["From Min"].default_value = 0.0024
        mline.inputs["From Max"].default_value = 0.0014
        link(nt, mabs.outputs[0], mline.inputs["Value"])
        mmix = node(nt, "ShaderNodeMix", (200, 700))
        mmix.data_type = "RGBA"
        mmix.inputs["B"].default_value = (0.52, 0.12, 0.08, 1)
        mf = node(nt, "ShaderNodeMath", (50, 620))
        mf.operation = "MULTIPLY"
        mf.inputs[1].default_value = 0.8
        link(nt, mline.outputs[0], mf.inputs[0])
        link(nt, mf.outputs[0], mmix.inputs["Factor"])
        link(nt, rmix.outputs["Result"], mmix.inputs["A"])
        col_out = mmix.outputs["Result"]

    # paper grain: fine noise on colour and a whisper of bump
    grain = node(nt, "ShaderNodeTexNoise", (-500, 250))
    grain.inputs["Scale"].default_value = 900.0
    grain.inputs["Detail"].default_value = 2.0
    gmix = node(nt, "ShaderNodeMix", (150, 350))
    gmix.data_type = "RGBA"
    gmix.blend_type = "MULTIPLY"
    gmix.inputs["Factor"].default_value = 0.08
    link(nt, col_out, gmix.inputs["A"])
    link(nt, grain.outputs["Color"], gmix.inputs["B"])
    col_out = gmix.outputs["Result"]
    bump = node(nt, "ShaderNodeBump", (100, 0))
    bump.inputs["Strength"].default_value = 0.06
    bump.inputs["Distance"].default_value = 0.0004
    link(nt, grain.outputs["Fac"], bump.inputs["Height"])
    link(nt, bump.outputs["Normal"], bsdf.inputs["Normal"])

    link(nt, col_out, bsdf.inputs["Base Color"])
    trans = node(nt, "ShaderNodeBsdfTranslucent", (300, -150))
    link(nt, col_out, trans.inputs["Color"])
    link(nt, bump.outputs["Normal"], trans.inputs["Normal"])
    paper = node(nt, "ShaderNodeMixShader", (550, 100))
    paper.inputs["Fac"].default_value = 0.32
    link(nt, bsdf.outputs[0], paper.inputs[1])
    link(nt, trans.outputs[0], paper.inputs[2])
    result = paper.outputs[0]

    if fire:
        fired, band = _fired_factor(nt)
        porc = node(nt, "ShaderNodeBsdfPrincipled", (550, -300))
        pcol = node(nt, "ShaderNodeMix", (350, -400))
        pcol.data_type = "RGBA"
        pcol.inputs["Factor"].default_value = 0.6
        pcol.inputs["B"].default_value = (*PORCELAIN, 1)
        link(nt, col_out, pcol.inputs["A"])  # writing and rules stay visible under the glaze
        toast = node(nt, "ShaderNodeMix", (450, -500))
        toast.data_type = "RGBA"
        toast.inputs["B"].default_value = (0.36, 0.20, 0.09, 1)
        link(nt, band, toast.inputs["Factor"])
        link(nt, pcol.outputs["Result"], toast.inputs["A"])
        link(nt, toast.outputs["Result"], porc.inputs["Base Color"])
        porc.inputs["Roughness"].default_value = 0.3
        porc.inputs["Coat Weight"].default_value = 0.7
        porc.inputs["Coat Roughness"].default_value = 0.04
        # the burnt band also darkens the paper side
        ptoast = node(nt, "ShaderNodeMixShader", (750, 0))
        tb = node(nt, "ShaderNodeBsdfDiffuse", (550, -100))
        tb.inputs["Color"].default_value = (0.30, 0.17, 0.08, 1)
        link(nt, band, ptoast.inputs["Fac"])
        link(nt, result, ptoast.inputs[1])
        link(nt, tb.outputs[0], ptoast.inputs[2])
        final = node(nt, "ShaderNodeMixShader", (950, 0))
        link(nt, fired, final.inputs["Fac"])
        link(nt, ptoast.outputs[0], final.inputs[1])
        link(nt, porc.outputs[0], final.inputs[2])
        result = final.outputs[0]

    out.location = (1150, 0)
    link(nt, result, out.inputs["Surface"])
    return mat


def solid_material(name, color, rough=0.5, coat=0.0, metal=0.0, emission=None, strength=0.0, lines=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    b = principled(nt)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.05
    if emission:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = strength
    if lines:
        # engraved grid in the glaze (object space): MathView's graph paper fired in
        spacing, dark = lines
        tc = node(nt, "ShaderNodeTexCoord", (-900, 300))
        sep = node(nt, "ShaderNodeSeparateXYZ", (-750, 300))
        link(nt, tc.outputs["Object"], sep.inputs[0])
        acc = None
        for i, axis in enumerate(("X", "Y")):
            sc = node(nt, "ShaderNodeMath", (-600, 350 - 120 * i))
            sc.operation = "DIVIDE"
            sc.inputs[1].default_value = spacing
            link(nt, sep.outputs[axis], sc.inputs[0])
            pp = node(nt, "ShaderNodeMath", (-450, 350 - 120 * i))
            pp.operation = "PINGPONG"
            pp.inputs[1].default_value = 0.5
            link(nt, sc.outputs[0], pp.inputs[0])
            mr = node(nt, "ShaderNodeMapRange", (-300, 350 - 120 * i))
            mr.inputs["From Min"].default_value = 0.05
            mr.inputs["From Max"].default_value = 0.02
            link(nt, pp.outputs[0], mr.inputs["Value"])
            if acc is None:
                acc = mr.outputs[0]
            else:
                mx = node(nt, "ShaderNodeMath", (-150, 300))
                mx.operation = "MAXIMUM"
                link(nt, acc, mx.inputs[0])
                link(nt, mr.outputs[0], mx.inputs[1])
                acc = mx.outputs[0]
        mix = node(nt, "ShaderNodeMix", (0, 300))
        mix.data_type = "RGBA"
        mix.inputs["A"].default_value = (*color, 1)
        mix.inputs["B"].default_value = (*dark, 1)
        link(nt, acc, mix.inputs["Factor"])
        link(nt, mix.outputs["Result"], b.inputs["Base Color"])
    return mat


# --- geometry -----------------------------------------------------------------------------
def build_sheet(col, mat, cutters):
    step = 0.005
    nx, ny = int(2 * SHEET_X / step), int(2 * SHEET_Y / step)
    verts, uvs, faces = [], [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x, y = -SHEET_X + i * step, -SHEET_Y + j * step
            verts.append((x, y, height(x, y)))
            uvs.append((i / nx, j / ny))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    o = obj_from("Pliego_Sheet", verts, faces, col, uvs)
    shade_smooth(o)
    o.data.materials.append(mat)
    sol = o.modifiers.new("thickness", "SOLIDIFY")
    sol.thickness = 0.0012
    sol.offset = -1
    if cutters.objects:
        bo = o.modifiers.new("cut-outs", "BOOLEAN")
        bo.operation = "DIFFERENCE"
        bo.operand_type = "COLLECTION"
        bo.collection = cutters
        for solver in ("MANIFOLD", "EXACT"):
            try:
                bo.solver = solver
                break
            except TypeError:
                continue
    return o


def cutter_box(cutters, name, center, size, rot_z):
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    o = bpy.context.object
    for c in o.users_collection:
        c.objects.unlink(o)
    cutters.objects.link(o)
    o.name = name
    o.location = center
    o.scale = size
    o.rotation_euler = (0, 0, rot_z)
    o.hide_render = True
    o.display_type = "WIRE"
    return o


def panel(col, name, w, h, mat, thickness=0.0012, bend=0.0):
    """A sheet standing up from its hinge: origin at the bottom-centre edge,
    face toward -Y (local). `bend` curls it a little, as paper does."""
    segs_x, segs_z = 24, 32
    verts, uvs, faces = [], [], []
    for j in range(segs_z + 1):
        for i in range(segs_x + 1):
            u, v = i / segs_x, j / segs_z
            x = (u - 0.5) * w
            curl = bend * (v ** 2) * h + bend * 0.3 * math.sin(u * math.pi) * h * v
            verts.append((x, curl, v * h))
            uvs.append((u, v))
    for j in range(segs_z):
        for i in range(segs_x):
            a = j * (segs_x + 1) + i
            faces.append((a, a + 1, a + segs_x + 2, a + segs_x + 1))
    o = obj_from(name, verts, faces, col, uvs)
    shade_smooth(o)
    o.data.materials.append(mat)
    s = o.modifiers.new("thickness", "SOLIDIFY")
    s.thickness = thickness
    return o


def face_toward(x, y, tx, ty):
    """Z rotation so a panel's front (-Y local) faces the point (tx, ty)."""
    return math.atan2(ty - y, tx - x) + math.pi / 2


def popup(col, cutters, name, x, y, w, h, mat, toward=None, rot=None, tilt=90.0, bend=0.02):
    """Kirigami: the panel is lifted out of the sheet around its hinge and
    leaves its own hole behind it."""
    rz = rot if rot is not None else face_toward(x, y, *toward)
    p = panel(col, name, w, h, mat, bend=bend)
    p.location = (x, y, height(x, y) - 0.0006)
    p.rotation_euler = (math.radians(90 - tilt), 0, rz)
    back = Vector((-math.sin(rz), math.cos(rz), 0))  # behind the panel (+Y local)
    centre = Vector((x, y, 0)) + back * (h / 2 + 0.002)
    cutter_box(cutters, name + "_hole", centre, (w + 0.002, h, 0.06), rz)
    return p


def arch(col, cutters, name, x, y, along_deg, radius, depth, mat):
    """A strip cut from the sheet and bowed into a gate over the route."""
    segs, verts, faces, uvs = 40, [], [], []
    for i in range(segs + 1):
        a = math.pi * i / segs
        for k, d in enumerate((-depth / 2, depth / 2)):
            verts.append((radius * math.cos(a), d, radius * math.sin(a) * 1.15))
            uvs.append((i / segs, k))
    for i in range(segs):
        faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    o = obj_from(name, verts, faces, col, uvs)
    shade_smooth(o)
    o.data.materials.append(mat)
    s = o.modifiers.new("thickness", "SOLIDIFY")
    s.thickness = 0.0012
    rz = math.radians(along_deg) + math.pi / 2
    o.location = (x, y, height(x, y))
    o.rotation_euler = (0, 0, rz)
    # its strip came out of the sheet right beside it
    side = Vector((math.cos(rz), math.sin(rz), 0))
    perp = Vector((-side.y, side.x, 0))
    cutter_box(cutters, name + "_hole", Vector((x, y, 0)) + perp * (depth + 0.006),
               (2 * radius * 1.4, depth, 0.06), rz)
    return o


def tent(col, name, x, y, w, d, h, rot, mat):
    """A folded card: two panels leaning on each other."""
    verts = [(-w / 2, -d, 0), (w / 2, -d, 0), (w / 2, 0, h), (-w / 2, 0, h), (w / 2, d, 0), (-w / 2, d, 0)]
    faces = [(0, 1, 2, 3), (3, 2, 4, 5)]
    uvs = [(0, 0), (1, 0), (1, 0.5), (0, 0.5), (1, 1), (0, 1)]
    o = obj_from(name, verts, faces, col, uvs)
    o.data.materials.append(mat)
    s = o.modifiers.new("thickness", "SOLIDIFY")
    s.thickness = 0.001
    o.location = (x, y, height(x, y))
    o.rotation_euler = (0, 0, math.radians(rot))
    return o


def half_folded_box(col, name, x, y, size, rot, mat):
    """A sheet on its way to becoming a form: a box with its lid still open."""
    s = size / 2
    v = [(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0),
         (-s, -s, size), (s, -s, size), (s, s, size), (-s, s, size)]
    lid_a = math.radians(55)
    lid = [(-s, s + size * math.cos(lid_a) * 0, size), (s, s, size),
           (s, s + size * math.cos(lid_a), size + size * math.sin(lid_a)),
           (-s, s + size * math.cos(lid_a), size + size * math.sin(lid_a))]
    flap_a = math.radians(30)
    flap = [(s, -s, size), (s, s, size), (s + 0.6 * size * math.cos(flap_a), s, size + 0.6 * size * math.sin(flap_a)),
            (s + 0.6 * size * math.cos(flap_a), -s, size + 0.6 * size * math.sin(flap_a))]
    verts = v + lid + flap
    faces = [(0, 1, 2, 3), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (8, 9, 10, 11), (12, 13, 14, 15)]
    uvs = [(0, 0)] * len(verts)
    o = obj_from(name, verts, faces, col, uvs)
    o.data.materials.append(mat)
    sm = o.modifiers.new("thickness", "SOLIDIFY")
    sm.thickness = 0.0012
    o.location = (x, y, height(x, y))
    o.rotation_euler = (0, 0, math.radians(rot))
    return o


def mathview(col, x, y, mat):
    """MathView: a function surface fired into a glazed tile you can stand on."""
    w, d, n = 0.30, 0.26, 72
    base = 0.016

    def f(u, v):
        return base + 0.022 * math.sin(2.2 * math.pi * u) * math.cos(1.6 * math.pi * v) + 0.012 * math.sin(
            3.0 * math.pi * (u + v))

    bm = bmesh.new()
    grid = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            u, v = i / n, j / n
            row.append(bm.verts.new(((u - 0.5) * w, (v - 0.5) * d, max(0.004, f(u, v)))))
        grid.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    me = bpy.data.meshes.new("MathView")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("MathView", me)
    col.objects.link(o)
    shade_smooth(o)
    o.data.materials.append(mat)
    s = o.modifiers.new("thickness", "SOLIDIFY")
    s.thickness = 0.03
    s.offset = -1
    bv = o.modifiers.new("bevel", "BEVEL")
    bv.width = 0.002
    bv.segments = 2
    o.location = (x, y, height(x, y) + 0.0)
    o.rotation_euler = (0, 0, math.radians(-18))
    return o


def mathview_height(o, px, py):
    """World height of MathView's surface at (px, py) (for standing Scope on it)."""
    local = o.matrix_world.inverted() @ Vector((px, py, 0))
    u, v = local.x / 0.30 + 0.5, local.y / 0.26 + 0.5
    base = 0.016
    val = base + 0.022 * math.sin(2.2 * math.pi * u) * math.cos(1.6 * math.pi * v) + 0.012 * math.sin(
        3.0 * math.pi * (u + v))
    return o.location.z + max(0.004, val)


def bracket(col, x, y, rot, mat_block, mat_ball):
    """Tournamently: a padel bracket built as architecture. Eight first-round
    plinths converge, round by round, into one final; each round stands taller."""
    parts = []
    rounds = [8, 4, 2, 1]
    pitch = 0.036
    for r, count in enumerate(rounds):
        hgt = 0.012 + 0.016 * r
        for k in range(count):
            spread = pitch * (2 ** r)
            yy = (k - (count - 1) / 2) * spread
            bpy.ops.mesh.primitive_cube_add(size=1.0)
            b = bpy.context.object
            for c in b.users_collection:
                c.objects.unlink(b)
            col.objects.link(b)
            b.name = f"Bracket_r{r}_{k}"
            b.scale = (0.026, 0.026 if r < 3 else 0.034, hgt)
            b.location = (r * 0.05, yy, hgt / 2)
            bv = b.modifiers.new("bevel", "BEVEL")
            bv.width = 0.003
            bv.segments = 3
            b.data.materials.append(mat_block)
            parts.append(b)
            if r > 0:  # the joins: low bridges from the two feeders
                for side in (-1, 1):
                    bpy.ops.mesh.primitive_cube_add(size=1.0)
                    j = bpy.context.object
                    for c in j.users_collection:
                        c.objects.unlink(j)
                    col.objects.link(j)
                    j.scale = (0.05, 0.006, 0.006)
                    j.location = (r * 0.05 - 0.025, yy + side * spread / 4, 0.003)
                    j.data.materials.append(mat_block)
                    parts.append(j)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0085, segments=32, ring_count=16)
    ball = bpy.context.object
    for c in ball.users_collection:
        c.objects.unlink(ball)
    col.objects.link(ball)
    ball.location = (3 * 0.05, 0, 0.012 + 0.016 * 3 + 0.0085)
    shade_smooth(ball)
    ball.data.materials.append(mat_ball)
    parts.append(ball)
    root = bpy.data.objects.new("Tournamently", None)
    col.objects.link(root)
    for p in parts:
        p.parent = root
    root.location = (x, y, height(x, y))
    root.rotation_euler = (0, 0, math.radians(rot))
    return root


def dial(col, x, y, mat_face, mat_mark):
    """Sport Coach: a rotation plan as a fired dial, glazed in Scope's own
    face colours (Scope is that product's identity)."""
    bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=0.018, vertices=96)
    d = bpy.context.object
    for c in d.users_collection:
        c.objects.unlink(d)
    col.objects.link(d)
    d.name = "SportCoach"
    shade_smooth(d)
    bv = d.modifiers.new("bevel", "BEVEL")
    bv.width = 0.004
    bv.segments = 4
    bv.limit_method = "ANGLE"
    d.data.materials.append(mat_face)
    d.location = (x, y, height(x, y) + 0.009)
    for k in range(12):
        a = 2 * math.pi * k / 12
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        m = bpy.context.object
        for c in m.users_collection:
            c.objects.unlink(m)
        col.objects.link(m)
        long = k % 3 == 0
        m.scale = (0.016 if long else 0.009, 0.004, 0.003)
        m.location = (0.066 * math.cos(a), 0.066 * math.sin(a), 0.0095)
        m.rotation_euler = (0, 0, a)
        m.data.materials.append(mat_mark)
        m.parent = d
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    hand = bpy.context.object
    for c in hand.users_collection:
        c.objects.unlink(hand)
    col.objects.link(hand)
    hand.scale = (0.05, 0.005, 0.003)
    hand.location = (0.022 * math.cos(1.0), 0.022 * math.sin(1.0), 0.011)
    hand.rotation_euler = (0, 0, 1.0)
    hand.data.materials.append(mat_mark)
    hand.parent = d
    return d


def pencil(col, x, y, rot, mats):
    """The maker's pencil: the one physical object at true scale."""
    body_m, wood_m, lead_m = mats
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0042, depth=0.15, vertices=6)
    b = bpy.context.object
    for c in b.users_collection:
        c.objects.unlink(b)
    col.objects.link(b)
    b.data.materials.append(body_m)
    bv = b.modifiers.new("bevel", "BEVEL")
    bv.width = 0.0004
    bpy.ops.mesh.primitive_cone_add(radius1=0.0042, radius2=0.0009, depth=0.02, vertices=24)
    t = bpy.context.object
    for c in t.users_collection:
        c.objects.unlink(t)
    col.objects.link(t)
    t.location = (0, 0, 0.085)
    t.data.materials.append(wood_m)
    bpy.ops.mesh.primitive_cone_add(radius1=0.0011, radius2=0.0, depth=0.005, vertices=16)
    lead = bpy.context.object
    for c in lead.users_collection:
        c.objects.unlink(lead)
    col.objects.link(lead)
    lead.location = (0, 0, 0.0975)
    lead.data.materials.append(lead_m)
    for p in (t, lead):
        p.parent = b
    b.rotation_euler = (0, math.radians(90), math.radians(rot))
    b.location = (x, y, height(x, y) + 0.0042)
    return b


def lamp(col, mat, bulb_mat):
    """The maker's architect lamp: base off the sheet, arm over it, head as the sun."""
    def rod(a, b, r):
        a, b = Vector(a), Vector(b)
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=(b - a).length, vertices=32)
        o = bpy.context.object
        for c in o.users_collection:
            c.objects.unlink(o)
        col.objects.link(o)
        o.location = (a + b) / 2
        o.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
        o.data.materials.append(mat)
        shade_smooth(o)
        return o

    bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.025, vertices=64)
    base = bpy.context.object
    for c in base.users_collection:
        c.objects.unlink(base)
    col.objects.link(base)
    base.location = LAMP_BASE + Vector((0, 0, 0.0125 - 0.004))
    base.data.materials.append(mat)
    shade_smooth(base)
    rod(LAMP_BASE + Vector((0, 0, 0.02)), LAMP_ELBOW, 0.009)
    rod(LAMP_ELBOW, LAMP_HEAD + Vector((0.08, 0.02, 0.06)), 0.008)
    for p in (LAMP_ELBOW,):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016)
        j = bpy.context.object
        for c in j.users_collection:
            c.objects.unlink(j)
        col.objects.link(j)
        j.location = p
        j.data.materials.append(mat)
        shade_smooth(j)
    # head: an open cone, mouth down toward the pool
    bpy.ops.mesh.primitive_cone_add(radius1=0.11, radius2=0.035, depth=0.15, vertices=64, end_fill_type="NOTHING")
    head = bpy.context.object
    for c in head.users_collection:
        c.objects.unlink(head)
    col.objects.link(head)
    head.location = LAMP_HEAD + Vector((0, 0, 0.04))
    head.rotation_euler = (math.radians(8), math.radians(-14), 0)
    head.data.materials.append(mat)
    s = head.modifiers.new("thickness", "SOLIDIFY")
    s.thickness = 0.003
    shade_smooth(head)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.104, minor_radius=0.004, major_segments=96)
    lip = bpy.context.object
    for c in lip.users_collection:
        c.objects.unlink(lip)
    col.objects.link(lip)
    lip.location = head.location + head.matrix_world.to_3x3() @ Vector((0, 0, -0.072))
    lip.rotation_euler = head.rotation_euler
    lip.data.materials.append(bulb_mat)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.034)
    bulb = bpy.context.object
    for c in bulb.users_collection:
        c.objects.unlink(bulb)
    col.objects.link(bulb)
    bulb.location = LAMP_HEAD + Vector((0, 0, 0.02))
    bulb.data.materials.append(bulb_mat)
    shade_smooth(bulb)
    return bulb


# --- the world ----------------------------------------------------------------------------
QUESTIONS = [
    # texture, x, y, w, h, tilt, status (real: notebook-content.ts)
    ("q-context", -0.46, -0.08, 0.26, 0.48, 90, "Testing"),
    ("q-agents", -0.14, -0.38, 0.23, 0.40, 90, "Researching"),
    ("q-mcp", -0.12, 0.15, 0.28, 0.56, 88, "Early"),
    ("q-local", 0.07, -0.21, 0.20, 0.34, 62, "Paused"),
    ("q-ux", 0.12, 0.06, 0.22, 0.44, 90, "Building"),   # on the pool's edge: half fired
    ("q-arch", -0.36, 0.30, 0.26, 0.52, 90, "Thinking"),
    ("q-next", -0.80, -0.36, 0.09, 0.12, 30, "unwritten"),
]


# unlabelled drafts (sketches or blank): the not-yet of the field, around the real questions
DRAFTS = [
    ("sketch-a", -0.64, 0.40, 0.30, 0.80, 90),
    ("sketch-b", -0.16, 0.48, 0.26, 0.66, 90),
    (None, -0.86, 0.04, 0.18, 0.38, 90),
    (None, 0.06, 0.52, 0.18, 0.50, 90),
    ("sketch-b", -0.60, 0.10, 0.15, 0.26, 80),
    (None, -0.02, 0.32, 0.12, 0.24, 90),
]
# the notebook's own links between threads (notebook-content.ts relatedIds), as a red thread
THREADS = [("q-context", "q-arch"), ("q-agents", "q-mcp"), ("q-ux", "q-context"), ("q-mcp", "q-agents")]


def thread(col, a, b, mat, sag=0.05):
    """A thin thread hung between two sheets' top corners."""
    cu = bpy.data.curves.new("Thread", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.0007
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    n = 24
    sp.points.add(n)
    for i in range(n + 1):
        t = i / n
        p = a.lerp(b, t)
        p.z -= sag * 4 * t * (1 - t)
        sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new("Thread", cu)
    col.objects.link(o)
    cu.materials.append(mat)
    return o


def build_world(state):
    world_col = collection("PLIEGO")
    cutters = collection("PLIEGO_CUTTERS")
    cutters.hide_render = False

    paper = paper_material("Paper_Sheet", ruled=True)
    plain = paper_material("Paper_Plain")
    imgs = {q[0]: bpy.data.images.load(os.path.join(TEX, q[0] + ".png")) for q in QUESTIONS}
    pattern_img = bpy.data.images.load(os.path.join(TEX, "pattern.png")) if os.path.exists(
        os.path.join(TEX, "pattern.png")) else None

    # desk: the dark the sheet lies on (the loader's night)
    desk_m = solid_material("Desk", (0.010, 0.012, 0.020), rough=0.42, coat=0.2)
    verts = [(-6, -6, -0.0035), (6, -6, -0.0035), (6, 6, -0.0035), (-6, 6, -0.0035)]
    desk = obj_from("Desk", verts, [(0, 1, 2, 3)], world_col)
    desk.data.materials.append(desk_m)

    route_target = lambda x, y: min(  # noqa: E731 nearest route point, to face sheets toward the path
        ((ax + (bx - ax) * t, ay + (by - ay) * t) for (ax, ay), (bx, by) in zip(ROUTE, ROUTE[1:]) for t in
         (i / 20 for i in range(21))), key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)

    tops = {}
    for name, x, y, w, h, tilt, _status in QUESTIONS:
        m = paper_material("Paper_" + name, image=imgs[name])
        tx, ty = route_target(x, y) if name != "q-next" else (-0.56, -0.52)
        if name == "q-next":  # the unwritten question, caught mid-lift
            tilt = state.get("next_tilt", tilt)
        p = popup(world_col, cutters, "Q_" + name, x, y, w, h, m, toward=(tx, ty), tilt=tilt,
                  bend=0.03 if tilt > 80 else 0.0)
        bpy.context.view_layer.update()
        tops[name] = p.matrix_world @ Vector((w / 2 - 0.01, 0.0, h - 0.012))
    for i, (tex, x, y, w, h, tilt) in enumerate(DRAFTS):
        img = bpy.data.images.load(os.path.join(TEX, tex + ".png"), check_existing=True) if tex else None
        m = paper_material(f"Paper_draft{i}", image=img) if img else plain
        tx, ty = route_target(x, y)
        popup(world_col, cutters, f"Draft_{i}", x, y, w, h, m, toward=(tx, ty), tilt=tilt, bend=0.025)
    red = solid_material("Thread_Red", (0.50, 0.10, 0.07), rough=0.6)
    for a, b in THREADS:
        thread(world_col, tops[a], tops[b], red)

    arch(world_col, cutters, "Gate", -0.28, -0.21, 35, 0.20, 0.05, plain)
    arch(world_col, cutters, "Gate2", 0.30, 0.09, 30, 0.19, 0.045, plain)
    tent(world_col, "Tent_a", -0.66, 0.36, 0.09, 0.03, 0.05, 20, plain)
    tent(world_col, "Tent_b", -0.04, 0.42, 0.07, 0.025, 0.04, -30, plain)

    # Scope's own cut-out: where the first fired piece came from
    for nm, c, s in (("ScopeHole_body", (-0.70, -0.20, 0), (0.078, 0.066, 0.06)),):
        bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=1.0, vertices=64)
        o = bpy.context.object
        for cc in o.users_collection:
            cc.objects.unlink(o)
        cutters.objects.link(o)
        o.name = nm
        o.location = c
        o.scale = s
        o.hide_render = True
    for nm, c, s in (("ScopeHole_stalk", (-0.705, -0.11, 0), (0.0035, 0.026, 0.06)),):
        cutter_box(cutters, nm, Vector(c), s, math.radians(-12))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=0.06, vertices=32)
    o = bpy.context.object
    for cc in o.users_collection:
        cc.objects.unlink(o)
    cutters.objects.link(o)
    o.location = (-0.698, -0.086, 0)
    o.hide_render = True
    for fx in (-0.045, 0.045):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.014, depth=0.06, vertices=32)
        o = bpy.context.object
        for cc in o.users_collection:
            cc.objects.unlink(o)
        cutters.objects.link(o)
        o.location = (-0.70 + fx, -0.262, 0)
        o.scale = (1, 0.8, 1)
        o.hide_render = True

    # inside the pool: the fired projects
    celadon = solid_material("Glaze_Celadon", (0.46, 0.58, 0.52), rough=0.22, coat=0.8,
                             lines=(0.02, (0.30, 0.40, 0.36)))
    mv = mathview(world_col, 0.40, 0.31, celadon)
    bisque = solid_material("Bisque_Terracotta", (0.55, 0.30, 0.18), rough=0.75)
    ball = solid_material("Glaze_Ball", (0.78, 0.74, 0.22), rough=0.35, coat=0.4)
    bracket(world_col, 0.50, -0.02, 18, bisque, ball)
    face = solid_material("Glaze_Ink", (0.012, 0.012, 0.016), rough=0.1, coat=1.0)
    mark = solid_material("Glaze_Ivory", PORCELAIN, rough=0.3, coat=0.6)
    dial(world_col, 0.66, 0.24, face, mark)

    # the classroom: rows of small first pieces folded from the same pattern,
    # facing the standing sheet that carries the pattern
    import random
    rnd = random.Random(7)
    for r in range(3):
        for k in range(3):
            x = 0.64 + k * 0.10 + rnd.uniform(-0.01, 0.01)
            y = 0.46 + r * 0.085 + rnd.uniform(-0.008, 0.008)
            tent(world_col, f"Student_{r}_{k}", x, y, 0.07 + rnd.uniform(-0.01, 0.01), 0.024,
                 0.045 + rnd.uniform(-0.008, 0.012), rnd.uniform(-12, 12), plain)
    pm = paper_material("Paper_Pattern", image=pattern_img) if pattern_img else plain
    popup(world_col, cutters, "Pattern", 0.74, 0.69, 0.30, 0.21, pm, rot=0.0, tilt=84, bend=0.0)

    # contact: by the lamp's foot, a blank folded note and the pencil
    body_m = solid_material("Pencil_Paint", (0.03, 0.05, 0.11), rough=0.45, coat=0.3)
    wood_m = solid_material("Pencil_Wood", (0.62, 0.45, 0.28), rough=0.7)
    lead_m = solid_material("Pencil_Lead", GRAPHITE, rough=0.35, metal=0.6)
    pencil(world_col, 0.84, -0.16, 28, (body_m, wood_m, lead_m))
    if state.get("letter"):
        tent(world_col, "Letter", 0.86, 0.02, 0.07, 0.022, 0.035, 200, plain)
    if state.get("planted"):
        tent(world_col, "Planted", -0.25, 0.0, 0.07, 0.022, 0.035, 160, plain)
    if state.get("folding"):
        half_folded_box(world_col, "Folding", *state["folding"], 0.085, 25, plain)

    lamp_m = solid_material("Lamp_Enamel", (0.018, 0.022, 0.034), rough=0.38, coat=0.4)
    bulb_m = solid_material("Bulb", (1, 0.9, 0.7), emission=(1.0, 0.78, 0.5), strength=state.get("bulb", 40.0))
    lamp(world_col, lamp_m, bulb_m)

    sheet = build_sheet(world_col, paper, cutters)
    under = paper_material("Paper_Under", ruled=True, fire=False, tint=(0.70, 0.67, 0.61))
    for k, (dz, off) in enumerate(((-0.0026, (0.004, -0.003)), (-0.0042, (-0.003, 0.005)))):
        v = [(-SHEET_X + off[0], -SHEET_Y + off[1], dz), (SHEET_X + off[0], -SHEET_Y + off[1], dz),
             (SHEET_X + off[0], SHEET_Y + off[1], dz), (-SHEET_X + off[0], SHEET_Y + off[1], dz)]
        pg = obj_from(f"Page_{k}", v, [(0, 1, 2, 3)], world_col)
        pg.data.materials.append(under)
        sm = pg.modifiers.new("thickness", "SOLIDIFY")
        sm.thickness = 0.0012
    return dict(sheet=sheet, mathview=mv)


# --- light, time of day ----------------------------------------------------------------------
WINDOW_DIR = (-1.0, 0.55, 0.32)  # from the sheet toward the window (left, a little behind)

TIMES = {
    # world colour/strength, window (colour, power), lamp spot power, bulb, haze colour
    "night": dict(world=((0.0045, 0.0065, 0.014), 1.0), sky=(0.02, 0.03, 0.06), window=((0.45, 0.55, 0.95), 14.0),
                  lamp=0.0, bulb=0.0, haze=(0.02, 0.03, 0.07), exposure=0.3),
    "dawn": dict(world=((0.012, 0.013, 0.024), 1.0), sky=(0.30, 0.27, 0.36), window=((0.70, 0.74, 1.0), 110.0),
                 lamp=200.0, bulb=80.0, haze=(0.16, 0.15, 0.20), exposure=0.35),
    "day": dict(world=((0.030, 0.030, 0.036), 1.0), sky=(0.55, 0.53, 0.55), window=((0.90, 0.93, 1.0), 170.0),
                lamp=200.0, bulb=80.0, haze=(0.30, 0.29, 0.30), exposure=0.15),
    "dusk": dict(world=((0.012, 0.009, 0.014), 1.0), sky=(0.40, 0.18, 0.12), window=((1.0, 0.52, 0.28), 90.0),
                 lamp=200.0, bulb=80.0, haze=(0.14, 0.08, 0.07), exposure=0.3),
    "lamp": dict(world=((0.004, 0.005, 0.010), 1.0), window=((0.45, 0.55, 0.95), 3.0), lamp=200.0, bulb=80.0,
                 haze=(0.05, 0.05, 0.08)),
}


def lighting(time_key, col):
    t = TIMES[time_key]
    w = bpy.context.scene.world or bpy.data.worlds.new("Pliego")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
    bg.inputs["Strength"].default_value = t["world"][1]
    # the room's air: darker overhead, brighter toward the window along the horizon
    tc = node(nt, "ShaderNodeTexCoord", (-900, 0))
    dot = node(nt, "ShaderNodeVectorMath", (-700, 0))
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = Vector(WINDOW_DIR).normalized()
    link(nt, tc.outputs["Generated"], dot.inputs[0])
    ramp = node(nt, "ShaderNodeMapRange", (-500, 0))
    ramp.interpolation_type = "SMOOTHSTEP"
    ramp.inputs["From Min"].default_value = 0.2
    ramp.inputs["From Max"].default_value = 1.0
    link(nt, dot.outputs["Value"], ramp.inputs["Value"])
    mix = node(nt, "ShaderNodeMix", (-300, 0))
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*t["world"][0], 1)
    mix.inputs["B"].default_value = (*t.get("sky", t["world"][0]), 1)
    link(nt, ramp.outputs[0], mix.inputs["Factor"])
    link(nt, mix.outputs["Result"], bg.inputs["Color"])

    # the window: big, soft, from behind-left, low; it sets the hour
    data = bpy.data.lights.new("Window", "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = 1.6, 0.9
    data.color = t["window"][0]
    data.energy = t["window"][1]
    win = bpy.data.objects.new("Window", data)
    col.objects.link(win)
    win.location = Vector(WINDOW_DIR).normalized() * 2.6
    win.rotation_euler = (Vector((0.0, 0.0, 0.0)) - win.location).to_track_quat("-Z", "Y").to_euler()

    if t["lamp"] > 0:
        data = bpy.data.lights.new("LampSpot", "SPOT")
        data.energy = t["lamp"] * 1.85
        data.color = (1.0, 0.80, 0.56)
        data.spot_size = math.radians(78)
        data.spot_blend = 0.55
        data.shadow_soft_size = 0.03
        sp = bpy.data.objects.new("LampSpot", data)
        col.objects.link(sp)
        sp.location = LAMP_HEAD
        target = Vector((POOL.x, POOL.y, 0))
        sp.rotation_euler = (target - sp.location).to_track_quat("-Z", "Y").to_euler()
    return t


def eye_light(arm, power):
    """Scope's eyes light what he looks at (night shots): a small amber point
    just in front of the face glass, standing in for the emissive eyes' reach."""
    data = bpy.data.lights.new("EyeLight", "SPOT")
    data.energy = power
    data.color = (1.0, 0.80, 0.55)
    data.spot_size = math.radians(75)
    data.spot_blend = 0.9
    data.shadow_soft_size = 0.02
    o = bpy.data.objects.new("EyeLight", data)
    bpy.context.scene.collection.objects.link(o)
    o.location = arm.matrix_world @ Vector((0.0, -0.10, 0.075))
    ahead = arm.matrix_world @ Vector((0.0, -0.24, -0.06))  # where the gaze lands, down the paper
    o.rotation_euler = (ahead - o.location).to_track_quat("-Z", "Y").to_euler()
    # light linking: the glow reaches the world, not Scope's own shell
    try:
        o.light_linking.receiver_collection = bpy.data.collections["PLIEGO"]
    except (AttributeError, KeyError) as e:
        print("[pliego] light linking unavailable:", e)
    return o


def paper_bounce(arm, cam_loc, power):
    """The bright sheet bounces light back up into Scope: a soft card low on
    the camera side, so the ceramic keeps its ivory instead of going brown."""
    data = bpy.data.lights.new("Bounce", "AREA")
    data.size = 0.25
    data.energy = power
    data.color = (1.0, 0.99, 0.97)
    o = bpy.data.objects.new("Bounce", data)
    bpy.context.scene.collection.objects.link(o)
    centre = arm.matrix_world @ Vector((0, 0, 0.07))
    to_cam = (Vector(cam_loc) - centre)
    to_cam.z = 0
    o.location = centre + to_cam.normalized() * 0.32 + Vector((0, 0, 0.05))
    o.rotation_euler = (centre - o.location).to_track_quat("-Z", "Y").to_euler()
    return o


def compositor(haze, haze_amount, bloom=0.5):
    scene = bpy.context.scene
    vl = scene.view_layers[0]
    vl.use_pass_mist = True
    w = scene.world
    w.mist_settings.start = 0.6
    w.mist_settings.depth = 4.0
    w.mist_settings.falloff = "QUADRATIC"
    tree = bpy.data.node_groups.new("Pliego_Comp", "CompositorNodeTree")
    tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = tree.nodes.new("CompositorNodeRLayers")
    out = tree.nodes.new("NodeGroupOutput")
    img = rl.outputs["Image"]
    try:
        mix = tree.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mul = tree.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = haze_amount
        tree.links.new(rl.outputs["Mist"], mul.inputs[0])
        tree.links.new(mul.outputs[0], mix.inputs["Factor"])
        tree.links.new(img, mix.inputs["A"])
        mix.inputs["B"].default_value = (*haze, 1)
        img = mix.outputs["Result"]
    except Exception as e:  # noqa: BLE001 compositor API differs between versions
        print("[pliego] haze skipped:", e)
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.inputs["Type"].default_value = "Bloom"
    glare.inputs["Threshold"].default_value = 0.95
    glare.inputs["Strength"].default_value = bloom
    glare.inputs["Size"].default_value = 0.6
    tree.links.new(img, glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], out.inputs[0])
    scene.compositing_node_group = tree


# --- Scope -------------------------------------------------------------------------------------
def setup_scope():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    arm = bpy.data.objects["Scope_Rig"]
    S.apply_profile("sheet")
    S.P["shell_center_z"] = arm.data.bones["body"].head_local.z
    S.P["display_center_z"] = S.P["shell_center_z"] + S.P["display_center_dz"]
    F.reset()
    for owner in (arm, bpy.data.objects["Scope_Eyes"].data.shape_keys):
        if owner.animation_data:
            owner.animation_data.action = None
            owner.animation_data.use_nla = False
    studio = bpy.data.collections.get("STUDIO")
    if studio:
        for o in list(studio.objects):
            bpy.data.objects.remove(o)
    return arm


def held(**channels):
    """A held pose built from the approved channels, inside their authored ranges."""
    return C.Clip("Held", 1.0, {ch: (lambda v: (lambda t: v))(val) for ch, val in channels.items()}, [])


def pose_scope(arm, pose):
    rig = dict(arm=arm, eyes=bpy.data.objects["Scope_Eyes"])
    by_name = {c.name: c for c in C.all_clips()}
    if pose[0] == "clip":
        C.apply(rig, by_name[pose[1]], pose[2])
    else:
        C.apply(rig, held(**pose[1]), 0.5)
    bpy.context.view_layer.update()


def place_scope(arm, x, y, heading_deg, z=None):
    """Stand Scope at (x, y) facing `heading_deg` (0 = +X, CCW)."""
    arm.location = (x, y, height(x, y) if z is None else z)
    arm.rotation_euler = (0, 0, math.radians(heading_deg + 90))
    bpy.context.view_layer.update()


def heading_to(x, y, tx, ty):
    return math.degrees(math.atan2(ty - y, tx - x))


# --- shots -------------------------------------------------------------------------------------
# cam: (location, target, lens mm, f-stop or None)
SHOTS = {
    # 12.1: the world, wide; Scope at the margin looking in, the lamp as the sun
    "main": dict(time="dawn", aspect=(16, 9), haze=0.5, state=dict(next_tilt=60),
                 cam=((-0.93, -0.67, 0.065), (0.0, 0.16, 0.30), 18, None),
                 scope=(-0.70, -0.47, 158, ("held", dict(yaw=3.0, pitch=-2.0, eye_dx=2.0, eye_dz=1.0,
                                                          eye_h=1.06, ant_pitch=-3.0, roll=1.0)))),
    # 12.2: the home's first screen (UI is composed over it in HTML)
    "home": dict(time="dawn", aspect=(16, 9), haze=0.5,
                 cam=((-0.84, -0.69, 0.10), (-0.66, -0.20, 0.09), 24, 4.0),
                 scope=(-0.52, -0.34, None, ("held", dict(yaw=-5.0, pitch=-1.2, eye_dx=-2.6, eye_dz=0.7,
                                                           eye_h=1.04, roll=-1.0))),
                 look_at=(-0.90, -0.69)),
    "home-m": dict(time="dawn", aspect=(9, 16), haze=0.5,
                   cam=((-0.70, -0.69, 0.10), (-0.62, -0.26, 0.16), 26, 4.0),
                   scope=(-0.58, -0.30, None, ("held", dict(yaw=-3.0, pitch=-1.0, eye_dx=-1.8, eye_dz=0.6,
                                                             eye_h=1.04))),
                   look_at=(-0.70, -0.69)),
    # 12.3: the whole sheet from high up
    "map": dict(time="day", aspect=(16, 10), haze=0.1, ortho=2.55,
                cam=((-1.45, -2.15, 2.35), (0.13, 0.08, 0.12), None, None),
                scope=(-0.60, -0.50, -120, ("clip", "Idle", 0.0))),
}

# 12.4: the storyboard (one route, one day). rel = (side deg off the gaze, distance,
# height, lens, f-stop, aim blend Scope->target)
SHOTS.update({
    "sb1-night": dict(time="night", aspect=(16, 9), haze=0.3, eye=3.5, bounce=0,
                      scope=(-0.60, -0.50, None, ("clip", "Focus.L", 1.3)), look_at=(-0.48, -0.64),
                      rel=(62, 0.40, 0.07, 32, 4.0, 0.35)),
    "sb2-lamp": dict(time="dawn", aspect=(16, 9), haze=0.5,
                     scope=(-0.58, -0.50, None, ("held", dict(pitch=-4.0, eye_dz=1.8, eye_h=1.08, ant_pitch=-4.0))),
                     look_at=(0.47, 0.20), cam=((-0.84, -0.60, 0.035), (-0.25, -0.22, 0.34), 16, None)),
    "sb3-question": dict(time="dawn", aspect=(16, 9), haze=0.45, eye=0.8,
                         scope=("front_of", ("Q_q-context", 0.13, 0.0), None, ("clip", "Focus.L", 1.3)),
                         rel=(58, 0.42, 0.05, 22, 5.6, 0.45), aim_z=0.20),
    "sb4-folding": dict(time="day", aspect=(16, 9), haze=0.45, state=dict(folding=(-0.02, -0.06)),
                        scope=(-0.17, -0.15, None, ("clip", "Tilt.L", 0.8)), look_at=(-0.02, -0.06),
                        rel=(-62, 0.42, 0.08, 30, 5.6, 0.5)),
    "sb5-firing": dict(time="day", aspect=(16, 9), haze=0.4, state=dict(folding=(0.30, -0.15)),
                       scope=(0.17, -0.27, None, ("clip", "Focus.R", 1.3)), look_at=(0.30, -0.15),
                       rel=(-62, 0.40, 0.08, 30, 5.6, 0.55)),
    "sb6-pieces": dict(time="day", aspect=(16, 9), haze=0.35,
                       scope=("mathview", (0.37, 0.28), None, ("held", dict(yaw=4.0, pitch=3.5, eye_dx=1.8,
                                                                             eye_dz=-0.8, eye_h=1.1,
                                                                             ant_pitch=6.0))),
                       look_at=(0.52, -0.02), rel=(58, 0.55, 0.16, 28, 8.0, 0.45)),
    "sb7-class": dict(time="dusk", aspect=(16, 9), haze=0.4,
                      cam=((0.36, 0.14, 0.24), (0.76, 0.55, 0.04), 32, 11.0),
                      scope=(0.92, 0.44, None, ("clip", "Tilt.R", 0.8)), look_at=(0.80, 0.47)),
    "sb8-note": dict(time="lamp", aspect=(16, 9), haze=0.3, state=dict(letter=True),
                     scope=(0.76, -0.06, None, ("clip", "Focus.R", 1.3)), look_at=(0.86, 0.02),
                     rel=(-58, 0.40, 0.08, 30, 5.6, 0.5)),
    "sb9-planted": dict(time="night", aspect=(16, 9), haze=0.3, eye=3.5, bounce=0,
                        state=dict(planted=True),
                        scope=(-0.27, 0.09, None, ("held", dict(eye_h=0.95, pitch=4.0, eye_dz=-0.8,
                                                                  yaw=3.0, eye_dx=1.2))),
                        look_at=(-0.25, 0.0), cam=((-0.17, -0.33, 0.10), (-0.26, 0.03, 0.06), 35, 4.0)),
})


def _clear(dg, a, b):
    """True if nothing but Scope stands between points a and b."""
    scene = bpy.context.scene
    d = b - a
    hit, _loc, _n, _i, obj, _m = scene.ray_cast(dg, a, d.normalized(), distance=d.length - 0.004)
    return (not hit) or obj.name.startswith("Scope_")


def clear_camera(arm, spec):
    """Gaze-relative framing: start from the authored side angle and widen the
    search until the camera sees both Scope and what he looks at, unblocked."""
    side, dist, hgt, lens, fstop, blend = spec["rel"]
    dg = bpy.context.evaluated_depsgraph_get()
    sp = Vector((arm.location.x, arm.location.y, 0))
    tp = Vector((*spec["look_at"], 0))
    g = (tp - sp).normalized()
    base_z = arm.location.z
    head = arm.matrix_world @ Vector((0, 0, 0.08))
    tgt = Vector((tp.x, tp.y, base_z + 0.05))
    sign = 1 if side >= 0 else -1
    tries = []
    for dh in (0.0, 0.06, 0.12, 0.2):
        for k in range(0, 8):
            for s_try in ((side + sign * 7 * k), (side - sign * 7 * k)) if k else (side,):
                if abs(s_try) > 105 and abs(side) <= 105:  # never round to his back
                    continue
                for dd in (dist, dist * 0.8, dist * 1.2):
                    tries.append((s_try, dd, dh))
    for s_try, dd, dh in tries:
        a = math.radians(s_try)
        d = Vector((g.x * math.cos(a) - g.y * math.sin(a), g.x * math.sin(a) + g.y * math.cos(a), 0))
        loc = sp + d * dd + Vector((0, 0, base_z + hgt + dh))
        if _clear(dg, loc, head) and _clear(dg, loc, tgt) and _clear(dg, head, loc):
            aim = sp.lerp(tp, blend)
            print(f"[pliego] camera side {s_try:.0f} deg, {dd:.2f} m, +{dh:.2f} m")
            return (tuple(loc), (aim.x, aim.y, base_z + spec.get("aim_z", 0.08)), lens, fstop)
    print("[pliego] no clear camera found; using the authored one")
    a = math.radians(side)
    d = Vector((g.x * math.cos(a) - g.y * math.sin(a), g.x * math.sin(a) + g.y * math.cos(a), 0))
    aim = sp.lerp(tp, blend)
    return (tuple(sp + d * dist + Vector((0, 0, base_z + hgt))), (aim.x, aim.y, base_z + 0.08), lens, fstop)


PROJECT = False
# label anchors of the six places (map overlay)
PLACES = {
    "margen": (-0.70, -0.52, 0.0),
    "campo": (-0.30, 0.05, 0.30),
    "pliegue": (-0.20, -0.25, 0.0),
    "circulo": (0.45, 0.18, 0.06),
    "aula": (0.76, 0.56, 0.05),
    "pie": (0.86, -0.06, 0.02),
}


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = dict(shot="main", res=960, samples=32, out=os.path.join(HERE, "..", "renders"))
    it = iter(argv)
    for a in it:
        k = a.lstrip("-")
        v = next(it)
        o[k] = int(v) if k in ("res", "samples", "project") else v
    return o


def render_shot(name, spec, res, samples, out_dir):
    t0 = time.time()
    arm = setup_scope()
    state = dict(spec.get("state", {}))
    state["bulb"] = TIMES[spec["time"]]["bulb"]
    built = build_world(state)
    light_col = collection("PLIEGO_LIGHT")
    t = lighting(spec["time"], light_col)

    sx, sy, heading, pose = spec["scope"]
    z = None
    if sx == "front_of":
        panel_obj = bpy.data.objects[sy[0]]
        bpy.context.view_layer.update()
        front = panel_obj.matrix_world.to_3x3() @ Vector((0, -1, 0))
        front.z = 0
        front.normalize()
        along = panel_obj.matrix_world.to_3x3() @ Vector((1, 0, 0))
        hinge = panel_obj.matrix_world.translation
        pos = hinge + front * sy[1] + along * sy[2]
        sx, sy = pos.x, pos.y
        spec = dict(spec, look_at=(hinge.x, hinge.y))
    if sx == "at":  # explicit (x, y, z): standing on a raised paper surface
        sx, sy, z = sy
    if sx == "mathview":
        sx, sy = sy
        z = mathview_height(built["mathview"], sx, sy)
    if heading is None:
        heading = heading_to(sx, sy, *spec["look_at"])
    place_scope(arm, sx, sy, heading, z)
    pose_scope(arm, pose)
    if spec.get("eye"):
        eye_light(arm, spec["eye"])
    if spec.get("bounce", 0.8):
        cam_hint = spec["cam"][0] if "cam" in spec else None
        if cam_hint is None:
            side = math.radians(spec["rel"][0])
            g = (Vector((*spec["look_at"], 0)) - arm.location).normalized()
            cam_hint = arm.location + Vector((g.x * math.cos(side) - g.y * math.sin(side),
                                              g.x * math.sin(side) + g.y * math.cos(side), 0))
        paper_bounce(arm, cam_hint, spec.get("bounce", 0.8))

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.render.threads_mode = "FIXED"
    scene.render.threads = max(1, (os.cpu_count() or 4) - 3)
    ax, ay = spec["aspect"]
    scene.render.resolution_x = res
    scene.render.resolution_y = round(res * ay / ax)
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = t.get("exposure", 0.0)
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    if "rel" in spec:
        spec = dict(spec, cam=clear_camera(arm, spec))
    loc, target, lens, fstop = spec["cam"]
    cd = bpy.data.cameras.new("Cam_" + name)
    cam = bpy.data.objects.new("Cam_" + name, cd)
    scene.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cd.clip_start, cd.clip_end = 0.005, 40
    if spec.get("ortho"):
        cd.type = "ORTHO"
        cd.ortho_scale = spec["ortho"]
    else:
        cd.lens = lens
        cd.sensor_width = 36
        if ax < ay:
            cd.sensor_fit = "VERTICAL"
            cd.sensor_height = 36
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = (arm.matrix_world @ Vector((0, 0, 0.08)) - Vector(loc)).length
    scene.camera = cam
    compositor(t["haze"], spec.get("haze", 0.4))

    os.makedirs(out_dir, exist_ok=True)
    if PROJECT:
        # where world points land in this shot's image (0..1, y down), for HTML overlays
        import json
        from bpy_extras.object_utils import world_to_camera_view
        bpy.context.view_layer.update()
        pts = dict(PLACES, lamp=tuple(LAMP_HEAD), scope=tuple(arm.location),
                   **{f"route{i}": (x, y, height(x, y)) for i, (x, y) in enumerate(ROUTE)})
        res = {}
        for k, co in pts.items():
            v = world_to_camera_view(scene, cam, Vector(co))
            res[k] = [round(v.x, 4), round(1 - v.y, 4)]
        with open(os.path.join(out_dir, name + ".points.json"), "w", encoding="utf-8") as fh:
            json.dump(res, fh, indent=1)
        print(f"[pliego] projected {len(res)} points for {name}")
        return
    scene.render.filepath = os.path.join(out_dir, name + ".png")
    bpy.ops.render.render(write_still=True)
    print(f"[pliego] {name} {scene.render.resolution_x}x{scene.render.resolution_y} "
          f"s={samples} ({time.time() - t0:.0f}s)", flush=True)


def main():
    global PROJECT
    o = parse()
    PROJECT = bool(int(o.get("project", 0)))
    names = list(SHOTS) if o["shot"] == "all" else o["shot"].split(",")
    for n in names:
        render_shot(n, SHOTS[n], o["res"], o["samples"], os.path.abspath(o["out"]))


if __name__ == "__main__":
    main()
