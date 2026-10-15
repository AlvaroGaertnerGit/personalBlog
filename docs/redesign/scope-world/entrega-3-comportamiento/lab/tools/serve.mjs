// Local server for the behaviour lab (shared Scope World server). Port 3120 by
// default (3100: the 1.0 prototype, 3110: the environment viewer, 3130: the
// Entrega 4 world; 3000 is reserved).
//   node docs/redesign/scope-world/entrega-3-comportamiento/lab/tools/serve.mjs [--port 3120]
import path from "node:path"
import { fileURLToPath } from "node:url"

import { serve } from "../../../core/tools/serve.mjs"

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
serve(lab, Number(process.argv[process.argv.indexOf("--port") + 1]) || 3120)
