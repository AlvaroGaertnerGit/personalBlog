// Scope World 2.0 · Entrega 2: a navigable study of the environment (not the experience).
// The approved world, its materials and Scope come from the 1.0 prototype, imported
// read-only; what is new is everything around it: the paper relief to the horizon
// (exported from Blender, export_env.py), the sky, the haze and four moods of light.
// No zones, no behaviour: that is Entrega 3 and 4.

import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

import { ScopeActor } from "../../../prototype/src/scope/scope-actor.ts"
import { addEnvironment } from "../../../prototype/src/world/post.ts"
import { PliegoWorld } from "../../../prototype/src/world/world.ts"
import { bl, loadWorldData } from "../../../prototype/src/world/world-data.ts"

type V3 = [number, number, number]
const params = new URLSearchParams(location.search)
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// --- capability: without a GPU the browser draws on the CPU, so render smaller ------------
function probe() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2")
    if (!gl) return { ok: false, software: false, renderer: "sin WebGL" }
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return { ok: true, software: /swiftshader|llvmpipe|software|basic render/i.test(r), renderer: r }
  } catch {
    return { ok: false, software: false, renderer: "error" }
  }
}

// --- moods: the same palettes as the Blender study (entorno2.py) --------------------------
interface Mood {
  label: string
  sun: { az: number; el: number; color: V3; intensity: number }
  zenith: V3
  horizon: V3
  glow: V3
  glowWidth: number
  haze: V3
  hemi: number
  lamp: number
  lantern: number
  exposure: number
}
const MOODS: Record<string, Mood> = {
  amanecer: { label: "Amanecer", sun: { az: 150, el: 9, color: [1, 0.7, 0.45], intensity: 2.6 }, zenith: [0.025, 0.03, 0.07], horizon: [0.4, 0.34, 0.44], glow: [1.5, 0.85, 0.4], glowWidth: 0.2, haze: [0.4, 0.35, 0.44], hemi: 0.55, lamp: 1, lantern: 0, exposure: 1.0 },
  dia: { label: "Día", sun: { az: 140, el: 32, color: [1, 0.93, 0.84], intensity: 3.2 }, zenith: [0.07, 0.11, 0.22], horizon: [0.46, 0.45, 0.45], glow: [0.35, 0.3, 0.22], glowWidth: 0.12, haze: [0.52, 0.51, 0.52], hemi: 0.7, lamp: 1, lantern: 0, exposure: 0.85 },
  atardecer: { label: "Atardecer", sun: { az: 200, el: 4, color: [1, 0.52, 0.28], intensity: 2.4 }, zenith: [0.03, 0.03, 0.07], horizon: [0.55, 0.3, 0.26], glow: [1.4, 0.6, 0.25], glowWidth: 0.25, haze: [0.45, 0.3, 0.3], hemi: 0.45, lamp: 1, lantern: 0.4, exposure: 1.0 },
  noche: { label: "Noche", sun: { az: 110, el: 28, color: [0.55, 0.64, 1], intensity: 0.12 }, zenith: [0.004, 0.006, 0.014], horizon: [0.04, 0.055, 0.1], glow: [0.02, 0.03, 0.05], glowWidth: 0.3, haze: [0.035, 0.05, 0.09], hemi: 0.06, lamp: 0, lantern: 1, exposure: 1.2 },
}

// --- cameras: the Blender shots (position, target, lens), Blender coordinates -------------
const SHOTS: Record<string, { label: string; pos: V3; target: V3; lens: number; mood: string }> = {
  general: { label: "Vista general", pos: [-1.7, -1.75, 0.85], target: [0, 0.35, 0.15], lens: 24, mood: "amanecer" },
  horizonte: { label: "La atalaya", pos: [0.27, 0.47, 0.1], target: [0.68, 1.75, 0.13], lens: 26, mood: "amanecer" },
  margen: { label: "El margen", pos: [-0.84, -0.69, 0.1], target: [-0.66, -0.2, 0.09], lens: 24, mood: "amanecer" },
  escala: { label: "A la altura de Scope", pos: [-1.05, -1.25, 0.16], target: [0.6, 1.8, 0.32], lens: 22, mood: "amanecer" },
  linterna: { label: "La linterna", pos: [-0.56, -0.86, 0.13], target: [-1.13, -0.44, 0.13], lens: 36, mood: "noche" },
}

const v3 = (c: V3) => new THREE.Color(c[0], c[1], c[2])
const blp = (p: V3) => bl(p[0], p[1], p[2])

