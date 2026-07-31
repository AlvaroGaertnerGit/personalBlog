"use client"

import * as React from "react"
import type { MotionValue } from "framer-motion"

import type { ScopeMood } from "@/components/scope/scope.types"
import { CompanionScope } from "./companion-scope"
import { DEFAULT_SCOPE_DOCK_CONFIG, type ScopeDockConfig } from "./scope-docks"

interface DockEntry {
  element: HTMLElement
  config: ScopeDockConfig
}

// The wrapper-level transform values CompanionScope's own dock-follow
// animation drives — see companion-scope.tsx. Exposed (not stored as React
// state — these are Framer MotionValues, imperative by design, the same
// convention every other MotionValue in this codebase follows) so an
// external orchestrator (ThemeTransitionProvider) can temporarily animate
// them directly instead of duplicating Scope's positioning mechanism.
interface ScopeMotionValues {
  x: MotionValue<number>
  y: MotionValue<number>
  scale: MotionValue<number>
  rotate: MotionValue<number>
}

interface ScopeDockContextValue {
  registerDock: (id: string, element: HTMLElement, config: ScopeDockConfig) => void
  unregisterDock: (id: string) => void
  /**
   * SPR-009: lets a dock's own config change after registration (e.g.
   * Contact's mood/attentionTarget shifting across its own scene lifecycle)
   * — every other dock's config is set once at mount and never touched
   * again, so this is additive, not a replacement for that convention.
   * Bumps `configVersion` so `getDockConfig`'s memoized consumer
   * (CompanionScope) actually re-renders — mutating the docks map alone
   * wouldn't, since it's a plain ref, not React state.
   */
  updateDockConfig: (id: string, config: ScopeDockConfig) => void
  activeDockId: string | null
  getDockElement: (id: string) => HTMLElement | null
  getDockConfig: (id: string) => Required<ScopeDockConfig>
  acknowledge: () => void
  isAcknowledging: boolean
  /**
   * SPR-006: true while an external orchestrator is commandeering Scope —
   * CompanionScope's own dock-follow effect stands down while this is true
   * (see companion-scope.tsx), mood is forced to `sceneMood` below, and
   * personality/presence are suspended. This context only owns the flag +
   * the raw motion values; the actual choreography lives in whichever
   * orchestrator called `beginSceneTransition()` (ThemeTransitionProvider,
   * src/components/theme/theme-transition-controller.tsx; SPR-009's Contact
   * departure sequence) — kept out of here on purpose, this is mechanism,
   * not policy.
   */
  isSceneTransitioning: boolean
  beginSceneTransition: () => void
  endSceneTransition: () => void
  /**
   * SPR-009: the mood substituted while `isSceneTransitioning` is true.
   * Defaults to "observe" — ThemeTransitionProvider never sets this, so its
   * existing behavior is unchanged; an orchestrator that needs a different
   * mood at different beats (e.g. Contact's departure walking away at
   * "idle" rather than "observe") calls `setSceneMood` and resets it back to
   * "observe" (or lets the next `beginSceneTransition()` reset it) when done.
   */
  sceneMood: ScopeMood
  setSceneMood: (mood: ScopeMood) => void
  /** Registered once by CompanionScope on mount; null before that. */
  registerScopeMotionValues: (values: ScopeMotionValues) => void
  getScopeMotionValues: () => ScopeMotionValues | null
  /** The stage every dock position (and Scope's own x/y) is measured against. */
  stageRef: React.RefObject<HTMLDivElement | null>
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

  const [isSceneTransitioning, setIsSceneTransitioning] = React.useState(false)
  const [sceneMood, setSceneMood] = React.useState<ScopeMood>("observe")
  const scopeMotionValuesRef = React.useRef<ScopeMotionValues | null>(null)

  // Bumped by updateDockConfig — a plain ref mutation (docks.current) never
  // triggers a re-render on its own, so this is what makes the memoized
  // context value below actually change identity and propagate to
  // CompanionScope's next render.
  const [configVersion, setConfigVersion] = React.useState(0)

  const beginSceneTransition = React.useCallback(() => {
    // Reset to the default every time a new sequence begins, so an
    // orchestrator that doesn't care about mood (ThemeTransitionProvider)
    // keeps today's exact behavior, and one that does (Contact's departure
    // sequence) starts from a known baseline rather than whatever the last
    // orchestrator left behind.
    setSceneMood("observe")
    setIsSceneTransitioning(true)
  }, [])
  const endSceneTransition = React.useCallback(() => setIsSceneTransitioning(false), [])
  const registerScopeMotionValues = React.useCallback((values: ScopeMotionValues) => {
    scopeMotionValuesRef.current = values
  }, [])
  const getScopeMotionValues = React.useCallback(() => scopeMotionValuesRef.current, [])

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

  // SPR-009: unlike registerDock, this is called after mount, whenever a
  // dock's own config legitimately changes across its section's lifecycle
  // (e.g. Contact's mood/attentionTarget shifting from arrival to writing).
  // Every other dock never calls this — a static config set once at
  // registration remains the norm.
  const updateDockConfig = React.useCallback((id: string, config: ScopeDockConfig) => {
    const entry = docks.current.get(id)
    if (!entry) return
    entry.config = config
    setConfigVersion((v) => v + 1)
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
    // configVersion isn't read in the body — docks.current is a ref, read
    // fresh on every call regardless — but including it here is what gives
    // this callback a new identity whenever updateDockConfig runs, which is
    // what the `value` memo below actually needs to recompute and propagate
    // to CompanionScope (see updateDockConfig's own comment).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configVersion]
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
      updateDockConfig,
      activeDockId,
      getDockElement,
      getDockConfig,
      acknowledge,
      isAcknowledging,
      isSceneTransitioning,
      beginSceneTransition,
      endSceneTransition,
      sceneMood,
      setSceneMood,
      registerScopeMotionValues,
      getScopeMotionValues,
      stageRef,
    }),
    [
      registerDock,
      unregisterDock,
      updateDockConfig,
      activeDockId,
      getDockElement,
      getDockConfig,
      acknowledge,
      isAcknowledging,
      isSceneTransitioning,
      beginSceneTransition,
      endSceneTransition,
      sceneMood,
      registerScopeMotionValues,
      getScopeMotionValues,
    ]
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
