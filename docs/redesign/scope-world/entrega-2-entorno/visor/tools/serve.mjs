// Local server for the environment viewer (shared Scope World server). Port 3110 by
// default: 3100 belongs to the 1.0 prototype, 3000 is reserved.
//   node docs/redesign/scope-world/entrega-2-entorno/visor/tools/serve.mjs [--port 3110]
// → http://localhost:3110/   (?camara=general|horizonte|margen|escala|linterna  ?hora=amanecer|dia|atardecer|noche)
import path from "node:path"
import { fileURLToPath } from "node:url"

import { serve } from "../../../core/tools/serve.mjs"

const visor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
serve(visor, Number(process.argv[process.argv.indexOf("--port") + 1]) || 3110)
