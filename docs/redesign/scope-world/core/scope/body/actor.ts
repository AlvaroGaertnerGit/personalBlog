// Scope in the lab: the APPROVED model and motion system, plus the new body
// layers. Read-only imports:
//
//   loadScope3DModel   production GLB (public/scope/scope.glb), ceramic shader
//   Scope3DAnimator    Idle + additive clips
//   Scope3DSecondary   antenna spring, posture drift, blinks
//   Presence           (1.0 prototype) gaze toward a world point, eyes before body
//
// New here: the Locomotor (continuous root motion), the GaitLayer (steps on the
// approved bones), his light (a spotlight from the face) and the act runners
// (acts.ts). Frame order: act → locomotor → mixer → gait → secondary
// (drift → presence → antenna spring → blink) → "Tall" eyes → light.

import * as THREE from "three"

import { Scope3DAnimator } from "../../../../../../src/components/scope-3d/engine/scope-3d-animator.ts"
import { loadScope3DModel, type Scope3DModel } from "../../../../../../src/components/scope-3d/engine/scope-3d-model.ts"
import { Scope3DSecondary } from "../../../../../../src/components/scope-3d/engine/scope-3d-secondary.ts"
import { Presence } from "../../../prototype/src/scope/presence.ts"
import { bl } from "../../../prototype/src/world/world-data.ts"
import type { P2, Places, WorldDef } from "../../world-def.ts"

type WorldGaits = NonNullable<WorldDef["gaits"]>
import type { Clip } from "../gestures.ts"
import type { Ground } from "../ground.ts"
import type { Act, ActReport, Intent, Look } from "../mind/types.ts"
import type { ScopeLight } from "../props.ts"
import { createRunner, type Runner } from "./acts.ts"
import { GaitLayer, NEUTRAL_POSE, type GaitPose } from "./gait.ts"
import { attachAfterDrift } from "./presence-hook.ts"
import { Locomotor, dist, headingTo } from "./locomotor.ts"

const MIRRORED = new Set(["Focus", "Tilt", "LookAround"])
const LIGHT = { intensity: 0.35, angle: THREE.MathUtils.degToRad(30), penumbra: 0.55, color: new THREE.Color(1, 0.9, 0.74) }
/** Scope's body as a circle for the ball (m): centre a little ahead of his root. */
export const BODY = { radius: 0.05, ahead: 0.008 }

export interface ActorWorld {
  now: number
  ground: Ground
  places: Places
  ball: { at: P2; speed: number } | null
  flowerBloomed: boolean
  radiometerOmega: number
  /** Look → world point (three.js), or null. */
  resolve(look: Look): THREE.Vector3 | null
  objectAt(id: "ball" | "flower" | "radiometer"): P2
  eye: P2
  /** Would you see him standing there (his head inside the frame)? */
  inView(at: P2): boolean
}

class LayeredMorph {
  private clip = 0
  private written: number | null = null
  base(current: number) {
    if (current !== this.written) this.clip = current
    return this.clip
  }
  write(v: number) {
    this.written = v
    return v
  }
}

export class LabScope {
  readonly group = new THREE.Group()
  readonly model: Scope3DModel
  readonly animator: Scope3DAnimator
  readonly secondary: Scope3DSecondary
  readonly presence: Presence
  readonly gait: GaitLayer
  readonly loco: Locomotor
  readonly light: THREE.SpotLight
  /** Invisible sphere for the pointer. */
  readonly proxy: THREE.Mesh
  reduced = false
  /** Seated on his dish, inside the lantern. */
  inRefuge = false
  report: ActReport = { seq: -1, kind: "idle", phase: "", done: true, interruptible: true }
  /** Current light level 0..1 (what the mechanisms receive). */
  glow = 0
  readonly face: THREE.Object3D
  /** His places in this world (the lantern for the refuge). */
  readonly places: Places

  private runner: Runner | null = null
  private pose: GaitPose = { ...NEUTRAL_POSE }
  private readonly targetPose: GaitPose = { ...NEUTRAL_POSE }
  private y = 0
  private tall = 0
  private readonly tallMorph = new LayeredMorph()
  private readonly eyes: THREE.Mesh | null
  private readonly tallIndex: number
  private stepDt = 0
  private clickReacting = false
  private prevCollider: P2 | null = null
  private colliderVel: [number, number] = [0, 0]
  private offAxisSince = -1
  private clock = 0
  private readonly lightTarget = new THREE.Object3D()

