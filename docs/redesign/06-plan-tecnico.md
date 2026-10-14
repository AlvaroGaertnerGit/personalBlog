# F. Plan técnico

Este plan es para la recomendación (dirección **C sobre el sistema de A**). Las partes 1
(seguimiento del cursor) y 2 (luz común) valen para cualquiera de las tres direcciones.
**Nada de esto está implementado:** es diseño para aprobación.

---

## 1. Seguimiento del cursor (capa Presence 3D)

### 1.1 Requisitos (del brief)

- Los ojos siguen al cursor.
- El cuerpo acompaña con una rotación leve.
- Los ojos reaccionan antes que el cuerpo.
- La antena conserva su inercia.
- El movimiento es suave, creíble, sin vibraciones y dentro de los límites del rig.
- Los clips autónomos y el clic (Stretch → Laugh → Idle) se mantienen intactos.
- En móvil no se simula un cursor.
- Se respeta el movimiento reducido.

### 1.2 Lo que ya existe y se reutiliza

| Pieza | Dónde | Uso |
|---|---|---|
| Hueso `look`, reservado para esto, que ningún clip anima | rig (`SCOPE_3D_ANIMATION.md` §2) | Orientación del cuerpo hacia el cursor |
| Huesos `eye.L`/`eye.R` | rig | Mirada, que se suma al clip |
| Constantes de la capa Presence del 2D, ya convertidas | `SCOPE_3D_ANIMATION.md` §4 | Alcance de 600 px; ±10° de giro y ±8° de cabeceo; muelle del cuerpo 90/16/1,2; ojos ±4,5 mm, muelle 260/18/0,5 y anticipación de 45 ms |
| Muelle de la antena movido por la inercia del cuerpo | `scope-3d-secondary.ts` | **La inercia de la antena sale gratis**: al girar `look`, la punta acelera y el muelle reacciona |
| Deriva de postura sobre `look` | `Scope3DSecondary.applyDrift()` | Se compone con la Presence; no se sustituye |
| Bucle de render, pausa fuera de pantalla, raycast del hover | `scope-3d-viewer.tsx` | Se reutilizan el bucle y la caché del rectángulo del canvas |
| `activity` (0–1 mientras suena un clip) | `Scope3DSecondary` | Atenúa la Presence durante los clips |

### 1.3 Arquitectura

```
pointer (window, passive)                  ┐
  └─ ScopePointer: último {x, y, t}, tipo  │  sin estado React, sin layout por evento
                                           ┘
rAF del viewer (ya existe)
  director.update(dt)
    animator.update(dt)          ← clips (Idle + comportamiento)
    secondary.update(dt, busy)   ← deriva + muelle de antena + parpadeos
      ├─ applyDrift()   look = rest · drift
      ├─ presence.apply(look, eyes)   ← NUEVO: look = rest · drift · presence ; eyes += gaze
      ├─ stepSprings()  antena (ve la nueva inercia del cuerpo)
      └─ applyBlink()
```

**Módulo nuevo:** `engine/scope-3d-presence.ts` (TypeScript puro + `three/math`). Es
testeable con `node --test`, como el resto del motor.

**Pasos por fotograma (cero asignaciones):**

1. **Objetivo en pantalla.** Se toma la posición del puntero relativa al centro de la cara de
   Scope en pantalla. Ese centro sale de proyectar el hueso `body` con la cámara y el
   rectángulo del canvas. El rectángulo se lee **una vez por fotograma**, al principio y
   antes de cualquier escritura, porque Scope se desplaza con la página.
2. **Normalización con saturación suave.** `u = tanh(d / 600 px)` por eje. Cerca de Scope
   responde casi lineal; lejos, se satura sin un tope brusco. Nunca supera 1, así que **nunca
   sale de los límites del rig**.
3. **Objetivos.**
   - Ojos: `gaze = u · 4,5 mm` (límite usado por LookAround).
   - Cuerpo: `yaw = u.x · 10°`, `pitch = −u.y · 8°`.
   - Inclinación lateral mínima (`roll = yaw · 0,15`), que da el «acompaña con el cuerpo».
