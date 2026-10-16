// node --test docs/redesign/scope-world/entrega-4-mundo/mundo/src/world-4a.test.ts
//
// The 4A world with no WebGL: the Entrega 3 mind on the 4A definition, its baked floor and
// its real cameras (three.js maths only, nothing is drawn). The thresholds are the approved
// ones (Entrega 3: never lost more than 6 s; the 4A audit: out of the camera's foreground);
// the browser check (tools/verify.mjs) measures the same things with the real body.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import * as THREE from "three"

import { VisitorRig } from "../../../core/app/visitor.ts"
import { MOODS, routeLight } from "../../../core/env/moods.ts"
import { BakedGround } from "../../../core/scope/baked-ground.ts"
import { GAITS, Locomotor, dist, headingTo, type Gait } from "../../../core/scope/body/locomotor.ts"
import { ScopeMind } from "../../../core/scope/mind/mind.ts"
import type { Act, ActReport, Perception } from "../../../core/scope/mind/types.ts"
import type { P2, WorldDef } from "../../../core/world-def.ts"
import { bl } from "../../../prototype/src/world/world-data.ts"
import { WORLD_4A, WORLD_PLACES } from "./world-4a.ts"

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets")
const bin = (f: string) => readFileSync(path.join(assets, f))
const ground = new BakedGround(
  JSON.parse(bin("ground.json").toString("utf8")),
  new Float32Array(new Uint8Array(bin("floor.bin")).buffer),
  new Uint8Array(bin("nav.bin")),
  new Uint8Array(bin("solid.bin")),
  [
    { at: WORLD_PLACES.flower.at, r: WORLD_PLACES.flower.baseR },
    { at: WORLD_PLACES.radiometer.at, r: 0.05 },
  ],
)
const CLEAR = WORLD_4A.refine?.cameraClearance ?? 0
const STATIONS = WORLD_4A.stations
const eyesOf = (i: number): P2[] => [STATIONS[i].camera.pos, STATIONS[i].portrait.pos].map((p) => [p[0], p[1]] as P2)
const DT = 1 / 30
const seeded = (seed = 7) => () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32)

test("4A opts in to the Entrega 4 refinements; the approved gaits are not re-paced", () => {
  assert.ok(CLEAR >= 0.3, "a camera clearance")
  assert.equal(WORLD_4A.gaits, undefined, "trot 0.13 and hurry 0.22 m/s, as approved")
  assert.ok((WORLD_4A.refine?.visitorMaxSpeed ?? Infinity) <= GAITS.bound.speed, "a jump travels no faster than his hurry")
  assert.equal(WORLD_4A.bands.tooClose, CLEAR, "«too close» is the same clearance")
})

test("every place's waiting spot is on free floor and clear of its cameras (desktop and phone)", () => {
  STATIONS.forEach((s, i) => {
    assert.ok(ground.isFree(s.wait), `${s.id}: wait not free`)
    for (const e of eyesOf(i)) assert.ok(dist(s.wait, e) >= CLEAR, `${s.id}: wait ${dist(s.wait, e).toFixed(3)} m from a camera`)
  })
})

test("his ball rests in the margin's middle ground, with room behind it to push it toward you", () => {
  const i = STATIONS.findIndex((s) => s.offer?.kind === "nudge")
  const { start, radius } = WORLD_PLACES.ball
  assert.ok(ground.isFree(start) || !ground.ballBlocked(start), "the ball's floor")
  const back = radius + 0.05 + 0.008 + 0.014 // where he stands to push it (acts.ts Nudge)
  for (const e of eyesOf(i)) {
    assert.ok(dist(start, e) >= CLEAR + 0.1, `ball ${dist(start, e).toFixed(2)} m from the camera`)
    // the mind's target (anchor toward you, kept out of the foreground) and his spot behind the ball
    const a = STATIONS[i].anchor
    let t: P2 = [a[0] + (e[0] - a[0]) * 0.25, a[1] + (e[1] - a[1]) * 0.25]
    const d = dist(t, e)
    if (d < CLEAR + radius) t = [e[0] + ((t[0] - e[0]) * (CLEAR + radius)) / d, e[1] + ((t[1] - e[1]) * (CLEAR + radius)) / d]
    assert.ok(dist(start, e) - dist(t, e) > 0.05, "pushed toward you")
    const L = dist(start, t)
    const pre: P2 = [start[0] - ((t[0] - start[0]) / L) * back, start[1] - ((t[1] - start[1]) / L) * back]
    assert.ok(dist(pre, e) >= CLEAR, "pushing it, he stays out of the camera's foreground")
    // he gets there from his waiting spot (the planner takes the nearest free cell to a goal:
    // within 3 cm here), and the whole way, sampled every centimetre, is out of both foregrounds
    const way = ground.path(STATIONS[i].wait, pre, start)
    assert.ok(way, "a way behind the ball")
    const end = way[way.length - 1]
    assert.ok(dist(end, pre) <= 0.03, `he stands ${dist(end, pre).toFixed(3)} m from where he would push it`)
    for (let k = 1; k < way.length; k++)
      for (let u = 0; u <= 1; u += 0.01 / Math.max(dist(way[k - 1], way[k]), 0.01)) {
        const q: P2 = [way[k - 1][0] + (way[k][0] - way[k - 1][0]) * u, way[k - 1][1] + (way[k][1] - way[k - 1][1]) * u]
        for (const c of eyesOf(i)) assert.ok(dist(q, c) >= CLEAR, `on his way at ${q.map((x) => x.toFixed(2))}, ${dist(q, c).toFixed(2)} m from a camera`)
      }
  }
})

