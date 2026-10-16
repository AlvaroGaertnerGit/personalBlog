// Scope World 2.0 · 4A: one world, Scope's world. The approved 1.0 route
// (the margin, the questions, the long fold, the lamp's light) joined to his
// own places outside the written page (his lantern, his cabinet) in one
// continuous S, with his toys where he lives:
//
//   0 la linterna  ─ 1 el gabinete ─ 2 el margen ─ 3 las preguntas ─ 4 el pliegue largo ─ 5 la luz
//   (zone 1, El despertar)                        (zone 3, El territorio de las ideas)   (zone 4, el círculo)
//
// Cameras: the lantern and the cabinet keep the Entrega 3 lab's; the four
// 1.0 places keep the cameras of the approved renders (prototype/src/config.ts).
// The radiometer stands on the rim of the lamp's circle, where the Fase A put
// it (08-el-mundo-de-scope §8.4), at (0.27, −0.13): searched on the baked floor
// so that Scope can stand 13 cm from it on several sides, the way into the
// circle stays open (at (0.21, −0.05) it closed it) and «La luz» sees it well
// inside the frame (at (0.50, −0.18) it sat on the frame's lower edge).

import type { CameraPose, P2, Places, Station, WorldDef } from "../../../core/world-def.ts"
import { GAITS } from "../../../core/scope/body/locomotor.ts"

/**
 * Nearest Scope goes to the camera on his own (ground, m). The margin's approved camera
 * stands 10 cm above the paper: closer than this, he fills the frame (the 4A audit, H1).
 */
const CAMERA_CLEARANCE = 0.34

export const WORLD_PLACES: Places = {
  lantern: { center: [-1.2, -0.4], wallR: 0.105, outerR: 0.14, dishR: 0.08, dishTop: 0.0067 },
  lanternDoor: { outside: [-0.99, -0.4], doorway: [-1.1, -0.4], seat: [-1.2, -0.4] },
  cabinet: { min: [-1.236, -0.688], max: [-1.019, -0.632], look: [-1.1, -0.66, 0.06] },
  // his ball lives in the margin, his place; its corner is by the cabinet. It rests in the
  // middle ground of the margin's view (~0.5 m from its camera, on the phone too), with
  // open floor behind it: pushing it toward you he faces you and stays clear of the lens
  ball: { start: [-0.66, -0.2], radius: 0.03, tidy: [-0.97, -0.75] },
  // the light flower grows in the field of questions: light makes paper legible (rule 4)
  flower: { at: [-0.24, -0.5], baseR: 0.03 },
  radiometer: { at: [0.27, -0.13], baseR: 0.02, bulbR: 0.036, bulbZ: 0.075 },
}

/**
 * The phone's camera: a little further back and higher, aimed a little lower,
 * so the ground (and Scope on it) rises above the HUD at the bottom.
 */
const portraitOf = (c: CameraPose, k = 1.3, up = 0.05): CameraPose => ({
  pos: [c.target[0] + (c.pos[0] - c.target[0]) * k, c.target[1] + (c.pos[1] - c.target[1]) * k, c.pos[2] + up],
  target: [c.target[0], c.target[1], c.target[2] - 0.08],
  lens: c.lens,
})

const LANTERN_CAM: CameraPose = { pos: [-0.377, -0.735, 0.198], target: [-1.13, -0.42, 0.06], lens: 24 }
const CABINET_CAM: CameraPose = { pos: [-0.578, -1.34, 0.24], target: [-1.05, -0.64, 0.05], lens: 24 }
const MARGIN_CAM: CameraPose = { pos: [-0.84, -0.69, 0.1], target: [-0.66, -0.2, 0.09], lens: 24 }
const QUESTIONS_CAM: CameraPose = { pos: [-0.36, -0.74, 0.07], target: [-0.19, -0.06, 0.16], lens: 20 }
const FOLD_CAM: CameraPose = { pos: [0.02, -0.98, 0.3], target: [0.2, -0.02, 0.05], lens: 24 }
const LIGHT_CAM: CameraPose = { pos: [0.88, -0.32, 0.55], target: [0.42, 0.22, 0.0], lens: 30 }

