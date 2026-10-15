"""Scope World 2.0, Fase A (revision): the world without edges.

A lab study, not production. It imports the approved Entrega 1.5 world
(docs/scope-world/entrega-1-5/blender/mundo.py, which extends pliego_base.py)
WITHOUT modifying it, and wraps three of its steps:

- build_world: the black desk goes; the sheet now lies on a land of blank paper
  that keeps going to the horizon: dunes, folded ranges, standing blank sheets,
  a lake of ink. Plus Scope's own places: his lantern, his cabinet of found
  things, his radiometer and the trails he wears into the paper.
- lighting: a low sun (or moon) rakes the far folds so they read as paper.
- compositor: aerial perspective over tens of metres instead of four.

Scope is the approved model, read-only (placed and posed with approved channels).

Run ONE shot per Blender process (memory):
  blender --background --factory-startup --python docs/redesign/scope-world/v2-fase-a/entorno/entorno.py -- \
      --shot v-despues --res 1280 --samples 48 --out docs/redesign/scope-world/v2-fase-a/renders/raw
"""

import math
import os
import random
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "docs", "scope-world", "entrega-1-5", "blender"))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import mundo as M  # noqa: E402  (patches pliego_base.build_world on import)

B = M.B
LAND_Z = -0.0035
LANTERN = (-1.20, -0.40)
CABINET = (-1.13, -0.66)
RADIOMETER = (0.10, 0.30)
LAKE = (3.4, 5.6, 2.4)