test("each place has the light the Entrega 2 gave it, and it changes gradually between places", () => {
  for (const m of ["amanecer", "dia", "atardecer", "noche"]) assert.ok(MOODS[m], m)
  const at = (id: string) => routeLight(WORLD_4A, STATIONS.findIndex((s) => s.id === id))
  assert.equal(at("linterna").label, "Noche")
  assert.equal(at("margen").label, "Amanecer")
  assert.equal(at("luz").label, "Día")
  let worst = 0
  for (let s = 0; s < STATIONS.length - 1; s += 0.01) {
    const a = routeLight(WORLD_4A, s)
    const b = routeLight(WORLD_4A, s + 0.01)
    worst = Math.max(worst, Math.abs(b.exposure - a.exposure), Math.abs(b.hemi - a.hemi), Math.abs(b.lamp - a.lamp) / 2, Math.abs(b.sun.intensity - a.sun.intensity) / 4)
  }
  assert.ok(worst < 0.02, `a step of 1 % of a segment changes the light by ${worst.toFixed(3)}`)
})

test("the view: a step to the next place keeps the approved spring; only a jump travels at his pace", () => {
  const plain: WorldDef = { ...WORLD_4A, refine: {} }
  const a = new VisitorRig(WORLD_4A)
  const b = new VisitorRig(plain)
  a.goTo(1)
  b.goTo(1)
  for (let t = DT; t < 6; t += DT) {
    a.update(DT, t)
    b.update(DT, t)
    assert.equal(a.s, b.s, "one place: the same spring")
  }
  const r = new VisitorRig(WORLD_4A)
  r.goTo(5)
  let fastest = 0
  let prev = r.anchor
  for (let t = DT; t < 14; t += DT) {
    r.update(DT, t)
    if (Math.abs(5 - r.s) > 1.05) fastest = Math.max(fastest, dist(r.anchor, prev) / DT)
    prev = r.anchor
  }
  assert.ok(fastest <= GAITS.bound.speed + 1e-3, `the view ran at ${fastest.toFixed(3)} m/s`)
  assert.ok(Math.abs(r.s - 5) < 1e-3, "and it gets there")
})

test("a new way while he is barely moving starts as from standing: a turn on the spot, not a slow arc", () => {
  const loco = new Locomotor([0, 0], headingTo([0, 0], [-1, 0]))
  loco.restartBelow = 0.03
  loco.setPath([[0, 0], [-0.004, 0]], "walk") // a residual path, at a crawl
  loco.step(DT)
  loco.setPath([[0, 0], [0.4, 0]], "bound") // the way is behind him
  assert.equal(loco.state.phase, "turn")
  const lab = new Locomotor([0, 0], headingTo([0, 0], [-1, 0]))
  lab.setPath([[0, 0], [-0.004, 0]], "walk")
  lab.step(DT)
  lab.setPath([[0, 0], [0.4, 0]], "bound")
  assert.notEqual(lab.state.phase, "turn", "the lab keeps its behaviour (restartBelow 0)")
})

/**
 * The mind on the 4A world: the real visitor rig and cameras (desktop or phone), a body
 * that walks the baked floor's paths at the approved gaits and takes the clips' times.
 */
class World4A {
  now = 0
  at: [number, number]
  inRefuge = false
  readonly rig = new VisitorRig(WORLD_4A)
  readonly mind = new ScopeMind(WORLD_4A, { random: seeded() })
  readonly camera: THREE.PerspectiveCamera
  readonly states: string[] = []
  maxStep = 0
  private readonly look = new THREE.Vector3()
  private report: ActReport = { seq: -1, kind: "idle", phase: "", done: true, interruptible: true }
  private act: (Act & { seq: number }) | null = null
  private actT = 0
  private path: P2[] = []

  constructor(start: number, phone: boolean) {
    this.rig.s = this.rig.sTarget = start
    this.rig.portrait = phone
    this.camera = new THREE.PerspectiveCamera(40, phone ? 390 / 664 : 1440 / 900, 0.01, 800)
    const w = start === 0 ? WORLD_4A.places.lanternDoor.outside : STATIONS[start].wait
    this.at = [w[0], w[1]]
  }

