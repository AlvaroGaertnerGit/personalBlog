// Stills of the live prototype (real-time frames, not Blender renders) for the
// documentation: every station, MathView before/open/after, and a phone.
//   node docs/redesign/scope-world/prototype/tools/capture.mjs [--out dir] [--software]
// Starts and stops its own server on 3100.

import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, "..", "..", "..", "..", "..")
const require = createRequire(path.join(repo, "package.json"))
const { chromium, devices } = require("@playwright/test")

const val = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const SOFTWARE = process.argv.includes("--software")
const OUT = path.resolve(val("--out", path.join(here, "..", "..", "captures")))
const Q = `?tier=high${SOFTWARE ? "&force3d&maxdt=0.25" : ""}`
const SLOW = SOFTWARE ? 3 : 1
mkdirSync(OUT, { recursive: true })

const server = spawn(process.execPath, [path.join(here, "serve.mjs")], { stdio: "ignore" })
await new Promise((r) => setTimeout(r, 800))
const browser = await chromium.launch({
  channel: "chrome",
  args: SOFTWARE ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--enable-gpu", "--ignore-gpu-blocklist"],
})
const jpg = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 })
const settled = (page, i) =>
  page.waitForFunction(`window.__sw && window.__sw.camera().settled && Math.round(window.__sw.camera().s) === ${i}`, null, {
    timeout: 90000,
    polling: 250,
  })

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } })
  ctx.setDefaultTimeout(90000)
  const page = await ctx.newPage()
  await page.goto("http://localhost:3100/" + Q)
  await page.waitForSelector("#loader", { state: "hidden" })
  await jpg(page, "01-entrada-noche")
  await page.waitForTimeout(2200 * SLOW)
  await jpg(page, "02-entrada-lampara")
  await settled(page, 0)
  await page.waitForTimeout(1500 * SLOW)
  await page.mouse.move(1000, 420)
  await jpg(page, "03-margen")
  for (const [i, name] of [
    [1, "04-preguntas"],
    [2, "05-pliegue"],
    [3, "06-la-luz"],
  ]) {
    await page.evaluate((k) => window.__sw.goStation(k), i)
    await settled(page, i)
    await page.waitForTimeout(2500 * SLOW)
    await jpg(page, name)
  }
  await page.locator(".hotspot", { hasText: "MathView" }).hover({ force: true })
  await page.waitForTimeout(900 * SLOW)
  await jpg(page, "07-mathview-hover")
  await page.evaluate(() => window.__sw.open("mathview"))
  await page.waitForSelector("#project:not([hidden])")
  await page.waitForTimeout(1600 * SLOW)
  await jpg(page, "08-mathview-abierto")
  await page.evaluate(() => window.__sw.close())
  await page.waitForSelector("#project", { state: "hidden" })
  await page.waitForTimeout(2500 * SLOW)
  await jpg(page, "09-vuelta")
  await ctx.close()

  const phone = await browser.newContext({ ...devices["iPhone 13"] })
  phone.setDefaultTimeout(90000)
  const p = await phone.newPage()
  await p.goto("http://localhost:3100/" + Q + "&skipintro")
  await p.waitForSelector("#loader", { state: "hidden" })
  await p.waitForTimeout(2500 * SLOW)
  await jpg(p, "10-movil-margen")
  await p.evaluate(() => window.__sw.goStation(3))
  await settled(p, 3)
  await p.waitForTimeout(1500 * SLOW)
  await jpg(p, "11-movil-la-luz")
  await phone.close()
  console.log(`[capture] ${OUT}`)
} finally {
  await browser.close()
  server.kill()
}
