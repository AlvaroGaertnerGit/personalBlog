// The same content without the canvas. It is the whole experience only when
// there is no WebGL at all (or with ?fallback), and a choice for everyone else
// ("Vista de lectura"). Places are shown with the approved Blender renders,
// labelled as reference pictures so they are never mistaken for the world.

import { STATIONS } from "../config.ts"
import { NOTEBOOK_INTRO, PROJECTS, RESEARCH_THREADS, esc, linkHtml, threadFields } from "./content.ts"

const PLACE_IMAGES: Record<string, { src: string; alt: string }> = {
  margin: { src: "/renders/d3-home.jpg", alt: "Scope en el margen de una gran hoja de papel al amanecer; detrás de él, preguntas de papel plegado." },
  questions: { src: "/renders/a2-inside.jpg", alt: "A la altura de Scope, entre las preguntas: libros de papel de pie sobre el lomo, unidos por un hilo rojo." },
  fold: { src: "/renders/a1-wide.jpg", alt: "El campo de preguntas desde arriba; la ruta se pliega hacia el círculo de luz de la lámpara." },
  light: { src: "/renders/c1-place.jpg", alt: "Dentro del círculo de la lámpara: papel convertido en porcelana y MathView, una función de celadón sobre la que se puede caminar." },
}

export function renderReading(el: HTMLElement, mode: "fallback" | "choice", why: string) {
  const threads = RESEARCH_THREADS.filter((t) => !t.unwritten)
  el.innerHTML = `
    ${mode === "choice" ? `<button class="bar-btn back-to-world" type="button" data-action="world">Volver al mundo</button>` : ""}
    <section class="intro" aria-labelledby="r-title">
      <h1 id="r-title">El Pliego</h1>
      <p>Una hoja de papel sobre una mesa, bajo una lámpara. De ella se levantan preguntas, y lo que la luz sostiene el tiempo suficiente acaba convertido en porcelana. Aquí vive Scope.</p>
      ${why ? `<p class="why">${esc(why)}</p>` : ""}
    </section>
    ${STATIONS.map((s) => {
      const img = PLACE_IMAGES[s.id]
      return `<figure><img class="place-img" src="${img.src}" alt="${esc(img.alt)}" loading="lazy" decoding="async"><figcaption>${esc(s.label)} · imagen de referencia, render de Blender</figcaption></figure>`
    }).join("")}
    <h2 id="r-projects">Proyectos</h2>
    <ul class="cards" aria-labelledby="r-projects">
      ${PROJECTS.map(
        (p) => `<li class="card" id="project-${esc(p.id)}">
          <p class="status">${esc(p.stack.join(" · "))}</p>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description)}</p>
          ${p.links.map((l, i) => linkHtml(l.label, l.href, i === 0)).join(" ")}
        </li>`,
      ).join("")}
    </ul>
    <h2 id="r-notebook">${esc(NOTEBOOK_INTRO.title)}</h2>
    <p>${NOTEBOOK_INTRO.subtitle.map(esc).join(" ")}</p>
    <ul class="cards" aria-labelledby="r-notebook">
      ${threads
        .map(
          (t) => `<li class="card">
          <p class="status">${esc(t.topic)} · ${esc(t.status ?? "")}</p>
          <h3>${esc(t.currentQuestion ?? "")}</h3>
          <dl>${threadFields(t)
            .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
            .join("")}</dl>
        </li>`,
        )
        .join("")}
    </ul>`
}
