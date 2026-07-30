"use client"

import * as React from "react"
import { useMotionValue, useSpring, useTime, useTransform, type MotionValue } from "framer-motion"

import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"
import { useCombinedMotionValue } from "./use-combined-motion-value"

// How far (px) the cursor has to be from Scope's own center to reach the
// full effect. Fixed, not tied to viewport size, so the feeling is
// consistent at any screen size — closer than this and the effect eases
// in; values beyond it clamp rather than keep growing.
const REACH_PX = 600

const MAX_ROTATE_X = 8
const MAX_ROTATE_Y = 10
const EYE_RANGE_PX = 9
const PARALLAX_RANGE_PX = 2.5

// Heavy, deliberate body movement: moderate stiffness with mass pushed up
// for weight, just underdamped enough for the "small overshoot" the brief
// asks for — not a springy bounce.
const BODY_SPRING = { stiffness: 90, damping: 16, mass: 1.2 }

// The eye is a floating focus point, not part of the ceramic body — it
// should feel lighter and react faster than BODY_SPRING, but never snap
// or bounce. High stiffness + low mass = fast reaction (~200ms to
// settle); damping ratio ≈0.8 (just under critical) gives a soft
// ease-out with a sub-pixel overshoot on arrival — the "micro drift"
// that reads as alive rather than mechanical, without ever being a
// visible bounce.
const EYE_SPRING = { stiffness: 260, damping: 18, mass: 0.5 }

// How far ahead of the raw cursor position the eye's target leads when
// the cursor is moving fast, expressed as seconds of extrapolation along
// the cursor's current velocity. Kept small and clamped (EYE_LEAD_MAX) so
// the effect reads as "anticipating" rather than overshooting — the lead
// only ever pulls the target sooner toward the same [-1, 1] bound raw
// already respects, never past it, so EYE_RANGE_PX is never exceeded.
const EYE_LEAD_SECONDS = 0.045
const EYE_LEAD_MAX = 0.3

const PARALLAX_SPRING = { stiffness: 70, damping: 18, mass: 1 }

// SPR-003.3 (VISUAL_LANGUAGE.md v2.0's "never perfectly static... very
// subtle micro motion" for the eyes): a tiny, slow, always-on drift, not a
// discrete gesture — this is why it lives here in Presence (an ambient
// interaction-adjacent quality) rather than in Personality (which only
// fires discrete, occasional behaviours). Deliberately sub-pixel-ish and
// slow enough that it reads as "alive," not as jitter. The two axes use
// different periods and a phase offset so the drift traces a lazy,
// irregular loop rather than a perfect circle.
const EYE_JITTER_AMPLITUDE_PX = 0.6
const EYE_JITTER_PERIOD_MS_X = 5200
const EYE_JITTER_PERIOD_MS_Y = 6300
const EYE_JITTER_PHASE_Y = 1.3

// SPR-003.3 (VISUAL_LANGUAGE.md v2.0's "insect antenna... subtly reacts to
// movement"): the antenna chases the body's own rotateY through a SECOND,
// softer spring — a "spring chasing a spring," the standard technique for
// flexible follow-through. Deliberately lower damping than BODY_SPRING so
// it visibly lags and slightly overshoots the body's own turn, reading as
// flexible rather than rigidly attached.
const ANTENNA_SPRING = { stiffness: 50, damping: 10, mass: 0.8 }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

interface ScopePresence {
  rotateX: MotionValue<number>
  rotateY: MotionValue<number>
  eyeX: MotionValue<number>
  eyeY: MotionValue<number>
  parallaxX: MotionValue<number>
  parallaxY: MotionValue<number>
  shadowX: MotionValue<number>
  shadowY: MotionValue<number>
  shadowScaleX: MotionValue<number>
  antennaRotate: MotionValue<number>
  /**
   * 0–1, presence-derived. Drives the "purple accent only when interacting
   * with the environment" rule (VISUAL_LANGUAGE.md v2.0) — 0 before any
   * real interaction has ever happened (including forever, under reduced
   * motion, since the listener never attaches) and while the cursor is far
   * away, rising only as the cursor comes close to Scope. Known, accepted
   * gap: there's no `pointerleave` handling, so if the cursor exits the
   * window entirely this holds its last value rather than decaying to 0 —
   * a small, deliberately out-of-scope limitation, not an oversight.
   */
  interactionIntensity: MotionValue<number>
}

