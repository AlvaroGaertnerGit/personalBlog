// Scope's mind in the lab (Entrega 3). Pure: time, randomness and the world
// are injected (mind.test.ts). It decides WHAT he does; the body decides how.
//
// Six groups of priority (Fase A §4.3). A higher group takes over only when
// the body says it may (between steps and clips, never mid-push or mid-air);
// a lower group never cuts in: the current behaviour runs while it still makes
// sense, then the best candidate starts.
//
//   5 guion       (not used in the lab: the entrance and the contact)
//   4 respuesta   reacción al clic · acudir a lo que señalas · sorpresa
//   3 compañía    salir del refugio · guiar · reagrupar · acompañar · esperar · volver a tu lado
//   2 curiosidad  enseñar (what the place offers) · recordar · investigar
//   1 vida propia refugio · descansar
//   0 reposo
//
// Places declare what they offer (WorldDef.stations[].offer): the mind picks
// among offers, so adding a place never touches this file.

import { segmentLength, type P2, type WorldDef } from "../../world-def.ts"
import type { IdleGesture } from "../gestures.ts"
import { dist, type Gait } from "../body/locomotor.ts"
import { Attention } from "./attention.ts"
import { anchorAt, bandOf, slotWhenSettled, slotWhileMoving } from "./companion.ts"
import { Memory } from "./memory.ts"
import { PRIORITY, type Act, type ClickEvent, type Group, type Intent, type Look, type ObjectId, type Perception } from "./types.ts"

interface Behavior {
  key: string
  group: Group
  state: string
  reason: string
  steps: Act[]
  /** After the last step: keep holding (resting, waiting for you) while `keep` holds. */
  hold?: boolean
  keep?: (p: Perception) => boolean
  /** Another step once the planned ones are done (re-push the ball...), or null. */
  next?: (p: Perception, b: Behavior) => Act | null
  onStart?: (p: Perception) => void
  onFinish?: (p: Perception) => void
  alternate?: ObjectId | null
  glow?: number
  /** Same behaviour, new goal: re-issue the go if it moved this much (m). */
  retarget?: number
  /** Gives way to these candidates of its own group (going with you yields to going ahead to show you). */
  yieldsTo?: (key: string) => boolean
}

interface Running extends Behavior {
  i: number
  seq: number
  startedAt: number
  finished: boolean
  pushes: number
}

const STILL: Act = { kind: "idle" }
const VISITOR: Look = { kind: "visitor" }
const lookAt = (id: ObjectId): Look => ({ kind: "object", id })
const fmt = (n: number) => n.toFixed(2).replace(".", ",")

export interface MindOptions {
  random?: () => number
}

export class ScopeMind {
  readonly memory: Memory
  readonly def: WorldDef
  readonly attention: Attention
  /** Seconds each state has been reported (the "rest dominates" test). */
  readonly timeIn = new Map<string, number>()

  private cur: Running | null = null
  private seq = 0
  private readonly random: () => number
  private pendingClick: ClickEvent | null = null
  private settledSince = -1
  private readingSince = -1
  private offscreenSince = -1
  private lastSettledZone = -1
  private recalledVisit = -1
  private visitStart = 0
  private backwardsNoted = -1
  private surpriseFrom: P2 | null = null
  private surpriseAt = -Infinity
  private lastPushAt = -Infinity
  private tallUntil = 0
  private lastNow = 0
  private playedSeq = -1
  private inspectedVisit = -1
  /** Why he looks where he looks (debug panel). */
  gazeWhy = ""

  constructor(def: WorldDef, { random = Math.random }: MindOptions = {}) {
    this.def = def
    this.random = random
    this.memory = new Memory(def.stations.length)
    this.attention = new Attention(def, random)
  }

  /** Scope's home: the place that offers rest. */
  private get home() {
    return Math.max(0, this.def.stations.findIndex((s) => s.offer?.kind === "rest"))
  }

  get current() {
    return this.cur
  }

