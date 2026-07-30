"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

import { transitions } from "@/lib/motion"
import { cn } from "@/lib/utils"

// The session key deliberately lives in sessionStorage, not localStorage —
// "once per this browsing session," not "once ever." A new tab (or the
// browser closing) is a new introduction.
const GREETING_STORAGE_KEY = "scope:greeted"

const SHOW_DELAY_MS = 1000
const HOLD_MS = 2000

// The one and only exception to "Scope never speaks" (docs/scope-docs/scope
// — see SCOPE_UNDERSTANDING.md §6). Deliberately NOT part of the mood/
// personality system: Scope's own mood stays untouched throughout (it
// remains visually idle) — the text does the introducing, per the docs'
// restraint principle that Scope doesn't perform reactions to its own
// actions. A plain, quiet caption near Scope's Hero dock — no background,
// border, or tail, so it never reads as a chat bubble or speech balloon.
//
// Rendered as a sibling *outside* HeroMedia (see src/app/page.tsx), not
// inside it — HeroMedia's card has `overflow-hidden`, and floating text on
// the page itself reads as a cinematic caption, not UI trapped in a panel.
function ScopeGreeting({ className }: { className?: string }) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (sessionStorage.getItem(GREETING_STORAGE_KEY)) return

    const showTimer = window.setTimeout(() => {
      setVisible(true)
      sessionStorage.setItem(GREETING_STORAGE_KEY, "1")
    }, SHOW_DELAY_MS)

    return () => window.clearTimeout(showTimer)
  }, [])

  React.useEffect(() => {
    if (!visible) return
    const hideTimer = window.setTimeout(() => setVisible(false), HOLD_MS)
    return () => window.clearTimeout(hideTimer)
  }, [visible])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.p
          data-slot="scope-greeting"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitions.enterSlow}
          className={cn(
            "text-muted-foreground pointer-events-none text-center text-sm font-medium tracking-wide text-balance",
            className
          )}
        >
          Hi. I&apos;m Scope.
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}

export { ScopeGreeting }
