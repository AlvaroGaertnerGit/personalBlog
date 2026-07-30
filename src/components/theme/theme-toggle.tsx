"use client"

import { motion } from "framer-motion"
import { useTheme } from "next-themes"

import { useMounted } from "@/hooks/use-mounted"
import { transitions } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { useThemeTransition } from "./theme-transition-controller"

// Deliberately not a sun/moon OS-style switch — "the toggle should never
// feel like an operating system control." A small pill with a sliding
// thumb that borrows Scope's own two accent tones (--scope-warm in light,
// --scope-accent in dark) instead of generic iconography, so it reads as
// part of this portfolio's own palette rather than a borrowed system
// widget. Thumb position (x) and the two tone layers (opacity) are the
// only things that animate — transform/opacity only, per the motion
// skill's golden rule — using the shared `toggle` transition token so this
// stays on the same motion language as every other state-toggle in the app.
//
// SPR-006: this component only ever triggers the cinematic sequence — "do
// not place this logic inside the button" — everything about *how* the
// theme actually changes lives in ThemeTransitionProvider
// (theme-transition-controller.tsx).
function ThemeToggle({ className, ...props }: React.ComponentProps<"button">) {
  const { resolvedTheme: theme } = useTheme()
  const { playThemeTransition, isTransitioning } = useThemeTransition()
  // next-themes can't know the resolved theme during SSR/the first client
  // render (it depends on localStorage/matchMedia) — resolving `isDark`
  // straight from `theme` would render "light" on the server and then
  // silently flip after hydration, which is exactly the aria-label/
  // aria-pressed mismatch React's hydration warning flags. Gating on
  // `mounted` (useMounted — the same useSyncExternalStore pattern
  // useIsReducedMotion uses for the same class of problem) keeps the first
  // client render identical to the server's, then corrects one paint later.
  const mounted = useMounted()
  const isDark = mounted && theme === "dark"

  return (
    <button
      type="button"
      onClick={playThemeTransition}
      disabled={isTransitioning}
      aria-label={isDark ? "Switch to light atmosphere" : "Switch to dark atmosphere"}
      aria-pressed={isDark}
      data-slot="theme-toggle"
      className={cn(
        "border-border bg-muted/80 relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border backdrop-blur-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
        className
      )}
      {...props}
    >
      <span className="sr-only">Toggle atmosphere</span>
      <motion.span
        aria-hidden="true"
        className="absolute top-1 left-1 size-5 rounded-full"
        animate={{ x: isDark ? 20 : 0 }}
        transition={transitions.toggle}
      >
        <motion.span
          className="bg-scope-warm absolute inset-0 rounded-full"
          animate={{ opacity: isDark ? 0 : 1 }}
          transition={transitions.toggle}
        />
        <motion.span
          className="bg-scope-accent absolute inset-0 rounded-full"
          animate={{ opacity: isDark ? 1 : 0 }}
          transition={transitions.toggle}
        />
      </motion.span>
    </button>
  )
}

export { ThemeToggle }
