// Scope 3D secondary motion — what runs on top of the baked clips, every frame,
// after the mixer:
//
//   antenna  a two-segment damped spring driven by the REAL motion of its
//            base (body turn, lean, squash, hop, the idle drift — whatever
//            produced it), so it lags, overshoots and settles the same way
//            across crossfades and interruptions, which a per-clip bake can't.
//   life     Idle's non-repeating layer: a very slow posture drift on the
//            reserved `look` bone and single soft blinks at natural, irregular
//            intervals. Both step back while a behaviour clip plays.
//
// Bone frames: three's bone axes match Scope space at rest (x = Scope's left,
// y = up, z = toward the viewer), so world-space rotations map onto bones
// through their current world orientation only.

import * as THREE from "three"

export interface Scope3DSecondaryOptions {
  /** Antenna follow-through. */
  spring: boolean
  /** Idle drift + single blinks. */
  life: boolean
  /** prefers-reduced-motion: no drift (blinks stay — they aren't motion). */
  reducedMotion: boolean
}

/**
 * three's PropertyMixer only writes a property when its mixed value CHANGES:
 * on a constant track (Idle's antenna, its closed eyes) it writes once and
 * then leaves whatever is in the scene. Anything layered on top must
 * remember the clip's own value, or it re-applies itself on its own output
 * every frame (measured: the antenna drifted 26° in a few seconds).
 */
class Layered<T extends { clone(): T; copy(v: T): T; equals(v: T): boolean }> {
  private readonly clipValue: T
  private written: T | null = null

  constructor(initial: T) {
    this.clipValue = initial.clone()
  }

  /** The clip's value: the scene's, unless the scene still holds what we wrote. */
  base(current: T) {
    if (!this.written || !current.equals(this.written)) this.clipValue.copy(current)
    return this.clipValue
  }

  write(target: T, value: T) {
    target.copy(value)
    this.written = value.clone()
  }
}

/** Scalar version of Layered, for a morph influence. */
class LayeredScalar {
  private clipValue = 0
  private written: number | null = null

  base(current: number) {
    if (current !== this.written) this.clipValue = current
    return this.clipValue
  }

  write(value: number) {
    this.written = value
    return value
  }
}

interface SpringSegment {
  bone: THREE.Bone
  rotation: Layered<THREE.Quaternion>
  /** The bone's local rotation at rest (bind pose). */
  restQ: THREE.Quaternion
  /** Tip offset in the bone's local frame (rest). */
  tipLocal: THREE.Vector3
  /** Bend (rotation vector in the parent bone's frame, rad) and its velocity. */
  theta: THREE.Vector3
  omega: THREE.Vector3
  prevTip: THREE.Vector3 | null
  prevVel: THREE.Vector3 | null
  stiffness: number
  damping: number
}

/**
 * Natural frequency (Hz) and damping ratio per segment: v1's frequencies,
 * damped a little more so the recovery is elastic but moderate (each swing
 * ~30 % of the previous one instead of ~37 %).
 */
const SEGMENTS = [
  { hz: 2.6, zeta: 0.36 },
  { hz: 3.8, zeta: 0.34 },
] as const
/**
 * Inertia gains over plain physics. The tip sits only ~1–2 cm off the turn
 * axis, so a 13° look-around barely moves it (0.6° of lag, measured): the
 * horizontal gain gives turns a gentle, visible lag; the vertical one makes a
 * hop nod the 24°-leaning stalk.
 */
const HORIZONTAL_GAIN = 0.7
const VERTICAL_GAIN = 0.45
const MAX_ANGLE = THREE.MathUtils.degToRad(20)
/** Tip accelerations above this (m/s²) are seeks or frame hitches, not motion. */
const MAX_ACCEL = 40
const SUBSTEP_S = 1 / 240

