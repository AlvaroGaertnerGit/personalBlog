// Run: node --test src/components/scope-3d/engine/scope-3d-framing.test.ts
//
// The site frames Scope on a precomputed envelope (scope-3d-web-envelope.ts)
// instead of measuring it at load. These checks keep that shortcut honest.

import assert from "node:assert/strict"
import { test } from "node:test"

import * as THREE from "three"

import { measureWebEnvelope, toData } from "../../../../assets/scope-3d/scripts/web/web-envelope.ts"
import {
  fitCameraToEnvelope,
  reduceEnvelope,
  SCOPE_3D_WEB_VIEW_DIRECTION,
  type Scope3DMotionEnvelope,
} from "./scope-3d-framing.ts"
import { SCOPE_3D_WEB_ENVELOPE } from "./scope-3d-web-envelope.ts"

const full = await measureWebEnvelope()

function fit(envelope: Scope3DMotionEnvelope, aspect: number) {
  const camera = new THREE.PerspectiveCamera(28, aspect, 0.01, 20) // Scope3DStage's camera
  const target = fitCameraToEnvelope(camera, envelope, SCOPE_3D_WEB_VIEW_DIRECTION)
  return { position: camera.position.clone(), target }
}

test("the stored envelope still matches public/scope/scope.glb (regenerate: web-envelope.ts --write)", () => {
  const fresh = toData(reduceEnvelope(full, SCOPE_3D_WEB_VIEW_DIRECTION))
  assert.deepEqual(toData(SCOPE_3D_WEB_ENVELOPE), fresh)
})

test("framing on the stored envelope = framing on the full measurement", () => {
  // Square docks on the site; other aspects in case a dock ever changes shape.
  for (const aspect of [1, 0.75, 1.6]) {
    const a = fit(full, aspect)
    const b = fit(SCOPE_3D_WEB_ENVELOPE, aspect)
    const mm = 1000
    assert.ok(a.position.distanceTo(b.position) * mm < 0.2, `aspect ${aspect}: camera ${a.position.distanceTo(b.position) * mm} mm off`)
    assert.ok(a.target.distanceTo(b.target) * mm < 0.2, `aspect ${aspect}: target ${a.target.distanceTo(b.target) * mm} mm off`)
  }
})

test("nothing of the full motion leaves the frame of the stored framing", () => {
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 20)
  fitCameraToEnvelope(camera, SCOPE_3D_WEB_ENVELOPE, SCOPE_3D_WEB_VIEW_DIRECTION)
  let worst = 0
  for (const p of full.points) {
    const q = p.clone().project(camera)
    worst = Math.max(worst, Math.abs(q.x), Math.abs(q.y))
  }
  assert.ok(worst <= 1, `a pose reaches ${worst.toFixed(4)} of the half-frame`)
})
