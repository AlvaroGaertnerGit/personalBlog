import type { ScopeMood } from "@/components/scope/scope.types"

// The extensibility point Sprint 3's "Future Architecture" section asks
// for: every section that wants Scope to visit it defines one of these,
// nothing more. `mood` and `scale` are exercised this sprint (the Hero dock
// and the companion demo section's dock); `facing` exists so a future
// section can ask for a static orientation bias without needing a new
// config shape — it's a plain wrapper rotation applied outside Scope's own
// transform stack (companion-scope.tsx), never touching
// use-scope-presence.ts's rotateX/rotateY cursor physics.
export interface ScopeDockConfig {
  /** Resting mood while docked here. Defaults to "idle". */
  mood?: ScopeMood
  /** Static wrapper rotation bias, in degrees. Defaults to 0. */
  facing?: number
  /** Relative size vs. the companion's base rendered size. Defaults to 1. */
  scale?: number
}

export const DEFAULT_SCOPE_DOCK_CONFIG: Required<ScopeDockConfig> = {
  mood: "idle",
  facing: 0,
  scale: 1,
}