  tick(p: Perception): Intent {
    this.observe(p)
    this.advance(p)
    const cand = this.choose(p)
    const cur = this.cur
    if (!cur) this.start(cand, p)
    else if (cand.key !== cur.key) {
      const higher = PRIORITY[cand.group] > PRIORITY[cur.group]
      const wanted = (cur.finished ? !!cur.hold && (cur.keep?.(p) ?? false) : cur.keep?.(p) ?? true) && !cur.yieldsTo?.(cand.key)
      const free = cur.finished || p.scope.act.seq !== cur.seq || p.scope.act.interruptible
      if (cand.group === "guion" || ((higher || !wanted) && free)) this.start(cand, p)
    } else if (cur.finished && !cur.hold) {
      this.start(cand, p) // the same need again (still far from you after arriving...)
    } else if (cur.retarget && cand.steps[0]?.kind === "go") {
      const now = cur.steps[cur.i]
      const goal = cand.steps[0]
      if (now?.kind === "go" && (dist(now.goal, goal.goal) > cur.retarget || now.gait !== goal.gait)) {
        cur.steps[cur.i] = goal
        cur.seq = ++this.seq
        cur.finished = false
        cur.reason = cand.reason
      }
    }
    return this.intent(p)
  }

  // --- perception bookkeeping ---------------------------------------------------------
  private observe(p: Perception) {
    const { now, visitor: v, scope } = p
    const dt = Math.max(0, now - this.lastNow)
    this.lastNow = now
    if (this.cur) this.timeIn.set(this.cur.state, (this.timeIn.get(this.cur.state) ?? 0) + dt)

    this.settledSince = v.settled ? (this.settledSince < 0 ? now : this.settledSince) : -1
    this.readingSince = v.reading ? (this.readingSince < 0 ? now : this.readingSince) : -1
    this.offscreenSince = scope.visible || scope.inRefuge ? -1 : this.offscreenSince < 0 ? now : this.offscreenSince

    // a visit: the camera settles on a place
    if (v.settled && v.zone !== this.lastSettledZone) {
      const z = this.memory.zones[v.zone]
      z.visits++
      z.lastAt = now
      z.idleLookDone = false
      this.lastSettledZone = v.zone
      this.visitStart = now
      this.memory.note(now, z.visits === 1 ? `llegas por primera vez a «${this.def.stations[v.zone].label}»` : `vuelves a «${this.def.stations[v.zone].label}» (visita ${z.visits})`)
    }
    // going back toward a place you already saw: he recognises the change at once
    if (v.sVel < -0.08) {
      const target = Math.max(0, Math.floor(v.s))
      const z = this.memory.zones[target]
      if (z.visits > 0 && this.backwardsNoted !== target) {
        this.backwardsNoted = target
        this.attention.recognition = { start: now, object: z.lastThing?.object ?? null }
        this.memory.note(now, `das la vuelta hacia «${this.def.stations[target].label}»: lo reconoce${z.lastThing ? ` y se acuerda de ${z.lastThing.what}` : ""}`)
      }
    } else if (v.sVel > 0.08) this.backwardsNoted = -1

    for (const c of p.clicks) {
      if (c.target.kind === "scope") this.memory.click(c.t)
      // he looks at what you point at straight away, even if he can only go later
      if (c.target.kind === "object") this.attention.acknowledge = { id: c.target.id, until: now + 1.2 }
      this.pendingClick = c
    }

    // the ball rolling at him when he did not push it: surprise (his own push is not a surprise)
    if (scope.act.kind === "nudge") this.lastPushAt = now
    const ball = p.objects.ball
    if (ball && ball.moving && now - this.lastPushAt > 1.2 && dist(ball.at, scope.at) < 0.13 && now - this.surpriseAt > 4) {
      this.surpriseFrom = ball.at
    }
    // you leave all of a sudden
    if (Math.abs(v.sVel) > 1.6 && now > this.tallUntil + 2) this.tallUntil = now + 0.6
  }

  /** The body finished the current step: next step, generated step, or done. */
  private advance(p: Perception) {
    const cur = this.cur
    if (!cur || cur.finished) return
    if (p.scope.act.seq !== cur.seq || !p.scope.act.done) return
    if (cur.i + 1 < cur.steps.length) {
      cur.i++
      cur.seq = ++this.seq
      return
    }
    const extra = cur.next?.(p, cur) ?? null
    if (extra) {
      cur.steps.push(extra)
      cur.i++
      cur.seq = ++this.seq
      return
    }
    cur.finished = true
    cur.onFinish?.(p)
  }

  private start(b: Behavior, p: Perception) {
    const prev = this.cur
    this.cur = { ...b, i: 0, seq: ++this.seq, startedAt: p.now, finished: false, pushes: 0 }
    b.onStart?.(p)
    if (!prev || prev.state !== b.state || prev.key !== b.key) this.memory.note(p.now, `${b.state}: ${b.reason}`)
  }

