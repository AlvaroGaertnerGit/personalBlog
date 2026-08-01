import { Resend } from "resend"

import { ContactEmail } from "./contact-email"
import { VisitorConfirmationEmail } from "./visitor-confirmation-email"

type SendResult = { ok: true } | { ok: false; reason: string }

interface EmailEnvConfig {
  apiKey: string
  /** e.g. "Scope <contact@alvarogaertner.com>" — see .env.example. */
  fromEmail: string
  /** The site owner's own inbox — where the internal notification lands. */
  toEmail: string
}

// Graceful startup validation, read once per send rather than at module
// load: this file is imported by a Route Handler, which Next.js can
// evaluate before every environment variable is necessarily available (or,
// in this specific case, simply because a deploy was never configured
// with them) — throwing at import time would take the whole route down
// for every request, not just the email-sending ones. A missing variable
// is reported clearly, server-side, exactly once per call, and every
// caller below treats a `null` return as "cannot send" — never an
// exception to propagate up into a crashed request.
function getEmailEnvConfig(): EmailEnvConfig | null {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.CONTACT_FROM_EMAIL
  const toEmail = process.env.CONTACT_TO_EMAIL

  const missing: string[] = []
  if (!apiKey) missing.push("RESEND_API_KEY")
  if (!fromEmail) missing.push("CONTACT_FROM_EMAIL")
  if (!toEmail) missing.push("CONTACT_TO_EMAIL")

  if (missing.length > 0) {
    console.error(
      `[lib/email/resend] Missing required environment variable(s): ${missing.join(", ")}. See .env.example / README.md.`
    )
    return null
  }

  // The checks above already guarantee these three are non-empty strings;
  // this cast just gives that back to the type system in one place instead
  // of re-asserting it at every call site.
  return { apiKey: apiKey!, fromEmail: fromEmail!, toEmail: toEmail! }
}

interface SendContactEmailInput {
  name: string
  email: string
  message: string
}

// The one abstraction boundary between this app and the Resend SDK — the
// route handler calls sendContactEmail(...) and never imports `Resend`,
// `ContactEmail`, or knows anything about the email's own shape (or, now,
// which address anything sends from/to — that's this file's job alone),
// so swapping providers later (or redesigning the letter itself) never
// touches src/app/api/contact/route.ts.
//
// SPR-010 — "the letter continues": passed as `react` (a React element),
// not a hand-built HTML string. Resend renders it server-side via
// react-email under the hood, and React's own escaping is what keeps a
// visitor's message/name safe to interpolate directly in contact-email.tsx
// with no manual sanitizing — see that file for the actual template.
export async function sendContactEmail(input: SendContactEmailInput): Promise<SendResult> {
  const config = getEmailEnvConfig()
  if (!config) {
    return { ok: false, reason: "missing_env_config" }
  }

  const resend = new Resend(config.apiKey)
  const deliveredAt = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC"

  const { error } = await resend.emails.send({
    from: config.fromEmail,
    to: config.toEmail,
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
export async function sendVisitorConfirmationEmail(
  input: SendVisitorConfirmationEmailInput
): Promise<SendResult> {
  const config = getEmailEnvConfig()
  if (!config) {
    return { ok: false, reason: "missing_env_config" }
  }

  const resend = new Resend(config.apiKey)
  const { error } = await resend.emails.send({
    from: config.fromEmail,
    to: input.email,
    replyTo: config.toEmail,
    subject: "Your letter has arrived.",
    react: <VisitorConfirmationEmail name={input.name} />,
  })

  if (error) {
    return { ok: false, reason: error.message ?? "resend_error" }
  }
  return { ok: true }
}
