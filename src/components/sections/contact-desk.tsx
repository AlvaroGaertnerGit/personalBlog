"use client"

import * as React from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion"
import { PenLine, Paperclip } from "lucide-react"

import { Reveal } from "@/components/motion/reveal"
import { Button } from "@/components/ui/button"
import { ScopeDock, useScopeAcknowledge } from "@/components/scope/companion"
import { SCOPE_HAPPY_HOLD_MS } from "@/components/scope/scope-motion"
import type { ScopeMood } from "@/components/scope/scope.types"
import { cn } from "@/lib/utils"
import { easing, springs } from "@/lib/motion"
import { ContactForm } from "./contact-form"
import { CONTACT_ENDING_LINE, CONTACT_FORM_COPY } from "./contact-content"

type ContactScene = "ready" | "sealing" | "delivering" | "resting"

// SPR-009.4 — "calmer, more physical, more believable." The site owner's
// own review of the shipped SPR-009.3 sequence found it too literal (the
// paper visibly folded, even though Scope has no arms — see docs/scope-
// docs/scope/ — to fold it) and too slow (~2.3s of setTimeout-chained
// entrance before the visitor could even start typing). This rewrite:
// (1) removes every beat implying Scope manipulates an object directly,
// (2) makes the desk immediately interactive — no blocking entrance,
// (3) keeps Scope visibly present and idle-animating once his part is
// done, rather than shrinking him past the panel's edge and freezing him
// there until the visitor scrolls away.
//
// SPR-009.5 redesigned the one moment that remained: the paper's journey
// to Scope. A plain position glide, however physically correct, read as
// predictable and mechanical — the weakest beat in an otherwise strong
// sequence. Chosen from three fundamentally different concepts (an
// industrial "the desk tilts, gravity does the work" mechanism; this one;
// and a "the paper's ambient motion stills under his attention" museum-
// quiet approach — the first's physics doesn't hold up at a scale subtle
// enough to stay premium, the third fights the immediate-usability
// requirement above by needing constant ambient motion while writing) —
// see the site owner's own design conversation for the full comparison.
// This one won because it invents nothing: VISUAL_LANGUAGE.md already
// names warm indirect light as Scope's "primary signal" and his only
// established way of touching the world ("extremely subtle atmospheric
// purple only when interacting with the environment"). The letter is no
// longer just slid to his position — it's drawn into a warm bloom of his
// own light that reaches toward it first, and becomes an envelope *within*
// that shared light rather than after it arrives, so "catching the light"
// and "becoming an envelope" read as one transformation, not two. The
// accept-moment reaction is the original "happy" mood hop, not SPR-009.4's
// antenna pulse — the site owner preferred it after living with both.
const READONLY_PAUSE_MS = 550
const CLIP_RELEASE_TRANSITION = { duration: 0.4, ease: easing.inOut }
const PEN_ROLL_TRANSITION = { duration: 0.5, ease: easing.out }
const LIFT_TRANSITION = { duration: 0.4, ease: easing.out }
// The glide covers most, not all, of the distance to Scope — the remaining
// gap is closed by light (arrivalGlow/envelopeProgress below), not travel,
// so the paper's own motion reads as a lean-in rather than the dominant
// gesture of the beat.
const GLIDE_DISTANCE_FRACTION = 0.7
const ARRIVAL_TRANSITION = { duration: 0.6, ease: easing.inOut }
const ENVELOPE_TRANSITION = { duration: 0.5, ease: easing.inOut }
const ACCEPT_TRANSITION = { duration: 0.45, ease: easing.inOut }
const REST_PAUSE_MS = 500

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

