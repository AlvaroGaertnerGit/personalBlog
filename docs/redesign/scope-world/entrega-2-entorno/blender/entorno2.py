"""Scope World 2.0 · Entrega 2: art pass on the environment (lab copy).

Builds on the approved Entrega 1.5 world (mundo.py -> pliego_base.py) and on
Scope's places from the Fase A study (v2-fase-a/entorno/entorno.py), all
imported read-only. What changes here, against the Fase A study:

- ONE continuous paper relief from the sheet to the horizon, instead of a flat
  land plus separate low-poly mountains: the same sheet, folded at several
  scales (soft creases, no facets), rising into ranges that melt into the air.
- the written page dissolves into the world: its ruled lines run out over the
  blank paper, bend and fade; the vermilion margin becomes a faint path.
- depth with content: paper waves (half-rolled sheets), groves of blank sheets
  gathered in the valleys, folded arches and accordion towers at mid distance.
- light with intent: a sun per shot (azimuth, height, colour), a glow in the
  sky around it, haze tinted like the horizon, and the night kept for Scope.

Scope is the approved model, read-only. Run ONE shot per Blender process:
  blender --background --factory-startup --python docs/redesign/scope-world/entrega-2-entorno/blender/entorno2.py -- \
      --shot e2-wide --res 1600 --samples 48 --out docs/redesign/scope-world/entrega-2-entorno/renders/raw
"""

import math
import os
import random
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "docs", "redesign", "scope-world", "v2-fase-a", "entorno"))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import entorno as E  # noqa: E402  (imports mundo.py and pliego_base.py; we re-patch below)

M, B = E.M, E.B
LAND_Z = -0.0013  # just under the sheet's 1.2 mm thickness: the step disappears
LAKE = (3.6, 6.2, 2.2)


