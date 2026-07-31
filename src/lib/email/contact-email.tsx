import * as React from "react"
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email"

import { CONTACT_ENDING_LINE } from "@/components/sections/contact-content"
import { ScopeStatic } from "@/components/scope/scope-static"
import { COLOR, SANS_FONT, SCOPE_EMAIL_THEME, SERIF_FONT } from "./shared"

// SPR-010 — "the letter continues." See sendContactEmail() in resend.tsx
// for how this is actually sent — as a React element via Resend's own
// `react` option, never rendered to an HTML string by hand (React's normal
// escaping is what keeps a visitor's own message safe to interpolate here
// with zero manual sanitizing). Shared colors/fonts live in ./shared.tsx —
// this is the internal notification (to the site owner);
// visitor-confirmation-email.tsx is the visitor-facing reply, built from
// the same foundation. Scope himself is ScopeStatic — the exact canonical
// shapes scope.tsx draws on the live site, not a redrawn illustration; see
// that component's own comment for why a "use client" component like the
// real, animated <Scope> can't be rendered here at all.

// Splits on newlines and rejoins with real <br /> elements rather than
// relying on `white-space: pre-wrap` (inconsistent support in older
// Outlook) — each line is still plain React-escaped text, so this stays
// exactly as safe as any other interpolated string here.
function LetterBody({ message }: { message: string }) {
  const lines = message.split("\n")
  return (
    <Text style={{ fontFamily: SERIF_FONT, fontSize: "18px", lineHeight: "1.7", color: COLOR.foreground, margin: 0 }}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </React.Fragment>
      ))}
    </Text>
  )
}

interface ContactEmailProps {
  name: string
  email: string
  message: string
  /** Already formatted (see resend.tsx) — this component doesn't own timezone/locale decisions. */
  deliveredAt: string
}

// The narrative continuation of the website's own closing scene: the
// visitor wrote on a sheet, it became a folded letter, Scope accepted it
// and walked away — this email is where that same letter arrives. Nothing
// here should read as a notification; there's deliberately no "view in
// browser" link, no unsubscribe/list-management chrome, no logo lockup —
// just the letter, who sent it, and a quiet signature from Scope.
function ContactEmail({ name, email, message, deliveredAt }: ContactEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>A new idea has arrived — Scope carried it here.</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset], theme: { extend: SCOPE_EMAIL_THEME } }}>
        <Body style={{ backgroundColor: COLOR.page, fontFamily: SANS_FONT, margin: 0, padding: "40px 16px" }}>
          <Container
            style={{
              backgroundColor: COLOR.card,
              maxWidth: "560px",
              margin: "0 auto",
              padding: "40px 32px",
              borderRadius: "24px",
              border: `1px solid ${COLOR.border}`,
            }}
          >
            <Section style={{ textAlign: "center", marginBottom: "20px" }}>
              <ScopeStatic className="h-13 w-13" />
            </Section>

            <Heading
              as="h1"
              style={{
                fontFamily: SANS_FONT,
                fontSize: "22px",
                fontWeight: 600,
                color: COLOR.foreground,
                textAlign: "center",
                margin: "0 0 6px",
              }}
            >
              A new idea has arrived.
            </Heading>
            <Text
              style={{
                fontFamily: SANS_FONT,
                fontSize: "14px",
                color: COLOR.muted,
                textAlign: "center",
                margin: "0 0 32px",
              }}
            >
              Scope carried it all the way here.
            </Text>

            {/* The letter itself — the one element that should visually
                stand apart from the rest of the email, "elegant paper
                tones... generous spacing," never a plain grey box. */}
            <Section
              style={{
                backgroundColor: COLOR.paper,
                border: `1px solid ${COLOR.paperBorder}`,
                borderRadius: "18px",
                padding: "28px 26px",
              }}
            >
              <LetterBody message={message} />
            </Section>

            {/* Sender, presented as correspondence rather than form
                fields — "Entrusted by," not "Name:" */}
            <Section style={{ marginTop: "28px" }}>
              <Text
                style={{
                  fontFamily: SANS_FONT,
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLOR.mutedLight,
                  margin: "0 0 4px",
                }}
              >
                Entrusted by
              </Text>
              <Text
                style={{
                  fontFamily: SANS_FONT,
                  fontSize: "16px",
                  fontWeight: 600,
                  color: COLOR.foreground,
                  margin: "0 0 2px",
                }}
              >
                {name}
              </Text>
              <Link
                href={`mailto:${email}`}
                style={{ fontFamily: SANS_FONT, fontSize: "13px", color: COLOR.muted }}
              >
                {email}
              </Link>
            </Section>

            <Hr style={{ borderColor: COLOR.border, margin: "28px 0 16px" }} />

            {/* Metadata — deliberately the smallest, quietest text on the
                page; the letter is the focus, this is just a timestamp. */}
            <Text style={{ fontFamily: SANS_FONT, fontSize: "12px", color: COLOR.mutedLight, margin: 0 }}>
              Delivered {deliveredAt}
            </Text>

            <Section style={{ textAlign: "center", marginTop: "36px" }}>
              <Text style={{ fontFamily: SANS_FONT, fontSize: "13px", color: COLOR.mutedLight, margin: "0 0 2px" }}>
                Delivered by Scope
              </Text>
              <Text style={{ fontFamily: SANS_FONT, fontSize: "13px", color: COLOR.mutedLight, margin: 0 }}>
                {CONTACT_ENDING_LINE}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export { ContactEmail }
