# Pulido final: nitidez, artefactos de la cara y movimiento — 2026-10-13

Todo medido en Chrome real (GTX 1660 Ti, ANGLE/D3D11) contra `/scope-lab`. Las cifras de web
son reproducibles con `node assets/scope-3d/scripts/web/measure-web.mjs <url>` (resultado de
la última ejecución: `reports/web-metrics.json`); las del modelo, con `validate_scope.py`
(`reports/VALIDATION.md`).

**Versión recuperable:** `approved/2026-10-13-v1/` guarda el `.blend`, el `.glb`, el JSON de
clips, los scripts y las hojas de contacto aprobados (con `SHA256SUMS`). También están en el
commit `fee3296`.

**Lo que no ha cambiado:** la carcasa (la firma de `approved-geometry.json` coincide), los
materiales, las luces, la paleta, el encuadre y el canon de expresiones.

---

## 1. Desenfoque: causas reales y corrección

### Qué se descartó (medido)

| Hipótesis | Prueba | Resultado |
|---|---|---|
| Canvas de baja resolución ampliado por CSS | Tamaño CSS vs backing store, a DPR 1 / 1,25 / 1,5 / 2 | No. El backing store ya era igual al tamaño CSS × DPR |
| Remuestreo del compositor (el canvas cae en x = 952,39 px, dentro de un `backdrop-filter`) | Píxeles del framebuffer vs captura de pantalla compuesta | No. Misma nitidez (diferencia media ≈ 2,8/255) en todos los DPR |
| Texturas y su filtrado | El GLB no lleva texturas | No aplica |
| Encuadre | Silueta en reposo: 82 % de la altura del hueco (131 px de 160), como el Scope 2D | Correcto. Ampliar el canvas apenas ganaría píxeles |
| Tu pantalla | 1920 × 1080 a 96 DPI → DPR 1 | Sin escalado de Windows |

### Causas reales (defectos técnicos)

1. **El antialiasing se resolvía antes del tone mapping.** El MSAA ×4 del composer promedia en
   HDR lineal. En el borde ojo (≈ 3–4) / cristal (≈ 0), un píxel con un 25 % de cobertura
   promedia ≈ 1, y AgX lo lleva casi a blanco: los bordes de alto contraste quedaban
   escalonados y "hervían" al moverse.
2. **El MSAA no actúa sobre el sombreado.** Las motas del grano procedural (≈ 0,6 px a
   160 px) aparecían y desaparecían con cada movimiento.
3. **Un `OutputPass` con alfa > 1.** El bloom también suma alfa, y los ojos llegaban al canvas
   con alfa 1,817. Es inocuo en pantalla (el canvas lo limita a 1), pero falsea cualquier lectura
   del canvas y es frágil.
4. **El halo de los ojos casi desaparecía en la vista web.** En el canvas transparente el bloom
   se mezclaba sin premultiplicar, así que el color añadido era ≈ glow². El halo quedaba muy por
   debajo del de Studio y del render aprobado de Blender, que sí muestran un resplandor ámbar
   cálido sobre el cristal. Ahora se compone como overlay premultiplicado con exactamente el
   mismo color que añade Studio.

### Corrección: resolución adaptativa + pase de salida propio

- **Canvas = píxeles físicos exactos** (CSS × devicePixelRatio). El navegador nunca lo reescala.
  Antes, en móviles 3× el canvas se limitaba a 2× y el navegador lo ampliaba 1,5×.
- **Supermuestreo** (`engine/scope-3d-resolution.ts`). La escena se renderiza a `ssaa`× (con
  MSAA) y `Scope3DOutputPass` hace el tone mapping y la conversión sRGB **por muestra**, después
  un filtro de caja exacto. Además despremultiplica y limita el alfa a [0, 1].
