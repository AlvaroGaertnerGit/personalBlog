// The experimental seam between the production engine and Scope World's
// gaze layer (Presence). It lives here, not in production, and it is the ONLY
// place that touches the engine's internals.
//
// Why: Presence must run after the posture drift has written `look` and before
// the antenna spring reads the body's motion (06-plan-tecnico §1.3). The
// production Scope3DSecondary does exactly that inside one private step,
// `applyDrift()`, and offers no hook. Proposed production change (one line,
// not made): an optional `afterDrift(dt)` callback in Scope3DSecondary.
//
// Until then this adapter wraps that step on ONE instance, checks at runtime
// that the engine still has it (a clear error instead of a silent no-op if
// the engine changes), and can be undone.

import type { Scope3DSecondary } from "../../../../../../src/components/scope-3d/engine/scope-3d-secondary.ts"

interface DriftStep {
  applyDrift(): void
}

export interface PresenceHook {
  /** Restore the engine's own step. */
  detach(): void
}

/** Run `afterDrift` right after the engine's posture drift, every frame. */
export function attachAfterDrift(secondary: Scope3DSecondary, afterDrift: () => void): PresenceHook {
  const engine = secondary as unknown as Partial<DriftStep>
  const own = engine.applyDrift
  if (typeof own !== "function") {
    throw new Error("Scope3DSecondary.applyDrift() no longer exists: update core/scope/body/presence-hook.ts (or add the afterDrift hook to the engine)")
  }
  const step = own.bind(secondary)
  engine.applyDrift = () => {
    step()
    afterDrift()
  }
  return { detach: () => (engine.applyDrift = own) }
}
