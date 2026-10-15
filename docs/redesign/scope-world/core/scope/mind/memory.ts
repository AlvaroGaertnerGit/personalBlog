// What Scope remembers during the visit (Fase A §4.7). In memory only: the lab
// forgets everything on reload, on purpose.

import { GESTURES, type Clip, type IdleGesture } from "../gestures.ts"
import type { ObjectId } from "./types.ts"

export interface ZoneMemory {
  /** The visitor's visits (settled arrivals). */
  visits: number
  lastAt: number
  /** He went ahead to show it, once. */
  guided: boolean
  /** Last time he showed you what this place does. */
  showcasedAt: number
  /** He looked at you for doing nothing here, during this visit. */
  idleLookDone: boolean
  /** The last thing he did here, to remember it when you come back. */
  lastThing: { object: ObjectId; what: string } | null
}

export interface LogLine {
  t: number
  text: string
}

export class Memory {
  readonly zones: ZoneMemory[]
  readonly objects = new Map<ObjectId, { inspectedAt: number; usedAt: number; uses: number }>()
  readonly clicks: number[] = []
  readonly clips: Clip[] = []
  readonly log: LogLine[] = []
  private readonly cooldownUntil = new Map<string, number>()

  constructor(zones: number) {
    this.zones = Array.from({ length: zones }, () => ({
      visits: 0,
      lastAt: -Infinity,
      guided: false,
      showcasedAt: -Infinity,
      idleLookDone: false,
      lastThing: null,
    }))
  }

  note(t: number, text: string) {
    const last = this.log[this.log.length - 1]
    if (last && last.text === text) return
    this.log.push({ t, text })
    if (this.log.length > 14) this.log.shift()
  }

  click(t: number) {
    this.clicks.push(t)
    while (this.clicks.length && t - this.clicks[0] > 20) this.clicks.shift()
  }

  /** Clicks on him within the window, this one included. */
  clicksWithin(t: number, window: number) {
    return this.clicks.filter((c) => t - c <= window).length
  }

  object(id: ObjectId) {
    let o = this.objects.get(id)
    if (!o) {
      o = { inspectedAt: -Infinity, usedAt: -Infinity, uses: 0 }
      this.objects.set(id, o)
    }
    return o
  }

  played(t: number, clip: Clip) {
    this.clips.push(clip)
    if (this.clips.length > 4) this.clips.shift()
    const spec = (GESTURES as Record<string, { family: string; cooldown: number }>)[clip]
    if (spec) this.cooldownUntil.set(spec.family, t + spec.cooldown)
  }

  /**
   * A gesture for an idle moment: weights ×0.25 if it was the last one, ×0.6 if
   * the one before; never the same family twice in a row; families cool down.
   */
  pickGesture(t: number, random: () => number, allowed: IdleGesture[] = Object.keys(GESTURES) as IdleGesture[]): IdleGesture | null {
    const last = this.clips[this.clips.length - 1]
    const prev = this.clips[this.clips.length - 2]
    const lastFamily = last ? (GESTURES as Record<string, { family: string }>)[last]?.family : undefined
    const options = allowed
      .map((g) => {
        const spec = GESTURES[g]
        if (spec.family === lastFamily) return [g, 0] as const
        if ((this.cooldownUntil.get(spec.family) ?? -Infinity) > t) return [g, 0] as const
        let w: number = spec.weight
        if (g === last) w *= 0.25
        if (g === prev) w *= 0.6
        return [g, w] as const
      })
      .filter(([, w]) => w > 0)
    const total = options.reduce((s, [, w]) => s + w, 0)
    if (!total) return null
    let r = random() * total
    for (const [g, w] of options) {
      r -= w
      if (r <= 0) return g
    }
    return options[options.length - 1][0]
  }
}
