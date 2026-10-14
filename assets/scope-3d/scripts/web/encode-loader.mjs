// Scope 3D — encodes the loading-screen frames rendered by render_loader.py.
//
//   node assets/scope-3d/scripts/web/encode-loader.mjs <frames dir> [--out public/scope/loader]
//
// <frames dir>/loop/*.png, exit/*.png, still.png, dock.png, meta.json (RGBA, straight alpha).
// 1. Every sequence frame is cropped to the UNION of all frames' alpha (+ padding),
//    so Scope never moves inside its box between loop and exit.
// 2. Resized so Scope at rest is SCOPE_PX tall: 2x of the loader's largest CSS size.
// 3. Colours bleed into transparent pixels (a few px): lossy WebP mixes colour
//    across block edges, and black under alpha 0 would print a dark fringe.
// 4. Packed as one sprite sheet per sequence (frame-exact control in the player)
//    + a still (first paint, reduced motion) + the companion's fallback still.
// Writes <out>/manifest.json: frame size, grid, fps, quiet/hold frames.

import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
// sharp ships with Next (image optimisation): no extra dependency.
const sharp = createRequire(createRequire(path.join(ROOT, "package.json")).resolve("next/package.json"))("sharp")

const args = process.argv.slice(2)
const outIndex = args.indexOf("--out")
const OUT = path.resolve(ROOT, outIndex >= 0 ? args.splice(outIndex, 2)[1] : "public/scope/loader")
const SRC = path.resolve(args[0] ?? "")

/**
 * Scope's rest height in the sheet frames: 1.6x of the loader's 200 CSS px on
 * desktop, 2x+ of the ~150 px it gets on phones. 2x on desktop measured 1.27 MB
 * of sheets and 73 MB decoded; this is about half, with no visible loss at size.
 */
const SCOPE_PX = 320
/** Companion fallback: 2x the largest dock (sm:size-48 = 192 px). */
const DOCK_PX = 384
const PAD = 6
const BLEED_PX = 6
const WEBP = { quality: 82, alphaQuality: 100, effort: 6, smartSubsample: true }
/** Sheets: AVIF first (about half the WebP size), the WebP for browsers without it. */
const AVIF = { quality: 56, effort: 6, chromaSubsampling: "4:4:4" }

async function rgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().toColourspace("srgb").raw({ depth: "uchar" }).toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function alphaBox({ data, width, height }, threshold = 1) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] >= threshold) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return { x0, y0, x1, y1 }
}

/** Copies the nearest opaque colour into transparent pixels, `steps` px deep. */
function bleed({ data, width, height }, steps) {
  const solid = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) solid[i] = data[i * 4 + 3] > 0 ? 1 : 0
  for (let s = 0; s < steps; s++) {
    const grown = []
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        if (solid[i]) continue
        let r = 0, g = 0, b = 0, n = 0
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const j = ny * width + nx
          if (!solid[j]) continue
          r += data[j * 4]; g += data[j * 4 + 1]; b += data[j * 4 + 2]; n++
        }
        if (n) grown.push([i, r / n, g / n, b / n])
      }
    for (const [i, r, g, b] of grown) {
      data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b
      solid[i] = 1
    }
  }
}

async function frame(file, crop, size) {
  const { data, info } = await sharp(file)
    .extract(crop)
    .resize(size.width, size.height, { kernel: "lanczos3" })
    .ensureAlpha()
    .raw({ depth: "uchar" })
    .toBuffer({ resolveWithObject: true })
  const img = { data, width: info.width, height: info.height }
  bleed(img, BLEED_PX)
  return img
}

