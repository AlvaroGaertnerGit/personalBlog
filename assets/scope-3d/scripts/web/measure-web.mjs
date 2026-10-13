// Scope 3D — reproducible web measurements against the running lab.
//
//   pnpm dev                                   (or: npx next dev -p 3100)
//   node assets/scope-3d/scripts/web/measure-web.mjs [baseUrl] [--out file.json]
//
// Drives real Chrome (GPU) through /scope-lab/preview and reports, as JSON:
//   sharpness   pixels that crawl frame to frame vs an 8x supersampled reference
//               of the SAME frames (LookAround at 160 px): 1x renderer vs auto
//   continuity  the real director at 60 fps: autonomous -> click interrupt ->
//               laugh -> idle, and every autonomous clip back to back; a pop
//               shows up as an acceleration spike on the tracked bones
//   antenna     runtime spring: peak bend per clip and when it has settled
//   feet        Bounce: per-foot lift time and peak (never in unison)
//   perf        load, per-frame GPU+CPU cost per quality, live FPS, CPU-throttled
//               FPS, off-screen sleep, prefers-reduced-motion
// Measured numbers and their interpretation: reports/POLISH_REVIEW.md.

import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const { chromium } = createRequire(path.join(ROOT, "package.json"))("@playwright/test")

const args = process.argv.slice(2)
const outIndex = args.indexOf("--out")
const outFile = outIndex >= 0 ? args.splice(outIndex, 2)[1] : null
const BASE = (args[0] ?? "http://localhost:3000").replace(/\/$/, "")
const GPU_ARGS = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"]

async function openPreview(browser, query, contextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...contextOptions })
  const page = await context.newPage()
  const started = Date.now()
  await page.goto(`${BASE}/scope-lab/preview?${query}`)
  await page.waitForFunction(() => window.__scopeLab, null, { timeout: 120_000 })
  return { context, page, readyMs: Date.now() - started }
}

// --- in-page measurements (serialised into the page) ------------------------------

/** Crawling pixels per frame vs an 8x reference; renders the same clip three times. */
function sharpness({ clip, frames }) {
  const h = window.__scopeLab
  const { stage, animator: a, secondary: s, director: d } = h
  d.setPaused(true)
  s.options = { ...s.options, life: false }
  const gl = stage.renderer.getContext()
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const toDisplay = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
  /** Display-encoded luminance (0-255) over black, box-downsampled by k in linear light. */
  const capture = (k) => {
    const w = gl.drawingBufferWidth
    const px = new Uint8Array(w * w * 4)
    gl.readPixels(0, 0, w, w, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const n = w / k
    const out = new Float32Array(n * n)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let r = 0, g = 0, b = 0
        for (let j = 0; j < k; j++)
          for (let i = 0; i < k; i++) {
            const o = ((y * k + j) * w + x * k + i) * 4
            const alpha = px[o + 3] / 255
            if (alpha <= 0) continue
            r += toLinear(px[o] / 255 / alpha) * alpha
            g += toLinear(px[o + 1] / 255 / alpha) * alpha
            b += toLinear(px[o + 2] / 255 / alpha) * alpha
          }
        const kk = k * k
        out[y * n + x] = 255 * (0.2126 * toDisplay(r / kk) + 0.7152 * toDisplay(g / kk) + 0.0722 * toDisplay(b / kk))
      }
    return out
  }
  const run = (quality, k) => {
    stage.setQuality(quality)
    a.stopAll(0)
    s.reset()
    a.idle.time = 2
    a.play(clip)
    const out = []
    for (let i = 0; i < frames; i++) {
      a.update(i === 0 ? 0 : 1 / 60)
      s.update(i === 0 ? 0 : 1 / 60, a.busy)
      stage.render()
      out.push(capture(k))
    }
    return out
  }
  const ref = run({ pixelRatio: 8, ssaa: 1 }, 8)
  const score = (test) => {
    let crawl = 0, err = 0, count = 0
    const mask = ref[0].map((_, i) => ref.some((f) => f[i] > 3))
    for (let t = 0; t < frames; t++)
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) continue
        const e = test[t][i] - ref[t][i]
        err += Math.abs(e)
        count++
        if (t > 0 && Math.abs(e - (test[t - 1][i] - ref[t - 1][i])) > 16) crawl++
      }
    return { meanError: +(err / count).toFixed(2), crawlingPxPerFrame: +(crawl / (frames - 1)).toFixed(1) }
  }
  const result = {
    "1x (MSAA only, previous renderer)": score(run({ pixelRatio: 1, ssaa: 1 }, 1)),
    "auto (3x, resolved after tone mapping)": score(run({ pixelRatio: 1, ssaa: 3 }, 1)),
  }
  a.stopAll(0)
  d.setPaused(false)
  return result
}

