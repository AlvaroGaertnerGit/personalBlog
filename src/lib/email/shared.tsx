// SPR-010 — the shared foundation both email templates (`contact-email.tsx`,
// the internal notification; `visitor-confirmation-email.tsx`, the
// visitor-facing reply) are built from, so Scope's seal and the site's own
// palette are defined exactly once. This is the one place the portfolio's
// visual identity gets translated for an audience of email clients rather
// than a browser: colors below are literal hex, not the site's own oklch
// custom properties (CSS variables don't reach most email clients at all),
// and nothing here uses a blur filter, gradient, or webfont — all three
// degrade unpredictably across Gmail/Outlook/Apple Mail. The goal is the
// same material language as the site (paper tones, generous spacing,
// restrained color), reached through email-safe means, not the exact same
// CSS.
export const COLOR = {
  page: "#f4f4f5",
  card: "#ffffff",
  paper: "#faf7f0",
  paperBorder: "#e8e2d3",
  border: "#e4e4e7",
  foreground: "#0a0a0a",
  muted: "#71717a",
  mutedLight: "#a1a1aa",
  scopeWarm: "#e0ad5e",
  scopeShell: "#f1ede6",
  scopeDetails: "#3f3d45",
  scopeDisplay: "#1a1816",
} as const

export const SANS_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
// The letter's own body copy reads in a serif — evoking the site's own
// font-notebook (Newsreader) "handwritten in spirit" without depending on
// a webfont email clients mostly won't load anyway.
export const SERIF_FONT = "Georgia, 'Iowan Old Style', Charter, 'Times New Roman', serif"

// A small, static reading of Scope's real shapes (viewBox/paths lifted
// directly from scope.tsx, the canonical SVG — not redrawn or
// reinterpreted) — no motion, no blur-filtered glow (poor email-client
// support), no personality/presence layers. "A seal of authenticity," not
// a decoration: this is the one place in the whole portfolio Scope appears
// without his usual animation system, because he physically can't here.
export function ScopeSeal() {
  return (
    <svg width="52" height="52" viewBox="0 -30 160 210" xmlns="http://www.w3.org/2000/svg">
      <rect x="42" y="146" width="24" height="28" rx="12" fill={COLOR.scopeDetails} />
      <rect x="92" y="146" width="24" height="28" rx="12" fill={COLOR.scopeDetails} />
      <ellipse
        cx="80"
        cy="78"
        rx="75"
        ry="71"
        fill={COLOR.scopeShell}
        stroke={COLOR.scopeDetails}
        strokeOpacity="0.1"
        strokeWidth="2"
      />
      <path
        d="M 66 9 Q 61 -5 68 -15"
        stroke={COLOR.scopeDetails}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle
        cx="68"
        cy="-17"
        r="6"
        fill={COLOR.scopeShell}
        stroke={COLOR.scopeDetails}
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <path
        d="M46 34 H114 C129 34 140 45 140 60 V92 C140 109 127 122 110 122 H50 C33 122 20 109 20 92 V60 C20 45 31 34 46 34 Z"
        fill={COLOR.scopeDisplay}
        stroke={COLOR.scopeDetails}
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <rect x="56" y="61" width="18" height="32" rx="9" fill={COLOR.scopeWarm} />
      <rect x="88" y="61" width="18" height="32" rx="9" fill={COLOR.scopeWarm} />
    </svg>
  )
}
