# Project Context

This is the entry point for any future development session on this portfolio — human or AI. Read this before touching code. It explains what exists, and just as importantly, *why* it exists in this shape and not another. Update it whenever an architectural decision changes; treat staleness here as a bug.

---

## 1. Project Vision

This is not a traditional developer portfolio — not a résumé with a hero image, a project grid, and a contact form.

The objective is to build a handcrafted interactive experience. A visitor should leave remembering how the site made them *feel*, not a list of the technologies it was built with. The technology is a means; the feeling is the product.

The person behind this site teaches Software Development to vocational students and builds the tools he teaches with (this site, and Tournamently, a padel tournament platform). The portfolio's job is to demonstrate the same craftsmanship and AI-native workflow he teaches — the site itself is evidence, not just a description, of that practice.

---

## 2. Design Philosophy

Every animation, every unit of spacing, every interaction and transition should feel intentional. Nothing ships because a component "felt static" or because a slot for animation existed. If a design choice can't be justified, it doesn't belong.

Inspirations: Apple, Linear, Raycast, Vercel. But the goal is not to imitate any of them — it's to reach the same *category* of quality they represent: restrained, considered, unmistakably deliberate. The goal is timeless product design, not a trend snapshot of "AI product aesthetics, 2026."

Concretely, this shows up as:

- **Premium** — materials (color, blur, shadow) are used sparingly and mean something when they appear.
- **Minimal** — the absence of a thing is usually correct until proven otherwise.
- **Fast** — motion and interaction never cost perceived performance.
- **Elegant** — solutions are simple before they are clever.
- **Intentional** — every decision traces back to a reason, not a default.

---

## 3. Current Architecture

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4, with Framer Motion for animation and `next-themes` for light/dark. shadcn/`@base-ui/react` provides primitive building blocks.

### Folder map

```
src/
  app/                  Routes. page.tsx is the home page. scope/ is a
                         standalone debug route (see below). api/contact/
                         is the project's first Route Handler (SPR-009,
                         §10) — thin: validates via schemas/contact.ts, then
                         delegates to lib/email/resend.ts. Never imports the
                         Resend SDK or a raw email/HTML shape directly.
  components/
    hero/               Hero primitives (Hero, HeroContent, HeroMedia, ...).
    layout/             Structural, content-agnostic: Background, Container,
                         Section. No visual opinions beyond spacing/structure.
    motion/              Reusable motion wrappers: Reveal (scroll-in), Stagger.
    scope/               Scope the character itself — the <Scope> SVG
                         component, its motion vocabulary, and three
                         independent physics hooks (mood animation, cursor
                         presence, autonomous idle personality).
                         scope-geometry.ts (SPR-010) holds every shape/path
                         constant with no "use client" directive, so it's
                         safely importable anywhere; scope.tsx and
                         scope-static.tsx (a motion-free renderer for
                         contexts where "use client" categorically cannot
                         run, e.g. email) both build from these same
                         numbers — one authored drawing, two renderers.
    scope/personality/   The Personality System: why/when Scope does small,
                         unprompted things while idle (see §4).
    scope/companion/     The companion system: how the one shared Scope
                         instance decides where to be and travels there.
                         Also owns the one-time Hero greeting (see §4, §5).
    sections/            Page-level section components (e.g. the companion
                         demo section).
    theme/               Light/dark ("atmosphere") provider, toggle, and the
                         view-transition-driven switch animation.
    ui/                  Low-level shadcn-style primitives (Button, etc.).
  hooks/                 Cross-cutting hooks (reduced-motion, mount-gating,
                         parallax) shared by multiple components.
  lib/motion/            The motion token system — durations, easings,
                         springs, transitions, variants, viewport, distances.
                         One small file per token family, barreled by index.ts.
  lib/utils.ts            `cn()` and other small shared utilities.
  lib/email/resend.tsx    The one abstraction boundary around the Resend
                         SDK (SPR-009.2) — exports `sendContactEmail()`
                         (internal notification) and
                         `sendVisitorConfirmationEmail()` (SPR-010);
                         nothing outside this file imports `Resend` itself.
  lib/email/contact-email.tsx  The internal notification's React Email
                         template (SPR-010) — the letter as it arrives in
                         the site owner's inbox, not a notification.
  lib/email/visitor-confirmation-email.tsx  The visitor's own confirmation
                         (SPR-010) — confirms Scope's journey completed;
                         allowed to fail silently, never blocks the
                         visitor-facing response.
  lib/email/shared.tsx    Colors/fonts shared by both email templates
                         above, plus the Tailwind theme extension
                         ScopeStatic's classNames resolve against in an
                         email context — defined once, not redrawn.
  schemas/contact.ts      Zod schema for the Contact route handler's
                         server-side validation (SPR-009.2) — never trust
                         the client's own `required`/`type="email"` alone.
  types/, utils/          Currently unused/empty placeholders.
```

### Where Scope lives

Scope's *design intent* (personality, movement language, constraints) is documented outside code, at `docs/scope-docs/scope/` — that folder is the canonical source of truth and must be read before changing anything about Scope's identity. `docs/scope-docs/scope/SCOPE_UNDERSTANDING.md` is a consolidated read of every file in that folder and the best single starting point.

Scope's *implementation* lives at `src/components/scope/`:

- `scope.tsx` — the actual SVG render. A pure function of a `mood` prop; no internal state, no callbacks.
- `scope.types.ts` — the `ScopeMood` union (five moods, deliberately fixed) and the motion spec shape.
- `scope-motion.ts` — the single source of truth for every numeric motion value per mood (scale, rotate, y, glow, timing). Nothing outside this file should hardcode a Scope animation value.
- `use-scope-motion.ts` — resolves a mood into a ready-to-spread Framer `animate`/`transition` pair, theme- and reduced-motion-aware.
- `use-scope-presence.ts` — a second, independent motion layer: cursor-derived body tilt, eye tracking, parallax, and contact shadow. Layers on top of the mood system via separate transform channels (`animate` vs. `style`) so neither system needs to know about the other.
- `personality/use-scope-personality.ts` — a third independent layer: autonomous idle micro-gestures (see §4). Same pattern as presence — a self-contained hook returning plain motion values, composed into `scope.tsx`'s existing `style` objects, with zero knowledge of the other two layers.

