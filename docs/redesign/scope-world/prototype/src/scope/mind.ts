// Scope's mind in the world: WHAT he attends to and WHAT he does. Pure logic
// (no three.js, no DOM), time and randomness injected, so every rule below is
// testable with `node --test` (mind.test.ts).
//
// Two layers, each owning different parts of the body, so they never fight:
//
//   ACTIVITY  owns where he is (goal) and the gestures (clips)
//     rest      stays put; now and then glances at something near him
//     explore   goes to a point of interest, inspects it (one gesture), lingers
//     interact  the visitor did something to him or near him: the click
//               reaction, or a project opened (he goes to it and watches)
//   ATTENTION owns the gaze (look bone + eyes) only
//     curious   a stimulus: the lamp coming on, an object the visitor points
//               at or focuses, the pointer arriving
//     follow    the pointer keeps moving: he follows what you point at — for a
//               while, then takes a break (he is not a cursor follower)
//     visitor   the pointer is on him, or he greets you back: he looks at you
//
// The reported state is the higher-priority one of the two:
//   interact (4) > curious (3) > follow (2) > explore (1) > rest (0)
// A higher activity never cuts a lower one mid-hop or mid-gesture: the actor
// finishes the current hop/clip, then executes the new intent.

import { POIS, STATION_SPOTS, type Poi } from "../config.ts"
import type { P2 } from "./nav.ts"

export type MindState = "rest" | "curious" | "follow" | "explore" | "interact"
export const PRIORITY: Record<MindState, number> = { rest: 0, explore: 1, follow: 2, curious: 3, interact: 4 }

export type GazeTarget =
  | { kind: "none" }
  | { kind: "poi"; id: string }
  | { kind: "pointer" }
  | { kind: "visitor" }
  | { kind: "path" }

export type Gesture = "Focus" | "Tilt" | "LookAround" | "BlinkDouble" | "Bounce" | "ClickReaction"

export interface Perception {
  now: number
  /** Scope's position on the sheet (Blender x, y). */
  scopeAt: P2
  /** Hopping toward a goal. */
  moving: boolean
  /** A gesture clip is playing. */
  gesturing: boolean
  pointer: {
    /** A fine pointer is over the page (mouse / pen). */
    present: boolean
    /** It moved in the last ~250 ms. */
    moving: boolean
    overScope: boolean
    /** Within ~a third of the viewport from Scope on screen. */
    nearScope: boolean
  }
  /** Point of interest under the pointer, or holding keyboard focus. */
  hovered: string | null
  /** The station the visitor is at (or settling on). */
  station: number
  cameraSettled: boolean
  projectOpen: string | null
  reducedMotion: boolean
}

export interface Intent {
  state: MindState
  activity: string
  gaze: GazeTarget
  weight: { eyes: number; body: number }
  /** Where to be. The actor plans a path when it changes. */
  goal: P2 | null
  goalId: string | null
  /** Which way to face once there (null = keep). */
  face: GazeTarget | null
  /** A one-shot gesture; `seq` increments on every new request. */
  gesture: { clip: Gesture; seq: number } | null
}

interface Options {
  random?: () => number
  pois?: Poi[]
}

const REST_MS: [number, number] = [7000, 13000]
const GLANCE_GAP_MS: [number, number] = [3500, 7000]
const GLANCE_HOLD_MS: [number, number] = [1400, 2600]
const FOLLOW_AFTER_MS = 1200
const FOLLOW_BUDGET_MS = 6500
const FOLLOW_BREAK_MS: [number, number] = [3500, 7000]
const POINTER_IDLE_RELEASE_MS = 2500
const HOVER_TO_VISIT_MS = 1600
const LAMP_LOOK_MS = 2600
const INSPECT_MS: [number, number] = [2600, 4200]
const CLICK_MS = 2800
const WELCOME_MS = 1600
const FAR_FROM_STATION = 0.24

type Activity =
  | { kind: "rest"; until: number; glance: { id: string; until: number } | null; nextGlance: number }
  | { kind: "explore"; poi: Poi | null; goal: P2; phase: "travel" | "inspect" | "linger"; until: number; why: string }
  | { kind: "click"; until: number }
  | { kind: "project"; id: string; phase: "travel" | "watch"; lookVisitorUntil: number; nextSwap: number }
  | { kind: "welcome"; until: number }

type Attention =
  | { kind: "none" }
  | { kind: "curious"; target: GazeTarget; until: number; why: string }
  | { kind: "follow"; since: number }
  | { kind: "visitor"; until: number }

const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1])

