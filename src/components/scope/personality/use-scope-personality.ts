"use client"

import * as React from "react"
import { animate, useMotionValue, type MotionValue, type Transition } from "framer-motion"

import { useIsReducedMotion } from "@/hooks/use-is-reduced-motion"
import { SCOPE_STILLNESS_FADE_MS } from "../scope-motion"
import { computeAttentionOffset } from "./attention-target"
import {
  ANTICIPATE_TRANSITION,
  BLINK_PATTERNS,
  PERSONALITY_GESTURES,
  PERSONALITY_GESTURE_NAMES,
  TOUCH_NOTICE_POOL,
  type PersonalityGestureName,
} from "./personality-gestures"
import { createShuffleBag, type ShuffleBag } from "./shuffle-bag"

// How long Scope must go undisturbed before it does something small on its
// own. Randomized per wait, never a fixed interval, so it never reads as a
// loop with a tell.
const MIN_IDLE_DELAY_MS = 3000
const MAX_IDLE_DELAY_MS = 7000

function randomDelay() {
  return MIN_IDLE_DELAY_MS + Math.random() * (MAX_IDLE_DELAY_MS - MIN_IDLE_DELAY_MS)
}

// SPR-011 architectural fix — the root cause of a real deadlock: every
// "hold at the peak, then continue" step (runGesture's pool-gesture hold,
// runLookAt's hold, runTouch's three holds) used to capture its own
// setTimeout id into the SAME closure variable the idle scheduler's own
// scheduleNext() used for its "when's the next gesture" timer. Any
// pointermove anywhere on the page (onActivity, entirely unrelated to
// whichever hold happened to be in flight) called scheduleNext(), which
// unconditionally cleared that shared variable — silently orphaning
// whichever hold's resolve callback currently occupied it. That hold's
// `await` then never settled, its owning async function never returned,
// and (once touch() started depending on that function's own completion
// to reset its cooldown flags) the whole personality system could
// deadlock permanently from nothing more than ordinary mouse movement —
// confirmed live, reproducibly, before this fix.
//
// The fix is ownership, not another guard: `wait()`'s own setTimeout id
// never leaves this function's local scope, so nothing outside a given
// hold — not the idle scheduler, not any other gesture — can ever reach
// in and clear it. Every hold below uses this instead of hand-rolling its
// own `new Promise((resolve) => { sharedVar = setTimeout(resolve, ms) })`.
// The idle scheduler's own timer (idleTimeoutId, in the effect below)
// is the one timer that legitimately needs external cancellation
// (onActivity pushing it out, cleanup canceling a pending call) — it
// stays a variable for exactly that reason, but nothing else touches it.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

// SPR-005 — "look at target": an occasional glance toward a registered
// point of interest (a project world's own ball/graph marker — see
// ScopeDockConfig.attentionTarget), layered into the exact same scheduling
// rhythm as every other gesture below rather than a separate timer. The
// reach/range geometry lives in attention-target.ts, kept out of this file
// so its own arithmetic doesn't add to this hook's complexity.
const ATTENTION_LOOK_CHANCE = 0.35
const ATTENTION_HOLD_MS = 900
const ATTENTION_TO_TRANSITION: Transition = { type: "spring", stiffness: 90, damping: 16, mass: 0.6 }
const ATTENTION_BACK_TRANSITION: Transition = { type: "spring", stiffness: 80, damping: 20, mass: 0.6 }

// Living Moment 001, "The Stillness Moment" (docs/scope-docs/scope/
// LIVING_SCOPE.md) — the foundational Living Moment, built from
// subtraction rather than addition: breathing itself briefly stops. The
// rarity comes from the cause being genuinely rare, not from a probability
// roll layered on top (see MOMENT_PRINCIPLES.md's "rarity... reflects how
// significant the underlying cause actually is") — true, uninterrupted
// inactivity this long is already an unusual thing for a visitor to do.
// Three minutes of real stillness (no pointer, no scroll, no keys) before
// it's even eligible; once played, it does not repeat within the same
// uninterrupted stretch — only genuine activity re-arms it (see
// onActivity below), so a visitor who simply walks away for an hour sees
// it exactly once, not on a repeating cadence.
const STILLNESS_MIN_INACTIVITY_MS = 180_000
const STILLNESS_HOLD_MS = 2500

