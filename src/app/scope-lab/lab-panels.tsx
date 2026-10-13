"use client";

// Presentational panels for /scope-lab. They read a polled snapshot and call
// back into the director; none of them hold animation state of their own.

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  Scope3DActiveClip,
  Scope3DBlendMode,
} from "@/components/scope-3d/engine/scope-3d-animator";
import type { Scope3DDirectorSnapshot } from "@/components/scope-3d/engine/scope-3d-director";
import type { Scope3DModel } from "@/components/scope-3d/engine/scope-3d-model";
import type { Scope3DLighting } from "@/components/scope-3d/engine/scope-3d-stage";
import type { Scope3DFrameStats } from "@/components/scope-3d/scope-3d-viewer";
import clipsMeta from "../../../assets/scope-3d/exports/scope-clips.json";

import {
  LabSection,
  LabSegmented,
  LabSlider,
  LabStats,
  LabToggle,
} from "./lab-controls";

const MARKERS = clipsMeta.clips as Record<
  string,
  { duration: number; markers: Record<string, number> }
>;

const seconds = (s: number) => `${s.toFixed(2)} s`;

// ---------------------------------------------------------------- animations

interface AnimationPanelProps {
  clips: readonly { name: string; duration: number; clickOnly: boolean }[];
  selected: string;
  loop: boolean;
  snapshot: Scope3DDirectorSnapshot;
  blendMode: Scope3DBlendMode;
  onPlay: (clip: string) => void;
  onRestart: () => void;
  onIdle: () => void;
  onLoop: (loop: boolean) => void;
  onPause: (paused: boolean) => void;
  onSpeed: (speed: number) => void;
  onSeek: (time: number) => void;
  onBlendMode: (mode: Scope3DBlendMode) => void;
}

