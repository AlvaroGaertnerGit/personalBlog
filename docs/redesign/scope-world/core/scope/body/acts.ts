// How the body carries out each act, phase by phase. Every phase names
// itself (debug panel) and says whether a higher priority may take over now:
// never mid-push, mid-wiggle or mid-clip; always while walking (the
// locomotor brakes smoothly from any speed).

import type { P2 } from "../../world-def.ts"
import type { Act, Look } from "../mind/types.ts"
import { BODY, type ActorWorld, type LabScope } from "./actor.ts"
import type { GaitPose } from "./gait.ts"
import { dist, headingTo, type Gait } from "./locomotor.ts"

export interface Runner {
  phase: string
  interruptible: boolean
  done: boolean
  /** Light level this act asks for (null: the mind's baseline). */
  light: number | null
  tall: number
  /** Pose kept once the act is done (sitting in the dish...). */
  restPose: Partial<GaitPose>
  step(dt: number, world: ActorWorld): void
  end?(): void
}

const VISITOR: Look = { kind: "visitor" }
const LUNGE = 0.035
const DEG = Math.PI / 180
const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t))
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

/** A small timeline of named phases. */
abstract class Phased implements Runner {
  phase = "inicio"
  interruptible = true
  done = false
  light: number | null = null
  tall = 0
  restPose: Partial<GaitPose> = {}
  protected t = 0
  protected readonly s: LabScope

  constructor(s: LabScope) {
    this.s = s
  }

  protected go(phase: string, interruptible = true) {
    this.phase = phase
    this.interruptible = interruptible
    this.t = 0
  }

  protected finish() {
    this.done = true
    this.interruptible = true
    this.phase = "hecho"
  }

  step(dt: number, world: ActorWorld) {
    this.t += dt
    this.tick(dt, world)
  }

  protected abstract tick(dt: number, world: ActorWorld): void

  /** Walk to `goal` over the ground (out of the lantern first if he is inside). */
  protected walkTo(goal: P2, gait: Gait, world: ActorWorld) {
    const s = this.s
    const path = planFrom(s.at, goal, world)
    if (!path) return false
    if (s.reduced) {
      const last = path[path.length - 1]
      const prev = path[Math.max(0, path.length - 2)]
      s.place(last, dist(prev, last) > 1e-4 ? headingTo(prev, last) : s.heading, world.ground)
      return true
    }
    s.loco.setPath(path, gait)
    return true
  }

  /** Turn to face; true once facing within `tol`. */
  protected faced(look: Look | P2 | null, world: ActorWorld, tol = 0.1) {
    const s = this.s
    const h = s.headingToward(look, world)
    if (h === null) return true
    if (s.reduced) {
      s.loco.teleport(s.at, h)
      return true
    }
    s.loco.face(h)
    return Math.abs(s.headingError(look, world)) < tol
  }
}

/** A path from where he is, leaving the lantern by its door if he is inside it. */
function planFrom(from: P2, goal: P2, world: ActorWorld): P2[] | null {
  const ball = world.ball?.at ?? null
  const LANTERN = world.places.lantern
  const LANTERN_DOOR = world.places.lanternDoor
  if (dist(from, LANTERN.center) < LANTERN.outerR + 0.05) {
    const rest = world.ground.path(LANTERN_DOOR.outside, goal, ball)
    return [from, LANTERN_DOOR.doorway, LANTERN_DOOR.outside, ...(rest ? rest.slice(1) : [])]
  }
  return world.ground.path(from, goal, ball)
}

// --- idle: come to a calm halt -------------------------------------------------------------
class Idle extends Phased {
  constructor(s: LabScope) {
    super(s)
    s.loco.stop()
    s.loco.face(null)
    this.go("parar")
  }
  protected tick() {
    if (!this.s.loco.moving) this.finish()
  }
}

// --- go -------------------------------------------------------------------------------
class Go extends Phased {
  private readonly act: Extract<Act, { kind: "go" }>
  constructor(s: LabScope, act: Extract<Act, { kind: "go" }>, world: ActorWorld) {
    super(s)
    this.act = act
    s.loco.face(null)
    const ok = this.walkTo(act.goal, act.gait, world)
    this.go(ok ? "camino" : "sin camino")
    if (!ok) this.finish()
  }
  protected tick(_dt: number, world: ActorWorld) {
    const s = this.s
    if (this.phase === "camino") {
      if (s.loco.moving) return
      this.go("girar")
    }
    if (this.phase === "girar") {
      if (!this.act.face || this.faced(this.act.face, world, 0.12) || this.t > 2) this.finish()
    }
  }
}

