import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { cn } from "@/lib/utils"

// Visual layer on top of the structural foundation. Still no motion here —
// see the motion skill before adding any reveal/parallax in a later story.

function Hero({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <Section
      data-slot="hero"
      className={cn("flex min-h-dvh items-center", className)}
      {...props}
    >
      <Container className="grid gap-12 sm:gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
        {children}
      </Container>
    </Section>
  )
}

function HeroContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="hero-content"
      className={cn("flex flex-col gap-8 sm:gap-10 lg:gap-12", className)}
      {...props}
    />
  )
}

function HeroEyebrow({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="hero-eyebrow"
      className={cn(
        "text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase",
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className="bg-foreground/40 h-px w-6" />
      {children}
    </p>
  )
}

function HeroTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="hero-title"
      className={cn(
        "text-4xl leading-tight font-semibold text-balance tracking-tight sm:text-6xl lg:text-7xl lg:tracking-[-0.02em]",
        className
      )}
      {...props}
    />
  )
}

function HeroDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="hero-description"
      className={cn(
        "text-muted-foreground max-w-prose text-lg leading-relaxed text-pretty sm:text-xl",
        className
      )}
      {...props}
    />
  )
}

function HeroActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="hero-actions"
      className={cn("flex flex-wrap items-center gap-4", className)}
      {...props}
    />
  )
}

// A reusable presentation surface, not a fixed image slot. The frame's
// material — glass gradient, backdrop blur, border, external glow, and the
// grid texture reused from the global Background — is the one constant
// that should make any future content still read as "this site's hero."
// Everything that legitimately varies by content type is a variant:
//
// - `ratio`: square (default — abstract/AI visual, current placeholder),
//   portrait (a professional photo), video (a terminal, editor, dashboard,
//   or project-showcase mockup — all wider than tall as "window" shapes).
// - `fit`: contained (default — centers content with padding, for the
//   placeholder/illustrations that shouldn't bleed to the edge) or full
//   (no padding/centering — for a photo, video, or canvas that should
//   bleed to the frame's rounded corners).
//
// A `fit="full"` child is responsible for its own sizing strategy inside
// the plain `absolute inset-0` wrapper (e.g. next/image with `fill`, or a
// `<video>`/`<canvas>` styled to taste) — deliberately not forced to one
// `object-fit` value here, since a photo (cover) and an illustration
// (contain) want different answers. Swapping in real content later is a
// matter of picking these two variants; no structural changes needed here
// or at any call site.
const heroMediaVariants = cva(
  "border-border/60 from-muted/50 to-muted/10 relative overflow-hidden rounded-4xl border bg-gradient-to-b backdrop-blur-sm",
  {
    variants: {
      ratio: {
        square: "aspect-square",
        portrait: "aspect-[4/5]",
        video: "aspect-video",
      },
      fit: {
        contained: "flex items-center justify-center p-6 sm:p-8 lg:p-10",
        full: "",
      },
    },
    defaultVariants: {
      ratio: "square",
      fit: "contained",
    },
  }
)

function HeroMedia({
  className,
  children,
  ratio = "square",
  fit = "contained",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof heroMediaVariants>) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="bg-foreground/10 absolute inset-8 -z-10 rounded-full blur-3xl"
      />
      <div
        data-slot="hero-media"
        className={cn(heroMediaVariants({ ratio, fit, className }))}
        {...props}
      >
        <div
          aria-hidden="true"
          className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,black,transparent)]"
        />
        <div
          className={cn(
            "text-muted-foreground",
            fit === "full" ? "absolute inset-0" : "relative"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export {
  Hero,
  HeroContent,
  HeroEyebrow,
  HeroTitle,
  HeroDescription,
  HeroActions,
  HeroMedia,
}
