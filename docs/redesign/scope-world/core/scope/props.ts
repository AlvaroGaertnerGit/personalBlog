// The things Scope acts on, and how they answer. Nothing here plays an
// animation: every response comes from a cause the visitor can see.
//
//   ball        a crumpled paper ball. 2D rigid body: rolling friction, bounces
//               off solid things; Scope's body is a moving collider, so it
//               moves exactly as much as he pushes it (impulse from his real
//               velocity at contact) — and also if he bumps it by accident
//   radiometer  a light-mill. The vanes' torque is the light falling on the bulb:
//               Scope's spotlight (the same cone the renderer draws) plus the
//               desk lamp's share in the mood. Drag and static friction: it
//               spins up, coasts and stops
//   flower      a kirigami bud that STORES light: charge = ∫ irradiance − leak.
//               Petals open with the charge (a stiff spring: a little pop); full,
//               its seed glows and it stays open a while after the light goes

import * as THREE from "three"

import { bl } from "../../prototype/src/world/world-data.ts"
import type { P2, Places } from "../world-def.ts"
import type { Ground } from "./ground.ts"

export interface ScopeLight {
  /** World position and unit direction of his face light (three.js). */
  pos: THREE.Vector3
  dir: THREE.Vector3
  /** 0..1 */
  level: number
  angle: number
  penumbra: number
}

/** Irradiance (lab units: an on-axis beam at full level gives 1/d²) from his light at a world point. */
export function irradiance(light: ScopeLight, at: THREE.Vector3) {
  const to = at.clone().sub(light.pos)
  const d2 = to.lengthSq() + 1e-4
  const cos = to.normalize().dot(light.dir)
  // three.js spot cone: smoothstep(cos(angle), cos(angle·(1−penumbra)), cosθ)
  const outer = Math.cos(light.angle)
  const inner = Math.cos(light.angle * (1 - light.penumbra))
  const t = THREE.MathUtils.clamp((cos - outer) / Math.max(inner - outer, 1e-4), 0, 1)
  const cone = t * t * (3 - 2 * t)
  return (light.level * cone) / d2
}

const paperMat = (rgb: [number, number, number], rough = 0.9) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace), roughness: rough, side: THREE.DoubleSide })

// --- the ball -------------------------------------------------------------------------
export class Ball {
  readonly mesh: THREE.Mesh
  readonly at: [number, number]
  readonly vel: [number, number] = [0, 0]
  /** Last contact with Scope: when and how hard (m/s given to the ball). */
  lastHit = { t: -Infinity, dv: 0 }
  private readonly ground: Ground
  private readonly spec: Places["ball"]
  private readonly q = new THREE.Quaternion()
  private readonly axis = new THREE.Vector3()

  constructor(ground: Ground, spec: Places["ball"]) {
    this.ground = ground
    this.spec = spec
    const BALL = spec
    this.at = [BALL.start[0], BALL.start[1]]
    // crumpled: an icosphere pushed in and out along its normals
    const g = new THREE.IcosahedronGeometry(BALL.radius, 3)
    const p = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const n = v.clone().normalize()
      const crease = Math.sin(n.x * 13.1 + n.y * 7.7) * Math.sin(n.y * 11.3 - n.z * 9.1) * Math.sin(n.z * 8.3 + n.x * 5.9)
      v.copy(n).multiplyScalar(BALL.radius * (1 + 0.11 * crease))
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.88, 0.85, 0.79, THREE.SRGBColorSpace), roughness: 0.95, flatShading: true })
    this.mesh = new THREE.Mesh(g, m)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.name = "Lab_Ball"
    this.sync(0)
  }

  get speed() {
    return Math.hypot(this.vel[0], this.vel[1])
  }

  /** Scope's body as a moving circle (Blender 2D): centre, velocity, radius. */
  step(dt: number, now: number, scope: { c: P2; v: P2; r: number }) {
    // contact with Scope: a kinematic pusher (he is much heavier)
    const dx = this.at[0] - scope.c[0]
    const dy = this.at[1] - scope.c[1]
    const d = Math.hypot(dx, dy)
    const minD = this.spec.radius + scope.r
    if (d < minD && d > 1e-6) {
      const nx = dx / d
      const ny = dy / d
      // push out of the overlap
      this.at[0] = scope.c[0] + nx * minD
      this.at[1] = scope.c[1] + ny * minD
      const rel = (scope.v[0] - this.vel[0]) * nx + (scope.v[1] - this.vel[1]) * ny
      if (rel > 0) {
        const e = 0.35 // paper: a soft, short bounce
        const dv = (1 + e) * rel
        this.vel[0] += dv * nx
        this.vel[1] += dv * ny
        if (dv > 0.02) this.lastHit = { t: now, dv }
      }
    }
    // rolling friction + air: it slows down and stops
    const s = this.speed
    if (s > 0) {
      const drop = (0.32 + 1.1 * s) * dt
      const k = Math.max(0, s - drop) / s
      this.vel[0] *= k
      this.vel[1] *= k
      if (this.speed < 0.004) this.vel[0] = this.vel[1] = 0
    }
    // move, bouncing off solid things (axis by axis)
    const nx = this.at[0] + this.vel[0] * dt
    if (this.ground.ballBlocked([nx, this.at[1]])) this.vel[0] *= -0.4
    else this.at[0] = nx
    const ny = this.at[1] + this.vel[1] * dt
    if (this.ground.ballBlocked([this.at[0], ny])) this.vel[1] *= -0.4
    else this.at[1] = ny
    this.sync(dt)
  }

  private sync(dt: number) {
    const z = this.ground.height(this.at)
    this.mesh.position.copy(bl(this.at[0], this.at[1], z + this.spec.radius))
    // roll: rotation about the horizontal axis perpendicular to the motion, angle = distance / r
    const s = this.speed
    if (s > 1e-5 && dt > 0) {
      const v = bl(this.vel[0], this.vel[1], 0)
      this.axis.set(0, 1, 0).cross(v).normalize()
      this.q.setFromAxisAngle(this.axis, (s * dt) / this.spec.radius)
      this.mesh.quaternion.premultiply(this.q)
    }
  }

  reset() {
    this.at[0] = this.spec.start[0]
    this.at[1] = this.spec.start[1]
    this.vel[0] = this.vel[1] = 0
    this.sync(0)
  }
}

