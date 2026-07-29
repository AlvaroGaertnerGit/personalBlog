// Canonical source of truth: docs/scope-docs/scope/ (read
// SCOPE_UNDERSTANDING.md first). Five moods only — see PERSONALITY.md's
// documented emotional states plus the reference sheet's Observe pose.
// Don't add a sixth without checking it against these for redundancy or
// personality drift first.
export type ScopeMood = "idle" | "curious" | "thinking" | "observe" | "happy"

// The nominal target this mood animates toward — what the debug panel at
// /scope displays. Deliberately the *configured* target, not a live
// per-frame sample (see use-scope-motion.ts for why: reading live values
// would require Framer's `onUpdate`, which disables WAAPI-accelerated
// animation for the whole component).
export interface ScopeMotionSpec {
  animationName: string
  scale: number
  rotate: number
  y: number
  /** 0–1, how bright the display/core reads. */
  glow: number
}