export class ScopeMind {
  private readonly random: () => number
  private readonly pois: Poi[]
  private activity: Activity
  private attention: Attention = { kind: "none" }
  private gestureSeq = 0
  private gesture: Intent["gesture"] = null
  private visited: string[] = []
  private pointerMovingSince: number | null = null
  private pointerIdleSince = 0
  private followBreakUntil = 0
  private hoverSince: { id: string; at: number } | null = null
  private lastStation = -1
  private pendingLamp = false

  constructor({ random = Math.random, pois = POIS }: Options = {}, now = 0) {
    this.random = random
    this.pois = pois
    this.activity = this.rest(now)
  }

  private range([a, b]: [number, number]) {
    return a + (b - a) * this.random()
  }

  private rest(now: number): Activity {
    return { kind: "rest", until: now + this.range(REST_MS), glance: null, nextGlance: now + this.range(GLANCE_GAP_MS) }
  }

  private requestGesture(clip: Gesture) {
    this.gesture = { clip, seq: ++this.gestureSeq }
  }

  // --- events -------------------------------------------------------------------------------
  /** The visitor clicked (or pressed) Scope. */
  clickScope(now: number) {
    if (this.activity.kind === "click") return false
    this.activity = { kind: "click", until: now + CLICK_MS }
    this.attention = { kind: "visitor", until: now + CLICK_MS }
    this.requestGesture("ClickReaction")
    return true
  }

  /** The lamp has just come on (entry). */
  lampOn() {
    this.pendingLamp = true
  }

  openProject(id: string) {
    this.activity = { kind: "project", id, phase: "travel", lookVisitorUntil: 0, nextSwap: 0 }
    this.attention = { kind: "none" }
  }

  closeProject(now: number) {
    if (this.activity.kind !== "project") return
    this.activity = { kind: "welcome", until: now + WELCOME_MS }
    this.attention = { kind: "visitor", until: now + WELCOME_MS }
    this.requestGesture("BlinkDouble")
  }

  /**
   * The actor reports a gesture has really started (it may wait for a hop to
   * land or a turn toward the visitor): the reaction's time counts from here.
   */
  gestureStarted(clip: Gesture, now: number) {
    if (clip === "ClickReaction" && this.activity.kind === "click") {
      this.activity.until = now + CLICK_MS
      if (this.attention.kind === "visitor") this.attention.until = now + CLICK_MS
    }
  }

  /** The visitor opened something near him (a question's note): he goes to see it. */
  visit(id: string) {
    const k = this.activity.kind
    if (k === "click" || k === "project") return false
    const poi = this.pois.find((q) => q.id === id)
    if (!poi) return false
    this.startExplore(poi, "the visitor opened it")
    return true
  }

  /** The actor reports it reached the current goal. */
  arrived(now: number) {
    const a = this.activity
    if (a.kind === "explore" && a.phase === "travel") {
      if (a.poi) {
        a.phase = "inspect"
        a.until = now + this.range(INSPECT_MS)
        this.requestGesture(a.poi.gesture)
      } else {
        a.phase = "linger"
        a.until = now + 1200
      }
    } else if (a.kind === "project" && a.phase === "travel") {
      a.phase = "watch"
      a.nextSwap = now + 3500
      this.requestGesture("Focus")
    }
  }

  // --- per frame ----------------------------------------------------------------------------
  update(p: Perception): Intent {
    this.trackPointer(p)
    this.updateActivity(p)
    this.updateAttention(p)
    const intent = this.compose(p)
    this.gesture = null
    return intent
  }

  private trackPointer(p: Perception) {
    if (p.pointer.present && p.pointer.moving) {
      if (this.pointerMovingSince === null) this.pointerMovingSince = p.now
      this.pointerIdleSince = p.now
    } else if (p.now - this.pointerIdleSince > 400) {
      this.pointerMovingSince = null
    }
    if (p.hovered) {
      if (!this.hoverSince || this.hoverSince.id !== p.hovered) this.hoverSince = { id: p.hovered, at: p.now }
    } else {
      this.hoverSince = null
    }
  }

