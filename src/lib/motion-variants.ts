import type { Variants } from "framer-motion"

import { distance, duration, easing } from "@/lib/motion"

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.base, ease: easing.out },
  },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: distance.md },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.out },
  },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -distance.md },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.out },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.base, ease: easing.out },
  },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

export const staggerItem: Variants = fadeInUp

// For whileHover / whileTap — not part of the Variants catalog above,
// whileHover/whileTap take a plain target object, not a hidden/visible map.
export const hoverLift = {
  y: -distance.xs,
  transition: { duration: duration.fast, ease: easing.out },
}

export const hoverScale = {
  scale: 1.02,
  transition: { duration: duration.fast, ease: easing.out },
}

export const tapScale = {
  scale: 0.98,
  transition: { duration: duration.instant, ease: easing.out },
}
