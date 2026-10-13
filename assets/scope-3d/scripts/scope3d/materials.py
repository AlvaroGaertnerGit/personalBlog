"""Principled-BSDF materials for Scope — all procedural, glTF-compatible inputs only.

VISUAL_LANGUAGE.md: "Soft ceramic shell. Matte finish. Glossy face. Warm
indirect lighting. Minimal reflections." Face, eye and accent colours come
from spec.PALETTE (the site's --scope-* tokens); the shell beige was read off
the design sheet (owner decision: warm beige, not the near-white token).
"""

import bpy

from . import spec as S


def _principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def _set(node, name, value):
    sock = node.inputs.get(name)
    if sock is not None:
        sock.default_value = value


def _material(name, color, **inputs):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = _principled(mat)
    _set(bsdf, "Base Color", (*color, 1.0))
    for key, value in inputs.items():
        _set(bsdf, key.replace("_", " "), value)
    mat.diffuse_color = (*color, 1.0)  # viewport/solid only
    return mat


def shell(color):
    """Warm mineral ceramic. `color` is an sRGB triple (spec P["shell_color"]).

    The sheet reads as fired clay/stone: matte, warm beige, a faint low-frequency
    tonal drift, sparse fine flecks and a micro-grain bump (VISUAL_LANGUAGE.md:
    "soft ceramic shell, matte finish, tactile"). Procedural here; baked to
    textures for the glTF export (glTF can't carry node networks).
    """
    base = tuple(S.srgb_to_linear(c) for c in color)
    mat = _material(
        "Scope_Ceramic",
        base,
        Roughness=0.64,
        Specular_IOR_Level=0.32,
        Subsurface_Weight=0.05,  # a hint of warmth in the shadows
        Subsurface_Scale=0.002,
    )
    nt = mat.node_tree
    bsdf = _principled(mat)
    for n in [n for n in nt.nodes if n.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL")]:
        nt.nodes.remove(n)
    L = nt.links.new
    coord = nt.nodes.new("ShaderNodeTexCoord")

    def noise(scale, detail, rough=0.55):
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        L(coord.outputs["Object"], n.inputs["Vector"])
        return n

    # tonal drift: +-4% value, very low frequency
    drift = noise(22, 4)
    drift_ramp = nt.nodes.new("ShaderNodeMapRange")
    drift_ramp.inputs["To Min"].default_value = 0.93
    drift_ramp.inputs["To Max"].default_value = 1.04
    L(drift.outputs["Fac"], drift_ramp.inputs["Value"])

    def voronoi(scale):
        v = nt.nodes.new("ShaderNodeTexVoronoi")
        v.inputs["Scale"].default_value = scale
        v.inputs["Randomness"].default_value = 1.0
        L(coord.outputs["Object"], v.inputs["Vector"])
        return v

    def fleck_mask(scale, radius, keep_below):
        """Small round flecks in only a random subset of voronoi cells, so they
        scatter irregularly like mineral inclusions instead of tiling."""
        v = voronoi(scale)
        dot = nt.nodes.new("ShaderNodeMapRange")  # 1 at the cell point -> 0 at `radius`
        dot.inputs["From Min"].default_value = 0.0
        dot.inputs["From Max"].default_value = radius
        dot.inputs["To Min"].default_value = 1.0
        dot.inputs["To Max"].default_value = 0.0
        L(v.outputs["Distance"], dot.inputs["Value"])
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        L(v.outputs["Color"], sep.inputs["Color"])
        pick = nt.nodes.new("ShaderNodeMath")
        pick.operation = "LESS_THAN"
        pick.inputs[1].default_value = keep_below
        L(sep.outputs[0], pick.inputs[0])
        m = nt.nodes.new("ShaderNodeMath")
        m.operation = "MULTIPLY"
        L(dot.outputs["Result"], m.inputs[0])
        L(pick.outputs["Value"], m.inputs[1])
        return m

    dark = fleck_mask(380, 0.16, 0.45)   # sparse darker inclusions
    light = fleck_mask(240, 0.12, 0.18)  # rarer pale grains
    shade_dark = nt.nodes.new("ShaderNodeMapRange")
    shade_dark.inputs["To Min"].default_value = 1.0
    shade_dark.inputs["To Max"].default_value = 0.62
    L(dark.outputs["Value"], shade_dark.inputs["Value"])
    shade_light = nt.nodes.new("ShaderNodeMapRange")
    shade_light.inputs["To Min"].default_value = 1.0
    shade_light.inputs["To Max"].default_value = 1.12
    L(light.outputs["Value"], shade_light.inputs["Value"])

    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.blend_type = "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs["A"].default_value = (*base, 1.0)
    shade = nt.nodes.new("ShaderNodeMath")
    shade.operation = "MULTIPLY"
    L(drift_ramp.outputs["Result"], shade.inputs[0])
    L(shade_dark.outputs["Result"], shade.inputs[1])
    shade2 = nt.nodes.new("ShaderNodeMath")
    shade2.operation = "MULTIPLY"
    L(shade.outputs["Value"], shade2.inputs[0])
    L(shade_light.outputs["Result"], shade2.inputs[1])
    L(shade2.outputs["Value"], tint.inputs["B"])
    L(tint.outputs["Result"], bsdf.inputs["Base Color"])

    # roughness wanders a little with the drift
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.58
    rough.inputs["To Max"].default_value = 0.70
    L(drift.outputs["Fac"], rough.inputs["Value"])
    L(rough.outputs["Result"], bsdf.inputs["Roughness"])

    # micro grain + soft undulation, chained bumps
    grain = noise(900, 6, 0.6)
    undul = noise(70, 2)
    b1 = nt.nodes.new("ShaderNodeBump")
    b1.inputs["Strength"].default_value = 0.12
    b1.inputs["Distance"].default_value = 0.0006
    L(undul.outputs["Fac"], b1.inputs["Height"])
    b2 = nt.nodes.new("ShaderNodeBump")
    b2.inputs["Strength"].default_value = 0.28
    b2.inputs["Distance"].default_value = 0.00025
    L(grain.outputs["Fac"], b2.inputs["Height"])
    L(b1.outputs["Normal"], b2.inputs["Normal"])
    L(b2.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def glass():
    """Deep, uniform dark face. v3: a satin coat (rough enough that reflections
    become broad soft gradients, never crisp white shapes) over a near-black
    base — "glossy, almost mirror-like" read as depth, not as a screen."""
    return _material(
        "Scope_FaceGlass",
        S.PALETTE["display"],
        Roughness=0.42,
        Coat_Weight=0.22,
        Coat_Roughness=0.16,
        Specular_IOR_Level=0.03,
    )


# Kept moderate so AgX doesn't clip the amber to white; bloom does the glow.
EYE_EMISSION = 3.2


# The 2D idle mood's glow (scope-motion.ts SCOPE_MOODS.idle.glow).
IDLE_GLOW = 0.45


def eye(glow=IDLE_GLOW):
    """Warm amber, emissive. Mood `glow` (0..1) gently scales the strength."""
    warm = S.PALETTE["warm"]
    mat = _material("Scope_EyeGlow", warm, Roughness=0.4)
    bsdf = _principled(mat)
    _set(bsdf, "Emission Color", (*warm, 1.0))
    set_eye_glow(mat, glow)
    return mat


def set_eye_glow(mat, glow):
    _set(_principled(mat), "Emission Strength", EYE_EMISSION * (0.75 + 0.5 * glow))


def accent():
    mat = _material("Scope_Accent", S.PALETTE["accent"], Roughness=0.4)
    _set(_principled(mat), "Emission Color", (*S.PALETTE["accent"], 1.0))
    _set(_principled(mat), "Emission Strength", 4.0)
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
