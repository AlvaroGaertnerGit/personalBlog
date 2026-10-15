// A question's note: the real notebook entry, on a slip of ruled paper next
// to the book it belongs to. Non-modal (the world keeps going; Scope comes
// over to read it too). Esc or × closes it; focus returns to its hotspot.

import { esc, thread, threadFields } from "./content.ts"

export class Note {
  private readonly el = document.getElementById("note")!
  private anchor: HTMLElement | null = null
  openId: string | null = null

  constructor() {
    this.el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        this.close(true)
      }
    })
  }

  open(id: string, contentId: string | undefined, anchor: HTMLElement) {
    const t = contentId ? thread(contentId) : null
    if (!t) return false
    this.openId = id
    this.anchor = anchor
    const rows = threadFields(t)
    this.el.innerHTML = `
      <button class="close" type="button" aria-label="Cerrar la nota">×</button>
      <p class="status">${esc(t.topic)}${t.status ? ` · ${esc(t.status)}` : ""}</p>
      <h2>${esc(t.currentQuestion ?? "Aún está tomando forma.")}</h2>
      ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}`
    this.el.querySelector(".close")!.addEventListener("click", () => this.close(true))
    this.el.setAttribute("aria-label", `Nota: ${t.topic}`)
    this.el.hidden = false
    this.place()
    this.el.animate([{ opacity: 0, transform: `${this.el.style.transform} scale(.96)` }, { opacity: 1, transform: this.el.style.transform }], {
      duration: 260,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    })
    return true
  }

  /** Keep it beside its object while the camera moves. */
  place() {
    if (!this.openId || !this.anchor) return
    const a = this.anchor.getBoundingClientRect()
    const w = this.el.offsetWidth
    const h = this.el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let x = a.right + 14
    if (x + w > vw - 16) x = a.left - 14 - w
    x = Math.max(16, Math.min(x, vw - w - 16))
    const y = Math.max(80, Math.min(a.top - h / 2, vh - h - 90))
    this.el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`
  }

  close(returnFocus = false) {
    if (!this.openId) return
    this.openId = null
    this.el.hidden = true
    if (returnFocus) this.anchor?.focus({ preventScroll: true })
    this.anchor = null
  }
}
