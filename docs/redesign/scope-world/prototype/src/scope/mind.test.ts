// node --test docs/redesign/scope-world/prototype/src/scope/*.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"

import { STATION_SPOTS } from "../config.ts"
import { ScopeMind, type Perception } from "./mind.ts"

const base = (now: number, over: Partial<Perception> = {}): Perception => ({
  now,
  scopeAt: [-0.52, -0.34],
  moving: false,
  gesturing: false,
  pointer: { present: false, moving: false, overScope: false, nearScope: false },
  hovered: null,
  station: 0,
  cameraSettled: true,
  projectOpen: null,
  reducedMotion: false,
  ...over,
})

/** Deterministic random (LCG). */
const seeded = (seed = 7) => () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32)

function run(mind: ScopeMind, from: number, to: number, over: (t: number) => Partial<Perception> = () => ({}), step = 50) {
  const out = []
  for (let t = from; t <= to; t += step) out.push(mind.update(base(t, over(t))))
  return out
}

test("rest dominates: nothing moves for the first seconds", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  const intents = run(mind, 0, 6000)
  assert.ok(intents.every((i) => i.state === "rest" && i.goal === null))
})

test("after a quiet while he explores something in the visitor's place, then rests again", () => {
  const mind = new ScopeMind({ random: seeded(3) }, 0)
  const intents = run(mind, 0, 15000)
  const exploring = intents.find((i) => i.state === "explore")
  assert.ok(exploring, "explores")
  assert.ok(exploring.goalId && ["q-next", "rules", "margin-line"].includes(exploring.goalId), exploring.goalId ?? "")
  mind.arrived(15100)
  const at = mind.update(base(15150))
  assert.equal(at.gesture?.clip !== undefined, true, "a gesture on arrival")
  const later = run(mind, 15200, 24000)
  assert.ok(later.some((i) => i.state === "rest"), "back to rest")
})

test("gestures are one-shot (seq increments, then null)", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  mind.clickScope(100)
  const a = mind.update(base(120))
  const b = mind.update(base(170))
  assert.equal(a.gesture?.clip, "ClickReaction")
  assert.equal(b.gesture, null)
})

test("a click wins over everything and cannot stack", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  run(mind, 0, 14000) // he is exploring by now
  assert.equal(mind.clickScope(14100), true)
  assert.equal(mind.clickScope(14200), false)
  const i = mind.update(base(14300))
  assert.equal(i.state, "interact")
  assert.equal(i.weight.eyes, 0, "eyes untouched by presence during the reaction")
  const after = run(mind, 14350, 18000)
  assert.equal(after[after.length - 1].state === "interact", false, "returns from the reaction")
})

test("a moving pointer: curious first, follow after a while, then a break (not a cursor follower)", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  const moving = () => ({ pointer: { present: true, moving: true, overScope: false, nearScope: true } })
  const intents = run(mind, 0, 12000, moving)
  const firstCurious = intents.findIndex((i) => i.state === "curious")
  const firstFollow = intents.findIndex((i) => i.state === "follow")
  assert.ok(firstCurious >= 0 && firstFollow > firstCurious, `curious ${firstCurious} follow ${firstFollow}`)
  const followIdx = intents.map((i, k) => (i.state === "follow" ? k : -1)).filter((k) => k >= 0)
  const gap = followIdx.some((k, n) => n > 0 && k - followIdx[n - 1] > 1)
  const stopped = followIdx[followIdx.length - 1] < intents.length - 1
  assert.ok(gap || stopped, "takes a break from following")
})

test("pointer on Scope: he looks at the visitor", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  const i = run(mind, 0, 500, () => ({ pointer: { present: true, moving: false, overScope: true, nearScope: true } })).pop()!
  assert.equal(i.gaze.kind, "visitor")
})

test("pointing at a nearby object: he looks, then goes to see it", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  const intents = run(mind, 0, 2500, () => ({ hovered: "q-next" }))
  assert.equal(intents[2].gaze.kind, "poi")
  assert.ok(intents.some((i) => i.goalId === "q-next"), "walks over")
})

test("the visitor moves to another place: he comes along", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  run(mind, 0, 1000)
  const i = run(mind, 1050, 1200, () => ({ station: 3 })).pop()!
  assert.equal(i.state, "explore")
  assert.deepEqual(i.goal, STATION_SPOTS[3])
})

test("a project opens: he goes to it and watches; closing: he looks back at you", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  const open = run(mind, 0, 300, () => ({ projectOpen: "mathview", station: 3 })).pop()!
  assert.equal(open.state, "interact")
  assert.equal(open.goalId, "mathview")
  mind.arrived(400)
  const watching = mind.update(base(450, { projectOpen: "mathview", station: 3 }))
  assert.equal(watching.gesture?.clip, "Focus")
  assert.deepEqual(watching.gaze, { kind: "poi", id: "mathview" })
  const closed = mind.update(base(5000, { projectOpen: null, station: 3 }))
  assert.equal(closed.gaze.kind, "visitor")
  assert.equal(closed.gesture?.clip, "BlinkDouble")
})

test("hover never interrupts a project or the click reaction", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  const i = run(mind, 0, 2000, () => ({ projectOpen: "mathview", hovered: "q-ux", station: 3 })).pop()!
  assert.equal(i.state, "interact")
  assert.notEqual(i.goalId, "q-ux")
})

test("reduced motion: no presence, no autonomous walks", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  const intents = run(mind, 0, 20000, () => ({ reducedMotion: true, pointer: { present: true, moving: true, overScope: false, nearScope: true } }))
  assert.ok(intents.every((i) => i.weight.eyes === 0 && i.weight.body === 0))
  assert.ok(intents.every((i) => i.state !== "explore"))
})

test("the click reaction's time starts when he actually reacts (after turning to you)", () => {
  const mind = new ScopeMind({ random: seeded() }, 0)
  mind.clickScope(1000)
  mind.update(base(1050))
  // he needed 2 s to turn round first
  mind.gestureStarted("ClickReaction", 3000)
  const during = mind.update(base(5000))
  assert.equal(during.state, "interact", "still reacting 2 s after the reaction began")
  const after = run(mind, 5050, 6500).pop()!
  assert.notEqual(after.state, "interact")
})
