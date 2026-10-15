// Scope World 2.0 · Entrega 3: the behaviour lab — the shared Scope World app
// (core/app/app.ts) over the lab's world definition and its composed ground,
// plus the step bench (?banco).

import { boot } from "../../../core/app/app.ts"
import { startBench } from "./bench.ts"
import { LabGround } from "./lab-ground.ts"
import { LAB_WORLD } from "./lab-world.ts"

boot({
  def: LAB_WORLD,
  ground: (stage) => new LabGround(stage.nav, (x, y) => stage.floor.at(x, -y)),
  mode: async (params, stage, ground) => {
    if (!params.has("banco")) return false
    await startBench(stage, ground)
    return true
  },
})
