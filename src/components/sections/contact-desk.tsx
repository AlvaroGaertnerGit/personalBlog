"use client"

import * as React from "react"
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion"
import { PenLine } from "lucide-react"

import { ScopeDock, useScopeAcknowledge, useScopeDockContext } from "@/components/scope/companion"
import { SCOPE_HAPPY_HOLD_MS } from "@/components/scope/scope-motion"
import { distance, duration, easing, springs, transitions } from "@/lib/motion"
import { ContactForm } from "./contact-form"
import { CONTACT_ENDING_LINE } from "./contact-content"

type ContactScene = "arrival" | "preparing" | "writing" | "delivering" | "departed"

// SPR-009.1 — every one of these constants exists to make a transition read
// as caused by Scope, not as a timer firing. Scene 1 -> 2: how long Scope's
// own dock-follow spring (springs.companion) takes to settle before he's
// visibly "arrived and looked around" — objects don't start appearing
// before that beat is felt. SETTLE_DELAY_S: the pause between Scope's mood
// shifting to "observe" (he's now looking at the desk) and the paper
// actually starting to appear — without it the mood change and the paper's
// entrance happen in the same frame, which reads as coincidence, not
// cause-and-effect. Scene 2 -> 3: long enough for the paper+pen entrance
// (including SETTLE_DELAY_S) to finish, plus a held beat before Scope
// "invites" the visitor in (see the acknowledge() call below).
const ARRIVAL_SETTLE_MS = 1100
const SETTLE_DELAY_S = 0.35
const PREPARE_DURATION_MS = 1250

// Scene 5 (accept): the visitor's idea is accepted using Scope's existing
// canonical "happy" mood (scope-motion.ts) rather than a bespoke gesture —
// this is the one moment in the whole portfolio that mood's own doc
// comment reserves it for, "a reaction to the visitor's... work," never a
// celebration of itself. SCOPE_HAPPY_HOLD_MS is the mood system's own
// documented hold time before a caller should move on. ACKNOWLEDGE_PAUSE_MS
// is a second, separate held beat afterward — Scope settles from "happy"
// back to a calm, attentive "observe" and holds there before turning to
// leave, so departure reads as "his own decision to keep walking," not as
// "the animation finished."
const ACKNOWLEDGE_PAUSE_MS = 700

// Scene 6 (departure): Scope shrinks and genuinely exits the desk panel —
// "becomes smaller... eventually leaves the scene." The exit target is
// measured off the panel's own current edges rather than a fixed offset —
// a magic-number offset was tried first and, once actually watched in the
// browser, read as "shrinks in place, overlapping the closing line" rather
// than "walks away," since the panel is far wider than a couple hundred
// pixels at most viewport widths. DEPARTURE_SCALE is a numeric judgment
// call, sanity-checked visually rather than derived from a precedent.
const DEPARTURE_SCALE = 0.4
const DEPARTURE_EXIT_MARGIN = 64

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