- **Política adaptativa** (`chooseQuality`):

  | Caso | Canvas | Interno |
  |---|---|---|
  | Escritorio, 160 px a 1× | 160² | 480² (3×) |
  | Escritorio, 160 px a 2× | 320² | 640² (2×) |
  | Móvil 3×, 160 px | 480² | 480² (1×, la densidad ya basta) |
  | Studio 1040 × 900 | 1040 × 900 | 2× con MSAA 2× (memoria) |

  Escala total máxima 4× y presupuesto de 4,2 M píxeles internos en escritorio y 1,6 M en
  táctil. El DPR solo baja si un canvas a pantalla completa no cabe en el presupuesto; nunca
  ocurre a tamaño web.
- **Grano filtrado** (`scope-3d-ceramic.ts`): una mota de menos de ~1,5 px en pantalla se
  desvanece (su aportación media es ≈ 0,1 % del tono). En Studio se ven todas.
- No se usa ningún filtro CSS de nitidez ni se sube el DPR indiscriminadamente.

### Resultado (LookAround a 160 px, mismos fotogramas frente a una referencia 8×)

| | Error medio | Píxeles que "saltan" por fotograma |
|---|---|---|
| Render anterior (MSAA, resuelto antes del tone mapping) | 6,88 | 119,1 |
| **Nuevo (auto = 3×, resuelto tras el tone mapping)** | **3,53** | **8,2** |

Comparativas visuales (capturas reales de la página, 1:1 y ampliadas sin suavizado):

- `renders/web/sharpness-128-160-before-after.png`
- `renders/web/sharpness-80-96-200-before-after.png`

Contexto real (Hero, About, oscuro y claro, escritorio y móvil):

- `renders/web/web-contexts-desktop-mobile.png`
- `renders/web/web-sizes-80-96-128-160-mobile3x.png`

### Límite físico (no es un defecto)

A 160 px Scope ocupa unos 110 × 131 px; a 80 px, unos 55 × 65.

- La boca mide ~2 px a 80 px y la antena ~1 px: por debajo de eso no hay detalle que dibujar.
- El supermuestreo hace que esos píxeles sean los correctos (bordes estables y suaves), pero no
  puede inventar resolución.
- A 128–160 px los ojos son cápsulas limpias; a 80–96 px son legibles, y la antena se ve
  continua.

---

## 2. Artefactos de la cara: causa y corrección

### Diagnóstico

Se renderizaron fotogramas concretos de LookAround a 800 px. Los contornos de los ojos aparecían
**mordidos**: muescas, lados aplanados, esquinas comidas, que cambiaban de un fotograma a otro.

Se midió en Blender la distancia con signo entre el contorno frontal del ojo y el cristal en cada
fotograma de cada clip. **El cristal es opaco**, así que lo que queda por debajo se recorta.

| Clip (v1) | Contorno más bajo |
|---|---|
| Reposo (Idle) | **−0,81 mm** (por debajo del cristal) |
| LookAround | −0,96 mm |
| Tilt | −1,09 mm |
| Focus | **−1,57 mm** |

Causa: el ojo era una lente **plana**, con solo 1,1 mm de radio en profundidad, colocada sobre un
cristal **curvo**:

- en reposo el cristal ya cortaba un 6 % arriba y un 11 % abajo;
- al desplazar la mirada el hueso solo se trasladaba, sin girar con la superficie, y un lado se
  hundía;
- Blink/Laugh (profundidad × 0,8) y `eye_h` (escala en línea recta) movían también la línea de
  corte.

Esa línea, que cambia en cada fotograma, son los "píxeles que se desplazan".

Descartado: z-fighting (paso de profundidad 0,002 mm, frente a separaciones de 0,1 mm o más) y
normales o geometría coplanar (la carcasa no ha cambiado).

### Corrección (rig y clips, `rig.py` / `clips.py`)

- Los ojos y sus shape keys se construyen **envueltos sobre la superficie del cristal**, con
  0,5 mm de separación constante en el contorno.
- Se conserva la **huella visible aprobada** en reposo: 14 × 23,7 mm, centrada 0,35 mm más
  arriba, medida sobre v1. La especificación dice 26 mm de alto, pero lo que viste y aprobaste
  medía 23,7.
