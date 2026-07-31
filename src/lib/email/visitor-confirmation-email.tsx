import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email"

import { CONTACT_ENDING_LINE } from "@/components/sections/contact-content"
import { ScopeStatic } from "@/components/scope/scope-static"
import { COLOR, SANS_FONT, SCOPE_EMAIL_THEME } from "./shared"

interface VisitorConfirmationEmailProps {
  name: string
}

// SPR-010 — "the letter continues," the visitor's own side of it: the
// website ends with Scope walking away carrying the letter; this is what
// confirms he arrived. Deliberately short — "do not repeat the message
// they already wrote, they know what they sent" — and deliberately not in
// Scope's own voice: Scope never speaks (see docs/scope-docs/scope/), so
// this is Álvaro's own signed reply, with Scope appearing only as
// ScopeStatic — the exact canonical shapes scope.tsx draws on the live
// site, carrying the letter here exactly as on the site itself, not a
// redrawn illustration.
function VisitorConfirmationEmail({ name }: VisitorConfirmationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Scope safely delivered your letter.</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset], theme: { extend: SCOPE_EMAIL_THEME } }}>
        <Body style={{ backgroundColor: COLOR.page, fontFamily: SANS_FONT, margin: 0, padding: "40px 16px" }}>
          <Container
            style={{
              backgroundColor: COLOR.card,
              maxWidth: "480px",
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
                margin: "0 0 28px",
              }}
            >
              Your idea completed its journey.
            </Heading>

            <Text style={{ fontFamily: SANS_FONT, fontSize: "16px", lineHeight: "1.7", color: COLOR.foreground, margin: "0 0 16px" }}>
              Scope delivered it safely.
            </Text>
            <Text style={{ fontFamily: SANS_FONT, fontSize: "16px", lineHeight: "1.7", color: COLOR.foreground, margin: "0 0 16px" }}>
              Thank you for taking the time to share it, {name.split(" ")[0]}. I&apos;ll read it personally and
              reply as soon as I can.
            </Text>
            <Text style={{ fontFamily: SANS_FONT, fontSize: "16px", lineHeight: "1.7", color: COLOR.foreground, margin: "0 0 4px" }}>
              Until then, keep building.
            </Text>
            <Text style={{ fontFamily: SANS_FONT, fontSize: "16px", lineHeight: "1.7", color: COLOR.foreground, margin: 0 }}>
              Scope delivered it safely.

              Now it&apos;s my turn.

              — Álvaro
            </Text>

            <Section style={{ textAlign: "center", marginTop: "40px" }}>
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

export { VisitorConfirmationEmail }
