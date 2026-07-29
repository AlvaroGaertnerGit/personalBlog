"use client"

import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"

import {
  SCOPE_HAPPY_ANIMATE,
  SCOPE_HAPPY_TRANSITION,
  SCOPE_IDLE_ANIMATE,
  SCOPE_IDLE_TRANSITION,
  SCOPE_MOODS,
  SCOPE_REDUCED_TRANSITION,
  SCOPE_SETTLE_TRANSITION,
} from "./scope-motion"
import type { ScopeMood } from "./scope.types"

// Resolves a mood into a ready-to-spread Framer `animate`/`transition`
// pair.
function useScopeMotion(mood: ScopeMood) {
  const isReduced = useIsReducedMotion()
  const spec = SCOPE_MOODS[mood]

  if (isReduced) {
    // "Disable floating. Disable bouncing. Only use opacity and tiny
    // transforms." — no loop, no spring bounce, a quarter-scale y-nudge,
    // glow still animates (opacity is explicitly allowed).
    return {
      animate: { y: spec.y / 4, rotate: 0, scale: 1 },
      transition: SCOPE_REDUCED_TRANSITION,
      glow: spec.glow,
    }
  }

  if (mood === "idle") {
    return { animate: SCOPE_IDLE_ANIMATE, transition: SCOPE_IDLE_TRANSITION, glow: spec.glow }
  }

  if (mood === "happy") {
    return { animate: SCOPE_HAPPY_ANIMATE, transition: SCOPE_HAPPY_TRANSITION, glow: spec.glow }
  }

  return {
    animate: { scale: spec.scale, rotate: spec.rotate, y: spec.y },
    transition: SCOPE_SETTLE_TRANSITION[mood],
    glow: spec.glow,
  }
}

export { useScopeMotion }
