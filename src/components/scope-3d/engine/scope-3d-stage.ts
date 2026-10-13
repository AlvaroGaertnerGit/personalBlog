// Scope 3D stage: renderer, camera, orbit controls, lights, floor, bloom.
//
// Lights mirror the Blender studio (assets/scope-3d/scripts/scope3d/studio.py
// LIGHT_RIGS) converted from Blender Z-up / -Y-facing to glTF Y-up / +Z-facing:
// (x, y, z)_blender -> (x, z, -y)_three. Intensities are tuned by eye against
// renders/model/<rig>/view-hero.png — area-light watts don't map 1:1.

import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"

import { Scope3DOutputPass, type Scope3DQuality } from "./scope-3d-resolution.ts"

export type Scope3DLightRig = "warm" | "cool"
export type Scope3DBackdrop = "sheet" | "site"

export interface Scope3DLighting {
  rig: Scope3DLightRig
  backdrop: Scope3DBackdrop
  exposure: number
  key: number
  fill: number
  rim: number
  top: number
  environment: number
  shadows: boolean
  bloom: boolean
  bloomStrength: number
  grain: boolean
}

export const DEFAULT_SCOPE_3D_LIGHTING: Scope3DLighting = {
  rig: "warm",
  backdrop: "sheet",
  exposure: 1,
  key: 2.3,
  fill: 0.5,
  rim: 2.4,
  top: 0.6,
  environment: 0.25,
  shadows: true,
  bloom: true,
  bloomStrength: 0.18,
  grain: true,
}

const BACKDROPS: Record<Scope3DBackdrop, string> = {
  sheet: "#090d16", // studio.world(): the design sheet's deep navy
  site: "#0a0a0a", // --background in .dark (globals.css)
}

type LightName = "key" | "fill" | "rim" | "top"

// [position (three coords), colour per rig]
const LIGHTS: Record<LightName, [THREE.Vector3Tuple, Record<Scope3DLightRig, THREE.ColorRepresentation>]> = {
  key: [[-0.42, 0.48, 0.5], { warm: new THREE.Color(1.0, 0.86, 0.7), cool: new THREE.Color(0.86, 0.93, 1.0) }],
  fill: [[0.55, 0.16, 0.45], { warm: new THREE.Color(1.0, 0.97, 0.94), cool: new THREE.Color(0.92, 0.96, 1.0) }],
  rim: [[0.4, 0.3, -0.5], { warm: new THREE.Color(0.7, 0.82, 1.0), cool: new THREE.Color(1.0, 0.92, 0.85) }],
  top: [[0, 0.75, -0.05], { warm: new THREE.Color(1, 1, 1), cool: new THREE.Color(0.9, 0.95, 1.0) }],
}

/** Centre of the shell: what the camera orbits and the lights aim at. */
const TARGET = new THREE.Vector3(0, 0.062, 0)
/** studio.VIEWS.hero, converted: the sheet's hero angle. */
const HERO_DIRECTION = new THREE.Vector3(0.34, 0.2, 0.92).normalize()
const HERO_DISTANCE = 0.62

export interface Scope3DStageOptions {
  /** Transparent canvas (the page shows through); the backdrop setting is ignored. */
  transparent?: boolean
  /** Orbit / zoom with the pointer. Off = fixed camera, like on the site. */
  orbit?: boolean
  /**
   * Refuse software WebGL (no usable GPU): ~194 k triangles per frame run at
   * ~3 FPS there (measured, SwiftShader). Creation throws instead, so the
   * caller can fall back (on the site: the 2D Scope).
   */
  requireGpu?: boolean
}

/** Above this many internal pixels the scene target drops to 2× MSAA (memory: HalfFloat × samples). */
const MSAA_4X_MAX_PIXELS = 1_500_000
const MAX_SSAA = 4

