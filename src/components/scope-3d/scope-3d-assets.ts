// Scope 3D's production assets (public/scope/). How each one is generated:
// assets/scope-3d/README.md → "Web".

/** The approved GLB, meshopt-compressed (gltf-transform). */
export const SCOPE_3D_MODEL_URL = "/scope/scope.glb"
/**
 * Scope at rest, rendered in Blender from the site camera itself: stands in
 * for the live model (no WebGL, failure, timeout) in exactly its place.
 */
export const SCOPE_3D_STILL_URL = "/scope/scope-still.webp"
