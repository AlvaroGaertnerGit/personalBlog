// node --test docs/redesign/scope-world/core/scope/**/*.test.ts
//
// The mind against a simulated body and visitor: the same VisitorRig as the
// lab, a body that executes acts at the gaits' speeds, and the things' states.
import assert from "node:assert/strict"
import { test } from "node:test"

import { LAB_WORLD } from "../../../entrega-3-comportamiento/lab/src/lab-world.ts"
import { VisitorRig } from "../../app/visitor.ts"
import type { P2 } from "../../world-def.ts"
import { GAITS, dist, headingTo } from "../body/locomotor.ts"
import { GESTURES } from "../gestures.ts"
import { ScopeMind } from "./mind.ts"
import type { Act, ActReport, ClickEvent, Intent, Perception } from "./types.ts"

// the Entrega 3 lab is the fixture: its world is the one these behaviours were approved in
const { stations: STATIONS, timing: TIMING, places } = LAB_WORLD
const { ball: BALL, lantern: LANTERN, lanternDoor: LANTERN_DOOR } = places
const DT = 1 / 30
const seeded = (seed = 7) => () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32)

/** A body that does what it is told, at the gaits' speeds, with the clips' durations. */
class FakeWorld {
  now = 0
  at: [number, number] = [-0.95, -0.47]
  heading = 0
  inRefuge = false
  ball: [number, number] = [BALL.start[0], BALL.start[1]]
  ballMoving = 0
  flowerBloomed = false
  reading = false
  lookingAtScope = false
  reduced = false
  readonly rig = new VisitorRig(LAB_WORLD)
  readonly mind: ScopeMind
  report: ActReport = { seq: -1, kind: "idle", phase: "", done: true, interruptible: true }
  intents: Intent[] = []
  acts: (Act & { seq: number; t: number })[] = []
  maxStep = 0
  private act: (Act & { seq: number }) | null = null
  private actT = 0
  private clicks: ClickEvent[] = []

  constructor(random = seeded()) {
    this.mind = new ScopeMind(LAB_WORLD, { random })
  }

  click(target: ClickEvent["target"]) {
    this.rig.touch()
    this.clicks.push({ t: this.now, target })
  }

  run(seconds: number, each?: (w: FakeWorld) => void) {
    for (let k = 0; k < Math.round(seconds / DT); k++) {
      this.now += DT
      this.rig.update(DT, this.now)
      each?.(this)
      const p = this.perception()
      const intent = this.mind.tick(p)
      this.intents.push(intent)
      if (intent.act.seq !== this.report.seq) {
        this.act = intent.act
        this.actT = 0
        this.acts.push({ ...intent.act, t: this.now })
        this.report = { seq: intent.act.seq, kind: intent.act.kind, phase: "start", done: false, interruptible: true }
      }
      this.body()
    }
  }

  perception(): Perception {
    const anchor = this.rig.anchor
    const eye: P2 = [anchor[0] + 0.1, anchor[1] - 0.38]
    return {
      now: this.now,
      scope: { at: this.at, heading: this.heading, moving: this.moving, inRefuge: this.inRefuge, visible: dist(this.at, anchor) < 0.36 || this.inRefuge, act: this.report },
      visitor: {
        anchor,
        eye,
        s: this.rig.s,
        sVel: this.rig.sVel,
        zone: this.rig.zone,
        settled: this.rig.settled,
        reading: this.reading,
        lookingAtScope: this.lookingAtScope,
        idle: this.now - this.rig.lastInputAt,
      },
      objects: {
        ball: { at: this.ball, moving: this.ballMoving > 0, salience: this.ballMoving > 0 ? 0.6 : 0 },
        flower: { at: [-0.42, -0.6], moving: false, salience: 0 },
        radiometer: { at: [-0.12, -0.61], moving: false, salience: 0 },
        lantern: { at: LANTERN.center, moving: false, salience: 0 },
        cabinet: { at: [-1.13, -0.66], moving: false, salience: 0 },
      },
      clicks: this.clicks.splice(0),
      reduced: this.reduced,
    }
  }

