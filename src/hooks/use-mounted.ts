"use client"

import { useSyncExternalStore } from "react"

const subscribeNoop = () => () => {}

// True only once the component has actually mounted on the client — false
// during SSR and the first client render, so that first render matches the
// server's exactly. useSyncExternalStore's getServerSnapshot/getSnapshot
// split is the React-blessed way to do this without a setState-in-effect
// (which the react-hooks/set-state-in-effect lint rule correctly flags as
// an anti-pattern) — originally established by useIsReducedMotion for the
// same class of hydration-mismatch problem, extracted here for reuse.
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
}

export { useMounted }
