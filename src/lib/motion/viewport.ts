// Baseline whileInView config for scroll-triggered reveals (see
// src/components/motion/reveal.tsx). Mount-triggered sequences (see
// src/components/motion/stagger.tsx) don't use this — there's no viewport
// to enter, they fire on load.
export const defaultViewport = {
  once: true,
  amount: 0.3,
} as const