function AnimationPanel({
  clips,
  selected,
  loop,
  snapshot,
  blendMode,
  onPlay,
  onRestart,
  onIdle,
  onLoop,
  onPause,
  onSpeed,
  onSeek,
  onBlendMode,
}: AnimationPanelProps) {
  const focus =
    snapshot.active.find((a) => a.clip === selected) ??
    snapshot.active[0] ??
    null;

  return (
    <LabSection title="Animations (clips read from the GLB)">
      <div className="grid grid-cols-2 gap-1.5">
        {clips.map((c) => {
          const playing = snapshot.active.some((a) => a.clip === c.name);
          return (
            <Button
              key={c.name}
              type="button"
              size="sm"
              variant={playing ? "default" : "outline"}
              aria-pressed={selected === c.name}
              onClick={() => onPlay(c.name)}
              className="justify-between font-mono text-[11px]"
            >
              <span className="truncate">{c.name}</span>
              <span className="text-[10px] opacity-60">
                {c.clickOnly ? "click " : ""}
                {c.duration.toFixed(1)}s
              </span>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPlay(selected)}
        >
          Play
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPause(!snapshot.paused)}
        >
          {snapshot.paused ? "Resume" : "Pause"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRestart}
          disabled={!focus}
        >
          Restart
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onIdle}>
          Back to Idle
        </Button>
      </div>

      <LabToggle
        label="Loop the selected clip"
        checked={loop}
        onChange={onLoop}
      />
      <LabSlider
        label="Playback speed (whole clock: clips + timers)"
        value={snapshot.speed}
        min={0.1}
        max={2}
        step={0.05}
        format={(v) => `×${v.toFixed(2)}`}
        onChange={onSpeed}
      />
      <LabSegmented
        label="Blending"
        value={blendMode}
        options={[
          { value: "additive", label: "Additive over Idle" },
          { value: "replace", label: "Replace Idle" },
        ]}
        onChange={onBlendMode}
      />

      <Timeline active={focus} paused={snapshot.paused} onSeek={onSeek} />
    </LabSection>
  );
}

function Timeline({
  active,
  paused,
  onSeek,
}: {
  active: Scope3DActiveClip | null;
  paused: boolean;
  onSeek: (time: number) => void;
}) {
  if (!active) {
    return (
      <p className="text-muted-foreground text-xs">
        Idle only. Play a clip to see its timeline. Pause to scrub frame by
        frame.
      </p>
    );
  }
  const markers = Object.entries(MARKERS[active.clip]?.markers ?? {}).filter(
    ([, t]) => t > 0 && t < active.duration,
  );
  const progress = Math.min(active.time / active.duration, 1);
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex justify-between font-mono">
        <span>{active.clip}</span>
        <span className="tabular-nums">
          {seconds(active.time)} / {seconds(active.duration)}
        </span>
      </div>
      <div className="bg-muted relative h-6 overflow-hidden rounded">
        <div
          className="bg-scope-warm/30 absolute inset-y-0 left-0"
          style={{ width: `${progress * 100}%` }}
        />
        {markers.map(([name, t]) => (
          <span
            key={name}
            title={`${name} · ${t}s`}
            className="bg-foreground/50 absolute inset-y-0 w-px"
            style={{ left: `${(t / active.duration) * 100}%` }}
          />
        ))}
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-2 font-mono text-[10px]">
        {markers.map(([name, t]) => (
          <span key={name}>
            {t.toFixed(2)} {name}
          </span>
        ))}
      </div>
      {paused && (
        <LabSlider
          label="Scrub (paused)"
          value={active.time}
          min={0}
          max={active.duration}
          step={1 / 60}
          format={seconds}
          onChange={onSeek}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- autonomy

interface AutonomyPanelProps {
  snapshot: Scope3DDirectorSnapshot;
  intervalS: { min: number; max: number };
  reducedMotion: boolean;
  onAutonomous: (on: boolean) => void;
  onInterval: (interval: { min: number; max: number }) => void;
  onReducedMotion: (on: boolean) => void;
  onTriggerNow: () => void;
  onClick: () => void;
  onInterruptTest: () => void;
  onRapidClicks: () => void;
}

function AutonomyPanel({
  snapshot,
  intervalS,
  reducedMotion,
  onAutonomous,
  onInterval,
  onReducedMotion,
  onTriggerNow,
  onClick,
  onInterruptTest,
  onRapidClicks,
}: AutonomyPanelProps) {
  return (
    <LabSection title="Personality (state machine)">
      <LabToggle
        label="Autonomous behaviours"
        hint="Playing a clip by hand switches this off."
        checked={snapshot.autonomous}
        onChange={onAutonomous}
      />
      <LabSlider
        label="Min wait"
        value={intervalS.min}
        min={1}
        max={40}
        step={1}
        format={(v) => `${v} s`}
        onChange={(min) =>
          onInterval({ min, max: Math.max(min, intervalS.max) })
        }
      />
      <LabSlider
        label="Max wait"
        value={intervalS.max}
        min={1}
        max={40}
        step={1}
        format={(v) => `${v} s`}
        onChange={(max) =>
          onInterval({ min: Math.min(max, intervalS.min), max })
        }
      />
      <LabToggle
        label="Simulate prefers-reduced-motion"
        hint="Only blinks; a click answers with a blink."
        checked={reducedMotion}
        onChange={onReducedMotion}
      />
      <LabStats
        rows={[
          ["State", <StateBadge key="s" state={snapshot.state} />],
          [
            "Next behaviour",
            snapshot.nextInMs === null
              ? "—"
              : seconds(snapshot.nextInMs / 1000),
          ],
          ["Clock", seconds(snapshot.clockMs / 1000)],
        ]}
      />
      <div className="flex flex-wrap gap-1.5">
        {snapshot.history.length === 0 && (
          <span className="text-muted-foreground text-xs">
            No autonomous behaviour yet.
          </span>
        )}
        {snapshot.history.map((b, i) => (
          <Badge
            key={`${i}-${b}`}
            variant="outline"
            className="font-mono text-[10px]"
          >
            {b}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onTriggerNow}
        >
          Trigger next now
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClick}>
          Simulate click
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onInterruptTest}
        >
          Test: autonomous → click
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRapidClicks}
        >
          Test: 5 rapid clicks
        </Button>
      </div>
    </LabSection>
  );
}

function StateBadge({ state }: { state: Scope3DDirectorSnapshot["state"] }) {
  return (
    <span
      className={state === "IDLE" ? "text-muted-foreground" : "text-scope-warm"}
    >
      {state}
    </span>
  );
}

function ActivityPanel({ snapshot }: { snapshot: Scope3DDirectorSnapshot }) {
  return (
    <LabSection title="Live mixer + command log">
      <ul className="flex flex-col gap-1 font-mono text-[11px]">
        <li className="flex items-center gap-2">
          <span className="w-28 truncate">Idle (base)</span>
          <WeightBar weight={snapshot.idleWeight} />
        </li>
        {snapshot.active.map((a) => (
          <li key={a.clip} className="flex items-center gap-2">
            <span className="w-28 truncate">{a.clip}</span>
            <WeightBar weight={a.weight} />
            <span className="text-muted-foreground tabular-nums">
              ×{a.timeScale.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <ol className="text-muted-foreground flex max-h-40 flex-col gap-0.5 overflow-y-auto font-mono text-[10px]">
        {snapshot.log.map((e, i) => (
          <li key={`${e.at}-${i}`}>
            <span className="tabular-nums">
              {(e.at / 1000).toFixed(2).padStart(7)}s
            </span>{" "}
            {e.text}
          </li>
        ))}
      </ol>
    </LabSection>
  );
}

function WeightBar({ weight }: { weight: number }) {
  return (
    <span
      className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full"
      aria-label={`weight ${weight.toFixed(2)}`}
    >
      <span
        className="bg-scope-warm absolute inset-y-0 left-0"
        style={{ width: `${Math.min(weight, 1.2) * 83}%` }}
      />
    </span>
  );
}

// ---------------------------------------------------------------- look

interface LightingPanelProps {
  lighting: Scope3DLighting;
  onChange: (patch: Partial<Scope3DLighting>) => void;
  onResetCamera: () => void;
}

function LightingPanel({
  lighting,
  onChange,
  onResetCamera,
}: LightingPanelProps) {
  return (
    <LabSection title="Lighting + look">
      <LabSegmented
        label="Light rig"
        value={lighting.rig}
        options={[
          { value: "warm", label: "Warm (sheet)" },
          { value: "cool", label: "Cool" },
        ]}
        onChange={(rig) => onChange({ rig })}
      />
      <LabSegmented
        label="Backdrop"
        value={lighting.backdrop}
        options={[
          { value: "sheet", label: "Sheet navy" },
          { value: "site", label: "Site dark" },
        ]}
        onChange={(backdrop) => onChange({ backdrop })}
      />
      <LabSlider
        label="Exposure"
        value={lighting.exposure}
        min={0.3}
        max={2}
        step={0.05}
        onChange={(exposure) => onChange({ exposure })}
      />
      <LabSlider
        label="Key light"
        value={lighting.key}
        min={0}
        max={6}
        step={0.1}
        onChange={(key) => onChange({ key })}
      />
      <LabSlider
        label="Fill light"
        value={lighting.fill}
        min={0}
        max={4}
        step={0.1}
        onChange={(fill) => onChange({ fill })}
      />
      <LabSlider
        label="Rim light"
        value={lighting.rim}
        min={0}
        max={6}
        step={0.1}
        onChange={(rim) => onChange({ rim })}
      />
      <LabSlider
        label="Top light"
        value={lighting.top}
        min={0}
        max={4}
        step={0.1}
        onChange={(top) => onChange({ top })}
      />
      <LabSlider
        label="Environment reflections"
        value={lighting.environment}
        min={0}
        max={1.5}
        step={0.05}
        onChange={(environment) => onChange({ environment })}
      />
      <LabToggle
        label="Soft shadows"
        checked={lighting.shadows}
        onChange={(shadows) => onChange({ shadows })}
      />
      <LabToggle
        label="Eye bloom"
        checked={lighting.bloom}
        onChange={(bloom) => onChange({ bloom })}
      />
      {lighting.bloom && (
        <LabSlider
          label="Bloom strength"
          value={lighting.bloomStrength}
          min={0}
          max={1.5}
          step={0.05}
          onChange={(bloomStrength) => onChange({ bloomStrength })}
        />
      )}
      <LabToggle
        label="Mineral grain (procedural)"
        hint="Approximates the Blender ceramic; the GLB only carries the flat beige."
        checked={lighting.grain}
        onChange={(grain) => onChange({ grain })}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onResetCamera}
        className="self-start"
      >
        Reset camera (hero angle)
      </Button>
    </LabSection>
  );
}

// ---------------------------------------------------------------- performance

export type LabSsaa = "auto" | 1 | 2 | 3;

interface PerformancePanelProps {
  frame: Scope3DFrameStats;
  model: Scope3DModel["stats"] | null;
  msaa: boolean;
  onMsaa: (on: boolean) => void;
  ssaa: LabSsaa;
  onSsaa: (ssaa: LabSsaa) => void;
}

const SSAA_OPTIONS: readonly LabSsaa[] = ["auto", 1, 2, 3];

/** Rendering resolution as one line: "160×160 canvas · 3× → 480×480". */
function formatResolution(frame: Scope3DFrameStats) {
  const [cw, ch] = frame.canvasPx;
  const [iw, ih] = frame.internalPx;
  return `${cw}×${ch} · ${frame.quality.ssaa}× → ${iw}×${ih}${frame.governed ? " (governed)" : ""}`;
}

function PerformancePanel({
  frame,
  model,
  msaa,
  onMsaa,
  ssaa,
  onSsaa,
}: PerformancePanelProps) {
  return (
    <LabSection title="Performance">
      <LabSegmented
        label="Supersampling"
        value={String(ssaa)}
        options={SSAA_OPTIONS.map((s) => ({
          value: String(s),
          label: s === "auto" ? "auto" : `${s}×`,
        }))}
        onChange={(v) => onSsaa(v === "auto" ? "auto" : (Number(v) as LabSsaa))}
      />
      <p className="text-muted-foreground text-[11px]">
        Renders at N× and resolves after tone mapping. 1× = the previous
        renderer (MSAA only). Auto follows the resolution policy and the FPS
        governor.
      </p>
      <LabToggle
        label="MSAA ×4 on the scene target"
        hint="Off reproduces the first lab build: no anti-aliasing at all on the composer's targets."
        checked={msaa}
        onChange={onMsaa}
      />
      <LabStats
        rows={[
          ["FPS (approx.)", frame.fps.toFixed(0)],
          ["Main thread / frame", `${frame.cpuMs.toFixed(2)} ms`],
          ["Canvas → internal px", formatResolution(frame)],
          ["Draw calls / frame", frame.calls],
          ["Triangles / frame", frame.triangles.toLocaleString("en")],
          [
            "Model triangles",
            model ? model.triangles.toLocaleString("en") : "—",
          ],
          ["Model vertices", model ? model.vertices.toLocaleString("en") : "—"],
          [
            "Joints / morph targets",
            model ? `${model.joints} / ${model.morphTargets.join(", ")}` : "—",
          ],
          [
            "GLB size",
            model ? `${(model.bytes / 1024 / 1024).toFixed(2)} MB` : "—",
          ],
          ["GLB download", model ? `${model.fetchMs.toFixed(0)} ms` : "—"],
          ["GLB parse", model ? `${model.parseMs.toFixed(0)} ms` : "—"],
        ]}
      />
      <p className="text-muted-foreground text-[11px]">
        Frame counts include shadow and bloom passes. The model is not optimised
        yet (no Draco/meshopt, no retopology).
      </p>
    </LabSection>
  );
}

// ----------------------------------------------------------- secondary motion

interface SecondaryMotionPanelProps {
  spring: boolean;
  life: boolean;
  onChange: (patch: { spring?: boolean; life?: boolean }) => void;
}

function SecondaryMotionPanel({
  spring,
  life,
  onChange,
}: SecondaryMotionPanelProps) {
  return (
    <LabSection title="Secondary motion">
      <LabToggle
        label="Antenna spring (runtime)"
        hint="Follow-through simulated from the body's real motion, across clips and interruptions."
        checked={spring}
        onChange={(on) => onChange({ spring: on })}
      />
      <LabToggle
        label="Idle life"
        hint="Very slow posture drift + single soft blinks every 3.6–8.5 s; steps back while a clip plays."
        checked={life}
        onChange={(on) => onChange({ life: on })}
      />
    </LabSection>
  );
}

export {
  ActivityPanel,
  AnimationPanel,
  AutonomyPanel,
  LightingPanel,
  PerformancePanel,
  SecondaryMotionPanel,
};