/** Posture drift: incommensurate slow sines (Hz, weight) -> never repeats, eases through pauses. */
const DRIFT_WAVES = [
  [0.061, 0.6],
  [0.097, 0.3],
  [0.153, 0.1],
] as const
const DRIFT_DEG = { yaw: 1.6, pitch: 0.7, roll: 0.5 }
/** Drift amplitude kept while a behaviour plays (the clip reads cleanly on top). */
const DRIFT_DURING_CLIPS = 0.3
/** Seconds for the life layer to step back / return when clips start / end. */
const ACTIVITY_SMOOTHING_S = 0.5

/** Single blinks: gap range (s) and lid timing (close / hold / open). */
const BLINK_GAP_S = [3.6, 8.5] as const
const BLINK = { close: 0.09, hold: 0.04, open: 0.19 }
/** Now and then a slower, tender blink. */
const SLOW_BLINK = { chance: 0.15, hold: 0.14, open: 0.28 }
/** No idle blink this soon after a clip (s): the clip's own eyes settle first. */
const BLINK_QUIET_AFTER_CLIP_S = 1.2

const UP = new THREE.Vector3(0, 1, 0)

function smooth(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export class Scope3DSecondary {
  options: Scope3DSecondaryOptions = { spring: true, life: true, reducedMotion: false }

  private readonly root: THREE.Object3D
  /** antenna.1 then antenna.2; the first one's parent is the body. */
  private readonly segments: SpringSegment[] = []
  private readonly look: THREE.Bone | null
  private readonly lookRest = new THREE.Quaternion()
  private readonly eyes: THREE.Mesh | null
  private readonly blinkIndex: number
  private readonly blinkInfluence = new LayeredScalar()
  private readonly phases: number[]
  private clock = 0
  private activity = 0
  private sinceClip = Infinity
  private nextBlinkAt: number
  private blink: { start: number; hold: number; open: number } | null = null

  // scratch
  private readonly q1 = new THREE.Quaternion()
  private readonly q2 = new THREE.Quaternion()

  private readonly random: () => number

  // No parameter properties: Node's type stripping (the node:test runs) can't erase them.
  constructor(root: THREE.Object3D, random: () => number = Math.random) {
    this.root = root
    this.random = random
    root.updateMatrixWorld(true)
    const a1 = root.getObjectByName("antenna1")
    const a2 = root.getObjectByName("antenna2")
    if (a1 instanceof THREE.Bone && a2 instanceof THREE.Bone) {
      // antenna.2 starts halfway to the ball's centre: the second segment repeats the first.
      const seg = a2.getWorldPosition(new THREE.Vector3()).sub(a1.getWorldPosition(new THREE.Vector3()))
      for (const [i, bone] of [a1, a2].entries()) {
        const { hz, zeta } = SEGMENTS[i]
        const k = (2 * Math.PI * hz) ** 2
        const inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert()
        this.segments.push({
          bone,
          rotation: new Layered(bone.quaternion),
          restQ: bone.quaternion.clone(),
          tipLocal: seg.clone().applyQuaternion(inv),
          theta: new THREE.Vector3(),
          omega: new THREE.Vector3(),
          prevTip: null,
          prevVel: null,
          stiffness: k,
          damping: 2 * zeta * Math.sqrt(k),
        })
      }
    }
    const look = root.getObjectByName("look")
    this.look = look instanceof THREE.Bone ? look : null
    if (this.look) this.lookRest.copy(this.look.quaternion)
    let eyes: THREE.Mesh | null = null
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.morphTargetDictionary?.Blink !== undefined) eyes = o
    })
    this.eyes = eyes
    this.blinkIndex = (eyes as THREE.Mesh | null)?.morphTargetDictionary?.Blink ?? -1
    this.phases = DRIFT_WAVES.map(() => random() * Math.PI * 2)
    this.nextBlinkAt = this.blinkGap()
  }

  /** Forget all motion history (after a jump in time, e.g. measuring the envelope). */
  reset() {
    for (const s of this.segments) {
      s.theta.set(0, 0, 0)
      s.omega.set(0, 0, 0)
      s.prevTip = s.prevVel = null
    }
    this.blink = null
    this.activity = 0
    // The clock may have run with life off (envelope measurement): no instant blink.
    this.nextBlinkAt = this.clock + this.blinkGap()
  }

  /**
   * Call right after the mixer has posed the rig. `dt` = the director's
   * (scaled) clock step; 0 while paused re-applies the current state.
   * `clipActive` = a behaviour clip is playing.
   */
  update(dt: number, clipActive: boolean) {
    this.clock += dt
    // Exponential approach: ~95 % of the way in ACTIVITY_SMOOTHING_S.
    this.activity += ((clipActive ? 1 : 0) - this.activity) * (1 - Math.exp((-3 * dt) / ACTIVITY_SMOOTHING_S))
    this.sinceClip = clipActive ? 0 : this.sinceClip + dt

    this.applyDrift()
    this.root.updateMatrixWorld(true)
    this.stepSprings(dt)
    this.applyBlink(clipActive)
  }

  private applyDrift() {
    if (!this.look) return
    const on = this.options.life && !this.options.reducedMotion
    if (!on) {
      this.look.quaternion.copy(this.lookRest)
      return
    }
    const amount = 1 - (1 - DRIFT_DURING_CLIPS) * this.activity
    const wave = (offset: number) =>
      DRIFT_WAVES.reduce((sum, [hz, w], i) => sum + w * Math.sin(2 * Math.PI * hz * this.clock + this.phases[i] + offset), 0)
    const rad = THREE.MathUtils.degToRad
    const e = new THREE.Euler(
      rad(DRIFT_DEG.pitch) * amount * wave(1.7),
      rad(DRIFT_DEG.yaw) * amount * wave(0),
      rad(DRIFT_DEG.roll) * amount * wave(4.1),
      "YXZ",
    )
    this.look.quaternion.copy(this.lookRest).multiply(this.q1.setFromEuler(e))
  }

  /**
   * The spring is driven by a VIRTUAL chain: the antenna at its rest pose on
   * top of the animated body. Authored
   * antenna poses (Focus perking forward, Stretch reaching up) are intended
   * motion, not inertia — feeding them in made the spring hit its 20° stop.
   * The bend is then applied on top of whatever pose the clip authored.
   */
  private stepSprings(dt: number) {
    const first = this.segments[0]
    if (!first) return
    if (!this.options.spring) {
      for (const seg of this.segments) {
        seg.theta.set(0, 0, 0)
        seg.omega.set(0, 0, 0)
        seg.prevTip = seg.prevVel = null
        seg.rotation.write(seg.bone.quaternion, seg.rotation.base(seg.bone.quaternion))
      }
      first.bone.updateMatrixWorld(true)
      return
    }
    const parentQ = first.bone.parent!.getWorldQuaternion(new THREE.Quaternion())
    const base = first.bone.getWorldPosition(new THREE.Vector3())
    for (const seg of this.segments) {
      const rigidQ = parentQ.clone().multiply(seg.restQ)
      const tip = seg.tipLocal.clone().applyQuaternion(rigidQ).add(base)
      if (dt > 0) this.integrate(seg, dt, tip.clone().sub(base), tip, parentQ)
      // Bend in the parent's frame; the next segment hangs off the bent tip.
      const angle = seg.theta.length()
      const bend = angle > 1e-7 ? this.q1.setFromAxisAngle(seg.theta.clone().divideScalar(angle), angle) : this.q1.identity()
      const authored = seg.rotation.base(seg.bone.quaternion)
      seg.rotation.write(seg.bone.quaternion, bend.clone().multiply(authored))
      // The next segment is driven by the body too, not by this one's wobble
      // (2.6 Hz feeding a 3.8 Hz spring resonates, measured ×1.9). Its bend
      // still adds on top of this one's: the tip shows both modes.
      parentQ.multiply(seg.restQ)
      base.add(seg.tipLocal.clone().applyQuaternion(parentQ))
    }
    first.bone.updateMatrixWorld(true)
  }

  /** Advance one segment's bend by dt from the acceleration of its rigid tip. */
  private integrate(seg: SpringSegment, dt: number, r: THREE.Vector3, tip: THREE.Vector3, parentQ: THREE.Quaternion) {
    const accel = new THREE.Vector3()
    if (seg.prevTip) {
      const vel = tip.clone().sub(seg.prevTip).divideScalar(dt)
      if (seg.prevVel) accel.copy(vel).sub(seg.prevVel).divideScalar(dt)
      seg.prevVel = vel
    }
    seg.prevTip = tip.clone()
    if (accel.length() > MAX_ACCEL) accel.setLength(MAX_ACCEL)
    const vertical = accel.dot(UP)
    accel.addScaledVector(UP, -vertical).multiplyScalar(HORIZONTAL_GAIN).addScaledVector(UP, vertical * VERTICAL_GAIN)
    // Inertia: the tip lags its base -> angular acceleration r × (−a) / |r|²,
    // in the parent's frame (the bend is relative to what holds the antenna).
    const toParent = this.q2.copy(parentQ).invert()
    const alpha = r.clone().cross(accel.negate()).divideScalar(Math.max(r.lengthSq(), 1e-8)).applyQuaternion(toParent)
    const axis = r.clone().normalize().applyQuaternion(toParent)
    for (let t = 0; t < dt - 1e-9; t += SUBSTEP_S) {
      const h = Math.min(SUBSTEP_S, dt - t)
      const acc = alpha.clone().addScaledVector(seg.theta, -seg.stiffness).addScaledVector(seg.omega, -seg.damping)
      seg.omega.addScaledVector(acc, h)
      seg.theta.addScaledVector(seg.omega, h)
      // Bend only: no twist about the stalk.
      seg.theta.addScaledVector(axis, -seg.theta.dot(axis))
      seg.omega.addScaledVector(axis, -seg.omega.dot(axis))
    }
    if (seg.theta.length() > MAX_ANGLE) seg.theta.setLength(MAX_ANGLE)
  }

  private applyBlink(clipActive: boolean) {
    if (!this.eyes || this.blinkIndex < 0) return
    const w = this.eyes.morphTargetInfluences!
    const clipBlink = this.blinkInfluence.base(w[this.blinkIndex])
    w[this.blinkIndex] = this.blinkInfluence.write(Math.min(1, Math.max(clipBlink, this.blinkAmount(clipActive))))
  }

  /** Current idle-blink closure, 0..1 (schedules the next blink). */
  private blinkAmount(clipActive: boolean) {
    if (!this.options.life) {
      this.blink = null
      return 0
    }
    if (!this.blink && this.clock >= this.nextBlinkAt) {
      if (clipActive || this.sinceClip < BLINK_QUIET_AFTER_CLIP_S) {
        this.nextBlinkAt = this.clock + 0.6 + this.random()
      } else {
        const slow = this.random() < SLOW_BLINK.chance
        this.blink = {
          start: this.clock,
          hold: slow ? SLOW_BLINK.hold : BLINK.hold,
          open: slow ? SLOW_BLINK.open : BLINK.open,
        }
      }
    }
    if (!this.blink) return 0
    const t = this.clock - this.blink.start
    const { hold, open } = this.blink
    if (t >= BLINK.close + hold + open) {
      this.blink = null
      this.nextBlinkAt = this.clock + this.blinkGap()
      return 0
    }
    if (t < BLINK.close) return smooth(t / BLINK.close)
    if (t < BLINK.close + hold) return 1
    return 1 - smooth((t - BLINK.close - hold) / open)
  }

  private blinkGap() {
    return BLINK_GAP_S[0] + (BLINK_GAP_S[1] - BLINK_GAP_S[0]) * this.random()
  }
}
