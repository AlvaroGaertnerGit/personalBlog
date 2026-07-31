"use client"

import * as React from "react"
import { animate, motion, useMotionValue, type Transition } from "framer-motion"

import { ScopeDock } from "@/components/scope/companion"
import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"

// SPR-005 — Tournamently's "world": a padel ball Scope has found, resting
// beside it. An occasional tiny hop, never a continuous bounce loop (that
// reads as a loading/game animation, not curiosity) — timed on its own
// independent, infrequent schedule, deliberately NOT synced to Scope's own
// idle-gesture timer (use-scope-personality.ts). Personality's "look at
// target" gesture occasionally glances at the ball on its own schedule via
// config.attentionTarget below; the two happening to coincide sometimes is
// what makes it read as genuine noticing rather than a scripted cue.
const MIN_HOP_DELAY_MS = 2000
const MAX_HOP_DELAY_MS = 3500

const HOP_UP: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 16,
  mass: 0.5,
}

const HOP_DOWN: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 14,
  mass: 0.5,
}

function hopDelay() {
  return MIN_HOP_DELAY_MS + Math.random() * (MAX_HOP_DELAY_MS - MIN_HOP_DELAY_MS)
}

function TournamentlyWorld() {
  const ballRef = React.useRef<HTMLDivElement>(null)
  const ballY = useMotionValue(0)
  const isReduced = useIsReducedMotion()

  React.useEffect(() => {
    if (isReduced) return

    let cancelled = false
    let timeoutId: number | undefined

    async function hop() {
      const up = animate(ballY, -20, HOP_UP)
      await up.finished.catch(() => {})
      if (cancelled) return

      const down = animate(ballY, 0, HOP_DOWN)
      await down.finished.catch(() => {})
      if (cancelled) return

      timeoutId = window.setTimeout(hop, hopDelay())
    }

    timeoutId = window.setTimeout(hop, hopDelay())
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      ballY.set(0)
    }
  }, [isReduced, ballY])

  return (
    <div className="relative h-64 w-full overflow-hidden sm:h-80">
      <div aria-hidden="true" className="from-muted/25 absolute inset-0 bg-gradient-to-t to-transparent" />

      {/* a single soft sideline — evokes competition/sport without being a
          literal court diagram, per the brief's "avoid cliché" spirit. */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMax slice"
      >
        <path d="M -20 320 Q 200 195 420 320" stroke="var(--border)" strokeWidth="1.5" fill="none" />
      </svg>

      <div className="absolute inset-x-0 bottom-8 flex items-end justify-center gap-5 sm:bottom-10 sm:gap-6">
        <ScopeDock
          id="tournamently"
          config={{ mood: "observe", scale: 0.75, attentionTarget: ballRef }}
          className="size-32 sm:size-40"
        />
        <motion.div
          ref={ballRef}
          aria-hidden="true"
          style={{ x: 0, y: ballY }}
          className="relative size-5"
        >
          <svg viewBox="0 0 32 32" className="size-full">
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="#DDFB3A"
            />

            <path
              d="M 7 8
                C 16 12 16 20 7 24"
              stroke="white"
              strokeWidth="2"
              fill="none"
              opacity="0.95"
            />

            <circle
              cx="11"
              cy="10"
              r="3"
              fill="white"
              opacity="0.25"
            />
          </svg>
        </motion.div>
      </div>
    </div>
  )
}

export { TournamentlyWorld }
