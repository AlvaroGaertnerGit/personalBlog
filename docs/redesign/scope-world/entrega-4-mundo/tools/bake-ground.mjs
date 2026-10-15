// Bakes the ground of the Entrega 4 world from the world's OWN geometry: the
// same two GLBs the browser draws (the approved 1.0 world.glb and the 2.0
// entorno.glb), so the floor Scope walks on is exactly the paper you see.
//
// The rules are the 1.0 exporter's (prototype/tools/export_world.py nav_grid),
// extended to the paper of the 2.0 world around the sheet:
//
//   floor      per 1 cm cell, the walkable surface: the lowest upward-facing
//              surface, climbing stacked layers less than STEP apart (the land
//              under the sheet, the 1.2 mm sheet, his dish, the trails)
//   obstacle   anything between floor + STEP and floor + Scope's height
//              (standing sheets project to lines; nothing over his head counts),
//              a floor step to a neighbour higher than CLIFF, a slope steeper
//              than SLOPE, the ink lake
//   grown      by Scope's radius for him (nav.bin), by the ball's for the ball
//              (solid.bin)
//
//   node docs/redesign/scope-world/entrega-4-mundo/tools/bake-ground.mjs
//   → entrega-4-mundo/assets/ground.json, floor.bin (Float32, Blender z), nav.bin, solid.bin (Uint8, 1 = free)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const world = path.resolve(here, "..", "..")
const OUT = path.resolve(here, "..", "assets")
const SOURCES = [path.join(world, "prototype", "assets", "world.glb"), path.join(world, "entrega-2-entorno", "visor", "assets", "entorno.glb")]

const STEP = 0.01
const REGION = { x0: -1.6, x1: 1.8, y0: -1.25, y1: 1.25 }
const RULES = {
  /** Stacked surfaces closer than this are one floor (m). */
  climb: 0.012,
  /** A neighbour's floor this much higher or lower is a wall (m): the dish (6.7 mm) passes, a book does not. */
  cliff: 0.008,
  /** Over 3 cm, more rise than this is too steep (≈ 22°). */
  slope: 0.012,
  scopeHeight: 0.16,
  scopeRadius: 0.06,
  ballRadius: 0.03,
}
const NX = Math.round((REGION.x1 - REGION.x0) / STEP) + 1
const NY = Math.round((REGION.y1 - REGION.y0) / STEP) + 1
const CELLS = NX * NY

// --- a minimal GLB reader (plain float positions, 16/32-bit indices; both files are) ---------
function readGlb(file) {
  const b = readFileSync(file)
  const jsonLen = b.readUInt32LE(12)
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString("utf8"))
  const binHeader = 20 + jsonLen
  const bin = b.subarray(binHeader + 8, binHeader + 8 + b.readUInt32LE(binHeader))
  const accessor = (i) => {
    const a = json.accessors[i]
    const v = json.bufferViews[a.bufferView]
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]
    const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const stride = v.byteStride ?? 0
    const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array }[a.componentType]
    if (!T || a.normalized || a.sparse) throw new Error(`${path.basename(file)}: unsupported accessor ${i}`)
    if (stride && stride !== comps * T.BYTES_PER_ELEMENT) throw new Error(`${path.basename(file)}: interleaved accessor ${i}`)
    const copy = new Uint8Array(a.count * comps * T.BYTES_PER_ELEMENT)
    copy.set(bin.subarray(offset, offset + copy.length))
    return new T(copy.buffer)
  }
  return { json, accessor }
}

