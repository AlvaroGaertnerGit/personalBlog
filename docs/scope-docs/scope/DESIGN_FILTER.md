# The Design Filter

Version: 1.0

Every future Scope interaction — a Living Moment, a new section's dock, a
one-off refinement — passes through this before a line of code is
written. It is a gate, not a suggestion: if an idea fails a question
below, it gets redesigned or dropped before implementation starts, the
same way `tsc`/`lint` gate a PR before review does.

This is deliberately built as a sequence, not a checklist to satisfy in
any order — later questions assume earlier ones already passed.

---

## 1. Does this feel earned?

Would this moment exist without whatever specifically caused it? If the
answer is "no, it needs that cause" — pass. If the moment would look
identical whether or not anything actually happened first, it's decoration
wearing a justification.

*Worked example:* the touch interaction's "quiet laugh" (stage 2) is
earned — it only exists because two prior clicks already happened. A
random, unprompted "quiet laugh" playing on its own idle timer would fail
this question immediately, even though it's the exact same animation.

## 2. Would Scope actually do this?

Not "would this look good on Scope" — would *this specific character*,
as described in `SCOPE.md`/`PERSONALITY.md` (curious, gentle, patient,
never funny, never loud, never childish), plausibly do it. Read the
"Scope is never" list in `SCOPE.md` literally here.

*Worked example:* a bigger, more obviously "surprised" reaction to a first
touch was on the table early in that feature's design. It was walked back
to something "very subtle" specifically because a startled flinch reads
as more reactive/dramatic than this particular character would ever be.

## 3. Is the visitor observing Scope, or triggering an animation?

If removing all of the visitor's own agency from the description still
leaves something that makes sense ("Scope glances left occasionally"),
it's a behaviour. If the description only makes sense as an instruction
("clicking here plays X"), rewrite it until it reads the first way before
implementing anything.

*Worked example:* "clicking Scope plays a stretch" is the instruction
framing. "Scope, once comfortable, lets himself stretch" is the same
mechanism, described as something happening to be observed rather than
triggered. If a proposal can only be described the first way, it needs
more causal grounding, not more polish.

## 4. Does this reinforce an existing trait, or invent a new one?

Check the new idea against `SCOPE.md`'s personality list (curious, gentle,
quiet, patient, observant, innocent, calm) and `BEHAVIOUR.md`'s expanded
canon. A new moment should be a fresh *expression* of a trait already on
that list, never a trait not currently there.

*Worked example:* "cross-session familiarity drift" (`LIVING_SCOPE.md`
Tier 3) reinforces patience and observance over a longer timescale — nice,
because it's the same trait already established, just at a new scope. A
hypothetical "Scope gets bored and stops reacting if ignored too long"
would invent something closer to moodiness or resentment — not on the
list, reject outright regardless of how technically clever it is.

## 5. Does this require Scope to affect the world in a way he's never
   affected it before?

Per `BEHAVIOUR.md`'s "Scope changes the world" — his one established
channel is warm light/glow. A new idea that needs a beam, a force, a
particle effect, a new color entirely, or any other new form of
environmental influence is a canon change, not a feature. Flag it
explicitly and get it decided before writing code — do not quietly expand
his abilities to make an idea easier to build.

## 6. Is this reversible/ignorable with zero trace?

If a visitor never notices this moment, is anything different about their
experience of the site? The correct answer is always no. If skipping the
moment leaves a gap, a missing acknowledgment, or an incomplete-feeling
interaction, it has drifted from "ignorable" toward "expected," which is
a UI affordance wearing a Scope costume.

## 7. The one question that ends the filter

If, at any point while answering the above, the honest justification for
a detail becomes **"because it looks cool"** — reject it. Not "simplify
it" or "tone it down." Reject it, and either find the real cause that
would justify it, or drop it entirely. This is the one rule every other
question in this file exists to catch violations of before they're ever
written into code.

---

## Using this filter

Run a new idea through questions 1–6 in order. The moment any answer is
"no" or "it needs a new ability Scope doesn't have," stop and redesign
before continuing to the next question — don't finish the checklist on a
version of the idea you already know has failed. Question 7 is a final
gut check applied to whatever survives, not a formality at the end.

If an idea passes all seven, it's ready for the same process every shipped
Scope feature in this project has already gone through: a plan reviewed
before code, verification after, and a canon check against this file and
`BEHAVIOUR.md` before it's considered done.
