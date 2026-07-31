import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { Reveal } from "@/components/motion/reveal"
import { ContactDesk } from "./contact-desk"
import { CONTACT_INTRO } from "./contact-content"

// SPR-009 — "The Final Scene": the portfolio's closing chapter. Same
// structural shape as every other section (Section + Container + a
// Reveal-wrapped eyebrow/heading, same tracked-out-label convention as
// about-section.tsx/projects-section.tsx), left-aligned like everything
// except Open Notebook's own deliberate rhythm-break — Contact doesn't need
// a second one. Everything genuinely new here (the scene state machine, the
// desk/paper visuals, Scope's scripted arrival/delivery/departure, the
// form) lives in ContactDesk, the section's one client leaf.
function ContactSection() {
  return (
    <Section aria-labelledby="contact-heading">
      <Container className="flex flex-col gap-10 sm:gap-12">
        <Reveal className="flex flex-col gap-3">
          <p className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
            <span aria-hidden="true" className="bg-foreground/40 h-px w-6" />
            {CONTACT_INTRO.eyebrow}
          </p>
          <h2
            id="contact-heading"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {CONTACT_INTRO.heading}
          </h2>
        </Reveal>

        <ContactDesk />
      </Container>
    </Section>
  )
}

export { ContactSection }
