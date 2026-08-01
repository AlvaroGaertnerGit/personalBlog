# Living Scope

Version: 1.0 (design phase — nothing in this file is implemented yet)

---

## What this is

The portfolio itself is finished. From here on, Scope should become richer
*over time* — not by adding features, but by adding life. Every few months,
one tiny personality moment gets added. Each one takes a few seconds. A
visitor should never think "there's a new feature" — the goal is closer to
"...did Scope always do that?"

This file is the living roadmap for that effort. It is not a sprint plan.
It has no deadline. Read it before adding any new moment, and add new
moments to it as they ship.

---

## The one rule everything below is filtered through

> "Scope should never perform animations. Scope should perform behaviours."
> — `SCOPE.md`

A *behaviour* has a reason: something in the world changed, and Scope's
reaction is proportionate and explainable. A *performance* is scheduled for
its own sake. Every Living Moment must be a behaviour, never a performance.

## Hard constraints (every moment, no exceptions)

- Under 5 seconds.
- Optional and completely ignorable — if someone never notices it, that's
  acceptable, not a failure.
- No popups, no achievements, no notifications, no text explaining it, no
  rewards, no gamification.
- Never breaks Scope's personality (`PERSONALITY.md`, `CONSTRAINTS.md`).
- Never announced or hinted at anywhere on the site. The moment it's
  documented publicly ("psst, wait a minute and something happens"), it
  becomes an Easter egg hunt, which this project explicitly rejects.

---

## Architecture

Three genuinely different *kinds* of moment fell out of the design pass,
and each has a different home:

- **`ambient`** — continuous modifiers, never "played," just read (time of
  day, season, scroll velocity, moon phase, cross-session drift). These
  don't trigger anything themselves; they're small pieces of shared
  context that the *existing* systems (mood selection, breathing rate, the
  idle-gesture scheduler) read from — the same way `SCOPE_IDLE_DURATION_BY_THEME`
  already varies one number by theme today.
- **`gesture`** — discrete, one-shot Scope behaviours (waking, a
  double-take, an anniversary, a patient settle, stillness). These plug
  into the *existing* autonomous idle-gesture scheduler
  (`use-scope-personality.ts`) as a rare, low-probability "first refusal"
  check — exactly the pattern already proven by `runLookAt`'s
  `ATTENTION_LOOK_CHANCE`. They must never invent a second, competing
  scheduling mechanism — the touch-interaction deadlock bug earlier in
  this project (a shared `timeoutId` two subsystems could each clear) is
  the concrete lesson for why ownership has to stay explicit.
- **`detail`** — non-Scope environmental moments (golden-hour light).
  Ordinary components elsewhere in the tree, reading the same shared
  ambient context. Scope isn't involved at all.

```
src/components/scope/living/
  living-context.ts     — the shared, computed-once-per-evaluation snapshot
                           (hour, season, visit count, first/last visit,
                           scroll velocity, tab visibility, moon phase...)
  living-memory.ts       — the one localStorage-backed store (visit count,
                           first-visit timestamp, last-visit timestamp) —
                           written once, read by every moment that needs
                           it, so no individual moment reimplements
                           persistence
  living-registry.ts     — an array of every registered moment; the ONLY
                           file that imports every moments/*.ts file, and
                           the ONLY file a new moment's addition ever
                           touches
  moments/
    time-of-day-drift.ts
    waking-gesture.ts
    returning-after-absence.ts
    first-visit-anniversary.ts
    seasonal-tint.ts
    patient-settle.ts
    scroll-velocity-mood.ts
    moon-phase.ts
    golden-hour-light.ts
    stillness.ts
```

Each moment file exports one small descriptor:

```ts
interface LivingMoment {
  id: string
  kind: "ambient" | "gesture" | "detail"
  isEligible(ctx: LivingContext): boolean   // cheap, synchronous, no side effects
  run(handle): void | Promise<void>          // only called if eligible
}
```

