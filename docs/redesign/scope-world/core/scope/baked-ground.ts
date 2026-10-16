// The ground of a world baked from its own geometry (entrega-4-mundo/tools/
// bake-ground.mjs): floor heights, where Scope can stand and where the ball
// can roll. Pure (no three.js): node tests read the same files.

import { NavGrid, findPath, type NavGridMeta } from "../../prototype/src/scope/nav.ts"
import type { P2 } from "../world-def.ts"
import type { Ground, Keepout } from "./ground.ts"

export interface BakedMeta extends NavGridMeta {
  rules: { scopeRadius: number; ballRadius: number; scopeHeight: number; climb: number; cliff: number; slope: number }
}

/** Places a world adds after the bake (props), grown like the bake grows obstacles. */
export interface ExtraSolid {
  at: P2
  r: number
}

export class BakedGround implements Ground {
  readonly meta: BakedMeta
  private readonly floor: Float32Array
  private readonly base: Uint8Array
  private readonly ball: Uint8Array
  private readonly scratch: Uint8Array

  constructor(meta: BakedMeta, floor: Float32Array, nav: Uint8Array, solid: Uint8Array, extras: ExtraSolid[] = []) {
    this.meta = meta
    this.floor = floor
    this.base = nav.slice()
    this.ball = solid.slice()
    // the world's interactive props (not in the GLBs) are solid too
    for (const e of extras) {
      this.stamp(this.base, e.at, e.r + meta.rules.scopeRadius)
      this.stamp(this.ball, e.at, e.r + meta.rules.ballRadius)
    }
    this.scratch = new Uint8Array(this.base.length)
  }

  static async load(base: string, extras: ExtraSolid[] = []) {
    const get = async (f: string) => {
      const r = await fetch(`${base}/${f}`)
      if (!r.ok) throw new Error(`${f}: ${r.status}`)
      return r
    }
    const [meta, floor, nav, solid] = await Promise.all([
      get("ground.json").then((r) => r.json() as Promise<BakedMeta>),
      get("floor.bin").then((r) => r.arrayBuffer()),
      get("nav.bin").then((r) => r.arrayBuffer()),
      get("solid.bin").then((r) => r.arrayBuffer()),
    ])
    return new BakedGround(meta, new Float32Array(floor), new Uint8Array(nav), new Uint8Array(solid), extras)
  }

  private stamp(grid: Uint8Array, at: P2, r: number) {
    const { step, nx, ny, x0, y0 } = this.meta
    const n = Math.ceil(r / step)
    const ci = Math.round((at[0] - x0) / step)
    const cj = Math.round((at[1] - y0) / step)
    for (let dj = -n; dj <= n; dj++)
      for (let di = -n; di <= n; di++) {
        const i = ci + di
        const j = cj + dj
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue
        if (Math.hypot(di, dj) * step <= r) grid[j * nx + i] = 0
      }
  }

  private cell(p: P2): [number, number] {
    const { step, x0, y0 } = this.meta
    return [Math.round((p[0] - x0) / step), Math.round((p[1] - y0) / step)]
  }

  get staticGrid() {
    return new NavGrid(this.meta, this.base)
  }

  path(from: P2, to: P2, ball: P2 | null, avoid: readonly Keepout[] = []): P2[] | null {
    this.scratch.set(this.base)
    if (ball) this.stamp(this.scratch, ball, 0.03 + this.meta.rules.scopeRadius - 0.005)
    for (const k of avoid) this.stamp(this.scratch, k.at, k.r)
    return findPath(new NavGrid(this.meta, this.scratch), from, to)
  }

  isFree(p: P2) {
    const [i, j] = this.cell(p)
    const { nx, ny } = this.meta
    return i >= 0 && j >= 0 && i < nx && j < ny && this.base[j * nx + i] === 1
  }

  ballBlocked(p: P2) {
    const [i, j] = this.cell(p)
    const { nx, ny } = this.meta
    return !(i >= 0 && j >= 0 && i < nx && j < ny && this.ball[j * nx + i] === 1)
  }

  /** Bilinear floor height. */
  height(p: P2) {
    const { step, nx, ny, x0, y0 } = this.meta
    const gx = Math.min(nx - 1.001, Math.max(0, (p[0] - x0) / step))
    const gy = Math.min(ny - 1.001, Math.max(0, (p[1] - y0) / step))
    const i = Math.floor(gx)
    const j = Math.floor(gy)
    const fx = gx - i
    const fy = gy - j
    const h = (a: number, b: number) => this.floor[b * nx + a]
    return (h(i, j) * (1 - fx) + h(i + 1, j) * fx) * (1 - fy) + (h(i, j + 1) * (1 - fx) + h(i + 1, j + 1) * fx) * fy
  }
}
