import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { Reveal } from "@/components/motion/reveal"
import { ScopeDock } from "@/components/scope/companion"
import { AboutWorkbench } from "./about-workbench"
import { ABOUT_HOTSPOTS, ABOUT_INTRO } from "./about-content"

// SPR-004.1 — "The Workbench": one unified glass scene rather than several
// separate cards, deliberately reusing the Hero's own frame material
// (border-border/60, gradient, backdrop-blur, bg-grid — see
// src/components/hero/hero.tsx's HeroMedia) so About visually rhymes with
// the Hero rather than introducing a new card language. Not built on
// HeroMedia directly: that component enforces a fixed aspect-ratio slot for
// a single centered media item, which doesn't fit this panel's
// variable-height, multi-region content — see the architecture skill's
// "don't abstract on first use" guidance; a shared frame primitive is worth
// extracting if a third place ever wants this exact shape, not before.
// Server Component apart from AboutWorkbench's client leaf (the hover/tab
// interaction + cursor spotlight); Scope itself is the single shared
// instance rendered elsewhere (companion-scope.tsx), not mounted here.
function AboutSection() {
  return (
    <Section aria-labelledby="about-heading">
      <Container>
        <Reveal className="border-border/60 from-muted/50 to-muted/10 relative overflow-hidden rounded-4xl border bg-gradient-to-b p-8 backdrop-blur-sm sm:p-10 lg:p-14">
          {/* Same bg-grid texture Hero uses, but at a fraction of its
              opacity and with no center-peaking mask: Hero only ever puts
              this behind an empty decorative box, never behind body text.
              This panel is mostly text — HeroMedia's radial mask would
              concentrate the grid right where the eyebrow/heading/hotspot
              copy sits, visibly interfering with small tracked-out
              letters. A uniform, much fainter wash reads as texture at the
              panel's quiet edges without ever fighting legibility. */}
          <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 opacity-10" />
          <div className="relative flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
            {/* Scope's resting place lives inside the same frame as the
                content it's quietly accompanying, not beside it as a
                separate element — "the design should naturally integrate
                Scope into the composition." A generous gap here, not just
                for breathing room: the companion system scales Scope's own
                intrinsic size (size-40/48 in companion-scope.tsx) by
                config.scale via a top-left-anchored CSS transform, so its
                real visual footprint (0.85 × 160/192px ≈ 136/163px)
                overflows past this smaller dock box (size-28/32 =
                112/128px) toward the bottom-right — confirmed by measuring
                both rects live. A tight gap here would let Scope's own
                glow visually sit on top of the eyebrow text below it. */}
            <div className="flex flex-col items-start gap-12 sm:gap-16 lg:w-72 lg:shrink-0">
              <ScopeDock
                id="about"
                config={{ mood: "observe", scale: 0.85 }}
                className="size-28 sm:size-32"
              />
              <div className="flex flex-col gap-3">
                <p className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
                  <span aria-hidden="true" className="bg-foreground/40 h-px w-6" />
                  {ABOUT_INTRO.eyebrow}
                </p>
                <h2
                  id="about-heading"
                  className="text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  {ABOUT_INTRO.heading}
                </h2>
              </div>
            </div>

            <AboutWorkbench hotspots={ABOUT_HOTSPOTS} hint={ABOUT_INTRO.hint} className="flex-1" />
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

export { AboutSection }
