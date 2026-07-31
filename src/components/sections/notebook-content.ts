// Copy + data source for the Open Notebook section (SPR-008, evolved into
// a research workspace in SPR-008.1). Kept separate from the components
// that render it, same pattern as projects-content.ts and about-content.ts
// — see the portfolio-writing skill before editing any string here.
//
// This isn't a showcase or a list — each thread is a live line of
// research, not a finished result. Content is drawn directly from the
// brief that requested this section (redistributed/reworded sensibly
// across the new richer per-thread shape, not invented from nothing), same
// convention projects-content.ts already uses for its own provisional
// stack list. Review before treating any field here as final.

export const NOTEBOOK_INTRO = {
  whisper: "You weren't supposed to see this.",
  title: "Open notebook.",
  subtitle: [
    "These aren't finished ideas.",
    "They're the questions I'm trying to answer.",
  ],
} as const

export interface ResearchThread {
  readonly id: string
  /** Short label shown in the workspace's index — e.g. "Context Engineering". */
  readonly topic: string
  /** The big serif statement in the document panel. Omitted only by the trailing "unwritten" thread. */
  readonly currentQuestion?: string
  // Free text on purpose, unlike a closed status union elsewhere in this
  // codebase: these are personal, sometimes wry, one-off states ("Blocked",
  // "Broken again"), not a formal picklist — constraining them would
  // misrepresent how open-ended they're meant to read.
  readonly status?: string
  readonly latestFinding?: string
  readonly currentHypothesis?: string
  readonly failedAssumption?: string
  readonly nextExperiment?: string
  readonly researchNotes?: readonly string[]
  /**
   * Ids of other threads this one's thinking connects to — purely
   * geometric (drives the index's connecting-line visual), never
   * described in copy or read aloud; the relationship is a bonus, not
   * load-bearing content.
   */
  readonly relatedIds?: readonly string[]
  /** The trailing "still forming" thread — rendered as a quiet placeholder instead of the normal fields. */
  readonly unwritten?: boolean
}

export const RESEARCH_THREADS: readonly ResearchThread[] = [
  {
    id: "context-engineering",
    topic: "Context Engineering",
    currentQuestion: "How much context is actually enough?",
    status: "Testing",
    latestFinding: "Context scales better than prompting.",
    currentHypothesis: "Architecture scales better than context, past a certain point.",
    researchNotes: ["Need more evidence before calling this settled."],
    relatedIds: ["autonomous-engineering"],
  },
  {
    id: "ai-agents",
    topic: "AI Agents",
    currentQuestion: "When should one AI agent become two?",
    status: "Researching",
    currentHypothesis: "Splitting by narrow responsibility beats one large agent holding the whole task.",
    failedAssumption: "More instructions would fix coordination. It didn't.",
    nextExperiment: "Give two agents conflicting goals on purpose and see who yields.",
    relatedIds: ["mcp-ecosystem"],
  },
  {
    id: "mcp-ecosystem",
    topic: "MCP Ecosystem",
    currentQuestion: "Can one shared protocol replace a pile of one-off integrations?",
    status: "Early",
    researchNotes: [
      "Wiring a browser, a design system, and a project tracker through the same protocol.",
      "Fewer one-off adapters than expected so far.",
    ],
    relatedIds: ["ai-agents"],
  },
  {
    id: "local-models",
    topic: "Local Models",
    currentQuestion: "Where's the real quality gap between a local model and a frontier one?",
    status: "Paused",
    latestFinding: "Smaller than expected, for narrow tasks.",
    nextExperiment: "Picked back up whenever a task is boring enough to justify it.",
  },
  {
    id: "ai-native-ux",
    topic: "AI-native UX",
    currentQuestion: "Can an interface be built around what a model can do, instead of a chat box bolted onto a form?",
    status: "Building",
    currentHypothesis: "This site's own companion is the first real attempt.",
    researchNotes: ["Where memory stops being useful is still an open question once the interface remembers for you."],
    relatedIds: ["context-engineering"],
  },
  {
    id: "autonomous-engineering",
    topic: "Autonomous Software Engineering",
    currentQuestion: "Can an AI understand architecture instead of simply generating code?",
    status: "Thinking",
    currentHypothesis: "Architecture scales better than context.",
    failedAssumption: "More context would substitute for structure. Still testing that.",
    nextExperiment: "This site's own plan, build, review loop is the closest real test of it so far.",
    relatedIds: ["context-engineering"],
  },
  {
    id: "next-question",
    topic: "···",
    unwritten: true,
  },
]