  // --- choosing -------------------------------------------------------------------------
  private choose(p: Perception): Behavior {
    const { now, visitor: v, scope } = p
    const d = dist(scope.at, v.anchor)
    const band = bandOf(this.def, d, dist(scope.at, v.eye))
    const moving = Math.abs(v.sVel) > 0.06
    const settledFor = this.settledSince < 0 ? 0 : now - this.settledSince
    const offscreenFor = this.offscreenSince < 0 ? 0 : now - this.offscreenSince
    const zone = this.memory.zones[v.zone]
    const station = this.def.stations[v.zone]

    // 4 · respuesta
    if (this.pendingClick) {
      const r = this.respond(this.pendingClick, p)
      if (r) return r
    }
    if (this.surpriseFrom && !p.reduced) {
      const from = this.surpriseFrom
      return {
        key: `sorpresa:${now.toFixed(1)}`,
        group: "respuesta",
        state: "sorpresa",
        reason: "la bola viene hacia él sin que la haya empujado",
        steps: [{ kind: "surprise", from }],
        onStart: () => {
          this.surpriseFrom = null
          this.surpriseAt = now
        },
      }
    }

    // 3 · compañía
    if (scope.inRefuge && this.visitorActive(p))
      return { key: "salir", group: "compania", state: "salir del refugio", reason: moving ? "te pones en marcha: se asoma y sale" : "has vuelto: sale a verte", steps: [{ kind: "unfit" }] }
    // guiding is for a walk to the next place; a jump across the route is a regroup
    const heading = v.s + v.sVel * 0.6
    if (moving && v.sVel > 0.1 && v.sVel < 1 && heading < Math.floor(v.s + 1e-6) + 1.6 && !p.reduced) {
      const j = Math.min(this.def.stations.length - 1, Math.floor(v.s + 1e-6) + 1)
      const zj = this.memory.zones[j]
      const offer = this.def.stations[j].offer
      if (offer && zj.visits === 0 && !zj.guided) return this.guide(j)
    }
    if (this.cur?.key.startsWith("guiar:") && !this.cur.finished && this.cur.keep?.(p)) return this.cur
    // out of frame counts as lost, unless he is on an errand near you (showing, answering,
    // going home): that errand ends in view; only real distance cuts it short
    const errand = !!this.cur && !this.cur.finished && (this.cur.group === "curiosidad" || this.cur.group === "respuesta" || this.cur.key === "refugio")
    if (band === "perdido" || (offscreenFor > this.def.offscreenLostS && !errand)) {
      const slot = moving ? slotWhileMoving(this.def, v.s, v.sVel, true, v.eye) : slotWhenSettled(this.def, v.zone, scope.at, v.anchor, false).at
      const why = offscreenFor > this.def.offscreenLostS ? `lleva ${offscreenFor.toFixed(1)} s fuera de cuadro` : `está a ${fmt(d)} m de ti`
      return {
        key: "reagrupar",
        group: "compania",
        state: "reagrupar",
        reason: `${why}: vuelve con prisa`,
        steps: [{ kind: "go", goal: slot, gait: "bound", face: moving ? null : VISITOR, follow: true }],
        retarget: 0.05,
        keep: () => true,
        next: (_q, b) => {
          const took = this.lastNow - (this.cur?.startedAt ?? this.lastNow)
          if (b.steps.length > 1 || took < this.def.timing.regroupBlinkAfter) return null
          return { kind: "gesture", clip: "BlinkDouble", face: VISITOR }
        },
      }
    }
    if (moving) {
      const visitorSpeed = Math.abs(v.sVel) * segmentLength(this.def, v.s)
      const ahead = v.sVel > 0
      const slot = slotWhileMoving(this.def, v.s, v.sVel, ahead, v.eye)
      const ds = dist(scope.at, slot)
      const gait: Gait = ds > 0.3 || visitorSpeed > 0.16 ? "bound" : ds > 0.1 || visitorSpeed > 0.07 ? "trot" : "walk"
      return {
        key: "acompanar",
        group: "compania",
        state: "acompañar",
        reason: `te mueves (${fmt(visitorSpeed)} m/s) hacia «${this.def.stations[Math.round(v.s + Math.sign(v.sVel) * 0.5)]?.label ?? station.label}»: va ${ahead ? "un poco por delante" : "contigo"}`,
        steps: [{ kind: "go", goal: slot, gait, face: null, follow: true }],
        retarget: 0.04,
        keep: () => true,
        yieldsTo: (key) => key.startsWith("guiar:"),
      }
    }
    if (v.reading) {
      const readFor = this.readingSince < 0 ? 0 : now - this.readingSince
      if (readFor < this.def.timing.readingStill || p.reduced)
        return {
          key: "esperar",
          group: "compania",
          state: "esperar",
          reason: "estás leyendo: no se mueve ni hace gestos",
          steps: [STILL],
          hold: true,
          keep: (q) => q.visitor.reading && (q.reduced || q.now - this.readingSince < this.def.timing.readingStill),
        }
      if (v.zone === this.home) return this.refuge("estás leyendo junto a su casa: entra a descansar mientras tanto", (q) => !this.visitorActive(q))
      return { key: "esperar-descansa", group: "compania", state: "descansar mientras lees", reason: `llevas ${Math.round(readFor)} s leyendo: se asienta a esperar`, steps: [{ kind: "settle" }], hold: true, keep: (q) => q.visitor.reading, glow: 0.03 }
    }
    // a purposeful errand near you (showing, answering, going home) is not "being away"
    const busyCurious = !!this.cur && !this.cur.finished && (this.cur.group === "curiosidad" || this.cur.group === "respuesta" || this.cur.key === "refugio")
    if (v.settled && !busyCurious && (band === "tensa" || band === "cerca" || (!scope.visible && !scope.inRefuge))) {
      const spot = slotWhenSettled(this.def, v.zone, scope.at, v.anchor, scope.visible, v.eye)
      if (!spot.stay && !scope.inRefuge)
        return {
          key: `volver:${v.zone}`,
          group: "compania",
          state: "volver a tu lado",
          reason: band === "cerca" ? "está demasiado cerca de ti: se aparta un paso" : `te has parado a ${fmt(d)} m: vuelve sin prisa`,
          steps: [{ kind: "go", goal: spot.at, gait: band === "cerca" ? "walk" : "trot", face: VISITOR, follow: false }],
        }
    }

    // 2 · curiosidad (you are here, settled, not reading)
    if (v.settled && !scope.inRefuge && !p.reduced) {
      const offer = station.offer
      // once per visit (and not again soon after, across visits): a place is shown, not performed
      if (offer && settledFor >= this.def.timing.showcaseAfter && zone.showcasedAt < this.visitStart && now - zone.showcasedAt > this.def.timing.showcaseCooldown) {
        const show = this.showcase(v.zone, p)
        if (show) return show
      }
      if (zone.lastThing && zone.visits > 1 && this.recalledVisit !== this.visitStart && settledFor >= 1.5) {
        const thing = zone.lastThing
        return {
          key: `recordar:${v.zone}`,
          group: "curiosidad",
          state: "recordar",
          reason: `vuelves a «${station.label}»: se acuerda de ${thing.what}`,
          steps: [{ kind: "gesture", clip: "Focus", face: lookAt(thing.object) }],
          onStart: () => (this.recalledVisit = this.visitStart),
        }
      }
      if (settledFor >= this.def.timing.inspectAfter && v.idle >= this.def.timing.inspectAfter * 0.8 && this.inspectedVisit !== this.visitStart) {
        const look = this.inspect(p)
        if (look) return look
      }
    }

    // 1 · vida propia
    if (this.cur?.key === "refugio" && (scope.inRefuge || !this.cur.finished) && !this.visitorActive(p)) return this.cur
    if (!p.reduced && v.zone === this.home && v.idle >= this.def.timing.refugeAfter) return this.refuge(`llevas ${Math.round(v.idle)} s quieto junto a su casa: entra a descansar`, (q) => !this.visitorActive(q))
    if (v.idle >= this.def.timing.restAfter && !scope.inRefuge)
      return { key: "descansar", group: "vida", state: "descansar", reason: `llevas ${Math.round(v.idle)} s sin hacer nada: se asienta`, steps: [{ kind: "settle" }], hold: true, keep: (q) => !this.visitorActive(q), glow: 0.03 }

    // 0 · reposo
    return { key: "reposo", group: "reposo", state: "reposo", reason: band === "comoda" ? `a tu lado (${fmt(d)} m), tranquilo` : "tranquilo", steps: [STILL], hold: true, keep: () => true }
  }

