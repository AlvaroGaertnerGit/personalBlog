// What Scope (and his ball) need to know about the floor of a world. The lab
// composes it by hand (lab-ground.ts); the Entrega 4 world bakes it from the
// world's own geometry (baked-ground.ts).

import type { NavGrid } from "../../prototype/src/scope/nav.ts"
import type { P2 } from "../world-def.ts"

/** A circle his centre must keep out of (a camera's foreground, refine.cameraClearance). */
export interface Keepout {
  at: P2
  r: number
}

export interface Ground {
  /** Shortest walkable path, avoiding where the ball is now (and, if the ground supports it, the keep-outs). */
  path(from: P2, to: P2, ball: P2 | null, avoid?: readonly Keepout[]): P2[] | null
  isFree(p: P2): boolean
  /** Floor height (Blender z) at (x, y). */
  height(p: P2): number
  /** Is this spot solid for the ball's centre? */
  ballBlocked(p: P2): boolean
  /** The static walkable grid (the 1.0 ScopeActor uses it in the step bench). */
  readonly staticGrid: NavGrid
}
