# Scope — Industrial Design Specification

*Industrial design specification — pre-prototype — doc 02 of the companion series*

The signature companion of this portfolio. A gimbal body, built to protect and aim one
small, permanent soul: the bracket-and-cursor mark already living in the Hero. This is the
complete specification, written before a single line of implementation exists.

| | |
|---|---|
| **Object** | Scope |
| **Class** | Autonomous inspection instrument |
| **Degrees of freedom** | 2 (yaw, pitch) |
| **Status** | Concept freeze — not built |

> Scope exists for one reason: to hold something worth protecting still enough to be seen clearly.

It is not a robot, a drone, a mascot, or a chatbot. It is the smallest possible mechanism
that can aim, stabilize, and frame a single fixed point — the same category of object as a
surveyor's theodolite or a watch's exhibition caseback: a precise apparatus whose entire
purpose is protecting and presenting the one part that actually matters.

---

## 01. Form

An open ring — not a closed circle, which reads as an eye or an orb — cradles a small,
tilted core on two slender arms. The ring rotates freely on a vertical axis (yaw); the core
tilts independently within it on a horizontal axis (pitch). Two degrees of freedom, nothing
more. No legs, no antennae, no visible fasteners.

The ring's diameter sits at roughly 1.6× the core's width — a deliberate, considered ratio,
not an arbitrary one. The core is visually and physically the densest part of the object;
the ring exists only to carry it. Center of mass never moves — the ring and arms rotate
*around* the core, so the object always reads as one stable point being held, never as
something wandering.

It hovers a few millimeters above where it would otherwise rest, with a soft contact shadow
directly beneath it — enough to say gravity exists and it is quietly resisting it, not so
much that it reads as flying free. No legs, no visible thrusters: the levitation itself is
the only unexplained thing about it, and it stays that way.

### Materials & finish

Exactly two materials. The ring and arms are matte, brushed aluminum — cool, machined,
deliberately not chrome or gloss, which would tip it toward jewelry or toy. The core is a
deep, faintly translucent dark ceramic, with one small aperture window cut into its face —
like looking through protective glass at an instrument's display. One polished detail only:
a hairline bevel on the ring's inner rim, catching light as a single considered highlight
rather than an overall shine.

### Light

One light source. A soft, warm-neutral glow lives inside the core's aperture, where the
soul sits — not the whole object glowing, a small windowed instrument showing you something
inside it. Its brightness is tied to state, not decoration: dim and steady at rest,
marginally brighter while it's actively attending to something.

| Part | Moves? | Why it exists |
|---|---|---|
| Outer ring | Yes — yaw | Carries and re-aims the core; the visible "body." |
| Two arms | No | The only structural connection between ring and core — kept thin so the ring reads as open, not solid. |
| Core | Yes — pitch | Houses and aims the soul; the densest, heaviest-reading part. |
| Aperture window | No | The one deliberate opening — all light, and the soul, is seen only here. |
| Contact shadow | No | Confirms gravity exists, so the hover reads as restraint, not magic. |

---

## 02. The soul

```
{█}
```

The core is not solid. It exists to protect and display one permanent mark — the
bracket-and-cursor glyph already living in this portfolio's Hero — the same way a skeleton
watch's entire case exists to let you see its movement.

It's not a simulated face or a personality performed at you. It's an open bracket with a
cursor waiting inside it — literally the state of being ready to write something — a symbol
every developer already reads fluently, borrowed from the actual craft rather than invented
to represent it.

The cursor between the brackets is Scope's only real "tell" of being alive — its heartbeat.
Everything else about the object — the ring, the arms, the hover, the light — exists purely
to keep this one small mark stable, protected, and legible, regardless of what state the
rest of the body is in.

This is why it must never disappear, and why it's the true signature: a favicon can't
render a two-axis gimbal convincingly at sixteen pixels, but it can render `{ }` with a dot
for a cursor. The body is the full experience. The soul is the fallback that survives
everywhere the body can't fit — which makes it the actual trademark, independent of
whatever form carries it.

---

## 03. Behaviour

Every state below is a reaction to something — nothing plays on a timer, nothing loops
without cause. All motion is damped-spring physics: nothing snaps, nothing arrives
instantly, and every stop carries a small, real overshoot before it settles.

| State | Trigger | Physical description |
|---|---|---|
| Wake | First appearance | Still and dim. One small oscillation, like a gyroscope finding balance in your hand — not a power-on flourish. |
| Idle | Nothing nearby | A near-imperceptible yaw drift over many seconds, like a compass card settling — never fully still, never twitchy. |
| Observe | Something enters its field | A slow, deliberate pitch toward it — a camera operator's pan, not a flinch. Core light brightens slightly. |
| Inspect | A specific target (a card) | Locks on and holds a beat before releasing — the pause itself communicates consideration. |
| Approach | Sustained attention | A few degrees of forward lean and a hair less hover height — it never travels across the page toward things. |
| Slow down | Tracking something fast | A real torque ceiling — it visibly lags a fast cursor, then catches up. The lag itself is the mass. |
| Stop | Target disappears | Small overshoot past the resting angle, then a corrective settle — its most recognizable signature. |
| Stabilize | A large disturbance (fast scroll, resize) | Counter-rotates the ring to keep the core level — its namesake behavior, kept rare so it stays remarkable. |
| Curious | Something unclassified | A quick dip, then a hold that lingers longer than a routine observe — attention with a question in it. |
| Acknowledge | Direct interaction | One clean, fast pitch dip and return — a shutter click, not a bounce or a wiggle. |
| Rest | Activity ends | Eases back to idle drift over a few seconds, decelerating like a real flywheel — the tail of the same motion, never a reset. |