const mul = (a, b) => {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}
function trs(n) {
  if (n.matrix) return n.matrix
  const [tx, ty, tz] = n.translation ?? [0, 0, 0]
  const [qx, qy, qz, qw] = n.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = n.scale ?? [1, 1, 1]
  const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

/** Every triangle of a GLB in Blender coordinates, with its material name. */
function* triangles(file) {
  const { json, accessor } = readGlb(file)
  const visit = function* (ni, parent) {
    const n = json.nodes[ni]
    const m = mul(parent, trs(n))
    if (n.mesh !== undefined) {
      for (const prim of json.meshes[n.mesh].primitives) {
        if ((prim.mode ?? 4) !== 4) continue
        const pos = accessor(prim.attributes.POSITION)
        const idx = prim.indices !== undefined ? accessor(prim.indices) : null
        const mat = prim.material !== undefined ? json.materials[prim.material].name : ""
        const count = idx ? idx.length : pos.length / 3
        const P = (k) => {
          const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2]
          // glTF (y up) → world → Blender (x, -z, y)
          const wx = m[0] * x + m[4] * y + m[8] * z + m[12]
          const wy = m[1] * x + m[5] * y + m[9] * z + m[13]
          const wz = m[2] * x + m[6] * y + m[10] * z + m[14]
          return [wx, -wz, wy]
        }
        for (let t = 0; t + 2 < count; t += 3) {
          const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2
          yield { a: P(a), b: P(b), c: P(c), mat, node: n.name ?? "" }
        }
      }
    }
    for (const c of n.children ?? []) yield* visit(c, m)
  }
  for (const root of json.scenes[json.scene ?? 0].nodes) yield* visit(root, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
}

// --- samples ------------------------------------------------------------------------------------
class Samples {
  constructor() {
    this.cell = new Int32Array(1 << 20)
    this.z = new Float32Array(1 << 20)
    this.n = 0
  }
  push(c, z) {
    if (this.n === this.cell.length) {
      const cell = new Int32Array(this.cell.length * 2)
      cell.set(this.cell)
      const zz = new Float32Array(this.z.length * 2)
      zz.set(this.z)
      this.cell = cell
      this.z = zz
    }
    this.cell[this.n] = c
    this.z[this.n++] = z
  }
  /** Samples grouped by cell: start offsets and z values sorted ascending within each cell. */
  grouped() {
    const start = new Int32Array(CELLS + 1)
    for (let k = 0; k < this.n; k++) start[this.cell[k] + 1]++
    for (let c = 0; c < CELLS; c++) start[c + 1] += start[c]
    const fill = start.slice(0, CELLS)
    const z = new Float32Array(this.n)
    for (let k = 0; k < this.n; k++) z[fill[this.cell[k]]++] = this.z[k]
    for (let c = 0; c < CELLS; c++) z.subarray(start[c], start[c + 1]).sort()
    return { start, z }
  }
}

const cellOf = (x, y) => {
  const i = Math.round((x - REGION.x0) / STEP)
  const j = Math.round((y - REGION.y0) / STEP)
  return i < 0 || j < 0 || i >= NX || j >= NY ? -1 : j * NX + i
}
const up = new Samples() // upward surfaces at cell centres (what can be stood on)
const solid = new Samples() // every surface, sampled (what can block)
const lake = new Uint8Array(CELLS)
const stats = { triangles: 0, inRegion: 0, byMaterial: {} }

for (const file of SOURCES) {
  for (const t of triangles(file)) {
    stats.triangles++
    const { a, b, c, mat } = t
    const minX = Math.min(a[0], b[0], c[0]), maxX = Math.max(a[0], b[0], c[0])
    const minY = Math.min(a[1], b[1], c[1]), maxY = Math.max(a[1], b[1], c[1])
    if (maxX < REGION.x0 || minX > REGION.x1 || maxY < REGION.y0 || minY > REGION.y1) continue
    stats.inRegion++
    const kind = mat.replace(/\.\d+$/, "")
    stats.byMaterial[kind] = (stats.byMaterial[kind] ?? 0) + 1
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    const facing = Math.abs(nz) / len // double-sided paper: either side up
    const isLake = kind.startsWith("Ink_Lake")
    // upward surfaces: exact heights at the cell centres they cover
    if (facing > 0.5 && Math.abs(nz) > 1e-12) {
      const i0 = Math.max(0, Math.ceil((minX - REGION.x0) / STEP)), i1 = Math.min(NX - 1, Math.floor((maxX - REGION.x0) / STEP))
      const j0 = Math.max(0, Math.ceil((minY - REGION.y0) / STEP)), j1 = Math.min(NY - 1, Math.floor((maxY - REGION.y0) / STEP))
      const det = ux * vy - uy * vx
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const px = REGION.x0 + i * STEP - a[0], py = REGION.y0 + j * STEP - a[1]
          const s = (px * vy - py * vx) / det
          const r = (ux * py - uy * px) / det
          if (s < -1e-9 || r < -1e-9 || s + r > 1 + 1e-9) continue
          const z = a[2] + s * uz + r * vz
          const cidx = j * NX + i
          if (isLake) lake[cidx] = 1
          up.push(cidx, z)
        }
    }
    // everything, sampled over its surface (walls are lines from above)
    if (facing <= 0.5) {
      const edge = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]))
      const n = Math.max(1, Math.ceil(edge / (STEP * 0.5)))
      for (let p = 0; p <= n; p++)
        for (let q = 0; q <= n - p; q++) {
          const s = p / n, r = q / n
          const x = a[0] + s * ux + r * vx, y = a[1] + s * uy + r * vy, z = a[2] + s * uz + r * vz
          const cidx = cellOf(x, y)
          if (cidx >= 0) solid.push(cidx, z)
        }
    }
  }
}