// --- the radiometer -----------------------------------------------------------------
export class Radiometer {
  readonly group = new THREE.Group()
  /** Rad/s. */
  omega = 0
  /** Irradiance on the bulb this frame (lab units), split by source. */
  readonly light = { scope: 0, lamp: 0 }
  private readonly vanes = new THREE.Group()
  private readonly bulbCenter: THREE.Vector3

  constructor(z0: number, spec: Places["radiometer"]) {
    const RADIOMETER = spec
    const [x, y] = RADIOMETER.at
    this.group.name = "Lab_Radiometer"
    const porcelain = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.86, 0.83, 0.76, THREE.SRGBColorSpace), roughness: 0.25 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.016, 48), porcelain)
    base.position.copy(bl(x, y, z0 + 0.008))
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 16), porcelain)
    stem.position.copy(bl(x, y, z0 + 0.028))
    this.bulbCenter = bl(x, y, z0 + RADIOMETER.bulbZ)
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.18, envMapIntensity: 1.6, clearcoat: 1, depthWrite: false })
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(RADIOMETER.bulbR, 48, 24), glass)
    bulb.position.copy(this.bulbCenter)
    bulb.renderOrder = 2
    const white = new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.5 })
    const black = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.6 })
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.05, 8), white)
    spindle.position.copy(this.bulbCenter)
    this.vanes.position.copy(this.bulbCenter)
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + 0.4
      // each vane: white on one face, black on the other (two thin plates)
      for (const [face, mat] of [[1, white], [-1, black]] as const) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.014, 0.014), mat)
        plate.position.set(0.017 * Math.cos(a) + 0.0003 * face * -Math.sin(a), 0, -0.017 * Math.sin(a) + 0.0003 * face * -Math.cos(a))
        plate.rotation.y = a
        this.vanes.add(plate)
      }
    }
    for (const m of [base, stem, bulb, spindle]) {
      m.castShadow = m !== bulb
      m.receiveShadow = true
      this.group.add(m)
    }
    // three shards of porcelain he has set around it as mirrors (Fase A §8.4; entorno.py,
    // brought in to 5 cm so he can stand close enough to light it)
    const mirror = new THREE.MeshStandardMaterial({ color: 0xe6dccb, roughness: 0.05, metalness: 1, envMapIntensity: 1.2 })
    for (const [dx, dy, ang] of [[-0.044, -0.012, 0.6], [-0.03, 0.038, -0.4], [0.018, 0.047, 1.2]] as const) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.02, 0.002), mirror)
      shard.position.copy(bl(x + dx, y + dy, z0 + 0.012))
      shard.rotation.set(THREE.MathUtils.degToRad(-20), ang, 0, "YXZ")
      shard.castShadow = true
      this.group.add(shard)
    }
    this.group.add(this.vanes)
  }

  /** What Scope aims at. */
  get target() {
    return this.bulbCenter
  }

  get salience() {
    return Math.min(1, Math.abs(this.omega) / 7)
  }

  step(dt: number, scope: ScopeLight, lampLevel: number) {
    this.light.scope = irradiance(scope, this.bulbCenter)
    this.light.lamp = lampLevel
    const E = this.light.scope + this.light.lamp
    // torque ∝ light; viscous drag of the residual gas; a little static friction
    const torque = 0.085 * E
    if (this.omega < 0.05 && torque < 0.2) this.omega = 0 // not enough light to break it free
    else this.omega = Math.max(0, this.omega + (torque - 0.36 * this.omega - 0.1) * dt)
    this.vanes.rotation.y += this.omega * dt
  }
}