  get eye(): P2 {
    return [this.camera.position.x, -this.camera.position.z]
  }

  /** His head in the frame (the page's test: |ndc| < 0.94). */
  get visible() {
    const v = bl(this.at[0], this.at[1], 0.06).project(this.camera)
    return v.z < 1 && Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.94
  }

  run(seconds: number, each?: (w: World4A) => void) {
    for (let k = 0; k < Math.round(seconds / DT); k++) {
      this.now += DT
      this.rig.update(DT, this.now)
      this.rig.pose(this.camera, this.look)
      this.camera.updateMatrixWorld()
      const intent = this.mind.tick(this.perception())
      this.states.push(intent.state)
      if (intent.act.seq !== this.report.seq) {
        this.act = intent.act
        this.actT = 0
        this.path = intent.act.kind === "go" ? (ground.path(this.at, intent.act.goal, WORLD_PLACES.ball.start) ?? []) : []
        this.report = { seq: intent.act.seq, kind: intent.act.kind, phase: "start", done: false, interruptible: true }
      }
      this.body()
      each?.(this)
    }
  }

  private perception(): Perception {
    const v = this.rig
    return {
      now: this.now,
      scope: { at: this.at, heading: 0, moving: this.path.length > 0, inRefuge: this.inRefuge, visible: this.visible || this.inRefuge, act: this.report },
      visitor: { anchor: v.anchor, eye: this.eye, s: v.s, sVel: v.sVel, target: v.sTarget, zone: v.zone, settled: v.settled, reading: false, lookingAtScope: false, idle: this.now - v.lastInputAt },
      objects: {
        ball: { at: WORLD_PLACES.ball.start, moving: false, salience: 0 },
        flower: { at: WORLD_PLACES.flower.at, moving: false, salience: 0 },
        radiometer: { at: WORLD_PLACES.radiometer.at, moving: false, salience: 0 },
        lantern: { at: WORLD_PLACES.lantern.center, moving: false, salience: 0 },
        cabinet: { at: [-1.13, -0.66], moving: false, salience: 0 },
      },
      clicks: [],
      reduced: false,
    }
  }

  private walk(gait: Gait) {
    let left = GAITS[gait].speed * DT
    const from: P2 = [this.at[0], this.at[1]]
    while (left > 1e-9 && this.path.length) {
      const p = this.path[0]
      const d = dist(this.at, p)
      if (d <= left) {
        this.at = [p[0], p[1]]
        left -= d
        this.path.shift()
      } else {
        this.at = [this.at[0] + ((p[0] - this.at[0]) * left) / d, this.at[1] + ((p[1] - this.at[1]) * left) / d]
        left = 0
      }
    }
    this.maxStep = Math.max(this.maxStep, dist(from, this.at))
    return this.path.length === 0
  }

  private body() {
    const a = this.act
    if (!a || this.report.done) return
    this.actT += DT
    const done = () => (this.report = { ...this.report, done: true, interruptible: true, phase: "hecho" })
    const busy = (phase: string) => (this.report = { ...this.report, phase, interruptible: false })
    if (a.kind === "go") {
      if (this.walk(a.gait)) done()
    } else if (a.kind === "gesture" || a.kind === "react") {
      busy("clip")
      if (this.actT > 1.4) done()
    } else if (a.kind === "shine") {
      busy("iluminar")
      if (this.actT > a.hold + 1.8) done()
    } else if (a.kind === "nudge") {
      busy("empujar")
      if (this.actT > 3.6) done()
    } else if (a.kind === "unfit") {
      this.inRefuge = false
      done()
    } else done()
  }
}

for (const phone of [false, true])
  for (const [from, to] of [[0, 5], [5, 0], [1, 5]] as const)
    test(`${phone ? "phone" : "desktop"} · jump ${STATIONS[from].label} → ${STATIONS[to].label}: never lost (far or out of frame) more than 6 s`, () => {
      const w = new World4A(from, phone)
      w.run(6)
      w.rig.goTo(to)
      let lostSince = -1
      let worst = 0
      w.states.length = 0
      w.run(22, (x) => {
        const lost = dist(x.at, x.rig.anchor) > WORLD_4A.bands.tense || !x.visible
        lostSince = lost ? (lostSince < 0 ? x.now : lostSince) : -1
        if (lostSince >= 0) worst = Math.max(worst, x.now - lostSince)
      })
      assert.ok(worst <= 6, `lost for ${worst.toFixed(1)} s`)
      assert.ok(dist(w.at, w.rig.anchor) <= WORLD_4A.bands.comfort + 0.05, `ends ${dist(w.at, w.rig.anchor).toFixed(2)} m from you`)
      assert.ok(w.maxStep <= GAITS.bound.speed * DT + 1e-9, "never faster than his hurry")
      if (to === 5) assert.ok(!w.states.slice(0, 30).includes("guiar"), "a jump is not a guide to the next place")
    })
