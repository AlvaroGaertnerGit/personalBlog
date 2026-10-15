// Scope in the Pliego: the APPROVED model and motion system, placed in the
// world. Reused as they are (read-only imports from src/components/scope-3d):
//
//   loadScope3DModel   the production GLB (public/scope/scope.glb), ceramic shader
//   Scope3DAnimator    Idle base + additive behaviour clips, eased fades
//   Scope3DSecondary   antenna spring, posture drift, single blinks
//
// New in this prototype (and only here):
//
//   Presence    gaze toward a world point (presence.ts), hooked between the
//               drift and the antenna spring
//   locomotion  Scope has NO walk cycle. He travels by hops: the approved
//               `Bounce` clip (squash, push, apex, landing) with the root
//               translated between `push` and `landing`, and turned toward
//               the next hop. Declared as a prototype technique (README §7).
//   mind        the state machine (mind.ts) decides; this file executes.

import * as THREE from "three"

import { Scope3DAnimator } from "../../../../../../src/components/scope-3d/engine/scope-3d-animator.ts"
import { loadScope3DModel, type Scope3DModel } from "../../../../../../src/components/scope-3d/engine/scope-3d-model.ts"
import { Scope3DSecondary } from "../../../../../../src/components/scope-3d/engine/scope-3d-secondary.ts"
import { bl, type Floor } from "../world/world-data.ts"
import type { Gesture } from "./mind.ts"
import { findPath, pathLength, toHops, type NavGrid, type P2 } from "./nav.ts"
import { Presence } from "./presence.ts"

/** Bounce markers (scope-clips.json): the feet leave at `push`, land at `landing`. */
const BOUNCE = { duration: 1.2, push: 0.29, landing: 0.73 }
/** Short trips: small, unhurried hops. Long trips: longer, quicker ones (~13 cm/s). */
const HOP = { near: { m: 0.06, speed: 1.1 }, far: { m: 0.085, speed: 1.35 }, farFrom: 0.35 }
/** Next hop starts this long after the previous one began (s, at timeScale 1). */
const HOP_CHAIN_S = 0.92
const TURN_IN_PLACE_DEG = 14
/** A gesture waits for him to face its target first if it is further off than this. */
const TURN_BEFORE_GESTURE_DEG = 50

interface Hop {
  from: THREE.Vector3
  to: THREE.Vector3
  fromYaw: number
  toYaw: number
  start: number
  /** Seconds the feet are off the ground, from `start`. */
  air: [number, number]
}

const MIRRORED = new Set(["Focus", "Tilt", "LookAround"])

