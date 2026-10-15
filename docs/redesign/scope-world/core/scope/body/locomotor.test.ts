// node --test docs/redesign/scope-world/core/scope/**/*.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"

import { GAITS, Locomotor, dist, headingTo, type Gait, type P2 } from "./locomotor.ts"

const DT = 1 / 60

function run(loco: Locomotor, seconds: number, each?: (t: number) => void) {
  const out: { at: P2; speed: number; heading: number; phase: string }[] = []
  for (let k = 0; k < Math.round(seconds / DT); k++) {
    loco.step(DT)
    each?.(k * DT)
    out.push({ at: [loco.state.at[0], loco.state.at[1]], speed: loco.state.speed, heading: loco.state.heading, phase: loco.state.phase })
  }
  return out
}

for (const gait of ["walk", "trot", "bound"] as Gait[]) {
  test(`${gait}: no teleport, speed changes within the limits, arrives and stops`, () => {
    const loco = new Locomotor([0, 0], headingTo([0, 0], [0.4, 0]))
    let arrived = 0
    loco.onArrive = () => arrived++
    loco.setPath([[0, 0], [0.2, 0.05], [0.4, 0]], gait)
    const trace = run(loco, 12)
    const spec = GAITS[gait]
    for (let i = 1; i < trace.length; i++) {
      const moved = dist(trace[i].at, trace[i - 1].at)
      assert.ok(moved <= spec.speed * DT * 1.01 + 1e-9, `jump of ${moved} m at frame ${i}`)
      const dv = trace[i].speed - trace[i - 1].speed
      assert.ok(dv <= spec.accel * DT + 1e-9, `accelerated ${dv} at ${i}`)
      // including the last frame: he eases onto the spot, never lands on it at speed
      assert.ok(-dv <= spec.decel * 1.6 * DT + 1e-9, `braked ${dv} at ${i}`)
    }
    assert.equal(arrived, 1)
    assert.ok(dist(trace[trace.length - 1].at, [0.4, 0]) < 0.012, `ends at ${trace[trace.length - 1].at}`)
    assert.equal(trace[trace.length - 1].speed, 0)
  })
}

test("anticipation: from rest he gathers himself before the first step", () => {
  const loco = new Locomotor([0, 0], headingTo([0, 0], [0.3, 0]))
  loco.setPath([[0.3, 0]], "trot")
  const trace = run(loco, 0.5)
  const firstMove = trace.findIndex((f) => dist(f.at, [0, 0]) > 1e-6)
  assert.ok(firstMove * DT >= 0.12, `moved after ${firstMove * DT} s`)
  assert.equal(trace[0].phase, "gather")
})

test("a path behind him: turns on the spot first, then walks", () => {
  const loco = new Locomotor([0, 0], headingTo([0, 0], [0.3, 0]))
  loco.setPath([[-0.3, 0]], "walk")
  const trace = run(loco, 3)
  assert.equal(trace[0].phase, "turn")
  const turning = trace.filter((f) => f.phase === "turn")
  assert.ok(turning.every((f) => dist(f.at, [0, 0]) < 1e-9), "no travel while turning on the spot")
  assert.ok(trace.some((f) => f.phase === "move"))
})

test("retarget while moving keeps his speed (no restart, no new anticipation)", () => {
  const loco = new Locomotor([0, 0], headingTo([0, 0], [0.5, 0]))
  loco.setPath([[0.5, 0]], "trot")
  run(loco, 1.5)
  const v = loco.state.speed
  assert.ok(v > 0.1)
  loco.setPath([[0.6, 0.1]], "trot")
  loco.step(DT)
  assert.equal(loco.state.phase, "move")
  assert.ok(Math.abs(loco.state.speed - v) < GAITS.trot.accel * DT * 2)
})

test("stop: brakes to a halt ahead, never in one frame", () => {
  const loco = new Locomotor([0, 0], headingTo([0, 0], [1, 0]))
  loco.setPath([[1, 0]], "bound")
  run(loco, 1.5)
  const v = loco.state.speed
  loco.stop()
  const trace = run(loco, 2)
  assert.ok(trace[0].speed > v * 0.8, "no dead stop")
  assert.equal(trace[trace.length - 1].speed, 0)
})
