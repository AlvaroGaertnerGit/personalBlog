// Copy + data source for the Projects section (SPR-005). Kept separate
// from the components that render it, same pattern as about-content.ts —
// see the portfolio-writing skill before editing any string here.
//
// `links` are deliberately placeholder `#` hrefs for now (confirmed with
// the user rather than guessed) — swap in real URLs whenever they're
// ready; nothing else needs to change. `stack` is a best-effort match to
// what's already stated elsewhere on the site (Tournamently's stack in
// about-content.ts's focus clusters) — MathView's stack was never
// confirmed, so treat it as provisional too.

export const PROJECTS_INTRO = {
  eyebrow: "What I've actually built",
  heading: "Where the philosophy turns into software.",
} as const

export interface ProjectLink {
  readonly label: string
  readonly href: string
}

export interface Project {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly stack: readonly string[]
  readonly links: readonly ProjectLink[]
}

export const PROJECTS: readonly Project[] = [
  {
    id: "tournamently",
    title: "Tournamently",
    description:
      "Padel tournaments, organized end to end: brackets, scheduling, and live results. The AI handles the parts nobody wants to do by hand.",
    stack: ["Next.js", "TypeScript", "Supabase"],
    links: [
      { label: "Live site", href: "#" },
      { label: "GitHub", href: "#" },
    ],
  },
  {
    id: "mathview",
    title: "MathView",
    description:
      "A place to actually see the math, not just read it. Built for the students I teach, who'd rather explore a graph than stare at a textbook.",
    stack: ["Angular", "Python", "Matlab"],
    links: [
      { label: "Live site", href: "#" },
      { label: "GitHub", href: "#" },
    ],
  },
]