4. **Orden ojos → cuerpo.** Dos muelles críticamente amortiguados con constantes distintas.
   Los ojos usan 260/18/0,5 y alcanzan el 63 % en ~70 ms; el cuerpo, 90/16/1,2, en ~250 ms.
   Además, el objetivo del cuerpo pasa por un **retardo de 90 ms** (un búfer circular de
   objetivos). Resultado: los ojos llegan antes, el cuerpo los sigue y la antena llega
   detrás por inercia. Es el mismo orden que ya usan los clips (`SCOPE_3D_ANIMATION.md`:
   «los ojos guían, el cuerpo sigue ~0,1 s después»).
5. **Anticipación.** El objetivo de los ojos se adelanta con la velocidad del puntero
   (45 ms, como el 2D), limitada para que un movimiento brusco no dispare la mirada.
6. **Sin vibración.**
   - Zona muerta de 2 px en el objetivo.
   - Muelles críticamente amortiguados (ζ ≥ 1 en el cuerpo).
   - Integración con subpasos fijos (el mismo `SUBSTEP_S` = 1/240 s del muelle de la antena).
   - Así el resultado no depende de la tasa de refresco (60/120/144 Hz).
7. **Mirada sobre el cristal curvo.** Los ojos no se mueven en un plano: los clips los
   deslizan **sobre el cristal y los giran con su normal** (`clips.py::_slide_on_glass`).
   - Para no volver a implementar esa superficie en TypeScript, se exporta desde Blender
     headless una **tabla de 9×9 muestras** (la posición y rotación del hueso del ojo para
     `dx, dz ∈ [−4,5, 4,5] mm`). En el runtime se interpola de forma bilineal.
   - La boca acompaña a 0,3/0,25, igual que en los clips.
   - Validación: la interpolación reproduce los fotogramas horneados de LookAround con un
     error < 0,05 mm. Es un test automático, igual que el de desviación 0 del loader.
8. **Composición.**
   - `look = rest · drift · presence`.
   - Ojos = clip + `w_eyes · gaze`.

### 1.4 Convivencia con los clips y el clic

| Estado | Peso cuerpo | Peso ojos | Motivo |
|---|---|---|---|
| Idle | 1 | 1 | Atención plena |
| Clip autónomo (Tilt, Focus, LookAround, Bounce, BlinkDouble) | 0,3 | 0,35 | Igual que la deriva (`DRIFT_DURING_CLIPS`); el clip se lee limpio |
| ClickReaction (Stretch → Laugh) | 0,1 | **0** | Ojos cerrados o en arco: la Presence no debe deformar el gesto aprobado |
| Vuelta a Idle | rampa 0,4 s | rampa 0,4 s | Sin saltos |
| Cursor fuera de la ventana o inactivo > 3 s | objetivo → 0 con muelle lento | ídem | Scope «vuelve a lo suyo» y la vida autónoma sigue |
| Pestaña oculta / Scope fuera de la vista | — | — | El bucle ya está en pausa: no se calcula nada |

Los pesos salen de `animator.busy` y del estado de la máquina (`CLICK_*`). **La máquina de
estados no cambia**: la Presence es una capa posterior al mixer, como la deriva.

### 1.5 Dispositivos y preferencias

- **Solo puntero fino:** `pointerType === "mouse" || "pen"` y
  `matchMedia("(hover: hover) and (pointer: fine)")`. Con un toque no hay seguimiento y no se
  simula un cursor.
- **En táctil (y para teclado en todas partes):** el **foco del teclado** actúa como objetivo
  de atención. Scope mira el elemento enfocado (el centro de su rectángulo) con el mismo
  sistema. Es un equivalente accesible y no simula nada. En la dirección C, el escáner móvil
  es otro objetivo.
- **`prefers-reduced-motion: reduce`:** la Presence está **desactivada** (ni cuerpo ni ojos).
  Es un movimiento disparado por la interacción y no esencial (WCAG 2.3.3).
- **Sin WebGL:** la imagen de respaldo no sigue al cursor. Es aceptable: es la degradación.

### 1.6 Pruebas (Node, sin navegador)

1. Límites: con el puntero en ±∞, `|yaw| < 10°`, `|pitch| < 8°` y `|gaze| < 4,5 mm`.
2. Orden: ante un salto del objetivo, los ojos alcanzan el 63 % antes que el cuerpo, y el
   cuerpo antes que el pico de la antena.
