import { ScopeStatic } from "@/components/scope/scope-static"

// Sport Coach's "world" -- deliberately the simplest of the three (brief:
// "muy poco trabajo," no new animation/physics system to build). Reuses
// the project's own existing static SCOPE renderer as-is rather than
// drawing a new scene; SCOPE already *is* Sport Coach's brand character
// (see sport-coach/docs/scope-logo -- the app's own icon set was derived
// from this same character, just re-themed to Sport Coach's red/black
// palette). A Server Component: no motion needed here, matching "no
// rehacer el blog."
function SportCoachWorld() {
  return (
    <div className="from-muted/25 relative flex h-64 w-full items-center justify-center overflow-hidden bg-gradient-to-t to-transparent sm:h-80">
      <ScopeStatic />
    </div>
  )
}

export { SportCoachWorld }
