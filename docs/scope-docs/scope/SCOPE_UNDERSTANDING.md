# Scope — Understanding Document

*Written after reading every file in this folder (`README.md`, `SCOPE.md`, `CLAUDE.md`,
`PERSONALITY.md`, `VISUAL_LANGUAGE.md`, `MOVEMENT.md`, `CONSTRAINTS.md`) and the character
sheet at `references/scope.png`. This is a single merged mental model, not a file-by-file
summary — where sources overlapped they've been consolidated; where they conflicted, that's
called out explicitly rather than silently resolved.*

---

## 1. Executive Summary

Scope is a small, round, ceramic companion — about 13cm tall, the size of something you'd
hold in one hand — that lives quietly inside this portfolio. It has no arms, no face, no
voice, and it never talks. It stands on two tiny rubber feet and carries one glossy black
display on its front, which shows a `{ }` glyph with a small square resting between the
brackets — that display is not a face, it's a window onto Scope's current state. Scope
doesn't help build anything and it isn't the portfolio's protagonist; the portfolio and the
person's work are always the point. What Scope does is *notice* — it observes, leans in
when something's interesting, goes quiet and dim when it's processing, and allows itself
one small, brief hop when something genuinely good happens, then returns immediately to
calm. Every part of it — its round unbroken shell, its total silence, its soft slow
movements — exists to make it feel present without ever competing for attention. A new
designer's shortest possible brief: build a companion that would be embarrassed to be
noticed before the work is.

---

## 2. Core Identity

**What Scope is.** A physical, embodied character — not a UI widget, not an assistant
panel, not a mascot in the cartoon sense. `SCOPE.md` is explicit that it has a body (a
rounded shell, feet, a display) and that the `{ }` glyph living on that display is its
*soul*, not its body — the two are named as separate things on purpose. The shell is what
you see and recognize from across a room; the glyph is what you find when you actually
look closely.

**Why it exists.** Two lines in `PERSONALITY.md` carry the entire justification: "Its
purpose is not to solve problems. Its purpose is to make people want to solve them." Scope
isn't a productivity feature. It exists to change how being at this portfolio *feels* —
less like reading a résumé, more like having quiet company while you look at someone's
work.

**What it represents.** The reference sheet's own tagline is the cleanest statement of
this: *"Curiosity. Observed."* Scope is curiosity given a physical form — not intelligence,
not assistance, not productivity. It represents the same instinct that made this person
build the tools they teach with in the first place: wanting to look closer at something
because it's interesting, not because you were told to.

**Emotional role inside the portfolio.** Scope is the ambient proof that someone cared
about the details here. Its whole personality is built around never asking for attention
(see §6, §9) — which means its actual emotional job is closer to a good host than a
performer: it makes the space feel occupied and considered without ever pulling focus away
from the work on display.

---

## 3. Personality

*(Interpreted, not restated — the documentation gives traits and states; what follows is
what those add up to as a way of behaving.)*