The companion system (where Scope *is*, as opposed to how it moves) lives at `src/components/scope/companion/` — see §6.

### Motion System

All shared motion primitives live in `src/lib/motion/`, one file per token family (`durations.ts`, `easings.ts`, `springs.ts`, `transitions.ts`, `variants.ts`, `viewport.ts`, `distances.ts`), re-exported through `index.ts`. The `motion` skill (`.claude/skills/motion/`) documents the full rationale and is the reference for *which* token to reach for.

The load-bearing rules, enforced by convention across the codebase:

- Animate `transform`/`opacity` only — never `width`/`height`/`top`/`left`.
- Reach for a named token (`duration.*`, `easing.*`, `transitions.*`, a variant) before inlining a bespoke value.
- `MotionProvider` (`src/components/motion-provider.tsx`) sets `reducedMotion="user"` globally via Framer's `MotionConfig` — most components get reduced-motion handling for free. Anything driven *outside* `motion.*` components (raw DOM listeners, `document.startViewTransition`) must gate on `useReducedMotion()`/`useIsReducedMotion()` manually — the theme transition and Scope's cursor-presence hook both do this explicitly.
- Exactly one named Framer spring exists for ordinary UI (`springs.layout`), plus one deliberately heavier one for Scope's cross-section travel (`springs.companion`). New springs are added only when a concrete surface needs different physics, never speculatively.

### How future sections plug in