function pickGesture(exclude: PersonalityGestureName | null): PersonalityGestureName {
  const pool = exclude
    ? PERSONALITY_GESTURE_NAMES.filter((name) => name !== exclude)
    : PERSONALITY_GESTURE_NAMES
  return pool[Math.floor(Math.random() * pool.length)]
}

function isBlinkGesture(
  name: PersonalityGestureName
): name is "blink" | "double-blink" | "slow-blink" {
  return name in BLINK_PATTERNS
}

// Behavioural states, not animation states — "gesturing" says nothing about
// *which* gesture or its numbers (that's personality-gestures.ts's job).
// Exposed only for introspection/future use today; the actual scheduling is
// driven by refs/closures below (React state updates are async and
// unsuitable for driving precise imperative timers — the same reason
// ScopeDockContext's own acknowledge() pairs a setTimeout ref with a
// parallel piece of React state rather than relying on state alone).
type PersonalityState = "dormant" | "restless" | "gesturing"
type PersonalityAction =
  | { type: "armed" }
  | { type: "activity" }
  | { type: "gesture-start" }
  | { type: "gesture-end" }
  | { type: "disarmed" }

function personalityReducer(state: PersonalityState, action: PersonalityAction): PersonalityState {
  switch (action.type) {
    case "armed":
      return state === "dormant" ? "restless" : state
    case "activity":
      return state === "gesturing" ? state : "dormant"
    case "gesture-start":
      return "gesturing"
    case "gesture-end":
      return "restless"
    case "disarmed":
      return "dormant"
  }
}

interface ScopePersonality {
  rotate: MotionValue<number>
  y: MotionValue<number>
  scale: MotionValue<number>
  blinkScaleY: MotionValue<number>
  eyeOffsetX: MotionValue<number>
  eyeOffsetY: MotionValue<number>
  eyeConverge: MotionValue<number>
  antennaFlex: MotionValue<number>
  /**
   * Living Moment 001 — true while Scope is holding the Stillness Moment.
   * Forwarded into useScopeMotion(mood, isStill) at the scope.tsx
   * composition point, which owns the actual breathing loop and decides
   * whether this produces any visible effect (see that hook's own
   * comment). A plain boolean, not a new animated channel — it gates an
   * existing one. React state, deliberately, not a ref like everything
   * else in this file: this is the one value that needs to trigger a
   * re-render (of whichever consumer reads it), since it changes what
   * scope.tsx passes to a sibling hook — every other piece of state here
   * only ever needs synchronous truth inside this hook's own closures.
   */
  isStill: boolean
  /**
   * The "trust" touch interaction — call on a direct click/tap on Scope's
   * own painted shapes (see scope.tsx). A stable function reference; safe
   * to use directly as an onClick handler. No-ops silently (never throws)
   * while reduced motion/suspended, or while any gesture — autonomous or a
   * prior touch — is already mid-flight, per the same "ignore repeated
   * interactions until the previous one has fully completed" contract the
   * site owner asked for.
   */
  touch: () => void
}

// How long Scope "remembers" being touched before quietly becoming shy
// again — "roughly 20-30 seconds," per the site owner's own brief. Reset
// on every successful touch, so it only ever fires after a genuine pause.
const FAMILIARITY_DECAY_MS = 25000

type TouchStage = 0 | 1 | 2

