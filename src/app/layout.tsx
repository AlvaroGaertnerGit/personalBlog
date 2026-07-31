import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";
import { Background } from "@/components/layout/background";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ThemeTransitionProvider } from "@/components/theme/theme-transition-controller";
import { ScopeDockProvider } from "@/components/scope/companion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// SPR-008 — the Open Notebook section's own serif face (font-notebook in
// globals.css), scoped to that section only, never the site's body font.
// Regular weight + italic only — nothing in that section pairs this font
// with font-medium/font-semibold, so a second static weight would just be
// unused build output.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = "Álvaro Gaertner";
const SITE_TITLE = `${SITE_NAME} | AI-Native Software Portfolio`;
const SITE_DESCRIPTION =
  "Portfolio of Álvaro Gaertner — Computer Science & Software Development teacher building AI-native tools like this site and Tournamently.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  authors: [{ name: SITE_NAME }],
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Background stays white in light mode and the same near-black shadcn uses
// in dark mode (oklch(1 0 0) / oklch(0.145 0 0) in globals.css) — keeps the
// mobile browser chrome matching the page instead of defaulting to white
// under a dark-themed page.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full overflow-x-hidden antialiased`}
      suppressHydrationWarning
    >
      {/* SPR-009: Contact's departure sequence deliberately moves Scope
          (absolutely positioned inside the companion stage, see
          scope-dock-context.tsx) a little past the desk panel's own right
          edge so it visibly exits rather than just shrinking in place —
          that transform can briefly exceed the document's normal content
          width. overflow-x-hidden on both <html> (the element the
          browser's own horizontal scrollbar actually reflects) and <body>
          is what keeps that from ever growing the page into a
          horizontally scrollable one, without touching normal vertical
          scroll behavior anywhere else. */}
      <body className="relative isolate flex min-h-full flex-col overflow-x-hidden">
        <ThemeProvider>
          <Background />
          <MotionProvider>
            {/* SPR-006: ThemeTransitionProvider must sit inside
                ScopeDockProvider — it borrows Scope's position via
                useScopeDockContext() to run the theme-transition curtain
                sequence. ThemeToggle moves inside it too (it's
                position:fixed, so this doesn't affect layout) since it now
                triggers that sequence instead of switching themes itself. */}
            <ScopeDockProvider>
              <ThemeTransitionProvider>
                <ThemeToggle className="fixed top-4 right-4 z-50 sm:top-6 sm:right-6" />
                {children}
              </ThemeTransitionProvider>
            </ScopeDockProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
