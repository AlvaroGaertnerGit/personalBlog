"use client"

import * as React from "react"

import { useScopeAcknowledge } from "@/components/scope/companion"
import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"
import { NAV_SECTIONS } from "./nav-sections"
import { scrollToSection } from "./scroll-to-section"
import { SectionNavigatorDesktop } from "./section-navigator-desktop"
import { SectionNavigatorMobile } from "./section-navigator-mobile"
import { useActiveSection } from "./use-active-section"

// The one mounted entry point for the whole navigator system. Composes
// three independent pieces rather than duplicating any of their logic:
// useActiveSection (viewport-center tracking), scrollToSection (the
// portfolio's own smooth-scroll easing), and Scope's own existing
// acknowledge() reaction (see companion/use-scope-acknowledge.ts) — the
// same "notice" signal already wired to About's hotspots, Notebook's
// threads, and Contact's desk, reused here rather than inventing a new
// gesture. Desktop and mobile render simultaneously (CSS-toggled by
// breakpoint in each variant) so there's exactly one source of truth for
// activeId/isPastHero shared between them.
function SectionNavigator() {
  const { activeId, isPastHero } = useActiveSection()
  const isReducedMotion = useIsReducedMotion()
  const acknowledge = useScopeAcknowledge()
  const stopScroll = React.useRef<(() => void) | null>(null)

  const handleNavigate = React.useCallback(
    (id: string) => {
      stopScroll.current?.()
      stopScroll.current = scrollToSection(id, isReducedMotion)
      acknowledge()
    },
    [isReducedMotion, acknowledge]
  )

  React.useEffect(() => () => stopScroll.current?.(), [])

  return (
    <>
      <SectionNavigatorDesktop
        sections={NAV_SECTIONS}
        activeId={activeId}
        isPastHero={isPastHero}
        onNavigate={handleNavigate}
      />
      <SectionNavigatorMobile
        sections={NAV_SECTIONS}
        activeId={activeId}
        isPastHero={isPastHero}
        onNavigate={handleNavigate}
      />
    </>
  )
}

export { SectionNavigator }
