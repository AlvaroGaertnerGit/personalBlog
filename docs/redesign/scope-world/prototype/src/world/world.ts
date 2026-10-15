// The Pliego in three.js: the GLB exported from the approved Blender world,
// its materials rebuilt (materials.ts), the desk, and the two lights of the
// renders — the window (cool, from the left) and the architect lamp (warm,
// the "sun" over the circle). Time of day is reduced to what the prototype
// needs: the loader's night and the dawn of the home, with the lamp coming
// on in between (Entrega 1.5, D: a light transition, never a cut).

import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

import { applyPliegoMaterials, createWorldUniforms, type WorldUniforms } from "./materials.ts"
import { bl, blv, type Floor, type WorldData } from "./world-data.ts"

export interface Tier {
  name: "high" | "medium" | "low"
  shadowMap: number
  lampShadow: boolean
}

interface Mood {
  background: THREE.Color
  hemi: number
  window: number
  windowColor: THREE.Color
  lamp: number
  bulb: number
}

const NIGHT: Mood = {
  background: new THREE.Color(0x070b16),
  hemi: 0.04,
  window: 0.13,
  windowColor: new THREE.Color(0.45, 0.55, 0.95),
  lamp: 0,
  bulb: 0,
}
// dawn: the renders' haze is a cool lavender grey (pliego.py TIMES["dawn"] haze, through AgX)
const DAWN: Mood = {
  background: new THREE.Color(0x5f5d74),
  hemi: 0.9,
  window: 3.0,
  windowColor: new THREE.Color(0.86, 0.88, 1.0),
  // the paper under the lamp must stay below the bloom threshold (post.ts): bright, never blown
  lamp: 4.6,
  bulb: 8,
}

export class PliegoWorld {
  readonly root = new THREE.Group()
  readonly uniforms: WorldUniforms = createWorldUniforms()
  readonly data: WorldData
  readonly floor: Floor
  /** Meshes the pointer can hit (everything but the lamp's arm and the desk). */
  readonly pickables: THREE.Object3D[] = []
  readonly mathview: THREE.Object3D
  readonly card: THREE.Object3D
  readonly stats = { triangles: 0, meshes: 0, bytes: 0 }

  private readonly hemi: THREE.HemisphereLight
  private readonly window: THREE.DirectionalLight
  private readonly lamp: THREE.SpotLight
  private readonly bulbs: THREE.MeshStandardMaterial[]
  private readonly cardRest: THREE.Quaternion
  private readonly cardLift = new THREE.Quaternion()
  private lampLevel = 0
  private cardOpen = 0

