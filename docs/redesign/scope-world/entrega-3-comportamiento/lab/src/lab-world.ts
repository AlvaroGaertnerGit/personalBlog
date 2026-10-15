// The lab's places, route and tuning, in Blender coordinates (metres, x right,
// y away from the front of the sheet, z up), like every Scope World script.
//
// The lab lives in the approved world, in front of the sheet's lower-left
// corner: Scope's lantern and cabinet are the real ones (Entrega 2,
// entorno2.py: LANTERN, CABINET). The ball, the light flower and this copy of
// the radiometer are lab props. The radiometer is MOVED: at its 2.0 place
// (0.10, 0.30) there is no walkable floor within 15 cm on the world's nav map,
// so Scope could never stand next to it (see the README, integration).

import type { Places, Station, WorldDef } from "../../../core/world-def.ts"

export const LAB_PLACES: Places = {
  lantern: { center: [-1.2, -0.4], wallR: 0.105, outerR: 0.14, dishR: 0.08, dishTop: 0.0067 },
  // his facing on the fit path: -x, into the lantern
  lanternDoor: { outside: [-0.99, -0.4], doorway: [-1.1, -0.4], seat: [-1.2, -0.4] },
  cabinet: { min: [-1.236, -0.688], max: [-1.019, -0.632], look: [-1.1, -0.66, 0.06] },
  ball: { start: [-0.71, -0.67], radius: 0.03, tidy: [-0.97, -0.75] },
  flower: { at: [-0.42, -0.6], baseR: 0.03 },
  radiometer: { at: [-0.12, -0.61], baseR: 0.02, bulbR: 0.036, bulbZ: 0.075 },
}

/** The short route: five places, ~1 m. */
const STATIONS: Station[] = [
  {
    id: "linterna",
    label: "La linterna",
    anchor: [-1.08, -0.46],
    camera: { pos: [-0.377, -0.735, 0.198], target: [-1.13, -0.42, 0.06], lens: 24 },
    portrait: { pos: [-0.017, -0.924, 0.329], target: [-1.13, -0.42, 0.06], lens: 24 },
    wait: [-0.94, -0.48],
    offer: { kind: "rest", object: "lantern" },
    note: "Su casa: una linterna plegada justo fuera de la página escrita. De noche su propia luz atraviesa el papel.",
  },
  {
    id: "gabinete",
    label: "El gabinete",
    anchor: [-1.0, -0.68],
    camera: { pos: [-0.578, -1.34, 0.24], target: [-1.05, -0.64, 0.05], lens: 24 },
    portrait: { pos: [-0.357, -1.648, 0.382], target: [-1.05, -0.64, 0.05], lens: 24 },
    wait: [-0.95, -0.76],
    offer: { kind: "inspect", object: "cabinet" },
    note: "Lo que ha encontrado en la mesa de Álvaro, en escalones de papel: una gota de tinta, una viruta, una grapa, un trozo de porcelana.",
  },
  {
    id: "pelota",
    label: "La bola de papel",
    anchor: [-0.74, -0.68],
    camera: { pos: [-0.48, -1.383, 0.222], target: [-0.76, -0.63, 0.05], lens: 24 },
    portrait: { pos: [-0.34, -1.701, 0.361], target: [-0.76, -0.63, 0.05], lens: 24 },
    wait: [-0.8, -0.76],
    offer: { kind: "nudge", object: "ball" },
    note: "Una bola de papel arrugado. No tiene manos: la mueve con la cara.",
  },
  {
    id: "flor",
    label: "La flor de luz",
    anchor: [-0.46, -0.68],
    camera: { pos: [-0.285, -1.4, 0.222], target: [-0.46, -0.63, 0.05], lens: 24 },
    portrait: { pos: [-0.187, -1.722, 0.361], target: [-0.46, -0.63, 0.05], lens: 24 },
    wait: [-0.5, -0.76],
    offer: { kind: "shine", object: "flower" },
    note: "Un capullo de kirigami. Guarda la luz que recibe y, cuando tiene bastante, se abre.",
  },
  {
    id: "radiometro",
    label: "El radiómetro",
    anchor: [-0.18, -0.68],
    camera: { pos: [-0.012, -1.425, 0.232], target: [-0.17, -0.62, 0.06], lens: 24 },
    portrait: { pos: [0.082, -1.754, 0.371], target: [-0.17, -0.62, 0.06], lens: 24 },
    wait: [-0.22, -0.77],
    offer: { kind: "shine", object: "radiometer" },
    note: "Su experimento: un molinillo de luz. Las aspas giran con la luz que reciben, la de la lámpara o la suya.",
  },
]

const START: [number, number] = [-0.95, -0.47]

export const LAB_WORLD: WorldDef = {
  id: "lab",
  stations: STATIONS,
  places: LAB_PLACES,
  // "too close" is measured to YOU (the camera on the ground): the anchor is only where you look
  bands: { tooClose: 0.2, comfort: 0.22, tense: 0.5 },
  offscreenLostS: 3,
  settledS: 0.6,
  // the design asks for 90 s before the refuge; the lab uses less (and has ×4 time)
  timing: {
    showcaseAfter: 1.2,
    showcaseCooldown: 40,
    inspectAfter: 9,
    inspectCooldown: 50,
    idleLookAt: [15, 25],
    refugeAfter: 30,
    restAfter: 45,
    readingStill: 8,
    clickWindow: 8,
    regroupBlinkAfter: 4,
    inspectRadius: 0.32,
  },
  // the Entrega 3 camera: one spring for every segment (they are all ~0.27 m)
  visitorStiffness: () => 9,
  // the lab's props are out of the lamp's circle: a constant share of the mood's light
  ambientAt: (_at, mood) => mood.ambientLight,
  start: { at: START, heading: Math.atan2(-0.7 - START[0], -(-0.62 - START[1])) },
}