def smooth01(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mesh(name, verts, faces, col, mat, smooth=False):
    o = B.obj_from(name, verts, faces, col)
    o.data.materials.append(mat)
    if smooth:
        B.shade_smooth(o)
    return o


def fine_grain(mat, scale=900.0):
    """The paper grain in object space, so a 100 m land keeps millimetre grain."""
    nt = mat.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    for n in nt.nodes:
        if n.type == "TEX_NOISE":
            n.inputs["Scale"].default_value = scale
            nt.links.new(tc.outputs["Object"], n.inputs["Vector"])


# --- the land: blank paper to the horizon -----------------------------------------------------
def land(col, mat, rnd):
    phases = [(rnd.uniform(0.6, 1.6), rnd.uniform(0, 6.28), rnd.uniform(0.15, 0.5)) for _ in range(5)]
    lx, ly, lr = LAKE

    def h(x, y):
        r = math.hypot(x, y)
        if r < 1.9:
            return LAND_Z
        a = math.atan2(y, x)
        dune = sum(amp * math.sin(k * r * 0.35 + ph + 2.0 * math.sin(a * 3 + ph)) for k, ph, amp in phases)
        z = smooth01(1.9, 9.0, r) * (0.22 + 0.12 * dune) + smooth01(10, 34, r) * 1.2 * (1 + 0.3 * dune)
        flat = smooth01(lr + 0.2, lr + 1.6, math.hypot(x - lx, y - ly))
        return LAND_Z + max(0.0, z) * flat

    rings, segs = 72, 160
    verts = [(0.0, 0.0, LAND_Z)]
    for i in range(1, rings + 1):
        r = 0.05 + 46.0 * (i / rings) ** 2.2
        for j in range(segs):
            a = 2 * math.pi * j / segs
            x, y = r * math.cos(a), r * math.sin(a)
            verts.append((x, y, h(x, y)))
    faces = [(0, 1 + (j + 1) % segs, 1 + j) for j in range(segs)]
    for i in range(rings - 1):
        b0, b1 = 1 + i * segs, 1 + (i + 1) * segs
        for j in range(segs):
            k = (j + 1) % segs
            faces.append((b0 + j, b0 + k, b1 + k, b1 + j))
    o = mesh("Land", verts, faces, col, mat, smooth=True)
    return o, h


def ridge(col, mat, name, cx, cy, rot, length, height, depth, n, rnd, ground):
    """A folded range: facets of paper, creased along a crest of uneven peaks."""
    ca, sa = math.cos(rot), math.sin(rot)

    def w(px, py, z):
        x, y = cx + px * ca - py * sa, cy + px * sa + py * ca
        return (x, y, ground(x, y) + z - 0.02)

    verts, faces = [], []
    for i in range(n + 1):
        u = i / n
        px = (u - 0.5) * length
        env = math.sin(math.pi * u) ** 0.8
        hh = height * env * (0.55 + 0.45 * rnd.random()) * (1.0 if i % 2 else 0.78)
        jx = rnd.uniform(-0.15, 0.15) * length / n
        verts += [w(px + jx, -depth * (0.8 + 0.4 * rnd.random()), 0.0),
                  w(px + jx * 0.5, -depth * 0.45, hh * 0.55),
                  w(px, rnd.uniform(-0.08, 0.08) * depth, hh),
                  w(px - jx * 0.5, depth * 0.45, hh * 0.5),
                  w(px - jx, depth * (0.8 + 0.4 * rnd.random()), 0.0)]
    for i in range(n):
        a, b = i * 5, (i + 1) * 5
        for k in range(4):
            faces.append((a + k, b + k, b + k + 1))
            faces.append((a + k, b + k + 1, a + k + 1))
    return mesh(name, verts, faces, col, mat)


def standing_sheet(col, mat, name, x, y, ground, w, hgt, rot, lean):
    ca, sa = math.cos(rot), math.sin(rot)
    z0 = ground(x, y) - 0.003
    tilt = math.radians(lean)
    verts = []
    for px, pz in ((-w / 2, 0), (w / 2, 0), (w / 2, hgt), (-w / 2, hgt)):
        dy = math.sin(tilt) * pz
        verts.append((x + px * ca - dy * sa, y + px * sa + dy * ca, z0 + math.cos(tilt) * pz))
    o = mesh(name, verts, [(0, 1, 2, 3)], col, mat)
    s = o.modifiers.new("t", "SOLIDIFY")
    s.thickness = max(0.0012, hgt * 0.004)
    return o


def lake(col, rnd):
    lx, ly, lr = LAKE
    n = 64
    verts = [(lx, ly, LAND_Z + 0.0008)]
    for j in range(n):
        a = 2 * math.pi * j / n
        r = lr * (1 + 0.12 * math.sin(3 * a + 1.3) + 0.06 * math.sin(7 * a))
        verts.append((lx + r * math.cos(a), ly + r * math.sin(a), LAND_Z + 0.0008))
    faces = [(0, 1 + j, 1 + (j + 1) % n) for j in range(n)]
    ink = B.solid_material("Ink_Lake", (0.004, 0.006, 0.013), rough=0.03, coat=1.0)
    return mesh("InkLake", verts, faces, col, ink)


# --- Scope's places -----------------------------------------------------------------------------
def lantern(col, paper, porcelain, glow):
    """His home: a pleated paper lantern just outside the written page, door toward it.
    At night his own light shows through the paper from inside."""
    x0, y0 = LANTERN
    n = 20
    rings = [(0.0, 0.80), (0.03, 1.0), (0.19, 1.0), (0.27, 0.86), (0.30, 0.66)]
    verts, faces = [], []
    for z, s in rings:
        for j in range(n):
            a = 2 * math.pi * j / n
            r = (0.14 if j % 2 == 0 else 0.122) * s
            verts.append((x0 + r * math.cos(a), y0 + r * math.sin(a), LAND_Z + z))
    door = {0, 1, 2, n - 1, n - 2}  # facing +x, toward the sheet: 18 cm wide, 19 cm high
    for ri in range(len(rings) - 1):
        for j in range(n):
            k = (j + 1) % n
            if ri <= 1 and j in door and k in door:
                continue
            faces.append((ri * n + j, ri * n + k, (ri + 1) * n + k, (ri + 1) * n + j))
    apex = len(verts)
    verts.append((x0, y0, LAND_Z + 0.42))
    top = (len(rings) - 1) * n
    for j in range(n):
        faces.append((top + j, top + (j + 1) % n, apex))
    o = mesh("Scope_Lantern", verts, faces, col, paper)
    s = o.modifiers.new("t", "SOLIDIFY")
    s.thickness = 0.0012
    # his dish (where he settles) and a thin lip at the door
    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.008, vertices=48)
    d = bpy.context.object
    for c in d.users_collection:
        c.objects.unlink(d)
    col.objects.link(d)
    d.location = (x0 - 0.005, y0, LAND_Z + 0.004)
    d.data.materials.append(porcelain)
    B.shade_smooth(d)
    if glow > 0:
        data = bpy.data.lights.new("LanternGlow", "POINT")
        data.energy = glow
        data.color = (1.0, 0.72, 0.42)
        data.shadow_soft_size = 0.03
        lo = bpy.data.objects.new("LanternGlow", data)
        col.objects.link(lo)
        lo.location = (x0 - 0.02, y0, LAND_Z + 0.14)
    return o


