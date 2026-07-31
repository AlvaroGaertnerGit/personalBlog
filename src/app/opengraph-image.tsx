import { ImageResponse } from "next/og";

// File-convention OG/Twitter image (Next.js infers the og:image and
// twitter:image meta tags automatically — no manual entry needed in
// layout.tsx's metadata). Built from the same palette as Scope's own
// character (see globals.css's --scope-* tokens) so a shared link echoes
// the site's own material instead of a generic dark gradient — hex values
// below are the sRGB equivalents of those oklch tokens (Satori/ImageResponse
// renders in a sandboxed environment, not this app's CSS custom properties).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 15% 10%, rgba(227,167,111,0.16) 0%, rgba(10,10,10,0) 70%), radial-gradient(ellipse 50% 45% at 90% 100%, rgba(140,126,240,0.14) 0%, rgba(10,10,10,0) 70%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 18px",
              borderRadius: "28px",
              backgroundColor: "#1a1512",
              border: "1px solid rgba(227,167,111,0.25)",
            }}
          >
            <div
              style={{
                width: "16px",
                height: "22px",
                borderRadius: "8px",
                backgroundColor: "#e3a76f",
              }}
            />
            <div
              style={{
                width: "16px",
                height: "22px",
                borderRadius: "8px",
                backgroundColor: "#e3a76f",
              }}
            />
          </div>
          <span style={{ fontSize: "28px", color: "#8a8580", letterSpacing: "0.08em" }}>
            SCOPE
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <span
            style={{
              fontSize: "76px",
              fontWeight: 600,
              color: "#f5f2ee",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            Álvaro Gaertner
          </span>
          <span style={{ fontSize: "34px", color: "#a39d96", maxWidth: "900px" }}>
            AI-native software portfolio — teaching and building real products.
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