A new page section should be a Server Component by default, built from `Section` + `Container` (`src/components/layout/`), using `Reveal` (`src/components/motion/reveal.tsx`) for scroll-triggered entry and the shared `variants`/`transitions` tokens for anything else. If the section wants Scope to visit it, it mounts a `<ScopeDock>` (see §6) — it never renders `<Scope>` directly. Any client-only interactivity (like the About section's hover/tab hotspots, `about-workbench.tsx`) should be pulled into its own small client leaf component rather than promoting the whole section to `"use client"`.

---

## 4. Scope

As of SPR-003.3 ("Character Finalization"), the only two authoritative design docs are `docs/scope-docs/scope/SCOPE.md` and `VISUAL_LANGUAGE.md` (both v2.0), plus the reference image at `docs/scope-docs/scope/references/image.png` — read those, not the other files in that folder, which are kept for history and now carry a banner pointing here. `docs/design/` (exploratory industrial-design specs — see the open question at the end of this section) remains separate and unrelated. This section is a summary, not a replacement for the two v2.0 docs.

**Role.** Scope is the portfolio's companion — the physical manifestation of curiosity. It quietly accompanies visitors; it never explains, guides, or asks — it simply observes. The emotional target is explicit in canon: not "a cute animated robot," but "I miss that little guy."

**Personality.** Curious, gentle, quiet, patient, observant, innocent, calm. Never funny, loud, hyperactive, chaotic, childish, comedic, or clumsy. Expressed through movement, not performance — the character *is* the discipline of not interrupting.

**Physical form.** A rounded, almost-spherical ceramic shell (warm ivory), a large glossy near-black face plate (~70% of the visible front — "the body exists only to support the face"), two warm-amber vertical pill eyes, tiny rounded feet, and one small flexible antenna. Proportions are deliberately face-dominant and small-bodied — "vulnerable, never heroic, always approachable," per `SCOPE.md` v2.0's Core Design Principle and Scale sections. Five moods are implemented: `idle`, `curious`, `thinking`, `observe`, `happy` — a closed set; a new mood must be checked against these five for redundancy first.

**Eyes — the primary expression channel.** Two plain geometric pills, never a curve, star, or shape swap. Mood sets a resting expression (`eyeScaleY`: narrowed for thinking, widened for observe/curious); personality layers transient behaviour on top — real blinks (`blink`/`double-blink`/`slow-blink`, a literal scaleY close-open via a keyframe-array tween, composed with mood's own scaleY through a nested element, not a combinator, since mood's value isn't a `MotionValue`), brief squint/widen, and small gaze shifts (look-up/look-down/converge) that add to presence's continuous cursor-tracking gaze. Presence also adds a tiny, always-on jitter to the eyes ("never perfectly static") and an antenna that softly lags the body's own tilt ("reacts to movement... like a living creature"). Expression is built entirely from timing, spacing, and movement — never eyebrows, eyelids, iris/pupil detail, or a mouth.

**Why it (almost) never speaks.** No voice, no mouth, no speech bubbles, no text, with one exception — see below.

**Why it should never become the protagonist.** The portfolio and the person's work are always the subject; Scope is the witness. Any moment of Scope's "happiness" is a reaction to the visitor's or the portfolio's work — never a celebration of itself.

**Personality System (autonomous idle behaviour).** `src/components/scope/personality/` is a third independent layer on top of mood and cursor presence — undisturbed, Scope occasionally performs one behaviour from a deliberately large, varied pool (body: glance-left/right, tiny-tilt, posture-shift, stretch, bounce; eyes: blink family, squint, widen, look-up/down, converge; antenna: antenna-flex) before returning to neutral. Timing is randomized (~6–14s, never fixed) and any cursor activity defers the next one — presence's own cursor-tilt already reads as "attentive" the instant the visitor moves. A large pool with one firing at a time is what "vary naturally, never loop identically" (the docs' own words) actually requires. It does not add a 6th mood, and goes fully dormant under `prefers-reduced-motion` and while the tab is hidden (it's no longer gated on `mood === "idle"` specifically — see the SPR-003.4 note in `use-scope-personality.ts` for why that coupling broke and was removed).

SPR-005 added the pool's first genuinely *live* member: `attentionTarget` (`ScopeDockConfig.attentionTarget`, an optional `RefObject<Element | null>`) lets whoever owns a dock register an element Scope may occasionally glance toward — e.g. a project world's own bouncing ball or a point tracing a graph. It's threaded as a second pure prop (`dockConfig.attentionTarget → CompanionScope → <Scope attentionTarget> → useScopePersonality(scopeRef, attentionTarget)`), never a context reach, so Scope stays a pure function of external inputs and the mechanism still works on the provider-less `/scope` lab route. Deliberately NOT added as a 16th entry in `PERSONALITY_GESTURES` (that table is static, serializable data — a live-computed target doesn't belong there): instead, `runGesture()` gives a registered target first refusal at a fixed probability before falling through to the ordinary pool, computing a live, clamped eye offset (`personality/attention-target.ts`) from the real screen distance between Scope and the target, then running it through the same to/hold/back phase machinery every other gesture already uses on the existing `eyeOffsetX`/`eyeOffsetY` channel — no new composition wiring needed in `scope.tsx`.

**The one exception to "Scope never speaks."** Once per browser session (`sessionStorage`, key `scope:greeted`), the first time the Hero loads, a small caption — "Hi. I'm Scope." — fades in near Scope's Hero dock, holds ~2s, and fades out, never to reappear that session. Implemented in `src/components/scope/companion/scope-greeting.tsx`, deliberately outside the mood/personality system: Scope's own mood stays `idle` throughout, the text does the introducing. No background, border, or tail — a plain caption, not a chat bubble.

**A documented open question, worth knowing about going in:** the design-exploration documents in `docs/design/` (`scope-companion-spec.md`, `scope-engineering-instruments.md`, `scope-silhouette-exploration.md`) explore a substantially different physical form for Scope — an aluminum gimbal/ring holding a floating core, arrived at through a structured design process that ultimately recommends "The Reference Wheel," a spinning-disk concept. **That exploration was not adopted** and remains unrelated to the finalized character above — a real decision still needs to be made (and recorded here) before either adopting or formally shelving that gimbal/ring direction.

---

## 5. Hero

`src/components/hero/hero.tsx` defines the Hero primitives (`Hero`, `HeroContent`, `HeroEyebrow`, `HeroTitle`, `HeroDescription`, `HeroActions`, `HeroMedia`). It is intentionally minimal: an eyebrow line, a headline, a short description, two outbound links (GitHub, LinkedIn), and a media frame — no video, no illustration grid, no scroll-jacking. The Hero is a Server Component; all entrance motion is applied at the call site (`src/app/page.tsx`) via `StaggerGroup`/`StaggerItem`, not baked into the Hero itself.

`HeroMedia` is a reusable presentation *frame* (glass gradient, blur, border, grid texture), not a fixed image slot — its `ratio`/`fit` variants exist so a photo, a video mockup, or an abstract visual can all drop in later without structural changes.

Scope is introduced in the Hero via a `<ScopeDock id="hero" ...>` — a sized, invisible placeholder, not a direct `<Scope>` render. The single shared Scope instance (rendered once at the app root by the companion system, see §6) measures this dock and rests there by default, at `idle`. This is deliberate: the Hero is the one place Scope earns full, immediate presence, since it's the first place a visitor meets the character — but the *mechanism* by which it gets there is identical to every other section, not a special case.

---

## 6. Companion System

Scope is never sticky and never pinned to the viewport. It inhabits the portfolio the way a person would occupy a room — it has places it prefers to rest, and it travels between them in the document's own coordinate space, scrolling with the page like anything else that lives there.

This is implemented as a dock/registry/travel system under `src/components/scope/companion/`:

- **`ScopeDock`** (`scope-dock.tsx`) — a per-section, invisible, sized placeholder marking a "preferred resting place." A section that wants Scope to visit it mounts one of these with a unique `id` and an optional `config` (`mood`, `scale`, `facing`, `attentionTarget`). It registers itself on mount and unregisters on unmount; it never renders Scope directly. SPR-009: a second, plain effect also calls `updateDockConfig(id, config)` whenever the individual config fields change post-mount — every dock before Contact described a genuinely fixed resting spot, set once at registration and never touched again; Contact's is the first whose own mood/`attentionTarget` legitimately shifts across its section's own lifecycle (arrival → writing).
- **`ScopeDockProvider`** (`scope-dock-context.tsx`) — the system's single source of truth. Maintains a registry of every mounted dock, uses one shared `IntersectionObserver` for the whole page (not one per dock) to decide which dock is currently most visible, and exposes that as `activeDockId`. Also owns a lightweight "acknowledge" mechanism (`useScopeAcknowledge`) for hoverable elements that want Scope to briefly notice them — one reaction, self-resolving after ~700ms, no `onMouseLeave` needed. SPR-009 added `sceneMood`/`setSceneMood` alongside `isSceneTransitioning`: the mood substituted while an orchestrator has commandeered Scope, defaulting to `"observe"` (preserving the theme transition's original hardcoded behavior exactly) but settable per-beat by whichever orchestrator is running — Contact's departure sequence is the first consumer that actually needs a *different* substitute mood (`"idle"` while walking away) than `"observe"`.
- **`CompanionScope`** (`companion-scope.tsx`) — the one actual `<Scope>` instance for the entire app, rendered once at the root (via `ScopeDockProvider` in `layout.tsx`). It measures the currently active dock's position relative to a shared "stage" element and animates its own `x`/`y`/`scale`/`rotate` transform there — `position: absolute` inside the stage, never `position: fixed`, so it genuinely travels through the page rather than clinging to a viewport corner.

**Why it travels instead of teleporting.** The cross-section move uses `springs.companion` — deliberately much heavier and slower than any ordinary UI spring — so a dock change reads as "Scope chose to walk over there," not as a UI element snapping into a new position. This heavy-travel behavior is one of the defining ideas of the whole portfolio: every section that exists should be able to define where Scope naturally wants to be, and the character should feel like a single continuous presence moving through a real space, not a decoration re-instantiated per section.

