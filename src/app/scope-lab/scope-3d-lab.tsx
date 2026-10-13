"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import {
  AUTONOMOUS_BEHAVIORS,
  DEFAULT_SCOPE_3D_BEHAVIOR,
} from "@/components/scope-3d/behavior/scope-3d-config";
import {
  IDLE_CLIP,
  type Scope3DBlendMode,
} from "@/components/scope-3d/engine/scope-3d-animator";
import type { Scope3DDirectorSnapshot } from "@/components/scope-3d/engine/scope-3d-director";
import { DEFAULT_SCOPE_3D_LIGHTING } from "@/components/scope-3d/engine/scope-3d-stage";
import type {
  Scope3DFrameStats,
  Scope3DViewerHandle,
  Scope3DViewerStatus,
} from "@/components/scope-3d/scope-3d-viewer";

import { LabSegmented } from "./lab-controls";
import {
  ActivityPanel,
  AnimationPanel,
  AutonomyPanel,
  LightingPanel,
  PerformancePanel,
  SecondaryMotionPanel,
  type LabSsaa,
} from "./lab-panels";
import {
  useWebPreview,
  WebPreviewFrame,
  WebPreviewPanel,
} from "./lab-web-preview";

/** studio: big orbitable viewer. preview: Scope at real size inside a simulation of the blog. */
type LabMode = "studio" | "preview";

// WebGL only exists in the browser.
const Scope3DViewer = dynamic(
  () =>
    import("@/components/scope-3d/scope-3d-viewer").then(
      (m) => m.Scope3DViewer,
    ),
  { ssr: false },
);

const MODEL_URL = "/scope-lab/scope.glb";
const POLL_MS = 100;

const DEFAULT_INTERVAL_S = {
  min: DEFAULT_SCOPE_3D_BEHAVIOR.intervalMs.min / 1000,
  max: DEFAULT_SCOPE_3D_BEHAVIOR.intervalMs.max / 1000,
};

const EMPTY_SNAPSHOT: Scope3DDirectorSnapshot = {
  clockMs: 0,
  state: "IDLE",
  autonomous: true,
  nextInMs: null,
  history: [],
  active: [],
  idleWeight: 1,
  paused: false,
  speed: 1,
  log: [],
};

const EMPTY_FRAME: Scope3DFrameStats = {
  fps: 0,
  calls: 0,
  triangles: 0,
  cpuMs: 0,
  quality: { pixelRatio: 1, ssaa: 1 },
  canvasPx: [0, 0],
  internalPx: [0, 0],
  governed: false,
  sleeping: false,
  envelopeMs: 0,
};

/** Scope3DSecondary's defaults: antenna spring and idle life on. */
const DEFAULT_SECONDARY = { spring: true, life: true };

/** Real clip names in the GLB, in its own order, Idle first. */
function readClips(handle: Scope3DViewerHandle) {
  const autonomous = new Set<string>(AUTONOMOUS_BEHAVIORS);
  const names = [IDLE_CLIP, ...handle.animator.clipNames];
  return names.map((name) => ({
    name,
    duration: handle.animator.duration(name),
    // Autonomous clips are "<Behavior>" or "<Behavior>.L/.R"; everything else is click-only.
    clickOnly: name !== IDLE_CLIP && !autonomous.has(name.split(".")[0]),
  }));
}

