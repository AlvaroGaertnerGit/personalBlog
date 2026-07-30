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
                         standalone debug route (see below).
  components/
    hero/               Hero primitives (Hero, HeroContent, HeroMedia, ...).
    layout/             Structural, content-agnostic: Background, Container,
                         Section. No visual opinions beyond spacing/structure.
    motion/              Reusable motion wrappers: Reveal (scroll-in), Stagger.
    scope/               Scope the character itself — the <Scope> SVG
                         component, its motion vocabulary, and three
                         independent physics hooks (mood animation, cursor
                         presence, autonomous idle personality).
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

A new page section should be a Server Component by default, built from `Section` + `Container` (`src/components/layout/`), using `Reveal` (`src/components/motion/reveal.tsx`) for scroll-triggered entry and the shared `variants`/`transitions` tokens for anything else. If the section wants Scope to visit it, it mounts a `<ScopeDock>` (see §6) — it never renders `<Scope>` directly. Any client-only interactivity (like the companion demo card) should be pulled into its own small client leaf component rather than promoting the whole section to `"use client"`.

---

## 4. Scope

As of SPR-003.3 ("Character Finalization"), the only two authoritative design docs are `docs/scope-docs/scope/SCOPE.md` and `VISUAL_LANGUAGE.md` (both v2.0), plus the reference image at `docs/scope-docs/scope/references/image.png` — read those, not the other files in that folder, which are kept for history and now carry a banner pointing here. `docs/design/` (exploratory industrial-design specs — see the open question at the end of this section) remains separate and unrelated. This section is a summary, not a replacement for the two v2.0 docs.

**Role.** Scope is the portfolio's companion — the physical manifestation of curiosity. It quietly accompanies visitors; it never explains, guides, or asks — it simply observes. The emotional target is explicit in canon: not "a cute animated robot," but "I miss that little guy."

**Personality.** Curious, gentle, quiet, patient, observant, innocent, calm. Never funny, loud, hyperactive, chaotic, childish, comedic, or clumsy. Expressed through movement, not performance — the character *is* the discipline of not interrupting.

**Physical form.** A rounded, almost-spherical ceramic shell (warm ivory), a large glossy near-black face plate (~70% of the visible front — "the body exists only to support the face"), two warm-amber vertical pill eyes, tiny rounded feet, and one small flexible antenna. Proportions are deliberately face-dominant and small-bodied — "vulnerable, never heroic, always approachable," per `SCOPE.md` v2.0's Core Design Principle and Scale sections. Five moods are implemented: `idle`, `curious`, `thinking`, `observe`, `happy` — a closed set; a new mood must be checked against these five for redundancy first.

**Eyes — the primary expression channel.** Two plain geometric pills, never a curve, star, or shape swap. Mood sets a resting expression (`eyeScaleY`: narrowed for thinking, widened for observe/curious); personality layers transient behaviour on top — real blinks (`blink`/`double-blink`/`slow-blink`, a literal scaleY close-open via a keyframe-array tween, composed with mood's own scaleY through a nested element, not a combinator, since mood's value isn't a `MotionValue`), brief squint/widen, and small gaze shifts (look-up/look-down/converge) that add to presence's continuous cursor-tracking gaze. Presence also adds a tiny, always-on jitter to the eyes ("never perfectly static") and an antenna that softly lags the body's own tilt ("reacts to movement... like a living creature"). Expression is built entirely from timing, spacing, and movement — never eyebrows, eyelids, iris/pupil detail, or a mouth.

**Why it (almost) never speaks.** No voice, no mouth, no speech bubbles, no text, with one exception — see below.

**Why it should never become the protagonist.** The portfolio and the person's work are always the subject; Scope is the witness. Any moment of Scope's "happiness" is a reaction to the visitor's or the portfolio's work — never a celebration of itself.

**Personality System (autonomous idle behaviour).** `src/components/scope/personality/` is a third independent layer on top of mood and cursor presence — while Scope rests at `idle`, undisturbed, it occasionally performs one behaviour from a deliberately large, varied pool (body: glance-left/right, tiny-tilt, posture-shift, stretch, bounce; eyes: blink family, squint, widen, look-up/down, converge; antenna: antenna-flex) before returning to neutral. Timing is randomized (~6–14s, never fixed) and any cursor activity defers the next one — presence's own cursor-tilt already reads as "attentive" the instant the visitor moves. A large pool with one firing at a time is what "vary naturally, never loop identically" (the docs' own words) actually requires. It does not add a 6th mood, and goes fully dormant outside `idle`, under `prefers-reduced-motion`, and while the tab is hidden.

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

- **`ScopeDock`** (`scope-dock.tsx`) — a per-section, invisible, sized placeholder marking a "preferred resting place." A section that wants Scope to visit it mounts one of these with a unique `id` and an optional `config` (`mood`, `scale`, `facing`). It registers itself and unregisters on unmount; it never renders Scope directly.
- **`ScopeDockProvider`** (`scope-dock-context.tsx`) — the system's single source of truth. Maintains a registry of every mounted dock, uses one shared `IntersectionObserver` for the whole page (not one per dock) to decide which dock is currently most visible, and exposes that as `activeDockId`. Also owns a lightweight "acknowledge" mechanism (`useScopeAcknowledge`) for hoverable elements that want Scope to briefly notice them — one reaction, self-resolving after ~700ms, no `onMouseLeave` needed.
- **`CompanionScope`** (`companion-scope.tsx`) — the one actual `<Scope>` instance for the entire app, rendered once at the root (via `ScopeDockProvider` in `layout.tsx`). It measures the currently active dock's position relative to a shared "stage" element and animates its own `x`/`y`/`scale`/`rotate` transform there — `position: absolute` inside the stage, never `position: fixed`, so it genuinely travels through the page rather than clinging to a viewport corner.

