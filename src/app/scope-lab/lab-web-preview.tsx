"use client";

// Web Preview mode of /scope-lab: the site simulation (/scope-lab/preview) in
// an iframe sized like a real desktop or phone viewport, plus its controls.
// The iframe document owns the only Scope 3D instance while this mode is on.

import * as React from "react";

import { Button } from "@/components/ui/button";

import { LabSection, LabSegmented, LabStats, LabToggle } from "./lab-controls";
import {
  DEFAULT_PREVIEW_SETTINGS,
  PREVIEW_PIXEL_RATIOS,
  PREVIEW_SIZES,
  PREVIEW_SSAA,
  PRODUCTION_SLOTS,
  settingsToQuery,
  type LabToPreview,
  type PreviewSettings,
  type PreviewStatus,
  type PreviewToLab,
} from "./preview-protocol";

export type PreviewDevice = "desktop" | "mobile";

/** iPhone 12–15 class viewport, the most common phone width in CSS px. */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

type PreviewCommand = { type: "click" | "trigger"; id: number };

interface WebPreview {
  settings: PreviewSettings;
  device: PreviewDevice;
  status: PreviewStatus | null;
  /** Last one-shot command for the preview (a new id re-sends it). */
  command: PreviewCommand | null;
  update: (patch: Partial<PreviewSettings>) => void;
  setDevice: (device: PreviewDevice) => void;
  setStatus: (status: PreviewStatus) => void;
  send: (type: PreviewCommand["type"]) => void;
  reset: () => void;
}

/** Web Preview state. Messaging lives in WebPreviewFrame, which owns the iframe. */
function useWebPreview(): WebPreview {
  const [settings, setSettings] = React.useState(DEFAULT_PREVIEW_SETTINGS);
  const [device, setDevice] = React.useState<PreviewDevice>("desktop");
  const [status, setStatus] = React.useState<PreviewStatus | null>(null);
  const [command, setCommand] = React.useState<PreviewCommand | null>(null);
  return {
    settings,
    device,
    status,
    command,
    update: (patch) => setSettings((s) => ({ ...s, ...patch })),
    setDevice,
    setStatus,
    send: (type) => setCommand((c) => ({ type, id: (c?.id ?? 0) + 1 })),
    reset: () => {
      setSettings(DEFAULT_PREVIEW_SETTINGS);
      setDevice("desktop");
    },
  };
}

interface WebPreviewFrameProps {
  settings: PreviewSettings;
  device: PreviewDevice;
  command: PreviewCommand | null;
  onStatus: (status: PreviewStatus) => void;
}

