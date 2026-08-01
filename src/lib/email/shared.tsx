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

// Scope himself used to be rendered inline here as ScopeStatic's own SVG
// markup — replaced once it turned out Gmail strips inline <svg> elements
// from HTML email bodies entirely (a sanitizer policy, not a rendering
// bug), so nothing between the shell tags below ever actually reached a
// Gmail inbox. SCOPE_MARK_URL instead points at a real PNG, rasterized from
// the exact same canonical shapes by src/app/api/scope-mark/route.tsx
// (Satori/ImageResponse, already used by this project's opengraph-image.tsx)
// — every email client renders a plain <img>. Falls back to localhost the
// same way layout.tsx/sitemap.ts/robots.ts already do; email images must be
// an absolute, publicly reachable URL, so this only actually resolves once
// deployed with NEXT_PUBLIC_SITE_URL set.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
export const SCOPE_MARK_URL = `${SITE_URL}/api/scope-mark`

// Kept for the rest of each template's own Tailwind classNames (the letter
// card, text, borders, ...) — email-safe hex equivalents of this project's
// oklch --scope-* tokens (globals.css); CSS custom properties don't reach
// most email clients, so this is the one place those tokens get translated,
// not re-chosen. No longer resolves a Scope SVG's own fill-scope-* classes
// (see SCOPE_MARK_URL above) but scope-raster.tsx's HEX constants intentionally
// mirror these same values so the rasterized mark stays visually identical.
export const SCOPE_EMAIL_THEME = {
  colors: {
    "scope-warm": "#e0ad5e",
    "scope-shell": "#f1ede6",
    "scope-details": "#3f3d45",
    "scope-display": "#1a1816",
    "scope-accent": "#8c7fdb",
  },
} as const
