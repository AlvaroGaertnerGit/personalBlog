"use client"

import * as React from "react"
import { useMotionValue, type MotionValue } from "framer-motion"

// A small, shared combinator: derives one MotionValue from several
// independent source MotionValues.
//
// Implemented as a self-scheduling requestAnimationFrame poll, not
// Motion's own multi-input useTransform, nor a manual `.on("change", ...)`
// subscription — both were tried here first and, empirically, neither
// reliably kept the combined value in sync past its first computed result
// for this codebase's specific usage (verified in the browser across
// several combinations). A per-frame poll sidesteps the question of
// exactly which subscription mechanism is reliable for which kind of
// source value (a raw, discretely-`.set()` value like a cursor position
// vs. a continuously self-animating spring) — it just re-reads every
// source's `.get()` every frame and writes the result only when it
// actually changed, which is correct by construction regardless of how
// any given source got its own new value.
//
// Used wherever two or more independent layers (Presence, Personality,
// Mood) need to affect the same visual property additively/multiplicatively
// — e.g. presence's cursor-driven eye position + personality's occasional
// look-direction nudge, or presence's proximity-to-cursor + a one-way
// "has ever interacted" gate for the accent dot's visibility.
function useCombinedMotionValue<T extends number[]>(
  values: { [K in keyof T]: MotionValue<T[K]> },
  combine: (values: T) => number
): MotionValue<number> {
  const valuesRef = React.useRef(values)
  const combineRef = React.useRef(combine)

  const result = useMotionValue(combine(values.map((v) => v.get()) as T))

  React.useEffect(() => {
    let frame: number
    let last = result.get()

    function tick() {
      const next = combineRef.current(valuesRef.current.map((v) => v.get()) as T)
      if (next !== last) {
        last = next
        result.set(next)
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return result
}

export { useCombinedMotionValue }
