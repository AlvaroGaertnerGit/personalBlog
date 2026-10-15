// The visitor's camera. Three ideas, chosen over free orbit or a scroll-bound
// film (README §3):
//
//   route     a continuous path through the places of the S-route (the
//             stations), authored from the cameras of the approved renders.
//             Wheel / swipe / keys / the route buttons move ALONG it; when
//             input stops it eases to the nearest station, so every rest
//             frame is a composed one. It never moves on its own.
//   parallax  the pointer shifts the camera a few centimetres in its own
//             plane (real 3D parallax: near sheets slide over far ones).
//   focus     an off-route pose (MathView up close) blended in and out, so
//             opening a project and coming back is one continuous move.
//
// All motion is critically damped springs with frame-rate-independent
// sub-steps. Reduced motion: no flights — the canvas fades, the camera cuts.

import * as THREE from "three"

import { bl, type BlPoint } from "../world/world-data.ts"

export interface Station {
  id: string
  label: string
  pos: BlPoint
  target: BlPoint
  /** Focal length (mm, 36 mm sensor), as in the Blender shots. */
  lens: number
  /** A camera of its own for portrait screens (else: the same view, stepped back). */
  portrait?: { pos: BlPoint; target: BlPoint; lens: number }
}

const PORTRAIT_BELOW = 0.8
const PORTRAIT_STEP_BACK = 1.35

function portraitOf(s: Station): { pos: BlPoint; target: BlPoint; lens: number } {
  if (s.portrait) return s.portrait
  const back = (i: number) => s.target[i] + (s.pos[i] - s.target[i]) * PORTRAIT_STEP_BACK
  return { pos: [back(0), back(1), back(2)], target: s.target, lens: s.lens }
}

export interface CameraPose {
  pos: THREE.Vector3
  target: THREE.Vector3
  lens: number
  /** Where the picture's centre sits (fraction of the viewport), e.g. beside an open panel. */
  shift?: { x: number; y: number }
}

const SETTLE_AFTER_MS = 650
const PARALLAX = 0.045 // fraction of the camera-target distance

function lensToVFov(lens: number, aspect: number) {
  // Blender sensor fit AUTO: the 36 mm sensor spans the longer side
  const half = 18 / lens
  const vHalf = aspect >= 1 ? half / aspect : half
  return THREE.MathUtils.radToDeg(2 * Math.atan(vHalf))
}

/** Critically damped spring on a scalar. */
class Spring {
  value: number
  velocity = 0
  target: number
  omega: number

  constructor(value: number, omega: number) {
    this.value = value
    this.target = value
    this.omega = omega
  }

  step(dt: number) {
    const h = 1 / 240
    for (let t = 0; t < dt; t += h) {
      const s = Math.min(h, dt - t)
      const a = this.omega * this.omega * (this.target - this.value) - 2 * this.omega * this.velocity
      this.velocity += a * s
      this.value += this.velocity * s
    }
  }

  snap(v: number) {
    this.value = this.target = v
    this.velocity = 0
  }
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  readonly stations: Station[]
  /** Fired when the camera comes to rest at a station (index). */
  onArrive: (index: number) => void = () => {}

