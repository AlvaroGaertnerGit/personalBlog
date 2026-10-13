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
  eye_h [1]        eye height (squint < 1 < widen) — the 2D eyeScaleY axis
  blink [0] / laugh [0]        shape keys (closed line / luminous arc)
  mouth_w [1]      mouth width
  ant_pitch / ant_roll [0] deg authored antenna pose (+pitch = tip forward)
  ant_len [1]      antenna stretch (Stretch only)
  feet [0] deg     feet swing (+ = tips tuck inward)

Secondary motion: the antenna's follow-through is not hand-keyed. A
two-segment damped spring is driven by the body's angular accelerations and
the hop acceleration, then baked — the same physics on every clip, so the
antenna always lags, overshoots and settles the same believable way.
"""

import math

from mathutils import Matrix, Quaternion, Vector

from . import faceshell as F
from . import geometry as G
from . import spec as S

P = S.P
MM = S.MM
FPS = 30

REST = dict(hop=0.0, squash=1.0, yaw=0.0, pitch=0.0, roll=0.0, up=0.0, fwd=0.0, eye_dx=0.0, eye_dz=0.0,
            converge=0.0, eye_h=1.0, blink=0.0, laugh=0.0, mouth_w=1.0, ant_pitch=0.0, ant_roll=0.0,
            ant_len=1.0, feet=0.0)
MULTIPLICATIVE = {"squash", "eye_h", "mouth_w", "ant_len"}
MIRRORED = {"yaw", "roll", "eye_dx", "ant_roll"}  # sign flips for the .R variant


# --- Curves -----------------------------------------------------------------------
class Track:
    """Monotone cubic (Fritsch–Carlson) through (t, value) keys: smooth, no
    overshoot between keys, zero slope at both ends. Repeating a value makes a
    true hold; overshoot only happens where it is authored."""

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
        if self.parts:  # composite: combine sub-clips' deltas
            v = REST[ch]
            for clip, offset in self.parts:
                pv = clip.value(ch, t - offset)
                v = v * pv if ch in MULTIPLICATIVE else v + (pv - REST[ch])
            return v
        if not (0 <= t <= self.duration) or ch not in self.channels:
            return REST[ch]
        return self.channels[ch](t)

    def mirrored(self, suffix_from, suffix_to):
        flipped = {}
        for ch, fn in self.channels.items():
            flipped[ch] = (lambda f: (lambda t: -f(t)))(fn) if ch in MIRRORED else fn
        return Clip(self.name.replace(suffix_from, suffix_to), self.duration, flipped, self.markers,
                    self.loop, False)


# --- The clips --------------------------------------------------------------------
def idle():
    """Breathing (2D: y -3.8 px, rotate -0.78°, scale 1.019, 4.2 s each way,
    mirrored). One full 8.4 s cycle, loopable."""
    period = 8.4

    def phase(t):
        return 0.5 - 0.5 * math.cos(2 * math.pi * t / period)

    return Clip("Idle", period, {
        "squash": lambda t: 1 + 0.013 * phase(t),
        "up": lambda t: 1.3 * phase(t),
        "roll": lambda t: -0.55 * phase(t),
    }, [("start", 0), ("inhale", 2.1), ("full", 4.2), ("exhale", 6.3), ("end", period)], loop=True)


def look_around():
    """Exploration (sheet: ~1.5 s). Eyes lead, the body follows and tilts a
    little toward each side, a beat of observation, the other side, home.
    Authored toward Scope's left first; .R is the mirror."""
    return Clip("LookAround.L", 1.5, {
        "eye_dx": Track((0, 0), (0.1, 0), (0.26, 4.5), (0.6, 4.5), (0.8, -4.0), (1.1, -4.0), (1.36, 0), (1.5, 0)),
        "eye_dz": Track((0, 0), (0.26, 0.8), (0.6, 0.6), (0.8, 0.9), (1.1, 0.6), (1.36, 0), (1.5, 0)),
        "yaw": Track((0, 0), (0.16, 0), (0.38, 13), (0.64, 13.5), (0.9, -11), (1.14, -11.5), (1.42, 0), (1.5, 0)),
        "roll": Track((0, 0), (0.18, 0), (0.4, 2.4), (0.64, 2.6), (0.9, -2.0), (1.14, -2.2), (1.42, 0), (1.5, 0)),
        "pitch": Track((0, 0), (0.4, -1.5), (0.64, -1.5), (0.9, -1.0), (1.14, -1.0), (1.42, 0), (1.5, 0)),
    }, [("start", 0), ("eyes lead", 0.2), ("look left", 0.5), ("swing", 0.78), ("look right", 1.06),
        ("end", 1.5)], mirror=True)