function Scope3DLab() {
  const handleRef = React.useRef<Scope3DViewerHandle | null>(null);
  const [status, setStatus] = React.useState<Scope3DViewerStatus>({
    phase: "loading",
    loaded: 0,
    total: null,
  });
  const [attempt, setAttempt] = React.useState(0);
  const [clips, setClips] = React.useState<ReturnType<typeof readClips>>([]);
  const [modelStats, setModelStats] = React.useState<
    Scope3DViewerHandle["model"]["stats"] | null
  >(null);
  const [snapshot, setSnapshot] = React.useState(EMPTY_SNAPSHOT);
  const [frame, setFrame] = React.useState(EMPTY_FRAME);
  const [lighting, setLighting] = React.useState(DEFAULT_SCOPE_3D_LIGHTING);
  const [selected, setSelected] = React.useState("LookAround.L");
  const [loop, setLoop] = React.useState(false);
  const [blendMode, setBlendModeState] =
    React.useState<Scope3DBlendMode>("additive");
  const [intervalS, setIntervalS] = React.useState(DEFAULT_INTERVAL_S);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const timers = React.useRef<number[]>([]);
  const [mode, setModeState] = React.useState<LabMode>("studio");
  const [msaa, setMsaa] = React.useState(true);
  const [ssaa, setSsaa] = React.useState<LabSsaa>("auto");
  const [secondary, setSecondaryState] = React.useState(DEFAULT_SECONDARY);
  const setSecondary = (patch: Partial<typeof DEFAULT_SECONDARY>) => {
    const next = { ...secondary, ...patch };
    setSecondaryState(next);
    const layer = handleRef.current?.secondary;
    if (layer) layer.options = { ...layer.options, ...next };
  };
  const preview = useWebPreview();

  // One Scope at a time: leaving Studio unmounts its viewer (and its state
  // machine); the preview iframe then hosts the only instance.
  const setMode = (next: LabMode) => {
    if (next === mode) return;
    handleRef.current = null;
    delete (window as unknown as { __scopeLab?: Scope3DViewerHandle }).__scopeLab;
    setStatus({ phase: "loading", loaded: 0, total: null });
    // The next viewer starts from defaults: mirror them.
    setMsaa(true);
    setSsaa("auto");
    setSecondaryState(DEFAULT_SECONDARY);
    setModeState(next);
  };

  const onReady = React.useCallback((handle: Scope3DViewerHandle) => {
    handleRef.current = handle;
    setClips(readClips(handle));
    setModelStats(handle.model.stats);
    // Dev-only hook for browser automation (Playwright) — this route never ships.
    (window as unknown as { __scopeLab?: Scope3DViewerHandle }).__scopeLab =
      handle;
  }, []);

  // Poll the director instead of re-rendering React every frame.
  React.useEffect(() => {
    if (status.phase !== "ready") return;
    const id = window.setInterval(() => {
      const h = handleRef.current;
      if (!h) return;
      setSnapshot(h.director.snapshot());
      setFrame(h.frame());
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [status.phase]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const director = () => handleRef.current?.director;

  /** Real-time delay that follows the lab's playback speed. */
  const later = (ms: number, fn: () => void) => {
    const speed = handleRef.current?.director.snapshot().speed ?? 1;
    timers.current.push(window.setTimeout(fn, ms / speed));
  };

  const play = (clip: string) => {
    setSelected(clip);
    director()?.playManual(clip, { loop });
  };

  const setBlendMode = (mode: Scope3DBlendMode) => {
    setBlendModeState(mode);
    handleRef.current?.animator.setBlendMode(mode);
  };

  const changeInterval = (next: { min: number; max: number }) => {
    setIntervalS(next);
    director()?.setConfig({
      intervalMs: { min: next.min * 1000, max: next.max * 1000 },
    });
  };

  const setReduced = (on: boolean) => {
    setReducedMotion(on);
    director()?.setConfig({ reducedMotion: on });
  };

  const resetAll = () => {
    if (mode === "preview") return preview.reset();
    const d = director();
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setLighting(DEFAULT_SCOPE_3D_LIGHTING);
    setLoop(false);
    setSelected("LookAround.L");
    setIntervalS(DEFAULT_INTERVAL_S);
    setReducedMotion(false);
    setBlendMode("additive");
    setMsaa(true);
    setSsaa("auto");
    setSecondary(DEFAULT_SECONDARY);
    handleRef.current?.stage.setComposerSamples(4);
    handleRef.current?.stage.resetCamera();
    if (!d) return;
    d.setPaused(false);
    d.setSpeed(1);
    d.returnToIdle();
    d.setConfig({ ...DEFAULT_SCOPE_3D_BEHAVIOR });
    d.setAutonomous(true);
  };

  return (
    <div className="dark bg-background text-foreground flex min-h-dvh flex-col lg:h-dvh lg:flex-row">
      {/* The root layout mounts the 2D companion and the theme toggle on every
          route. Hide both here only: a second Scope on screen would muddy the
          review, and the lab is dark by design. Their code stays untouched. */}
      <style>{`[data-slot="companion-scope"],[data-slot="theme-toggle"]{display:none!important}`}</style>
      <main className="relative h-[62dvh] min-h-80 lg:h-auto lg:flex-1">
        {mode === "preview" ? (
          <WebPreviewFrame
            settings={preview.settings}
            device={preview.device}
            command={preview.command}
            onStatus={preview.setStatus}
          />
        ) : (
          <>
            <Scope3DViewer
              key={attempt}
              modelUrl={MODEL_URL}
              lighting={lighting}
              // The lab's toggle is authoritative here (not the OS setting).
              reducedMotion={reducedMotion}
              ssaa={ssaa === "auto" ? undefined : ssaa}
              onReady={onReady}
              onStatus={setStatus}
            />

            <header className="pointer-events-none absolute top-4 left-4 flex flex-col gap-1 sm:top-6 sm:left-6">
              <h1 className="font-mono text-xs tracking-[0.3em] uppercase">
                Scope 3D · lab
              </h1>
              <p className="text-muted-foreground text-xs">
                Drag to orbit · scroll to zoom · click Scope
              </p>
            </header>

            {status.phase === "loading" && (
              <LoadingOverlay loaded={status.loaded} total={status.total} />
            )}
            {status.phase === "error" && (
              <div
                role="alert"
                className="absolute inset-0 grid place-items-center p-6"
              >
                <div className="border-border bg-card flex max-w-sm flex-col gap-3 rounded-lg border p-5 text-sm">
                  <p className="font-medium">
                    Scope&apos;s model failed to load.
                  </p>
                  <p className="text-muted-foreground font-mono text-xs break-words">
                    {status.message}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setAttempt((a) => a + 1)}
                    className="self-start"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <aside
        aria-label="Lab controls"
        className="border-border bg-card/40 w-full border-t lg:w-[400px] lg:overflow-y-auto lg:border-t-0 lg:border-l"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <LabSegmented
            label="Mode"
            value={mode}
            options={[
              { value: "studio", label: "Studio" },
              { value: "preview", label: "Web Preview" },
            ]}
            onChange={setMode}
          />
          <Button type="button" size="sm" variant="ghost" onClick={resetAll}>
            Reset all
          </Button>
        </div>

        {mode === "preview" ? (
          <WebPreviewPanel preview={preview} />
        ) : (
          <fieldset disabled={status.phase !== "ready"} className="contents">
            <p className="text-muted-foreground px-4 pt-2 font-mono text-[11px]">
              {status.phase === "ready"
                ? `${clips.length} clips · ${blendMode}`
                : status.phase}
            </p>
            <AnimationPanel
              clips={clips}
              selected={selected}
              loop={loop}
              snapshot={snapshot}
              blendMode={blendMode}
              onPlay={play}
              onRestart={() => director()?.restart(selected)}
              onIdle={() => director()?.returnToIdle()}
              onLoop={(on) => {
                setLoop(on);
                if (snapshot.active.some((a) => a.clip === selected))
                  director()?.playManual(selected, { loop: on });
              }}
              onPause={(p) => director()?.setPaused(p)}
              onSpeed={(s) => director()?.setSpeed(s)}
              onSeek={(t) => {
                const focus =
                  snapshot.active.find((a) => a.clip === selected) ??
                  snapshot.active[0];
                if (focus) director()?.seek(focus.clip, t);
              }}
              onBlendMode={setBlendMode}
            />
            <AutonomyPanel
              snapshot={snapshot}
              intervalS={intervalS}
              reducedMotion={reducedMotion}
              onAutonomous={(on) => director()?.setAutonomous(on)}
              onInterval={changeInterval}
              onReducedMotion={setReduced}
              onTriggerNow={() => director()?.triggerAutonomous()}
              onClick={() => director()?.click()}
              onInterruptTest={() => {
                director()?.triggerAutonomous();
                later(650, () => director()?.click());
              }}
              onRapidClicks={() => {
                for (let i = 0; i < 5; i++)
                  later(i * 140, () => director()?.click());
              }}
            />
            <ActivityPanel snapshot={snapshot} />
            <LightingPanel
              lighting={lighting}
              onChange={(patch) => setLighting((l) => ({ ...l, ...patch }))}
              onResetCamera={() => handleRef.current?.stage.resetCamera()}
            />
            <SecondaryMotionPanel
              spring={secondary.spring}
              life={secondary.life}
              onChange={setSecondary}
            />
            <PerformancePanel
              frame={frame}
              model={modelStats}
              msaa={msaa}
              onMsaa={(on) => {
                setMsaa(on);
                handleRef.current?.stage.setComposerSamples(on ? 4 : 0);
              }}
              ssaa={ssaa}
              onSsaa={setSsaa}
            />
          </fieldset>
        )}
      </aside>
    </div>
  );
}

function LoadingOverlay({
  loaded,
  total,
}: {
  loaded: number;
  total: number | null;
}) {
  const mb = (b: number) => (b / 1024 / 1024).toFixed(1);
  return (
    <div role="status" className="absolute inset-0 grid place-items-center">
      <div className="flex w-48 flex-col items-center gap-2 text-xs">
        <span className="text-muted-foreground">Loading Scope…</span>
        <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
          <div
            className="bg-scope-warm h-full transition-[width]"
            style={{ width: total ? `${(loaded / total) * 100}%` : "15%" }}
          />
        </div>
        <span className="text-muted-foreground font-mono tabular-nums">
          {mb(loaded)}
          {total ? ` / ${mb(total)}` : ""} MB
        </span>
      </div>
    </div>
  );
}

export { Scope3DLab };
