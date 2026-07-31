import type { ReactNode } from "react"
import type { Variants } from "framer-motion"

import { StaggerGroup, StaggerItem } from "@/components/motion/stagger"
import type { ResearchThread } from "./notebook-content"

// Slower cadence than the generic staggerContainer (lib/motion/variants.ts,
// staggerChildren 0.06/delayChildren 0.04) — single consumer (this panel),
// same "section-specific timing" precedent as heroStaggerContainer, chosen
// so each layered field reads as its own quiet discovery rather than a
// quick cascade. StaggerGroup (not Reveal) is the correct primitive here:
// a thread's document panel genuinely (re)mounts each time it's selected
// (see notebook-workspace.tsx's comment on TabsPanel's mount lifecycle),
// so this is a mount-triggered reveal, not a scroll-triggered one.
const documentStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}

interface FieldProps {
  label: string
  children: ReactNode
}

function Field({ label, children }: FieldProps) {
  return (
    <StaggerItem className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">{label}</p>
      <p className="text-base leading-relaxed sm:text-lg">{children}</p>
    </StaggerItem>
  )
}

interface NotebookDocumentProps {
  thread: ResearchThread
}

// The document currently "on the desk" (SPR-008.1) — one thread's layered
// fields, revealed one at a time rather than all at once ("gradually
// discover... avoid showing everything at once" per the brief). Only the
// fields a thread actually has are rendered — that sparsity, not a
// designed "emphasis" toggle, is what makes threads feel organically
// different from each other, the same reasoning the old NotebookQuestion's
// `thoughts` array length already relied on.
function NotebookDocument({ thread }: NotebookDocumentProps) {
  if (thread.unwritten) {
    return (
      <StaggerGroup variants={documentStagger} className="flex flex-col gap-6">
        <StaggerItem>
          <p className="text-muted-foreground text-lg sm:text-xl">
            Next question:{" "}
            <span
              aria-hidden="true"
              className="bg-foreground/10 inline-block h-5 w-40 rounded-sm align-middle"
            />
            <span className="sr-only">The next question hasn&apos;t been written yet.</span>
          </p>
        </StaggerItem>
      </StaggerGroup>
    )
  }

  return (
    <StaggerGroup variants={documentStagger} className="flex flex-col gap-8">
      <StaggerItem className="flex flex-wrap items-baseline gap-3">
        <h3 className="font-notebook text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          {thread.currentQuestion}
        </h3>
        {thread.status && (
          <span className="font-notebook text-muted-foreground/80 text-sm italic">{thread.status}</span>
        )}
      </StaggerItem>

      {thread.latestFinding && <Field label="Latest finding">{thread.latestFinding}</Field>}
      {thread.currentHypothesis && <Field label="Current hypothesis">{thread.currentHypothesis}</Field>}
      {thread.failedAssumption && <Field label="Failed assumption">{thread.failedAssumption}</Field>}
      {thread.nextExperiment && <Field label="Next experiment">{thread.nextExperiment}</Field>}
      {thread.researchNotes && (
        <StaggerItem className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Research notes
          </p>
          {thread.researchNotes.map((note, i) => (
            <p key={i} className="text-muted-foreground text-base leading-relaxed sm:text-lg">
              {note}
            </p>
          ))}
        </StaggerItem>
      )}
    </StaggerGroup>
  )
}

export { NotebookDocument }