- Los huesos de los ojos (y la boca) **giran con la normal del cristal** al desplazarse.
- Abrir los ojos (`eye_h` > 1, Focus) es un shape key nuevo, **`Tall`**, también envuelto.
  Entornarlos sigue siendo escala, que es segura porque los extremos se alejan del cristal.
- Nueva comprobación permanente en `validate_scope.py`: el contorno de ojos y boca nunca puede
  quedar bajo el cristal. Resultado: **mínimo +0,134 mm en todos los fotogramas de los 12 clips**
  (v1: −1,565 mm).

Evidencia: `renders/web/face-eyes-lookaround-before-after.png`.

### Un segundo origen de "saltos": un error del animador (también en v1)

Al liberar un clip terminado **dentro** del evento `finished`, three.js reordena su lista de
acciones a mitad de `mixer.update()`, y la acción que ocupa el hueco **se salta ese fotograma**.

Resultado: un "pop" de un fotograma al final de cada comportamiento (Idle desaparece un
fotograma) y en cada interrupción por clic. Medido: el squash saltó un 5 %; la punta de la antena
aceleró 16,5 mm/fotograma², frente a 1,2 en el movimiento normal.

Ahora la liberación se hace después de la actualización. Hay un test de regresión que falla con
el error y pasa con la corrección (`scope-3d-animator.test.ts`).

---

## 3. Movimiento

### Arquitectura

- **Fundidos con curva `smootherstep`** (velocidad y aceleración nulas en los extremos) en lugar
  de las rampas lineales de three.js. Un fundido interrumpido continúa desde su peso actual.
- **Interrupción por clic:** 350 ms suavizados (antes 180 ms lineales). La reacción entra en
  120 ms: todos los clips empiezan en reposo, y un fundido largo aplanaría la anticipación.
- **Aditivo sobre Idle** (se mantiene). Medido: ningún clip compite por los mismos huesos. Las
  deltas se suman y todos los clips empiezan y terminan en reposo (validado).
- **Capa secundaria en runtime** (`engine/scope-3d-secondary.ts`), después del mezclador:
  - **Muelle de la antena:**
    - dos segmentos (2,6 Hz / ζ 0,36 y 3,8 Hz / ζ 0,34);
    - lo mueve la inercia del cuerpo real, no la pose animada de la antena;
    - reacciona igual entre clips, en fundidos e interrupciones;
    - sustituye al muelle horneado: en v1 la antena no reaccionaba al salto (0,0°).
  - **Vida en Idle:**
    - deriva lenta de postura (±1,6° de giro, senos inconmensurables, nunca se repite);
    - parpadeos sueltos cada 3,6–8,5 s, uno de cada siete más lento y tierno;
    - se retira mientras suena un clip. Las animaciones autónomas siguen siendo cada 8–20 s.
- **Trampa de three.js documentada:** el mezclador solo escribe una propiedad cuando su valor
  cambia. Una capa encima debe recordar el valor del clip, o se reaplica sobre sí misma. Se
  detectó así: la antena derivaba 26°.

### Clips (horneados de nuevo en Blender)

Principios aplicados en todos:

- curvas suavizadas (cúbica monótona, pendiente nula en los extremos);
- *moving holds* (nada se congela);
- acción solapada: los ojos guían, el cuerpo los sigue ~0,1 s después, la inclinación llega
  detrás y la antena al final;
- sobreimpulsos pequeños y asentados.

