"use client"

import * as React from "react"

import { useScopeAcknowledge } from "@/components/scope/companion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"
import { cn } from "@/lib/utils"
import type { AboutHotspot } from "./about-content"

interface AboutWorkbenchProps {
  hotspots: readonly AboutHotspot[]
  hint: string
  className?: string
}

// The interactive leaf of the About section (SPR-004.1, "The Workbench") —
// everything else in about-section.tsx is static and stays a Server
// Component. Built on shadcn/@base-ui's Tabs rather than hand-rolled
// buttons + state (see the ui-components skill: don't reimplement
// keyboard/ARIA logic an upstream primitive already provides) — each
// hotspot is a real tab, each revealed paragraph its own tabpanel, so
// screen readers and keyboard (arrow-key tablist navigation, which
// @base-ui's Tab already handles) get the correct semantics for free.
// Hovering/focusing a hotspot activates it too (on top of Tabs' own
// click/keyboard activation) so mouse exploration feels as immediate as the
// brief's "hover or tap to look closer" — and doubles as a real hoverable
// resting place for Scope's acknowledge reaction, same pattern used
// elsewhere in the companion system.
function AboutWorkbench({ hotspots, hint, className }: AboutWorkbenchProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const isReduced = useIsReducedMotion()
  const acknowledge = useScopeAcknowledge()
  const [isHovering, setIsHovering] = React.useState(false)
  const [activeId, setActiveId] = React.useState<string>(hotspots[0].id)

  const activate = React.useCallback(
    (id: string) => {
      setActiveId(id)
      acknowledge()
    },
    [acknowledge]
  )

  // Cursor spotlight — a positional-only effect (no easing/spring needed,
  // see use-scope-presence.ts for the same reasoning), so it's set as a raw
  // CSS custom property via a ref, never React state, exactly like
  // Presence's own cursor tracking: mousemove must never trigger a
  // re-render. The radial-gradient in the style prop below reads the
  // variable live — CSS custom properties resolve automatically wherever
  // referenced, no re-render required for it to update either.
  React.useEffect(() => {
    if (isReduced) return
    const root = rootRef.current
    if (!root) return

    function onPointerMove(event: PointerEvent) {
      const rect = root!.getBoundingClientRect()
      root!.style.setProperty("--spot-x", `${event.clientX - rect.left}px`)
      root!.style.setProperty("--spot-y", `${event.clientY - rect.top}px`)
    }

    root.addEventListener("pointermove", onPointerMove)
    return () => root.removeEventListener("pointermove", onPointerMove)
  }, [isReduced])

  return (
    <div
      ref={rootRef}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
      className={cn("relative", className)}
    >
      {!isReduced && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 transition-opacity duration-300",
            isHovering ? "opacity-100" : "opacity-0"
          )}
          style={{
            background:
              "radial-gradient(280px circle at var(--spot-x, 50%) var(--spot-y, 50%), color-mix(in oklch, var(--scope-warm) 16%, transparent), transparent 70%)",
          }}
        />
      )}

      <p className="text-muted-foreground mb-4 text-xs">{hint}</p>

      <Tabs
        value={activeId}
        onValueChange={(value) => activate(value as string)}
        orientation="vertical"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
          <TabsList
            variant="default"
            className="h-fit w-full flex-col items-stretch gap-2 bg-transparent p-0 sm:w-56 sm:shrink-0"
          >
            {hotspots.map((hotspot) => (
              <TabsTrigger
                key={hotspot.id}
                value={hotspot.id}
                onMouseEnter={() => activate(hotspot.id)}
                onFocus={() => activate(hotspot.id)}
                className="h-auto justify-start rounded-2xl border border-transparent px-4 py-3 text-left text-sm font-medium text-muted-foreground data-active:border-border/60 data-active:bg-card/60 data-active:text-foreground"
              >
                {hotspot.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1">
            {hotspots.map((hotspot) => (
              <TabsContent
                key={hotspot.id}
                value={hotspot.id}
                className="text-foreground text-lg leading-relaxed sm:text-xl"
              >
                {hotspot.text}
              </TabsContent>
            ))}
          </div>
        </div>
      </Tabs>
    </div>
  )
}

export { AboutWorkbench }
