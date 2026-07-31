import { z } from "zod"

// The Contact route handler's server-side source of truth for what a
// submission may contain — the client's own `required`/`type="email"`
// attributes (contact-form.tsx) are a UX nicety, never trusted alone.
// `company` is the honeypot (see contact-form.tsx): optional, and its
// presence/emptiness is exactly what the route handler uses to decide
// whether a submission is real, never a validation concern of its own.
export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  // z.email(), not the deprecated z.string().email() chain (zod v4) —
  // trimmed first via .pipe() so incidental leading/trailing whitespace
  // from the client doesn't fail an otherwise-valid address.
  email: z.string().trim().pipe(z.email("Invalid email address")),
  message: z.string().trim().min(1, "Message is required").max(5000, "Message is too long"),
  company: z.string().optional(),
})

export type ContactInput = z.infer<typeof contactSchema>