| Clip | Antes → ahora | Cambios |
|---|---|---|
| LookAround | 1,5 → 2,6 s | Pausado y curioso; mirada larga a cada lado con deriva; medio parpadeo en el cambio de lado; vuelta con un leve sobreimpulso |
| Tilt | 1,2 → 1,9 s | Anticipación −1,3°, sobreimpulso 7,8° que se asienta, recuperación elástica que cruza el reposo una vez; ojos se adelantan y se abren |
| Bounce | 0,9 → 1,2 s | **Patas desfasadas:** despegan a 0,167 / 0,183 / 0,217 / 0,233 s, picos de 9–11° (antes las cuatro a 11° a la vez); cabeceo al aterrizar; **antena 9,5° / 6,8°** (antes 0°) |
| BlinkDouble | 1,0 → 1,2 s | Cierre rápido, pausa y apertura lenta; el ojo baja 1 mm al cerrarse (el párpado superior recorre más); el segundo parpadeo, más suave |
| Focus | 1,3 → 2,4 s | **Distinto de LookAround:** una sola dirección, giro pequeño (5°), se inclina 5° y se acerca 3,5 mm, se queda **quieto**; los ojos se entornan un instante y luego se abren (canon 2D observe 1,15) y convergen, siguiendo con mínimas derivas; la antena se adelanta y se mantiene |
| Stretch | 1,6 → 1,8 s | Subida progresiva y lenta; los ojos se cierran con el shape key Blink (no con escala); recuperación en dos rebotes decrecientes |
| Laugh | 1,5 → 1,8 s | Los ojos se cierran en línea y la línea se curva en arco; risitas a 3 Hz que se suavizan; los ojos acompañan; antena 4,4°; al final el arco vuelve a línea y se abre |
| ClickReaction | 2,5 → 2,8 s | Stretch + Laugh continuos. **Corregido el salto de ojos:** entornados → línea cerrada → arco, con Blink + Laugh = 1 en la transición. En v1 el arco se aplastaba con `eye_h` y formaba una "cúpula" cuadrada durante ~70 ms |

Evidencia: `renders/web/click-stretch-to-laugh-before-after.png` y
`renders/web/clips-overview-200px.png`.

Hojas de Blender regeneradas: `renders/animation/`. Las hojas de Blender no incluyen el muelle de
la antena: ahora es de runtime y solo se ve en el laboratorio y en los vídeos.

### Continuidad medida (director real a 60 fps)

Aceleración máxima de los puntos seguidos (antena, ojos, cuerpo, patas):

| Escenario | Antes de corregir el animador | Ahora |
|---|---|---|
| Autónomo interrumpido por un clic → Idle | 16,5 mm/fot.² (pop) | 1,16 |
| Clic desde Idle (reacción completa) | 1,16 | 1,16 |
| Seis comportamientos autónomos seguidos | — | 0,45 |

### Muelle de la antena: pico de flexión por clip (segmento 1 / 2)

| Idle | LookAround | Tilt | Bounce | BlinkDouble | Focus | Stretch | Laugh | Click |
|---|---|---|---|---|---|---|---|---|
| 0° | 1,4 / 0,9 | 3,1 / 2,1 | 9,5 / 6,8 | 1,2 / 1,1 | 3,0 / 1,5 | 6,4 / 4,3 | 4,4 / 2,8 | 5,7 / 4,0 |

Todos se asientan antes de acabar el clip o en los 0,13 s siguientes.

---

## 4. Rendimiento (GTX 1660 Ti; ver `web-metrics.json`)

| Medida | Valor |
|---|---|
| GLB | 2,94 MB. Antes 2,85 MB: +3 %, por el shape key `Tall` y la rotación de ojos y boca |
| Descarga / parseo | ~200 ms / ~16 ms (local) |
| Envolvente de movimiento al cargar (bloqueo único) | ~380 ms. En producción debe precalcularse como constante |
| Triángulos / draw calls por fotograma | 194 k (97 k + pasada de sombras) / 30 |
| Coste por fotograma a 160 px (GPU+CPU) | 1×: ~3,1–3,4 ms · 2×: ~3,2–4,1 ms · **3×: ~3,3–4,2 ms**. Varía entre ejecuciones; el supermuestreo cuesta < 1 ms |
| Sombras / bloom | ~0,8 ms / ~0,4 ms |
| Hilo principal por fotograma | ~0,6–1 ms |
| CPU limitada 4× / 6× | 115–155 FPS, sin degradar |
| Memoria | Render target interno 480² ≈ 3,9 MB; JS ~40 MB (incluye el runtime de desarrollo de Next) |
| Fuera de pantalla / pestaña oculta | El bucle se detiene: el reloj no avanza; se reanuda al volver |
| `prefers-reduced-motion` | Se respeta el del sistema: solo parpadeos, sin deriva de postura; el clic responde con un parpadeo |

