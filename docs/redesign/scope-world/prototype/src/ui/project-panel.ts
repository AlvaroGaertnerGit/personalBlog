// A project, opened from its object. The HTML sheet unfolds FROM the card
// that stands on the tile (its projected rectangle on screen) and folds back
// into it on close — the transition belongs to the object, not to a generic
// modal. The content is plain, selectable, accessible HTML (a dialog with a
// focus trap; Esc closes; main.ts returns focus to whatever opened it).

import { IN_THE_WORLD, esc, linkHtml, project } from "./content.ts"

export interface ScreenRect {
  x: number
  y: number
  w: number
  h: number
}

const OPEN_MS = 760
const CLOSE_MS = 560
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)"
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)"

export class ProjectPanel {
  private readonly root = document.getElementById("project")!
  private readonly sheet = document.getElementById("project-sheet")!
  private closing = false
  openId: string | null = null
  onClose: () => void = () => {}

  constructor() {
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        this.onClose()
      } else if (e.key === "Tab") {
        this.trap(e)
      }
    })
  }

  private render(id: string) {
    const p = project(id)
    if (!p) return false
    const [live, repo] = p.links
    this.sheet.innerHTML = `
      <p class="eyebrow"><i aria-hidden="true"></i>Proyecto · cocido bajo la lámpara</p>
      <h1 id="project-title">${esc(p.title)}</h1>
      <p class="desc">${esc(p.description)}</p>
      <ul class="chips" aria-label="Tecnologías">${p.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      ${p.id === "mathview" ? `<p class="provisional">Tecnologías pendientes de confirmar.</p>` : ""}
      ${IN_THE_WORLD[p.id] ? `<p class="how"><b>En el mundo:</b> ${esc(IN_THE_WORLD[p.id])}</p>` : ""}
      <div class="actions">
        ${live ? linkHtml(live.label, live.href, true) : ""}
        ${repo ? linkHtml(repo.label, repo.href) : ""}
        <button class="btn primary" type="button" data-close><kbd>Esc</kbd>Volver a la luz</button>
      </div>`
    this.sheet.querySelector("[data-close]")!.addEventListener("click", () => this.onClose())
    return true
  }

  /** Unfold from `from` (the card on screen). Resolves when it is open. */
  async open(id: string, from: ScreenRect | null, reduced: boolean) {
    if (!this.render(id)) return
    this.openId = id
    this.closing = false
    this.root.hidden = false
    setInert(true)
    const to = this.sheet.getBoundingClientRect()
    if (from && !reduced) {
      const k = flip(from, to)
      const children = [...this.sheet.children] as HTMLElement[]
      children.forEach((c) => (c.style.opacity = "0"))
      await this.sheet.animate(
        [
          { transform: `${k} perspective(900px) rotateX(38deg)`, opacity: 0.85, offset: 0 },
          { transform: "translate(0, 0) scale(1, 1) perspective(900px) rotateX(0deg)", opacity: 1 },
        ],
        { duration: OPEN_MS, easing: EASE_OUT },
      ).finished
      children.forEach((c, i) =>
        c.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
          duration: 380,
          delay: i * 40,
          easing: EASE_OUT,
          fill: "backwards",
        }),
      )
      children.forEach((c) => (c.style.opacity = ""))
    } else {
      await this.sheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? 1 : 200 }).finished
    }
    this.sheet.focus({ preventScroll: true })
  }

  /** Fold back into `to` (the card, wherever it is on screen now). */
  async close(to: ScreenRect | null, reduced: boolean) {
    if (!this.openId || this.closing) return
    this.closing = true
    const from = this.sheet.getBoundingClientRect()
    if (to && !reduced) {
      await this.sheet.animate(
        [
          { transform: "translate(0, 0) scale(1, 1) perspective(900px) rotateX(0deg)", opacity: 1 },
          { transform: `${flip(to, from)} perspective(900px) rotateX(38deg)`, opacity: 0 },
        ],
        { duration: CLOSE_MS, easing: EASE_IN_OUT, fill: "forwards" },
      ).finished
    } else {
      await this.sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 1 : 180, fill: "forwards" }).finished
    }
    this.sheet.getAnimations().forEach((a) => a.cancel())
    this.root.hidden = true
    this.openId = null
    setInert(false)
  }

  private trap(e: KeyboardEvent) {
    const items = [...this.sheet.querySelectorAll<HTMLElement>("a[href], button")]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === this.sheet)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

/** CSS transform that maps rect `b` onto rect `a` (transform-origin 0 0). */
function flip(a: ScreenRect, b: { left: number; top: number; width: number; height: number } | ScreenRect) {
  const bx = "left" in b ? b.left : b.x
  const by = "top" in b ? b.top : b.y
  const bw = "width" in b ? b.width : b.w
  const bh = "height" in b ? b.height : b.h
  return `translate(${(a.x - bx).toFixed(1)}px, ${(a.y - by).toFixed(1)}px) scale(${(a.w / bw).toFixed(4)}, ${(a.h / bh).toFixed(4)})`
}

function setInert(on: boolean) {
  for (const sel of [".bar", ".route", "#hotspots", "#note", ".skip"]) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el) el.inert = on
  }
}
