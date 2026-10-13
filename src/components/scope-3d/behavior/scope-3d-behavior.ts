// Scope 3D behaviour state machine — pure logic, no React, no three.js.
//
// It decides WHEN Scope does something and WHAT; the renderer (a future
// three.js / R3F layer) only executes the commands it returns. Time and
// randomness are injected so every guarantee below is unit-testable:
//
//   - IDLE dominates: autonomous behaviours are spaced 8–20 s apart (config).
//   - Stretch and Laugh are NEVER chosen at random — they don't exist in the
//     autonomous pool; they only play as ClickReaction, on click.
//   - No behaviour plays three times in a row; direction, speed and amplitude
//     vary on every play.
//   - A click always wins: the current autonomous clip is faded out, the
//     reaction plays, further clicks are ignored until it finishes, and the
//     autonomous timer restarts from the end of the reaction.
//
// States: IDLE -> RANDOM_ANIMATION -> RETURN_TO_IDLE -> IDLE
//         (any but the reaction) -click-> CLICK_STRETCH -> CLICK_LAUGH -> RETURN_TO_IDLE

import {
  AUTONOMOUS_BEHAVIORS,
  CLICK_REACTION,
  DEFAULT_SCOPE_3D_BEHAVIOR,
  type AutonomousBehavior,
  type Scope3DBehaviorConfig,
  type Scope3DClipBehavior,
} from "./scope-3d-config.ts"

export type Scope3DState = "IDLE" | "RANDOM_ANIMATION" | "CLICK_STRETCH" | "CLICK_LAUGH" | "RETURN_TO_IDLE"

export interface Scope3DPlayCommand {
  type: "play"
  behavior: Scope3DClipBehavior
  /** Exact clip name in scope-web.glb, e.g. "LookAround.R". */
  clip: string
  timeScale: number
  /** Additive layer weight (motion amplitude). */
  weight: number
  fadeInMs: number
}

export interface Scope3DStopCommand {
  type: "stop"
  clip: string
  fadeOutMs: number
}

export type Scope3DCommand = Scope3DPlayCommand | Scope3DStopCommand

export interface Scope3DBehavior {
  readonly state: Scope3DState
  /** Advance timers; call from the render loop (or any ticker). */
  update(nowMs: number): Scope3DCommand[]
  /** The visitor clicked Scope. */
  click(nowMs: number): Scope3DCommand[]
  /** When the next autonomous behaviour is due (null while busy). */
  readonly nextAutonomousAt: number | null
  /** Autonomous behaviours played so far, oldest first. */
  readonly history: readonly AutonomousBehavior[]
}

interface Options {
  config?: Partial<Scope3DBehaviorConfig>
  /** Returns [0, 1). Defaults to Math.random. */
  random?: () => number
  startMs?: number
}

function lerp(range: readonly [number, number], t: number) {
  return range[0] + (range[1] - range[0]) * t
}

export function createScope3DBehavior({ config, random = Math.random, startMs = 0 }: Options = {}): Scope3DBehavior {
  const cfg: Scope3DBehaviorConfig = { ...DEFAULT_SCOPE_3D_BEHAVIOR, ...config }
  let state: Scope3DState = "IDLE"
  let nextAt: number | null = startMs + interval()
  let endsAt = 0
  let laughAt = 0
  let returnEndsAt = 0
  let current: Scope3DPlayCommand | null = null
  const history: AutonomousBehavior[] = []

  function interval() {
    return lerp([cfg.intervalMs.min, cfg.intervalMs.max], random())
  }

  function pool(): AutonomousBehavior[] {
    const allowed = cfg.reducedMotion
      ? (["BlinkDouble"] as AutonomousBehavior[])
      : AUTONOMOUS_BEHAVIORS.filter((b) => cfg.weights[b] > 0)
    const recent = history.slice(-cfg.maxConsecutive)
    const blocked =
      recent.length === cfg.maxConsecutive && recent.every((b) => b === recent[0]) ? recent[0] : null
    const filtered = allowed.filter((b) => b !== blocked)
    // A pool of one (e.g. reduced motion) can't honour the repeat rule; keep it alive.
    return filtered.length > 0 ? filtered : allowed
  }

  function pick(): AutonomousBehavior {
    const candidates = pool()
    const total = candidates.reduce((sum, b) => sum + (cfg.reducedMotion ? 1 : cfg.weights[b]), 0)
    let r = random() * total
    for (const b of candidates) {
      r -= cfg.reducedMotion ? 1 : cfg.weights[b]
      if (r < 0) return b
    }
    return candidates[candidates.length - 1]
  }

  function playCommand(behavior: Scope3DClipBehavior, fadeInMs: number): Scope3DPlayCommand {
    const isClick = behavior === CLICK_REACTION
    const mirror = !isClick && cfg.mirrorable.includes(behavior as AutonomousBehavior)
    const clip = mirror ? `${behavior}.${random() < 0.5 ? "L" : "R"}` : behavior
    // The click reaction keeps its authored timing and full amplitude.
    const timeScale = isClick ? 1 : lerp(cfg.variation.timeScale, random())
    const weight = isClick ? 1 : lerp(cfg.variation.weight, random())
    return { type: "play", behavior, clip, timeScale, weight, fadeInMs }
  }

  function startReturn(now: number) {
    state = "RETURN_TO_IDLE"
    current = null
    returnEndsAt = now + cfg.returnMs
  }

  return {
    get state() {
      return state
    },
    get nextAutonomousAt() {
      return state === "IDLE" ? nextAt : null
    },
    get history() {
      return history
    },

    update(now) {
      switch (state) {
        case "IDLE": {
          if (nextAt === null || now < nextAt) return []
          const behavior = pick()
          history.push(behavior)
          current = playCommand(behavior, cfg.fadeInMs)
          endsAt = now + cfg.durationsMs[behavior] / current.timeScale
          state = "RANDOM_ANIMATION"
          nextAt = null
          return [current]
        }
        case "RANDOM_ANIMATION":
        case "CLICK_LAUGH":
          if (now >= endsAt) startReturn(now)
          return []
        case "CLICK_STRETCH":
          if (now >= laughAt) state = "CLICK_LAUGH"
          if (now >= endsAt) startReturn(now)
          return []
        case "RETURN_TO_IDLE":
          if (now >= returnEndsAt) {
            state = "IDLE"
            nextAt = now + interval()
          }
          return []
      }
    },

    click(now) {
      if (state === "CLICK_STRETCH" || state === "CLICK_LAUGH") return [] // no stacking
      const commands: Scope3DCommand[] = []
      if (state === "RANDOM_ANIMATION" && current) {
        commands.push({ type: "stop", clip: current.clip, fadeOutMs: cfg.interruptFadeMs })
      }
      if (cfg.reducedMotion) {
        // A gentle acknowledgement only: no stretch, no laugh.
        current = playCommand("BlinkDouble", cfg.interruptFadeMs)
        endsAt = now + cfg.durationsMs.BlinkDouble / current.timeScale
        state = "RANDOM_ANIMATION"
        nextAt = null
        commands.push(current)
        return commands
      }
      current = playCommand(CLICK_REACTION, cfg.interruptFadeMs)
      laughAt = now + cfg.clickLaughAtMs
      endsAt = now + cfg.durationsMs.ClickReaction
      state = "CLICK_STRETCH"
      nextAt = null
      commands.push(current)
      return commands
    },
  }
}