// SPR-009, redirected in SPR-009.1, SPR-009.3, and now SPR-009.4 — the
// section's one client leaf. The one rule carried through every redirect:
// every important transition must be attributable to Scope, not a form or
// a timer. SPR-009.4 adds a second, equally important rule: nothing here
// ever shows Scope directly manipulating the paper — it lifts, glides, and
// reshapes itself on its own timing, and Scope, who has no arms, only ever
// watches and reacts.
function ContactDesk() {
  const [scene, setScene] = React.useState<ContactScene>("ready")
  const [isSubmittingIdea, setIsSubmittingIdea] = React.useState(false)
  const [isCelebrating, setIsCelebrating] = React.useState(false)
  const [resetCount, setResetCount] = React.useState(0)
  const hasSequencePlayedRef = React.useRef(false)
  const paperRef = React.useRef<HTMLDivElement>(null)
  const deskRef = React.useRef<HTMLDivElement>(null)
  const isMountedRef = React.useRef(true)

  // The paper's own physical state — one persistent element, never
  // unmounted mid-sequence. Already at rest (opacity 1, no offset) from
  // first render — "the paper is already resting on the desk" — rather
  // than animating in via a timer.
  const paperOpacity = useMotionValue(1)
  const paperScale = useMotionValue(1)
  const paperX = useMotionValue(0)
  const paperY = useMotionValue(0)
  const paperRotate = useMotionValue(0)
  // 0 = a flat sheet, 1 = fully envelope-shaped — one source value, two
  // derived reads below (paperScaleX narrows the sheet, flapOpacity/
  // flapScale bring in a small flap), matching scope.tsx's own established
  // preference for a single progress value over several independently-
  // animated ones. A single-input range mapping — a different, safe usage
  // from the multi-input useTransform this codebase already found
  // unreliable and worked around in use-combined-motion-value.ts.
  const envelopeProgress = useMotionValue(0)
  const paperScaleX = useTransform(envelopeProgress, [0, 1], [1, 0.82])
  const flapOpacity = useTransform(envelopeProgress, [0, 1], [0, 1])
  const flapScaleY = useTransform(envelopeProgress, [0, 1], [0.6, 1])

  // 0 = no light yet, 1 = fully claimed by Scope's own warm glow — the
  // beat that replaces a plain glide (see this file's own top comment).
  // Drives both the ambient bloom (emanating from his side) and the
  // paper's own "catching the light" overlay below, so the two always
  // move in lockstep — one cause, two visible effects, never two
  // independently-timed animations that could drift apart.
  const arrivalGlow = useMotionValue(0)

  // The clip: present from the start, released only once sealing begins.
  const clipOpacity = useMotionValue(1)
  const clipRotate = useMotionValue(-6)
  const clipY = useMotionValue(0)

  // The pen: present from the start. Rolls once, permanently, once its
  // purpose is finished — never resets back until a replay.
  const penRotate = useMotionValue(0)
  const penX = useMotionValue(0)

  const acknowledge = useScopeAcknowledge()
  const shouldReduceMotion = useReducedMotion()

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const resetPaperState = React.useCallback(() => {
    paperOpacity.set(1)
    paperScale.set(1)
    paperX.set(0)
    paperY.set(0)
    paperRotate.set(0)
    envelopeProgress.set(0)
    clipOpacity.set(1)
    clipRotate.set(-6)
    clipY.set(0)
    penRotate.set(0)
    penX.set(0)
    arrivalGlow.set(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Triggered directly from ContactForm's onDelivered callback (a real
  // confirmed success, same trigger point as SPR-009.3) rather than the
  // instant the button is pressed — a network failure still surfaces
  // ContactForm's own errorMessage and never plays a premature "delivered"
  // cinematic. The visitor's immediate "everything pauses" feedback is
  // ContactForm's own pending state (fields already read-only, button
  // already reading "Delivering…") from the moment they actually pressed
  // it; this sequence is the held beat *after* that's confirmed real.
  const handleDelivered = React.useCallback(() => {
    if (hasSequencePlayedRef.current) return
    hasSequencePlayedRef.current = true

    if (shouldReduceMotion) {
      clipOpacity.set(0)
      paperOpacity.set(0)
      arrivalGlow.set(0)
      setScene("resting")
      return
    }

    async function runSequence() {
      // The writing is finished — a short pause: let the moment breathe.
      await wait(READONLY_PAUSE_MS)
      if (!isMountedRef.current) return

      setScene("sealing")

      // The clip releases first — nothing can lift free of it yet.
      await animate(clipRotate, clipRotate.get() - 35, CLIP_RELEASE_TRANSITION).finished
      if (!isMountedRef.current) return
      await Promise.all([
        animate(clipY, -14, CLIP_RELEASE_TRANSITION).finished,
        animate(clipOpacity, 0, CLIP_RELEASE_TRANSITION).finished,
      ])
      if (!isMountedRef.current) return

      // The pen rolls a few millimetres — its purpose is finished. A small,
      // one-way settle, never reset until replay.
      await Promise.all([
        animate(penRotate, -14, PEN_ROLL_TRANSITION).finished,
        animate(penX, 3, PEN_ROLL_TRANSITION).finished,
      ])
      if (!isMountedRef.current) return

      // The sheet lifts — separating from the surface, not folding. A
      // small rotate sells the physical lift; scale settles back to 1
      // before the envelope morph below touches scaleX, so the two never
      // compound into "enlarged and narrowed" at once.
      await Promise.all([
        animate(paperY, -10, LIFT_TRANSITION).finished,
        animate(paperScale, 1.02, LIFT_TRANSITION).finished,
        animate(paperRotate, -2, LIFT_TRANSITION).finished,
      ])
      if (!isMountedRef.current) return
      await animate(paperScale, 1, { duration: 0.2, ease: easing.inOut }).finished
      if (!isMountedRef.current) return

      // It leans toward Scope — Scope does not move. Read his actual
      // rendered position directly off the one shared <Scope> instance
      // (data-slot is companion-scope.tsx's own stable hook) rather than
      // his position math, since his rendered size varies with
      // dockConfig.scale and this avoids re-deriving that here. Only
      // GLIDE_DISTANCE_FRACTION of the distance is actually traveled — the
      // remaining gap is closed by light, not motion (see below), so this
      // reads as a lean-in, not the dominant gesture of the beat.
      const scopeEl = document.querySelector<HTMLElement>('[data-slot="companion-scope"]')
      const paperEl = paperRef.current
      if (scopeEl && paperEl) {
        const scopeRect = scopeEl.getBoundingClientRect()
        const paperRect = paperEl.getBoundingClientRect()
        const deltaX = (scopeRect.left + scopeRect.width / 2 - (paperRect.left + paperRect.width / 2)) * GLIDE_DISTANCE_FRACTION
        const deltaY = (scopeRect.top + scopeRect.height / 2 - (paperRect.top + paperRect.height / 2)) * GLIDE_DISTANCE_FRACTION
        // The glow starts building in the same breath as the lean-in, not
        // after it settles — his light reaches for the letter, the letter
        // doesn't travel to a light that was already waiting there.
        await Promise.all([
          animate(paperX, paperX.get() + deltaX, springs.layout).finished,
          animate(paperY, paperY.get() + deltaY, springs.layout).finished,
          animate(paperRotate, 0, springs.layout).finished,
          animate(arrivalGlow, 1, ARRIVAL_TRANSITION).finished,
        ])
      } else {
        await animate(arrivalGlow, 1, ARRIVAL_TRANSITION).finished
      }
      if (!isMountedRef.current) return

      setScene("delivering")

      // Claimed by the light and shaped into an envelope in the same
      // breath — "catching the light" and "becoming an envelope" are one
      // transformation here, never two sequential tricks.
      await animate(envelopeProgress, 1, ENVELOPE_TRANSITION).finished
      if (!isMountedRef.current) return

      // Accepted — tucked away, as if into an internal compartment. The
      // glow recedes in the same beat so nothing lingers once the letter
      // is gone.
      await Promise.all([
        animate(paperScale, 0, ACCEPT_TRANSITION).finished,
        animate(paperOpacity, 0, ACCEPT_TRANSITION).finished,
        animate(arrivalGlow, 0, ACCEPT_TRANSITION).finished,
      ])
      if (!isMountedRef.current) return

      // The original, preferred reaction: a small, genuine "happy" hop
      // (scope-motion.ts) rather than a separate acknowledgment mechanism
      // — a reaction to what the visitor made, never a celebration of
      // itself. Self-resolves back to an ordinary mood after its own fixed
      // hold time, same contract as every other caller of this mood.
      setIsCelebrating(true)
      await wait(SCOPE_HAPPY_HOLD_MS)
      if (!isMountedRef.current) return
      setIsCelebrating(false)
      await wait(REST_PAUSE_MS)
      if (!isMountedRef.current) return

      // Scope has finished his mission but still inhabits the world: scene
      // flips to "resting," which (below, in the JSX) both reveals the
      // confirmation copy and shifts the ScopeDock's own rendered position
      // and resting config to a quiet corner of this same panel. That
      // config/position change is ordinary, declarative re-rendering, not
      // an imperative animate() call — CompanionScope's own dock-follow
      // effect (unrelated to this file) picks it up and travels there via
      // its existing heavy, calm springs.companion, then resumes ordinary
      // idle personality/presence on its own. Nothing here ever commandeers
      // Scope's own position or mood directly, which is exactly why he
      // never needs to be "released" — he was never held.
      setScene("resting")
    }

    void runSequence()
  }, [shouldReduceMotion, clipOpacity, clipRotate, clipY, paperOpacity, paperRotate, paperScale, paperX, paperY, penRotate, penX, envelopeProgress, arrivalGlow])

  // "Scope naturally returns" — resets every piece of local paper/pen/
  // envelope state and remounts <ContactForm> (via the key below) for a
  // genuinely blank, fully interactive form, no page reload.
  const handleReplay = React.useCallback(() => {
    hasSequencePlayedRef.current = false
    setIsSubmittingIdea(false)
    resetPaperState()
    setResetCount((n) => n + 1)
    setScene("ready")
  }, [resetPaperState])

  const dockMood: ScopeMood =
    scene === "resting"
      ? "idle"
      : isCelebrating
        ? "happy"
        : scene === "sealing" || scene === "delivering"
          ? "observe"
          : isSubmittingIdea
            ? "curious"
            : "idle"

  return (
    <div
      ref={deskRef}
      className="border-border/60 from-muted/50 to-muted/10 relative overflow-hidden rounded-4xl border bg-gradient-to-b p-8 backdrop-blur-sm sm:p-10 lg:p-14"
    >
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 opacity-10" />

      {/* The workspace — desk, lighting, Scope — never disappears. Only
          the letter itself leaves, and the content column swaps from the
          letter to the quiet ending + a replay invitation the moment the
          mission is accepted, inside this same, permanent frame. */}
      <div className="relative flex flex-col gap-10 sm:flex-row sm:items-start sm:gap-16">
        {/* The ambient bloom — Scope's own warm light reaching toward the
            letter, per this file's own top comment. Anchored toward his
            side of the panel (not precisely rect-measured — an ambient
            wash, not a spotlight, doesn't need to be) and layered behind
            everything (`-z-10`) via a negative z-index, since this element
            is itself `position: absolute` and would otherwise paint above
            the two normal-flow columns regardless of DOM order. */}
        <motion.div
          aria-hidden="true"
          style={{ opacity: arrivalGlow }}
          className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-2/3 sm:w-1/2"
        >
          <div className="bg-scope-warm absolute top-1/2 left-0 size-64 -translate-y-1/2 rounded-full opacity-30 blur-3xl sm:size-80" />
        </motion.div>

        <div
          className={cn(
            "flex sm:w-32 sm:shrink-0",
            // Once resting: Scope calmly relocates to a corner of this same
            // panel rather than staying in the writing-time spot beside the
            // desk — a real layout change, not a visual trick, since
            // CompanionScope measures wherever this element actually sits.
            scene === "resting" && "sm:order-2 sm:ml-auto sm:self-end"
          )}
        >
          <ScopeDock
            id="contact"
            config={{
              mood: dockMood,
              scale: scene === "resting" ? 0.85 : 1,
              facing: scene === "resting" ? 12 : 0,
              attentionTarget: scene === "ready" ? paperRef : undefined,
            }}
            className="size-28 sm:size-32"
          />
        </div>

        <div className="min-h-64 flex-1 sm:max-w-md">
          <AnimatePresence mode="wait">
            {scene === "resting" ? (
              <motion.div
                key="resting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: easing.out }}
                className="flex flex-col items-start gap-4 py-2"
              >
                <p className="text-muted-foreground text-base sm:text-lg">{CONTACT_ENDING_LINE}</p>
                <Button variant="ghost" onClick={handleReplay} className="h-auto px-0 text-sm">
                  {CONTACT_FORM_COPY.replayLabel}
                </Button>
              </motion.div>
            ) : (
              <Reveal key="letter">
                <motion.div
                  ref={paperRef}
                  style={{
                    x: paperX,
                    y: paperY,
                    scale: paperScale,
                    scaleX: paperScaleX,
                    rotate: paperRotate,
                    opacity: paperOpacity,
                  }}
                  className="bg-background/20 relative rounded-2xl p-6 sm:p-8"
                >
                  {/* the letter catching the light itself — a soft warm
                      wash, not a solid overlay, so the still-visible
                      (read-only) form underneath never becomes illegible. */}
                  <motion.div
                    aria-hidden="true"
                    style={{ opacity: arrivalGlow }}
                    className="from-scope-warm/25 pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br to-transparent"
                  />

                  {/* the flap — a plain triangular shape, not an origami
                      animation; only its entrance (opacity/scaleY) is
                      animated, never a fold. */}
                  <motion.div
                    aria-hidden="true"
                    style={{
                      opacity: flapOpacity,
                      scaleY: flapScaleY,
                      clipPath: "polygon(0 0, 100% 0, 50% 65%)",
                      transformOrigin: "top",
                    }}
                    className="bg-background/40 border-border/30 absolute inset-x-6 top-0 h-8 border-b sm:inset-x-8"
                  />

                  {/* present from the very start, meaningless while
                      writing, suddenly meaningful the moment it releases —
                      "this has always been a physical sheet of paper." */}
                  <motion.span
                    aria-hidden="true"
                    style={{ opacity: clipOpacity, rotate: clipRotate, y: clipY }}
                    className="text-muted-foreground absolute -top-3 left-1/2 -translate-x-1/2"
                  >
                    <Paperclip className="size-5" />
                  </motion.span>

                  <motion.span
                    aria-hidden="true"
                    style={{ rotate: penRotate, x: penX }}
                    className="text-muted-foreground absolute top-4 right-4 sm:top-5 sm:right-5"
                  >
                    <PenLine className="size-4" />
                  </motion.span>

                  <ContactForm
                    key={resetCount}
                    onFirstInteraction={acknowledge}
                    onSubmittingChange={setIsSubmittingIdea}
                    onDelivered={handleDelivered}
                  />
                </motion.div>
              </Reveal>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export { ContactDesk }
