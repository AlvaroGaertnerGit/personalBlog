import * as React from "react"
import { cn } from "@/lib/utils"

// Server Component by design: purely decorative, no state/effects/browser
// APIs, so it costs zero client JS. Layers are fixed behind all content
// (see `relative isolate` on <body> in layout.tsx) and stay out of the way
// of any section-scoped parallax added later via useParallax.
function Background({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="background"
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}
      {...props}
    >
      <div className="animate-background-breathe absolute inset-0 bg-gradient-to-b from-foreground/[0.05] via-transparent to-transparent" />
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_0%,black,transparent)]" />
      <div className="bg-grain absolute inset-0 opacity-[0.025] mix-blend-overlay" />
    </div>
  )
}

export { Background }
