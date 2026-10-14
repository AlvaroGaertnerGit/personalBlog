// Plays the loader's prerendered Scope from its sprite sheets on a 2D canvas,
// frame-exact, so the exit can start exactly where the drawing allows it
// (loader-timeline.ts). Imperative on purpose: React never re-renders per frame.

import { frameRect, nextLoopStep, type LoaderManifest } from "./loader-timeline.ts"

export const LOADER_BASE = "/scope/loader"
/** Hand-over between two drawn frames (quiet frame -> exit, skipped hold). */
const CROSSFADE_MS = 120
/** A long main-thread stall shouldn't fast-forward the animation. */
const MAX_STEPS_PER_TICK = 3

export interface LoaderPlayerEvents {
  /** The exit sequence has started (Scope at rest, about to hop). */
  onExitStart(): void
  /** Each exit frame as it is shown (to sync the rest of the screen). */
  onExitFrame(frame: number): void
  /** The exit sequence has finished on its last frame. */
  onExitEnd(): void
}

type Drawn = { sheet: HTMLImageElement; columns: number; frame: number }

/** AVIF where supported (about half the size), else the WebP twin. */
async function loadSheet(name: string, signal: AbortSignal): Promise<HTMLImageElement> {
  for (const ext of ["avif", "webp"]) {
    const img = new Image()
    img.decoding = "async"
    img.src = `${LOADER_BASE}/${name}.${ext}`
    try {
      await img.decode() // off the main thread: no hitch on the first draw
      if (signal.aborted) break
      return img
    } catch {
      if (signal.aborted) break
    }
  }
  throw new Error(`loader sheet "${name}" could not be decoded`)
}

export class ScopeLoaderPlayer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly abort = new AbortController()
  private loopSheet: HTMLImageElement | null = null
  private exitSheet: HTMLImageElement | null = null
  private exitFailed = false
  private raf = 0
  private last = 0
  private acc = 0
  private sequence: "loop" | "exit" = "loop"
  private frame = 0
  private wantExit = false
  private ended = false
  private fade: { from: Drawn; started: number } | null = null

  constructor(
    canvas: HTMLCanvasElement,
    private readonly manifest: LoaderManifest,
    private readonly events: LoaderPlayerEvents,
  ) {
    canvas.width = manifest.width
    canvas.height = manifest.height
    this.ctx = canvas.getContext("2d")!
  }

  /** Resolves once the loop can play (the exit sheet keeps loading behind it). */
  async load() {
    this.loopSheet = await loadSheet("loop", this.abort.signal)
    loadSheet("exit", this.abort.signal).then(
      (img) => (this.exitSheet = img),
      () => (this.exitFailed = true),
    )
    this.draw(performance.now())
  }

  start() {
    this.last = performance.now()
    const tick = (now: number) => {
      this.advance(now)
      if (!this.ended) this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  /** Scope 3D is ready: finish the current motion, then play the exit. */
  requestExit() {
    this.wantExit = true
  }

  dispose() {
    this.abort.abort()
    cancelAnimationFrame(this.raf)
    // Release the decoded sheets (~46 MB) as soon as the loader is gone.
    this.loopSheet = this.exitSheet = null
  }

  private advance(now: number) {
    const frameMs = 1000 / this.manifest.fps
    this.acc += now - this.last
    this.last = now
    let steps = 0
    while (this.acc >= frameMs && steps < MAX_STEPS_PER_TICK && !this.ended) {
      this.acc -= frameMs
      steps++
      this.step(now)
    }
    if (steps === MAX_STEPS_PER_TICK) this.acc = 0
    this.draw(now)
  }

  private step(now: number) {
    const { manifest: m } = this
    if (this.sequence === "exit") {
      if (this.frame < m.exit.frames - 1) {
        this.frame++
        this.events.onExitFrame(this.frame)
      } else {
        this.ended = true
        this.events.onExitEnd()
      }
      return
    }
    // The exit sheet isn't there (yet): keep waiting on the loop, unless it failed.
    const exitAvailable = this.exitSheet !== null
    const next = nextLoopStep(this.frame, this.wantExit && (exitAvailable || this.exitFailed), m)
    if (next.sequence === "exit" && !exitAvailable) {
      // No exit drawing: leave on this quiet frame; the screen fades out.
      this.ended = true
      this.events.onExitStart()
      this.events.onExitEnd()
      return
    }
    if (next.crossfade) this.fade = { from: this.current(), started: now }
    this.sequence = next.sequence
    this.frame = next.frame
    if (next.sequence === "exit") {
      this.events.onExitStart()
      this.events.onExitFrame(0)
    }
  }

  private current(): Drawn {
    const exit = this.sequence === "exit"
    const sheet = (exit ? this.exitSheet : this.loopSheet)!
    return { sheet, columns: exit ? this.manifest.exit.columns : this.manifest.loop.columns, frame: this.frame }
  }

  private draw(now: number) {
    if (!this.loopSheet) return
    const { ctx, manifest: m } = this
    const blit = ({ sheet, columns, frame }: Drawn) => {
      const r = frameRect(frame, columns, m)
      ctx.drawImage(sheet, r.x, r.y, r.width, r.height, 0, 0, m.width, m.height)
    }
    ctx.clearRect(0, 0, m.width, m.height)
    // Crossfade: the old frame stays fully opaque underneath while the new one
    // fades in on top — the body never turns see-through halfway.
    const t = this.fade ? (now - this.fade.started) / CROSSFADE_MS : 1
    if (this.fade && t < 1) {
      blit(this.fade.from)
      ctx.globalAlpha = Math.max(0, t)
      blit(this.current())
      ctx.globalAlpha = 1
    } else {
      this.fade = null
      blit(this.current())
    }
  }
}
