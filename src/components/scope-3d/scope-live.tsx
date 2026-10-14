"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import type { ScopeMood } from "@/components/scope/scope.types"
import { cn } from "@/lib/utils"

import type { AutonomousBehavior } from "./behavior/scope-3d-config.ts"
import type { Scope3DDirector } from "./engine/scope-3d-director.ts"
import { DEFAULT_SCOPE_3D_LIGHTING } from "./engine/scope-3d-stage.ts"
import { SCOPE_3D_WEB_ENVELOPE } from "./engine/scope-3d-web-envelope.ts"
import { useScopeEntry } from "./entry/scope-entry-provider"
import { SCOPE_3D_MODEL_URL, SCOPE_3D_STILL_URL } from "./scope-3d-assets.ts"
import type { Scope3DViewerHandle, Scope3DViewerStatus } from "./scope-3d-viewer"

// three.js stays out of the page's main bundle: it loads after hydration,
// behind the entry screen, in its own chunk.
const Scope3DViewer = dynamic(() => import("./scope-3d-viewer").then((m) => m.Scope3DViewer), { ssr: false })

/**
 * The page's moods (docks, hover acknowledgements, Contact's beats, the theme
 * curtain) as the approved clips that read the same. Requested through the
 * state machine: honoured only while Scope is idle, never cutting anything.
 * "idle" asks for nothing; Stretch and Laugh stay click-only.
 */
const MOOD_BEHAVIOR: Partial<Record<ScopeMood, AutonomousBehavior>> = {
  curious: "Tilt",
  observe: "Focus",
  thinking: "Focus",
  happy: "Bounce",
}

/**
 * Development only: `?scope3d-software` lets the live model run on software
 * WebGL (machines without a GPU, headless test browsers). Production always
 * refuses it (~3 FPS) and shows the still instead.
 */
function useSoftwareWebGLOverride() {
  return React.useSyncExternalStore(
    () => () => {},
    () => process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("scope3d-software"),
    () => false,
  )
}

interface ScopeLiveProps {
  mood: ScopeMood
  className?: string
}

// The site's Scope: the approved 3D model with its autonomous behaviour and
// click reaction (Stretch -> Laugh -> Idle). The prerendered still sits
// underneath in exactly the same place (same camera), so whatever happens —
// loading, no WebGL, a lost context — there is always the same Scope there.
//
// Pointer clicks are raycast on the model itself (scope-3d-viewer.tsx): the
// empty canvas around Scope doesn't react. The button around it is for
// keyboards and assistive tech only.
function ScopeLive({ mood, className }: ScopeLiveProps) {
  const { phase, revealed, live, reportScopeReady, reportScopeFailed } = useScopeEntry()
  // Behind the entry screen only the first frame matters: the render loop
  // waits, leaving the device to the loader, and starts with the exit.
  const covered = !revealed && phase !== "exiting"
  const allowSoftware = useSoftwareWebGLOverride()
  const [presented, setPresented] = React.useState(false)
  const director = React.useRef<Scope3DDirector | null>(null)
  const showLive = presented && live

  const onReady = React.useCallback((handle: Scope3DViewerHandle) => {
    director.current = handle.director
    // Development only: lets browser tests read the state machine.
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __scope3d: handle })
  }, [])
  const onFirstFrame = React.useCallback(() => {
    setPresented(true)
    reportScopeReady()
  }, [reportScopeReady])
  const onStatus = React.useCallback(
    (status: Scope3DViewerStatus) => {
      if (status.phase !== "error") return
      director.current = null
      setPresented(false)
      reportScopeFailed(status.message)
    },
    [reportScopeFailed],
  )

  const previousMood = React.useRef(mood)
  React.useEffect(() => {
    if (mood === previousMood.current) return
    previousMood.current = mood
    const behavior = MOOD_BEHAVIOR[mood]
    if (behavior) director.current?.request(behavior)
  }, [mood])

  return (
    <div className={cn("relative", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size local still, no optimisation needed */}
      <img
        src={SCOPE_3D_STILL_URL}
        alt=""
        aria-hidden="true"
        decoding="async"
        className={cn(
          "pointer-events-none absolute inset-0 size-full transition-opacity duration-500",
          showLive && "opacity-0",
        )}
      />
      <button
        type="button"
        aria-label="Play with Scope"
        aria-hidden={!showLive || undefined}
        tabIndex={showLive ? 0 : -1}
        // Keyboard only (detail 0): pointer clicks are raycast on the model.
        onClick={(e) => {
          if (e.detail === 0) director.current?.click()
        }}
        className="focus-visible:outline-ring pointer-events-none absolute inset-0 rounded-full outline-offset-2 focus-visible:outline-2"
      >
        <Scope3DViewer
          modelUrl={SCOPE_3D_MODEL_URL}
          mode="preview"
          lighting={DEFAULT_SCOPE_3D_LIGHTING}
          envelope={SCOPE_3D_WEB_ENVELOPE}
          allowSoftwareRenderer={allowSoftware}
          paused={covered}
          onReady={onReady}
          onFirstFrame={onFirstFrame}
          onStatus={onStatus}
          className={cn("transition-opacity duration-500", showLive ? "pointer-events-auto" : "opacity-0")}
        />
      </button>
    </div>
  )
}

export { ScopeLive }
