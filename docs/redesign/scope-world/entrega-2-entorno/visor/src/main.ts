// Scope World 2.0 · Entrega 2: a navigable study of the environment (not the experience).
// The scene (the approved 1.0 world, the paper relief to the horizon, the sky, the haze and
// the four moods of light) is built by the shared stage, core/env/stage.ts — the same one
// the Entrega 3 lab and the Entrega 4 world use. What is the viewer's own: the orbit
// camera, the five shots of the renders and the measured HUD.

import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

import { createStage, MOODS, probeGL } from "../../../core/env/stage.ts"
import { ScopeActor } from "../../../prototype/src/scope/scope-actor.ts"
import { bl } from "../../../prototype/src/world/world-data.ts"

type V3 = [number, number, number]
const params = new URLSearchParams(location.search)
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// --- cameras: the Blender shots (position, target, lens), Blender coordinates -------------
const SHOTS: Record<string, { label: string; pos: V3; target: V3; lens: number; mood: string }> = {
  general: { label: "Vista general", pos: [-1.7, -1.75, 0.85], target: [0, 0.35, 0.15], lens: 24, mood: "amanecer" },
  horizonte: { label: "La atalaya", pos: [0.27, 0.47, 0.1], target: [0.68, 1.75, 0.13], lens: 26, mood: "amanecer" },
  margen: { label: "El margen", pos: [-0.84, -0.69, 0.1], target: [-0.66, -0.2, 0.09], lens: 24, mood: "amanecer" },
  escala: { label: "A la altura de Scope", pos: [-1.05, -1.25, 0.16], target: [0.6, 1.8, 0.32], lens: 22, mood: "amanecer" },
  linterna: { label: "La linterna", pos: [-0.56, -0.86, 0.13], target: [-1.13, -0.44, 0.13], lens: 36, mood: "noche" },
}
const blp = (p: V3) => bl(p[0], p[1], p[2])

async function start() {
  const gl = probeGL()
  if (!gl.ok) {
    $("status").textContent = "Este navegador no puede mostrar WebGL. Las imágenes del estudio están en la carpeta renders."
    return
  }
  const canvas = $<HTMLCanvasElement>("view")
  const t0 = performance.now()
  // the study shows the 2.0 environment as approved, its radiometer included
  const stage = await createStage(canvas, { software: gl.software, light: false, envUrl: "/assets/entorno.glb", withoutRadiometer: false, shadowExtent: 4, lanternRange: 2.5 })
  const { renderer, scene, camera, floor, nav } = stage
  const actor = await ScopeActor.load("/scope/scope.glb", floor, nav)
  const loadMs = performance.now() - t0
  scene.add(actor.group)
  actor.place([-0.52, -0.34], THREE.MathUtils.degToRad(200))

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !reduced
  controls.minDistance = 0.12
  controls.maxDistance = 30
  controls.maxPolarAngle = THREE.MathUtils.degToRad(89)
  controls.screenSpacePanning = false

  function setMood(name: string) {
    stage.setMood(name)
    stage.setLanternGlow(0)
    for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mood]")) b.setAttribute("aria-pressed", String(b.dataset.mood === name))
  }

  let fly: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; fovFrom: number; fovTo: number; t0: number } | null = null
  const fovFor = (lens: number) => THREE.MathUtils.radToDeg(2 * Math.atan(36 / camera.aspect / 2 / lens))
  function goShot(name: string, instant = false) {
    const s = SHOTS[name]
    const to = blp(s.pos)
    const tTo = blp(s.target)
    if (instant || reduced) {
      camera.position.copy(to)
      controls.target.copy(tTo)
      camera.fov = fovFor(s.lens)
      camera.updateProjectionMatrix()
    } else {
      fly = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo, fovFrom: camera.fov, fovTo: fovFor(s.lens), t0: performance.now() }
    }
    if (s.mood !== stage.moodName) setMood(s.mood)
    for (const b of document.querySelectorAll<HTMLButtonElement>("[data-shot]")) b.setAttribute("aria-pressed", String(b.dataset.shot === name))
  }

  $("shots").innerHTML = Object.entries(SHOTS).map(([k, s]) => `<button type="button" data-shot="${k}" aria-pressed="false">${s.label}</button>`).join("")
  $("moods").innerHTML = Object.entries(MOODS).map(([k, m]) => `<button type="button" data-mood="${k}" aria-pressed="false">${m.label}</button>`).join("")
  $("shots").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-shot]")
    if (b) goShot(b.dataset.shot!)
  })
  $("moods").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-mood]")
    if (b) setMood(b.dataset.mood!)
  })
  addEventListener("resize", () => stage.resize())

  setMood(params.get("hora") ?? "amanecer")
  goShot(params.get("camara") ?? "general", true)
  document.body.classList.remove("loading")

  const frames: number[] = []
  let last = performance.now()
  let hudAt = 0
  const stats = { ...stage.stats, loadMs: Math.round(loadMs) }
  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    frames.push(now - last)
    if (frames.length > 120) frames.shift()
    last = now
    if (fly) {
      const t = Math.min(1, (now - fly.t0) / 1400)
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      camera.position.lerpVectors(fly.from, fly.to, e)
      controls.target.lerpVectors(fly.tFrom, fly.tTo, e)
      camera.fov = THREE.MathUtils.lerp(fly.fovFrom, fly.fovTo, e)
      camera.updateProjectionMatrix()
      if (t >= 1) fly = null
    }
    controls.update()
    const ground = floor.at(camera.position.x, camera.position.z)
    if (camera.position.y < ground + 0.03) camera.position.y = ground + 0.03
    stage.frame(controls.target)
    actor.update(dt)
    renderer.render(scene, camera)
    if (now - hudAt > 500) {
      hudAt = now
      const avg = frames.reduce((a, b) => a + b, 0) / frames.length
      const sorted = [...frames].sort((a, b) => a - b)
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
      $("perf").textContent =
        `${(1000 / avg).toFixed(0)} FPS · p95 ${p95.toFixed(1)} ms · ${renderer.info.render.calls} llamadas · ${(renderer.info.render.triangles / 1000).toFixed(0)} k triángulos` +
        ` · entorno ${(stats.envBytes / 1024).toFixed(0)} KB · mundo ${(stats.worldBytes / 1024).toFixed(0)} KB · carga ${stats.loadMs} ms` +
        (gl.software ? " · SIN GPU: escala 0,5, las cifras no son representativas" : "")
    }
  })
  Object.assign(window, { __visor: { scene, gl3: renderer, stats, goShot, setMood, perf: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frames: [...frames] }), software: gl.software, renderer: gl.renderer } })
}

start().catch((err) => {
  console.error(err)
  $("status").textContent = "No se ha podido cargar el estudio de entorno."
})
