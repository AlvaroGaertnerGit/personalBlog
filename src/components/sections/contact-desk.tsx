"use client"

import * as React from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "framer-motion"
import { PenLine, Paperclip } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScopeDock, useScopeAcknowledge, useScopeDockContext } from "@/components/scope/companion"
import { SCOPE_HAPPY_HOLD_MS } from "@/components/scope/scope-motion"
import { distance, duration, easing, springs, transitions } from "@/lib/motion"
import { ContactForm } from "./contact-form"
import { CONTACT_ENDING_LINE, CONTACT_FORM_COPY } from "./contact-content"

type ContactScene = "arrival" | "preparing" | "writing" | "sealing" | "delivering" | "resting"

// SPR-009.3 — "the letter must feel real." Every one of these constants
// exists to make a transition read as a physical event (weight, momentum,
// friction) rather than a UI state change, and to make Scope react to a
// *completed* letter rather than to the click itself.
const ARRIVAL_SETTLE_MS = 1100
const SETTLE_DELAY_S = 0.35
const PREPARE_DURATION_MS = 1250

// Sealing beats, in order: read-only pause -> clip release -> paper slide
// -> fold. Each number is a deliberate pause, not a default.
const READONLY_PAUSE_MS = 550
const CLIP_RELEASE_TRANSITION = { duration: 0.4, ease: easing.inOut }
// A spring, not a tween — "weight, momentum, friction... not a DOM element
// moving." Lower stiffness + added mass than springs.layout (the ordinary
// UI spring) so the paper settles slowly, like something with real inertia
// resting back down, not snapping to a target.
const SLIDE_TRANSITION = { type: "spring", stiffness: 90, damping: 16, mass: 1.3 } as const
const FOLD_TRANSITION = { duration: 0.55, ease: easing.inOut }
const ACCEPT_TRANSITION = { duration: duration.base, ease: easing.inOut }

// Scope reacts only once the letter is fully folded — "Scope reacts to the
// completed letter. Never to the click." ARRIVE_LOOK_PAUSE_MS: he stops,
// looks at it, before accepting — "allow the audience time to understand
// what is happening." ACKNOWLEDGE_PAUSE_MS: after the canonical "happy"
// reaction (scope-motion.ts — the one place in the portfolio that mood is
// used, "a reaction to the visitor's... work"), a second held beat before
// turning to leave, so departure reads as his own decision.
const ARRIVE_LOOK_PAUSE_MS = 600
const ACKNOWLEDGE_PAUSE_MS = 700

// Departure: Scope shrinks and genuinely exits the desk panel. The exit
// target is measured off the panel's own current edges rather than a fixed
// offset — a magic-number offset read as "shrinks in place overlapping the
// closing line" once actually watched in the browser, since the panel is
// far wider than a couple hundred pixels at most viewport widths.
const DEPARTURE_SCALE = 0.4
const DEPARTURE_EXIT_MARGIN = 64

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

