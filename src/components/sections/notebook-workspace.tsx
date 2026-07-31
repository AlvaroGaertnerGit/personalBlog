"use client"

import * as React from "react"

import { ScopeDock, useScopeAcknowledge } from "@/components/scope/companion"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"
import { cn } from "@/lib/utils"
import { NotebookDocument } from "./notebook-document"
import type { ResearchThread } from "./notebook-content"

interface NotebookWorkspaceProps {
  threads: readonly ResearchThread[]
}

// A quiet line drawn between two related threads' index entries — the
// section's one "haven't seen this before" moment (SPR-008.1): a corkboard-
// string metaphor for "these ideas connect," computed purely from DOM
// geometry (getBoundingClientRect on each item), never described in copy.
// A fixed, generously-oversized stroke-dasharray stands in for each path's
// exact length (these are short segments between vertically stacked list
// items — no path here plausibly exceeds it), avoiding a getTotalLength()
// measurement pass for what's a decorative flourish, not precision inking.
// Stroked in --scope-warm rather than a neutral like --muted-foreground —
// the same accent already used for the ball-trail path in the Projects
// worlds (worlds/tournamently-world.tsx) — so the one hand-drawn detail in
// the section reads as Scope's own mark on the page (its dock sits right
// above this index), not an unthemed placeholder line.
const LINE_DASH_LENGTH = 300

interface ConnectingLine {
  id: string
  d: string
}