  private constructor(gltf: THREE.Group, data: WorldData, floor: Floor, tier: Tier, bytes: number) {
    this.data = data
    this.floor = floor
    this.stats.bytes = bytes
    this.root.add(gltf)

    const { bulbs } = applyPliegoMaterials(gltf, data, this.uniforms)
    this.bulbs = bulbs
    gltf.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      this.stats.meshes++
      const g = o.geometry as THREE.BufferGeometry
      this.stats.triangles += (g.index ? g.index.count : g.attributes.position.count) / 3
      o.castShadow = !/^(Pliego_Sheet|Page_)/.test(o.name)
      o.receiveShadow = true
      o.matrixAutoUpdate = false
      o.updateMatrix()
      if (!/^(Cylinder|Sphere|Cone|Torus)/.test(o.name)) this.pickables.push(o)
    })
    this.mathview = gltf.getObjectByName("MathView")!
    this.card = gltf.getObjectByName("Card_MathView")!
    this.card.matrixAutoUpdate = true
    this.cardRest = this.card.quaternion.clone()

    // the desk: the dark the sheet lies on (the loader's night)
    const desk = new THREE.Mesh(
      new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(0.012, 0.014, 0.024), roughness: 0.45 }),
    )
    desk.position.y = -0.0035
    desk.receiveShadow = true
    this.root.add(desk)

    this.hemi = new THREE.HemisphereLight(new THREE.Color(0.62, 0.66, 0.8), new THREE.Color(0.22, 0.19, 0.16), 0)
    this.root.add(this.hemi)

    // the window: far to the left and a little behind (pliego.py WINDOW_DIR)
    const toWindow = blv(data.window_dir).normalize()
    this.window = new THREE.DirectionalLight(0xffffff, 0)
    this.window.position.copy(toWindow).multiplyScalar(3)
    this.window.target.position.set(0, 0, 0)
    this.window.castShadow = true
    this.window.shadow.mapSize.setScalar(tier.shadowMap)
    const cam = this.window.shadow.camera
    cam.left = -1.25
    cam.right = 1.25
    cam.top = 1.0
    cam.bottom = -1.0
    cam.near = 1
    cam.far = 5.5
    this.window.shadow.bias = -0.0004
    this.window.shadow.normalBias = 0.002
    this.window.shadow.radius = 3
    this.root.add(this.window, this.window.target)

    // the lamp: its head is the sun over the circle
    const head = blv(data.lamp.head)
    this.lamp = new THREE.SpotLight(new THREE.Color(1.0, 0.76, 0.5), 0, 4, 0.42, 0.55, 2)
    this.lamp.position.copy(head)
    this.lamp.target.position.copy(bl(data.pool.x, data.pool.y, 0))
    this.lamp.castShadow = tier.lampShadow
    this.lamp.shadow.mapSize.setScalar(Math.min(1024, tier.shadowMap))
    this.lamp.shadow.bias = -0.0005
    this.lamp.shadow.normalBias = 0.002
    this.lamp.shadow.radius = 4
    this.root.add(this.lamp, this.lamp.target)
  }

  static async load(url: string, data: WorldData, floor: Floor, tier: Tier) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`world.glb: ${res.status}`)
    const buffer = await res.arrayBuffer()
    const gltf = await new GLTFLoader().parseAsync(buffer, "")
    return new PliegoWorld(gltf.scene, data, floor, tier, buffer.byteLength)
  }

  /** Night (0) -> dawn with the lamp on (1). */
  setLamp(level: number, scene: THREE.Scene) {
    this.lampLevel = THREE.MathUtils.clamp(level, 0, 1)
    const t = this.lampLevel
    // the lamp's filament comes up first, the room follows
    const lampT = THREE.MathUtils.smoothstep(t, 0, 0.45)
    const roomT = THREE.MathUtils.smoothstep(t, 0.2, 1)
    this.lamp.intensity = DAWN.lamp * lampT
    this.hemi.intensity = THREE.MathUtils.lerp(NIGHT.hemi, DAWN.hemi, roomT)
    this.window.intensity = THREE.MathUtils.lerp(NIGHT.window, DAWN.window, roomT)
    this.window.color.copy(NIGHT.windowColor).lerp(DAWN.windowColor, roomT)
    for (const b of this.bulbs) b.emissiveIntensity = DAWN.bulb * lampT
    this.uniforms.uLamp.value = lampT
    const bg = (scene.background as THREE.Color) ?? new THREE.Color()
    bg.copy(NIGHT.background).lerp(DAWN.background, roomT)
    scene.background = bg
    scene.environmentIntensity = THREE.MathUtils.lerp(0.03, 0.16, roomT)
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(bg)
  }

  get lampOn() {
    return this.lampLevel
  }

  /** MathView's card leans up toward the visitor while the project is open (0..1). */
  setCardOpen(t: number) {
    this.cardOpen = t
    // hinge = the card's bottom edge (panel origin); lean it back up to ~70°
    this.cardLift.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-58) * t)
    this.card.quaternion.copy(this.cardRest).multiply(this.cardLift)
    this.card.position.y = this.cardBaseY() + 0.006 * Math.sin(Math.PI * t)
  }

  private cardY: number | null = null
  private cardBaseY() {
    if (this.cardY === null) this.cardY = this.card.position.y
    return this.cardY
  }

  get cardOpenness() {
    return this.cardOpen
  }

  /** Top-centre of MathView, three.js world space. */
  mathviewTop(out = new THREE.Vector3()) {
    const d = this.data.mathview
    return out.copy(bl(d.x, d.y, 0)).setY(this.floor.at(d.x, -d.y) + 0.01)
  }

  /** Four corners of the card (world space), for the HTML sheet to unfold from. */
  cardCorners() {
    const box = new THREE.Box3().setFromObject(this.card)
    const c = box.getCenter(new THREE.Vector3())
    const s = box.getSize(new THREE.Vector3())
    return { center: c, size: s }
  }
}
