import {
  SCOPE_ANTENNA_PATH,
  SCOPE_ANTENNA_TIP,
  SCOPE_DISPLAY_PATH,
  SCOPE_DISPLAY_SHEEN,
  SCOPE_EYE_LEFT,
  SCOPE_EYE_RIGHT,
  SCOPE_FEET,
  SCOPE_MOUTH_GLOW,
  SCOPE_MOUTH_MAIN,
  SCOPE_SHELL,
  SCOPE_SHELL_SHEEN,
  SCOPE_VIEWBOX,
} from "./scope-geometry"
import { SCOPE_EMAIL_THEME } from "@/lib/email/shared"

// The one static, non-"use client" renderer of the exact canonical shapes
// scope-geometry.ts describes — alongside scope.tsx (live, animated). There
// must only ever be one of these: an earlier attempt at Gmail-compatibility
// (scope-raster.tsx) hand-duplicated this same drawing into a second file
// with its own copy of the color constants, which is exactly the kind of
// drift this component exists to prevent. Its one caller is
// src/app/api/scope-mark/route.tsx, which rasterizes it to a PNG via
// next/og's ImageResponse (Satori) — see that file's own comment for why a
// PNG is needed instead of shipping this SVG straight into email HTML.
//
// Colors are literal hex, read from SCOPE_EMAIL_THEME (lib/email/shared.tsx)
// — the one place this project's oklch --scope-* tokens are already
// translated for non-browser contexts — rather than Tailwind classNames:
// Satori has no Tailwind build to resolve fill-scope-warm/etc against, and
// there's no other consumer left that would need the class-based version.
//
// Hardcoded to Scope's resting "idle" read (glow 0.45, eyeScaleY 1) rather
// than accepting a mood prop — its one caller only ever wants this resting
// read, never a specific expression.
const { "scope-warm": WARM, "scope-shell": SHELL, "scope-details": DETAILS, "scope-display": DISPLAY } =
  SCOPE_EMAIL_THEME.colors

function ScopeStatic() {
  return (
    <svg viewBox={SCOPE_VIEWBOX} width="160" height="210" xmlns="http://www.w3.org/2000/svg">
      <rect x={14} y={14} width={132} height={128} rx={36} fill={WARM} opacity={0.225} />

      <rect {...SCOPE_FEET[0]} fill={DETAILS} />
      <rect {...SCOPE_FEET[1]} fill={DETAILS} />

      <ellipse {...SCOPE_SHELL} fill={SHELL} />
      <ellipse {...SCOPE_SHELL_SHEEN} fill={SHELL} opacity={0.12} />

      <path d={SCOPE_ANTENNA_PATH} stroke={DETAILS} strokeWidth={3} strokeLinecap="round" fill="none" />
      <circle {...SCOPE_ANTENNA_TIP} fill={SHELL} stroke={DETAILS} strokeWidth={1} />

      <path d={SCOPE_DISPLAY_PATH} fill={DISPLAY} stroke={DETAILS} strokeWidth={1} />
      <ellipse
        cx={SCOPE_DISPLAY_SHEEN.cx}
        cy={SCOPE_DISPLAY_SHEEN.cy}
        rx={SCOPE_DISPLAY_SHEEN.rx}
        ry={SCOPE_DISPLAY_SHEEN.ry}
        transform={`rotate(${SCOPE_DISPLAY_SHEEN.rotationDeg} ${SCOPE_DISPLAY_SHEEN.cx} ${SCOPE_DISPLAY_SHEEN.cy})`}
        fill={SHELL}
        opacity={0.07}
      />

      <rect {...SCOPE_EYE_LEFT.bloom} fill={WARM} opacity={0.4} />
      <rect {...SCOPE_EYE_LEFT.main} fill={WARM} />
      <rect {...SCOPE_EYE_RIGHT.bloom} fill={WARM} opacity={0.4} />
      <rect {...SCOPE_EYE_RIGHT.main} fill={WARM} />

      <rect {...SCOPE_MOUTH_GLOW} fill={WARM} opacity={0.22} />
      <rect {...SCOPE_MOUTH_MAIN} fill={WARM} />
    </svg>
  )
}

export { ScopeStatic }
