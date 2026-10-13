// Run: node --test src/components/scope-3d/behavior/scope-3d-behavior.test.ts
// (Node >= 23.6 strips TypeScript types natively — no test dependency needed.)

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { createScope3DBehavior, type Scope3DCommand, type Scope3DPlayCommand } from "./scope-3d-behavior.ts"
import { AUTONOMOUS_BEHAVIORS, DEFAULT_SCOPE_3D_BEHAVIOR, type AutonomousBehavior } from "./scope-3d-config.ts"

/** Deterministic PRNG so failures are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Run the machine forward, collecting every autonomous play command. */
function runAutonomous(plays: number, random: () => number, config = {}) {
  const b = createScope3DBehavior({ random, config })
  const out: Scope3DPlayCommand[] = []
  let now = 0
  while (out.length < plays) {
    now += 50
    for (const c of b.update(now)) if (c.type === "play") out.push(c)
  }
  return out
}

function plays(cmds: Scope3DCommand[]) {
  return cmds.filter((c): c is Scope3DPlayCommand => c.type === "play")
}

test("Stretch / Laugh / ClickReaction are never selected autonomously", () => {
  const picked = runAutonomous(5_000, mulberry32(1))
  for (const p of picked) {
    assert.ok((AUTONOMOUS_BEHAVIORS as readonly string[]).includes(p.behavior), p.behavior)
    assert.doesNotMatch(p.clip, /Stretch|Laugh|ClickReaction/)
  }
})

test("no behaviour plays three times in a row — even with an adversarial RNG", () => {
  // random() === 0 always lands on the first candidate: the worst case for repeats.
  for (const random of [() => 0, () => 0.999999, mulberry32(7)]) {
    const seq = runAutonomous(400, random).map((p) => p.behavior)
    for (let i = 2; i < seq.length; i++) {
      assert.ok(!(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]), `triple at ${i}: ${seq[i]}`)
    }
  }
})

test("selection follows the configured weights (±3%)", () => {
  const n = 20_000
  // Autonomous plays only (the first test asserts this), so the narrowing is safe.
  const seq = runAutonomous(n, mulberry32(42)).map((p) => p.behavior as AutonomousBehavior)
  const counts = Object.fromEntries(AUTONOMOUS_BEHAVIORS.map((b) => [b, 0])) as Record<AutonomousBehavior, number>
  for (const b of seq) counts[b]++
  for (const b of AUTONOMOUS_BEHAVIORS) {
    const share = counts[b] / n
    assert.ok(Math.abs(share - DEFAULT_SCOPE_3D_BEHAVIOR.weights[b]) < 0.03, `${b}: ${share.toFixed(3)}`)
  }
})

test("weights are configurable: zero-weight behaviours never play", () => {
  const seq = runAutonomous(500, mulberry32(3), {
    weights: { LookAround: 0, Tilt: 1, Bounce: 0, BlinkDouble: 0, Focus: 1 },
  }).map((p) => p.behavior)
  assert.deepEqual(new Set(seq), new Set(["Tilt", "Focus"]))
})

test("quiet intervals stay inside the configured range", () => {
  const random = mulberry32(9)
  const b = createScope3DBehavior({ random })
  let now = 0
  let idleSince = 0
  for (let i = 0; i < 300; i++) {
    const due = b.nextAutonomousAt
    assert.ok(due !== null)
    const gap = due - idleSince
    assert.ok(gap >= 8_000 && gap <= 20_000, `gap ${gap}`)
    now = due
    b.update(now) // starts a behaviour
    while (b.state !== "IDLE") {
      now += 10
      b.update(now)
    }
    idleSince = now
  }
})

test("variation: direction, speed and amplitude stay within limits", () => {
  const picked = runAutonomous(2_000, mulberry32(11))
  const { timeScale, weight } = DEFAULT_SCOPE_3D_BEHAVIOR.variation
  const dirs = new Set<string>()
  for (const p of picked) {
    assert.ok(p.timeScale >= timeScale[0] && p.timeScale <= timeScale[1])
    assert.ok(p.weight >= weight[0] && p.weight <= weight[1])
    if (p.behavior === "LookAround") dirs.add(p.clip)
    if (!DEFAULT_SCOPE_3D_BEHAVIOR.mirrorable.includes(p.behavior as AutonomousBehavior)) {
      assert.equal(p.clip, p.behavior)
    }
  }
  assert.deepEqual(dirs, new Set(["LookAround.L", "LookAround.R"]))
})