// Turns the cursor's position, globally, into a set of spring-smoothed
// motion values — never React state, so mousemove never triggers a
// re-render (every value here is read by scope.tsx via `style`, which
// Framer updates outside React's render cycle). Layers on top of the
// mood system in use-scope-motion.ts; doesn't touch it.
//
// rotateX/rotateY tilt the whole body (scope.tsx applies these to the
// same element the mood animation already rotates/scales — the display
// rotates with it, never independently, per docs/scope-docs/scope).
// eyeX/eyeY move only the eyes' focus point — lighter and faster to react
// than the body (see EYE_SPRING), with its target leading slightly on
// fast cursor motion (see EYE_LEAD_SECONDS) so it reads as anticipating
// rather than trailing, plus a small always-on jitter (see
// EYE_JITTER_AMPLITUDE_PX) so the eyes are never perfectly still.
// parallaxX/parallaxY give the display and its glow a much smaller
// secondary shift for a sense of depth. shadowX/Y/scaleX derive from the
// already-smoothed rotation (not their own spring) — a cast shadow has no
// physics of its own independent of the thing casting it. antennaRotate
// and interactionIntensity are two further derived values — see their
// own comments below.
function useScopePresence(ref: React.RefObject<HTMLElement | null>): ScopePresence {
  const isReduced = useIsReducedMotion()
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  // What the eye's spring actually chases — raw cursor position plus a
  // velocity-based lead (see EYE_LEAD_SECONDS below). Separate from
  // rawX/rawY because rotateX/rotateY/parallax should keep tracking the
  // cursor directly, unaffected by the eye's anticipation.
  const eyeTargetX = useMotionValue(0)
  const eyeTargetY = useMotionValue(0)
  // 0 until the first real pointermove, then 1 forever — gates
  // interactionIntensity so "no interaction yet" (or reduced motion, where
  // the listener below never attaches) reads as 0, not as maximum
  // intensity, which a bare distance formula would otherwise produce at
  // rawX=rawY=0 (their shared starting value).
  const hasInteracted = useMotionValue(0)
  const center = React.useRef({ x: 0, y: 0 })

  React.useEffect(() => {
    // Reduced motion: never attach the listeners, so rawX/rawY (and
    // everything derived from them below) stay at their initial 0 —
    // disables body rotation, parallax, and eye tracking in one move.
    if (isReduced) return

    function updateCenter() {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }

    function onPointerMove(event: PointerEvent) {
      hasInteracted.set(1)
      const nx = clamp((event.clientX - center.current.x) / REACH_PX, -1, 1)
      const ny = clamp((event.clientY - center.current.y) / REACH_PX, -1, 1)
      rawX.set(nx)
      rawY.set(ny)

      // Velocity-led eye target — "take cursor velocity into account,"
      // not just position. Lead is clamped back into the same [-1, 1]
      // range raw already respects, so a fast flick makes the eye reach
      // its target sooner, never further.
      const leadX = clamp(rawX.getVelocity() * EYE_LEAD_SECONDS, -EYE_LEAD_MAX, EYE_LEAD_MAX)
      const leadY = clamp(rawY.getVelocity() * EYE_LEAD_SECONDS, -EYE_LEAD_MAX, EYE_LEAD_MAX)
      eyeTargetX.set(clamp(nx + leadX, -1, 1))
      eyeTargetY.set(clamp(ny + leadY, -1, 1))
    }

    updateCenter()
    window.addEventListener("resize", updateCenter)
    window.addEventListener("scroll", updateCenter, { passive: true })
    window.addEventListener("pointermove", onPointerMove)
    return () => {
      window.removeEventListener("resize", updateCenter)
      window.removeEventListener("scroll", updateCenter)
      window.removeEventListener("pointermove", onPointerMove)
    }
  }, [isReduced, ref, rawX, rawY, eyeTargetX, eyeTargetY, hasInteracted])

  const rawRotateY = useTransform(rawX, [-1, 1], [-MAX_ROTATE_Y, MAX_ROTATE_Y])
  const rotateY = useSpring(rawRotateY, BODY_SPRING)
  const rotateX = useSpring(useTransform(rawY, [-1, 1], [MAX_ROTATE_X, -MAX_ROTATE_X]), BODY_SPRING)

  const eyeSpringX = useSpring(useTransform(eyeTargetX, [-1, 1], [-EYE_RANGE_PX, EYE_RANGE_PX]), EYE_SPRING)
  const eyeSpringY = useSpring(useTransform(eyeTargetY, [-1, 1], [-EYE_RANGE_PX, EYE_RANGE_PX]), EYE_SPRING)

  const time = useTime()
  const jitterAmplitude = isReduced ? 0 : EYE_JITTER_AMPLITUDE_PX
  const jitterX = useTransform(
    time,
    (t) => Math.sin((t / EYE_JITTER_PERIOD_MS_X) * Math.PI * 2) * jitterAmplitude
  )
  const jitterY = useTransform(
    time,
    (t) => Math.sin((t / EYE_JITTER_PERIOD_MS_Y) * Math.PI * 2 + EYE_JITTER_PHASE_Y) * jitterAmplitude
  )
  const eyeX = useCombinedMotionValue([eyeSpringX, jitterX], ([a, b]) => a + b)
  const eyeY = useCombinedMotionValue([eyeSpringY, jitterY], ([a, b]) => a + b)

  const parallaxX = useSpring(
    useTransform(rawX, [-1, 1], [-PARALLAX_RANGE_PX, PARALLAX_RANGE_PX]),
    PARALLAX_SPRING
  )
  const parallaxY = useSpring(
    useTransform(rawY, [-1, 1], [-PARALLAX_RANGE_PX, PARALLAX_RANGE_PX]),
    PARALLAX_SPRING
  )

  const shadowX = useTransform(rotateY, [-MAX_ROTATE_Y, MAX_ROTATE_Y], [6, -6])
  const shadowY = useTransform(rotateX, [-MAX_ROTATE_X, MAX_ROTATE_X], [-4, 4])
  const shadowScaleX = useTransform(rotateY, [-MAX_ROTATE_Y, MAX_ROTATE_Y], [0.94, 1.06])

  const antennaRotate = useSpring(rotateY, ANTENNA_SPRING)

  const interactionIntensity = useSpring(
    useCombinedMotionValue(
      [hasInteracted, rawX, rawY],
      ([moved, x, y]) => moved * clamp(1 - Math.hypot(x, y), 0, 1)
    ),
    { stiffness: 60, damping: 20 }
  )

  return {
    rotateX,
    rotateY,
    eyeX,
    eyeY,
    parallaxX,
    parallaxY,
    shadowX,
    shadowY,
    shadowScaleX,
    antennaRotate,
    interactionIntensity,
  }
}

export { useScopePresence }
