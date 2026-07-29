// Bezier curves only — spring physics is a structurally different Transition
// shape (see springs.ts), not another "easing."
export const easing = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.4, 0, 0.2, 1],
} as const