3. Estabilidad: con un objetivo fijo durante 10 s a 30, 60, 120 y 144 Hz, la oscilación
   residual es < 0,01°.
4. Clic: durante ClickReaction, los ojos no reciben aporte (desviación 0 frente al clip
   horneado).
5. Retorno: al salir el cursor, la presencia baja a < 1 % en ≤ 1,5 s.
6. Mirada sobre el cristal: error < 0,05 mm frente a LookAround.

Además, una prueba de navegador (Playwright con `?scope3d-software`): se mueve el ratón en
círculo y se leen `look` y los ojos desde `window.__scope3d` (solo en desarrollo).

### 1.7 Riesgos

| Riesgo | Mitigación |
|---|---|
| Los ojos se salen del cristal en las combinaciones de clip + Presence | Tabla de muestras limitada a ±4,5 mm + `validate_scope.py` ampliado a la suma |
| Coste por fotograma | ~40 operaciones escalares y un `getBoundingClientRect`; despreciable frente al render |
| Aspecto «seguidor de ratón» mecánico | La saturación `tanh`, el retardo del cuerpo, la deriva que continúa y el retorno con inactividad. Las constantes se ajustan con los ojos, no solo con los tests |

---

## 2. Luz común y superficies (para cualquier dirección)

- **Dirección de luz única.** Las sombras de la interfaz (si existen) y las viñetas usan la
  misma dirección de luz clave que el render de Scope (arriba a la izquierda). Los tokens son
  `--light-angle` y `--shadow-*`.
- **La luz de Scope sobre la interfaz.** El viewer publica la posición en pantalla de sus ojos
  en una variable CSS (`--scope-glow-x/y`, una escritura por fotograma, solo cuando cambia).
  Las superficies cercanas tienen un degradado radial ámbar muy tenue que la usa. No hay
  relayout: solo `background` en capas compuestas.
- **Sombra de contacto sobre superficies reales.** En el sitio, el suelo del viewer está
  oculto. Se sustituye por una **sombra en CSS** (elipse con desenfoque) dibujada por el dock
  sobre su regla o borde, en el plano de la página. Así funciona también con la imagen de
  respaldo (que hoy lleva la sombra horneada; habría que renderizarla sin sombra con
  `render_loader.py --only dock`, sin tocar el modelo).

## 3. Dirección C: la lente

### Implementación

- **Capa de reverso dispersa.** Cada elemento con reverso declara un
  `<ProcessNote for="hero-title">`, un componente servidor con contenido MDX/TS. La nota se
  posiciona sobre su anverso en el mismo flujo mediante CSS Grid (*stacking*) **o** con
  anclaje CSS (`anchor-name` / `position-anchor`). El anclaje ya es estable en Chromium; con
  respaldo de grid en Safari y Firefox.
- **Máscara circular:** `clip-path: circle(var(--lens-r) at var(--lens-x) var(--lens-y))`
  sobre la capa de reverso. Se actualizan variables CSS desde el mismo `ScopePointer`; no hay
  React por fotograma y la capa está compuesta (`will-change: clip-path` solo mientras la
  lente está activa).
- **Modo completo** (botón «Mirar debajo» o tecla `L`): el reverso pasa a ocupar el flujo,
  con transición en View Transitions API y fundido con movimiento reducido. Es el modo
  accesible: todo el contenido del reverso queda en el DOM, en orden de lectura, sin
  `aria-hidden`.
- **Foco:** al enfocar un elemento con reverso, su nota se muestra en un panel lateral
  (`aria-describedby` + región `aria-live="polite"`).
- **Móvil:** un escáner horizontal que se arrastra (`pointer events` con `touch-action:
  pan-y` fuera del asa, para no secuestrar el scroll), o el botón de modo completo.
- **Reverso de Scope:** una variante del material en el mismo GLB (`wireframe` + color de
  hueso) que el viewer activa cuando la lente se superpone a su canvas. Es un cambio de
  material, sin geometría nueva. Se dibuja en el mismo canvas con la técnica de *scissor* /
  *stencil* de la máscara circular. Alternativa barata: una hoja de contacto prerenderizada
  en Blender (`render_clips.py`) bajo la máscara.

### Contenido

Fuentes reales del repositorio:

- `docs/CONTEXT.md`
- las notas SPR
- `assets/scope-3d/reports/`
- las hojas de `renders/animation/`
- `git log`

