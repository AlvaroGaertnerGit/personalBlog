// Contract between /scope-lab (controls) and /scope-lab/preview (the site
// simulation, rendered in an iframe so its media queries see a real phone or
// desktop viewport). Settings travel in the URL (so the preview also works on
// its own, e.g. on a real phone) and live over postMessage afterwards.

export const PREVIEW_SIZES = [80, 96, 128, 160, 200] as const
export type PreviewSize = (typeof PREVIEW_SIZES)[number]

export type PreviewScene = "hero" | "about"
export type PreviewTheme = "dark" | "light"
export const PREVIEW_PIXEL_RATIOS = ["auto", 1, 1.5, 2, 3] as const
export type PreviewPixelRatio = (typeof PREVIEW_PIXEL_RATIOS)[number]
/** Supersampling: "auto" = the resolution policy; 1 = the previous renderer (MSAA only). */
export const PREVIEW_SSAA = ["auto", 1, 2, 3] as const
export type PreviewSsaa = (typeof PREVIEW_SSAA)[number]

export interface PreviewSettings {
  /** CSS px of the square container that holds Scope's canvas. */
  size: PreviewSize
  scene: PreviewScene
  theme: PreviewTheme
  autonomous: boolean
  /** "auto" = the device pixel ratio (exact device pixels), the production default. */
  pixelRatio: PreviewPixelRatio
  ssaa: PreviewSsaa
  /** Eye glow (bloom). */
  halo: boolean
  /** ×6 pixel-exact magnifier of the canvas, for judging sharpness. */
  loupe: boolean
}

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  size: 160,
  scene: "hero",
  theme: "dark",
  autonomous: true,
  pixelRatio: "auto",
  ssaa: "auto",
  halo: true,
  loupe: false,
}

/** Where Scope sits on the real site today (2D companion), for reference. */
export const PRODUCTION_SLOTS: Record<PreviewScene, string> = {
  hero: "Hero platform: 160 px (≥640 px viewport: 192 px)",
  about: "About: 136 px (≥640 px: 163 px) = 0.85 × the hero size",
}

export interface PreviewStatus {
  ready: boolean
  error?: string
  state: string
  nextInMs: number | null
  fps: number
  devicePixelRatio: number
  pixelRatio: number
  ssaa: number
  /** Backing-store size of the canvas in device pixels. */
  canvasPx: readonly [number, number]
  /** Supersampled render size. */
  internalPx: readonly [number, number]
  cpuMs: number
  governed: boolean
  log: string[]
}

export type LabToPreview =
  | { source: "scope-lab"; type: "settings"; settings: PreviewSettings }
  | { source: "scope-lab"; type: "click" | "trigger" }

export type PreviewToLab = { source: "scope-preview"; type: "status"; status: PreviewStatus }

export function settingsToQuery(s: PreviewSettings) {
  return new URLSearchParams({
    size: String(s.size),
    scene: s.scene,
    theme: s.theme,
    autonomous: s.autonomous ? "1" : "0",
    dpr: String(s.pixelRatio),
    ssaa: String(s.ssaa),
    halo: s.halo ? "1" : "0",
    loupe: s.loupe ? "1" : "0",
  }).toString()
}

export function settingsFromQuery(search: string): PreviewSettings {
  const q = new URLSearchParams(search)
  const d = DEFAULT_PREVIEW_SETTINGS
  const size = Number(q.get("size"))
  const dpr = q.get("dpr")
  const ratio = dpr === "auto" ? "auto" : Number(dpr)
  const ss = q.get("ssaa")
  const ssaa = ss === "auto" ? "auto" : Number(ss)
  return {
    size: (PREVIEW_SIZES as readonly number[]).includes(size) ? (size as PreviewSize) : d.size,
    scene: q.get("scene") === "about" ? "about" : d.scene,
    theme: q.get("theme") === "light" ? "light" : d.theme,
    autonomous: q.has("autonomous") ? q.get("autonomous") === "1" : d.autonomous,
    pixelRatio: (PREVIEW_PIXEL_RATIOS as readonly (string | number)[]).includes(ratio)
      ? (ratio as PreviewPixelRatio)
      : d.pixelRatio,
    ssaa: (PREVIEW_SSAA as readonly (string | number)[]).includes(ssaa) ? (ssaa as PreviewSsaa) : d.ssaa,
    halo: q.has("halo") ? q.get("halo") === "1" : d.halo,
    loupe: q.get("loupe") === "1",
  }
}