  private moving = false

  private moveToward(goal: P2, speed: number) {
    const d = dist(this.at, goal)
    if (d < 1e-4) return true
    const step = Math.min(d, speed * DT)
    this.maxStep = Math.max(this.maxStep, step)
    this.heading = headingTo(this.at, goal)
    this.at = [this.at[0] + ((goal[0] - this.at[0]) * step) / d, this.at[1] + ((goal[1] - this.at[1]) * step) / d]
    this.moving = true
    return step >= d - 1e-9
  }

  private body() {
    const a = this.act
    this.moving = false
    if (this.ballMoving > 0) this.ballMoving -= DT
    if (!a || this.report.done) return
    this.actT += DT
    const t = this.actT
    const done = (phase = "hecho") => (this.report = { ...this.report, done: true, interruptible: true, phase })
    const busy = (phase: string) => (this.report = { ...this.report, phase, interruptible: false })
    if (this.inRefuge && a.kind !== "fit" && a.kind !== "react" && a.kind !== "idle" && a.kind !== "settle") this.inRefuge = false
    switch (a.kind) {
      case "idle":
      case "settle":
        return done()
      case "go":
        if (this.reduced) {
          this.at = [a.goal[0], a.goal[1]]
          return done()
        }
        if (this.moveToward(a.goal, GAITS[a.gait].speed)) done()
        return
      case "gesture":
        // like the body: an idle gesture may fade out for something more important after 0.35 s
        this.report = { ...this.report, phase: "clip", interruptible: t > 0.35 }
        if (this.reduced || t > 1.3) done()
        return
      case "react":
        busy("clip")
        if (t > 1.5) done()
        return
      case "surprise":
        busy("respingo")
        if (t > 0.7) done()
        return
      case "fit":
        if (this.moveToward(LANTERN_DOOR.seat, GAITS.walk.speed) && t > 1) {
          this.inRefuge = true
          done()
        }
        return
      case "unfit":
        this.inRefuge = false
        if (this.moveToward(LANTERN_DOOR.outside, GAITS.walk.speed)) done()
        return
      case "nudge": {
        const pre: P2 = [this.ball[0], this.ball[1] - 0.09]
        if (t < 3 && !this.moveToward(pre, GAITS.walk.speed)) return
        busy("empujar")
        if (t > 3.6) {
          const d = dist(this.ball, a.toward)
          const k = Math.min(1, 0.1 / Math.max(d, 1e-6))
          this.ball = [this.ball[0] + (a.toward[0] - this.ball[0]) * k, this.ball[1] + (a.toward[1] - this.ball[1]) * k]
          this.ballMoving = 0.3
          done()
        }
        return
      }
      case "shine":
        busy("iluminar")
        if (t > a.hold + 1.8) {
          if (a.object === "flower") this.flowerBloomed = true
          done()
        }
        return
    }
  }

  get states() {
    return this.intents.map((i) => i.state)
  }
}

test("starts moving with you, before the camera arrives", () => {
  const w = new FakeWorld()
  w.run(3)
  w.rig.goTo(2)
  const t0 = w.now
  let firstGo = -1
  let arrivedAt = -1
  w.run(4, (x) => {
    const last = x.acts[x.acts.length - 1]
    if (firstGo < 0 && last && last.kind === "go" && last.t > t0) firstGo = x.now - t0
    if (arrivedAt < 0 && x.rig.settled) arrivedAt = x.now - t0
  })
  assert.ok(firstGo >= 0 && firstGo < 0.6, `first go after ${firstGo} s`)
  assert.ok(arrivedAt > firstGo, `the camera settled after ${arrivedAt} s`)
})