function continuity() {
  const h = window.__scopeLab, d = h.director
  const V = h.model.root.position.constructor
  const names = ["antenna2", "eyeL", "eyeR", "body", "footFL", "footBR"]
  const bones = names.map((n) => h.model.root.getObjectByName(n))
  d.setPaused(true)
  d.setAutonomous(false)
  d.returnToIdle()
  d.setPaused(false)
  const scenario = (script) => {
    const samples = []
    const step = (n) => {
      for (let i = 0; i < n; i++) {
        d.tick(1 / 60)
        h.model.root.updateMatrixWorld(true)
        samples.push({ state: d.snapshot().state, p: bones.map((b) => b.getWorldPosition(new V()).toArray()) })
      }
    }
    script(step)
    let maxSpeed = 0, maxAccel = 0, where = ""
    for (let i = 2; i < samples.length; i++)
      for (let k = 0; k < names.length; k++) {
        const [a, b, c] = [samples[i - 2].p[k], samples[i - 1].p[k], samples[i].p[k]]
        const speed = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]) * 1000
        const accel = Math.hypot(c[0] - 2 * b[0] + a[0], c[1] - 2 * b[1] + a[1], c[2] - 2 * b[2] + a[2]) * 1000
        maxSpeed = Math.max(maxSpeed, speed)
        if (accel > maxAccel) [maxAccel, where] = [accel, `${names[k]} during ${samples[i].state}`]
      }
    return {
      states: [...new Set(samples.map((s) => s.state))].join(" > "),
      maxSpeedMmPerFrame: +maxSpeed.toFixed(2),
      maxAccelMmPerFrame2: +maxAccel.toFixed(3),
      at: where,
    }
  }
  return {
    "autonomous, click at 0.9 s, back to idle": scenario((step) => { step(30); d.triggerAutonomous(); step(54); d.click(); step(216) }),
    "click from idle (full reaction)": scenario((step) => { step(30); d.click(); step(216) }),
    "six autonomous behaviours back to back": scenario((step) => { for (let k = 0; k < 6; k++) { d.triggerAutonomous(); step(192) } }),
  }
}

function antenna() {
  const h = window.__scopeLab, a = h.animator, s = h.secondary
  h.director.setPaused(true)
  s.options = { ...s.options, life: false, spring: true }
  const out = {}
  for (const clip of ["Idle", "LookAround.L", "Tilt.L", "Bounce", "BlinkDouble", "Focus.L", "Stretch", "Laugh", "ClickReaction"]) {
    a.stopAll(0)
    s.reset()
    a.idle.time = 0
    a.update(0)
    s.update(0, false)
    if (clip !== "Idle") a.play(clip)
    const duration = clip === "Idle" ? 8.4 : a.duration(clip)
    const peak = [0, 0]
    let settled = 0
    for (let i = 0; i < Math.ceil((duration + 1) * 60); i++) {
      a.update(1 / 60)
      s.update(1 / 60, a.busy)
      s.segments.forEach((seg, k) => {
        const deg = (seg.theta.length() * 180) / Math.PI
        peak[k] = Math.max(peak[k], deg)
        if (deg > 0.5) settled = (i + 1) / 60
      })
    }
    out[clip] = { peakDeg: peak.map((p) => +p.toFixed(1)), settledAfterClipS: +Math.max(0, settled - duration).toFixed(2) }
  }
  a.stopAll(0)
  s.options = { ...s.options, life: true }
  h.director.setPaused(false)
  return out
}

function feet() {
  const h = window.__scopeLab, a = h.animator
  h.director.setPaused(true)
  const bones = ["footFL", "footFR", "footBL", "footBR"].map((n) => h.model.root.getObjectByName(n))
  a.stopAll(0)
  a.play("Bounce")
  a.update(0)
  const series = bones.map(() => [])
  for (let i = 0; i <= 72; i++) {
    bones.forEach((b, k) => series[k].push((2 * Math.acos(Math.min(1, Math.abs(b.quaternion.w))) * 180) / Math.PI))
    a.update(1 / 60)
  }
  h.director.setPaused(false)
  return Object.fromEntries(
    bones.map((b, k) => {
      const s = series[k]
      const peak = Math.max(...s)
      return [b.name, { liftS: +(s.findIndex((v) => v > 1) / 60).toFixed(3), peakS: +(s.indexOf(peak) / 60).toFixed(3), peakDeg: +peak.toFixed(1) }]
    }),
  )
}