  private visitorActive(p: Perception) {
    return Math.abs(p.visitor.sVel) > 0.06 || p.visitor.idle < 0.5
  }

  private respond(c: ClickEvent, p: Perception): Behavior | null {
    const { now, visitor: v, scope } = p
    const consume = () => (this.pendingClick = null)
    if (c.target.kind === "scope") {
      const n = this.memory.clicksWithin(now, this.def.timing.clickWindow)
      let variant: "full" | "blink" | "tilt" | "hop" | "peek" = "full"
      let why = "le has tocado: se gira hacia ti y reacciona"
      if (p.reduced) [variant, why] = ["blink", "le has tocado (movimiento reducido): un parpadeo"]
      else if (scope.inRefuge) [variant, why] = ["peek", "le has tocado en su casa: se asoma"]
      else if (v.reading) [variant, why] = ["blink", "le has tocado mientras lees: solo parpadea, no te interrumpe"]
      else if (n >= 3) [variant, why] = ["blink", `${n}.º toque en ${this.def.timing.clickWindow} s: ya no lo celebra, solo parpadea`]
      else if (n === 2) [variant, why] = ["tilt", "segundo toque seguido: ladea la cabeza"]
      else if (scope.moving) [variant, why] = ["hop", "le has tocado de camino: se para, te mira, un saltito y sigue"]
      return { key: `reaccion:${c.t.toFixed(2)}`, group: "respuesta", state: "reacción al clic", reason: why, steps: [{ kind: "react", variant }], onStart: consume }
    }
    if (v.reading || p.reduced) {
      // reading rules: he only looks
      this.attention.acknowledge = { id: c.target.kind === "object" ? c.target.id : "ball", until: now + 1.6 }
      if (c.target.kind === "ground") this.attention.acknowledge = null
      consume()
      return null
    }
    if (c.target.kind === "ground") {
      const at = c.target.at
      if (dist(at, scope.at) > 0.35) {
        consume()
        return null
      }
      return {
        key: `mirar:${c.t.toFixed(2)}`,
        group: "respuesta",
        state: "acudir",
        reason: "señalas el suelo cerca de él: va a ver qué hay",
        steps: [
          { kind: "go", goal: toward(scope.at, at, 0.06), gait: "walk", face: { kind: "point", at }, follow: false },
          { kind: "gesture", clip: "Focus", face: { kind: "point", at } },
        ],
        onStart: consume,
      }
    }
    const id = c.target.id
    const zoneOf = (o: ObjectId) => Math.max(0, this.def.stations.findIndex((s) => s.offer?.object === o))
    const done = (what: string) => (q: Perception) => {
      const z = this.memory.zones[zoneOf(id)]
      z.lastThing = { object: id, what }
      z.showcasedAt = q.now
      this.memory.object(id).usedAt = q.now
    }
    if (id === "lantern") return { ...this.refuge("señalas su casa: entra a descansar", (q) => !this.visitorActive(q) || q.now - c.t < 2), group: "respuesta", key: `acudir:lantern:${c.t}`, onStart: consume }
    if (id === "ball")
      return {
        key: `acudir:ball:${c.t}`,
        group: "respuesta",
        state: "acudir",
        reason: "señalas la bola: va a empujarla hacia ti",
        steps: [{ kind: "nudge", object: "ball", toward: this.towardYou(p) }],
        next: this.repush(() => this.towardYou(p)),
        onStart: (q) => {
          consume()
          this.lastPushAt = q.now
        },
        onFinish: done("la bola"),
      }
    if (id === "flower" || id === "radiometer")
      return {
        key: `acudir:${id}:${c.t}`,
        group: "respuesta",
        state: "acudir",
        reason: `señalas ${id === "flower" ? "la flor" : "el radiómetro"}: va a iluminarlo`,
        steps: [{ kind: "shine", object: id, hold: id === "flower" ? 4.5 : 3.5 }],
        onStart: consume,
        onFinish: done(id === "flower" ? "la flor" : "el radiómetro"),
      }
    return {
      key: `acudir:cabinet:${c.t}`,
      group: "respuesta",
      state: "acudir",
      reason: "señalas el gabinete: va a mirarlo",
      steps: this.cabinetSteps(p),
      onStart: consume,
      onFinish: done("el gabinete"),
    }
  }

