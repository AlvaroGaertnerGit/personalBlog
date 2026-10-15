// Real <button>s over the objects of the world. They are how keyboard and
// screen-reader visitors reach the same things the pointer does (and how
// everyone discovers that a thing can be opened). Positions come from
// projecting each object's world point every frame; a button behind the
// camera, off screen, or not in the current place is hidden and removed
// from the tab order.

import * as THREE from "three"

import { POIS, type Poi } from "../config.ts"
import { blv } from "../world/world-data.ts"
import { esc, thread } from "./content.ts"

export interface HotspotEvents {
  activate(id: string, el: HTMLElement): void
  focus(id: string | null): void
}

interface Spot {
  id: string
  el: HTMLButtonElement
  world: THREE.Vector3
  station: number | null
}

const v = new THREE.Vector3()

export class Hotspots {
  private readonly layer = document.getElementById("hotspots")!
  private readonly spots: Spot[] = []
  private readonly events: HotspotEvents
  private hot: string | null = null

  constructor(events: HotspotEvents) {
    this.events = events
    for (const p of POIS.filter((q) => q.interactive)) this.add(p)
  }

  private add(p: Poi) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "hotspot"
    const t = p.contentId ? thread(p.contentId) : null
    const title = p.kind === "project" ? p.label : (t?.currentQuestion ?? p.label)
    const sub = p.kind === "project" ? "Proyecto · ábrelo" : t?.status ? `${t.topic} · ${t.status}` : t?.unwritten ? "Aún tomando forma" : ""
    el.setAttribute("aria-label", sub ? `${title}${/[.?!…]$/.test(title) ? "" : "."} ${sub}` : title)
    el.innerHTML = `<span class="label" aria-hidden="true">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ""}</span>`
    el.addEventListener("click", () => this.events.activate(p.id, el))
    el.addEventListener("focus", () => this.events.focus(p.id))
    el.addEventListener("blur", () => this.events.focus(null))
    el.addEventListener("pointerenter", () => this.events.focus(p.id))
    el.addEventListener("pointerleave", () => this.events.focus(null))
    this.layer.append(el)
    this.spots.push({ id: p.id, el, world: blv(p.hotspot ?? p.look), station: p.station })
  }

  /** Scope's own button (follows his head). */
  addScope(onActivate: () => void, onFocus: (on: boolean) => void) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "hotspot is-scope"
    el.setAttribute("aria-label", "Scope. Salúdalo")
    el.innerHTML = `<span class="label" aria-hidden="true">Scope<small>salúdalo</small></span>`
    el.addEventListener("click", onActivate)
    el.addEventListener("focus", () => onFocus(true))
    el.addEventListener("blur", () => onFocus(false))
    this.layer.prepend(el)
    const spot: Spot = { id: "scope", el, world: new THREE.Vector3(), station: null }
    this.spots.push(spot)
    return spot.world
  }

  /** The object under the pointer shows its label too. */
  setHot(id: string | null) {
    if (id === this.hot) return
    this.hot = id
    for (const s of this.spots) s.el.classList.toggle("hot", s.id === id)
  }

  element(id: string) {
    return this.spots.find((s) => s.id === id)?.el ?? null
  }

  update(camera: THREE.Camera, width: number, height: number, station: number, hidden: boolean) {
    for (const s of this.spots) {
      v.copy(s.world).project(camera)
      const inView = v.z < 1 && Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.86
      const here = s.station === null || Math.abs(s.station - station) <= 1
      const show = !hidden && inView && here
      if (show) {
        const x = (v.x * 0.5 + 0.5) * width
        const y = (-v.y * 0.5 + 0.5) * height
        s.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      }
      if (s.el.classList.contains("off") === show) {
        s.el.classList.toggle("off", !show)
        s.el.tabIndex = show ? 0 : -1
        if (!show && document.activeElement === s.el) s.el.blur()
      }
    }
  }
}
