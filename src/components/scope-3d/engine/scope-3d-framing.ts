// Motion envelope: the silhouette Scope can ever occupy from a given view,
// measured on the real skinned mesh across every clip. A fixed site-sized
// camera is framed on it, so nothing (the antenna tip at the top of Stretch,
// the Bounce apex, a LookAround turn) is ever cut by the canvas edge, whatever
// the state machine plays — without the slack an axis-aligned 3D box would
// add in perspective.

import * as THREE from "three"

import { DEFAULT_SCOPE_3D_BEHAVIOR } from "../behavior/scope-3d-config.ts"
import { IDLE_CLIP, type Scope3DAnimator } from "./scope-3d-animator.ts"
import type { Scope3DSecondary } from "./scope-3d-secondary.ts"

/**
 * Each clip is PLAYED at this rate (not seeked), so the antenna spring swings
 * exactly as it will live, and sampled every SAMPLE_EVERY steps (12 Hz).
 */
const SIM_FPS = 60
const SAMPLE_EVERY = 5
/** Keep simulating after a clip ends: the antenna is still settling. */
const SETTLE_S = 0.5
/** The shell is ~45 k vertices; every 8th still traces the silhouette within ~1.5 mm (inside the margin). */
const VERTEX_STRIDE = 8

/** Silhouette-extreme points of every sampled pose, plus their 3D bounds. */
export interface Scope3DMotionEnvelope {
  points: THREE.Vector3[]
  box: THREE.Box3
}

export function measureMotionEnvelope(
  root: THREE.Object3D,
  animator: Scope3DAnimator,
  secondary: Scope3DSecondary,
  viewDirection: THREE.Vector3,
): Scope3DMotionEnvelope {
  // Eyes and mouth sit inside the face cavity: the outer surfaces bound everything.
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !/Eyes|Mouth/.test(o.name)) meshes.push(o)
  })

  // Screen-plane axes of a camera looking along -viewDirection.
  const forward = viewDirection.clone().normalize().negate()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, forward)
  // 8 screen directions; the most extreme vertex along each, per pose.
  const axes = [-1, 0, 1]
    .flatMap((a) => [-1, 0, 1].map((b) => [a, b]))
    .filter(([a, b]) => a !== 0 || b !== 0)
    .map(([a, b]) => right.clone().multiplyScalar(a).addScaledVector(up, b).normalize())

  const points: THREE.Vector3[] = []
  const box = new THREE.Box3()
  const v = new THREE.Vector3()

  const sample = () => {
    root.updateMatrixWorld(true)
    const best = axes.map(() => ({ score: -Infinity, point: new THREE.Vector3() }))
    for (const mesh of meshes) {
      if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update()
      const count = mesh.geometry.attributes.position.count
      for (let i = 0; i < count; i += VERTEX_STRIDE) {
        mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld) // skinning + morphs
        box.expandByPoint(v)
        axes.forEach((axis, k) => {
          const score = v.dot(axis)
          if (score > best[k].score) {
            best[k].score = score
            best[k].point.copy(v)
          }
        })
      }
    }
    points.push(...best.map((b) => b.point))
  }

  // Autonomous clips play up to the top of the amplitude range. The idle drift
  // (±1.6° on a slow wave) stays inside the framing margin; it is left out so
  // the measurement is deterministic.
  const maxWeight = DEFAULT_SCOPE_3D_BEHAVIOR.variation.weight[1]
  const idleDuration = animator.duration(IDLE_CLIP)
  const options = { ...secondary.options }
  secondary.options = { ...options, spring: true, life: false }
  const dt = 1 / SIM_FPS
  animator.clipNames.forEach((clip, index) => {
    const autonomous = !/Stretch|Laugh|ClickReaction/.test(clip)
    animator.stopAll(0)
    secondary.reset()
    // Idle keeps breathing underneath, at a different phase for every clip.
    animator.idle.time = (idleDuration * index) / animator.clipNames.length
    animator.play(clip, { weight: autonomous ? maxWeight : 1 })
    const steps = Math.ceil((animator.duration(clip) + SETTLE_S) * SIM_FPS)
    for (let i = 0; i < steps; i++) {
      animator.update(dt)
      secondary.update(dt, animator.busy)
      if (i % SAMPLE_EVERY === 0) sample()
    }
  })
  animator.stopAll(0)
  secondary.reset()
  secondary.options = options
  animator.idle.time = 0
  animator.update(0)
  return { points, box }
}