test("click interrupts an autonomous behaviour and runs CLICK_STRETCH -> CLICK_LAUGH -> RETURN_TO_IDLE -> IDLE", () => {
  const b = createScope3DBehavior({ random: mulberry32(5) })
  const due = b.nextAutonomousAt!
  const started = plays(b.update(due))
  assert.equal(started.length, 1)
  assert.equal(b.state, "RANDOM_ANIMATION")

  const t0 = due + 200
  const cmds = b.click(t0)
  assert.deepEqual(cmds[0], { type: "stop", clip: started[0].clip, fadeOutMs: DEFAULT_SCOPE_3D_BEHAVIOR.interruptFadeMs })
  assert.equal(plays(cmds)[0].clip, "ClickReaction")
  assert.equal(b.state, "CLICK_STRETCH")

  // extra clicks during the reaction are ignored (no stacking)
  assert.deepEqual(b.click(t0 + 100), [])
  b.update(t0 + DEFAULT_SCOPE_3D_BEHAVIOR.clickLaughAtMs)
  assert.equal(b.state, "CLICK_LAUGH")
  assert.deepEqual(b.click(t0 + 1_500), [])

  const end = t0 + DEFAULT_SCOPE_3D_BEHAVIOR.durationsMs.ClickReaction
  b.update(end)
  assert.equal(b.state, "RETURN_TO_IDLE")
  b.update(end + DEFAULT_SCOPE_3D_BEHAVIOR.returnMs)
  assert.equal(b.state, "IDLE")
  // the autonomous timer restarts from the end of the reaction
  assert.ok(b.nextAutonomousAt! >= end + DEFAULT_SCOPE_3D_BEHAVIOR.returnMs + 8_000)
})

test("click while idle plays the reaction without a stop command", () => {
  const b = createScope3DBehavior({ random: mulberry32(2) })
  const cmds = b.click(1_000)
  assert.equal(cmds.length, 1)
  assert.equal(plays(cmds)[0].behavior, "ClickReaction")
  assert.equal(plays(cmds)[0].timeScale, 1)
  // Short fade-in: the reaction starts at rest; a long fade would flatten its anticipation.
  assert.equal(plays(cmds)[0].fadeInMs, DEFAULT_SCOPE_3D_BEHAVIOR.reactionFadeInMs)
  assert.ok(DEFAULT_SCOPE_3D_BEHAVIOR.reactionFadeInMs < DEFAULT_SCOPE_3D_BEHAVIOR.interruptFadeMs)
})

test("schedule re-arms the timer while idle and is ignored while busy", () => {
  const b = createScope3DBehavior({ random: mulberry32(6) })
  b.schedule(5_000, 0)
  assert.equal(b.nextAutonomousAt, 5_000)
  assert.equal(plays(b.update(5_000)).length, 1)

  b.schedule(5_100, 0) // busy: no effect, no second clip
  assert.equal(b.state, "RANDOM_ANIMATION")
  assert.deepEqual(b.update(5_100), [])

  const idle = createScope3DBehavior({ random: mulberry32(6) })
  idle.schedule(40_000)
  const gap = idle.nextAutonomousAt! - 40_000
  assert.ok(gap >= 8_000 && gap <= 20_000, `gap ${gap}`)
})

test("reduced motion: only blinks, and a click answers with a blink", () => {
  const seq = runAutonomous(50, mulberry32(4), { reducedMotion: true }).map((p) => p.behavior)
  assert.deepEqual(new Set(seq), new Set(["BlinkDouble"]))
  const b = createScope3DBehavior({ config: { reducedMotion: true } })
  assert.equal(plays(b.click(10))[0].behavior, "BlinkDouble")
})

test("durations match the clips baked in Blender (scope-clips.json)", () => {
  const meta = JSON.parse(
    readFileSync(new URL("../../../../assets/scope-3d/exports/scope-clips.json", import.meta.url), "utf8")
  ) as { clips: Record<string, { duration: number; markers: Record<string, number> }> }
  for (const [behavior, ms] of Object.entries(DEFAULT_SCOPE_3D_BEHAVIOR.durationsMs)) {
    const names = DEFAULT_SCOPE_3D_BEHAVIOR.mirrorable.includes(behavior as AutonomousBehavior)
      ? [`${behavior}.L`, `${behavior}.R`]
      : [behavior]
    for (const name of names) {
      assert.ok(meta.clips[name], `missing clip ${name}`)
      assert.equal(Math.round(meta.clips[name].duration * 1000), ms, name)
    }
  }
  assert.equal(Math.round(meta.clips.ClickReaction.markers.laugh * 1000), DEFAULT_SCOPE_3D_BEHAVIOR.clickLaughAtMs)
})
