// Reproducible browser check of Scope World 4A, with or without a GPU.
//
//   node docs/redesign/scope-world/entrega-4-mundo/mundo/tools/verify.mjs [--out dir] [--software] [--headed] [--only name,name]
//
// - Starts its own servers (the world on 3131, the Entrega 2 viewer on 3111: never 3000, never
//   one you have open) and stops them, and Chrome, on every way out (end, error, Ctrl+C, watchdog).
// - Pauses each page's real-time loop and steps the simulation with window.__lab.advance(dt,
//   { render: false }): nothing is drawn while measuring, so a CPU renderer (SwiftShader) is as
//   fast as a GPU, and the result does not depend on the frame rate. Math.random is seeded.
// - Every check has its own time limit: a check that hangs fails with "tiempo agotado" and the
//   run goes on. The thresholds are the approved ones (Entrega 3, the 4A audit) and are fixed
//   here: nothing adjusts them to the result.
// - Writes report.json and screenshots to --out (default: the system's temp folder), never to
//   the repository. Says whether it ran with a GPU or without one.

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
const ONLY = val("--only", "") ? new Set(val("--only", "").split(",")) : null
const PORT = 3131
const BASE = `http://localhost:${PORT}/`
mkdirSync(OUT, { recursive: true })

// --- the approved criteria (fixed) ---------------------------------------------------------
const LOST_MAX_S = 6 // Entrega 3: never lost (far or out of frame) more than 6 s after a jump
const TENSE_M = 0.65 // 4A's «perdido» band: farther than this from you is far
const LENS_MIN_M = 0.3 // the 4A audit: in view, his head never nearer the lens than ~30 cm
const BOUND_MAX = 0.22 * 1.236 // his fastest: the approved hurry, airborne in a bound (m/s)
const SLIP = { trot: 1.6 + 1, bound: 10.1 + 1 } // the lab's approved foot slip in stance (cm/s, median) + 1 cm/s of run-to-run spread
const LIGHT = { 0: "Noche", 1: "Amanecer", 2: "Amanecer", 3: "Día", 4: "Día", 5: "Día" } // Entrega 2: night at the lantern, dawn in the margin, day in the lamp's circle

