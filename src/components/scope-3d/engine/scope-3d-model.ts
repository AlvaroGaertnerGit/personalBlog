// Loads the real Scope GLB and prepares it for the stage — without touching
// its proportions, rig or clips.

import * as THREE from "three"
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js"

import { applyScopeCeramic } from "./scope-3d-ceramic.ts"

/** See the Scope_FaceGlass note in loadScope3DModel. */
const GLASS_COAT_ROUGHNESS = 0.3

export interface Scope3DModel {
  gltf: GLTF
  root: THREE.Object3D
  meshes: THREE.Mesh[]
  stats: {
    bytes: number
    /** Download time (network / route handler). */
    fetchMs: number
    /** GLTFLoader parse time. */
    parseMs: number
    triangles: number
    vertices: number
    joints: number
    morphTargets: string[]
  }
  /** Toggle the procedural mineral grain on the ceramic parts. */
  setGrain(on: boolean): void
}

export type Scope3DLoadProgress = (loaded: number, total: number | null) => void

async function download(url: string, onProgress: Scope3DLoadProgress, signal?: AbortSignal) {
  const res = await fetch(url, { signal })
  if (!res.ok || !res.body) throw new Error(`GLB request failed: ${res.status} ${res.statusText}`)
  const total = Number(res.headers.get("content-length")) || null
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress(loaded, total)
  }
  const buffer = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }
  return buffer.buffer
}

export async function loadScope3DModel(
  url: string,
  onProgress: Scope3DLoadProgress = () => {},
  signal?: AbortSignal,
): Promise<Scope3DModel> {
  const t0 = performance.now()
  const data = await download(url, onProgress, signal)
  const t1 = performance.now()
  const gltf = await new GLTFLoader().parseAsync(data, "")
  const t2 = performance.now()

  const meshes: THREE.Mesh[] = []
  const ceramics = new Set<THREE.MeshStandardMaterial>()
  let triangles = 0
  let vertices = 0
  const joints = new Set<THREE.Bone>()
  const morphTargets = new Set<string>()

  gltf.scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    meshes.push(obj)
    obj.castShadow = true
    obj.receiveShadow = true
    // Skinned bounds are computed in bind pose; a bounce would cull the model.
    obj.frustumCulled = false
    const geo = obj.geometry as THREE.BufferGeometry
    vertices += geo.attributes.position.count
    triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3
    if (obj instanceof THREE.SkinnedMesh) obj.skeleton.bones.forEach((b) => joints.add(b))
    Object.keys(obj.morphTargetDictionary ?? {}).forEach((name) => morphTargets.add(name))
    const mat = obj.material as THREE.MeshStandardMaterial
    if (mat.name === "Scope_Ceramic") ceramics.add(mat)
    if (mat instanceof THREE.MeshPhysicalMaterial && mat.name === "Scope_FaceGlass") {
      // Blender lights the glass with large area lights, so its 0.16 coat reads
      // as broad soft gradients. The stage's punctual lights turn the same
      // coat into a crisp white arc under the eyes (reads as a mouth when
      // Scope turns). 0.3 restores the intended soft gradient.
      mat.clearcoatRoughness = GLASS_COAT_ROUGHNESS
    }
  })

  const grains = [...ceramics].map(applyScopeCeramic)

  return {
    gltf,
    root: gltf.scene,
    meshes,
    stats: {
      bytes: data.byteLength,
      fetchMs: t1 - t0,
      parseMs: t2 - t1,
      triangles,
      vertices,
      joints: joints.size,
      morphTargets: [...morphTargets],
    },
    setGrain(on) {
      grains.forEach((g) => g.setEnabled(on))
    },
  }
}

export function disposeScope3DModel(model: Scope3DModel) {
  model.root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    obj.geometry.dispose()
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    mats.forEach((m) => m.dispose())
  })
}
