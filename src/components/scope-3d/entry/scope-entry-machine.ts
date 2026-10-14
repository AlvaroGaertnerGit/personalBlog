// The site's entry ("Scope está explorando") as a pure state machine: no
// React, no timers, no DOM — scope-entry-machine.test.ts drives it directly.
//
//   loading ──scope-ready──────────▶ ready ──exit-started──▶ exiting ──exit-finished──▶ complete
//      └──scope-failed / timeout──▶ fallback ──exit-started──┘
//
// `live` is orthogonal: is the real Scope 3D on screen (true) or the
// prerendered still (false)? A Scope that becomes ready late — after the
// timeout — upgrades `live` without restarting anything, and a Scope that
// fails later (context lost) drops back to the still. Every event that
// doesn't apply to the current phase is ignored: duplicated or out-of-order
// signals can't produce a second exit.

export type ScopeEntryPhase = "loading" | "ready" | "exiting" | "complete" | "fallback"

export type ScopeEntryEvent =
  | { type: "scope-ready" }
  | { type: "scope-failed" }
  | { type: "timeout" }
  | { type: "exit-started" }
  | { type: "exit-finished" }

export interface ScopeEntryState {
  phase: ScopeEntryPhase
  /** The live 3D Scope is ready (else: the prerendered still stands in). */
  live: boolean
}

export const INITIAL_SCOPE_ENTRY: ScopeEntryState = { phase: "loading", live: false }

export function scopeEntryReducer(state: ScopeEntryState, event: ScopeEntryEvent): ScopeEntryState {
  switch (event.type) {
    case "scope-ready":
      if (state.phase === "loading") return { ...state, phase: "ready", live: true }
      return state.live ? state : { ...state, live: true }
    case "scope-failed":
      if (state.phase === "loading") return { ...state, phase: "fallback", live: false }
      return state.live ? { ...state, live: false } : state
    case "timeout":
      return state.phase === "loading" ? { ...state, phase: "fallback" } : state
    case "exit-started":
      return state.phase === "ready" || state.phase === "fallback"
        ? { ...state, phase: "exiting" }
        : state
    case "exit-finished":
      return state.phase === "exiting" ? { ...state, phase: "complete" } : state
  }
}

