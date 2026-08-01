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

// A third renderer of the same canonical shapes scope-geometry.ts describes
// — alongside scope.tsx (live, animated) and scope-static.tsx (motion-free
// SVG for react-email's <Tailwind> wrapper). This one exists because email
// clients, Gmail in particular, strip inline <svg>...</svg> markup from HTML
// email bodies entirely (a security sanitizing measure, not a rendering
// bug) — so scope-static's Tailwind-classed SVG, however correct, never
// actually appears once delivered. Satori (the renderer behind next/og's
// ImageResponse, already used by this project's opengraph-image.tsx) fully
// supports nested raw SVG elements and rasterizes them to a real PNG, which
// every email client displays via a plain <img> — see
// src/app/api/scope-mark/route.tsx, the one caller. Satori has no Tailwind
// build to resolve classNames against, so shapes here use literal hex fills
// (the same values SCOPE_EMAIL_THEME in lib/email/shared.tsx already
// defines for the exact same reason) rather than fill-scope-warm etc.
//
// Hardcoded to Scope's resting "idle" read (glow 0.45, eyeScaleY 1) rather
// than accepting a mood prop — every current/foreseeable caller of a static
// PNG mark is this same resting read, matching scope-static.tsx's own
// default and its own reasoning for why moods beyond idle aren't needed.
const HEX = {
  warm: "#e0ad5e",
  shell: "#f1ede6",
  details: "#3f3d45",
  display: "#1a1816",
} as const

function ScopeRaster() {
  return (
    <svg viewBox={SCOPE_VIEWBOX} width="160" height="210" xmlns="http://www.w3.org/2000/svg">
      <rect x={14} y={14} width={132} height={128} rx={36} fill={HEX.warm} opacity={0.225} />

      <rect {...SCOPE_FEET[0]} fill={HEX.details} />
      <rect {...SCOPE_FEET[1]} fill={HEX.details} />

      <ellipse {...SCOPE_SHELL} fill={HEX.shell} />
      <ellipse {...SCOPE_SHELL_SHEEN} fill={HEX.shell} opacity={0.12} />

      <path d={SCOPE_ANTENNA_PATH} stroke={HEX.details} strokeWidth={3} strokeLinecap="round" fill="none" />
      <circle {...SCOPE_ANTENNA_TIP} fill={HEX.shell} stroke={HEX.details} strokeWidth={1} />

      <path d={SCOPE_DISPLAY_PATH} fill={HEX.display} stroke={HEX.details} strokeWidth={1} />
      <ellipse
        cx={SCOPE_DISPLAY_SHEEN.cx}
        cy={SCOPE_DISPLAY_SHEEN.cy}
        rx={SCOPE_DISPLAY_SHEEN.rx}
        ry={SCOPE_DISPLAY_SHEEN.ry}
        transform={`rotate(${SCOPE_DISPLAY_SHEEN.rotationDeg} ${SCOPE_DISPLAY_SHEEN.cx} ${SCOPE_DISPLAY_SHEEN.cy})`}
        fill={HEX.shell}
        opacity={0.07}
      />

      <rect {...SCOPE_EYE_LEFT.bloom} fill={HEX.warm} opacity={0.4} />
      <rect {...SCOPE_EYE_LEFT.main} fill={HEX.warm} />
      <rect {...SCOPE_EYE_RIGHT.bloom} fill={HEX.warm} opacity={0.4} />
      <rect {...SCOPE_EYE_RIGHT.main} fill={HEX.warm} />

      <rect {...SCOPE_MOUTH_GLOW} fill={HEX.warm} opacity={0.22} />
      <rect {...SCOPE_MOUTH_MAIN} fill={HEX.warm} />
    </svg>
  )
}

export { ScopeRaster }
