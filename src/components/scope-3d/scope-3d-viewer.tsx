"use client"

// Real-time Scope 3D viewer: owns the WebGL stage, the loaded GLB, the
// animator, the secondary-motion layer and the director, and runs the render
// loop. Import it with next/dynamic({ ssr: false }) — it needs WebGL.
//
// Parents talk to it through `onReady` (imperative handle) instead of props
// per frame, so React never re-renders at 60 fps.

import * as React from "react"

import { cn } from "@/lib/utils"

import { Scope3DAnimator } from "./engine/scope-3d-animator.ts"
import { Scope3DDirector } from "./engine/scope-3d-director.ts"
import {
  measureMotionEnvelope,
  SCOPE_3D_WEB_VIEW_DIRECTION,
  type Scope3DMotionEnvelope,
} from "./engine/scope-3d-framing.ts"
import { disposeScope3DModel, loadScope3DModel, type Scope3DModel } from "./engine/scope-3d-model.ts"
import {
  chooseQuality,
  defaultResolutionPolicy,
  type Scope3DQuality,
} from "./engine/scope-3d-resolution.ts"
import { Scope3DSecondary } from "./engine/scope-3d-secondary.ts"
import { Scope3DStage, type Scope3DLighting } from "./engine/scope-3d-stage.ts"

export interface Scope3DFrameStats {
  fps: number
  calls: number
  triangles: number
  /** Main-thread time of the last frames (animation + render submit), ms. */
  cpuMs: number
  quality: Scope3DQuality
  /** Canvas backing store and supersampled render size, device px. */
  canvasPx: readonly [number, number]
  internalPx: readonly [number, number]
  /** The governor lowered the quality because frames were too slow. */
  governed: boolean
  /** Rendering is paused (off-screen or hidden tab). */
  sleeping: boolean
  /** One-off main-thread cost of measuring the motion envelope at load (preview only), ms. */
  envelopeMs: number
}

export interface Scope3DViewerHandle {
  stage: Scope3DStage
  model: Scope3DModel
  animator: Scope3DAnimator
  secondary: Scope3DSecondary
  director: Scope3DDirector
  frame(): Scope3DFrameStats
}

/**
 * studio   orbit camera on the sheet's dark backdrop (/scope-lab).
 * preview  site conditions: transparent canvas over the page, fixed camera
 *          framed on Scope's full motion bounds (nothing ever clips).
 */
export type Scope3DViewerMode = "studio" | "preview"

export type Scope3DViewerStatus =
  | { phase: "loading"; loaded: number; total: number | null }
  | { phase: "ready" }
  | { phase: "error"; message: string }

interface Scope3DViewerProps {
  modelUrl: string
  mode?: Scope3DViewerMode
  /** Canvas pixel ratio override (lab); default: the device's, see chooseQuality. */
  pixelRatio?: number
  /** Supersampling override (lab); default: the resolution policy's choice. */
  ssaa?: number
  lighting: Scope3DLighting
  /** Default: follow the OS `prefers-reduced-motion` setting, live. */
  reducedMotion?: boolean
  /**
   * Preview mode: the precomputed motion envelope (SCOPE_3D_WEB_ENVELOPE),
   * so the site never pays the measurement at load. Measured when omitted.
   */
  envelope?: Scope3DMotionEnvelope
  /** Preview mode accepts software WebGL too (testing on GPU-less machines only). */
  allowSoftwareRenderer?: boolean
  /**
   * Hold the render loop (e.g. while covered by the entry screen, which only
   * needs the first frame): the GPU and main thread stay free for whatever
   * is on screen. The first frame is rendered regardless.
   */
  paused?: boolean
  onReady?: (handle: Scope3DViewerHandle) => void
  /**
   * Once: the first frame WITH Scope in it has been rendered at the canvas's
   * real size and handed to the compositor (shaders compiled, framed, posed).
   * Rendered even if the canvas is off screen, so a page restored mid-scroll
   * still gets its signal.
   */
  onFirstFrame?: () => void
  onStatus?: (status: Scope3DViewerStatus) => void
  className?: string
}