**Why it travels instead of teleporting.** The cross-section move uses `springs.companion` — deliberately much heavier and slower than any ordinary UI spring — so a dock change reads as "Scope chose to walk over there," not as a UI element snapping into a new position. This heavy-travel behavior is one of the defining ideas of the whole portfolio: every section that exists should be able to define where Scope naturally wants to be, and the character should feel like a single continuous presence moving through a real space, not a decoration re-instantiated per section.

Two docks exist today: `hero` (the Hero's media slot) and `companion-demo` (a placeholder section demonstrating the system ahead of a real Projects section — see `src/components/sections/companion-demo-section.tsx`). Adding a new resting place is: mount a `<ScopeDock id="..." config={{...}} />` sized the way Scope should read there. Nothing else.

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
- Avoid unnecessary Client Components. Default to Server Components; extract only the interactive leaf into `"use client"` (see how `scope.tsx` and `companion-demo-card.tsx` do this) rather than promoting an entire section.
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
- Two live docks: the Hero (`id="hero"`) and a placeholder companion-demo section (`id="companion-demo"`) that exists specifically to exercise the dock/travel/acknowledge system ahead of a real Projects section.
- The Atmosphere system: theme provider, custom toggle, and the full `document.startViewTransition`-driven cinematic sweep, including Scope's own subtle cross-theme adaptation.
- A standalone `/scope` debug route (`src/app/scope/`) — a mood-picker lab (keyboard shortcuts 1–5) with a live debug readout, useful for reviewing Scope's motion (including personality gestures) in isolation.

**Partially implemented / known debt:**

- Only two sections exist in the live page (Hero + the companion-demo placeholder) — there is no real Projects, About, or Contact content yet, so the companion system's real test (many genuinely different resting places) hasn't happened.
- The Hero's `HeroMedia` frame is still showing its `contained`/`square` placeholder variant, not a real project visual.
- `src/types/` and `src/utils/` exist as empty placeholders with no content yet.
- Site metadata in `layout.tsx` still has a literal `[Álvaro Gaertner]` placeholder pending the real name/tagline.
- Future "curiosity" behaviour (Scope briefly noticing newly-appeared page elements, e.g. Project Cards) is intentionally unbuilt; the existing `useScopeAcknowledge()` hover mechanism is almost certainly the right trigger point for that later, not a new system.
- A known, accepted gap from SPR-003.3: the accent dot's `interactionIntensity` (presence) has no `pointerleave` handling, so it holds its last value rather than decaying to 0 if the cursor exits the browser window entirely — a small limitation, not an oversight (see the comment in `use-scope-presence.ts`).

**Not started:**

- Projects, Project Detail, About, and Contact experiences (Sprints 4–7 below).
- The design direction question flagged in §4 (whether to keep the current ceramic-body Scope or pursue the gimbal/ring exploration in `docs/design/`) is unresolved.

Update this section after every sprint — it should always be a snapshot a new session can trust without reading git history.

---

## 11. Roadmap

**Sprint 1 — Scope Identity.** Establish Scope's personality, constraints, and visual/motion vocabulary as documented, protected source of truth (`docs/scope-docs/scope/`), and build the character itself as a standalone, mood-driven component.

**Sprint 2 — Hero Experience.** Build the Hero's structural and motion primitives, and introduce Scope into the portfolio for the first time via its first resting place.

**Sprint 3 — Atmosphere & Companion System.** Build the light/dark "atmosphere" system with its cinematic transition, and generalize Scope from "a component rendered in the Hero" into a portfolio-wide companion that travels between docked resting places.

**Sprint 4 — Projects Experience.** The real projects grid/listing — the first genuine second (and third, ...) resting place for Scope beyond the current placeholder demo section.

**Sprint 5 — Project Detail Experience.** Individual project pages/case studies.

**Sprint 6 — About Experience.** The personal/professional narrative section.

**Sprint 7 — Contact Experience.** The contact surface.

**Sprint 8 — Final Polish.** Cross-cutting pass: performance, accessibility, copy, remaining debug cleanup, and consistency review across everything built in Sprints 1–7.

---

## 12. Long-Term Vision

The portfolio should never feel like a collection of pages. It should feel like a small world — one a visitor can move through and find quietly occupied, the way a well-kept room feels occupied even when no one is speaking in it.

Scope is not a mascot. Scope is not a chatbot. Scope is the physical manifestation of curiosity, given a body, a handful of honest reactions, and nowhere it's obligated to be. Everything about its design — the silence, the restraint, the fact that it travels rather than teleports, the fact that it notices rather than performs — exists in service of one outcome: the visitor should leave remembering a feeling, not a feature list.

If a future decision ever has to choose between making Scope more capable and keeping Scope humble, humble wins. The portfolio is the subject. Scope is the witness.
