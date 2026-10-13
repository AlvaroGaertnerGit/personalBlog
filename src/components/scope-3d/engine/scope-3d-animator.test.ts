// Run: node --test src/components/scope-3d/engine/scope-3d-animator.test.ts
// The AnimationMixer needs no WebGL: these run on plain Object3Ds.

import assert from "node:assert/strict"
import { test } from "node:test"

import * as THREE from "three"

import { Scope3DAnimator } from "./scope-3d-animator.ts"

const FPS = 60

/** A rest-to-rest bump on one position axis, like every baked behaviour clip. */
function bump(name: string, axis: "x" | "y" | "z", duration: number, height: number) {
  const times = [0, duration / 2, duration]
  const values = times.flatMap((_, i) => {
    const v = [0, 0, 0]
    v["xyz".indexOf(axis)] = i === 1 ? height : 0
    return v
  })
  return new THREE.AnimationClip(name, duration, [new THREE.VectorKeyframeTrack("part.position", times, values)])
}

function rig() {
  const root = new THREE.Object3D()
  const part = new THREE.Object3D()
  part.name = "part"
  root.add(part)
  const idle = new THREE.AnimationClip("Idle", 2, [
    new THREE.VectorKeyframeTrack("part.position", [0, 1, 2], [0, 0, 0, 0, 0.01, 0, 0, 0, 0]),
  ])
  const animator = new Scope3DAnimator(root, [idle, bump("Short", "x", 0.5, 1), bump("Long", "z", 2, 1)])
  return { animator, part }
}

test("a clip finishing never makes another layer skip a frame", () => {
  // Regression: releasing inside the mixer's "finished" event reordered its
  // active list mid-update: the LAST active action moves into the freed slot
  // and skips that frame. So the clip that ends must start first (as an
  // interrupted Bounce before the click reaction).
  const { animator, part } = rig()
  animator.play("Short")
  animator.play("Long")
  let prevZ = part.position.z
  for (let i = 0; i < FPS * 1.5; i++) {
    animator.update(1 / FPS)
    const z = part.position.z
    // Long rises 1 unit over 1 s: ~0.017/frame. A skipped frame snaps z to 0.
    assert.ok(Math.abs(z - prevZ) < 0.05, `frame ${i}: z jumped ${prevZ.toFixed(3)} -> ${z.toFixed(3)}`)
    prevZ = z
  }
  assert.deepEqual(
    animator.active().map((a) => a.clip),
    ["Long"],
  )
})

test("fades are eased: the weight starts and lands with zero slope", () => {
  const { animator } = rig()
  animator.play("Long", { fadeInMs: 500 })
  const weights: number[] = []
  for (let i = 0; i <= FPS * 0.5; i++) {
    weights.push(animator.active()[0].weight)
    animator.update(1 / FPS)
  }
  const first = weights[2] - weights[1]
  const middle = weights[16] - weights[15]
  const last = weights[30] - weights[29]
  assert.ok(first < middle / 10, `start slope ${first} vs mid ${middle}`)
  assert.ok(last < middle / 10, `end slope ${last} vs mid ${middle}`)
})

test("a fade-out that interrupts a fade-in continues from the current weight", () => {
  const { animator } = rig()
  animator.play("Long", { fadeInMs: 400 })
  for (let i = 0; i < 12; i++) animator.update(1 / FPS) // halfway in
  const before = animator.active()[0].weight
  animator.stop("Long", 400)
  animator.update(1 / FPS)
  const after = animator.active()[0].weight
  assert.ok(before > 0.3 && before < 0.8, `mid-fade weight ${before}`)
  assert.ok(Math.abs(after - before) < 0.02, `weight jumped ${before} -> ${after}`)
  for (let i = 0; i < FPS; i++) animator.update(1 / FPS)
  assert.equal(animator.active().length, 0)
})

test("replaying a clip that is still playing hands over smoothly (no snap to rest)", () => {
  // The reduced-motion click answers a blink with the same blink.
  const { animator, part } = rig()
  animator.play("Long")
  for (let i = 0; i < FPS * 0.7; i++) animator.update(1 / FPS)
  let prevZ = part.position.z
  assert.ok(prevZ > 0.5, `mid-clip z ${prevZ}`)
  animator.stop("Long", 350)
  animator.play("Long", { fadeInMs: 120 })
  for (let i = 0; i < FPS; i++) {
    animator.update(1 / FPS)
    const z = part.position.z
    assert.ok(Math.abs(z - prevZ) < 0.06, `frame ${i}: z jumped ${prevZ.toFixed(3)} -> ${z.toFixed(3)}`)
    prevZ = z
  }
  assert.deepEqual(animator.active().map((a) => a.clip), ["Long"])
})
