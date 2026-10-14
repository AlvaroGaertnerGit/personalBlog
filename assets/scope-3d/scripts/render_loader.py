"""Frames for the site's loading screen ("Scope está explorando"): the definitive
Scope, rendered in Cycles from the approved .blend, transparent background.

Nothing new is authored. Both sequences are composites of the approved clips
(scope3d/clips.py), combined channel by channel exactly like the web layers
them additively over Idle:

  loop  Idle breathing (one full cycle, played faster to fit the loop)
        + Focus.R (looks to one side, leans in, holds, returns)
        + the runtime single blink (scope-3d-secondary.ts BLINK timing)
  exit  Idle continuing + Bounce + the eye path of Laugh (closed line -> arcs)

The antenna follow-through is NOT baked in the .blend (it is a runtime spring,
scope-3d-secondary.ts); it is simulated here with the same constants so the
stalk lags and settles like it does on the site. The camera looks from the
web view's direction (scope-3d-viewer.tsx PREVIEW_DIRECTION) with its 28°
field of view, so the loader Scope and the live one are seen the same way.

The .blend is opened read-only and never saved.

Run (headless, CPU):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
      --python assets/scope-3d/scripts/render_loader.py -- --out <dir> [--res 720] [--samples 64] [--only loop|exit|still] [--frames a:b]
  dock still (companion fallback, the site camera): ... --only dock --res 384 --camera px,py,pz,tx,ty,tz

Output: <out>/loop/0000.png …, <out>/exit/0000.png …, <out>/still.png (RGBA, straight alpha)
        and <out>/meta.json (fps, frame counts, sequences' breathing-only frames).
Then: node assets/scope-3d/scripts/web/encode-loader.mjs <out>
"""

import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Quaternion, Vector  # noqa: E402

from scope3d import clips as C, faceshell as F, spec as S, studio  # noqa: E402

ROOT = os.path.dirname(HERE)
BLEND = os.path.join(ROOT, "blender", "scope-master.blend")

FPS = 24
LOOP_S = 3.25
FOCUS_AT = 0.2
BLINK_AT = 2.62
EXIT_S = 1.5
BOUNCE_AT = 0.05
# Laugh's arcs (0.34 s into the clip) land at the top of the hop (Bounce apex 0.47 s).
LAUGH_EYES_AT = BOUNCE_AT + 0.47 - 0.34

# The web camera: scope-3d-viewer.tsx PREVIEW_DIRECTION (three: x, y, z) -> Blender (x, -z, y).
VIEW_DIR = Vector((0.22, -1.0, 0.16)).normalized()
FOV_DEG = 28

# --- antenna spring: scope-3d-secondary.ts, same constants -----------------------
SEGMENTS = ((2.6, 0.36), (3.8, 0.34))
HORIZONTAL_GAIN = 0.7
VERTICAL_GAIN = 0.45
MAX_ANGLE = math.radians(20)
MAX_ACCEL = 40.0
SIM_HZ = 120  # render frames fall on every SIM_HZ / FPS = 5th step
SUBSTEP_S = 1 / 240
UP = Vector((0, 0, 1))

# --- runtime single blink: scope-3d-secondary.ts BLINK ---------------------------
BLINK = dict(close=0.09, hold=0.04, open=0.19)


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = dict(out=None, res=720, samples=64, only=None, frames=None, camera=None)
    it = iter(argv)
    for a in it:
        key = a.lstrip("-")
        val = next(it)
        opts[key] = int(val) if key in ("res", "samples") else val
    if not opts["out"]:
        raise SystemExit("--out <dir> is required")
    return opts


# --- composites (channels only, no new motion) -----------------------------------
def scaled(clip, duration):
    """The same clip played at another speed (one full cycle in `duration`)."""
    k = clip.duration / duration
    return C.Clip(clip.name + "@", duration, {ch: (lambda f: (lambda t: f(t * k)))(fn)
                                              for ch, fn in clip.channels.items()}, [], loop=clip.loop)


