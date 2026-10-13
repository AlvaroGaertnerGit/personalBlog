"""Contact sheets assembled with numpy inside Blender (no PIL dependency)."""

import os

import bpy
import numpy as np

GAP = 12
BG = (0.035, 0.035, 0.045, 1.0)


def load(path, size=None):
    img = bpy.data.images.load(path, check_existing=False)
    if size:
        img.scale(*size)
    w, h = img.size
    arr = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(arr)
    bpy.data.images.remove(img)
    return arr.reshape(h, w, 4)  # bottom-up rows, as Blender stores them


def grid(tiles, cols, path):
    th, tw = tiles[0].shape[:2]
    rows = (len(tiles) + cols - 1) // cols
    W, H = cols * tw + (cols + 1) * GAP, rows * th + (rows + 1) * GAP
    canvas = np.empty((H, W, 4), np.float32)
    canvas[:] = BG
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        y0 = H - GAP - (r + 1) * th - r * GAP  # bottom-up storage, first row at top
        x0 = GAP + c * (tw + GAP)
        canvas[y0:y0 + th, x0:x0 + tw] = t[:th, :tw]
    img = bpy.data.images.new(os.path.basename(path), W, H, alpha=True)
    img.pixels.foreach_set(canvas.ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    print("[sheet]", path)
