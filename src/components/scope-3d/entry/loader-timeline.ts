// Frame logic of the loader's prerendered Scope (public/scope/loader/), pure.
//
// The waiting loop is breathing + Focus (looks aside, leans in, holds,
// returns) + a blink; the exit sequence starts from Scope at rest. So the exit
// can't start on any frame: when Scope 3D is ready, the loop first finishes
// its motion the way it was drawn —
//   - on a QUIET frame (only breathing on top of rest) the exit takes over
//     with a short crossfade: the poses differ by a breath, under a pixel;
//   - inside Focus's moving HOLD (nearly still) it skips to the hold's last
//     frame, crossfaded, and lets Focus release from there;
//   - anywhere else (leaning in, releasing, blinking) it keeps playing.
// Worst case (ready just as Focus starts): ~1.1 s before the exit begins.

export interface LoaderManifest {
  fps: number
  width: number
  height: number
  /** Scope's rest height as a fraction of the frame height. */
  scopeHeight: number
  loop: { frames: number; columns: number; rows: number }
  exit: { frames: number; columns: number; rows: number }
  quiet: number[]
  /** First and last frame of Focus's hold. */
  hold: [number, number]
}

export type LoaderStep =
  | { sequence: "loop"; frame: number; crossfade: boolean }
  | { sequence: "exit"; frame: 0; crossfade: true }

/** The frame after `frame` of the loop, given whether the exit is wanted. */
export function nextLoopStep(frame: number, wantExit: boolean, m: LoaderManifest): LoaderStep {
  if (wantExit) {
    if (m.quiet.includes(frame)) return { sequence: "exit", frame: 0, crossfade: true }
    const [holdStart, holdEnd] = m.hold
    if (frame >= holdStart && frame < holdEnd) return { sequence: "loop", frame: holdEnd, crossfade: true }
  }
  return { sequence: "loop", frame: (frame + 1) % m.loop.frames, crossfade: false }
}

/** Source rectangle of a frame in its sprite sheet. */
export function frameRect(frame: number, columns: number, m: Pick<LoaderManifest, "width" | "height">) {
  return {
    x: (frame % columns) * m.width,
    y: Math.floor(frame / columns) * m.height,
    width: m.width,
    height: m.height,
  }
}