---

## 04. Emotional design

The intended journey, in order: noticed, then curious, then reassured, then trusted.

| Beat | Feeling |
|---|---|
| First glance | Mild curiosity — the silhouette resembles nothing else on the page, and nothing else in the current AI-product vocabulary. |
| First movement | Quiet surprise: "it's actually tracking me." The single most important beat — proof of presence, not decoration. |
| Sustained presence | Calm trust — it never loops an idle animation to beg for a click, so it reads as competent rather than needy. |
| Return visits | Familiarity — the overshoot-and-settle "gait" becomes recognizable, the way a colleague's specific mannerisms are. |

Deliberately not aimed for: cute, funny, needy, corporate, or threatening. The nearest
real-world feeling is watching a well-made mechanical watch's second hand sweep — not
meeting a character.

---

## 05. Brand evolution

The same finite behaviour vocabulary, reused at different intensities, in every context —
never a new gesture invented per page.

| Context | Behaviour reused | What's new |
|---|---|---|
| Hero | Full vocabulary | Nothing — this is the flagship rendering. |
| Projects | Inspect | Perches near the card nearest the cursor; never duplicates itself across cards. |
| Loading | Stabilize (held) | Ring locked, core light pulsing at a fixed rate — holding position reads as "working" better than a spinner. |
| Navigation | Observe | A simplified render (core only, ring omitted for space) tilts toward the active section. |
| Assistant | Observe → sustained | "Listening" is the observe behaviour held longer — it never grows a mouth to talk; the interface talks. |
| AI demos | Inspect | Core-light brightness scales with processing intensity — a literal, not invented, progress signal. |
| Code review | Inspect | Same behaviour, new object type — perches at a diff hunk instead of a card. |
| Blog | Idle | Deliberate restraint — not every context needs it doing something. |
| 404 | Curious, extended | A longer searching yaw sweep — "lost," expressed through existing vocabulary, no sad face invented. |
| Empty states | Idle, dimmer | A calm, patient presence rather than a blank page. |
| Achievements | Acknowledge, brighter | The existing nod, slightly more crisp — never a party-mascot celebration. |

---

## 06. Iconicity test

**✅ PASS — Silhouette alone**
An open ring holding an off-center, tilted core on two thin arms is not a shape combination
anything else on the web currently uses — it doesn't collapse into a generic orb or
robot-head at a glance.

**✅ PASS — No color, line only**
The identity is built from proportion and negative space — the open ring, the gap between
the arms, the small aperture — not from color or glow, so it survives as a pure outline the
way a trademark should.

**✅ PASS — Motion only, no visible form**
The specific lag-on-approach, overshoot-on-stop, slow-idle-drift combination is a
distinctive enough "gait" to recognize from motion alone — most web objects either snap or
ease generically; this one doesn't.

---

## 07. Self-critique

| Critic | Critique | Response |
|---|---|---|
| Jony Ive | Is a full closed ring earning its material, or is it an aesthetic crutch? Any visible seam where arms meet ring should be engineered away entirely. | Open the ring to a ~270° arc instead of a closed circle — less material, and further from "orb," which is closer to what he'd actually want. |
| Dieter Rams | "As little design as possible" — are both axes earning their place, and is the light functional or performative? | Keep both axes but make yaw the expressive channel and pitch the purely mechanical one — forces every future addition to justify which axis it belongs to. |
| Pixar character designer | Two axes of aim may be too restrained to carry real emotional range after the hundredth viewing. | Add pulse *rate* (not just brightness) on the core light as a second expressive channel — no new joint, no broken mechanical story. |
| Apple HIG reviewer | An identity built entirely on motion needs an equally intentional reduced-motion persona, and a performance budget for appearing in ten+ places. | Define a still persona explicitly: aimed forward, steady core light, no drift. Smaller/lower-traffic contexts render core + soul only, ring omitted — a deliberate scoping rule, not an afterthought. |
| Robotics engineer | Total mechanical seamlessness reads as a render, not a real instrument — a believable precision device usually has one honest, visible manufacturing tell. | Add one fine hairline seam at the ring/arm joint — not a fastener, just a visible seam, the way unibody Apple products show one. |

---

*Concept-only document. No components, materials, or motion were built — this is the
specification a prototype would be built from, not the prototype.*