def single_blink():
    def smooth(x):
        x = min(max(x, 0.0), 1.0)
        return x * x * (3 - 2 * x)

    c, h, o = BLINK["close"], BLINK["hold"], BLINK["open"]

    def blink(t):
        if t < c:
            return smooth(t / c)
        if t < c + h:
            return 1.0
        return 1 - smooth((t - c - h) / o)

    return C.Clip("Blink", c + h + o, {"blink": blink}, [])


def laugh_eyes(laugh):
    """Laugh's eye path only (closed line -> luminous arcs, slightly wider mouth),
    held on the arcs: the body's joy is the Bounce."""
    hold = 1.3  # inside Laugh's arc hold (0.34 -> 1.34 s)
    chans = {ch: (lambda name: (lambda t: laugh.value(name, min(t, hold))))(ch)
             for ch in ("blink", "laugh", "eye_dz", "mouth_w")}
    return C.Clip("LaughEyes", EXIT_S, chans, [])


def sequences():
    by_name = {c.name: c for c in C.all_clips()}
    idle = scaled(by_name["Idle"], LOOP_S)
    loop = C.Clip("LoaderLoop", LOOP_S, {}, [], parts=[
        (idle, 0.0), (by_name["Focus.R"], FOCUS_AT), (single_blink(), BLINK_AT)])
    exit_ = C.Clip("LoaderExit", EXIT_S, {}, [], parts=[
        (idle, 0.0), (by_name["Bounce"], BOUNCE_AT), (laugh_eyes(by_name["Laugh"]), LAUGH_EYES_AT)])
    return loop, exit_, exit_points(by_name["Focus.R"], single_blink())


# deg / mm / ratio: well under a pixel at the loader's size.
QUIET_EPS = 0.02
HOLD_EPS = 0.55


def exit_points(focus, blink):
    """Where the player may leave the loop for the exit (meta.json):
    quiet  frames with only breathing on top of rest: the exit (which starts
           at rest) can take over with a short crossfade.
    hold   Focus's moving hold: nearly still, so the player may skip from any
           of its frames to its last one and let Focus release from there."""
    def away(clip, offset, t, ref=None):
        return max(abs(clip.value(ch, t - offset) - (C.REST[ch] if ref is None else clip.value(ch, ref)))
                   for ch in C.REST)

    frames = range(round(LOOP_S * FPS))
    quiet = [f for f in frames
             if away(focus, FOCUS_AT, f / FPS) < QUIET_EPS and away(blink, BLINK_AT, f / FPS) < QUIET_EPS]
    release = FOCUS_AT + dict(focus.markers)["release"]
    hold = [f for f in frames if f / FPS <= release and away(focus, FOCUS_AT, f / FPS, release - FOCUS_AT) < HOLD_EPS]
    return dict(quiet=quiet, hold=[min(hold), max(hold)])