  private updateActivity(p: Perception) {
    const a = this.activity
    const now = p.now
    if (p.projectOpen && a.kind !== "project") this.openProject(p.projectOpen)
    if (!p.projectOpen && a.kind === "project") this.closeProject(now)

    // the visitor moved to another place: he comes along (unless busy with them)
    const stationChanged = p.cameraSettled && p.station !== this.lastStation
    if (stationChanged) {
      const first = this.lastStation === -1
      this.lastStation = p.station
      const spot = STATION_SPOTS[p.station]
      const kind = this.activity.kind
      if (!first && spot && kind !== "click" && kind !== "project" && dist(p.scopeAt, spot) > FAR_FROM_STATION) {
        this.activity = { kind: "explore", poi: null, goal: spot, phase: "travel", until: 0, why: "follows the visitor" }
        return
      }
    }

    switch (a.kind) {
      case "rest": {
        // glances: the world catches his eye now and then (gaze only, no gesture)
        if (a.glance && now > a.glance.until) {
          a.glance = null
          a.nextGlance = now + this.range(GLANCE_GAP_MS)
        } else if (!a.glance && now > a.nextGlance) {
          const near = this.pois.filter((q) => dist(q.spot, p.scopeAt) < 0.45 && q.kind !== "lamp")
          if (near.length) {
            const pick = near[Math.floor(this.random() * near.length)]
            a.glance = { id: pick.id, until: now + this.range(GLANCE_HOLD_MS) }
          } else {
            a.nextGlance = now + this.range(GLANCE_GAP_MS)
          }
        }
        // something the visitor keeps pointing at, near him: he goes to see it
        if (this.hoverSince && now - this.hoverSince.at > HOVER_TO_VISIT_MS && !p.reducedMotion) {
          const poi = this.pois.find((q) => q.id === this.hoverSince!.id)
          if (poi && poi.kind !== "lamp" && dist(poi.spot, p.scopeAt) < 0.6 && dist(poi.spot, p.scopeAt) > 0.04) {
            this.startExplore(poi, "the visitor pointed at it")
            return
          }
        }
        if (now > a.until && !p.reducedMotion) {
          const poi = this.pickPoi(p)
          if (poi) this.startExplore(poi, "curiosity")
          else this.activity = this.rest(now)
        }
        break
      }
      case "explore": {
        if (a.phase === "inspect" && now > a.until) {
          a.phase = "linger"
          a.until = now + this.range([1500, 3000])
        } else if (a.phase === "linger" && now > a.until) {
          this.activity = this.rest(now)
        }
        break
      }
      case "click":
        if (now > a.until) this.activity = this.rest(now)
        break
      case "welcome":
        if (now > a.until) this.activity = this.rest(now)
        break
      case "project":
        if (a.phase === "watch" && now > a.nextSwap) {
          // between the tile and the visitor, like someone showing you something
          a.lookVisitorUntil = now + 1600
          a.nextSwap = now + this.range([4500, 7000])
        }
        break
    }
  }

  private startExplore(poi: Poi, why: string) {
    this.visited = [...this.visited.slice(-1), poi.id]
    this.activity = { kind: "explore", poi, goal: poi.spot, phase: "travel", until: 0, why }
  }

  private pickPoi(p: Perception) {
    const here = this.pois.filter((q) => q.station === p.station && q.kind !== "lamp" && !this.visited.includes(q.id))
    const pool = here.length ? here : this.pois.filter((q) => q.station === p.station && q.kind !== "lamp")
    if (!pool.length) return null
    return pool[Math.floor(this.random() * pool.length)]
  }

  private updateAttention(p: Perception) {
    const now = p.now
    const att = this.attention
    const busyWithVisitor = this.activity.kind === "click" || this.activity.kind === "welcome"

    if (att.kind === "visitor" && now > att.until && !p.pointer.overScope) this.attention = { kind: "none" }
    if (att.kind === "curious" && now > att.until) this.attention = { kind: "none" }
    if (att.kind === "follow") {
      const idle = now - this.pointerIdleSince > POINTER_IDLE_RELEASE_MS || !p.pointer.present
      const tired = now - att.since > FOLLOW_BUDGET_MS
      if (idle || tired) {
        this.attention = { kind: "none" }
        if (tired) this.followBreakUntil = now + this.range(FOLLOW_BREAK_MS)
      }
    }
    if (busyWithVisitor || this.activity.kind === "project") {
      if (p.pointer.overScope) this.attention = { kind: "visitor", until: now + 600 }
      return
    }

    if (this.pendingLamp) {
      this.pendingLamp = false
      this.attention = { kind: "curious", target: { kind: "poi", id: "lamp" }, until: now + LAMP_LOOK_MS, why: "the lamp came on" }
      return
    }
    const cur = this.attention
    const rank = cur.kind === "none" ? -1 : cur.kind === "curious" ? 3 : cur.kind === "follow" ? 2 : 3

    if (p.pointer.overScope) {
      this.attention = { kind: "visitor", until: now + 900 }
      return
    }
    if (p.hovered && rank < 3) {
      this.attention = { kind: "curious", target: { kind: "poi", id: p.hovered }, until: now + 3500, why: "the visitor points at it" }
      return
    }
    if (cur.kind === "curious" && cur.target.kind === "poi" && cur.why === "the visitor points at it" && !p.hovered) {
      this.attention = { kind: "none" }
    }
    const movingFor = this.pointerMovingSince === null ? 0 : now - this.pointerMovingSince
    if (this.attention.kind === "none" && p.pointer.present && p.pointer.moving && now > this.followBreakUntil) {
      if (movingFor > FOLLOW_AFTER_MS) this.attention = { kind: "follow", since: now }
      else if (p.pointer.nearScope)
        this.attention = { kind: "curious", target: { kind: "pointer" }, until: now + 1200, why: "something moved near him" }
    } else if (this.attention.kind === "curious" && this.attention.target.kind === "pointer" && movingFor > FOLLOW_AFTER_MS) {
      this.attention = { kind: "follow", since: now }
    }
  }

