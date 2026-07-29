# Motion tokens

The full set lives in `src/lib/motion.ts` (copy from `templates/motion.ts` if
missing). This file explains *why* each value exists so you can pick the
right one instead of guessing.

## Durations

| Token      | Value | Use for |
|------------|-------|---------|
| `instant`  | 0.1s  | Tap/press feedback, color/opacity micro-changes on interactive elements |
| `fast`     | 0.15s | Hover states, tooltips, small icon transitions |
| `base`     | 0.25s | Default — most enter/exit transitions, card reveals, menu open/close |
| `slow`     | 0.4s  | Modals, drawers, larger surfaces entering the viewport |
| `slower`   | 0.6s  | Hero/page-level entrances, large layout moves |

If a motion doesn't obviously map to one of these, it's almost always
`base`. Nothing in this project should animate slower than `slower` (0.6s) —
past that, motion reads as sluggish, not premium.

## Easings

| Token     | Curve                          | Use for |
|-----------|---------------------------------|---------|
| `out`     | `cubic-bezier(0.16, 1, 0.3, 1)` | Default for entrances/exits — fast start, gentle settle. This is the project's signature "premium decelerate" feel. |
| `inOut`   | `cubic-bezier(0.4, 0, 0.2, 1)`  | Toggles, interruptible/looping transitions (e.g. tab indicators, theme switches) where motion starts and ends at rest on both sides |
| `spring`  | `{ type: "spring", stiffness: 420, damping: 32 }` | Interactive, physically-driven motion — drag, button press, layout animations (`layout` prop), anything the user's input should feel connected to |

Rule of thumb: **content appearing/disappearing → `out`. State toggling
back and forth → `inOut`. Something the user is physically pushing →
`spring`.**

Never use `"linear"` — it has no place in UI motion, it reads as
mechanical/broken.

## Distances

| Token | Value | Use for |
|-------|-------|---------|
| `xs`  | 4px   | Icon nudges, tiny inline elements |
| `sm`  | 8px   | Small components (badges, chips, list rows) |
| `md`  | 12px  | Default — cards, sections, most `fadeInUp`/`fadeInDown` usage |
| `lg`  | 24px  | Large surfaces (hero content, full-width sections) |

Never offset more than `lg` (24px). Large translate distances (50px+) are
what make scroll animations feel like a slideshow instead of a reveal —
they're the #1 "distracting" pattern to avoid.

## Example

```tsx
import { motion } from "framer-motion"
import { duration, easing } from "@/lib/motion"

<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: duration.base, ease: easing.out }}
/>
```

In practice, prefer reaching for a named variant (see `variants.md`) over
writing `initial`/`animate`/`transition` inline like this — inline is fine
for a genuine one-off, not for anything reused across components.
