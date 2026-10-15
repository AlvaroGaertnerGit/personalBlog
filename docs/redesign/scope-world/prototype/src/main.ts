// Scope World — interactive prototype (not production). Wires the world, the
// camera, Scope and the HTML layer together; each part lives in its own file.
//
//   ?debug      state machine / performance panel (also the D key)
//   ?fallback   force the no-WebGL experience (the 3D runs whenever WebGL exists,
//               software renderers included: they get a lower render scale)
//   ?reduced    behave as prefers-reduced-motion
//   ?skipintro  no loader choreography (tests)
//   ?tier=high|medium   override the quality tier
//   ?maxdt=0.25 let the simulation catch up on very slow frames (software-rendered tests)

import * as THREE from "three"

import { CameraRig, type CameraPose } from "./camera/camera-rig.ts"
import { MATHVIEW_FOCUS, POIS, SCOPE_HOME, STATION_SPOTS, STATIONS } from "./config.ts"
import { ScopeMind, type GazeTarget, type Intent, type MindState } from "./scope/mind.ts"
import { ScopeActor } from "./scope/scope-actor.ts"
import { project } from "./ui/content.ts"
import { Hotspots } from "./ui/hotspots.ts"
import { Loader } from "./ui/loader.ts"
import { Note } from "./ui/note.ts"
import { ProjectPanel, type ScreenRect } from "./ui/project-panel.ts"
import { renderReading } from "./ui/reading.ts"
import { addEnvironment, createPost } from "./world/post.ts"
import { PliegoWorld, type Tier } from "./world/world.ts"
import { blv, loadWorldData } from "./world/world-data.ts"

const params = new URLSearchParams(location.search)
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches || params.has("reduced")
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches
const MAX_DT = Math.min(0.5, Number(params.get("maxdt")) || 0.05)
// without a GPU the world is drawn at a fraction of the screen's resolution and scaled up
const SOFTWARE_SCALE = 0.6
const SOFTWARE_MIN_SCALE = 0.45
const ASSETS = "/assets"
const SCOPE_GLB = "/scope/scope.glb"

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const live = $("live")
const announce = (text: string) => {
  live.textContent = ""
  window.setTimeout(() => (live.textContent = text), 30)
}

// --- capability ---------------------------------------------------------------------------
function probeGL() {
  try {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2")
    if (!gl) return { ok: false, software: false, renderer: "none" }
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return { ok: true, software: /swiftshader|llvmpipe|software|basic render/i.test(renderer), renderer }
  } catch {
    return { ok: false, software: false, renderer: "error" }
  }
}

function pickTier(software: boolean): Tier & { dpr: number } {
  const forced = params.get("tier")
  if (forced === "high") return { name: "high", shadowMap: 2048, lampShadow: true, dpr: Math.min(devicePixelRatio, 2) }
  if (forced === "medium") return { name: "medium", shadowMap: 1024, lampShadow: false, dpr: Math.min(devicePixelRatio, 1.5) }
  const small = Math.min(innerWidth, innerHeight) < 600
  if (software) return { name: "low", shadowMap: 1024, lampShadow: false, dpr: SOFTWARE_SCALE }
  if (!finePointer || small) return { name: "medium", shadowMap: 1024, lampShadow: false, dpr: Math.min(devicePixelRatio, 1.5) }
  const strong = (navigator.hardwareConcurrency ?? 4) >= 8
  return strong
    ? { name: "high", shadowMap: 2048, lampShadow: true, dpr: Math.min(devicePixelRatio, 2) }
    : { name: "medium", shadowMap: 2048, lampShadow: true, dpr: Math.min(devicePixelRatio, 1.5) }
}

// --- reading view / fallback --------------------------------------------------------------
const reading = $("reading")
function showReading(mode: "fallback" | "choice", why = "") {
  renderReading($("reading-content"), mode, why)
  reading.hidden = false
  document.body.classList.toggle("fallback", mode === "fallback")
  reading.focus({ preventScroll: true })
  reading.querySelector('[data-action="world"]')?.addEventListener("click", hideReading)
}
function hideReading() {
  reading.hidden = true
  document.body.classList.remove("fallback")
  ;(document.querySelector('.route button[aria-current="step"]') as HTMLElement | null)?.focus()
}

