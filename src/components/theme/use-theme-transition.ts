"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useReducedMotion } from "framer-motion"
import { flushSync } from "react-dom"

// Drives the cinematic atmosphere sweep (see globals.css's
// ::view-transition-* rules) on top of next-themes' plain class swap.
// document.startViewTransition isn't a motion.* prop, so MotionConfig's
// reducedMotion="user" can't gate it — this is exactly the manual
// useReducedMotion() case the motion skill's accessibility reference calls
// out for anything driven outside Framer's own components.
function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme()
  const shouldReduceMotion = useReducedMotion()

  const toggleTheme = React.useCallback(() => {
    const next = resolvedTheme === "dark" ? "light" : "dark"

    if (shouldReduceMotion || !document.startViewTransition) {
      setTheme(next)
      return
    }

    // startViewTransition's callback is expected to update the DOM
    // synchronously before it returns — React's setTheme normally schedules
    // that update for a later microtask, which the View Transition API
    // doesn't wait for. flushSync forces the class swap to commit within
    // this callback, matching what the API expects.
    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next))
    })
    // The transition can still be skipped/aborted by the browser (e.g. a
    // resize or another transition interrupting it) independently of
    // whether the DOM update above already committed — per MDN's own
    // guidance, `.ready`/`.finished` must be handled or an unrelated abort
    // surfaces as an unhandled rejection. The theme itself already applied
    // via flushSync regardless; a skipped animation just means it swaps
    // without the sweep that one time, never a broken theme.
    transition.ready.catch(() => {})
    transition.finished.catch(() => {})
  }, [resolvedTheme, setTheme, shouldReduceMotion])

  return { theme: resolvedTheme, toggleTheme }
}

export { useThemeTransition }