# --- antenna spring ----------------------------------------------------------------
class Spring:
    def __init__(self, arm):
        self.arm = arm
        pb = arm.pose.bones
        self.bones = [pb["antenna.1"], pb["antenna.2"]]
        self.segs = []
        a1, a2 = (b.bone for b in self.bones)
        seg_vec = (arm.matrix_world @ a2.head_local) - (arm.matrix_world @ a1.head_local)
        for bone, (hz, zeta) in zip(self.bones, SEGMENTS):
            b = bone.bone
            rest_rel = (b.parent.matrix_local.inverted() @ b.matrix_local).to_quaternion()
            world_rest = (arm.matrix_world @ b.matrix_local).to_quaternion()
            k = (2 * math.pi * hz) ** 2
            self.segs.append(dict(rest=rest_rel, tip_local=world_rest.inverted() @ seg_vec,
                                  theta=Vector(), omega=Vector(), prev_tip=None, prev_vel=None,
                                  k=k, c=2 * zeta * math.sqrt(k)))

    def step(self, dt):
        """Advance from the current (authored, un-bent) pose; returns each segment's bend."""
        body = self.bones[0].parent
        parent_q = (self.arm.matrix_world @ body.matrix).to_quaternion()
        base = self.arm.matrix_world @ self.bones[0].head
        bends = []
        for s in self.segs:
            rigid = parent_q @ s["rest"]
            tip = base + rigid @ s["tip_local"]
            if dt > 0:
                self._integrate(s, dt, tip - base, tip, parent_q)
            angle = s["theta"].length
            bends.append(Quaternion(s["theta"].normalized(), angle) if angle > 1e-7 else Quaternion())
            parent_q = parent_q @ s["rest"]
            base = base + parent_q @ s["tip_local"]
        return bends

    def _integrate(self, s, dt, r, tip, parent_q):
        accel = Vector()
        if s["prev_tip"] is not None:
            vel = (tip - s["prev_tip"]) / dt
            if s["prev_vel"] is not None:
                accel = (vel - s["prev_vel"]) / dt
            s["prev_vel"] = vel
        s["prev_tip"] = tip.copy()
        if accel.length > MAX_ACCEL:
            accel = accel.normalized() * MAX_ACCEL
        vertical = accel.dot(UP)
        accel = (accel - UP * vertical) * HORIZONTAL_GAIN + UP * (vertical * VERTICAL_GAIN)
        to_parent = parent_q.inverted()
        alpha = to_parent @ (r.cross(-accel) / max(r.length_squared, 1e-8))
        axis = to_parent @ r.normalized()
        t = 0.0
        while t < dt - 1e-9:
            h = min(SUBSTEP_S, dt - t)
            acc = alpha - s["theta"] * s["k"] - s["omega"] * s["c"]
            s["omega"] += acc * h
            s["theta"] += s["omega"] * h
            s["theta"] -= axis * s["theta"].dot(axis)
            s["omega"] -= axis * s["omega"].dot(axis)
            t += h
        if s["theta"].length > MAX_ANGLE:
            s["theta"] = s["theta"].normalized() * MAX_ANGLE

    def apply(self, bends):
        """Bend on top of the authored pose, in the parent's frame (as on the web)."""
        for bone, s, bend in zip(self.bones, self.segs, bends):
            q = s["rest"].inverted() @ bend @ s["rest"] @ bone.rotation_quaternion
            bone.rotation_quaternion = q


# --- scene ---------------------------------------------------------------------------
def setup(res, samples):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    arm = bpy.data.objects["Scope_Rig"]
    # Same initialisation as validate_scope.py: the glass functions read the
    # profile and the grounded centres stored in the rig.
    S.apply_profile("sheet")
    S.P["shell_center_z"] = arm.data.bones["body"].head_local.z
    S.P["display_center_z"] = S.P["shell_center_z"] + S.P["display_center_dz"]
    F.reset()
    for owner in (arm, bpy.data.objects["Scope_Eyes"].data.shape_keys):
        if owner.animation_data:
            owner.animation_data.action = None
            owner.animation_data.use_nla = False

    cams = studio.replace()
    studio.render_settings(res, samples)
    studio.bloom()
    scene = bpy.context.scene
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    # Scope alone: a shadow catcher records the whole floor's soft lighting as
    # a large noisy veil, which reads as dirt on the loader's flat background.
    bpy.data.objects["Studio_Floor"].hide_render = True

    cam = cams["focus"]
    cam.data.type = "PERSP"
    cam.data.sensor_fit = "VERTICAL"
    cam.data.angle = math.radians(FOV_DEG)
    # Distance: the studio's hero framing, scaled to the narrower field of view,
    # with room for the hop and the antenna; encode-loader.mjs crops the frames
    # to the union of their alpha.
    target = studio.TARGET + Vector((0, 0, 0.004))
    distance = 0.62
    cam.location = target + VIEW_DIR * distance
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return arm