// --- a gesture (an approved clip), facing what it is about ------------------------------------
class Gesture extends Phased {
  private readonly act: Extract<Act, { kind: "gesture" }>
  constructor(s: LabScope, act: Extract<Act, { kind: "gesture" }>) {
    super(s)
    this.act = act
    s.loco.stop()
    this.go("orientarse")
  }
  protected tick(_dt: number, world: ActorWorld) {
    const s = this.s
    if (this.phase === "orientarse") {
      if (s.loco.moving) return
      const off = Math.abs(s.headingError(this.act.face, world))
      if (off > 50 * DEG && !this.faced(this.act.face, world, 20 * DEG) && this.t < 1.6) return
      if (s.reduced) return this.finish() // no gestures with reduced motion
      s.play(this.act.clip)
      // an idle gesture may give way (it fades out: the clips are additive and rest-to-rest)
      this.go("clip", false)
      return
    }
    if (this.phase === "clip") {
      if (this.t > 0.35) this.interruptible = true
      if (!s.clipBusy) this.finish()
    }
  }
  end() {
    if (this.phase === "clip" && this.s.clipBusy) this.s.animator.stopAll(300)
  }
}

// --- reactions to a click ------------------------------------------------------------------
class React extends Phased {
  private readonly variant: Extract<Act, { kind: "react" }>["variant"]
  constructor(s: LabScope, act: Extract<Act, { kind: "react" }>) {
    super(s)
    this.variant = s.reduced ? "blink" : act.variant
    if (this.variant !== "blink" && this.variant !== "peek") s.loco.stop()
    this.go(this.variant === "peek" ? "asomarse" : "orientarse", this.variant === "blink")
    if (this.variant === "peek") this.restPose = { lower: 0.0025, crouch: 0.2 }
  }
  protected tick(_dt: number, world: ActorWorld) {
    const s = this.s
    switch (this.phase) {
      case "orientarse": {
        if (this.variant === "blink") {
          s.play("BlinkDouble", 0.8)
          return this.go("clip", false)
        }
        if (s.loco.moving && this.t < 1) return
        if (Math.abs(s.headingError(VISITOR, world)) > 30 * DEG && !this.faced(VISITOR, world, 18 * DEG) && this.t < 1.4) return
        if (this.variant === "full") s.play("ClickReaction")
        else if (this.variant === "tilt") s.play("Tilt")
        else s.play("Bounce", 0.55)
        return this.go("clip", false)
      }
      case "asomarse":
        // from his dish: he rises and leans out of the door, looks, blinks
        s.setPose({ lean: 7 * ease(this.t / 0.35), lower: 0.0025 * (1 - ease(this.t / 0.3)), crouch: 0 })
        if (this.t > 0.45) {
          s.play("BlinkDouble", 0.8)
          this.go("clip", false)
        }
        return
      case "clip":
        if (this.variant === "peek") s.setPose({ lean: 7, lower: 0, crouch: 0 })
        if (s.clipBusy) return
        if (this.variant === "peek") this.go("volver", false)
        else this.finish()
        return
      case "volver":
        s.setPose({ lean: 7 * (1 - ease(this.t / 0.5)), lower: 0.0025 * ease(this.t / 0.6), crouch: 0.2 * ease(this.t / 0.6) })
        if (this.t > 0.7) this.finish()
    }
  }
}

