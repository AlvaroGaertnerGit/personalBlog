// Local server for the environment viewer. Port 3110 by default: 3100 belongs to the
// 1.0 prototype (and may be running), 3000 is reserved. Serves:
//   /            the viewer (index.html, dist/, assets/entorno.glb)
//   /world/*     the 1.0 prototype's world (world.glb, world.json, height.bin, nav.bin), read-only
//   /scope/*     public/scope (the approved Scope GLB), read-only
//   node docs/redesign/scope-world/entrega-2-entorno/visor/tools/serve.mjs [--port 3110]
import { createReadStream, statSync } from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"

const here = path.dirname(fileURLToPath(import.meta.url))
const visor = path.resolve(here, "..")
const repo = path.resolve(visor, "..", "..", "..", "..", "..")
const port = Number(process.argv[process.argv.indexOf("--port") + 1]) || 3110
if (port === 3000) throw new Error("port 3000 is reserved")

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".map": "application/json",
  ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
}
const COMPRESS = new Set([".html", ".js", ".json", ".map", ".glb", ".bin"])
const ROUTES = [
  ["/world/", path.join(repo, "docs", "redesign", "scope-world", "prototype", "assets")],
  ["/scope/", path.join(repo, "public", "scope")],
  ["/", visor],
]

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname)
  const [prefix, root] = ROUTES.find(([p]) => url.startsWith(p))
  let file = path.join(root, url.slice(prefix.length) || "index.html")
  if (!file.startsWith(root)) return res.writeHead(403).end()
  try {
    if (statSync(file).isDirectory()) file = path.join(file, "index.html")
    statSync(file)
  } catch {
    return res.writeHead(404, { "content-type": "text/plain" }).end("not found")
  }
  const ext = path.extname(file)
  const headers = { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "no-cache" }
  if (COMPRESS.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
    res.writeHead(200, { ...headers, "content-encoding": "gzip", vary: "accept-encoding" })
    createReadStream(file).pipe(zlib.createGzip({ level: 6 })).pipe(res)
  } else {
    res.writeHead(200, { ...headers, "content-length": statSync(file).size })
    createReadStream(file).pipe(res)
  }
}).listen(port, "127.0.0.1", () => console.log(`[serve] http://localhost:${port}/`))
