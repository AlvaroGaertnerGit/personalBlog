import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

// TODO: replace [Álvaro Gaertner] with the real name/tagline before launch.
export const metadata: Metadata = {
  title: {
    default: "[Álvaro Gaertner] | AI-Native Software Portfolio",
    template: "%s | [Álvaro Gaertner]",
  },
  description:
    "Portfolio of [Álvaro Gaertner]. An AI-native personal website with projects built for quality, performance, and craft.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="relative isolate min-h-full flex flex-col">
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
