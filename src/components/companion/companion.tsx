import * as React from "react"

import { cn } from "@/lib/utils"

// The portfolio's signature visual mark — deliberately NOT an assistant
// avatar/orb (see the 21st.dev survey in this story's write-up: circular
// glowing "thinking orb" is the generic AI-chatbot cliché this exists to
// avoid). Built entirely from developer-native glyphs — a code bracket
// pair, a cursor, status lights — so it reads as "software engineering"
// rather than "entity waiting to chat."
//
// This file is intentionally presentational only, with zero AI/chat
// imports, and lives beside where a future `ChatPanel` (see the
// ai-companion skill) would land — same feature, different concern. If a
// later story wires this mark to the real companion chat, that's a
// composition change at the call site, not a rewrite of this component.
//
// `state` is a plain prop, not derived from anything yet: no scroll
// listener, no animation, no client boundary. A later story can either
// pass a different static `state` from the server, or wrap this component
// in a small client component that tracks scroll/interaction and re-renders
// it with the right state — this component itself never needs to change
// for that, which is the point of keeping it a pure function of `state`.
export type CompanionState = "idle" | "active" | "processing"

const STATE_LABEL: Record<CompanionState, string> = {
  idle: "idle",
  active: "active",
  processing: "processing",
}

// How many of the 3 status lights are "lit" per state — modeled on a
// build/signal-strength indicator, not a chat presence dot. A future story
// that adds real activity can animate which lights are lit over time
// without changing this table's shape.
const STATE_LIT_COUNT: Record<CompanionState, number> = {
  idle: 1,
  active: 2,
  processing: 3,
}

function CompanionMark({
  state = "idle",
  className,
  ...props
}: React.ComponentProps<"div"> & { state?: CompanionState }) {
  return (
    <div
      data-slot="companion-mark"
      data-state={state}
      aria-hidden="true"
      className={cn("flex flex-col items-center gap-4", className)}
      {...props}
    >
      <div className="text-foreground flex items-center gap-1 font-mono text-5xl font-medium">
        <span>{"{"}</span>
        <span
          className={cn(
            "h-8 w-0.5",
            state === "processing" ? "bg-foreground" : "bg-foreground/50"
          )}
        />
        <span>{"}"}</span>
      </div>

      <span className="bg-foreground/20 h-px w-8" />

      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full",
              i < STATE_LIT_COUNT[state] ? "bg-foreground/70" : "bg-foreground/20"
            )}
          />
        ))}
      </div>

      <span className="text-muted-foreground font-mono text-xs">
        companion · {STATE_LABEL[state]}
      </span>
    </div>
  )
}

export { CompanionMark }