export class Scope3DStage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(28, 1, 0.01, 20)
  readonly controls: OrbitControls
  readonly transparent: boolean

  private readonly composer: EffectComposer
  private readonly bloom: UnrealBloomPass
  private readonly output = new Scope3DOutputPass()
  private readonly lights: Record<LightName, THREE.DirectionalLight>
  private readonly floor: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>
  private readonly envTexture: THREE.Texture
  private readonly raycaster = new THREE.Raycaster()
  private pickables: THREE.Object3D[] = []
  private size = { width: 1, height: 1 }
  private qualityValue: Scope3DQuality = { pixelRatio: 1, ssaa: 1 }
  /** MSAA samples requested for the scene target (lab comparison toggle). */
  private msaa = 4
  private lighting = DEFAULT_SCOPE_3D_LIGHTING
  /** The performance governor's last resort before giving up on frame rate. */
  private shadowsAllowed = true
  /** Shadow fades to nothing between these floor radii (m), so it never hard-clips. */
  private readonly shadowFade = { value: new THREE.Vector2(0.25, 0.6) }

  constructor(
    canvas: HTMLCanvasElement,
    { transparent = false, orbit = true, requireGpu = false }: Scope3DStageOptions = {},
  ) {
    this.transparent = transparent
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // The canvas only ever receives the resolved full-screen quad: anti-aliasing
      // happens in the composer (MSAA) and in Scope3DOutputPass (supersampling).
      antialias: false,
      alpha: transparent,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: requireGpu,
    })
    if (requireGpu && isSoftwareRenderer(this.renderer)) {
      this.renderer.dispose()
      throw new Error("Software WebGL renderer")
    }
    this.qualityValue = { pixelRatio: window.devicePixelRatio, ssaa: 1 }
    this.renderer.setPixelRatio(this.qualityValue.pixelRatio)
    if (transparent) this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.AgXToneMapping // Blender's default view transform
    this.renderer.shadowMap.enabled = true
    // VSM honours shadow.radius: a broad penumbra like Blender's 0.7 m key area light.
    this.renderer.shadowMap.type = THREE.VSMShadowMap
    // Several passes per frame: count the whole frame, not the last pass.
    this.renderer.info.autoReset = false

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.envTexture = pmrem.fromScene(room, 0.04).texture
    pmrem.dispose()
    room.dispose() // its geometries/materials were only needed for the bake
    this.scene.environment = this.envTexture

    this.camera.position.copy(TARGET).addScaledVector(HERO_DIRECTION, HERO_DISTANCE)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.copy(TARGET)
    this.controls.enableDamping = true
    this.controls.minDistance = 0.2
    this.controls.maxDistance = 1.6
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(88) // never below the floor
    this.controls.enabled = orbit
    this.controls.update()

    this.lights = {} as Record<LightName, THREE.DirectionalLight>
    for (const name of Object.keys(LIGHTS) as LightName[]) {
      const light = new THREE.DirectionalLight()
      light.position.fromArray(LIGHTS[name][0]).add(TARGET)
      light.target.position.copy(TARGET)
      this.scene.add(light, light.target)
      this.lights[name] = light
    }
    const key = this.lights.key
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.radius = 14
    key.shadow.blurSamples = 16
    key.shadow.bias = -0.0005
    Object.assign(key.shadow.camera, { left: -0.16, right: 0.16, top: 0.16, bottom: -0.16, near: 0.1, far: 1.6 })

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), fadingShadowMaterial(this.shadowFade))
    this.floor.rotation.x = -Math.PI / 2
    this.floor.receiveShadow = true
    this.scene.add(this.floor)

    // Every frame goes through the composer, sized in INTERNAL pixels (canvas
    // backing × ssaa): scene (MSAA) -> eye bloom -> tone map + resolve.
    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.msaa }),
    )
    this.composer.setPixelRatio(1)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    // Tight halo hugging the eyes (Blender: compositor glare). A wide radius
    // spreads amber over the whole glass, which then reads as lit, not deep.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.05, 1.1)
    if (transparent) premultiplyBloomAlpha(this.bloom)
    this.composer.addPass(this.bloom)
    this.composer.addPass(this.output)

    this.setLighting(DEFAULT_SCOPE_3D_LIGHTING)
  }

  add(object: THREE.Object3D, pickable: THREE.Object3D[] = [object]) {
    this.scene.add(object)
    this.pickables.push(...pickable)
  }

  remove(object: THREE.Object3D) {
    this.scene.remove(object)
    this.pickables = []
  }

  setLighting(l: Scope3DLighting) {
    this.lighting = l
    this.renderer.toneMappingExposure = l.exposure
    this.scene.background = this.transparent ? null : new THREE.Color(BACKDROPS[l.backdrop])
    this.scene.environmentIntensity = l.environment
    for (const name of Object.keys(LIGHTS) as LightName[]) {
      this.lights[name].color.set(LIGHTS[name][1][l.rig])
      this.lights[name].intensity = l[name]
    }
    const shadows = l.shadows && this.shadowsAllowed
    this.lights.key.castShadow = shadows
    this.floor.visible = shadows
    this.bloom.enabled = l.bloom
    this.bloom.strength = l.bloomStrength
  }

  /** Governor: drop the shadow pass (it redraws every triangle) when frames are still too slow. */
  allowShadows(on: boolean) {
    this.shadowsAllowed = on
    this.setLighting(this.lighting)
  }

  get shadowsOn() {
    return this.lights.key.castShadow
  }

  /** CSS size of the canvas. */
  resize(width: number, height: number) {
    if (width === 0 || height === 0) return
    this.size = { width, height }
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.applyQuality()
  }

  get quality(): Readonly<Scope3DQuality> {
    return this.qualityValue
  }

  setQuality(quality: Scope3DQuality) {
    // The resolve pass reads at most 4 × 4 texels per pixel.
    this.qualityValue = { ...quality, ssaa: THREE.MathUtils.clamp(Math.round(quality.ssaa), 1, MAX_SSAA) }
    this.applyQuality()
  }

  /** Canvas backing store and internal (supersampled) render size, in pixels. */
  get resolution() {
    const canvas = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    const { ssaa } = this.qualityValue
    return {
      canvas: [canvas.x, canvas.y] as const,
      internal: [canvas.x * ssaa, canvas.y * ssaa] as const,
      samples: this.composer.renderTarget1.samples,
    }
  }

  /** MSAA samples of the scene target (0 = off, for comparison in the lab). */
  setComposerSamples(samples: number) {
    this.msaa = samples
    this.applySamples()
  }

  private applySamples() {
    const { pixelRatio, ssaa } = this.qualityValue
    const pixels = this.size.width * this.size.height * (pixelRatio * ssaa) ** 2
    const samples = pixels > MSAA_4X_MAX_PIXELS ? Math.min(this.msaa, 2) : this.msaa
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (target.samples === samples) continue
      target.samples = samples
      target.dispose() // reallocated with the new sample count on next use
    }
  }

  private applyQuality() {
    const { pixelRatio, ssaa } = this.qualityValue
    this.renderer.setPixelRatio(pixelRatio)
    // Backing store = exact device pixels of the CSS box: nothing rescales the canvas.
    this.renderer.setSize(this.size.width, this.size.height, false)
    const canvas = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    this.output.factor = ssaa
    this.composer.setSize(canvas.x * ssaa, canvas.y * ssaa)
    this.applySamples()
  }

  /**
   * Fixed framing: every `points` fully inside the view from `direction`,
   * centred, with `margin` (fraction of the half-frame) to spare.
   */
  frame({ points, box }: { points: THREE.Vector3[]; box: THREE.Box3 }, direction: THREE.Vector3, margin = 0.06) {
    const dir = direction.clone().normalize()
    const target = box.getCenter(new THREE.Vector3())
    const limit = 1 - margin
    const place = (distance: number) => {
      this.camera.position.copy(target).addScaledVector(dir, distance)
      this.camera.lookAt(target)
      this.camera.updateMatrixWorld()
    }
    const extents = () => {
      const ndc = new THREE.Box2()
      for (const p of points) {
        const q = p.clone().project(this.camera)
        ndc.expandByPoint(new THREE.Vector2(q.x, q.y))
      }
      return ndc
    }
    const fitDistance = () => {
      let lo = 0.05
      let hi = 5
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2
        place(mid)
        const e = extents()
        const fits = Math.max(-e.min.x, e.max.x, -e.min.y, e.max.y) <= limit
        if (fits) hi = mid
        else lo = mid
      }
      place(hi)
      return hi
    }
    // Two passes: fit, recentre the silhouette on screen, fit again.
    for (let pass = 0; pass < 2; pass++) {
      const distance = fitDistance()
      const c = extents().getCenter(new THREE.Vector2())
      const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
      const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
      const camUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1)
      target.addScaledVector(camRight, c.x * halfHeight * this.camera.aspect).addScaledVector(camUp, c.y * halfHeight)
    }
    fitDistance()
    this.controls.target.copy(target)
    // The shadow must fade out inside the canvas, never hard-clip at its edge.
    const reach = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2
    // Measured: an outer radius of 1.1 × reach still left a 5 % hard edge on the canvas border.
    this.shadowFade.value.set(reach * 0.3, reach * 0.85)
  }

  resetCamera() {
    this.camera.position.copy(TARGET).addScaledVector(HERO_DIRECTION, HERO_DISTANCE)
    this.controls.target.copy(TARGET)
    this.controls.update()
  }

  /** Renders a frame; returns that frame's draw calls and triangles. */
  render() {
    if (this.controls.enabled) this.controls.update()
    this.renderer.info.reset()
    this.composer.render()
    const { calls, triangles } = this.renderer.info.render
    return { calls, triangles }
  }

  /** Did a click at this canvas-relative pixel hit the model? */
  hit(x: number, y: number) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    return this.raycaster.intersectObjects(this.pickables, true).length > 0
  }

  dispose() {
    this.lights.key.shadow.dispose() // its shadow maps outlive the renderer otherwise
    this.controls.dispose()
    this.composer.dispose()
    this.bloom.dispose()
    this.output.dispose()
    this.envTexture.dispose()
    this.floor.geometry.dispose()
    this.floor.material.dispose()
    this.renderer.dispose()
  }
}

