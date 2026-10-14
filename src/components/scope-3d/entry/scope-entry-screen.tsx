"use client"

import * as React from "react"
import { preload } from "react-dom"

import { duration, easing } from "@/lib/motion"

import manifestJson from "../../../../public/scope/loader/manifest.json"
import { SCOPE_3D_MODEL_URL } from "../scope-3d-assets.ts"
import { ExplorationLine, type ExplorationLineHandle } from "./exploration-line"
import { LOADER_BASE, ScopeLoaderPlayer } from "./loader-player.ts"
import type { LoaderManifest } from "./loader-timeline.ts"
import type { ScopeEntryPhase } from "./scope-entry-machine.ts"

const manifest = manifestJson as LoaderManifest
/** Exit frame where the screen starts to fade: Scope has landed, eyes are arcs. */
const FADE_FROM_EXIT_FRAME = 21
/** If the drawn exit hasn't begun by then (it takes ≤ ~1.1 s), fade anyway. */
const EXIT_WATCHDOG_MS = 2_500

const bezier = (curve: readonly number[]) => `cubic-bezier(${curve.join(", ")})`
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

interface ScopeEntryScreenProps {
  phase: ScopeEntryPhase
  onExitStarted: () => void
  onExitFinished: () => void
}

// "Scope está explorando": the definitive Scope, prerendered from the
// approved model in Blender (render_loader.py), breathes, looks aside and
// blinks above a quiet line, until the live Scope 3D behind this screen has
// really rendered. Then Scope finishes what it was doing, hops happily, the
// line lights up, and the screen fades to reveal the site with the live
// Scope already in place.
//
// Not interactive and not a search field: no box, no caret, no focusable
// element, nothing that invites a click. Server-rendered, so it covers the
// site from the very first paint (the still frame is the first thing loaded).
function ScopeEntryScreen({ phase, onExitStarted, onExitFinished }: ScopeEntryScreenProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const stillRef = React.useRef<HTMLImageElement>(null)
  const lineRef = React.useRef<ExplorationLineHandle>(null)
  const playerRef = React.useRef<ScopeLoaderPlayer | null>(null)
  const playing = React.useRef(false)
  const watchdog = React.useRef<number | undefined>(undefined)
  // Each beat happens once, whichever path (drawn exit, watchdog, plain) gets there first.
  const once = React.useRef({ requested: false, started: false, fading: false })
  const latest = React.useRef({ onExitStarted, onExitFinished })
  React.useEffect(() => {
    latest.current = { onExitStarted, onExitFinished }
  })

  // The heavy assets start downloading with the HTML, not after hydration.
  preload(`${LOADER_BASE}/loop.avif`, { as: "image", type: "image/avif", fetchPriority: "high" })
  preload(SCOPE_3D_MODEL_URL, { as: "fetch", crossOrigin: "anonymous" })

  const startExit = React.useCallback(() => {
    if (once.current.started) return false
    once.current.started = true
    window.clearTimeout(watchdog.current)
    latest.current.onExitStarted()
    return true
  }, [])

  const fadeOut = React.useCallback((plain: boolean) => {
    if (once.current.fading) return
    once.current.fading = true
    const root = rootRef.current!
    const ms = (plain ? duration.slow : duration.slower) * 1000
    contentRef.current?.animate(
      [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: plain ? "scale(1)" : "scale(0.985)" }],
      { duration: ms * 0.8, easing: bezier(easing.inOut), fill: "forwards" },
    )
    root
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: bezier(easing.inOut), fill: "forwards" })
      .finished.then(() => latest.current.onExitFinished())
  }, [])

  // The waiting loop (none with reduced motion: the still frame stays).
  React.useEffect(() => {
    rootRef.current!.dataset.hydrated = ""
    if (prefersReducedMotion()) return
    const canvas = canvasRef.current!
    const player = new ScopeLoaderPlayer(canvas, manifest, {
      onExitStart() {
        if (!startExit()) return
        lineRef.current?.centre()
        lineRef.current?.glow()
      },
      onExitFrame(frame) {
        if (frame === FADE_FROM_EXIT_FRAME) fadeOut(false)
      },
      onExitEnd() {},
    })
    playerRef.current = player
    player
      .load()
      .then(() => {
        // The still IS the loop's first frame: swapping is invisible.
        canvas.style.opacity = "1"
        stillRef.current!.style.visibility = "hidden"
        playing.current = true
        player.start()
      })
      .catch(() => {
        // Sheets unavailable: the still frame keeps Scope on screen.
      })
    return () => {
      playing.current = false
      window.clearTimeout(watchdog.current)
      player.dispose()
      playerRef.current = null
    }
  }, [startExit, fadeOut])

  // Scope 3D is ready (or will not be): leave.
  React.useEffect(() => {
    if ((phase !== "ready" && phase !== "fallback") || once.current.requested) return
    once.current.requested = true
    const player = playerRef.current
    if (phase === "ready" && player && playing.current && !prefersReducedMotion()) {
      // Scope finishes its motion first (≤ ~1.1 s, loader-timeline.ts).
      player.requestExit()
      watchdog.current = window.setTimeout(() => {
        if (startExit()) fadeOut(true)
      }, EXIT_WATCHDOG_MS)
      return
    }
    // Fallback, reduced motion, or no drawing to play: a plain fade.
    startExit()
    fadeOut(true)
  }, [phase, startExit, fadeOut])

  return (
    <div
      ref={rootRef}
      data-scope-entry=""
      // w-screen, not inset-0: 100vw also covers the scrollbar gutter that
      // globals.css keeps reserved while the page behind can't scroll.
      className="bg-scope-night fixed inset-y-0 left-0 z-[100] flex w-screen items-center justify-center bg-[radial-gradient(ellipse_55%_45%_at_50%_44%,var(--scope-night-glow),transparent_70%)] px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <noscript>
        <style>{"[data-scope-entry]{display:none}"}</style>
      </noscript>
      <div
        ref={contentRef}
        className="flex flex-col items-center [--scope-h:min(clamp(136px,34vw,200px),30svh)]"
      >
        <div
          className="relative"
          style={{
            height: `calc(var(--scope-h) / ${manifest.scopeHeight})`,
            aspectRatio: `${manifest.width} / ${manifest.height}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the first paint: plain, eager, high priority */}
          <img
            ref={stillRef}
            src={`${LOADER_BASE}/still.webp`}
            alt=""
            width={manifest.width}
            height={manifest.height}
            fetchPriority="high"
            className="absolute inset-0 size-full"
          />
          <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full opacity-0" />
        </div>
        <p
          role="status"
          lang="es"
          className="text-scope-shell/80 mt-7 text-[13px] font-medium tracking-[0.04em] sm:text-sm"
        >
          Scope está explorando…
        </p>
        <ExplorationLine ref={lineRef} className="mt-5" />
      </div>
    </div>
  )
}

export { ScopeEntryScreen }
