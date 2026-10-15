// The attention layer: only the gaze (look bone + eyes), never where he is or
// what he does. It runs every tick on top of whatever the activity is, so a
// look never interrupts a step or a gesture (Fase A §4.3: two layers).

import type { WorldDef } from "../../world-def.ts"
import { dist } from "../body/locomotor.ts"
import type { Memory } from "./memory.ts"
import type { Act, Look, ObjectId, Perception } from "./types.ts"

export interface GazeOut {
  look: Look
  weight: { eyes: number; body: number }
  tall: number
  /** Why (debug). */
  why: string
}

interface Glance {
  look: Look
  until: number
  why: string
  tall?: number
}

export class Attention {
  /** A click on an object he cannot attend to yet: he has seen it. */
  acknowledge: { id: ObjectId; until: number } | null = null
  /** Returning to a place: you, then the thing he did there. */
  recognition: { start: number; object: ObjectId | null } | null = null

  private glance: Glance | null = null
  private nextGlanceAt = 0
  private nextVisitorGlanceAt = 0
  private lookedAtSince = -1
  private lookBackCooldown = 0
  private readonly watched = new Map<ObjectId, { since: number; boredUntil: number }>()
  private readonly random: () => number
  private readonly def: WorldDef

  constructor(def: WorldDef, random: () => number) {
    this.def = def
    this.random = random
  }

  update(p: Perception, act: Act, memory: Memory, settledFor: number, alternate: ObjectId | null): GazeOut {
    const now = p.now
    const full = { eyes: 1, body: 1 }
    const travelling = act.kind === "go" && p.scope.moving

    // the act decides first: you when he reacts to you, the object he works with
    if (act.kind === "react") return { look: { kind: "visitor" }, weight: full, tall: 0, why: "reacciona a ti" }
    if (act.kind === "surprise") return { look: { kind: "point", at: act.from }, weight: full, tall: 0.6, why: "sorpresa" }
    if (act.kind === "nudge") return { look: { kind: "object", id: "ball" }, weight: full, tall: 0, why: "la bola" }
    if (act.kind === "shine") return { look: { kind: "object", id: act.object }, weight: full, tall: 0, why: "lo ilumina" }
    if (act.kind === "gesture" && act.face && act.face.kind !== "none") return { look: act.face, weight: { eyes: 1, body: 0.7 }, tall: 0, why: "lo que examina" }
    if (act.kind === "fit" || act.kind === "settle") return { look: { kind: "none" }, weight: { eyes: 0.5, body: 0.2 }, tall: 0, why: "se acomoda" }
    if (p.scope.inRefuge && !p.visitor.lookingAtScope) return { look: { kind: "none" }, weight: { eyes: 0.5, body: 0.2 }, tall: 0, why: "descansa" }

    if (this.acknowledge && now < this.acknowledge.until)
      return { look: { kind: "object", id: this.acknowledge.id }, weight: full, tall: 0.2, why: "ha visto lo que señalas" }

    // coming back to a place: a look at you, then at what he did there
    if (this.recognition) {
      const t = now - this.recognition.start
      if (t < 0.9) return { look: { kind: "visitor" }, weight: full, tall: 0.35, why: "te reconoce el regreso" }
      if (t < 2.4 && this.recognition.object) return { look: { kind: "object", id: this.recognition.object }, weight: full, tall: 0.15, why: "se acuerda" }
      if (t >= 2.4) this.recognition = null
    }

    // you look at him (the pointer rests on him): he looks back, for a while, then
    // returns to his things (he does not stare back for as long as you look)
    if (p.visitor.lookingAtScope) {
      if (this.lookedAtSince < 0) this.lookedAtSince = now
      const held = now - this.lookedAtSince
      if (held >= 4.5 && now >= this.lookBackCooldown) this.lookBackCooldown = now + 12
      else if (held > 0.5 && now >= this.lookBackCooldown) return { look: { kind: "visitor" }, weight: full, tall: 0.1, why: "le estás mirando" }
    } else this.lookedAtSince = -1

    // guiding: alternate between what he wants to show and you
    if (alternate) {
      const phase = Math.floor(now / 1.4) % 2
      return phase ? { look: { kind: "visitor" }, weight: full, tall: 0, why: "¿lo ves?" } : { look: { kind: "object", id: alternate }, weight: full, tall: 0, why: "te lo enseña" }
    }

    // something moving or changing nearby catches his eye (he gets used to it)
    const salient = this.salient(p)
    if (salient) return { look: { kind: "object", id: salient }, weight: travelling ? { eyes: 1, body: 0.5 } : full, tall: 0, why: "le llama la atención" }

    if (this.glance && now < this.glance.until) return { look: this.glance.look, weight: travelling ? { eyes: 0.9, body: 0.5 } : full, tall: this.glance.tall ?? 0, why: this.glance.why }
    this.glance = null

    if (travelling) {
      // on the way: ahead, and now and then a look at you (he goes WITH you)
      if (now >= this.nextVisitorGlanceAt) {
        this.nextVisitorGlanceAt = now + 4 + this.random() * 3
        this.glance = { look: { kind: "visitor" }, until: now + 0.8, why: "comprueba que vienes" }
        return { look: this.glance.look, weight: { eyes: 1, body: 0.5 }, tall: 0, why: this.glance.why }
      }
      return { look: { kind: "ahead" }, weight: { eyes: 0.9, body: 0.45 }, tall: 0, why: "mira el camino" }
    }

    // doing nothing for a while: ONE look at you per visit to a place, and back to his things
    const zone = memory.zones[p.visitor.zone]
    const [a, b] = this.def.timing.idleLookAt
    const lookAt = a + ((p.visitor.zone * 7.3) % 1) * (b - a)
    if (p.visitor.settled && !p.visitor.reading && !zone.idleLookDone && p.visitor.idle >= lookAt && settledFor >= lookAt) {
      zone.idleLookDone = true
      memory.note(now, `te mira una vez: llevas ${Math.round(p.visitor.idle)} s sin hacer nada`)
      this.glance = { look: { kind: "visitor" }, until: now + 1.6, why: "te mira (una vez)", tall: 0.25 }
      return { look: this.glance.look, weight: full, tall: 0.25, why: this.glance.why }
    }

    // idle glances at things near him, with rests in between
    if (now >= this.nextGlanceAt) {
      this.nextGlanceAt = now + 3.5 + this.random() * 3.5
      const near = this.nearbyObject(p)
      if (near && this.random() < 0.7) {
        this.glance = { look: { kind: "object", id: near }, until: now + 1.4 + this.random() * 1.2, why: "mira algo cercano" }
        return { look: this.glance.look, weight: full, tall: 0, why: this.glance.why }
      }
    }
    return { look: { kind: "none" }, weight: full, tall: 0, why: "reposo" }
  }

