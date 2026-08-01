import { ImageResponse } from "next/og"

import { ScopeRaster } from "@/components/scope/scope-raster"

// The one live dependency both email templates have on this app actually
// being deployed: `<Img src="{SITE_URL}/api/scope-mark" />` (see
// contact-email.tsx / visitor-confirmation-email.tsx) replaces the inline
// <ScopeStatic> SVG that email clients — Gmail specifically — strip out of
// HTML email bodies entirely. This route rasterizes the exact same
// canonical shapes to a real PNG via Satori/ImageResponse (already used by
// this project's opengraph-image.tsx), which every email client renders as
// an ordinary image. No dynamic input, nothing here ever changes between
// requests, so Next.js serves this as a static, cacheable response rather
// than re-rendering it per email open.
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
        <ScopeRaster />
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