/** Synchronous GPU+CPU cost of one frame, forced to completion with a 1-px readback. */
function frameCost(quality) {
  const h = window.__scopeLab, stage = h.stage
  h.director.setPaused(true)
  stage.setQuality(quality)
  const gl = stage.renderer.getContext()
  const px = new Uint8Array(4)
  const frame = () => { h.director.tick(1 / 60); stage.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px) }
  for (let i = 0; i < 20; i++) frame()
  const t0 = performance.now()
  for (let i = 0; i < 120; i++) frame()
  const ms = (performance.now() - t0) / 120
  h.director.setPaused(false)
  return { ms: +ms.toFixed(2), internalPx: stage.resolution.internal.join("x"), drawCalls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles }
}

// --- run ---------------------------------------------------------------------------
const report = { baseUrl: BASE, date: new Date().toISOString() }
const browser = await chromium.launch({ channel: "chrome", args: GPU_ARGS })
{
  const { context, page, readyMs } = await openPreview(browser, "size=160&autonomous=0")
  await page.waitForTimeout(1500)
  report.gpu = await page.evaluate(() => {
    const gl = window.__scopeLab.stage.renderer.getContext()
    const info = gl.getExtension("WEBGL_debug_renderer_info")
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown"
  })
  report.load = await page.evaluate((readyMs) => {
    const { stats } = window.__scopeLab.model
    return {
      readyMs, glbMB: +(stats.bytes / 1048576).toFixed(2), fetchMs: Math.round(stats.fetchMs), parseMs: Math.round(stats.parseMs),
      envelopeMs: Math.round(window.__scopeLab.frame().envelopeMs), triangles: stats.triangles, vertices: stats.vertices,
      joints: stats.joints, morphTargets: stats.morphTargets,
    }
  }, readyMs)
  report.sharpness160 = await page.evaluate(sharpness, { clip: "LookAround.L", frames: 120 })
  report.continuity = await page.evaluate(continuity)
  report.antenna = await page.evaluate(antenna)
  report.feet = await page.evaluate(feet)
  report.frameCost160 = {}
  for (const ssaa of [1, 2, 3]) report.frameCost160[`ssaa ${ssaa}`] = await page.evaluate(frameCost, { pixelRatio: 1, ssaa })
  await page.evaluate(() => window.__scopeLab.stage.setQuality({ pixelRatio: 1, ssaa: 3 }))
  await page.waitForTimeout(2500)
  report.live = await page.evaluate(() => { const f = window.__scopeLab.frame(); return { fps: Math.round(f.fps), mainThreadMs: +f.cpuMs.toFixed(2), quality: f.quality, governed: f.governed } })
  report.offscreen = await page.evaluate(async () => {
    const h = window.__scopeLab
    document.body.style.minHeight = "4000px"
    window.scrollTo(0, 3000)
    await new Promise((r) => setTimeout(r, 1500))
    const sleeping = h.frame().sleeping
    const clock = h.director.snapshot().clockMs
    await new Promise((r) => setTimeout(r, 1000))
    const advancedMs = Math.round(h.director.snapshot().clockMs - clock)
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 800))
    return { sleepingWhenScrolledAway: sleeping, clockAdvancedWhileAwayMs: advancedMs, awakeAgain: !h.frame().sleeping }
  })
  await context.close()
}
for (const rate of [4, 6]) {
  const { context, page } = await openPreview(browser, "size=160&autonomous=1")
  const cdp = await context.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate })
  await page.waitForTimeout(6000)
  report[`cpuThrottled${rate}x`] = await page.evaluate(() => { const f = window.__scopeLab.frame(); return { fps: Math.round(f.fps), mainThreadMs: +f.cpuMs.toFixed(2), quality: f.quality, governed: f.governed } })
  await context.close()
}
{
  const { context, page } = await openPreview(browser, "size=160", { reducedMotion: "reduce" })
  report.reducedMotion = await page.evaluate(() => ({
    director: window.__scopeLab.director.behaviorConfig.reducedMotion,
    secondary: window.__scopeLab.secondary.options.reducedMotion,
  }))
  await context.close()
}
await browser.close()

const json = JSON.stringify(report, null, 2)
if (outFile) fs.writeFileSync(outFile, json + "\n")
console.log(json)
