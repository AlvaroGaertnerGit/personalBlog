// Copy source for the About section (SPR-004.1, "The Workbench"). Kept
// separate from the components that render it so the section stays about
// layout/interaction and this file stays about words — see the
// portfolio-writing skill before editing any string here (first person,
// present tense, no résumé language, run lint-copy.mjs after changes).

export const ABOUT_INTRO = {
  eyebrow: "Inside the workbench",
  heading: "I teach how to build with AI. Then I go build it myself.",
  hint: "Hover or tap to look closer.",
} as const

export interface AboutHotspot {
  readonly id: string
  readonly label: string
  readonly text: string
}

// Four facets, not a résumé section — each is one short, specific,
// first-person beat, revealed one at a time (see about-workbench.tsx). The
// order carries the storytelling arc the brief asked for: who I am, what I
// do, how I think, why it's different.
export const ABOUT_HOTSPOTS: readonly AboutHotspot[] = [
  {
    id: "teaching",
    label: "Now teaching",
    text: "I'm 22 and teach Software Development at Gredos San Diego Guadarrama, in Spain. Most days I'm explaining something in class that I was still figuring out myself the week before.",
  },
  {
    id: "building",
    label: "Now building",
    text: "This site and Tournamently, a padel tournament platform, are both mine end to end. I build the AI into the architecture from day one, never bolted on after the fact.",
  },
  {
    id: "exploring",
    label: "Now exploring",
    text: "Context engineering, agent systems, and whatever frontend wraps them well enough that people forget AI is even there. That's where most of my curiosity goes right now.",
  },
  {
    id: "philosophy",
    label: "Philosophy",
    text: "Everything I learn turns into something I build or something I teach. I don't really have a third option.",
  },
]
