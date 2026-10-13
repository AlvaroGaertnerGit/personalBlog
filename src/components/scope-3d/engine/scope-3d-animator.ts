// Scope 3D animator — the only code that touches three's AnimationMixer.
//
// Layering (docs/scope-docs/SCOPE_3D_ANIMATION.md §6):
//   - `Idle` loops forever as the base layer.
//   - Every other clip is a behaviour layered on top of it. Two strategies,
//     switchable so they can be compared side by side in /scope-lab:
//       additive  the clip is converted to a delta from its first frame (all
//                 clips start and end exactly at rest), so Idle's breathing keeps
//                 running underneath and nothing pops when a clip ends.
//       replace   the clip is blended in normally and Idle's weight is lowered
//                 by the same amount (weights always sum to 1), then handed back
//                 before the clip ends.
//
// Fades are eased here (smootherstep), not with three's fadeIn/fadeOut: those
// ramp the weight linearly, so a cut-short clip stopped and started with a
// velocity kink. An eased weight starts and lands with zero slope, and a fade
// that interrupts another fade continues from the current weight.
//
// It never decides WHAT to play — that is the behaviour state machine's job
// (scope-3d-director.ts feeds it the commands).

import * as THREE from "three"

export type Scope3DBlendMode = "additive" | "replace"

export interface Scope3DPlayOptions {
  timeScale?: number
  /** Layer weight = amplitude of the motion. */
  weight?: number
  fadeInMs?: number
  loop?: boolean
}

export interface Scope3DActiveClip {
  clip: string
  time: number
  duration: number
  weight: number
  timeScale: number
  loop: boolean
}

export const IDLE_CLIP = "Idle"

/** How long a replace-mode clip takes to hand the pose back to Idle. */
const REPLACE_RETURN_S = 0.25

/**
 * Two instances of every clip (three caches one action per clip object): a
 * clip replayed while it still plays (a click during the reduced-motion
 * blink) fades the old instance out while the new one fades in, instead of
 * snapping it back to rest.
 */
interface ClipPair {
  normal: readonly [THREE.AnimationClip, THREE.AnimationClip]
  additive: readonly [THREE.AnimationClip, THREE.AnimationClip]
  next: 0 | 1
}

/** Shortest hand-over when a clip replaces its own still-running instance. */
const REPLAY_FADE_MS = 150

interface Fade {
  from: number
  to: number
  elapsed: number
  duration: number
}

interface Running {
  clip: string
  action: THREE.AnimationAction
  loop: boolean
  mode: Scope3DBlendMode
  /** Amplitude requested by play(). */
  weight: number
  /** 0..1 fade level; effective weight = weight × level. */
  level: number
  fade: Fade | null
  /** Fading out: released when the level reaches 0. */
  stopping: boolean
}

