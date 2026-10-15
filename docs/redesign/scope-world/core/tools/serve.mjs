// Local server for a Scope World page (never port 3000). Read-only routes:
//   /         the page's folder (index.html, dist/, assets/)
//   /world/*  the 1.0 prototype's world (world.glb, world.json, height.bin, nav.bin)
//   /env/*    the Entrega 2 environment (entorno.glb)
//   /ground/* the Entrega 4 baked ground (ground.json, floor.bin, nav.bin, solid.bin)
//   /scope/*  public/scope (the approved Scope GLB)
// The pages' own tools/serve.mjs call this with their folder and default port.
import { createReadStream, statSync } from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"

const here = path.dirname(fileURLToPath(import.meta.url))
const world = path.resolve(here, "..", "..")
const repo = path.resolve(world, "..", "..", "..")
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".map": "application/json",
  ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
}
const COMPRESS = new Set([".html", ".js", ".json", ".map", ".glb", ".bin"])

export function serve(root, port) {
  if (port === 3000) throw new Error("port 3000 is reserved")
  const routes = [
    ["/world/", path.join(world, "prototype", "assets")],
    ["/env/", path.join(world, "entrega-2-entorno", "visor", "assets")],
    ["/ground/", path.join(world, "entrega-4-mundo", "assets")],
    ["/scope/", path.join(repo, "public", "scope")],
    ["/", root],
  ]
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname)
    const [prefix, base] = routes.find(([p]) => url.startsWith(p))
    let file = path.join(base, url.slice(prefix.length) || "index.html")
    if (!file.startsWith(base)) return res.writeHead(403).end()
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
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)))
  return server
}
