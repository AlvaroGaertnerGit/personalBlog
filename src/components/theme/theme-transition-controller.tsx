"use client"

import * as React from "react"
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion"
import { useTheme } from "next-themes"

import { useScopeDockContext } from "@/components/scope/companion"
import { duration, easing } from "@/lib/motion"
import { ThemeCurtain } from "./theme-curtain"

interface ThemeTransitionContextValue {
  playThemeTransition: () => void
  isTransitioning: boolean
}

const ThemeTransitionContext = React.createContext<ThemeTransitionContextValue | null>(null)

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

// The look-up beat and the travel that follows it are one continuous
// keyframe animation (not two sequential animate() calls) — a single
// eased curve reads as one fluid motion, where a "settle then restart"
// seam between two back-to-back tweens would read as a stutter. Times are
// fractions of LOOK_UP_TRAVEL_TRANSITION's total duration.
const LOOK_UP_Y = -8
const LOOK_UP_ROTATE = -5
const LOOK_UP_TRAVEL_TIMES = [0, 0.22, 1]
const LOOK_UP_TRAVEL_TRANSITION = { duration: 0.52, ease: easing.inOut, times: LOOK_UP_TRAVEL_TIMES }

// "Ease-in then ease-out... not excessively fast" — still slower than any
// ordinary UI transition (this is a rare, one-shot cinematic moment, not a
// micro-interaction), but trimmed below the app's duration.slower ceiling:
// the original 0.6s-per-beat pacing chained across 6+ beats read as too
// much flat curtain time rather than unhurried.
const CURTAIN_TRANSITION = { duration: 0.5, ease: easing.inOut }
// The one genuinely "dead" beat — curtain fully opaque, nothing visibly
// moving except Scope receding somewhere no one can see. Kept short and the
// extra travel distance small; there's no visual payoff to lingering here,
// unlike every other beat in the sequence.
const CONTINUE_TRANSITION = { duration: 0.18, ease: easing.out }
const ANTICIPATION_PAUSE_MS = 120

// How far beyond the viewport edge Scope travels to read as fully departed
// (not just clipped at the boundary) — generous enough to clear Scope's
// rendered size at any dock scale without needing to measure it per-run.
const OFFSCREEN_MARGIN = 260
// The extra nudge for the brief "continue downward" beat (step 6) — Scope
// is already fully hidden past OFFSCREEN_MARGIN, so this only needs to be
// enough to comfortably clear the reveal's own advancing edge, not a second
// full offscreen trip.
const CONTINUE_MARGIN = 90

type ScopeMotionValues = {
  x: MotionValue<number>
  y: MotionValue<number>
  scale: MotionValue<number>
  rotate: MotionValue<number>
}

