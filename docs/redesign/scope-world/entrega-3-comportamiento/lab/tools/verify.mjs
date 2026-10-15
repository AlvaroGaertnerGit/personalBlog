// Reproducible browser check of the behaviour lab. Starts its own server on 3121
// (so it never collides with one you have open on 3120), drives Chrome through
// the lab with window.__lab (deterministic sim steps, no dependence on the frame
// rate), measures, takes screenshots, writes report.json, and stops everything.
//
//   node docs/redesign/scope-world/entrega-3-comportamiento/lab/tools/verify.mjs [--out dir] [--headed] [--software]
//   (report.json + screenshots go to <tmp>/scope-lab-verify unless --out is given)

import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, "..", "..", "..", "..", "..", "..")
const require = createRequire(path.join(repo, "package.json"))
const { chromium, devices } = require("@playwright/test")

const arg = (k) => process.argv.includes(k)
const val = (k, d) => (arg(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const OUT = path.resolve(val("--out", path.join(os.tmpdir(), "scope-lab-verify")))
const PORT = 3121
const BASE = `http://localhost:${PORT}/`
mkdirSync(OUT, { recursive: true })

const report = { when: new Date().toISOString(), checks: [], perf: {}, console: [] }
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`)
}
const fmt = (n, d = 2) => Number(n).toFixed(d)

const server = spawn(process.execPath, [path.join(here, "serve.mjs"), "--port", String(PORT)], { stdio: "ignore" })
await new Promise((r) => setTimeout(r, 700))
const browser = await chromium.launch({
  channel: "chrome",
  headless: !arg("--headed"),
  args: arg("--software") ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--enable-gpu", "--ignore-gpu-blocklist"],
})
const watchdog = setTimeout(async () => {
  console.log("WATCHDOG: too long, cleaning up")
  await browser.close().catch(() => {})
  server.kill()
  process.exit(2)
}, 600_000)

async function open(query = "", context = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...context })
  const page = await ctx.newPage()
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") report.console.push(`${query} ${m.type()}: ${m.text()}`)
  })
  page.on("pageerror", (e) => report.console.push(`${query} pageerror: ${e.message}`))
  await page.goto(BASE + query)
  await page.waitForFunction("window.__lab || window.__bench", null, { timeout: 60000 })
  return { page, ctx }
}
const lab = (page, fn, a) => page.evaluate(fn, a)
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) })

try {
  // 1 · the route: he starts with you, guides, keeps up, never lost long
  {
    const { page, ctx } = await open("?debug")
    const r = await lab(page, () => {
      const L = window.__lab
      L.advance(3)
      const t0 = L.state().now
      L.goTo(1)
      let firstGo = -1
      let guided = false
      let maxStep = 0
      let prev = L.state().scope.at
      for (let i = 0; i < 360; i++) {
        L.advance(1 / 60)
        const s = L.state()
        if (firstGo < 0 && s.scope.speed > 0.001) firstGo = s.now - t0
        if (s.state?.startsWith("guiar")) guided = true
        maxStep = Math.max(maxStep, Math.hypot(s.scope.at[0] - prev[0], s.scope.at[1] - prev[1]))
        prev = s.scope.at
      }
      // a jump across the route
      L.goTo(4)
      let lostSince = -1
      let worst = 0
      for (let i = 0; i < 900; i++) {
        L.advance(1 / 60)
        const s = L.state()
        if (s.distance > 0.5 || !s.visible) lostSince = lostSince < 0 ? s.now : lostSince
        else lostSince = -1
        if (lostSince >= 0) worst = Math.max(worst, s.now - lostSince)
        maxStep = Math.max(maxStep, Math.hypot(s.scope.at[0] - prev[0], s.scope.at[1] - prev[1]))
        prev = s.scope.at
      }
      return { firstGo, guided, worst, maxStep, end: L.state().distance }
    })
    check("se pone en marcha contigo (antes de que la cámara llegue, ~1,3 s)", r.firstGo >= 0 && r.firstGo < 0.8, `a los ${fmt(r.firstGo)} s`)
    check("se adelanta para enseñarte un lugar nuevo", r.guided)
    check("nunca está perdido (lejos o fuera de cuadro) más de 6 s tras un salto", r.worst < 6, `${fmt(r.worst, 1)} s`)
    check("sin teletransportes: desplazamiento máximo por paso ≤ 22 cm/s · 1/60 s (+ embestida)", r.maxStep < 0.0065, `${fmt(r.maxStep * 1000, 2)} mm/paso`)
    await shot(page, "01-radiometro")
    await ctx.close()
  }

  // 2 · the three interactions
  {
    const { page, ctx } = await open("?lugar=2&debug")
    const ball = await lab(page, () => {
      const L = window.__lab
      const b0 = L.state().ball.at
      let hit = 0
      for (let i = 0; i < 40; i++) {
        L.advance(0.5)
        hit = Math.max(hit, L.state().ball.lastHit.dv)
      }
      const b1 = L.state().ball.at
      return { hit, moved: Math.hypot(b1[0] - b0[0], b1[1] - b0[1]) }
    })
    check("empuja la bola con la cara y la bola responde al impulso", ball.hit > 0.1 && ball.moved > 0.04, `impulso ${fmt(ball.hit)} m/s, recorrido ${fmt(ball.moved * 100, 1)} cm`)
    await shot(page, "02-bola")
    await ctx.close()
  }
  for (const [lugar, id] of [[3, "flower"], [4, "radiometer"]]) {
    const { page, ctx } = await open(`?lugar=${lugar}&hora=noche&debug`)
    const r = await lab(page, (id) => {
      const L = window.__lab
      let maxE = 0
      let maxOmega = 0
      let bloomed = false
      for (let i = 0; i < 70; i++) {
        L.advance(0.2)
        const s = L.state()
        maxE = Math.max(maxE, id === "flower" ? s.flower.irradiance : s.radiometer.light.scope)
        maxOmega = Math.max(maxOmega, s.radiometer.omega)
        bloomed = bloomed || s.flower.bloomed
        if (s.act.phase === "reaccion" && !window.__shot) return { maxE, maxOmega, bloomed, phase: s.act.phase }
      }
      return { maxE, maxOmega, bloomed }
    }, id)
    if (id === "flower") check("la flor guarda su luz y se abre", r.bloomed && r.maxE > 20, `irradiancia máx. ${fmt(r.maxE, 0)}`)
    else check("el radiómetro gira con su luz", r.maxOmega > 5 && r.maxE > 20, `${fmt(r.maxOmega, 1)} rad/s, irradiancia ${fmt(r.maxE, 0)}`)
    await shot(page, `03-${id}`)
    // without his light it slows down again (it answers to the light, not to a timer)
    if (id === "radiometer") {
      const after = await lab(page, () => {
        const L = window.__lab
        L.advance(12)
        return L.state().radiometer.omega
      })
      check("sin su luz, el radiómetro vuelve a su giro lento", after < 2, `${fmt(after, 1)} rad/s`)
    }
    await ctx.close()
  }
  {
    const { page, ctx } = await open("?hora=noche&debug")
    const r = await lab(page, () => {
      const L = window.__lab
      L.advance(25)
      let fitAt = -1
      for (let i = 0; i < 90 && fitAt < 0; i++) {
        L.advance(0.2)
        const s = L.state()
        if (s.scope.inRefuge && s.act.done) fitAt = s.now
      }
      const seated = L.state()
      L.goTo(2)
      const t0 = L.state().now
      let out = -1
      for (let i = 0; i < 90 && out < 0; i++) {
        L.advance(1 / 60)
        if (L.state().act.kind === "unfit") out = L.state().now - t0
      }
      return { fitAt, seatedGlow: seated.scope.glow, out }
    })
    check("entra en su refugio tras un rato quieto junto a su casa", r.fitAt > 30, `sentado a los ${fmt(r.fitAt, 1)} s, luz ${fmt(r.seatedGlow)}`)
    check("sale del refugio en menos de 1 s si te mueves", r.out >= 0 && r.out < 1, `${fmt(r.out)} s`)
    await ctx.close()
  }

  // 3 · clicks, reading, looking at him
  {
    const { page, ctx } = await open("?lugar=1&debug")
    const r = await lab(page, () => {
      const L = window.__lab
      L.advance(14)
      // three touches within the 8 s window (a reaction in progress queues the next one)
      for (let k = 0; k < 3; k++) {
        L.click("scope")
        L.advance(2.4)
      }
      L.advance(3)
      const variants = L.state()
        .log.filter((l) => l.text.startsWith("reacción al clic"))
        .map((l) => l.text.slice("reacción al clic: ".length))
      L.advance(10)
      L.read(true)
      const at0 = L.state().scope.at
      let moved = 0
      let clipsWhileReading = []
      for (let i = 0; i < 30; i++) {
        L.advance(0.2)
        const s = L.state()
        moved = Math.max(moved, Math.hypot(s.scope.at[0] - at0[0], s.scope.at[1] - at0[1]))
        clipsWhileReading.push(...s.clips)
      }
      L.click("scope")
      L.advance(0.3)
      const readingReaction = L.state().reason
      L.read(false)
      return { variants, moved, clipsWhileReading: [...new Set(clipsWhileReading)], readingReaction }
    })
    check("clic: reacción completa, luego ladeo, luego solo parpadeo", /gira hacia ti/.test(r.variants[0]) && /ladea/.test(r.variants[1]) && /parpadea/.test(r.variants[2]), r.variants.map((v) => v.split(":")[0]).join(" · "))
    check("leyendo: no se desplaza ni hace gestos los primeros segundos", r.moved < 0.005 && r.clipsWhileReading.length === 0, `movido ${fmt(r.moved * 1000, 1)} mm`)
    check("clic mientras lees: solo parpadea", /parpadea/.test(r.readingReaction), r.readingReaction)
    await ctx.close()
  }

  // 4 · gait inside the approved ranges; the shell never under the floor
  {
    const { page, ctx } = await open("?debug")
    const r = await lab(page, () => {
      const L = window.__lab
      let lowest = Infinity
      L.advance(1)
      for (const i of [4, 0, 2, 4, 1]) {
        L.goTo(i)
        for (let k = 0; k < 60; k++) {
          L.advance(0.1)
          lowest = Math.min(lowest, L.lowestShellMm())
        }
      }
      return { gait: L.state().gait.range, lowest }
    })
    check("paso dentro del rango aprobado (squash 0,91–1,07; vuelo ≤ 11 mm)", r.gait.squashMin >= 0.91 && r.gait.squashMax <= 1.07 && r.gait.liftMaxMm <= 11, `squash ${fmt(r.gait.squashMin, 3)}–${fmt(r.gait.squashMax, 3)}, vuelo ${fmt(r.gait.liftMaxMm, 1)} mm, inclinación ${fmt(r.gait.leanMaxDeg, 1)}°`)
    check("la carcasa nunca atraviesa el plano donde se apoya", r.lowest > -0.3, `mínimo ${fmt(r.lowest, 2)} mm`)
    await ctx.close()
  }

  // 5 · reduced motion, phone
  {
    const { page, ctx } = await open("?reduced")
    const r = await lab(page, () => {
      const L = window.__lab
      L.advance(2)
      L.goTo(3)
      let maxSpeed = 0
      for (let i = 0; i < 60; i++) {
        L.advance(0.1)
        maxSpeed = Math.max(maxSpeed, L.state().scope.speed)
      }
      L.click("scope")
      L.advance(0.4)
      return { maxSpeed, clips: L.state().clips, d: L.state().distance }
    })
    check("movimiento reducido: nunca camina; está allí al cortar", r.maxSpeed === 0 && r.d < 0.3, `distancia ${fmt(r.d)} m`)
    check("movimiento reducido: el clic es un parpadeo", r.clips.every((c) => c === "BlinkDouble"), r.clips.join("+"))
    await ctx.close()
  }
  {
    const { page, ctx } = await open("?lugar=3", { ...devices["iPhone 13"] })
    await page.waitForTimeout(1500)
    await page.locator("[data-place='4']").tap()
    await page.waitForTimeout(3500)
    const s = await lab(page, () => window.__lab.state())
    check("móvil (iPhone 13, táctil): el botón de lugar funciona y Scope te acompaña", s.visitor.zone === 4, `lugar ${s.visitor.zone}, distancia ${fmt(s.distance)} m`)
    await shot(page, "05-movil")
    await ctx.close()
  }

  // 6 · bench and performance (real time)
  {
    const { page, ctx } = await open("?banco")
    await page.waitForTimeout(4000)
    const moved = await page.evaluate(() => window.__bench.lab.at[0] > -0.79 && window.__bench.old.at[0] > -0.49)
    check("banco de pasos: los dos Scopes caminan", moved)
    await shot(page, "06-banco")
    await ctx.close()
  }
  {
    const { page, ctx } = await open("?lugar=2")
    await page.waitForTimeout(6000)
    const p = await page.evaluate(() => window.__lab.perf())
    const f = p.frames.slice(10)
    const avg = f.reduce((a, b) => a + b, 0) / f.length
    const p95 = [...f].sort((a, b) => a - b)[Math.floor(f.length * 0.95)]
    report.perf = { renderer: p.renderer, software: p.software, fps: 1000 / avg, p95, calls: p.calls, triangles: p.triangles, load: p.load }
    console.log(`PERF  ${p.renderer} · ${fmt(1000 / avg, 0)} FPS · p95 ${fmt(p95, 1)} ms · ${p.calls} llamadas · ${Math.round(p.triangles / 1000)} k triángulos${p.software ? " · SIN GPU: no representativo" : ""}`)
    await ctx.close()
  }
  check("consola sin errores ni avisos", report.console.length === 0, report.console.slice(0, 3).join(" | "))
} finally {
  clearTimeout(watchdog)
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await browser.close().catch(() => {})
  server.kill()
  const failed = report.checks.filter((c) => !c.ok).length
  console.log(`\n${report.checks.length - failed}/${report.checks.length} comprobaciones · ${OUT}`)
  process.exitCode = failed ? 1 : 0
}
