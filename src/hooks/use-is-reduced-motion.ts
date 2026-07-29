"use client"

import { useReducedMotion } from "framer-motion"

import { useMounted } from "./use-mounted"

// useReducedMotion() reads matchMedia synchronously during render, so it
// can differ between SSR (no window) and the client's first render — a
// hydration mismatch. useMounted() keeps the first client render
// consistent with SSR; it corrects one paint later once genuinely mounted.
// Shared by every hook that needs this check (useParallax, useScopeMotion,
// ...) instead of re-derived per hook — see the motion skill's warning
// against duplicating this check per component.
function useIsReducedMotion(): boolean {
  const shouldReduceMotion = useReducedMotion()
  const mounted = useMounted()
  return mounted && Boolean(shouldReduceMotion)
}

export { useIsReducedMotion }