// --- fit: settle into his hollow --------------------------------------------------------------
class Fit extends Phased {
  constructor(s: LabScope, world: ActorWorld) {
    super(s)
    this.light = null
    if (dist(s.at, world.places.lantern.center) < 0.06) {
      this.go("acomodarse", false)
      return
    }
    const ok = this.walkTo(world.places.lanternDoor.outside, dist(s.at, world.places.lanternDoor.outside) > 0.3 ? "trot" : "walk", world)
    this.go(ok ? "ir a la puerta" : "sin camino")
    if (!ok) this.finish()
  }
  protected tick(_dt: number, world: ActorWorld) {
    const s = this.s
    switch (this.phase) {
      case "ir a la puerta":
        if (!s.loco.moving) this.go("alinearse")
        return
      case "alinearse":
        // square up with the door: it is only a little wider than he is
        if (this.faced(world.places.lanternDoor.doorway, world, 3 * DEG) || this.t > 2.5) {
          if (s.reduced) s.place(world.places.lanternDoor.seat, headingTo(world.places.lanternDoor.seat, world.places.lanternDoor.outside), world.ground)
          else s.loco.setPath([s.at, world.places.lanternDoor.doorway, world.places.lanternDoor.seat], "walk")
          this.go(s.reduced ? "acomodarse" : "entrar")
        }
        return
      case "entrar": {
        // ducks a little through the door; a small step up onto the dish rim
        const d = dist(s.at, world.places.lantern.center)
        const rim = Math.max(0, 1 - Math.abs(d - (world.places.lantern.dishR - 0.035)) / 0.02)
        s.setPose({ crouch: 0.15, lift: 0.004 * rim, lean: 2 * rim })
        if (!s.loco.moving) this.go("darse la vuelta", true)
        return
      }
      case "darse la vuelta":
        // turns on the spot (small steps) to face out of his door
        s.setPose({ crouch: 0.1 })
        if (this.faced(world.places.lanternDoor.outside, world, 4 * DEG) || this.t > 3) this.go("acomodarse", false)
        return
      case "acomodarse": {
        // a settling wiggle, decaying, as he sinks into the hollow
        const wiggle = 2.6 * Math.sin(2 * Math.PI * 2.1 * this.t) * Math.exp(-2.2 * this.t)
        s.setPose({ roll: wiggle, lower: 0.0025 * ease(this.t / 0.9), crouch: 0.25 * ease(this.t / 0.6) })
        this.light = 0.35 * ease(this.t / 1.2)
        if (this.t > 1.4) {
          this.restPose = { lower: 0.0025, crouch: 0.2 }
          this.light = 0.35
          this.finish()
        }
        return
      }
    }
  }
}

// --- unfit: lean out, look, step out of the door ------------------------------------------------
class Unfit extends Phased {
  constructor(s: LabScope, world: ActorWorld) {
    super(s)
    this.light = 0.3
    if (dist(s.at, world.places.lantern.center) > world.places.lantern.outerR) {
      this.finish()
      return
    }
    this.go("asomarse", true)
  }
  protected tick(_dt: number, world: ActorWorld) {
    const s = this.s
    if (this.phase === "asomarse") {
      s.setPose({ lean: 6 * ease(this.t / 0.3), lower: 0.0025 * (1 - ease(this.t / 0.3)), crouch: 0 })
      this.tall = 0.25
      if (this.t > 0.4) {
        this.walkTo(world.places.lanternDoor.outside, "walk", world)
        this.go("salir")
      }
      return
    }
    if (this.phase === "salir") {
      this.tall = 0
      this.light = null
      if (!s.loco.moving) this.finish()
    }
  }
}

