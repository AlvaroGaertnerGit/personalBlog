import * as React from "react"
import { cn } from "@/lib/utils"

// When a page has 2+ Sections, pass aria-labelledby={headingId} pointing
// at that section's own heading so it registers as a named landmark.
function Section({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="section"
      className={cn("py-16 sm:py-24", className)}
      {...props}
    />
  )
}

export { Section }