async function startFallback(why: string) {
  document.body.classList.remove("is-loading")
  const loader = new Loader(true)
  await loader.exit()
  showReading("fallback", why)
  for (const b of document.querySelectorAll('[data-action="reading"]')) b.addEventListener("click", (e) => e.preventDefault())
}

// --- the world ----------------------------------------------------------------------------
async function start3D(gl: ReturnType<typeof probeGL>) {
  const tier = pickTier(gl.software)
  const loader = new Loader(reducedMotion || params.has("skipintro"))
  const canvas = $<HTMLCanvasElement>("world")
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.name !== "low", powerPreference: "high-performance" })
  let dpr = tier.dpr
  renderer.setPixelRatio(dpr)
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.toneMappingExposure = 0.9
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x070b16)
  scene.fog = new THREE.Fog(0x070b16, 2.2, 6.5)
  addEnvironment(renderer, scene)
  const rig = new CameraRig(STATIONS, innerWidth / innerHeight)
  const post = createPost(renderer, scene, rig.camera, tier.name !== "low")
  rig.setReducedMotion(reducedMotion)
  rig.resize(innerWidth, innerHeight)

  const t0 = performance.now()
  const { data, floor, nav } = await loadWorldData(ASSETS)
  const [world, actor] = await Promise.all([
    PliegoWorld.load(`${ASSETS}/world.glb`, data, floor, tier),
    ScopeActor.load(SCOPE_GLB, floor, nav),
  ])
  // every authored spot must be standable: report the ones the walkable map moves
  const spotReport = [...POIS.map((p) => [p.id, p.spot] as const), ...STATION_SPOTS.map((s, i) => [`station${i}`, s] as const)]
    .map(([id, s]) => ({ id, moved: nav.nearestFree(s)?.moved ?? Infinity }))
    .filter((r) => r.moved > 0.012)
  if (spotReport.length) console.warn("[scope-world] spots moved onto walkable floor:", spotReport)
  const loadMs = performance.now() - t0
  scene.add(world.root, actor.group)
  actor.reducedMotion = reducedMotion
  world.setLamp(0, scene)

  // Scope at home, facing the home camera (Entrega 1 `home`)
  const homeCam = STATIONS[0].pos
  const homeYaw = Math.atan2(homeCam[0] - SCOPE_HOME.spot[0], -(homeCam[1] - SCOPE_HOME.spot[1]))
  actor.place(SCOPE_HOME.spot, homeYaw)

  const mind = new ScopeMind({}, performance.now())
  actor.onArrive = () => mind.arrived(performance.now())
  actor.onGesture = (clip) => mind.gestureStarted(clip, performance.now())

  // --- picking ---
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2(0, 0)
  const scopeSphere = new THREE.Sphere(new THREE.Vector3(), 0.075)
  const pointerHit = new THREE.Vector3()
  const poiOfMesh = (name: string): string | null => {
    if (/^Q_q-next/.test(name)) return "q-next"
    if (/^Book_q-context/.test(name)) return "q-context"
    if (/^Book_q-agents/.test(name)) return "q-agents"
    if (/^Bench_q-local/.test(name)) return "q-local"
    if (/^Q_q-ux/.test(name)) return "q-ux"
    if (/^(MathView|Card_MathView|Axis_|Tick_)/.test(name)) return "mathview"
    return null
  }
  function pick(): string | null {
    raycaster.setFromCamera(ndc, rig.camera)
    actor.headPosition(scopeSphere.center)
    const toScope = raycaster.ray.intersectSphere(scopeSphere, new THREE.Vector3())
    const hits = raycaster.intersectObjects(world.pickables, false)
    const first = hits[0]
    if (first) pointerHit.copy(first.point)
    else raycaster.ray.at(1.2, pointerHit)
    if (toScope && (!first || toScope.distanceTo(rig.camera.position) < first.distance + 0.02)) return "scope"
    return first ? poiOfMesh(first.object.name) : null
  }

  // --- UI ---
  const hotspots = new Hotspots({
    activate: (id, el) => activate(id, el),
    focus: (id) => (focusedPoi = id),
  })
  const scopeHotspot = hotspots.addScope(
    () => greetScope(),
    (on) => (focusedScope = on),
  )
  const note = new Note()
  const panel = new ProjectPanel()
  panel.onClose = () => closeProject()
  let focusedPoi: string | null = null
  let focusedScope = false

  const routeList = $("route-list")
  routeList.innerHTML = STATIONS.map(
    (s, i) => `<li><button type="button" data-station="${i}"><i aria-hidden="true"></i>${s.label}</button></li>`,
  ).join("")
  routeList.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-station]")
    if (b) goStation(Number(b.dataset.station))
  })
  function markRoute(i: number) {
    for (const b of routeList.querySelectorAll<HTMLButtonElement>("button")) {
      if (Number(b.dataset.station) === i) b.setAttribute("aria-current", "step")
      else b.removeAttribute("aria-current")
    }
    $("crumb-place").textContent = STATIONS[i].label + (panel.openId ? ` › ${project(panel.openId)?.title}` : "")
  }
  markRoute(0)

  function cutIfReduced(fn: () => void) {
    if (!reducedMotion) return fn()
    const veil = $("veil")
    veil.classList.add("on")
    window.setTimeout(() => {
      fn()
      window.setTimeout(() => veil.classList.remove("on"), 60)
    }, 230)
  }
  function goStation(i: number) {
    if (panel.openId) return
    note.close()
    cutIfReduced(() => rig.goTo(i, performance.now()))
    hideHint()
  }
  rig.onArrive = (i) => {
    markRoute(i)
    const here = POIS.filter((p) => p.interactive && p.station === i).map((p) => p.label)
    announce(`${STATIONS[i].label}.${here.length ? ` Aquí: ${here.join(", ")}.` : ""}`)
  }

  function greetScope() {
    if (mind.clickScope(performance.now())) announce("Scope se estira y se ríe.")
  }

  function activate(id: string, el?: HTMLElement) {
    if (id === "scope") return greetScope()
    const poi = POIS.find((p) => p.id === id)
    if (!poi) return
    if (poi.kind === "project" && poi.contentId) return openProject(poi.contentId)
    const anchor = el ?? hotspots.element(id)
    if (anchor && note.open(id, poi.contentId, anchor)) {
      if (mind.visit(id)) announce("Scope se acerca a leerlo contigo.")
    }
  }

  // --- projects ---
  let contoursGoal = 0
  let revealStart = -1
  let cardGoal = 0
  function cardRect(): ScreenRect | null {
    const { center, size } = world.cardCorners()
    const corners: THREE.Vector3[] = []
    for (const dx of [-0.5, 0.5]) for (const dy of [-0.5, 0.5]) for (const dz of [-0.5, 0.5])
      corners.push(new THREE.Vector3(center.x + dx * size.x, center.y + dy * size.y, center.z + dz * size.z).project(rig.camera))
    const xs = corners.map((c) => (c.x * 0.5 + 0.5) * innerWidth)
    const ys = corners.map((c) => (-c.y * 0.5 + 0.5) * innerHeight)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, w: Math.max(8, Math.max(...xs) - x), h: Math.max(8, Math.max(...ys) - y) }
  }
  function focusPose(): CameraPose {
    const narrow = innerWidth < 720
    const panelRight = Math.min(560, innerWidth - 32) + Math.min(56, innerWidth * 0.035) + 16
    return {
      pos: blv(MATHVIEW_FOCUS.pos),
      target: blv(MATHVIEW_FOCUS.target),
      lens: narrow ? MATHVIEW_FOCUS.lens * 0.75 : MATHVIEW_FOCUS.lens,
      shift: narrow ? { x: 0, y: -0.26 } : { x: (panelRight + innerWidth) / 2 / innerWidth - 0.5, y: 0 },
    }
  }
  let projectOpener: HTMLElement | null = null
  async function openProject(id: string, fromHistory = false) {
    if (panel.openId) return
    // remember who opened it now: its hotspot hides (and blurs) while the camera flies in
    const active = document.activeElement
    projectOpener = active instanceof HTMLElement && active !== document.body ? active : null
    note.close()
    hideHint()
    if (!fromHistory) history.pushState({ project: id }, "", `#${id}`)
    rig.goTo(3, performance.now())
    rig.focus(focusPose())
    contoursGoal = 1
    cardGoal = 1
    revealStart = performance.now()
    const c = world.cardCorners().center
    world.uniforms.uRevealOrigin.value.copy(c)
    announce(`${project(id)?.title}: se encienden sus curvas de nivel.`)
    await wait(reducedMotion ? 0 : 900)
    const opening = panel.open(id, cardRect(), reducedMotion)
    markRoute(3)
    await opening
  }
  async function closeProject(fromHistory = false) {
    if (!panel.openId) return
    if (!fromHistory && history.state?.project) {
      history.back() // popstate closes it (one path for the button, Esc and Back)
      return
    }
    await panel.close(cardRect(), reducedMotion)
    rig.focus(null)
    contoursGoal = 0.12 // the tile stays a little warm: you were here
    cardGoal = 0
    markRoute(3)
    announce("De vuelta a la luz. Scope sigue junto a MathView.")
    // the hotspot it came from reappears once the camera is back: focus returns there
    const target = projectOpener && document.contains(projectOpener) ? projectOpener : hotspots.element("mathview")
    for (let i = 0; i < 40 && rig.focusAmount > 0.05; i++) await wait(50)
    await wait(80)
    target?.focus({ preventScroll: true })
  }
  addEventListener("popstate", () => {
    const id = (history.state as { project?: string } | null)?.project
    if (id && !panel.openId) void openProject(id, true)
    else if (!id && panel.openId) void closeProject(true)
  })

  // --- input ---
  const stage = $("stage")
  const pointer = { present: false, lastMove: -Infinity, type: "mouse", sx: 0, sy: 0, moved: false }
  let touchStart: { x: number; y: number; t: number; last: number } | null = null
  stage.addEventListener("pointermove", (e) => {
    pointer.type = e.pointerType
    pointer.sx = e.clientX
    pointer.sy = e.clientY
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
    if (e.pointerType === "touch") {
      if (touchStart) {
        const dy = e.clientY - touchStart.last
        touchStart.last = e.clientY
        if (Math.abs(e.clientY - touchStart.y) > 8 && !panel.openId) rig.nudge(dy * 0.0042, performance.now())
      }
      return
    }
    pointer.present = true
    pointer.lastMove = performance.now()
    pointer.moved = true
    if (finePointer) rig.setPointer(ndc.x, ndc.y)
  })
  stage.addEventListener("pointerleave", () => {
    pointer.present = false
    rig.setPointer(0, 0)
  })
  stage.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") touchStart = { x: e.clientX, y: e.clientY, t: performance.now(), last: e.clientY }
  })
  stage.addEventListener("pointerup", (e) => {
    const tap = e.pointerType !== "touch" || (touchStart && Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y) < 10)
    touchStart = null
    if (!tap || panel.openId) return
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
    const id = pick()
    if (id) activate(id)
    else note.close()
  })
  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault()
      if (panel.openId) return
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1
      rig.nudge(THREE.MathUtils.clamp(e.deltaY * unit, -120, 120) * 0.0016, performance.now())
      note.close()
      hideHint()
    },
    { passive: false },
  )
  addEventListener("keydown", (e) => {
    if (!reading.hidden || e.altKey || e.ctrlKey || e.metaKey) return
    const t = e.target as HTMLElement
    if (panel.openId || t.closest("#note")) return
    const next = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }[e.key]
    if (next !== undefined) {
      e.preventDefault()
      goStation(rig.nearest + next)
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault()
      goStation(e.key === "Home" ? 0 : STATIONS.length - 1)
    } else if (e.key === "Escape") {
      note.close(true)
    } else if (e.key === "d" || e.key === "D") {
      $("debug").hidden = !$("debug").hidden
    }
  })
  for (const b of document.querySelectorAll('[data-action="reading"]'))
    b.addEventListener("click", (e) => {
      e.preventDefault()
      showReading("choice")
    })
  document.querySelector('[data-action="home"]')!.addEventListener("click", (e) => {
    e.preventDefault()
    if (panel.openId) void closeProject()
    else goStation(0)
  })
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight, false)
    post.setSize(innerWidth, innerHeight)
    rig.resize(innerWidth, innerHeight)
    if (panel.openId) rig.focus(focusPose())
  })

  // --- hint ---
  const hint = $("hint")
  let hintShown = false
  function showHint() {
    if (hintShown) return
    hintShown = true
    hint.textContent = finePointer
      ? "Usa la rueda o ← → para recorrer la ruta · señala lo que te llame · haz clic en Scope"
      : "Desliza arriba o abajo para recorrer la ruta · toca lo que te llame"
    hint.classList.remove("gone")
    window.setTimeout(hideHint, 9000)
  }
  function hideHint() {
    hint.classList.add("gone")
  }
  hint.classList.add("gone")

  // --- gaze targets ---
  const gazePoint = new THREE.Vector3()
  function resolveGaze(g: GazeTarget | null): THREE.Vector3 | null {
    if (!g) return null
    switch (g.kind) {
      case "none":
        return null
      case "poi": {
        const p = POIS.find((q) => q.id === g.id)
        return p ? blv(p.look, gazePoint) : null
      }
      case "pointer":
        return gazePoint.copy(pointerHit)
      case "visitor":
        return gazePoint.copy(rig.camera.position)
      case "path": {
        const fwd = new THREE.Vector3(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y))
        return gazePoint.copy(actor.group.position).addScaledVector(fwd, 0.3).setY(actor.group.position.y + 0.02)
      }
    }
  }

  // --- perf ---
  const frames: number[] = []
  let lastPerfAdjust = 0
  const perf = () => {
    const sorted = [...frames].sort((a, b) => a - b)
    const avg = frames.reduce((s, v) => s + v, 0) / Math.max(1, frames.length)
    return {
      fps: avg ? 1000 / avg : 0,
      avgMs: avg,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      dpr,
      tier: tier.name,
      renderer: gl.renderer,
      software: gl.software,
      loadMs: Math.round(loadMs),
      worldBytes: world.stats.bytes,
      scopeBytes: actor.model.stats.bytes,
    }
  }

  // --- no GPU: say so once, quietly, and offer the reading view ---
  function showSoftwareNotice() {
    const notice = $("notice")
    notice.hidden = false
    notice.querySelector(".close")!.addEventListener("click", () => (notice.hidden = true))
    window.setTimeout(() => (notice.hidden = true), 14000)
  }

  // --- entry choreography ---
  let intent: Intent | null = null
  let stateLog: { t: number; state: MindState; activity: string }[] = []
  const skipIntro = reducedMotion || params.has("skipintro")
  function introPose(): CameraPose {
    const r = loader.scopeRect()
    const lens = 50
    const aspect = innerWidth / innerHeight
    const vHalf = aspect >= 1 ? 18 / lens / aspect : 18 / lens
    const head = actor.group.position.clone()
    const centreY = head.y + actor.height * 0.5
    const dist = (actor.height * innerHeight) / (Math.max(60, r.height) * 2 * vHalf)
    const facing = new THREE.Vector3(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y))
    // a little above his eyes (~8°): the sheet reads as a place, not a line
    const pos = head.clone().addScaledVector(facing, dist).setY(centreY + dist * 0.14)
    const feetY = r.bottom - r.height // top of the drawn Scope
    const centreScreen = feetY + r.height / 2
    return {
      pos,
      target: new THREE.Vector3(head.x, centreY, head.z),
      lens,
      shift: { x: r.cx / innerWidth - 0.5, y: centreScreen / innerHeight - 0.5 },
    }
  }
  if (!skipIntro) rig.holdIntro(introPose())
  else world.setLamp(1, scene)

  // compile every shader before the reveal (no hitch on the first frames)
  rig.update(0, performance.now())
  renderer.compile(scene, rig.camera)
  post.render()
  document.body.classList.remove("is-loading")

  let lampStart = -1
  loader.onReveal = () => {
    if (!skipIntro) actor.animator.play("Laugh", { fadeInMs: 80 })
  }
  void loader.exit().then(() => {
    if (gl.software) showSoftwareNotice()
    if (skipIntro) {
      mind.lampOn()
      showHint()
      return
    }
    lampStart = performance.now() + 250
    window.setTimeout(() => mind.lampOn(), 700)
    window.setTimeout(() => rig.releaseIntro(), 1100)
    window.setTimeout(showHint, 4200)
  })

  // --- loop ---
  let last = performance.now()
  let debugAt = 0
  let hoverPoi: string | null = null
  let mvHover = 0
  let turnWish = 0
  const startedAt = performance.now()
  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min(MAX_DT, (now - last) / 1000)
    frames.push(now - last)
    if (frames.length > 240) frames.shift()
    last = now
    if (!reading.hidden) return

    if (lampStart > 0) {
      // the filament warms up with a small catch, then holds (a light, not a cut)
      const t = (now - lampStart) / 1900
      const flicker = t > 0 && t < 0.25 ? 0.12 * Math.sin(t * 90) : 0
      world.setLamp(THREE.MathUtils.clamp(t + flicker, 0, 1), scene)
      if (t >= 1) lampStart = -1
    }

    rig.update(dt, now)

    // hover (fine pointer only; one raycast per frame at most)
    if (pointer.moved && finePointer && pointer.present && !panel.openId) {
      pointer.moved = false
      hoverPoi = pick()
      document.body.classList.toggle("pointer-on-thing", !!hoverPoi && hoverPoi !== null)
      hotspots.setHot(hoverPoi === "scope" ? "scope" : hoverPoi)
    } else if (!pointer.present && hoverPoi) {
      hoverPoi = null
      hotspots.setHot(null)
      document.body.classList.remove("pointer-on-thing")
    }
    mvHover += ((hoverPoi === "mathview" || focusedPoi === "mathview" ? 1 : 0) - mvHover) * Math.min(1, dt * 6)
    world.uniforms.uHover.value = mvHover

    // MathView: contours and their reveal, the card
    const u = world.uniforms
    u.uContours.value += (contoursGoal - u.uContours.value) * Math.min(1, dt * 2.2)
    if (revealStart > 0) {
      u.uReveal.value = reducedMotion ? 1 : ((now - revealStart) / 1000) * 0.42
      if (contoursGoal < 0.5) revealStart = -1
    }
    world.setCardOpen(world.cardOpenness + (cardGoal - world.cardOpenness) * Math.min(1, dt * 3.2))

    // Scope: perceive -> decide -> act
    actor.headPosition(scopeHotspot).y += 0.075
    const headScreen = actor.headPosition(new THREE.Vector3()).project(rig.camera)
    const near =
      pointer.present &&
      Math.hypot((headScreen.x * 0.5 + 0.5) * innerWidth - pointer.sx, (-headScreen.y * 0.5 + 0.5) * innerHeight - pointer.sy) <
        Math.max(innerWidth, innerHeight) * 0.33
    intent = mind.update({
      now,
      scopeAt: actor.at,
      moving: actor.moving,
      gesturing: actor.gesturing,
      pointer: {
        present: pointer.present && finePointer,
        moving: now - pointer.lastMove < 250,
        overScope: hoverPoi === "scope" || focusedScope,
        nearScope: near,
      },
      hovered: (hoverPoi !== "scope" ? hoverPoi : null) ?? focusedPoi ?? note.openId,
      station: rig.nearest,
      cameraSettled: rig.settled,
      projectOpen: panel.openId,
      reducedMotion,
    })
    if (!stateLog.length || stateLog[stateLog.length - 1].activity !== intent.activity) {
      stateLog.push({ t: Math.round(now - startedAt), state: intent.state, activity: intent.activity })
      if (stateLog.length > 60) stateLog = stateLog.slice(-60)
    }
    const g = resolveGaze(intent.gaze)
    actor.presence.target = g ? (actor.presence.target ?? new THREE.Vector3()).copy(g) : null
    actor.presence.weight = intent.weight
    actor.goTo(intent.goal, intent.goalId ?? "")
    // the body follows the gaze when it stays far off to one side (he turns to you)
    const off = actor.presence.readout.offAxisDeg
    turnWish = g && !actor.moving && off > 35 && intent.weight.body > 0.5 ? turnWish + dt : 0
    const face = resolveGaze(intent.face) ?? (turnWish > 0.6 && g ? g : null)
    actor.faceToward(face ? face.clone() : null)
    actor.gesture(intent.gesture)
    actor.update(dt)

    hotspots.update(rig.camera, innerWidth, innerHeight, rig.position, !!panel.openId || rig.focusAmount > 0.05)
    note.place()
    post.render()

    // adapt: a sustained slow frame lowers the resolution (never raises it back mid-visit)
    if (now - startedAt > 5000 && now - lastPerfAdjust > 4000 && frames.length > 120) {
      const p = perf()
      const minDpr = gl.software ? SOFTWARE_MIN_SCALE : 1
      if (p.avgMs > 30 && dpr > minDpr) {
        dpr = Math.max(minDpr, dpr - (gl.software ? 0.1 : 0.25))
        renderer.setPixelRatio(dpr)
        renderer.setSize(innerWidth, innerHeight, false)
        post.setSize(innerWidth, innerHeight)
        lastPerfAdjust = now
      }
    }
    if (!$("debug").hidden && now - debugAt > 250) {
      debugAt = now
      const p = perf()
      const r = actor.presence.readout
      $("debug").textContent = [
        `state     ${intent.state}`,
        `activity  ${intent.activity}`,
        `gaze      ${intent.gaze.kind}${"id" in intent.gaze ? ` ${intent.gaze.id}` : ""}  eyes ${intent.weight.eyes.toFixed(2)} body ${intent.weight.body.toFixed(2)}`,
        `look      yaw ${r.yawDeg.toFixed(1)}°  pitch ${r.pitchDeg.toFixed(1)}°  eyes ${r.eyeMm[0].toFixed(1)}/${r.eyeMm[1].toFixed(1)} mm`,
        `clips     ${actor.animator.active().map((c) => c.clip).join(", ") || "Idle"}`,
        `moving    ${actor.moving}  at ${actor.at.map((v) => v.toFixed(2)).join(", ")}`,
        `camera    s=${rig.position.toFixed(2)} → ${rig.goal.toFixed(2)}  focus ${rig.focusAmount.toFixed(2)}`,
        ``,
        `fps       ${p.fps.toFixed(0)}  avg ${p.avgMs.toFixed(1)} ms  p95 ${p.p95Ms.toFixed(1)} ms`,
        `draws     ${p.calls}  tris ${p.triangles}`,
        `tier      ${p.tier}  dpr ${p.dpr}  bloom ${post.bloom}  ${p.software ? "SOFTWARE" : ""}`,
        `gpu       ${p.renderer.slice(0, 60)}`,
        `eye fit   ${actor.presence.fit ? `${(actor.presence.fit.left.position * 1000).toFixed(3)} mm rms (${actor.presence.fit.left.samples} samples)` : "n/a"}`,
      ].join("\n")
    }
  })

  // deep link: #mathview opens it after the entry
  const deep = location.hash.slice(1)
  if (deep && project(deep)) {
    history.replaceState({ project: deep }, "", `#${deep}`)
    window.setTimeout(() => void openProject(deep, true), skipIntro ? 300 : 4200)
  }

  // test / review handle (prototype only)
  Object.assign(window, {
    __sw: {
      perf,
      state: () => ({ ...intent, log: stateLog }),
      scope: () => ({ at: actor.at, moving: actor.moving, clips: actor.animator.active().map((c) => c.clip), presence: actor.presence.readout, fit: actor.presence.fit }),
      camera: () => ({ s: rig.position, goal: rig.goal, settled: rig.settled, focus: rig.focusAmount }),
      goStation,
      open: (id: string) => openProject(id),
      close: () => closeProject(),
      greet: greetScope,
      activate,
      project: () => panel.openId,
      world: () => world.stats,
    },
  })
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

// --- boot ---------------------------------------------------------------------------------
const gl = probeGL()
if (params.has("debug")) $("debug").hidden = false
if (params.has("fallback") || !gl.ok) {
  void startFallback(
    !gl.ok
      ? "Este navegador no puede mostrar WebGL, así que aquí tienes el mismo contenido en forma de página."
      : "Vista sin 3D, forzada con ?fallback.",
  )
} else {
  start3D(gl).catch((err) => {
    console.error(err)
    void startFallback("El mundo 3D no ha podido cargar. Aquí tienes el mismo contenido en forma de página.")
  })
}

