// A Scope World app: the Entrega 3 lab and the Entrega 4 world are this same
// app with two world definitions (WorldDef) and two grounds. One loop:
//
//   visitor (camera on the route) → perception → mind → body (acts, steps,
//   clips, gaze, light) → things (ball, flower, radiometer, lantern) → render
//
// Everything runs on a simulation clock that can be sped up (×4, to try the
// slow routines) and stepped without rendering (window.__lab.advance), so the
// browser tests are deterministic even on a CPU renderer.

import * as THREE from "three"

import type { P2, WorldDef } from "../world-def.ts"
import { LabScope, type ActorWorld } from "../scope/body/actor.ts"
import { forwardOf } from "../scope/body/locomotor.ts"
import { bandOf } from "../scope/mind/companion.ts"
import { ScopeMind } from "../scope/mind/mind.ts"
import type { ClickEvent, Intent, Look, ObjectId, Perception } from "../scope/mind/types.ts"
import type { Ground } from "../scope/ground.ts"
import { Ball, Flower, Radiometer } from "../scope/props.ts"
import { createStage, probeGL, type Stage, type StageOptions } from "../env/stage.ts"
import { mixMoods, MOODS, routeLight, type Mood } from "../env/moods.ts"
import { renderDebug } from "./debug.ts"
import { VisitorRig } from "./visitor.ts"
import { bl } from "../../prototype/src/world/world-data.ts"

export interface AppOptions {
  def: WorldDef
  /** The floor of this world, once the stage (the 1.0 nav and floor) is loaded. */
  ground: (stage: Stage) => Ground | Promise<Ground>
  stage?: Partial<StageOptions>
  /** Other modes of the page (the lab's step bench): return true if one took over. */
  mode?: (params: URLSearchParams, stage: Stage, ground: Ground) => boolean | Promise<boolean>
}

const params = new URLSearchParams(location.search)
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const DT = 1 / 60

