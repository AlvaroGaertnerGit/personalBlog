# Scope 3D — Modelo

Especificación del modelo 3D definitivo de Scope (v3 aprobada) y de las decisiones de diseño
que lo sostienen. Rig, animaciones y máquina de estados: `SCOPE_3D_ANIMATION.md`.
Pipeline y comandos: `assets/scope-3d/README.md`.

Estado: **modelo, rig y 12 animaciones aprobados como base definitiva. No integrado en la
web**: el Scope 2D sigue siendo el de producción.

---

## 1. Jerarquía de referencias

Decisión del propietario (2026-10-13), por orden de prioridad:

1. La hoja de diseño original: `docs/scope-docs/scope/references/image.png`.
2. La documentación de identidad y personalidad (`SCOPE.md`, `VISUAL_LANGUAGE.md`,
   `BEHAVIOUR.md`, `DESIGN_FILTER.md`…). `PERSONALITY.md`, `CONSTRAINTS.md` y
   `SCOPE_UNDERSTANDING.md` son históricos; sus prohibiciones siguen vigentes salvo la antena.
3. Otras referencias visuales.
4. La implementación 2D (`src/components/scope/`). Es la fuente de **comportamientos y
   tiempos**, pero **no** una plantilla anatómica literal.

## 2. Identidad (resumen operativo)

- **Qué es:** una forma de vida diminuta y desconocida que habita la interfaz; curiosidad
  hecha materia. Nunca robot, mascota, asistente ni juguete.
- **Carácter:** curioso, gentil, silencioso, paciente, observador, tranquilo. Nunca ruidoso,
  hiperactivo, infantil ni cómico.
- **La cara es Scope:** cara grande, cuerpo pequeño, pies diminutos. Debe reconocerse en
  silueta negra y con solo la cara.
- **Comportamientos, no animaciones:** todo movimiento tiene causa; el reposo domina; nada
  pide atención.
- **Prohibiciones permanentes:** brazos, voz (salvo el saludo único de texto), ojos
  realistas, gamificación y nuevos "poderes". Hay excepciones aprobadas para la reacción al
  clic (ver `SCOPE_3D_ANIMATION.md` §1).

## 3. El modelo

Escala real: 150 mm de ancho. Blender usa Z arriba y Scope mira hacia −Y (en glTF, +Z hacia
la cámara de three.js). El origen está en el suelo, entre las patas. Todos los valores salen
de `assets/scope-3d/scripts/scope3d/spec.py`.

| Parte | Diseño final | De dónde sale |
|---|---|---|
| Cuerpo | Huevo compacto de 150 × 126 × 142 mm (a × al × prof.), algo más lleno abajo (taper 0,03), base suavemente aplanada | Hoja: panel Focus ≈ 1,17:1; Hero/Tilt para la profundidad |
| Cara | Rectángulo muy redondeado de 108 × 74 mm (r 28), algo por encima del centro, hundido en un capó profundo | Hoja: ≈ 65 % del ancho y 55 % de la altura del cuerpo |
| Borde de la cara | Grueso y redondeado. Anchura según la zona: frente 9,5 mm, esquinas superiores 5 mm, mejillas 8 mm, barbilla 5,5 mm | Hoja; corregido en v3 (el marco inferior pesaba demasiado) |
| Cristal | Superficie polinómica suave, a 4,3–7,7 mm por detrás del borde (más hundido en la frente, menos en la barbilla); satinado oscuro | v3: sin intersecciones ni "pantalla instalada" |
| Ojos | Cápsulas verticales ámbar de 14 × 26 mm a ±23 mm, con bloom suave | Hoja |
| Boca | Guion pequeño de 7 × 2,6 mm, 11 mm por debajo del centro de los ojos | Hoja y 2D (se conserva, ver §5) |
| Antena | Tallo curvo (r 2,3 mm, afilado), inclinado hacia la izquierda de Scope, bola de r 12 mm. La raíz se ensancha y sale de un ligero abultamiento | Hoja |
| Patas | Cuatro muñones cortos y romos que **salen de la propia carcasa**, abiertos hacia fuera (±55° delante, ±128° detrás) | Hoja |
| Material | Cerámica mineral beige: sRGB (206,172,128), variación tonal, motas oscuras y claras dispersas, grano en relieve | Hoja (el propietario descartó el token casi blanco) |
| Paleta de la cara | Negro `--scope-display`, ámbar `--scope-warm`, acento `--scope-accent` (oculto en reposo) | `src/app/globals.css` |

