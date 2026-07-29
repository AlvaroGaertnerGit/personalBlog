"use client"

import { useRef, useSyncExternalStore } from "react"
import { useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion"

import { distance } from "@/lib/motion"

interface UseParallaxResult<T extends HTMLElement> {
  ref: React.RefObject<T | null>
  y: MotionValue<number>
}

const subscribeNoop = () => () => {}

function useParallax<T extends HTMLElement = HTMLDivElement>(
  offsetPx: number = distance.lg
): UseParallaxResult<T> {
  const ref = useRef<T>(null)
  const shouldReduceMotion = useReducedMotion()

  // useReducedMotion() reads matchMedia synchronously during render, so it
  // can differ between SSR (no window) and the client's first render —
  // a hydration mismatch on `style`. useSyncExternalStore's getServerSnapshot
  // keeps the first client render consistent with SSR; it corrects one
  // paint later once genuinely mounted.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
  const isReduced = mounted && shouldReduceMotion

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    isReduced ? [0, 0] : [-offsetPx, offsetPx]
  )

  return { ref, y }
}

export { useParallax }
