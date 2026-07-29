"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

import { defaultViewport } from "@/lib/motion"
import { fadeInUp } from "@/lib/motion/variants"

type RevealProps = Omit<
  React.ComponentProps<typeof motion.div>,
  "initial" | "whileInView"
> & {
  variants?: Variants
}

function Reveal({ variants = fadeInUp, viewport, ...props }: RevealProps) {
  return (
    <motion.div
      data-slot="reveal"
      initial="hidden"
      whileInView="visible"
      variants={variants}
      viewport={{ ...defaultViewport, ...viewport, once: true }}
      {...props}
    />
  )
}

export { Reveal }
