"""Scope's animation clips: authored as timing curves, baked to the rig.

Every clip is a set of CHANNELS (what Scope does, in the 2D code's own
vocabulary) sampled over time, then baked frame by frame onto bones and shape
keys. Clips start and end exactly at rest, so the web can layer them
additively over Idle and crossfade without pops.

Channels (rest value in brackets):
  hop [0] mm       whole-creature vertical travel (jumps)
  squash [1]       vertical scale about the ground; x/y get 1/sqrt (volume kept)
  yaw / pitch / roll [0] deg   body turn / lean (+ = face down) / tilt (+ = clockwise from the front)
  up / fwd [0] mm  small body translation (up, toward the viewer)
  eye_dx / eye_dz [0] mm       gaze on the glass (+x = Scope's left, +z = up)
  converge [0] mm  both eyes toward the centre
  eye_h [1]        eye height (squint < 1 < widen) — the 2D eyeScaleY axis;
                   squint = eye bone scale, widen = `Tall` shape key (rig.EYE_TALL)
  blink [0] / laugh [0]        shape keys (closed line / luminous arc)
  mouth_w [1]      mouth width
  ant_pitch / ant_roll [0] deg authored antenna pose (+pitch = tip forward)
  ant_len [1]      antenna stretch (Stretch only)
  feet [0] deg     feet swing (+ = tips tuck inward); each foot follows it
                   with its own delay and gain (FEET), never in unison

Motion principles (v2, owner brief 2026-10-13: "soft, tender, organic"):
  - every key is eased (monotone cubic, zero slope at extremes): no linear
    starts or instant stops;
  - holds are MOVING holds (the value keeps drifting a little), never frozen;
  - overlapping action: the eyes lead, the body turn follows ~0.1 s later,
    the tilt/roll trails the turn, and the antenna's follow-through comes last;
  - overshoot only where it is authored, small and settled.

Secondary motion: the antenna's follow-through is NOT baked any more. It is
simulated at runtime (src/components/scope-3d/engine/scope-3d-secondary.ts)
from the real body motion, so it also reacts across crossfades, interruptions
and the idle layer, and never doubles up with a baked copy.
"""

import math

from mathutils import Quaternion, Vector

from . import geometry as G
from . import rig as R
from . import spec as S

P = S.P
MM = S.MM
FPS = 30

REST = dict(hop=0.0, squash=1.0, yaw=0.0, pitch=0.0, roll=0.0, up=0.0, fwd=0.0, eye_dx=0.0, eye_dz=0.0,
            converge=0.0, eye_h=1.0, blink=0.0, laugh=0.0, mouth_w=1.0, ant_pitch=0.0, ant_roll=0.0,
            ant_len=1.0, feet=0.0)
MULTIPLICATIVE = {"squash", "eye_h", "mouth_w", "ant_len"}
MIRRORED = {"yaw", "roll", "eye_dx", "ant_roll"}  # sign flips for the .R variant

# Per-foot (delay s, gain) on the shared `feet` channel: front feet lead the
# back ones, left leads right by a hair, and no two feet swing the same amount.
FEET = {"foot.FL": (0.0, 1.0), "foot.FR": (0.02, 0.9), "foot.BL": (0.05, 0.82), "foot.BR": (0.065, 0.92)}


# --- Curves -----------------------------------------------------------------------
class Track:
    """Monotone cubic (Fritsch–Carlson) through (t, value) keys: smooth, no
    overshoot between keys, zero slope at every local extreme and at both ends
    (ease in / ease out). Overshoot only happens where it is authored."""

    def __init__(self, *keys):
        self.t = [k[0] for k in keys]
        self.v = [k[1] for k in keys]
        n = len(keys)
        d = [(self.v[i + 1] - self.v[i]) / (self.t[i + 1] - self.t[i]) for i in range(n - 1)]
        m = [0.0] * n
        for i in range(1, n - 1):
            m[i] = 0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2
        for i in range(n - 1):
            if d[i] == 0:
                m[i] = m[i + 1] = 0.0
                continue
            a, b = m[i] / d[i], m[i + 1] / d[i]
            s = a * a + b * b
            if s > 9:
                k = 3 / math.sqrt(s)
                m[i], m[i + 1] = k * a * d[i], k * b * d[i]
        self.m = m

    def __call__(self, t):
        if t <= self.t[0]:
            return self.v[0]
        if t >= self.t[-1]:
            return self.v[-1]
        i = max(j for j in range(len(self.t) - 1) if self.t[j] <= t)
        h = self.t[i + 1] - self.t[i]
        s = (t - self.t[i]) / h
        h00, h10 = 2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s
        h01, h11 = -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2
        return h00 * self.v[i] + h10 * h * self.m[i] + h01 * self.v[i + 1] + h11 * h * self.m[i + 1]


