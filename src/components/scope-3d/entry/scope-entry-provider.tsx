"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useMounted } from "@/hooks/use-mounted"

import { INITIAL_SCOPE_ENTRY, scopeEntryReducer, type ScopeEntryPhase } from "./scope-entry-machine.ts"
import { ScopeEntryScreen } from "./scope-entry-screen"

/**
 * How long the entry screen waits for Scope 3D before letting the visitor in
 * with the prerendered still (`fallback`). Counted in VISIBLE time only.
 * 12 s ≈ the GLB (0.7 MB) + three.js (~0.2 MB) at ~0.6 Mbit/s effective,
 * plus initialisation: slower than that, the visitor has waited long enough
 * — Scope still upgrades to 3D in place if it arrives later.
 */
export const SCOPE_ENTRY_TIMEOUT_MS = 12_000

interface ScopeEntryContextValue {
  phase: ScopeEntryPhase
  /** The live 3D Scope is ready (else the prerendered still stands in). */
  live: boolean
  /** The site is visible: no entry screen on this route, or it has gone. */
  revealed: boolean
  /** Scope 3D has rendered its first real frame in its final place. */
  reportScopeReady: () => void
  /** No WebGL, the GLB failed, the context was lost… */
  reportScopeFailed: (reason: string) => void
}

const ScopeEntryContext = React.createContext<ScopeEntryContextValue | null>(null)

/** Runs `onTimeout` after `ms` of the page being visible (pauses while hidden). */
function useVisibleTimeout(active: boolean, ms: number, onTimeout: () => void) {
  React.useEffect(() => {
    if (!active) return
    let left = ms
    let since = 0
    let timer: number | undefined
    const pause = () => {
      if (timer === undefined) return
      window.clearTimeout(timer)
      timer = undefined
      left -= performance.now() - since
    }
    const resume = () => {
      if (timer !== undefined) return
      since = performance.now()
      timer = window.setTimeout(onTimeout, Math.max(0, left))
    }
    const sync = () => (document.hidden ? pause() : resume())
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => {
      pause()
      document.removeEventListener("visibilitychange", sync)
    }
  }, [active, ms, onTimeout])
}

// The entry ("Scope está explorando"): on `entryRoutes`, a full-screen
// loader covers the site until the ONE companion Scope (companion-scope.tsx)
// reports that its 3D is really on screen — or until it fails / times out,
// when the visitor gets in with the prerendered still. The site renders and
// initialises behind it the whole time; the exit only uncovers it.
//
// Lives in the root layout, so a client-side navigation never shows it again
// once complete: the companion (and its WebGL scene) stays mounted.
function ScopeEntryProvider({
  entryRoutes,
  children,
}: {
  entryRoutes: readonly string[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const mounted = useMounted()
  const [state, dispatch] = React.useReducer(scopeEntryReducer, INITIAL_SCOPE_ENTRY)
  const covering = entryRoutes.includes(pathname) && state.phase !== "complete"

  const timeout = React.useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[scope-entry] Scope 3D not ready after ${SCOPE_ENTRY_TIMEOUT_MS} ms: entering with the still.`)
    }
    dispatch({ type: "timeout" })
  }, [])
  useVisibleTimeout(covering && state.phase === "loading", SCOPE_ENTRY_TIMEOUT_MS, timeout)

  const reportScopeReady = React.useCallback(() => dispatch({ type: "scope-ready" }), [])
  const reportScopeFailed = React.useCallback((reason: string) => {
    if (process.env.NODE_ENV !== "production") console.warn(`[scope-entry] Scope 3D unavailable: ${reason}`)
    dispatch({ type: "scope-failed" })
  }, [])
  const onExitStarted = React.useCallback(() => dispatch({ type: "exit-started" }), [])
  const onExitFinished = React.useCallback(() => dispatch({ type: "exit-finished" }), [])

  const value = React.useMemo<ScopeEntryContextValue>(
    () => ({
      phase: state.phase,
      live: state.live,
      revealed: !covering,
      reportScopeReady,
      reportScopeFailed,
    }),
    [state.phase, state.live, covering, reportScopeReady, reportScopeFailed],
  )

  // `inert` only once hydrated: server-rendered, it would leave the site
  // unusable for anyone whose JavaScript never runs (the screen itself
  // fades away on its own in that case, see globals.css).
  const blocked = covering && mounted
  return (
    <ScopeEntryContext.Provider value={value}>
      <div className="contents" inert={blocked} aria-busy={blocked || undefined}>
        {children}
      </div>
      {covering ? (
        <ScopeEntryScreen phase={state.phase} onExitStarted={onExitStarted} onExitFinished={onExitFinished} />
      ) : null}
    </ScopeEntryContext.Provider>
  )
}

function useScopeEntry() {
  const context = React.useContext(ScopeEntryContext)
  if (!context) throw new Error("useScopeEntry must be used within a ScopeEntryProvider")
  return context
}

export { ScopeEntryProvider, useScopeEntry }
