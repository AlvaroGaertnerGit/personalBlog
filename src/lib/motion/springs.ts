// Exactly one named spring on purpose — nothing in the app currently drives
// a Framer spring (Scope's own physics in src/hooks/use-scope-presence.ts
// are deliberately independent of this file, not sourced from it). Add a
// second named spring only when a real Framer-driven surface (drag, shared
// layout animation) needs different physics — don't seed variants
// speculatively.
//
// `companion` is that second surface: Scope's cross-section travel
// (src/components/scope/companion/companion-scope.tsx), moving the whole
// character across the page between sections' resting places. Deliberately
// much heavier/slower than `layout` — "heavy, calm, intentional, almost as
// if Scope chose where to be" per the companion-system brief — not a UI
// element snapping into place, so it doesn't share `layout`'s stiffness.
// Still a distinct thing from Scope's own internal presence physics in
// use-scope-presence.ts, which stays independent of this file as noted
// above; this spring only ever drives the wrapper's position, never
// Scope's own rotate/eye/parallax values.
export const springs = {
  layout: { type: "spring", stiffness: 420, damping: 32 },
  companion: { type: "spring", stiffness: 55, damping: 16, mass: 1.6 },
} as const