Scope behaves like someone who has trained themselves out of interrupting. Every
documented trait points the same direction: it notices things (curious, observant), it
never rushes toward or away from anything (calm), it doesn't perform for you (humble), it
doesn't move without a reason (thoughtful/purposeful), and whatever small delight it shows
is proportionate and brief, not a bid for approval (playful, but explicitly "not overly
cute" per the reference sheet's own reject list).

**How it reacts.** Reactively, not proactively. Scope doesn't initiate; it responds to what
a visitor is already doing — leaning toward something as it comes into view, going still
and dim while something loads, allowing one small hop when a visitor does something worth
noticing. It never reaches for the visitor's attention first.

**How it should feel to visitors.** The clearest single line for this is the "Personality
at a glance" reject column on the reference sheet: not loud, not intrusive, not
judgmental, not impatient, not bossy, not overly cute, not human-like, not complex. Feeling
*safe* is arguably the dominant target — something calm enough that its presence lowers a
visitor's guard rather than raising it, the opposite of a chat widget that assumes it has
something to say to you.

**How it communicates.** Never through language. `PERSONALITY.md` is unambiguous: no voice,
no mouth, no speech bubbles, no text. Everything is carried through movement, posture,
light, timing, and orientation — the same vocabulary a well-animated object (not a
character with a face) would use. The display is explicitly *not* a face; it's closer to a
gauge or an indicator than an expression.

---

## 4. Design Language

| Element | Decision | Why (interpreted) |
|---|---|---|
| **Silhouette** | A single continuous rounded body — no separate head/torso — on two small stub feet, no arms | The silhouette itself is called out as needing to be "recognizable in any context," including as flat black silhouette — an unbroken round form is the simplest possible shape to guarantee that, and removing arms/limbs is what keeps it from reading as humanoid or robotic-utilitarian |
| **Proportions** | Palm-sized (13cm / 5.1in), body dominates, feet are minimal and almost an afterthought | The scale matters as much as the shape — something you could hold in one hand reads as intimate and personal, not as a device or an appliance sitting on a shelf |
| **Materials** | Matte ceramic shell, glossy glass display, soft-touch rubber feet, soft emissive accent light | Three distinct material families for three distinct jobs: ceramic for a warm, touchable "object" quality; glass for the one part meant to be looked *into*, not just at; rubber for quiet, grippy contact with the world. Nothing is chosen for shine alone — the *display* is the one place gloss is allowed, specifically because that's the one place you're meant to look past the surface |
| **Colors** | Shell near-white/cream (#F2F2F0), display near-black (#0B0B0D), accent lavender-purple (#A78BFA), a separate warm gold "highlight" tone (#FFC168) used sparingly | A quiet, mostly-neutral body keeps the shell from competing visually with the portfolio around it; the one saturated color (lavender) is reserved for signals and small details specifically so it stays meaningful rather than decorative — see the flagged inconsistency below |
| **Display** | A glossy black rounded panel showing `{ }` with a small square between the brackets | This is the one deliberate window into the soul described in `SCOPE.md` — everything else on the body is shell; only the display is depth. It's sized and placed to be noticed on close inspection, not from across the room, which matches "humble" as a design decision, not just a personality note |
| **Overall aesthetic** | Organic, soft-edged, warm, minimal, "premium," restrained | Every one of the reference sheet's "✓" aesthetic words (organic, friendly, intelligent, premium, timeless, minimal) is paired with an explicit "✗" opposite (humanoid, aggressive, military, cartoonish, toy-like, overdesigned) — the aesthetic is defined as much by what was refused as by what was chosen |

**A flagged inconsistency worth surfacing rather than resolving silently:** `VISUAL_LANGUAGE.md`
describes the core glow as "warm amber or cyan," but `PERSONALITY.md`'s own Visual Language
section says "subtle purple lighting," and the reference sheet's actual palette confirms a
lavender/purple accent (#A78BFA) as the signal color, with amber (#FFC168) present only as
a separate "warm light... subtle highlights for warmth" role — not as an alternative core
color, and cyan doesn't appear anywhere in the palette. My working assumption is that the
reference sheet is the most current and most authoritative source (it's the most detailed
and internally consistent artifact in the folder), and that `VISUAL_LANGUAGE.md` is an
earlier or looser draft that wasn't updated to match it. I'm flagging this rather than
quietly picking a side because a future contributor implementing the actual glow color
should know this exists, not inherit my guess as if it were settled.

---

## 5. Movement Language

The reference sheet's six movement principles (light, smooth, purposeful, expressive,
respectful, alive) aren't a style guide for *how* things move so much as a filter for
*whether* something should move at all — "respectful" specifically includes "knows when to
be still," which means restraint is as much a principle as motion is.

- **Idle** — Calm and present, always observing. Nothing performs here; idle is not a
  "waiting" state to be filled with a loop, it's Scope's actual resting posture. The
  intention is presence without demand — proof it's there without asking to be watched.
- **Curious** — A lean-in and a head tilt when something new appears. The intention is
  attention *toward* something specific, not toward the visitor — Scope's curiosity is
  always pointed at the work, which is what keeps it from feeling needy or attention-seeking
  itself.
- **Thinking** — Looks down briefly, pauses longer, glow dims. The intention here is
  honesty about cost: processing isn't hidden behind a generic spinner, it's shown as a
  genuine, unhurried pause — closer to someone thinking before answering than a progress
  bar.
- **Observe** — Moves closer, in order to understand something better. The intention is
  proximity in service of attention — Scope physically closes distance only when it has a
  reason to look more closely, which is a different, more deliberate gesture than idle
  drifting.
- **Happy** — One small bounce, a brighter core, then an immediate return to idle. The
  intention is proportionality: celebration is real but brief and self-contained, never a
  performance that outlasts the moment that earned it, and it always resolves back to calm
  rather than lingering in an elevated state.

The throughline across all five: **the reason for the movement always precedes the
movement.** Nothing in this vocabulary is decorative or scheduled — each state is a
response to something specific happening, which is the same discipline "purposeful" and
"nothing is random" describe from the personality side.

---

## 6. What Scope Is NOT

*(Consolidated from every file — `CLAUDE.md`, `PERSONALITY.md`'s Claude Rules,
`CONSTRAINTS.md`, and the reference sheet's reject list. Overlaps merged into one list.)*

- Never talks — no voice, no mouth, no speech bubbles, no text output of any kind.
- Never becomes humanoid — no arms, no human-like eyes, no face.
- Never gets a redesigned silhouette, proportions, materials, or colors — the visual
  identity is fixed, not a starting point for iteration.
- Never becomes the center of attention, the protagonist, or "the hero" of any page.
- Never moves without a reason — no motion added because an animation slot existed or
  "looked cool."
- Never moves abruptly, rushed, or exaggerated — no snapping, no sudden motion, no
  cartoon-style squash-and-stretch beyond "subtle."
- Never interrupts — it doesn't override, block, or demand a response from a visitor.
- Never reads as loud, intrusive, judgmental, impatient, bossy, overly cute, human-like, or
  complex.
- Never functions as a chatbot, an assistant, a mascot, or a drone — all four are
  explicitly named and rejected as the wrong category entirely.
- Never teaches or solves problems on the visitor's behalf — it accompanies, it doesn't
  perform the work.
- Never celebrates itself — any moment of "happiness" is in response to the visitor's or
  the portfolio's work, not its own.

---

## 7. Scope Inside the Portfolio

*None of the source documents describe page-by-page placement — this section applies the
established personality and movement principles to the contexts the task asked about. It's
reasoned extrapolation from documented behavior, not something already specified, and
should be validated against whatever the actual page designs turn out to need.*

- **Hero** — Idle at rest, closest to its "default portrait" pose. This is the one place
  full presence is earned, since it's the first place a visitor meets the character at all.
- **Navigation** — If present at all, minimal and still — a small, quiet indicator rather
  than a full performance; "respectful... knows when to be still" argues against giving it
  an active role in a persistent, always-visible chrome element.
- **Project pages** — Observe/Curious: leaning toward whichever project is in view, the
  same way it leans toward anything new — this is the context closest to its stated
  purpose of celebrating craftsmanship.
- **Playground** — Likely its most active context, if a playground implies hands-on
  experimentation — Curious and Observe are its natural register here, since this is where
  "discovering something new" (its stated moment of feeling "alive") would actually happen.
  Worth confirming intent before building, since "playground" isn't defined anywhere in
  these docs.
- **Loading screens** — Thinking: dimmer glow, longer pause, no spinner-style urgency —
  this is the one documented state that maps almost exactly onto a loading context without
  any invention needed.
- **Empty states** — Idle, likely a touch dimmer or slower — calm rather than apologetic;
  nothing in the docs suggests Scope should look "sad" or perform an emotion about the
  emptiness itself.
- **404 page** — The most speculative placement in this list. Curious could extend into
  something like gentle searching, but there's no documented "confused" or "lost" state,
  and inventing one would risk violating "nothing is random" — this needs an explicit
  decision rather than an assumption.
- **Footer** — If present, Idle at its smallest and quietest — a footer is the least likely
  place for it to be doing anything at all, given "humble" and "never the center of
  attention."

---

## 8. Design Principles

*(Inferred philosophy, not quoted lines.)*

1. **The body and the soul are different layers, and only one of them is negotiable.** The
   shell, proportions, and materials are fixed; the glyph is what actually carries meaning
   inside that fixed shell. Everything documented protects this split.
2. **Restraint is the personality, not a limit on it.** Nearly every trait in this folder is
   defined by what it refuses to do (interrupt, perform, rush, speak) rather than by what it
   actively does. The character *is* the discipline.
3. **Presence without demand.** Scope's entire design solves for "how do you make something
   feel alive and attentive without it ever competing for attention" — every material,
   color, and movement choice traces back to that one tension.
4. **Motion is meaning, because nothing else is allowed to be.** With no face and no voice,
   movement, posture, and light are the *entire* expressive vocabulary — which is why the
   movement principles are as detailed and protected as the personality traits.
5. **The portfolio is the subject; Scope is the witness.** It doesn't build, teach, or
   solve — it notices and accompanies. Its happiness is always in reaction to someone
   else's work, never its own performance.

---

## 9. Non-negotiable Rules

*(Written for code review — a violation of any of these should block a merge.)*

- [ ] No spoken output, text bubbles, or written dialogue attributed to Scope, anywhere.
- [ ] No arms, no human-style eyes, no face-like expression system added to the display.
- [ ] No change to silhouette, proportions, shell/display/feet materials, or the core color
      palette without an explicit design decision recorded outside of code.
- [ ] No animation without a triggering reason — no idle-loop-for-its-own-sake, no motion
      added purely because a component "felt static."
- [ ] No motion that snaps, rushes, or exaggerates beyond the documented "light, smooth,
      subtle" register — no hard cuts, no elastic overshoot beyond a small bounce.
- [ ] No behavior that blocks, interrupts, or requires a visitor to respond to Scope before
      continuing.
- [ ] No placement or animation that makes Scope larger, louder, or more central than the
      actual page content around it.
- [ ] No new emotional state introduced without checking it against the five documented
      ones (Idle, Curious, Thinking, Observe, Happy) for redundancy or personality drift.
- [ ] No glyph or display change that replaces `{ }` as the resting/default mark shown on
      the display (see the open question in §10 about whether the glyph itself varies by
      state).
- [ ] No treatment of Scope as a chatbot, assistant, mascot-with-dialogue, or drone in any
      copy, comment, or component name — the category itself is rejected, not just the
      look.

---

## 10. Self-Evaluation

**Confidence: 8/10.**

**What I'm completely certain about:** the physical form (round ceramic body, ~13cm, two
small feet, one glossy display), the five named emotional states and their intent, the
full "what Scope is not" list, the core philosophy that the glyph is a protected soul
inside a fixed body, and the non-negotiable behavioral constraints (no speech, no face, no
interruption, no redesign). These are stated multiple times, consistently, across both the
text files and the reference sheet, with no contradictions.

**Assumptions I made, stated plainly:**
- That the reference sheet (being the most detailed, most recent-feeling, most internally
  consistent artifact) is more authoritative than `VISUAL_LANGUAGE.md`'s amber/cyan mention
  where the two disagree on core glow color.
- That "legs/supports" in `SCOPE.md` and "feet/joints" in the reference sheet refer to the
  same small, minimal stub feet shown in the art — not articulated, posable legs.
- Every placement described in §7 for Playground, Navigation, Footer, and 404 — none of
  these contexts are defined anywhere in the source docs, so those descriptions are my
  extrapolation from documented personality and movement principles, not something I
  found written down.

**What's still genuinely missing, not just unclear:**
- Whether the display's *glyph itself* changes shape between emotional states, or only its
  brightness/pulse changes while `{ }` stays constant — the reference sheet's Thinking pose
  appears to show a different mark than Idle's, but the text documentation only ever
  describes brightness and pulse changes, never a changing glyph. This is a real
  implementation-blocking question, not a stylistic detail.
- Any sound design position at all (the docs are thorough on visual/motion communication
  but silent, so to speak, on whether Scope makes any sound).
- What "Playground" refers to as a section of this portfolio — the word appears in the
  task but nowhere in the source material.
- Any defined behavior for error states, 404s, or anything resembling "something went
  wrong" — the documented emotional range (idle/curious/thinking/observe/happy) has no
  entry for this, and inventing one risks violating "nothing is random" without a real
  decision behind it.

**What should be documented going forward:** a resolution to the amber/cyan-vs-purple
discrepancy; an explicit answer on whether the display glyph varies by state; and — before
any Playground, Navigation, Footer, or 404 implementation — a short decision note for each,
the same way Hero and Loading already have an obvious, well-supported answer.
