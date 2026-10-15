// The Pliego's materials in the browser. The GLB carries plain glTF
// materials plus `extras` describing the Cycles original (kind, tint, ruled,
// fired); this file rebuilds them as MeshStandardMaterial patches with the
// same world rules as docs/scope-world/blender/pliego.py:
//
//   paper     tint × handwriting image; ruled lines + the vermilion margin on
//             the sheet; inside the lamp's pool it is FIRED (porcelain mix,
//             lower roughness) with a toasted ring just outside the edge.
//   page      one face of a book page (front or back image), single-sided.
//   mathview  celadon glaze with the graph grid fired in (object space) and
//             level curves that glow amber when the project is opened.
//   solid     plain glaze / enamel.
//
// Approximations (documented in README): no subsurface/translucency (paper
// back-light), no coat layer (roughness only), noise edge of the pool is a
// cheap value noise instead of Blender's fBm.

import * as THREE from "three"

import type { WorldData } from "./world-data.ts"

interface Extras {
  kind?: "paper" | "page" | "solid" | "mathview"
  tint?: number[]
  ruled?: boolean
  fired?: boolean
  rough?: number
  coat?: number
  metal?: number
  emission?: number[]
  lines?: number[]
  side?: "front" | "back"
  source?: string
}

const PORCELAIN = new THREE.Color(0.86, 0.83, 0.76)
const TOAST = new THREE.Color(0.36, 0.2, 0.09)

export interface WorldUniforms {
  /** 0 = loader night, 1 = lamp fully on: the toasted ring only "glows" with the light. */
  uLamp: { value: number }
  /** MathView's contour lines (0..1) and how far their reveal has travelled (m). */
  uContours: { value: number }
  uReveal: { value: number }
  uRevealOrigin: { value: THREE.Vector3 }
  /** Hover feedback on MathView (0..1). */
  uHover: { value: number }
}

export function createWorldUniforms(): WorldUniforms {
  return {
    uLamp: { value: 0 },
    uContours: { value: 0 },
    uReveal: { value: 0 },
    uRevealOrigin: { value: new THREE.Vector3() },
    uHover: { value: 0 },
  }
}

const NOISE = /* glsl */ `
float pliegoHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pliegoNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pliegoHash(i), pliegoHash(i + vec2(1, 0)), f.x),
             mix(pliegoHash(i + vec2(0, 1)), pliegoHash(i + vec2(1, 1)), f.x), f.y);
}
float pliegoFbm(vec2 p) {
  return 0.55 * pliegoNoise(p) + 0.3 * pliegoNoise(p * 2.03) + 0.15 * pliegoNoise(p * 4.1);
}
`