test("never lost for more than 6 s, even when you jump across the route", () => {
  const w = new FakeWorld()
  w.run(2)
  w.rig.goTo(4)
  let lostSince = -1
  let worst = 0
  w.run(14, (x) => {
    const d = dist(x.at, x.rig.anchor)
    if (d > 0.5) lostSince = lostSince < 0 ? x.now : lostSince
    else lostSince = -1
    if (lostSince >= 0) worst = Math.max(worst, x.now - lostSince)
  })
  assert.ok(worst < 6, `lost for ${worst.toFixed(1)} s`)
  assert.ok(dist(w.at, w.rig.anchor) <= 0.5)
  assert.ok(w.maxStep <= GAITS.bound.speed * DT + 1e-9, "never faster than his fastest gait")
})

test("goes ahead to show you a place you have not seen, once", () => {
  const w = new FakeWorld()
  w.run(2)
  w.rig.goTo(1)
  w.run(1.5)
  const guided = w.states.filter((s) => s.startsWith("guiar")).length
  assert.ok(guided > 0, "guides toward an unseen place")
  w.run(6)
  // back and forth to the same place: no second guiding there
  w.rig.goTo(0)
  w.run(6)
  const before = w.mind.memory.zones[1].guided
  w.intents = []
  w.rig.goTo(1)
  w.run(2)
  assert.ok(before)
  assert.equal(w.states.filter((s) => s.startsWith("guiar")).length, 0)
})

test("shows what a place offers once you stop there (the flower: his light)", () => {
  const w = new FakeWorld()
  w.rig.s = w.rig.sTarget = 3
  w.at = [-0.5, -0.76]
  w.run(10)
  const shine = w.acts.find((a) => a.kind === "shine")
  assert.ok(shine && shine.kind === "shine" && shine.object === "flower")
  assert.ok(w.flowerBloomed)
  // not again right away
  const n = w.acts.filter((a) => a.kind === "shine").length
  w.run(20)
  assert.equal(w.acts.filter((a) => a.kind === "shine").length, n)
})

test("reading: no travel and no gestures while you read (first seconds), then he rests", () => {
  const w = new FakeWorld()
  w.rig.s = w.rig.sTarget = 2
  w.at = [-0.8, -0.76]
  w.run(1)
  w.reading = true
  w.rig.touch()
  const from = w.acts.length
  w.run(TIMING.readingStill - 1)
  const during = w.acts.slice(from)
  assert.ok(during.every((a) => a.kind === "idle"), `acts while reading: ${during.map((a) => a.kind)}`)
  w.run(4)
  assert.ok(w.states.includes("descansar mientras lees"))
})

test("click reactions depend on the context and do not escalate", () => {
  const w = new FakeWorld()
  w.rig.s = w.rig.sTarget = 2
  w.at = [-0.78, -0.72]
  w.run(1)
  w.click({ kind: "scope" })
  w.run(2)
  w.click({ kind: "scope" })
  w.run(2)
  w.click({ kind: "scope" })
  w.run(2)
  const reacts = w.acts.filter((a) => a.kind === "react").map((a) => (a.kind === "react" ? a.variant : ""))
  assert.deepEqual(reacts, ["full", "tilt", "blink"])
  // while reading: only a blink
  w.run(10)
  w.reading = true
  w.click({ kind: "scope" })
  w.run(2)
  const last = w.acts.filter((a) => a.kind === "react").pop()
  assert.ok(last && last.kind === "react" && last.variant === "blink")
})

test("a click while he is mid-push waits for the push to end", () => {
  const w = new FakeWorld()
  w.rig.s = w.rig.sTarget = 2
  w.at = [-0.8, -0.76]
  w.run(1)
  w.click({ kind: "object", id: "ball" })
  w.run(3.3) // walking to the ball, then pushing (not interruptible)
  w.click({ kind: "scope" })
  w.run(0.2)
  assert.equal(w.report.kind, "nudge", "the push is not cut")
  w.run(3)
  assert.ok(w.acts.some((a) => a.kind === "react"), "the reaction comes after")
})