  private compose(p: Perception): Intent {
    const a = this.activity
    let state: MindState = "rest"
    let activity = "resting"
    let gaze: GazeTarget = { kind: "none" }
    let weight = { eyes: 0, body: 0 }
    let goal: P2 | null = null
    let goalId: string | null = null
    let face: GazeTarget | null = null

    switch (a.kind) {
      case "rest":
        if (a.glance) {
          gaze = { kind: "poi", id: a.glance.id }
          weight = { eyes: 0.9, body: 0.45 }
          activity = `resting · glances at ${a.glance.id}`
        }
        break
      case "explore":
        state = "explore"
        goal = a.goal
        goalId = a.poi?.id ?? "station"
        if (a.phase === "travel") {
          gaze = { kind: "path" }
          weight = { eyes: 0.7, body: 0.3 }
          activity = a.poi ? `going to ${a.poi.id} (${a.why})` : `going along (${a.why})`
        } else if (a.poi) {
          gaze = { kind: "poi", id: a.poi.id }
          face = gaze
          weight = { eyes: 1, body: 0.8 }
          activity = `${a.phase === "inspect" ? "inspecting" : "lingering at"} ${a.poi.id}`
        } else {
          activity = "arrived"
        }
        break
      case "click":
        state = "interact"
        activity = "reacting to the visitor"
        gaze = { kind: "visitor" }
        face = gaze
        weight = { eyes: 0, body: 0.1 }
        break
      case "welcome":
        state = "interact"
        activity = "welcomes the visitor back"
        gaze = { kind: "visitor" }
        face = gaze
        weight = { eyes: 1, body: 1 }
        break
      case "project": {
        state = "interact"
        const poi = this.pois.find((q) => q.contentId === a.id)
        goal = poi?.spot ?? null
        goalId = poi?.id ?? null
        face = poi ? { kind: "poi", id: poi.id } : null
        const atVisitor = a.phase === "watch" && p.now < a.lookVisitorUntil
        gaze = a.phase === "travel" ? { kind: "path" } : atVisitor ? { kind: "visitor" } : poi ? { kind: "poi", id: poi.id } : gaze
        weight = a.phase === "travel" ? { eyes: 0.7, body: 0.3 } : { eyes: 1, body: 0.9 }
        activity = a.phase === "travel" ? `going to ${a.id}` : atVisitor ? `showing you ${a.id}` : `watching ${a.id}`
        break
      }
    }

    // attention overrides the gaze only
    const att = this.attention
    const attState: MindState | null =
      att.kind === "follow" ? "follow" : att.kind === "curious" ? "curious" : att.kind === "visitor" ? "curious" : null
    if (att.kind !== "none" && (a.kind !== "click" || att.kind === "visitor")) {
      if (att.kind === "follow") {
        gaze = { kind: "pointer" }
        weight = { eyes: 1, body: a.kind === "explore" && a.phase === "travel" ? 0.35 : 0.85 }
        activity += " · follows your pointer"
      } else if (att.kind === "curious") {
        gaze = att.target
        weight = { eyes: 1, body: 0.85 }
        activity += ` · curious: ${att.why}`
      } else if (a.kind !== "click") {
        gaze = { kind: "visitor" }
        weight = { eyes: 1, body: 1 }
        activity += " · looks at you"
      }
    }
    if (attState && PRIORITY[attState] > PRIORITY[state]) state = attState
    if (p.reducedMotion) weight = { eyes: 0, body: 0 }
    return { state, activity, gaze, weight, goal, goalId, face, gesture: this.gesture }
  }
}
