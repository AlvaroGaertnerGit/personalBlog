"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { motion, useTime, useTransform, type MotionValue } from "framer-motion"

import { useMounted } from "@/hooks/use-mounted"

interface ThemeCurtainProps {
  /** 0 = fully off-screen above the viewport, 1 = fully covers it. */
  progress: MotionValue<number>
}

// SPR-006 — the panel Scope pulls down over the world during a theme
// transition. Deliberately NOT a theatre curtain: no fabric, no folds, no
// drama — "a clean premium surface... like reality being pulled over the
// screen," Apple/Linear/Nothing register, not a stage prop. Portaled
// straight to document.body (the app's first portal) so a true full-
// viewport overlay can never get clipped or stacking-trapped by an
// ancestor, regardless of where ThemeTransitionProvider sits in the tree.
//
// Always mounted (progress just sits at 0, translated fully off-screen)
// rather than mounted/unmounted per transition — avoids portal churn and
// keeps ThemeTransitionProvider's sequence free of mount-timing races.
//
// translateY only, per the motion skill's golden rule (transform/opacity,
// never top/left/height) — driven directly by the controller's own
// curtainProgress MotionValue, the same value Scope's descent rides during
// the curtain phase (see theme-transition-controller.tsx) so the two can
// never drift out of sync.
function ThemeCurtain({ progress }: ThemeCurtainProps) {
  const mounted = useMounted()
  const translateY = useTransform(progress, [0, 1], ["-100%", "0%"])
  const time = useTime()
  // A slow, continuous drift — the same "breathing" register as Scope's own
  // idle loop (SCOPE_IDLE_DURATION_BY_THEME) — so the surface never reads as
  // a dead, static block during the beat where it's fully opaque and
  // nothing else on screen is moving. Purely decorative and always running;
  // harmless while the panel is off-screen (translateY hides it entirely).
  const glowBackground = useTransform(time, (t) => {
    const positionY = 50 + Math.sin(t / 4200) * 22
    return `radial-gradient(60% 45% at 50% ${positionY}%, var(--scope-warm) 0%, transparent 70%)`
  })

  if (!mounted) return null

  return createPortal(
    <motion.div
      aria-hidden="true"
      data-slot="theme-curtain"
      className="pointer-events-none fixed inset-0 z-[100] h-screen w-screen"
      style={{ translateY, willChange: "transform" }}
    >
      {/* Matte gradient surface — extremely subtle, no bright colors, no
          fabric simulation. Warms very slightly toward the bottom via
          --scope-shell at low opacity, a quiet nod to "Scope is the one
          pulling this down" without turning the panel into a character
          itself. */}
      <div
        className="h-full w-full"
        style={{
          background:
            "linear-gradient(to bottom, var(--card) 0%, var(--background) 55%, var(--muted) 100%)",
        }}
      >
        {/* A very soft, slowly drifting warm glow — "the surface is alive,
            not a dead slab" — see the comment on glowBackground above. */}
        <motion.div
          className="h-full w-full"
          style={{ background: glowBackground, opacity: 0.07 }}
        />
        <div
          className="h-full w-full opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div
          className="h-full w-full"
          style={{
            background: "linear-gradient(180deg, transparent 0%, var(--scope-shell) 100%)",
            opacity: 0.05,
          }}
        />
      </div>
    </motion.div>,
    document.body
  )
}

export { ThemeCurtain }
