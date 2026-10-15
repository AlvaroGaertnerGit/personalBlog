// Scope World 2.0 · 4A: the shared Scope World app (core/app/app.ts) over the
// 4A world: the Entrega 2 world and the Entrega 3 Scope, his places and toys,
// on the floor baked from the world's own geometry (tools/bake-ground.mjs).

import { boot } from "../../../core/app/app.ts"
import { BakedGround } from "../../../core/scope/baked-ground.ts"
import { WORLD_4A, WORLD_PLACES } from "./world-4a.ts"

boot({
  def: WORLD_4A,
  // the world's interactive props are not in the GLBs: they are solid too
  ground: () =>
    BakedGround.load("/ground", [
      { at: WORLD_PLACES.flower.at, r: WORLD_PLACES.flower.baseR },
      // the bulb and its three porcelain mirrors (within 5 cm: he can still stand 13 cm away to light it)
      { at: WORLD_PLACES.radiometer.at, r: 0.05 },
    ]),
  // the sun's shadow travels with what you look at; the world's views are wider than the lab's
  stage: { shadowExtent: 1.6 },
})
