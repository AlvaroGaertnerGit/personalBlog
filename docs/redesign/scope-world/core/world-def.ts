// What a Scope World is, as data: its places, the visitor's route, the
// companion's distances and the pace of his routines. The mind, the body and
// the app read everything from here, so the Entrega 3 lab and the Entrega 4
// world are two definitions of the same Scope, not two Scopes.
//
// Coordinates are Blender's (metres, x right, y away from the front of the
// sheet, z up), like every Scope World script.

export type P2 = readonly [number, number]
export type P3 = readonly [number, number, number]

export interface CameraPose {
  pos: P3
  target: P3
  lens: number
}

export type Offer =
  | { kind: "rest"; object: "lantern" }
  | { kind: "nudge"; object: "ball" }
  | { kind: "shine"; object: "flower" | "radiometer" }
  | { kind: "inspect"; object: "cabinet" }

export interface Station {
  id: string
  label: string
  /** Where the visitor "is": the ground point the camera looks at. */
  anchor: P2
  camera: CameraPose
  /** Phone (portrait) camera. */
  portrait: CameraPose
  /** Where Scope stands when he waits for you here. */
  wait: P2
  /** What this place offers him (the mind chooses among offers). */
  offer: Offer | null
  /** What there is to read here. */
  note: string
}

/** Scope's own places and toys. */
export interface Places {
  lantern: { center: P2; wallR: number; outerR: number; dishR: number; dishTop: number }
  /** Fit path: outside the door, in the doorway, on the dish. */
  lanternDoor: { outside: P2; doorway: P2; seat: P2 }
  cabinet: { min: P2; max: P2; look: P3 }
  ball: { start: P2; radius: number; tidy: P2 }
  flower: { at: P2; baseR: number }
  radiometer: { at: P2; baseR: number; bulbR: number; bulbZ: number }
}

export interface Timing {
  showcaseAfter: number
  showcaseCooldown: number
  inspectAfter: number
  inspectCooldown: number
  idleLookAt: readonly [number, number]
  refugeAfter: number
  restAfter: number
  readingStill: number
  clickWindow: number
  regroupBlinkAfter: number
  /** Inspect only things this close to your anchor (m). */
  inspectRadius: number
}

export interface WorldDef {
  id: string
  /** The approved gaits, re-paced for this world's distances (speeds in m/s). */
  gaits?: Partial<Record<"walk" | "trot" | "bound", Partial<{ speed: number; accel: number; decel: number; turn: number }>>>
  stations: Station[]
  places: Places
  /** Companion bands, Scope to your anchor (m); "too close" is to the camera. */
  bands: { tooClose: number; comfort: number; tense: number }
  offscreenLostS: number
  settledS: number
  timing: Timing
  /** The visitor's camera spring (1/s²) for one metre of route: longer segments take longer. */
  visitorStiffness: (segmentMetres: number) => number
  /** The light of the world that reaches a point (the radiometer's baseline), 0 in the dark. */
  ambientAt: (at: P2, mood: { lamp: number; ambientLight: number }) => number
  /** Where Scope starts: at his door. */
  start: { at: P2; heading: number }
}

const last = (def: WorldDef) => def.stations.length - 1

/** Length (m) of the route segment containing s. */
export function segmentLength(def: WorldDef, s: number) {
  const i = Math.min(last(def) - 1, Math.max(0, Math.floor(s)))
  const a = def.stations[i].anchor
  const b = def.stations[i + 1].anchor
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}