/** Writes <name>.avif and <name>.webp. */
async function sheet(frames, columns, name) {
  const { width, height } = frames[0]
  const rows = Math.ceil(frames.length / columns)
  const raw = await sharp({ create: { width: width * columns, height: height * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((f, i) => ({
      input: f.data,
      raw: { width, height, channels: 4 },
      left: (i % columns) * width,
      top: Math.floor(i / columns) * height,
    })))
    .raw()
    .toBuffer()
  const input = () => sharp(raw, { raw: { width: width * columns, height: height * rows, channels: 4 } })
  await input().avif(AVIF).toFile(path.join(OUT, `${name}.avif`))
  await input().webp(WEBP).toFile(path.join(OUT, `${name}.webp`))
  return { columns, rows }
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(SRC, "meta.json"), "utf8"))
  const list = (seq) => fs.readdirSync(path.join(SRC, seq)).filter((f) => f.endsWith(".png")).sort().map((f) => path.join(SRC, seq, f))
  const loop = list("loop")
  const exit = list("exit")
  if (loop.length !== meta.loop || exit.length !== meta.exit) throw new Error("frame count != meta.json")

  // Union crop over both sequences (and Scope's rest height, from the still).
  const first = await rgba(loop[0])
  let u = { x0: first.width, y0: first.height, x1: 0, y1: 0 }
  for (const f of [...loop, ...exit]) {
    const b = alphaBox(await rgba(f))
    u = { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) }
  }
  const rest = alphaBox(await rgba(path.join(SRC, "still.png")), 128)
  const crop = {
    left: Math.max(0, u.x0 - PAD),
    top: Math.max(0, u.y0 - PAD),
    width: Math.min(first.width, u.x1 + PAD + 1) - Math.max(0, u.x0 - PAD),
    height: Math.min(first.height, u.y1 + PAD + 1) - Math.max(0, u.y0 - PAD),
  }
  const scale = SCOPE_PX / (rest.y1 - rest.y0 + 1)
  const size = { width: Math.round(crop.width * scale), height: Math.round(crop.height * scale) }
  console.log("crop", crop, "scale", scale.toFixed(3), "frame", size)

  fs.mkdirSync(OUT, { recursive: true })
  const loopFrames = await Promise.all(loop.map((f) => frame(f, crop, size)))
  const exitFrames = await Promise.all(exit.map((f) => frame(f, crop, size)))
  const still = await frame(path.join(SRC, "still.png"), crop, size)
  // Columns: as square a sheet as the frame count allows (both sides well under 8 k).
  const columns = (n) => Math.ceil(Math.sqrt((n * size.height) / size.width))
  const loopGrid = await sheet(loopFrames, columns(meta.loop), "loop")
  const exitGrid = await sheet(exitFrames, columns(meta.exit), "exit")
  await sharp(still.data, { raw: { width: size.width, height: size.height, channels: 4 } }).webp(WEBP).toFile(path.join(OUT, "still.webp"))

  // Companion fallback: the dock still is already framed by the site camera.
  const dock = await rgba(path.join(SRC, "dock.png"))
  const dockImg = await frame(path.join(SRC, "dock.png"), { left: 0, top: 0, width: dock.width, height: dock.height }, { width: DOCK_PX, height: DOCK_PX })
  await sharp(dockImg.data, { raw: { width: DOCK_PX, height: DOCK_PX, channels: 4 } }).webp(WEBP).toFile(path.join(OUT, "../scope-still.webp"))

  const manifest = {
    fps: meta.fps,
    width: size.width,
    height: size.height,
    /** Scope's rest height as a fraction of the frame height (CSS sizing). */
    scopeHeight: +(SCOPE_PX / size.height).toFixed(4),
    loop: { frames: meta.loop, ...loopGrid },
    exit: { frames: meta.exit, ...exitGrid },
    quiet: meta.quiet,
    hold: meta.hold,
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
  for (const f of ["loop.avif", "loop.webp", "exit.avif", "exit.webp", "still.webp", "../scope-still.webp"]) {
    console.log(f.padEnd(20), (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1), "KB")
  }
  const decodedMb = ((meta.loop + meta.exit) * size.width * size.height * 4) / 2 ** 20
  console.log("decoded sheets", decodedMb.toFixed(1), "MB")
}

await main()
