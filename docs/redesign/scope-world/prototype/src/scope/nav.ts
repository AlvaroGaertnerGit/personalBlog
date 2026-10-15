// Scope's paths over the sheet, computed from the world itself: nav.bin is
// exported from the approved Blender scene (tools/export_world.py `nav_grid`):
// every piece lower than Scope's height is an obstacle, grown by his radius;
// the holes the kirigami left in the sheet are not walkable either.
// A* on that grid (8-connected), then string pulling (line of sight), then
// hops. Pure (no three.js): testable with `node --test`.

export type P2 = readonly [number, number]

export interface NavGridMeta {
  step: number
  nx: number
  ny: number
  x0: number
  y0: number
}

export class NavGrid {
  readonly meta: NavGridMeta
  private readonly free: Uint8Array

  constructor(meta: NavGridMeta, free: Uint8Array) {
    this.meta = meta
    this.free = free
  }

  cell(p: P2): [number, number] {
    const { step, x0, y0 } = this.meta
    return [Math.round((p[0] - x0) / step), Math.round((p[1] - y0) / step)]
  }

  point(i: number, j: number): P2 {
    const { step, x0, y0 } = this.meta
    return [x0 + i * step, y0 + j * step]
  }

  isFree(i: number, j: number) {
    const { nx, ny } = this.meta
    return i >= 0 && j >= 0 && i < nx && j < ny && this.free[j * nx + i] === 1
  }

  /** The nearest standable point (a spot authored a little too close to a sheet moves out of it). */
  nearestFree(p: P2, maxCells = 40): { at: P2; moved: number } | null {
    const [i0, j0] = this.cell(p)
    for (let r = 0; r <= maxCells; r++) {
      let best: [number, number] | null = null
      let bestD = Infinity
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !this.isFree(i0 + di, j0 + dj)) continue
          const d = di * di + dj * dj
          if (d < bestD) {
            bestD = d
            best = [i0 + di, j0 + dj]
          }
        }
      if (best) {
        const at = this.point(best[0], best[1])
        return { at, moved: Math.hypot(at[0] - p[0], at[1] - p[1]) }
      }
    }
    return null
  }

  /**
   * Straight walk between two cells stays on free cells. Conservative: every
   * cell the segment's sample could round into (floor and ceil on both axes)
   * must be free, so no corner of an obstacle is ever clipped.
   */
  lineOfSight(a: [number, number], b: [number, number]) {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2
    for (let k = 0; k <= n; k++) {
      const t = n === 0 ? 0 : k / n
      const x = a[0] + (b[0] - a[0]) * t
      const y = a[1] + (b[1] - a[1]) * t
      for (const i of [Math.floor(x), Math.ceil(x)])
        for (const j of [Math.floor(y), Math.ceil(y)]) if (!this.isFree(i, j)) return false
    }
    return true
  }
}

/** Shortest walkable path from `from` to `to` (both snapped to free cells), simplified. */
export function findPath(grid: NavGrid, from: P2, to: P2): P2[] | null {
  const a = grid.nearestFree(from, 12)
  const b = grid.nearestFree(to, 20)
  if (!a || !b) return null
  const start = grid.cell(a.at)
  const goal = grid.cell(b.at)
  const { nx } = grid.meta
  const key = (i: number, j: number) => j * nx + i
  const g = new Map<number, number>([[key(...start), 0]])
  const prev = new Map<number, number>()
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - goal[0])
    const dy = Math.abs(j - goal[1])
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
  }
  // binary heap of [f, key]
  const heap: [number, number][] = [[h(...start), key(...start)]]
  const push = (f: number, k: number) => {
    heap.push([f, k])
    for (let c = heap.length - 1; c > 0; ) {
      const p = (c - 1) >> 1
      if (heap[p][0] <= heap[c][0]) break
      ;[heap[p], heap[c]] = [heap[c], heap[p]]
      c = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      for (let c = 0; ; ) {
        const l = 2 * c + 1
        const r = l + 1
        let m = c
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        c = m
      }
    }
    return top
  }
  const goalKey = key(...goal)
  const closed = new Set<number>()
  while (heap.length) {
    const [, k] = pop()
    if (k === goalKey) break
    if (closed.has(k)) continue
    closed.add(k)
    const i = k % nx
    const j = (k - i) / nx
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = i + di
        const nj = j + dj
        if (!grid.isFree(ni, nj)) continue
        // no corner cutting past an obstacle
        if (di && dj && (!grid.isFree(i + di, j) || !grid.isFree(i, j + dj))) continue
        const nk = key(ni, nj)
        const cost = g.get(k)! + (di && dj ? Math.SQRT2 : 1)
        if (cost < (g.get(nk) ?? Infinity)) {
          g.set(nk, cost)
          prev.set(nk, k)
          push(cost + h(ni, nj), nk)
        }
      }
  }
  if (!g.has(goalKey)) return null
  const cells: [number, number][] = []
  for (let k: number | undefined = goalKey; k !== undefined; k = prev.get(k)) cells.unshift([k % nx, Math.floor(k / nx)])
  // string pulling: keep only the corners that line of sight needs
  const corners: [number, number][] = [cells[0]]
  for (let n = 1; n < cells.length; n++) {
    if (!grid.lineOfSight(corners[corners.length - 1], cells[n])) corners.push(cells[n - 1])
  }
  corners.push(cells[cells.length - 1])
  const pts = corners.map(([i, j]) => grid.point(i, j))
  pts[0] = a.at
  pts[pts.length - 1] = b.at
  return pts.filter((p, n) => n === 0 || Math.hypot(p[0] - pts[n - 1][0], p[1] - pts[n - 1][1]) > 0.004)
}

/** Cut a polyline into hops no longer than `maxHop` (equal within each segment). */
export function toHops(path: P2[], maxHop: number): P2[] {
  const out: P2[] = []
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / maxHop))
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}

export function pathLength(path: P2[]) {
  let s = 0
  for (let i = 1; i < path.length; i++) s += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
  return s
}
