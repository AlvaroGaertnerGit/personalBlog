// Scope's step: a procedural layer on the APPROVED bones, written after the
// mixer and before the secondary layer (so the antenna spring feels it). It
// never touches the GLB, the rig, the clips or the face: only
//
//   hop     lift (pivot on the ground)
//   squash  squash & stretch at constant volume (x, z = 1/√y), as the rig defines
//   body    lean and sway (pitch/roll), pivot in the shell's centre, like the
//           approved clips: the feet stay planted and the legs bend (leaning on
//           `hop` instead pivots on the ground and sinks the feet on one side)
//   feet    foot.FL/FR/BL/BR: lift and swing, diagonal pairs, front feet a
//           little ahead ("patas desfasadas", like the approved Bounce)
//
// Every amount goes through a damped spring, so starting, stopping and
// switching gait are continuous: nothing pops, and stopping overshoots a
// little (the weight settles). Limits stay inside what the approved clips
// already do (Bounce: squash 0.91–1.07, 11 mm of flight).
//
// Gaits ("pasito con balanceo", Fase A §4.9):
//   walk   diagonal steps, almost no flight; the sway leads
//   trot   quicker, shorter steps with a little lift
//   bound  small hops (flight 7 mm), squash on take-off and landing
// Stepping on the spot turns him; a foot in stance moves back at the body's
// speed, so it stays planted on the ground instead of sliding.

import * as THREE from "three"

import type { Gait, LocoPhase } from "./locomotor.ts"

export interface GaitPose {
  /** 0..1: gather himself (squash down). */
  crouch: number
  /** Degrees, + = forward. */
  lean: number
  /** Metres the body sinks while the feet stay on the ground (sitting). */
  lower: number
  /** Degrees of roll (a wiggle while settling). */
  roll: number
  /** Metres of hop (stepping up). */
  lift: number
}

export const NEUTRAL_POSE: GaitPose = { crouch: 0, lean: 0, lower: 0, roll: 0, lift: 0 }

export interface GaitInput {
  speed: number
  yawRate: number
  accel: number
  phase: LocoPhase
  gait: Gait
  pose: GaitPose
  /** Reduced motion: hold the rest pose. */
  still: boolean
}

interface StepSpec {
  footLift: number
  bob: number
  sway: number
  minPeriod: number
  maxPeriod: number
  strike: number
}

/** Longest foot swing (m, each way from rest): the legs are ~2 cm, keep the bend organic. */
const SWING_MAX = 0.009
const STEPS: Record<"walk" | "trot" | "turn", StepSpec> = {
  walk: { footLift: 0.0035, bob: 0.0012, sway: 3.0, minPeriod: 0.46, maxPeriod: 0.7, strike: 0.12 },
  trot: { footLift: 0.0045, bob: 0.0024, sway: 2.0, minPeriod: 0.28, maxPeriod: 0.46, strike: 0.2 },
  turn: { footLift: 0.003, bob: 0.001, sway: 2.2, minPeriod: 0.42, maxPeriod: 0.42, strike: 0.1 },
}
const BOUND = { period: 0.27, contact: 0.3, flight: 0.007, takeoff: 0.95, landing: 0.94, tuck: 0.0025 }
const FEET = [
  { name: "footFL", pair: 0, front: true },
  { name: "footBR", pair: 0, front: false },
  { name: "footFR", pair: 1, front: true },
  { name: "footBL", pair: 1, front: false },
] as const
const FRONT_LEAD = 0.06
/** How far the skirt's low edge sits from the body's pivot, sideways and fore-aft (m): from the shell's size, checked with lowestShellMm. */
const SKIRT = { halfWidth: 0.05, halfDepth: 0.035 }
const DEG = Math.PI / 180

class Spring {
  x: number
  v = 0
  private readonly k: number
  private readonly c: number

  constructor(x: number, hz: number, zeta: number) {
    this.x = x
    this.k = (2 * Math.PI * hz) ** 2
    this.c = 2 * zeta * Math.sqrt(this.k)
  }

  step(target: number, dt: number) {
    for (let t = 0; t < dt - 1e-9; t += 1 / 240) {
      const h = Math.min(1 / 240, dt - t)
      this.v += (this.k * (target - this.x) - this.c * this.v) * h
      this.x += this.v * h
    }
    return this.x
  }
}

/** three's mixer only writes a property when the clip's value changes: remember the clip's own value. */
class LayeredBone {
  readonly bone: THREE.Bone
  private readonly pos = new THREE.Vector3()
  private readonly q = new THREE.Quaternion()
  private readonly s = new THREE.Vector3()
  private wPos: THREE.Vector3 | null = null
  private wQ: THREE.Quaternion | null = null
  private wS: THREE.Vector3 | null = null

  constructor(bone: THREE.Bone) {
    this.bone = bone
    this.pos.copy(bone.position)
    this.q.copy(bone.quaternion)
    this.s.copy(bone.scale)
  }