def envelope(t, rise_a, rise_b, fall_a, fall_b):
    return G.smoothstep((t - rise_a) / (rise_b - rise_a)) * (1 - G.smoothstep((t - fall_a) / (fall_b - fall_a)))


class Clip:
    def __init__(self, name, duration, channels, markers, loop=False, mirror=False, parts=None):
        self.name, self.duration, self.channels = name, duration, channels
        self.markers, self.loop, self.mirror, self.parts = markers, loop, mirror, parts

    def value(self, ch, t):
        if not (0 <= t <= self.duration):
            return REST[ch]
        if ch in self.channels:  # also overrides a composite's parts
            return self.channels[ch](t)
        if self.parts:  # composite: combine sub-clips' deltas
            v = REST[ch]
            for clip, offset in self.parts:
                pv = clip.value(ch, t - offset)
                v = v * pv if ch in MULTIPLICATIVE else v + (pv - REST[ch])
            return v
        return REST[ch]

    def mirrored(self, suffix_from, suffix_to):
        flipped = {}
        for ch, fn in self.channels.items():
            flipped[ch] = (lambda f: (lambda t: -f(t)))(fn) if ch in MIRRORED else fn
        return Clip(self.name.replace(suffix_from, suffix_to), self.duration, flipped, self.markers,
                    self.loop, False)


# --- The clips --------------------------------------------------------------------
def idle():
    """Breathing (2D: y -3.8 px, rotate -0.78°, scale 1.019, 4.2 s each way,
    mirrored). One full 8.4 s cycle, loopable. The non-repeating life on top
    (posture drift, single blinks) is procedural: scope-3d-secondary.ts."""
    period = 8.4

    def phase(t):
        return 0.5 - 0.5 * math.cos(2 * math.pi * t / period)

    return Clip("Idle", period, {
        "squash": lambda t: 1 + 0.013 * phase(t),
        "up": lambda t: 1.3 * phase(t),
        "roll": lambda t: -0.55 * phase(t),
    }, [("start", 0), ("inhale", 2.1), ("full", 4.2), ("exhale", 6.3), ("end", period)], loop=True)


def look_around():
    """Curious, unhurried exploration (sheet: LOOK AROUND). The eyes find one
    side first, the body follows them, the tilt trails the turn; a long,
    still-alive look; a soft swing (with the half-blink creatures do on a big
    gaze shift) to the other side; home with a whisper of overshoot.
    Authored toward Scope's left first; .R is the mirror."""
    return Clip("LookAround.L", 2.6, {
        "eye_dx": Track((0, 0), (0.12, 0), (0.34, 4.4), (0.62, 4.6), (1.02, 4.9), (1.3, -4.2), (1.62, -4.5),
                        (1.98, -4.7), (2.28, 0.3), (2.42, 0), (2.6, 0)),
        "eye_dz": Track((0, 0), (0.34, 0.6), (1.02, 0.9), (1.2, 0.3), (1.62, 0.6), (1.98, 0.8), (2.3, 0), (2.6, 0)),
        "yaw": Track((0, 0), (0.18, 0), (0.62, 11.5), (1.05, 13.2), (1.55, -10.5), (2.0, -11.8), (2.42, 0.6),
                     (2.6, 0)),
        "roll": Track((0, 0), (0.28, 0), (0.74, 2.0), (1.15, 2.4), (1.66, -1.7), (2.08, -2.0), (2.5, 0.2), (2.6, 0)),
        "pitch": Track((0, 0), (0.3, 0), (0.7, -1.2), (1.05, -1.4), (1.3, -0.3), (1.6, -0.9), (2.0, -1.0),
                       (2.45, 0), (2.6, 0)),
        "eye_h": Track((0, 1), (0.3, 1.04), (1.05, 1.05), (1.3, 1.0), (1.6, 1.04), (2.0, 1.04), (2.4, 1), (2.6, 1)),
        "blink": Track((0, 0), (1.1, 0), (1.18, 0.5), (1.32, 0), (2.6, 0)),
    }, [("start", 0), ("eyes lead", 0.12), ("look left", 0.62), ("swing", 1.3), ("look right", 1.62),
        ("home", 2.42), ("end", 2.6)], mirror=True)


