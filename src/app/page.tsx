import { ArrowUpRight } from "lucide-react";

import { StaggerGroup, StaggerItem } from "@/components/motion/stagger";
import { SectionNavigator } from "@/components/navigation";
import { ScopeDock, ScopeGreeting } from "@/components/scope/companion";
import { AboutSection } from "@/components/sections/about-section";
import { ContactSection } from "@/components/sections/contact-section";
import { NotebookSection } from "@/components/sections/notebook-section";
import { ProjectsSection } from "@/components/sections/projects-section";
import { buttonVariants } from "@/components/ui/button";
import { heroStaggerContainer, heroStaggerItem } from "@/lib/motion/variants";
import { cn } from "@/lib/utils";
import {
  Hero,
  HeroActions,
  HeroContent,
  HeroDescription,
  HeroEyebrow,
  HeroMedia,
  HeroTitle,
} from "@/components/hero/hero";

export default function Home() {
  return (
    <>
      <Hero id="hero">
        <HeroContent>
          {/* display:contents — StaggerGroup only orchestrates timing
              (its own variant has no opacity/transform, see
              heroStaggerContainer in lib/motion/variants.ts), so it must not
              introduce a box of its own between HeroContent's flex container
              and the StaggerItems that need to sit directly in its gap-8
              layout. */}
          <StaggerGroup variants={heroStaggerContainer} className="contents">
            <StaggerItem variants={heroStaggerItem} className="flex flex-col gap-3 sm:gap-4">
              <HeroEyebrow>
                Computer Science &amp; Software Development Teacher
              </HeroEyebrow>
              <HeroTitle>
                I teach developers the AI-native workflows I use to ship real
                projects.
              </HeroTitle>
            </StaggerItem>
            <StaggerItem variants={heroStaggerItem}>
              <HeroDescription>
                I teach Software Development to vocational (FP) students in
                Spain. Alongside that, I build the tools I teach with, like this
                site and Tournamently, a padel tournament platform.
              </HeroDescription>
            </StaggerItem>
            <StaggerItem variants={heroStaggerItem}>
              <HeroActions>
                <a
                  href="https://github.com/AlvaroGaertnerGit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ size: "lg" }))}
                >
                  GitHub
                  <ArrowUpRight aria-hidden="true" data-icon="inline-end" />
                </a>
                <a
                  href="https://www.linkedin.com/in/alvarogaertner2262331b1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  LinkedIn
                  <ArrowUpRight aria-hidden="true" data-icon="inline-end" />
                </a>
              </HeroActions>
            </StaggerItem>
          </StaggerGroup>
        </HeroContent>
        {/* The `relative` wrapper exists so ScopeGreeting can be anchored
            just below the Hero platform while living *outside* HeroMedia's
            card — that card is `overflow-hidden` (see hero.tsx), so a
            caption meant to float near, not inside, the glass panel has to
            sit here as a sibling rather than a child. */}
        <div className="relative">
          <HeroMedia>
            {/* Scope no longer renders directly here — this dock just marks
                Scope's Hero platform (the companion system's one shared
                instance lives in companion-scope.tsx, see
                src/components/scope/companion/). */}
            <ScopeDock id="hero" config={{ mood: "idle" }} className="size-40 sm:size-48" />
          </HeroMedia>
          <div className="absolute inset-x-0 -bottom-10 flex justify-center sm:-bottom-12">
            <ScopeGreeting />
          </div>
        </div>
      </Hero>
      <AboutSection />
      <ProjectsSection />
      <NotebookSection />
      <ContactSection />
      <SectionNavigator />
    </>
  );
}
