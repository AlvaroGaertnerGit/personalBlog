import type { Variants } from "framer-motion"

import { distance } from "./distances"
import { transitions } from "./transitions"

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.enter,
  },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: distance.md },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.enter,
  },
}

// Same geometry as fadeInUp, settling in on transitions.enterSlow instead
// of transitions.enter — for reveals that should read calmer/slower than
// the default entrance (SPR-008's Open Notebook: every page, its ending
// page, and its three intro lines all use this) without inventing a new
// distance/easing/duration token.
export const fadeInUpSlow: Variants = {
  hidden: { opacity: 0, y: distance.md },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.enterSlow,
  },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -distance.md },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.enter,
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.enter,
  },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

export const staggerItem: Variants = fadeInUp

// Hero-only: the one place distance.lg (24px, "hero content" per
// reference/tokens.md) and transitions.enterSlow (0.6s, "Hero/page-level
// entrances") are meant to be used together. Keep staggerContainer/
// staggerItem above generic for future non-hero use (e.g. a projects grid).
export const heroStaggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
}

export const heroStaggerItem: Variants = {
  hidden: { opacity: 0, y: distance.lg },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.enterSlow,
  },
}

// For whileHover / whileTap — not part of the Variants catalog above,
// whileHover/whileTap take a plain target object, not a hidden/visible map.
export const hoverLift = {
  y: -distance.xs,
  transition: transitions.hover,
}

export const hoverScale = {
  scale: 1.02,
  transition: transitions.hover,
}

export const tapScale = {
  scale: 0.98,
  transition: transitions.press,
}