  private salient(p: Perception): ObjectId | null {
    let best: ObjectId | null = null
    let bestS = 0.4
    for (const [id, o] of Object.entries(p.objects) as [ObjectId, NonNullable<Perception["objects"][ObjectId]>][]) {
      const w = this.watched.get(id) ?? { since: -1, boredUntil: 0 }
      if (o.salience < 0.4 || dist(o.at, p.scope.at) > 0.7 || p.now < w.boredUntil) {
        if (o.salience < 0.2) w.since = -1
        this.watched.set(id, w)
        continue
      }
      if (w.since < 0) w.since = p.now
      if (p.now - w.since > 5) {
        w.boredUntil = p.now + 8 // seen it
        w.since = -1
      }
      this.watched.set(id, w)
      if (o.salience > bestS && p.now >= w.boredUntil) {
        best = id
        bestS = o.salience
      }
    }
    return best
  }

  private nearbyObject(p: Perception): ObjectId | null {
    const station = this.def.stations[p.visitor.zone]
    const own = station.offer?.object as ObjectId | undefined
    const list = (Object.entries(p.objects) as [ObjectId, NonNullable<Perception["objects"][ObjectId]>][])
      .filter(([, o]) => dist(o.at, p.scope.at) < 0.5)
      .map(([id]) => id)
    if (own && list.includes(own) && this.random() < 0.5) return own
    return list.length ? list[Math.floor(this.random() * list.length)] : null
  }
}
