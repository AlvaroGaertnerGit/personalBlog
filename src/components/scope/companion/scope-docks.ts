import type { RefObject } from "react"

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
  /**
   * SPR-005: an element Scope's Personality system may occasionally glance
   * toward while resting at this dock (see use-scope-personality.ts's
   * "look at target" gesture) — e.g. a project world's own bouncing ball or
   * a point tracing a graph. Optional and purely geometric: the dock/
   * companion system never knows or cares what the element *is*, only
   * where it is on screen. Defaults to a permanently-null ref (nothing to
   * glance at).
   */
  // `Element`, not `HTMLElement`: a project world's point of interest can
  // just as easily be an SVG node (a circle riding a graph) as an HTML div
  // (a ball) — `getBoundingClientRect()`, the only thing this is ever used
  // for, lives on `Element` itself.
  attentionTarget?: RefObject<Element | null>
}

// A stable, permanently-null ref — the "nothing to look at" default. Kept
// as one shared constant rather than `{ current: null }` inlined per
// consumer so every dock without its own attentionTarget points at the
// exact same object, not a fresh one per render.
const NULL_ATTENTION_TARGET: RefObject<Element | null> = { current: null }

export const DEFAULT_SCOPE_DOCK_CONFIG: Required<ScopeDockConfig> = {
  mood: "idle",
  facing: 0,
  scale: 1,
  attentionTarget: NULL_ATTENTION_TARGET,
}
