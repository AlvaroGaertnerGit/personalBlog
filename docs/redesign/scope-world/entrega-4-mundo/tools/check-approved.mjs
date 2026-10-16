// Are the approved deliverables still what was approved, now that the shared core has 4A's
// (opt-in) refinements? Without touching them:
//
//   Entrega 3 lab     its committed bundle (lab/dist/lab.js) against the lab rebuilt from today's
//                     sources: the same seeded run (route, ball, clicks, reading, night, refuge),
//                     the full state every 0.25 s of simulation, compared exactly.
//   Entrega 2 viewer  its committed bundle (visor/dist/visor.js) against the viewer rebuilt from
//                     today's sources: three shots × four moods, pixels compared (Scope hops in
//                     real time in the viewer, so his few pixels may differ in the wide shot).
//
//   node docs/redesign/scope-world/entrega-4-mundo/tools/check-approved.mjs [--software]
//
// Builds into the system's temp folder, serves on 3151/3152/3161/3162 (never 3000), and removes
// the builds and stops the servers and Chrome on every way out.

import { spawn } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "../../core/tools/build.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const sw = path.resolve(here, "..", "..")
const repo = path.resolve(sw, "..", "..", "..")
const { chromium } = createRequire(path.join(repo, "package.json"))("@playwright/test")
const sharp = createRequire(path.join(repo, "node_modules", ".pnpm", "node_modules", "_"))("sharp")
const LAB = path.join(sw, "entrega-3-comportamiento", "lab")
const VISOR = path.join(sw, "entrega-2-entorno", "visor")
const tmp = mkdtempSync(path.join(os.tmpdir(), "scope-world-aprobados-"))
const results = []
const check = (name, ok, detail) => {
  results.push(ok)
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${detail})`)
}

const servers = []
let browser = null
let done = false
async function cleanup() {
  if (done) return
  done = true
  await browser?.close().catch(() => {})
  for (const s of servers) s.kill()
  rmSync(tmp, { recursive: true, force: true })
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => cleanup().then(() => process.exit(130)))
const watchdog = setTimeout(() => cleanup().then(() => (console.log("WATCHDOG: más de 15 min"), process.exit(2))), 15 * 60_000)

const serve = (root, port) => {
  const s = spawn(process.execPath, ["-e", `import(${JSON.stringify("file:///" + path.join(sw, "core", "tools", "serve.mjs").replaceAll("\\", "/"))}).then((m) => m.serve(${JSON.stringify(root)}, ${port}))`], { stdio: "ignore" })
  servers.push(s)
}
/** A copy of an approved page with its bundle rebuilt from today's sources. */
async function rebuild(page, entry, bundle, extra = []) {
  const out = path.join(tmp, path.basename(page))
  mkdirSync(path.join(out, "dist"), { recursive: true })
  cpSync(path.join(page, "index.html"), path.join(out, "index.html"))
  for (const d of extra) cpSync(path.join(page, d), path.join(out, d), { recursive: true })
  await build(path.join(page, "src", entry), path.join(out, "dist", bundle), "rebuilt to compare (temporary)")
  return out
}

// the lab's own run, the same in both bundles (approved hooks only: advance, goTo, click, read, mood)
const SCRIPT = [["advance", 6], ["goTo", 1], ["advance", 8], ["goTo", 2], ["advance", 12], ["click", "ball"], ["advance", 8], ["click", "scope"], ["advance", 3], ["goTo", 4], ["advance", 12], ["goTo", 0], ["advance", 14], ["read", true], ["advance", 10], ["read", false], ["mood", "noche"], ["advance", 45], ["goTo", 3], ["advance", 10]]

async function labTrace(port, q) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 750 } })
  await ctx.addInitScript(() => {
    let s = 7
    Math.random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32
    // frames run while the page loads; once __lab exists none does: only advance() moves the sim
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => raf((t) => {
      if (!("__lab" in window)) cb(t)
    })
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(600_000)
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`http://localhost:${port}/${q}`)
  await page.waitForFunction("window.__lab", null, { timeout: 120_000, polling: 250 }) // not "raf": frames are held
  const rows = await page.evaluate((script) => {
    const L = window.__lab
    for (const o of L.scope.group.parent.children) o.visible = false // the approved advance() draws a frame: keep it cheap
    const out = []
    const snap = () => {
      const s = L.state()
      out.push(JSON.stringify([s.now, s.state, s.act, s.scope, s.visitor, s.ball, s.flower, s.radiometer, s.gait, s.clips, s.visible, s.log.at(-1)?.text]))
    }
    for (const [k, a] of script) {
      if (k !== "advance") L[k](a)
      else
        for (let i = 0; i < a / 0.25; i++) {
          L.advance(0.25)
          snap()
        }
    }
    return out
  }, SCRIPT)
  await ctx.close()
  return { rows, errors }
}

