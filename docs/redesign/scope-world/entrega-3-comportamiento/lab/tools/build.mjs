// Bundles the lab (src/main.ts -> dist/lab.js) with the shared Scope World build.
//   node docs/redesign/scope-world/entrega-3-comportamiento/lab/tools/build.mjs
import path from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "../../../core/tools/build.mjs"

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
await build(path.join(lab, "src", "main.ts"), path.join(lab, "dist", "lab.js"), "Scope World behaviour lab")
