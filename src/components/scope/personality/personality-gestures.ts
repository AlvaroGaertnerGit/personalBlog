import type { Transition } from "framer-motion"

// Scope's autonomous idle-gesture vocabulary — deliberately NOT a 6th mood.
// scope-motion.ts's SCOPE_MOODS is a closed set of five (idle, curious,
// thinking, observe, happy); every gesture here is a small, transient
// deviation layered on top of whichever of those five is currently active
// (in practice, only ever "idle" — see use-scope-personality.ts), never a
// replacement for it.
//
// SPR-003.3 (character finalization, VISUAL_LANGUAGE.md v2.0's Eye
// Behaviour + Idle Behaviour lists): this roster grew substantially —
// body gestures (glance/tilt/posture, plus new stretch/bounce), true eye
// blinks (a real scaleY close-open, not the old opacity-based
// "focus-pulse," which is retired), eye squint/widen, eye look-up/down,
// eye convergence, and one antenna-flex gesture. A large, varied pool is
// deliberate — it's what "vary naturally, never loop identically" (the
// docs' own words) actually requires; the scheduler in
// use-scope-personality.ts still only ever fires ONE per idle window.
//
// "glance" and "look around" (body gestures) are deliberately NOT eye
// movement — they're a tiny whole-body rotate/y nudge, the same way Luxo
// Jr. looks somewhere by moving, not by animating eyes. The eye-specific
// look/converge gestures below are a DIFFERENT, smaller channel
// (eyeOffset/eyeConverge) that VISUAL_LANGUAGE.md v2.0 now explicitly
// asks for ("looking left/right/up/down," "slight eye convergence") —
// this is a deliberate expansion, not a contradiction: body gestures move
// the whole creature, eye gestures move only the gaze, and neither one
// touches presence's own eyeX/eyeY (cursor-tracking), which compose with
// these via addition at the scope.tsx composition point.
export type PersonalityGestureName =
  // body
  | "glance-left"
  | "glance-right"
  | "tiny-tilt"
  | "posture-shift"
  | "stretch"
  | "bounce"
  // eyes — true blinks (see BLINK_PATTERNS)
  | "blink"
  | "double-blink"
  | "slow-blink"
  // eyes — phase-based expression
  | "squint"
  | "widen"
  | "look-up"
  | "look-down"
  | "converge"
  // antenna
  | "antenna-flex"

interface PersonalityGestureSpec {
  /** Target for the body's `rotate`/`y`/`scale` motion values. Absent keys stay at their neutral (0 for rotate/y, 1 for scale). */
  body?: { rotate?: number; y?: number; scale?: number }
  /** Target for the eyes' shared gaze offset (px), additive with presence's own eyeX/eyeY. */
  eyeOffset?: { x?: number; y?: number }
  /** Target for the shared blinkScaleY channel via the to/hold/back phase model — squint (<1) or widen (>1). Absent for the true blink family, which uses `blinkPattern` instead. */
  eyeScale?: number
  /** Small px nudge applied with OPPOSITE sign per eye (converging inward) — "slight eye convergence," kept small on purpose. */
  eyeConverge?: number
  /** Target rotation (degrees) for the antenna's own idle flex. */
  antennaFlex?: number
  /**
   * A brief, small counter-movement in the OPPOSITE direction of `body`,
   * played immediately before `to` — the classic animation-principle
   * "anticipation." Computed from `body` (see `anticipationValue` below),
   * never hand-authored. Only meaningful for the original 4 body gestures
   * (rotate/y) — the newer gestures (stretch/bounce/eye/antenna) skip it
   * deliberately, to keep this sprint's scope proportionate; a to/back
   * spring settle already gives every gesture "weight," per VISUAL_LANGUAGE
   * — anticipation is a refinement on top of that, not a requirement.
   */
  anticipate?: { rotate?: number; y?: number }
  /** Transition to the gesture's peak. */
  to: Transition
  /** Transition back to neutral after holding at the peak. */
  back: Transition
  /** How long (ms) to hold at the peak before returning to neutral. */
  holdMs: number
}

/**
 * The true blink family — blink / double-blink / slow-blink. A single
 * keyframe-array `animate()` call on `blinkScaleY` (see
 * use-scope-personality.ts), not the generic to/hold/back phase model:
 * confirmed (via the installed Motion types) that springs — which `to`/
 * `back` above use — can't sequence more than a single start→end pair, so
 * a real multi-dip blink needs a tween with an explicit keyframe array
 * instead. Still runs through the exact same `activeControls`/`cancelled`
 * cancellation machinery as every other gesture — see runGesture().
 */
export interface BlinkPattern {
  keyframes: number[]
  times: number[]
  transition: Transition
}

export const BLINK_PATTERNS: Record<"blink" | "double-blink" | "slow-blink", BlinkPattern> = {
  blink: {
    keyframes: [1, 0.08, 1],
    times: [0, 0.5, 1],
    transition: { duration: 0.16, times: [0, 0.5, 1], ease: "easeInOut" },
  },
  "double-blink": {
    keyframes: [1, 0.08, 1, 1, 0.08, 1],
    times: [0, 0.18, 0.34, 0.58, 0.76, 1],
    transition: { duration: 0.55, times: [0, 0.18, 0.34, 0.58, 0.76, 1], ease: "easeInOut" },
  },
  "slow-blink": {
    keyframes: [1, 0.12, 1],
    times: [0, 0.5, 1],
    transition: { duration: 0.6, times: [0, 0.5, 1], ease: "easeInOut" },
  },
}