  base() {
    const b = this.bone
    if (!this.wPos || !b.position.equals(this.wPos)) this.pos.copy(b.position)
    if (!this.wQ || !b.quaternion.equals(this.wQ)) this.q.copy(b.quaternion)
    if (!this.wS || !b.scale.equals(this.wS)) this.s.copy(b.scale)
    return { pos: this.pos, q: this.q, s: this.s }
  }

  write(pos: THREE.Vector3, q: THREE.Quaternion, s: THREE.Vector3) {
    const b = this.bone
    b.position.copy(pos)
    b.quaternion.copy(q)
    b.scale.copy(s)
    this.wPos = (this.wPos ?? new THREE.Vector3()).copy(pos)
    this.wQ = (this.wQ ?? new THREE.Quaternion()).copy(q)
    this.wS = (this.wS ?? new THREE.Vector3()).copy(s)
  }
}

export interface GaitReadout {
  mode: string
  phase: number
  squash: number
  leanDeg: number
  rollDeg: number
  liftMm: number
  /** Extremes reached since load (validation: inside the approved clips' range). */
  range: { squashMin: number; squashMax: number; liftMaxMm: number; leanMaxDeg: number }
}

export class GaitLayer {
  enabled = true
  readonly readout: GaitReadout = {
    mode: "still",
    phase: 0,
    squash: 1,
    leanDeg: 0,
    rollDeg: 0,
    liftMm: 0,
    range: { squashMin: 1, squashMax: 1, liftMaxMm: 0, leanMaxDeg: 0 },
  }
  /** The locomotor reads this: speed multiplier of the bound (slow on the ground, fast in the air). */
  speedFactor = 1
  /** Fired at every foot strike / landing (sound, dust, tests). */
  onStrike: (strength: number) => void = () => {}

  private readonly hop: LayeredBone
  private readonly squash: LayeredBone
  private readonly body: LayeredBone
  private readonly feet: { layer: LayeredBone; pair: number; front: boolean }[]
  private phase = 0
  private boundPhase = 0
  private amount = 0
  private boundAmount = 0
  private lastPairHalf = 0
  private lastBoundContact = true
  private readonly pitch = new Spring(0, 3.2, 0.55)
  private readonly roll = new Spring(0, 3.6, 0.5)
  private readonly squashS = new Spring(1, 4.2, 0.38)
  private readonly bob = new Spring(0, 9, 0.7)
  private readonly lower = new Spring(0, 2.2, 0.85)
  private readonly liftS = new Spring(0, 5, 0.6)
  private readonly v = new THREE.Vector3()
  private readonly q = new THREE.Quaternion()
  private readonly e = new THREE.Euler(0, 0, 0, "YXZ")
  private readonly qLean = new THREE.Quaternion()
  private readonly sc = new THREE.Vector3()

  constructor(root: THREE.Object3D) {
    const bone = (name: string) => {
      const b = root.getObjectByName(name)
      if (!(b instanceof THREE.Bone)) throw new Error(`Scope rig: no ${name} bone`)
      return new LayeredBone(b)
    }
    this.hop = bone("hop")
    this.squash = bone("squash")
    this.body = bone("body")
    this.feet = FEET.map((f) => ({ layer: bone(f.name), pair: f.pair, front: f.front }))
  }