const report = { when: new Date().toISOString(), renderer: null, gpu: null, checks: [], perf: [], console: [] }
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`)
}
const fmt = (n, d = 2) => Number(n).toFixed(d)

// --- servers and browser, always cleaned up ----------------------------------------------------
const servers = [
  spawn(process.execPath, [path.join(here, "serve.mjs"), "--port", String(PORT)], { stdio: "ignore" }),
  spawn(process.execPath, [path.join(scopeWorld, "entrega-2-entorno", "visor", "tools", "serve.mjs"), "--port", "3111"], { stdio: "ignore" }),
]
let browser = null
let stopped = false
async function stopAll() {
  if (stopped) return
  stopped = true
  await browser?.close().catch(() => {})
  for (const s of servers) s.kill()
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => stopAll().then(() => process.exit(130)))
process.on("exit", () => servers.forEach((s) => s.kill()))
const watchdog = setTimeout(async () => {
  console.log("WATCHDOG: la verificación entera supera 20 min; se cierra todo")
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await stopAll()
  process.exit(2)
}, 20 * 60_000)

await new Promise((r) => setTimeout(r, 800))
browser = await chromium.launch({
  channel: "chrome",
  headless: !arg("--headed"),
  args: arg("--software") ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
})

const contexts = new Set()
async function open(q = "", { phone = false, seed = 7, ready = "window.__lab", context = {} } = {}) {
  const ctx = await browser.newContext(phone ? { ...devices["iPhone 13"], ...context } : { viewport: { width: 1440, height: 900 }, ...context })
  contexts.add(ctx)
  await ctx.addInitScript((seed) => {
    let s = seed >>> 0
    Math.random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32
  }, seed)
  const page = await ctx.newPage()
  page.setDefaultTimeout(60_000)
  const url = q.startsWith("http") ? q : BASE + q
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && report.console.push(`${url} ${m.type()}: ${m.text()}`))
  page.on("pageerror", (e) => report.console.push(`${url} pageerror: ${e.message}`))
  await page.goto(url)
  await page.waitForFunction(ready, null, { timeout: 90_000 })
  if (ready === "window.__lab") await page.evaluate(() => window.__lab.pause())
  return { page, ctx }
}
const close = async (ctx) => {
  contexts.delete(ctx)
  await ctx.close().catch(() => {})
}

/** One check with its own time limit; whatever happens, its pages are closed. */
async function step(name, seconds, fn) {
  if (ONLY && !ONLY.has(name) && name !== "gpu") return
  const before = new Set(contexts)
  let timer
  try {
    await Promise.race([fn(), new Promise((_, no) => (timer = setTimeout(() => no(new Error(`tiempo agotado (${seconds} s)`)), seconds * 1000)))])
  } catch (e) {
    check(`[${name}] terminó con un error`, false, e.message.split("\n")[0])
  } finally {
    clearTimeout(timer)
    for (const c of contexts) if (!before.has(c)) await close(c)
  }
}
const shot = (page, name) => page.evaluate(() => window.__lab?.render()).then(() => page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 82 }))

// --- in the page ---------------------------------------------------------------------------------
/** Sample the sim (dt each) without drawing; returns what `pick` takes each step. */
const SAMPLE = ([seconds, dt, pickSrc]) => {
  const L = window.__lab
  const pick = new Function("s", "L", `return (${pickSrc})(s, L)`)
  const out = []
  for (let k = 0; k < Math.round(seconds / dt); k++) out.push(pick(L.advance(dt, { render: false }), L))
  return out
}
const sample = (page, seconds, dt, pick) => page.evaluate(SAMPLE, [seconds, dt, pick.toString()])
/** Longest time (s) that `lost` holds in a row. */
const longest = (rows, lost) => {
  let since = -1
  let worst = 0
  for (const r of rows) {
    if (lost(r)) since = since < 0 ? r.t : since
    else since = -1
    if (since >= 0) worst = Math.max(worst, r.t - since)
  }
  return worst
}

try {
  await step("gpu", 60, async () => {
    const { page, ctx } = await open("")
    const p = await page.evaluate(() => window.__lab.perf())
    report.renderer = p.renderer
    report.gpu = !p.software
    console.log(`INFO  renderizador: ${p.renderer} → ${p.software ? "SIN GPU (SwiftShader/CPU): las cifras de rendimiento no son representativas" : "con GPU"}`)
    await close(ctx)
  })

  await step("llegada", 90, async () => {
    const { page, ctx } = await open("?debug")
    const rows = await sample(page, 6, 1 / 60, (s) => ({ t: s.now, act: s.act.kind, at: s.scope.at }))
    const out = rows.find((r) => r.act === "unfit")
    check("llegas y Scope está en casa: sale de su linterna a recibirte", out && out.t < 1.2 && rows.at(-1).at[0] > -1.05, `sale a los ${out ? fmt(out.t) : "—"} s`)
    await shot(page, "01-llegada")
    await close(ctx)
  })

  await step("recorrido", 240, async () => {
    const { page, ctx } = await open("?debug")
    await sample(page, 6, 1 / 30, () => 0)
    const legs = []
    for (const to of [1, 2, 3, 4, 5]) {
      await page.evaluate((to) => window.__lab.goTo(to), to)
      legs.push(await sample(page, 22, 1 / 30, (s, L) => ({ t: s.now, at: s.scope.at, y: s.scope.y, speed: s.scope.speed, turning: Math.abs(L.scope.loco.state.yawRate) > 0.05 || L.scope.loco.state.phase !== "still", state: s.state, act: s.act.kind, flower: s.flower.openness, bloomed: s.flower.bloomed })))
    }
    // he answers when he turns toward the way (on the spot, stepping) or walks; walking is reported too
    const answer = legs.map((l) => (l.find((r) => r.speed > 0.001 || r.turning)?.t ?? Infinity) - l[0].t + 1 / 30)
    const firstGo = legs.map((l) => (l.find((r) => r.speed > 0.001)?.t ?? Infinity) - l[0].t + 1 / 30)
    const all = legs.flat()
    let maxStep = 0
    let maxDy = 0
    for (let k = 1; k < all.length; k++) {
      maxStep = Math.max(maxStep, Math.hypot(all[k].at[0] - all[k - 1].at[0], all[k].at[1] - all[k - 1].at[1]))
      maxDy = Math.max(maxDy, Math.abs(all[k].y - all[k - 1].y))
    }
    const guided = legs.filter((l) => l.some((r) => r.state.startsWith("guiar"))).length
    const showed = (i, acts) => legs[i - 1].some((r) => acts.includes(r.act) && (r.state === "enseñar" || r.state.startsWith("enseñar")))
    check("se pone en marcha contigo en cada tramo: gira o anda en < 0,8 s", answer.every((g) => g < 0.8), `responde ${answer.map((g) => fmt(g)).join(" · ")} s; empieza a andar ${firstGo.map((g) => fmt(g)).join(" · ")} s`)
    check("se adelanta a enseñarte los lugares que tienen algo que enseñar (≥ 3 de 4)", guided >= 3, `${guided} tramos con «guiar»`)
    check("enseña lo que ofrece cada lugar: gabinete, bola, flor y radiómetro", showed(1, ["go", "gesture", "nudge"]) && showed(2, ["nudge"]) && showed(3, ["shine"]) && showed(5, ["shine"]))
    check("la flor de las preguntas se abre con su luz", all.some((r) => r.bloomed), `apertura máx. ${fmt(Math.max(...all.map((r) => r.flower)))}`)
    check("sin teletransportes: nunca más rápido que su prisa aprobada", maxStep <= (BOUND_MAX / 30) * 1.02, `máx. ${fmt(maxStep * 1000, 1)} mm por 1/30 s (límite ${fmt((BOUND_MAX / 30) * 1000, 1)})`)
    check("continuidad sobre papel, pliego y plato: sin saltos de altura", maxDy < 0.0025, `máx. ${fmt(maxDy * 1000, 2)} mm por paso`)
    await shot(page, "02-la-luz")
    await close(ctx)
  })

  await step("saltos", 360, async () => {
    for (const phone of [false, true])
      for (const [from, to] of [[0, 5], [5, 0], [1, 5]]) {
        const { page, ctx } = await open(`?lugar=${from}`, { phone })
        await sample(page, 6, 1 / 30, () => 0)
        await page.evaluate((to) => window.__lab.goTo(to), to)
        const rows = await sample(page, 22, 1 / 30, (s) => ({ t: s.now, d: s.distance, v: s.visible, settled: s.visitor.settled }))
        const worst = longest(rows, (r) => r.d > TENSE_M || !r.v)
        const arrived = rows.find((r) => r.settled)?.t - rows[0].t
        check(`${phone ? "móvil" : "escritorio"} · salto ${from}→${to}: nunca perdido (lejos o fuera de cuadro) más de ${LOST_MAX_S} s`, worst <= LOST_MAX_S, `${fmt(worst, 1)} s; la vista llega en ${fmt(arrived, 1)} s; al final a ${fmt(rows.at(-1).d)} m`)
        await close(ctx)
      }
  })

  await step("camara", 600, async () => {
    // every place, desktop and phone, starting there and arriving from the previous one
    const worst = { d: Infinity, where: "" }
    let hiddenWorst = { s: 0, where: "" }
    for (const phone of [false, true])
      for (let lugar = 0; lugar <= 5; lugar++)
        for (const mode of lugar === 0 ? ["en"] : ["en", "llega"]) {
          const { page, ctx } = await open(`?lugar=${mode === "en" ? lugar : lugar - 1}`, { phone })
          if (mode === "llega") await page.evaluate((l) => (window.__lab.advance(6, { render: false }), window.__lab.goTo(l)), lugar)
          const rows = await sample(page, 60, 1 / 30, (s, L) => {
            const c = L.camera().pos
            const v = L.scope.group.position.clone()
            L.scope.headPosition(v)
            return { t: s.now, lens: Math.hypot(v.x - c[0], -v.z - c[1], v.y - c[2]), v: s.visible, settled: s.visitor.settled, refuge: s.scope.inRefuge }
          })
          const where = `${phone ? "móvil" : "escritorio"} lugar ${lugar} (${mode})`
          for (const r of rows) if (r.v && r.lens < worst.d) Object.assign(worst, { d: r.lens, where })
          const hidden = longest(rows, (r) => r.settled && !r.v && !r.refuge)
          if (hidden > hiddenWorst.s) hiddenWorst = { s: hidden, where }
          await close(ctx)
        }
    check(`a la vista, su cabeza nunca a menos de ${LENS_MIN_M * 100} cm del objetivo (6 lugares, escritorio y móvil, quieto y llegando)`, worst.d >= LENS_MIN_M, `mínimo ${fmt(worst.d * 100, 1)} cm en ${worst.where}`)
    check(`ya en un lugar, nunca fuera de cuadro más de ${LOST_MAX_S} s`, hiddenWorst.s <= LOST_MAX_S, `máximo ${fmt(hiddenWorst.s, 1)} s${hiddenWorst.where ? ` en ${hiddenWorst.where}` : ""}`)
  })

  await step("margen", 120, async () => {
    for (const phone of [false, true]) {
      const { page, ctx } = await open("?lugar=2", { phone })
      const rows = await sample(page, 30, 1 / 30, (s, L) => ({ t: s.now, act: s.act.kind, phase: s.act.phase, ball: s.ball.at, cam: L.camera().pos }))
      const pushes = rows.filter((r, k) => r.phase === "empujar" && rows[k - 1]?.phase !== "empujar").length
      const ballNear = Math.min(...rows.map((r) => Math.hypot(r.ball[0] - r.cam[0], r.ball[1] - r.cam[1])))
      check(`${phone ? "móvil" : "escritorio"} · el margen: te acerca la bola empujándola con la cara, sin meterla en el primer plano`, pushes >= 1 && ballNear >= LENS_MIN_M, `${pushes} empujones; la bola, como mucho a ${fmt(ballNear * 100, 0)} cm de la cámara`)
      await shot(page, `03-margen-${phone ? "movil" : "escritorio"}`)
      await close(ctx)
    }
  })

  await step("patas", 180, async () => {
    const { page, ctx } = await open("?debug")
    const slip = await page.evaluate(() => {
      const L = window.__lab
      const root = L.scope.model.root
      const bones = ["footFL", "footFR", "footBL", "footBR"].map((n) => root.getObjectByName(n))
      const tmp = bones[0].position.clone()
      const rows = []
      let prev = null
      const tick = (dt) => {
        const s = L.advance(dt, { render: false })
        root.updateMatrixWorld(true)
        const gait = s.scope.speed < 0.004 ? "still" : s.gait.mode
        const pos = bones.map((b) => (b.getWorldPosition(tmp), [tmp.x, tmp.y, tmp.z]))
        if (prev) for (let k = 0; k < 4; k++) rows.push({ k, h: pos[k][1] - s.scope.y, ph: prev.pos[k][1] - prev.y, v: Math.hypot(pos[k][0] - prev.pos[k][0], pos[k][2] - prev.pos[k][2]) / dt, gait })
        prev = { pos, y: s.scope.y }
      }
      for (let k = 0; k < 120; k++) tick(1 / 60)
      L.goTo(5)
      for (let k = 0; k < 60 * 14; k++) tick(1 / 60)
      for (let i = 4; i >= 0; i--) {
        L.goTo(i)
        for (let k = 0; k < 60 * 6; k++) tick(1 / 60)
      }
      const minH = [0, 1, 2, 3].map((k) => Math.min(...rows.filter((r) => r.k === k).map((r) => r.h)))
      const by = {}
      for (const r of rows) if (r.h - minH[r.k] <= 0.0008 && r.ph - minH[r.k] <= 0.0008) (by[r.gait] ??= []).push(r.v * 100)
      return Object.fromEntries(Object.entries(by).map(([g, v]) => [g, v.sort((a, b) => a - b)[Math.floor(v.length / 2)]]))
    })
    check("el trote no resbala más que el aprobado", slip.trot <= SLIP.trot, `pata apoyada: mediana ${fmt(slip.trot)} cm/s (laboratorio 1,6; 4A antes 3,9)`)
    check("la prisa no resbala más que la aprobada", slip.bound <= SLIP.bound, `mediana ${fmt(slip.bound)} cm/s (laboratorio 10,1; 4A antes 13,2)`)
    await close(ctx)
  })

  await step("luz", 180, async () => {
    const got = {}
    for (let i = 0; i <= 5; i++) {
      const { page, ctx } = await open(`?lugar=${i}`)
      got[i] = (await sample(page, 3, 1 / 30, (s) => s.light.label)).at(-1)
      if (i === 0 || i === 2 || i === 5) await shot(page, `04-luz-lugar-${i}`)
      await close(ctx)
    }
    check("cada lugar tiene la luz que le dio la Entrega 2", Object.entries(LIGHT).every(([i, l]) => got[i] === l), Object.entries(got).map(([i, l]) => `${i}:${l}`).join(" "))
    const { page, ctx } = await open("?lugar=0")
    await page.evaluate(() => window.__lab.goTo(2))
    const rows = await sample(page, 12, 1 / 30, (s) => ({ e: s.light.exposure, h: s.light.hemi, l: s.light.lamp }))
    let jump = 0
    for (let k = 3; k < rows.length; k += 3) jump = Math.max(jump, Math.abs(rows[k].e - rows[k - 3].e), Math.abs(rows[k].h - rows[k - 3].h), Math.abs(rows[k].l - rows[k - 3].l) / 2)
    check("de la noche de la linterna al amanecer del margen sin cortes de luz", jump < 0.12 && rows.at(-1).h > 0.5, `mayor cambio en 0,1 s: ${fmt(jump, 3)}`)
    const labels = []
    for (let k = 0; k < 5; k++) {
      await page.click("#mood")
      labels.push(await page.locator("#mood").textContent())
    }
    check("el botón recorre «la del lugar» y los cuatro ambientes", new Set(labels).size === 5 && labels.at(-1).includes("lugar"), labels.join(" → "))
    await close(ctx)
  })

  await step("mecanismos", 180, async () => {
    for (const hora of ["", "noche"]) {
      const { page, ctx } = await open(`?lugar=5${hora ? `&hora=${hora}` : ""}`)
      const rows = await sample(page, 16, 0.2, (s) => ({ w: s.radiometer.omega, scope: s.radiometer.light.scope, lamp: s.radiometer.light.lamp }))
      await page.evaluate(() => window.__lab.goTo(3))
      const after = (await sample(page, 18, 0.2, (s) => s.radiometer.omega)).at(-1)
      const max = Math.max(...rows.map((r) => r.w))
      if (!hora) check("de día el radiómetro gira despacio con la lámpara, y deprisa con la luz de Scope", rows[0].lamp > 2.35 && after > 0.1 && after < 1.5 && max > 8, `con su luz ${fmt(max, 1)} rad/s; solo la lámpara ${fmt(after)} rad/s`)
      else check("de noche (lámpara apagada) solo lo mueve su luz: cuando se va, se para", rows[0].lamp === 0 && after < 0.1 && max > 8, `con su luz ${fmt(max, 1)} rad/s; después ${fmt(after)} rad/s`)
      await close(ctx)
    }
    const { page, ctx } = await open("?debug")
    const rows = await sample(page, 100, 0.2, (s) => ({ t: s.now, state: s.state, glow: s.scope.glow }))
    const fit = rows.find((r) => r.state === "descansando en su refugio")
    await page.evaluate(() => window.__lab.goTo(1))
    const out = (await sample(page, 2, 1 / 60, (s) => ({ t: s.now, act: s.act.kind }))).find((r) => r.act === "unfit")
    check("su casa, de noche: se mete en el refugio tras un rato quieto (60 s)", fit && fit.t > 60 && fit.t < 90, `sentado a los ${fit ? fmt(fit.t, 1) : "—"} s`)
    check("y sale en menos de 1 s si te mueves", out && out.t - rows.at(-1).t < 1, out ? `${fmt(out.t - rows.at(-1).t)} s` : "no sale")
    await close(ctx)
  })

  await step("clics", 150, async () => {
    const { page, ctx } = await open("?lugar=2&debug")
    await sample(page, 16, 1 / 30, () => 0)
    // the real pointer, on his head as you see it
    const variants = []
    for (let k = 0; k < 3; k++) {
      const p = await page.evaluate(() => (window.__lab.render(), window.__lab.screenOf("scope"))) // a drawn frame, as you see it
      const n0 = await page.evaluate(() => window.__lab.state().log.length)
      await page.mouse.click(p.x, p.y)
      const log = (await sample(page, 2.4, 1 / 30, (s) => s.log)).at(-1)
      variants.push(log.slice(Math.max(0, n0 - 10)).filter((l) => l.text.startsWith("reacción al clic")).map((l) => l.text).at(-1) ?? "—")
    }
    check("clic real sobre Scope: reacción completa, ladeo y parpadeo", /gira hacia ti|de camino/.test(variants[0]) && /ladea/.test(variants[1]) && /parpadea/.test(variants[2]), variants.map((v) => v.replace("reacción al clic: ", "").split(":")[0]).join(" · "))
    const b = await page.evaluate(() => (window.__lab.render(), window.__lab.screenOf("ball")))
    await page.mouse.click(b.x, b.y)
    const ballLog = (await sample(page, 1, 1 / 30, (s) => s.log)).at(-1).map((l) => l.text)
    check("clic real sobre la bola: va a empujarla hacia ti", ballLog.some((t) => t.includes("señalas la bola")), ballLog.at(-1))
    await sample(page, 12, 1 / 30, () => 0)
    await page.evaluate(() => window.__lab.read(true))
    const at = await page.evaluate(() => window.__lab.state().scope.at)
    const moved = Math.max(...(await sample(page, 6, 0.2, (s) => s.scope.at)).map((q) => Math.hypot(q[0] - at[0], q[1] - at[1])))
    check("leyendo no se desplaza", moved < 0.005, `${fmt(moved * 1000, 1)} mm`)
    await close(ctx)
  })

  await step("flor", 90, async () => {
    const { page, ctx } = await open("?lugar=3&debug")
    await sample(page, 14, 1 / 30, () => 0)
    const f = await page.evaluate(() => (window.__lab.render(), window.__lab.screenOf("flower")))
    await page.mouse.click(f.x, f.y)
    const log = (await sample(page, 1, 1 / 30, (s) => s.log)).at(-1).map((l) => l.text)
    check("clic real sobre la flor: va a iluminarla (en la auditoría contaba como suelo)", log.some((t) => t.includes("señalas la flor")), log.at(-1))
    await close(ctx)
  })

  await step("navegacion", 120, async () => {
    // a burst of the wheel across the world and back, then still: he catches up
    const { page, ctx } = await open("?debug")
    await sample(page, 4, 1 / 30, () => 0)
    for (const d of [...Array(14).fill(120), ...Array(6).fill(-120)]) {
      await page.evaluate((d) => window.__lab.wheel(d), d)
      await sample(page, 0.05, 1 / 60, () => 0)
    }
    const rows = await sample(page, 18, 1 / 30, (s) => ({ t: s.now, d: s.distance, v: s.visible }))
    const worst = longest(rows, (r) => r.d > TENSE_M || !r.v)
    check(`ráfaga de rueda: nunca perdido más de ${LOST_MAX_S} s`, worst <= LOST_MAX_S, `${fmt(worst, 1)} s; al final a ${fmt(rows.at(-1).d)} m`)
    await page.reload()
    await page.waitForFunction("window.__lab", null, { timeout: 90_000 })
    await page.evaluate(() => window.__lab.pause())
    const s = await page.evaluate(() => window.__lab.state())
    check("recargar vuelve al principio: en su casa, en la linterna", s.now < 0.5 && s.visitor.zone === 0 && Math.hypot(s.scope.at[0] + 1.2, s.scope.at[1] + 0.4) < 0.05, `t ${fmt(s.now)} s, lugar ${s.visitor.zone}`)
    await close(ctx)
  })

  await step("cuerpo", 120, async () => {
    const { page, ctx } = await open("?debug")
    let lowest = Infinity
    await sample(page, 2, 1 / 30, () => 0)
    for (const i of [5, 0, 3, 1]) {
      await page.evaluate((i) => window.__lab.goTo(i), i)
      lowest = Math.min(lowest, ...(await sample(page, 8, 0.1, (_s, L) => L.lowestShellMm())))
    }
    const g = await page.evaluate(() => window.__lab.state().gait.range)
    check("paso dentro del rango aprobado (squash 0,91–1,07; vuelo ≤ 11 mm)", g.squashMin >= 0.91 && g.squashMax <= 1.07 && g.liftMaxMm <= 11, `squash ${fmt(g.squashMin, 3)}–${fmt(g.squashMax, 3)}, vuelo ${fmt(g.liftMaxMm, 1)} mm`)
    check("la carcasa nunca atraviesa el plano donde se apoya", lowest > -0.3, `mínimo ${fmt(lowest, 2)} mm`)
    await close(ctx)
  })

  await step("reducido", 90, async () => {
    // the system preference, not the URL parameter
    const { page, ctx } = await open("", { context: { reducedMotion: "reduce" } })
    await sample(page, 2, 0.1, () => 0)
    await page.evaluate(() => window.__lab.goTo(4))
    const rows = await sample(page, 6, 0.1, (s) => ({ speed: s.scope.speed, d: s.distance, clips: s.clips.length }))
    check("movimiento reducido (preferencia del sistema): la cámara corta y Scope ya está allí, sin andar ni gestos", rows.every((r) => r.speed === 0 && r.clips === 0) && rows.at(-1).d < 0.35, `distancia ${fmt(rows.at(-1).d)} m`)
    await close(ctx)
  })

  await step("movil", 90, async () => {
    const { page, ctx } = await open("?lugar=2", { phone: true })
    await page.evaluate(() => window.__lab.pause(false)) // real time: a real tap
    await page.locator("[data-place='3']").tap()
    await page.waitForFunction(() => window.__lab.state().visitor.settled && window.__lab.state().visitor.zone === 3, null, { timeout: 60_000 })
    await page.evaluate(() => window.__lab.pause())
    await sample(page, 4, 1 / 30, () => 0)
    const s = await page.evaluate(() => window.__lab.state())
    check("móvil (iPhone 13, táctil): los lugares funcionan y te acompaña", s.visitor.zone === 3 && s.distance < TENSE_M, `lugar ${s.visitor.zone}, a ${fmt(s.distance)} m`)
    await shot(page, "05-movil")
    await close(ctx)
  })

  await step("teclado", 90, async () => {
    const { page, ctx } = await open("")
    await page.keyboard.press("End")
    await sample(page, 1, 1 / 30, () => 0)
    const z = await page.evaluate(() => window.__lab.state().visitor)
    await page.keyboard.press("Home")
    await sample(page, 1, 1 / 30, () => 0)
    const current = await page.locator("[data-place][aria-current='true']").count()
    await page.evaluate(() => window.__lab.render())
    check("teclado: Fin lleva hacia «La luz», Inicio a su casa; la cinta marca el lugar", z.s > 0 && current === 1, `s ${fmt(z.s)} tras Fin`)
    await close(ctx)
  })

  await step("sin3d", 60, async () => {
    const { page, ctx } = await open("?sin3d", { ready: "document.body.classList.contains('no-webgl')" })
    const n = await page.locator(".fallback li").count()
    check("sin WebGL: los lugares y sus notas como HTML legible", n === 6, `${n} lugares`)
    await close(ctx)
  })

  await step("visor", 120, async () => {
    const { page, ctx } = await open("http://localhost:3111/?camara=general", { ready: "window.__visor" })
    const v = await page.evaluate(() => window.__visor.perf().calls)
    check("el visor de la Entrega 2 sigue cargando su mundo", v > 10, `${v} llamadas`)
    await close(ctx)
  })

  await step("rendimiento", 180, async () => {
    // real time, drawn: only informative (it depends on the machine; without a GPU it is not representative)
    const { page, ctx } = await open("?debug")
    await page.evaluate(() => window.__lab.pause(false))
    for (const i of [0, 2, 3, 5]) {
      await page.evaluate((i) => window.__lab.goTo(i), i)
      await page.waitForTimeout(5000)
      const p = await page.evaluate(() => window.__lab.perf())
      const f = p.frames.slice(-60)
      const avg = f.reduce((a, b) => a + b, 0) / f.length
      const p95 = [...f].sort((a, b) => a - b)[Math.floor(f.length * 0.95)]
      report.perf.push({ place: i, fps: 1000 / avg, p95, calls: p.calls, triangles: p.triangles, software: p.software })
      console.log(`PERF  lugar ${i}: ${fmt(1000 / avg, 1)} FPS · p95 ${fmt(p95, 0)} ms · ${p.calls} llamadas · ${Math.round(p.triangles / 1000)} k triángulos${p.software ? " · SIN GPU" : ""}`)
    }
    report.load = await page.evaluate(() => window.__lab.perf().load)
    await close(ctx)
  })

  if (!ONLY) check("consola sin errores ni avisos", report.console.length === 0, report.console.slice(0, 3).join(" | "))
} finally {
  clearTimeout(watchdog)
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await stopAll()
  const failed = report.checks.filter((c) => !c.ok).length
  console.log(`\n${report.checks.length - failed}/${report.checks.length} comprobaciones · ${report.gpu === false ? "SIN GPU" : report.gpu ? "con GPU" : "GPU desconocida"} · ${OUT}`)
  process.exitCode = failed ? 1 : 0
}
