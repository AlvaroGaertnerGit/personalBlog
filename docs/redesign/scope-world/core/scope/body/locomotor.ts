// Where Scope's feet take him, frame by frame: pure kinematics, no three.js,
// so continuity is testable (locomotor.test.ts).
//
// The 1.0 prototype moved him by teleporting the root between the `push` and
// `landing` markers of Bounce. Here the root moves continuously:
//
//   speed     accelerates and brakes within limits (never starts or stops dead);
//             brakes so that it reaches zero exactly at the goal
//   heading   turns at a limited rate; a sharp change of direction from
//             standing is a turn on the spot first (stepping, see gait.ts)
//   start     from rest he gathers himself first (anticipation, 0.12–0.2 s)
//   retarget  a new goal while moving keeps speed and heading: no restart
//
// Heading convention: the 1.0 prototype's yaw (three.js rotation.y). In
// Blender (x, y) his forward vector is (sin θ, −cos θ).

export type P2 = readonly [number, number]
export type Gait = "walk" | "trot" | "bound"

export interface GaitSpec {
  /** Cruise speed (m/s). */
  speed: number
  accel: number
  decel: number
  /** Max turn rate while moving (rad/s). */
  turn: number
}

export const GAITS: Record<Gait, GaitSpec> = {
  walk: { speed: 0.07, accel: 0.3, decel: 0.35, turn: 2.4 },
  trot: { speed: 0.13, accel: 0.45, decel: 0.5, turn: 3.0 },
  bound: { speed: 0.22, accel: 0.7, decel: 0.75, turn: 3.4 },
}

/** Turn on the spot first if the path starts more than this off his heading (rad). */
const TURN_FIRST = (70 * Math.PI) / 180
/** ...and until he is within this of it. */
const TURN_DONE = (22 * Math.PI) / 180
const TURN_IN_PLACE_RATE = 2.2
const ARRIVE_EPS = 0.006
const LOOKAHEAD = 0.045

export type LocoPhase = "still" | "gather" | "turn" | "move"

export interface LocoState {
  at: [number, number]
  heading: number
  speed: number
  /** Signed turn rate (rad/s) this frame. */
  yawRate: number
  /** Forward acceleration (m/s²) this frame. */
  accel: number
  phase: LocoPhase
}

function wrap(a: number) {
  let d = a % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export const headingTo = (from: P2, to: P2) => Math.atan2(to[0] - from[0], -(to[1] - from[1]))
export const forwardOf = (heading: number): [number, number] => [Math.sin(heading), -Math.cos(heading)]
export const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1])

export class Locomotor {
  readonly state: LocoState
  /** This world's gaits (the approved ones, scaled to the world by WorldDef.gaits). */
  readonly specs: Record<Gait, GaitSpec>
  gait: Gait = "walk"
  /** Seconds of anticipation before the first step (personality: varies a little). */
  gatherS = 0.16
  /** Set by the caller (gait.ts in bound): speed multiplier for this instant. */
  speedFactor = 1
  /** Fired once when he comes to rest at the end of a path. */
  onArrive: () => void = () => {}

  private path: P2[] = []
  private seg = 0
  private gatherLeft = 0
  private faceGoal: number | null = null

  constructor(at: P2, heading: number, gaits: Partial<Record<Gait, Partial<GaitSpec>>> = {}) {
    this.specs = { walk: { ...GAITS.walk, ...gaits.walk }, trot: { ...GAITS.trot, ...gaits.trot }, bound: { ...GAITS.bound, ...gaits.bound } }
    this.state = { at: [at[0], at[1]], heading, speed: 0, yawRate: 0, accel: 0, phase: "still" }
  }

  get moving() {
    return this.path.length > 0
  }

  get remaining() {
    if (!this.path.length) return 0
    let s = dist(this.state.at, this.path[this.seg])
    for (let i = this.seg + 1; i < this.path.length; i++) s += dist(this.path[i - 1], this.path[i])
    return s
  }

  get goal(): P2 | null {
    return this.path.length ? this.path[this.path.length - 1] : null
  }

  /** Follow a polyline (its first point may be where he stands). Keeps speed and heading. */
  setPath(path: P2[], gait: Gait) {
    this.gait = gait
    const pts = path.filter((p, i) => i > 0 || dist(p, this.state.at) > ARRIVE_EPS)
    if (!pts.length) {
      this.stop()
      return
    }
    const wasMoving = this.path.length > 0 || this.state.speed > 0.01
    this.path = pts
    this.seg = 0
    this.faceGoal = null
    if (!wasMoving && this.state.phase === "still") {
      // in a hurry he turns on the way (a wide arc), unless it is right behind him
      const off = Math.abs(wrap(headingTo(this.state.at, pts[0]) - this.state.heading))
      this.state.phase = off > (gait === "bound" ? TURN_FIRST * 1.8 : TURN_FIRST) ? "turn" : "gather"
      this.gatherLeft = this.gatherS
    }
  }

