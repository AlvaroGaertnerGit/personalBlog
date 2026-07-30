import type { Transition } from "framer-motion"

import type { ScopeMood, ScopeMotionSpec } from "./scope.types"

// Scope's motion vocabulary — the one place these numbers live. MOVEMENT.md
// says "never exaggerated" and the reference sheet says "light, smooth,
// purposeful"; the values below are those rules enforced as literal
// ceilings, not just intent. Nothing here should ever need "toning down"
// later — if a future mood needs bigger numbers than these, that's a sign
// it's not one of Scope's five canonical moods.
//
// For curious/thinking/observe these are the literal animate target (see
// use-scope-motion.ts). idle and happy each animate their own keyframe
// array below instead — for those two, scale/rotate/y here are a nominal
// reference point (idle's resting baseline; happy's peak) for the debug
// panel to display, not a value Framer ever animates to directly. Keep
// them in sync with SCOPE_IDLE_ANIMATE / SCOPE_HAPPY_ANIMATE below if
// either changes.
//
// eyeScaleY (SPR-003.2, Scope Design Evolution — see
// docs/scope-docs/scope/SCOPE_UNDERSTANDING.md's revision note): the
// per-mood target for each eye's height multiplier, Scope's primary
// expression channel as of this sprint. Same "nominal reference, not
// always literally animated" caveat as scale/rotate/y applies to idle and
// happy here — see SCOPE_HAPPY_EYE_ANIMATE below for happy's real target.
export const SCOPE_MOODS: Record<ScopeMood, ScopeMotionSpec> = {
  idle: { animationName: "breathe", scale: 1, rotate: 0, y: 0, glow: 0.45, eyeScaleY: 1 },
  curious: { animationName: "tilt-lean", scale: 1.03, rotate: -4, y: -3, glow: 0.7, eyeScaleY: 1.1 },
  thinking: { animationName: "lower-pause", scale: 0.98, rotate: 2, y: 5, glow: 0.25, eyeScaleY: 0.5 },
  observe: { animationName: "lean-forward", scale: 1.05, rotate: -3, y: -4, glow: 0.6, eyeScaleY: 1.15 },
  happy: { animationName: "hop-squash", scale: 1.05, rotate: 0, y: -14, glow: 0.9, eyeScaleY: 0.5 },
}

// Idle is the one mood that's a continuous loop rather than a settle-and-
// hold — "gentle breathing... almost imperceptible floating... very small
// body rotation" is ongoing, not a one-shot gesture. A fixed 2-keyframe
// mirror loop: deterministic (same shape every cycle), never random.
//
// SPR-003.2: amplitudes bumped ~25-30% ("breathing variation" in the idle
// personality brief) — still the same mechanism, just a hair more visible.
export const SCOPE_IDLE_ANIMATE = {
  y: [0, -3.8],
  rotate: [0, -0.78],
  scale: [1, 1.019],
}

// Living Atmospheres (Sprint 3): the one numeric variance breathing pace
// has between themes — "breathing is a little more noticeable" in light,
// "breathing slightly slower" in dark — a ±0.2s nudge off the original 4s,
// read by use-scope-motion.ts. Everything else about idle (the keyframe
// shape above, the easing/repeatType below) is identical between themes.
export const SCOPE_IDLE_DURATION_BY_THEME = {
  light: 3.8,
  dark: 4.2,
} as const

export const SCOPE_IDLE_TRANSITION: Transition = {
  duration: SCOPE_IDLE_DURATION_BY_THEME.dark,
  repeat: Infinity,
  repeatType: "mirror",
  ease: "easeInOut",
}

// Curious / Thinking / Observe: a single settle to the mood's target,
// spring-damped so it never snaps or overshoots harshly, then holds —
// "transition in" is the spring settling, "steady state" is the held
// target, "transition out" happens when the next mood change animates
// away from it.
export const SCOPE_SETTLE_TRANSITION: Record<
  Extract<ScopeMood, "curious" | "thinking" | "observe">,
  Transition
> = {
  curious: { type: "spring", stiffness: 220, damping: 20 },
  thinking: { type: "spring", stiffness: 120, damping: 22 },
  observe: { type: "spring", stiffness: 160, damping: 20 },
}

// Happy is the one mood that resolves itself — "tiny hop... returns to
// idle immediately" — so it's a fixed, deterministic keyframe sequence
// (hop up, a beat of soft squash/stretch, settle) rather than a target to
// hold. The page (which owns mood state) is responsible for actually
// switching back to "idle" once this finishes — see SCOPE_HAPPY_HOLD_MS.
export const SCOPE_HAPPY_ANIMATE = {
  y: [0, -14, -14, 0],
  scale: [1, 1.05, 0.97, 1],
}

// A brief "content squint" synced to the hop — kept as its own constant,
// applied to the eyes (a separate element from the body wrapper
// SCOPE_HAPPY_ANIMATE targets) but sharing SCOPE_HAPPY_TRANSITION so the
// two can never drift apart on duration/times. Keep this array's length
// equal to SCOPE_HAPPY_ANIMATE's arrays and to
// SCOPE_HAPPY_TRANSITION.times — that shared length is what keeps body and
// eyes in lockstep if any of the three is ever re-tuned.
export const SCOPE_HAPPY_EYE_ANIMATE = {
  scaleY: [1, 1, 0.5, 1],
}

export const SCOPE_HAPPY_TRANSITION: Transition = {
  duration: 0.6,
  times: [0, 0.35, 0.7, 1],
  ease: "easeInOut",
}
export const SCOPE_HAPPY_HOLD_MS = 650

// Reduced motion: no loop, no spring bounce, a small settle plus opacity
// only (opacity/glow is explicitly still allowed).
export const SCOPE_REDUCED_TRANSITION: Transition = {
  duration: 0.3,
  ease: "easeInOut",
}

// Independent of the body's transition — the glow is opacity-only and
// should never inherit a spring/keyframe timing meant for scale/y/rotate.
export const SCOPE_GLOW_TRANSITION: Transition = {
  duration: 0.5,
  ease: "easeInOut",
}
