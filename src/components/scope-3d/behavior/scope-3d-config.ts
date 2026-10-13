// Scope 3D behaviour configuration — the one place the autonomous rhythm is
// tuned. Not wired into the site yet (the 2D Scope is still the production
// companion); see docs/scope-docs/SCOPE_3D_ANIMATION.md.
//
// Clip names/durations mirror assets/scope-3d/exports/scope-clips.json (baked
// by assets/scope-3d/scripts/build_scope.py); scope-3d-behavior.test.ts fails if
// the two ever drift apart.

export const AUTONOMOUS_BEHAVIORS = ["LookAround", "Tilt", "Bounce", "BlinkDouble", "Focus"] as const
export type AutonomousBehavior = (typeof AUTONOMOUS_BEHAVIORS)[number]

/** Click-only. Stretch and Laugh are baked as one continuous clip. */
export const CLICK_REACTION = "ClickReaction"
export type Scope3DClipBehavior = AutonomousBehavior | typeof CLICK_REACTION

export interface Scope3DBehaviorConfig {
  /** Quiet time between autonomous behaviours (uniformly random in range). */
  intervalMs: { min: number; max: number }
  /** Relative selection weights. Stretch/Laugh are not selectable by design. */
  weights: Record<AutonomousBehavior, number>
  /** A behaviour may repeat at most this many times in a row (2 => never 3). */
  maxConsecutive: number
  /** Per-play variation, so no two repetitions are identical. */
  variation: {
    /** Playback speed multiplier range. */
    timeScale: readonly [number, number]
    /** Additive-layer weight range = amplitude of the motion. */
    weight: readonly [number, number]
  }
  /** Behaviours baked in two directions (.L / .R); one is picked at random. */
  mirrorable: readonly AutonomousBehavior[]
  /** Clip lengths in ms at timeScale 1 (from scope-clips.json). */
  durationsMs: Record<Scope3DClipBehavior, number>
  /** Where Laugh begins inside ClickReaction (state CLICK_STRETCH -> CLICK_LAUGH). */
  clickLaughAtMs: number
  fadeInMs: number
  /** Fade used to cut an autonomous behaviour short when the visitor clicks. */
  interruptFadeMs: number
  /** Settling time after a clip before the next timer starts. */
  returnMs: number
  /** prefers-reduced-motion: only blinks, and a click answers with a blink. */
  reducedMotion: boolean
}

export const DEFAULT_SCOPE_3D_BEHAVIOR: Scope3DBehaviorConfig = {
  intervalMs: { min: 8_000, max: 20_000 },
  weights: { LookAround: 0.3, Tilt: 0.2, Bounce: 0.15, BlinkDouble: 0.2, Focus: 0.15 },
  maxConsecutive: 2,
  variation: { timeScale: [0.9, 1.1], weight: [0.85, 1.1] },
  mirrorable: ["LookAround", "Tilt", "Focus"],
  durationsMs: {
    LookAround: 1_500,
    Tilt: 1_200,
    Bounce: 900,
    BlinkDouble: 1_000,
    Focus: 1_300,
    ClickReaction: 2_500,
  },
  clickLaughAtMs: 1_000,
  fadeInMs: 250,
  interruptFadeMs: 180,
  returnMs: 300,
  reducedMotion: false,
}