// Scope's autonomous idle-gesture layer — the "why and when" of occasional,
// unprompted micro-behaviour. SCOPE_UNDERSTANDING.md §5 already treats
// idle's breathing loop (SCOPE_IDLE_ANIMATE in ../scope-motion.ts) as
// Scope's accepted resting *presence*, not "a waiting state filled with a
// loop." This hook is a bounded, restrained extension of that same
// precedent — an occasional, non-repeating variation layered on top of the
// breathing baseline — not a new category of decorative motion.
//
// A third independent layer, following the exact pattern already
// established by useScopeMotion (mood — see ../use-scope-motion.ts) and
// useScopePresence (cursor physics — see ../use-scope-presence.ts): a
// self-contained hook returning plain MotionValues, composed into scope.tsx
// alongside the other two, with zero knowledge of either. Works identically
// wherever <Scope> is rendered, including the provider-less /scope lab
// route (src/app/scope/scope-lab.tsx) — no React context involved.
//
// SPR-003.3 (character finalization): the returned set grew from
// {rotate, y, focusOpacity} to the seven values above — eyeOffsetX/Y and
// eyeConverge are additive with presence's own eyeX/eyeY (composed via a
// useTransform sum at the scope.tsx composition point, not here);
// blinkScaleY is multiplicative with mood's own eyeScaleY (composed via a
// nested <motion.g>, not useTransform — mood's eyeScaleY isn't a
// MotionValue, so it can't be combined that way, a mistake caught before
// writing this file). `focusOpacity` is retired: true blinks (a real
// scaleY close-open) now do the "something flickered to life" job
// literally, per VISUAL_LANGUAGE.md v2.0's "expression comes only from
// movement, timing and spacing."
//
// "Movement resumes → attentive again" still needs no new visual state:
// any cursor activity simply defers the idle timer (see the debounce
// below), so a gesture can never fire while the visitor is actively
// moving the mouse.
function useScopePersonality(
  scopeRef: React.RefObject<HTMLElement | null>,
  attentionTarget?: React.RefObject<Element | null>,
  suspended = false,
  /**
   * SPR-011 ("trust" touch interaction) — any value whose *identity change*
   * means "Scope moved on to somewhere else" (in practice, the active dock
   * id) resets the touch familiarity progression back to shy. A plain
   * optional value, exactly like `attentionTarget` above and for the same
   * reason: this hook stays fully context-free and keeps working in the
   * provider-less /scope debug lab, which simply never passes this and so
   * never resets on "leaving a dock" — correct for that standalone page.
   */
  resetSignal?: string | null
): ScopePersonality {
  const isReduced = useIsReducedMotion()

  const rotate = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const blinkScaleY = useMotionValue(1)
  const eyeOffsetX = useMotionValue(0)
  const eyeOffsetY = useMotionValue(0)
  const eyeConverge = useMotionValue(0)
  const antennaFlex = useMotionValue(0)

  const [, dispatch] = React.useReducer(personalityReducer, "dormant")
  // Persists across the effect's own armed/disarmed re-runs (e.g. Scope
  // leaves and returns to idle) without needing to live at module scope,
  // which would leak state across every <Scope> instance ever mounted.
  const lastGestureRef = React.useRef<PersonalityGestureName | null>(null)

  // `attentionTarget` changes identity every time the active dock changes
  // (a different world's ref, or none) — but the scheduling effect below
  // deliberately stays mounted across dock/mood changes (only `armed`
  // reruns it, per the SPR-003.4 fix). Mirroring that fix's own mistake
  // here would mean a stale target from whichever dock was active when the
  // effect last mounted. A "latest value" ref, synced on every render,
  // keeps runGesture() reading the current target without needing the big
  // effect to restart. `scopeRef` doesn't need this: it's the same stable
  // ref object for Scope's whole lifetime, and only `.current` is read
  // fresh each time, which a plain ref already gives for free.
  const attentionTargetRef = React.useRef(attentionTarget)
  React.useEffect(() => {
    attentionTargetRef.current = attentionTarget
  }, [attentionTarget])

  // SPR-011 — the "trust" touch interaction's own state, kept alongside
  // the rest rather than in a parallel hook/system per the site owner's
  // own instruction. Refs, not React state, for the same reason
  // lastGestureRef/attentionTargetRef already are: touch() (below) needs
  // synchronous, immediate truth from a plain click handler, not a value
  // that only updates on the next render.
  //
  // - isGesturingRef: true while ANYTHING is playing — an autonomous
  //   gesture or a touch reaction — checked by touch() itself so a click
  //   during either kind is ignored, not just during another touch.
  // - isTouchActiveRef: true only while a touch reaction specifically is
  //   playing — checked by the autonomous scheduler (runGesture, below) so
  //   it defers rather than fighting a touch reaction for the same motion
  //   values; it does not need to reach into or cancel that scheduler's own
  //   pending timer to do so (see runGesture's own guard).
  // - familiarityRef: 0/1/2 — first/second/third-plus click. Caps at 2
  //   rather than looping back to 0 once trust is earned; only resets via
  //   the decay timer below or a resetSignal change.
  // - runTouchRef: the current armed run's own runTouch closure (defined
  //   inside the scheduling effect below, where it can share that effect's
  //   activeControls/cancelled machinery) — set to null whenever disarmed
  //   or torn down, so touch() calling in that state is a clean, silent
  //   no-op rather than reaching into a stale closure.
  const isGesturingRef = React.useRef(false)
  const isTouchActiveRef = React.useRef(false)
  const familiarityRef = React.useRef<TouchStage>(0)
  const familiarityDecayTimeoutRef = React.useRef<number | undefined>(undefined)
  const runTouchRef = React.useRef<((stage: TouchStage) => Promise<void>) | null>(null)

  // The first-click reaction's own shuffle bag (see shuffle-bag.ts and
  // TOUCH_NOTICE_POOL) — a lazy useState initializer, not a ref, since
  // reading ref.current during render (the classic "lazy ref init" idiom)
  // is disallowed by this project's hooks lint; useState's initializer
  // function is still guaranteed to run exactly once per mount, giving the
  // same stable, created-once instance this needs.
  const [noticeBag] = React.useState<ShuffleBag<PersonalityGestureName>>(() =>
    createShuffleBag(TOUCH_NOTICE_POOL)
  )

  // Living Moment 001 — see the interface's own comment on isStill above
  // for why this is React state rather than a ref, unlike everything else
  // in this file.
  const [isStill, setIsStill] = React.useState(false)

  // "Leaves wherever he was touched" — generalized as "resetSignal's own
  // identity changed," never anything Hero-specific (see this param's own
  // comment above). Also correctly resets on first mount (familiarity is
  // already 0 then, a harmless no-op). The shuffle bag resets alongside
  // familiarity — becoming shy again should also mean rediscovering the
  // same small variety of first reactions, not picking up mid-bag.
  React.useEffect(() => {
    familiarityRef.current = 0
    noticeBag.reset()
    window.clearTimeout(familiarityDecayTimeoutRef.current)
  }, [resetSignal, noticeBag])

  const touch = React.useCallback(() => {
    const run = runTouchRef.current
    if (!run || isGesturingRef.current || isTouchActiveRef.current) return

    const stage = familiarityRef.current
    isTouchActiveRef.current = true
    isGesturingRef.current = true
    dispatch({ type: "gesture-start" })

    void run(stage).finally(() => {
      isTouchActiveRef.current = false
      isGesturingRef.current = false
      dispatch({ type: "gesture-end" })
      familiarityRef.current = Math.min(stage + 1, 2) as TouchStage
      window.clearTimeout(familiarityDecayTimeoutRef.current)
      familiarityDecayTimeoutRef.current = window.setTimeout(() => {
        familiarityRef.current = 0
        noticeBag.reset()
      }, FAMILIARITY_DECAY_MS)
    })
  }, [noticeBag])

  // Gated only on reduced-motion, deliberately NOT on `mood`. This hook used
  // to also require `mood === "idle"`, back when idle was the only resting
  // state Scope could be in. The companion dock system (SPR-003.4) then
  // added a second resting mood — "observe", for the demo-section dock —
  // and that condition silently broke: every idle blink/gesture, plus this
  // effect's listeners, got torn down the instant Scope docked anywhere
  // that wasn't literally "idle", and never recovered until mood happened
  // to become "idle" again. Personality is designed to be a fully
  // independent layer, composed additively/multiplicatively with Motion and
  // Presence at the scope.tsx composition point (see the comments there) —
  // it has no business re-deciding whether "now" is an appropriate moment
  // for mood based on a hardcoded string it doesn't own. Presence already
  // runs unconditionally the same way; Personality now matches it.
  // SPR-006: `suspended` is the theme-transition curtain sequence's "stop
  // idle gestures" signal — the exact same disarm path reduced-motion
  // already takes below (reset everything to neutral, tear down the
  // scheduler), just temporary rather than permanent for the session.
  const armed = !isReduced && !suspended

  // Living Moment 001's isStill reset on disarm is deliberately done here,
  // during render, rather than inside the effect below — this project's
  // hooks lint disallows calling a state setter synchronously in an
  // effect body. React's own docs carve out exactly this case ("adjust
  // state when a prop changes," comparing against the previous value
  // during render) — done with a second piece of state rather than a ref,
  // since this project's lint also disallows reading/writing a ref during
  // render. It also avoids a real bug a naive effect-body reset would
  // still have missed: if disarmed while stillness is mid-flight and
  // re-armed before that sequence's own cleanup runs, isStill could
  // otherwise stay stuck `true` indefinitely (nothing else ever sets it
  // back to false) — this fires on every disarm transition specifically,
  // closing that gap.
  const [wasArmed, setWasArmed] = React.useState(armed)
  if (wasArmed !== armed) {
    setWasArmed(armed)
    if (!armed && isStill) setIsStill(false)
  }

  React.useEffect(() => {
    if (!armed) {
      dispatch({ type: "disarmed" })
      rotate.set(0)
      y.set(0)
      scale.set(1)
      blinkScaleY.set(1)
      eyeOffsetX.set(0)
      eyeOffsetY.set(0)
      eyeConverge.set(0)
      antennaFlex.set(0)
      runTouchRef.current = null
      isGesturingRef.current = false
      isTouchActiveRef.current = false
      familiarityRef.current = 0
      noticeBag.reset()
      window.clearTimeout(familiarityDecayTimeoutRef.current)
      return
    }

    dispatch({ type: "armed" })

    let cancelled = false
    // The idle scheduler's own timer, and ONLY the idle scheduler's — see
    // this file's own note on wait() above for why every gesture's hold
    // phase deliberately does not use a variable like this one.
    let idleTimeoutId: number | undefined
    let activeControls: ReturnType<typeof animate>[] = []

    // Living Moment 001's own eligibility state. `lastActivityAt` tracks
    // real elapsed time since the last genuine interaction — deliberately
    // separate from the ordinary idle-gesture delay above, which only ever
    // needs to remember a few seconds, not a multi-minute stretch.
    // `hasPlayedThisStretch` is what keeps the moment from repeating on a
    // cadence while a visitor simply stays away — only onActivity (real
    // interaction) re-arms it, not the passage of time alone.
    let lastActivityAt = Date.now()
    let hasPlayedStillnessThisStretch = false

    function scheduleNext(delay: number) {
      window.clearTimeout(idleTimeoutId)
      idleTimeoutId = window.setTimeout(runGesture, delay)
    }

    // Any real interaction — cursor, scroll, keyboard — or the tab
    // regaining visibility pushes the idle timer back out and resets the
    // Stillness Moment's own longer clock; a debounce, not a periodic
    // poll. This is the entire mechanism behind "occasionally, when left
    // alone." Scroll and keydown are listened for here for the first time
    // (previously only pointermove/pointerdown) — the Stillness Moment's
    // own trigger explicitly requires "no scrolling... no keyboard
    // interaction," which the ordinary gesture scheduler's own "any
    // activity" framing already implied but never fully covered.
    function onActivity() {
      dispatch({ type: "activity" })
      lastActivityAt = Date.now()
      hasPlayedStillnessThisStretch = false
      scheduleNext(randomDelay())
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") onActivity()
      else window.clearTimeout(idleTimeoutId)
    }

    async function runBlink(name: "blink" | "double-blink" | "slow-blink") {
      const pattern = BLINK_PATTERNS[name]
      activeControls = [animate(blinkScaleY, pattern.keyframes, pattern.transition)]
      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
    }

    // Living Moment 001, "The Stillness Moment." Deliberately touches none
    // of this hook's own motion values — there is no gesture to play. It
    // only sets isStill, which useScopeMotion (composed at scope.tsx,
    // see that hook's own comment) reads to decide whether to pause the
    // breathing loop. No anticipation, no eye motion, no antenna flex —
    // "no blinking, no looking around" is already true for free here,
    // since nothing in the ordinary gesture pool is running concurrently
    // (this only ever plays from inside runGesture, in the same single-
    // flight slot every other gesture already uses).
    async function runStillness() {
      setIsStill(true)
      await wait(SCOPE_STILLNESS_FADE_MS)
      if (cancelled) return

      await wait(STILLNESS_HOLD_MS)
      if (cancelled) return

      setIsStill(false)
      await wait(SCOPE_STILLNESS_FADE_MS)
    }

    // Plays one named PERSONALITY_GESTURES entry's full anticipate → to →
    // hold → back sequence. Shared by the autonomous scheduler (runGesture,
    // below) AND the touch interaction's own first-click reaction (see
    // TOUCH_NOTICE_POOL/noticeBag) — a reused gesture is genuinely
    // reused code here, never a second copy of the same timing tuned twice.
    async function playGesture(name: PersonalityGestureName) {
      if (isBlinkGesture(name)) {
        await runBlink(name)
        return
      }

      const spec = PERSONALITY_GESTURES[name]

      // Anticipation: a brief, small counter-move before the real gesture,
      // additive to total duration (not stolen from holdMs). Sequential
      // animate() calls, not a single keyframe array — `to`/`back` are
      // springs, and springs only settle a single start→end pair.
      if (spec.anticipate) {
        activeControls = []
        if (spec.anticipate.rotate !== undefined)
          activeControls.push(animate(rotate, spec.anticipate.rotate, ANTICIPATE_TRANSITION))
        if (spec.anticipate.y !== undefined)
          activeControls.push(animate(y, spec.anticipate.y, ANTICIPATE_TRANSITION))
        await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
        if (cancelled) return
      }

      activeControls = []
      if (spec.body?.rotate !== undefined) activeControls.push(animate(rotate, spec.body.rotate, spec.to))
      if (spec.body?.y !== undefined) activeControls.push(animate(y, spec.body.y, spec.to))
      if (spec.body?.scale !== undefined) activeControls.push(animate(scale, spec.body.scale, spec.to))
      if (spec.eyeOffset?.x !== undefined)
        activeControls.push(animate(eyeOffsetX, spec.eyeOffset.x, spec.to))
      if (spec.eyeOffset?.y !== undefined)
        activeControls.push(animate(eyeOffsetY, spec.eyeOffset.y, spec.to))
      if (spec.eyeScale !== undefined) activeControls.push(animate(blinkScaleY, spec.eyeScale, spec.to))
      if (spec.eyeConverge !== undefined)
        activeControls.push(animate(eyeConverge, spec.eyeConverge, spec.to))
      if (spec.antennaFlex !== undefined)
        activeControls.push(animate(antennaFlex, spec.antennaFlex, spec.to))

      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
      if (cancelled) return

      await wait(spec.holdMs)
      if (cancelled) return

      activeControls = []
      if (spec.body?.rotate !== undefined) activeControls.push(animate(rotate, 0, spec.back))
      if (spec.body?.y !== undefined) activeControls.push(animate(y, 0, spec.back))
      if (spec.body?.scale !== undefined) activeControls.push(animate(scale, 1, spec.back))
      if (spec.eyeOffset?.x !== undefined) activeControls.push(animate(eyeOffsetX, 0, spec.back))
      if (spec.eyeOffset?.y !== undefined) activeControls.push(animate(eyeOffsetY, 0, spec.back))
      if (spec.eyeScale !== undefined) activeControls.push(animate(blinkScaleY, 1, spec.back))
      if (spec.eyeConverge !== undefined) activeControls.push(animate(eyeConverge, 0, spec.back))
      if (spec.antennaFlex !== undefined) activeControls.push(animate(antennaFlex, 0, spec.back))

      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
    }

    // Reads both rects live at fire-time (never cached) so it stays correct
    // even though the target may itself be in motion (a bouncing ball, a
    // point riding a graph) — geometry lives in attention-target.ts.
    async function runLookAt(target: Element) {
      const scopeEl = scopeRef.current
      if (!scopeEl) return

      const { dx, dy } = computeAttentionOffset(
        scopeEl.getBoundingClientRect(),
        target.getBoundingClientRect()
      )

      activeControls = [
        animate(eyeOffsetX, dx, ATTENTION_TO_TRANSITION),
        animate(eyeOffsetY, dy, ATTENTION_TO_TRANSITION),
      ]
      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
      if (cancelled) return

      await wait(ATTENTION_HOLD_MS)
      if (cancelled) return

      activeControls = [
        animate(eyeOffsetX, 0, ATTENTION_BACK_TRANSITION),
        animate(eyeOffsetY, 0, ATTENTION_BACK_TRANSITION),
      ]
      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
    }

    // SPR-011 — the "trust" touch interaction's three reactions, refined
    // once live: the first click no longer always plays the same motion.
    // "Never presented immediately... discovered gradually" — a visitor
    // who sees the identical reaction every first click would learn the
    // trick instead of wondering about the character. touch() (outside
    // this effect) owns the cooldown/familiarity bookkeeping; this
    // function only ever plays one stage's motion.
    async function runTouch(stage: TouchStage) {
      if (stage === 0) {
        // First click — one of a small, shuffled variety (see
        // TOUCH_NOTICE_POOL/noticeBag and playGesture above), never the
        // same gesture twice in a row. Deliberately NOT its own bespoke
        // animation: every candidate already exists as a well-tuned,
        // sub-second autonomous gesture, so reusing playGesture here is
        // genuine code reuse, not a second implementation of the same idea.
        await playGesture(noticeBag.next())
        return
      }

      if (stage === 1) {
        // Second click — always the same, deliberately: "I'm starting to
        // trust you" reads as recognition *because* it's consistent, not
        // varied, unlike stage 0. A quiet laugh — a deeper squint than any
        // stage-0 pool gesture ever uses, still shallower than stage 2's
        // (which stays the deepest, most expressive moment in the whole
        // system), paired with a small, soft, restrained lift — warmer and
        // more deliberate than a flicker, never as large as the full
        // stretch below.
        activeControls = [
          animate(y, -3, { type: "spring", stiffness: 90, damping: 15, mass: 1 }),
          animate(blinkScaleY, 0.4, { duration: 0.2, ease: "easeOut" }),
        ]
        await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
        if (cancelled) return

        await wait(260)
        if (cancelled) return

        activeControls = [
          animate(y, 0, { type: "spring", stiffness: 80, damping: 18, mass: 1 }),
          animate(blinkScaleY, 1, { duration: 0.25, ease: "easeInOut" }),
        ]
        await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
        return
      }

      // stage === 2 — the full stretch: "a sleepy cat... Baymax... Pixar
      // squash & stretch. Never elastic. Never exaggerated." Smaller and
      // slower than mood "happy"'s hop (y -14) — this must read as
      // settling into a stretch, never jumping. The eyes hold at the
      // deepest squint anywhere in the personality system — below the pool
      // gesture "squint" (0.6), above a blink's momentary dip (0.08) — for
      // long enough (~550ms) that it reads as a deliberate, happy
      // expression, never an involuntary blink. Per the site owner's own
      // resolved decision: still the same eye pill, pushed further than
      // anywhere else, never a new shape (see this file's own header and
      // docs/scope-docs/scope/ for why).
      activeControls = [animate(scale, 0.97, { type: "spring", stiffness: 120, damping: 14, mass: 0.8 })]
      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
      if (cancelled) return

      activeControls = [
        animate(scale, 1.07, { type: "spring", stiffness: 55, damping: 14, mass: 1.4 }),
        animate(y, -5, { type: "spring", stiffness: 55, damping: 14, mass: 1.4 }),
        animate(blinkScaleY, 0.22, { duration: 0.35, ease: "easeInOut" }),
      ]
      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
      if (cancelled) return

      await wait(550)
      if (cancelled) return

      activeControls = [
        animate(scale, 1, { type: "spring", stiffness: 60, damping: 16, mass: 1.2 }),
        animate(y, 0, { type: "spring", stiffness: 60, damping: 16, mass: 1.2 }),
        animate(blinkScaleY, 1, { duration: 0.4, ease: "easeInOut" }),
      ]
      await Promise.all(activeControls.map((c) => c.finished)).catch(() => {})
    }

    runTouchRef.current = runTouch

    async function runGesture() {
      // A touch reaction is playing — defer rather than fight it for the
      // same motion values. No need to cancel/reach into this scheduler's
      // own pending timer to do so; re-arming with a fresh random delay is
      // enough, and touch() never lets a click through while this is true
      // in the first place.
      if (isTouchActiveRef.current) {
        scheduleNext(randomDelay())
        return
      }

      dispatch({ type: "gesture-start" })
      isGesturingRef.current = true

      // Living Moment 001 gets first refusal, ahead of even the attention-
      // target glance below — the rarest, most deliberate moment in the
      // whole system should never lose a coin-flip to an ordinary idle
      // gesture on the one occasion it's actually eligible. Deterministic
      // once eligible, not an additional probability roll on top (see
      // this file's own comment on STILLNESS_MIN_INACTIVITY_MS): the
      // rarity already comes from how rarely true, uninterrupted
      // inactivity this long happens at all.
      const isStillnessEligible =
        !hasPlayedStillnessThisStretch && Date.now() - lastActivityAt >= STILLNESS_MIN_INACTIVITY_MS

      if (isStillnessEligible) {
        hasPlayedStillnessThisStretch = true
        await runStillness()
      } else {
        // A registered point of interest gets first refusal, at a fixed
        // probability, before falling through to the ordinary gesture pool
        // below — deliberately NOT added to PERSONALITY_GESTURE_NAMES itself
        // (see the comment on ATTENTION_* above): that pool is static data,
        // this is a live-computed target, and this branch leaves the
        // existing pool's selection/repeat-avoidance logic untouched.
        const attentionEl = attentionTargetRef.current?.current
        if (attentionEl && Math.random() < ATTENTION_LOOK_CHANCE) {
          await runLookAt(attentionEl)
        } else {
          const name = pickGesture(lastGestureRef.current)
          lastGestureRef.current = name
          await playGesture(name)
        }
      }

      if (!cancelled) {
        dispatch({ type: "gesture-end" })
        isGesturingRef.current = false
        scheduleNext(randomDelay())
      }
    }

    window.addEventListener("pointermove", onActivity)
    window.addEventListener("pointerdown", onActivity)
    window.addEventListener("scroll", onActivity, { passive: true })
    window.addEventListener("keydown", onActivity)
    document.addEventListener("visibilitychange", onVisibilityChange)
    scheduleNext(randomDelay())

    return () => {
      cancelled = true
      window.clearTimeout(idleTimeoutId)
      activeControls.forEach((controls) => controls.stop())
      window.removeEventListener("pointermove", onActivity)
      window.removeEventListener("pointerdown", onActivity)
      window.removeEventListener("scroll", onActivity)
      window.removeEventListener("keydown", onActivity)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      runTouchRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed])

  React.useEffect(() => {
    return () => window.clearTimeout(familiarityDecayTimeoutRef.current)
  }, [])

  return { rotate, y, scale, blinkScaleY, eyeOffsetX, eyeOffsetY, eyeConverge, antennaFlex, isStill, touch }
}

export { useScopePersonality }
