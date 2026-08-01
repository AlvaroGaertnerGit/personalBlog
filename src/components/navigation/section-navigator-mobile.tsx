"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { distance, springs, transitions } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { NavSection } from "./nav-sections"

interface SectionNavigatorMobileProps {
  sections: readonly NavSection[]
  activeId: string
  isPastHero: boolean
  onNavigate: (id: string) => void
}

// How long an opened-but-untouched navigator waits before quietly folding
// back up on its own.
const AUTO_COLLAPSE_MS = 4000

// The touch-first counterpart to SectionNavigatorDesktop's hover capsule —
// hover doesn't exist on touch, so "approach reveals labels" becomes "tap
// unfolds the whole thing." Deliberately a vertical unfold anchored
// bottom-center (thumb zone), not a horizontal row of dots — a horizontal
// bottom bar would read as a disguised tab bar, exactly what this
// navigator is trying not to be. One `layout`-animated glass object (see
// springs.layout's own doc comment in lib/motion/springs.ts — this is
// precisely the kind of Framer-driven resizing surface that token exists
// for) rather than a classic dropdown/menu: the same capsule grows to
// reveal its contents, it never opens a second surface on top of itself.
function SectionNavigatorMobile({
  sections,
  activeId,
  isPastHero,
  onNavigate,
}: SectionNavigatorMobileProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const collapseTimeout = React.useRef<number | undefined>(undefined)

  const collapse = React.useCallback(() => {
    window.clearTimeout(collapseTimeout.current)
    setIsExpanded(false)
  }, [])

  // Tap-outside-to-collapse, escape-to-collapse, and the idle auto-collapse
  // only ever cost anything while actually expanded — not permanent
  // listeners/timers sitting around for the navigator's whole lifetime.
  React.useEffect(() => {
    if (!isExpanded) return

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) collapse()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") collapse()
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    collapseTimeout.current = window.setTimeout(collapse, AUTO_COLLAPSE_MS)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      window.clearTimeout(collapseTimeout.current)
    }
  }, [isExpanded, collapse])

  // Scrolling back to the Hero should close the navigator, not leave it
  // open mid-expansion while it fades out underneath. Done during render
  // (comparing against the previous value), not inside an effect — this
  // project's hooks lint disallows calling a state setter synchronously in
  // an effect body; same pattern already used for the same reason in
  // use-scope-personality.ts's own isStill reset. The timeout itself still
  // gets cleared, via the effect above's own cleanup once isExpanded flips.
  const [wasPastHero, setWasPastHero] = React.useState(isPastHero)
  if (wasPastHero !== isPastHero) {
    setWasPastHero(isPastHero)
    if (!isPastHero && isExpanded) setIsExpanded(false)
  }

  function handleNavigate(id: string) {
    onNavigate(id)
    collapse()
  }

  const activeSection = sections.find((section) => section.id === activeId) ?? sections[0]

  return (
    <motion.div
      inert={!isPastHero}
      initial={false}
      animate={{ opacity: isPastHero ? 1 : 0, y: isPastHero ? 0 : distance.xs }}
      transition={transitions.enter}
      className={cn(
        "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 md:hidden",
        !isPastHero && "pointer-events-none"
      )}
    >
      <motion.div
        ref={rootRef}
        layout
        transition={springs.layout}
        className="border-border/60 from-muted/50 to-muted/10 flex flex-col-reverse items-stretch gap-1 overflow-hidden rounded-[22px] border bg-gradient-to-b p-1.5 backdrop-blur-sm"
      >
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls="section-navigator-mobile-list"
          aria-label={
            isExpanded
              ? "Close section navigation"
              : `Section navigation — currently ${activeSection.label}`
          }
          onClick={() => (isExpanded ? collapse() : setIsExpanded(true))}
          className="focus-visible:ring-ring/50 relative flex size-9 shrink-0 items-center justify-center self-center rounded-full outline-none focus-visible:ring-3"
        >
          <span
            aria-hidden="true"
            className="bg-scope-accent absolute size-5 rounded-full opacity-35 blur-[4px]"
          />
          <span aria-hidden="true" className="bg-foreground/70 relative size-2.5 rounded-full" />
        </button>

        {isExpanded && (
          <ul id="section-navigator-mobile-list" className="flex flex-col gap-0.5">
            {sections.map((section, index) => {
              const isActive = section.id === activeId
              return (
                <motion.li
                  key={section.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...transitions.enter, delay: index * 0.02 }}
                >
                  <button
                    type="button"
                    aria-current={isActive ? "location" : undefined}
                    onClick={() => handleNavigate(section.id)}
                    className="focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-full px-3 py-2.5 outline-none focus-visible:ring-3"
                  >
                    <span className="relative flex size-4 shrink-0 items-center justify-center">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "bg-scope-accent absolute size-4 rounded-full blur-[3px] transition-opacity",
                          isActive ? "opacity-35" : "opacity-0"
                        )}
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "bg-foreground/70 relative rounded-full transition-all",
                          isActive ? "size-2.5 opacity-100" : "size-1.5 opacity-50"
                        )}
                      />
                    </span>
                    <span className="text-foreground text-sm font-medium whitespace-nowrap">
                      {section.label}
                    </span>
                  </button>
                </motion.li>
              )
            })}
          </ul>
        )}
      </motion.div>
    </motion.div>
  )
}

export { SectionNavigatorMobile }