// SPR-009, redirected in SPR-009.1 ("Scope as protagonist") and again in
// SPR-009.3 ("the letter must feel real") — the section's one client leaf.
// The governing rule carried through every redirect: every important
// transition must be attributable to Scope, not to a form or a timer —
// "if Scope disappeared from the scene, the interaction should stop making
// narrative sense." SPR-009.3 adds a second rule specifically for the
// paper itself: physical continuity. The paper mounted once in "preparing"
// is the *same* element through writing, sealing, and delivering — never
// replaced, never swapped for other content — its own motion values
// (paperX/Y/Scale/ScaleY/Rotate/Opacity below) are what carry it through
// being written on, clipped, released, slid, folded, and finally accepted.
// A small metallic clip is present from the very start (see the paper's
// own render below), meaningless while writing, suddenly meaningful the
// moment it releases. Scope has no arms (see docs/scope-docs/scope/), so
// nothing here ever shows him manipulating the paper or clip directly —
// they react to elapsed scene time and to his presence, never the reverse.
//
// Also unlike SPR-009.1's version: Scope is never permanently stuck here.
// After departing he stays commandeered (visibly "gone") only until either
// the visitor's attention moves elsewhere (scroll away releases him back
// to the ordinary dock-follow system, see the activeDockId effect below)
// or they ask for another letter (handleReplay releases him the same way,
// then resets to "arrival" so the exact same heavy springs.companion
// travel that brought him here the first time brings him back).
function ContactDesk() {
  const [scene, setScene] = React.useState<ContactScene>("arrival")
  const [isSubmittingIdea, setIsSubmittingIdea] = React.useState(false)
  const hasArrivedRef = React.useRef(false)
  const hasSequencePlayedRef = React.useRef(false)
  const paperRef = React.useRef<HTMLDivElement>(null)
  const deskRef = React.useRef<HTMLDivElement>(null)
  const isMountedRef = React.useRef(true)

  // The paper's own physical state — one persistent element, never
  // unmounted mid-sequence. originY: 0 (set on the element itself, not
  // here) is what makes paperScaleY fold the sheet downward from its top
  // edge instead of shrinking from its center.
  const paperOpacity = useMotionValue(0)
  const paperScale = useMotionValue(0.94)
  const paperScaleY = useMotionValue(1)
  const paperX = useMotionValue(0)
  const paperY = useMotionValue<number>(distance.sm)
  const paperRotate = useMotionValue(0)

  // The clip: present from the start, released only once sealing begins.
  const clipOpacity = useMotionValue(0)
  const clipRotate = useMotionValue(-6)
  const clipY = useMotionValue(0)

  const penOpacity = useMotionValue(0)

  const acknowledge = useScopeAcknowledge()
  // Matches theme-transition-controller.tsx's own convention (the one
  // other scripted-commandeer sequence in the codebase) — a raw Framer
  // check for gating the imperative animate() sequence, not something
  // that changes this component's very first render output.
  const shouldReduceMotion = useReducedMotion()

  const { activeDockId, getScopeMotionValues, stageRef, beginSceneTransition, endSceneTransition, setSceneMood } =
    useScopeDockContext()

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Scene 1 -> 2, once, the first time this dock becomes the active one —
  // Scope has arrived and settled; only now does the workspace begin. Also
  // re-armed by handleReplay (hasArrivedRef reset to false, scene reset to
  // "arrival"), so writing a second letter reuses this exact beat rather
  // than a bespoke "return." `scene` has to be in this effect's own
  // dependency array for that re-arming to actually fire: activeDockId
  // never changes on replay (the "contact" dock's placeholder never left
  // the viewport), so without `scene` here this effect simply wouldn't
  // re-run and the whole workspace would silently never reappear.
  React.useEffect(() => {
    if (hasArrivedRef.current || activeDockId !== "contact") return
    hasArrivedRef.current = true
    const delay = shouldReduceMotion ? 0 : ARRIVAL_SETTLE_MS
    const timer = window.setTimeout(() => setScene("preparing"), delay)
    return () => window.clearTimeout(timer)
  }, [scene, activeDockId, shouldReduceMotion])

  // Scene 2 -> 3 — the paper, clip, and pen fade in (or snap in, reduced
  // motion), then Scope invites the visitor in via acknowledge().
  React.useEffect(() => {
    if (scene !== "preparing") return

    if (shouldReduceMotion) {
      paperOpacity.set(1)
      paperScale.set(1)
      paperY.set(0)
      clipOpacity.set(1)
      penOpacity.set(1)
    } else {
      animate(paperOpacity, 1, { ...transitions.enter, delay: SETTLE_DELAY_S })
      animate(paperScale, 1, { ...transitions.enter, delay: SETTLE_DELAY_S })
      animate(paperY, 0, { ...transitions.enter, delay: SETTLE_DELAY_S })
      animate(clipOpacity, 1, { ...transitions.enter, delay: SETTLE_DELAY_S + 0.15 })
      animate(penOpacity, 1, { ...transitions.enter, delay: SETTLE_DELAY_S + 0.3 })
    }

    const delay = shouldReduceMotion ? 0 : PREPARE_DURATION_MS
    const timer = window.setTimeout(() => {
      acknowledge()
      setScene("writing")
    }, delay)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, shouldReduceMotion, acknowledge])

  // The departure exit target is measured off the desk panel's own current
  // edges rather than a fixed offset (see DEPARTURE_EXIT_MARGIN's comment).
  // Falls back to a modest fixed nudge only if the panel somehow isn't
  // measurable.
  const computeExitTarget = React.useCallback((stageEl: HTMLDivElement, fallbackX: number, fallbackY: number) => {
    const deskRect = deskRef.current?.getBoundingClientRect()
    if (!deskRect) return { x: fallbackX + 200, y: fallbackY + 120 }
    const stageRect = stageEl.getBoundingClientRect()
    return {
      x: deskRect.right - stageRect.left + DEPARTURE_EXIT_MARGIN,
      y: deskRect.bottom - stageRect.top - DEPARTURE_EXIT_MARGIN,
    }
  }, [])

  const resetPaperState = React.useCallback(() => {
    paperOpacity.set(0)
    paperScale.set(0.94)
    paperScaleY.set(1)
    paperX.set(0)
    paperY.set(distance.sm)
    paperRotate.set(0)
    clipOpacity.set(0)
    clipRotate.set(-6)
    clipY.set(0)
    penOpacity.set(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scenes 4-6 (sealing -> delivering): the full physical sequence —
  // read-only pause, clip release, slide, fold, *then* Scope approaches,
  // stops, looks, accepts, acknowledges, and departs. Triggered directly
  // from ContactForm's onDelivered callback rather than a useEffect
  // watching `scene` — this *is* an event (a successful submission), not a
  // value to synchronize on render, and every setState call below runs
  // inside this callback (or things nested under it), never bare inside an
  // effect body.
  const handleDelivered = React.useCallback(() => {
    if (hasSequencePlayedRef.current) return
    hasSequencePlayedRef.current = true
    setScene("sealing")

    if (shouldReduceMotion) {
      clipOpacity.set(0)
      paperOpacity.set(0)
      const motionValues = getScopeMotionValues()
      const stage = stageRef.current
      if (motionValues && stage) {
        beginSceneTransition()
        setSceneMood("idle")
        const exit = computeExitTarget(stage, motionValues.x.get(), motionValues.y.get())
        motionValues.scale.set(DEPARTURE_SCALE)
        motionValues.x.set(exit.x)
        motionValues.y.set(exit.y)
      }
      setScene("resting")
      return
    }

    async function runSequence() {
      // The writing is finished — nothing else can change (contact-form.tsx's
      // own `pending` state, never reset after success, drives readOnly on
      // the fields). A short pause: let the moment breathe.
      await wait(READONLY_PAUSE_MS)
      if (!isMountedRef.current) return

      // The clip releases — the first physical action after submission.
      await animate(clipRotate, clipRotate.get() - 35, CLIP_RELEASE_TRANSITION).finished
      if (!isMountedRef.current) return
      await Promise.all([
        animate(clipY, -14, CLIP_RELEASE_TRANSITION).finished,
        animate(clipOpacity, 0, CLIP_RELEASE_TRANSITION).finished,
      ])
      if (!isMountedRef.current) return

      // The paper is free — it slides a little across the desk. A spring,
      // not a tween: weight, momentum, friction, not a DOM element moving.
      await Promise.all([
        animate(paperX, 18, SLIDE_TRANSITION).finished,
        animate(paperY, paperY.get() + 10, SLIDE_TRANSITION).finished,
        animate(paperRotate, -3, SLIDE_TRANSITION).finished,
      ])
      if (!isMountedRef.current) return

      // Only then does it fold — calmly, deliberately, into a letter.
      await animate(paperScaleY, 0.52, FOLD_TRANSITION).finished
      if (!isMountedRef.current) return

      // Only now does Scope react — to the completed letter, never the
      // click.
      const motionValues = getScopeMotionValues()
      const stage = stageRef.current
      if (!motionValues || !stage) {
        paperOpacity.set(0)
        setScene("resting")
        return
      }
      const { x, y, scale } = motionValues

      setScene("delivering")
      beginSceneTransition()
      setSceneMood("observe")

      const stageRect = stage.getBoundingClientRect()
      const paperRect = paperRef.current?.getBoundingClientRect()
      const targetX = paperRect ? paperRect.left - stageRect.left : x.get()
      const targetY = paperRect ? paperRect.top - stageRect.top : y.get()

      await Promise.all([
        animate(x, targetX, springs.layout).finished,
        animate(y, targetY, springs.layout).finished,
      ])
      if (!isMountedRef.current) return

      // Scope stops. Looks at the letter. A held beat before accepting —
      // "allow the audience time to understand what is happening."
      await wait(ARRIVE_LOOK_PAUSE_MS)
      if (!isMountedRef.current) return

      // Accept — the letter settles into his possession right where he's
      // standing, while Scope's own canonical "happy" reaction plays
      // underneath: a genuine response to what the visitor made, never a
      // celebration of himself.
      setSceneMood("happy")
      await Promise.all([
        animate(paperScale, 0, ACCEPT_TRANSITION).finished,
        animate(paperOpacity, 0, ACCEPT_TRANSITION).finished,
      ])
      if (!isMountedRef.current) return
      await wait(SCOPE_HAPPY_HOLD_MS)
      if (!isMountedRef.current) return

      // Pause, then acknowledge — Scope settles from "happy" into a calm,
      // attentive beat and holds there before turning to leave. Not a
      // rushed cut to departure: a held moment where he's plainly taking
      // the idea in before he decides, on his own, to keep walking.
      setSceneMood("observe")
      await wait(ACKNOWLEDGE_PAUSE_MS)
      if (!isMountedRef.current) return

      // Departure — not because the animation ends, but because his own
      // journey continues past this one page. He stays commandeered
      // afterward (visibly "gone"), not released yet — see the
      // activeDockId effect and handleReplay for how he's ever reclaimed.
      setSceneMood("idle")
      setScene("resting")
      const exit = computeExitTarget(stage, targetX, targetY)
      await Promise.all([
        animate(x, exit.x, { duration: duration.slower, ease: easing.out }).finished,
        animate(y, exit.y, { duration: duration.slower, ease: easing.out }).finished,
        animate(scale, DEPARTURE_SCALE, { duration: duration.slower, ease: easing.out }).finished,
      ])
    }

    void runSequence()
  }, [
    shouldReduceMotion,
    getScopeMotionValues,
    stageRef,
    beginSceneTransition,
    setSceneMood,
    computeExitTarget,
    clipOpacity,
    clipRotate,
    clipY,
    paperOpacity,
    paperRotate,
    paperScale,
    paperScaleY,
    paperX,
    paperY,
  ])

  // Not a frozen decoration: once resting (Scope parked, "gone," waiting
  // for another letter), the moment the visitor's attention moves
  // elsewhere — they scroll to a different dock — release him back to the
  // ordinary dock-follow system so he can travel there too, the same as
  // any other section change.
  React.useEffect(() => {
    if (scene !== "resting" || activeDockId === "contact") return
    endSceneTransition()
  }, [scene, activeDockId, endSceneTransition])

  // "Scope naturally returns" — releases him back to the ordinary
  // dock-follow system (its own heavy springs.companion travel is the
  // return itself, reusing the exact mechanism that brought him here the
  // first time) and resets every piece of local state to a fresh
  // "about to arrive" baseline.
  const handleReplay = React.useCallback(() => {
    hasArrivedRef.current = false
    hasSequencePlayedRef.current = false
    setIsSubmittingIdea(false)
    resetPaperState()
    endSceneTransition()
    setScene("arrival")
  }, [endSceneTransition, resetPaperState])

  const showLetter = scene !== "arrival" && scene !== "resting"
  const showForm = scene === "writing" || scene === "sealing" || scene === "delivering"
  const dockMood =
    scene === "writing"
      ? isSubmittingIdea
        ? "curious"
        : "idle"
      : scene === "arrival"
        ? "curious"
        : scene === "resting"
          ? "idle"
          : "observe"

  return (
    <div
      ref={deskRef}
      className="border-border/60 from-muted/50 to-muted/10 relative overflow-hidden rounded-4xl border bg-gradient-to-b p-8 backdrop-blur-sm sm:p-10 lg:p-14"
    >
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 opacity-10" />

      {/* The workspace — desk, lighting, Scope — never disappears. Only
          the letter itself leaves, and only once "resting" does the
          content column swap from the letter to the quiet ending + a
          replay invitation, still inside this same, permanent frame. */}
      <div className="relative flex flex-col gap-10 sm:flex-row sm:items-start sm:gap-16">
        <div className="flex sm:w-32 sm:shrink-0">
          {/* Scope is the visual anchor of this scene, not an accessory
              beside the form — scale 1 (Hero's own resting scale), not the
              more modest 0.85 every other dock uses. */}
          <ScopeDock
            id="contact"
            config={{
              mood: dockMood,
              scale: 1,
              attentionTarget:
                scene === "preparing" || scene === "writing" || scene === "sealing" ? paperRef : undefined,
            }}
            className="size-28 sm:size-32"
          />
        </div>

        <div className="min-h-64 flex-1 sm:max-w-md">
          {scene === "resting" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={transitions.enterSlow}
              className="flex flex-col items-start gap-4 py-2"
            >
              <p className="text-muted-foreground text-base sm:text-lg">{CONTACT_ENDING_LINE}</p>
              <Button variant="ghost" onClick={handleReplay} className="h-auto px-0 text-sm">
                {CONTACT_FORM_COPY.replayLabel}
              </Button>
            </motion.div>
          ) : showLetter ? (
            <motion.div
              ref={paperRef}
              style={{
                x: paperX,
                y: paperY,
                scale: paperScale,
                scaleY: paperScaleY,
                rotate: paperRotate,
                opacity: paperOpacity,
                originY: 0,
              }}
              className="bg-background/20 relative rounded-2xl p-6 sm:p-8"
            >
              {/* Present from the very start, meaningless while writing,
                  suddenly meaningful the moment it releases (see the
                  sealing sequence above) — "this has always been a
                  physical sheet of paper." */}
              <motion.span
                aria-hidden="true"
                style={{ opacity: clipOpacity, rotate: clipRotate, y: clipY }}
                className="text-muted-foreground absolute -top-3 left-1/2 -translate-x-1/2"
              >
                <Paperclip className="size-5" />
              </motion.span>

              <motion.span
                aria-hidden="true"
                style={{ opacity: penOpacity }}
                className="text-muted-foreground absolute top-4 right-4 sm:top-5 sm:right-5"
              >
                <PenLine className="size-4" />
              </motion.span>

              <AnimatePresence>
                {showForm ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
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
    </div>
  )
}

export { ContactDesk }