/** Pointer travel (px) above which a press is an orbit drag, not a click. */
const CLICK_SLOP_PX = 5
/** Site hover cursor: one raycast per this many ms at most. */
const HOVER_MS = 80
/** Long frame gaps (tab switch, breakpoint) shouldn't fast-forward animations. */
const MAX_DT_S = 0.1
const PREVIEW_DIRECTION = SCOPE_3D_WEB_VIEW_DIRECTION
/**
 * Governor: when the MEDIAN frame of two windows in a row is slower than this,
 * drop one quality step. The median ignores one-off main-thread stalls
 * (hydration, a long task, the envelope measurement): the mean read them as a
 * slow GPU and degraded a GTX 1660 Ti for good (measured). It only ever steps
 * down (no oscillation) and never below the device pixel ratio.
 */
const GOVERNOR_MIN_FPS = 40
/** Below this nothing is a browser cap: always too slow. */
const GOVERNOR_FLOOR_FPS = 20
const GOVERNOR_WINDOW_S = 2.5
const GOVERNOR_SLOW_WINDOWS = 2

/**
 * Is this window too slow because of US? Battery savers and 30 Hz displays
 * cap rAF at a steady 30 fps with an idle GPU: frames then arrive like
 * clockwork (spread < 15 % of the median), while a GPU-bound loop jitters.
 */
function tooSlow(frameMs: number[]) {
  if (frameMs.length < 8) return false
  const sorted = [...frameMs].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.floor(q * (sorted.length - 1))]
  const median = at(0.5)
  if (median > 1000 / GOVERNOR_FLOOR_FPS) return true
  const capped = at(0.9) - at(0.1) < 0.15 * median
  return median > 1000 / GOVERNOR_MIN_FPS && !capped
}

function useOsReducedMotion() {
  return React.useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)")
      query.addEventListener("change", notify)
      return () => query.removeEventListener("change", notify)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

