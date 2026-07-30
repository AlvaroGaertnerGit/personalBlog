"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { useScopePersonality } from "./personality/use-scope-personality"
import { SCOPE_GLOW_TRANSITION } from "./scope-motion"
import type { ScopeMood } from "./scope.types"
import { useCombinedMotionValue } from "./use-combined-motion-value"
import { useScopeMotion } from "./use-scope-motion"
import { useScopePresence } from "./use-scope-presence"

// Scope — the portfolio's companion. Canonical source of truth (SPR-003.3,
// "Character Finalization"): docs/scope-docs/scope/SCOPE.md and
// VISUAL_LANGUAGE.md (both v2.0), plus the reference image at
// docs/scope-docs/scope/references/image.png. Read those before changing
// anything about Scope's identity.
//
// A client component now that it animates — see the performance skill's
// "extract the interactive piece into its own client leaf" guidance; the
// Hero and every other place Scope is mounted stay Server Components.
//
// Deliberately a pure function of `mood`: no callback props, no internal
// mood state. Whoever controls mood (the /scope lab page today, other
// placements later) owns any lifecycle logic — e.g. "happy" resolving
// itself back to "idle" — see SCOPE_HAPPY_HOLD_MS in scope-motion.ts.
//
// Three independent layers compose here, each owning a different concern
// (Motion: how mood animates; Presence: cursor interaction; Personality:
// autonomous idle behaviour) — none of the three hooks knows about the
// other two; this component is the one place they're combined:
//
// - Mood (useScopeMotion) drives the body's `animate` (scale/rotate/y —
//   the idle breathing loop keeps running underneath) and each eye's
//   resting `scaleY` expression (`eyeScaleY`).
// - Presence (useScopePresence) drives cursor-derived `style` values:
//   body tilt (rotateX/rotateY), the eyes' gaze position (eyeX/eyeY, plus
//   a tiny always-on jitter baked in), the antenna's reactive sway
//   (antennaRotate), and the accent dot's proximity-based visibility
//   (interactionIntensity).
// - Personality (useScopePersonality) drives occasional idle gestures:
//   rotate/y/scale on the body, blinkScaleY on the eyes (multiplicative
//   with mood's own eyeScaleY — see the nested <motion.g> below, not a
//   useTransform combinator, since mood's eyeScaleY isn't a MotionValue),
//   eyeOffsetX/Y and eyeConverge on the eyes' gaze (additive with
//   presence's eyeX/eyeY), and antennaFlex on the antenna.
//
// Framer merges every transform-shaped style key (x, y, rotate, rotateX,
// rotateY, scale, scaleY, ...) on one style object into a single CSS
// transform automatically, so values from different hooks compose for
// free as long as they don't share a key name; where two independent
// values need to affect the *same* property (eye position, eye scaleY),
// they're combined explicitly below via useTransform (additive) or nested
// elements (multiplicative) — see the comments at each call site for why
// one technique was used over the other.
function Scope({
  mood = "idle",
  className,
  ...props
}: React.ComponentProps<"div"> & { mood?: ScopeMood }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { animate, transition, glow, eyeScaleY } = useScopeMotion(mood)
  const {
    rotateX,
    rotateY,
    eyeX,
    eyeY,
    parallaxX,
    parallaxY,
    shadowX,
    shadowY,
    shadowScaleX,
    antennaRotate,
    interactionIntensity,
  } = useScopePresence(ref)
  const {
    rotate: personalityRotate,
    y: personalityY,
    scale: personalityScale,
    blinkScaleY,
    eyeOffsetX,
    eyeOffsetY,
    eyeConverge,
    antennaFlex,
  } = useScopePersonality(mood)

  // Additive: presence's continuous gaze position + personality's
  // occasional look-up/down nudge. Both are real MotionValues — combined
  // via useCombinedMotionValue (see that file for why: Motion's own
  // multi-input useTransform, in both its zero-arg and array forms, didn't
  // reliably re-fire after the initial mount for this codebase's usage —
  // empirically verified in the browser, not assumed).
  const gazeX = useCombinedMotionValue([eyeX, eyeOffsetX], ([a, b]) => a + b)
  const gazeY = useCombinedMotionValue([eyeY, eyeOffsetY], ([a, b]) => a + b)
  // Convergence nudges each eye in an OPPOSITE direction from the shared
  // gaze — left eye inward is +x (toward center), right eye inward is −x.
  const leftEyeX = useCombinedMotionValue([gazeX, eyeConverge], ([a, b]) => a + b)
  const rightEyeX = useCombinedMotionValue([gazeX, eyeConverge], ([a, b]) => a - b)

  return (
    <div
      ref={ref}
      data-slot="scope"
      data-scope-mood={mood}
      aria-hidden="true"
      className={cn("relative", className)}
      {...props}
    >
      <motion.div
        aria-hidden="true"
        style={{ x: shadowX, y: shadowY, scaleX: shadowScaleX }}
        className="bg-scope-shell/30 absolute inset-6 -z-10 rounded-full blur-2xl"
      />
      <motion.div
        style={{
          rotateX,
          rotateY,
          rotate: personalityRotate,
          y: personalityY,
          scale: personalityScale,
          transformPerspective: 600,
        }}
        className="h-full w-full"
      >
        <motion.div animate={animate} transition={transition} className="h-full w-full">
        <svg viewBox="0 -30 160 210" className="h-full w-full">
          <defs>
            <linearGradient id="scope-shell-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--scope-shell)" />
              <stop
                offset="100%"
                stopColor="color-mix(in oklch, var(--scope-shell), var(--scope-details) 16%)"
              />
            </linearGradient>
          </defs>

          {/* display glow — brightens/dims per mood, warm (--scope-warm)
              since the face is the light source, not a neutral panel with
              an accent trim. */}
          <motion.rect
            x="14"
            y="14"
            width="132"
            height="128"
            rx="36"
            className="fill-scope-warm blur-md"
            initial={false}
            animate={{ opacity: glow * 0.5 }}
            transition={SCOPE_GLOW_TRANSITION}
            style={{ x: parallaxX, y: parallaxY }}
          />

          {/* feet */}
          <rect x="42" y="146" width="24" height="28" rx="12" className="fill-scope-details" />
          <rect x="92" y="146" width="24" height="28" rx="12" className="fill-scope-details" />

          {/* shell — a soft top-to-bottom shade plus a hairline edge
              stroke, so it stays legible even against a near-white
              background in light mode. A very slightly flattened ellipse
              (rx > ry) rather than a perfect circle — "almost spherical,
              slightly flattened at the bottom" per VISUAL_LANGUAGE.md. */}
          <ellipse
            cx="80"
            cy="78"
            rx="75"
            ry="71"
            fill="url(#scope-shell-gradient)"
            stroke="var(--scope-details)"
            strokeOpacity="0.1"
            strokeWidth="2"
          />

          {/* a soft top sheen suggesting a sculpted, matte-ceramic shell
              surface — deliberately faint and tucked near the top edge so
              it never competes with the face below it. */}
          <ellipse cx="70" cy="22" rx="34" ry="14" className="fill-scope-shell" opacity="0.12" />

          {/* antenna — required by VISUAL_LANGUAGE.md v2.0 ("tiny,
              elegant, flexible... an insect antenna, not technology... a
              subtle indicator of attention"). A sibling of the display
              group, not nested inside it: the display group's
              parallaxX/Y is specifically the "recessed glass" depth cue
              for the face; the antenna is an external shell feature and
              doesn't need that cue. Two nested groups compose two
              independent rotations with no combinator needed (rotation
              adds across nested transforms) — outer is presence's
              continuous, physically-lagging sway; inner is personality's
              occasional idle flex. Both pivot from the antenna's own base
              (percentage origin relative to this group's own bounding
              box) rather than an absolute canvas coordinate — an explicit
              pixel-length transformOrigin would be read as an offset from
              the group's own bbox corner under Framer's SVG handling, not
              an absolute position; percentages don't have that problem. */}
          <motion.g style={{ rotate: antennaRotate, transformOrigin: "50% 100%" }}>
            <motion.g style={{ rotate: antennaFlex, transformOrigin: "50% 100%" }}>
              <path
                d="M 66 9 Q 61 -5 68 -15"
                stroke="var(--scope-details)"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              <circle
                cx="68"
                cy="-17"
                r="6"
                className="fill-scope-shell"
                stroke="var(--scope-details)"
                strokeOpacity="0.15"
                strokeWidth="1"
              />
            </motion.g>
          </motion.g>

          {/* accent light — the one remaining trace of Scope's purple
              accent. VISUAL_LANGUAGE.md v2.0: "extremely subtle
              atmospheric purple only when interacting with the
              environment" — driven by presence's interactionIntensity
              (0 at rest, before any interaction, and under reduced
              motion; rises only as the cursor comes close), not mood's
              glow — this is deliberately not an always-on decorative
              dot anymore. Shown via `scale`, not `opacity`: empirically,
              a raw MotionValue bound to SVG `opacity` via `style` got
              written once as a static attribute and never updated again
              on this element, while transform-family properties (x, y,
              scale, rotate) reliably update every frame — scaling a small
              circle to 0 is visually equivalent to hiding it and goes
              through the proven path. */}
          <motion.circle
            cx="139"
            cy="54"
            r="3.5"
            className="fill-scope-accent"
            style={{ scale: interactionIntensity }}
          />

          {/* display + eyes, grouped so they always move together (the
              display is part of the shell — it rotates with the body
              above, never independently) with a much smaller secondary
              shift of its own for a sense of depth, like glass set
              slightly back from its bezel. */}
          <motion.g style={{ x: parallaxX, y: parallaxY }}>
            {/* a faint inner-edge stroke suggests the display sits
                recessed into the shell rather than flush with it */}
            <path
              d="
                M46 34
                H114
                C129 34 140 45 140 60
                V92
                C140 109 127 122 110 122
                H50
                C33 122 20 109 20 92
                V60
                C20 45 31 34 46 34
                Z
              "
              className="fill-scope-display stroke-scope-details"
              strokeOpacity="0.35"
              strokeWidth="1"
            />

            {/* a soft, low-opacity diagonal highlight — just enough to
                read as glossy ("almost mirror-like") without becoming an
                actual reflection; VISUAL_LANGUAGE.md v2.0 is explicit
                that reflections should stay minimal. */}
            <ellipse
              cx="55"
              cy="50"
              rx="30"
              ry="14"
              transform="rotate(-25 55 50)"
              className="fill-scope-shell blur-sm"
              opacity="0.07"
            />

            {/* the eyes — Scope's primary expression channel. Two plain
                pill shapes, never a curve, a star, or a shape swap —
                expression lives in scaleY (mood's resting eyeScaleY,
                multiplied by personality's transient blinkScaleY for
                blinks/squint/widen — see the nested <motion.g> below) and
                shared gaze position (presence's continuous eyeX/eyeY,
                plus personality's occasional look-up/down and
                convergence, all additive). No eyebrows, no eyelids, no
                iris/pupil detail, no mouth — geometric and timed, not
                realistic, per canon. Each eye also gets a soft blurred
                "bloom" behind it — VISUAL_LANGUAGE.md v2.0's "soft
                bloom... tiny sources of life," distinct from the ambient
                face-wide glow rect above. No explicit transformOrigin on
                either nested group here: Framer's own default ("50% 50%"
                of the element's own bounding box under the fill-box
                behavior it applies to SVG) is already correct and
                position-independent — a prior, now-fixed bug in this file
                used an absolute pixel coordinate here, which is NOT how
                SVG transform-origin behaves once Framer forces fill-box. */}
            <motion.g style={{ x: leftEyeX, y: gazeY }}>
              <motion.g style={{ scaleY: blinkScaleY }}>
                <rect
                  x="53"
                  y="58"
                  width="22"
                  height="42"
                  rx="11"
                  className="fill-scope-warm blur-sm"
                  opacity={0.4}
                />
                <motion.rect
                  x="56"
                  y="61"
                  width="18"
                  height="36"
                  rx="9"
                  className="fill-scope-warm"
                  initial={false}
                  animate={{ scaleY: eyeScaleY }}
                  transition={transition}
                />
              </motion.g>
            </motion.g>
            <motion.g style={{ x: rightEyeX, y: gazeY }}>
              <motion.g style={{ scaleY: blinkScaleY }}>
                <rect
                  x="85"
                  y="58"
                  width="22"
                  height="42"
                  rx="11"
                  className="fill-scope-warm blur-sm"
                  opacity={0.4}
                  />
                <motion.rect
                  x="88"
                  y="61"
                  width="18"
                  height="36"
                  rx="9"
                  className="fill-scope-warm"
                  initial={false}
                  animate={{ scaleY: eyeScaleY }}
                  transition={transition}
                />
              </motion.g>
            </motion.g>
          </motion.g>
        </svg>
        </motion.div>
      </motion.div>
    </div>
  )
}

export { Scope }