  apply(dt: number, input: GaitInput) {
    const on = this.enabled && !input.still
    const moving = input.phase === "move" && input.speed > 0.004
    const turning = input.phase === "turn"
    const bounding = on && moving && input.gait === "bound"
    const stepping = on && (moving || turning) && !bounding
    const ease = 1 - Math.exp(-dt / 0.1)
    this.amount += ((stepping ? 1 : 0) - this.amount) * ease
    this.boundAmount += ((bounding ? 1 : 0) - this.boundAmount) * (1 - Math.exp(-dt / 0.07))

    // --- diagonal steps -------------------------------------------------------------
    const spec = turning ? STEPS.turn : input.gait === "walk" ? STEPS.walk : STEPS.trot
    const speed = moving ? input.speed : 0
    const period = THREE.MathUtils.clamp(speed > 1e-3 ? (4 * SWING_MAX) / speed : spec.maxPeriod, spec.minPeriod, spec.maxPeriod)
    if (this.amount > 0.01 || stepping) this.phase = (this.phase + dt / period) % 1
    // stance length: what the body travels while a foot is down (so it does not slide)
    const stride = Math.min(2 * SWING_MAX, (speed * period) / 2)
    const half = this.phase < 0.5 ? 0 : 1
    if (half !== this.lastPairHalf && this.amount > 0.3) this.strike(spec.strike * this.amount)
    this.lastPairHalf = half

    // --- bound -------------------------------------------------------------------------
    let flight = 0
    this.speedFactor = 1
    if (bounding || this.boundAmount > 0.01) {
      this.boundPhase = (this.boundPhase + dt / BOUND.period) % 1
      const contact = this.boundPhase < BOUND.contact
      if (contact && !this.lastBoundContact) this.squashS.v -= 0.9 * this.boundAmount // landing
      if (!contact && this.lastBoundContact) this.squashS.v += 0.5 * this.boundAmount // take-off
      if (contact !== this.lastBoundContact && contact) this.onStrike(0.3 * this.boundAmount)
      this.lastBoundContact = contact
      const u = contact ? 0 : (this.boundPhase - BOUND.contact) / (1 - BOUND.contact)
      flight = Math.sin(Math.PI * u) * BOUND.flight * this.boundAmount
      this.speedFactor = contact ? 0.45 : 1.236
      this.speedFactor = 1 + (this.speedFactor - 1) * this.boundAmount
    } else {
      this.boundPhase = 0
      this.lastBoundContact = true
    }

    // --- body: lean with speed and acceleration, sway with the steps, into the curve --
    const pose = input.pose
    const leanTarget = on
      ? THREE.MathUtils.clamp(18 * speed + 5 * THREE.MathUtils.clamp(input.accel, -1, 1) + pose.lean - (input.phase === "gather" ? 2.5 : 0), -5, 9)
      : 0
    const sway = spec.sway * this.amount * Math.sin(2 * Math.PI * this.phase)
    const turnLean = on ? THREE.MathUtils.clamp(-8 * speed * input.yawRate, -4, 4) : 0
    const pitch = this.pitch.step(leanTarget, dt)
    const roll = this.roll.step(on ? sway + turnLean + pose.roll : 0, dt)
    const crouch = on ? Math.max(pose.crouch, input.phase === "gather" ? 0.55 : 0) : 0
    const squashTarget = 1 - 0.06 * crouch - (bounding ? 0.01 : 0)
    const squash = THREE.MathUtils.clamp(this.squashS.step(squashTarget, dt), BOUND.landing - 0.01, 1.06)
    const bobTarget = on ? spec.bob * this.amount * (0.5 - 0.5 * Math.cos(4 * Math.PI * this.phase)) : 0
    const bob = this.bob.step(bobTarget, dt)
    const lower = this.lower.step(on ? pose.lower : 0, dt)
    const lift = this.liftS.step(on ? pose.lift : 0, dt)

    // hop: lift. A lean or sway tips the skirt's low edge down on one side (it is
    // partly weighted to `body`): the body rises just enough, the feet stay down
    const tilt = SKIRT.halfWidth * Math.abs(Math.sin(roll * DEG)) + SKIRT.halfDepth * Math.abs(Math.sin(pitch * DEG))
    const hb = this.hop.base()
    this.v.copy(hb.pos)
    this.v.y += bob + lift + flight - lower + tilt
    this.hop.write(this.v, hb.q, hb.s)

    // body: the clip's pose · lean · sway
    const bb = this.body.base()
    this.e.set(pitch * DEG, 0, roll * DEG)
    this.q.copy(bb.q).multiply(this.qLean.setFromEuler(this.e))
    this.body.write(bb.pos, this.q, bb.s)

    // squash: constant volume
    const sb = this.squash.base()
    const side = 1 / Math.sqrt(squash)
    this.sc.set(sb.s.x * side, sb.s.y * squash, sb.s.z * side)
    this.squash.write(sb.pos, sb.q, this.sc)

    // feet: swing forward in the air, move back with the ground in stance; when the
    // body sinks or flies, the feet stay on (or reach for) the ground
    for (const f of this.feet) {
      const b = f.layer.base()
      let footLift = 0
      let swing = 0
      if (this.amount > 0.001) {
        const p = (this.phase + (f.pair ? 0.5 : 0) + (f.front ? FRONT_LEAD : 0)) % 1
        if (p < 0.5) {
          const u = p / 0.5
          footLift = Math.sin(Math.PI * u) * spec.footLift * this.amount
          swing = stride * (-0.5 + u * u * (3 - 2 * u))
        } else {
          swing = stride * (0.5 - (p - 0.5) / 0.5)
        }
        swing *= this.amount
      }
      // stance feet stay on the ground while the body bobs or sinks (squash space: ÷ scale);
      // in a bound's flight they go with the body, tucked a little
      const ground = (lower - bob - tilt) / squash
      const tuck = (BOUND.tuck * flight) / BOUND.flight
      this.v.set(b.pos.x, b.pos.y + footLift + ground + tuck, b.pos.z + swing)
      f.layer.write(this.v, b.q, b.s)
    }

    const r = this.readout
    r.mode = bounding ? "bound" : turning ? "turn" : moving ? input.gait : input.phase === "gather" ? "gather" : "still"
    r.phase = this.phase
    r.squash = squash
    r.leanDeg = pitch
    r.rollDeg = roll
    r.liftMm = (bob + lift + flight) * 1000
    r.range.squashMin = Math.min(r.range.squashMin, squash)
    r.range.squashMax = Math.max(r.range.squashMax, squash)
    r.range.liftMaxMm = Math.max(r.range.liftMaxMm, r.liftMm)
    r.range.leanMaxDeg = Math.max(r.range.leanMaxDeg, Math.abs(pitch))
  }

  private strike(strength: number) {
    this.squashS.v -= strength
    this.onStrike(strength)
  }
}