// --- the light flower ---------------------------------------------------------------
export class Flower {
  readonly group = new THREE.Group()
  /** Stored light, 0..1.2. */
  charge = 0
  /** Fully open and glowing (latched until the charge leaks below 0.3). */
  bloomed = false
  irradiance = 0
  private readonly petals: { pivot: THREE.Group; delay: number; spring: { x: number; v: number } }[] = []
  private readonly seed: THREE.Mesh
  private readonly seedMat: THREE.MeshStandardMaterial
  private readonly center: THREE.Vector3
  private bloomPulse = 0
  /** Fired once each time it opens fully. */
  onBloom: () => void = () => {}

  constructor(z0: number, spec: Places["flower"]) {
    const FLOWER = spec
    const [x, y] = FLOWER.at
    this.group.name = "Lab_Flower"
    this.group.position.copy(bl(x, y, z0))
    const paper = paperMat([0.9, 0.87, 0.8])
    const base = new THREE.Mesh(new THREE.CylinderGeometry(FLOWER.baseR, FLOWER.baseR * 1.05, 0.004, 40), paperMat([0.82, 0.79, 0.72]))
    base.position.y = 0.002
    base.receiveShadow = true
    this.group.add(base)
    // a pointed petal, 4 cm, hinged at its foot
    const shape = new THREE.Shape()
    shape.moveTo(-0.004, 0)
    shape.quadraticCurveTo(-0.013, 0.02, 0, 0.04)
    shape.quadraticCurveTo(0.013, 0.02, 0.004, 0)
    shape.lineTo(-0.004, 0)
    const petalGeo = new THREE.ShapeGeometry(shape, 10)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      const holder = new THREE.Group()
      holder.rotation.y = a
      holder.position.y = 0.004
      const pivot = new THREE.Group()
      pivot.position.z = 0.006
      const petal = new THREE.Mesh(petalGeo, paper)
      petal.castShadow = true
      petal.receiveShadow = true
      pivot.add(petal)
      holder.add(pivot)
      this.group.add(holder)
      this.petals.push({ pivot, delay: k * 0.04, spring: { x: 0, v: 0 } })
    }
    this.seedMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.92, 0.88, 0.78, THREE.SRGBColorSpace), roughness: 0.3, emissive: new THREE.Color(1, 0.72, 0.38), emissiveIntensity: 0 })
    this.seed = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 24, 12), this.seedMat)
    this.seed.position.y = 0.011
    this.group.add(this.seed)
    this.center = this.group.position.clone().add(new THREE.Vector3(0, 0.022, 0))
    this.pose()
  }

  get target() {
    return this.center
  }

  get openness() {
    return this.petals.reduce((s, p) => s + p.spring.x, 0) / this.petals.length
  }

  get salience() {
    return Math.max(this.bloomPulse, Math.min(1, Math.abs(this.petals[0].spring.v) * 0.6))
  }

  step(dt: number, scope: ScopeLight, ambient: number) {
    this.irradiance = irradiance(scope, this.center) + ambient * 0.2
    const E = this.irradiance
    // stores what it receives; leaks slowly in the dark (faster once it is not glowing)
    const leak = E < 4 ? (this.bloomed ? 0.07 : 0.16) : 0
    this.charge = THREE.MathUtils.clamp(this.charge + (0.0045 * E - leak) * dt, 0, 1.2)
    if (!this.bloomed && this.charge >= 1) {
      this.bloomed = true
      this.bloomPulse = 1
      this.onBloom()
    }
    if (this.bloomed && this.charge < 0.3) this.bloomed = false
    this.bloomPulse = Math.max(0, this.bloomPulse - dt / 2.5)
    const target = this.bloomed ? 1 : THREE.MathUtils.smoothstep(this.charge, 0.12, 1) * 0.75
    for (const p of this.petals) {
      // stiff, slightly under-damped: the opening snaps and settles; petals a beat apart
      const goal = THREE.MathUtils.clamp((target - p.delay * 0.6) / (1 - p.delay * 0.6), 0, 1)
      for (let t = 0; t < dt - 1e-9; t += 1 / 240) {
        const h = Math.min(1 / 240, dt - t)
        p.spring.v += (90 * (goal - p.spring.x) - 9 * p.spring.v) * h
        p.spring.x += p.spring.v * h
      }
    }
    this.seedMat.emissiveIntensity = (this.bloomed ? 1.4 : 0) * Math.min(1, this.charge) + this.bloomPulse * 1.2
    this.pose()
  }

  private pose() {
    // closed: petals stand up and lean in (a bud); open: they spread out low
    for (const p of this.petals) {
      const o = THREE.MathUtils.clamp(p.spring.x, -0.1, 1.1)
      p.pivot.rotation.x = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-8, 62, o))
    }
  }
}
