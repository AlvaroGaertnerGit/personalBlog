// The 4A world's baked ground (entrega-4-mundo/assets): Scope can stand where the
// world says he stands, walk the whole route, step onto his dish, and light his
// radiometer from more than one side; the lantern is entered only by its door.
//   node --test docs/redesign/scope-world/core/scope/baked-ground.test.ts
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { WORLD_4A, WORLD_PLACES } from "../../entrega-4-mundo/mundo/src/world-4a.ts"
import { pathLength } from "../../prototype/src/scope/nav.ts"
import { BakedGround } from "./baked-ground.ts"

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "entrega-4-mundo", "assets")
const bin = (f: string) => readFileSync(path.join(assets, f))
const ground = new BakedGround(
  JSON.parse(bin("ground.json").toString("utf8")),
  new Float32Array(new Uint8Array(bin("floor.bin")).buffer),
  new Uint8Array(bin("nav.bin")),
  new Uint8Array(bin("solid.bin")),
  [
    { at: WORLD_PLACES.flower.at, r: WORLD_PLACES.flower.baseR },
    { at: WORLD_PLACES.radiometer.at, r: 0.05 },
  ],
)

test("every place's waiting spot and his door stand on free floor; the ball on the ball's", () => {
  for (const s of WORLD_4A.stations) assert.ok(ground.isFree(s.wait), `${s.id} wait ${s.wait}`)
  assert.ok(ground.isFree(WORLD_PLACES.lanternDoor.outside))
  // the ball rests on floor the ball can roll on (against the margin's standing notes: where he
  // stands to push it, and his way there, are checked in mundo/src/world-4a.test.ts)
  assert.ok(!ground.ballBlocked(WORLD_PLACES.ball.start))
})

test("the whole route is walkable, place to place", () => {
  const w = WORLD_4A.stations.map((s) => s.wait)
  for (let i = 1; i < w.length; i++) {
    const p = ground.path(w[i - 1], w[i], WORLD_PLACES.ball.start)
    assert.ok(p, `${WORLD_4A.stations[i - 1].id} → ${WORLD_4A.stations[i].id}`)
    assert.ok(pathLength(p!) < 3 * Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]) + 0.3, "no long detours")
  }
})

test("floors: his dish is 6.7 mm up, the sheet and the paper around it are flat", () => {
  assert.ok(Math.abs(ground.height(WORLD_PLACES.lantern.center) - 0.0067) < 0.001)
  for (const s of WORLD_4A.stations) assert.ok(Math.abs(ground.height(s.wait)) < 0.004, `${s.id}: ${ground.height(s.wait)}`)
})

test("the lantern: walls are solid; its inside, if reachable at all, only through the door", () => {
  const { center, outerR } = WORLD_PLACES.lantern
  const door = WORLD_PLACES.lanternDoor
  // the paper wall all around, except the door (which faces +x)
  for (let k = 1; k < 8; k++) {
    const a = (k * Math.PI) / 4
    assert.ok(!ground.isFree([center[0] + (outerR - 0.03) * Math.cos(a), center[1] + (outerR - 0.03) * Math.sin(a)]), `wall at ${k * 45}°`)
  }
  const p = ground.path(door.outside, door.seat, null)
  if (p) for (const q of p) if (Math.hypot(q[0] - center[0], q[1] - center[1]) < outerR + 0.02) assert.ok(Math.abs(q[1] - door.doorway[1]) < 0.04 && q[0] > center[0] - 0.02, `through the door: ${q}`)
})

test("the radiometer: solid, with free floor 13 cm away on several sides, and the way into the lamp's circle open", () => {
  const at = WORLD_PLACES.radiometer.at
  assert.ok(!ground.isFree(at))
  let spots = 0
  for (let k = 0; k < 16; k++) if (ground.isFree([at[0] + 0.13 * Math.cos((k * Math.PI) / 8), at[1] + 0.13 * Math.sin((k * Math.PI) / 8)])) spots++
  assert.ok(spots >= 4, `${spots} spots`)
  assert.ok(ground.path(WORLD_4A.stations[4].anchor, WORLD_4A.stations[5].wait, null))
})
