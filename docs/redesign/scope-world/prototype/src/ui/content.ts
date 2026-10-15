// The prototype's content: the site's real projects and notebook, in Spanish
// (content-es.ts, typed with the site's own content types), plus helpers.

import type { Project } from "../../../../../../src/components/sections/projects-content.ts"
import type { ResearchThread } from "../../../../../../src/components/sections/notebook-content.ts"
import { NOTEBOOK_INTRO, PROJECTS, RESEARCH_THREADS } from "./content-es.ts"

export { NOTEBOOK_INTRO, PROJECTS, RESEARCH_THREADS }
export type { Project, ResearchThread }

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c])

export function thread(id: string) {
  return RESEARCH_THREADS.find((t) => t.id === id) ?? null
}

export function project(id: string) {
  return PROJECTS.find((p) => p.id === id) ?? null
}

/** Where each project lives in the world (prototype copy, not site copy). */
export const IN_THE_WORLD: Record<string, string> = {
  mathview: "la pieza es una función sobre la que puedes ponerte de pie. Al abrirla se encienden sus curvas de nivel.",
}

export function threadFields(t: ResearchThread) {
  const rows: [string, string][] = []
  if (t.latestFinding) rows.push(["Último hallazgo", t.latestFinding])
  if (t.currentHypothesis) rows.push(["Hipótesis", t.currentHypothesis])
  if (t.failedAssumption) rows.push(["Lo que no funcionó", t.failedAssumption])
  if (t.nextExperiment) rows.push(["Próximo experimento", t.nextExperiment])
  for (const n of t.researchNotes ?? []) rows.push(["Nota", n])
  return rows
}

/** Links with a placeholder href are shown as pending, never as working links. */
export function linkHtml(label: string, href: string, primary = false) {
  if (!href || href === "#") return `<span class="btn pending">${esc(label)} · enlace pendiente</span>`
  return `<a class="btn ${primary ? "primary" : ""}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
}
