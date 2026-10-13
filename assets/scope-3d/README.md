# Scope 3D

Versión 3D definitiva de Scope: modelo aprobado, rig y 12 animaciones. Todo se genera
mediante scripts (`bpy`) en Blender en modo headless.

**Estado:** base definitiva aprobada. **No integrado en la web**: el Scope 2D
(`src/components/scope/`) sigue siendo el de producción.

Documentación:
- `docs/scope-docs/SCOPE_3D_MODEL.md`: modelo y decisiones de diseño.
- `docs/scope-docs/SCOPE_3D_ANIMATION.md`: rig, clips, máquina de estados e integración.

```
blender/scope-master.blend   modelo + rig + 12 clips (fuente editable; se regenera con build_scope.py)
exports/scope.glb            glTF 2.0 con skin, morph targets Blink/Laugh y 12 animaciones (aún no optimizado para web)
exports/scope-clips.json     duraciones y marcadores de los clips (los lee la máquina de estados y sus pruebas)
renders/model/<luz>/         vistas del modelo en reposo (luz cálida, como la hoja, y fría)
renders/animation/           hojas de contacto de cada clip y de la secuencia del clic
reports/                     ENVIRONMENT.md (entorno headless), VALIDATION.md (comprobaciones medidas)
scripts/                     pipeline (ver abajo)
```

La referencia visual es la hoja original de `docs/scope-docs/scope/references/`; no se
duplica aquí.

## Pipeline

Desde la raíz del repo, con Git Bash. Blender no está en el PATH; nunca se abre con interfaz,
y todos los renders son Cycles por CPU.

```sh
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
S=assets/scope-3d/scripts

"$B" --background --factory-startup --python $S/check_env.py      # verifica el entorno headless
"$B" --background --factory-startup --python $S/build_scope.py    # modelo + rig + clips -> blender/scope-master.blend
"$B" --background --factory-startup --python $S/export_scope.py   # -> exports/scope.glb
"$B" --background --factory-startup --python $S/validate_scope.py # comprobaciones + export + reimport -> reports/VALIDATION.md
"$B" --background --factory-startup --python $S/render_clips.py   # hojas de contacto -> renders/animation/
"$B" --background --factory-startup --python $S/render_views.py   # vistas del modelo -> renders/model/
node --test src/components/scope-3d/behavior/scope-3d-behavior.test.ts   # máquina de estados
```

`build_scope.py` se niega a añadir el rig si la carcasa generada deja de coincidir con
`scripts/approved-geometry.json` (la geometría aprobada). Si cambias la geometría a
propósito, actualiza esa firma conscientemente.

## Scripts

| Archivo | Función |
|---|---|
| `check_env.py` | Comprueba Blender, guardado, exportación GLB y render por CPU |
| `build_scope.py` | Construye el modelo aprobado, comprueba su firma, añade el rig y hornea los clips |
| `export_scope.py` | Exporta `exports/scope.glb` |
| `validate_scope.py` | Pesos, reposo, suelo, rigidez de la cara, ojos, exportación y reimportación |
| `render_clips.py` | Hojas de contacto por clip y de la secuencia del clic |
| `render_views.py` | Vistas estáticas con el estudio estándar |
| `approved-geometry.json` | Firma de la geometría aprobada |

| Módulo (`scripts/scope3d/`) | Responsabilidad |
|---|---|
| `spec.py` | Medidas y colores aprobados (única fuente numérica) |
| `faceshell.py` | Carcasa + cristal en una sola malla con bucles que siguen el contorno de la cara; patas y pesos |
| `geometry.py` | Superficie analítica de la carcasa, patas, boca, antena, acento |
| `materials.py` | Cerámica mineral, cristal, ojos y acento (Principled BSDF) |
| `character.py` | Monta las piezas en la pose de reposo |
| `rig.py` | Armature, pesos y malla de ojos con shape keys `Blink` / `Laugh` |
| `clips.py` | Clips como curvas de tiempo, muelle de la antena, horneado a acciones y pistas NLA |
| `export.py` | Exportación glTF (compartida por export y validación) |
| `studio.py` | Estudio de render: mundo, luces cálida/fría, cámaras, Cycles CPU, bloom |
| `sheets.py` | Hojas de contacto con numpy |
