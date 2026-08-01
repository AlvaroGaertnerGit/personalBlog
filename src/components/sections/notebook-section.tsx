import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { Reveal } from "@/components/motion/reveal"
import { fadeInUpSlow } from "@/lib/motion/variants"
import { NotebookWorkspace } from "./notebook-workspace"
import { NOTEBOOK_INTRO, RESEARCH_THREADS } from "./notebook-content"

// SPR-008 — Open Notebook, evolved in SPR-008.1 into an interactive
// research workspace. Every other section is left-aligned, sans-serif, and
// built from the same glass-panel material; this one is centered on entry
// and has no card chrome at all. Type hierarchy: font-notebook (serif,
// scoped to this section only — see globals.css) marks the big declarative
// statements (the title, each thread's current question) and quiet
// personal asides (the whisper line, each thread's status word, set in
// italic); the default sans stays for supporting/explanatory text. Server
// Component apart from NotebookWorkspace's client leaf (thread selection,
// the panel's CSS transition, the connecting-line overlay) — nothing else
// here needs client state.
function NotebookSection() {
  return (
    <Section id="notebook" aria-labelledby="notebook-heading">
      <Container className="flex flex-col gap-24 sm:gap-32">
        {/* Centered, tall, and quiet — the one deliberate break from every
            other section's left-aligned intro. Three independent reveals,
            generously spaced, so each line surfaces as its own scroll
            beat rather than one bundled entrance. */}
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-16 text-center sm:min-h-[70vh] sm:gap-24">
          <Reveal variants={fadeInUpSlow} viewport={{ amount: 0.5 }}>
            <p className="font-notebook text-muted-foreground text-sm italic sm:text-base">
              {NOTEBOOK_INTRO.whisper}
            </p>
          </Reveal>

          <Reveal variants={fadeInUpSlow} viewport={{ amount: 0.5 }}>
            <h2
              id="notebook-heading"
              className="font-notebook text-4xl tracking-tight sm:text-6xl"
            >
              {NOTEBOOK_INTRO.title}
            </h2>
          </Reveal>

          <Reveal variants={fadeInUpSlow} viewport={{ amount: 0.5 }}>
            <div className="text-muted-foreground flex flex-col gap-1 text-lg sm:text-xl">
              {NOTEBOOK_INTRO.subtitle.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal variants={fadeInUpSlow} viewport={{ amount: 0.3 }}>
          <NotebookWorkspace threads={RESEARCH_THREADS} />
        </Reveal>
      </Container>
    </Section>
  )
}

export { NotebookSection }