def tilt():
    """Curious tilt (sheet: ~1.2 s): a hint of anticipation the other way, a
    soft tilt, a short pause, a progressive recovery. Never off-balance."""
    return Clip("Tilt.L", 1.2, {
        "roll": Track((0, 0), (0.08, 0), (0.18, -1.1), (0.46, 7.0), (0.76, 7.2), (1.08, 0.3), (1.2, 0)),
        "yaw": Track((0, 0), (0.18, -0.5), (0.46, 4.0), (0.76, 4.0), (1.1, 0), (1.2, 0)),
        "up": Track((0, 0), (0.46, 1.0), (0.76, 1.0), (1.1, 0), (1.2, 0)),
        "eye_dx": Track((0, 0), (0.18, 0), (0.4, 1.8), (0.78, 1.8), (1.08, 0), (1.2, 0)),
        "eye_h": Track((0, 1), (0.18, 1), (0.42, 1.07), (0.78, 1.07), (1.08, 1), (1.2, 1)),
    }, [("start", 0), ("anticipation", 0.18), ("tilting", 0.34), ("peak", 0.6), ("recovery", 0.95),
        ("end", 1.2)], mirror=True)


def bounce():
    """A small spontaneous hop (sheet: ~0.9 s): squash, push, a short flight
    with the feet tucking, a soft landing, recovery. ~11 mm high on a 150 mm
    body — endearing, not a game jump."""
    t0, t1, height = 0.22, 0.64, 11.0
    tm, half = (t0 + t1) / 2, (t1 - t0) / 2

    def hop(t):
        if t0 <= t <= t1:
            return height * (1 - ((t - tm) / half) ** 2)
        return 0.0

    return Clip("Bounce", 0.9, {
        "hop": hop,
        "squash": Track((0, 1), (0.05, 1), (0.17, 0.9), (0.27, 1.065), (0.43, 1.01), (0.6, 1.04),
                        (0.68, 0.925), (0.79, 1.015), (0.9, 1)),
        "feet": Track((0, 0), (0.22, 0), (0.36, 11), (0.56, 7), (0.66, -3), (0.8, 0), (0.9, 0)),
        "eye_h": Track((0, 1), (0.14, 0.92), (0.3, 1.08), (0.6, 1.02), (0.68, 0.85), (0.82, 1), (0.9, 1)),
        "eye_dz": Track((0, 0), (0.17, -0.6), (0.3, 0.8), (0.66, -0.4), (0.85, 0), (0.9, 0)),
    }, [("start", 0), ("squash", 0.17), ("push", 0.27), ("apex", 0.43), ("landing", 0.68), ("end", 0.9)])


def blink_double():
    """Two warm blinks (sheet: ~1.0 s; 2D double-blink timing stretched).
    The pill morphs to a closed line and back — a shape key, not a cut — with
    a tiny body settle on each close."""
    return Clip("BlinkDouble", 1.0, {
        "blink": Track((0, 0), (0.1, 0), (0.19, 1), (0.23, 1), (0.34, 0), (0.48, 0), (0.57, 1), (0.61, 1),
                       (0.74, 0), (1.0, 0)),
        "squash": Track((0, 1), (0.1, 1), (0.2, 0.994), (0.34, 1), (0.48, 1), (0.58, 0.994), (0.74, 1), (1.0, 1)),
        "eye_dz": Track((0, 0), (0.1, 0), (0.2, -0.4), (0.34, 0), (0.48, 0), (0.58, -0.4), (0.74, 0), (1.0, 0)),
    }, [("start", 0), ("first close", 0.21), ("open", 0.4), ("second close", 0.59), ("open", 0.8),
        ("end", 1.0)])


