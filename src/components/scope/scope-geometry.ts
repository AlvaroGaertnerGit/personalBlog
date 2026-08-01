// Scope's shape, and only its shape — every coordinate/path string that
// defines what Scope physically looks like, extracted out of scope.tsx so
// it has exactly one author. scope.tsx (the live, animated, "use client"
// component) and scope-static.tsx (a plain, non-client renderer, rasterized
// to a PNG for email clients — see that file's own comment for why) both
// build their own markup from these same numbers. Nothing here is ever animated directly;
// scope.tsx wraps these shapes in motion.* elements and drives their style/
// animate props independently — this file only answers "where is each
// shape, and what's its geometry," never "how does it move."
//
// This file has no "use client" directive and imports nothing from React
// or framer-motion on purpose — it needs to be safely importable from
// literally anywhere, including a Next.js Route Handler (email rendering),
// where a "use client" module can only be rendered, never invoked directly.

export const SCOPE_VIEWBOX = "0 -30 160 210"

// The display's ambient glow — brightens/dims per mood in scope.tsx via
// its own `glow` value; the shape itself never changes.
export const SCOPE_GLOW_RECT = { x: 14, y: 14, width: 132, height: 128, rx: 36 }

export const SCOPE_FEET = [
  { x: 42, y: 146, width: 24, height: 28, rx: 12 },
  { x: 92, y: 146, width: 24, height: 28, rx: 12 },
] as const

// A slightly flattened ellipse (rx > ry), not a perfect circle — "almost
// spherical, slightly flattened at the bottom" per VISUAL_LANGUAGE.md.
export const SCOPE_SHELL = { cx: 80, cy: 78, rx: 75, ry: 71 }

// A soft top sheen suggesting a sculpted, matte-ceramic surface.
export const SCOPE_SHELL_SHEEN = { cx: 70, cy: 22, rx: 34, ry: 14 }

export const SCOPE_ANTENNA_PATH = "M 66 9 Q 61 -5 68 -15"
export const SCOPE_ANTENNA_TIP = { cx: 68, cy: -17, r: 6 }

// The one remaining trace of Scope's purple accent — visible only via
// presence's interactionIntensity (0 at rest, before any interaction).
// Included here for completeness; scope-static.tsx's "frozen at rest"
// reading correctly never shows it, matching that same resting state.
export const SCOPE_ACCENT_DOT = { cx: 139, cy: 54, r: 3.5 }

// The display/face-plate background — recessed into the shell, per its own
// inner-edge stroke in scope.tsx.
export const SCOPE_DISPLAY_PATH =
  "M46 34 H114 C129 34 140 45 140 60 V92 C140 109 127 122 110 122 H50 C33 122 20 109 20 92 V60 C20 45 31 34 46 34 Z"

// A soft, low-opacity diagonal highlight — just enough to read as glossy.
export const SCOPE_DISPLAY_SHEEN = { cx: 55, cy: 50, rx: 30, ry: 14, rotationDeg: -25 }

// The eyes — two plain pill shapes with a soft blurred "bloom" behind each.
// Bloom and main rect share the same rx (half their own height) so the
// pill silhouette stays consistent regardless of which is drawn.
export const SCOPE_EYE_LEFT = {
  bloom: { x: 53, y: 58, width: 22, height: 32, rx: 11 },
  main: { x: 56, y: 61, width: 18, height: 32, rx: 9 },
}
export const SCOPE_EYE_RIGHT = {
  bloom: { x: 85, y: 58, width: 22, height: 32, rx: 11 },
  main: { x: 88, y: 61, width: 18, height: 32, rx: 9 },
}

// The mouth — a known, pre-existing gap between this shipped shape and
// docs/scope-docs/scope's "no mouth, ever" canon (predates this file; see
// docs/CONTEXT.md §4). Included for exact fidelity with what scope.tsx
// actually renders today, not a judgment on which is right.
export const SCOPE_MOUTH_GLOW = { x: 74, y: 95, width: 14, height: 6, rx: 3 }
export const SCOPE_MOUTH_MAIN = { x: 75, y: 96, width: 12, height: 4, rx: 2 }