test("his refuge: only after a long still moment at his home; out in under 1 s when you move", () => {
  const w = new FakeWorld()
  w.rig.s = w.rig.sTarget = 0
  w.run(TIMING.refugeAfter - 3)
  assert.ok(!w.acts.some((a) => a.kind === "fit"), "not before the time")
  w.run(12)
  assert.ok(w.acts.some((a) => a.kind === "fit"), "goes to rest")
  assert.ok(w.inRefuge, `not inside: ${w.mind.memory.log.map((l) => `${l.t.toFixed(1)} ${l.text}`).join(" | ")} · acts ${w.acts.slice(-5).map((a) => a.kind)}`)
  w.rig.goTo(1)
  const t0 = w.now
  let out = -1
  w.run(2, (x) => {
    const last = x.acts[x.acts.length - 1]
    if (out < 0 && last.kind === "unfit") out = x.now - t0
  })
  assert.ok(out >= 0 && out < 1, `leaves after ${out} s`)
})

test("coming back to a place: he recognises it", () => {
  const w = new FakeWorld()
  w.rig.s = w.rig.sTarget = 3
  w.at = [-0.5, -0.76]
  w.run(10) // the flower is shown
  w.rig.goTo(4)
  w.run(8)
  w.rig.goTo(3)
  w.run(6)
  const log = w.mind.memory.log.map((l) => l.text).join("\n")
  assert.match(log, /das la vuelta hacia «La flor de luz»: lo reconoce/)
  assert.ok(w.states.includes("recordar"), "remembers what he did there")
})

test("one look at you per visit when you do nothing", () => {
  const w = new FakeWorld()
  w.rig.s = w.rig.sTarget = 1
  w.at = [-0.95, -0.76]
  w.run(40)
  const looks = w.mind.memory.log.filter((l) => l.text.startsWith("te mira una vez")).length
  assert.equal(looks, 1)
})

test("never two idle gestures in a row from the same family", () => {
  const w = new FakeWorld(seeded(11))
  const m = w.mind.memory
  let prev = ""
  for (let k = 0; k < 300; k++) {
    const g = m.pickGesture(k * 30, seeded(k + 1))
    if (!g) continue
    const fam = GESTURES[g].family
    assert.notEqual(fam, prev)
    prev = fam
    m.played(k * 30, g)
  }
})

test("reduced motion: no visible travel, a blink instead of the reaction", () => {
  const w = new FakeWorld()
  w.reduced = true
  w.rig.reduced = true
  w.run(2)
  w.rig.goTo(3)
  w.run(1)
  assert.ok(w.maxStep === 0, "he never walks (he is placed at the cut)")
  w.click({ kind: "scope" })
  w.run(2)
  const r = w.acts.filter((a) => a.kind === "react").pop()
  assert.ok(r && r.kind === "react" && r.variant === "blink")
})

test("ten quiet minutes: calm (rest, refuge or settling) dominates", () => {
  const w = new FakeWorld(seeded(3))
  // a visitor who moves now and then and mostly stays
  let nextMove = 20
  w.run(600, (x) => {
    if (x.now > nextMove) {
      x.rig.goTo(Math.floor(((x.now * 7) % 5)))
      nextMove = x.now + 60
    }
  })
  const total = [...w.mind.timeIn.values()].reduce((a, b) => a + b, 0)
  const calm = ["reposo", "refugio", "descansar"].reduce((s, k) => s + (w.mind.timeIn.get(k) ?? 0), 0)
  assert.ok(calm / total > 0.5, `calm ${(100 * calm / total).toFixed(0)} % of the time`)
})

test("every place's waiting spot is close to your anchor", () => {
  for (const s of STATIONS) assert.ok(dist(s.wait, s.anchor) < 0.16, `${s.id}: ${dist(s.wait, s.anchor)}`)
})