Six docks exist today: `hero` (the Hero's media slot), `about` (the About section's intro slot), `tournamently`/`mathview` (each project's own "world," `mood: "observe"` — see §10's Projects entry), `notebook-workspace` (the Open Notebook's index column, `mood: "observe"`, `scale: 0.4` — see §10's Open Notebook entry), and `contact` (the Contact section's desk panel — see §10's Contact entry). Adding a new resting place is still: mount a `<ScopeDock id="..." config={{...}} />` sized the way Scope should read there. Nothing else — SPR-005's `attentionTarget` (§4) is an addition to `ScopeDockConfig`, not a new registration mechanism.

**The one deliberate exception to "Scope always returns to a dock":** SPR-009's Contact section is the portfolio's last section. Once its scripted departure sequence begins, `beginSceneTransition()` is called and never matched with an `endSceneTransition()` — dock-follow (and Personality/Presence) stay suspended for the rest of the page's life, and Scope's own motion values are left animated off past the desk panel's edge rather than restored to a dock. Every other commandeering sequence (the theme transition) always restores origin before releasing control; Contact's is the one place that doesn't, because there's nowhere left for Scope to return to. `theme-transition-controller.tsx`'s `playThemeTransition` guards against the resulting cross-controller conflict (toggling theme after Scope has permanently departed, or mid-Contact-sequence) by falling back to a plain `setTheme()` whenever `isSceneTransitioning` is already true, rather than starting a second `animate()` sequence on the same shared motion values.

**A known soft spot, surfaced twice in code review (SPR-008's AI Lab draft and its Open Notebook replacement) and still unresolved:** `pickActiveDock` (`scope-dock-context.tsx`) picks the dock with the highest raw `intersectionRatio`, which is relative to each dock's *own* box area, not viewport-visible area — a dock with a much smaller placeholder box than its neighbors reaches ratio 1 after far less scroll and can win "most visible" prematurely. Every dock added so far works around this informally, by convention, keeping its placeholder box in the same general size range as existing docks (roughly 112–192px) even when it wants Scope to *read* smaller — `config.scale` is the correct knob for that, independent of box size (see `notebook-workspace.tsx`'s own comment on its `notebook-workspace` dock for the fullest explanation). This works, but it's tribal knowledge sitting outside `ScopeDockConfig`'s actual type — a future dock author who reasonably shrinks the placeholder `className` instead of using `scale` will reproduce this bug with no compiler/lint signal. A real fix (normalizing by intersecting pixel area or viewport-visible fraction rather than raw target-relative ratio) belongs in `pickActiveDock` itself — a deliberate, separate change affecting every existing dock, not something to bundle into a single section's feature work.

---

## 7. Atmosphere System

Light and dark are not a "theme" in the settings-panel sense — the framing, deliberately, is that a visitor is changing the portfolio's *atmosphere*, not flipping a display preference. This is why the toggle (`src/components/theme/theme-toggle.tsx`) is a custom pill using Scope's own accent colors, not an OS-style sun/moon switch, and why its accessible label reads "Switch to light/dark atmosphere."

**Mechanism.** `ThemeProvider` (`src/components/theme/theme-provider.tsx`) is a thin wrapper over `next-themes`, class-based (`.dark`) to match every existing dark-mode rule in `globals.css`. `useThemeTransition` (`use-theme-transition.ts`) wraps `next-themes`' `setTheme` in `document.startViewTransition`, using `flushSync` to commit the class swap synchronously inside the transition callback (required by the View Transition API's contract).

**The transition itself.** Defined in `globals.css` under the "Atmosphere sweep" rules: the browser's default view-transition cross-fade is disabled on both snapshots, and the new atmosphere is instead revealed by an expanding circular clip-path anchored at the top-right corner — matching the toggle's own position — so the new atmosphere visibly sweeps across the interface toward the bottom-left. Duration/easing match the shared `duration.slower` (0.6s) / `easing.out` tokens exactly, so the one-off CSS animation still speaks the same motion language as everything driven through Framer.

**How Scope adapts.** Scope does not celebrate a theme switch — it never has its own reaction to it. Its core/glow fills (the only parts of Scope wired to `--scope-accent`) simply cross-fade to the new atmosphere's value over the same 0.6s window; its idle breathing pace also varies subtly by theme (`SCOPE_IDLE_DURATION_BY_THEME`: 3.8s light / 4.2s dark — "breathing is a little more noticeable" in light, "slightly slower" in dark), everything else about idle motion staying identical between themes.

Both the sweep and Scope's fill cross-fade are gated behind `prefers-reduced-motion: no-preference` (belt-and-suspenders on top of `useThemeTransition`'s own reduced-motion check, which skips `startViewTransition` entirely and falls back to a plain `setTheme`).

---

## 8. Motion Philosophy

Motion in this project is heavy, calm, and purposeful. Nothing is decorative — every movement exists to communicate something (state, causality, presence), and if it can't be justified that way, it shouldn't exist.

In practice:

- The signature easing (`easing.out`, `cubic-bezier(0.16, 1, 0.3, 1)`) is a fast-start, gentle-settle "premium decelerate" used for nearly all entrances — it's this project's one consistent motion signature.
- Nothing in the app should animate slower than `duration.slower` (0.6s); past that, motion reads as sluggish rather than premium.
- Scroll reveal distances never exceed `distance.lg` (24px) — large translate distances are what make a page feel like a slideshow instead of a considered reveal.
- Scope's own motion is the strictest register in the app: "never exaggerated," spring-damped so nothing snaps or overshoots harshly, always caused by something specific happening.
- `prefers-reduced-motion` is not an afterthought bolted on per component — it's handled once, globally, via `MotionConfig`'s `reducedMotion="user"`, with explicit manual gating anywhere motion happens outside Framer's own components (the theme sweep, Scope's cursor-presence physics).

---

## 9. Development Principles