  private constructor(model: Scope3DModel, ground: Ground, places: Places, start: { at: P2; heading: number }, gaits: WorldGaits) {
    this.model = model
    this.places = places
    this.group.name = "Scope"
    this.group.add(model.root)
    this.animator = new Scope3DAnimator(model.root, model.gltf.animations)
    this.secondary = new Scope3DSecondary(model.root)
    this.presence = new Presence(this.group, model.root, model.gltf.animations)
    this.gait = new GaitLayer(model.root)
    this.loco = new Locomotor(start.at, start.heading, gaits)
    this.y = ground.height(start.at)

    // Presence runs after the drift and before the antenna spring (presence-hook.ts:
    // the one experimental seam with the engine)
    attachAfterDrift(this.secondary, () => this.presence.apply(this.stepDt, this.damping()))

    const face = model.root.getObjectByName("SCOPE_FaceCenter") ?? model.root.getObjectByName("body")
    if (!face) throw new Error("Scope rig: no face")
    this.face = face
    // his light: a soft cone from the face, along its normal
    this.light = new THREE.SpotLight(LIGHT.color, 0, 0.9, LIGHT.angle, LIGHT.penumbra, 2)
    this.light.castShadow = false
    this.light.position.set(0, 0, 0.004) // lights are born at (0, 1, 0): on the glass instead
    this.lightTarget.position.set(0, 0, 0.3)
    face.add(this.light, this.lightTarget)
    this.light.target = this.lightTarget

    this.proxy = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), new THREE.MeshBasicMaterial({ visible: false }))
    this.proxy.position.y = 0.055
    this.proxy.name = "Scope_Pick"
    this.group.add(this.proxy)

    let eyes: THREE.Mesh | null = null
    model.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.morphTargetDictionary?.Tall !== undefined) eyes = o
      if (o instanceof THREE.Mesh) o.castShadow = true
    })
    this.eyes = eyes
    this.tallIndex = (eyes as THREE.Mesh | null)?.morphTargetDictionary?.Tall ?? -1
    this.sync()
  }

  static async load(url: string, ground: Ground, places: Places, start: { at: P2; heading: number }, gaits: WorldGaits = {}) {
    const model = await loadScope3DModel(url)
    return new LabScope(model, ground, places, start, gaits)
  }

  get at(): P2 {
    return [this.loco.state.at[0], this.loco.state.at[1]]
  }

  get heading() {
    return this.loco.state.heading
  }

  get moving() {
    return this.loco.moving || this.loco.state.speed > 0.005
  }

  /** Scope's body as a moving circle for the ball (Blender 2D). */
  collider(): { c: P2; v: P2; r: number } {
    return { c: this.colliderCenter(), v: this.colliderVel, r: BODY.radius }
  }

  lightState(): ScopeLight {
    const pos = this.light.getWorldPosition(new THREE.Vector3())
    const dir = this.lightTarget.getWorldPosition(new THREE.Vector3()).sub(pos).normalize()
    return { pos, dir, level: this.glow, angle: LIGHT.angle, penumbra: LIGHT.penumbra }
  }

  /** Head (body bone) in world space. */
  headPosition(out = new THREE.Vector3()) {
    return this.model.root.getObjectByName("body")!.getWorldPosition(out)
  }

  /** Be somewhere at once (reduced motion, a camera cut). The act in progress carries on from there. */
  place(at: P2, heading: number, ground: Ground) {
    this.loco.teleport(at, heading)
    this.y = ground.height(at)
    this.sync()
  }

  // --- used by the act runners -----------------------------------------------------------
  /** Move the root directly (a lunge, a hop back): continuous, so the ball feels the velocity. */
  shift(dx: number, dy: number) {
    this.loco.state.at[0] += dx
    this.loco.state.at[1] += dy
  }

  setPose(p: Partial<GaitPose>) {
    Object.assign(this.targetPose, NEUTRAL_POSE, p)
  }

  headingError(look: Look | P2 | null, world: ActorWorld) {
    const h = this.headingToward(look, world)
    if (h === null) return 0
    let d = (h - this.loco.state.heading) % (Math.PI * 2)
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    return d
  }

  headingToward(look: Look | P2 | null, world: ActorWorld): number | null {
    if (!look) return null
    if (Array.isArray(look)) return headingTo(this.at, look as P2)
    const p = world.resolve(look as Look)
    if (!p) return null
    const target: P2 = [p.x, -p.z]
    if (dist(target, this.at) < 0.01) return null
    return headingTo(this.at, target)
  }

  play(clip: Clip, weight = 1) {
    let c = clip
    if (this.reduced && c !== "BlinkDouble") c = "BlinkDouble"
    const name = MIRRORED.has(c) ? `${c}.${Math.random() < 0.5 ? "L" : "R"}` : c
    const reaction = c === "ClickReaction"
    this.clickReacting = reaction
    this.animator.stopAll(reaction ? 350 : 250)
    this.animator.play(name, { fadeInMs: reaction ? 120 : 250, timeScale: reaction ? 1 : 0.92 + Math.random() * 0.16, weight })
  }

  get clipBusy() {
    return this.animator.busy
  }

  // --- the frame ---------------------------------------------------------------------------
  execute(act: Act & { seq: number }, world: ActorWorld) {
    if (act.seq === this.report.seq) return
    this.runner?.end?.()
    this.setPose({})
    this.runner = createRunner(act, this, world)
    this.report = { seq: act.seq, kind: act.kind, phase: this.runner.phase, done: false, interruptible: this.runner.interruptible }
  }

  update(dt: number, world: ActorWorld, intent: Intent) {
    this.clock += dt
    this.stepDt = dt
    if (!this.animator.busy) this.clickReacting = false

    // the act
    const r = this.runner
    if (r && !r.done) r.step(dt, world)
    if (r) this.report = { seq: this.report.seq, kind: this.report.kind, phase: r.phase, done: r.done, interruptible: r.interruptible || r.done }
    if (!r || r.done) this.setPose(r?.restPose ?? {})

    // turn the body toward what he keeps looking at, if it is well off to the side
    this.turnTowardGaze(world, intent)

    // where the feet take him
    this.loco.speedFactor = this.gait.speedFactor
    this.loco.step(dt)
    const ground = world.ground.height(this.at)
    // the floor under him: follow it quickly (stepping onto his dish), never sink into it
    this.y += (ground - this.y) * (1 - Math.exp(-dt / 0.05))
    if (this.y < ground - 0.0005) this.y = ground - 0.0005
    this.sync()

    // in his refuge: seated near the dish centre
    this.inRefuge = dist(this.at, this.places.lantern.center) < 0.05 && (this.report.kind === "fit" || this.report.kind === "react" || this.report.kind === "idle" || this.report.kind === "settle")

    // presence: the mind's gaze
    this.presence.target = intent.gaze.kind === "none" ? null : world.resolve(intent.gaze)
    this.presence.weight = this.reduced ? { eyes: 0, body: 0 } : intent.gazeWeight

    // pose: eased toward the act's, then the clips and the gait layer
    for (const k of Object.keys(this.pose) as (keyof GaitPose)[]) this.pose[k] = this.targetPose[k]
    this.animator.update(dt)
    const s = this.loco.state
    this.gait.apply(dt, { speed: s.speed, yawRate: s.yawRate, accel: s.accel, phase: s.phase, gait: this.loco.gait, pose: this.pose, still: this.reduced })
    this.secondary.options.reducedMotion = this.reduced
    this.secondary.update(dt, this.animator.busy)

    // "Tall" eyes: surprise / recognition (an approved shape key, eased)
    const tallWant = this.reduced ? 0 : Math.max(intent.tall, r?.tall ?? 0)
    this.tall += (tallWant - this.tall) * (1 - Math.exp(-dt / 0.09))
    if (this.eyes && this.tallIndex >= 0) {
      const w = this.eyes.morphTargetInfluences!
      const base = this.tallMorph.base(w[this.tallIndex])
      w[this.tallIndex] = this.tallMorph.write(Math.min(1, Math.max(base, this.tall * 0.55)))
    }

    // his light
    const want = r?.light ?? intent.glow
    this.glow += (want - this.glow) * (1 - Math.exp(-dt / (want > this.glow ? 0.18 : 0.35)))
    this.light.intensity = this.glow * LIGHT.intensity

    // the body's velocity for the ball (finite difference of the collider)
    const c = this.colliderCenter()
    if (this.prevCollider && dt > 0) this.colliderVel = [(c[0] - this.prevCollider[0]) / dt, (c[1] - this.prevCollider[1]) / dt]
    this.prevCollider = c
  }

  private colliderCenter(): P2 {
    const h = this.loco.state.heading
    const lean = THREE.MathUtils.degToRad(this.gait.readout.leanDeg)
    const ahead = BODY.ahead + Math.sin(lean) * 0.03 // the lean pivots in the shell's centre
    return [this.at[0] + Math.sin(h) * ahead, this.at[1] - Math.cos(h) * ahead]
  }

  private turnTowardGaze(world: ActorWorld, intent: Intent) {
    const r = this.runner
    const free = (!r || r.done) && !this.loco.moving && !this.inRefuge && !this.animator.busy && !this.reduced
    if (!free || intent.gaze.kind === "none" || intent.gaze.kind === "ahead") {
      this.offAxisSince = -1
      return
    }
    const err = this.headingError(intent.gaze, world)
    if (Math.abs(err) > THREE.MathUtils.degToRad(40)) {
      if (this.offAxisSince < 0) this.offAxisSince = this.clock
      if (this.clock - this.offAxisSince > 0.8) {
        this.loco.face(this.loco.state.heading + err * 0.8)
        this.offAxisSince = -1
      }
    } else this.offAxisSince = -1
  }

  private damping() {
    if (this.clickReacting && this.animator.busy) return { eyes: 0, body: 0.1 }
    if (this.animator.busy) return { eyes: 0.35, body: 0.3 }
    if (this.loco.moving) return { eyes: 0.85, body: 0.55 }
    return { eyes: 1, body: 1 }
  }

  private sync() {
    const s = this.loco.state
    this.group.position.copy(bl(s.at[0], s.at[1], this.y))
    this.group.rotation.set(0, s.heading, 0)
    this.group.updateMatrixWorld(true)
  }
}
