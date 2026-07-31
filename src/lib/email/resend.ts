import { Resend } from "resend"

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Plain, professional, no branding/styling beyond basic readability — "no
// unnecessary styling" per the brief. A pure function so it's testable and
// reviewable independent of the Resend call itself.
function buildContactEmailHtml(input: SendContactEmailInput, timestamp: string) {
  return `
    <div style="font-family: -apple-system, sans-serif; font-size: 15px; line-height: 1.5; color: #1a1a1a;">
      <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
      <p><strong>Message:</strong><br />${escapeHtml(input.message).replace(/\n/g, "<br />")}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 16px 0;" />
      <p style="color: #666; font-size: 13px;">Timestamp (UTC): ${escapeHtml(timestamp)}</p>
    </div>
  `.trim()
}

// The one abstraction boundary between this app and the Resend SDK — the
// route handler calls sendContactEmail(...) and never imports `Resend` or
// knows its request/response shape directly, so swapping providers later
// (or adding a second one) never touches src/app/api/contact/route.ts.
export async function sendContactEmail(input: SendContactEmailInput): Promise<SendContactEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" }
  }

  const resend = new Resend(apiKey)
  const timestamp = new Date().toISOString()

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: DELIVERY_EMAIL,
    replyTo: input.email,
    subject: `New Portfolio Contact — ${input.name}`,
    html: buildContactEmailHtml(input, timestamp),
  })

  if (error) {
    return { ok: false, reason: error.message ?? "resend_error" }
  }
  return { ok: true }
}
