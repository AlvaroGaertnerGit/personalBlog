"use client"

import * as React from "react"

import { HERO_SECTION_ID, NAV_SECTIONS } from "./nav-sections"

interface ActiveSection {
  activeId: string
  /** Whether the visitor has scrolled past the Hero — the navigator's own appear/disappear signal. */
  isPastHero: boolean
}

// "Active section = the center of the viewport, not the section's top edge"
// (the site owner's own requirement) is exactly what this rootMargin gives
// for free: shrinking the observer's root by 50% on both top and bottom
// collapses it to a single line across the viewport's vertical center, so a
// section only ever crosses the intersecting/not-intersecting boundary the
// instant it spans that line. threshold: 0 is deliberate too — with the
// root already squashed to a line, intersectionRatio itself is too noisy to
// use (see below); isIntersecting is all this needs.
const CENTER_ROOT_MARGIN = "-50% 0px -50% 0px"

// One shared IntersectionObserver for every section — mirrors the same
// reasoning already used for Scope's own dock registry
// (scope-dock-context.tsx: "adding a future section's dock never adds a new
// observer instance"). No scroll listener anywhere in this hook.
function useActiveSection(): ActiveSection {
  const [activeId, setActiveId] = React.useState<string>(HERO_SECTION_ID)
  // A plain ref, not state — this hook only needs the derived "last
  // intersecting section in page order" on every observer callback, not a
  // re-render per individual section's intersection change.
  const intersecting = React.useRef(new Map<string, boolean>())

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return

    const elements = NAV_SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (el): el is HTMLElement => el !== null
    )
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.current.set(entry.target.id, entry.isIntersecting)
        }
        // Page order, last match wins — with the root squashed to a single
        // line, ordinarily exactly one section intersects at a time; this
        // just keeps the pick deterministic on the rare frame where a very
        // short section briefly overlaps its neighbor.
        let nextId: string | null = null
        for (const section of NAV_SECTIONS) {
          if (intersecting.current.get(section.id)) nextId = section.id
        }
        // Only move to a section that's actually spanning the center — a
        // mid-scroll moment where nothing does keeps the previous active id
        // rather than flickering back to a default.
        if (nextId) setActiveId(nextId)
      },
      { rootMargin: CENTER_ROOT_MARGIN, threshold: 0 }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return { activeId, isPastHero: activeId !== HERO_SECTION_ID }
}

export { useActiveSection }