function shortestAngle(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export class ScopeActor {
  readonly group = new THREE.Group()
  readonly model: Scope3DModel
  readonly animator: Scope3DAnimator
  readonly secondary: Scope3DSecondary
  readonly presence: Presence
  /** Fired when the last hop toward the goal lands. */
  onArrive: () => void = () => {}
  /** Fired when a requested gesture actually starts. */
  onGesture: (clip: Gesture) => void = () => {}
  reducedMotion = false

  private readonly floor: Floor
  private readonly nav: NavGrid
  private hops: P2[] = []
  private hop: Hop | null = null
  private clock = 0
  private yaw = 0
  private goalKey = ""
  private pendingGesture: { clip: Gesture; seq: number } | null = null
  private lastSeq = 0
  private clickReacting = false
  private faceYaw: number | null = null
  readonly height: number

  private hopSpeed = HOP.near.speed

  private constructor(model: Scope3DModel, floor: Floor, nav: NavGrid) {
    this.model = model
    this.floor = floor
    this.nav = nav
    this.group.name = "Scope"
    this.group.add(model.root)
    this.animator = new Scope3DAnimator(model.root, model.gltf.animations)
    this.secondary = new Scope3DSecondary(model.root)
    this.presence = new Presence(this.group, model.root, model.gltf.animations)
    const box = new THREE.Box3().setFromObject(model.root)
    this.height = box.max.y - box.min.y

    // Prototype hook: Presence runs after the drift and before the antenna
    // spring, so the spring feels the new body motion (06-plan-tecnico §1.3).
    // Production would add this hook to scope-3d-secondary.ts; here the engine
    // stays untouched and the private step is wrapped on this instance only.
    const secondary = this.secondary as unknown as { applyDrift(): void }
    const drift = secondary.applyDrift.bind(secondary)
    secondary.applyDrift = () => {
      drift()
      this.presence.apply(this.stepDt, this.damping())
    }
  }

  private stepDt = 0

  static async load(url: string, floor: Floor, nav: NavGrid) {
    const model = await loadScope3DModel(url)
    return new ScopeActor(model, floor, nav)
  }

  /** Stand at a Blender (x, y) facing a Blender heading. */
  place(at: P2, yaw: number) {
    this.hop = null
    this.hops = []
    this.yaw = yaw
    this.group.position.copy(bl(at[0], at[1], 0))
    this.group.position.y = this.floor.at(this.group.position.x, this.group.position.z)
    this.group.rotation.set(0, yaw, 0)
  }

  /** Where he stands, Blender (x, y). */
  get at(): P2 {
    return [this.group.position.x, -this.group.position.z]
  }

  get moving() {
    return this.hop !== null || this.hops.length > 0
  }

  get gesturing() {
    return this.animator.busy && !this.hop
  }

  /** Head (body bone) in world space. */
  headPosition(out = new THREE.Vector3()) {
    return this.model.root.getObjectByName("body")!.getWorldPosition(out)
  }

  /** Go to a Blender (x, y) over walkable floor (re-planned only when the goal changes). */
  goTo(goal: P2 | null, key: string) {
    if (!goal) {
      // stop after the hop in the air (never mid-air)
      this.goalKey = ""
      this.hops = []
      return
    }
    const k = `${key}:${goal[0].toFixed(3)},${goal[1].toFixed(3)}`
    if (k === this.goalKey) return
    this.goalKey = k
    const path = findPath(this.nav, this.at, goal)
    if (!path) {
      // nowhere to stand there (should not happen: spots are checked at load)
      this.onArrive()
      return
    }
    if (this.reducedMotion) {
      // no travel: he is simply there at the next cut (the camera fades)
      const last = path[path.length - 1]
      const prev = path[Math.max(0, path.length - 2)]
      this.place(last, Math.atan2(last[0] - prev[0], -(last[1] - prev[1])))
      this.onArrive()
      return
    }
    const far = pathLength(path) > HOP.farFrom
    this.hopSpeed = far ? HOP.far.speed : HOP.near.speed
    this.hops = toHops(path, far ? HOP.far.m : HOP.near.m).filter((p, i, all) => i < all.length - 1 || Math.hypot(p[0] - this.at[0], p[1] - this.at[1]) > 0.004)
    if (!this.hops.length) this.onArrive()
  }

  /** Turn toward a world point once standing (null = keep facing). */
  faceToward(point: THREE.Vector3 | null) {
    if (!point) {
      this.faceYaw = null
      return
    }
    this.faceYaw = Math.atan2(point.x - this.group.position.x, point.z - this.group.position.z)
  }

  gesture(g: { clip: Gesture; seq: number } | null) {
    if (g && g.seq !== this.lastSeq) {
      this.lastSeq = g.seq
      this.pendingGesture = g
    }
  }

  private play(clip: Gesture) {
    if (clip === "ClickReaction" && this.reducedMotion) clip = "BlinkDouble"
    const name = MIRRORED.has(clip) ? `${clip}.${Math.random() < 0.5 ? "L" : "R"}` : clip
    const reaction = clip === "ClickReaction"
    this.clickReacting = reaction
    this.animator.stopAll(reaction ? 350 : 250)
    this.animator.play(name, {
      fadeInMs: reaction ? 120 : 250,
      timeScale: reaction ? 1 : 0.9 + Math.random() * 0.2,
      weight: reaction ? 1 : 0.9 + Math.random() * 0.2,
    })
  }

  /** Presence quiets down while a clip plays (06-plan-tecnico §1.4). */
  private damping() {
    if (this.clickReacting && this.animator.busy) return { eyes: 0, body: 0.1 }
    if (this.hop) return { eyes: 0.8, body: 0.5 }
    if (this.animator.busy) return { eyes: 0.35, body: 0.3 }
    return { eyes: 1, body: 1 }
  }

  update(dt: number) {
    this.clock += dt
    this.stepDt = dt
    if (!this.animator.busy) this.clickReacting = false
    this.stepLocomotion()
    // a gesture waits for the feet to be on the ground, and for him to face what it is for
    if (this.pendingGesture && !this.hop && !this.hops.length && !this.mustTurnFirst()) {
      this.play(this.pendingGesture.clip)
      this.onGesture(this.pendingGesture.clip)
      this.pendingGesture = null
    }
    this.animator.update(dt)
    this.secondary.update(dt, this.animator.busy)
  }

  private stepLocomotion() {
    const now = this.clock
    const hop = this.hop
    if (hop) {
      const t = now - hop.start
      const [a, b] = hop.air
      const k = THREE.MathUtils.smoothstep(t, a, b)
      this.group.position.lerpVectors(hop.from, hop.to, k)
      this.group.position.y = THREE.MathUtils.lerp(hop.from.y, hop.to.y, k)
      this.yaw = hop.fromYaw + shortestAngle(hop.fromYaw, hop.toYaw) * THREE.MathUtils.smoothstep(t, a * 0.6, b)
      this.group.rotation.y = this.yaw
      const chain = HOP_CHAIN_S / this.hopSpeed
      if (t >= chain || (t >= b && !this.hops.length)) {
        this.hop = null
        if (!this.hops.length) this.onArrive()
      }
    }
    if (!this.hop && this.hops.length) {
      const next = this.hops.shift()!
      const to = bl(next[0], next[1], 0)
      to.y = this.floor.at(to.x, to.z)
      const dir = Math.atan2(to.x - this.group.position.x, to.z - this.group.position.z)
      this.startHop(to, dir, 1)
      return
    }
    // standing: turn toward what he should face (small turns shuffle, large ones hop in place)
    if (!this.hop && this.faceYaw !== null && !this.animator.busy) {
      const d = shortestAngle(this.yaw, this.faceYaw)
      if (Math.abs(d) > THREE.MathUtils.degToRad(TURN_IN_PLACE_DEG)) {
        this.hopSpeed = HOP.near.speed
        this.startHop(this.group.position.clone(), this.yaw + THREE.MathUtils.clamp(d, -1.1, 1.1), 0.55)
      } else if (Math.abs(d) > 0.01) {
        this.yaw += d * Math.min(1, this.stepDt * 1.5)
        this.group.rotation.y = this.yaw
      }
    }
  }

  private mustTurnFirst() {
    if (this.faceYaw === null) return false
    return Math.abs(shortestAngle(this.yaw, this.faceYaw)) > THREE.MathUtils.degToRad(TURN_BEFORE_GESTURE_DEG)
  }

  private startHop(to: THREE.Vector3, toYaw: number, weight: number) {
    const s = 1 / this.hopSpeed
    this.hop = {
      from: this.group.position.clone(),
      to,
      fromYaw: this.yaw,
      toYaw,
      start: this.clock,
      air: [BOUNCE.push * s, BOUNCE.landing * s],
    }
    this.animator.play("Bounce", { fadeInMs: 60, timeScale: this.hopSpeed, weight })
  }
}
