"""Scope's dimensions and palette — the single numeric source for the 3D build.

Reference hierarchy (owner decision, 2026-10-13):
  1. the original design sheet  docs/scope-docs/scope/references/image.png
  2. identity / personality docs (SCOPE.md, VISUAL_LANGUAGE.md, BEHAVIOUR.md ...)
  3. additional visual references
  4. the 2D implementation (scope-geometry.ts) — NOT a literal anatomy template

The proportions below were measured on the sheet's Hero, Focus (front,
slightly above) and Tilt panels (ratios carry over, not pixels) and approved
as model v3. Changing any value changes the approved model: build_scope.py
refuses to rig a shell that no longer matches approved-geometry.json.

Frame: Blender Z-up, Scope faces -Y (exports as glTF +Z, toward a default
three.js camera), origin on the ground between the feet, metres. Body width is
150 mm so the 2D motion units (px ~ mm) keep their meaning.
"""

import math

MM = 0.001


def _sheet_profile():
    # Focus panel (front, slightly above): body 375 x 320 px -> 1.17:1; face
    # 245 x 175 px = 65% of body width, 55% of body height; eyes ~14x26 mm at
    # +-0.23 of face width; mouth ~7x2.6 mm, 11 mm under the eye centres; feet
    # ~11% of body height. Hero/Tilt: widest just below the middle, deep hood
    # with a thick rim, antenna rooted near the crown leaning to Scope's left.
    return dict(
        name="sheet",
        shell_center_z=None,                # derived: the feet tips touch the ground
        shell_rx=75 * MM, shell_rz=63 * MM,
        shell_ry=71 * MM,                   # INFERRED: ~0.95 of width (Hero/Tilt read deep)
        shell_taper=0.03,                   # slightly fuller low, broad round dome on top
        bottom_band=0.35, bottom_lift=6 * MM,
        display_half_w=54 * MM, display_half_h=37 * MM, display_radius=28 * MM,
        display_center_dz=7 * MM,
        # face (faceshell.py): glass depth behind the surface AT the outline, and
        # rim width, per direction — deep thick brow, softer cheeks, a low chin.
        # Depth follows the rim: where the rim is narrow (upper corners) the
        # glass is shallower, so the lip stays thick instead of a thin brim.
        glass_depth_top=7.5 * MM, glass_depth_side=6.5 * MM, glass_depth_bottom=4.5 * MM,
        glass_depth_upper_corner=5.5 * MM,
        glass_bulge=3 * MM,
        rim_top=9.5 * MM, rim_side=8 * MM, rim_bottom=5.5 * MM, rim_upper_corner=5 * MM,
        eye_w=14 * MM, eye_h=26 * MM, eye_dx=23 * MM, eye_dz=1 * MM,
        mouth_w=7 * MM, mouth_h=2.6 * MM, mouth_dz=-11 * MM,
        antenna=dict(
            base_offset=(-6 * MM, 6 * MM), rise=(0 * MM, 16 * MM), top=(8 * MM, 25 * MM),
            radius=2.3 * MM, taper=(1.35, 0.9), tip_r=12 * MM, tip_lift=7 * MM,
            root_flare=1.85, mound_radius=9 * MM, mound_height=2.2 * MM,
        ),
        # four short conical nubs GROWN out of the shell surface (not separate
        # objects), splayed outward: front pair under the face corners, back pair
        feet_style="grown",
        feet=[dict(angle=a, radial=0.78, length=14 * MM, radius=17 * MM, profile=1.2, fillet=0.22)
              for a in (-55, 55, -128, 128)],
        shell_color=(206, 172, 128),        # sRGB albedo read off the sheet's beige (owner: not white)
    )


PROFILES = {"sheet": _sheet_profile}
P = {}


def apply_profile(name):
    """Load a profile into P and derive dependent values."""
    P.clear()
    P.update(PROFILES[name]())
    if P["shell_center_z"] is None:
        # provisional; faceshell.build re-grounds it once the grown feet exist
        P["shell_center_z"] = P["shell_rz"]
    P["display_center_z"] = P["shell_center_z"] + P["display_center_dz"]
    return P


apply_profile("sheet")

# Purple accent dot: SCOPE_ACCENT_DOT = { 139, 54, r 3.5 } — hidden at rest.
ACCENT_SVG = (139, 54)
ACCENT_RADIUS = 3.5 * MM


# --- Palette: src/app/globals.css :root ------------------------------------------
def oklch_to_linear_srgb(L, C, h_deg):
    """OKLCH -> linear sRGB (what Blender's shader inputs expect)."""
    h = math.radians(h_deg)
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(max(0.0, v) for v in (r, g, bl))


def srgb_to_linear(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


PALETTE = {
    "display": oklch_to_linear_srgb(0.10, 0.006, 50),       # --scope-display, deep black
    "accent": oklch_to_linear_srgb(0.709, 0.159, 293.541),  # --scope-accent, purple
    "warm": oklch_to_linear_srgb(0.85, 0.128, 74.502),      # --scope-warm, amber eyes
}