// The Open Notebook's interactive workspace (SPR-008.1, replacing the
// scroll-through pages from SPR-008) — the section's one client leaf.
// Built on Tabs/TabsList/TabsTrigger (src/components/ui/tabs.tsx), the same
// primitive about-workbench.tsx already uses for "selecting one thing
// changes displayed content" — real ARIA tablist/tab roles and keyboard
// roving-tabindex navigation come for free, restyled here from scratch
// (no boxed pill look) so it reads as a quiet index, not tabs. The index
// stays a vertical list at every breakpoint on purpose, not just desktop:
// TabsList's own base styling ties vertical orientation to `flex-col`
// unconditionally (`group-data-vertical/tabs:flex-col` in tabs.tsx, not
// gated to a breakpoint), so reflowing it into a horizontal strip on
// mobile would fight the primitive's own styling rather than compose with
// it — and a horizontally-scrolling strip nested inside a vertically-
// scrolling page is its own common mobile usability complaint. A vertical
// list of seven short labels reads fine at any width.
//
// The "physical placement" transition on the document panel is plain CSS,
// not Framer Motion, keyed off TabsPanel's own documented transition-state
// data attributes (data-starting-style / data-ending-style — see
// node_modules/@base-ui/react/tabs/panel/TabsPanel.js). TabsPanel fully
// unmounts/remounts each panel on its own CSS-transition-completion timer
// (keepMounted defaults false) — that timer doesn't compose cleanly with
// Framer's AnimatePresence, which expects to own mount/unmount itself, so
// routing the transition through the primitive's own CSS hooks avoids
// fighting it. (Verified this doesn't hang under prefers-reduced-motion:
// base-ui's useAnimationsFinished resolves immediately via
// Promise.all([]) when the panel has zero running CSS animations/
// transitions — see useAnimationsFinished.js — so stripping the transition
// classes below is safe, not a stuck-mounted risk.)
function NotebookWorkspace({ threads }: NotebookWorkspaceProps) {
  const [activeId, setActiveId] = React.useState(threads[0].id)
  const acknowledge = useScopeAcknowledge()
  const isReduced = useIsReducedMotion()

  const indexRef = React.useRef<HTMLDivElement>(null)
  const itemRefs = React.useRef(new Map<string, HTMLElement>())
  const [lines, setLines] = React.useState<ConnectingLine[]>([])

  const activate = React.useCallback(
    (id: string) => {
      setActiveId(id)
      acknowledge()
    },
    [acknowledge]
  )

  // A stable callback (not a fresh closure per item per render) — an inline
  // per-item arrow function here would get a new identity on every render,
  // causing React to detach/reattach the ref on every re-render even though
  // the underlying DOM node never changed. TabsTrigger's own composite-list
  // registration (base-ui's useCompositeItem) reacts to attach/detach, so
  // that churn was corrupting its internal ordering and silently breaking
  // arrow-key navigation between tabs. Reading the id back off the element's
  // own data attribute (rather than closing over `thread.id`) is what keeps
  // this callback's identity constant across renders.
  const setItemRef = React.useCallback((el: HTMLElement | null) => {
    if (!el) return
    const id = el.dataset.threadId
    if (id) itemRefs.current.set(id, el)
  }, [])

  React.useEffect(() => {
    function computeLines() {
      const container = indexRef.current
      const activeThread = threads.find((thread) => thread.id === activeId)
      const relatedIds = activeThread?.relatedIds
      if (!container || !relatedIds || relatedIds.length === 0) {
        setLines([])
        return
      }

      const containerRect = container.getBoundingClientRect()
      const fromEl = itemRefs.current.get(activeId)
      if (!fromEl) return
      const fromRect = fromEl.getBoundingClientRect()
      const fromX = fromRect.right - containerRect.left
      const fromY = fromRect.top - containerRect.top + fromRect.height / 2

      const next: ConnectingLine[] = []
      for (const relatedId of relatedIds) {
        const toEl = itemRefs.current.get(relatedId)
        if (!toEl) continue
        const toRect = toEl.getBoundingClientRect()
        const toX = toRect.right - containerRect.left
        const toY = toRect.top - containerRect.top + toRect.height / 2
        const midY = (fromY + toY) / 2
        next.push({
          id: `${activeId}-${relatedId}`,
          d: `M ${fromX} ${fromY} Q ${fromX + 20} ${midY} ${toX} ${toY}`,
        })
      }
      setLines(next)
    }

    computeLines()
    window.addEventListener("resize", computeLines)
    return () => window.removeEventListener("resize", computeLines)
  }, [activeId, threads])

  return (
    <Tabs
      value={activeId}
      onValueChange={(value) => activate(value as string)}
      orientation="vertical"
      className="flex-col gap-10 sm:flex-row sm:gap-16"
    >
      <div className="flex flex-col gap-4 sm:w-56 sm:shrink-0">
        {/* Sized in the same ~112–192px range as every other dock's
            placeholder box (see the companion-system note in
            docs/CONTEXT.md §6) even though Scope should read small next to
            this index — `scale: 0.4` is what shrinks the rendered
            character, not the box. `pickActiveDock` compares raw
            intersectionRatio across docks, so a smaller box here would win
            "most visible" after less scroll than its neighbors and steal
            Scope prematurely. */}
        <ScopeDock
          id="notebook-workspace"
          config={{ mood: "observe", scale: 0.4 }}
          className="size-12 self-start sm:size-16"
        />

        <div ref={indexRef} className="relative">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block">
            {lines.map((line) => (
              <path
                key={line.id}
                d={line.d}
                fill="none"
                stroke="var(--scope-warm)"
                strokeOpacity={0.6}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={LINE_DASH_LENGTH}
                strokeDashoffset={0}
                className="animate-notebook-line-draw"
              />
            ))}
          </svg>

          <TabsList
            variant="line"
            className="w-full gap-1 rounded-none bg-transparent p-0"
          >
            {threads.map((thread) => {
              const isActive = thread.id === activeId
              return (
                <TabsTrigger
                  key={thread.id}
                  value={thread.id}
                  ref={setItemRef}
                  data-thread-id={thread.id}
                  className={cn(
                    "h-auto shrink-0 justify-start gap-2 rounded-none border-none bg-transparent px-0 py-2 text-left text-sm font-medium whitespace-nowrap after:hidden data-active:bg-transparent data-active:shadow-none",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "bg-foreground size-1 shrink-0 rounded-full transition-opacity",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {thread.topic}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      </div>

      <div className="min-h-64 flex-1">
        {threads.map((thread) => (
          <TabsContent
            key={thread.id}
            value={thread.id}
            className={cn(
              "outline-none",
              !isReduced &&
                "transition-[opacity,transform] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] data-starting-style:translate-y-2 data-starting-style:rotate-1 data-starting-style:opacity-0 data-ending-style:-translate-y-2 data-ending-style:-rotate-1 data-ending-style:opacity-0"
            )}
          >
            <NotebookDocument thread={thread} />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}

export { NotebookWorkspace }