/** C2-smooth 0 -> 1: zero velocity and acceleration at both ends. */
function smootherstep(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

export class Scope3DAnimator {
  readonly mixer: THREE.AnimationMixer
  readonly idle: THREE.AnimationAction
  /** Every behaviour clip in the GLB, in file order (Idle excluded). */
  readonly clipNames: readonly string[]

  private readonly clips = new Map<string, ClipPair>()
  /** Keyed by clip name; a replaced instance fading out gets a retired key. */
  private readonly running = new Map<string, Running>()
  /** Running keys whose action reached its end during the last mixer update. */
  private readonly finished = new Set<string>()
  private retired = 0
  private readonly morphed: THREE.Mesh[] = []
  private mode: Scope3DBlendMode = "additive"

  constructor(root: THREE.Object3D, animations: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root)
    const idleClip = animations.find((c) => c.name === IDLE_CLIP)
    if (!idleClip) throw new Error(`GLB has no "${IDLE_CLIP}" clip`)
    this.idle = this.mixer.clipAction(idleClip)
    this.idle.play()
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.morphTargetInfluences) this.morphed.push(o)
    })

    for (const clip of animations) {
      if (clip === idleClip) continue
      // makeClipAdditive mutates its argument: keep the original for replace mode.
      const additive = THREE.AnimationUtils.makeClipAdditive(clip.clone())
      this.clips.set(clip.name, {
        normal: [clip, clip.clone()],
        additive: [additive, additive.clone()],
        next: 0,
      })
    }
    this.clipNames = [...this.clips.keys()]

    // Never release inside the event: it fires during mixer.update(), and
    // deactivating an action reorders the mixer's active list mid-loop, so the
    // action swapped into its slot skips that frame (a one-frame pop of Idle
    // or of the click reaction — measured: squash jumped 5 %). Release after.
    this.mixer.addEventListener("finished", (e) => {
      for (const [key, run] of this.running) if (run.action === e.action) this.finished.add(key)
    })
  }

  get blendMode() {
    return this.mode
  }

  /** Switching strategy cuts running behaviours back to Idle first. */
  setBlendMode(mode: Scope3DBlendMode, fadeMs = 200) {
    if (mode === this.mode) return
    this.stopAll(fadeMs)
    this.mode = mode
  }

  has(clip: string) {
    return clip === IDLE_CLIP || this.clips.has(clip)
  }

  duration(clip: string) {
    if (clip === IDLE_CLIP) return this.idle.getClip().duration
    return this.clips.get(clip)?.normal[0].duration ?? 0
  }

  /** True while any behaviour clip is playing or fading. */
  get busy() {
    return this.running.size > 0
  }

  play(clip: string, { timeScale = 1, weight = 1, fadeInMs = 0, loop = false }: Scope3DPlayOptions = {}) {
    const pair = this.clips.get(clip)
    if (!pair) return false
    const previous = this.running.get(clip)
    if (previous) {
      // Hand over: the old instance fades out from where it is, under a retired key.
      this.running.delete(clip)
      this.running.set(`${clip}#${++this.retired}`, previous)
      this.fadeOut(previous, Math.max(fadeInMs, REPLAY_FADE_MS))
      pair.next = pair.next === 0 ? 1 : 0
    }
    const action =
      this.mode === "additive"
        ? this.mixer.clipAction(pair.additive[pair.next], undefined, THREE.AdditiveAnimationBlendMode)
        : this.mixer.clipAction(pair.normal[pair.next])
    action.reset()
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
    action.clampWhenFinished = true // replace mode holds the last frame while handing back
    action.timeScale = timeScale
    const fade = fadeInMs > 0 ? { from: 0, to: 1, elapsed: 0, duration: fadeInMs / 1000 } : null
    const run: Running = { clip, action, loop, mode: this.mode, weight, level: fade ? 0 : 1, fade, stopping: false }
    action.setEffectiveWeight(weight * run.level)
    action.play()
    this.running.set(clip, run)
    return true
  }

  stop(clip: string, fadeOutMs = 0) {
    const run = this.running.get(clip)
    if (!run) return
    if (fadeOutMs <= 0) return this.release(clip)
    this.fadeOut(run, fadeOutMs)
  }

  private fadeOut(run: Running, ms: number) {
    if (run.stopping) return // already fading out: keep its pace
    run.stopping = true
    run.fade = { from: run.level, to: 0, elapsed: 0, duration: ms / 1000 }
  }

  /** Back to pure Idle. */
  stopAll(fadeOutMs = 0) {
    for (const clip of [...this.running.keys()]) this.stop(clip, fadeOutMs)
  }

  /** Restart a running clip from its first frame (keeps its options). */
  restart(clip: string) {
    const run = this.running.get(clip)
    if (!run) return
    run.action.time = 0
    run.action.paused = false
    run.stopping = false
    run.fade = null
    run.level = 1
    run.action.setEffectiveWeight(run.weight)
  }

  /** Jump a running clip to `time` seconds (frame-by-frame review). */
  seek(clip: string, time: number) {
    const run = this.running.get(clip)
    if (!run) return
    run.action.time = THREE.MathUtils.clamp(time, 0, run.action.getClip().duration)
    run.action.paused = false
  }

  update(dt: number) {
    for (const [clip, run] of this.running) {
      const { action } = run
      if (run.fade) {
        const f = run.fade
        f.elapsed += dt
        run.level = f.from + (f.to - f.from) * smootherstep(f.elapsed / f.duration)
        if (f.elapsed >= f.duration) run.fade = null
      }
      if (run.stopping && run.level <= 0) {
        this.release(clip)
        continue
      }
      action.setEffectiveWeight(run.weight * run.level)
      if (run.mode === "replace" && !run.loop && !run.stopping) {
        const remaining = (action.getClip().duration - action.time) / Math.max(action.timeScale, 1e-3)
        if (remaining <= REPLACE_RETURN_S) this.stop(clip, REPLACE_RETURN_S * 1000)
      }
    }
    // Replace mode: Idle yields exactly the weight the behaviours take.
    let taken = 0
    for (const run of this.running.values()) {
      if (run.mode === "replace") taken = Math.max(taken, run.action.getEffectiveWeight())
    }
    this.idle.setEffectiveWeight(1 - Math.min(taken, 1))
    this.mixer.update(dt)
    // A finished clip has just been applied at its last frame (= rest): drop it now.
    for (const clip of this.finished) this.release(clip)
    this.finished.clear()
    // Layer weights above 1 (amplitude variation) and overlapping layers
    // (a blink fading out under the click reaction) can push a shape key past
    // its sculpted extreme — a blink past "closed" folds the capsule inside
    // out. Bones may overshoot; shape keys may not.
    for (const mesh of this.morphed) clampMorphs(mesh)
  }

  active(): Scope3DActiveClip[] {
    return [...this.running.values()].map(({ clip, action, loop }) => ({
      clip,
      time: action.time,
      duration: action.getClip().duration,
      weight: action.getEffectiveWeight(),
      timeScale: action.timeScale,
      loop,
    }))
  }

  dispose() {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.mixer.getRoot())
    this.running.clear()
  }

  private release(clip: string) {
    const run = this.running.get(clip)
    if (!run) return
    run.action.stop()
    this.running.delete(clip)
  }
}

/** Shape-key influences stay within their sculpted range [0, 1]. */
export function clampMorphs(mesh: THREE.Mesh) {
  const w = mesh.morphTargetInfluences
  if (!w) return
  for (let i = 0; i < w.length; i++) w[i] = THREE.MathUtils.clamp(w[i], 0, 1)
}
