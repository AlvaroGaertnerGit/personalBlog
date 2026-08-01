"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion"

import { Scope } from "@/components/scope/scope"
import { springs } from "@/lib/motion"
import { DEFAULT_SCOPE_DOCK_CONFIG } from "./scope-docks"
import { useScopeDockContext } from "./scope-dock-context"

interface CompanionScopeProps {
  stageRef: React.RefObject<HTMLDivElement | null>
}

// The one shared <Scope> instance for the whole portfolio. <ScopeDock>
// leaves (scope-dock.tsx) only render placeholder slots inside sections —
// this component measures whichever dock is currently active
// (scope-dock-context.tsx) and travels there.
//
// Positioned with `position: absolute` + transform (x/y/scale/rotate)
// inside the shared stage, never `position: fixed` — Scope scrolls with
// the page like it actually lives at that spot, rather than clinging to a
// fixed viewport corner (explicitly forbidden by the companion-system
// brief: "do not pin Scope... do not lock it to viewport coordinates").
// Only transform/opacity ever animate here, per the motion skill's golden
// rule — width/height/top/left are never touched.
function CompanionScope({ stageRef }: CompanionScopeProps) {
  const {
    activeDockId,
    getDockElement,
    getDockConfig,
    isAcknowledging,
    isSceneTransitioning,
    sceneMood,
    registerScopeMotionValues,
  } = useScopeDockContext()
  const shouldReduceMotion = useReducedMotion()
  const hasPositioned = React.useRef(false)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const rotate = useMotionValue(0)

  // SPR-006: hand these same motion values to ScopeDockContext so
  // ThemeTransitionProvider can animate them directly during the theme
  // curtain sequence instead of duplicating this positioning mechanism.
  // Identity is stable for the component's lifetime, so registering once on
  // mount is enough.
  React.useLayoutEffect(() => {
    registerScopeMotionValues({ x, y, scale, rotate })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dockConfig = activeDockId ? getDockConfig(activeDockId) : DEFAULT_SCOPE_DOCK_CONFIG
  // While an orchestrator has commandeered Scope, mood is forced to
  // `sceneMood` (defaults to "observe" — lean-forward, wider eyes, the same
  // body language a settle-in resting mood already reads as "focused") —
  // rather than whatever dock/acknowledge state happened to be active when
  // the sequence began. SPR-009: `sceneMood` is settable per-orchestrator
  // (see scope-dock-context.tsx) so e.g. Contact's departure beat can walk
  // away at "idle" instead of staying "observe" for its entire sequence.
  const mood = isSceneTransitioning ? sceneMood : isAcknowledging ? "curious" : dockConfig.mood

  // Runs synchronously before paint (useLayoutEffect, not useEffect) so the
  // very first render never flashes at the (0,0) default before jumping to
  // the Hero dock — see the companion module's README-equivalent comment
  // in scope-dock.tsx for why its own registration effect is also a layout
  // effect, for the same reason.
  React.useLayoutEffect(() => {
    // SPR-006: while the theme-transition curtain sequence owns Scope's
    // position, this effect stands down entirely rather than fighting the
    // sequence's own animate() calls on the same motion values. It's in the
    // dep array below, so ending the transition re-runs this effect —
    // a no-op re-sync, since the sequence always restores Scope to exactly
    // this same target before releasing control.
    if (isSceneTransitioning) return

    const stage = stageRef.current
    const dock = activeDockId ? getDockElement(activeDockId) : null
    if (!stage || !dock) return

    const stageRect = stage.getBoundingClientRect()
    const dockRect = dock.getBoundingClientRect()
    const targetX = dockRect.left - stageRect.left
    const targetY = dockRect.top - stageRect.top
    const targetScale = dockConfig.scale
    const targetRotate = dockConfig.facing

    const instant = !hasPositioned.current || shouldReduceMotion
    hasPositioned.current = true

    if (instant) {
      x.set(targetX)
      y.set(targetY)
      scale.set(targetScale)
      rotate.set(targetRotate)
      return
    }

    // "Heavy. Calm. Intentional." — springs.companion (src/lib/motion/springs.ts)
    // is deliberately much slower/heavier than the UI-facing `layout` spring.
    animate(x, targetX, springs.companion)
    animate(y, targetY, springs.companion)
    animate(scale, targetScale, springs.companion)
    animate(rotate, targetRotate, springs.companion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDockId, dockConfig.scale, dockConfig.facing, isSceneTransitioning])

  // Re-measure on resize (a reflow can move a dock without activeDockId
  // ever changing) — always instant, resizing the window isn't a moment
  // that should trigger a "travel" animation. Skipped while the theme
  // sequence owns Scope's position, for the same reason as the effect above.
  React.useEffect(() => {
    function onResize() {
      if (isSceneTransitioning) return
      const stage = stageRef.current
      const dock = activeDockId ? getDockElement(activeDockId) : null
      if (!stage || !dock) return
      const stageRect = stage.getBoundingClientRect()
      const dockRect = dock.getBoundingClientRect()
      x.set(dockRect.left - stageRect.left)
      y.set(dockRect.top - stageRect.top)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [activeDockId, getDockElement, stageRef, x, y, isSceneTransitioning])

  return (
    <motion.div
      aria-hidden="true"
      data-slot="companion-scope"
      className="pointer-events-none absolute top-0 left-0 z-30 origin-top-left"
      style={{ x, y, scale, rotate }}
    >
      <Scope
        mood={mood}
        attentionTarget={dockConfig.attentionTarget}
        suspended={isSceneTransitioning}
        resetSignal={activeDockId}
        className="size-40 sm:size-48"
      />
    </motion.div>
  )
}

export { CompanionScope }