async function visorShot(port, q) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, reducedMotion: "reduce" })
  const page = await ctx.newPage()
  page.setDefaultTimeout(300_000)
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`http://localhost:${port}/${q}`)
  await page.waitForFunction("window.__visor", null, { timeout: 300_000, polling: 500 })
  await page.waitForTimeout(4000)
  await page.evaluate(() => {
    for (const e of document.querySelectorAll("body > *:not(canvas)")) e.style.visibility = "hidden"
  })
  await page.waitForTimeout(1500)
  const png = await page.screenshot({ type: "png" })
  await ctx.close()
  return { raw: await sharp(png).raw().toBuffer({ resolveWithObject: true }), errors }
}

try {
  const lab = await rebuild(LAB, "main.ts", "lab.js")
  const visor = await rebuild(VISOR, "main.ts", "visor.js", ["assets"])
  serve(LAB, 3151)
  serve(lab, 3152)
  serve(VISOR, 3161)
  serve(visor, 3162)
  await new Promise((r) => setTimeout(r, 900))
  browser = await chromium.launch({ channel: "chrome", headless: true, args: process.argv.includes("--software") ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--enable-unsafe-swiftshader"] })

  for (const q of ["", "?lugar=3"]) {
    const a = await labTrace(3151, q)
    const b = await labTrace(3152, q)
    const first = a.rows.findIndex((r, i) => r !== b.rows[i])
    check(`laboratorio E3 ${q || "(desde su casa)"}: el aprobado y el reconstruido hacen exactamente lo mismo`, first < 0 && a.rows.length === b.rows.length && !a.errors.length && !b.errors.length, first < 0 ? `${a.rows.length} instantáneas idénticas (${a.rows.length / 4} s)` : `difieren desde ${first / 4} s`)
  }
  for (const cam of ["general", "horizonte", "linterna"])
    for (const hora of ["amanecer", "dia", "atardecer", "noche"]) {
      const q = `?camara=${cam}&hora=${hora}`
      const [a, b] = [await visorShot(3161, q), await visorShot(3162, q)]
      const { data: da, info } = a.raw
      const db = b.raw.data
      let diff = 0
      for (let i = 0; i < info.width * info.height; i++) {
        let d = 0
        for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(da[i * info.channels + c] - db[i * info.channels + c]))
        if (d > 8) diff++
      }
      const pct = (100 * diff) / (info.width * info.height)
      // the wide shot shows Scope hopping in real time (a few pixels); any other change is a change
      check(`visor E2 · ${cam} · ${hora}: igual al aprobado`, pct <= (cam === "general" ? 0.05 : 0) && !a.errors.length && !b.errors.length, `${pct.toFixed(3)} % de píxeles distintos`)
    }
} finally {
  clearTimeout(watchdog)
  await cleanup()
  const failed = results.filter((r) => !r).length
  console.log(`\n${results.length - failed}/${results.length} comprobaciones`)
  process.exitCode = failed ? 1 : 0
}
