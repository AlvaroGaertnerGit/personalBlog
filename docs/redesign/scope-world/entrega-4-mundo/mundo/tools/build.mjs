// Bundles the Entrega 4 world (src/main.ts -> dist/mundo.js) with the shared Scope World build.
//   node docs/redesign/scope-world/entrega-4-mundo/mundo/tools/build.mjs
import path from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "../../../core/tools/build.mjs"

const page = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
await build(path.join(page, "src", "main.ts"), path.join(page, "dist", "mundo.js"), "Scope World 2.0 · 4A")
