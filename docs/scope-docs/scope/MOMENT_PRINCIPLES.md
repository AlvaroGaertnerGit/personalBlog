# Living Moment Principles

Version: 1.0

`LIVING_SCOPE.md` defines the architecture a moment plugs into and the
hard constraints every moment must satisfy (under 5 seconds, optional,
no gamification, never announced). This document is about the *craft* of
a moment once it already satisfies those — the difference between a rare
behaviour that lands and one that quietly reads as a bug or, worse, a
gimmick.

---

## Pacing

A Living Moment has no urgency. It's the one place in the entire
interaction vocabulary where "slow" is never wrong. Compare the touch
interaction's own progression: stage 0 resolves in under a second, stage 2
(the stretch) takes nearly two — the *pacing itself* communicates
increasing trust; a visitor never reads the numbers, but a stretch that
rushed would communicate excitement, not comfort.

**Get this wrong by:** compressing a moment's timing to "fit" a design
review's patience. If a moment feels rushed in a design meeting, that's
information about the reviewer's attention span, not the moment's correct
pacing.

## Rarity

Rarity is not a probability tuned to feel "not too often" — it's a
reflection of how significant the underlying cause actually is.
`LIVING_SCOPE.md`'s moon-phase marker is monthly because a full moon
*is* monthly; the personal first-visit anniversary is yearly because an
anniversary *is* yearly. Never pick a rarity number by feel and then
invent a justification for it after the fact — find the real-world cadence
of the cause first, and let that set the rarity.

**Get this wrong by:** a moment that's technically "rare" (say, 2% chance
per idle cycle) but has no real-world referent for that number — it will
eventually happen at an arbitrary, meaningless moment, which reads as a
glitch, not a discovery.

## Discoverability

A moment should be findable only by the kind of attention that would
naturally find it — patience, a return visit, being present at the right
hour — never by hunting. There is no acceptable version of "check the
console," "try clicking ten times," or any mechanic that turns discovery
into a puzzle. If finding a moment requires *effort* rather than
*attention*, it has become an Easter egg, which `LIVING_SCOPE.md`
explicitly forbids.

**Succeeds:** the patient-visitor rare settle — found only by someone
already giving the page sustained attention, which is exactly the
audience it's for.

**Fails:** anything that would show up in a "hidden features of this
website" listicle. If a moment is describable as a trick, it's already
failed this principle, regardless of how it was built.

## Emotional impact

The target feeling is recognition, not surprise. "Oh — he noticed" reads
correctly; "whoa, what was that" does not. A Living Moment that produces
genuine startle has overshot — startle is a performance-scale reaction,
and nothing in this canon should ever produce one.

## Subtlety

If a moment needs to be pointed out to be appreciated, it's not subtle
enough yet, no matter how quiet the animation numbers look on paper.
Subtlety is a property of the *whole experience* — including timing,
context, and whether anything else is competing for attention in that
moment — not just of amplitude. A perfectly small gesture played at the
wrong moment (mid-scroll, while a visitor is reading) can still read as
loud; the same gesture during a genuine pause reads as quiet.

## Timing

A Living Moment must never compete with something the visitor is actively
doing. This is why the touch interaction's cooldown exists structurally
(a moment can't start while another is mid-flight), and why the idle
scheduler defers to genuine cursor/keyboard activity rather than
interrupting it. A moment's trigger condition should always include, at
minimum, "and nothing else is currently happening."

## Silence

Silence is not the absence of a moment — it can *be* the moment.
`LIVING_SCOPE.md`'s "stillness" idea (Tier 1) is built entirely from
removing motion rather than adding it, and it's listed as carrying
essentially zero gimmick risk for exactly that reason: there's nothing to
overdo when the entire effect is restraint. Before adding motion to
express an idea, ask whether *removing* motion would express it better.

## Anticipation

The gap before a moment matters as much as the moment itself. The
Contact sequence's "held pause — let the moment breathe" before the clip
releases is the same principle already proven at full narrative scale;
a Living Moment's own brief anticipation (even a few hundred milliseconds
of stillness before a gesture begins) is what separates "he decided to do
this" from "an animation started."

## Restraint

The standing tie-breaker whenever two versions of a moment are both
defensible: pick the smaller one. Every example above resolves to the
same instruction — when unsure whether a moment is big enough to be
noticed, make it smaller, not bigger. A moment nobody ever notices has
cost nothing. A moment that oversteps has cost the one thing this entire
canon protects.

---

## Two moments, compared

**Succeeds:** "returning after a long absence" — caused (a real gap in
continuity), rare (only past a real threshold), discoverable only by the
visitor's own return (no hint, no prompt), proportionate (a single
double-take reusing existing gestures), silent about itself.

**Would be gimmicky:** a version of the same idea that displayed "Welcome
back!" text, or that escalated the reaction based on how long the gap was
(a bigger animation for a longer absence), or that repeated on every
subsequent visit rather than settling back into ordinary behaviour. Same
underlying cause, but each of those additions converts a behaviour into a
feature — exactly the distinction `DESIGN_FILTER.md` exists to catch
before any of them get built.