def focus():
    """Concentrated attention (sheet: ~1.3 s). One direction, held: the body
    orients and leans in, eyes go first and converge a touch, widen (2D
    observe: eyeScaleY 1.15), the antenna perks forward. Not exploration."""
    return Clip("Focus.L", 1.3, {
        "eye_dx": Track((0, 0), (0.08, 0), (0.24, 3.2), (1.0, 3.2), (1.22, 0), (1.3, 0)),
        "eye_dz": Track((0, 0), (0.24, -0.8), (1.0, -0.8), (1.22, 0), (1.3, 0)),
        "converge": Track((0, 0), (0.3, 1.3), (1.0, 1.3), (1.2, 0), (1.3, 0)),
        "eye_h": Track((0, 1), (0.12, 1), (0.34, 1.13), (1.0, 1.13), (1.2, 1), (1.3, 1)),
        "yaw": Track((0, 0), (0.14, 0), (0.42, 8.5), (1.0, 8.5), (1.26, 0), (1.3, 0)),
        "pitch": Track((0, 0), (0.14, 0), (0.42, 3.2), (1.0, 3.2), (1.26, 0), (1.3, 0)),
        "fwd": Track((0, 0), (0.14, 0), (0.42, 2.2), (1.0, 2.2), (1.26, 0), (1.3, 0)),
        "ant_pitch": Track((0, 0), (0.2, 0), (0.45, 7.0), (1.0, 6.0), (1.24, 0), (1.3, 0)),
    }, [("start", 0), ("eyes find it", 0.24), ("orient", 0.42), ("hold", 0.75), ("release", 1.1),
        ("end", 1.3)], mirror=True)


def stretch():
    """CLICK ONLY. An organic stretch (2D touch stage 2, sheet: ~1.6 s):
    anticipation, a little squash, a long vertical stretch with the antenna
    rising and eyes shut contentedly, then an elastic recovery."""
    return Clip("Stretch", 1.6, {
        "squash": Track((0, 1), (0.06, 1), (0.24, 0.93), (0.32, 0.935), (0.74, 1.11), (0.94, 1.115),
                        (1.18, 0.965), (1.36, 1.02), (1.5, 0.997), (1.6, 1)),
        "pitch": Track((0, 0), (0.24, 1.5), (0.74, -4.5), (0.94, -4.8), (1.2, 0.8), (1.42, 0), (1.6, 0)),
        "eye_h": Track((0, 1), (0.2, 0.9), (0.6, 0.35), (0.98, 0.3), (1.2, 1.04), (1.4, 1), (1.6, 1)),
        "eye_dz": Track((0, 0), (0.24, -0.5), (0.74, 1.4), (0.94, 1.4), (1.2, 0), (1.6, 0)),
        "ant_pitch": Track((0, 0), (0.24, 4.0), (0.7, -9.0), (0.94, -10.0), (1.2, 2.0), (1.42, 0), (1.6, 0)),
        "ant_len": Track((0, 1), (0.24, 0.96), (0.74, 1.12), (0.94, 1.12), (1.2, 0.98), (1.4, 1), (1.6, 1)),
        "feet": Track((0, 0), (0.24, -5.0), (0.6, 2.0), (0.94, 2.5), (1.2, -1.5), (1.4, 0), (1.6, 0)),
        "mouth_w": Track((0, 1), (0.74, 0.85), (0.94, 0.85), (1.2, 1), (1.6, 1)),
    }, [("start", 0), ("anticipation", 0.24), ("stretching", 0.52), ("peak", 0.9), ("recoil", 1.2),
        ("end", 1.6)])


def laugh():
    """CLICK ONLY, right after Stretch. Joy through eyes, body and antenna:
    the eyes melt into two luminous arcs, small rhythmic chuckles (squash +
    a soft side-to-side wobble), the antenna rides along, then everything
    settles. No teeth, no mouth shape — only a slightly wider mouth line.
    Approved exception to the eye-shape canon (owner, 2026-10-13)."""
    dur = 1.5

    def env(t):
        return envelope(t, 0.08, 0.26, 1.08, 1.38)

    return Clip("Laugh", dur, {
        "laugh": Track((0, 0), (0.05, 0), (0.22, 1), (1.18, 1), (1.42, 0), (dur, 0)),
        "squash": lambda t: 1 + 0.024 * math.sin(2 * math.pi * 3.3 * (t - 0.08)) * env(t),
        "up": lambda t: 1.0 * abs(math.sin(2 * math.pi * 1.65 * (t - 0.08))) * env(t),
        "roll": lambda t: 2.4 * math.sin(2 * math.pi * 1.65 * (t - 0.08)) * env(t),
        "yaw": lambda t: 1.5 * math.sin(2 * math.pi * 0.82 * (t - 0.08)) * env(t),
        "eye_dz": Track((0, 0), (0.22, 1.2), (1.18, 1.2), (1.42, 0), (dur, 0)),
        "mouth_w": Track((0, 1), (0.2, 1.22), (1.2, 1.22), (1.42, 1), (dur, 1)),
    }, [("start", 0), ("eyes melt", 0.18), ("chuckle", 0.45), ("chuckle", 0.75), ("settling", 1.25),
        ("end", dur)])


