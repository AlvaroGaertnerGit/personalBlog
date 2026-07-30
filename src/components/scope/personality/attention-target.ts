// SPR-005 — pure geometry for the "look at target" gesture (see
// use-scope-personality.ts), kept separate from that hook's own animation
// orchestration so the math is easy to read and verify independent of
// Framer/React state. Reach/range echo use-scope-presence.ts's own
// REACH_PX/EYE_RANGE_PX constants for a consistent *feel* — not imported,
// since this is a discrete, brief glance (holds then returns), not
// continuous tracking: the range is deliberately smaller (close to the
// existing look-up/look-down gestures' 4px).
export const ATTENTION_REACH_PX = 600
export const ATTENTION_EYE_RANGE_PX = 5

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export interface AttentionOffset {
  dx: number
  dy: number
}

// Same "delta over reach, clamped to [-1,1], scaled to range" formula
// use-scope-presence.ts uses for cursor tracking, sourced from a
// registered element's center instead of the live cursor position.
export function computeAttentionOffset(scopeRect: DOMRect, targetRect: DOMRect): AttentionOffset {
  const scopeCenterX = scopeRect.left + scopeRect.width / 2
  const scopeCenterY = scopeRect.top + scopeRect.height / 2
  const targetCenterX = targetRect.left + targetRect.width / 2
  const targetCenterY = targetRect.top + targetRect.height / 2

  const dx = clamp((targetCenterX - scopeCenterX) / ATTENTION_REACH_PX, -1, 1) * ATTENTION_EYE_RANGE_PX
  const dy = clamp((targetCenterY - scopeCenterY) / ATTENTION_REACH_PX, -1, 1) * ATTENTION_EYE_RANGE_PX

  return { dx, dy }
}
