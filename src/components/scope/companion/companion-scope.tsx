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
  const { activeDockId, getDockElement, getDockConfig, isAcknowledging } = useScopeDockContext()
  const shouldReduceMotion = useReducedMotion()
  const hasPositioned = React.useRef(false)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const rotate = useMotionValue(0)

  const dockConfig = activeDockId ? getDockConfig(activeDockId) : DEFAULT_SCOPE_DOCK_CONFIG
  const mood = isAcknowledging ? "curious" : dockConfig.mood

  // Runs synchronously before paint (useLayoutEffect, not useEffect) so the
  // very first render never flashes at the (0,0) default before jumping to
  // the Hero dock — see the companion module's README-equivalent comment
  // in scope-dock.tsx for why its own registration effect is also a layout
  // effect, for the same reason.
  React.useLayoutEffect(() => {
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
  }, [activeDockId, dockConfig.scale, dockConfig.facing])

  // Re-measure on resize (a reflow can move a dock without activeDockId
  // ever changing) — always instant, resizing the window isn't a moment
  // that should trigger a "travel" animation.
  React.useEffect(() => {
    function onResize() {
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
  }, [activeDockId, getDockElement, stageRef, x, y])

  return (
    <motion.div
      aria-hidden="true"
      data-slot="companion-scope"
      className="pointer-events-none absolute top-0 left-0 z-30 origin-top-left"
      style={{ x, y, scale, rotate }}
    >
      <Scope mood={mood} className="size-40 sm:size-48" />
    </motion.div>
  )
}

export { CompanionScope }