def small(col, kind, loc, mat, scale=(1, 1, 1), rot=(0, 0, 0), **kw):
    getattr(bpy.ops.mesh, f"primitive_{kind}_add")(**kw)
    o = bpy.context.object
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o)
    o.location, o.scale, o.rotation_euler = loc, scale, rot
    o.data.materials.append(mat)
    return o


def cabinet(col, paper):
    """The things he has found on Álvaro's desk, kept on folded steps: a drop of ink,
    a pencil shaving, a staple, a shard of porcelain, a crumb of graphite."""
    x0, y0 = CABINET
    ink = B.solid_material("Found_Ink", (0.004, 0.005, 0.01), rough=0.05, coat=1.0)
    wood = B.solid_material("Found_Wood", (0.62, 0.45, 0.28), rough=0.7)
    navy = B.solid_material("Found_Paint", (0.03, 0.05, 0.11), rough=0.45, coat=0.3)
    steel = B.solid_material("Found_Steel", (0.75, 0.75, 0.78), rough=0.25, metal=1.0)
    porc = B.solid_material("Found_Porcelain", (0.86, 0.83, 0.76), rough=0.2, coat=0.8)
    graph = B.solid_material("Found_Graphite", (0.06, 0.06, 0.07), rough=0.55, metal=0.3)
    steps = [(0.018, 0.0), (0.034, 0.055), (0.05, 0.11), (0.066, 0.165)]
    tops = []
    for k, (hgt, dx) in enumerate(steps):
        o = small(col, "cube", (x0 + dx - 0.08, y0, LAND_Z + hgt / 2), paper, scale=(0.026, 0.028, hgt / 2), size=1.0)
        o.scale = (0.052, 0.056, hgt)
        tops.append((x0 + dx - 0.08, y0, LAND_Z + hgt))
    t = tops
    small(col, "uv_sphere", (t[0][0], t[0][1], t[0][2] + 0.002), ink, scale=(1, 1, 0.45), radius=0.011, segments=32, ring_count=16)
    small(col, "uv_sphere", (t[0][0] + 0.016, t[0][1] - 0.012, t[0][2] + 0.002), graph, radius=0.003, segments=12, ring_count=8)
    sh = small(col, "cone", (t[1][0], t[1][1], t[1][2] + 0.008), wood, rot=(0, math.radians(84), 0.5),
               radius1=0.016, radius2=0.0025, depth=0.022, vertices=24)
    sh.modifiers.new("w", "SIMPLE_DEFORM").deform_method = "TWIST"
    small(col, "torus", (t[1][0] - 0.009, t[1][1] + 0.002, t[1][2] + 0.008), navy, rot=(0, math.radians(84), 0.5),
          major_radius=0.0155, minor_radius=0.0012)
    for dx, dz, sx, sz in ((-0.008, 0.002, 1, 0.0), (0.008, 0.002, 1, 0.0), (0.0, 0.0105, 0.0, 1)):
        if sz:
            small(col, "cylinder", (t[2][0], t[2][1], t[2][2] + 0.012), steel, rot=(0, math.radians(90), 0.3),
                  radius=0.0008, depth=0.017, vertices=8)
        else:
            small(col, "cylinder", (t[2][0] + dx * math.cos(0.3), t[2][1] + dx * math.sin(0.3), t[2][2] + 0.0068), steel,
                  radius=0.0008, depth=0.011, vertices=8)
    shard = small(col, "ico_sphere", (t[3][0], t[3][1], t[3][2] + 0.006), porc, scale=(1.4, 0.9, 0.35),
                  rot=(0.2, 0.1, 0.8), radius=0.014, subdivisions=1)
    B.shade_smooth(shard)


