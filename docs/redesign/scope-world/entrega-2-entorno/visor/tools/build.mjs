// Bundles the environment viewer (src/main.ts -> dist/visor.js) with the shared Scope World build.
//   node docs/redesign/scope-world/entrega-2-entorno/visor/tools/build.mjs
import path from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "../../../core/tools/build.mjs"

const visor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
await build(path.join(visor, "src", "main.ts"), path.join(visor, "dist", "visor.js"), "Scope World environment study")
