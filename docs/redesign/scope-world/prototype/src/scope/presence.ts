// Presence: Scope orients toward what he attends to, eyes first, body after,
// antenna by inertia. The design is docs/redesign/06-plan-tecnico.md §1 (the
// 2D Presence constants, converted), applied to a target in the WORLD rather
// than to the cursor on the screen:
//
//   eyes    ±4.5 mm on the curved glass, spring 260/18/0.5 (arrive ~70 ms)
//   body    `look` bone, ±10° yaw / ±8° pitch, spring 90/16/1.2 behind a 90 ms
//           lag (arrives ~250 ms after the eyes); a little roll with the yaw
//   antenna nothing here: the existing spring (scope-3d-secondary.ts) sees the
//           body's new motion and lags behind it on its own
//
// Eyes on the glass: the clips slide the eye bones over the curved glass and
// turn them with its normal (clips.py `_slide_on_glass`). The plan wants a
// 9×9 table exported from Blender; until it exists, this file FITS that
// surface from the approved clips' own baked eye tracks (least squares,
// quadratic in the offset). The fit error is measured at load and exposed in
// the debug panel. It is an approximation, declared as such in the README.

import * as THREE from "three"

const EYE_RANGE_M = 0.0045
const BODY_YAW = THREE.MathUtils.degToRad(10)
const BODY_PITCH = THREE.MathUtils.degToRad(8)
const BODY_LAG_S = 0.09
const SUBSTEP = 1 / 240

interface SpringConst {
  k: number
  c: number
  m: number
}
const EYE_SPRING: SpringConst = { k: 260, c: 18, m: 0.5 }
const BODY_SPRING: SpringConst = { k: 90, c: 16, m: 1.2 }

class Spring2 {
  readonly x = new THREE.Vector2()
  readonly v = new THREE.Vector2()
  private readonly s: SpringConst

  constructor(s: SpringConst) {
    this.s = s
  }

  step(target: THREE.Vector2, dt: number) {
    const { k, c, m } = this.s
    for (let t = 0; t < dt - 1e-9; t += SUBSTEP) {
      const h = Math.min(SUBSTEP, dt - t)
      const ax = (k * (target.x - this.x.x) - c * this.v.x) / m
      const ay = (k * (target.y - this.x.y) - c * this.v.y) / m
      this.v.x += ax * h
      this.v.y += ay * h
      this.x.addScaledVector(this.v, h)
    }
  }
}

/** Least squares of y ≈ Σ wᵢ·fᵢ(dx, dy), f = [1, dx, dy, dx², dy², dx·dy]. */
function fitQuadratic(samples: { dx: number; dy: number; y: number }[]) {
  const f = (dx: number, dy: number) => [1, dx, dy, dx * dx, dy * dy, dx * dy]
  const n = 6
  const A = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0))
  for (const s of samples) {
    const row = f(s.dx, s.dy)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += row[i] * row[j]
      A[i][n] += row[i] * s.y
    }
  }
  for (let i = 0; i < n; i++) A[i][i] += 1e-12 // ridge: some clips never move the eyes vertically
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    ;[A[col], A[piv]] = [A[piv], A[col]]
    for (let r = 0; r < n; r++) {
      if (r === col || A[col][col] === 0) continue
      const k = A[r][col] / A[col][col]
      for (let c = col; c <= n; c++) A[r][c] -= k * A[col][c]
    }
  }
  const w = A.map((row, i) => (row[i] === 0 ? 0 : row[n] / row[i]))
  return (dx: number, dy: number) => f(dx, dy).reduce((s, v, i) => s + v * w[i], 0)
}

/** The glass surface one eye slides on, fitted from the clips. */
class EyeSurface {
  readonly bone: THREE.Bone
  readonly rest = new THREE.Vector3()
  private readonly dz: (dx: number, dy: number) => number
  private readonly rot: ((dx: number, dy: number) => number)[]
  /** RMS error of the fit over the clip samples (m, rad). */
  readonly error: { position: number; rotation: number; samples: number }