const STATIONS: Station[] = [
  {
    id: "linterna",
    // light: the Entrega 2 lantern shot (e2-linterna): night, his home lit from within
    mood: "noche",
    label: "La linterna",
    anchor: [-1.08, -0.46],
    camera: LANTERN_CAM,
    portrait: portraitOf(LANTERN_CAM, 1.2),
    wait: [-0.94, -0.48],
    offer: { kind: "rest", object: "lantern" },
    note: "Su casa: una linterna de papel plisado, justo fuera de la página escrita. Dentro, un plato de porcelana donde se asienta. De noche, su propia luz atraviesa el papel.",
  },
  {
    id: "gabinete",
    // light: leaving home, the dawn of the margin begins (zone 1, El despertar)
    mood: "amanecer",
    label: "El gabinete",
    anchor: [-1.0, -0.68],
    camera: CABINET_CAM,
    portrait: portraitOf(CABINET_CAM, 1.2),
    wait: [-0.95, -0.76],
    offer: { kind: "inspect", object: "cabinet" },
    note: "Lo que ha ido encontrando en la mesa, en escalones de papel: una gota de tinta seca, una viruta de lápiz, una grapa, una esquirla de porcelana y una miga de grafito.",
  },
  {
    id: "margen",
    // light: the approved home shot (e2-home): dawn
    mood: "amanecer",
    label: "El margen",
    anchor: [-0.64, -0.46],
    camera: MARGIN_CAM,
    // like the other places: a little further back and higher than its own (the Entrega 1
    // `home-m` stood 24 cm from you: no room in front of it for Scope and his ball)
    portrait: portraitOf(MARGIN_CAM),
    wait: [-0.52, -0.34],
    offer: { kind: "nudge", object: "ball" },
    note: "La línea bermellón del margen: donde termina lo escrito y empieza lo que aún no existe. Aquí vive Scope, y aquí juega con su bola de papel.",
  },
  {
    id: "preguntas",
    // light: toward the lamp's circle, the clear day of e2-dia
    mood: "dia",
    label: "Las preguntas",
    anchor: [-0.3, -0.22],
    camera: QUESTIONS_CAM,
    portrait: portraitOf(QUESTIONS_CAM),
    wait: [-0.36, -0.385],
    offer: { kind: "shine", object: "flower" },
    note: "El campo de preguntas: cuadernos abiertos y hojas de pie. Entre ellas crece una flor de papel que guarda la luz que recibe.",
  },
  {
    id: "pliegue",
    // light: the clear day of e2-dia
    mood: "dia",
    label: "El pliegue largo",
    anchor: [0.05, -0.03],
    camera: FOLD_CAM,
    portrait: portraitOf(FOLD_CAM),
    wait: [0.09, -0.35],
    offer: null,
    note: "El pliegue largo cruza el papel hacia la luz de la lámpara.",
  },
  {
    id: "luz",
    // light: the lamp's circle by day (e2-dia)
    mood: "dia",
    label: "La luz",
    anchor: [0.4, 0.14],
    camera: LIGHT_CAM,
    portrait: portraitOf(LIGHT_CAM),
    wait: [0.34, 0.09],
    offer: { kind: "shine", object: "radiometer" },
    note: "El círculo de la lámpara: la luz que convierte el papel en porcelana. En su borde, el experimento de Scope: un radiómetro que gira con la luz, la de la lámpara o la suya.",
  },
]

/** The lamp's circle (world.json pool): its light falls off past the rim. */
const POOL = { at: [0.45, 0.18] as P2, r: 0.36 }

export const WORLD_4A: WorldDef = {
  id: "mundo-4a",
  stations: STATIONS,
  places: WORLD_PLACES,
  bands: { tooClose: CAMERA_CLEARANCE, comfort: 0.3, tense: 0.65 },
  offscreenLostS: 3,
  settledS: 0.6,
  timing: {
    showcaseAfter: 1.2,
    showcaseCooldown: 60,
    inspectAfter: 10,
    inspectCooldown: 60,
    idleLookAt: [15, 25],
    // the Fase A asks for 90 s in zone 1; 60 s here (and "Tiempo ×4" to try it)
    refugeAfter: 60,
    restAfter: 75,
    readingStill: 8,
    clickWindow: 8,
    regroupBlinkAfter: 4,
    inspectRadius: 0.4,
  },
  // the lab's spring for its 0.27 m segments, softened for longer ones (≈ the same walking pace)
  visitorStiffness: (m) => 9 * Math.min(1, 0.27 / Math.max(m, 0.05)),
  ambientAt: (at, mood) => {
    const d = Math.hypot(at[0] - POOL.at[0], at[1] - POOL.at[1])
    const k = Math.min(1, Math.max(0, (POOL.r * 1.25 - d) / (POOL.r * 0.75)))
    return mood.lamp * 8 * k // on the rim (k ≈ 0.33): enough to turn the vanes slowly
  },
  refine: {
    cameraClearance: CAMERA_CLEARANCE,
    // a jump across places is a run toward it, beside a view that travels at his hurry (the
    // approved gait): a faster view leaves him behind, out of frame (measured: 0.26 m/s already does)
    followTarget: true,
    visitorMaxSpeed: GAITS.bound.speed * 0.9,
    doorFromInside: true,
    restartBelow: 0.03,
    finishRun: true,
    flowerPick: true,
  },
  // he is home when you arrive: seated in his lantern, he comes out to meet you
  start: { at: WORLD_PLACES.lanternDoor.seat, heading: Math.atan2(1, 0) },
}
