# Scope 3D

Versión 3D definitiva de Scope: modelo aprobado, rig y 12 animaciones. Todo se genera
mediante scripts (`bpy`) en Blender en modo headless.

**Estado:** integrado en la web (2026-10-14) como el compañero del sitio
(`src/components/scope-3d/scope-live.tsx`), con la pantalla de entrada «Scope está
explorando» (`src/components/scope-3d/entry/`). Ver «Web» más abajo.

Documentación:
- `docs/scope-docs/SCOPE_3D_MODEL.md`: modelo y decisiones de diseño.
- `docs/scope-docs/SCOPE_3D_ANIMATION.md`: rig, clips, máquina de estados e integración.

```
blender/scope-master.blend   modelo + rig + 12 clips (fuente editable; se regenera con build_scope.py)
exports/scope.glb            glTF 2.0 con skin, morph targets Blink/Laugh y 12 animaciones (aún no optimizado para web)
exports/scope-clips.json     duraciones y marcadores de los clips (los lee la máquina de estados y sus pruebas)
renders/model/<luz>/         vistas del modelo en reposo (luz cálida, como la hoja, y fría)
renders/animation/           hojas de contacto de cada clip y de la secuencia del clic (Blender)
renders/web/                 comparativas antes/después en el navegador y vídeos (videos/*.webm)
reports/                     VALIDATION.md (comprobaciones medidas), POLISH_REVIEW.md (nitidez, ojos,
                             movimiento, rendimiento), web-metrics.json, revisiones anteriores
approved/2026-10-13-v1/      copia recuperable del modelo v1 aprobado (.blend, .glb, clips, scripts, hojas)
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
node --test src/components/scope-3d/behavior/scope-3d-behavior.test.ts src/components/scope-3d/engine/scope-3d-animator.test.ts
node assets/scope-3d/scripts/web/measure-web.mjs http://localhost:3000   # mediciones en Chrome real (con pnpm dev)
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
| `web/measure-web.mjs` | Mediciones reproducibles en el navegador (Playwright + Chrome): nitidez, continuidad, antena, patas, rendimiento |

| Módulo (`scripts/scope3d/`) | Responsabilidad |
|---|---|
| `spec.py` | Medidas y colores aprobados (única fuente numérica) |
| `faceshell.py` | Carcasa + cristal en una sola malla con bucles que siguen el contorno de la cara; patas y pesos |
| `geometry.py` | Superficie analítica de la carcasa, patas, boca, antena, acento |
| `materials.py` | Cerámica mineral, cristal, ojos y acento (Principled BSDF) |
| `character.py` | Monta las piezas en la pose de reposo |
| `rig.py` | Armature, pesos y malla de ojos envuelta sobre el cristal con shape keys `Blink` / `Laugh` / `Tall` |
| `clips.py` | Clips como curvas de tiempo (patas desfasadas, ojos que giran con el cristal), horneado a acciones y pistas NLA. El muelle de la antena es de runtime |
| `export.py` | Exportación glTF (compartida por export y validación) |
| `studio.py` | Estudio de render: mundo, luces cálida/fría, cámaras, Cycles CPU, bloom |
| `sheets.py` | Hojas de contacto con numpy |

## Web (producción)

Recursos en `public/scope/` (todos regenerables; nunca editar a mano):

| Archivo | Tamaño | Origen |
|---|---|---|
| `scope.glb` | 698 KB (359 KB gzip) | `exports/scope.glb` + gltf-transform: `resample` y `meshopt` (posición 16 bits, normales 12) |
| `scope-still.webp` | 7 KB | Scope en reposo desde la cámara exacta del sitio: sustituye al 3D (sin WebGL, error, timeout) en su mismo sitio |
| `loader/still.webp` | 9 KB | primer fotograma del loader (primer pintado, movimiento reducido) |
| `loader/loop.avif` / `.webp` | 362 / 598 KB | bucle de espera, 78 fotogramas a 24 fps (hoja de sprites) |
| `loader/exit.avif` / `.webp` | 169 / 294 KB | salida (Bounce + ojos de Laugh), 36 fotogramas |
| `loader/manifest.json` | — | tamaño, rejilla, fotogramas «quiet» y ventana «hold» |

```sh
# 1. GLB web (NODE_OPTIONS=--use-system-ca si la red intercepta TLS)
npx @gltf-transform/cli@4 resample assets/scope-3d/exports/scope.glb /tmp/r.glb
npx @gltf-transform/cli@4 meshopt /tmp/r.glb public/scope/scope.glb --level medium \
    --quantize-position 16 --quantize-normal 12 --quantize-texcoord 14
node assets/scope-3d/scripts/web/web-envelope.ts --write   # encuadre precalculado (scope-3d-web-envelope.ts)

# 2. Fotogramas del loader (Cycles CPU, ~10 min) y fondo del compañero
"$B" --background --factory-startup --python $S/render_loader.py -- --out /tmp/loader --res 800 --samples 48
"$B" --background --factory-startup --python $S/render_loader.py -- --out /tmp/loader --res 384 --samples 64 \
    --only dock --camera 0.09252,0.15516,0.41733,-0.00029,0.08766,-0.00456   # cámara del sitio (fitCameraToEnvelope)
node assets/scope-3d/scripts/web/encode-loader.mjs /tmp/loader                # -> public/scope/loader + scope-still.webp

# 3. Pruebas (incluye que el encuadre guardado coincide con el GLB)
node --test src/components/scope-3d/**/*.test.ts
```

`render_loader.py` no crea movimiento nuevo: compone canales de los clips aprobados
(bucle = Idle acelerado a 3,25 s + Focus.R + parpadeo simple del runtime; salida = Idle +
Bounce + trayectoria de ojos de Laugh), comprueba que `apply()` reproduce las acciones
horneadas (desviación 0) y simula el muelle de la antena con las constantes de
`scope-3d-secondary.ts`. Cámara = dirección y FOV de la web. El `.blend` no se guarda.

**Formato del loader:** hojas de sprites AVIF (WebP si el navegador no tiene AVIF) en un
canvas 2D. Se descartaron: GIF (calidad/tamaño), WebP animado en `<img>` (sin control
de fotograma: la salida no puede esperar a un fotograma «quiet») y vídeo con alfa (VP9
alfa no funciona en Safari; HEVC alfa no se puede codificar aquí). A densidad 2× las hojas
pesaban 1,27 MB y 73 MB decodificadas; a 1,6× (≥ 2× en móvil) 531 KB y 46 MB, que se
liberan al terminar la entrada.
