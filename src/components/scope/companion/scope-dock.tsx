"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { ScopeDockConfig } from "./scope-docks"
import { useScopeDockContext } from "./scope-dock-context"

interface ScopeDockProps extends Omit<React.ComponentProps<"div">, "id"> {
  id: string
  config?: ScopeDockConfig
}

// The layout-side half of the companion system. Renders an invisible
// placeholder occupying the visual slot Scope should rest in (e.g. inside
// HeroMedia, where a literal <Scope> used to render directly) and
// registers itself with ScopeDockProvider — the actual <Scope> is one
// shared instance rendered by CompanionScope, which measures this
// element's position and travels there. Size this element exactly the way
// Scope should read while resting here (e.g. `size-40 sm:size-48`).
//
// Registration runs in a layout effect, not a plain effect, so it resolves
// before the browser's first paint — see companion-scope.tsx's own
// useLayoutEffect for why (together they avoid a visible flash at (0,0)
// on first load).
function ScopeDock({ id, config, className, ...props }: ScopeDockProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { registerDock, unregisterDock, updateDockConfig } = useScopeDockContext()

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    registerDock(id, element, config ?? {})
    return () => unregisterDock(id)
    // config is only the *initial* config at registration — docks describe a
    // fixed resting spot for almost every caller, but see the effect below
    // for the one section (SPR-009's Contact) whose config legitimately
    // changes after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, registerDock, unregisterDock])

  // SPR-009: keyed on the individual config fields, not the `config` object
  // reference — every existing call site passes a fresh object literal
  // (e.g. `config={{ mood: "idle" }}`) on every render, which would fire
  // this effect on every single render if it depended on the object itself.
  // Keying on the primitive values means it only fires when a value
  // genuinely changes, which is zero times for every dock except Contact's.
  React.useEffect(() => {
    updateDockConfig(id, config ?? {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, config?.mood, config?.scale, config?.facing, config?.attentionTarget, updateDockConfig])

  return (
    <div
      ref={ref}
      data-slot="scope-dock"
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      {...props}
    />
  )
}

export { ScopeDock }