// --- nudge: push the ball with his face ---------------------------------------------------------
class Nudge extends Phased {
  private readonly toward: P2
  private dir: [number, number] = [0, 1]
  private planned: P2 = [0, 0]
  private pushed = 0
  constructor(s: LabScope, act: Extract<Act, { kind: "nudge" }>, world: ActorWorld) {
    super(s)
    this.toward = act.toward
    this.plan(world)
  }
  private plan(world: ActorWorld) {
    const ball = world.ball
    if (!ball) return this.finish()
    const d = dist(ball.at, this.toward)
    if (d < 0.02) return this.finish()
    this.dir = [(this.toward[0] - ball.at[0]) / d, (this.toward[1] - ball.at[1]) / d]
    // stand behind the ball, a finger's width from it
    const back = world.places.ball.radius + BODY.radius + BODY.ahead + 0.014
    const pre: P2 = [ball.at[0] - this.dir[0] * back, ball.at[1] - this.dir[1] * back]
    this.planned = ball.at
    if (dist(pre, this.s.at) < 0.008) return this.go("alinearse")
    if (!this.walkTo(pre, dist(pre, this.s.at) > 0.15 ? "trot" : "walk", world)) return this.finish()
    this.go("acercarse")
  }
  protected tick(_dt: number, world: ActorWorld) {
    const s = this.s
    const ball = world.ball
    if (!ball) return this.finish()
    switch (this.phase) {
      case "acercarse":
        if (dist(ball.at, this.planned) > 0.03) return this.plan(world) // it moved: around again
        if (!s.loco.moving) this.go("alinearse")
        return
      case "alinearse":
        if (dist(ball.at, this.planned) > 0.03) return this.plan(world)
        if (this.faced([s.at[0] + this.dir[0], s.at[1] + this.dir[1]], world, 4 * DEG) || this.t > 2) this.go("prepararse", false)
        return
      case "prepararse":
        // gathers himself: sinks, leans back a little, eyes on the ball
        s.setPose({ crouch: 0.8 * ease(this.t / 0.25), lean: -3 * ease(this.t / 0.25) })
        if (this.t > 0.34) this.go("empujar", false)
        return
      case "empujar": {
        // the lunge: face first, 3.5 cm forward in 0.26 s, eased in and out (peak ~0.2 m/s);
        // what the ball does comes from the contact, not from here
        const total = LUNGE
        const k = ease(this.t / 0.26)
        const step = total * k - this.pushed
        this.pushed = total * k
        s.shift(this.dir[0] * step, this.dir[1] * step)
        s.setPose({ crouch: 0.8 * (1 - k), lean: -3 + 12 * k })
        if (this.t >= 0.26) this.go("recuperarse", false)
        return
      }
      case "recuperarse": {
        // weight back, a small step back, upright
        const k = ease(this.t / 0.45)
        const back = 0.018 * k - (this.pushed - LUNGE)
        this.pushed = LUNGE + 0.018 * k
        s.shift(-this.dir[0] * back, -this.dir[1] * back)
        s.setPose({ lean: 9 * (1 - k), crouch: 0 })
        if (this.t >= 0.45) this.go("mirar")
        return
      }
      case "mirar":
        // watches it roll
        if (ball.speed < 0.006 || this.t > 3.5) this.finish()
        return
    }
  }
}

// --- shine: light a mechanism -----------------------------------------------------------------
class Shine extends Phased {
  private readonly object: "flower" | "radiometer"
  private readonly hold: number
  private strong = 0
  private answered = false
  constructor(s: LabScope, act: Extract<Act, { kind: "shine" }>, world: ActorWorld) {
    super(s)
    this.object = act.object
    this.hold = act.hold
    const obj = world.objectAt(act.object)
    const spot = shineSpot(obj, s.at, world)
    if (!spot) {
      this.finish()
      return
    }
    if (dist(spot, s.at) < 0.01) this.go("orientarse")
    else if (this.walkTo(spot, dist(spot, s.at) > 0.3 ? "trot" : "walk", world)) this.go("acercarse")
    else this.finish()
  }
  protected tick(dt: number, world: ActorWorld) {
    const s = this.s
    const look: Look = { kind: "object", id: this.object }
    switch (this.phase) {
      case "acercarse":
        if (!s.loco.moving) this.go("orientarse")
        return
      case "orientarse":
        if (this.faced(look, world, 6 * DEG) || this.t > 2) this.go("reunir luz", false)
        return
      case "reunir luz":
        // anticipation: he draws himself in and his light gathers
        s.setPose({ crouch: 0.35 * ease(this.t / 0.4), lean: -2 * ease(this.t / 0.4) })
        this.light = 0.06 + 0.2 * ease(this.t / 0.55)
        if (this.t > 0.6) this.go("iluminar", false)
        return
      case "iluminar": {
        // the beam: leans toward it and holds; the mechanism answers (or not) on its own
        s.setPose({ crouch: 0, lean: 3 * ease(this.t / 0.3) })
        this.light = 0.26 + 0.74 * ease(this.t / 0.3)
        if (this.t > 1) this.interruptible = true
        const answering = this.object === "flower" ? world.flowerBloomed : world.radiometerOmega > 9
        this.strong = answering ? this.strong + dt : 0
        if (this.strong > (this.object === "flower" ? 0.5 : 1.4)) this.answered = true
        if (this.answered || this.t > this.hold) this.go("reaccion", false)
        return
      }
      case "reaccion":
        // it worked: a little lift of joy; if not, he keeps looking a moment
        this.light = 0.8
        if (this.t < dt * 1.5 && this.answered && !s.reduced) s.play("Bounce", 0.4)
        this.tall = this.answered ? 0.35 * (1 - ease(this.t / 1)) : 0
        if (this.t > 1 && !s.clipBusy) this.go("apagar")
        return
      case "apagar":
        this.light = 0.8 * (1 - ease(this.t / 0.6))
        this.tall = 0
        if (this.t > 0.6) {
          this.light = null
          this.finish()
        }
    }
  }
}

