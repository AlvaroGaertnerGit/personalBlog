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
  SCOPE_STILLNESS_ANIMATE,
  SCOPE_STILLNESS_TRANSITION,
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
//
// `isStill` (Living Moment 001, LIVING_SCOPE.md) is owned entirely here,
// not by Personality: breathing is this hook's own concern, and Motion is
// the one layer that actually knows whether "idle" has a loop to pause in
// the first place. Personality only ever proposes "be still right now" —
// a plain boolean, not a new animated channel — and this hook is what
// decides whether that request produces any visible effect at all. Any
// mood besides "idle" already holds at a static settle target with no
// loop running, so the flag is silently a no-op there by construction,
// not by an extra check this hook needs to add.
function useScopeMotion(mood: ScopeMood, isStill = false) {
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
    if (isStill) {
      // The breathing loop simply isn't the current animate target for as
      // long as this is true — Framer animates from wherever the loop
      // currently sat to this static hold, using the same slow transition
      // it'll use to fade back into the loop once isStill goes false
      // again. Glow and eyeScaleY are untouched on purpose: the brief
      // asks for breathing to disappear and the eyes to stay open, not
      // for the display to dim or blink — nothing else about idle changes.
      return {
        animate: SCOPE_STILLNESS_ANIMATE,
        transition: SCOPE_STILLNESS_TRANSITION,
        glow: spec.glow,
        eyeScaleY: spec.eyeScaleY,
      }
    }

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
