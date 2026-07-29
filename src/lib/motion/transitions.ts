import type { Transition } from "framer-motion"

import { duration } from "./durations"
import { easing } from "./easings"

// Ready-made Transition objects so components stop inlining
// `{ duration, ease }` pairs — pick the one matching what's happening, not
// a duration/easing combo invented on the spot.
export const transitions = {
  enter: { duration: duration.base, ease: easing.out },
  enterSlow: { duration: duration.slower, ease: easing.out },
  hover: { duration: duration.fast, ease: easing.out },
  press: { duration: duration.instant, ease: easing.out },
  toggle: { duration: duration.base, ease: easing.inOut },
} as const satisfies Record<string, Transition>
