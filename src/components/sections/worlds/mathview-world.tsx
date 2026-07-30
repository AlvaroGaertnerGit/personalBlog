"use client"

import * as React from "react"
import { motion, useTime, useTransform } from "framer-motion"

import { ScopeDock } from "@/components/scope/companion"
import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"

// SPR-005 — MathView's "world". One object, per the brief's instruction:
// a minimal coordinate plane with a curve, not a rotating cube (would need
// real 3D transforms or a 3D dependency this project doesn't have — "keep
// animations lightweight") and not an animated `d` path (animating SVG
// path geometry every frame is a real repaint cost, not the "transform/
// opacity only" the motion skill asks for). The curve itself is static,
// computed once; only a small dot riding along it moves, via transform —
// the same category of cheap, continuous motion use-scope-presence.ts
// already uses for Scope's own eye jitter (useTime + useTransform).
const VIEW_W = 400
const VIEW_H = 300
const AXIS_Y = 230
const AXIS_X = 70
const CURVE_X_MIN = 75
const CURVE_X_MAX = 355
const AMPLITUDE = 45
const FREQUENCY = (Math.PI * 2 * 1.15) / (CURVE_X_MAX - CURVE_X_MIN)
// One full traverse of the curve, there and back — slow and "breathing,"
// never fast enough to read as attention-grabbing.
const CYCLE_MS = 16000

function curveY(x: number) {
  return AXIS_Y - AMPLITUDE * Math.sin((x - CURVE_X_MIN) * FREQUENCY)
}

function buildCurvePath() {
  const step = 8
  const points: string[] = []
  for (let x = CURVE_X_MIN; x <= CURVE_X_MAX; x += step) {
    points.push(`${x} ${curveY(x).toFixed(2)}`)
  }
  return `M ${points.join(" L ")}`
}

function MathViewWorld() {
  const dotRef = React.useRef<SVGCircleElement>(null)
  const isReduced = useIsReducedMotion()
  const time = useTime()

  const curvePath = React.useMemo(() => buildCurvePath(), [])

  // A triangle wave (0 → 1 → 0) over CYCLE_MS, so the dot rides out to one
  // end of the curve and back rather than snapping — "a graph slowly
  // oscillates," not a repeating loop with a visible reset.
  const dotX = useTransform(time, (t) => {
    const progress = Math.abs(((t / CYCLE_MS) % 2) - 1)
    return CURVE_X_MIN + progress * (CURVE_X_MAX - CURVE_X_MIN)
  })
  const dotY = useTransform(dotX, curveY)

  return (
    <div className="relative h-64 w-full overflow-hidden sm:h-80">
      <div aria-hidden="true" className="from-muted/25 absolute inset-0 bg-gradient-to-t to-transparent" />

      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* a minimal coordinate plane — two thin axis lines, no ticks or
            labels, per "minimalism is important." */}
        <line x1={AXIS_X} y1="40" x2={AXIS_X} y2="260" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="45" y1={AXIS_Y} x2="375" y2={AXIS_Y} stroke="var(--border)" strokeWidth="1.5" />

        <path d={curvePath} stroke="var(--scope-warm)" strokeWidth="2" fill="none" opacity="0.7" />

        {!isReduced ? (
          <motion.circle
            ref={dotRef}
            aria-hidden="true"
            r="4"
            className="fill-scope-warm"
            style={{ x: dotX, y: dotY }}
          />
        ) : (
          <circle
            ref={dotRef}
            aria-hidden="true"
            cx={CURVE_X_MIN}
            cy={curveY(CURVE_X_MIN)}
            r="4"
            className="fill-scope-warm"
          />
        )}
      </svg>

      <div className="absolute bottom-8 left-8 sm:bottom-10 sm:left-10">
        <ScopeDock
          id="mathview"
          config={{ mood: "observe", scale: 0.75, attentionTarget: dotRef }}
          className="size-32 sm:size-40"
        />
      </div>
    </div>
  )
}

export { MathViewWorld }