// SPR-003.3: feedback on the prior gesture set was "technically correct
// but almost imperceptible" (SPR-003.2 amplified once already); the docs
// now ask for readability primarily through VARIETY and INTENTION, not
// bigger numbers — every value below is still a strict ceiling well under
// the mood system's own (curious/observe: 3-5° rotate, 3-4px y).
const ANTICIPATION_RATIO = 0.3
const ANTICIPATION_ROTATE_FLOOR_DEG = 0.5
const ANTICIPATION_Y_FLOOR_PX = 0.6

function anticipationValue(peak: number, floor: number): number {
  if (peak === 0) return 0
  return -Math.sign(peak) * Math.max(Math.abs(peak) * ANTICIPATION_RATIO, floor)
}

// One shared transition for every gesture's anticipation dip.
const ANTICIPATE_TRANSITION: Transition = { duration: 0.15, ease: "easeOut" }

function bodyGesture(
  rotate: number,
  y: number,
  to: Transition,
  back: Transition,
  holdMs: number
): PersonalityGestureSpec {
  return {
    body: { rotate, y },
    anticipate: {
      rotate: anticipationValue(rotate, ANTICIPATION_ROTATE_FLOOR_DEG),
      y: anticipationValue(y, ANTICIPATION_Y_FLOOR_PX),
    },
    to,
    back,
    holdMs,
  }
}

export const PERSONALITY_GESTURES: Record<
  Exclude<PersonalityGestureName, "blink" | "double-blink" | "slow-blink">,
  PersonalityGestureSpec
> = {
  // — Body —
  "glance-left": bodyGesture(
    -2.6,
    -1.3,
    { type: "spring", stiffness: 75, damping: 18, mass: 1 },
    { type: "spring", stiffness: 70, damping: 20, mass: 1 },
    900
  ),
  "glance-right": bodyGesture(
    2.6,
    -1.3,
    { type: "spring", stiffness: 75, damping: 18, mass: 1 },
    { type: "spring", stiffness: 70, damping: 20, mass: 1 },
    900
  ),
  "tiny-tilt": bodyGesture(
    1.9,
    0,
    { type: "spring", stiffness: 68, damping: 16, mass: 1.1 },
    { type: "spring", stiffness: 60, damping: 20, mass: 1.1 },
    1100
  ),
  "posture-shift": bodyGesture(
    -1.3,
    2.6,
    { type: "spring", stiffness: 60, damping: 17, mass: 1.2 },
    { type: "spring", stiffness: 60, damping: 20, mass: 1.2 },
    1000
  ),
  // "A tiny stretch followed by an exhale" — a gentle scale bump, the
  // exhale being the settle past neutral on the way back.
  stretch: {
    body: { scale: 1.03 },
    to: { type: "spring", stiffness: 70, damping: 18, mass: 1.1 },
    back: { type: "spring", stiffness: 55, damping: 20, mass: 1.1 },
    holdMs: 650,
  },
  // "A small bounce before settling" — a slightly underdamped spring
  // (lower damping than the other gestures) is what gives this one its
  // bounce, not a bigger number.
  bounce: {
    body: { y: -6 },
    to: { type: "spring", stiffness: 100, damping: 12, mass: 1 },
    back: { type: "spring", stiffness: 90, damping: 14, mass: 1 },
    holdMs: 150,
  },

  // — Eyes (phase-based expression; true blinks are BLINK_PATTERNS) —
  squint: {
    eyeScale: 0.6,
    to: { duration: 0.2, ease: "easeInOut" },
    back: { duration: 0.25, ease: "easeInOut" },
    holdMs: 500,
  },
  widen: {
    eyeScale: 1.15,
    to: { duration: 0.18, ease: "easeOut" },
    back: { duration: 0.3, ease: "easeInOut" },
    holdMs: 550,
  },
  "look-up": {
    eyeOffset: { y: -4 },
    to: { type: "spring", stiffness: 90, damping: 16, mass: 0.6 },
    back: { type: "spring", stiffness: 80, damping: 20, mass: 0.6 },
    holdMs: 700,
  },
  "look-down": {
    eyeOffset: { y: 4 },
    to: { type: "spring", stiffness: 90, damping: 16, mass: 0.6 },
    back: { type: "spring", stiffness: 80, damping: 20, mass: 0.6 },
    holdMs: 700,
  },
  converge: {
    eyeConverge: 1.5,
    to: { type: "spring", stiffness: 100, damping: 14, mass: 0.5 },
    back: { type: "spring", stiffness: 90, damping: 20, mass: 0.5 },
    holdMs: 400,
  },

  // — Antenna —
  "antenna-flex": {
    antennaFlex: 5,
    to: { type: "spring", stiffness: 70, damping: 12, mass: 0.5 },
    back: { type: "spring", stiffness: 60, damping: 16, mass: 0.5 },
    holdMs: 300,
  },
}

export const PERSONALITY_GESTURE_NAMES = [
  ...Object.keys(PERSONALITY_GESTURES),
  ...Object.keys(BLINK_PATTERNS),
] as PersonalityGestureName[]

export { ANTICIPATE_TRANSITION }
export type { PersonalityGestureSpec }