  private guide(j: number): Behavior {
    const station = this.def.stations[j]
    const object = (station.offer?.object ?? null) as ObjectId | null
    return {
      key: `guiar:${j}`,
      group: "compania",
      state: "guiar",
      reason: `vas hacia «${station.label}», que aún no has visto: se adelanta para enseñártelo`,
      steps: [{ kind: "go", goal: station.wait, gait: "bound", face: object ? lookAt(object) : VISITOR, follow: false }],
      hold: true,
      alternate: object,
      // he waits there while you are on your way; once you stop, the places decide
      // (if you stopped there, "enseñar" takes over at once)
      keep: (q) => !q.visitor.settled && q.visitor.sVel > -0.06,
      onStart: () => (this.memory.zones[j].guided = true),
    }
  }

  private showcase(z: number, p: Perception): Behavior | null {
    const station = this.def.stations[z]
    const offer = station.offer
    if (!offer) return null
    const zone = this.memory.zones[z]
    const finish = (object: ObjectId, what: string) => (q: Perception) => {
      zone.showcasedAt = q.now
      zone.lastThing = { object, what }
      this.memory.object(object).usedAt = q.now
    }
    // marked as shown only when it is done: interrupted (you touched him), he takes it up again
    const base = { group: "curiosidad" as Group, state: "enseñar", key: `ensenar:${z}` }
    switch (offer.kind) {
      case "rest":
        return {
          ...base,
          reason: "estás en su casa: te la enseña",
          steps: [
            { kind: "go", goal: this.def.places.lanternDoor.outside, gait: "walk", face: lookAt("lantern"), follow: false },
            { kind: "gesture", clip: "Focus", face: lookAt("lantern") },
          ],
          onFinish: finish("lantern", "su casa"),
        }
      case "inspect":
        return { ...base, reason: "en su gabinete: mira lo que ha ido encontrando (o pone la bola en su sitio)", steps: this.cabinetSteps(p), onFinish: finish("cabinet", "su gabinete") }
      case "nudge": {
        const toward = this.towardYou(p)
        return {
          ...base,
          reason: "la bola de papel: te la acerca empujándola con la cara",
          steps: [{ kind: "nudge", object: "ball", toward }],
          next: this.repush(() => this.towardYou(p)),
          onStart: (q) => (this.lastPushAt = q.now),
          onFinish: finish("ball", "la bola"),
        }
      }
      case "shine": {
        const what = offer.object === "flower" ? "la flor" : "el radiómetro"
        return {
          ...base,
          reason: `${what}: lo activa con su luz para que lo veas`,
          steps: [{ kind: "shine", object: offer.object, hold: offer.object === "flower" ? 4.5 : 3.5 }],
          onFinish: finish(offer.object, what),
        }
      }
    }
  }

