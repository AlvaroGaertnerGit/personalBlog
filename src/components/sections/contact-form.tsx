"use client"

import * as React from "react"
import { Field } from "@base-ui/react/field"
import { Form } from "@base-ui/react/form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { CONTACT_FORM_COPY } from "./contact-content"

interface ContactFormProps {
  className?: string
  /** Fired once, the first time the visitor engages with the form (the Name field's first focus) — see contact-desk.tsx, the only place this drives a Scope reaction. */
  onFirstInteraction?: () => void
  onSubmittingChange?: (submitting: boolean) => void
  /** Fired on a real successful delivery *and* silently on a honeypot trip — either way the visitor sees the same outcome. */
  onDelivered?: () => void
}

// Scope-agnostic on purpose (mirrors the notebook-workspace.tsx/
// notebook-document.tsx split: one file orchestrates, one renders one
// concern) — this file knows nothing about the scene machine or Scope,
// only about the form itself. Built on @base-ui/react's Form/Field, which
// collects every named field's value into a single `formValues` object on
// submit — no per-field React state needed. Outcomes are reported upward
// via props; per the brief there's no toast/modal/success UI in here at
// all — a successful delivery unmounts this component entirely (handled by
// the parent's own scene transition), so there's nothing to reset or clear.
//
// SPR-009.1: fields are deliberately borderless/underline-only (overriding
// Input/Textarea's own default boxed chrome via className, not changing
// those shared primitives themselves — a future section that wants an
// ordinary boxed field still gets one) and labels are quiet, small-caps
// "eyebrow" style rather than bold — "the visitor should feel like they're
// writing inside Scope's workspace, not filling out a website." The submit
// button is `variant="outline"`, not the default solid CTA, for the same
// reason: this shouldn't read as a loud "Submit" button.
const fieldClassName =
  "rounded-none border-0 border-b border-border/40 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-foreground/50"
const labelClassName = "text-muted-foreground text-xs font-medium tracking-widest uppercase"
function ContactForm({ className, onFirstInteraction, onSubmittingChange, onDelivered }: ContactFormProps) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const hasInteractedRef = React.useRef(false)

  const handleFirstFocus = React.useCallback(() => {
    if (hasInteractedRef.current) return
    hasInteractedRef.current = true
    onFirstInteraction?.()
  }, [onFirstInteraction])

  const handleFormSubmit = React.useCallback(
    async (values: Record<string, unknown>) => {
      // Honeypot: a real visitor never reaches or fills this field (visually
      // hidden, tabIndex={-1}). If it's non-empty, this is a bot — report the
      // same "delivered" outcome without ever calling the API, so nothing
      // about the response distinguishes real submissions from filtered ones.
      if (typeof values.company === "string" && values.company.length > 0) {
        onDelivered?.()
        return
      }

      setError(null)
      setPending(true)
      onSubmittingChange?.(true)

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            email: values.email,
            message: values.message,
          }),
        })
        if (!response.ok) throw new Error("Request failed")
        onDelivered?.()
      } catch {
        setPending(false)
        onSubmittingChange?.(false)
        setError(CONTACT_FORM_COPY.errorMessage)
      }
    },
    [onSubmittingChange, onDelivered]
  )

  return (
    <Form
      className={cn("flex flex-col gap-5", className)}
      onFormSubmit={(values) => {
        void handleFormSubmit(values)
      }}
    >
      <Field.Root name="name" className="flex flex-col gap-1.5">
        <Label className={labelClassName}>{CONTACT_FORM_COPY.nameLabel}</Label>
        <Input
          required
          placeholder={CONTACT_FORM_COPY.namePlaceholder}
          disabled={pending}
          onFocus={handleFirstFocus}
          className={fieldClassName}
        />
      </Field.Root>

      <Field.Root name="email" className="flex flex-col gap-1.5">
        <Label className={labelClassName}>{CONTACT_FORM_COPY.emailLabel}</Label>
        <Input
          type="email"
          required
          placeholder={CONTACT_FORM_COPY.emailPlaceholder}
          disabled={pending}
          className={fieldClassName}
        />
      </Field.Root>

      <Field.Root name="message" className="flex flex-col gap-1.5">
        <Label className={labelClassName}>{CONTACT_FORM_COPY.messageLabel}</Label>
        <Textarea
          required
          placeholder={CONTACT_FORM_COPY.messagePlaceholder}
          disabled={pending}
          rows={3}
          className={cn(fieldClassName, "resize-none")}
        />
      </Field.Root>

      {/* Honeypot — invisible and unreachable by keyboard/AT for a real
          visitor, restraint-compatible spam resistance with no visible
          CAPTCHA badge, per the brief's "no gimmicks" principle. */}
      <Field.Root
        name="company"
        aria-hidden="true"
        className="pointer-events-none absolute -left-full opacity-0"
      >
        <Field.Control tabIndex={-1} autoComplete="off" />
      </Field.Root>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? CONTACT_FORM_COPY.submittingLabel : CONTACT_FORM_COPY.submitLabel}
      </Button>
    </Form>
  )
}

export { ContactForm }
