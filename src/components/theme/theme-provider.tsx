"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

// Thin wrapper so call sites import from "@/components/theme" like every
// other provider in this app, not from the "next-themes" package directly.
// class-based (not data-attribute) since every existing dark-mode rule in
// globals.css already targets `.dark` via the `@custom-variant dark
// (&:is(.dark *))` declaration.
function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
