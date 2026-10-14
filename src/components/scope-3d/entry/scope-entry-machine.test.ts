// Run: node --test src/components/scope-3d/entry/scope-entry-machine.test.ts

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  INITIAL_SCOPE_ENTRY,
  scopeEntryReducer,
  type ScopeEntryEvent,
  type ScopeEntryState,
} from "./scope-entry-machine.ts"

function run(...events: ScopeEntryEvent["type"][]): ScopeEntryState {
  return events.reduce((s, type) => scopeEntryReducer(s, { type } as ScopeEntryEvent), INITIAL_SCOPE_ENTRY)
}

test("happy path: loading -> ready -> exiting -> complete, live throughout", () => {
  assert.deepEqual(run("scope-ready"), { phase: "ready", live: true })
  assert.deepEqual(run("scope-ready", "exit-started"), { phase: "exiting", live: true })
  assert.deepEqual(run("scope-ready", "exit-started", "exit-finished"), { phase: "complete", live: true })
})

test("the loader never leaves before Scope is ready: exit events while loading are ignored", () => {
  assert.equal(run("exit-started").phase, "loading")
  assert.equal(run("exit-finished").phase, "loading")
  assert.equal(run("exit-started", "exit-finished").phase, "loading")
})

test("failure and timeout fall back to the still", () => {
  for (const cause of ["scope-failed", "timeout"] as const) {
    assert.deepEqual(run(cause), { phase: "fallback", live: false })
    assert.deepEqual(run(cause, "exit-started", "exit-finished"), { phase: "complete", live: false })
  }
})

test("no duplicated transitions: repeated or late signals change nothing", () => {
  const exiting = run("scope-ready", "exit-started")
  assert.equal(scopeEntryReducer(exiting, { type: "exit-started" }), exiting)
  assert.equal(scopeEntryReducer(exiting, { type: "scope-ready" }), exiting)
  assert.equal(scopeEntryReducer(exiting, { type: "timeout" }), exiting)
  const complete = run("scope-ready", "exit-started", "exit-finished")
  for (const type of ["scope-ready", "timeout", "exit-started", "exit-finished"] as const) {
    assert.equal(scopeEntryReducer(complete, { type }), complete, type)
  }
  // A timeout after Scope was ready is too late to matter.
  assert.equal(run("scope-ready", "timeout").phase, "ready")
})

test("Scope ready after the timeout upgrades to live without restarting the entry", () => {
  assert.deepEqual(run("timeout", "scope-ready"), { phase: "fallback", live: true })
  assert.deepEqual(run("timeout", "exit-started", "exit-finished", "scope-ready"), {
    phase: "complete",
    live: true,
  })
})

test("a live Scope that fails later (context lost) drops back to the still", () => {
  assert.deepEqual(run("scope-ready", "exit-started", "exit-finished", "scope-failed"), {
    phase: "complete",
    live: false,
  })
})
