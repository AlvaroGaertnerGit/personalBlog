// The four moods of light of the Entrega 2 study (entorno2.py) and blends between them. Pure
// data (no three.js): the stage applies them; the node tests read them.

import type { WorldDef } from "../world-def.ts"

type V3 = [number, number, number]

export interface Mood {
  label: string
  sun: { az: number; el: number; color: V3; intensity: number }
  zenith: V3
  horizon: V3
  glow: V3
  glowWidth: number
  haze: V3
  hemi: number
  lamp: number
  lantern: number
  exposure: number
  /** The desk lamp's light reaching the lab props (the radiometer's baseline). */
  ambientLight: number
}

// the Entrega 2 palettes (entorno2.py)
export const MOODS: Record<string, Mood> = {
  amanecer: { label: "Amanecer", sun: { az: 150, el: 9, color: [1, 0.7, 0.45], intensity: 2.6 }, zenith: [0.025, 0.03, 0.07], horizon: [0.4, 0.34, 0.44], glow: [1.5, 0.85, 0.4], glowWidth: 0.2, haze: [0.4, 0.35, 0.44], hemi: 0.55, lamp: 1, lantern: 0, exposure: 1.0, ambientLight: 2.5 },
  dia: { label: "Día", sun: { az: 140, el: 32, color: [1, 0.93, 0.84], intensity: 3.2 }, zenith: [0.07, 0.11, 0.22], horizon: [0.46, 0.45, 0.45], glow: [0.35, 0.3, 0.22], glowWidth: 0.12, haze: [0.52, 0.51, 0.52], hemi: 0.7, lamp: 1, lantern: 0, exposure: 0.85, ambientLight: 2.5 },
  atardecer: { label: "Atardecer", sun: { az: 200, el: 4, color: [1, 0.52, 0.28], intensity: 2.4 }, zenith: [0.03, 0.03, 0.07], horizon: [0.55, 0.3, 0.26], glow: [1.4, 0.6, 0.25], glowWidth: 0.25, haze: [0.45, 0.3, 0.3], hemi: 0.45, lamp: 1, lantern: 0.4, exposure: 1.0, ambientLight: 2.5 },
  noche: { label: "Noche", sun: { az: 110, el: 28, color: [0.55, 0.64, 1], intensity: 0.12 }, zenith: [0.004, 0.006, 0.014], horizon: [0.04, 0.055, 0.1], glow: [0.02, 0.03, 0.05], glowWidth: 0.3, haze: [0.035, 0.05, 0.09], hemi: 0.06, lamp: 0, lantern: 1, exposure: 1.2, ambientLight: 0 },
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

/** A light between two moods (the label is the nearer one's). */
export function mixMoods(a: Mood, b: Mood, t: number): Mood {
  return {
    label: t < 0.5 ? a.label : b.label,
    sun: { az: lerp(a.sun.az, b.sun.az, t), el: lerp(a.sun.el, b.sun.el, t), color: lerp3(a.sun.color, b.sun.color, t), intensity: lerp(a.sun.intensity, b.sun.intensity, t) },
    zenith: lerp3(a.zenith, b.zenith, t),
    horizon: lerp3(a.horizon, b.horizon, t),
    glow: lerp3(a.glow, b.glow, t),
    glowWidth: lerp(a.glowWidth, b.glowWidth, t),
    haze: lerp3(a.haze, b.haze, t),
    hemi: lerp(a.hemi, b.hemi, t),
    lamp: lerp(a.lamp, b.lamp, t),
    lantern: lerp(a.lantern, b.lantern, t),
    exposure: lerp(a.exposure, b.exposure, t),
    ambientLight: lerp(a.ambientLight, b.ambientLight, t),
  }
}


/** The light of a route at s: each place's own (Station.mood), blended over the middle of each segment. */
export function routeLight(def: WorldDef, s: number): Mood {
  const st = def.stations
  const c = Math.min(st.length - 1, Math.max(0, s))
  const i = Math.min(st.length - 2, Math.floor(c))
  const u = Math.min(1, Math.max(0, (c - i - 0.2) / 0.6))
  const of = (k: number) => MOODS[st[k].mood ?? "atardecer"] ?? MOODS.atardecer
  return mixMoods(of(i), of(i + 1), u * u * (3 - 2 * u))
}
