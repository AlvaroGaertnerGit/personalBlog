// Reproducible browser check of Scope World 4A. Starts its own servers (the world
// on 3131, the Entrega 2 viewer on 3111, so it never collides with ones you have
// open), drives Chrome with window.__lab (deterministic sim steps: the result does
// not depend on the frame rate), measures, takes screenshots, writes report.json,
// and stops everything.
//
//   node docs/redesign/scope-world/entrega-4-mundo/mundo/tools/verify.mjs [--out dir] [--headed] [--software]

import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const scopeWorld = path.resolve(here, "..", "..", "..")
const repo = path.resolve(scopeWorld, "..", "..", "..")
const require = createRequire(path.join(repo, "package.json"))
const { chromium, devices } = require("@playwright/test")

const arg = (k) => process.argv.includes(k)
const val = (k, d) => (arg(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const OUT = path.resolve(val("--out", path.join(os.tmpdir(), "scope-world-4a-verify")))
const BASE = "http://localhost:3131/"
mkdirSync(OUT, { recursive: true })

const report = { when: new Date().toISOString(), checks: [], perf: [], console: [] }
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`)
}
const fmt = (n, d = 2) => Number(n).toFixed(d)

const servers = [
  spawn(process.execPath, [path.join(here, "serve.mjs"), "--port", "3131"], { stdio: "ignore" }),
  spawn(process.execPath, [path.join(scopeWorld, "entrega-2-entorno", "visor", "tools", "serve.mjs"), "--port", "3111"], { stdio: "ignore" }),
]
await new Promise((r) => setTimeout(r, 800))
const browser = await chromium.launch({
  channel: "chrome",
  headless: !arg("--headed"),
  args: arg("--software") ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--enable-gpu", "--ignore-gpu-blocklist"],
})
const stopAll = async () => {
  await browser.close().catch(() => {})
  for (const s of servers) s.kill()
}
const watchdog = setTimeout(async () => {
  console.log("WATCHDOG: too long, cleaning up")
  await stopAll()
  process.exit(2)
}, 900_000)

async function open(url, context = {}, ready = "window.__lab") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...context })
  const page = await ctx.newPage()
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") report.console.push(`${url} ${m.type()}: ${m.text()}`)
  })
  page.on("pageerror", (e) => report.console.push(`${url} pageerror: ${e.message}`))
  await page.goto(url.startsWith("http") ? url : BASE + url)
  await page.waitForFunction(ready, null, { timeout: 90000 })
  return { page, ctx }
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) })

try {
  // 1 · arrival: he is home, and comes out to meet you
  {
    const { page, ctx } = await open("?debug")
    const r = await page.evaluate(() => {
      const L = window.__lab
      const s0 = L.state()
      let out = -1
      for (let i = 0; i < 90 && out < 0; i++) {
        L.advance(1 / 60)
        if (L.state().act.kind === "unfit") out = L.state().now
      }
      L.advance(5)
      return { start: s0.scope.at, out, after: L.state().scope.at, state: L.state().state }
    })
    check("llegas y Scope está en casa: sale de su linterna a recibirte", r.out >= 0 && r.out < 1.2 && r.after[0] > -1.05, `sale a los ${fmt(r.out)} s; ahora en ${r.after.map((v) => fmt(v)).join(", ")}`)
    await shot(page, "01-llegada")
    await ctx.close()
  }

  // 2 · the whole route: he goes with you, shows each place, never lost long, never teleports
  {
    const { page, ctx } = await open("?debug")
    const r = await page.evaluate(() => {
      const L = window.__lab
      const seen = {}
      let maxStep = 0
      let maxDy = 0
      let prev = L.state().scope
      const heights = new Set()
      let flowerMax = 0
      let bloomed = false
      const tick = () => {
        L.advance(1 / 30)
        const s = L.state()
        maxStep = Math.max(maxStep, Math.hypot(s.scope.at[0] - prev.at[0], s.scope.at[1] - prev.at[1]))
        maxDy = Math.max(maxDy, Math.abs(s.scope.y - prev.y))
        heights.add(Math.round(s.scope.y * 1000))
        flowerMax = Math.max(flowerMax, s.flower.openness)
        bloomed = bloomed || s.flower.bloomed
        prev = s.scope
        return s
      }
      for (let i = 0; i < 180; i++) tick()
      const firstGo = []
      for (const station of [1, 2, 3, 4, 5]) {
        L.goTo(station)
        const t0 = L.state().now
        let go = -1
        const acts = new Set()
        for (let i = 0; i < 30 * 22; i++) {
          const s = tick()
          if (go < 0 && s.scope.speed > 0.001) go = s.now - t0
          acts.add(`${s.state}`)
          if (s.act.kind === "shine" || s.act.kind === "nudge" || (s.act.kind === "gesture" && s.state === "enseñar")) acts.add(`acto:${s.act.kind}`)
        }
        firstGo.push(go)
        seen[station] = [...acts]
      }
      const s = L.state()
      return { seen, firstGo, maxStep, maxDy, heights: [...heights].sort((a, b) => a - b), flowerMax, bloomed, radiometer: s.radiometer, ball: s.ball }
    })
    check("se pone en marcha contigo en cada tramo (< 0,8 s)", r.firstGo.every((g) => g >= 0 && g < 0.8), r.firstGo.map((g) => fmt(g)).join(" · ") + " s")
    check("se adelanta a enseñarte los lugares que no has visto", Object.values(r.seen).filter((a) => a.some((x) => x.startsWith("guiar"))).length >= 3, Object.entries(r.seen).map(([k, a]) => `${k}:${a.some((x) => x.startsWith("guiar")) ? "guía" : "—"}`).join(" "))
    check("enseña lo que ofrece cada lugar (gabinete, bola, flor, radiómetro)", r.seen[1].includes("enseñar") && r.seen[2].includes("acto:nudge") && r.seen[3].includes("acto:shine") && r.seen[5].includes("acto:shine"), Object.entries(r.seen).map(([k, a]) => `${k}:${a.filter((x) => x.startsWith("acto")).join("+") || (a.includes("enseñar") ? "enseñar" : "—")}`).join(" "))
    check("la flor de las preguntas se abre con su luz", r.bloomed && r.flowerMax > 0.9, `apertura máx. ${fmt(r.flowerMax)}`)
    // his fastest: the hurry (0.30 m/s) ×1.236 while airborne in a bound = 12.4 mm per 1/30 s
    check("sin teletransportes en todo el recorrido (nunca más rápido que su prisa)", r.maxStep < 0.013, `máx. ${fmt(r.maxStep * 1000, 1)} mm por paso de 1/30 s`)
    check("continuidad sobre las superficies (papel, pliego, plato): sin saltos de altura", r.maxDy < 0.0025, `máx. ${fmt(r.maxDy * 1000, 2)} mm por paso; alturas pisadas ${r.heights[0]}…${r.heights[r.heights.length - 1]} mm`)
    await shot(page, "02-luz")
    await ctx.close()
  }

  // 3 · a jump across the whole route
  {
    const { page, ctx } = await open("?debug")
    const r = await page.evaluate(() => {
      const L = window.__lab
      L.advance(6)
      L.goTo(5)
      let lostSince = -1
      let worst = 0
      for (let i = 0; i < 60 * 20; i++) {
        L.advance(1 / 60)
        const s = L.state()
        if (s.distance > 0.65 || !s.visible) lostSince = lostSince < 0 ? s.now : lostSince
        else lostSince = -1
        if (lostSince >= 0) worst = Math.max(worst, s.now - lostSince)
      }
      return { worst, d: L.state().distance }
    })
    // 2.1 m of path at his hurry (0.30 m/s) is 7 s: he must not take much longer than running it
    check("tras saltar de la linterna a la luz, llega corriendo (≤ 7 s de carrera + 2 s)", r.worst < 9, `${fmt(r.worst, 1)} s lejos o fuera de cuadro; al final a ${fmt(r.d)} m`)
    await ctx.close()
  }

  // 4 · his places: the radiometer in the lamp's light and in his; the refuge
  for (const hora of ["atardecer", "noche"]) {
    const { page, ctx } = await open(`?lugar=5&hora=${hora}`)
    const r = await page.evaluate(() => {
      const L = window.__lab
      L.advance(1.5)
      const lampOnly = L.state().radiometer.omega
      let maxOmega = 0
      let maxE = 0
      for (let i = 0; i < 80; i++) {
        L.advance(0.2)
        const s = L.state()
        maxOmega = Math.max(maxOmega, s.radiometer.omega)
        maxE = Math.max(maxE, s.radiometer.light.scope)
      }
      // he leaves: without his light (his pilot glow keeps it turning while he stands by it)
      L.goTo(3)
      L.advance(18)
      return { lampOnly, maxOmega, maxE, after: L.state().radiometer.omega, lamp: L.state().radiometer.light.lamp }
    })
    if (hora === "atardecer") check("el radiómetro gira despacio con la lámpara, y deprisa con la luz de Scope", r.lamp > 2.35 && r.after > 0.1 && r.after < 1.5 && r.maxOmega > 8 && r.maxE > 40, `con su luz ${fmt(r.maxOmega, 1)} rad/s; cuando se va, solo la lámpara: ${fmt(r.after, 2)} rad/s`)
    else check("de noche (lámpara apagada) solo lo mueve su luz: cuando se va, se para", r.lamp === 0 && r.after < 0.1 && r.maxOmega > 8, `con su luz ${fmt(r.maxOmega, 1)} rad/s; cuando se va ${fmt(r.after, 2)} rad/s`)
    if (hora === "noche") await shot(page, "03-radiometro-noche")
    await ctx.close()
  }
  {
    const { page, ctx } = await open("?hora=noche&debug")
    const r = await page.evaluate(() => {
      const L = window.__lab
      let fitAt = -1
      for (let i = 0; i < 500 && fitAt < 0; i++) {
        L.advance(0.2)
        const s = L.state()
        if (s.state === "descansando en su refugio") fitAt = s.now
      }
      const glow = L.state().scope.glow
      L.goTo(1)
      const t0 = L.state().now
      let out = -1
      for (let i = 0; i < 90 && out < 0; i++) {
        L.advance(1 / 60)
        if (L.state().act.kind === "unfit") out = L.state().now - t0
      }
      return { fitAt, glow, out }
    })
    check("se mete en su refugio tras un rato quieto en su casa (60 s)", r.fitAt > 60 && r.fitAt < 90, `sentado a los ${fmt(r.fitAt, 1)} s, luz ${fmt(r.glow)}`)
    check("y sale en menos de 1 s si te mueves", r.out >= 0 && r.out < 1, `${fmt(r.out)} s`)
    await ctx.close()
  }

  // 5 · clicks and reading, in the world
  {
    const { page, ctx } = await open("?lugar=2&debug")
    const r = await page.evaluate(() => {
      const L = window.__lab
      L.advance(16)
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
      for (let i = 0; i < 30; i++) {
        L.advance(0.2)
        const s = L.state()
        moved = Math.max(moved, Math.hypot(s.scope.at[0] - at0[0], s.scope.at[1] - at0[1]))
      }
      L.read(false)
      return { variants, moved }
    })
    check("clic: reacción completa, ladeo, parpadeo", /gira hacia ti|de camino/.test(r.variants[0] ?? "") && /ladea/.test(r.variants[1] ?? "") && /parpadea/.test(r.variants[2] ?? ""), r.variants.map((v) => v.split(":")[0]).join(" · "))
    check("leyendo no se desplaza", r.moved < 0.005, `${fmt(r.moved * 1000, 1)} mm`)
    await ctx.close()
  }

  // 6 · the body: inside the approved ranges, the shell never through his floor
  {
    const { page, ctx } = await open("?debug")
    const r = await page.evaluate(() => {
      const L = window.__lab
      let lowest = Infinity
      L.advance(2)
      for (const i of [5, 0, 3, 1]) {
        L.goTo(i)
        for (let k = 0; k < 80; k++) {
          L.advance(0.1)
          lowest = Math.min(lowest, L.lowestShellMm())
        }
      }
      return { gait: L.state().gait.range, lowest }
    })
    check("paso dentro del rango aprobado (squash 0,91–1,07; vuelo ≤ 11 mm)", r.gait.squashMin >= 0.91 && r.gait.squashMax <= 1.07 && r.gait.liftMaxMm <= 11, `squash ${fmt(r.gait.squashMin, 3)}–${fmt(r.gait.squashMax, 3)}, vuelo ${fmt(r.gait.liftMaxMm, 1)} mm`)
    check("la carcasa nunca atraviesa el plano donde se apoya", r.lowest > -0.3, `mínimo ${fmt(r.lowest, 2)} mm`)
    await ctx.close()
  }

  // 7 · reduced motion, the phone, the keyboard
  {
    const { page, ctx } = await open("?reduced")
    const r = await page.evaluate(() => {
      const L = window.__lab
      L.advance(2)
      L.goTo(4)
      let maxSpeed = 0
      for (let i = 0; i < 60; i++) {
        L.advance(0.1)
        maxSpeed = Math.max(maxSpeed, L.state().scope.speed)
      }
      return { maxSpeed, d: L.state().distance }
    })
    check("movimiento reducido: la cámara corta y Scope ya está allí, sin caminar", r.maxSpeed === 0 && r.d < 0.35, `distancia ${fmt(r.d)} m`)
    await ctx.close()
  }
  {
    const { page, ctx } = await open("?lugar=2", { ...devices["iPhone 13"] })
    await page.waitForTimeout(1500)
    await page.locator("[data-place='3']").tap()
    await page.waitForTimeout(4000)
    const s = await page.evaluate(() => window.__lab.state())
    check("móvil (iPhone 13, táctil): los lugares funcionan y te acompaña", s.visitor.zone === 3 && s.distance < 0.65, `lugar ${s.visitor.zone}, distancia ${fmt(s.distance)} m`)
    await shot(page, "04-movil")
    await ctx.close()
  }
  {
    const { page, ctx } = await open("")
    await page.waitForTimeout(800)
    await page.keyboard.press("End")
    await page.waitForTimeout(600)
    const z = await page.evaluate(() => window.__lab.state().visitor)
    await page.keyboard.press("Home")
    await page.waitForTimeout(300)
    const current = await page.locator("[data-place][aria-current='true']").count()
    check("teclado: Fin lleva a «La luz», Inicio a su casa; la cinta marca el lugar", z.s > 0 && current === 1, `s ${fmt(z.s)} tras Fin`)
    await ctx.close()
  }

  {
    const { page, ctx } = await open("?sin3d", {}, "document.body.classList.contains('no-webgl')")
    const n = await page.locator(".fallback li").count()
    check("sin WebGL: los lugares y sus notas como HTML legible", n === 6, `${n} lugares`)
    await ctx.close()
  }

  // 8 · the Entrega 2 viewer still builds its world from the shared stage
  {
    const { page, ctx } = await open("http://localhost:3111/?camara=general", {}, "window.__visor")
    await page.waitForTimeout(2500)
    const v = await page.evaluate(() => ({ calls: window.__visor.perf().calls }))
    check("el visor de la Entrega 2 sigue cargando su mundo (módulo compartido)", v.calls > 10, `${v.calls} llamadas`)
    await shot(page, "05-visor")
    await ctx.close()
  }

  // 9 · performance, real time, at every place
  {
    const { page, ctx } = await open("?debug")
    for (const i of [0, 1, 2, 3, 4, 5]) {
      await page.evaluate((i) => window.__lab.goTo(i), i)
      await page.waitForTimeout(3500)
      const p = await page.evaluate(() => window.__lab.perf())
      const f = p.frames.slice(-90)
      const avg = f.reduce((a, b) => a + b, 0) / f.length
      const p95 = [...f].sort((a, b) => a - b)[Math.floor(f.length * 0.95)]
      report.perf.push({ place: i, fps: 1000 / avg, p95, calls: p.calls, triangles: p.triangles, renderer: p.renderer, software: p.software })
      console.log(`PERF  lugar ${i}: ${fmt(1000 / avg, 0)} FPS · p95 ${fmt(p95, 1)} ms · ${p.calls} llamadas · ${Math.round(p.triangles / 1000)} k triángulos`)
    }
    report.load = await page.evaluate(() => window.__lab.perf().load)
    console.log(`PERF  ${report.perf[0].renderer}${report.perf[0].software ? " · SIN GPU: no representativo" : ""} · carga ${JSON.stringify(report.load)}`)
    await ctx.close()
  }
  check("consola sin errores ni avisos", report.console.length === 0, report.console.slice(0, 3).join(" | "))
} finally {
  clearTimeout(watchdog)
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await stopAll()
  const failed = report.checks.filter((c) => !c.ok).length
  console.log(`\n${report.checks.length - failed}/${report.checks.length} comprobaciones · ${OUT}`)
  process.exitCode = failed ? 1 : 0
}