**Regulador de rendimiento:**

- Decide por la **mediana** del tiempo de fotograma en dos ventanas seguidas de 2,5 s.
- No interpreta como lentitud un límite fijo del navegador (ahorro de batería o pantallas a
  30 Hz): esos fotogramas llegan con regularidad de reloj.
- Si baja de 40 FPS, reduce primero el supermuestreo (3 → 2 → 1) y por último quita las sombras.
- Nunca baja del DPR del dispositivo.
- Con la media se disparaba por error con bloqueos puntuales y degradaba la GTX para siempre.

**Sin GPU** (SwiftShader, por software): ~2–3 FPS incluso al mínimo. Es inviable con 194 k
triángulos. En modo web el visor **rechaza** los renderizadores por software y lo informa; en la
integración ahí entraría el Scope 2D. El Studio se sigue abriendo en cualquier equipo.

**Compromisos documentados:**

- El supermuestreo cuesta < 1 ms a tamaño web. Se mantiene porque es lo que hace nítido a
  Scope.
- El coste real lo marcan los triángulos (carcasa de ~45 k vértices). La retopología a ~10 k con
  mapa de normales sigue siendo el paso previo a la integración, igual que la compresión
  (meshopt/Draco) y el horneado del material.

---

## 5. Revisión independiente

Un agente observador revisó el diff. Encontró cinco problemas reales, todos corregidos y
verificados:

1. **Repetir un clip en curso lo devolvía de golpe al reposo.** Pasaba, por ejemplo, con un clic
   durante el parpadeo en modo de movimiento reducido. Ahora cada clip tiene dos instancias y la
   anterior se desvanece. Hay un test nuevo.
2. **El halo era más débil en la vista web** (§1, punto 4).
3. **El regulador podía degradar la calidad por un límite de 30 fps del navegador.**
4. **Fugas de memoria GPU al remontar el visor:** mapas de sombra y la geometría de
   `RoomEnvironment`.
5. **Detalles:** tope de `ssaa` a 4; el primer parpadeo de Idle ya no salta justo al cargar;
   `validate_scope.py` falla con un mensaje claro si no encuentra los contornos.

## 6. Criterios de aceptación

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Desenfoque técnico identificado y corregido | ✅ | §1: causas medidas; 119 → 8,2 px inestables por fotograma |
| 2 | Nítido a 128 y 160 px | ✅ | `sharpness-128-160-before-after.png` |
| 3 | Sin artefactos reproducibles en ojos y cavidad | ✅ | Contorno ≥ +0,134 mm en todos los fotogramas; pop del animador eliminado; tira de LookAround |
| 4 | Aceleraciones y frenadas suaves | ✅ | Curvas suavizadas y *moving holds*; fundidos smootherstep; continuidad medida |
| 5 | Antena reacciona a Bounce y Laugh | ✅ | 9,5° / 4,4° (antes 0° / 1,8°) |
| 6 | Patas no robóticas | ✅ | Desfase de 67 ms entre la primera y la última, amplitudes 9–11° |
| 7 | Focus y LookAround se distinguen | ✅ | `clips-overview-200px.png`; vídeos |
| 8 | Stretch → Laugh sin saltos | ✅ | `click-stretch-to-laugh-before-after.png` |
| 9 | Comportamiento autónomo | ✅ | Tests de la máquina de estados; vídeo autónomo; 8–20 s; Stretch y Laugh solo con clic |
| 10 | TypeScript, ESLint, tests y build | ✅ | `tsc --noEmit` y `eslint` sin errores; 15/15 tests (`node --test`); `pnpm build` correcto; `validate_scope.py` 12/12 PASS |
| 11 | Laboratorio en escritorio y móvil | ✅ | `web-contexts-desktop-mobile.png`, `videos/web-hero-160px-mobile.webm` |

**Pendiente de tu ojo:** la *sensación* del timing (peso, ternura, ritmo) solo se juzga
viéndolo a 60 fps. Los vídeos de `renders/web/videos/` son grabaciones headless (~25 fps). Las
ganancias del muelle y las curvas se ajustan con una constante cada una.
