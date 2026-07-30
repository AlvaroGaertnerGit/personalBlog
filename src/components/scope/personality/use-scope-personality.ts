"use client"

import * as React from "react"
import { animate, useMotionValue, type MotionValue } from "framer-motion"

import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"
import type { ScopeMood } from "../scope.types"
import {
  ANTICIPATE_TRANSITION,
  BLINK_PATTERNS,
  PERSONALITY_GESTURES,
  PERSONALITY_GESTURE_NAMES,
  type PersonalityGestureName,
} from "./personality-gestures"

// How long Scope must go undisturbed before it does something small on its
// own. Randomized per wait, never a fixed interval, so it never reads as a
// loop with a tell.
const MIN_IDLE_DELAY_MS = 6000
const MAX_IDLE_DELAY_MS = 14000

function randomDelay() {
  return MIN_IDLE_DELAY_MS + Math.random() * (MAX_IDLE_DELAY_MS - MIN_IDLE_DELAY_MS)
}

function pickGesture(exclude: PersonalityGestureName | null): PersonalityGestureName {
  const pool = exclude
    ? PERSONALITY_GESTURE_NAMES.filter((name) => name !== exclude)
    : PERSONALITY_GESTURE_NAMES
  return pool[Math.floor(Math.random() * pool.length)]
}

function isBlinkGesture(
  name: PersonalityGestureName
): name is "blink" | "double-blink" | "slow-blink" {
  return name in BLINK_PATTERNS
}

// Behavioural states, not animation states — "gesturing" says nothing about
// *which* gesture or its numbers (that's personality-gestures.ts's job).
// Exposed only for introspection/future use today; the actual scheduling is
// driven by refs/closures below (React state updates are async and
// unsuitable for driving precise imperative timers — the same reason
// ScopeDockContext's own acknowledge() pairs a setTimeout ref with a
// parallel piece of React state rather than relying on state alone).
type PersonalityState = "dormant" | "restless" | "gesturing"
type PersonalityAction =
  | { type: "armed" }
  | { type: "activity" }
  | { type: "gesture-start" }
  | { type: "gesture-end" }
  | { type: "disarmed" }

function personalityReducer(state: PersonalityState, action: PersonalityAction): PersonalityState {
  switch (action.type) {
    case "armed":
      return state === "dormant" ? "restless" : state
    case "activity":
      return state === "gesturing" ? state : "dormant"
    case "gesture-start":
      return "gesturing"
    case "gesture-end":
      return "restless"
    case "disarmed":
      return "dormant"
  }
}

interface ScopePersonality {
  rotate: MotionValue<number>
  y: MotionValue<number>
  scale: MotionValue<number>
  blinkScaleY: MotionValue<number>
  eyeOffsetX: MotionValue<number>
  eyeOffsetY: MotionValue<number>
  eyeConverge: MotionValue<number>
  antennaFlex: MotionValue<number>
}

