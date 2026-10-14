#!/bin/sh
# Final renders for Entrega 1 (headless, CPU). Run from the repo root:
#   sh docs/scope-world/blender/render-all.sh
B="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
S=docs/scope-world/blender/pliego.py
O=docs/scope-world/renders/raw
export PYTHONDONTWRITEBYTECODE=1
run() { "$B" --background --factory-startup --python "$S" -- --out "$O" "$@" 2>&1 | grep -E "^\[pliego\]|Error|Traceback"; }
run --shot main,home --res 1920 --samples 96
run --shot home-m --res 1080 --samples 96
run --shot map --res 1920 --samples 64
run --shot sb1-night,sb2-lamp,sb3-question,sb4-folding,sb5-firing,sb6-pieces,sb7-class,sb8-note,sb9-planted --res 1280 --samples 64
echo "[pliego] all done"
