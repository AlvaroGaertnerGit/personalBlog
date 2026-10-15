// The visitor: a camera that travels the lab's route. `s` runs from 0 (the
// lantern) to 4 (the radiometer); the wheel, a swipe, ← → or the place buttons
// move its target and a critically damped spring moves the camera, so the
// visitor's speed (what Scope perceives) is continuous. Released, the wheel
// settles on the nearest place, as in the 1.0 prototype. With reduced motion
// the camera cuts from place to place.

import * as THREE from "three"

import { segmentLength, type P3, type WorldDef } from "../world-def.ts"
import { anchorAt, nearestStation } from "../scope/mind/companion.ts"
import { bl } from "../../prototype/src/world/world-data.ts"

export class VisitorRig {
  readonly def: WorldDef
  s = 0
  sTarget = 0
  sVel = 0
  reduced = false
  portrait = false
  /** Seconds (sim clock) of the last thing the visitor did. */
  lastInputAt = 0
  private settledSince = 0
  private wheelAt = -Infinity
  private now = 0
  private cut = false

  constructor(def: WorldDef) {
    this.def = def
  }

  private get last() {
    return this.def.stations.length - 1
  }

  get settled() {
    return this.now - this.settledSince >= this.def.settledS
  }

  get zone() {
    return nearestStation(this.def, this.s)
  }

  get anchor() {
    return anchorAt(this.def, this.s)
  }

  /** True once after a reduced-motion cut (Scope is placed while the frame changes). */
  takeCut() {
    const c = this.cut
    this.cut = false
    return c
  }

  touch() {
    this.lastInputAt = this.now
  }

  goTo(i: number) {
    this.touch()
    this.sTarget = THREE.MathUtils.clamp(Math.round(i), 0, this.last)
    if (this.reduced) this.jump()
  }

  step(dir: number) {
    this.goTo(Math.round(this.sTarget) + Math.sign(dir))
  }

  wheel(delta: number) {
    this.touch()
    if (this.reduced) {
      if (this.now - this.wheelAt > 0.35) this.step(delta)
      this.wheelAt = this.now
      return
    }
    this.wheelAt = this.now
    this.sTarget = THREE.MathUtils.clamp(this.sTarget + delta * 0.0018, 0, this.last)
  }

  drag(dxFraction: number) {
    this.touch()
    this.wheelAt = this.now
    this.sTarget = THREE.MathUtils.clamp(this.sTarget - dxFraction * 2.4, 0, this.last)
  }

  private jump() {
    this.s = this.sTarget
    this.sVel = 0
    this.cut = true
  }

  update(dt: number, now: number) {
    this.now = now
    // the wheel released: settle on the nearest place
    if (now - this.wheelAt > 0.45 && Math.abs(this.sTarget - Math.round(this.sTarget)) > 1e-3) this.sTarget = Math.round(this.sTarget)
    if (!this.reduced) {
      // the spring of the segment you are in: a longer way takes a little longer
      const K = this.def.visitorStiffness(segmentLength(this.def, this.s))
      const c = 2 * Math.sqrt(K)
      for (let t = 0; t < dt - 1e-9; t += 1 / 240) {
        const h = Math.min(1 / 240, dt - t)
        this.sVel += (K * (this.sTarget - this.s) - c * this.sVel) * h
        this.s += this.sVel * h
      }
      if (Math.abs(this.sTarget - this.s) < 1e-4 && Math.abs(this.sVel) < 1e-3) {
        this.s = this.sTarget
        this.sVel = 0
      }
    }
    if (Math.abs(this.sVel) > 0.03 || Math.abs(this.sTarget - this.s) > 0.02) this.settledSince = now
  }

  /** Camera pose for the current `s` (interpolated between the places' cameras). */
  pose(camera: THREE.PerspectiveCamera, lookAt: THREE.Vector3) {
    const last = this.last
    const st = this.def.stations
    const c = THREE.MathUtils.clamp(this.s, 0, last)
    const i = Math.min(last - 1, Math.floor(c))
    const t = c - i
    const a = this.portrait ? st[i].portrait : st[i].camera
    const b = this.portrait ? st[i + 1].portrait : st[i + 1].camera
    const mix = (p: P3, q: P3) => bl(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t)
    camera.position.copy(mix(a.pos, b.pos))
    lookAt.copy(mix(a.target, b.target))
    const lens = a.lens + (b.lens - a.lens) * t
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(36 / Math.max(camera.aspect, 0.5) / 2 / lens))
    if (this.portrait) camera.fov = Math.min(camera.fov * 0.62, 75)
    camera.lookAt(lookAt)
    camera.updateProjectionMatrix()
  }
}