def tilt():
    """Curious tilt (sheet: TILT): a hint of anticipation the other way, a soft
    tilt that overshoots a touch and settles, a moving hold, an elastic
    recovery that crosses rest once. The eyes lead and widen."""
    return Clip("Tilt.L", 1.9, {
        "roll": Track((0, 0), (0.08, 0), (0.24, -1.3), (0.62, 7.0), (0.8, 7.8), (1.08, 7.3), (1.5, -0.5),
                      (1.68, 0.15), (1.9, 0)),
        "yaw": Track((0, 0), (0.24, -0.5), (0.7, 3.6), (1.08, 4.1), (1.55, 0), (1.9, 0)),
        "up": Track((0, 0), (0.24, -0.3), (0.7, 0.9), (1.08, 1.0), (1.55, 0), (1.9, 0)),
        "pitch": Track((0, 0), (0.3, 0), (0.72, -1.2), (1.08, -1.0), (1.55, 0), (1.9, 0)),
        "eye_dx": Track((0, 0), (0.14, 0), (0.42, 1.9), (1.08, 2.1), (1.42, 0), (1.9, 0)),
        "eye_h": Track((0, 1), (0.2, 0.96), (0.5, 1.09), (1.08, 1.07), (1.45, 1), (1.9, 1)),
    }, [("start", 0), ("anticipation", 0.24), ("tilting", 0.45), ("peak", 0.8), ("recovery", 1.3),
        ("end", 1.9)], mirror=True)


def bounce():
    """A small spontaneous hop (sheet: BOUNCE): squash, push, a short flight
    with the feet tucking one after another, a soft landing that the body
    absorbs with a little forward nod, recovery. ~11 mm high on a 150 mm body."""
    t0, t1, height = 0.27, 0.68, 11.0
    tm, half = (t0 + t1) / 2, (t1 - t0) / 2

    def hop(t):
        if t0 <= t <= t1:
            return height * (1 - ((t - tm) / half) ** 2)
        return 0.0

    return Clip("Bounce", 1.2, {
        "hop": hop,
        "squash": Track((0, 1), (0.06, 1), (0.2, 0.91), (0.31, 1.07), (0.47, 1.01), (0.63, 1.035), (0.73, 0.925),
                        (0.86, 1.02), (0.98, 0.996), (1.12, 1), (1.2, 1)),
        "feet": Track((0, 0), (0.12, 0), (0.2, -2.2), (0.29, 0), (0.42, 11), (0.6, 6.5), (0.7, -3.5), (0.84, 0.8),
                      (0.98, 0), (1.2, 0)),
        "pitch": Track((0, 0), (0.08, 0), (0.2, 1.3), (0.34, -1.1), (0.55, -0.4), (0.74, 1.6), (0.9, -0.3),
                       (1.04, 0), (1.2, 0)),
        "roll": Track((0, 0), (0.3, 0), (0.5, 0.8), (0.74, -0.5), (0.95, 0.1), (1.1, 0), (1.2, 0)),
        "eye_h": Track((0, 1), (0.18, 0.9), (0.33, 1.08), (0.62, 1.03), (0.73, 0.87), (0.88, 1.02), (1.0, 1),
                       (1.2, 1)),
        "eye_dz": Track((0, 0), (0.2, -0.6), (0.35, 0.8), (0.6, 0.3), (0.72, -0.4), (0.92, 0), (1.2, 0)),
    }, [("start", 0), ("squash", 0.2), ("push", 0.29), ("apex", 0.47), ("landing", 0.73), ("end", 1.2)])