// SPR-009, redirected in SPR-009.1 — the section's one client leaf. The
// governing rule from the redirect brief: every important transition must
// be attributable to Scope, not to a form or a timer — "if Scope
// disappeared from the scene, the interaction should stop making narrative
// sense." Concretely: (1) Scope's own dock-follow travel (no scripted code
// needed) is what produces arrival; (2) his mood settling to "observe"
// visibly *precedes* the workspace appearing, by SETTLE_DELAY_S, rather
// than both happening at once; (3) his own acknowledge() reaction fires
// right as the form is invited in — Scope notices, and that's what makes
// it available, not a bare fade-in; (4) his mood shifts to "curious" for
// as long as a submission is actually in flight (see isSubmittingIdea) —
// the pending window is otherwise a "dead" narrative beat; (5) Scenes 5-6
// are entirely Scope's own scripted sequence (approach, accept, pause,
// acknowledge, depart) — the paper reacts to *him*, never the reverse.
// Scope has no arms (see docs/scope-docs/scope/), so nothing here ever
// shows him manipulating an object directly — the workspace and the paper
// react on their own, timed against his presence and decisions.
function ContactDesk() {
  const [scene, setScene] = React.useState<ContactScene>("arrival")
  const [paperTaken, setPaperTaken] = React.useState(false)
  const [isSubmittingIdea, setIsSubmittingIdea] = React.useState(false)
  const hasArrivedRef = React.useRef(false)
  const hasSequencePlayedRef = React.useRef(false)
  const paperRef = React.useRef<HTMLDivElement>(null)
  const deskRef = React.useRef<HTMLDivElement>(null)

  const acknowledge = useScopeAcknowledge()
  // Matches theme-transition-controller.tsx's own convention (the one other
  // scripted-commandeer sequence in the codebase) — a raw Framer check for
  // gating the imperative animate() sequence itself, not something that
  // changes this component's very first render output.
  const shouldReduceMotion = useReducedMotion()

  const { activeDockId, getScopeMotionValues, stageRef, beginSceneTransition, setSceneMood } =
    useScopeDockContext()

  // Scene 1 -> 2, once, the first time this dock becomes the active one —
  // Scope has arrived and settled; only now does the workspace begin.
  React.useEffect(() => {
    if (hasArrivedRef.current || activeDockId !== "contact") return
    hasArrivedRef.current = true
    const delay = shouldReduceMotion ? 0 : ARRIVAL_SETTLE_MS
    const timer = window.setTimeout(() => setScene("preparing"), delay)
    return () => window.clearTimeout(timer)
  }, [activeDockId, shouldReduceMotion])

  // Scene 2 -> 3 — once the paper+pen have finished appearing and held a
  // beat, Scope invites the visitor in. acknowledge() fires here, not on
  // any visitor action: this is Scope's own decision to make the form
  // available, the one moment his brief hover-reaction is used
  // proactively rather than in response to something the visitor did.
  React.useEffect(() => {
    if (scene !== "preparing") return
    const delay = shouldReduceMotion ? 0 : PREPARE_DURATION_MS
    const timer = window.setTimeout(() => {
      acknowledge()
      setScene("writing")
    }, delay)
    return () => window.clearTimeout(timer)
  }, [scene, shouldReduceMotion, acknowledge])

  // Guards async continuations below from touching state after unmount —
  // ContactDesk never actually unmounts in practice (Contact is the last
  // section on the page), but the sequence is genuinely asynchronous, so
  // this costs nothing and keeps it honest.
  const isMountedRef = React.useRef(true)
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // The departure exit target is measured off the desk panel's own current
  // edges rather than a fixed offset — see DEPARTURE_EXIT_MARGIN's comment
  // for why a magic-number offset doesn't clear the panel at most viewport
  // widths. Falls back to a modest fixed nudge only if the panel somehow
  // isn't measurable.
  const computeExitTarget = React.useCallback((stageEl: HTMLDivElement, fallbackX: number, fallbackY: number) => {
    const deskRect = deskRef.current?.getBoundingClientRect()
    if (!deskRect) return { x: fallbackX + 200, y: fallbackY + 120 }
    const stageRect = stageEl.getBoundingClientRect()
    return {
      x: deskRect.right - stageRect.left + DEPARTURE_EXIT_MARGIN,
      y: deskRect.bottom - stageRect.top - DEPARTURE_EXIT_MARGIN,
    }
  }, [])

  // Scenes 5-6: the scripted takeover, mirroring theme-transition-
  // controller.tsx's runSequence shape (capture origin -> commandeer ->
  // sequential animate() beats), with one deliberate divergence: no restore
  // to origin and no endSceneTransition() at the end — Contact is the last
  // section, so Scope stays permanently commandeered/off-stage once it
  // departs, exactly as the brief confirms is acceptable.
  //
  // Deliberately triggered directly from ContactForm's onDelivered callback
  // rather than from a useEffect watching `scene` — this *is* an event (a
  // successful submission), not a value to synchronize on render, and every
  // setState call below runs inside that callback (or things nested under
  // it), never bare inside an effect body.
  const handleDelivered = React.useCallback(() => {
    if (hasSequencePlayedRef.current) return
    hasSequencePlayedRef.current = true
    setScene("delivering")
    setIsSubmittingIdea(false)

    const motionValues = getScopeMotionValues()
    const stage = stageRef.current
    if (!motionValues || !stage) {
      // Scope's motion values somehow never registered — nothing to
      // animate, just cut straight to the end state.
      setPaperTaken(true)
      setScene("departed")
      return
    }
    const { x, y, scale } = motionValues

    if (shouldReduceMotion) {
      beginSceneTransition()
      setSceneMood("idle")
      setPaperTaken(true)
      const exit = computeExitTarget(stage, x.get(), y.get())
      scale.set(DEPARTURE_SCALE)
      x.set(exit.x)
      y.set(exit.y)
      setScene("departed")
      return
    }

    async function runSequence(stageEl: HTMLDivElement) {
      beginSceneTransition()

      // Approach — Scope comes to collect the idea himself, the first of
      // his own scripted actions in this whole sequence.
      setSceneMood("observe")
      const stageRect = stageEl.getBoundingClientRect()
      const paperRect = paperRef.current?.getBoundingClientRect()
      const targetX = paperRect ? paperRect.left - stageRect.left : x.get()
      const targetY = paperRect ? paperRect.top - stageRect.top : y.get()

      await Promise.all([
        animate(x, targetX, springs.layout).finished,
        animate(y, targetY, springs.layout).finished,
      ]).catch(() => {})
      if (!isMountedRef.current) return

      // Accept — the paper folds away under its own motion (never Scope's
      // hands, which don't exist), while Scope's own canonical "happy"
      // reaction plays: a genuine response to what the visitor made, not a
      // celebration of himself. The one place in the portfolio this mood
      // is used, exactly what its own doc comment reserves it for.
      setPaperTaken(true)
      setSceneMood("happy")
      await wait(SCOPE_HAPPY_HOLD_MS)
      if (!isMountedRef.current) return

      // Pause, then acknowledge — Scope settles from "happy" into a calm,
      // attentive beat and holds there before turning to leave. This is
      // the emotional climax the redirect brief asks for: not a rushed
      // cut to departure, but a held moment where he's plainly taking the
      // idea in before he decides, on his own, to keep walking.
      setSceneMood("observe")
      await wait(ACKNOWLEDGE_PAUSE_MS)
      if (!isMountedRef.current) return

      // Departure — the ending line fades in concurrently with the exit,
      // not after it finishes. Not because the animation ends, but
      // because his own journey continues past this one page.
      setSceneMood("idle")
      setScene("departed")
      const exit = computeExitTarget(stageEl, targetX, targetY)
      await Promise.all([
        animate(x, exit.x, { duration: duration.slower, ease: easing.out }).finished,
        animate(y, exit.y, { duration: duration.slower, ease: easing.out }).finished,
        animate(scale, DEPARTURE_SCALE, { duration: duration.slower, ease: easing.out }).finished,
      ]).catch(() => {})
    }

    void runSequence(stage)
  }, [
    getScopeMotionValues,
    stageRef,
    beginSceneTransition,
    setSceneMood,
    shouldReduceMotion,
    computeExitTarget,
  ])

  const showObjects = scene === "preparing" || scene === "writing" || scene === "delivering"
  // "Curious" while a submission is genuinely in flight — without this the
  // pending window (a real network round trip) is a narrative dead spot,
  // the exact "Scope is mostly watching" problem the redirect brief calls
  // out. Reuses ContactForm's existing onSubmittingChange prop, previously
  // wired but never consumed by this component.
  const dockMood =
    scene === "writing"
      ? isSubmittingIdea
        ? "curious"
        : "idle"
      : scene === "arrival"
        ? "curious"
        : "observe"

  return (
    <div
      ref={deskRef}
      className="border-border/60 from-muted/50 to-muted/10 relative overflow-hidden rounded-4xl border bg-gradient-to-b p-8 backdrop-blur-sm sm:p-10 lg:p-14"
    >
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 opacity-10" />

      {scene === "departed" ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transitions.enterSlow}
          className="relative flex min-h-[40vh] flex-col items-center justify-center py-16 text-center sm:min-h-[50vh]"
        >
          <p className="text-muted-foreground text-lg sm:text-xl">{CONTACT_ENDING_LINE}</p>
        </motion.div>
      ) : (
        <div className="relative flex flex-col gap-10 sm:flex-row sm:items-start sm:gap-16">
          {/* Scope is the visual anchor of this scene, not an accessory
              beside the form — scale 1 (Hero's own resting scale), not the
              more modest 0.85 every other dock uses, since Contact is
              meant to carry emotional weight "comparable to the Hero." */}
          <div className="flex sm:w-32 sm:shrink-0">
            <ScopeDock
              id="contact"
              config={{
                mood: dockMood,
                scale: 1,
                // Registered from the moment the workspace starts forming,
                // not just once the form appears — Scope is looking at the
                // space taking shape, not only at the finished page.
                attentionTarget: scene === "preparing" || scene === "writing" ? paperRef : undefined,
              }}
              className="size-28 sm:size-32"
            />
          </div>

          {/* Capped width and a much quieter surface than a typical card —
              a blank page laid on the desk, not a bordered UI panel — so
              the composition's weight stays with Scope, not the form. */}
          <div className="min-h-64 flex-1 sm:max-w-md">
            {showObjects ? (
              <motion.div
                ref={paperRef}
                initial={{ opacity: 0, scale: 0.94, y: distance.sm }}
                animate={
                  paperTaken
                    ? { opacity: 0, scale: 0.85, y: -distance.sm, rotate: -6 }
                    : { opacity: 1, scale: 1, y: 0, rotate: 0 }
                }
                transition={paperTaken ? transitions.enter : { ...transitions.enter, delay: SETTLE_DELAY_S }}
                className="bg-background/20 relative rounded-2xl p-6 sm:p-8"
              >
                <motion.span
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: paperTaken ? 0 : 1 }}
                  transition={
                    paperTaken ? transitions.enter : { ...transitions.enter, delay: SETTLE_DELAY_S + 0.2 }
                  }
                  className="text-muted-foreground absolute top-4 right-4 sm:top-5 sm:right-5"
                >
                  <PenLine className="size-4" />
                </motion.span>

                <AnimatePresence>
                  {scene === "writing" ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={transitions.enter}
                    >
                      <ContactForm
                        onFirstInteraction={acknowledge}
                        onSubmittingChange={setIsSubmittingIdea}
                        onDelivered={handleDelivered}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export { ContactDesk }