export async function startScopeWorld(opt: AppOptions) {
  const { def } = opt
  const { places } = def
  const refine = def.refine ?? {}
  const LANTERN = places.lantern
  const CABINET = places.cabinet
  const STATIONS = def.stations
  const gl = probeGL()
  if (!gl.ok || params.has("sin3d")) {
    // without WebGL the places are still here, as text (the full reading view is 4D)
    const status = $("status")
    status.innerHTML = `<div class="fallback"><h1>El mundo de Scope</h1><p>Este navegador no puede mostrar el mundo en 3D. Estos son sus lugares:</p><ol>${STATIONS.map((s) => `<li><h2>${s.label}</h2><p>${s.note}</p></li>`).join("")}</ol></div>`
    status.removeAttribute("role")
    status.style.pointerEvents = "auto"
    document.body.classList.add("no-webgl")
    return
  }
  // a page may tell you it is drawn without a GPU (4A does; the class alone changes nothing)
  document.body.classList.toggle("software", gl.software)
  const stage = await createStage($<HTMLCanvasElement>("view"), { software: gl.software, light: params.has("ligero"), ...opt.stage })
  const ground = await opt.ground(stage)
  if (opt.mode && (await opt.mode(params, stage, ground))) return

  const scope = await LabScope.load("/scope/scope.glb", ground, places, def.start, def.gaits)
  scope.loco.restartBelow = refine.restartBelow ?? 0
  const ball = new Ball(ground, places.ball)
  const flower = new Flower(ground.height(places.flower.at), places.flower)
  const radiometer = new Radiometer(ground.height(places.radiometer.at), places.radiometer)
  const radiometerAmbient = () => def.ambientAt(places.radiometer.at, stage.mood)
  const flowerAmbient = () => def.ambientAt(places.flower.at, stage.mood)
  stage.scene.add(scope.group, ball.mesh, flower.group, radiometer.group)

  // pick proxies for the two places that are part of the world mesh
  const pickMat = new THREE.MeshBasicMaterial({ visible: false })
  const lanternPick = new THREE.Mesh(new THREE.CylinderGeometry(LANTERN.outerR, LANTERN.outerR, 0.3, 16), pickMat)
  lanternPick.position.copy(bl(LANTERN.center[0], LANTERN.center[1], 0.15))
  const cabinetPick = new THREE.Mesh(new THREE.BoxGeometry(CABINET.max[0] - CABINET.min[0], 0.08, CABINET.max[1] - CABINET.min[1]), pickMat)
  cabinetPick.position.copy(bl((CABINET.min[0] + CABINET.max[0]) / 2, (CABINET.min[1] + CABINET.max[1]) / 2, 0.04))
  stage.scene.add(lanternPick, cabinetPick)
  // refine.flowerPick: the bud's petals are too thin to hit; an invisible column around it is the flower
  // (made only when asked: every three.js object draws on Math.random for its id, and the lab's seeded runs must not shift)
  const flowerPick = refine.flowerPick ? new THREE.Mesh(new THREE.CylinderGeometry(places.flower.baseR + 0.01, places.flower.baseR + 0.01, 0.12, 16), pickMat) : null
  if (flowerPick) {
    flowerPick.position.copy(bl(places.flower.at[0], places.flower.at[1], ground.height(places.flower.at) + 0.06))
    stage.scene.add(flowerPick)
  }

  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)")
  const reduced = params.has("reduced") || reducedQuery.matches
  const rig = new VisitorRig(def)
  rig.reduced = reduced
  scope.reduced = reduced
  const mind = new ScopeMind(def)
  const lookAt = new THREE.Vector3()

  let now = 0
  // tests pause the real-time loop: only advance() moves the sim, render() draws on demand
  let paused = false
  let timeScale = 1
  let reading = false
  let lookingAtScope = false
  let lastIntent: Intent | null = null
  const clicks: ClickEvent[] = []
  // the light: in a world whose places have their own (Entrega 2), it follows the view along the
  // route ("lugar") and the button can hold any of the four moods; otherwise (the lab) one mood
  const zoned = STATIONS.some((s) => s.mood)
  const LIGHTS = zoned ? ["lugar", ...Object.keys(MOODS)] : ["atardecer", "noche"]
  let moodName = params.get("hora") ?? (zoned ? "lugar" : "atardecer")
  let light: Mood | null = null
  const targetLight = () => (moodName === "lugar" ? routeLight(def, rig.s) : (MOODS[moodName] ?? MOODS.atardecer))
  /** Ease the light toward where you are (τ 0.8 s: a cut with reduced motion still fades). */
  function stepLight(dt: number) {
    const target = targetLight()
    light = light ? mixMoods(light, target, 1 - Math.exp(-dt / 0.8)) : target
    stage.applyMood(light)
  }
  function setLight(name: string) {
    moodName = name
    if (zoned) stepLight(0) // the fade starts from the light you see
    else stage.setMood(name)
  }
  if (!zoned) stage.setMood(moodName)
  rig.portrait = innerHeight > innerWidth * 1.1

  const startStation = Math.min(STATIONS.length - 1, Math.max(0, Number(params.get("lugar") ?? 0)))
  rig.s = rig.sTarget = startStation
  if (zoned) stepLight(0) // the light of the place you start at
  if (startStation !== 0) scope.place(STATIONS[startStation].wait, def.start.heading, ground)

  // --- the world as the mind and the body see it -------------------------------------------
  const objectPoint = (id: ObjectId): THREE.Vector3 => {
    switch (id) {
      case "ball":
        return ball.mesh.position.clone()
      case "flower":
        return flower.target.clone()
      case "radiometer":
        return radiometer.target.clone()
      case "lantern":
        return bl(places.lanternDoor.doorway[0], places.lanternDoor.doorway[1], 0.09)
      case "cabinet":
        return bl(CABINET.look[0], CABINET.look[1], CABINET.look[2])
    }
  }
  const resolve = (look: Look): THREE.Vector3 | null => {
    switch (look.kind) {
      case "none":
        return null
      case "visitor":
        return stage.camera.position.clone()
      case "object":
        return objectPoint(look.id)
      case "point":
        return bl(look.at[0], look.at[1], 0.02)
      case "ahead": {
        const f = forwardOf(scope.heading)
        return bl(scope.at[0] + f[0] * 0.3, scope.at[1] + f[1] * 0.3, 0.05)
      }
    }
  }
  const world = (): ActorWorld => ({
    now,
    ground,
    places,
    ball: { at: [ball.at[0], ball.at[1]], speed: ball.speed },
    flowerBloomed: flower.bloomed,
    radiometerOmega: radiometer.omega,
    resolve,
    objectAt: (id) => (id === "ball" ? [ball.at[0], ball.at[1]] : id === "flower" ? places.flower.at : places.radiometer.at),
    eye: [stage.camera.position.x, -stage.camera.position.z],
    inView: (at) => {
      // from the camera as it is now (acts that ask start once you have stopped at a place)
      ndc.copy(bl(at[0], at[1], ground.height(at) + 0.06)).project(stage.camera)
      return ndc.z < 1 && Math.abs(ndc.x) < 0.85 && Math.abs(ndc.y) < 0.85
    },
    refine,
    cameras: cameras(),
  })
  // the camera of the place you are going to, and the one you look through while it is still
  // (a travelling camera sweeps the floor: keeping clear of it would close every corridor)
  const cameras = (): P2[] => {
    if (!refine.cameraClearance) return []
    const to = STATIONS[Math.round(rig.sTarget)]
    const pose = rig.portrait ? to.portrait : to.camera
    const out: P2[] = [[pose.pos[0], pose.pos[1]]]
    if (Math.abs(rig.sVel) < 0.03) out.push([stage.camera.position.x, -stage.camera.position.z])
    return out
  }

  const ndc = new THREE.Vector3()
  function scopeVisible() {
    scope.headPosition(ndc).project(stage.camera)
    return ndc.z < 1 && Math.abs(ndc.x) < 0.94 && Math.abs(ndc.y) < 0.94
  }

  function perceive(): Perception {
    const eye: P2 = [stage.camera.position.x, -stage.camera.position.z]
    const p: Perception = {
      now,
      scope: { at: scope.at, heading: scope.heading, moving: scope.moving, inRefuge: scope.inRefuge, visible: scopeVisible(), act: scope.report },
      visitor: {
        anchor: rig.anchor,
        eye,
        s: rig.s,
        sVel: rig.sVel,
        target: rig.sTarget,
        zone: rig.zone,
        settled: rig.settled,
        reading,
        lookingAtScope,
        idle: now - rig.lastInputAt,
      },
      objects: {
        ball: { at: [ball.at[0], ball.at[1]], moving: ball.speed > 0.02, salience: Math.min(1, ball.speed / 0.12) },
        flower: { at: places.flower.at, moving: false, salience: flower.salience },
        radiometer: { at: places.radiometer.at, moving: radiometer.omega > 1, salience: radiometer.salience },
        lantern: { at: LANTERN.center, moving: false, salience: 0 },
        cabinet: { at: [(CABINET.min[0] + CABINET.max[0]) / 2, (CABINET.min[1] + CABINET.max[1]) / 2], moving: false, salience: 0 },
      },
      clicks: clicks.splice(0),
      reduced,
    }
    return p
  }

  /** One simulation step. */
  function sim(dt: number) {
    now += dt
    rig.update(dt, now)
    rig.pose(stage.camera, lookAt)
    if (zoned) stepLight(dt)
    // paused (tests stepping without drawing): the view he is seen through must be this step's
    if (paused) stage.camera.updateMatrixWorld()
    const p = perceive()
    const intent = mind.tick(p)
    lastIntent = intent
    const w = world()
    // reduced motion: when the camera cuts, Scope is already where he would go
    if (rig.takeCut() && intent.act.kind === "go") scope.place(intent.act.goal, scope.heading, ground)
    scope.execute(intent.act, w)
    scope.update(dt, w, intent)
    ball.step(dt, now, scope.collider())
    const light = scope.lightState()
    radiometer.step(dt, light, radiometerAmbient())
    flower.step(dt, light, flowerAmbient())
    const inside = Math.max(0, 1 - Math.hypot(scope.at[0] - LANTERN.center[0], scope.at[1] - LANTERN.center[1]) / LANTERN.wallR)
    stage.setLanternGlow(scope.glow * inside)
  }

  // --- input ----------------------------------------------------------------------------------
  const canvas = stage.renderer.domElement
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const pickables: [THREE.Object3D, ClickEvent["target"]][] = [
    [scope.proxy, { kind: "scope" }],
    [ball.mesh, { kind: "object", id: "ball" }],
    [flowerPick ?? flower.group, { kind: "object", id: "flower" }],
    [radiometer.group, { kind: "object", id: "radiometer" }],
    [lanternPick, { kind: "object", id: "lantern" }],
    [cabinetPick, { kind: "object", id: "cabinet" }],
  ]
  function pick(x: number, y: number): ClickEvent["target"] | null {
    const r = canvas.getBoundingClientRect()
    pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(pointer, stage.camera)
    let best: { d: number; t: ClickEvent["target"] } | null = null
    for (const [o, t] of pickables) {
      const hit = raycaster.intersectObject(o, true)[0]
      if (hit && (!best || hit.distance < best.d)) best = { d: hit.distance, t }
    }
    if (best) return best.t
    // the ground (z = 0 plane)
    const ray = raycaster.ray
    if (ray.direction.y < -1e-4) {
      const k = -ray.origin.y / ray.direction.y
      const hit = ray.origin.clone().addScaledVector(ray.direction, k)
      return { kind: "ground", at: [hit.x, -hit.z] }
    }
    return null
  }
  const clickAt = (target: ClickEvent["target"]) => {
    rig.touch()
    clicks.push({ t: now, target })
  }

  let down: { x: number; y: number; id: number; moved: boolean } | null = null
  canvas.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "touch") {
      const t = pick(e.clientX, e.clientY)
      lookingAtScope = t?.kind === "scope"
      canvas.style.cursor = t && t.kind === "object" ? "pointer" : "default"
    }
    if (down && down.id === e.pointerId) {
      const dx = e.clientX - down.x
      if (Math.abs(dx) > 8) down.moved = true
      if (down.moved) {
        rig.drag(dx / innerWidth)
        down.x = e.clientX
      }
    }
  })
  canvas.addEventListener("pointerup", (e) => {
    if (down && !down.moved) {
      const t = pick(e.clientX, e.clientY)
      if (t) clickAt(t)
    }
    down = null
  })
  canvas.addEventListener("pointerleave", () => (lookingAtScope = false))
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault()
    rig.wheel(e.deltaY)
  }, { passive: false })
  addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return
    if (e.key === "ArrowRight") rig.step(1)
    else if (e.key === "ArrowLeft") rig.step(-1)
    else if (e.key === "Home") rig.goTo(0)
    else if (e.key === "End") rig.goTo(STATIONS.length - 1)
    else if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey) toggleDebug()
    else if (e.key.toLowerCase() === "l") toggleReading()
    else return
    e.preventDefault()
  })

  // --- HUD ------------------------------------------------------------------------------------
  // the phone keeps the world in view: intro and options start folded
  if (innerWidth < 640) for (const d of document.querySelectorAll("details.intro, details.options")) d.removeAttribute("open")
  $("places").innerHTML = STATIONS.map((s, i) => `<button type="button" data-place="${i}">${s.label}</button>`).join("")
  $("places").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-place]")
    if (b) rig.goTo(Number(b.dataset.place))
  })
  const readBtn = $<HTMLButtonElement>("read")
  function toggleReading(on = !reading) {
    reading = on
    rig.touch()
    readBtn.setAttribute("aria-pressed", String(on))
    $("note").hidden = !on
    $("note-text").textContent = STATIONS[rig.zone].note
  }
  readBtn.addEventListener("click", () => toggleReading())
  $("note-close").addEventListener("click", () => toggleReading(false))
  const moodBtn = $<HTMLButtonElement>("mood")
  const setMoodLabel = () => (moodBtn.textContent = `Luz: ${moodName === "lugar" ? "la del lugar" : MOODS[moodName].label}`)
  setMoodLabel()
  moodBtn.addEventListener("click", () => {
    setLight(LIGHTS[(LIGHTS.indexOf(moodName) + 1) % LIGHTS.length])
    setMoodLabel()
  })
  const speedBtn = $<HTMLButtonElement>("speed")
  speedBtn.addEventListener("click", () => {
    timeScale = timeScale === 1 ? 4 : 1
    speedBtn.textContent = `Tiempo ×${timeScale}`
    speedBtn.setAttribute("aria-pressed", String(timeScale !== 1))
  })
  const debugEl = $("debug")
  function toggleDebug(on = debugEl.hidden) {
    debugEl.hidden = !on
    $<HTMLButtonElement>("debug-toggle").setAttribute("aria-pressed", String(on))
  }
  $("debug-toggle").addEventListener("click", () => toggleDebug())
  if (params.has("debug")) toggleDebug(true)
  $("reset").addEventListener("click", () => location.reload())

  addEventListener("resize", () => {
    stage.resize()
    rig.portrait = innerHeight > innerWidth * 1.1
  })

  // --- loop -------------------------------------------------------------------------------------
  const frames: number[] = []
  let last = performance.now()
  let hudAt = 0
  let lastState = ""
  let acc = 0
  const live = $("live")
  function render() {
    stage.frame(lookAt)
    stage.renderer.render(stage.scene, stage.camera)
  }
  function hud(t: number) {
    for (const b of document.querySelectorAll<HTMLButtonElement>("[data-place]")) {
      if (Number(b.dataset.place) === rig.zone) {
        if (b.getAttribute("aria-current") !== "true") b.scrollIntoView({ block: "nearest", inline: "nearest" }) // the phone's scrolling ribbon
        b.setAttribute("aria-current", "true")
      } else b.removeAttribute("aria-current")
    }
    if (reading) $("note-text").textContent = STATIONS[rig.zone].note
    if (!lastIntent) return
    if (lastIntent.state !== lastState) {
      lastState = lastIntent.state
      live.textContent = `Scope: ${lastIntent.state}`
    }
    if (debugEl.hidden || t - hudAt < 250) return
    hudAt = t
    const d = Math.hypot(scope.at[0] - rig.anchor[0], scope.at[1] - rig.anchor[1])
    debugEl.innerHTML = renderDebug({
      intent: lastIntent,
      mind,
      scope,
      rig,
      distance: d,
      def,
      band: bandOf(def, d, Math.hypot(scope.at[0] - stage.camera.position.x, scope.at[1] + stage.camera.position.z)),
      visible: scopeVisible(),
      reading,
      idle: now - rig.lastInputAt,
      ball,
      flower,
      radiometer,
      frames,
      calls: stage.renderer.info.render.calls,
      triangles: stage.renderer.info.render.triangles,
      software: gl.software,
      timeScale,
      reduced,
    })
  }
  stage.renderer.setAnimationLoop(() => {
    if (paused) return
    const t = performance.now()
    const real = Math.min(0.1, (t - last) / 1000)
    frames.push(t - last)
    if (frames.length > 120) frames.shift()
    last = t
    // fixed steps on the sim clock: the same behaviour at any frame rate
    acc += real * timeScale
    let n = 0
    while (acc >= DT && n < 12) {
      sim(DT)
      acc -= DT
      n++
    }
    if (n === 12) acc = 0
    render()
    hud(t)
  })
  document.body.classList.remove("loading")

  // --- test hooks (tools/verify.mjs) -------------------------------------------------------------
  Object.assign(window, {
    __lab: {
      /** Run the sim; `render: false` skips the frame (the tests sample many steps without drawing). */
      advance(seconds: number, opt: { render?: boolean } = {}) {
        for (let k = 0; k < Math.round(seconds / DT); k++) sim(DT)
        if (opt.render !== false) render()
        return this.state()
      },
      /** Stop (or restart) the real-time loop, so nothing but advance() moves the sim. */
      pause(on = true) {
        paused = on
        last = performance.now()
        acc = 0
      },
      render,
      state() {
        const i = lastIntent
        return {
          now,
          state: i?.state,
          group: i?.group,
          reason: i?.reason,
          act: scope.report,
          actKind: i?.act.kind,
          gaze: i?.gaze,
          scope: { at: scope.at, heading: scope.heading, moving: scope.moving, inRefuge: scope.inRefuge, glow: scope.glow, y: scope.group.position.y, speed: scope.loco.state.speed },
          visitor: { s: rig.s, sVel: rig.sVel, zone: rig.zone, settled: rig.settled, anchor: rig.anchor },
          distance: Math.hypot(scope.at[0] - rig.anchor[0], scope.at[1] - rig.anchor[1]),
          visible: scopeVisible(),
          ball: { at: [...ball.at], speed: ball.speed, lastHit: ball.lastHit },
          flower: { charge: flower.charge, bloomed: flower.bloomed, openness: flower.openness, irradiance: flower.irradiance },
          radiometer: { omega: radiometer.omega, light: { ...radiometer.light } },
          gait: { ...scope.gait.readout, range: { ...scope.gait.readout.range } },
          clips: scope.animator.active().map((c) => c.clip),
          memory: { clips: [...mind.memory.clips], clicks: mind.memory.clicks.length, zones: mind.memory.zones.map((z) => ({ ...z })) },
          log: mind.memory.log.slice(-10),
          timeIn: Object.fromEntries(mind.timeIn),
          light: { mode: moodName, label: stage.mood.label, lamp: stage.mood.lamp, sunEl: stage.mood.sun.el, sunAz: stage.mood.sun.az, exposure: stage.mood.exposure, hemi: stage.mood.hemi, lantern: stage.mood.lantern },
        }
      },
      scope,
      /** The floor as Scope plans on it (tests). */
      path: (a: P2, b: P2) => ground.path(a, b, null),
      free: (p: P2) => ground.isFree(p),
      camera: () => ({ pos: [stage.camera.position.x, -stage.camera.position.z, stage.camera.position.y], fov: stage.camera.fov, aspect: stage.camera.aspect, portrait: rig.portrait }),
      /** The light as the mechanisms receive it (position, direction, level). */
      light() {
        const l = scope.lightState()
        const f = forwardOf(scope.heading)
        return { pos: [l.pos.x, -l.pos.z, l.pos.y], dir: [l.dir.x, -l.dir.z, l.dir.y], level: l.level, forward: f }
      },
      /** Where Scope's head (or a thing) is on the screen, in CSS pixels (tests click there with the real pointer). */
      screenOf(what: "scope" | ObjectId) {
        const p = what === "scope" ? scope.headPosition(new THREE.Vector3()) : objectPoint(what)
        stage.camera.updateMatrixWorld()
        p.project(stage.camera)
        const r = canvas.getBoundingClientRect()
        return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, inFront: p.z < 1 }
      },
      goTo: (i: number) => rig.goTo(i),
      step: (d: number) => rig.step(d),
      wheel: (d: number) => rig.wheel(d),
      read: (on: boolean) => toggleReading(on),
      click(kind: "scope" | ObjectId | "ground", at?: P2) {
        if (kind === "scope") clickAt({ kind: "scope" })
        else if (kind === "ground") clickAt({ kind: "ground", at: at ?? [scope.at[0] + 0.15, scope.at[1]] })
        else clickAt({ kind: "object", id: kind })
      },
      look: (on: boolean) => (lookingAtScope = on),
      mood: (m: string) => {
        setLight(m)
        setMoodLabel()
      },
      perf: () => ({ calls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles, frames: [...frames], software: gl.software, renderer: gl.renderer, load: stage.stats }),
      /**
       * The shell's lowest point above the plane he stands on (his root), in mm: the
       * body layers must never push it through. (The floor itself can step under a
       * single foot — the sheet is 1.2 mm thick — and there is no per-foot IK.)
       */
      lowestShellMm() {
        let min = Infinity
        const v = new THREE.Vector3()
        scope.model.root.updateMatrixWorld(true)
        scope.model.root.traverse((o) => {
          if (!(o instanceof THREE.SkinnedMesh) || !/Shell/.test(o.name)) return
          const pos = o.geometry.attributes.position
          for (let k = 0; k < pos.count; k += 7) {
            o.getVertexPosition(k, v)
            v.applyMatrix4(o.matrixWorld)
            min = Math.min(min, v.y - scope.group.position.y)
          }
        })
        return min * 1000
      },
    },
  })
}

/** Start a world page; on failure, say so in the page. */
export function boot(opt: AppOptions) {
  startScopeWorld(opt).catch((err) => {
    console.error(err)
    $("status").textContent = "No se ha podido cargar el mundo de Scope."
  })
}