  constructor(bone: THREE.Bone, clips: THREE.AnimationClip[]) {
    this.bone = bone
    this.rest.copy(bone.position)
    const pos: number[][] = []
    const quat: number[][] = []
    for (const clip of clips) {
      const p = clip.tracks.find((t) => t.name === `${bone.name}.position`)
      const q = clip.tracks.find((t) => t.name === `${bone.name}.quaternion`)
      if (!p || !q) continue
      // the two tracks may be keyed at different times (export optimisation): sample both
      const pi = new THREE.LinearInterpolant(p.times, p.values, p.getValueSize(), new Float32Array(3))
      const qi = new THREE.QuaternionLinearInterpolant(q.times, q.values, q.getValueSize(), new Float32Array(4))
      const end = Math.max(p.times[p.times.length - 1], q.times[q.times.length - 1])
      for (let t = 0; t <= end + 1e-6; t += 1 / 30) {
        pos.push([...pi.evaluate(t)])
        const v = qi.evaluate(t)
        const n = Math.hypot(v[0], v[1], v[2], v[3]) || 1
        quat.push([v[0] / n, v[1] / n, v[2] / n, v[3] / n])
      }
    }
    const samples = pos.map((p, i) => {
      const q = quat[i]
      const s = q[3] < 0 ? -2 : 2 // small-angle rotation vector
      return { dx: p[0] - this.rest.x, dy: p[1] - this.rest.y, dz: p[2] - this.rest.z, r: [q[0] * s, q[1] * s, q[2] * s] }
    })
    this.dz = fitQuadratic(samples.map((s) => ({ dx: s.dx, dy: s.dy, y: s.dz })))
    this.rot = [0, 1, 2].map((k) => fitQuadratic(samples.map((s) => ({ dx: s.dx, dy: s.dy, y: s.r[k] }))))
    let ep = 0
    let er = 0
    for (const s of samples) {
      ep += (this.dz(s.dx, s.dy) - s.dz) ** 2
      er += this.rot.reduce((acc, f, k) => acc + (f(s.dx, s.dy) - s.r[k]) ** 2, 0)
    }
    const n = Math.max(1, samples.length)
    this.error = { position: Math.sqrt(ep / n), rotation: Math.sqrt(er / n), samples: samples.length }
  }

  /** Offset (from rest) and rotation for a gaze of (dx, dy) metres on the glass. */
  pose(dx: number, dy: number, outOffset: THREE.Vector3, outQ: THREE.Quaternion) {
    outOffset.set(dx, dy, this.dz(dx, dy) - this.dz(0, 0))
    const r = this.rot.map((f) => f(dx, dy) - f(0, 0))
    const angle = Math.hypot(r[0], r[1], r[2])
    if (angle < 1e-8) outQ.identity()
    else outQ.setFromAxisAngle(new THREE.Vector3(r[0] / angle, r[1] / angle, r[2] / angle), angle)
  }
}

/**
 * three's mixer only writes a property when the clip's value CHANGES: on a
 * constant track it writes once. Anything layered on top must remember the
 * clip's value (same rule as scope-3d-secondary.ts `Layered`, not exported).
 */
class LayeredTRS {
  private readonly clipPos = new THREE.Vector3()
  private readonly clipQ = new THREE.Quaternion()
  private writtenPos: THREE.Vector3 | null = null
  private writtenQ: THREE.Quaternion | null = null

  constructor(bone: THREE.Bone) {
    this.clipPos.copy(bone.position)
    this.clipQ.copy(bone.quaternion)
  }

  base(bone: THREE.Bone) {
    if (!this.writtenPos || !bone.position.equals(this.writtenPos)) this.clipPos.copy(bone.position)
    if (!this.writtenQ || !bone.quaternion.equals(this.writtenQ)) this.clipQ.copy(bone.quaternion)
    return { pos: this.clipPos, q: this.clipQ }
  }

  write(bone: THREE.Bone, pos: THREE.Vector3, q: THREE.Quaternion) {
    bone.position.copy(pos)
    bone.quaternion.copy(q)
    this.writtenPos = (this.writtenPos ?? new THREE.Vector3()).copy(pos)
    this.writtenQ = (this.writtenQ ?? new THREE.Quaternion()).copy(q)
  }
}

export interface PresenceReadout {
  yawDeg: number
  pitchDeg: number
  eyeMm: [number, number]
  /** Angle (deg) from Scope's facing to the target: > ~35° means he should turn. */
  offAxisDeg: number
}

export class Presence {
  /** World-space point to attend to, or null (back to rest). */
  target: THREE.Vector3 | null = null
  /** Requested layer weights (eased here, ~0.4 s). */
  weight = { eyes: 0, body: 0 }

  readonly fit: { left: EyeSurface["error"]; right: EyeSurface["error"] } | null
  readonly readout: PresenceReadout = { yawDeg: 0, pitchDeg: 0, eyeMm: [0, 0], offAxisDeg: 0 }