def radiometer(col):
    """His experiment: a light-mill. In the lamp's light (or his) the vanes turn."""
    x0, y0 = RADIOMETER
    z0 = B.height(x0, y0)
    porc = B.solid_material("Radio_Porcelain", (0.86, 0.83, 0.76), rough=0.2, coat=0.8)
    glass = bpy.data.materials.new("Radio_Glass")
    glass.use_nodes = True
    g = B.principled(glass.node_tree)
    g.inputs["Transmission Weight"].default_value = 1.0
    g.inputs["Roughness"].default_value = 0.0
    g.inputs["IOR"].default_value = 1.45
    black = B.solid_material("Radio_Black", (0.01, 0.01, 0.012), rough=0.6)
    white = B.solid_material("Radio_White", (0.9, 0.88, 0.84), rough=0.5)
    mirror = B.solid_material("Radio_Mirror", (0.9, 0.86, 0.8), rough=0.04, metal=1.0)
    small(col, "cylinder", (x0, y0, z0 + 0.008), porc, radius=0.02, depth=0.016, vertices=48)
    small(col, "cylinder", (x0, y0, z0 + 0.028), porc, radius=0.004, depth=0.03, vertices=16)
    bulb = small(col, "uv_sphere", (x0, y0, z0 + 0.075), glass, radius=0.036, segments=48, ring_count=24)
    B.shade_smooth(bulb)
    small(col, "cylinder", (x0, y0, z0 + 0.075), white, radius=0.0007, depth=0.05, vertices=8)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        small(col, "cube", (x0 + 0.017 * math.cos(a), y0 + 0.017 * math.sin(a), z0 + 0.075), black if k % 2 else white,
              scale=(0.0006, 0.007, 0.007), rot=(0, 0, a), size=1.0)
    for k, (dx, dy, ang) in enumerate(((-0.07, -0.02, 0.6), (-0.05, 0.06, -0.4), (0.03, 0.075, 1.2))):
        sh = small(col, "cube", (x0 + dx, y0 + dy, z0 + 0.012), mirror, scale=(0.014, 0.001, 0.01),
                   rot=(math.radians(-20), 0, ang), size=1.0)
        sh.scale = (0.028, 0.002, 0.02)


def trails(col):
    """Where he walks every day, worn into the paper: soft graphite."""
    mat = bpy.data.materials.new("Trail_Graphite")
    mat.use_nodes = True
    nt = mat.node_tree
    b = B.principled(nt)
    b.inputs["Base Color"].default_value = (0.14, 0.14, 0.16, 1)
    b.inputs["Roughness"].default_value = 0.6
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 60.0
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = 0.35
    ramp.inputs["From Max"].default_value = 0.75
    ramp.inputs["To Min"].default_value = 1.0
    ramp.inputs["To Max"].default_value = 0.78
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Value"])
    nt.links.new(ramp.outputs[0], mix.inputs["Fac"])
    nt.links.new(b.outputs[0], mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])  # mostly transparent, a 22 % graphite smudge at most
    paths = [
        [(-1.04, -0.40), (-0.98, -0.42), (-0.86, -0.40), (-0.72, -0.37), (-0.60, -0.35), (-0.53, -0.34)],
        [(-0.78, -0.39), (-0.76, -0.22), (-0.73, -0.02), (-0.70, 0.10)],
        [(-1.06, -0.50), (-1.08, -0.57), (-1.10, -0.62)],
    ]
    for pi_, pts in enumerate(paths):
        verts, faces = [], []
        for i, (x, y) in enumerate(pts):
            a = pts[min(i + 1, len(pts) - 1)]
            b0 = pts[max(i - 1, 0)]
            tx, ty = a[0] - b0[0], a[1] - b0[1]
            ln = math.hypot(tx, ty) or 1
            nx, ny = -ty / ln * 0.009, tx / ln * 0.009
            on_sheet = abs(x) < 1.0 and abs(y) < 0.7
            z = (B.height(x, y) + 0.0009) if on_sheet else LAND_Z + 0.0009
            verts += [(x + nx, y + ny, z), (x - nx, y - ny, z)]
            if i:
                k = 2 * i
                faces.append((k - 2, k - 1, k + 1, k))
        mesh(f"Trail_{pi_}", verts, faces, col, mat)


# --- build: the approved world, then the land around it ---------------------------------------
_build_15 = B.build_world


