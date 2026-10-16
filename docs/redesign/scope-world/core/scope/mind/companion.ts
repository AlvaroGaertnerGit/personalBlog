// The companion model (Fase A §4.4): how far Scope is from you, and where a
// companion would stand. Pure geometry over a world's route.

import type { P2, WorldDef } from "../../world-def.ts"
import { dist } from "../body/locomotor.ts"

export type Band = "cerca" | "comoda" | "tensa" | "perdido"

export function bandOf(def: WorldDef, d: number, toEye = Infinity): Band {
  if (toEye < def.bands.tooClose) return "cerca"
  if (d <= def.bands.comfort) return "comoda"
  if (d <= def.bands.tense) return "tensa"
  return "perdido"
}

const clampS = (def: WorldDef, s: number) => Math.min(def.stations.length - 1, Math.max(0, s))

/** The visitor's anchor along the route (piecewise linear between the stations' anchors). */
export function anchorAt(def: WorldDef, s: number): P2 {
  const last = def.stations.length - 1
  const c = clampS(def, s)
  const i = Math.min(last - 1, Math.floor(c))
  const t = c - i
  const a = def.stations[i].anchor
  const b = def.stations[i + 1].anchor
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

export function nearestStation(def: WorldDef, s: number) {
  return Math.round(clampS(def, s))
}

/**
 * Where a companion stands while you move: a little toward you from the
 * camera's line (so he stays in view) and either AHEAD along the route (he
 * knows the way) or with you.
 */
export function slotWhileMoving(def: WorldDef, s: number, direction: number, ahead: boolean, eye: P2, jumpLead?: number): P2 {
  const lead = ahead ? 0.4 : -0.15
  // a jump (refine.followTarget): further ahead, toward where you are going
  const a = anchorAt(def, jumpLead !== undefined ? s + jumpLead : s + Math.sign(direction || 1) * lead)
  const d = dist(a, eye) || 1
  return [a[0] + ((eye[0] - a[0]) / d) * 0.06, a[1] + ((eye[1] - a[1]) / d) * 0.06]
}

/**
 * Where he stays when you stop: where he is, if that is comfortable and in
 * view (he is not glued to you); otherwise the place's waiting spot.
 */
export function slotWhenSettled(def: WorldDef, zone: number, scopeAt: P2, anchor: P2, visible: boolean, eye?: P2): { at: P2; stay: boolean } {
  const d = dist(scopeAt, anchor)
  const tooClose = eye ? dist(scopeAt, eye) < def.bands.tooClose : false
  if (visible && d <= def.bands.comfort && !tooClose) return { at: scopeAt, stay: true }
  return { at: def.stations[zone].wait, stay: false }
}
