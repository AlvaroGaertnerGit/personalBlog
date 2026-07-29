"use client"

import { useRef } from "react"
import { useScroll, useTransform, type MotionValue } from "framer-motion"

import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"
import { distance } from "@/lib/motion"

interface UseParallaxResult<T extends HTMLElement> {
  ref: React.RefObject<T | null>
  y: MotionValue<number>
}

function useParallax<T extends HTMLElement = HTMLDivElement>(
  offsetPx: number = distance.lg
): UseParallaxResult<T> {
  const ref = useRef<T>(null)
  const isReduced = useIsReducedMotion()

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
