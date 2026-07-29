---
name: motion
description: Author, review, or fix any Framer Motion animation in this project — transitions, hover/tap states, scroll reveals, page/layout transitions, or `motion.*` components. Also use to audit existing animations for inconsistent durations/easings, missing reduced-motion support, or distracting motion.
---

`motion` is the single source of truth for animation in this project. Every
`motion.*` usage, transition, and variant should trace back to the tokens and
patterns here — not to numbers invented on the spot.

## The rule in one sentence

Motion should feel inevitable, not decorative: short, purposeful, built from
the shared tokens below, and silent for anyone who asked for less of it.

## Before writing any animation

1. Read `reference/tokens.md` — the only durations/easings allowed.
2. Read `reference/variants.md` — reuse an existing variant before writing a new one.
3. If `src/lib/motion.ts` doesn't exist yet, copy it from `templates/motion.ts` (tokens live here once, project-wide — don't recreate them per component).
4. If `src/lib/motion-variants.ts` doesn't exist yet, copy it from `templates/variants.ts`.
5. Never ship motion without reduced-motion handling — see `reference/accessibility.md`. If `src/components/motion-provider.tsx` doesn't exist, copy it from `templates/motion-provider.tsx` and mount it once in `src/app/layout.tsx` around `{children}`.

## Before reviewing / auditing existing animations

Read `reference/checklist.md` and walk the diff (or the file in question)
against it. Report findings the same way `/code-review` does: file, line,
what's wrong, the fix.

## Golden rules

- **Animate `transform` and `opacity` only.** Never animate `width`,
  `height`, `top`, `left`, or `box-shadow` directly — they trigger
  layout/paint and cause jank. Use `scale`/`x`/`y` and let CSS handle layout.
- **Subtle over showy.** Offsets of 4–16px, opacity fades, scale in the
  0.95–1 range. If an animation draws attention to itself instead of the
  content, it's too much.
- **One motion language.** Pull durations and easings from `src/lib/motion.ts`
  (see `templates/motion.ts`). A hardcoded `duration: 0.37` or
  `ease: "linear"` in a component is a bug, not a style choice.
- **Respect `prefers-reduced-motion`.** Every animated surface must degrade
  to an instant (or near-instant) state for users who've asked for less
  motion. Wrap the app in the `MotionProvider` from
  `templates/motion-provider.tsx` — don't hand-roll `useReducedMotion()`
  checks per component.
- **Variants over inline objects.** Define `initial`/`animate`/`exit` as a
  named variant (from `src/lib/motion-variants.ts`, or colocated
  `const variants =` for something truly one-off) and reference it by name.
  Inline animation objects duplicate silently and drift out of sync.
- **Scroll reveals fire once.** Any `whileInView` animation must set
  `viewport={{ once: true }}` — replaying an entrance every time an element
  scrolls into view is the single most common "distracting" complaint.
- **Stagger sparingly.** Use `staggerContainer`/`staggerItem` from
  `src/lib/motion-variants.ts` for lists; cap `staggerChildren` at
  ~0.05–0.08s and don't stagger more than ~8 visible items — beyond that it
  reads as lag, not polish.
- **Import from `"framer-motion"`.** That's the package in this project's
  `package.json` (v12) — don't switch to the `"motion"` package alias.

## Reference (read on demand)

- `reference/tokens.md` — durations, easings, distances, and when to use which
- `reference/variants.md` — the reusable variant catalog with usage examples
- `reference/accessibility.md` — reduced-motion patterns and how to test them
- `reference/checklist.md` — inconsistency/review checklist

## Templates (copy into the project on first use, then edit in place)

- `templates/motion.ts` → `src/lib/motion.ts` — duration/easing/distance tokens
- `templates/variants.ts` → `src/lib/motion-variants.ts` — reusable variants built on the tokens
- `templates/motion-provider.tsx` → `src/components/motion-provider.tsx` — app-wide `MotionConfig` with reduced-motion handling, mounted once in `src/app/layout.tsx`
