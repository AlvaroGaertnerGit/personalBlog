// Places, cameras and points of interest of the prototype, in Blender
// coordinates (metres, z up) so they can be checked against
// docs/scope-world/blender/pliego.py and entrega-1-5/blender/mundo.py.
//
// The cameras reuse the approved renders' cameras where Scope can actually be
// seen from them (home, c1-place, c2-close). "Questions" is moved: from
// a2-inside's camera no walkable floor is in view (assets/nav.bin), so Scope
// could never be in that picture. "The long fold" is new.
//
// Composition rule for points of interest: Scope inspects them roughly IN
// PROFILE from their station's camera, at least ~0.3 m from it, and every
// spot lies on walkable floor (main.ts snaps and reports any that do not).

import type { Station } from "./camera/camera-rig.ts"
import type { BlPoint, BlPoint2 } from "./world/world-data.ts"

export const STATIONS: Station[] = [
  // Entrega 1 `home`: Scope in the margin, the field behind him
  {
    id: "margin",
    label: "El margen",
    pos: [-0.84, -0.69, 0.1],
    target: [-0.66, -0.2, 0.09],
    lens: 24,
    // Entrega 1 `home-m`: the phone's own camera of the same place
    portrait: { pos: [-0.7, -0.69, 0.1], target: [-0.62, -0.26, 0.16], lens: 26 },
  },
  // at Scope's height in front of the questions (a2-inside, moved south so his floor is in view)
  { id: "questions", label: "Las preguntas", pos: [-0.36, -0.74, 0.07], target: [-0.19, -0.06, 0.16], lens: 20 },
  // new: the long fold, looking up the route toward the light
  { id: "fold", label: "El pliegue largo", pos: [0.02, -0.98, 0.3], target: [0.2, -0.02, 0.05], lens: 24 },
  // Entrega 1.5 `c1-place`: the lamp's circle and the fired pieces
  { id: "light", label: "La luz", pos: [0.88, -0.32, 0.55], target: [0.42, 0.22, 0.0], lens: 30 },
]

/** Entrega 1.5 `c2-close`, nudged: MathView up close while its project is open. */
export const MATHVIEW_FOCUS = { pos: [0.74, -0.04, 0.3] as BlPoint, target: [0.42, 0.29, 0.03] as BlPoint, lens: 30 }

export type PoiKind = "question" | "paper" | "project" | "lamp" | "rest"

export interface Poi {
  id: string
  kind: PoiKind
  label: string
  /** Where Scope stands to look at it. */
  spot: BlPoint2
  /** What Scope looks at (and where the hotspot sits). */
  look: BlPoint
  /** Which station it belongs to (where Scope explores it on his own). */
  station: number
  /** Activity Scope does there. */
  gesture: "Focus" | "Tilt" | "LookAround" | "BlinkDouble"
  /** Content id (notebook thread or project), if the visitor can open it. */
  contentId?: string
  /** The visitor can point at / focus it (a hotspot). */
  interactive?: boolean
  /** Where its hotspot sits, if not on `look`. */
  hotspot?: BlPoint
}

export const POIS: Poi[] = [
  {
    id: "q-next",
    kind: "question",
    label: "La pregunta sin escribir",
    spot: [-0.64, -0.43],
    look: [-0.8, -0.36, 0.04],
    station: 0,
    gesture: "Tilt",
    contentId: "next-question",
    interactive: true,
  },
  {
    // Entrega 1.5 `a3-discovery`: from the margin he reads the open notebook's layers
    id: "q-context",
    kind: "question",
    label: "¿Cuánto contexto basta de verdad?",
    spot: [-0.53, -0.37],
    look: [-0.56, -0.19, 0.07],
    station: 0,
    gesture: "Focus",
    contentId: "context-engineering",
    interactive: true,
    hotspot: [-0.46, -0.1, 0.3],
  },
  { id: "rules", kind: "paper", label: "Las líneas del papel", spot: [-0.55, -0.41], look: [-0.64, -0.43, 0], station: 0, gesture: "Focus" },
  {
    id: "q-agents",
    kind: "question",
    label: "¿Cuándo debería un agente de IA convertirse en dos?",
    spot: [-0.13, -0.52],
    look: [-0.14, -0.38, 0.16],
    station: 1,
    gesture: "Tilt",
    contentId: "ai-agents",
    interactive: true,
    hotspot: [-0.14, -0.3, 0.3],
  },
  {
    id: "q-mcp",
    kind: "question",
    label: "¿Puede un protocolo común sustituir a un montón de integraciones hechas a medida?",
    spot: [-0.22, 0.03],
    look: [-0.13, 0.16, 0.16],
    station: 1,
    gesture: "Focus",
    contentId: "mcp-ecosystem",
    interactive: true,
    hotspot: [-0.13, 0.22, 0.4],
  },
  {
    id: "q-local",
    kind: "rest",
    label: "Modelos locales (en pausa)",
    spot: [0.16, -0.26],
    look: [0.08, -0.26, 0.0],
    station: 2,
    gesture: "BlinkDouble",
    contentId: "local-models",
    interactive: true,
  },
  {
    id: "q-ux",
    kind: "question",
    label: "¿Se puede diseñar una interfaz a partir de lo que sabe hacer un modelo?",
    spot: [0.1, -0.08],
    look: [0.12, 0.06, 0.2],
    station: 2,
    gesture: "Focus",
    contentId: "ai-native-ux",
    interactive: true,
  },
  {
    id: "mathview",
    kind: "project",
    label: "MathView",
    spot: [0.36, 0.13],
    look: [0.4, 0.31, 0.04],
    station: 3,
    gesture: "Focus",
    contentId: "mathview",
    interactive: true,
  },
  { id: "lamp", kind: "lamp", label: "La lámpara", spot: [0.35, 0.07], look: [0.47, 0.2, 1.2], station: 3, gesture: "LookAround" },
]

/** Where Scope goes when the visitor arrives at a station he isn't near (on walkable floor, in view). */
export const STATION_SPOTS: BlPoint2[] = [
  [-0.52, -0.34],
  [-0.36, -0.42],
  [0.09, -0.35],
  [0.34, 0.09],
]

/** Scope's starting place: Entrega 1 `home`. */
export const SCOPE_HOME = { spot: [-0.52, -0.34] as BlPoint2 }