def build_world_v2(state):
    built = _build_15(state)
    if not state.get("env", True):
        return built
    rnd = random.Random(11)
    col = B.collection("ENTORNO")
    desk = bpy.data.objects.get("Desk")
    if desk:
        bpy.data.objects.remove(desk, do_unlink=True)
    land_m = B.paper_material("Paper_Land", fire=False, tint=(0.66, 0.63, 0.58))
    fine_grain(land_m)
    fold_m = B.paper_material("Paper_Fold", fire=False, tint=(0.80, 0.78, 0.73))
    fine_grain(fold_m, 120.0)
    blank_m = B.paper_material("Paper_Blank", fire=False, tint=(0.82, 0.80, 0.75))
    fine_grain(blank_m)
    _, ground = land(col, land_m, rnd)
    lake(col, rnd)
    # mid ring: folded hills and standing blank sheets (the questions nobody has asked yet)
    for i in range(11):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(3.8, 10.0)
        x, y = r * math.cos(a), r * math.sin(a)
        if math.hypot(x - LAKE[0], y - LAKE[1]) < LAKE[2] + 0.6:
            continue
        ridge(col, fold_m, f"Hill_{i}", x, y, a + math.pi / 2 + rnd.uniform(-0.5, 0.5), rnd.uniform(1.2, 3.6),
              rnd.uniform(0.15, 0.6), rnd.uniform(0.4, 1.0), rnd.randint(7, 11), rnd, ground)
    for i in range(46):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(1.75, 7.5)
        x, y = r * math.cos(a), r * math.sin(a)
        if (abs(x) < 1.12 and abs(y) < 0.82) or math.hypot(x - LAKE[0], y - LAKE[1]) < LAKE[2] + 0.2:
            continue
        if math.hypot(x - 1.38, y - 0.14) < 0.35 or (y < -0.6 and x < 0.4 and r < 3.5):
            continue
        hgt = rnd.uniform(0.12, 0.35) * (1 + r / 4)
        standing_sheet(col, blank_m, f"Blank_{i}", x, y, ground, hgt * rnd.uniform(0.45, 0.7), hgt,
                       rnd.uniform(0, math.pi), rnd.uniform(-6, 6))
    # far ring: the ranges, folded like the pliego's own creases, fading into the air
    for layer, (n_r, r0, r1, h0, h1) in enumerate(((16, 12.0, 17.0, 0.7, 1.9), (18, 23.0, 33.0, 1.8, 4.2))):
        for i in range(n_r):
            a = (i / n_r) * 2 * math.pi + rnd.uniform(-0.12, 0.12) + layer * 0.17
            r = rnd.uniform(r0, r1)
            ridge(col, fold_m, f"Range_{layer}_{i}", r * math.cos(a), r * math.sin(a), a + math.pi / 2,
                  rnd.uniform(7, 13), rnd.uniform(h0, h1), rnd.uniform(2.0, 4.0), rnd.randint(12, 18), rnd, ground)
    # Scope's places
    lantern_paper = B.paper_material("Paper_Lantern", fire=False, tint=(0.86, 0.82, 0.74))
    porcelain = B.solid_material("Scope_Dish", (0.86, 0.83, 0.76), rough=0.2, coat=0.8)
    lantern(col, lantern_paper, porcelain, state.get("lantern_glow", 0.0))
    cabinet(col, blank_m)
    radiometer(col)
    trails(col)
    return built


B.build_world = build_world_v2

# --- light: a low sun or moon that reads the far folds ----------------------------------------
_lighting = B.lighting
SUNS = {"dawn": ((1.0, 0.74, 0.55), 0.9, 8.0), "day": ((1.0, 0.95, 0.88), 1.8, 30.0),
        "dusk": ((1.0, 0.55, 0.32), 1.4, 6.0), "night": ((0.55, 0.64, 0.95), 0.06, 28.0),
        "lamp": ((0.55, 0.64, 0.95), 0.05, 28.0), "lampon": ((0.55, 0.64, 0.95), 0.05, 28.0)}


def lighting_v2(time_key, col):
    B.CURRENT_TIME = time_key
    t = _lighting(time_key, col)
    if not getattr(B, "ENV", True):
        return t
    color, strength, elev = SUNS.get(time_key, SUNS["day"])
    data = bpy.data.lights.new("FarSun", "SUN")
    data.color = color
    data.energy = strength
    data.angle = math.radians(2.5)
    sun = bpy.data.objects.new("FarSun", data)
    col.objects.link(sun)
    wd = Vector(B.WINDOW_DIR)
    az = math.atan2(wd.y, wd.x)
    e = math.radians(elev)
    to_sun = Vector((math.cos(az) * math.cos(e), math.sin(az) * math.cos(e), math.sin(e)))
    sun.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
    horizon_band(t)
    return t


HORIZON = {"dawn": (0.36, 0.30, 0.38), "day": (0.55, 0.53, 0.53), "dusk": (0.50, 0.26, 0.18),
           "night": (0.035, 0.045, 0.085), "lamp": (0.03, 0.04, 0.075), "lampon": (0.03, 0.04, 0.075)}