/** CPU rasterisers (no GPU): browsers don't always flag them as a performance caveat. */
function isSoftwareRenderer(renderer: THREE.WebGLRenderer) {
  const gl = renderer.getContext()
  const info = gl.getExtension("WEBGL_debug_renderer_info")
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  return /swiftshader|llvmpipe|software/i.test(name)
}

/**
 * UnrealBloomPass blurs with alpha = 1 everywhere, so on a transparent canvas
 * its additive composite turns the whole frame into a grey veil. Give the
 * glow an alpha equal to its own brightness instead: the halo becomes a
 * correct premultiplied overlay and the rest of the canvas stays clear.
 */
function premultiplyBloomAlpha(bloom: UnrealBloomPass) {
  const material = bloom.compositeMaterial
  material.fragmentShader = material.fragmentShader.replace(
    /(gl_FragColor = bloomStrength[\s\S]*?\);)/,
    // The widest blur mips leave a 1–4/255 veil over the whole canvas (measured):
    // fade the faintest glow out so the canvas edge never shows.
    // Colour: exactly what the opaque studio adds (rgb × the composite's own
    // alpha, under (SRC_ALPHA, ONE) blending), so the halo matches the studio.
    // Alpha: the glow's coverage, so the page shows through around it.
    "$1\nfloat glow = max( gl_FragColor.r, max( gl_FragColor.g, gl_FragColor.b ) );\nfloat keep = smoothstep( 0.012, 0.03, glow );\ngl_FragColor = vec4( gl_FragColor.rgb * clamp( gl_FragColor.a, 0.0, 1.0 ) * keep, clamp( glow, 0.0, 1.0 ) * keep );",
  )
  material.needsUpdate = true
  // Composited as a premultiplied overlay (ONE, ONE). Before, the colour was
  // multiplied by the coverage alpha instead (≈ glow²): the halo on the
  // transparent canvas was much weaker than the studio's (measured).
  bloom.blendMaterial.premultipliedAlpha = true
  bloom.blendMaterial.needsUpdate = true
}

/** ShadowMaterial whose opacity falls off radially from Scope's feet. */
function fadingShadowMaterial(fade: { value: THREE.Vector2 }) {
  const material = new THREE.ShadowMaterial({ opacity: 0.4 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uShadowFade = fade
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vFloor;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFloor = position.xy;")
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vFloor;\nuniform vec2 uShadowFade;")
      .replace(
        "gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );",
        "gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * ( 1.0 - smoothstep( uShadowFade.x, uShadowFade.y, length( vFloor ) ) ) );",
      )
  }
  return material
}
