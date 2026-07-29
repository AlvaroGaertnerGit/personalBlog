// Exactly one named spring on purpose — nothing in the app currently drives
// a Framer spring (Scope's own physics in src/hooks/use-scope-presence.ts
// are deliberately independent of this file, not sourced from it). Add a
// second named spring only when a real Framer-driven surface (drag, shared
// layout animation) needs different physics — don't seed variants
// speculatively.
export const springs = {
  layout: { type: "spring", stiffness: 420, damping: 32 },
} as const