def horizon_band(t):
    """The air is brightest along the horizon, all the way round: far things melt into it."""
    nt = bpy.context.scene.world.node_tree
    bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
    src = bg.inputs["Color"].links[0].from_socket
    tc = B.node(nt, "ShaderNodeTexCoord", (-900, -300))
    sep = B.node(nt, "ShaderNodeSeparateXYZ", (-700, -300))
    B.link(nt, tc.outputs["Generated"], sep.inputs[0])
    ab = B.node(nt, "ShaderNodeMath", (-550, -300))
    ab.operation = "ABSOLUTE"
    B.link(nt, sep.outputs["Z"], ab.inputs[0])
    band = B.node(nt, "ShaderNodeMapRange", (-400, -300))
    band.interpolation_type = "SMOOTHSTEP"
    band.inputs["From Min"].default_value = 0.17
    band.inputs["From Max"].default_value = 0.0
    B.link(nt, ab.outputs[0], band.inputs["Value"])
    mix = B.node(nt, "ShaderNodeMix", (-150, -200))
    mix.data_type = "RGBA"
    mix.inputs["B"].default_value = (*HORIZON.get(B.CURRENT_TIME, HORIZON["day"]), 1)
    B.link(nt, band.outputs[0], mix.inputs["Factor"])
    B.link(nt, src, mix.inputs["A"])
    B.link(nt, mix.outputs["Result"], bg.inputs["Color"])


B.lighting = lighting_v2

# --- air: aerial perspective over tens of metres ---------------------------------------------
_compositor = B.compositor


def compositor_v2(haze, haze_amount, bloom=0.5):
    _compositor(haze, haze_amount, bloom)
    if getattr(B, "ENV", True):
        w = bpy.context.scene.world
        w.mist_settings.start = 0.8
        w.mist_settings.depth = 26.0
        w.mist_settings.falloff = "QUADRATIC"


B.compositor = compositor_v2

# --- shots --------------------------------------------------------------------------------------
LOOK = dict(M.CTX, **M.AG)
WIDE_CAM = ((-1.70, -1.75, 0.85), (0.0, 0.35, 0.15), 24, None)
SHOTS = {
    "v-antes": dict(time="dawn", aspect=(16, 9), haze=0.45, env=False, state=dict(LOOK, env=False), cam=WIDE_CAM,
                    scope=("at", M.LOOKOUT_TOP, None, ("held", dict(pitch=-3.0, eye_dz=1.2))), look_at=(0.45, 0.18)),
    "v-despues": dict(time="dawn", aspect=(16, 9), haze=0.8, state=dict(LOOK), cam=WIDE_CAM,
                      scope=("at", M.LOOKOUT_TOP, None, ("held", dict(pitch=-3.0, eye_dz=1.2))), look_at=(0.45, 0.18)),
    "v-horizonte": dict(time="dawn", aspect=(16, 9), haze=0.8, state=dict(LOOK),
                        cam=((0.27, 0.47, 0.10), (0.68, 1.75, 0.13), 26, None),
                        scope=("at", (0.47, 1.12, LAND_Z), None, ("held", dict(pitch=-4.0, eye_dz=1.6, eye_h=1.05, ant_pitch=3.0))),
                        look_at=(1.1, 2.4)),
    "v-linterna": dict(time="night", aspect=(16, 9), haze=0.5, eye=0.35, bounce=0, state=dict(LOOK, lantern_glow=1.6),
                       cam=((-0.56, -0.86, 0.13), (-1.13, -0.44, 0.13), 36, 8.0),
                       scope=("at", (-1.03, -0.53, LAND_Z), None, ("held", dict(eye_h=0.96, pitch=1.0, yaw=-4.0))),
                       look_at=(-0.78, -0.64)),
    "v-gabinete": dict(time="dawn", aspect=(16, 9), haze=0.5, state=dict(LOOK),
                       cam=((-1.07, -0.99, 0.10), (-1.14, -0.62, 0.05), 45, 8.0),
                       scope=("at", (-1.15, -0.57, LAND_Z), None, ("clip", "Focus.L", 1.3)), look_at=(-1.12, -0.66)),
    "v-radiometro": dict(time="day", aspect=(16, 9), haze=0.5, state=dict(LOOK),
                         cam=((-0.12, 0.05, 0.12), (0.13, 0.29, 0.06), 45, 8.0),
                         scope=(0.18, 0.23, None, ("clip", "Tilt.L", 0.95)), look_at=RADIOMETER),
    "v-home": dict(B.SHOTS["home"], haze=0.55, state=dict(M.AG)),
}


def main():
    o = M.parse()
    for n in o["shot"].split(","):
        spec = SHOTS[n]
        B.ENV = spec.get("env", True)
        B.render_shot(n, spec, o["res"], o["samples"], os.path.abspath(o["out"]))


if __name__ == "__main__":
    main()
