"use client";

// Web Preview: Scope 3D at real CSS size, in the blog's real context. This
// page is the document inside /scope-lab's iframe (so Tailwind's breakpoints
// see a real phone/desktop viewport) and also works standalone, e.g. opened
// on a phone. Everything around Scope is the site's own components and copy:
// the root layout's Background, Hero*, Section/Container, AboutWorkbench.

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight } from "lucide-react";

import {
  Hero,
  HeroActions,
  HeroContent,
  HeroDescription,
  HeroEyebrow,
  HeroMedia,
  HeroTitle,
} from "@/components/hero/hero";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { DEFAULT_SCOPE_3D_LIGHTING } from "@/components/scope-3d/engine/scope-3d-stage";
import type {
  Scope3DViewerHandle,
  Scope3DViewerStatus,
} from "@/components/scope-3d/scope-3d-viewer";
import { AboutWorkbench } from "@/components/sections/about-workbench";
import {
  ABOUT_HOTSPOTS,
  ABOUT_INTRO,
} from "@/components/sections/about-content";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  type LabToPreview,
  type PreviewSettings,
  type PreviewToLab,
} from "../preview-protocol";

const Scope3DViewer = dynamic(
  () =>
    import("@/components/scope-3d/scope-3d-viewer").then(
      (m) => m.Scope3DViewer,
    ),
  { ssr: false },
);

const MODEL_URL = "/scope-lab/scope.glb";
const STATUS_MS = 250;
/** Loupe: centre crop of the canvas, in device pixels, drawn at an integer zoom. */
const LOUPE_CROP = 72;
const LOUPE_ZOOM = 5;

