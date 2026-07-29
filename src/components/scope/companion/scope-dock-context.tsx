"use client"

import * as React from "react"

import { CompanionScope } from "./companion-scope"
import { DEFAULT_SCOPE_DOCK_CONFIG, type ScopeDockConfig } from "./scope-docks"

interface DockEntry {
  element: HTMLElement
  config: ScopeDockConfig
}

interface ScopeDockContextValue {
  registerDock: (id: string, element: HTMLElement, config: ScopeDockConfig) => void
  unregisterDock: (id: string) => void
  activeDockId: string | null
  getDockElement: (id: string) => HTMLElement | null
  getDockConfig: (id: string) => Required<ScopeDockConfig>
  acknowledge: () => void
  isAcknowledging: boolean
}

const ScopeDockContext = React.createContext<ScopeDockContextValue | null>(null)

// "One reaction... less than one second, then Scope naturally returns to
// idle" — the hover-acknowledgment hold time.
const ACKNOWLEDGE_HOLD_MS = 700

// The companion system's single source of truth: a registry of every
// mounted <ScopeDock> (see scope-dock.tsx) plus which one is currently
// "active" — the only thing that decides where the one shared <Scope>
// instance (rendered by CompanionScope, mounted here) should be resting.
//
// One shared IntersectionObserver for the whole registry, not one per dock
// — activity is decided by comparing intersection ratios centrally, so
// adding a future section's dock never adds a new observer instance.
function ScopeDockProvider({ children }: { children: React.ReactNode }) {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const docks = React.useRef(new Map<string, DockEntry>())
  const ratios = React.useRef(new Map<string, number>())
  const elementIds = React.useRef(new WeakMap<Element, string>())
  const observerRef = React.useRef<IntersectionObserver | null>(null)

  const [activeDockId, setActiveDockId] = React.useState<string | null>(null)
  const [isAcknowledging, setIsAcknowledging] = React.useState(false)
  const acknowledgeTimeout = React.useRef<number | undefined>(undefined)

  const pickActiveDock = React.useCallback(() => {
    let bestId: string | null = null
    let bestRatio = 0
    for (const [id, ratio] of ratios.current) {
      if (ratio > bestRatio) {
        bestRatio = ratio
        bestId = id
      }
    }
    // Only ever move to a dock that's actually visible — mid-transition
    // moments where nothing crosses a threshold keep the previous active
    // dock rather than flickering to null.
    if (bestId) setActiveDockId(bestId)
  }, [])

  const getObserver = React.useCallback(() => {
    if (observerRef.current || typeof IntersectionObserver === "undefined") {
      return observerRef.current
    }
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = elementIds.current.get(entry.target)
          if (id) ratios.current.set(id, entry.intersectionRatio)
        }
        pickActiveDock()
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    )
    return observerRef.current
  }, [pickActiveDock])

  const registerDock = React.useCallback(
    (id: string, element: HTMLElement, config: ScopeDockConfig) => {
      docks.current.set(id, { element, config })
      elementIds.current.set(element, id)
      // First dock to register wins immediately — the IntersectionObserver's
      // first callback is inherently asynchronous, and Scope should already
      // be sitting on its Hero platform, not waiting for that round trip.
      setActiveDockId((current) => current ?? id)
      getObserver()?.observe(element)
    },
    [getObserver]
  )

  const unregisterDock = React.useCallback((id: string) => {
    const entry = docks.current.get(id)
    if (entry) observerRef.current?.unobserve(entry.element)
    docks.current.delete(id)
    ratios.current.delete(id)
    setActiveDockId((current) =>
      current === id ? (docks.current.keys().next().value ?? null) : current
    )
  }, [])

  React.useEffect(() => {
    const observer = observerRef.current
    return () => {
      observer?.disconnect()
      window.clearTimeout(acknowledgeTimeout.current)
    }
  }, [])

  const getDockElement = React.useCallback(
    (id: string) => docks.current.get(id)?.element ?? null,
    []
  )

  const getDockConfig = React.useCallback(
    (id: string): Required<ScopeDockConfig> => ({
      ...DEFAULT_SCOPE_DOCK_CONFIG,
      ...docks.current.get(id)?.config,
    }),
    []
  )

  // Triggered directly from a hoverable element's onMouseEnter/onFocus (see
  // use-scope-acknowledge.ts) — a real event handler, not an effect, so
  // setting state here synchronously is the ordinary, correct pattern
  // (only setState-inside-useEffect is the anti-pattern react-hooks warns
  // about). Re-triggering while already acknowledging just restarts the
  // hold window rather than stacking a second reaction.
  const acknowledge = React.useCallback(() => {
    setIsAcknowledging(true)
    window.clearTimeout(acknowledgeTimeout.current)
    acknowledgeTimeout.current = window.setTimeout(() => setIsAcknowledging(false), ACKNOWLEDGE_HOLD_MS)
  }, [])

  const value = React.useMemo<ScopeDockContextValue>(
    () => ({
      registerDock,
      unregisterDock,
      activeDockId,
      getDockElement,
      getDockConfig,
      acknowledge,
      isAcknowledging,
    }),
    [registerDock, unregisterDock, activeDockId, getDockElement, getDockConfig, acknowledge, isAcknowledging]
  )

  return (
    <ScopeDockContext.Provider value={value}>
      {/* The shared "stage" every dock's position is measured relative to
          — a plain, layout-neutral position:relative box spanning the full
          page, so CompanionScope's absolute positioning inside it scrolls
          with the document instead of clinging to the viewport (never
          position:fixed, per the companion-system brief). */}
      <div ref={stageRef} className="relative">
        {children}
        <CompanionScope stageRef={stageRef} />
      </div>
    </ScopeDockContext.Provider>
  )
}

function useScopeDockContext() {
  const context = React.useContext(ScopeDockContext)
  if (!context) {
    throw new Error("useScopeDockContext must be used within a ScopeDockProvider")
  }
  return context
}

export { ScopeDockProvider, useScopeDockContext }