- Prefer architecture over hacks — a one-off fix that bypasses an existing system (the motion tokens, the dock registry, the atmosphere provider) is a smell, not a shortcut.
- Reuse existing systems before adding a new one. Check `src/lib/motion/`, `src/components/layout/`, `src/components/scope/companion/` before inventing a parallel mechanism.
- Never hardcode an animation value — duration, easing, spring, or distance — that already has a token. If a genuinely new value is needed, it likely belongs in `src/lib/motion/` as a new token, not inlined at the call site.
- Avoid unnecessary Client Components. Default to Server Components; extract only the interactive leaf into `"use client"` (see how `scope.tsx`, `about-workbench.tsx`, and each project's `worlds/*-world.tsx` do this) rather than promoting an entire section.
- Respect accessibility as a baseline requirement, not a pass: landmark labeling (`aria-labelledby` on multi-section pages), focus-visible states, meaningful `aria-label`s on custom controls (the theme toggle), `aria-hidden` on purely decorative elements (Scope, the background layers).
- Respect `prefers-reduced-motion` for every new motion surface — check whether it's covered by `MotionConfig` automatically, or needs its own manual gate.
- Every feature should be extensible in the direction the architecture already points — e.g. a new Scope resting place should cost exactly one `<ScopeDock>`, never a change to the companion system itself.
- Build systems before building pages. The dock/registry system, the motion token layer, and the atmosphere provider were all built ahead of the pages that would eventually need them — new sections should be additions to those systems, not one-off reinventions.
- Follow the project's default workflow for implementation tasks: Plan Agent → relevant Skills → Worker Agent → Observer Agent → Verify Skill → Code Review Skill (see `.claude/CLAUDE.md`).

---

## 10. Current Status

**Implemented:**

- Project scaffold: Next.js 16 App Router, Tailwind v4, TypeScript, ESLint/Prettier, Husky + lint-staged.
- Motion token system (`src/lib/motion/`) — durations, easings, springs, transitions, variants, viewport, distances — fully built and in use.
- `Hero`, `Section`, `Container`, `Background`, `Reveal`, `Stagger` — the structural + motion primitive layer.
- Scope's implementation, finalized as of SPR-003.3: the `<Scope>` SVG component (dominant glossy face plate, two warm-amber eyes, an antenna, a slightly flattened ivory shell — see §4), its five-mood motion vocabulary (`scope-motion.ts`, including per-mood `eyeScaleY`), mood-resolution hook (`use-scope-motion.ts`), an independent cursor-presence physics layer (`use-scope-presence.ts`) — body tilt, eye tracking with velocity-based lead and a continuous micro-jitter, parallax, contact shadow, antenna sway, and proximity-based interaction intensity — and an independent autonomous idle-personality layer (`personality/`, see §4) with a 15-gesture pool spanning body, eye, and antenna behaviour, including real blink mechanics (keyframe-array `scaleY`, not opacity) and an anticipation lead-in on body gestures.
- The companion system in full: dock registration, one shared `IntersectionObserver`-driven active-dock resolution, heavy cross-section travel via `springs.companion`, and a self-resolving hover-acknowledge mechanism.
- The one-time Hero greeting ("Hi. I'm Scope.", `scope-greeting.tsx`) — the sole exception to "Scope never speaks," session-scoped via `sessionStorage`.
- The About section (SPR-004.1, "The Workbench" — `src/components/sections/about-section.tsx`) — the real second dock (`id="about"`, `mood: "observe"`), replacing the companion-demo placeholder ahead of the roadmap's original Sprint 4→6 order (Projects hasn't been built yet; About was pulled forward). One unified glass scene reusing the Hero's own frame material (border/gradient/blur/bg-grid, at a much fainter opacity than Hero's own — this panel is mostly body text, not an empty decorative box) rather than a grid of separate cards. Content is four "hotspots" ("Now teaching" / "Now building" / "Now exploring" / "Philosophy") built on shadcn/`@base-ui`'s `Tabs` (real ARIA tablist/tabpanel semantics, not hand-rolled buttons), revealed one at a time — hovering or focusing a hotspot activates it and also triggers Scope's acknowledge reaction (`about-workbench.tsx`), plus a shared cursor-tracked spotlight (a raw CSS-custom-property, no React state, same technique as `use-scope-presence.ts`, gated behind `useIsReducedMotion()`). Deliberately not a bio/résumé/timeline/skill-bar list. Copy lives in `about-content.ts`, separated from layout per the portfolio-writing skill. Note for any future dock placed in a column above body text in the same frame: Scope's own rendered size is scaled from its intrinsic size-40/48 by `config.scale`, so it can visually overflow a smaller dock box — this section's dock/text gap (`gap-12 sm:gap-16`) is sized to clear that, not just for spacing.
- The Projects section (SPR-005, "Scope's Worlds" — `src/components/sections/projects-section.tsx`) — two full-width, scene-first project cards (`project-card.tsx`), each with its own "world" client leaf (`src/components/sections/worlds/`) that owns a point-of-interest ref and mounts its own `<ScopeDock>` (`id="tournamently"` / `id="mathview"`, both `mood: "observe"`) — four docks total now, the companion system's first real test beyond two. Introduced the Personality system's first genuinely new capability since SPR-003.3: `ScopeDockConfig.attentionTarget` (an optional `RefObject<Element | null>`), threaded `dockConfig → CompanionScope → <Scope attentionTarget> → useScopePersonality(scopeRef, attentionTarget)`, so Scope's eyes occasionally glance toward a registered element (Tournamently's bouncing ball; MathView's dot tracing a static sine curve) instead of only tracking the cursor. Geometry (`computeAttentionOffset`) lives in its own file, `personality/attention-target.ts`, split out from `use-scope-personality.ts` to keep that hook's own complexity from growing — see §4 below for why the coupling is structured the way it is.
- The Atmosphere system: theme provider, custom toggle, and the full `document.startViewTransition`-driven cinematic sweep, including Scope's own subtle cross-theme adaptation.
- A standalone `/scope` debug route (`src/app/scope/`) — a mood-picker lab (keyboard shortcuts 1–5) with a live debug readout, useful for reviewing Scope's motion (including personality gestures) in isolation.
- The Open Notebook section (SPR-008, evolved in SPR-008.1 into an interactive research workspace — `src/components/sections/notebook-section.tsx`) — the portfolio's one deliberate rhythm-break: a centered, serif-accented intro ("You weren't supposed to see this." → "Open notebook." → subtitle, each its own scroll-triggered reveal) followed by a single interactive workspace (`notebook-workspace.tsx`), not the scroll-through "pages" SPR-008 originally shipped. A quiet vertical index (built on `Tabs`/`TabsList`/`TabsTrigger`, restyled with no boxed-pill chrome so it reads as a list, not tabs) lets a visitor pick one of six live research threads plus a trailing "still unwritten" placeholder; the selected thread's fields (question, status, latest finding, hypothesis, failed assumption, next experiment, research notes) reveal in the document panel one at a time via `notebook-document.tsx`, only rendering the fields a thread actually has — that sparsity, not a designed toggle, is what makes threads feel organically different. One new dock, `notebook-workspace` (`mood: "observe"`, `scale: 0.4`, living in the index column) — replacing the six-dock "one per question" design SPR-008 shipped, since there's no longer a separate scroll position per question. A quiet corkboard-string flourish (SPR-008.1's "haven't seen this before" moment) draws a connecting line, in Scope's own `--scope-warm` accent, between the active thread's index entry and any threads it's tagged as related to, computed from live DOM geometry and animated in via a CSS keyframe (`animate-notebook-line-draw` in `globals.css`) rather than a JS-toggled transition. Introduced a section-scoped serif face (`font-notebook`, Newsreader via `next/font/google`, regular weight + italic only) named after the section rather than a generic alias, specifically so it doesn't read as a second general-purpose type option next to `font-sans`/`font-mono`. Reintroduced a shared `fadeInUpSlow` variant (`lib/motion/variants.ts` — `fadeInUp`'s geometry on `transitions.enterSlow`) used by the intro's three lines and the workspace's own reveal, still within the app-wide `duration.slower` ceiling — "the slowest section" is achieved through pacing (generous whitespace, later `viewport.amount` thresholds) rather than exceeding it. Content lives in `notebook-content.ts`, drawn from the brief that requested this section rather than invented, still first-draft/provisional pending the site owner's review.
- The Contact section (SPR-009, "The Final Scene" — redirected twice, in SPR-009.1 "Scope as protagonist" and SPR-009.3 "the letter must feel real" — `src/components/sections/contact-section.tsx`) — the portfolio's closing chapter and Scope's first genuinely scripted moment: until now Scope has only ever rested at docks or glanced around; here he acts. Two governing rules carried through every redirect: (1) every important transition must be attributable to Scope — "if Scope disappeared from the scene, the interaction should stop making narrative sense" — and (2) physical continuity — the visitor is handing Scope a physical letter, an illusion that must never break, so the paper is one persistent element from the moment it appears to the moment it's accepted, never replaced or swapped for other content.

  `contact-desk.tsx` (the section's client leaf) runs a six-scene state machine: `"arrival" → "preparing" → "writing" → "sealing" → "delivering" → "resting"`. Arrival needs no scripted motion (mounting `<ScopeDock id="contact">` alone produces it via the existing dock-follow system); his mood settling to `"observe"` visibly *precedes* the paper/clip/pen appearing, by a held beat, rather than both happening in the same frame; his own `useScopeAcknowledge()` fires proactively the moment the form is invited in; his mood shifts to `"curious"` for as long as a submission is genuinely in flight (`ContactForm`'s `onSubmittingChange`). The paper itself is driven entirely by Framer `useMotionValue`s (`paperX/Y/Scale/ScaleY/Rotate/Opacity`, plus `clipRotate/Y/Opacity` for a small metallic clip present from the very first frame, meaningless while writing, suddenly meaningful once it releases) rather than declarative `initial`/`animate` props — matching how Scope's own companion motion already works, and the only way to drive a single element through many sequential physical beats without ever unmounting it. On submit, `contact-form.tsx`'s fields go `readOnly` (not `disabled` — the visitor's own words stay fully visible, just fixed) via its existing `pending` state, which now never resets after a real success. "Sealing" then runs, in order: a held pause ("let the moment breathe") → the clip releases (rotates further, lifts, fades — "the first physical action after submission") → the now-free paper slides a short distance via a heavy, high-mass spring ("weight, momentum, friction, not a DOM element moving") → it folds (`scaleY` toward ~0.52, origin at the top edge). **Only once the fold completes** does Scope's own approach begin — verified via a live instrumented trace (his `x`/`y` motion values are provably stationary until the exact frame the fold's `scaleY` settles) — "Scope reacts to the completed letter, never the click." He arrives, holds (a look-at-the-letter pause), then *accepts*: the letter shrinks/fades in place, into his possession, while his mood plays the canonical `"happy"` reaction (`scope-motion.ts` — the one moment in the portfolio that mood is used, "a reaction to the visitor's... work," never a celebration of itself). A further held pause, mood settling to a calm `"observe"` ("acknowledge"), then `"idle"` and departure — exit target measured against the desk panel's own current edges (`computeExitTarget`), not a fixed offset, since a fixed offset read as "shrinks in place overlapping the closing line" once actually watched in the browser. Moving him far enough to clear the panel required `overflow-x-hidden` on both `<html>` and `<body>` in `layout.tsx`, since the transform can briefly exceed the document's normal content width.

  Unlike SPR-009.1's version, Scope is never permanently stuck here: after departing he stays commandeered (visibly "gone") only until either the visitor's attention moves elsewhere — an effect watching `activeDockId` calls `endSceneTransition()` the moment a different dock becomes active, releasing him back to ordinary dock-follow so he travels there too, confirmed live by scrolling away mid-"resting" and watching him retarget to another section's dock — or they click the quiet secondary invitation that appears once resting (`CONTACT_FORM_COPY.replayLabel`, "Write another letter"), which resets every piece of local paper/clip state and releases him the same way, so the exact same heavy `springs.companion` travel that brought him here the first time brings him back ("Scope naturally returns"). The desk panel, its lighting, and the `<ScopeDock>` are **always** rendered — only the letter itself ever leaves; once resting, the content column simply swaps from the letter to the closing line ("Every great idea starts with a conversation.") plus that replay invitation, inside the exact same permanent frame. (A real bug surfaced and fixed during this work: the arrival→preparing effect's dependency array didn't include `scene`, so replay's `setScene("arrival")` silently never re-armed it, since `activeDockId` never actually changes on replay — the dock's placeholder never left the viewport.)

  Submission is real: `src/app/api/contact/route.ts` sends the visitor's message via Resend to the site owner's inbox (env var `CONTACT_TO_EMAIL`, alongside `RESEND_API_KEY`/`CONTACT_FROM_EMAIL` — all three documented in `.env.example` and `README.md`), with a dev-only `CONTACT_SIMULATE_SUCCESS` bypass for exercising the full sequence without a real API key, and a visually-hidden honeypot field for spam resistance with no visible CAPTCHA. No toast/modal/success UI anywhere. SPR-009.2 hardened the backend into three layers, each with one job: `schemas/contact.ts` (Zod — server-side validation the client is never trusted to have already done, `422` on failure, distinct from a malformed-JSON `400` and a delivery-failure `500`), `lib/email/resend.ts` (the one place the `Resend` SDK is imported at all — exports `sendContactEmail()`), and the route handler itself: parse → honeypot check (on the raw body, *before* schema validation, so a filtered submission always gets an identical generic `200`) → validate → dev bypass → `sendContactEmail()`. `ContactForm`/`contact-desk.tsx` needed zero changes for the backend hardening — the cinematic experience and the delivery mechanism are fully decoupled.

  SPR-010 ("the letter continues") extended the narrative past the browser, in two parts. First, the internal notification: `lib/email/contact-email.tsx` is a React Email template (`resend.tsx` — renamed from `.ts` once it needed to hold JSX — passes it as Resend's `react` option rather than a hand-built HTML string; React's own escaping is what keeps a visitor's message safe to interpolate directly, no manual sanitizing needed) designed to read as a delivered letter, not a notification. Every color is a literal hex value translated from the site's own oklch tokens (CSS custom properties don't reach email clients at all), and nothing uses a blur filter, gradient, or webfont — all three degrade unpredictably across Gmail/Outlook/Apple Mail; `react-email`'s own `<Tailwind>`/table-based rendering handles the Outlook-safe markup. The message's own paragraph breaks are preserved via explicit `<br />` elements from a `.split("\n")`, not `white-space: pre-wrap` (inconsistent old-Outlook support). Its footer reuses `CONTACT_ENDING_LINE` verbatim — the same line the website itself shows once Scope departs.

  Scope himself appears in both templates as `ScopeStatic` (`src/components/scope/scope-static.tsx`) — not a redrawn icon. The first attempt at this (a hand-copied static SVG living in `lib/email/shared.tsx`) was rejected on exactly that basis — "there must only ever be one canonical Scope." Rendering the real, live `<Scope>` directly turned out to be categorically impossible, not just impractical: it's `"use client"`, and confirmed empirically, attempting to invoke it from a Route Handler throws *"Attempted to call Scope() from the server but Scope is on the client"* — a hard React Server Components boundary (a "use client" component can only be rendered as part of a tree that eventually hydrates in a browser; an email never hydrates at all, so there's no valid way to use it there, ever). The actual fix: `scope-geometry.ts` (every shape/path constant, no "use client", safely importable anywhere) and `SCOPE_MOODS` in `scope-motion.ts` (also plain data) were extracted as the one shared source of truth; `scope.tsx` itself was refactored to read its coordinates from `scope-geometry.ts` instead of inline literals (a pure extraction, zero behavioral change — verified via the `/scope` debug lab before/after), and `scope-static.tsx` is a second, motion-free renderer of those exact same numbers, using the same `fill-scope-warm`/`fill-scope-shell`/etc. Tailwind classNames `scope.tsx` uses (resolved against a theme extension in `lib/email/shared.tsx` in the email context, the live Tailwind build on the site) rather than inline hex. No gradient (the live shell's `<linearGradient>` leans on `var()`/`color-mix()`, unreliable in email) and no blur filters (poor/no email support) — everything else, faithfully the same shapes.

  Second, the visitor's own side of the same story: `lib/email/visitor-confirmation-email.tsx` (`sendVisitorConfirmationEmail` in `resend.tsx`) confirms Scope's journey actually completed — sent automatically after the internal notification succeeds, never in Scope's own voice (he never speaks — this is Álvaro's own short, signed reply, "do not repeat the message they already wrote"), and reusing the exact same seal/palette/ending-line rather than a separate visual identity. Deliberately allowed to fail silently: the route handler wraps it in its own `try/catch` after the internal send has already succeeded, logs any failure, and never lets it affect the response the visitor sees — the internal notification is the priority, this is a nice-to-have on top of it.

  Both templates were verified by rendering to real HTML via `react-email`'s own `render()` (a temporary debug route, removed after use each time) rather than trusting they compiled — confirmed table-based markup (no `display:flex` leaking through), correct mobile reflow at 390px, and that HTML-like message content (`<script>`) renders fully escaped, not executable.

  SPR-010's second half (the domain migration) removed Resend's shared sandbox sender entirely: `resend.tsx`'s old hardcoded `DELIVERY_EMAIL`/`FROM_ADDRESS` constants (the site owner's inbox and `Scope <onboarding@resend.dev>`) are gone, replaced by a single `getEmailEnvConfig()` reading `RESEND_API_KEY`/`CONTACT_FROM_EMAIL`/`CONTACT_TO_EMAIL` from the environment — used by both `sendContactEmail()` and `sendVisitorConfirmationEmail()`, so there is exactly one place any of the three can be missing or wrong. Graceful by design, not by accident: a missing variable logs a specific, actionable server-side error (naming exactly which var(s) are absent) and returns `null` rather than throwing, so every caller treats "cannot send" as an ordinary `{ ok: false }` result — a misconfigured deploy returns a controlled `500`, never a crashed process. The internal notification sets Reply-To to the visitor's own address (so replying from the owner's inbox goes straight to them); the visitor confirmation sets Reply-To to `CONTACT_TO_EMAIL` (so a visitor replying reaches the owner directly, without needing to already know that address). `README.md` now carries the operational setup guide (env vars, verifying a sending domain in Resend, deploying on Vercel) that a fresh `create-next-app` README previously left blank.
- Two new form-field UI primitives, `src/components/ui/input.tsx`/`textarea.tsx`/`label.tsx` — the first in the project, built the same way `tabs.tsx`/`button.tsx` wrap other `@base-ui/react` primitives with `cva`. `Textarea` is `@base-ui/react/field`'s `Field.Control` rendered as a `<textarea>` via its `render` prop (Field.Control's own prop types stay pinned to `<input>`, cast at the one point that matters — see the component's own comment) rather than a hand-rolled multi-line field.

**Partially implemented / known debt:**

- The Hero's `HeroMedia` frame is still showing its `contained`/`square` placeholder variant, not a real project visual.
- `src/types/` and `src/utils/` exist as empty placeholders with no content yet.
- Site metadata in `layout.tsx` still has a literal `[Álvaro Gaertner]` placeholder pending the real name/tagline.
- Both Projects cards ship with placeholder `#` links and a best-guess tech-stack badge list (confirmed as provisional with the user, not fabricated) — see `projects-content.ts`'s own header comment. Swap in real URLs/stacks whenever available; no other code needs to change.
- `use-scope-personality.ts` (356 lines) and `runGesture()`/`useScopePersonality()` (complexity ~32/~44 by the architecture skill's heuristic) exceed the project's own structural thresholds — almost entirely pre-existing (the phase-application logic already applied up to 8 optional fields across 3 phases before SPR-005 touched it at all; extracting the new attention-target math into its own file barely moved the number). A real reduction would mean restructuring the already-shipped, carefully-tuned gesture-phase engine — a deliberate, separate refactor, not something to bundle into a feature change.
- Future "curiosity" behaviour (Scope briefly noticing newly-appeared page elements, e.g. Project Cards) is intentionally unbuilt beyond the attentionTarget mechanism above; the existing `useScopeAcknowledge()` hover mechanism remains the right trigger point for hover-based noticing.
- A known, accepted gap from SPR-003.3: the accent dot's `interactionIntensity` (presence) has no `pointerleave` handling, so it holds its last value rather than decaying to 0 if the cursor exits the browser window entirely — a small limitation, not an oversight (see the comment in `use-scope-presence.ts`).

**Not started:**

- Project Detail experience (Sprint 5 below). About (Sprint 6), Projects (Sprint 4), and Contact (Sprint 7) are all done, each arriving out of the roadmap's original numbered order — see above.
- The design direction question flagged in §4 (whether to keep the current ceramic-body Scope or pursue the gimbal/ring exploration in `docs/design/`) is unresolved.

Update this section after every sprint — it should always be a snapshot a new session can trust without reading git history.

---

## 11. Roadmap

**Sprint 1 — Scope Identity.** Establish Scope's personality, constraints, and visual/motion vocabulary as documented, protected source of truth (`docs/scope-docs/scope/`), and build the character itself as a standalone, mood-driven component.

**Sprint 2 — Hero Experience.** Build the Hero's structural and motion primitives, and introduce Scope into the portfolio for the first time via its first resting place.

**Sprint 3 — Atmosphere & Companion System.** Build the light/dark "atmosphere" system with its cinematic transition, and generalize Scope from "a component rendered in the Hero" into a portfolio-wide companion that travels between docked resting places.

**Sprint 4 — Projects Experience.** ~~The real projects grid/listing — a further resting place for Scope beyond the Hero and About.~~ Done (as SPR-005, "Scope's Worlds," in this project's own sprint numbering) — see §10.

**Sprint 5 — Project Detail Experience.** Individual project pages/case studies.

**Sprint 6 — About Experience.** ~~The personal/professional narrative section.~~ Done (as SPR-004 in this project's own sprint numbering) — pulled forward ahead of Projects/Project Detail; see §10.

**Sprint 7 — Contact Experience.** ~~The contact surface.~~ Done (as SPR-009, "The Final Scene," in this project's own sprint numbering) — see §10. Landed after Open Notebook (SPR-008) rather than immediately after Sprint 6, since Open Notebook itself arrived out of order.

**Sprint 8 — Final Polish.** Cross-cutting pass: performance, accessibility, copy, remaining debug cleanup, and consistency review across everything built in Sprints 1–7.

**Open Notebook Experience (SPR-008).** Not one of the original 8 sprints above — a new addition, same situation as About (SPR-004) and Projects (SPR-005) landing outside their original numbered slot. Built the "Open Notebook" section (§10): live research questions, deliberately not a showcase, list, or changelog — the one section built to break the portfolio's own established rhythm rather than extend it. Slotted in after Projects and before Contact on the live page.

---

## 12. Long-Term Vision

The portfolio should never feel like a collection of pages. It should feel like a small world — one a visitor can move through and find quietly occupied, the way a well-kept room feels occupied even when no one is speaking in it.

Scope is not a mascot. Scope is not a chatbot. Scope is the physical manifestation of curiosity, given a body, a handful of honest reactions, and nowhere it's obligated to be. Everything about its design — the silence, the restraint, the fact that it travels rather than teleports, the fact that it notices rather than performs — exists in service of one outcome: the visitor should leave remembering a feeling, not a feature list.

If a future decision ever has to choose between making Scope more capable and keeping Scope humble, humble wins. The portfolio is the subject. Scope is the witness.
