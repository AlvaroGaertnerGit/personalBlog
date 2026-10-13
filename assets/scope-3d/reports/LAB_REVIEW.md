# Revisión en `/scope-lab` — 2026-10-13

Primera revisión de Scope 3D en el navegador (three.js r180, Chromium y GTX 1660 Ti mediante
ANGLE/D3D11). Material de partida: hojas de contacto renderizadas en el propio visor, fotograma
a fotograma, y mediciones de los huesos y morphs en tiempo real.

**Qué no cubre:** he visto fotogramas fijos y curvas medidas, no el movimiento percibido a 60 fps.
La sensación de peso, ritmo y "personalidad" queda pendiente de la revisión del propietario.

En esta fase **no se ha modificado ningún clip, el rig ni el GLB**.

## 1. Estado técnico

| Comprobación | Resultado |
|---|---|
| GLB carga en three.js | Sí: 2,85 MB, ~230 ms de descarga local, ~17 ms de análisis |
| Clips en el GLB | 12 + Idle, con los nombres de `scope-clips.json` y duraciones idénticas |
| Morph targets / joints | `Blink`, `Laugh` / 14 |
| Triángulos del modelo | 97 212 (48 955 vértices) |
| Por fotograma | ~27 draw calls con sombras y bloom; ~180 FPS en la GTX 1660 Ti |
| Secuencia de clic | Interrumpe con fundido de 180 ms → Stretch → Laugh exactamente a 1,00 s → RETURN_TO_IDLE → IDLE; temporizador reiniciado |
| Clics repetidos | 4 de 5 ignorados (no se acumulan) |
| Clic real | Sobre el modelo, dispara la reacción; sobre el fondo, nada; un arrastre de cámara no cuenta como clic |
| Saltos entre clips | Ninguno medido (Idle → LookAround/Tilt/Bounce → Idle, autónoma → clic) |
| Modo Replace | Idle cede el peso y lo recupera antes del final (la suma se mantiene ≈ 1) |
| tsc / ESLint / tests / build | Sin errores; 11/11 tests |

## 2. Corregido en el visor (sin tocar el GLB)

1. **El parpadeo se pasaba de "cerrado"** (`Blink` = 1,08). El peso de amplitud aleatorio
   (0,85–1,1) también escala los morphs. Ahora las influencias se limitan a [0, 1].
2. **Un arco blanco bajo los ojos al girar** parecía una boca sonriente. Es el clearcoat de
   0,16 iluminado por luces puntuales; en Blender son luces de área grandes. En el visor
   sube a 0,3.
3. **El bloom teñía todo el cristal de ámbar** (radio demasiado amplio). Se ha reducido a un
   halo pegado a los ojos.
4. **El Scope 2D del layout y el selector de tema** aparecían encima del laboratorio. Se
   ocultan solo en esta ruta, con CSS y sin tocar su código.

## 3. Problemas visuales detectados (por prioridad)

| # | Clip | Problema | Causa medida |
|---|---|---|---|
| A | **Bounce** | La antena no reacciona al salto (0,0° en todo el clip) | `clips.py` `_spring_series`: acoplamiento vertical `0.010 * az` con `az` en mm/s², unas 100 veces corto (≈ 0,06°). Además, el fundido final de 0,25 s cubre el aterrizaje (0,68 s de un clip de 0,9 s) |
| B | **Bounce** | Las 4 patas rotan 11° idénticas y a la vez: movimiento robótico | Un único canal `feet` aplicado igual a las cuatro |
| C | **Laugh** | La antena casi no acompaña (1,8° de pico); la risa se nota sobre todo en los ojos | Las risitas son *squash* a 3,3 Hz, que no excita el muelle (solo pitch, roll, yaw y hop) |
| D | **ClickReaction ≈1,05–1,16 s** | Al pasar de la cápsula entornada al arco, el ojo forma una "cúpula de base plana" unos 70 ms | El morph `Laugh` interpola los vértices en línea recta |
| E | **Focus vs LookAround** | En plano general se parecen: Focus gira 9° y LookAround 14°, ambos con mirada lateral | La convergencia de ojos (13 %) y el avance de 2 mm apenas se leen |
| F | **BlinkDouble** | El cierre es simétrico hacia el centro (como un escalado); correcto pero algo mecánico | El shape key `Blink` colapsa hacia la línea media |
| G | **Tilt** | El pico de la antena (0,50 s) llega antes que el del cuerpo (0,73 s) | El muelle reacciona a la aceleración del arranque y se apaga antes del pico |
| H | **Look/Tilt/Laugh** | Las patas no participan (0°) | Por diseño: quedan plantadas y se deforman con la piel |
| I | **Material** | El grano mineral es una aproximación procedural; falta el relieve fino | glTF no lleva el nodo procedural; pendiente hornear texturas |

## 4. Propuesta de ajustes (pendiente de tu feedback)

Todos los cambios se harían en `assets/scope-3d/scripts/scope3d/clips.py` y se volverían a
hornear con `build_scope.py`, conservando antes una copia del `.blend` y del `.glb` aprobados.

1. **Antena con inercia vertical real (A, C):**
   - convertir `az` a m/s² o subir el coeficiente para que el salto de 11 mm dé unos 6–9° de
     cabeceo con rebote;
   - alimentar el muelle también con la aceleración del *squash* (las risitas → 3–5°);
   - acortar el fundido final a unos 0,15 s o empezarlo después del asentamiento.
2. **Patas desfasadas (B):**
   - recoger y aterrizar primero las delanteras y luego las traseras, con 30–50 ms de
     diferencia;
   - amplitud ±15 % por pata.
3. **Transición de ojos a la risa (D):**
   - o bien un shape key intermedio (`Laugh_mid`) que lleve la cápsula al arco por un
     camino curvo;
   - o bien acortar el cruce a 2–3 fotogramas, ocultos mientras los ojos aún están entornados.
4. **Diferenciar Focus (E):**
   - mantener la mirada más tiempo y con menos giro de cuerpo (unos 5°);
   - más inclinación hacia delante (unos 5°) y convergencia visible;
   - la antena se adelanta y se queda quieta: concentración, no exploración.
5. **Parpadeo con párpado (F):** que la línea cierre algo por encima del centro (el párpado
   superior baja más), como en el 2D.
6. **Tilt (G):** retrasar 60–80 ms la respuesta de la antena respecto a la cabeza.
7. **Antes de integrar en la web:** decidir el modo de mezcla. La recomendación es aditivo
   sobre Idle: las mediciones no muestran conflictos entre huesos, y Replace congela la
   respiración durante el clip.