# Laugh starts during Stretch's recoil, while the eyes are still shut from the
# stretch: they melt from the contented squint straight into the arcs. A later
# start (first try: 1.42 s) let the eyes reopen to neutral for ~0.4 s between
# the two, which read as two separate clips.
CLICK_OVERLAP_START = 1.0


def click_reaction(stretch_clip, laugh_clip):
    """CLICK -> STRETCH -> LAUGH as ONE continuous clip: the laugh begins
    during the stretch's elastic recovery, so there is no neutral beat
    between them. Marker `laugh` tells the state machine where it starts."""
    total = CLICK_OVERLAP_START + laugh_clip.duration
    markers = [("start", 0), ("stretch peak", 0.9), ("laugh", CLICK_OVERLAP_START), ("recoil", 1.2),
               ("chuckle", CLICK_OVERLAP_START + 0.6), ("end", total)]
    return Clip("ClickReaction", total, {}, markers,
                parts=[(stretch_clip, 0.0), (laugh_clip, CLICK_OVERLAP_START)])


def all_clips():
    la, ti, fo = look_around(), tilt(), focus()
    st, lg = stretch(), laugh()
    return [idle(), la, la.mirrored(".L", ".R"), ti, ti.mirrored(".L", ".R"), bounce(), blink_double(),
            fo, fo.mirrored(".L", ".R"), st, lg, click_reaction(st, lg)]


# --- Antenna spring ---------------------------------------------------------------
SUB = 8  # simulation substeps per frame


def _spring_series(clip):
    """Two-segment damped spring, per frame: [(a1_pitch, a1_roll, a2_pitch, a2_roll)] in degrees."""
    k1, z1 = (2 * math.pi * 2.6) ** 2, 0.32
    k2, z2 = (2 * math.pi * 3.8) ** 2, 0.30
    c1, c2 = 2 * z1 * math.sqrt(k1), 2 * z2 * math.sqrt(k2)
    dt = 1 / (FPS * SUB)
    n_frames = round(clip.duration * FPS)
    warm = 2 if clip.loop else 0

    def drive(t):
        tt = t % clip.duration if clip.loop else t
        return (clip.value("pitch", tt), clip.value("roll", tt), clip.value("yaw", tt),
                clip.value("hop", tt) + clip.value("up", tt))

    def accel(t):
        h = 1 / 240
        a, b, c = drive(t - h), drive(t), drive(t + h)
        return [(a[i] - 2 * b[i] + c[i]) / (h * h) for i in range(4)]

    s = [0.0] * 8  # p1, v_p1, r1, v_r1, p2, v_p2, r2, v_r2
    out = []
    total_steps = (warm * n_frames + n_frames) * SUB
    for step in range(total_steps + 1):
        t = step * dt
        if step % SUB == 0 and step >= warm * n_frames * SUB:
            out.append((s[0], s[2], s[4], s[6]))
        ap, ar, ay, az = accel(t)
        # inertia: the antenna lags the body's rotation; a hop's vertical
        # acceleration makes it nod; a turn (yaw) swings it a little sideways
        f_p1 = -k1 * s[0] - c1 * s[1] - ap - 0.010 * az
        f_r1 = -k1 * s[2] - c1 * s[3] - ar - 0.30 * ay
        s[1] += f_p1 * dt
        s[0] += s[1] * dt
        s[3] += f_r1 * dt
        s[2] += s[3] * dt
        f_p2 = -k2 * s[4] - c2 * s[5] - 0.8 * f_p1
        f_r2 = -k2 * s[6] - c2 * s[7] - 0.8 * f_r1
        s[5] += f_p2 * dt
        s[4] += s[5] * dt
        s[7] += f_r2 * dt
        s[6] += s[7] * dt
    out = out[:n_frames + 1]
    if not clip.loop:  # fade the last 0.25 s so the clip ends exactly at rest
        fade_frames = int(0.25 * FPS)
        for f in range(max(0, n_frames - fade_frames), n_frames + 1):
            k = 1 - G.smoothstep((f - (n_frames - fade_frames)) / fade_frames)
            out[f] = tuple(x * k for x in out[f])
    clamp = 22.0
    return [tuple(max(-clamp, min(clamp, x)) for x in fr) for fr in out]


