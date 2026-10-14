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

/**
 * The site's view of Scope: nearly frontal, a touch from above and from
 * Scope's left, like the 2D companion. The loader frames are rendered from
 * this same direction (assets/scope-3d/scripts/render_loader.py VIEW_DIR).
 */
export const SCOPE_3D_WEB_VIEW_DIRECTION = new THREE.Vector3(0.22, 0.16, 1)

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

/**
 * Places `camera` on `direction` from the envelope so every point is inside
 * the view with `margin` (fraction of the half-frame) to spare, and the
 * silhouette is centred. Returns the point the camera looks at.
 */
export function fitCameraToEnvelope(
  camera: THREE.PerspectiveCamera,
  { points, box }: Scope3DMotionEnvelope,
  direction: THREE.Vector3,
  margin = 0.06,
): THREE.Vector3 {
  const dir = direction.clone().normalize()
  const target = box.getCenter(new THREE.Vector3())
  const limit = 1 - margin
  const place = (distance: number) => {
    camera.position.copy(target).addScaledVector(dir, distance)
    camera.lookAt(target)
    camera.updateMatrixWorld()
  }
  const extents = () => {
    const ndc = new THREE.Box2()
    for (const p of points) {
      const q = p.clone().project(camera)
      ndc.expandByPoint(new THREE.Vector2(q.x, q.y))
    }
    return ndc
  }
  const fitDistance = () => {
    let lo = 0.05
    let hi = 5
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      place(mid)
      const e = extents()
      const fits = Math.max(-e.min.x, e.max.x, -e.min.y, e.max.y) <= limit
      if (fits) hi = mid
      else lo = mid
    }
    place(hi)
    return hi
  }
  // Two passes: fit, recentre the silhouette on screen, fit again.
  for (let pass = 0; pass < 2; pass++) {
    const distance = fitDistance()
    const c = extents().getCenter(new THREE.Vector2())
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    target.addScaledVector(camRight, c.x * halfHeight * camera.aspect).addScaledVector(camUp, c.y * halfHeight)
  }
  fitDistance()
  return target
}

/** Screen directions kept by reduceEnvelope, and how many points per direction. */
const REDUCED_DIRECTIONS = 48
const REDUCED_PER_DIRECTION = 3

/**
 * The few points of a measured envelope that can ever touch the frame: the
 * most extreme ones along evenly spread screen directions (a few per
 * direction, because perspective can promote a runner-up). The site ships
 * these instead of measuring at load; scope-3d-framing.test.ts checks they
 * frame Scope exactly like the full measurement.
 */
export function reduceEnvelope(envelope: Scope3DMotionEnvelope, viewDirection: THREE.Vector3): Scope3DMotionEnvelope {
  const forward = viewDirection.clone().normalize().negate()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, forward)
  const kept = new Set<THREE.Vector3>()
  for (let k = 0; k < REDUCED_DIRECTIONS; k++) {
    const a = (2 * Math.PI * k) / REDUCED_DIRECTIONS
    const axis = right.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a))
    const ranked = [...envelope.points].sort((p, q) => q.dot(axis) - p.dot(axis))
    ranked.slice(0, REDUCED_PER_DIRECTION).forEach((p) => kept.add(p))
  }
  return { points: [...kept], box: envelope.box.clone() }
}

/** Compact form for source code: [x, y, z] in metres, box as [min, max]. */
export interface Scope3DEnvelopeData {
  points: readonly (readonly [number, number, number])[]
  box: readonly [readonly [number, number, number], readonly [number, number, number]]
}

export function envelopeFromData({ points, box }: Scope3DEnvelopeData): Scope3DMotionEnvelope {
  return {
    points: points.map((p) => new THREE.Vector3(...p)),
    box: new THREE.Box3(new THREE.Vector3(...box[0]), new THREE.Vector3(...box[1])),
  }
}
