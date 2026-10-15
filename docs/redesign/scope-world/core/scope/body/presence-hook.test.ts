// The experimental seam with the engine: runs right after the drift step, every
// time, and can be undone; fails loudly if the engine no longer has that step.
//   node --test docs/redesign/scope-world/core/scope/body/presence-hook.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"

import type { Scope3DSecondary } from "../../../../../../src/components/scope-3d/engine/scope-3d-secondary.ts"
import { attachAfterDrift } from "./presence-hook.ts"

test("after the drift, every frame; detach restores the engine's step", () => {
  const order: string[] = []
  const engine = { applyDrift: () => order.push("drift") }
  const hook = attachAfterDrift(engine as unknown as Scope3DSecondary, () => order.push("presence"))
  engine.applyDrift()
  engine.applyDrift()
  assert.deepEqual(order, ["drift", "presence", "drift", "presence"])
  hook.detach()
  engine.applyDrift()
  assert.deepEqual(order.slice(-1), ["drift"])
})

test("a changed engine is a clear error, not a silent no-op", () => {
  assert.throws(() => attachAfterDrift({} as unknown as Scope3DSecondary, () => {}), /applyDrift\(\) no longer exists/)
})
