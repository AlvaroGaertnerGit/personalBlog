import { ImageResponse } from "next/og"

import { ScopeStatic } from "@/components/scope/scope-static"

// The one live dependency both email templates have on this app actually
// being deployed: `<Img src="{SITE_URL}/api/scope-mark" />` (see
// contact-email.tsx / visitor-confirmation-email.tsx) replaces an inline
// <svg> that would otherwise ship straight into the email body. Confirmed
// against caniemail.com rather than assumed: a raw inline <svg> tag isn't
// rendered by Gmail or Outlook at all (Apple Mail only partially), and
// while an actual .svg *file* referenced via <img src> fares much better
// (Gmail desktop, Apple Mail, even old Outlook desktop), it's explicitly
// broken on the Gmail mobile app for real Google accounts — the exact
// account type this project emails — so a rasterized PNG is the only
// option with no known-broken major client. This route rasterizes
// ScopeStatic (the one canonical static renderer — see its own comment for
// why there must only ever be this one) to a real PNG via Satori/
// ImageResponse, already used by this project's opengraph-image.tsx. No
// dynamic input, nothing here ever changes between requests, so Next.js
// serves this as a static, cacheable response rather than re-rendering it
// per email open.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ScopeStatic />
      </div>
    ),
    {
      width: 320,
      height: 420,
      headers: {
        "Cache-Control": "public, max-age=604800, immutable",
      },
    }
  )
}
