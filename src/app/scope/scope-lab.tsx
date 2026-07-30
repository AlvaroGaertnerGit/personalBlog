"use client";

import * as React from "react";

import { Scope } from "@/components/scope/scope";
import { SCOPE_HAPPY_HOLD_MS, SCOPE_MOODS } from "@/components/scope/scope-motion";
import type { ScopeMood } from "@/components/scope/scope.types";
import { Button } from "@/components/ui/button";

const MOODS: ScopeMood[] = ["idle", "curious", "thinking", "observe", "happy"];

const MOOD_LABEL: Record<ScopeMood, string> = {
  idle: "Idle",
  curious: "Curious",
  thinking: "Thinking",
  observe: "Observe",
  happy: "Happy",
};

const KEY_TO_MOOD: Record<string, ScopeMood> = {
  "1": "idle",
  "2": "curious",
  "3": "thinking",
  "4": "observe",
  "5": "happy",
};

function ScopeLab() {
  const [mood, setMood] = React.useState<ScopeMood>("idle");

  // Happy is the one mood that resolves itself back to idle — the page
  // owns mood state, so the page is what schedules the return. Scope
  // itself stays a pure function of `mood`, no callback prop needed.
  React.useEffect(() => {
    if (mood !== "happy") return;
    const id = window.setTimeout(() => setMood("idle"), SCOPE_HAPPY_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [mood]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const next = KEY_TO_MOOD[event.key];
      if (next) setMood(next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const spec = SCOPE_MOODS[mood];

  return (
    <div className="dark bg-background text-foreground flex min-h-dvh flex-col items-center justify-center gap-16 p-8">
      <Scope mood={mood} className="size-56 sm:size-64" />

      <div className="flex flex-wrap items-center justify-center gap-3">
        {MOODS.map((m, i) => (
          <Button
            key={m}
            type="button"
            variant={mood === m ? "default" : "outline"}
            onClick={() => setMood(m)}
            aria-pressed={mood === m}
          >
            {MOOD_LABEL[m]}
            <span className="text-muted-foreground font-mono" data-icon="inline-end">
              {i + 1}
            </span>
          </Button>
        ))}
      </div>

      {/* Debug panel — dev only, same as the rest of this route. */}
      <dl className="border-border bg-card/80 fixed right-6 bottom-6 grid w-56 grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border p-4 font-mono text-xs backdrop-blur-sm">
        <dt className="text-muted-foreground col-span-2 mb-1 tracking-wide uppercase">
          Scope debug
        </dt>
        <dt className="text-muted-foreground">Mood</dt>
        <dd>{mood}</dd>
        <dt className="text-muted-foreground">Animation</dt>
        <dd>{spec.animationName}</dd>
        <dt className="text-muted-foreground">Scale</dt>
        <dd>{spec.scale.toFixed(2)}</dd>
        <dt className="text-muted-foreground">Rotation</dt>
        <dd>{spec.rotate}°</dd>
        <dt className="text-muted-foreground">Y offset</dt>
        <dd>{spec.y}px</dd>
        <dt className="text-muted-foreground">Glow</dt>
        <dd>{spec.glow.toFixed(2)}</dd>
        <dt className="text-muted-foreground">Eye scale</dt>
        <dd>{spec.eyeScaleY.toFixed(2)}</dd>
      </dl>
    </div>
  );
}

export { ScopeLab };
