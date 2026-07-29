"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

import { staggerContainer, staggerItem } from "@/lib/motion/variants"

// Mount-triggered sibling to reveal.tsx's scroll-triggered Reveal — for
// content that's already in the viewport at first paint (e.g. the Hero),
// where there's no scroll event to wait for. Reduced motion is handled the
// same way Reveal handles it: inherited from MotionProvider's
// reducedMotion="user", not a per-component check.
type StaggerGroupProps = Omit<
  React.ComponentProps<typeof motion.div>,
  "initial" | "animate"
> & {
  variants?: Variants
}

function StaggerGroup({ variants = staggerContainer, ...props }: StaggerGroupProps) {
  return (
    <motion.div
      data-slot="stagger-group"
      initial="hidden"
      animate="visible"
      variants={variants}
      {...props}
    />
  )
}

type StaggerItemProps = React.ComponentProps<typeof motion.div> & {
  variants?: Variants
}

// No initial/animate here — the parent StaggerGroup's animate="visible"
// propagates through context to any descendant motion.* component sharing
// these variant keys, even through plain Server Component elements in
// between (see src/app/page.tsx for how Server Component Hero children are
// wrapped by this without becoming Client Components themselves).
function StaggerItem({ variants = staggerItem, ...props }: StaggerItemProps) {
  return <motion.div data-slot="stagger-item" variants={variants} {...props} />
}

export { StaggerGroup, StaggerItem }