  private posCurve!: THREE.CatmullRomCurve3
  private targetCurve!: THREE.CatmullRomCurve3
  private lenses: number[] = []
  private portrait: boolean | null = null
  private readonly s: Spring
  private readonly focusW = new Spring(0, 2.6)
  private readonly introW = new Spring(0, 1.9)
  private readonly px = new Spring(0, 4)
  private readonly py = new Spring(0, 4)
  private focusPose: CameraPose | null = null
  private introPose: CameraPose | null = null
  private lastInput = -Infinity
  private arrived = -1
  private reduced = false
  private readonly tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }

  constructor(stations: Station[], aspect: number) {
    this.stations = stations
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.004, 30)
    this.s = new Spring(0, 2.3)
    this.buildCurves(aspect)
  }

  get position() {
    return this.s.value
  }

  get goal() {
    return this.s.target
  }

  get nearest() {
    return Math.round(THREE.MathUtils.clamp(this.s.target, 0, this.stations.length - 1))
  }

  /** At rest: no route motion, no focus/intro blend in flight. */
  get settled() {
    return (
      Math.abs(this.s.value - this.s.target) < 0.004 &&
      Math.abs(this.s.velocity) < 0.01 &&
      Math.abs(this.focusW.value - this.focusW.target) < 0.01 &&
      Math.abs(this.introW.value - this.introW.target) < 0.01
    )
  }

  get focusAmount() {
    return this.focusW.value
  }

  setReducedMotion(on: boolean) {
    this.reduced = on
  }

  /** Continuous input along the route (wheel, swipe), in stations. */
  nudge(delta: number, now: number) {
    if (this.focusW.target > 0) return
    const max = this.stations.length - 1
    this.s.target = THREE.MathUtils.clamp(this.s.target + delta, 0, max)
    this.lastInput = now
    if (this.reduced) this.s.snap(Math.round(this.s.target))
  }

  /** Go to a station (buttons, keys). Returns false if already there. */
  goTo(index: number, now: number) {
    const i = THREE.MathUtils.clamp(index, 0, this.stations.length - 1)
    if (Math.abs(this.s.target - i) < 0.01 && this.focusW.target === 0) return false
    this.s.target = i
    this.lastInput = now - SETTLE_AFTER_MS // a button press is already a decision
    if (this.reduced) this.s.snap(i)
    return true
  }

  /** Blend toward an off-route pose (null = back to the route). */
  focus(pose: CameraPose | null) {
    if (pose) this.focusPose = pose
    this.focusW.target = pose ? 1 : 0
    if (this.reduced) this.focusW.snap(this.focusW.target)
  }

  /** The entry pose (in front of Scope); released with `releaseIntro()`. */
  holdIntro(pose: CameraPose) {
    this.introPose = pose
    this.introW.snap(1)
  }

  releaseIntro() {
    this.introW.target = 0
    if (this.reduced) this.introW.snap(0)
  }

  /** Pointer in -1..1 (0 = centre). */
  setPointer(x: number, y: number) {
    this.px.target = this.reduced ? 0 : x
    this.py.target = this.reduced ? 0 : y
  }

  /** Landscape uses the renders' cameras; portrait the phone ones (rebuilt only when it flips). */
  private buildCurves(aspect: number) {
    const portrait = aspect < PORTRAIT_BELOW
    if (portrait === this.portrait) return
    this.portrait = portrait
    const set = this.stations.map((s) => (portrait ? portraitOf(s) : s))
    this.posCurve = new THREE.CatmullRomCurve3(set.map((s) => bl(...s.pos)), false, "centripetal")
    this.targetCurve = new THREE.CatmullRomCurve3(set.map((s) => bl(...s.target)), false, "centripetal")
    this.lenses = set.map((s) => s.lens)
  }

  resize(width: number, height: number) {
    this.buildCurves(width / height)
    this.camera.aspect = width / height
    this.width = width
    this.height = height
  }

  private width = 1
  private height = 1

  update(dt: number, now: number) {
    // settle on the nearest station once the visitor stops
    if (now - this.lastInput > SETTLE_AFTER_MS) {
      const near = Math.round(this.s.target)
      if (Math.abs(near - this.s.target) > 1e-3) this.s.target = near
    }
    this.s.step(dt)
    this.focusW.step(dt)
    this.introW.step(dt)
    this.px.step(dt)
    this.py.step(dt)
    if (this.settled) {
      const at = Math.round(this.s.value)
      if (at !== this.arrived && this.focusW.target === 0) {
        this.arrived = at
        this.onArrive(at)
      }
    } else if (Math.abs(this.s.value - Math.round(this.s.value)) > 0.05) {
      this.arrived = -1
    }

    const max = this.stations.length - 1
    const s = THREE.MathUtils.clamp(this.s.value, 0, max)
    const u = s / max
    const pos = this.posCurve.getPoint(u, this.tmp.a)
    const target = this.targetCurve.getPoint(u, this.tmp.b)
    const i = Math.min(Math.floor(s), max - 1)
    let lens = THREE.MathUtils.lerp(this.lenses[i], this.lenses[i + 1], THREE.MathUtils.smoothstep(s - i, 0, 1))

    for (const [pose, w] of [
      [this.focusPose, this.focusW.value],
      [this.introPose, this.introW.value],
    ] as const) {
      if (!pose || w <= 1e-4) continue
      const k = THREE.MathUtils.clamp(w, 0, 1)
      // arc slightly upward between the two poses, so the move reads as a crane, not a zoom
      const lift = Math.sin(Math.PI * k) * 0.06 * pos.distanceTo(pose.pos)
      pos.lerp(pose.pos, k).y += lift
      target.lerp(pose.target, k)
      lens = THREE.MathUtils.lerp(lens, pose.lens, k)
    }

    // pointer parallax in the camera's own plane
    const dist = pos.distanceTo(target)
    const fwd = this.tmp.c.subVectors(target, pos).normalize()
    const right = new THREE.Vector3().crossVectors(fwd, THREE.Object3D.DEFAULT_UP).normalize()
    const up = new THREE.Vector3().crossVectors(right, fwd)
    const amount = PARALLAX * dist * (1 - 0.7 * this.focusW.value)
    pos.addScaledVector(right, this.px.value * amount).addScaledVector(up, -this.py.value * amount * 0.6)
    target.addScaledVector(right, this.px.value * amount * 0.25)
    // never below the paper
    pos.y = Math.max(pos.y, 0.012)

    this.camera.position.copy(pos)
    this.camera.lookAt(target)
    this.camera.fov = lensToVFov(lens, this.camera.aspect)
    // the picture's centre moves (not the camera) when a panel covers part of the screen
    let sx = 0
    let sy = 0
    for (const [pose, w] of [
      [this.focusPose, this.focusW.value],
      [this.introPose, this.introW.value],
    ] as const) {
      if (!pose?.shift) continue
      sx += pose.shift.x * w
      sy += pose.shift.y * w
    }
    if (Math.abs(sx) > 1e-4 || Math.abs(sy) > 1e-4) {
      this.camera.setViewOffset(this.width, this.height, -sx * this.width, -sy * this.height, this.width, this.height)
    } else if (this.camera.view) {
      this.camera.clearViewOffset()
    }
    this.camera.updateProjectionMatrix()
  }
}
