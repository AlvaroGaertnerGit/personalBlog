// The optional debug panel (D): what Scope does, why, and what he remembers.

import type { WorldDef } from "../world-def.ts"
import { PRIORITY, type Intent } from "../scope/mind/types.ts"
import type { Band } from "../scope/mind/companion.ts"
import type { LabScope } from "../scope/body/actor.ts"
import type { ScopeMind } from "../scope/mind/mind.ts"
import type { Ball, Flower, Radiometer } from "../scope/props.ts"
import type { VisitorRig } from "./visitor.ts"

export interface DebugInput {
  def: WorldDef
  intent: Intent
  mind: ScopeMind
  scope: LabScope
  rig: VisitorRig
  distance: number
  band: Band
  visible: boolean
  reading: boolean
  idle: number
  ball: Ball
  flower: Flower
  radiometer: Radiometer
  frames: number[]
  calls: number
  triangles: number
  software: boolean
  timeScale: number
  reduced: boolean
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
const n = (v: number, d = 2) => v.toFixed(d).replace(".", ",")
const row = (k: string, v: string) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`

function look(i: Intent) {
  const g = i.gaze
  if (g.kind === "object") return g.id
  if (g.kind === "point") return `punto ${n(g.at[0])}, ${n(g.at[1])}`
  return { none: "nada", visitor: "a ti", ahead: "el camino" }[g.kind]
}

export function renderDebug(d: DebugInput) {
  const { intent: i, mind, scope, rig } = d
  const avg = d.frames.reduce((a, b) => a + b, 0) / Math.max(1, d.frames.length)
  const p95 = [...d.frames].sort((a, b) => a - b)[Math.floor(d.frames.length * 0.95)] ?? 0
  const g = scope.gait.readout
  const zones = mind.memory.zones
    .map((z, k) => `${d.def.stations[k].label}: ${z.visits} visita${z.visits === 1 ? "" : "s"}${z.guided ? " · guiado" : ""}${Number.isFinite(z.showcasedAt) ? " · enseñado" : ""}${z.lastThing ? ` · recuerda ${z.lastThing.what}` : ""}`)
    .join("<br>")
  const log = mind.memory.log
    .slice(-9)
    .reverse()
    .map((l) => `<li><time>${n(l.t, 1)} s</time> ${esc(l.text)}</li>`)
    .join("")
  return `
    <h2>${esc(i.state)} <small>${i.group} · prioridad ${PRIORITY[i.group]}</small></h2>
    <p class="why">${esc(i.reason)}</p>
    ${row("acto", `${i.act.kind} · ${esc(scope.report.phase)}${scope.report.interruptible ? "" : " · no interrumpible"}`)}
    ${row("mirada", `${look(i)} <small>(${esc(mind.gazeWhy)})</small>`)}
    ${row("distancia", `${n(d.distance)} m · ${d.band}${d.visible ? "" : " · fuera de cuadro"}${scope.inRefuge ? " · en su refugio" : ""}`)}
    ${row("paso", `${g.mode} · ${n(scope.loco.state.speed * 100, 1)} cm/s · squash ${n(g.squash, 3)} · inclinación ${n(g.leanDeg, 1)}°`)}
    ${row("luz", `${n(scope.glow)} · radiómetro ${n(d.radiometer.omega, 1)} rad/s · flor ${n(d.flower.charge)}${d.flower.bloomed ? " (abierta)" : ""}`)}
    ${row("bola", `${n(d.ball.speed * 100, 1)} cm/s`)}
    ${row("tú", `lugar ${rig.zone} · s ${n(rig.s)} · ${n(rig.sVel)} /s${rig.settled ? " · parado" : ""}${d.reading ? " · leyendo" : ""} · inactivo ${n(d.idle, 0)} s`)}
    ${row("clips", mind.memory.clips.join(" → ") || "—")}
    ${row("toques", `${mind.memory.clicksWithin(mind.memory.clicks[mind.memory.clicks.length - 1] ?? -99, d.def.timing.clickWindow)} en 8 s`)}
    <details open><summary>Memoria</summary><p>${zones}</p></details>
    <details open><summary>Decisiones</summary><ol>${log}</ol></details>
    <p class="perf">${n(1000 / avg, 0)} FPS · p95 ${n(p95, 1)} ms · ${d.calls} llamadas · ${n(d.triangles / 1000, 0)} k triángulos · tiempo ×${d.timeScale}${d.reduced ? " · movimiento reducido" : ""}${d.software ? " · SIN GPU: las cifras no son representativas" : ""}</p>
    <p class="perf">rango del paso: squash ${n(g.range.squashMin, 3)}–${n(g.range.squashMax, 3)} · elevación máx. ${n(g.range.liftMaxMm, 1)} mm · inclinación máx. ${n(g.range.leanMaxDeg, 1)}°</p>`
}
