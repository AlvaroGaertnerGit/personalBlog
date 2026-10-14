// Scope 3D director — glue between the behaviour state machine (decides) and
// the animator (plays). It owns the single clock both of them read, so pausing
// or slowing playback also pauses/slows the autonomous timer: the two can never
// drift apart.
//
// Manual playback (the /scope-lab panel) is a review override, not a second
// decision system: it switches autonomous mode off and clears whatever the
// state machine was doing first.

import {
  createScope3DBehavior,
  type Scope3DBehavior,
  type Scope3DCommand,
  type Scope3DState,
} from "../behavior/scope-3d-behavior.ts"
import {
  DEFAULT_SCOPE_3D_BEHAVIOR,
  type AutonomousBehavior,
  type Scope3DBehaviorConfig,
} from "../behavior/scope-3d-config.ts"
import { IDLE_CLIP, type Scope3DActiveClip, type Scope3DAnimator, type Scope3DPlayOptions } from "./scope-3d-animator.ts"
import type { Scope3DSecondary } from "./scope-3d-secondary.ts"

export interface Scope3DLogEntry {
  /** Director clock, ms. */
  at: number
  text: string
}

export interface Scope3DDirectorSnapshot {
  clockMs: number
  state: Scope3DState
  autonomous: boolean
  /** ms until the next autonomous behaviour (null while busy or disabled). */
  nextInMs: number | null
  history: readonly AutonomousBehavior[]
  active: Scope3DActiveClip[]
  /** Base layer weight (drops below 1 only in replace mode). */
  idleWeight: number
  paused: boolean
  speed: number
  log: readonly Scope3DLogEntry[]
}

const LOG_SIZE = 14
/** Fade used when the lab panel cuts in or returns to Idle. */
const MANUAL_FADE_MS = 200

export class Scope3DDirector {
  private clock = 0
  private behavior: Scope3DBehavior
  private config: Scope3DBehaviorConfig
  private autonomousOn = true
  private pausedOn = false
  private speedValue = 1
  private readonly log: Scope3DLogEntry[] = []

  constructor(
    private readonly animator: Scope3DAnimator,
    config: Partial<Scope3DBehaviorConfig> = {},
    /** Antenna spring + idle life, run on the same clock after the mixer. */
    private readonly secondary: Scope3DSecondary | null = null,
  ) {
    this.config = { ...DEFAULT_SCOPE_3D_BEHAVIOR, ...config }
    this.behavior = createScope3DBehavior({ config: this.config, startMs: 0 })
    if (secondary) secondary.options.reducedMotion = this.config.reducedMotion
  }

  get behaviorConfig(): Readonly<Scope3DBehaviorConfig> {
    return this.config
  }

  /** Advance by real seconds (render loop). */
  tick(realDt: number) {
    const dt = this.pausedOn ? 0 : realDt * this.speedValue
    this.clock += dt * 1000
    // While autonomous is off the IDLE timer is frozen, but a click reaction
    // still needs the machine to walk it back to IDLE.
    if (this.autonomousOn || this.behavior.state !== "IDLE") {
      this.execute(this.behavior.update(this.clock), "auto")
    }
    this.pose(dt)
  }

  /** Mixer first, then the secondary layer on top of the pose it produced. */
  private pose(dt: number) {
    this.animator.update(dt)
    this.secondary?.update(dt, this.animator.busy)
  }

  /** The visitor clicked the model. */
  click() {
    const busy = this.behavior.state === "CLICK_STRETCH" || this.behavior.state === "CLICK_LAUGH"
    if (busy) {
      this.note("click ignored (reaction running)")
      return
    }
    const commands = this.behavior.click(this.clock)
    // Anything the machine doesn't know about (a manual clip) is cut too.
    this.animator.stopAll(this.config.interruptFadeMs)
    this.execute(commands, "click")
  }

  /**
   * The page asks for a behaviour (a mood on the site). Goes through the state
   * machine: honoured only from IDLE, so it never cuts anything short.
   */
  request(behavior: AutonomousBehavior) {
    if (!this.autonomousOn) return
    this.execute(this.behavior.request(this.clock, behavior), "page")
  }

  /** Lab: play one clip by hand (autonomous mode switches off). */
  playManual(clip: string, options: Scope3DPlayOptions = {}) {
    if (clip === IDLE_CLIP) return this.returnToIdle()
    this.setAutonomous(false)
    this.animator.stopAll(MANUAL_FADE_MS)
    if (this.animator.play(clip, { fadeInMs: MANUAL_FADE_MS, ...options })) {
      this.note(`manual play ${clip}${options.loop ? " (loop)" : ""}`)
    }
  }

  returnToIdle() {
    this.animator.stopAll(MANUAL_FADE_MS)
    this.note("return to Idle")
  }

  /** Lab: trigger the next autonomous behaviour right now. */
  triggerAutonomous() {
    this.setAutonomous(true)
    this.behavior.schedule(this.clock, 0)
  }

  setAutonomous(on: boolean) {
    if (on === this.autonomousOn) return
    this.autonomousOn = on
    // Re-arm with a fresh interval so a timer that expired while off doesn't fire instantly.
    if (on) this.behavior.schedule(this.clock)
    this.note(`autonomous ${on ? "on" : "off"}`)
  }

  /** Rebuilds the state machine (history resets); running clips finish on their own. */
  setConfig(patch: Partial<Scope3DBehaviorConfig>) {
    this.config = { ...this.config, ...patch }
    this.behavior = createScope3DBehavior({ config: this.config, startMs: this.clock })
    if (this.secondary) this.secondary.options.reducedMotion = this.config.reducedMotion
    this.note("behaviour config updated")
  }

  setPaused(paused: boolean) {
    this.pausedOn = paused
  }

  setSpeed(speed: number) {
    this.speedValue = speed
  }

  restart(clip: string) {
    this.animator.restart(clip)
  }

  seek(clip: string, time: number) {
    this.animator.seek(clip, time)
    this.pose(0)
  }

  snapshot(): Scope3DDirectorSnapshot {
    const due = this.behavior.nextAutonomousAt
    return {
      clockMs: this.clock,
      state: this.behavior.state,
      autonomous: this.autonomousOn,
      nextInMs: this.autonomousOn && due !== null ? Math.max(0, due - this.clock) : null,
      history: this.behavior.history.slice(-12),
      active: this.animator.active(),
      idleWeight: this.animator.idle.getEffectiveWeight(),
      paused: this.pausedOn,
      speed: this.speedValue,
      log: [...this.log],
    }
  }

  private execute(commands: Scope3DCommand[], source: "auto" | "click" | "page") {
    for (const cmd of commands) {
      if (cmd.type === "stop") {
        this.animator.stop(cmd.clip, cmd.fadeOutMs)
        this.note(`${source}: stop ${cmd.clip} (${cmd.fadeOutMs} ms fade)`)
      } else {
        this.animator.play(cmd.clip, { timeScale: cmd.timeScale, weight: cmd.weight, fadeInMs: cmd.fadeInMs })
        this.note(`${source}: play ${cmd.clip} ×${cmd.timeScale.toFixed(2)} w${cmd.weight.toFixed(2)}`)
      }
    }
  }

  private note(text: string) {
    this.log.unshift({ at: this.clock, text })
    this.log.length = Math.min(this.log.length, LOG_SIZE)
  }
}
