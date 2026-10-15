// The step bench (?banco): the new locomotion beside the 1.0 one, on the same
// floor, walking the same distance at the same time. Left: Entrega 3 (steps,
// three gaits). Right: the 1.0 prototype's ScopeActor, unchanged (Bounce hops).

import * as THREE from "three"

import { LabScope } from "../../../core/scope/body/actor.ts"
import type { Gait } from "../../../core/scope/body/locomotor.ts"
import type { Intent } from "../../../core/scope/mind/types.ts"
import type { Ground } from "../../../core/scope/ground.ts"
import type { Stage } from "../../../core/env/stage.ts"
import { LAB_PLACES, LAB_WORLD } from "./lab-world.ts"
import { ScopeActor } from "../../../prototype/src/scope/scope-actor.ts"
import type { Floor } from "../../../prototype/src/world/world-data.ts"
import { bl } from "../../../prototype/src/world/world-data.ts"

const $ = (id: string) => document.getElementById(id) as HTMLElement
const LANES = { lab: { a: [-0.8, -0.86], b: [-0.6, -0.86] }, old: { a: [-0.5, -0.86], b: [-0.3, -0.86] } } as const

export async function startBench(stage: Stage, ground: Ground) {
  document.body.classList.add("bench")
  const floorShim = { at: (x: number, z: number) => ground.height([x, -z]) } as unknown as Floor
  const [lab, old] = await Promise.all([LabScope.load("/scope/scope.glb", ground, LAB_PLACES, LAB_WORLD.start), ScopeActor.load("/scope/scope.glb", floorShim, ground.staticGrid)])
  stage.scene.add(lab.group, old.group)
  lab.place(LANES.lab.a as unknown as [number, number], Math.PI / 2, ground)
  old.place(LANES.old.a as unknown as [number, number], Math.PI / 2)
  stage.camera.position.copy(bl(-0.55, -1.62, 0.16))
  const target = bl(-0.55, -0.85, 0.05)
  stage.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(36 / stage.camera.aspect / 2 / 24))
  stage.camera.lookAt(target)
  stage.camera.updateProjectionMatrix()

  let gait: Gait = "walk"
  let toB = false // the first leg goes to B
  let seq = 1
  let wait = 1
  let labDone = false
  let oldDone = false
  old.onArrive = () => (oldDone = true)
  const intent = (act: Intent["act"]): Intent => ({ group: "reposo", state: "banco", reason: "", act, gaze: { kind: "ahead" }, gazeWeight: { eyes: 0.9, body: 0.45 }, glow: 0.06, tall: 0 })
  let current = intent({ kind: "idle", seq: 0 })
  const world = () => ({
    now: 0,
    ground,
    places: LAB_PLACES,
    ball: null,
    flowerBloomed: false,
    radiometerOmega: 0,
    resolve: (l: { kind: string }) => (l.kind === "ahead" ? bl(lab.at[0] + (toB ? 0.3 : -0.3), lab.at[1], 0.05) : null),
    objectAt: () => [0, 0] as [number, number],
    eye: [-0.55, -1.62] as [number, number],
    inView: () => true,
  })

  $("bench-gaits").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-gait]")
    if (!b) return
    gait = b.dataset.gait as Gait
    for (const x of document.querySelectorAll<HTMLButtonElement>("[data-gait]")) x.setAttribute("aria-pressed", String(x === b))
  })

  let last = performance.now()
  stage.renderer.setAnimationLoop(() => {
    const t = performance.now()
    const dt = Math.min(1 / 30, (t - last) / 1000)
    last = t
    if (labDone && oldDone) {
      wait -= dt
      if (wait <= 0) {
        toB = !toB
        labDone = oldDone = false
        wait = 1.2
        const to = toB ? LANES.lab.b : LANES.lab.a
        current = intent({ kind: "go", goal: [to[0], to[1]], gait, face: null, follow: false, seq: ++seq })
        const o = toB ? LANES.old.b : LANES.old.a
        old.goTo([o[0], o[1]], `bench${seq}`)
      }
    } else if (seq === 1 && wait > 0) {
      wait -= dt
      if (wait <= 0) labDone = oldDone = true
    }
    const w = world() as unknown as Parameters<LabScope["update"]>[1]
    lab.execute(current.act, w)
    lab.update(dt, w, current)
    if (current.act.kind === "go" && lab.report.done) labDone = true
    old.update(dt)
    stage.frame(target)
    stage.renderer.render(stage.scene, stage.camera)
    $("bench-readout").textContent = `2.0: ${lab.gait.readout.mode} · ${(lab.loco.state.speed * 100).toFixed(1)} cm/s · squash ${lab.gait.readout.squash.toFixed(3)}   |   1.0: ${old.moving ? "Bounce" : "quieto"}`
  })
  document.body.classList.remove("loading")
  Object.assign(window, { __bench: { lab, old, setGait: (g: Gait) => (gait = g) } })
}