function Scope3DWebPreview({
  initialSettings,
}: {
  initialSettings: PreviewSettings;
}) {
  // Settings arrive in the URL first (parsed by the page, so it works
  // standalone), then live over postMessage from the lab.
  const [settings, setSettings] = React.useState(initialSettings);
  const [status, setStatus] = React.useState<Scope3DViewerStatus>({
    phase: "loading",
    loaded: 0,
    total: null,
  });
  const handleRef = React.useRef<Scope3DViewerHandle | null>(null);
  const [canvas, setCanvas] = React.useState<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const onMessage = (e: MessageEvent<LabToPreview>) => {
      if (e.origin !== window.location.origin || e.data?.source !== "scope-lab")
        return;
      const director = handleRef.current?.director;
      if (e.data.type === "settings") setSettings(e.data.settings);
      else if (e.data.type === "click") director?.click();
      else if (e.data.type === "trigger") director?.triggerAutonomous();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Theme the way the site does it: a `dark` class on <html>. Applied
  // directly (not through next-themes) so the visitor's saved preference for
  // the real site is never overwritten by the lab.
  React.useEffect(() => {
    const html = document.documentElement;
    const dark = settings.theme === "dark";
    const apply = () => {
      if (html.classList.contains("dark") !== dark) html.classList.toggle("dark", dark);
      html.style.colorScheme = settings.theme;
    };
    apply();
    // next-themes (root layout) re-applies the stored theme after mounting; hold ours.
    const observer = new MutationObserver(apply);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [settings.theme]);

  React.useEffect(() => {
    if (canvas) handleRef.current?.director.setAutonomous(settings.autonomous);
  }, [canvas, settings.autonomous]);

  // Report back to the lab panel (no-op when opened standalone).
  React.useEffect(() => {
    if (window.parent === window) return;
    const id = window.setInterval(() => {
      const h = handleRef.current;
      const snap = h?.director.snapshot();
      const frame = h?.frame();
      const message: PreviewToLab = {
        source: "scope-preview",
        type: "status",
        status: {
          ready: !!h,
          error: status.phase === "error" ? status.message : undefined,
          state: snap?.state ?? "LOADING",
          nextInMs: snap?.nextInMs ?? null,
          fps: frame?.fps ?? 0,
          devicePixelRatio: window.devicePixelRatio,
          pixelRatio: frame?.quality.pixelRatio ?? 0,
          ssaa: frame?.quality.ssaa ?? 0,
          canvasPx: frame?.canvasPx ?? [0, 0],
          internalPx: frame?.internalPx ?? [0, 0],
          cpuMs: frame?.cpuMs ?? 0,
          governed: frame?.governed ?? false,
          log:
            snap?.log
              .slice(0, 6)
              .map((e) => `${(e.at / 1000).toFixed(1)}s ${e.text}`) ?? [],
        },
      };
      window.parent.postMessage(message, window.location.origin);
    }, STATUS_MS);
    return () => window.clearInterval(id);
  }, [status]);

  const lighting = React.useMemo(
    () => ({ ...DEFAULT_SCOPE_3D_LIGHTING, bloom: settings.halo }),
    [settings.halo],
  );

  const onReady = React.useCallback((handle: Scope3DViewerHandle) => {
    handleRef.current = handle;
    (window as unknown as { __scopeLab?: Scope3DViewerHandle }).__scopeLab =
      handle;
    setCanvas(handle.stage.renderer.domElement);
  }, []);

  const scope = (
    <div
      data-slot="scope-3d-slot"
      className="relative shrink-0"
      style={{ width: settings.size, height: settings.size }}
    >
      <Scope3DViewer
        modelUrl={MODEL_URL}
        mode="preview"
        // undefined = the resolution policy (exact device pixels + supersampling)
        pixelRatio={
          settings.pixelRatio === "auto" ? undefined : settings.pixelRatio
        }
        ssaa={settings.ssaa === "auto" ? undefined : settings.ssaa}
        lighting={lighting}
        onReady={onReady}
        onStatus={setStatus}
      />
      {status.phase === "error" && (
        <p
          role="alert"
          className="text-destructive absolute inset-0 grid place-items-center text-center text-xs"
        >
          Scope failed to load
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* Same as /scope-lab: the root layout's 2D companion and theme toggle
          would otherwise sit on top of the simulation. */}
      <style>{`[data-slot="companion-scope"],[data-slot="theme-toggle"]{display:none!important}`}</style>
      {settings.scene === "hero" ? (
        <HeroScene scope={scope} />
      ) : (
        <AboutScene scope={scope} />
      )}
      {settings.loupe && canvas && <Loupe canvas={canvas} />}
    </>
  );
}

/** Mirror of the home Hero (src/app/page.tsx) with Scope 3D on the platform. */
function HeroScene({ scope }: { scope: React.ReactNode }) {
  return (
    <Hero id="hero">
      <HeroContent>
        <div className="flex flex-col gap-3 sm:gap-4">
          <HeroEyebrow>
            Computer Science &amp; Software Development Teacher
          </HeroEyebrow>
          <HeroTitle>
            I teach developers the AI-native workflows I use to ship real
            projects.
          </HeroTitle>
        </div>
        <HeroDescription>
          I teach Software Development to vocational (FP) students in Spain.
          Alongside that, I build the tools I teach with, like this site and
          Tournamently, a padel tournament platform.
        </HeroDescription>
        <HeroActions>
          <span className={cn(buttonVariants({ size: "lg" }))}>
            GitHub
            <ArrowUpRight aria-hidden="true" data-icon="inline-end" />
          </span>
          <span
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            LinkedIn
            <ArrowUpRight aria-hidden="true" data-icon="inline-end" />
          </span>
        </HeroActions>
      </HeroContent>
      <HeroMedia>{scope}</HeroMedia>
    </Hero>
  );
}

/** Mirror of AboutSection: Scope resting above the intro, beside the workbench. */
function AboutScene({ scope }: { scope: React.ReactNode }) {
  return (
    <Section id="about" aria-labelledby="about-heading">
      <Container>
        <div className="border-border/60 from-muted/50 to-muted/10 relative overflow-hidden rounded-4xl border bg-gradient-to-b p-8 backdrop-blur-sm sm:p-10 lg:p-14">
          <div
            aria-hidden="true"
            className="bg-grid pointer-events-none absolute inset-0 opacity-10"
          />
          <div className="relative flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
            <div className="flex flex-col items-start gap-12 sm:gap-16 lg:w-72 lg:shrink-0">
              {scope}
              <div className="flex flex-col gap-3">
                <p className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
                  <span
                    aria-hidden="true"
                    className="bg-foreground/40 h-px w-6"
                  />
                  {ABOUT_INTRO.eyebrow}
                </p>
                <h2
                  id="about-heading"
                  className="text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  {ABOUT_INTRO.heading}
                </h2>
              </div>
            </div>
            <AboutWorkbench
              hotspots={ABOUT_HOTSPOTS}
              hint={ABOUT_INTRO.hint}
              className="flex-1"
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}

/** Pixel-exact magnifier of the canvas centre (no smoothing), redrawn every frame. */
function Loupe({ canvas }: { canvas: HTMLCanvasElement }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const out = ref.current?.getContext("2d");
    if (!out) return;
    out.imageSmoothingEnabled = false;
    let id = 0;
    const draw = () => {
      // Runs after three's render in the same frame, while the drawing buffer is still valid.
      const sx = (canvas.width - LOUPE_CROP) / 2;
      const sy = (canvas.height - LOUPE_CROP) / 2;
      out.clearRect(0, 0, LOUPE_CROP * LOUPE_ZOOM, LOUPE_CROP * LOUPE_ZOOM);
      out.drawImage(
        canvas,
        sx,
        sy,
        LOUPE_CROP,
        LOUPE_CROP,
        0,
        0,
        LOUPE_CROP * LOUPE_ZOOM,
        LOUPE_CROP * LOUPE_ZOOM,
      );
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [canvas]);
  return (
    <figure className="border-border bg-background/90 fixed right-3 bottom-3 z-50 flex flex-col gap-1 rounded-lg border p-2 backdrop-blur">
      <canvas
        ref={ref}
        width={LOUPE_CROP * LOUPE_ZOOM}
        height={LOUPE_CROP * LOUPE_ZOOM}
        className="size-[180px] sm:size-[240px]"
        style={{ imageRendering: "pixelated" }}
      />
      <figcaption className="text-muted-foreground font-mono text-[10px]">
        canvas centre · {LOUPE_CROP}×{LOUPE_CROP} device px
      </figcaption>
    </figure>
  );
}

export { Scope3DWebPreview };
