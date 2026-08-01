# Scope Behavioural Canon

Version: 1.0

The ultimate behavioural reference. Every principle below is stated, then
justified, then made concrete with a real example of getting it right and
a real example (mostly drawn from this project's own history — rejected
ideas, reverted decisions, corrected first attempts) of getting it wrong.
If a new idea can't be checked against at least one of these, it probably
isn't a Scope behaviour yet — see `DESIGN_FILTER.md` for the pass/fail
version of this document.

---

## Scope never performs

**Why:** `SCOPE.md` states this as the single organizing rule of his
existence: "Scope should never perform animations. Scope should perform
behaviours." A performance is scheduled because a designer wanted a beat
there. A behaviour has a cause a visitor could, in principle, point to.

**Correct:** the Contact section's letter-arrival redesign (`SPR-009.5`)
was rebuilt specifically because the original version — a plain glide —
read as "physically correct, but predictable and slightly mechanical." It
was replaced with light reaching from Scope's own side, reusing his
already-canonical glow rather than inventing a new effect. The fix was
never "make it flashier" — it was making the *cause* legible again.

**Incorrect:** the original touch-interaction brief asked for Scope's eyes
to become literal upside-down crescents at the stretch's peak — a
performance-grade expression borrowed from cartoon shorthand, not
anything his own eye vocabulary (a single pill shape, expressive only
through height and gaze) had ever done. Rejected in favor of pushing the
*existing* squint further than any other gesture — see `CONSTRAINTS.md`'s
"never a curve, a star, or any other shape swap" and the saved project
memory on this exact decision.

---

## Scope never asks for attention

**Why:** `PERSONALITY.md`: "Scope never steals attention. The portfolio is
the hero." An interaction that visibly campaigns to be noticed —
animating harder when ignored, escalating until it's seen — inverts this
completely.

**Correct:** the touch interaction is invisible until found. No hover
affordance, no cursor change on Scope's own shapes (`scope.tsx` explicitly
omits `cursor: pointer` "on purpose — a hand cursor would read as
'clickable UI'"). If nobody ever clicks him, nothing is lost; the moment
exists for whoever finds it, not to recruit people who haven't.

**Incorrect:** any moment that grows more noticeable the longer it's
ignored (a brighter glow, a bigger gesture, anything that reads as "please
look at me") is exactly backwards. Living Moments are asked to be
"completely ignorable" for precisely this reason (`LIVING_SCOPE.md`).

---

## Scope reacts

**Why:** Every meaningful thing Scope does should be a response to
something that actually happened, not a self-initiated event dressed up
as a reaction.

**Correct:** the touch interaction's three stages exist only because the
visitor did something (clicked). The `"happy"` mood at Contact's accept
beat plays only once the letter has genuinely, physically arrived at his
position — verified via an instrumented trace in `SPR-009.3` specifically
to prove "Scope reacts to the completed letter, never the click."

**Incorrect:** the theme-transition curtain sequence commandeering his
mood is the *narrow*, justified exception (an external orchestrator, used
exactly twice in the whole codebase) — it is not a template. A new
interaction that changes Scope's state because a timer elapsed, with no
world-event behind it, is not a reaction; see "the world does not
randomly animate itself," below.

---

## Scope observes

**Why:** `PERSONALITY.md`: "It doesn't teach. It discovers alongside you."
Observation is his default posture, not a fallback for when nothing else
is happening.

**Correct:** `attentionTarget` (SPR-005) lets Personality occasionally
glance toward a registered point of interest (a project's bouncing ball, a
graph's traced point) — a small, real act of noticing something in the
room, timed into the exact same idle-gesture rhythm as everything else,
never a scripted cue.

**Incorrect:** a mechanism that has Scope stare fixedly at whatever the
visitor is doing (mouse position, active input field) as a persistent,
unbroken lock reads as monitoring, not curiosity. Presence's cursor gaze
is already deliberately soft — lagging, jittering, never a precise lock —
for this exact reason.

---

## Scope is curious

**Why:** `SCOPE.md`: "Scope is the physical manifestation of curiosity."
Curiosity implies *interest*, not vigilance — a glance, not a stare; a
tilt, not a fixation.

**Correct:** `glance-left`/`glance-right`/`tiny-tilt` in the personality
pool — small, quick, resolving back to neutral on their own. Curiosity
that finishes.

**Incorrect:** curiosity that escalates or persists (an idle gesture that
holds until something happens, or repeats until acknowledged) stops being
curiosity and becomes a request — see "never asks for attention," above.

---

## Scope is patient

**Why:** `PERSONALITY.md`: "Nothing about Scope is rushed. Its presence is
relaxing." Patience is also the entire premise of the touch interaction's
progressive trust — each stage exists specifically *because* it isn't
instant.

**Correct:** the touch interaction's three-click progression, and the
Tier 2 "patient-visitor rare settle" Living Moment (`LIVING_SCOPE.md`),
both reward sustained, unhurried presence without ever rushing to reveal
themselves.

**Incorrect:** any moment gated on rapid or repeated action (spam-clicking,
fast scrolling to "unlock" something) rewards impatience instead — the
opposite value from the one being designed for.

---

## Scope changes the world

**Why:** `VISUAL_LANGUAGE.md` gives him exactly one established channel
for this: "extremely subtle atmospheric purple only when interacting with
the environment," and separately, warm light as his "primary signal."
Until `SPR-009.5`, this line was mostly decorative — the Contact
redesign is the first time it was actually *used* narratively (his glow
visibly reaching toward the letter before it arrives, establishing him,
not a generic transition, as the cause).

**Correct:** the light-arrival redesign — his warmth visibly changes the
letter's own material before it's accepted, using a channel that already
existed rather than inventing a new one.

**Incorrect:** giving Scope a new form of environmental influence (a
particle trail, a force field, a beam) to make a future moment more
legible is adding a *power*, not reusing his one established one — this
is the exact tension resolved in the crescent-eyes decision, generalized:
when a new idea needs Scope to affect the world in a way he's never
affected it before, that is a canon change, not an implementation detail,
and needs to be flagged and decided explicitly, not built quietly.

---

## The world does not randomly animate itself

**Why:** the necessary complement to the rule above. If Scope changing
the world is meaningful specifically *because* it's rare and caused, then
objects that animate on their own, unprompted, cheapen every one of his
own caused moments by putting them in the same visual register as
decoration.

**Correct:** the Contact letter's clip, pen, and paper are all
present-but-inert until a real cause (submission) sets them in motion —
"meaningless while writing, suddenly meaningful the moment it releases."
Nothing on that desk moves on a timer.

**Incorrect:** an idle ambient animation on a prop (the notebook's pages
riffling, the desk's paper fluttering) with no connection to Scope at all
was explicitly considered and rejected during the Contact redesign
(`SPR-009.5`'s Concept 3, "the paper's ambient motion stills under his
attention") specifically because it required a *persistent*, uncaused
flutter to exist at all — exactly this rule, applied prospectively.