def check_against_bake(arm, rig):
    """apply() must reproduce the baked actions (the approved animation)."""
    by_name = {c.name: c for c in C.all_clips()}
    for name, t in (("Focus.R", 1.2), ("Bounce", 0.47), ("Laugh", 0.6)):
        C.apply(rig, by_name[name], t)
        bpy.context.view_layer.update()
        mine = [tuple(pb.matrix) for pb in arm.pose.bones]
        keys = rig["eyes"].data.shape_keys
        ad, kad = arm.animation_data, keys.animation_data
        for owner, act in ((ad, bpy.data.actions[name]), (kad, bpy.data.actions[name + "__eyes"])):
            owner.action = act
            if getattr(owner, "action_slot", None) is None and len(getattr(act, "slots", [])):
                owner.action_slot = act.slots[0]
        bpy.context.scene.frame_set(round(t * C.FPS))
        baked = [tuple(pb.matrix) for pb in arm.pose.bones]
        ad.action = kad.action = None
        dev = max(abs(a - b) for ma, mb in zip(mine, baked) for ra, rb in zip(ma, mb) for a, b in zip(ra, rb))
        print(f"[loader] apply vs baked {name} t={t}: max matrix deviation {dev:.2e}")
        if dev > 1e-4:
            raise RuntimeError(f"apply() no longer reproduces the baked {name}")


def pose(rig, spring, clip, t, dt):
    C.apply(rig, clip, t)
    bpy.context.view_layer.update()
    spring.apply(spring.step(dt))


def main():
    o = parse()
    arm = setup(o["res"], o["samples"])
    rig = dict(arm=arm, eyes=bpy.data.objects["Scope_Eyes"])
    check_against_bake(arm, rig)
    loop, exit_, points = sequences()
    spring = Spring(arm)
    out = os.path.abspath(o["out"])
    lo, hi = (int(x) for x in o["frames"].split(":")) if o["frames"] else (0, 10 ** 9)
    scene = bpy.context.scene
    step = SIM_HZ // FPS
    dt = 1 / SIM_HZ
    n_loop, n_exit = round(LOOP_S * FPS), round(EXIT_S * FPS)

    def render(path):
        t0 = time.time()
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print(f"[loader] {os.path.relpath(path, out)} ({time.time() - t0:.1f}s)", flush=True)

    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(dict(fps=FPS, loop=n_loop, exit=n_exit, **points,
                       exitStartsFrom=0, loopSeconds=LOOP_S, exitSeconds=EXIT_S), fh, indent=2)

    if o["only"] == "still":
        pose(rig, spring, loop, 0.0, 0.0)
        render(os.path.join(out, "still.png"))
        return
    if o["only"] == "dock":
        # The site's live camera, exactly (three coords, from fitCameraToEnvelope
        # on SCOPE_3D_WEB_ENVELOPE, square canvas): the fallback still then sits
        # where the live Scope will, so a late upgrade to 3D crossfades in place.
        px, py, pz, tx, ty, tz = (float(v) for v in o["camera"].split(","))
        cam = scene.camera
        cam.location = Vector((px, -pz, py))
        cam.rotation_euler = (Vector((tx, -tz, ty)) - cam.location).to_track_quat("-Z", "Y").to_euler()
        pose(rig, spring, loop, 0.0, 0.0)
        render(os.path.join(out, "dock.png"))
        return

    # Warm-up lap: the spring enters the recorded lap already in its periodic state.
    for i in range(n_loop * step):
        pose(rig, spring, loop, i * dt, dt)
    if o["only"] in (None, "loop"):
        os.makedirs(os.path.join(out, "loop"), exist_ok=True)
    for i in range(n_loop * step):
        pose(rig, spring, loop, i * dt, dt)
        f = i // step
        if i % step == 0 and o["only"] in (None, "loop") and lo <= f < hi:
            render(os.path.join(out, "loop", f"{f:04d}.png"))
    if o["only"] == "loop":
        return
    # The exit starts exactly where the loop wraps (frame 0's pose, spring state carried on).
    os.makedirs(os.path.join(out, "exit"), exist_ok=True)
    for i in range((n_exit + 1) * step):
        pose(rig, spring, exit_, i * dt, dt)
        f = i // step
        if i % step == 0 and f < n_exit and lo <= f < hi:
            render(os.path.join(out, "exit", f"{f:04d}.png"))
    pose(rig, spring, loop, 0.0, 0.0)
    render(os.path.join(out, "still.png"))


main()
