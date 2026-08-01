# Scope's World

Version: 1.0

A design document, not a story. The goal is a mental model precise enough
that a future developer can answer "would this make sense in Scope's
world?" without asking anyone.

---

## Where does Scope exist?

Not "the web." Not "the browser." This portfolio, specifically — a single
continuous place he has always lived in, made of rooms.

Every section of the site (Hero, About, Projects, Notebook, Contact) is a
**room**, not a slide, not a page, not a level. `companion-scope.tsx`
already encodes this literally: there is exactly one `<Scope>` instance for
the whole site, positioned absolutely inside one shared `stageRef` that
spans the entire page. He does not get re-created per section. He *walks*
there — the heavy, deliberate `springs.companion` travel between docks is
not a transition effect, it is him moving from one room of his own home to
another. The visitor scrolling is not "loading the next screen." It's
walking with him through the house.

This is the test for any new section or any new prop: **does it have a
place in this house, or is it a slide bolted onto the outside of it?** If
a new piece of content can't be given a dock, a resting posture, and a
reason Scope would ever be near it, it doesn't belong in his world at all
— it's fine as ordinary page content, but Scope should have no opinion
about it.

## Is the browser his home?

No — this specific portfolio is. The distinction matters: "the browser" is
infrastructure; "this house" is a place with furniture that predates the
visitor's arrival and will still be there after they leave. The desk in
Contact and the notebook in Open Notebook are not scenery generated for
the visitor's benefit. They're things that already existed in the room
before anyone scrolled to it — the visitor is the one arriving into an
already-furnished world, not the other way around.

## What happens when nobody is looking?

The existing architecture already answers this precisely, and the answer
should stay exactly this literal:

- While the browser tab is visible, Scope's autonomous idle behaviour
  (`use-scope-personality.ts`) runs continuously, completely independent
  of whether the cursor is anywhere near him. This is deliberate and
  already correct — Presence (cursor gaze) and Personality (autonomous
  behaviour) are two separate layers precisely so that his life doesn't
  depend on being watched by a pointer. He isn't performing for the
  cursor; the cursor is just one more thing in the room he occasionally
  notices.
- The moment the tab is backgrounded (`visibilitychange`), the scheduler
  stops entirely. This is not "he freezes mid-gesture and waits" — the
  correct mental model is that **the room goes dark**. There is nothing to
  observe, so nothing happens, and nothing needs to resume from where it
  left off when the tab returns; he simply picks his idle rhythm back up,
  because from his own perspective no time of significance passed.
- This is *why* "returning after a long absence" (`LIVING_SCOPE.md`) is a
  real, distinct moment and ordinary tab-switching is not: a few minutes
  backgrounded is the room going dark and lighting back up — nothing
  happened. Weeks of absence is different in kind, not degree — that's a
  real gap in the world's own continuity, which is the one thing worth a
  small, genuine reaction.

## Why does the notebook exist?

It isn't Scope's. It belongs to the person whose portfolio this is — his
actual research notes, framed from the section's own copy as something
the visitor "wasn't supposed to see." Scope has a dock there and attends
it quietly, the same as any other room, but he didn't write it and has no
authorship over it. This matters as a standing principle, not just a fact
about one section: **not everything in Scope's world is about Scope.**
`PERSONALITY.md` already says this ("Scope doesn't help... celebrates
*your* work... never the protagonist") — the notebook is the clearest
physical proof of it. A future room can contain things that are simply
*there*, that Scope is a quiet guest around, not the owner or narrator of.

## Why is there a desk?

Because the Contact section's letter needed somewhere physical to rest,
and Scope needed a stable place to receive it. The desk is not decoration
added because a "workspace" felt thematically appropriate — it exists
because the specific narrative beat built there (a visitor's letter
becoming real, being carried, being kept) required a physical anchor for
that beat to happen believably. This is the general rule for any future
prop: **a piece of furniture in Scope's world exists because a specific
moment needs it to be physically true, not because a room looked empty.**
If a new object can't point to the one moment that requires its physical
presence, don't add it "for atmosphere" — atmosphere is a side effect of
truthful staging, never the goal on its own.

## How to think about his world when designing something new

Treat the portfolio as a single house with rooms, all real, all
continuous, all inhabited by the same one companion whether or not anyone
is currently in them:

1. **Every room has a resting posture, not a set of actions.** A dock
   config (`mood`, `scale`, `attentionTarget`) describes how Scope rests in
   a room — it is not a menu of things he can be made to do there.
2. **Objects belong to the room, not to the visitor's clicks.** The
   notebook's corkboard string, the desk's paperclip, the letter itself —
   each exists because the room's own story requires it, and each has its
   own physical logic independent of being triggered.
3. **Travel between rooms is always his own walk, never a cut.** Any new
   section must be reachable by the same `springs.companion` travel every
   other room already uses. A new room that teleports him in breaks the
   single continuous house the whole design depends on.
4. **The visitor is a guest in this house, not its architect.** They can
   walk through it, sit at its desk, notice things in it — they cannot
   rearrange it, and Scope's reactions to them are the reactions of
   someone whose house this already was, not a character responding to
   player input.

If a new interaction can't be located inside this house — if it needs a
"level," a "screen," a "UI surface" that isn't a room with a real reason to
exist — it isn't a Scope interaction. It might still be good site design.
It just isn't part of his world.
