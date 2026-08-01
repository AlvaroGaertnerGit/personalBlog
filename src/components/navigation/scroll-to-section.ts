"use client"

import { animate } from "framer-motion"

import { transitions } from "@/lib/motion"

function getSectionTop(id: string): number | null {
  const element = document.getElementById(id)
  if (!element) return null
  // Document coordinates, not viewport-relative — the target must stay
  // fixed as the page scrolls beneath it during the animation.
  return element.getBoundingClientRect().top + window.scrollY
}

// Smooth-scrolls to a section using the portfolio's own easing
// (transitions.enterSlow — the same token already reserved for
// Hero/page-level entrances, see lib/motion/transitions.ts) instead of the
// browser's default scrollIntoView curve — "no browser-default jump, no
// harsh acceleration" per the site owner's own brief. Returns a stop()
// so a second click can cancel an in-flight scroll rather than fighting it.
function scrollToSection(id: string, reducedMotion: boolean): () => void {
  const target = getSectionTop(id)
  if (target === null) return () => {}

  if (reducedMotion) {
    window.scrollTo(0, target)
    return () => {}
  }

  const controls = animate(window.scrollY, target, {
    ...transitions.enterSlow,
    onUpdate: (value) => window.scrollTo(0, value),
  })
  return () => controls.stop()
}

export { scrollToSection }