def blink_double():
    """Two warm blinks (sheet: BLINK DOUBLE). Lid-like rather than a scale:
    a quick ease-in close, a beat, a slower ease-out open; the eye drops a
    touch while closing so the upper lid travels further than the lower one;
    the second blink is a little softer; a tiny nod on each."""
    return Clip("BlinkDouble", 1.2, {
        "blink": Track((0, 0), (0.12, 0), (0.2, 1.1), (0.24, 1.1), (0.38, 0), (0.52, 0), (0.6, 1.05), (0.64, 1.05),
                       (0.8, 0), (1.2, 0)),
        "eye_dz": Track((0, 0), (0.12, 0), (0.21, -1.0), (0.38, 0), (0.52, 0), (0.61, -0.9), (0.8, 0), (1.2, 0)),
        "pitch": Track((0, 0), (0.12, 0), (0.22, 0.6), (0.4, 0.1), (0.62, 0.6), (0.84, 0), (1.2, 0)),
        "squash": Track((0, 1), (0.12, 1), (0.21, 0.995), (0.38, 1), (0.52, 1), (0.61, 0.995), (0.8, 1), (1.2, 1)),
    }, [("start", 0), ("first close", 0.2), ("open", 0.38), ("second close", 0.6), ("open", 0.8),
        ("end", 1.2)])


def focus():
    """Concentrated attention (sheet: FOCUS; 2D observe). NOT exploration:
    one direction, small turn, the body leans in and comes closer and then
    stays STILL; the eyes narrow for a beat, then widen (2D observe:
    eyeScaleY 1.15) and converge, tracking with tiny drifts; the antenna perks
    forward and holds. Long hold, slow release."""
    return Clip("Focus.L", 2.4, {
        "eye_dx": Track((0, 0), (0.1, 0), (0.28, 2.8), (0.9, 3.0), (1.4, 2.8), (1.85, 3.0), (2.12, 0), (2.4, 0)),
        "eye_dz": Track((0, 0), (0.28, -0.7), (1.85, -0.8), (2.12, 0), (2.4, 0)),
        "converge": Track((0, 0), (0.36, 1.5), (1.85, 1.6), (2.1, 0), (2.4, 0)),
        "eye_h": Track((0, 1), (0.16, 0.97), (0.42, 1.15), (1.85, 1.14), (2.1, 1), (2.4, 1)),
        "yaw": Track((0, 0), (0.2, 0), (0.6, 5.2), (1.85, 5.6), (2.25, 0), (2.4, 0)),
        "pitch": Track((0, 0), (0.22, 0), (0.66, 4.6), (1.3, 5.0), (1.85, 5.0), (2.25, 0), (2.4, 0)),
        "fwd": Track((0, 0), (0.22, 0), (0.7, 3.4), (1.85, 3.6), (2.25, 0), (2.4, 0)),
        "squash": Track((0, 1), (0.6, 0.99), (1.85, 0.99), (2.2, 1), (2.4, 1)),
        "ant_pitch": Track((0, 0), (0.3, 0), (0.62, 9.0), (1.85, 8.5), (2.22, 0), (2.4, 0)),
    }, [("start", 0), ("eyes find it", 0.28), ("lean in", 0.66), ("hold", 1.2), ("release", 1.85),
        ("end", 2.4)], mirror=True)


