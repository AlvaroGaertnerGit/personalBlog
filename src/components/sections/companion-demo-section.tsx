import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { Reveal } from "@/components/motion/reveal"
import { ScopeDock } from "@/components/scope/companion"
import { CompanionDemoCard } from "./companion-demo-card"

// A minimal second resting place for Scope's companion system to travel
// to — demonstrating the dock/travel/acknowledge architecture (see
// src/components/scope/companion/) ahead of a real Projects section.
// Server Component apart from CompanionDemoCard's small client leaf; Scope
// itself is a single shared instance rendered elsewhere (companion-scope.tsx),
// not mounted here.
function CompanionDemoSection() {
  return (
    <Section aria-labelledby="companion-demo-heading">
      <Container>
        <Reveal className="flex flex-col gap-10 sm:gap-12">
          <div className="flex items-start gap-4 sm:gap-6">
            {/* Upper-left resting place, in normal document flow (not
                absolutely positioned over the cards below) so it can never
                overlap or reduce their readability. */}
            <ScopeDock
              id="companion-demo"
              config={{ mood: "observe", scale: 0.85 }}
              className="size-28 shrink-0 sm:size-32"
            />
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
                <span aria-hidden="true" className="bg-foreground/40 h-px w-6" />
                Elsewhere in the portfolio
              </p>
              <h2
                id="companion-demo-heading"
                className="text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                More sections are taking shape
              </h2>
              <p className="text-muted-foreground max-w-prose text-base leading-relaxed sm:text-lg">
                A preview stop for Scope&apos;s companion system — real project
                write-ups land in a future sprint.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <CompanionDemoCard label="Card one" />
            <CompanionDemoCard label="Card two" />
            <CompanionDemoCard label="Card three" />
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

export { CompanionDemoSection }
