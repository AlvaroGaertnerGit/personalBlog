// Local server for the Entrega 4 world (shared Scope World server). Port 3130 by
// default (3100 the 1.0 prototype, 3110 the viewer, 3120 the lab; 3000 is reserved).
//   node docs/redesign/scope-world/entrega-4-mundo/mundo/tools/serve.mjs [--port 3130]
import path from "node:path"
import { fileURLToPath } from "node:url"

import { serve } from "../../../core/tools/serve.mjs"

const page = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
serve(page, Number(process.argv[process.argv.indexOf("--port") + 1]) || 3130)
