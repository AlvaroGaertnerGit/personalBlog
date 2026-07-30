"use client"

import * as React from "react"
import { animate, useMotionValue, type MotionValue, type Transition } from "framer-motion"

import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"
import { computeAttentionOffset } from "./attention-target"
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
const MIN_IDLE_DELAY_MS = 3000
const MAX_IDLE_DELAY_MS = 7000

function randomDelay() {
  return MIN_IDLE_DELAY_MS + Math.random() * (MAX_IDLE_DELAY_MS - MIN_IDLE_DELAY_MS)
}

// SPR-005 — "look at target": an occasional glance toward a registered
// point of interest (a project world's own ball/graph marker — see
// ScopeDockConfig.attentionTarget), layered into the exact same scheduling
// rhythm as every other gesture below rather than a separate timer. The
// reach/range geometry lives in attention-target.ts, kept out of this file
// so its own arithmetic doesn't add to this hook's complexity.
const ATTENTION_LOOK_CHANCE = 0.35
const ATTENTION_HOLD_MS = 900
const ATTENTION_TO_TRANSITION: Transition = { type: "spring", stiffness: 90, damping: 16, mass: 0.6 }
const ATTENTION_BACK_TRANSITION: Transition = { type: "spring", stiffness: 80, damping: 20, mass: 0.6 }

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
function useScopePersonality(
  scopeRef: React.RefObject<HTMLElement | null>,
  attentionTarget?: React.RefObject<Element | null>,
  suspended = false
): ScopePersonality {
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

  // `attentionTarget` changes identity every time the active dock changes
  // (a different world's ref, or none) — but the scheduling effect below
  // deliberately stays mounted across dock/mood changes (only `armed`
  // reruns it, per the SPR-003.4 fix). Mirroring that fix's own mistake
  // here would mean a stale target from whichever dock was active when the
  // effect last mounted. A "latest value" ref, synced on every render,
  // keeps runGesture() reading the current target without needing the big
  // effect to restart. `scopeRef` doesn't need this: it's the same stable
  // ref object for Scope's whole lifetime, and only `.current` is read
  // fresh each time, which a plain ref already gives for free.
  const attentionTargetRef = React.useRef(attentionTarget)
  React.useEffect(() => {
    attentionTargetRef.current = attentionTarget
  }, [attentionTarget])

  // Gated only on reduced-motion, deliberately NOT on `mood`. This hook used
  // to also require `mood === "idle"`, back when idle was the only resting
  // state Scope could be in. The companion dock system (SPR-003.4) then
  // added a second resting mood — "observe", for the demo-section dock —
  // and that condition silently broke: every idle blink/gesture, plus this
  // effect's listeners, got torn down the instant Scope docked anywhere
  // that wasn't literally "idle", and never recovered until mood happened
  // to become "idle" again. Personality is designed to be a fully
  // independent layer, composed additively/multiplicatively with Motion and
  // Presence at the scope.tsx composition point (see the comments there) —
  // it has no business re-deciding whether "now" is an appropriate moment
  // for mood based on a hardcoded string it doesn't own. Presence already
  // runs unconditionally the same way; Personality now matches it.
  // SPR-006: `suspended` is the theme-transition curtain sequence's "stop
  // idle gestures" signal — the exact same disarm path reduced-motion
  // already takes below (reset everything to neutral, tear down the
  // scheduler), just temporary rather than permanent for the session.
  const armed = !isReduced && !suspended

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

    // Reads both rects live at fire-time (never cached) so it stays correct
    // even though the target may itself be in motion (a bouncing ball, a
    // point riding a graph) — geometry lives in attention-target.ts.
    async function runLookAt(target: Element) {
      const scopeEl = scopeRef.current
      if (!scopeEl) return

      const { dx, dy } = computeAttentionOffset(
        scopeEl.getBoundingClientRect(),
        target.getBoundingClientRect()
      )

      activeControls = [
        animate(eyeOffsetX, dx, ATTENTION_TO_TRANSITION),
        animate(eyeOffsetY, dy, ATTENTION_TO_TRANSITION),
      ]
      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
      if (cancelled) return

      await new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(resolve, ATTENTION_HOLD_MS)
      })
      if (cancelled) return

      activeControls = [
        animate(eyeOffsetX, 0, ATTENTION_BACK_TRANSITION),
        animate(eyeOffsetY, 0, ATTENTION_BACK_TRANSITION),
      ]
      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
    }

    async function runGesture() {
      dispatch({ type: "gesture-start" })

      // A registered point of interest gets first refusal, at a fixed
      // probability, before falling through to the ordinary gesture pool
      // below — deliberately NOT added to PERSONALITY_GESTURE_NAMES itself
      // (see the comment on ATTENTION_* above): that pool is static data,
      // this is a live-computed target, and this branch leaves the
      // existing pool's selection/repeat-avoidance logic untouched.
      const attentionEl = attentionTargetRef.current?.current
      if (attentionEl && Math.random() < ATTENTION_LOOK_CHANCE) {
        await runLookAt(attentionEl)
        if (!cancelled) {
          dispatch({ type: "gesture-end" })
          scheduleNext(randomDelay())
        }
        return
      }

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