# --- Pose application -------------------------------------------------------------
def _quat_euler(pitch, yaw, roll):
    """Bone-local quaternion from intent angles (deg). Bone axes: x = world X,
    y = world Z, z = world -Y. +pitch faces down, +yaw faces Scope's left,
    +roll is clockwise as seen from the front."""
    q_yaw = Quaternion((0, 1, 0), math.radians(yaw))
    q_pitch = Quaternion((1, 0, 0), math.radians(pitch))
    q_roll = Quaternion((0, 0, 1), -math.radians(roll))
    return q_yaw @ q_pitch @ q_roll


_EYE_REST = {}


def _eye_rest(side):
    if side not in _EYE_REST:
        sign = 1 if side == "eye.L" else -1
        x, z = sign * P["eye_dx"], P["display_center_z"] + P["eye_dz"]
        _EYE_REST[side] = (x, z, F.glass_point(x, z) + F.glass_normal(x, z) * G.EYE_THICKNESS * 0.18)
    return _EYE_REST[side]


def _gaze_local(side, dx_mm, dz_mm):
    """Bone-local translation that slides an eye along the curved glass."""
    x, z, rest = _eye_rest(side)
    nx, nz = x + dx_mm * MM, z + dz_mm * MM
    p = F.glass_point(nx, nz) + F.glass_normal(nx, nz) * G.EYE_THICKNESS * 0.18
    d = p - rest
    return Vector((d.x, d.z, -d.y))


def _feet_rotation(bone_head, deg):
    r = Vector((bone_head.x, bone_head.y, 0)).normalized()
    axis_world = Vector((0, 0, 1)).cross(r)
    axis_local = Vector((axis_world.x, axis_world.z, -axis_world.y))
    return Quaternion(axis_local, math.radians(deg))


def apply(rig, clip, t, spring):
    """Pose the rig for clip time t. `spring` = this frame's antenna spring angles."""
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
        dx = v["eye_dx"] - sign * v["converge"]
        pb[side].location = _gaze_local(side, dx, v["eye_dz"])
        pb[side].scale = (1, v["eye_h"], 1)
    pb["mouth"].location = (v["eye_dx"] * 0.3 * MM, v["eye_dz"] * 0.25 * MM, 0)
    pb["mouth"].scale = (v["mouth_w"], 1, 1)

    p1, r1, p2, r2 = spring
    pb["antenna.1"].rotation_quaternion = _quat_euler(v["ant_pitch"] + p1, 0, v["ant_roll"] + r1)
    pb["antenna.1"].scale = (1, v["ant_len"], 1)
    pb["antenna.2"].rotation_quaternion = _quat_euler(0.4 * v["ant_pitch"] + p2, 0, 0.4 * v["ant_roll"] + r2)

    for b in pb:
        if b.name.startswith("foot."):
            b.rotation_quaternion = _feet_rotation(b.bone.head_local, v["feet"])

    keys = rig["eyes"].data.shape_keys.key_blocks
    keys["Blink"].value = max(0.0, min(1.0, v["blink"]))
    keys["Laugh"].value = max(0.0, min(1.0, v["laugh"]))


KEYED = {
    "hop": ("location",), "squash": ("scale",), "body": ("location", "rotation_quaternion"),
    "eye.L": ("location", "scale"), "eye.R": ("location", "scale"), "mouth": ("location", "scale"),
    "antenna.1": ("rotation_quaternion", "scale"), "antenna.2": ("rotation_quaternion",),
}


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
    spring = _spring_series(clip)
    n = round(clip.duration * FPS)
    feet = [b.name for b in arm.pose.bones if b.name.startswith("foot.")]
    for f in range(n + 1):
        apply(rig, clip, f / FPS, spring[f])
        for bone, props in KEYED.items():
            for prop in props:
                arm.pose.bones[bone].keyframe_insert(prop, frame=f, group=bone)
        for bone in feet:
            arm.pose.bones[bone].keyframe_insert("rotation_quaternion", frame=f, group=bone)
        for kb in ("Blink", "Laugh"):
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