def stretch():
    """CLICK ONLY. A progressive, elastic stretch (2D touch stage 2): a little
    squash, a long slow rise to the top with the eyes closing contentedly
    (the Blink shape, not a squashed capsule) and the antenna reaching up,
    then a springy recovery that settles in two small, shrinking beats."""
    return Clip("Stretch", 1.8, {
        "squash": Track((0, 1), (0.06, 1), (0.28, 0.94), (0.36, 0.942), (0.82, 1.105), (1.02, 1.112), (1.24, 0.965),
                        (1.42, 1.018), (1.58, 0.996), (1.8, 1)),
        "pitch": Track((0, 0), (0.28, 1.4), (0.84, -4.6), (1.02, -4.8), (1.26, 0.9), (1.48, -0.2), (1.62, 0),
                       (1.8, 0)),
        "blink": Track((0, 0), (0.24, 0.12), (0.66, 0.74), (1.02, 0.78), (1.28, 0), (1.8, 0)),
        "eye_h": Track((0, 1), (1.1, 1), (1.3, 1.04), (1.48, 1), (1.8, 1)),
        "eye_dz": Track((0, 0), (0.28, -0.5), (0.84, 1.4), (1.02, 1.4), (1.28, 0), (1.8, 0)),
        "ant_pitch": Track((0, 0), (0.28, 4.0), (0.8, -9.0), (1.02, -10.0), (1.26, 2.0), (1.46, 0), (1.8, 0)),
        "ant_len": Track((0, 1), (0.28, 0.96), (0.84, 1.12), (1.02, 1.12), (1.26, 0.98), (1.44, 1), (1.8, 1)),
        "feet": Track((0, 0), (0.28, -5.0), (0.66, 2.0), (1.02, 2.5), (1.26, -1.5), (1.46, 0), (1.8, 0)),
        "mouth_w": Track((0, 1), (0.84, 0.85), (1.02, 0.85), (1.26, 1), (1.8, 1)),
    }, [("start", 0), ("anticipation", 0.28), ("stretching", 0.6), ("peak", 1.02), ("recoil", 1.24),
        ("end", 1.8)])


# Chuckle rhythm shared by every Laugh channel (Hz): squash/eyes ride CHUCKLE,
# the side-to-side wobble is half of it, the turn a quarter.
CHUCKLE = 3.0
LAUGH_START = 0.28  # chuckles begin once the arcs have formed


def _laugh_env(t):
    """Chuckles fade in, decay a little, then settle."""
    return envelope(t, LAUGH_START, 0.5, 1.2, 1.5) * (1 - 0.3 * G.smoothstep((t - 0.5) / 0.8))


def laugh():
    """CLICK ONLY, right after Stretch. Endearing joy through eyes, body and
    antenna: the eyes squeeze into a line that bends into two luminous arcs,
    small rhythmic chuckles that soften as they go (squash + a gentle side
    wobble, the eyes riding along), the antenna answers (runtime spring),
    then everything settles with a last soft blink. No teeth, no mouth shape
    — only a slightly wider mouth line. Approved exception to the eye-shape
    canon (owner, 2026-10-13)."""
    dur = 1.8
    env = _laugh_env

    def phase(t, hz):
        return 2 * math.pi * hz * (t - LAUGH_START)

    return Clip("Laugh", dur, {
        "blink": Track((0, 0), (0.04, 0), (0.14, 1), (0.34, 0), (1.34, 0), (1.52, 1), (1.68, 0), (dur, 0)),
        "laugh": Track((0, 0), (0.14, 0), (0.34, 1), (1.34, 1), (1.52, 0), (dur, 0)),
        "squash": lambda t: 1 + 0.02 * math.sin(phase(t, CHUCKLE)) * env(t),
        "up": lambda t: 0.9 * math.sin(phase(t, CHUCKLE) / 2) ** 2 * env(t),
        "roll": lambda t: 2.0 * math.sin(phase(t, CHUCKLE / 2)) * env(t),
        "yaw": lambda t: 1.3 * math.sin(phase(t, CHUCKLE / 4)) * env(t),
        "pitch": Track((0, 0), (0.34, -1.5), (1.3, -1.2), (1.62, 0), (dur, 0)),
        "eye_dz": lambda t: Track((0, 0), (0.34, 1.1), (1.34, 1.1), (1.6, 0), (dur, 0))(t)
        + 0.25 * math.sin(phase(t, CHUCKLE)) * env(t),
        "mouth_w": Track((0, 1), (0.3, 1.22), (1.34, 1.22), (1.6, 1), (dur, 1)),
    }, [("start", 0), ("squeeze", 0.14), ("arcs", 0.34), ("chuckle", 0.6), ("settling", 1.3), ("end", dur)])