**Construcción** (`scope3d/faceshell.py`): carcasa y cristal son **una sola malla**. Sus
bucles de aristas siguen el contorno de la cara (cristal → pared del borde → falda → espalda).
Así no hay intersecciones, y el paso de negro a beige es un único bucle limpio con normales
divididas.

- El borde se redondea con un suavizado radial.
- Las patas son desplazamientos de la misma superficie, que además dan los pesos de la piel.
- Una comprobación aborta la construcción si algún punto de la cara sale del frente de la
  cabeza.
- `build_scope.py` se niega a añadir el rig a una carcasa que no coincida con
  `approved-geometry.json`.

## 4. Decisiones que no deben revertirse (y por qué)

- **El cristal no es una pieza aparte.** Un cristal separado que atraviesa la carcasa genera
  una línea dentada y una junta brillante.
- **La profundidad del cristal sigue al borde y es una superficie suave.** Si se liga la
  profundidad a la dirección con derivadas discontinuas, aparecen reflejos radiales en
  "molinete".
- **El borde es más fino en las esquinas superiores.** Ahí el huevo se estrecha hacia la
  coronilla; un borde más ancho se sale del frente de la cabeza y abre una grieta en la
  coronilla.
- **No hay que "engrosar" el borde añadiendo volumen.** Crea una banda tipo capucha.
- **Las proporciones salen de recortes sin deformar de la hoja.** Los recortes estirados
  llevaron a un cuerpo demasiado ancho (descartado).

## 5. Contradicciones del canon resueltas

| Tema | Conflicto | Resolución |
|---|---|---|
| Boca | El canon textual dice "nunca boca", pero el 2D y la hoja la muestran | Se conserva el guion pequeño de la hoja (decisión del propietario) |
| Color del cuerpo | El token `--scope-shell` es casi blanco; la hoja es beige | Beige de la hoja, también en patas y antena |
| Número de patas | El SVG tiene 2; la hoja tiene 4 | 4 (hoja) |
| Proporciones | El SVG es casi un círculo sobre dos patas | La hoja manda; el SVG no es plantilla |
| Parpadeo en la hoja | El panel "Blink" dibuja medialunas (forma rechazada por el canon) | El parpadeo es una línea cerrada (cambio de altura); los arcos solo aparecen en la risa al clic, como excepción aprobada |
| Asimetría de 1 mm en el 2D | Ojos, boca y pies desplazados 1 mm | Simetrizados (el rig necesita espejo) |

## 6. Comportamientos del Scope 2D (referencia para la web)

Inventario de lo que el Scope 2D hace hoy. La capa procedural 3D (mirada, orientación hacia
el cursor, vaivén de la antena, acento) debe reimplementar la capa Presence con estas
constantes. Los clips 3D cubren los comportamientos de la hoja.

Arquitectura 2D: `scope.tsx` combina **tres capas independientes** más un orquestador
externo.

### 6.1 Capa Motion — estados de ánimo (`scope-motion.ts`, `use-scope-motion.ts`)

| Mood | Cuerpo (scale / rotate° / y px) | Brillo | Ojos scaleY | Transición | Uso real |
|---|---|---|---|---|---|
| idle | bucle: y 0→−3,8, rot 0→−0,78, scale 1→1,019 | 0,45 | 1 | 4,2 s (oscuro) / 3,8 s (claro), mirror, easeInOut, infinito | Hero, reposo de Contact |
| curious | 1,03 / −4 / −3 | 0,70 | 1,10 | spring 220/20 | acknowledge (700 ms), idea en Contact |
| thinking | 0,98 / +2 / +5 | 0,25 | 0,50 | spring 120/22 | lab /scope |
| observe | 1,05 / −3 / −4 | 0,60 | 1,15 | spring 160/20 | About, Projects, Notebook, sellado/envío, transición de tema |
| happy | keyframes y [0,−14,−14,0], scale [1,1,05,0,97,1]; ojos [1,1,0,5,1] | 0,90 | — | 0,6 s, times [0,.35,.7,1]; el dueño vuelve a idle tras 650 ms | Contact: carta recibida |

Extras: boca scaleX/Y por mood (thinking 0,82/0,85 · happy 1,18/1,05 · curious 1,08), sigue la
mirada al 30 %/25 % y comparte el parpadeo; brillo con transición propia de 0,5 s.
**Movimiento reducido:** sin bucle, y/4, desviación de ojos /4, 0,3 s; el brillo sí se anima.
**Momento vivo 001 "Stillness":** tras ≥180 s sin actividad, una vez por tramo: la respiración
se funde a reposo (1,2 s), quietud total 2,5 s, vuelve (1,2 s).

