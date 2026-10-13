"""Contact sheets for every clip (6 marker frames each) + the click sequence.

Run:
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
      --python assets/scope-3d/scripts/render_clips.py -- [clip names...] [--res N] [--samples N] [--view hero]

Output: renders/animation/sheet-<clip>.png (6 marker frames each) and
        renders/animation/sheet-click-sequence.png. Single frames are rendered to
        a temporary folder and only the contact sheets are kept.
"""

import os
import shutil
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from scope3d import clips, sheets, studio  # noqa: E402

ROOT = os.path.dirname(HERE)
BLEND = os.path.join(ROOT, "blender", "scope-master.blend")
OUT = os.path.join(ROOT, "renders", "animation")


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts, names = {"res": 360, "samples": 16, "view": "hero"}, []
    it = iter(argv)
    for a in it:
        if a in ("--res", "--samples"):
            opts[a[2:]] = int(next(it))
        elif a == "--view":
            opts["view"] = next(it)
        else:
            names.append(a)
    return names, opts


def assign(owner, action):
    ad = owner.animation_data
    ad.use_nla = False
    ad.action = action
    if action is not None and getattr(ad, "action_slot", None) is None and len(getattr(action, "slots", [])):
        ad.action_slot = action.slots[0]


def play(clip_name):
    arm = bpy.data.objects["Scope_Rig"]
    key = bpy.data.objects["Scope_Eyes"].data.shape_keys
    act = bpy.data.actions[clip_name]
    assign(arm, act)
    assign(key, bpy.data.actions[clip_name + "__eyes"])
    return act


def render_frame(cam, clip_name, t, path):
    frame = round(t * clips.FPS)
    bpy.context.scene.frame_set(frame)
    studio.render(cam, path)


def main():
    names, o = parse()
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    studio.render_settings(o["res"], o["samples"])
    cams = {c.name[4:]: c for c in bpy.data.objects if c.type == "CAMERA"}
    cam = cams[o["view"]]
    frames_dir = tempfile.mkdtemp(prefix="scope_clips_")
    os.makedirs(OUT, exist_ok=True)
    targets = names or [a.name for a in bpy.data.actions
                        if not a.name.endswith("__eyes") and a.name not in ("ClickReaction",)]
    for name in targets:
        act = play(name)
        markers = list(zip(act["scope_markers"], act["scope_marker_times"]))
        folder = os.path.join(frames_dir, name)
        os.makedirs(folder, exist_ok=True)
        tiles = []
        for i, (label, t) in enumerate(markers):
            path = os.path.join(folder, f"{i}-{label.replace(' ', '-')}.png")
            t0 = time.time()
            render_frame(cam, name, t, path)
            print(f"[clips] {name} {label} t={t:.2f}s ({time.time() - t0:.1f}s)")
            tiles.append(sheets.load(path))
        sheets.grid(tiles, 3, os.path.join(OUT, f"sheet-{name}.png"))

    if not names or "ClickReaction" in names:
        act = play("ClickReaction")
        duration = act["scope_marker_times"][-1]
        folder = os.path.join(frames_dir, "ClickReaction")
        os.makedirs(folder, exist_ok=True)
        times = [round(duration * k / 11, 3) for k in range(12)]  # evenly through the whole reaction
        tiles = []
        for i, t in enumerate(times):
            path = os.path.join(folder, f"{i:02d}-t{t:.2f}.png")
            render_frame(cam, "ClickReaction", t, path)
            print(f"[clips] ClickReaction t={t:.2f}s")
            tiles.append(sheets.load(path))
        sheets.grid(tiles, 4, os.path.join(OUT, "sheet-click-sequence.png"))
    shutil.rmtree(frames_dir, ignore_errors=True)


main()
