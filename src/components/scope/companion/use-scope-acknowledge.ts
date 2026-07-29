"use client"

import { useScopeDockContext } from "./scope-dock-context"

// For any hoverable element that wants Scope to notice it — "Scope may
// acknowledge it... only one reaction... less than one second, then Scope
// naturally returns to idle" per the companion-system brief. Wire the
// returned function to onMouseEnter/onFocus; no onMouseLeave/onBlur
// counterpart is needed, the acknowledgment already self-resolves on a
// timer (see companion-scope.tsx's ACKNOWLEDGE_HOLD_MS).
function useScopeAcknowledge() {
  const { acknowledge } = useScopeDockContext()
  return acknowledge
}

export { useScopeAcknowledge }