def smooth01(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def tri(u):
    """Triangle wave in 0..1: a straight fold with a crease at each peak and valley."""
    f = u - math.floor(u)
    return 1.0 - abs(2.0 * f - 1.0)


# --- the relief: one sheet, folded at several scales ----------------------------------------
class Relief:
    def __init__(self, seed=5):
        rnd = random.Random(seed)
        # crease families: direction, wavelength (m), amplitude (m), phase, sharpness
        self.folds = [(rnd.uniform(0, math.pi), lam, amp, rnd.uniform(0, 1), sh)
                      for lam, amp, sh in ((16.0, 1.7, 1.6), (9.0, 0.8, 1.8), (5.0, 0.32, 2.0), (2.6, 0.10, 2.2))]
        self.warp = [(rnd.uniform(0.05, 0.12), rnd.uniform(0, 6.28)) for _ in range(3)]
        self.ridge = [(k, rnd.uniform(0, 6.28), rnd.uniform(0.3, 0.7)) for k in (2, 3, 5, 7)]

    def height(self, x, y):
        r = math.hypot(x, y)
        if r < 1.75:
            return LAND_Z
        a = math.atan2(y, x)
        # the far ranges: an uneven crown all round, higher where the light comes from behind
        crown = 1.0 + sum(w * math.sin(k * a + ph) for k, ph, w in self.ridge) * 0.35
        envelope = smooth01(2.2, 11.0, r) * 0.3 + smooth01(10.0, 36.0, r) * 6.5 * max(0.3, crown)
        wx = x + 1.6 * math.sin(y * self.warp[0][0] + self.warp[0][1])
        wy = y + 1.6 * math.sin(x * self.warp[1][0] + self.warp[1][1])
        folds = 0.0
        for th, lam, amp, ph, sh in self.folds:
            u = (wx * math.cos(th) + wy * math.sin(th)) / lam + ph
            folds += amp * (tri(u) ** sh - 0.4)
        near = smooth01(1.75, 6.0, r)
        z = envelope + folds * near * (0.25 + 0.75 * smooth01(4.0, 20.0, r))
        lx, ly, lr = LAKE
        flat = smooth01(lr + 0.1, lr + 2.2, math.hypot(x - lx, y - ly))
        return LAND_Z + max(0.0, z) * flat


def relief_mesh(col, mat, relief):
    rings, segs = 230, 420
    verts = [(0.0, 0.0, LAND_Z)]
    for i in range(1, rings + 1):
        r = 0.04 + 58.0 * (i / rings) ** 2.4
        for j in range(segs):
            a = 2 * math.pi * j / segs
            x, y = r * math.cos(a), r * math.sin(a)
            verts.append((x, y, relief.height(x, y)))
    faces = [(0, 1 + (j + 1) % segs, 1 + j) for j in range(segs)]
    for i in range(rings - 1):
        b0, b1 = 1 + i * segs, 1 + (i + 1) * segs
        for j in range(segs):
            k = (j + 1) % segs
            faces.append((b0 + j, b0 + k, b1 + k, b1 + j))
    o = B.obj_from("Relief", verts, faces, col)
    o.data.materials.append(mat)
    B.shade_smooth(o)
    return o


def land_material():
    """The blank paper of the world: the sheet's own paper, whose ruled lines and
    margin run out from the written page, bend, and fade; creases darken a touch."""
    mat = B.paper_material("Paper_World", fire=False, tint=B.PAPER)
    E.fine_grain(mat)
    nt = mat.node_tree
    bsdf = B.principled(nt)
    base = bsdf.inputs["Base Color"].links[0].from_socket
    geo = B.node(nt, "ShaderNodeNewGeometry", (-1600, -600))
    sep = B.node(nt, "ShaderNodeSeparateXYZ", (-1450, -600))
    B.link(nt, geo.outputs["Position"], sep.inputs[0])

    def math_node(op, a=None, b=None, loc=(0, 0)):
        n = B.node(nt, "ShaderNodeMath", loc)
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                B.link(nt, v, n.inputs[i])
        return n.outputs[0]

    X, Y = sep.outputs["X"], sep.outputs["Y"]
    # distance outside the sheet's rectangle
    dx = math_node("MAXIMUM", math_node("SUBTRACT", math_node("ABSOLUTE", X), 1.0), 0.0)
    dy = math_node("MAXIMUM", math_node("SUBTRACT", math_node("ABSOLUTE", Y), 0.7), 0.0)
    out = math_node("SQRT", math_node("ADD", math_node("MULTIPLY", dx, dx), math_node("MULTIPLY", dy, dy)))
    # the rules bend more the further they run, then dissolve (gone by ~2.2 m)
    bend = math_node("MULTIPLY", math_node("SINE", math_node("MULTIPLY", X, 1.7)), math_node("MULTIPLY", out, 0.05))
    yy = math_node("ADD", Y, bend)
    pp = math_node("PINGPONG", math_node("DIVIDE", yy, B.RULE), 0.5)
    line = B.node(nt, "ShaderNodeMapRange", (-500, -700))
    line.inputs["From Min"].default_value = 0.035
    line.inputs["From Max"].default_value = 0.012
    B.link(nt, pp, line.inputs["Value"])
    fade = B.node(nt, "ShaderNodeMapRange", (-500, -900))
    fade.interpolation_type = "SMOOTHSTEP"
    fade.inputs["From Min"].default_value = 2.2
    fade.inputs["From Max"].default_value = 0.0
    B.link(nt, out, fade.inputs["Value"])
    rules = math_node("MULTIPLY", math_node("MULTIPLY", line.outputs[0], fade.outputs[0]), 0.42)
    mix_r = B.node(nt, "ShaderNodeMix", (-150, -700))
    mix_r.data_type = "RGBA"
    mix_r.inputs["B"].default_value = (0.42, 0.50, 0.62, 1)
    B.link(nt, rules, mix_r.inputs["Factor"])
    B.link(nt, base, mix_r.inputs["A"])
    # the margin becomes a path: the vermilion line runs on past the sheet and wanders away
    wander = math_node("MULTIPLY", math_node("SINE", math_node("MULTIPLY", Y, 0.9)), math_node("MULTIPLY", dy, 0.35))
    mdist = math_node("ABSOLUTE", math_node("SUBTRACT", math_node("SUBTRACT", X, B.MARGIN_X), wander))
    mline = B.node(nt, "ShaderNodeMapRange", (-500, -1100))
    mline.inputs["From Min"].default_value = 0.004
    mline.inputs["From Max"].default_value = 0.0015
    B.link(nt, mdist, mline.inputs["Value"])
    mfade = B.node(nt, "ShaderNodeMapRange", (-500, -1300))
    mfade.interpolation_type = "SMOOTHSTEP"
    mfade.inputs["From Min"].default_value = 5.0
    mfade.inputs["From Max"].default_value = 0.0
    B.link(nt, out, mfade.inputs["Value"])
    mf = math_node("MULTIPLY", math_node("MULTIPLY", mline.outputs[0], mfade.outputs[0]), 0.7)
    mix_m = B.node(nt, "ShaderNodeMix", (50, -800))
    mix_m.data_type = "RGBA"
    mix_m.inputs["B"].default_value = (0.52, 0.12, 0.08, 1)
    B.link(nt, mf, mix_m.inputs["Factor"])
    B.link(nt, mix_r.outputs["Result"], mix_m.inputs["A"])
    # creases hold a little shadow (ambient occlusion), the paper cools with distance
    ao = B.node(nt, "ShaderNodeAmbientOcclusion", (-500, -1500))
    ao.inputs["Distance"].default_value = 1.2
    ao.samples = 8
    aof = B.node(nt, "ShaderNodeMapRange", (-300, -1500))
    aof.inputs["To Min"].default_value = 0.72
    B.link(nt, ao.outputs["AO"], aof.inputs["Value"])
    shade = B.node(nt, "ShaderNodeMix", (250, -900))
    shade.data_type = "RGBA"
    shade.blend_type = "MULTIPLY"
    shade.inputs["Factor"].default_value = 1.0
    B.link(nt, mix_m.outputs["Result"], shade.inputs["A"])
    gray = B.node(nt, "ShaderNodeCombineColor", (50, -1500))
    for c in ("Red", "Green", "Blue"):
        B.link(nt, aof.outputs[0], gray.inputs[c])
    B.link(nt, gray.outputs[0], shade.inputs["B"])
    for link in list(nt.links):
        if link.from_socket == base and link.to_node.type in ("BSDF_PRINCIPLED", "BSDF_TRANSLUCENT"):
            nt.links.new(shade.outputs["Result"], link.to_socket)
    return mat


# --- structures in depth ----------------------------------------------------------------------
def curved_sheet(col, mat, name, x, y, ground, w, hgt, rot, curve, lean):
    """A blank sheet standing on its edge, curved in plan like paper that wants to roll."""
    n = 10
    ca, sa = math.cos(rot), math.sin(rot)
    tl = math.radians(lean)
    verts, faces = [], []
    for i in range(n + 1):
        t = i / n - 0.5
        px = t * w
        py = curve * w * (t * t - 0.25)          # a shallow arc
        for pz in (0.0, hgt):
            dy = math.sin(tl) * pz
            wx, wy = x + px * ca - (py + dy) * sa, y + px * sa + (py + dy) * ca
            verts.append((wx, wy, ground(x, y) - 0.004 + math.cos(tl) * pz))
    for i in range(n):
        a = i * 2
        faces.append((a, a + 2, a + 3, a + 1))
    o = B.obj_from(name, verts, faces, col)
    o.data.materials.append(mat)
    B.shade_smooth(o)
    o.modifiers.new("t", "SOLIDIFY").thickness = 0.0015
    return o


def paper_wave(col, mat, name, x, y, ground, length, height, curl, rot):
    """A sheet half-rolled on itself, standing like a wave of paper."""
    n_u, n_v = 24, 40
    ca, sa = math.cos(rot), math.sin(rot)
    verts, faces = [], []
    for i in range(n_u + 1):
        u = (i / n_u - 0.5) * length
        env = 0.7 + 0.3 * math.cos(math.pi * u / length)   # lower at both ends
        R = height * env / 2.0                              # the roll's radius
        for j in range(n_v + 1):
            t = j / n_v
            ang = curl * t                                   # rises, goes over the top, curls back
            py = R * math.sin(ang) + t * height * 0.45 * env
            pz = R * (1 - math.cos(ang))
            wx, wy = x + u * ca - py * sa, y + u * sa + py * ca
            verts.append((wx, wy, ground(wx, wy) + pz - 0.01))
    for i in range(n_u):
        for j in range(n_v):
            a = i * (n_v + 1) + j
            faces.append((a, a + n_v + 1, a + n_v + 2, a + 1))
    o = B.obj_from(name, verts, faces, col)
    o.data.materials.append(mat)
    B.shade_smooth(o)
    s = o.modifiers.new("t", "SOLIDIFY")
    s.thickness = max(0.002, height * 0.006)
    return o


def arch(col, mat, name, x, y, ground, span, height, width, rot):
    n = 48
    ca, sa = math.cos(rot), math.sin(rot)
    verts, faces = [], []
    for i in range(n + 1):
        t = i / n
        u = (t - 0.5) * span
        z = height * math.sin(math.pi * t)
        for w in (-width / 2, width / 2):
            wx, wy = x + u * ca - w * sa, y + u * sa + w * ca
            verts.append((wx, wy, ground(x + u * ca, y + u * sa) + z - 0.02))
    for i in range(n):
        a = i * 2
        faces.append((a, a + 2, a + 3, a + 1))
    o = B.obj_from(name, verts, faces, col)
    o.data.materials.append(mat)
    B.shade_smooth(o)
    o.modifiers.new("t", "SOLIDIFY").thickness = max(0.004, width * 0.03)
    return o


def accordion_tower(col, mat, name, x, y, ground, height, radius, pleats=10):
    """A folded column: a strip pleated round, slightly twisted as it rises."""
    rings, verts, faces = 16, [], []
    z0 = ground(x, y) - 0.03
    for i in range(rings + 1):
        t = i / rings
        tw = t * 0.6
        rr = radius * (1.0 - 0.35 * t)
        for j in range(pleats * 2):
            a = math.pi * j / pleats + tw
            r = rr * (1.0 if j % 2 == 0 else 0.78)
            verts.append((x + r * math.cos(a), y + r * math.sin(a), z0 + t * height))
    m = pleats * 2
    for i in range(rings):
        for j in range(m):
            k = (j + 1) % m
            faces.append((i * m + j, i * m + k, (i + 1) * m + k, (i + 1) * m + j))
    o = B.obj_from(name, verts, faces, col)
    o.data.materials.append(mat)
    return o


# --- build -----------------------------------------------------------------------------------
_build_15 = E._build_15


def build_environment(col, rnd, ground, sheet_m, wave_m, lantern_glow=0.0):
    """Everything around the approved world: the lake, groves, waves, arches, towers and
    Scope's places. Shared by the renders and by export_env.py (the real-time viewer)."""
    E.LAND_Z = LAND_Z
    E.LAKE = LAKE
    E.lake(col, rnd)
    # groves of blank sheets, gathered in valleys rather than sprinkled
    groves = [(-3.2, 2.6, 1.3), (2.8, -3.0, 1.2), (-4.6, -2.2, 1.4), (5.2, 1.4, 1.1), (-1.4, 5.4, 1.6), (4.2, 5.6, 0.9)]
    k = 0
    for gx, gy, gr in groves:
        for _ in range(int(9 * gr)):
            a, d = rnd.uniform(0, 2 * math.pi), gr * math.sqrt(rnd.random())
            x, y = gx + d * math.cos(a), gy + d * math.sin(a)
            if math.hypot(x - LAKE[0], y - LAKE[1]) < LAKE[2] + 0.2:
                continue
            hgt = rnd.uniform(0.18, 0.55) * (1 + math.hypot(x, y) / 5)
            curved_sheet(col, sheet_m, f"Grove_{k}", x, y, ground, hgt * rnd.uniform(0.3, 0.7), hgt,
                         math.atan2(y - gy, x - gx) + rnd.uniform(-0.5, 0.5), rnd.uniform(-0.9, 0.9), rnd.uniform(-12, 12))
            k += 1
    # paper waves and arches at mid distance; accordion towers as landmarks
    for i, (x, y, L, H, c, rot) in enumerate([(-8.5, 5.0, 3.4, 1.4, 3.9, -0.6), (8.8, -2.6, 2.8, 1.1, 3.6, 1.9),
                                              (-3.4, 12.5, 4.6, 2.2, 4.1, 0.2), (-9.8, -5.4, 3.0, 1.2, 3.8, 2.5)]):
        paper_wave(col, wave_m, f"Wave_{i}", x, y, ground, L, H, c, rot)
    arch(col, wave_m, "Arch_0", -2.4, 7.4, ground, 3.2, 1.3, 0.35, 0.3)
    arch(col, wave_m, "Arch_1", 7.6, 4.6, ground, 2.6, 1.0, 0.3, 1.2)
    for i, (x, y, h, r) in enumerate([(-9.5, 9.0, 4.2, 0.55), (11.0, 6.5, 3.2, 0.45), (-12.5, -1.5, 3.6, 0.5)]):
        accordion_tower(col, sheet_m, f"Tower_{i}", x, y, ground, h, r)
    # Scope's places (from the Fase A study), on this paper
    E.LANTERN = (-1.20, -0.40)
    lantern_paper = B.paper_material("Paper_Lantern", fire=False, tint=(0.86, 0.82, 0.74))
    porcelain = B.solid_material("Scope_Dish", (0.86, 0.83, 0.76), rough=0.2, coat=0.8)
    E.lantern(col, lantern_paper, porcelain, lantern_glow)
    E.cabinet(col, sheet_m)
    E.radiometer(col)
    E.trails(col)


def environment_materials():
    sheet_m = B.paper_material("Paper_Standing", fire=False, tint=(0.86, 0.83, 0.77))
    E.fine_grain(sheet_m)
    for n_ in sheet_m.node_tree.nodes:   # more light through the paper: it glows against the sun
        if n_.type == "MIX_SHADER" and n_.inputs["Fac"].default_value == 0.32:
            n_.inputs["Fac"].default_value = 0.55
    wave_m = B.paper_material("Paper_Wave", fire=False, tint=(0.84, 0.81, 0.75))
    E.fine_grain(wave_m, 200.0)
    return sheet_m, wave_m


def build_world_e2(state):
    built = _build_15(state)
    if not state.get("env", True):
        return built
    rnd = random.Random(23)
    col = B.collection("ENTORNO_E2")
    desk = bpy.data.objects.get("Desk")
    if desk:
        bpy.data.objects.remove(desk, do_unlink=True)
    relief = Relief()
    relief_mesh(col, land_material(), relief)
    sheet_m, wave_m = environment_materials()
    build_environment(col, rnd, relief.height, sheet_m, wave_m, state.get("lantern_glow", 0.0))
    return built


B.build_world = build_world_e2

# --- light with intent --------------------------------------------------------------------------
_lighting = E._lighting


def lighting_e2(time_key, col):
    B.CURRENT_TIME = time_key
    t = _lighting(time_key, col)
    if not getattr(B, "ENV", True):
        return t
    az, elev, strength, color = B.SUN
    data = bpy.data.lights.new("SunE2", "SUN")
    data.color, data.energy, data.angle = color, strength, math.radians(1.6)
    sun = bpy.data.objects.new("SunE2", data)
    col.objects.link(sun)
    to_sun = Vector((math.cos(math.radians(az)) * math.cos(math.radians(elev)),
                     math.sin(math.radians(az)) * math.cos(math.radians(elev)), math.sin(math.radians(elev))))
    sun.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
    sky(to_sun, B.SKY)
    return t


def sky(to_sun, palette):
    """Zenith, horizon and a glow around the sun; replaces the room-air gradient outside."""
    zenith, horizon, glow, glow_w = palette
    nt = bpy.context.scene.world.node_tree
    bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
    tc = B.node(nt, "ShaderNodeTexCoord", (-1200, -400))
    norm = B.node(nt, "ShaderNodeVectorMath", (-1050, -400))
    norm.operation = "NORMALIZE"
    B.link(nt, tc.outputs["Generated"], norm.inputs[0])
    sep = B.node(nt, "ShaderNodeSeparateXYZ", (-900, -500))
    B.link(nt, norm.outputs[0], sep.inputs[0])
    hz = B.node(nt, "ShaderNodeMapRange", (-750, -500))
    hz.interpolation_type = "SMOOTHSTEP"
    hz.inputs["From Min"].default_value = 0.45
    hz.inputs["From Max"].default_value = -0.02
    B.link(nt, sep.outputs["Z"], hz.inputs["Value"])
    base = B.node(nt, "ShaderNodeMix", (-550, -450))
    base.data_type = "RGBA"
    base.inputs["A"].default_value = (*zenith, 1)
    base.inputs["B"].default_value = (*horizon, 1)
    B.link(nt, hz.outputs[0], base.inputs["Factor"])
    dot = B.node(nt, "ShaderNodeVectorMath", (-900, -250))
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = to_sun
    B.link(nt, norm.outputs[0], dot.inputs[0])
    gl = B.node(nt, "ShaderNodeMapRange", (-750, -250))
    gl.interpolation_type = "SMOOTHSTEP"
    gl.inputs["From Min"].default_value = 1.0 - glow_w
    gl.inputs["From Max"].default_value = 1.0
    B.link(nt, dot.outputs["Value"], gl.inputs["Value"])
    mix = B.node(nt, "ShaderNodeMix", (-350, -350))
    mix.data_type = "RGBA"
    mix.blend_type = "ADD"
    mix.inputs["B"].default_value = (*glow, 1)
    B.link(nt, gl.outputs[0], mix.inputs["Factor"])
    B.link(nt, base.outputs["Result"], mix.inputs["A"])
    B.link(nt, mix.outputs["Result"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0


B.lighting = lighting_e2

_compositor = E._compositor


def compositor_e2(haze, haze_amount, bloom=0.5):
    """Aerial perspective on the geometry only: the sky keeps its own gradient and the
    sun's glow (the mist pass is 1 on the background, so a plain haze mix flattened it)."""
    if not getattr(B, "ENV", True):
        return _compositor(haze, haze_amount, bloom)
    scene = bpy.context.scene
    if scene.camera:  # the approved script clips at 40 m; the relief reaches 58 m
        scene.camera.data.clip_end = 150.0
    vl = scene.view_layers[0]
    vl.use_pass_mist = True
    vl.use_pass_environment = True
    scene.render.film_transparent = True
    w = scene.world
    w.mist_settings.start = 1.2
    w.mist_settings.depth = 42.0
    w.mist_settings.falloff = "QUADRATIC"
    tree = bpy.data.node_groups.new("E2_Comp", "CompositorNodeTree")
    tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = tree.nodes.new("CompositorNodeRLayers")
    out = tree.nodes.new("NodeGroupOutput")
    env = next(o for o in rl.outputs if o.name in ("Env", "Environment"))
    mul = tree.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = haze_amount
    tree.links.new(rl.outputs["Mist"], mul.inputs[0])
    hz = tree.nodes.new("ShaderNodeMix")
    hz.data_type = "RGBA"
    tree.links.new(mul.outputs[0], hz.inputs["Factor"])
    tree.links.new(rl.outputs["Image"], hz.inputs["A"])
    hz.inputs["B"].default_value = (*B.HAZE, 1)
    over = tree.nodes.new("ShaderNodeMix")      # geometry over the sky, by coverage
    over.data_type = "RGBA"
    tree.links.new(rl.outputs["Alpha"], over.inputs["Factor"])
    tree.links.new(env, over.inputs["A"])
    tree.links.new(hz.outputs["Result"], over.inputs["B"])
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.inputs["Type"].default_value = "Bloom"
    glare.inputs["Threshold"].default_value = 0.95
    glare.inputs["Strength"].default_value = bloom
    glare.inputs["Size"].default_value = 0.6
    tree.links.new(over.outputs["Result"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], out.inputs[0])
    scene.compositing_node_group = tree


B.compositor = compositor_e2

# --- shots: the Fase A cameras, plus two new ones ------------------------------------------------
# sun: (azimuth°, elevation°, strength, colour); sky: (zenith, horizon, glow, glow width); hazec: haze colour
DAWN = dict(sun=(150.0, 9.0, 3.4, (1.0, 0.70, 0.45)), sky=((0.025, 0.03, 0.07), (0.40, 0.34, 0.44), (1.5, 0.85, 0.4), 0.2),
            hazec=(0.40, 0.35, 0.44))
B.TIMES["day"]["exposure"] = -0.35  # this lab copy only: the open world reflects far more light than the old black desk
DAY = dict(sun=(140.0, 32.0, 4.2, (1.0, 0.93, 0.84)), sky=((0.07, 0.11, 0.22), (0.46, 0.45, 0.45), (0.35, 0.3, 0.22), 0.12),
           hazec=(0.52, 0.51, 0.52))
DUSK = dict(sun=(200.0, 4.0, 2.6, (1.0, 0.52, 0.28)), sky=((0.03, 0.03, 0.07), (0.55, 0.30, 0.26), (1.4, 0.6, 0.25), 0.25),
            hazec=(0.45, 0.30, 0.30))
NIGHT = dict(sun=(110.0, 28.0, 0.09, (0.55, 0.64, 1.0)), sky=((0.004, 0.006, 0.014), (0.04, 0.055, 0.10), (0.02, 0.03, 0.05), 0.3),
             hazec=(0.035, 0.05, 0.09))

LOOK = dict(M.CTX, **M.AG)
SHOTS = {
    "e2-wide": dict(DAWN, sun=(190.0, 12.0, 3.8, (1.0, 0.72, 0.46)), exposure=-0.1, time="dawn", aspect=(16, 9), haze=0.65, state=dict(LOOK), cam=E.WIDE_CAM,
                    scope=("at", M.LOOKOUT_TOP, None, ("held", dict(pitch=-3.0, eye_dz=1.2))), look_at=(0.45, 0.18)),
    "e2-horizonte": dict(DAWN, sun=(72.0, 3.0, 3.0, (1.0, 0.66, 0.40)), bounce=0, time="dawn", aspect=(16, 9), haze=0.95, state=dict(LOOK),
                         cam=((0.27, 0.47, 0.10), (0.68, 1.75, 0.13), 26, None),
                         scope=("at", (0.47, 1.12, LAND_Z), None, ("held", dict(pitch=-4.0, eye_dz=1.6, eye_h=1.05, ant_pitch=3.0))),
                         look_at=(1.1, 2.4)),
    "e2-home": dict(B.SHOTS["home"], **DAWN, haze=0.9, state=dict(M.AG)),
    "e2-linterna": dict(NIGHT, time="night", aspect=(16, 9), haze=0.7, eye=0.35, bounce=0,
                        state=dict(LOOK, lantern_glow=1.6), cam=((-0.56, -0.86, 0.13), (-1.13, -0.44, 0.13), 36, 8.0),
                        scope=("at", (-1.03, -0.53, LAND_Z), None, ("held", dict(eye_h=0.96, pitch=1.0, yaw=-4.0))),
                        look_at=(-0.78, -0.64)),
    # new: eye level from the margin across the whole world (planes of depth)
    "e2-escala": dict(DAWN, sun=(100.0, 5.0, 3.2, (1.0, 0.68, 0.42)), time="dawn", aspect=(21, 9), haze=0.95, state=dict(LOOK),
                      cam=((-1.05, -1.25, 0.16), (0.6, 1.8, 0.32), 22, None),
                      scope=(-0.72, -0.52, None, ("held", dict(pitch=-3.0, eye_dz=1.4, yaw=6.0))), look_at=(0.3, 1.5)),
    # new: the circle by day with the world behind it (the day's intent: clear, warm, built)
    "e2-dia": dict(DAY, time="day", aspect=(16, 9), haze=0.6, state=dict(LOOK),
                   cam=((1.05, -0.62, 0.42), (0.20, 0.95, 0.30), 24, None),
                   scope=(0.37, 0.05, None, ("clip", "LookAround.R", 0.62)), look_at=(0.40, 0.31)),
    # new: dusk over the classroom side
    "e2-atardecer": dict(DUSK, time="dusk", aspect=(16, 9), haze=0.9, state=dict(LOOK),
                         cam=((1.35, -0.55, 0.22), (0.2, 0.9, 0.2), 24, None),
                         scope=(0.86, 0.04, None, ("held", dict(pitch=-2.0, eye_dz=1.0))), look_at=(-0.2, 1.5)),
}


def main():
    o = M.parse()
    for n in o["shot"].split(","):
        spec = SHOTS[n]
        B.ENV = spec.get("env", True)
        B.SUN, B.SKY, B.HAZE = spec["sun"], spec["sky"], spec["hazec"]
        if "exposure" in spec:  # per-shot exposure (this lab copy only)
            B.TIMES[spec["time"]] = dict(B.TIMES[spec["time"]], exposure=spec["exposure"])
        clean = {k: v for k, v in spec.items() if k not in ("sun", "sky", "hazec", "exposure")}
        B.render_shot(n, clean, o["res"], o["samples"], os.path.abspath(o["out"]))


if __name__ == "__main__":
    main()
