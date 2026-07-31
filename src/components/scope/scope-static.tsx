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
import { SCOPE_MOODS } from "./scope-motion"
import type { ScopeMood } from "./scope.types"

interface ScopeStaticProps {
  /** Which mood's *resting* eyeScaleY/glow to read — no animation plays either way. Defaults to "idle". */
  mood?: ScopeMood
  className?: string
}

// scope.tsx applies eyeScaleY as a CSS `transform: scaleY()`, which scales
// around the element's own center (Framer's fill-box default — see that
// file's own comment on this exact point). A plain SVG rect has no
// `scaleY` attribute, so matching that visual result here means adjusting
// both `height` and `y` together — grow/shrink from the vertical center,
// not from the top edge, which is what changing `height` alone would do.
function scaledEyeRect(eye: { x: number; y: number; width: number; height: number; rx: number }, eyeScaleY: number) {
  const height = eye.height * eyeScaleY
  const y = eye.y + (eye.height - height) / 2
  return { x: eye.x, y, width: eye.width, height, rx: eye.rx }
}

// The one place Scope exists without his own animation system, because
// the surrounding context categorically cannot run one — a Route Handler
// rendering an email, which never hydrates in a browser at all. scope.tsx
// is "use client": Next.js's own React Server Components boundary makes a
// "use client" component impossible to invoke directly outside an actual
// browser/hydration context (confirmed empirically — it throws "Attempted
// to call Scope() from the server but Scope is on the client"), so this
// isn't a style choice, it's the only technically possible way to put
// Scope in an email at all.
//
// Every shape and every mood number here comes from the exact same source
// scope.tsx itself reads — scope-geometry.ts (paths/coordinates) and
// SCOPE_MOODS in scope-motion.ts (the resting eyeScaleY/glow per mood) —
// neither file has a "use client" directive, both are safely importable
// from anywhere. There is exactly one authored drawing of Scope in this
// codebase; this component is a second, motion-free *renderer* of it, not
// a second drawing. The mouth's mood-dependent scale (thinking/happy/
// curious each animate it differently in scope.tsx) is deliberately not
// reproduced here — every current caller wants Scope's calm resting read,
// never a specific expression, so the mouth stays at its neutral scale
// regardless of `mood`.
//
// Uses the exact same className convention as scope.tsx (fill-scope-warm,
// fill-scope-shell, etc.) rather than inline hex — in an email context,
// react-email's own <Tailwind> wrapper resolves these against a theme
// extension (see lib/email/shared.tsx) the same way this project's real
// Tailwind build resolves them on the live site; nothing here needs to
// know which context it's rendering in. No gradient (the live shell's
// <linearGradient> uses CSS var()/color-mix(), unreliable in the email
// contexts this component exists for) and no blur filters (poor/no email
// support) — the same shapes and colors, translated to what a static,
// filter-free, gradient-free context can actually render, not a redesign.
function ScopeStatic({ mood = "idle", className }: ScopeStaticProps) {
  const { eyeScaleY, glow } = SCOPE_MOODS[mood]

  return (
    <svg viewBox={SCOPE_VIEWBOX} className={className} xmlns="http://www.w3.org/2000/svg">
      {/* display glow */}
      <rect
        x={14}
        y={14}
        width={132}
        height={128}
        rx={36}
        className="fill-scope-warm"
        opacity={glow * 0.5}
      />

      {/* feet */}
      <rect {...SCOPE_FEET[0]} className="fill-scope-details" />
      <rect {...SCOPE_FEET[1]} className="fill-scope-details" />

      {/* shell — flat fill, not the live gradient (see this file's own
          top comment for why) */}
      <ellipse {...SCOPE_SHELL} className="fill-scope-shell" />
      <ellipse {...SCOPE_SHELL_SHEEN} className="fill-scope-shell" opacity={0.12} />

      {/* antenna */}
      <path d={SCOPE_ANTENNA_PATH} className="stroke-scope-details" strokeWidth={3} strokeLinecap="round" fill="none" />
      <circle {...SCOPE_ANTENNA_TIP} className="fill-scope-shell stroke-scope-details" strokeWidth={1} />

      {/* accent light — 0 at rest before any interaction (see
          scope.tsx's own comment); a static reading correctly never shows
          it, so it's omitted here entirely rather than drawn inert. */}

      {/* display + eyes */}
      <path d={SCOPE_DISPLAY_PATH} className="fill-scope-display stroke-scope-details" strokeWidth={1} />
      <ellipse
        cx={SCOPE_DISPLAY_SHEEN.cx}
        cy={SCOPE_DISPLAY_SHEEN.cy}
        rx={SCOPE_DISPLAY_SHEEN.rx}
        ry={SCOPE_DISPLAY_SHEEN.ry}
        transform={`rotate(${SCOPE_DISPLAY_SHEEN.rotationDeg} ${SCOPE_DISPLAY_SHEEN.cx} ${SCOPE_DISPLAY_SHEEN.cy})`}
        className="fill-scope-shell"
        opacity={0.07}
      />

      <rect {...SCOPE_EYE_LEFT.bloom} className="fill-scope-warm" opacity={0.4} />
      <rect {...scaledEyeRect(SCOPE_EYE_LEFT.main, eyeScaleY)} className="fill-scope-warm" />
      <rect {...SCOPE_EYE_RIGHT.bloom} className="fill-scope-warm" opacity={0.4} />
      <rect {...scaledEyeRect(SCOPE_EYE_RIGHT.main, eyeScaleY)} className="fill-scope-warm" />

      {/* mouth — neutral scale regardless of mood, see this file's own
          top comment */}
      <rect {...SCOPE_MOUTH_GLOW} className="fill-scope-warm" opacity={0.22} />
      <rect {...SCOPE_MOUTH_MAIN} className="fill-scope-warm" />
    </svg>
  )
}

export { ScopeStatic }
