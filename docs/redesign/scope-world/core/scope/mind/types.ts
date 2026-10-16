// What Scope's mind perceives and what it asks the body to do. Pure data: the
// mind never sees three.js or the DOM (mind.test.ts drives it with numbers).

import type { P2 } from "../../world-def.ts"
import type { Clip } from "../gestures.ts"
import type { Gait } from "../body/locomotor.ts"

export type ObjectId = "ball" | "flower" | "radiometer" | "lantern" | "cabinet"

/** What he looks at. Resolved to a world point by the stage. */
export type Look =
  | { kind: "none" }
  | { kind: "visitor" }
  | { kind: "object"; id: ObjectId }
  | { kind: "point"; at: P2 }
  | { kind: "ahead" }

/** One thing for the body to do. `seq` changes for every new request. */
export type Act =
  | { kind: "idle" }
  | { kind: "go"; goal: P2; gait: Gait; face: Look | null; follow: boolean }
  | { kind: "gesture"; clip: Clip; face: Look | null }
  | { kind: "fit" }
  | { kind: "unfit" }
  | { kind: "nudge"; object: "ball"; toward: P2 }
  | { kind: "shine"; object: "flower" | "radiometer"; hold: number }
  | { kind: "react"; variant: ReactVariant }
  | { kind: "surprise"; from: P2 }
  | { kind: "settle" }

export type ReactVariant = "full" | "blink" | "tilt" | "hop" | "peek"

/** The body's report on the act it is executing. */
export interface ActReport {
  seq: number
  kind: Act["kind"]
  phase: string
  done: boolean
  /** True between steps / clips: a higher priority may take over now. */
  interruptible: boolean
}

export interface ClickEvent {
  t: number
  target: { kind: "scope" } | { kind: "object"; id: ObjectId } | { kind: "ground"; at: P2 }
}

export interface Perception {
  /** Seconds. */
  now: number
  scope: {
    at: P2
    heading: number
    moving: boolean
    inRefuge: boolean
    visible: boolean
    act: ActReport
  }
  visitor: {
    /** The ground point the camera looks at. */
    anchor: P2
    /** The camera on the ground (where "you" stand). */
    eye: P2
    /** Route parameter (0..stations-1) and its rate (stations/s). */
    s: number
    sVel: number
    /** Where the camera is going (route parameter); read only with WorldDef.refine.followTarget. */
    target?: number
    /** Station the camera is at or settling on. */
    zone: number
    /** The camera has been still for the world's settledS. */
    settled: boolean
    reading: boolean
    /** The pointer rests on Scope. */
    lookingAtScope: boolean
    /** Seconds since the visitor last did anything. */
    idle: number
  }
  objects: Partial<Record<ObjectId, { at: P2; moving: boolean; salience: number }>>
  clicks: ClickEvent[]
  reduced: boolean
}

export type Group = "guion" | "respuesta" | "compania" | "curiosidad" | "vida" | "reposo"
export const PRIORITY: Record<Group, number> = { guion: 5, respuesta: 4, compania: 3, curiosidad: 2, vida: 1, reposo: 0 }

export interface Intent {
  group: Group
  /** The behaviour, in the words of the design (debug panel). */
  state: string
  /** Why: one sentence a person can read. */
  reason: string
  act: Act & { seq: number }
  gaze: Look
  gazeWeight: { eyes: number; body: number }
  /** Baseline glow of his light, 0..1 (acts may raise it). */
  glow: number
  /** Brief "Tall" eyes (surprise, recognition), 0..1. */
  tall: number
}
