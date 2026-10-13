// Mineral ceramic for the shell, in the browser.
//
// The Blender material (assets/scope-3d/scripts/scope3d/materials.py `shell`)
// is procedural, and glTF can't carry node networks: the GLB only keeps the
// flat beige. Until the material is baked to textures (planned before the web
// integration), this shader patch reproduces its three ingredients in object
// space, with the same scales, so the lab doesn't judge a plastic-looking Scope:
//   - low-frequency tonal drift      noise scale 22, value 0.93–1.04
//   - sparse dark / rare pale flecks voronoi 380 (r .16, 45 %) / 240 (r .12, 18 %)
//   - roughness wandering with drift 0.58–0.70
// The micro-grain bump is not reproduced (needs a normal map).

import * as THREE from "three"

const VERTEX_DECL = /* glsl */ `
varying vec3 vScopeObj;
`

const FRAGMENT_DECL = /* glsl */ `
varying vec3 vScopeObj;
uniform float uScopeGrain;

float scopeHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

vec3 scopeHash3(vec3 p) {
  return vec3(scopeHash(p), scopeHash(p + 19.19), scopeHash(p + 47.47));
}

float scopeNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(scopeHash(i), scopeHash(i + vec3(1, 0, 0)), f.x),
        mix(scopeHash(i + vec3(0, 1, 0)), scopeHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(scopeHash(i + vec3(0, 0, 1)), scopeHash(i + vec3(1, 0, 1)), f.x),
        mix(scopeHash(i + vec3(0, 1, 1)), scopeHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float scopeFbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 4; i++) {
    sum += amp * scopeNoise(p);
    norm += amp;
    p *= 2.0;
    amp *= 0.55;
  }
  return sum / norm;
}

// Round fleck at the feature point of a random subset of voronoi cells.
float scopeFleck(vec3 p, float radius, float keepBelow) {
  vec3 cell = floor(p);
  float best = 1e9;
  float pick = 1.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 c = cell + vec3(x, y, z);
    float d = length(c + scopeHash3(c) - p);
    if (d < best) {
      best = d;
      pick = scopeHash(c + 5.31);
    }
  }
  return step(pick, keepBelow) * (1.0 - smoothstep(0.0, radius, best));
}

// A fleck narrower than ~1.5 px can't be drawn, only aliased: it pops in and
// out as Scope moves (crawling dots over the shell at web size). Fade it out by
// its on-screen size; its mean contribution is ~0.1 % of the shade, so nothing
// is lost but the noise. At studio size every fleck stays as authored.
float scopeFleckFiltered(vec3 p, float radius, float keepBelow) {
  float px = 2.0 * radius / max(length(fwidth(p)), 1e-6);
  float visible = smoothstep(0.8, 1.8, px);
  return visible > 0.0 ? visible * scopeFleck(p, radius, keepBelow) : 0.0;
}
`

export function applyScopeCeramic(material: THREE.MeshStandardMaterial) {
  const grain = { value: 1 }
  material.roughness = 0.64
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uScopeGrain = grain
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_DECL}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvScopeObj = position;")
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_DECL}`)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float scopeDrift = scopeFbm(vScopeObj * 22.0);
        float scopeShade = mix(0.93, 1.04, scopeDrift)
          * mix(1.0, 0.62, scopeFleckFiltered(vScopeObj * 380.0, 0.16, 0.45))
          * mix(1.0, 1.12, scopeFleckFiltered(vScopeObj * 240.0, 0.12, 0.18));
        diffuseColor.rgb *= mix(1.0, scopeShade, uScopeGrain);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, mix(0.58, 0.70, scopeDrift), uScopeGrain);`,
      )
  }
  return {
    setEnabled(on: boolean) {
      grain.value = on ? 1 : 0
    },
  }
}
