"use client"

import * as React from "react"

import { duration, easing } from "@/lib/motion"
import { cn } from "@/lib/utils"

export interface ExplorationLineHandle {
  /** Stops the exploring dot where it is and settles it on the centre. */
  centre(): void
  /** The line lights up for a moment. */
  glow(): void
}

const bezier = (curve: readonly number[]) => `cubic-bezier(${curve.join(", ")})`

// "Exploring", not "progress": a hairline whose ends fade out, and one warm
// point of light (Scope's eye colour) gliding from end to end. Pure CSS while
// waiting (globals.css .animate-scope-explore), so it moves from the first
// paint and keeps moving on the compositor while the page initialises; the
// exit beats are Web Animations started from wherever the dot happens to be.
function ExplorationLine({ ref, className }: { ref: React.Ref<ExplorationLineHandle>; className?: string }) {
  const moverRef = React.useRef<HTMLDivElement>(null)
  const glowRef = React.useRef<HTMLDivElement>(null)

  React.useImperativeHandle(ref, () => ({
    centre() {
      const mover = moverRef.current
      if (!mover) return
      const from = new DOMMatrixReadOnly(getComputedStyle(mover).transform).m41
      const to = mover.offsetWidth / 2
      mover.style.animation = "none"
      mover.style.transform = `translateX(${to}px)`
      mover.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], {
        duration: duration.slower * 1000,
        easing: bezier(easing.out),
      })
    },
    glow() {
      glowRef.current?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], {
        duration: (duration.slow + duration.slower) * 1000,
        easing: bezier(easing.inOut),
      })
    },
  }))

  return (
    <div aria-hidden="true" className={cn("relative h-px w-[clamp(168px,52vw,248px)]", className)}>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--scope-shell)_22%,transparent)_20%,color-mix(in_oklch,var(--scope-shell)_22%,transparent)_80%,transparent)]" />
      <div
        ref={glowRef}
        className="absolute inset-0 bg-[linear-gradient(90deg,transparent,var(--scope-warm)_30%,var(--scope-warm)_70%,transparent)] opacity-0 shadow-[0_0_10px_0_color-mix(in_oklch,var(--scope-warm)_60%,transparent)]"
      />
      <div ref={moverRef} className="animate-scope-explore absolute inset-0">
        <span className="bg-scope-warm absolute top-1/2 left-0 size-1.5 -translate-1/2 rounded-full shadow-[0_0_8px_2px_color-mix(in_oklch,var(--scope-warm)_55%,transparent)]" />
      </div>
    </div>
  )
}

export { ExplorationLine }