  private cabinetSteps(p: Perception): Act[] {
    const ball = p.objects.ball
    // the ball has rolled over to his cabinet: he puts it in its corner
    if (ball && dist(ball.at, this.def.places.ball.tidy) > 0.07 && dist(ball.at, this.def.places.ball.tidy) < 0.2) return [{ kind: "nudge", object: "ball", toward: this.def.places.ball.tidy }]
    const front: P2 = [(this.def.places.cabinet.min[0] + this.def.places.cabinet.max[0]) / 2, this.def.places.cabinet.min[1] - 0.075]
    const g = this.memory.pickGesture(p.now, this.random, ["Focus", "Tilt"]) ?? "Focus"
    return [
      { kind: "go", goal: front, gait: "walk", face: lookAt("cabinet"), follow: false },
      { kind: "gesture", clip: g, face: lookAt("cabinet") },
    ]
  }

  /** Up to three pushes until the ball is near where he wants it. */
  private repush(target: () => P2) {
    return (p: Perception) => {
      const run = this.cur
      const ball = p.objects.ball
      if (!run || !ball || run.pushes >= 2) return null
      const goal = target()
      if (dist(ball.at, goal) < 0.09 || ball.moving) return null
      run.pushes++
      this.lastPushAt = p.now
      return { kind: "nudge", object: "ball", toward: goal } as Act
    }
  }

  /** In front of your anchor, toward the camera, where the floor is open. */
  private towardYou(p: Perception): P2 {
    const a = anchorAt(this.def, p.visitor.s)
    return [a[0] + (p.visitor.eye[0] - a[0]) * 0.25, a[1] + (p.visitor.eye[1] - a[1]) * 0.25]
  }

