"use client";

// Small form primitives for the /scope-lab panel. Native inputs on purpose:
// they're accessible by default and this is a dev tool, not product UI.

import * as React from "react";

import { cn } from "@/lib/utils";

function LabSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border flex flex-col gap-3 border-b px-4 py-4",
        className,
      )}
    >
      <h2 className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function LabSlider({
  label,
  value,
  min,
  max,
  step,
  format = (v) => v.toFixed(2),
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const id = React.useId();
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
      <label htmlFor={id} className="text-muted-foreground">
        {label}
      </label>
      <output htmlFor={id} className="font-mono tabular-nums">
        {format(value)}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-scope-warm col-span-2 h-4 w-full cursor-pointer"
      />
    </div>
  );
}

function LabToggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-scope-warm mt-0.5 size-3.5 cursor-pointer"
      />
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function LabSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-2 text-xs"
    >
      <span className="text-muted-foreground min-w-16">{label}</span>
      <div className="border-border flex rounded-md border p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[5px] px-2 py-1 transition-colors",
              value === o.value
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LabStats({ rows }: { rows: readonly [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right tabular-nums">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export { LabSection, LabSegmented, LabSlider, LabStats, LabToggle };