  private readonly frame: THREE.Object3D
  private readonly look: THREE.Bone
  private readonly head: THREE.Object3D
  private readonly eyes: { surface: EyeSurface; layered: LayeredTRS }[]
  private readonly eyeSpring = new Spring2(EYE_SPRING)
  private readonly bodySpring = new Spring2(BODY_SPRING)
  private readonly bodyLagged = new THREE.Vector2()
  private readonly w = { eyes: 0, body: 0 }
  private clock = 0
  // scratch
  private readonly v = new THREE.Vector3()
  private readonly v2 = new THREE.Vector3()
  private readonly q = new THREE.Quaternion()
  private readonly q2 = new THREE.Quaternion()
  private readonly e = new THREE.Euler(0, 0, 0, "YXZ")
  private readonly goalEye = new THREE.Vector2()
  private readonly goalBody = new THREE.Vector2()

  /** `frame` = the object that places Scope in the world (its yaw is his facing). */
  constructor(frame: THREE.Object3D, root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.frame = frame
    const look = root.getObjectByName("look")
    const body = root.getObjectByName("body")
    if (!(look instanceof THREE.Bone) || !body) throw new Error("Scope rig: no look/body bone")
    this.look = look
    this.head = body
    const bones = ["eyeL", "eyeR"].map((n) => root.getObjectByName(n)).filter((b): b is THREE.Bone => b instanceof THREE.Bone)
    this.eyes = bones.map((b) => ({ surface: new EyeSurface(b, clips), layered: new LayeredTRS(b) }))
    this.fit = this.eyes.length === 2 ? { left: this.eyes[0].surface.error, right: this.eyes[1].surface.error } : null
  }

  /**
   * Called right after Scope3DSecondary.applyDrift() has written `look = rest ·
   * drift`, before the antenna spring runs (so the spring feels this motion).
   * `damp` (0..1): how much a playing clip quiets the layer (plan §1.4).
   */
  apply(dt: number, damp: { eyes: number; body: number }) {
    this.clock += dt
    const ease = 1 - Math.exp(-dt / 0.16)
    this.w.eyes += (this.weight.eyes * damp.eyes - this.w.eyes) * ease
    this.w.body += (this.weight.body * damp.body - this.w.body) * ease

    // direction to the target in Scope's frame (x = his left, y = up, z = forward)
    let yaw = 0
    let pitch = 0
    if (this.target) {
      this.head.getWorldPosition(this.v)
      this.v2.copy(this.target).sub(this.v)
      this.frame.getWorldQuaternion(this.q).invert()
      this.v2.applyQuaternion(this.q)
      yaw = Math.atan2(this.v2.x, this.v2.z)
      pitch = Math.atan2(this.v2.y, Math.hypot(this.v2.x, this.v2.z))
    }
    this.readout.offAxisDeg = THREE.MathUtils.radToDeg(Math.abs(yaw))
    // tanh: near-linear in front of him, saturating smoothly — never past the rig's range
    const has = this.target ? 1 : 0
    this.goalEye.set(Math.tanh(yaw / 0.42) * has, Math.tanh(pitch / 0.36) * has)
    // micro-movement of the eyes (0.3 mm, 5.2 s / 6.3 s), so a held gaze stays alive
    this.goalEye.x += (0.3 / 4.5) * Math.sin((2 * Math.PI * this.clock) / 5.2)
    this.goalEye.y += (0.3 / 4.5) * Math.sin((2 * Math.PI * this.clock) / 6.3 + 1.3)
    this.goalBody.set(Math.tanh(yaw / 0.5) * has, Math.tanh(pitch / 0.45) * has)
    const lag = 1 - Math.exp(-dt / BODY_LAG_S)
    this.bodyLagged.lerp(this.goalBody, lag)
    this.eyeSpring.step(this.goalEye, dt)
    this.bodySpring.step(this.bodyLagged, dt)

    // body: look = (rest · drift) · presence
    const by = this.bodySpring.x.x * BODY_YAW * this.w.body
    const bp = this.bodySpring.x.y * BODY_PITCH * this.w.body
    this.e.set(-bp, by, -by * 0.15)
    this.look.quaternion.multiply(this.q2.setFromEuler(this.e))

    // eyes: clip pose + gaze on the glass
    const ex = THREE.MathUtils.clamp(this.eyeSpring.x.x, -1, 1) * EYE_RANGE_M * this.w.eyes
    const ey = THREE.MathUtils.clamp(this.eyeSpring.x.y, -1, 1) * EYE_RANGE_M * 0.7 * this.w.eyes
    for (const { surface, layered } of this.eyes) {
      const base = layered.base(surface.bone)
      surface.pose(ex, ey, this.v, this.q)
      this.v.add(base.pos)
      this.q.premultiply(base.q)
      layered.write(surface.bone, this.v, this.q)
    }
    this.readout.yawDeg = THREE.MathUtils.radToDeg(by)
    this.readout.pitchDeg = THREE.MathUtils.radToDeg(bp)
    this.readout.eyeMm = [ex * 1000, ey * 1000]
  }
}
