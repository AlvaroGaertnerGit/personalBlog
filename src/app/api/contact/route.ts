import { sendContactEmail, sendVisitorConfirmationEmail } from "@/lib/email/resend"
import { contactSchema } from "@/schemas/contact"

// True if the honeypot field is filled in — a real visitor never reaches
// it (visually hidden, tabIndex={-1}, see contact-form.tsx). Checked on the
// raw, unvalidated body, before schema validation runs at all: a
// honeypot-tripped submission must get the exact same generic success
// response regardless of whether its other fields would even have passed
// validation, so nothing about the response ever reveals it was filtered.
function isHoneypotTripped(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false
  const company = (body as Record<string, unknown>).company
  return typeof company === "string" && company.length > 0
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }

  if (isHoneypotTripped(body)) {
    return Response.json({ ok: true }, { status: 200 })
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ ok: false }, { status: 422 })
  }
  const { name, email, message } = parsed.data

  // Dev-only bypass so the full accept/departure sequence can be exercised
  // locally without a real RESEND_API_KEY — never set this in production.
  if (process.env.CONTACT_SIMULATE_SUCCESS === "true") {
    console.log("[/api/contact] Simulated contact submission", { name, email, message })
    await wait(1800)
    return Response.json({ ok: true }, { status: 200 })
  }

  const result = await sendContactEmail({ name, email, message })
  if (!result.ok) {
    // Never leak *why* delivery failed (missing key, Resend error, ...) —
    // that's a deployment/provider detail, not something a visitor's
    // submission response should reveal. Full reason is server-logged only.
    console.error("[/api/contact] delivery failed:", result.reason)
    return Response.json({ ok: false }, { status: 500 })
  }

  // The internal notification above is the priority and has already
  // succeeded by this point — the visitor's own confirmation is a nice-to-
  // have on top of that, never allowed to affect the response. If it fails,
  // log it and move on silently; the visitor never sees this failure.
  try {
    const confirmation = await sendVisitorConfirmationEmail({ name, email })
    if (!confirmation.ok) {
      console.error("[/api/contact] visitor confirmation failed:", confirmation.reason)
    }
  } catch (err) {
    console.error("[/api/contact] visitor confirmation threw:", err)
  }

  return Response.json({ ok: true }, { status: 200 })
}