Se curan **a mano**. Para cada reverso, una regla: **solo hechos verificables** (un commit,
una decisión, una cifra medida). Nada inventado.

## 4. Dependencias

| Necesidad | Decisión |
|---|---|
| Animación de interfaz | **framer-motion** (ya está) + tokens de `src/lib/motion` |
| Scroll | **Nativo.** Sin Lenis ni smooth scroll: secuestrar el scroll empeora la UX y la accesibilidad, y no aporta a esta dirección |
| Animaciones ligadas al scroll | CSS `animation-timeline: view()` donde esté soportado; respaldo estático |
| Transiciones de modo | View Transitions API (ya disponible en el stack), respaldo con fundido |
| 3D | **three r180 (ya está).** Sin dependencias nuevas |
| Contenido de reversos | Archivos TS/MDX en el repo |
| Nuevas fuentes | **Ninguna.** Geist Mono pasa a usarse de verdad |

## 5. Fases

| Fase | Contenido | Resultado verificable | Estimación |
|---|---|---|---|
| **0. Higiene** (sin rediseño, se puede hacer ya) | Enlaces `#` fuera, landmarks + saltar al contenido, pie mínimo, navegación móvil sin solapes, `lang` del contenido español, favicon, precarga del GLB solo con WebGL por hardware, errores de consola de three, CLS del gutter | Lighthouse a11y 100; 0 enlaces muertos; 0 errores de consola | 2–3 días |
| **1. Sistema (A)** | Tokens de color (marfil, noche, ámbar), escala tipográfica, rejilla editorial, cabecera con firma, nuevo hero con Scope en el primer viewport y la entrada que aterriza en la regla, secciones editoriales, proyectos con capturas reales, Contact contrastado | Capturas comparativas en 4 dispositivos; LCP ≤ el actual | 2–3 semanas |
| **2. Presence 3D** | §1 completo | Tests de §1.6 + prueba de navegador | 4–6 días |
| **3. Luz común** | §2 | Revisión visual; coste por fotograma sin cambios | 2–3 días |
| **4. La lente (C)** | §3, contenido de 4–5 reversos | Navegable con teclado y lector de pantalla; prueba móvil del escáner | 2 semanas + curación |
| **5. Casos de proyecto** | Páginas interiores con doble cara | — | 1–2 semanas |
| **6. Pulido y medición** | Revisión de motion, rendimiento en dispositivos reales con GPU, campo (Speed Insights), envío a CSSDA | CWV de campo en verde | 1 semana |

Cada fase se valida con TypeScript, lint, tests, build, Playwright (4 dispositivos, claro y
oscuro, movimiento reducido) y revisión visual antes de pasar a la siguiente. Nada se
publica sin la autorización del propietario.

## 6. Presupuestos (criterios de aceptación)

| Métrica | Presupuesto |
|---|---|
| LCP (laboratorio, móvil, 4× CPU, 4G) | ≤ 2,5 s; **el LCP no puede depender de que el 3D esté listo** (el hero tiene que ser visible bajo la salida de la entrada; ver MO-1) |
| CLS | ≤ 0,02 |
| INP | ≤ 200 ms (la lente y el escáner no pueden bloquear la interacción) |
| JS de la home (transferido) | ≤ 450 KB, incluido three (hoy 426 KB) |
| Peso total de la primera carga | ≤ 1,6 MB (hoy 1,50 MB) |
| Movimiento ambiental | Uno por viewport; todo se pausa fuera de la vista |
| Accesibilidad | Lighthouse 100, navegación completa con teclado, lector de pantalla probado (NVDA) |
| Sin GPU | Web completa y sin errores de consola en ≤ 1,5 s |

## 7. Riesgos globales

| Riesgo | Mitigación |
|---|---|
| No hay GPU en este equipo para validar el 3D en vivo | Probar en un equipo con GPU antes de cada entrega, y medir en campo |
| El contenido de los reversos queda pobre | La fase 4 solo se aborda con 4–5 reversos aprobados por el propietario; si no los hay, se queda la dirección A completa |
| La entrada encadenada retrasa el LCP | Rediseñar la salida para que revele un hero ya pintado (fase 1) |
| Exceso de ideas | Presupuesto de movimiento y un solo momento memorable por capítulo |