// --- sky: zenith → horizon, and a glow around the sun -------------------------------------
function makeSky() {
  const uniforms = {
    zenith: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    glow: { value: new THREE.Color() },
    glowWidth: { value: 0.2 },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith, horizon, glow, sunDir;
      uniform float glowWidth;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = smoothstep(0.45, -0.02, d.y);
        vec3 c = mix(zenith, horizon, h);
        float g = smoothstep(1.0 - glowWidth, 1.0, dot(d, sunDir));
        c += glow * g;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  return { mesh, uniforms }
}

// --- the blank paper of the world: ruled lines and margin run out from the sheet and fade --
function paperWorld(color: THREE.Color) {
  // double-sided: the relief is wound downward (Cycles renders both sides; three culls one)
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, side: THREE.DoubleSide })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;")
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp;")
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        {
          float X = vWp.x, Y = -vWp.z;                       // Blender axes
          float dx = max(abs(X) - 1.0, 0.0), dy = max(abs(Y) - 0.7, 0.0);
          float outside = length(vec2(dx, dy));
          float yy = Y + sin(X * 1.7) * outside * 0.05;      // the rules bend as they run
          float pp = abs(fract(yy / 0.03 + 0.5) - 0.5);
          float line = smoothstep(0.035, 0.012, pp) * smoothstep(2.2, 0.0, outside) * 0.42;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.50, 0.62), line);
          float wander = sin(Y * 0.9) * dy * 0.35;
          float md = abs(X + 0.8 - wander);
          float margin = smoothstep(0.004, 0.0015, md) * smoothstep(5.0, 0.0, outside) * 0.7;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.12, 0.08), margin);
        }`,
      )
  }
  return m
}

async function start() {
  const gl = probe()
  if (!gl.ok) {
    $("status").textContent = "Este navegador no puede mostrar WebGL. Las imágenes del estudio están en la carpeta renders."
    return
  }
  const scale = gl.software ? 0.5 : Math.min(devicePixelRatio, 1.75)
  const canvas = $<HTMLCanvasElement>("view")
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !gl.software, powerPreference: "high-performance" })
  renderer.setPixelRatio(scale)
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.shadowMap.enabled = !gl.software // on the CPU, shadows alone cost more than the whole frame
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  addEnvironment(renderer, scene)
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 800)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !reduced
  controls.minDistance = 0.12
  controls.maxDistance = 30
  controls.maxPolarAngle = THREE.MathUtils.degToRad(89)
  controls.screenSpacePanning = false

  const t0 = performance.now()
  const { data, floor, nav } = await loadWorldData("/world")
  const envRes = await fetch("/assets/entorno.glb")
  const envBuf = await envRes.arrayBuffer()
  const [world, actor, envGltf] = await Promise.all([
    PliegoWorld.load("/world/world.glb", data, floor, { name: gl.software ? "low" : "medium", shadowMap: 1024, lampShadow: false }),
    ScopeActor.load("/scope/scope.glb", floor, nav),
    new GLTFLoader().parseAsync(envBuf, ""),
  ])
  const loadMs = performance.now() - t0

  // the approved world, minus its black desk (the paper relief replaces it); its window stays
  // as a fill light but stops casting: one shadow caster (the sun) instead of two
  world.root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CircleGeometry) o.visible = false
    if (o instanceof THREE.DirectionalLight) o.castShadow = false
  })
  scene.add(world.root, actor.group)
  actor.place([-0.52, -0.34], THREE.MathUtils.degToRad(200))

  // the environment, its paper rebuilt here
  const paper = new THREE.Color().setRGB(0.8, 0.77, 0.7, THREE.SRGBColorSpace)
  const world2 = paperWorld(paper)
  const standing = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.86, 0.83, 0.77, THREE.SRGBColorSpace), roughness: 0.9, side: THREE.DoubleSide })
  const lanternMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.86, 0.82, 0.74, THREE.SRGBColorSpace), roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color(1, 0.62, 0.3), emissiveIntensity: 0 })
  // the ink lake: dark, but a mirror of the sky (a black matte disc read as a hole)
  const ink = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.03, 0.045, 0.09, THREE.SRGBColorSpace), metalness: 0.85, roughness: 0.14, envMapIntensity: 1.4 })
  // static environment: merged into one mesh per material (≈95 draw calls → a handful) and
  // never casting shadows; Scope's places (near, small) keep their own meshes and shadows
  let envTris = 0
  envGltf.scene.updateMatrixWorld(true)
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const places: THREE.Mesh[] = []
  envGltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    const g = o.geometry as THREE.BufferGeometry
    envTris += (g.index ? g.index.count : g.attributes.position.count) / 3
    const name = (o.material as THREE.Material).name
    let mat = o.material as THREE.Material
    if (name.startsWith("Ink_Lake")) mat = ink
    else if (name.startsWith("Paper_World")) mat = world2
    else if (name.startsWith("Paper_Lantern")) mat = lanternMat
    else if (name.startsWith("Paper_")) mat = standing
    const isPlace = /^(Scope_|Found_|Radio_|Trail_|Paper_Lantern)/.test(name) || /^(Scope_|Trail_)/.test(o.name)
    if (isPlace) {
      o.material = mat
      o.castShadow = true
      o.receiveShadow = true
      places.push(o)
      return
    }
    const flat = g.clone().applyMatrix4(o.matrixWorld)
    for (const k of Object.keys(flat.attributes)) if (k !== "position" && k !== "normal") flat.deleteAttribute(k)
    const list = buckets.get(mat) ?? []
    list.push(flat.index ? flat.toNonIndexed() : flat)
    buckets.set(mat, list)
  })
  for (const [mat, list] of buckets) {
    const merged = mergeGeometries(list)
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, mat)
    mesh.receiveShadow = true
    mesh.matrixAutoUpdate = false
    scene.add(mesh)
  }
  for (const m of places) {
    m.updateMatrixWorld(true)
    const keep = m.matrixWorld.clone()
    m.removeFromParent()
    m.matrix.copy(keep)
    m.matrix.decompose(m.position, m.quaternion, m.scale)
    scene.add(m)
  }

  // light: the world's own (window, lamp, hemisphere) + a sun with a short shadow range
  const sky = makeSky()
  scene.add(sky.mesh)
  const sun = new THREE.DirectionalLight(0xffffff, 1)
  sun.castShadow = true
  sun.shadow.mapSize.setScalar(gl.software ? 1024 : 2048)
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  scene.add(sun, sun.target)
  const hemi = new THREE.HemisphereLight(0xc8cde0, 0x5a4c40, 0.5)
  scene.add(hemi)
  const lanternLight = new THREE.PointLight(new THREE.Color(1, 0.7, 0.42), 0, 2.5, 1.6)
  lanternLight.position.copy(bl(-1.22, -0.4, 0.14))
  scene.add(lanternLight)
  scene.fog = new THREE.Fog(0xffffff, 1.4, 48)

  let mood = "amanecer"
  const sunDir = new THREE.Vector3(0, 1, 0)
  function setMood(name: string) {
    mood = name
    const m = MOODS[name]
    world.setLamp(m.lamp, scene)          // the lamp, window and hemisphere of the 1.0 world
    scene.background = null               // ...but the sky is ours
    const to = new THREE.Vector3(
      Math.cos(THREE.MathUtils.degToRad(m.sun.az)) * Math.cos(THREE.MathUtils.degToRad(m.sun.el)),
      Math.sin(THREE.MathUtils.degToRad(m.sun.el)),
      -Math.sin(THREE.MathUtils.degToRad(m.sun.az)) * Math.cos(THREE.MathUtils.degToRad(m.sun.el)),
    ) // Blender (x, y, z-up) → three (x, z-up as y, -y)
    sunDir.copy(to)
    sun.color.copy(v3(m.sun.color))
    sun.intensity = m.sun.intensity
    sky.uniforms.zenith.value.copy(v3(m.zenith))
    sky.uniforms.horizon.value.copy(v3(m.horizon))
    sky.uniforms.glow.value.copy(v3(m.glow))
    sky.uniforms.glowWidth.value = m.glowWidth
    sky.uniforms.sunDir.value.copy(to)
    ;(scene.fog as THREE.Fog).color.copy(v3(m.haze))
    hemi.intensity = m.hemi
    lanternLight.intensity = m.lantern * 0.35
    lanternLight.visible = m.lantern > 0 // an unlit point light still costs every pixel
    lanternMat.emissiveIntensity = m.lantern * 0.9
    renderer.toneMappingExposure = m.exposure
    for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mood]")) b.setAttribute("aria-pressed", String(b.dataset.mood === name))
  }

  // cameras
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
    if (s.mood !== mood) setMood(s.mood)
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
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight, false)
  })

  setMood(params.get("hora") ?? "amanecer")
  goShot(params.get("camara") ?? "general", true)
  document.body.classList.remove("loading")

  // loop + measured performance
  const frames: number[] = []
  let last = performance.now()
  let hudAt = 0
  const stats = { envBytes: envBuf.byteLength, worldBytes: world.stats.bytes, envTris, worldTris: world.stats.triangles, loadMs: Math.round(loadMs) }
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
    // keep the camera above the paper
    const ground = floor.at(camera.position.x, camera.position.z)
    if (camera.position.y < ground + 0.03) camera.position.y = ground + 0.03
    sky.mesh.position.copy(camera.position)
    // the sun's short shadow range travels with what you are looking at
    sun.target.position.copy(controls.target)
    sun.position.copy(controls.target).addScaledVector(sunDir, 12)
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
