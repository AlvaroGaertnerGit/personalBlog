// Frame output: MSAA scene target -> light bloom (Scope's eyes, the bulb,
// MathView's glowing curves: the renders' Glare node) -> AgX tone mapping.
// The low tier renders straight to the canvas (no bloom) — same as the
// production stage's governor, which drops bloom first.

import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"

const MSAA_4X_MAX_PIXELS = 1_500_000

export interface Post {
  render(): void
  setSize(width: number, height: number): void
  readonly bloom: boolean
}

/** A soft studio environment for the glazes' reflections and some ambient fill (the renders have GI). */
export function addEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
}

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, bloom: boolean): Post {
  if (!bloom) {
    return {
      bloom: false,
      render: () => renderer.render(scene, camera),
      setSize: () => {},
    }
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2())
  // same budget as the production stage: above 1.5 Mpx the HDR target drops to 2× MSAA
  const samples = size.x * size.y > MSAA_4X_MAX_PIXELS ? 2 : 4
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  const glare = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.45, 0.92)
  composer.addPass(glare)
  composer.addPass(new OutputPass())
  return {
    bloom: true,
    render: () => composer.render(),
    setSize: (w, h) => {
      composer.setPixelRatio(renderer.getPixelRatio())
      composer.setSize(w, h)
    },
  }
}
