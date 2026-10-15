// The approved clips Scope uses as gestures, their families and cooldowns (s):
// never two in a row from one family (Fase A §4.8).

export const GESTURES = {
  Focus: { family: "look", cooldown: 0, weight: 1 },
  Tilt: { family: "tilt", cooldown: 10, weight: 0.8 },
  LookAround: { family: "around", cooldown: 20, weight: 0.5 },
  BlinkDouble: { family: "blink", cooldown: 4, weight: 0.6 },
} as const
export type IdleGesture = keyof typeof GESTURES
export type Clip = IdleGesture | "Bounce" | "ClickReaction"