  /** Brake to a halt where he is (never mid-air: the gait finishes its step). */
  stop() {
    if (!this.path.length) return
    // keep only a braking distance ahead along the heading
    const brake = (this.state.speed * this.state.speed) / (2 * this.specs[this.gait].decel)
    const f = forwardOf(this.state.heading)
    this.path = brake > ARRIVE_EPS ? [[this.state.at[0] + f[0] * brake, this.state.at[1] + f[1] * brake]] : []
    this.seg = 0
    if (!this.path.length) this.halt()
  }

  /** Standing: turn to face a heading (stepping on the spot if it is far). */
  face(heading: number | null) {
    this.faceGoal = heading
  }

  /** Reduced motion / tests: be somewhere at once. */
  teleport(at: P2, heading: number) {
    this.path = []
    this.state.at = [at[0], at[1]]
    this.state.heading = heading
    this.state.speed = 0
    this.state.phase = "still"
  }

  step(dt: number) {
    const s = this.state
    const spec = this.specs[this.gait]
    const prevSpeed = s.speed
    s.yawRate = 0
    if (!this.path.length) {
      this.stepStanding(dt)
      s.accel = (s.speed - prevSpeed) / Math.max(dt, 1e-6)
      return
    }
    // advance along the path: the carrot is a little ahead of the current segment's end
    while (this.seg < this.path.length - 1 && dist(s.at, this.path[this.seg]) < LOOKAHEAD) this.seg++
    const target = this.path[this.seg]
    const want = headingTo(s.at, target)
    let err = wrap(want - s.heading)

    if (s.phase === "turn") {
      const rate = Math.sign(err) * Math.min(Math.abs(err) / dt, TURN_IN_PLACE_RATE * (this.gait === "bound" ? 1.5 : 1))
      s.heading = wrap(s.heading + rate * dt)
      s.yawRate = rate
      if (Math.abs(wrap(want - s.heading)) < TURN_DONE) {
        s.phase = "gather"
        this.gatherLeft = this.gatherS * 0.6
      }
      s.accel = 0
      return
    }
    if (s.phase === "gather") {
      this.gatherLeft -= dt
      s.accel = 0
      if (this.gatherLeft > 0) return
      s.phase = "move"
    }

    // heading: limited turn rate, tighter when slow (small steps turn more)
    const maxTurn = spec.turn * (0.55 + 0.45 * Math.min(1, s.speed / spec.speed))
    const rate = Math.max(-maxTurn, Math.min(maxTurn, err * 7))
    s.heading = wrap(s.heading + rate * dt)
    s.yawRate = rate
    err = wrap(want - s.heading)

    // speed: cruise, slower in sharp turns, braking to arrive at zero
    const left = this.remaining
    const turnFactor = Math.max(0.25, Math.cos(Math.min(Math.abs(err), Math.PI / 2)))
    // brake a little gentler than he can, so speed reaches ~0 exactly at the goal
    const brakeV = Math.sqrt(2 * 0.6 * spec.decel * left)
    // ...and in the last centimetres an exponential tail (τ ≈ 0.17 s): he eases onto the spot
    const desired = Math.min(spec.speed * turnFactor, brakeV, 6 * left)
    if (desired > s.speed) s.speed = Math.min(desired, s.speed + spec.accel * dt)
    else s.speed = Math.max(desired, s.speed - spec.decel * 1.6 * dt)

    const lastSeg = this.seg === this.path.length - 1
    const toGoal = dist(s.at, target)
    const f = forwardOf(s.heading)
    const stepLen = Math.min(s.speed * this.speedFactor * dt, lastSeg ? toGoal : Infinity)
    s.at[0] += f[0] * stepLen
    s.at[1] += f[1] * stepLen
    s.accel = (s.speed - prevSpeed) / Math.max(dt, 1e-6)
    if (lastSeg && toGoal - stepLen < 0.0003) this.halt()
  }

  private stepStanding(dt: number) {
    const s = this.state
    s.speed = Math.max(0, s.speed - this.specs[this.gait].decel * dt)
    if (this.faceGoal === null) {
      if (s.phase === "turn") s.phase = "still"
      return
    }
    const err = wrap(this.faceGoal - s.heading)
    if (Math.abs(err) < 0.01) {
      s.phase = "still"
      return
    }
    // a big turn steps on the spot; a small one is a shift of weight
    const big = Math.abs(err) > (14 * Math.PI) / 180 || s.phase === "turn"
    const rate = Math.sign(err) * Math.min(Math.abs(err) / dt, big ? TURN_IN_PLACE_RATE : 1.2)
    s.heading = wrap(s.heading + rate * dt)
    s.yawRate = rate
    s.phase = big && Math.abs(err) > 0.03 ? "turn" : "still"
  }

  private halt() {
    const arrived = this.path.length > 0
    this.path = []
    this.seg = 0
    this.state.speed = 0
    this.state.phase = "still"
    if (arrived) this.onArrive()
  }
}
