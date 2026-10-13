# Scope 3D — validación

Generado por `scripts/validate_scope.py` sobre `blender/scope-master.blend`. Todos los valores son medidos, no estimados.

| Comprobación | Resultado | Detalle |
|---|---|---|
| skin: shell weights sum to 1 | ✅ PASS | min 1.00000, max 1.00000 |
| skin: face glass 100% body | ✅ PASS | 8705 glass vertices, 0 off |
| skin: eyes 100% eye bones | ✅ PASS | 1844 eye vertices, 0 off |
| rest: clips start/end at rest | ✅ PASS | 12 clips checked |
| ground: no vertex below the floor | ✅ PASS | lowest shell vertex over all frames: -0.04 mm |
| face: glass rigid with the body | ✅ PASS | max deviation 0.0000 mm |
| eyes: seated on the glass | ✅ PASS | max seat error 0.000 mm |
| face: eye/mouth outlines never under the glass | ✅ PASS | 96 eye + 24 mouth outline vertices; lowest clearance +0.134 mm (Focus.L frame 28, Scope_Eyes); v1 reached -1.565 mm |
| glTF: one animation per clip | ✅ PASS | 12 animations: BlinkDouble, Bounce, ClickReaction, Focus.L, Focus.R, Idle, Laugh, LookAround.L, LookAround.R, Stretch, Tilt.L, Tilt.R |
| glTF: morph targets + morph animation | ✅ PASS | 3 morph targets, 12 weight channels |
| glTF: skin | ✅ PASS | 14 joints, file 3012 KB (not web-optimised: no compression, no baked textures) |
| glTF: re-import | ✅ PASS | 12 actions after import, 9 objects |
