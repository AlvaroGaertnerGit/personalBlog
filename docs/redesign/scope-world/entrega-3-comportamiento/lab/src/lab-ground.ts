// The ground of the lab: where Scope can stand and how high the floor is.
//
// The 1.0 nav map (nav.bin, exported from the approved Blender world) only
// covers the sheet, and it is eroded at its own border (the desk edge). In
// 2.0 the sheet lies on endless paper, so this grid composes:
//
//   the 1.0 map on the sheet, except a 6 cm band at its left/front border
//   free paper outside the sheet
//   the lab's places as obstacles, grown by Scope's radius (as nav.bin is):
//   the lantern (its inside is reached only by the scripted fit), the
//   cabinet, the flower and the radiometer
//
// The ball is not in the grid: it moves. Paths avoid where it is now.

import type { P2 } from "../../../core/world-def.ts"
import type { Ground } from "../../../core/scope/ground.ts"
import { dist } from "../../../core/scope/body/locomotor.ts"
import { NavGrid, findPath, type NavGridMeta } from "../../../prototype/src/scope/nav.ts"
import { LAB_PLACES } from "./lab-world.ts"

const { lantern: LANTERN, cabinet: CABINET, flower: FLOWER, radiometer: RADIOMETER, ball: BALL } = LAB_PLACES

const SCOPE_R = 0.06
/** The 1.0 map's own border erosion (the desk edge, 6 cm), measured on nav.bin: free paper in 2.0. */
const inBorderBand = (p: P2) => p[0] < -0.935 || p[1] < -0.645
const META: NavGridMeta = { step: 0.01, nx: 166, ny: 86, x0: -1.45, y0: -1.05 }

interface WorldNav {
  meta: NavGridMeta
  isFree(i: number, j: number): boolean
  cell(p: P2): [number, number]
}

function inBox(p: P2, min: P2, max: P2, grow: number) {
  const dx = Math.max(min[0] - p[0], 0, p[0] - max[0])
  const dy = Math.max(min[1] - p[1], 0, p[1] - max[1])
  return Math.hypot(dx, dy) < grow
}

/** The lab's solid things at radius `r` (Scope: his radius; the ball: its own). */
function solid(p: P2, r: number) {
  if (dist(p, LANTERN.center) < LANTERN.outerR + r) return true
  if (inBox(p, CABINET.min, CABINET.max, r)) return true
  if (dist(p, FLOWER.at) < FLOWER.baseR + r) return true
  if (dist(p, RADIOMETER.at) < RADIOMETER.bulbR + r) return true
  return false
}

export class LabGround implements Ground {
  readonly meta = META
  private readonly world: WorldNav
  private readonly worldHeight: (x: number, y: number) => number
  private readonly base: Uint8Array
  private readonly scratch: Uint8Array

  /** `world`: the 1.0 nav map; `height`: the 1.0 floor in Blender (x, y) → z. */
  constructor(world: WorldNav, height: (x: number, y: number) => number) {
    this.world = world
    this.worldHeight = height
    this.base = new Uint8Array(META.nx * META.ny)
    for (let j = 0; j < META.ny; j++)
      for (let i = 0; i < META.nx; i++) {
        const p: P2 = [META.x0 + i * META.step, META.y0 + j * META.step]
        this.base[j * META.nx + i] = this.walkableWorld(p) && !solid(p, SCOPE_R) && p[1] > -1.0 && p[0] > -1.42 ? 1 : 0
      }
    this.scratch = new Uint8Array(this.base.length)
  }

  private onSheetMap(p: P2) {
    const [i, j] = this.world.cell(p)
    const m = this.world.meta
    return i >= 0 && j >= 0 && i < m.nx && j < m.ny
  }

  /** Free on the 1.0 map, or outside it (the paper of the world), or in its eroded border band. */
  private walkableWorld(p: P2) {
    if (!this.onSheetMap(p)) return true
    if (inBorderBand(p)) return true
    const [i, j] = this.world.cell(p)
    return this.world.isFree(i, j)
  }

  /** A grid for one plan: the static ground, minus where the ball is now. */
  grid(ball: P2 | null) {
    this.scratch.set(this.base)
    if (ball) {
      const r = BALL.radius + SCOPE_R - 0.005
      const n = Math.ceil(r / META.step)
      const ci = Math.round((ball[0] - META.x0) / META.step)
      const cj = Math.round((ball[1] - META.y0) / META.step)
      for (let dj = -n; dj <= n; dj++)
        for (let di = -n; di <= n; di++) {
          const i = ci + di
          const j = cj + dj
          if (i < 0 || j < 0 || i >= META.nx || j >= META.ny) continue
          if (Math.hypot(di, dj) * META.step <= r) this.scratch[j * META.nx + i] = 0
        }
    }
    return new NavGrid(META, this.scratch)
  }

  /** The static grid (tests, reachability checks). */
  get staticGrid() {
    return new NavGrid(META, this.base)
  }

  path(from: P2, to: P2, ball: P2 | null): P2[] | null {
    return findPath(this.grid(ball), from, to)
  }

  isFree(p: P2) {
    const g = this.staticGrid
    const [i, j] = g.cell(p)
    return g.isFree(i, j)
  }

  /** Floor height (Blender z) at (x, y): the world, or his dish inside the lantern. */
  height(p: P2) {
    const z = this.worldHeight(p[0], p[1])
    const d = dist(p, LANTERN.center)
    if (d < LANTERN.wallR) {
      // his feet are on the dish once his centre is a little inside its rim
      const k = 1 - Math.min(1, Math.max(0, (d - (LANTERN.dishR - 0.05)) / 0.03))
      return Math.max(z, LANTERN.dishTop * k)
    }
    return z
  }

  /** Is this spot solid for the ball (its centre at `p`)? */
  ballBlocked(p: P2) {
    if (solid(p, BALL.radius)) return true
    if (p[1] < -1.02 || p[0] < -1.44) return true
    if (!this.onSheetMap(p) || inBorderBand(p)) return false
    // the 1.0 map is grown by Scope's 6 cm: a ball is blocked only well inside that band
    const s = 0.03
    const [i, j] = this.world.cell(p)
    if (this.world.isFree(i, j)) return false
    for (const [dx, dy] of [[s, 0], [-s, 0], [0, s], [0, -s]] as const) {
      const [a, b] = this.world.cell([p[0] + dx, p[1] + dy])
      if (this.world.isFree(a, b)) return false
    }
    return true
  }
}
