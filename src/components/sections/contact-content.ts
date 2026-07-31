// Copy source for the Contact section (SPR-009, "The Final Scene"). Kept
// separate from the components that render it, same convention as
// about-content.ts/projects-content.ts/notebook-content.ts — see the
// portfolio-writing skill before editing any string here.

export const CONTACT_INTRO = {
  eyebrow: "One last thing",
  heading: "Write it down.",
} as const

// submitLabel: of the brief's three options ("Entrust it to Scope" / "Pass
// it to Scope" / "Let Scope deliver it.") this reads best as an actual
// button — short, an active verb, and it's literally what happens next
// (Scope carries the note away). errorMessage is deliberately quiet, not
// alarming — a failed request is a small inconvenience here, not a crisis.
// replayLabel (SPR-009.3): the quiet secondary invitation once Scope has
// walked off with a letter — deliberately not "Send another" or "Reset,"
// which would read as a form/UI action rather than an invitation to begin
// the same ritual again.
export const CONTACT_FORM_COPY = {
  nameLabel: "Name",
  namePlaceholder: "Your name",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  messageLabel: "Your idea",
  messagePlaceholder: "What's the idea?",
  submitLabel: "Pass it to Scope",
  submittingLabel: "Delivering…",
  errorMessage: "That didn't quite land. Try again?",
  replayLabel: "Write another letter",
} as const

// Confirmed exact string with the site owner — the one line left on screen
// once Scope has walked off. Not "Thank you" / "Message sent" / "We'll be
// in touch" — a closing statement, not a form receipt.
export const CONTACT_ENDING_LINE = "Every great idea starts with a conversation."