function Scope3DViewer({
  modelUrl,
  mode = "studio",
  pixelRatio,
  ssaa,
  lighting,
  reducedMotion,
  envelope: knownEnvelope,
  allowSoftwareRenderer = false,
  paused = false,
  onReady,
  onFirstFrame,
  onStatus,
  className,
}: Scope3DViewerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const stageRef = React.useRef<Scope3DStage | null>(null)
  const modelRef = React.useRef<Scope3DModel | null>(null)
  const directorRef = React.useRef<Scope3DDirector | null>(null)
  const applyQualityRef = React.useRef<() => void>(() => {})
  const setRunningRef = React.useRef<() => void>(() => {})
  const osReducedMotion = useOsReducedMotion()
  const reduced = reducedMotion ?? osReducedMotion
  // Callbacks and initial values are read through refs so the heavy effect
  // below only re-runs when the model URL changes.
  const latest = React.useRef({ lighting, reduced, pixelRatio, ssaa, knownEnvelope, paused, onReady, onFirstFrame, onStatus })
  React.useEffect(() => {
    latest.current = { lighting, reduced, pixelRatio, ssaa, knownEnvelope, paused, onReady, onFirstFrame, onStatus }
  })

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const abort = new AbortController()
    const preview = mode === "preview"
    let stage: Scope3DStage
    try {
      // Site conditions refuse software WebGL; the studio still opens anywhere.
      stage = new Scope3DStage(canvas, {
        transparent: preview,
        orbit: !preview,
        requireGpu: preview && !allowSoftwareRenderer,
      })
    } catch {
      latest.current.onStatus?.({
        phase: "error",
        message: "WebGL with hardware acceleration is not available on this device.",
      })
      return
    }
    stageRef.current = stage
    stage.setLighting(latest.current.lighting)
    const policy = defaultResolutionPolicy()
    let envelope: Scope3DMotionEnvelope | null = null
    let director: Scope3DDirector | null = null
    let animator: Scope3DAnimator | null = null
    let ssaaCap = Infinity
    const frame: Scope3DFrameStats = {
      fps: 0,
      calls: 0,
      triangles: 0,
      cpuMs: 0,
      quality: stage.quality,
      canvasPx: [0, 0],
      internalPx: [0, 0],
      governed: false,
      sleeping: false,
      envelopeMs: 0,
    }

    const applyQuality = () => {
      const auto = chooseQuality(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio, policy)
      const { pixelRatio: pr, ssaa: ss } = latest.current
      stage.setQuality({
        pixelRatio: pr ?? auto.pixelRatio,
        ssaa: ss ?? Math.min(auto.ssaa, ssaaCap),
      })
      const { canvas: c, internal } = stage.resolution
      Object.assign(frame, { quality: stage.quality, canvasPx: c, internalPx: internal })
    }
    applyQualityRef.current = applyQuality

    // Readiness: the first frame with Scope in it, at the canvas's real size.
    let firstFrame: "waiting" | "rendered" = "waiting"
    const presentFirstFrame = () => {
      if (firstFrame !== "waiting" || !director || canvas.clientWidth === 0 || canvas.clientHeight === 0) return
      firstFrame = "rendered"
      director.tick(0)
      stage.render()
      // Double rAF: the first callback runs before that frame is composited, the second after.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!abort.signal.aborted) latest.current.onFirstFrame?.()
        }),
      )
    }

    const resize = () => {
      stage.resize(canvas.clientWidth, canvas.clientHeight)
      applyQuality()
      if (envelope) stage.frame(envelope, PREVIEW_DIRECTION)
      presentFirstFrame()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    let last = performance.now()
    let fpsFrames = 0
    let fpsSince = last
    let cpuSum = 0
    let windowStart = last
    let frameMs: number[] = []
    let slowWindows = 0
    const loop = (now: number) => {
      frameMs.push(now - last)
      const dt = Math.min((now - last) / 1000, MAX_DT_S)
      last = now
      const t0 = performance.now()
      director?.tick(dt)
      Object.assign(frame, stage.render())
      cpuSum += performance.now() - t0
      fpsFrames++
      if (now - fpsSince >= 500) {
        frame.fps = (fpsFrames * 1000) / (now - fpsSince)
        frame.cpuMs = cpuSum / fpsFrames
        fpsFrames = 0
        cpuSum = 0
        fpsSince = now
      }
      // Governor (automatic quality only; lab overrides are left alone):
      // supersampling steps down first, the shadow pass goes last.
      if (now - windowStart >= GOVERNOR_WINDOW_S * 1000) {
        slowWindows = tooSlow(frameMs) ? slowWindows + 1 : 0
        if (slowWindows >= GOVERNOR_SLOW_WINDOWS && latest.current.ssaa === undefined) {
          slowWindows = 0
          if (stage.quality.ssaa > 1) {
            ssaaCap = stage.quality.ssaa - 1
            applyQuality()
            frame.governed = true
          } else if (stage.shadowsOn) {
            stage.allowShadows(false)
            frame.governed = true
          }
        }
        windowStart = now
        frameMs = []
      }
    }

    // Render only while Scope is on screen, the tab is visible and nothing holds it.
    let onScreen = true
    const setRunning = () => {
      const run = onScreen && document.visibilityState === "visible" && !latest.current.paused
      frame.sleeping = !run
      if (run) {
        last = fpsSince = windowStart = performance.now()
        fpsFrames = cpuSum = slowWindows = 0
        frameMs = []
      }
      stage.renderer.setAnimationLoop(run ? loop : null)
    }
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      setRunning()
    })
    visibility.observe(canvas)
    document.addEventListener("visibilitychange", setRunning)
    setRunning()
    setRunningRef.current = setRunning

    latest.current.onStatus?.({ phase: "loading", loaded: 0, total: null })
    loadScope3DModel(
      modelUrl,
      (loaded, total) => latest.current.onStatus?.({ phase: "loading", loaded, total }),
      abort.signal,
    )
      .then(async (model) => {
        if (abort.signal.aborted) return disposeScope3DModel(model)
        modelRef.current = model
        model.setGrain(latest.current.lighting.grain)
        stage.add(model.root, model.meshes)
        animator = new Scope3DAnimator(model.root, model.gltf.animations)
        const secondary = new Scope3DSecondary(model.root)
        if (preview) {
          const t0 = performance.now()
          envelope =
            latest.current.knownEnvelope ?? measureMotionEnvelope(model.root, animator, secondary, PREVIEW_DIRECTION)
          frame.envelopeMs = performance.now() - t0
          stage.frame(envelope, PREVIEW_DIRECTION)
        }
        const newDirector = new Scope3DDirector(animator, { reducedMotion: latest.current.reduced }, secondary)
        // Every shader before the first frame: in parallel where the browser
        // supports it, instead of one long main-thread stall on frame one.
        await stage.renderer.compileAsync(stage.scene, stage.camera)
        if (abort.signal.aborted) return
        director = newDirector
        directorRef.current = director
        latest.current.onStatus?.({ phase: "ready" })
        latest.current.onReady?.({ stage, model, animator, secondary, director, frame: () => ({ ...frame }) })
        presentFirstFrame()
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return
        latest.current.onStatus?.({ phase: "error", message: error instanceof Error ? error.message : String(error) })
      })

    // Click on the model itself (not a drag of the orbit camera).
    let down: { x: number; y: number } | null = null
    const onPointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!down || !director) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved > CLICK_SLOP_PX) return
      const rect = canvas.getBoundingClientRect()
      if (stage.hit(e.clientX - rect.left, e.clientY - rect.top)) director.click()
    }
    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointerup", onPointerUp)

    // Site: a pointer cursor over Scope only — the rest of the canvas is empty
    // space. Raycasting the skinned shell isn't free: at most every HOVER_MS.
    let hoverAt = 0
    const onPointerMove = (e: PointerEvent) => {
      if (!preview || !director || e.pointerType !== "mouse" || e.timeStamp - hoverAt < HOVER_MS) return
      hoverAt = e.timeStamp
      const rect = canvas.getBoundingClientRect()
      canvas.style.cursor = stage.hit(e.clientX - rect.left, e.clientY - rect.top) ? "pointer" : ""
    }
    canvas.addEventListener("pointermove", onPointerMove)

    const onContextLost = (e: Event) => {
      e.preventDefault()
      stage.renderer.setAnimationLoop(null)
      latest.current.onStatus?.({ phase: "error", message: "The WebGL context was lost." })
    }
    canvas.addEventListener("webglcontextlost", onContextLost)

    return () => {
      abort.abort()
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      observer.disconnect()
      visibility.disconnect()
      document.removeEventListener("visibilitychange", setRunning)
      stage.renderer.setAnimationLoop(null)
      animator?.dispose()
      if (modelRef.current) disposeScope3DModel(modelRef.current)
      modelRef.current = null
      directorRef.current = null
      applyQualityRef.current = () => {}
      setRunningRef.current = () => {}
      stage.dispose()
      stageRef.current = null
    }
  }, [modelUrl, mode, allowSoftwareRenderer])

  React.useEffect(() => {
    applyQualityRef.current()
  }, [pixelRatio, ssaa])

  // `latest` (synced by the first effect, which runs before this one) already holds it.
  React.useEffect(() => {
    setRunningRef.current()
  }, [paused])

  React.useEffect(() => {
    const director = directorRef.current
    if (director && director.behaviorConfig.reducedMotion !== reduced) director.setConfig({ reducedMotion: reduced })
  }, [reduced])

  React.useEffect(() => {
    stageRef.current?.setLighting(lighting)
    modelRef.current?.setGrain(lighting.grain)
  }, [lighting])

  return (
    <canvas
      ref={canvasRef}
      // Studio orbits with touch; on the site the page must keep scrolling over Scope.
      className={cn("block size-full outline-none", mode === "studio" && "touch-none", className)}
      aria-label={
        mode === "studio" ? "Scope 3D. Drag to orbit, scroll to zoom, click Scope to play with it." : "Scope"
      }
    />
  )
}

export { Scope3DViewer }