# Laugh starts at the top of Stretch, while the eyes are still closed
# contentedly: they shut fully and the closed line bends straight into the
# arcs. No neutral beat in between, and no squashed in-between shape.
CLICK_OVERLAP_START = 1.0


def click_reaction(stretch_clip, laugh_clip):
    """CLICK -> STRETCH -> LAUGH as ONE continuous clip: the laugh begins
    during the stretch's elastic recovery. Body channels add the two clips'
    deltas; the eyes get their own continuous path (stretch squint -> fully
    closed line -> arc, with blink + laugh = 1 through the bend). Marker
    `laugh` tells the state machine where it starts."""
    o = CLICK_OVERLAP_START
    total = o + laugh_clip.duration
    eyes = {
        "blink": Track((0, 0), (0.24, 0.12), (0.66, 0.74), (o, 0.78), (o + 0.14, 1), (o + 0.34, 0), (o + 1.34, 0),
                       (o + 1.52, 1), (o + 1.68, 0), (total, 0)),
        "laugh": Track((0, 0), (o + 0.14, 0), (o + 0.34, 1), (o + 1.34, 1), (o + 1.52, 0), (total, 0)),
        "eye_h": lambda t: 1.0,
    }
    markers = [("start", 0), ("stretch peak", 1.02), ("laugh", o), ("arcs", o + 0.34), ("chuckle", o + 0.6),
               ("end", total)]
    return Clip("ClickReaction", total, eyes, markers, parts=[(stretch_clip, 0.0), (laugh_clip, o)])


def all_clips():
    la, ti, fo = look_around(), tilt(), focus()
    st, lg = stretch(), laugh()
    return [idle(), la, la.mirrored(".L", ".R"), ti, ti.mirrored(".L", ".R"), bounce(), blink_double(),
            fo, fo.mirrored(".L", ".R"), st, lg, click_reaction(st, lg)]


# --- Pose application -------------------------------------------------------------
def _quat_euler(pitch, yaw, roll):
    """Bone-local quaternion from intent angles (deg). Bone axes: x = world X,
    y = world Z, z = world -Y. +pitch faces down, +yaw faces Scope's left,
    +roll is clockwise as seen from the front."""
    q_yaw = Quaternion((0, 1, 0), math.radians(yaw))
    q_pitch = Quaternion((1, 0, 0), math.radians(pitch))
    q_roll = Quaternion((0, 0, 1), -math.radians(roll))
    return q_yaw @ q_pitch @ q_roll


def _to_bone(v):
    """Rest-space vector -> bone-local axes (x = X, y = Z, z = -Y)."""
    return Vector((v.x, v.z, -v.y))


def _seat(x, z, proud):
    p, n, _ex, _ez = R.glass_frame(x, z)
    return p + n * proud, n


def _slide_on_glass(x, z, dx_mm, dz_mm, proud):
    """Bone-local (translation, rotation) that slides a part seated at (x, z)
    along the curved glass AND turns it with the glass normal, so it stays
    flush with the surface instead of sinking on one side."""
    rest, n_rest = _seat(x, z, proud)
    moved, n_moved = _seat(x + dx_mm * MM, z + dz_mm * MM, proud)
    q = n_rest.rotation_difference(n_moved)
    return _to_bone(moved - rest), Quaternion((q.w, *_to_bone(Vector((q.x, q.y, q.z)))))


def _feet_rotation(bone_head, deg):
    r = Vector((bone_head.x, bone_head.y, 0)).normalized()
    axis_world = Vector((0, 0, 1)).cross(r)
    return Quaternion(_to_bone(axis_world), math.radians(deg))


