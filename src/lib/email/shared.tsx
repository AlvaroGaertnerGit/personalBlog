// SPR-010 — the shared foundation both email templates (`contact-email.tsx`,
// the internal notification; `visitor-confirmation-email.tsx`, the
// visitor-facing reply) are built from, so the site's own palette is
// defined exactly once. This is the one place the portfolio's visual
// identity gets translated for an audience of email clients rather than a
// browser: colors below are literal hex, not the site's own oklch custom
// properties (CSS variables don't reach most email clients at all), and
// nothing here uses a blur filter, gradient, or webfont — all three
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
} as const

export const SANS_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
// The letter's own body copy reads in a serif — evoking the site's own
// font-notebook (Newsreader) "handwritten in spirit" without depending on
// a webfont email clients mostly won't load anyway.
export const SERIF_FONT = "Georgia, 'Iowan Old Style', Charter, 'Times New Roman', serif"

// Scope himself is rendered by ScopeStatic (src/components/scope/
// scope-static.tsx) — the *same* canonical shapes/paths scope.tsx draws on
// the live site, sourced from the same scope-geometry.ts/scope-motion.ts,
// never redrawn here. That component styles itself with the site's own
// Tailwind classNames (fill-scope-warm, fill-scope-shell, ...); this is
// the theme extension both email templates pass to react-email's own
// <Tailwind> wrapper so those classNames resolve to real colors in an
// email context the same way the site's real Tailwind build resolves them
// in a browser. Values are the email-safe hex equivalents of this
// project's oklch --scope-* tokens (globals.css) — CSS custom properties
// don't reach most email clients, so this is the one place those tokens
// get translated, not re-chosen.
export const SCOPE_EMAIL_THEME = {
  colors: {
    "scope-warm": "#e0ad5e",
    "scope-shell": "#f1ede6",
    "scope-details": "#3f3d45",
    "scope-display": "#1a1816",
    "scope-accent": "#8c7fdb",
  },
} as const
