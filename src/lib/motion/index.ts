// Primitives only — the "variants built on primitives" layer lives in
// ./variants (src/lib/motion/variants.ts) and is imported from there
// directly, not re-exported here, to keep the two layers distinct.
export { duration } from "./durations"
export { distance } from "./distances"
export { easing } from "./easings"
export { springs } from "./springs"
export { transitions } from "./transitions"
export { defaultViewport } from "./viewport"