function paperMaterial(src: THREE.MeshStandardMaterial, x: Extras, world: WorldData, u: WorldUniforms) {
  const m = new THREE.MeshStandardMaterial({
    name: src.name,
    map: src.map,
    color: new THREE.Color().fromArray(x.tint ?? [0.8, 0.77, 0.7]),
    roughness: 0.88,
    metalness: 0,
    side: THREE.FrontSide,
  })
  if (m.map) {
    m.map.colorSpace = THREE.SRGBColorSpace
    m.map.anisotropy = 4
  }
  const ruled = x.ruled ? 1 : 0
  const fired = x.fired === false ? 0 : 1
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLamp = u.uLamp
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPliego;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvPliego = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vPliego;
uniform float uLamp;
${NOISE}
float pliegoFired = 0.0;`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
{
  // Blender coordinates of this fragment: x, y = -z
  vec2 p = vec2(vPliego.x, -vPliego.z);
  float aa = max(fwidth(p.y), 1e-5);
  if (${ruled.toFixed(1)} > 0.5) {
    // ruled lines (pale grey-blue) under the sheet's top band, and the vermilion margin
    float d = abs(fract(p.y / ${world.rule.toFixed(4)} + 0.5) - 0.5) * ${world.rule.toFixed(4)};
    float line = 1.0 - smoothstep(0.00035, 0.00035 + aa * 1.5, d);
    line *= step(p.y, ${(world.sheet.y - 0.085).toFixed(4)});
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.50, 0.62), line * 0.55);
    float mx = abs(p.x - (${world.margin_x.toFixed(4)}));
    float margin = 1.0 - smoothstep(0.0014, 0.0014 + aa * 1.5, mx);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.12, 0.08), margin * 0.8);
  }
  if (${fired.toFixed(1)} > 0.5) {
    // the lamp's law: inside its pool paper is fired into porcelain
    float d = length(p - vec2(${world.pool.x.toFixed(4)}, ${world.pool.y.toFixed(4)}))
      + pliegoFbm(p * 7.0) * 0.09 - 0.045;
    float r = ${world.pool.r.toFixed(4)};
    pliegoFired = smoothstep(r + 0.012, r - 0.012, d);
    float band = max(smoothstep(r + 0.03, r + 0.008, d) - pliegoFired, 0.0);
    vec3 porcelain = mix(diffuseColor.rgb, vec3(${PORCELAIN.toArray().map((v) => v.toFixed(3)).join(",")}), 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, porcelain, pliegoFired);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${TOAST.toArray().map((v) => v.toFixed(3)).join(",")}), band * 0.85);
  }
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.32, pliegoFired);",
      )
  }
  m.customProgramCacheKey = () => `paper-${ruled}-${fired}`
  return m
}

function mathviewMaterial(src: THREE.MeshStandardMaterial, x: Extras, u: WorldUniforms) {
  const m = new THREE.MeshStandardMaterial({
    name: src.name,
    color: new THREE.Color().fromArray(x.tint ?? [0.46, 0.58, 0.52]),
    roughness: 0.24,
    metalness: 0,
    side: THREE.FrontSide,
  })
  const lines = new THREE.Color().fromArray(x.lines ?? [0.3, 0.4, 0.36])
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uContours: u.uContours,
      uReveal: u.uReveal,
      uRevealOrigin: u.uRevealOrigin,
      uHover: u.uHover,
    })
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMvLocal;\nvarying vec3 vMvWorld;\nvarying float vMvUp;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
vMvLocal = transformed;
vMvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vMvUp = normalize(mat3(modelMatrix) * objectNormal).y;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vMvLocal;
varying vec3 vMvWorld;
varying float vMvUp;
uniform float uContours;
uniform float uReveal;
uniform vec3 uRevealOrigin;
uniform float uHover;
float mvGlow = 0.0;`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
{
  // the graph grid fired into the glaze (object space, 2 cm)
  vec2 g = vMvLocal.xz / 0.02;
  vec2 w = fwidth(g);
  vec2 gl = 1.0 - smoothstep(vec2(0.0), w * 1.5 + 0.03, abs(fract(g + 0.5) - 0.5));
  float grid = max(gl.x, gl.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${lines.toArray().map((v) => v.toFixed(3)).join(",")}), grid * 0.8);
  // level curves every 4.5 mm of height, only on the top surface
  float h = vMvLocal.y / 0.0045;
  float hw = max(fwidth(h), 1e-4);
  float contour = 1.0 - smoothstep(0.0, hw * 1.6 + 0.04, abs(fract(h + 0.5) - 0.5));
  float top = smoothstep(0.5, 0.8, vMvUp);
  float dist = length(vMvWorld.xz - uRevealOrigin.xz);
  float front = smoothstep(uReveal, uReveal - 0.05, dist);
  float wave = exp(-pow((dist - uReveal) / 0.018, 2.0)) * step(0.001, uReveal) * (1.0 - step(0.6, uReveal));
  mvGlow = contour * top * (uContours * front + uHover * 0.35) + wave * top * 0.6 * uContours;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.78, 0.45), mvGlow * 0.55);
}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.62, 0.26) * mvGlow * 1.6;",
      )
  }
  m.customProgramCacheKey = () => "mathview"
  return m
}

function solidMaterial(src: THREE.MeshStandardMaterial, x: Extras) {
  const m = new THREE.MeshStandardMaterial({
    name: src.name,
    color: new THREE.Color().fromArray(x.tint ?? [0.8, 0.8, 0.8]),
    // Cycles' coat reads as a sharper highlight; standard PBR has no coat layer.
    roughness: Math.max(0.12, (x.rough ?? 0.5) * (1 - 0.35 * (x.coat ?? 0))),
    metalness: x.metal ?? 0,
    side: THREE.FrontSide,
  })
  if (x.emission) {
    m.emissive.fromArray(x.emission)
    m.emissiveIntensity = 0
    m.userData.bulb = true
  }
  return m
}

/** Swap every glTF material of the world for its Pliego rebuild. */
export function applyPliegoMaterials(root: THREE.Object3D, world: WorldData, u: WorldUniforms) {
  const cache = new Map<string, THREE.Material>()
  const bulbs: THREE.MeshStandardMaterial[] = []
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    const src = o.material as THREE.MeshStandardMaterial
    let m = cache.get(src.name)
    if (!m) {
      const x = (src.userData ?? {}) as Extras
      if (x.kind === "paper" || x.kind === "page") m = paperMaterial(src, x, world, u)
      else if (x.kind === "mathview") m = mathviewMaterial(src, x, u)
      else m = solidMaterial(src, x)
      if (m instanceof THREE.MeshStandardMaterial && m.userData.bulb) bulbs.push(m)
      cache.set(src.name, m)
      src.dispose()
    }
    o.material = m
  })
  return { bulbs }
}
