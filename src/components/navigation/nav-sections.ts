// The section navigator's own map of the page — deliberately short, plain
// wayfinding labels (not the sections' own long editorial headings, e.g.
// about-content.ts's "I teach how to build with AI. Then I go build it
// myself." — those are copy for the page itself, this is a table of
// contents). "Notebook" matches that section's actual heading ("Open
// notebook.", see notebook-content.ts); "Home" names the Hero as a
// destination to return to, since it never renders a visible label of its
// own on the page.
export interface NavSection {
  readonly id: string
  readonly label: string
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { id: "hero", label: "Home" },
  { id: "about", label: "About" },
  { id: "projects", label: "Projects" },
  { id: "notebook", label: "Notebook" },
  { id: "contact", label: "Contact" },
] as const

export const HERO_SECTION_ID = "hero"
