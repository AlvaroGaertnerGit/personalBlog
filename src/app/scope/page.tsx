import { ScopeLab } from "./scope-lab";

// Development-only environment for validating Scope's moods and motion in
// isolation before wiring them into real placements (Hero, project cards,
// etc.) — think Storybook, scoped to this one character. Remove this
// route once Scope's real-site integrations make it redundant.
export default function ScopeLabPage() {
  return <ScopeLab />;
}
