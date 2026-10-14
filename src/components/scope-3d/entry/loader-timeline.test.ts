// Run: node --test src/components/scope-3d/entry/loader-timeline.test.ts

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { frameRect, nextLoopStep, type LoaderManifest } from "./loader-timeline.ts"

const manifest = JSON.parse(
  readFileSync(new URL("../../../../public/scope/loader/manifest.json", import.meta.url), "utf8"),
) as LoaderManifest

/** Steps from `start` until the exit begins; returns the frames shown on the way. */
function untilExit(start: number) {
  const shown: number[] = []
  let frame = start
  for (let i = 0; i < manifest.loop.frames * 2; i++) {
    const step = nextLoopStep(frame, true, manifest)
    if (step.sequence === "exit") return shown
    frame = step.frame
    shown.push(frame)
  }
  throw new Error(`no exit from frame ${start}`)
}

test("without an exit request the loop just plays, and wraps", () => {
  for (let f = 0; f < manifest.loop.frames; f++) {
    const step = nextLoopStep(f, false, manifest)
    assert.deepEqual(step, { sequence: "loop", frame: (f + 1) % manifest.loop.frames, crossfade: false })
  }
})

test("from every loop frame the exit begins, at the latest ~1.1 s later, always from a quiet frame", () => {
  let worst = 0
  for (let f = 0; f < manifest.loop.frames; f++) {
    const shown = untilExit(f)
    const last = shown.length ? shown[shown.length - 1] : f
    assert.ok(manifest.quiet.includes(last), `exit from frame ${last}, which is not quiet`)
    worst = Math.max(worst, shown.length / manifest.fps)
  }
  assert.ok(worst <= 1.15, `worst wait ${worst.toFixed(2)} s`)
})

test("quiet frames exit right away; the hold is skipped, crossfaded", () => {
  for (const q of manifest.quiet) assert.equal(nextLoopStep(q, true, manifest).sequence, "exit")
  const [start, end] = manifest.hold
  assert.deepEqual(nextLoopStep(start, true, manifest), { sequence: "loop", frame: end, crossfade: true })
  assert.deepEqual(nextLoopStep(end, true, manifest), { sequence: "loop", frame: end + 1, crossfade: false })
})

test("the manifest describes sheets that hold every frame", () => {
  for (const seq of [manifest.loop, manifest.exit]) {
    assert.ok(seq.columns * seq.rows >= seq.frames)
    const r = frameRect(seq.frames - 1, seq.columns, manifest)
    assert.ok(r.x + r.width <= seq.columns * manifest.width && r.y + r.height <= seq.rows * manifest.height)
  }
})