// --- floor ----------------------------------------------------------------------------------------
const U = up.grouped()
const S = solid.grouped()
const floor = new Float32Array(CELLS)
const raw = new Uint8Array(CELLS) // 1 = obstacle (before growing)
for (let cidx = 0; cidx < CELLS; cidx++) {
  const a = U.start[cidx], b = U.start[cidx + 1]
  if (a === b) {
    raw[cidx] = 1 // nothing to stand on
    continue
  }
  let f = U.z[a]
  let k = a + 1
  while (k < b && U.z[k] - f <= RULES.climb) f = U.z[k++]
  floor[cidx] = f
  if (lake[cidx]) raw[cidx] = 1
  // anything else between his feet and his head
  for (; k < b; k++) if (U.z[k] - f < RULES.scopeHeight) raw[cidx] = 1
  for (let m = S.start[cidx]; m < S.start[cidx + 1]; m++) {
    const dz = S.z[m] - f
    if (dz > RULES.climb && dz < RULES.scopeHeight) {
      raw[cidx] = 1
      break
    }
  }
}
// walls of floor: steps to a neighbour and steep slopes
const cliff = new Uint8Array(CELLS)
for (let j = 0; j < NY; j++)
  for (let i = 0; i < NX; i++) {
    const c = j * NX + i
    if (raw[c]) continue
    for (const [di, dj, lim] of [[1, 0, RULES.cliff], [0, 1, RULES.cliff], [3, 0, RULES.slope], [0, 3, RULES.slope]]) {
      const ni = i + di, nj = j + dj
      if (ni >= NX || nj >= NY) continue
      const n = nj * NX + ni
      if (raw[n]) continue
      if (Math.abs(floor[n] - floor[c]) > lim) {
        cliff[c] = 1
        cliff[n] = 1
      }
    }
  }
for (let c = 0; c < CELLS; c++) if (cliff[c]) raw[c] = 1

function grow(r) {
  const n = Math.ceil(r / STEP)
  const disk = []
  for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) if (di * di + dj * dj <= (r / STEP) ** 2) disk.push([di, dj])
  const free = new Uint8Array(CELLS).fill(1)
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const border = i < n || j < n || i >= NX - n || j >= NY - n
      if (border) free[j * NX + i] = 0
      if (!raw[j * NX + i]) continue
      for (const [di, dj] of disk) {
        const a = i + di, b = j + dj
        if (a >= 0 && b >= 0 && a < NX && b < NY) free[b * NX + a] = 0
      }
    }
  return free
}
const nav = grow(RULES.scopeRadius)
const ballFree = grow(RULES.ballRadius)

mkdirSync(OUT, { recursive: true })
writeFileSync(path.join(OUT, "floor.bin"), Buffer.from(floor.buffer))
writeFileSync(path.join(OUT, "nav.bin"), Buffer.from(nav.buffer))
writeFileSync(path.join(OUT, "solid.bin"), Buffer.from(ballFree.buffer))
const freeCells = nav.reduce((s, v) => s + v, 0)
const meta = {
  units: "metres, Blender axes; cell (i, j) is (x0 + i·step, y0 + j·step)",
  step: STEP,
  nx: NX,
  ny: NY,
  x0: REGION.x0,
  y0: REGION.y0,
  rules: RULES,
  sources: SOURCES.map((s) => path.relative(world, s).replaceAll("\\", "/")),
  stats: { ...stats, upSamples: up.n, solidSamples: solid.n, walkable: freeCells, walkableM2: +(freeCells * STEP * STEP).toFixed(2) },
}
writeFileSync(path.join(OUT, "ground.json"), JSON.stringify(meta, null, 2))
console.log(`[bake] ${NX}×${NY} cells · ${stats.inRegion}/${stats.triangles} triangles in the region · walkable ${meta.stats.walkableM2} m² → ${path.relative(process.cwd(), OUT)}`)

// a coarse map for the eye (every 4 cm): . free  # blocked  ~ lake
if (process.argv.includes("--map")) {
  const rows = []
  for (let j = NY - 1; j >= 0; j -= 4) {
    let r = (REGION.y0 + j * STEP).toFixed(2).padStart(6) + " "
    for (let i = 0; i < NX; i += 2) r += lake[j * NX + i] ? "~" : nav[j * NX + i] ? "." : "#"
    rows.push(r)
  }
  console.log(rows.join("\n"))
}
