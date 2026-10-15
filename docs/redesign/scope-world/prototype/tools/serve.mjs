// Local server for the prototype. Port 3100 (never 3000). Serves:
//   /            index.html          /dist, /src, /assets  the prototype
//   /scope/*     public/scope/*      (the production Scope GLB and loader, read-only)
//   /renders/*   docs/scope-world/entrega-1-5/renders/*  (fallback pictures)
// Compresses with gzip like a real host would, so transfer sizes are honest.
//   node docs/redesign/scope-world/prototype/tools/serve.mjs [--port 3100]
import { createReadStream, statSync } from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"

const here = path.dirname(fileURLToPath(import.meta.url))
const proto = path.resolve(here, "..")
const repo = path.resolve(proto, "..", "..", "..", "..")
const port = Number(process.argv[process.argv.indexOf("--port") + 1]) || 3100
if (port === 3000) throw new Error("port 3000 is reserved")

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".map": "application/json", ".glb": "model/gltf-binary", ".bin": "application/octet-stream",
  ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
}
const COMPRESS = new Set([".html", ".js", ".css", ".json", ".map", ".glb", ".bin", ".svg"])
const ROUTES = [
  ["/scope/", path.join(repo, "public", "scope")],
  ["/renders/", path.join(repo, "docs", "scope-world", "entrega-1-5", "renders")],
  ["/", proto],
]

const server = http.createServer((req, res) => {
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
})
server.listen(port, "127.0.0.1", () => console.log(`[serve] http://localhost:${port}/`))
