// The Scope World stage: the APPROVED world, read-only — the 1.0 Pliego, the
// 2.0 environment (paper relief to the horizon, sky, haze) — and the four moods
// of light of the Entrega 2 study. The ONE environment module: the Entrega 2
// viewer, the Entrega 3 lab and the Entrega 4 world all build their scene here.

import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

import { addEnvironment } from "../../prototype/src/world/post.ts"
import { PliegoWorld } from "../../prototype/src/world/world.ts"
import { bl, loadWorldData } from "../../prototype/src/world/world-data.ts"

import { type Mood, MOODS } from "./moods.ts"

type V3 = [number, number, number]

export { MOODS } from "./moods.ts"

const v3 = (c: V3) => new THREE.Color(c[0], c[1], c[2])

export function probeGL() {
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

/** The blank paper of the world: ruled lines and margin run out from the sheet and fade (Entrega 2). */
function paperWorld(color: THREE.Color) {
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
          float X = vWp.x, Y = -vWp.z;
          float dx = max(abs(X) - 1.0, 0.0), dy = max(abs(Y) - 0.7, 0.0);
          float outside = length(vec2(dx, dy));
          float yy = Y + sin(X * 1.7) * outside * 0.05;
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

export interface StageOptions {
  software: boolean
  /** Skip the 2.0 relief (faster on a CPU renderer). */
  light: boolean
  /** Where the environment GLB is served. */
  envUrl?: string
  /** Leave the 2.0 radiometer out: the world places its interactive one where Scope can reach it. */
  withoutRadiometer?: boolean
  /** Half size (m) of the sun's shadow box, which travels with what you look at. */
  shadowExtent?: number
  /** Reach of the lantern's own light (m). */
  lanternRange?: number
}

export async function createStage(canvas: HTMLCanvasElement, opt: StageOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !opt.software, powerPreference: "high-performance" })
  renderer.setPixelRatio(opt.software ? 0.5 : Math.min(devicePixelRatio, 1.75))
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.shadowMap.enabled = !opt.software
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  addEnvironment(renderer, scene)
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 800)

  const t0 = performance.now()
  const { data, floor, nav } = await loadWorldData("/world")
  const envBuf = opt.light ? null : await fetch(opt.envUrl ?? "/env/entorno.glb").then((r) => {
    if (!r.ok) throw new Error(`entorno.glb: ${r.status}`)
    return r.arrayBuffer()
  })
  const [world, envGltf] = await Promise.all([
    PliegoWorld.load("/world/world.glb", data, floor, { name: opt.software ? "low" : "medium", shadowMap: 1024, lampShadow: false }),
    envBuf ? new GLTFLoader().parseAsync(envBuf, "") : Promise.resolve(null),
  ])
  const loadMs = performance.now() - t0

  world.root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CircleGeometry) o.visible = !envGltf // the desk, unless the relief replaces it
    if (o instanceof THREE.DirectionalLight) o.castShadow = false
  })
  scene.add(world.root)

  const lanternMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.86, 0.82, 0.74, THREE.SRGBColorSpace), roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color(1, 0.62, 0.3), emissiveIntensity: 0 })
  let envTris = 0
  if (envGltf) {
    const paper = new THREE.Color().setRGB(0.8, 0.77, 0.7, THREE.SRGBColorSpace)
    const world2 = paperWorld(paper)
    const standing = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.86, 0.83, 0.77, THREE.SRGBColorSpace), roughness: 0.9, side: THREE.DoubleSide })
    const ink = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.03, 0.045, 0.09, THREE.SRGBColorSpace), metalness: 0.85, roughness: 0.14, envMapIntensity: 1.4 })
    envGltf.scene.updateMatrixWorld(true)
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
    const places: THREE.Mesh[] = []
    envGltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const g = o.geometry as THREE.BufferGeometry
      envTris += (g.index ? g.index.count : g.attributes.position.count) / 3
      const name = (o.material as THREE.Material).name
      // the 2.0 radiometer stays out of the lab: its copy stands where Scope can reach it
      if (opt.withoutRadiometer !== false && name.startsWith("Radio_")) return
      let mat = o.material as THREE.Material
      if (name.startsWith("Ink_Lake")) mat = ink
      else if (name.startsWith("Paper_World")) mat = world2
      else if (name.startsWith("Paper_Lantern")) mat = lanternMat
      else if (name.startsWith("Paper_")) mat = standing
      const isPlace = /^(Scope_|Found_|Trail_|Paper_Lantern)/.test(name) || /^(Scope_|Trail_)/.test(o.name)
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
  }

  const sky = makeSky()
  scene.add(sky.mesh)
  const sun = new THREE.DirectionalLight(0xffffff, 1)
  sun.castShadow = !opt.software
  sun.shadow.mapSize.setScalar(2048)
  const ext = opt.shadowExtent ?? 1.2
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 30 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  scene.add(sun, sun.target)
  const hemi = new THREE.HemisphereLight(0xc8cde0, 0x5a4c40, 0.5)
  scene.add(hemi)
  // his home's own light: what shines through the paper (lantern glow + his light inside).
  // Lights are never added or removed at runtime: a change in light count recompiles every shader.
  const lanternLight = new THREE.PointLight(new THREE.Color(1, 0.7, 0.42), 0, opt.lanternRange ?? 0.9, 1.6)
  lanternLight.position.copy(bl(-1.2, -0.4, 0.12))
  scene.add(lanternLight)
  scene.fog = new THREE.Fog(0xffffff, 1.4, 48)

  let mood = MOODS.atardecer
  let moodName = "atardecer"
  const sunDir = new THREE.Vector3()
  function setMood(name: string) {
    moodName = MOODS[name] ? name : "atardecer"
    applyMood(MOODS[name] ?? MOODS.atardecer)
  }

  /** Any light, a named mood or a blend of two (mixMoods): no light is added or removed, nothing recompiles. */
  function applyMood(m: Mood) {
    mood = m
    world.setLamp(mood.lamp, scene)
    scene.background = null
    const az = THREE.MathUtils.degToRad(mood.sun.az)
    const el = THREE.MathUtils.degToRad(mood.sun.el)
    sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el))
    sun.color.copy(v3(mood.sun.color))
    sun.intensity = mood.sun.intensity
    sky.uniforms.zenith.value.copy(v3(mood.zenith))
    sky.uniforms.horizon.value.copy(v3(mood.horizon))
    sky.uniforms.glow.value.copy(v3(mood.glow))
    sky.uniforms.glowWidth.value = mood.glowWidth
    sky.uniforms.sunDir.value.copy(sunDir)
    ;(scene.fog as THREE.Fog).color.copy(v3(mood.haze))
    hemi.intensity = mood.hemi
    renderer.toneMappingExposure = mood.exposure
    setLanternGlow(fromScopeNow)
  }

  /** His home glows: the mood's lantern plus what his own light gives it from inside. */
  let fromScopeNow = 0
  function setLanternGlow(fromScope: number) {
    fromScopeNow = fromScope
    lanternMat.emissiveIntensity = mood.lantern * 0.9 + fromScope * 1.6
    lanternLight.intensity = mood.lantern * 0.35 + fromScope * 0.5
  }

  function frame(target: THREE.Vector3) {
    sky.mesh.position.copy(camera.position)
    sun.target.position.copy(target)
    sun.position.copy(target).addScaledVector(sunDir, 12)
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight, false)
  }

  return {
    renderer,
    scene,
    camera,
    world,
    floor,
    nav,
    setMood,
    applyMood,
    setLanternGlow,
    frame,
    resize,
    get mood() {
      return mood
    },
    sun,
    get moodName() {
      return moodName
    },
    stats: { loadMs: Math.round(loadMs), envTris, envBytes: envBuf?.byteLength ?? 0, worldTris: world.stats.triangles, worldBytes: world.stats.bytes },
  }
}

export type Stage = Awaited<ReturnType<typeof createStage>>
