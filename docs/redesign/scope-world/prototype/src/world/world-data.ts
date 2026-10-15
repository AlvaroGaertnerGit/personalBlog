// The Pliego's layout, as exported from Blender by tools/export_world.py
// (world.json + height.bin). Blender works in z-up metres; three.js is y-up:
// a Blender point (x, y, z) is (x, z, -y) here. Every position in this
// prototype is authored in Blender coordinates, so it can be checked against
// the renders' scripts, and converted once with `bl()`.

import * as THREE from "three"

import { NavGrid, type NavGridMeta } from "../scope/nav.ts"

export type BlPoint = readonly [number, number, number]
export type BlPoint2 = readonly [number, number]

export interface FloorGrid {
  step: number
  nx: number
  ny: number
  x0: number
  y0: number
}

export interface WorldData {
  sheet: { x: number; y: number }
  margin_x: number
  rule: number
  pool: { x: number; y: number; r: number }
  lamp: { head: BlPoint; base: BlPoint; elbow: BlPoint }
  window_dir: BlPoint
  route: BlPoint2[]
  places: Record<string, BlPoint>
  mathview: { x: number; y: number; z: number; rot: number; w: number; d: number }
  card: { x: number; y: number; z: number }
  books: Record<string, { x: number; y: number; w: number; h: number; facing: number }>
  questions: Record<string, { x: number; y: number; w: number; h: number }>
  bench: BlPoint
  lookout_top: BlPoint
  floor: FloorGrid
  nav: NavGridMeta & { radius: number; height: number; step_over: number }
}

/** Blender (x, y, z) -> three.js. */
export function bl(x: number, y: number, z = 0, out = new THREE.Vector3()) {
  return out.set(x, z, -y)
}

export function blv(p: BlPoint | BlPoint2, out = new THREE.Vector3()) {
  return bl(p[0], p[1], p.length > 2 ? (p as BlPoint)[2] : 0, out)
}

/** Blender heading (degrees, 0 = +x, counter-clockwise) -> Scope's yaw in three.js. */
export function headingToYaw(headingDeg: number) {
  return THREE.MathUtils.degToRad(headingDeg + 90)
}

/** Yaw that makes Scope face from `from` toward `to` (three.js points). */
export function yawToward(from: THREE.Vector3, to: THREE.Vector3) {
  return Math.atan2(to.x - from.x, to.z - from.z)
}

export class Floor {
  private readonly grid: FloorGrid
  private readonly heights: Float32Array

  constructor(grid: FloorGrid, heights: Float32Array) {
    this.grid = grid
    this.heights = heights
  }

  /** Walkable height (three.js y) under a three.js point: the sheet, MathView, the bench, the lookout. */
  at(x: number, z: number) {
    const { step, nx, ny, x0, y0 } = this.grid
    // three (x, z) -> Blender (x, -z)
    const gx = THREE.MathUtils.clamp((x - x0) / step, 0, nx - 1.001)
    const gy = THREE.MathUtils.clamp((-z - y0) / step, 0, ny - 1.001)
    const i = Math.floor(gx)
    const j = Math.floor(gy)
    const fx = gx - i
    const fy = gy - j
    const h = (a: number, b: number) => this.heights[b * nx + a]
    const top = h(i, j) * (1 - fx) + h(i + 1, j) * fx
    const bottom = h(i, j + 1) * (1 - fx) + h(i + 1, j + 1) * fx
    return top * (1 - fy) + bottom * fy
  }
}

export async function loadWorldData(base: string) {
  const [json, bin, nav] = await Promise.all([
    fetch(`${base}/world.json`).then((r) => {
      if (!r.ok) throw new Error(`world.json: ${r.status}`)
      return r.json() as Promise<WorldData>
    }),
    fetch(`${base}/height.bin`).then((r) => {
      if (!r.ok) throw new Error(`height.bin: ${r.status}`)
      return r.arrayBuffer()
    }),
    fetch(`${base}/nav.bin`).then((r) => {
      if (!r.ok) throw new Error(`nav.bin: ${r.status}`)
      return r.arrayBuffer()
    }),
  ])
  return { data: json, floor: new Floor(json.floor, new Float32Array(bin)), nav: new NavGrid(json.nav, new Uint8Array(nav)) }
}