// Scope's autonomous idle-gesture layer — the "why and when" of occasional,
// unprompted micro-behaviour. SCOPE_UNDERSTANDING.md §5 already treats
// idle's breathing loop (SCOPE_IDLE_ANIMATE in ../scope-motion.ts) as
// Scope's accepted resting *presence*, not "a waiting state filled with a
// loop." This hook is a bounded, restrained extension of that same
// precedent — an occasional, non-repeating variation layered on top of the
// breathing baseline — not a new category of decorative motion.
//
// A third independent layer, following the exact pattern already
// established by useScopeMotion (mood — see ../use-scope-motion.ts) and
// useScopePresence (cursor physics — see ../use-scope-presence.ts): a
// self-contained hook returning plain MotionValues, composed into scope.tsx
// alongside the other two, with zero knowledge of either. Works identically
// wherever <Scope> is rendered, including the provider-less /scope lab
// route (src/app/scope/scope-lab.tsx) — no React context involved.
//
// SPR-003.3 (character finalization): the returned set grew from
// {rotate, y, focusOpacity} to the seven values above — eyeOffsetX/Y and
// eyeConverge are additive with presence's own eyeX/eyeY (composed via a
// useTransform sum at the scope.tsx composition point, not here);
// blinkScaleY is multiplicative with mood's own eyeScaleY (composed via a
// nested <motion.g>, not useTransform — mood's eyeScaleY isn't a
// MotionValue, so it can't be combined that way, a mistake caught before
// writing this file). `focusOpacity` is retired: true blinks (a real
// scaleY close-open) now do the "something flickered to life" job
// literally, per VISUAL_LANGUAGE.md v2.0's "expression comes only from
// movement, timing and spacing."
//
// "Movement resumes → attentive again" still needs no new visual state:
// any cursor activity simply defers the idle timer (see the debounce
// below), so a gesture can never fire while the visitor is actively
// moving the mouse.
function useScopePersonality(mood: ScopeMood): ScopePersonality {
  const isReduced = useIsReducedMotion()

  const rotate = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const blinkScaleY = useMotionValue(1)
  const eyeOffsetX = useMotionValue(0)
  const eyeOffsetY = useMotionValue(0)
  const eyeConverge = useMotionValue(0)
  const antennaFlex = useMotionValue(0)

  const [, dispatch] = React.useReducer(personalityReducer, "dormant")
  // Persists across the effect's own armed/disarmed re-runs (e.g. Scope
  // leaves and returns to idle) without needing to live at module scope,
  // which would leak state across every <Scope> instance ever mounted.
  const lastGestureRef = React.useRef<PersonalityGestureName | null>(null)

  const armed = mood === "idle" && !isReduced

  React.useEffect(() => {
    if (!armed) {
      dispatch({ type: "disarmed" })
      rotate.set(0)
      y.set(0)
      scale.set(1)
      blinkScaleY.set(1)
      eyeOffsetX.set(0)
      eyeOffsetY.set(0)
      eyeConverge.set(0)
      antennaFlex.set(0)
      return
    }

    dispatch({ type: "armed" })

    let cancelled = false
    let timeoutId: number | undefined
    let activeControls: ReturnType<typeof animate>[] = []

    function scheduleNext(delay: number) {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(runGesture, delay)
    }

    // Any cursor activity or the tab regaining visibility pushes the idle
    // timer back out — a debounce, not a periodic poll. This is the entire
    // mechanism behind "occasionally, when left alone."
    function onActivity() {
      dispatch({ type: "activity" })
      scheduleNext(randomDelay())
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") onActivity()
      else window.clearTimeout(timeoutId)
    }

    async function runBlink(name: "blink" | "double-blink" | "slow-blink") {
      const pattern = BLINK_PATTERNS[name]
      activeControls = [animate(blinkScaleY, pattern.keyframes, pattern.transition)]
      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
    }

    async function runGesture() {
      dispatch({ type: "gesture-start" })
      const lastGesture = lastGestureRef.current
      const name = pickGesture(lastGesture)
      lastGestureRef.current = name

      if (isBlinkGesture(name)) {
        await runBlink(name)
        if (!cancelled) {
          dispatch({ type: "gesture-end" })
          scheduleNext(randomDelay())
        }
        return
      }

      const spec = PERSONALITY_GESTURES[name]

      // Anticipation: a brief, small counter-move before the real gesture,
      // additive to total duration (not stolen from holdMs). Sequential
      // animate() calls, not a single keyframe array — `to`/`back` are
      // springs, and springs only settle a single start→end pair.
      if (spec.anticipate) {
        activeControls = []
        if (spec.anticipate.rotate !== undefined)
          activeControls.push(animate(rotate, spec.anticipate.rotate, ANTICIPATE_TRANSITION))
        if (spec.anticipate.y !== undefined)
          activeControls.push(animate(y, spec.anticipate.y, ANTICIPATE_TRANSITION))
        await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
        if (cancelled) return
      }

      activeControls = []
      if (spec.body?.rotate !== undefined) activeControls.push(animate(rotate, spec.body.rotate, spec.to))
      if (spec.body?.y !== undefined) activeControls.push(animate(y, spec.body.y, spec.to))
      if (spec.body?.scale !== undefined) activeControls.push(animate(scale, spec.body.scale, spec.to))
      if (spec.eyeOffset?.x !== undefined)
        activeControls.push(animate(eyeOffsetX, spec.eyeOffset.x, spec.to))
      if (spec.eyeOffset?.y !== undefined)
        activeControls.push(animate(eyeOffsetY, spec.eyeOffset.y, spec.to))
      if (spec.eyeScale !== undefined) activeControls.push(animate(blinkScaleY, spec.eyeScale, spec.to))
      if (spec.eyeConverge !== undefined)
        activeControls.push(animate(eyeConverge, spec.eyeConverge, spec.to))
      if (spec.antennaFlex !== undefined)
        activeControls.push(animate(antennaFlex, spec.antennaFlex, spec.to))

      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
      if (cancelled) return

      await new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(resolve, spec.holdMs)
      })
      if (cancelled) return

      activeControls = []
      if (spec.body?.rotate !== undefined) activeControls.push(animate(rotate, 0, spec.back))
      if (spec.body?.y !== undefined) activeControls.push(animate(y, 0, spec.back))
      if (spec.body?.scale !== undefined) activeControls.push(animate(scale, 1, spec.back))
      if (spec.eyeOffset?.x !== undefined) activeControls.push(animate(eyeOffsetX, 0, spec.back))
      if (spec.eyeOffset?.y !== undefined) activeControls.push(animate(eyeOffsetY, 0, spec.back))
      if (spec.eyeScale !== undefined) activeControls.push(animate(blinkScaleY, 1, spec.back))
      if (spec.eyeConverge !== undefined) activeControls.push(animate(eyeConverge, 0, spec.back))
      if (spec.antennaFlex !== undefined) activeControls.push(animate(antennaFlex, 0, spec.back))

      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
      if (cancelled) return

      dispatch({ type: "gesture-end" })
      scheduleNext(randomDelay())
    }

    window.addEventListener("pointermove", onActivity)
    window.addEventListener("pointerdown", onActivity)
    document.addEventListener("visibilitychange", onVisibilityChange)
    scheduleNext(randomDelay())

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      activeControls.forEach((controls) => controls.stop())
      window.removeEventListener("pointermove", onActivity)
      window.removeEventListener("pointerdown", onActivity)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed])

  return { rotate, y, scale, blinkScaleY, eyeOffsetX, eyeOffsetY, eyeConverge, antennaFlex }
}

export { useScopePersonality }