function WebPreviewFrame({
  settings,
  device,
  command,
  onStatus,
}: WebPreviewFrameProps) {
  const iframe = React.useRef<HTMLIFrameElement>(null);
  // The src is fixed at mount: later changes travel over postMessage, so
  // resizing Scope never reloads the GLB.
  const [src] = React.useState(
    () => `/scope-lab/preview?${settingsToQuery(settings)}`,
  );

  const post = React.useCallback((message: LabToPreview) => {
    iframe.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  React.useEffect(() => {
    post({ source: "scope-lab", type: "settings", settings });
  }, [settings, post]);

  React.useEffect(() => {
    if (command) post({ source: "scope-lab", type: command.type });
  }, [command, post]);

  React.useEffect(() => {
    const onMessage = (e: MessageEvent<PreviewToLab>) => {
      if (
        e.origin !== window.location.origin ||
        e.data?.source !== "scope-preview"
      )
        return;
      onStatus(e.data.status);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onStatus]);

  const mobile = device === "mobile";
  return (
    <div
      className={
        mobile
          ? "flex size-full items-start justify-center overflow-auto p-4 sm:p-6"
          : "size-full"
      }
    >
      <iframe
        ref={iframe}
        src={src}
        // Settings changed while the document was loading: resend them.
        onLoad={() => post({ source: "scope-lab", type: "settings", settings })}
        title="Scope 3D web preview"
        className={
          mobile
            ? "border-border shrink-0 rounded-[2rem] border-4"
            : "block size-full"
        }
        style={
          mobile
            ? {
                width: MOBILE_VIEWPORT.width + 8,
                height: MOBILE_VIEWPORT.height + 8,
              }
            : undefined
        }
      />
    </div>
  );
}

function WebPreviewPanel({ preview }: { preview: WebPreview }) {
  const { settings, update, status } = preview;
  return (
    <>
      <LabSection title="Scope at web size">
        <div
          role="radiogroup"
          aria-label="Container size"
          className="grid grid-cols-5 gap-1.5"
        >
          {PREVIEW_SIZES.map((size) => (
            <Button
              key={size}
              type="button"
              size="sm"
              role="radio"
              aria-checked={settings.size === size}
              variant={settings.size === size ? "default" : "outline"}
              onClick={() => update({ size })}
              className="font-mono text-[11px]"
            >
              {size}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-[11px]">
          CSS px of Scope&apos;s square container. Today&apos;s 2D slot —{" "}
          {PRODUCTION_SLOTS[settings.scene]}.
        </p>
        <LabSegmented
          label="Context"
          value={settings.scene}
          options={[
            { value: "hero", label: "Hero" },
            { value: "about", label: "About (beside text)" },
          ]}
          onChange={(scene) => update({ scene })}
        />
        <LabSegmented
          label="Device"
          value={preview.device}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "mobile", label: "Mobile 390" },
          ]}
          onChange={preview.setDevice}
        />
        <LabSegmented
          label="Theme"
          value={settings.theme}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
          onChange={(theme) => update({ theme })}
        />
      </LabSection>

      <LabSection title="Behaviour">
        <LabToggle
          label="Autonomous behaviours"
          checked={settings.autonomous}
          onChange={(autonomous) => update({ autonomous })}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => preview.send("trigger")}
          >
            Trigger next now
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => preview.send("click")}
          >
            Simulate click
          </Button>
        </div>
        <p className="text-muted-foreground text-[11px]">
          Or click Scope itself in the preview: Stretch → Laugh.
        </p>
      </LabSection>

      <LabSection title="Sharpness">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground min-w-16">Pixel ratio</span>
          <div
            role="radiogroup"
            aria-label="Pixel ratio"
            className="flex flex-wrap gap-1"
          >
            {PREVIEW_PIXEL_RATIOS.map((r) => (
              <Button
                key={r}
                type="button"
                size="xs"
                role="radio"
                aria-checked={settings.pixelRatio === r}
                variant={settings.pixelRatio === r ? "default" : "outline"}
                onClick={() => update({ pixelRatio: r })}
                className="font-mono"
              >
                {r === "auto" ? "device" : `${r}×`}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground min-w-16">Supersample</span>
          <div
            role="radiogroup"
            aria-label="Supersampling"
            className="flex flex-wrap gap-1"
          >
            {PREVIEW_SSAA.map((s) => (
              <Button
                key={s}
                type="button"
                size="xs"
                role="radio"
                aria-checked={settings.ssaa === s}
                variant={settings.ssaa === s ? "default" : "outline"}
                onClick={() => update({ ssaa: s })}
                className="font-mono"
              >
                {s === "auto" ? "auto" : `${s}×`}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground text-[11px]">
          1× = the previous renderer (MSAA only, resolved before tone mapping).
          Auto renders at up to 3× and resolves after tone mapping.
        </p>
        <LabToggle
          label="Eye halo (bloom)"
          checked={settings.halo}
          onChange={(halo) => update({ halo })}
        />
        <LabToggle
          label="Pixel loupe"
          hint="Magnifies the canvas centre without smoothing."
          checked={settings.loupe}
          onChange={(loupe) => update({ loupe })}
        />
      </LabSection>

      <LabSection title="Preview status">
        <LabStats
          rows={[
            ["State", status?.state ?? "—"],
            [
              "Next behaviour",
              status?.nextInMs == null
                ? "—"
                : `${(status.nextInMs / 1000).toFixed(1)} s`,
            ],
            ["FPS", status ? status.fps.toFixed(0) : "—"],
            ["Device pixel ratio", status ? status.devicePixelRatio : "—"],
            ["Canvas pixel ratio", status ? status.pixelRatio : "—"],
            [
              "Canvas → internal px",
              status
                ? `${status.canvasPx[0]}×${status.canvasPx[1]} · ${status.ssaa}× → ${status.internalPx[0]}×${status.internalPx[1]}${status.governed ? " (governed)" : ""}`
                : "—",
            ],
            ["Main thread / frame", status ? `${status.cpuMs.toFixed(2)} ms` : "—"],
          ]}
        />
        {status?.error && (
          <p className="text-destructive text-xs">{status.error}</p>
        )}
        <ol className="text-muted-foreground flex flex-col gap-0.5 font-mono text-[10px]">
          {status?.log.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ol>
        <a
          href={`/scope-lab/preview?${settingsToQuery(settings)}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline underline-offset-4"
        >
          Open this preview on its own (full window, or on a phone)
        </a>
      </LabSection>
    </>
  );
}

export { useWebPreview, WebPreviewFrame, WebPreviewPanel };
