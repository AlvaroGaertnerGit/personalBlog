import { ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProjectLink } from "./projects-content"

interface ProjectCardProps {
  title: string
  description: string
  stack: readonly string[]
  links: readonly ProjectLink[]
  /** The project's "world" — a client leaf (see src/components/sections/worlds/) rendered scene-first, above the metadata. */
  children: ReactNode
}

// Shared chrome for every project world (SPR-005) — same glass material as
// Hero/About (border-border/60, gradient, backdrop-blur), but a
// deliberately different composition rhythm from About's Workbench
// (dock-beside-text): scene on top, full width, metadata below, so the
// scene reads as "the memorable part" per the brief rather than the
// section feeling templated against the one before it. Takes the world as
// `children` (composition, not a `variant` prop) — each world is
// structurally different, not a themed variant of one shape. A Server
// Component: the hover lift is plain CSS (matching the same unguarded
// small-lift precedent already in button.tsx), so only the world inside
// needs to be a client leaf.
function ProjectCard({ title, description, stack, links, children }: ProjectCardProps) {
  return (
    <div className="border-border/60 from-muted/50 to-muted/10 relative overflow-hidden rounded-4xl border bg-gradient-to-b backdrop-blur-sm transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1">
      {children}
      <div className="flex flex-col gap-4 p-8 sm:p-10">
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h3>
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {stack.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href === "#" ? undefined : "_blank"}
              rel={link.href === "#" ? undefined : "noopener noreferrer"}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {link.label}
              <ArrowUpRight aria-hidden="true" data-icon="inline-end" />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export { ProjectCard }
