import { Resend } from "resend"

import { ContactEmail } from "./contact-email"
import { VisitorConfirmationEmail } from "./visitor-confirmation-email"

// The delivery address for SPR-009's Contact section. Not an env var —
// unlike RESEND_API_KEY, this isn't a secret, and there's only ever one
// correct destination for this site's own inbox.
const DELIVERY_EMAIL = "alvarogaertnerufv18@gmail.com"

// Resend's shared onboarding sender — works with zero domain setup, but
// only delivers to the account owner's own verified email (which
// DELIVERY_EMAIL already is, since it's the account this key belongs to).
// TODO: swap for a verified sending domain (e.g. "Scope <hello@yourdomain>")
// once one exists, so delivery isn't tied to Resend's shared test sender.
const FROM_ADDRESS = "Scope <onboarding@resend.dev>"

interface SendContactEmailInput {
  name: string
  email: string
  message: string
}

type SendContactEmailResult = { ok: true } | { ok: false; reason: string }

// The one abstraction boundary between this app and the Resend SDK — the
// route handler calls sendContactEmail(...) and never imports `Resend`,
// `ContactEmail`, or knows anything about the email's own shape, so
// swapping providers later (or redesigning the letter itself) never
// touches src/app/api/contact/route.ts.
//
// SPR-010 — "the letter continues": passed as `react` (a React element),
// not a hand-built HTML string. Resend renders it server-side via
// react-email under the hood, and React's own escaping is what keeps a
// visitor's message/name safe to interpolate directly in contact-email.tsx
// with no manual sanitizing — see that file for the actual template.
export async function sendContactEmail(input: SendContactEmailInput): Promise<SendContactEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" }
  }

  const resend = new Resend(apiKey)
  const deliveredAt = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC"

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: DELIVERY_EMAIL,
    replyTo: input.email,
    subject: "A new idea has arrived.",
    react: (
      <ContactEmail name={input.name} email={input.email} message={input.message} deliveredAt={deliveredAt} />
    ),
  })

  if (error) {
    return { ok: false, reason: error.message ?? "resend_error" }
  }
  return { ok: true }
}

interface SendVisitorConfirmationEmailInput {
  name: string
  email: string
}

// SPR-010 — "the letter continues," the visitor's own side: sent after the
// internal notification above succeeds, confirming Scope's journey is
// actually complete. Deliberately a *separate* function from
// sendContactEmail rather than a second recipient on the same send — the
// two emails have different templates, different tones (Álvaro's own
// signed voice here, not the internal notification's), and, per the
// calling route handler, different failure tolerance (this one is allowed
// to fail silently; the internal notification is not).
//
// A real, current limitation worth knowing: Resend's shared
// `onboarding@resend.dev` sender (see FROM_ADDRESS above) can only deliver
// to the Resend account's own verified address — it cannot yet send to an
// arbitrary visitor's inbox. Until a verified sending domain replaces it,
// every call here will fail (logged by the caller, never surfaced to the
// visitor) except when testing with the account owner's own email. This
// isn't a bug to fix in this function; it resolves itself the moment
// FROM_ADDRESS points at a verified domain.
export async function sendVisitorConfirmationEmail(
  input: SendVisitorConfirmationEmailInput
): Promise<SendContactEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" }
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.email,
    replyTo: DELIVERY_EMAIL,
    subject: "Your letter has arrived.",
    react: <VisitorConfirmationEmail name={input.name} />,
  })

  if (error) {
    return { ok: false, reason: error.message ?? "resend_error" }
  }
  return { ok: true }
}