  private inspect(p: Perception): Behavior | null {
    const near = (Object.entries(p.objects) as [ObjectId, NonNullable<Perception["objects"][ObjectId]>][])
      .filter(([id, o]) => id !== "lantern" && dist(o.at, p.visitor.anchor) < this.def.timing.inspectRadius && p.now - this.memory.object(id).inspectedAt > this.def.timing.inspectCooldown)
      .sort((a, b) => dist(a[1].at, p.scope.at) - dist(b[1].at, p.scope.at))[0]
    if (!near) return null
    const [id, o] = near
    const spot = beside(o.at, p.scope.at, p.visitor.eye, id === "cabinet" ? 0.13 : 0.11)
    const g: IdleGesture = this.memory.pickGesture(p.now, this.random, ["Focus", "Tilt", "LookAround"]) ?? "Focus"
    return {
      key: `investigar:${id}:${Math.floor(p.now / this.def.timing.inspectCooldown)}`,
      group: "curiosidad",
      state: "investigar",
      reason: `te has quedado aquí: se acerca ${toLabel(id)} a mirarlo (${g})`,
      steps: [
        { kind: "go", goal: spot, gait: "walk", face: lookAt(id), follow: false },
        { kind: "gesture", clip: g, face: lookAt(id) },
      ],
      onStart: () => {
        this.memory.object(id).inspectedAt = p.now
        this.inspectedVisit = this.visitStart
      },
    }
  }

  private refuge(reason: string, keep: (p: Perception) => boolean): Behavior {
    // (his light inside the lantern is the fit's own: it rises only once he is seated)
    return { key: "refugio", group: "vida", state: "refugio", reason, steps: [{ kind: "fit" }], hold: true, keep }
  }

  // --- output ---------------------------------------------------------------------------
  private intent(p: Perception): Intent {
    const cur = this.cur!
    const act = cur.finished ? (cur.steps[cur.steps.length - 1] ?? STILL) : cur.steps[cur.i]
    const settledFor = this.settledSince < 0 ? 0 : p.now - this.settledSince
    const alt = cur.alternate && cur.finished ? cur.alternate : null
    const gaze = this.attention.update(p, cur.finished ? STILL : act, this.memory, settledFor, alt)
    if (act.kind === "gesture" && p.scope.act.seq === cur.seq && p.scope.act.phase === "clip" && this.playedSeq !== cur.seq) {
      this.playedSeq = cur.seq
      this.memory.played(p.now, act.clip)
    }
    this.gazeWhy = gaze.why
    const tall = Math.max(gaze.tall, p.now < this.tallUntil ? 0.5 : 0)
    return {
      group: cur.group,
      state: cur.finished && cur.hold ? stateHeld(cur.state) : cur.state,
      reason: cur.reason,
      act: { ...act, seq: cur.seq },
      gaze: gaze.look,
      gazeWeight: gaze.weight,
      glow: cur.glow ?? 0.06,
      tall,
    }
  }

}

function stateHeld(s: string) {
  if (s === "refugio") return "descansando en su refugio"
  if (s === "guiar") return "guiar (te espera allí)"
  return s
}

function toward(from: P2, to: P2, keep: number): P2 {
  const d = dist(from, to)
  if (d < 1e-6) return from
  const k = Math.max(0, d - keep) / d
  return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]
}

/** Next to a thing as you see it, on his side, a little behind it: never hiding it, never hidden by it. */
function beside(obj: P2, from: P2, eye: P2, r: number): P2 {
  const e = [eye[0] - obj[0], eye[1] - obj[1]]
  const l = Math.hypot(e[0], e[1]) || 1
  const toEye = [e[0] / l, e[1] / l]
  const side = [-toEye[1], toEye[0]]
  const sign = (from[0] - obj[0]) * side[0] + (from[1] - obj[1]) * side[1] >= 0 ? 1 : -1
  const out = [side[0] * sign - toEye[0] * 0.3, side[1] * sign - toEye[1] * 0.3]
  const k = r / Math.hypot(out[0], out[1])
  return [obj[0] + out[0] * k, obj[1] + out[1] * k]
}

function toLabel(id: ObjectId) {
  return { ball: "a la bola", flower: "a la flor", radiometer: "al radiómetro", lantern: "a su casa", cabinet: "al gabinete" }[id]
}