### 6.2 Capa Presence — cursor (`use-scope-presence.ts`)

- Alcance 600 px desde el centro de Scope, normalizado a [−1, 1].
- Cuerpo: `rotateY` ±10°, `rotateX` ±8° (perspectiva 600), spring 90/16/1,2 — se orienta hacia el cursor.
- Ojos: ±9 px, spring 260/18/0,5, **anticipación por velocidad** (0,045 s, máx 0,3) — los ojos
  llegan antes que el cuerpo. Micro‑jitter permanente 0,6 px (senos de 5,2 s y 6,3 s).
- Cara: parallax ±2,5 px (cristal "hundido"), spring 70/18.
- Sombra: desplazamiento ±6/±4 px y scaleX 0,94–1,06 según la inclinación.
- Antena: sigue `rotateY` con un muelle flojo 50/10/0,8 → vaivén con retraso.
- Acento púrpura: escala = proximidad del cursor (spring 60/20), 0 en reposo.
- Se desactiva con movimiento reducido o `suspended`.

### 6.3 Capa Personality — comportamiento autónomo (`use-scope-personality.ts`)

Planificador: espera aleatoria 3–7 s tras la última actividad (pointermove/down, scroll,
keydown la reinician); un gesto por ventana; nunca repite el anterior; pestaña oculta = "la
habitación se apaga" (pausa). Prioridades: Stillness (si procede) → mirar al
`attentionTarget` (35 %, mantener 900 ms) → gesto del repertorio.

| Gesto | Canal | Valor pico | Mantener | Notas |
|---|---|---|---|---|
| glance-left / glance-right | cuerpo | rot ∓2,6°, y −1,3 | 900 ms | anticipación opuesta 30 % (0,15 s) |
| tiny-tilt | cuerpo | rot +1,9° | 1100 ms | anticipación |
| posture-shift | cuerpo | rot −1,3°, y +2,6 | 1000 ms | anticipación |
| stretch | cuerpo | scale 1,03 | 650 ms | "estirarse y exhalar" |
| bounce | cuerpo | y −6 | 150 ms | muelle subamortiguado 100/12 |
| blink / double-blink / slow-blink | ojos | 1→0,08→1 / doble / 0,12 | — | 0,16 s / 0,55 s / 0,6 s |
| squint / widen | ojos | 0,6 / 1,15 | 500 / 550 ms | |
| look-up / look-down | mirada | ∓4 px | 700 ms | |
| converge | mirada | ±1,5 px por ojo | 400 ms | |
| antenna-flex | antena | 5° | 300 ms | muelle 70/12 |
| look-at (attentionTarget) | mirada | hacia el objeto registrado, ±5 px | 900 ms | pelota de Tournamently, punto de MathView, papel de Contact |

**Toque ("confianza")** — clic en carcasa/cara, sin cursor de mano a propósito:
etapa 0 = un gesto de `TOUCH_NOTICE_POOL` vía *shuffle bag* (sin repeticiones); etapa 1 =
"risa callada" (y −3, ojos 0,4, 260 ms); etapa 2 = estiramiento completo (anticipación scale
0,97 → scale 1,07 + y −5 + ojos 0,22, 550 ms). La familiaridad sube un nivel por toque, decae
a los 25 s y se reinicia al cambiar de sección. Ignora toques mientras gesticula.

### 6.4 Orquestador Companion (`companion/*`, `theme-transition-controller.tsx`)

- **Una sola instancia** para todo el sitio; "camina" entre *docks* con `springs.companion`
  (55/16/1,6) en x, y, scale, rotate. Dock activo = mayor ratio de intersección.
- Docks: hero (idle, 1) · about (observe, 0,85) · mathview/tournamently (observe, 0,75 +
  attentionTarget) · notebook (observe, 0,4) · contact (idle → curious → observe → happy →
  idle 0,85 con `facing` 12°).
- `acknowledge()`: curious durante 700 ms (primera interacción con el formulario).
- Transición de tema: Scope suspendido, mood observe; mira arriba (y −8, rot −5) y sale por
  arriba en 0,52 s, pausa 120 ms, "cae" con la cortina 0,5 s, continúa 0,18 s, regresa 0,5 s.
- Saludo: primera carga de la sesión, tras 1 s, visible 2 s (texto, no modelo).
- Móvil: tamaño 160 px (vs 192 px en `sm`); sin hover, la mirada solo reacciona a pointermove.

