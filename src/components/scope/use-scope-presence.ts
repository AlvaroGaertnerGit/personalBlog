"use client"

import * as React from "react"
import { useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion"
import { MotionConfigContext } from "framer-motion"

import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"

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
// eyeX/eyeY move only the {█} focus point — lighter and faster to react
// than the body (see EYE_SPRING), with its target leading slightly on
// fast cursor motion (see EYE_LEAD_SECONDS) so it reads as anticipating
// rather than trailing.
// parallaxX/parallaxY give the display and its glow a much smaller
// secondary shift for a sense of depth. shadowX/Y/scaleX derive from the
// already-smoothed rotation (not their own spring) — a cast shadow has no
// physics of its own independent of the thing casting it.
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
  const center = React.useRef({ x: 0, y: 0 })
  const motionConfig = React.useContext(MotionConfigContext)
  console.log("SCOPE_DEBUG MotionConfigContext", JSON.stringify(motionConfig))

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

      // eslint-disable-next-line no-console
      console.log("SCOPE_DEBUG onPointerMove", event.clientX, event.clientY, center.current, rawX.get(), rawY.get())
    }

    updateCenter()
    // eslint-disable-next-line no-console
    console.log("SCOPE_DEBUG effect attached, isReduced=", isReduced, "center=", center.current)
    window.addEventListener("resize", updateCenter)
    window.addEventListener("scroll", updateCenter, { passive: true })
    window.addEventListener("pointermove", onPointerMove)
    return () => {
      window.removeEventListener("resize", updateCenter)
      window.removeEventListener("scroll", updateCenter)
      window.removeEventListener("pointermove", onPointerMove)
    }
  }, [isReduced, ref, rawX, rawY, eyeTargetX, eyeTargetY])

  const rawRotateY = useTransform(rawX, [-1, 1], [-MAX_ROTATE_Y, MAX_ROTATE_Y])
  React.useEffect(() => {
    return rawRotateY.on("change", (v) => console.log("SCOPE_DEBUG rawRotateY (pre-spring)", v))
  }, [rawRotateY])
  const rotateY = useSpring(rawRotateY, BODY_SPRING)
  const rotateX = useSpring(useTransform(rawY, [-1, 1], [MAX_ROTATE_X, -MAX_ROTATE_X]), BODY_SPRING)

  const eyeX = useSpring(useTransform(eyeTargetX, [-1, 1], [-EYE_RANGE_PX, EYE_RANGE_PX]), EYE_SPRING)
  const eyeY = useSpring(useTransform(eyeTargetY, [-1, 1], [-EYE_RANGE_PX, EYE_RANGE_PX]), EYE_SPRING)

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

  return { rotateX, rotateY, eyeX, eyeY, parallaxX, parallaxY, shadowX, shadowY, shadowScaleX }
}

export { useScopePresence }
