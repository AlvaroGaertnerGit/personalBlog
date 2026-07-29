import { ArrowUpRight } from "lucide-react";

import { CompanionMark } from "@/components/companion/companion";
import { buttonVariants } from "@/components/ui/button";
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
    <Hero>
      <HeroContent>
        <HeroEyebrow>
          Computer Science &amp; Software Development Teacher
        </HeroEyebrow>
        <HeroTitle>
          I teach developers the AI-native workflows I use to ship real
          projects.
        </HeroTitle>
        <HeroDescription>
          I teach Software Development to vocational (FP) students in Spain.
          Alongside that, I build the tools I teach with, like this site and
          Tournamently, a padel tournament platform.
        </HeroDescription>
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
      </HeroContent>
      <HeroMedia>
        <CompanionMark />
      </HeroMedia>
    </Hero>
  );
}
