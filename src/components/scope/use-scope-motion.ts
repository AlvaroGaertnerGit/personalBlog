"use client"

import { useTheme } from "next-themes"

import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"

import {
  SCOPE_HAPPY_ANIMATE,
  SCOPE_HAPPY_EYE_ANIMATE,
  SCOPE_HAPPY_TRANSITION,
  SCOPE_IDLE_ANIMATE,
  SCOPE_IDLE_DURATION_BY_THEME,
  SCOPE_IDLE_TRANSITION,
  SCOPE_MOODS,
  SCOPE_REDUCED_TRANSITION,
  SCOPE_SETTLE_TRANSITION,
} from "./scope-motion"
import type { ScopeMood } from "./scope.types"

// Resolves a mood into a ready-to-spread Framer `animate`/`transition`
// pair, plus two further fields (`glow`, `eyeScaleY`) meant for OTHER
// elements than the wrapper `animate` targets. `eyeScaleY` (SPR-003.2) is
// deliberately returned separately, never folded into `animate` above —
// that object is applied to the body wrapper div in scope.tsx, while the
// eyes are separate elements deeper in the tree. Each branch below still
// hands back the *same* `transition` the body uses, so an eye's
// `animate={{ scaleY: eyeScaleY }}` in scope.tsx settles in lockstep with
// the body without needing its own transition object.
function useScopeMotion(mood: ScopeMood) {
  const isReduced = useIsReducedMotion()
  const { resolvedTheme } = useTheme()
  const spec = SCOPE_MOODS[mood]

  if (isReduced) {
    // "Disable floating. Disable bouncing. Only use opacity and tiny
    // transforms." — no loop, no spring bounce, a quarter-scale y-nudge,
    // glow still animates (opacity is explicitly allowed). eyeScaleY is a
    // `scaleY` transform, the same category as rotate/scale that this
    // branch otherwise guts — so its deviation from neutral (1) is
    // quartered too, the same treatment `y` already gets, not exempted
    // like glow's opacity.
    return {
      animate: { y: spec.y / 4, rotate: 0, scale: 1 },
      transition: SCOPE_REDUCED_TRANSITION,
      glow: spec.glow,
      eyeScaleY: 1 + (spec.eyeScaleY - 1) / 4,
    }
  }

  if (mood === "idle") {
    // Living Atmospheres: breathing pace is the one thing that varies by
    // theme (see SCOPE_IDLE_DURATION_BY_THEME) — everything else about the
    // idle transition stays exactly as authored in scope-motion.ts.
    const duration =
      resolvedTheme === "light" ? SCOPE_IDLE_DURATION_BY_THEME.light : SCOPE_IDLE_DURATION_BY_THEME.dark
    return {
      animate: SCOPE_IDLE_ANIMATE,
      transition: { ...SCOPE_IDLE_TRANSITION, duration },
      glow: spec.glow,
      // Idle's eyes don't loop — a static, neutral 1, same "nominal value,
      // not itself animated" treatment idle's own scale/rotate/y get in
      // SCOPE_MOODS.
      eyeScaleY: spec.eyeScaleY,
    }
  }

  if (mood === "happy") {
    return {
      animate: SCOPE_HAPPY_ANIMATE,
      transition: SCOPE_HAPPY_TRANSITION,
      glow: spec.glow,
      eyeScaleY: SCOPE_HAPPY_EYE_ANIMATE.scaleY,
    }
  }

  return {
    animate: { scale: spec.scale, rotate: spec.rotate, y: spec.y },
    transition: SCOPE_SETTLE_TRANSITION[mood],
    glow: spec.glow,
    eyeScaleY: spec.eyeScaleY,
  }
}

export { useScopeMotion }
