// node --test docs/redesign/scope-world/prototype/src/scope/*.test.ts
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { POIS, SCOPE_HOME, STATION_SPOTS } from "../config.ts"
import { NavGrid, findPath, pathLength, toHops } from "./nav.ts"

const ASSETS = new URL("../../assets/", import.meta.url)

test("a wall is walked around, never through", () => {
  const nx = 40
  const ny = 20
  const free = new Uint8Array(nx * ny).fill(1)
  for (let j = 0; j < 16; j++) free[j * nx + 20] = 0 // a wall with a gap at the top
  const grid = new NavGrid({ step: 0.01, nx, ny, x0: 0, y0: 0 }, free)
  const path = findPath(grid, [0.05, 0.05], [0.35, 0.05])
  assert.ok(path, "found")
  for (const p of toHops(path, 0.005)) {
    const [i, j] = grid.cell(p)
    assert.ok(grid.isFree(i, j), `hop on an obstacle at ${p}`)
  }
  // straight would be 0.30 m; round the top of the wall is ~0.37 m
  assert.ok(pathLength(path) > 0.34, `goes round the wall (${pathLength(path).toFixed(3)} m)`)
})

test("the real Pliego: every place Scope goes to is reachable from home", () => {
  const meta = JSON.parse(readFileSync(new URL("world.json", ASSETS), "utf8")).nav
  const grid = new NavGrid(meta, new Uint8Array(readFileSync(new URL("nav.bin", ASSETS))))
  const spots = [...POIS.map((p) => [p.id, p.spot] as const), ...STATION_SPOTS.map((s, i) => [`station${i}`, s] as const)]
  for (const [id, spot] of spots) {
    const snapped = grid.nearestFree(spot)
    assert.ok(snapped && snapped.moved < 0.05, `${id}: authored spot is off walkable floor by ${snapped?.moved.toFixed(3)} m`)
    const path = findPath(grid, SCOPE_HOME.spot, spot)
    assert.ok(path, `${id}: unreachable from home`)
    for (const p of toHops(path, 0.01)) {
      const [i, j] = grid.cell(p)
      assert.ok(grid.isFree(i, j), `${id}: path crosses an obstacle at ${p.map((v) => v.toFixed(2))}`)
    }
  }
})

test("hops are never longer than asked", () => {
  const hops = toHops([[0, 0], [0.3, 0.1], [0.31, 0.4]], 0.065)
  let prev: readonly [number, number] = [0, 0]
  for (const h of hops) {
    assert.ok(Math.hypot(h[0] - prev[0], h[1] - prev[1]) <= 0.0651)
    prev = h
  }
})