// SPR-006 — the dedicated orchestrator the sprint brief asks for: "do not
// place this logic inside the button... introduce a dedicated transition
// controller." ThemeToggle only ever calls playThemeTransition(); everything
// about *how* Scope travels, the curtain descends, the theme actually
// switches, and Scope is restored lives here, kept out of both the button
// and out of ScopeDockContext (which only exposes the narrow mechanism this
// controller borrows — see scope-dock-context.tsx's isSceneTransitioning/
// getScopeMotionValues).
function ThemeTransitionProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()
  const shouldReduceMotion = useReducedMotion()
  const { getScopeMotionValues, stageRef, beginSceneTransition, endSceneTransition } =
    useScopeDockContext()

  const curtainProgress = useMotionValue(0)
  const isPlayingRef = React.useRef(false)
  const [isTransitioning, setIsTransitioning] = React.useState(false)

  const runSequence = React.useCallback(
    async (motionValues: ScopeMotionValues, stage: HTMLDivElement, next: string) => {
      const { x, y, scale, rotate } = motionValues
      const originX = x.get()
      const originY = y.get()
      const originScale = scale.get()
      const originRotate = rotate.get()

      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      beginSceneTransition()

      try {
        // Measured once, up front (not assumed) so this works regardless of
        // current scroll position — scroll is locked above, so this stays
        // valid for the rest of the sequence.
        const stageRect = stage.getBoundingClientRect()
        const aboveViewportY = -OFFSCREEN_MARGIN - stageRect.top
        const belowViewportY = window.innerHeight + OFFSCREEN_MARGIN - stageRect.top

        // 1+2. Focus beat and travel upward, as one continuous curve — stop,
        // glance up, then flow straight into the ascent off the top of the
        // viewport, rather than two separate tweens settling back-to-back.
        await Promise.all([
          animate(
            y,
            [originY, originY + LOOK_UP_Y, aboveViewportY],
            LOOK_UP_TRAVEL_TRANSITION
          ).finished,
          animate(
            rotate,
            [originRotate, originRotate + LOOK_UP_ROTATE, originRotate],
            LOOK_UP_TRAVEL_TRANSITION
          ).finished,
        ]).catch(() => {})

        // 3. Anticipation — grabbing something just outside the viewport.
        await wait(ANTICIPATION_PAUSE_MS)

        // 4. Curtain descends, Scope rides its leading edge down. Chaining
        // Scope's own y to curtainProgress (rather than running two
        // separately-timed animations) is what guarantees they can never
        // drift apart.
        const unsubscribe = curtainProgress.on("change", (v) => {
          y.set(aboveViewportY + (belowViewportY - aboveViewportY) * v)
        })
        await animate(curtainProgress, 1, CURTAIN_TRANSITION).finished.catch(() => {})
        unsubscribe()

        // 5. Theme switch — only once the panel fully covers the viewport.
        // No flushSync/view-transition needed: nothing is visible during
        // the React re-render tick either way, since the curtain is opaque.
        setTheme(next)

        // 6. Continue downward, off the bottom — "he released the
        // mechanism." Deliberately brief: the curtain is fully opaque and
        // static through this whole beat, so there's nothing on screen to
        // linger over.
        await animate(y, belowViewportY + CONTINUE_MARGIN, CONTINUE_TRANSITION).finished.catch(
          () => {}
        )

        // 7. Reveal — the panel retracts by itself.
        await animate(curtainProgress, 0, CURTAIN_TRANSITION).finished.catch(() => {})

        // 8. Return exactly to where Scope started.
        await Promise.all([
          animate(x, originX, CURTAIN_TRANSITION).finished,
          animate(y, originY, CURTAIN_TRANSITION).finished,
          animate(scale, originScale, CURTAIN_TRANSITION).finished,
          animate(rotate, originRotate, CURTAIN_TRANSITION).finished,
        ]).catch(() => {})
      } finally {
        endSceneTransition()
        document.body.style.overflow = previousOverflow
        isPlayingRef.current = false
        setIsTransitioning(false)
      }
    },
    [curtainProgress, beginSceneTransition, endSceneTransition, setTheme]
  )

  const playThemeTransition = React.useCallback(() => {
    if (isPlayingRef.current) return
    const next = resolvedTheme === "dark" ? "light" : "dark"

    if (shouldReduceMotion) {
      setTheme(next)
      return
    }

    const motionValues = getScopeMotionValues()
    const stage = stageRef.current
    // Scope hasn't registered its motion values yet (e.g. this fires before
    // CompanionScope's mount effect has run) — fall back to a plain swap
    // rather than blocking the toggle on a sequence that can't run.
    if (!motionValues || !stage) {
      setTheme(next)
      return
    }

    isPlayingRef.current = true
    setIsTransitioning(true)
    void runSequence(motionValues, stage, next)
  }, [resolvedTheme, shouldReduceMotion, setTheme, getScopeMotionValues, stageRef, runSequence])

  const value = React.useMemo<ThemeTransitionContextValue>(
    () => ({ playThemeTransition, isTransitioning }),
    [playThemeTransition, isTransitioning]
  )

  return (
    <ThemeTransitionContext.Provider value={value}>
      {children}
      <ThemeCurtain progress={curtainProgress} />
    </ThemeTransitionContext.Provider>
  )
}

function useThemeTransition() {
  const context = React.useContext(ThemeTransitionContext)
  if (!context) {
    throw new Error("useThemeTransition must be used within a ThemeTransitionProvider")
  }
  return context
}

export { ThemeTransitionProvider, useThemeTransition }
