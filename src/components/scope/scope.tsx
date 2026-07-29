"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { SCOPE_GLOW_TRANSITION } from "./scope-motion"
import type { ScopeMood } from "./scope.types"
import { useScopeMotion } from "./use-scope-motion"
import { useScopePresence } from "./use-scope-presence"

// Scope — the portfolio's companion. Canonical source of truth:
// docs/scope-docs/scope/ (read SCOPE_UNDERSTANDING.md first).
//
// A client component now that it animates — see the performance skill's
// "extract the interactive piece into its own client leaf" guidance; the
// Hero and every other place Scope is mounted stay Server Components.
//
// Deliberately a pure function of `mood`: no callback props, no internal
// mood state. Whoever controls mood (the /scope lab page today, other
// placements later) owns any lifecycle logic — e.g. "happy" resolving
// itself back to "idle" — see SCOPE_HAPPY_HOLD_MS in scope-motion.ts.
//
// Presence (useScopePresence) is a second, independent layer on top of
// the mood system, not a replacement for it: mood still drives `animate`
// (rotate/y/scale — the idle breathing loop keeps running underneath),
// while presence drives `style` (rotateX/rotateY/etc., cursor-derived
// motion values). Framer composes both into one transform, so neither
// system needs to know about the other.
function Scope({
  mood = "idle",
  className,
  ...props
}: React.ComponentProps<"div"> & { mood?: ScopeMood }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { animate, transition, glow } = useScopeMotion(mood)
  const { rotateX, rotateY, eyeX, eyeY, parallaxX, parallaxY, shadowX, shadowY, shadowScaleX } =
    useScopePresence(ref)

  React.useEffect(() => {
    const unsub = rotateY.on("change", (v) => console.log("SCOPE_DEBUG rotateY changed to", v))
    return unsub
  }, [rotateY])

  return (
    <div
      ref={ref}
      data-slot="scope"
      data-scope-mood={mood}
      aria-hidden="true"
      className={cn("relative", className)}
      {...props}
    >
      <motion.div
        aria-hidden="true"
        style={{ x: shadowX, y: shadowY, scaleX: shadowScaleX }}
        className="bg-scope-shell/30 absolute inset-6 -z-10 rounded-full blur-2xl"
      />
      <motion.div style={{ rotateX, rotateY, transformPerspective: 600 }} className="h-full w-full">
        <motion.div animate={animate} transition={transition} className="h-full w-full">
        <svg viewBox="0 0 160 180" className="h-full w-full">
          <defs>
            <linearGradient id="scope-shell-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--scope-shell)" />
              <stop
                offset="100%"
                stopColor="color-mix(in oklch, var(--scope-shell), var(--scope-details) 12%)"
              />
            </linearGradient>
          </defs>

          {/* display glow — brightens/dims per mood ("brighter/dimmer
              core" in PERSONALITY.md), and shifts with the same tiny
              parallax offset as the display group below it, so the glow
              reads as coming from the same place the display sits. */}
          <motion.rect
            x="24"
            y="22"
            width="112"
            height="112"
            rx="32"
            className="fill-scope-accent blur-md"
            initial={false}
            animate={{ opacity: glow * 0.5 }}
            transition={SCOPE_GLOW_TRANSITION}
            style={{ x: parallaxX, y: parallaxY }}
          />

          {/* feet */}
          <rect x="46" y="140" width="20" height="26" rx="10" className="fill-scope-details" />
          <rect x="94" y="140" width="20" height="26" rx="10" className="fill-scope-details" />

          {/* shell — a soft top-to-bottom shade plus a hairline edge
              stroke, so it stays legible even against a near-white
              background in light mode */}
          <circle
            cx="80"
            cy="78"
            r="69"
            fill="url(#scope-shell-gradient)"
            stroke="var(--scope-details)"
            strokeOpacity="0.1"
            strokeWidth="2"
          />

          {/* accent light */}
          <motion.circle
            cx="134"
            cy="60"
            r="3.5"
            className="fill-scope-accent"
            initial={false}
            animate={{ opacity: 0.3 + glow * 0.5 }}
            transition={SCOPE_GLOW_TRANSITION}
          />

          {/* display + glyph, grouped so they always move together (the
              display is part of the shell, per docs/scope-docs/scope —
              it rotates with the body above, never independently) with a
              much smaller secondary shift of its own for a sense of
              depth, like glass set slightly back from its bezel. */}
          <motion.g style={{ x: parallaxX, y: parallaxY }}>
            {/* a faint inner-edge stroke suggests the display sits
                recessed into the shell rather than flush with it */}
            <rect
              x="32"
              y="30"
              width="96"
              height="96"
              rx="26"
              className="fill-scope-display stroke-scope-details"
              strokeOpacity="0.4"
              strokeWidth="1"
            />

            {/* the {█} glyph — the soul, not the body */}
            <text
              x="80"
              y="90"
              textAnchor="middle"
              className="fill-scope-shell font-mono"
              fontSize="40"
              fontWeight="500"
            >
              {"{ }"}
            </text>

            {/* the focus point — Scope's "eye". Moves independently of
                the body, lighter and quicker to react (see EYE_SPRING in
                use-scope-presence.ts), never snapping. */}
            <motion.rect
              x="73.5"
              y="71"
              width="13"
              height="13"
              rx="3.5"
              className="fill-scope-shell"
              style={{ x: eyeX, y: eyeY }}
            />
          </motion.g>
        </svg>
        </motion.div>
      </motion.div>
    </div>
  )
}

export { Scope }
