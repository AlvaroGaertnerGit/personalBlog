"use client"

import { useSyncExternalStore } from "react"
import { useReducedMotion } from "framer-motion"

const subscribeNoop = () => () => {}

// useReducedMotion() reads matchMedia synchronously during render, so it
// can differ between SSR (no window) and the client's first render — a
// hydration mismatch. useSyncExternalStore's getServerSnapshot keeps the
// first client render consistent with SSR; it corrects one paint later
// once genuinely mounted. Shared by every hook that needs this check
// (useParallax, useScopeMotion, ...) instead of re-derived per hook — see
// the motion skill's warning against duplicating this check per component.
function useIsReducedMotion(): boolean {
  const shouldReduceMotion = useReducedMotion()
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
  return mounted && Boolean(shouldReduceMotion)
}

export { useIsReducedMotion }
