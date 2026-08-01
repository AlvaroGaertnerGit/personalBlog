import type { ComponentType } from "react"

import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { Reveal } from "@/components/motion/reveal"
import { ProjectCard } from "./project-card"
import { PROJECTS, PROJECTS_INTRO } from "./projects-content"
import { MathViewWorld } from "./worlds/mathview-world"
import { TournamentlyWorld } from "./worlds/tournamently-world"

// Each project's world is its own client leaf (src/components/sections/worlds/)
// — mapped by id here rather than stored as a component reference in
// projects-content.ts, which stays plain data (no JSX/component values).
const PROJECT_WORLDS: Record<string, ComponentType> = {
  tournamently: TournamentlyWorld,
  mathview: MathViewWorld,
}

// SPR-005 — the Projects section: Hero introduces the person, About
// introduces the philosophy, this proves it. Each project is a full-width,
// scene-first card (project-card.tsx) rather than a grid of generic
// portfolio tiles — see that file's own comment for why the composition
// rhythm deliberately differs from About's. Server Component apart from
// each world's own client leaf; Scope itself is the single shared instance
// rendered elsewhere (companion-scope.tsx) — this section only mounts a
// <ScopeDock> per world (inside each world component itself, since the
// dock's attentionTarget ref has to live where the target element does).
function ProjectsSection() {
  return (
    <Section id="projects" aria-labelledby="projects-heading">
      <Container className="flex flex-col gap-10 sm:gap-12">
        <Reveal className="flex flex-col gap-3">
          <p className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
            <span aria-hidden="true" className="bg-foreground/40 h-px w-6" />
            {PROJECTS_INTRO.eyebrow}
          </p>
          <h2 id="projects-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {PROJECTS_INTRO.heading}
          </h2>
        </Reveal>

        <div className="flex flex-col gap-8 sm:gap-10">
          {PROJECTS.map((project) => {
            const World = PROJECT_WORLDS[project.id]
            return (
              <Reveal key={project.id}>
                <ProjectCard
                  title={project.title}
                  description={project.description}
                  stack={project.stack}
                  links={project.links}
                >
                  <World />
                </ProjectCard>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}

export { ProjectsSection }
