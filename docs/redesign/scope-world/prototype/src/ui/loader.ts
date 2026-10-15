// The production loader, reused: the prerendered Scope (ScopeLoaderPlayer +
// manifest, both imported read-only from src/) above the exploring line. When
// the world is ready, Scope finishes his motion, hops (the drawn exit), the
// line lights up, and the screen fades — onto the SAME Scope, live, in the
// same place on screen, at night (main.ts holds the camera there).

import { ScopeLoaderPlayer } from "../../../../../../src/components/scope-3d/entry/loader-player.ts"
import type { LoaderManifest } from "../../../../../../src/components/scope-3d/entry/loader-timeline.ts"
import manifestJson from "../../../../../../public/scope/loader/manifest.json"

const manifest = manifestJson as LoaderManifest
const FADE_FROM_EXIT_FRAME = 21
const EXIT_WATCHDOG_MS = 2500

export class Loader {
  private readonly root = document.getElementById("loader")!
  private readonly canvas = document.getElementById("loader-canvas") as HTMLCanvasElement
  private readonly still = document.getElementById("loader-still") as HTMLImageElement
  private player: ScopeLoaderPlayer | null = null
  private playing = false
  private fading = false
  private exitStarted = false
  private resolveDone: () => void = () => {}
  readonly done = new Promise<void>((r) => (this.resolveDone = r))
  /** Fired when the screen starts to fade (the world should be showing behind it). */
  onReveal: () => void = () => {}

  constructor(reducedMotion: boolean) {
    if (reducedMotion) return
    this.player = new ScopeLoaderPlayer(this.canvas, manifest, {
      onExitStart: () => {
        this.exitStarted = true
        this.glow()
      },
      onExitFrame: (frame) => {
        if (frame === FADE_FROM_EXIT_FRAME) this.fade(false)
      },
      onExitEnd: () => {},
    })
    this.player
      .load()
      .then(() => {
        this.canvas.style.opacity = "1"
        this.still.style.visibility = "hidden"
        this.playing = true
        this.player!.start()
      })
      .catch(() => {})
  }

  /** Scope's on-screen size in the loader (CSS --scope-h), in px. */
  scopeHeightPx() {
    const box = this.root.querySelector(".loader-scope") as HTMLElement
    return box.getBoundingClientRect().height * manifest.scopeHeight
  }

  /** Centre of the loader's Scope (his feet line and his height), viewport px. */
  scopeRect() {
    const r = (this.root.querySelector(".loader-scope") as HTMLElement).getBoundingClientRect()
    return { cx: r.left + r.width / 2, bottom: r.bottom - r.height * 0.06, height: r.height * manifest.scopeHeight }
  }

  /** The world is ready: let Scope finish, hop, and leave. */
  exit() {
    if (this.player && this.playing) {
      this.player.requestExit()
      window.setTimeout(() => {
        if (!this.exitStarted) this.fade(true)
      }, EXIT_WATCHDOG_MS)
    } else {
      this.fade(true)
    }
    return this.done
  }

  private glow() {
    document.getElementById("line-glow")?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], {
      duration: 1100,
      easing: "cubic-bezier(0.65, 0, 0.35, 1)",
    })
  }

  private fade(plain: boolean) {
    if (this.fading) return
    this.fading = true
    this.onReveal()
    const ms = plain ? 450 : 700
    this.root
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" })
      .finished.then(() => {
        this.root.hidden = true
        this.player?.dispose()
        this.resolveDone()
      })
  }
}
