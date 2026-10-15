// Reproducible browser check of the prototype. Starts the local server on
// 3100, drives Chrome through the six required moments, measures, takes
// screenshots, writes report.json, and stops the server.
//
//   node docs/redesign/scope-world/prototype/tools/verify.mjs [--out dir] [--headed] [--software] [--timeout ms]
//   (screenshots + report.json go to <tmp>/scope-world-verify unless --out is given)
//
//   --software  no GPU on this machine: SwiftShader, ?force3d&tier=low&maxdt
//               (functional checks only — its frame rate means nothing)
//   --headed    a visible window (on a machine with a GPU, the honest FPS)

import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, "..", "..", "..", "..", "..")
const require = createRequire(path.join(repo, "package.json"))
const { chromium, devices } = require("@playwright/test")

const arg = (k) => process.argv.includes(k)
const val = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const OUT = path.resolve(val("--out", path.join(os.tmpdir(), "scope-world-verify")))
const SOFTWARE = arg("--software")
const BASE = "http://localhost:3100/"
const Q = SOFTWARE ? "?force3d&tier=low&maxdt=0.25" : "?"
mkdirSync(OUT, { recursive: true })

const report = { when: new Date().toISOString(), software: SOFTWARE, checks: [], perf: {}, console: [] }
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`)
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) })
const sw = (page, expr) => page.evaluate(`window.__sw && (${expr})`)
async function until(page, expr, timeout = 30000) {
  try {
    await page.waitForFunction(`window.__sw && (${expr})`, null, { timeout, polling: 200 })
    return true
  } catch {
    return false
  }
}

// never leave the server or the browser behind, even if a step hangs
const WATCHDOG_MS = Number(val("--timeout", SOFTWARE ? 1_200_000 : 300_000))
const server = spawn(process.execPath, [path.join(here, "serve.mjs")], { stdio: "ignore" })
await new Promise((r) => setTimeout(r, 800))
const browser = await chromium.launch({
  channel: "chrome",
  headless: !arg("--headed"),
  args: SOFTWARE ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--enable-gpu", "--ignore-gpu-blocklist"],
})

const watchdog = setTimeout(async () => {
  console.log("WATCHDOG: verification took too long, cleaning up")
  report.checks.push({ name: "watchdog", ok: false, detail: `stopped after ${WATCHDOG_MS} ms` })
  await browser.close().catch(() => {})
  server.kill()
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2))
  process.exit(2)
}, WATCHDOG_MS)

try {
  // 1. Enter the world (the real entry: loader -> night -> lamp -> pull back)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ctx.setDefaultTimeout(45000)
  const page = await ctx.newPage()
  page.on("console", (m) => m.type() !== "log" && report.console.push(`[${m.type()}] ${m.text()}`))
  page.on("pageerror", (e) => report.console.push(`[pageerror] ${e.message}`))
  const t0 = Date.now()
  await page.goto(BASE + Q)
  await shot(page, "01-loader")
  const revealed = await page.waitForSelector("#loader", { state: "hidden", timeout: 60000 }).then(() => true, () => false)
  report.perf.revealMs = Date.now() - t0
  check("1. enters the world (loader hands over)", revealed, `${report.perf.revealMs} ms`)
  await shot(page, "02-reveal-night")
  await page.waitForTimeout(SOFTWARE ? 9000 : 4500)
  await shot(page, "03-margin")
  const gl = await sw(page, "window.__sw.perf()")
  report.perf.gpu = gl?.renderer
  check("1b. camera released to the margin", await until(page, "window.__sw.camera().settled && window.__sw.camera().s < 0.05", 20000))

  // 3. Scope reacts: pointer near him, then on him, then a click
  const box = await page.evaluate(() => {
    const el = document.querySelector(".hotspot.is-scope")
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 4
    await page.mouse.move(box.x + Math.cos(a) * 260, box.y + 80 + Math.sin(a) * 140)
    await page.waitForTimeout(SOFTWARE ? 120 : 60)
  }
  const afterMove = await sw(page, "window.__sw.state()")
  const states = new Set(afterMove.log.map((l) => l.state))
  check("3a. pointer moving: Scope becomes curious / follows", states.has("follow") || states.has("curious"), [...states].join(", "))
  const pres = await sw(page, "window.__sw.scope().presence")
  check("3b. eyes lead, body follows (presence non-zero)", Math.abs(pres.eyeMm[0]) + Math.abs(pres.eyeMm[1]) > 0.2, JSON.stringify(pres))
  await page.mouse.move(box.x, box.y + 40)
  await page.waitForTimeout(SOFTWARE ? 2500 : 800)
  await shot(page, "04-scope-looks-at-you")
  // activate Scope's own button (it moves with him: a coordinate click could land elsewhere)
  await page.locator(".hotspot.is-scope").dispatchEvent("click")
  // if he faces away, he turns to you first (a small hop), then reacts
  const reacted = await until(page, "window.__sw.scope().clips.includes('ClickReaction')", SOFTWARE ? 15000 : 5000)
  const clicked = await sw(page, "window.__sw.state()")
  check("3c. click: interact + ClickReaction", reacted && clicked.state === "interact", `${clicked.state} ${await sw(page, "window.__sw.scope().clips")}`)
  await shot(page, "05-click-reaction")

  // 2. Explore: the route, by keyboard
  await page.mouse.move(5, 450)
  for (let i = 1; i <= 3; i++) {
    await page.keyboard.press("ArrowRight")
    const ok = await until(page, `window.__sw.camera().settled && Math.round(window.__sw.camera().s) === ${i}`, 25000)
    await page.waitForTimeout(SOFTWARE ? 1500 : 600)
    const crumb = await page.textContent("#crumb-place")
    check(`2. route → station ${i} (${crumb})`, ok)
    await shot(page, `06-station-${i}`)
  }
  const followed = await until(page, "window.__sw.state().log.some(l => /follows the visitor/.test(l.activity))", 5000)
  check("3d. Scope comes along when the visitor moves on", followed)

  // 4–5. MathView: hover glow, open from its object, real content, back
  const mv = page.locator(".hotspot", { hasText: "MathView" })
  check("4a. MathView hotspot is reachable", await mv.isVisible())
  await mv.hover({ force: true })
  await page.waitForTimeout(SOFTWARE ? 1500 : 500)
  await shot(page, "07-mathview-hover")
  await mv.click({ force: true })
  const opened = await page.waitForSelector("#project:not([hidden])", { timeout: 20000 }).then(() => true, () => false)
  await page.waitForTimeout(SOFTWARE ? 3000 : 1200)
  const title = await page.textContent("#project-title")
  const focusInside = await page.evaluate(() => document.getElementById("project").contains(document.activeElement))
  check("4b. project opens from the tile (dialog, real content)", opened && title === "MathView", title)
  check("4c. focus moves into the dialog", focusInside)
  check("4d. URL reflects the project", page.url().endsWith("#mathview"))
  await shot(page, "08-mathview-open")
  await page.keyboard.press("Escape")
  const closed = await page.waitForSelector("#project", { state: "hidden", timeout: 20000 }).then(() => true, () => false)
  const back = await until(page, "window.__sw.camera().focus < 0.02 && window.__sw.camera().settled", 20000)
  const cam = await sw(page, "window.__sw.camera()")
  check("5a. Esc closes; camera returns to the light (same place)", closed && back && Math.round(cam.s) === 3, JSON.stringify(cam))
  const focusBack = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName)
  check("5b. focus returns to the MathView hotspot", /MathView/.test(focusBack ?? ""), focusBack)
  await page.waitForTimeout(SOFTWARE ? 2000 : 800)
  await shot(page, "09-back-in-the-world")

  // performance at rest (only meaningful with a GPU)
  await page.waitForTimeout(SOFTWARE ? 4000 : 5000)
  report.perf.atRest = await sw(page, "window.__sw.perf()")
  report.perf.world = await sw(page, "window.__sw.world()")
  check("console: no errors", !report.console.some((l) => /error/i.test(l)), report.console.slice(0, 3).join(" | "))
  await ctx.close()

  // touch phone
  const phone = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true })
  phone.setDefaultTimeout(45000)
  const p2 = await phone.newPage()
  p2.on("pageerror", (e) => report.console.push(`[phone pageerror] ${e.message}`))
  await p2.goto(BASE + Q + "&skipintro")
  await p2.waitForSelector("#loader", { state: "hidden", timeout: 60000 })
  await p2.waitForTimeout(SOFTWARE ? 4000 : 1500)
  await shot(p2, "10-phone-margin")
  await p2.tap('.route button[data-station="3"]')
  await until(p2, "window.__sw.camera().settled && Math.round(window.__sw.camera().s) === 3", 25000)
  await p2.waitForTimeout(SOFTWARE ? 2000 : 600)
  await shot(p2, "11-phone-light")
  await p2.evaluate(() => window.__sw.open("mathview"))
  await p2.waitForSelector("#project:not([hidden])", { timeout: 20000 })
  await p2.waitForTimeout(SOFTWARE ? 3000 : 1200)
  await shot(p2, "12-phone-mathview")
  check("6a. phone: route + project usable by touch", await p2.isVisible("#project-title"))
  await phone.close()

  // reduced motion
  const rm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })
  rm.setDefaultTimeout(45000)
  const p3 = await rm.newPage()
  await p3.goto(BASE + Q)
  await p3.waitForSelector("#loader", { state: "hidden", timeout: 60000 })
  await p3.keyboard.press("ArrowRight")
  await p3.waitForTimeout(600)
  const rmCam = await sw(p3, "window.__sw.camera()")
  check("6b. reduced motion: the camera cuts (no flight)", Math.abs(rmCam.s - 1) < 0.01, JSON.stringify(rmCam))
  const rmW = await sw(p3, "window.__sw.state().weight")
  check("6c. reduced motion: no presence motion", rmW.eyes === 0 && rmW.body === 0, JSON.stringify(rmW))
  await rm.close()

  // no WebGL: the reading view
  const fb = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const p4 = await fb.newPage()
  await p4.goto(BASE + "?fallback")
  await p4.waitForSelector("#reading:not([hidden])", { timeout: 20000 })
  const txt = await p4.textContent("#reading")
  check("6d. fallback: projects and questions as a page", /MathView/.test(txt) && /When should one AI agent become two/.test(txt))
  await shot(p4, "13-fallback")
  await fb.close()
} catch (err) {
  check("verification ran to the end", false, String(err).slice(0, 300))
} finally {
  clearTimeout(watchdog)
  await browser.close()
  server.kill()
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2))
  const failed = report.checks.filter((c) => !c.ok).length
  console.log(`\n${report.checks.length - failed}/${report.checks.length} checks passed · report: ${path.join(OUT, "report.json")}`)
}
