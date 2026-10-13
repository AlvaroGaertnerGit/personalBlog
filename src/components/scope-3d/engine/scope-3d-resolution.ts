// Scope 3D resolution: how many pixels Scope is rendered with, and how they
// reach the canvas (reports/POLISH_REVIEW.md §1).
//
// The canvas backing store is always the exact device-pixel size of its CSS
// box, so the browser never rescales it. Sharpness comes from rendering the
// scene at `ssaa`× that size and resolving it here, AFTER tone mapping:
//   - MSAA alone resolves in linear HDR, before tone mapping. An eye edge
//     (HDR ~3–4) over the dark glass (~0) averages to ~1, which AgX maps to
//     nearly full white: high-contrast edges stay stair-stepped and crawl.
//   - MSAA never touches shading (procedural grain, specular): supersampling does.
// Measured at 160 px against an 8× reference (LookAround): MSAA ×4 alone
// 196 crawling px/frame; + SSAA 2× 86; + SSAA 3× 56; 4× 52 (diminishing).

import * as THREE from "three"
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js"

export interface Scope3DQuality {
  /** Canvas backing-store pixels per CSS pixel (= devicePixelRatio unless over budget). */
  pixelRatio: number
  /** Supersampling factor per axis on top of pixelRatio (1 = off). */
  ssaa: number
}

export interface Scope3DResolutionPolicy {
  /** Highest supersampling factor per axis. */
  maxSsaa: number
  /** Highest total scale per CSS pixel (pixelRatio × ssaa). */
  maxScale: number
  /** Most internal pixels per frame: width × height × (pixelRatio × ssaa)². */
  budget: number
}

/** Desktop: a 160 px slot at 1× renders 480², the full studio ~1000×800 at 2×. */
const DESKTOP: Scope3DResolutionPolicy = { maxSsaa: 3, maxScale: 4, budget: 4_200_000 }
/** Touch devices: a 160 px slot on a 3× phone renders 480², no supersampling needed. */
const MOBILE: Scope3DResolutionPolicy = { maxSsaa: 3, maxScale: 4, budget: 1_600_000 }

export function defaultResolutionPolicy(): Scope3DResolutionPolicy {
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  return coarse ? MOBILE : DESKTOP
}

/**
 * Highest quality that fits the policy. Supersampling goes first; the canvas
 * only drops below the device pixel ratio when even 1× is over budget (a
 * full-window canvas on a 3× phone), never for the small web slots.
 */
export function chooseQuality(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  policy: Scope3DResolutionPolicy,
): Scope3DQuality {
  const area = Math.max(1, cssWidth * cssHeight)
  const dpr = Math.max(1, devicePixelRatio)
  for (let ssaa = policy.maxSsaa; ssaa >= 1; ssaa--) {
    const scale = dpr * ssaa
    if ((ssaa === 1 || scale <= policy.maxScale) && area * scale * scale <= policy.budget) {
      return { pixelRatio: dpr, ssaa }
    }
  }
  return { pixelRatio: Math.max(1, Math.sqrt(policy.budget / area)), ssaa: 1 }
}

// GLSL ES 3.00 (texelFetch): three adds only `#version 300 es` to a GLSL3 raw shader.
const FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D tDiffuse;
uniform int uFactor;
out vec4 outColor;

#include <tonemapping_pars_fragment>
#include <colorspace_pars_fragment>

vec3 scopeToneMap(vec3 color) {
  #if defined( AGX_TONE_MAPPING )
    return AgXToneMapping(color);
  #elif defined( ACES_FILMIC_TONE_MAPPING )
    return ACESFilmicToneMapping(color);
  #elif defined( NEUTRAL_TONE_MAPPING )
    return NeutralToneMapping(color);
  #elif defined( REINHARD_TONE_MAPPING )
    return ReinhardToneMapping(color);
  #elif defined( LINEAR_TONE_MAPPING )
    return LinearToneMapping(color);
  #else
    return color;
  #endif
}

void main() {
  // Output pixel -> its uFactor × uFactor block of internal texels (exact box filter).
  ivec2 base = ivec2(gl_FragCoord.xy) * uFactor;
  vec4 sum = vec4(0.0);
  for (int y = 0; y < 4; y++) {
    if (y >= uFactor) break;
    for (int x = 0; x < 4; x++) {
      if (x >= uFactor) break;
      vec4 c = texelFetch(tDiffuse, base + ivec2(x, y), 0);
      // The bloom is added on top of the scene, alpha included: on the eyes
      // alpha exceeds 1 in the float target. Coverage is 0..1.
      float a = clamp(c.a, 0.0, 1.0);
      // The scene is premultiplied (transparent canvas): tone map the colour, not colour × coverage.
      vec3 rgb = a > 1e-5 ? c.rgb / a : vec3(0.0);
      sum += vec4(scopeToneMap(rgb) * a, a);
    }
  }
  sum /= float(uFactor * uFactor);
  vec4 color = vec4(sum.a > 1e-5 ? sum.rgb / sum.a : vec3(0.0), 1.0);
  #ifdef SRGB_TRANSFER
    color = sRGBTransferOETF(color);
  #endif
  outColor = vec4(color.rgb * sum.a, sum.a);
}`

const VERTEX = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

/**
 * Replaces OutputPass at the end of the chain: tone mapping and colour-space
 * conversion per internal sample, then a box-filter resolve to the canvas.
 * With `factor` 1 it is OutputPass (plus correct premultiplied alpha).
 */
export class Scope3DOutputPass extends Pass {
  factor = 1
  private readonly material: THREE.RawShaderMaterial
  private readonly quad: FullScreenQuad
  private key = ""

  constructor() {
    super()
    this.material = new THREE.RawShaderMaterial({
      name: "Scope3DOutput",
      uniforms: { tDiffuse: { value: null }, uFactor: { value: 1 }, toneMappingExposure: { value: 1 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      glslVersion: THREE.GLSL3,
    })
    this.quad = new FullScreenQuad(this.material)
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const u = this.material.uniforms
    u.tDiffuse.value = readBuffer.texture
    u.uFactor.value = this.factor
    u.toneMappingExposure.value = renderer.toneMappingExposure
    const key = `${renderer.outputColorSpace}|${renderer.toneMapping}`
    if (key !== this.key) {
      this.key = key
      const defines: Record<string, string> = {}
      if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) defines.SRGB_TRANSFER = ""
      const toneMaps: Partial<Record<THREE.ToneMapping, string>> = {
        [THREE.AgXToneMapping]: "AGX_TONE_MAPPING",
        [THREE.ACESFilmicToneMapping]: "ACES_FILMIC_TONE_MAPPING",
        [THREE.NeutralToneMapping]: "NEUTRAL_TONE_MAPPING",
        [THREE.ReinhardToneMapping]: "REINHARD_TONE_MAPPING",
        [THREE.LinearToneMapping]: "LINEAR_TONE_MAPPING",
      }
      const tm = toneMaps[renderer.toneMapping]
      if (tm) defines[tm] = ""
      this.material.defines = defines
      this.material.needsUpdate = true
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)
  }

  dispose() {
    this.material.dispose()
    this.quad.dispose()
  }
}