def apply(rig, clip, t):
    """Pose the rig for clip time t."""
    arm = rig["arm"]
    pb = arm.pose.bones
    v = {ch: clip.value(ch, t) for ch in REST}

    pb["hop"].location = (0, v["hop"] * MM, 0)
    sz = v["squash"]
    sxy = 1 / math.sqrt(sz)
    pb["squash"].scale = (sxy, sz, sxy)
    pb["body"].rotation_quaternion = _quat_euler(v["pitch"], v["yaw"], v["roll"])
    pb["body"].location = (0, v["up"] * MM, v["fwd"] * MM)

    for side, sign in (("eye.L", 1), ("eye.R", -1)):
        x, z = R.eye_seat(side)
        loc, rot = _slide_on_glass(x, z, v["eye_dx"] - sign * v["converge"], v["eye_dz"], R.EYE_PROUD)
        pb[side].location, pb[side].rotation_quaternion = loc, rot
        pb[side].scale = (1, min(v["eye_h"], 1.0), 1)
    mx, mz = 0.0, P["display_center_z"] + P["mouth_dz"]
    loc, rot = _slide_on_glass(mx, mz, v["eye_dx"] * 0.3, v["eye_dz"] * 0.25, MOUTH_PROUD)
    pb["mouth"].location, pb["mouth"].rotation_quaternion = loc, rot
    pb["mouth"].scale = (v["mouth_w"], 1, 1)

    pb["antenna.1"].rotation_quaternion = _quat_euler(v["ant_pitch"], 0, v["ant_roll"])
    pb["antenna.1"].scale = (1, v["ant_len"], 1)
    pb["antenna.2"].rotation_quaternion = _quat_euler(0.4 * v["ant_pitch"], 0, 0.4 * v["ant_roll"])

    for b in pb:
        if b.name in FEET:
            delay, gain = FEET[b.name]
            b.rotation_quaternion = _feet_rotation(b.bone.head_local, gain * clip.value("feet", t - delay))

    keys = rig["eyes"].data.shape_keys.key_blocks
    keys["Blink"].value = max(0.0, min(1.0, v["blink"]))
    keys["Laugh"].value = max(0.0, min(1.0, v["laugh"]))
    keys["Tall"].value = max(0.0, min(1.0, (v["eye_h"] - 1) / (R.EYE_TALL - 1)))


# character.build seats the mouth this far out of the glass.
MOUTH_PROUD = 0.3 * MM

KEYED = {
    "hop": ("location",), "squash": ("scale",), "body": ("location", "rotation_quaternion"),
    "eye.L": ("location", "rotation_quaternion", "scale"), "eye.R": ("location", "rotation_quaternion", "scale"),
    "mouth": ("location", "rotation_quaternion", "scale"),
    "antenna.1": ("rotation_quaternion", "scale"), "antenna.2": ("rotation_quaternion",),
}


EYE_KEYS = ("Blink", "Laugh", "Tall")


def bake(rig, clip):
    """Bake one clip into an armature action + an eyes shape-key action, and
    file both under an NLA track named after the clip (the glTF exporter
    merges tracks by name into one animation)."""
    import bpy

    arm, eyes = rig["arm"], rig["eyes"]
    ad = arm.animation_data_create()
    kad = eyes.data.shape_keys.animation_data_create()
    ad.action = None
    kad.action = None
    n = round(clip.duration * FPS)
    for f in range(n + 1):
        apply(rig, clip, f / FPS)
        for bone, props in KEYED.items():
            for prop in props:
                arm.pose.bones[bone].keyframe_insert(prop, frame=f, group=bone)
        for bone in FEET:
            arm.pose.bones[bone].keyframe_insert("rotation_quaternion", frame=f, group=bone)
        for kb in EYE_KEYS:
            eyes.data.shape_keys.key_blocks[kb].keyframe_insert("value", frame=f)
    act, kact = ad.action, kad.action
    act.name, kact.name = clip.name, clip.name + "__eyes"
    act.use_fake_user = kact.use_fake_user = True
    act["scope_markers"] = [m for m, _t in clip.markers]
    act["scope_marker_times"] = [t for _m, t in clip.markers]
    act["scope_loop"] = clip.loop
    for owner, action in ((ad, act), (kad, kact)):
        track = owner.nla_tracks.new()
        track.name = clip.name
        track.strips.new(clip.name, 0, action)
        owner.action = None
    return act, kact
