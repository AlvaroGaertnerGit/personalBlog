"use client"

import { useScopeAcknowledge } from "@/components/scope/companion"

// A minimal hover/focus target proving the companion system's
// acknowledgment behavior — a real Projects section will replace these
// with actual project cards later; the acknowledge wiring itself doesn't
// change when that happens (see companion-scope.tsx for the mood logic).
function CompanionDemoCard({ label }: { label: string }) {
  const acknowledge = useScopeAcknowledge()

  return (
    <button
      type="button"
      onMouseEnter={acknowledge}
      onFocus={acknowledge}
      className="border-border bg-card/40 hover:border-foreground/20 hover:bg-card/70 focus-visible:ring-ring/50 flex flex-col gap-1 rounded-2xl border p-6 text-left transition-colors outline-none focus-visible:ring-3"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-muted-foreground text-xs">Scope notices on hover.</span>
    </button>
  )
}

export { CompanionDemoCard }