Adding a moment: one new file in `moments/`, one import line in
`living-registry.ts`. Nothing existing is opened. The registry — not any
individual moment — owns the shared guardrails every moment would
otherwise reimplement: a soft cap on how many rare moments can fire in one
session (so several don't stack and undercut the quiet feeling), and the
same "defer, never fight" coordination the idle scheduler already uses.

---

## Tier 1 — ship in v1

Foundational, cheapest, lowest-risk — together they establish every
pattern the rest of the roadmap reuses.

### 1. Time-of-day drift
**Kind:** ambient. **Trigger:** local hour, read once per session.
A continuous, small modifier — not a discrete moment. He shares your
clock, quietly, the way a real housemate does. Direct extension of an
already-shipped precedent (`SCOPE_IDLE_DURATION_BY_THEME` already varies
breathing pace by theme; this generalizes that mechanism to time of day).
Trivial to build, invisible by construction — nobody consciously watches
a breathing rate. Ships first because it establishes the "ambient
modifier" category everything else reuses.

### 2. First visit of the day
**Kind:** gesture. **Trigger:** localStorage last-visit-date ≠ today.
**Duration:** ~2–3s, once, at arrival. "He wakes up when you do" — a
slightly fuller rendition of his existing arrival settle, not a new
gesture vocabulary. Low complexity: one localStorage read/write, one
conditional on the existing arrival path.

### 3. Returning after a long absence
**Kind:** gesture. **Trigger:** localStorage last-visit gap exceeds a
threshold (e.g. 30+ days). **Duration:** <1s — a single distinct
"double-take" (brief widen + tiny head tilt) in place of whatever the
idle scheduler would have picked first. Reuses the exact `widen`/
`tiny-tilt` gestures already in the personality pool — a *selection*
rule, not new motion. Needs a restrained threshold: too eager (triggering
after a single day) reads as needy, directly against "Scope never asks
for attention."

### 4. The stillness moment
**Kind:** gesture. **Trigger:** sustained idle far beyond the ordinary
3–7s idle-gesture window. **Duration:** 2–3s of literal nothing
happening — no breathing variation, no gesture, just held stillness,
then an ordinary resume. Built entirely from *subtraction*, not
addition — the purest possible execution of "Scope never moves because
an animation was needed." Cheapest idea on the whole roadmap to build
(removing the idle-breathing loop briefly, not adding anything), and
carries essentially zero gimmick risk — there's nothing there to overdo.

---

## Tier 2 — over the first year

Need more design or tuning time, or are simply less urgent than Tier 1.

### 5. Seasonal palette micro-tint
**Kind:** ambient. **Trigger:** calendar date range (e.g. a ~2-week
window around a solstice/holiday). The season touches him too, without
him ever becoming a holiday mascot. **Watch this one:** it's the idea on
this whole roadmap most likely to get "enhanced" into something more
literal by well-meaning scope creep later (a small tint becomes a
snowflake, becomes a Santa hat). Hard rule at design time, not just
review time: the shift must be measured in the same units as the
existing dark/light theme palette shift — never a new color, never
literally seasonal iconography. `VISUAL_LANGUAGE.md`'s "never cartoon" is
the ceiling.

### 6. Golden-hour environmental light
**Kind:** detail. **Trigger:** local hour within a "golden hour" window.
The one idea on the whole roadmap that isn't about Scope's own behaviour
at all — the world he lives in breathes with the time of day. A CSS
gradient/light shift keyed to the hour; zero Scope-behaviour risk. Proves
the architecture can host non-Scope living moments, not just character
behaviour.

### 7. Patient-visitor rare settle
**Kind:** gesture. **Trigger:** unusually long continuous low-activity
dwell (well beyond the existing 3–7s window — think 45–60s+) while the
tab stays focused. **Duration:** 3–5s, a rare extended "settle," distinct
from the ordinary idle pool. A much rarer, much longer relative of
`PERSONALITY.md`'s own idle-behaviour philosophy ("every 8-15 seconds...
one noticeable but elegant behaviour"). Needs its own dwell-timer,
separate from and non-conflicting with the existing idle-gesture
scheduler.

### 8. Personal first-visit anniversary
**Kind:** gesture. **Trigger:** date diff since a once-ever-recorded
first-visit timestamp lands on a real anniversary. **Duration:** a few
seconds, once that day. The most personal moment on this roadmap — a
genuine relationship marker. Technically simple (date math); the real
difficulty is entirely in execution taste. Done well, this is the
strongest emotional beat available on the whole list. Done clumsily, it
reads as surveillance rather than recognition. Reserved for Tier 2
specifically so it isn't shipped before it's right.

---

## Tier 3 — rare, reserved for long-term visitors

### 9. Moon-phase rare marker
**Kind:** ambient/gesture (borderline). **Trigger:** pure date
arithmetic — moon phase is a deterministic formula, zero API, zero cost,
zero reliability risk. Roughly monthly at most (only near a full moon).
The real world outside the browser touches him, on a genuinely rare
cadence nobody can hunt for, since the trigger isn't tied to anything the
visitor did. The cleanest template for "very rare, reserved for patient
long-term visitors."

### 10. Cross-session familiarity drift
**Kind:** ambient. **Trigger:** persistent visit-count threshold,
nudging his travel physics (`springs.companion`) marginally more
confident over many visits. A genuine complement to the already-shipped
*session-scoped* touch "trust" progression — same emotional idea, a much
longer timescale. **This is the idea I'm least confident shipping well on
a first attempt:** too subtle and nobody ever perceives it (wasted
effort); too obvious and it reads as "leveling up," which is
gamification by another name. Belongs in Tier 3 specifically so there's
no pressure to ship it before real observation time with real returning
visitors informs the tuning.

### 11. Scroll-velocity mood inflection
**Kind:** ambient. **Trigger:** a new signal — scroll velocity between
sections — feeding into mood selection at arrival (fast/rushed scrolling
reads as a touch more alert; slow/lingering stays calmer). Extends the
existing "mood reflects context" system with one legitimate new input.
Real risk of feeling erratic/buggy if the velocity math is noisy — needs
actual tuning time with a real person scrolling, not just code review.
Lower priority than moments that give a visitor something to notice (even
unconsciously) — this one is a refinement, not a discovery.

---

## Cut

### Weather-influenced curiosity
The idea: rain nudges idle "look around" gestures slightly more frequent,
or dims his glow a touch. Genuinely charming in concept, but the
infrastructure cost is completely out of proportion to the payoff — a
third-party weather API dependency, an ongoing reliability/cost surface,
and either a permission-prompting geolocation call (itself a form of
"asking for attention," directly against canon) or a quieter but still
real IP-geolocation privacy question. The payoff is only ever perceptible
to a visitor in the right weather, at a moment they weren't going to be
told about anyway. Not on the roadmap unless a genuinely zero-dependency
signal for weather ever exists.

### Not a Living Moment at all
"The notebook quietly gaining a real entry over time" isn't a system to
build — `notebook-content.ts` already supports editing copy trivially.
That's an editorial habit, not architecture, and doesn't belong in this
file as a numbered idea.

---

Update this file whenever a Living Moment ships or a new one is designed —
it should always read as a snapshot a future session can trust without
re-deriving the reasoning above.
