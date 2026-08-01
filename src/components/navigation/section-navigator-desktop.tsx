"use client"

import { motion } from "framer-motion"

import { distance, springs, transitions } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { NavSection } from "./nav-sections"

interface SectionNavigatorDesktopProps {
  sections: readonly NavSection[]
  activeId: string
  isPastHero: boolean
  onNavigate: (id: string) => void
}

// The right-side floating capsule — hover/keyboard-focus only, so it's the
// `md:` (pointer-capable-width) variant; SectionNavigatorMobile is the
// touch-first counterpart. Reuses the exact glass material already
// established in hero.tsx/about-section.tsx (border-border/60 +
// from-muted/50 to-muted/10 gradient + backdrop-blur-sm) rather than
// inventing a second "glass" language.
function SectionNavigatorDesktop({
  sections,
  activeId,
  isPastHero,
  onNavigate,
}: SectionNavigatorDesktopProps) {
  return (
    <motion.nav
      aria-label="Section navigation"
      inert={!isPastHero}
      initial={false}
      animate={{ opacity: isPastHero ? 1 : 0, y: isPastHero ? 0 : distance.xs }}
      transition={transitions.enter}
      className={cn(
        "fixed top-1/2 right-4 z-40 hidden -translate-y-1/2 sm:right-6 md:block",
        !isPastHero && "pointer-events-none"
      )}
    >
      {/* An invisible hit-area padded beyond the visible capsule, so
          hovering "approaches" the navigator rather than needing to land
          exactly on its thin glass edge — no mousemove/distance tracking
          needed for that feel. */}
      <div className="group -m-4 p-4">
        <ul className="border-border/60 from-muted/50 to-muted/10 flex flex-col items-center gap-4 rounded-full border bg-gradient-to-b p-2.5 backdrop-blur-sm">
          {sections.map((section) => {
            const isActive = section.id === activeId
            return (
              <li key={section.id} className="relative flex items-center justify-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "text-foreground/80 pointer-events-none absolute right-full mr-3 -translate-x-1 text-xs font-medium whitespace-nowrap opacity-0 transition-[opacity,transform] duration-150 ease-out",
                    "motion-reduce:transition-none",
                    "group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
                  )}
                >
                  {section.label}
                </span>
                <button
                  type="button"
                  aria-label={section.label}
                  aria-current={isActive ? "location" : undefined}
                  onClick={() => onNavigate(section.id)}
                  className="focus-visible:ring-ring/50 relative flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-3"
                >
                  {/* Ambient halo, Scope's own accent — soft, blurred, low
                      opacity on purpose. This should read as "his light is
                      nearby," never as a colored control; if it draws the
                      eye on its own, it's too strong. */}
                  <motion.span
                    aria-hidden="true"
                    className="bg-scope-accent absolute size-4 rounded-full blur-[3px]"
                    animate={{ opacity: isActive ? 0.35 : 0 }}
                    transition={transitions.toggle}
                  />
                  <motion.span
                    aria-hidden="true"
                    className="bg-foreground/70 relative rounded-full"
                    animate={{
                      width: isActive ? 10 : 6,
                      height: isActive ? 10 : 6,
                      opacity: isActive ? 1 : 0.5,
                    }}
                    transition={springs.layout}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </motion.nav>
  )
}

export { SectionNavigatorDesktop }