// --- surprise: a little hop back, eyes open -------------------------------------------------
class Surprise extends Phased {
  private readonly away: [number, number]
  private moved = 0
  constructor(s: LabScope, act: Extract<Act, { kind: "surprise" }>) {
    super(s)
    s.loco.stop()
    const d = unit([s.at[0] - act.from[0], s.at[1] - act.from[1]])
    this.away = d
    this.tall = 0.6
    this.go("respingo", false)
  }
  protected tick() {
    const s = this.s
    if (this.phase === "respingo") {
      const k = easeOut(this.t / 0.2)
      const step = 0.012 * k - this.moved
      this.moved = 0.012 * k
      s.shift(this.away[0] * step, this.away[1] * step)
      s.setPose({ lift: 0.004 * Math.sin(Math.PI * Math.min(1, this.t / 0.2)), lean: -4 * k })
      if (this.t > 0.2) this.go("quieto", false)
      return
    }
    s.setPose({ lean: -4 * (1 - ease(this.t / 0.5)) })
    this.tall = 0.6 * (1 - ease(this.t / 0.7))
    if (this.t > 0.7) this.finish()
  }
}

// --- settle: rest where he is ---------------------------------------------------------------
class Settle extends Phased {
  constructor(s: LabScope) {
    super(s)
    s.loco.stop()
    this.restPose = { lower: 0.002, crouch: 0.2 }
    this.light = 0.03
    this.go("asentarse")
  }
  protected tick() {
    if (this.s.loco.moving) return
    this.s.setPose({ lower: 0.002 * ease(this.t / 0.8), crouch: 0.2 * ease(this.t / 0.8) })
    if (this.t > 0.8) {
      this.light = null
      this.finish()
    }
  }
}

/**
 * Where to stand to light something: 13 cm from it, BESIDE it as you see it and
 * preferably a little behind (you see his face three-quarters, the beam and the
 * mechanism), never between you and it. The first candidate in view, with free
 * floor and a short way there, wins.
 */
function shineSpot(obj: P2, from: P2, world: ActorWorld): P2 | null {
  const toEye = unit([world.eye[0] - obj[0], world.eye[1] - obj[1]])
  const side: [number, number] = [-toEye[1], toEye[0]]
  const near = (from[0] - obj[0]) * side[0] + (from[1] - obj[1]) * side[1] >= 0 ? 1 : -1
  // first the spots you would see him in, then any
  for (const seen of [true, false])
  for (const behind of [0.5, 0, -0.35])
    for (const sign of [near, -near]) {
      const out = unit([side[0] * sign - toEye[0] * behind, side[1] * sign - toEye[1] * behind])
      const spot: P2 = [obj[0] + out[0] * 0.13, obj[1] + out[1] * 0.13]
      if (!world.ground.isFree(spot) || (seen && !world.inView(spot))) continue
      const path = world.ground.path(from, spot, world.ball?.at ?? null)
      if (!path) continue
      let len = 0
      for (let i = 1; i < path.length; i++) len += dist(path[i - 1], path[i])
      if (len < dist(from, spot) * 2 + 0.15) return spot
    }
  return null
}

function unit(v: [number, number]): [number, number] {
  const l = Math.hypot(v[0], v[1]) || 1
  return [v[0] / l, v[1] / l]
}

export function createRunner(act: Act, s: LabScope, world: ActorWorld): Runner {
  switch (act.kind) {
    case "idle":
      return new Idle(s)
    case "go":
      return new Go(s, act, world)
    case "gesture":
      return new Gesture(s, act)
    case "react":
      return new React(s, act)
    case "fit":
      return new Fit(s, world)
    case "unfit":
      return new Unfit(s, world)
    case "nudge":
      return new Nudge(s, act, world)
    case "shine":
      return new Shine(s, act, world)
    case "surprise":
      return new Surprise(s, act)
    case "settle":
      return new Settle(s)
  }
}
